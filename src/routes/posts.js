const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/posts — newsfeed, pinakabago muna, kasama ang likes count, comments, at kung liked ng current user
router.get('/', async (req, res) => {
  try {
    const postsResult = await pool.query(
      `SELECT p.id, p.text, p.visibility, p.created_at,
              u.id AS author_id, u.name AS author_name, u.initials AS author_initials, u.avatar_color AS author_avatar,
              (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
              EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1) AS liked_by_me
       FROM posts p
       JOIN users u ON u.id = p.author_id
       ORDER BY p.created_at DESC
       LIMIT 50`,
      [req.userId]
    );

    const posts = postsResult.rows;
    const postIds = posts.map(p => p.id);

    let commentsByPost = {};
    if (postIds.length > 0) {
      const commentsResult = await pool.query(
        `SELECT c.id, c.post_id, c.text, c.created_at,
                u.id AS author_id, u.name AS author_name, u.initials AS author_initials, u.avatar_color AS author_avatar
         FROM comments c
         JOIN users u ON u.id = c.author_id
         WHERE c.post_id = ANY($1)
         ORDER BY c.created_at ASC`,
        [postIds]
      );
      for (const c of commentsResult.rows) {
        if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
        commentsByPost[c.post_id].push(c);
      }
    }

    const formatted = posts.map(p => ({
      id: p.id,
      text: p.text,
      visibility: p.visibility,
      createdAt: p.created_at,
      author: { id: p.author_id, name: p.author_name, initials: p.author_initials, avatarColor: p.author_avatar },
      likeCount: Number(p.like_count),
      likedByMe: p.liked_by_me,
      comments: (commentsByPost[p.id] || []).map(c => ({
        id: c.id,
        text: c.text,
        createdAt: c.created_at,
        author: { id: c.author_id, name: c.author_name, initials: c.author_initials, avatarColor: c.author_avatar },
      })),
    }));

    res.json({ posts: formatted });
  } catch (err) {
    console.error('Fetch feed error:', err);
    res.status(500).json({ error: 'Hindi nakuha ang newsfeed. Subukan ulit.' });
  }
});

// POST /api/posts — gumawa ng bagong post
router.post(
  '/',
  [
    body('text').trim().isLength({ min: 1, max: 5000 }).withMessage('Hindi maaaring walang content ang post.'),
    body('visibility').optional().isIn(['everyone', 'friends', 'only_me']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { text, visibility = 'everyone' } = req.body;

    try {
      const result = await pool.query(
        `INSERT INTO posts (author_id, text, visibility) VALUES ($1, $2, $3)
         RETURNING id, text, visibility, created_at`,
        [req.userId, text.trim(), visibility]
      );
      res.status(201).json({ post: result.rows[0] });
    } catch (err) {
      console.error('Create post error:', err);
      res.status(500).json({ error: 'Hindi na-post. Subukan ulit.' });
    }
  }
);

// DELETE /api/posts/:id — pwede lang burahin ang sariling post
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM posts WHERE id = $1 AND author_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Hindi nahanap ang post o hindi mo pagmamay-ari.' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ error: 'Hindi nabura ang post.' });
  }
});

// POST /api/posts/:id/like — toggle like/unlike
router.post('/:id/like', async (req, res) => {
  const postId = req.params.id;

  try {
    const postExists = await pool.query('SELECT id FROM posts WHERE id = $1', [postId]);
    if (postExists.rows.length === 0) {
      return res.status(404).json({ error: 'Hindi nahanap ang post.' });
    }

    const existingLike = await pool.query(
      'SELECT 1 FROM likes WHERE post_id = $1 AND user_id = $2',
      [postId, req.userId]
    );

    let liked;
    if (existingLike.rows.length > 0) {
      await pool.query('DELETE FROM likes WHERE post_id = $1 AND user_id = $2', [postId, req.userId]);
      liked = false;
    } else {
      await pool.query('INSERT INTO likes (post_id, user_id) VALUES ($1, $2)', [postId, req.userId]);
      liked = true;
    }

    const countResult = await pool.query('SELECT COUNT(*) FROM likes WHERE post_id = $1', [postId]);

    res.json({ liked, likeCount: Number(countResult.rows[0].count) });
  } catch (err) {
    console.error('Like toggle error:', err);
    res.status(500).json({ error: 'Hindi na-process ang like.' });
  }
});

// POST /api/posts/:id/comments — magdagdag ng comment
router.post(
  '/:id/comments',
  [body('text').trim().isLength({ min: 1, max: 2000 }).withMessage('Hindi maaaring walang content ang comment.')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const postId = req.params.id;

    try {
      const postExists = await pool.query('SELECT id FROM posts WHERE id = $1', [postId]);
      if (postExists.rows.length === 0) {
        return res.status(404).json({ error: 'Hindi nahanap ang post.' });
      }

      const result = await pool.query(
        `INSERT INTO comments (post_id, author_id, text) VALUES ($1, $2, $3)
         RETURNING id, text, created_at`,
        [postId, req.userId, req.body.text.trim()]
      );

      const userResult = await pool.query(
        'SELECT id, name, initials, avatar_color FROM users WHERE id = $1',
        [req.userId]
      );

      const comment = result.rows[0];
      res.status(201).json({
        comment: {
          id: comment.id,
          text: comment.text,
          createdAt: comment.created_at,
          author: {
            id: userResult.rows[0].id,
            name: userResult.rows[0].name,
            initials: userResult.rows[0].initials,
            avatarColor: userResult.rows[0].avatar_color,
          },
        },
      });
    } catch (err) {
      console.error('Add comment error:', err);
      res.status(500).json({ error: 'Hindi na-post ang comment.' });
    }
  }
);

module.exports = router;
