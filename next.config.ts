import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // apify-client require("proxy-agent") au runtime (dynamicNodeImport) ; sans ces
  // paquets, Vercel/Lambda ne les inclut pas toujours dans le trace (pnpm)
  // -> Cannot find module 'proxy-agent'.
  serverExternalPackages: [
    "apify-client",
    "papaparse",
    "proxy-agent",
    "http-proxy-agent",
    "https-proxy-agent",
    "socks-proxy-agent",
    "pac-proxy-agent",
  ],
  // Ceinture/bretelles : forcer l inclusion de ces modules dans la trace de nos
  // routes qui declenchent apify-client (scraping + export / envoi / inngest).
  outputFileTracingIncludes: {
    "/api/scraping/**/*": [
      "./node_modules/proxy-agent/**/*",
      "./node_modules/http-proxy-agent/**/*",
      "./node_modules/https-proxy-agent/**/*",
      "./node_modules/socks-proxy-agent/**/*",
      "./node_modules/pac-proxy-agent/**/*",
      "./node_modules/.pnpm/proxy-agent@**/**/*",
      "./node_modules/.pnpm/http-proxy-agent@**/**/*",
      "./node_modules/.pnpm/https-proxy-agent@**/**/*",
      "./node_modules/.pnpm/socks-proxy-agent@**/**/*",
      "./node_modules/.pnpm/pac-proxy-agent@**/**/*",
    ],
    "/api/inngest/**/*": [
      "./node_modules/proxy-agent/**/*",
      "./node_modules/http-proxy-agent/**/*",
      "./node_modules/https-proxy-agent/**/*",
      "./node_modules/socks-proxy-agent/**/*",
      "./node_modules/pac-proxy-agent/**/*",
      "./node_modules/.pnpm/proxy-agent@**/**/*",
      "./node_modules/.pnpm/http-proxy-agent@**/**/*",
      "./node_modules/.pnpm/https-proxy-agent@**/**/*",
      "./node_modules/.pnpm/socks-proxy-agent@**/**/*",
      "./node_modules/.pnpm/pac-proxy-agent@**/**/*",
    ],
  },
};

export default nextConfig;
