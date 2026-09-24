/**
 * Frame-Renderer: lädt die Engine in headless Chromium, rendert eine Timeline in N parallelen Chunks
 * (je eigener Browser-Tab + FFmpeg-Prozess) und fügt die Chunks verlustfrei zusammen.
 */
import { chromium, type Browser, type Page } from "playwright-core";
import { execa } from "execa";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startStaticServer } from "./server.ts";

export interface TimelineScene { id: string; start: number; end: number; template: string; params?: Record<string, unknown>; text?: string; camera?: string; chapter?: string; transition?: "fade" | "cut" | "flash" }
export interface Timeline { fps: number; width: number; height: number; scenes: TimelineScene[]; chapters?: { title: string; start: number }[] }

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const CHROMIUM = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";

export async function openEngine(browser: Browser, url: string, timeline: Timeline): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: timeline.width, height: timeline.height }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("[page]", e.message));
  await page.goto(`${url}/index.html`);
  // alle Templates injizieren
  const files = (await readdir(join(ROOT, "web/templates"))).filter((f) => f.endsWith(".js") && f !== "index.js").sort();
  for (const f of files) await page.addScriptTag({ url: `${url}/web/templates/${f}` });
  await page.evaluate(() => (window as unknown as { CE: { fontsReady: () => Promise<boolean> } }).CE.fontsReady());
  await page.evaluate((tl) => (window as unknown as { CE: { init: (t: unknown) => unknown } }).CE.init(tl), timeline as unknown as Record<string, unknown>);
  return page;
}

async function captureFrame(page: Page, frame: number, quality: number): Promise<Buffer> {
  const dataUrl = await page.evaluate(([f, q]) => { const CE = (window as unknown as { CE: { renderFrame: (f: number) => void; capture: (q: number) => string } }).CE; CE.renderFrame(f); return CE.capture(q); }, [frame, quality] as const);
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}

export interface RenderOptions { outPath: string; workDir: string; chunks?: number; quality?: number; crf?: number; preset?: string; fromSec?: number; toSec?: number; onProgress?: (done: number, total: number) => void }

export async function renderTimeline(timeline: Timeline, o: RenderOptions): Promise<{ outPath: string; frames: number; seconds: number }> {
  const t0 = Date.now();
  await mkdir(o.workDir, { recursive: true });
  const duration = timeline.scenes.at(-1)!.end;
  const startF = Math.floor((o.fromSec ?? 0) * timeline.fps);
  const endF = Math.ceil(Math.min(duration, o.toSec ?? duration) * timeline.fps);
  const total = endF - startF;
  const n = Math.max(1, Math.min(o.chunks ?? 3, Math.ceil(total / 60)));
  const srv = await startStaticServer();
  const browser = await chromium.launch({ executablePath: CHROMIUM, args: ["--disable-gpu-vsync", "--disable-frame-rate-limit", "--force-color-profile=srgb"] });
  let done = 0;
  try {
    const per = Math.ceil(total / n);
    const parts = await Promise.all(Array.from({ length: n }, async (_, k) => {
      const a = startF + k * per, b = Math.min(endF, a + per);
      const part = join(o.workDir, `chunk_${String(k).padStart(2, "0")}.mp4`);
      if (a >= b) return undefined;
      const page = await openEngine(browser, srv.url, timeline);
      const ff = execa(process.env.FFMPEG_PATH ?? "ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", String(timeline.fps), "-c:v", "mjpeg", "-i", "-",
        "-c:v", "libx264", "-preset", o.preset ?? "medium", "-crf", String(o.crf ?? 18), "-pix_fmt", "yuv420p", "-r", String(timeline.fps), "-g", String(timeline.fps * 2), part], { stdin: "pipe", stdout: "ignore", stderr: "pipe" });
      for (let f = a; f < b; f++) {
        const jpg = await captureFrame(page, f, o.quality ?? 0.93);
        if (!ff.stdin!.write(jpg)) await new Promise((r) => ff.stdin!.once("drain", r));
        done++; if (done % 150 === 0) o.onProgress?.(done, total);
      }
      ff.stdin!.end(); await ff; await page.close();
      return part;
    }));
    const list = join(o.workDir, "chunks.txt");
    await writeFile(list, parts.filter(Boolean).map((p) => `file '${p}'`).join("\n"));
    await execa(process.env.FFMPEG_PATH ?? "ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", o.outPath]);
  } finally { await browser.close(); await srv.close(); }
  return { outPath: o.outPath, frames: total, seconds: (Date.now() - t0) / 1000 };
}

/** Standbilder einer einzelnen Szene (für Sicht-QA durch Menschen oder Agenten). */
export async function previewScene(scene: Omit<TimelineScene, "start" | "end"> & { duration: number }, atU: number[], outDir: string, fps = 30): Promise<string[]> {
  await mkdir(outDir, { recursive: true });
  const timeline: Timeline = { fps, width: 1920, height: 1080, scenes: [{ ...scene, start: 0, end: scene.duration, transition: "cut" } as TimelineScene], chapters: [] };
  const srv = await startStaticServer();
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const out: string[] = [];
  try {
    const page = await openEngine(browser, srv.url, timeline);
    for (const u of atU) {
      const frame = Math.min(Math.round(u * scene.duration * fps), Math.round(scene.duration * fps) - 1);
      const png = await page.evaluate((f) => { const CE = (window as unknown as { CE: { renderFrame: (f: number) => void; capturePng: () => string } }).CE; CE.renderFrame(f); return CE.capturePng(); }, frame);
      const file = join(outDir, `${scene.id}_u${String(Math.round(u * 100)).padStart(3, "0")}.png`);
      await writeFile(file, Buffer.from(png.slice(png.indexOf(",") + 1), "base64"));
      out.push(file);
    }
  } finally { await browser.close(); await srv.close(); }
  return out;
}

/** Kontaktbogen: mehrere PNGs zu einem Raster (für schnelle Sichtprüfung). */
export async function contactSheet(files: string[], outPath: string, cols = 2): Promise<string> {
  const rows = Math.ceil(files.length / cols);
  const inputs = files.flatMap((f) => ["-i", f]);
  const scaled = files.map((_, i) => `[${i}:v]scale=960:540[s${i}]`).join(";");
  const layout = files.map((_, i) => `${(i % cols) * 960}_${Math.floor(i / cols) * 540}`).join("|");
  await execa(process.env.FFMPEG_PATH ?? "ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...inputs, "-filter_complex", `${scaled};${files.map((_, i) => `[s${i}]`).join("")}xstack=inputs=${files.length}:layout=${layout}:fill=black[o]`, "-map", "[o]", "-frames:v", "1", outPath]);
  void rows;
  return outPath;
}
