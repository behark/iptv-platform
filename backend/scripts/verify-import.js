#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Verifying imported channels...');
    try {
        const channels = await prisma.channel.findMany({
            take: 5,
        });

        if (channels.length > 0) {
            console.log('✅ Found channels in the database:');
            channels.forEach(channel => {
                console.log(`  - ${channel.name} (${channel.country})`);
            });
        } else {
            console.log('❌ No channels found in the database.');
        }

    } catch (error) {
        console.error('Error verifying channels:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
