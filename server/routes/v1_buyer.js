const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireRole, optionalAuthToken } = require('../middleware/auth');

/**
 * GET /api/v1/marketplace/produce
 * Filterable list of verified crop lots by grade (A+, Organic, GlobalGAP), variety, price
 * Publicly browseable, but authenticated users see direct purchase details
 */
router.get('/produce', optionalAuthToken, (req, res) => {
  try {
    const { grade, category, min_price, max_price, search } = req.query;

    let query = `
      SELECT 
        p.id,
        p.farmer_id,
        p.crop_name,
        p.category,
        p.variety,
        p.quantity_kg,
        p.farmgate_price,
        p.mandi_price,
        p.qc_grade,
        p.qc_hash,
        p.location,
        p.status,
        p.image,
        p.harvest_date,
        p.created_at,
        u.name as farmer_name,
        u.business_name as fpo_name,
        u.state_district as farmer_location
      FROM produce_lots p
      LEFT JOIN users u ON p.farmer_id = u.id
      WHERE p.status = 'available' AND (u.is_banned = 0 OR u.is_banned IS NULL)
    `;

    const params = [];

    if (grade) {
      query += ` AND LOWER(p.qc_grade) LIKE LOWER(?)`;
      params.push(`%${grade}%`);
    }

    if (category) {
      query += ` AND LOWER(p.category) = LOWER(?)`;
      params.push(category);
    }

    if (min_price) {
      query += ` AND p.farmgate_price >= ?`;
      params.push(parseFloat(min_price));
    }

    if (max_price) {
      query += ` AND p.farmgate_price <= ?`;
      params.push(parseFloat(max_price));
    }

    if (search) {
      query += ` AND (LOWER(p.crop_name) LIKE LOWER(?) OR LOWER(p.variety) LIKE LOWER(?))`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY p.created_at DESC`;

    const lots = db.prepare(query).all(...params);

    // If produce_lots is empty, fallback to sample catalogue from commodities/listings
    if (lots.length === 0) {
      const fallbackListings = db.prepare(`
        SELECT 
          l.id,
          l.farmer_id,
          l.commodity_name as crop_name,
          l.category,
          l.variety,
          l.available_qty as quantity_kg,
          l.farmgate_price_per_unit as farmgate_price,
          l.mandi_reference_price as mandi_price,
          l.quality_grade as qc_grade,
          'SHA256: 7f8a91c2b4d90e8a7f6c5b4a3d2e1f0a' as qc_hash,
          l.location_pin as location,
          'available' as status,
          l.image,
          l.harvest_date,
          l.created_at,
          u.name as farmer_name,
          u.business_name as fpo_name
        FROM produce_listings l
        LEFT JOIN users u ON l.farmer_id = u.id
        WHERE l.status = 'AVAILABLE' AND (u.is_banned = 0 OR u.is_banned IS NULL)
      `).all();

      return res.json({
        success: true,
        count: fallbackListings.length,
        lots: fallbackListings
      });
    }

    res.json({
      success: true,
      count: lots.length,
      lots
    });
  } catch (err) {
    console.error('Marketplace produce error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/orders/checkout
 * Creates order in pending_owner state with escrow status 'held'
 */
router.post('/checkout', verifyToken, requireRole(['buyer']), (req, res) => {
  try {
    const {
      lot_id,
      quantity,
      delivery_address,
      delivery_city,
      contact_phone
    } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ success: false, error: 'Valid quantity is required.' });
    }

    // Lookup lot in produce_lots or produce_listings
    let lot = db.prepare('SELECT * FROM produce_lots WHERE id = ?').get(lot_id);
    let farmerId = null;
    let pricePerKg = 25.0;
    let cropName = 'Agricultural Produce';

    if (lot) {
      farmerId = lot.farmer_id;
      pricePerKg = lot.farmgate_price;
      cropName = lot.crop_name;
    } else {
      const altLot = db.prepare('SELECT * FROM produce_listings WHERE id = ?').get(lot_id);
      if (altLot) {
        farmerId = altLot.farmer_id;
        pricePerKg = altLot.farmgate_price_per_unit;
        cropName = altLot.commodity_name;
      } else {
        // Find default farmer if lot_id was mock ID
        const defaultFarmer = db.prepare("SELECT id FROM users WHERE UPPER(role) = 'FARMER' LIMIT 1").get();
        farmerId = defaultFarmer ? defaultFarmer.id : 'USR-FARMER-ENTERPRISE';
      }
    }

    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
    const orderNumber = `KD-ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    const totalAmount = +(pricePerKg * quantity).toFixed(2);
    const addr = delivery_address || 'Vashi Logistics Hub, Navi Mumbai';

    // Insert order in PENDING_OWNER state with ESCROW HELD
    db.prepare(`
      INSERT INTO orders (
        id, order_number, buyer_id, farmer_id, seller_id, lot_id,
        quantity, total_price, total_amount, escrow_status,
        verification_status, tracking_status, delivery_address,
        payment_status, order_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'held', 'pending_owner', 'pending_verification', ?, 'ESCROW_HELD', 'ORDER_PLACED', ?, ?)
    `).run(
      orderId,
      orderNumber,
      req.user.id,
      farmerId,
      farmerId,
      lot_id || 'LOT-AUTO',
      parseFloat(quantity),
      totalAmount,
      totalAmount,
      addr,
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (id, performed_by, action, target_order_id, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      `AUD-ORD-${Date.now().toString(36)}`,
      req.user.id,
      'ORDER_CREATED_PENDING_OWNER',
      orderId,
      JSON.stringify({ order_number: orderNumber, total_amount: totalAmount, buyer: req.user.email }),
      new Date().toISOString()
    );

    res.status(201).json({
      success: true,
      message: 'Order submitted! Escrow funds held and waiting for Web Owner double-approval verification.',
      order: {
        id: orderId,
        order_number: orderNumber,
        crop_name: cropName,
        quantity: parseFloat(quantity),
        total_amount: totalAmount,
        escrow_status: 'held',
        verification_status: 'pending_owner',
        tracking_status: 'pending_verification',
        delivery_address: addr
      }
    });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/orders/my-orders
 * Buyer's placed orders & cold-chain GPS telemetry tracking
 */
router.get('/my-orders', verifyToken, requireRole(['buyer']), (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT 
        o.id,
        o.order_number,
        o.quantity,
        o.total_amount,
        o.total_price,
        o.escrow_status,
        o.verification_status,
        o.tracking_status,
        o.pickup_schedule,
        o.delivery_address,
        o.rejection_reason,
        o.created_at,
        o.updated_at,
        f.name as farmer_name,
        f.state_district as farm_location,
        p.crop_name,
        p.variety,
        p.qc_grade,
        p.qc_hash
      FROM orders o
      LEFT JOIN users f ON o.farmer_id = f.id
      LEFT JOIN produce_lots p ON o.lot_id = p.id
      WHERE o.buyer_id = ?
      ORDER BY o.created_at DESC
    `).all(req.user.id);

    const trackedOrders = orders.map(ord => {
      // Simulate live GPS telemetry waypoint based on tracking status
      let telemetry = {
        reefer_temp_celsius: 4.2,
        humidity_rh: 88,
        gps: { lat: 19.8976, lng: 73.7898, location_name: 'Nashik-Mumbai Expressway Corridor (KM 42)' },
        speed_kmh: 58,
        eta_minutes: 95
      };

      if (ord.tracking_status === 'pending_verification') {
        telemetry.status = 'Awaiting Platform Owner Escrow Verification';
        telemetry.speed_kmh = 0;
        telemetry.eta_minutes = null;
      } else if (ord.tracking_status === 'approved_escrow_locked') {
        telemetry.status = 'Escrow Locked • Reefer Dispatch Dispatched to Farmgate';
      } else {
        telemetry.status = 'Active Reefer Cold-Chain Transit';
      }

      return {
        id: ord.id,
        order_number: ord.order_number || ord.id,
        crop_name: ord.crop_name || 'Nashik Red Onion (Garwa)',
        variety: ord.variety || 'Garwa Premium',
        qc_grade: ord.qc_grade || 'Grade A',
        qc_hash: ord.qc_hash || 'SHA256: 7f8a91c2b4d90e8a7f6c5b4a3d2e1f0a',
        quantity: ord.quantity,
        total_amount: ord.total_amount || ord.total_price || 0,
        escrow_status: ord.escrow_status || 'held',
        verification_status: ord.verification_status,
        tracking_status: ord.tracking_status,
        pickup_schedule: ord.pickup_schedule || 'Reefer pickup scheduled upon verification',
        rejection_reason: ord.rejection_reason || null,
        delivery_address: ord.delivery_address,
        farmer_name: ord.farmer_name || 'Sahyadri Farmers Co-op',
        telemetry,
        date: ord.created_at
      };
    });

    res.json({
      success: true,
      count: trackedOrders.length,
      orders: trackedOrders
    });
  } catch (err) {
    console.error('My orders error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
