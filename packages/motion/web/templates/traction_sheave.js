/* Template "traction_sheave" – Treibscheiben-Prinzip in Nahaufnahme (Röntgen-/Blueprint-Stil).
   Hauptbild (Schrägbild): Treibscheibe mit n Tragseilen in den Rillen, Motor axial dahinter, Kabine links, Gegengewicht
   rechts. Rechte Spalte: im Reibungsmodus Inset "Rillenquerschnitt" (Sitzrille mit Unterschnitt / Keilrille / Rundrille)
   + optional Inset "Handtuch über einer Stange"; im Waagemodus nur das Panel "Gewichtsausgleich" (Tafelwaage, Beladung,
   Gleichung, Merksatz) – grooves/inset werden dort ignoriert. Ruhelage (Waagemodus) = Endlage der Default-Fahrt
   aufwärts im Reibungsmodus -> nahtlose Überblendung zweier aufeinanderfolgender traction_sheave-Szenen.

   MODUS "Reibung" (show_balance:false)
     BEATS: [0] = Seile in den Rillen: Leuchtimpuls läuft über die Seile, Inset Rillenquerschnitt öffnet, Seile setzen sich
            [1] = Analogie-Inset "Handtuch über einer Stange" öffnet (nur mit inset:"towel_over_bar")
            [2] = Reibung: amber Reibungspfeile + Hitzepunkte an der Seil-Rillen-Berührung (Hauptbild + Insets) + Label
   MODUS "Waage" (show_balance:true, Default laut Spec)
     BEATS: [0] = Gegengewicht wird hervorgehoben (Tag), Panel "Gewichtsausgleich" öffnet
            [1] = leere Kabine wird hervorgehoben; Gleichung "Gegengewicht = …" beginnt (Teil vor dem "+")
            [2] = Beladung beginnt (load_from -> load_percent, Personen steigen zu, Waage pendelt), Rest der Gleichung
            [3] = Beladung erreicht (Ende der Rampe)
            [4] = Gegengewicht blinkt amber (nur mit blink_counterweight:true)
            [5] = "Motor bewegt nur die Differenz" (nur wenn difference_label nicht leer/false)
   Überschreibbar: grooves_at, towel_at, friction_at, balance_at, equation_at, blink_at, difference_at (Sekunden).
   values_at (Sekunden, Default = Öffnen des Panels): ab hier erscheinen die Ausgleichswerte im Panel – Schalen-Unterzeile
            "Kabine + 40–50 %" (vorher "Kabine + ?") sowie grünes Band, Marke und "Ausgleich …" auf der BELADUNG-Skala.
   "at" (Sekunden) akzeptieren: labels[] (Callouts im Hauptbild).
   Alle Zeiten werden auf [0,3 ; d−0,3] begrenzt. Ohne Beats skaliert das Default-Timing mit d. Einmal Sichtbares bleibt.

   Params:
     show_balance     bool (Default true)                 load_percent  0–100 (Default 50)   load_from  0–100 (Default 0)
     balance_percent  Gegengewicht = Kabine + X % Nennlast (Default 50)   balance_range  [40,50] (optional, Band auf der Skala)
     counterweight_label  Text nach "Gegengewicht =" (Default "leere Kabine + ca. 50 % Nennlast")
     blink_counterweight  bool (Default false)            difference_label  string | false (Default "Motor bewegt nur die Differenz")
     capacity_persons Personen bei 100 % (Default 8)      people  Personen in der Kabine im Reibungsmodus (Default 0)
     grooves          bool – Inset Rillenquerschnitt (Default !show_balance)
     groove_type      "undercut" (Sitzrille mit Unterschnitt, Default) | "v" (Keilrille) | "u" (Rundrille)
     inset            "towel_over_bar" | "none" (Default "none")
     friction_arrows  bool (Default !show_balance)        rope_count  3–8 (Default 5)
     speed            0–1,25 Drehung/Fahrweg (Default 1 im Reibungsmodus, 0 im Waagemodus)   direction  "up" | "down" (Kabine; Default "up")
     tags             bool – KABINE / GEGENGEWICHT / MOTOR-Beschriftung (Default true)
     labels           [string | {text, at, target, color, x, y}] – target: sheave|ropes|friction|car|counterweight|motor|grooves
                      (ohne target per Stichwort erkannt; x,y = Position der Box, optional; lange Texte werden umbrochen)
                      color: cyan|amber|red|green. Default Reibungsmodus: Treibscheibe, Tragseile, Reibung; Waagemodus: keine. */
(function () {
  "use strict";
  const CE = window.CE;
  if (!CE || typeof CE.register !== "function") return;

  const TAU = Math.PI * 2, D2R = Math.PI / 180;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, dur) => clamp((t - a) / Math.max(1e-6, dur));
  const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
  const easeInOut = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const easeOutBack = (x) => { x = clamp(x); const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const h01 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  const COL = { cyan: "#3fd2ff", amber: "#ffb347", red: "#ff5a5f", green: "#5be49b", white: "#eef6ff", muted: "#8fb3d9", steel: "#9fc4e6", rope: "#cfe9ff", hot: "#ffe3a8", navy: "#071429" };
  const RGB = {};
  const rgbOf = (hex) => { let c = RGB[hex]; if (!c) { const n = parseInt(hex.slice(1), 16); c = RGB[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; } return c; };
  const rgba = (hex, a) => { const c = rgbOf(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  const pctTxt = (v) => `${Math.round(v)} %`;
  const FH = "Oxanium", FB = "Inter", FM = "JetBrains Mono";

  // ---------- Geometrie Hauptbild (px) ----------
  const CX = 700, CY = 402, R = 160, RG = 152, AW = 120; // Scheibenmitte vorn, Seil-Teilkreis, Rillengrund, axiale Breite
  const DV = [0.56, -0.30];                                // Schrägbild: Tiefe z -> Bildversatz
  const DVL = Math.hypot(DV[0], DV[1]), PERP = [-DV[1] / DVL, DV[0] / DVL];
  const MOT = { z0: AW + 34, z1: AW + 250, r: 108 };
  const CAR = { w: 280, h: 200 }, CWT = { w: 100, h: 206 };
  // Ruhelage = Endlage der Default-Fahrt (aufwärts) -> nahtlose Überblendung Reibungs- -> Waageszene
  const CAR_REST = 622, CW_REST = 630, ANG_REST = 52 / 160;
  const COLX = 1240, COLW = 560, COLY0 = 205, COLY1 = 895; // rechte Spalte
  const pz = (z) => [CX + DV[0] * z, CY + DV[1] * z];

  // ---------- Zeichen-Helfer (Gruppen-Alpha GA) ----------
  let GA = 1;
  function stk(ctx, build, color, w, glow, alpha, o) {
    const a = GA * (alpha == null ? 1 : alpha); if (a <= 0.004) return;
    ctx.save(); ctx.lineCap = (o && o.cap) || "round"; ctx.lineJoin = "round"; ctx.strokeStyle = color;
    if (o && o.dash) { ctx.setLineDash(o.dash); ctx.lineDashOffset = o.off || 0; }
    ctx.beginPath(); build(ctx);
    if (glow > 0) { ctx.globalAlpha = a * Math.min(1, 0.09 * glow); ctx.lineWidth = w * 6; ctx.stroke(); ctx.globalAlpha = a * Math.min(1, 0.22 * glow); ctx.lineWidth = w * 2.8; ctx.stroke(); }
    ctx.globalAlpha = a; ctx.lineWidth = w; ctx.stroke(); ctx.restore();
  }
  function fil(ctx, build, color, alpha, rule) { const a = GA * (alpha == null ? 1 : alpha); if (a <= 0.004) return; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = color; ctx.beginPath(); build(ctx); ctx.fill(rule || "nonzero"); ctx.restore(); }
  function txt(ctx, s, x, y, o) {
    const a = GA * (o.alpha == null ? 1 : o.alpha); if (a <= 0.004 || !s) return;
    ctx.save(); ctx.globalAlpha = a; ctx.font = `${o.weight || 600} ${o.size || 24}px "${o.font || FB}"`;
    ctx.textAlign = o.align || "left"; ctx.textBaseline = "alphabetic";
    if (o.ls) ctx.letterSpacing = `${o.ls}px`;
    if (o.glow) { ctx.shadowColor = o.glowColor || o.color || COL.cyan; ctx.shadowBlur = o.glow; }
    ctx.fillStyle = o.color || COL.white; ctx.fillText(s, x, y); ctx.restore();
  }
  const MEAS = new Map();
  function meas(ctx, s, o) {
    const k = `${s}|${o.size}|${o.weight}|${o.font}|${o.ls || 0}`; let w = MEAS.get(k);
    if (w == null) { ctx.save(); ctx.font = `${o.weight || 600} ${o.size || 24}px "${o.font || FB}"`; if (o.ls) ctx.letterSpacing = `${o.ls}px`; w = ctx.measureText(s).width; ctx.restore(); if (MEAS.size > 400) MEAS.clear(); MEAS.set(k, w); }
    return w;
  }
  function wrapTxt(ctx, s, maxW, o) { const words = String(s).split(/\s+/).filter(Boolean); const out = []; let cur = ""; for (const w of words) { const tst = cur ? cur + " " + w : w; if (cur && meas(ctx, tst, o) > maxW) { out.push(cur); cur = w; } else cur = tst; } if (cur) out.push(cur); return out; }
  const rrect = (c, x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  const circB = (x, y, r) => (c) => { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); };
  function arrowHead(ctx, x, y, ang, size, color, alpha) {
    fil(ctx, (c) => { c.moveTo(x, y); c.lineTo(x - Math.cos(ang - 0.42) * size, y - Math.sin(ang - 0.42) * size); c.lineTo(x - Math.cos(ang + 0.42) * size, y - Math.sin(ang + 0.42) * size); c.closePath(); }, color, alpha);
  }
  function arrow(ctx, x1, y1, x2, y2, color, w, head, alpha) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    stk(ctx, (c) => { c.moveTo(x1, y1); c.lineTo(x2 - Math.cos(a) * head * 0.7, y2 - Math.sin(a) * head * 0.7); }, color, w, 0.8, alpha);
    arrowHead(ctx, x2, y2, a, head, color, alpha);
  }

  // ---------- Sprites ----------
  const SPR = new Map();
  function sprite(key, w, h, drawFn) {
    if (SPR.has(key)) return SPR.get(key);
    let cv = null;
    try {
      cv = document.createElement("canvas"); cv.width = Math.max(1, Math.ceil(w)); cv.height = Math.max(1, Math.ceil(h));
      const g = cv.getContext("2d");
      if (!g) cv = null; else { const sG = GA; GA = 1; try { drawFn(g); } finally { GA = sG; } }
    } catch (e) { cv = null; }
    if (SPR.size > 80) SPR.clear();
    SPR.set(key, cv);
    return cv;
  }
  /** Statische Ebene in Welt-Koordinaten (x0,y0,w,h) – als Sprite oder Vektor-Rückfall. */
  function layer(ctx, key, x0, y0, w, h, alpha, drawFn) {
    const a = GA * alpha; if (a <= 0.004) return;
    const cv = sprite(key, w, h, (g) => { g.translate(-x0, -y0); drawFn(g); });
    if (cv) { ctx.save(); ctx.globalAlpha = a; ctx.drawImage(cv, x0, y0); ctx.restore(); }
    else { const sG = GA; GA = a; drawFn(ctx); GA = sG; }
  }
  function dotSprite(color) {
    return sprite("dot" + color, 64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, rgba(color, 1)); gr.addColorStop(0.22, rgba(color, 0.55)); gr.addColorStop(0.55, rgba(color, 0.14)); gr.addColorStop(1, rgba(color, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
  }
  function dot(ctx, x, y, r, color, alpha) {
    const a = GA * alpha; if (a <= 0.004 || r <= 0.5) return;
    const cv = dotSprite(color);
    ctx.save(); ctx.globalAlpha = a;
    if (cv) ctx.drawImage(cv, x - r, y - r, 2 * r, 2 * r);
    else { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r * 0.3, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  // ---------- Params ----------
  const bool = (v, def) => { if (v === undefined || v === null) return def; if (typeof v === "string") { const s = v.trim().toLowerCase(); return !["false", "0", "no", "nein", "off", "aus", "none", ""].includes(s); } return !!v; };
  const num = (v, def) => { if (v === undefined || v === null || v === "" || typeof v === "boolean") return def; const n = Number(v); return Number.isFinite(n) ? n : def; };
  const str = (v, def) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : def);
  const COLNAME = { cyan: COL.cyan, amber: COL.amber, red: COL.red, green: COL.green, white: COL.white, orange: COL.amber, blau: COL.cyan, rot: COL.red, gruen: COL.green, grün: COL.green };

  const CFG = new WeakMap();
  function config(P, d) {
    let c = CFG.get(P); if (c && c.d === d) return c;
    const ct = (x) => clamp(x, Math.min(0.3, d / 2), Math.max(d - 0.3, d / 2));
    const beatsIn = Array.isArray(P.beats) ? P.beats : [];
    const bt = (i, def) => { const v = beatsIn[i]; return ct(v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? def : Number(v)); };
    const atOr = (v, def) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? def : ct(Number(v)));
    const balance = bool(P.show_balance ?? P.balance, true);
    const n = Math.round(clamp(num(P.rope_count ?? P.ropes, 5), 3, 8));
    const insetS = String(P.inset ?? P.analogy ?? "none").toLowerCase();
    const towel = /towel|handtuch|stange|bar/.test(insetS) || bool(P.towel, false);
    const gtS = String(P.groove_type ?? P.groove ?? "undercut").toLowerCase();
    const gtype = /under|unter/.test(gtS) ? "undercut" : /^v|keil|wedge/.test(gtS) ? "v" : /^u|rund|round|sitz|semi/.test(gtS) ? "u" : "undercut";
    let speed = clamp(num(P.speed ?? P.rotation_speed, balance ? 0 : 1), 0, 1.25);
    if (P.rotate === false || P.rotating === false) speed = 0;
    const dirS = String(P.direction ?? "up").toLowerCase();
    const dir = /down|ab|runter/.test(dirS) ? -1 : 1;
    const bal = clamp(num(P.balance_percent ?? P.counterweight_percent, 50), 0, 100);
    const loadTo = clamp(num(P.load_percent ?? P.load, 50), 0, 100);
    const loadFrom = clamp(num(P.load_from, balance ? 0 : loadTo), 0, 100);
    let range = null;
    if (Array.isArray(P.balance_range) && P.balance_range.length >= 2) { const a = clamp(num(P.balance_range[0], bal), 0, 100), b = clamp(num(P.balance_range[1], bal), 0, 100); range = [Math.min(a, b), Math.max(a, b)]; }
    c = { d, balance, n, towel, gtype, speed, dir, bal, loadTo, loadFrom, range };
    c.grooves = bool(P.grooves ?? P.groove_inset, !balance);
    c.friction = bool(P.friction_arrows ?? P.friction, !balance);
    c.tags = bool(P.tags, true);
    c.cap = Math.round(clamp(num(P.capacity_persons ?? P.persons_max ?? P.capacity, 8), 1, 12));
    c.people = Math.round(clamp(num(P.people ?? P.persons, 0), 0, c.cap));
    c.cwLabel = str(P.counterweight_label, `leere Kabine + ca. ${Math.round(bal)} % Nennlast`);
    c.blink = bool(P.blink_counterweight ?? P.blink, false);
    const dl = P.difference_label;
    c.diffLabel = dl === false || dl === null ? "" : str(dl, balance ? "Motor bewegt nur die Differenz" : "");
    c.zs = Array.from({ length: n }, (_, i) => (AW * (i + 0.5)) / n);
    c.travel = 52 * speed;
    if (balance) {
      const b0 = bt(0, 0.12 * d), b1 = bt(1, Math.max(b0 + 0.3, 0.27 * d)), b2 = bt(2, Math.max(b1 + 0.3, 0.37 * d));
      const b3 = Math.max(b2 + 0.2, bt(3, b2 + clamp(0.2 * d, 1.2, 3)));
      const b4 = bt(4, Math.max(b3 + 0.3, 0.66 * d)), b5 = bt(5, Math.max(b4 + 0.3, 0.8 * d));
      c.B = [b0, b1, b2, b3, b4, b5];
      c.tBal = atOr(P.balance_at, b0); c.tVal = atOr(P.values_at, c.tBal); c.tCw = b0; c.tCar = b1; c.tEq1 = atOr(P.equation_at, b1); c.tEq2 = b2;
      c.tLoad0 = b2; c.tLoad1 = b3; c.tBlink = atOr(P.blink_at, b4); c.tDiff = atOr(P.difference_at, b5);
      c.tGroove = atOr(P.grooves_at, b0); c.tTowel = atOr(P.towel_at, b1); c.tFric = atOr(P.friction_at, b1);
      c.tRopes = c.tGroove;
    } else {
      const b0 = bt(0, Math.max(0.6, 0.2 * d)), b1 = bt(1, Math.max(b0 + 0.3, 0.45 * d)), b2 = bt(2, Math.max(b1 + 0.3, 0.7 * d));
      c.B = [b0, b1, b2];
      c.tGroove = atOr(P.grooves_at, b0); c.tRopes = b0; c.tTowel = atOr(P.towel_at, b1); c.tFric = atOr(P.friction_at, b2);
      c.tBal = atOr(P.balance_at, b1); c.tVal = atOr(P.values_at, c.tBal); c.tCw = -1; c.tCar = -1; c.tEq1 = c.tBal + 0.3; c.tEq2 = c.tBal + 0.6;
      c.tLoad0 = c.tBal; c.tLoad1 = c.tBal; c.tBlink = atOr(P.blink_at, b2); c.tDiff = atOr(P.difference_at, b2);
    }
    // Callouts
    let labels;
    if (Array.isArray(P.labels)) labels = P.labels;
    else if (P.labels === false || P.labels === "none") labels = [];
    else labels = balance ? [] : [
      { text: "Treibscheibe", target: "sheave", at: Math.max(0.35, c.tRopes - 0.6) },
      { text: "Tragseile", target: "ropes", at: c.tRopes },
    ].concat(c.friction ? [{ text: "Reibung", target: "friction", at: c.tFric, color: "amber" }] : []);
    c.labels = labels.map((l, i) => {
      const o = typeof l === "string" || typeof l === "number" ? { text: String(l) } : l && typeof l === "object" ? l : { text: "" };
      const text = str(o.text ?? o.label, "");
      let target = String(o.target ?? "").toLowerCase();
      if (!target) {
        const s = text.toLowerCase();
        target = /reibung|friction|haftreib/.test(s) ? "friction" : /seil|rope/.test(s) ? "ropes" : /gegengew|counter/.test(s) ? "counterweight" : /kabine|fahrkorb|car/.test(s) ? "car" : /motor|antrieb/.test(s) ? "motor" : /rille|groove/.test(s) ? "grooves" : "sheave";
      }
      const at = o.at === undefined || o.at === null || !Number.isFinite(Number(o.at)) ? ct(Math.max(0.4, c.B[0]) + i * 0.5) : ct(Number(o.at));
      const color = COLNAME[String(o.color || "").toLowerCase()] || (target === "friction" || target === "counterweight" ? COL.amber : COL.cyan);
      return { text, target, at, color, x: num(o.x, NaN), y: num(o.y, NaN) };
    }).filter((l) => l.text);
    // rechte Spalte: Stapel
    const slots = [];
    if (balance) slots.push({ k: "balance", h: 690 }); // Waage belegt die ganze rechte Spalte
    else {
      if (c.grooves) slots.push({ k: "grooves", h: 340 });
      if (c.towel) slots.push({ k: "towel", h: 312 });
    }
    const gap = 26; const tot = slots.reduce((s, q) => s + q.h, 0) + gap * Math.max(0, slots.length - 1);
    const sc = Math.min(1, (COLY1 - COLY0) / Math.max(1, tot));
    let y = COLY0 + Math.max(0, ((COLY1 - COLY0) - tot * sc) / 2);
    if (slots.length === 1 && slots[0].k !== "balance") y = COLY0 + 30;
    for (const q of slots) { q.y = y; q.s = sc; q.x = COLX + (COLW - COLW * sc) / 2; y += (q.h + gap) * sc; }
    c.slots = slots;
    c.carX = CX - R + DV[0] * AW / 2 - CAR.w / 2;
    c.cwX = CX + R + DV[0] * AW / 2 - CWT.w / 2;
    CFG.set(P, c);
    return c;
  }

  // ---------- Bewegung ----------
  function travelAt(c, t) {
    if (c.travel <= 0) return 0;
    const ta = 0.8, v = c.travel / Math.max(0.5, c.d - ta / 2);
    return t < ta ? (v * t * t) / (2 * ta) : v * (t - ta / 2);
  }

  // ---------- Hauptbild: statische Ebene (Motor, Scheibenkörper, Rillen) ----------
  function drawMachineStatic(g, c) {
    const hull = (q0, q1, r) => (cc) => { cc.moveTo(q0[0] + PERP[0] * r, q0[1] + PERP[1] * r); cc.lineTo(q1[0] + PERP[0] * r, q1[1] + PERP[1] * r); cc.arc(q1[0], q1[1], r, Math.atan2(PERP[1], PERP[0]), Math.atan2(-PERP[1], -PERP[0]), true); cc.lineTo(q0[0] - PERP[0] * r, q0[1] - PERP[1] * r); cc.arc(q0[0], q0[1], r, Math.atan2(-PERP[1], -PERP[0]), Math.atan2(PERP[1], PERP[0]), true); cc.closePath(); };
    const sil = (q0, q1, r) => (cc) => { cc.moveTo(q0[0] + PERP[0] * r, q0[1] + PERP[1] * r); cc.lineTo(q1[0] + PERP[0] * r, q1[1] + PERP[1] * r); cc.moveTo(q0[0] - PERP[0] * r, q0[1] - PERP[1] * r); cc.lineTo(q1[0] - PERP[0] * r, q1[1] - PERP[1] * r); };
    const aP = Math.atan2(PERP[1], PERP[0]), aN = aP + Math.PI; // Silhouetten-Winkel
    // Motor (axial hinter der Scheibe, deckend)
    const m0 = pz(MOT.z0), m1 = pz(MOT.z1), mr = MOT.r;
    fil(g, hull(m0, m1, mr), "#081a33", 0.97);
    fil(g, hull(m0, m1, mr), COL.steel, 0.05);
    for (let f = 0.16; f < 0.95; f += 0.16) { const q = pz(lerp(MOT.z0, MOT.z1, f)); stk(g, (cc) => cc.arc(q[0], q[1], mr, aN + 0.02, aP + TAU - 0.02), COL.steel, 1.1, 0, 0.22); }
    stk(g, (cc) => cc.arc(m1[0], m1[1], mr, aN, aP + TAU), COL.steel, 1.8, 0.4, 0.7);
    stk(g, (cc) => cc.arc(m1[0], m1[1], mr * 0.32, aN, aP + TAU), COL.steel, 1.3, 0, 0.45);
    stk(g, sil(m0, m1, mr), COL.steel, 2, 0.5, 0.75);
    stk(g, circB(m0[0], m0[1], mr), COL.steel, 2, 0.5, 0.7);
    // Welle zwischen Scheibe und Motor
    const w0 = pz(AW - 4), w1 = pz(MOT.z0 + 2);
    fil(g, hull(w0, w1, 26), "#081a33", 1);
    stk(g, sil(w0, w1, 26), COL.steel, 1.6, 0, 0.7);
  }
  function drawSheaveStatic(g, c) {
    const hull = (q0, q1, r) => (cc) => { cc.moveTo(q0[0] + PERP[0] * r, q0[1] + PERP[1] * r); cc.lineTo(q1[0] + PERP[0] * r, q1[1] + PERP[1] * r); cc.arc(q1[0], q1[1], r, Math.atan2(PERP[1], PERP[0]), Math.atan2(-PERP[1], -PERP[0]), true); cc.lineTo(q0[0] - PERP[0] * r, q0[1] - PERP[1] * r); cc.arc(q0[0], q0[1], r, Math.atan2(-PERP[1], -PERP[0]), Math.atan2(PERP[1], PERP[0]), true); cc.closePath(); };
    const sil = (q0, q1, r) => (cc) => { cc.moveTo(q0[0] + PERP[0] * r, q0[1] + PERP[1] * r); cc.lineTo(q1[0] + PERP[0] * r, q1[1] + PERP[1] * r); cc.moveTo(q0[0] - PERP[0] * r, q0[1] - PERP[1] * r); cc.lineTo(q1[0] - PERP[0] * r, q1[1] - PERP[1] * r); };
    const aP = Math.atan2(PERP[1], PERP[0]), aN = aP + Math.PI;
    // Scheibenkörper (deckend gegen den Motor)
    const s0 = pz(0), s1 = pz(AW);
    fil(g, hull(s0, s1, R), "#092341", 0.96);
    fil(g, hull(s0, s1, R), COL.cyan, 0.04);
    stk(g, (cc) => cc.arc(s1[0], s1[1], R, aN - 0.02, aP + TAU + 0.02), COL.cyan, 1.6, 0.4, 0.5);
    stk(g, sil(s0, s1, R), COL.cyan, 2, 0.6, 0.75);
    // Rillengrund je Seil (nur im oberen Bereich, wo die Seile aufliegen)
    for (let i = 0; i < c.n; i++) { const q = pz(c.zs[i]); stk(g, (cc) => cc.arc(q[0], q[1], RG, Math.PI * 0.94, Math.PI * 2.06), COL.cyan, 1.1, 0, 0.32); }
    // Vorderseite: Kranz + Innenkante
    fil(g, circB(s0[0], s0[1], R), COL.navy, 0.5);
    stk(g, circB(s0[0], s0[1], R - 16), COL.cyan, 1.5, 0.3, 0.5);
    stk(g, circB(s0[0], s0[1], R), COL.cyan, 3, 1, 1);
  }
  const FS = 2 * (R - 14) + 8;
  function drawFace(g) { // lokale Koordinaten, Mitte (FS/2, FS/2), rotiert mit der Scheibe
    const m = FS / 2;
    for (let k = 0; k < 5; k++) { const a = (k * TAU) / 5; const x = m + Math.cos(a) * 95, y = m + Math.sin(a) * 95; stk(g, circB(x, y, 26), COL.cyan, 1.8, 0.5, 0.62); }
    stk(g, circB(m, m, 56), COL.cyan, 1.6, 0.4, 0.55);
    fil(g, circB(m, m, 30), COL.cyan, 0.08);
    stk(g, circB(m, m, 30), COL.cyan, 2.4, 0.8, 0.95);
    stk(g, circB(m, m, 12), COL.steel, 1.6, 0, 0.8);
    stk(g, (cc) => { cc.rect(m - 3.5, m - 16, 7, 6); }, COL.steel, 1.2, 0, 0.7);
    for (let k = 0; k < 6; k++) { const a = (k * TAU) / 6 + 0.3; stk(g, circB(m + Math.cos(a) * 41, m + Math.sin(a) * 41, 3.2), COL.steel, 1.2, 0, 0.7); }
    // Markierung am Kranz (zeigt die Drehung)
    stk(g, (cc) => { cc.moveTo(m + (R - 40), m); cc.lineTo(m + (R - 20), m); }, COL.amber, 3, 0.8, 0.9);
  }

  // ---------- Kabine / Gegengewicht (Sprites, lokal) ----------
  function drawCarStatic(g, c) {
    const w = CAR.w, h = CAR.h, ox = 24, oy = 64; // Sprite-Offset
    g.translate(ox, oy);
    fil(g, (cc) => cc.rect(0, 0, w, h), COL.cyan, 0.05);
    stk(g, (cc) => cc.rect(0, 0, w, h), COL.cyan, 2.6, 0.9, 1);
    stk(g, (cc) => { cc.moveTo(w / 2, 14); cc.lineTo(w / 2, h - 10); }, COL.cyan, 1.4, 0, 0.38, { dash: [9, 7] });
    stk(g, (cc) => { cc.moveTo(10, h * 0.5); cc.lineTo(w - 10, h * 0.5); }, COL.cyan, 1, 0, 0.14);
    stk(g, (cc) => { cc.moveTo(w * 0.25, 9); cc.lineTo(w * 0.75, 9); }, COL.cyan, 2, 0.5, 0.4);
    stk(g, (cc) => cc.rect(-12, -24, w + 24, 20), COL.steel, 1.8, 0.4, 0.8); // Tragrahmen (Querhaupt)
    stk(g, (cc) => cc.rect(-12, h, w + 24, 16), COL.steel, 1.8, 0.4, 0.8);
    stk(g, (cc) => { cc.moveTo(-12, -4); cc.lineTo(-12, h); cc.moveTo(w + 12, -4); cc.lineTo(w + 12, h); }, COL.steel, 1.4, 0, 0.55);
    fil(g, (cc) => { cc.rect(-22, h + 2, 10, 14); cc.rect(w + 12, h + 2, 10, 14); }, COL.amber, 0.85); // Fangkeile
    fil(g, (cc) => { cc.rect(-22, -20, 10, 14); cc.rect(w + 12, -20, 10, 14); }, COL.steel, 0.55); // Führungsschuhe
    // Seilschlösser über dem Querhaupt
    for (let i = 0; i < c.n; i++) {
      const x = CX - R + DV[0] * c.zs[i] - c.carX;
      stk(g, (cc) => rrect(cc, x - 4, -54, 8, 26, 2), COL.steel, 1.4, 0, 0.8);
      stk(g, (cc) => { cc.moveTo(x, -28); cc.lineTo(x, -24); }, COL.steel, 1.4, 0, 0.8);
    }
  }
  function drawCwStatic(g, c) {
    const w = CWT.w, h = CWT.h, ox = 24, oy = 44;
    g.translate(ox, oy);
    fil(g, (cc) => cc.rect(0, 0, w, h), COL.amber, 0.06);
    stk(g, (cc) => cc.rect(0, 0, w, h), COL.amber, 2.6, 0.9, 1);
    for (let y = 22; y < h - 8; y += 17) stk(g, (cc) => { cc.moveTo(10, y); cc.lineTo(w - 10, y); }, COL.amber, 1.4, 0, 0.4);
    stk(g, (cc) => cc.rect(-8, -14, w + 16, 14), COL.steel, 1.6, 0.3, 0.75);
    fil(g, (cc) => { cc.rect(-18, 6, 10, 14); cc.rect(w + 8, 6, 10, 14); cc.rect(-18, h - 22, 10, 14); cc.rect(w + 8, h - 22, 10, 14); }, COL.steel, 0.5);
    for (let i = 0; i < c.n; i++) {
      const x = CX + R + DV[0] * c.zs[i] - c.cwX;
      stk(g, (cc) => rrect(cc, x - 4, -40, 8, 24, 2), COL.steel, 1.4, 0, 0.8);
    }
  }
  function person(ctx, x, y, h, color, alpha) { // Silhouette (ohne Gesicht), Füße bei y
    const s = h / 180, a = GA * alpha; if (a <= 0.004) return;
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(x + 15 * s, y - 165 * s); ctx.arc(x, y - 165 * s, 15 * s, 0, TAU);
    rrect(ctx, x - 22 * s, y - 145 * s, 44 * s, 75 * s, 12 * s);
    ctx.rect(x - 20 * s, y - 75 * s, 16 * s, 75 * s); ctx.rect(x + 4 * s, y - 75 * s, 16 * s, 75 * s);
    ctx.fill(); ctx.restore();
  }
  const SLOT = [0.5, 0.3, 0.7, 0.14, 0.86, 0.4, 0.6, 0.22, 0.78, 0.5, 0.33, 0.67];

  // ---------- Seile ----------
  function ropeBuild(c, i, carTop, cwTop) {
    const yCar = carTop - 24 - 54, yCw = cwTop - 14 - 40;
    const q = pz(c.zs[i]); const xL = q[0] - R, xR = q[0] + R;
    return (cc) => { cc.moveTo(xL, yCar); cc.lineTo(xL, q[1]); cc.arc(q[0], q[1], R, Math.PI, TAU); cc.lineTo(xR, yCw); };
  }
  function ropeBase(ctx, c, carTop, cwTop, s) {
    for (let i = c.n - 1; i >= 0; i--) {
      const build = ropeBuild(c, i, carTop, cwTop), depthA = 1 - 0.3 * (i / Math.max(1, c.n - 1));
      stk(ctx, build, COL.cyan, 11, 0, 0.13 * depthA, { cap: "butt" });
      stk(ctx, build, COL.rope, 5.5, 0, 0.95 * depthA, { cap: "butt" });
      stk(ctx, build, COL.navy, 5.5, 0, 0.24, { dash: [2, 6], off: -s, cap: "butt" });
      stk(ctx, build, "#ffffff", 1.2, 0, 0.35 * depthA, { cap: "butt" });
    }
  }
  function drawRopes(ctx, c, t, carTop, cwTop, s, hiRopes, fr) {
    if (c.travel <= 0) layer(ctx, `ropes|${c.n}|${Math.round(carTop)}|${Math.round(cwTop)}`, 500, 170, 470, Math.max(carTop, cwTop) - 60, 1, (g) => ropeBase(g, c, carTop, cwTop, 0));
    else ropeBase(ctx, c, carTop, cwTop, s);
    for (let i = c.n - 1; i >= 0; i--) {
      const q = pz(c.zs[i]), depthA = 1 - 0.3 * (i / Math.max(1, c.n - 1));
      // Reibungs-Tönung im Umschlingungsbogen
      if (fr > 0) stk(ctx, (cc) => cc.arc(q[0], q[1], R, Math.PI, TAU), COL.amber, 4.5, 0.9, 0.42 * fr * depthA, { cap: "butt" });
      // Leuchtimpuls (Beat 0): läuft über den Umschlingungsbogen
      if (hiRopes > 0 && hiRopes < 1) {
        const a0 = Math.PI + (hiRopes * 1.3 - 0.3) * Math.PI - 0.45, a1 = a0 + 0.45;
        const lo = Math.max(Math.PI, a0), hi = Math.min(TAU, a1);
        if (hi > lo) stk(ctx, (cc) => cc.arc(q[0], q[1], R, lo, hi), COL.white, 4, 1.6, 0.9 * Math.sin(Math.PI * hiRopes));
      }
    }
  }

  // ---------- Callouts ----------
  function anchor(c, target, carTop, cwTop) {
    const qm = pz(AW / 2);
    switch (target) {
      case "ropes": return { px: CX - R + DV[0] * AW * 0.5, py: 505, lx: 470, ly: 505, al: "right" };
      case "friction": { const a = -36 * D2R; return { px: qm[0] + Math.cos(a) * R, py: qm[1] + Math.sin(a) * R, lx: 1065, ly: 352, al: "left" }; }
      case "car": return { px: c.carX + 10, py: carTop + 70, lx: 390, ly: carTop + 70, al: "right" };
      case "counterweight": return { px: c.cwX + CWT.w, py: cwTop + 150, lx: 1000, ly: cwTop + 150, al: "left" };
      case "motor": { const q = pz(lerp(MOT.z0, MOT.z1, 0.8)); return { px: q[0] + 50, py: q[1] - 40, lx: 1070, ly: 250, al: "left" }; }
      case "grooves": { const a = -118 * D2R; return { px: qm[0] + Math.cos(a) * R, py: qm[1] + Math.sin(a) * R, lx: 470, ly: 226, al: "right" }; }
      default: { const a = 212 * D2R; return { px: CX + Math.cos(a) * R, py: CY + Math.sin(a) * R, lx: 470, ly: 318, al: "right" }; }
    }
  }
  function callout(ctx, t, l, an, rightLimit) {
    const p = seg(t, l.at, 0.6); if (p <= 0) return;
    let lx = Number.isFinite(l.x) ? l.x : an.lx; const ly = Number.isFinite(l.y) ? l.y : an.ly;
    const al = Number.isFinite(l.x) ? (l.x < an.px ? "right" : "left") : an.al;
    const col = l.color, pulse = 0.75 + 0.25 * Math.sin(t * 3.1 + l.at * 2);
    const o = { size: 28, weight: 600, font: FB };
    const avail = al === "left" ? rightLimit - (an.px + 30) - 34 : an.px - 30 - 90 - 34;
    const wrapW = clamp(Math.min(400, avail), 170, 400);
    const lines = meas(ctx, l.text, o) > wrapW ? wrapTxt(ctx, l.text, wrapW, o).slice(0, 3) : [l.text];
    const w = Math.max(...lines.map((ln) => meas(ctx, ln, o))) + 34, h = 46 + (lines.length - 1) * 34;
    if (al === "left") lx = Math.max(Math.min(lx, rightLimit - w), an.px + 30);
    else lx = Math.max(lx, 90 + w);
    dot(ctx, an.px, an.py, 16, col, easeOut(p) * pulse);
    fil(ctx, circB(an.px, an.py, 4), col, easeOut(p));
    const lp = easeOut(seg(p, 0, 0.4));
    stk(ctx, (cc) => { cc.moveTo(an.px, an.py); cc.lineTo(lerp(an.px, lx, lp), lerp(an.py, ly, lp)); }, col, 1.6, 0.6, 0.9 * easeOut(p));
    const tp = seg(p, 0.25, 0.5); if (tp <= 0) return;
    const bw = w * easeOut(tp), bx = al === "right" ? lx - bw : lx, by = ly - h / 2;
    fil(ctx, (cc) => rrect(cc, bx, by, bw, h, 7), "#061426", 0.86 * tp);
    stk(ctx, (cc) => rrect(cc, bx, by, bw, h, 7), col, 1.4, 0.5, 0.75 * tp);
    fil(ctx, (cc) => cc.rect(al === "right" ? bx + bw - 4 : bx, by + 8, 4, h - 16), col, tp);
    const ta = seg(p, 0.35, 0.4);
    lines.forEach((ln, i) => txt(ctx, ln, al === "right" ? lx - w + 17 : lx + 17, by + 33 + i * 34, { ...o, color: COL.white, alpha: ta }));
  }

  // ---------- Panel-Rahmen ----------
  function panelFrame(g, w, h, title, accent) {
    fil(g, (cc) => rrect(cc, 0, 0, w, h, 12), "#061427", 0.88);
    stk(g, (cc) => rrect(cc, 0, 0, w, h, 12), accent || COL.cyan, 1.4, 0.5, 0.45);
    const k = 16; // Ecken-Marken
    stk(g, (cc) => { cc.moveTo(6, 6 + k); cc.lineTo(6, 6); cc.lineTo(6 + k, 6); cc.moveTo(w - 6 - k, h - 6); cc.lineTo(w - 6, h - 6); cc.lineTo(w - 6, h - 6 - k); }, accent || COL.cyan, 2, 0.6, 0.8);
    if (title) txt(g, title, 26, 40, { size: 17, weight: 700, font: FM, color: COL.muted, ls: 3 });
  }
  function panelOpen(ctx, t, t0, x, y, s, w, h) { // gibt Alpha zurück und setzt Transform (Aufruf in save/restore)
    const a = easeOut(seg(t, t0, 0.5));
    const dx = (1 - a) * 36;
    ctx.translate(x + dx, y); ctx.scale(s, s);
    return a;
  }

  // ---------- Inset: Rillenquerschnitt ----------
  function grooveGeom(c) {
    const n = c.n, pitch = 470 / n, r = Math.min(36, pitch * 0.36), YC = 176;
    const xs = Array.from({ length: n }, (_, i) => 280 + (i - (n - 1) / 2) * pitch);
    let sy, contacts;
    if (c.gtype === "v") { sy = YC - 0.12 * r; contacts = [18, 162]; }
    else if (c.gtype === "u") { sy = YC + 0.15 * r; contacts = [62, 90, 118]; }
    else { sy = YC + 0.15 * r; contacts = [52, 128]; }
    return { n, pitch, r, YC, xs, sy, contacts, YB: Math.min(288, YC + Math.max(3.0 * r, 86)) };
  }
  function rimPath(c, G) {
    const { r, YC, xs, sy, YB } = G; const X0 = 34, X1 = 526;
    return (cc) => {
      cc.moveTo(X0, YB); cc.lineTo(X0, sy + 4); cc.lineTo(X0 + 4, sy);
      for (const xc of xs) {
        if (c.gtype === "v") {
          cc.lineTo(xc - 1.09 * r, sy); cc.lineTo(xc - 0.72 * r, YC + 1.02 * r);
          cc.ellipse(xc, YC + 1.02 * r, 0.72 * r, 0.3 * r, 0, Math.PI, 0, true);
          cc.lineTo(xc + 1.09 * r, sy);
        } else {
          const rg = 1.08 * r, gc = YC + 0.06 * r, dy = sy - gc, ax = Math.sqrt(rg * rg - dy * dy);
          const aL = Math.atan2(dy, -ax), aR = Math.atan2(dy, ax);
          cc.lineTo(xc - ax, sy);
          if (c.gtype === "u") cc.arc(xc, gc, rg, aL, aR, true);
          else {
            const a1 = 137.5 * D2R, a2 = 42.5 * D2R, hw = rg * Math.cos(a2);
            cc.arc(xc, gc, rg, aL, a1, true);
            cc.lineTo(xc - hw, YC + 1.08 * r);
            cc.ellipse(xc, YC + 1.08 * r, hw, 0.4 * r, 0, Math.PI, 0, true);
            cc.lineTo(xc + hw, gc + rg * Math.sin(a2));
            cc.arc(xc, gc, rg, a2, aR, true);
          }
        }
      }
      cc.lineTo(X1 - 4, sy); cc.lineTo(X1, sy + 4); cc.lineTo(X1, YB); cc.closePath();
    };
  }
  function drawGrooveStatic(g, c, G) {
    panelFrame(g, 560, 340, "RILLENQUERSCHNITT", COL.cyan);
    const path = rimPath(c, G);
    fil(g, path, "#0d2a4a", 0.9);
    g.save(); g.beginPath(); path(g); g.clip();
    stk(g, (cc) => { for (let k = -400; k < 700; k += 12) { cc.moveTo(k, G.YB + 20); cc.lineTo(k + 240, G.YB - 220); } }, COL.steel, 1.1, 0, 0.38);
    g.restore();
    // Bruchkante unten
    stk(g, (cc) => { cc.moveTo(34, G.YB); for (let x = 34; x <= 526; x += 8) cc.lineTo(x, G.YB + Math.sin(x * 0.09) * 3.5); }, COL.navy, 5, 0, 1);
    stk(g, (cc) => { cc.moveTo(34, G.YB); for (let x = 34; x <= 526; x += 8) cc.lineTo(x, G.YB + Math.sin(x * 0.09) * 3.5); }, COL.steel, 1.2, 0, 0.6);
    // Mittellinien der Rillen
    for (const xc of G.xs) stk(g, (cc) => { cc.moveTo(xc, G.YC - G.r - 14); cc.lineTo(xc, G.YB - 6); }, COL.cyan, 1, 0, 0.22, { dash: [10, 4, 2, 4] });
  }
  function drawRopeSection(g, r) { // lokal, Mitte (r+6, r+6)
    const m = r + 6;
    fil(g, circB(m, m, r), "#0a2038", 0.95);
    const sr = r / 3;
    for (let k = 0; k < 6; k++) { const a = (k * TAU) / 6 + 0.26; const x = m + Math.cos(a) * sr * 2, y = m + Math.sin(a) * sr * 2; fil(g, circB(x, y, sr * 0.94), COL.rope, 0.14); stk(g, circB(x, y, sr * 0.94), COL.rope, 1.2, 0, 0.75); fil(g, circB(x, y, sr * 0.28), COL.rope, 0.55); }
    stk(g, circB(m, m, sr * 0.9), COL.muted, 1.2, 0, 0.6);
    stk(g, circB(m, m, r), COL.rope, 2, 0.6, 1);
  }
  function drawGrooveInset(ctx, c, t, slot) {
    const G = grooveGeom(c);
    ctx.save();
    const a = panelOpen(ctx, t, c.tGroove - 0.15, slot.x, slot.y, slot.s, 560, 340);
    if (a <= 0) { ctx.restore(); return; }
    const sG = GA; GA *= a;
    layer(ctx, `gr|${c.n}|${c.gtype}`, 0, 0, 560, 340, 1, (g) => drawGrooveStatic(g, c, G));
    const contour = () => layer(ctx, `grc|${c.n}|${c.gtype}`, 0, 0, 560, 340, 1, (g) => stk(g, rimPath(c, G), COL.cyan, 2, 0.8, 0.95));
    // Seile setzen sich in die Rillen
    const rs = sprite(`rs|${G.r.toFixed(2)}`, 2 * G.r + 12, 2 * G.r + 12, (g) => drawRopeSection(g, G.r));
    const fr = c.friction ? easeOut(seg(t, c.tFric, 0.6)) : 0;
    for (let i = 0; i < G.n; i++) {
      const pi = seg(t, c.tGroove + 0.1 + i * 0.07, 0.55); if (pi <= 0) continue;
      const yOff = (1 - easeOutBack(pi)) * -70;
      const xc = G.xs[i], yc = G.YC + yOff;
      if (rs) { ctx.save(); ctx.globalAlpha = GA * clamp(pi * 3); ctx.drawImage(rs, xc - G.r - 6, yc - G.r - 6); ctx.restore(); }
      else stk(ctx, circB(xc, yc, G.r), COL.rope, 2, 0, clamp(pi * 3));
      const land = seg(t, c.tGroove + 0.1 + i * 0.07 + 0.3, 0.6);
      for (const ang of G.contacts) {
        const ca = ang * D2R, px = xc + Math.cos(ca) * G.r, py = G.YC + Math.sin(ca) * G.r;
        if (land > 0 && land < 1) dot(ctx, px, py, 16, COL.cyan, Math.sin(Math.PI * land));
        if (fr > 0) {
          const fl = 0.55 + 0.45 * Math.sin(t * 6.1 + i * 1.7 + ang);
          dot(ctx, px, py, 15, COL.amber, fr * fl);
          const nx = Math.cos(ca), ny = Math.sin(ca), L0 = G.r * 0.7, head = 9;
          arrow(ctx, px + nx * (L0 + 4), py + ny * (L0 + 4), px + nx * 4, py + ny * 4, COL.amber, 2.2, head, fr * 0.9);
        }
      }
    }
    contour();
    // Beschriftung
    const name = c.gtype === "v" ? "Keilrille" : c.gtype === "u" ? "Rundrille (Sitzrille)" : "Sitzrille mit Unterschnitt";
    txt(ctx, name, 26, 318, { size: 21, weight: 600, color: COL.white, alpha: seg(t, c.tGroove + 0.3, 0.5) });
    txt(ctx, "Seil", G.xs[0], G.YC - G.r - 12, { size: 16, weight: 600, color: COL.muted, align: "center", alpha: seg(t, c.tGroove + 0.6, 0.5) });
    if (fr > 0) txt(ctx, c.gtype === "u" ? "Reibung am Rillengrund" : "Reibung an den Flanken", 534, 318, { size: 21, weight: 700, color: COL.amber, align: "right", alpha: fr });
    GA = sG; ctx.restore();
  }

  // ---------- Inset: Handtuch über einer Stange ----------
  const TW = { bx: 280, by: 110, rb: 38, rt: 47, band: 15 };
  function drawTowelStatic(g) {
    panelFrame(g, 560, 312, "VERGLEICH: HANDTUCH ÜBER STANGE", COL.cyan);
    const { bx, by, rb } = TW;
    fil(g, circB(bx, by, rb), "#0d2a4a", 0.95);
    g.save(); g.beginPath(); g.arc(bx, by, rb, 0, TAU); g.clip();
    stk(g, (cc) => { for (let k = -80; k < 80; k += 10) { cc.moveTo(bx + k - 50, by + 50); cc.lineTo(bx + k + 50, by - 50); } }, COL.steel, 1, 0, 0.3);
    g.restore();
    stk(g, circB(bx, by, rb), COL.steel, 2.2, 0.6, 0.95);
    fil(g, circB(bx, by, 3), COL.steel, 0.9);
    stk(g, (cc) => { cc.moveTo(bx - rb - 22, by); cc.lineTo(bx + rb + 22, by); cc.moveTo(bx, by - rb - 16); cc.lineTo(bx, by + rb + 16); }, COL.steel, 1, 0, 0.28, { dash: [8, 4, 2, 4] });
  }
  function drawTowelInset(ctx, c, t, slot) {
    ctx.save();
    const a = panelOpen(ctx, t, c.tTowel - 0.1, slot.x, slot.y, slot.s, 560, 312);
    if (a <= 0) { ctx.restore(); return; }
    const sG = GA; GA *= a;
    layer(ctx, "towel2", 0, 0, 560, 312, 1, (g) => drawTowelStatic(g));
    const { bx, by, rt, band } = TW, grow = easeOut(seg(t, c.tTowel, 0.7));
    const sw = 0.03 * Math.sin(t * 1.6) * grow;
    const LL = 12 + 76 * grow, LR = 12 + 70 * grow;
    const xl = bx - rt, xr = bx + rt;
    const el = [xl + Math.sin(sw) * LL, by + Math.cos(sw) * LL], er = [xr + Math.sin(sw) * LR, by + Math.cos(sw) * LR];
    const build = (cc) => { cc.moveTo(el[0], el[1]); cc.lineTo(xl, by); cc.arc(bx, by, rt, Math.PI, TAU); cc.lineTo(er[0], er[1]); };
    stk(ctx, build, COL.rope, band + 3, 0, 0.95, { cap: "butt" });
    stk(ctx, build, "#0c2140", band - 1, 0, 1, { cap: "butt" });
    stk(ctx, build, COL.rope, band - 5, 0, 0.16, { cap: "butt" });
    stk(ctx, build, COL.rope, band - 1, 0, 0.3, { cap: "butt", dash: [1.4, 3.6] });
    // Zierstreifen + Fransen an beiden Enden
    for (const [e, x0] of [[el, xl], [er, xr]]) {
      const dx = e[0] - x0, dy = e[1] - by, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      for (const f of [16, 22]) { const cx0 = e[0] - ux * f, cy0 = e[1] - uy * f; stk(ctx, (cc) => { cc.moveTo(cx0 + uy * (band / 2 + 1), cy0 - ux * (band / 2 + 1)); cc.lineTo(cx0 - uy * (band / 2 + 1), cy0 + ux * (band / 2 + 1)); }, COL.cyan, 2, 0.4, 0.8); }
      stk(ctx, (cc) => { for (let k = -3; k <= 3; k++) { const x = e[0] + uy * k * 2.4, y = e[1] - ux * k * 2.4; cc.moveTo(x, y); cc.lineTo(x + ux * 9, y + uy * 9); } }, COL.rope, 1.1, 0, 0.75 * grow);
    }
    // Gewichte an beiden Enden (Klammer + Block), Beschriftung außen
    const wA = seg(t, c.tTowel + 0.3, 0.5);
    if (wA > 0) {
      const blocks = [[el, 74, 54, COL.cyan, "Kabine", -1], [er, 58, 66, COL.amber, "Gegengewicht", 1]];
      for (const [e, w, h, col, lab, side] of blocks) {
        const hx = e[0] + Math.sin(sw) * 12, hy = e[1] + 10;
        stk(ctx, (cc) => { cc.moveTo(e[0] - 8, e[1] - 4); cc.lineTo(e[0] + 8, e[1] - 4); cc.moveTo(e[0], e[1] - 4); cc.lineTo(hx, hy + 8); }, COL.steel, 1.8, 0, wA);
        const y0 = hy + 8 + (1 - easeOutBack(wA)) * -16;
        fil(ctx, (cc) => rrect(cc, hx - w / 2, y0, w, h, 4), col, 0.1 * wA);
        stk(ctx, (cc) => rrect(cc, hx - w / 2, y0, w, h, 4), col, 2.2, 0.8, wA);
        stk(ctx, (cc) => { for (let yy = y0 + 12; yy < y0 + h - 6; yy += 11) { cc.moveTo(hx - w / 2 + 7, yy); cc.lineTo(hx + w / 2 - 7, yy); } }, col, 1, 0, 0.35 * wA);
        txt(ctx, lab, hx + side * (w / 2 + 14), y0 + h / 2 + 7, { size: 20, weight: 700, color: col, align: side < 0 ? "right" : "left", alpha: wA });
      }
    }
    const fr = c.friction ? easeOut(seg(t, c.tFric, 0.6)) : 0;
    if (fr > 0) {
      stk(ctx, (cc) => cc.arc(bx, by, TW.rb + 1, Math.PI * 1.02, Math.PI * 1.98), COL.amber, 3, 1, 0.85 * fr);
      for (let k = 0; k < 7; k++) {
        const an = Math.PI + ((k + 0.5) / 7) * Math.PI, fl = 0.55 + 0.45 * Math.sin(t * 5.7 + k * 1.9);
        dot(ctx, bx + Math.cos(an) * (TW.rb + 1), by + Math.sin(an) * (TW.rb + 1), 14, COL.amber, fr * fl);
      }
      const lx = bx + rt + 70, ly = by - 12;
      stk(ctx, (cc) => { cc.moveTo(lx - 8, ly - 7); cc.lineTo(bx + 31, by - 25); }, COL.amber, 1.3, 0, 0.7 * fr);
      fil(ctx, circB(bx + 31, by - 25, 3), COL.amber, fr);
      txt(ctx, "Reibung", lx, ly, { size: 21, weight: 700, color: COL.amber, alpha: fr });
    }
    GA = sG; ctx.restore();
  }

  // ---------- Panel: Gewichtsausgleich (Waage) ----------
  function loadAt(c, t) { return lerp(c.loadFrom, c.loadTo, easeInOut(seg(t, c.tLoad0, Math.max(0.2, c.tLoad1 - c.tLoad0)))); }
  const MAXT = 13 * D2R;
  const tiltTarget = (c, L) => MAXT * clamp((c.bal - L) / 50, -1, 1); // + = rechte Schale (Gegengewicht) tiefer
  function beamAngle(c, t) {
    const t0 = c.tBal; if (t <= t0) return tiltTarget(c, c.loadFrom);
    const k = 30, damp = 2.4, dt = 1 / 90;
    let ph = tiltTarget(c, loadAt(c, t0)), w = 0, tt = t0;
    const steps = Math.min(3000, Math.ceil((t - t0) / dt));
    for (let i = 0; i < steps; i++) { const h = Math.min(dt, t - tt); if (h <= 0) break; const acc = k * (tiltTarget(c, loadAt(c, tt)) - ph) - damp * w; w += acc * h; ph += w * h; tt += h; }
    return ph;
  }
  const BP = { px: 280, py: 322, LB: 182 };
  function drawBalanceStatic(g) {
    panelFrame(g, 560, 690, "GEWICHTSAUSGLEICH", COL.amber);
    const { px, py } = BP;
    // Ständer
    fil(g, (cc) => { cc.moveTo(px - 13, py + 16); cc.lineTo(px + 13, py + 16); cc.lineTo(px + 9, py + 100); cc.lineTo(px - 9, py + 100); cc.closePath(); }, "#0d2a4a", 1);
    stk(g, (cc) => { cc.moveTo(px - 13, py + 16); cc.lineTo(px - 9, py + 100); cc.moveTo(px + 13, py + 16); cc.lineTo(px + 9, py + 100); }, COL.steel, 2, 0.4, 0.85);
    stk(g, (cc) => rrect(cc, px - 90, py + 100, 180, 12, 3), COL.steel, 2, 0.4, 0.85);
    fil(g, (cc) => { cc.moveTo(px, py - 2); cc.lineTo(px - 15, py + 20); cc.lineTo(px + 15, py + 20); cc.closePath(); }, COL.steel, 0.85);
    // Skala für den Zeiger
    const rs = 96;
    stk(g, (cc) => cc.arc(px, py, rs, -Math.PI / 2 - 0.34, -Math.PI / 2 + 0.34), COL.muted, 1.6, 0, 0.7);
    for (let k = -4; k <= 4; k++) { const a = -Math.PI / 2 + k * 0.08, l = k === 0 ? 18 : k % 2 ? 7 : 11; stk(g, (cc) => { cc.moveTo(px + Math.cos(a) * rs, py + Math.sin(a) * rs); cc.lineTo(px + Math.cos(a) * (rs + l), py + Math.sin(a) * (rs + l)); }, k === 0 ? COL.green : COL.muted, k === 0 ? 2.6 : 1.3, k === 0 ? 0.7 : 0, 0.85); }
  }
  function drawBalancePanel(ctx, c, t, slot, blink) {
    ctx.save();
    const a = panelOpen(ctx, t, c.tBal - 0.1, slot.x, slot.y, slot.s, 560, 690);
    if (a <= 0) { ctx.restore(); return; }
    const sG = GA; GA *= a;
    layer(ctx, "bal2", 0, 0, 560, 690, 1, (g) => drawBalanceStatic(g));
    const { px, py, LB } = BP;
    const phi = beamAngle(c, t), L = loadAt(c, t);
    const cs = Math.cos(phi), sn = Math.sin(phi);
    const eL = [px - LB * cs, py - LB * sn], eR = [px + LB * cs, py + LB * sn];
    // Zeiger
    const level = 1 - clamp(Math.abs(phi) / (2 * D2R));
    const pa = -Math.PI / 2 + phi;
    stk(ctx, (cc) => { cc.moveTo(px, py); cc.lineTo(px + Math.cos(pa) * 100, py + Math.sin(pa) * 100); }, level > 0.5 ? COL.green : COL.white, 2.6, 0.8 + level, 0.95);
    if (level > 0.5 && t > c.tLoad0) dot(ctx, px, py - 108, 22, COL.green, (level - 0.5) * 1.6 * (0.75 + 0.25 * Math.sin(t * 4)));
    // Balken
    stk(ctx, (cc) => { cc.moveTo(eL[0], eL[1]); cc.lineTo(eR[0], eR[1]); }, COL.steel, 8, 0.25, 0.95);
    stk(ctx, (cc) => { cc.moveTo(eL[0], eL[1]); cc.lineTo(eR[0], eR[1]); }, "#0a1c34", 3.5, 0, 0.95);
    fil(ctx, circB(px, py, 6.5), COL.white, 0.95);
    // Schalen (Tafelwaage: Stütze senkrecht, Schale bleibt waagerecht)
    const panY = (e) => e[1] - 42;
    for (const [e, col] of [[eL, COL.cyan], [eR, COL.amber]]) {
      stk(ctx, (cc) => { cc.moveTo(e[0], e[1]); cc.lineTo(e[0], panY(e)); }, COL.steel, 3, 0.4, 0.9);
      fil(ctx, (cc) => { cc.moveTo(e[0] - 76, panY(e)); cc.lineTo(e[0] + 76, panY(e)); cc.lineTo(e[0] + 60, panY(e) + 10); cc.lineTo(e[0] - 60, panY(e) + 10); cc.closePath(); }, col, 0.12);
      stk(ctx, (cc) => { cc.moveTo(e[0] - 76, panY(e)); cc.lineTo(e[0] + 76, panY(e)); cc.lineTo(e[0] + 60, panY(e) + 10); cc.lineTo(e[0] - 60, panY(e) + 10); cc.closePath(); }, col, 2, 0.6, 0.95);
      fil(ctx, circB(e[0], e[1], 4.5), COL.steel, 0.95);
    }
    // Kabine auf der linken Schale
    const hiCar = c.tCar >= 0 ? easeOut(seg(t, c.tCar, 0.4)) * (1 - 0.7 * seg(t, c.tCar + 1.4, 0.8)) : 0;
    { const w = 136, h = 118, x0 = eL[0] - w / 2, y0 = panY(eL) - h - 1;
      fil(ctx, (cc) => cc.rect(x0, y0, w, h), COL.cyan, 0.07 + 0.12 * hiCar);
      stk(ctx, (cc) => cc.rect(x0, y0, w, h), COL.cyan, 2.3, 0.8 + 1.2 * hiCar, 1);
      stk(ctx, (cc) => { cc.moveTo(x0 + w / 2, y0 + 8); cc.lineTo(x0 + w / 2, y0 + h - 6); }, COL.cyan, 1, 0, 0.3, { dash: [6, 5] });
      stk(ctx, (cc) => { cc.rect(x0 - 6, y0 - 12, w + 12, 10); }, COL.steel, 1.4, 0, 0.7);
      const np = (L / 100) * c.cap;
      for (let k = 0; k < c.cap; k++) { const v = clamp(np - k); if (v <= 0) break; person(ctx, x0 + 14 + (w - 28) * SLOT[k % SLOT.length], y0 + h - 4, 74 + (k % 3) * 3, COL.steel, 0.8 * v); }
    }
    // Gegengewicht auf der rechten Schale
    { const w = 74, h = 136, x0 = eR[0] - w / 2, y0 = panY(eR) - h - 1;
      const hc = c.tCw >= 0 ? easeOut(seg(t, c.tCw, 0.4)) * (1 - 0.6 * seg(t, c.tCw + 1.4, 0.8)) : 0;
      const hl = Math.max(hc, blink);
      fil(ctx, (cc) => cc.rect(x0, y0, w, h), COL.amber, 0.08 + 0.3 * hl);
      stk(ctx, (cc) => cc.rect(x0, y0, w, h), COL.amber, 2.3 + 1.2 * blink, 0.8 + 1.6 * hl, 1);
      stk(ctx, (cc) => { for (let yy = y0 + 15; yy < y0 + h - 6; yy += 14) { cc.moveTo(x0 + 9, yy); cc.lineTo(x0 + w - 9, yy); } }, COL.amber, 1, 0, 0.45);
      stk(ctx, (cc) => { cc.rect(x0 - 5, y0 - 11, w + 10, 9); }, COL.steel, 1.4, 0, 0.7);
    }
    // Schalen-Beschriftung
    const rangeTxt = c.range ? `${Math.round(c.range[0])}–${Math.round(c.range[1])} %` : pctTxt(c.bal);
    txt(ctx, "Kabine", px - LB, 460, { size: 22, weight: 700, color: COL.cyan, align: "center" });
    const loadTxt = L < 0.5 ? "leer" : `+ ${pctTxt(L)} Last`;
    txt(ctx, loadTxt, px - LB, 485, { size: 19, weight: 600, color: COL.white, align: "center" });
    txt(ctx, "Gegengewicht", px + LB, 460, { size: 22, weight: 700, color: COL.amber, align: "center" });
    // Ausgleichswerte erst ab values_at (Default = Panel öffnet -> unverändert); vorher Platzhalter "Kabine + ?"
    const vA = c.tVal <= c.tBal + 0.05 ? 1 : easeOut(seg(t, c.tVal, 0.5));
    if (vA >= 1) txt(ctx, `Kabine + ${rangeTxt}`, px + LB, 485, { size: 19, weight: 600, color: COL.white, align: "center" });
    else { // "Kabine + " steht fest, nur der Wert wechselt von "?" auf die Zahl
      const oS = { size: 19, weight: 600, font: FB }, pre = "Kabine + ";
      const wPre = meas(ctx, pre, oS), wVal = meas(ctx, rangeTxt, oS), x0 = px + LB - (wPre + wVal) / 2, xv = x0 + wPre;
      txt(ctx, pre, x0, 485, { ...oS, color: vA > 0 ? COL.white : COL.muted });
      txt(ctx, "?", xv, 485, { ...oS, color: COL.muted, alpha: 1 - vA });
      if (vA > 0) { dot(ctx, xv + wVal / 2, 479, 30, COL.green, 0.3 * Math.sin(Math.PI * vA)); txt(ctx, rangeTxt, xv, 485, { ...oS, color: COL.white, alpha: vA }); }
    }
    // Gleichung "Gegengewicht = …" (Teil vor dem "+" ab tEq1, Rest ab tEq2)
    const e1 = seg(t, c.tEq1, 0.45);
    if (e1 > 0 && c.cwLabel) {
      const full = c.cwLabel, pIdx = full.indexOf("+");
      const nA = pIdx > 0 ? pIdx : full.length;
      const e2 = pIdx > 0 ? seg(t, c.tEq2, 0.8) : 1;
      const nShow = Math.round(nA * clamp(e1 * 1.6) + (full.length - nA) * e2);
      const oH = { size: 24, weight: 700, font: FB };
      const head = "Gegengewicht =", hw = meas(ctx, head, oH);
      let oB = { size: 24, weight: 600, font: FB }, lh = 29;
      let lines = wrapTxt(ctx, full, 488, oB);
      if (lines.length > 2) { oB = { size: 20, weight: 600, font: FB }; lh = 24; lines = wrapTxt(ctx, full, 488, oB).slice(0, 3); }
      const one = meas(ctx, full, oB) <= 488 - hw - 10;
      fil(ctx, (cc) => cc.rect(24, 510, 4, one ? 40 : 30 + lh * lines.length), COL.amber, e1);
      if (one) {
        txt(ctx, head, 40, 540, { ...oH, color: COL.amber, alpha: e1 });
        txt(ctx, full.slice(0, nShow), 40 + hw + 10, 540, { ...oB, color: COL.white, alpha: e1 });
      } else {
        txt(ctx, head, 40, 530, { ...oH, color: COL.amber, alpha: e1 });
        let rem = nShow, yy = 530 + lh;
        for (const ln of lines) { if (rem <= 0) break; txt(ctx, ln.slice(0, rem), 40, yy, { ...oB, color: COL.white, alpha: e1 }); rem -= ln.length + 1; yy += lh; }
      }
    }
    // Beladungsskala
    const my = 642, mx0 = 40, mx1 = 520;
    const vis = easeOut(seg(t, c.tBal + 0.3, 0.5));
    if (vis > 0) {
      const sGl = GA; GA *= vis;
      txt(ctx, "BELADUNG", mx0, my - 14, { size: 15, weight: 700, font: FM, color: COL.muted, ls: 3 });
      txt(ctx, pctTxt(L), mx1, my - 11, { size: 22, weight: 700, font: FM, color: COL.white, align: "right" });
      fil(ctx, (cc) => rrect(cc, mx0, my, mx1 - mx0, 12, 6), "#0e2644", 1);
      if (c.range && vA > 0) fil(ctx, (cc) => cc.rect(lerp(mx0, mx1, c.range[0] / 100), my - 3, Math.max(3, (mx1 - mx0) * (c.range[1] - c.range[0]) / 100) * (0.4 + 0.6 * vA), 18), COL.green, 0.3 * vA);
      if (L > 0.2) fil(ctx, (cc) => rrect(cc, mx0, my, (mx1 - mx0) * L / 100, 12, 6), COL.cyan, 0.85);
      const bxm = lerp(mx0, mx1, c.bal / 100);
      if (vA > 0) {
        stk(ctx, (cc) => { cc.moveTo(bxm, my - 8); cc.lineTo(bxm, my + 20); }, COL.green, 2.4, 0.7, 0.95 * vA);
        const lvl = c.range ? `Ausgleich ${Math.round(c.range[0])}–${Math.round(c.range[1])} %` : `Ausgleich ${pctTxt(c.bal)}`;
        txt(ctx, lvl, clamp(bxm, 110, 450), my + 34, { size: 17, weight: 600, color: COL.green, align: "center", alpha: vA });
      }
      GA = sGl;
    }
    // Merksatz Differenz (oben im Panel)
    if (c.diffLabel) {
      const dA = easeOut(seg(t, c.tDiff, 0.6));
      if (dA > 0) {
        let o = { size: 22, weight: 700, font: FB };
        if (meas(ctx, c.diffLabel, o) > 490) o = { size: 18, weight: 700, font: FB };
        const lines = wrapTxt(ctx, c.diffLabel, 490, o).slice(0, 2), lh = o.size + 4;
        fil(ctx, (cc) => cc.rect(24, 64, 4, lh * lines.length + 2), COL.amber, dA);
        lines.forEach((ln, i) => txt(ctx, ln, 40, 83 + i * lh, { ...o, color: COL.amber, alpha: dA }));
      }
    }
    GA = sG; ctx.restore();
  }

  // ---------- Register ----------
  CE.register("traction_sheave", {
    draw(ctx, p) {
      const P = p.params && typeof p.params === "object" ? p.params : {};
      const d = Math.max(0.6, Number(p.d) || 6), t = Math.max(0, Number(p.t) || 0);
      const c = config(P, d);
      GA = 1;
      const sT = travelAt(c, t), rem = c.dir > 0 ? c.travel - sT : sT; // Abstand zur Ruhelage
      const carTop = CAR_REST + rem, cwTop = CW_REST - rem;
      const ang = ANG_REST - rem / R, s = c.dir * sT;
      const fr = c.friction ? easeOut(seg(t, c.tFric, 0.6)) : 0;

      // Maschine (statisch) + rotierende Scheibenfront
      layer(ctx, "motor", 656, 150, 394, 334, 1, (g) => drawMachineStatic(g, c));
      if (c.balance && c.diffLabel) { // Motor-Hervorhebung (Differenz)
        const dA = easeOut(seg(t, c.tDiff, 0.6));
        if (dA > 0) {
          const m0 = pz(MOT.z0), m1 = pz(MOT.z1), mr = MOT.r, aP = Math.atan2(PERP[1], PERP[0]);
          const pl = 0.75 + 0.25 * Math.sin(t * 3.2);
          stk(ctx, (cc) => { cc.moveTo(m0[0] + PERP[0] * mr, m0[1] + PERP[1] * mr); cc.lineTo(m1[0] + PERP[0] * mr, m1[1] + PERP[1] * mr); cc.arc(m1[0], m1[1], mr, aP, aP + Math.PI, true); cc.lineTo(m0[0] - PERP[0] * mr, m0[1] - PERP[1] * mr); }, COL.amber, 2.6, 1.6, dA * pl);
          fil(ctx, circB(m1[0], m1[1], mr), COL.amber, 0.08 * dA * pl);
        }
      }
      layer(ctx, `sheave|${c.n}`, 516, 196, 490, 390, 1, (g) => drawSheaveStatic(g, c));
      const face = sprite("face", FS, FS, (g) => drawFace(g));
      if (face) { ctx.save(); ctx.translate(CX, CY); ctx.rotate(ang); ctx.drawImage(face, -FS / 2, -FS / 2); ctx.restore(); }

      // Kabine + Gegengewicht
      const carS = sprite(`car|${c.n}`, CAR.w + 48, CAR.h + 64 + 30, (g) => drawCarStatic(g, c));
      if (carS) ctx.drawImage(carS, c.carX - 24, carTop - 64);
      const cwS = sprite(`cw|${c.n}`, CWT.w + 48, CWT.h + 44 + 10, (g) => drawCwStatic(g, c));
      if (cwS) ctx.drawImage(cwS, c.cwX - 24, cwTop - 44);
      // Personen
      const loadNow = c.balance ? loadAt(c, t) : (c.people / c.cap) * 100;
      const np = (loadNow / 100) * c.cap;
      for (let k = 0; k < c.cap; k++) {
        const v = clamp(np - k); if (v <= 0) break;
        const fx = SLOT[k % SLOT.length], x = c.carX + 22 + (CAR.w - 44) * fx;
        const slide = c.balance ? (1 - easeOut(v)) * (CAR.w / 2 + 22 - (x - c.carX)) * 0.4 : 0;
        person(ctx, x + slide, carTop + CAR.h - 6, 138 + (k % 3) * 5, COL.steel, 0.5 * v);
      }
      // Hervorhebung Gegengewicht / Kabine (Waagemodus) + Blinken
      let blink = 0;
      if (c.blink) { const tb = t - c.tBlink; if (tb >= 0) blink = tb < 1.5 ? 0.5 + 0.5 * Math.cos(tb * TAU * 2.2) : 0.35 + 0.15 * Math.sin(t * 3); }
      const hiCw = c.tCw >= 0 ? easeOut(seg(t, c.tCw, 0.5)) * (1 - 0.6 * seg(t, c.tCw + 1.4, 0.8)) : 0;
      const cwGlow = Math.max(hiCw * (0.7 + 0.3 * Math.sin(t * 4)), blink);
      if (cwGlow > 0.01) {
        stk(ctx, (cc) => cc.rect(c.cwX - 3, cwTop - 3, CWT.w + 6, CWT.h + 6), COL.amber, 3, 2.2, cwGlow);
        fil(ctx, (cc) => cc.rect(c.cwX, cwTop, CWT.w, CWT.h), COL.amber, 0.1 * cwGlow + 0.22 * blink);
      }
      if (c.blink && t >= c.tBlink && t < c.tBlink + 1.6) { // Ping-Ringe beim Blinken
        for (let k = 0; k < 3; k++) {
          const ag = (t - c.tBlink - k * 0.45) / 0.8; if (ag <= 0 || ag >= 1) continue;
          const g = 8 + 46 * easeOut(ag);
          stk(ctx, (cc) => rrect(cc, c.cwX - g, cwTop - g, CWT.w + 2 * g, CWT.h + 2 * g, 8 + g * 0.3), COL.amber, 2.2, 1, 0.8 * (1 - ag));
        }
      }
      const hiCar = c.tCar >= 0 ? easeOut(seg(t, c.tCar, 0.5)) * (1 - 0.7 * seg(t, c.tCar + 1.4, 0.8)) : 0;
      if (hiCar > 0.01) stk(ctx, (cc) => cc.rect(c.carX - 3, carTop - 3, CAR.w + 6, CAR.h + 6), COL.cyan, 3, 2, hiCar * (0.7 + 0.3 * Math.sin(t * 4)));

      // Seile
      const hiR = seg(t, c.tRopes, 1.1);
      drawRopes(ctx, c, t, carTop, cwTop, s, c.balance ? 0 : hiR, fr);

      // Reibung im Hauptbild: Hitzepunkte + Pfeile entlang der Umschlingung
      if (fr > 0) {
        for (let i = 0; i < c.n; i++) {
          const q = pz(c.zs[i]);
          for (let j = 0; j < 7; j++) {
            const an = Math.PI + ((j + 0.5) / 7) * Math.PI, fl = 0.5 + 0.5 * Math.sin(t * 6.3 + h01(i * 31 + j) * TAU);
            dot(ctx, q[0] + Math.cos(an) * (R - 2), q[1] + Math.sin(an) * (R - 2), 10, COL.amber, fr * (0.35 + 0.65 * fl));
          }
        }
        const qm = pz(AW), RA = R + 22, dirS = c.dir;
        const ph = (t * 0.22 * dirS) % 1;
        for (let k = 0; k < 5; k++) {
          let f = ((k + ph) / 5) % 1; if (f < 0) f += 1;
          const an = (196 + f * 148) * D2R, al = Math.sin(Math.PI * f) * seg(t, c.tFric + k * 0.08, 0.4);
          if (al <= 0.02) continue;
          const x = qm[0] + Math.cos(an) * RA, y = qm[1] + Math.sin(an) * RA;
          const tx = -Math.sin(an) * dirS, ty = Math.cos(an) * dirS, L2 = 17;
          arrow(ctx, x - tx * L2, y - ty * L2, x + tx * L2, y + ty * L2, COL.amber, 3, 12, al * fr);
        }
        // Aufleuchten beim Einsetzen
        const sw = seg(t, c.tFric, 0.7);
        if (sw > 0 && sw < 1) { const q = pz(AW / 2), a0 = Math.PI + sw * Math.PI; stk(ctx, (cc) => cc.arc(q[0], q[1], R + 4, Math.max(Math.PI, a0 - 0.5), a0), COL.hot, 5, 1.6, Math.sin(Math.PI * sw)); }
      }

      // Tags
      if (c.tags) {
        const tagO = { size: 18, weight: 700, font: FM, ls: 3 };
        txt(ctx, "KABINE", c.carX + 16, carTop + 32, { ...tagO, color: COL.cyan, alpha: 0.85 + 0.15 * hiCar });
        txt(ctx, "GEGENGEWICHT", c.cwX + CWT.w + 20, cwTop + 30, { ...tagO, color: COL.amber, alpha: Math.min(1, 0.8 + 0.2 * cwGlow) });
        const m1 = pz(MOT.z1);
        const motA = c.balance && c.diffLabel ? easeOut(seg(t, c.tDiff, 0.5)) : 0;
        txt(ctx, "MOTOR", m1[0] + 26, m1[1] - MOT.r - 4, { ...tagO, size: 17, color: motA > 0.05 ? COL.amber : COL.muted, alpha: 0.7 + 0.3 * motA });
      }

      // Callouts
      const rLim = c.slots.length ? COLX - 16 : 1830;
      for (const l of c.labels) callout(ctx, t, l, anchor(c, l.target, carTop, cwTop), rLim);

      // Verbindungslinie Scheibe -> Rillen-Inset (Schnittmarke)
      const slotG = c.slots.find((q) => q.k === "grooves");
      if (slotG) {
        const ca = easeOut(seg(t, c.tGroove, 0.6));
        if (ca > 0) {
          const a = -58 * D2R, qm = pz(AW / 2);
          const mid = [qm[0] + Math.cos(a) * R, qm[1] + Math.sin(a) * R];
          stk(ctx, circB(mid[0], mid[1], 13 + 3 * Math.sin(t * 2.4)), COL.cyan, 1.8, 0.8, 0.9 * ca);
          const tx = slotG.x, ty = slotG.y + 40 * slotG.s;
          const ux = tx - mid[0], uy = ty - mid[1], ul = Math.hypot(ux, uy) || 1, sx = mid[0] + ux / ul * 16, sy = mid[1] + uy / ul * 16;
          stk(ctx, (cc) => { cc.moveTo(sx, sy); cc.lineTo(lerp(sx, tx, ca), lerp(sy, ty, ca)); }, COL.cyan, 1.2, 0, 0.55 * ca, { dash: [6, 6] });
        }
      }

      // rechte Spalte
      for (const q of c.slots) {
        if (q.k === "grooves") drawGrooveInset(ctx, c, t, q);
        else if (q.k === "towel") drawTowelInset(ctx, c, t, q);
        else if (q.k === "balance") drawBalancePanel(ctx, c, t, q, blink);
      }
      GA = 1;
    },
  });
})();
