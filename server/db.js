const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'kisandirect.db');
const db = new Database(dbPath);

// Enable foreign keys and WAL mode for high concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      approval_status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
      phone TEXT,
      state_district TEXT,
      district_state TEXT,
      farmer_details TEXT,
      buyer_details TEXT,
      business_name TEXT,
      gstin_number TEXT,
      fssai_license TEXT,
      kyc_status TEXT DEFAULT 'NOT_SUBMITTED',
      is_banned INTEGER DEFAULT 0,
      banned_reason TEXT,
      banned_at TEXT,
      created_at TEXT NOT NULL,
      approved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS produce_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS commodities (
      id TEXT PRIMARY KEY,
      category_id INTEGER NOT NULL REFERENCES produce_categories(id),
      name TEXT NOT NULL,
      standard_unit TEXT DEFAULT 'kg',
      base_mandi_benchmark_rate REAL NOT NULL,
      shelf_life_days INTEGER DEFAULT 14,
      target_reefer_temp_celsius REAL DEFAULT 4.0,
      image TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS produce_lots (
      id TEXT PRIMARY KEY,
      farmer_id TEXT NOT NULL REFERENCES users(id),
      crop_name TEXT NOT NULL,
      category TEXT DEFAULT 'Vegetables',
      variety TEXT,
      quantity_kg REAL NOT NULL,
      farmgate_price REAL NOT NULL,
      mandi_price REAL NOT NULL,
      qc_grade TEXT NOT NULL DEFAULT 'Grade A',
      qc_hash TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      image TEXT,
      harvest_date TEXT,
      dispatch_schedule TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS crop_batches (
      id TEXT PRIMARY KEY,
      lot_number TEXT NOT NULL UNIQUE,
      user_id TEXT REFERENCES users(id),
      farmer_fpo_name TEXT NOT NULL,
      commodity_id TEXT NOT NULL REFERENCES commodities(id),
      variety TEXT,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      farmgate_rate REAL NOT NULL,
      mandi_rate REAL NOT NULL,
      quality_grade TEXT NOT NULL,
      harvest_date TEXT NOT NULL,
      pickup_location TEXT NOT NULL,
      dispatch_schedule TEXT NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS produce_listings (
      id TEXT PRIMARY KEY,
      farmer_id TEXT NOT NULL REFERENCES users(id),
      commodity_name TEXT NOT NULL,
      category TEXT NOT NULL,
      variety TEXT,
      available_qty REAL NOT NULL,
      unit TEXT NOT NULL DEFAULT 'kg',
      farmgate_price_per_unit REAL NOT NULL,
      mandi_reference_price REAL NOT NULL,
      quality_grade TEXT NOT NULL,
      harvest_date TEXT NOT NULL,
      location_pin TEXT NOT NULL,
      image TEXT,
      status TEXT NOT NULL DEFAULT 'AVAILABLE',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL REFERENCES users(id),
      listing_id TEXT NOT NULL REFERENCES produce_listings(id),
      quantity REAL NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      buyer_id TEXT NOT NULL REFERENCES users(id),
      farmer_id TEXT NOT NULL REFERENCES users(id),
      seller_id TEXT REFERENCES users(id),
      listing_id TEXT,
      lot_id TEXT,
      quantity REAL NOT NULL,
      total_price REAL NOT NULL,
      total_amount REAL DEFAULT 0,
      escrow_status TEXT NOT NULL DEFAULT 'held',
      verification_status TEXT NOT NULL DEFAULT 'pending_owner',
      rejection_reason TEXT,
      pickup_schedule TEXT,
      tracking_status TEXT DEFAULT 'pending_verification',
      delivery_address TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'ESCROW_HELD',
      order_status TEXT NOT NULL DEFAULT 'ORDER_PLACED',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      performed_by TEXT,
      action TEXT NOT NULL,
      target_user_id TEXT,
      target_order_id TEXT,
      details TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mandi_rates (
      id TEXT PRIMARY KEY,
      commodity TEXT NOT NULL,
      market_name TEXT NOT NULL,
      state TEXT NOT NULL,
      min_price REAL NOT NULL,
      max_price REAL NOT NULL,
      modal_price REAL NOT NULL,
      date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS banned_tokens (
      token_hash TEXT PRIMARY KEY,
      revoked_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS qc_inspections (
      id TEXT PRIMARY KEY,
      commodity_id TEXT NOT NULL REFERENCES commodities(id),
      image_url TEXT,
      freshness_score REAL NOT NULL,
      ripeness_percentage REAL NOT NULL,
      defect_rate REAL NOT NULL,
      firmness_score REAL NOT NULL,
      grade TEXT NOT NULL,
      doca_qc_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS market_trends_forecasts (
      id TEXT PRIMARY KEY,
      commodity_id TEXT NOT NULL REFERENCES commodities(id),
      region_state TEXT,
      historical_prices TEXT NOT NULL,
      predicted_prices_15d TEXT NOT NULL,
      volatility_index TEXT NOT NULL,
      harvest_advisory TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders_and_inquiries (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      order_type TEXT NOT NULL,
      commodity_id TEXT REFERENCES commodities(id),
      quantity REAL NOT NULL,
      buyer_name TEXT NOT NULL,
      contact_phone TEXT,
      destination_city TEXT,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'Confirmed',
      created_at TEXT NOT NULL
    );
  `);

  // Migration helpers for existing users table
  try {
    const userCols = db.prepare(`PRAGMA table_info(users)`).all();
    if (!userCols.some(col => col.name === 'approval_status')) {
      db.exec(`ALTER TABLE users ADD COLUMN approval_status TEXT DEFAULT 'PENDING_APPROVAL';`);
    }
    if (!userCols.some(col => col.name === 'state_district')) {
      db.exec(`ALTER TABLE users ADD COLUMN state_district TEXT;`);
    }
    if (!userCols.some(col => col.name === 'farmer_details')) {
      db.exec(`ALTER TABLE users ADD COLUMN farmer_details TEXT;`);
    }
    if (!userCols.some(col => col.name === 'buyer_details')) {
      db.exec(`ALTER TABLE users ADD COLUMN buyer_details TEXT;`);
    }
    if (!userCols.some(col => col.name === 'approved_at')) {
      db.exec(`ALTER TABLE users ADD COLUMN approved_at TEXT;`);
    }
    if (!userCols.some(col => col.name === 'business_name')) {
      db.exec(`ALTER TABLE users ADD COLUMN business_name TEXT;`);
    }
    if (!userCols.some(col => col.name === 'gstin_number')) {
      db.exec(`ALTER TABLE users ADD COLUMN gstin_number TEXT;`);
    }
    if (!userCols.some(col => col.name === 'fssai_license')) {
      db.exec(`ALTER TABLE users ADD COLUMN fssai_license TEXT;`);
    }
    if (!userCols.some(col => col.name === 'kyc_status')) {
      db.exec(`ALTER TABLE users ADD COLUMN kyc_status TEXT DEFAULT 'NOT_SUBMITTED';`);
    }
    if (!userCols.some(col => col.name === 'is_banned')) {
      db.exec(`ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0;`);
    }
    if (!userCols.some(col => col.name === 'banned_reason')) {
      db.exec(`ALTER TABLE users ADD COLUMN banned_reason TEXT;`);
    }
    if (!userCols.some(col => col.name === 'banned_at')) {
      db.exec(`ALTER TABLE users ADD COLUMN banned_at TEXT;`);
    }
    // Sync state_district with district_state
    db.exec(`UPDATE users SET state_district = district_state WHERE state_district IS NULL AND district_state IS NOT NULL;`);
    // Sync approval_status if not set
    db.exec(`UPDATE users SET approval_status = 'APPROVED' WHERE approval_status IS NULL AND (UPPER(role) IN ('ADMIN', 'OWNER') OR kyc_status = 'APPROVED');`);
  } catch (e) {
    console.warn("Migration notice (users):", e.message);
  }

  try {
    const batchCols = db.prepare(`PRAGMA table_info(crop_batches)`).all();
    if (!batchCols.some(col => col.name === 'user_id')) {
      db.exec(`ALTER TABLE crop_batches ADD COLUMN user_id TEXT REFERENCES users(id);`);
    }
  } catch (e) {
    console.warn("Migration notice (crop_batches):", e.message);
  }

  try {
    const orderCols = db.prepare(`PRAGMA table_info(orders)`).all();
    if (!orderCols.some(col => col.name === 'seller_id')) {
      db.exec(`ALTER TABLE orders ADD COLUMN seller_id TEXT REFERENCES users(id);`);
    }
    if (!orderCols.some(col => col.name === 'lot_id')) {
      db.exec(`ALTER TABLE orders ADD COLUMN lot_id TEXT;`);
    }
    if (!orderCols.some(col => col.name === 'total_amount')) {
      db.exec(`ALTER TABLE orders ADD COLUMN total_amount REAL DEFAULT 0;`);
    }
    if (!orderCols.some(col => col.name === 'escrow_status')) {
      db.exec(`ALTER TABLE orders ADD COLUMN escrow_status TEXT DEFAULT 'held';`);
    }
    if (!orderCols.some(col => col.name === 'verification_status')) {
      db.exec(`ALTER TABLE orders ADD COLUMN verification_status TEXT DEFAULT 'pending_owner';`);
    }
    if (!orderCols.some(col => col.name === 'rejection_reason')) {
      db.exec(`ALTER TABLE orders ADD COLUMN rejection_reason TEXT;`);
    }
    if (!orderCols.some(col => col.name === 'pickup_schedule')) {
      db.exec(`ALTER TABLE orders ADD COLUMN pickup_schedule TEXT;`);
    }
    if (!orderCols.some(col => col.name === 'tracking_status')) {
      db.exec(`ALTER TABLE orders ADD COLUMN tracking_status TEXT DEFAULT 'pending_verification';`);
    }
  } catch (e) {
    console.warn("Migration notice (orders):", e.message);
  }
}

initSchema();

module.exports = db;
module.exports.initSchema = initSchema;
