import express from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { now } from '../utils.js';

const router = express.Router();
const REASONS = ['spam', 'inappropriate', 'insult', 'other'];

router.post('/', requireAuth, (req, res) => {
  const { post_id, reason, details } = req.body;
  if (!post_id || !REASONS.includes(reason)) return res.status(400).json({ error: 'Invalid' });
  if (!db.prepare('SELECT id FROM posts WHERE id = ?').get(post_id)) return res.status(404).json({ error: 'Not found' });
  db.prepare('INSERT INTO reports (reporter_id, post_id, reason, details, created_at) VALUES (?,?,?,?,?)')
    .run(req.user.id, post_id, reason, (details || '').toString().slice(0, 500), now());
  res.json({ ok: true });
});

export default router;
