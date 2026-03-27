import type { NextConfig } from "next";

const imageHostnames = (process.env.NEXT_IMAGE_HOSTNAMES || "photos.yourdomain.com")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: imageHostnames.map((hostname) => ({
      protocol: "https",
      hostname
    }))
  }
};

export default nextConfig;
