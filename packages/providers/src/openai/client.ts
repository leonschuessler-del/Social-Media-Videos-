import OpenAI from "openai";
import { CapacityExhaustedError, ContentOsError } from "@content-os/core";

let cached: OpenAI | undefined;
export function openaiClient(apiKey?: string): OpenAI {
  const key = apiKey ?? process.env.OPENAI_API_KEY;
  if (!key) throw new ContentOsError("PROVIDER_ERROR", "OPENAI_API_KEY fehlt – OpenAI-Provider nicht nutzbar (PROVIDER_MODE=mock verwenden).");
  if (!cached) cached = new OpenAI({ apiKey: key, organization: process.env.OPENAI_ORG_ID, project: process.env.OPENAI_PROJECT_ID, maxRetries: 2, timeout: 10 * 60_000 });
  return cached;
}

/** Übersetzt OpenAI-Fehler in Domänenfehler: 429/insufficient_quota => WAITING_FOR_CAPACITY. */
export function translateOpenAIError(err: unknown, context: string): never {
  if (err instanceof OpenAI.RateLimitError) {
    const hdr = err.headers as unknown as { get?(k: string): string | null } | undefined;
    const ra = Number(hdr?.get?.("retry-after") ?? 30);
    const quota = /insufficient_quota/i.test(err.message);
    throw new CapacityExhaustedError("openai", `${context}: ${quota ? "OpenAI-Kontingent erschöpft (insufficient_quota) – KEIN Fremdanbieter-Fallback ohne Freigabe" : "OpenAI Rate-Limit"}`, quota ? 3600 : Math.max(5, ra));
  }
  if (err instanceof OpenAI.APIError) {
    const retryable = (err.status ?? 500) >= 500 || err.status === 408 || err.status === 409;
    throw new ContentOsError("PROVIDER_ERROR", `${context}: OpenAI ${err.status} ${err.message}`, { retryable, cause: err, details: { status: err.status, code: err.code } });
  }
  throw new ContentOsError("PROVIDER_ERROR", `${context}: ${String(err)}`, { retryable: true, cause: err });
}
