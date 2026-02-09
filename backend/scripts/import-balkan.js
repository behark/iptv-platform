#!/usr/bin/env node

/**
 * Bulk Balkan Channel Import Script
 * 
 * Multi-source importer that pulls Balkan channels from:
 *   1. iptv-org country playlists (11 Balkan countries)
 *   2. iptv-org language playlists (9 Balkan languages)
 *   3. Free-TV/IPTV playlists (separate verified source)
 *   4. Local playlist with name/group pattern matching (274+ channels)
 *
 * Usage:
 *   node backend/scripts/import-balkan.js                    # All online sources (phases 1-3)
 *   node backend/scripts/import-balkan.js --local             # Also scan local playlist with smart matching
 *   node backend/scripts/import-balkan.js --all               # Everything: online + local + logo enrichment
 *   node backend/scripts/import-balkan.js --stats             # Show current Balkan channel stats
 */

const path = require('path');
const fs = require('fs').promises;
const { PrismaClient } = require('@prisma/client');
const {
    importBalkanChannels,
    importFromLocalPlaylist,
    importFromUrl,
    FREETV_FULL,
    BALKAN_COUNTRIES,
    BALKAN_LANGUAGES,
    getStats
} = require('../src/services/channelImporter');

const prisma = new PrismaClient();

const LOCAL_PLAYLIST_PATH = path.resolve(__dirname, '../../iptv_full_playlist.m3u');

async function showBalkanStats() {
    console.log('\n=== Current Balkan Channel Stats ===\n');

    const balkanCountryCodes = BALKAN_COUNTRIES.map(c => c.toUpperCase());
    let grandTotal = 0;
    let grandWithLogo = 0;

    for (const code of balkanCountryCodes) {
        const count = await prisma.channel.count({
            where: { country: code, isActive: true }
        });
        const withLogo = await prisma.channel.count({
            where: { country: code, isActive: true, logo: { not: null } }
        });
        const withoutLogo = count - withLogo;
        grandTotal += count;
        grandWithLogo += withLogo;
        console.log(`  ${code}: ${count} channels (${withLogo} with logo, ${withoutLogo} without)`);
    }

    const totalAll = await prisma.channel.count({ where: { isActive: true } });
    const totalWithLogo = await prisma.channel.count({ where: { isActive: true, logo: { not: null } } });
    console.log(`\n  Total Balkan: ${grandTotal} (${grandWithLogo} with logo)`);
    console.log(`  Total All: ${totalAll} (${totalWithLogo} with logo)`);
}

async function main() {
    const args = process.argv.slice(2);
    const useLocal = args.includes('--local') || args.includes('--all');
    const enrich = args.includes('--enrich') || args.includes('--all');
    const statsOnly = args.includes('--stats');

    try {
        if (statsOnly) {
            await showBalkanStats();
            return;
        }

        console.log('=======================================================');
        console.log('  BULK BALKAN CHANNEL IMPORT - Multi-Source Strategy');
        console.log('=======================================================\n');
        console.log(`Countries: ${BALKAN_COUNTRIES.map(c => c.toUpperCase()).join(', ')}`);
        console.log(`Languages: ${BALKAN_LANGUAGES.join(', ')}`);
        console.log(`Sources: iptv-org (countries+languages) + Free-TV/IPTV${useLocal ? ' + Local playlist' : ''}`);

        console.log('\n--- Before Import ---');
        await showBalkanStats();

        console.log('\n\n--- Importing from all online sources (iptv-org + Free-TV) ---');
        const results = await importBalkanChannels();

        if (useLocal) {
            console.log('\n\n--- Scanning local playlist with smart name/group matching ---');
            try {
                await fs.access(LOCAL_PLAYLIST_PATH);
                const localResult = await importFromLocalPlaylist(LOCAL_PLAYLIST_PATH, {
                    countries: BALKAN_COUNTRIES.map(c => c.toUpperCase()),
                    useNameMatching: true
                });
                console.log(`Local playlist result: imported=${localResult.imported} skipped=${localResult.skipped} failed=${localResult.failed}`);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    console.log(`Local playlist not found at: ${LOCAL_PLAYLIST_PATH}`);
                    console.log('Download a full M3U playlist and save it as iptv_full_playlist.m3u in the project root.');
                } else {
                    console.log(`Local playlist error: ${error.message}`);
                }
            }
        }

        if (enrich) {
            console.log('\n\n--- Run logo enrichment separately ---');
            console.log('  node backend/scripts/enrich-logos.js');
            console.log('  node backend/scripts/enrich-logos.js --country AL');
            console.log('  node backend/scripts/enrich-logos.js --country XK');
        }

        console.log('\n\n--- After Import ---');
        await showBalkanStats();

        console.log('\n=======================================================');
        console.log('  IMPORT COMPLETE');
        console.log('=======================================================');

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
