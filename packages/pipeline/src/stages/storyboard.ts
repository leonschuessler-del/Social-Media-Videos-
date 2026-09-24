import type { Scene, Storyboard, Video } from "@content-os/core";
import { newId } from "@content-os/core";
import type { PipelineContext } from "../context.ts";
import { callLLM } from "../llm.ts";
import { StoryboardSchema } from "../schemas.ts";
import { storyboardPrompt, SYSTEM_BASE } from "../prompts.ts";

export function videoGenerationAvailable(ctx: PipelineContext): boolean {
  // OpenAI-first: echte Videogenerierung nur, wenn ein freigegebener, nicht-blockierter Video-Provider existiert (Mock zählt im Mock-Modus).
  if (ctx.env.PROVIDER_MODE === "mock") return ctx.registry.isEnabled("mock");
  return ctx.registry.infos.some((i) => i.capabilities.includes("video.generate") && i.status === "AVAILABLE" && ctx.registry.isEnabled(i.name));
}

export async function runStoryboard(ctx: PipelineContext, video: Video): Promise<Storyboard> {
  const [project, script] = await Promise.all([ctx.store.projects.get(video.projectId), video.scriptId ? ctx.store.scripts.get(video.scriptId) : undefined]);
  if (!project || !script) throw new Error("Projekt/Skript fehlt");
  const sceneSeconds = video.format === "SHORT" ? 5 : 9;
  const vidAvail = videoGenerationAvailable(ctx);
  const res = await callLLM(ctx, "storyboard.build", { system: SYSTEM_BASE, prompt: storyboardPrompt(project, script, video.format, { videoGenerationAvailable: vidAvail, sceneSeconds }), schema: StoryboardSchema, maxOutputTokens: video.format === "SHORT" ? 5000 : 16000 }, { projectId: video.projectId, videoId: video.id, stage: "STORYBOARD", format: video.format, topicTitle: script.title, language: video.language });

  // Narration-Konsistenz: Szenen-Narration muss die Skript-Narration lückenlos abdecken; sonst deterministisch neu verteilen
  const scriptWords = script.fullNarration.split(/\s+/).filter(Boolean);
  const sceneWords = res.data.scenes.flatMap((s) => s.narration.split(/\s+/).filter(Boolean));
  const consistent = sceneWords.length >= scriptWords.length * 0.95 && sceneWords.length <= scriptWords.length * 1.05;
  let narrations = res.data.scenes.map((s) => s.narration);
  if (!consistent) {
    ctx.logger.warn({ scriptWords: scriptWords.length, sceneWords: sceneWords.length }, "Storyboard-Narration inkonsistent – verteile Skript deterministisch auf Szenen");
    const per = Math.ceil(scriptWords.length / res.data.scenes.length);
    narrations = res.data.scenes.map((_, i) => scriptWords.slice(i * per, (i + 1) * per).join(" "));
  }
  const wps = 150 / 60;
  const scenes: Scene[] = res.data.scenes.map((s, i) => {
    const method = !vidAvail && (s.method === "IMAGE_TO_VIDEO" || s.method === "TEXT_TO_VIDEO") ? "IMAGE_KENBURNS" : s.method;
    const words = narrations[i]!.split(/\s+/).filter(Boolean).length;
    return {
      id: newId("scn"), scriptId: script.id, index: i, sectionId: script.sections[s.sectionIndex]?.id ?? script.sections[0]!.id,
      durationSec: Math.max(2, Number((words / wps).toFixed(2))), narration: narrations[i]!, visualDescription: s.visualDescription,
      generationPrompt: s.generationPrompt, negativePrompt: s.negativePrompt, method, camera: s.camera, transitionIn: i === 0 ? "cut" : s.transitionIn,
      soundDesign: s.soundDesign, overlay: s.overlayStyle !== "none" && s.overlayText ? { text: s.overlayText, position: video.format === "SHORT" ? "top" : "bottom", style: s.overlayStyle } : undefined,
      claimIds: script.sections[s.sectionIndex]?.claimIds ?? [], visualStyleTag: s.visualStyleTag, assetIds: [],
      ...(s.infographic ? { infographic: s.infographic } : {}),
    } as Scene & { infographic?: { title: string; value: string; label: string } };
  }).filter((s) => s.narration.trim().length > 0);
  const sb = await ctx.store.storyboards.create({ scriptId: script.id, aspect: video.format === "SHORT" ? "9:16" : "16:9", scenes, visualStyle: res.data.visualStyle, colorPalette: res.data.colorPalette, model: res.model });
  await ctx.store.videos.update(video.id, { storyboardId: sb.id });
  return sb;
}
