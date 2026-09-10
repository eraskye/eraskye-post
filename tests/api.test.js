import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const PORT = 3939;
const BASE = `http://localhost:${PORT}`;
let server;

const rand = () => Math.random().toString(36).slice(2, 10);

function cookiesFrom(res) {
  const set = res.headers.get('set-cookie');
  if (!set) return '';
  return set.split(',').map(s => s.split(';')[0]).join('; ');
}

async function req(path, { method = 'GET', body, cookie = '', form } = {}) {
  const opts = { method, headers: {} };
  if (cookie) opts.headers.cookie = cookie;
  if (form) opts.body = form;
  else if (body) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
  return fetch(BASE + path, opts);
}

before(async () => {
  process.env.DB_PATH = './database/test.db';
  if (fs.existsSync('./database/test.db')) fs.unlinkSync('./database/test.db');
  server = spawn('node', ['src/server.js'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(PORT), DB_PATH: './database/test.db' },
    stdio: 'inherit',
  });
  await new Promise(r => setTimeout(r, 1500));
});

after(() => { server?.kill(); });

test('register + login + me + logout', async () => {
  const u = rand();
  const r = await req('/api/auth/register', { method: 'POST', body: { username: 'u' + u, name: 'User', email: u + '@t.co', password: 'secret1', confirm: 'secret1' } });
  assert.equal(r.status, 200);
  const cookie = cookiesFrom(r);
  const me = await req('/api/auth/me', { cookie });
  const m = await me.json();
  assert.equal(m.user.username, 'u' + u);

  const lo = await req('/api/auth/logout', { method: 'POST', cookie });
  assert.equal(lo.status, 200);
});

test('post lifecycle + like + comment', async () => {
  const u = rand();
  const r = await req('/api/auth/register', { method: 'POST', body: { username: 'p' + u, name: 'P', email: 'p' + u + '@t.co', password: 'secret1', confirm: 'secret1' } });
  const cookie = cookiesFrom(r);

  // create post
  const form = new FormData();
  form.append('text', 'hello world');
  const cp = await req('/api/posts', { method: 'POST', cookie, form });
  assert.equal(cp.status, 200);
  const { post } = await cp.json();
  assert.ok(post.id);

  // like own? we test with second user
  const r2 = await req('/api/auth/register', { method: 'POST', body: { username: 'q' + u, name: 'Q', email: 'q' + u + '@t.co', password: 'secret1', confirm: 'secret1' } });
  const c2 = cookiesFrom(r2);

  const like = await req(`/api/likes/${post.id}`, { method: 'POST', cookie: c2 });
  const lj = await like.json();
  assert.equal(lj.liked, true);
  assert.equal(lj.likes, 1);

  const unlike = await req(`/api/likes/${post.id}`, { method: 'POST', cookie: c2 });
  const uj = await unlike.json();
  assert.equal(uj.liked, false);
  assert.equal(uj.likes, 0);

  const cm = await req(`/api/comments/post/${post.id}`, { method: 'POST', cookie: c2, body: { text: 'nice' } });
  const cj = await cm.json();
  assert.equal(cj.comment.text, 'nice');

  const follow = await req(`/api/follow/${post.user.id}`, { method: 'POST', cookie: c2 });
  const fj = await follow.json();
  assert.equal(fj.following, true);

  const save = await req(`/api/saved/${post.id}`, { method: 'POST', cookie: c2 });
  const sj = await save.json();
  assert.equal(sj.saved, true);

  const rep = await req('/api/reports', { method: 'POST', cookie: c2, body: { post_id: post.id, reason: 'spam' } });
  assert.equal(rep.status, 200);

  const del = await req(`/api/posts/${post.id}`, { method: 'DELETE', cookie });
  assert.equal(del.status, 200);
});

test('admin authorization', async () => {
  const r = await req('/api/admin/stats');
  assert.equal(r.status, 403);
});
