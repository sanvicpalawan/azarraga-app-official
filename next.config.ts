import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist resolves its worker + standard-fonts files from disk at runtime
  // (require.resolve / import.meta.url) — it must not be bundled, or those
  // paths resolve to bundler module IDs instead of real file paths.
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
