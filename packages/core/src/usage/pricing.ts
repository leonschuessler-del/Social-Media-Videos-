import type { Capability, CostEntry } from "../domain.ts";

/**
 * Preistabelle (USD). Quelle: offizielle Preisseiten, Stand siehe docs/02-research-apis.md.
 * WICHTIG: Preise werden bei jedem Provider-Call mitgeloggt; Änderungen hier sind versioniert (git).
 * Einträge mit `unknown: true` werden in der Kostenrechnung als Schätzung markiert.
 */
export interface PriceRule {
  provider: string;
  model: string;
  unitType: CostEntry["unitType"];
  usdPerUnit: number; // z.B. pro Token, pro Bild, pro Sekunde
  note?: string;
  unknown?: boolean;
}

export const PRICE_TABLE: PriceRule[] = [
  // --- OpenAI Text (Stand 2026-09-24, developers.openai.com/api/docs/pricing; per 1M Tokens -> per Token) ---
  { provider: "openai", model: "gpt-6-luna", unitType: "input_tokens", usdPerUnit: 0.10 / 1e6 },
  { provider: "openai", model: "gpt-6-luna", unitType: "cached_input_tokens", usdPerUnit: 0.01 / 1e6 },
  { provider: "openai", model: "gpt-6-luna", unitType: "output_tokens", usdPerUnit: 0.50 / 1e6 },
  { provider: "openai", model: "gpt-6-sol", unitType: "input_tokens", usdPerUnit: 2.0 / 1e6 },
  { provider: "openai", model: "gpt-6-sol", unitType: "cached_input_tokens", usdPerUnit: 0.20 / 1e6 },
  { provider: "openai", model: "gpt-6-sol", unitType: "output_tokens", usdPerUnit: 10 / 1e6 },
  { provider: "openai", model: "gpt-6-astra", unitType: "input_tokens", usdPerUnit: 10 / 1e6, note: "Quellen nennen 5–10 $/1M; konservativ 10", unknown: true },
  { provider: "openai", model: "gpt-6-astra", unitType: "cached_input_tokens", usdPerUnit: 1.0 / 1e6, unknown: true },
  { provider: "openai", model: "gpt-6-astra", unitType: "output_tokens", usdPerUnit: 50 / 1e6, note: "Quellen nennen 25–50 $/1M; konservativ 50", unknown: true },
  { provider: "openai", model: "gpt-5.6-sol", unitType: "input_tokens", usdPerUnit: 4.0 / 1e6 },
  { provider: "openai", model: "gpt-5.6-sol", unitType: "output_tokens", usdPerUnit: 20 / 1e6 },
  // --- OpenAI Web Search Tool (per Call, zzgl. Content-Tokens zum Modellpreis) ---
  { provider: "openai", model: "web_search", unitType: "requests", usdPerUnit: 10 / 1000 },
  // --- OpenAI Images (token-basiert; Näherung pro Bild 1024², laut Preisseite/Rechner) ---
  { provider: "openai", model: "gpt-image-2.5-flare:low", unitType: "images", usdPerUnit: 0.004, unknown: true },
  { provider: "openai", model: "gpt-image-2.5-flare:medium", unitType: "images", usdPerUnit: 0.04, unknown: true },
  { provider: "openai", model: "gpt-image-2.5-flare:high", unitType: "images", usdPerUnit: 0.17, unknown: true },
  { provider: "openai", model: "gpt-image-2.5-sunburst:low", unitType: "images", usdPerUnit: 0.004, unknown: true },
  { provider: "openai", model: "gpt-image-2.5-sunburst:medium", unitType: "images", usdPerUnit: 0.04, unknown: true },
  { provider: "openai", model: "gpt-image-2.5-sunburst:high", unitType: "images", usdPerUnit: 0.17, unknown: true },
  { provider: "openai", model: "gpt-image-2:low", unitType: "images", usdPerUnit: 0.006 },
  { provider: "openai", model: "gpt-image-2:medium", unitType: "images", usdPerUnit: 0.053 },
  { provider: "openai", model: "gpt-image-2:high", unitType: "images", usdPerUnit: 0.211 },
  { provider: "openai", model: "gpt-image-1.5:low", unitType: "images", usdPerUnit: 0.009 },
  { provider: "openai", model: "gpt-image-1.5:medium", unitType: "images", usdPerUnit: 0.034 },
  // Token-basierte Abrechnung (exakt), falls der Provider usage liefert:
  { provider: "openai", model: "gpt-image-2.5-flare", unitType: "output_tokens", usdPerUnit: 30 / 1e6, note: "image output tokens" },
  { provider: "openai", model: "gpt-image-2.5-flare", unitType: "input_tokens", usdPerUnit: 5 / 1e6, note: "text input tokens" },
  { provider: "openai", model: "gpt-image-2.5-sunburst", unitType: "output_tokens", usdPerUnit: 30 / 1e6 },
  { provider: "openai", model: "gpt-image-2.5-sunburst", unitType: "input_tokens", usdPerUnit: 5 / 1e6 },
  { provider: "openai", model: "gpt-image-2", unitType: "output_tokens", usdPerUnit: 30 / 1e6 },
  { provider: "openai", model: "gpt-image-2", unitType: "input_tokens", usdPerUnit: 5 / 1e6 },
  // --- OpenAI Video: NICHT VERFÜGBAR (Sora-API am 2026-09-24 abgeschaltet, kein Nachfolger) ---
  // --- OpenAI Audio ---
  { provider: "openai", model: "gpt-4o-mini-tts", unitType: "characters", usdPerUnit: 0.6 / 1e6, note: "Text-Input-Tokens; Audio-Output ≈ $12/1M Audio-Tokens ≈ $0.015/min" },
  { provider: "openai", model: "gpt-4o-mini-tts", unitType: "audio_seconds", usdPerUnit: 0.015 / 60, note: "Audio-Output-Anteil" },
  { provider: "openai", model: "tts-1", unitType: "characters", usdPerUnit: 15 / 1e6 },
  { provider: "openai", model: "tts-1-hd", unitType: "characters", usdPerUnit: 30 / 1e6 },
  { provider: "openai", model: "whisper-1", unitType: "audio_seconds", usdPerUnit: 0.006 / 60 },
  { provider: "openai", model: "gpt-4o-transcribe", unitType: "audio_seconds", usdPerUnit: 0.006 / 60 },
  { provider: "openai", model: "omni-moderation-latest", unitType: "requests", usdPerUnit: 0 },
  // --- Anthropic (DISABLED by default; nur mit Freigabe) ---
  { provider: "anthropic", model: "claude-sonnet-5", unitType: "input_tokens", usdPerUnit: 2 / 1e6 },
  { provider: "anthropic", model: "claude-sonnet-5", unitType: "output_tokens", usdPerUnit: 10 / 1e6 },
  { provider: "anthropic", model: "claude-haiku-4-5", unitType: "input_tokens", usdPerUnit: 1 / 1e6 },
  { provider: "anthropic", model: "claude-haiku-4-5", unitType: "output_tokens", usdPerUnit: 5 / 1e6 },
  { provider: "anthropic", model: "claude-opus-5", unitType: "input_tokens", usdPerUnit: 5 / 1e6 },
  { provider: "anthropic", model: "claude-opus-5", unitType: "output_tokens", usdPerUnit: 25 / 1e6 },
  // --- Lokal / deterministisch ---
  { provider: "local", model: "ffmpeg", unitType: "render_minutes", usdPerUnit: 0 },
  { provider: "local", model: "library", unitType: "requests", usdPerUnit: 0 },
  { provider: "local", model: "*", unitType: "requests", usdPerUnit: 0 },
  { provider: "mock", model: "*", unitType: "requests", usdPerUnit: 0 },
  { provider: "mock", model: "*", unitType: "images", usdPerUnit: 0 },
  { provider: "mock", model: "*", unitType: "video_seconds", usdPerUnit: 0 },
  { provider: "mock", model: "*", unitType: "characters", usdPerUnit: 0 },
  { provider: "mock", model: "*", unitType: "audio_seconds", usdPerUnit: 0 },
  { provider: "mock", model: "*", unitType: "input_tokens", usdPerUnit: 0 },
  { provider: "mock", model: "*", unitType: "output_tokens", usdPerUnit: 0 },
];

export function findPrice(provider: string, model: string, unitType: CostEntry["unitType"]): PriceRule | undefined {
  return (
    PRICE_TABLE.find((p) => p.provider === provider && p.model === model && p.unitType === unitType) ??
    PRICE_TABLE.find((p) => p.provider === provider && p.model === "*" && p.unitType === unitType)
  );
}

export function estimateUsd(provider: string, model: string, unitType: CostEntry["unitType"], units: number): { usd: number; known: boolean } {
  const p = findPrice(provider, model, unitType);
  if (!p) return { usd: 0, known: false };
  return { usd: units * p.usdPerUnit, known: !p.unknown };
}

export function capabilityDefaultUnit(cap: Capability): CostEntry["unitType"] {
  switch (cap) {
    case "image.generate": case "image.edit": return "images";
    case "video.generate": case "video.image_to_video": return "video_seconds";
    case "tts": return "characters";
    case "stt.align": return "audio_seconds";
    case "search.web": case "search.deep": case "moderation": case "publish.youtube": case "analytics.youtube": case "storage": case "music": case "sfx": return "requests";
    default: return "output_tokens";
  }
}
