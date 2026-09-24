import type { Asset, Scene, Video, WordTimestamp } from "@content-os/core";
import { CapacityExhaustedError } from "@content-os/core";
import type { PipelineContext } from "../context.ts";
import { recordUsage } from "../llm.ts";

export interface VoiceResult { asset: Asset; words: WordTimestamp[]; durationSec: number }

/** Ordnet jeder Szene Start/Ende anhand der Wort-Zeitstempel zu (sequenzielles Matching). */
export function alignScenesToWords(scenes: Scene[], words: WordTimestamp[], totalDur: number): { sceneId: string; startSec: number; endSec: number }[] {
  const out: { sceneId: string; startSec: number; endSec: number }[] = [];
  let wi = 0;
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  for (let si = 0; si < scenes.length; si++) {
    const scene = scenes[si]!;
    const sceneWords = scene.narration.split(/\s+/).filter(Boolean).map(norm).filter(Boolean);
    const start = words[wi]?.startSec ?? (out.at(-1)?.endSec ?? 0);
    let matched = 0;
    // Greedy: laufe über die Wortliste, bis so viele Wörter "verbraucht" sind wie die Szene hat (tolerant bei Abweichungen)
    while (wi < words.length && matched < sceneWords.length) { wi++; matched++; }
    const end = si === scenes.length - 1 ? totalDur : (words[wi]?.startSec ?? totalDur);
    out.push({ sceneId: scene.id, startSec: Number(start.toFixed(3)), endSec: Number(Math.max(start + 1.0, end).toFixed(3)) });
  }
  // Letzte Szene bis Ende inkl. Nachlauf
  if (out.length) out[out.length - 1]!.endSec = Math.max(out[out.length - 1]!.endSec, totalDur);
  return out;
}

export async function runVoice(ctx: PipelineContext, video: Video): Promise<VoiceResult> {
  const [project, script, sb] = await Promise.all([ctx.store.projects.get(video.projectId), video.scriptId ? ctx.store.scripts.get(video.scriptId) : undefined, video.storyboardId ? ctx.store.storyboards.get(video.storyboardId) : undefined]);
  if (!project || !script || !sb) throw new Error("Projekt/Skript/Storyboard fehlt");
  const storage = ctx.registry.pick("storage", ["s3", "local"], "storage");
  const tts = ctx.registry.pick("tts", ["openai", "mock"], "tts");
  const text = sb.scenes.map((s) => s.narration).join(" ");
  const voiceId = project.styleGuide.voiceId ?? (tts.name === "openai" ? "onyx" : "mock-voice");

  await ctx.budget.assertCanSpend({ estimatedCostEur: (text.length / 1e6) * 0.6 * ctx.env.USD_EUR_RATE + (text.length / 15 / 60) * 0.015 * ctx.env.USD_EUR_RATE, videoId: video.id, projectId: project.id, format: video.format, provider: tts.name });
  const capKey = `${tts.name}:tts`;
  const cap = await ctx.capacity.check(capKey);
  if (!cap.allowed) throw new CapacityExhaustedError(tts.name, cap.reason ?? "Kapazität", cap.retryAfterSeconds);
  let res;
  try {
    await ctx.capacity.consume(capKey);
    res = await tts.synthesize({ text, voiceId, language: video.language, speed: 1.0, instructions: `${project.styleGuide.narrationTone}. Deutsch, klar artikuliert, dokumentarisch, leichte Spannung, keine Übertreibung.`, format: "mp3" });
  } catch (err) {
    if (err instanceof CapacityExhaustedError) await ctx.capacity.reportLimit(capKey, err.retryAfterSeconds ?? 60);
    await recordUsage(ctx, [{ provider: tts.name, model: "tts", units: text.length, unitType: "characters" }], "tts", { projectId: project.id, videoId: video.id, stage: "VOICE" }, { failed: true });
    throw err;
  }
  await recordUsage(ctx, res.usage, "tts", { projectId: project.id, videoId: video.id, stage: "VOICE", format: video.format });
  const ext = res.mimeType.includes("wav") ? "wav" : "mp3";
  const key = `projects/${project.slug}/videos/${video.id}/voice.${ext}`;
  const put = await storage.put(key, res.audio, res.mimeType);

  // Wort-Zeitstempel: vom TTS (Mock) oder per STT-Alignment (OpenAI whisper-1)
  let words = res.words;
  let durationSec = res.durationSec ?? 0;
  if (!words?.length) {
    const stt = ctx.registry.pick("stt", ["openai", "mock"], "stt.align");
    const al = await stt.transcribe(res.audio, { language: video.language, mimeType: res.mimeType, promptText: text });
    await recordUsage(ctx, al.usage, "stt.align", { projectId: project.id, videoId: video.id, stage: "VOICE", format: video.format });
    words = al.words;
    durationSec = durationSec || al.durationSec;
    // Wörter des Skripts auf STT-Zeitstempel mappen (gleiche Anzahl bevorzugt; sonst proportional)
    const scriptTokens = text.split(/\s+/).filter(Boolean);
    if (words.length !== scriptTokens.length && words.length > 0) {
      const ratio = words.length / scriptTokens.length;
      words = scriptTokens.map((w, i) => { const a = words![Math.min(words!.length - 1, Math.floor(i * ratio))]!; const b = words![Math.min(words!.length - 1, Math.floor((i + 1) * ratio))]!; return { word: w, startSec: a.startSec, endSec: Math.max(a.endSec, b.startSec) }; });
    } else {
      words = words.map((w, i) => ({ ...w, word: scriptTokens[i] ?? w.word }));
    }
  }
  const asset = await ctx.store.assets.create({ projectId: project.id, kind: "audio_voice", storageKey: key, mimeType: res.mimeType, durationSec, sizeBytes: put.sizeBytes, provider: tts.name, model: res.model, prompt: text.slice(0, 500), topicId: video.topicId, videoId: video.id, rights: { source: "generated", license: "provider-terms", attributionRequired: false }, usedInVideoIds: [video.id], tags: ["voice", voiceId, ...(words ? [] : ["no-timestamps"])] });
  // Zeitstempel als Sidecar-Asset (JSON)
  const wkey = `projects/${project.slug}/videos/${video.id}/voice.words.json`;
  await storage.put(wkey, Buffer.from(JSON.stringify(words)), "application/json");
  await ctx.store.assets.create({ projectId: project.id, kind: "subtitle", storageKey: wkey, mimeType: "application/json", provider: tts.name, topicId: video.topicId, videoId: video.id, rights: { source: "own", attributionRequired: false }, usedInVideoIds: [video.id], tags: ["words"] });
  return { asset, words: words ?? [], durationSec };
}
