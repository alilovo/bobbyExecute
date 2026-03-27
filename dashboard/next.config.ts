import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Keep Next rooted at the dashboard package instead of the repo root.
    root: process.cwd(),
  },
};

export default nextConfig;
