const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// Ensure DB is initialized
const db = require('./db');

const authRoutes = require('./routes/authRoutes');
const farmerRoutes = require('./routes/farmerRoutes');
const buyerRoutes = require('./routes/buyerRoutes');
const ownerRoutes = require('./routes/ownerRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const voiceRoutes = require('./routes/voiceRoutes');

// REST API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/farmer', farmerRoutes);
app.use('/api/buyer', buyerRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/voice', voiceRoutes);

// Top-Level Aliases for Marketplace, Orders, and Logistics
const buyerController = require('./controllers/buyerController');
const { requireAuth } = require('./middleware/requireAuth');
const { requireRole } = require('./middleware/requireRole');

app.get('/api/marketplace/lots', buyerController.getMarketplace);
app.post('/api/orders/checkout', requireAuth, requireRole(['buyer']), buyerController.placeOrder);
app.get('/api/logistics/telemetry/:orderId', buyerController.getOrderTelemetry);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const users = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const crops = db.prepare('SELECT COUNT(*) as count FROM crop_lots').get().count;
  const orders = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;

  res.json({
    status: 'online',
    platform: 'KisanDirect AI Multi-Portal Architecture',
    stats: { users, crops, orders },
    timestamp: new Date().toISOString()
  });
});

const fs = require('fs');

// Static build directories
const distDir = path.join(__dirname, '..', 'frontend', 'dist');
const publicDir = path.join(__dirname, '..', 'frontend', 'public');
const srcDir = path.join(__dirname, '..', 'frontend', 'src');
const rootDir = path.join(__dirname, '..');

// Primary SPA HTML shell for Multi-Portal Architecture
const spaIndexHtml = fs.existsSync(path.join(distDir, 'index.html'))
  ? path.join(distDir, 'index.html')
  : path.join(publicDir, 'index.html');

// Storefront (KisanDirect Mobile-First Agri-Marketplace)
const rootStoreHtml = fs.existsSync(path.join(rootDir, 'store.html'))
  ? path.join(rootDir, 'store.html')
  : path.join(rootDir, 'index.html');

// 1. Explicit SPA Multi-Portal Routes
app.get('/', (req, res) => res.sendFile(spaIndexHtml));
app.get('/index.html', (req, res) => res.sendFile(spaIndexHtml));
app.get('/auth/login', (req, res) => res.sendFile(spaIndexHtml));
app.get('/farmer/dashboard', (req, res) => res.sendFile(spaIndexHtml));
app.get('/buyer/marketplace', (req, res) => res.sendFile(spaIndexHtml));
app.get('/owner/control-room', (req, res) => res.sendFile(spaIndexHtml));

// 2. Direct Storefront & Classic Multi-Page Routes
app.get('/store', (req, res) => res.sendFile(rootStoreHtml));
app.get('/store.html', (req, res) => res.sendFile(rootStoreHtml));
app.get('/shop', (req, res) => res.sendFile(rootStoreHtml));
app.get('/mandi', (req, res) => res.sendFile(rootStoreHtml));
app.get('/storefront', (req, res) => res.sendFile(rootStoreHtml));
app.get('/marketplace-classic', (req, res) => res.sendFile(rootStoreHtml));

// Standalone Portal Pages
app.get('/login', (req, res) => res.sendFile(path.join(rootDir, 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(rootDir, 'register.html')));
app.get('/admin-portal', (req, res) => res.sendFile(path.join(rootDir, 'admin-portal.html')));
app.get('/farmer-hub', (req, res) => res.sendFile(path.join(rootDir, 'farmer-hub.html')));
app.get('/marketplace-hub', (req, res) => res.sendFile(path.join(rootDir, 'marketplace.html')));
app.get('/quality-scanner', (req, res) => res.sendFile(path.join(rootDir, 'quality-scanner.html')));
app.get('/route-optimizer', (req, res) => res.sendFile(path.join(rootDir, 'route-optimizer.html')));
app.get('/demand-forecast', (req, res) => res.sendFile(path.join(rootDir, 'demand-forecast.html')));
app.get('/doca-control', (req, res) => res.sendFile(path.join(rootDir, 'doca-control.html')));

// 3. Admin & Owner API Compatibility
const ownerController = require('./controllers/ownerController');
app.get('/api/owner/dashboard-metrics', ownerController.getDashboardMetrics);
app.get('/api/owner/pending-users', ownerController.getPendingUsers);
app.post('/api/owner/approve-user/:id', ownerController.approveUser);
app.post('/api/owner/reject-user/:id', ownerController.rejectUser);
app.get('/api/admin/all-orders', ownerController.getAllOrders);
app.put('/api/admin/orders/:id/status', ownerController.updateOrderStatus);

// 4. Commodities, Batches, QC, Forecast, and DOCA Surveillance Endpoints
try {
  const commoditiesRouter = require('../server/routes/commodities');
  const batchesRouter = require('../server/routes/batches');
  const qcRouter = require('../server/routes/qc');
  const forecastRouter = require('../server/routes/forecast');
  
  app.use('/api/commodities', commoditiesRouter);
  app.use('/api/batches', batchesRouter);
  app.use('/api/qc', qcRouter);
  app.use('/api/forecast', forecastRouter);
} catch (e) {
  console.warn('[Server] Legacy router mount notice:', e.message);
}

// DOCA Surveillance Endpoint
app.get('/api/doca/surveillance', (req, res) => {
  try {
    const serverDb = require('../server/db');
    const commodities = serverDb.prepare(`
      SELECT c.*, p.name as category
      FROM commodities c
      JOIN produce_categories p ON c.category_id = p.id
      ORDER BY c.price_volatility_score DESC
    `).all();

    const priceSpikeAlerts = commodities.filter(c => c.price_volatility_score > 60);

    res.json({
      success: true,
      surveillance: {
        timestamp: new Date().toISOString(),
        totalTrackedCommodities: commodities.length,
        priceSpikeAlertsCount: priceSpikeAlerts.length,
        commodities
      }
    });
  } catch (err) {
    res.json({ success: true, surveillance: { timestamp: new Date().toISOString(), commodities: [] } });
  }
});

// 5. Static Assets Serving
app.use(express.static(rootDir, { index: false }));
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: false }));
}
app.use(express.static(publicDir, { index: false }));
app.use('/src', express.static(srcDir));
app.use(express.static(srcDir));

// 6. Client-Side Catch-All Fallback (Serves SPA shell so Router handles with zero 404s)
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: 'API_ENDPOINT_NOT_FOUND',
      message: `API route ${req.method} ${req.path} not found`
    });
  }
  res.sendFile(spaIndexHtml);
});

const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`[KisanDirect AI] Multi-Portal Unified Production Server running at http://${HOST}:${PORT}`);
});

// Graceful shutdown handling for container termination & cloud orchestrators
function gracefulShutdown(signal) {
  console.log(`[KisanDirect AI] Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('[KisanDirect AI] Closed out remaining active HTTP connections.');
    try {
      db.close();
      console.log('[KisanDirect AI] Database connection safely closed.');
    } catch (e) {}
    process.exit(0);
  });

  // Force close after 5s if still hanging
  setTimeout(() => {
    console.error('[KisanDirect AI] Could not close connections in time, forcefully shutting down.');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, server };
