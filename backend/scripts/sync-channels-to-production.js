#!/usr/bin/env node
/**
 * Sync local channels to production database
 * Usage: PROD_DATABASE_URL="..." node scripts/sync-channels-to-production.js
 */

const { PrismaClient } = require('@prisma/client');

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
  console.log('Syncing local channels to production database');
  console.log('='.repeat(60));

  // Get local channels
  const localChannels = await localPrisma.channel.findMany({
    where: { isActive: true }
  });

  console.log(`Found ${localChannels.length} local active channels\n`);

  let synced = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  const batchSize = 100;
  for (let i = 0; i < localChannels.length; i += batchSize) {
    const batch = localChannels.slice(i, i + batchSize);
    
    for (const channel of batch) {
      try {
        // Check if already exists in production by streamUrl
        const existing = await prodPrisma.channel.findFirst({
          where: { streamUrl: channel.streamUrl }
        });

        if (existing) {
          // Update if local has newer data
          const updates = {};
          if (channel.name && channel.name !== existing.name) updates.name = channel.name;
          if (channel.logo && !existing.logo) updates.logo = channel.logo;
          if (channel.category && channel.category !== existing.category) updates.category = channel.category;
          if (channel.country && channel.country !== existing.country) updates.country = channel.country;
          if (channel.language && !existing.language) updates.language = channel.language;
          if (channel.sortOrder !== existing.sortOrder) updates.sortOrder = channel.sortOrder;

          if (Object.keys(updates).length > 0) {
            await prodPrisma.channel.update({
              where: { id: existing.id },
              data: updates
            });
            updated++;
          } else {
            skipped++;
          }
          continue;
        }

        // Create in production (generate new ID)
        const { id, createdAt, updatedAt, ...channelData } = channel;
        await prodPrisma.channel.create({
          data: channelData
        });

        synced++;
      } catch (error) {
        failed++;
        if (failed <= 10) {
          console.log(`❌ Failed: ${channel.name} - ${error.message}`);
        }
      }
    }
    
    console.log(`Progress: ${Math.min(i + batchSize, localChannels.length)}/${localChannels.length} (New: ${synced}, Updated: ${updated}, Skipped: ${skipped})`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('SYNC COMPLETE!');
  console.log('='.repeat(60));
  console.log(`New channels synced: ${synced}`);
  console.log(`Channels updated: ${updated}`);
  console.log(`Channels skipped (no changes): ${skipped}`);
  console.log(`Failed: ${failed}`);

  // Also sync channel access to plans
  console.log('\nSyncing channel access to plans...');
  
  // Get the Premium Plan from production
  const premiumPlan = await prodPrisma.plan.findFirst({
    where: { name: 'Premium Plan' }
  });

  if (premiumPlan) {
    // Get all production channels
    const prodChannels = await prodPrisma.channel.findMany({
      where: { isActive: true },
      select: { id: true }
    });

    // Get existing access
    const existingAccess = await prodPrisma.channelAccess.findMany({
      where: { planId: premiumPlan.id },
      select: { channelId: true }
    });

    const existingIds = new Set(existingAccess.map(a => a.channelId));
    const toAdd = prodChannels.filter(c => !existingIds.has(c.id));

    if (toAdd.length > 0) {
      console.log(`Adding ${toAdd.length} channels to Premium Plan...`);
      
      for (let i = 0; i < toAdd.length; i += 500) {
        const batch = toAdd.slice(i, i + 500);
        await prodPrisma.channelAccess.createMany({
          data: batch.map(c => ({
            channelId: c.id,
            planId: premiumPlan.id
          })),
          skipDuplicates: true
        });
      }
      console.log(`✅ Added ${toAdd.length} channels to Premium Plan`);
    } else {
      console.log('All channels already have plan access');
    }
  }
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
