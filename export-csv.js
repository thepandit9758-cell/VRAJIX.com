import { authenticateAdmin } from '../auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) {
    return new Response('Database not configured.', { status: 500 });
  }

  const session = await authenticateAdmin(request, env.DB);
  if (!session) {
    return new Response('Unauthorized access. Please log in first.', { status: 401 });
  }

  try {
    const result = await env.DB.prepare('SELECT * FROM enquiries ORDER BY created_at DESC').all();
    const leads = result.results || [];

    const headers = ['RefID', 'Name', 'Email', 'Phone', 'Service', 'Budget', 'Timeline', 'Details', 'Status', 'IP_Address', 'Created_At'];
    
    // Sanitize values to prevent CSV formula injection (=, +, -, @ prefix)
    function sanitizeCsvCell(val) {
      if (val === null || val === undefined) return '""';
      let str = String(val).trim();
      if (/^[=+\-@]/.test(str)) {
        str = "'" + str; // Prefix with single quote to disable spreadsheet formula execution
      }
      return `"${str.replace(/"/g, '""')}"`;
    }

    const rows = leads.map(l => [
      sanitizeCsvCell(l.ref_id),
      sanitizeCsvCell(l.name),
      sanitizeCsvCell(l.email),
      sanitizeCsvCell(l.phone),
      sanitizeCsvCell(l.service),
      sanitizeCsvCell(l.budget),
      sanitizeCsvCell(l.timeline),
      sanitizeCsvCell(l.details),
      sanitizeCsvCell(l.status),
      sanitizeCsvCell(l.ip_address),
      sanitizeCsvCell(l.created_at)
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const dateStr = new Date().toISOString().slice(0, 10);

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="vrajix_leads_${dateStr}.csv"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });
  } catch (e) {
    console.error('CSV Export Error:', e);
    return new Response('Failed to generate CSV export.', { status: 500 });
  }
}
