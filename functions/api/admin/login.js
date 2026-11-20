function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

async function signSession(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );

  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) {
      return json({ success: false, error: "Admin configuration missing." }, 500);
    }

    if (!request.headers.get("content-type")?.includes("application/json")) {
      return json({ success: false, error: "JSON required." }, 415);
    }

    const origin = request.headers.get("Origin");

    if (origin && origin !== new URL(request.url).origin) {
      return json({ success: false, error: "Invalid origin." }, 403);
    }

    const body = await request.json();
    const password = typeof body.password === "string"
      ? body.password
      : "";

    if (!password || password.length > 256) {
      return json({ success: false, error: "Invalid password." }, 400);
    }

    if (password !== env.ADMIN_PASSWORD) {
      return json({ success: false, error: "Incorrect password." }, 401);
    }

    const payload = `${Date.now()}.${crypto.randomUUID()}`;
    const signature = await signSession(payload, env.ADMIN_SESSION_SECRET);

    const token = `${btoa(payload)}.${signature}`;

    return json(
      { success: true, message: "Admin login successful." },
      200,
      {
        "Set-Cookie":
          `vrajix_admin_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=28800`
      }
    );

  } catch (error) {
    console.error("Admin login error:", error);
    return json({ success: false, error: "Login unavailable." }, 500);
  }
}
