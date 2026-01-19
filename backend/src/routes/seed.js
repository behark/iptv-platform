const express = require('express');
const { seed } = require('../scripts/seed-production');
const router = express.Router();

// Temporary endpoint for seeding production
// Remove this after seeding is complete
router.post('/production', async (req, res) => {
    try {
        await seed();
        res.json({
            success: true,
            message: 'Production database seeded successfully'
        });
    } catch (error) {
        console.error('Seeding error:', error);
        res.status(500).json({
            success: false,
            message: 'Seeding failed: ' + error.message
        });
    }
});

module.exports = router;
