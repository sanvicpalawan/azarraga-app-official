import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @napi-rs/canvas is a native binary — must not be bundled if used server-side.
  // pdfjs-dist is intentionally NOT listed here: it needs to be bundled normally
  // so its worker file (statically imported in lib/invoice-parser.ts) gets
  // traced into the Vercel serverless function output.
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;