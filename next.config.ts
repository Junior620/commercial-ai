import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

function supabaseOrigins(): string[] {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
    return [url.origin, `wss://${url.host}`];
  } catch {
    return [];
  }
}

/**
 * Politique de sécurité du contenu. Next.js injecte des scripts et styles en ligne
 * (hydratation), d'où 'unsafe-inline' ; tout le reste est limité à l'application elle-même.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigins().join(" ")}${isDev ? " ws: wss:" : ""}`.trim(),
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // apify-client require("proxy-agent") au runtime (dynamicNodeImport).
  // On s appuie sur l import statique "import 'proxy-agent'" dans
  // src/lib/apify.ts pour que @vercel/nft trace ces modules correctement.
  // NB : ne pas utiliser outputFileTracingIncludes avec des patterns .pnpm/**,
  // cela inclut des dossiers symlink que Vercel refuse
  // ("invalid deployment package... symlinked directories").
  serverExternalPackages: [
    "apify-client",
    "papaparse",
    "proxy-agent",
    "http-proxy-agent",
    "https-proxy-agent",
    "socks-proxy-agent",
    "pac-proxy-agent",
  ],
};

export default nextConfig;
