const express = require('express');
const { body, query, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { normalizeMac } = require('../utils/mac');

const router = express.Router();

const validStatuses = ['PENDING', 'ACTIVE', 'REVOKED'];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

// @route   GET /api/devices
// @desc    List the authenticated user's registered devices
// @access  Private
router.get('/',
  authenticate,
  [
    query('status').optional().isIn(validStatuses),
    query('search').optional().trim().isLength({ max: 100 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { status, search } = req.query;
      const where = { userId: req.user.id };
      if (status) {
        where.status = status;
      }
      if (search) {
        where.OR = [
          { macAddress: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } }
        ];
      }

      const devices = await prisma.device.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      });

      res.json({
        success: true,
        data: { devices }
      });
    } catch (error) {
      console.error('List devices error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   POST /api/devices
// @desc    Register a new device (MAC)
// @access  Private
router.post('/',
  authenticate,
  [
    body('macAddress').notEmpty().withMessage('MAC address is required'),
    body('name').optional().trim().isLength({ max: 100 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const normalizedMac = normalizeMac(req.body.macAddress);
      if (!normalizedMac) {
        return res.status(400).json({
          success: false,
          message: 'Invalid MAC address format'
        });
      }

      const name = req.body.name ? req.body.name.trim() : null;
      const device = await prisma.device.upsert({
        where: {
          userId_macAddress: {
            userId: req.user.id,
            macAddress: normalizedMac
          }
        },
        update: {
          name,
          status: 'ACTIVE'
        },
        create: {
          userId: req.user.id,
          macAddress: normalizedMac,
          name,
          status: 'ACTIVE'
        }
      });

      res.status(201).json({
        success: true,
        data: { device }
      });
    } catch (error) {
      console.error('Register device error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

module.exports = router;
