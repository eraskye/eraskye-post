import express from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { now } from '../utils.js';

const router = express.Router();

router.post('/:postId', requireAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.postId);
  if (!post) return res.status(404).json({ error: 'Not found' });
  const exists = db.prepare('SELECT 1 FROM post_likes WHERE user_id=? AND post_id=?').get(req.user.id, post.id);
  if (exists) db.prepare('DELETE FROM post_likes WHERE user_id=? AND post_id=?').run(req.user.id, post.id);
  else {
    db.prepare('INSERT INTO post_likes (user_id, post_id, created_at) VALUES (?,?,?)').run(req.user.id, post.id, now());
    if (post.user_id !== req.user.id) db.prepare('INSERT INTO notifications (user_id, actor_id, type, post_id, created_at) VALUES (?,?,?,?,?)').run(post.user_id, req.user.id, 'like', post.id, now());
  }
  res.json({ liked: !exists, likes: db.prepare('SELECT COUNT(*) c FROM post_likes WHERE post_id = ?').get(post.id).c });
});

export default router;
