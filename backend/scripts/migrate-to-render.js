#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const RENDER_DATABASE_URL = process.env.RENDER_DATABASE_URL || process.argv[2];

if (!RENDER_DATABASE_URL) {
    console.error('Usage: RENDER_DATABASE_URL=postgresql://... node migrate-to-render.js');
    console.error('   or: node migrate-to-render.js postgresql://...');
    process.exit(1);
}

const localPrisma = new PrismaClient();

const renderPrisma = new PrismaClient({
    datasources: {
        db: {
            url: RENDER_DATABASE_URL
        }
    }
});

async function migrate() {
    console.log('🚀 Starting migration to Render database...\n');

    try {
        // Test connections
        console.log('📡 Testing local database connection...');
        const localCount = await localPrisma.channel.count();
        console.log(`   ✅ Local database: ${localCount} channels\n`);

        console.log('📡 Testing Render database connection...');
        await renderPrisma.$connect();
        console.log('   ✅ Render database connected\n');

        // Migrate Plans first (foreign key dependency)
        console.log('📦 Migrating subscription plans...');
        const plans = await localPrisma.plan.findMany();
        for (const plan of plans) {
            await renderPrisma.plan.upsert({
                where: { id: plan.id },
                update: plan,
                create: plan
            });
        }
        console.log(`   ✅ ${plans.length} plans migrated\n`);

        // Migrate Users
        console.log('👤 Migrating users...');
        const users = await localPrisma.user.findMany();
        for (const user of users) {
            try {
                await renderPrisma.user.upsert({
                    where: { email: user.email },
                    update: {},
                    create: user
                });
            } catch (e) {
                // Skip if user already exists
            }
        }
        console.log(`   ✅ ${users.length} users migrated\n`);

        // Migrate Channels in batches
        console.log('📺 Migrating channels...');
        const channels = await localPrisma.channel.findMany();
        const batchSize = 100;
        let migrated = 0;

        for (let i = 0; i < channels.length; i += batchSize) {
            const batch = channels.slice(i, i + batchSize);

            await renderPrisma.channel.createMany({
                data: batch,
                skipDuplicates: true
            });

            migrated += batch.length;
            process.stdout.write(`\r   Progress: ${migrated}/${channels.length} channels`);
        }
        console.log(`\n   ✅ ${channels.length} channels migrated\n`);

        // Migrate ChannelAccess
        console.log('🔑 Migrating channel access rules...');
        const channelAccess = await localPrisma.channelAccess.findMany();
        if (channelAccess.length > 0) {
            await renderPrisma.channelAccess.createMany({
                data: channelAccess,
                skipDuplicates: true
            });
        }
        console.log(`   ✅ ${channelAccess.length} access rules migrated\n`);

        // Migrate Videos
        console.log('🎬 Migrating videos...');
        const videos = await localPrisma.video.findMany();
        if (videos.length > 0) {
            await renderPrisma.video.createMany({
                data: videos,
                skipDuplicates: true
            });
        }
        console.log(`   ✅ ${videos.length} videos migrated\n`);

        // Migrate Subscriptions
        console.log('💳 Migrating subscriptions...');
        const subscriptions = await localPrisma.subscription.findMany();
        if (subscriptions.length > 0) {
            for (const sub of subscriptions) {
                await renderPrisma.subscription.upsert({
                    where: { id: sub.id },
                    update: sub,
                    create: sub
                });
            }
        }
        console.log(`   ✅ ${subscriptions.length} subscriptions migrated\n`);

        // Final count
        const renderCount = await renderPrisma.channel.count();
        console.log('═══════════════════════════════════════');
        console.log(`🎉 Migration complete!`);
        console.log(`   Render database now has: ${renderCount} channels`);
        console.log('═══════════════════════════════════════');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await localPrisma.$disconnect();
        await renderPrisma.$disconnect();
    }
}

migrate();
