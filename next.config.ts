import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "https://*.trycloudflare.com",
    "samuel-broke-utc-talent.trycloudflare.com",
    "https://samuel-broke-utc-talent.trycloudflare.com",
  ],
};

export default nextConfig;