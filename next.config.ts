import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // apify-client require("proxy-agent") au runtime ; sans ces paquets, Vercel/Lambda
  // ne les inclut pas toujours dans le trace (pnpm) -> Cannot find module 'proxy-agent'.
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
