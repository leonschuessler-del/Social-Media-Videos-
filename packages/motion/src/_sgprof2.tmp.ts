import { chromium } from "playwright-core";
import { CHROMIUM, openEngine } from "./render.ts";
import { startStaticServer } from "./server.ts";
const tl = { fps: 30, width: 1920, height: 1080, chapters: [], scenes: [{ id: "x", start: 0, end: 6, template: "debug", params: {}, text: "", camera: "static", transition: "cut" as const }] };
const srv = await startStaticServer(); const browser = await chromium.launch({ executablePath: CHROMIUM });
const page = await openEngine(browser, srv.url, tl);
const code = `(() => {
  const L = CE.lib;
  const cv = document.createElement("canvas"); cv.width = 1920; cv.height = 1080; const ctx = cv.getContext("2d");
  const cv2 = document.createElement("canvas"); cv2.width = 1920; cv2.height = 1080; const c2 = cv2.getContext("2d");
  const sp = document.createElement("canvas"); sp.width = 600; sp.height = 450; const sg = sp.getContext("2d"); sg.fillStyle = "rgba(20,40,80,0.8)"; sg.fillRect(0,0,600,450);
  const out = {};
  function bench(name, fn, n = 60) {
    for (let f = 0; f < 5; f++) { ctx.fillRect(0,0,1920,1080); fn(f); c2.drawImage(cv, 0, 0); } c2.getImageData(0,0,1,1);
    const t0 = performance.now();
    for (let f = 0; f < n; f++) { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 1920, 1080); fn(f); c2.drawImage(cv, 0, 0); }
    c2.getImageData(0, 0, 1, 1);
    out[name] = ((performance.now() - t0) / n).toFixed(2);
  }
  bench("base", () => {});
  bench("10x drawImage 600x450", () => { for (let i = 0; i < 10; i++) ctx.drawImage(sp, i * 100, 100); });
  bench("10x drawImage 600x450 alpha", () => { ctx.globalAlpha = 0.7; for (let i = 0; i < 10; i++) ctx.drawImage(sp, i * 100, 100); ctx.globalAlpha = 1; });
  bench("100 small strokes", () => { ctx.strokeStyle = "#3fd2ff"; ctx.lineWidth = 2; for (let i = 0; i < 100; i++) { ctx.beginPath(); ctx.moveTo(i * 10, 100); ctx.lineTo(i * 10 + 50, 200); ctx.stroke(); } });
  bench("100 save/restore strokes", () => { for (let i = 0; i < 100; i++) { ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = "#3fd2ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(i * 10, 100); ctx.lineTo(i * 10 + 50, 200); ctx.stroke(); ctx.restore(); } });
  bench("100 texts", () => { for (let i = 0; i < 100; i++) L.text(ctx, "Tellerfederpaket", (i % 10) * 180, 100 + Math.floor(i / 10) * 60, { size: 22, weight: 600 }); });
  bench("100 small drawImage", () => { for (let i = 0; i < 100; i++) ctx.drawImage(sp, 0, 0, 200, 40, (i % 10) * 180, 100 + Math.floor(i / 10) * 60, 200, 40); });
  bench("100 radial dots r40", () => { for (let i = 0; i < 100; i++) { const g = ctx.createRadialGradient(i*15, 300, 0, i*15, 300, 40); g.addColorStop(0, "rgba(255,179,71,0.9)"); g.addColorStop(1, "rgba(255,179,71,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(i*15, 300, 40, 0, 6.283); ctx.fill(); } });
  bench("10 fullscreen fills alpha", () => { ctx.fillStyle = "rgba(10,20,40,0.3)"; for (let i = 0; i < 10; i++) ctx.fillRect(0, 0, 1920, 1080); });
  bench("20 wide glow strokes 1000px", () => { ctx.strokeStyle = "rgba(63,210,255,0.2)"; ctx.lineWidth = 8; for (let i = 0; i < 20; i++) { ctx.beginPath(); ctx.moveTo(100 + i * 20, 50); ctx.lineTo(100 + i * 20, 1050); ctx.stroke(); } });
  bench("20 pattern fills 400x300", () => { const c = document.createElement("canvas"); c.width = c.height = 10; const g = c.getContext("2d"); g.strokeStyle = "#3fd2ff"; g.beginPath(); g.moveTo(0,10); g.lineTo(10,0); g.stroke(); const pat = ctx.createPattern(c, "repeat"); ctx.fillStyle = pat; for (let i = 0; i < 20; i++) ctx.fillRect(100 + i * 10, 100, 400, 300); });
  return out;
})()`;
console.log(await page.evaluate(code));
await browser.close(); await srv.close();
