#!/usr/bin/env node

/**
 * Comprehensive Channel Import Script
 * Imports channels from multiple sources including iptv-org and regional playlists
 */

const {
  importFromUrl,
  importByCountry,
  getStats,
  COUNTRY_SOURCES
} = require('../src/services/channelImporter');

const ADDITIONAL_SOURCES = [
  // iptv-org main indexes
  {
    name: 'IPTV-org All Channels',
    url: 'https://iptv-org.github.io/iptv/index.m3u',
    priority: 1
  },
  {
    name: 'IPTV-org By Country',
    url: 'https://iptv-org.github.io/iptv/index.country.m3u',
    priority: 2
  },
  {
    name: 'IPTV-org By Category',
    url: 'https://iptv-org.github.io/iptv/index.category.m3u',
    priority: 3
  },

  // Balkan Region Priority
  {
    name: 'Kosovo Channels',
    url: 'https://iptv-org.github.io/iptv/countries/xk.m3u',
    priority: 10
  },
  {
    name: 'Albania Channels',
    url: 'https://iptv-org.github.io/iptv/countries/al.m3u',
    priority: 11
  },
  {
    name: 'North Macedonia Channels',
    url: 'https://iptv-org.github.io/iptv/countries/mk.m3u',
    priority: 12
  },
  {
    name: 'Montenegro Channels',
    url: 'https://iptv-org.github.io/iptv/countries/me.m3u',
    priority: 13
  },
  {
    name: 'Serbia Channels',
    url: 'https://iptv-org.github.io/iptv/countries/rs.m3u',
    priority: 14
  },
  {
    name: 'Bosnia Channels',
    url: 'https://iptv-org.github.io/iptv/countries/ba.m3u',
    priority: 15
  },
  {
    name: 'Croatia Channels',
    url: 'https://iptv-org.github.io/iptv/countries/hr.m3u',
    priority: 16
  },
  {
    name: 'Slovenia Channels',
    url: 'https://iptv-org.github.io/iptv/countries/si.m3u',
    priority: 17
  },
  {
    name: 'Greece Channels',
    url: 'https://iptv-org.github.io/iptv/countries/gr.m3u',
    priority: 18
  },
  {
    name: 'Bulgaria Channels',
    url: 'https://iptv-org.github.io/iptv/countries/bg.m3u',
    priority: 19
  },
  {
    name: 'Romania Channels',
    url: 'https://iptv-org.github.io/iptv/countries/ro.m3u',
    priority: 20
  },
  {
    name: 'Turkey Channels',
    url: 'https://iptv-org.github.io/iptv/countries/tr.m3u',
    priority: 21
  },

  // Major Countries
  {
    name: 'USA Channels',
    url: 'https://iptv-org.github.io/iptv/countries/us.m3u',
    priority: 30
  },
  {
    name: 'UK Channels',
    url: 'https://iptv-org.github.io/iptv/countries/uk.m3u',
    priority: 31
  },
  {
    name: 'Germany Channels',
    url: 'https://iptv-org.github.io/iptv/countries/de.m3u',
    priority: 32
  },
  {
    name: 'France Channels',
    url: 'https://iptv-org.github.io/iptv/countries/fr.m3u',
    priority: 33
  },
  {
    name: 'Italy Channels',
    url: 'https://iptv-org.github.io/iptv/countries/it.m3u',
    priority: 34
  },
  {
    name: 'Spain Channels',
    url: 'https://iptv-org.github.io/iptv/countries/es.m3u',
    priority: 35
  },

  // Categories
  {
    name: 'News Channels',
    url: 'https://iptv-org.github.io/iptv/categories/news.m3u',
    priority: 50
  },
  {
    name: 'Sports Channels',
    url: 'https://iptv-org.github.io/iptv/categories/sports.m3u',
    priority: 51
  },
  {
    name: 'Entertainment Channels',
    url: 'https://iptv-org.github.io/iptv/categories/entertainment.m3u',
    priority: 52
  },
  {
    name: 'Movies Channels',
    url: 'https://iptv-org.github.io/iptv/categories/movies.m3u',
    priority: 53
  },
  {
    name: 'Music Channels',
    url: 'https://iptv-org.github.io/iptv/categories/music.m3u',
    priority: 54
  },
  {
    name: 'Kids Channels',
    url: 'https://iptv-org.github.io/iptv/categories/kids.m3u',
    priority: 55
  },
  {
    name: 'Documentary Channels',
    url: 'https://iptv-org.github.io/iptv/categories/documentary.m3u',
    priority: 56
  }
];

const args = process.argv.slice(2);
const command = args[0] || 'all';

async function importAllSources() {
  console.log('🌍 COMPREHENSIVE IPTV CHANNEL IMPORT');
  console.log('='.repeat(60));
  console.log('Importing from multiple sources...\n');

  const results = [];
  let totalImported = 0;
  let totalFailed = 0;

  // Sort by priority
  const sortedSources = [...ADDITIONAL_SOURCES].sort((a, b) => a.priority - b.priority);

  for (const source of sortedSources) {
    console.log(`\n📺 ${source.name}`);
    console.log(`   URL: ${source.url}`);

    try {
      const result = await importFromUrl(source.url);
      results.push({
        name: source.name,
        ...result,
        success: true
      });
      totalImported += result.imported;
      console.log(`   ✅ Imported: ${result.imported} | Skipped: ${result.skipped || 0} | Failed: ${result.failed}`);
    } catch (error) {
      results.push({
        name: source.name,
        error: error.message,
        success: false
      });
      totalFailed++;
      console.log(`   ❌ Error: ${error.message}`);
    }

    // Small delay between sources to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return { results, totalImported, totalFailed };
}

async function importBalkanOnly() {
  console.log('🇽🇰 BALKAN REGION CHANNEL IMPORT');
  console.log('='.repeat(60));

  const balkanSources = ADDITIONAL_SOURCES.filter(s => s.priority >= 10 && s.priority <= 21);
  const results = [];
  let totalImported = 0;

  for (const source of balkanSources) {
    console.log(`\n📺 ${source.name}`);
    try {
      const result = await importFromUrl(source.url);
      results.push({ name: source.name, ...result, success: true });
      totalImported += result.imported;
      console.log(`   ✅ Imported: ${result.imported}`);
    } catch (error) {
      results.push({ name: source.name, error: error.message, success: false });
      console.log(`   ❌ Error: ${error.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return { results, totalImported };
}

async function importMainIndex() {
  console.log('📡 IMPORTING MAIN IPTV-ORG INDEX');
  console.log('='.repeat(60));
  console.log('This will import ALL channels (~10,000+). This may take several minutes.\n');

  try {
    const result = await importFromUrl('https://iptv-org.github.io/iptv/index.m3u');
    console.log(`\n✅ Import complete!`);
    console.log(`   Total: ${result.total}`);
    console.log(`   Imported: ${result.imported}`);
    console.log(`   Failed: ${result.failed}`);
    return result;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    throw error;
  }
}

async function showStats() {
  console.log('📊 CHANNEL STATISTICS');
  console.log('='.repeat(60));

  const stats = await getStats();
  console.log(`\nTotal channels: ${stats.total}`);
  console.log(`Active channels: ${stats.active}\n`);

  console.log('By Category:');
  stats.byCategory.slice(0, 15).forEach(c => {
    console.log(`  ${c.category || 'Uncategorized'}: ${c.count}`);
  });

  console.log('\nTop Countries:');
  stats.byCountry.slice(0, 20).forEach(c => {
    console.log(`  ${c.country || 'Unknown'}: ${c.count}`);
  });
}

async function main() {
  console.log('\n');

  try {
    switch (command) {
      case 'all':
        const allResult = await importAllSources();
        console.log('\n' + '='.repeat(60));
        console.log('IMPORT COMPLETE!');
        console.log('='.repeat(60));
        console.log(`Total sources processed: ${allResult.results.length}`);
        console.log(`Total channels imported: ${allResult.totalImported}`);
        console.log(`Failed sources: ${allResult.totalFailed}`);
        break;

      case 'main':
        await importMainIndex();
        break;

      case 'balkan':
        const balkanResult = await importBalkanOnly();
        console.log('\n' + '='.repeat(60));
        console.log(`Balkan import complete! Total: ${balkanResult.totalImported}`);
        break;

      case 'stats':
        await showStats();
        break;

      default:
        console.log('IPTV Multi-Source Importer\n');
        console.log('Commands:');
        console.log('  all      Import from all sources (comprehensive)');
        console.log('  main     Import from main iptv-org index only');
        console.log('  balkan   Import Balkan region channels only');
        console.log('  stats    Show current channel statistics');
        console.log('\nExamples:');
        console.log('  node import-all-sources.js all');
        console.log('  node import-all-sources.js balkan');
        console.log('  node import-all-sources.js stats');
        break;
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

main();
