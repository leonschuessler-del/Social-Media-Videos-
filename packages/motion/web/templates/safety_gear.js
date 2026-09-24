/* Template "safety_gear" – Fangvorrichtung in Nahaufnahme, Schnitt durch den Steg der Führungsschiene (T-Profil).
   Die Kamera fährt mit dem Fahrkorb mit: die Führungsschiene läuft durchs Bild.
   Bremsfangvorrichtung (progressiv): zwei Fangkeile auf Rollenbahnen, Druckstücke, Tellerfederpakete (begrenzen die
     Klemmkraft), fester Keilanschlag; Hubtraverse mit Langlöchern, Auslösehebel, Begrenzerseil mit Seilklemme.
   Bidirektional: Doppelkeile in V-förmiger Bahn – dieselbe Fangvorrichtung greift abwärts UND aufwärts.
   Sperrfangvorrichtung (sofort wirkend): gerändelte Klemmrolle auf schräger Laufbahn, feste Gegenbacke, schwimmendes
     starres Gehäuse ohne Federpaket – Stopp auf wenigen Zentimetern.
   Anzeigen: Maßband am Steg (Fangbeginn -> Bremsweg), Messwerte v / Verzögerung / Bremsweg, a(t)-Diagramm mit
     zulässigem Bereich 0,2–1,0 g; unten rechts Draufsicht/Einbaulage, Energie-Balken oder Hinweis-Karte.

   PARAMS (alle optional)
     type          "progressive" | "instantaneous" (Default progressive; Aliase bremsfang, sperrfang, sofort …)
     engaging      bool (true) – Auslösung + Fangen; false = Normalfahrt, Keile offen (Luftspalt)
     sparks        bool (true) – Funken an der Reibstelle (Wärmeglühen bleibt immer)
     bidirectional bool (false) – V-Bahn/Doppelkeil + Doppelpfeil AUF/AB; Fangvorgang dann aufwärts (Schiene läuft nach unten)
     direction     "down" | "up" – Fahrtrichtung (Default down, bei bidirectional up; up erzwingt bidirectional)
     then          "lift_release" – Szene beginnt gefangen: Pfeil + Anheben, Keile fallen zurück, Checkliste bis Freigabe
     label         Text oder {text, at, head} – Hinweis-Karte unten rechts; labelAt (s); labelHead (Kopfzeile)
     panel2        "topview" | "energy" | "label" | "none" (Default: label wenn gesetzt, sonst topview); energy:true = "energy"
     panel         bool (true) – Messwerte-Panel (bzw. Checkliste); panelAt (s), panel2At (s)
     panel2Y       "center" | "top" | "bottom" | px – Lage des unteren Panels. Default: bei panel:false mittig zum
                   Fanggehäuse (y = CY - h/2), sonst unter dem Messwerte-Panel. Zahl (px) gilt immer.
     shiftX        px | "auto" – Mechanik-Gruppe (Schiene, Seil, Gehäuse, Hebel, Beschriftungen) horizontal verschieben.
                   "auto" (Default) nur bei panel:false: ohne rechtes Panel mittig (+280); mit einem rechten Panel
                   zuerst mittig (+280), gleitet beim Einblenden des Panels auf +150 (Panel-Zeitpunkt < 1 s: sofort +150);
                   sichtbare rechte Beschriftungen (gap/jaw) -> 0. Bei panel:true Default 0 (unverändert).
     tape          bool (true) – Maßband + Bremsweg am Steg (nur beim Abwärts-Fangen)
     arrowsAt      s – Einblendung Doppelpfeil (bidirectional)
     callouts      Array [{id, at, text, sub}] (NUR diese, in dieser Reihenfolge) | Objekt {id: at | false | {at,text,sub}}
                   (Standard-Satz mit Overrides) | false (keine). ids: rail, wedge (Sperrfang: Klemmrolle), spring
                   (Sperrfang: Laufbahn), housing, jaw (nur Sperrfang), trace (Bremsspur), lever, rope, gap (nur engaging:false)
     steps         (then=lift_release) Array [{text, sub, at}] | Strings – Checklisten-Schritte (Default 4)
   BEATS  params.beats = Sekunden ab Szenenstart (auf [0,3 ; d-0,3] geklemmt), fehlende Einträge = Default:
     Fangen:        [0] = Auslösung (Begrenzer stoppt Seil, Hebel zieht Keile), [1] = Fangbeginn (Keile berühren Steg),
                    [2] = Stillstand (Bremsdauer [1]->[2] bestimmt die Zeitlupe), [3] = Ergebnis (Ø-Verzögerung + Haken)
     lift_release:  [0] = Pfeil + Anheben beginnt, [1] = Keile lösen sich und fallen zurück, [2] = Prüfung + Hinweis-Karte,
                    [3] = Freigabe (Checkliste komplett)
   "at" (s) akzeptieren: callouts[i].at, steps[i].at, label.at / labelAt, panelAt, panel2At, arrowsAt
     (panel2At bzw. labelAt steuern bei shiftX "auto" auch das Gleiten der Mechanik).
   Ohne beats/at: Default-Timing proportional zu d (Auslösung 0,12·d, Fangbeginn 0,22·d, Bremsen 0,3·d; Beschriftungen gestaffelt ab 0,3 s).
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
  // Bidirektional (V-Bahn, Doppelkeil): Keil mittig, Bahn wird nach oben UND nach unten enger
  const WHV = 104, WHH = WHV / 2, WY0V = CY - WHH, SLOT_V = 2 * SLOT, ROD_V = 156, BI_S0 = 0.08;
  // Geometrie des Bremsfangs: S = Standard (greift abwärts), V = bidirektional
  const GS = {
    id: "S", bi: false, WY0, WH, T: BLK_T, B: BLK_B, rod: ROD_P, slot: SLOT, attX: 22, attY: 11, pinR: 5,
    face: (y) => 44 + (y - WY0) * TANA,
    wedge: (X) => [[X(20), WY0], [X(20 + WT0), WY0], [X(20 + WT0 + WH * TANA), WY0 + WH], [X(20), WY0 + WH]],
  };
  GS.blk = (X) => [[X(GS.face(BLK_T)), BLK_T], [X(BLK_O), BLK_T], [X(BLK_O), BLK_B], [X(GS.face(BLK_B)), BLK_B]];
  const GV = {
    id: "V", bi: true, WY0: WY0V, WH: WHV, T: CY - 112, B: CY + 112, rod: ROD_V, slot: SLOT_V, attX: 9, attY: 10, pinR: 4,
    face: (y) => 44 + (WHH - Math.abs(y - CY)) * TANA,
    wedge: (X) => [[X(20), WY0V], [X(20 + WT0), WY0V], [X(20 + WT0 + WHH * TANA), CY], [X(20 + WT0), WY0V + WHV], [X(20), WY0V + WHV]],
  };
  GV.blk = (X) => [[X(GV.face(GV.T)), GV.T], [X(BLK_O), GV.T], [X(BLK_O), GV.B], [X(GV.face(GV.B)), GV.B], [X(GV.face(CY)), CY]];

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
  const ALIAS = {
    rail: ["schiene", "fuehrungsschiene", "führungsschiene", "guide_rail", "guiderail", "steg"],
    wedge: ["keil", "keile", "fangkeil", "fangkeile", "doppelkeil", "wedges", "roller", "rolle", "klemmrolle"],
    spring: ["springs", "feder", "federn", "federpaket", "tellerfeder", "tellerfederpaket", "track", "laufbahn", "bahn"],
    housing: ["gehaeuse", "gehäuse", "fanggehaeuse", "fanggehäuse", "body"],
    jaw: ["backe", "gegenbacke"],
    trace: ["spur", "bremsspur", "marks", "eindruecke", "eindrücke", "trail"],
    lever: ["hebel", "ausloesehebel", "auslösehebel", "linkage", "gestaenge", "gestänge"],
    rope: ["seil", "begrenzerseil", "governor_rope", "governor"],
    gap: ["luftspalt", "spalt", "clearance"],
  };
  function calloutId(k) { k = String(k == null ? "" : k).toLowerCase().trim(); if (!k) return null; for (const id in ALIAS) if (id === k || ALIAS[id].includes(k)) return id; return null; }
  function parseCallouts(v, tNum) {
    const out = { only: false, map: {} };
    if (v === undefined) return out;
    if (v === false || v === "none" || v === "off") { out.only = true; return out; }
    const txt = (x) => (x == null ? undefined : String(x));
    if (Array.isArray(v)) {
      out.only = true;
      v.forEach((it, i) => {
        let id = null, o = {};
        if (typeof it === "string") id = calloutId(it);
        else if (it && typeof it === "object") { id = calloutId(it.id ?? it.part ?? it.key ?? it.name ?? it.target); o = it; }
        if (id && !out.map[id]) out.map[id] = { at: tNum(o.at ?? o.t), text: txt(o.text ?? o.title ?? o.label), sub: txt(o.sub ?? o.subtitle ?? o.note), idx: i };
      });
    } else if (v && typeof v === "object") {
      for (const k in v) {
        const id = calloutId(k), o = v[k]; if (!id) continue;
        if (o === false || o === null) out.map[id] = { hide: true };
        else if (typeof o === "number") out.map[id] = { at: tNum(o) };
        else if (typeof o === "string") out.map[id] = Number.isFinite(num(o, NaN)) ? { at: tNum(o) } : { text: o };
        else if (typeof o === "object") out.map[id] = { at: tNum(o.at ?? o.t), text: txt(o.text ?? o.title ?? o.label), sub: txt(o.sub ?? o.subtitle ?? o.note), hide: o.show === false || o.hide === true };
      }
    }
    return out;
  }
  function config(P, d) {
    const ty = String(pick(P, ["type", "typ", "kind", "variant", "art", "gear_type", "gearType"]) ?? "progressive").toLowerCase();
    let inst = /inst|sofort|sperr|sudden|immediate|rolle|roller|block|abrupt/.test(ty);
    const e = bool(pick(P, ["engaging", "engaged", "engage", "active", "triggered", "tripped", "ausgeloest", "ausgelöst", "fangen", "greift"]));
    const sp = bool(pick(P, ["sparks", "spark", "funken", "sparks_on"]));
    const thenS = String(pick(P, ["then", "after", "danach", "next", "sequence", "action", "mode", "state"]) ?? "").toLowerCase();
    const lift = /lift|releas|lös|loes|anheb|reset|freigab|unlock/.test(thenS) || bool(pick(P, ["lift_release", "liftRelease", "release"])) === true;
    const normal = e === false || /normal|idle|ruhe|offen|open|fahrt/.test(thenS);
    let bi = bool(pick(P, ["bidirectional", "bidirektional", "bi_directional", "both_directions", "bothDirections", "up_and_down", "beide_richtungen"])) === true;
    const dS = String(pick(P, ["direction", "richtung", "dir", "travel", "fahrtrichtung"]) ?? "").toLowerCase();
    let dir = /up|auf|hoch|oben/.test(dS) ? -1 : /down|ab|unten|runter/.test(dS) ? 1 : bi ? -1 : 1;
    if (lift) dir = 1;
    if (dir < 0) bi = true;
    if (bi) inst = false;
    const mode = lift ? "lift" : normal ? "normal" : "fall";
    const lo = Math.min(0.3, d / 2), hi = Math.max(d - 0.3, d / 2);
    const tNum = (v) => { if (v === undefined || v === null || v === "" || typeof v === "boolean") return null; const n = num(v, NaN); return Number.isFinite(n) ? clamp(n, lo, hi) : null; };
    const bRaw = pick(P, ["beats", "beat", "takte"]);
    const beats = (Array.isArray(bRaw) ? bRaw : typeof bRaw === "number" ? [bRaw] : typeof bRaw === "string" ? bRaw.split(/[;\s|]+/) : []).map(tNum);
    let lab = pick(P, ["label", "caption", "hinweis", "note", "banner", "text_label"]), labAt = pick(P, ["labelAt", "label_at", "labelTime"]), labHead = pick(P, ["labelHead", "label_head", "labelTitle"]);
    if (lab && typeof lab === "object") { labAt = lab.at ?? labAt; labHead = lab.head ?? lab.title ?? labHead; lab = lab.text ?? lab.label ?? ""; }
    lab = lab == null || lab === false ? "" : String(lab).trim();
    const p2S = String(pick(P, ["panel2", "lower_panel", "inset", "panel_2"]) ?? "").toLowerCase();
    let panel2 = /energ/.test(p2S) ? "energy" : /top|drauf|profil|einbau/.test(p2S) ? "topview" : /label|hinweis|card|karte/.test(p2S) ? "label" : /none|off|aus|false|no/.test(p2S) ? "none" : "";
    if (!panel2) panel2 = lab ? "label" : bool(pick(P, ["energy", "energie", "show_energy"])) === true ? "energy" : "topview";
    if (panel2 === "energy" && mode !== "fall") panel2 = lab ? "label" : "topview";
    if (panel2 === "label" && !lab) panel2 = "topview";
    const p2yRaw = pick(P, ["panel2Y", "panel2_y", "panel2y", "panelY"]);
    let panel2Y = null;
    if (p2yRaw != null && typeof p2yRaw !== "boolean") {
      const n = num(p2yRaw, NaN);
      if (Number.isFinite(n)) panel2Y = n;
      else { const q = String(p2yRaw).toLowerCase(); panel2Y = /cent|mitt|mid/.test(q) ? "center" : /top|oben/.test(q) ? "top" : /bot|unten|low/.test(q) ? "bottom" : null; }
    }
    const sxRaw = pick(P, ["shiftX", "shift_x", "shiftx", "mechX", "offsetX"]);
    let shiftX = "auto";
    if (typeof sxRaw === "boolean") shiftX = sxRaw ? "auto" : 0;
    else if (sxRaw != null) { const n = num(sxRaw, NaN); if (Number.isFinite(n)) shiftX = clamp(n, -120, 400); }
    const stRaw = pick(P, ["steps", "checklist", "schritte"]);
    const steps = Array.isArray(stRaw) ? stRaw.map((it) => (typeof it === "string" ? { text: it } : it && typeof it === "object" ? { text: it.text ?? it.title ?? it.label, sub: it.sub ?? it.note, at: tNum(it.at ?? it.t) } : {})).filter((q) => q.text) : [];
    return {
      type: inst ? "instantaneous" : "progressive", engaging: mode !== "normal", sparks: sp === undefined ? true : sp, mode, bi, dir, beats,
      label: lab, labelAt: tNum(labAt), labelHead: labHead ? String(labHead) : "", panel2,
      panel: bool(pick(P, ["panel", "readouts", "messwerte", "show_panel"])) !== false,
      panelAt: tNum(pick(P, ["panelAt", "panel_at", "readoutsAt"])), panel2At: tNum(pick(P, ["panel2At", "panel2_at"])),
      tape: bool(pick(P, ["tape", "ruler", "massband", "maßband"])) !== false, arrowsAt: tNum(pick(P, ["arrowsAt", "arrows_at", "arrowAt"])),
      callouts: parseCallouts(pick(P, ["callouts", "labels", "parts", "beschriftungen"]), tNum), steps, panel2Y, shiftX,
    };
  }
  const CFGC = new WeakMap(), EMPTY = {};
  function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  function getCfg(P, d) {
    const key = P && typeof P === "object" ? P : EMPTY;
    let c = CFGC.get(key); if (c && c.d === d) return c;
    let js = ""; try { js = JSON.stringify(key); } catch (e) { js = "x"; }
    c = config(key, d); c.d = d; c.sig = hashStr(js + "|" + d); c.plan = makePlan(c, d);
    CFGC.set(key, c); return c;
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
  function timing(d, cfg) {
    const B = cfg.beats, bt = (i) => (B[i] != null ? B[i] : null);
    const pr = profile(cfg.type), ref = profile("progressive");
    if (cfg.mode === "lift") {
      const b0 = bt(0) ?? 0.18 * d;
      const b1 = Math.max(bt(1) ?? Math.max(b0 + 0.6, 0.34 * d), b0 + 0.35);
      const b2 = Math.max(bt(2) ?? Math.max(b1 + 0.6, 0.52 * d), b1 + 0.2);
      const b3 = Math.max(bt(3) ?? Math.max(b2 + 0.8, 0.78 * d), b2 + 0.2);
      return { pr, k: 10, lift: [b0, b1, b2, b3], tTrip: -3, tCon: -2, tStop: -1, tRes: -1 };
    }
    const tTrip = bt(0) ?? 0.12 * d;
    const tCon = Math.max(bt(1) ?? (bt(0) != null ? tTrip + Math.max(0.35, 0.1 * d) : 0.22 * d), tTrip + 0.12);
    let k;
    if (bt(2) != null) k = Math.max(bt(2) - tCon, 0.15) / pr.tauStop; // Bildschirm-s je physikalische s (Zeitlupe)
    else { k = (0.3 * d) / ref.tauStop; if (tCon + pr.tauStop * k > d - 0.35) k = Math.max(0.15, d - 0.35 - tCon) / pr.tauStop; }
    const tStop = tCon + pr.tauStop * k;
    return { tTrip, tCon, k, tStop, tRes: Math.max(bt(3) ?? tStop + 0.15, tStop), pr };
  }
  const STEPS_DEF = [["Fahrkorb anheben", "entlastet die Keile"], ["Keile fallen zurück", "Fangvorrichtung gelöst"], ["Prüfung", "Schiene, Keile, Begrenzer"], ["Freigabe", "erst dann fährt der Aufzug wieder"]];
  // Zeitplan einer Szene (einmal je Parametersatz): Beats, Einblendzeiten, ab wann alles steht (Standbild-Cache)
  function makePlan(cfg, d) {
    const tm = timing(d, cfg), sc = clamp(d / 8, 0.55, 1.4);
    const panelAt = cfg.panelAt ?? 0.1, p2At = cfg.panel2At ?? Math.min(d - 0.3, panelAt + 0.2);
    const labelAt = cfg.labelAt ?? (cfg.mode === "lift" ? tm.lift[2] : clamp(0.4 * d, 0.3, Math.max(0.3, d - 0.3)));
    const arrowsAt = cfg.arrowsAt ?? Math.min(0.6, 0.2 * d);
    let steps = null;
    if (cfg.mode === "lift") {
      const src = cfg.steps.length ? cfg.steps : STEPS_DEF.map((q) => ({ text: q[0], sub: q[1] }));
      const b = tm.lift;
      steps = src.slice(0, 6).map((q, i) => ({ text: String(q.text), sub: q.sub == null ? "" : String(q.sub), at: q.at ?? (b[i] != null ? b[i] : b[3] + (i - 3) * 0.8) }));
      steps.forEach((q, i) => { const nx = steps[i + 1]; q.done = nx ? Math.max(q.at + 0.3, nx.at) : q.at + 0.6; });
    }
    let rc = 0.3 + 6 * 0.17 * sc + 0.6;
    for (const id in cfg.callouts.map) { const o = cfg.callouts.map[id]; if (o.at != null) rc = Math.max(rc, o.at + 0.6); }
    let mech = Infinity;
    if (cfg.mode === "fall") mech = Math.max(tm.tStop + 1.0, tm.tCon + 0.3 * tm.k + 0.1, tm.tRes + 0.7);
    else if (cfg.mode === "lift") mech = Math.max(tm.lift[1] + 1.4, tm.lift[3] + 0.7);
    // Horizontale Lage der Mechanik (shiftX): A = Start, B = Ziel, sxT = Zeitpunkt des Gleitens (Panel erscheint)
    let sxA = 0, sxB = 0, sxT = null;
    if (typeof cfg.shiftX === "number") sxA = sxB = cfg.shiftX;
    else if (!cfg.panel) {
      const cc = cfg.callouts, vis = (id) => !(cc.only && !cc.map[id]) && !(cc.map[id] && cc.map[id].hide);
      const rightCo = (cfg.mode === "normal" && vis("gap")) || (cfg.type === "instantaneous" && vis("jaw"));
      const pT = cfg.panel2 === "label" ? labelAt : cfg.panel2 === "none" ? null : p2At;
      if (cfg.panel2 === "none") sxA = sxB = rightCo ? 180 : 280;
      else if (!rightCo) { sxB = 150; if (pT != null && pT >= 1.0) { sxA = 280; sxT = pT; } else sxA = 150; }
    }
    const ready = Math.max(mech, rc, panelAt + 0.9, p2At + 0.9, labelAt + 0.9, arrowsAt + 0.9, sxT != null ? sxT + 0.7 : 0, steps ? steps[steps.length - 1].done + 0.7 : 0, 1.1);
    return { tm, panelAt, p2At, labelAt, arrowsAt, steps, ready, sxA, sxB, sxT };
  }

  // Mechanik-Versatz zur Zeit t (gleitet mit dem Einblenden des rechten Panels)
  function shiftAt(pl, t) { if (pl.sxT == null || pl.sxA === pl.sxB) return pl.sxB; return lerp(pl.sxA, pl.sxB, smooth(inv(pl.sxT - 0.35, pl.sxT + 0.5, t))); }
  // y des rechten unteren Panels (null = klassische Lage unter dem Messwerte-Panel)
  function p2Y(s, h) {
    const m = s.cfg.panel2Y;
    if (typeof m === "number") return Math.round(clamp(m, 90, 910 - h));
    if (s.cfg.panel) return null;
    if (m === "top") return P1Y;
    if (m === "bottom") return P2Y;
    return Math.round(CY - h / 2);
  }

  // ---------- Zustand pro Frame ----------
  function computeState(t, d, cfg) {
    const inst = cfg.type === "instantaneous", dir = cfg.dir, G = inst ? null : cfg.bi ? GV : GS;
    const tm = cfg.plan.tm, pr = tm.pr, hC = inst ? HC_I : HC_P;
    const s = { inst, t, d, tm, pr, eng: cfg.mode !== "normal", cfg, G, dir, bi: cfg.bi, mode: cfg.mode, lp: 0, trace: null, jaw: null, power: 0 };
    if (cfg.mode === "normal") {
      s.phase = "normal"; s.v = inst ? 0.63 : 1.0; s.xmm = (s.v * 1000 * t) / tm.k; s.a = 0; s.tau = -1; s.h = 0; s.L = 0;
    } else if (cfg.mode === "lift") {
      // gefangen -> Anheben: die geklemmten Keile wandern mit der Schiene nach unten, bis sie frei sind, dann fallen sie zurück
      const b0 = tm.lift[0], b1 = tm.lift[1], h0 = inst ? HC_I + H2_I : HMAX_P, L0 = inst ? HC_I + LEAD_I : HC_P + LEAD_P, rat = inst ? 0.5 : 1;
      const lift1 = (h0 - hC + 2) / rat, hr = hC - 2;
      const lp = lift1 * smooth(inv(b0 + 0.15, b1, t)) + 14 * easeOut(inv(b1, b1 + 0.9, t));
      let h;
      if (t < b1) h = h0 - lp * rat;
      else { const f = inv(b1, b1 + 0.22, t); if (f < 1) h = hr * (1 - f * f); else { const ta = t - b1 - 0.22; h = 2.5 * Math.abs(Math.sin(ta * 22)) * Math.exp(-ta * 9); } }
      s.lp = lp; s.h = Math.max(0, h); s.L = Math.min(L0, s.h);
      s.v = 0; s.a = 0; s.tau = 99; s.xmm = pr.sStop - lp / S;
      s.phase = t < b0 ? "caught" : t < b1 ? "lift" : t < b1 + 0.9 ? "release" : "released";
    } else {
      const tau = (t - tm.tCon) / tm.k; s.tau = tau;
      if (tau < 0) {
        const tau0 = -tm.tCon / tm.k, vS = pr.vC - (inst ? 0.15 : 0.2), aPre = (pr.vC - vS) / Math.max(1e-6, -tau0);
        s.v = pr.vC + aPre * tau; s.xmm = (pr.vC * tau + 0.5 * aPre * tau * tau) * 1000; s.a = 0;
        s.phase = t < tm.tTrip ? "over" : "trip";
      } else if (tau < pr.tauStop) { const q = sampleP(pr, tau); s.v = q.v; s.xmm = q.x; s.a = q.a; s.phase = "brake"; }
      else { s.v = 0; s.xmm = pr.sStop; s.a = 0; s.phase = "stop"; }
      const Dp0 = Math.max(0, s.xmm * S);
      if (s.phase === "over") { s.h = 0; s.L = 0; }
      else if (s.phase === "trip") { s.h = hC * smooth(inv(tm.tTrip, tm.tCon, t)); s.L = s.h; }
      else if (inst) { s.h = hC + Math.min(Dp0 / 2, H2_I); s.L = hC + Math.min(Dp0 / 2, LEAD_I); }
      else { s.h = hC + Math.min(Dp0, HMAX_P - HC_P); s.L = hC + Math.min(Dp0, LEAD_P); }
      s.h *= dir; s.L *= dir;
    }
    s.D = dir * s.xmm * S; s.Dp = Math.max(0, s.xmm * S); // D: Bildschirmweg der Schiene (+ = nach oben)
    s.speedPx = (s.v * 1000 * S) / tm.k;
    const ah = Math.abs(s.h);
    s.delta = inst ? 0 : clamp((ah - HC_P) * TANA, 0, DMAX);
    s.shift = inst ? clamp((s.h - HC_I) * TANB, 0, GL) : 0;
    s.ox = -s.shift;
    s.cf = inst ? s.shift / GL : s.delta / DMAX;
    s.contact = cfg.mode === "fall" ? t >= tm.tCon : cfg.mode === "lift" ? ah > hC - 0.5 : false;
    const S0 = cfg.bi ? BI_S0 : 0;
    s.theta = Math.asin(clamp(S0 + s.L / PIN_R, -0.8, 0.8));
    s.ropeRise = ROPE_R * (Math.sin(s.theta) - S0);
    // Spuren auf dem Steg (fest auf der Schiene -> wandern mit ihr)
    if (cfg.mode === "lift") {
      const Dq = pr.sStop * S, lp = s.lp;
      if (inst) { s.trace = [YR0 - HC_I - Dq + lp, YR0 - (HC_I + H2_I) + lp]; s.jaw = [CY - 100 - Dq * 0.4 + lp, CY + 100 + lp]; }
      else s.trace = [G.WY0 - HC_P - Dq + lp, G.WY0 - HMAX_P + G.WH + lp];
    } else if (cfg.mode === "fall" && s.contact && s.Dp >= 0.5) {
      if (inst) { s.trace = [YR0 - HC_I - s.Dp, YR0 - s.h]; s.jaw = [CY - 100 - s.Dp * 0.4, CY + 100]; }
      else if (dir > 0) s.trace = [G.WY0 - HC_P - s.Dp, G.WY0 - s.h + G.WH];
      else s.trace = [G.WY0 - s.h, G.WY0 + HC_P + G.WH + s.Dp];
    }
    if (cfg.mode === "fall" && s.contact) {
      const tb = Math.max(0.05, tm.tStop - tm.tCon);
      const hin = smooth(inv(tm.tCon, tm.tCon + (inst ? 1 : 0.6) * tb, t));
      const cool = smooth(inv(tm.tStop, d + 1, t));
      s.heat = hin * (1 - 0.5 * cool) * (inst ? 0.8 : 1);
    } else if (cfg.mode === "lift") s.heat = 0.3 * (1 - smooth(inv(0, tm.lift[1] + 0.6, t)));
    else s.heat = 0;
    s.power = s.phase === "brake" ? clamp((s.v / pr.vC) * (s.a / pr.aRef) * 1.4) : 0;
    let amp = 0;
    if (cfg.mode === "fall" && s.contact) {
      if (inst) amp = (s.phase === "brake" ? 6 * (s.a / pr.aRef) : 0) + (t >= tm.tStop ? 7 * Math.exp(-(t - tm.tStop) * 10) : 0);
      else amp = 2.4 * Math.exp(-(t - tm.tCon) * 6);
    }
    s.shx = amp * Math.sin(t * 91); s.shy = amp * 0.7 * Math.cos(t * 113);
    return s;
  }

  // ---------- Hintergrund-Bewegung ----------
  function drawFX(ctx, s, t, ST, LV) {
    if (ST) drawStreaks(ctx, s);
    if (LV) drawScan(ctx, t);
  }
  function drawStreaks(ctx, s) {
    if (s.v < 0.005) return;
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
      if (any) { ctx.globalAlpha = GA * (0.12 + 0.08 * b) * clamp(0.15 + s.v / 0.35); ctx.stroke(); }
    }
    ctx.restore();
  }
  // Röntgen-Scan: weiches Band, das langsam über die Baugruppe läuft
  function drawScan(ctx, t, xMax) {
    const ys = 250 + ((t * 95) % 660), xa = RX - HW - 60, xb = Math.min(RX + HW + 360, xMax == null ? 1e9 : xMax);
    const g = ctx.createLinearGradient(xa, 0, xb, 0);
    g.addColorStop(0, "rgba(63,210,255,0)"); g.addColorStop(0.2, "rgba(63,210,255,1)"); g.addColorStop(0.75, "rgba(63,210,255,1)"); g.addColorStop(1, "rgba(63,210,255,0)");
    stk(ctx, (c) => { c.moveTo(xa, ys); c.lineTo(xb, ys); }, g, 1.2, 0, 0.13, { cap: "butt" });
    stk(ctx, (c) => { c.moveTo(xa, ys - 14); c.lineTo(xb, ys - 14); }, g, 26, 0, 0.022, { cap: "butt" });
  }

  // Fahrtrichtung: laufende Winkel neben dem Gehäuse (abwärts bzw. aufwärts)
  function drawDirection(ctx, L, s) {
    if (s.bi) drawBiArrow(ctx, L, s);
    if (s.mode === "lift") { drawLiftArrow(ctx, L, s); return; }
    const a = clamp(s.v / 0.25) * (s.phase === "stop" ? 0 : 1); if (a <= 0.01) return;
    const col = s.phase === "normal" ? COL.cyan : s.phase === "brake" ? COL.amber : COL.red;
    const up = s.dir < 0, e = up ? -1 : 1;
    const x = RX + HW + (s.bi ? 76 : 62), yA = HT + 44, span = 150, rate = clamp(s.speedPx * 0.004, 0.25, 1.4);
    if (!s.bi) stxt(L, ctx, "Fahrt", x, yA - 16, { size: 14, weight: 600, color: col, align: "center", alpha: 0.85 * a });
    for (const mid of [true, false]) {
      stk(ctx, (c) => { for (let k = 0; k < 4; k++) { const f = (k / 4 + s.t * rate) % 1; if ((f > 0.2 && f < 0.8) !== mid) continue; const y = yA + (up ? 1 - f : f) * span; c.moveTo(x - 11, y - 6 * e); c.lineTo(x, y + 5 * e); c.lineTo(x + 11, y - 6 * e); } }, col, 2.6, 0.8, a * (mid ? 0.95 : 0.35));
    }
  }
  // Doppelpfeil AUF/AB (bidirektionale Fangvorrichtung); die aktive Fahrtrichtung leuchtet
  function drawBiArrow(ctx, L, s) {
    const at = s.cfg.plan.arrowsAt, p = inv(at, at + 0.6, s.t); if (p <= 0) return;
    const x = RX + HW + 36, yT = HT - 6, yB = HB + 6, ym = (yT + yB) / 2, hl = ((yB - yT) / 2) * easeOut(p);
    const act = s.phase === "over" || s.phase === "trip" || s.phase === "brake" || s.phase === "normal" ? s.dir : 0;
    const pu = 0.65 + 0.35 * Math.abs(Math.sin(s.t * 4.2));
    stk(ctx, (c) => { c.moveTo(x, ym - hl + 16); c.lineTo(x, ym + hl - 16); }, COL.cyan, 3, 1, 0.85 * p, { cap: "butt" });
    for (const sg of [-1, 1]) {
      const on = act === sg, col = on ? (s.phase === "normal" ? COL.cyan : s.phase === "brake" ? COL.amber : COL.red) : COL.cyan, y = ym + sg * hl;
      arrowHead(ctx, x, y, sg < 0 ? -Math.PI / 2 : Math.PI / 2, 22, col, p * (on ? pu : 0.9));
      stxt(L, ctx, sg < 0 ? "AUF" : "AB", x + 15, sg < 0 ? y + 17 : y - 7, { size: 14, weight: 700, font: L.FONT.mono, color: on ? col : COL.muted, letterSpacing: 1.5, alpha: inv(0.5, 1, p) });
    }
  }
  // Anheben (then = lift_release): großer Pfeil nach oben neben dem Gehäuse
  function drawLiftArrow(ctx, L, s) {
    const b = s.tm.lift, p = inv(b[0] - 0.05, b[0] + 0.5, s.t); if (p <= 0) return;
    const x = RX + HW + 60, yB = HB + 6, yT = HT - 14, ytip = lerp(yB - 40, yT, easeOut(p));
    const moving = s.t < b[1] + 0.9, a = p * (moving ? 1 : 0.6 + 0.12 * Math.sin(s.t * 3));
    stk(ctx, (c) => { c.moveTo(x, yB); c.lineTo(x, ytip + 30); }, COL.amber, 10, 1, a, { cap: "butt" });
    arrowHead(ctx, x, ytip, -Math.PI / 2, 40, COL.amber, a);
    if (moving && s.t > b[0]) stk(ctx, (c) => { for (let k = 0; k < 5; k++) { const y = yB - 12 - ((k / 5 + s.t * 0.9) % 1) * (yB - ytip - 56); c.moveTo(x - 4, y + 3); c.lineTo(x, y - 2); c.lineTo(x + 4, y + 3); } }, "#241705", 2, 0, 0.85 * a);
    stxt(L, ctx, "ANHEBEN", x, yT - 22, { size: 14, weight: 700, font: L.FONT.mono, color: COL.amber, letterSpacing: 1.5, align: "center", alpha: a * inv(0.4, 1, p) });
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

  // Bremsspur am Steg (fest auf der Schiene -> wandert mit): Grundspur + additive Glut
  function drawTraceBase(ctx, s) {
    const tr = s.trace; if (!tr || tr[1] - tr[0] < 0.5) return;
    const yTop = tr[0], yBot = tr[1], dn = s.dir < 0;
    if (!s.inst) {
      const g = ctx.createLinearGradient(0, yTop, 0, yBot), cOld = rgba(COL.red, 0.35), cNew = mix(COL.red, COL.amber, 0.55, 0.8);
      g.addColorStop(0, dn ? cNew : cOld); g.addColorStop(1, dn ? cOld : cNew);
      stk(ctx, (c) => { c.moveTo(RX - BH + 2, yTop); c.lineTo(RX - BH + 2, yBot); c.moveTo(RX + BH - 2, yTop); c.lineTo(RX + BH - 2, yBot); }, g, 3, 1.2, 1, { cap: "butt" });
      // feine Riefen (Schleifspuren) außerhalb des Gehäuses – an die Schiene gebunden
      const scr = (c, y) => { const q = h01(Math.round(y + s.D) * 0.37); c.moveTo(RX - BH + 3, y); c.lineTo(RX - BH + 6 + q * 7, y + 1.5); c.moveTo(RX + BH - 3, y + 3); c.lineTo(RX + BH - 6 - q * 7, y + 4.5); };
      stk(ctx, (c) => { if (!dn) { for (let y = yTop + 4; y < Math.min(yBot, HT); y += 9) scr(c, y); } else { for (let y = yBot - 8; y > Math.max(yTop, HB); y -= 9) scr(c, y); } }, COL.amber, 1, 0, 0.4);
    } else {
      stk(ctx, (c) => { for (let y = yTop; y < yBot; y += 4) { c.moveTo(RX - BH + 1, y); c.lineTo(RX - BH + 7, y - 2); } }, mix(COL.red, COL.amber, 0.5), 1.6, 0.8, 0.9);
      if (s.jaw) stk(ctx, (c) => { c.moveTo(RX + BH - 2, s.jaw[0]); c.lineTo(RX + BH - 2, s.jaw[1]); }, mix(COL.red, COL.amber, 0.4), 2.4, 1, 0.6 * s.cf + 0.2);
    }
  }
  function drawTraceHeat(ctx, s) {
    const tr = s.trace; if (!tr || tr[1] - tr[0] < 0.5 || s.heat < 0.02) return;
    const yTop = tr[0], yBot = tr[1], h = clamp(s.heat * 1.1), dn = s.dir < 0;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const g = ctx.createLinearGradient(0, dn ? yBot : yTop, 0, dn ? yTop : yBot);
    g.addColorStop(0, rgba(COL.red, 0.12 * h)); g.addColorStop(0.6, rgba(COL.amber, 0.45 * h)); g.addColorStop(1, rgba(COL.hot, 0.9 * h));
    if (!s.inst) stk(ctx, (c) => { c.moveTo(RX - BH + 2, yTop); c.lineTo(RX - BH + 2, yBot); c.moveTo(RX + BH - 2, yTop); c.lineTo(RX + BH - 2, yBot); }, g, 2.4, 1.4, 1, { cap: "butt" });
    else stk(ctx, (c) => { c.moveTo(RX - BH + 3, yTop); c.lineTo(RX - BH + 3, yBot); }, g, 2.4, 1.4, 1, { cap: "butt" });
    ctx.restore();
  }

  // ---------- Fanggehäuse ----------
  function drawHousingBack(ctx, s) { fil(ctx, (c) => c.rect(RX - HW + s.ox, HT, HW * 2, HB - HT), "rgba(4,12,26,0.84)", 1); }
  function drawShell(ctx, P, s) {
    const x0 = PIV[0] - 24, y0 = HT - 8, w = RX + HW + 44 - x0, h = PIV[1] + 16 - y0, gid = s.inst ? "I" : s.G.id;
    ctx.save(); ctx.translate(s.ox, 0);
    layer(ctx, "shell|" + gid, x0, y0, w, h, 1, (g) => drawShellRaw(g, pats(g), gid));
    ctx.restore();
  }
  function drawShellRaw(ctx, P, gid) {
    const ox = 0, inst = gid === "I", V = gid === "V", ob = V ? 20 : 54;
    if (!inst) for (const sg of [-1, 1]) { // Keilanschläge (fest am Gehäuse); V-Bahn: oben und unten
      const X = (dx) => RX + sg * dx;
      const spans = V ? [[HT + PL, CY - WHH - HMAX_P], [CY + WHH + HMAX_P, HB - PL]] : [[HT + PL, STOP_Y]];
      for (const sp of spans) {
        const stp = polyB([[X(16), sp[0]], [X(100), sp[0]], [X(100), sp[1]], [X(16), sp[1]]], true);
        fil(ctx, stp, "rgba(12,34,62,0.96)", 1); hatch(ctx, stp, P.cyan, 0, 0, 0.55); stk(ctx, stp, COL.cyan, 1.5, 0.4, 0.8);
      }
    }
    if (!inst) for (const yc of SPR_Y) stk(ctx, (c) => { c.moveTo(RX - HW - 40, yc); c.lineTo(RX - BLK_O + 20, yc); c.moveTo(RX + BLK_O - 20, yc); c.lineTo(RX + HW + 40, yc); }, COL.cyan, 1, 0, 0.35, { dash: [14, 4, 3, 4], cap: "butt" });
    // Lagerbock des Auslösehebels
    const brk = polyB([[RX - HW + 8, HB], [RX - HW + 62, HB], [PIV[0] + 17, PIV[1] + 4], [PIV[0] - 17, PIV[1] + 4]], true);
    fil(ctx, brk, "rgba(16,36,62,0.95)", 1); hatch(ctx, brk, P.steel, 0, 0, 0.45); stk(ctx, brk, COL.steel, 1.6, 0.4, 0.9);
    const R = [
      [RX - HW, HT, WALL, HB - HT], [RX + HW - WALL, HT, WALL, HB - HT],
      [RX - HW + WALL, HT, HW - WALL - 20, PL], [RX + 20, HT, HW - WALL - 20, PL],
      [RX - HW + WALL, HB - PL, HW - WALL - ob, PL], [RX + ob, HB - PL, HW - WALL - ob, PL],
    ];
    const b = (c) => { for (const r of R) c.rect(r[0] + ox, r[1], r[2], r[3]); };
    fil(ctx, b, "rgba(12,34,62,0.96)", 1);
    hatch(ctx, b, P.cyan, ox, 0, 0.6);
    stk(ctx, b, COL.cyan, 1.2, 0, 0.55);
    stk(ctx, (c) => {
      c.moveTo(RX - 20 + ox, HT); c.lineTo(RX - HW + ox, HT); c.lineTo(RX - HW + ox, HB); c.lineTo(RX - ob + ox, HB);
      c.moveTo(RX + ob + ox, HB); c.lineTo(RX + HW + ox, HB); c.lineTo(RX + HW + ox, HT); c.lineTo(RX + 20 + ox, HT);
    }, COL.cyan, 2.6, 1, 1);
  }

  // Bremsfang: Anschläge, Druckstücke, Tellerfedern, Rollen, Keile
  function progGeom(s) {
    const G = s.G, dl = s.delta, h = s.h;
    const dxIn = Math.max(BH, 20 + dl - TANA * Math.abs(h));
    const yWt = G.WY0 - h, yWb = yWt + G.WH;
    return { dl, h, dxIn, yWt, yWb, face: (y) => G.face(y) + dl };
  }
  // Starre Teile als Sprite in Bezugslage, per Verschiebung gezeichnet (Schraffur wandert mit dem Teil)
  function rigid(ctx, key, pts, pad, dx, dy, drawFn) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const q of pts) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    ctx.save(); ctx.translate(dx, dy);
    layer(ctx, key, x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad, 1, drawFn);
    ctx.restore();
  }
  function drawProg(ctx, P, s) {
    const GG = s.G, G = progGeom(s), { dl, dxIn, yWt, yWb, face } = G, load = s.cf;
    const springCol = mix(COL.cyan, COL.amber, load);
    for (const sg of [-1, 1]) {
      const X = (dx) => RX + sg * dx;
      // Druckstück mit schräger (V: doppelt schräger) Laufbahn – starr, verschiebt sich um δ nach außen
      const bp = GG.blk(X);
      rigid(ctx, "blk|" + GG.id + sg, bp, 6, sg * dl, 0, (g) => { const bb = polyB(bp, true); fil(g, bb, "rgba(18,40,68,0.96)", 1); hatch(g, bb, pats(g).steel, 0, 0, 0.7); stk(g, bb, COL.steel, 1.8, 0.5, 0.95); });
    }
    // Tellerfederpakete (verformen sich -> live, beide Seiten in einem Pfad)
    const c0 = BLK_O + dl + 6, c1 = HW - WALL - 6, pitch = (c1 - c0) / NDISC, th = 5.4, hc = Math.max(0.6, pitch - th);
    const discs = (c) => {
      for (const sg of [-1, 1]) { const X = (dx) => RX + sg * dx; for (const yc of SPR_Y) for (let i = 0; i < NDISC; i++) {
        const a = c0 + i * pitch, xo = i % 2 ? a + hc : a, xi = i % 2 ? a : a + hc;
        for (const sn of [-1, 1]) { c.moveTo(X(xo), yc + sn * SPR_RO); c.lineTo(X(xi), yc + sn * SPR_RI); c.lineTo(X(xi + th), yc + sn * SPR_RI); c.lineTo(X(xo + th), yc + sn * SPR_RO); c.closePath(); }
      } }
    };
    const ends = (c) => { for (const sg of [-1, 1]) for (const yc of SPR_Y) for (const xe of [c0 - 3, c1 + 3]) c.rect(RX + sg * xe - 2.5, yc - SPR_RO - 4, 5, SPR_RO * 2 + 8); };
    fil(ctx, ends, "#1a3350", 1); stk(ctx, ends, COL.steel, 1.2, 0, 0.9);
    stk(ctx, discs, springCol, 1.2, 1.2 + 1.0 * load, 0.8);
    fil(ctx, discs, springCol, 0.9);
    stk(ctx, discs, "#06101f", 1.1, 0, 0.9);
    // Nadelrollen im Käfig (laufen mit halber Keilgeschwindigkeit)
    const y0r = Math.max(yWt, GG.T) + 6, y1r = Math.min(yWb, GG.B) - 6, cage = GG.WY0 + 6 - s.h / 2;
    stk(ctx, (c) => { for (const sg of [-1, 1]) for (let k = -4; k < 14; k++) { const y = cage + k * 14; if (y < y0r || y > y1r) continue; const x = RX + sg * (face(y) - 5); c.moveTo(x + 4, y); c.arc(x, y, 4, 0, TAU); } }, COL.steel, 1.4, 0, 0.9);
    // Fangkeile (starr; Bezugslage h = 0, Stegabstand 20)
    for (const sg of [-1, 1]) {
      const X = (dx) => RX + sg * dx, yb = GG.WY0 + GG.WH, wp = GG.wedge(X), px = X(20 + GG.attX), py = yb - GG.attY;
      rigid(ctx, "wedge|" + GG.id + sg, wp, 8, sg * (dxIn - 20), -s.h, (g) => {
        const wb = polyB(wp, true);
        fil(g, wb, "#3a2a10", 0.95); hatch(g, wb, pats(g).amber, 0, 0, 0.75); stk(g, wb, COL.amber, 2.2, 1, 1);
        fil(g, (c) => c.arc(px, py, GG.pinR, 0, TAU), "#0a1426", 1); stk(g, (c) => c.arc(px, py, GG.pinR, 0, TAU), COL.amber, 1.5, 0, 1);
      });
    }
  }
  function drawProgFront(ctx, s) { // Federbolzen + Einstellmuttern (starr mit dem Druckstück)
    const dl = s.delta;
    for (const sg of [-1, 1]) {
      const X = (dx) => RX + sg * dx, yc = SPR_Y[0];
      const pts = [[X(BLK_O - 10), yc - 14], [X(HW + 17), yc + 14]];
      rigid(ctx, "bolt|" + sg, pts, 6, sg * dl, 0, (g) => {
        stk(g, (c) => { c.moveTo(X(BLK_O - 10), yc); c.lineTo(X(HW + 17), yc); }, COL.steel, 4, 0.3, 0.9, { cap: "butt" });
        const xa = Math.min(X(HW), X(HW + 12));
        fil(g, (c) => c.rect(xa, yc - 12, 12, 24), "#1a3350", 1);
        stk(g, (c) => { c.rect(xa, yc - 12, 12, 24); c.moveTo(xa, yc - 4); c.lineTo(xa + 12, yc - 4); c.moveTo(xa, yc + 4); c.lineTo(xa + 12, yc + 4); }, COL.steel, 1.4, 0.3, 0.95);
      });
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
    const G = instGeom(s);
    // Laufbahn (Keilblock), Backenträger und gezahnte Gegenbacke: starr im schwimmenden Gehäuse (Verschiebung ox)
    const yT = CY - 118, yB = CY + 112, X = (dx) => RX - dx, jx = RX + BH + GL, jT = CY - 100, jB = CY + 100;
    rigid(ctx, "instBody", [[X(HW - WALL), yT], [RX + HW - WALL, yB]], 8, s.ox, 0, (g) => {
      const PP = pats(g);
      const blk = polyB([[X(G.trk(yT)), yT], [X(HW - WALL), yT], [X(HW - WALL), yB], [X(G.trk(yB)), yB]], true);
      fil(g, blk, "rgba(18,40,68,0.96)", 1); hatch(g, blk, PP.steel, 0, 0, 0.7); stk(g, blk, COL.steel, 1.8, 0.5, 0.95);
      const hold = polyB([[jx + 30, CY - 118], [RX + HW - WALL, CY - 118], [RX + HW - WALL, CY + 112], [jx + 30, CY + 112]], true);
      fil(g, hold, "rgba(18,40,68,0.96)", 1); hatch(g, hold, PP.steel, 0, 0, 0.7); stk(g, hold, COL.steel, 1.8, 0.5, 0.95);
      const jaw = (c) => { c.moveTo(jx + 30, jT); c.lineTo(jx + 3, jT); for (let y = jT; y < jB - 1; y += 10) { c.lineTo(jx, y + 5); c.lineTo(jx + 3, y + 10); } c.lineTo(jx + 30, jB); c.closePath(); };
      fil(g, jaw, "#3a2a10", 0.95); hatch(g, jaw, PP.amber, 0, 0, 0.7); stk(g, jaw, COL.amber, 2, 1, 1);
    });
    // Klemmrolle (gerändelt) – starres Sprite, gedreht
    const { xR, yR, phi } = G, R0 = RR + 10;
    ctx.save(); ctx.translate(xR, yR); ctx.rotate(phi);
    layer(ctx, "roller", -R0, -R0, 2 * R0, 2 * R0, 1, (g) => {
      fil(g, (c) => c.arc(0, 0, RR, 0, TAU), "#3a2a10", 0.95);
      stk(g, (c) => c.arc(0, 0, RR, 0, TAU), COL.amber, 2.4, 1, 1);
      stk(g, (c) => { for (let i = 0; i < 30; i++) { const a = (i * TAU) / 30; c.moveTo(Math.cos(a) * (RR - 6), Math.sin(a) * (RR - 6)); c.lineTo(Math.cos(a + 0.08) * (RR - 1), Math.sin(a + 0.08) * (RR - 1)); } }, COL.amber, 1.3, 0, 0.8);
      stk(g, (c) => { for (let i = 0; i < 3; i++) { const a = (i * TAU) / 3; c.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); c.lineTo(Math.cos(a) * (RR - 9), Math.sin(a) * (RR - 9)); } }, COL.amber, 2, 0.4, 0.8);
      fil(g, (c) => c.arc(0, 0, 7, 0, TAU), "#0a1426", 1);
      stk(g, (c) => c.arc(0, 0, 7, 0, TAU), COL.amber, 1.6, 0, 1);
    });
    ctx.restore();
  }

  // Wärmeglühen an der Reibstelle (additiv)
  function drawHeat(ctx, s) {
    if (s.heat <= 0.01) return;
    const hh = s.heat * (0.86 + 0.14 * Math.sin(s.t * 13.1) * Math.sin(s.t * 7.3 + 1)), dn = s.dir < 0;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    if (!s.inst) {
      const G = progGeom(s), GG = s.G;
      const wg = (c) => { for (const sg of [-1, 1]) { GG.wedge((dx) => RX + sg * (dx + G.dxIn - 20)).forEach((q, i) => (i ? c.lineTo(q[0], q[1] - G.h) : c.moveTo(q[0], q[1] - G.h))); c.closePath(); } };
      fil(ctx, wg, "#ff7a1a", 0.32 * hh);
      const g = ctx.createLinearGradient(0, dn ? G.yWb : G.yWt, 0, dn ? G.yWt : G.yWb);
      g.addColorStop(0, rgba(COL.hot, 0.95)); g.addColorStop(0.45, rgba(COL.amber, 0.8)); g.addColorStop(1, rgba(COL.red, 0.25));
      stk(ctx, (c) => { c.moveTo(RX - BH, G.yWt); c.lineTo(RX - BH, G.yWb); c.moveTo(RX + BH, G.yWt); c.lineTo(RX + BH, G.yWb); }, g, 3, 2.2, hh, { cap: "butt" });
      dot(ctx, RX, dn ? G.yWb - 26 : G.yWt + 26, 60, COL.amber, 0.55 * hh);
      dot(ctx, RX, dn ? HB : HT, 42, COL.amber, 0.5 * hh * (0.35 + s.power));
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
    const gid = s.inst ? "I" : s.G.id, ah = Math.abs(s.h), aL = Math.abs(s.L);
    if (ah <= 1e-9 && aL <= 1e-9) return "mech|" + gid + "|0";
    if (!s.inst && ah >= HMAX_P - 1e-9 && aL >= HC_P + LEAD_P - 1e-9) return "mech|" + gid + "|" + (s.h > 0 ? 1 : -1);
    if (s.inst && s.h >= HC_I + H2_I - 1e-9 && s.L >= HC_I + LEAD_I - 1e-9) return "mech|I|1";
    return null;
  }
  function drawMechRaw(ctx, P, s) {
    if (s.inst) drawInst(ctx, P, s); else drawProg(ctx, P, s);
    drawShell(ctx, P, s);
    if (!s.inst) drawProgFront(ctx, s);
  }
  function drawMech(ctx, P, s) {
    const key = mechKey(s);
    if (key) layer(ctx, key, PIV[0] - 30, HT - 12, RX + HW + 50 - (PIV[0] - 30), PIV[1] + 22 - (HT - 12), 1, (g) => drawMechRaw(g, pats(g), s));
    else drawMechRaw(ctx, P, s);
    drawLinkage(ctx, P, s);
  }

  // ---------- Gestänge, Auslösehebel, Begrenzerseil ----------
  const leverPt = (s, r) => [PIV[0] + r * Math.cos(s.theta), PIV[1] - r * Math.sin(s.theta)];
  function drawLinkage(ctx, P, s) {
    const yTr = TR_Y0 - s.L, SL = s.inst ? SLOT : s.G.slot, gid = s.inst ? "I" : s.G.id;
    // Rückstellfeder (Druckfeder zwischen Gehäuse und Hebel)
    const pS = leverPt(s, s.bi ? 330 : 400);
    stk(ctx, springB(pS[0], HB + 2, pS[0], pS[1] - 9, 6, 8), COL.steel, 1.8, 0.4, 0.8);
    // Hubtraverse mit Langloch-Laschen (starr, bewegt sich um L)
    const slots = s.inst ? [RX - 40] : [RX - 45, RX + 45];
    rigid(ctx, "trav|" + gid, [[RX - 64, TR_Y0 - SL - 5], [RX + 64, TR_Y0 + TR_H]], 8, 0, -s.L, (g) => {
      fil(g, (c) => rr(c, RX - 64, TR_Y0, 128, TR_H, 3), "#152c4a", 1);
      stk(g, (c) => rr(c, RX - 64, TR_Y0, 128, TR_H, 3), COL.steel, 1.8, 0.5, 1);
      for (const xs of slots) {
        fil(g, (c) => rr(c, xs - 8, TR_Y0 - SL - 5, 16, SL + 7, 3), "#152c4a", 1);
        stk(g, (c) => rr(c, xs - 8, TR_Y0 - SL - 5, 16, SL + 7, 3), COL.steel, 1.5, 0.3, 1);
        fil(g, (c) => rr(c, xs - 2.5, TR_Y0 - SL - 1, 5, SL, 2.5), "#050d1c", 1);
      }
    });
    // Zugstangen (Keil -> Langloch der Traverse)
    const rods = [];
    if (!s.inst) { const G = progGeom(s), GG = s.G; for (const sg of [-1, 1]) rods.push([RX + sg * (G.dxIn + GG.attX), G.yWb - GG.attY, RX + sg * 45, G.yWb - GG.attY + GG.rod]); }
    else { const G = instGeom(s); rods.push([G.xR, G.yR, RX - 40, G.yR + ROD_I]); }
    const pPin = leverPt(s, PIN_R);
    stk(ctx, (c) => { for (const r of rods) { c.moveTo(r[0], r[1]); c.lineTo(r[2], r[3]); } c.moveTo(RX, yTr + TR_H - 2); c.lineTo(pPin[0], pPin[1]); }, COL.steel, 4.5, 0.5, 1);
    fil(ctx, (c) => { for (const r of rods) { c.moveTo(r[2] + 4, r[3]); c.arc(r[2], r[3], 4, 0, TAU); } }, COL.white, 0.95);
    // Auslösehebel (starr, dreht um den Lagerpunkt)
    const lcol = s.phase === "trip" ? COL.amber : COL.steel;
    ctx.save(); ctx.translate(PIV[0], PIV[1]); ctx.rotate(-s.theta);
    layer(ctx, "lever|" + lcol, -40, -26, ROPE_R + 80, 52, 1, (g) => {
      const lev = (c) => c.rect(-24, -9, ROPE_R + 50, 18);
      fil(g, lev, "#132a48", 1); stk(g, lev, lcol, 2, 0.9, 1);
      for (const r of [0, PIN_R, ROPE_R]) { fil(g, (c) => c.arc(r, 0, 5.5, 0, TAU), "#050d1c", 1); stk(g, (c) => c.arc(r, 0, 5.5, 0, TAU), COL.white, 1.5, 0, 0.9); }
      stk(g, (c) => c.arc(0, 0, 13, 0, TAU), COL.steel, 1.6, 0.3, 0.9);
    });
    ctx.restore();
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
    const ccol = s.phase === "trip" ? COL.amber : COL.steel;
    rigid(ctx, "clamp|" + ccol, [[x - 19, -28], [x + 19, 28]], 8, 0, ye, (g) => {
      fil(g, (c) => rr(c, x - 15, -28, 30, 56, 4), "#132a48", 1);
      stk(g, (c) => rr(c, x - 15, -28, 30, 56, 4), ccol, 1.8, 0.6, 1);
      stk(g, (c) => { c.moveTo(x - 19, -15); c.lineTo(x + 19, -15); c.moveTo(x - 19, 15); c.lineTo(x + 19, 15); }, COL.white, 2.5, 0.3, 0.85, { cap: "butt" });
    });
    // Seil läuft relativ zum Fahrkorb weiter (Begrenzer hat es gestoppt): Pfeile in Seilrichtung
    if (s.mode === "fall" && (s.phase === "trip" || (s.contact && s.t - s.tm.tCon < 0.3))) {
      const a = s.phase === "trip" ? 1 : 1 - (s.t - s.tm.tCon) / 0.3, dn = s.dir < 0, m = (s.t * 60) % 26;
      for (let i = 0; i < 3; i++) { const yy = dn ? ye - 54 - i * 26 + m : ye - 70 - i * 26 - m; arrowHead(ctx, x + 22, yy, dn ? Math.PI / 2 : -Math.PI / 2, 12, COL.amber, a * (0.9 - i * 0.25)); }
    }
  }

  // ---------- Maßband: Fangbeginn -> Bremsweg ----------
  function drawTape(ctx, L, s) {
    if (s.mode !== "fall" || s.dir < 0 || !s.cfg.tape || !s.contact || s.Dp < 1) return;
    const yM = HT - s.Dp, tx = RX + BH + 5, tw = 20, lab = s.inst ? 2 : 10;
    // Band mit Teilung + Fangbeginn-Marke: ein hohes Sprite (Nullpunkt oben), davon wird der sichtbare Teil gezeichnet
    const SX = RX - 180, SW = 300, TOP = 14, LEN = 420;
    const cv = sprite("tape|" + s.inst, SW, TOP + LEN, (g) => {
      g.translate(-SX, TOP);
      fil(g, (c) => c.rect(tx, 0, tw, LEN), "rgba(40,28,8,0.85)", 1);
      stk(g, (c) => { c.moveTo(tx, LEN); c.lineTo(tx, 0); c.lineTo(tx + tw, 0); c.lineTo(tx + tw, LEN); }, COL.amber, 1.2, 0.3, 0.8);
      stk(g, (c) => { for (let j = 0; j * 7.5 < LEN; j++) { const y = j * 7.5, l = j % 10 === 0 ? 17 : j % 2 === 0 ? 11 : 6; c.moveTo(tx, y); c.lineTo(tx + l, y); } }, COL.amber, 1.2, 0, 0.95, { cap: "butt" });
      stk(g, (c) => { c.moveTo(RX - BH - 26, 0); c.lineTo(tx + tw + 2, 0); }, COL.amber, 2, 1, 1, { cap: "butt" });
      txt(L, g, "Fangbeginn", RX - BH - 32, 6, { size: 18, weight: 600, color: COL.amber, align: "right" });
    });
    const vis = Math.min(LEN, s.Dp), hVis = vis + TOP;
    if (cv) { ctx.save(); ctx.globalAlpha = GA; ctx.drawImage(cv, 0, 0, SW, hVis, SX, yM - TOP, SW, hVis); ctx.restore(); }
    // cm-Beschriftung nur, wenn sie vollständig über dem Gehäuse liegt
    for (let j = lab; j * 7.5 + 11 < vis; j += lab) stxt(L, ctx, `${j / 2} cm`, tx + tw + 5, yM + j * 7.5 + 5, { size: 14, weight: 700, font: L.FONT.mono, color: COL.amber, alpha: 0.9 });
    // Maßlinie mit Pfeilen + Wert
    const xd = RX + 104;
    stk(ctx, (c) => { c.moveTo(tx + tw + 2, yM); c.lineTo(xd + 8, yM); c.moveTo(RX + HW * 0.3, HT); c.lineTo(xd + 8, HT); c.moveTo(xd, yM + 2); c.lineTo(xd, HT - 2); }, COL.amber, 1.2, 0.6, 0.85, { cap: "butt" });
    if (s.Dp > 18) fil(ctx, (c) => { for (const [y, sg] of [[yM, 1], [HT, -1]]) { c.moveTo(xd, y); c.lineTo(xd - 5, y + sg * 10); c.lineTo(xd + 5, y + sg * 10); c.closePath(); } }, COL.amber, 1);
    const yl = s.Dp > 96 ? (yM + HT) / 2 : Math.min(yM, HT - 48) - 24;
    stxt(L, ctx, "BREMSWEG", xd + 16, yl - 12, { size: 14, weight: 700, font: L.FONT.mono, color: COL.muted, letterSpacing: 2 });
    txt(L, ctx, `${Math.round(s.xmm)} mm`, xd + 14, yl + 22, { size: 32, weight: 700, font: L.FONT.mono, color: COL.amber });
  }

  // ---------- Funken + Glut ----------
  function drawSparks(ctx, s) {
    if (s.mode !== "fall" || !s.cfg.sparks || !s.contact) return;
    const tm = s.tm, pr = s.pr, t = s.t, tb = Math.max(0.1, tm.tStop - tm.tCon), dn = s.dir < 0, yEx = dn ? HB + 1 : HT - 1;
    const N = s.inst ? 190 : 300;
    const G = s.inst ? instGeom(s) : progGeom(s);
    const B = [[], [], [], []]; // 2 Helligkeitsstufen × 2 Farben
    for (let i = 0; i < N; i++) {
      const born = tm.tCon + (tb + 0.04) * h01(i * 3.17 + 0.5);
      const life = (s.inst ? 0.32 : 0.42) + 0.45 * h01(i * 1.9 + 2), age = t - born;
      if (age < 0 || age > life) continue;
      const q = sampleP(pr, (born - tm.tCon) / tm.k), pw = clamp((q.v / pr.vC) * (q.a / pr.aRef) * 1.4);
      if (h01(i * 7.7 + 0.2) > 0.1 + 0.95 * pw) continue;
      const inner = h01(i * 4.4) < 0.22, side = inner && s.inst ? -1 : i % 2 ? 1 : -1, r5 = h01(i * 5.1);
      let x0, y0, ang, sp = (s.inst ? 520 : 400) + 640 * h01(i * 2.3);
      if (inner) { x0 = RX + side * (BH + 1); y0 = s.inst ? G.yR - 10 : dn ? G.yWb - 2 : G.yWt + 2; ang = -Math.PI / 2 + side * (0.05 + 0.3 * r5); sp *= 0.55; if (age > 0.16) continue; }
      else { x0 = RX + side * (BH + 3); y0 = yEx; ang = -Math.PI / 2 + side * (r5 < 0.7 ? 0.03 + 0.36 * r5 : 0.28 + 0.75 * (r5 - 0.7)); if (r5 >= 0.7) sp *= 0.7; }
      if (dn) ang = -ang; // aufwärts fahrend: Funken treten unten aus
      const g = 1500;
      const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp + g * age;
      const x = x0 + vx * age, y = y0 + Math.sin(ang) * sp * age + 0.5 * g * age * age;
      if (y > (dn ? 880 : HB + 120)) continue;
      const a = (1 - age / life) * (0.6 + 0.4 * pw);
      if (a < 0.03) continue;
      const k = 0.03 + 0.035 * h01(i * 8.3);
      const hot = age < life * 0.4 || i % 3 === 0 ? 1 : 0, lv = a > 0.5 ? 1 : 0;
      B[lv * 2 + hot].push(x, y, x - vx * k, y - vy * k);
    }
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
    for (let lv = 0; lv < 2; lv++) {
      const al = GA * (lv ? 0.9 : 0.45);
      for (let hot = 0; hot < 2; hot++) {
        const q = B[lv * 2 + hot]; if (!q.length) continue;
        ctx.beginPath(); for (let j = 0; j < q.length; j += 4) { ctx.moveTo(q[j], q[j + 1]); ctx.lineTo(q[j + 2], q[j + 3]); }
        ctx.globalAlpha = al * 0.3; ctx.strokeStyle = COL.amber; ctx.lineWidth = 5.5; ctx.stroke();
        ctx.globalAlpha = al; ctx.strokeStyle = hot ? COL.hot : "#ffc56e"; ctx.lineWidth = 2; ctx.stroke();
      }
    }
    ctx.restore();
    if (s.phase === "brake") { ctx.save(); ctx.globalCompositeOperation = "lighter"; dot(ctx, RX, dn ? HB + 4 : HT - 4, 70, COL.amber, 0.45 * s.power); dot(ctx, RX, dn ? HB + 2 : HT - 2, 22, COL.hot, 0.8 * s.power); ctx.restore(); }
    // Glut nach dem Stillstand: einzelne glühende Partikel sinken langsam
    if (t > tm.tStop - 0.2) {
      const E = [];
      for (let i = 0; i < 7; i++) {
        const born = tm.tStop - 0.2 + i * 0.3, life = 1.9 + 0.6 * h01(i * 3.3), age = t - born, per = life + 0.9;
        const ageM = ((age % per) + per) % per; if (age < 0 || ageM > life) continue;
        const side = i % 2 ? 1 : -1;
        E.push(RX + side * (BH + 6 + 28 * h01(i * 2.1)) + Math.sin(ageM * 3 + i) * 5, (dn ? HB + 8 + 20 * h01(i * 1.7) : HT - 8 - 40 * h01(i * 1.7)) + ageM * ageM * 38, (1 - ageM / life) * 0.8 * (0.4 + 0.6 * s.heat));
      }
      if (E.length) {
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        for (let j = 0; j < E.length; j += 3) dot(ctx, E[j], E[j + 1], 9, COL.amber, E[j + 2]);
        fil(ctx, (c) => { for (let j = 0; j < E.length; j += 3) { c.moveTo(E[j] + 1.6, E[j + 1]); c.arc(E[j], E[j + 1], 1.6, 0, TAU); } }, COL.hot, 0.8 * (0.4 + 0.6 * s.heat));
        ctx.restore();
      }
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
  // Beschriftungs-Definitionen je Zustand (Zielpunkt folgt dem Bauteil); ids siehe Kopfkommentar
  function calloutDefs(s) {
    const D = [], dn = s.dir < 0, lift = s.mode === "lift", rel = lift && s.t >= s.tm.lift[1];
    if (!s.inst) {
      const G = progGeom(s), dl = s.delta, GG = s.G;
      D.push({ id: "rail", tx: RX - BH, ty: 300, by: 292, title: "Führungsschiene", sub: "T-Profil, Steg 16 mm", o: 0 });
      D.push({ id: "wedge", tx: RX - G.dxIn - (GG.bi ? 14 : 18), ty: GG.bi ? (G.yWt + G.yWb) / 2 : G.yWt + 62, by: 492, title: GG.bi ? "Doppelkeil (2×)" : "Fangkeil (2×)",
        sub: lift ? (rel ? "gelöst, fällt zurück" : "klemmt am Steg") : GG.bi ? "greift aufwärts und abwärts" : "wird hochgezogen, klemmt", color: COL.amber, o: 1 });
      D.push({ id: "spring", tx: RX - (BLK_O + dl + (HW - WALL - BLK_O - dl) / 2), ty: SPR_Y[0] - SPR_RO + 4, by: 592, title: "Tellerfederpaket", sub: "begrenzt die Klemmkraft", color: s.cf > 0.5 ? COL.amber : COL.cyan, o: 2 });
      D.push({ id: "housing", tx: RX - HW + 9, ty: CY + 128, by: 692, title: "Fanggehäuse", sub: "am Fahrkorbrahmen", o: 3 });
    } else {
      const G = instGeom(s);
      D.push({ id: "rail", tx: RX - BH, ty: 300, by: 292, title: "Führungsschiene", sub: "T-Profil, Steg 16 mm", o: 0 });
      D.push({ id: "wedge", tx: G.xR - 12, ty: G.yR - 10, by: 492, title: "Klemmrolle", sub: lift ? (rel ? "gelöst, rollt zurück" : "verkeilt am Steg") : "gerändelt, rollt hoch, verkeilt", color: COL.amber, o: 1 });
      D.push({ id: "spring", tx: RX - G.trk(CY + 70) + s.ox - 2, ty: CY + 70, by: 592, title: "Schräge Laufbahn", sub: "starr, ohne Federpaket", o: 2 });
      D.push({ id: "housing", tx: RX - HW + 9 + s.ox, ty: CY + 128, by: 692, title: "Fanggehäuse", sub: "schwimmend gelagert", o: 3 });
      D.push({ id: "jaw", tx: RX + BH + GL + 16 + s.ox, ty: CY + 40, bx: RBX, by: 640, title: "Gegenbacke", sub: "fest, gezahnt", side: "right", ex: 930, color: COL.amber, o: 4.5 });
    }
    if (s.trace) {
      const tr = s.trace; let ty, gate;
      if (s.inst) { ty = lift ? (tr[0] + tr[1]) / 2 : Math.min(HT - 6, instGeom(s).yR - s.Dp * 0.5); gate = lift ? 1 : clamp((s.Dp - 16) / 20); }
      else if (!dn) { const a = tr[0], b = Math.min(tr[1], HT); ty = lerp(a, b, 0.45); gate = lift ? 1 : clamp((b - a - 70) / 60); }
      else { const a = Math.max(tr[0], HB), b = tr[1]; ty = lerp(a, b, 0.55); gate = clamp((b - a - 50) / 50); }
      D.push({ id: "trace", tx: RX - BH + (s.inst ? 3 : 2), ty, by: dn ? 770 : 392, title: s.inst ? "Eindrücke im Steg" : "Bremsspur",
        sub: lift ? "wird geprüft" : s.inst ? "Rolle beißt sich fest" : "Reibung wird zu Wärme", color: COL.amber, o: 3.5, gate });
    }
    const pL = leverPt(s, 70), trip = s.phase === "trip";
    D.push({ id: "lever", tx: pL[0], ty: pL[1], by: 848, title: "Auslösehebel", sub: lift ? "wird zurückgestellt" : s.inst ? "hebt die Klemmrolle" : dn ? "drückt die Keile nach unten" : "zieht die Keile hoch", color: trip ? COL.amber : COL.cyan, o: 4 });
    D.push({ id: "rope", tx: ROPE_X + 6, ty: 400, bx: RBX, by: 360, side: "right", title: "Begrenzerseil", sub: lift ? "Begrenzer zurückstellen" : s.eng ? "wird bei Auslösung gestoppt" : "läuft mit dem Fahrkorb", color: trip ? COL.amber : COL.cyan, o: 5 });
    if (s.mode === "normal") {
      const yg = s.inst ? YR0 - 10 : s.G.WY0 + 30, xg = s.inst ? RX - BH - 3 : RX + BH + 4;
      D.push({ id: "gap", tx: xg, ty: yg, bx: RBX, by: 520, side: "right", ex: 930, title: "Luftspalt", sub: s.inst ? "Rolle berührt den Steg nicht" : "Keile berühren den Steg nicht", o: 6 });
    }
    return D;
  }
  function queueCallouts(ctx, L, s) {
    const t = s.t, cc = s.cfg.callouts, sc = clamp(s.d / 8, 0.55, 1.4);
    for (const q of calloutDefs(s)) {
      const ov = cc.map[q.id];
      if ((cc.only && !ov) || (ov && ov.hide)) continue;
      const hasAt = ov && ov.at != null, order = cc.only ? ov.idx : q.o;
      const t0 = hasAt ? ov.at : 0.3 + order * 0.17 * sc;
      let p = inv(t0, t0 + 0.55, t);
      if (q.gate != null) p = Math.min(p, q.gate);
      if (p <= 0) continue;
      const title = ov && ov.text ? ov.text : q.title, sub = ov && ov.sub != null ? ov.sub : q.sub;
      tag(ctx, L, q.tx, q.ty, q.bx == null ? LBX : q.bx, q.by, title, sub, p, { color: q.color, side: q.side, ex: q.ex });
    }
  }

  // ---------- Messwerte-Panel ----------
  function statusOf(s) {
    const dn = s.dir < 0;
    switch (s.phase) {
      case "normal": return [dn ? "NORMALFAHRT AUFWÄRTS" : "NORMALFAHRT", COL.cyan];
      case "over": return [dn ? "ÜBERGESCHW. AUFWÄRTS" : "ÜBERGESCHWINDIGKEIT", COL.red];
      case "trip": return ["BEGRENZER LÖST AUS", COL.amber];
      case "brake": return [s.inst ? "SPERRFANG GREIFT" : "FANGEN – BREMSEN", s.inst ? COL.red : COL.amber];
      default: return ["STILLSTAND", COL.green];
    }
  }
  function checkMark(ctx, x, y, sz, color, a) { stk(ctx, (c) => { c.moveTo(x, y); c.lineTo(x + sz * 0.38, y + sz * 0.38); c.lineTo(x + sz, y - sz * 0.45); }, color, 2.6, 0.6, a); }
  function drawPanel1(ctx, L, s) {
    if (!s.cfg.panel) return;
    if (s.mode === "lift") { drawChecklist(ctx, L, s); return; }
    const t = s.t, pa = s.cfg.plan.panelAt, ap = smooth(inv(pa, pa + Math.min(0.7, 0.09 * s.d), t)); if (ap <= 0.01) return;
    const sG = GA; GA = sG * ap;
    const x0 = PX + (1 - easeOut(ap)) * 40, y0 = P1Y, w = PW, h = P1H, dn = s.dir < 0;
    const TWS = [176, 170, 142], TXS = [x0 + 24, x0 + 24 + 176 + 12, x0 + 24 + 176 + 12 + 170 + 12], tyT = y0 + 140, tH = 100;
    const cx0 = x0 + 64, cx1 = x0 + w - 28, cy0 = y0 + 294, cy1 = y0 + 384;
    const yMax = s.inst ? 2.5 : 1.5, xMax = 0.3;
    const Yc = (g) => cy1 - (clamp(g, 0, yMax) / yMax) * (cy1 - cy0), Xc = (tau) => cx0 + (clamp(tau, 0, xMax) / xMax) * (cx1 - cx0);
    const res = s.phase === "stop" && t >= s.tm.tRes;
    const stat = (g) => {
      fil(g, (c) => rr(c, x0, y0, w, h, 14), "rgba(6,16,34,0.9)", 1);
      stk(g, (c) => rr(c, x0, y0, w, h, 14), COL.cyan, 1.4, 0.5, 0.55);
      txt(L, g, s.inst ? "SPERRFANGVORRICHTUNG" : "BREMSFANGVORRICHTUNG", x0 + 24, y0 + 46, { size: 30, weight: 700, font: L.FONT.head, color: COL.white, letterSpacing: 1.5 });
      txt(L, g, s.inst ? "sofort wirkend – nur bis 0,63 m/s Nenngeschwindigkeit" : s.bi ? "bidirektional – greift abwärts und aufwärts" : "progressiv – Federpaket begrenzt die Klemmkraft", x0 + 24, y0 + 76, { size: 18, weight: 400, color: COL.muted });
      stk(g, (c) => { c.moveTo(x0 + 24, y0 + 94); c.lineTo(x0 + w - 24, y0 + 94); }, COL.cyan, 1, 0, 0.3);
      const labs = ["GESCHWINDIGKEIT", "VERZÖGERUNG", "BREMSWEG"];
      for (let i = 0; i < 3; i++) {
        const tx = TXS[i], TW = TWS[i];
        fil(g, (c) => rr(c, tx, tyT, TW, tH, 8), "rgba(63,210,255,0.05)", 1);
        stk(g, (c) => rr(c, tx, tyT, TW, tH, 8), COL.cyan, 1, 0, 0.3);
        txt(L, g, labs[i], tx + 14, tyT + 24, { size: 13, weight: 700, font: L.FONT.mono, color: COL.muted, letterSpacing: 1.5 });
      }
      txt(L, g, "VERZÖGERUNG a(t) AB FANGBEGINN", x0 + 24, y0 + 274, { size: 13, weight: 700, font: L.FONT.mono, color: COL.muted, letterSpacing: 1.5 });
      // zulässiger Bereich (Bremsfangvorrichtung): Ø 0,2–1,0 g
      fil(g, (c) => c.rect(cx0, Yc(1.0), cx1 - cx0, Yc(0.2) - Yc(1.0)), "rgba(91,228,155,0.10)", 1);
      stk(g, (c) => { c.moveTo(cx0, Yc(1.0)); c.lineTo(cx1, Yc(1.0)); c.moveTo(cx0, Yc(0.2)); c.lineTo(cx1, Yc(0.2)); }, COL.green, 1, 0, 0.55, { dash: [5, 4], cap: "butt" });
      const lg = s.inst ? "Bremsfang: Ø 0,2–1,0 g" : "zulässig Ø 0,2–1,0 g", lw = meas(L, g, lg, { size: 13, weight: 600 });
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
    const chev = (ctx) => { // laufende Pfeile = Bewegung (Richtung wie der Fahrkorb)
      const tx = TXS[0] + TWS[0] - 16, e = dn ? -1 : 1;
      const col = s.phase === "normal" ? COL.cyan : s.phase === "brake" ? COL.amber : COL.red, rate = clamp(s.speedPx * 0.006, 0.3, 1.6);
      for (const mid of [true, false]) fil(ctx, (c) => { for (let k = 0; k < 3; k++) { const f = (k / 3 + t * rate) % 1; if ((f > 0.2 && f < 0.8) !== mid) continue; const y = tyT + 44 + (dn ? 1 - f : f) * 34; c.moveTo(tx, y + 5 * e); c.lineTo(tx - 5, y - 5 * e); c.lineTo(tx + 5, y - 5 * e); c.closePath(); } }, col, mid ? 0.9 : 0.35);
    };
    const live = (ctx, withAnim) => {
      // Status + Zeitlupe
      const [st, sc] = statusOf(s);
      const sw = meas(L, ctx, st, { size: 14, weight: 700, font: L.FONT.mono, letterSpacing: 2 }) + 34;
      const pulse = s.phase === "stop" || s.phase === "normal" ? 1 : 0.6 + 0.4 * Math.abs(Math.sin(t * 5));
      const px0 = x0 + 24, py0 = y0 + 104;
      rigid(ctx, "pill|" + st, [[px0, py0], [px0 + sw, py0 + 26]], 8, 0, 0, (g) => {
        fil(g, (c) => rr(c, px0, py0, sw, 26, 13), rgba(sc, 0.12), 1);
        stk(g, (c) => rr(c, px0, py0, sw, 26, 13), sc, 1.4, 0.6, 0.9);
        fil(g, (c) => c.arc(px0 + 14, py0 + 13, 4, 0, TAU), sc, 1);
        txt(L, g, st, px0 + 26, py0 + 18, { size: 14, weight: 700, font: L.FONT.mono, color: sc, letterSpacing: 2 });
      });
      if (pulse < 1) fil(ctx, (c) => c.arc(px0 + 14, py0 + 13, 5, 0, TAU), "#07142a", 1 - pulse);
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
        s.phase === "normal" ? (dn ? "Normalfahrt aufwärts" : "Normalfahrt abwärts") : s.phase === "stop" ? "Stillstand" : s.phase === "brake" ? "bremst" : dn ? "aufwärts, zu schnell" : "abwärts, zu schnell",
        s.phase === "stop" ? COL.green : null);
      if (moving && withAnim) chev(ctx);
      let aVal = "–", aCol = COL.muted, aSub = s.eng ? "Fangvorrichtung offen" : "keine Bremsung", aSubCol = null;
      if (s.phase === "brake") { aVal = fmt(s.a, 2); aCol = s.a > 1.0 ? COL.red : COL.amber; aSub = s.inst ? "harter Stoß" : "im zulässigen Bereich"; aSubCol = s.inst ? COL.red : COL.green; }
      else if (s.phase === "stop" && res) { aVal = fmt(pr.aAvg, 2); aCol = pr.aAvg > 1.0 ? COL.red : COL.amber; aSub = s.inst ? `Ø, Spitze ${fmt(pr.aMax, 1)} g` : "Mittelwert Ø, zulässig"; aSubCol = s.inst ? COL.red : COL.green; }
      else if (s.phase === "stop") { aVal = "0,00"; aCol = COL.white; aSub = "Stillstand"; }
      else if (s.phase === "normal") { aVal = "0,00"; }
      tile(1, aVal, aVal === "–" ? "" : "g", aCol, aSub, aSubCol);
      if (res && !s.inst && pr.aAvg <= 1.0) checkMark(ctx, TXS[1] + TWS[1] - 30, tyT + 22, 16, COL.green, 1);
      tile(2, s.contact ? String(Math.round(s.xmm)) : "–", s.contact ? "mm" : "", s.contact ? COL.amber : COL.muted, s.contact ? (res ? `= ${fmt(s.xmm / 10, 1)} cm` : "ab Fangbeginn") : s.eng ? "noch kein Fangen" : "kein Fangvorgang", null);
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
        if (res) {
          const ya = Yc(pr.aAvg), ap2 = inv(s.tm.tRes, s.tm.tRes + 0.5, t);
          stk(ctx, (c) => { c.moveTo(Xc(0), ya); c.lineTo(Xc(pr.tauStop), ya); }, COL.white, 1.4, 0, 0.8 * ap2, { dash: [6, 4], cap: "butt" });
          stxt(L, ctx, `Ø ${fmt(pr.aAvg, 2)} g`, Xc(pr.tauStop) + 8, ya + (s.inst ? 5 : -6), { size: 14, weight: 700, font: L.FONT.mono, color: COL.white, alpha: ap2 });
        }
      }
    };
    const still = ap >= 1 && (s.phase === "normal" || (s.phase === "stop" && s.tau >= xMax && t > s.tm.tStop + 0.6 && t > s.tm.tRes + 0.6));
    if (still) {
      layer(ctx, "p1live|" + s.cfg.sig + "|" + s.phase, x0 - 14, y0 - 14, w + 28, h + 28, 1, (g) => { stat(g); live(g, false); });
      if (s.phase === "normal") chev(ctx);
    } else { layer(ctx, "p1|" + s.cfg.sig, x0 - 14, y0 - 14, w + 28, h + 28, 1, stat); live(ctx, true); }
    GA = sG;
  }

  // ---------- Checkliste nach dem Fangen (then = lift_release) ----------
  function p1Height(s) { if (s.mode !== "lift") return P1H; const n = s.cfg.plan.steps.length; return 176 + Math.max(0, n - 1) * ckGap(n) + 40; }
  const ckGap = (n) => (n <= 4 ? 60 : n === 5 ? 56 : 50);
  function drawChecklist(ctx, L, s) {
    const t = s.t, pl = s.cfg.plan, pa = pl.panelAt, ap = smooth(inv(pa, pa + Math.min(0.7, 0.09 * s.d), t)); if (ap <= 0.01) return;
    const sG = GA; GA = sG * ap;
    const x0 = PX + (1 - easeOut(ap)) * 40, y0 = P1Y, w = PW, h = p1Height(s), b = s.tm.lift, st = pl.steps, n = st.length;
    const gap = ckGap(n), ry = (i) => y0 + 176 + i * gap, cxC = x0 + 46;
    layer(ctx, "ck|" + s.cfg.sig, x0 - 14, y0 - 14, w + 28, h + 28, 1, (g) => {
      fil(g, (c) => rr(c, x0, y0, w, h, 14), "rgba(6,16,34,0.9)", 1);
      stk(g, (c) => rr(c, x0, y0, w, h, 14), COL.cyan, 1.4, 0.5, 0.55);
      txt(L, g, "NACH DEM FANGEN", x0 + 24, y0 + 46, { size: 30, weight: 700, font: L.FONT.head, color: COL.white, letterSpacing: 1.5 });
      txt(L, g, "Wiederinbetriebnahme – Schritt für Schritt", x0 + 24, y0 + 76, { size: 18, weight: 400, color: COL.muted });
      stk(g, (c) => { c.moveTo(x0 + 24, y0 + 94); c.lineTo(x0 + w - 24, y0 + 94); }, COL.cyan, 1, 0, 0.3);
      if (n > 1) stk(g, (c) => { c.moveTo(cxC, ry(0) + 9); c.lineTo(cxC, ry(n - 1) - 25); }, COL.muted, 1.2, 0, 0.35, { dash: [3, 5], cap: "butt" });
      for (let i = 0; i < n; i++) {
        fil(g, (c) => c.arc(cxC, ry(i) - 8, 15, 0, TAU), "#07142a", 1);
        stk(g, (c) => c.arc(cxC, ry(i) - 8, 15, 0, TAU), COL.muted, 1.4, 0, 0.35);
        txt(L, g, String(i + 1), cxC, ry(i) - 2, { size: 16, weight: 700, font: L.FONT.mono, color: COL.muted, align: "center", alpha: 0.45 });
      }
    });
    const [stS, stC] = t < b[0] ? ["STILLSTAND – KEILE KLEMMEN", COL.amber] : t < b[1] ? ["FAHRKORB WIRD ANGEHOBEN", COL.amber] : t < b[2] ? ["FANGVORRICHTUNG GELÖST", COL.cyan] : t < b[3] ? ["PRÜFUNG", COL.amber] : ["FREIGEGEBEN", COL.green];
    const sw = meas(L, ctx, stS, { size: 14, weight: 700, font: L.FONT.mono, letterSpacing: 2 }) + 34, px0 = x0 + 24, py0 = y0 + 108;
    rigid(ctx, "pill|" + stS, [[px0, py0], [px0 + sw, py0 + 26]], 8, 0, 0, (g) => {
      fil(g, (c) => rr(c, px0, py0, sw, 26, 13), rgba(stC, 0.12), 1);
      stk(g, (c) => rr(c, px0, py0, sw, 26, 13), stC, 1.4, 0.6, 0.9);
      fil(g, (c) => c.arc(px0 + 14, py0 + 13, 4, 0, TAU), stC, 1);
      txt(L, g, stS, px0 + 26, py0 + 18, { size: 14, weight: 700, font: L.FONT.mono, color: stC, letterSpacing: 2 });
    });
    for (let i = 0; i < n; i++) {
      const it = st[i], y = ry(i), rp = easeOut(inv(it.at, it.at + 0.45, t)); if (rp <= 0) continue;
      const done = t >= it.done, col = done ? COL.green : COL.amber, pu = done ? 1 : 0.55 + 0.45 * Math.abs(Math.sin(t * 4));
      fil(ctx, (c) => c.arc(cxC, y - 8, 15, 0, TAU), "#07142a", rp);
      fil(ctx, (c) => c.arc(cxC, y - 8, 15, 0, TAU), done ? "rgba(91,228,155,0.18)" : "rgba(255,179,71,0.16)", rp);
      stk(ctx, (c) => c.arc(cxC, y - 8, 15, 0, TAU), col, 2, 0.8, rp * pu);
      if (done) checkMark(ctx, cxC - 7, y - 7, 14, COL.green, 1);
      else stxt(L, ctx, String(i + 1), cxC, y - 2, { size: 16, weight: 700, font: L.FONT.mono, color: COL.amber, align: "center", alpha: rp });
      const dx = (1 - rp) * 24;
      stxt(L, ctx, it.text, x0 + 78 + dx, y - 3, { size: 24, weight: 600, color: COL.white, alpha: rp });
      if (it.sub) stxt(L, ctx, it.sub, x0 + 78 + dx, y + 20, { size: 16, weight: 400, color: done ? COL.green : COL.muted, alpha: rp * 0.95 });
    }
    GA = sG;
  }

  // ---------- Hinweis-Karte (label) ----------
  const LAYC = new Map();
  function labelLayout(L, ctx, cfg) {
    let r = LAYC.get(cfg.sig); if (r) return r;
    let size = 34, lines = [];
    for (const sz of [34, 30, 26, 22]) { size = sz; lines = L.wrap(ctx, cfg.label, PW - 196, { size, weight: 700 }); if (lines.length <= 3) break; }
    lines = lines.slice(0, 5);
    const lh = size * 1.22, h = clamp(56 + lines.length * lh + 34, 170, P2H);
    r = { size, lines, lh, h }; if (LAYC.size > 50) LAYC.clear(); LAYC.set(cfg.sig, r); return r;
  }
  function drawLabelCard(ctx, L, s, ST, LV) {
    const t = s.t, at = s.cfg.plan.labelAt, ap = smooth(inv(at, at + 0.6, t)); if (ap <= 0.01) return;
    const sG = GA; GA = sG * ap;
    const lay = labelLayout(L, ctx, s.cfg), h = lay.h;
    const x0 = PX + (1 - easeOut(ap)) * 40, y0 = p2Y(s, h) ?? (P1Y + p1Height(s) + 18), w = PW;
    const kind = s.mode === "lift" ? "person" : s.bi ? "updown" : "info", col = kind === "info" ? COL.cyan : COL.amber;
    const head = s.cfg.labelHead || (kind === "person" ? "WICHTIG" : kind === "updown" ? "EN 81-20" : "HINWEIS");
    if (ST) layer(ctx, "lab|" + s.cfg.sig, x0 - 14, y0 - 14, w + 28, h + 28, 1, (g) => {
      fil(g, (c) => rr(c, x0, y0, w, h, 14), "rgba(6,16,34,0.92)", 1);
      stk(g, (c) => rr(c, x0, y0, w, h, 14), col, 1.6, 0.8, 0.8);
      fil(g, (c) => rr(c, x0 + 14, y0 + 20, 5, h - 40, 2.5), col, 0.95);
      txt(L, g, head, x0 + 36, y0 + 42, { size: 14, weight: 700, font: L.FONT.mono, color: col, letterSpacing: 2.5 });
      const ix = x0 + 96, iy = y0 + 26 + (h - 26) / 2, k = clamp((h - 60) / 170, 0.6, 1);
      if (kind === "person") {
        L.person(g, ix - 6, iy + 78 * k, 160 * k, COL.steel, 0.9);
        fil(g, (c) => c.arc(ix + 32 * k, iy - 44 * k, 18, 0, TAU), "#0b2a1c", 1);
        stk(g, (c) => c.arc(ix + 32 * k, iy - 44 * k, 18, 0, TAU), COL.green, 2, 0.8, 1);
        checkMark(g, ix + 32 * k - 8, iy - 44 * k + 1, 16, COL.green, 1);
      } else if (kind === "updown") {
        const hl = 78 * k;
        stk(g, (c) => { c.moveTo(ix, iy - hl + 24); c.lineTo(ix, iy + hl - 24); }, col, 5, 1, 1, { cap: "butt" });
        arrowHead(g, ix, iy - hl, -Math.PI / 2, 30, col, 1); arrowHead(g, ix, iy + hl, Math.PI / 2, 30, col, 1);
      } else {
        stk(g, (c) => c.arc(ix, iy, 36, 0, TAU), col, 3, 1, 1);
        txt(L, g, "i", ix, iy + 15, { size: 42, weight: 700, font: L.FONT.head, color: col, align: "center" });
      }
      const top = y0 + 54 + (h - 54 - 20 - lay.lines.length * lay.lh) / 2 + lay.size * 0.86;
      lay.lines.forEach((ln, i) => txt(L, g, ln, x0 + 172, top + i * lay.lh, { size: lay.size, weight: 700, color: COL.white }));
    });
    if (LV) { const pu = 0.5 + 0.5 * Math.sin(t * 2.6); stk(ctx, (c) => rr(c, x0 + 14, y0 + 20, 5, h - 40, 2.5), col, 2, 1.4, 0.15 + 0.3 * pu); }
    GA = sG;
  }

  // ---------- Energie: Bewegungsenergie -> Wärme (panel2 = "energy") ----------
  function drawEnergy(ctx, L, s, ST) {
    if (!ST) return;
    const t = s.t, pa = s.cfg.plan.p2At, ap = smooth(inv(pa, pa + Math.min(0.7, 0.09 * s.d), t)); if (ap <= 0.01) return;
    const sG = GA; GA = sG * ap;
    const x0 = PX + (1 - easeOut(ap)) * 40, y0 = p2Y(s, P2H) ?? P2Y, w = PW, h = P2H, pr = s.pr, bx = x0 + 24, bw = w - 48, y1 = y0 + 94, y2 = y0 + 192, bh = 20;
    layer(ctx, "en|" + s.cfg.sig, x0 - 14, y0 - 14, w + 28, h + 28, 1, (g) => {
      fil(g, (c) => rr(c, x0, y0, w, h, 14), "rgba(6,16,34,0.9)", 1);
      stk(g, (c) => rr(c, x0, y0, w, h, 14), COL.cyan, 1.4, 0.5, 0.55);
      txt(L, g, "ENERGIE BEIM FANGEN", x0 + 24, y0 + 34, { size: 13, weight: 700, font: L.FONT.mono, color: COL.muted, letterSpacing: 1.5 });
      txt(L, g, "Bewegungsenergie", bx, y1 - 12, { size: 21, weight: 600, color: COL.white });
      txt(L, g, "Wärme in Keilen und Schiene", bx, y2 - 12, { size: 21, weight: 600, color: COL.white });
      for (const yy of [y1, y2]) { fil(g, (c) => rr(c, bx, yy, bw, bh, 5), "rgba(63,210,255,0.05)", 1); stk(g, (c) => rr(c, bx, yy, bw, bh, 5), COL.cyan, 1, 0, 0.3); }
      txt(L, g, "Wärme = Bewegungs- + Lageenergie der Bremsstrecke", x0 + w - 24, y0 + h - 16, { size: 14, weight: 400, color: COL.muted, align: "right" });
    });
    const ek0 = (pr.vC * pr.vC) / 2, eTot = ek0 + (GN * pr.sStop) / 1000, ekv = (s.v * s.v) / 2;
    const fk = clamp(ekv / ek0), fq = s.contact ? clamp((ek0 - ekv + (GN * Math.max(0, s.xmm)) / 1000) / eTot) : 0;
    if (fk > 0.003) { fil(ctx, (c) => rr(c, bx + 2, y1 + 2, (bw - 4) * fk, bh - 4, 3), COL.cyan, 0.9); dot(ctx, bx + 2 + (bw - 4) * fk, y1 + bh / 2, 22, COL.cyan, 0.5); }
    if (fq > 0.003) {
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, COL.red); g.addColorStop(0.55, COL.amber); g.addColorStop(1, COL.hot);
      fil(ctx, (c) => rr(c, bx + 2, y2 + 2, (bw - 4) * fq, bh - 4, 3), g, 0.95);
      dot(ctx, bx + 2 + (bw - 4) * fq, y2 + bh / 2, 26, COL.amber, 0.35 + 0.5 * s.heat);
    }
    // Umwandlung durch Reibung: laufende Pfeile zwischen den Balken
    const fa = s.phase === "brake" ? clamp(0.45 + s.power) : s.contact ? 0.3 : 0.12, xm = bx + bw * 0.5;
    stxt(L, ctx, "Reibung", xm + 20, y1 + bh + 34, { size: 16, weight: 600, color: COL.amber, alpha: 0.4 + 0.6 * fa });
    fil(ctx, (c) => { for (let k = 0; k < 3; k++) { const f = s.phase === "brake" ? (k / 3 + t * 1.4) % 1 : k / 3 + 0.12, y = y1 + bh + 12 + f * 30; c.moveTo(xm, y + 7); c.lineTo(xm - 7, y - 3); c.lineTo(xm + 7, y - 3); c.closePath(); } }, COL.amber, fa);
    GA = sG;
  }

  // ---------- Draufsicht T-Profil + Einbaulage ----------
  function drawPanel2(ctx, L, s, ST, LV) {
    const m = s.cfg.panel2;
    if (m === "label") drawLabelCard(ctx, L, s, ST, LV);
    else if (m === "energy") drawEnergy(ctx, L, s, ST);
    else if (m === "topview") drawTopview(ctx, L, s, ST, LV);
  }
  function drawTopview(ctx, L, s, ST, LV) {
    const t = s.t, pa = s.cfg.plan.p2At, ap = smooth(inv(pa, pa + Math.min(0.7, 0.09 * s.d), t)); if (ap <= 0.01) return;
    const sG = GA; GA = sG * ap;
    const x0 = PX + (1 - easeOut(ap)) * 40, y0 = p2Y(s, P2H) ?? P2Y, w = PW, h = P2H;
    const m = 1.5, yc = y0 + 140;
    const fx0 = x0 + 44, fx1 = fx0 + 10 * m, bx1 = fx0 + 62 * m, bh = 8 * m, fh = 44.5 * m; // Fuß, Steg
    const hx0 = fx0 + 50, hx1 = bx1 + 26, hy = 44;
    const rx1 = x0 + 330, rx2 = x0 + 520; // Einbaulage: Schienen
    if (ST) layer(ctx, "p2|" + s.inst, x0 - 14, y0 - 14, w + 28, h + 28, 1, (g) => {
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
    let cf = 0;
    if (s.mode === "fall") cf = s.contact ? 0.55 + 0.45 * s.cf : smooth(inv(s.tm.tTrip, s.tm.tCon, t)) * 0.55;
    else if (s.mode === "lift") cf = s.contact ? 0.55 + 0.45 * s.cf : 0.55 * clamp(Math.abs(s.h) / (s.inst ? HC_I : HC_P));
    const gap = 5 * (1 - Math.min(1, cf / 0.55));
    const kx0 = hx0 + 8, kx1 = hx1 - 22, fy1 = y0 + 214;
    const jb = (c) => { for (const sg of [-1, 1]) { const yin = yc + sg * (bh + gap), yout = yc + sg * 29; c.rect(kx0, Math.min(yin, yout), kx1 - kx0, Math.abs(yout - yin)); } };
    if (ST) {
    fil(ctx, jb, "#3a2a10", 1); stk(ctx, jb, COL.amber, 1.6, 0.8, 1);

    if (s.contact) {
      const a = s.mode === "lift" ? 1 : smooth(inv(s.tm.tCon, s.tm.tCon + 0.3, t));
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
    }
    if (!LV) { GA = sG; return; }
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
  // Standphase: alles Unbewegte als ein Sprite, darüber nur Glut, Scan, Puls
  function holdKey(s) {
    if (s.mode === "normal" || s.t < s.cfg.plan.ready) return null;
    if (s.mode === "fall" && (s.phase !== "stop" || s.tau < 0.3)) return null;
    return "hold|" + s.cfg.sig;
  }
  function renderScene(ctx, P, L, s, ST, LV) {
    const t = s.t, MX = s.mx, hasR = s.cfg.panel || s.cfg.panel2 !== "none";
    GA = smooth(inv(0, Math.min(0.55, 0.1 * s.d), t));
    ctx.save(); ctx.translate(MX, 0);
    drawFX(ctx, s, t, ST, false);
    ctx.save(); ctx.translate(s.shx, s.shy);
    if (ST) {
      drawHousingBack(ctx, s);
      drawRail(ctx, P, s);
      drawTraceBase(ctx, s);
      drawMech(ctx, P, s);
      drawRope(ctx, s);
      drawTape(ctx, L, s);
      drawDirection(ctx, L, s);
    }
    ctx.restore();
    GA = 1;
    if (ST) drawCallouts(ctx, L, s);
    ctx.restore();
    if (ST) drawPanel1(ctx, L, s);
    drawPanel2(ctx, L, s, ST, false);
    if (LV) {
      GA = smooth(inv(0, Math.min(0.55, 0.1 * s.d), t));
      ctx.save(); ctx.translate(MX, 0);
      drawScan(ctx, t, hasR ? PX - 20 - MX : null);
      ctx.translate(s.shx, s.shy);
      drawTraceHeat(ctx, s);
      drawHeat(ctx, s);
      drawSparks(ctx, s);
      ctx.restore();
      GA = 1;
      drawPanel2(ctx, L, s, false, true);
    }
  }
  function render(ctx, p) {
    const L = p.L || CE.lib; if (!L) return;
    const d = Math.max(1, num(p.d, 8)), t = clamp(num(p.t, 0), 0, d);
    const cfg = getCfg(p.params, d), s = computeState(t, d, cfg), hk = holdKey(s);
    s.mx = shiftAt(cfg.plan, t);
    if (hk) {
      const HX = 80, HY = 16;
      const cv = sprite(hk, 1780, 1048, (g) => { g.translate(-HX, -HY); renderScene(g, pats(g), L, s, true, false); });
      if (cv) {
        // nur Bereiche mit Inhalt kopieren (spart Füllrate)
        const mx = Math.round(s.mx), R = [[80, 176, 1780, 740], [640 + mx, 16, 80, 160], [952 + mx, 16, 56, 160], [640 + mx, 916, 80, 148], [952 + mx, 916, 56, 148]];
        ctx.save(); ctx.globalAlpha = 1;
        for (const r of R) ctx.drawImage(cv, r[0] - HX, r[1] - HY, r[2], r[3], r[0], r[1], r[2], r[3]);
        ctx.restore();
      } else renderScene(ctx, pats(ctx), L, s, true, false);
      renderScene(ctx, pats(ctx), L, s, false, true);
    } else renderScene(ctx, pats(ctx), L, s, true, true);
    GA = 1;
  }

  CE.register("safety_gear", {
    ownsText: false,
    draw(ctx, p) {
      GA = 1;
      ctx.save();
      try { render(ctx, p || {}); } catch (e) { /* nie werfen – Szene bleibt leer statt Absturz */ }
      finally { ctx.restore(); GA = 1; }
    },
  });
})();
