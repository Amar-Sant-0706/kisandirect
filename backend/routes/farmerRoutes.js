const express = require('express');
const router = express.Router();
const farmerController = require('../controllers/farmerController');
const aiController = require('../controllers/aiController');
const { requireAuth } = require('../middleware/requireAuth');
const { requireRole } = require('../middleware/requireRole');

// All farmer routes require authentication and farmer role
router.use(requireAuth);
router.use(requireRole(['farmer']));

// AI Quality Scanner ("Kisan-Vision")
router.post('/ai-quality-scan', aiController.runAiQualityScan);

// AI Demand & Price Advisory (Farmer Edition)
router.get('/market-advisory', aiController.getMarketAdvisory);

// Crop / Batch Management
router.post('/crops', farmerController.createCrop);
router.get('/crops', farmerController.getMyCrops);
router.post('/batches', farmerController.createCrop);
router.get('/batches', farmerController.getMyCrops);

// Payout & Reefer Dispatch Ledger
router.get('/payouts', farmerController.getPayouts);

module.exports = router;
