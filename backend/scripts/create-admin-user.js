#!/usr/bin/env node

/**
 * Create Admin User with Unlimited Subscription
 * 
 * Creates a user with ADMIN role and an unlimited subscription
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma');

async function createAdminUser(email, password, username, firstName, lastName) {
  try {
    console.log('🔧 Creating Admin User...\n');
    console.log('='.repeat(80));

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
      console.log(`⚠️  User with email "${email}" or username "${username}" already exists!`);
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Username: ${existingUser.username}`);
      console.log(`   Role: ${existingUser.role}`);
      
      // Check if they have a subscription
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
      
      console.log('\n❌ User already exists. Exiting.\n');
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
      console.error('❌ Premium Plan not found!');
      process.exit(1);
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
    console.log('✅ Account Created Successfully!\n');
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

const usage = () => {
  console.error('Usage:');
  console.error('  node create-admin-user.js <email> <password> <username> [firstName] [lastName]');
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
createAdminUser(email, password, username, firstName, lastName);
