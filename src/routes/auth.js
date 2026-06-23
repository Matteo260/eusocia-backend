const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');

const router = express.Router();

const AVATAR_COLORS = ['av-blue', 'av-purple', 'av-green', 'av-orange', 'av-pink', 'av-teal'];

function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// POST /api/auth/signup
router.post(
  '/signup',
  [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Kailangan ng pangalan (min 2 letra).'),
    body('email').isEmail().withMessage('Hindi valid na email address.'),
    body('password').isLength({ min: 6 }).withMessage('Kailangan ng password na hindi bababa sa 6 characters.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { name, email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'May account na gamit ang email na ito.' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const initials = getInitials(name);
      const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

      const result = await pool.query(
        `INSERT INTO users (name, email, password_hash, initials, avatar_color)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, email, initials, avatar_color, created_at`,
        [name.trim(), normalizedEmail, passwordHash, initials, avatarColor]
      );

      const user = result.rows[0];
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

      res.status(201).json({ token, user });
    } catch (err) {
      console.error('Signup error:', err);
      res.status(500).json({ error: 'May problema sa server. Subukan ulit mamaya.' });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Hindi valid na email address.'),
    body('password').notEmpty().withMessage('Kailangan ng password.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const result = await pool.query(
        'SELECT id, name, email, password_hash, initials, avatar_color FROM users WHERE email = $1',
        [normalizedEmail]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Maling email o password.' });
      }

      const user = result.rows[0];
      const passwordMatches = await bcrypt.compare(password, user.password_hash);

      if (!passwordMatches) {
        return res.status(401).json({ error: 'Maling email o password.' });
      }

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

      delete user.password_hash;
      res.json({ token, user });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'May problema sa server. Subukan ulit mamaya.' });
    }
  }
);

module.exports = router;
