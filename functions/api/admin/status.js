
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

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB || !env.ADMIN_SESSION_SECRET) {
      return json({ success: false, error: "Server configuration missing." }, 500);
    }

    const origin = request.headers.get("Origin");
    if (origin && origin !== new URL(request.url).origin) {
      return json({ success: false, error: "Invalid origin." }, 403);
    }

    const cookie = request.headers.get("Cookie") || "";
    const item = cookie.split(";")
      .find(value => value.trim().startsWith("vrajix_admin_session="));

    const token = item
      ? item.trim().slice("vrajix_admin_session=".length)
      : "";

    if (!token || !(await verifySession(token, env.ADMIN_SESSION_SECRET))) {
      return json({ success: false, error: "Admin login required." }, 401);
    }

    if (!request.headers.get("content-type")?.includes("application/json")) {
      return json({ success: false, error: "JSON required." }, 415);
    }

    const body = await request.json();
    const refId = typeof body.refId === "string" ? body.refId.trim() : "";
    const status = typeof body.status === "string" ? body.status.trim() : "";

    const allowedStatuses = [
      "NEW",
      "CONTACTED",
      "IN_PROGRESS",
      "COMPLETED"
    ];

    if (!refId || !allowedStatuses.includes(status)) {
      return json({ success: false, error: "Invalid reference ID or status." }, 400);
    }

    const result = await env.DB.prepare(`
      UPDATE enquiries
      SET status = ?
      WHERE ref_id = ?
    `).bind(status, refId).run();

    if (!result.meta?.changes) {
      return json({ success: false, error: "Enquiry not found." }, 404);
    }

    return json({
      success: true,
      message: "Enquiry status updated."
    });

  } catch (error) {
    console.error("Admin status update error:", error);
    return json({ success: false, error: "Unable to update status." }, 500);
  }
}
