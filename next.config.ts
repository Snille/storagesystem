import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Lint runs separately via `npm run lint`; the live server builds without dev dependencies.
  eslint: { ignoreDuringBuilds: true }
};

export default nextConfig;
