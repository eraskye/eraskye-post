import express from 'express';
import db from '../db.js';

const router = express.Router();

function publicUser(u, viewerId) {
  if (!u) return null;
  const followers = db.prepare('SELECT COUNT(*) c FROM followers WHERE following_id = ?').get(u.id).c;
  const following = db.prepare('SELECT COUNT(*) c FROM followers WHERE follower_id = ?').get(u.id).c;
  const posts = db.prepare('SELECT COUNT(*) c FROM posts WHERE user_id = ?').get(u.id).c;
  const isFollowing = viewerId ? !!db.prepare('SELECT 1 FROM followers WHERE follower_id=? AND following_id=?').get(viewerId, u.id) : false;
  const isMe = viewerId === u.id;
  return { id: u.id, username: u.username, name: u.name, bio: u.bio, avatar: u.avatar, followers, following, posts, isFollowing, isMe };
}

router.get('/:username', (req, res) => {
  const u = db.prepare('SELECT id, username, name, bio, avatar FROM users WHERE username = ?').get(req.params.username);
  if (!u) return res.status(404).json({ error: 'Not found' });
  res.json({ user: publicUser(u, req.user?.id) });
});

router.get('/:username/followers', (req, res) => {
  const u = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
  if (!u) return res.status(404).json({ error: 'Not found' });
  res.json({ users: db.prepare('SELECT u.id, u.username, u.name, u.avatar FROM followers f JOIN users u ON u.id=f.follower_id WHERE f.following_id=? LIMIT 100').all(u.id) });
});

router.get('/:username/following', (req, res) => {
  const u = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
  if (!u) return res.status(404).json({ error: 'Not found' });
  res.json({ users: db.prepare('SELECT u.id, u.username, u.name, u.avatar FROM followers f JOIN users u ON u.id=f.following_id WHERE f.follower_id=? LIMIT 100').all(u.id) });
});

export default router;
