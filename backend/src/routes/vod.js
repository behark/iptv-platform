const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const archiveService = require('../services/archiveService');
const vodImporter = require('../services/vodImporter');
const prisma = require('../lib/prisma');

const router = express.Router();

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

// Track active import jobs
const activeJobs = new Map();

// ==================== COLLECTIONS ====================

// @route   GET /api/vod/collections
// @desc    Get available Archive.org collections
// @access  Private (Admin)
router.get('/collections',
  authenticate,
  authorize('ADMIN'),
  async (req, res) => {
    try {
      const collections = archiveService.getCollections();
      res.json({
        success: true,
        data: { collections }
      });
    } catch (error) {
      console.error('Get collections error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// @route   GET /api/vod/collections/stats
// @desc    Get collection statistics from Archive.org
// @access  Private (Admin)
router.get('/collections/stats',
  authenticate,
  authorize('ADMIN'),
  async (req, res) => {
    try {
      const stats = await archiveService.getCollectionStats();
      res.json({
        success: true,
        data: { stats }
      });
    } catch (error) {
      console.error('Get collection stats error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// @route   GET /api/vod/collections/:id/browse
// @desc    Browse a specific collection
// @access  Private (Admin)
router.get('/collections/:id/browse',
  authenticate,
  authorize('ADMIN'),
  [
    param('id').notEmpty(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('sort').optional().isIn(['downloads desc', 'date desc', 'title asc', 'avg_rating desc'])
  ],
  validate,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { page = 1, limit = 50, sort = 'downloads desc' } = req.query;

      const result = await archiveService.browseCollection(id, {
        page,
        rows: limit,
        sort
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Browse collection error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// ==================== SEARCH ====================

// @route   GET /api/vod/search
// @desc    Search Archive.org for movies
// @access  Private (Admin)
router.get('/search',
  authenticate,
  authorize('ADMIN'),
  [
    query('q').optional().trim().isLength({ max: 200 }),
    query('collection').optional().trim(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
  ],
  validate,
  async (req, res) => {
    try {
      const { q, collection, page = 1, limit = 50 } = req.query;

      let result;
      if (collection) {
        result = await archiveService.browseCollection(collection, {
          page,
          rows: limit
        });
        if (q) {
          result.items = result.items.filter(item =>
            item.title?.toLowerCase().includes(q.toLowerCase()) ||
            item.description?.toLowerCase().includes(q.toLowerCase())
          );
        }
      } else {
        result = await archiveService.searchAllCollections({
          query: q,
          page,
          rows: limit
        });
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// @route   GET /api/vod/preview/:identifier
// @desc    Preview a movie's metadata before import
// @access  Private (Admin)
router.get('/preview/:identifier',
  authenticate,
  authorize('ADMIN'),
  async (req, res) => {
    try {
      const { identifier } = req.params;
      const metadata = await archiveService.getMetadata(identifier);

      if (!metadata) {
        return res.status(404).json({
          success: false,
          message: 'Movie not found or no video file available'
        });
      }

      const existing = await prisma.video.findFirst({
        where: { sourceType: 'archive', sourceId: identifier }
      });

      res.json({
        success: true,
        data: {
          ...metadata,
          alreadyImported: !!existing,
          existingId: existing?.id
        }
      });
    } catch (error) {
      console.error('Preview error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// ==================== IMPORT ====================

// @route   POST /api/vod/import/single
// @desc    Import a single movie by identifier
// @access  Private (Admin)
router.post('/import/single',
  authenticate,
  authorize('ADMIN'),
  [
    body('identifier').notEmpty().withMessage('Archive.org identifier is required'),
    body('skipExisting').optional().isBoolean().toBoolean(),
    body('syncSubtitles').optional().isBoolean().toBoolean()
  ],
  validate,
  async (req, res) => {
    try {
      const { identifier, skipExisting = true, syncSubtitles = false } = req.body;

      const result = await vodImporter.importById(identifier, {
        skipExisting,
        syncSubtitles
      });

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Movie not found or import failed'
        });
      }

      res.json({
        success: true,
        message: 'Movie imported successfully',
        data: { video: result }
      });
    } catch (error) {
      console.error('Import single error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// @route   POST /api/vod/import/batch
// @desc    Import multiple movies by identifiers
// @access  Private (Admin)
router.post('/import/batch',
  authenticate,
  authorize('ADMIN'),
  [
    body('identifiers').isArray({ min: 1, max: 50 }).withMessage('Provide 1-50 identifiers'),
    body('identifiers.*').isString().notEmpty(),
    body('skipExisting').optional().isBoolean().toBoolean(),
    body('syncSubtitles').optional().isBoolean().toBoolean()
  ],
  validate,
  async (req, res) => {
    try {
      const { identifiers, skipExisting = true, syncSubtitles = false } = req.body;

      const results = {
        success: [],
        failed: [],
        skipped: []
      };

      for (const identifier of identifiers) {
        try {
          if (skipExisting) {
            const existing = await prisma.video.findFirst({
              where: { sourceType: 'archive', sourceId: identifier }
            });
            if (existing) {
              results.skipped.push({ identifier, reason: 'Already exists' });
              continue;
            }
          }

          const video = await vodImporter.importById(identifier, {
            skipExisting,
            syncSubtitles
          });

          if (video) {
            results.success.push({ identifier, videoId: video.id, title: video.title });
          } else {
            results.failed.push({ identifier, reason: 'Not found or no video' });
          }
        } catch (error) {
          results.failed.push({ identifier, reason: error.message });
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      res.json({
        success: true,
        message: `Imported ${results.success.length} movies`,
        data: results
      });
    } catch (error) {
      console.error('Batch import error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// @route   POST /api/vod/import/collection
// @desc    Import movies from a collection
// @access  Private (Admin)
router.post('/import/collection',
  authenticate,
  authorize('ADMIN'),
  [
    body('collection').notEmpty().withMessage('Collection ID is required'),
    body('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    body('skipExisting').optional().isBoolean().toBoolean(),
    body('syncSubtitles').optional().isBoolean().toBoolean()
  ],
  validate,
  async (req, res) => {
    try {
      const { collection, limit = 20, skipExisting = true, syncSubtitles = false } = req.body;

      const jobId = `import_${Date.now()}`;
      activeJobs.set(jobId, {
        status: 'running',
        collection,
        limit,
        progress: 0,
        imported: 0,
        failed: 0,
        skipped: 0,
        startedAt: new Date()
      });

      res.json({
        success: true,
        message: 'Import job started',
        data: { jobId }
      });

      (async () => {
        const job = activeJobs.get(jobId);
        try {
          console.log(`Starting import job for collection: ${collection}, limit: ${limit}`);

          const items = await archiveService.browseCollection(collection, { rows: limit });

          if (!items || !items.items || items.items.length === 0) {
            job.status = 'failed';
            job.error = 'No items found in collection (possible rate limiting)';
            console.log(`Browse collection returned no items for ${collection}`);
            return;
          }

          console.log(`Found ${items.items.length} items to import from ${collection}`);
          job.totalItems = items.items.length;

          for (let i = 0; i < items.items.length; i++) {
            const item = items.items[i];
            job.progress = Math.round(((i + 1) / items.items.length) * 100);
            job.currentItem = item.title || item.sourceId;

            try {
              if (skipExisting) {
                const existing = await prisma.video.findFirst({
                  where: { sourceType: 'archive', sourceId: item.sourceId }
                });
                if (existing) {
                  job.skipped++;
                  console.log(`Skipped (exists): ${item.sourceId}`);
                  continue;
                }
              }

              const metadata = await archiveService.getMetadata(item.sourceId);
              if (metadata) {
                await vodImporter.importMovie(metadata, { skipExisting, syncSubtitles });
                job.imported++;
                console.log(`Imported: ${metadata.title || item.sourceId}`);
              } else {
                job.failed++;
                console.log(`Failed (no metadata): ${item.sourceId}`);
              }
            } catch (error) {
              job.failed++;
              console.log(`Failed: ${item.sourceId} - ${error.message}`);
            }

            await new Promise(resolve => setTimeout(resolve, 3000));
          }

          job.status = 'completed';
          job.completedAt = new Date();
          console.log(`Import job completed: ${job.imported} imported, ${job.skipped} skipped, ${job.failed} failed`);
        } catch (error) {
          job.status = 'failed';
          job.error = error.message;
          console.error(`Import job failed: ${error.message}`);
        }
      })();
    } catch (error) {
      console.error('Collection import error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// @route   GET /api/vod/import/jobs
// @desc    Get active import jobs
// @access  Private (Admin)
router.get('/import/jobs',
  authenticate,
  authorize('ADMIN'),
  async (req, res) => {
    try {
      const jobs = Array.from(activeJobs.entries()).map(([id, job]) => ({
        id,
        ...job
      }));

      res.json({
        success: true,
        data: { jobs }
      });
    } catch (error) {
      console.error('Get jobs error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// @route   GET /api/vod/import/jobs/:id
// @desc    Get specific job status
// @access  Private (Admin)
router.get('/import/jobs/:id',
  authenticate,
  authorize('ADMIN'),
  async (req, res) => {
    try {
      const job = activeJobs.get(req.params.id);

      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job not found'
        });
      }

      res.json({
        success: true,
        data: { id: req.params.id, ...job }
      });
    } catch (error) {
      console.error('Get job error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// ==================== VOD STATS ====================

// @route   GET /api/vod/stats
// @desc    Get VOD library statistics
// @access  Private (Admin)
router.get('/stats',
  authenticate,
  authorize('ADMIN'),
  async (req, res) => {
    try {
      const [
        total,
        withSubtitles,
        byCategory,
        bySource,
        recentImports
      ] = await Promise.all([
        prisma.video.count({ where: { isActive: true } }),
        prisma.video.count({ where: { isActive: true, hasSubtitles: true } }),
        prisma.video.groupBy({
          by: ['category'],
          where: { isActive: true },
          _count: true,
          orderBy: { _count: { category: 'desc' } }
        }),
        prisma.video.groupBy({
          by: ['sourceType'],
          where: { isActive: true },
          _count: true
        }),
        prisma.video.findMany({
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            title: true,
            category: true,
            sourceType: true,
            hasSubtitles: true,
            createdAt: true
          }
        })
      ]);

      res.json({
        success: true,
        data: {
          total,
          withSubtitles,
          withoutSubtitles: total - withSubtitles,
          categories: byCategory.map(c => ({
            name: c.category || 'Uncategorized',
            count: c._count
          })),
          sources: bySource.map(s => ({
            name: s.sourceType || 'manual',
            count: s._count
          })),
          recentImports
        }
      });
    } catch (error) {
      console.error('Get VOD stats error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// ==================== MANAGE IMPORTED VIDEOS ====================

// @route   DELETE /api/vod/videos/:id
// @desc    Delete a video
// @access  Private (Admin)
router.delete('/videos/:id',
  authenticate,
  authorize('ADMIN'),
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
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: 'Video not found'
        });
      }
      console.error('Delete video error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// @route   PUT /api/vod/videos/:id/toggle
// @desc    Toggle video active status
// @access  Private (Admin)
router.put('/videos/:id/toggle',
  authenticate,
  authorize('ADMIN'),
  async (req, res) => {
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

      const updated = await prisma.video.update({
        where: { id: req.params.id },
        data: { isActive: !video.isActive }
      });

      res.json({
        success: true,
        message: `Video ${updated.isActive ? 'activated' : 'deactivated'}`,
        data: { video: updated }
      });
    } catch (error) {
      console.error('Toggle video error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

module.exports = router;
