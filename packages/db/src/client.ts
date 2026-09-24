import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

export type Db = ReturnType<typeof createDb>["db"];

export function createDb(url: string, opts: { max?: number } = {}) {
  const sql = postgres(url, { max: opts.max ?? 10, onnotice: () => {} });
  const db = drizzle(sql, { schema });
  return { db, sql, close: () => sql.end({ timeout: 5 }) };
}
