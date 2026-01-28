const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireSubscription } = require('../middleware/auth');
const subtitleService = require('../services/subtitleService');

const router = express.Router();
const prisma = new PrismaClient();

// @route   GET /api/videos
// @desc    Get all videos
// @access  Private (requires subscription)
router.get('/', authenticate, requireSubscription, async (req, res) => {
  try {
    const { category, search, limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      isActive: true
    };

    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

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

// @route   GET /api/videos/:id
// @desc    Get single video
// @access  Private (requires subscription)
router.get('/:id', authenticate, requireSubscription, async (req, res) => {
  try {
    const video = await prisma.video.findUnique({
      where: { id: req.params.id }
    });

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    // Increment view count
    await prisma.video.update({
      where: { id: video.id },
      data: { views: { increment: 1 } }
    });

    // Record watch history
    await prisma.watchHistory.create({
      data: {
        userId: req.user.id,
        videoId: video.id,
        watchedAt: new Date()
      }
    });

    res.json({
      success: true,
      data: { video }
    });
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/videos/:id/subtitle
// @desc    Get subtitle file for a video
// @access  Private (requires subscription)
router.get('/:id/subtitle', authenticate, requireSubscription, async (req, res) => {
  try {
    const video = await prisma.video.findUnique({
      where: { id: req.params.id }
    });

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    if (!video.hasSubtitles) {
      return res.status(404).json({
        success: false,
        message: 'No subtitles available for this video'
      });
    }

    // Try to read subtitle file using sourceId (archive.org identifier)
    const subtitleId = video.sourceId || video.id;
    const content = await subtitleService.readSubtitle(subtitleId);

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Subtitle file not found'
      });
    }

    // Return as SRT file
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${subtitleId}.srt"`);
    res.send(content);
  } catch (error) {
    console.error('Get subtitle error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/videos/with-subtitles
// @desc    Get all videos that have Albanian subtitles
// @access  Private (requires subscription)
router.get('/with-subtitles', authenticate, requireSubscription, async (req, res) => {
  try {
    const { category, limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      isActive: true,
      hasSubtitles: true
    };

    if (category) where.category = category;

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          description: true,
          thumbnail: true,
          duration: true,
          category: true,
          year: true,
          hasSubtitles: true,
          subtitleLanguage: true,
          subtitleSynced: true,
          views: true
        }
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
    console.error('Get videos with subtitles error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
