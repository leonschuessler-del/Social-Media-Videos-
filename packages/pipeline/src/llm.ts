import { z } from "zod";
import type { Capability, LLMRequest, LLMResponse, Stage, TaskKind, UsageReport, VideoFormat } from "@content-os/core";
import { CapacityExhaustedError, ContentOsError, estimateUsd } from "@content-os/core";
import type { PipelineContext } from "./context.ts";

export interface CallMeta { projectId?: string; videoId?: string; stage?: Stage; format?: VideoFormat; topicTitle?: string; language?: string }

/** Zod -> JSON-Schema im OpenAI-strict-Format (alle Felder required, additionalProperties=false). */
export function toStrictJsonSchema(name: string, schema: z.ZodType): { name: string; schema: Record<string, unknown>; strict: boolean } {
  const js = z.toJSONSchema(schema, { target: "draft-7", unrepresentable: "any" }) as Record<string, unknown>;
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n.type === "object" && n.properties && typeof n.properties === "object") {
      n.additionalProperties = false;
      n.required = Object.keys(n.properties as object);
      for (const v of Object.values(n.properties as Record<string, unknown>)) walk(v);
    }
    if (n.items) walk(n.items);
    for (const k of ["anyOf", "oneOf", "allOf"]) if (Array.isArray(n[k])) (n[k] as unknown[]).forEach(walk);
    if (n.$defs && typeof n.$defs === "object") for (const v of Object.values(n.$defs as Record<string, unknown>)) walk(v);
  };
  walk(js);
  delete js.$schema;
  return { name, schema: js, strict: true };
}

export async function recordUsage(ctx: PipelineContext, usage: UsageReport[], capability: Capability, meta: CallMeta, flags: { failed?: boolean; retry?: boolean } = {}): Promise<number> {
  let eur = 0;
  for (const u of usage) {
    const e = await ctx.usage.record({ provider: u.provider, model: u.model, capability, units: u.units, unitType: u.unitType, projectId: meta.projectId, videoId: meta.videoId, stage: meta.stage, requestId: u.requestId, costUsdOverride: u.costUsdOverride, ...flags });
    eur += e.costEur;
  }
  if (meta.videoId && eur > 0) {
    const v = await ctx.store.videos.get(meta.videoId);
    if (v) await ctx.store.videos.update(meta.videoId, { costEur: Number((v.costEur + eur).toFixed(6)) });
  }
  return eur;
}

/** Grobe Vorab-Schätzung für den Budget-Guard (Tokens ~ Zeichen/4). */
function estimateLlmCostEur(ctx: PipelineContext, provider: string, model: string, req: LLMRequest): number {
  const inTok = Math.ceil(((req.system?.length ?? 0) + req.prompt.length) / 4) + (req.images?.length ?? 0) * 1000;
  const outTok = req.maxOutputTokens ?? 4000;
  const usd = estimateUsd(provider, model, "input_tokens", inTok).usd + estimateUsd(provider, model, "output_tokens", outTok).usd + (req.webSearch ? estimateUsd(provider, "web_search", "requests", 2).usd : 0);
  return usd * ctx.env.USD_EUR_RATE;
}

/**
 * Zentraler LLM-Aufruf: Routing -> Budget-Check -> Kapazität -> Provider -> Usage-Ledger -> Schema-Validierung.
 * Bei ungültigem JSON: ein Retry mit Fehlerhinweis; danach Fehler (retryable).
 */
export async function callLLM<T>(ctx: PipelineContext, task: TaskKind, req: LLMRequest & { schema?: z.ZodType<T>; schemaName?: string }, meta: CallMeta): Promise<LLMResponse<T> & { data: T }> {
  if (ctx.isKilled()) throw new ContentOsError("KILL_SWITCH", "Kill Switch aktiv – keine Provider-Aufrufe");
  const route = ctx.router.resolve(task);
  const provider = ctx.registry.get("llm", route.provider, route.capability);
  const jsonSchema = req.schema ? toStrictJsonSchema(req.schemaName ?? task.replace(/\W/g, "_"), req.schema) : req.jsonSchema;
  const fullReq: LLMRequest = { ...req, jsonSchema, reasoningEffort: req.reasoningEffort ?? route.reasoningEffort, webSearch: req.webSearch ?? route.webSearch, metadata: { task, ...(meta.topicTitle ? { topicTitle: meta.topicTitle } : {}), ...(meta.format ? { format: meta.format } : {}), ...(meta.language ? { language: meta.language } : {}), ...(req.metadata ?? {}) } };

  await ctx.budget.assertCanSpend({ estimatedCostEur: estimateLlmCostEur(ctx, route.provider, route.model, fullReq), videoId: meta.videoId, projectId: meta.projectId, format: meta.format, provider: route.provider });
  const capKey = `${route.provider}:llm`;
  const cap = await ctx.capacity.check(capKey);
  if (!cap.allowed) throw new CapacityExhaustedError(route.provider, cap.reason ?? "Kapazität", cap.retryAfterSeconds);

  let attempt = 0;
  let lastErr: unknown;
  while (attempt < 2) {
    attempt++;
    const r = attempt === 1 ? fullReq : { ...fullReq, prompt: `${fullReq.prompt}\n\nHINWEIS: Die vorherige Antwort war kein gültiges JSON gemäß Schema. Antworte ausschließlich mit gültigem JSON.` };
    let res: LLMResponse<T>;
    try {
      await ctx.capacity.consume(capKey);
      res = await provider.complete<T>(route.model, r);
    } catch (err) {
      if (err instanceof CapacityExhaustedError) await ctx.capacity.reportLimit(capKey, err.retryAfterSeconds ?? 60);
      await recordUsage(ctx, [{ provider: route.provider, model: route.model, units: 1, unitType: "requests" }], route.capability, meta, { failed: true, retry: attempt > 1 });
      throw err;
    }
    await recordUsage(ctx, res.usage, route.capability, meta, { retry: attempt > 1 });
    if (res.finishReason === "refusal") throw new ContentOsError("PROVIDER_ERROR", `LLM-Refusal bei ${task}`);
    if (!req.schema) return { ...res, data: (res.json ?? res.text) as T };
    const parsed = req.schema.safeParse(res.json ?? safeJson(res.text));
    if (parsed.success) return { ...res, data: parsed.data };
    lastErr = parsed.error;
    ctx.logger.warn({ task, attempt, issues: parsed.error.issues.slice(0, 5) }, "LLM-Antwort verletzt Schema");
  }
  throw new ContentOsError("PROVIDER_ERROR", `LLM-Antwort für ${task} verletzt Schema: ${String(lastErr)}`, { retryable: true });
}

function safeJson(t: string): unknown {
  try { return JSON.parse(t); } catch { const m = t.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch { /* */ } } return undefined; }
}
