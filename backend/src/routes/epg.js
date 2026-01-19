const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireSubscription } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// @route   GET /api/epg/:channelId
// @desc    Get EPG for a channel
// @access  Private (requires subscription)
router.get('/:channelId', authenticate, requireSubscription, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    const epg = await prisma.ePGEntry.findMany({
      where: {
        channelId: req.params.channelId,
        startTime: { gte: start },
        endTime: { lte: end }
      },
      orderBy: { startTime: 'asc' }
    });

    res.json({
      success: true,
      data: { epg }
    });
  } catch (error) {
    console.error('Get EPG error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
