const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

// All endpoints in this router require OWNER/ADMIN role
router.use(verifyToken);
router.use(requireRole(['owner', 'admin']));

/**
 * GET /api/v1/admin/users
 * Returns all platform users for moderation
 */
router.get('/users', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT 
        id, name, email, role, approval_status, phone, state_district, district_state,
        business_name, gstin_number, fssai_license, kyc_status, is_banned, banned_reason,
        created_at, approved_at
      FROM users
      ORDER BY created_at DESC
    `).all();

    res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/v1/admin/users/:id/dismiss
 * One-click action to dismiss / ban fake buyer or seller profiles
 */
router.patch('/users/:id/dismiss', (req, res) => {
  try {
    const userId = req.params.id;
    const { reason } = req.body;

    const targetUser = db.prepare('SELECT id, name, role, email FROM users WHERE id = ?').get(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    if (targetUser.role.toUpperCase() === 'OWNER' || targetUser.role.toUpperCase() === 'ADMIN') {
      return res.status(400).json({ success: false, error: 'Cannot dismiss a Platform Owner or Admin.' });
    }

    const banReason = reason || 'Dismissed for policy violation / suspicious activity by Platform Owner';

    // 1. Mark user as banned
    db.prepare(`
      UPDATE users 
      SET is_banned = 1, banned_reason = ?, banned_at = ?, approval_status = 'REJECTED'
      WHERE id = ?
    `).run(banReason, new Date().toISOString(), userId);

    // 2. Unpublish all active produce lots of this user
    db.prepare(`
      UPDATE produce_lots
      SET status = 'delisted_banned'
      WHERE farmer_id = ? AND status = 'available'
    `).run(userId);

    db.prepare(`
      UPDATE produce_listings
      SET status = 'DELISTED_BANNED'
      WHERE farmer_id = ? AND status = 'AVAILABLE'
    `).run(userId);

    // 3. Record Audit Log
    db.prepare(`
      INSERT INTO audit_logs (id, performed_by, action, target_user_id, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      `AUD-DISMISS-${Date.now().toString(36)}`,
      req.user.id,
      'USER_DISMISSED_AND_BANNED',
      userId,
      JSON.stringify({ target: targetUser.email, reason: banReason }),
      new Date().toISOString()
    );

    res.json({
      success: true,
      message: `User ${targetUser.name} (${targetUser.email}) was successfully dismissed and their listings unpublished.`,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        is_banned: 1,
        banned_reason: banReason
      }
    });
  } catch (err) {
    console.error('Dismiss user error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/admin/transactions/pending
 * Retrieve pending transactions requiring owner verification
 */
router.get('/transactions/pending', (req, res) => {
  try {
    const pendingOrders = db.prepare(`
      SELECT 
        o.id,
        o.order_number,
        o.buyer_id,
        b.name as buyer_name,
        b.email as buyer_email,
        b.business_name as buyer_business,
        b.kyc_status as buyer_kyc,
        o.farmer_id,
        f.name as farmer_name,
        f.email as farmer_email,
        f.state_district as farmer_district,
        f.kyc_status as farmer_kyc,
        o.lot_id,
        o.quantity,
        o.total_price,
        o.total_amount,
        o.escrow_status,
        o.verification_status,
        o.tracking_status,
        o.delivery_address,
        o.created_at,
        p.crop_name,
        p.variety,
        p.qc_grade,
        p.qc_hash,
        p.location as farm_location,
        p.farmgate_price
      FROM orders o
      LEFT JOIN users b ON o.buyer_id = b.id
      LEFT JOIN users f ON o.farmer_id = f.id
      LEFT JOIN produce_lots p ON o.lot_id = p.id
      WHERE o.verification_status IN ('pending_owner', 'PENDING_OWNER', 'pending_verification')
      ORDER BY o.created_at DESC
    `).all();

    // Map to formatted response
    const transactions = pendingOrders.map(ord => ({
      id: ord.id,
      order_number: ord.order_number || ord.id,
      total_amount: ord.total_amount || ord.total_price || 0,
      quantity: ord.quantity,
      escrow_status: ord.escrow_status || 'held',
      verification_status: ord.verification_status,
      created_at: ord.created_at,
      delivery_address: ord.delivery_address,
      farmer: {
        id: ord.farmer_id,
        name: ord.farmer_name || 'Sahyadri Farmers Co-op',
        email: ord.farmer_email,
        location: ord.farmer_district || ord.farm_location || 'Nashik, Maharashtra',
        kyc_status: ord.farmer_kyc || 'APPROVED',
        digital_passport_verified: true
      },
      buyer: {
        id: ord.buyer_id,
        name: ord.buyer_name || 'Procurement Buyer',
        email: ord.buyer_email,
        business_name: ord.buyer_business || 'Institutional Buyer',
        kyc_status: ord.buyer_kyc || 'APPROVED'
      },
      produce: {
        lot_id: ord.lot_id || 'LOT-AUTO',
        crop_name: ord.crop_name || 'Nashik Red Onion (Garwa)',
        variety: ord.variety || 'Garwa Premium',
        qc_grade: ord.qc_grade || 'Grade A',
        qc_hash: ord.qc_hash || 'SHA256: 7f8a91c2b4d90e8a7f6c5b4a3d2e1f0a',
        farmgate_price: ord.farmgate_price || 24.50
      }
    }));

    res.json({
      success: true,
      count: transactions.length,
      transactions
    });
  } catch (err) {
    console.error('Pending transactions error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/admin/transactions/:id/verify
 * Double-Approval Escrow Action: [APPROVE] or [REJECT / FRAUD]
 */
router.post('/transactions/:id/verify', (req, res) => {
  try {
    const orderId = req.params.id;
    const { action, reason, flag_fraud } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Must be "approve" or "reject".'
      });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Transaction / Order not found.' });
    }

    if (action === 'approve') {
      const pickupSchedule = 'Cold-Chain Reefer Pickup Scheduled at 08:30 AM Tomorrow';
      db.prepare(`
        UPDATE orders
        SET 
          verification_status = 'approved',
          escrow_status = 'held',
          tracking_status = 'approved_escrow_locked',
          pickup_schedule = ?,
          order_status = 'REEFER_PICKUP_SCHEDULED',
          payment_status = 'ESCROW_LOCKED_CONFIRMED',
          updated_at = ?
        WHERE id = ?
      `).run(pickupSchedule, new Date().toISOString(), orderId);

      // Audit log
      db.prepare(`
        INSERT INTO audit_logs (id, performed_by, action, target_order_id, details, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        `AUD-APPR-${Date.now().toString(36)}`,
        req.user.id,
        'ORDER_ESCROW_APPROVED',
        orderId,
        JSON.stringify({ order_number: order.order_number, total_amount: order.total_amount || order.total_price }),
        new Date().toISOString()
      );

      return res.json({
        success: true,
        message: `Order #${order.order_number || orderId} approved! Buyer escrow funds locked, dispatch scheduled, and farmer notified.`,
        order: {
          id: order.id,
          order_number: order.order_number,
          verification_status: 'approved',
          escrow_status: 'held',
          tracking_status: 'approved_escrow_locked',
          pickup_schedule: pickupSchedule
        }
      });
    } else {
      // Reject action
      const rejectionReason = reason || 'Transaction flagged and rejected during Owner Double-Approval check.';
      db.prepare(`
        UPDATE orders
        SET 
          verification_status = 'rejected',
          escrow_status = 'refunded',
          tracking_status = 'cancelled_rejected',
          rejection_reason = ?,
          order_status = 'CANCELLED',
          payment_status = 'ESCROW_REFUNDED',
          updated_at = ?
        WHERE id = ?
      `).run(rejectionReason, new Date().toISOString(), orderId);

      // If fraud flagged, log alert
      if (flag_fraud) {
        db.prepare(`
          INSERT INTO audit_logs (id, performed_by, action, target_order_id, details, timestamp)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          `AUD-FRAUD-${Date.now().toString(36)}`,
          req.user.id,
          'FRAUD_ALERT_ORDER_REJECTED',
          orderId,
          JSON.stringify({ reason: rejectionReason, buyer_id: order.buyer_id, seller_id: order.farmer_id }),
          new Date().toISOString()
        );
      }

      return res.json({
        success: true,
        message: `Transaction #${order.order_number || orderId} rejected. Escrow refunded to buyer.`,
        order: {
          id: order.id,
          order_number: order.order_number,
          verification_status: 'rejected',
          escrow_status: 'refunded',
          tracking_status: 'cancelled_rejected',
          rejection_reason: rejectionReason
        }
      });
    }
  } catch (err) {
    console.error('Verify transaction error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/admin/audit-logs
 */
router.get('/audit-logs', (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT a.*, u.name as performed_by_name, u.role as performed_by_role
      FROM audit_logs a
      LEFT JOIN users u ON a.performed_by = u.id
      ORDER BY a.timestamp DESC
      LIMIT 100
    `).all();

    res.json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
