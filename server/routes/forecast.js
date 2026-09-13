const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/forecast/:commodityId - Dynamic 15-day price prediction & supply glut advisory
router.get('/:commodityId', (req, res) => {
  try {
    const { commodityId } = req.params;

    // Search by ID or by name
    let commodity = db.prepare('SELECT c.*, p.name as category FROM commodities c JOIN produce_categories p ON c.category_id = p.id WHERE c.id = ?').get(commodityId);
    if (!commodity) {
      commodity = db.prepare('SELECT c.*, p.name as category FROM commodities c JOIN produce_categories p ON c.category_id = p.id WHERE LOWER(c.name) LIKE LOWER(?)').get(`%${commodityId}%`);
    }

    if (!commodity) {
      return res.status(404).json({ success: false, error: `Commodity '${commodityId}' not found` });
    }

    // Check if a pre-cached forecast exists in DB
    const existing = db.prepare('SELECT * FROM market_trends_forecasts WHERE commodity_id = ?').get(commodity.id);
    if (existing) {
      const hist = JSON.parse(existing.historical_prices);
      const pred = JSON.parse(existing.predicted_prices_15d);
      return res.json({
        success: true,
        commodity: {
          id: commodity.id,
          name: commodity.name,
          category: commodity.category,
          baseRate: commodity.base_mandi_benchmark_rate
        },
        forecast: {
          crop: commodity.name,
          historicalDays: hist.dates,
          historicalMandiPrice: hist.prices,
          forecastDays: pred.dates,
          predictedDemandMetric: pred.demandTons,
          predictedPriceMin: pred.min,
          predictedPriceMax: pred.max,
          volatilityIndex: existing.volatility_index,
          advisory: existing.harvest_advisory
        }
      });
    }

    // Otherwise, dynamically generate 15-day seasonal prediction curves for ANY commodity
    const base = commodity.base_mandi_benchmark_rate;
    const cat = commodity.category.toLowerCase();

    // Generate dates: 8 historical days and 7 forecast days (spanning 15 days)
    const histDates = ["Aug 24", "Aug 26", "Aug 28", "Aug 30", "Sep 01", "Sep 03", "Sep 05", "Sep 07"];
    const forecastDates = ["Sep 09", "Sep 11", "Sep 13", "Sep 15", "Sep 17", "Sep 19", "Sep 21"];

    // Build historical curve with slight realistic variance around base mandi benchmark
    const histPrices = histDates.map((_, i) => {
      const factor = 0.94 + (i * 0.015) + ((i % 3) * 0.01);
      return +(base * factor).toFixed(1);
    });

    // Prediction band (Direct farmgate price is 30% to 55% higher than mandi benchmark)
    const directMultiplierMin = 1.35;
    const directMultiplierMax = 1.58;

    const predMin = forecastDates.map((_, i) => {
      const trend = 1 + (i * 0.02);
      return +(base * directMultiplierMin * trend).toFixed(1);
    });

    const predMax = forecastDates.map((_, i) => {
      const trend = 1 + (i * 0.025);
      return +(base * directMultiplierMax * trend).toFixed(1);
    });

    // Projected bulk demand metrics (Tons or Crates)
    const demandMetric = forecastDates.map((_, i) => {
      const baseDemand = cat.includes('fruit') ? 600 : cat.includes('grain') ? 1800 : 1200;
      return Math.round(baseDemand * (1 + (i * 0.08)));
    });

    let volatilityIndex = 'Moderate Volatility (Stable Festival Demand)';
    let advisory = `Seasonal consumption demand for ${commodity.name} is steadily climbing in Tier-1 urban nodes. FPOs are advised to schedule aggregated cold-chain dispatch to capture maximum direct farmgate realizations.`;

    if (cat.includes('fruit')) {
      volatilityIndex = 'High Premium Demand (Pre-Order Forward Locks Recommended)';
      advisory = `Festive and export window active for ${commodity.name}. Lock in forward B2B procurement agreements at minimum ₹${predMin[2]}/unit to mitigate sudden harvest flushes.`;
    } else if (cat.includes('grain') || cat.includes('pulse')) {
      volatilityIndex = 'Low Volatility (Steady Institutional Offtake)';
      advisory = `Institutional and wholesale buyer inquiries for ${commodity.name} remain firm. DOCA warehouse buffer stocks are stable. Direct farmgate contracts yielding +38% over APMC mandi rates.`;
    } else if (commodity.shelf_life_days < 12) {
      volatilityIndex = 'High Perishability Risk (Cold Chain Essential)';
      advisory = `Short transport shelf-life (${commodity.shelf_life_days} days). Dispatch via KisanDirect Reefer vans at ${commodity.target_reefer_temp_celsius}°C to avoid transit shrinkage.`;
    }

    res.json({
      success: true,
      commodity: {
        id: commodity.id,
        name: commodity.name,
        category: commodity.category,
        baseRate: commodity.base_mandi_benchmark_rate
      },
      forecast: {
        crop: commodity.name,
        historicalDays: histDates,
        historicalMandiPrice: histPrices,
        forecastDays: forecastDates,
        predictedDemandMetric: demandMetric,
        predictedPriceMin: predMin,
        predictedPriceMax: predMax,
        volatilityIndex,
        advisory
      }
    });
  } catch (err) {
    console.error('Error generating forecast:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
