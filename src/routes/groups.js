const express = require('express');
const pool = require('../db/pool');
const requireAuth = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT g.id, g.name, g.description, g.privacy, g.cover_photo,
        (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count
      FROM groups g ORDER BY g.created_at DESC
    `);
    res.json({ groups: r.rows.map(g => ({
      id: g.id, name: g.name, description: g.description,
      privacy: g.privacy, coverPhoto: g.cover_photo,
      memberCount: Number(g.member_count)
    }))});
  } catch(e) { res.status(500).json({ error: 'Could not fetch groups.' }); }
});

router.post('/', async (req, res) => {
  const { name, description, privacy = 'public', coverPhoto } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required.' });
  try {
    const r = await pool.query(
      'INSERT INTO groups (name,description,privacy,cover_photo,creator_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, description||null, privacy, coverPhoto||null, req.userId]
    );
    await pool.query('INSERT INTO group_members (group_id,user_id) VALUES ($1,$2)', [r.rows[0].id, req.userId]);
    res.status(201).json({ group: {
      id: r.rows[0].id, name: r.rows[0].name, description: r.rows[0].description,
      privacy: r.rows[0].privacy, coverPhoto: r.rows[0].cover_photo, memberCount: 1
    }});
  } catch(e) { res.status(500).json({ error: 'Could not create group.' }); }
});

module.exports = router;
