const crypto = require('crypto');
const db = require('../db');

exports.createCrop = async (req, res) => {
  try {
    const {
      crop_name,
      variety,
      category,
      quantity_kg,
      unit,
      farmgate_price,
      mandi_benchmark_price,
      qc_grade,
      qc_hash,
      freshness_score,
      ripeness_score,
      blemish_rate,
      diameter_mm,
      qc_cert_json,
      harvest_date,
      location,
      image
    } = req.body;

    if (!crop_name || !quantity_kg || !farmgate_price) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Crop Name, Quantity (kg), and Farmgate Price are required.'
      });
    }

    const lotId = `LOT-${crop_name.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const grade = qc_grade || 'Grade A+';
    const loc = location || req.user.location || 'Nashik, Maharashtra';
    const hDate = harvest_date || new Date().toISOString().split('T')[0];
    const qty = parseFloat(quantity_kg);
    const price = parseFloat(farmgate_price);
    const mandiPrice = mandi_benchmark_price ? parseFloat(mandi_benchmark_price) : +(price * 0.72).toFixed(2);
    const img = image || 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=600&q=80';

    // Generate or preserve tamper-proof SHA-256 QC Hash
    const computedQcData = `${lotId}|${req.user.id}|${crop_name}|${qty}|${grade}|${Date.now()}`;
    const finalQcHash = qc_hash || `SHA256:${crypto.createHash('sha256').update(computedQcData).digest('hex')}`;
    const fScore = freshness_score ? parseFloat(freshness_score) : 96.5;
    const rScore = ripeness_score ? parseFloat(ripeness_score) : 94.0;
    const bRate = blemish_rate ? parseFloat(blemish_rate) : 1.2;
    const dMm = diameter_mm ? parseFloat(diameter_mm) : 62.0;
    const certJson = qc_cert_json ? (typeof qc_cert_json === 'string' ? qc_cert_json : JSON.stringify(qc_cert_json)) : null;

    db.prepare(`
      INSERT INTO crop_lots (
        id, farmer_id, crop_name, variety, category, quantity_kg, unit,
        farmgate_price, mandi_benchmark_price, qc_grade, qc_hash,
        freshness_score, ripeness_score, blemish_rate, diameter_mm, qc_cert_json,
        location, harvest_date, status, image, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?)
    `).run(
      lotId,
      req.user.id,
      crop_name,
      variety || 'High-Yield Hybrid',
      category || 'Vegetables',
      qty,
      unit || 'Quintals',
      price,
      mandiPrice,
      grade,
      finalQcHash,
      fScore,
      rScore,
      bRate,
      dMm,
      certJson,
      loc,
      hDate,
      img,
      new Date().toISOString()
    );

    // Log Activity Feed
    db.prepare(`
      INSERT INTO activity_feed (id, actor_name, role, action, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      `ACT-CROP-${Date.now().toString(36)}`,
      req.user.name,
      'farmer',
      'LISTED_CROP',
      `Listed ${qty} kg of ${crop_name} at ₹${price}/kg (Lot #${lotId})`,
      new Date().toISOString()
    );

    res.status(201).json({
      success: true,
      message: `Crop lot ${lotId} listed successfully on the KisanDirect National Grid!`,
      lot: {
        id: lotId,
        crop_name,
        variety: variety || 'High-Yield Hybrid',
        quantity_kg: qty,
        farmgate_price: price,
        mandi_benchmark_price: mandiPrice,
        qc_grade: grade,
        qc_hash: finalQcHash,
        freshness_score: fScore,
        ripeness_score: rScore,
        blemish_rate: bRate,
        diameter_mm: dMm,
        location: loc,
        status: 'available',
        harvest_date: hDate,
        image: img
      }
    });
  } catch (err) {
    console.error('createCrop error:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: err.message });
  }
};

exports.getMyCrops = async (req, res) => {
  try {
    const crops = db.prepare(`
      SELECT * FROM crop_lots
      WHERE farmer_id = ?
      ORDER BY created_at DESC
    `).all(req.user.id);

    res.json({
      success: true,
      count: crops.length,
      crops
    });
  } catch (err) {
    console.error('getMyCrops error:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: err.message });
  }
};

exports.getPayouts = async (req, res) => {
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
        o.created_at,
        c.crop_name,
        c.farmgate_price,
        b.name as buyer_name
      FROM orders o
      JOIN crop_lots c ON o.crop_lot_id = c.id
      JOIN users b ON o.buyer_id = b.id
      WHERE o.farmer_id = ?
      ORDER BY o.created_at DESC
    `).all(req.user.id);

    let totalEarnings = 0;
    let pendingEscrow = 0;
    let settledPayouts = 0;

    orders.forEach(o => {
      totalEarnings += o.total_amount;
      if (o.escrow_status === 'settled' || o.status === 'delivered') {
        settledPayouts += o.total_amount;
      } else if (o.status !== 'rejected') {
        pendingEscrow += o.total_amount;
      }
    });

    res.json({
      success: true,
      summary: {
        totalEarnings,
        pendingEscrow,
        settledPayouts,
        ordersCount: orders.length,
        settlementPolicy: 'T+1 Direct Escrow Settlement upon Reefer Pickup Verification'
      },
      orders
    });
  } catch (err) {
    console.error('getPayouts error:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: err.message });
  }
};
