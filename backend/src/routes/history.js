const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// @route   GET /api/history
// @desc    Get user's watch history
// @access  Private
router.get('/', authenticate, async (req, res) => {
    try {
        const { limit = 20, page = 1 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [history, total] = await Promise.all([
            prisma.watchHistory.findMany({
                where: { userId: req.user.id },
                include: {
                    channel: true,
                    video: true
                },
                orderBy: { watchedAt: 'desc' },
                skip,
                take: parseInt(limit)
            }),
            prisma.watchHistory.count({
                where: { userId: req.user.id }
            })
        ]);

        res.json({
            success: true,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            },
            data: { history }
        });
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/history/channel/:channelId
// @desc    Add channel to watch history
// @access  Private
router.post('/channel/:channelId', authenticate, async (req, res) => {
    try {
        const { channelId } = req.params;
        const { duration } = req.body;

        const channel = await prisma.channel.findUnique({
            where: { id: channelId }
        });

        if (!channel) {
            return res.status(404).json({
                success: false,
                message: 'Channel not found'
            });
        }

        const history = await prisma.watchHistory.create({
            data: {
                userId: req.user.id,
                channelId,
                duration: duration || null
            },
            include: { channel: true }
        });

        res.status(201).json({
            success: true,
            data: { history }
        });
    } catch (error) {
        console.error('Add channel history error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/history/video/:videoId
// @desc    Add video to watch history
// @access  Private
router.post('/video/:videoId', authenticate, async (req, res) => {
    try {
        const { videoId } = req.params;
        const { duration, completed } = req.body;

        const video = await prisma.video.findUnique({
            where: { id: videoId }
        });

        if (!video) {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }

        const history = await prisma.watchHistory.create({
            data: {
                userId: req.user.id,
                videoId,
                duration: duration || null,
                completed: completed || false
            },
            include: { video: true }
        });

        res.status(201).json({
            success: true,
            data: { history }
        });
    } catch (error) {
        console.error('Add video history error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   DELETE /api/history
// @desc    Clear all watch history
// @access  Private
router.delete('/', authenticate, async (req, res) => {
    try {
        await prisma.watchHistory.deleteMany({
            where: { userId: req.user.id }
        });

        res.json({
            success: true,
            message: 'Watch history cleared'
        });
    } catch (error) {
        console.error('Clear history error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   DELETE /api/history/:id
// @desc    Remove single item from history
// @access  Private
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const historyItem = await prisma.watchHistory.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!historyItem) {
            return res.status(404).json({
                success: false,
                message: 'History item not found'
            });
        }

        await prisma.watchHistory.delete({
            where: { id: req.params.id }
        });

        res.json({
            success: true,
            message: 'Removed from history'
        });
    } catch (error) {
        console.error('Remove history item error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;
