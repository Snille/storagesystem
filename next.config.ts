import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The live server builds without dev dependencies (Vitest, ESLint), so the build
  // type-checks only app code and leaves lint and tests to `npm run lint` / `npm test`.
  eslint: { ignoreDuringBuilds: true },
  typescript: { tsconfigPath: "tsconfig.build.json" }
};

export default nextConfig;
