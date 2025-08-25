const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  try {
    const header = req.get('Authorization') || '';
    const parts = header.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    const token = parts[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ error: 'Server misconfiguration: JWT secret missing' });
    }
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };


