const jwt = require('jsonwebtoken');

// Pinoprotektahan ang mga routes na kailangan ng login.
// Inaasahan ang "Authorization: Bearer <token>" sa header.
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Walang token. Mag-login ka muna.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid o expired na token. Mag-login ulit.' });
  }
}

module.exports = requireAuth;
