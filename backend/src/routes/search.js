const express = require('express');
const { query, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/search
// @desc    Search across channels and videos
// @access  Private
router.get('/',
  authenticate,
  [
    query('q').trim().isLength({ min: 1, max: 100 }).withMessage('Search query is required'),
    query('type').optional().isIn(['all', 'channels', 'videos']).withMessage('Invalid type'),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
    query('page').optional().isInt({ min: 1 }).toInt()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { q, type = 'all', limit = 20, page = 1 } = req.query;
      const skip = (page - 1) * limit;
      const searchQuery = q.toLowerCase();

      const results = {
        channels: [],
        videos: [],
        total: 0
      };

      // Search channels
      if (type === 'all' || type === 'channels') {
        const channelWhere = {
          isActive: true,
          OR: [
            { name: { contains: searchQuery, mode: 'insensitive' } },
            { description: { contains: searchQuery, mode: 'insensitive' } },
            { category: { contains: searchQuery, mode: 'insensitive' } }
          ]
        };

        const [channels, channelCount] = await Promise.all([
          prisma.channel.findMany({
            where: channelWhere,
            select: {
              id: true,
              name: true,
              description: true,
              logo: true,
              category: true,
              country: true,
              isLive: true
            },
            skip: type === 'channels' ? skip : 0,
            take: type === 'channels' ? limit : Math.min(limit, 10),
            orderBy: { name: 'asc' }
          }),
          prisma.channel.count({ where: channelWhere })
        ]);

        results.channels = channels;
        results.channelCount = channelCount;
      }

      // Search videos
      if (type === 'all' || type === 'videos') {
        const videoWhere = {
          isActive: true,
          OR: [
            { title: { contains: searchQuery, mode: 'insensitive' } },
            { description: { contains: searchQuery, mode: 'insensitive' } },
            { category: { contains: searchQuery, mode: 'insensitive' } }
          ]
        };

        const [videos, videoCount] = await Promise.all([
          prisma.video.findMany({
            where: videoWhere,
            select: {
              id: true,
              title: true,
              description: true,
              thumbnail: true,
              duration: true,
              category: true,
              views: true
            },
            skip: type === 'videos' ? skip : 0,
            take: type === 'videos' ? limit : Math.min(limit, 10),
            orderBy: { title: 'asc' }
          }),
          prisma.video.count({ where: videoWhere })
        ]);

        results.videos = videos;
        results.videoCount = videoCount;
      }

      results.total = (results.channelCount || 0) + (results.videoCount || 0);

      res.json({
        success: true,
        data: results,
        pagination: {
          page,
          limit,
          total: type === 'channels' ? results.channelCount :
                 type === 'videos' ? results.videoCount : results.total
        }
      });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during search'
      });
    }
  }
);

module.exports = router;
