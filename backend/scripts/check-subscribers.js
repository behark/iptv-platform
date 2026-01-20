#!/usr/bin/env node

/**
 * Subscriber Status Checker
 * 
 * This script queries the database to show:
 * - Total number of subscribers/clients
 * - Their subscription status
 * - What plans they have
 * - What channels they have access to
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const prisma = require('../src/lib/prisma');

async function checkSubscribers() {
  try {
    console.log('🔍 Checking Subscriber Status...\n');
    console.log('='.repeat(80));

    // Get all users with their subscriptions
    const users = await prisma.user.findMany({
      where: {
        role: 'USER' // Only regular users, not admins
      },
      include: {
        subscriptions: {
          include: {
            plan: {
              include: {
                channelAccess: {
                  include: {
                    channel: {
                      select: {
                        id: true,
                        name: true,
                        category: true,
                        isActive: true
                      }
                    }
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        devices: {
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Statistics
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.isActive).length;
    const usersWithActiveSubs = users.filter(u => 
      u.subscriptions.some(s => s.status === 'ACTIVE')
    ).length;
    const usersWithExpiredSubs = users.filter(u => 
      u.subscriptions.some(s => s.status === 'EXPIRED') && 
      !u.subscriptions.some(s => s.status === 'ACTIVE')
    ).length;
    const usersWithNoSubs = users.filter(u => u.subscriptions.length === 0).length;

    // Subscription status breakdown
    const subscriptionStats = {
      ACTIVE: 0,
      CANCELLED: 0,
      EXPIRED: 0,
      PENDING: 0
    };

    users.forEach(user => {
      user.subscriptions.forEach(sub => {
        subscriptionStats[sub.status] = (subscriptionStats[sub.status] || 0) + 1;
      });
    });

    // Plan distribution
    const planDistribution = {};
    users.forEach(user => {
      user.subscriptions.forEach(sub => {
        if (sub.status === 'ACTIVE') {
          const planName = sub.plan.name;
          planDistribution[planName] = (planDistribution[planName] || 0) + 1;
        }
      });
    });

    // Channel access summary
    const channelAccessMap = new Map();
    users.forEach(user => {
      user.subscriptions
        .filter(s => s.status === 'ACTIVE')
        .forEach(sub => {
          sub.plan.channelAccess.forEach(access => {
            const channelName = access.channel.name;
            if (!channelAccessMap.has(channelName)) {
              channelAccessMap.set(channelName, new Set());
            }
            channelAccessMap.get(channelName).add(user.id);
          });
        });
    });

    // Print Statistics
    console.log('\n📊 OVERALL STATISTICS');
    console.log('-'.repeat(80));
    console.log(`Total Users (Clients):        ${totalUsers}`);
    console.log(`Active Users:                 ${activeUsers}`);
    console.log(`Users with Active Subs:       ${usersWithActiveSubs}`);
    console.log(`Users with Expired Subs:      ${usersWithExpiredSubs}`);
    console.log(`Users with No Subscriptions:  ${usersWithNoSubs}`);
    console.log('');

    console.log('📋 SUBSCRIPTION STATUS BREAKDOWN');
    console.log('-'.repeat(80));
    Object.entries(subscriptionStats).forEach(([status, count]) => {
      console.log(`${status.padEnd(15)}: ${count}`);
    });
    console.log('');

    if (Object.keys(planDistribution).length > 0) {
      console.log('💳 PLAN DISTRIBUTION (Active Subscriptions)');
      console.log('-'.repeat(80));
      Object.entries(planDistribution)
        .sort((a, b) => b[1] - a[1])
        .forEach(([plan, count]) => {
          console.log(`${plan.padEnd(30)}: ${count} subscribers`);
        });
      console.log('');
    }

    // Print detailed user information
    console.log('\n👥 DETAILED SUBSCRIBER INFORMATION');
    console.log('='.repeat(80));

    if (users.length === 0) {
      console.log('\n⚠️  No subscribers found in the database.\n');
    } else {
      users.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.email} (${user.username})`);
        console.log(`   Status: ${user.isActive ? '✅ Active' : '❌ Inactive'}`);
        console.log(`   Created: ${user.createdAt.toLocaleString()}`);
        
        if (user.subscriptions.length === 0) {
          console.log(`   ⚠️  No subscriptions`);
        } else {
          console.log(`   Subscriptions (${user.subscriptions.length}):`);
          user.subscriptions.forEach((sub, subIndex) => {
            const statusEmoji = {
              ACTIVE: '✅',
              EXPIRED: '⏰',
              CANCELLED: '❌',
              PENDING: '⏳'
            }[sub.status] || '❓';
            
            console.log(`      ${subIndex + 1}. ${statusEmoji} ${sub.plan.name} - ${sub.status}`);
            console.log(`         Price: ${sub.plan.price} ${sub.plan.currency}`);
            console.log(`         Duration: ${sub.plan.duration} days`);
            console.log(`         Start: ${sub.startDate.toLocaleDateString()}`);
            if (sub.endDate) {
              console.log(`         End: ${sub.endDate.toLocaleDateString()}`);
              const now = new Date();
              if (sub.status === 'ACTIVE' && sub.endDate < now) {
                console.log(`         ⚠️  Subscription expired but status is ACTIVE!`);
              }
            }
            
            // Show channel access for active subscriptions
            if (sub.status === 'ACTIVE' && sub.plan.channelAccess.length > 0) {
              const channelCount = sub.plan.channelAccess.length;
              const activeChannels = sub.plan.channelAccess.filter(a => a.channel.isActive).length;
              console.log(`         Channel Access: ${activeChannels}/${channelCount} active channels`);
              
              // Show categories
              const categories = [...new Set(sub.plan.channelAccess.map(a => a.channel.category).filter(Boolean))];
              if (categories.length > 0) {
                console.log(`         Categories: ${categories.join(', ')}`);
              }
            }
          });
        }

        // Show devices
        if (user.devices.length > 0) {
          console.log(`   Devices (${user.devices.length}):`);
          user.devices.forEach(device => {
            const deviceStatusEmoji = {
              ACTIVE: '✅',
              PENDING: '⏳',
              REVOKED: '❌'
            }[device.status] || '❓';
            console.log(`      - ${deviceStatusEmoji} ${device.name || 'Unnamed'} (${device.status})`);
          });
        }
      });
    }

    // Channel access summary
    if (channelAccessMap.size > 0) {
      console.log('\n\n📺 CHANNEL ACCESS SUMMARY');
      console.log('='.repeat(80));
      console.log(`Total Unique Channels with Access: ${channelAccessMap.size}\n`);
      
      const sortedChannels = Array.from(channelAccessMap.entries())
        .sort((a, b) => b[1].size - a[1].size)
        .slice(0, 20); // Top 20 most accessed channels
      
      if (sortedChannels.length > 0) {
        console.log('Top Channels by Subscriber Access:');
        sortedChannels.forEach(([channelName, userIds]) => {
          console.log(`  ${channelName.padEnd(40)}: ${userIds.size} subscribers`);
        });
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Check complete!\n');

  } catch (error) {
    console.error('❌ Error checking subscribers:', error);
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

// Run the script
checkSubscribers();
