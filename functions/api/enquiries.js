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

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) {
      return json({ success: false, error: "Database not configured" }, 500);
    }

    if (!request.headers.get("content-type")?.includes("application/json")) {
      return json({ success: false, error: "JSON required" }, 415);
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

    await env.DB.prepare(`
      INSERT INTO enquiries
      (ref_id, name, email, phone, service, budget, timeline, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      refId, name, email, phone, service,
      budget || null, timeline || null, details, timestamp
    ).run();

    return json({
      success: true,
      refId,
      message: "Your enquiry has been received."
    }, 201);

  } catch (error) {
    console.error("Enquiry submission error:", error);

    return json({
      success: false,
      error: "Unable to save enquiry."
    }, 500);
  }
}
