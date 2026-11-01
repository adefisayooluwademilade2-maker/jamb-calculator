export async function onRequestGet({ request, env }) {
  try {
    if (!env.DB) {
      return new Response("Database not connected", { status: 500 });
    }

    const origin = request.headers.get("Origin");
    const siteOrigin = new URL(request.url).origin;

    if (origin && origin !== siteOrigin) {
      return new Response("Forbidden", { status: 403 });
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
    });
  } catch (error) {
    return new Response("Could not load statistics", { status: 500 });
  }
      } 
