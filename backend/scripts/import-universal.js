#!/usr/bin/env node

/**
 * Universal IPTV Importer
 *
 * Supports multiple formats and sources:
 * - M3U/M3U8 playlists
 * - JSON playlists
 * - Xtream Codes API
 * - Direct APIs (Pluto TV, Samsung TV Plus, Xumo, Plex, Stirr, Roku)
 *
 * Usage:
 *   node scripts/import-universal.js <command> [options]
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Import services
const { parsePlaylist, detectFormat, parseM3U, parseJSON } = require('../src/services/playlistParsers');
const { XtreamImporter, createFromUrl: createXtreamFromUrl } = require('../src/services/xtreamImporter');
const {
    PlutoTVImporter,
    SamsungTVPlusImporter,
    XumoImporter,
    PlexImporter,
    StirrImporter,
    RokuImporter,
    importAll: importAllApis
} = require('../src/services/directApiImporter');

const HELP = `
╔══════════════════════════════════════════════════════════════════╗
║               UNIVERSAL IPTV IMPORTER                            ║
╠══════════════════════════════════════════════════════════════════╣
║  Supports: M3U, M3U8, JSON, Xtream Codes API, Direct APIs        ║
╠══════════════════════════════════════════════════════════════════╣
║  COMMANDS:                                                        ║
║                                                                   ║
║  FILE/URL IMPORT:                                                 ║
║    url <url>              Import from any URL (auto-detect)      ║
║    file <path>            Import from local file (auto-detect)   ║
║    m3u <url|path>         Import M3U/M3U8 playlist               ║
║    json <url|path>        Import JSON playlist                   ║
║                                                                   ║
║  XTREAM CODES:                                                    ║
║    xtream <url>           Import from Xtream Codes API           ║
║    xtream-info <url>      Show Xtream server info (no import)    ║
║                                                                   ║
║  DIRECT APIS:                                                     ║
║    pluto [region]         Import Pluto TV (default: us)          ║
║    samsung [region]       Import Samsung TV Plus (default: us)   ║
║    xumo                   Import Xumo (US only)                  ║
║    plex                   Import Plex Live TV                    ║
║    stirr                  Import Stirr                           ║
║    roku                   Import Roku Channel                    ║
║    all-apis               Import from ALL direct APIs            ║
║                                                                   ║
║  OTHER:                                                           ║
║    detect <url|path>      Detect format without importing        ║
║    stats                  Show database statistics               ║
║                                                                   ║
║  OPTIONS:                                                         ║
║    --dry-run              Preview without importing              ║
║    --limit <n>            Limit number of channels               ║
║    --category <name>      Filter by category                     ║
║    --country <code>       Set country code                       ║
║                                                                   ║
║  EXAMPLES:                                                        ║
║    node scripts/import-universal.js url https://example.com/tv.m3u║
║    node scripts/import-universal.js file /path/to/playlist.json  ║
║    node scripts/import-universal.js xtream "http://server/get.php?username=X&password=Y"
║    node scripts/import-universal.js pluto uk                     ║
║    node scripts/import-universal.js all-apis --dry-run           ║
╚══════════════════════════════════════════════════════════════════╝
`;

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        command: args[0],
        target: args[1],
        dryRun: args.includes('--dry-run'),
        limit: null,
        category: null,
        country: null
    };

    // Parse --limit
    const limitIdx = args.indexOf('--limit');
    if (limitIdx > -1 && args[limitIdx + 1]) {
        options.limit = parseInt(args[limitIdx + 1]);
    }

    // Parse --category
    const catIdx = args.indexOf('--category');
    if (catIdx > -1 && args[catIdx + 1]) {
        options.category = args[catIdx + 1];
    }

    // Parse --country
    const countryIdx = args.indexOf('--country');
    if (countryIdx > -1 && args[countryIdx + 1]) {
        options.country = args[countryIdx + 1].toUpperCase();
    }

    return options;
}

// Fetch content from URL or file
async function fetchContent(target) {
    if (target.startsWith('http://') || target.startsWith('https://')) {
        console.log(`📥 Fetching from URL: ${target}`);
        const response = await axios.get(target, {
            timeout: 60000,
            headers: { 'User-Agent': 'Mozilla/5.0 IPTV-Importer/1.0' },
            maxContentLength: 100 * 1024 * 1024 // 100MB max
        });
        return response.data;
    } else {
        console.log(`📁 Reading from file: ${target}`);
        return fs.readFileSync(target, 'utf-8');
    }
}

// Import channels to database
async function importChannels(channels, options = {}) {
    const { dryRun = false, limit = null, category = null, country = null } = options;

    let toImport = channels;

    if (limit) {
        toImport = toImport.slice(0, limit);
    }

    console.log(`\n📺 Processing ${toImport.length} channels...`);

    if (dryRun) {
        console.log('\n🔍 DRY RUN - No changes will be made\n');

        // Show sample
        console.log('Sample channels:');
        toImport.slice(0, 10).forEach((ch, i) => {
            console.log(`  ${i + 1}. ${ch.name} (${ch.category || 'N/A'})`);
        });

        if (toImport.length > 10) {
            console.log(`  ... and ${toImport.length - 10} more`);
        }

        return { total: toImport.length, imported: 0, skipped: 0, dryRun: true };
    }

    let imported = 0;
    let skipped = 0;
    let updated = 0;

    for (const channel of toImport) {
        try {
            const existing = await prisma.channel.findFirst({
                where: { streamUrl: channel.streamUrl }
            });

            if (existing) {
                // Update if we have better data
                const updates = {};
                if (channel.logo && !existing.logo) updates.logo = channel.logo;
                if (channel.description && !existing.description) {
                    updates.description = channel.description.substring(0, 255);
                }

                if (Object.keys(updates).length > 0) {
                    await prisma.channel.update({
                        where: { id: existing.id },
                        data: updates
                    });
                    updated++;
                }
                skipped++;
                continue;
            }

            await prisma.channel.create({
                data: {
                    name: (channel.name || 'Unknown').substring(0, 255),
                    description: (channel.description || '').substring(0, 255),
                    logo: channel.logo,
                    streamUrl: channel.streamUrl,
                    streamType: channel.streamType || 'HLS',
                    category: category || channel.category || 'General',
                    country: country || channel.country || 'INT',
                    language: channel.language || 'en',
                    epgId: channel.epgId,
                    isActive: true,
                    isLive: true
                }
            });

            imported++;

            if (imported % 100 === 0) {
                process.stdout.write(`\r  Imported: ${imported}`);
            }
        } catch (error) {
            skipped++;
        }
    }

    console.log('\n');

    return { total: toImport.length, imported, skipped, updated };
}

// Show statistics
async function showStats() {
    const total = await prisma.channel.count();
    const active = await prisma.channel.count({ where: { isActive: true } });

    const byCountry = await prisma.channel.groupBy({
        by: ['country'],
        _count: true,
        orderBy: { _count: { country: 'desc' } },
        take: 15
    });

    const byCategory = await prisma.channel.groupBy({
        by: ['category'],
        _count: true,
        orderBy: { _count: { category: 'desc' } },
        take: 15
    });

    console.log('\n📊 Database Statistics\n');
    console.log(`Total channels:  ${total}`);
    console.log(`Active channels: ${active}\n`);

    console.log('Top Countries:');
    byCountry.forEach(c => {
        console.log(`  ${(c.country || 'Unknown').padEnd(10)} ${c._count}`);
    });

    console.log('\nTop Categories:');
    byCategory.forEach(c => {
        console.log(`  ${(c.category || 'Unknown').padEnd(20)} ${c._count}`);
    });
}

// Main function
async function main() {
    const options = parseArgs();

    if (!options.command || options.command === 'help' || options.command === '--help') {
        console.log(HELP);
        return;
    }

    console.log('\n🎬 Universal IPTV Importer\n');

    try {
        let result;

        switch (options.command) {
            // ─────────────────────────────────────────────────────────
            // URL/FILE IMPORT
            // ─────────────────────────────────────────────────────────
            case 'url':
            case 'file':
            case 'm3u':
            case 'json':
                if (!options.target) {
                    console.error('Error: URL or file path required');
                    console.log(`Usage: node scripts/import-universal.js ${options.command} <url|path>`);
                    process.exit(1);
                }

                const content = await fetchContent(options.target);
                const format = detectFormat(content, options.target);
                console.log(`Detected format: ${format}`);

                let channels;
                if (format === 'm3u' || options.command === 'm3u') {
                    channels = parseM3U(content);
                } else if (format === 'json' || options.command === 'json') {
                    channels = parseJSON(content);
                } else {
                    const parsed = await parsePlaylist(content, options.target);
                    channels = parsed.channels;
                }

                console.log(`Parsed ${channels.length} channels`);
                result = await importChannels(channels, options);
                break;

            // ─────────────────────────────────────────────────────────
            // XTREAM CODES
            // ─────────────────────────────────────────────────────────
            case 'xtream':
                if (!options.target) {
                    console.error('Error: Xtream URL required');
                    console.log('Usage: node scripts/import-universal.js xtream "http://server/get.php?username=X&password=Y"');
                    process.exit(1);
                }

                const xtream = createXtreamFromUrl(options.target);
                await xtream.authenticate();
                result = await xtream.importLiveChannels({
                    limit: options.limit,
                    categoryFilter: options.category
                });
                break;

            case 'xtream-info':
                if (!options.target) {
                    console.error('Error: Xtream URL required');
                    process.exit(1);
                }

                const xtreamInfo = createXtreamFromUrl(options.target);
                const info = await xtreamInfo.getFullInfo();

                console.log('\n📡 Xtream Server Info\n');
                console.log(`Server: ${info.server.url}`);
                console.log(`Status: ${info.server.status}`);
                console.log(`Expires: ${info.server.expDate ? new Date(info.server.expDate * 1000).toLocaleDateString() : 'N/A'}`);
                console.log(`\nContent:`);
                console.log(`  Live channels: ${info.counts.live}`);
                console.log(`  VOD items:     ${info.counts.vod}`);
                console.log(`  Series:        ${info.counts.series}`);
                console.log(`\nLive Categories: ${info.categories.live.length}`);
                info.categories.live.slice(0, 10).forEach(c => {
                    console.log(`  - ${c.category_name}`);
                });
                return;

            // ─────────────────────────────────────────────────────────
            // DIRECT APIS
            // ─────────────────────────────────────────────────────────
            case 'pluto':
                const pluto = new PlutoTVImporter(options.target || 'us');
                result = await pluto.import({ dryRun: options.dryRun, limit: options.limit });
                break;

            case 'samsung':
                const samsung = new SamsungTVPlusImporter(options.target || 'us');
                result = await samsung.import({ dryRun: options.dryRun, limit: options.limit });
                break;

            case 'xumo':
                const xumo = new XumoImporter();
                result = await xumo.import({ dryRun: options.dryRun, limit: options.limit });
                break;

            case 'plex':
                const plex = new PlexImporter();
                result = await plex.import({ dryRun: options.dryRun, limit: options.limit });
                break;

            case 'stirr':
                const stirr = new StirrImporter();
                result = await stirr.import({ dryRun: options.dryRun, limit: options.limit });
                break;

            case 'roku':
                const roku = new RokuImporter();
                result = await roku.import({ dryRun: options.dryRun, limit: options.limit });
                break;

            case 'all-apis':
                console.log('Importing from ALL direct APIs...\n');
                result = await importAllApis({
                    regions: ['us'],
                    dryRun: options.dryRun
                });

                console.log('\n═══════════════════════════════════════════');
                console.log('Summary:');
                let totalImported = 0;
                for (const [source, res] of Object.entries(result)) {
                    console.log(`  ${source}: ${res.imported} imported, ${res.skipped} skipped`);
                    totalImported += res.imported || 0;
                }
                console.log(`\nTotal new channels: ${totalImported}`);
                console.log('═══════════════════════════════════════════');
                return;

            // ─────────────────────────────────────────────────────────
            // OTHER
            // ─────────────────────────────────────────────────────────
            case 'detect':
                if (!options.target) {
                    console.error('Error: URL or file path required');
                    process.exit(1);
                }

                const detectContent = await fetchContent(options.target);
                const detectedFormat = detectFormat(detectContent, options.target);
                console.log(`\nDetected format: ${detectedFormat}`);

                if (detectedFormat === 'm3u') {
                    const m3uChannels = parseM3U(detectContent);
                    console.log(`Contains ${m3uChannels.length} channels`);
                } else if (detectedFormat === 'json') {
                    const jsonChannels = parseJSON(detectContent);
                    console.log(`Contains ${jsonChannels.length} channels`);
                }
                return;

            case 'stats':
                await showStats();
                return;

            default:
                console.error(`Unknown command: ${options.command}`);
                console.log('Use --help to see available commands');
                process.exit(1);
        }

        // Show result
        if (result) {
            console.log('\n═══════════════════════════════════════════');
            console.log('✅ Import Complete');
            console.log(`   Total:    ${result.total}`);
            console.log(`   Imported: ${result.imported}`);
            console.log(`   Skipped:  ${result.skipped}`);
            if (result.updated) console.log(`   Updated:  ${result.updated}`);
            if (result.dryRun) console.log('   (Dry run - no changes made)');
            console.log('═══════════════════════════════════════════');
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (process.env.DEBUG) {
            console.error(error.stack);
        }
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
