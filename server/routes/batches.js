const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, optionalAuthToken } = require('../middleware/auth');

// GET /api/batches?commodity_id=&status=&user_only=
router.get('/', optionalAuthToken, (req, res) => {
  try {
    const { commodity_id, status, user_only } = req.query;

    if (user_only === 'true') {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required to view your personal farm listings.'
        });
      }
    }

    let query = `
      SELECT 
        b.id,
        b.lot_number,
        b.user_id,
        b.farmer_fpo_name,
        b.commodity_id,
        c.name AS commodity_name,
        p.name AS category,
        c.image AS commodity_image,
        c.shelf_life_days,
        c.target_reefer_temp_celsius,
        b.variety,
        b.quantity,
        b.unit,
        b.farmgate_rate,
        b.mandi_rate,
        b.quality_grade,
        b.harvest_date,
        b.pickup_location,
        b.dispatch_schedule,
        b.status
      FROM crop_batches b
      JOIN commodities c ON b.commodity_id = c.id
      JOIN produce_categories p ON c.category_id = p.id
      WHERE 1=1
    `;

    const params = [];
    if (user_only === 'true' && req.user) {
      query += ` AND b.user_id = ?`;
      params.push(req.user.id);
    }
    if (commodity_id) {
      query += ` AND b.commodity_id = ?`;
      params.push(commodity_id);
    }
    if (status) {
      query += ` AND LOWER(b.status) = LOWER(?)`;
      params.push(status);
    }

    query += ` ORDER BY b.id DESC`;

    const rows = db.prepare(query).all(...params);

    // Compute dynamic margins and middleman elimination economics
    const batches = rows.map(b => {
      const farmgate = parseFloat(b.farmgate_rate);
      const mandi = parseFloat(b.mandi_rate);
      const farmerExtra = +(farmgate - mandi).toFixed(2);
      const farmerExtraPct = mandi > 0 ? Math.round((farmerExtra / mandi) * 100) : 0;
      
      const retailMandi = +(mandi * 2.15).toFixed(2);
      const consumerPrice = +(farmgate * 1.18).toFixed(2);
      const consumerSavings = +(retailMandi - consumerPrice).toFixed(2);
      const consumerSavingsPct = retailMandi > 0 ? Math.round((consumerSavings / retailMandi) * 100) : 0;

      return {
        ...b,
        isOwner: req.user ? b.user_id === req.user.id : false,
        economics: {
          farmgateRate: farmgate,
          mandiRate: mandi,
          farmerGainPerUnit: farmerExtra,
          farmerGainPercent: farmerExtraPct,
          retailMandiPrice: retailMandi,
          consumerDirectPrice: consumerPrice,
          consumerSavingsPerUnit: consumerSavings,
          consumerSavingsPercent: consumerSavingsPct,
          middlemanCessSaved: +(farmerExtra * 1.25).toFixed(2)
        }
      };
    });

    res.json({
      success: true,
      count: batches.length,
      batches
    });
  } catch (err) {
    console.error('Error fetching batches:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/batches - List a new harvest batch securely linked to user account
router.post('/', authenticateToken, (req, res) => {
  try {
    let {
      commodity_id,
      commodity_name,
      category = 'Vegetables',
      farmer_fpo_name,
      variety = 'Certified Cultivar',
      quantity,
      unit = 'Quintals',
      farmgate_rate,
      mandi_rate,
      quality_grade = 'Grade A (Export Quality)',
      harvest_date = new Date().toISOString().split('T')[0],
      pickup_location,
      dispatch_schedule = 'Today, Reefer Scheduled',
      status = 'Listed'
    } = req.body;

    // Default farmer_fpo_name and pickup_location from authenticated user if not passed
    const resolvedFarmerName = (farmer_fpo_name || req.user.name || 'Verified Producer FPO').trim();
    const resolvedLocation = (pickup_location || req.user.district_state || 'Nashik, Maharashtra').trim();

    if (!quantity || !farmgate_rate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: quantity, farmgate_rate'
      });
    }

    // Dynamic Commodity Resolution:
    let commodity = null;
    if (commodity_id) {
      commodity = db.prepare('SELECT * FROM commodities WHERE id = ?').get(commodity_id);
    }
    if (!commodity && commodity_name) {
      commodity = db.prepare('SELECT * FROM commodities WHERE LOWER(name) = LOWER(?)').get(commodity_name.trim());
    }

    // If still not found, auto-register the new produce!
    if (!commodity) {
      const resolvedName = (commodity_name || 'Seasonal Produce').trim();
      let catRow = db.prepare('SELECT id FROM produce_categories WHERE LOWER(name) = LOWER(?)').get(category);
      if (!catRow) {
        const catRes = db.prepare('INSERT INTO produce_categories (name) VALUES (?)').run(category);
        catRow = { id: catRes.lastInsertRowid };
      }

      const newCommId = `COMM-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
      const benchmark = mandi_rate ? parseFloat(mandi_rate) : (parseFloat(farmgate_rate) * 0.68);

      db.prepare(`
        INSERT INTO commodities (
          id, category_id, name, standard_unit, base_mandi_benchmark_rate,
          shelf_life_days, target_reefer_temp_celsius, image, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newCommId,
        catRow.id,
        resolvedName,
        unit.toLowerCase().includes('crate') ? 'crate' : 'kg',
        +benchmark.toFixed(2),
        14,
        5.0,
        'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80',
        `Freshly harvested ${resolvedName} listed directly by ${resolvedFarmerName} on KisanDirect AI.`
      );

      commodity = db.prepare('SELECT * FROM commodities WHERE id = ?').get(newCommId);
    }

    const farmgateRateNum = parseFloat(farmgate_rate);
    const mandiRateNum = mandi_rate ? parseFloat(mandi_rate) : +(farmgateRateNum * 0.65).toFixed(2);

    // Auto-generate Lot Number
    const randomLotDigits = Math.floor(100 + Math.random() * 900);
    const lot_number = `LOT-${randomLotDigits}`;
    const batch_id = `BATCH-${Date.now().toString(36).toUpperCase()}`;

    db.prepare(`
      INSERT INTO crop_batches (
        id, lot_number, user_id, farmer_fpo_name, commodity_id, variety, quantity, unit,
        farmgate_rate, mandi_rate, quality_grade, harvest_date, pickup_location,
        dispatch_schedule, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      batch_id,
      lot_number,
      req.user.id,
      resolvedFarmerName,
      commodity.id,
      variety,
      parseFloat(quantity),
      unit,
      farmgateRateNum,
      mandiRateNum,
      quality_grade,
      harvest_date,
      resolvedLocation,
      dispatch_schedule,
      status
    );

    const created = db.prepare(`
      SELECT 
        b.*, 
        c.name as commodity_name, 
        c.image as commodity_image,
        p.name as category
      FROM crop_batches b
      JOIN commodities c ON b.commodity_id = c.id
      JOIN produce_categories p ON c.category_id = p.id
      WHERE b.id = ?
    `).get(batch_id);

    const farmerExtra = +(farmgateRateNum - mandiRateNum).toFixed(2);
    const farmerExtraPct = Math.round((farmerExtra / mandiRateNum) * 100);

    res.status(201).json({
      success: true,
      message: `Batch #${lot_number} for ${commodity.name} listed successfully under ${req.user.name}!`,
      batch: {
        ...created,
        isOwner: true,
        economics: {
          farmgateRate: farmgateRateNum,
          mandiRate: mandiRateNum,
          farmerGainPerUnit: farmerExtra,
          farmerGainPercent: farmerExtraPct,
          retailMandiPrice: +(mandiRateNum * 2.15).toFixed(2),
          consumerDirectPrice: +(farmgateRateNum * 1.18).toFixed(2)
        }
      }
    });
  } catch (err) {
    console.error('Error creating batch:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
