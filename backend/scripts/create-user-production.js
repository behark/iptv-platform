#!/usr/bin/env node

/**
 * Create User in Production Database
 * 
 * Creates a user with ADMIN role and unlimited subscription in production
 * Usage: RENDER_DATABASE_URL=postgresql://... node create-user-production.js [email] [password] [username]
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

// Get production database URL from environment or command line
const PRODUCTION_DATABASE_URL = process.env.RENDER_DATABASE_URL || process.env.PRODUCTION_DATABASE_URL || process.argv[4];

if (!PRODUCTION_DATABASE_URL) {
  console.error('❌ Production database URL not found!');
  console.error('\nUsage:');
  console.error('  RENDER_DATABASE_URL=postgresql://... node create-user-production.js <email> <password> <username>');
  console.error('  or');
  console.error('  node create-user-production.js <email> <password> <username> <database_url>');
  console.error('  or set ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_USERNAME');
  process.exit(1);
}

// Create Prisma client for production database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: PRODUCTION_DATABASE_URL
    }
  }
});

async function createAdminUserInProduction(email, password, username, firstName, lastName) {
  try {
    console.log('🔧 Creating Admin User in Production...\n');
    console.log('='.repeat(80));
    console.log('⚠️  WARNING: This will create a user in PRODUCTION database!\n');

    // Test connection
    console.log('📡 Testing production database connection...');
    await prisma.$connect();
    console.log('✅ Connected to production database\n');

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    });

    if (existingUser) {
      console.log(`⚠️  User with email "${email}" or username "${username}" already exists in production!`);
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Username: ${existingUser.username}`);
      console.log(`   Role: ${existingUser.role}`);
      
      const subscriptions = await prisma.subscription.findMany({
        where: { userId: existingUser.id },
        include: { plan: true }
      });
      
      if (subscriptions.length > 0) {
        console.log(`   Subscriptions: ${subscriptions.length}`);
        subscriptions.forEach(sub => {
          console.log(`     - ${sub.plan.name} (${sub.status})`);
        });
      }
      
      console.log('\n✅ User already exists in production.\n');
      await prisma.$disconnect();
      return;
    }

    // Hash password
    console.log('Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 12);

    // Get Premium Plan
    const premiumPlan = await prisma.plan.findFirst({
      where: { name: 'Premium Plan' }
    });

    if (!premiumPlan) {
      console.error('❌ Premium Plan not found in production database!');
      console.error('   Please ensure the Premium Plan exists in production.\n');
      process.exit(1);
    }

    // Check if Premium Plan has channels assigned
    const channelAccessCount = await prisma.channelAccess.count({
      where: { planId: premiumPlan.id }
    });

    if (channelAccessCount === 0) {
      console.log('⚠️  Warning: Premium Plan has no channels assigned!');
      console.log('   The user will be created but won\'t have channel access.\n');
    }

    // Create user with ADMIN role
    console.log('Creating user with ADMIN role...');
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        role: 'ADMIN',
        isActive: true
      }
    });

    console.log(`✅ User created: ${user.email} (${user.username})`);
    console.log(`   Role: ${user.role}`);
    console.log(`   ID: ${user.id}\n`);

    // Create unlimited subscription (no end date)
    console.log('Creating unlimited subscription...');
    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: premiumPlan.id,
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: null // No expiration - unlimited
      },
      include: {
        plan: {
          include: {
            channelAccess: {
              select: {
                channelId: true
              }
            }
          }
        }
      }
    });

    const channelCount = subscription.plan.channelAccess.length;
    console.log(`✅ Unlimited subscription created!`);
    console.log(`   Plan: ${subscription.plan.name}`);
    console.log(`   Status: ${subscription.status}`);
    console.log(`   Start Date: ${subscription.startDate.toLocaleDateString()}`);
    console.log(`   End Date: Never (Unlimited)`);
    console.log(`   Channel Access: ${channelCount} channels\n`);

    console.log('='.repeat(80));
    console.log('✅ Account Created Successfully in Production!\n');
    console.log('Account Details:');
    console.log(`   Email: ${email}`);
    console.log(`   Username: ${username}`);
    console.log('   Password: [hidden]');
    console.log(`   Role: ADMIN (Full Access)`);
    console.log(`   Subscription: Unlimited Premium Plan`);
    console.log(`   Channels: ${channelCount} channels\n`);

  } catch (error) {
    console.error('❌ Error creating user:', error);
    if (error.code === 'P2002') {
      console.error('\n⚠️  Unique constraint violation - user with this email or username already exists\n');
    } else if (error.code === 'P1001') {
      console.error('\n⚠️  Cannot connect to production database. Please check:');
      console.error('   1. Database URL is correct');
      console.error('   2. Database is accessible from your network');
      console.error('   3. Database credentials are valid\n');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const usage = () => {
  console.error('Usage:');
  console.error('  RENDER_DATABASE_URL=postgresql://... node create-user-production.js <email> <password> <username> [firstName] [lastName]');
  console.error('  or set ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_USERNAME (optional ADMIN_FIRST_NAME, ADMIN_LAST_NAME)');
};

// Get command line arguments or environment variables
const email = process.argv[2] || process.env.ADMIN_EMAIL;
const password = process.argv[3] || process.env.ADMIN_PASSWORD;
const username = process.argv[4] || process.env.ADMIN_USERNAME;
const firstName = process.argv[5] || process.env.ADMIN_FIRST_NAME || null;
const lastName = process.argv[6] || process.env.ADMIN_LAST_NAME || null;

if (!email || !password || !username) {
  console.error('❌ Missing required admin credentials.');
  usage();
  process.exit(1);
}

// Run the script
createAdminUserInProduction(email, password, username, firstName, lastName);
