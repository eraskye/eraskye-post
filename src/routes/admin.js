import express from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { now, uid } from '../utils.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

router.post('/login', limiter, async (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_admin = 1').get(username);
  if (!user || user.is_blocked) return res.status(401).json({ error: 'Invalid' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid' });
  const sid = uid();
  db.prepare('INSERT INTO sessions (id, user_id, is_admin, created_at, expires_at) VALUES (?,?,?,?,?)')
    .run(sid, user.id, 1, now(), now() + 1000 * 60 * 60 * 24 * 7);
  res.cookie('sid', sid, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 24 * 7 });
  res.json({ user: { id: user.id, username: user.username, is_admin: 1 } });
});

router.get('/stats', requireAdmin, (req, res) => {
  res.json({
    users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
    posts: db.prepare('SELECT COUNT(*) c FROM posts').get().c,
    comments: db.prepare('SELECT COUNT(*) c FROM comments').get().c,
    likes: db.prepare('SELECT COUNT(*) c FROM post_likes').get().c,
    reports: db.prepare("SELECT COUNT(*) c FROM reports WHERE status = 'pending'").get().c,
  });
});

router.get('/users', requireAdmin, (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const like = `%${q}%`;
  res.json({ users: db.prepare('SELECT id, username, name, email, avatar, is_admin, is_blocked, created_at FROM users WHERE username LIKE ? OR name LIKE ? OR email LIKE ? ORDER BY created_at DESC LIMIT 100').all(like, like, like) });
});

router.post('/users/:id/block', requireAdmin, (req, res) => {
  db.prepare('UPDATE users SET is_blocked = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/users/:id/unblock', requireAdmin, (req, res) => {
  db.prepare('UPDATE users SET is_blocked = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.delete('/users/:id', requireAdmin, (req, res) => {
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Cannot delete self' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/posts', requireAdmin, (req, res) => {
  res.json({ posts: db.prepare('SELECT p.*, u.username FROM posts p JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC LIMIT 100').all() });
});

router.delete('/posts/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/comments', requireAdmin, (req, res) => {
  res.json({ comments: db.prepare('SELECT c.*, u.username FROM comments c JOIN users u ON u.id=c.user_id ORDER BY c.created_at DESC LIMIT 100').all() });
});

router.delete('/comments/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/reports', requireAdmin, (req, res) => {
  res.json({ reports: db.prepare('SELECT r.*, u.username as reporter, p.text as post_text FROM reports r JOIN users u ON u.id=r.reporter_id LEFT JOIN posts p ON p.id=r.post_id ORDER BY r.created_at DESC LIMIT 100').all() });
});

router.post('/reports/:id/resolve', requireAdmin, (req, res) => {
  db.prepare("UPDATE reports SET status = 'resolved' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

router.post('/reports/:id/reject', requireAdmin, (req, res) => {
  db.prepare("UPDATE reports SET status = 'rejected' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

export default router;
