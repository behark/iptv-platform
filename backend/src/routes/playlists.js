const express = require('express');
const { authenticate, requireSubscription } = require('../middleware/auth');
const prisma = require('../lib/prisma');

const router = express.Router();

// @route   GET /api/playlists
// @desc    Get all playlists
// @access  Private (requires subscription)
router.get('/', authenticate, requireSubscription, async (req, res) => {
  try {
    const playlists = await prisma.playlist.findMany({
      where: { isPublic: true },
      include: {
        channels: {
          include: {
            channel: {
              select: {
                id: true,
                name: true,
                logo: true
              }
            }
          }
        },
        videos: {
          include: {
            video: {
              select: {
                id: true,
                title: true,
                thumbnail: true
              }
            }
          }
        }
      }
    });

    res.json({
      success: true,
      data: { playlists }
    });
  } catch (error) {
    console.error('Get playlists error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
