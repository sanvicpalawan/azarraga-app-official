import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist resolves its worker + standard-fonts files from disk at runtime
  // (require.resolve / import.meta.url) — it must not be bundled, or those
  // paths resolve to bundler module IDs instead of real file paths.
  // @napi-rs/canvas is also server-side only.
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
};

export default nextConfig;