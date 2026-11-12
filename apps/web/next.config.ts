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
};

export default nextConfig;
