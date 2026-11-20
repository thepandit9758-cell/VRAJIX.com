async function verifySession(token, secret) {
  try {
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) return false;

    const payload = atob(encodedPayload);
    const [createdAt] = payload.split(".");

    if (Date.now() - Number(createdAt) > 8 * 60 * 60 * 1000) {
      return false;
    }

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const binarySignature = Uint8Array.from(
      atob(signature.replace(/-/g, "+").replace(/_/g, "/")),
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
  const cookie = request.headers.get("Cookie") || "";
  const token = cookie
    .split("; ")
    .find(item => item.startsWith("vrajix_admin_session="))
    ?.split("=")[1];

  const valid = token && env.ADMIN_SESSION_SECRET
    ? await verifySession(token, env.ADMIN_SESSION_SECRET)
    : false;

  return Response.json(
    { authenticated: Boolean(valid) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
