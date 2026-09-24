/* Template „title_card“ – Eröffnungs- bzw. Abschnitts-Titelkarte im Stil „Visual Science“.
   Hintergrund: langsam rotierender Röntgen-/Blueprint-Schacht (Triebwerksraum, Treibscheibe, Tragseile,
   Fahrkorb, Gegengewicht, Führungsschienen, Geschwindigkeitsbegrenzer, Puffer) mit Scanlinie.
   Vordergrund: Kicker (Amber, Mono, Decode-Effekt), Titel (Oxanium-Versalien, Scan-Maske + Glow), Lineal, Untertitel.

   params:
     title     Titel. Zeilenumbruch mit "\n" oder " | ", *Wort* = Akzentfarbe.   (Aliase: headline, heading, titel)
     subtitle  Unterzeile, sonst p.text; "" blendet aus.                          (Aliase: sub, subline, untertitel)
     kicker    kleine Zeile über dem Titel, Standard "VISUAL SCIENCE"; "" = aus.  (Aliase: eyebrow, overline, label)
     layout    "left" (Standard, Blueprint rechts) | "center" (Blueprint zentral dahinter)   (Alias: align)
     breakRope true = ein Tragseil reißt im Hintergrund (rot), die übrigen halten.  (Aliase: snap, ropeBreak, seilbruch, danger)
     accent    Akzentfarbe für *markierte* Wörter: amber | red | cyan | green (Standard amber, bei breakRope red)
     labels    Bauteil-Beschriftungen im Blueprint (Standard true, nur layout "left") */
(function () {
  "use strict";
  const CEX = window.CE;
  if (!CEX || typeof CEX.register !== "function") return;

  const DEG = Math.PI / 180;
  const TAU = Math.PI * 2;
  const DEFAULT_TITLE = "Was passiert, wenn\nein Aufzugseil *reißt*?";
  const DEFAULT_KICKER = "VISUAL SCIENCE";
  const ACCENTS = { amber: "#ffb347", red: "#ff5a5f", cyan: "#3fd2ff", green: "#5be49b", white: "#eef6ff" };
  const SCRAMBLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/+<>=";

  // ---------------- kleine Helfer ----------------
  const pick = (o, keys) => {
    if (!o || typeof o !== "object") return undefined;
    for (const k of keys) { const v = o[k]; if (v !== undefined && v !== null) return v; }
    return undefined;
  };
  const toBool = (v, d) => {
    if (v === undefined || v === null || v === "") return d;
    if (typeof v === "string") return /^(1|true|ja|yes|on|y|an)$/i.test(v.trim());
    return !!v;
  };
  const upper = (s) => { try { return String(s).toLocaleUpperCase("de-DE"); } catch (e) { return String(s).toUpperCase(); } };
  const fmtDe = (v, dec) => (v < -0.00001 ? "−" : "") + Math.abs(v).toFixed(dec).replace(".", ",");
  const h01 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sm = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const eo = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const eio = (x) => { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const invEio = (y) => { y = clamp(y, 0, 1); return y < 0.5 ? Math.cbrt(y / 4) : 1 - Math.cbrt(2 * (1 - y)) / 2; };
  const seg = (t, a, dur) => clamp((t - a) / Math.max(1e-6, dur), 0, 1);
  function setFont(ctx, weight, size, family, ls) {
    ctx.font = `${weight} ${size}px "${family}"`;
    try { ctx.letterSpacing = `${ls || 0}px`; } catch (e) { /* ältere Canvas-Implementierung */ }
  }

  // ---------------- Welt-Geometrie (1 Einheit ≈ 1 cm, y nach unten) ----------------
  // Seilführung: Fahrkorb -> Treibscheibe (Umschlingung ~145°) -> Umlenkrolle -> Gegengewicht (1:1-Aufhängung).
  const G = {
    sx: 140, sz: 115, yTop: -800, yPit: 670,              // Schacht 2,8 × 2,3 m, Schachtdecke, Grubenboden
    mrTop: -1060, mrx: 200, mrz: 155,                     // Triebwerksraum (Höhe 2,6 m)
    slabX: 205, slabZ: 165, slabT: 22,                    // Geschossdecken
    landings: [520, 200, -120, -440],                     // Haltestellen (Oberkante Fußboden), Geschosshöhe 3,2 m
    carX: 80, carZ0: -35, carZ1: 105, carH: 225, carZc: 35, // Fahrkorb 1,6 × 1,4 × 2,25 m
    cwX: 68, cwZ0: -94, cwZ1: -64, cwH: 200, cwZc: -79,    // Gegengewicht
    railCarX: 104, railCwX: 82,
    shY: -905, shZ: 3, shR: 32, shHalf: 17,               // Treibscheibe Ø 0,64 m, Seilablauf Fahrkorbseite z = shZ + shR = carZc
    dfY: -845, dfZ: -54, dfR: 25,                         // Umlenkrolle, Seilablauf z = dfZ - dfR = cwZc
    ropesX: [-12, -4, 4, 12],                              // 4 Tragseile
    govX: -122, govR: 17,                                  // Geschwindigkeitsbegrenzer (Seil in Schienenebene)
  };
  G.govZ = G.carZc; G.govY = G.yTop - G.govR - 9;
  // gemeinsame Tangente Treibscheibe -> Umlenkrolle (beide gleichsinnig umschlungen), Winkel im (z, y-oben)-System
  (function () {
    const dz = G.dfZ - G.shZ, dy = -(G.dfY - G.shY);
    const dist = Math.hypot(dz, dy), alpha = Math.atan2(dy, dz), beta = Math.acos((G.shR - G.dfR) / dist);
    G.tanA = alpha - beta; if (G.tanA < 0) G.tanA += TAU; // Normalenwinkel des Tangentenpunkts (oben links, ~141°)
  })();
  /** Punkt auf einem Rad in der y-z-Ebene; a im mathematischen Sinn (0 = +z, 90° = oben). */
  const wheel = (x, cy, cz, r, a) => [x, cy - r * Math.sin(a), cz + r * Math.cos(a)];

  // statische Segmente (einmal aufbauen)
  let STATIC = null;
  function buildStatic() {
    const S = [];
    const s = (c, a, b) => S.push([c, a[0], a[1], a[2], b[0], b[1], b[2]]);
    const box = (c, x0, x1, y0, y1, z0, z1) => {
      const P = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
      for (let i = 0; i < 4; i++) { s(c, P[i], P[(i + 1) % 4]); s(c, P[4 + i], P[4 + ((i + 1) % 4)]); s(c, P[i], P[4 + i]); }
    };
    const rectY = (c, y, x0, x1, z0, z1) => { s(c, [x0, y, z0], [x1, y, z0]); s(c, [x1, y, z0], [x1, y, z1]); s(c, [x1, y, z1], [x0, y, z1]); s(c, [x0, y, z1], [x0, y, z0]); };
    const circYZ = (c, x, cy, cz, r, n) => { for (let i = 0; i < n; i++) s(c, wheel(x, cy, cz, r, (i / n) * TAU), wheel(x, cy, cz, r, ((i + 1) / n) * TAU)); };

    // Schacht + Triebwerksraum
    box("d", -G.sx, G.sx, G.yTop, G.yPit, -G.sz, G.sz);
    box("d", -G.mrx, G.mrx, G.mrTop, G.yTop, -G.mrz, G.mrz);
    s("d", [-G.mrx, G.yTop + 30, -G.mrz], [G.mrx, G.yTop + 30, -G.mrz]); s("d", [-G.mrx, G.yTop + 30, G.mrz], [G.mrx, G.yTop + 30, G.mrz]); // Deckenstärke
    // Seildurchbrüche in der Triebwerksraum-Decke
    rectY("d", G.yTop, -22, 22, G.carZc - 8, G.carZc + 8);
    rectY("d", G.yTop, -22, 22, G.cwZc - 8, G.cwZc + 8);
    rectY("d", G.yTop, G.govX - 6, G.govX + 6, G.govZ - G.govR - 5, G.govZ + G.govR + 5);
    // Geschossdecken + Schachttüren
    for (const y of G.landings) {
      rectY("d", y, -G.slabX, G.slabX, -G.slabZ, G.slabZ);
      rectY("d", y + G.slabT, -G.slabX, G.slabX, -G.slabZ, G.slabZ);
      for (const [xx, zz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) s("d", [xx * G.slabX, y, zz * G.slabZ], [xx * G.slabX, y + G.slabT, zz * G.slabZ]);
      s("d", [-55, y, G.sz], [-55, y - 210, G.sz]); s("d", [55, y, G.sz], [55, y - 210, G.sz]); s("d", [-55, y - 210, G.sz], [55, y - 210, G.sz]);
      s("d", [0, y, G.sz], [0, y - 210, G.sz]);
    }
    // Führungsschienen (T-Profil: Steg + Fuß) mit Konsolen
    const railTop = G.yTop + 25;
    for (const sg of [-1, 1]) {
      const xc = sg * G.railCarX, xf = sg * (G.railCarX + 8);
      s("s", [xc, G.yPit, G.carZc], [xc, railTop, G.carZc]);
      s("s", [xf, G.yPit, G.carZc - 8], [xf, railTop, G.carZc - 8]);
      s("s", [xf, G.yPit, G.carZc + 8], [xf, railTop, G.carZc + 8]);
      const xw = sg * G.railCwX, xwf = sg * (G.railCwX + 7);
      s("s", [xw, G.yPit, G.cwZc], [xw, railTop, G.cwZc]);
      s("s", [xwf, G.yPit, G.cwZc - 6], [xwf, railTop, G.cwZc - 6]);
      for (let y = G.yPit - 150; y > railTop; y -= 320) {
        s("s", [xf, y, G.carZc], [sg * G.sx, y, G.carZc]);
        s("s", [xwf, y + 60, G.cwZc], [sg * G.sx, y + 60, G.cwZc]);
      }
    }
    // Puffer in der Schachtgrube (Federpuffer)
    const spring = (x, z, h) => {
      const y0 = G.yPit - 12; let prev = [x, y0, z];
      for (let i = 1; i <= 12; i++) { const q = [x + (i === 12 ? 0 : i % 2 ? 12 : -12), y0 - (h * i) / 12, z]; s("a", prev, q); prev = q; }
      s("a", [x - 16, y0 - h, z], [x + 16, y0 - h, z]);
      box("e", x - 18, x + 18, y0, G.yPit, z - 18, z + 18);
    };
    spring(-45, G.carZc, 90); spring(45, G.carZc, 90); spring(0, G.cwZc, 75);
    // Triebwerk (getriebelos): Maschinenrahmen, Welle, Motor, Bremse
    box("s", 22, 150, G.shY + 44, G.yTop, G.shZ - 50, G.shZ + 50);
    s("s", [-30, G.shY, G.shZ], [150, G.shY, G.shZ]);
    circYZ("s", 50, G.shY, G.shZ, 42, 24); circYZ("s", 140, G.shY, G.shZ, 42, 24);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + Math.PI / 4; s("s", wheel(50, G.shY, G.shZ, 42, a), wheel(140, G.shY, G.shZ, 42, a)); }
    circYZ("a", 30, G.shY, G.shZ, 38, 24); circYZ("e", 36, G.shY, G.shZ, 38, 24);        // Bremsscheibe
    box("a", 24, 42, G.shY - 52, G.shY - 36, G.shZ - 10, G.shZ + 10);                  // Bremssattel
    // Treibscheibe (Kränze + Nabe) und Umlenkrolle mit Lagerböcken
    for (const x of [-G.shHalf, G.shHalf]) { circYZ("c", x, G.shY, G.shZ, G.shR, 28); circYZ("c", x, G.shY, G.shZ, 8, 8); }
    circYZ("e", 0, G.shY, G.shZ, G.shR - 5, 28);
    for (const x of [-G.shHalf, G.shHalf]) { circYZ("c", x, G.dfY, G.dfZ, G.dfR, 22); circYZ("c", x, G.dfY, G.dfZ, 6, 8); }
    s("s", [-G.shHalf - 12, G.dfY, G.dfZ], [G.shHalf + 12, G.dfY, G.dfZ]);
    for (const x of [-G.shHalf - 12, G.shHalf + 12]) s("s", [x, G.dfY, G.dfZ], [x, G.yTop, G.dfZ]);
    // Geschwindigkeitsbegrenzer + Spannrolle in der Grube + Begrenzerseil
    circYZ("a", G.govX, G.govY, G.govZ, G.govR, 16); circYZ("a", G.govX, G.govY, G.govZ, 5, 6);
    box("e", G.govX - 10, G.govX + 10, G.govY + 4, G.yTop, G.govZ - 24, G.govZ + 24);
    circYZ("a", G.govX, G.yPit - 42, G.govZ, G.govR, 16);
    box("e", G.govX - 8, G.govX + 8, G.yPit - 20, G.yPit - 6, G.govZ - 30, G.govZ + 30);
    s("s", [G.govX, G.govY, G.govZ + G.govR], [G.govX, G.yPit - 42, G.govZ + G.govR]);
    s("s", [G.govX, G.govY, G.govZ - G.govR], [G.govX, G.yPit - 42, G.govZ - G.govR]);
    return S;
  }
  // ---------------- Projektion + Batch ----------------
  function makeView(o) { return { cs: Math.cos(o.yaw), sn: Math.sin(o.yaw), cp: Math.cos(o.pitch), sp: Math.sin(o.pitch), D: o.D, ox: o.ox, oy: o.oy, sc: o.sc, camY: o.camY }; }
  function proj(V, x, y, z) {
    const xr = x * V.cs - z * V.sn, zr = x * V.sn + z * V.cs;
    const yr = y - V.camY;
    const y2 = yr * V.cp + zr * V.sp, z2 = zr * V.cp - yr * V.sp;
    const k = (V.D / (V.D - z2)) * V.sc;
    return [V.ox + xr * k, V.oy + y2 * k, z2];
  }
  const COLS = ["d", "e", "s", "a", "c", "r"];
  const STY = {
    d: { color: "#3fd2ff", a: 0.24, w: 1, glow: 0 },
    e: { color: "#ffb347", a: 0.22, w: 1, glow: 0 },
    s: { color: "#9fc4e6", a: 0.3, w: 1.2, glow: 0 },
    a: { color: "#ffb347", a: 0.5, w: 1.4, glow: 1 },
    c: { color: "#3fd2ff", a: 0.48, w: 1.5, glow: 1 },
    r: { color: "#ff5a5f", a: 1, w: 2.4, glow: 1 },
  };
  const DEPTH = [0.5, 0.75, 1];
  function newBatch() { const B = {}; for (const c of COLS) B[c] = [[], [], []]; B.minX = 1e9; B.maxX = -1e9; return B; }
  function addSeg(B, V, c, x1, y1, z1, x2, y2, z2) {
    const a = proj(V, x1, y1, z1), b = proj(V, x2, y2, z2);
    const zm = (a[2] + b[2]) * 0.5;
    const bi = zm < -80 ? 0 : zm < 80 ? 1 : 2;
    B[c][bi].push(a[0], a[1], b[0], b[1]);
    if (c === "d") { if (a[0] < B.minX) B.minX = a[0]; if (b[0] < B.minX) B.minX = b[0]; if (a[0] > B.maxX) B.maxX = a[0]; if (b[0] > B.maxX) B.maxX = b[0]; }
  }
  function addPoly(B, V, c, pts) { for (let i = 1; i < pts.length; i++) addSeg(B, V, c, pts[i - 1][0], pts[i - 1][1], pts[i - 1][2], pts[i][0], pts[i][1], pts[i][2]); }
  function addBox(B, V, c, x0, x1, y0, y1, z0, z1) {
    const P = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
    for (let i = 0; i < 4; i++) {
      const a = P[i], b = P[(i + 1) % 4], c2 = P[4 + i], d2 = P[4 + ((i + 1) % 4)];
      addSeg(B, V, c, a[0], a[1], a[2], b[0], b[1], b[2]); addSeg(B, V, c, c2[0], c2[1], c2[2], d2[0], d2[1], d2[2]); addSeg(B, V, c, a[0], a[1], a[2], c2[0], c2[1], c2[2]);
    }
  }
  function drawBatch(ctx, B, mul, redMul, glowMul) {
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const key of COLS) {
      const st = STY[key]; ctx.strokeStyle = st.color;
      const m = key === "r" ? redMul : mul;
      if (m <= 0.001) continue;
      for (let bi = 0; bi < 3; bi++) {
        const arr = B[key][bi]; if (!arr.length) continue;
        ctx.beginPath();
        for (let i = 0; i < arr.length; i += 4) { ctx.moveTo(arr[i], arr[i + 1]); ctx.lineTo(arr[i + 2], arr[i + 3]); }
        const al = st.a * DEPTH[bi] * m;
        if (st.glow && glowMul > 0 && (bi > 0 || key === "r")) { ctx.globalAlpha = Math.min(1, al * 0.22 * glowMul); ctx.lineWidth = st.w * 4; ctx.stroke(); }
        ctx.globalAlpha = Math.min(1, al); ctx.lineWidth = st.w; ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------------- Titel-Layout (gecacht) ----------------
  const cache = new Map();
  function cached(key, fn) {
    if (cache.has(key)) return cache.get(key);
    const v = fn(); if (cache.size > 64) cache.clear(); cache.set(key, v); return v;
  }
  function parseTitle(raw) {
    const s = String(raw).replace(/\r/g, "").replace(/\\n/g, "\n").replace(/\s*\|\s*/g, "\n");
    let acc = false; const out = [];
    for (const ln of s.split("\n")) {
      const words = [];
      for (const w0 of ln.trim().split(/\s+/)) {
        if (!w0) continue;
        const segs = []; let cur = "";
        for (const ch of w0) { if (ch === "*") { if (cur) segs.push({ s: upper(cur), a: acc }); cur = ""; acc = !acc; } else cur += ch; }
        if (cur) segs.push({ s: upper(cur), a: acc });
        if (segs.length) words.push(segs);
      }
      if (words.length) out.push(words);
    }
    return out;
  }
  const TITLE_LS = 0.035; // Laufweite relativ zur Schriftgröße
  function layoutTitle(ctx, raw, maxW, maxH, maxSize, minSize) {
    return cached(`T|${raw}|${maxW}|${maxH}|${maxSize}`, () => {
      const explicit = parseTitle(raw);
      if (!explicit.length) return null;
      ctx.save(); setFont(ctx, 700, 100, "Oxanium", 100 * TITLE_LS);
      const mw = (str) => ctx.measureText(str).width;
      const spaceW = mw(" ");
      const wordW = (w) => w.reduce((acc, g) => acc + mw(g.s), 0);
      const lineW = (words) => words.reduce((acc, w, i) => acc + wordW(w) + (i ? spaceW : 0), 0);
      let lines, S;
      const lh = 1.1;
      if (explicit.length > 1) {
        lines = explicit;
        const wmax = Math.max(...lines.map(lineW));
        S = Math.min(maxSize, (maxW / wmax) * 100, maxH / (lines.length * lh));
      } else {
        const words = explicit[0]; const n = words.length; const ws = words.map(wordW);
        const span = (a, b) => { let w = 0; for (let i = a; i < b; i++) w += ws[i] + (i > a ? spaceW : 0); return w; };
        // ausgewogener Umbruch: je Zeilenzahl k die kleinste maximale Zeilenbreite (DP), dann Größe vs. Zeilenzahl abwägen
        const maxK = Math.min(n, n >= 8 ? 4 : 3);
        const dp = [Array.from({ length: n + 1 }, (_, j) => (j === 0 ? 0 : Infinity))], cut = [[]];
        let best = null;
        for (let k = 1; k <= maxK; k++) {
          dp[k] = new Array(n + 1).fill(Infinity); cut[k] = new Array(n + 1).fill(0);
          for (let j = 1; j <= n; j++) for (let i = k - 1; i < j; i++) {
            const m = Math.max(dp[k - 1][i], span(i, j));
            if (m < dp[k][j]) { dp[k][j] = m; cut[k][j] = i; }
          }
          const bestMax = dp[k][n]; if (!isFinite(bestMax)) continue;
          const Sk = Math.min(maxSize, (maxW / bestMax) * 100, maxH / (k * lh));
          const score = Sk * (1 - 0.08 * (k - 1));
          if (!best || score > best.score + 0.01) {
            const split = []; let j = n; for (let kk = k; kk >= 1; kk--) { split.unshift(j); j = cut[kk][j]; }
            best = { score, S: Sk, split };
          }
        }
        S = best.S; lines = []; let a = 0;
        for (const b of best.split) { lines.push(words.slice(a, b)); a = b; }
      }
      S = Math.max(minSize, Math.floor(S));
      // Runs mit x-Offsets bei finaler Größe
      setFont(ctx, 700, S, "Oxanium", S * TITLE_LS);
      const outLines = lines.map((words) => {
        const runs = []; let x = 0;
        words.forEach((w, wi) => {
          w.forEach((g, gi) => {
            const txt = (wi > 0 && gi === 0 ? " " : "") + g.s;
            const last = runs[runs.length - 1];
            if (last && last.a === g.a) { last.s += txt; } else runs.push({ s: txt, a: g.a, x: 0 });
          });
        });
        for (const r of runs) { r.x = x; r.w = ctx.measureText(r.s).width; x += r.w; }
        return { runs, w: x - S * TITLE_LS, plain: runs.map((r) => r.s).join("") };
      });
      ctx.restore();
      return { S, lines: outLines, lh: S * lh, maxLine: Math.max(...outLines.map((l) => l.w)) };
    });
  }
  function layoutSub(ctx, L, text, maxW, size) {
    return cached(`S|${text}|${maxW}|${size}`, () => {
      const o = (sz) => ({ size: sz, weight: 400, font: "Inter" });
      let s = size, lines = L.wrap(ctx, text, maxW, o(s));
      while (lines.length > 2 && s > 32) { s -= 2; lines = L.wrap(ctx, text, maxW, o(s)); }
      if (lines.length > 3) {
        lines = lines.slice(0, 3);
        let last = lines[2] + " …";
        for (let guard = 0; guard < 30 && L.measure(ctx, last, o(s)) > maxW; guard++) { const nx = last.replace(/\s*\S+\s*…$/, " …"); if (nx === last) break; last = nx; }
        lines[2] = last;
      }
      return { size: s, lines };
    });
  }
  function paintRuns(ctx, line, x, y, S, mode, o) {
    for (const r of line.runs) {
      if (mode === "stroke") { ctx.strokeText(r.s, x + r.x, y); continue; }
      if (mode === "fill") {
        ctx.fillStyle = r.a ? o.accent : o.base;
        ctx.shadowColor = r.a ? o.accentGlow : o.glowCol;
      }
      ctx.fillText(r.s, x + r.x, y);
    }
  }

  // ---------------- Hauptzeichnung ----------------
  function drawCard(ctx, p) {
    const L = p.L, C = L.C;
    const W = p.W || 1920, H = p.H || 1080;
    const t = Math.max(0, Number(p.t) || 0);
    const d = Math.max(0.5, Number(p.d) || 6);
    const P = p.params && typeof p.params === "object" ? p.params : {};
    const ts = clamp(d / 6, 0.55, 1.4); // Zeitmaßstab der Intro-Phasen

    const layoutRaw = String(pick(P, ["layout", "align", "variant"]) ?? "left").toLowerCase();
    const center = /^(center|centre|mitte|zentriert)$/.test(layoutRaw);
    const titleRaw = pick(P, ["title", "headline", "heading", "titel"]);
    const title = titleRaw === undefined || String(titleRaw).trim() === "" ? DEFAULT_TITLE : String(titleRaw);
    const subRaw = pick(P, ["subtitle", "sub", "subline", "untertitel", "subheading"]);
    const subtitle = String(subRaw === undefined ? p.text || "" : subRaw).replace(/\s+/g, " ").trim();
    const kickerRaw = pick(P, ["kicker", "eyebrow", "overline", "label", "dachzeile"]);
    const kicker = upper(String(kickerRaw === undefined ? DEFAULT_KICKER : kickerRaw).trim());
    const breakRope = toBool(pick(P, ["breakRope", "break_rope", "ropeBreak", "snap", "seilbruch", "danger"]), false);
    const accentKey = String(pick(P, ["accent", "accentColor", "akzent"]) ?? (breakRope ? "red" : "amber")).toLowerCase();
    const accent = ACCENTS[accentKey] || (/^#[0-9a-f]{6}$/i.test(accentKey) ? accentKey : ACCENTS.amber);
    const showLabels = !center && toBool(pick(P, ["labels", "showLabels", "beschriftung"]), true);

    // ---------- Zeitplan ----------
    const tScan1 = 1.7 * ts;                         // erster Scan baut den Blueprint auf
    const tKick = 0.12 * ts, dKick = 0.75 * ts;
    const tTitle = 0.4 * ts, dLine = 0.95 * ts, stag = 0.22 * ts;

    // ---------- Text-Layout ----------
    const x0 = center ? W / 2 : 140;
    const maxW = center ? 1480 : 1060;
    const TL = layoutTitle(ctx, title, maxW, center ? 330 : 360, center ? 116 : 104, 40);
    const nLines = TL ? TL.lines.length : 0;
    const tTitleEnd = tTitle + Math.max(0, nLines - 1) * stag + dLine;
    const tRuler = tTitleEnd - 0.25 * ts, dRuler = 0.8 * ts;
    const tSub = tTitleEnd - 0.1 * ts, dSub = 0.75 * ts;
    const tBreak = tTitleEnd + 0.35 * ts;

    // ---------- Blueprint ----------
    const yawRate = Math.min(3, 22 / d) * DEG;
    const yaw = (center ? 22 : 24) * DEG + yawRate * t;
    const bpOx = (center ? W / 2 : 1385) + Math.sin(t * 0.23) * 6;
    const bpSc = (center ? 1.0 : 0.94) * (1 + 0.03 * sm(t / d));
    const bpOy = (center ? 540 : 528) + Math.sin(t * 0.31 + 1) * 8 - 10 * sm(t / d);
    const V = makeView({ yaw, pitch: 8 * DEG, D: 2400, ox: bpOx, oy: bpOy, sc: bpSc, camY: -620 });
    const bpMul = center ? 0.5 : 0.95;

    // Mechanik: Fahrkorb fährt langsam aufwärts, Gegengewicht abwärts, Treibscheibe + Umlenkrolle drehen mit
    const v = 160 / Math.max(8, d);
    const tMove = breakRope ? Math.min(t, tBreak) + 0.18 * (1 - Math.exp(-Math.max(0, t - tBreak) * 6)) : t;
    const travel = Math.min(170, v * tMove);
    const tt = t - tBreak;
    const jolt = breakRope && tt > 0 ? 3.5 * Math.sin(tt * 34) * Math.exp(-tt * 5) : 0;
    const carB = -240 - travel + jolt, cT = carB - G.carH;
    const cwT = -560 + travel;
    const angS = travel / G.shR, angD = travel / G.dfR;

    if (!STATIC) STATIC = buildStatic();
    const B = newBatch();
    for (const sgm of STATIC) addSeg(B, V, sgm[0], sgm[1], sgm[2], sgm[3], sgm[4], sgm[5], sgm[6]);
    // Fahrkorb mit Tür, Fahrkorbrahmen, Führungsschuhen, Fangvorrichtung
    addBox(B, V, "c", -G.carX, G.carX, cT, carB, G.carZ0, G.carZ1);
    addPoly(B, V, "c", [[-50, carB, G.carZ1], [-50, cT + 14, G.carZ1], [50, cT + 14, G.carZ1], [50, carB, G.carZ1]]);
    addSeg(B, V, "c", 0, cT + 14, G.carZ1, 0, carB, G.carZ1);
    const yCH = cT - 30; // Querhaupt (Seilaufhängung)
    const fx = G.carX + 14;
    for (const sg of [-1, 1]) {
      addSeg(B, V, "s", sg * fx, yCH, G.carZc, sg * fx, carB + 22, G.carZc);
      addSeg(B, V, "s", sg * fx, yCH, G.carZc, sg * G.railCarX, yCH, G.carZc);          // Führungsschuh oben
      addBox(B, V, "a", Math.min(sg * (fx - 2), sg * (G.railCarX + 10)), Math.max(sg * (fx - 2), sg * (G.railCarX + 10)), carB + 4, carB + 34, G.carZc - 9, G.carZc + 9); // Fangvorrichtung
    }
    addSeg(B, V, "s", -fx, yCH, G.carZc, fx, yCH, G.carZc); addSeg(B, V, "s", -fx, yCH + 12, G.carZc, fx, yCH + 12, G.carZc);
    addSeg(B, V, "s", -fx, carB + 22, G.carZc, fx, carB + 22, G.carZc); addSeg(B, V, "s", -fx, carB + 10, G.carZc, fx, carB + 10, G.carZc);
    addSeg(B, V, "a", G.govX, carB + 19, G.govZ + G.govR, -fx, carB + 19, G.carZc); // Auslösegestänge am Begrenzerseil
    // Gegengewicht mit Füllstücken
    addBox(B, V, "a", -G.cwX, G.cwX, cwT, cwT + G.cwH, G.cwZ0, G.cwZ1);
    for (let y = cwT + 18; y < cwT + G.cwH - 6; y += 18) addSeg(B, V, "e", -G.cwX, y, G.cwZ1, G.cwX, y, G.cwZ1);
    addSeg(B, V, "s", -G.cwX - 14, cwT - 8, G.cwZc, G.cwX + 14, cwT - 8, G.cwZc);
    // Speichen von Treibscheibe und Umlenkrolle drehen mit
    for (let i = 0; i < 5; i++) {
      const a = angS + (i * TAU) / 5;
      const p1 = wheel(0, G.shY, G.shZ, 9, a), p2 = wheel(0, G.shY, G.shZ, G.shR - 6, a);
      addSeg(B, V, "c", p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
      if (i < 4) { const b = angD + (i * TAU) / 4; const q1 = wheel(0, G.dfY, G.dfZ, 6, b), q2 = wheel(0, G.dfY, G.dfZ, G.dfR - 4, b); addSeg(B, V, "e", q1[0], q1[1], q1[2], q2[0], q2[1], q2[2]); }
    }
    // Tragseile: Fahrkorb -> Treibscheibe -> Umlenkrolle -> Gegengewicht
    const brokenIdx = 1;
    const broken = breakRope && tt >= 0;
    const strain = breakRope && tt < 0 ? seg(t, tBreak - 0.7 * ts, 0.7 * ts) : 0;
    let breakPt = null, breakInfo = null, labelPt = null;
    const yBk = G.shY + (yCH - G.shY) * 0.42;
    G.ropesX.forEach((rx, i) => {
      const path = [];
      for (let k = 0; k <= 10; k++) path.push(wheel(rx, G.shY, G.shZ, G.shR, (k / 10) * G.tanA));
      for (let k = 0; k <= 4; k++) path.push(wheel(rx, G.dfY, G.dfZ, G.dfR, G.tanA + (k / 4) * (Math.PI - G.tanA)));
      path.push([rx, cwT - 8, G.cwZc]);
      addPoly(B, V, "c", path);
      if (breakRope && i === brokenIdx) {
        if (!broken) { addSeg(B, V, strain > 0.02 ? "r" : "c", rx, G.shY, G.carZc, rx, yCH, G.carZc); breakInfo = { strain }; }
        else {
          const recoil = 70 * (1 - Math.exp(-tt * 3.2));
          const wx = Math.sin(tt * 15) * 16 * Math.exp(-tt * 2), wz = Math.cos(tt * 11) * 8 * Math.exp(-tt * 2);
          const yEnd = yBk - recoil;
          addPoly(B, V, "r", [[rx, G.shY, G.carZc], [rx + wx * 0.35, (G.shY + yEnd) / 2, G.carZc + wz * 0.3], [rx + wx, yEnd, G.carZc + wz]]);
          // unteres Seilstück fällt auf das Fahrkorbdach
          const len = yCH - yBk;
          const fall = Math.min(len - 26, 0.5 * 981 * tt * tt);
          const yFree = yBk + fall, settle = clamp(fall / Math.max(1, len - 26), 0, 1);
          const pts = [];
          for (let k = 0; k <= 8; k++) {
            const f = k / 8; const yy = yCH - (yCH - yFree) * f;
            const amp = (6 + 20 * settle) * f;
            pts.push([rx + Math.sin(k * 1.9 + tt * 9 * (1 - settle)) * amp, yy, G.carZc + Math.cos(k * 1.3) * amp * 0.6]);
          }
          addPoly(B, V, "r", pts);
          breakInfo = { tt };
        }
        breakPt = proj(V, rx, yBk, G.carZc);
        if (broken) { const ye = yBk - 70 * (1 - Math.exp(-tt * 3.2)); labelPt = proj(V, rx, ye, G.carZc); }
      } else {
        addSeg(B, V, "c", rx, G.shY, G.carZc, rx, yCH, G.carZc);
      }
    });

    // ---------- Textblock ----------
    const kSize = 24;
    const S = TL ? TL.S : 80;
    const capH = 0.72 * S;
    const sub = subtitle ? layoutSub(ctx, L, subtitle, center ? 1300 : 1000, center ? 40 : 38) : null;
    const subLH = sub ? sub.size * 1.34 : 0;
    const hKick = kicker ? kSize + 0.34 * S + 14 : 0;
    const hTitle = TL ? capH + (nLines - 1) * TL.lh : 0;
    const gapRuler = Math.max(26, 0.4 * S);
    const hSub = sub ? 40 + sub.size * 0.78 + (sub.lines.length - 1) * subLH + sub.size * 0.25 : 10;
    const total = hKick + hTitle + gapRuler + hSub;
    const yc = center ? 470 : 480;
    const top = Math.max(118, Math.min(yc - total / 2, 900 - total));
    const kBase = top + kSize * 0.78;
    const tBase0 = top + hKick + capH;
    const tBottom = tBase0 + (nLines - 1) * (TL ? TL.lh : 0);
    const rulerY = tBottom + gapRuler;
    const subBase0 = rulerY + 40 + (sub ? sub.size * 0.78 : 0);
    const blockBottom = sub ? subBase0 + (sub.lines.length - 1) * subLH + sub.size * 0.3 : rulerY + 10;
    const blockRight = center ? W / 2 + (TL ? TL.maxLine / 2 : 400) : x0 + Math.max(TL ? TL.maxLine : 400, 700);
    const avoid = { x0: center ? W / 2 - (TL ? TL.maxLine / 2 : 400) - 40 : 90, x1: blockRight + 40, y0: top - 36, y1: blockBottom + 30 };

    // ---------- Szene zeichnen ----------
    ctx.save();

    // Scan-Zyklus
    const scanTop = 60, scanBot = 1010;
    let scanY = -1, scanA = 0;
    if (t < tScan1) { scanY = L.lerp(scanTop, scanBot, eio(t / tScan1)); scanA = 1; }
    else {
      const per = 4.6, dur = 2.8; const ph = (t - tScan1 - 0.9) / per;
      if (ph >= 0) { const f = (ph - Math.floor(ph)) * per / dur; if (f < 1) { scanY = L.lerp(scanTop, scanBot, sm(f)); scanA = Math.sin(Math.PI * f) * 0.75; } }
    }
    const bx0 = center ? 160 : Math.max(avoid.x1 - 60, B.minX - 70), bx1 = center ? W - 160 : Math.min(W - 60, B.maxX + 70);
    const build = t < tScan1 ? clamp(scanY, 0, H) : H;
    const intro = sm(t / (0.35 * ts));

    // Blueprint: Basis (während des ersten Scans nur oberhalb der Scanlinie)
    ctx.save();
    if (build < H) { ctx.beginPath(); ctx.rect(0, 0, W, build); ctx.clip(); }
    drawBatch(ctx, B, bpMul * (0.7 + 0.3 * intro) * (0.93 + 0.07 * Math.sin(t * 1.7)), 1, 1);
    ctx.restore();
    // Scan-Highlight-Band
    if (scanY > 0 && scanA > 0.01) {
      ctx.save(); ctx.beginPath(); ctx.rect(bx0, scanY - 60, bx1 - bx0, 62); ctx.clip();
      drawBatch(ctx, B, bpMul * 1.3 * scanA, 0, 1.2); ctx.restore();
      drawScanLine(ctx, bx0, bx1, scanY, scanA * (center ? 0.6 : 1));
    }

    // Seilbruch-Effekte
    if (breakRope && breakPt) {
      if (!broken && breakInfo && breakInfo.strain > 0) {
        L.glowDot(ctx, breakPt[0], breakPt[1], 26, C.red, breakInfo.strain * (0.4 + 0.4 * Math.sin(t * 22)));
      }
      if (broken) {
        const fl = Math.exp(-tt * 3.2);
        L.glowDot(ctx, breakPt[0], breakPt[1], 90, C.red, 0.9 * fl);
        L.glowDot(ctx, breakPt[0], breakPt[1], 30, "#ffe3a8", fl);
        if (tt < 1.1) {
          ctx.save(); ctx.beginPath(); ctx.rect(center ? 0 : avoid.x1 - 10, 0, W, H); ctx.clip(); // Funken nie über dem Titel
          L.sparks(ctx, breakPt[0], breakPt[1], tt, { seed: 17, count: 26, window: 0.1, life: 0.75, speed: 360, spread: TAU, dir: -Math.PI / 2, gravity: 1100 });
          ctx.restore();
        }
        const ring = eo(tt / 0.6);
        if (tt < 0.6) { ctx.save(); ctx.globalAlpha = 1 - ring; ctx.strokeStyle = C.red; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(breakPt[0], breakPt[1], 10 + 70 * ring, 0, TAU); ctx.stroke(); ctx.restore(); }
      }
    }

    // Bauteil-Beschriftungen
    if (showLabels) drawLabels(ctx, L, p, V, B, { cT, carB, cwT, yCH, t, tScan1, scanTop, scanBot, broken, tt, breakPt: labelPt || breakPt, yBk, avoid });

    // HUD-Zeile (Blueprint-Metadaten)
    {
      const a = seg(t, tScan1 * 0.8, 0.6 * ts) * (center ? 0.4 : 0.55);
      if (a > 0) {
        const yawDeg = yaw / DEG;
        const txt = `RÖNTGENANSICHT  ·  DREHUNG ${fmtDe(yawDeg, 1)}°`;
        L.text(ctx, txt, W - 90, 892, { size: 15, weight: 700, font: "JetBrains Mono", color: "#8fb3d9", align: "right", letterSpacing: 2, alpha: a });
        ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = C.cyan; ctx.fillRect(W - 90 - L.measure(ctx, txt, { size: 15, weight: 700, font: "JetBrains Mono", letterSpacing: 2 }) - 22, 884, 8, 8); ctx.restore();
      }
    }

    // Schwebeteilchen
    drawDust(ctx, W, H, t);

    // Kicker (Amber, Mono, Decode)
    if (kicker) drawKicker(ctx, L, kicker, x0, kBase, kSize, t, tKick, dKick, center);

    // Titel
    if (TL) {
      const glowPulse = 0.88 + 0.12 * Math.sin(t * 1.9);
      TL.lines.forEach((line, i) => {
        const y = tBase0 + i * TL.lh;
        const lx = center ? x0 - line.w / 2 : x0;
        const st = tTitle + i * stag;
        const e = eio(seg(t, st, dLine));
        drawTitleLine(ctx, L, line, lx, y, TL.S, e, t, st, ts, glowPulse, accent, tTitleEnd, TL, center ? x0 - TL.maxLine / 2 : x0);
      });
    }

    // Lineal unter dem Titel
    if (TL) drawRuler(ctx, L, x0, rulerY, Math.min(TL.maxLine, center ? 820 : 760), seg(t, tRuler, dRuler), t, center, accent);

    // Untertitel
    if (sub && sub.lines.length) {
      const a = sm(seg(t, tSub, dSub));
      if (a > 0) {
        const dy = (1 - eo(seg(t, tSub, dSub))) * 18;
        sub.lines.forEach((ln, i) => {
          const la = sm(seg(t, tSub + i * 0.12 * ts, dSub));
          L.text(ctx, ln, x0, subBase0 + i * subLH + dy, { size: sub.size, weight: 400, font: "Inter", color: "#d3e4f5", align: center ? "center" : "left", alpha: la * 0.95 });
        });
      }
    }
    ctx.restore();
  }

  function drawScanLine(ctx, x0, x1, y, a) {
    ctx.save();
    const gl = ctx.createLinearGradient(x0, 0, x1, 0);
    gl.addColorStop(0, "rgba(63,210,255,0)"); gl.addColorStop(0.18, "rgba(63,210,255,1)"); gl.addColorStop(0.82, "rgba(63,210,255,1)"); gl.addColorStop(1, "rgba(63,210,255,0)");
    ctx.fillStyle = gl;
    for (let i = 0; i < 8; i++) { ctx.globalAlpha = a * 0.028 * (1 - i / 8); ctx.fillRect(x0, y - 18 * (i + 1), x1 - x0, 18); }
    ctx.globalAlpha = a * 0.22; ctx.fillRect(x0, y - 5, x1 - x0, 10);
    ctx.globalAlpha = a * 0.95; ctx.fillRect(x0, y - 1, x1 - x0, 2);
    const gw = ctx.createLinearGradient(x0, 0, x1, 0);
    gw.addColorStop(0, "rgba(220,248,255,0)"); gw.addColorStop(0.5, "rgba(220,248,255,1)"); gw.addColorStop(1, "rgba(220,248,255,0)");
    ctx.fillStyle = gw; ctx.globalAlpha = a * 0.8; ctx.fillRect(x0, y - 0.5, x1 - x0, 1);
    // Endmarken
    ctx.globalAlpha = a * 0.8; ctx.fillStyle = "#3fd2ff";
    const xa = x0 + (x1 - x0) * 0.12, xb = x1 - (x1 - x0) * 0.12;
    ctx.beginPath(); ctx.moveTo(xa - 10, y - 6); ctx.lineTo(xa, y); ctx.lineTo(xa - 10, y + 6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(xb + 10, y - 6); ctx.lineTo(xb, y); ctx.lineTo(xb + 10, y + 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawDust(ctx, W, H, t) {
    ctx.save(); ctx.fillStyle = "#9fe6ff";
    for (let i = 0; i < 44; i++) {
      const sp = 6 + 14 * h01(i * 5.3);
      const x = h01(i * 1.7) * W + Math.sin(t * 0.35 + i * 1.3) * 22;
      let y = (h01(i * 3.9) * (H + 40) - t * sp) % (H + 40); if (y < 0) y += H + 40; y -= 20;
      const s = 1 + 2 * h01(i * 7.1);
      ctx.globalAlpha = (0.1 + 0.22 * h01(i * 2.3)) * (0.6 + 0.4 * Math.sin(t * (1 + h01(i)) + i));
      ctx.fillRect(x, y, s, s);
    }
    ctx.restore();
  }

  function drawKicker(ctx, L, kicker, x0, y, size, t, t0, dur, center) {
    const k = seg(t, t0, dur); if (k <= 0) return;
    const n = kicker.length;
    const rev = k * (n + 3);
    const frame = Math.floor(t * 24);
    let s = "";
    for (let i = 0; i < n; i++) {
      if (i < rev - 3) s += kicker[i];
      else if (i < rev) s += kicker[i] === " " ? " " : SCRAMBLE[Math.floor(h01(i * 13.7 + frame * 3.1) * SCRAMBLE.length)];
      else break;
    }
    const o = { size, weight: 700, font: "JetBrains Mono", color: "#ffb347", letterSpacing: 7 };
    const fullW = L.measure(ctx, kicker, o);
    const barIn = eo(seg(t, t0, 0.3 * dur + 0.1));
    const lineIn = eo(seg(t, t0 + 0.45 * dur, 0.8 * dur));
    ctx.save();
    if (center) {
      const vis = fullW - o.letterSpacing; // sichtbare Breite ohne nachlaufende Laufweite
      const tx = x0 - vis / 2;
      L.text(ctx, s, tx, y, { ...o, glow: 10, glowColor: "rgba(255,179,71,0.6)" });
      const len = 110 * lineIn;
      if (len > 1) {
        L.line(ctx, tx - 24 - len, y - size * 0.34, tx - 24, y - size * 0.34, "#ffb347", 2, 0.6, { alpha: 0.7 });
        L.line(ctx, tx + vis + 24, y - size * 0.34, tx + vis + 24 + len, y - size * 0.34, "#ffb347", 2, 0.6, { alpha: 0.7 });
      }
    } else {
      ctx.globalAlpha = barIn; ctx.fillStyle = "#ffb347"; ctx.fillRect(x0, y - size * 0.7, 6, size * 0.72 * barIn); ctx.globalAlpha = 1;
      L.text(ctx, s, x0 + 24, y, { ...o, glow: 10, glowColor: "rgba(255,179,71,0.6)" });
      const lx = x0 + 24 + fullW + 10;
      if (lineIn > 0) L.line(ctx, lx, y - size * 0.34, lx + 150 * lineIn, y - size * 0.34, "#ffb347", 2, 0.6, { alpha: 0.65 });
      // blinkender Cursor nach dem Decodieren
      if (k >= 1) { const on = Math.floor(t * 1.6) % 2 === 0; if (on) { ctx.globalAlpha = 0.85; ctx.fillStyle = "#ffb347"; ctx.fillRect(lx + 150 * lineIn + 10, y - size * 0.7, 12, size * 0.72); } }
    }
    ctx.restore();
  }

  // Titelzeilen einmalig als Sprites vorrendern (Glow = nur Schatten, Füllung getrennt) – shadowBlur pro Frame ist teuer.
  const lineCache = new Map();
  function lineSprites(line, S, accent) {
    const key = `${line.plain}|${line.runs.map((r) => (r.a ? 1 : 0)).join("")}|${S}|${accent}`;
    if (lineCache.has(key)) return lineCache.get(key);
    let sp = null;
    try {
      const pad = Math.ceil(0.42 * S);
      const w = Math.ceil(line.w + 2 * pad + 0.1 * S), h = Math.ceil(1.12 * S + 2 * pad);
      const ox = pad, oy = pad + Math.ceil(0.9 * S);
      const mk = () => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); setFont(g, 700, S, "Oxanium", S * TITLE_LS); g.textAlign = "left"; g.textBaseline = "alphabetic"; return [c, g]; };
      const [gc, gg] = mk();
      const OFFX = w + 200; // Glyphen außerhalb zeichnen, nur der Schatten landet im Sprite
      gg.shadowOffsetX = OFFX; gg.shadowBlur = 0.2 * S; gg.fillStyle = "#000";
      for (const r of line.runs) { gg.shadowColor = r.a ? accent : "rgba(63,210,255,0.9)"; gg.fillText(r.s, ox + r.x - OFFX, oy); }
      // Glow-Kopie für Scan-/Glanz-Effekte behalten, dann Füllung in ein kombiniertes Sprite (ein Blit pro Frame)
      const [cc, cg] = mk();
      cg.drawImage(gc, 0, 0);
      const grd = cg.createLinearGradient(0, oy - 0.74 * S, 0, oy); grd.addColorStop(0, "#ffffff"); grd.addColorStop(1, "#cfe9ff");
      for (const r of line.runs) { cg.fillStyle = r.a ? accent : grd; cg.fillText(r.s, ox + r.x, oy); }
      sp = { glow: gc, both: cc, ox, oy };
    } catch (e) { sp = null; }
    if (lineCache.size > 24) lineCache.clear();
    lineCache.set(key, sp);
    return sp;
  }

  function drawTitleLine(ctx, L, line, lx, y, S, e, t, st, ts, glowPulse, accent, tTitleEnd, TL, blockX) {
    const ghostA = seg(t, st - 0.3 * ts, 0.3 * ts);
    if (ghostA <= 0) return;
    const W = 1920;
    const pad = 0.06 * S;
    const head = lx - pad + (line.w + 2 * pad) * e;
    const topY = y - 1.3 * S, botY = y + 0.55 * S;
    const sp = lineSprites(line, S, accent);
    const dx = sp ? lx - sp.ox : 0, dy = sp ? y - sp.oy : 0;
    ctx.save();
    setFont(ctx, 700, S, "Oxanium", S * TITLE_LS);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    // 1) Geister-Kontur vor dem Scankopf
    if (e < 1) {
      ctx.save(); ctx.beginPath(); ctx.rect(head, topY, W - head, botY - topY); ctx.clip();
      ctx.globalAlpha = 0.34 * ghostA; ctx.strokeStyle = "#3fd2ff"; ctx.lineWidth = 1.2; ctx.lineJoin = "round";
      paintRuns(ctx, line, lx, y, S, "stroke");
      ctx.restore();
    }
    // 2) gefüllter Titel links vom Scankopf (Glow + Füllung)
    if (e > 0) {
      ctx.save();
      if (e < 1) { ctx.beginPath(); ctx.rect(0, topY, head, botY - topY); ctx.clip(); }
      if (sp) {
        ctx.drawImage(sp.both, dx, dy);
      } else {
        const grd = ctx.createLinearGradient(0, y - 0.74 * S, 0, y);
        grd.addColorStop(0, "#ffffff"); grd.addColorStop(1, "#cfe9ff");
        ctx.shadowBlur = 0.2 * S * glowPulse;
        paintRuns(ctx, line, lx, y, S, "fill", { base: grd, glowCol: "rgba(63,210,255,0.85)", accent, accentGlow: accent });
      }
      ctx.restore();
      // 3) heißer Streifen direkt hinter dem Scankopf
      if (e < 1) {
        const band = 0.9 * S;
        ctx.save(); ctx.beginPath(); ctx.rect(head - band, topY, band, botY - topY); ctx.clip();
        if (sp) { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.9; ctx.drawImage(sp.glow, dx, dy); ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; }
        const hg = ctx.createLinearGradient(head - band, 0, head, 0);
        hg.addColorStop(0, "rgba(160,235,255,0)"); hg.addColorStop(1, "rgba(215,248,255,1)");
        ctx.fillStyle = hg;
        paintRuns(ctx, line, lx, y, S, "plain");
        ctx.restore();
      }
    }
    // 4) Scankopf
    if (e > 0 && e < 1) {
      const a = Math.pow(Math.sin(Math.PI * e), 0.4);
      const y0 = y - 0.85 * S, y1 = y + 0.25 * S;
      L.line(ctx, head, y0, head, y1, "#bff3ff", 2, 1.2, { alpha: a });
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = "#3fd2ff";
      ctx.fillRect(head - 7, y0 - 1, 14, 2); ctx.fillRect(head - 7, y1 - 1, 14, 2);
      ctx.restore();
      L.glowDot(ctx, head, y - 0.36 * S, 0.55 * S, "#3fd2ff", 0.35 * a);
    }
    // 5) Glanz-Durchlauf nach der Enthüllung (dezent, periodisch)
    const gStart = tTitleEnd + 0.8 * ts, per = 4.2, gd = 1.3;
    if (t > gStart) {
      const ph = ((t - gStart) % per) / gd;
      if (ph < 1) {
        const span = TL.maxLine + 0.8 * S;
        const gx = blockX - 0.4 * S + span * eio(ph);
        const bw = 0.8 * S;
        const ga = Math.sin(Math.PI * ph);
        ctx.save(); ctx.beginPath(); ctx.rect(gx - bw, topY, 2 * bw, botY - topY); ctx.clip();
        if (sp) { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.55 * ga; ctx.drawImage(sp.glow, dx, dy); ctx.globalCompositeOperation = "source-over"; }
        const gg = ctx.createLinearGradient(gx - bw, 0, gx + bw, 0);
        gg.addColorStop(0, "rgba(63,210,255,0)"); gg.addColorStop(0.5, "rgba(170,238,255,0.6)"); gg.addColorStop(1, "rgba(63,210,255,0)");
        ctx.fillStyle = gg; ctx.globalAlpha = ga;
        paintRuns(ctx, line, lx, y, S, "plain");
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function drawRuler(ctx, L, x0, y, len, k, t, center, accent) {
    if (k <= 0) return;
    const e = eo(k);
    ctx.save();
    const xa = center ? x0 - (len / 2) * e : x0, xb = center ? x0 + (len / 2) * e : x0 + len * e;
    L.line(ctx, xa, y, xb, y, "#3fd2ff", 1.5, 0.7, { alpha: 0.75 });
    ctx.globalAlpha = 0.5; ctx.fillStyle = "#3fd2ff";
    const step = 20;
    const start = center ? x0 - len / 2 : x0;
    for (let i = 0, x = start; x <= start + len + 0.5; i++, x += step) {
      if (x < xa - 0.5 || x > xb + 0.5) continue;
      const major = i % 5 === 0; ctx.fillRect(Math.round(x), y - (major ? 11 : 5), 1, major ? 11 : 5);
    }
    ctx.globalAlpha = 1; ctx.fillStyle = accent === "#ff5a5f" ? "#ff5a5f" : "#ffb347";
    if (center) ctx.fillRect(x0 - 32 * e, y - 1.5, 64 * e, 3); else ctx.fillRect(x0, y - 1.5, 64 * e, 3);
    // Endmarke + laufender Lichtpunkt
    if (k >= 1) {
      ctx.globalAlpha = 0.8; ctx.fillStyle = "#3fd2ff";
      ctx.fillRect(xb - 1, y - 7, 2, 14);
      const ph = (t * 0.28) % 1;
      const px = L.lerp(xa, xb, ph);
      L.glowDot(ctx, px, y, 16, "#3fd2ff", 0.8 * Math.sin(Math.PI * ph));
    }
    ctx.restore();
  }

  function drawLabels(ctx, L, p, V, B, s) {
    const items = [
      { txt: "TRIEBWERKSRAUM", w: [G.mrx, G.mrTop + 50, -G.mrz], side: 1 },
      { txt: "TREIBSCHEIBE", w: wheel(G.shHalf, G.shY, G.shZ, G.shR, 2.2), side: 1 },
      { txt: "BREMSE", w: [42, G.shY - 44, G.shZ + 10], side: 1 },
      { txt: "GESCHWINDIGKEITSBEGRENZER", w: [G.govX, G.govY - G.govR, G.govZ], side: -1 },
      { txt: s.broken ? "SEILBRUCH" : "TRAGSEILE", w: s.broken ? null : [12, G.shY + (s.yCH - G.shY) * 0.55, G.carZc], side: 1, red: s.broken },
      { txt: "FAHRKORB", w: [G.carX, s.cT + G.carH * 0.35, G.carZ0], side: 1 },
      { txt: "FANGVORRICHTUNG", w: [G.railCarX + 10, s.carB + 20, G.carZc + 9], side: 1 },
      { txt: "GEGENGEWICHT", w: [G.cwX, s.cwT + G.cwH * 0.5, G.cwZ0], side: 1 },
      { txt: "FÜHRUNGSSCHIENE", w: [G.railCarX + 8, 330, G.carZc + 8], side: 1 },
    ];
    const o = { size: 15, weight: 700, font: "JetBrains Mono", letterSpacing: 2 };
    let lab = [];
    for (const it of items) {
      let a;
      if (it.w) a = proj(V, it.w[0], it.w[1], it.w[2]); else if (s.breakPt) a = s.breakPt; else continue;
      if (!(a[1] > 80 && a[1] < 862)) continue;
      lab.push({ ...it, ax: a[0], ay: a[1], y: a[1], tw: L.measure(ctx, it.txt, o) });
    }
    const maxRight = Math.max(0, ...lab.filter((l) => l.side > 0).map((l) => l.tw));
    const colR = Math.min(B.maxX + 24, 1920 - 90 - maxRight);
    const colL = Math.max(B.minX - 24, 110);
    const av = s.avoid;
    lab = lab.filter((l) => {
      if (l.side > 0 || !av) return true;
      const xl = colL - l.tw - 8;
      return !(l.y > av.y0 - 14 && l.y < av.y1 + 14 && xl < av.x1);
    });
    for (const side of [1, -1]) {
      const g = lab.filter((l) => l.side === side).sort((a, b) => a.ay - b.ay);
      for (let i = 1; i < g.length; i++) if (g[i].y < g[i - 1].y + 32) g[i].y = g[i - 1].y + 32;
      for (let i = g.length - 1; i >= 0; i--) { const lim = 850 - (g.length - 1 - i) * 32; if (g[i].y > lim) g[i].y = lim; }
    }
    for (const l of lab) {
      if (l.ay > 900 || l.ay < 70) continue;
      const tRev = s.tScan1 * invEio(clamp((l.ay - s.scanTop) / (s.scanBot - s.scanTop), 0, 1)) + 0.1;
      const k = l.red ? seg(s.tt, 0.15, 0.4) : seg(s.t, tRev, 0.5);
      if (k <= 0) continue;
      const col = l.red ? "#ff5a5f" : "#3fd2ff";
      const cx = l.side > 0 ? colR : colL;
      const ex = cx - 8 * l.side;
      const e = eo(k);
      ctx.save();
      ctx.globalAlpha = (l.red ? 0.95 : 0.55) * e;
      ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(l.ax, l.ay); const mx = L.lerp(l.ax, ex - 16 * l.side, e), my = L.lerp(l.ay, l.y, e); ctx.lineTo(mx, my); if (e > 0.99) ctx.lineTo(ex, l.y); ctx.stroke();
      ctx.fillStyle = col; ctx.globalAlpha = (l.red ? 1 : 0.8) * e; ctx.beginPath(); ctx.arc(l.ax, l.ay, l.red ? 4 : 2.6, 0, TAU); ctx.fill();
      ctx.restore();
      const tk = seg(k, 0.35, 0.65);
      if (tk > 0) {
        const str = l.txt.slice(0, Math.ceil(l.txt.length * tk));
        const pulse = l.red ? 0.8 + 0.2 * Math.sin(s.t * 8) : 1;
        L.text(ctx, str, cx, l.y + 5, { ...o, color: l.red ? "#ff7a7e" : "#a9e6ff", align: l.side > 0 ? "left" : "right", alpha: (l.red ? 1 : 0.7) * pulse, stroke: 4, strokeColor: "rgba(4,10,22,0.8)" });
      }
    }
  }

  // Hintergrund (Verlauf + Raster wie L.background, plus Lesbarkeits-Abdunklung) einmalig vorrendern und nur noch blitten.
  // Spart pro Frame den teuren Vollbild-Verlauf; Ergebnis identisch zum Engine-Hintergrund.
  const BG = {};
  function drawBackground(ctx, L, W, H, center) {
    const key = (center ? "c" : "l") + W + "x" + H;
    let c = BG[key];
    if (c === undefined) {
      c = null;
      try {
        const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
        const g = cv.getContext("2d");
        L.background(g, W, H, 0);
        if (center) {
          const rg = g.createRadialGradient(W / 2, 470, 60, W / 2, 470, 860);
          rg.addColorStop(0, "rgba(3,8,20,0.6)"); rg.addColorStop(1, "rgba(3,8,20,0)");
          g.fillStyle = rg; g.fillRect(0, 0, W, H);
        } else {
          const lg = g.createLinearGradient(0, 0, 1250, 0);
          lg.addColorStop(0, "rgba(3,8,20,0.5)"); lg.addColorStop(1, "rgba(3,8,20,0)");
          g.fillStyle = lg; g.fillRect(0, 0, 1250, H);
        }
        c = cv;
      } catch (e) { c = null; }
      BG[key] = c;
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    if (c) ctx.drawImage(c, 0, 0); else L.background(ctx, W, H, 0);
    ctx.restore();
  }

  CEX.register("title_card", {
    ownsText: true,
    background: false, // eigener (gecachter) Hintergrund, siehe drawBackground
    draw(ctx, p) {
      try {
        const P = (p && p.params) || {};
        const lay = String(pick(P, ["layout", "align", "variant"]) ?? "left").toLowerCase();
        drawBackground(ctx, p.L, p.W || 1920, p.H || 1080, /^(center|centre|mitte|zentriert)$/.test(lay));
      } catch (e) { try { p.L.background(ctx, p.W || 1920, p.H || 1080, 0); } catch (e2) { /* ignorieren */ } }
      try { drawCard(ctx, p); }
      catch (err) {
        // Notfall-Darstellung: niemals werfen
        try {
          const L = p && p.L; const P = (p && p.params) || {};
          if (L) L.heading(ctx, String(P.title || "Was passiert, wenn ein Aufzugseil reißt?").replace(/[*|]/g, " ").replace(/\\n/g, " "), 960, 520, { size: 64 });
        } catch (e2) { /* ignorieren */ }
      }
    },
  });
})();
