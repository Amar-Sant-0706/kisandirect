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

// 1. Serve frontend static build directly from root route '/'
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}
app.use(express.static(publicDir));
app.use('/src', express.static(srcDir));
app.use(express.static(srcDir));

// Fallback index.html path (prefers dist if built, otherwise public)
const indexHtmlPath = fs.existsSync(path.join(distDir, 'index.html'))
  ? path.join(distDir, 'index.html')
  : path.join(publicDir, 'index.html');

// Explicit root route serving the KisanDirect AI Multi-Portal Application
app.get('/', (req, res) => res.sendFile(indexHtmlPath));
app.get('/index.html', (req, res) => res.sendFile(indexHtmlPath));

// 2. Client-side routing catch-all fallback:
// Any non-API route (e.g. /farmer/dashboard, /buyer/marketplace, /owner/control-room, /auth/login)
// is served the frontend index.html so client router handles it seamlessly with zero 404s.
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: 'API_ENDPOINT_NOT_FOUND',
      message: `API route ${req.method} ${req.path} not found`
    });
  }
  res.sendFile(indexHtmlPath);
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
