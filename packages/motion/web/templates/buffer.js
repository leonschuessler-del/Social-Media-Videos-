/* Template "buffer" – Schachtgrube in Nahaufnahme: Puffer unter dem Fahrkorb (Röntgen-/Blueprint-Stil).
   Der Fahrkorb (Unterholm, Pufferstempel, Anschlagplatte) senkt sich, setzt auf dem Puffer auf und drückt ihn ein.
   Typen:
     hydraulic     Hydraulikpuffer (energieverzehrend): Kolbenstange drückt Öl durch Drosselbohrungen im Innenrohr,
                   die der Kolben nacheinander überfährt -> nahezu konstante Verzögerung; Energie wird zu Wärme.
                   Rückstellfeder schiebt den Kolben nach Entlastung langsam zurück (Öl strömt zurück).
     spring        Federpuffer (energiespeichernd, lineare Kennlinie): Schraubendruckfeder, deutlicher Rückprall.
     polyurethane  PU-Puffer (energiespeichernd, nichtlinear): Elastomerblock wölbt sich aus, Rückprall gedämpft.
   Params:
     type      "hydraulic" | "spring" | "polyurethane" (Default hydraulic; Aliase: öl, hydraulik, feder, pu, elastomer …)
     compress  bool (Default true) – Aufprall + Einfedern; false = Normalbetrieb, Puffer entlastet (Pufferabstand)
     return    bool (nur hydraulic, Default: an bei d >= 7 s) – Fahrkorb wird angehoben, Kolben fährt langsam aus
     labels    bool (Default true) – Beschriftungen am Puffer
     panel     bool (Default true) – Infotafel rechts (Messwerte, Energiebilanz, Kraft-Weg-Kennlinie)
   Physik (Beispielwerte, m = 1.600 kg, simuliert in physikalischer Zeit, Zeitlupe relativ zu d):
     hydraulic   Aufprall 1,84 m/s (115 % von 1,6 m/s), Hub 250 mm, Verzögerung ca. 0,75 g (kurze Spitze ~1,1 g)
     spring      Aufprall 1,15 m/s (115 % von 1,0 m/s), c = 350 kN/m, Federweg ca. 128 mm, Rückprall
     polyureth.  Aufprall 1,15 m/s, progressive Kennlinie mit Hysterese, Einfederung ca. 103 mm */
(function () {
  "use strict";
  const CE = window.CE;
  if (!CE || typeof CE.register !== "function") return;

  const TAU = Math.PI * 2, GN = 9.81;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const inv = (a, b, x) => clamp((x - a) / ((b - a) || 1e-6));
  const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const h01 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const frac = (x) => x - Math.floor(x);
  const fmt = (v, dec) => { const f = Math.pow(10, dec); let s = (Math.round(v * f) / f).toFixed(dec); if (/^-0(\.0+)?$/.test(s)) s = s.slice(1); return s.replace(".", ","); };

  const COL = { cyan: "#3fd2ff", amber: "#ffb347", red: "#ff5a5f", white: "#eef6ff", muted: "#8fb3d9", steel: "#9fc4e6", green: "#5be49b", hot: "#ffe2b8", bg: "#07152a" };
  const RGB = {};
  const rgb = (hex) => { let c = RGB[hex]; if (!c) { const n = parseInt(hex.slice(1), 16); c = RGB[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; } return c; };
  const rgba = (hex, a) => { const c = rgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  const mix = (h1, h2, t, a = 1) => { const c1 = rgb(h1), c2 = rgb(h2); t = clamp(t); return `rgba(${Math.round(lerp(c1[0], c2[0], t))},${Math.round(lerp(c1[1], c2[1], t))},${Math.round(lerp(c1[2], c2[2], t))},${a})`; };

  // ---------- Layout (px) ----------
  const FLOOR = 878, Y_TOP = 350, BX = 600;          // Grubenboden, Oberkante Puffer (entlastet), Pufferachse
  const WALL0 = 92, WALL1 = 128, RAIL_X0 = 170, RAIL_X1 = 198;
  const PLATE_H = 16, COL_H = 158, KOPF_H = 10, BEAM_H = 56, PAD_H = 14, PLAT_H = 22;
  const B_OFF = PLATE_H + COL_H + KOPF_H;            // Anschlagplatte UK -> Unterholm UK
  const BM_T = B_OFF + BEAM_H, PL_B = BM_T + PAD_H, PL_T = PL_B + PLAT_H; // Unterholm OK, Fahrkorbboden UK/OK
  const GAP_IDLE = 118;                              // Pufferabstand im Normalbetrieb (Darstellung)
  const PX0 = 1236, PW = 594, PIN = 30;              // Infotafel
  const CB_X = 830;                                  // Beschriftungsboxen rechts
  const CB_Y = [268, 420, 535, 650, 765];            // Mittellinien der Boxen (0 = links: Pufferstempel)
  const LB_R = 420;                                  // rechte Kante der linken Box

  // ---------- Zeichen-Helfer (Gruppen-Alpha GA) ----------
  let GA = 1;
  function stk(ctx, build, color, w, glow, alpha, o) {
    const a = GA * (alpha == null ? 1 : alpha); if (a <= 0.004) return;
    ctx.save(); ctx.lineCap = (o && o.cap) || "round"; ctx.lineJoin = "round"; ctx.strokeStyle = color;
    if (o && o.dash) { ctx.setLineDash(o.dash); ctx.lineDashOffset = o.off || 0; }
    ctx.beginPath(); build(ctx);
    if (glow > 0) { ctx.globalAlpha = a * Math.min(1, 0.2 * glow); ctx.lineWidth = w * 3.4; ctx.stroke(); }
    ctx.globalAlpha = a; ctx.lineWidth = w; ctx.stroke(); ctx.restore();
  }
  function fil(ctx, build, fill, alpha, rule) { const a = GA * (alpha == null ? 1 : alpha); if (a <= 0.004) return; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = fill; ctx.beginPath(); build(ctx); ctx.fill(rule || "nonzero"); ctx.restore(); }
  function txt(L, ctx, s, x, y, o) { const a = GA * (o.alpha == null ? 1 : o.alpha); if (a <= 0.004) return; L.text(ctx, s, x, y, Object.assign({}, o, { alpha: a })); }
  const GLOW = new Map();
  function glowTex(color) {
    let c = GLOW.get(color); if (c !== undefined) return c;
    try {
      c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, rgba(color, 0.9)); gr.addColorStop(0.35, rgba(color, 0.35)); gr.addColorStop(1, rgba(color, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    } catch (e) { c = null; }
    GLOW.set(color, c); return c;
  }
  function dot(ctx, x, y, r, color, alpha) {
    const a = GA * alpha; if (a <= 0.004 || r <= 0.5) return;
    const tex = glowTex(color);
    ctx.save(); ctx.globalAlpha = Math.min(1, a);
    if (tex) ctx.drawImage(tex, x - r, y - r, 2 * r, 2 * r);
    else { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(color, 0.9)); g.addColorStop(1, rgba(color, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  const rr = (c, x, y, w, h, r) => { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  const rect = (x, y, w, h) => (c) => c.rect(x, y, w, h);
  const polyB = (pts, close) => (c) => { pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); if (close) c.closePath(); };
  function arrowHead(ctx, x, y, ang, size, color, alpha) {
    fil(ctx, (c) => { c.moveTo(x, y); c.lineTo(x - Math.cos(ang - 0.45) * size, y - Math.sin(ang - 0.45) * size); c.lineTo(x - Math.cos(ang + 0.45) * size, y - Math.sin(ang + 0.45) * size); c.closePath(); }, color, alpha);
  }
  function part(ctx, build, fill, line, lw, glow, alpha) { fil(ctx, build, fill, alpha); stk(ctx, build, line, lw, glow, alpha); }

  // ---------- Schraffur-Muster ----------
  const PATS = new WeakMap();
  function pats(ctx) {
    let p = PATS.get(ctx); if (p) return p;
    const mk = (w, h, draw) => { try { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); draw(g, w, h); return ctx.createPattern(c, "repeat"); } catch (e) { return null; } };
    const diag = (color, gap, lw, flip) => (g) => {
      g.strokeStyle = color; g.lineWidth = lw; g.beginPath();
      if (!flip) { g.moveTo(-1, gap + 1); g.lineTo(gap + 1, -1); g.moveTo(-3, 3); g.lineTo(3, -3); g.moveTo(gap - 3, gap + 3); g.lineTo(gap + 3, gap - 3); }
      else { g.moveTo(-1, -1); g.lineTo(gap + 1, gap + 1); g.moveTo(gap - 3, -3); g.lineTo(gap + 3, 3); g.moveTo(-3, gap - 3); g.lineTo(3, gap + 3); }
      g.stroke();
    };
    p = {
      cyan: mk(10, 10, diag("rgba(63,210,255,0.5)", 10, 1.1, false)),
      steel: mk(8, 8, diag("rgba(159,196,230,0.42)", 8, 1, true)),
      amber: mk(9, 9, diag("rgba(255,179,71,0.5)", 9, 1.1, true)),
      concrete: mk(48, 48, (g) => {
        diag("rgba(143,179,217,0.2)", 24, 1, false)(g); g.save(); g.translate(24, 24); diag("rgba(143,179,217,0.2)", 24, 1, false)(g); g.restore();
        g.fillStyle = "rgba(159,196,230,0.38)";
        for (let i = 0; i < 9; i++) { const x = h01(i * 3.7 + 1) * 48, y = h01(i * 5.3 + 2) * 48, r = 0.7 + 1.1 * h01(i * 1.9); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
        g.strokeStyle = "rgba(159,196,230,0.3)"; g.lineWidth = 1;
        for (let i = 0; i < 4; i++) { const x = h01(i * 7.1 + 5) * 44 + 2, y = h01(i * 2.9 + 7) * 44 + 2, r = 2.2 + 1.5 * h01(i * 4.4); g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y + r * 0.8); g.lineTo(x - r, y + r * 0.7); g.closePath(); g.stroke(); }
      }),
    };
    PATS.set(ctx, p); return p;
  }
  function hatch(ctx, build, pat, alpha) { if (!pat) return; try { if (pat.setTransform) pat.setTransform(new DOMMatrix([1, 0, 0, 1, 0, 0])); } catch (e) { /* ohne */ } fil(ctx, build, pat, alpha); }

  // ---------- Sprite-Cache ----------
  const SPR = new Map();
  function sprite(key, w, h, drawFn) {
    if (SPR.has(key)) return SPR.get(key);
    let cv = null;
    try {
      cv = document.createElement("canvas"); cv.width = Math.ceil(w); cv.height = Math.ceil(h);
      const g = cv.getContext("2d");
      if (!g) cv = null; else { const sG = GA; GA = 1; try { drawFn(g); } finally { GA = sG; } }
    } catch (e) { cv = null; }
    if (SPR.size > 160) SPR.clear();
    SPR.set(key, cv);
    return cv;
  }
  /** Zeichnet statischen Inhalt (absolute Koordinaten im Rechteck x0,y0,w,h) gecacht; dx/dy verschiebt beim Zeichnen. */
  function layer(ctx, key, x0, y0, w, h, alpha, drawFn, dx, dy) {
    const a = GA * alpha; if (a <= 0.004) return;
    const cv = sprite(key, w, h, (g) => { g.translate(-x0, -y0); drawFn(g); });
    if (cv) { ctx.save(); ctx.globalAlpha = a; ctx.drawImage(cv, x0 + (dx || 0), y0 + (dy || 0)); ctx.restore(); }
    else { ctx.save(); ctx.translate(dx || 0, dy || 0); const sG = GA; GA = a; drawFn(ctx); GA = sG; ctx.restore(); }
  }
  /** Maskiert ein Sprite: Alpha-Verlauf (destination-in). */
  function fadeMask(g, x0, y0, x1, y1, stops) {
    g.save(); g.globalCompositeOperation = "destination-in";
    const gr = g.createLinearGradient(x0, y0, x1, y1); for (const s of stops) gr.addColorStop(s[0], `rgba(0,0,0,${s[1]})`);
    g.fillStyle = gr; g.fillRect(-5000, -5000, 10000, 10000); g.restore();
  }
  const MEAS = new Map();
  function meas(L, ctx, text, o) { const k = text + "|" + (o.size || 40) + "|" + (o.weight || 600) + "|" + (o.font || "") + "|" + (o.letterSpacing || 0); let w = MEAS.get(k); if (w == null) { w = L.measure(ctx, text, o); if (MEAS.size > 400) MEAS.clear(); MEAS.set(k, w); } return w; }

  // ---------- Parameter ----------
  function num(v, def) { const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : Number(v); return Number.isFinite(n) ? n : def; }
  function bool(v) {
    if (v === undefined || v === null || v === "") return undefined;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    const s = String(v).trim().toLowerCase();
    if (["true", "1", "ja", "yes", "y", "on", "wahr", "an", "auto"].includes(s)) return true;
    if (["false", "0", "nein", "no", "n", "off", "falsch", "aus"].includes(s)) return false;
    return undefined;
  }
  function pick(P, keys) { for (const k of keys) { const v = P[k]; if (v !== undefined && v !== null && v !== "") return v; } return undefined; }
  function config(P) {
    P = P && typeof P === "object" ? P : {};
    const raw = String(pick(P, ["type", "typ", "kind", "variant", "art", "buffer", "puffer", "bufferType", "buffer_type"]) ?? "hydraulic").toLowerCase();
    let type = "hydraulic";
    if (/^pu$|^pur$|\bpu\b|poly|urethan|elastom|gummi|rubber|cellasto|schaum|foam/.test(raw)) type = "polyurethane";
    else if (/spring|feder|coil|schrauben|linear|speicher|accum/.test(raw)) type = "spring";
    const c = bool(pick(P, ["compress", "compressed", "compression", "impact", "aufprall", "einfedern", "active", "animate", "hit"]));
    const r = bool(pick(P, ["return", "rueckstellung", "rückstellung", "reset", "restore", "showReturn", "show_return"]));
    const lb = bool(pick(P, ["labels", "label", "callouts", "beschriftung"]));
    const pn = bool(pick(P, ["panel", "hud", "info", "infotafel"]));
    return { type, compress: c === undefined ? true : c, ret: r, labels: lb === undefined ? true : lb, panel: pn === undefined ? true : pn };
  }

  // ---------- Typ-Daten ----------
  const SPEC = {
    hydraulic: { m: 1600, vN: 1.6, vi: 1.84, A: 0.74, B: 0.33 },
    spring: { m: 1600, vN: 1.0, vi: 1.15, k: 350000, zeta: 0.02 },
    polyurethane: { m: 1600, vN: 1.0, vi: 1.15, k0: 180000, x0: 0.1, beta: 0.03 },
  };
  const INFO = {
    hydraulic: {
      title: "HYDRAULIKPUFFER", sub: "Ölpuffer – Kolben presst Öl durch Drosselbohrungen",
      mode: "ENERGIEVERZEHREND", modeCol: COL.red, use: "für alle Nenngeschwindigkeiten",
      strokeLbl: "Hub", strokeSub: "von 250 mm Hub", axS: [0, 100, 200], sMax: 260, axF: [0, 20, 40], fMax: 40,
    },
    spring: {
      title: "FEDERPUFFER", sub: "Schraubendruckfeder aus Federstahl",
      mode: "ENERGIESPEICHERND", modeCol: COL.amber, use: "nur bis 1,0 m/s Nenngeschwindigkeit",
      strokeLbl: "Federweg", strokeSub: "von 180 mm Federweg", axS: [0, 50, 100, 150], sMax: 185, axF: [0, 25, 50], fMax: 50,
    },
    polyurethane: {
      title: "POLYURETHANPUFFER", sub: "Elastomerblock aus zelligem Polyurethan",
      mode: "ENERGIESPEICHERND", modeCol: COL.amber, use: "nur bis 1,0 m/s Nenngeschwindigkeit",
      strokeLbl: "max. Einfederung", strokeSub: "Blockhöhe 200 mm", axS: [0, 50, 100], sMax: 135, axF: [0, 25, 50], fMax: 50,
    },
  };

  // ---------- Geometrie je Typ ----------
  const GEO = {};
  function geo(type) {
    if (GEO[type]) return GEO[type];
    let g;
    if (type === "hydraulic") {
      const ped = 24, bp = 12, base = FLOOR - ped - bp;
      const S = (base - Y_TOP) / (360 + 270 + 20 + 25);
      g = { type, S, ped, bp, base, cylTop: base - 360 * S, cylBot: base,
        oW: 170 * S, ow: 7, iW: 106 * S, iw: 4, plW: 76 * S, pisH: 22 * S, glandH: 30 * S, botH: 22 * S,
        plateH: 20 * S, padH: 25 * S, plateW: 150 * S, padW: 126 * S, strokeMM: 250 };
      g.strokePx = 250 * S; g.pisW = g.iW - 2 * g.iw;
      g.pis0 = g.cylTop + g.glandH + 4; g.chBot = base - g.botH;
      g.holes = []; const y0 = g.pis0 + g.pisH + 14, y1 = g.chBot - 10; for (let k = 0; k < 7; k++) g.holes.push(lerp(y0, y1, k / 6));
      g.lvl0 = g.cylTop + g.glandH + 14;
      g.plateHalf = 70; g.halfMax = g.oW / 2 + 6;
    } else if (type === "spring") {
      const ped = 24, top = FLOOR - ped;
      const S = (top - Y_TOP) / (20 + 360 + 25 + 20);
      g = { type, S, ped, pedTop: top, baseTop: top - 20 * S, Ls: 360 * S, capH: 25 * S, padH: 20 * S,
        OD: 150 * S, wire: 16 * S, capW: 190 * S, padW: 160 * S, baseW: 230 * S, spigW: 84 * S, spigH: 64 * S, bossW: 92 * S, bossH: 22 * S,
        turns: 8, strokeMM: 180 };
      g.strokePx = 180 * S; g.plateHalf = g.capW / 2 + 8; g.halfMax = g.capW / 2;
    } else {
      const standH = 236, top = FLOOR - standH;
      const S = (top - Y_TOP) / (10 + 200);
      g = { type, S, standTop: top, baseTop: top - 10 * S, H0: 200 * S, w0: 165 * S, baseW: 190 * S, strokeMM: 130,
        colW: 104, footW: 256, topW: 262 };
      g.strokePx = 130 * S; g.plateHalf = 96; g.halfMax = g.w0 / 2 * 1.16;
    }
    g.dimX = BX - Math.max(g.plateHalf, g.halfMax) - 24;
    GEO[type] = g; return g;
  }

  // ---------- Physik (physikalische Zeit tau ab Aufprall) ----------
  const PH = {};
  function physics(type) {
    if (PH[type]) return PH[type];
    const sp = SPEC[type], m = sp.m, dt = 0.00005, REC = 20, TEND = 3.2, dts = dt * REC;
    const N = Math.round(TEND / dts) + 1;
    const X = new Float32Array(N), V = new Float32Array(N), F = new Float32Array(N), ED = new Float32Array(N), EE = new Float32Array(N), AP = new Float32Array(N);
    let x = 0, v = sp.vi, ed = 0, stop = -1, tauMax = -1, xMax = 0, tauR = -1, tauL2 = -1, aPk = 0, k = 0;
    const c = type === "spring" ? 2 * sp.zeta * Math.sqrt(sp.k * m) : 0;
    for (let i = 0; k < N; i++) {
      const tau = i * dt;
      let f = 0, fel = 0, ee = 0;
      if (type === "hydraulic") {
        if (stop < 0) { const a = GN * (sp.A * Math.min(1, tau / 0.012) + sp.B * Math.exp(-Math.pow((tau - 0.012) / 0.007, 2))); f = m * (GN + a); }
        else f = m * GN;
      } else if (x > 0) {
        if (type === "spring") { fel = sp.k * x; ee = 0.5 * sp.k * x * x; f = fel + c * v; }
        else { fel = sp.k0 * x * (1 + x / sp.x0); ee = sp.k0 * (x * x / 2 + (x * x * x) / (3 * sp.x0)); f = fel + sp.beta * sp.k0 * (1 + (2 * x) / sp.x0) * v; }
        if (f < 0) f = 0;
      }
      if (tauR < 0 || tau <= tauR) aPk = Math.max(aPk, (f - m * GN) / (m * GN));
      if (i % REC === 0) { X[k] = x; V[k] = v; F[k] = f; ED[k] = ed; EE[k] = ee; AP[k] = Math.max(0, aPk); k++; }
      if (type === "hydraulic") {
        if (stop < 0) {
          const a = GN - f / m; ed += f * v * dt; v += a * dt;
          if (v <= 0) { v = 0; stop = tau; tauMax = tau; tauR = tau; xMax = x; }
          x += v * dt;
        }
      } else {
        const a = GN - f / m, vp = v; ed += (f - fel) * v * dt; v += a * dt; x += v * dt;
        if (tauMax < 0 && vp > 0 && v <= 0) { tauMax = tau; xMax = x; }
        if (tauMax > 0 && tauR < 0) {
          if (type === "spring" && x <= 0) tauR = tau;
          if (type === "polyurethane" && vp < 0 && v >= 0) tauR = tau;
        }
        if (tauR > 0 && tauL2 < 0 && tau > tauR + 0.01) {
          if (type === "spring" && x > 0) tauL2 = tau;
          if (type === "polyurethane" && vp > 0 && v <= 0) tauL2 = tau;
        }
      }
    }
    if (tauMax < 0) { tauMax = 0.2; xMax = 0.1; }
    if (tauR < 0) tauR = tauMax * 2.2;
    if (tauL2 < 0) tauL2 = tauR + 0.25;
    // Ruhelage: letzter Zeitpunkt mit Schwingungsamplitude > 2 mm um die statische Einfederung
    let tauRest = 1e9;
    if (type !== "hydraulic") {
      const xs = X[N - 1]; let last = N - 1;
      while (last > 0 && Math.abs(X[last] - xs) < 0.002 && Math.abs(V[last]) < 0.02) last--;
      tauRest = last < N - 20 ? last * dts : 1e9;
    }
    const ph = { type, m, vi: sp.vi, vN: sp.vN, dts, N, TEND, X, V, F, ED, EE, AP, tauMax, xMax, tauR, tauL2, tauRest };
    const qm = sampleP(ph, tauMax);
    ph.W = Math.max(1, type === "hydraulic" ? qm.ed : qm.ed + qm.ee);
    const qr = sampleP(ph, tauR);
    ph.heatR = clamp(qr.ed / ph.W); ph.storR = clamp(qr.ee / ph.W); ph.kinR = clamp(1 - ph.heatR - ph.storR);
    PH[type] = ph; return ph;
  }
  function sampleP(ph, tau) {
    const i = clamp(tau / ph.dts, 0, ph.N - 1), i0 = Math.floor(i), i1 = Math.min(ph.N - 1, i0 + 1), f = i - i0;
    return { x: lerp(ph.X[i0], ph.X[i1], f), v: lerp(ph.V[i0], ph.V[i1], f), F: lerp(ph.F[i0], ph.F[i1], f), ed: lerp(ph.ED[i0], ph.ED[i1], f), ee: lerp(ph.EE[i0], ph.EE[i1], f), ap: lerp(ph.AP[i0], ph.AP[i1], f) };
  }

  // ---------- Zeitsteuerung ----------
  function timing(d, cfg, ph, g) {
    const FR = 0.3;                                   // Anteil von d für Einfedern (+ erster Rückprall)
    const k1 = (FR * d) / ph.tauR;                    // Bildschirm-s je physikalische s (Zeitlupe)
    const vpx = (ph.vi * 1000 * g.S) / k1;            // px/s in der Annäherung
    const tC = clamp(235 / vpx, 0.14 * d, 0.3 * d);   // Aufprallzeitpunkt
    const tW = tC + FR * d, w = 0.06 * d, r = cfg.type === "hydraulic" ? 1 : 2.6;
    const ret = cfg.type === "hydraulic" && (cfg.ret === undefined ? d >= 7 : cfg.ret);
    const tR0 = Math.max(tW + 0.1 * d, 0.68 * d);
    return { k1, vpx, tC, tW, w, r, ret, tR0 };
  }
  function tauAt(tm, t) {
    if (t < tm.tC) return (t - tm.tC) / tm.k1;
    let s = (t - tm.tC) / tm.k1;
    if (tm.r > 1 && t > tm.tW) { const u = (t - tm.tW) / tm.w; const I = u < 1 ? tm.w * (u * u * u - (u * u * u * u) / 2) : tm.w * 0.5 + (t - tm.tW - tm.w); s += ((tm.r - 1) * I) / tm.k1; }
    return s;
  }

  // ---------- Zustand pro Frame ----------
  function computeState(t, d, cfg) {
    const g = geo(cfg.type), ph = physics(cfg.type), tm = timing(d, cfg, ph, g);
    const s = { t, d, g, ph, tm, cfg, type: cfg.type, idle: !cfg.compress, hyd: cfg.type === "hydraulic" };
    s.contactT = -1; s.shake = 0; s.returning = false; s.retQ = 0;
    if (s.idle) {
      s.tau = -1; s.x = 0; s.v = 0; s.F = 0; s.yS = Y_TOP - GAP_IDLE; s.xb = 0; s.vb = 0;
      s.kin = 0; s.stor = 0; s.heat = 0; s.ap = 0; s.phase = "idle"; s.flow = 0; s.heatGlow = 0; s.stored = 0;
      return s;
    }
    const tau = tauAt(tm, t); s.tau = tau;
    let x, v, F, ap = 0, q = null;
    if (tau < 0) { x = tau * ph.vi; v = ph.vi; F = 0; }
    else { q = sampleP(ph, tau); x = q.x; v = q.v; F = q.F; ap = q.ap; }
    s.x = x; s.v = v; s.F = F; s.ap = ap;
    s.yS = Y_TOP + x * 1000 * g.S;
    let xbMM = Math.max(0, x) * 1000;
    // Energiebilanz des ersten Aufpralls (Arbeit am Puffer, normiert)
    if (tau < 0) { s.kin = 1; s.stor = 0; s.heat = 0; }
    else { const qq = tau < ph.tauR ? q : sampleP(ph, ph.tauR); s.heat = clamp(qq.ed / ph.W); s.stor = s.hyd ? 0 : clamp(qq.ee / ph.W); s.kin = clamp(1 - s.heat - s.stor); }
    // Hydraulik: Rückstellung (Fahrkorb wird angehoben, Kolben folgt langsam)
    if (s.hyd && tm.ret && t > tm.tR0) {
      const u = (t - tm.tR0) / Math.max(0.2, d - tm.tR0);
      const lift = (ph.xMax * 1000 * g.S + 70) * easeInOut(inv(0, 0.42, u));
      s.yS = Y_TOP + ph.xMax * 1000 * g.S - lift;
      const carMM = Math.max(0, (s.yS - Y_TOP) / g.S);
      const plMM = ph.xMax * 1000 * Math.exp(-3.1 * u);
      xbMM = Math.max(carMM, plMM);
      s.returning = true; s.retQ = u;
      s.F = carMM > plMM - 0.5 ? m0(ph) * GN * (1 - smooth(inv(0, 0.04, u))) : 0;
      s.v = 0; s.vb = -(ph.xMax * 1000 * 3.1 * Math.exp(-3.1 * u)) / Math.max(0.2, d - tm.tR0) / 1000; // m je Bildschirm-s (nur Richtung)
    }
    s.xbMM = xbMM; s.xb = xbMM * g.S;
    // Kolbengeschwindigkeit (für Ölfluss), normiert
    if (!s.returning) s.vb = x > 0 ? v : 0;
    s.flow = s.returning ? -clamp(-s.vb * 1000 * 0.02) : clamp(s.vb / ph.vi);
    // Wärme-Glühen / gespeicherte Energie (Anzeige am Bauteil)
    if (tau < 0) { s.heatGlow = 0; s.stored = 0; }
    else if (s.hyd) { const tS = tm.tW; s.heatGlow = clamp(s.heat) * (1 - 0.45 * smooth(inv(tS, d + 2, t))); s.stored = 0; }
    else { s.stored = q ? clamp(q.ee / ph.W) : 0; s.heatGlow = clamp(s.heat) * 0.9; }
    // Phasen
    if (tau < 0) s.phase = "approach";
    else if (s.hyd) s.phase = s.returning ? "return" : tau < ph.tauR ? "throttle" : "stop";
    else s.phase = tau < ph.tauMax ? "compress" : tau < ph.tauL2 ? "rebound" : tau < ph.tauRest ? "settle" : "rest";
    // Aufprall-Erschütterung
    const tc = t - tm.tC;
    if (tc >= 0) { const amp = s.hyd ? 1.6 : cfg.type === "spring" ? 3.2 : 2.6; s.shake = amp * Math.exp(-tc * 9) * (tc < 1.2 ? 1 : 0); s.contactT = tc; }
    return s;
  }
  const m0 = (ph) => ph.m;

  // ---------- Hintergrund-Effekte ----------
  function drawFX(ctx, s, t) {
    // Staubpartikel in der Grube
    ctx.save(); ctx.fillStyle = COL.cyan;
    for (let b = 0; b < 3; b++) {
      ctx.globalAlpha = GA * (0.1 + 0.1 * b); ctx.beginPath();
      for (let i = b; i < 30; i += 3) {
        const x = 150 + frac(h01(i * 3.1) + t * 0.006 * (0.4 + h01(i * 1.7))) * 1040;
        const y = 250 + h01(i * 7.7) * 590 + Math.sin(t * 0.6 + i * 1.3) * 10 - ((t * 5 * h01(i * 2.2)) % 40);
        const r = (1 + 1.6 * h01(i * 4.3)) * (0.7 + 0.3 * Math.sin(t * 1.3 + i));
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
      }
      ctx.fill();
    }
    ctx.restore();
    // Röntgen-Scan über die Grube
    const ys = 230 + frac(t / 5.5) * 640, xa = 140, xb = 1200;
    const gr = ctx.createLinearGradient(xa, 0, xb, 0);
    gr.addColorStop(0, "rgba(63,210,255,0)"); gr.addColorStop(0.25, "rgba(63,210,255,1)"); gr.addColorStop(0.75, "rgba(63,210,255,1)"); gr.addColorStop(1, "rgba(63,210,255,0)");
    for (let k = 0; k < 6; k++) stk(ctx, (c) => { c.moveTo(xa, ys - k * 9); c.lineTo(xb, ys - k * 9); }, gr, k ? 9 : 1.2, 0, k ? (0.016 * (6 - k)) / 5 : 0.12, { cap: "butt" });
  }

  // ---------- Schachtgrube (statisch) ----------
  const PUL_X = 296, PUL_Y = 800, PUL_R = 30; // Spannrolle des Begrenzerseils
  function drawGovRope(ctx, s) {
    const off = s.yS - Y_TOP, top = 110;
    const fade = (c) => { const gr = ctx.createLinearGradient(0, top, 0, top + 260); gr.addColorStop(0, rgba(c, 0)); gr.addColorStop(1, rgba(c, 1)); return gr; };
    for (const [x, dir] of [[PUL_X - PUL_R, 1], [PUL_X + PUL_R, -1]]) {
      stk(ctx, (c) => { c.moveTo(x, top); c.lineTo(x, PUL_Y); }, fade(COL.steel), 3, 0, 0.55, { cap: "butt" });
      stk(ctx, (c) => { c.moveTo(x, top); c.lineTo(x, PUL_Y); }, fade(COL.cyan), 1.4, 0, 0.6, { dash: [6, 5], off: -dir * off, cap: "butt" });
    }
    const th = -off / PUL_R;
    part(ctx, (c) => c.arc(PUL_X, PUL_Y, PUL_R, 0, TAU), "rgba(14,34,58,0.96)", COL.steel, 1.8, 0.5, 0.95);
    stk(ctx, (c) => c.arc(PUL_X, PUL_Y, PUL_R - 5, 0, TAU), COL.steel, 1, 0, 0.5);
    stk(ctx, (c) => { for (let k = 0; k < 4; k++) { const a = th + (k * Math.PI) / 2; c.moveTo(PUL_X + Math.cos(a) * 6, PUL_Y + Math.sin(a) * 6); c.lineTo(PUL_X + Math.cos(a) * (PUL_R - 6), PUL_Y + Math.sin(a) * (PUL_R - 6)); } }, COL.cyan, 1.6, 0.5, 0.7);
    fil(ctx, (c) => c.arc(PUL_X, PUL_Y, 5, 0, TAU), COL.steel, 1);
  }
  const PIT_PIECES = [
    ["wall", 84, 104, 46, FLOOR - 4 - 104], ["rail", 130, 104, 96, FLOOR - 4 - 104], ["floor", 84, FLOOR - 4, 1144, 70],
    ["gov", 226, 770, 228, FLOOR - 4 - 770], ["gtxt", 322, 610, 30, 150], ["label", 754, FLOOR - 36, 200, 32],
  ];
  function drawPit(ctx, L) {
    const fn = (g) => {
      const P = pats(g);
      // Wand
      const wall = rect(WALL0, 110, WALL1 - WALL0, FLOOR - 110);
      fil(g, wall, "rgba(10,24,44,0.95)", 1); hatch(g, wall, P.concrete, 0.9);
      stk(g, (c) => { c.moveTo(WALL1, 110); c.lineTo(WALL1, FLOOR); }, COL.steel, 1.6, 0.5, 0.8);
      // Boden (Grubenboden)
      const fl = rect(WALL0, FLOOR, 1130, 80);
      fil(g, fl, "rgba(10,24,44,0.95)", 1); hatch(g, fl, P.concrete, 0.9);
      stk(g, (c) => { c.moveTo(WALL1, FLOOR); c.lineTo(1222, FLOOR); }, COL.steel, 2, 0.7, 0.95);
      // Führungsschiene (Seitenansicht T-Profil: Fuß links, Kopf rechts)
      const rl = rect(RAIL_X0, 110, RAIL_X1 - RAIL_X0, FLOOR - 10 - 110);
      fil(g, rl, "rgba(18,40,66,0.95)", 1); hatch(g, rl, P.steel, 0.45);
      stk(g, rl, COL.steel, 1.6, 0.5, 0.85);
      stk(g, (c) => { c.moveTo(RAIL_X0 + 9, 110); c.lineTo(RAIL_X0 + 9, FLOOR - 10); c.moveTo(RAIL_X1 - 9, 110); c.lineTo(RAIL_X1 - 9, FLOOR - 10); }, COL.steel, 1, 0, 0.45);
      // Schienenstoß mit Lasche
      part(g, rect(RAIL_X0 - 4, 420, 12, 70), "rgba(20,44,72,0.95)", COL.steel, 1.2, 0, 0.8);
      for (const yy of [432, 455, 478]) fil(g, (c) => c.arc(RAIL_X0 + 2, yy, 2.5, 0, TAU), COL.steel, 0.8);
      // Schienenbügel zur Wand
      part(g, rect(WALL1, 600, RAIL_X0 - WALL1 + 6, 14), "rgba(20,44,72,0.95)", COL.steel, 1.4, 0.3, 0.9);
      part(g, rect(RAIL_X0 - 6, 592, 16, 30), "rgba(20,44,72,0.95)", COL.steel, 1.2, 0, 0.85);
      for (const yy of [597, 617]) fil(g, (c) => c.arc(RAIL_X0 + 2, yy, 2.4, 0, TAU), COL.steel, 0.9);
      fil(g, (c) => c.arc(WALL1 + 10, 607, 3, 0, TAU), COL.steel, 0.9);
      // Schienenfuß auf dem Boden
      part(g, rect(RAIL_X0 - 22, FLOOR - 10, 72, 10), "rgba(20,44,72,0.95)", COL.steel, 1.4, 0.3, 0.9);
      fil(g, (c) => { c.arc(RAIL_X0 - 12, FLOOR - 5, 2.6, 0, TAU); c.moveTo(RAIL_X1 + 18, FLOOR - 5); c.arc(RAIL_X1 + 14, FLOOR - 5, 2.6, 0, TAU); }, COL.steel, 0.9);
      // Beschriftungen (eingraviert)
      g.save(); g.translate(RAIL_X0 - 13, 800); g.rotate(-Math.PI / 2);
      L.text(g, "Führungsschiene", 0, 0, { size: 15, weight: 600, color: COL.muted, alpha: 0.9, letterSpacing: 1 });
      g.restore();
      L.text(g, "SCHACHTGRUBE", 762, FLOOR - 16, { size: 15, weight: 700, font: L.FONT.mono, color: COL.muted, letterSpacing: 4, alpha: 0.85 });
      // Spanngewicht des Begrenzerseils: Hebel an der Schiene, Gewicht am Hebelende
      part(g, rect(RAIL_X1, PUL_Y - 18, 14, 36), "rgba(20,44,72,0.95)", COL.steel, 1.2, 0, 0.85);
      part(g, polyB([[RAIL_X1 + 6, PUL_Y - 5], [396, PUL_Y + 1], [396, PUL_Y + 11], [RAIL_X1 + 6, PUL_Y + 5]], true), "rgba(20,44,72,0.95)", COL.steel, 1.3, 0.3, 0.85);
      fil(g, (c) => c.arc(RAIL_X1 + 7, PUL_Y, 3, 0, TAU), COL.steel, 0.9);
      stk(g, (c) => { c.moveTo(380, PUL_Y + 10); c.lineTo(380, PUL_Y + 20); }, COL.steel, 2, 0, 0.8);
      const wt = rect(356, PUL_Y + 20, 48, 34);
      fil(g, wt, "rgba(24,46,74,0.97)", 1); hatch(g, wt, P.steel, 0.4); stk(g, wt, COL.steel, 1.4, 0.4, 0.9);
      L.text(g, "Spanngewicht", 352, FLOOR - 14, { size: 14, weight: 600, color: COL.muted, alpha: 0.85 });
      g.save(); g.translate(PUL_X + PUL_R + 16, PUL_Y - 60); g.rotate(-Math.PI / 2);
      L.text(g, "Begrenzerseil", 0, 0, { size: 14, weight: 600, color: COL.muted, alpha: 0.85, letterSpacing: 1 });
      g.restore();
      // Ausblendungen: oben, rechts, unten
      fadeMask(g, 0, 110, 0, 360, [[0, 0], [1, 1]]);
      fadeMask(g, 1080, 0, 1222, 0, [[0, 1], [1, 0]]);
      fadeMask(g, 0, 880, 0, 940, [[0, 1], [1, 0]]);
    };
    // in disjunkte Teilbereiche zerlegt (spart Füllrate gegenüber einem großen Sprite)
    for (const r of PIT_PIECES) layer(ctx, "pit|" + r[0], r[1], r[2], r[3], r[4], 1, fn);
  }

  // ---------- Fahrkorb-Unterbau (bewegt, gecacht) ----------
  const CAR_UP = 760;
  function drawCar(ctx, L, s) {
    const g = s.g, ph = g.plateHalf;
    const key = "car|" + s.type;
    // Kabinenwand und Rahmenstütze (lange, schmale Elemente: direkt gezeichnet, nach oben ausgeblendet)
    const yTop = s.yS - CAR_UP, yB = s.yS - PL_T;
    if (yB > 0) {
      const fg = (c, a) => { const gr = ctx.createLinearGradient(0, Math.max(yTop, yB - 520), 0, Math.max(yTop, yB - 520) + 240); gr.addColorStop(0, rgba(c, 0)); gr.addColorStop(1, rgba(c, a)); return gr; };
      fil(ctx, rect(204, yTop, 28, CAR_UP - BM_T + 8), fg("#10243c", 0.9), 1);
      stk(ctx, rect(204, yTop, 28, CAR_UP - BM_T + 8), fg(COL.steel, 1), 1.4, 0.3, 0.75);
      fil(ctx, rect(236, yTop, 10, CAR_UP - PL_T), fg("#142c48", 0.9), 1);
      stk(ctx, rect(236, yTop, 10, CAR_UP - PL_T), fg(COL.cyan, 1), 1.6, 0.6, 0.9);
      stk(ctx, (c) => { for (let x = 330; x < 900; x += 120) { c.moveTo(x, yTop); c.lineTo(x, yB - 16); } }, fg(COL.cyan, 1), 1, 0, 0.08);
    }
    const fn = (c2) => {
      const P = pats(c2);
      // Koordinaten relativ zur Unterkante der Anschlagplatte (y = 0)
      // Führungsschuh
      part(c2, rect(RAIL_X0 - 8, -PL_T - 72, RAIL_X1 - RAIL_X0 + 38, 40), "rgba(16,36,60,0.92)", COL.steel, 1.4, 0.3, 0.85);
      stk(c2, (c) => { c.moveTo(RAIL_X1 - 2, -PL_T - 66); c.lineTo(RAIL_X1 - 2, -PL_T - 38); }, COL.cyan, 2, 0.6, 0.8);
      // Fahrkorbboden
      part(c2, rect(208, -PL_T, 1030, PLAT_H), "rgba(16,38,64,0.96)", COL.cyan, 1.8, 0.6, 1);
      stk(c2, (c) => { c.moveTo(246, -PL_T + 6); c.lineTo(1236, -PL_T + 6); }, COL.cyan, 1, 0, 0.35);
      // Schwingungsdämpfer (Gummi)
      for (const x of [350, 860]) part(c2, (c) => rr(c, x - 22, -PL_B, 44, PAD_H, 4), "rgba(30,30,40,0.95)", COL.muted, 1.2, 0, 0.9);
      // Unterholm (U-Profil)
      const beam = rect(204, -BM_T, 1034, BEAM_H);
      fil(c2, beam, "rgba(14,34,58,0.97)", 1); hatch(c2, beam, P.steel, 0.28);
      stk(c2, beam, COL.steel, 1.8, 0.5, 1);
      stk(c2, (c) => { c.moveTo(204, -BM_T + 9); c.lineTo(1238, -BM_T + 9); c.moveTo(204, -B_OFF - 9); c.lineTo(1238, -B_OFF - 9); }, COL.steel, 1, 0, 0.5);
      L.text(c2, "UNTERHOLM · FAHRKORBRAHMEN", 700, -B_OFF - 22, { size: 13, weight: 700, font: L.FONT.mono, color: COL.muted, letterSpacing: 3, alpha: 0.8 });
      // Fanggehäuse an der Schiene
      const fg = rect(RAIL_X0 - 10, -BM_T - 22, 78, 86);
      fil(c2, fg, "rgba(18,38,62,0.8)", 1); stk(c2, fg, COL.amber, 1.6, 0.6, 0.9);
      fil(c2, polyB([[RAIL_X1 + 2, -BM_T - 12], [RAIL_X1 + 12, -BM_T - 12], [RAIL_X1 + 12, -BM_T + 50], [RAIL_X1 + 2, -BM_T + 34]], true), COL.amber, 0.75);
      fil(c2, polyB([[RAIL_X0 - 2, -BM_T - 12], [RAIL_X0 - 6, -BM_T - 12], [RAIL_X0 - 6, -BM_T + 50], [RAIL_X0 - 2, -BM_T + 34]], true), COL.amber, 0.5);
      stk(c2, (c) => { c.moveTo(RAIL_X0 + 68, -BM_T + 30); c.lineTo(PUL_X - PUL_R + 2, -BM_T + 42); }, COL.amber, 2.4, 0.5, 0.9);
      part(c2, rect(PUL_X - PUL_R - 6, -BM_T + 36, 12, 16), "rgba(40,40,30,0.95)", COL.amber, 1.2, 0.3, 1);
      // Kopfplatte, Pufferstempel, Anschlagplatte
      part(c2, rect(BX - 56, -B_OFF, 112, KOPF_H), "rgba(20,44,72,0.97)", COL.steel, 1.4, 0.3, 1);
      for (const dx of [-42, 42]) fil(c2, rect(BX + dx - 5, -B_OFF + KOPF_H, 10, 5), COL.steel, 0.9);
      const col = rect(BX - 22, -PLATE_H - COL_H, 44, COL_H);
      fil(c2, col, "rgba(16,38,64,0.97)", 1); hatch(c2, col, P.steel, 0.3); stk(c2, col, COL.steel, 1.6, 0.4, 1);
      stk(c2, (c) => { c.moveTo(BX, -PLATE_H - COL_H + 4); c.lineTo(BX, -PLATE_H - 4); }, COL.cyan, 1, 0, 0.45, { dash: [14, 5, 3, 5] });
      part(c2, (c) => rr(c, BX - ph, -PLATE_H, ph * 2, PLATE_H, 3), "rgba(22,50,80,0.98)", COL.cyan, 2, 0.8, 1);
      stk(c2, (c) => { c.moveTo(BX - ph + 6, -4); c.lineTo(BX + ph - 6, -4); }, COL.white, 1, 0, 0.35);
      // Ausblendung nach rechts
      fadeMask(c2, 900, 0, 1225, 0, [[0, 1], [1, 0]]);
    };
    const cw = 2 * Math.max(ph, 56) + 14;
    layer(ctx, key + "|strip", 150, -PL_T - 4, 1090, PL_T - B_OFF + 8, 1, fn, 0, s.yS);
    layer(ctx, key + "|shoe", 150, -PL_T - 80, 110, 76, 1, fn, 0, s.yS);
    layer(ctx, key + "|fg", 150, -B_OFF + 4, 150, 14, 1, fn, 0, s.yS);
    layer(ctx, key + "|col", BX - cw / 2, -B_OFF + 4, cw, B_OFF - 2, 1, fn, 0, s.yS);
    // Beschriftung Fangvorrichtung (blendet unter der linken Beschriftungsbox aus)
    const ty = s.yS - B_OFF + 30, boxY = CB_Y[0] + (s.idle ? -18 : 0);
    const hide = (s.leftBox || 0) * (1 - smooth(inv(36, 58, Math.abs(ty - 6 - boxY))));
    txt(L, ctx, "Fangvorrichtung", RAIL_X1 + 50, ty, { size: 15, weight: 600, color: COL.amber, alpha: 0.9 * (1 - hide) });
  }

  // Bewegungshinweise am Fahrkorb (Streifen, Pfeile)
  function drawMotionCues(ctx, s, t) {
    const g = s.g, ph = s.ph;
    const sp = s.idle ? 0 : clamp(Math.abs(s.v) / ph.vi) * (s.returning ? 0 : 1);
    if (sp < 0.02) return;
    const dir = s.v >= 0 ? 1 : -1;
    // Nachzieh-Streifen oberhalb der Anschlagplatte
    if (dir > 0) {
      const len = clamp(s.tm.vpx * 0.32 * sp, 10, 110);
      ctx.save(); ctx.lineCap = "round";
      for (const dx of [-g.plateHalf + 6, -g.plateHalf + 26, -40, 40, g.plateHalf - 26, g.plateHalf - 6]) {
        const x = BX + dx, y0 = s.yS - PLATE_H - 2;
        const gr = ctx.createLinearGradient(0, y0, 0, y0 - len); gr.addColorStop(0, rgba(COL.cyan, 0.35 * sp * GA)); gr.addColorStop(1, rgba(COL.cyan, 0));
        ctx.strokeStyle = gr; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 - len); ctx.stroke();
      }
      ctx.restore();
    }
    // laufende Winkel rechts neben dem Pufferstempel
    const x = BX + g.plateHalf + 30, yA = s.yS - 150, span = 118, rate = 0.9;
    for (let k = 0; k < 3; k++) {
      const f = frac(k / 3 + t * rate * dir), y = dir > 0 ? yA + f * span : yA + (1 - f) * span, al = sp * Math.sin(Math.PI * f) * 0.9;
      stk(ctx, (c) => { c.moveTo(x - 10, y - 6 * dir); c.lineTo(x, y + 5 * dir); c.lineTo(x + 10, y - 6 * dir); }, COL.cyan, 2.4, 0.8, al);
    }
  }

  // Aufprall: Stoßring + Staub
  function drawImpact(ctx, s) {
    if (s.idle || s.contactT < 0) return;
    const tc = s.contactT, life = 0.9;
    if (tc > life) return;
    const q = tc / life, str = s.hyd ? 0.6 : 1;
    const rx = 40 + 190 * easeOut(q), ry = 8 + 26 * easeOut(q);
    stk(ctx, (c) => c.ellipse(BX, Y_TOP, rx, ry, 0, 0, TAU), COL.white, 2, 1, (1 - q) * 0.55 * str);
    stk(ctx, (c) => c.ellipse(BX, Y_TOP, rx * 0.7, ry * 0.7, 0, 0, TAU), COL.cyan, 1.5, 0.8, (1 - q) * 0.4 * str);
    dot(ctx, BX, Y_TOP, 70 * (1 - q * 0.5), COL.white, (1 - q) * 0.45 * str);
    ctx.save(); ctx.fillStyle = COL.steel;
    for (let i = 0; i < 22; i++) {
      const side = i % 2 ? 1 : -1, ang = (h01(i * 3.3) - 0.5) * 0.9, sp = 120 + 260 * h01(i * 1.7);
      const age = tc - 0.06 * h01(i * 5.1); if (age < 0) continue;
      const dist = sp * (1 - Math.exp(-age * 3)) / 3, x = BX + side * (g_half(s) + dist * Math.cos(ang)), y = Y_TOP + 8 + dist * Math.sin(ang) * 0.6 + 30 * age * age;
      const a = GA * (1 - q) * 0.6 * str; if (a < 0.02) continue;
      ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x, y, 1.2 + 1.5 * h01(i * 2.9), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  const g_half = (s) => (s.type === "polyurethane" ? s.g.w0 * 0.37 : s.type === "spring" ? s.g.padW / 2 : s.g.padW / 2);

  // ---------- Hydraulikpuffer ----------
  function drawHydraulic(ctx, L, s, t) {
    const g = s.g, cx = BX, xb = s.xb;
    const oX = cx - g.oW / 2, iX = cx - g.iW / 2;
    const heat = s.heatGlow;
    // statisch hinten: Sockel, Fußplatte, Zylinderinnenraum
    layer(ctx, "hyd-back", cx - 140, g.cylTop - 20, 280, FLOOR - g.cylTop + 24, 1, (c2) => {
      const P = pats(c2);
      const ped = rect(cx - 120, FLOOR - g.ped, 240, g.ped);
      fil(c2, ped, "rgba(12,28,50,0.97)", 1); hatch(c2, ped, P.concrete, 1); stk(c2, ped, COL.steel, 1.5, 0.4, 0.85);
      part(c2, rect(cx - 90, g.base, 180, g.bp), "rgba(22,48,78,0.97)", COL.steel, 1.5, 0.4, 1);
      for (const dx of [-74, 74]) { part(c2, rect(cx + dx - 7, g.base - 7, 14, 7), "rgba(22,48,78,0.97)", COL.steel, 1.2, 0, 1); stk(c2, (c) => { c.moveTo(cx + dx, g.base + g.bp); c.lineTo(cx + dx, FLOOR - 10); }, COL.steel, 2, 0, 0.5, { dash: [4, 3] }); }
      fil(c2, rect(oX, g.cylTop, g.oW, g.cylBot - g.cylTop), "rgba(3,10,22,0.96)", 1);
    });
    // Öl
    const top = g.cylTop + g.glandH, lvl = g.lvl0 - 0.34 * xb + Math.sin(t * 2.2) * 0.6;
    const oilG = ctx.createLinearGradient(0, top, 0, g.chBot);
    oilG.addColorStop(0, mix("#f0a040", COL.red, heat * 0.45, 0.2 + 0.08 * heat)); oilG.addColorStop(1, mix("#d88a30", COL.red, heat * 0.6, 0.34 + 0.12 * heat));
    const ann = (c) => { c.rect(oX + g.ow, lvl, iX - oX - g.ow, g.chBot - lvl); c.rect(iX + g.iW, lvl, oX + g.oW - g.ow - iX - g.iW, g.chBot - lvl); };
    fil(ctx, ann, oilG, 1);
    fil(ctx, rect(iX + g.iw, top, g.pisW, g.chBot - top), oilG, 1);
    // Luftpolster über dem Ölspiegel
    stk(ctx, (c) => { c.moveTo(oX + g.ow + 1, lvl); c.lineTo(iX - 1, lvl); c.moveTo(iX + g.iW + 1, lvl); c.lineTo(oX + g.oW - g.ow - 1, lvl); }, COL.amber, 1.4, 0.6, 0.7);
    // Ölströmung (Partikel folgen dem Kolbenweg -> deterministisch)
    const pisTop = g.pis0 + xb, pisBot = pisTop + g.pisH;
    drawOilFlow(ctx, s, t, g, pisBot, lvl, oX, iX);
    // Rückstellfeder im Druckraum
    const sTop = pisBot + 1, sBot = g.chBot - 1;
    drawCoilSimple(ctx, cx, sBot, sTop, g.pisW / 2 - 6, 6, COL.steel, 0.85);
    // Kolben
    const pis = rect(iX + g.iw, pisTop, g.pisW, g.pisH);
    part(ctx, pis, "rgba(22,52,84,1)", COL.cyan, 1.6, 0.6, 1);
    stk(ctx, (c) => { c.moveTo(iX + g.iw + 2, pisTop + g.pisH * 0.35); c.lineTo(iX + g.iw + g.pisW - 2, pisTop + g.pisH * 0.35); c.moveTo(iX + g.iw + 2, pisTop + g.pisH * 0.7); c.lineTo(iX + g.iw + g.pisW - 2, pisTop + g.pisH * 0.7); }, COL.cyan, 1, 0, 0.5);
    // Kolbenstange (poliert)
    const plTop = Y_TOP + g.padH + g.plateH + xb, plX = cx - g.plW / 2;
    const gr = ctx.createLinearGradient(plX, 0, plX + g.plW, 0);
    gr.addColorStop(0, "rgba(30,60,92,1)"); gr.addColorStop(0.35, "rgba(120,170,210,0.9)"); gr.addColorStop(0.5, "rgba(60,110,150,1)"); gr.addColorStop(1, "rgba(18,40,66,1)");
    fil(ctx, rect(plX, plTop, g.plW, pisTop - plTop), gr, 0.55);
    stk(ctx, rect(plX, plTop, g.plW, pisTop - plTop), COL.cyan, 1.6, 0.6, 0.95);
    // statisch vorne: Wände, Stopfbuchse, Boden, Drosselbohrungen
    layer(ctx, "hyd-front", cx - 70, g.cylTop - 4, 140, g.cylBot - g.cylTop + 8, 1, (c2) => {
      const P = pats(c2);
      const outer = (c) => { c.rect(oX, g.cylTop, g.ow, g.cylBot - g.cylTop); c.rect(oX + g.oW - g.ow, g.cylTop, g.ow, g.cylBot - g.cylTop); c.rect(oX, g.chBot, g.oW, g.botH); };
      fil(c2, outer, "rgba(14,36,62,1)", 1); hatch(c2, outer, P.cyan, 0.8); stk(c2, outer, COL.cyan, 1.2, 0, 0.8);
      const gl = (c) => { c.rect(oX - 5, g.cylTop, cx - g.plW / 2 - 1 - (oX - 5), g.glandH); c.rect(cx + g.plW / 2 + 1, g.cylTop, oX + g.oW + 5 - (cx + g.plW / 2 + 1), g.glandH); };
      fil(c2, gl, "rgba(14,36,62,1)", 1); hatch(c2, gl, P.cyan, 0.8); stk(c2, gl, COL.cyan, 1.4, 0.4, 0.95);
      fil(c2, (c) => { c.rect(cx - g.plW / 2 - 4, g.cylTop + 5, 3, g.glandH - 10); c.rect(cx + g.plW / 2 + 1, g.cylTop + 5, 3, g.glandH - 10); }, COL.amber, 0.8); // Dichtung
      // Innenrohr mit Drosselbohrungen
      const HH = 5;
      const tube = (c) => {
        for (const sx of [iX, iX + g.iW - g.iw]) {
          let y = top;
          for (const hy of g.holes) { c.rect(sx, y, g.iw, hy - HH / 2 - y); y = hy + HH / 2; }
          c.rect(sx, y, g.iw, g.chBot - y);
        }
      };
      fil(c2, tube, "rgba(20,44,72,1)", 1); stk(c2, tube, COL.steel, 1, 0, 0.9);
      stk(c2, (c) => { c.moveTo(cx, g.cylTop - 2); c.lineTo(cx, g.cylBot + 2); }, COL.cyan, 1, 0, 0.18, { dash: [16, 5, 3, 5] });
    });
    // Glühen der aktiven Drosselbohrungen
    for (let k = 0; k < g.holes.length; k++) {
      const hy = g.holes[k]; const active = hy > pisBot + 2;
      const a = active ? 0.25 + 0.75 * Math.abs(s.flow) : 0.08;
      const col = s.flow < 0 ? COL.cyan : mix(COL.amber, COL.hot, Math.abs(s.flow), 1);
      for (const sx of [iX + g.iw / 2, iX + g.iW - g.iw / 2]) {
        dot(ctx, sx, hy, 9 + 7 * Math.abs(s.flow), s.flow < 0 ? COL.cyan : COL.amber, a * (0.55 + 0.25 * Math.sin(t * 5 + k)));
        fil(ctx, rect(sx - g.iw / 2, hy - 2, g.iw, 4), col, active ? 0.9 : 0.25);
      }
    }
    // Wärmeflimmern am Zylinder
    if (heat > 0.02) {
      stk(ctx, (c) => {
        for (let k = 0; k < 6; k++) {
          const side = k % 2 ? 1 : -1, x0 = cx + side * (g.oW / 2 + 12 + (k >> 1) * 10), q = frac(t * 0.22 + h01(k * 3.3));
          const yb = g.cylBot - 40 - q * 150;
          for (let j = 0; j <= 6; j++) { const y = yb - j * 10, x = x0 + Math.sin(t * 3 + j * 0.9 + k) * 2.5; if (j) c.lineTo(x, y); else c.moveTo(x, y); }
        }
      }, COL.red, 1.4, 0, heat * 0.3);
      dot(ctx, cx, (g.holes[0] + g.chBot) / 2, 120, COL.red, heat * 0.18);
    }
    // Pufferkopf: Platte + Gummiauflage
    const hy = Y_TOP + xb;
    part(ctx, rect(cx - g.plateW / 2, hy + g.padH, g.plateW, g.plateH), "rgba(22,50,80,1)", COL.cyan, 1.8, 0.7, 1);
    part(ctx, (c) => rr(c, cx - g.padW / 2, hy, g.padW, g.padH + 2, 5), "rgba(34,34,46,0.98)", COL.muted, 1.4, 0.3, 1);
  }

  function drawOilFlow(ctx, s, t, g, pisBot, lvl, oX, iX) {
    const cx = BX, flow = s.flow, act = Math.abs(flow);
    const annL = (oX + g.ow + iX) / 2, annR = (iX + g.iW + oX + g.oW - g.ow) / 2;
    const travel = s.xb / 46; // Phasenfortschritt je px Kolbenweg
    const hot = mix(COL.amber, COL.hot, act, 1);
    const colFlow = flow < 0 ? COL.cyan : hot;
    // Strahlen durch die aktiven Drosselbohrungen
    if (act > 0.01) {
      for (let k = 0; k < g.holes.length; k++) {
        const hy = g.holes[k]; if (hy <= pisBot + 2) continue;
        for (const side of [-1, 1]) {
          const xw = cx + side * (g.iW / 2 - g.iw / 2), xa = side > 0 ? annR : annL;
          const fl = 0.75 + 0.25 * Math.sin(t * 23 + k * 1.7 + side);
          stk(ctx, (c) => { c.moveTo(xw - side * 7, hy); c.quadraticCurveTo(xa, hy, xa + side * 3, hy - 7); }, colFlow, 2.2, 1.3, clamp(act * 1.4) * fl);
        }
      }
    }
    ctx.save(); ctx.lineCap = "round";
    // gerichtete Strömung (nur während sich der Kolben bewegt) – gebündelt nach Helligkeitsstufen
    if (act > 0.01) {
      ctx.strokeStyle = colFlow;
      const B = [[], [], [], []];
      for (let i = 0; i < 64; i++) {
        const side = i % 2 ? 1 : -1, j = Math.floor(h01(i * 1.37) * g.holes.length), hy = g.holes[j];
        if (hy <= pisBot + 2) continue;
        const u = frac(h01(i * 3.71) + travel * (0.8 + 0.4 * h01(i * 2.3)));
        const x0 = cx + side * h01(i * 5.1) * (g.pisW / 2 - 8), y0 = clamp(hy + (h01(i * 7.3) - 0.5) * 40, pisBot + 6, g.chBot - 4);
        const xh = cx + side * (g.iW / 2), xa = side > 0 ? annR : annL;
        let x, y, dx = 0, dy = 0, a;
        if (u < 0.3) { const q = u / 0.3; x = lerp(x0, xh - side * 3, q * q); y = lerp(y0, hy, q); dx = side; dy = (hy - y0) / 60; a = q; }
        else if (u < 0.42) { const q = (u - 0.3) / 0.12; x = lerp(xh - side * 3, xa, q); y = hy; dx = side * 2.2; dy = 0; a = 1; }
        else { const q = (u - 0.42) / 0.58; x = xa + Math.sin(q * 9 + i) * 1.5; y = lerp(hy, lvl + 8, q); dx = 0; dy = -1; a = 1 - q * q; }
        const len = (u >= 0.3 && u < 0.42 ? 14 : 7) * (0.4 + act);
        const n = Math.hypot(dx, dy) || 1, ux = (dx / n) * (flow < 0 ? -1 : 1), uy = (dy / n) * (flow < 0 ? -1 : 1);
        const al = a * clamp(act * 1.8); if (al < 0.05) continue;
        B[Math.min(3, Math.floor(al * 4))].push([x - ux * len, y - uy * len, x, y]);
      }
      ctx.lineWidth = 2.2;
      for (let b = 0; b < 4; b++) { if (!B[b].length) continue; ctx.globalAlpha = GA * (b + 1) / 4; ctx.beginPath(); for (const q of B[b]) { ctx.moveTo(q[0], q[1]); ctx.lineTo(q[2], q[3]); } ctx.stroke(); }
    }
    // ruhige Konvektion (immer leicht in Bewegung, stärker bei Wärme)
    ctx.fillStyle = mix(COL.amber, COL.red, s.heatGlow * 0.6, 1);
    ctx.globalAlpha = GA * (0.22 + 0.35 * s.heatGlow); ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1, xa = side > 0 ? annR : annL;
      const q = frac(h01(i * 2.1) + t * (0.03 + 0.03 * h01(i * 4.2)) * (0.5 + s.heatGlow));
      const y = lerp(g.chBot - 6, lvl + 6, q), x = xa + Math.sin(t * 1.4 + i) * 2.5, r = 1.8 * Math.sin(Math.PI * q);
      if (r < 0.3) continue;
      ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fill();
    ctx.restore();
  }

  // Dünne Schraubenfeder (Seitenansicht) von yb (unten) bis yt (oben)
  function drawCoilSimple(ctx, cx, yb, yt, R, turns, color, alpha) {
    const n = Math.round(turns * 20), L0 = yb - yt;
    const P = (i) => { const th = (i / n) * turns * TAU; return [cx + R * Math.cos(th), yb - (i / n) * L0, Math.sin(th)]; };
    const pts = []; for (let i = 0; i <= n; i++) pts.push(P(i));
    stk(ctx, (c) => { for (let i = 1; i <= n; i++) { if (pts[i][2] < 0 || pts[i - 1][2] < 0) { c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); } } }, color, 1.2, 0, alpha * 0.4);
    stk(ctx, (c) => { for (let i = 1; i <= n; i++) { if (pts[i][2] >= 0 && pts[i - 1][2] >= 0) { c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); } } }, color, 2.2, 0.6, alpha);
  }

  // ---------- Federpuffer ----------
  function helixPts(cx, yb, yt, R, wire, turns) {
    const n = Math.round(turns * 30), endT = 0.9, Lc = yb - yt;
    const closed = endT * wire, act = turns - 2 * endT, actLen = Math.max(wire * act, Lc - 2 * closed - wire);
    const pos = (T) => (T <= endT ? T * wire : T >= turns - endT ? closed + actLen + (T - (turns - endT)) * wire : closed + ((T - endT) / act) * actLen);
    const pts = [];
    for (let i = 0; i <= n; i++) { const T = (i / n) * turns, th = T * TAU + Math.PI / 2; pts.push([cx + R * Math.cos(th), yb - wire / 2 - pos(T), Math.sin(th)]); }
    return pts;
  }
  function drawSpringBuf(ctx, L, s, t) {
    const g = s.g, cx = BX, xb = s.xb;
    layer(ctx, "spr-base", cx - 150, g.baseTop - g.spigH - 10, 300, FLOOR - g.baseTop + g.spigH + 14, 1, (c2) => {
      const P = pats(c2);
      const ped = rect(cx - 130, g.pedTop, 260, g.ped);
      fil(c2, ped, "rgba(12,28,50,0.97)", 1); hatch(c2, ped, P.concrete, 1); stk(c2, ped, COL.steel, 1.5, 0.4, 0.85);
      part(c2, rect(cx - g.baseW / 2, g.baseTop, g.baseW, g.pedTop - g.baseTop), "rgba(22,48,78,0.97)", COL.steel, 1.5, 0.4, 1);
      for (const dx of [-g.baseW / 2 + 14, g.baseW / 2 - 14]) { part(c2, rect(cx + dx - 8, g.baseTop - 8, 16, 8), "rgba(22,48,78,0.97)", COL.steel, 1.2, 0, 1); stk(c2, (c) => { c.moveTo(cx + dx, g.pedTop); c.lineTo(cx + dx, FLOOR - 8); }, COL.steel, 2, 0, 0.5, { dash: [4, 3] }); }
    });
    const springTop = g.baseTop - g.Ls + xb;
    const pts = helixPts(cx, g.baseTop, springTop, (g.OD - g.wire) / 2, g.wire, g.turns);
    const stored = s.stored, colS = mix(COL.cyan, COL.amber, smooth(inv(0.1, 0.32, stored)), 1), hex = stored > 0.3 ? COL.amber : COL.cyan;
    const seg = (front) => (c) => { for (let i = 1; i < pts.length; i++) { const f = pts[i][2] >= 0 && pts[i - 1][2] >= 0; if (f === front) { c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); } } };
    // hintere Windungen
    stk(ctx, seg(false), "rgba(90,130,170,0.35)", g.wire * 0.8, 0, 0.7);
    stk(ctx, seg(false), colS, 1.4, 0, 0.45);
    // Zentrierdorn (innen) und Zentrieransatz der Aufsetzplatte
    part(ctx, (c) => rr(c, cx - g.spigW / 2, g.baseTop - g.spigH, g.spigW, g.spigH + 2, 10), "rgba(18,42,70,0.97)", COL.steel, 1.4, 0.3, 1);
    const capTop = Y_TOP + g.padH + xb;
    part(ctx, (c) => rr(c, cx - g.bossW / 2, capTop + g.capH - 2, g.bossW, g.bossH, 6), "rgba(18,42,70,0.97)", COL.steel, 1.4, 0.3, 1);
    // vordere Windungen (Draht als Röhre)
    stk(ctx, seg(true), "rgba(4,12,26,0.96)", g.wire + 3, 0, 1, { cap: "butt" });
    stk(ctx, seg(true), colS, g.wire, 0, 0.26 + 0.2 * stored, { cap: "butt" });
    stk(ctx, seg(true), colS, 2.4, 1 + 1.5 * stored, 0.95);
    if (stored > 0.05) { ctx.save(); ctx.translate(-2, -2); stk(ctx, seg(true), COL.hot, 1, 0, 0.35 * stored); ctx.restore(); dot(ctx, cx, (g.baseTop + springTop) / 2, 150, hex, 0.18 * stored); }
    // Aufsetzplatte + Gummiauflage
    part(ctx, rect(cx - g.capW / 2, capTop, g.capW, g.capH), "rgba(22,50,80,1)", COL.cyan, 1.8, 0.7, 1);
    part(ctx, (c) => rr(c, cx - g.padW / 2, Y_TOP + xb, g.padW, g.padH + 2, 5), "rgba(34,34,46,0.98)", COL.muted, 1.4, 0.3, 1);
    s.springMidY = (g.baseTop + springTop) / 2; s.capTop = capTop;
  }

  // ---------- Polyurethanpuffer ----------
  function puShape(s) {
    const g = s.g, yb = g.baseTop, dl = s.xb, h = g.H0 - dl, yt = yb - h;
    const bulge = 0.3 * (dl / g.H0), ch = 0.13 * h, topW = 0.72 * g.w0;
    const wAt = (y) => { const yn = clamp((yb - y) / h); let w = g.w0 * (1 + bulge * Math.pow(Math.sin(Math.PI * yn), 1.3)); if (yn > 1 - ch / h) { const q = (yn - (1 - ch / h)) / (ch / h); w = lerp(w, topW, q); } return w; };
    return { yb, yt, h, wAt, bulge };
  }
  function drawPU(ctx, L, s, t) {
    const g = s.g, cx = BX;
    layer(ctx, "pu-stand", cx - 150, g.standTop - 4, 300, FLOOR - g.standTop + 8, 1, (c2) => {
      const P = pats(c2);
      part(c2, rect(cx - g.footW / 2, FLOOR - 14, g.footW, 14), "rgba(22,48,78,0.97)", COL.steel, 1.5, 0.4, 1);
      const colR = rect(cx - g.colW / 2, g.standTop + 12, g.colW, FLOOR - 14 - g.standTop - 12);
      fil(c2, colR, "rgba(16,38,64,0.96)", 1); hatch(c2, colR, P.steel, 0.25); stk(c2, colR, COL.steel, 1.6, 0.4, 1);
      stk(c2, (c) => { c.moveTo(cx - g.colW / 2 + 7, g.standTop + 14); c.lineTo(cx - g.colW / 2 + 7, FLOOR - 16); c.moveTo(cx + g.colW / 2 - 7, g.standTop + 14); c.lineTo(cx + g.colW / 2 - 7, FLOOR - 16); }, COL.steel, 1, 0, 0.45, { dash: [8, 5] });
      for (const sd of [-1, 1]) { const gus = polyB([[cx + sd * g.colW / 2, FLOOR - 14], [cx + sd * g.colW / 2, FLOOR - 74], [cx + sd * (g.footW / 2 - 16), FLOOR - 14]], true); part(c2, gus, "rgba(20,44,72,0.95)", COL.steel, 1.3, 0.3, 0.95); }
      part(c2, rect(cx - g.topW / 2, g.standTop, g.topW, 12), "rgba(22,48,78,0.97)", COL.steel, 1.5, 0.4, 1);
      for (const dx of [-g.footW / 2 + 14, g.footW / 2 - 14]) { part(c2, rect(cx + dx - 6, FLOOR - 20, 12, 6), "rgba(22,48,78,0.97)", COL.steel, 1, 0, 1); }
      part(c2, rect(cx - g.baseW / 2, g.baseTop, g.baseW, g.standTop - g.baseTop), "rgba(26,54,86,1)", COL.cyan, 1.5, 0.5, 1);
      for (const dx of [-g.baseW / 2 + 12, g.baseW / 2 - 12]) fil(c2, rect(cx + dx - 5, g.baseTop - 4, 10, 4), COL.steel, 0.9);
    });
    const sh = puShape(s), N = 26;
    const outline = (c) => {
      for (let i = 0; i <= N; i++) { const y = lerp(sh.yb, sh.yt, i / N); const x = cx - sh.wAt(y) / 2; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
      for (let i = N; i >= 0; i--) { const y = lerp(sh.yb, sh.yt, i / N); c.lineTo(cx + sh.wAt(y) / 2, y); }
      c.closePath();
    };
    const e = s.stored, heat = s.heatGlow;
    const gr = ctx.createLinearGradient(0, sh.yt, 0, sh.yb);
    gr.addColorStop(0, mix("#8a5a16", "#d08a24", e, 1)); gr.addColorStop(0.55, mix("#6a4412", "#a86a1c", e, 1)); gr.addColorStop(1, "#4a3010");
    fil(ctx, outline, gr, 0.62);
    // Zellstruktur (wird gestaucht)
    const sq = sh.h / g.H0;
    ctx.save(); ctx.fillStyle = mix(COL.amber, COL.hot, e, 1); ctx.globalAlpha = GA * 0.42; ctx.beginPath();
    for (let r = 0; r < 11; r++) for (let k = -4; k <= 4; k++) {
      const v = (r + 0.55 + (h01(r * 9.1 + k) - 0.5) * 0.5) / 11.4; const y = sh.yb - v * sh.h;
      const w = sh.wAt(y), u = (k + (r % 2 ? 0.5 : 0) + (h01(r * 3.3 + k * 7.7) - 0.5) * 0.45) / 9.6;
      if (Math.abs(u) > 0.44) continue;
      const x = cx + u * w, rx = 2.8 * (w / g.w0), ry = Math.max(0.8, 2.8 * sq);
      ctx.moveTo(x + rx, y); ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    }
    ctx.fill(); ctx.restore();
    // Spannungs-/Wärmeglühen
    if (e > 0.02) dot(ctx, cx, sh.yb - sh.h * 0.5, 130, COL.amber, 0.28 * e);
    if (heat > 0.02) dot(ctx, cx, sh.yb - sh.h * 0.45, 90, COL.red, 0.2 * heat);
    stk(ctx, outline, COL.amber, 2, 1 + e, 0.95);
    // Zentralschraube / Gewindeeinsatz (Röntgen)
    stk(ctx, rect(cx - 9, sh.yb - Math.min(46 * g.S, sh.h * 0.4), 18, Math.min(46 * g.S, sh.h * 0.4)), COL.steel, 1.2, 0, 0.55, { dash: [4, 3] });
    s.puTop = sh.yt; s.puShape = sh;
  }

  // ---------- Bemaßung (Hub / Pufferabstand) ----------
  function drawDimension(ctx, L, s, t, rev) {
    if (rev <= 0) return;
    const g = s.g, info = INFO[s.type], x = g.dimX, y0 = Y_TOP, y1 = Y_TOP + g.strokePx;
    GA *= rev;
    stk(ctx, (c) => { c.moveTo(x - 10, y0); c.lineTo(x + 12, y0); c.moveTo(x - 10, y1); c.lineTo(x + 12, y1); }, COL.muted, 1.2, 0, 0.8);
    stk(ctx, (c) => { c.moveTo(x, y0 + 8); c.lineTo(x, y1 - 8); }, COL.muted, 1.2, 0, 0.8);
    arrowHead(ctx, x, y0, -Math.PI / 2, 9, COL.muted, 0.9); arrowHead(ctx, x, y1, Math.PI / 2, 9, COL.muted, 0.9);
    // aktuelle Einfederung
    if (s.xb > 0.5) {
      stk(ctx, (c) => { c.moveTo(x, y0); c.lineTo(x, y0 + s.xb); }, s.hyd ? COL.red : COL.amber, 4, 1, 0.9, { cap: "butt" });
      stk(ctx, (c) => { c.moveTo(x - 9, y0 + s.xb); c.lineTo(x + 9, y0 + s.xb); }, COL.white, 2, 0.8, 0.9);
    }
    ctx.save(); ctx.translate(x - 14, (y0 + y1) / 2); ctx.rotate(-Math.PI / 2);
    txt(L, ctx, `${info.strokeLbl} ${g.strokeMM} mm`, 0, 0, { size: 16, weight: 600, color: COL.muted, align: "center" });
    ctx.restore();
    // Pufferabstand (nur Normalbetrieb)
    if (s.idle) {
      const ya = s.yS, yb = Y_TOP;
      stk(ctx, (c) => { c.moveTo(x - 10, ya); c.lineTo(x + 12, ya); c.moveTo(x, ya + 8); c.lineTo(x, yb - 8); }, COL.cyan, 1.4, 0.5, 0.9);
      arrowHead(ctx, x, ya, -Math.PI / 2, 9, COL.cyan, 0.95); arrowHead(ctx, x, yb, Math.PI / 2, 9, COL.cyan, 0.95);
      ctx.save(); ctx.translate(x - 14, (ya + yb) / 2); ctx.rotate(-Math.PI / 2);
      txt(L, ctx, "Pufferabstand", 0, 0, { size: 16, weight: 600, color: COL.cyan, align: "center" });
      ctx.restore();
    }
    GA /= rev;
  }

  // ---------- Beschriftungen ----------
  function callout(ctx, L, ax, ay, i, title, sub, prog, color, hot, dy) {
    const p = clamp(prog); if (p <= 0.001) return;
    const left = i === 0, by = CB_Y[i] + (dy || 0);
    const tw = meas(L, ctx, title, { size: 22, weight: 600 }), sw = sub ? meas(L, ctx, sub, { size: 16, weight: 400 }) : 0;
    const w = Math.max(tw, sw) + 40, h = sub ? 62 : 44, y = by - h / 2;
    const bx = left ? LB_R - w : CB_X, ex = left ? LB_R : CB_X, kx = left ? ex + 26 : ex - 26, lp = easeOut(inv(0, 0.5, p));
    const l1 = Math.hypot(kx - ax, by - ay), l2 = Math.abs(ex - kx), tot = l1 + l2, dl = lp * tot;
    const hotA = hot || 0;
    stk(ctx, (c) => { c.moveTo(ax, ay); if (dl <= l1) c.lineTo(lerp(ax, kx, dl / l1), lerp(ay, by, dl / l1)); else { c.lineTo(kx, by); c.lineTo(kx + (left ? 1 : -1) * (dl - l1), by); } }, color, 1.5 + hotA, 0.7 + hotA, 0.9);
    dot(ctx, ax, ay, 12 + 8 * hotA, color, p * (0.8 + 0.2 * hotA));
    fil(ctx, (c) => c.arc(ax, ay, 3.5, 0, TAU), color, p);
    const bp = easeOut(inv(0.3, 0.85, p)); if (bp <= 0) return;
    if (p >= 1) {
      const hq = Math.round(hotA * 4) / 4, key = `co|${title}|${sub}|${color}|${left}|${hq}`;
      const x0 = (left ? ex - w : bx) - 12;
      layer(ctx, key, x0, y - 12, w + 24, h + 24, 1, (g) => boxRaw(g, L, left, ex, bx, y, w, h, title, sub, color, hq));
      return;
    }
    const bw = w * bp, bx0 = left ? ex - bw : bx;
    fil(ctx, (c) => rr(c, bx0, y, bw, h, 6), "rgba(5,14,30,0.88)", bp);
    stk(ctx, (c) => rr(c, bx0, y, bw, h, 6), rgba(color, 0.45 + 0.4 * hotA), 1.3, 0.4 + hotA, bp);
    fil(ctx, rect(left ? ex - 3 : bx, y + 8, 3, h - 16), color, bp);
    const ta = inv(0.55, 1, p);
    const tx = left ? ex - 18 : bx + 18, al = left ? "right" : "left";
    txt(L, ctx, title, tx, y + (sub ? 27 : 29), { size: 22, weight: 600, color: COL.white, alpha: ta, align: al });
    if (sub) txt(L, ctx, sub, tx, y + 50, { size: 16, weight: 400, color: COL.muted, alpha: ta, align: al });
  }
  function boxRaw(ctx, L, left, ex, bx, y, w, h, title, sub, color, hotA) {
    const bx0 = left ? ex - w : bx;
    fil(ctx, (c) => rr(c, bx0, y, w, h, 6), "rgba(5,14,30,0.88)", 1);
    stk(ctx, (c) => rr(c, bx0, y, w, h, 6), rgba(color, 0.45 + 0.4 * hotA), 1.3, 0.4 + hotA, 1);
    fil(ctx, rect(left ? ex - 3 : bx, y + 8, 3, h - 16), color, 1);
    const tx = left ? ex - 18 : bx + 18, al = left ? "right" : "left";
    L.text(ctx, title, tx, y + (sub ? 27 : 29), { size: 22, weight: 600, color: COL.white, align: al });
    if (sub) L.text(ctx, sub, tx, y + 50, { size: 16, weight: 400, color: COL.muted, align: al });
  }
  function drawCallouts(ctx, L, s, t) {
    const g = s.g, d = s.d, rv = (k) => easeOut(inv(0.03 * d + k * 0.045 * d, 0.03 * d + k * 0.045 * d + Math.max(0.5, 0.1 * d), t));
    const act = s.idle ? 0 : clamp(Math.abs(s.flow) * 1.5);
    const rvP = s.leftBox;
    callout(ctx, L, BX - 22, s.yS - PLATE_H - (s.idle ? 44 : 84), 0, "Pufferstempel", "mit Anschlagplatte", rvP, COL.cyan, 0, s.idle ? -18 : 0);
    if (s.type === "hydraulic") {
      const plTop = Y_TOP + g.padH + g.plateH + s.xb, pisBot = g.pis0 + s.xb + g.pisH;
      callout(ctx, L, BX + g.plW / 2, (plTop + g.cylTop) / 2, 1, "Kolbenstange", "taucht in den Zylinder ein", rv(1), COL.cyan, 0);
      callout(ctx, L, BX + (g.iW + g.oW) / 4 + 2, g.lvl0 + 40, 2, "Hydrauliköl", "nimmt die Energie als Wärme auf", rv(2), COL.amber, s.heatGlow * 0.4);
      const hy = clamp(pisBot + 22, g.holes[1], g.holes[6]);
      callout(ctx, L, BX + g.iW / 2, hy, 3, "Drosselbohrungen", s.returning ? "Öl strömt zurück" : "Öl wird hindurchgepresst", rv(3), COL.amber, act);
      callout(ctx, L, BX + g.pisW / 2 - 7, (pisBot + g.chBot) / 2 + 6, 4, "Rückstellfeder", "schiebt den Kolben zurück", rv(4), COL.steel, s.returning ? 0.6 : 0);
    } else if (s.type === "spring") {
      const capTop = s.capTop ?? Y_TOP + g.padH + s.xb;
      callout(ctx, L, BX + g.capW / 2, capTop + g.capH / 2, 1, "Aufsetzplatte", "mit Gummiauflage", rv(1), COL.cyan, 0);
      callout(ctx, L, BX + g.OD / 2 - 2, s.springMidY ?? 620, 2, "Schraubendruckfeder", s.idle ? "speichert Energie beim Einfedern" : "speichert die Energie", rv(2), COL.amber, clamp(s.stored * 1.5));
      callout(ctx, L, BX + g.spigW / 2, g.baseTop - g.spigH * 0.45, 3, "Zentrierdorn", "führt die Feder", rv(3), COL.steel, 0);
      callout(ctx, L, BX + 130, g.pedTop + g.ped * 0.55, 4, "Puffersockel", "in der Schachtgrube verankert", rv(4), COL.steel, 0);
    } else {
      const sh = s.puShape || puShape(s);
      const yA = sh.yt + sh.h * 0.2, yM = sh.yb - sh.h * 0.5;
      callout(ctx, L, BX + sh.wAt(yA) / 2, yA, 1, "Polyurethan-Puffer", "zelliges Elastomer", rv(1), COL.amber, clamp(s.stored * 1.5));
      const bq = s.idle ? 1 : smooth(inv(0.02, 0.09, sh.bulge));
      callout(ctx, L, BX + sh.wAt(yM) / 2, yM, 2, "Ausbauchung", s.idle ? "Block wölbt sich beim Einfedern aus" : "Material weicht seitlich aus", Math.min(rv(2), s.idle ? 1 : Math.max(bq, s.tau > s.ph.tauMax ? 1 : 0)), COL.amber, 0);
      callout(ctx, L, BX + g.baseW / 2, g.baseTop + 5, 3, "Grundplatte", "mit dem Puffer verschraubt", rv(3), COL.steel, 0);
      callout(ctx, L, BX + g.colW / 2, 770, 4, "Pufferstütze", "Stahlkonsole auf dem Grubenboden", rv(4), COL.steel, 0);
    }
  }

  // ---------- Infotafel ----------
  const PHASE = {
    idle: ["NORMALBETRIEB", COL.green], approach: ["ANNÄHERUNG", COL.cyan], throttle: ["ÖL WIRD GEDROSSELT", COL.amber],
    stop: ["STILLSTAND", COL.green], rest: ["RUHELAGE", COL.green], "return": ["RÜCKSTELLUNG", COL.cyan], compress: ["EINFEDERN", COL.amber], rebound: ["RÜCKPRALL", COL.red], settle: ["AUSSCHWINGEN", COL.amber],
  };
  const BAR = { x: PX0 + PIN, y: 612, w: PW - 2 * PIN, h: 34 };
  const PLOT = { x0: PX0 + 84, x1: PX0 + PW - 34, y0: 732, y1: 842 };
  function panelStatic(ctx, L, type) {
    const info = INFO[type], ph = physics(type);
    L.panel(ctx, PX0, 206, PW, 342, { fill: "rgba(5,14,30,0.86)", r: 14 });
    L.text(ctx, "PUFFER IN DER SCHACHTGRUBE", PX0 + PIN, 244, { size: 14, weight: 700, font: L.FONT.mono, color: COL.amber, letterSpacing: 3 });
    L.text(ctx, info.title, PX0 + PIN, 290, { size: 40, weight: 700, font: L.FONT.head, color: COL.white, letterSpacing: 2, glow: 14, glowColor: COL.cyan });
    L.text(ctx, info.sub, PX0 + PIN, 320, { size: 19, weight: 400, color: COL.muted });
    const cw = L.measure(ctx, info.mode, { size: 15, weight: 700, font: L.FONT.mono, letterSpacing: 2 }) + 48;
    fil(ctx, (c) => rr(c, PX0 + PIN, 338, cw, 34, 17), rgba(info.modeCol, 0.14), 1);
    stk(ctx, (c) => rr(c, PX0 + PIN, 338, cw, 34, 17), info.modeCol, 1.5, 0.8, 1);
    fil(ctx, (c) => c.arc(PX0 + PIN + 18, 355, 4.5, 0, TAU), info.modeCol, 1);
    L.text(ctx, info.mode, PX0 + PIN + 32, 361, { size: 15, weight: 700, font: L.FONT.mono, color: info.modeCol, letterSpacing: 2 });
    L.text(ctx, info.use, PX0 + PW - PIN, 361, { size: 16, weight: 400, color: COL.muted, align: "right" });
    stk(ctx, (c) => { c.moveTo(PX0 + PIN, 388); c.lineTo(PX0 + PW - PIN, 388); }, COL.cyan, 1, 0, 0.25);
    const bw = (PW - 2 * PIN - 24) / 3, labels = ["GESCHWINDIGKEIT", "EINFEDERUNG", "PUFFERKRAFT"];
    for (let i = 0; i < 3; i++) {
      const x = PX0 + PIN + i * (bw + 12);
      fil(ctx, (c) => rr(c, x, 436, bw, 96, 8), "rgba(63,210,255,0.05)", 1);
      stk(ctx, (c) => rr(c, x, 436, bw, 96, 8), COL.cyan, 1, 0, 0.3);
      L.text(ctx, labels[i], x + 14, 459, { size: 12, weight: 700, font: L.FONT.mono, color: COL.muted, letterSpacing: 1.5 });
    }
    // Energie + Kennlinie
    L.panel(ctx, PX0, 566, PW, 314, { fill: "rgba(5,14,30,0.86)", r: 14 });
    L.text(ctx, "ENERGIEBILANZ", PX0 + PIN, 598, { size: 14, weight: 700, font: L.FONT.mono, color: COL.amber, letterSpacing: 3 });
    fil(ctx, (c) => rr(c, BAR.x, BAR.y, BAR.w, BAR.h, 8), "rgba(63,210,255,0.05)", 1);
    const leg = type === "hydraulic" ? [["Bewegungsenergie", COL.cyan], ["Wärme", COL.red]] : [["Bewegungsenergie", COL.cyan], ["gespeichert", COL.amber], ["Wärme", COL.red]];
    let lx = PX0 + PIN;
    for (const [lab, c] of leg) { fil(ctx, (cc) => rr(cc, lx, 661, 14, 14, 3), c, 0.9); L.text(ctx, lab, lx + 22, 674, { size: 16, weight: 600, color: COL.white, alpha: 0.9 }); lx += 22 + L.measure(ctx, lab, { size: 16, weight: 600 }) + 28; }
    stk(ctx, (c) => { c.moveTo(PX0 + PIN, 690); c.lineTo(PX0 + PW - PIN, 690); }, COL.cyan, 1, 0, 0.25);
    L.text(ctx, "KRAFT-WEG-KENNLINIE", PX0 + PIN, 716, { size: 13, weight: 700, font: L.FONT.mono, color: COL.muted, letterSpacing: 2.5 });
    L.text(ctx, "Fläche unter der Kurve = Energie", PX0 + PW - PIN, 716, { size: 14, weight: 400, color: COL.muted, align: "right" });
    // Achsen
    const P = PLOT, sx = (mm) => lerp(P.x0, P.x1, mm / info.sMax), sy = (kN) => lerp(P.y1, P.y0, kN / info.fMax);
    info.axF.forEach((f, i) => { if (f > 0) stk(ctx, (c) => { c.moveTo(P.x0, sy(f)); c.lineTo(P.x1, sy(f)); }, COL.muted, 1, 0, 0.14); L.text(ctx, i === info.axF.length - 1 ? f + " kN" : String(f), P.x0 - 10, sy(f) + 5, { size: 13, weight: 700, font: L.FONT.mono, color: COL.muted, align: "right" }); });
    for (const mm of info.axS) { L.text(ctx, String(mm), sx(mm), P.y1 + 20, { size: 13, weight: 700, font: L.FONT.mono, color: COL.muted, align: "center" }); stk(ctx, (c) => { c.moveTo(sx(mm), P.y1); c.lineTo(sx(mm), P.y1 + 5); }, COL.muted, 1, 0, 0.7); }
    stk(ctx, (c) => { c.moveTo(P.x0, P.y0 - 6); c.lineTo(P.x0, P.y1); c.lineTo(P.x1 + 8, P.y1); }, COL.muted, 1.5, 0, 0.8);
    L.text(ctx, "s in mm", P.x1 + 6, P.y1 + 20, { size: 13, weight: 600, color: COL.muted, align: "right" });
    const mg = (ph.m * GN) / 1000;
    stk(ctx, (c) => { c.moveTo(P.x0, sy(mg)); c.lineTo(P.x1, sy(mg)); }, COL.steel, 1, 0, 0.5, { dash: [5, 5] });
    L.text(ctx, "m·g", P.x1 - 2, sy(mg) - 6, { size: 13, weight: 600, color: COL.steel, align: "right", alpha: 0.8 });
  }

  function drawPanel(ctx, L, s, t) {
    const type = s.type, info = INFO[type], ph = s.ph, d = s.d;
    const inA = easeOut(inv(0.05, 0.75, t)); if (inA <= 0) return;
    const dx = (1 - inA) * 40;
    ctx.save(); ctx.translate(dx, 0); GA = inA;
    layer(ctx, "panel|" + type, PX0 - 10, 196, PW + 20, 696, 1, (g) => panelStatic(g, L, type));
    // Status
    const [pl, pc] = PHASE[s.phase] || PHASE.idle;
    const cw = meas(L, ctx, pl, { size: 14, weight: 700, font: L.FONT.mono, letterSpacing: 2 }) + 42;
    const pul = 0.75 + 0.25 * Math.sin(t * 5);
    fil(ctx, (c) => rr(c, PX0 + PIN, 396, cw, 30, 15), rgba(pc, 0.14), 1);
    stk(ctx, (c) => rr(c, PX0 + PIN, 396, cw, 30, 15), pc, 1.4, 0.6, 0.9);
    fil(ctx, (c) => c.arc(PX0 + PIN + 16, 411, 4.5, 0, TAU), pc, pul);
    txt(L, ctx, pl, PX0 + PIN + 28, 416.5, { size: 14, weight: 700, font: L.FONT.mono, color: pc, letterSpacing: 2 });
    let tl;
    if (s.idle) tl = `BEISPIEL · ${ph.m === 1600 ? "1.600" : ph.m} kg · ${fmt(ph.vN, 1)} m/s Nenn`;
    else if (s.returning) tl = "ZEITRAFFER";
    else tl = `ZEITLUPE · t = ${fmt(s.tau, 3)} s`;
    txt(L, ctx, tl, PX0 + PW - PIN, 416, { size: 13, weight: 700, font: L.FONT.mono, color: COL.muted, align: "right", letterSpacing: 1 });
    // Messwerte
    const bw = (PW - 2 * PIN - 24) / 3;
    const vAbs = Math.abs(s.v), vDir = s.idle || vAbs < 0.005 ? 0 : s.v > 0 ? 1 : -1;
    const vals = [
      [fmt(vAbs, 2), "m/s", s.idle ? "steht an der Haltestelle" : vDir > 0 ? "abwärts ↓" : vDir < 0 ? "aufwärts ↑" : "Stillstand", vDir < 0 ? COL.red : COL.cyan],
      [fmt(s.xbMM || 0, 0), "mm", info.strokeSub, s.hyd ? COL.red : COL.amber],
      [fmt((s.F || 0) / 1000, 1), "kN", s.ap > 0.001 ? `Spitze ${fmt(s.ap, 2)} g Verzög.` : "noch kein Kontakt", COL.amber],
    ];
    if (s.idle) vals[2][2] = "Puffer entlastet";
    if (s.returning) vals[2][2] = s.F > 1 ? "Fahrkorb liegt noch auf" : "Puffer entlastet";
    for (let i = 0; i < 3; i++) {
      const x = PX0 + PIN + i * (bw + 12), [v, u, sub, c] = vals[i];
      txt(L, ctx, v, x + 14, 502, { size: 36, weight: 700, font: L.FONT.mono, color: c });
      const vw = meas(L, ctx, v, { size: 36, weight: 700, font: L.FONT.mono });
      txt(L, ctx, u, x + 20 + vw, 502, { size: 16, weight: 600, color: COL.muted });
      txt(L, ctx, sub, x + 14, 522, { size: 13.5, weight: 400, color: COL.muted });
    }
    // Energiebalken
    drawEnergy(ctx, L, s, t);
    drawCurve(ctx, L, s, t);
    GA = 1; ctx.restore();
  }

  function drawEnergy(ctx, L, s, t) {
    const B = BAR, ph = s.ph;
    let kin = s.kin, st = s.stor, ht = s.heat, ghost = false;
    if (s.idle) { kin = ph.kinR; st = ph.storR; ht = ph.heatR; ghost = true; }
    const segs = [[kin, COL.cyan], [st, COL.amber], [ht, COL.red]];
    ctx.save(); ctx.beginPath(); rr(ctx, B.x, B.y, B.w, B.h, 8); ctx.clip();
    let x = B.x;
    for (const [f, c] of segs) {
      const w = B.w * f; if (w < 0.5) continue;
      if (ghost) { hatchFill(ctx, x, B.y, w, B.h, c); }
      else {
        const gr = ctx.createLinearGradient(0, B.y, 0, B.y + B.h); gr.addColorStop(0, rgba(c, 0.95)); gr.addColorStop(1, rgba(c, 0.6));
        fil(ctx, rect(x, B.y, w, B.h), gr, 0.9);
      }
      x += w;
    }
    // Schimmer
    const sx = B.x + frac(t * 0.35) * (B.w + 160) - 80;
    const sg = ctx.createLinearGradient(sx - 60, 0, sx + 60, 0); sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(0.5, "rgba(255,255,255,0.22)"); sg.addColorStop(1, "rgba(255,255,255,0)");
    fil(ctx, rect(B.x, B.y, B.w, B.h), sg, ghost ? 0.3 : 1);
    ctx.restore();
    stk(ctx, (c) => rr(c, B.x, B.y, B.w, B.h, 8), COL.cyan, 1.2, 0.4, 0.55);
    // Prozentangaben
    x = B.x;
    for (const [f, c] of segs) {
      const w = B.w * f;
      if (w > 64) txt(L, ctx, `${Math.round(f * 100)} %`, x + w / 2, B.y + B.h / 2 + 6.5, { size: 17, weight: 700, font: L.FONT.mono, color: ghost ? c : "#04101f", align: "center", alpha: ghost ? 0.95 : 0.92 });
      x += w;
    }
    // Aussage
    let msg = "", mc = COL.white;
    if (s.idle) msg = s.hyd ? "beim Aufprall: alles wird zu Wärme" : "beim Aufprall: gespeichert, dann zurück";
    else if (s.phase === "approach") { msg = "Fahrkorb in Bewegung"; mc = COL.cyan; }
    else if (s.hyd) { if (s.tau < ph.tauR) { msg = "Bewegungsenergie wird zu Wärme"; mc = COL.amber; } else { msg = "100 % in Wärme – kein Rückprall"; mc = COL.red; } }
    else if (s.tau < ph.tauMax) { msg = "Energie wird gespeichert"; mc = COL.amber; }
    else if (s.tau < ph.tauR) { msg = "Feder gibt Energie zurück"; mc = COL.red; if (s.type === "polyurethane") msg = "Block gibt Energie zurück"; }
    else { msg = `${Math.round(ph.kinR * 100)} % zurück → Rückprall`; mc = COL.red; }
    msg = msg.replace("→", "–");
    txt(L, ctx, msg, PX0 + PW - PIN, 598, { size: 16, weight: 600, color: mc, align: "right" });
  }
  function hatchFill(ctx, x, y, w, h, c) {
    fil(ctx, rect(x, y, w, h), rgba(c, 0.12), 1);
    stk(ctx, (cc) => { for (let k = -h; k < w; k += 9) { cc.moveTo(x + k, y + h); cc.lineTo(x + k + h, y); } }, c, 1.2, 0, 0.45, { cap: "butt" });
  }

  function drawCurve(ctx, L, s, t) {
    const info = INFO[s.type], ph = s.ph, P = PLOT;
    const sx = (m) => lerp(P.x0, P.x1, clamp((m * 1000) / info.sMax, 0, 1.02)), sy = (N) => lerp(P.y1, P.y0, clamp(N / 1000 / info.fMax, 0, 1.05));
    const tauEnd = s.idle ? ph.tauR : clamp(s.tau, 0, ph.TEND);
    const ghost = s.idle;
    if (!s.idle && s.tau < 0) {
      // noch kein Kontakt: pulsierender Punkt im Ursprung
      dot(ctx, P.x0, P.y1, 12, COL.cyan, 0.5 + 0.3 * Math.sin(t * 5));
      return;
    }
    const stepA = 0.002;
    const tMax = Math.min(tauEnd, ph.tauMax), tR = Math.min(tauEnd, ph.tauR);
    const load = []; for (let tau = 0; tau <= tMax + 1e-9; tau += stepA) { const q = sampleP(ph, tau); load.push([sx(q.x), sy(q.F)]); }
    { const q = sampleP(ph, tMax); load.push([sx(q.x), sy(q.F)]); }
    const unload = []; if (tauEnd > ph.tauMax && !s.hyd) { for (let tau = ph.tauMax; tau <= tR + 1e-9; tau += stepA) { const q = sampleP(ph, tau); unload.push([sx(q.x), sy(q.F)]); } const q = sampleP(ph, tR); unload.push([sx(q.x), sy(q.F)]); }
    const under = (pts) => (c) => { c.moveTo(pts[0][0], P.y1); for (const p of pts) c.lineTo(p[0], p[1]); c.lineTo(pts[pts.length - 1][0], P.y1); c.closePath(); };
    const fa = ghost ? 0.18 : 0.34;
    if (s.hyd) fil(ctx, under(load), COL.red, fa);
    else {
      fil(ctx, under(load), COL.amber, fa);
      if (unload.length > 1) {
        // Hystereseschleife (bereits durchlaufen) = Wärme
        const xc = unload[unload.length - 1][0];
        const lr = []; for (let i = 0; i < load.length; i++) if (load[i][0] >= xc) lr.push(load[i]);
        fil(ctx, (c) => { unload.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); for (let i = 0; i < lr.length; i++) c.lineTo(lr[i][0], lr[i][1]); c.closePath(); }, COL.red, ghost ? 0.3 : 0.55);
      }
    }
    // spätere Zyklen (dünn)
    if (!s.hyd && tauEnd > ph.tauR && !ghost) {
      stk(ctx, (c) => { let first = true; for (let tau = ph.tauR; tau <= tauEnd; tau += 0.004) { const q = sampleP(ph, tau); const X = sx(Math.max(0, q.x)), Y = sy(q.F); if (first) { c.moveTo(X, Y); first = false; } else c.lineTo(X, Y); } }, COL.amber, 1, 0, 0.35);
    }
    const lc = s.hyd ? COL.red : COL.amber;
    stk(ctx, polyB(load), lc, 2.4, 1, ghost ? 0.5 : 1, ghost ? { dash: [6, 5] } : undefined);
    if (unload.length > 1) stk(ctx, polyB(unload), COL.cyan, 2.2, 1, ghost ? 0.5 : 1, ghost ? { dash: [6, 5] } : undefined);
    // Beschriftung der Flächen
    const lblA = ghost ? 0.7 : smooth(inv(0.05, 0.4, tMax / ph.tauMax));
    if (s.hyd) txt(L, ctx, "Wärme", lerp(P.x0, load[load.length - 1][0], 0.5), P.y1 - 14, { size: 15, weight: 700, color: COL.red, align: "center", alpha: lblA });
    else {
      const xm = sx(ph.xMax);
      if (unload.length > 1 || ghost) {
        txt(L, ctx, s.type === "spring" ? "zurück" : "zurück", lerp(P.x0, xm, 0.55), P.y1 - 10, { size: 14, weight: 700, color: COL.amber, align: "center", alpha: lblA });
        if (ph.heatR > 0.2) txt(L, ctx, "Wärme", xm + 12, sy(ph.m * GN * 1.6), { size: 14, weight: 700, color: COL.red, alpha: lblA * inv(ph.tauMax, ph.tauR, ghost ? ph.tauR : tauEnd) });
      } else txt(L, ctx, "gespeichert", lerp(P.x0, load[load.length - 1][0], 0.6), P.y1 - 10, { size: 14, weight: 700, color: COL.amber, align: "center", alpha: lblA });
    }
    // aktueller Punkt
    if (!ghost) {
      const q = sampleP(ph, tauEnd); let X = sx(Math.max(0, q.x)), Y = sy(q.F);
      if (s.returning) { X = sx(s.xbMM / 1000); Y = sy(s.F); }
      dot(ctx, X, Y, 16, COL.white, 0.6 + 0.2 * Math.sin(t * 6)); fil(ctx, (c) => c.arc(X, Y, 4, 0, TAU), COL.white, 1);
    } else {
      const u = frac(t / 3.2), tau = u * ph.tauR, q = sampleP(ph, tau);
      dot(ctx, sx(q.x), sy(q.F), 12, COL.white, 0.45 * Math.sin(Math.PI * u));
    }
  }

  // ---------- Registrierung ----------
  CE.register("buffer", {
    ownsText: false,
    draw(ctx, p) {
      const L = p.L || CE.lib;
      const cfg = config(p.params);
      const d = Math.max(0.5, num(p.d, 8)), t = clamp(num(p.t, 0), 0, d + 5);
      GA = 1;
      const s = computeState(t, d, cfg);
      s.leftBox = !cfg.labels ? 0 : s.idle ? easeOut(inv(0.03 * d, 0.03 * d + Math.max(0.5, 0.1 * d), t)) : easeOut(inv(s.tm.tC - 0.06 * d, s.tm.tC - 0.06 * d + Math.max(0.5, 0.1 * d), t));
      const SK = (window.__BUF_SKIP || "");
      if (!SK.includes("fx")) drawFX(ctx, s, t);
      ctx.save();
      if (s.shake > 0.05) ctx.translate(Math.sin(t * 97) * s.shake, Math.cos(t * 83) * s.shake * 0.7);
      if (!SK.includes("pit")) drawPit(ctx, L);
      if (!SK.includes("gov")) drawGovRope(ctx, s);
      if (!SK.includes("buf")) { if (s.type === "hydraulic") drawHydraulic(ctx, L, s, t);
      else if (s.type === "spring") drawSpringBuf(ctx, L, s, t);
      else drawPU(ctx, L, s, t); }
      if (!SK.includes("car")) drawCar(ctx, L, s);
      if (!SK.includes("cue")) drawMotionCues(ctx, s, t);
      if (!SK.includes("imp")) drawImpact(ctx, s);
      if (!SK.includes("dim")) drawDimension(ctx, L, s, t, easeOut(inv(0.04 * d, 0.04 * d + 0.6, t)));
      ctx.restore();
      if (cfg.labels && !SK.includes("cal")) drawCallouts(ctx, L, s, t);
      if (cfg.panel && !SK.includes("pan")) drawPanel(ctx, L, s, t);
      GA = 1;
    },
  });
})();
