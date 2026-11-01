async function hash(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function onRequestGet({ request, env }) {
  try {
    if (!env.DB) {
      return new Response("Database unavailable", { status: 500 });
    }

    const cookie = request.headers.get("Cookie") || "";
    const match = cookie.match(/(?:^|;\s*)admin_session=([a-f0-9]{64})(?:;|$)/i);

    if (!match) {
      return new Response("Unauthorized", { status: 401 });
    }

    const tokenHash = await hash(match[1]);

    const session = await env.DB.prepare(`
      SELECT token_hash
      FROM admin_sessions
      WHERE token_hash = ?
      AND expires_at > ?
    `).bind(tokenHash, new Date().toISOString()).first();

    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const [total, active, returning, recent] = await Promise.all([
      env.DB.prepare(
        "SELECT COUNT(*) AS count FROM installations"
      ).first(),

      env.DB.prepare(
        "SELECT COUNT(*) AS count FROM installations WHERE last_seen >= datetime('now', '-30 days')"
      ).first(),

      env.DB.prepare(
        "SELECT COUNT(*) AS count FROM installations WHERE first_seen < last_seen"
      ).first(),

      env.DB.prepare(
        "SELECT COUNT(*) AS count FROM activity WHERE visited_at >= datetime('now', '-7 days')"
      ).first()
    ]);

    return Response.json({
      totalInstallations: total.count,
      activeLast30Days: active.count,
      returningInstallations: returning.count,
      visitsLast7Days: recent.count
    }, {
      headers: { "Cache-Control": "no-store" }
    });

  } catch {
    return new Response("Statistics unavailable", { status: 500 });
  }
}
