#!/usr/bin/env node

/**
 * VOD Import CLI
 * Import movies from Internet Archive with Albanian subtitles
 *
 * Usage:
 *   node scripts/import-vod.js popular       # Import popular public domain movies
 *   node scripts/import-vod.js albanian      # Import Albanian-related content
 *   node scripts/import-vod.js search <query> # Search and import movies
 *   node scripts/import-vod.js id <id>       # Import specific archive.org item
 *   node scripts/import-vod.js stats         # Show import statistics
 *   node scripts/import-vod.js test          # Test import one movie
 */

require('dotenv').config();
const vodImporter = require('../src/services/vodImporter');

const HELP = `
╔════════════════════════════════════════════════════════════╗
║               VOD Import CLI - Albanian Subtitles           ║
╠════════════════════════════════════════════════════════════╣
║  Commands:                                                  ║
║    popular [limit]     Import popular public domain movies  ║
║    albanian [limit]    Import Albanian-related content      ║
║    search <query>      Search and import movies             ║
║    id <identifier>     Import specific archive.org item     ║
║    stats               Show current VOD statistics          ║
║    test                Test import with one movie           ║
╠════════════════════════════════════════════════════════════╣
║  Options:                                                   ║
║    --no-sync           Skip subtitle synchronization        ║
║    --force             Re-import existing movies            ║
║    --limit <n>         Limit number of imports              ║
╠════════════════════════════════════════════════════════════╣
║  Examples:                                                  ║
║    node scripts/import-vod.js popular 10                    ║
║    node scripts/import-vod.js search "horror" --limit 20    ║
║    node scripts/import-vod.js id night_of_the_living_dead   ║
║    node scripts/import-vod.js albanian --no-sync            ║
╠════════════════════════════════════════════════════════════╣
║  Environment Variables Required:                            ║
║    OPENSUBTITLES_API_KEY - Get from opensubtitles.com       ║
║    OPENSUBTITLES_USER    - Your OpenSubtitles username      ║
║    OPENSUBTITLES_PASS    - Your OpenSubtitles password      ║
╚════════════════════════════════════════════════════════════╝
`;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Parse options
  const options = {
    syncSubtitles: !args.includes('--no-sync'),
    skipExisting: !args.includes('--force')
  };

  // Parse limit from args or --limit flag
  const limitIndex = args.indexOf('--limit');
  let limit = limitIndex > -1 ? parseInt(args[limitIndex + 1]) : null;

  // Check for positional limit argument
  if (!limit && args[1] && /^\d+$/.test(args[1])) {
    limit = parseInt(args[1]);
  }

  // Check environment
  checkEnvironment();

  try {
    switch (command) {
      case 'popular':
        await vodImporter.importPopularMovies({
          ...options,
          limit: limit || 20
        });
        break;

      case 'albanian':
        await vodImporter.importAlbanianContent({
          ...options,
          limit: limit || 50
        });
        break;

      case 'search':
        const query = args[1];
        if (!query || query.startsWith('--')) {
          console.error('Error: Search query required');
          console.log('Usage: node scripts/import-vod.js search "query"');
          process.exit(1);
        }
        await vodImporter.importBySearch(query, {
          ...options,
          limit: limit || 20
        });
        break;

      case 'id':
        const identifier = args[1];
        if (!identifier || identifier.startsWith('--')) {
          console.error('Error: Archive.org identifier required');
          console.log('Usage: node scripts/import-vod.js id <identifier>');
          process.exit(1);
        }
        await vodImporter.importById(identifier, options);
        break;

      case 'stats':
        await showStats();
        break;

      case 'test':
        console.log('Testing import with "Night of the Living Dead"...\n');
        await vodImporter.importById('night_of_the_living_dead', {
          ...options,
          skipExisting: false
        });
        break;

      case 'help':
      case '--help':
      case '-h':
        console.log(HELP);
        break;

      default:
        console.log(HELP);
        if (command) {
          console.error(`Unknown command: ${command}\n`);
        }
        process.exit(command ? 1 : 0);
    }
  } catch (error) {
    console.error('\nFatal error:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }

  process.exit(0);
}

function checkEnvironment() {
  const warnings = [];

  if (!process.env.OPENSUBTITLES_API_KEY) {
    warnings.push('OPENSUBTITLES_API_KEY not set - subtitle search will be skipped');
  }

  if (!process.env.OPENSUBTITLES_USER || !process.env.OPENSUBTITLES_PASS) {
    warnings.push('OPENSUBTITLES_USER/PASS not set - subtitle download will fail');
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  Environment Warnings:');
    warnings.forEach(w => console.log(`   - ${w}`));
    console.log('\nGet your API key at: https://www.opensubtitles.com/en/consumers\n');
  }
}

async function showStats() {
  console.log('\n📊 VOD Statistics\n');

  const stats = await vodImporter.getStats();

  console.log('┌────────────────────────────────────┐');
  console.log('│           Archive.org VOD          │');
  console.log('├────────────────────────────────────┤');
  console.log(`│  Total Movies:        ${String(stats.total).padStart(10)} │`);
  console.log(`│  With Subtitles:      ${String(stats.withSubtitles).padStart(10)} │`);
  console.log(`│  Synced Subtitles:    ${String(stats.synced).padStart(10)} │`);
  console.log(`│  Without Subtitles:   ${String(stats.withoutSubtitles).padStart(10)} │`);
  console.log('├────────────────────────────────────┤');
  console.log('│  By Category:                      │');

  Object.entries(stats.byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      const label = (cat || 'Uncategorized').padEnd(20);
      console.log(`│    ${label} ${String(count).padStart(6)} │`);
    });

  console.log('└────────────────────────────────────┘\n');
}

main();
