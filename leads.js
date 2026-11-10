import { authenticateAdmin } from '../auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, error: 'Database not configured.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Authentication Required
  const session = await authenticateAdmin(request, env.DB);
  if (!session) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized. Please log in.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const status = (url.searchParams.get('status') || '').trim();
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);

  let query = 'SELECT * FROM enquiries';
  const conditions = [];
  const params = [];

  if (q) {
    conditions.push('(name LIKE ? OR email LIKE ? OR phone LIKE ? OR ref_id LIKE ?)');
    const searchTerm = `%${q}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  if (status && status !== 'all') {
    conditions.push('status = ?');
    params.push(status);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  try {
    const result = await env.DB.prepare(query).bind(...params).all();
    return new Response(JSON.stringify({
      success: true,
      total: result.results ? result.results.length : 0,
      leads: result.results || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('D1 fetch leads error:', e);
    return new Response(JSON.stringify({ success: false, error: 'Failed to retrieve enquiries.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
