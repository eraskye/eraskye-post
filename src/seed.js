import 'dotenv/config';
import bcrypt from 'bcryptjs';
import readline from 'readline';
import db from './db.js';
import { now } from './utils.js';

const ask = q => new Promise(res => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(q, a => { rl.close(); res(a.trim()); });
});

const username = process.env.ADMIN_USERNAME || await ask('Admin username: ');
const email = process.env.ADMIN_EMAIL || await ask('Admin email: ');
const password = process.env.ADMIN_PASSWORD || await ask('Admin password: ');

if (!username || !email || !password || password.length < 6) {
  console.error('Invalid admin data'); process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);

if (existing) {
  db.prepare('UPDATE users SET is_admin = 1, password_hash = ? WHERE id = ?').run(hash, existing.id);
  console.log('✔ Existing user promoted to admin:', username);
} else {
  db.prepare('INSERT INTO users (username, name, email, password_hash, is_admin, created_at) VALUES (?,?,?,?,1,?)')
    .run(username, 'Administrator', email, hash, now());
  console.log('✔ Admin created:', username);
}
