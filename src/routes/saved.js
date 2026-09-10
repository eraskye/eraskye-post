import express from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { now } from '../utils.js';
import { buildPost } from './posts.js';

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT p.* FROM saved_posts s JOIN posts p ON p.id = s.post_id WHERE s.user_id = ? ORDER BY s.created_at DESC LIMIT 100').all(req.user.id);
  res.json({ posts: rows.map(p => buildPost(p, req.user.id)) });
});

router.post('/:postId', requireAuth, (req, res) => {
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.postId);
  if (!post) return res.status(404).json({ error: 'Not found' });
  const exists = db.prepare('SELECT 1 FROM saved_posts WHERE user_id=? AND post_id=?').get(req.user.id, post.id);
  if (exists) db.prepare('DELETE FROM saved_posts WHERE user_id=? AND post_id=?').run(req.user.id, post.id);
  else db.prepare('INSERT INTO saved_posts (user_id, post_id, created_at) VALUES (?,?,?)').run(req.user.id, post.id, now());
  res.json({ saved: !exists });
});

export default router;
