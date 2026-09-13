const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// All endpoints in this router require ADMIN role
router.use(authenticateToken);
router.use(requireRole(['ADMIN']));

// GET /api/admin/metrics - Platform-wide stats
router.get('/metrics', (req, res) => {
  try {
    const totalGmv = db.prepare(`SELECT COALESCE(SUM(total_price), 0) as gmv FROM orders`).get().gmv;
    const totalOrders = db.prepare(`SELECT COUNT(*) as count FROM orders`).get().count;
    const activeFarmers = db.prepare(`SELECT COUNT(*) as count FROM users WHERE UPPER(role) IN ('FARMER', 'FPO_MEMBER')`).get().count;
    const verifiedBuyers = db.prepare(`SELECT COUNT(*) as count FROM users WHERE UPPER(role) IN ('BUYER', 'B2B_BUYER') AND kyc_status = 'APPROVED'`).get().count;
    const pendingKyc = db.prepare(`SELECT COUNT(*) as count FROM users WHERE kyc_status = 'PENDING'`).get().count;
    const activeListings = db.prepare(`SELECT COUNT(*) as count FROM produce_listings WHERE status = 'AVAILABLE'`).get().count;

    // Estimate middleman commissions eliminated (avg 24% of GMV)
    const commissionsSaved = Math.round(totalGmv * 0.24);

    res.json({
      success: true,
      metrics: {
        totalGmv: +totalGmv.toFixed(2),
        totalOrders,
        activeFarmers,
        verifiedBuyers,
        pendingKyc,
        activeListings,
        commissionsSaved,
        directEscrowPayoutRate: '72% Guaranteed to Producer',
        coldChainSpoilageRate: '3.2% vs 22% Mandi'
      }
    });
  } catch (err) {
    console.error('Error fetching admin metrics:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/buyers/pending - List all buyers waiting for KYC review
router.get('/buyers/pending', (req, res) => {
  try {
    const pendingBuyers = db.prepare(`
      SELECT 
        id, name, email, role, phone, district_state,
        business_name, gstin_number, fssai_license, kyc_status, created_at
      FROM users
      WHERE kyc_status = 'PENDING'
      ORDER BY created_at ASC
    `).all();

    res.json({
      success: true,
      count: pendingBuyers.length,
      buyers: pendingBuyers
    });
  } catch (err) {
    console.error('Error fetching pending buyers:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/buyers/:id/verify - Approve or Reject buyer GSTIN credentials
router.post('/buyers/:id/verify', (req, res) => {
  try {
    const buyerId = req.params.id;
    const { action = 'APPROVED' } = req.body; // 'APPROVED' or 'REJECTED'

    const targetStatus = action.toUpperCase() === 'REJECT' || action.toUpperCase() === 'REJECTED' 
      ? 'REJECTED' 
      : 'APPROVED';

    const buyer = db.prepare('SELECT * FROM users WHERE id = ?').get(buyerId);
    if (!buyer) {
      return res.status(404).json({ success: false, error: 'Buyer record not found' });
    }

    const now = new Date().toISOString();
    const approvedAt = targetStatus === 'APPROVED' ? now : null;
    db.prepare(`
      UPDATE users 
      SET kyc_status = ?, approval_status = ?, approved_at = COALESCE(approved_at, ?) 
      WHERE id = ?
    `).run(targetStatus, targetStatus, approvedAt, buyerId);
    try {
      db.prepare(`
        INSERT INTO audit_logs (id, actor_id, action_description, timestamp)
        VALUES (?, ?, ?, ?)
      `).run(`AUD-${Date.now()}`, req.user.id, `Admin ${req.user.name} set buyer ${buyer.name} (${buyer.email}) KYC to ${targetStatus}`, now);
    } catch (e) {}

    const updated = db.prepare(`
      SELECT id, name, email, role, phone, business_name, gstin_number, kyc_status 
      FROM users 
      WHERE id = ?
    `).get(buyerId);

    res.json({
      success: true,
      message: `Buyer ${buyer.name} (${buyer.business_name || 'Business'}) KYC status set to ${targetStatus}!`,
      buyer: updated
    });
  } catch (err) {
    console.error('Error verifying buyer:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/all-orders - Full system-wide visibility of active deliveries and escrow funds
router.get('/all-orders', (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT 
        o.*,
        o.total_price as total_amount,
        l.commodity_name,
        l.commodity_name as produce_name,
        l.category,
        l.unit,
        b.name as buyer_name,
        b.business_name as buyer_business,
        b.phone as buyer_phone,
        f.name as farmer_name,
        f.phone as farmer_phone,
        f.district_state as farmer_location
      FROM orders o
      JOIN produce_listings l ON o.listing_id = l.id
      JOIN users b ON o.buyer_id = b.id
      JOIN users f ON o.farmer_id = f.id
      ORDER BY o.created_at DESC
    `).all();

    const formattedOrders = orders.map(ord => ({
      ...ord,
      total_amount: ord.total_price || ord.total_amount,
      produce_name: ord.commodity_name || ord.produce_name
    }));

    res.json({
      success: true,
      count: formattedOrders.length,
      orders: formattedOrders
    });
  } catch (err) {
    console.error('Error fetching admin orders:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/admin/orders/:id/status - Advance delivery stages or settle escrow
router.put('/orders/:id/status', (req, res) => {
  try {
    const orderId = req.params.id;
    const { order_status, payment_status } = req.body;

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const newOrderStatus = order_status || order.order_status;
    let newPaymentStatus = payment_status || order.payment_status;

    // If delivered, automatically mark escrow settled to farmer unless specified
    if (newOrderStatus === 'DELIVERED' && !payment_status) {
      newPaymentStatus = 'SETTLED_TO_FARMER';
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE orders 
      SET order_status = ?, payment_status = ?, updated_at = ? 
      WHERE id = ?
    `).run(newOrderStatus, newPaymentStatus, now, orderId);

    // Audit log
    try {
      db.prepare(`
        INSERT INTO audit_logs (id, actor_id, action_description, timestamp)
        VALUES (?, ?, ?, ?)
      `).run(`AUD-${Date.now()}`, req.user.id, `Admin updated order ${order.order_number} to ${newOrderStatus} (${newPaymentStatus})`, now);
    } catch (e) {}

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);

    res.json({
      success: true,
      message: `Order #${order.order_number} advanced to ${newOrderStatus} (${newPaymentStatus})`,
      order: updated
    });
  } catch (err) {
    console.error('Error updating order stage:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
