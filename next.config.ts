import type { NextConfig } from "next";

function getDefaultImageHostnames() {
  const configured = process.env.NEXT_IMAGE_HOSTNAMES?.trim();
  if (configured) {
    return configured;
  }

  const immichBaseUrl = process.env.IMMICH_BASE_URL?.trim();
  if (immichBaseUrl) {
    try {
      return new URL(immichBaseUrl).hostname;
    } catch {
      // Fall back to the example hostname below.
    }
  }

  return "photos.yourdomain.com";
}

const imageHostnames = getDefaultImageHostnames()
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
