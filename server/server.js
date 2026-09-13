const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const db = require('./db');
const commoditiesRouter = require('./routes/commodities');
const batchesRouter = require('./routes/batches');
const qcRouter = require('./routes/qc');
const forecastRouter = require('./routes/forecast');
const ordersRouter = require('./routes/orders');
const authRouter = require('./routes/auth');
const voiceRouter = require('./routes/voice');
const farmerRouter = require('./routes/farmer');
const buyerRouter = require('./routes/buyer');
const adminRouter = require('./routes/admin');
const ownerRouter = require('./routes/owner');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Root URL serves the full KisanDirect AI web platform
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));

// Serve static frontend files from workspace root
app.use(express.static(path.join(__dirname, '..')));

// REST API Endpoints (v1 Standardized APIs)
const v1AuthRouter = require('./routes/v1_auth');
const v1AdminRouter = require('./routes/v1_admin');
const v1FarmerRouter = require('./routes/v1_farmer');
const v1BuyerRouter = require('./routes/v1_buyer');
const v1MandiVoiceRouter = require('./routes/v1_mandi_voice');

app.use('/api/v1/auth', v1AuthRouter);
app.use('/api/v1/admin', v1AdminRouter);
app.use('/api/v1/farmer', v1FarmerRouter);
app.use('/api/v1/marketplace', v1BuyerRouter);
app.use('/api/v1/orders', v1BuyerRouter);
app.use('/api/v1', v1MandiVoiceRouter);

// Legacy and helper REST API Endpoints
app.use('/api/auth', authRouter);
app.use('/api/owner', ownerRouter);
app.use('/api/farmer', farmerRouter);
app.use('/api/buyer', buyerRouter);
app.use('/api/admin', adminRouter);
app.use('/api/commodities', commoditiesRouter);
app.use('/api/batches', batchesRouter);
app.use('/api/qc', qcRouter);
app.use('/api/forecast', forecastRouter);
app.use('/api/voice', voiceRouter);
app.use('/api', ordersRouter);

// Frontend Multi-Page Routes
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '..', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, '..', 'register.html')));
app.get('/marketplace', (req, res) => res.sendFile(path.join(__dirname, '..', 'marketplace.html')));
app.get('/buyer-portal', (req, res) => res.sendFile(path.join(__dirname, '..', 'marketplace.html')));
app.get('/buyer/dashboard', (req, res) => res.sendFile(path.join(__dirname, '..', 'marketplace.html')));
app.get('/farmer-hub', (req, res) => res.sendFile(path.join(__dirname, '..', 'farmer-hub.html')));
app.get('/farmer-portal', (req, res) => res.sendFile(path.join(__dirname, '..', 'farmer-hub.html')));
app.get('/farmer/dashboard', (req, res) => res.sendFile(path.join(__dirname, '..', 'farmer-hub.html')));
app.get('/admin-portal', (req, res) => res.sendFile(path.join(__dirname, '..', 'admin-portal.html')));
app.get('/owner/dashboard', (req, res) => res.sendFile(path.join(__dirname, '..', 'admin-portal.html')));
app.get('/quality-scanner', (req, res) => res.sendFile(path.join(__dirname, '..', 'quality-scanner.html')));
app.get('/demand-forecast', (req, res) => res.sendFile(path.join(__dirname, '..', 'demand-forecast.html')));
app.get('/route-optimizer', (req, res) => res.sendFile(path.join(__dirname, '..', 'route-optimizer.html')));
app.get('/doca-control', (req, res) => res.sendFile(path.join(__dirname, '..', 'doca-control.html')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  const commCount = db.prepare('SELECT COUNT(*) as count FROM commodities').get().count;
  const batchCount = db.prepare('SELECT COUNT(*) as count FROM crop_batches').get().count;
  res.json({
    status: 'online',
    platform: 'KisanDirect AI Supply Chain & Marketplace',
    version: '2.0.0-universal',
    commoditiesCount: commCount,
    batchesCount: batchCount,
    timestamp: new Date().toISOString()
  });
});

// DOCA Surveillance Live Aggregation Endpoint
app.get('/api/doca/surveillance', (req, res) => {
  try {
    const commodities = db.prepare(`
      SELECT c.*, p.name as category
      FROM commodities c
      JOIN produce_categories p ON c.category_id = p.id
      ORDER BY c.name ASC
    `).all();

    // Map each commodity to live farmgate vs mandi retail price spreads
    const surveillance = commodities.map(c => {
      const baseMandi = c.base_mandi_benchmark_rate;
      const farmgate = +(baseMandi * 1.45).toFixed(2);
      const wholesaleMandi = +(baseMandi * 1.30).toFixed(2);
      const retailUrban = +(baseMandi * 2.30).toFixed(2);
      const kisanDirect = +(farmgate * 1.18).toFixed(2);

      const mandiSpreadPct = Math.round(((retailUrban - baseMandi) / baseMandi) * 100);
      const kdSpreadPct = Math.round(((kisanDirect - farmgate) / farmgate) * 100);
      const farmerGainPct = Math.round(((farmgate - baseMandi) / baseMandi) * 100);
      const consumerSavingPct = Math.round(((retailUrban - kisanDirect) / retailUrban) * 100);

      let riskLevel = 'Stable';
      if (mandiSpreadPct > 120) riskLevel = 'High Price Spread';
      else if (mandiSpreadPct > 80) riskLevel = 'Moderate Risk';

      return {
        id: c.id,
        commodity: c.name,
        category: c.category,
        state: c.category === 'Fruits' ? 'Maharashtra / HP' : 'Maharashtra / UP / Karnataka',
        keyMandi: `${c.name.split(' ')[0]} APMC`,
        farmgateAvgPrice: `₹ ${farmgate.toFixed(2)} / ${c.standard_unit}`,
        mandiWholesalePrice: `₹ ${wholesaleMandi.toFixed(2)} / ${c.standard_unit}`,
        retailUrbanPrice: `₹ ${retailUrban.toFixed(2)} / ${c.standard_unit}`,
        kisanDirectPrice: `₹ ${kisanDirect.toFixed(2)} / ${c.standard_unit}`,
        priceSpreadPct: `+${mandiSpreadPct}%`,
        kisanDirectSpreadPct: `+${kdSpreadPct}%`,
        farmerGainPct: `+${farmerGainPct}%`,
        consumerSavingPct: `-${consumerSavingPct}%`,
        riskLevel
      };
    });

    res.json({
      success: true,
      count: surveillance.length,
      surveillance
    });
  } catch (err) {
    console.error('Error fetching DOCA surveillance:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback routing: API routes return 404 JSON, unmapped frontend routes serve index.html
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: `API route ${req.method} ${req.path} not found`
    });
  }
  const rootFilePath = path.join(__dirname, '..', req.path);
  if (fs.existsSync(rootFilePath) && fs.statSync(rootFilePath).isFile()) {
    return res.sendFile(rootFilePath);
  }
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Start server on 0.0.0.0 for cloud container and Render compatibility
const HOST = process.env.HOST || '0.0.0.0';
const server = app.listen(PORT, HOST, () => {
  console.log(`[KisanDirect AI] Universal Agri-Marketplace Backend running on http://${HOST}:${PORT}`);
});

module.exports = { app, server };
