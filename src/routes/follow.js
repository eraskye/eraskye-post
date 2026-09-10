import express from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { now } from '../utils.js';

const router = express.Router();

router.post('/:userId', requireAuth, (req, res) => {
  const targetId = parseInt(req.params.userId);
  if (targetId === req.user.id) return res.status(400).json({ error: 'Cannot follow yourself' });
  if (!db.prepare('SELECT id FROM users WHERE id = ?').get(targetId)) return res.status(404).json({ error: 'Not found' });
  const exists = db.prepare('SELECT 1 FROM followers WHERE follower_id=? AND following_id=?').get(req.user.id, targetId);
  if (exists) db.prepare('DELETE FROM followers WHERE follower_id=? AND following_id=?').run(req.user.id, targetId);
  else {
    db.prepare('INSERT INTO followers (follower_id, following_id, created_at) VALUES (?,?,?)').run(req.user.id, targetId, now());
    db.prepare('INSERT INTO notifications (user_id, actor_id, type, created_at) VALUES (?,?,?,?)').run(targetId, req.user.id, 'follow', now());
  }
  res.json({ following: !exists, followers: db.prepare('SELECT COUNT(*) c FROM followers WHERE following_id = ?').get(targetId).c });
});

export default router;
