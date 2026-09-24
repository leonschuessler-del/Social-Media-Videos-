/* Template "ucmp" – Schutz gegen unbeabsichtigte Bewegung des Fahrkorbs (UCM-Schutz, EN 81-20 Abschn. 5.6.7).
   Seitlicher Röntgen-Schnitt durch Haltestelle und Schacht: links die Haltestelle (Geschossdecke im Schnitt,
   Person als Profil-Silhouette tritt an die Schwelle), Schachtwand mit Türöffnung, Fahrkorb mit Fahrkorbtür,
   Schürze, Tragrahmen, Führungsschiene, Türzonen-Sensor (Gabelsensor) mit Schaltfahne ±Türzone, Tragseile,
   Gegengewicht, Stoppelement (Seilbremse | Bremse am Antrieb | Fangvorrichtung), rechts Lineal ab Haltestelle.
   Türstellung: Chip „Türen offen" mit Frontansichts-Symbol (im Seitenschnitt liegen geöffnete Schiebetürblätter
   hinter der Schnittebene und sind nur gestrichelt angedeutet).

   BEATS (params.beats, Sekunden ab Szenenstart; fehlende Einträge = Default, skaliert mit d):
     [0] = Türen offen: Chip + Person tritt an die Schwelle
     [1] = Kabine setzt sich ungewollt in Bewegung (roter Spalt, Pfeile, Status „Kabine fährt los", Warnrahmen)
     [2] = Überwachung erkennt: Sensor verlässt die Türzone (Kabine ist genau hier ±zone_m) + Sensor-Callout
     [3] = Stoppelement greift (Signal läuft [2]→[3]) + Element-Callout
     [4] = Kabine steht (Stopp-Marke am Lineal, Status „Kabine steht")
     [5] = Grenze auf dem Lineal (max_distance_m) + ruler_label-Klammer
     phase "movement" nutzt nur [0],[1]; "idle" nur [0]; "stopped" zeigt alles nach kurzer Staffel.
   "at" (Sekunden) akzeptieren: location_tag.at, labels[].at

   Params (alle optional):
     phase          "detect_and_stop" (Default) | "movement" (Kabine driftet, kein Schutz) | "idle" | "stopped"
     direction      "down" (Default) | "up"
     doors          "open" (Default) | "closed"
     element        "rope_brake" (Default, bei movement "none") | "brake" | "safety_gear" | "none"
     max_distance_m 1.2  Grenze Anhalteweg ab Haltestelle (≥ zone_m+0,3)   stop_distance_m 0.5  tatsächlicher Stopp (< max)
     zone_m         0.2  halbe Türzone (Entriegelungszone)      drift_m 0.7  Weg bis Szenenende bei movement (Kabine hält nicht)
     protection     bool (Default: an außer bei movement) – Sensor + Stoppelement zeichnen
     ruler          bool (Default an bei detect_and_stop/stopped)   person bool (Default true)
     warning_frame  bool (Default true bei movement) – amber blinkender Rahmen um die Gefahrenstelle
     ruler_label    "Anhalteweg begrenzt"   limit_label auto "max. 1,20 m" (entfällt, wenn ruler_label die Zahl enthält)
     zone_label     auto "Türzone ±0,20 m"  door_label "Türen offen"  hazard_label "Kabine fährt los"
     (hazard_label "" = kein roter Status; grüner stop_label blendet dann ab [4] ein. Mit beiden: alt aus, dann neu ein)
     stop_label     "Kabine steht"          sensor_label "Überwachung"  sensor_sub "Türzone verlassen"
     element_label / element_sub (auto je Element)   landing_label "Haltestelle"   show_stop_value bool (false)
     location_tag   "Text" | { text, side:"left"|"right", connected:false, at }
     labels         [{ text, sub?, target:"car"|"door"|"sensor"|"element"|"person"|"counterweight"|"gap", at, color?, x?, y? }] */
(function () {
  "use strict";
  const CE = window.CE;
  if (!CE || typeof CE.register !== "function") return;

  const TAU = Math.PI * 2;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const inv = (a, b, x) => clamp((x - a) / ((b - a) || 1e-6));
  const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const easeOutBack = (t) => { t = clamp(t); const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const num = (v, d) => { if (typeof v === "number" && isFinite(v)) return v; if (typeof v === "string") { const m = v.replace(",", ".").match(/[-+]?\d*\.?\d+/); if (m) { const n = parseFloat(m[0]); if (isFinite(n)) return n; } } return d; };
  const str = (v, d) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : d);
  const bool = (v, d) => (v === true || v === false ? v : v === "true" || v === 1 ? true : v === "false" || v === 0 ? false : d);
  const fmtM = (m) => (Math.round(m * 100) / 100).toFixed(2).replace(".", ",");

  const COL = { cyan: "#3fd2ff", amber: "#ffb347", red: "#ff5a5f", white: "#eef6ff", muted: "#8fb3d9", steel: "#9fc4e6", rope: "#d4ebff", green: "#5be49b", navy: "#081830" };
  const RGB = {};
  const rgb = (hex) => { let c = RGB[hex]; if (!c) { const n = parseInt(hex.slice(1), 16); c = RGB[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; } return c; };
  const rgba = (hex, a) => { const c = rgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  const mix = (h1, h2, t) => { const a = rgb(h1), b = rgb(h2); t = clamp(t); return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`; };
  const FONT = { head: "Oxanium", body: "Inter", mono: "JetBrains Mono" };

  // ---------- Layout (px); Maßstab 165 px = 1 m ----------
  const S = 165;
  const M = (m) => m * S;
  let Y0 = 640;                   // Fußbodenoberkante Haltestelle = Schwellenhöhe (abwärts 640, aufwärts 705)
  let LINTEL = Y0 - M(2.1);       // Türsturz, lichte Türhöhe 2,10 m
  let CW_TOP = Y0 - M(1.62);      // Gegengewicht (Oberkante in Ruhe)
  const SLAB = M(0.3);            // Geschossdecke 0,30 m
  const XW = 915, WALL = 30;      // Schachtwand innen (Schwellenkante), Wanddicke 0,18 m
  const CX0 = 921, CX1 = 1168;    // Fahrkorb vorn (Türseite) / hinten, Tiefe 1,50 m
  const CH = M(2.2), DOOR_H = M(2.1); // lichte Kabinenhöhe, Fahrkorbtür
  const XR = 1045;                // Führungsschiene = Seilachse (Mitte Kabinentiefe)
  const CWX0 = 1185, CWX1 = 1222, CWXC = (CWX0 + CWX1) / 2, CW_H = 240;
  const XBW = 1238;               // Schachtrückwand innen
  const RX = 1320;                // Lineal
  const SNX = 1116, SNDY = M(0.22); // Türzonen-Sensor: x, Abstand unter Fahrkorbboden
  const RB_Y = 122;               // Seilbremse (Mitte)
  const SH_X = (XR + CWXC) / 2, SH_Y = 116, SH_R = (CWXC - XR) / 2; // Treibscheibe (Variante "brake")
  const HIPX = 806;               // Person (Hüfte)
  const wfRect = () => { const y = LINTEL - 14, b = Math.min(Y0 + M(1.15), 860); return { x: 636, y, w: CX1 + 34 - 636, h: b - y }; }; // Warnrahmen
  const STAT = { x: 1320, y: 330 }, ELAB = { x: 1320, y: 212 }, SLAB_POS = { x: 866, y: 830 };
  const chipPos = () => ({ x: XW - WALL - 12, y: Math.max(236, LINTEL - 58) });
  function setGeom(dir) { Y0 = dir < 0 ? 705 : 640; LINTEL = Y0 - M(2.1); CW_TOP = Y0 - M(1.62); }

  // ---------- Zeichen-Helfer (Gruppen-Alpha GA) ----------
  let GA = 1;
  function stroke(ctx, build, color, w, alpha, dash, off) {
    const a = GA * (alpha == null ? 1 : alpha); if (a <= 0.004) return;
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (dash) { ctx.setLineDash(dash); ctx.lineDashOffset = off || 0; }
    ctx.beginPath(); build(ctx); ctx.stroke(); ctx.restore();
  }
  function glow(ctx, build, color, w, alpha, g, dash, off) {
    const a = GA * (alpha == null ? 1 : alpha); if (a <= 0.004) return; g = g == null ? 1 : g;
    ctx.save(); ctx.strokeStyle = color; ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (dash) { ctx.setLineDash(dash); ctx.lineDashOffset = off || 0; }
    ctx.beginPath(); build(ctx);
    if (g > 0) { ctx.globalAlpha = a * 0.09 * g; ctx.lineWidth = w * 6.5; ctx.stroke(); ctx.globalAlpha = a * 0.2 * g; ctx.lineWidth = w * 3; ctx.stroke(); }
    ctx.globalAlpha = a; ctx.lineWidth = w; ctx.stroke(); ctx.restore();
  }
  function fill(ctx, build, color, alpha) { const a = GA * (alpha == null ? 1 : alpha); if (a <= 0.004) return; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = color; ctx.beginPath(); build(ctx); ctx.fill(); ctx.restore(); }
  const rectB = (x, y, w, h) => (c) => c.rect(x, y, w, h);
  const lineB = (x1, y1, x2, y2) => (c) => { c.moveTo(x1, y1); c.lineTo(x2, y2); };
  const polyB = (pts, close) => (c) => { pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); if (close) c.closePath(); };
  const rr = (c, x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  const GLOWS = {};
  function glowImg(color) {
    if (GLOWS[color] !== undefined) return GLOWS[color];
    let cv = null;
    try { cv = document.createElement("canvas"); cv.width = cv.height = 128; const g = cv.getContext("2d"); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, rgba(color, 0.95)); gr.addColorStop(0.3, rgba(color, 0.38)); gr.addColorStop(1, rgba(color, 0)); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); } catch (e) { cv = null; }
    GLOWS[color] = cv; return cv;
  }
  function dot(ctx, x, y, r, color, alpha) {
    const a = GA * alpha; if (a <= 0.004 || r <= 0.5) return; const img = glowImg(color); if (!img) return;
    ctx.save(); ctx.globalAlpha = Math.min(1, a); ctx.drawImage(img, x - r, y - r, 2 * r, 2 * r); ctx.restore();
  }
  function txt(ctx, s, x, y, o) {
    const a = GA * (o.alpha == null ? 1 : o.alpha); if (a <= 0.004 || !s) return;
    ctx.save(); ctx.globalAlpha = Math.min(1, a); ctx.font = `${o.weight || 600} ${o.size || 26}px "${o.font || FONT.body}"`;
    ctx.textAlign = o.align || "left"; ctx.textBaseline = o.baseline || "alphabetic";
    if (o.ls) ctx.letterSpacing = o.ls + "px";
    if (o.glow) { ctx.shadowColor = o.glowColor || o.color || COL.cyan; ctx.shadowBlur = o.glow; }
    ctx.fillStyle = o.color || COL.white; ctx.fillText(s, x, y); ctx.restore();
  }
  function meas(ctx, s, size, weight, font, ls) { ctx.save(); ctx.font = `${weight || 600} ${size || 26}px "${font || FONT.body}"`; if (ls) ctx.letterSpacing = ls + "px"; const w = ctx.measureText(s).width; ctx.restore(); return w; }
  function wrap(ctx, s, maxW, size, weight, font, maxLines) {
    const words = String(s).split(/\s+/).filter(Boolean); const out = []; let cur = "";
    for (const w of words) { const test = cur ? cur + " " + w : w; if (cur && meas(ctx, test, size, weight, font) > maxW) { out.push(cur); cur = w; } else cur = test; }
    if (cur) out.push(cur); return out.slice(0, maxLines || 3);
  }
  function arrowHead(ctx, x, y, ang, size, color, alpha) {
    fill(ctx, (c) => { c.moveTo(x, y); c.lineTo(x - Math.cos(ang - 0.45) * size, y - Math.sin(ang - 0.45) * size); c.lineTo(x - Math.cos(ang + 0.45) * size, y - Math.sin(ang + 0.45) * size); c.closePath(); }, color, alpha);
  }
  function springB(x1, y1, x2, y2, coils, amp) {
    return (c) => {
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux, n = coils * 2;
      c.moveTo(x1, y1);
      for (let k = 1; k < n; k++) { const s = len * (k / n), sd = k % 2 ? 1 : -1; c.lineTo(x1 + ux * s + nx * amp * sd, y1 + uy * s + ny * amp * sd); }
      c.lineTo(x2, y2);
    };
  }

  // ---------- Statische Ebene (Bau: Decke, Wände, Schiene) – einmal gerendert ----------
  const STATIC = {};
  function buildStatic() {
    let c;
    try { c = document.createElement("canvas"); c.width = 1920; c.height = 1080; } catch (e) { return null; }
    const g = c.getContext("2d"); if (!g) return null;
    const pc = document.createElement("canvas"); pc.width = pc.height = 16; const pg = pc.getContext("2d");
    pg.strokeStyle = "rgba(63,210,255,0.20)"; pg.lineWidth = 1.2; pg.beginPath();
    for (let k = -16; k <= 16; k += 8) { pg.moveTo(k, 16); pg.lineTo(k + 16, 0); } pg.stroke();
    const pat = g.createPattern(pc, "repeat");
    const conc = (x, y, w, h, seed) => {
      g.fillStyle = "rgba(14,44,78,0.55)"; g.fillRect(x, y, w, h);
      if (pat) { g.fillStyle = pat; g.fillRect(x, y, w, h); }
      g.fillStyle = "rgba(143,179,217,0.28)";
      const n = Math.floor((w * h) / 900);
      for (let i = 0; i < n; i++) { const hx = x + ((Math.sin((i + seed) * 12.9898) * 43758.5453) % 1 + 1) % 1 * w, hy = y + ((Math.sin((i + seed) * 78.233) * 12345.678) % 1 + 1) % 1 * h; g.beginPath(); g.arc(hx, hy, 1.2 + ((i * 7) % 3) * 0.6, 0, TAU); g.fill(); }
    };
    GA = 1;
    // Geschossdecke Haltestelle
    conc(40, Y0, XW - 40, SLAB, 1);
    glow(g, lineB(40, Y0, XW, Y0), COL.cyan, 2.6, 0.95, 0.9);
    stroke(g, lineB(40, Y0 + SLAB, XW - WALL, Y0 + SLAB), COL.cyan, 1.5, 0.45);
    // Schachtwand vorn: über dem Sturz, unter der Decke
    conc(XW - WALL, -10, WALL, LINTEL + 10, 2);
    stroke(g, lineB(XW - WALL, -10, XW - WALL, LINTEL), COL.cyan, 1.5, 0.5);
    glow(g, lineB(XW, -10, XW, LINTEL), COL.cyan, 2, 0.75, 0.5);
    glow(g, lineB(XW - WALL, LINTEL, XW, LINTEL), COL.cyan, 2.4, 0.9, 0.8);
    const lowL = Y0 + M(3.0) - M(2.1); // Sturz der Schachttür darunter
    conc(XW - WALL, Y0 + SLAB, WALL, lowL - Y0 - SLAB, 3);
    stroke(g, lineB(XW - WALL, Y0 + SLAB, XW - WALL, lowL), COL.cyan, 1.5, 0.45);
    glow(g, lineB(XW, Y0, XW, lowL), COL.cyan, 2, 0.75, 0.5);
    glow(g, lineB(XW - WALL, lowL, XW, lowL), COL.cyan, 2, 0.7, 0.5);
    g.fillStyle = "rgba(63,210,255,0.22)"; g.fillRect(XW - 21, lowL, 12, 1080 - lowL); // geschlossene Schachttür unten
    stroke(g, rectB(XW - 21, lowL, 12, 1080 - lowL), COL.cyan, 1.2, 0.6);
    // Schachtrückwand
    conc(XBW, -10, 30, 1100, 4);
    glow(g, lineB(XBW, -10, XBW, 1090), COL.cyan, 2, 0.75, 0.5);
    stroke(g, lineB(XBW + 30, -10, XBW + 30, 1090), COL.cyan, 1.5, 0.4);
    // Führungsschiene (T-Profil, Seitenansicht) mit Konsolen
    g.fillStyle = "rgba(159,196,230,0.10)"; g.fillRect(XR - 5, -10, 10, 1100);
    stroke(g, lineB(XR - 5, -10, XR - 5, 1090), COL.steel, 1.2, 0.45);
    stroke(g, lineB(XR + 5, -10, XR + 5, 1090), COL.steel, 1.2, 0.45);
    stroke(g, lineB(XR, -10, XR, 1090), COL.steel, 1, 0.25);
    for (const by of [Y0 - M(2.7), Y0 + M(1.35)]) { stroke(g, lineB(XR + 5, by, XBW, by), COL.steel, 2, 0.28); stroke(g, lineB(XR + 5, by + 8, XBW, by + 8), COL.steel, 1, 0.2); }
    for (let y = 40; y < 1080; y += 75) stroke(g, lineB(XR - 8, y, XR + 8, y), COL.steel, 1, 0.22);
    // Ausblenden oben / unten / links
    g.globalCompositeOperation = "destination-out";
    let gr = g.createLinearGradient(0, 24, 0, 150); gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 1920, 150);
    gr = g.createLinearGradient(0, 840, 0, 960); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,1)"); g.fillStyle = gr; g.fillRect(0, 840, 1920, 240);
    gr = g.createLinearGradient(40, 0, 380, 0); gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 380, 1080);
    g.globalCompositeOperation = "source-over";
    return c;
  }
  // senkrechte Ausblend-Verläufe für Seile (je Kontext gecacht)
  const GRD = new WeakMap();
  function ropeGrad(ctx, color, y0, y1) {
    let m = GRD.get(ctx); if (!m) { m = {}; GRD.set(ctx, m); }
    const k = color + y0 + "|" + y1; if (m[k]) return m[k];
    const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, rgba(color, 0)); g.addColorStop(1, rgba(color, 1)); return (m[k] = g);
  }

  // ---------- Parameter ----------
  function normPhase(v) {
    const s = String(v || "").toLowerCase();
    if (!s) return "detect_and_stop";
    if (/stopped|result|final|gestoppt|steht|end/.test(s)) return "stopped";
    if (/detect|stop|protect|schutz|full|sequence|ucm|brake|bremse|erkenn/.test(s)) return "detect_and_stop";
    if (/move|drift|creep|bewegung|losfahr|danger|gefahr|unintend|fault|fehler/.test(s)) return "movement";
    if (/idle|stand|rest|open|ruhe|wait/.test(s)) return "idle";
    return "detect_and_stop";
  }
  function normElement(v) {
    const s = String(v == null ? "" : v).toLowerCase();
    if (!s) return null;
    if (/none|kein|off|false|ohne/.test(s)) return "none";
    if (/rope|seil/.test(s)) return "rope_brake";
    if (/fang|safety|gear|keil/.test(s)) return "safety_gear";
    if (/brak|brem|antrieb|machine|drive|sheave|treib/.test(s)) return "brake";
    return "rope_brake";
  }
  const ELEM_TXT = { rope_brake: ["Seilbremse", "greift"], brake: ["Bremse am Antrieb", "fällt ein"], safety_gear: ["Fangvorrichtung", "greift"], none: ["", ""] };
  const TARGETS = ["car", "door", "sensor", "element", "person", "counterweight", "gap"];

  const CFG = new WeakMap();
  function config(P, d) {
    let c = CFG.get(P); if (c && c.d === d) return c;
    const phase = normPhase(P.phase || P.state || P.mode);
    const dirS = String(P.direction || P.dir || "down").toLowerCase();
    const dir = /up|auf|hoch|oben|rauf/.test(dirS) ? -1 : 1; // Bildschirm: +1 = nach unten
    const doorsOpen = !/clos|zu|geschl|shut/.test(String(P.doors || P.door || "open").toLowerCase());
    let element = normElement(P.element ?? P.stopping_element ?? P.stop_element);
    if (!element) element = phase === "movement" ? "none" : "rope_brake";
    const protection = bool(P.protection, element !== "none" || phase !== "movement");
    const zone = clamp(num(P.zone_m ?? P.door_zone_m ?? P.zone, 0.2), 0.05, 0.4);
    const max = clamp(num(P.max_distance_m ?? P.max_distance ?? P.limit_m, 1.2), zone + 0.3, 1.4);
    let stop = num(P.stop_distance_m ?? P.stop_m ?? P.stop_distance, 0.5);
    stop = clamp(stop, zone + 0.08, Math.max(zone + 0.1, max - 0.06));
    const drift = clamp(num(P.drift_m ?? P.drift, 0.7), 0.1, 1.2);
    const detect = phase === "detect_and_stop" || phase === "stopped";
    // Beats
    const lo = 0.3, hi = Math.max(0.35, d - 0.3), cl = (x) => clamp(x, lo, hi), cv = (x, a, b) => Math.max(a, Math.min(b, x));
    let def;
    if (phase === "stopped") def = [0.3, 0.3, 0.45, 0.6, 0.75, 0.95].map((x) => x * cv(d / 5, 0.7, 1.6));
    else if (phase === "movement") { const b0 = cv(0.08 * d, 0.3, 0.8); const b1 = Math.max(b0 + 0.4, 0.3 * d); def = [b0, b1, d + 1, d + 1, d + 1, d + 1]; }
    else if (phase === "idle") def = [cv(0.08 * d, 0.3, 0.8), d + 1, d + 1, d + 1, d + 1, d + 1];
    else {
      const b0 = cv(0.06 * d, 0.3, 0.6), b1 = Math.max(b0 + 0.2, 0.1 * d), b2 = b1 + cv(0.13 * d, 0.5, 2.0), b3 = b2 + cv(0.05 * d, 0.15, 0.5), b4 = b3 + cv(0.12 * d, 0.4, 1.4), b5 = b4 + cv(0.08 * d, 0.25, 1.2);
      def = [b0, b1, b2, b3, b4, b5];
    }
    const ub = Array.isArray(P.beats) ? P.beats : [];
    const B = [];
    for (let i = 0; i < 6; i++) {
      const u = num(ub[i], NaN);
      let b = isFinite(u) ? cl(u) : (def[i] > d ? def[i] : cl(def[i]));
      if (i > 0 && B[i - 1] <= d) { const minGap = i === 2 ? 0.25 : i === 4 ? 0.2 : 0.06; if (b <= d) b = Math.max(b, B[i - 1] + minGap); }
      B.push(b);
    }
    // Kinematik s(t) in m
    let motion;
    if (phase === "idle") motion = () => 0;
    else if (phase === "stopped") motion = () => stop;
    else if (phase === "movement") {
      const t1 = B[1], tE = Math.max(t1 + 0.6, d - 0.25), k = 0.42;
      motion = (t) => { if (t <= t1) return 0; const x = Math.min(1.2, (t - t1) / (tE - t1)); const f = x < k ? (x * x) / (2 * k) : x - k / 2; return drift * f / (1 - k / 2); };
    } else {
      const t1 = B[1], t2 = B[2], t3 = B[3], t4 = B[4];
      const a = (2 * zone) / Math.pow(t2 - t1, 2), s3 = 0.5 * a * Math.pow(t3 - t1, 2), v3 = a * (t3 - t1);
      const s4 = Math.min(Math.max(stop, s3 + 0.04), Math.max(s3 + 0.01, max - 0.04)), T = t4 - t3, D = Math.max(0.005, s4 - s3), m0 = Math.min(v3, (2.8 * D) / T);
      motion = (t) => {
        if (t <= t1) return 0;
        if (t <= t3) return 0.5 * a * Math.pow(t - t1, 2);
        if (t <= t4) { const u = (t - t3) / T; return s3 + (u * u * u - 2 * u * u + u) * T * m0 + (-2 * u * u * u + 3 * u * u) * D; }
        const e = t - t4; return s4 + 0.012 * (1 - Math.cos(e * TAU * 2.4)) * Math.exp(-e * 4.5);
      };
      stop = s4;
    }
    // Texte
    const limitFmt = fmtM(max);
    const rulerLabel = str(P.ruler_label ?? P.distance_label, "Anhalteweg begrenzt");
    let limitLabel = str(P.limit_label, null);
    if (limitLabel == null) limitLabel = rulerLabel.includes(limitFmt) ? "" : `max. ${limitFmt} m`;
    const et = ELEM_TXT[element];
    const loc = P.location_tag ?? P.location;
    let locTag = null;
    if (loc) {
      const o = typeof loc === "string" ? { text: loc } : loc;
      const text = str(o.text ?? o.label, "");
      if (text) locTag = { text, side: /right|rechts/.test(String(o.side || "").toLowerCase()) ? "right" : "left", connected: bool(o.connected, false), at: cl(num(o.at, phase === "movement" ? Math.max(B[1] + 1, 0.62 * d) : 0.5)) };
    }
    const rawL = Array.isArray(P.labels) ? P.labels : Array.isArray(P.callouts) ? P.callouts : [];
    const labels = rawL.map((o, i) => {
      o = typeof o === "string" ? { text: o } : o || {};
      const tg = String(o.target || o.anchor || "").toLowerCase();
      return { text: str(o.text ?? o.label, ""), sub: str(o.sub, ""), target: TARGETS.includes(tg) ? tg : "car", at: cl(num(o.at, 0.6 + i * 0.5)), color: /red|rot/.test(String(o.color)) ? COL.red : /amber|orange|gelb/.test(String(o.color)) ? COL.amber : /green|grün/.test(String(o.color)) ? COL.green : COL.cyan, x: num(o.x, NaN), y: num(o.y, NaN) };
    }).filter((l) => l.text).slice(0, 4);
    c = {
      d, phase, dir, doorsOpen, element, protection, max, zone, stop, drift, detect, B, motion,
      person: bool(P.person ?? P.show_person, true),
      ruler: bool(P.ruler ?? P.show_ruler, detect),
      warn: bool(P.warning_frame ?? P.warning, phase === "movement"),
      showStopVal: bool(P.show_stop_value, false),
      rulerLabel, limitLabel,
      zoneLabel: str(P.zone_label, `Türzone ±${fmtM(zone)} m`),
      doorLabel: str(P.door_label, doorsOpen ? "Türen offen" : "Türen zu"),
      hazardLabel: str(P.hazard_label, "Kabine fährt los"),
      stopLabel: str(P.stop_label, "Kabine steht"),
      sensorLabel: str(P.sensor_label, "Überwachung"), sensorSub: str(P.sensor_sub, "Türzone verlassen"),
      elemLabel: str(P.element_label, et[0]), elemSub: str(P.element_sub, et[1]),
      landingLabel: str(P.landing_label, "Haltestelle"),
      locTag, labels,
    };
    CFG.set(P, c); return c;
  }

  // ---------- Bauteile ----------
  function drawRopesAndCW(ctx, st) {
    const ropeTop = st.element === "brake" ? SH_Y : 30;
    const hitch = st.roof - M(0.27) - 9;
    const moveOff = -st.dy; // Seiltextur läuft mit
    const rg = st.element === "brake" ? COL.rope : ropeGrad(ctx, COL.rope, 30, 160);
    // Gegengewicht (gegenläufig)
    const cwT = CW_TOP - st.dy;
    stroke(ctx, lineB(CWXC, ropeTop, CWXC, cwT), st.element === "brake" ? COL.rope : ropeGrad(ctx, COL.rope, 30, 160), 3, 0.75);
    fill(ctx, rectB(CWX0, cwT, CWX1 - CWX0, CW_H), "rgba(255,179,71,0.07)");
    stroke(ctx, rectB(CWX0, cwT, CWX1 - CWX0, CW_H), COL.amber, 2, 0.85);
    ctx.save(); ctx.globalAlpha = GA * 0.4; ctx.strokeStyle = COL.amber; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let y = cwT + 20; y < cwT + CW_H - 8; y += 20) { ctx.moveTo(CWX0 + 5, y); ctx.lineTo(CWX1 - 5, y); } ctx.stroke(); ctx.restore();
    // Tragseile Fahrkorb
    const ropesB = (c) => { for (let i = -1; i <= 1; i++) { c.moveTo(XR + i * 6, ropeTop); c.lineTo(XR + i * 6, hitch); } };
    glow(ctx, ropesB, rg, 2.4, 0.95, 0.5);
    stroke(ctx, ropesB, "rgba(8,24,48,0.9)", 1.2, 0.55, [3, 9], moveOff);
    fill(ctx, rectB(XR - 14, hitch, 28, 9), COL.steel, 0.75);
    if (st.element === "brake") drawSheave(ctx, st);
  }
  function drawSheave(ctx, st) {
    const ang = st.s / 0.32 * st.dir; // Scheibe dreht mit (r = 0,32 m)
    const eng = st.engage;
    // Lagerbock zur Rückwand
    fill(ctx, rectB(SH_X, SH_Y - 7, XBW - SH_X, 14), "rgba(159,196,230,0.14)");
    stroke(ctx, rectB(SH_X, SH_Y - 7, XBW - SH_X, 14), COL.steel, 1.2, 0.4);
    fill(ctx, (c) => c.arc(SH_X, SH_Y, SH_R, 0, TAU), "rgba(8,24,48,0.85)");
    glow(ctx, (c) => c.arc(SH_X, SH_Y, SH_R, 0, TAU), COL.cyan, 3, 0.95, 0.9);
    stroke(ctx, (c) => c.arc(SH_X, SH_Y, SH_R - 9, 0, TAU), COL.cyan, 1.4, 0.45);
    // Seilumschlingung oben
    glow(ctx, (c) => c.arc(SH_X, SH_Y, SH_R, Math.PI, TAU), COL.rope, 2.6, 0.9, 0.5);
    ctx.save(); ctx.globalAlpha = GA * 0.5; ctx.strokeStyle = COL.cyan; ctx.lineWidth = 2; ctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = ang + (k * TAU) / 6; ctx.moveTo(SH_X + Math.cos(a) * 36, SH_Y + Math.sin(a) * 36); ctx.lineTo(SH_X + Math.cos(a) * (SH_R - 11), SH_Y + Math.sin(a) * (SH_R - 11)); }
    ctx.stroke(); ctx.restore();
    // Bremstrommel + Backen (vorn)
    fill(ctx, (c) => c.arc(SH_X, SH_Y, 30, 0, TAU), "rgba(8,24,48,0.95)");
    stroke(ctx, (c) => c.arc(SH_X, SH_Y, 30, 0, TAU), COL.steel, 2.2, 0.9);
    fill(ctx, (c) => c.arc(SH_X, SH_Y, 6, 0, TAU), COL.steel, 0.9);
    const gap = lerp(7, 0, eng), bc = eng > 0.05 ? mix(COL.steel, COL.amber, eng) : COL.steel;
    for (const sd of [-1, 1]) {
      const r0 = 32 + gap;
      glow(ctx, (c) => c.arc(SH_X, SH_Y, r0, sd < 0 ? Math.PI - 0.8 : -0.8, sd < 0 ? Math.PI + 0.8 : 0.8), bc, 6, 1, eng * 1.2);
      stroke(ctx, lineB(SH_X + sd * (r0 + 6), SH_Y - 40, SH_X + sd * (r0 + 6), SH_Y + 48), COL.steel, 3, 0.8);
    }
    stroke(ctx, springB(SH_X - 38 - gap, SH_Y - 44, SH_X + 38 + gap, SH_Y - 44, 5, 5), COL.steel, 1.6, 0.8);
    if (eng > 0) dot(ctx, SH_X, SH_Y, 60, COL.amber, 0.35 * eng * (0.7 + 0.3 * Math.sin(st.t * 7)));
  }
  function drawRopeBrake(ctx, st) {
    const eng = st.engage, y = RB_Y;
    // Traverse zur vorderen Schachtwand
    fill(ctx, rectB(XW, y - 6, XR - 36 - XW, 12), "rgba(159,196,230,0.14)");
    stroke(ctx, rectB(XW, y - 6, XR - 36 - XW, 12), COL.steel, 1.3, 0.55);
    stroke(ctx, lineB(XW, y + 34, XR - 50, y + 6), COL.steel, 1.3, 0.4);
    // Gehäuse
    fill(ctx, (c) => rr(c, XR - 36, y - 28, 72, 56, 5), "rgba(8,24,48,0.88)");
    glow(ctx, (c) => rr(c, XR - 36, y - 28, 72, 56, 5), eng > 0.05 ? mix(COL.steel, COL.amber, eng) : COL.steel, 2, 0.95, 0.6 + eng);
    const gap = lerp(5.5, 0, eng), jc = eng > 0.05 ? mix(COL.amber, "#ffd9a0", eng * 0.5) : COL.amber;
    for (const sd of [-1, 1]) {
      const inner = XR + sd * (8.5 + gap), outer = XR + sd * 21;
      fill(ctx, rectB(Math.min(inner, outer), y - 20, Math.abs(outer - inner), 40), rgba(COL.amber, 0.25 + 0.55 * eng));
      glow(ctx, rectB(Math.min(inner, outer), y - 20, Math.abs(outer - inner), 40), jc, 1.8, 1, 0.4 + eng);
      stroke(ctx, springB(XR + sd * 22, y, XR + sd * 34, y, 3, 6), COL.steel, 1.4, 0.75);
    }
    if (eng > 0) dot(ctx, XR, y, 54, COL.amber, 0.4 * eng * (0.75 + 0.25 * Math.sin(st.t * 7)));
  }
  function drawCar(ctx, st) {
    const Yc = st.Yc, top = Yc - CH, roof = top - M(0.1), oc = st.carCol;
    const chT = roof - M(0.27), chB = chT + M(0.11), bbT = Yc + M(0.1), bbB = Yc + M(0.26), hw = M(0.2);
    // Tragrahmen (hinter der Kabine)
    fill(ctx, rectB(XR - 9, chT, 18, bbB - chT), "rgba(159,196,230,0.07)");
    stroke(ctx, rectB(XR - 9, chT, 18, bbB - chT), COL.steel, 1.1, 0.3);
    // Innenraum
    const gr = ctx.createLinearGradient(0, top, 0, Yc); gr.addColorStop(0, "rgba(63,210,255,0.11)"); gr.addColorStop(1, "rgba(63,210,255,0.035)");
    ctx.save(); ctx.globalAlpha = GA; ctx.fillStyle = gr; ctx.fillRect(CX0, top, CX1 - CX0, CH); ctx.restore();
    glow(ctx, lineB(CX0 + 44, top + 7, CX1 - 44, top + 7), "#dff6ff", 2.5, 0.8, 1.1);
    // Handlauf (0,90 m)
    stroke(ctx, lineB(CX1 - 8, Yc - M(0.9), CX1 - 32, Yc - M(0.9)), COL.steel, 3.5, 0.75);
    stroke(ctx, lineB(CX1 - 18, Yc - M(0.9), CX1 - 8, Yc - M(0.9) + 10), COL.steel, 2, 0.6);
    // Dach, Türantrieb, Querhaupt
    fill(ctx, rectB(CX0, roof, CX1 - CX0, M(0.1)), "rgba(63,210,255,0.12)");
    fill(ctx, rectB(CX0 + 4, roof - M(0.17), M(0.48), M(0.17)), "rgba(159,196,230,0.10)");
    stroke(ctx, rectB(CX0 + 4, roof - M(0.17), M(0.48), M(0.17)), COL.steel, 1.4, 0.6);
    stroke(ctx, (c) => c.arc(CX0 + M(0.38), roof - M(0.085), 8, 0, TAU), COL.steel, 1.4, 0.6);
    fill(ctx, rectB(XR - hw, chT, 2 * hw, chB - chT), "rgba(159,196,230,0.16)");
    stroke(ctx, rectB(XR - hw, chT, 2 * hw, chB - chT), COL.steel, 1.6, 0.85);
    // Unterbalken + Fangvorrichtung + Führungsschuhe
    fill(ctx, rectB(XR - M(0.26), bbT, M(0.52), bbB - bbT), "rgba(159,196,230,0.16)");
    stroke(ctx, rectB(XR - M(0.26), bbT, M(0.52), bbB - bbT), COL.steel, 1.6, 0.85);
    const sg = st.element === "safety_gear" ? st.engage : 0;
    fill(ctx, rectB(XR - 19, bbT + 2, 38, bbB - bbT + 6), rgba(COL.amber, 0.12 + 0.6 * sg));
    glow(ctx, rectB(XR - 19, bbT + 2, 38, bbB - bbT + 6), COL.amber, 1.6, 0.55 + 0.45 * sg, sg);
    fill(ctx, rectB(XR - 6, chT - 6, 12, chB - chT + 12), COL.steel, 0.55);
    // Schürze (0,75 m, unten abgeschrägt)
    stroke(ctx, polyB([[CX0 + 2, Yc + M(0.1)], [CX0 + 2, Yc + M(0.75)], [CX0 + 26, Yc + M(0.75) + 18]]), COL.steel, 2.6, 0.85);
    // Kabinenkontur
    glow(ctx, polyB([[CX0, Yc - DOOR_H], [CX0, roof], [CX1, roof], [CX1, Yc + M(0.1)], [CX0, Yc + M(0.1)], [CX0, Yc]]), oc, 3, 1, 0.9);
    stroke(ctx, lineB(CX0, top, CX1, top), oc, 1.6, 0.55);
    fill(ctx, rectB(CX0, top, 10, CH - DOOR_H), oc, 0.55);
    fill(ctx, rectB(CX0, Yc, CX1 - CX0, M(0.1)), "rgba(63,210,255,0.13)");
    glow(ctx, lineB(CX0, Yc, CX1, Yc), oc, 3, 1, 0.8);
    // Fahrkorbtür (Schnittebene: offen = hinter der Ebene, gestrichelt)
    if (st.doorsOpen) stroke(ctx, rectB(CX0 + 3, Yc - DOOR_H + 2, 9, DOOR_H - 6), COL.amber, 1.4, 0.45, [7, 6]);
    else { fill(ctx, rectB(CX0 + 2, Yc - DOOR_H, 11, DOOR_H - 3), "rgba(63,210,255,0.35)"); glow(ctx, rectB(CX0 + 2, Yc - DOOR_H, 11, DOOR_H - 3), COL.cyan, 1.6, 0.9, 0.6); }
    fill(ctx, rectB(CX0 - 1, Yc - 3, 24, 9), COL.steel, 0.9); // Fahrkorbschwelle
  }
  function drawVane(ctx, st) { // Schaltfahne der Türzone, fest an der Schiene (liegt hinter dem Fahrkorb)
    const zp = st.zone * S, vy = Y0 + SNDY, inZ = Math.abs(st.Yc - Y0) <= zp + 0.5;
    stroke(ctx, lineB(XR + 5, vy + zp - 10, SNX - 3, vy + zp - 10), COL.steel, 1.5, 0.4);
    fill(ctx, rectB(SNX - 3, vy - zp, 6, 2 * zp), COL.cyan, inZ ? 0.55 : 0.3);
    glow(ctx, rectB(SNX - 3, vy - zp, 6, 2 * zp), COL.cyan, 1.2, inZ ? 0.8 : 0.45, inZ ? 0.8 : 0.2);
  }
  function drawSensor(ctx, st) {
    const zp = st.zone * S, vy = Y0 + SNDY, sy = st.Yc + SNDY;
    const inZone = Math.abs(sy - vy) <= zp + 0.5, det = st.detected;
    // Sensor (Gabel) am Fahrkorb, Halter vom Unterbalken
    stroke(ctx, polyB([[XR + M(0.26), st.Yc + M(0.2)], [SNX - 20, st.Yc + M(0.2)], [SNX - 20, sy - 6]]), COL.steel, 2.2, 0.85);
    const sc = det > 0 ? mix(COL.cyan, COL.red, det) : COL.cyan;
    for (const sd of [-1, 1]) { const bx = sd < 0 ? SNX - 16 : SNX + 5; fill(ctx, rectB(bx, sy - 13, 11, 26), "rgba(8,24,48,0.95)"); glow(ctx, rectB(bx, sy - 13, 11, 26), sc, 1.8, 1, 0.7); }
    stroke(ctx, lineB(SNX - 16, sy + 13, SNX + 16, sy + 13), sc, 2, 0.9);
    const led = det > 0 ? COL.red : inZone ? COL.green : COL.amber;
    const blink = det > 0 ? 0.55 + 0.45 * Math.sin(st.t * 16) : 1;
    fill(ctx, (c) => c.arc(SNX + 24, sy - 7, 4, 0, TAU), led, blink);
    dot(ctx, SNX + 24, sy - 7, 16, led, 0.65 * blink);
    if (st.detFlash > 0) {
      const q = 1 - st.detFlash;
      stroke(ctx, (c) => c.arc(SNX, sy, 12 + q * 76, 0, TAU), COL.red, 3 * st.detFlash + 0.5, st.detFlash);
      dot(ctx, SNX, sy, 56, COL.red, 0.6 * st.detFlash);
    }
  }
  function drawLanding(ctx, st) {
    // Schachttür (Schnittebene) + Schwelle
    if (st.doorsOpen) stroke(ctx, rectB(XW - 20, LINTEL + 3, 10, Y0 - LINTEL - 6), COL.amber, 1.4, 0.45, [7, 6]);
    else { fill(ctx, rectB(XW - 21, LINTEL, 12, Y0 - LINTEL - 2), "rgba(63,210,255,0.35)"); glow(ctx, rectB(XW - 21, LINTEL, 12, Y0 - LINTEL - 2), COL.cyan, 1.6, 0.9, 0.6); }
    fill(ctx, rectB(XW - 24, Y0 - 3, 24, 10), COL.steel, 0.9);
    // Bezugslinie Haltestelle quer durch den Schacht
    stroke(ctx, lineB(XW, Y0, st.rulerOn ? RX - 14 : XBW, Y0), COL.cyan, 1.2, 0.35, [5, 7]);
    // Ebenen-Marke
    const lx = 150;
    fill(ctx, polyB([[lx, Y0 - 3], [lx - 9, Y0 - 17], [lx + 9, Y0 - 17]], true), COL.cyan, 0.8);
    txt(ctx, st.cfg.landingLabel.toUpperCase(), lx + 20, Y0 - 12, { size: 19, weight: 700, font: FONT.mono, color: COL.muted, ls: 3, alpha: 0.9 });
  }
  function drawHazard(ctx, st) {
    const gap = st.Yc - Y0; if (Math.abs(gap) < 2 || st.hazA <= 0) return;
    const col = st.hazCol, a = st.hazA;
    const y1 = Math.min(Y0, st.Yc), y2 = Math.max(Y0, st.Yc);
    const pul = 0.75 + 0.25 * Math.sin(st.t * 9);
    fill(ctx, rectB(XW - 34, y1, CX0 + 30 - (XW - 34), y2 - y1), rgba(col, 0.2 * pul), a);
    stroke(ctx, lineB(XW - 44, Y0, XW + 2, Y0), col, 2, a);
    stroke(ctx, lineB(CX0 - 6, st.Yc, CX0 + 40, st.Yc), col, 2, a);
    const x = XW - 14;
    glow(ctx, lineB(x, y1 + (y2 - y1 > 26 ? 9 : 0), x, y2 - (y2 - y1 > 26 ? 9 : 0)), col, 2.6, a, 0.8);
    if (y2 - y1 > 26) { arrowHead(ctx, x, y1, -Math.PI / 2, 12, col, a); arrowHead(ctx, x, y2, Math.PI / 2, 12, col, a); }
  }
  function drawChevrons(ctx, st) {
    const a = st.chevA; if (a <= 0.01) return;
    const cx = XR + 2, cy = st.Yc - M(1.0), dir = st.dir;
    for (let i = 0; i < 3; i++) {
      const y = cy + dir * (i - 1) * 32;
      const k = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(st.t * 7 - i * 1.3 * 1), 2);
      glow(ctx, polyB([[cx - 42, y - dir * 16], [cx, y + dir * 16], [cx + 42, y - dir * 16]]), st.hazCol, 6.5, a * k, 0.9);
    }
  }
  // Person im Profil (blickt nach rechts), ohne Gesicht
  function drawPerson(ctx, st) {
    const reach = st.reach, rec = st.recoil;
    const m = (v) => v * S;
    const bT = lerp(lerp(-0.1, -0.26, reach), -0.2, rec), bS = lerp(lerp(-0.1, -0.12, reach), -0.08, rec);
    const fT = lerp(lerp(0.1, 0.55, reach), 0.28, rec), fS = lerp(lerp(0.1, 0.32, reach), 0.22, rec);
    const lean = lerp(0.05, -0.13, rec) + 0.01 * Math.sin(st.t * 1.7);
    const legB = 0.45 * (Math.cos(bT) + Math.cos(bS));
    const hx = HIPX - m(0.1) * rec, hy = Y0 - m(legB) - 1.5;
    const P = (x, y, ang, len) => [x + Math.sin(ang) * m(len), y + Math.cos(ang) * m(len)];
    const kB = P(hx, hy, bT, 0.45), aB = P(kB[0], kB[1], bS, 0.45);
    const kF = P(hx, hy, fT, 0.45); let aF = P(kF[0], kF[1], fS, 0.45); if (aF[1] > Y0 - 4) aF = [aF[0], Y0 - 4];
    const sh = [hx + Math.sin(lean) * m(0.5), hy - Math.cos(lean) * m(0.5)];
    const hd = [sh[0] + Math.sin(lean) * m(0.2) + m(0.02), sh[1] - Math.cos(lean) * m(0.2)];
    const armN = [lerp(lerp(-0.12, -0.34, reach), -0.5, rec), lerp(lerp(-0.08, -0.16, reach), -0.2, rec)];
    const armF = [lerp(lerp(0.12, 0.34, reach), 0.42, rec), lerp(lerp(0.18, 0.5, reach), 2.25, rec)];
    const eN = P(sh[0], sh[1], armN[0], 0.3), wN = P(eN[0], eN[1], armN[1], 0.27);
    const eF = P(sh[0], sh[1], armF[0], 0.3), wF = P(eF[0], eF[1], armF[1], 0.27);
    const body = "#5a7ca2", far = "#46658a", rim = rgba(COL.cyan, 0.22);
    const limbs = (col, w) => [
      [[hx, hy], kB, aB, [aB[0] + m(0.2), aB[1] + 2], 0.13, far],
      [[sh[0], sh[1]], eF, wF, null, 0.09, far],
      [[hx, hy], kF, aF, [aF[0] + m(0.2) * Math.cos(fS * 0.6), aF[1] - m(0.2) * Math.sin(Math.max(0, fS - 0.25))], 0.13, body],
    ];
    ctx.save(); ctx.globalAlpha = GA * st.personA; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const L3 = limbs();
    for (const pass of [0, 1]) {
      for (let i = 0; i < L3.length; i++) {
        const [p0, p1, p2, p3, w, col] = L3[i];
        ctx.strokeStyle = pass ? col : rim; ctx.lineWidth = m(w) + (pass ? 0 : 5);
        ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); if (p3) ctx.lineTo(p3[0], p3[1]); ctx.stroke();
        if (i === 1) { // Rumpf zwischen fernen und nahen Gliedmaßen
          ctx.strokeStyle = pass ? body : rim; ctx.lineWidth = m(0.27) + (pass ? 0 : 5);
          const ux = Math.sin(lean), uy = -Math.cos(lean);
          ctx.beginPath(); ctx.moveTo(hx + ux * m(0.08), hy + uy * m(0.08)); ctx.lineTo(sh[0] - ux * m(0.06), sh[1] - uy * m(0.06)); ctx.stroke();
          ctx.lineWidth = m(0.1) + (pass ? 0 : 5); ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); ctx.lineTo(hd[0], hd[1]); ctx.stroke();
          ctx.fillStyle = pass ? body : rim; ctx.beginPath(); ctx.arc(hd[0], hd[1] - m(0.04), m(0.11) + (pass ? 0 : 2.5), 0, TAU); ctx.fill();
        }
      }
      ctx.strokeStyle = pass ? body : rim; ctx.lineWidth = m(0.09) + (pass ? 0 : 5);
      ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); ctx.lineTo(eN[0], eN[1]); ctx.lineTo(wN[0], wN[1]); ctx.stroke();
    }
    ctx.restore();
  }
  function drawRuler(ctx, st) {
    const a = st.rulerA; if (a <= 0.004) return;
    const cfg = st.cfg, dir = st.dir, yOf = (mm) => Y0 + dir * mm * S, t = st.t, B = cfg.B;
    const mEnd = Math.max(1.3, cfg.max + 0.1);
    GA = a;
    stroke(ctx, lineB(RX, yOf(-0.3), RX, yOf(mEnd)), COL.cyan, 2, 0.75);
    ctx.save(); ctx.globalAlpha = GA * 0.7; ctx.strokeStyle = COL.cyan; ctx.lineWidth = 1.4; ctx.beginPath();
    for (let i = -3; i <= Math.round(mEnd * 10); i++) { const y = yOf(i / 10), len = i % 5 === 0 ? 16 : 8; ctx.moveTo(RX, y); ctx.lineTo(RX + len, y); }
    ctx.stroke(); ctx.restore();
    // Türzone
    const zA = 0.16 + 0.3 * st.detFlash + 0.12 * st.detected;
    fill(ctx, rectB(RX - 9, Y0 - cfg.zone * S, 18, 2 * cfg.zone * S), st.detected > 0 ? mix(COL.cyan, COL.red, 0.5 * st.detFlash) : COL.cyan, zA);
    stroke(ctx, rectB(RX - 9, Y0 - cfg.zone * S, 18, 2 * cfg.zone * S), COL.cyan, 1.2, 0.7);
    txt(ctx, "0", RX + 24, Y0 + 8, { size: 22, weight: 700, font: FONT.mono, color: COL.white, alpha: 0.9 });
    const zl = easeOut(inv(B[2], B[2] + 0.4, t));
    if (zl > 0) txt(ctx, cfg.zoneLabel, RX + 26, dir > 0 ? Y0 - cfg.zone * S - 10 : Y0 + cfg.zone * S + 26, { size: 21, weight: 600, color: COL.cyan, alpha: zl });
    // Kabinen-Zeiger
    const py = st.Yc, pc = st.hazA > 0.05 ? st.hazCol : COL.cyan;
    stroke(ctx, lineB(CX1 + 2, py, RX - 16, py), pc, 1.2, 0.4, [4, 6]);
    fill(ctx, polyB([[RX - 3, py], [RX - 17, py - 8], [RX - 17, py + 8]], true), pc, 0.95);
    // Stopp-Marke
    const sA = easeOut(inv(B[4], B[4] + 0.4, t));
    if (sA > 0) {
      const ys = yOf(cfg.stop);
      glow(ctx, lineB(RX - 12, ys, RX + 30 * sA, ys), COL.green, 3, sA, 1);
      txt(ctx, cfg.showStopVal ? `Stopp · ${fmtM(cfg.stop)} m` : "Stopp", RX + 40, ys + 8, { size: 22, weight: 700, font: FONT.mono, color: COL.green, alpha: sA });
    }
    // Grenze + Klammer
    const lA = easeOut(inv(B[5], B[5] + 0.5, t));
    if (lA > 0) {
      const yl = yOf(cfg.max);
      const pul = 0.8 + 0.2 * Math.sin(t * 4);
      stroke(ctx, lineB(XW - 10, yl, lerp(RX, XW - 10, 1 - lA), yl), COL.red, 1.6, 0.55 * lA, [9, 7], t * 12);
      glow(ctx, lineB(RX - 16, yl, RX + 34, yl), COL.red, 3, lA, pul);
      if (cfg.limitLabel) txt(ctx, cfg.limitLabel, RX + 44, yl + 8, { size: 22, weight: 700, font: FONT.mono, color: COL.red, alpha: lA });
      const stopTxt = cfg.showStopVal ? `Stopp · ${fmtM(cfg.stop)} m` : "Stopp";
      const wL = Math.max(cfg.limitLabel ? meas(ctx, cfg.limitLabel, 22, 700, FONT.mono) : 0, meas(ctx, stopTxt, 22, 700, FONT.mono));
      const bx = Math.min(1640, RX + 44 + wL + 28), gp = easeOut(inv(B[5] + 0.1, B[5] + 0.7, t));
      const yb = lerp(Y0, yl, gp);
      glow(ctx, polyB([[bx - 10, Y0], [bx, Y0], [bx, yb], [bx - 10, yb]]), COL.amber, 2.4, lA, 0.8);
      let fs = 27, lines = wrap(ctx, cfg.rulerLabel, 1830 - (bx + 20), fs, 700, FONT.body, 9);
      if (lines.length > 3) { fs = 22; lines = wrap(ctx, cfg.rulerLabel, 1830 - (bx + 20), fs, 700, FONT.body, 5); }
      const my = (Y0 + yl) / 2, lh = fs * 1.26, y0 = my - ((lines.length - 1) * lh) / 2 + fs * 0.34;
      const tA = inv(B[5] + 0.35, B[5] + 0.8, t);
      lines.forEach((ln, i) => txt(ctx, ln, bx + 20, y0 + i * lh, { size: fs, weight: 700, color: COL.white, alpha: tA }));
    }
    GA = 1;
  }
  // Callout-Box: Titel + Untertitel; align "left" (Box ab x) oder "right" (Box endet bei x)
  function calloutBox(ctx, x, y, title, sub, color, a, align) {
    if (a <= 0.004) return null;
    const maxW = align === "right" ? x - 100 : 1830 - x;
    let k = 1, tw = meas(ctx, title, 27, 700), sw = sub ? meas(ctx, sub, 21, 500) : 0;
    if (Math.max(tw, sw) + 46 > maxW) { k = Math.max(0.62, (maxW - 46) / Math.max(tw, sw)); tw *= k; sw *= k; }
    const w = Math.max(tw, sw) + 46, h = sub ? 76 : 50, bx = align === "right" ? x - w : x, by = y - h / 2;
    const wp = easeOut(inv(0, 0.6, a));
    ctx.save(); ctx.beginPath(); ctx.rect(align === "right" ? bx + w * (1 - wp) - 2 : bx - 2, by - 12, w * wp + 4, h + 24); ctx.clip();
    fill(ctx, (c) => rr(c, bx, by, w, h, 6), "rgba(5,14,30,0.86)", a);
    stroke(ctx, (c) => rr(c, bx, by, w, h, 6), rgba(color, 0.55), 1.5, a);
    fill(ctx, rectB(bx, by + 6, 5, h - 12), color, a);
    const ta = inv(0.35, 1, a);
    txt(ctx, title, bx + 22, by + 34, { size: 27 * k, weight: 700, color: COL.white, alpha: ta });
    if (sub) txt(ctx, sub, bx + 22, by + 62, { size: 21 * k, weight: 500, color, alpha: ta });
    ctx.restore();
    return { x: bx, y: by, w, h };
  }
  function leader(ctx, x1, y1, x2, y2, color, a) {
    if (a <= 0.004) return;
    const q = easeOut(inv(0, 0.5, a));
    stroke(ctx, lineB(x1, y1, lerp(x1, x2, q), lerp(y1, y2, q)), color, 1.6, 0.85 * a);
    fill(ctx, (c) => c.arc(x1, y1, 4, 0, TAU), color, a);
    dot(ctx, x1, y1, 16, color, 0.6 * a);
  }
  function doorIcon(ctx, x, y, q, col, a) { // Frontansicht Tür: Blätter öffnen mit q
    stroke(ctx, rectB(x, y, 34, 40), col, 1.6, a);
    const pw = 16 * (1 - 0.72 * q);
    fill(ctx, rectB(x + 1, y + 1, pw, 38), rgba(col, 0.5), a);
    fill(ctx, rectB(x + 33 - pw, y + 1, pw, 38), rgba(col, 0.5), a);
    if (q > 0.5) { const aa = a * inv(0.5, 1, q); stroke(ctx, polyB([[x + 17, y + 20], [x + 11, y + 20]]), col, 1.5, aa); stroke(ctx, polyB([[x + 17, y + 20], [x + 23, y + 20]]), col, 1.5, aa); }
  }
  function chipFit(ctx, s, maxW, pad) { const tw0 = meas(ctx, s, 24, 700, FONT.head, 2); const fs = tw0 + pad > maxW ? Math.max(15, (24 * (maxW - pad)) / tw0) : 24; return { fs, tw: (tw0 * fs) / 24 }; }
  function chip(ctx, xr, y, label, col, a, icon, iconQ, blink, maxW) {
    if (a <= 0.004 || !label) return;
    const s = label.toUpperCase(), pad = icon ? 82 : 40, fit = chipFit(ctx, s, maxW || 760, pad), fs = fit.fs, tw = fit.tw;
    const w = tw + pad, h = 50, x = xr - w, yb = y - h / 2;
    const sc = easeOutBack(inv(0, 0.7, a));
    ctx.save(); ctx.translate(xr - w / 2, y); ctx.scale(sc, sc); ctx.translate(-(xr - w / 2), -y);
    fill(ctx, (c) => rr(c, x, yb, w, h, 25), "rgba(5,14,30,0.88)", a);
    glow(ctx, (c) => rr(c, x, yb, w, h, 25), col, 1.8, a * blink, 0.7);
    if (icon === "door") doorIcon(ctx, x + 18, yb + 5, iconQ, col, a);
    else if (icon === "dot") { fill(ctx, (c) => c.arc(x + 26, y, 6, 0, TAU), col, a * blink); dot(ctx, x + 26, y, 18, col, 0.7 * a * blink); }
    txt(ctx, s, x + (icon === "door" ? 64 : icon ? 44 : 20), y + 0.37 * fs + 0.2, { size: fs, weight: 700, font: FONT.head, ls: 2 * fs / 24, color: COL.white, alpha: a });
    ctx.restore();
  }
  function locationTag(ctx, st) {
    const lt = st.cfg.locTag; if (!lt) return;
    const a = easeOut(inv(lt.at, lt.at + 0.5, st.t)); if (a <= 0) return;
    const tw = meas(ctx, lt.text, 24, 600), w = tw + 70, h = 48;
    const right = lt.side === "right", x = right ? 1830 - w : 110, y = right ? (st.element === "rope_brake" || st.element === "brake" ? 440 : 275) : 340, yb = y - h / 2;
    const dx = (1 - a) * (right ? 30 : -30);
    ctx.save(); ctx.translate(dx, 0);
    fill(ctx, (c) => rr(c, x, yb, w, h, 8), "rgba(5,14,30,0.86)", a);
    stroke(ctx, (c) => rr(c, x, yb, w, h, 8), rgba(COL.amber, 0.6), 1.5, a);
    const px = x + 26, py = y - 4; // Ortsmarke
    fill(ctx, (c) => { c.arc(px, py - 3, 9, Math.PI * 0.85, Math.PI * 2.15); c.lineTo(px, py + 13); c.closePath(); }, COL.amber, a);
    fill(ctx, (c) => c.arc(px, py - 3, 3.5, 0, TAU), COL.navy, a);
    txt(ctx, lt.text, x + 48, y + 8, { size: 24, weight: 600, color: COL.white, alpha: a });
    if (lt.connected) stroke(ctx, lineB(right ? x : x + w, y, right ? CX1 + 10 : HIPX - 40, right ? st.Yc - 200 : Y0 - 260), COL.amber, 1.4, 0.6 * a, [5, 6]);
    ctx.restore();
  }
  function warningFrame(ctx, st) {
    const a = st.warnA; if (a <= 0.004) return;
    const blink = 0.3 + 0.7 * Math.pow(0.5 + 0.5 * Math.cos((st.t - st.cfg.B[1]) * TAU * 1.3), 1.6);
    const { x, y, w, h } = wfRect(), c = 34;
    stroke(ctx, rectB(x, y, w, h), COL.amber, 1.2, 0.3 * a * blink, [12, 10], -st.t * 20);
    const corners = [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]];
    for (const [cx, cy, sx, sy] of corners) glow(ctx, polyB([[cx + sx * c, cy], [cx, cy], [cx, cy + sy * c]]), COL.amber, 4, a * blink, 1);
    // Warndreieck auf der linken Rahmenkante
    const tx = x, ty = y + 78;
    fill(ctx, rectB(tx - 24, ty - 22, 48, 44), "rgba(5,14,30,0.9)", a);
    fill(ctx, polyB([[tx, ty - 17], [tx + 19, ty + 16], [tx - 19, ty + 16]], true), COL.amber, a * blink);
    fill(ctx, rectB(tx - 2, ty - 6, 4, 13), COL.navy, a * blink);
    fill(ctx, rectB(tx - 2, ty + 9, 4, 4), COL.navy, a * blink);
  }
  function drawSignal(ctx, st) {
    if (!st.cfg.protection || st.element === "none" || st.detected <= 0) return;
    const sy = st.Yc + SNDY, B = st.cfg.B;
    let pts;
    if (st.element === "rope_brake") pts = [[SNX + 14, sy], [XBW - 8, sy], [XBW - 8, RB_Y], [XR + 38, RB_Y]];
    else if (st.element === "brake") pts = [[SNX + 14, sy], [XBW - 8, sy], [XBW - 8, SH_Y + 60], [SH_X + 44, SH_Y + 60], [SH_X + 44, SH_Y + 48]];
    else pts = [[SNX - 16, sy + 13], [XR + 19, st.Yc + M(0.2)]];
    const q = inv(B[2], Math.max(B[2] + 0.12, B[3]), st.t);
    const a = 0.45 * (1 - 0.5 * st.engage);
    stroke(ctx, polyB(pts), COL.cyan, 1.6, a, [6, 6], -st.t * 40);
    if (q > 0 && q < 1) {
      let tot = 0; const segs = [];
      for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); tot += l; }
      let dd = q * tot, i = 0; while (i < segs.length - 1 && dd > segs[i]) { dd -= segs[i]; i++; }
      const f = dd / (segs[i] || 1), px = lerp(pts[i][0], pts[i + 1][0], f), py = lerp(pts[i][1], pts[i + 1][1], f);
      dot(ctx, px, py, 26, COL.cyan, 0.95); fill(ctx, (c) => c.arc(px, py, 4.5, 0, TAU), "#ffffff", 1);
    }
  }
  function anchorOf(st, target) {
    switch (target) {
      case "door": return { a: [XW - 15, (LINTEL + Y0) / 2], p: [620, Y0 - M(1.25)], al: "right" };
      case "sensor": return { a: [SNX, st.Yc + SNDY], p: [SLAB_POS.x, SLAB_POS.y], al: "right" };
      case "element": return st.element === "brake" ? { a: [SH_X + SH_R, SH_Y], p: [ELAB.x, ELAB.y], al: "left" } : { a: [XR + 36, RB_Y], p: [ELAB.x, ELAB.y], al: "left" };
      case "person": return { a: [HIPX, Y0 - M(1.3)], p: [620, Y0 - M(1.9)], al: "right" };
      case "counterweight": return { a: [CWX1, CW_TOP - st.dy + CW_H / 2], p: [1320, 455], al: "left" };
      case "gap": return { a: [XW - 14, (Y0 + st.Yc) / 2], p: [866, Y0 + M(0.6)], al: "right" };
      default: return { a: [CX1 - 30, st.Yc - M(1.4)], p: [1320, 450], al: "left" };
    }
  }

  CE.register("ucmp", {
    draw(ctx, p) {
      const P = p.params || {}, t = p.t, d = Math.max(0.5, p.d || 8);
      const cfg = config(P, d), B = cfg.B;
      setGeom(cfg.dir);
      if (STATIC[Y0] === undefined) STATIC[Y0] = buildStatic() || false;
      GA = 1;
      const s = cfg.motion(t), v = (cfg.motion(t + 0.04) - cfg.motion(Math.max(0, t - 0.04))) / (t > 0.04 ? 0.08 : 0.04 + t);
      const dy = cfg.dir * s * S;
      const fin = cfg.phase === "stopped";
      const detected = fin ? 1 : cfg.detect ? smooth(inv(B[2], B[2] + 0.12, t)) : 0;
      const detFlash = !fin && cfg.detect && t >= B[2] ? Math.max(0, 1 - (t - B[2]) / 0.9) : 0;
      const engage = cfg.detect && cfg.element !== "none" ? (fin ? 1 : smooth(inv(B[3], B[3] + 0.16, t))) : 0;
      const stopped = fin ? 1 : cfg.detect ? smooth(inv(B[4], B[4] + 0.5, t)) : 0;
      const moveOn = fin ? 1 : smooth(inv(B[1], B[1] + 0.35, t)) * (s > 0.002 || t > B[1] ? 1 : 0);
      const danger = moveOn * (1 - 0.7 * stopped);
      const hazCol = cfg.doorsOpen ? (stopped > 0.5 ? COL.amber : COL.red) : COL.amber;
      const st = {
        t, cfg, s, dy, Yc: Y0 + dy, roof: Y0 + dy - CH - M(0.1), dir: cfg.dir, element: cfg.protection ? cfg.element : "none", doorsOpen: cfg.doorsOpen,
        zone: cfg.zone, detected, detFlash, engage, hazCol,
        hazA: moveOn * (cfg.phase === "idle" ? 0 : 1),
        chevA: clamp(Math.abs(v) / 0.12) * moveOn * (1 - stopped),
        carCol: mix(COL.cyan, COL.red, cfg.doorsOpen ? 0.4 * danger : 0),
        rulerOn: cfg.ruler, rulerA: cfg.ruler ? smooth(inv(0.35, 0.95, t)) : 0,
        warnA: cfg.warn ? smooth(inv(cfg.phase === "movement" ? B[1] : 0.4, (cfg.phase === "movement" ? B[1] : 0.4) + 0.4, t)) * (1 - 0.6 * stopped) : 0,
        reach: fin ? 0.3 : smooth(inv(0.1, Math.min(B[0] + 0.6, d - 0.3), t)) * 0.999 + 0.001,
        recoil: fin ? 0.25 : cfg.doorsOpen ? smooth(inv(B[1] + 0.25, B[1] + 0.95, t)) : 0,
        personA: 1,
      };
      if (STATIC[Y0]) ctx.drawImage(STATIC[Y0], 0, 0);
      drawLanding(ctx, st);
      drawRopesAndCW(ctx, st);
      if (st.element === "rope_brake") drawRopeBrake(ctx, st);
      if (cfg.protection && st.element !== "none") drawVane(ctx, st);
      drawCar(ctx, st);
      if (cfg.protection && st.element !== "none") drawSensor(ctx, st);
      if (st.element === "safety_gear" && engage > 0 && t < B[4] + 0.3) {
        for (let i = 0; i < 10; i++) { const ph = (t * 3 + i * 0.137) % 1, x = XR + (i % 2 ? 1 : -1) * (6 + ph * 22), y = st.Yc + M(0.28) + cfg.dir * -ph * 40; dot(ctx, x, y, 7, COL.amber, (1 - ph) * engage * (1 - stopped)); }
      }
      drawHazard(ctx, st);
      drawChevrons(ctx, st);
      if (cfg.person) drawPerson(ctx, st);
      drawSignal(ctx, st);
      drawRuler(ctx, st);
      // Tür-Chip
      const dA = smooth(inv(B[0], B[0] + 0.45, t));
      const dCol = cfg.doorsOpen ? (danger > 0.5 ? COL.red : COL.amber) : COL.cyan;
      const dBlink = cfg.doorsOpen && danger > 0.5 ? 0.55 + 0.45 * Math.sin(t * 9) : 1;
      const cp = chipPos();
      chip(ctx, cp.x, cp.y, cfg.doorLabel, dCol, dA, "door", cfg.doorsOpen ? easeOut(inv(B[0] + 0.1, B[0] + 0.7, t)) : 0, dBlink, cp.x - 110);
      // Status rechts
      if (cfg.phase !== "idle") {
        const hA = smooth(inv(cfg.phase === "stopped" ? 0.35 : B[1] + 0.2, (cfg.phase === "stopped" ? 0.35 : B[1] + 0.2) + 0.4, t));
        // Statuswechsel nacheinander (alt aus, dann neu ein) statt Überblendung am selben Ort; ohne hazard_label sofort ein
        const hz = !!cfg.hazardLabel, sw = cfg.detect && !fin;
        const outA = fin ? 0 : sw ? 1 - smooth(inv(B[4], B[4] + 0.18, t)) : 1;
        const inA = fin ? 1 : sw ? (hz ? smooth(inv(B[4] + 0.2, B[4] + 0.5, t)) : smooth(inv(B[4], B[4] + 0.35, t))) : 0;
        if (outA > 0) chip2(ctx, cfg.hazardLabel, cfg.doorsOpen ? COL.red : COL.amber, hA * outA, 0.55 + 0.45 * Math.sin(t * 9));
        if (inA > 0) chip2(ctx, cfg.stopLabel, COL.green, fin || hz ? hA * inA : inA, 1);
      }
      // Callouts Sensor / Element
      if (cfg.protection && st.element !== "none" && cfg.detect) {
        const sA = easeOut(inv(B[2] + 0.1, B[2] + 0.7, t));
        if (sA > 0 && cfg.sensorLabel) { const an = anchorOf(st, "sensor"); leader(ctx, an.a[0] - 16, an.a[1], an.p[0], an.p[1], COL.cyan, sA); calloutBox(ctx, an.p[0], an.p[1], cfg.sensorLabel, cfg.sensorSub, COL.cyan, sA, "right"); }
        const eA = easeOut(inv(B[3] + 0.05, B[3] + 0.65, t));
        if (eA > 0 && cfg.elemLabel) {
          if (st.element === "safety_gear") {
            const ay = st.Yc + M(0.2);
            if (cfg.dir > 0) { const py = Y0 + SLAB + 55; leader(ctx, XR - 19, ay, SLAB_POS.x, py, COL.amber, eA); calloutBox(ctx, SLAB_POS.x, py, cfg.elemLabel, cfg.elemSub, COL.amber, eA, "right"); }
            else { leader(ctx, XR + 19, ay, 1320, 440, COL.amber, eA); calloutBox(ctx, 1320, 440, cfg.elemLabel, cfg.elemSub, COL.amber, eA, "left"); }
          }
          else { const an = anchorOf(st, "element"); leader(ctx, an.a[0], an.a[1], an.p[0], an.p[1], COL.amber, eA); calloutBox(ctx, an.p[0], an.p[1], cfg.elemLabel, cfg.elemSub, COL.amber, eA, "left"); }
        }
      }
      // Zusatz-Labels
      for (const lb of cfg.labels) {
        const a = easeOut(inv(lb.at, lb.at + 0.6, t)); if (a <= 0) continue;
        const an = anchorOf(st, lb.target);
        const px = isFinite(lb.x) ? lb.x : an.p[0], py = isFinite(lb.y) ? lb.y : an.p[1];
        leader(ctx, an.a[0], an.a[1], px, py, lb.color, a);
        calloutBox(ctx, px, py, lb.text, lb.sub, lb.color, a, an.al);
      }
      locationTag(ctx, st);
      warningFrame(ctx, st);
    },
  });
  function chip2(ctx, label, col, a, blink) {
    if (a <= 0.004 || !label) return;
    const maxW = 1830 - STAT.x, fit = chipFit(ctx, label.toUpperCase(), maxW, 82);
    chip(ctx, STAT.x + fit.tw + 82, STAT.y, label, col, a, "dot", 0, blink, maxW);
  }
})();
