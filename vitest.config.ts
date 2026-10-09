import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The DB round-trip test talks to Neon over HTTP; give it room.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
