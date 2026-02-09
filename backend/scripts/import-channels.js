#!/usr/bin/env node

const {
    importFromUrl,
    importFromFile,
    importByCategory,
    importByCountry,
    importByLanguage,
    importAllCategories,
    importPopularCountries,
    importBalkanChannels,
    importFromLocalPlaylist,
    getStats,
    cleanupDeadChannels,
    CATEGORY_SOURCES,
    COUNTRY_SOURCES,
    LANGUAGE_SOURCES,
    BALKAN_COUNTRIES,
    BALKAN_LANGUAGES
} = require('../src/services/channelImporter');

const args = process.argv.slice(2);
const command = args[0];

async function main() {
    console.log('🎬 IPTV Channel Importer\n');

    try {
        switch (command) {
            case 'all':
                console.log('📥 Importing ALL channels from iptv-org...');
                console.log('This may take several minutes.\n');
                const allResult = await importFromUrl('https://iptv-org.github.io/iptv/index.m3u');
                console.log('\n✅ Import complete!');
                console.log(`   Total: ${allResult.total}`);
                console.log(`   Imported: ${allResult.imported}`);
                console.log(`   Failed: ${allResult.failed}`);
                break;

            case 'category':
                const category = args[1];
                if (!category) {
                    console.log('Available categories:');
                    Object.keys(CATEGORY_SOURCES).forEach(c => console.log(`  - ${c}`));
                    console.log('\nUsage: node import-channels.js category <name>');
                    break;
                }
                console.log(`📁 Importing category: ${category}`);
                const catResult = await importByCategory(category);
                console.log(`\n✅ Imported ${catResult.imported} channels`);
                break;

            case 'country':
                const country = args[1];
                if (!country) {
                    console.log('Available countries:');
                    Object.keys(COUNTRY_SOURCES).forEach(c => console.log(`  - ${c.toUpperCase()}`));
                    console.log('\nUsage: node import-channels.js country <code>');
                    break;
                }
                console.log(`🌍 Importing country: ${country.toUpperCase()}`);
                const countryResult = await importByCountry(country);
                console.log(`\n✅ Imported ${countryResult.imported} channels`);
                break;

            case 'categories':
                console.log('📁 Importing all categories...\n');
                const catsResult = await importAllCategories();
                console.log('\n✅ All categories imported!');
                Object.entries(catsResult).forEach(([cat, res]) => {
                    if (res.error) {
                        console.log(`  ${cat}: ❌ ${res.error}`);
                    } else {
                        console.log(`  ${cat}: ${res.imported} channels`);
                    }
                });
                break;

            case 'popular':
                console.log('🌍 Importing popular countries (US, UK, DE, FR, ES, IN, BR)...\n');
                const popResult = await importPopularCountries();
                console.log('\n✅ Popular countries imported!');
                Object.entries(popResult).forEach(([country, res]) => {
                    if (res.error) {
                        console.log(`  ${country.toUpperCase()}: ❌ ${res.error}`);
                    } else {
                        console.log(`  ${country.toUpperCase()}: ${res.imported} channels`);
                    }
                });
                break;

            case 'stats':
                console.log('📊 Channel Statistics\n');
                const stats = await getStats();
                console.log(`Total channels: ${stats.total}`);
                console.log(`Active channels: ${stats.active}\n`);
                console.log('By Category:');
                stats.byCategory.slice(0, 15).forEach(c => {
                    console.log(`  ${c.category}: ${c.count}`);
                });
                console.log('\nTop Countries:');
                stats.byCountry.slice(0, 15).forEach(c => {
                    console.log(`  ${c.country || 'Unknown'}: ${c.count}`);
                });
                break;

            case 'cleanup':
                const dryRun = args[1] !== '--force';
                if (dryRun) {
                    console.log('🔍 Running cleanup in DRY RUN mode (use --force to apply changes)\n');
                } else {
                    console.log('🔍 Running cleanup (will mark dead channels as inactive)\n');
                }
                const deadChannels = await cleanupDeadChannels(dryRun);
                console.log(`\nFound ${deadChannels.length} dead channels`);
                if (dryRun && deadChannels.length > 0) {
                    console.log('Run with --force to mark them as inactive');
                }
                break;

            case 'url':
                const url = args[1];
                if (!url) {
                    console.log('Usage: node import-channels.js url <m3u-url>');
                    break;
                }
                console.log(`📥 Importing from custom URL: ${url}\n`);
                const urlResult = await importFromUrl(url);
                console.log(`\n✅ Imported ${urlResult.imported} channels`);
                break;

            case 'file':
                const file = args[1];
                if (!file) {
                    console.log('Usage: node import-channels.js file <path-to-m3u-file>');
                    break;
                }
                console.log(`📥 Importing from local file: ${file}\n`);
                const fileResult = await importFromFile(file);
                console.log(`\n✅ Imported ${fileResult.imported} channels`);
                break;

            case 'balkan':
                console.log('🌍 Importing ALL Balkan channels (countries + languages)...\n');
                const balkanResult = await importBalkanChannels();
                console.log('\n✅ Balkan import complete!');
                break;

            case 'gjirafa':
                console.log('🇽🇰🇦🇱 Importing Gjirafa Video channels (Kosovo/Albania)...\n');
                console.log('Run: node backend/scripts/import-gjirafa.js');
                console.log('  --tv-only    Only TV channels');
                console.log('  --radio-only Only radio stations');
                console.log('  --verify     Check stream availability');
                console.log('  --dry-run    Preview without writing');
                require('./import-gjirafa');
                return;

            case 'language':
                const lang = args[1];
                if (!lang) {
                    console.log('Available languages:');
                    Object.keys(LANGUAGE_SOURCES).forEach(l => console.log(`  - ${l}`));
                    console.log('\nUsage: node import-channels.js language <code>');
                    break;
                }
                console.log(`🗣️ Importing language: ${lang}`);
                const langResult = await importByLanguage(lang);
                console.log(`\n✅ Imported ${langResult.imported} channels`);
                break;

            case 'quick':
                console.log('⚡ Quick import: News + Sports + Entertainment + Movies\n');
                const quickCategories = ['news', 'sports', 'entertainment', 'movies'];
                for (const cat of quickCategories) {
                    console.log(`\n📁 Importing ${cat}...`);
                    try {
                        const result = await importByCategory(cat);
                        console.log(`   ✅ ${result.imported} channels`);
                    } catch (error) {
                        console.log(`   ❌ Failed: ${error.message}`);
                    }
                }
                console.log('\n✅ Quick import complete!');
                break;

            default:
                console.log('IPTV Channel Importer - Import free channels from iptv-org\n');
                console.log('Commands:');
                console.log('  all          Import ALL channels (~8,000+)');
                console.log('  quick        Quick import (news, sports, entertainment, movies)');
                console.log('  balkan       Import ALL Balkan countries + languages');
                console.log('  gjirafa      Import Gjirafa Video channels (Kosovo/Albania)');
                console.log('  category     Import specific category');
                console.log('  categories   Import all categories');
                console.log('  country      Import specific country');
                console.log('  language     Import specific language (sqi, srp, bos, hrv...)');
                console.log('  popular      Import popular countries');
                console.log('  url <url>    Import from custom M3U URL');
                console.log('  file <path>  Import from local M3U file');
                console.log('  stats        Show channel statistics');
                console.log('  cleanup      Check for dead channels');
                console.log('\nExamples:');
                console.log('  node import-channels.js quick');
                console.log('  node import-channels.js balkan');
                console.log('  node import-channels.js language sqi');
                console.log('  node import-channels.js category news');
                console.log('  node import-channels.js country al');
                console.log('  node import-channels.js file iptv/streams/us.m3u');
                console.log('  node import-channels.js all');
                break;
        }
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }

    process.exit(0);
}

main();
