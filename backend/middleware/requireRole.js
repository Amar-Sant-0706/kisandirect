function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles.map(r => r.toLowerCase()) : [allowedRoles.toLowerCase()];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'You must be logged in to perform this action.'
      });
    }

    const userRole = (req.user.role || '').toLowerCase();
    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN_ROLE',
        message: `Forbidden: Access to this portal requires role ${roles.join(' or ')}. Your role is ${userRole}.`
      });
    }

    next();
  };
}

module.exports = { requireRole };
