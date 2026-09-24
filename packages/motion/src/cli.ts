/**
 * Motion-CLI
 *   preview <template> --params '{"k":1}' [--text "…"] [--camera static] [--duration 8] [--at 0.1,0.4,0.7,0.95] --out <dir>
 *   render  <timeline.json> --out <file.mp4> [--chunks 3] [--from 0 --to 30]
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { contactSheet, previewScene, renderTimeline, type Timeline } from "./render.ts";

const [cmd, arg, ...rest] = process.argv.slice(2);
const opt = (k: string, d?: string) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? rest[i + 1] : d; };

if (cmd === "preview") {
  const out = opt("out", "/tmp/motion-preview")!;
  const at = (opt("at", "0.1,0.4,0.7,0.95") ?? "").split(",").map(Number);
  const files = await previewScene({ id: arg ?? "debug", template: arg ?? "debug", params: JSON.parse(opt("params", "{}")!), text: opt("text", ""), camera: opt("camera", "static"), duration: Number(opt("duration", "8")) }, at, out);
  const sheet = await contactSheet(files, join(out, `${arg}_sheet.png`), 2);
  console.log(JSON.stringify({ frames: files, sheet }, null, 1));
} else if (cmd === "bench") {
  // ms pro Frame für ein Template (Ziel: < 40 ms)
  const { chromium } = await import("playwright-core");
  const { CHROMIUM, openEngine } = await import("./render.ts");
  const { startStaticServer } = await import("./server.ts");
  const dur = Number(opt("duration", "6"));
  const tl = { fps: 30, width: 1920, height: 1080, chapters: [], scenes: [{ id: arg ?? "debug", start: 0, end: dur, template: arg ?? "debug", params: JSON.parse(opt("params", "{}")!), text: opt("text", ""), camera: opt("camera", "static"), transition: "cut" as const }] };
  const srv = await startStaticServer(); const browser = await chromium.launch({ executablePath: CHROMIUM });
  const page = await openEngine(browser, srv.url, tl);
  const ms = await page.evaluate((n) => { const CE = (window as unknown as { CE: { renderFrame: (f: number) => void; capture: (q: number) => string } }).CE; const t0 = performance.now(); for (let f = 0; f < n; f++) { CE.renderFrame(f); } const t1 = performance.now(); CE.capture(0.93); return { drawMsPerFrame: (t1 - t0) / n }; }, Math.round(dur * 30));
  await browser.close(); await srv.close();
  console.log(JSON.stringify({ template: arg, ...ms, verdict: ms.drawMsPerFrame < 40 ? "OK" : "ZU LANGSAM (< 40 ms Ziel)" }));
} else if (cmd === "render") {
  const tl = JSON.parse(await readFile(arg!, "utf8")) as Timeline;
  const out = opt("out", "/tmp/motion.mp4")!;
  const r = await renderTimeline(tl, { outPath: out, workDir: `${out}.work`, chunks: Number(opt("chunks", "3")), fromSec: opt("from") ? Number(opt("from")) : undefined, toSec: opt("to") ? Number(opt("to")) : undefined, preset: opt("preset", "medium"), onProgress: (d, t) => process.stderr.write(`\r${d}/${t} Frames`) });
  console.log(JSON.stringify(r));
} else {
  console.log("Befehle: preview <template> …, render <timeline.json> …");
}
