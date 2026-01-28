#!/usr/bin/env node

/**
 * YouTube Import CLI
 * Import YouTube videos with Albanian captions
 *
 * Usage:
 *   node scripts/import-youtube.js albanian      # Import Albanian content
 *   node scripts/import-youtube.js movies        # Import movies with Albanian subs
 *   node scripts/import-youtube.js search <query> # Search and import
 *   node scripts/import-youtube.js id <videoId>  # Import specific video
 *   node scripts/import-youtube.js stats         # Show statistics
 */

require('dotenv').config();
const youtubeImporter = require('../src/services/youtubeImporter');

const HELP = `
╔════════════════════════════════════════════════════════════╗
║        YouTube Import CLI - Albanian Subtitles             ║
╠════════════════════════════════════════════════════════════╣
║  Commands:                                                  ║
║    albanian [limit]    Import Albanian content with caps    ║
║    movies [limit]      Import movies with Albanian subs     ║
║    search <query>      Search and import videos             ║
║    id <videoId>        Import specific YouTube video        ║
║    stats               Show YouTube VOD statistics          ║
╠════════════════════════════════════════════════════════════╣
║  Options:                                                   ║
║    --limit <n>         Limit number of imports              ║
║    --force             Re-import existing videos            ║
╠════════════════════════════════════════════════════════════╣
║  Examples:                                                  ║
║    node scripts/import-youtube.js albanian 20               ║
║    node scripts/import-youtube.js movies --limit 30         ║
║    node scripts/import-youtube.js search "godfather shqip"  ║
║    node scripts/import-youtube.js id dQw4w9WgXcQ            ║
╠════════════════════════════════════════════════════════════╣
║  Environment Variables Required:                            ║
║    YOUTUBE_API_KEY - Get from Google Cloud Console          ║
║    https://console.cloud.google.com/apis/credentials        ║
╠════════════════════════════════════════════════════════════╣
║  Note: Only imports videos with closed captions enabled.    ║
║        YouTube handles subtitle display in their player.    ║
╚════════════════════════════════════════════════════════════╝
`;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Parse options
  const options = {
    skipExisting: !args.includes('--force')
  };

  // Parse limit
  const limitIndex = args.indexOf('--limit');
  let limit = limitIndex > -1 ? parseInt(args[limitIndex + 1]) : null;

  if (!limit && args[1] && /^\d+$/.test(args[1])) {
    limit = parseInt(args[1]);
  }

  // Check environment
  if (!process.env.YOUTUBE_API_KEY && command !== 'help' && command !== '--help') {
    console.log('\n⚠️  YOUTUBE_API_KEY not configured!\n');
    console.log('To get a free API key:');
    console.log('1. Go to https://console.cloud.google.com/apis/credentials');
    console.log('2. Create a project (or select existing)');
    console.log('3. Enable "YouTube Data API v3"');
    console.log('4. Create credentials > API Key');
    console.log('5. Add to .env: YOUTUBE_API_KEY=your_key_here\n');

    if (command && command !== 'stats') {
      process.exit(1);
    }
  }

  try {
    switch (command) {
      case 'albanian':
        await youtubeImporter.importAlbanianContent({
          ...options,
          limit: limit || 20
        });
        break;

      case 'movies':
        await youtubeImporter.importMoviesWithAlbanianSubs({
          ...options,
          limit: limit || 20
        });
        break;

      case 'search':
        const query = args[1];
        if (!query || query.startsWith('--')) {
          console.error('Error: Search query required');
          console.log('Usage: node scripts/import-youtube.js search "query"');
          process.exit(1);
        }
        await youtubeImporter.importBySearch(query, {
          ...options,
          limit: limit || 20
        });
        break;

      case 'id':
        const videoId = args[1];
        if (!videoId || videoId.startsWith('--')) {
          console.error('Error: YouTube video ID required');
          console.log('Usage: node scripts/import-youtube.js id VIDEO_ID');
          process.exit(1);
        }
        await youtubeImporter.importById(videoId, options);
        break;

      case 'stats':
        await showStats();
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

async function showStats() {
  console.log('\n📊 YouTube VOD Statistics\n');

  const stats = await youtubeImporter.getStats();

  console.log('┌────────────────────────────────────┐');
  console.log('│           YouTube VOD              │');
  console.log('├────────────────────────────────────┤');
  console.log(`│  Total Videos:        ${String(stats.total).padStart(10)} │`);
  console.log('├────────────────────────────────────┤');
  console.log('│  By Category:                      │');

  if (Object.keys(stats.byCategory).length === 0) {
    console.log('│    (no videos imported yet)        │');
  } else {
    Object.entries(stats.byCategory)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, count]) => {
        const label = (cat || 'Uncategorized').padEnd(20);
        console.log(`│    ${label} ${String(count).padStart(6)} │`);
      });
  }

  console.log('└────────────────────────────────────┘\n');
}

main();
