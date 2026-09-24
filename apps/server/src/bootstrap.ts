import "dotenv/config";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { loadEnv, logger, type Env, type Store } from "@content-os/core";
import { createDb, createPgStore, runMigrations, secrets } from "@content-os/db";
import { buildRegistry, type YouTubeAuth } from "@content-os/providers";
import { createContext, MockLLMProvider, type PipelineContext } from "@content-os/pipeline";
import { eq } from "drizzle-orm";

export interface App { env: Env; ctx: PipelineContext; store: Store; close: () => Promise<void>; saveSecret: (ref: string, value: string) => Promise<void>; loadSecret: (ref: string) => Promise<string> }

function key(env: Env): Buffer {
  const k = env.SECRETS_ENCRYPTION_KEY ?? "";
  if (!k && env.NODE_ENV === "production") throw new Error("SECRETS_ENCRYPTION_KEY fehlt");
  return createHash("sha256").update(k || "dev-only-insecure-key").digest();
}

/** Baut DB, Store, Registry, Kontext. Secrets (YouTube-Refresh-Tokens) liegen AES-256-GCM-verschlüsselt in der DB. */
export async function bootstrap(opts: { migrate?: boolean } = {}): Promise<App> {
  const env = loadEnv();
  if (opts.migrate !== false) await runMigrations(env.DATABASE_URL);
  const { db, close } = createDb(env.DATABASE_URL);
  const store = createPgStore(db);
  const k = key(env);
  const saveSecret = async (ref: string, value: string) => {
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", k, iv);
    const ct = Buffer.concat([c.update(value, "utf8"), c.final()]);
    await db.insert(secrets).values({ ref, ciphertext: ct.toString("base64"), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64") }).onConflictDoUpdate({ target: secrets.ref, set: { ciphertext: ct.toString("base64"), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64") } });
  };
  const loadSecret = async (ref: string) => {
    const [row] = await db.select().from(secrets).where(eq(secrets.ref, ref));
    if (!row) throw new Error(`Secret ${ref} fehlt`);
    const d = createDecipheriv("aes-256-gcm", k, Buffer.from(row.iv, "base64"));
    d.setAuthTag(Buffer.from(row.tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(row.ciphertext, "base64")), d.final()]).toString("utf8");
  };
  const resolveYouTubeAuth = async (channelId: string): Promise<YouTubeAuth> => {
    const ch = await store.channels.get(channelId);
    if (!ch?.credentialsRef) throw new Error(`Kanal ${channelId} hat keine YouTube-Credentials (OAuth-Flow: /oauth/youtube/start?channelId=...)`);
    return { clientId: env.YOUTUBE_CLIENT_ID!, clientSecret: env.YOUTUBE_CLIENT_SECRET!, redirectUri: env.YOUTUBE_REDIRECT_URI, refreshToken: await loadSecret(ch.credentialsRef) };
  };
  const registry = buildRegistry(env, { mockLLM: new MockLLMProvider(), resolveYouTubeAuth });
  const ctx = createContext({ env, store, registry, logger });
  return { env, ctx, store, close, saveSecret, loadSecret };
}
