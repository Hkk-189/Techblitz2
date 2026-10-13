// api/_lib/auth.js
// Cryptographic JWT Signing & Role Verification (Zero-dependency via native node:crypto)
import crypto from 'node:crypto';

if (process.env.VERCEL && !process.env.JWT_SECRET) throw new Error('JWT_SECRET must be set in production');
const JWT_SECRET = process.env.JWT_SECRET || 'tech-blitz-secret-key-32-chars-minimum-fallback'; // dev/test only

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}

export function signToken(payload, expiresInSeconds = 86400) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  // Constant-time buffer comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

export function getUserFromRequest(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return verifyToken(token);
}

export function requireAdmin(req) {
  const user = getUserFromRequest(req);
  if (!user) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }
  if (user.role !== 'admin') {
    return { ok: false, status: 403, error: 'Admin authorization required' };
  }
  return { ok: true, user };
}

export function requireUser(req) {
  const user = getUserFromRequest(req);
  if (!user) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }
  return { ok: true, user };
}
