import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Asset, Scene, Video, WordTimestamp } from "@content-os/core";
import { composeVideo, type TimelineScene } from "@content-os/render";
import type { PipelineContext } from "../context.ts";
import { recordUsage } from "../llm.ts";
import { alignScenesToWords } from "./voice.ts";
import { dims } from "./assets.ts";

export const BRAND_FONT_FILE = process.env.BRAND_FONT_FILE ?? "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

/** Deterministischer Schnitt: Storyboard + Voice + Musik + Captions -> MP4 (16:9 oder 9:16). */
export async function runEdit(ctx: PipelineContext, video: Video): Promise<{ renderAsset: Asset; durationSec: number; sceneTimings: { sceneId: string; startSec: number; endSec: number }[] }> {
  const [project, sb] = await Promise.all([ctx.store.projects.get(video.projectId), video.storyboardId ? ctx.store.storyboards.get(video.storyboardId) : undefined]);
  if (!project || !sb) throw new Error("Projekt/Storyboard fehlt");
  const storage = ctx.registry.pick("storage", ["s3", "local"], "storage");
  const assets = await ctx.store.assets.listByVideo(video.id);
  const voice = assets.find((a) => a.kind === "audio_voice");
  const wordsAsset = assets.find((a) => a.kind === "subtitle" && a.tags.includes("words"));
  if (!voice || !wordsAsset) throw new Error("Voice-Asset/Zeitstempel fehlen (VOICE-Stufe zuerst)");
  const words = JSON.parse((await storage.get(wordsAsset.storageKey)).toString()) as WordTimestamp[];
  const voicePath = await storage.localPath(voice.storageKey);
  const totalDur = (voice.durationSec ?? words.at(-1)?.endSec ?? 0) + 0.8;
  const timings = alignScenesToWords(sb.scenes, words, totalDur);
  const { width, height } = dims(video.format);

  const scenes: TimelineScene[] = [];
  for (const scene of sb.scenes as (Scene & { infographic?: unknown })[]) {
    const t = timings.find((x) => x.sceneId === scene.id)!;
    const sceneAssets = scene.assetIds.map((id) => assets.find((a) => a.id === id)).filter((a): a is Asset => !!a);
    const clip = sceneAssets.find((a) => a.kind === "video");
    const img = sceneAssets.find((a) => a.kind === "image" || a.kind === "infographic");
    if (!clip && !img) throw new Error(`Szene ${scene.index}: kein Asset`);
    let sfxPath: string | undefined;
    if (scene.soundDesign) {
      try { const sfx = ctx.registry.pick("sfx", ["local"], "sfx"); const f = await sfx.find({ description: scene.soundDesign, maxDurationSec: 6 }); sfxPath = f.clip?.path; } catch { /* keine SFX-Bibliothek */ }
    }
    scenes.push({ id: scene.id, durationSec: Number((t.endSec - t.startSec).toFixed(3)), imagePath: clip ? undefined : await storage.localPath(img!.storageKey), videoPath: clip ? await storage.localPath(clip.storageKey) : undefined, camera: scene.camera as TimelineScene["camera"], transitionIn: scene.transitionIn, overlay: scene.overlay, sfxPath });
  }
  // Musik (lokale Bibliothek oder synthetischer Fallback)
  const music = ctx.registry.pick("music", ["local"], "music");
  const mood = video.format === "SHORT" ? "tension" : "documentary";
  const m = await music.pick({ mood, durationSec: totalDur });
  await recordUsage(ctx, m.usage, "music", { projectId: project.id, videoId: video.id, stage: "EDIT" });
  if (m.track) {
    await ctx.store.assets.create({ projectId: project.id, kind: "audio_music", storageKey: m.track.path ?? m.track.id, mimeType: "audio/wav", durationSec: m.track.durationSec, provider: "local", model: m.track.source, topicId: video.topicId, videoId: video.id, rights: { source: m.track.source === "synth-fallback" ? "own" : "licensed_library", license: m.track.license, attributionRequired: m.track.attributionRequired }, usedInVideoIds: [video.id], tags: ["music", mood] });
  }

  const workDir = join(ctx.env.STORAGE_LOCAL_ROOT, "_work", video.id);
  await mkdir(workDir, { recursive: true });
  const outPath = join(workDir, `render_${video.format.toLowerCase()}.mp4`);
  const bc = project.styleGuide.brandColors;
  const res = await composeVideo({
    width, height, fps: 30, scenes, voicePath, voiceWords: words,
    musicPath: m.track?.path, musicGainDb: -20, duckDb: -12,
    captions: { mode: project.styleGuide.captionStyle, style: { fontFamily: project.styleGuide.fontFamily, fontSize: video.format === "SHORT" ? 84 : 56, primaryColor: bc.text, highlightColor: bc.accent, outlineColor: "#000000", marginV: video.format === "SHORT" ? 420 : 90, bold: true } },
    brand: { fontFile: BRAND_FONT_FILE, textColor: bc.text, accentColor: bc.accent, bgColor: bc.background },
    fadeOutSec: 0.6, workDir, outPath, crf: 19, preset: ctx.env.NODE_ENV === "test" ? "veryfast" : "medium", threads: ctx.env.RENDER_THREADS,
  });
  await recordUsage(ctx, [{ provider: "local", model: "ffmpeg", units: res.renderSeconds / 60, unitType: "render_minutes" }], "storage", { projectId: project.id, videoId: video.id, stage: "EDIT" });
  const key = `projects/${project.slug}/videos/${video.id}/render_${video.format.toLowerCase()}.mp4`;
  const buf = await readFile(res.outPath);
  const put = await storage.put(key, buf, "video/mp4");
  const renderAsset = await ctx.store.assets.create({ projectId: project.id, kind: "render", storageKey: key, mimeType: "video/mp4", width, height, durationSec: res.durationSec, sizeBytes: put.sizeBytes, provider: "local", model: "ffmpeg", topicId: video.topicId, videoId: video.id, rights: { source: "own", attributionRequired: false }, usedInVideoIds: [video.id], tags: ["render", video.format.toLowerCase()] });
  if (res.assPath) {
    const akey = `projects/${project.slug}/videos/${video.id}/captions.ass`;
    await storage.put(akey, await readFile(res.assPath), "text/plain");
  }
  await ctx.store.videos.update(video.id, { renderAssetId: renderAsset.id });
  return { renderAsset, durationSec: res.durationSec, sceneTimings: timings };
}
