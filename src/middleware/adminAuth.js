/**
 * Admin Authentication Middleware
 *
 * Simple API-key based guard for admin routes.
 * In production, replace with JWT + role-based auth.
 *
 * Pass the key via header: `x-admin-key: <ADMIN_SECRET>`
 */
const adminAuth = (req, res, next) => {
  const provided = req.headers['x-admin-key'];
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    console.error('[AdminAuth] ADMIN_SECRET env var is not set!');
    return res.status(500).json({ success: false, message: 'Server misconfiguration.' });
  }

  if (!provided || provided !== expected) {
    return res.status(401).json({ success: false, message: 'Unauthorized: invalid or missing admin key.' });
  }

  next();
};

module.exports = { adminAuth };
