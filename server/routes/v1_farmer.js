const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

// All endpoints in this router require FARMER role
router.use(verifyToken);
router.use(requireRole(['farmer']));

/**
 * POST /api/v1/farmer/batches
 * Post/manage crop batches (Lot ID, crop name, quantity, farmgate price, harvest date, location)
 */
router.post('/batches', (req, res) => {
  try {
    const {
      crop_name,
      variety,
      quantity_kg,
      farmgate_price,
      mandi_price,
      qc_grade,
      location,
      harvest_date,
      dispatch_schedule,
      image
    } = req.body;

    if (!crop_name || !quantity_kg || !farmgate_price) {
      return res.status(400).json({
        success: false,
        error: 'Crop name, quantity (kg), and farmgate price are required.'
      });
    }

    const lotId = `LOT-${crop_name.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const calculatedMandi = mandi_price || +(farmgate_price * 0.72).toFixed(2);
    const grade = qc_grade || 'Grade A';
    
    // Generate tamper-proof SHA-256 QC hash
    const qcData = `${lotId}|${req.user.id}|${crop_name}|${quantity_kg}|${grade}|${Date.now()}`;
    const qcHash = `SHA256: ${crypto.createHash('sha256').update(qcData).digest('hex')}`;
    const loc = location || req.user.state_district || 'Nashik, Maharashtra';
    const hDate = harvest_date || new Date().toISOString().split('T')[0];
    const dispatch = dispatch_schedule || 'Reefer pickup within 24 hours of Escrow lock';
    const img = image || 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=600&q=80';

    // Insert into produce_lots
    db.prepare(`
      INSERT INTO produce_lots (
        id, farmer_id, crop_name, variety, quantity_kg,
        farmgate_price, mandi_price, qc_grade, qc_hash,
        location, status, image, harvest_date, dispatch_schedule, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, ?)
    `).run(
      lotId,
      req.user.id,
      crop_name,
      variety || 'Standard Hybrid',
      parseFloat(quantity_kg),
      parseFloat(farmgate_price),
      parseFloat(calculatedMandi),
      grade,
      qcHash,
      loc,
      img,
      hDate,
      dispatch,
      new Date().toISOString()
    );

    // Also mirror to produce_listings for cross-table compatibility
    try {
      db.prepare(`
        INSERT INTO produce_listings (
          id, farmer_id, commodity_name, category, variety,
          available_qty, unit, farmgate_price_per_unit, mandi_reference_price,
          quality_grade, harvest_date, location_pin, image, status, created_at
        ) VALUES (?, ?, ?, 'Vegetables', ?, ?, 'kg', ?, ?, ?, ?, ?, ?, 'AVAILABLE', ?)
      `).run(
        lotId,
        req.user.id,
        crop_name,
        variety || 'Standard Hybrid',
        parseFloat(quantity_kg),
        parseFloat(farmgate_price),
        parseFloat(calculatedMandi),
        grade,
        hDate,
        loc,
        img,
        new Date().toISOString()
      );
    } catch (e) {
      // Ignore if table or constraint mirrors already
    }

    res.status(201).json({
      success: true,
      message: `Harvest batch ${lotId} listed successfully on the KisanDirect AI National Grid!`,
      batch: {
        id: lotId,
        lot_id: lotId,
        crop_name,
        variety: variety || 'Standard Hybrid',
        quantity_kg: parseFloat(quantity_kg),
        farmgate_price: parseFloat(farmgate_price),
        mandi_price: parseFloat(calculatedMandi),
        qc_grade: grade,
        qc_hash: qcHash,
        location: loc,
        status: 'available',
        harvest_date: hDate,
        dispatch_schedule: dispatch
      }
    });
  } catch (err) {
    console.error('Create farmer batch error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/farmer/batches
 * List farmer's own lots with statuses ('available', 'pending_approval', 'sold')
 */
router.get('/batches', (req, res) => {
  try {
    const lots = db.prepare(`
      SELECT * FROM produce_lots
      WHERE farmer_id = ?
      ORDER BY created_at DESC
    `).all(req.user.id);

    res.json({
      success: true,
      count: lots.length,
      batches: lots
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/farmer/payouts
 * Escrow settlement logs & direct earnings
 */
router.get('/payouts', (req, res) => {
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
        o.created_at,
        p.crop_name,
        p.farmgate_price,
        b.name as buyer_name
      FROM orders o
      LEFT JOIN produce_lots p ON o.lot_id = p.id
      LEFT JOIN users b ON o.buyer_id = b.id
      WHERE o.farmer_id = ? OR o.seller_id = ?
      ORDER BY o.created_at DESC
    `).all(req.user.id, req.user.id);

    // Calculate aggregated metrics
    let totalDirectEarnings = 0;
    let pendingEscrowAmount = 0;
    let settledEscrowAmount = 0;

    orders.forEach(o => {
      const amt = o.total_amount || o.total_price || 0;
      if (o.escrow_status === 'settled' || o.order_status === 'DELIVERED') {
        settledEscrowAmount += amt;
      } else {
        pendingEscrowAmount += amt;
      }
      totalDirectEarnings += amt;
    });

    res.json({
      success: true,
      summary: {
        totalDirectEarnings,
        pendingEscrowAmount,
        settledEscrowAmount,
        activeOrdersCount: orders.length,
        payoutMethod: 'T+1 Direct Bank Escrow Settlement'
      },
      payouts: orders.map(o => ({
        id: o.id,
        order_number: o.order_number || o.id,
        crop_name: o.crop_name || 'Harvest Produce',
        buyer_name: o.buyer_name || 'Verified Institutional Buyer',
        quantity: o.quantity,
        amount: o.total_amount || o.total_price || 0,
        escrow_status: o.escrow_status || 'held',
        verification_status: o.verification_status,
        tracking_status: o.tracking_status,
        settlement_window: 'T+1 Dispatch Completed',
        date: o.created_at
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
