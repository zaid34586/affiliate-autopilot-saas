import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@aa/db"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
};

export default nextConfig;
