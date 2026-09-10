import express from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { now } from '../utils.js';
import { upload, processImage, deleteUpload } from '../middleware/upload.js';

const router = express.Router();

export function buildPost(p, viewerId) {
  const images = db.prepare('SELECT url FROM post_images WHERE post_id = ? ORDER BY position').all(p.id).map(r => r.url);
  const music = db.prepare('SELECT * FROM music_tracks WHERE post_id = ?').get(p.id);
  const likes = db.prepare('SELECT COUNT(*) c FROM post_likes WHERE post_id = ?').get(p.id).c;
  const comments = db.prepare('SELECT COUNT(*) c FROM comments WHERE post_id = ?').get(p.id).c;
  const user = db.prepare('SELECT id, username, name, avatar FROM users WHERE id = ?').get(p.user_id);
  const liked = viewerId ? !!db.prepare('SELECT 1 FROM post_likes WHERE user_id=? AND post_id=?').get(viewerId, p.id) : false;
  const saved = viewerId ? !!db.prepare('SELECT 1 FROM saved_posts WHERE user_id=? AND post_id=?').get(viewerId, p.id) : false;
  return {
    id: p.id, text: p.text, created_at: p.created_at,
    user, images, likes, comments, liked, saved,
    music: music ? {
      spotify_id: music.spotify_id, track_name: music.track_name, artist: music.artist,
      cover_url: music.cover_url, preview_url: music.preview_url, embed_url: music.embed_url,
      start_ms: music.start_ms, duration_ms: music.duration_ms
    } : null,
  };
}

router.get('/feed', (req, res) => {
  const { cursor, limit = 20 } = req.query;
  const lim = Math.min(parseInt(limit) || 20, 50);
  const rows = cursor
    ? db.prepare('SELECT * FROM posts WHERE created_at < ? ORDER BY created_at DESC LIMIT ?').all(parseInt(cursor), lim)
    : db.prepare('SELECT * FROM posts ORDER BY created_at DESC LIMIT ?').all(lim);
  const nextCursor = rows.length === lim ? rows[rows.length - 1].created_at : null;
  res.json({ posts: rows.map(p => buildPost(p, req.user?.id)), nextCursor });
});

router.get('/user/:username', (req, res) => {
  const u = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
  if (!u) return res.status(404).json({ error: 'Not found' });
  const rows = db.prepare('SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(u.id);
  res.json({ posts: rows.map(p => buildPost(p, req.user?.id)) });
});

router.get('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json({ post: buildPost(p, req.user?.id) });
});

router.post('/', requireAuth, upload.array('images', 4), async (req, res) => {
  try {
    const text = (req.body.text || '').toString().slice(0, 2000);
    const hasImages = req.files && req.files.length > 0;
    let music = null;
    if (req.body.music) { try { music = JSON.parse(req.body.music); } catch {} }
    if (!text.trim() && !hasImages && !music) return res.status(400).json({ error: 'Empty post' });
    const info = db.prepare('INSERT INTO posts (user_id, text, created_at) VALUES (?,?,?)').run(req.user.id, text, now());
    const postId = info.lastInsertRowid;
    if (hasImages) {
      let pos = 0;
      for (const f of req.files) {
        const url = await processImage(f.buffer, 'post');
        db.prepare('INSERT INTO post_images (post_id, url, position) VALUES (?,?,?)').run(postId, url, pos++);
      }
    }
    if (music && music.spotify_id) {
      db.prepare(`INSERT INTO music_tracks (post_id, spotify_id, track_name, artist, cover_url, preview_url, embed_url, start_ms, duration_ms) VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(postId, music.spotify_id, music.track_name || '', music.artist || '', music.cover_url || '', music.preview_url || '', music.embed_url || '', music.start_ms || 0, music.duration_ms || 30000);
    }
    res.json({ post: buildPost(db.prepare('SELECT * FROM posts WHERE id = ?').get(postId), req.user.id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, (req, res) => {
  const p = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (p.user_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
  db.prepare('SELECT url FROM post_images WHERE post_id = ?').all(p.id).forEach(i => deleteUpload(i.url));
  db.prepare('DELETE FROM posts WHERE id = ?').run(p.id);
  res.json({ ok: true });
});

export default router;
