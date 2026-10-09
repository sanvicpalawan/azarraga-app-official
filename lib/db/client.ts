import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type Db = NeonHttpDatabase<typeof schema>;
export type RawSql = NeonQueryFunction<false, false>;

let cachedDb: Db | null = null;
let cachedSql: RawSql | null = null;

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Provide your Neon Postgres connection string in the environment.",
    );
  }
  return url;
}

/**
 * Drizzle client for the quote + invoice system. Shares the same
 * DATABASE_URL (and the same Neon HTTP driver) as the legacy catalog
 * layer in lib/db.ts, so there is only one connection string to manage.
 */
export function getDrizzle(): Db {
  cachedDb ??= drizzle({ client: getRawSql(), schema });
  return cachedDb;
}

/**
 * The raw neon() client. Used where Drizzle cannot help: multi-statement
 * writes that must commit together (neon-http has no interactive
 * transactions) and any hand-written SQL.
 */
export function getRawSql(): RawSql {
  cachedSql ??= neon(connectionString());
  return cachedSql;
}
