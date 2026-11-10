import { authenticateAdmin } from '../../auth.js';

export async function onRequestPatch(context) {
  const { request, env, params } = context;
  const leadId = params.id;

  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, error: 'Database not configured.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const session = await authenticateAdmin(request, env.DB);
  if (!session) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body;
  try {
    body = await request.json();
  } catch(e) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON.' }), { status: 400 });
  }

  const newStatus = body.status;
  const allowed = ['New', 'Contacted', 'In Progress', 'Closed'];
  if (!allowed.includes(newStatus)) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid status value.' }), { status: 400 });
  }

  await env.DB.prepare("UPDATE enquiries SET status = ?, updated_at = datetime('now') WHERE id = ? OR ref_id = ?")
    .bind(newStatus, leadId, leadId).run();

  return new Response(JSON.stringify({ success: true, message: 'Status updated successfully.' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const leadId = params.id;

  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, error: 'Database not configured.' }), { status: 500 });
  }

  const session = await authenticateAdmin(request, env.DB);
  if (!session) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized.' }), { status: 401 });
  }

  await env.DB.prepare("DELETE FROM enquiries WHERE id = ? OR ref_id = ?").bind(leadId, leadId).run();

  return new Response(JSON.stringify({ success: true, message: 'Lead deleted successfully.' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
