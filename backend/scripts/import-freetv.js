#!/usr/bin/env node

/**
 * Free-TV/IPTV Importer
 * Imports channels from https://github.com/Free-TV/IPTV
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const FREETV_BASE = 'https://raw.githubusercontent.com/Free-TV/IPTV/master';
const MAIN_PLAYLIST = `${FREETV_BASE}/playlist.m3u8`;

function parseM3U(content) {
    const lines = content.split('\n');
    const channels = [];
    let currentChannel = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('#EXTINF:')) {
            const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
            const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
            const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
            const groupMatch = line.match(/group-title="([^"]*)"/);

            // Get display name from end of line
            const nameMatch = line.match(/,(.+)$/);

            currentChannel = {
                name: tvgNameMatch ? tvgNameMatch[1] : (nameMatch ? nameMatch[1].trim() : 'Unknown'),
                logo: tvgLogoMatch ? tvgLogoMatch[1] : null,
                epgId: tvgIdMatch ? tvgIdMatch[1] : null,
                category: groupMatch ? groupMatch[1] : 'General',
                country: null,
                description: ''
            };

            // Extract country from epgId (e.g., "RTK1.xk" -> "XK")
            if (currentChannel.epgId) {
                const countryMatch = currentChannel.epgId.match(/\.([a-z]{2})$/i);
                if (countryMatch) {
                    currentChannel.country = countryMatch[1].toUpperCase();
                }
            }

            // Or from group-title
            if (!currentChannel.country && groupMatch) {
                const groupCountry = mapGroupToCountry(groupMatch[1]);
                if (groupCountry) {
                    currentChannel.country = groupCountry;
                }
            }

        } else if ((line.startsWith('http://') || line.startsWith('https://')) && currentChannel) {
            currentChannel.streamUrl = line;
            currentChannel.streamType = detectStreamType(line);
            currentChannel.description = currentChannel.name;
            channels.push(currentChannel);
            currentChannel = null;
        }
    }

    return channels;
}

function mapGroupToCountry(group) {
    const countryMap = {
        'Albania': 'AL',
        'Kosovo': 'XK',
        'United States': 'US',
        'United Kingdom': 'GB',
        'Germany': 'DE',
        'France': 'FR',
        'Italy': 'IT',
        'Spain': 'ES',
        'Netherlands': 'NL',
        'Belgium': 'BE',
        'Austria': 'AT',
        'Switzerland': 'CH',
        'Poland': 'PL',
        'Czech Republic': 'CZ',
        'Slovakia': 'SK',
        'Hungary': 'HU',
        'Romania': 'RO',
        'Bulgaria': 'BG',
        'Serbia': 'RS',
        'Croatia': 'HR',
        'Slovenia': 'SI',
        'Bosnia and Herzegovina': 'BA',
        'Montenegro': 'ME',
        'North Macedonia': 'MK',
        'Greece': 'GR',
        'Turkey': 'TR',
        'Russia': 'RU',
        'Ukraine': 'UA',
        'Portugal': 'PT',
        'Brazil': 'BR',
        'Mexico': 'MX',
        'Argentina': 'AR',
        'Canada': 'CA',
        'Australia': 'AU',
        'India': 'IN',
        'Japan': 'JP',
        'South Korea': 'KR',
        'China': 'CN',
    };
    return countryMap[group] || null;
}

function detectStreamType(url) {
    if (url.includes('.m3u8')) return 'HLS';
    if (url.includes('.mpd')) return 'DASH';
    if (url.includes('.ts')) return 'MPEG_TS';
    if (url.includes('youtube.com')) return 'HLS';
    return 'HLS';
}

async function importFromFreeTV(options = {}) {
    const { dryRun = false, countryFilter = null } = options;

    console.log('📺 Free-TV/IPTV Importer\n');
    console.log('Fetching playlist from GitHub...');

    try {
        const response = await axios.get(MAIN_PLAYLIST, {
            timeout: 60000,
            headers: { 'User-Agent': 'Mozilla/5.0 IPTV-Importer/1.0' }
        });

        const channels = parseM3U(response.data);
        console.log(`Found ${channels.length} channels in playlist\n`);

        // Filter by country if specified
        let filteredChannels = channels;
        if (countryFilter) {
            const countries = countryFilter.split(',').map(c => c.toUpperCase().trim());
            filteredChannels = channels.filter(ch =>
                countries.includes(ch.country) ||
                countries.some(c => ch.category?.toLowerCase() === c.toLowerCase())
            );
            console.log(`Filtered to ${filteredChannels.length} channels for countries: ${countries.join(', ')}\n`);
        }

        if (dryRun) {
            console.log('🔍 DRY RUN - No changes will be made\n');
            const byCountry = {};
            filteredChannels.forEach(ch => {
                const country = ch.country || ch.category || 'Unknown';
                byCountry[country] = (byCountry[country] || 0) + 1;
            });
            console.log('Channels by country/category:');
            Object.entries(byCountry)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 30)
                .forEach(([country, count]) => {
                    console.log(`  ${country}: ${count}`);
                });
            return { total: filteredChannels.length, imported: 0, skipped: 0, dryRun: true };
        }

        let imported = 0;
        let skipped = 0;
        let updated = 0;

        for (const channel of filteredChannels) {
            try {
                // Check if channel exists by stream URL
                const existingByUrl = await prisma.channel.findFirst({
                    where: { streamUrl: channel.streamUrl }
                });

                if (existingByUrl) {
                    // Update logo if we have a better one
                    if (channel.logo && !existingByUrl.logo) {
                        await prisma.channel.update({
                            where: { id: existingByUrl.id },
                            data: { logo: channel.logo }
                        });
                        updated++;
                    }
                    skipped++;
                    continue;
                }

                // Check if channel exists by similar name
                const existingByName = await prisma.channel.findFirst({
                    where: {
                        name: { equals: channel.name, mode: 'insensitive' }
                    }
                });

                if (existingByName) {
                    skipped++;
                    continue;
                }

                // Get max sort order
                const maxSort = await prisma.channel.aggregate({
                    where: { country: channel.country || 'INT' },
                    _max: { sortOrder: true }
                });

                // Create new channel
                await prisma.channel.create({
                    data: {
                        name: (channel.name || 'Unknown').substring(0, 255),
                        description: (channel.description || channel.name || '').substring(0, 255),
                        logo: channel.logo || null,
                        streamUrl: channel.streamUrl,
                        streamType: channel.streamType,
                        category: channel.category || 'General',
                        country: channel.country || 'INT',
                        language: 'en',
                        epgId: channel.epgId,
                        isActive: true,
                        isLive: true,
                        sortOrder: (maxSort._max.sortOrder || 0) + 1
                    }
                });

                imported++;

                // Progress indicator
                if (imported % 50 === 0) {
                    process.stdout.write(`\rImported: ${imported} | Skipped: ${skipped}`);
                }

            } catch (err) {
                // Skip on error (likely duplicate)
                skipped++;
            }
        }

        console.log(`\r                                                    `);
        console.log('\n════════════════════════════════════════════════════');
        console.log('✅ Import Complete!');
        console.log(`   New channels imported: ${imported}`);
        console.log(`   Skipped (duplicates):  ${skipped}`);
        console.log(`   Logos updated:         ${updated}`);
        console.log('════════════════════════════════════════════════════');

        return { total: filteredChannels.length, imported, skipped, updated };

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        return { total: 0, imported: 0, skipped: 0, error: error.message };
    }
}

async function showStats() {
    const total = await prisma.channel.count();

    // Get Albanian/Kosovo counts
    const alCount = await prisma.channel.count({ where: { country: 'AL' } });
    const xkCount = await prisma.channel.count({ where: { country: 'XK' } });

    console.log('📊 Database Statistics\n');
    console.log(`Total channels: ${total}`);
    console.log(`Albania (AL):   ${alCount}`);
    console.log(`Kosovo (XK):    ${xkCount}`);
}

// CLI handling
const args = process.argv.slice(2);
const command = args[0];

async function main() {
    try {
        switch (command) {
            case 'all':
                await importFromFreeTV();
                break;

            case 'albania':
            case 'al':
                await importFromFreeTV({ countryFilter: 'AL,Albania' });
                break;

            case 'kosovo':
            case 'xk':
                await importFromFreeTV({ countryFilter: 'XK,Kosovo' });
                break;

            case 'balkan':
                await importFromFreeTV({
                    countryFilter: 'AL,XK,RS,HR,BA,ME,MK,SI,Albania,Kosovo,Serbia,Croatia,Bosnia and Herzegovina,Montenegro,North Macedonia,Slovenia'
                });
                break;

            case 'dry-run':
            case 'preview':
                await importFromFreeTV({ dryRun: true });
                break;

            case 'stats':
                await showStats();
                break;

            default:
                console.log('📺 Free-TV/IPTV Importer\n');
                console.log('Import free channels from https://github.com/Free-TV/IPTV\n');
                console.log('Commands:');
                console.log('  all       Import all channels (~1,900)');
                console.log('  albania   Import Albanian channels only');
                console.log('  kosovo    Import Kosovo channels only');
                console.log('  balkan    Import all Balkan region channels');
                console.log('  dry-run   Preview what would be imported');
                console.log('  stats     Show database statistics');
                console.log('\nExamples:');
                console.log('  node scripts/import-freetv.js all');
                console.log('  node scripts/import-freetv.js balkan');
                console.log('  node scripts/import-freetv.js dry-run');
                break;
        }
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
