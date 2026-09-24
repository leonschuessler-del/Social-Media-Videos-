import { execa } from "execa";
import { ContentOsError, logger } from "@content-os/core";

export interface FfmpegOptions { ffmpegPath?: string; ffprobePath?: string; timeoutMs?: number }

const FFMPEG = () => process.env.FFMPEG_PATH ?? "ffmpeg";
const FFPROBE = () => process.env.FFPROBE_PATH ?? "ffprobe";

export async function runFfmpeg(args: string[], opts: FfmpegOptions = {}): Promise<{ stderr: string; durationMs: number }> {
  const started = Date.now();
  const bin = opts.ffmpegPath ?? FFMPEG();
  logger.debug({ bin, args: args.join(" ").slice(0, 2000) }, "ffmpeg");
  try {
    const res = await execa(bin, ["-hide_banner", "-nostdin", "-y", ...args], { timeout: opts.timeoutMs ?? 30 * 60_000, maxBuffer: 64 * 1024 * 1024 });
    return { stderr: res.stderr, durationMs: Date.now() - started };
  } catch (err) {
    const e = err as { stderr?: string; shortMessage?: string };
    throw new ContentOsError("RENDER_FAILED", `ffmpeg fehlgeschlagen: ${e.shortMessage ?? String(err)}\n${(e.stderr ?? "").slice(-4000)}`, { cause: err });
  }
}

export interface ProbeInfo {
  durationSec: number;
  width?: number;
  height?: number;
  fps?: number;
  videoCodec?: string;
  audioCodec?: string;
  sampleRate?: number;
  channels?: number;
  bitrate?: number;
  hasVideo: boolean;
  hasAudio: boolean;
}

export async function probe(path: string, opts: FfmpegOptions = {}): Promise<ProbeInfo> {
  const bin = opts.ffprobePath ?? FFPROBE();
  const res = await execa(bin, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", path]);
  const j = JSON.parse(res.stdout) as { format?: { duration?: string; bit_rate?: string }; streams?: Record<string, string | number>[] };
  const v = j.streams?.find((s) => s.codec_type === "video");
  const a = j.streams?.find((s) => s.codec_type === "audio");
  const fps = v?.r_frame_rate ? (() => { const [n, d] = String(v.r_frame_rate).split("/").map(Number); return d ? n! / d : n; })() : undefined;
  return {
    durationSec: Number(j.format?.duration ?? 0),
    width: v ? Number(v.width) : undefined,
    height: v ? Number(v.height) : undefined,
    fps,
    videoCodec: v ? String(v.codec_name) : undefined,
    audioCodec: a ? String(a.codec_name) : undefined,
    sampleRate: a ? Number(a.sample_rate) : undefined,
    channels: a ? Number(a.channels) : undefined,
    bitrate: j.format?.bit_rate ? Number(j.format.bit_rate) : undefined,
    hasVideo: !!v,
    hasAudio: !!a,
  };
}

/** Escaped Pfad/Text für FFmpeg-Filtergraphen. */
export function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'").replace(/,/g, "\\,").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}
