const express = require('express');
const router = express.Router();
const buyerController = require('../controllers/buyerController');
const { requireAuth } = require('../middleware/requireAuth');
const { requireRole } = require('../middleware/requireRole');

// Marketplace catalog is publicly viewable
router.get('/marketplace', buyerController.getMarketplace);
router.get('/lots', buyerController.getMarketplace);

// Orders require BUYER authentication
router.post('/orders', requireAuth, requireRole(['buyer']), buyerController.placeOrder);
router.post('/checkout', requireAuth, requireRole(['buyer']), buyerController.placeOrder);
router.get('/orders', requireAuth, requireRole(['buyer']), buyerController.getMyOrders);

// Logistics & Telemetry tracking
router.get('/telemetry/:orderId', buyerController.getOrderTelemetry);

module.exports = router;
