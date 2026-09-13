const db = require('../db');

exports.getMarketplace = async (req, res) => {
  try {
    const { grade, category, search } = req.query;

    let query = `
      SELECT 
        c.*,
        u.name as farmer_name,
        u.business_name as fpo_name,
        u.location as farmer_location
      FROM crop_lots c
      JOIN users u ON c.farmer_id = u.id
      WHERE c.status = 'available' AND u.is_banned = 0
    `;

    const params = [];

    if (grade) {
      query += ` AND LOWER(c.qc_grade) LIKE LOWER(?)`;
      params.push(`%${grade}%`);
    }

    if (category) {
      query += ` AND LOWER(c.category) = LOWER(?)`;
      params.push(category);
    }

    if (search) {
      query += ` AND (LOWER(c.crop_name) LIKE LOWER(?) OR LOWER(c.variety) LIKE LOWER(?))`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY c.created_at DESC`;

    const lots = db.prepare(query).all(...params);

    res.json({
      success: true,
      count: lots.length,
      lots
    });
  } catch (err) {
    console.error('getMarketplace error:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: err.message });
  }
};

exports.placeOrder = async (req, res) => {
  try {
    const { crop_lot_id, quantity, delivery_address } = req.body;

    if (!crop_lot_id || !quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ORDER_DATA',
        message: 'Valid crop lot ID and quantity are required.'
      });
    }

    const lot = db.prepare('SELECT * FROM crop_lots WHERE id = ?').get(crop_lot_id);
    if (!lot) {
      return res.status(404).json({
        success: false,
        error: 'LOT_NOT_FOUND',
        message: 'The requested crop lot was not found or is no longer listed.'
      });
    }

    if (lot.status !== 'available') {
      return res.status(400).json({
        success: false,
        error: 'LOT_UNAVAILABLE',
        message: 'This crop lot is already reserved or sold.'
      });
    }

    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
    const orderNumber = `KD-ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    const qty = parseFloat(quantity);
    const totalAmount = +(lot.farmgate_price * qty).toFixed(2);
    const address = delivery_address || 'Vashi Logistics Hub, Navi Mumbai';

    // Insert order in 'pending_owner' state
    db.prepare(`
      INSERT INTO orders (
        id, order_number, buyer_id, farmer_id, crop_lot_id, quantity,
        total_amount, escrow_status, status, pickup_schedule,
        delivery_address, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'held', 'pending_owner', 'Awaiting Owner Verification', ?, ?, ?)
    `).run(
      orderId,
      orderNumber,
      req.user.id,
      lot.farmer_id,
      lot.id,
      qty,
      totalAmount,
      address,
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Log Activity Feed
    db.prepare(`
      INSERT INTO activity_feed (id, actor_name, role, action, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      `ACT-ORD-${Date.now().toString(36)}`,
      req.user.name,
      'buyer',
      'ORDER_PLACED',
      `Placed Order #${orderNumber} for ${qty} kg ${lot.crop_name} (₹${totalAmount.toFixed(2)} held in escrow)`,
      new Date().toISOString()
    );

    res.status(201).json({
      success: true,
      message: 'Order submitted! Escrow funds held and awaiting Web Owner verification.',
      order: {
        id: orderId,
        order_number: orderNumber,
        crop_name: lot.crop_name,
        quantity: qty,
        total_amount: totalAmount,
        status: 'pending_owner',
        escrow_status: 'held',
        delivery_address: address
      }
    });
  } catch (err) {
    console.error('placeOrder error:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: err.message });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT 
        o.id,
        o.order_number,
        o.quantity,
        o.total_amount,
        o.escrow_status,
        o.status,
        o.pickup_schedule,
        o.delivery_address,
        o.rejection_reason,
        o.created_at,
        c.crop_name,
        c.variety,
        c.qc_grade,
        c.qc_hash,
        c.location as farm_location,
        f.name as farmer_name
      FROM orders o
      JOIN crop_lots c ON o.crop_lot_id = c.id
      JOIN users f ON o.farmer_id = f.id
      WHERE o.buyer_id = ?
      ORDER BY o.created_at DESC
    `).all(req.user.id);

    // Attach simulated GPS cold-chain telemetry
    const trackedOrders = orders.map(ord => {
      let telemetry = {
        temperature_c: 4.2,
        humidity_rh: 88,
        speed_kmh: 58,
        gps_corridor: 'Nashik-Mumbai Expressway Corridor (KM 42)',
        status_label: 'Awaiting Owner Verification'
      };

      if (ord.status === 'approved' || ord.status === 'dispatched') {
        telemetry.status_label = 'Reefer Cold-Chain Dispatched & En Route';
      } else if (ord.status === 'delivered') {
        telemetry.status_label = 'Fulfilled & Delivered at Buyer Depot';
        telemetry.speed_kmh = 0;
      } else if (ord.status === 'rejected') {
        telemetry.status_label = 'Transaction Rejected / Escrow Refunded';
        telemetry.speed_kmh = 0;
      }

      return {
        ...ord,
        telemetry
      };
    });

    res.json({
      success: true,
      count: trackedOrders.length,
      orders: trackedOrders
    });
  } catch (err) {
    console.error('getMyOrders error:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: err.message });
  }
};

exports.getOrderTelemetry = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = db.prepare(`
      SELECT 
        o.*,
        c.crop_name,
        c.variety,
        c.qc_grade,
        c.qc_hash,
        c.location as farm_location,
        f.name as farmer_name,
        b.name as buyer_name
      FROM orders o
      JOIN crop_lots c ON o.crop_lot_id = c.id
      JOIN users f ON o.farmer_id = f.id
      JOIN users b ON o.buyer_id = b.id
      WHERE o.id = ? OR o.order_number = ?
    `).get(orderId, orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'ORDER_NOT_FOUND',
        message: 'Order not found'
      });
    }

    const telemetry = {
      orderId: order.id,
      orderNumber: order.order_number,
      cropName: order.crop_name,
      quantityKg: order.quantity,
      escrowStatus: order.escrow_status,
      orderStatus: order.status,
      origin: order.farm_location,
      destination: order.delivery_address,
      currentGps: { lat: 19.2183, lng: 72.9781, locationName: 'Thane Highway Corridor Checkpost' },
      reeferVehicle: {
        truckNumber: 'MH-15-EG-8042',
        driverName: 'Sanjay Deshmukh',
        driverPhone: '+91-98234-55123',
        compressorStatus: 'Eco-Active (Dual Loop)',
        speedKmH: 58
      },
      temperature: {
        currentC: 4.2,
        targetC: 4.0,
        minAllowedC: 2.0,
        maxAllowedC: 6.0,
        status: 'Optimal Cold-Chain Integrity'
      },
      humidity: {
        currentRh: 86,
        targetRh: 85
      },
      etaMinutes: 45,
      distanceRemainingKm: 34.2,
      sensorLogs: [
        { time: '07:00', temp: 4.1, humidity: 87 },
        { time: '07:30', temp: 4.1, humidity: 86 },
        { time: '08:00', temp: 4.2, humidity: 85 },
        { time: '08:30', temp: 4.2, humidity: 86 },
        { time: '09:00', temp: 4.2, humidity: 86 }
      ],
      milestones: [
        { label: 'Farmgate Harvest & Kisan-Vision QC Certified', completed: true, timestamp: order.created_at },
        { label: 'Platform Owner Double-Approval Verified', completed: order.status !== 'pending_owner' && order.status !== 'rejected', timestamp: order.updated_at },
        { label: 'Reefer Dispatched from Farmgate Hub', completed: ['approved', 'dispatched', 'delivered'].includes(order.status), timestamp: '06:15 AM' },
        { label: 'In-Transit GPS Corridor Tracking', completed: ['dispatched', 'delivered'].includes(order.status) || order.status === 'approved', current: order.status !== 'delivered' },
        { label: 'Buyer Distribution Center Delivery', completed: order.status === 'delivered', eta: '09:45 AM' }
      ]
    };

    return res.json({
      success: true,
      telemetry
    });
  } catch (err) {
    console.error('getOrderTelemetry error:', err);
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: err.message });
  }
};

