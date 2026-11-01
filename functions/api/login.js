function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function onRequestPost({ request, env }) {
  try {
    const origin = request.headers.get("Origin");
    if (origin !== new URL(request.url).origin) {
      return json({ error: "Forbidden" }, 403);
    }

    if (!env.ADMIN_KEY || !env.DB) {
      return json({ error: "Server configuration error" }, 500);
    }

    const body = await request.json();
    if (
      typeof body.password !== "string" ||
      body.password.length > 200
    ) {
      return json({ error: "Invalid login" }, 400);
    }

    const submittedHash = await sha256(body.password);
    const storedHash = await sha256(env.ADMIN_KEY);

    if (!safeEqual(submittedHash, storedHash)) {
      return json({ error: "Incorrect password" }, 401);
    }

    const token = Array.from(
      crypto.getRandomValues(new Uint8Array(32))
    ).map(b => b.toString(16).padStart(2, "0")).join("");

    const tokenHash = await sha256(token);
    const now = new Date();
    const expires = new Date(now.getTime() + 8 * 60 * 60 * 1000);

    await env.DB.prepare(`
      INSERT INTO admin_sessions (token_hash, expires_at, created_at)
      VALUES (?, ?, ?)
    `).bind(
      tokenHash,
      expires.toISOString(),
      now.toISOString()
    ).run();

    return json(
      { success: true },
      200,
      {
        "Set-Cookie":
          `admin_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`
      }
    );
  } catch {
    return json({ error: "Login failed" }, 500);
  }
}
