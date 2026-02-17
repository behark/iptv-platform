#!/usr/bin/env node
/**
 * Sync local channels to production database
 * Uses batch operations for speed. Matches by streamUrl.
 * Also syncs channel access to Premium Plan.
 *
 * Usage: node scripts/sync-channels-to-production.js
 *   (reads PRODUCTION_DATABASE_URL from .env)
 */

const { PrismaClient } = require('@prisma/client');

const PROD_URL = process.env.PRODUCTION_DATABASE_URL || process.env.PROD_DATABASE_URL;

if (!PROD_URL) {
  console.error('Error: PRODUCTION_DATABASE_URL environment variable is required');
  process.exit(1);
}

const localPrisma = new PrismaClient();
const prodPrisma = new PrismaClient({
  datasources: { db: { url: PROD_URL } }
});

async function main() {
  console.log('='.repeat(60));
  console.log('Syncing local channels to production database');
  console.log('='.repeat(60));

  // Fetch everything upfront
  const localChannels = await localPrisma.channel.findMany({
    where: { isActive: true }
  });
  console.log(`Local active channels: ${localChannels.length}`);

  const prodChannels = await prodPrisma.channel.findMany({
    select: { id: true, streamUrl: true }
  });
  console.log(`Production channels: ${prodChannels.length}`);

  // Build production lookup by streamUrl
  const prodByUrl = new Map();
  for (const ch of prodChannels) {
    prodByUrl.set(ch.streamUrl, ch.id);
  }

  const toUpdate = [];
  const toInsert = [];

  for (const channel of localChannels) {
    const prodId = prodByUrl.get(channel.streamUrl);
    if (prodId) {
      toUpdate.push({ prodId, channel });
    } else {
      toInsert.push(channel);
    }
  }

  console.log(`\nTo update: ${toUpdate.length}`);
  console.log(`To insert: ${toInsert.length}`);

  // Batch updates
  const batchSize = 200;
  let processed = 0;
  let failed = 0;

  console.log('\n--- Updating existing channels ---');
  for (let i = 0; i < toUpdate.length; i += batchSize) {
    const batch = toUpdate.slice(i, i + batchSize);
    const ops = batch.map(({ prodId, channel }) =>
      prodPrisma.channel.update({
        where: { id: prodId },
        data: {
          name: channel.name,
          description: channel.description,
          logo: channel.logo,
          streamType: channel.streamType,
          fileExt: channel.fileExt,
          category: channel.category,
          language: channel.language,
          country: channel.country,
          isLive: channel.isLive,
          isActive: channel.isActive,
          epgId: channel.epgId,
          sortOrder: channel.sortOrder,
        }
      })
    );
    try {
      await prodPrisma.$transaction(ops);
    } catch (err) {
      // Fallback: try individually
      for (const op of ops) {
        try { await op; } catch (e) { failed++; }
      }
    }
    processed += batch.length;
    if (processed % 2000 === 0 || processed === toUpdate.length) {
      console.log(`  Updated ${processed}/${toUpdate.length}`);
    }
  }

  console.log('\n--- Inserting new channels ---');
  processed = 0;
  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize);
    const ops = batch.map(ch =>
      prodPrisma.channel.create({
        data: {
          name: ch.name,
          description: ch.description,
          logo: ch.logo,
          streamUrl: ch.streamUrl,
          streamType: ch.streamType,
          fileExt: ch.fileExt,
          category: ch.category,
          language: ch.language,
          country: ch.country,
          isLive: ch.isLive,
          isActive: ch.isActive,
          epgId: ch.epgId,
          sortOrder: ch.sortOrder,
        }
      })
    );
    try {
      await prodPrisma.$transaction(ops);
    } catch (err) {
      // Fallback: try individually (some may have duplicate streamUrls)
      for (const op of ops) {
        try { await op; } catch (e) { failed++; }
      }
    }
    processed += batch.length;
    if (processed % 2000 === 0 || processed === toInsert.length) {
      console.log(`  Inserted ${processed}/${toInsert.length}`);
    }
  }

  if (failed > 0) console.log(`\n  (${failed} individual operations failed)`);

  // Sync channel access to Premium Plan
  console.log('\n--- Syncing channel access to Premium Plan ---');
  const premiumPlan = await prodPrisma.plan.findFirst({
    where: { name: 'Premium Plan' }
  });

  if (premiumPlan) {
    const allProdActive = await prodPrisma.channel.findMany({
      where: { isActive: true },
      select: { id: true }
    });

    const existingAccess = await prodPrisma.channelAccess.findMany({
      where: { planId: premiumPlan.id },
      select: { channelId: true }
    });
    const existingIds = new Set(existingAccess.map(a => a.channelId));
    const toAdd = allProdActive.filter(c => !existingIds.has(c.id));

    if (toAdd.length > 0) {
      for (let i = 0; i < toAdd.length; i += 500) {
        const batch = toAdd.slice(i, i + 500);
        await prodPrisma.channelAccess.createMany({
          data: batch.map(c => ({ channelId: c.id, planId: premiumPlan.id })),
          skipDuplicates: true
        });
      }
      console.log(`  Added ${toAdd.length} channels to Premium Plan`);
    } else {
      console.log('  All channels already have plan access');
    }
  } else {
    console.log('  No Premium Plan found, skipping access sync');
  }

  // Final counts
  const finalTotal = await prodPrisma.channel.count();
  const finalActive = await prodPrisma.channel.count({ where: { isActive: true } });
  console.log('\n' + '='.repeat(60));
  console.log('SYNC COMPLETE!');
  console.log('='.repeat(60));
  console.log(`Production total channels: ${finalTotal}`);
  console.log(`Production active channels: ${finalActive}`);
}

main()
  .catch(error => {
    console.error('Sync failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await localPrisma.$disconnect();
    await prodPrisma.$disconnect();
  });
