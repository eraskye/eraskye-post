import express from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { now, uid } from '../utils.js';
import { upload, processAvatar, deleteUpload } from '../middleware/upload.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true });

const setSession = (res, userId, isAdmin = 0, days = 30) => {
  const sid = uid();
  const ms = 1000 * 60 * 60 * 24 * days;
  db.prepare('INSERT INTO sessions (id, user_id, is_admin, created_at, expires_at) VALUES (?,?,?,?,?)').run(sid, userId, isAdmin, now(), now() + ms);
  res.cookie('sid', sid, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: ms });
};

router.post('/register', authLimiter, upload.single('avatar'), async (req, res) => {
  try {
    const { username, name, email, password, confirm } = req.body;
    if (!username || !name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
    if (password !== confirm) return res.status(400).json({ error: 'Passwords do not match' });
    if (!/^[a-zA-Z0-9_.]{3,24}$/.test(username)) return res.status(400).json({ error: 'Invalid username' });
    if (password.length < 6) return res.status(400).json({ error: 'Password too short' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });
    const exists = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (exists) return res.status(409).json({ error: 'User already exists' });
    let avatar = '';
    if (req.file) avatar = await processAvatar(req.file.buffer);
    const hash = await bcrypt.hash(password, 10);
    const info = db.prepare('INSERT INTO users (username, name, email, password_hash, avatar, created_at) VALUES (?,?,?,?,?,?)').run(username, name, email, hash, avatar, now());
    setSession(res, info.lastInsertRowid);
    const user = db.prepare('SELECT id, username, name, email, bio, avatar, is_admin FROM users WHERE id = ?').get(info.lastInsertRowid);
    res.json({ user });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);
  if (!user || user.is_blocked) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  setSession(res, user.id, user.is_admin);
  res.json({ user: { id: user.id, username: user.username, name: user.name, email: user.email, bio: user.bio, avatar: user.avatar, is_admin: user.is_admin } });
});

router.post('/logout', (req, res) => {
  const sid = req.cookies?.sid;
  if (sid) db.prepare('DELETE FROM sessions WHERE id = ?').run(sid);
  res.clearCookie('sid');
  res.json({ ok: true });
});

router.get('/me', (req, res) => res.json({ user: req.user || null }));

router.patch('/me', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    const { username, name, bio } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    let newUsername = user.username;
    if (username && username !== user.username) {
      if (!/^[a-zA-Z0-9_.]{3,24}$/.test(username)) return res.status(400).json({ error: 'Invalid username' });
      if (db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, user.id)) return res.status(409).json({ error: 'Username taken' });
      newUsername = username;
    }
    let avatar = user.avatar;
    if (req.file) {
      const newAv = await processAvatar(req.file.buffer);
      if (user.avatar) deleteUpload(user.avatar);
      avatar = newAv;
    }
    db.prepare('UPDATE users SET username=?, name=?, bio=?, avatar=? WHERE id=?').run(newUsername, name ?? user.name, bio ?? user.bio, avatar, user.id);
    res.json({ user: db.prepare('SELECT id, username, name, email, bio, avatar, is_admin FROM users WHERE id = ?').get(user.id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
