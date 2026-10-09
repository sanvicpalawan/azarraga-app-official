import { defineConfig } from "drizzle-kit";

/**
 * Migrations for the quote + invoice tables only. The legacy catalog
 * tables (categories, products, media, settings, ...) predate Drizzle and
 * are owned by lib/db.ts -- drizzle-kit must never drop or rewrite them.
 */
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  ...(process.env.DATABASE_URL
    ? { dbCredentials: { url: process.env.DATABASE_URL } }
    : {}),
  strict: true,
  verbose: true,
});
