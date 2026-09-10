import express from 'express';
import db from '../db.js';
import { buildPost } from './posts.js';

const router = express.Router();

router.get('/', (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const type = req.query.type || 'all';
  if (!q) return res.json({ users: [], posts: [] });
  const like = `%${q}%`;
  const users = (type === 'all' || type === 'users')
    ? db.prepare('SELECT id, username, name, avatar FROM users WHERE username LIKE ? OR name LIKE ? LIMIT 30').all(like, like)
    : [];
  const postRows = (type === 'all' || type === 'posts')
    ? db.prepare('SELECT * FROM posts WHERE text LIKE ? ORDER BY created_at DESC LIMIT 30').all(like)
    : [];
  res.json({ users, posts: postRows.map(p => buildPost(p, req.user?.id)) });
});

export default router;
