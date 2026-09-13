const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, verifyToken } = require('../middleware/auth');

// Helper: Generate JWT token
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      approval_status: user.approval_status
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register - Register a new user account (FARMER, BUYER, OWNER)
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role = 'FARMER',
      phone = '',
      state_district = '',
      district_state = '',
      farmer_details,
      buyer_details,
      land_area_acres,
      crop_speciality,
      kisan_id,
      business_name = '',
      gstin_number = '',
      trade_type = '',
      fssai_license = ''
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, error: 'Email address is required' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check duplicate
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(cleanEmail);
    if (existing) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists' });
    }

    const normRole = role.toUpperCase();
    
    // Core RBAC Rule: Both Farmers and Buyers MUST start in 'PENDING_APPROVAL' status upon registration
    let approval_status = 'PENDING_APPROVAL';
    let kyc_status = 'PENDING';
    let approved_at = null;

    if (normRole === 'OWNER' || normRole === 'ADMIN') {
      approval_status = 'APPROVED';
      kyc_status = 'APPROVED';
      approved_at = new Date().toISOString();
    }

    // Build farmer_details JSON
    let farmerDetailsStr = null;
    if (normRole === 'FARMER' || normRole === 'FPO_MEMBER') {
      const fObj = typeof farmer_details === 'object' && farmer_details !== null ? farmer_details : {
        land_area_acres: land_area_acres || 5.0,
        crop_speciality: crop_speciality || 'Mixed Produce & Vegetables',
        kisan_id: kisan_id || `KISAN-${Date.now().toString(36).toUpperCase()}`
      };
      farmerDetailsStr = JSON.stringify(fObj);
    }

    // Build buyer_details JSON
    let buyerDetailsStr = null;
    const finalBiz = business_name || (buyer_details && buyer_details.business_name) || '';
    const finalGstin = gstin_number || (buyer_details && buyer_details.gstin) || '';
    const finalTrade = trade_type || (buyer_details && buyer_details.trade_type) || 'B2B Retail Wholesale';

    if (normRole === 'BUYER' || normRole === 'B2B_BUYER' || normRole === 'CONSUMER') {
      const bObj = typeof buyer_details === 'object' && buyer_details !== null ? buyer_details : {
        business_name: finalBiz,
        gstin: finalGstin,
        trade_type: finalTrade
      };
      buyerDetailsStr = JSON.stringify(bObj);
    }

    const location = (state_district || district_state || 'Maharashtra').trim();

    // Hash password with bcryptjs
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);
    const userId = `USR-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (
        id, name, email, password_hash, role, approval_status, phone, state_district, district_state,
        farmer_details, buyer_details, business_name, gstin_number, fssai_license, kyc_status, created_at, approved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      name.trim(),
      cleanEmail,
      password_hash,
      role,
      approval_status,
      phone ? phone.trim() : '',
      location,
      location,
      farmerDetailsStr,
      buyerDetailsStr,
      finalBiz,
      finalGstin,
      fssai_license ? fssai_license.trim() : '',
      kyc_status,
      createdAt,
      approved_at
    );

    const newUser = {
      id: userId,
      name: name.trim(),
      email: cleanEmail,
      role,
      approval_status,
      phone: phone ? phone.trim() : '',
      state_district: location,
      district_state: location,
      farmer_details: farmerDetailsStr ? JSON.parse(farmerDetailsStr) : null,
      buyer_details: buyerDetailsStr ? JSON.parse(buyerDetailsStr) : null,
      business_name: finalBiz,
      gstin_number: finalGstin,
      fssai_license: fssai_license ? fssai_license.trim() : '',
      kyc_status,
      created_at: createdAt,
      approved_at
    };

    const token = generateToken(newUser);

    // Audit log
    try {
      db.prepare(`
        INSERT INTO audit_logs (id, actor_id, action_description, timestamp)
        VALUES (?, ?, ?, ?)
      `).run(`AUD-${Date.now()}`, userId, `User registered with role ${role} (Approval: ${approval_status})`, createdAt);
    } catch (e) {}

    res.status(201).json({
      success: true,
      message: 'Account registered successfully!',
      token,
      user: newUser
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/login - Authenticate user credentials and return JWT
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(cleanEmail);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    let parsedFarmer = null;
    let parsedBuyer = null;
    try { if (user.farmer_details) parsedFarmer = JSON.parse(user.farmer_details); } catch (e) {}
    try { if (user.buyer_details) parsedBuyer = JSON.parse(user.buyer_details); } catch (e) {}

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      approval_status: user.approval_status || 'PENDING_APPROVAL',
      phone: user.phone,
      state_district: user.state_district || user.district_state,
      district_state: user.district_state || user.state_district,
      farmer_details: parsedFarmer,
      buyer_details: parsedBuyer,
      business_name: user.business_name || '',
      gstin_number: user.gstin_number || '',
      fssai_license: user.fssai_license || '',
      kyc_status: user.kyc_status || 'NOT_SUBMITTED',
      created_at: user.created_at,
      approved_at: user.approved_at
    };

    const token = generateToken(safeUser);

    res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/me - Protected route returning authenticated user profile & stats
router.get('/me', verifyToken, (req, res) => {
  try {
    const user = req.user;

    let lotsCount = 0;
    let ordersCount = 0;
    const normRole = (user.role || '').toUpperCase();

    if (normRole === 'FARMER' || normRole === 'FPO_MEMBER') {
      const row = db.prepare('SELECT COUNT(*) as count FROM produce_listings WHERE farmer_id = ?').get(user.id);
      lotsCount = row ? row.count : 0;
      const oRow = db.prepare('SELECT COUNT(*) as count FROM orders WHERE farmer_id = ?').get(user.id);
      ordersCount = oRow ? oRow.count : 0;
    } else if (normRole === 'BUYER' || normRole === 'B2B_BUYER' || normRole === 'CONSUMER') {
      const oRow = db.prepare('SELECT COUNT(*) as count FROM orders WHERE buyer_id = ?').get(user.id);
      ordersCount = oRow ? oRow.count : 0;
    }

    let parsedFarmer = null;
    let parsedBuyer = null;
    try { if (user.farmer_details && typeof user.farmer_details === 'string') parsedFarmer = JSON.parse(user.farmer_details); } catch (e) {}
    try { if (user.buyer_details && typeof user.buyer_details === 'string') parsedBuyer = JSON.parse(user.buyer_details); } catch (e) {}

    res.json({
      success: true,
      user: {
        ...user,
        farmer_details: parsedFarmer || user.farmer_details,
        buyer_details: parsedBuyer || user.buyer_details,
        stats: {
          activeLots: lotsCount,
          totalOrders: ordersCount
        }
      }
    });
  } catch (err) {
    console.error('Error in /api/auth/me:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
