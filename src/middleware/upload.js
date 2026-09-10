import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.resolve(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 4 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) return cb(new Error('Invalid image type'));
    cb(null, true);
  }
});

export async function processImage(buffer, prefix = 'post') {
  const name = `${prefix}_${crypto.randomBytes(8).toString('hex')}.jpg`;
  await sharp(buffer).rotate().resize(1280, 1280, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toFile(path.join(UPLOAD_DIR, name));
  return `/uploads/${name}`;
}

export async function processAvatar(buffer) {
  const name = `av_${crypto.randomBytes(8).toString('hex')}.jpg`;
  await sharp(buffer).rotate().resize(400, 400, { fit: 'cover' }).jpeg({ quality: 88 }).toFile(path.join(UPLOAD_DIR, name));
  return `/uploads/${name}`;
}

export function deleteUpload(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  fs.promises.unlink(path.join(UPLOAD_DIR, path.basename(url))).catch(() => {});
}
