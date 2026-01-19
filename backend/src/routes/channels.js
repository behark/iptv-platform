const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize, requireSubscription } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// @route   GET /api/channels
// @desc    Get all channels (filtered by subscription)
// @access  Private (requires subscription)
router.get('/', authenticate, requireSubscription, async (req, res) => {
  try {
    const { category, language, country, search } = req.query;

    // Build base filter
    const where = { isActive: true };

    // Admin/Moderator can see all channels, regular users see only their plan's channels
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MODERATOR') {
      // Get channels accessible by user's plan
      const channelAccess = await prisma.channelAccess.findMany({
        where: {
          planId: req.subscription.planId
        }
      });
      const channelIds = channelAccess.map(ca => ca.channelId);
      where.id = { in: channelIds };
    }

    if (category) where.category = category;
    if (language) where.language = language;
    if (country) where.country = country;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const channels = await prisma.channel.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      count: channels.length,
      data: { channels }
    });
  } catch (error) {
    console.error('Get channels error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/channels/:id
// @desc    Get single channel
// @access  Private (requires subscription)
router.get('/:id', authenticate, requireSubscription, async (req, res) => {
  try {
    const channel = await prisma.channel.findUnique({
      where: { id: req.params.id },
      include: {
        epg: {
          where: {
            startTime: { lte: new Date() },
            endTime: { gte: new Date() }
          },
          orderBy: { startTime: 'asc' },
          take: 10
        }
      }
    });

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    // Admin/Moderator can access all channels
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MODERATOR') {
      // Check if user has access to this channel via their subscription
      const hasAccess = await prisma.channelAccess.findFirst({
        where: {
          planId: req.subscription.planId,
          channelId: channel.id
        }
      });

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this channel'
        });
      }
    }

    res.json({
      success: true,
      data: { channel }
    });
  } catch (error) {
    console.error('Get channel error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/channels
// @desc    Create new channel (Admin only)
// @access  Private (Admin)
router.post('/', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const {
      name,
      description,
      logo,
      streamUrl,
      streamType,
      category,
      language,
      country,
      isLive,
      epgId
    } = req.body;

    const channel = await prisma.channel.create({
      data: {
        name,
        description,
        logo,
        streamUrl,
        streamType: streamType || 'HLS',
        category,
        language,
        country,
        isLive: isLive !== undefined ? isLive : true,
        epgId
      }
    });

    res.status(201).json({
      success: true,
      message: 'Channel created successfully',
      data: { channel }
    });
  } catch (error) {
    console.error('Create channel error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/channels/:id
// @desc    Update channel (Admin only)
// @access  Private (Admin)
router.put('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const channel = await prisma.channel.update({
      where: { id: req.params.id },
      data: req.body
    });

    res.json({
      success: true,
      message: 'Channel updated successfully',
      data: { channel }
    });
  } catch (error) {
    console.error('Update channel error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/channels/:id
// @desc    Delete channel (Admin only)
// @access  Private (Admin)
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    await prisma.channel.delete({
      where: { id: req.params.id }
    });

    res.json({
      success: true,
      message: 'Channel deleted successfully'
    });
  } catch (error) {
    console.error('Delete channel error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
