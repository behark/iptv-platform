const express = require('express');
const bcrypt = require('bcryptjs');
const { body, param, query, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

// Common validators
const paginationValidators = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
];

const uuidValidator = param('id').isUUID().withMessage('Invalid ID format');
const deviceStatusValues = ['PENDING', 'ACTIVE', 'REVOKED'];

// ==================== USER MANAGEMENT ====================

// @route   GET /api/admin/users
// @desc    Get all users (Admin only)
// @access  Private (Admin)
router.get('/users',
  authenticate,
  authorize('ADMIN'),
  [
    ...paginationValidators,
    query('search').optional().trim().isLength({ max: 100 }),
    query('role').optional().isIn(['USER', 'ADMIN', 'MODERATOR']),
    query('isActive').optional().isBoolean().toBoolean()
  ],
  validate,
  async (req, res) => {
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
      if (isActive !== undefined) where.isActive = isActive;

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
  }
);

// @route   GET /api/admin/users/:id
// @desc    Get single user (Admin only)
// @access  Private (Admin)
router.get('/users/:id',
  authenticate,
  authorize('ADMIN'),
  [uuidValidator],
  validate,
  async (req, res) => {
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
  }
);

// @route   PUT /api/admin/users/:id
// @desc    Update user (Admin only)
// @access  Private (Admin)
router.put('/users/:id',
  authenticate,
  authorize('ADMIN'),
  [
    uuidValidator,
    body('email').optional().isEmail().normalizeEmail(),
    body('username').optional().trim().isLength({ min: 3, max: 20 }),
    body('firstName').optional().trim().isLength({ max: 50 }),
    body('lastName').optional().trim().isLength({ max: 50 }),
    body('role').optional().isIn(['USER', 'ADMIN', 'MODERATOR']),
    body('isActive').optional().isBoolean()
  ],
  validate,
  async (req, res) => {
    try {
      const { email, username, firstName, lastName, role, isActive } = req.body;

      // Check if email/username already exists for another user
      if (email || username) {
        const existingUser = await prisma.user.findFirst({
          where: {
            AND: [
              { id: { not: req.params.id } },
              {
                OR: [
                  ...(email ? [{ email }] : []),
                  ...(username ? [{ username }] : [])
                ]
              }
            ]
          }
        });

        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'Email or username already in use'
          });
        }
      }

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
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   DELETE /api/admin/users/:id
// @desc    Delete user (Admin only)
// @access  Private (Admin)
router.delete('/users/:id',
  authenticate,
  authorize('ADMIN'),
  [uuidValidator],
  validate,
  async (req, res) => {
    try {
      // Prevent self-deletion
      if (req.params.id === req.user.id) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete your own account'
        });
      }

      await prisma.user.delete({
        where: { id: req.params.id }
      });

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      console.error('Delete user error:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ==================== VIDEO MANAGEMENT ====================

// @route   GET /api/admin/videos
// @desc    Get all videos (Admin only)
// @access  Private (Admin)
router.get('/videos',
  authenticate,
  authorize('ADMIN'),
  [
    ...paginationValidators,
    query('search').optional().trim().isLength({ max: 100 }),
    query('category').optional().trim().isLength({ max: 50 }),
    query('isActive').optional().isBoolean().toBoolean()
  ],
  validate,
  async (req, res) => {
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
      if (isActive !== undefined) where.isActive = isActive;

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
  }
);

// @route   POST /api/admin/videos
// @desc    Create new video (Admin only)
// @access  Private (Admin)
router.post('/videos',
  authenticate,
  authorize('ADMIN'),
  [
    body('title').trim().notEmpty().isLength({ max: 255 }).withMessage('Title is required'),
    body('description').optional().trim().isLength({ max: 2000 }),
    body('thumbnail').optional().isURL().withMessage('Invalid thumbnail URL'),
    body('videoUrl').isURL().withMessage('Valid video URL is required'),
    body('duration').optional().isInt({ min: 0 }),
    body('category').optional().trim().isLength({ max: 50 }),
    body('tags').optional().isArray(),
    body('tags.*').optional().isString().isLength({ max: 50 })
  ],
  validate,
  async (req, res) => {
    try {
      const { title, description, thumbnail, videoUrl, duration, category, tags } = req.body;

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
  }
);

// @route   PUT /api/admin/videos/:id
// @desc    Update video (Admin only)
// @access  Private (Admin)
router.put('/videos/:id',
  authenticate,
  authorize('ADMIN'),
  [
    uuidValidator,
    body('title').optional().trim().isLength({ min: 1, max: 255 }),
    body('description').optional().trim().isLength({ max: 2000 }),
    body('thumbnail').optional().isURL().withMessage('Invalid thumbnail URL'),
    body('videoUrl').optional().isURL().withMessage('Invalid video URL'),
    body('duration').optional().isInt({ min: 0 }),
    body('category').optional().trim().isLength({ max: 50 }),
    body('tags').optional().isArray(),
    body('tags.*').optional().isString().isLength({ max: 50 }),
    body('isActive').optional().isBoolean()
  ],
  validate,
  async (req, res) => {
    try {
      const { title, description, thumbnail, videoUrl, duration, category, tags, isActive } = req.body;

      const video = await prisma.video.update({
        where: { id: req.params.id },
        data: {
          ...(title && { title }),
          ...(description !== undefined && { description }),
          ...(thumbnail !== undefined && { thumbnail }),
          ...(videoUrl && { videoUrl }),
          ...(duration !== undefined && { duration }),
          ...(category !== undefined && { category }),
          ...(tags && { tags }),
          ...(isActive !== undefined && { isActive })
        }
      });

      res.json({
        success: true,
        message: 'Video updated successfully',
        data: { video }
      });
    } catch (error) {
      console.error('Update video error:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: 'Video not found'
        });
      }
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   DELETE /api/admin/videos/:id
// @desc    Delete video (Admin only)
// @access  Private (Admin)
router.delete('/videos/:id',
  authenticate,
  authorize('ADMIN'),
  [uuidValidator],
  validate,
  async (req, res) => {
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
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: 'Video not found'
        });
      }
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ==================== SUBSCRIPTION MANAGEMENT ====================

// @route   POST /api/admin/subscriptions
// @desc    Create subscription for user (Admin only)
// @access  Private (Admin)
router.post('/subscriptions',
  authenticate,
  authorize('ADMIN'),
  [
    body('userId').isUUID().withMessage('Valid user ID is required'),
    body('planId').isUUID().withMessage('Valid plan ID is required'),
    body('endDate').optional().isISO8601().withMessage('Invalid date format')
  ],
  validate,
  async (req, res) => {
    try {
      const { userId, planId, endDate } = req.body;

      const [user, plan] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.plan.findUnique({ where: { id: planId } })
      ]);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!plan) {
        return res.status(404).json({
          success: false,
          message: 'Plan not found'
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
  }
);

// @route   PUT /api/admin/subscriptions/:id
// @desc    Update subscription (Admin only)
// @access  Private (Admin)
router.put('/subscriptions/:id',
  authenticate,
  authorize('ADMIN'),
  [
    uuidValidator,
    body('status').optional().isIn(['ACTIVE', 'CANCELLED', 'EXPIRED', 'PENDING']),
    body('endDate').optional().isISO8601().withMessage('Invalid date format')
  ],
  validate,
  async (req, res) => {
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
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: 'Subscription not found'
        });
      }
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

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
router.post('/plans',
  authenticate,
  authorize('ADMIN'),
  [
    body('name').trim().notEmpty().isLength({ max: 100 }).withMessage('Name is required'),
    body('description').optional().trim().isLength({ max: 500 }),
    body('price').isFloat({ min: 0 }).withMessage('Valid price is required'),
    body('currency').optional().isLength({ min: 3, max: 3 }).isAlpha().toUpperCase(),
    body('duration').isInt({ min: 1 }).withMessage('Duration must be at least 1 day'),
    body('features').optional().isArray(),
    body('features.*').optional().isString().isLength({ max: 200 })
  ],
  validate,
  async (req, res) => {
    try {
      const { name, description, price, currency, duration, features } = req.body;

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
  }
);

// @route   PUT /api/admin/plans/:id
// @desc    Update plan (Admin only)
// @access  Private (Admin)
router.put('/plans/:id',
  authenticate,
  authorize('ADMIN'),
  [
    param('id').notEmpty().withMessage('Plan ID is required'),
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('price').optional().isFloat({ min: 0 }),
    body('currency').optional().isLength({ min: 3, max: 3 }).isAlpha().toUpperCase(),
    body('duration').optional().isInt({ min: 1 }),
    body('features').optional().isArray(),
    body('features.*').optional().isString().isLength({ max: 200 }),
    body('isActive').optional().isBoolean()
  ],
  validate,
  async (req, res) => {
    try {
      const { name, description, price, currency, duration, features, isActive } = req.body;

      const plan = await prisma.plan.update({
        where: { id: req.params.id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(price !== undefined && { price }),
          ...(currency && { currency }),
          ...(duration && { duration }),
          ...(features && { features }),
          ...(isActive !== undefined && { isActive })
        }
      });

      res.json({
        success: true,
        message: 'Plan updated successfully',
        data: { plan }
      });
    } catch (error) {
      console.error('Update plan error:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: 'Plan not found'
        });
      }
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   DELETE /api/admin/plans/:id
// @desc    Delete plan (Admin only)
// @access  Private (Admin)
router.delete('/plans/:id',
  authenticate,
  authorize('ADMIN'),
  [param('id').notEmpty().withMessage('Plan ID is required')],
  validate,
  async (req, res) => {
    try {
      // Check if plan has active subscriptions
      const activeSubscriptions = await prisma.subscription.count({
        where: { planId: req.params.id, status: 'ACTIVE' }
      });

      if (activeSubscriptions > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete plan with ${activeSubscriptions} active subscription(s)`
        });
      }

      await prisma.plan.delete({
        where: { id: req.params.id }
      });

      res.json({
        success: true,
        message: 'Plan deleted successfully'
      });
    } catch (error) {
      console.error('Delete plan error:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: 'Plan not found'
        });
      }
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/admin/plans/:id/assign-all-channels
// @desc    Assign all active channels to a plan (Admin only)
// @access  Private (Admin)
router.post('/plans/:id/assign-all-channels',
  authenticate,
  authorize('ADMIN'),
  [param('id').notEmpty().withMessage('Plan ID is required')],
  validate,
  async (req, res) => {
    try {
      const planId = req.params.id;

      // Verify plan exists
      const plan = await prisma.plan.findUnique({ where: { id: planId } });
      if (!plan) {
        return res.status(404).json({
          success: false,
          message: 'Plan not found'
        });
      }

      // Get all active channel IDs
      const channels = await prisma.channel.findMany({
        where: { isActive: true },
        select: { id: true }
      });

      if (channels.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No active channels found'
        });
      }

      // Delete existing channel access for this plan
      await prisma.channelAccess.deleteMany({
        where: { planId }
      });

      // Create channel access records in batches
      const batchSize = 1000;
      let created = 0;

      for (let i = 0; i < channels.length; i += batchSize) {
        const batch = channels.slice(i, i + batchSize);
        const data = batch.map(channel => ({
          planId,
          channelId: channel.id
        }));

        await prisma.channelAccess.createMany({
          data,
          skipDuplicates: true
        });

        created += batch.length;
      }

      res.json({
        success: true,
        message: `Assigned ${created} channels to plan "${plan.name}"`,
        data: {
          planId,
          planName: plan.name,
          channelsAssigned: created
        }
      });
    } catch (error) {
      console.error('Assign all channels error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// ==================== DEVICE MANAGEMENT ====================

const { normalizeMac } = require('../utils/mac');

// @route   POST /api/admin/devices
// @desc    Create device for a user (Admin only)
// @access  Private (Admin)
router.post('/devices',
  authenticate,
  authorize('ADMIN'),
  [
    body('userId').isUUID().withMessage('Valid user ID is required'),
    body('macAddress').notEmpty().withMessage('MAC address is required'),
    body('name').optional().trim().isLength({ max: 100 }),
    body('status').optional().isIn(deviceStatusValues)
  ],
  validate,
  async (req, res) => {
    try {
      const { userId, macAddress, name, status } = req.body;

      const normalizedMac = normalizeMac(macAddress);
      if (!normalizedMac) {
        return res.status(400).json({
          success: false,
          message: 'Invalid MAC address format'
        });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const device = await prisma.device.upsert({
        where: {
          userId_macAddress: {
            userId,
            macAddress: normalizedMac
          }
        },
        update: {
          name: name || null,
          status: status || 'ACTIVE'
        },
        create: {
          userId,
          macAddress: normalizedMac,
          name: name || null,
          status: status || 'ACTIVE'
        },
        include: {
          user: { select: { id: true, email: true, username: true } }
        }
      });

      res.status(201).json({
        success: true,
        message: 'Device registered successfully',
        data: { device }
      });
    } catch (error) {
      console.error('Admin create device error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/admin/devices
// @desc    List registered devices (Admin only)
// @access  Private (Admin)
router.get('/devices',
  authenticate,
  authorize('ADMIN'),
  [
    query('status').optional().isIn(deviceStatusValues),
    query('search').optional().trim().isLength({ max: 100 }),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
  ],
  validate,
  async (req, res) => {
    try {
      const { status, search, page = 1, limit = 20 } = req.query;
      const take = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
      const skip = (parseInt(page, 10) - 1) * take;

      const where = {};
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { macAddress: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } }
        ];
      }

      const [devices, total] = await Promise.all([
        prisma.device.findMany({
          where,
          include: {
            user: {
              select: { id: true, email: true, username: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take
        }),
        prisma.device.count({ where })
      ]);

      res.json({
        success: true,
        pagination: {
          page: parseInt(page, 10),
          limit: take,
          total,
          pages: Math.ceil(total / take)
        },
        data: { devices }
      });
    } catch (error) {
      console.error('Admin list devices error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/admin/devices/lookup/:mac
// @desc    Lookup device by MAC and get Smart IPTV URLs (Admin only)
// @access  Private (Admin)
router.get('/devices/lookup/:mac',
  authenticate,
  authorize('ADMIN'),
  async (req, res) => {
    try {
      const normalizedMac = normalizeMac(req.params.mac);
      if (!normalizedMac) {
        return res.status(400).json({
          success: false,
          message: 'Invalid MAC address format'
        });
      }

      const device = await prisma.device.findFirst({
        where: { macAddress: normalizedMac },
        include: {
          user: { select: { id: true, email: true, username: true } },
          playlistToken: true
        }
      });

      if (!device) {
        return res.json({
          success: true,
          data: {
            found: false,
            macAddress: normalizedMac
          }
        });
      }

      // Build URLs
      const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
      const encodedMac = encodeURIComponent(normalizedMac);

      const urls = {
        playlist: `${baseUrl}/api/exports/tv/playlist/${normalizedMac}`,
        epg: `${baseUrl}/api/exports/tv/epg/${normalizedMac}`
      };

      if (device.playlistToken) {
        urls.directPlaylist = `${baseUrl}/api/exports/m3u?token=${device.playlistToken.token}&mac=${encodedMac}`;
        urls.directEpg = `${baseUrl}/api/exports/epg.xml?token=${device.playlistToken.token}&mac=${encodedMac}`;
      }

      res.json({
        success: true,
        data: {
          found: true,
          device: {
            id: device.id,
            macAddress: device.macAddress,
            name: device.name,
            status: device.status,
            createdAt: device.createdAt,
            user: device.user
          },
          urls,
          smartIptv: {
            uploadPage: 'https://siptv.app/mylist/',
            instructions: `Go to siptv.app/mylist, enter MAC: ${normalizedMac}, paste playlist URL, and click Send.`
          }
        }
      });
    } catch (error) {
      console.error('Lookup device error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/admin/devices/activate
// @desc    Quick activation - register device and get Smart IPTV URLs (Admin only)
// @access  Private (Admin)
router.post('/devices/activate',
  authenticate,
  authorize('ADMIN'),
  [
    body('macAddress').notEmpty().withMessage('MAC address is required'),
    body('name').optional().trim().isLength({ max: 100 }),
    body('planId').optional().trim(),
    body('subscriptionDays').optional().isInt({ min: 1, max: 365 }).toInt()
  ],
  validate,
  async (req, res) => {
    try {
      const { macAddress, name, planId, subscriptionDays = 30 } = req.body;

      const normalizedMac = normalizeMac(macAddress);
      if (!normalizedMac) {
        return res.status(400).json({
          success: false,
          message: 'Invalid MAC address format'
        });
      }

      let targetUserId = req.user.id;
      let subscription = null;
      let createdUser = null;

      // If a plan is specified (not "admin"), create/find user and subscription
      if (planId && planId !== 'admin') {
        // Verify plan exists
        const plan = await prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) {
          return res.status(404).json({
            success: false,
            message: 'Plan not found'
          });
        }

        // Create a user based on MAC address (or find existing)
        const macUsername = `tv_${normalizedMac.replace(/:/g, '').toLowerCase()}`;
        const macEmail = `${macUsername}@device.local`;

        let user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: macEmail },
              { username: macUsername }
            ]
          }
        });

        if (!user) {
          const bcrypt = require('bcryptjs');
          const hashedPassword = await bcrypt.hash(normalizedMac.replace(/:/g, ''), 10);
          user = await prisma.user.create({
            data: {
              email: macEmail,
              username: macUsername,
              password: hashedPassword,
              firstName: 'TV',
              lastName: 'User',
              role: 'USER',
              isActive: true
            }
          });
          createdUser = user;
        }

        targetUserId = user.id;

        // Cancel existing subscriptions and create new one
        await prisma.subscription.updateMany({
          where: { userId: user.id, status: 'ACTIVE' },
          data: { status: 'CANCELLED' }
        });

        const endDate = new Date();
        endDate.setDate(endDate.getDate() + subscriptionDays);

        subscription = await prisma.subscription.create({
          data: {
            userId: user.id,
            planId: plan.id,
            status: 'ACTIVE',
            endDate
          },
          include: { plan: true }
        });
      }

      // Register device under target user
      const device = await prisma.device.upsert({
        where: {
          userId_macAddress: {
            userId: targetUserId,
            macAddress: normalizedMac
          }
        },
        update: {
          name: name || `Smart TV ${normalizedMac}`,
          status: 'ACTIVE'
        },
        create: {
          userId: targetUserId,
          macAddress: normalizedMac,
          name: name || `Smart TV ${normalizedMac}`,
          status: 'ACTIVE'
        }
      });

      // Create or get playlist token
      const crypto = require('crypto');
      let tokenRecord = await prisma.playlistToken.findUnique({
        where: { deviceId: device.id }
      });

      if (!tokenRecord) {
        const token = crypto.randomBytes(32).toString('hex');
        tokenRecord = await prisma.playlistToken.create({
          data: {
            userId: targetUserId,
            deviceId: device.id,
            token
          }
        });
      }

      // Build URLs
      const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
      const encodedMac = encodeURIComponent(normalizedMac);

      const playlistUrl = `${baseUrl}/api/exports/tv/playlist/${normalizedMac}`;
      const epgUrl = `${baseUrl}/api/exports/tv/epg/${normalizedMac}`;
      const directPlaylistUrl = `${baseUrl}/api/exports/m3u?token=${tokenRecord.token}&mac=${encodedMac}`;
      const directEpgUrl = `${baseUrl}/api/exports/epg.xml?token=${tokenRecord.token}&mac=${encodedMac}`;

      // Smart IPTV upload page URL (user will need to manually submit due to captcha)
      const smartIptvUploadUrl = 'https://siptv.app/mylist/';

      res.status(201).json({
        success: true,
        message: 'Device activated successfully',
        data: {
          device: {
            id: device.id,
            macAddress: normalizedMac,
            name: device.name,
            status: device.status
          },
          user: createdUser ? {
            id: createdUser.id,
            email: createdUser.email,
            username: createdUser.username,
            isNew: true
          } : null,
          subscription: subscription ? {
            id: subscription.id,
            planName: subscription.plan.name,
            endDate: subscription.endDate,
            status: subscription.status
          } : null,
          accessType: planId === 'admin' || !planId ? 'Admin (Full Access)' : subscription?.plan?.name,
          urls: {
            // Simple URLs for Smart IPTV (auto-redirect)
            playlist: playlistUrl,
            epg: epgUrl,
            // Direct URLs with token
            directPlaylist: directPlaylistUrl,
            directEpg: directEpgUrl
          },
          smartIptv: {
            uploadPage: smartIptvUploadUrl,
            instructions: `Go to ${smartIptvUploadUrl}, enter MAC: ${normalizedMac}, paste playlist URL, and click Send. Then restart the TV app.`
          }
        }
      });
    } catch (error) {
      console.error('Quick activate device error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   PUT /api/admin/devices/:id
// @desc    Update device status/name (Admin only)
// @access  Private (Admin)
router.put('/devices/:id',
  authenticate,
  authorize('ADMIN'),
  [
    uuidValidator,
    body('name').optional().trim().isLength({ max: 100 }),
    body('status').optional().isIn(deviceStatusValues)
  ],
  validate,
  async (req, res) => {
    try {
      const { name, status } = req.body;
      const data = {};
      if (name !== undefined) {
        data.name = name || null;
      }
      if (status) {
        data.status = status;
      }

      const device = await prisma.device.update({
        where: { id: req.params.id },
        data,
        include: {
          user: { select: { id: true, email: true, username: true } }
        }
      });

      res.json({
        success: true,
        message: 'Device updated successfully',
        data: { device }
      });
    } catch (error) {
      console.error('Admin update device error:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: 'Device not found'
        });
      }
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

module.exports = router;
