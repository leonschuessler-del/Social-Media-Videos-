import { z } from "zod";

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === "boolean" ? v : ["1", "true", "yes", "on"].includes(v.toLowerCase())));

const num = (def: number) => z.coerce.number().default(def);

export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z.string().default("postgres://contentos:contentos@localhost:5432/contentos"),
  KILL_SWITCH: bool.default(false),
  DEFAULT_REVIEW_MODE: z.enum(["SAFE", "SEMI_AUTO", "FULL_AUTO"]).default("SAFE"),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_ROOT: z.string().default("./data/storage"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().default("content-os"),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(),

  PROVIDER_MODE: z.enum(["mock", "live"]).default("mock"),
  /** Komma-Liste freigegebener Provider. Default: nur openai + lokale/deterministische Provider. */
  ENABLED_PROVIDERS: z.string().default("openai,local,mock"),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_ORG_ID: z.string().optional(),
  OPENAI_PROJECT_ID: z.string().optional(),
  OPENAI_ADMIN_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),
  FAL_KEY: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().optional(),

  MUSIC_LIBRARY_DIR: z.string().default("./assets/music"),
  SFX_LIBRARY_DIR: z.string().default("./assets/sfx"),

  YOUTUBE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),
  YOUTUBE_REDIRECT_URI: z.string().default("http://localhost:3000/oauth/youtube/callback"),
  SECRETS_ENCRYPTION_KEY: z.string().optional(),

  BUDGET_DAILY_EUR: num(20),
  BUDGET_MONTHLY_EUR: num(400),
  BUDGET_PER_VIDEO_SHORT_EUR: num(3),
  BUDGET_PER_VIDEO_LONGFORM_EUR: num(25),
  USD_EUR_RATE: num(0.92),

  FFMPEG_PATH: z.string().default("ffmpeg"),
  FFPROBE_PATH: z.string().default("ffprobe"),
  RENDER_THREADS: num(4),

  API_PORT: num(3000),
  API_TOKEN: z.string().default("change-me-local-only"),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached && source === process.env) return cached;
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Ungültige Umgebungsvariablen: ${parsed.error.message}`);
  }
  if (source === process.env) cached = parsed.data;
  return parsed.data;
}

export function enabledProviders(env: Env): Set<string> {
  return new Set(env.ENABLED_PROVIDERS.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
}
