const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        avatar: true,
        createdAt: true
      }
    });

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile',
  authenticate,
  [
    body('username').optional().trim().isLength({ min: 3, max: 20 })
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
    body('firstName').optional().trim().isLength({ max: 50 }),
    body('lastName').optional().trim().isLength({ max: 50 })
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

      const { username, firstName, lastName } = req.body;

      if (username) {
        const existingUser = await prisma.user.findFirst({
          where: {
            username,
            id: { not: req.user.id }
          }
        });

        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'Username is already taken'
          });
        }
      }

      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          ...(username && { username }),
          ...(firstName !== undefined && { firstName }),
          ...(lastName !== undefined && { lastName })
        },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          avatar: true
        }
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { user }
      });
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   PUT /api/users/password
// @desc    Change user password
// @access  Private
router.put('/password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[a-z]/).withMessage('Password must contain a lowercase letter')
      .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
      .matches(/[0-9]/).withMessage('Password must contain a number')
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

      const { currentPassword, newPassword } = req.body;

      const user = await prisma.user.findUnique({
        where: { id: req.user.id }
      });

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);

      await prisma.user.update({
        where: { id: req.user.id },
        data: { password: hashedPassword }
      });

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Password change error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   DELETE /api/users/account
// @desc    Delete user account
// @access  Private
router.delete('/account',
  authenticate,
  [
    body('password').notEmpty().withMessage('Password is required to confirm deletion')
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

      const { password } = req.body;

      const user = await prisma.user.findUnique({
        where: { id: req.user.id }
      });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Incorrect password'
        });
      }

      await prisma.user.delete({
        where: { id: req.user.id }
      });

      res.json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      console.error('Account deletion error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/users/activity
// @desc    Get user activity log
// @access  Private
router.get('/activity', authenticate, async (req, res) => {
  try {
    const [watchHistory, favorites, subscription] = await Promise.all([
      prisma.watchHistory.findMany({
        where: { userId: req.user.id },
        include: {
          video: {
            select: { id: true, title: true, thumbnail: true }
          },
          channel: {
            select: { id: true, name: true, logo: true }
          }
        },
        orderBy: { watchedAt: 'desc' },
        take: 20
      }),
      prisma.favorite.findMany({
        where: { userId: req.user.id },
        include: {
          video: {
            select: { id: true, title: true, thumbnail: true }
          },
          channel: {
            select: { id: true, name: true, logo: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      prisma.subscription.findFirst({
        where: {
          userId: req.user.id,
          status: 'ACTIVE'
        },
        include: { plan: true }
      })
    ]);

    res.json({
      success: true,
      data: {
        watchHistory,
        favorites,
        subscription
      }
    });
  } catch (error) {
    console.error('Activity fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
