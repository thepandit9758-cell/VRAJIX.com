// ============================================================================
// VRAJIX STUDIO — STANDALONE CLOUDFLARE WORKER ROUTER
// Compatible with Cloudflare Workers + D1 Database
// ============================================================================

import { onRequestPost as handleEnquiry } from '../functions/api/enquiry.js';
import { onRequestPost as handleLogin } from '../functions/api/admin/login.js';
import { onRequestPost as handleLogout } from '../functions/api/admin/logout.js';
import { onRequestGet as handleCheckAuth } from '../functions/api/admin/check-auth.js';
import { onRequestGet as handleLeads } from '../functions/api/admin/leads.js';
import { onRequestGet as handleExportCsv } from '../functions/api/admin/export-csv.js';
import { onRequestPatch as handleUpdateLead, onRequestDelete as handleDeleteLead } from '../functions/api/admin/leads/[id].js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const context = { request, env, params: {} };

    // CORS Pre-flight
    if (request.method === 'OPTIONS') {
      const origin = request.headers.get('Origin') || '*';
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Credentials': 'true'
        }
      });
    }

    // Router
    try {
      if (pathname === '/api/enquiry' && request.method === 'POST') {
        return await handleEnquiry(context);
      }
      if (pathname === '/api/admin/login' && request.method === 'POST') {
        return await handleLogin(context);
      }
      if (pathname === '/api/admin/logout' && request.method === 'POST') {
        return await handleLogout(context);
      }
      if (pathname === '/api/admin/check-auth' && request.method === 'GET') {
        return await handleCheckAuth(context);
      }
      if (pathname === '/api/admin/leads' && request.method === 'GET') {
        return await handleLeads(context);
      }
      if (pathname === '/api/admin/export-csv' && request.method === 'GET') {
        return await handleExportCsv(context);
      }
      
      const leadMatch = pathname.match(/^\/api\/admin\/leads\/([^\/]+)$/);
      if (leadMatch) {
        context.params.id = leadMatch[1];
        if (request.method === 'PATCH') return await handleUpdateLead(context);
        if (request.method === 'DELETE') return await handleDeleteLead(context);
      }

      // Static assets or 404
      return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      console.error('Worker Router Error:', err);
      return new Response(JSON.stringify({ success: false, error: 'Internal server error.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
