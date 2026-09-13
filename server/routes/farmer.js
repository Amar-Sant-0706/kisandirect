const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireRole, requireApproved } = require('../middleware/auth');

// All endpoints in this router require FARMER, OWNER or ADMIN role
router.use(verifyToken);
router.use(requireRole(['FARMER', 'OWNER', 'ADMIN']));

// GET /api/farmer/my-listings - Returns ONLY the authenticated farmer's listed produce
router.get('/my-listings', (req, res) => {
  try {
    const farmerId = req.user.id;
    const listings = db.prepare(`
      SELECT 
        l.*,
        u.name as farmer_name,
        u.phone as farmer_phone,
        u.district_state as farmer_location
      FROM produce_listings l
      JOIN users u ON l.farmer_id = u.id
      WHERE l.farmer_id = ?
      ORDER BY l.created_at DESC
    `).all(farmerId);

    // Calculate farmer revenue and stats
    const ordersStats = db.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_price), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN payment_status = 'ESCROW_HELD' THEN total_price ELSE 0 END), 0) as escrow_held
      FROM orders
      WHERE farmer_id = ?
    `).get(farmerId);

    const normalizedListings = listings.map(l => ({
      ...l,
      farmgate_rate: l.farmgate_price_per_unit,
      mandi_rate: l.mandi_reference_price,
      quantity: l.available_qty,
      harvest_date: l.created_at ? l.created_at.split('T')[0] : 'Today',
      image_url: l.image || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80'
    }));

    res.json({
      success: true,
      count: normalizedListings.length,
      listings: normalizedListings,
      stats: {
        activeListings: listings.filter(l => l.status === 'AVAILABLE').length,
        totalOrders: ordersStats ? ordersStats.total_orders : 0,
        totalRevenue: ordersStats ? ordersStats.total_revenue : 0,
        escrowHeld: ordersStats ? ordersStats.escrow_held : 0
      }
    });
  } catch (err) {
    console.error('Error fetching farmer listings:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/farmer/listings - Create new harvest lot (Requires APPROVED status)
router.post('/listings', requireApproved, (req, res) => {
  try {
    const farmerId = req.user.id;
    const {
      commodity_name,
      category = 'Vegetable',
      variety = 'Standard Farmgate',
      available_qty = 100,
      unit = 'kg',
      farmgate_price_per_unit,
      mandi_reference_price,
      quality_grade = 'Grade A (Export Quality)',
      harvest_date = new Date().toISOString().split('T')[0],
      location_pin = req.user.district_state || 'Nashik, Maharashtra',
      image = 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80'
    } = req.body;

    if (!commodity_name || !commodity_name.trim()) {
      return res.status(400).json({ success: false, error: 'Commodity name is required' });
    }
    if (!farmgate_price_per_unit || farmgate_price_per_unit <= 0) {
      return res.status(400).json({ success: false, error: 'Valid farmgate price is required' });
    }

    const farmgatePrice = parseFloat(farmgate_price_per_unit);
    const mandiRef = mandi_reference_price ? parseFloat(mandi_reference_price) : +(farmgatePrice * 0.70).toFixed(2);
    const id = `LST-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO produce_listings (
        id, farmer_id, commodity_name, category, variety, available_qty,
        unit, farmgate_price_per_unit, mandi_reference_price, quality_grade,
        harvest_date, location_pin, image, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', ?)
    `).run(
      id,
      farmerId,
      commodity_name.trim(),
      category,
      variety,
      parseFloat(available_qty) || 100,
      unit,
      farmgatePrice,
      mandiRef,
      quality_grade,
      harvest_date,
      location_pin,
      image,
      createdAt
    );

    // Also populate crop_batches for backward compatibility if needed
    try {
      let comm = db.prepare('SELECT id FROM commodities WHERE LOWER(name) = LOWER(?)').get(commodity_name.trim());
      if (!comm) {
        comm = db.prepare('SELECT id FROM commodities LIMIT 1').get();
      }
      if (comm) {
        const lotNo = `LOT-${Math.floor(100 + Math.random() * 900)}`;
        db.prepare(`
          INSERT INTO crop_batches (
            id, lot_number, user_id, farmer_fpo_name, commodity_id, variety,
            quantity, unit, farmgate_rate, mandi_rate, quality_grade,
            harvest_date, pickup_location, dispatch_schedule, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Immediate', 'Listed')
        `).run(
          `BATCH-${Date.now().toString(36).toUpperCase()}`,
          lotNo,
          farmerId,
          req.user.name,
          comm.id,
          variety,
          parseFloat(available_qty) || 100,
          unit,
          farmgatePrice,
          mandiRef,
          quality_grade,
          harvest_date,
          location_pin
        );
      }
    } catch (e) {}

    // Audit log
    try {
      db.prepare(`
        INSERT INTO audit_logs (id, actor_id, action_description, timestamp)
        VALUES (?, ?, ?, ?)
      `).run(`AUD-${Date.now()}`, farmerId, `Created produce listing ${id} (${commodity_name})`, createdAt);
    } catch (e) {}

    const created = db.prepare('SELECT * FROM produce_listings WHERE id = ?').get(id);

    res.status(201).json({
      success: true,
      message: `Harvest lot for ${commodity_name} listed successfully!`,
      listing: created
    });
  } catch (err) {
    console.error('Error creating farmer listing:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/farmer/orders - Inbound purchase orders for this farmer's produce
router.get('/orders', (req, res) => {
  try {
    const farmerId = req.user.id;
    const orders = db.prepare(`
      SELECT 
        o.*,
        o.total_price as total_amount,
        l.commodity_name,
        l.commodity_name as produce_name,
        l.category,
        l.unit,
        l.farmgate_price_per_unit,
        l.image as listing_image,
        u.name as buyer_name,
        u.business_name as buyer_business,
        u.phone as buyer_phone,
        u.district_state as buyer_location
      FROM orders o
      JOIN produce_listings l ON o.listing_id = l.id
      JOIN users u ON o.buyer_id = u.id
      WHERE o.farmer_id = ?
      ORDER BY o.created_at DESC
    `).all(farmerId);

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
    console.error('Error fetching farmer orders:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/farmer/orders/:id/status - Update dispatch stages ('FARMER_PACKING', 'REEFER_PICKED_UP')
router.put('/orders/:id/status', (req, res) => {
  try {
    const farmerId = req.user.id;
    const orderId = req.params.id;
    const { status } = req.body;

    const allowedStatuses = ['FARMER_PACKING', 'REEFER_PICKED_UP'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status update. Farmers can update to: ${allowedStatuses.join(', ')}`
      });
    }

    // Verify order ownership
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (order.farmer_id !== farmerId && req.user.role.toUpperCase() !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'You are not authorized to update this order' });
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE orders 
      SET order_status = ?, updated_at = ? 
      WHERE id = ?
    `).run(status, now, orderId);

    // Audit log
    try {
      db.prepare(`
        INSERT INTO audit_logs (id, actor_id, action_description, timestamp)
        VALUES (?, ?, ?, ?)
      `).run(`AUD-${Date.now()}`, farmerId, `Farmer updated order ${order.order_number} to ${status}`, now);
    } catch (e) {}

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);

    res.json({
      success: true,
      message: `Order #${order.order_number} status updated to ${status}!`,
      order: updated
    });
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
