/**
 * Baut ein fertiges YouTube-Video aus Skript + Storyboard + lokaler Sprachsynthese.
 *   npx tsx productions/tools/build_video.ts <productionDir> [--stage all|timeline|audio|render|mux|qa] [--from s --to s]
 * Erwartet in <productionDir>: script.json, storyboard.json, factbase.json (optional), out/voice/{voice.wav,timings.json}
 * Erzeugt in out/: timeline.json, music_plan.json, music.wav, mix.wav, captions.ass, captions.srt, video_raw.mp4,
 *                  final.mp4 (ohne eingebrannte Untertitel, SRT separat für YouTube), final_untertitelt.mp4, metadata.json, description.txt, qa.json
 */
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { execa } from "execa";
import { renderTimeline, type Timeline, type TimelineScene } from "../../packages/motion/src/render.ts";
import { buildAss, buildSrt } from "../../packages/render/src/captions.ts";
import { analyzeMedia } from "../../packages/render/src/qa-media.ts";

const dir = resolve(process.argv[2] ?? "productions/001-aufzugseil");
const arg = (k: string, d?: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const stage = arg("stage", "all")!;
const out = join(dir, "out"); await mkdir(out, { recursive: true });
const TOOLS = resolve("productions/tools");
const PY = process.env.PY ?? "python3";
const FF = process.env.FFMPEG_PATH ?? "ffmpeg";

interface Segment { id: string; chapter: string; narration_tts: string; caption_text: string; visual_beat: string; claim_ids: string[]; kind: string }
interface Script { title_candidates: string[]; segments: Segment[] }
interface SbScene { id: string; segment_id: string; template: string; params_json: string; on_screen_text: string; weight: number; camera: string; sfx: string; description: string }
interface Timings { duration: number; segments: { id: string; chapter: string; kind: string; start: number; end: number; sentences: { text: string; caption: string | null; start: number; end: number; words: { w: string; s: number; e: number }[] }[] }[] }

async function exists(p: string) { try { await access(p); return true; } catch { return false; } }
const script = JSON.parse(await readFile(join(dir, "script.json"), "utf8")) as Script;
const storyboard = JSON.parse(await readFile(join(dir, (await exists(join(dir, "storyboard_final.json"))) ? "storyboard_final.json" : "storyboard.json"), "utf8")) as { scenes: SbScene[] };
const timings = JSON.parse(await readFile(join(out, "voice/timings.json"), "utf8")) as Timings;

const MOOD: Record<string, string> = { HOOK: "tension", SETUP: "wonder", EXPLANATION: "drive", STORY: "wonder", PATTERN_INTERRUPT: "tension", PAYOFF: "resolve", RECAP: "resolve", CTA: "calm", OUTRO: "calm" };
const SFX_OFFSET: Record<string, number> = { riser: -2.4, whoosh: -0.35, impact: 0.0, rope_snap: 0.6, metal_creak: 0.2, ratchet: 0.5, sparks_screech: 0.8, hydraulic_hiss: 0.6, click: 0.2, rumble: 0 };

const TEMPLATES_PRESENT = new Set(readdirSync(join(TOOLS, "../../packages/motion/web/templates")).map((f) => f.replace(/\.js$/, "")));
// ---------------------------------------------------------------- 1. Timeline
function buildTimeline(): { timeline: Timeline; sfxCues: { t: number; name: string }[] } {
  const scenes: TimelineScene[] = []; const sfxCues: { t: number; name: string }[] = [];
  const chapters: { title: string; start: number }[] = [];
  for (const seg of timings.segments) {
    const sb = storyboard.scenes.filter((s) => s.segment_id === seg.id);
    const list = sb.length ? sb : [{ id: `${seg.id}_auto`, segment_id: seg.id, template: "title_card", params_json: JSON.stringify({ title: seg.chapter }), on_screen_text: "", weight: 1, camera: "slow_push_in", sfx: "none", description: "auto" } as SbScene];
    if (!chapters.length || chapters.at(-1)!.title !== seg.chapter) chapters.push({ title: seg.chapter, start: seg.start });
    const segDur = seg.end - seg.start; const minDur = 2.8;
    let items = list.slice(); while (items.length > 1 && segDur / items.length < minDur) items = items.slice(0, -1);
    const wsum = items.reduce((a, s) => a + Math.max(0.2, s.weight || 1), 0);
    // Szenenwechsel auf Satz- (bevorzugt) bzw. Wortgrenzen legen, damit Bild und gesprochener Satz zusammenpassen
    const sentB = seg.sentences.slice(1).map((x) => x.start - Math.min(0.25, (x.start - seg.sentences[0].start) * 0.5));
    const wordB = seg.sentences.flatMap((x) => x.words.slice(1).map((w) => w.s));
    const cuts: number[] = []; let acc = 0;
    items.slice(0, -1).forEach((s, i) => {
      acc += (segDur * Math.max(0.2, s.weight || 1)) / wsum;
      const target = seg.start + acc; const lo = (cuts.at(-1) ?? seg.start) + minDur; const hi = seg.end - minDur * (items.length - 1 - i);
      const pick = (arr: number[], tol: number) => arr.filter((b) => b >= lo && b <= hi && Math.abs(b - target) <= tol).sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
      const b = pick(sentB, Math.max(2.5, segDur * 0.22)) ?? pick(wordB, 1.5) ?? Math.min(Math.max(target, lo), hi);
      cuts.push(b);
    });
    const bounds = [seg.start, ...cuts, seg.end];
    let t = seg.start;
    items.forEach((s0, i) => {
      let s = s0; const d = bounds[i + 1] - bounds[i];
      let params: Record<string, unknown> = {}; try { params = JSON.parse(s.params_json || "{}"); } catch { params = {}; }
      // Vorschau-Modus: noch nicht gebaute Vorlagen durch Titeltafel ersetzen (nie im finalen Render)
      if (arg("substitute") && !TEMPLATES_PRESENT.has(s.template)) { params = { title: s0.on_screen_text || seg.chapter, subtitle: seg.chapter }; s = { ...s0, template: "title_card", on_screen_text: "", camera: "slow_push_in" }; }
      const prev = scenes.at(-1);
      const transition = s.sfx === "impact" || s.sfx === "rope_snap" ? "flash" : prev && prev.template === s.template ? "fade" : "fade";
      scenes.push({ id: s.id, start: +t.toFixed(3), end: +(t + d).toFixed(3), template: s.template, params, text: s.on_screen_text || "", camera: s.camera || "static", chapter: seg.chapter, transition });
      if (s.sfx && s.sfx !== "none") sfxCues.push({ t: Math.max(0, t + (SFX_OFFSET[s.sfx] ?? 0)), name: s.sfx });
      t += d;
    });
  }
  // Ende: letzte Szene bis Audio-Ende
  scenes.at(-1)!.end = +timings.duration.toFixed(3);
  // Kapitel-Übergänge: Whoosh + Riser/Hit übernimmt die Musik
  return { timeline: { fps: 30, width: 1920, height: 1080, scenes, chapters }, sfxCues };
}

// ---------------------------------------------------------------- 2. Musikplan
function musicPlan(chapters: { title: string; start: number }[]) {
  const sections: { start: number; end: number; mood: string }[] = [];
  for (const seg of timings.segments) {
    const mood = MOOD[seg.kind] ?? "wonder"; const last = sections.at(-1);
    if (last && last.mood === mood) last.end = seg.end; else sections.push({ start: seg.start, end: seg.end, mood });
  }
  sections.at(-1)!.end = timings.duration;
  // sehr kurze Abschnitte in den Vorgänger mischen
  const merged: typeof sections = [];
  for (const s of sections) { const l = merged.at(-1); if (l && s.end - s.start < 14) l.end = s.end; else merged.push({ ...s }); }
  const hits = chapters.slice(1).map((c) => c.start);
  return { duration: timings.duration + 1, sections: merged, hits, risers: hits };
}

// ---------------------------------------------------------------- 3. Untertitel
function captionWords(): { word: string; startSec: number; endSec: number }[] {
  const words: { word: string; startSec: number; endSec: number }[] = [];
  for (const seg of timings.segments) for (const s of seg.sentences) {
    const text = (s.caption ?? s.text).trim(); const toks = text.split(/\s+/);
    const w = toks.map((x) => Math.max(2, x.replace(/\W/g, "").length) + 1.5); const tot = w.reduce((a, b) => a + b, 0);
    let t = s.start; toks.forEach((tok, i) => { const d = ((s.end - s.start) * w[i]!) / tot; words.push({ word: tok, startSec: +t.toFixed(3), endSec: +(t + d).toFixed(3) }); t += d; });
  }
  return words;
}


const { timeline, sfxCues } = buildTimeline();
if (stage === "all" || stage === "timeline") {
  await writeFile(join(out, "timeline.json"), JSON.stringify(timeline, null, 1));
  await writeFile(join(out, "sfx_cues.json"), JSON.stringify(sfxCues, null, 1));
  const words = captionWords();
  await writeFile(join(out, "captions.ass"), buildAss(words, { fontFamily: "Inter", fontSize: 50, primaryColor: "#FFFFFF", highlightColor: "#FFB347", outlineColor: "#000000", marginV: 60, playResX: 1920, playResY: 1080, bold: true }, { mode: "line", maxWordsPerLine: 9, maxCharsPerLine: 52 }));
  await writeFile(join(out, "captions.srt"), buildSrt(words, 9));
  await writeFile(join(out, "music_plan.json"), JSON.stringify(musicPlan(timeline.chapters!), null, 1));
  // Pro Szene: exakt gesprochener Text + Wortzeiten relativ zum Szenenstart (für Szenen-Abnahme und Timing von Einblendungen)
  const allW = timings.segments.flatMap((sg) => sg.sentences.flatMap((x) => x.words));
  const sceneNarr = timeline.scenes.map((sc) => { const ws = allW.filter((w) => w.s >= sc.start - 0.05 && w.s < sc.end - 0.05); return { id: sc.id, template: sc.template, start: sc.start, end: sc.end, duration: +(sc.end - sc.start).toFixed(3), narration: ws.map((w) => w.w).join(" "), words: ws.map((w) => ({ w: w.w, t: +(w.s - sc.start).toFixed(2) })) }; });
  await writeFile(join(out, "scene_narration.json"), JSON.stringify(sceneNarr, null, 1));
  console.log(`timeline: ${timeline.scenes.length} Szenen, ${timeline.chapters!.length} Kapitel, ${timings.duration.toFixed(1)} s, ${sfxCues.length} SFX`);
}

// ---------------------------------------------------------------- 4. Audio
if (stage === "all" || stage === "audio") {
  if (!(await exists(join(out, "music.wav"))) || arg("remusic")) await execa(PY, [join(TOOLS, "audio_synth.py"), "music", join(out, "music_plan.json"), join(out, "music.wav")], { stdio: "inherit" });
  const sfxDir = arg("sfx", join(out, "sfx"))!;
  if (!(await exists(join(sfxDir, "whoosh.wav")))) await execa(PY, [join(TOOLS, "audio_synth.py"), "sfx", sfxDir], { stdio: "inherit" });
  const cues = JSON.parse(await readFile(join(out, "sfx_cues.json"), "utf8")) as { t: number; name: string }[];
  const inputs = ["-i", join(out, "voice/voice.wav"), "-i", join(out, "music.wav"), ...cues.flatMap((c) => ["-i", join(sfxDir, `${c.name}.wav`)])];
  let f = `[0:a]aresample=48000,aformat=channel_layouts=stereo,highpass=f=70,acompressor=threshold=-20dB:ratio=3:attack=5:release=120:makeup=2,equalizer=f=3500:t=q:w=1.2:g=2[v];`;
  f += `[v]asplit=2[vmix][vsc];[1:a]aresample=48000,volume=-17dB[mraw];[mraw][vsc]sidechaincompress=threshold=0.015:ratio=6:attack=60:release=700:makeup=1[m];`;
  const labels = ["[vmix]", "[m]"];
  cues.forEach((c, i) => { const ms = Math.round(c.t * 1000); f += `[${i + 2}:a]aresample=48000,aformat=channel_layouts=stereo,volume=-9dB,adelay=${ms}|${ms}[s${i}];`; labels.push(`[s${i}]`); });
  f += `${labels.join("")}amix=inputs=${labels.length}:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]`;
  await writeFile(join(out, "mix_filter.txt"), f);
  await execa(FF, ["-hide_banner", "-loglevel", "error", "-y", ...inputs, "-filter_complex_script", join(out, "mix_filter.txt"), "-map", "[a]", "-ar", "48000", "-c:a", "pcm_s16le", join(out, "mix.wav")], { stdio: "inherit" });
  console.log("audio: mix.wav");
}

// ---------------------------------------------------------------- 5. Render
if (stage === "all" || stage === "render") {
  const from = arg("from") ? Number(arg("from")) : undefined; const to = arg("to") ? Number(arg("to")) : undefined;
  const r = await renderTimeline(timeline, { outPath: join(out, from !== undefined ? `video_part_${from}_${to}.mp4` : "video_raw.mp4"), workDir: join(out, "render_work"), chunks: Number(arg("chunks", "3")), preset: arg("preset", "medium"), crf: 18, fromSec: from, toSec: to, onProgress: (d, t) => process.stderr.write(`\rRender ${d}/${t} Frames (${((d / t) * 100).toFixed(0)} %)`) });
  console.log(`\nrender: ${r.frames} Frames in ${r.seconds.toFixed(0)} s`);
}

// ---------------------------------------------------------------- 6. Mux + Untertitel
if (stage === "all" || stage === "mux") {
  await execa(FF, ["-hide_banner", "-loglevel", "error", "-y", "-i", join(out, "video_raw.mp4"), "-i", join(out, "mix.wav"), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-shortest", "-movflags", "+faststart", join(out, "final.mp4")], { stdio: "inherit" });
  const ass = join(out, "captions.ass").replace(/\\/g, "\\\\").replace(/:/g, "\\:");
  await execa(FF, ["-hide_banner", "-loglevel", "error", "-y", "-i", join(out, "final.mp4"), "-vf", `ass='${ass}'`, "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", join(out, "final_untertitelt.mp4")], { stdio: "inherit" });
  console.log("mux: final.mp4, final_untertitelt.mp4");
}

// ---------------------------------------------------------------- 7. Metadaten
if (stage === "all" || stage === "mux" || stage === "meta") {
  const fmt = (s: number) => { const m = Math.floor(s / 60), x = Math.floor(s % 60); return `${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`; };
  const chapters = timeline.chapters!.map((c, i) => ({ start: i === 0 ? 0 : Math.floor(c.start), title: c.title }));
  let sources: string[] = [];
  if (await exists(join(dir, "factbase.json"))) {
    const fb = JSON.parse(await readFile(join(dir, "factbase.json"), "utf8")) as { sources: string[] }[];
    // je Fakt die erste noch nicht genutzte Quelle, höchstens 2 pro Domain -> breite Abdeckung aller Kapitel
    const perDomain = new Map<string, number>();
    for (const f of fb) for (const u of f.sources.filter((x) => /^https?:\/\//.test(x))) {
      const host = new URL(u).hostname.replace(/^www\./, ""); if (sources.includes(u) || (perDomain.get(host) ?? 0) >= 2) continue;
      sources.push(u); perDomain.set(host, (perDomain.get(host) ?? 0) + 1); break;
    }
  }
  const title = arg("title", script.title_candidates[0])!;
  let description = [
    arg("hook", "Was passiert wirklich, wenn das Seil eines Aufzugs reißt? Wir machen die unsichtbare Sicherheitskette sichtbar – vom Tragseil über den Geschwindigkeitsbegrenzer bis zur Fangvorrichtung."),
    "", "Kapitel:", ...chapters.map((c) => `${fmt(c.start)} ${c.title}`),
    "", "Quellen:", ...sources.map((u) => `• ${u}`),
    "", "Hinweis: Alle Animationen sind computergeneriert und stellen technische Prinzipien vereinfacht dar. Die Sprachausgabe ist synthetisch (lokale Open-Source-Stimme). Kein Ersatz für Fachberatung; in Notfällen gilt immer die Anleitung im Aufzug.",
  ].join("\n");
  while (Buffer.byteLength(description, "utf8") > 4600 && sources.length) { sources.pop(); description = description.replace(/\n• [^\n]*(?=\n\nHinweis)/, ""); }
  const meta = { title, title_candidates: script.title_candidates, description, chapters, tags: ["Aufzug", "Fahrstuhl", "Aufzugseil", "Fangvorrichtung", "Geschwindigkeitsbegrenzer", "Elisha Otis", "Technik erklärt", "Was passiert wenn", "Physik", "Ingenieurwesen", "Sicherheit", "Visual Science"], categoryId: "28", defaultLanguage: "de", madeForKids: false, containsSyntheticMedia: false, containsSyntheticMediaNote: "Animationen sind klar erkennbar illustrativ/animiert (keine realistische Darstellung echter Personen/Ereignisse) – laut YouTube-Richtlinie keine Kennzeichnungspflicht; Hinweis steht dennoch in der Beschreibung.", captionsFile: "captions.srt" };
  await writeFile(join(out, "metadata.json"), JSON.stringify(meta, null, 1));
  await writeFile(join(out, "description.txt"), description);
  console.log("meta: metadata.json, description.txt");
}

// ---------------------------------------------------------------- 8. QA
if (stage === "all" || stage === "qa") {
  const file = join(out, "final.mp4");
  const qa = await analyzeMedia(file, { width: 1920, height: 1080, minDurationSec: 540, maxDurationSec: 780 });
  await writeFile(join(out, "qa.json"), JSON.stringify(qa, null, 1));
  console.log(JSON.stringify({ durationSec: qa.durationSec, lufs: qa.integratedLufs, truePeak: qa.truePeakDb, issues: qa.issues }, null, 1));
}
