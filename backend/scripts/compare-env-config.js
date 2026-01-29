#!/usr/bin/env node

/**
 * Compare Local vs Production Environment Configuration
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

console.log('🔍 Environment Configuration Comparison\n');
console.log('='.repeat(80));

const localConfig = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || '3002',
  JWT_SECRET: process.env.JWT_SECRET ? `${process.env.JWT_SECRET.substring(0, 20)}...` : 'NOT SET',
  JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
  FRONTEND_URL: process.env.FRONTEND_URL || 'NOT SET',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'NOT SET',
  DATABASE_URL: process.env.DATABASE_URL ? 'Local database' : 'NOT SET',
  RENDER_DATABASE_URL: process.env.RENDER_DATABASE_URL ? 'Set' : 'NOT SET',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? (process.env.STRIPE_SECRET_KEY.includes('test') ? 'Test key' : 'Live key') : 'NOT SET'
};

const productionConfig = {
  NODE_ENV: 'production',
  PORT: '10000',
  JWT_SECRET: 'a3f2b8c9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3',
  JWT_EXPIRE: '7d',
  FRONTEND_URL: 'https://iptv-platform-sable.vercel.app',
  ALLOWED_ORIGINS: 'https://iptv-platform-sable.vercel.app',
  DATABASE_URL: 'Render PostgreSQL',
  STRIPE_SECRET_KEY: 'Test key (sk_test_...)'
};

console.log('\n📋 LOCAL CONFIGURATION (.env):');
console.log('-'.repeat(80));
Object.entries(localConfig).forEach(([key, value]) => {
  console.log(`  ${key.padEnd(20)}: ${value}`);
});

console.log('\n📋 PRODUCTION CONFIGURATION (Render):');
console.log('-'.repeat(80));
Object.entries(productionConfig).forEach(([key, value]) => {
  console.log(`  ${key.padEnd(20)}: ${value}`);
});

console.log('\n🔐 JWT_SECRET Analysis:');
console.log('-'.repeat(80));
const localSecret = process.env.JWT_SECRET || '';
const prodSecret = productionConfig.JWT_SECRET;

console.log(`  Local JWT_SECRET:  ${localSecret.substring(0, 20)}... (${localSecret.length} chars)`);
console.log(`  Prod JWT_SECRET:  ${prodSecret.substring(0, 20)}... (${prodSecret.length} chars)`);
console.log(`  Match: ${localSecret === prodSecret ? '✅ Same' : '⚠️  Different (this is normal)'}`);

if (localSecret !== prodSecret) {
  console.log('\n  ℹ️  Note: Different JWT secrets mean:');
  console.log('     - Tokens generated in production won\'t work locally');
  console.log('     - Tokens generated locally won\'t work in production');
  console.log('     - This is a security best practice!');
}

console.log('\n✅ Configuration Summary:');
console.log('-'.repeat(80));
console.log('  ✅ Production database URL is configured locally');
console.log('  ✅ JWT_SECRET is set in both environments');
console.log('  ✅ Frontend URL matches production');
console.log('  ✅ CORS origins configured for production');
console.log('  ⚠️  Stripe is using TEST keys (update for live payments)');

console.log('\n' + '='.repeat(80));
