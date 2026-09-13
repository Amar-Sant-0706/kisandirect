const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'kisandirect_multiportal_secure_jwt_secret_2026';

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Access denied: Valid JWT token required.'
    });
  }

  // Check token revocation
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const revoked = db.prepare('SELECT token_hash FROM banned_tokens WHERE token_hash = ?').get(tokenHash);
    if (revoked) {
      return res.status(401).json({
        success: false,
        error: 'TOKEN_REVOKED',
        message: 'Your session has been revoked. Please log in again.'
      });
    }
  } catch (e) {}

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, email, role, name, is_banned, location, business_name FROM users WHERE id = ?').get(decoded.userId || decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'User account does not exist.'
      });
    }

    if (user.is_banned === 1) {
      return res.status(403).json({
        success: false,
        error: 'ACCOUNT_BANNED',
        message: 'This account has been dismissed and banned by the Platform Owner.'
      });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Session is invalid or expired. Please sign in again.'
    });
  }
}

module.exports = {
  requireAuth,
  JWT_SECRET
};
