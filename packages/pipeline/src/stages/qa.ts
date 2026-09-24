import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { QACheckResult, QAReport, Video } from "@content-os/core";
import { computeQualityScore, decideFromChecks, ORIGINALITY_THRESHOLDS, sequenceSimilarity, shortTextSimilarity, textSimilarity } from "@content-os/core";
import { analyzeMedia, extractFrames } from "@content-os/render";
import type { PipelineContext } from "../context.ts";
import { callLLM, recordUsage } from "../llm.ts";
import { ScriptQaSchema, VisualQaSchema } from "../schemas.ts";
import { scriptQaPrompt, SYSTEM_BASE, targetSeconds, visualQaPrompt } from "../prompts.ts";
import { dims } from "./assets.ts";

/**
 * QA-Stufe: FACT, VISUAL, AUDIO, RIGHTS, POLICY, DUPLICATION, REPETITION, TECHNICAL.
 * Jeder Check trägt sein Automatisierungs-Label. Ergebnis: QAReport + Score + Entscheidung.
 */
export async function runQa(ctx: PipelineContext, video: Video): Promise<QAReport> {
  const [project, script, sb, research] = await Promise.all([
    ctx.store.projects.get(video.projectId), video.scriptId ? ctx.store.scripts.get(video.scriptId) : undefined,
    video.storyboardId ? ctx.store.storyboards.get(video.storyboardId) : undefined, video.researchId ? ctx.store.research.get(video.researchId) : undefined,
  ]);
  if (!project || !script || !sb || !research) throw new Error("Projekt/Skript/Storyboard/Research fehlt");
  const storage = ctx.registry.pick("storage", ["s3", "local"], "storage");
  const assets = await ctx.store.assets.listByVideo(video.id);
  const render = assets.find((a) => a.id === video.renderAssetId) ?? assets.find((a) => a.kind === "render");
  if (!render) throw new Error("Render fehlt");
  const renderPath = await storage.localPath(render.storageKey);
  const checks: QACheckResult[] = [];
  const meta = { projectId: video.projectId, videoId: video.id, stage: "QA" as const, format: video.format, language: video.language };

  // TECHNICAL + AUDIO (deterministisch)
  const { width, height } = dims(video.format);
  const t = targetSeconds(video.format);
  const media = await analyzeMedia(renderPath, { width, height, minDurationSec: t.min * 0.7, maxDurationSec: video.format === "SHORT" ? 60 : t.max * 1.3 });
  const techIssues = media.issues.filter((i) => /Auflösung|Schwarze|Zu kurz|Zu lang|Keine Audiospur/.test(i));
  const audioIssues = media.issues.filter((i) => /Stille|Lautheit|Clipping/.test(i));
  checks.push({ check: "TECHNICAL", passed: techIssues.length === 0, severity: techIssues.length ? "error" : "info", score: techIssues.length ? 0.4 : 1, details: techIssues.join("; ") || `OK ${media.width}x${media.height} ${media.durationSec.toFixed(1)}s`, automation: "AUTOMATED", evidence: { durationSec: media.durationSec, black: media.blackSegments } });
  checks.push({ check: "AUDIO", passed: audioIssues.length === 0, severity: audioIssues.length ? "warn" : "info", score: audioIssues.length ? 0.6 : 1, details: audioIssues.join("; ") || `OK ${media.integratedLufs ?? "?"} LUFS, TP ${media.truePeakDb ?? "?"} dB`, automation: "AUTOMATED", evidence: { lufs: media.integratedLufs, tp: media.truePeakDb } });
  if (video.format === "SHORT" && media.durationSec > 60) checks.push({ check: "TECHNICAL", passed: false, severity: "error", details: "Short > 60s", automation: "AUTOMATED" });

  // RIGHTS (deterministisch)
  const badRights = assets.filter((a) => !["generated", "licensed_library", "own", "public_domain"].includes(a.rights?.source));
  const attribution = assets.filter((a) => a.rights?.attributionRequired);
  checks.push({ check: "RIGHTS", passed: badRights.length === 0, severity: badRights.length ? "critical" : "info", score: badRights.length ? 0 : 1, details: badRights.length ? `Assets ohne Rechte-Nachweis: ${badRights.map((a) => a.id).join(",")}` : `OK (${assets.length} Assets${attribution.length ? `, ${attribution.length} mit Attribution` : ""})`, automation: "AUTOMATED" });

  // POLICY (Moderation + Skript-Prüfung)
  let policyConcerns: string[] = [];
  try {
    const mod = ctx.registry.pick("moderation", ["openai", "mock"], "moderation");
    const m = await mod.moderate({ text: `${script.title}\n${script.fullNarration}` });
    await recordUsage(ctx, m.usage, "moderation", meta);
    if (m.flagged) policyConcerns.push(`Moderation flagged: ${Object.entries(m.categories).filter(([, v]) => v > 0.5).map(([k]) => k).join(",")}`);
  } catch (e) { checks.push({ check: "POLICY", passed: true, severity: "warn", details: `Moderation nicht verfügbar: ${String(e)}`, automation: "BLOCKED" }); }

  // FACT + Hook/Retention-Einschätzung (LLM)
  const sq = await callLLM(ctx, "qa.script", { system: SYSTEM_BASE, prompt: scriptQaPrompt(script, research), schema: ScriptQaSchema, maxOutputTokens: 3000 }, meta);
  policyConcerns = [...policyConcerns, ...sq.data.policyConcerns];
  const factCritical = sq.data.factIssues.filter((i) => i.severity === "critical");
  const factErrors = sq.data.factIssues.filter((i) => i.severity === "error");
  const unsupported = research.claims.filter((c) => c.verdict === "CONTRADICTED" && script.sections.some((s) => s.claimIds.includes(c.id)));
  checks.push({ check: "FACT", passed: factCritical.length === 0 && factErrors.length === 0 && unsupported.length === 0, severity: factCritical.length || unsupported.length ? "critical" : factErrors.length ? "error" : sq.data.factIssues.length ? "warn" : "info", score: Math.max(0, 1 - 0.35 * factCritical.length - 0.2 * factErrors.length - 0.05 * (sq.data.factIssues.length - factCritical.length - factErrors.length)), details: [...unsupported.map((c) => `Widerlegter Claim im Skript: ${c.text}`), ...sq.data.factIssues.map((i) => `[${i.severity}] ${i.problem} („${i.excerpt.slice(0, 80)}“)`)].join("; ") || "OK", automation: "AUTOMATED" });
  checks.push({ check: "POLICY", passed: policyConcerns.length === 0, severity: policyConcerns.length ? "critical" : "info", score: policyConcerns.length ? 0 : 1, details: policyConcerns.join("; ") || "OK", automation: "AUTOMATED" });

  // VISUAL (Vision-LLM auf Frames + Struktur-Checks)
  const frameDir = join(ctx.env.STORAGE_LOCAL_ROOT, "_work", video.id, "frames");
  await mkdir(frameDir, { recursive: true });
  const n = Math.min(6, sb.scenes.length);
  const times = Array.from({ length: n }, (_, i) => Math.min(media.durationSec - 0.5, (media.durationSec / n) * (i + 0.5)));
  const frames = await extractFrames(renderPath, times, frameDir);
  const dataUrls = await Promise.all(frames.map(async (f) => `data:image/jpeg;base64,${(await readFile(f)).toString("base64")}`));
  const descs = times.map((tm) => { const idx = Math.min(sb.scenes.length - 1, Math.floor((tm / media.durationSec) * sb.scenes.length)); return sb.scenes[idx]!.visualDescription; });
  const vq = await callLLM(ctx, "qa.visual", { system: SYSTEM_BASE, prompt: visualQaPrompt(descs), images: dataUrls, schema: VisualQaSchema, maxOutputTokens: 2500 }, meta);
  const missingAssets = sb.scenes.filter((s) => s.assetIds.length === 0);
  checks.push({ check: "VISUAL", passed: vq.data.criticalProblems.length === 0 && missingAssets.length === 0 && vq.data.overallVisualQuality >= 0.5, severity: missingAssets.length || vq.data.criticalProblems.length ? "error" : vq.data.overallVisualQuality < 0.65 ? "warn" : "info", score: vq.data.overallVisualQuality, details: [...missingAssets.map((s) => `Szene ${s.index} ohne Asset`), ...vq.data.criticalProblems].join("; ") || `OK (Qualität ${vq.data.overallVisualQuality.toFixed(2)})`, automation: ctx.env.PROVIDER_MODE === "mock" ? "SEMI_AUTOMATED" : "AUTOMATED", evidence: { frames: vq.data.frames } });

  // DUPLICATION (gegen andere Videos des Projekts) + REPETITION (intern)
  const otherScripts = (await ctx.store.scripts.listByProject(video.projectId)).filter((s) => s.topicId !== video.topicId);
  const otherSbs = (await ctx.store.storyboards.listByProject(video.projectId)).filter((s) => s.id !== sb.id && otherScripts.some((o) => o.id === s.scriptId));
  const maxScriptSim = Math.max(0, ...otherScripts.map((o) => textSimilarity(o.fullNarration, script.fullNarration)));
  const maxTitleSim = Math.max(0, ...otherScripts.map((o) => shortTextSimilarity(o.title, script.title)));
  const maxStructSim = Math.max(0, ...otherSbs.map((o) => sequenceSimilarity(o.scenes.map((s) => s.visualStyleTag), sb.scenes.map((s) => s.visualStyleTag))));
  const dup = maxScriptSim >= ORIGINALITY_THRESHOLDS.script || maxTitleSim >= ORIGINALITY_THRESHOLDS.title || (maxStructSim >= ORIGINALITY_THRESHOLDS.sceneStructure && sb.scenes.length >= 6);
  checks.push({ check: "DUPLICATION", passed: !dup, severity: dup ? "error" : "info", score: 1 - Math.max(maxScriptSim, maxTitleSim * 0.5), details: `script ${maxScriptSim.toFixed(2)}, title ${maxTitleSim.toFixed(2)}, struktur ${maxStructSim.toFixed(2)} (n=${otherScripts.length})`, automation: "AUTOMATED" });
  const prompts = sb.scenes.map((s) => s.generationPrompt);
  const repeated = prompts.filter((p, i) => prompts.findIndex((q) => textSimilarity(p, q) > 0.8) !== i).length;
  const sameTagRuns = sb.scenes.filter((s, i) => i > 0 && sb.scenes[i - 1]!.visualStyleTag === s.visualStyleTag).length;
  checks.push({ check: "REPETITION", passed: repeated <= 1 && sameTagRuns < Math.ceil(sb.scenes.length / 2), severity: repeated > 1 ? "warn" : "info", score: Math.max(0, 1 - 0.15 * repeated - 0.05 * sameTagRuns), details: `${repeated} nahezu identische Prompts, ${sameTagRuns} gleiche Stil-Folgen`, automation: "AUTOMATED" });

  // Score
  const score = computeQualityScore({
    factAccuracy: checks.find((c) => c.check === "FACT")?.score ?? 0.5,
    visualQuality: vq.data.overallVisualQuality,
    audioQuality: checks.find((c) => c.check === "AUDIO")?.score ?? 0.5,
    originality: checks.find((c) => c.check === "DUPLICATION")?.score ?? 0.5,
    hookStrength: sq.data.hookStrength,
    retentionPrediction: sq.data.retentionPrediction,
    policySafety: policyConcerns.length ? 0 : 1,
    technicalQuality: checks.find((c) => c.check === "TECHNICAL")?.score ?? 0.5,
  });
  const { decision, reasons } = decideFromChecks(checks, score, project.minPublishScore);
  const report = await ctx.store.qa.create({ videoId: video.id, checks, score, decision, reasons });
  await ctx.store.videos.update(video.id, { qaReportId: report.id, qualityScore: score.total });
  return report;
}
