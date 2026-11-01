export async function onRequestPost({ request, env }) {
  try {
    // Only accept requests from this website.
    const origin = request.headers.get("Origin");
    const siteOrigin = new URL(request.url).origin;

    if (origin && origin !== siteOrigin) {
      return new Response("Forbidden", { status: 403 });
    }

    if (!env.DB) {
      return new Response("Database not connected", { status: 500 });
    }

    const data = await request.json();
    const installId = data.installId;

    // Accept only a valid anonymous installation ID.
    if (
      typeof installId !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(installId)
    ) {
      return new Response("Invalid installation ID", {
        status: 400
      });
    }

    const now = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO installations
        (install_id, first_seen, last_seen, platform)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(install_id) DO UPDATE SET
        last_seen = excluded.last_seen
    `).bind(
      installId,
      now,
      now,
      "android"
    ).run();

    await env.DB.prepare(`
      INSERT INTO activity (install_id, visited_at)
      VALUES (?, ?)
    `).bind(installId, now).run();

    return Response.json({ success: true });
  } catch (error) {
    return new Response("Tracking failed", { status: 500 });
  }
                         }
