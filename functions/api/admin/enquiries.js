
function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

async function verifySession(token, secret) {
  try {
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) return false;

    const payload = atob(encodedPayload);
    const [createdAt] = payload.split(".");
    const age = Date.now() - Number(createdAt);

    if (!Number.isFinite(age) || age < 0 || age > 8 * 60 * 60 * 1000) {
      return false;
    }

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const padded = signature.replace(/-/g, "+").replace(/_/g, "/")
      + "=".repeat((4 - signature.length % 4) % 4);

    const binarySignature = Uint8Array.from(
      atob(padded),
      char => char.charCodeAt(0)
    );

    return await crypto.subtle.verify(
      "HMAC",
      key,
      binarySignature,
      new TextEncoder().encode(payload)
    );
  } catch {
    return false;
  }
}

export async function onRequestGet({ request, env }) {
  try {
    if (!env.DB || !env.ADMIN_SESSION_SECRET) {
      return json({ success: false, error: "Server configuration missing." }, 500);
    }

    const cookie = request.headers.get("Cookie") || "";
    const prefix = "vrajix_admin_session=";
    const item = cookie.split(";").find(value => value.trim().startsWith(prefix));
    const token = item ? item.trim().slice(prefix.length) : "";

    const authenticated = token
      ? await verifySession(token, env.ADMIN_SESSION_SECRET)
      : false;

    if (!authenticated) {
      return json({ success: false, error: "Admin login required." }, 401);
    }

    const result = await env.DB.prepare(`
      SELECT
        ref_id AS refId,
        name,
        email,
        phone,
        service,
        budget,
        timeline,
        details,
        status,
        timestamp
      FROM enquiries
      ORDER BY timestamp DESC
    `).all();

    return json({
      success: true,
      enquiries: result.results || []
    });

  } catch (error) {
    console.error("Admin enquiries error:", error);
    return json({ success: false, error: "Unable to load enquiries." }, 500);
  }
}
