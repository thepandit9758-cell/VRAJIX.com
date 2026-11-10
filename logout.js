import { parseCookies } from '../auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const cookies = parseCookies(request);
  const token = cookies['vrajix_admin_session'];

  if (token && env.DB) {
    try {
      await env.DB.prepare('DELETE FROM admin_sessions WHERE token = ?').bind(token).run();
    } catch(e) {}
  }

  // Clear cookie with Max-Age=0
  const clearCookie = 'vrajix_admin_session=deleted; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';

  return new Response(JSON.stringify({ success: true, message: 'Logged out successfully.' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearCookie
    }
  });
}
