const express = require('express');
const pool = require('../db/pool');
const requireAuth = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, name, initials, avatar_color FROM users WHERE id != $1 ORDER BY name ASC',
      [req.userId]
    );
    res.json({ users: r.rows });
  } catch(e) { res.status(500).json({ error: 'Could not fetch users.' }); }
});

module.exports = router;
