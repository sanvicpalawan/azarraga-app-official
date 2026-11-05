import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native canvas stays external; pdfjs is bundled so its worker is traced.
  serverExternalPackages: ["@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/documents/pdf": [
      "./public/fonts/*.ttf",
      "./public/azarraga-logo-mark.jpg",
      // PDFKit resolves these dynamically. Vercel's Node runtime uses the CJS
      // exports even when the build trace has only discovered the ESM fonts.
      "./node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/standard-fonts/**/*",
      "./node_modules/pdfkit/js/standard-fonts/**/*",
    ],
  },
};

export default nextConfig;
