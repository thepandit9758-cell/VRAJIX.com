import { authenticateAdmin } from '../auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ authenticated: false, error: 'DB not bound' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const session = await authenticateAdmin(request, env.DB);
  if (!session) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({
    authenticated: true,
    username: session.username,
    expiresAt: session.expires_at
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
