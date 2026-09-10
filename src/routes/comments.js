import express from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { now } from '../utils.js';

const router = express.Router();

function buildComment(c, viewerId) {
  const user = db.prepare('SELECT id, username, name, avatar FROM users WHERE id = ?').get(c.user_id);
  const likes = db.prepare('SELECT COUNT(*) c FROM comment_likes WHERE comment_id = ?').get(c.id).c;
  const liked = viewerId ? !!db.prepare('SELECT 1 FROM comment_likes WHERE user_id=? AND comment_id=?').get(viewerId, c.id) : false;
  return { id: c.id, text: c.text, created_at: c.created_at, user, likes, liked };
}

router.get('/post/:postId', (req, res) => {
  const rows = db.prepare('SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC LIMIT 200').all(req.params.postId);
  res.json({ comments: rows.map(c => buildComment(c, req.user?.id)) });
});

router.post('/post/:postId', requireAuth, (req, res) => {
  const text = (req.body.text || '').toString().trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: 'Empty' });
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.postId);
  if (!post) return res.status(404).json({ error: 'Not found' });
  const info = db.prepare('INSERT INTO comments (post_id, user_id, text, created_at) VALUES (?,?,?,?)').run(post.id, req.user.id, text, now());
  if (post.user_id !== req.user.id) {
    db.prepare('INSERT INTO notifications (user_id, actor_id, type, post_id, comment_id, created_at) VALUES (?,?,?,?,?,?)').run(post.user_id, req.user.id, 'comment', post.id, info.lastInsertRowid, now());
  }
  res.json({ comment: buildComment(db.prepare('SELECT * FROM comments WHERE id = ?').get(info.lastInsertRowid), req.user.id) });
});

router.delete('/:id', requireAuth, (req, res) => {
  const c = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  if (c.user_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM comments WHERE id = ?').run(c.id);
  res.json({ ok: true });
});

router.post('/:id/like', requireAuth, (req, res) => {
  const c = db.prepare('SELECT id FROM comments WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const exists = db.prepare('SELECT 1 FROM comment_likes WHERE user_id=? AND comment_id=?').get(req.user.id, c.id);
  if (exists) db.prepare('DELETE FROM comment_likes WHERE user_id=? AND comment_id=?').run(req.user.id, c.id);
  else db.prepare('INSERT INTO comment_likes (user_id, comment_id) VALUES (?,?)').run(req.user.id, c.id);
  res.json({ liked: !exists, likes: db.prepare('SELECT COUNT(*) c FROM comment_likes WHERE comment_id = ?').get(c.id).c });
});

export default router;
