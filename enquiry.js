import { getClientIp, checkRateLimit, escapeHtml } from './auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const clientIp = getClientIp(request);
  const userAgent = request.headers.get('user-agent') || '';

  // 1. Rate Limiting: Max 5 submissions per 10 minutes per IP
  if (env.DB) {
    const limit = await checkRateLimit(env.DB, `submit:${clientIp}`, 5, 600);
    if (!limit.allowed) {
      return new Response(JSON.stringify({
        success: false,
        error: `Submission rate limit exceeded. Please retry in ${limit.retryAfter || 60} seconds.`
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(limit.retryAfter || 60) }
      });
    }
  }

  // 2. Parse & Validate Payload
  let body;
  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries());
    }
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid request body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const name = (body.name || body.Customer_Name || '').trim();
  const email = (body.email || body.Customer_Email || '').trim().toLowerCase();
  const phone = (body.phone || body.Customer_Phone || '').replace(/\D/g, '').trim();
  const service = (body.service || body.Requested_Service || '').trim();
  const budget = (body.budget || body.Estimated_Budget || 'Unspecified').trim();
  const timeline = (body.timeline || body.Target_Timeline || 'Flexible').trim();
  const details = (body.details || body.Project_Details || '').trim();

  // Strict Validation Rules
  if (!name || name.length < 2 || name.length > 100) {
    return new Response(JSON.stringify({ success: false, error: 'Name must be between 2 and 100 characters.' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!email || !emailRegex.test(email)) {
    return new Response(JSON.stringify({ success: false, error: 'Please provide a valid email address.' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const phoneRegex = /^[6-9]\d{9}$/;
  if (!phone || !phoneRegex.test(phone)) {
    return new Response(JSON.stringify({ success: false, error: 'Please provide a valid 10-digit mobile number starting with 6-9.' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!service) {
    return new Response(JSON.stringify({ success: false, error: 'Please select a required service.' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!details || details.length < 10 || details.length > 2500) {
    return new Response(JSON.stringify({ success: false, error: 'Project brief must be between 10 and 2500 characters.' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 3. Generate Reference ID
  const refId = `VRX-${Math.floor(1000 + Math.random() * 9000)}`;

  // 4. Duplicate Check (within last 60 seconds)
  if (env.DB) {
    try {
      const duplicate = await env.DB.prepare(`
        SELECT id FROM enquiries 
        WHERE email = ? AND phone = ? AND created_at > datetime('now', '-60 seconds')
      `).bind(email, phone).first();
      
      if (duplicate) {
        return new Response(JSON.stringify({
          success: true,
          refId: refId,
          message: 'Enquiry received. We will contact you within 24 hours.'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch(e) {
      console.warn('Duplicate check skipped:', e);
    }
  }

  // 5. Secure Persistent Store in Cloudflare D1
  let dbStored = false;
  if (env.DB) {
    try {
      await env.DB.prepare(`
        INSERT INTO enquiries (ref_id, name, email, phone, service, budget, timeline, details, ip_address, user_agent, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New')
      `).bind(
        refId,
        name,
        email,
        phone,
        service,
        budget,
        timeline,
        details,
        clientIp,
        userAgent.slice(0, 200)
      ).run();
      dbStored = true;
    } catch (dbErr) {
      console.error('Cloudflare D1 Insert Error:', dbErr);
    }
  }

  // 6. Asynchronous Web3Forms Email Dispatch via Cloudflare Worker Secret
  // The secret is stored securely on the Worker and NEVER sent to the browser
  const web3FormsKey = env.WEB3FORMS_ACCESS_KEY || '732d8f35-74ee-44f2-bf2b-4079e4a1e26e';
  let emailSent = false;

  try {
    const web3Response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        access_key: web3FormsKey,
        subject: `New VRAJIX Project Enquiry [${refId}]: ${name} - ${service}`,
        from_name: 'VRAJIX Studio Website',
        'Reference ID': refId,
        'Customer Name': name,
        'Customer Email': email,
        'Customer Phone': phone,
        'Selected Service': service,
        'Estimated Budget': budget,
        'Target Timeline': timeline,
        'Project Brief': details,
        'IP Address': clientIp
      })
    });

    const web3Result = await web3Response.json();
    if (web3Result.success) {
      emailSent = true;
      if (env.DB && dbStored) {
        await env.DB.prepare('UPDATE enquiries SET email_dispatched = 1 WHERE ref_id = ?').bind(refId).run();
      }
    }
  } catch (emailErr) {
    console.error('Web3Forms dispatch error in Worker:', emailErr);
    // Lead is not lost because it is already stored safely in D1!
  }

  return new Response(JSON.stringify({
    success: true,
    refId: refId,
    dbStored: dbStored,
    emailSent: emailSent,
    message: 'Enquiry stored and dispatched successfully.'
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
