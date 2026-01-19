const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@iptv.com' },
    update: {},
    create: {
      email: 'admin@iptv.com',
      username: 'admin',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN'
    }
  });

  // Create test user
  const userPassword = await bcrypt.hash('user123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'user@iptv.com' },
    update: {},
    create: {
      email: 'user@iptv.com',
      username: 'testuser',
      password: userPassword,
      firstName: 'Test',
      lastName: 'User',
      role: 'USER'
    }
  });

  // Create subscription plans
  const basicPlan = await prisma.plan.upsert({
    where: { id: 'basic-plan' },
    update: {
      name: 'Basic Plan',
      description: 'Access to basic channels',
      price: 9.99,
      features: ['50+ Channels', 'HD Quality', '24/7 Support']
    },
    create: {
      id: 'basic-plan',
      name: 'Basic Plan',
      description: 'Access to basic channels',
      price: 9.99,
      currency: 'USD',
      duration: 30,
      features: ['50+ Channels', 'HD Quality', '24/7 Support']
    }
  });

  const premiumPlan = await prisma.plan.upsert({
    where: { id: 'premium-plan' },
    update: {
      name: 'Premium Plan',
      description: 'Access to all channels including sports and movies',
      price: 19.99,
      features: ['200+ Channels', 'HD & 4K Quality', 'Premium Content', '24/7 Support', 'DVR Feature']
    },
    create: {
      id: 'premium-plan',
      name: 'Premium Plan',
      description: 'Access to all channels including sports and movies',
      price: 19.99,
      currency: 'USD',
      duration: 30,
      features: ['200+ Channels', 'HD & 4K Quality', 'Premium Content', '24/7 Support', 'DVR Feature']
    }
  });

  // Create sample channels with upsert to handle re-runs
  const channel1 = await prisma.channel.upsert({
    where: { id: 'sample-news-channel' },
    update: {},
    create: {
      id: 'sample-news-channel',
      name: 'Sample News Channel',
      description: '24/7 news coverage from around the world',
      streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      streamType: 'HLS',
      category: 'News',
      language: 'en',
      country: 'US',
      isLive: true
    }
  });

  const channel2 = await prisma.channel.upsert({
    where: { id: 'sample-sports-channel' },
    update: {},
    create: {
      id: 'sample-sports-channel',
      name: 'Sample Sports Channel',
      description: 'Live sports events and highlights',
      streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      streamType: 'HLS',
      category: 'Sports',
      language: 'en',
      country: 'US',
      isLive: true
    }
  });

  const channel3 = await prisma.channel.upsert({
    where: { id: 'sample-movies-channel' },
    update: {},
    create: {
      id: 'sample-movies-channel',
      name: 'Sample Movies Channel',
      description: 'Classic and new movies 24/7',
      streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      streamType: 'HLS',
      category: 'Movies',
      language: 'en',
      country: 'US',
      isLive: true
    }
  });

  const channel4 = await prisma.channel.upsert({
    where: { id: 'sample-music-channel' },
    update: {},
    create: {
      id: 'sample-music-channel',
      name: 'Sample Music Channel',
      description: 'Music videos and live concerts',
      streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      streamType: 'HLS',
      category: 'Music',
      language: 'en',
      country: 'US',
      isLive: true
    }
  });

  // Assign channels to plans
  await prisma.channelAccess.upsert({
    where: { planId_channelId: { planId: basicPlan.id, channelId: channel1.id } },
    update: {},
    create: { planId: basicPlan.id, channelId: channel1.id }
  });

  await prisma.channelAccess.upsert({
    where: { planId_channelId: { planId: basicPlan.id, channelId: channel4.id } },
    update: {},
    create: { planId: basicPlan.id, channelId: channel4.id }
  });

  await prisma.channelAccess.upsert({
    where: { planId_channelId: { planId: premiumPlan.id, channelId: channel1.id } },
    update: {},
    create: { planId: premiumPlan.id, channelId: channel1.id }
  });

  await prisma.channelAccess.upsert({
    where: { planId_channelId: { planId: premiumPlan.id, channelId: channel2.id } },
    update: {},
    create: { planId: premiumPlan.id, channelId: channel2.id }
  });

  await prisma.channelAccess.upsert({
    where: { planId_channelId: { planId: premiumPlan.id, channelId: channel3.id } },
    update: {},
    create: { planId: premiumPlan.id, channelId: channel3.id }
  });

  await prisma.channelAccess.upsert({
    where: { planId_channelId: { planId: premiumPlan.id, channelId: channel4.id } },
    update: {},
    create: { planId: premiumPlan.id, channelId: channel4.id }
  });

  // Create sample videos
  await prisma.video.upsert({
    where: { id: 'sample-video-1' },
    update: {},
    create: {
      id: 'sample-video-1',
      title: 'Welcome to IPTV Platform',
      description: 'An introduction to our streaming platform and its features',
      videoUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      duration: 300,
      category: 'Tutorial',
      tags: ['welcome', 'intro', 'tutorial']
    }
  });

  await prisma.video.upsert({
    where: { id: 'sample-video-2' },
    update: {},
    create: {
      id: 'sample-video-2',
      title: 'Nature Documentary: Ocean Life',
      description: 'Explore the wonders of marine life in this stunning documentary',
      videoUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      duration: 3600,
      category: 'Documentary',
      tags: ['nature', 'ocean', 'documentary']
    }
  });

  await prisma.video.upsert({
    where: { id: 'sample-video-3' },
    update: {},
    create: {
      id: 'sample-video-3',
      title: 'Tech Review: Latest Gadgets',
      description: 'Review of the latest technology and gadgets',
      videoUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      duration: 1800,
      category: 'Technology',
      tags: ['tech', 'review', 'gadgets']
    }
  });

  // Create subscription for test user (admin doesn't need one)
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);

  await prisma.subscription.upsert({
    where: { id: 'test-user-subscription' },
    update: {
      status: 'ACTIVE',
      endDate
    },
    create: {
      id: 'test-user-subscription',
      userId: user.id,
      planId: premiumPlan.id,
      status: 'ACTIVE',
      endDate
    }
  });

  console.log('✅ Seeding completed!');
  console.log('');
  console.log('📧 Admin credentials: admin@iptv.com / admin123');
  console.log('📧 User credentials: user@iptv.com / user123');
  console.log('');
  console.log('📺 Created 4 sample channels');
  console.log('🎬 Created 3 sample videos');
  console.log('💳 Created subscription for test user');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
