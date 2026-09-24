/* Template "safety_gear" – Fangvorrichtung in Nahaufnahme, Schnitt durch den Steg der Führungsschiene (T-Profil).
   Die Kamera fährt mit dem Fahrkorb mit: die Führungsschiene läuft nach oben durchs Bild.
   Bremsfangvorrichtung (progressiv): zwei Fangkeile auf Rollenbahnen, Druckstücke, Tellerfederpakete (begrenzen die
     Klemmkraft), fester Keilanschlag; Hubtraverse mit Langlöchern, Auslösehebel, Begrenzerseil mit Seilklemme.
   Sperrfangvorrichtung (sofort wirkend): gerändelte Klemmrolle auf schräger Laufbahn, feste Gegenbacke, schwimmendes
     starres Gehäuse ohne Federpaket – Stopp auf wenigen Zentimetern.
   Anzeigen: Maßband am Steg (Fangbeginn -> Bremsweg), Messwerte v / Verzögerung / Bremsweg, a(t)-Diagramm mit
     zulässigem Bereich 0,2–1,0 g, Draufsicht auf das T-Profil, Einbaulage am Fahrkorbrahmen.
   Params:
     type      "progressive" | "instantaneous" (Default progressive; Aliase: bremsfang, progressiv, sperrfang, sofort …)
     engaging  bool (Default true) – Auslösung, Keile greifen, Bremsen bis Stillstand; false = Normalfahrt, Keile offen
     sparks    bool (Default true) – Funken/Glut an der Reibstelle (Wärmeglühen bleibt)
   Physik (Beispielwerte, Zeitlupe): progressiv v = 1,30 m/s bei Fangbeginn, ca. 0,6 g, Bremsweg ca. 15 cm;
     sofort wirkend v = 0,80 m/s, Spitze ca. 2,3 g, Bremsweg ca. 3 cm. */
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
  const h01 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const fmt = (v, dec) => { const f = Math.pow(10, dec); return (Math.round(Math.max(0, v) * f) / f).toFixed(dec).replace(".", ","); };

  const COL = { cyan: "#3fd2ff", amber: "#ffb347", red: "#ff5a5f", white: "#eef6ff", muted: "#8fb3d9", steel: "#9fc4e6", rope: "#d4ebff", green: "#5be49b", hot: "#fff1cf" };
  const RGB = {};
  const rgb = (hex) => { let c = RGB[hex]; if (!c) { const n = parseInt(hex.slice(1), 16); c = RGB[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; } return c; };
  const rgba = (hex, a) => { const c = rgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  const mix = (h1, h2, t, a = 1) => { const c1 = rgb(h1), c2 = rgb(h2); t = clamp(t); return `rgba(${Math.round(lerp(c1[0], c2[0], t))},${Math.round(lerp(c1[1], c2[1], t))},${Math.round(lerp(c1[2], c2[2], t))},${a})`; };
  const heatCol = (q, a) => (q < 0.5 ? mix(COL.red, COL.amber, q * 2, a) : mix(COL.amber, COL.hot, (q - 0.5) * 2, a));

  // ---------- Layout (px) ----------
  const RX = 680, CY = 590;                 // Schienenmitte, Mitte Fanggehäuse
  const HW = 195, HT = CY - 150, HB = CY + 150, WALL = 18, PL = 22; // Gehäuse
  const BH = 12;                            // halbe Stegdicke (16 mm)
  const S = 1.5;                            // px je mm (Schienenweg, Maßband)
  const ROPE_X = RX + 300;
  const PIV = [RX - 250, CY + 250], PIN_R = 250, ROPE_R = 550; // Auslösehebel: Drehpunkt, Hebelarme
  const TR_Y0 = CY + 226, TR_H = 14, SLOT = 28;                // Hubtraverse, Langloch
  // Bremsfang (progressiv)
  const GAP = 8, TANA = 0.25, DMAX = 8, WH = 140, WT0 = 14, WY0 = CY - 40;
  const HC_P = GAP / TANA, HMAX_P = HC_P + DMAX / TANA;
  const BLK_T = CY - 100, BLK_B = CY + 112, BLK_O = 112, STOP_Y = CY - 104;
  const SPR_Y = [CY + 6], SPR_RO = 54, SPR_RI = 6, NDISC = 6;
  const ROD_P = 132, LEAD_P = 4;
  // Sperrfang (sofort wirkend)
  const RR = 26, TANB = 0.25, GR = 5, GL = 5, YR0 = CY + 40;
  const HC_I = GR / TANB, H2_I = GL / TANB, ROD_I = 182, LEAD_I = 4;
  // Panels
  const PX = 1270, PW = 560, P1Y = 205, P1H = 420, P2Y = 645, P2H = 260;
  const LBX = 452, RBX = 1010; // Kante der Beschriftungsboxen links / rechts

  // ---------- Zeichen-Helfer (Gruppen-Alpha GA) ----------
  let GA = 1;
  function stk(ctx, build, color, w, glow, alpha, o) {
    const a = GA * (alpha == null ? 1 : alpha); if (a <= 0.004) return;
    ctx.save(); ctx.lineCap = (o && o.cap) || "round"; ctx.lineJoin = "round"; ctx.strokeStyle = color;
    if (o && o.dash) { ctx.setLineDash(o.dash); ctx.lineDashOffset = o.off || 0; }
    ctx.beginPath(); build(ctx);
    if (glow > 0) { ctx.globalAlpha = a * Math.min(1, 0.22 * glow); ctx.lineWidth = w * 3.4; ctx.stroke(); }
    ctx.globalAlpha = a; ctx.lineWidth = w; ctx.stroke(); ctx.restore();
  }
  function fil(ctx, build, fill, alpha, rule) { const a = GA * (alpha == null ? 1 : alpha); if (a <= 0.004) return; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = fill; ctx.beginPath(); build(ctx); ctx.fill(rule || "nonzero"); ctx.restore(); }
  function txt(L, ctx, s, x, y, o) { const a = GA * (o.alpha == null ? 1 : o.alpha); if (a <= 0.004) return; L.text(ctx, s, x, y, Object.assign({}, o, { alpha: a })); }
  function dot(ctx, x, y, r, color, alpha) {
    const a = GA * alpha; if (a <= 0.004 || r <= 0.5) return;
    const img = glowImg(color);
    if (img) { ctx.save(); ctx.globalAlpha = Math.min(1, a); ctx.drawImage(img, x - r, y - r, 2 * r, 2 * r); ctx.restore(); return; }
    ctx.save(); ctx.globalAlpha = Math.min(1, a); const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, 0.95)); g.addColorStop(0.3, rgba(color, 0.4)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
  }
  // Statische Texte als Sprite (nur für wiederkehrende Zeichenketten – Zahlenwerte bleiben live)
  function stxt(L, ctx, str, x, y, o) {
    const a = GA * (o.alpha == null ? 1 : o.alpha); if (a <= 0.004 || !str) return;
    const size = o.size || 40, key = "tx|" + str + "|" + size + "|" + (o.weight || 600) + "|" + (o.font || "") + "|" + (o.color || "") + "|" + (o.letterSpacing || 0);
    const w = meas(L, ctx, str, o) + 8, h = Math.ceil(size * 1.6), base = Math.ceil(size * 1.15);
    const cv = sprite(key, w, h, (g) => L.text(g, str, 4, base, Object.assign({}, o, { align: "left", alpha: 1 })));
    if (!cv) { txt(L, ctx, str, x, y, o); return; }
    const al = o.align || "left", x0 = al === "right" ? x - (w - 8) - 4 : al === "center" ? x - (w - 8) / 2 - 4 : x - 4;
    ctx.save(); ctx.globalAlpha = Math.min(1, a); ctx.drawImage(cv, x0, y - base); ctx.restore();
  }
  const GLOWS = {};
  function glowImg(color) {
    if (GLOWS[color] !== undefined) return GLOWS[color];
    let cv = null;
    try { cv = document.createElement("canvas"); cv.width = cv.height = 128; const g = cv.getContext("2d"); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, rgba(color, 0.95)); gr.addColorStop(0.3, rgba(color, 0.4)); gr.addColorStop(1, rgba(color, 0)); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); } catch (e) { cv = null; }
    GLOWS[color] = cv; return cv;
  }
  const rr = (c, x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  const polyB = (pts, close) => (c) => { pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); if (close) c.closePath(); };
  function arrowHead(ctx, x, y, ang, size, color, alpha) {
    fil(ctx, (c) => { c.moveTo(x, y); c.lineTo(x - Math.cos(ang - 0.42) * size, y - Math.sin(ang - 0.42) * size); c.lineTo(x - Math.cos(ang + 0.42) * size, y - Math.sin(ang + 0.42) * size); c.closePath(); }, color, alpha);
  }
  function springB(x1, y1, x2, y2, coils, amp) {
    return (c) => {
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
      const lead = Math.min(8, len * 0.12), body = len - 2 * lead, n = coils * 2;
      c.moveTo(x1, y1); c.lineTo(x1 + ux * lead, y1 + uy * lead);
      for (let k = 1; k < n; k++) { const s = lead + body * (k / n), sd = k % 2 ? 1 : -1; c.lineTo(x1 + ux * s + nx * amp * sd, y1 + uy * s + ny * amp * sd); }
      c.lineTo(x2 - ux * lead, y2 - uy * lead); c.lineTo(x2, y2);
    };
  }
  const edgeFade = (y) => smooth(inv(50, 190, y)) * (1 - smooth(inv(870, 1010, y)));
  function vGrad(ctx, color, a, y0, y1) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, rgba(color, 0)); g.addColorStop(0.15, rgba(color, a)); g.addColorStop(0.82, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
    return g;
  }

  // Verläufe mit festen Koordinaten je Kontext cachen
  const GRD = new WeakMap();
  function cgrad(ctx, key, make) { let m = GRD.get(ctx); if (!m) { m = {}; GRD.set(ctx, m); } return m[key] || (m[key] = make()); }

  // ---------- Schraffur-Muster (Schnittflächen) ----------
  const PATS = new WeakMap();
  function pats(ctx) {
    let p = PATS.get(ctx); if (p) return p;
    const mk = (color, gap, lw, flip) => {
      try {
        const c = document.createElement("canvas"); c.width = gap; c.height = gap; const g = c.getContext("2d");
        g.strokeStyle = color; g.lineWidth = lw; g.beginPath();
        if (!flip) { g.moveTo(-1, gap + 1); g.lineTo(gap + 1, -1); g.moveTo(-3, 3); g.lineTo(3, -3); g.moveTo(gap - 3, gap + 3); g.lineTo(gap + 3, gap - 3); }
        else { g.moveTo(-1, -1); g.lineTo(gap + 1, gap + 1); g.moveTo(gap - 3, -3); g.lineTo(gap + 3, 3); g.moveTo(-3, gap - 3); g.lineTo(3, gap + 3); }
        g.stroke(); return ctx.createPattern(c, "repeat");
      } catch (e) { return null; }
    };
    p = { cyan: mk("rgba(63,210,255,0.55)", 10, 1.1, false), steel: mk("rgba(159,196,230,0.5)", 8, 1, true), amber: mk("rgba(255,179,71,0.65)", 8, 1.1, true), rail: mk("rgba(159,196,230,0.42)", 11, 1, false) };
    PATS.set(ctx, p); return p;
  }
  function hatch(ctx, build, pat, ox, oy, alpha) {
    if (!pat) return;
    try { if (pat.setTransform) pat.setTransform(new DOMMatrix([1, 0, 0, 1, ox, oy])); } catch (e) { /* ohne Transform */ }
    fil(ctx, build, pat, alpha);
  }

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
    if (SPR.size > 220) SPR.clear();
    SPR.set(key, cv);
    return cv;
  }
  function layer(ctx, key, x0, y0, w, h, alpha, drawFn) {
    const a = GA * alpha; if (a <= 0.004) return;
    const cv = sprite(key, w, h, (g) => { g.translate(-x0, -y0); drawFn(g); });
    if (cv) { ctx.save(); ctx.globalAlpha = a; ctx.drawImage(cv, x0, y0); ctx.restore(); }
    else { const sG = GA; GA = a; drawFn(ctx); GA = sG; }
  }
  const MEAS = new Map();
  function meas(L, ctx, text, o) { const k = text + "|" + (o.size || 40) + "|" + (o.weight || 600) + "|" + (o.font || "") + "|" + (o.letterSpacing || 0); let w = MEAS.get(k); if (w == null) { w = L.measure(ctx, text, o); if (MEAS.size > 300) MEAS.clear(); MEAS.set(k, w); } return w; }

  // ---------- Parameter ----------
  function num(v, def) { const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : Number(v); return Number.isFinite(n) ? n : def; }
  function bool(v) {
    if (v === undefined || v === null || v === "") return undefined;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    const s = String(v).trim().toLowerCase();
    if (["true", "1", "ja", "yes", "y", "on", "wahr", "an"].includes(s)) return true;
    if (["false", "0", "nein", "no", "n", "off", "falsch", "aus"].includes(s)) return false;
    return undefined;
  }
  function pick(P, keys) { for (const k of keys) { const v = P[k]; if (v !== undefined && v !== null && v !== "") return v; } return undefined; }
  function config(P) {
    P = P && typeof P === "object" ? P : {};
    const ty = String(pick(P, ["type", "typ", "kind", "variant", "art", "mode", "gear_type", "gearType"]) ?? "progressive").toLowerCase();
    const inst = /inst|sofort|sperr|sudden|immediate|rolle|roller|block|abrupt/.test(ty);
    const e = bool(pick(P, ["engaging", "engaged", "engage", "active", "triggered", "tripped", "ausgeloest", "ausgelöst", "fangen", "greift"]));
    const sp = bool(pick(P, ["sparks", "spark", "funken", "sparks_on"]));
    return { type: inst ? "instantaneous" : "progressive", engaging: e === undefined ? true : e, sparks: sp === undefined ? true : sp };
  }

  // ---------- Physik (physikalische Zeit tau ab Fangbeginn) ----------
  const PROF = {};
  function integrate(vC, aF, tauMax, aRef) {
    const dt = 0.0002; let v = vC, x = 0, tau = 0, aMax = 0; const V = [], X = [], A = [];
    while (v > 0 && tau < tauMax) { const a = Math.max(0, aF(tau)); V.push(v); X.push(x); A.push(a); aMax = Math.max(aMax, a); v -= a * GN * dt; x += Math.max(0, v) * dt * 1000; tau += dt; }
    V.push(0); X.push(x); A.push(0);
    return { vC, dt, tauStop: tau, sStop: x, V, X, A, aMax, aAvg: vC / (GN * Math.max(1e-6, tau)), aRef };
  }
  function profile(type) {
    if (PROF[type]) return PROF[type];
    let pr;
    if (type === "instantaneous") {
      const vC = 0.8, aPk = 2.3, tS = (2 * vC) / (aPk * GN);
      pr = integrate(vC, (tau) => aPk * Math.pow(Math.sin(Math.PI * clamp(tau / tS)), 2) + 0.02, 0.3, aPk);
    } else {
      const vC = 1.3;
      pr = integrate(vC, (tau) => {
        const r = smooth(tau / 0.013);
        return r * (0.6 - 0.05 * tau / 0.22) + 0.16 * Math.exp(-Math.pow((tau - 0.017) / 0.009, 2)) + r * (0.022 * Math.sin(tau * 260) + 0.014 * Math.sin(tau * 610 + 1.3));
      }, 0.8, 0.6);
    }
    PROF[type] = pr; return pr;
  }
  function sampleP(pr, tau) {
    const n = pr.V.length - 1, i = clamp(tau / pr.dt, 0, n), i0 = Math.floor(i), i1 = Math.min(n, i0 + 1), f = i - i0;
    return { v: lerp(pr.V[i0], pr.V[i1], f), x: lerp(pr.X[i0], pr.X[i1], f), a: lerp(pr.A[i0], pr.A[i1], f) };
  }
  function timing(d, type) {
    const ref = profile("progressive");
    const tTrip = 0.12 * d, tCon = 0.22 * d, k = (0.3 * d) / ref.tauStop; // k: Bildschirm-s je physikalische s (Zeitlupe)
    const pr = profile(type);
    return { tTrip, tCon, k, tStop: tCon + pr.tauStop * k, pr };
  }

  // ---------- Zustand pro Frame ----------
  function computeState(t, d, cfg) {
    const inst = cfg.type === "instantaneous";
    const tm = timing(d, cfg.type), pr = tm.pr;
    const s = { inst, t, d, tm, pr, eng: cfg.engaging, cfg };
    if (!cfg.engaging) { s.phase = "normal"; s.v = inst ? 0.63 : 1.0; s.xmm = (s.v * 1000 * t) / tm.k; s.a = 0; s.tau = -1; }
    else {
      const tau = (t - tm.tCon) / tm.k; s.tau = tau;
      if (tau < 0) {
        const tau0 = -tm.tCon / tm.k, vS = pr.vC - (inst ? 0.15 : 0.2), aPre = (pr.vC - vS) / Math.max(1e-6, -tau0);
        s.v = pr.vC + aPre * tau; s.xmm = (pr.vC * tau + 0.5 * aPre * tau * tau) * 1000; s.a = 0;
        s.phase = t < tm.tTrip ? "over" : "trip";
      } else if (tau < pr.tauStop) { const q = sampleP(pr, tau); s.v = q.v; s.xmm = q.x; s.a = q.a; s.phase = "brake"; }
      else { s.v = 0; s.xmm = pr.sStop; s.a = 0; s.phase = "stop"; }
    }
    s.D = s.xmm * S; s.Dp = Math.max(0, s.D);
    s.speedPx = (s.v * 1000 * S) / tm.k;
    const hC = inst ? HC_I : HC_P;
    if (!cfg.engaging || s.phase === "over") { s.h = 0; s.L = 0; }
    else if (s.phase === "trip") { s.h = hC * smooth(inv(tm.tTrip, tm.tCon, t)); s.L = s.h; }
    else if (inst) { s.h = hC + Math.min(s.Dp / 2, H2_I); s.L = hC + Math.min(s.Dp / 2, LEAD_I); }
    else { s.h = hC + Math.min(s.Dp, HMAX_P - HC_P); s.L = hC + Math.min(s.Dp, LEAD_P); }
    s.delta = inst ? 0 : clamp((s.h - HC_P) * TANA, 0, DMAX);
    s.shift = inst ? clamp((s.h - HC_I) * TANB, 0, GL) : 0;
    s.ox = -s.shift;
    s.cf = inst ? s.shift / GL : s.delta / DMAX;
    s.contact = cfg.engaging && t >= tm.tCon;
    s.theta = Math.asin(clamp(s.L / PIN_R, 0, 0.8));
    s.ropeRise = ROPE_R * Math.sin(s.theta);
    const tb = Math.max(0.05, tm.tStop - tm.tCon);
    if (s.contact) {
      const hin = smooth(inv(tm.tCon, tm.tCon + (inst ? 1 : 0.6) * tb, t));
      const cool = smooth(inv(tm.tStop, d + 1, t));
      s.heat = hin * (1 - 0.5 * cool) * (inst ? 0.8 : 1);
    } else s.heat = 0;
    s.power = s.phase === "brake" ? clamp((s.v / pr.vC) * (s.a / pr.aRef) * 1.4) : 0;
    let amp = 0;
    if (s.contact) {
      if (inst) amp = (s.phase === "brake" ? 6 * (s.a / pr.aRef) : 0) + (t >= tm.tStop ? 7 * Math.exp(-(t - tm.tStop) * 10) : 0);
      else amp = 2.4 * Math.exp(-(t - tm.tCon) * 6);
    }
    s.shx = amp * Math.sin(t * 91); s.shy = amp * 0.7 * Math.cos(t * 113);
    return s;
  }

  // ---------- Hintergrund-Bewegung ----------
  function drawFX(ctx, s, t) {
    const len = clamp(s.speedPx * 0.11, 1.5, 70);
    ctx.save(); ctx.lineCap = "round"; ctx.strokeStyle = COL.cyan; ctx.lineWidth = 1.6;
    for (let b = 0; b < 3; b++) {
      ctx.beginPath(); let any = false;
      for (let i = b; i < 46; i += 3) {
        const x = 470 + h01(i * 1.73 + 0.3) * 580; if (Math.abs(x - RX) < 22 || Math.abs(x - ROPE_X) < 12) continue;
        const span = 1180; const y = (((h01(i * 5.31 + 1.1) * span - s.D) % span) + span) % span - 60;
        if (y < 90 || y > 960) continue;
        ctx.moveTo(x, y); ctx.lineTo(x, y + len); any = true;
      }
      if (any) { ctx.globalAlpha = GA * (0.12 + 0.08 * b); ctx.stroke(); }
    }
    ctx.restore();
    // Röntgen-Scan: weiches Band, das langsam über die Baugruppe läuft
    const ys = 250 + ((t * 95) % 660), xa = RX - HW - 60, xb = RX + HW + 360;
    const g = ctx.createLinearGradient(xa, 0, xb, 0);
    g.addColorStop(0, "rgba(63,210,255,0)"); g.addColorStop(0.2, "rgba(63,210,255,1)"); g.addColorStop(0.75, "rgba(63,210,255,1)"); g.addColorStop(1, "rgba(63,210,255,0)");
    stk(ctx, (c) => { c.moveTo(xa, ys); c.lineTo(xb, ys); }, g, 1.2, 0, 0.13, { cap: "butt" });
    stk(ctx, (c) => { c.moveTo(xa, ys - 14); c.lineTo(xb, ys - 14); }, g, 26, 0, 0.022, { cap: "butt" });
  }

  // Fahrtrichtung: laufende Winkel neben dem Gehäuse (Fahrkorb fährt abwärts)
  function drawDirection(ctx, L, s) {
    const a = clamp(s.v / 0.25) * (s.phase === "stop" ? 0 : 1); if (a <= 0.01) return;
    const col = s.phase === "normal" ? COL.cyan : s.phase === "brake" ? COL.amber : COL.red;
    const x = RX + HW + 62, yA = HT + 44, span = 150, rate = clamp(s.speedPx * 0.004, 0.25, 1.4);
    stxt(L, ctx, "Fahrt", x, yA - 16, { size: 14, weight: 600, color: col, align: "center", alpha: 0.85 * a });
    for (let k = 0; k < 4; k++) {
      const f = (k / 4 + s.t * rate) % 1, y = yA + f * span, al = a * Math.sin(Math.PI * f);
      stk(ctx, (c) => { c.moveTo(x - 11, y - 6); c.lineTo(x, y + 5); c.lineTo(x + 11, y - 6); }, col, 2.6, 0.8, al);
    }
  }

  // ---------- Führungsschiene (Steg im Schnitt) ----------
  function drawRail(ctx, P, s) {
    const x0 = RX - BH, w = BH * 2, y0 = 30, y1 = 1050;
    layer(ctx, "railS", RX - 40, y0, 80, y1 - y0, 1, (g) => {
      fil(g, (c) => c.rect(x0, y0, w, y1 - y0), vGrad(g, "#163250", 0.96, y0, y1), 1);
      stk(g, (c) => { c.moveTo(x0, y0); c.lineTo(x0, y1); c.moveTo(x0 + w, y0); c.lineTo(x0 + w, y1); }, vGrad(g, "#cfe6fa", 1, y0, y1), 2.2, 1, 1);
    });
    // Schnittschraffur + Strich-Punkt-Mittellinie wandern mit der Schiene (ein Pfad je Element)
    const ph = ((s.D % 11) + 11) % 11;
    stk(ctx, (c) => { for (let y = 40 - ph; y < 1040; y += 11) { c.moveTo(x0 + 1, y + w - 1); c.lineTo(x0 + w - 1, y + 1); } }, cgrad(ctx, "railH", () => vGrad(ctx, COL.steel, 0.42, 50, 1010)), 1, 0, 1, { cap: "butt" });
    stk(ctx, (c) => { c.moveTo(RX, y0); c.lineTo(RX, y1); }, cgrad(ctx, "railC", () => vGrad(ctx, COL.cyan, 0.55, y0, y1)), 1.2, 0, 1, { dash: [26, 6, 4, 6], off: s.D, cap: "butt" });
  }

  // Bremsspur am Steg (fest auf der Schiene -> wandert mit nach oben)
  function drawTrace(ctx, s) {
    if (!s.contact || s.Dp < 0.5) return;
    const hotQ = clamp(s.heat * 1.1);
    if (!s.inst) {
      const yTop = WY0 - HC_P - s.Dp, yBot = WY0 - s.h + WH;
      const g = ctx.createLinearGradient(0, yTop, 0, yBot);
      g.addColorStop(0, heatCol(0.1 * hotQ, 0.35 + 0.2 * hotQ)); g.addColorStop(0.55, heatCol(0.45 * hotQ + 0.1, 0.55 + 0.35 * hotQ)); g.addColorStop(1, heatCol(0.3 + 0.7 * hotQ, 0.9));
      for (const sg of [-1, 1]) {
        const x = RX + sg * (BH - 2);
        stk(ctx, (c) => { c.moveTo(x, yTop); c.lineTo(x, yBot); }, g, 3, 1.2, 1, { cap: "butt" });
      }
      // feine Riefen quer zur Laufrichtung (Schleifspuren)
      stk(ctx, (c) => { for (let y = yTop + 4; y < Math.min(yBot, HT); y += 9) { const q = h01(Math.round(y + s.Dp) * 0.37); c.moveTo(RX - BH + 3, y); c.lineTo(RX - BH + 6 + q * 7, y + 1.5); c.moveTo(RX + BH - 3, y + 3); c.lineTo(RX + BH - 6 - q * 7, y + 4.5); } }, COL.amber, 1, 0, 0.35 + 0.3 * hotQ);
    } else {
      const yTop = YR0 - HC_I - s.Dp, yR = YR0 - s.h;
      stk(ctx, (c) => { for (let y = yTop; y < yR; y += 4) { c.moveTo(RX - BH + 1, y); c.lineTo(RX - BH + 7, y - 2); } }, heatCol(0.3 + 0.6 * hotQ, 1), 1.6, 0.8, 0.9);
      stk(ctx, (c) => { c.moveTo(RX + BH - 2, CY - 100 - s.Dp * 0.4); c.lineTo(RX + BH - 2, CY + 100); }, heatCol(0.2 + 0.5 * hotQ, 1), 2.4, 1, 0.6 * s.cf + 0.2);
    }
  }

  // ---------- Fanggehäuse ----------
  function drawHousingBack(ctx, s) { fil(ctx, (c) => c.rect(RX - HW + s.ox, HT, HW * 2, HB - HT), "rgba(4,12,26,0.84)", 1); }
  function drawShell(ctx, P, s) {
    const x0 = PIV[0] - 24, y0 = HT - 8, w = RX + HW + 8 - x0, h = PIV[1] + 16 - y0;
    ctx.save(); ctx.translate(s.ox, 0);
    layer(ctx, "shell|" + s.inst, x0, y0, w, h, 1, (g) => drawShellRaw(g, pats(g), s.inst));
    ctx.restore();
  }
  function drawShellRaw(ctx, P, inst) {
    const ox = 0;
    if (!inst) for (const sg of [-1, 1]) { // Keilanschläge (fest am Gehäuse)
      const X = (dx) => RX + sg * dx;
      const stp = polyB([[X(16), HT + PL], [X(100), HT + PL], [X(100), STOP_Y], [X(16), STOP_Y]], true);
      fil(ctx, stp, "rgba(12,34,62,0.96)", 1); hatch(ctx, stp, P.cyan, 0, 0, 0.55); stk(ctx, stp, COL.cyan, 1.5, 0.4, 0.8);
    }
    // Lagerbock des Auslösehebels
    const brk = polyB([[RX - HW + 8, HB], [RX - HW + 62, HB], [PIV[0] + 17, PIV[1] + 4], [PIV[0] - 17, PIV[1] + 4]], true);
    fil(ctx, brk, "rgba(16,36,62,0.95)", 1); hatch(ctx, brk, P.steel, 0, 0, 0.45); stk(ctx, brk, COL.steel, 1.6, 0.4, 0.9);
    const R = [
      [RX - HW, HT, WALL, HB - HT], [RX + HW - WALL, HT, WALL, HB - HT],
      [RX - HW + WALL, HT, HW - WALL - 20, PL], [RX + 20, HT, HW - WALL - 20, PL],
      [RX - HW + WALL, HB - PL, HW - WALL - 54, PL], [RX + 54, HB - PL, HW - WALL - 54, PL],
    ];
    const b = (c) => { for (const r of R) c.rect(r[0] + ox, r[1], r[2], r[3]); };
    fil(ctx, b, "rgba(12,34,62,0.96)", 1);
    hatch(ctx, b, P.cyan, ox, 0, 0.6);
    stk(ctx, b, COL.cyan, 1.2, 0, 0.55);
    stk(ctx, (c) => {
      c.moveTo(RX - 20 + ox, HT); c.lineTo(RX - HW + ox, HT); c.lineTo(RX - HW + ox, HB); c.lineTo(RX - 54 + ox, HB);
      c.moveTo(RX + 54 + ox, HB); c.lineTo(RX + HW + ox, HB); c.lineTo(RX + HW + ox, HT); c.lineTo(RX + 20 + ox, HT);
    }, COL.cyan, 2.6, 1, 1);
  }

  // Bremsfang: Anschläge, Druckstücke, Tellerfedern, Rollen, Keile
  function progGeom(s) {
    const dl = s.delta, h = s.h;
    const dxIn = Math.max(BH, 20 + dl - TANA * h);
    const yWt = WY0 - h, yWb = yWt + WH;
    return { dl, h, dxIn, yWt, yWb, face: (y) => 44 + dl + (y - WY0) * TANA };
  }
  function drawProg(ctx, P, s) {
    const G = progGeom(s), { dl, dxIn, yWt, yWb, face } = G, load = s.cf;
    const springCol = mix(COL.cyan, COL.amber, load);
    for (const sg of [-1, 1]) {
      const X = (dx) => RX + sg * dx;
      // Druckstück mit schräger Laufbahn
      const blk = polyB([[X(face(BLK_T)), BLK_T], [X(BLK_O + dl), BLK_T], [X(BLK_O + dl), BLK_B], [X(face(BLK_B)), BLK_B]], true);
      fil(ctx, blk, "rgba(18,40,68,0.96)", 1); hatch(ctx, blk, P.steel, sg * dl, 0, 0.7); stk(ctx, blk, COL.steel, 1.8, 0.5, 0.95);
      // Tellerfederpakete (Reihenschaltung, im Schnitt als Zickzack)
      // Druckscheiben an beiden Enden, dazwischen wechselsinnig geschichtete Tellerfedern ( > < > < )
      const c0 = BLK_O + dl + 6, c1 = HW - WALL - 6, pitch = (c1 - c0) / NDISC, th = 5.4, hc = Math.max(0.6, pitch - th);
      for (const yc of SPR_Y) {
        fil(ctx, (c) => c.rect(Math.min(X(c0), X(c1)), yc - SPR_RO - 3, Math.abs(X(c1) - X(c0)), SPR_RO * 2 + 6), rgba(COL.amber, 0.03 + 0.1 * load), 1);
        for (const xe of [c0 - 3, c1 + 3]) { fil(ctx, (c) => c.rect(X(xe) - 2.5, yc - SPR_RO - 4, 5, SPR_RO * 2 + 8), "#1a3350", 1); stk(ctx, (c) => c.rect(X(xe) - 2.5, yc - SPR_RO - 4, 5, SPR_RO * 2 + 8), COL.steel, 1.2, 0, 0.9); }
        const discs = (c) => {
          for (let i = 0; i < NDISC; i++) {
            const a = c0 + i * pitch, xo = i % 2 ? a + hc : a, xi = i % 2 ? a : a + hc;
            for (const sn of [-1, 1]) { c.moveTo(X(xo), yc + sn * SPR_RO); c.lineTo(X(xi), yc + sn * SPR_RI); c.lineTo(X(xi + th), yc + sn * SPR_RI); c.lineTo(X(xo + th), yc + sn * SPR_RO); c.closePath(); }
          }
        };
        stk(ctx, discs, springCol, 1.2, 1.2 + 1.0 * load, 0.8);
        fil(ctx, discs, springCol, 0.9);
        stk(ctx, discs, "#06101f", 1.1, 0, 0.9);
      }
      // Nadelrollen im Käfig (laufen mit halber Keilgeschwindigkeit)
      const y0r = Math.max(yWt, BLK_T) + 6, y1r = Math.min(yWb, BLK_B) - 6, cage = WY0 + 6 - s.h / 2;
      stk(ctx, (c) => { for (let k = -4; k < 14; k++) { const y = cage + k * 14; if (y < y0r || y > y1r) continue; const x = X(face(y) - 5); c.moveTo(x + 4, y); c.arc(x, y, 4, 0, TAU); } }, COL.steel, 1.4, 0, 0.9);
      // Fangkeil
      const wg = polyB([[X(dxIn), yWt], [X(dxIn + WT0), yWt], [X(dxIn + WT0 + WH * TANA), yWb], [X(dxIn), yWb]], true);
      fil(ctx, wg, "#3a2a10", 0.95); hatch(ctx, wg, P.amber, 0, -s.h, 0.75);
      stk(ctx, wg, COL.amber, 2.2, 1, 1);
      fil(ctx, (c) => { c.arc(X(dxIn + 22), yWb - 11, 5, 0, TAU); }, "#0a1426", 1);
      stk(ctx, (c) => { c.arc(X(dxIn + 22), yWb - 11, 5, 0, TAU); }, COL.amber, 1.5, 0, 1);
    }
  }
  function drawProgFront(ctx, s) { // Federbolzen + Einstellmuttern (liegen über der Gehäusewand)
    const dl = s.delta;
    for (const sg of [-1, 1]) {
      const X = (dx) => RX + sg * dx;
      for (const yc of SPR_Y) {
        stk(ctx, (c) => { c.moveTo(X(BLK_O + dl - 10), yc); c.lineTo(X(HW + 17 + dl), yc); }, COL.steel, 4, 0.3, 0.9, { cap: "butt" });
        const xa = Math.min(X(HW + dl), X(HW + 12 + dl));
        fil(ctx, (c) => c.rect(xa, yc - 12, 12, 24), "#1a3350", 1);
        stk(ctx, (c) => { c.rect(xa, yc - 12, 12, 24); c.moveTo(xa, yc - 4); c.lineTo(xa + 12, yc - 4); c.moveTo(xa, yc + 4); c.lineTo(xa + 12, yc + 4); }, COL.steel, 1.4, 0.3, 0.95);
        // Mittellinie der Federachse
        stk(ctx, (c) => { c.moveTo(X(BLK_O - 20), yc); c.lineTo(X(HW + 40), yc); }, COL.cyan, 1, 0, 0.35, { dash: [14, 4, 3, 4], cap: "butt" });
      }
    }
  }

  // Sperrfang: Laufbahn + Klemmrolle links, Gegenbacke rechts
  function instGeom(s) {
    const trk = (y) => BH + GR + 2 * RR + (y - YR0) * TANB;
    const yR = YR0 - s.h;
    const xR = RX - trk(yR) + s.ox + RR;
    return { trk, yR, xR, phi: -s.h / RR };
  }
  function drawInst(ctx, P, s) {
    const G = instGeom(s), ox = s.ox;
    const yT = CY - 118, yB = CY + 112;
    const X = (dx) => RX - dx + ox;
    // schräge Laufbahn (Keilblock)
    const blk = polyB([[X(G.trk(yT)), yT], [X(HW - WALL), yT], [X(HW - WALL), yB], [X(G.trk(yB)), yB]], true);
    fil(ctx, blk, "rgba(18,40,68,0.96)", 1); hatch(ctx, blk, P.steel, ox, 0, 0.7); stk(ctx, blk, COL.steel, 1.8, 0.5, 0.95);
    // Gegenbacke (fest, gezahnt) + Träger
    const jx = RX + BH + GL + ox, jT = CY - 100, jB = CY + 100;
    const hold = polyB([[jx + 30, CY - 118], [RX + HW - WALL + ox, CY - 118], [RX + HW - WALL + ox, CY + 112], [jx + 30, CY + 112]], true);
    fil(ctx, hold, "rgba(18,40,68,0.96)", 1); hatch(ctx, hold, P.steel, ox, 0, 0.7); stk(ctx, hold, COL.steel, 1.8, 0.5, 0.95);
    const jaw = (c) => { c.moveTo(jx + 30, jT); c.lineTo(jx + 3, jT); for (let y = jT; y < jB - 1; y += 10) { c.lineTo(jx, y + 5); c.lineTo(jx + 3, y + 10); } c.lineTo(jx + 30, jB); c.closePath(); };
    fil(ctx, jaw, "#3a2a10", 0.95); hatch(ctx, jaw, P.amber, ox, 0, 0.7); stk(ctx, jaw, COL.amber, 2, 1, 1);
    // Klemmrolle (gerändelt)
    const { xR, yR, phi } = G;
    fil(ctx, (c) => c.arc(xR, yR, RR, 0, TAU), "#3a2a10", 0.95);
    stk(ctx, (c) => c.arc(xR, yR, RR, 0, TAU), COL.amber, 2.4, 1, 1);
    stk(ctx, (c) => { for (let i = 0; i < 30; i++) { const a = phi + (i * TAU) / 30; c.moveTo(xR + Math.cos(a) * (RR - 6), yR + Math.sin(a) * (RR - 6)); c.lineTo(xR + Math.cos(a + 0.08) * (RR - 1), yR + Math.sin(a + 0.08) * (RR - 1)); } }, COL.amber, 1.3, 0, 0.8);
    stk(ctx, (c) => { for (let i = 0; i < 3; i++) { const a = phi + (i * TAU) / 3; c.moveTo(xR + Math.cos(a) * 8, yR + Math.sin(a) * 8); c.lineTo(xR + Math.cos(a) * (RR - 9), yR + Math.sin(a) * (RR - 9)); } }, COL.amber, 2, 0.4, 0.8);
    fil(ctx, (c) => c.arc(xR, yR, 7, 0, TAU), "#0a1426", 1);
    stk(ctx, (c) => c.arc(xR, yR, 7, 0, TAU), COL.amber, 1.6, 0, 1);
  }

  // Wärmeglühen an der Reibstelle (additiv)
  function drawHeat(ctx, s) {
    if (s.heat <= 0.01) return;
    const hh = s.heat * (0.86 + 0.14 * Math.sin(s.t * 13.1) * Math.sin(s.t * 7.3 + 1));
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    if (!s.inst) {
      const G = progGeom(s);
      const wg = (c) => { for (const sg of [-1, 1]) { const X = (dx) => RX + sg * dx; c.moveTo(X(G.dxIn), G.yWt); c.lineTo(X(G.dxIn + WT0), G.yWt); c.lineTo(X(G.dxIn + WT0 + WH * TANA), G.yWb); c.lineTo(X(G.dxIn), G.yWb); c.closePath(); } };
      fil(ctx, wg, "#ff7a1a", 0.32 * hh);
      const g = ctx.createLinearGradient(0, G.yWt, 0, G.yWb);
      g.addColorStop(0, rgba(COL.hot, 0.95)); g.addColorStop(0.45, rgba(COL.amber, 0.8)); g.addColorStop(1, rgba(COL.red, 0.25));
      stk(ctx, (c) => { c.moveTo(RX - BH, G.yWt); c.lineTo(RX - BH, G.yWb); c.moveTo(RX + BH, G.yWt); c.lineTo(RX + BH, G.yWb); }, g, 3, 2.2, hh, { cap: "butt" });
      dot(ctx, RX, G.yWt + 26, 60, COL.amber, 0.55 * hh);
      dot(ctx, RX, HT, 42, COL.amber, 0.5 * hh * (0.35 + s.power));
    } else {
      const G = instGeom(s);
      fil(ctx, (c) => c.arc(G.xR, G.yR, RR, 0, TAU), "#ff7a1a", 0.3 * hh);
      dot(ctx, RX - BH, G.yR, 50, COL.amber, 0.7 * hh);
      dot(ctx, RX - BH, G.yR, 16, COL.hot, 0.8 * hh);
      if (s.cf > 0.1) {
        const g = ctx.createLinearGradient(0, CY - 100, 0, CY + 100);
        g.addColorStop(0, rgba(COL.amber, 0)); g.addColorStop(0.5, rgba(COL.amber, 0.7)); g.addColorStop(1, rgba(COL.amber, 0));
        stk(ctx, (c) => { c.moveTo(RX + BH, CY - 100); c.lineTo(RX + BH, CY + 100); }, g, 2.5, 2, hh * s.cf, { cap: "butt" });
      }
    }
    ctx.restore();
  }

  // Mechanik (Teile, Gehäuse, Gestänge) – in Ruhe- und Endlage als Sprite, sonst live
  function mechKey(s) {
    if (s.h <= 1e-9 && s.L <= 1e-9) return "mech|" + s.inst + "|0";
    if (!s.inst && s.h >= HMAX_P - 1e-9 && s.L >= HC_P + LEAD_P - 1e-9) return "mech|p|1";
    if (s.inst && s.h >= HC_I + H2_I - 1e-9 && s.L >= HC_I + LEAD_I - 1e-9) return "mech|i|1";
    return null;
  }
  function drawMechRaw(ctx, P, s) {
    if (s.inst) drawInst(ctx, P, s); else drawProg(ctx, P, s);
    drawShell(ctx, P, s);
    if (!s.inst) drawProgFront(ctx, s);
    drawLinkage(ctx, P, s);
  }
  function drawMech(ctx, P, s) {
    const key = mechKey(s);
    if (key) layer(ctx, key, PIV[0] - 40, HT - 12, ROPE_X + 60 - (PIV[0] - 40), PIV[1] + 40 - (HT - 12), 1, (g) => drawMechRaw(g, pats(g), s));
    else drawMechRaw(ctx, P, s);
  }

  // ---------- Gestänge, Auslösehebel, Begrenzerseil ----------
  const leverPt = (s, r) => [PIV[0] + r * Math.cos(s.theta), PIV[1] - r * Math.sin(s.theta)];
  function drawLinkage(ctx, P, s) {
    const yTr = TR_Y0 - s.L;
    // Rückstellfeder (Druckfeder zwischen Gehäuse und Hebel)
    const pS = leverPt(s, 400);
    stk(ctx, springB(pS[0], HB + 2, pS[0], pS[1] - 9, 6, 8), COL.steel, 1.8, 0.4, 0.8);
    // Hubtraverse (vor dem Steg)
    fil(ctx, (c) => rr(c, RX - 64, yTr, 128, TR_H, 3), "#152c4a", 1);
    stk(ctx, (c) => rr(c, RX - 64, yTr, 128, TR_H, 3), COL.steel, 1.8, 0.5, 1);
    const slots = s.inst ? [RX - 40] : [RX - 45, RX + 45];
    for (const xs of slots) {
      fil(ctx, (c) => rr(c, xs - 8, yTr - SLOT - 5, 16, SLOT + 7, 3), "#152c4a", 1);
      stk(ctx, (c) => rr(c, xs - 8, yTr - SLOT - 5, 16, SLOT + 7, 3), COL.steel, 1.5, 0.3, 1);
      fil(ctx, (c) => rr(c, xs - 2.5, yTr - SLOT - 1, 5, SLOT, 2.5), "#050d1c", 1);
    }
    // Zugstangen (Keil -> Langloch der Traverse)
    const rods = [];
    if (!s.inst) { const G = progGeom(s); for (const sg of [-1, 1]) rods.push([RX + sg * (G.dxIn + 22), G.yWb - 11, RX + sg * 45, G.yWb - 11 + ROD_P]); }
    else { const G = instGeom(s); rods.push([G.xR, G.yR, RX - 40, G.yR + ROD_I]); }
    for (const r of rods) {
      stk(ctx, (c) => { c.moveTo(r[0], r[1]); c.lineTo(r[2], r[3]); }, COL.steel, 4.5, 0.5, 1);
      fil(ctx, (c) => c.arc(r[2], r[3], 4, 0, TAU), COL.white, 0.95);
    }
    // Auslösehebel
    const a0 = leverPt(s, -24), a1 = leverPt(s, ROPE_R + 26), nx = Math.sin(s.theta) * 9, ny = Math.cos(s.theta) * 9;
    const lev = polyB([[a0[0] + nx, a0[1] + ny], [a1[0] + nx, a1[1] + ny], [a1[0] - nx, a1[1] - ny], [a0[0] - nx, a0[1] - ny]], true);
    fil(ctx, lev, "#132a48", 1);
    stk(ctx, lev, s.phase === "trip" ? COL.amber : COL.steel, 2, 0.9, 1);
    const pPin = leverPt(s, PIN_R), pEnd = leverPt(s, ROPE_R);
    stk(ctx, (c) => { c.moveTo(RX, yTr + TR_H - 2); c.lineTo(pPin[0], pPin[1]); }, COL.steel, 5, 0.3, 1);
    for (const q of [PIV, pPin, pEnd]) { fil(ctx, (c) => c.arc(q[0], q[1], 5.5, 0, TAU), "#050d1c", 1); stk(ctx, (c) => c.arc(q[0], q[1], 5.5, 0, TAU), COL.white, 1.5, 0, 0.9); }
    stk(ctx, (c) => c.arc(PIV[0], PIV[1], 13, 0, TAU), COL.steel, 1.6, 0.3, 0.9);
  }
  function drawRope(ctx, s) {
    const x = ROPE_X, y0 = 30, y1 = 1050, off = s.ropeRise;
    layer(ctx, "ropeS", x - 20, y0, 40, y1 - y0, 1, (g) => {
      fil(g, (c) => c.rect(x - 6, y0, 12, y1 - y0), vGrad(g, "#0a1a30", 0.95, y0, y1), 1);
      stk(g, (c) => { c.moveTo(x - 6, y0); c.lineTo(x - 6, y1); c.moveTo(x + 6, y0); c.lineTo(x + 6, y1); }, vGrad(g, COL.rope, 0.95, y0, y1), 1.5, 0.6, 1);
    });
    const ph = ((off % 9) + 9) % 9;
    stk(ctx, (c) => { for (let y = y0 + 9 - ph; y < y1; y += 9) { c.moveTo(x - 5, y + 3); c.lineTo(x + 5, y - 3); } }, cgrad(ctx, "ropeL", () => vGrad(ctx, COL.rope, 0.75, y0, y1)), 1.3, 0, 1, { cap: "butt" });
    // Seilklemme am Hebelende
    const pE = leverPt(s, ROPE_R), ye = pE[1];
    fil(ctx, (c) => rr(c, x - 15, ye - 28, 30, 56, 4), "#132a48", 1);
    stk(ctx, (c) => rr(c, x - 15, ye - 28, 30, 56, 4), s.phase === "trip" ? COL.amber : COL.steel, 1.8, 0.6, 1);
    stk(ctx, (c) => { c.moveTo(x - 19, ye - 15); c.lineTo(x + 19, ye - 15); c.moveTo(x - 19, ye + 15); c.lineTo(x + 19, ye + 15); }, COL.white, 2.5, 0.3, 0.85, { cap: "butt" });
    if (s.phase === "trip" || (s.contact && s.t - s.tm.tCon < 0.3)) {
      const a = s.phase === "trip" ? 1 : 1 - (s.t - s.tm.tCon) / 0.3;
      for (let i = 0; i < 3; i++) { const yy = ye - 70 - i * 26 - ((s.t * 60) % 26); arrowHead(ctx, x + 22, yy, -Math.PI / 2, 12, COL.amber, a * (0.9 - i * 0.25)); }
    }
  }

  // ---------- Maßband: Fangbeginn -> Bremsweg ----------
  function drawTape(ctx, L, s) {
    if (!s.contact || s.Dp < 1) return;
    const yM = HT - s.Dp, tx = RX + BH + 5, tw = 20;
    fil(ctx, (c) => c.rect(tx, yM, tw, HT - yM), "rgba(40,28,8,0.85)", 1);
    stk(ctx, (c) => c.rect(tx, yM, tw, HT - yM), COL.amber, 1.2, 0.3, 0.8);
    const lab = s.Dp < 55 ? 2 : 10; // Beschriftung alle 1 cm oder 5 cm
    stk(ctx, (c) => { for (let j = 0; ; j++) { const y = yM + j * 7.5; if (y > HT - 0.5) break; const l = j % 10 === 0 ? 17 : j % 2 === 0 ? 11 : 6; c.moveTo(tx, y); c.lineTo(tx + l, y); } }, COL.amber, 1.2, 0, 0.95, { cap: "butt" });
    for (let j = lab; ; j += lab) { const y = yM + j * 7.5; if (y > HT - 8) break; stxt(L, ctx, `${j / 2} cm`, tx + tw + 5, y + 5, { size: 14, weight: 700, font: L.FONT.mono, color: COL.amber, alpha: 0.9 }); }
    // Fangbeginn-Markierung quer über den Steg
    stk(ctx, (c) => { c.moveTo(RX - BH - 26, yM); c.lineTo(tx + tw + 2, yM); }, COL.amber, 2, 1, 1, { cap: "butt" });
    stxt(L, ctx, "Fangbeginn", RX - BH - 32, yM + 6, { size: 18, weight: 600, color: COL.amber, align: "right" });
    // Maßlinie
    const xd = RX + 104;
    stk(ctx, (c) => { c.moveTo(tx + tw + 2, yM); c.lineTo(xd + 8, yM); c.moveTo(RX + HW * 0.3, HT); c.lineTo(xd + 8, HT); }, COL.amber, 1, 0, 0.55, { cap: "butt" });
    stk(ctx, (c) => { c.moveTo(xd, yM + 2); c.lineTo(xd, HT - 2); }, COL.amber, 1.6, 0.6, 1);
    if (s.Dp > 18) { arrowHead(ctx, xd, yM, -Math.PI / 2, 10, COL.amber, 1); arrowHead(ctx, xd, HT, Math.PI / 2, 10, COL.amber, 1); }
    const yl = s.Dp > 96 ? (yM + HT) / 2 : Math.min(yM, HT - 48) - 24;
    stxt(L, ctx, "BREMSWEG", xd + 16, yl - 12, { size: 14, weight: 700, font: L.FONT.mono, color: COL.muted, letterSpacing: 2 });
    txt(L, ctx, `${Math.round(s.xmm)} mm`, xd + 14, yl + 22, { size: 32, weight: 700, font: L.FONT.mono, color: COL.amber });
  }

  // ---------- Funken + Glut ----------
  function drawSparks(ctx, s) {
    if (!s.eng || !s.cfg.sparks || !s.contact) return;
    const tm = s.tm, pr = s.pr, t = s.t, tb = Math.max(0.1, tm.tStop - tm.tCon);
    const N = s.inst ? 190 : 300;
    const G = s.inst ? instGeom(s) : progGeom(s);
    const B = [[], [], [], [], [], [], [], []]; // 4 Helligkeitsstufen × 2 Farben
    for (let i = 0; i < N; i++) {
      const born = tm.tCon + (tb + 0.04) * h01(i * 3.17 + 0.5);
      const life = (s.inst ? 0.32 : 0.42) + 0.45 * h01(i * 1.9 + 2), age = t - born;
      if (age < 0 || age > life) continue;
      const q = sampleP(pr, (born - tm.tCon) / tm.k), pw = clamp((q.v / pr.vC) * (q.a / pr.aRef) * 1.4);
      if (h01(i * 7.7 + 0.2) > 0.1 + 0.95 * pw) continue;
      const inner = h01(i * 4.4) < 0.22, side = inner && s.inst ? -1 : i % 2 ? 1 : -1, r5 = h01(i * 5.1);
      let x0, y0, ang, sp = (s.inst ? 520 : 400) + 640 * h01(i * 2.3);
      if (inner) { x0 = RX + side * (BH + 1); y0 = s.inst ? G.yR - 10 : G.yWt + 2; ang = -Math.PI / 2 + side * (0.05 + 0.3 * r5); sp *= 0.55; if (age > 0.16) continue; }
      else { x0 = RX + side * (BH + 3); y0 = HT - 1; ang = -Math.PI / 2 + side * (r5 < 0.7 ? 0.03 + 0.36 * r5 : 0.28 + 0.75 * (r5 - 0.7)); if (r5 >= 0.7) sp *= 0.7; }
      const g = 1500;
      const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp + g * age;
      const x = x0 + vx * age, y = y0 + Math.sin(ang) * sp * age + 0.5 * g * age * age;
      if (y > HB + 120) continue;
      const a = (1 - age / life) * (0.6 + 0.4 * pw);
      if (a < 0.03) continue;
      const k = 0.03 + 0.035 * h01(i * 8.3);
      const hot = age < life * 0.4 || i % 3 === 0 ? 1 : 0, lv = Math.min(3, Math.floor(a * 4));
      B[lv * 2 + hot].push(x, y, x - vx * k, y - vy * k);
    }
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
    for (let lv = 0; lv < 4; lv++) {
      const al = GA * (lv + 0.6) / 4;
      for (let hot = 0; hot < 2; hot++) {
        const q = B[lv * 2 + hot]; if (!q.length) continue;
        ctx.beginPath(); for (let j = 0; j < q.length; j += 4) { ctx.moveTo(q[j], q[j + 1]); ctx.lineTo(q[j + 2], q[j + 3]); }
        ctx.globalAlpha = al * 0.3; ctx.strokeStyle = COL.amber; ctx.lineWidth = 5.5; ctx.stroke();
        ctx.globalAlpha = al; ctx.strokeStyle = hot ? COL.hot : "#ffc56e"; ctx.lineWidth = 2; ctx.stroke();
      }
    }
    ctx.restore();
    if (s.phase === "brake") { ctx.save(); ctx.globalCompositeOperation = "lighter"; dot(ctx, RX, HT - 4, 70, COL.amber, 0.45 * s.power); dot(ctx, RX, HT - 2, 22, COL.hot, 0.8 * s.power); ctx.restore(); }
    // Glut nach dem Stillstand: einzelne glühende Partikel sinken langsam
    if (t > tm.tStop - 0.2) {
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 12; i++) {
        const born = tm.tStop - 0.2 + i * 0.22, life = 1.9 + 0.6 * h01(i * 3.3), age = t - born;
        const ageM = ((age % (life + 0.9)) + (life + 0.9)) % (life + 0.9); if (age < 0 || ageM > life) continue;
        const side = i % 2 ? 1 : -1;
        const x = RX + side * (BH + 6 + 28 * h01(i * 2.1)) + Math.sin(ageM * 3 + i) * 5, y = HT - 8 - 40 * h01(i * 1.7) + ageM * ageM * 38;
        const a = (1 - ageM / life) * 0.8 * (0.4 + 0.6 * s.heat);
        dot(ctx, x, y, 9, COL.amber, a); fil(ctx, (c) => c.arc(x, y, 1.6, 0, TAU), COL.hot, a);
      }
      ctx.restore();
    }
  }

  // ---------- Beschriftungen ----------
  function tag(ctx, L, tx, ty, bx, by, title, sub, prog, o = {}) {
    const p = clamp(prog); if (p <= 0) return;
    const color = o.color || COL.cyan, right = o.side === "right";
    const ts = 22, ss = 16;
    const tw = meas(L, ctx, title, { size: ts, weight: 600 }), sw = sub ? meas(L, ctx, sub, { size: ss, weight: 400 }) : 0;
    const bw = Math.max(tw, sw) + 32, bh = sub ? 62 : 42;
    const left = right ? bx : bx - bw;
    const ex = o.ex != null ? o.ex : right ? bx - 28 : bx + 28;
    const lp = easeOut(inv(0, 0.55, p)), bp = inv(0.35, 1, p);
    TQ.push({ tx, ty, ex, bx, by, lp, p, color });
    if (bp <= 0) return;
    BQ.push(() => {
      const boxDraw = (g, bwA, a) => {
        const bl = right ? bx : bx - bwA;
        fil(g, (c) => rr(c, bl, by - bh / 2, bwA, bh, 6), "rgb(4,12,26)", 0.88 * a);
        stk(g, (c) => rr(c, bl, by - bh / 2, bwA, bh, 6), color, 1.4, 0.4, 0.65 * a);
        fil(g, (c) => c.rect(right ? bl : bl + bwA - 3, by - bh / 2 + 8, 3, bh - 16), color, 0.9 * a);
      };
      const textDraw = (g, a) => {
        txt(L, g, title, left + 16, by + (sub ? -5 : 8), { size: ts, weight: 600, color: COL.white, alpha: a });
        if (sub) txt(L, g, sub, left + 16, by + 19, { size: ss, weight: 400, color: o.subColor || COL.muted, alpha: a });
      };
      if (p >= 1) {
        layer(ctx, "tag|" + title + "|" + sub + "|" + color + "|" + (o.subColor || "") + "|" + (right ? "r" : "l"), left - 10, by - bh / 2 - 10, bw + 20, bh + 20, 1, (g) => { boxDraw(g, bw, 1); textDraw(g, 1); });
        return;
      }
      boxDraw(ctx, bw * easeOut(bp), bp);
      textDraw(ctx, inv(0.55, 1, bp));
    });
  }

  // Führungslinien aller Beschriftungen gebündelt (je Farbe ein Pfad) – unter den Boxen
  let TQ = [];
  function flushLeaders(ctx) {
    const cols = [...new Set(TQ.map((q) => q.color))];
    for (const col of cols) {
      const qs = TQ.filter((q) => q.color === col);
      stk(ctx, (c) => {
        for (const q of qs) {
          c.moveTo(q.tx, q.ty);
          const k1 = clamp(q.lp / 0.7); c.lineTo(lerp(q.tx, q.ex, k1), lerp(q.ty, q.by, k1));
          if (q.lp > 0.7) { const k2 = (q.lp - 0.7) / 0.3; c.lineTo(lerp(q.ex, q.bx, k2), q.by); }
          if (q.p >= 0.3) { c.moveTo(q.tx + 8, q.ty); c.arc(q.tx, q.ty, 8, 0, TAU); }
        }
      }, col, 1.6, 0.5, 0.85);
      fil(ctx, (c) => { for (const q of qs) { c.moveTo(q.tx + 4, q.ty); c.arc(q.tx, q.ty, 4, 0, TAU); } }, col, 1);
    }
    TQ = [];
  }
  let BQ = [];
  function drawCallouts(ctx, L, s) {
    TQ = []; BQ = [];
    queueCallouts(ctx, L, s);
    flushLeaders(ctx);
    for (const f of BQ) f();
    BQ = [];
  }
  function queueCallouts(ctx, L, s) {
    const t = s.t, sc = clamp(s.d / 8, 0.55, 1.4);
    const ap = (i) => inv(0.3 + i * 0.17 * sc, 0.3 + i * 0.17 * sc + 0.55, t);
    const trPos = (dp) => clamp((dp - 70) / 60);
    if (!s.inst) {
      const G = progGeom(s), dl = s.delta;
      tag(ctx, L, RX - BH, 300, LBX, 292, "Führungsschiene", "T-Profil, Steg 16 mm", ap(0));
      tag(ctx, L, RX - G.dxIn - 18, G.yWt + 62, LBX, 492, "Fangkeil (2×)", "wird hochgezogen, klemmt", ap(1), { color: COL.amber });
      tag(ctx, L, RX - (BLK_O + dl + (HW - WALL - BLK_O - dl) / 2), SPR_Y[0] - SPR_RO + 4, LBX, 592, "Tellerfederpaket", "begrenzt die Klemmkraft", ap(2), { color: s.cf > 0.5 ? COL.amber : COL.cyan });
      tag(ctx, L, RX - HW + 9, CY + 128, LBX, 692, "Fanggehäuse", "am Fahrkorbrahmen", ap(3));
      if (s.contact) tag(ctx, L, RX - BH + 2, HT - s.Dp * 0.55, LBX, 392, "Bremsspur", "Reibung wird zu Wärme", trPos(s.Dp), { color: COL.amber });
    } else {
      const G = instGeom(s);
      tag(ctx, L, RX - BH, 300, LBX, 292, "Führungsschiene", "T-Profil, Steg 16 mm", ap(0));
      tag(ctx, L, G.xR - 12, G.yR - 10, LBX, 492, "Klemmrolle", "gerändelt, rollt hoch, verkeilt", ap(1), { color: COL.amber });
      tag(ctx, L, RX - G.trk(CY + 70) + s.ox - 2, CY + 70, LBX, 592, "Schräge Laufbahn", "starr, ohne Federpaket", ap(2));
      tag(ctx, L, RX - HW + 9 + s.ox, CY + 128, LBX, 692, "Fanggehäuse", "schwimmend gelagert", ap(3));
      tag(ctx, L, RX + BH + GL + 16 + s.ox, CY + 40, RBX, 640, "Gegenbacke", "fest, gezahnt", ap(4.5), { side: "right", ex: 930, color: COL.amber });
      if (s.contact) tag(ctx, L, RX - BH + 3, Math.min(HT - 6, G.yR - s.Dp * 0.5), LBX, 392, "Eindrücke im Steg", "Rolle beißt sich fest", clamp((s.Dp - 16) / 20), { color: COL.amber });
    }
    const pL = leverPt(s, 70);
    tag(ctx, L, pL[0], pL[1], LBX, 848, "Auslösehebel", s.inst ? "hebt die Klemmrolle" : "zieht die Keile hoch", ap(4), { color: s.phase === "trip" ? COL.amber : COL.cyan });
    tag(ctx, L, ROPE_X + 6, 400, RBX, 360, "Begrenzerseil", s.eng ? "wird bei Auslösung gestoppt" : "läuft mit dem Fahrkorb", ap(5), { side: "right", color: s.phase === "trip" ? COL.amber : COL.cyan });
    if (!s.eng) {
      const yg = s.inst ? YR0 - 10 : WY0 + 30, xg = s.inst ? RX - BH - 3 : RX + BH + 4;
      tag(ctx, L, xg, yg, RBX, 520, "Luftspalt", s.inst ? "Rolle berührt den Steg nicht" : "Keile berühren den Steg nicht", ap(6), { side: "right", ex: 930 });
    }
  }

  // ---------- Messwerte-Panel ----------
  function statusOf(s) {
    switch (s.phase) {
      case "normal": return ["NORMALFAHRT", COL.cyan];
      case "over": return ["ÜBERGESCHWINDIGKEIT", COL.red];
      case "trip": return ["BEGRENZER LÖST AUS", COL.amber];
      case "brake": return [s.inst ? "SPERRFANG GREIFT" : "FANGEN – BREMSEN", s.inst ? COL.red : COL.amber];
      default: return ["STILLSTAND", COL.green];
    }
  }
  function checkMark(ctx, x, y, sz, color, a) { stk(ctx, (c) => { c.moveTo(x, y); c.lineTo(x + sz * 0.38, y + sz * 0.38); c.lineTo(x + sz, y - sz * 0.45); }, color, 2.6, 0.6, a); }
  function crossMark(ctx, x, y, sz, color, a) { stk(ctx, (c) => { c.moveTo(x, y - sz / 2); c.lineTo(x + sz, y + sz / 2); c.moveTo(x + sz, y - sz / 2); c.lineTo(x, y + sz / 2); }, color, 2.6, 0.6, a); }
  function drawPanel1(ctx, L, s) {
    const t = s.t, ap = smooth(inv(0.1, 0.1 + Math.min(0.7, 0.09 * s.d), t)); if (ap <= 0.01) return;
    const sG = GA; GA = sG * ap;
    const x0 = PX + (1 - easeOut(ap)) * 40, y0 = P1Y, w = PW, h = P1H;
    const TWS = [176, 170, 142], TXS = [x0 + 24, x0 + 24 + 176 + 12, x0 + 24 + 176 + 12 + 170 + 12], tyT = y0 + 140, tH = 100;
    const cx0 = x0 + 64, cx1 = x0 + w - 28, cy0 = y0 + 294, cy1 = y0 + 384;
    const yMax = s.inst ? 2.5 : 1.5, xMax = 0.3;
    const Yc = (g) => cy1 - (clamp(g, 0, yMax) / yMax) * (cy1 - cy0), Xc = (tau) => cx0 + (clamp(tau, 0, xMax) / xMax) * (cx1 - cx0);
    const stat = (g) => {
      fil(g, (c) => rr(c, x0, y0, w, h, 14), "rgba(6,16,34,0.9)", 1);
      stk(g, (c) => rr(c, x0, y0, w, h, 14), COL.cyan, 1.4, 0.5, 0.55);
      txt(L, g, s.inst ? "SPERRFANGVORRICHTUNG" : "BREMSFANGVORRICHTUNG", x0 + 24, y0 + 46, { size: 30, weight: 700, font: L.FONT.head, color: COL.white, letterSpacing: 1.5 });
      txt(L, g, s.inst ? "sofort wirkend – nur bis 0,63 m/s Nenngeschwindigkeit" : "progressiv – Federpaket begrenzt die Klemmkraft", x0 + 24, y0 + 76, { size: 18, weight: 400, color: COL.muted });
      stk(g, (c) => { c.moveTo(x0 + 24, y0 + 94); c.lineTo(x0 + w - 24, y0 + 94); }, COL.cyan, 1, 0, 0.3);
      const labs = ["GESCHWINDIGKEIT", "VERZÖGERUNG", "BREMSWEG"];
      for (let i = 0; i < 3; i++) {
        const tx = TXS[i], TW = TWS[i];
        fil(g, (c) => rr(c, tx, tyT, TW, tH, 8), "rgba(63,210,255,0.05)", 1);
        stk(g, (c) => rr(c, tx, tyT, TW, tH, 8), COL.cyan, 1, 0, 0.3);
        txt(L, g, labs[i], tx + 14, tyT + 24, { size: 13, weight: 700, font: L.FONT.mono, color: COL.muted, letterSpacing: 1.5 });
      }
      txt(L, g, "VERZÖGERUNG a(t) AB FANGBEGINN", x0 + 24, y0 + 274, { size: 13, weight: 700, font: L.FONT.mono, color: COL.muted, letterSpacing: 1.5 });
      // zulässiger Bereich 0,2–1,0 g
      fil(g, (c) => c.rect(cx0, Yc(1.0), cx1 - cx0, Yc(0.2) - Yc(1.0)), "rgba(91,228,155,0.10)", 1);
      stk(g, (c) => { c.moveTo(cx0, Yc(1.0)); c.lineTo(cx1, Yc(1.0)); c.moveTo(cx0, Yc(0.2)); c.lineTo(cx1, Yc(0.2)); }, COL.green, 1, 0, 0.55, { dash: [5, 4], cap: "butt" });
      const lg = "zulässig Ø 0,2–1,0 g", lw = meas(L, g, lg, { size: 13, weight: 600 });
      fil(g, (c) => c.rect(cx1 - lw - 26, y0 + 263, 16, 10), "rgba(91,228,155,0.25)", 1);
      stk(g, (c) => c.rect(cx1 - lw - 26, y0 + 263, 16, 10), COL.green, 1, 0, 0.7);
      txt(L, g, lg, cx1, y0 + 273, { size: 13, weight: 600, color: COL.green, align: "right" });
      const yt = s.inst ? [0, 1, 2] : [0, 0.5, 1, 1.5];
      for (const v of yt) {
        stk(g, (c) => { c.moveTo(cx0, Yc(v)); c.lineTo(cx1, Yc(v)); }, COL.muted, 1, 0, v === 0 ? 0.5 : 0.14);
        txt(L, g, fmt(v, v % 1 ? 1 : v === 0 ? 0 : 1) + (v === yt[yt.length - 1] ? " g" : ""), cx0 - 10, Yc(v) + 5, { size: 13, weight: 700, font: L.FONT.mono, color: COL.muted, align: "right" });
      }
      for (const v of [0, 0.1, 0.2, 0.3]) txt(L, g, v === 0.3 ? "0,3 s" : fmt(v, v ? 1 : 0), Xc(v), cy1 + 20, { size: 13, weight: 700, font: L.FONT.mono, color: COL.muted, align: v === 0.3 ? "right" : v ? "center" : "left" });
      stk(g, (c) => { c.moveTo(cx0, cy0 - 4); c.lineTo(cx0, cy1); }, COL.muted, 1, 0, 0.5);
    };
    const chev = (ctx) => { // laufende Pfeile = Bewegung
      const tx = TXS[0] + TWS[0] - 16;
      for (let k = 0; k < 3; k++) { const f = ((k / 3 + t * clamp(s.speedPx * 0.006, 0.3, 1.6)) % 1); arrowHead(ctx, tx, tyT + 44 + f * 34, Math.PI / 2, 10, s.phase === "normal" ? COL.cyan : s.phase === "brake" ? COL.amber : COL.red, 0.9 * Math.sin(Math.PI * f)); }
    };
    const live = (ctx, withAnim) => {
      // Status + Zeitlupe
      const [st, sc] = statusOf(s);
      const sw = meas(L, ctx, st, { size: 14, weight: 700, font: L.FONT.mono, letterSpacing: 2 }) + 34;
      const pulse = s.phase === "stop" || s.phase === "normal" ? 0.75 : 0.55 + 0.45 * Math.abs(Math.sin(t * 5));
      fil(ctx, (c) => rr(c, x0 + 24, y0 + 104, sw, 26, 13), rgba(sc, 0.12), 1);
      stk(ctx, (c) => rr(c, x0 + 24, y0 + 104, sw, 26, 13), sc, 1.4, 0.6, pulse);
      fil(ctx, (c) => c.arc(x0 + 38, y0 + 117, 4, 0, TAU), sc, pulse);
      stxt(L, ctx, st, x0 + 50, y0 + 122, { size: 14, weight: 700, font: L.FONT.mono, color: sc, letterSpacing: 2 });
      if (s.eng) stxt(L, ctx, `ZEITLUPE ×${Math.max(2, Math.round(s.tm.k))} · BEISPIELWERTE`, x0 + w - 24, y0 + 122, { size: 13, weight: 700, font: L.FONT.mono, color: COL.muted, letterSpacing: 1.2, align: "right" });
      else stxt(L, ctx, "BEISPIELWERTE", x0 + w - 24, y0 + 122, { size: 13, weight: 700, font: L.FONT.mono, color: COL.muted, letterSpacing: 1.2, align: "right" });
      // Kacheln
      const pr = s.pr;
      const tile = (i, val, unit, col, sub, subCol) => {
        const tx = TXS[i];
        txt(L, ctx, val, tx + 14, tyT + 68, { size: 38, weight: 700, font: L.FONT.mono, color: col });
        const vw = meas(L, ctx, val, { size: 38, weight: 700, font: L.FONT.mono });
        stxt(L, ctx, unit, tx + 20 + vw, tyT + 68, { size: 18, weight: 600, color: COL.muted });
        if (sub) stxt(L, ctx, sub, tx + 14, tyT + 90, { size: 14, weight: 400, color: subCol || COL.muted });
      };
      const moving = s.v > 0.005;
      tile(0, fmt(s.v, 2), "m/s", s.phase === "over" || s.phase === "trip" ? COL.red : moving ? COL.white : COL.green,
        s.phase === "normal" ? "Normalfahrt abwärts" : s.phase === "stop" ? "Stillstand" : s.phase === "brake" ? "bremst" : "abwärts, zu schnell",
        s.phase === "stop" ? COL.green : null);
      if (moving && withAnim) chev(ctx);
      let aVal = "–", aCol = COL.muted, aSub = s.eng ? "Fangvorrichtung offen" : "keine Bremsung", aSubCol = null;
      if (s.phase === "brake") { aVal = fmt(s.a, 2); aCol = s.a > 1.0 ? COL.red : COL.amber; aSub = s.inst ? "harter Stoß" : "im zulässigen Bereich"; aSubCol = s.inst ? COL.red : COL.green; }
      else if (s.phase === "stop") { aVal = fmt(pr.aAvg, 2); aCol = pr.aAvg > 1.0 ? COL.red : COL.amber; aSub = s.inst ? `Ø, Spitze ${fmt(pr.aMax, 1)} g` : "Mittelwert Ø, zulässig"; aSubCol = s.inst ? COL.red : COL.green; }
      else if (s.phase === "normal") { aVal = "0,00"; }
      tile(1, aVal, aVal === "–" ? "" : "g", aCol, aSub, aSubCol);
      if (s.phase === "stop") { const tx = TXS[1] + TWS[1] - 30; if (pr.aAvg <= 1.0) checkMark(ctx, tx, tyT + 22, 16, COL.green, 1); else crossMark(ctx, tx, tyT + 22, 14, COL.red, 1); }
      tile(2, s.contact ? String(Math.round(s.xmm)) : "–", s.contact ? "mm" : "", s.contact ? COL.amber : COL.muted, s.contact ? (s.phase === "stop" ? `= ${fmt(s.xmm / 10, 1)} cm` : "ab Fangbeginn") : s.eng ? "noch kein Fangen" : "kein Fangvorgang", null);
      if (!s.eng) stxt(L, ctx, "kein Fangvorgang – Keile in Ruhelage", (cx0 + cx1) / 2, (cy0 + cy1) / 2 + 6, { size: 16, weight: 600, color: COL.muted, align: "center", alpha: 0.8 });
      // Kurve a(t)
      if (s.contact) {
        const tauC = Math.min(s.tau, xMax), n = 90, tauS = Math.min(tauC, pr.tauStop);
        const col = s.inst ? COL.red : COL.amber;
        const build = (c) => {
          c.moveTo(Xc(0), Yc(0));
          for (let i = 0; i <= n; i++) { const ta = (tauS * i) / n; c.lineTo(Xc(ta), Yc(sampleP(pr, ta).a)); }
          if (tauC > pr.tauStop) { c.lineTo(Xc(pr.tauStop), Yc(0)); c.lineTo(Xc(tauC), Yc(0)); }
        };
        fil(ctx, (c) => { build(c); c.lineTo(Xc(tauC), Yc(0)); c.closePath(); }, rgba(col, 0.1), 1);
        stk(ctx, build, col, 2.6, 1, 1);
        const cur = tauC > pr.tauStop ? [Xc(tauC), Yc(0)] : [Xc(tauS), Yc(sampleP(pr, tauS).a)];
        dot(ctx, cur[0], cur[1], 14, col, 0.9); fil(ctx, (c) => c.arc(cur[0], cur[1], 3.5, 0, TAU), COL.white, 1);
        if (s.phase === "stop") {
          const ya = Yc(pr.aAvg), ap2 = inv(s.tm.tStop, s.tm.tStop + 0.5, t);
          stk(ctx, (c) => { c.moveTo(Xc(0), ya); c.lineTo(Xc(pr.tauStop), ya); }, COL.white, 1.4, 0, 0.8 * ap2, { dash: [6, 4], cap: "butt" });
          stxt(L, ctx, `Ø ${fmt(pr.aAvg, 2)} g`, Xc(pr.tauStop) + 8, ya + (s.inst ? 5 : -6), { size: 14, weight: 700, font: L.FONT.mono, color: COL.white, alpha: ap2 });
        }
      }
    };
    const still = ap >= 1 && (s.phase === "normal" || (s.phase === "stop" && s.tau >= xMax && t > s.tm.tStop + 0.6));
    if (still) {
      layer(ctx, "p1live|" + s.inst + "|" + s.eng + "|" + s.phase + "|" + Math.round(s.tm.k), x0 - 14, y0 - 14, w + 28, h + 28, 1, (g) => { stat(g); live(g, false); });
      if (s.phase === "normal") chev(ctx);
    } else { layer(ctx, "p1|" + s.inst + "|" + s.eng, x0 - 14, y0 - 14, w + 28, h + 28, 1, stat); live(ctx, true); }
    GA = sG;
  }

  // ---------- Draufsicht T-Profil + Einbaulage ----------
  function drawPanel2(ctx, L, s) {
    const t = s.t, ap = smooth(inv(0.3, 0.3 + Math.min(0.7, 0.09 * s.d), t)); if (ap <= 0.01) return;
    const sG = GA; GA = sG * ap;
    const x0 = PX + (1 - easeOut(ap)) * 40, y0 = P2Y, w = PW, h = P2H;
    const m = 1.5, yc = y0 + 140;
    const fx0 = x0 + 44, fx1 = fx0 + 10 * m, bx1 = fx0 + 62 * m, bh = 8 * m, fh = 44.5 * m; // Fuß, Steg
    const hx0 = fx0 + 50, hx1 = bx1 + 26, hy = 44;
    const rx1 = x0 + 330, rx2 = x0 + 520; // Einbaulage: Schienen
    layer(ctx, "p2|" + s.inst, x0 - 14, y0 - 14, w + 28, h + 28, 1, (g) => {
      const P = pats(g);
      fil(g, (c) => rr(c, x0, y0, w, h, 14), "rgba(6,16,34,0.9)", 1);
      stk(g, (c) => rr(c, x0, y0, w, h, 14), COL.cyan, 1.4, 0.5, 0.55);
      stk(g, (c) => { c.moveTo(x0 + 290, y0 + 20); c.lineTo(x0 + 290, y0 + h - 20); }, COL.cyan, 1, 0, 0.25);
      txt(L, g, "DRAUFSICHT T-PROFIL", x0 + 24, y0 + 34, { size: 13, weight: 700, font: L.FONT.mono, color: COL.muted, letterSpacing: 1.5 });
      txt(L, g, "EINBAULAGE", x0 + 310, y0 + 34, { size: 13, weight: 700, font: L.FONT.mono, color: COL.muted, letterSpacing: 1.5 });
      // Schachtwand
      hatch(g, (c) => c.rect(fx0 - 16, yc - 96, 14, 192), P.cyan, 0, 0, 0.6);
      stk(g, (c) => { c.moveTo(fx0 - 2, yc - 96); c.lineTo(fx0 - 2, yc + 96); }, COL.cyan, 1.4, 0.3, 0.7);
      // T-Profil (Fuß + Steg)
      const tp = polyB([[fx0, yc - fh], [fx1, yc - fh], [fx1, yc - bh - 3], [fx1 + 4, yc - bh], [bx1, yc - bh], [bx1, yc + bh], [fx1 + 4, yc + bh], [fx1, yc + bh + 3], [fx1, yc + fh], [fx0, yc + fh]], true);
      fil(g, tp, "#163250", 1); hatch(g, tp, P.rail, 0, 0, 0.9); stk(g, tp, "#cfe6fa", 1.8, 0.8, 1);
      // Schienenbefestigung (Klemmplatten)
      for (const sg of [-1, 1]) { const yy = yc + sg * (fh - 12); fil(g, (c) => c.rect(fx1, yy - 6, 12, 12), "#1a3350", 1); stk(g, (c) => c.rect(fx1, yy - 6, 12, 12), COL.steel, 1.2, 0, 0.8); }
      // Fanggehäuse (U-Form um die Stegspitze)
      const hs = polyB([[hx0, yc - hy], [hx1, yc - hy], [hx1, yc + hy], [hx0, yc + hy], [hx0, yc + 30], [hx1 - 16, yc + 30], [hx1 - 16, yc - 30], [hx0, yc - 30]], true);
      fil(g, hs, "rgba(12,34,62,0.95)", 1); hatch(g, hs, P.cyan, 0, 0, 0.55); stk(g, hs, COL.cyan, 1.8, 0.7, 1);
      txt(L, g, "Fuß", fx0 + 8, yc + fh + 20, { size: 14, weight: 600, color: COL.muted, align: "center" });
      txt(L, g, "Steg", (fx1 + hx0) / 2 + 2, yc - bh - 7, { size: 14, weight: 600, color: COL.muted, align: "center" });
      txt(L, g, "Fahrkorb", hx1 + 12, yc + 5, { size: 14, weight: 600, color: COL.muted });
      arrowHead(g, hx1 + 86, yc, 0, 9, COL.muted, 0.8);
      // Einbaulage: Fahrkorbrahmen mit Fangvorrichtungen unten an beiden Schienen
      const fy0 = y0 + 62, fy1 = y0 + 214;
      stk(g, (c) => { c.moveTo((rx1 + rx2) / 2 - 8, y0 + 44); c.lineTo((rx1 + rx2) / 2 - 8, fy0); c.moveTo((rx1 + rx2) / 2, y0 + 44); c.lineTo((rx1 + rx2) / 2, fy0); c.moveTo((rx1 + rx2) / 2 + 8, y0 + 44); c.lineTo((rx1 + rx2) / 2 + 8, fy0); }, COL.cyan, 1.4, 0.3, 0.5);
      stk(g, (c) => { c.rect(rx1 + 10, fy0, 8, fy1 - fy0); c.rect(rx2 - 18, fy0, 8, fy1 - fy0); c.rect(rx1 + 10, fy0, rx2 - rx1 - 20, 10); c.rect(rx1 + 10, fy1 - 10, rx2 - rx1 - 20, 10); }, COL.steel, 1.4, 0.3, 0.9);
      fil(g, (c) => c.rect(rx1 + 26, fy0 + 16, rx2 - rx1 - 52, fy1 - fy0 - 32), "rgba(63,210,255,0.06)", 1);
      stk(g, (c) => c.rect(rx1 + 26, fy0 + 16, rx2 - rx1 - 52, fy1 - fy0 - 32), COL.cyan, 1.6, 0.6, 0.9);
      stk(g, (c) => { c.moveTo((rx1 + rx2) / 2, fy0 + 22); c.lineTo((rx1 + rx2) / 2, fy1 - 22); }, COL.cyan, 1, 0, 0.4, { dash: [6, 5] });
      for (const xr of [rx1, rx2]) stk(g, (c) => { c.rect(xr - 7, fy0 - 2, 14, 12); }, COL.steel, 1.2, 0, 0.8);
      txt(L, g, "Fahrkorb", (rx1 + rx2) / 2, (fy0 + fy1) / 2 + 5, { size: 14, weight: 600, color: COL.muted, align: "center" });
      txt(L, g, s.inst ? "Rolle / Backe" : "Keile", hx1 + 12, yc - 30, { size: 14, weight: 600, color: COL.amber });
      txt(L, g, "Fangvorrichtung", rx1 + 28, fy1 + 30, { size: 14, weight: 600, color: COL.amber });
      for (const xr of [rx1, rx2]) stk(g, (c) => { c.moveTo(xr, y0 + 46); c.lineTo(xr, y0 + h - 18); }, "#cfe6fa", 2, 0.5, 0.9);
    });
    // Draufsicht: Keile/Backen schließen sich um den Steg
    const cf = s.eng ? (s.contact ? 0.55 + 0.45 * s.cf : smooth(inv(s.tm.tTrip, s.tm.tCon, t)) * 0.55) : 0;
    const gap = 5 * (1 - Math.min(1, cf / 0.55));
    const kx0 = hx0 + 8, kx1 = hx1 - 22, fy1 = y0 + 214;
    const jb = (c) => { for (const sg of [-1, 1]) { const yin = yc + sg * (bh + gap), yout = yc + sg * 29; c.rect(kx0, Math.min(yin, yout), kx1 - kx0, Math.abs(yout - yin)); } };
    fil(ctx, jb, "#3a2a10", 1); stk(ctx, jb, COL.amber, 1.6, 0.8, 1);

    if (s.contact) {
      const a = smooth(inv(s.tm.tCon, s.tm.tCon + 0.3, t));
      const xa = (kx0 + kx1) / 2;
      layer(ctx, "p2arr", xa - 16, yc - 84, 130, 168, a, (g) => {
        for (const sg of [-1, 1]) { stk(g, (c) => { c.moveTo(xa, yc + sg * 76); c.lineTo(xa, yc + sg * 58); }, COL.amber, 3, 1, 1); arrowHead(g, xa, yc + sg * 48, sg > 0 ? -Math.PI / 2 : Math.PI / 2, 12, COL.amber, 1); }
        txt(L, g, "Klemmkraft", xa + 14, yc - 66, { size: 14, weight: 600, color: COL.amber });
      });
    }
    // Einbaulage: Schienen laufen mit, Fangvorrichtungen leuchten
    const off = ((s.D * 0.12) % 18 + 18) % 18;
    stk(ctx, (c) => { for (const xr of [rx1, rx2]) for (let y = y0 + 50 + 18 - off; y < y0 + h - 20; y += 18) { c.moveTo(xr - 4, y); c.lineTo(xr + 4, y); } }, COL.cyan, 1, 0, 0.45, { cap: "butt" });
    const gb = (c) => { for (const xr of [rx1, rx2]) c.rect(xr - 9, fy1 - 4, 18, 16); };
    fil(ctx, gb, rgba(COL.amber, 0.25 + 0.4 * s.heat), 1);
    stk(ctx, gb, s.contact ? COL.amber : mix(COL.steel, COL.amber, 0.5), 1.6, 0.8, 1);
    const pu = 0.5 + 0.5 * Math.sin(t * 3.2);
    stk(ctx, (c) => c.arc(rx1, fy1 + 4, 20 + 3 * pu, 0, TAU), COL.amber, 1.6, 0.8, 0.55 + 0.35 * pu);
    if (s.heat > 0.05) {
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      stk(ctx, (c) => { for (const sg of [-1, 1]) { c.moveTo(kx0, yc + sg * bh); c.lineTo(kx1, yc + sg * bh); } }, COL.amber, 2, 2, s.heat * 0.9, { cap: "butt" });
      fil(ctx, (c) => { for (const sg of [-1, 1]) { const yin = yc + sg * (bh + gap), yout = yc + sg * 29; c.rect(kx0, Math.min(yin, yout), kx1 - kx0, Math.abs(yout - yin)); } }, "#ff7a1a", 0.3 * s.heat);
      for (const xr of [rx1, rx2]) dot(ctx, xr, fy1 + 4, 20, COL.amber, 0.6 * s.heat);
      ctx.restore();
    }
    GA = sG;
  }

  // ---------- Hauptfunktion ----------
  function render(ctx, p) {
    const L = p.L || CE.lib; if (!L) return;
    const cfg = config(p.params);
    const d = Math.max(1, num(p.d, 8)), t = clamp(num(p.t, 0), 0, d);
    const s = computeState(t, d, cfg);
    const P = pats(ctx);
    const intro = smooth(inv(0, Math.min(0.55, 0.1 * d), t));
    GA = intro;
    const SK = window.__SGSKIP || {};
    if (!SK.fx) drawFX(ctx, s, t);
    ctx.save(); ctx.translate(s.shx, s.shy);
    if (!SK.back) drawHousingBack(ctx, s);
    if (!SK.rail) drawRail(ctx, P, s);
    if (!SK.trace) drawTrace(ctx, s);
    if (!SK.parts) drawMech(ctx, P, s);
    if (!SK.heat) drawHeat(ctx, s);
    if (!SK.rope) drawRope(ctx, s);
    if (!SK.tape) drawTape(ctx, L, s);
    if (!SK.fx) drawDirection(ctx, L, s);
    if (!SK.sparks) drawSparks(ctx, s);
    ctx.restore();
    GA = 1;
    if (!SK.tags) drawCallouts(ctx, L, s);
    if (!SK.p1) drawPanel1(ctx, L, s);
    if (!SK.p2) drawPanel2(ctx, L, s);
  }

  CE.register("safety_gear", {
    ownsText: false,
    draw(ctx, p) {
      GA = 1;
      ctx.save();
      try { render(ctx, p || {}); } catch (e) { ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle="red"; ctx.font="30px sans-serif"; ctx.fillText("DBG " + e.message + " " + (e.stack||"").split("\n")[1], 40, 1040); }
      finally { ctx.restore(); GA = 1; }
    },
  });
})();
