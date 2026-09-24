import type { Asset, Metadata, Video } from "@content-os/core";
import { composeThumbnail } from "@content-os/render";
import type { PipelineContext } from "../context.ts";
import { callLLM } from "../llm.ts";
import { MetadataSchema } from "../schemas.ts";
import { metadataPrompt, SYSTEM_BASE } from "../prompts.ts";

/** Titel, Beschreibung, Chapters, Tags, Disclosure + Thumbnail-Varianten (3) -> Metadata + thumbnailAssetId. */
export async function runMetadataAndThumbnail(ctx: PipelineContext, video: Video, sceneTimings?: { sceneId: string; startSec: number }[]): Promise<{ metadata: Metadata; thumbnails: Asset[] }> {
  const [project, script, sb, research] = await Promise.all([ctx.store.projects.get(video.projectId), video.scriptId ? ctx.store.scripts.get(video.scriptId) : undefined, video.storyboardId ? ctx.store.storyboards.get(video.storyboardId) : undefined, video.researchId ? ctx.store.research.get(video.researchId) : undefined]);
  if (!project || !script || !sb || !research) throw new Error("Daten fehlen");
  const storage = ctx.registry.pick("storage", ["s3", "local"], "storage");
  const sourcesText = research.sources.filter((s) => s.reliability >= 0.5).slice(0, 12).map((s) => `• ${s.title} – ${s.url}`).join("\n");
  const res = await callLLM(ctx, "metadata.generate", { system: SYSTEM_BASE, prompt: metadataPrompt(script, video.format, sourcesText), schema: MetadataSchema, maxOutputTokens: 2500 }, { projectId: video.projectId, videoId: video.id, stage: "QA", format: video.format, topicTitle: script.title, language: video.language });
  const idx = Math.min(Math.max(0, res.data.selectedTitleIndex), res.data.titleCandidates.length - 1);
  const chapters = video.format === "LONGFORM" && sceneTimings ? script.sections.map((sec, i) => ({ startSec: Math.floor(sceneTimings.find((t) => sb.scenes.find((s) => s.id === t.sceneId)?.sectionId === sec.id)?.startSec ?? (i === 0 ? 0 : -1)), title: sec.kind === "HOOK" ? "Intro" : sec.visualIntent.slice(0, 40) })).filter((c, i, arr) => c.startSec >= 0 && (i === 0 || c.startSec > arr[i - 1]!.startSec)) : [];
  const description = [res.data.description.trim(), chapters.length ? "\nKapitel:\n" + chapters.map((c) => `${fmt(c.startSec)} ${c.title}`).join("\n") : "", sourcesText ? "\nQuellen:\n" + sourcesText : "", "\n" + project.styleGuide.disclosureText].join("\n").trim();
  const metadata: Metadata = { titleCandidates: res.data.titleCandidates, selectedTitle: res.data.titleCandidates[idx] ?? script.title, description, chapters, tags: res.data.tags.slice(0, 30), sourcesText, syntheticDisclosure: true, madeForKids: false, categoryId: "28", defaultLanguage: video.language };

  // Thumbnails: 3 Varianten aus dem Hero-Bild (Szene mit stärkstem Motiv = erste Nicht-Text-Szene)
  const assets = await ctx.store.assets.listByVideo(video.id);
  const heroScene = sb.scenes.find((s) => s.method !== "TEXT_CARD" && s.method !== "INFOGRAPHIC") ?? sb.scenes[0]!;
  const heroAsset = assets.find((a) => a.sceneId === heroScene.id && (a.kind === "image" || a.kind === "infographic")) ?? assets.find((a) => a.kind === "image");
  const thumbnails: Asset[] = [];
  if (heroAsset) {
    const base = await storage.get(heroAsset.storageKey);
    const variants: ("left_text" | "bottom_band" | "center_burst")[] = [res.data.thumbnailVariant, ...(["left_text", "bottom_band", "center_burst"] as const).filter((v) => v !== res.data.thumbnailVariant)];
    for (const variant of variants) {
      const jpg = await composeThumbnail({ baseImage: base, width: 1280, height: 720, headline: res.data.thumbnailHeadline, accentColor: project.styleGuide.brandColors.accent, textColor: project.styleGuide.brandColors.text, variant, fontFamily: project.styleGuide.fontFamily });
      const key = `projects/${project.slug}/videos/${video.id}/thumb_${variant}.jpg`;
      const put = await storage.put(key, jpg, "image/jpeg");
      thumbnails.push(await ctx.store.assets.create({ projectId: project.id, kind: "thumbnail", storageKey: key, mimeType: "image/jpeg", width: 1280, height: 720, sizeBytes: put.sizeBytes, provider: "local", model: "sharp", prompt: res.data.thumbnailHeadline, topicId: video.topicId, videoId: video.id, rights: { source: "own", attributionRequired: false }, usedInVideoIds: [video.id], tags: ["thumbnail", variant] }));
    }
  }
  const existing = (await ctx.store.videos.get(video.id))!;
  await ctx.store.videos.update(video.id, { metadata, thumbnailAssetId: thumbnails[0]?.id, experiment: { ...(existing.experiment ?? { topicId: video.topicId, hookType: script.hookType, scriptStyle: project.styleGuide.narrationTone, visualStyle: sb.visualStyle, durationSec: 0, language: video.language, generationModels: {}, generationCostEur: 0 }), titleVariant: metadata.selectedTitle, thumbnailVariant: thumbnails[0]?.tags[1] } });
  return { metadata, thumbnails };
}

function fmt(sec: number): string { const m = Math.floor(sec / 60), s = sec % 60; return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`; }
