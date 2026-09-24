/**
 * Synthetische Medien für Mock-Provider & Tests (offline, kostenlos):
 * - Platzhalterbild (SVG -> PNG) mit Prompt-Text
 * - synthetische "Sprach"-Spur mit Wort-Rhythmus
 * - Ambient-Musik-Pad
 * - kurzer Videoclip aus Bild (Ken Burns)
 */
import sharp from "sharp";
import { runFfmpeg } from "./ffmpeg.ts";
import { createHash } from "node:crypto";

function hashHue(s: string): number {
  return parseInt(createHash("md5").update(s).digest("hex").slice(0, 6), 16) % 360;
}

function wrap(text: string, max = 38): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) { lines.push(cur.trim()); cur = w; } else cur += " " + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.slice(0, 8);
}

export async function placeholderImage(opts: { prompt: string; width: number; height: number; label?: string; style?: string }): Promise<Buffer> {
  const hue = hashHue(opts.prompt);
  const lines = wrap(opts.prompt, opts.width > opts.height ? 44 : 26);
  const fontSize = Math.round(Math.min(opts.width, opts.height) / 22);
  const cx = opts.width / 2;
  const startY = opts.height / 2 - (lines.length * fontSize * 1.3) / 2;
  const textEls = lines.map((l, i) => `<text x="${cx}" y="${startY + i * fontSize * 1.3}" font-size="${fontSize}" fill="#ffffff" text-anchor="middle" font-family="DejaVu Sans, sans-serif">${escapeXml(l)}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.width}" height="${opts.height}">
  <defs>
    <radialGradient id="g" cx="50%" cy="45%" r="75%">
      <stop offset="0%" stop-color="hsl(${hue},55%,32%)"/>
      <stop offset="100%" stop-color="hsl(${(hue + 40) % 360},60%,8%)"/>
    </radialGradient>
    <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
      <path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" fill="url(#grid)"/>
  <circle cx="${cx}" cy="${opts.height / 2}" r="${Math.min(opts.width, opts.height) * 0.38}" fill="none" stroke="rgba(120,220,255,0.35)" stroke-width="6"/>
  <circle cx="${cx}" cy="${opts.height / 2}" r="${Math.min(opts.width, opts.height) * 0.28}" fill="none" stroke="rgba(255,170,80,0.35)" stroke-width="3" stroke-dasharray="14 10"/>
  ${textEls}
  <text x="${cx}" y="${opts.height - fontSize}" font-size="${Math.round(fontSize * 0.7)}" fill="rgba(255,255,255,0.6)" text-anchor="middle" font-family="DejaVu Sans, sans-serif">${escapeXml(opts.label ?? "MOCK VISUAL")}${opts.style ? " · " + escapeXml(opts.style) : ""}</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Synthetische Sprachspur: pro Wort ein kurzer Ton, Pausen an Satzzeichen. Liefert Wort-Zeitstempel. */
export async function synthSpeech(opts: { text: string; outPath: string; wordsPerSecond?: number }): Promise<{ durationSec: number; words: { word: string; startSec: number; endSec: number }[] }> {
  const wps = opts.wordsPerSecond ?? 2.6;
  const tokens = opts.text.split(/\s+/).filter(Boolean);
  const words: { word: string; startSec: number; endSec: number }[] = [];
  let t = 0.25;
  for (const w of tokens) {
    const len = Math.max(0.18, Math.min(0.7, w.length / 7 / wps + 0.1));
    words.push({ word: w, startSec: Number(t.toFixed(3)), endSec: Number((t + len).toFixed(3)) });
    t += len + 0.06;
    if (/[.!?]$/.test(w)) t += 0.35;
    else if (/[,;:]$/.test(w)) t += 0.15;
  }
  const durationSec = Number((t + 0.4).toFixed(2));
  // Amplituden-Hüllkurve: Ton nur während Wörtern (hörbarer Rhythmus, kein echtes Sprechen)
  const env = words.map((w) => `between(t,${w.startSec},${w.endSec})`).join("+");
  const expr = `0.25*sin(2*PI*180*t)*(0.6+0.4*sin(2*PI*6*t))*(${env || "0"})`;
  await runFfmpeg(["-f", "lavfi", "-i", `aevalsrc='${expr}':s=44100:d=${durationSec}`, "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le", opts.outPath]);
  return { durationSec, words };
}

/** Ambient-Pad als Musik-Fallback (eigene Erzeugung, keine Rechteprobleme). */
export async function synthMusic(opts: { outPath: string; durationSec: number; seed?: number }): Promise<void> {
  const base = 110 + ((opts.seed ?? 0) % 5) * 12;
  const expr = `0.08*(sin(2*PI*${base}*t)+0.6*sin(2*PI*${base * 1.5}*t)+0.4*sin(2*PI*${base * 2}*t))*(0.7+0.3*sin(2*PI*0.08*t))`;
  await runFfmpeg(["-f", "lavfi", "-i", `aevalsrc='${expr}':s=44100:d=${opts.durationSec}`, "-ac", "2", "-c:a", "pcm_s16le", opts.outPath]);
}

/** Kurzer Clip aus einem Bild mit Ken-Burns-Bewegung (Mock für Image-to-Video). */
export async function imageToClip(opts: { imagePath: string; outPath: string; durationSec: number; width: number; height: number; fps?: number; zoomDirection?: "in" | "out" }): Promise<void> {
  const fps = opts.fps ?? 30;
  const frames = Math.round(opts.durationSec * fps);
  const zoomExpr = opts.zoomDirection === "out" ? `if(eq(on,1),1.15,max(1.0,zoom-0.0009))` : `min(zoom+0.0009,1.15)`;
  const vf = `scale=${opts.width * 2}:${opts.height * 2}:force_original_aspect_ratio=increase,crop=${opts.width * 2}:${opts.height * 2},zoompan=z='${zoomExpr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${opts.width}x${opts.height}:fps=${fps},format=yuv420p`;
  await runFfmpeg(["-loop", "1", "-i", opts.imagePath, "-vf", vf, "-t", String(opts.durationSec), "-r", String(fps), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-an", opts.outPath]);
}
