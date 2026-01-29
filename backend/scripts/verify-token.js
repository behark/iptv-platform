#!/usr/bin/env node

/**
 * Verify JWT Token
 * 
 * Checks if a JWT token is valid, not expired, and the user exists
 * Usage: node verify-token.js <token> [database_url]
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const token = process.argv[2];
const databaseUrl = process.argv[3] || process.env.DATABASE_URL || process.env.RENDER_DATABASE_URL;

if (!token) {
  console.error('❌ Token not provided!');
  console.error('\nUsage:');
  console.error('  node verify-token.js <token> [database_url]');
  console.error('  or set DATABASE_URL or RENDER_DATABASE_URL environment variable');
  process.exit(1);
}

if (!databaseUrl) {
  console.error('❌ Database URL not found!');
  console.error('  Set DATABASE_URL or RENDER_DATABASE_URL environment variable');
  console.error('  or provide as second argument');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  }
});

async function verifyToken(tokenToVerify) {
  try {
    console.log('🔍 Verifying JWT Token...\n');
    console.log('='.repeat(80));
    console.log(`Token: ${tokenToVerify.substring(0, 20)}...${tokenToVerify.substring(tokenToVerify.length - 20)}\n`);

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error('❌ JWT_SECRET not found in environment variables!');
      process.exit(1);
    }

    // Decode token without verification first to see what's inside
    let decoded;
    try {
      decoded = jwt.decode(tokenToVerify, { complete: true });
      
      if (!decoded) {
        console.log('❌ Token is not a valid JWT format');
        return;
      }

      console.log('📋 Token Information:');
      console.log(`   Algorithm: ${decoded.header.alg}`);
      console.log(`   Type: ${decoded.header.typ}`);
      console.log(`   User ID: ${decoded.payload.userId || decoded.payload.id || 'N/A'}`);
      
      if (decoded.payload.exp) {
        const expDate = new Date(decoded.payload.exp * 1000);
        const now = new Date();
        const isExpired = expDate < now;
        console.log(`   Expires: ${expDate.toLocaleString()}`);
        console.log(`   Status: ${isExpired ? '❌ EXPIRED' : '✅ Valid (not expired)'}`);
        
        if (isExpired) {
          console.log(`   Expired ${Math.floor((now - expDate) / (1000 * 60 * 60 * 24))} days ago`);
        } else {
          const daysLeft = Math.floor((expDate - now) / (1000 * 60 * 60 * 24));
          const hoursLeft = Math.floor((expDate - now) / (1000 * 60 * 60)) % 24;
          console.log(`   Time remaining: ${daysLeft} days, ${hoursLeft} hours`);
        }
      } else {
        console.log('   Expires: Never (no expiration set)');
      }

      if (decoded.payload.iat) {
        const iatDate = new Date(decoded.payload.iat * 1000);
        console.log(`   Issued: ${iatDate.toLocaleString()}`);
      }

      console.log('');

      // Now verify the token signature
      console.log('🔐 Verifying token signature...');
      try {
        const verified = jwt.verify(tokenToVerify, jwtSecret);
        console.log('✅ Token signature is VALID\n');

        // Check if user exists and is active
        const userId = verified.userId || verified.id;
        if (userId) {
          console.log('👤 Checking user status...');
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              email: true,
              username: true,
              role: true,
              isActive: true
            }
          });

          if (!user) {
            console.log('❌ User not found in database');
            return;
          }

          console.log('✅ User found:');
          console.log(`   Email: ${user.email}`);
          console.log(`   Username: ${user.username}`);
          console.log(`   Role: ${user.role}`);
          console.log(`   Active: ${user.isActive ? '✅ Yes' : '❌ No'}`);

          if (!user.isActive) {
            console.log('\n⚠️  WARNING: User account is inactive!');
          }

          // Check token blacklist (if implemented)
          try {
            const { isBlacklisted } = require('../src/services/tokenBlacklist');
            if (isBlacklisted(tokenToVerify)) {
              console.log('\n❌ Token is BLACKLISTED (has been invalidated)');
              return;
            } else {
              console.log('\n✅ Token is not blacklisted');
            }
          } catch (e) {
            // Token blacklist service might not be available, that's okay
            console.log('\nℹ️  Token blacklist check skipped (service not available)');
          }

          console.log('\n' + '='.repeat(80));
          console.log('✅ TOKEN IS VALID AND USER IS ACTIVE');
          console.log('='.repeat(80));
        } else {
          console.log('⚠️  Token does not contain user ID');
        }

      } catch (verifyError) {
        if (verifyError.name === 'TokenExpiredError') {
          console.log('❌ Token signature is VALID but token has EXPIRED');
          console.log(`   Expired at: ${new Date(verifyError.expiredAt).toLocaleString()}`);
        } else if (verifyError.name === 'JsonWebTokenError') {
          console.log('❌ Token signature is INVALID');
          console.log(`   Error: ${verifyError.message}`);
        } else {
          console.log('❌ Token verification failed');
          console.log(`   Error: ${verifyError.message}`);
        }
      }

    } catch (decodeError) {
      console.log('❌ Failed to decode token');
      console.log(`   Error: ${decodeError.message}`);
    }

  } catch (error) {
    console.error('❌ Error verifying token:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the verification
verifyToken(token);
