export async function onRequestGet({ request, env }) {
  try {
    const auth = request.headers.get("Authorization");

    if (
      !env.ADMIN_KEY ||
      auth !== `Bearer ${env.ADMIN_KEY}`
    ) {
      return new Response("Unauthorized", {
        status: 401
      });
    }

    if (!env.DB) {
      return new Response("Database unavailable", {
        status: 500
      });
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
    return new Response("Statistics unavailable", {
      status: 500
    });
  }
}
