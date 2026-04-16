import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["apify-client", "papaparse"],
};

export default nextConfig;
