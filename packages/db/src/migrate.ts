import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createDb } from "./client.ts";

export async function runMigrations(url: string): Promise<void> {
  const { db, close } = createDb(url, { max: 1 });
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    await migrate(db, { migrationsFolder: join(here, "..", "drizzle") });
  } finally {
    await close();
  }
}

if (process.argv[1] && process.argv[1].endsWith("migrate.ts")) {
  const url = process.env.DATABASE_URL ?? "postgres://contentos:contentos@localhost:5432/contentos";
  runMigrations(url).then(() => { console.log("Migrations applied"); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}
