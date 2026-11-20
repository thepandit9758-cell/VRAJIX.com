export async function onRequestPost() {
  return Response.json(
    {
      success: true,
      message: "Logged out successfully."
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie":
          "vrajix_admin_session=; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=0"
      }
    }
  );
}
