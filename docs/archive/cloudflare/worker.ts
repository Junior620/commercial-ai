/**
 * Minimal Cloudflare Worker template for edge-friendly endpoints.
 * Keep Prisma/scraping/AI-heavy endpoints on Node runtime.
 */

export interface Env {
  ORIGIN_API_BASE: string; // ex: https://your-next-app.vercel.app
  EDGE_API_TOKEN?: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health endpoint (edge)
    if (url.pathname === "/edge/health") {
      return json({
        ok: true,
        service: "agent-commercial-edge",
        now: new Date().toISOString(),
      });
    }

    // Example tiny proxy for a safe read endpoint
    if (url.pathname === "/edge/public-stats") {
      if (!env.ORIGIN_API_BASE) {
        return json({ error: "ORIGIN_API_BASE not configured" }, 500);
      }

      const target = `${env.ORIGIN_API_BASE.replace(/\/$/, "")}/api/sending/stats`;
      const upstream = await fetch(target, {
        method: "GET",
        headers: {
          accept: "application/json",
          // Optional shared secret pattern if you protect upstream:
          ...(env.EDGE_API_TOKEN
            ? { authorization: `Bearer ${env.EDGE_API_TOKEN}` }
            : {}),
        },
      });

      if (!upstream.ok) {
        return json({ error: "Upstream error", status: upstream.status }, 502);
      }

      // Short edge cache for read-only endpoint
      const body = await upstream.text();
      return new Response(body, {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=30",
        },
      });
    }

    return json({ error: "Not found" }, 404);
  },
};

