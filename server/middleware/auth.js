const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'kisandirect_jwt_secret_2026_secure_key_doca_ai';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Middleware: Enforces valid JWT Bearer authentication (verifyToken / authenticateToken)
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication token missing. Please log in to proceed.'
    });
  }

  // Check if token was revoked
  try {
    const tHash = hashToken(token);
    const revoked = db.prepare(`SELECT token_hash FROM banned_tokens WHERE token_hash = ?`).get(tHash);
    if (revoked) {
      return res.status(401).json({
        success: false,
        error: 'Session has been revoked. Please sign in again.'
      });
    }
  } catch (e) {
    // Ignore db check failure if table not present
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare(`
      SELECT 
        id, name, email, role, approval_status, phone, state_district, district_state,
        farmer_details, buyer_details, business_name, gstin_number, fssai_license,
        kyc_status, is_banned, banned_reason, created_at, approved_at 
      FROM users 
      WHERE id = ?
    `).get(decoded.id);

    if (!user) {
      return res.status(403).json({
        success: false,
        error: 'User account not found or deactivated.'
      });
    }

    if (user.is_banned === 1) {
      return res.status(403).json({
        success: false,
        error: 'ACCOUNT_BANNED',
        message: user.banned_reason || 'This account has been dismissed and banned by the Platform Owner.'
      });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      error: 'Invalid or expired session. Please sign in again.'
    });
  }
}

// Alias for backwards-compatibility
const authenticateToken = verifyToken;

/**
 * Middleware: Restricts access to specific role(s)
 * Strict Zero-Leakage RBAC
 */
function requireRole(allowedRoles) {
  const normalizedAllowed = allowedRoles.map(r => r.toUpperCase());
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const currentRole = (req.user.role || '').toUpperCase();

    // Map common aliases
    let effectiveRole = currentRole;
    if (currentRole === 'FPO_MEMBER' || currentRole === 'FARMER') effectiveRole = 'FARMER';
    if (currentRole === 'B2B_BUYER' || currentRole === 'CONSUMER' || currentRole === 'BUYER') effectiveRole = 'BUYER';
    if (currentRole === 'ADMIN' || currentRole === 'OWNER' || currentRole === 'DOCA_ADMIN') effectiveRole = 'OWNER';

    const hasPermission = normalizedAllowed.includes(currentRole) || 
                          normalizedAllowed.includes(effectiveRole) ||
                          (normalizedAllowed.includes('ADMIN') && effectiveRole === 'OWNER') ||
                          (normalizedAllowed.includes('OWNER') && effectiveRole === 'ADMIN');

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Access requires ${allowedRoles.join(' or ')} privileges.`
      });
    }

    next();
  };
}

/**
 * Middleware: Enforces that account has been approved by Platform Owner
 */
function requireApproved(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const status = (req.user.approval_status || '').toUpperCase();
  if (status !== 'APPROVED') {
    return res.status(403).json({
      success: false,
      error: 'ACCOUNT_PENDING_OWNER_APPROVAL',
      code: 'ACCOUNT_PENDING_OWNER_APPROVAL',
      message: 'Your account is pending verification and approval by the Platform Owner.',
      approval_status: req.user.approval_status || 'PENDING_APPROVAL'
    });
  }

  next();
}

/**
 * Middleware: Attaches req.user if a valid token is present, but permits anonymous access
 */
function optionalAuthToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = db.prepare(`
        SELECT 
          id, name, email, role, approval_status, phone, state_district, district_state,
          farmer_details, buyer_details, business_name, gstin_number, fssai_license,
          kyc_status, is_banned, created_at, approved_at 
        FROM users 
        WHERE id = ?
      `).get(decoded.id);
      if (user && user.is_banned !== 1) req.user = user;
    } catch (e) {
      // Ignored for optional auth
    }
  }

  next();
}

module.exports = {
  JWT_SECRET,
  hashToken,
  verifyToken,
  authenticateToken,
  requireRole,
  requireApproved,
  optionalAuthToken
};
