#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seed() {
    console.log('🌱 Seeding production database...');

    try {
        // Create admin user if not exists
        const adminEmail = 'admin@iptv.com';
        const existingAdmin = await prisma.user.findUnique({
            where: { email: adminEmail }
        });

        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash('admin123', 12);
            await prisma.user.create({
                data: {
                    email: adminEmail,
                    username: 'admin',
                    firstName: 'Admin',
                    lastName: 'User',
                    password: hashedPassword,
                    role: 'ADMIN'
                }
            });
            console.log('✅ Admin user created');
        } else {
            console.log('ℹ️ Admin user already exists');
        }

        // Create subscription plans if not exist
        const plans = [
            {
                name: 'Basic',
                description: 'Access to 2,000+ channels',
                price: 4.99,
                interval: 'month',
                features: ['2000+ channels', 'HD quality', '2 streams'],
                stripePriceId: null
            },
            {
                name: 'Premium',
                description: 'Access to 5,000+ channels',
                price: 8.99,
                interval: 'month',
                features: ['5000+ channels', '4K quality', '4 streams', 'VOD library'],
                stripePriceId: null
            },
            {
                name: 'Family',
                description: 'Access to 8,000+ channels',
                price: 14.99,
                interval: 'month',
                features: ['8000+ channels', '4K quality', '6 streams', 'VOD library', 'Kids profiles'],
                stripePriceId: null
            }
        ];

        for (const plan of plans) {
            const existingPlan = await prisma.plan.findFirst({
                where: { name: plan.name }
            });

            if (!existingPlan) {
                await prisma.plan.create({ data: plan });
                console.log(`✅ Plan created: ${plan.name}`);
            } else {
                console.log(`ℹ️ Plan already exists: ${plan.name}`);
            }
        }

        // Create a free subscription for admin
        const adminUser = await prisma.user.findUnique({
            where: { email: adminEmail }
        });

        if (adminUser) {
            const existingSub = await prisma.subscription.findFirst({
                where: { userId: adminUser.id }
            });

            if (!existingSub) {
                const basicPlan = await prisma.plan.findFirst({
                    where: { name: 'Basic' }
                });

                if (basicPlan) {
                    await prisma.subscription.create({
                        data: {
                            userId: adminUser.id,
                            planId: basicPlan.id,
                            status: 'ACTIVE',
                            startDate: new Date(),
                            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
                            stripeSubscriptionId: 'free_admin'
                        }
                    });
                    console.log('✅ Admin subscription created');
                }
            }
        }

        console.log('\n🎉 Production database seeded successfully!');
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    seed();
}

module.exports = { seed };
