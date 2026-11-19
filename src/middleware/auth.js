const jwt = require('jsonwebtoken');

async function requireAuth(req, res, next) {
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
    if (decoded && decoded.sub) {
      try {
        const { getRedisClient } = require('../services/redis');
        const revokedBefore = await getRedisClient().get(`halo:auth:revoked-before:${decoded.sub}`);
        if (revokedBefore && Number(decoded.iat || 0) < Number(revokedBefore)) {
          return res.status(401).json({ error: 'Session ended', message: 'This account session was ended.' });
        }
      } catch (lookupError) {
        // A revocation lookup failure must not reject tokens that are otherwise valid.
      }
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };


