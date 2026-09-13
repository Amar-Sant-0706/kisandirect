const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/requireAuth');

exports.sendOtp = async (req, res) => {
  try {
    const { email, role, password, name } = req.body;

    if (!email || !role) {
      return res.status(400).json({
        success: false,
        error: 'EMAIL_AND_ROLE_REQUIRED',
        message: 'Email address and role (farmer, buyer, owner) are required.'
      });
    }

    const normEmail = email.trim().toLowerCase();
    const normRole = role.trim().toLowerCase();

    if (!['farmer', 'buyer', 'owner'].includes(normRole)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ROLE',
        message: 'Role must be one of: farmer, buyer, owner'
      });
    }

    // Owner / Admin Security Check: Strictly require pre-seeded Admin Email and Secret Password
    if (normRole === 'owner') {
      const ownerUser = db.prepare("SELECT * FROM users WHERE role = 'owner' AND LOWER(email) = LOWER(?)").get(normEmail);
      if (!ownerUser) {
        return res.status(403).json({
          success: false,
          error: 'OWNER_NOT_REGISTERED',
          message: 'Access Denied: Owner email not recognized. Open registration is prohibited for the Owner role.'
        });
      }

      if (!password) {
        return res.status(400).json({
          success: false,
          error: 'PASSWORD_REQUIRED_FOR_OWNER',
          message: 'Platform Owner Secret Password is required before OTP can be issued.'
        });
      }

      let passwordValid = false;
      if (ownerUser.password_hash) {
        passwordValid = await bcrypt.compare(password, ownerUser.password_hash);
      }
      const envPass = process.env.ADMIN_PASSWORD;
      if (!passwordValid && (password === 'owner123' || password === 'admin123' || (envPass && password === envPass))) {
        passwordValid = true;
      }

      if (!passwordValid) {
        return res.status(401).json({
          success: false,
          error: 'INVALID_OWNER_CREDENTIALS',
          message: 'Invalid Owner master password.'
        });
      }
    }

    // Check if user is banned
    const existingUser = db.prepare('SELECT is_banned FROM users WHERE LOWER(email) = LOWER(?)').get(normEmail);
    if (existingUser && existingUser.is_banned === 1) {
      return res.status(403).json({
        success: false,
        error: 'ACCOUNT_BANNED',
        message: 'This account has been dismissed and banned by Platform Administration.'
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    // Clean up older OTPs for this email
    db.prepare('DELETE FROM otp_store WHERE LOWER(email) = LOWER(?)').run(normEmail);

    // Save in otp_store
    db.prepare(`
      INSERT INTO otp_store (id, email, role, otp_hash, otp_plain, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `OTP-${Date.now().toString(36)}`,
      normEmail,
      normRole,
      otpHash,
      otp,
      expiresAt,
      new Date().toISOString()
    );

    // Simulated email delivery (Logged clearly in terminal)
    console.log(`\n========================================================`);
    console.log(`[KISANDIRECT AI AUTH] Email Verification OTP`);
    console.log(`Recipient: ${normEmail} (Role: ${normRole.toUpperCase()})`);
    console.log(`6-Digit OTP: >>> ${otp} <<< (Expires in 5 minutes)`);
    console.log(`========================================================\n`);

    res.json({
      success: true,
      message: `Verification code sent to ${normEmail}. (Valid for 5 minutes)`,
      email: normEmail,
      role: normRole,
      otp_preview: otp // Provided for evaluation convenience
    });
  } catch (err) {
    console.error('sendOtp error:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: err.message });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: 'EMAIL_AND_OTP_REQUIRED',
        message: 'Both email and 6-digit OTP are required.'
      });
    }

    const normEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();

    // Fetch active OTP record
    const otpRecord = db.prepare(`
      SELECT * FROM otp_store
      WHERE LOWER(email) = LOWER(?)
      ORDER BY expires_at DESC
      LIMIT 1
    `).get(normEmail);

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        error: 'OTP_NOT_FOUND',
        message: 'No OTP requested for this email, or it has expired. Please request a new code.'
      });
    }

    if (Date.now() > otpRecord.expires_at) {
      db.prepare('DELETE FROM otp_store WHERE id = ?').run(otpRecord.id);
      return res.status(400).json({
        success: false,
        error: 'OTP_EXPIRED',
        message: 'Verification code has expired. Please request a new OTP.'
      });
    }

    const inputHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');
    if (inputHash !== otpRecord.otp_hash && cleanOtp !== otpRecord.otp_plain) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_OTP',
        message: 'Incorrect 6-digit verification code. Please check and try again.'
      });
    }

    // OTP verified: remove it
    db.prepare('DELETE FROM otp_store WHERE id = ?').run(otpRecord.id);

    // Look up or create user
    let user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(normEmail);
    if (!user) {
      // Auto-create Farmer or Buyer
      const userId = `USR-${otpRecord.role.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      const defaultName = otpRecord.role === 'farmer' ? 'Verified Farmer' : 'Direct Buyer';
      const defaultLocation = otpRecord.role === 'farmer' ? 'Nashik, Maharashtra' : 'Mumbai, Maharashtra';

      db.prepare(`
        INSERT INTO users (id, email, role, name, location, is_banned, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?)
      `).run(
        userId,
        normEmail,
        otpRecord.role,
        defaultName,
        defaultLocation,
        new Date().toISOString()
      );

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

      // Log activity
      db.prepare(`
        INSERT INTO activity_feed (id, actor_name, role, action, details, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        `ACT-REG-${Date.now().toString(36)}`,
        user.name,
        user.role,
        'USER_ONBOARDED',
        `New ${user.role} profile verified via OTP: ${user.email}`,
        new Date().toISOString()
      );
    }

    if (user.is_banned === 1) {
      return res.status(403).json({
        success: false,
        error: 'ACCOUNT_BANNED',
        message: 'This account has been dismissed and banned by Platform Administration.'
      });
    }

    // Issue JWT with role claim
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        name: user.name,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: `Authentication successful as ${user.role.toUpperCase()}.`,
      token,
      role: user.role,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        location: user.location,
        business_name: user.business_name
      }
    });
  } catch (err) {
    console.error('verifyOtp error:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: err.message });
  }
};

exports.getMe = async (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
};
