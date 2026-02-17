#!/usr/bin/env node

/**
 * Logo Enrichment Script
 * 
 * Fetches logos for channels that are missing them using the iptv-org API
 * channels database which maps channel IDs (epgId / tvg-id) to logo URLs.
 *
 * Usage:
 *   node backend/scripts/enrich-logos.js              # Enrich all channels missing logos
 *   node backend/scripts/enrich-logos.js --country AL  # Only enrich Albanian channels
 *   node backend/scripts/enrich-logos.js --dry-run     # Preview without writing
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

const IPTV_ORG_CHANNELS_API = 'https://iptv-org.github.io/api/channels.json';
const IPTV_ORG_LOGOS_API = 'https://iptv-org.github.io/api/logos.json';

async function fetchIptvOrgData() {
    console.log('Fetching iptv-org channel + logos databases...');
    try {
        const [channelsRes, logosRes] = await Promise.all([
            axios.get(IPTV_ORG_CHANNELS_API, { timeout: 30000, maxContentLength: 50 * 1024 * 1024 }),
            axios.get(IPTV_ORG_LOGOS_API, { timeout: 30000, maxContentLength: 50 * 1024 * 1024 })
        ]);
        const channels = channelsRes.data;
        const logos = logosRes.data;
        console.log(`Loaded ${channels.length} channels and ${logos.length} logos from iptv-org`);

        const logoMap = new Map();
        for (const logo of logos) {
            if (logo.channel && logo.url) {
                if (!logoMap.has(logo.channel)) {
                    logoMap.set(logo.channel, logo.url);
                }
            }
        }

        const merged = channels.map(ch => ({
            ...ch,
            logo: logoMap.get(ch.id) || null
        }));

        const withLogo = merged.filter(ch => ch.logo).length;
        console.log(`Merged: ${withLogo} channels have logos`);
        return merged;
    } catch (error) {
        console.error(`Failed to fetch iptv-org data: ${error.message}`);
        return [];
    }
}

function buildLogoIndex(iptvOrgChannels) {
    const byId = new Map();
    const byName = new Map();

    for (const ch of iptvOrgChannels) {
        if (!ch.logo) continue;

        if (ch.id) {
            byId.set(ch.id.toLowerCase(), ch.logo);
        }
        if (ch.name) {
            const normalizedName = ch.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normalizedName.length > 2) {
                byName.set(normalizedName, ch.logo);
            }
        }
        if (ch.alt_names) {
            for (const alt of ch.alt_names) {
                const normalizedAlt = alt.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (normalizedAlt.length > 2) {
                    byName.set(normalizedAlt, ch.logo);
                }
            }
        }
    }

    console.log(`Logo index: ${byId.size} by ID, ${byName.size} by name`);
    return { byId, byName };
}

function findLogo(channel, logoIndex) {
    const { byId, byName } = logoIndex;

    if (channel.epgId) {
        const epgIdNormalized = channel.epgId.toLowerCase().split('@')[0];
        const logo = byId.get(epgIdNormalized);
        if (logo) return { logo, matchType: 'epgId' };
    }

    if (channel.name) {
        const nameNormalized = channel.name
            .toLowerCase()
            .replace(/\s*\(.*?\)\s*/g, '')
            .replace(/\s*\[.*?\]\s*/g, '')
            .replace(/[^a-z0-9]/g, '');

        if (nameNormalized.length > 2) {
            const logo = byName.get(nameNormalized);
            if (logo) return { logo, matchType: 'name' };
        }
    }

    return null;
}

function normalizeName(name) {
    return name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/\s*\[.*?\]\s*/g, '').replace(/[^a-z0-9]/g, '');
}

async function selfEnrich(channelIds, dryRun) {
    if (channelIds.length === 0) return { enriched: 0 };

    console.log(`\n--- Self-enrichment pass (matching against own DB) ---`);

    const stillMissing = await prisma.channel.findMany({
        where: { id: { in: channelIds }, isActive: true },
        select: { id: true, name: true, country: true }
    });

    if (stillMissing.length === 0) return { enriched: 0 };

    // Build a map of normalizedName -> logo from channels that DO have logos
    const withLogos = await prisma.channel.findMany({
        where: {
            isActive: true,
            logo: { not: null },
            NOT: { logo: '' }
        },
        select: { name: true, logo: true }
    });

    const selfLogoMap = new Map();
    for (const ch of withLogos) {
        if (!ch.name || !ch.logo) continue;
        const key = normalizeName(ch.name);
        if (key.length > 2 && !selfLogoMap.has(key)) {
            selfLogoMap.set(key, ch.logo);
        }
    }
    console.log(`Self-logo index: ${selfLogoMap.size} unique names with logos`);

    let enriched = 0;
    for (const channel of stillMissing) {
        if (!channel.name) continue;
        const key = normalizeName(channel.name);
        if (key.length <= 2) continue;

        const logo = selfLogoMap.get(key);
        if (logo) {
            if (dryRun) {
                console.log(`  [DRY-SELF] ${channel.name} (${channel.country}) -> ${logo}`);
            } else {
                await prisma.channel.update({
                    where: { id: channel.id },
                    data: { logo }
                });
            }
            enriched++;
        }
    }

    console.log(`Self-enrichment: ${enriched} channels matched`);
    return { enriched };
}

async function enrichLogos(options = {}) {
    const { country = null, dryRun = false, limit = null } = options;

    // Match both NULL and empty-string logos
    const where = {
        isActive: true,
        OR: [
            { logo: null },
            { logo: '' }
        ]
    };
    if (country) {
        where.country = country.toUpperCase();
    }

    const channelsWithoutLogo = await prisma.channel.findMany({
        where,
        select: { id: true, name: true, epgId: true, country: true, logo: true },
        orderBy: { name: 'asc' },
        ...(limit ? { take: limit } : {})
    });

    const totalMissing = channelsWithoutLogo.length;
    console.log(`\nFound ${totalMissing} channels without logos${country ? ` (country: ${country})` : ''}`);
    const nullCount = channelsWithoutLogo.filter(c => c.logo === null).length;
    const emptyCount = channelsWithoutLogo.filter(c => c.logo === '').length;
    console.log(`  (${nullCount} NULL, ${emptyCount} empty string)`);

    if (channelsWithoutLogo.length === 0) {
        console.log('All channels already have logos!');
        return { enriched: 0, total: 0 };
    }

    const iptvOrgChannels = await fetchIptvOrgData();
    if (iptvOrgChannels.length === 0) {
        console.log('Could not fetch iptv-org data. Aborting.');
        return { enriched: 0, total: channelsWithoutLogo.length };
    }

    const logoIndex = buildLogoIndex(iptvOrgChannels);

    let enriched = 0;
    let noMatch = 0;
    const unmatchedIds = [];

    for (const channel of channelsWithoutLogo) {
        const match = findLogo(channel, logoIndex);
        if (match) {
            if (dryRun) {
                console.log(`  [DRY] ${channel.name} -> ${match.logo} (via ${match.matchType})`);
            } else {
                await prisma.channel.update({
                    where: { id: channel.id },
                    data: { logo: match.logo }
                });
            }
            enriched++;
        } else {
            unmatchedIds.push(channel.id);
            noMatch++;
        }
    }

    console.log(`\niptv-org enrichment: ${enriched} matched, ${noMatch} unmatched`);

    // Self-enrichment pass: match remaining logoless channels against our own DB
    const selfResult = await selfEnrich(unmatchedIds, dryRun);
    const totalEnriched = enriched + selfResult.enriched;
    const finalNoMatch = noMatch - selfResult.enriched;

    console.log(`\nLogo enrichment ${dryRun ? '(DRY RUN) ' : ''}complete:`);
    console.log(`  Enriched (iptv-org): ${enriched}`);
    console.log(`  Enriched (self):     ${selfResult.enriched}`);
    console.log(`  Total enriched:      ${totalEnriched}`);
    console.log(`  No match:            ${finalNoMatch}`);
    console.log(`  Total processed:     ${channelsWithoutLogo.length}`);

    return { enriched: totalEnriched, noMatch: finalNoMatch, total: channelsWithoutLogo.length };
}

async function main() {
    const args = process.argv.slice(2);
    const options = {};

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--country' && args[i + 1]) {
            options.country = args[i + 1];
            i++;
        } else if (args[i] === '--dry-run') {
            options.dryRun = true;
        } else if (args[i] === '--limit' && args[i + 1]) {
            options.limit = parseInt(args[i + 1], 10);
            i++;
        }
    }

    console.log('=== Channel Logo Enrichment ===');
    if (options.dryRun) console.log('(DRY RUN mode - no changes will be made)');

    try {
        await enrichLogos(options);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
