const express = require('express');
const pool = require('../db/pool');
const requireAuth = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30',
      [req.userId]
    );
    res.json({ notifications: r.rows });
  } catch(e) { res.status(500).json({ error: 'Could not fetch notifications.' }); }
});

module.exports = router;
