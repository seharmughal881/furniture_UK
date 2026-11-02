import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The client preview (npm run preview) builds into its own folder so the dev server,
  // which uses .next, can be restarted or cleaned without breaking the preview.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
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
