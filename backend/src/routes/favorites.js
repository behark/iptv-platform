const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// @route   GET /api/favorites
// @desc    Get user's favorites
// @access  Private
router.get('/', authenticate, async (req, res) => {
    try {
        const favorites = await prisma.favorite.findMany({
            where: { userId: req.user.id },
            include: {
                channel: true,
                video: true
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            success: true,
            data: { favorites }
        });
    } catch (error) {
        console.error('Get favorites error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/favorites/channel/:channelId
// @desc    Add channel to favorites
// @access  Private
router.post('/channel/:channelId', authenticate, async (req, res) => {
    try {
        const { channelId } = req.params;

        const channel = await prisma.channel.findUnique({
            where: { id: channelId }
        });

        if (!channel) {
            return res.status(404).json({
                success: false,
                message: 'Channel not found'
            });
        }

        const existing = await prisma.favorite.findFirst({
            where: {
                userId: req.user.id,
                channelId
            }
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Channel already in favorites'
            });
        }

        const favorite = await prisma.favorite.create({
            data: {
                userId: req.user.id,
                channelId
            },
            include: { channel: true }
        });

        res.status(201).json({
            success: true,
            message: 'Channel added to favorites',
            data: { favorite }
        });
    } catch (error) {
        console.error('Add channel favorite error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   POST /api/favorites/video/:videoId
// @desc    Add video to favorites
// @access  Private
router.post('/video/:videoId', authenticate, async (req, res) => {
    try {
        const { videoId } = req.params;

        const video = await prisma.video.findUnique({
            where: { id: videoId }
        });

        if (!video) {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }

        const existing = await prisma.favorite.findFirst({
            where: {
                userId: req.user.id,
                videoId
            }
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Video already in favorites'
            });
        }

        const favorite = await prisma.favorite.create({
            data: {
                userId: req.user.id,
                videoId
            },
            include: { video: true }
        });

        res.status(201).json({
            success: true,
            message: 'Video added to favorites',
            data: { favorite }
        });
    } catch (error) {
        console.error('Add video favorite error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   DELETE /api/favorites/:id
// @desc    Remove from favorites
// @access  Private
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const favorite = await prisma.favorite.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!favorite) {
            return res.status(404).json({
                success: false,
                message: 'Favorite not found'
            });
        }

        await prisma.favorite.delete({
            where: { id: req.params.id }
        });

        res.json({
            success: true,
            message: 'Removed from favorites'
        });
    } catch (error) {
        console.error('Remove favorite error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/favorites/check/:type/:id
// @desc    Check if item is in favorites
// @access  Private
router.get('/check/:type/:id', authenticate, async (req, res) => {
    try {
        const { type, id } = req.params;

        const where = { userId: req.user.id };
        if (type === 'channel') {
            where.channelId = id;
        } else if (type === 'video') {
            where.videoId = id;
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid type. Use "channel" or "video"'
            });
        }

        const favorite = await prisma.favorite.findFirst({ where });

        res.json({
            success: true,
            data: {
                isFavorite: !!favorite,
                favoriteId: favorite?.id || null
            }
        });
    } catch (error) {
        console.error('Check favorite error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;
