#!/usr/bin/env node

/**
 * Assign All Channels to Plan
 * 
 * This script assigns all channels (or active channels) to a specific plan
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const prisma = require('../src/lib/prisma');

async function assignAllChannelsToPlan(planName = 'Premium Plan', activeOnly = true) {
  try {
    console.log('🔧 Assigning Channels to Plan...\n');
    console.log('='.repeat(80));

    // Find the plan
    const plan = await prisma.plan.findFirst({
      where: { name: planName },
      include: {
        channelAccess: {
          select: { channelId: true }
        }
      }
    });

    if (!plan) {
      console.error(`❌ Plan "${planName}" not found!`);
      process.exit(1);
    }

    console.log(`Plan: ${plan.name} (ID: ${plan.id})`);
    console.log(`Current channel access: ${plan.channelAccess.length} channels\n`);

    // Get all channels
    const whereClause = activeOnly ? { isActive: true } : {};
    const channels = await prisma.channel.findMany({
      where: whereClause,
      select: { id: true, name: true, isActive: true }
    });

    console.log(`Found ${channels.length} ${activeOnly ? 'active' : ''} channels`);

    // Get existing channel IDs for this plan
    const existingChannelIds = new Set(plan.channelAccess.map(ca => ca.channelId));

    // Filter out channels that are already assigned
    const channelsToAdd = channels.filter(ch => !existingChannelIds.has(ch.id));

    console.log(`Channels already assigned: ${existingChannelIds.size}`);
    console.log(`Channels to add: ${channelsToAdd.length}\n`);

    if (channelsToAdd.length === 0) {
      console.log('✅ All channels are already assigned to this plan!\n');
      await prisma.$disconnect();
      return;
    }

    // Create channel access records in batches
    const batchSize = 1000;
    let added = 0;

    console.log('Adding channels...');

    for (let i = 0; i < channelsToAdd.length; i += batchSize) {
      const batch = channelsToAdd.slice(i, i + batchSize);
      
      await prisma.channelAccess.createMany({
        data: batch.map(channel => ({
          planId: plan.id,
          channelId: channel.id
        })),
        skipDuplicates: true
      });

      added += batch.length;
      process.stdout.write(`\rProgress: ${added}/${channelsToAdd.length} channels added...`);
    }

    console.log('\n');

    // Verify the assignment
    const updatedPlan = await prisma.plan.findUnique({
      where: { id: plan.id },
      include: {
        channelAccess: {
          include: {
            channel: {
              select: {
                name: true,
                isActive: true
              }
            }
          }
        }
      }
    });

    const activeChannels = updatedPlan.channelAccess.filter(ca => ca.channel.isActive).length;
    const totalChannels = updatedPlan.channelAccess.length;

    console.log('='.repeat(80));
    console.log('✅ Assignment Complete!\n');
    console.log(`Plan: ${updatedPlan.name}`);
    console.log(`Total Channels Assigned: ${totalChannels}`);
    console.log(`Active Channels: ${activeChannels}`);
    console.log(`Inactive Channels: ${totalChannels - activeChannels}\n`);

  } catch (error) {
    console.error('❌ Error assigning channels:', error);
    if (error.code === 'P1001') {
      console.error('\n⚠️  Cannot connect to database. Please check:');
      console.error('   1. PostgreSQL is running');
      console.error('   2. DATABASE_URL in backend/.env is correct');
      console.error('   3. Database credentials are valid\n');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get command line arguments
const planName = process.argv[2] || 'Premium Plan';
const activeOnly = process.argv[3] !== '--all';

if (!activeOnly) {
  console.log('⚠️  Assigning ALL channels (including inactive ones)\n');
}

// Run the script
assignAllChannelsToPlan(planName, activeOnly);
