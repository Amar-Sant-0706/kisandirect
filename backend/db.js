const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const fs = require('fs');

const dbPath = process.env.DATABASE_PATH || process.env.DB_PATH || path.join(__dirname, 'multi_portal.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      role TEXT NOT NULL CHECK(role IN ('farmer', 'buyer', 'owner')),
      name TEXT NOT NULL,
      phone TEXT,
      location TEXT,
      business_name TEXT,
      is_banned INTEGER DEFAULT 0,
      banned_reason TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS otp_store (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      otp_plain TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS crop_lots (
      id TEXT PRIMARY KEY,
      farmer_id TEXT NOT NULL REFERENCES users(id),
      crop_name TEXT NOT NULL,
      variety TEXT,
      category TEXT DEFAULT 'Vegetables',
      quantity_kg REAL NOT NULL,
      unit TEXT DEFAULT 'Quintals',
      farmgate_price REAL NOT NULL,
      mandi_benchmark_price REAL NOT NULL,
      qc_grade TEXT NOT NULL DEFAULT 'Grade A',
      qc_hash TEXT NOT NULL,
      freshness_score REAL DEFAULT 94.5,
      ripeness_score REAL DEFAULT 92.0,
      blemish_rate REAL DEFAULT 2.1,
      diameter_mm REAL DEFAULT 65.0,
      qc_cert_json TEXT,
      location TEXT NOT NULL,
      harvest_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'reserved', 'sold', 'delisted_banned')),
      image TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      buyer_id TEXT NOT NULL REFERENCES users(id),
      farmer_id TEXT NOT NULL REFERENCES users(id),
      crop_lot_id TEXT NOT NULL REFERENCES crop_lots(id),
      quantity REAL NOT NULL,
      total_amount REAL NOT NULL,
      escrow_status TEXT NOT NULL DEFAULT 'held' CHECK(escrow_status IN ('held', 'settled', 'refunded')),
      status TEXT NOT NULL DEFAULT 'pending_owner' CHECK(status IN ('pending_owner', 'approved', 'rejected', 'dispatched', 'delivered')),
      pickup_schedule TEXT,
      delivery_address TEXT NOT NULL,
      rejection_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_feed (
      id TEXT PRIMARY KEY,
      actor_name TEXT NOT NULL,
      role TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS banned_tokens (
      token_hash TEXT PRIMARY KEY,
      revoked_at TEXT NOT NULL
    );
  `);

  // Safe schema migrations for existing DBs
  try { db.exec("ALTER TABLE crop_lots ADD COLUMN freshness_score REAL DEFAULT 94.5;"); } catch(e) {}
  try { db.exec("ALTER TABLE crop_lots ADD COLUMN ripeness_score REAL DEFAULT 92.0;"); } catch(e) {}
  try { db.exec("ALTER TABLE crop_lots ADD COLUMN blemish_rate REAL DEFAULT 2.1;"); } catch(e) {}
  try { db.exec("ALTER TABLE crop_lots ADD COLUMN diameter_mm REAL DEFAULT 65.0;"); } catch(e) {}
  try { db.exec("ALTER TABLE crop_lots ADD COLUMN qc_cert_json TEXT;"); } catch(e) {}

  // Update existing crops that have null freshness
  try {
    db.exec(`
      UPDATE crop_lots 
      SET freshness_score = 96.2, ripeness_score = 94.0, blemish_rate = 1.4, diameter_mm = 68.0 
      WHERE crop_name LIKE '%Onion%' AND (freshness_score IS NULL OR freshness_score = 94.5);

      UPDATE crop_lots 
      SET freshness_score = 97.8, ripeness_score = 95.5, blemish_rate = 0.9, diameter_mm = 58.0 
      WHERE crop_name LIKE '%Tomato%' AND (freshness_score IS NULL OR freshness_score = 94.5);

      UPDATE crop_lots 
      SET freshness_score = 93.4, ripeness_score = 90.5, blemish_rate = 2.4, diameter_mm = 72.0 
      WHERE crop_name LIKE '%Potato%' AND (freshness_score IS NULL OR freshness_score = 94.5);
    `);
  } catch(e) {}

  // Seed default demo accounts
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const adminEmail = process.env.ADMIN_EMAIL || 'owner@kisandirect.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'owner123';

    const salt = bcrypt.genSaltSync(10);
    const ownerHash = bcrypt.hashSync(adminPassword, salt);
    const farmerHash = bcrypt.hashSync('farmer123', salt);
    const buyerHash = bcrypt.hashSync('buyer123', salt);

    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, role, name, phone, location, business_name, is_banned, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `);

    // 1. Owner Account (strictly protected)
    insertUser.run(
      'USR-OWNER-01',
      adminEmail,
      ownerHash,
      'owner',
      'DOCA Master Regulator',
      '+91-9800000000',
      'New Delhi Platform HQ',
      'Ministry of Consumer Affairs (DOCA)',
      new Date().toISOString()
    );

    // 2. Demo Farmer Account
    insertUser.run(
      'USR-FARMER-01',
      'farmer@kisandirect.gov.in',
      farmerHash,
      'farmer',
      'Ramesh Patil',
      '+91-9822019999',
      'Lasalgaon, Nashik, Maharashtra',
      'Sahyadri Farmers Co-op',
      new Date().toISOString()
    );

    // 3. Demo Buyer Account
    insertUser.run(
      'USR-BUYER-01',
      'procurement@reliancefresh.com',
      buyerHash,
      'buyer',
      'Vikram Mehta',
      '+91-9820011223',
      'Vashi APMC Sector 19, Navi Mumbai',
      'Reliance Fresh Logistics Hub',
      new Date().toISOString()
    );

    // Seed Crop Lots
    const insertCrop = db.prepare(`
      INSERT INTO crop_lots (
        id, farmer_id, crop_name, variety, category, quantity_kg, unit,
        farmgate_price, mandi_benchmark_price, qc_grade, qc_hash, location,
        harvest_date, status, image, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const crops = [
      {
        id: 'LOT-ONION-101',
        farmer_id: 'USR-FARMER-01',
        crop_name: 'Nashik Red Onion (Garwa)',
        variety: 'Garwa Pink Premium',
        category: 'Vegetables',
        quantity_kg: 4500,
        unit: 'Quintals (45 Qtl)',
        farmgate_price: 24.50,
        mandi_benchmark_price: 16.00,
        qc_grade: 'Grade A+',
        location: 'Lasalgaon, Nashik, MH',
        harvest_date: '2026-09-08',
        status: 'available',
        image: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=600&q=80'
      },
      {
        id: 'LOT-TOMATO-102',
        farmer_id: 'USR-FARMER-01',
        crop_name: 'Kolar Vine-Ripe Tomatoes',
        variety: 'Abhinav Seminis',
        category: 'Vegetables',
        quantity_kg: 3200,
        unit: 'Crates (320 Crates)',
        farmgate_price: 22.00,
        mandi_benchmark_price: 13.50,
        qc_grade: 'Grade A',
        location: 'Srinivaspur, Kolar, KA',
        harvest_date: '2026-09-10',
        status: 'available',
        image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80'
      },
      {
        id: 'LOT-POTATO-103',
        farmer_id: 'USR-FARMER-01',
        crop_name: 'Agra Chipsona White Potatoes',
        variety: 'Chipsona-3',
        category: 'Vegetables',
        quantity_kg: 8000,
        unit: 'Quintals (80 Qtl)',
        farmgate_price: 18.00,
        mandi_benchmark_price: 12.00,
        qc_grade: 'GlobalGAP',
        location: 'Fatehabad, Agra, UP',
        harvest_date: '2026-09-04',
        status: 'available',
        image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80'
      }
    ];

    crops.forEach(c => {
      const qcData = `${c.id}|${c.farmer_id}|${c.crop_name}|${c.quantity_kg}|${Date.now()}`;
      const qcHash = `SHA256: ${crypto.createHash('sha256').update(qcData).digest('hex')}`;
      insertCrop.run(
        c.id, c.farmer_id, c.crop_name, c.variety, c.category,
        c.quantity_kg, c.unit, c.farmgate_price, c.mandi_benchmark_price,
        c.qc_grade, qcHash, c.location, c.harvest_date, c.status, c.image,
        new Date().toISOString()
      );
    });

    // Seed an initial Order in 'pending_owner' state
    const insertOrder = db.prepare(`
      INSERT INTO orders (
        id, order_number, buyer_id, farmer_id, crop_lot_id, quantity,
        total_amount, escrow_status, status, pickup_schedule,
        delivery_address, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertOrder.run(
      'ORD-DEMO-001',
      'KD-ORD-9482',
      'USR-BUYER-01',
      'USR-FARMER-01',
      'LOT-ONION-101',
      150,
      3675.00,
      'held',
      'pending_owner',
      'Awaiting Owner Verification',
      'Reliance Fresh Logistics Depot, Vashi Sector 19, Navi Mumbai',
      new Date(Date.now() - 3600000 * 2).toISOString(),
      new Date(Date.now() - 3600000 * 2).toISOString()
    );

    // Seed Activity Feed
    const insertActivity = db.prepare(`
      INSERT INTO activity_feed (id, actor_name, role, action, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertActivity.run(
      'ACT-1',
      'Ramesh Patil',
      'farmer',
      'LISTED_CROP',
      'Listed 45 Quintals of Nashik Red Onion (Garwa) at ₹24.50/kg',
      new Date(Date.now() - 3600000 * 5).toISOString()
    );

    insertActivity.run(
      'ACT-2',
      'Vikram Mehta',
      'buyer',
      'SUBMITTED_ORDER',
      'Placed order KD-ORD-9482 for 150 kg Onion (Total: ₹3,675.00). Escrow held.',
      new Date(Date.now() - 3600000 * 2).toISOString()
    );
  }

  // Ensure configured ADMIN_EMAIL exists if customized in environment
  if (process.env.ADMIN_EMAIL) {
    const customEmail = process.env.ADMIN_EMAIL.trim().toLowerCase();
    const existing = db.prepare("SELECT id FROM users WHERE LOWER(email) = ? AND role = 'owner'").get(customEmail);
    if (!existing) {
      const adminPass = process.env.ADMIN_PASSWORD || 'owner123';
      const salt = bcrypt.genSaltSync(10);
      const customHash = bcrypt.hashSync(adminPass, salt);
      db.prepare(`
        INSERT OR REPLACE INTO users (id, email, password_hash, role, name, phone, location, business_name, is_banned, created_at)
        VALUES (?, ?, ?, 'owner', 'DOCA Master Regulator', '+91-9800000000', 'New Delhi Platform HQ', 'Ministry of Consumer Affairs (DOCA)', 0, ?)
      `).run(`USR-OWNER-ENV`, customEmail, customHash, new Date().toISOString());
    }
  }
}

initDatabase();

module.exports = db;
module.exports.initDatabase = initDatabase;
