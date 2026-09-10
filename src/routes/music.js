import express from 'express';

const router = express.Router();

let tokenCache = { token: null, exp: 0 };

async function getToken() {
  if (tokenCache.token && tokenCache.exp > Date.now()) return tokenCache.token;
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error('Spotify credentials missing');
  const auth = Buffer.from(`${id}:${secret}`).toString('base64');
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  if (!r.ok) throw new Error('Spotify auth failed');
  const data = await r.json();
  tokenCache = { token: data.access_token, exp: Date.now() + (data.expires_in - 60) * 1000 };
  return data.access_token;
}

router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (!q) return res.json({ tracks: [] });
    const token = await getToken();
    const r = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=20`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.ok) throw new Error('Spotify search failed');
    const data = await r.json();
    const tracks = (data.tracks?.items || []).map(t => ({
      spotify_id: t.id,
      track_name: t.name,
      artist: (t.artists || []).map(a => a.name).join(', '),
      cover_url: t.album?.images?.[0]?.url || '',
      preview_url: t.preview_url || null,
      embed_url: `https://open.spotify.com/embed/track/${t.id}`,
      duration_ms: t.duration_ms || 30000,
    }));
    res.json({ tracks });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
