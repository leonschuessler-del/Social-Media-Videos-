import { chromium } from "playwright-core";
import { CHROMIUM, openEngine } from "./render.ts";
import { startStaticServer } from "./server.ts";
const params = JSON.parse(process.argv[2] ?? "{}");
const dur = 6;
const tl = { fps: 30, width: 1920, height: 1080, chapters: [], scenes: [{ id: "x", start: 0, end: dur, template: "safety_gear", params, text: "", camera: "static", transition: "cut" as const }] };
const srv = await startStaticServer(); const browser = await chromium.launch({ executablePath: CHROMIUM });
const page = await openEngine(browser, srv.url, tl);
const keys = ["fx","back","rail","trace","parts","shell","heat","link","rope","tape","sparks","tags","p1","p2"];
const sets: Record<string, string[]> = { all: [], none: keys };
for (const k of keys) sets["only-" + k] = keys.filter((x) => x !== k);
const code = `(() => {
  const sets = ${JSON.stringify(sets)}; const params = ${JSON.stringify(params)};
  const w = window; const CE = w.CE; const L = CE.lib; const def = CE.templates.safety_gear;
  const cv = document.createElement("canvas"); cv.width = 1920; cv.height = 1080; const ctx = cv.getContext("2d");
  const cv2 = document.createElement("canvas"); cv2.width = 1920; cv2.height = 1080; const c2 = cv2.getContext("2d");
  const out = {};
  function run(sk) {
    w.__SGSKIP = Object.fromEntries(sk.map((k) => [k, true]));
    const n = 90; const t0 = performance.now();
    for (let f = 0; f < n; f++) { const t = (f * 2) / 30; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 1920, 1080); def.draw(ctx, { t, d: 6, u: t / 6, params, text: "", W: 1920, H: 1080, L, K: CE.kit, rng: L.rng("x"), T: t, fps: 30 }); c2.drawImage(cv, 0, 0); }
    c2.getImageData(0, 0, 1, 1);
    return (performance.now() - t0) / n;
  }
  run([]);
  for (const name of Object.keys(sets)) { const a = run(sets[name]), b = run(sets[name]); out[name] = Math.min(a, b); }
  return out;
})()`;
const res = await page.evaluate(code) as Record<string, number>;
for (const [k, v] of Object.entries(res)) console.log(k.padEnd(12), (v as number).toFixed(2));
await browser.close(); await srv.close();
