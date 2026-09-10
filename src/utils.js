import crypto from 'crypto';
export const now = () => Date.now();
export const uid = () => crypto.randomBytes(24).toString('hex');
