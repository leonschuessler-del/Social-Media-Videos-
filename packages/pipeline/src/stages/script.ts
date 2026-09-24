import type { Script, Video } from "@content-os/core";
import { newId, textSimilarity, shortTextSimilarity, ORIGINALITY_THRESHOLDS } from "@content-os/core";
import type { PipelineContext } from "../context.ts";
import { callLLM } from "../llm.ts";
import { ScriptSchema } from "../schemas.ts";
import { scriptPrompt, SYSTEM_BASE, targetSeconds } from "../prompts.ts";

const WPM = 150;

export async function runScript(ctx: PipelineContext, video: Video, factCheckNotes: string[] = []): Promise<Script> {
  const [project, topic, research] = await Promise.all([ctx.store.projects.get(video.projectId), ctx.store.topics.get(video.topicId), video.researchId ? ctx.store.research.get(video.researchId) : undefined]);
  if (!project || !topic || !research) throw new Error("Projekt/Topic/Research fehlt");
  const usable = { ...research, claims: research.claims.filter((c) => c.verdict !== "CONTRADICTED" && c.verdict !== "UNSUPPORTED") };
  const res = await callLLM(ctx, "script.write", { system: SYSTEM_BASE, prompt: scriptPrompt(project, topic.title, topic.angle, video.format, usable, factCheckNotes), schema: ScriptSchema, maxOutputTokens: video.format === "SHORT" ? 3000 : 12000 }, { projectId: video.projectId, videoId: video.id, stage: "SCRIPT", format: video.format, topicTitle: topic.title, language: video.language });
  const sections = res.data.sections.map((s) => ({ id: newId("sec"), kind: s.kind, narration: s.narration.trim(), claimIds: s.claimIndexes.map((i) => usable.claims[i]?.id).filter((x): x is string => !!x), targetSeconds: s.targetSeconds, visualIntent: s.visualIntent }));
  const fullNarration = sections.map((s) => s.narration).join(" ");
  const wordCount = fullNarration.split(/\s+/).filter(Boolean).length;
  const estimatedSeconds = Math.round((wordCount / WPM) * 60);
  const t = targetSeconds(video.format);
  if (estimatedSeconds > t.max * 1.25 || estimatedSeconds < t.min * 0.6) {
    ctx.logger.warn({ estimatedSeconds, t }, "Skriptlänge außerhalb Zielbereich – wird in QA gemeldet");
  }
  // Originalität gegen bestehende Skripte des Projekts
  const others = (await ctx.store.scripts.listByProject(video.projectId)).filter((s) => s.topicId !== video.topicId);
  const maxScript = Math.max(0, ...others.map((o) => textSimilarity(o.fullNarration, fullNarration)));
  const hookNew = sections.find((s) => s.kind === "HOOK")?.narration ?? "";
  const maxHook = Math.max(0, ...others.map((o) => shortTextSimilarity(o.sections.find((s) => s.kind === "HOOK")?.narration ?? "", hookNew)));
  const prevVersion = Math.max(0, ...(await ctx.store.scripts.listByProject(video.projectId)).filter((s) => s.topicId === video.topicId).map((s) => s.version));
  const script = await ctx.store.scripts.create({ topicId: topic.id, format: video.format, language: video.language, title: res.data.title, hookType: res.data.hookType, sections, fullNarration, estimatedSeconds, wordCount, model: res.model, version: prevVersion + 1 });
  await ctx.store.videos.update(video.id, { scriptId: script.id });
  await ctx.store.audit.log({ actor: "system", action: "script.create", entityType: "script", entityId: script.id, details: { wordCount, estimatedSeconds, maxScriptSimilarity: maxScript, maxHookSimilarity: maxHook, originalityFlag: maxScript >= ORIGINALITY_THRESHOLDS.script || maxHook >= ORIGINALITY_THRESHOLDS.hook } });
  return script;
}
