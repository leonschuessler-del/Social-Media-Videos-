import type { Topic, Video } from "@content-os/core";
import { ContentOsError, selectTopics } from "@content-os/core";
import type { PipelineContext } from "./context.ts";
import { scoreTopicWithLLM } from "./stages/topic.ts";
import { createVideoForTopic } from "./runner.ts";

export interface PlanResult {
  scored: number;
  candidates: number;
  started: Video[];
  skipped: { topicId: string; reason: string }[];
  remainingToday: number;
}

/**
 * Limit-aware Produktionsplanung:
 *   Ideen → (günstiges) Text-Scoring → Filter (Score, Faktenrisiko, Originalität) → Priorität absteigend
 *   → nur so viele Videos starten, wie das Scale-Gate heute erlaubt. Rest bleibt SCORED (Queue).
 * Teure Generierung (Bilder/Voice/Render) beginnt erst für ausgewählte Themen.
 */
export async function planProduction(ctx: PipelineContext, projectId: string, opts: { maxScoring?: number; minScore?: number; now?: Date } = {}): Promise<PlanResult> {
  const project = await ctx.store.projects.get(projectId);
  if (!project) throw new ContentOsError("NOT_FOUND", `Projekt ${projectId}`);
  const now = opts.now ?? new Date();
  const alreadyStarted = await ctx.store.videos.countStartedToday(projectId, now);
  let remaining = Math.max(0, project.maxVideosPerDay - alreadyStarted);
  const result: PlanResult = { scored: 0, candidates: 0, started: [], skipped: [], remainingToday: remaining };
  if (!project.active || remaining === 0 || ctx.isKilled()) return result;

  // 1) Neue Ideen günstig bewerten (Budget/Kapazität greifen in callLLM)
  const fresh = (await ctx.store.topics.listByProject(projectId, "NEW")).filter((t) => t.originalityCheck?.passed !== false).slice(0, opts.maxScoring ?? 20);
  for (const t of fresh) {
    try { await scoreTopicWithLLM(ctx, t.id); result.scored++; } catch (e) { result.skipped.push({ topicId: t.id, reason: `Scoring: ${(e as Error).message}` }); }
  }

  // 2) Kandidaten filtern + priorisieren
  const scored = await ctx.store.topics.listByProject(projectId, "SCORED");
  const ranked = selectTopics(scored.map((t: Topic) => ({ ...t, originalityPassed: t.originalityCheck?.passed })), scored.length, { minScore: opts.minScore ?? 0.55 });
  result.candidates = ranked.length;
  for (const t of scored.filter((s) => !ranked.some((r) => r.id === s.id))) result.skipped.push({ topicId: t.id, reason: `unter Schwelle oder Risiko (score ${t.score?.toFixed(2) ?? "–"})` });

  // 3) Nur beste Themen im Rahmen des Tageslimits starten
  for (const t of ranked) {
    if (remaining <= 0) { result.skipped.push({ topicId: t.id, reason: "Tageslimit erreicht – bleibt in Queue" }); continue; }
    try {
      const v = await createVideoForTopic(ctx, t.id, { skipScoring: true });
      result.started.push(v);
      remaining--;
    } catch (e) { result.skipped.push({ topicId: t.id, reason: (e as Error).message }); }
  }
  result.remainingToday = remaining;
  await ctx.store.audit.log({ actor: "system:planner", action: "production.plan", entityType: "project", entityId: projectId, details: { scored: result.scored, candidates: result.candidates, started: result.started.map((v) => v.id), remaining } });
  return result;
}
