const express = require('express');
const { authenticate, authorize, requireSubscription } = require('../middleware/auth');
const prisma = require('../lib/prisma');

const router = express.Router();

// @route   GET /api/channels
// @desc    Get all channels (filtered by subscription)
// @access  Private (requires subscription)
router.get('/', authenticate, requireSubscription, async (req, res) => {
  try {
    const {
      category,
      language,
      country,
      search,
      page = '1',
      limit,
      sort,
      ids,
      priority,
      hasLogo,
      streamType
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
    const filters = [{ isActive: true }];

    // Admin/Moderator can see all channels, regular users see only their plan's channels
    let allowedIds = null;
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MODERATOR') {
      const channelAccess = await prisma.channelAccess.findMany({
        where: {
          planId: req.subscription.planId
        },
        select: { channelId: true }
      });
      allowedIds = channelAccess.map(ca => ca.channelId);
      if (allowedIds.length === 0) {
        return res.json({
          success: true,
          count: 0,
          pagination: {
            page: pageNumber,
            limit: limitNumber,
            total: 0,
            pages: 0,
            hasMore: false
          },
          data: { channels: [] }
        });
      }
    }

    let idFilter = null;
    if (ids !== undefined) {
      const requestedIds = ids
        .split(',')
        .map(id => id.trim())
        .filter(Boolean);
      if (requestedIds.length === 0) {
        return res.json({
          success: true,
          count: 0,
          pagination: {
            page: pageNumber,
            limit: limitNumber,
            total: 0,
            pages: 0,
            hasMore: false
          },
          data: { channels: [] }
        });
      }

      if (allowedIds) {
        const allowedSet = new Set(allowedIds);
        idFilter = requestedIds.filter(id => allowedSet.has(id));
        if (idFilter.length === 0) {
          return res.json({
            success: true,
            count: 0,
            pagination: {
              page: pageNumber,
              limit: limitNumber,
              total: 0,
              pages: 0,
              hasMore: false
            },
            data: { channels: [] }
          });
        }
      } else {
        idFilter = requestedIds;
      }
    } else if (allowedIds) {
      idFilter = allowedIds;
    }

    if (idFilter) {
      filters.push({ id: { in: idFilter } });
    }

    if (category) filters.push({ category });
    if (language) filters.push({ language });
    if (country) filters.push({ country });
    if (search) {
      filters.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ]
      });
    }
    if (hasLogo === 'true') {
      filters.push({ logo: { not: null } });
    }
    if (streamType === 'live') {
      filters.push({ isLive: true });
    } else if (streamType === 'vod') {
      filters.push({ isLive: false });
    }

    const where = { AND: filters };
    const skip = (pageNumber - 1) * limitNumber;

    // Build sort order based on sort parameter
    const usePriority = priority === 'true' && !country;
    const buildOrderBy = () => {
      const base = [];
      if (usePriority) {
        base.push({ sortOrder: 'asc' });
      }
      switch (sort) {
        case 'name-desc':
          base.push({ name: 'desc' });
          break;
        case 'country-asc':
          base.push({ country: 'asc' }, { name: 'asc' });
          break;
        case 'country-desc':
          base.push({ country: 'desc' }, { name: 'asc' });
          break;
        case 'category-asc':
          base.push({ category: 'asc' }, { name: 'asc' });
          break;
        case 'category-desc':
          base.push({ category: 'desc' }, { name: 'asc' });
          break;
        case 'recently-added':
          base.push({ createdAt: 'desc' });
          break;
        case 'name-asc':
        default:
          base.push({ name: 'asc' });
          break;
      }
      return base;
    };
    const orderBy = buildOrderBy();

    const total = await prisma.channel.count({ where });
    const channels = await prisma.channel.findMany({
      where,
      orderBy,
      skip,
      take: limitNumber
    });

    const totalCount = total;
    const totalPages = Math.ceil(totalCount / limitNumber);
    const hasMore = pageNumber < totalPages;

    res.json({
      success: true,
      count: channels.length,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total: totalCount,
        pages: totalPages,
        hasMore
      },
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
      fileExt,
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
        fileExt,
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
    const { name, description, logo, streamUrl, streamType, fileExt, category, language, country, isLive, isActive, epgId, sortOrder } = req.body;
    const channel = await prisma.channel.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(logo !== undefined && { logo }),
        ...(streamUrl !== undefined && { streamUrl }),
        ...(streamType !== undefined && { streamType }),
        ...(fileExt !== undefined && { fileExt }),
        ...(category !== undefined && { category }),
        ...(language !== undefined && { language }),
        ...(country !== undefined && { country }),
        ...(isLive !== undefined && { isLive }),
        ...(isActive !== undefined && { isActive }),
        ...(epgId !== undefined && { epgId }),
        ...(sortOrder !== undefined && { sortOrder })
      }
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
