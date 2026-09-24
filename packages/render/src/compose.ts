/**
 * Deterministischer Compositor: Timeline (Szenen + Voice + Musik + SFX + Captions + Overlays) -> MP4.
 * Reines FFmpeg (kein Remotion): reproduzierbar, kostenlos, keine Lizenzfrage, läuft in Docker.
 *
 * Pipeline:
 *  1. Pro Szene: Bild -> Ken-Burns-Clip (zoompan) ODER vorhandener Videoclip -> normalisiert (Auflösung/FPS/Dauer)
 *  2. Szenen mit xfade verketten
 *  3. Overlays (drawtext) + Captions (ASS) einbrennen
 *  4. Audio: Voice + Musik (Sidechain-Ducking) + SFX-Mix, loudnorm auf -14 LUFS (YouTube)
 *  5. Mux H.264/AAC, faststart
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { esc, probe, runFfmpeg } from "./ffmpeg.ts";
import { buildAss, type CaptionStyle } from "./captions.ts";
import type { WordTimestamp } from "@content-os/core";

export interface TimelineScene {
  id: string;
  durationSec: number;
  /** genau eins von imagePath / videoPath */
  imagePath?: string;
  videoPath?: string;
  camera?: "push_in" | "pull_out" | "pan_left" | "pan_right" | "static";
  transitionIn?: "cut" | "fade" | "dissolve" | "wipeleft" | "zoom";
  overlay?: { text: string; position: "top" | "bottom" | "center"; style: "label" | "stat" | "title" };
  sfxPath?: string;
  sfxGainDb?: number;
}

export interface TimelineSpec {
  width: number;
  height: number;
  fps: number;
  scenes: TimelineScene[];
  voicePath: string;
  voiceWords?: WordTimestamp[];
  musicPath?: string;
  musicGainDb?: number; // z.B. -18
  duckDb?: number; // z.B. -12 (Musik unter Sprache)
  captions: { mode: "word" | "line" | "none"; style: Omit<CaptionStyle, "playResX" | "playResY"> };
  brand: { fontFile: string; textColor: string; accentColor: string; bgColor: string };
  fadeOutSec?: number;
  workDir: string;
  outPath: string;
  crf?: number;
  preset?: string;
  threads?: number;
}

export interface ComposeResult { outPath: string; durationSec: number; assPath?: string; renderSeconds: number }

const XFADE_MAP: Record<NonNullable<TimelineScene["transitionIn"]>, string | undefined> = { cut: undefined, fade: "fade", dissolve: "dissolve", wipeleft: "wipeleft", zoom: "zoomin" };
const XFADE_DUR = 0.4;

function kenBurns(camera: TimelineScene["camera"], frames: number): string {
  // Sanfte Bewegungen; Bild ist 2x überabgetastet, damit zoompan nicht ruckelt.
  switch (camera) {
    case "pull_out": return `zoompan=z='if(eq(on,1),1.18,max(1.0,zoom-0.0006))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}`;
    case "pan_left": return `zoompan=z='1.12':x='max(0,(iw-iw/zoom)*(1-on/${frames}))':y='ih/2-(ih/zoom/2)':d=${frames}`;
    case "pan_right": return `zoompan=z='1.12':x='min(iw-iw/zoom,(iw-iw/zoom)*(on/${frames}))':y='ih/2-(ih/zoom/2)':d=${frames}`;
    case "static": return `zoompan=z='1.02':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}`;
    default: return `zoompan=z='min(zoom+0.0006,1.18)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}`;
  }
}

async function renderSceneClip(s: TimelineScene, spec: TimelineSpec, idx: number, clipDur: number): Promise<string> {
  const out = join(spec.workDir, `scene_${String(idx).padStart(3, "0")}.mp4`);
  const { width: W, height: H, fps } = spec;
  // +1 Frame Reserve: Clip darf nie kürzer sein als geplant (Frame-Rundung), Überschuss schneidet -t am Ende ab
  const dur = Math.max(0.5, clipDur) + 1 / fps;
  if (s.imagePath) {
    const frames = Math.round(dur * fps);
    const vf = `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W * 2}:${H * 2},${kenBurns(s.camera, frames)}:s=${W}x${H}:fps=${fps},format=yuv420p`;
    await runFfmpeg(["-loop", "1", "-i", s.imagePath, "-vf", vf, "-t", dur.toFixed(3), "-r", String(fps), "-c:v", "libx264", "-preset", "ultrafast", "-crf", "16", "-an", out]);
  } else if (s.videoPath) {
    const info = await probe(s.videoPath);
    // Clip auf Zieldauer bringen: kürzen oder letzten Frame halten (tpad)
    const pad = Math.max(0, dur - info.durationSec);
    const vf = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${fps},tpad=stop_mode=clone:stop_duration=${pad.toFixed(3)},format=yuv420p`;
    await runFfmpeg(["-i", s.videoPath, "-vf", vf, "-t", dur.toFixed(3), "-r", String(fps), "-c:v", "libx264", "-preset", "ultrafast", "-crf", "16", "-an", out]);
  } else {
    throw new Error(`Szene ${s.id}: weder imagePath noch videoPath`);
  }
  return out;
}

function overlayFilter(s: TimelineScene, spec: TimelineSpec, startSec: number, endSec: number): string | undefined {
  if (!s.overlay?.text) return undefined;
  const { width: W, height: H } = spec;
  const size = s.overlay.style === "title" ? Math.round(H / 14) : s.overlay.style === "stat" ? Math.round(H / 11) : Math.round(H / 24);
  const y = s.overlay.position === "top" ? `${Math.round(H * 0.08)}` : s.overlay.position === "center" ? "(h-text_h)/2" : `h-text_h-${Math.round(H * 0.22)}`;
  const box = s.overlay.style === "label" ? `:box=1:boxcolor=${spec.brand.bgColor}@0.55:boxborderw=${Math.round(size * 0.5)}` : "";
  const color = s.overlay.style === "stat" ? spec.brand.accentColor : spec.brand.textColor;
  const fadeIn = 0.3;
  const alpha = `if(lt(t,${startSec.toFixed(2)}),0,if(lt(t,${(startSec + fadeIn).toFixed(2)}),(t-${startSec.toFixed(2)})/${fadeIn},1))`;
  return `drawtext=fontfile='${esc(spec.brand.fontFile)}':text='${esc(s.overlay.text)}':fontsize=${size}:fontcolor=${color}:x=(w-text_w)/2:y=${y}:alpha='${alpha}':enable='between(t,${startSec.toFixed(2)},${endSec.toFixed(2)})'${box}`;
}

export async function composeVideo(spec: TimelineSpec): Promise<ComposeResult> {
  const t0 = Date.now();
  await mkdir(spec.workDir, { recursive: true });
  const { width: W, height: H, fps } = spec;

  // Übergänge: "cut" = xfade mit 1 Frame (vermeidet concat/xfade-Timebase-Mix). Die Überlappung wird dem
  // jeweils folgenden Clip zugeschlagen, damit jede Szene exakt ihre geplante Dauer sichtbar ist (Sync mit Voice).
  const trans = spec.scenes.map((sc, i) => {
    if (i === 0) return { name: "fade", dur: 0 };
    const mapped = XFADE_MAP[sc.transitionIn ?? "dissolve"];
    return { name: mapped ?? "fade", dur: mapped ? XFADE_DUR : 1 / fps };
  });

  // 1) Szenen-Clips (Dauer = Szene + Überlappung des eigenen Eingangs-Übergangs)
  const clips: string[] = [];
  for (let i = 0; i < spec.scenes.length; i++) clips.push(await renderSceneClip(spec.scenes[i]!, spec, i, spec.scenes[i]!.durationSec + trans[i]!.dur));

  // 2) Verkettung mit xfade; Offsets aus geplanten Dauern (frame-genau durch +1-Frame-Reserve je Clip)
  const inputs: string[] = [];
  clips.forEach((c) => inputs.push("-i", c));
  let filter = clips.map((_, i) => `[${i}:v]fps=${fps},format=yuv420p,settb=AVTB[s${i}];`).join("");
  let last = "[s0]";
  let chainLen = spec.scenes[0]!.durationSec; // sichtbare Länge bis hierhin
  const sceneStarts: number[] = [0];
  for (let i = 1; i < clips.length; i++) {
    const { name, dur } = trans[i]!;
    const outLabel = `[v${i}]`;
    const off = Math.max(0, chainLen - dur);
    filter += `${last}[s${i}]xfade=transition=${name}:duration=${dur.toFixed(3)}:offset=${off.toFixed(3)},settb=AVTB${outLabel};`;
    sceneStarts.push(chainLen);
    chainLen += spec.scenes[i]!.durationSec;
    last = outLabel;
  }
  const videoDur = chainLen;

  // 3) Overlays + Captions
  const ov: string[] = [];
  spec.scenes.forEach((s, i) => {
    const st = sceneStarts[i]!;
    const en = i + 1 < sceneStarts.length ? sceneStarts[i + 1]! : videoDur;
    const f = overlayFilter(s, spec, st + 0.2, en - 0.2);
    if (f) ov.push(f);
  });
  let assPath: string | undefined;
  if (spec.captions.mode !== "none" && spec.voiceWords?.length) {
    assPath = join(spec.workDir, "captions.ass");
    await writeFile(assPath, buildAss(spec.voiceWords, { ...spec.captions.style, playResX: W, playResY: H }, { mode: spec.captions.mode }));
    ov.push(`ass='${esc(assPath)}'`);
  }
  if (spec.fadeOutSec) ov.push(`fade=t=out:st=${(videoDur - spec.fadeOutSec).toFixed(2)}:d=${spec.fadeOutSec}`);
  const vchain = ov.length ? `${last}${ov.join(",")}[vout]` : `${last}null[vout]`;
  filter += vchain + ";";

  // 4) Audio
  const vIdx = clips.length;
  inputs.push("-i", spec.voicePath);
  let aFilter = `[${vIdx}:a]aresample=48000,aformat=channel_layouts=stereo,apad=pad_dur=1[voice];`;
  let mixInputs = "[voice]";
  let mixCount = 1;
  if (spec.musicPath) {
    const mIdx = vIdx + 1;
    inputs.push("-stream_loop", "-1", "-i", spec.musicPath);
    const gain = spec.musicGainDb ?? -18;
    const duck = spec.duckDb ?? -12;
    // Sidechain: Musik wird bei Sprache um `duck` dB gesenkt (ratio via threshold/ratio-Kombination)
    aFilter += `[${mIdx}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${(videoDur + 1).toFixed(2)},volume=${gain}dB[music0];`;
    aFilter += `[voice]asplit=2[voice_a][voice_sc];[music0][voice_sc]sidechaincompress=threshold=0.02:ratio=${duck < -9 ? 8 : 4}:attack=40:release=500:makeup=1[music];`;
    mixInputs = "[voice_a][music]";
    mixCount = 2;
  }
  const sfx = spec.scenes.map((s, i) => ({ s, i })).filter(({ s }) => s.sfxPath);
  sfx.forEach(({ s, i }, k) => {
    const idx = inputs.filter((x) => x === "-i").length; // nächster Input-Index
    inputs.push("-i", s.sfxPath!);
    const st = sceneStarts[i]!;
    aFilter += `[${idx}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${s.sfxGainDb ?? -8}dB,adelay=${Math.round(st * 1000)}|${Math.round(st * 1000)}[sfx${k}];`;
    mixInputs += `[sfx${k}]`;
    mixCount++;
  });
  aFilter += `${mixInputs}amix=inputs=${mixCount}:duration=first:dropout_transition=0:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11,atrim=0:${videoDur.toFixed(3)}[aout]`;
  filter += aFilter;

  const filterPath = join(spec.workDir, "filter.txt");
  await writeFile(filterPath, filter);
  await runFfmpeg([
    ...inputs,
    "-filter_complex_script", filterPath,
    "-map", "[vout]", "-map", "[aout]",
    "-t", videoDur.toFixed(3),
    "-r", String(fps),
    "-c:v", "libx264", "-preset", spec.preset ?? "medium", "-crf", String(spec.crf ?? 19), "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.1",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
    "-movflags", "+faststart",
    "-threads", String(spec.threads ?? 4),
    spec.outPath,
  ]);
  const info = await probe(spec.outPath);
  return { outPath: spec.outPath, durationSec: info.durationSec, assPath, renderSeconds: (Date.now() - t0) / 1000 };
}
