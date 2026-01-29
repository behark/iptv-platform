#!/usr/bin/env node
/**
 * Sync local videos to production database
 * Usage: PROD_DATABASE_URL="..." node scripts/sync-to-production.js
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const PROD_URL = process.env.PROD_DATABASE_URL;

if (!PROD_URL) {
  console.error('Error: PROD_DATABASE_URL environment variable is required');
  process.exit(1);
}

const localPrisma = new PrismaClient();
const prodPrisma = new PrismaClient({
  datasources: { db: { url: PROD_URL } }
});

async function main() {
  console.log('='.repeat(60));
  console.log('Syncing local videos to production database');
  console.log('='.repeat(60));

  // Get local archive videos
  const localVideos = await localPrisma.video.findMany({
    where: { sourceType: 'archive' }
  });

  console.log(`Found ${localVideos.length} local archive videos\n`);

  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const video of localVideos) {
    try {
      // Check if already exists in production
      const existing = await prodPrisma.video.findFirst({
        where: { sourceType: 'archive', sourceId: video.sourceId }
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Create in production (generate new ID)
      const { id, createdAt, updatedAt, ...videoData } = video;
      await prodPrisma.video.create({
        data: videoData
      });

      synced++;
      console.log(`✅ Synced: ${video.title}`);
    } catch (error) {
      failed++;
      console.log(`❌ Failed: ${video.title} - ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Sync Complete!');
  console.log('='.repeat(60));
  console.log(`✅ Synced:  ${synced}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Failed:  ${failed}`);

  await localPrisma.$disconnect();
  await prodPrisma.$disconnect();
}

main().catch(console.error);
