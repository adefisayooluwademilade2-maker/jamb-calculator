async function hash(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function onRequestGet({ request, env }) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)admin_session=([a-f0-9]{64})(?:;|$)/i);

  if (!match || !env.DB) {
    return Response.json({ authenticated: false }, { status: 401 });
  }

  const tokenHash = await hash(match[1]);

  const session = await env.DB.prepare(`
    SELECT token_hash FROM admin_sessions
    WHERE token_hash = ?
    AND expires_at > ?
  `).bind(tokenHash, new Date().toISOString()).first();

  return Response.json(
    { authenticated: !!session },
    { headers: { "Cache-Control": "no-store" } }
  );
}
