const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// ==================== USER MANAGEMENT ====================

// @route   GET /api/admin/users
// @desc    Get all users (Admin only)
// @access  Private (Admin)
router.get('/users', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        const { search, role, isActive, limit = 20, page = 1 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        if (search) {
            where.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { username: { contains: search, mode: 'insensitive' } }
            ];
        }
        if (role) where.role = role;
        if (isActive !== undefined) where.isActive = isActive === 'true';

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    isActive: true,
                    createdAt: true,
                    subscriptions: {
                        where: { status: 'ACTIVE' },
                        include: { plan: true },
                        take: 1
                    }
                },
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' }
            }),
            prisma.user.count({ where })
        ]);

        res.json({
            success: true,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            },
            data: { users }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/admin/users/:id
// @desc    Get single user (Admin only)
// @access  Private (Admin)
router.get('/users/:id', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
                createdAt: true,
                subscriptions: {
                    include: { plan: true },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: { user }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user (Admin only)
// @access  Private (Admin)
router.put('/users/:id', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        const { email, username, firstName, lastName, role, isActive } = req.body;

        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: {
                ...(email && { email }),
                ...(username && { username }),
                ...(firstName !== undefined && { firstName }),
                ...(lastName !== undefined && { lastName }),
                ...(role && { role }),
                ...(isActive !== undefined && { isActive })
            },
            select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true
            }
        });

        res.json({
            success: true,
            message: 'User updated successfully',
            data: { user }
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user (Admin only)
// @access  Private (Admin)
router.delete('/users/:id', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        await prisma.user.delete({
            where: { id: req.params.id }
        });

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// ==================== VIDEO MANAGEMENT ====================

// @route   GET /api/admin/videos
// @desc    Get all videos (Admin only)
// @access  Private (Admin)
router.get('/videos', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        const { search, category, isActive, limit = 20, page = 1 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } }
            ];
        }
        if (category) where.category = category;
        if (isActive !== undefined) where.isActive = isActive === 'true';

        const [videos, total] = await Promise.all([
            prisma.video.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' }
            }),
            prisma.video.count({ where })
        ]);

        res.json({
            success: true,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            },
            data: { videos }
        });
    } catch (error) {
        console.error('Get videos error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/admin/videos
// @desc    Create new video (Admin only)
// @access  Private (Admin)
router.post('/videos', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        const { title, description, thumbnail, videoUrl, duration, category, tags } = req.body;

        if (!title || !videoUrl) {
            return res.status(400).json({
                success: false,
                message: 'Title and video URL are required'
            });
        }

        const video = await prisma.video.create({
            data: {
                title,
                description,
                thumbnail,
                videoUrl,
                duration,
                category,
                tags: tags || []
            }
        });

        res.status(201).json({
            success: true,
            message: 'Video created successfully',
            data: { video }
        });
    } catch (error) {
        console.error('Create video error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   PUT /api/admin/videos/:id
// @desc    Update video (Admin only)
// @access  Private (Admin)
router.put('/videos/:id', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        const video = await prisma.video.update({
            where: { id: req.params.id },
            data: req.body
        });

        res.json({
            success: true,
            message: 'Video updated successfully',
            data: { video }
        });
    } catch (error) {
        console.error('Update video error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   DELETE /api/admin/videos/:id
// @desc    Delete video (Admin only)
// @access  Private (Admin)
router.delete('/videos/:id', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        await prisma.video.delete({
            where: { id: req.params.id }
        });

        res.json({
            success: true,
            message: 'Video deleted successfully'
        });
    } catch (error) {
        console.error('Delete video error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// ==================== SUBSCRIPTION MANAGEMENT ====================

// @route   POST /api/admin/subscriptions
// @desc    Create subscription for user (Admin only)
// @access  Private (Admin)
router.post('/subscriptions', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        const { userId, planId, endDate } = req.body;

        if (!userId || !planId) {
            return res.status(400).json({
                success: false,
                message: 'User ID and Plan ID are required'
            });
        }

        const [user, plan] = await Promise.all([
            prisma.user.findUnique({ where: { id: userId } }),
            prisma.plan.findUnique({ where: { id: planId } })
        ]);

        if (!user || !plan) {
            return res.status(404).json({
                success: false,
                message: 'User or Plan not found'
            });
        }

        // Cancel existing active subscriptions
        await prisma.subscription.updateMany({
            where: { userId, status: 'ACTIVE' },
            data: { status: 'CANCELLED' }
        });

        // Calculate end date
        const calculatedEndDate = endDate
            ? new Date(endDate)
            : new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000);

        const subscription = await prisma.subscription.create({
            data: {
                userId,
                planId,
                status: 'ACTIVE',
                endDate: calculatedEndDate
            },
            include: { plan: true, user: true }
        });

        res.status(201).json({
            success: true,
            message: 'Subscription created successfully',
            data: { subscription }
        });
    } catch (error) {
        console.error('Create subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   PUT /api/admin/subscriptions/:id
// @desc    Update subscription (Admin only)
// @access  Private (Admin)
router.put('/subscriptions/:id', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        const { status, endDate } = req.body;

        const subscription = await prisma.subscription.update({
            where: { id: req.params.id },
            data: {
                ...(status && { status }),
                ...(endDate && { endDate: new Date(endDate) })
            },
            include: { plan: true, user: true }
        });

        res.json({
            success: true,
            message: 'Subscription updated successfully',
            data: { subscription }
        });
    } catch (error) {
        console.error('Update subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// ==================== DASHBOARD STATS ====================

// @route   GET /api/admin/stats
// @desc    Get dashboard statistics (Admin only)
// @access  Private (Admin)
router.get('/stats', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        const [
            totalUsers,
            activeSubscriptions,
            totalChannels,
            totalVideos,
            recentUsers,
            recentSubscriptions
        ] = await Promise.all([
            prisma.user.count(),
            prisma.subscription.count({ where: { status: 'ACTIVE' } }),
            prisma.channel.count({ where: { isActive: true } }),
            prisma.video.count({ where: { isActive: true } }),
            prisma.user.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: { id: true, email: true, username: true, createdAt: true }
            }),
            prisma.subscription.findMany({
                take: 5,
                where: { status: 'ACTIVE' },
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: { email: true, username: true } },
                    plan: { select: { name: true, price: true } }
                }
            })
        ]);

        res.json({
            success: true,
            data: {
                stats: {
                    totalUsers,
                    activeSubscriptions,
                    totalChannels,
                    totalVideos
                },
                recentUsers,
                recentSubscriptions
            }
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// ==================== PLAN MANAGEMENT ====================

// @route   POST /api/admin/plans
// @desc    Create new plan (Admin only)
// @access  Private (Admin)
router.post('/plans', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        const { name, description, price, currency, duration, features } = req.body;

        if (!name || !price || !duration) {
            return res.status(400).json({
                success: false,
                message: 'Name, price, and duration are required'
            });
        }

        const plan = await prisma.plan.create({
            data: {
                name,
                description,
                price,
                currency: currency || 'USD',
                duration,
                features: features || []
            }
        });

        res.status(201).json({
            success: true,
            message: 'Plan created successfully',
            data: { plan }
        });
    } catch (error) {
        console.error('Create plan error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   PUT /api/admin/plans/:id
// @desc    Update plan (Admin only)
// @access  Private (Admin)
router.put('/plans/:id', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        const plan = await prisma.plan.update({
            where: { id: req.params.id },
            data: req.body
        });

        res.json({
            success: true,
            message: 'Plan updated successfully',
            data: { plan }
        });
    } catch (error) {
        console.error('Update plan error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   DELETE /api/admin/plans/:id
// @desc    Delete plan (Admin only)
// @access  Private (Admin)
router.delete('/plans/:id', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        await prisma.plan.delete({
            where: { id: req.params.id }
        });

        res.json({
            success: true,
            message: 'Plan deleted successfully'
        });
    } catch (error) {
        console.error('Delete plan error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;
