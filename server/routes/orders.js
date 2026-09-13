const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, optionalAuthToken } = require('../middleware/auth');

// POST /api/procurement/b2b - Handle Institutional Bulk Procurement (RFQ)
router.post('/procurement/b2b', optionalAuthToken, (req, res) => {
  try {
    const {
      commodity_id,
      commodity_name,
      quantity,
      buyer_name,
      contact_phone = '+91-9988776655',
      destination_city = 'Mumbai',
      fleet_type = 'Reefer Cold-Chain Express (2°C - 6°C)',
      frequency = 'One-Time Spot Dispatch',
      estimated_rate
    } = req.body;

    const resolvedBuyer = (buyer_name || (req.user ? req.user.name : 'Institutional Buyer')).trim();

    if (!quantity) {
      return res.status(400).json({ success: false, error: 'Quantity is required' });
    }

    let commodity = null;
    if (commodity_id) {
      commodity = db.prepare('SELECT * FROM commodities WHERE id = ?').get(commodity_id);
    }
    if (!commodity && commodity_name) {
      commodity = db.prepare('SELECT * FROM commodities WHERE LOWER(name) LIKE LOWER(?)').get(`%${commodity_name.trim()}%`);
    }

    const rate = estimated_rate || (commodity ? commodity.base_mandi_benchmark_rate * 1.35 : 50.0);
    const total_amount = +(parseFloat(quantity) * rate * 100).toFixed(2);
    const order_id = `RFQ-B2B-${Date.now().toString(36).toUpperCase()}`;

    db.prepare(`
      INSERT INTO orders_and_inquiries (
        id, user_id, order_type, commodity_id, quantity, buyer_name, contact_phone,
        destination_city, total_amount, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      order_id,
      req.user ? req.user.id : null,
      'B2B_Bulk',
      commodity ? commodity.id : null,
      parseFloat(quantity),
      resolvedBuyer,
      contact_phone,
      destination_city,
      total_amount,
      'RFQ Submitted / FPO Matched',
      new Date().toISOString()
    );

    res.status(201).json({
      success: true,
      message: 'B2B Procurement RFQ submitted successfully! FPO notified for direct dispatch.',
      order: {
        orderId: order_id,
        buyerName: resolvedBuyer,
        commodity: commodity ? commodity.name : (commodity_name || 'Bulk Produce'),
        quantity: `${quantity} Quintals`,
        destinationCity: destination_city,
        fleetType: fleet_type,
        frequency,
        totalEstimatedAmount: `₹${total_amount.toLocaleString('en-IN')}`
      }
    });
  } catch (err) {
    console.error('Error creating B2B RFQ:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/orders/checkout - Handle Direct Consumer Cart Checkout
router.post('/orders/checkout', optionalAuthToken, (req, res) => {
  try {
    const {
      items = [],
      buyer_name,
      contact_phone = '+91-9123456789',
      destination_city = 'Mumbai Urban Hub'
    } = req.body;

    const resolvedBuyer = (buyer_name || (req.user ? req.user.name : 'Direct Consumer')).trim();

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Cart is empty' });
    }

    const order_id = `ORD-B2C-${Date.now().toString(36).toUpperCase()}`;
    let grandTotal = 0;
    let totalFarmerPayout = 0;

    const insertOrder = db.prepare(`
      INSERT INTO orders_and_inquiries (
        id, user_id, order_type, commodity_id, quantity, buyer_name, contact_phone,
        destination_city, total_amount, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      const itemCost = parseFloat(item.price) * parseFloat(item.qty);
      grandTotal += itemCost;
      const farmerShare = item.farmerShare ? parseFloat(item.farmerShare) * parseFloat(item.qty) : itemCost * 0.72;
      totalFarmerPayout += farmerShare;

      const subId = `${order_id}-${Math.floor(100 + Math.random() * 900)}`;
      insertOrder.run(
        subId,
        req.user ? req.user.id : null,
        'Consumer_Cart',
        item.id || null,
        parseFloat(item.qty),
        resolvedBuyer,
        contact_phone,
        destination_city,
        +itemCost.toFixed(2),
        'Confirmed / Reefer Aggregation Scheduled',
        new Date().toISOString()
      );
    }

    res.status(201).json({
      success: true,
      orderId: order_id,
      message: 'Direct Farm Order Placed Successfully! Middlemen eliminated.',
      summary: {
        itemCount: items.length,
        totalAmount: +grandTotal.toFixed(2),
        farmerDirectPayout: +totalFarmerPayout.toFixed(2),
        farmerSharePercent: '72%',
        consumerSavingsPercent: '28%',
        logisticsTracking: 'Reefer MH-15 En-Route'
      }
    });
  } catch (err) {
    console.error('Error processing checkout:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/orders - List user orders (or all for admin)
router.get('/orders', authenticateToken, (req, res) => {
  try {
    let query = `
      SELECT o.*, c.name as commodity_name 
      FROM orders_and_inquiries o 
      LEFT JOIN commodities c ON o.commodity_id = c.id 
    `;
    const params = [];

    if (req.user.role !== 'DOCA_Admin') {
      query += ` WHERE o.user_id = ? `;
      params.push(req.user.id);
    }

    query += ` ORDER BY o.created_at DESC LIMIT 50 `;

    const rows = db.prepare(query).all(...params);

    res.json({
      success: true,
      count: rows.length,
      orders: rows
    });
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
