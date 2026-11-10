// ============================================================================
// VRAJIX STUDIO — CLOUDFLARE WORKER SECURITY & AUTH UTILITIES
// PBKDF2-HMAC-SHA256 Hashing, Session Verification, Rate Limiting & Sanitization
// ============================================================================

export async function hashPassword(password, saltHex = null) {
  const enc = new TextEncoder();
  const salt = saltHex 
    ? hexToBytes(saltHex) 
    : crypto.getRandomValues(new Uint8Array(16));
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  
  const rawKey = await crypto.subtle.exportKey('raw', key);
  return {
    hashHex: bytesToHex(new Uint8Array(rawKey)),
    saltHex: bytesToHex(salt)
  };
}

export async function verifyPassword(password, hashHex, saltHex) {
  const result = await hashPassword(password, saltHex);
  return result.hashHex === hashHex;
}

export function generateSessionToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToHex(bytes);
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

export function getClientIp(request) {
  return request.headers.get('cf-connecting-ip') || 
         request.headers.get('x-real-ip') || 
         request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
         '127.0.0.1';
}

export function parseCookies(request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = {};
  cookieHeader.split(';').forEach(c => {
    const [k, v] = c.trim().split('=');
    if (k && v) cookies[k] = decodeURIComponent(v);
  });
  return cookies;
}

// Rate Limiter backed by D1
export async function checkRateLimit(db, key, maxAttempts, windowSeconds) {
  const now = Math.floor(Date.now() / 1000);
  try {
    const record = await db.prepare('SELECT count, reset_at FROM rate_limits WHERE key = ?').bind(key).first();
    if (!record || record.reset_at < now) {
      await db.prepare('INSERT OR REPLACE INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)').bind(key, now + windowSeconds).run();
      return { allowed: true, remaining: maxAttempts - 1 };
    }
    if (record.count >= maxAttempts) {
      return { allowed: false, remaining: 0, retryAfter: record.reset_at - now };
    }
    await db.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').bind(key).run();
    return { allowed: true, remaining: maxAttempts - (record.count + 1) };
  } catch (e) {
    console.warn('Rate limiter D1 fallback:', e);
    return { allowed: true, remaining: 1 };
  }
}

// Session Validator
export async function authenticateAdmin(request, db) {
  const cookies = parseCookies(request);
  const authHeader = request.headers.get('Authorization') || '';
  let token = cookies['vrajix_admin_session'];
  
  if (!token && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }
  
  if (!token) return null;
  
  const now = Date.now();
  try {
    const session = await db.prepare(`
      SELECT s.token, s.admin_id, s.expires_at, a.username 
      FROM admin_sessions s
      JOIN admins a ON s.admin_id = a.id
      WHERE s.token = ? AND s.expires_at > ?
    `).bind(token, now).first();
    
    return session || null;
  } catch (e) {
    console.error('Session authentication error:', e);
    return null;
  }
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
