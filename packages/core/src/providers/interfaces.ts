/**
 * Einheitliche Provider-Schnittstellen. Jeder Adapter (OpenAI, Mock, später andere) implementiert genau diese.
 * Ein Provider-Wechsel verändert NIE die Pipeline – nur die Registry-Konfiguration.
 */
import type { Capability, Source } from "../domain.ts";

export interface ProviderInfo {
  /** z.B. "openai", "mock", "local", "anthropic" */
  name: string;
  capabilities: Capability[];
  /** Ehrliche Kennzeichnung: Ist diese Fähigkeit beim Provider offiziell automatisierbar? */
  status: "AVAILABLE" | "MOCK" | "BLOCKED_BY_PROVIDER" | "DISABLED";
  notes?: string;
}

export interface UsageReport {
  provider: string;
  model: string;
  units: number;
  unitType: "input_tokens" | "output_tokens" | "cached_input_tokens" | "images" | "video_seconds" | "characters" | "audio_seconds" | "requests" | "render_minutes";
  requestId?: string;
  costUsdOverride?: number;
}

export interface JsonSchemaLike { name: string; schema: Record<string, unknown>; strict?: boolean }

export interface LLMRequest {
  system?: string;
  prompt: string;
  /** Wenn gesetzt: Antwort MUSS diesem JSON-Schema entsprechen (Structured Output). */
  jsonSchema?: JsonSchemaLike;
  temperature?: number;
  maxOutputTokens?: number;
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  /** Bilder als data-URL oder https-URL für Vision-Aufgaben */
  images?: string[];
  /** Web-Suche als Tool erlauben (Provider-abhängig, z.B. OpenAI Responses web_search) */
  webSearch?: boolean;
  metadata?: Record<string, string>;
}

export interface LLMResponse<T = unknown> {
  text: string;
  json?: T;
  citations?: Source[];
  model: string;
  usage: UsageReport[];
  finishReason: "stop" | "length" | "refusal" | "error";
}

export interface LLMProvider {
  readonly name: string;
  complete<T = unknown>(model: string, req: LLMRequest): Promise<LLMResponse<T>>;
}

export interface SearchResult { url: string; title: string; snippet: string; publishedAt?: string; score?: number }
export interface SearchProvider {
  readonly name: string;
  search(query: string, opts?: { maxResults?: number; domains?: string[]; recencyDays?: number }): Promise<{ results: SearchResult[]; usage: UsageReport[] }>;
}

export interface ImageRequest {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  quality?: "low" | "medium" | "high";
  /** Referenzbilder (Buffer) für Edits / Konsistenz */
  referenceImages?: Buffer[];
  mask?: Buffer;
  seed?: number;
  style?: string;
}
export interface ImageResult { image: Buffer; mimeType: string; width: number; height: number; model: string; usage: UsageReport[]; revisedPrompt?: string }
export interface ImageProvider {
  readonly name: string;
  generate(req: ImageRequest): Promise<ImageResult>;
  edit?(req: ImageRequest & { referenceImages: Buffer[] }): Promise<ImageResult>;
}

export interface VideoRequest {
  prompt: string;
  durationSec: number;
  width: number;
  height: number;
  /** Bild als Startframe (Image-to-Video) */
  inputImage?: Buffer;
  seed?: number;
  withAudio?: boolean;
}
export interface VideoResult { video: Buffer; mimeType: "video/mp4"; durationSec: number; width: number; height: number; model: string; usage: UsageReport[]; jobId?: string }
export interface VideoProvider {
  readonly name: string;
  /** Asynchrone Generierung; Implementierungen pollen intern bis fertig oder werfen CapacityExhaustedError. */
  generate(req: VideoRequest, opts?: { pollIntervalMs?: number; timeoutMs?: number }): Promise<VideoResult>;
}

export interface TTSRequest {
  text: string;
  voiceId: string;
  language: string;
  speed?: number; // 0.5..2
  /** Stil-Anweisung (z.B. "ruhig, dokumentarisch") – Provider-abhängig */
  instructions?: string;
  format?: "mp3" | "wav" | "opus";
}
export interface WordTimestamp { word: string; startSec: number; endSec: number }
export interface TTSResult {
  audio: Buffer;
  mimeType: string;
  durationSec?: number;
  /** Nur wenn der Provider Zeitstempel liefert; sonst STT-Alignment nötig */
  words?: WordTimestamp[];
  model: string;
  usage: UsageReport[];
}
export interface TTSProvider {
  readonly name: string;
  synthesize(req: TTSRequest): Promise<TTSResult>;
  listVoices?(): Promise<{ id: string; name: string; languages: string[] }[]>;
}

export interface STTResult { text: string; words: WordTimestamp[]; durationSec: number; model: string; usage: UsageReport[] }
export interface STTProvider {
  readonly name: string;
  /** Wort-Zeitstempel für Untertitel (Forced Alignment über Transkription). */
  transcribe(audio: Buffer, opts: { language: string; mimeType: string; promptText?: string }): Promise<STTResult>;
}

export interface MusicTrack { id: string; path?: string; buffer?: Buffer; title: string; mood: string[]; bpm?: number; durationSec: number; license: string; attributionRequired: boolean; source: string }
export interface MusicProvider {
  readonly name: string;
  pick(opts: { mood: string; durationSec: number; exclude?: string[] }): Promise<{ track: MusicTrack | undefined; usage: UsageReport[] }>;
}

export interface SfxClip { id: string; path?: string; buffer?: Buffer; tags: string[]; durationSec: number; license: string; attributionRequired: boolean; source: string }
export interface SfxProvider {
  readonly name: string;
  find(opts: { description: string; maxDurationSec?: number }): Promise<{ clip: SfxClip | undefined; usage: UsageReport[] }>;
}

export interface ModerationResult { flagged: boolean; categories: Record<string, number>; usage: UsageReport[] }
export interface ModerationProvider {
  readonly name: string;
  moderate(input: { text?: string; imageDataUrl?: string }): Promise<ModerationResult>;
}

export interface StorageProvider {
  readonly name: string;
  put(key: string, data: Buffer, mimeType: string): Promise<{ key: string; url?: string; sizeBytes: number }>;
  get(key: string): Promise<Buffer>;
  /** Lokaler Dateipfad (für FFmpeg) – lädt bei Bedarf in ein Temp-Verzeichnis. */
  localPath(key: string): Promise<string>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}

export interface PublishRequest {
  channelId: string;
  filePath: string;
  title: string;
  description: string;
  tags: string[];
  privacy: "private" | "unlisted" | "public";
  publishAt?: string; // ISO; erfordert privacy=private
  categoryId?: string;
  defaultLanguage?: string;
  madeForKids: false;
  /** Kennzeichnung realistisch wirkender synthetischer Inhalte (YouTube: containsSyntheticMedia) */
  containsSyntheticMedia: boolean;
  thumbnailPath?: string;
  playlistId?: string;
  notifySubscribers?: boolean;
}
export interface PublishResult { externalVideoId: string; url: string; status: string; usage: UsageReport[]; warnings: string[] }
export interface PublishProvider {
  readonly name: string;
  readonly platform: "youtube" | "tiktok" | "instagram";
  upload(req: PublishRequest): Promise<PublishResult>;
  setThumbnail?(externalVideoId: string, thumbnailPath: string): Promise<void>;
  updateMetadata?(externalVideoId: string, patch: Partial<PublishRequest>): Promise<void>;
}

export interface AnalyticsQuery { channelId: string; externalVideoId?: string; startDate: string; endDate: string }
export interface AnalyticsProvider {
  readonly name: string;
  fetchVideoStats(q: AnalyticsQuery): Promise<{ rows: Record<string, unknown>[]; usage: UsageReport[] }>;
  fetchRetention?(q: AnalyticsQuery): Promise<{ curve: { pct: number; ratio: number }[]; usage: UsageReport[] }>;
}
