import { getClientIp, checkRateLimit, verifyPassword, generateSessionToken } from '../auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const clientIp = getClientIp(request);

  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, error: 'Database binding not configured.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Rate Limiting: Max 5 login attempts per 15 minutes per IP
  const rate = await checkRateLimit(env.DB, `login:${clientIp}`, 5, 900);
  if (!rate.allowed) {
    return new Response(JSON.stringify({
      success: false,
      error: `Too many failed login attempts. Account locked for ${Math.ceil((rate.retryAfter || 900)/60)} minutes.`
    }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON credentials.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const username = (body.username || '').trim();
  const password = body.password || '';

  if (!username || !password) {
    return new Response(JSON.stringify({ success: false, error: 'Username and password are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Look up admin by username
  const admin = await env.DB.prepare('SELECT id, username, password_hash, salt FROM admins WHERE username = ?').bind(username).first();
  if (!admin) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid username or password.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Verify PBKDF2 Password Hash
  const isValid = await verifyPassword(password, admin.password_hash, admin.salt);
  if (!isValid) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid username or password.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Reset rate limit on successful authentication
  await env.DB.prepare('DELETE FROM rate_limits WHERE key = ?').bind(`login:${clientIp}`).run();

  // Generate cryptographically secure 256-bit session token
  const token = generateSessionToken();
  const expiresAt = Date.now() + 24 * 3600 * 1000; // 24 Hours
  const userAgent = (request.headers.get('user-agent') || '').slice(0, 200);

  // Store Session in D1
  await env.DB.prepare(`
    INSERT INTO admin_sessions (token, admin_id, expires_at, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?)
  `).bind(token, admin.id, expiresAt, clientIp, userAgent).run();

  // Update last_login
  await env.DB.prepare("UPDATE admins SET last_login = datetime('now') WHERE id = ?").bind(admin.id).run();

  // Return HttpOnly, Secure, SameSite=Strict Cookie
  const cookieHeader = `vrajix_admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`;

  return new Response(JSON.stringify({
    success: true,
    token: token,
    username: admin.username,
    message: 'Admin authenticated successfully.'
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookieHeader
    }
  });
}
