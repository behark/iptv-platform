#!/usr/bin/env node
/**
 * Quick Device Activation Script
 *
 * Usage:
 *   node scripts/activate-device.js AA:BB:CC:DD:EE:FF
 *   node scripts/activate-device.js AA:BB:CC:DD:EE:FF "Living Room TV"
 *   node scripts/activate-device.js --prod AA:BB:CC:DD:EE:FF    # Use production DB
 */

require('dotenv').config();

// Check for --prod flag to use production database
const useProd = process.argv.includes('--prod');
if (useProd) {
  process.env.DATABASE_URL = process.env.RENDER_DATABASE_URL || process.env.PRODUCTION_DATABASE_URL;
  // Remove --prod from argv so it doesn't interfere with MAC parsing
  const prodIndex = process.argv.indexOf('--prod');
  process.argv.splice(prodIndex, 1);
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const normalizeMac = (mac) => {
  if (!mac) return null;
  const cleaned = mac.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  if (cleaned.length !== 12) return null;
  return cleaned.match(/.{2}/g).join(':');
};

const main = async () => {
  const macInput = process.argv[2];
  const deviceName = process.argv[3] || null;

  if (!macInput) {
    console.log('❌ Usage: node scripts/activate-device.js <MAC_ADDRESS> [device_name]');
    console.log('   Example: node scripts/activate-device.js AA:BB:CC:DD:EE:FF "Living Room TV"');
    process.exit(1);
  }

  const mac = normalizeMac(macInput);
  if (!mac) {
    console.log('❌ Invalid MAC address format');
    process.exit(1);
  }

  console.log('🔐 Device Activation\n');
  console.log(`🗄️  Database: ${useProd ? 'PRODUCTION' : 'LOCAL'}`);
  console.log(`📱 MAC Address: ${mac}`);

  // Find admin user
  const adminUser = await prisma.user.findFirst({
    where: {
      role: 'ADMIN',
      isActive: true
    },
    select: { id: true, email: true }
  });

  if (!adminUser) {
    console.log('❌ No admin user found');
    process.exit(1);
  }

  console.log(`👤 Assigning to: ${adminUser.email}`);

  // Check if device already exists
  const existingDevice = await prisma.device.findFirst({
    where: { macAddress: mac }
  });

  if (existingDevice) {
    // Update existing device
    await prisma.device.update({
      where: { id: existingDevice.id },
      data: {
        status: 'ACTIVE',
        name: deviceName || existingDevice.name || `Smart TV ${mac}`,
        updatedAt: new Date()
      }
    });
    console.log('✅ Device reactivated successfully!');
  } else {
    // Create new device
    await prisma.device.create({
      data: {
        userId: adminUser.id,
        macAddress: mac,
        name: deviceName || `Smart TV ${mac}`,
        status: 'ACTIVE'
      }
    });
    console.log('✅ Device activated successfully!');
  }

  console.log(`\n📺 Device Name: ${deviceName || `Smart TV ${mac}`}`);
  console.log('\n--- Next Steps ---');
  console.log('1. Go to: https://siptv.app/mylist/');
  console.log(`2. Enter MAC: ${mac}`);
  console.log('3. Upload file: /home/behar/Downloads/iptv_full_playlist.m3u');
  console.log('4. Click "Send"');
  console.log('5. Tell user to restart Smart IPTV app on their TV');
  console.log('\n🎉 Done!');
};

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
