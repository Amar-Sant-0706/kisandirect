const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/ownerController');
const aiController = require('../controllers/aiController');
const { requireAuth } = require('../middleware/requireAuth');
const { requireRole } = require('../middleware/requireRole');

// All owner routes require authentication and OWNER role
router.use(requireAuth);
router.use(requireRole(['owner']));

// Live Activity & Audit Feed
router.get('/live-feed', ownerController.getLiveFeed);

// Double-Approval Verification Queue
router.get('/pending-orders', ownerController.getPendingTransactions);
router.get('/pending-transactions', ownerController.getPendingTransactions);
router.post('/orders/:id/verify', ownerController.handleTransactionAction);
router.post('/transactions/:id/action', ownerController.handleTransactionAction);

// Admin Portal Compatibility Endpoints
router.get('/dashboard-metrics', ownerController.getDashboardMetrics);
router.get('/pending-users', ownerController.getPendingUsers);
router.post('/approve-user/:id', ownerController.approveUser);
router.post('/reject-user/:id', ownerController.rejectUser);
router.get('/all-orders', ownerController.getAllOrders);
router.put('/orders/:id/status', ownerController.updateOrderStatus);

// User Moderation & Profile Dismissal Deck
router.get('/users', ownerController.getUsers);
router.patch('/users/:id/dismiss', ownerController.dismissUser);

// AI Modules for Owner Control Room
router.get('/fleet-optimizer', aiController.getFleetOptimizer);
router.get('/market-surveillance', aiController.getMarketSurveillance);

module.exports = router;
