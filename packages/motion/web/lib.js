/* Visual-Science Motion Library – deterministische Zeichen-Primitive (Canvas 2D).
   Stil: Röntgen/Blueprint – leuchtende Cyan-/Amber-Linien auf dunklem Navy. */
(function () {
  const L = {};
  L.C = {
    bg0: "#040a16", bg1: "#0a1830", grid: "rgba(80,170,255,0.07)", gridStrong: "rgba(80,170,255,0.14)",
    cyan: "#3fd2ff", cyanSoft: "rgba(63,210,255,0.35)", cyanDim: "rgba(63,210,255,0.16)",
    amber: "#ffb347", amberSoft: "rgba(255,179,71,0.35)", red: "#ff5a5f", redSoft: "rgba(255,90,95,0.35)",
    green: "#5be49b", white: "#eef6ff", muted: "#8fb3d9", steel: "#9fc4e6", panel: "rgba(8,22,44,0.78)",
  };
  L.FONT = { head: "Oxanium", body: "Inter", mono: "JetBrains Mono" };

  // ---------- Mathe / Easing ----------
  L.clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  L.lerp = (a, b, t) => a + (b - a) * t;
  L.inv = (a, b, x) => L.clamp((x - a) / (b - a));
  L.smooth = (t) => { t = L.clamp(t); return t * t * (3 - 2 * t); };
  L.easeInOut = (t) => { t = L.clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  L.easeOut = (t) => 1 - Math.pow(1 - L.clamp(t), 3);
  L.easeIn = (t) => Math.pow(L.clamp(t), 3);
  L.easeOutBack = (t) => { t = L.clamp(t); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  L.easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * L.clamp(t)));
  /** Fortschritt eines Abschnitts: 0 vor `start`, 1 nach `start+dur` (Sekunden). */
  L.seg = (t, start, dur) => L.clamp((t - start) / Math.max(1e-6, dur));
  /** Ein-/Ausblende-Hüllkurve für Elemente, die in [a,b] sichtbar sind. */
  L.env = (t, a, b, fade = 0.4) => Math.min(L.seg(t, a, fade), 1 - L.seg(t, b - fade, fade));
  L.pulse = (t, speed = 2) => 0.5 + 0.5 * Math.sin(t * Math.PI * speed);

  // ---------- Deterministischer Zufall ----------
  L.rng = (seed) => { let s = 0; for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0; s = s || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
  L.hash01 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // ---------- Hintergrund ----------
  L.background = (ctx, W, H, t = 0, opts = {}) => {
    const g = ctx.createRadialGradient(W * 0.5, H * 0.45, 50, W * 0.5, H * 0.5, W * 0.75);
    g.addColorStop(0, opts.center || L.C.bg1); g.addColorStop(1, L.C.bg0);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (opts.grid !== false) L.grid(ctx, W, H, opts.gridSize || 60, t);
  };
  L.grid = (ctx, W, H, size = 60, t = 0) => {
    ctx.save(); ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += size) { ctx.strokeStyle = (x / size) % 5 === 0 ? L.C.gridStrong : L.C.grid; ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += size) { ctx.strokeStyle = (y / size) % 5 === 0 ? L.C.gridStrong : L.C.grid; ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
    ctx.restore();
  };
  L.vignette = (ctx, W, H, strength = 0.55) => {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.72);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  };

  // ---------- Glühende Linien (günstiger Fake-Glow ohne shadowBlur) ----------
  L.glowPath = (ctx, build, color = L.C.cyan, width = 3, glow = 1, opts = {}) => {
    ctx.save(); ctx.lineCap = opts.cap || "round"; ctx.lineJoin = "round";
    if (opts.dash) ctx.setLineDash(opts.dash);
    if (glow > 0) {
      ctx.globalAlpha = (opts.alpha ?? 1) * 0.10 * glow; ctx.strokeStyle = color; ctx.lineWidth = width * 7; ctx.beginPath(); build(ctx); ctx.stroke();
      ctx.globalAlpha = (opts.alpha ?? 1) * 0.22 * glow; ctx.lineWidth = width * 3.2; ctx.beginPath(); build(ctx); ctx.stroke();
    }
    ctx.globalAlpha = opts.alpha ?? 1; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); build(ctx); ctx.stroke();
    ctx.restore();
  };
  L.line = (ctx, x1, y1, x2, y2, color, width = 2, glow = 1, opts) => L.glowPath(ctx, (c) => { c.moveTo(x1, y1); c.lineTo(x2, y2); }, color, width, glow, opts);
  L.poly = (ctx, pts, color, width = 2, glow = 1, opts = {}) => L.glowPath(ctx, (c) => { pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); if (opts.close) c.closePath(); }, color, width, glow, opts);
  L.rect = (ctx, x, y, w, h, color, width = 2, glow = 1, opts) => L.glowPath(ctx, (c) => c.rect(x, y, w, h), color, width, glow, opts);
  L.circle = (ctx, x, y, r, color, width = 2, glow = 1, opts) => L.glowPath(ctx, (c) => c.arc(x, y, r, 0, Math.PI * 2), color, width, glow, opts);
  L.arc = (ctx, x, y, r, a0, a1, color, width = 2, glow = 1, opts) => L.glowPath(ctx, (c) => c.arc(x, y, r, a0, a1), color, width, glow, opts);
  L.fillRect = (ctx, x, y, w, h, fill) => { ctx.save(); ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); ctx.restore(); };
  L.fillCircle = (ctx, x, y, r, fill) => { ctx.save(); ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore(); };
  L.roundRectPath = (c, x, y, w, h, r) => { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  L.panel = (ctx, x, y, w, h, opts = {}) => {
    ctx.save(); ctx.globalAlpha = opts.alpha ?? 1; ctx.fillStyle = opts.fill || L.C.panel; ctx.beginPath(); L.roundRectPath(ctx, x, y, w, h, opts.r ?? 14); ctx.fill(); ctx.restore();
    L.glowPath(ctx, (c) => L.roundRectPath(c, x, y, w, h, opts.r ?? 14), opts.stroke || L.C.cyanSoft, 1.5, 0.6, { alpha: opts.alpha ?? 1 });
  };
  /** Weicher Lichtpunkt (radialer Verlauf) – für Glühen, Funken, Highlights. */
  L.glowDot = (ctx, x, y, r, color = L.C.cyan, alpha = 1) => {
    ctx.save(); ctx.globalAlpha = alpha; const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(0.25, color.startsWith("#") ? color + "99" : color); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  /** Gestrichelte Linie mit laufender Bewegung (Energiefluss, Kraftlinien). */
  L.flowLine = (ctx, x1, y1, x2, y2, t, color = L.C.cyan, width = 2, speed = 60) => L.line(ctx, x1, y1, x2, y2, color, width, 0.8, { dash: [14, 12], dashOffset: -t * speed });
  L.arrow = (ctx, x1, y1, x2, y2, color = L.C.amber, width = 4, head = 18, alpha = 1) => {
    const a = Math.atan2(y2 - y1, x2 - x1);
    L.line(ctx, x1, y1, x2 - Math.cos(a) * head * 0.6, y2 - Math.sin(a) * head * 0.6, color, width, 1, { alpha });
    L.poly(ctx, [[x2, y2], [x2 - Math.cos(a - 0.45) * head, y2 - Math.sin(a - 0.45) * head], [x2 - Math.cos(a + 0.45) * head, y2 - Math.sin(a + 0.45) * head]], color, width * 0.8, 1, { close: true, alpha });
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - Math.cos(a - 0.45) * head, y2 - Math.sin(a - 0.45) * head); ctx.lineTo(x2 - Math.cos(a + 0.45) * head, y2 - Math.sin(a + 0.45) * head); ctx.closePath(); ctx.fill(); ctx.restore();
  };

  // ---------- Text ----------
  L.text = (ctx, str, x, y, o = {}) => {
    ctx.save();
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.font = `${o.weight || 600} ${o.size || 40}px "${o.font || L.FONT.body}"`;
    ctx.textAlign = o.align || "left"; ctx.textBaseline = o.baseline || "alphabetic";
    if (o.letterSpacing) ctx.letterSpacing = `${o.letterSpacing}px`;
    if (o.glow) { ctx.shadowColor = o.glowColor || o.color || L.C.cyan; ctx.shadowBlur = o.glow; }
    if (o.stroke) { ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor || "rgba(0,0,0,0.85)"; ctx.lineJoin = "round"; ctx.strokeText(str, x, y); }
    ctx.fillStyle = o.color || L.C.white; ctx.fillText(str, x, y);
    ctx.restore();
  };
  L.measure = (ctx, str, o = {}) => { ctx.save(); ctx.font = `${o.weight || 600} ${o.size || 40}px "${o.font || L.FONT.body}"`; if (o.letterSpacing) ctx.letterSpacing = `${o.letterSpacing}px`; const w = ctx.measureText(str).width; ctx.restore(); return w; };
  /** Umbruch nach Breite, gibt Zeilen zurück. */
  L.wrap = (ctx, str, maxW, o = {}) => { const words = String(str).split(/\s+/); const lines = []; let cur = ""; for (const w of words) { const test = cur ? cur + " " + w : w; if (L.measure(ctx, test, o) > maxW && cur) { lines.push(cur); cur = w; } else cur = test; } if (cur) lines.push(cur); return lines; };
  /** Schreibmaschinen-Einblendung. */
  L.typeText = (ctx, str, x, y, progress, o = {}) => L.text(ctx, str.slice(0, Math.round(str.length * L.clamp(progress))), x, y, o);
  /** Überschrift im Kanal-Stil (Versalien, Oxanium, Glow). */
  L.heading = (ctx, str, x, y, o = {}) => L.text(ctx, String(str).toUpperCase(), x, y, { font: L.FONT.head, weight: 700, size: o.size || 64, color: o.color || L.C.white, glow: o.glow ?? 18, glowColor: o.glowColor || L.C.cyan, letterSpacing: o.letterSpacing ?? 3, align: o.align || "center", alpha: o.alpha });
  /** Zählender Zahlenwert. */
  L.counter = (ctx, from, to, progress, x, y, o = {}) => { const v = L.lerp(from, to, L.easeOut(progress)); const s = (o.decimals ? v.toFixed(o.decimals) : Math.round(v).toString()).replace(".", ","); L.text(ctx, (o.prefix || "") + s + (o.suffix || ""), x, y, { font: L.FONT.mono, weight: 700, size: o.size || 160, color: o.color || L.C.amber, glow: o.glow ?? 24, align: o.align || "center", alpha: o.alpha }); };

  // ---------- Callout / Label mit Führungslinie ----------
  L.callout = (ctx, px, py, lx, ly, label, progress, o = {}) => {
    const p = L.clamp(progress); if (p <= 0) return;
    const color = o.color || L.C.cyan;
    L.glowDot(ctx, px, py, 14, color, p);
    L.fillCircle(ctx, px, py, 4, color);
    const mx = lx, my = ly; const lp = L.easeOut(L.inv(0, 0.5, p));
    L.line(ctx, px, py, L.lerp(px, mx, lp), L.lerp(py, my, lp), color, 1.8, 0.7, { alpha: p });
    const tp = L.inv(0.4, 1, p); if (tp <= 0) return;
    const size = o.size || 30; const w = L.measure(ctx, label, { size, weight: 600 }) + 36; const h = size + 24;
    const bx = o.align === "right" ? mx - w : mx; const by = my - h / 2;
    L.panel(ctx, bx, by, w * L.easeOut(tp), h, { alpha: tp, stroke: color === L.C.amber ? L.C.amberSoft : L.C.cyanSoft, r: 8 });
    L.text(ctx, label, bx + 18, my + size * 0.36, { size, weight: 600, color: L.C.white, alpha: L.inv(0.6, 1, p) });
  };

  // ---------- Partikel (Funken, Staub) ----------
  L.sparks = (ctx, x, y, t, o = {}) => {
    const n = o.count || 40, seed = o.seed || 1, life = o.life || 0.6, spread = o.spread ?? Math.PI, dir = o.dir ?? -Math.PI / 2, speed = o.speed || 520, g = o.gravity ?? 900;
    for (let i = 0; i < n; i++) {
      const born = (L.hash01(seed * 97 + i) * (o.window || 1.0));
      const age = t - born; if (age < 0 || age > life) continue;
      const ang = dir + (L.hash01(seed * 13 + i * 7) - 0.5) * spread; const sp = speed * (0.4 + 0.6 * L.hash01(seed * 5 + i * 3));
      const px = x + Math.cos(ang) * sp * age, py = y + Math.sin(ang) * sp * age + 0.5 * g * age * age;
      const a = 1 - age / life; const len = 10 + 20 * a;
      L.line(ctx, px, py, px - Math.cos(ang) * len, py - (Math.sin(ang) * len + g * age * 0.02), i % 3 ? L.C.amber : "#ffe3a8", 2, 1, { alpha: a });
    }
  };
  L.dust = (ctx, W, H, t, o = {}) => { const n = o.count || 60; for (let i = 0; i < n; i++) { const x = (L.hash01(i * 3.1) * W + t * 8 * (0.5 + L.hash01(i))) % W; const y = (L.hash01(i * 7.7) * H + Math.sin(t * 0.5 + i) * 12); L.glowDot(ctx, x, y, 2 + 3 * L.hash01(i * 1.3), L.C.cyanSoft, 0.35 + 0.3 * Math.sin(t + i)); } };

  // ---------- Diagramm ----------
  L.chart = (ctx, x, y, w, h, o) => {
    const { xMin = 0, xMax = 1, yMin = 0, yMax = 1, series = [], progress = 1 } = o;
    L.line(ctx, x, y + h, x + w, y + h, L.C.muted, 2, 0.3); L.line(ctx, x, y, x, y + h, L.C.muted, 2, 0.3);
    for (let i = 1; i <= 4; i++) L.line(ctx, x, y + h - (h * i) / 4, x + w, y + h - (h * i) / 4, "rgba(143,179,217,0.18)", 1, 0);
    if (o.xLabel) L.text(ctx, o.xLabel, x + w, y + h + 50, { size: 26, color: L.C.muted, align: "right", weight: 400 });
    if (o.yLabel) L.text(ctx, o.yLabel, x - 20, y - 20, { size: 26, color: L.C.muted, weight: 400 });
    (o.yTicks || []).forEach((v) => { const py = y + h - ((v - yMin) / (yMax - yMin)) * h; L.text(ctx, String(v).replace(".", ","), x - 16, py + 9, { size: 22, color: L.C.muted, align: "right", weight: 400, font: L.FONT.mono }); });
    (o.xTicks || []).forEach((v) => { const px = x + ((v - xMin) / (xMax - xMin)) * w; L.text(ctx, String(v).replace(".", ","), px, y + h + 34, { size: 22, color: L.C.muted, align: "center", weight: 400, font: L.FONT.mono }); });
    series.forEach((s) => {
      const pts = s.points.map(([px, py]) => [x + ((px - xMin) / (xMax - xMin)) * w, y + h - ((py - yMin) / (yMax - yMin)) * h]);
      const n = Math.max(2, Math.ceil(pts.length * L.clamp(progress)));
      L.poly(ctx, pts.slice(0, n), s.color || L.C.cyan, 4, 1);
      const last = pts[n - 1]; if (last) L.glowDot(ctx, last[0], last[1], 16, s.color || L.C.cyan);
      if (s.label && last) L.text(ctx, s.label, last[0] + 16, last[1] - 14, { size: 26, color: s.color || L.C.cyan, weight: 600 });
    });
  };

  // ---------- Silhouette (Person, stilisiert, ohne Gesicht) ----------
  L.person = (ctx, x, y, h, color = L.C.steel, alpha = 1) => {
    const s = h / 180; ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y - 165 * s, 15 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); L.roundRectPath(ctx, x - 22 * s, y - 145 * s, 44 * s, 75 * s, 12 * s); ctx.fill();
    ctx.fillRect(x - 20 * s, y - 75 * s, 16 * s, 75 * s); ctx.fillRect(x + 4 * s, y - 75 * s, 16 * s, 75 * s);
    ctx.restore();
  };

  window.CE = window.CE || {};
  window.CE.lib = L;
})();
