#!/usr/bin/env node

/**
 * Fetch Subtitles for Existing Movies
 * Searches and downloads Albanian subtitles for movies already in the database
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const subtitleService = require('../src/services/subtitleService');

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(60));
  console.log('Fetching Albanian Subtitles for Existing Movies');
  console.log('='.repeat(60));

  // Get all movies without subtitles
  const movies = await prisma.video.findMany({
    where: {
      sourceType: 'archive',
      hasSubtitles: false
    },
    orderBy: { title: 'asc' }
  });

  console.log(`Found ${movies.length} movies without subtitles\n`);

  let found = 0;
  let notFound = 0;
  let errors = 0;

  for (let i = 0; i < movies.length; i++) {
    const movie = movies[i];
    console.log(`[${i + 1}/${movies.length}] ${movie.title}`);

    try {
      const result = await subtitleService.getSubtitleForMovie({
        title: movie.title,
        year: movie.year,
        id: movie.sourceId || movie.id
      });

      if (result) {
        // Update movie with subtitle info
        await prisma.video.update({
          where: { id: movie.id },
          data: {
            hasSubtitles: true,
            subtitleUrl: `/api/videos/${movie.sourceId || movie.id}/subtitle`,
            subtitleLanguage: 'sq'
          }
        });
        console.log(`  ✅ Subtitle downloaded`);
        found++;
      } else {
        console.log(`  ⚠️  No Albanian subtitle found`);
        notFound++;
      }

      // Rate limiting - 3 seconds between requests to avoid 503 errors
      await new Promise(resolve => setTimeout(resolve, 3000));

    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Complete');
  console.log('='.repeat(60));
  console.log(`  Found & downloaded: ${found}`);
  console.log(`  Not found:          ${notFound}`);
  console.log(`  Errors:             ${errors}`);
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

main().catch(console.error);
