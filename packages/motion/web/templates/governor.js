/* Template "governor" – Geschwindigkeitsbegrenzer in Nahaufnahme (Röntgen-/Blueprint-Stil).
   Begrenzerscheibe mit zwei Fliehgewichten (Drehpunkt, Feder, Klinkennase = Sperrklinke), fester Sperrzahnkranz,
   Begrenzerseil über die Scheibe, Seilklemme, Auslösehebel an der Kabine, Übergeschwindigkeitsschalter und
   Tacho in % der Nenngeschwindigkeit (rote Auslösemarke).

   BEATS (params.beats = Sekunden ab Szenenstart; null/fehlend = Standard; alle Zeiten auf [0,3 ; d−0,3] geklemmt):
     [0] = Drehzahl beginnt zu steigen (Rampe ab speed_from)                        Standard 0,1·d
     [1] = Übergeschwindigkeitsschalter öffnet („Motor aus“, nur show_switch)       Standard: Rampe kreuzt switch_percent
           (gesetzt: die Rampe wird so geformt, dass sie switch_percent genau dann erreicht)
     [2] = Sperrklinke greift – Scheibe blockiert (Stoß, Blitz, Lupe)               Standard 0,452·d
           (tripped=false: Rampe erreicht speed_percent, Standard 0,55·d)
     [3] = Seilklemme greift („Seil geklemmt“)                                       Standard [2] + 0,004·d (≥ [2])
     [4] = Hebel an der Kabine zieht – „löst Fangvorrichtung aus“ (show_lever)      Standard [3] + 0,008·d (≥ [3])
     [5] = Kabine steht, Anzeige 0 % (nur car_stops)                                 Standard [4] + 0,4 s + 0,22·d
     [6] = Badge „kein Strom nötig“ (nur no_power_icon)                              Standard [2] + max(0,8 s; 0,1·d)
   "at" (Sekunden) akzeptieren: labels[] ({part,text,at}), analogy ({type,at,label,sub}),
     no_power_icon ({at,label,sub}), trip_label_at (rote Auslöse-%-Marke am Tacho). Einmal sichtbar bleibt alles stehen.

   Params:
     speed_percent   Zielwert der Rampe in % (Default 130; bei Auslösung mind. trip_percent + 1)
     speed_from      Startwert (Default 100)       trip_percent  Auslösegeschwindigkeit (Default 115)
     switch_percent  Schalter öffnet (Default min(110, trip − 3))
     tripped         bool (Default: true, wenn die Rampe die Auslösegrenze erreicht)
     car_stops       bool (Default true) – Kabine kommt nach dem Fangen zum Stehen (Anzeige fällt auf 0 %)
     rated_speed     Nenngeschwindigkeit in m/s (optional, nur Anzeige)
     show_switch     bool (Default true, bei no_power_icon false) – Schalter-Panel, Amber-Bogen, Chip „SCHALTER OFFEN“
     show_switch_percent bool (Default true) – false: „öffnet vor der mechanischen Auslösung“ ohne Zahl
     show_peak       bool (Default true) – false: Chip nur „GESTOPPT“, kein Schleppzeiger
     show_readout    bool (Default true) – false: keine große %-Zahl (Nadel + Bogen bleiben)
     show_lever      bool (Default true) – Kabinen-Inset mit Auslösehebel + „löst Fangvorrichtung aus“
     no_power_icon   bool | {at,label,sub} – durchgestrichener Blitz „kein Strom nötig“ / „rein mechanisch“
     analogy         "kettenkarussell" | {type,at,label,sub} – Kettenkarussell, Sitze schwenken synchron mit den Fliehgewichten
     labels          true | false | [string | {part,text,at,hot_text}] | {part: at | text | {...}}
                     parts: rope | weights | spring | ring | clamp | pawl (pawl nur auf Wunsch)
                     Standardzeiten: rope 0,02·d, weights 0,04·d, spring 0,07·d, ring 0,10·d, clamp 0,13·d, pawl 0,16·d
     lens_label, lens_sub, lever_label, no_power_label, no_power_sub, analogy_label, analogy_sub – Texte
     Kartenplätze: ohne Schalter -> rechts unten (Panel-Platz); Karussell + Badge -> Karussell rechts, Badge links unten;
                   mit Schalter -> nur eine Karte (die erste: analogy vor no_power_icon) links unten
     fit             bool (Default true) – Layout schrumpft bei Kamerafahrten so weit, dass 90 px Rand bleiben
     layout_scale    Zahl – erzwingt den Layout-Maßstab */
(function () {
  "use strict";
  const CE = window.CE;
  if (!CE || typeof CE.register !== "function") return;

  const TAU = Math.PI * 2, D2R = Math.PI / 180;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const inv = (a, b, x) => clamp((x - a) / (b - a || 1e-6));
  const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const easeOutBack = (t) => { t = clamp(t); const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const h01 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const isNum = (x) => typeof x === "number" && Number.isFinite(x);

  const COL = { cyan: "#3fd2ff", amber: "#ffb347", red: "#ff5a5f", white: "#eef6ff", muted: "#8fb3d9", steel: "#9fc4e6", rope: "#d4ebff" };
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
  const fmtPct = (v) => `${Math.round(v)} %`;
  const fmtDec = (v, dec) => v.toFixed(dec).replace(".", ",");

  // ---------- Layout (px) ----------
  const CX = 640, CY = 455, S = 0.94; // Scheibenmitte, Maßstab Designeinheiten -> px
  const R_RIM = 240, R_GROOVE = 228, R_ROPE = 232, R_WEB = 214;
  const R_RING = 207, R_TB = 199, R_TT = 180; // Sperrzahnkranz: Außenrand, Zahngrund, Zahnspitze (Innenverzahnung)
  const NT = 20, PITCH = TAU / NT;
  const PIV = [124, 0]; // Drehpunkt Fliehgewicht 0
  const RR = R_ROPE * S, XL = CX - RR, XR = CX + RR;
  const FLOOR_Y = 722;
  const INS = { x: 788, y: 770, w: 427, h: 124 };
  const GAU = { x: 1515, y: 470, r: 210, vmax: 150 };
  const PAN = { x: 1240, y: 676, w: 560, h: 208 };   // Schalter-Panel bzw. freier Kartenplatz rechts unten
  const SLOT_L = { x: 96, y: 774, w: 312, h: 122 };   // Ausweichplatz links unten (statt Spannrollen-Notiz)
  const CONTACT = 30 * D2R; // Bildschirmwinkel der Eingriffsstelle von Fliehgewicht 0 im gesperrten Zustand
  const OMEGA100 = 1.6;     // rad/s bei 100 % (Darstellung, aliasing-frei für die Seilstruktur)
  const LEVER = { px: 1150, py: 848, rise: 18 };
  const TAG_LX = 380;       // rechte Kante der linken Beschriftungen
  const SAFE = { l: 90, r: 1830, t: 90, b: 910 };

  const pc = (r, aDeg) => [r * Math.cos(aDeg * D2R), r * Math.sin(aDeg * D2R)];

  // ---------- Fliehgewicht (Designeinheiten, Drehpunkt bei PIV, Masse vorn, Klinkennase an der Vorderkante) ----------
  const FW_POLAR = (() => {
    const pts = [];
    for (let a = 6; a <= 66.01; a += 10) pts.push([132, a]);
    pts.push([137, 71]); pts.push([145, 76]);
    for (let a = 82; a <= 108.01; a += 6.5) pts.push([146, a]);
    pts.push([152, 113.5]);
    pts.push([166, 119.5]); // Klinkennase
    pts.push([150, 122.5]);
    pts.push([124, 121.5]);
    pts.push([96, 119.5]);
    for (let a = 114; a >= 79.99; a -= 8.5) pts.push([92, a]);
    pts.push([104, 73]); pts.push([116, 68]);
    for (let a = 60; a >= 5.99; a -= 9) pts.push([116, a]);
    return pts;
  })();
  const FW_PTS = FW_POLAR.map(([r, a]) => pc(r, a));
  const HOOK = pc(166, 119.5), MASS = pc(119, 98), SPR_FW = pc(101, 102), SPR_ANCH = pc(106, 172);
  const BOLT = pc(119, 99), SEP_A = pc(98, 78), SEP_B = pc(145, 78);

  function fwLocal(q, al) { const c = Math.cos(-al), s = Math.sin(-al); const dx = q[0] - PIV[0], dy = q[1] - PIV[1]; return [PIV[0] + dx * c - dy * s, PIV[1] + dx * s + dy * c]; }
  function toWorld(q, rot, ox = 0, oy = 0) { const c = Math.cos(rot), s = Math.sin(rot); return [CX + ox + S * (q[0] * c - q[1] * s), CY + oy + S * (q[0] * s + q[1] * c)]; }
  const hookR = (al) => { const h = fwLocal(HOOK, al); return Math.hypot(h[0], h[1]); };
  function solveAlpha(rT) { let lo = 0, hi = 0.8; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (hookR(m) < rT) lo = m; else hi = m; } return (lo + hi) / 2; }
  const AL_E = solveAlpha(R_TT + 1.5);          // Klinkennase erreicht Zahnspitzen
  const AL_SEAT = solveAlpha((R_TT + R_TB) / 2 + 2); // Klinkennase sitzt in der Zahnlücke
  const PSI_SEAT = (() => { const h = fwLocal(HOOK, AL_SEAT); return Math.atan2(h[1], h[0]); })();
  const RING_PHASE = CONTACT + 0.012;
  const THETA_LOCK = CONTACT - PSI_SEAT;

  // ---------- Zeichen-Helfer (eigene, damit Gruppen-Alpha GA durchgereicht wird) ----------
  let GA = 1, WM = 1; // Gruppen-Alpha, Linienbreiten-Faktor (Lupe)
  function stk(ctx, build, color, w, glow, alpha, o) {
    const a = GA * (alpha == null ? 1 : alpha); if (a <= 0.004) return;
    ctx.save(); ctx.lineCap = (o && o.cap) || "round"; ctx.lineJoin = "round"; ctx.strokeStyle = color;
    if (o && o.dash) { ctx.setLineDash(o.dash); ctx.lineDashOffset = o.dashOff || 0; }
    ctx.beginPath(); build(ctx);
    w *= WM;
    if (glow > 0) { ctx.globalAlpha = a * Math.min(1, 0.26 * glow); ctx.lineWidth = w * 3.4; ctx.stroke(); }
    ctx.globalAlpha = a; ctx.lineWidth = w; ctx.stroke(); ctx.restore();
  }
  function fil(ctx, build, color, alpha, rule) { const a = GA * alpha; if (a <= 0.004) return; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = color; ctx.beginPath(); build(ctx); ctx.fill(rule || "nonzero"); ctx.restore(); }
  function txt(L, ctx, s, x, y, o) { const a = GA * (o.alpha == null ? 1 : o.alpha); if (a <= 0.004) return; L.text(ctx, s, x, y, Object.assign({}, o, { alpha: a })); }
  function dot(ctx, x, y, r, color, alpha) {
    const a = GA * alpha; if (a <= 0.004 || r <= 0.5) return;
    ctx.save(); ctx.globalAlpha = a; const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, 0.95)); g.addColorStop(0.28, rgba(color, 0.4)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
  }
  const rr = (c, x, y, w, h, r) => { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  const polyB = (pts, close) => (c) => { pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); if (close) c.closePath(); };
  const ellB = (x, y, rx, ry, a0 = 0, a1 = TAU) => (c) => { c.moveTo(x + rx * Math.cos(a0), y + ry * Math.sin(a0)); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, a0, a1); };
  function arrowHead(ctx, x, y, ang, size, color, alpha) {
    fil(ctx, (c) => { c.moveTo(x, y); c.lineTo(x - Math.cos(ang - 0.45) * size, y - Math.sin(ang - 0.45) * size); c.lineTo(x - Math.cos(ang + 0.45) * size, y - Math.sin(ang + 0.45) * size); c.closePath(); }, color, alpha);
  }
  function springB(x1, y1, x2, y2, coils, amp) {
    return (c) => {
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
      const lead = Math.min(10, len * 0.12), body = len - 2 * lead, n = coils * 2;
      c.moveTo(x1, y1); c.lineTo(x1 + ux * lead, y1 + uy * lead);
      for (let k = 1; k < n; k++) { const s = lead + body * (k / n), sd = k % 2 ? 1 : -1; c.lineTo(x1 + ux * s + nx * amp * sd, y1 + uy * s + ny * amp * sd); }
      c.lineTo(x2 - ux * lead, y2 - uy * lead); c.lineTo(x2, y2);
    };
  }

  // ---------- Sprite-Cache (statische Teile einmal rastern, dann nur noch drawImage) ----------
  const SPR = new Map();
  function sprite(key, w, h, drawFn) {
    if (SPR.has(key)) return SPR.get(key);
    let cv = null;
    try {
      cv = document.createElement("canvas"); cv.width = Math.max(1, Math.ceil(w)); cv.height = Math.max(1, Math.ceil(h));
      const g = cv.getContext("2d");
      if (!g) cv = null;
      else { const sG = GA, sW = WM; GA = 1; WM = 1; try { drawFn(g); } finally { GA = sG; WM = sW; } }
    } catch (e) { cv = null; }
    if (SPR.size > 96) SPR.clear();
    SPR.set(key, cv);
    return cv;
  }
  /** Zeichnet ein Sprite (oder als Rückfall die Vektorversion). */
  function layer(ctx, key, x0, y0, w, h, alpha, drawFn) {
    const a = GA * alpha; if (a <= 0.004) return;
    const cv = sprite(key, w, h, (g) => { g.translate(-x0, -y0); drawFn(g); });
    if (cv) { ctx.save(); ctx.globalAlpha = a; ctx.drawImage(cv, x0, y0); ctx.restore(); }
    else { const sG = GA; GA = a; drawFn(ctx); GA = sG; }
  }
  const MEAS = new Map();
  function meas(L, ctx, text, o) { const k = text + "|" + (o.size || 40) + "|" + (o.weight || 600) + "|" + (o.font || "") + "|" + (o.letterSpacing || 0); let w = MEAS.get(k); if (w == null) { w = L.measure(ctx, text, o); if (MEAS.size > 512) MEAS.clear(); MEAS.set(k, w); } return w; }
  /** Größte Schriftgröße (<= size, >= min), bei der `text` in maxW passt. */
  function fitSize(L, ctx, text, maxW, size, min, o) { let z = size; while (z > min && meas(L, ctx, text, Object.assign({}, o, { size: z })) > maxW) z -= 1; return z; }
  /** Umbruch in höchstens `maxLines` Zeilen; Schrift schrumpft bei Bedarf. */
  function wrapFit(L, ctx, text, maxW, size, min, maxLines, o) {
    const words = String(text).split(/\s+/).filter(Boolean);
    for (let z = size; z >= Math.max(min, Math.round(size * 0.8)); z--) if (meas(L, ctx, String(text), Object.assign({}, o, { size: z })) <= maxW) return { lines: [String(text)], size: z };
    for (let z = size; z >= min; z--) {
      const oo = Object.assign({}, o, { size: z }); const lines = []; let cur = "";
      for (const w of words) { const test = cur ? cur + " " + w : w; if (cur && meas(L, ctx, test, oo) > maxW) { lines.push(cur); cur = w; } else cur = test; }
      if (cur) lines.push(cur);
      if (lines.length <= maxLines && lines.every((l) => meas(L, ctx, l, oo) <= maxW)) return { lines, size: z };
      if (z === min) return { lines: lines.slice(0, maxLines), size: z };
    }
    return { lines: [String(text)], size: min };
  }

  /** Beschriftung mit Führungslinie (Box am Anker bx/by, Ziel(e) mit Gewicht für weiche Übergänge). */
  function tag(ctx, L, targets, bx, by, text, prog, o = {}) {
    const p = clamp(prog); if (p <= 0) return;
    const color = o.color || COL.cyan, size = o.size || 24, al = o.alpha == null ? 1 : o.alpha;
    const lines = Array.isArray(text) ? text : [String(text)], lh = size * 1.2;
    let tw = 0; for (const l of lines) tw = Math.max(tw, meas(L, ctx, l, { size, weight: 600 }));
    const bw = tw + 30, bh = size + 18 + (lines.length - 1) * lh, ty0 = by - bh / 2 + 9 + size * 0.86;
    const drawLines = (g, x0, a) => lines.forEach((l, i) => txt(L, g, l, x0, ty0 + i * lh, { size, weight: 600, color: o.textColor || COL.white, alpha: a }));
    const right = o.align === "right"; const left = right ? bx - bw : bx; const ex = right ? bx + 24 : bx - 24;
    const lp = easeOut(inv(0, 0.6, p)), bp = inv(0.4, 1, p);
    for (const tg of targets) {
      const aw = al * (tg[2] == null ? 1 : tg[2]); if (aw <= 0.01) continue;
      const tx = tg[0], ty = tg[1];
      dot(ctx, tx, ty, 13, color, aw * 0.8 * p);
      fil(ctx, (c) => c.arc(tx, ty, 3.8, 0, TAU), color, aw * p);
      stk(ctx, (c) => {
        c.moveTo(tx, ty);
        const k1 = clamp(lp / 0.75); c.lineTo(lerp(tx, ex, k1), lerp(ty, by, k1));
        if (lp > 0.75) { const k2 = (lp - 0.75) / 0.25; c.lineTo(lerp(ex, bx, k2), by); }
      }, color, 1.6, 0.5, aw * 0.85);
    }
    if (bp <= 0) return;
    const boxB = (g, bl, bwA, a) => {
      fil(g, (c) => rr(c, bl, by - bh / 2, bwA, bh, 6), "rgb(4,12,26)", 0.86 * a);
      stk(g, (c) => rr(c, bl, by - bh / 2, bwA, bh, 6), color, 1.4, 0.4, 0.6 * a);
    };
    if (p >= 1) { // fertig eingeblendet: gecachtes Sprite
      const pad = 10;
      layer(ctx, "tag|" + lines.join("\n") + "|" + color + "|" + size + "|" + (o.textColor || ""), left - pad, by - bh / 2 - pad, bw + 2 * pad, bh + 2 * pad, al, (g) => {
        boxB(g, left, bw, 1);
        drawLines(g, left + 15, 1);
      });
      return;
    }
    const bwA = bw * easeOut(bp);
    boxB(ctx, right ? bx - bwA : left, bwA, al * bp);
    drawLines(ctx, left + 15, al * inv(0.6, 1, p));
  }

  // ---------- Parameter ----------
  function num(v, def) { const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : typeof v === "number" ? v : NaN; return Number.isFinite(n) ? n : def; }
  function bool(v) {
    if (v === undefined || v === null || v === "") return undefined;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "object") return true;
    const s = String(v).trim().toLowerCase();
    if (["true", "1", "ja", "yes", "y", "on", "wahr", "an"].includes(s)) return true;
    if (["false", "0", "nein", "no", "n", "off", "falsch", "aus", "none"].includes(s)) return false;
    return undefined;
  }
  function pick(P, keys) { for (const k of keys) { const v = P[k]; if (v !== undefined && v !== null && v !== "") return v; } return undefined; }
  function str(v, def) { return typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : def; }

  const PART_DEF = [
    { id: "clamp", keys: ["seilklemme", "klemme", "clamp", "grip", "geklemmt"], text: "Seilklemme", hot: "Seil geklemmt", at: 0.13, y: 626 },
    { id: "pawl", keys: ["sperrklinke", "klinke", "pawl", "hook", "nase"], text: "Sperrklinke", at: 0.16, y: 542, opt: true },
    { id: "ring", keys: ["sperrzahnkranz", "zahnkranz", "ratchet", "ring", "zahn"], text: "Sperrzahnkranz (fest)", at: 0.1, y: 480 },
    { id: "weights", keys: ["fliehgewicht", "gewicht", "flyweight", "weight", "mass", "flieh"], text: "Fliehgewichte", at: 0.04, y: 390 },
    { id: "spring", keys: ["feder", "spring"], text: "Feder", at: 0.07, y: 300 },
    { id: "rope", keys: ["begrenzerseil", "seil", "rope"], text: "Begrenzerseil", at: 0.02, y: 604 },
  ];
  function partOf(s) { s = String(s == null ? "" : s).toLowerCase().trim(); if (!s) return null; for (const pd of PART_DEF) if (pd.id === s || pd.keys.some((k) => s.includes(k))) return pd; return null; }
  function parseLabels(P, d, ct) {
    let raw = pick(P, ["labels", "tags", "part_labels", "callouts"]);
    if (typeof raw === "string" && bool(raw) === undefined) raw = raw.split(/[;|]/);
    const mk = (pd, o) => {
      const at = num(o.at, NaN);
      return { id: pd.id, y: pd.y, text: str(o.text, pd.text), hot: str(o.hot, pd.hot || ""), at: ct(Number.isFinite(at) ? at : pd.at * d) };
    };
    if (raw === undefined || raw === true) return PART_DEF.filter((pd) => !pd.opt).map((pd) => mk(pd, {}));
    if (bool(raw) === false && !Array.isArray(raw) && typeof raw !== "object") return [];
    const fromItem = (it, keyHint) => {
      if (typeof it === "string") { const pd = partOf(keyHint || it); if (!pd) return null; const exact = !keyHint && (it.toLowerCase().trim() === pd.id); return { pd, o: { text: exact ? undefined : it } }; }
      if (typeof it === "number") { const pd = partOf(keyHint); return pd ? { pd, o: { at: it } } : null; }
      if (it === true) { const pd = partOf(keyHint); return pd ? { pd, o: {} } : null; }
      if (it && typeof it === "object") {
        const pd = partOf(keyHint || it.part || it.key || it.target || it.id || it.text || it.label); if (!pd) return null;
        return { pd, o: { text: it.text ?? it.label, hot: it.hot_text ?? it.hotText ?? it.text_hot ?? it.hot, at: it.at ?? it.t ?? it.time } };
      }
      return null;
    };
    const out = [], seen = new Set();
    if (Array.isArray(raw)) {
      for (const it of raw) { const r = fromItem(it); if (!r || seen.has(r.pd.id)) continue; seen.add(r.pd.id); out.push(mk(r.pd, r.o)); }
      return out;
    }
    if (raw && typeof raw === "object") { // Map: Überschreibungen der Standard-Beschriftungen (false = weglassen)
      const ov = new Map();
      for (const k of Object.keys(raw)) { const pd = partOf(k); if (!pd) continue; if (raw[k] === false || raw[k] === null) { ov.set(pd.id, null); continue; } const r = fromItem(raw[k], k); if (r) ov.set(pd.id, r.o); }
      for (const pd of PART_DEF) { if (ov.has(pd.id)) { const o = ov.get(pd.id); if (o) out.push(mk(pd, o)); } else if (!pd.opt) out.push(mk(pd, {})); }
      return out;
    }
    return [];
  }
  function parseCard(v, defs) { // bool | string | {at,label,sub,type}
    if (v === undefined || v === null || v === false) return null;
    const b = bool(v); if (b === false) return null;
    if (v && typeof v === "object" && !Array.isArray(v)) return { type: str(v.type, defs.type), at: num(v.at ?? v.t ?? v.time, NaN), label: str(v.label ?? v.text ?? v.title, null), sub: v.sub === false ? "" : str(v.sub ?? v.subline, null) };
    return { type: typeof v === "string" ? v : defs.type, at: NaN, label: null, sub: null };
  }

  /** Hermite-Spline durch Knoten [t, v, m] (monoton bei passend gewählten Steigungen). */
  function hermite(K) {
    return (t) => {
      if (t <= K[0][0]) return K[0][1];
      for (let i = 0; i < K.length - 1; i++) {
        const a = K[i], b = K[i + 1];
        if (t <= b[0]) { const h = b[0] - a[0] || 1e-6, x = (t - a[0]) / h, x2 = x * x, x3 = x2 * x; return (2 * x3 - 3 * x2 + 1) * a[1] + (x3 - 2 * x2 + x) * h * a[2] + (-2 * x3 + 3 * x2) * b[1] + (x3 - x2) * h * b[2]; }
      }
      return K[K.length - 1][1];
    };
  }

  function config(P, d) {
    const lo = Math.min(0.3, d * 0.5), hi = Math.max(lo, d - 0.3), ct = (x) => clamp(x, lo, hi);
    const beatsRaw = pick(P, ["beats", "beat_times", "beatTimes"]);
    const BA = Array.isArray(beatsRaw) ? beatsRaw : [];
    const B = (i) => { const v = BA[i]; if (v === null || v === undefined || v === "") return NaN; const n = num(v, NaN); return Number.isFinite(n) ? ct(n) : NaN; };
    const when = (i, def) => { const b = B(i); return Number.isFinite(b) ? b : ct(def); };

    let target = num(pick(P, ["speed_percent", "speedPercent", "speed", "target_percent", "targetPercent", "target", "percent", "v_percent"]), 130);
    if (target > 0 && target <= 2.5) target *= 100; // Anteil statt Prozent
    target = clamp(target, 0, 200);
    const trip = clamp(num(pick(P, ["trip_percent", "tripPercent", "trip_at", "tripAt", "trip_speed"]), 115), 102, 145);
    let sw = num(pick(P, ["switch_percent", "switchPercent", "switch_at", "switchAt"]), NaN);
    if (!Number.isFinite(sw)) sw = Math.min(110, trip - 3);
    sw = clamp(sw, 50, trip - 1);
    let from = num(pick(P, ["speed_from", "speedFrom", "from_percent", "start_percent", "from", "start"]), NaN);
    if (!Number.isFinite(from)) from = Math.min(100, target);
    from = clamp(from, 0, 200);
    const tb = bool(pick(P, ["tripped", "triggered", "ausgeloest", "ausgelöst", "is_tripped"]));
    const tripped = tb === undefined ? Math.max(target, from) >= trip : tb;
    if (tripped) { from = Math.min(from, trip - 6); target = Math.max(target, trip + 1); }
    const cs = bool(pick(P, ["car_stops", "carStops", "stops"]));
    const carStops = cs === undefined ? true : cs;
    const rated = num(pick(P, ["rated_speed", "ratedSpeed", "nenngeschwindigkeit", "v_nenn", "rated_mps"]), NaN);

    const noPower = parseCard(pick(P, ["no_power_icon", "noPowerIcon", "no_power", "kein_strom", "ohne_strom"]), { type: "no_power" });
    const analogyC = parseCard(pick(P, ["analogy", "analogie", "analogy_icon"]), { type: "kettenkarussell" });
    const analogy = analogyC && /karussell|carousel|kette|chain|true|1/i.test(String(analogyC.type || "kettenkarussell")) ? analogyC : null;
    const ssw = bool(pick(P, ["show_switch", "showSwitch", "switch_panel", "show_switch_panel"]));
    const showSwitch = ssw === undefined ? !noPower : ssw;
    const showSwPct = bool(pick(P, ["show_switch_percent", "showSwitchPercent", "switch_percent_label"])) !== false;
    const showPeak = bool(pick(P, ["show_peak", "showPeak", "peak"])) !== false;
    const showReadout = bool(pick(P, ["show_readout", "showReadout", "readout", "show_value"])) !== false;
    const showLever = bool(pick(P, ["show_lever", "showLever", "lever_inset", "show_car_lever"])) !== false;

    const c = { target, trip, sw, from, tripped, carStops, rated, d, lo, hi, showSwitch, showSwPct, showPeak, showReadout, showLever };
    c.tIn = clamp(0.05 * d, 0.2, 0.5);
    let t0 = when(0, 0.1 * d);

    if (tripped) {
      let tH = when(2, 0.452 * d);
      const lat = clamp(0.012 * d, 0.05, 0.12);
      tH = Math.max(tH, lat + 0.2);
      const tT = tH - lat;
      t0 = clamp(t0, 0, Math.max(0, tT - 0.2));
      const K = [[t0, from, 0]];
      const b1 = showSwitch ? B(1) : NaN;
      if (Number.isFinite(b1) && sw > from + 0.5 && sw < trip - 0.5 && b1 > t0 + 0.1 && b1 < tT - 0.1) K.push([b1, sw, 0]);
      K.push([tT, trip, 0]);
      const sec = []; for (let i = 0; i < K.length - 1; i++) sec.push((K[i + 1][1] - K[i][1]) / Math.max(1e-3, K[i + 1][0] - K[i][0]));
      for (let i = 1; i < K.length - 1; i++) { const a = sec[i - 1], b = sec[i]; K[i][2] = a > 0 && b > 0 ? 2 / (1 / a + 1 / b) : 0; }
      K[K.length - 1][2] = 1.5 * Math.max(0.5, sec[sec.length - 1]);
      const ramp = hermite(K), m2 = K[K.length - 1][2];
      const A = Math.max(0.5, target - trip), tauP = A / Math.max(1e-3, m2);
      c.raw = (t) => (t < tT ? ramp(t) : trip + A * (1 - Math.exp(-(t - tT) / tauP)));
      c.tT = tT; c.tH = tH;
      c.tC = Math.max(tH, when(3, tH + 0.004 * d));
      c.tLev = Math.max(c.tC, when(4, c.tC + 0.008 * d));
      const b5 = B(5);
      let tDec = c.tLev + 0.4, tStop = Number.isFinite(b5) ? b5 : tDec + Math.max(0.5, 0.22 * d);
      tStop = Math.max(tStop, tH + 0.35);
      if (tDec > tStop - 0.3) tDec = Math.max(tH + 0.05, tStop - 0.3);
      c.tDec = tDec; c.tStop = tStop;
      c.vDec = c.raw(tDec);
      c.speed = (t) => (t <= tDec || !carStops ? c.raw(t) : c.vDec * (1 - smooth((t - tDec) / (tStop - tDec))));
      c.peak = carStops ? c.vDec : c.raw(d);
      c.tNP = when(6, Math.max(c.tLev + 0.5, tH + Math.max(0.8, 0.1 * d)));
    } else {
      const tE = Math.max(when(2, 0.55 * d), 0.25);
      t0 = clamp(t0, 0, tE - 0.2);
      c.raw = (t) => from + (target - from) * easeInOut(inv(t0, tE, t));
      c.speed = c.raw; c.peak = Math.max(from, target);
      c.tT = c.tH = c.tC = c.tLev = c.tDec = c.tStop = Infinity;
      c.tNP = when(6, 0.5 * d);
    }
    c.t0 = t0;
    // ∫ ω dt – Tabelle (Rohgeschwindigkeit, ohne Stopp)
    const N = 480, dt = d / N, cum = new Float32Array(N + 1);
    for (let i = 0; i < N; i++) cum[i + 1] = cum[i] + (OMEGA100 / 100) * c.raw((i + 0.5) * dt) * dt;
    c.integ = (t) => { const x = clamp(t / dt, 0, N), i = Math.min(N - 1, Math.floor(x)), f = x - i; return cum[i] + (cum[i + 1] - cum[i]) * f; };
    // Schalter
    c.tSw = Infinity;
    if (showSwitch) {
      const b1 = B(1);
      if (Number.isFinite(b1) && tripped && b1 < c.tT) c.tSw = b1;
      else for (let i = 0; i <= 600; i++) { const t = (i / 600) * d; if (c.speed(t) >= sw - 1e-6) { c.tSw = t; break; } }
    }
    if (tripped) {
      c.wT = (OMEGA100 * trip) / 100;
      c.IT = c.integ(c.tT);
      c.theta0 = THETA_LOCK - c.wT * (c.tH - c.tT) - c.IT;
    }
    // Texte, Karten, Beschriftungen
    c.labels = parseLabels(P, d, ct);
    c.labDur = clamp(0.09 * d, 0.35, 0.8);
    c.lensLabel = str(P.lens_label, "Sperrklinke greift");
    c.lensSub = P.lens_sub === false ? "" : str(P.lens_sub, "Scheibe blockiert");
    c.leverLabel = str(P.lever_label, "löst Fangvorrichtung aus");
    const tl = num(pick(P, ["trip_label_at", "tripLabelAt", "trip_mark_at"]), NaN);
    c.tTripLbl = Number.isFinite(tl) ? ct(tl) : -1;
    c.cards = [];
    if (analogy) c.cards.push({ kind: "analogy", at: Number.isFinite(analogy.at) ? ct(analogy.at) : ct(0.12 * d), label: str(P.analogy_label, analogy.label || "Wie ein Kettenkarussell"), sub: P.analogy_sub === false ? "" : str(P.analogy_sub, analogy.sub != null ? analogy.sub : "Fliehkraft drückt nach außen") });
    if (noPower) c.cards.push({ kind: "nopower", at: Number.isFinite(noPower.at) ? ct(noPower.at) : c.tNP, label: str(P.no_power_label, noPower.label || "Kein Strom nötig"), sub: P.no_power_sub === false ? "" : str(P.no_power_sub, noPower.sub != null ? noPower.sub : "rein mechanisch") });
    // Kartenplätze
    if (!showSwitch) {
      if (c.cards.length === 1) c.cards[0].box = { x: PAN.x, y: PAN.y, w: PAN.w, h: PAN.h };
      else if (c.cards.length === 2) { c.cards[0].box = { x: PAN.x, y: PAN.y, w: PAN.w, h: PAN.h }; c.cards[1].box = { x: SLOT_L.x, y: SLOT_L.y, w: SLOT_L.w, h: SLOT_L.h }; } // Karussell groß rechts, Badge links unter der Mechanik
    } else if (c.cards.length) {
      c.cards[0].box = { x: SLOT_L.x, y: SLOT_L.y, w: SLOT_L.w, h: SLOT_L.h };
      c.cards.length = 1; // nur ein Ausweichplatz frei (Schalter-Panel belegt den rechten)
    }
    c.slotL = !!c.cards.find((k) => k.box && k.box.x === SLOT_L.x);
    // Layout-Anpassung an Kamerafahrten (90-px-Rand)
    c.bbox = { l: c.slotL ? SLOT_L.x - 4 : 96, r: 1804, t: 186, b: showLever ? 900 : 890 };
    return c;
  }
  const CFG = new Map();
  function getConfig(P, d) {
    let key; try { key = JSON.stringify(P) + "|" + d; } catch (e) { key = null; }
    if (key && CFG.has(key)) return CFG.get(key);
    const c = config(P, d);
    if (key) { if (CFG.size > 8) CFG.clear(); CFG.set(key, c); }
    return c;
  }

  /** Beschriftungs-Layout: Umbruch (max. 2 Zeilen), linke Spalte ohne Überlappung; erweitert bbox.l. */
  function tagLayout(L, ctx, c) {
    if (c.tagL) return c.tagL;
    const out = [], o = { weight: 600 };
    for (const lb of c.labels) {
      const isC = lb.id === "clamp", maxW = isC ? 300 : TAG_LX - 100 - 30;
      const A = wrapFit(L, ctx, lb.text, maxW, 24, 16, 2, o), H = lb.hot ? wrapFit(L, ctx, lb.hot, maxW, 24, 16, 2, o) : null;
      const h = A.size + 18 + (A.lines.length - 1) * A.size * 1.2;
      let w = 0; for (const l of A.lines) w = Math.max(w, meas(L, ctx, l, Object.assign({ size: A.size }, o)));
      out.push({ lb, lines: A.lines, size: A.size, hotLines: H ? H.lines : null, hotSize: H ? H.size : 0, h, w: w + 30, y: lb.y });
    }
    const left = out.filter((q) => q.lb.id !== "clamp").sort((a, b) => a.y - b.y);
    for (let i = 1; i < left.length; i++) { const a = left[i - 1], b = left[i], m = a.y + a.h / 2 + b.h / 2 + 8; if (b.y < m) b.y = m; }
    const last = left[left.length - 1];
    if (last && last.y + last.h / 2 > 690) { const sh = last.y + last.h / 2 - 690; for (const q of left) q.y -= sh; }
    for (const q of left) c.bbox.l = Math.min(c.bbox.l, TAG_LX - q.w - 4);
    c.tagL = out;
    return out;
  }

  const CAM_EXT = {
    slow_push_in: [[1.1, 0, 0]], slow_pull_out: [[1.1, 0, 0]],
    pan_left: [[1.08, 60, 0], [1.08, -60, 0]], pan_right: [[1.08, 60, 0], [1.08, -60, 0]],
    tilt_down: [[1.08, 0, 45], [1.08, 0, -45]], tilt_up: [[1.08, 0, 45], [1.08, 0, -45]],
  };
  function layoutFit(p, P, c) {
    const f = Array.isArray(P.focus) ? P.focus : [];
    const fx = num(f[0], 0.5) * 1920, fy = num(f[1], 0.5) * 1080;
    const ov = num(pick(P, ["layout_scale", "layoutScale"]), NaN);
    if (Number.isFinite(ov)) return { k: clamp(ov, 0.6, 1.2), fx, fy };
    if (bool(pick(P, ["fit", "fit_camera", "safe_fit"])) === false) return { k: 1, fx, fy };
    const cam = String((p.scene && p.scene.camera) || P.camera || "static");
    const ext = [[1, 0, 0]].concat(CAM_EXT[cam] || []), bb = c.bbox;
    let k = 1;
    for (const [s, dx, dy] of ext) {
      if (fx - bb.l > 1) k = Math.min(k, (fx + dx - SAFE.l) / ((fx - bb.l) * s));
      if (bb.r - fx > 1) k = Math.min(k, (SAFE.r - fx - dx) / ((bb.r - fx) * s));
      if (fy - bb.t > 1) k = Math.min(k, (fy + dy - SAFE.t) / ((fy - bb.t) * s));
      if (bb.b - fy > 1) k = Math.min(k, (SAFE.b - fy - dy) / ((bb.b - fy) * s));
    }
    return { k: clamp(k, 0.8, 1), fx, fy };
  }

  const gFly = (s, trip) => (s <= 100 ? 0.3 * Math.pow(Math.max(0, s) / 100, 2) : 0.3 + 0.7 * clamp((s - 100) / (trip - 100)));

  // ---------- Zustand pro Frame ----------
  function computeState(p) {
    const d = Math.max(0.5, Number(p.d) || 8), t = clamp(Number(p.t) || 0, 0, d), u = clamp(t / d);
    const T = Number.isFinite(Number(p.T)) ? Number(p.T) : t;
    const P = p.params && typeof p.params === "object" ? p.params : {};
    const c = getConfig(P, d);
    const v = c.speed(t);
    let theta, alpha, omega;
    if (!c.tripped) { theta = 0.35 + c.integ(t); alpha = AL_E * 0.97 * gFly(v, c.trip); omega = (OMEGA100 * v) / 100; }
    else if (t < c.tT) { const r = c.raw(t); theta = c.theta0 + c.integ(t); alpha = AL_E * 0.97 * gFly(r, c.trip); omega = (OMEGA100 * r) / 100; }
    else if (t < c.tH) { theta = c.theta0 + c.IT + c.wT * (t - c.tT); alpha = lerp(AL_E * 0.97, AL_SEAT, smooth(inv(c.tT, c.tH, t))); omega = c.wT; }
    else { const tau = t - c.tH; theta = THETA_LOCK - 0.028 * Math.exp(-tau * 8) * Math.max(0, Math.sin(tau * 24)); alpha = AL_SEAT; omega = 0; }
    const tauHit = c.tripped ? t - c.tH : -1;
    const hit = tauHit >= 0;
    const shakeA = hit ? 5 * Math.exp(-tauHit * 9) : 0;
    const rev = (at, dur) => easeOut(inv(at, at + dur, t));
    return {
      c, d, t, u, T, v, theta, alpha, omega, tauHit, hit, P, rev,
      flash: hit ? Math.exp(-tauHit * 6) : 0,
      sx: shakeA * Math.sin(tauHit * 71), sy: shakeA * Math.cos(tauHit * 57),
      clampP: c.tripped ? easeOut(inv(c.tC, c.tC + clamp(0.026 * d, 0.15, 0.3), t)) : 0,
      leverP: c.tripped ? easeOutBack(inv(c.tLev, c.tLev + clamp(0.048 * d, 0.25, 0.45), t)) : 0,
      swOpen: easeOutBack(inv(c.tSw, c.tSw + Math.max(0.2, 0.025 * d), t)),
      swHot: t >= c.tSw,
      dimAfter: c.tripped ? 1 - 0.42 * inv(c.tH + 0.45, c.tH + 1.1, t) : 1,
      pulse: 0.5 + 0.5 * Math.sin(T * 5.2),
      vis: (a, b) => easeOut(inv(a * d, b * d, t)),
    };
  }

  const ringB = (cc) => {
    for (let k = 0; k < NT; k++) {
      const a = RING_PHASE + k * PITCH;
      const p0 = pc(R_TB, a / D2R), p1 = pc(R_TT, a / D2R + 0.5), p2 = pc(R_TT + 1, a / D2R + 2);
      if (k === 0) cc.moveTo(p0[0], p0[1]); else cc.lineTo(p0[0], p0[1]);
      cc.lineTo(p1[0], p1[1]); cc.lineTo(p2[0], p2[1]);
      for (const f of [0.3, 0.55, 0.8]) { const q = pc(R_TT + 1 + (R_TB - R_TT - 1) * Math.pow(f, 0.85), (a + f * PITCH) / D2R); cc.lineTo(q[0], q[1]); }
    }
    cc.closePath();
  };

  /** Unbewegliche Teile der Scheibe (Körper, Sperrzahnkranz, Kreise, Seilbogen) – als Vektor oder im Cache. */
  function drawSheaveStatic(ctx, lens) {
    fil(ctx, (cc) => cc.arc(CX, CY, R_RIM * S, 0, TAU), lens ? "rgb(5,14,30)" : "rgb(7,20,38)", lens ? 1 : 0.78);
    ctx.save(); ctx.translate(CX, CY); ctx.scale(S, S);
    fil(ctx, (cc) => { cc.arc(0, 0, R_RING, 0, TAU); ringB(cc); }, COL.steel, lens ? 0.3 : 0.16, "evenodd");
    stk(ctx, ringB, lens ? "#cfe4f7" : COL.steel, 2.1, 0.5, 0.95);
    stk(ctx, (cc) => cc.arc(0, 0, R_RING, 0, TAU), COL.steel, 1.4, 0, 0.55);
    if (!lens) {
      stk(ctx, (cc) => cc.arc(0, 0, R_RIM, 0, TAU), COL.cyan, 3.4, 1, 0.95);
      stk(ctx, (cc) => cc.arc(0, 0, R_GROOVE - 5, 0, TAU), COL.cyan, 1.4, 0, 0.45);
      stk(ctx, (cc) => cc.arc(0, 0, R_WEB, 0, TAU), COL.cyan, 1.6, 0.3, 0.55);
      stk(ctx, (cc) => cc.arc(0, 0, 40, 0, TAU), COL.cyan, 2.6, 0.8, 0.95);
      stk(ctx, (cc) => cc.arc(0, 0, 16, 0, TAU), COL.cyan, 2, 0.4, 0.8);
    }
    ctx.restore();
    if (!lens) stk(ctx, (cc) => cc.arc(CX, CY, RR, Math.PI, TAU), COL.rope, 7, 0.55, 0.95);
  }
  const HS = 246;
  let SHEAVE_CACHE; // undefined = noch nicht versucht, null = nicht verfügbar
  function sheaveCache() {
    if (SHEAVE_CACHE !== undefined) return SHEAVE_CACHE;
    SHEAVE_CACHE = null;
    try {
      const cv = document.createElement("canvas"); cv.width = cv.height = HS * 2;
      const g = cv.getContext("2d");
      if (g) { const sG = GA, sW = WM; GA = 1; WM = 1; g.translate(HS - CX, HS - CY); drawSheaveStatic(g, false); GA = sG; WM = sW; SHEAVE_CACHE = cv; }
    } catch (e) { SHEAVE_CACHE = null; }
    return SHEAVE_CACHE;
  }

  function drawHitHighlights(ctx, pulse) {
    ctx.save(); ctx.translate(CX, CY); ctx.scale(S, S);
    fil(ctx, (cc) => { for (let i = 0; i < 2; i++) { const a = (RING_PHASE + i * Math.PI) / D2R, pd = PITCH / D2R; const q = [pc(R_TB, a), pc(R_TT, a + 0.5), pc(R_TT + 1, a + 2), pc(R_TT + 1 + (R_TB - R_TT - 1) * Math.pow(0.3, 0.85), a + 0.3 * pd), pc(R_TT + 1 + (R_TB - R_TT - 1) * Math.pow(0.55, 0.85), a + 0.55 * pd), pc(R_RING, a + 0.55 * pd), pc(R_RING, a)]; q.forEach((z, j) => (j ? cc.lineTo(z[0], z[1]) : cc.moveTo(z[0], z[1]))); cc.closePath(); } }, COL.red, 0.28 + 0.1 * pulse);
    stk(ctx, (cc) => { for (let i = 0; i < 2; i++) { const a = (RING_PHASE + i * Math.PI) / D2R; const q0 = pc(R_TB + 1, a), q1 = pc(R_TT - 1, a + 0.5); cc.moveTo(q0[0], q0[1]); cc.lineTo(q1[0], q1[1]); } }, COL.red, 3.2, 1, 0.75 + 0.25 * pulse);
    ctx.restore();
  }

  /** Scheibe, Sperrzahnkranz, Fliehgewichte, Federn, Seil über der Scheibe (Weltkoordinaten; für Lupe mehrfach nutzbar).
      Im gesperrten Endzustand ist alles unbewegt -> ein gecachtes Sprite, darüber nur die pulsierenden Markierungen. */
  function drawMechCore(ctx, L, st, lens) {
    if (!lens && st.hit && st.tauHit > 0.6) {
      const y0 = CY - HS;
      layer(ctx, "coreLocked", CX - HS, y0, HS * 2, FLOOR_Y + 8 - y0, 1, (g) => drawMechBody(g, L, Object.assign({}, st, { theta: THETA_LOCK, alpha: AL_SEAT, omega: 0, T: 0, pulse: 0.5 }), false, true));
      drawHitHighlights(ctx, st.pulse);
      return;
    }
    drawMechBody(ctx, L, st, lens, false);
  }
  function drawMechBody(ctx, L, st, lens, noHi) {
    const { theta, alpha, omega, hit, T, pulse } = st;
    const cache = lens ? null : sheaveCache();
    if (cache) { ctx.save(); ctx.globalAlpha = GA; ctx.drawImage(cache, CX - HS, CY - HS); ctx.restore(); }
    else drawSheaveStatic(ctx, lens);

    if (hit && !noHi) drawHitHighlights(ctx, pulse);
    ctx.save(); ctx.translate(CX, CY); ctx.scale(S, S);
    if (!lens) { // drehende Details der Scheibe
      stk(ctx, (cc) => {
        for (let k = 0; k < 12; k++) { const a = theta + (k * TAU) / 12; cc.moveTo(Math.cos(a) * (R_WEB + 3), Math.sin(a) * (R_WEB + 3)); cc.lineTo(Math.cos(a) * (R_GROOVE - 8), Math.sin(a) * (R_GROOVE - 8)); }
      }, COL.cyan, 1.6, 0, 0.6);
      stk(ctx, (cc) => {
        const k = [Math.cos(theta), Math.sin(theta)], n = [-k[1], k[0]];
        cc.moveTo(k[0] * 16 + n[0] * 5, k[1] * 16 + n[1] * 5); cc.lineTo(k[0] * 22 + n[0] * 5, k[1] * 22 + n[1] * 5); cc.lineTo(k[0] * 22 - n[0] * 5, k[1] * 22 - n[1] * 5); cc.lineTo(k[0] * 16 - n[0] * 5, k[1] * 16 - n[1] * 5);
        for (let j = 0; j < 6; j++) { const a = theta + (j * TAU) / 6 + 0.26; const x = Math.cos(a) * 62, y = Math.sin(a) * 62; cc.moveTo(x + 6, y); cc.arc(x, y, 6, 0, TAU); }
      }, COL.cyan, 1.4, 0, 0.7);
    }
    ctx.restore();

    // --- Hüllkreis der Klinkennasen (zeigt das Ausschwenken) ---
    if (!lens) {
      const nearT = inv(0.55, 1, alpha / AL_E);
      const envCol = hit ? COL.red : nearT > 0.6 ? COL.amber : COL.cyan;
      const er = hookR(alpha) * S, ea = (0.3 + 0.35 * nearT) * (hit ? 0.5 : 1);
      stk(ctx, (cc) => cc.arc(CX, CY, er, 0, TAU), envCol, 1, 0, ea * 0.6);
      stk(ctx, (cc) => { for (let k = 0; k < 24; k++) { const a = k * TAU / 24 - T * 0.12; cc.moveTo(CX + Math.cos(a) * (er - 3), CY + Math.sin(a) * (er - 3)); cc.lineTo(CX + Math.cos(a) * (er + 3), CY + Math.sin(a) * (er + 3)); } }, envCol, 1.6, 0, ea);
    }

    // --- Fliehgewichte (beide in einem Pfad, mit Bewegungsspuren) ---
    const xf = (q, rot, al) => toWorld(al == null ? q : fwLocal(q, al), rot);
    const fwPath = (rotOff) => (cc) => {
      for (let i = 0; i < 2; i++) {
        const rot = theta + i * Math.PI - rotOff;
        for (let j = 0; j < FW_PTS.length; j++) { const w = xf(FW_PTS[j], rot, alpha); if (j) cc.lineTo(w[0], w[1]); else cc.moveTo(w[0], w[1]); }
        cc.closePath();
      }
    };
    if (omega > 0.05 && !lens) for (let k = 2; k >= 1; k--) stk(ctx, fwPath(k * omega * 0.06), COL.amber, 1.5, 0, k === 1 ? 0.2 : 0.09);
    const body = fwPath(0);
    fil(ctx, body, "rgb(52,38,21)", 0.9);
    fil(ctx, (cc) => {
      for (let i = 0; i < 2; i++) {
        const rot = theta + i * Math.PI; let w = xf(SEP_A, rot, alpha); cc.moveTo(w[0], w[1]);
        for (let k = 0; k < FW_PTS.length; k++) { const q = FW_POLAR[k]; if (q[1] >= 78 || (q[0] <= 104 && q[1] >= 72)) { w = xf(FW_PTS[k], rot, alpha); cc.lineTo(w[0], w[1]); } }
        w = xf(SEP_B, rot, alpha); cc.lineTo(w[0], w[1]); cc.closePath();
      }
    }, COL.amber, 0.14);
    stk(ctx, body, COL.amber, 2.6 * S, 0.9, 1);
    stk(ctx, (cc) => {
      for (let i = 0; i < 2; i++) {
        const rot = theta + i * Math.PI, a = xf(SEP_A, rot, alpha), b = xf(SEP_B, rot, alpha), m = xf(BOLT, rot, alpha);
        cc.moveTo(a[0], a[1]); cc.lineTo(b[0], b[1]); cc.moveTo(m[0] + 7 * S, m[1]); cc.arc(m[0], m[1], 7 * S, 0, TAU);
      }
    }, COL.amber, 1.5 * S, 0, 0.75);

    // Federn + Drehpunkte
    const sp = [0, 1].map((i) => { const rot = theta + i * Math.PI; return { a1: xf(SPR_FW, rot, alpha), a2: xf(SPR_ANCH, rot), pv: xf(PIV, rot) }; });
    stk(ctx, (cc) => { for (const q of sp) springB(q.a2[0], q.a2[1], q.a1[0], q.a1[1], 7, 6.5 * S)(cc); }, "#bfeaff", 1.9 * S, 0.6, 0.95);
    fil(ctx, (cc) => { for (const q of sp) { cc.moveTo(q.a2[0] + 4.5 * S, q.a2[1]); cc.arc(q.a2[0], q.a2[1], 4.5 * S, 0, TAU); cc.moveTo(q.a1[0] + 4 * S, q.a1[1]); cc.arc(q.a1[0], q.a1[1], 4 * S, 0, TAU); } }, "#bfeaff", 0.95);
    const boss = (r) => (cc) => { for (const q of sp) { cc.moveTo(q.pv[0] + r * S, q.pv[1]); cc.arc(q.pv[0], q.pv[1], r * S, 0, TAU); } };
    fil(ctx, boss(15), "rgb(5,14,30)", 0.9);
    stk(ctx, boss(15), COL.amber, 2.2 * S, 0.6, 1);
    fil(ctx, boss(5), COL.white, 0.9);

    if (lens) return;
    // --- Begrenzerseil über die Scheibe (mit Litzenstruktur, läuft mit) ---
    const shift = theta * RR;
    stk(ctx, (cc) => { cc.moveTo(XL, FLOOR_Y); cc.lineTo(XL, CY); cc.moveTo(XR, CY); cc.lineTo(XR, FLOOR_Y); }, COL.rope, 7, 0.55, 0.95);
    const segL = FLOOR_Y - CY, arcL = Math.PI * RR, total = segL * 2 + arcL, P = 30;
    const at = (s) => {
      if (s < segL) return [XL, FLOOR_Y - s, 0, -1];
      if (s < segL + arcL) { const a = Math.PI + (s - segL) / RR; return [CX + RR * Math.cos(a), CY + RR * Math.sin(a), -Math.sin(a), Math.cos(a)]; }
      return [XR, CY + (s - segL - arcL), 0, 1];
    };
    ctx.save(); ctx.strokeStyle = "rgba(6,18,38,0.75)"; ctx.lineWidth = 2; ctx.globalAlpha = GA; ctx.beginPath();
    for (let s = ((shift % P) + P) % P; s < total; s += P) {
      const q = at(s), nx = -q[3], ny = q[2];
      for (const o of [-4, 4]) { const bx = q[0] + q[2] * o, by = q[1] + q[3] * o; ctx.moveTo(bx - nx * 3.2 - q[2] * 2.6, by - ny * 3.2 - q[3] * 2.6); ctx.lineTo(bx + nx * 3.2 + q[2] * 2.6, by + ny * 3.2 + q[3] * 2.6); }
    }
    ctx.stroke(); ctx.restore();
  }

  // ---------- Karten: „kein Strom nötig“, Kettenkarussell ----------
  function drawNoPowerIcon(ctx, cx, cy, R, prog, pulse) {
    const pB = easeOut(inv(0.12, 0.5, prog)), pS = easeOut(inv(0.5, 0.8, prog)), after = inv(0.6, 1, prog);
    const k = R * 0.62;
    const bolt = [[0.22, -1], [-0.44, 0.12], [-0.04, 0.12], [-0.24, 1], [0.46, -0.16], [0.06, -0.16]].map((q) => [cx + q[0] * k, cy + q[1] * k]);
    fil(ctx, (c) => c.arc(cx, cy, R, 0, TAU), "rgb(6,14,28)", 0.9 * pB);
    fil(ctx, polyB(bolt, true), COL.amber, (0.28 - 0.12 * after) * pB);
    stk(ctx, polyB(bolt, true), COL.amber, 3, 0.9, pB * (1 - 0.45 * after));
    stk(ctx, (c) => c.arc(cx, cy, R, 0, TAU), COL.red, 4, 0.9, pB * (0.8 + 0.2 * pulse));
    if (pS > 0) {
      const a = -Math.PI * 0.75, x0 = cx + Math.cos(a) * R, y0 = cy + Math.sin(a) * R, x1 = cx - Math.cos(a) * R, y1 = cy - Math.sin(a) * R;
      const xe = lerp(x0, x1, pS), ye = lerp(y0, y1, pS);
      stk(ctx, (c) => { c.moveTo(x0, y0); c.lineTo(xe, ye); }, "rgb(6,14,28)", 13, 0, 1);
      stk(ctx, (c) => { c.moveTo(x0, y0); c.lineTo(xe, ye); }, COL.red, 5, 1.1, 0.85 + 0.15 * pulse);
      if (pS < 1) dot(ctx, xe, ye, 22, "#ffd2d3", 0.9 * (1 - pS));
    }
  }
  function drawCarousel(ctx, x, y, w, h, phase, phi, prog, pulse) {
    const a0 = easeOut(inv(0, 0.5, prog)); if (a0 <= 0) return;
    const cx = x + w / 2, e = 0.3, top = y + h * 0.02, yC = y + h * 0.19, yB = y + h * 0.97;
    const Rc = w * 0.16, Lc = Math.min(h * 0.42, (w * 0.44 - Rc) / 0.82);
    const sp = Math.sin(phi), cp = Math.cos(phi), n = 8, rS = Math.max(3, w * 0.03);
    const R = Rc + Lc * sp, yS = yC + Lc * cp;
    const seats = [];
    for (let k = 0; k < n; k++) {
      const az = phase + (k * TAU) / n, ca = Math.cos(az), sa = Math.sin(az);
      seats.push({ ax: cx + Rc * ca, ay: yC + Rc * e * sa, sx: cx + R * ca, sy: yS + R * e * sa, front: sa > 0, depth: 0.4 + 0.6 * (0.5 + 0.5 * sa) });
    }
    // Bahn der Sitze + Bodenplatte
    stk(ctx, ellB(cx, yS, R, R * e), COL.amber, 1.3, 0, 0.4 * a0, { dash: [4, 6] });
    stk(ctx, ellB(cx, yB, Rc * 1.6, Rc * 1.6 * e * 0.7), COL.steel, 1.6, 0.3, 0.8 * a0);
    const drawSet = (front) => {
      stk(ctx, (c) => { for (const s of seats) if (s.front === front) { c.moveTo(s.ax, s.ay); c.lineTo(s.sx, s.sy); } }, COL.steel, 1.7, front ? 0.3 : 0, (front ? 0.95 : 0.4) * a0);
      fil(ctx, (c) => { for (const s of seats) if (s.front === front) rr(c, s.sx - rS, s.sy - rS * 0.5, rS * 2, rS * 1.4, rS * 0.4); }, COL.amber, (front ? 1 : 0.5) * a0);
    };
    drawSet(false);
    // Mast + Dach (Kegel mit Lichterkette)
    stk(ctx, (c) => { c.moveTo(cx, top + 6); c.lineTo(cx, yB); }, COL.steel, 3.2, 0.4, 0.95 * a0);
    fil(ctx, (c) => { c.moveTo(cx, top + 4); c.lineTo(cx + Rc, yC); c.ellipse(cx, yC, Rc, Rc * e, 0, 0, Math.PI); c.closePath(); }, COL.cyan, 0.14 * a0);
    stk(ctx, (c) => { c.moveTo(cx - Rc, yC); c.lineTo(cx, top + 4); c.lineTo(cx + Rc, yC); }, COL.cyan, 2, 0.7, a0);
    stk(ctx, ellB(cx, yC, Rc, Rc * e), COL.cyan, 2, 0.7, a0);
    for (let k = 0; k < 10; k++) {
      const az = phase * 1 + (k * TAU) / 10, sa = Math.sin(az);
      const lx = cx + Rc * Math.cos(az), ly = yC + Rc * e * sa, on = 0.5 + 0.5 * Math.sin(k * 1.9 + pulse * 3);
      fil(ctx, (c) => c.arc(lx, ly, 1.8, 0, TAU), k % 2 ? COL.amber : "#ffe3a8", a0 * (sa > 0 ? 0.95 : 0.35) * (0.55 + 0.45 * on));
    }
    fil(ctx, (c) => c.arc(cx, top + 2, 3.2, 0, TAU), COL.white, 0.95 * a0);
    drawSet(true);
    // Fliehkraft-Pfeil am rechten Rand der Sitzbahn
    const fa = a0 * inv(0.12, 0.5, sp) * (0.8 + 0.2 * pulse);
    if (fa > 0.02) {
      const ax = cx + R + rS + 5, len = 10 + 16 * sp;
      stk(ctx, (c) => { c.moveTo(ax, yS); c.lineTo(ax + len - 5, yS); }, "#ffe3a8", 2.2, 0.6, fa);
      arrowHead(ctx, ax + len, yS, 0, 9, "#ffe3a8", fa);
    }
  }
  function drawCard(ctx, L, card, st) {
    const { c, t, pulse } = st, box = card.box; if (!box) return;
    const prog = clamp((t - card.at) / 0.9); if (prog <= 0) return;
    const a = easeOut(inv(0, 0.35, prog)), ys = (1 - a) * 16;
    const { x, y, w, h } = box, row = w / h >= 1.8, pad = row ? 18 : 14, car = card.kind === "analogy";
    const stroke = car ? COL.amber : COL.red;
    let ih, iw;
    if (row) { ih = Math.min(h - 2 * pad, 172); iw = car ? Math.min(ih * 1.1, w * 0.36) : ih; }
    else { ih = Math.min(w - 2 * pad, h * 0.56); iw = ih; }
    const ix = row ? x + pad : x + (w - iw) / 2, iy = row ? y + (h - ih) / 2 : y + pad;
    const tx = row ? ix + iw + 24 : x + w / 2, tw = row ? x + w - pad - tx : w - 2 * pad;
    const tSize = row ? Math.round(clamp(h * 0.18, 19, 38)) : 24;
    const key = "card|" + card.kind + "|" + card.label + "|" + card.sub + "|" + x + "|" + y + "|" + w + "|" + h;
    ctx.save(); ctx.translate(0, ys);
    layer(ctx, key, x - 14, y - 14, w + 28, h + 28, a, (g) => {
      fil(g, (cc) => rr(cc, x, y, w, h, 12), "rgb(4,12,26)", 0.86);
      stk(g, (cc) => rr(cc, x, y, w, h, 12), stroke, 1.5, 0.5, 0.55);
      const T1 = wrapFit(L, g, card.label, tw, tSize, 14, 2, { weight: 700 });
      const sSize = Math.max(14, Math.round(T1.size * 0.64));
      let S1 = card.sub ? wrapFit(L, g, card.sub, tw, sSize, 13, 2, { weight: 500 }) : { lines: [], size: 0 };
      const lh1 = T1.size * 1.12, lh2 = S1.size * 1.25, avail = row ? h - 2 * pad : h - 2 * pad - ih - 10;
      const bh = () => T1.lines.length * lh1 + (S1.lines.length ? 8 + S1.lines.length * S1.size * 1.25 : 0);
      if (bh() > avail && S1.lines.length > 1) S1 = { lines: S1.lines.slice(0, 1), size: S1.size };
      if (bh() > avail) S1 = { lines: [], size: 0 };
      let yy = (row ? y + (h - bh()) / 2 : iy + ih + 10) + T1.size * 0.9;
      for (const l of T1.lines) { txt(L, g, l, tx, yy, { size: T1.size, weight: 700, color: COL.white, align: row ? "left" : "center" }); yy += lh1; }
      yy += 8 - lh1 + S1.size * 1.1;
      for (const l of S1.lines) { txt(L, g, l, tx, yy, { size: S1.size, weight: 500, color: car ? COL.muted : COL.cyan, align: row ? "left" : "center" }); yy += lh2; }
    });
    const sG = GA; GA = sG * a;
    if (!car) drawNoPowerIcon(ctx, ix + iw / 2, iy + ih / 2, ih * 0.42, prog, pulse);
    else drawCarousel(ctx, ix, iy, iw, ih, c.integ(t) * 0.9 + 0.3, lerp(6, 52, clamp(st.alpha / AL_SEAT)) * D2R, prog, pulse);
    GA = sG;
    ctx.restore();
  }

  // ---------- Szene ----------
  function drawScene(ctx, p) {
    const L = p.L || CE.lib, W = p.W || 1920;
    const st = computeState(p);
    const { c, t, T, v, theta, alpha, omega, tauHit, hit, flash, sx, sy, clampP, leverP, dimAfter, pulse, vis, rev } = st;
    GA = 1;

    const tagL = tagLayout(L, ctx, c);
    const fit = layoutFit(p, st.P, c);
    ctx.save();
    if (Math.abs(fit.k - 1) > 1e-4) { ctx.translate(fit.fx, fit.fy); ctx.scale(fit.k, fit.k); ctx.translate(-fit.fx, -fit.fy); }

    // --- Staub (immer in Bewegung; in 4 Gruppen gebündelt) ---
    ctx.save();
    for (let grp = 0; grp < 4; grp++) {
      ctx.globalAlpha = 0.2 + 0.14 * Math.sin(T * 1.3 + grp * 1.7);
      ctx.fillStyle = grp === 3 ? COL.amber : COL.cyan;
      ctx.beginPath();
      for (let i = grp; i < 28; i += 4) {
        const x = 100 + ((h01(i * 3.1) * 1720 + T * 6 * (0.4 + h01(i + 9))) % 1720);
        const y = 110 + ((h01(i * 7.7) * 800 - T * 9 * (0.3 + h01(i * 2.3)) + 8000) % 800);
        const r = 1.3 + 1.4 * h01(i * 1.9);
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
      }
      ctx.fill();
    }
    ctx.restore();

    // ================= Mechanik (mit Stoß-Wackeln) =================
    ctx.save(); ctx.translate(sx, sy);
    GA = easeOut(t / c.tIn);

    // Boden Triebwerksraum, Lagerbock, Seil im Schacht (statisch, gecacht)
    ctx.save(); ctx.translate(-sx, -sy);
    const ropeEnd = c.showLever ? INS.y : 884;
    layer(ctx, "floor|" + (c.showLever ? 1 : 0), 90, 440, 860, 456, 1, (g) => {
      stk(g, (cc) => { cc.moveTo(100, FLOOR_Y); cc.lineTo(XL - 14, FLOOR_Y); cc.moveTo(XL + 14, FLOOR_Y); cc.lineTo(XR - 14, FLOOR_Y); cc.moveTo(XR + 14, FLOOR_Y); cc.lineTo(935, FLOOR_Y); }, COL.steel, 2, 0.4, 0.7);
      stk(g, (cc) => { for (let x = 104; x < 935; x += 16) { if (Math.abs(x - XL) < 22 || Math.abs(x - XR) < 22) continue; cc.moveTo(x, FLOOR_Y + 14); cc.lineTo(x + 12, FLOOR_Y + 2); } }, COL.steel, 1.2, 0, 0.35);
      txt(L, g, "TRIEBWERKSRAUM", 104, FLOOR_Y - 12, { font: L.FONT.mono, size: 15, weight: 700, color: COL.muted, letterSpacing: 2, alpha: 0.75 });
      txt(L, g, "SCHACHT", 104, FLOOR_Y + 40, { font: L.FONT.mono, size: 15, weight: 700, color: COL.muted, letterSpacing: 2, alpha: 0.6 });
      const ped = [[CX - 46, CY - 10], [CX + 46, CY - 10], [CX + 150, FLOOR_Y - 12], [CX - 150, FLOOR_Y - 12]];
      fil(g, polyB(ped, true), COL.steel, 0.05);
      stk(g, polyB(ped, true), COL.steel, 1.6, 0.3, 0.45);
      stk(g, (cc) => rr(cc, CX - 170, FLOOR_Y - 12, 340, 12, 2), COL.steel, 1.6, 0.3, 0.6);
      stk(g, (cc) => { cc.moveTo(XL, FLOOR_Y + 4); cc.lineTo(XL, 880); }, COL.rope, 3, 0.3, 0.45, { dash: [10, 9] });
      stk(g, (cc) => { cc.moveTo(XR, FLOOR_Y + 4); cc.lineTo(XR, ropeEnd); }, COL.rope, 3, 0.3, 0.55, { dash: [10, 9] });
    });
    if (!c.slotL) layer(ctx, "pit", XL - 200, 820, 200, 60, 0.8 * vis(0.1, 0.2), (g) => {
      txt(L, g, "zur Spannrolle", XL - 16, 846, { size: 18, weight: 400, color: COL.muted, align: "right" });
      txt(L, g, "in der Schachtgrube", XL - 16, 870, { size: 18, weight: 400, color: COL.muted, align: "right" });
    });
    if (!c.showLever) layer(ctx, "toCar", XR + 8, 850, 200, 40, 0.8 * vis(0.1, 0.2), (g) => {
      txt(L, g, "zur Kabine", XR + 16, 876, { size: 18, weight: 400, color: COL.muted });
    });
    ctx.restore();

    drawMechCore(ctx, L, st, false);

    // Fliehkraft-Pfeile (wachsen mit v², verschwinden beim Sperren)
    if (!hit) {
      const fa = vis(0.12, 0.2) * (c.tripped ? 1 - inv(c.tT - 0.08, c.tH, t) : 1);
      if (fa > 0.01) {
        const len = 12 + 34 * Math.pow(clamp(v / c.trip, 0, 1.3), 2);
        for (let i = 0; i < 2; i++) {
          const m = toWorld(fwLocal(MASS, alpha), theta + i * Math.PI, 0, 0);
          const dx = m[0] - CX, dy = m[1] - CY, dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl;
          const x1 = m[0] + ux * len, y1 = m[1] + uy * len;
          stk(ctx, (cc) => { cc.moveTo(m[0], m[1]); cc.lineTo(x1 - ux * 6, y1 - uy * 6); }, "#ffe3a8", 2.6, 0.7, fa);
          arrowHead(ctx, x1, y1, Math.atan2(uy, ux), 11, "#ffe3a8", fa);
          fil(ctx, (cc) => cc.arc(m[0], m[1], 3.5, 0, TAU), "#ffe3a8", fa);
        }
      }
    }

    // Laufrichtungs-Pfeile am Kabinenseil (vor dem Sperren)
    if (omega > 0.05) {
      const shift = theta * RR;
      for (let k = 0; k < 3; k++) {
        const ph = ((k * 45 + shift * 0.35) % 135 + 135) % 135; const y = 470 + ph;
        stk(ctx, (cc) => { cc.moveTo(XR + 16, y - 7); cc.lineTo(XR + 23, y); cc.lineTo(XR + 30, y - 7); }, COL.amber, 2.2, 0.5, 0.8 * Math.sin((ph / 135) * Math.PI));
      }
    }

    // --- Seilklemme ---
    {
      const cy0 = 626, gap = lerp(14, 0, clampP), hot = clampP > 0.5;
      const jc = hot ? COL.amber : COL.steel;
      fil(ctx, (cc) => rr(cc, XR - 48, cy0 - 40, 96, 80, 6), "rgb(5,14,30)", 0.6);
      stk(ctx, (cc) => rr(cc, XR - 48, cy0 - 40, 96, 80, 6), COL.steel, 1.6, 0.3, 0.55);
      stk(ctx, (cc) => { cc.moveTo(XR - 40, cy0 + 40); cc.lineTo(XR - 40, FLOOR_Y - 1); cc.moveTo(XR + 40, cy0 + 40); cc.lineTo(XR + 40, FLOOR_Y - 1); }, COL.steel, 1.6, 0.2, 0.45);
      stk(ctx, (cc) => { cc.moveTo(XR, cy0 - 40); cc.lineTo(XR, cy0 + 40); }, COL.rope, 7, 0.4, 0.9);
      fil(ctx, (cc) => { rr(cc, XR + 5, cy0 - 30, 16, 60, 3); rr(cc, XR - 21 - gap, cy0 - 30, 16, 60, 3); }, jc, hot ? 0.35 : 0.15);
      stk(ctx, (cc) => { rr(cc, XR + 5, cy0 - 30, 16, 60, 3); rr(cc, XR - 21 - gap, cy0 - 30, 16, 60, 3); }, jc, 2, hot ? 1 : 0.3, 0.95);
      stk(ctx, springB(XR - 46, cy0, XR - 21 - gap, cy0, 3, 5), jc, 1.4, 0, 0.8);
      if (hot) dot(ctx, XR, cy0, 42, COL.amber, 0.3 + 0.25 * pulse);
      if (clampP > 0 && clampP < 1) dot(ctx, XR, cy0, 70, "#ffe3a8", 0.5 * Math.sin(clampP * Math.PI));
    }

    // --- Kontakt-Glühen, Funken, Stoßwelle ---
    const hooks = [0, 1].map((i) => toWorld(fwLocal(HOOK, alpha), theta + i * Math.PI, sx, sy));
    if (hit) {
      for (let i = 0; i < 2; i++) {
        const hk = hooks[i];
        dot(ctx, hk[0], hk[1], 26 + 60 * flash, flash > 0.3 ? COL.amber : COL.red, 0.5 + 0.4 * flash + 0.2 * pulse);
        if (tauHit < 0.9) {
          L.sparks(ctx, hk[0], hk[1], tauHit, { seed: 11 + i * 7, count: 16, life: 0.5, spread: 2.2, dir: CONTACT + i * Math.PI, speed: 420, gravity: 700, window: 0.06 });
          const rw = 14 + 240 * Math.pow(tauHit, 0.6);
          stk(ctx, (cc) => cc.arc(hk[0], hk[1], rw, 0, TAU), COL.amber, 2.5, 1, 0.8 * Math.exp(-tauHit * 4.5));
        }
      }
    }
    ctx.restore(); // Ende Wackel-Gruppe
    GA = 1;

    // ================= Lupe: Sperrklinke im Sperrzahnkranz =================
    if (hit) {
      const lp = easeOutBack(inv(c.tH + 0.08, c.tH + 0.4, t));
      const la = inv(c.tH + 0.04, c.tH + 0.24, t);
      if (la > 0) {
        const hk = hooks[0], R0 = 62, LX = 1090, LY = 350, LR = 118 * Math.max(0.05, lp), M = 118 / R0;
        const fx = hk[0] + Math.cos(CONTACT) * 4 - Math.sin(CONTACT) * 10, fy = hk[1] + Math.sin(CONTACT) * 4 + Math.cos(CONTACT) * 10; // Blickpunkt leicht zum Zahnkranz hin
        GA = la;
        stk(ctx, (cc) => cc.arc(fx, fy, R0, 0, TAU), COL.red, 1.6, 0, 0.9, { dash: [5, 6], dashOff: -T * 12 });
        const dx = LX - fx, dy = LY - fy, dl = Math.hypot(dx, dy), ux = dx / dl, uy = dy / dl;
        stk(ctx, (cc) => { cc.moveTo(fx + ux * R0, fy + uy * R0); cc.lineTo(LX - ux * LR, LY - uy * LR); }, COL.red, 1.4, 0.4, 0.7);
        const lensContent = (g, stL, lr) => {
          g.save();
          g.beginPath(); g.arc(LX, LY, lr, 0, TAU); g.clip();
          fil(g, (cc) => cc.arc(LX, LY, lr, 0, TAU), "rgb(4,11,24)", 0.97);
          g.translate(LX, LY); g.scale(M, M); g.translate(-fx, -fy);
          const WMs = WM; WM = 0.5;
          drawMechBody(g, L, stL, true, false);
          { // Drehrichtung: Klinkennase drückt gegen die Zahnflanke
            const tx = -Math.sin(CONTACT), ty = Math.cos(CONTACT), nx = -Math.cos(CONTACT), ny = -Math.sin(CONTACT);
            const ax0 = hk[0] - tx * 34 + nx * 16, ay0 = hk[1] - ty * 34 + ny * 16, ax1 = hk[0] - tx * 12 + nx * 16, ay1 = hk[1] - ty * 12 + ny * 16;
            stk(g, (cc) => { cc.moveTo(ax0, ay0); cc.lineTo(ax1, ay1); }, COL.amber, 2.2, 0.6, 0.9);
            arrowHead(g, ax1 + tx * 4, ay1 + ty * 4, Math.atan2(ty, tx), 8, COL.amber, 0.9);
          }
          WM = WMs;
          g.restore();
          stk(g, (cc) => cc.arc(LX, LY, lr, 0, TAU), COL.red, 2.4, 1, 0.95);
        };
        if (lp >= 1 && la >= 1 && st.tauHit > 0.6) {
          layer(ctx, "lens", LX - 136, LY - 136, 272, 272, 1, (g) => lensContent(g, Object.assign({}, st, { theta: THETA_LOCK, alpha: AL_SEAT, omega: 0, T: 0, pulse: 0.5 }), 118));
        } else lensContent(ctx, st, LR);
        dot(ctx, LX + (hk[0] - fx) * M, LY + (hk[1] - fy) * M, 22, COL.red, (0.45 + 0.4 * pulse) * lp);
        GA = 1;
        const tp = inv(c.tH + 0.24, c.tH + 0.56, t);
        if (tp > 0) {
          const s1 = c.lensLabel, lsz = fitSize(L, ctx, s1, 300, 26, 16, { weight: 700 }), tw = meas(L, ctx, s1, { size: lsz, weight: 700 }) + 32;
          layer(ctx, "lensLabel|" + s1 + "|" + lsz, LX - tw / 2 - 10, LY + 122, tw + 20, 64, tp, (g) => {
            fil(g, (cc) => rr(cc, LX - tw / 2, LY + 132, tw, 44, 6), "rgb(4,12,26)", 0.9);
            stk(g, (cc) => rr(cc, LX - tw / 2, LY + 132, tw, 44, 6), COL.red, 1.5, 0.6, 0.8);
            txt(L, g, s1, LX, LY + 154 + lsz * 0.36, { size: lsz, weight: 700, color: COL.white, align: "center" });
          });
          if (c.lensSub) { const ssz = fitSize(L, ctx, c.lensSub, 300, 20, 14, { weight: 600 }); txt(L, ctx, c.lensSub, LX, LY + 202, { size: ssz, weight: 600, color: COL.red, align: "center", alpha: tp * (0.85 + 0.15 * pulse) }); }
        }
      }
    }

    // ================= Kabinen-Detail (Auslösehebel) =================
    if (c.showLever) {
      const A = vis(0.08, 0.16); GA = A;
      if (A > 0) {
        const by0 = 872, bx0 = INS.x + 16, bx1 = INS.x + INS.w - 16;
        layer(ctx, "inset", INS.x - 8, INS.y - 32, INS.w + 16, INS.h + 42, 1, (g) => {
          fil(g, (cc) => rr(cc, INS.x, INS.y, INS.w, INS.h, 10), "rgb(4,12,26)", 0.7);
          stk(g, (cc) => rr(cc, INS.x, INS.y, INS.w, INS.h, 10), COL.cyan, 1.4, 0.3, 0.4);
          txt(L, g, "AN DER KABINE", INS.x + INS.w - 8, INS.y - 10, { font: L.FONT.mono, size: 15, weight: 700, color: COL.muted, letterSpacing: 2, align: "right" });
          stk(g, (cc) => cc.rect(bx0, by0, bx1 - bx0, 12), COL.steel, 1.6, 0.3, 0.8);
          g.save(); g.beginPath(); g.rect(bx0, by0, bx1 - bx0, 12); g.clip();
          stk(g, (cc) => { for (let x = bx0 - 12; x < bx1; x += 10) { cc.moveTo(x, by0 + 12); cc.lineTo(x + 12, by0); } }, COL.steel, 1, 0, 0.45);
          g.restore();
          stk(g, polyB([[LEVER.px - 16, by0], [LEVER.px + 16, by0], [LEVER.px, LEVER.py]], true), COL.steel, 1.8, 0.3, 0.85);
        });
        // Hebel: Drehpunkt rechts, Seil links, Zugstange zur Fangvorrichtung dazwischen
        const beta = Math.asin(clamp((LEVER.rise * leverP) / (LEVER.px - XR), -0.3, 0.3));
        const ptAt = (x) => { const dx = x - LEVER.px; return [LEVER.px + dx * Math.cos(beta), LEVER.py + dx * Math.sin(beta)]; };
        const pA = ptAt(XR), pE = ptAt(XR - 14), pP2 = ptAt(LEVER.px + 16), pR = ptAt(1012);
        const hot = leverP > 0.02, lc = hot ? COL.amber : COL.steel;
        stk(ctx, (cc) => { cc.moveTo(pR[0], pR[1]); cc.lineTo(pR[0], INS.y + INS.h + 2); }, lc, 3, hot ? 0.8 : 0.3, 0.9);
        stk(ctx, (cc) => cc.rect(pR[0] - 8, by0 - 3, 16, 18), COL.steel, 1.4, 0, 0.8);
        if (hot) stk(ctx, (cc) => { cc.moveTo(pR[0], INS.y + INS.h); cc.lineTo(pR[0], pR[1] + 8); }, "#ffe3a8", 2, 0.4, 0.7 * clamp(leverP), { dash: [5, 9], dashOff: T * 40 });
        stk(ctx, (cc) => { cc.moveTo(pE[0], pE[1]); cc.lineTo(pP2[0], pP2[1]); }, lc, 8, hot ? 0.55 : 0.3, 1);
        fil(ctx, (cc) => { cc.arc(LEVER.px, LEVER.py, 5, 0, TAU); cc.moveTo(pR[0] + 4, pR[1]); cc.arc(pR[0], pR[1], 4, 0, TAU); }, COL.white, 0.9);
        stk(ctx, (cc) => { cc.moveTo(XR, INS.y - 2); cc.lineTo(pA[0], pA[1] - 7); }, COL.rope, 5, 0.5, 0.95);
        stk(ctx, (cc) => cc.arc(pA[0], pA[1] - 1, 7, 0, TAU), lc, 2, 0.5, 1);
        if (hot) {
          const ap = easeOut(inv(c.tLev + 0.1, c.tLev + 0.45, t));
          const rA = LEVER.px - XR + 30, a0 = Math.PI + 0.02, a1 = Math.PI + 0.02 + 0.13 * ap;
          stk(ctx, (cc) => cc.arc(LEVER.px, LEVER.py, rA, a0, a1), COL.amber, 4, 1, ap);
          arrowHead(ctx, LEVER.px + rA * Math.cos(a1), LEVER.py + rA * Math.sin(a1) - 4, -Math.PI / 2, 16, COL.amber, ap);
          const lp = inv(c.tLev + 0.18, c.tLev + 0.58, t);
          const lsz = fitSize(L, ctx, c.leverLabel, INS.x + INS.w - 12 - (XR + 26), 25, 15, { weight: 700 });
          txt(L, ctx, c.leverLabel, XR + 26, 812, { size: lsz, weight: 700, color: COL.amber, alpha: lp });
        }
      }
      GA = 1;
    }

    // ================= Beschriftungen =================
    if (tagL.length) {
      const lx = TAG_LX;
      const wL = (pts) => { const w0 = smooth(0.5 + (pts[1][0] - pts[0][0]) / 140); return [[pts[0][0], pts[0][1], w0], [pts[1][0], pts[1][1], 1 - w0]]; };
      for (const q of tagL) {
        const lb = q.lb, pr = rev(lb.at, c.labDur); if (pr <= 0) continue;
        const sz = q.size, tx = q.lines;
        if (lb.id === "spring") {
          const pts = [0, 1].map((i) => { const rot = theta + i * Math.PI; const w1 = toWorld(fwLocal(SPR_FW, alpha), rot, sx, sy), w2 = toWorld(SPR_ANCH, rot, sx, sy); return [(w1[0] + w2[0]) / 2, (w1[1] + w2[1]) / 2]; });
          tag(ctx, L, wL(pts), lx, q.y, tx, pr, { align: "right", alpha: dimAfter, size: sz });
        } else if (lb.id === "weights") {
          tag(ctx, L, wL([0, 1].map((i) => toWorld(fwLocal(MASS, alpha), theta + i * Math.PI, sx, sy))), lx, q.y, tx, pr, { align: "right", color: COL.amber, alpha: dimAfter, size: sz });
        } else if (lb.id === "pawl") {
          tag(ctx, L, wL(hooks), lx, q.y, tx, pr, { align: "right", color: hit ? COL.red : COL.amber, alpha: hit ? 1 : dimAfter, size: sz });
        } else if (lb.id === "ring") {
          const rp = toWorld(pc((R_TT + R_TB) / 2 + 2, 160), 0);
          tag(ctx, L, [[rp[0], rp[1]]], lx, q.y, tx, pr, { align: "right", color: COL.steel, alpha: dimAfter, size: sz });
        } else if (lb.id === "rope") {
          tag(ctx, L, [[XL, 604]], lx, q.y, tx, pr, { align: "right", color: COL.steel, alpha: dimAfter, size: sz });
        } else if (lb.id === "clamp") {
          const hotC = clampP > 0.5 && !!q.hotLines;
          tag(ctx, L, [[XR + 22, 626]], 930, 626, hotC ? q.hotLines : tx, pr, { color: hotC ? COL.amber : COL.steel, alpha: hotC ? 1 : dimAfter * 0.9, size: hotC ? q.hotSize : sz });
        }
      }
    }

    // ================= Tacho + Schalter + Karten =================
    drawGauge(ctx, L, st, vis(0, 0.08));
    if (c.showSwitch) drawSwitch(ctx, L, c, t, T, vis(0.05, 0.13), st.swOpen, st.swHot, pulse);
    for (const card of c.cards) drawCard(ctx, L, card, st);

    // ================= Auslöse-Blitz =================
    if (flash > 0.01) {
      ctx.save(); ctx.globalAlpha = 0.13 * flash; ctx.fillStyle = "#ffc978"; ctx.fillRect(-600, -600, W + 1200, 2280); ctx.restore();
      for (const hk of hooks) dot(ctx, hk[0], hk[1], 150 * (0.6 + flash), "#ffe3a8", 0.55 * flash);
    }
    ctx.restore(); // Ende Layout-Anpassung
    GA = 1;
  }

  // ---------- Tacho ----------
  const gAng = (val) => Math.PI + clamp(val / GAU.vmax) * Math.PI;
  function drawGaugeStatic(ctx, L, c) {
    const { x, y, r, vmax } = GAU, ang = gAng;
    txt(L, ctx, "FAHRGESCHWINDIGKEIT", x, y - r - 52, { font: L.FONT.head, size: 24, weight: 700, color: COL.muted, align: "center", letterSpacing: 4 });
    stk(ctx, (cc) => cc.arc(x, y, r - 8, Math.PI, TAU), COL.cyan, 26, 0, 0.07, { cap: "butt" });
    if (c.showSwitch) {
      stk(ctx, (cc) => cc.arc(x, y, r + 16, ang(0), ang(c.sw)), COL.cyan, 3, 0, 0.35, { cap: "butt" });
      stk(ctx, (cc) => cc.arc(x, y, r + 16, ang(c.sw), ang(c.trip)), COL.amber, 5, 0.6, 0.9, { cap: "butt" });
    } else stk(ctx, (cc) => cc.arc(x, y, r + 16, ang(0), ang(c.trip)), COL.cyan, 3, 0, 0.35, { cap: "butt" });
    stk(ctx, (cc) => { for (let s = 0; s <= vmax; s += 5) { if (s % 10 === 0) continue; const a = ang(s); cc.moveTo(x + Math.cos(a) * (r - 2), y + Math.sin(a) * (r - 2)); cc.lineTo(x + Math.cos(a) * (r - 10), y + Math.sin(a) * (r - 10)); } }, COL.muted, 1.4, 0, 0.55);
    stk(ctx, (cc) => { for (let s = 0; s <= vmax; s += 10) { const a = ang(s), l = s % 50 === 0 ? 26 : 15; cc.moveTo(x + Math.cos(a) * (r - 2), y + Math.sin(a) * (r - 2)); cc.lineTo(x + Math.cos(a) * (r - l), y + Math.sin(a) * (r - l)); } }, COL.muted, 2.2, 0.2, 0.85);
    for (const s of [0, 50, 100, 150]) { const a = ang(s); txt(L, ctx, String(s), x + Math.cos(a) * (r - 52), y + Math.sin(a) * (r - 52) + 8, { font: L.FONT.mono, size: 22, weight: 700, color: s === 100 ? COL.white : COL.muted, align: "center" }); }
    if (c.showSwitch) { const a = ang(c.sw); stk(ctx, (cc) => { cc.moveTo(x + Math.cos(a) * (r - 22), y + Math.sin(a) * (r - 22)); cc.lineTo(x + Math.cos(a) * (r + 24), y + Math.sin(a) * (r + 24)); }, COL.amber, 3, 0.8, 1); }
    { const a = ang(c.trip); stk(ctx, (cc) => { cc.moveTo(x + Math.cos(a) * (r - 28), y + Math.sin(a) * (r - 28)); cc.lineTo(x + Math.cos(a) * (r + 34), y + Math.sin(a) * (r + 34)); }, COL.red, 4, 1, 1); }
    let sub = c.showReadout ? "der Nenngeschwindigkeit" : "in % der Nenngeschwindigkeit";
    if (Number.isFinite(c.rated) && c.rated > 0) sub += ` (${fmtDec(c.rated, c.rated < 10 ? 1 : 0)} m/s)`;
    txt(L, ctx, sub, x, c.showReadout ? y + 120 : y + 62, { size: 21, weight: 400, color: COL.muted, align: "center" });
  }
  function drawTripLabel(ctx, L, c) {
    const { x, y, r } = GAU, a = gAng(c.trip);
    const lx = x + Math.cos(a) * (r + 46), ly = y + Math.sin(a) * (r + 46);
    txt(L, ctx, fmtPct(c.trip), lx, ly - 2, { font: L.FONT.mono, size: 24, weight: 700, color: COL.red });
    txt(L, ctx, "Auslösung", lx, ly + 22, { size: 17, weight: 600, color: COL.red, alpha: 0.85 });
  }
  const GC = { map: new Map(), x0: GAU.x - 310, y0: GAU.y - GAU.r - 96, w: 620, h: GAU.r + 234 };
  function gaugeCache(L, c) {
    const key = c.trip + "|" + c.sw + "|" + c.rated + "|" + c.showSwitch + "|" + c.showReadout;
    if (GC.map.has(key)) return GC.map.get(key);
    let out = null;
    try {
      const cv = document.createElement("canvas"); cv.width = GC.w; cv.height = GC.h;
      const g = cv.getContext("2d");
      if (g) { const sG = GA, sW = WM; GA = 1; WM = 1; g.translate(-GC.x0, -GC.y0); drawGaugeStatic(g, L, c); GA = sG; WM = sW; out = cv; }
    } catch (e) { out = null; }
    if (GC.map.size > 8) GC.map.clear();
    GC.map.set(key, out);
    return out;
  }

  function drawGauge(ctx, L, st, A) {
    if (A <= 0) return;
    const { c, v, t, T, hit, pulse } = st;
    GA = A;
    const { x, y, r, vmax } = GAU, ang = gAng;
    const swOn = c.showSwitch;
    const zc = (val) => (val >= c.trip - 1e-6 ? COL.red : swOn && val >= c.sw - 1e-6 ? COL.amber : COL.cyan);
    const cache = gaugeCache(L, c);
    if (cache) { ctx.save(); ctx.globalAlpha = GA; ctx.drawImage(cache, GC.x0, GC.y0); ctx.restore(); }
    else drawGaugeStatic(ctx, L, c);
    const tla = c.tTripLbl < 0 ? 1 : easeOut(inv(c.tTripLbl, c.tTripLbl + 0.45, t));
    if (tla > 0) layer(ctx, "tripLbl|" + c.trip, GAU.x + 150, GAU.y - GAU.r - 40, 150, 110, tla, (g) => drawTripLabel(g, L, c));
    stk(ctx, (cc) => cc.arc(x, y, r + 16, ang(c.trip), ang(vmax)), COL.red, 6, 0.8, 0.75 + 0.25 * pulse, { cap: "butt" });
    // Wertbogen
    const segs = swOn ? [[0, Math.min(v, c.sw), COL.cyan], [c.sw, Math.min(v, c.trip), COL.amber], [c.trip, v, COL.red]] : [[0, Math.min(v, c.trip), COL.cyan], [c.trip, v, COL.red]];
    for (const [a0, a1, col] of segs) if (a1 > a0 + 0.05) stk(ctx, (cc) => cc.arc(x, y, r - 8, ang(a0), ang(a1)), col, 9, 0.8, 0.95, { cap: "butt" });
    // Schleppzeiger (Maximalwert)
    if (hit && c.showPeak) {
      const pk = c.peak, a = ang(pk);
      stk(ctx, (cc) => { cc.moveTo(x + Math.cos(a) * (r - 90), y + Math.sin(a) * (r - 90)); cc.lineTo(x + Math.cos(a) * (r - 4), y + Math.sin(a) * (r - 4)); }, COL.red, 2, 0.4, 0.55);
      const tx = x + Math.cos(a) * (r + 3), ty = y + Math.sin(a) * (r + 3);
      arrowHead(ctx, tx, ty, a, 14, COL.red, 0.9);
    }
    // Nadel
    const jitter = v > 1 ? 0.35 * Math.sin(T * 23) + 0.2 * Math.sin(T * 37) : 0;
    const na = ang(v + jitter), nc = zc(v);
    { const ca = Math.cos(na), sa = Math.sin(na), nx = -sa, ny = ca, len = r - 74;
      const needle = polyB([[x - ca * 26 + nx * 5, y - sa * 26 + ny * 5], [x + ca * len, y + sa * len], [x - ca * 26 - nx * 5, y - sa * 26 - ny * 5]], true);
      fil(ctx, needle, nc, 0.9); stk(ctx, needle, nc, 2, 0.9, 1); }
    fil(ctx, (cc) => cc.arc(x, y, 13, 0, TAU), "rgb(4,12,26)", 1);
    stk(ctx, (cc) => cc.arc(x, y, 13, 0, TAU), nc, 3, 0.8, 1);
    // Anzeige
    const stopped = hit && c.carStops && v < 0.5;
    if (c.showReadout) txt(L, ctx, fmtPct(v), x, y + 86, { font: L.FONT.mono, size: 70, weight: 700, color: stopped ? COL.white : nc, align: "center" });
    // Status
    let s = "NORMALBETRIEB", sc = COL.cyan;
    if (hit) { s = stopped ? (c.showPeak ? `GESTOPPT · MAX. ${fmtPct(c.peak)}` : "GESTOPPT") : `AUSGELÖST BEI ${fmtPct(c.trip)}`; sc = COL.red; }
    else if (swOn && t >= c.tSw) { s = "SCHALTER OFFEN"; sc = COL.amber; }
    else if (v > 103) { s = "GESCHWINDIGKEIT STEIGT"; sc = COL.amber; }
    const cy = c.showReadout ? y + 140 : y + 88;
    const sw = meas(L, ctx, s, { font: L.FONT.mono, size: 18, weight: 700, letterSpacing: 2 }) + 34;
    const sa = sc === COL.red ? 0.75 + 0.25 * pulse : 1;
    layer(ctx, "chip|" + s + "|" + sc + "|" + cy, x - sw / 2 - 12, cy - 12, sw + 24, 58, sa, (g) => {
      fil(g, (cc) => rr(cc, x - sw / 2, cy, sw, 34, 17), sc, 0.12);
      stk(g, (cc) => rr(cc, x - sw / 2, cy, sw, 34, 17), sc, 1.5, 0.5, 0.8);
      txt(L, g, s, x + 1, cy + 23, { font: L.FONT.mono, size: 18, weight: 700, color: sc, align: "center", letterSpacing: 2 });
    });
    GA = 1;
  }

  // ---------- Übergeschwindigkeitsschalter ----------
  function drawSwitch(ctx, L, c, t, T, A, open, hot, pulse) {
    if (A <= 0) return;
    GA = A;
    const { x, y, w, h } = PAN;
    const y0 = y + 124, ax = x + 110, bx = x + 200, mx = x + 300;
    // statischer Teil (Rahmen, Titel, Leitungen, Kontakte, Motorsymbol, Fußzeile) als Sprite je Zustand
    layer(ctx, "panel|" + (hot ? 1 : 0) + "|" + c.sw + "|" + c.showSwPct, x - 12, y - 12, w + 24, h + 24, 1, (g) => {
      fil(g, (cc) => rr(cc, x, y, w, h, 12), "rgb(4,12,26)", 0.84);
      stk(g, (cc) => rr(cc, x, y, w, h, 12), hot ? COL.amber : COL.cyan, 1.5, 0.5, hot ? 0.7 : 0.35);
      txt(L, g, "ÜBERGESCHWINDIGKEITSSCHALTER", x + 24, y + 40, { font: L.FONT.head, size: 22, weight: 700, color: COL.white, letterSpacing: 1.5 });
      txt(L, g, c.showSwPct ? `öffnet bei ${fmtPct(c.sw)} – vor der mechanischen Auslösung` : "öffnet vor der mechanischen Auslösung", x + 24, y + 68, { size: 18, weight: 400, color: COL.muted });
      stk(g, (cc) => { cc.moveTo(x + 30, y0); cc.lineTo(ax - 6, y0); cc.moveTo(bx + 6, y0); cc.lineTo(mx - 30, y0); cc.moveTo(mx + 30, y0); cc.lineTo(mx + 58, y0); }, hot ? COL.muted : COL.cyan, 2.4, hot ? 0 : 0.6, hot ? 0.45 : 0.9);
      stk(g, (cc) => { cc.arc(ax, y0, 6, 0, TAU); cc.moveTo(bx + 6, y0); cc.arc(bx, y0, 6, 0, TAU); }, COL.white, 2, 0.4, 0.95);
      const mcol = hot ? COL.red : COL.cyan;
      stk(g, (cc) => cc.arc(mx, y0, 28, 0, TAU), mcol, 2.4, 0.7, hot ? 0.8 : 1);
      txt(L, g, "M", mx, y0 + 9, { size: 26, weight: 800, color: mcol, align: "center" });
      const bottom = hot ? "Sicherheitskreis offen – Bremse fällt ein" : "Sicherheitskreis geschlossen";
      txt(L, g, bottom, x + 24, y + h - 26, { size: 19, weight: hot ? 600 : 400, color: hot ? COL.white : COL.muted, alpha: hot ? 0.95 : 0.8 });
      if (!hot) txt(L, g, "Motor läuft", mx + 76, y0 + 11, { font: L.FONT.head, size: 26, weight: 700, color: COL.muted, alpha: 0.9 });
    });
    if (!hot) {
      stk(ctx, (cc) => { cc.moveTo(x + 30, y0); cc.lineTo(ax - 6, y0); cc.moveTo(bx + 6, y0); cc.lineTo(mx - 30, y0); }, "#bff0ff", 2.4, 0.5, 0.9, { dash: [6, 12], dashOff: -T * 70 });
    }
    const ba = -open * 32 * D2R, bl = bx - ax - 4;
    const tipX = ax + Math.cos(ba) * bl, tipY = y0 + Math.sin(ba) * bl;
    stk(ctx, (cc) => { cc.moveTo(ax, y0); cc.lineTo(tipX, tipY); }, hot ? COL.red : COL.cyan, 3.4, 0.9, 1);
    if (hot) {
      const tau = t - c.tSw; const sp = Math.exp(-tau * 5);
      dot(ctx, bx, y0, 26 + 30 * sp, COL.amber, 0.25 + 0.6 * sp);
    }
    // Motor: dreht (Bogen) oder „Motor aus“
    if (!hot) { const spin = T * 7; stk(ctx, (cc) => cc.arc(mx, y0, 36, spin, spin + 1.1), COL.cyan, 2, 0.5, 0.8); }
    else txt(L, ctx, "Motor aus", mx + 76, y0 + 11, { font: L.FONT.head, size: 32, weight: 700, color: COL.red, alpha: 0.8 + 0.2 * pulse });
    GA = 1;
  }

  const DEF = {
    ownsText: false,
    lastError: null, // nur zur Diagnose: letzte abgefangene Ausnahme
    draw(ctx, p) {
      const m = ctx.getTransform();
      ctx.save();
      try { drawScene(ctx, p || {}); }
      catch (e) { DEF.lastError = String((e && e.message) || e); }
      ctx.restore();
      ctx.setTransform(m); ctx.globalAlpha = 1; ctx.setLineDash([]); ctx.shadowBlur = 0;
      GA = 1; WM = 1;
    },
  };
  CE.register("governor", DEF);
})();
