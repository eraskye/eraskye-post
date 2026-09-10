import db from '../db.js';
import { now } from '../utils.js';

export function loadUser(req, res, next) {
  const sid = req.cookies?.sid;
  if (!sid) return next();
  const s = db.prepare('SELECT * FROM sessions WHERE id = ? AND expires_at > ?').get(sid, now());
  if (!s) return next();
  const user = db.prepare('SELECT id, username, name, email, bio, avatar, is_admin, is_blocked FROM users WHERE id = ?').get(s.user_id);
  if (user && !user.is_blocked) req.user = user;
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
  next();
}
