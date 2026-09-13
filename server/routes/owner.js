const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

// All endpoints in this router strictly require OWNER or ADMIN privileges
router.use(verifyToken);
router.use(requireRole(['OWNER', 'ADMIN']));

/**
 * GET /api/owner/pending-users
 * Returns list of farmers and buyers waiting for approval
 */
router.get('/pending-users', (req, res) => {
  try {
    const pendingUsers = db.prepare(`
      SELECT 
        id, name, email, role, approval_status, phone, state_district, district_state,
        farmer_details, buyer_details, business_name, gstin_number, fssai_license,
        created_at
      FROM users
      WHERE approval_status = 'PENDING_APPROVAL'
      ORDER BY created_at ASC
    `).all();

    // Parse JSON details if stored as string
    const formatted = pendingUsers.map(u => {
      let parsedFarmer = {};
      let parsedBuyer = {};
      try { if (u.farmer_details) parsedFarmer = JSON.parse(u.farmer_details); } catch (e) {}
      try { if (u.buyer_details) parsedBuyer = JSON.parse(u.buyer_details); } catch (e) {}

      return {
        ...u,
        farmer_details: parsedFarmer,
        buyer_details: parsedBuyer
      };
    });

    const farmers = formatted.filter(u => u.role.toUpperCase() === 'FARMER' || u.role.toUpperCase() === 'FPO_MEMBER');
    const buyers = formatted.filter(u => u.role.toUpperCase() === 'BUYER' || u.role.toUpperCase() === 'B2B_BUYER' || u.role.toUpperCase() === 'CONSUMER');

    res.json({
      success: true,
      count: formatted.length,
      farmers,
      buyers,
      pendingFarmers: farmers,
      pendingBuyers: buyers,
      pendingUsers: formatted
    });
  } catch (err) {
    console.error('Error fetching pending users for owner:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/owner/approve-user/:id
 * Sets approval_status = 'APPROVED'
 */
router.post('/approve-user/:id', (req, res) => {
  try {
    const userId = req.params.id;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User account not found' });
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE users 
      SET approval_status = 'APPROVED', kyc_status = 'APPROVED', approved_at = ?
      WHERE id = ?
    `).run(now, userId);

    // Audit log
    try {
      db.prepare(`
        INSERT INTO audit_logs (id, actor_id, action_description, timestamp)
        VALUES (?, ?, ?, ?)
      `).run(`AUD-${Date.now()}`, req.user.id, `Owner ${req.user.name} approved user ${user.name} (${user.email}) as ${user.role}`, now);
    } catch (e) {}

    const updatedUser = db.prepare(`
      SELECT id, name, email, role, approval_status, approved_at, phone, state_district
      FROM users WHERE id = ?
    `).get(userId);

    res.json({
      success: true,
      message: `User ${user.name} (${user.role}) has been successfully APPROVED!`,
      user: updatedUser
    });
  } catch (err) {
    console.error('Error approving user:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/owner/reject-user/:id
 * Sets approval_status = 'REJECTED'
 */
router.post('/reject-user/:id', (req, res) => {
  try {
    const userId = req.params.id;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User account not found' });
    }

    db.prepare(`
      UPDATE users 
      SET approval_status = 'REJECTED', kyc_status = 'REJECTED'
      WHERE id = ?
    `).run(userId);

    const now = new Date().toISOString();
    try {
      db.prepare(`
        INSERT INTO audit_logs (id, actor_id, action_description, timestamp)
        VALUES (?, ?, ?, ?)
      `).run(`AUD-${Date.now()}`, req.user.id, `Owner ${req.user.name} rejected user ${user.name} (${user.email})`, now);
    } catch (e) {}

    res.json({
      success: true,
      message: `User ${user.name} (${user.role}) has been REJECTED.`,
      userId
    });
  } catch (err) {
    console.error('Error rejecting user:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/owner/dashboard-metrics
 * Returns: Total Farmers Approved, Total Buyers Approved, Total Active Transactions, GMV
 */
router.get('/dashboard-metrics', (req, res) => {
  try {
    const totalFarmersApproved = db.prepare(`
      SELECT COUNT(*) as count FROM users 
      WHERE UPPER(role) IN ('FARMER', 'FPO_MEMBER') AND approval_status = 'APPROVED'
    `).get().count;

    const totalBuyersApproved = db.prepare(`
      SELECT COUNT(*) as count FROM users 
      WHERE UPPER(role) IN ('BUYER', 'B2B_BUYER', 'CONSUMER') AND approval_status = 'APPROVED'
    `).get().count;

    const totalActiveTransactions = db.prepare(`
      SELECT COUNT(*) as count FROM orders 
      WHERE order_status != 'DELIVERED' AND order_status != 'CANCELLED'
    `).get().count;

    const totalGmv = db.prepare(`
      SELECT COALESCE(SUM(total_price), 0) as gmv FROM orders
    `).get().gmv;

    const pendingFarmers = db.prepare(`
      SELECT COUNT(*) as count FROM users 
      WHERE UPPER(role) IN ('FARMER', 'FPO_MEMBER') AND approval_status = 'PENDING_APPROVAL'
    `).get().count;

    const pendingBuyers = db.prepare(`
      SELECT COUNT(*) as count FROM users 
      WHERE UPPER(role) IN ('BUYER', 'B2B_BUYER', 'CONSUMER') AND approval_status = 'PENDING_APPROVAL'
    `).get().count;

    const totalOrders = db.prepare(`SELECT COUNT(*) as count FROM orders`).get().count;

    res.json({
      success: true,
      metrics: {
        totalFarmersApproved,
        totalBuyersApproved,
        totalActiveTransactions,
        totalOrders,
        totalGmv: +totalGmv.toFixed(2),
        pendingFarmers,
        pendingBuyers,
        pendingApprovals: {
          total: pendingFarmers + pendingBuyers,
          farmers: pendingFarmers,
          buyers: pendingBuyers
        }
      }
    });
  } catch (err) {
    console.error('Error fetching owner dashboard metrics:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
