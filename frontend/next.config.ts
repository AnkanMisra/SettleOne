import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "ankan-linux.tailf04855.ts.net",
    "127.0.0.1",
  ],
};

export default nextConfig;
