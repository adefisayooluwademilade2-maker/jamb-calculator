export async function onRequestPost({ request, env }) {
  try {
    const cookie = request.headers.get("Cookie") || "";
    const match = cookie.match(/(?:^|;\s*)admin_session=([a-f0-9]{64})(?:;|$)/i);

    if (match && env.DB) {
      const data = new TextEncoder().encode(match[1]);
      const digest = await crypto.subtle.digest("SHA-256", data);

      const tokenHash = [...new Uint8Array(digest)]
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

      await env.DB.prepare(
        "DELETE FROM admin_sessions WHERE token_hash = ?"
      ).bind(tokenHash).run();
    }

    return Response.json(
      { success: true },
      {
        headers: {
          "Set-Cookie": "admin_session=; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=0",
          "Cache-Control": "no-store"
        }
      }
    );
  } catch {
    return new Response("Logout failed", { status: 500 });
  }
}
