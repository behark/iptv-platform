#!/usr/bin/env node

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { detectStreamInfo } = require('../src/utils/stream');

const prisma = new PrismaClient();

const IPTV_ORG_BASE = 'https://iptv-org.github.io/iptv';

const MAIN_PLAYLISTS = {
    all: `${IPTV_ORG_BASE}/index.m3u`,
    byCountry: `${IPTV_ORG_BASE}/index.country.m3u`,
    byCategory: `${IPTV_ORG_BASE}/index.category.m3u`,
    byLanguage: `${IPTV_ORG_BASE}/index.language.m3u`,
    byRegion: `${IPTV_ORG_BASE}/index.region.m3u`
};

const CATEGORIES = [
    'animation', 'auto', 'business', 'classic', 'comedy', 'cooking',
    'culture', 'documentary', 'education', 'entertainment', 'family',
    'general', 'kids', 'legislative', 'lifestyle', 'movies', 'music',
    'news', 'outdoor', 'relax', 'religious', 'science', 'series',
    'shop', 'sports', 'travel', 'weather', 'xxx'
];

const COUNTRIES = [
    'ad', 'ae', 'af', 'ag', 'al', 'am', 'ao', 'ar', 'at', 'au', 'aw', 'az',
    'ba', 'bb', 'bd', 'be', 'bf', 'bg', 'bh', 'bi', 'bj', 'bm', 'bn', 'bo',
    'bq', 'br', 'bs', 'bt', 'bw', 'by', 'bz', 'ca', 'cd', 'cf', 'cg', 'ch',
    'ci', 'cl', 'cm', 'cn', 'co', 'cr', 'cu', 'cv', 'cw', 'cy', 'cz', 'de',
    'dj', 'dk', 'dm', 'do', 'dz', 'ec', 'ee', 'eg', 'er', 'es', 'et', 'fi',
    'fj', 'fo', 'fr', 'ga', 'gb', 'gd', 'ge', 'gf', 'gh', 'gm', 'gn', 'gp',
    'gq', 'gr', 'gt', 'gw', 'gy', 'hk', 'hn', 'hr', 'ht', 'hu', 'id', 'ie',
    'il', 'in', 'iq', 'ir', 'is', 'it', 'jm', 'jo', 'jp', 'ke', 'kg', 'kh',
    'km', 'kn', 'kp', 'kr', 'kw', 'ky', 'kz', 'la', 'lb', 'lc', 'li', 'lk',
    'lr', 'ls', 'lt', 'lu', 'lv', 'ly', 'ma', 'mc', 'md', 'me', 'mg', 'mk',
    'ml', 'mm', 'mn', 'mo', 'mq', 'mr', 'ms', 'mt', 'mu', 'mv', 'mw', 'mx',
    'my', 'mz', 'na', 'nc', 'ne', 'ng', 'ni', 'nl', 'no', 'np', 'nz', 'om',
    'pa', 'pe', 'pf', 'pg', 'ph', 'pk', 'pl', 'pr', 'ps', 'pt', 'py', 'qa',
    're', 'ro', 'rs', 'ru', 'rw', 'sa', 'sb', 'sc', 'sd', 'se', 'sg', 'si',
    'sk', 'sl', 'sm', 'sn', 'so', 'sr', 'ss', 'st', 'sv', 'sx', 'sy', 'sz',
    'tc', 'td', 'tg', 'th', 'tj', 'tl', 'tm', 'tn', 'to', 'tr', 'tt', 'tv',
    'tw', 'tz', 'ua', 'ug', 'uk', 'unsorted', 'us', 'uy', 'uz', 've', 'vg',
    'vi', 'vn', 'vu', 'ws', 'xk', 'ye', 'za', 'zm', 'zw'
];

const LANGUAGES = [
    'ara', 'ben', 'chi', 'deu', 'eng', 'fas', 'fra', 'hin', 'ind', 'ita',
    'jpn', 'kor', 'msa', 'nld', 'pol', 'por', 'rus', 'spa', 'tha', 'tur',
    'ukr', 'urd', 'vie'
];

function parseM3U(content, sourceCountry = null) {
    const lines = content.split('\n');
    const channels = [];
    let currentChannel = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('#EXTINF:')) {
            const attrs = {};

            const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
            const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
            const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
            const groupMatch = line.match(/group-title="([^"]*)"/);
            const tvgCountryMatch = line.match(/tvg-country="([^"]*)"/);
            const tvgLanguageMatch = line.match(/tvg-language="([^"]*)"/);

            const nameMatch = line.match(/,(.+)$/);

            currentChannel = {
                epgId: tvgIdMatch ? tvgIdMatch[1] : null,
                name: tvgNameMatch ? tvgNameMatch[1] : (nameMatch ? nameMatch[1].trim() : 'Unknown'),
                logo: tvgLogoMatch ? tvgLogoMatch[1] : null,
                category: groupMatch ? groupMatch[1] : 'General',
                country: tvgCountryMatch ? tvgCountryMatch[1].toUpperCase() : (sourceCountry ? sourceCountry.toUpperCase() : 'INT'),
                language: tvgLanguageMatch ? tvgLanguageMatch[1].toLowerCase() : 'en',
                description: nameMatch ? nameMatch[1].trim() : ''
            };
        } else if ((line.startsWith('http://') || line.startsWith('https://')) && currentChannel) {
            const streamInfo = detectStreamInfo(line);
            currentChannel.streamUrl = line;
            currentChannel.streamType = streamInfo.streamType;
            currentChannel.fileExt = streamInfo.fileExt;
            channels.push(currentChannel);
            currentChannel = null;
        }
    }

    return channels;
}

async function importFromUrl(url, options = {}) {
    const { country = null, category = null, batchSize = 100 } = options;

    try {
        const response = await axios.get(url, {
            timeout: 60000,
            headers: { 'User-Agent': 'Mozilla/5.0 IPTV-Importer/1.0' }
        });

        const channels = parseM3U(response.data, country);

        let imported = 0;
        let skipped = 0;

        for (let i = 0; i < channels.length; i += batchSize) {
            const batch = channels.slice(i, i + batchSize);

            const channelData = batch.map(channel => ({
                name: (channel.name || 'Unknown').substring(0, 255),
                description: (channel.description || channel.name || '').substring(0, 255),
                logo: channel.logo || null,
                streamUrl: channel.streamUrl,
                streamType: channel.streamType,
                fileExt: channel.fileExt || null,
                category: category || channel.category || 'General',
                country: country?.toUpperCase() || channel.country || 'INT',
                language: channel.language || 'en',
                epgId: channel.epgId,
                isActive: true,
                isLive: true
            }));

            try {
                const result = await prisma.channel.createMany({
                    data: channelData,
                    skipDuplicates: true
                });
                imported += result.count;
                skipped += batch.length - result.count;
            } catch (e) {
                skipped += batch.length;
            }
        }

        return { total: channels.length, imported, skipped };
    } catch (error) {
        return { total: 0, imported: 0, skipped: 0, error: error.message };
    }
}

async function importAllCountries() {
    console.log('🌍 Importing channels from all countries...\n');

    let totalImported = 0;
    let totalChannels = 0;

    for (let i = 0; i < COUNTRIES.length; i++) {
        const country = COUNTRIES[i];
        const url = `${IPTV_ORG_BASE}/countries/${country}.m3u`;

        process.stdout.write(`\r[${i + 1}/${COUNTRIES.length}] Importing ${country.toUpperCase()}...`);

        const result = await importFromUrl(url, { country });
        totalImported += result.imported;
        totalChannels += result.total;
    }

    console.log(`\n\n✅ Countries import complete!`);
    console.log(`   Total channels found: ${totalChannels}`);
    console.log(`   New channels imported: ${totalImported}`);

    return { totalChannels, totalImported };
}

async function importAllCategories() {
    console.log('📁 Importing channels from all categories...\n');

    let totalImported = 0;
    let totalChannels = 0;

    for (let i = 0; i < CATEGORIES.length; i++) {
        const category = CATEGORIES[i];
        const url = `${IPTV_ORG_BASE}/categories/${category}.m3u`;

        process.stdout.write(`\r[${i + 1}/${CATEGORIES.length}] Importing ${category}...`);

        const result = await importFromUrl(url, { category });
        totalImported += result.imported;
        totalChannels += result.total;
    }

    console.log(`\n\n✅ Categories import complete!`);
    console.log(`   Total channels found: ${totalChannels}`);
    console.log(`   New channels imported: ${totalImported}`);

    return { totalChannels, totalImported };
}

async function importAllLanguages() {
    console.log('🗣️ Importing channels from all languages...\n');

    let totalImported = 0;
    let totalChannels = 0;

    for (let i = 0; i < LANGUAGES.length; i++) {
        const lang = LANGUAGES[i];
        const url = `${IPTV_ORG_BASE}/languages/${lang}.m3u`;

        process.stdout.write(`\r[${i + 1}/${LANGUAGES.length}] Importing ${lang}...`);

        const result = await importFromUrl(url, {});
        totalImported += result.imported;
        totalChannels += result.total;
    }

    console.log(`\n\n✅ Languages import complete!`);
    console.log(`   Total channels found: ${totalChannels}`);
    console.log(`   New channels imported: ${totalImported}`);

    return { totalChannels, totalImported };
}

async function importMainPlaylist() {
    console.log('📺 Importing main playlist (all channels)...\n');

    const result = await importFromUrl(MAIN_PLAYLISTS.all);

    console.log(`✅ Main playlist import complete!`);
    console.log(`   Total channels found: ${result.total}`);
    console.log(`   New channels imported: ${result.imported}`);

    return result;
}

async function importEverything() {
    console.log('🚀 FULL IMPORT: All iptv-org channels\n');
    console.log('This will import from:');
    console.log(`  - Main playlist`);
    console.log(`  - ${COUNTRIES.length} countries`);
    console.log(`  - ${CATEGORIES.length} categories`);
    console.log(`  - ${LANGUAGES.length} languages\n`);

    const startTime = Date.now();

    await importMainPlaylist();
    console.log('\n');

    await importAllCountries();
    console.log('\n');

    await importAllCategories();
    console.log('\n');

    await importAllLanguages();

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

    const totalCount = await prisma.channel.count();

    console.log('\n═══════════════════════════════════════');
    console.log('🎉 FULL IMPORT COMPLETE!');
    console.log(`   Total channels in database: ${totalCount}`);
    console.log(`   Time elapsed: ${elapsed} minutes`);
    console.log('═══════════════════════════════════════');
}

async function getStats() {
    const total = await prisma.channel.count();
    const active = await prisma.channel.count({ where: { isActive: true } });

    const byCategory = await prisma.channel.groupBy({
        by: ['category'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20
    });

    const byCountry = await prisma.channel.groupBy({
        by: ['country'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20
    });

    console.log('📊 Channel Statistics\n');
    console.log(`Total channels: ${total}`);
    console.log(`Active channels: ${active}\n`);

    console.log('Top Categories:');
    byCategory.forEach(c => console.log(`  ${c.category}: ${c._count.id}`));

    console.log('\nTop Countries:');
    byCountry.forEach(c => console.log(`  ${c.country || 'Unknown'}: ${c._count.id}`));
}

const args = process.argv.slice(2);
const command = args[0];

async function main() {
    console.log('🎬 IPTV-ORG Channel Importer\n');

    try {
        switch (command) {
            case 'all':
                await importEverything();
                break;
            case 'main':
                await importMainPlaylist();
                break;
            case 'countries':
                await importAllCountries();
                break;
            case 'categories':
                await importAllCategories();
                break;
            case 'languages':
                await importAllLanguages();
                break;
            case 'country':
                const country = args[1];
                if (!country) {
                    console.log('Usage: node import-iptv-org.js country <code>');
                    console.log('Example: node import-iptv-org.js country us');
                    break;
                }
                const result = await importFromUrl(`${IPTV_ORG_BASE}/countries/${country}.m3u`, { country });
                console.log(`✅ Imported ${result.imported} channels from ${country.toUpperCase()}`);
                break;
            case 'category':
                const cat = args[1];
                if (!cat) {
                    console.log('Usage: node import-iptv-org.js category <name>');
                    console.log(`Available: ${CATEGORIES.join(', ')}`);
                    break;
                }
                const catResult = await importFromUrl(`${IPTV_ORG_BASE}/categories/${cat}.m3u`, { category: cat });
                console.log(`✅ Imported ${catResult.imported} channels from ${cat}`);
                break;
            case 'stats':
                await getStats();
                break;
            default:
                console.log('IPTV-ORG Importer - Import all free channels\n');
                console.log('Commands:');
                console.log('  all         Import EVERYTHING (main + countries + categories + languages)');
                console.log('  main        Import main playlist only (~10k channels)');
                console.log('  countries   Import all country playlists');
                console.log('  categories  Import all category playlists');
                console.log('  languages   Import all language playlists');
                console.log('  country     Import specific country (e.g., country us)');
                console.log('  category    Import specific category (e.g., category news)');
                console.log('  stats       Show database statistics');
                console.log('\nExamples:');
                console.log('  node import-iptv-org.js all');
                console.log('  node import-iptv-org.js country us');
                console.log('  node import-iptv-org.js category sports');
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
