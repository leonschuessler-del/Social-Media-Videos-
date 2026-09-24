import { execa } from "execa";
import { probe } from "./ffmpeg.ts";

export interface MediaQaResult {
  durationSec: number;
  width?: number; height?: number; fps?: number;
  blackSegments: { start: number; end: number }[];
  silenceSegments: { start: number; end: number }[];
  integratedLufs?: number;
  truePeakDb?: number;
  clipping: boolean;
  issues: string[];
}

/** Technische Medienprüfung: schwarze Frames, Stille, Lautheit (EBU R128), Clipping, Auflösung. */
export async function analyzeMedia(path: string, expect: { width: number; height: number; minDurationSec?: number; maxDurationSec?: number }): Promise<MediaQaResult> {
  const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
  const info = await probe(path);
  const issues: string[] = [];
  const res = await execa(ffmpeg, ["-hide_banner", "-nostats", "-i", path, "-vf", "blackdetect=d=0.5:pic_th=0.98", "-af", "silencedetect=n=-45dB:d=1.5,ebur128=peak=true", "-f", "null", "-"], { reject: false, maxBuffer: 64 * 1024 * 1024 });
  const log = res.stderr;
  const blackSegments = [...log.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => ({ start: Number(m[1]), end: Number(m[2]) }));
  const silenceStarts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const silenceEnds = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  const silenceSegments = silenceStarts.map((s, i) => ({ start: s, end: silenceEnds[i] ?? info.durationSec }));
  const lufs = log.match(/I:\s+(-?[\d.]+) LUFS/);
  const tp = log.match(/Peak:\s+(-?[\d.]+) dBFS/);
  const integratedLufs = lufs ? Number(lufs[1]) : undefined;
  const truePeakDb = tp ? Number(tp[1]) : undefined;
  const clipping = truePeakDb !== undefined && truePeakDb > -0.5;

  if (info.width !== expect.width || info.height !== expect.height) issues.push(`Auflösung ${info.width}x${info.height} statt ${expect.width}x${expect.height}`);
  if (expect.minDurationSec && info.durationSec < expect.minDurationSec) issues.push(`Zu kurz: ${info.durationSec.toFixed(1)}s < ${expect.minDurationSec}s`);
  if (expect.maxDurationSec && info.durationSec > expect.maxDurationSec) issues.push(`Zu lang: ${info.durationSec.toFixed(1)}s > ${expect.maxDurationSec}s`);
  if (!info.hasAudio) issues.push("Keine Audiospur");
  if (blackSegments.some((b) => b.end - b.start > 0.5 && b.start > 0.2 && b.end < info.durationSec - 0.2)) issues.push(`Schwarze Frames: ${JSON.stringify(blackSegments)}`);
  const midSilence = silenceSegments.filter((s) => s.start > 1 && s.end < info.durationSec - 1 && s.end - s.start > 2.5);
  if (midSilence.length) issues.push(`Lange Stille: ${JSON.stringify(midSilence)}`);
  if (integratedLufs !== undefined && (integratedLufs < -18 || integratedLufs > -11)) issues.push(`Lautheit ${integratedLufs} LUFS außerhalb -14±3`);
  if (clipping) issues.push(`Clipping: True Peak ${truePeakDb} dBFS`);
  return { durationSec: info.durationSec, width: info.width, height: info.height, fps: info.fps, blackSegments, silenceSegments, integratedLufs, truePeakDb, clipping, issues };
}

/** Extrahiert Frames (JPEG) zu Zeitpunkten – für Vision-QA. */
export async function extractFrames(path: string, timesSec: number[], outDir: string): Promise<string[]> {
  const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
  const outs: string[] = [];
  const info = await probe(path);
  for (let i = 0; i < timesSec.length; i++) {
    const out = `${outDir}/frame_${String(i).padStart(2, "0")}.jpg`;
    const t = Math.max(0, Math.min(timesSec[i]!, info.durationSec - 0.2));
    const r = await execa(ffmpeg, ["-hide_banner", "-y", "-ss", t.toFixed(2), "-i", path, "-frames:v", "1", "-q:v", "4", "-vf", "scale=640:-2", out], { reject: false });
    if (r.exitCode === 0) { try { const { access } = await import("node:fs/promises"); await access(out); outs.push(out); } catch { /* Frame fehlt */ } }
  }
  return outs;
}
