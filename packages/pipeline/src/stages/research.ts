import type { Claim, ResearchDoc, Source, Video } from "@content-os/core";
import { newId } from "@content-os/core";
import type { PipelineContext } from "../context.ts";
import { callLLM } from "../llm.ts";
import { FactCheckSchema, ResearchSchema } from "../schemas.ts";
import { factCheckPrompt, researchPrompt, SYSTEM_BASE } from "../prompts.ts";

export async function runResearch(ctx: PipelineContext, video: Video): Promise<ResearchDoc> {
  const topic = await ctx.store.topics.get(video.topicId);
  if (!topic) throw new Error("Topic fehlt");
  const res = await callLLM(ctx, "research.synthesize", { system: SYSTEM_BASE, prompt: researchPrompt(topic.title, topic.angle), schema: ResearchSchema, maxOutputTokens: 6000 }, { projectId: video.projectId, videoId: video.id, stage: "RESEARCH", format: video.format, topicTitle: topic.title, language: video.language });
  const sources: Source[] = res.data.sources.map((s) => ({ id: newId("src"), url: s.url, title: s.title, publisher: s.publisher, sourceType: s.sourceType, reliability: s.reliability }));
  // Zitate aus Websuche ergänzen, falls vorhanden
  for (const c of res.citations ?? []) if (!sources.some((s) => s.url === c.url)) sources.push({ ...c, id: newId("src") });
  const byUrl = new Map(sources.map((s) => [s.url, s.id] as const));
  const claims: Claim[] = res.data.claims.map((c) => ({ id: newId("clm"), text: c.text, sourceIds: c.sourceUrls.map((u) => byUrl.get(u)).filter((x): x is string => !!x), confidence: c.confidence, verified: false }));
  const doc = await ctx.store.research.create({ topicId: topic.id, summary: res.data.summary, keyFacts: res.data.keyFacts, claims, sources, openQuestions: res.data.openQuestions, riskFlags: res.data.riskFlags, model: res.model });
  await ctx.store.videos.update(video.id, { researchId: doc.id });
  return doc;
}

/** Unabhängiger Fact-Check (anderes Routing/Effort). Schreibt Urteile in die Claims. */
export async function runFactCheck(ctx: PipelineContext, video: Video): Promise<{ doc: ResearchDoc; mustFix: string[]; overallRisk: "low" | "medium" | "high" }> {
  if (!video.researchId) throw new Error("researchId fehlt");
  const doc = await ctx.store.research.get(video.researchId);
  if (!doc) throw new Error("Research fehlt");
  const topic = await ctx.store.topics.get(video.topicId);
  const res = await callLLM(ctx, "factcheck.verify", { system: SYSTEM_BASE, prompt: factCheckPrompt(doc), schema: FactCheckSchema, maxOutputTokens: 5000 }, { projectId: video.projectId, videoId: video.id, stage: "FACT_CHECK", format: video.format, language: video.language, topicTitle: topic?.title });
  const claims = doc.claims.map((c, i) => {
    const v = res.data.verdicts.find((x) => x.claimIndex === i);
    if (!v) return c;
    const corrected = v.correction && v.correction.trim() && v.verdict !== "SUPPORTED" ? v.correction.trim() : c.text;
    return { ...c, text: corrected, verdict: v.verdict, verified: v.verdict === "SUPPORTED" || v.verdict === "PARTIALLY_SUPPORTED", confidence: Math.min(c.confidence, v.confidence), notes: v.notes };
  });
  // Kontradizierte/unbelegte Claims werden aus der Skript-Faktenbasis entfernt (bleiben zur Nachvollziehbarkeit gespeichert)
  const updated = await ctx.store.research.create({ ...doc, id: undefined, claims, riskFlags: [...doc.riskFlags, ...(res.data.overallRisk === "high" ? ["FACTCHECK_HIGH_RISK"] : [])] });
  await ctx.store.videos.update(video.id, { researchId: updated.id });
  return { doc: updated, mustFix: res.data.mustFix, overallRisk: res.data.overallRisk };
}
