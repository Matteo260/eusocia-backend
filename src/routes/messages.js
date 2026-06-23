const express = require('express');
const pool = require('../db/pool');
const requireAuth = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);

// GET /api/messages — listahan ng conversations
router.get('/', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT DISTINCT ON (other_id)
        other_id, other_name, other_initials, other_avatar,
        last_message, last_time, unread_count
      FROM (
        SELECT
          CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS other_id,
          CASE WHEN sender_id = $1 THEN ru.name ELSE su.name END AS other_name,
          CASE WHEN sender_id = $1 THEN ru.initials ELSE su.initials END AS other_initials,
          CASE WHEN sender_id = $1 THEN ru.avatar_color ELSE su.avatar_color END AS other_avatar,
          m.text AS last_message,
          m.created_at AS last_time,
          (SELECT COUNT(*) FROM messages WHERE sender_id != $1 AND receiver_id = $1 AND read = false
           AND (sender_id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END)) AS unread_count
        FROM messages m
        JOIN users su ON su.id = m.sender_id
        JOIN users ru ON ru.id = m.receiver_id
        WHERE m.sender_id = $1 OR m.receiver_id = $1
        ORDER BY m.created_at DESC
      ) t
      ORDER BY other_id, last_time DESC
    `, [req.userId]);
    res.json({ conversations: r.rows });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Could not fetch conversations.' }); }
});

// GET /api/messages/:userId — messages sa isang conversation
router.get('/:userId', async (req, res) => {
  try {
    const other = parseInt(req.params.userId);
    const r = await pool.query(`
      SELECT m.id, m.text, m.created_at, m.read,
        m.sender_id, u.name AS sender_name, u.initials, u.avatar_color
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE (m.sender_id = $1 AND m.receiver_id = $2)
         OR (m.sender_id = $2 AND m.receiver_id = $1)
      ORDER BY m.created_at ASC
    `, [req.userId, other]);
    await pool.query(`UPDATE messages SET read = true WHERE sender_id = $2 AND receiver_id = $1 AND read = false`, [req.userId, other]);
    res.json({ messages: r.rows });
  } catch(e) { res.status(500).json({ error: 'Could not fetch messages.' }); }
});

// POST /api/messages/:userId — send message
router.post('/:userId', async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Message is required.' });
  try {
    const r = await pool.query(
      'INSERT INTO messages (sender_id, receiver_id, text) VALUES ($1, $2, $3) RETURNING *',
      [req.userId, parseInt(req.params.userId), text.trim()]
    );
    res.status(201).json({ message: r.rows[0] });
  } catch(e) { res.status(500).json({ error: 'Could not send message.' }); }
});

module.exports = router;
