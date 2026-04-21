import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
