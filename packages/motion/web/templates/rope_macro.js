/* rope_macro – Makro-Nahaufnahme eines Stahldrahtseils (Tragseil) im Röntgen-/Blueprint-Stil.
   Seilmodell: 8 Litzen (8 × 19 Seale, Kreuzschlag) auf Fasereinlage – die Litzen sind echte Helices,
   die Außendrähte laufen gegenläufig (an der Litzenkrone nahezu achsparallel, wie beim Kreuzschlag).
   Params:
     broken_wires  int ≥ 0 (Default 0)   – Anzahl Drahtbrüche: rote Drahtenden, die nacheinander mit Funken herausspringen
     tension_glow  0..1   (Default 0,3)  – Amber-Spannungsglühen, das in Pulsen am Seil entlangläuft
     label         string (optional)     – Callout-Text (z. B. „Drahtbruch“)
     inspection    bool   (Default: broken_wires > 0) – Prüf-Lupe fährt am Seil entlang und zählt Drahtbrüche
     orientation   "diagonal" | "horizontal" (Default diagonal), angle (Grad, überschreibt)
     speed         px/s   (Default 12)   – Seillauf (Seil bewegt sich langsam entlang seiner Achse)
     diameter_mm   (Default 10), spec (Default "8 × 19 Seale · Fasereinlage"), dimension (Default true)
     count_label   (Default "Drahtbrüche") */
(function () {
  "use strict";
  const CE = window.CE;
  if (!CE || typeof CE.register !== "function") return;

  const TAU = Math.PI * 2, HALF = Math.PI / 2;
  // ---- Seilgeometrie (px): Ø 300 px ≙ Nenndurchmesser ----
  const RR = 150;                       // Seilradius
  const NS = 8;                         // Litzen
  const RS = 41;                        // Litzenradius (d_Litze ≈ 0,27 d)
  const RP = RR - RS;                   // Teilkreisradius der Litzenmitten
  const RSD = 38.8;                     // gezeichnete Litzen-Halbbreite: halber projizierter Litzenabstand -> Nachbarlitzen berühren sich exakt
  const LAY = 1740;                     // Seilschlaglänge ≈ 5,8 d
  const TH1 = TAU / LAY;                // dθ/ds
  const A = RP * TH1;                   // Steigung der projizierten Litzenachse
  const KB = Math.sqrt(1 + A * A);
  const NW = 9;                         // Außendrähte je Litze (Seale 1-9-9)
  const RW = 30;                        // Radius der Außendrahtmitten in der Litze
  const LAT = LAY / NS;                 // Raster der Litzenkronen entlang der Achse
  // Kreuzschlag: Drähte an der Krone ≈ achsparallel (≈ 0,9·KB·TH1·(RP+RW)/RW); exakt so gewählt,
  // dass das Muster mit LAT periodisch ist (Draht j -> j+5) – erlaubt ein gecachtes, verschiebbares Seilbild.
  const PSI1 = (5 * TAU) / (NW * LAT);
  const HH = RR + 58;                   // halbe Höhe des Streifens (inkl. Halo)
  const PIECE = 0.3, DELTA = 0.45;      // Zerlegung der Litzenbänder für Tiefensortierung
  const ZOOM = 1.2, RL = 250;           // Prüf-Lupe
  const RED = "#ff5a5f";

  // ---------- kleine Helfer ----------
  const num = (v, d) => { const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v); return Number.isFinite(n) ? n : d; };
  const pick = (o, keys, d) => { if (o && typeof o === "object") for (const k of keys) { const v = o[k]; if (v !== undefined && v !== null && v !== "") return v; } return d; };
  const bool = (v, d) => { if (v === undefined || v === null || v === "") return d; if (typeof v === "string") return !/^(false|0|no|nein|off|aus|none)$/i.test(v.trim()); return !!v; };
  const deNum = (x) => String(Math.round(x * 10) / 10).replace(".", ",");
  const H = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  function parseParams(pr) {
    let nb = Math.round(num(pick(pr, ["broken_wires", "brokenWires", "broken", "breaks", "wire_breaks", "drahtbrueche", "drahtbrüche"], 0), 0));
    nb = Math.max(0, Math.min(24, nb));
    const tg = Math.max(0, Math.min(1, num(pick(pr, ["tension_glow", "tensionGlow", "tension", "stress", "glow"], 0.3), 0.3)));
    const labelRaw = pick(pr, ["label", "callout", "callout_text"], "");
    const label = typeof labelRaw === "string" || typeof labelRaw === "number" ? String(labelRaw).trim() : "";
    const insp = bool(pick(pr, ["inspection", "inspect", "magnifier", "lens", "lupe"], undefined), nb > 0);
    const orient = String(pick(pr, ["orientation", "direction", "layout"], "diagonal")).toLowerCase();
    const angRaw = pick(pr, ["angle", "angle_deg", "rotation"], undefined);
    let angle = angRaw === undefined ? (orient.startsWith("h") ? 0 : -10) : num(angRaw, -10);
    angle = Math.max(-22, Math.min(8, angle)); // fallendes Seil nur leicht (sonst Konflikt mit Textfeld oben links)
    const speed = Math.max(-40, Math.min(40, num(pick(pr, ["speed", "scroll_speed", "rope_speed"], 12), 12)));
    const diameter = Math.max(1, num(pick(pr, ["diameter_mm", "diameter", "d_mm"], 10), 10));
    const specRaw = pick(pr, ["spec", "construction", "rope_type"], "8 × 19 Seale · Fasereinlage");
    const spec = typeof specRaw === "string" ? specRaw : "";
    const showDim = bool(pick(pr, ["dimension", "show_dimension", "dim"], undefined), true);
    const countLabel = String(pick(pr, ["count_label", "counter_label"], "Drahtbrüche"));
    return { nb, tg, label, insp, angle, speed, diameter, spec, showDim, countLabel };
  }

  // Seil-Koordinaten (u entlang der Achse, y quer) -> Bildschirm
  const toScreen = (S, u, y) => [S.CX + u * S.ca - y * S.sa, S.CY + u * S.sa + y * S.ca];
  const ropeTransform = (ctx, S) => { ctx.translate(S.CX, S.CY); ctx.rotate(S.ang); };

  // ---------- Drahtbrüche: Positionen auf Litzenkronen ----------
  const TYPE_TH = { top: -HALF, bottom: HALF, face: 0, up45: -Math.PI / 4, lo45: Math.PI / 4, up22: -Math.PI / 8, lo22: Math.PI / 8 };

  function buildBreaks(S) {
    const n = S.nb; const d = S.d;
    const out = { list: [], sFirst: 0, sLast: 0 };
    if (!n) return out;
    const cols = n <= 3 ? n : 4;
    // letzte Spalte (dort parkt die Lupe) unten, davor abwechselnd oben/unten; Einzelbruch oben
    const order = [["bottom", "top", "face", "lo45", "up45"], ["top", "bottom", "face", "up45", "lo45"]];
    const slots = [];
    for (let pass = 0; pass < 5 && slots.length < n; pass++) for (let c = 0; c < cols && slots.length < n; c++) slots.push({ col: c, type: n === 1 ? "top" : order[(cols - 1 - c) % 2][pass] });
    for (let pass = 0; pass < 2 && slots.length < n; pass++) for (let c = 0; c < cols - 1 && slots.length < n; c++) slots.push({ col: c + 0.5, type: pass ? "lo22" : "up22" });
    const span = (cols - 1) * LAT;
    const tS = 0.2 * d, tE = 0.62 * d;
    let uF = 60 - span / 2 - S.v * (tE - tS);
    const lo = -330, hi = 430 - span - S.v * (d - tS);
    uF = Math.max(lo, Math.min(uF, Math.max(lo, hi)));
    const iBase = Math.round((uF - S.v * tS) / LAT);
    slots.forEach((sl, i) => {
      const jit = (H(i * 7.3 + 1.1) - 0.5) * 44;
      const th = TYPE_TH[sl.type] + TH1 * jit;
      const edge = sl.type === "top" || sl.type === "bottom";
      const y0 = RR * Math.sin(th) * (edge ? 0.985 : 1);
      const dir = Math.sin(TYPE_TH[sl.type]) > 0 ? 1 : -1;
      out.list.push({ s: (iBase + sl.col) * LAT + jit, y0, dir, edge, face: !edge, type: sl.type, lenA: 26 + 10 * H(i * 3.7 + 2), lenB: 20 + 10 * H(i * 5.1 + 3), seed: 11 + i * 17 });
    });
    out.list.sort((a, b) => a.s - b.s);
    const m = out.list.length;
    out.list.forEach((b, j) => { b.ta = d * (m > 1 ? 0.08 + (0.34 * j) / (m - 1) : 0.14); });
    out.sFirst = out.list[0].s; out.sLast = out.list[m - 1].s;
    return out;
  }

  // ---------- Prüf-Lupe: Weg in Material-Koordinaten ----------
  // Sichtbarkeit eines Bruchs bei Lupen-Ruhelage (m, yL): 1 = vergrößert in der Lupe, 2 = außerhalb sichtbar, 0 = verdeckt
  function classify(b, m, yL) {
    const dx = b.s - m, dy = b.y0 + b.dir * 16 - yL;
    const dist = Math.hypot(dx, dy);
    if (ZOOM * (dist + 34) <= RL - 8) return 1;
    if (dist - 36 >= RL + 16) return 2;
    return 0;
  }
  function planLens(S, B) {
    const d = S.d, tS = 0.2 * d, tE = 0.62 * d;
    const plan = { tS, tE, mS: 0, mE: 0, yE: 0 };
    if (!B.list.length) { plan.mS = -520 - S.v * tS; plan.mE = 220 - S.v * tE; return plan; }
    plan.mS = Math.max(B.sFirst - 300, -600 - S.v * tS);
    const last = B.list[B.list.length - 1];
    // Lupe zur Kante des letzten Bruchs versetzen (unten: bis 45 % der Kantenhöhe, oben weniger – Platz für die Anzeige darüber)
    const yOpts = (last.y0 > 0 ? [0.45, 0.32, 0.18, 0] : [0.24, 0.16, 0.08, 0]).map((k) => k * last.y0);
    let best = null, bestScore = Infinity;
    for (const yE of yOpts) {
      for (let m = B.sLast - 150; m <= B.sLast + 40; m += 4) {
        let score = Math.abs(m - last.s) + Math.abs(yE - yOpts[0]) * 0.6;
        for (const b of B.list) if (!classify(b, m, yE)) score += 10000;
        if (classify(last, m, yE) !== 1) score += 4000;
        // Anzeige über der Lupe muss passen, Lupe darf nicht in den Untertitelbereich
        for (const tt of [tE, d]) {
          const ly = toScreen(S, m + S.v * tt, yE)[1];
          if (ly - RL - 30 - 62 < 208) score += 3000;
          if (ly + RL + 16 > 905) score += 3000;
        }
        if (score < bestScore) { bestScore = score; best = [m, yE]; }
      }
    }
    plan.mE = Math.max(best[0], plan.mS + 60); plan.yE = best[1];
    return plan;
  }
  const lensM = (L, plan, t) => L.lerp(plan.mS, plan.mE, L.easeInOut((t - plan.tS) / (plan.tE - plan.tS)));
  function crossTime(L, plan, target) {
    if (plan.mS >= target) return plan.tS;
    if (plan.mE < target) return Infinity;
    let a = 0, b = 1;
    for (let i = 0; i < 20; i++) { const q = (a + b) / 2; if (L.lerp(plan.mS, plan.mE, L.easeInOut(q)) < target) a = q; else b = q; }
    return plan.tS + b * (plan.tE - plan.tS);
  }

  // ---------- Seil zeichnen (in Seil-Koordinaten; nur beim einmaligen Vorrendern) ----------

  function strandLayer(ctx, S, uMin, uMax) {
    const sc = S.scroll;
    const bandHalf = HALF + DELTA;
    const nPc = Math.ceil((2 * bandHalf) / PIECE), pw = (2 * bandHalf) / nPc;
    const pcs = [];
    for (let k = 0; k < NS; k++) {
      const phi = (TAU * k) / NS;
      const thA = (uMin - sc) * TH1 + phi, thB = (uMax - sc) * TH1 + phi;
      const m0 = Math.ceil((thA - bandHalf) / TAU), m1 = Math.floor((thB + bandHalf) / TAU);
      for (let m = m0; m <= m1; m++) {
        const c0 = TAU * m - bandHalf;
        for (let q = 0; q < nPc; q++) {
          const a0 = c0 + q * pw, a1 = a0 + pw;
          if (a1 < thA || a0 > thB) continue;
          const mid = (a0 + a1) / 2 - TAU * m;
          pcs.push({ phi, a0: Math.max(a0, thA), a1: Math.min(a1, thB), z: Math.cos(mid), sn: Math.abs(Math.sin(mid)) });
        }
      }
    }
    // Maler-Algorithmus in z-Ebenen: Stücke gleicher Tiefe überlappen sich praktisch nie (Nachbarlitzen liegen π/4
    // auseinander, gezeichnete Halbbreite = halber projizierter Abstand) -> je Ebene gebündelte Draw-Calls.
    const buckets = [[], [], []];
    const NL = 26, levels = Array.from({ length: NL }, () => []);
    for (const pc of pcs) levels[Math.max(0, Math.min(NL - 1, Math.floor(((pc.z + 0.62) / 1.63) * NL)))].push(pc);
    const cyan = S.C.cyan;
    const EXT = 0.005;
    const samp = (pc, a0, a1) => {
      const n = Math.max(2, Math.ceil((a1 - a0) / 0.06));
      const e1 = [], e2 = [], cl = [];
      for (let i = 0; i <= n; i++) {
        const th = a0 + ((a1 - a0) * i) / n;
        const u = (th - pc.phi) / TH1 + sc;
        const sn = Math.sin(th), c = Math.cos(th);
        const yc = RP * sn, sl = A * c, inv = 1 / Math.sqrt(1 + sl * sl);
        const nx = -sl * inv * RSD, ny = inv * RSD;
        e1.push(u + nx, yc + ny); e2.push(u - nx, yc - ny); cl.push(u, yc);
      }
      return { e1, e2, cl };
    };
    const poly = (arr, dy = 0) => { ctx.moveTo(arr[0], arr[1] + dy); for (let i = 2; i < arr.length; i += 2) ctx.lineTo(arr[i], arr[i + 1] + dy); };
    ctx.lineJoin = "round"; ctx.lineCap = "butt";
    for (const lv of levels) {
      if (!lv.length) continue;
      const z = lv.reduce((acc, pc) => acc + pc.z, 0) / lv.length;
      const fz = Math.max(0, z), sn = Math.sqrt(Math.max(0, 1 - z * z));
      const ext = lv.map((pc) => samp(pc, pc.a0 - EXT, pc.a1 + EXT));
      const ex = lv.map((pc) => samp(pc, pc.a0, pc.a1));
      // Körper
      ctx.beginPath();
      for (const g of ext) { const n = g.e1.length; poly(g.e1); for (let i = n - 2; i >= 0; i -= 2) ctx.lineTo(g.e2[i], g.e2[i + 1]); ctx.closePath(); }
      ctx.globalAlpha = 1; ctx.fillStyle = S.fillGrad; ctx.fill();
      if (z < 0) { ctx.globalAlpha = Math.min(0.55, -z * 0.8 + 0.18); ctx.fillStyle = "#020812"; ctx.fill(); }
      // Glanz auf der Litzenkrone (Röhren-Schattierung)
      ctx.beginPath(); for (const g of ex) poly(g.cl, -5);
      ctx.strokeStyle = "#6fd6ff"; ctx.globalAlpha = 0.07; ctx.lineWidth = RS * 0.55; ctx.stroke();
      // Tal zwischen den Litzen abdunkeln (Röhrenform)
      ctx.beginPath(); for (const g of ex) { poly(g.e1); poly(g.e2); }
      ctx.globalAlpha = 0.66; ctx.strokeStyle = "#020a16"; ctx.lineWidth = 16; ctx.stroke();
      // Außendrähte (Kreuzschlag) – Sichtbarkeit nach Flächennormale, 3 Helligkeitsstufen, als Polylinien
      if (z > -0.4) {
        buckets[0].length = buckets[1].length = buckets[2].length = 0;
        for (const pc of lv) {
          const a0 = pc.a0, a1 = pc.a1;
          const nw = Math.max(3, Math.ceil((a1 - a0) / 0.045));
          for (let j = 0; j < NW; j++) {
            const pj = (TAU * j) / NW; let cur = null, curB = -1;
            for (let i = 0; i <= nw; i++) {
              const th = a0 + ((a1 - a0) * i) / nw;
              const s0 = (th - pc.phi) / TH1;
              const psi = pj + PSI1 * s0;
              const snt = Math.sin(th), c = Math.cos(th), cp = Math.cos(psi), sp = Math.sin(psi);
              const nz = cp * c + (sp * snt) / KB;
              const x = s0 + sc + (RW * sp * A) / KB, y = RP * snt + RW * (cp * snt - (sp * c) / KB);
              const bk = nz > 0.62 ? 2 : nz > 0.38 ? 1 : nz > 0.16 ? 0 : -1;
              if (bk !== curB) {
                if (cur && bk >= 0 && curB >= 0) cur.push(x, y);
                cur = bk >= 0 ? [x, y] : null; if (cur) buckets[bk].push(cur); curB = bk;
              } else if (cur) cur.push(x, y);
            }
          }
        }
        const wa = [0.16, 0.34, 0.6];
        for (let q = 0; q < 3; q++) {
          const B2 = buckets[q]; if (!B2.length) continue;
          ctx.beginPath(); for (const pl of B2) if (pl.length >= 4) poly(pl);
          ctx.globalAlpha = wa[q]; ctx.strokeStyle = "#aeeaff"; ctx.lineWidth = q === 2 ? 1.7 : 1.4; ctx.stroke();
        }
      }
      // Litzenkanten (Röntgen-Kontur) – leicht überlappend, damit an den Stößen keine Lücken entstehen
      ctx.beginPath(); for (const g of ext) { poly(g.e1); poly(g.e2); }
      ctx.strokeStyle = cyan;
      ctx.globalAlpha = 0.1; ctx.lineWidth = 6.5; ctx.stroke();
      ctx.globalAlpha = z < 0 ? 0.55 : 0.5 + 0.45 * sn; ctx.lineWidth = 1.7; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Durchleuchtung: Rückseite der Litzen + Fasereinlage schwach sichtbar (Röntgen-Effekt)
  function xrayLayer(ctx, S, uMin, uMax) {
    const sc = S.scroll;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    for (let k = 0; k < NS; k++) {
      const phi = (TAU * k) / NS;
      const thA = (uMin - sc) * TH1 + phi, thB = (uMax - sc) * TH1 + phi;
      const m0 = Math.ceil((thA - 1.5 * Math.PI) / TAU), m1 = Math.floor((thB - HALF) / TAU);
      for (let m = m0; m <= m1; m++) {
        const a0 = Math.max(thA, TAU * m + HALF + 0.15), a1 = Math.min(thB, TAU * m + 1.5 * Math.PI - 0.15);
        if (a1 <= a0) continue;
        const n = Math.max(2, Math.ceil((a1 - a0) / 0.09));
        for (let side = -1; side <= 1; side += 2) {
          for (let i = 0; i <= n; i++) {
            const th = a0 + ((a1 - a0) * i) / n;
            const u = (th - phi) / TH1 + sc, c = Math.cos(th);
            const sl = A * c, inv = 1 / Math.sqrt(1 + sl * sl);
            const x = u - side * sl * inv * RS, y = RP * Math.sin(th) + side * inv * RS;
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
        }
      }
    }
    ctx.strokeStyle = "rgba(63,210,255,0.085)"; ctx.lineWidth = 1.4; ctx.stroke();
    // Fasereinlage (Kern)
    const rc = RP - RS;
    ctx.beginPath(); ctx.moveTo(uMin, -rc); ctx.lineTo(uMax, -rc); ctx.moveTo(uMin, rc); ctx.lineTo(uMax, rc);
    ctx.setLineDash([5, 9.5]); ctx.lineDashOffset = -sc;
    ctx.strokeStyle = "rgba(255,179,71,0.10)"; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  }

  function haloLayer(ctx, uMin, uMax) {
    const w = uMax - uMin, ext = HH - RR;
    const g = ctx.createLinearGradient(0, -HH, 0, HH);
    const f = ext / (2 * HH);
    g.addColorStop(0, "rgba(63,210,255,0)"); g.addColorStop(f, "rgba(63,210,255,0.11)");
    g.addColorStop(1 - f, "rgba(63,210,255,0.11)"); g.addColorStop(1, "rgba(63,210,255,0)");
    ctx.fillStyle = g; ctx.fillRect(uMin, -HH, w, 2 * HH);
    // dunkle Unterlage (deckt Gitter zwischen den Litzen ab)
    ctx.fillStyle = "#06101f"; ctx.fillRect(uMin, -RR + 12, w, 2 * RR - 24);
  }

  function amberHaloLayer(ctx, uMin, uMax, k) {
    if (k <= 0) return;
    const ext = HH - RR + 10;
    for (let side = -1; side <= 1; side += 2) {
      const y0 = side * (RR - 6), y1 = side * (RR + ext);
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, `rgba(255,179,71,${k.toFixed(3)})`); g.addColorStop(0.35, `rgba(255,170,60,${(0.45 * k).toFixed(3)})`); g.addColorStop(1, "rgba(255,179,71,0)");
      ctx.fillStyle = g; ctx.fillRect(uMin, Math.min(y0, y1), uMax - uMin, Math.abs(y1 - y0));
    }
  }

  // ---------- Vorgerenderte Ebenen (einmal pro Neigung/Spannung; pro Frame nur ganzzahlig verschoben) ----------
  // Gedrehtes drawImage kostet in Software-Rastern > 20 ms, ganzzahliges Blitten < 1 ms.
  // Das Seil wird in senkrechte Kacheln mit enger Höhe zerlegt, damit kaum transparente Fläche geblittet wird.
  const mkCanvas = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

  function paintRope(c, S, uA, uB, amberK) {
    const fg = c.createLinearGradient(0, -RR, 0, RR);
    fg.addColorStop(0, "#06142a"); fg.addColorStop(0.3, "#0d2c4c"); fg.addColorStop(0.5, "#113456"); fg.addColorStop(0.75, "#0b2644"); fg.addColorStop(1, "#051226");
    const S0 = { scroll: 0, fillGrad: fg, C: S.C };
    amberHaloLayer(c, uA, uB, amberK);
    haloLayer(c, uA, uB);
    strandLayer(c, S0, uA, uB);
    xrayLayer(c, S0, uA, uB);
    // Mittellinie (Strich-Punkt) wie in technischer Zeichnung
    c.save(); c.setLineDash([46, 10, 6, 10]); c.strokeStyle = "rgba(63,210,255,0.22)"; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(uA, 0); c.lineTo(uB, 0); c.stroke(); c.restore();
  }

  const CACHE = []; // kleine LRU (Überblendungen zwischen zwei rope_macro-Szenen dürfen nicht neu rendern)
  const cacheGet = (key) => { const i = CACHE.findIndex((e) => e.key === key); if (i < 0) return null; const e = CACHE[i]; if (i) { CACHE.splice(i, 1); CACHE.unshift(e); } return e; };
  const cachePut = (e) => { CACHE.unshift(e); while (CACHE.length > 3) CACHE.pop(); return e; };

  // gedrehten Seilausschnitt (Welt-Rechteck x∈[XA,XB]) einmal rendern
  function renderBand(S, XA, XB, scale, uLo, uHi, amberK) {
    const sa = Math.abs(S.sa), tn = S.sa / S.ca, hb = HH / S.ca + 2;
    const ya = S.CY + (XA - S.CX) * tn, yb = S.CY + (XB - S.CX) * tn;
    const Y0 = Math.max(-160, Math.floor(Math.min(ya, yb) - hb)), Y1 = Math.min(1240, Math.ceil(Math.max(ya, yb) + hb));
    const cv = mkCanvas((XB - XA) * scale, (Y1 - Y0) * scale);
    const c = cv.getContext("2d");
    c.scale(scale, scale); c.translate(-XA, -Y0); ropeTransform(c, S);
    const uA = Math.max(uLo, (XA - S.CX - HH * sa) / S.ca - 60), uB = Math.min(uHi, (XB - S.CX + HH * sa) / S.ca + 60);
    paintRope(c, S, uA, uB, amberK);
    return { cv, X0: XA, Y0 };
  }

  function getLayers(S) {
    const tgQ = Math.round(S.tg * 20) / 20;
    const sh = S.v * S.d * S.ca;
    const XA = Math.floor(-40 - Math.max(0, sh)), XB = Math.ceil(1960 - Math.min(0, sh));
    const key = [S.angle.toFixed(3), S.CY, tgQ, XA, XB].join("|");
    const hit = cacheGet(key); if (hit) return hit;
    const tn = S.sa / S.ca, hb = HH / S.ca + 2;
    const amberK = 0.4 * tgQ;
    const big = renderBand(S, XA, XB, 1, -1e9, 1e9, amberK);
    const tiles = [];
    const TW = 280;
    for (let x0 = XA; x0 < XB; x0 += TW) {
      const x1 = Math.min(XB, x0 + TW);
      const ya = S.CY + (x0 - S.CX) * tn, yb = S.CY + (x1 - S.CX) * tn;
      const y0 = Math.max(big.Y0, Math.floor(Math.min(ya, yb) - hb)), y1 = Math.min(big.Y0 + big.cv.height, Math.ceil(Math.max(ya, yb) + hb));
      if (y1 <= y0) continue;
      const cv = mkCanvas(x1 - x0, y1 - y0);
      cv.getContext("2d").drawImage(big.cv, x0 - XA, y0 - big.Y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
      tiles.push({ cv, x: x0, y: y0 });
    }
    big.cv.width = big.cv.height = 1; // Speicher freigeben
    // Spannungs-Puls (elliptischer Amber-Glow, bereits gedreht, Alpha eingebacken)
    const ay = RR * 1.15, sx = 2.6, ax = sx * ay;
    const hx = Math.ceil(Math.hypot(ax * S.ca, ay * S.sa)), hy = Math.ceil(Math.hypot(ax * S.sa, ay * S.ca));
    let pulse = null;
    if (tgQ > 0) {
      pulse = mkCanvas(2 * hx, 2 * hy);
      const c = pulse.getContext("2d"); c.translate(hx, hy); c.rotate(S.ang); c.scale(sx, 1);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, ay); const k = Math.min(1, 0.5 * tgQ);
      g.addColorStop(0, `rgba(255,179,71,${k.toFixed(3)})`); g.addColorStop(0.5, `rgba(255,160,50,${(0.42 * k).toFixed(3)})`); g.addColorStop(1, "rgba(255,150,40,0)");
      c.fillStyle = g; c.fillRect(-ay, -ay, 2 * ay, 2 * ay);
    }
    return cachePut({ key, amberK, tiles, pulse, hx, hy, zoom: null });
  }

  // Vergrößerte Ebene für die Lupe (nur für den Weg, den die Lupe tatsächlich fährt)
  let LENS_SPRITES = null;
  function lensSprites() {
    if (LENS_SPRITES) return LENS_SPRITES;
    const RLP = RL + 4, RLW = RL + 16;
    // Lupen-Hintergrund (dunkler Verlauf + Raster), wird im Kreis-Clip geblittet
    const lensBg = mkCanvas(2 * RLW, 2 * RLW);
    {
      const g2 = lensBg.getContext("2d");
      g2.save(); g2.beginPath(); g2.arc(RLW, RLW, RL, 0, TAU); g2.clip();
      const g = g2.createRadialGradient(RLW, RLW, 10, RLW, RLW, RL);
      g.addColorStop(0, "#0d2442"); g.addColorStop(1, "#040b18");
      g2.fillStyle = g; g2.fillRect(0, 0, 2 * RLW, 2 * RLW);
      g2.strokeStyle = "rgba(80,170,255,0.08)"; g2.lineWidth = 1; g2.beginPath();
      for (let q = RLW % 72; q < 2 * RLW; q += 72) { g2.moveTo(q, 0); g2.lineTo(q, 2 * RLW); g2.moveTo(0, q); g2.lineTo(2 * RLW, q); }
      g2.stroke(); g2.restore();
    }
    const glass = mkCanvas(2 * RLP, 2 * RLP);
    {
      const g2 = glass.getContext("2d");
      const rim = g2.createRadialGradient(RLP, RLP, RL * 0.7, RLP, RLP, RL);
      rim.addColorStop(0, "rgba(4,10,22,0)"); rim.addColorStop(0.8, "rgba(20,70,110,0.10)"); rim.addColorStop(1, "rgba(63,210,255,0.22)");
      g2.fillStyle = rim; g2.beginPath(); g2.arc(RLP, RLP, RL, 0, TAU); g2.fill();
      g2.lineCap = "round"; g2.strokeStyle = "#eaf8ff";
      g2.globalAlpha = 0.17; g2.lineWidth = 7; g2.beginPath(); g2.arc(RLP, RLP, RL - 16, Math.PI * 1.1, Math.PI * 1.34); g2.stroke();
      g2.globalAlpha = 0.1; g2.lineWidth = 4; g2.beginPath(); g2.arc(RLP, RLP, RL - 16, Math.PI * 1.38, Math.PI * 1.44); g2.stroke();
      g2.globalAlpha = 0.06; g2.lineWidth = 5; g2.beginPath(); g2.arc(RLP, RLP, RL - 14, Math.PI * 0.12, Math.PI * 0.3); g2.stroke();
    }
    LENS_SPRITES = { RLP, RLW, lensBg, glass, rings: {} };
    return LENS_SPRITES;
  }
  function getZoom(Ly, S) {
    const q = 40;
    let lo = Math.floor((S.lensULo - RL / ZOOM - 60) / q) * q, hi = Math.ceil((S.lensUHi + RL / ZOOM + 60) / q) * q;
    if (Ly.zoom && Ly.zoom.lo <= lo && Ly.zoom.hi >= hi) return Ly.zoom;
    if (Ly.zoom) { lo = Math.min(lo, Ly.zoom.lo); hi = Math.max(hi, Ly.zoom.hi); } // Vereinigung -> kein Hin-und-her bei Überblendungen
    const xs = [toScreen(S, lo, -HH)[0], toScreen(S, lo, HH)[0], toScreen(S, hi, -HH)[0], toScreen(S, hi, HH)[0]];
    const XA = Math.floor(Math.min(...xs)) - 4, XB = Math.ceil(Math.max(...xs)) + 4;
    const band = renderBand(S, XA, XB, ZOOM, lo - 40, hi + 40, Ly.amberK);
    Ly.zoom = Object.assign({ lo, hi }, band, lensSprites());
    return Ly.zoom;
  }

  // Verschiebung des Seils (Seillauf) in Bildschirm-Koordinaten
  const scrollVec = (S) => [S.scroll * S.ca, S.scroll * S.sa];

  function drawRopeTiles(ctx, S, Ly) {
    const [svx, svy] = scrollVec(S);
    const dx = Math.round(svx), dy = Math.round(svy);
    for (const tl of Ly.tiles) {
      const x = tl.x + dx; if (x > 1960 || x + tl.cv.width < -40) continue;
      ctx.drawImage(tl.cv, x, tl.y + dy);
    }
  }

  // Spannungs-Glühen: Amber-Pulse laufen entlang des Seils
  function drawPulses(ctx, S, Ly) {
    if (!Ly.pulse) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    // ein Puls läuft in Seilrichtung durch das Bild (je höher die Spannung, desto schneller; Periode 3–5 s)
    const spd = 460 + 300 * S.tg, span = 2300;
    const uc = ((((S.t * spd + 450) % span) + span) % span) - span / 2;
    const [x, y] = toScreen(S, uc, 0);
    if (x > -Ly.hx && x < 1920 + Ly.hx) ctx.drawImage(Ly.pulse, Math.round(x - Ly.hx), Math.round(y - Ly.hy));
    ctx.restore();
  }

  // ---------- Drahtbrüche (Seil-Koordinaten; fertige Brüche gebündelt in wenigen Draw-Calls) ----------
  let GLOW = null; // kleines rotes Glow-Sprite
  function glowSprite() {
    if (GLOW) return GLOW;
    const r = 36, cv = mkCanvas(2 * r, 2 * r), c = cv.getContext("2d");
    const g = c.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, "rgba(255,90,95,1)"); g.addColorStop(0.25, "rgba(255,90,95,0.6)"); g.addColorStop(1, "rgba(255,90,95,0)");
    c.fillStyle = g; c.fillRect(0, 0, 2 * r, 2 * r);
    GLOW = { cv, r };
    return GLOW;
  }

  function addBreakPath(c, x, y0, b, g) {
    const e = b.dir;
    const sw = b.edge ? 44 : 34;
    c.moveTo(x - sw, y0); c.lineTo(x - 6, y0); c.moveTo(x + 6, y0); c.lineTo(x + sw - 6, y0);
    if (b.edge) {
      const lA = b.lenA * g, lB = b.lenB * g;
      c.moveTo(x - 6, y0); c.quadraticCurveTo(x - 7, y0 + e * lA * 0.6, x - 6 - lA * 0.45, y0 + e * lA);
      c.moveTo(x + 6, y0); c.quadraticCurveTo(x + 8, y0 + e * lB * 0.5, x + 6 + lB * 0.55, y0 + e * lB * 0.9);
    } else {
      const l = b.lenA * 0.85 * g;
      c.moveTo(x + 6, y0); c.quadraticCurveTo(x + 8, y0 + e * l * 0.4, x + 6 + l * 0.5, y0 + e * l * 0.8);
      c.moveTo(x - 6, y0); c.lineTo(x - 13, y0 + e * l * 0.3);
    }
  }
  function addTips(c, x, y0, b, g) {
    const e = b.dir;
    const pts = b.edge
      ? [[x - 6 - b.lenA * g * 0.45, y0 + e * b.lenA * g], [x + 6 + b.lenB * g * 0.55, y0 + e * b.lenB * g * 0.9]]
      : [[x + 6 + b.lenA * 0.85 * g * 0.5, y0 + e * b.lenA * 0.85 * g * 0.8]];
    for (const [px, py] of pts) { c.moveTo(px + 2.6, py); c.arc(px, py, 2.6, 0, TAU); }
  }
  function drawBreakVec(ctx, S, b, g, alpha) {
    const x = b.s + S.scroll;
    S.L.glowPath(ctx, (c) => addBreakPath(c, x, b.y0, b, g), RED, 2.8, 1, { alpha });
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = "#ffd6d6"; ctx.beginPath(); addTips(ctx, x, b.y0, b, g); ctx.fill(); ctx.restore();
  }
  // fertiger Bruch als vorgedrehtes Sprite (Blit statt Vektor)
  function breakSprite(Ly, S, b, scale = 1) {
    Ly.bsp = Ly.bsp || {};
    const key = b.seed + "|" + b.type + "|" + b.y0.toFixed(1) + "|" + scale;
    if (Ly.bsp[key]) return Ly.bsp[key];
    const R = Math.ceil(72 * scale), cv = mkCanvas(2 * R, 2 * R), c = cv.getContext("2d");
    c.translate(R, R); c.scale(scale, scale); c.rotate(S.ang);
    const gs = glowSprite(); // roter Schein eingebacken (spart einen Blit je Bruch)
    c.globalAlpha = 0.26; c.drawImage(gs.cv, -gs.r, b.dir * 8 - gs.r); c.globalAlpha = 1;
    S.L.glowPath(c, (q) => addBreakPath(q, 0, 0, b, 1), RED, 2.8, 1);
    c.fillStyle = "#ffd6d6"; c.beginPath(); addTips(c, 0, 0, b, 1); c.fill();
    return (Ly.bsp[key] = { cv, R });
  }
  const RINGS = {}; // gestrichelter Prüfmarkierungs-Ring (rotationsinvariant)
  function ringSprite(L, mr) {
    if (RINGS[mr]) return RINGS[mr];
    const R = mr + 16, cv = mkCanvas(2 * R, 2 * R), c = cv.getContext("2d");
    L.glowPath(c, (q) => q.arc(R, R, mr, 0, TAU), RED, 1.8, 0.6, { alpha: 0.85, dash: [7, 6] });
    return (RINGS[mr] = { cv, R });
  }

  // Brüche in der Lupe (ctx bereits auf den Lupenkreis beschnitten): fertige als vergrößerte Sprites, animierte als Vektor
  function drawBreaksLens(c, S, Ly, lx, ly) {
    let vec = false;
    for (const b of S.B.list) {
      const x = b.s + S.scroll; if (Math.abs(x - S.lens.u) > RL + 60) continue;
      const age = S.t - b.ta; if (age < -0.45) continue;
      if (age < 0.3) { vec = true; continue; }
      const [sx, sy] = toScreen(S, x, b.y0);
      const wx = lx + ZOOM * (sx - lx), wy = ly + ZOOM * (sy - ly);
      const sp = breakSprite(Ly, S, b, ZOOM);
      c.drawImage(sp.cv, Math.round(wx - sp.R), Math.round(wy - sp.R));
    }
    if (vec) {
      c.save(); c.translate(lx, ly); c.scale(ZOOM, ZOOM); c.translate(-lx, -ly); ropeTransform(c, S);
      const keepB = S.B;
      S.B = { list: keepB.list.filter((b) => { const age = S.t - b.ta; return age >= -0.45 && age < 0.3; }) };
      drawBreaksAll(c, S, S.lens.u - RL, S.lens.u + RL, true, Ly);
      S.B = keepB;
      c.restore();
    }
  }

  // Drahtbrüche + Markierungen. inLens: Vektor in Seil-Koordinaten (ctx bereits transformiert);
  // sonst Welt-Koordinaten mit Sprites für fertige Brüche.
  function drawBreaksAll(ctx, S, uMin, uMax, inLens, Ly) {
    const L = S.L;
    const gs = glowSprite();
    const anim = [];
    for (const b of S.B.list) {
      const x = b.s + S.scroll; if (x < uMin - 80 || x > uMax + 80) continue;
      const age = S.t - b.ta;
      if (age < -0.45) continue;
      if (age < 0 || age < 0.3 || inLens) { anim.push(b); continue; }
      const [sx, sy] = toScreen(S, x, b.y0);
      const sp = breakSprite(Ly, S, b);
      ctx.drawImage(sp.cv, Math.round(sx - sp.R), Math.round(sy - sp.R));
    }
    if (anim.length) {
      if (!inLens) { ctx.save(); ropeTransform(ctx, S); }
      for (const b of anim) {
        const x = b.s + S.scroll, age = S.t - b.ta;
        if (age < 0) { // Vorglühen: Spannungsspitze am Draht, kurz vor dem Bruch
          const k = L.clamp(1 + age / 0.45);
          L.glowDot(ctx, x, b.y0, 10 + 18 * k, S.C.amber, 0.25 + 0.6 * k);
          L.line(ctx, x - 30, b.y0, x + 30, b.y0, S.C.amber, 2, 0.8, { alpha: 0.3 + 0.6 * k });
          continue;
        }
        const aIn = L.clamp(age / 0.1);
        ctx.globalAlpha = (0.2 + 0.12 * L.pulse(S.t + b.seed * 0.1, 1.2)) * aIn;
        ctx.drawImage(gs.cv, x - gs.r, b.y0 + b.dir * 8 - gs.r);
        ctx.globalAlpha = 1;
        drawBreakVec(ctx, S, b, L.easeOutBack(L.clamp(age / 0.3)), aIn);
        if (age < 0.25) L.glowDot(ctx, x, b.y0, 30 + 90 * age, "#fff1e0", 1 - age / 0.25);
      }
      if (!inLens) ctx.restore();
    }
    if (!S.insp || inLens) return;
    // Prüfmarkierungen der gezählten Brüche
    const mr = S.B.list.length > 8 ? 27 : 36;
    const rs = ringSprite(L, mr);
    const rot = S.t * 0.6;
    ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 2; ctx.globalAlpha = 0.9; ctx.beginPath();
    let anyTick = false;
    for (const b of S.B.list) {
      const x = b.s + S.scroll; if (x < uMin - 80 || x > uMax + 80) continue;
      const k = L.clamp((S.t - b.tc) / 0.35); if (k <= 0) continue;
      const [mx, my] = toScreen(S, x, b.y0 + b.dir * (b.edge ? 12 : 6));
      if (k >= 1) {
        ctx.save(); ctx.globalAlpha = 1; ctx.drawImage(rs.cv, Math.round(mx - rs.R), Math.round(my - rs.R)); ctx.restore();
        for (let i = 0; i < 4; i++) { const a = rot + b.seed + (i * Math.PI) / 2; ctx.moveTo(mx + Math.cos(a) * (mr + 4), my + Math.sin(a) * (mr + 4)); ctx.lineTo(mx + Math.cos(a) * (mr + 12), my + Math.sin(a) * (mr + 12)); }
        anyTick = true;
      } else {
        const r = mr + 10 * (1 - L.easeOut(k));
        L.glowPath(ctx, (c) => c.arc(mx, my, r, 0, TAU), RED, 1.8, 0.6, { alpha: 0.85 * k, dash: [7, 6] });
      }
    }
    if (anyTick) ctx.stroke();
    ctx.restore();
  }

  // ---------- Overlays (Bildschirm-Koordinaten) ----------
  function drawSparks(ctx, S) {
    const L = S.L;
    for (const b of S.B.list) {
      const age = S.t - b.ta; if (age < 0 || age > 0.7) continue;
      const [sx, sy] = toScreen(S, b.s + S.scroll, b.y0);
      if (S.insp && S.lens && Math.hypot(sx - S.lens.x, sy - S.lens.y) < S.lens.r) continue;
      const dir = (b.dir < 0 ? -HALF : HALF) + S.ang;
      L.sparks(ctx, sx, sy, age, { seed: b.seed, count: 12, life: 0.5, speed: 360, gravity: 700, window: 0.05, dir, spread: 1.9 });
    }
  }

  function drawDust(ctx, S) {
    const L = S.L;
    ctx.save();
    for (let i = 0; i < 26; i++) {
      const x = ((H(i * 3.1) * 2100 + S.t * (6 + 12 * H(i * 1.7))) % 2100) - 90;
      const y = 200 + H(i * 7.7) * 680 + Math.sin(S.t * 0.5 + i) * 12;
      const a = 0.18 + 0.2 * (0.5 + 0.5 * Math.sin(S.t * 1.3 + i * 2.1));
      ctx.globalAlpha = a; ctx.fillStyle = i % 5 === 0 ? L.C.amber : L.C.cyan;
      ctx.beginPath(); ctx.arc(x, y, 1.2 + 1.8 * H(i * 1.3), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // Glas + Fassung der Lupe (Glow-Ring, Außenring, Skala, Fadenkreuz-Marken) als ein Sprite je Neigung
  function lensRing(Z, S) {
    const key = S.angle.toFixed(3);
    if (Z.rings[key]) return Z.rings[key];
    const RO = RL + 34, cv = mkCanvas(2 * RO, 2 * RO), c = cv.getContext("2d"), L = S.L;
    c.drawImage(Z.glass, RO - Z.RLP, RO - Z.RLP);
    L.circle(c, RO, RO, RL, S.C.cyan, 3, 1);
    c.globalAlpha = 0.45; c.strokeStyle = S.C.cyan; c.lineWidth = 1.2; c.beginPath(); c.arc(RO, RO, RL + 13, 0, TAU); c.stroke();
    c.globalAlpha = 0.6; c.lineWidth = 1.5; c.beginPath();
    for (let i = 0; i < 72; i++) { const a = (i * TAU) / 72; const len = i % 6 === 0 ? 12 : 5; c.moveTo(RO + Math.cos(a) * (RL + 17), RO + Math.sin(a) * (RL + 17)); c.lineTo(RO + Math.cos(a) * (RL + 17 + len), RO + Math.sin(a) * (RL + 17 + len)); }
    c.stroke();
    c.globalAlpha = 0.9; c.lineWidth = 2.2; c.beginPath();
    for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2 + S.ang; c.moveTo(RO + Math.cos(a) * (RL - 22), RO + Math.sin(a) * (RL - 22)); c.lineTo(RO + Math.cos(a) * (RL - 5), RO + Math.sin(a) * (RL - 5)); }
    c.stroke();
    return (Z.rings[key] = { cv, RO });
  }

  function drawLens(ctx, S, Ly) {
    const C = S.C, Lz = S.lens;
    const r = Lz.r; if (r < 2) return;
    const lx = Lz.x, ly = Lz.y;
    const Z = getZoom(Ly, S), RLW = Z.RLW;
    const [svx, svy] = scrollVec(S);
    // Kreis-Clip direkt im Hauptbild; nur ganzzahlige Blits (Hintergrund + Ausschnitt der vergrößerten Seilebene)
    const ox = Math.round(lx - RLW), oy = Math.round(ly - RLW);
    ctx.save();
    ctx.beginPath(); ctx.arc(lx, ly, Math.min(r, RL), 0, TAU); ctx.clip();
    ctx.drawImage(Z.lensBg, ox, oy);
    const sx = Math.round(ZOOM * (lx - svx - Z.X0) - RLW), sy = Math.round(ZOOM * (ly - svy - Z.Y0) - RLW);
    const x0 = Math.max(0, sx), y0 = Math.max(0, sy), x1 = Math.min(Z.cv.width, sx + 2 * RLW), y1 = Math.min(Z.cv.height, sy + 2 * RLW);
    if (x1 > x0 && y1 > y0) ctx.drawImage(Z.cv, x0, y0, x1 - x0, y1 - y0, ox + x0 - sx, oy + y0 - sy, x1 - x0, y1 - y0);
    drawBreaksLens(ctx, S, Ly, lx, ly);
    ctx.restore();
    // Glas + Fassung (ein Sprite), dazu ein umlaufender Scan-Bogen als Bewegung
    const ring = lensRing(Z, S), RO = ring.RO;
    if (r >= RL - 0.5) ctx.drawImage(ring.cv, Math.round(lx - RO), Math.round(ly - RO));
    else { const gs = r / RL; ctx.save(); ctx.globalAlpha = Lz.a; ctx.drawImage(ring.cv, lx - RO * gs, ly - RO * gs, 2 * RO * gs, 2 * RO * gs); ctx.restore(); }
    const rot = S.t * 0.9;
    ctx.save(); ctx.globalAlpha = 0.85 * Lz.a; ctx.strokeStyle = C.cyan; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath();
    for (let i = 0; i < 3; i++) { const a0 = rot + (i * TAU) / 3; ctx.moveTo(lx + Math.cos(a0) * (r + 13), ly + Math.sin(a0) * (r + 13)); ctx.arc(lx, ly, r + 13, a0, a0 + 0.22); }
    ctx.stroke(); ctx.restore();
  }

  const READ = {};
  function drawReadout(ctx, S) {
    const L = S.L, C = S.C, Lz = S.lens;
    const a = Lz.a; if (a <= 0.01) return;
    const cnt = S.count;
    const lab = S.countLabel + ":";
    const pop = L.clamp(1 - (S.t - S.lastCountT) / 0.35);
    const fs = 32, ns = 38 * (1 + 0.28 * pop);
    let sp = READ[lab];
    if (!sp) { // Panel + Beschriftung einmal rendern
      const mc = mkCanvas(4, 4).getContext("2d");
      const wl = L.measure(mc, lab, { size: fs, weight: 600 }), wn = L.measure(mc, "00", { size: 38, weight: 700, font: L.FONT.mono });
      const w = Math.ceil(wl + wn + 58), h = 62, pad = 12;
      const cv = mkCanvas(w + 2 * pad, h + 2 * pad), c = cv.getContext("2d");
      L.panel(c, pad, pad, w, h, { fill: "rgba(4,12,26,0.88)", stroke: C.cyanSoft, r: 6 });
      L.fillRect(c, pad, pad + 10, 5, h - 20, C.cyan);
      L.text(c, lab, pad + 24, pad + h / 2 + 11, { size: fs, weight: 600, color: C.white });
      sp = READ[lab] = { cv, w, h, pad, wl, wn };
    }
    const { w, h, wl, wn } = sp;
    let x = Lz.x - w / 2, y = Lz.y - Lz.r - 30 - h;
    x = Math.round(Math.max(116, Math.min(1800 - w, x))); y = Math.round(Math.max(208, y));
    S.readoutRect = { x, y, w, h };
    const done = S.t > S.plan.tE + 0.1;
    const col = cnt > 0 ? RED : (done ? C.green : C.cyan);
    ctx.save(); ctx.globalAlpha = a; ctx.drawImage(sp.cv, x - sp.pad, y - sp.pad);
    // Führungslinie zur Lupe
    const tx = Math.round(Math.max(x + 20, Math.min(x + w - 20, Lz.x))) + 0.5;
    ctx.globalAlpha = a * 0.6; ctx.strokeStyle = C.cyan; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(tx, y + h); ctx.lineTo(tx, Math.max(y + h, Lz.y - Lz.r - 16)); ctx.stroke();
    ctx.restore();
    L.text(ctx, String(cnt), x + 24 + wl + 14 + wn / 2, y + h / 2 + 13 + (ns - 38) * 0.3, { size: ns, weight: 700, font: L.FONT.mono, color: col, align: "center", alpha: a, glow: pop > 0.02 ? 10 * pop : 0, glowColor: col });
  }

  function drawCallout(ctx, S) {
    const L = S.L, C = S.C;
    if (!S.label || !S.call) return;
    const k = L.clamp((S.t - S.call.t0) / Math.max(0.6, 0.12 * S.d)); if (k <= 0) return;
    const col = S.call.color;
    const [tx, ty] = S.call.pos();
    const r = S.call.r;
    const size = 30, lh = 40, maxW = 520;
    const lines = L.wrap(ctx, S.label, maxW, { size, weight: 600 }).slice(0, 3);
    const tw = Math.max(...lines.map((ln) => L.measure(ctx, ln, { size, weight: 600 })));
    const w = tw + 52, h = size + 26 + lh * (lines.length - 1);
    // Leitlinie: vom Markierungskreis schräg nach oben, dann waagrecht zur Box
    let side = -1;
    const cpx = tx + side * r * 0.7, cpy = ty - r * 0.7;
    let ex = cpx + side * 46, ey = cpy - 64;
    let bx = ex + side * 22 - (side < 0 ? w : 0);
    if (bx < 116) { side = 1; ex = tx + r * 0.7 + 46; bx = ex + 22; }
    const qx = tx + side * r * 0.7;
    let by = ey + 22 - h; by = Math.max(210, by);
    // nicht mit der Lupen-Anzeige kollidieren: erst seitlich ausweichen, sonst nach oben
    const R = S.readoutRect;
    if (R && bx < R.x + R.w + 16 && bx + w > R.x - 16 && by < R.y + R.h + 12 && by + h > R.y - 12) {
      if (side < 0 && R.x - 36 - w >= 116) bx = R.x - 36 - w;
      else if (side > 0 && R.x + R.w + 36 + w <= 1800) bx = R.x + R.w + 36;
      else if (R.y - 14 - h >= 208) by = R.y - 14 - h;
    }
    if (side > 0) bx = Math.min(bx, 1800 - w);
    const joinY = Math.min(Math.max(ey, by + 18), by + h - 18);
    const kl = L.easeOut(L.clamp(k / 0.45));
    // Markierungskreis
    if (!S.call.noCircle) L.glowPath(ctx, (c) => c.arc(tx, ty, r, 0, TAU), col, 2, 0.8, { alpha: kl });
    const px1 = L.lerp(qx, ex, kl), py1 = L.lerp(cpy, joinY, kl);
    L.glowPath(ctx, (c) => { c.moveTo(qx, cpy); c.lineTo(px1, py1); if (kl >= 1) c.lineTo(side < 0 ? bx + w : bx, joinY); }, col, 1.8, 0.7, { alpha: kl });
    const kb = L.easeOut(L.clamp((k - 0.35) / 0.35)); if (kb <= 0) return;
    const bw = w * kb, bxx = side < 0 ? bx + w - bw : bx;
    L.panel(ctx, bxx, by, bw, h, { fill: "rgba(4,12,26,0.88)", stroke: col === RED ? C.redSoft : C.cyanSoft, r: 8, alpha: kb });
    L.fillRect(ctx, bxx, by + 10, 5, h - 20, col);
    const kt = L.clamp((k - 0.6) / 0.3);
    lines.forEach((ln, i) => L.text(ctx, ln, bx + 26, by + 13 + size * 0.86 + i * lh, { size, weight: 600, color: C.white, alpha: kt }));
  }

  // Bemaßung (Ø) als einmal gerendertes Sprite; pro Frame nur Blit mit Alpha
  const DIMS = {};
  function dimSprite(S) {
    const L = S.L, C = S.C, u = S.dimU;
    const below = S.angle < -3;
    const t1 = `Ø ${deNum(S.diameter)} mm`;
    const key = [S.angle.toFixed(3), S.CY, t1, S.spec, u].join("|");
    if (DIMS[key]) return DIMS[key];
    const [ax, ay] = toScreen(S, u, below ? RR + 80 : -RR - 80);
    const mc = document.createElement("canvas").getContext("2d");
    const w2 = S.spec ? L.measure(mc, S.spec, { size: 22, weight: 400 }) : 0;
    const W1 = L.measure(mc, t1, { size: 30, weight: 700, font: L.FONT.mono });
    const right = Math.min(1770, ax + Math.max(W1, w2) / 2);
    const ty = below ? ay + 42 : ay - 50;
    const pts = [toScreen(S, u - 10, -RR - 84), toScreen(S, u + 10, -RR - 84), toScreen(S, u - 10, RR + 84), toScreen(S, u + 10, RR + 84)];
    const X0 = Math.floor(Math.min(right - Math.max(W1, w2) - 10, ...pts.map((q) => q[0])) - 8), X1 = Math.ceil(Math.max(right + 10, ...pts.map((q) => q[0])) + 8);
    const Y0 = Math.floor(Math.min(ty - 36, ...pts.map((q) => q[1])) - 8), Y1 = Math.ceil(Math.max(ty + 44, ...pts.map((q) => q[1])) + 8);
    const cv = mkCanvas(X1 - X0, Y1 - Y0), c = cv.getContext("2d");
    c.translate(-X0, -Y0);
    c.save(); ropeTransform(c, S);
    const arrow = (y1, y2) => {
      L.line(c, u, y1, u, y2, C.cyan, 1.6, 0.5);
      const dir = Math.sign(y2 - y1);
      c.fillStyle = C.cyan; c.beginPath(); c.moveTo(u, y2); c.lineTo(u - 7, y2 - dir * 18); c.lineTo(u + 7, y2 - dir * 18); c.closePath(); c.fill();
    };
    arrow(-RR - 80, -RR - 3); arrow(RR + 80, RR + 3);
    c.globalAlpha = 0.5; c.setLineDash([4, 7]); c.strokeStyle = C.cyan; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(u, -RR); c.lineTo(u, RR); c.stroke();
    c.restore();
    L.text(c, t1, right, ty, { size: 30, weight: 700, font: L.FONT.mono, color: C.cyan, align: "right" });
    if (S.spec) L.text(c, S.spec, right, ty + 32, { size: 22, weight: 400, color: C.muted, align: "right" });
    return (DIMS[key] = { cv, X0, Y0 });
  }
  function drawDimension(ctx, S) {
    const L = S.L;
    if (!S.showDim) return;
    let a = L.clamp((S.t - 0.03 * S.d) / Math.max(0.4, 0.08 * S.d));
    if (S.lens && S.lens.r > 0) a *= L.inv(RL + 230, RL + 330, Math.abs(S.dimU - S.lens.u)); // Lupe in der Nähe -> Bemaßung ausblenden
    if (a <= 0.01) return;
    const sp = dimSprite(S);
    ctx.save(); ctx.globalAlpha = a; ctx.drawImage(sp.cv, sp.X0, sp.Y0); ctx.restore();
  }

  // ---------- Hauptfunktion ----------
  function render(ctx, p) {
    const L = p.L;
    const t = Math.max(0, num(p.t, 0)), d = Math.max(1, num(p.d, 8));
    const cfg = parseParams(p.params || {});
    const ang = (cfg.angle * Math.PI) / 180;
    const S = Object.assign({ L, C: L.C, t, d, ang, ca: Math.cos(ang), sa: Math.sin(ang), CX: 960, CY: cfg.angle === 0 ? 575 : cfg.angle > 0 ? 600 : 590 }, cfg);
    S.v = Math.sign(cfg.speed) * Math.min(Math.abs(cfg.speed), 200 / d);
    S.scroll = S.v * t;
    S.B = buildBreaks(S);
    S.dimU = 745;
    const ext = 1000 / Math.max(0.5, S.ca) + 260;
    const uMin = -ext, uMax = ext;

    // Zeitplan der Prüf-Lupe
    S.plan = planLens(S, S.B);
    S.count = 0; S.lastCountT = -99;
    for (const b of S.B.list) {
      b.tc = S.insp ? Math.max(crossTime(L, S.plan, b.s - 150), b.ta + 0.2) : Infinity;
      if (t >= b.tc) { S.count++; S.lastCountT = Math.max(S.lastCountT, b.tc); }
    }
    S.lens = null;
    if (S.insp) {
      const open = L.easeOut(L.seg(t, 0.12 * d, Math.max(0.3, 0.08 * d)));
      const m = t < S.plan.tS ? S.plan.mS : lensM(L, S.plan, t);
      const u = m + S.scroll;
      const yl = S.plan.yE * L.smooth(L.inv(S.plan.tS + 0.55 * (S.plan.tE - S.plan.tS), S.plan.tE, t));
      const [x, y] = toScreen(S, u, yl);
      S.lens = { u, yl, x, y, r: RL * Math.max(0, open), a: L.clamp(open) };
      S.lensULo = Math.min(S.plan.mS, S.plan.mE) + Math.min(0, S.v * d);
      S.lensUHi = Math.max(S.plan.mS, S.plan.mE) + Math.max(0, S.v * d);
    }

    const Ly = getLayers(S);
    ctx.save();
    drawDust(ctx, S);
    drawRopeTiles(ctx, S, Ly);
    drawPulses(ctx, S, Ly);
    drawBreaksAll(ctx, S, uMin, uMax, false, Ly);
    drawSparks(ctx, S);
    drawDimension(ctx, S);
    if (S.lens) drawLens(ctx, S, Ly);

    // Callout-Ziel bestimmen
    if (S.label) {
      let target = null, magnified = false;
      const list = S.B.list;
      if (list.length) {
        const vis = (b) => (S.insp ? classify(b, S.plan.mE, S.plan.yE) : 2);
        const outs = list.filter((b) => vis(b) === 2);
        const outTops = outs.filter((b) => b.type === "top");
        if (outTops.length) target = S.insp ? outTops[outTops.length - 1] : outTops[Math.floor((outTops.length - 1) / 2)];
        else if (outs.length) target = outs[outs.length - 1];
        else {
          const ins = list.filter((b) => vis(b) === 1);
          target = ins.find((b) => b.type === "top") || ins[ins.length - 1] || list[list.length - 1];
          magnified = S.insp;
        }
      }
      const t0 = S.insp ? 0.52 * d : list.length ? Math.min(0.56 * d, list[list.length - 1].ta + 0.35) : 0.22 * d;
      const color = list.length ? RED : L.C.cyan;
      if (target) {
        const b = target;
        S.call = {
          t0, color, r: magnified ? 36 * ZOOM + 4 : 40, noCircle: S.insp && !magnified,
          pos: () => {
            const yy = b.y0 + b.dir * (b.edge ? 12 : 6);
            const [sx, sy] = toScreen(S, b.s + S.scroll, yy);
            if (magnified && S.lens) return [S.lens.x + (sx - S.lens.x) * ZOOM, S.lens.y + (sy - S.lens.y) * ZOOM];
            return [sx, sy];
          },
        };
      } else {
        const sT = Math.round((-160 - S.v * d * 0.6) / LAT) * LAT;
        S.call = { t0, color, r: 30, pos: () => toScreen(S, sT + S.scroll, -RR + 6) };
      }
    }
    if (S.lens) drawReadout(ctx, S);
    drawCallout(ctx, S);
    ctx.restore();
  }

  CE.register("rope_macro", {
    ownsText: false,
    draw(ctx, p) {
      ctx.save();
      try { render(ctx, p); }
      catch (e) { /* nie werfen – bei unerwarteten Daten bleibt das bisher Gezeichnete stehen */ }
      finally { ctx.restore(); }
    },
  });
})();
