import type { Capability } from "../domain.ts";
import { ProviderDisabledError, BlockedByProviderError } from "../errors.ts";
import type {
  AnalyticsProvider, ImageProvider, LLMProvider, ModerationProvider, MusicProvider, PublishProvider,
  SearchProvider, SfxProvider, STTProvider, StorageProvider, TTSProvider, VideoProvider, ProviderInfo,
} from "./interfaces.ts";

export interface ProviderSet {
  llm: Record<string, LLMProvider>;
  search: Record<string, SearchProvider>;
  image: Record<string, ImageProvider>;
  video: Record<string, VideoProvider>;
  tts: Record<string, TTSProvider>;
  stt: Record<string, STTProvider>;
  music: Record<string, MusicProvider>;
  sfx: Record<string, SfxProvider>;
  moderation: Record<string, ModerationProvider>;
  storage: Record<string, StorageProvider>;
  publish: Record<string, PublishProvider>;
  analytics: Record<string, AnalyticsProvider>;
}

export type ProviderKind = keyof ProviderSet;

/**
 * Registry mit Freigabeliste (OpenAI-first Policy).
 * Nicht freigegebene Provider sind registriert, aber DISABLED: ein Aufruf wirft ProviderDisabledError.
 */
export class ProviderRegistry {
  readonly providers: ProviderSet = { llm: {}, search: {}, image: {}, video: {}, tts: {}, stt: {}, music: {}, sfx: {}, moderation: {}, storage: {}, publish: {}, analytics: {} };
  readonly infos: ProviderInfo[] = [];

  constructor(private readonly enabled: Set<string>) {}

  register<K extends ProviderKind>(kind: K, provider: ProviderSet[K][string], info?: Partial<ProviderInfo>): this {
    const name = (provider as { name: string }).name;
    (this.providers[kind] as Record<string, unknown>)[name] = provider;
    this.infos.push({ name, capabilities: info?.capabilities ?? [], status: info?.status ?? (this.enabled.has(name) ? "AVAILABLE" : "DISABLED"), notes: info?.notes });
    return this;
  }

  isEnabled(name: string): boolean {
    return this.enabled.has(name.toLowerCase());
  }

  get<K extends ProviderKind>(kind: K, name: string, capability: Capability): ProviderSet[K][string] {
    const p = (this.providers[kind] as Record<string, ProviderSet[K][string] | undefined>)[name];
    if (!p) throw new BlockedByProviderError(capability, `Kein Provider "${name}" für ${kind} registriert`);
    if (!this.isEnabled(name)) throw new ProviderDisabledError(capability, name);
    const info = this.infos.find((i) => i.name === name);
    if (info?.status === "BLOCKED_BY_PROVIDER") throw new BlockedByProviderError(capability, info.notes ?? "nicht offiziell automatisierbar");
    return p;
  }

  /** Erster freigegebener Provider einer Art in Präferenz-Reihenfolge. */
  pick<K extends ProviderKind>(kind: K, preference: string[], capability: Capability): ProviderSet[K][string] {
    for (const name of preference) {
      const p = (this.providers[kind] as Record<string, ProviderSet[K][string] | undefined>)[name];
      if (p && this.isEnabled(name)) {
        const info = this.infos.find((i) => i.name === name);
        if (info?.status !== "BLOCKED_BY_PROVIDER") return p;
      }
    }
    throw new BlockedByProviderError(capability, `Kein freigegebener Provider für ${kind} (Präferenz: ${preference.join(", ")}). Freigabe erforderlich.`);
  }
}
