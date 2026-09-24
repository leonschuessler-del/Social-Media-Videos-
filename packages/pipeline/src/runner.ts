import type { Stage, Video } from "@content-os/core";
import { BudgetExceededError, CapacityExhaustedError, ContentOsError, MAX_STAGE_ATTEMPTS, assertTransition, isRetryable, nextStage, routeAfterQa } from "@content-os/core";
import type { PipelineContext } from "./context.ts";
import { runResearch, runFactCheck } from "./stages/research.ts";
import { runScript } from "./stages/script.ts";
import { runStoryboard } from "./stages/storyboard.ts";
import { runAssets } from "./stages/assets.ts";
import { runVoice } from "./stages/voice.ts";
import { runEdit } from "./stages/edit.ts";
import { runQa } from "./stages/qa.ts";
import { runMetadataAndThumbnail } from "./stages/metadata.ts";
import { runPublish } from "./stages/publish.ts";
import { runAnalytics } from "./stages/analytics.ts";
import { scoreTopicWithLLM } from "./stages/topic.ts";

export interface StageOutcome { video: Video; from: Stage; to: Stage; status: Video["status"]; note?: string }

/** Legt ein Video für ein Thema an (Stage SELECTED, bereit für Produktion). Scale-Gate: maxVideosPerDay. */
export async function createVideoForTopic(ctx: PipelineContext, topicId: string, opts: { channelId?: string; skipScoring?: boolean } = {}): Promise<Video> {
  const topic = await ctx.store.topics.get(topicId);
  if (!topic) throw new ContentOsError("NOT_FOUND", `Topic ${topicId}`);
  const project = await ctx.store.projects.get(topic.projectId);
  if (!project) throw new ContentOsError("NOT_FOUND", "Projekt");
  if (!project.active) throw new ContentOsError("VALIDATION", "Projekt inaktiv");
  if (topic.originalityCheck && !topic.originalityCheck.passed) throw new ContentOsError("VALIDATION", `Originalität: ${topic.originalityCheck.notes.join(", ")}`);
  const started = await ctx.store.videos.countStartedToday(project.id, new Date());
  if (started >= project.maxVideosPerDay) throw new ContentOsError("CAPACITY_EXHAUSTED", `Scale-Gate: ${started}/${project.maxVideosPerDay} Videos heute bereits gestartet`, { retryable: true });
  if (!opts.skipScoring && topic.status === "NEW") await scoreTopicWithLLM(ctx, topicId);
  const video = await ctx.store.videos.create({ projectId: project.id, channelId: opts.channelId, topicId, format: topic.format, language: topic.language, stage: "SELECTED", status: "QUEUED", stageAttempt: 0, costEur: 0, experiment: { topicId, hookType: "QUESTION", titleVariant: "", scriptStyle: project.styleGuide.narrationTone, visualStyle: project.styleGuide.visualStyle, voiceId: project.styleGuide.voiceId, durationSec: 0, language: topic.language, generationModels: {}, generationCostEur: 0 } });
  await ctx.store.topics.update(topicId, { status: "SELECTED" });
  await ctx.store.audit.log({ actor: "system", action: "video.create", entityType: "video", entityId: video.id, details: { topicId, format: topic.format } });
  return video;
}

/**
 * Führt genau EINE Stufe aus und setzt Stage/Status. Idempotent: bei Wiederholung derselben Stufe werden
 * bereits erzeugte Artefakte (Assets) übersprungen. Fehlerklassen:
 *  - CapacityExhaustedError -> WAITING_FOR_CAPACITY (+ resumeAfter), KEIN Providerwechsel
 *  - BudgetExceededError    -> PAUSED (menschliche Entscheidung)
 *  - retryable              -> FAILED (Orchestrator versucht erneut bis MAX_STAGE_ATTEMPTS, dann DEAD_LETTER)
 */
export async function runStage(ctx: PipelineContext, videoId: string): Promise<StageOutcome> {
  let video = await ctx.store.videos.get(videoId);
  if (!video) throw new ContentOsError("NOT_FOUND", `Video ${videoId}`);
  if (ctx.isKilled()) throw new ContentOsError("KILL_SWITCH", "Kill Switch aktiv");
  const project = await ctx.store.projects.get(video.projectId);
  if (!project) throw new ContentOsError("NOT_FOUND", "Projekt");
  const from = video.stage;
  if (video.status === "PAUSED" || video.status === "REJECTED" || video.status === "DEAD_LETTER") return { video, from, to: from, status: video.status, note: "nicht ausführbar" };
  if (video.status === "WAITING_FOR_CAPACITY" && video.resumeAfter && new Date(video.resumeAfter) > new Date()) return { video, from, to: from, status: video.status, note: `wartet bis ${video.resumeAfter}` };

  const attempt = video.stageAttempt + 1;
  video = await ctx.store.videos.update(videoId, { status: "RUNNING", stageAttempt: attempt, statusReason: undefined, resumeAfter: undefined });
  const t0 = Date.now();
  try {
    let to: Stage;
    let status: Video["status"] = "QUEUED";
    let note: string | undefined;
    switch (from) {
      case "SELECTED": to = "RESEARCH"; break;
      case "RESEARCH": await runResearch(ctx, video); to = "FACT_CHECK"; break;
      case "FACT_CHECK": { const r = await runFactCheck(ctx, video); note = `risk=${r.overallRisk}; mustFix=${r.mustFix.length}`; await ctx.store.videos.update(videoId, { statusReason: r.mustFix.join(" | ") || undefined }); to = "SCRIPT"; break; }
      case "SCRIPT": { const v = (await ctx.store.videos.get(videoId))!; await runScript(ctx, v, v.statusReason ? v.statusReason.split(" | ") : []); to = "STORYBOARD"; break; }
      case "STORYBOARD": await runStoryboard(ctx, video); to = "ASSETS"; break;
      case "ASSETS": await runAssets(ctx, video); to = "VOICE"; break;
      case "VOICE": await runVoice(ctx, video); to = "EDIT"; break;
      case "EDIT": {
        const r = await runEdit(ctx, video);
        await runMetadataAndThumbnail(ctx, (await ctx.store.videos.get(videoId))!, r.sceneTimings);
        const v = (await ctx.store.videos.get(videoId))!;
        await ctx.store.videos.update(videoId, { experiment: v.experiment ? { ...v.experiment, durationSec: r.durationSec, generationCostEur: v.costEur } : undefined });
        to = "QA"; break;
      }
      case "QA": {
        const report = await runQa(ctx, video);
        const r = routeAfterQa({ reviewMode: project.reviewMode, decision: report.decision, qualityScore: report.score.total, autoApproveThreshold: project.autoApproveThreshold, minPublishScore: project.minPublishScore, regenerateTarget: report.checks.some((c) => !c.passed && c.check === "FACT") ? "SCRIPT" : "ASSETS" });
        to = r.stage; status = r.status; note = r.reason;
        break;
      }
      case "READY": { const v = await runPublish(ctx, video); to = v.stage; status = "DONE"; break; }
      case "SCHEDULED": { to = "PUBLISHED"; status = "DONE"; break; } // Statuswechsel erfolgt real durch YouTube (publishAt); Analytics-Job prüft
      case "PUBLISHED": { await runAnalytics(ctx, video); to = "ANALYTICS"; status = "DONE"; break; }
      case "ANALYTICS": { await runAnalytics(ctx, video); to = "ANALYTICS"; status = "DONE"; break; }
      case "REVIEW": return { video, from, to: from, status: "QUEUED", note: "wartet auf menschliche Freigabe" };
      default: throw new ContentOsError("INVALID_TRANSITION", `Stufe ${from} ist nicht automatisch ausführbar`);
    }
    if (to !== from) assertTransition(from, to);
    const updated = await ctx.store.videos.update(videoId, { stage: to, status: to === from ? status : status === "REJECTED" ? "REJECTED" : status, stageAttempt: to === from ? attempt : 0, statusReason: note });
    await ctx.store.audit.log({ actor: "system:worker", action: "video.transition", entityType: "video", entityId: videoId, details: { from, to, status: updated.status, ms: Date.now() - t0, note } });
    return { video: updated, from, to, status: updated.status, note };
  } catch (err) {
    const e = err as Error;
    if (err instanceof CapacityExhaustedError) {
      const resumeAfter = new Date(Date.now() + (err.retryAfterSeconds ?? 300) * 1000).toISOString();
      const v = await ctx.store.videos.update(videoId, { status: "WAITING_FOR_CAPACITY", statusReason: e.message, resumeAfter });
      await ctx.store.audit.log({ actor: "system:worker", action: "video.wait_capacity", entityType: "video", entityId: videoId, details: { stage: from, resumeAfter, message: e.message } });
      return { video: v, from, to: from, status: "WAITING_FOR_CAPACITY", note: e.message };
    }
    if (err instanceof BudgetExceededError) {
      const v = await ctx.store.videos.update(videoId, { status: "PAUSED", statusReason: e.message });
      await ctx.store.audit.log({ actor: "system:worker", action: "video.paused_budget", entityType: "video", entityId: videoId, details: { stage: from, message: e.message } });
      return { video: v, from, to: from, status: "PAUSED", note: e.message };
    }
    const max = MAX_STAGE_ATTEMPTS[from] ?? 3;
    const dead = attempt >= max || (!isRetryable(err) && !(err instanceof ContentOsError && err.kind === "RENDER_FAILED"));
    const status: Video["status"] = dead ? "DEAD_LETTER" : "FAILED";
    const v = await ctx.store.videos.update(videoId, { status, statusReason: `${e.name}: ${e.message}`.slice(0, 2000) });
    await ctx.store.audit.log({ actor: "system:worker", action: dead ? "video.dead_letter" : "video.failed", entityType: "video", entityId: videoId, details: { stage: from, attempt, error: e.message.slice(0, 500) } });
    ctx.logger.error({ videoId, stage: from, attempt, err: e.message }, "Stufe fehlgeschlagen");
    return { video: v, from, to: from, status, note: e.message };
  }
}

/** Führt Stufen sequenziell bis `until` (exklusive) oder bis ein nicht-fortsetzbarer Status erreicht ist. */
export async function runUntil(ctx: PipelineContext, videoId: string, until: Stage = "REVIEW", maxSteps = 40): Promise<Video> {
  let video = (await ctx.store.videos.get(videoId))!;
  for (let i = 0; i < maxSteps; i++) {
    if (video.stage === until || ["PAUSED", "REJECTED", "DEAD_LETTER", "WAITING_FOR_CAPACITY"].includes(video.status)) break;
    if (video.stage === "REVIEW" || video.stage === "ARCHIVED") break;
    const out = await runStage(ctx, videoId);
    video = out.video;
    if (out.status === "FAILED") continue; // retry (bis DEAD_LETTER)
  }
  return video;
}

/** Menschliche Review-Entscheidung (SAFE/SEMI_AUTO). */
export async function reviewDecision(ctx: PipelineContext, videoId: string, input: { reviewer: string; decision: "APPROVE" | "REJECT" | "REGENERATE" | "FIX"; targetStage?: Stage; notes?: string }): Promise<Video> {
  const video = await ctx.store.videos.get(videoId);
  if (!video) throw new ContentOsError("NOT_FOUND", videoId);
  if (video.stage !== "REVIEW" && !(video.stage === "QA" && video.status === "REJECTED")) throw new ContentOsError("INVALID_TRANSITION", `Review nur in Stage REVIEW (aktuell ${video.stage})`);
  await ctx.store.reviews.create({ videoId, reviewer: input.reviewer, decision: input.decision, targetStage: input.targetStage, notes: input.notes });
  let patch: Partial<Video>;
  if (input.decision === "APPROVE") patch = { stage: "READY", status: "QUEUED", statusReason: `Freigabe durch ${input.reviewer}` };
  else if (input.decision === "REJECT") patch = { status: "REJECTED", statusReason: input.notes ?? "abgelehnt" };
  else { const target = input.targetStage ?? (input.decision === "FIX" ? "EDIT" : "ASSETS"); assertTransition("REVIEW", target); patch = { stage: target, status: "QUEUED", stageAttempt: 0, statusReason: input.notes }; }
  await ctx.store.audit.log({ actor: `user:${input.reviewer}`, action: `video.review.${input.decision.toLowerCase()}`, entityType: "video", entityId: videoId, details: { ...input } });
  return ctx.store.videos.update(videoId, patch);
}

export { nextStage };
