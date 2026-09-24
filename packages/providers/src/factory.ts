import { ProviderRegistry, enabledProviders, type Env } from "@content-os/core";
import { LocalStorage } from "./local/storage-local.ts";
import { S3Storage } from "./local/storage-s3.ts";
import { LibraryMusicProvider, LibrarySfxProvider } from "./local/library-audio.ts";
import { MockAnalyticsProvider, MockImageProvider, MockModerationProvider, MockPublishProvider, MockSTTProvider, MockTTSProvider, MockVideoProvider } from "./mock/mock-media.ts";
import { OpenAILLMProvider } from "./openai/llm.ts";
import { OpenAIImageProvider } from "./openai/image.ts";
import { OpenAIModerationProvider, OpenAISTTProvider, OpenAITTSProvider } from "./openai/audio.ts";
import { YouTubeAnalyticsProvider, YouTubePublishProvider, type YouTubeAuth } from "./youtube/youtube.ts";
import { join } from "node:path";

/**
 * Baut die Provider-Registry gemäß Env. OpenAI-first: nur openai/local/mock sind standardmäßig freigegeben.
 * Video-Generierung: OpenAI bietet seit 2026-09-24 keine Video-API mehr -> BLOCKED_BY_PROVIDER.
 */
export function buildRegistry(env: Env, deps: { mockLLM?: import("@content-os/core").LLMProvider; resolveYouTubeAuth?: (channelId: string) => Promise<YouTubeAuth> } = {}): ProviderRegistry {
  const enabled = enabledProviders(env);
  const reg = new ProviderRegistry(enabled);
  const mock = env.PROVIDER_MODE === "mock";

  // Storage (deterministisch)
  if (env.STORAGE_DRIVER === "s3" && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY) {
    reg.register("storage", new S3Storage({ endpoint: env.S3_ENDPOINT, region: env.S3_REGION, bucket: env.S3_BUCKET, accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY, publicBaseUrl: env.S3_PUBLIC_BASE_URL }), { capabilities: ["storage"], status: "AVAILABLE" });
  }
  reg.register("storage", new LocalStorage(env.STORAGE_LOCAL_ROOT), { capabilities: ["storage"], status: "AVAILABLE" });

  // Musik/SFX: lokale lizenzierte Bibliothek (OpenAI bietet keine Musik-/SFX-API)
  reg.register("music", new LibraryMusicProvider(env.MUSIC_LIBRARY_DIR, join(env.STORAGE_LOCAL_ROOT, "_synth")), { capabilities: ["music"], status: "AVAILABLE", notes: "Lokale Bibliothek + synthetischer Fallback; generative Musik: BLOCKED_BY_PROVIDER (OpenAI)" });
  reg.register("sfx", new LibrarySfxProvider(env.SFX_LIBRARY_DIR), { capabilities: ["sfx"], status: "AVAILABLE", notes: "Nur lokale Bibliothek; generative SFX: BLOCKED_BY_PROVIDER (OpenAI)" });

  // Mocks (immer registriert; nur aktiv wenn "mock" freigegeben – Default ja)
  if (deps.mockLLM) reg.register("llm", deps.mockLLM, { capabilities: ["llm.cheap", "llm.standard", "llm.premium", "llm.factcheck", "llm.vision", "search.web"], status: "MOCK" });
  reg.register("image", new MockImageProvider(), { capabilities: ["image.generate", "image.edit"], status: "MOCK" });
  reg.register("video", new MockVideoProvider(), { capabilities: ["video.generate", "video.image_to_video"], status: "MOCK", notes: "Ersatz: Bild + Ken Burns. Echte KI-Video-Generierung bei OpenAI nicht verfügbar." });
  reg.register("tts", new MockTTSProvider(), { capabilities: ["tts"], status: "MOCK" });
  reg.register("stt", new MockSTTProvider(), { capabilities: ["stt.align"], status: "MOCK" });
  reg.register("moderation", new MockModerationProvider(), { capabilities: ["moderation"], status: "MOCK" });
  reg.register("publish", new MockPublishProvider(), { capabilities: ["publish.youtube"], status: "MOCK" });
  reg.register("analytics", new MockAnalyticsProvider(), { capabilities: ["analytics.youtube"], status: "MOCK" });

  // OpenAI (live)
  if (!mock && env.OPENAI_API_KEY) {
    reg.register("llm", new OpenAILLMProvider(env.OPENAI_API_KEY), { capabilities: ["llm.cheap", "llm.standard", "llm.premium", "llm.factcheck", "llm.vision", "search.web"], status: "AVAILABLE" });
    reg.register("image", new OpenAIImageProvider({ apiKey: env.OPENAI_API_KEY }), { capabilities: ["image.generate", "image.edit"], status: "AVAILABLE" });
    reg.register("tts", new OpenAITTSProvider({ apiKey: env.OPENAI_API_KEY }), { capabilities: ["tts"], status: "AVAILABLE" });
    reg.register("stt", new OpenAISTTProvider({ apiKey: env.OPENAI_API_KEY }), { capabilities: ["stt.align"], status: "AVAILABLE" });
    reg.register("moderation", new OpenAIModerationProvider(env.OPENAI_API_KEY), { capabilities: ["moderation"], status: "AVAILABLE" });
  }
  // OpenAI Video: explizit als blockiert dokumentiert
  reg.infos.push({ name: "openai-video", capabilities: ["video.generate", "video.image_to_video"], status: "BLOCKED_BY_PROVIDER", notes: "Sora-2 / Videos API am 2026-09-24 abgeschaltet, kein Nachfolger. Externe Alternativen (Veo, Kling, Runway …) nur nach Freigabe." });

  // YouTube (offizielle APIs)
  if (!mock && deps.resolveYouTubeAuth && env.YOUTUBE_CLIENT_ID && env.YOUTUBE_CLIENT_SECRET) {
    reg.register("publish", new YouTubePublishProvider(deps.resolveYouTubeAuth), { capabilities: ["publish.youtube"], status: "AVAILABLE" });
    reg.register("analytics", new YouTubeAnalyticsProvider(deps.resolveYouTubeAuth), { capabilities: ["analytics.youtube"], status: "AVAILABLE" });
  }
  return reg;
}
