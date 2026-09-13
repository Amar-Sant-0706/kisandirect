const db = require('../db');

exports.getLiveFeed = async (req, res) => {
  try {
    const feed = db.prepare(`
      SELECT * FROM activity_feed
      ORDER BY timestamp DESC
      LIMIT 50
    `).all();

    res.json({
      success: true,
      count: feed.length,
      feed
    });
  } catch (err) {
    console.error('getLiveFeed error:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: err.message });
  }
};

exports.getPendingTransactions = async (req, res) => {
  try {
    const transactions = db.prepare(`
      SELECT 
        o.id,
        o.order_number,
        o.quantity,
        o.total_amount,
        o.escrow_status,
        o.status,
        o.delivery_address,
        o.created_at,
        b.id as buyer_id,
        b.name as buyer_name,
        b.email as buyer_email,
        b.business_name as buyer_business,
        f.id as farmer_id,
        f.name as farmer_name,
        f.email as farmer_email,
        f.location as farmer_location,
        c.id as crop_lot_id,
        c.crop_name,
        c.variety,
        c.qc_grade,
        c.qc_hash,
        c.farmgate_price
      FROM orders o
      JOIN users b ON o.buyer_id = b.id
      JOIN users f ON o.farmer_id = f.id
      JOIN crop_lots c ON o.crop_lot_id = c.id
      WHERE o.status = 'pending_owner'
      ORDER BY o.created_at DESC
    `).all();

    res.json({
      success: true,
      count: transactions.length,
      transactions
    });
  } catch (err) {
    console.error('getPendingTransactions error:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: err.message });
  }
};

exports.handleTransactionAction = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { action, reason } = req.body;

    const normalizedAction = (action || '').toUpperCase();
    if (!['APPROVE', 'REJECT'].includes(normalizedAction)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ACTION',
        message: 'Action must be APPROVE or REJECT'
      });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'ORDER_NOT_FOUND',
        message: 'Transaction order not found.'
      });
    }

    if (normalizedAction === 'APPROVE') {
      const schedule = 'Reefer pickup scheduled for 08:30 AM tomorrow';

      db.prepare(`
        UPDATE orders
        SET status = 'approved', pickup_schedule = ?, updated_at = ?
        WHERE id = ?
      `).run(schedule, new Date().toISOString(), orderId);

      // Mark lot as reserved/sold
      db.prepare(`
        UPDATE crop_lots SET status = 'reserved' WHERE id = ?
      `).run(order.crop_lot_id);

      // Log Activity Feed
      db.prepare(`
        INSERT INTO activity_feed (id, actor_name, role, action, details, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        `ACT-APPR-${Date.now().toString(36)}`,
        req.user.name,
        'owner',
        'TRANSACTION_APPROVED',
        `Approved Order #${order.order_number} (₹${order.total_amount}). Reefer dispatch confirmed.`,
        new Date().toISOString()
      );

      return res.json({
        success: true,
        message: `Transaction #${order.order_number} verified and approved. Escrow funds locked & reefer pickup scheduled.`,
        order: {
          id: order.id,
          order_number: order.order_number,
          status: 'approved',
          pickup_schedule: schedule
        }
      });
    } else {
      const rejectionReason = reason || 'Transaction failed verification by Platform Owner.';

      db.prepare(`
        UPDATE orders
        SET status = 'rejected', escrow_status = 'refunded', rejection_reason = ?, updated_at = ?
        WHERE id = ?
      `).run(rejectionReason, new Date().toISOString(), orderId);

      // Release crop lot back to marketplace as available
      db.prepare(`
        UPDATE crop_lots SET status = 'available' WHERE id = ?
      `).run(order.crop_lot_id);

      // Log Activity Feed
      db.prepare(`
        INSERT INTO activity_feed (id, actor_name, role, action, details, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        `ACT-REJ-${Date.now().toString(36)}`,
        req.user.name,
        'owner',
        'TRANSACTION_REJECTED',
        `Rejected Order #${order.order_number}. Escrow refunded to buyer. Reason: ${rejectionReason}`,
        new Date().toISOString()
      );

      return res.json({
        success: true,
        message: `Transaction #${order.order_number} rejected. Produce released back to marketplace and escrow refunded.`,
        order: {
          id: order.id,
          order_number: order.order_number,
          status: 'rejected',
          escrow_status: 'refunded',
          rejection_reason: rejectionReason
        }
      });
    }
  } catch (err) {
    console.error('handleTransactionAction error:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: err.message });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, email, role, name, phone, location, business_name, is_banned, created_at
      FROM users
      WHERE role IN ('farmer', 'buyer')
      ORDER BY created_at DESC
    `).all();

    res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (err) {
    console.error('getUsers error:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: err.message });
  }
};

exports.dismissUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const { reason } = req.body;

    const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'User profile not found.'
      });
    }

    if (targetUser.role === 'owner') {
      return res.status(400).json({
        success: false,
        error: 'CANNOT_DISMISS_OWNER',
        message: 'Cannot dismiss a platform administrator.'
      });
    }

    const banReason = reason || 'Dismissed for fraudulent activity by Platform Owner.';

    // 1. Mark user as banned
    db.prepare(`
      UPDATE users SET is_banned = 1, banned_reason = ? WHERE id = ?
    `).run(banReason, userId);

    // 2. Delist all active crop lots
    db.prepare(`
      UPDATE crop_lots SET status = 'delisted_banned' WHERE farmer_id = ? AND status = 'available'
    `).run(userId);

    // 3. Cancel any pending orders
    db.prepare(`
      UPDATE orders SET status = 'rejected', rejection_reason = 'User account dismissed/banned'
      WHERE (buyer_id = ? OR farmer_id = ?) AND status = 'pending_owner'
    `).run(userId, userId);

    // 4. Log Activity Feed
    db.prepare(`
      INSERT INTO activity_feed (id, actor_name, role, action, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      `ACT-BAN-${Date.now().toString(36)}`,
      req.user.name,
      'owner',
      'USER_DISMISSED',
      `Banned ${targetUser.role.toUpperCase()} ${targetUser.name} (${targetUser.email}). Listings delisted.`,
      new Date().toISOString()
    );

    res.json({
      success: true,
      message: `Profile ${targetUser.name} (${targetUser.email}) dismissed and banned. Listings removed and pending orders cancelled.`,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        is_banned: 1,
        banned_reason: banReason
      }
    });
  } catch (err) {
    console.error('dismissUser error:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: err.message });
  }
};
