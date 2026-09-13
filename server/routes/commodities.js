const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/commodities - Returns all commodities grouped by category
router.get('/', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT 
        c.id, 
        c.name, 
        c.category_id, 
        p.name AS category,
        c.standard_unit, 
        c.base_mandi_benchmark_rate, 
        c.shelf_life_days, 
        c.target_reefer_temp_celsius, 
        c.image, 
        c.description
      FROM commodities c
      JOIN produce_categories p ON c.category_id = p.id
      ORDER BY p.name ASC, c.name ASC
    `).all();

    // Group by category
    const grouped = {};
    for (const item of rows) {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    }

    res.json({
      success: true,
      count: rows.length,
      commodities: rows,
      grouped
    });
  } catch (err) {
    console.error('Error fetching commodities:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/commodities - Dynamically register any new crop/fruit/vegetable/grain
router.post('/', (req, res) => {
  try {
    const {
      name,
      category = 'Vegetables',
      standard_unit = 'kg',
      base_mandi_benchmark_rate = 20.0,
      shelf_life_days = 14,
      target_reefer_temp_celsius = 4.0,
      image = 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80',
      description = 'Fresh farmgate produce dynamically registered on KisanDirect AI platform.'
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Produce name is required' });
    }

    // Check if category exists or create it
    let catRow = db.prepare('SELECT id FROM produce_categories WHERE LOWER(name) = LOWER(?)').get(category);
    if (!catRow) {
      const catRes = db.prepare('INSERT INTO produce_categories (name) VALUES (?)').run(category);
      catRow = { id: catRes.lastInsertRowid };
    }

    // Check if commodity already exists
    const existing = db.prepare('SELECT * FROM commodities WHERE LOWER(name) = LOWER(?)').get(name.trim());
    if (existing) {
      return res.json({
        success: true,
        message: 'Commodity already registered',
        commodity: existing
      });
    }

    const id = `COMM-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    db.prepare(`
      INSERT INTO commodities (
        id, category_id, name, standard_unit, base_mandi_benchmark_rate,
        shelf_life_days, target_reefer_temp_celsius, image, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      catRow.id,
      name.trim(),
      standard_unit,
      parseFloat(base_mandi_benchmark_rate) || 20.0,
      parseInt(shelf_life_days) || 14,
      parseFloat(target_reefer_temp_celsius) || 4.0,
      image,
      description
    );

    const created = db.prepare(`
      SELECT c.*, p.name as category 
      FROM commodities c 
      JOIN produce_categories p ON c.category_id = p.id 
      WHERE c.id = ?
    `).get(id);

    res.status(201).json({
      success: true,
      message: 'New commodity registered successfully',
      commodity: created
    });
  } catch (err) {
    console.error('Error creating commodity:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
