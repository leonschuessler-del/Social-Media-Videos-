/* Visual-Science Motion Engine: Timeline -> Frames (deterministisch).
   Timeline = { fps, width, height, scenes: [{ id, start, end, template, params, text, camera, chapter, transition }], chapters: [{ title, start }] }
   Templates registrieren sich via CE.register(name, { draw(ctx, p), ownsText?, background? }). */
(function () {
  const CE = (window.CE = window.CE || {});
  const L = CE.lib;
  CE.templates = CE.templates || {};
  CE.register = (name, def) => { CE.templates[name] = def; };
  CE.W = 1920; CE.H = 1080;

  const main = document.getElementById("c");
  const mctx = main.getContext("2d");
  const offA = document.createElement("canvas"); offA.width = CE.W; offA.height = CE.H;
  const offB = document.createElement("canvas"); offB.width = CE.W; offB.height = CE.H;
  let TL = null;

  CE.init = (timeline) => { TL = timeline; return { scenes: TL.scenes.length, duration: TL.scenes.at(-1)?.end ?? 0 }; };
  CE.fontsReady = async () => { await document.fonts.load('700 40px "Oxanium"'); await document.fonts.load('600 40px "Inter"'); await document.fonts.load('400 40px "Inter"'); await document.fonts.load('800 40px "Inter"'); await document.fonts.load('700 40px "JetBrains Mono"'); await document.fonts.ready; return true; };

  function cameraTransform(ctx, cam, u, focus) {
    const e = L.easeInOut(u); const cx = (focus?.[0] ?? 0.5) * CE.W, cy = (focus?.[1] ?? 0.5) * CE.H;
    let s = 1, dx = 0, dy = 0;
    switch (cam) {
      case "slow_push_in": s = L.lerp(1.0, 1.1, e); break;
      case "slow_pull_out": s = L.lerp(1.1, 1.0, e); break;
      case "pan_left": s = 1.08; dx = L.lerp(60, -60, e); break;
      case "pan_right": s = 1.08; dx = L.lerp(-60, 60, e); break;
      case "tilt_down": s = 1.08; dy = L.lerp(45, -45, e); break;
      case "tilt_up": s = 1.08; dy = L.lerp(-45, 45, e); break;
      default: s = 1;
    }
    ctx.translate(cx + dx, cy + dy); ctx.scale(s, s); ctx.translate(-cx, -cy);
  }

  function drawOverlayText(ctx, text, t, d) {
    if (!text) return;
    const a = L.env(t, 0.5, d - 0.3, 0.45); if (a <= 0) return;
    const size = 40; const x = 90; const y = 150;
    const w = L.measure(ctx, text.toUpperCase(), { size, weight: 700, font: L.FONT.head, letterSpacing: 2 }) + 70;
    const slide = L.easeOut(L.seg(t, 0.5, 0.5));
    ctx.save(); ctx.globalAlpha = a;
    L.fillRect(ctx, x, y - size - 14, 8, size + 34, L.C.amber);
    L.panel(ctx, x + 14, y - size - 14, w * slide, size + 34, { fill: "rgba(4,12,26,0.82)", stroke: L.C.amberSoft, r: 4, alpha: a });
    L.text(ctx, text.toUpperCase(), x + 44, y + 2, { size, weight: 700, font: L.FONT.head, letterSpacing: 2, color: L.C.white, alpha: a * L.seg(t, 0.75, 0.35) });
    ctx.restore();
  }

  function drawChapterBadge(ctx, T) {
    const chs = TL.chapters || []; let cur = null;
    for (const c of chs) if (c.start <= T) cur = c;
    if (!cur) return;
    const t = T - cur.start; const a = L.env(t, 0.3, 4.3, 0.5); if (a <= 0) return;
    const idx = chs.indexOf(cur) + 1;
    ctx.save(); ctx.globalAlpha = a;
    const label = `KAPITEL ${String(idx).padStart(2, "0")}`;
    L.text(ctx, label, CE.W - 90, 90, { size: 22, weight: 700, font: L.FONT.mono, color: L.C.amber, align: "right", letterSpacing: 3, alpha: a });
    L.text(ctx, cur.title, CE.W - 90, 132, { size: 34, weight: 700, font: L.FONT.head, color: L.C.white, align: "right", alpha: a, glow: 12 });
    L.line(ctx, CE.W - 90 - 300 * L.easeOut(L.seg(t, 0.3, 0.8)), 150, CE.W - 90, 150, L.C.cyan, 2, 1, { alpha: a });
    ctx.restore();
  }

  function renderScene(canvas, scene, T) {
    const ctx = canvas.getContext("2d");
    const d = scene.end - scene.start; const tRaw = T - scene.start; const t = Math.max(0, tRaw);
    const u = L.clamp(t / d);
    const def = CE.templates[scene.template];
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    if (!def || def.background !== false) L.background(ctx, CE.W, CE.H, T);
    ctx.save();
    cameraTransform(ctx, scene.camera, u, scene.params?.focus);
    const rng = L.rng(scene.id);
    const p = { t, d, u, params: scene.params || {}, text: scene.text || "", W: CE.W, H: CE.H, L, K: CE.kit, rng, T, fps: TL.fps, scene };
    try {
      if (def) def.draw(ctx, p);
      else { L.heading(ctx, `TEMPLATE FEHLT: ${scene.template}`, CE.W / 2, CE.H / 2, { size: 48, color: L.C.red }); }
    } catch (e) {
      ctx.restore(); ctx.save();
      L.text(ctx, `Fehler in ${scene.template}: ${e.message}`, 80, CE.H - 80, { size: 28, color: L.C.red });
    }
    ctx.restore();
    if (!def?.ownsText) drawOverlayText(ctx, scene.text, t, d);
  }

  const TRANS = 0.6;
  CE.renderAt = (T) => {
    const scenes = TL.scenes;
    let i = scenes.findIndex((s) => T >= s.start && T < s.end); if (i < 0) i = T < scenes[0].start ? 0 : scenes.length - 1;
    const cur = scenes[i]; const next = scenes[i + 1]; const prev = scenes[i - 1];
    // Übergang: im Fenster [start - TRANS/2, start + TRANS/2] mischen
    let from = null, to = cur, alpha = 1;
    if (prev && T < cur.start + TRANS / 2 && cur.transition !== "cut") { from = prev; alpha = L.smooth((T - (cur.start - TRANS / 2)) / TRANS); }
    else if (next && T >= next.start - TRANS / 2 && next.transition !== "cut") { from = cur; to = next; alpha = L.smooth((T - (next.start - TRANS / 2)) / TRANS); }
    mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.globalAlpha = 1;
    if (from) {
      renderScene(offA, from, T); renderScene(offB, to, T);
      mctx.drawImage(offA, 0, 0); mctx.globalAlpha = alpha; mctx.drawImage(offB, 0, 0); mctx.globalAlpha = 1;
      if (to.transition === "flash") { mctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - Math.abs(alpha - 0.5) * 2)})`; mctx.fillRect(0, 0, CE.W, CE.H); }
    } else { renderScene(offA, to, T); mctx.drawImage(offA, 0, 0); }
    drawChapterBadge(mctx, T);
    L.vignette(mctx, CE.W, CE.H, 0.5);
  };
  CE.renderFrame = (frame) => CE.renderAt(frame / TL.fps);
  CE.capture = (quality = 0.92) => main.toDataURL("image/jpeg", quality);
  CE.capturePng = () => main.toDataURL("image/png");
})();
