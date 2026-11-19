
function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

function clean(value, maxLength = 2000) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createRefId() {
  return "VRX-" + crypto.randomUUID()
    .replace(/-/g, "")
    .slice(0, 12)
    .toUpperCase();
}

async function sendNotification(env, enquiry) {
  if (!env.WEB3FORMS_ACCESS_KEY) {
    return {
      sent: false,
      reason: "Email service not configured"
    };
  }

  try {
    const formData = new FormData();

    formData.append("access_key", env.WEB3FORMS_ACCESS_KEY);
    formData.append("subject", `New VRAJIX Enquiry - ${enquiry.refId}`);
    formData.append("from_name", "VRAJIX Website");

    formData.append("name", enquiry.name);
    formData.append("email", enquiry.email);
    formData.append("phone", enquiry.phone);
    formData.append("service", enquiry.service);
    formData.append("budget", enquiry.budget || "Not specified");
    formData.append("timeline", enquiry.timeline || "Not specified");

    formData.append("message", `
New Project Enquiry

Reference ID: ${enquiry.refId}

Customer Name: ${enquiry.name}
Customer Email: ${enquiry.email}
Customer Phone: ${enquiry.phone}

Required Service: ${enquiry.service}
Project Budget: ${enquiry.budget || "Not specified"}
Project Timeline: ${enquiry.timeline || "Not specified"}

Project Details:
${enquiry.details}

Submitted At: ${enquiry.timestamp}
    `);

    const response = await fetch(
      "https://api.web3forms.com/submit",
      {
        method: "POST",
        body: formData
      }
    );

    const result = await response.json();

    return {
      sent: response.ok && result.success === true,
      reason: result.message || "Email delivery failed"
    };

  } catch (error) {
    console.error("Email notification error:", error);

    return {
      sent: false,
      reason: "Email service unavailable"
    };
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) {
      return json({
        success: false,
        error: "Database not configured"
      }, 500);
    }

    if (!request.headers.get("content-type")?.includes("application/json")) {
      return json({
        success: false,
        error: "JSON required"
      }, 415);
    }

    const body = await request.json();

    const name = clean(body.clientName, 100);
    const email = clean(body.clientEmail, 254).toLowerCase();
    const phone = clean(body.clientPhone, 25);
    const service = clean(body.requiredService, 100);
    const budget = clean(body.projectBudget, 100);
    const timeline = clean(body.projectTimeline, 100);
    const details = clean(body.projectDetails, 2000);

    if (
      name.length < 2 ||
      !validEmail(email) ||
      phone.length < 8 ||
      !service ||
      details.length < 15
    ) {
      return json({
        success: false,
        error: "Please provide valid enquiry details."
      }, 400);
    }

    const refId = createRefId();
    const timestamp = new Date().toISOString();

    const enquiry = {
      refId,
      name,
      email,
      phone,
      service,
      budget,
      timeline,
      details,
      timestamp
    };

    // 1. Save enquiry in D1 Database
    await env.DB.prepare(`
      INSERT INTO enquiries
      (ref_id, name, email, phone, service, budget, timeline, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      refId,
      name,
      email,
      phone,
      service,
      budget || null,
      timeline || null,
      details,
      timestamp
    ).run();

    // 2. Send email notification
    const emailResult = await sendNotification(env, enquiry);

    // 3. Return separate database and email status
    return json({
      success: true,
      dbStored: true,
      emailSent: emailResult.sent,
      refId,
      message: emailResult.sent
        ? "Enquiry saved and notification sent."
        : "Enquiry saved, but email notification could not be sent."
    }, 201);

  } catch (error) {
    console.error("Enquiry submission error:", error);

    return json({
      success: false,
      dbStored: false,
      error: "Unable to process enquiry."
    }, 500);
  }
}
