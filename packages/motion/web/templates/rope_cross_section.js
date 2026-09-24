/* Szene "rope_cross_section": Querschnitt eines Stahldrahtseils (Tragseil).
   Aufbau: Einlage -> Litzen fliegen ein und setzen sich -> Drähte leuchten auf (Zähler) -> Callouts
   (Einlage, Litze, Draht) -> Durchmesser-Bemaßung. Litzengeometrie für Seale 1+9+9 exakt berechnet.
   Params: strands (8), wires_per_strand (19), diameter_mm (10), labels (true | {einlage, litze, draht}),
   optional: core ("fibre" | "steel"), broken_wires (0), summary (true), ruler (true), title ("Tragseil"). */
(function () {
  const TAU = Math.PI * 2;
  const LAYOUTS = new Map();
  let FIBRES = null;
  const BODY = new Map(); // Textur-Cache des statischen Seilkörpers (je Geometrie)
  const HALO = new Map(); // weicher Lichtsaum um das Seil (je Radius), als Textur – ein Gradient pro Frame wäre teuer

  function haloTexture(Rr) {
    let cv = HALO.get(Rr);
    if (cv || typeof document === "undefined") return cv || null;
    const R = Rr + 95, S = Math.ceil(R * 2 + 4);
    cv = document.createElement("canvas"); cv.width = cv.height = S;
    const g = cv.getContext("2d"); if (!g) return null;
    const c = S / 2, gl = g.createRadialGradient(c, c, Rr - 10, c, c, R);
    gl.addColorStop(0, "rgba(63,210,255,0.10)"); gl.addColorStop(0.35, "rgba(63,210,255,0.045)"); gl.addColorStop(1, "rgba(63,210,255,0)");
    g.fillStyle = gl; g.beginPath(); g.arc(c, c, R, 0, TAU); g.moveTo(c + Rr - 10, c); g.arc(c, c, Rr - 10, 0, TAU, true); g.fill();
    HALO.set(Rr, cv); return cv;
  }

  // ---------- kleine Helfer ----------
  const toNum = (v, d) => {
    if (typeof v === "string") v = parseFloat(v.replace(",", "."));
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const pick = (o, keys, d) => {
    if (o && typeof o === "object") for (const k of keys) { const v = o[k]; if (v !== undefined && v !== null && v !== "") return v; }
    return d;
  };
  const toBool = (v, d) => {
    if (v === undefined || v === null || v === "") return d;
    if (typeof v === "string") return !/^(false|0|no|nein|off|aus|none)$/i.test(v.trim());
    return !!v;
  };
  const clampInt = (v, a, b) => Math.max(a, Math.min(b, Math.round(v)));
  /** Deutsche Zahl: 1 Nachkommastelle (2 bei < 0,1), ohne ",0". */
  const deNum = (x) => {
    const dec = Math.abs(x) < 0.1 ? 2 : 1;
    const f = Math.pow(10, dec); const r = Math.round(x * f) / f;
    return (Number.isInteger(r) ? String(r) : r.toFixed(dec).replace(/0+$/, "")).replace(".", ",");
  };
  const angDist = (a, b) => { let d = (a - b) % TAU; if (d < 0) d += TAU; return Math.min(d, TAU - d); };
  const rgb = (a, b, k) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * k)},${Math.round(a[1] + (b[1] - a[1]) * k)},${Math.round(a[2] + (b[2] - a[2]) * k)})`;

  // ---------- Litzen-Aufbau (Einheitskreis: Litzenradius = 1) ----------
  /** Ringe von außen nach innen packen. spec.rings: innen -> außen [{n, alt}]; gleiche Drahtzahl
      benachbarter Lagen => Seale-Verschachtelung (Drähte liegen in den Tälern, exakt gelöst). */
  function packRings(spec) {
    const wires = []; const rings = spec.rings; const off = spec.center ? 1 : 0;
    let A = 1, prev = null;
    for (let k = rings.length - 1; k >= 0; k--) {
      const n = rings[k].n, sn = Math.sin(Math.PI / n), cs = Math.cos(Math.PI / n);
      let R, r, phase;
      if (n === 1) { r = A; R = 0; phase = 0; }
      else if (prev && prev.n === n && !prev.alt && n > 2) {
        // innere Lage in den Tälern der äußeren: |P1-P2| = r1 + r2, r1 = R1*sin(pi/n)
        const a = cs * cs, b = -2 * (prev.R * cs + sn * prev.r), c = prev.R * prev.R - prev.r * prev.r;
        R = (-b - Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a); r = R * sn; phase = prev.phase + Math.PI / n;
      } else {
        r = (A * sn) / (1 + sn); R = A - r;
        phase = prev ? prev.phase + (prev.alt ? (TAU / prev.n) : 0) : 0;
      }
      let env = Infinity;
      for (let m = 0; m < n; m++) {
        let rr = r, RR = R;
        if (rings[k].alt) { rr = r * (m % 2 === 0 ? 1.2 : 0.74); RR = R + (r - rr); }
        wires.push({ a: phase + (m * TAU) / n, R: RR, r: rr * 0.985, layer: k + off });
        env = Math.min(env, RR - rr);
      }
      A = env; prev = { n, R, r, phase, alt: !!rings[k].alt };
    }
    if (spec.center) wires.push({ a: 0, R: 0, r: Math.max(0.02, A * 0.985), layer: 0 });
    return wires;
  }

  function layoutFor(W) {
    if (LAYOUTS.has(W)) return LAYOUTS.get(W);
    let wires, desc, suf = "";
    if (W === 1) { wires = [{ a: 0, R: 0, r: 0.98, layer: 0 }]; desc = "1 Draht"; }
    else if (W <= 4) { wires = packRings({ center: false, rings: [{ n: W }] }); desc = `${W} Drähte`; }
    else if (W <= 7) { wires = packRings({ center: true, rings: [{ n: W - 1 }] }); desc = `1 + ${W - 1}`; }
    else if (W === 19) { wires = packRings({ center: true, rings: [{ n: 9 }, { n: 9 }] }); desc = "Seale 1 + 9 + 9"; suf = "S"; }
    else if (W === 25) {
      wires = [{ a: 0, R: 0, r: 0.19, layer: 0 }];
      for (let m = 0; m < 6; m++) wires.push({ a: (m * TAU) / 6, R: 0.3925, r: 0.19, layer: 1 });
      for (let m = 0; m < 6; m++) wires.push({ a: (m * TAU) / 6 + TAU / 12, R: 0.517, r: 0.066, layer: 2 });
      for (let m = 0; m < 12; m++) wires.push({ a: (m * TAU) / 12, R: 0.7944, r: 0.2025, layer: 3 });
      desc = "Filler 1 + 6 + 6F + 12"; suf = "F";
    } else if (W === 26 || W === 31 || W === 36 || W === 41) {
      const k = (W - 1) / 5;
      wires = packRings({ center: true, rings: [{ n: k }, { n: 2 * k, alt: true }, { n: 2 * k }] });
      desc = `Warrington-Seale 1 + ${k} + (${k} + ${k}) + ${2 * k}`; suf = "WS";
    } else {
      let K = 1; while (1 + 3 * K * (K + 1) < W) K++;
      const rem = W - 1, cap = 3 * K * (K + 1); const counts = [];
      for (let k = 1; k <= K; k++) counts.push(Math.max(3, Math.round((6 * k * rem) / cap)));
      counts[K - 1] += rem - counts.reduce((a, b) => a + b, 0);
      if (counts[K - 1] < 3 && K > 1) { counts[K - 2] += counts[K - 1]; counts.pop(); }
      wires = packRings({ center: true, rings: counts.map((n) => ({ n })) });
      desc = "1 + " + counts.join(" + ");
    }
    const nLayers = wires.reduce((m, w) => Math.max(m, w.layer), 0) + 1;
    const layers = Array.from({ length: nLayers }, () => []);
    wires.forEach((w) => layers[w.layer].push(w));
    const outerL = layers[nLayers - 1];
    let outer = outerL[0];
    for (const w of outerL) if (w.R + w.r > outer.R + outer.r + 1e-6 || (Math.abs(w.R + w.r - outer.R - outer.r) < 1e-6 && angDist(w.a, 0) < angDist(outer.a, 0))) outer = w;
    const res = { wires, layers, desc, suf, outer, count: wires.length };
    LAYOUTS.set(W, res);
    return res;
  }

  /** Faserpositionen der Fasereinlage (3 Garne, deterministisch). */
  function fibres() {
    if (FIBRES) return FIBRES;
    const pts = [];
    const L = window.CE.lib;
    for (let y = 0; y < 3; y++) {
      for (let k = 0; k < 70; k++) {
        const rr = Math.sqrt(L.hash01(y * 311 + k * 7.3)) * 0.9, aa = L.hash01(y * 97 + k * 3.1) * TAU;
        pts.push([y, rr * Math.cos(aa), rr * Math.sin(aa), L.hash01(k * 13.7 + y)]);
      }
    }
    FIBRES = pts; return pts;
  }

  // ---------- Text passend machen ----------
  function fitText(ctx, L, str, o, maxW) {
    const oo = Object.assign({}, o);
    let w = L.measure(ctx, str, oo);
    while (w > maxW && oo.size > (o.minSize || 14)) { oo.size -= 1; w = L.measure(ctx, str, oo); }
    let s = str;
    while (w > maxW && s.length > 3) { s = s.slice(0, -2) + "…"; w = L.measure(ctx, s, oo); }
    return { str: s, size: oo.size, w };
  }

  /** Teilweise gezeichnete Führungslinie (mit dunkler Unterlage für Lesbarkeit). */
  function leader(ctx, L, pts, f, color, alpha) {
    const lens = []; let total = 0;
    for (let k = 1; k < pts.length; k++) { const l = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); lens.push(l); total += l; }
    let rem = total * L.clamp(f); const out = [pts[0]];
    for (let k = 1; k < pts.length && rem > 0; k++) {
      const l = lens[k - 1];
      if (rem >= l) { out.push(pts[k]); rem -= l; }
      else { const r = rem / Math.max(1e-6, l); out.push([L.lerp(pts[k - 1][0], pts[k][0], r), L.lerp(pts[k - 1][1], pts[k][1], r)]); rem = 0; }
    }
    if (out.length < 2) return out[0];
    const path = new Path2D(); out.forEach((q, k) => (k ? path.lineTo(q[0], q[1]) : path.moveTo(q[0], q[1])));
    ctx.save(); ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.globalAlpha = alpha * 0.9; ctx.strokeStyle = "rgba(3,8,18,0.92)"; ctx.lineWidth = 6.5; ctx.stroke(path);
    ctx.strokeStyle = color; ctx.globalAlpha = alpha * 0.22; ctx.lineWidth = 6; ctx.stroke(path);
    ctx.globalAlpha = alpha; ctx.lineWidth = 2; ctx.stroke(path); ctx.restore();
    return out[out.length - 1];
  }

  /** Maße einer Beschriftungs-Tafel (Titel in Versalien, bei Überlänge zweizeilig, + Unterzeile). */
  function tagMetrics(ctx, L, x, title, sub) {
    const maxW = 1830 - x - 46;
    const to = { size: 30, weight: 700, font: L.FONT.head, letterSpacing: 2 };
    const up = String(title).split(" ").map((w) => (/[0-9/²³]|^(mm|cm|kN|kg|MPa|N)$/.test(w) ? w : w.toUpperCase())).join(" ");
    let lines = [up], size = 30, tw = L.measure(ctx, up, to);
    while (tw > maxW && size > 24) { size -= 1; tw = L.measure(ctx, up, Object.assign({}, to, { size })); }
    if (tw > maxW) {
      const o = Object.assign({}, to, { size: 24 });
      const wr = L.wrap(ctx, up, maxW, o);
      lines = [wr[0] || up, wr.slice(1).join(" ")].filter(Boolean);
      lines = lines.map((ln) => fitText(ctx, L, ln, Object.assign({}, o, { minSize: 24 }), maxW).str);
      size = 24; tw = Math.max(...lines.map((ln) => L.measure(ctx, ln, o)));
    }
    const S = sub ? fitText(ctx, L, sub, { size: 21, weight: 400, font: L.FONT.body, minSize: 15 }, maxW) : null;
    const th = size * lines.length + (lines.length - 1) * 6;
    return { lines, size, S, w: Math.max(tw, S ? S.w : 0) + 46, h: S ? th + S.size + 36 : th + 28, th };
  }
  /** Beschriftungs-Tafel zeichnen. x = linke Kante, y = Mitte, w = Breite. */
  function tag(ctx, L, x, y, M, w, color, soft, q) {
    if (q <= 0) return;
    const { lines, size, S, h } = M;
    const e = L.easeOut(L.inv(0, 0.6, q)), a = L.inv(0, 0.3, q);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(4,12,26,0.88)"; ctx.beginPath(); L.roundRectPath(ctx, x, y - h / 2, Math.max(12, w * e), h, 6); ctx.fill();
    ctx.restore();
    L.glowPath(ctx, (c) => L.roundRectPath(c, x, y - h / 2, Math.max(12, w * e), h, 6), soft, 1.5, 0, { alpha: a });
    L.fillRect(ctx, x, y - h / 2, 5, h, color);
    const ta = L.inv(0.45, 1, q);
    if (ta <= 0) return;
    let ty = S ? y - h / 2 + 16 + size * 0.82 : y - h / 2 + 14 + size * 0.82;
    for (const ln of lines) { L.text(ctx, ln, x + 24 + (1 - ta) * 10, ty, { size, weight: 700, font: L.FONT.head, letterSpacing: 2, color: L.C.white, alpha: ta }); ty += size + 6; }
    if (S) L.text(ctx, S.str, x + 24 + (1 - ta) * 10, ty - size - 6 + S.size + 10, { size: S.size, weight: 400, color: L.C.muted, alpha: L.inv(0.6, 1, q) });
  }

  CE.register("rope_cross_section", {
    ownsText: false,
    draw(ctx, p) {
      const L = p.L, C = L.C;
      const t = Math.max(0, toNum(p.t, 0)), d = Math.max(0.5, toNum(p.d, 8));
      const P = p.params && typeof p.params === "object" ? p.params : {};

      // ---------- Parameter ----------
      const n = clampInt(toNum(pick(P, ["strands", "strand_count", "n_strands", "litzen", "anzahl_litzen"], 8), 8), 3, 12);
      const W = clampInt(toNum(pick(P, ["wires_per_strand", "wiresPerStrand", "wires", "drähte_pro_litze", "draehte_pro_litze", "drähte", "draehte"], 19), 19), 1, 61);
      const dmm = toNum(pick(P, ["diameter_mm", "diameterMm", "diameter", "d_mm", "durchmesser", "durchmesser_mm"], 10), 10);
      const labelsRaw = pick(P, ["labels", "show_labels", "callouts", "beschriftung"], true);
      const custom = labelsRaw && typeof labelsRaw === "object" ? labelsRaw : {};
      const labels = labelsRaw && typeof labelsRaw === "object" ? true : toBool(labelsRaw, true);
      const coreRaw = String(pick(P, ["core", "core_type", "einlage", "coreType"], "fibre")).toLowerCase();
      const steelCore = /steel|stahl|iwrc|iwsc|metal/.test(coreRaw);
      const broken = clampInt(toNum(pick(P, ["broken_wires", "brokenWires", "wire_breaks", "drahtbrueche", "drahtbrüche", "breaks"], 0), 0), 0, 60);
      const showSummary = toBool(pick(P, ["summary", "show_summary", "count", "show_count"], true), true);
      const showRuler = toBool(pick(P, ["ruler", "show_ruler", "dimension", "bemassung"], true), true) && dmm > 0;
      const ropeName = String(pick(P, ["title", "rope_name", "name"], "Tragseil"));

      // ---------- Zeitplan (skaliert mit Szenendauer; Aufbau fertig nach B Sekunden) ----------
      const B = L.clamp(d * 0.62, Math.min(2.2, d * 0.9), 9.5);
      const ph = (a, b) => L.seg(t, a * B, Math.max(0.12, b * B));
      const pulse = L.pulse(t, 0.9);

      // ---------- Geometrie ----------
      const lay = layoutFor(W);
      const cx = labels ? 680 : showSummary ? 760 : 960, cy = 515, Rr = 280;
      const sn = Math.sin(Math.PI / n), sFull = (Rr * sn) / (1 + sn), s = sFull * 0.962, Rp = Rr - s;
      const coreR = Math.max(6, Rp - s - 2);
      const base = -Math.PI / 2 + Math.PI / n;
      const nL = lay.layers.length;
      const lightT = (i, j) => (0.34 + (0.22 * i) / n + 0.045 * j) * B;
      const lightDur = Math.max(0.2, 0.08 * B);
      const coreCode = steelCore ? "IWRC" : "FC";
      const designation = `${n}×${W}${lay.suf}-${coreCode}`;

      // Callout-Ziele: "Litze" = Litze nahe -19°, "Draht" = Außendraht der Litze nahe +24°,
      // "Einlage" zeigt durch die Lücke direkt oberhalb der Litze (so kreuzen sich die Führungslinien nicht).
      let si = 0, sBest = 9; for (let i = 0; i < n; i++) { const dd = angDist(base + (i * TAU) / n, -0.33); if (dd < sBest - 1e-6) { sBest = dd; si = i; } }
      let wi = si === 0 ? 1 : 0, wBest = 9; for (let i = 0; i < n; i++) { if (i === si) continue; const dd = angDist(base + (i * TAU) / n, 0.42); if (dd < wBest - 1e-6) { wBest = dd; wi = i; } }
      const gAng = base + (si * TAU) / n - Math.PI / n;

      // ---------- 1. Lichtsaum + Messskala (rotierend) ----------
      const appear = ph(0, 0.14);
      if (appear > 0) {
        const hv = haloTexture(Rr);
        if (hv) { ctx.save(); ctx.globalAlpha = appear; ctx.drawImage(hv, cx - hv.width / 2, cy - hv.height / 2); ctx.restore(); }
      }
      // Skala (langsam rotierend)
      if (appear > 0) {
        const rot = t * 0.035, Rt = Rr + 20;
        ctx.save(); ctx.globalAlpha = 0.9 * appear;
        ctx.strokeStyle = "rgba(63,210,255,0.22)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, Rt, -Math.PI / 2, -Math.PI / 2 + TAU * L.easeInOut(appear)); ctx.stroke();
        ctx.beginPath();
        const nt = Math.floor(72 * L.easeInOut(appear));
        for (let k = 0; k < nt; k++) {
          const a = rot + (k * TAU) / 72 - Math.PI / 2, len = k % 6 === 0 ? 13 : 5;
          ctx.moveTo(cx + Math.cos(a) * Rt, cy + Math.sin(a) * Rt); ctx.lineTo(cx + Math.cos(a) * (Rt + len), cy + Math.sin(a) * (Rt + len));
        }
        ctx.strokeStyle = "rgba(63,210,255,0.38)"; ctx.stroke();
        ctx.restore();
      }
      // ---------- 2./3. Seilkörper: Einlage, Mittellinien, Litzen + Drähte ----------
      const flyDur = Math.max(0.35, 0.2 * B);
      const posAt = (st, q) => {
        const e = 1 - Math.pow(1 - L.clamp(q), 3);
        const ang = st.a - (1 - e) * 0.9, rad = Rp + (1 - e) * 950;
        return { x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad, rot: st.a + (1 - e) * 2.6, e };
      };
      const strandState = (tt) => {
        const arr = [];
        for (let i = 0; i < n; i++) {
          const a = base + (i * TAU) / n, t0 = (0.12 + (0.22 * i) / n) * B;
          const st = { i, a, t0, q: L.seg(tt, t0, flyDur) };
          const P0 = posAt(st, st.q); st.x = P0.x; st.y = P0.y; st.rot = P0.rot;
          arr.push(st);
        }
        return arr;
      };
      const strands = strandState(t);
      const yr = coreR * 0.464, yd = coreR - yr - coreR * 0.02;
      /** Fasern der Fasereinlage; mode 0 = alle gedimmt, 1 = gedimmt ohne Funkeln, 2 = nur funkelnde. */
      const drawFibres = (g, tt, mode) => {
        const F = fibres(); const fr = Math.max(0.9, coreR * 0.012); const tw = Math.floor(tt * 3);
        for (let pass = 0; pass < 2; pass++) {
          if ((mode === 2 && pass === 0) || (mode === 0 && pass === 1)) continue;
          g.beginPath();
          for (let k = 0; k < F.length; k++) {
            const f = F[k]; const bright = mode !== 0 && L.hash01(k * 1.7 + tw * 0.37) > 0.82;
            if ((pass === 1) !== bright) continue;
            const a = -Math.PI / 2 + (f[0] * TAU) / 3 + 0.2; const gx = cx + Math.cos(a) * yd + f[1] * yr, gy = cy + Math.sin(a) * yd + f[2] * yr;
            g.moveTo(gx + fr, gy); g.arc(gx, gy, fr * (0.8 + 0.6 * f[3]), 0, TAU);
          }
          g.fillStyle = pass ? "rgba(255,210,150,0.85)" : "rgba(255,179,71,0.45)"; g.fill();
        }
      };
      const DARK = [10, 24, 46], LIT = [22, 66, 104], CYN = [63, 210, 255], AMB = [255, 179, 71];
      const lwBase = s < 40 ? 1 : 1.5;
      /** Zeichnet den Seilkörper zum Zeitpunkt tt (live = mit Funkeln). parts: 1 = Grund + Einlage + Mittellinien, 2 = Litzen, 3 = alles. */
      const drawBody = (g, tt, sts, live, parts) => {
        const ap = L.seg(tt, 0, Math.max(0.12, 0.14 * B)), cq = L.seg(tt, 0.04 * B, Math.max(0.12, 0.18 * B));
        if (parts & 1) {
        if (ap > 0) {
          g.save(); g.globalAlpha = ap; g.fillStyle = "rgba(4,10,22,0.82)"; g.beginPath(); g.arc(cx, cy, Rr, 0, TAU);
          if (cq >= 1) { g.moveTo(cx + coreR - 1, cy); g.arc(cx, cy, coreR - 1, 0, TAU, true); }
          g.fill(); g.restore();
        }
        // Einlage
        if (cq > 0) {
          const sc = 0.55 + 0.45 * L.easeOutBack(cq);
          g.save(); g.translate(cx, cy); g.scale(sc, sc); g.translate(-cx, -cy); g.globalAlpha = L.clamp(cq * 2.5);
          if (!steelCore) {
            g.fillStyle = "#282626"; g.beginPath(); g.arc(cx, cy, coreR, 0, TAU); g.fill(); // Navy + 11 % Amber, deckend
            g.strokeStyle = "rgba(255,179,71,0.32)"; g.lineWidth = 1.2; g.setLineDash([5, 4]);
            g.beginPath();
            for (let y = 0; y < 3; y++) { const a = -Math.PI / 2 + (y * TAU) / 3 + 0.2; const gx = cx + Math.cos(a) * yd, gy = cy + Math.sin(a) * yd; g.moveTo(gx + yr, gy); g.arc(gx, gy, yr, 0, TAU); }
            g.stroke(); g.setLineDash([]);
            drawFibres(g, tt, live ? 1 : 0);
          } else {
            // Stahleinlage IWRC 7×7
            g.fillStyle = "#0b1628"; g.beginPath(); g.arc(cx, cy, coreR, 0, TAU); g.fill();
            const m = (coreR / 3) * 0.97, wr = (m / 3) * 0.97;
            g.beginPath();
            for (let k = 0; k < 7; k++) {
              const mx = cx + (k ? Math.cos((k * TAU) / 6) * coreR * (2 / 3) : 0), my = cy + (k ? Math.sin((k * TAU) / 6) * coreR * (2 / 3) : 0);
              for (let w = 0; w < 7; w++) {
                const wx = mx + (w ? Math.cos((w * TAU) / 6 + k) * m * (2 / 3) : 0), wy = my + (w ? Math.sin((w * TAU) / 6 + k) * m * (2 / 3) : 0);
                g.moveTo(wx + wr, wy); g.arc(wx, wy, wr, 0, TAU);
              }
            }
            g.fillStyle = "rgba(159,196,230,0.16)"; g.fill(); g.strokeStyle = "rgba(159,196,230,0.75)"; g.lineWidth = 1.1; g.stroke();
          }
          g.restore();
          const coreCol = steelCore ? C.steel : C.amber;
          L.circle(g, cx, cy, coreR * sc, coreCol, 2.2, 0.6, { alpha: L.clamp(cq * 2) });
          if (cq < 1) { const rq = L.inv(0.3, 1, cq); L.circle(g, cx, cy, coreR * (1 + 0.5 * rq), coreCol, 2, 1, { alpha: (1 - rq) * 0.7 }); }
        }
        // Mittellinien (Strich-Punkt), unter den Litzen
        if (ap > 0) {
          g.save(); g.setLineDash([26, 6, 4, 6]); g.strokeStyle = "rgba(63,210,255,0.30)"; g.lineWidth = 1; g.globalAlpha = ap;
          const ext = (Rr + 42) * L.easeInOut(ap);
          g.beginPath(); g.moveTo(cx - ext, cy); g.lineTo(cx + ext, cy); g.moveTo(cx, cy - ext); g.lineTo(cx, cy + ext); g.stroke();
          g.restore();
        }
        }
        if (!(parts & 2)) return;
        // Litzen: Einflug mit Spur, Drähte je Lage nach Zustand gebündelt
        const buckets = new Map();
        for (const st of sts) {
          if (st.q <= 0) continue;
          const alpha = L.clamp(st.q * 5);
          if (st.q < 1) {
            const P3 = posAt(st, st.q - 0.16);
            const gr = g.createLinearGradient(P3.x, P3.y, st.x, st.y);
            gr.addColorStop(0, "rgba(63,210,255,0)"); gr.addColorStop(1, `rgba(63,210,255,${0.35 * alpha})`);
            g.save(); g.strokeStyle = gr; g.lineCap = "round"; g.lineWidth = s * 1.25; g.globalAlpha = 0.4;
            g.beginPath(); g.moveTo(P3.x, P3.y); g.lineTo(st.x, st.y); g.stroke();
            g.strokeStyle = C.cyan; g.lineWidth = 1.5;
            for (let k = 1; k <= 3; k++) {
              const qq = st.q - k * 0.055; if (qq <= 0) break;
              const G = posAt(st, qq);
              g.globalAlpha = (0.3 - k * 0.08) * alpha; g.beginPath(); g.arc(G.x, G.y, s, 0, TAU); g.stroke();
            }
            g.globalAlpha = alpha; g.fillStyle = "rgba(4,10,22,0.9)"; g.beginPath(); g.arc(st.x, st.y, s, 0, TAU); g.fill();
            g.restore();
          }
          const unlit = 0.34 + 0.34 * (1 - L.seg(tt, st.t0 + flyDur, 0.5));
          for (let j = 0; j < nL; j++) {
            const T0 = lightT(st.i, j);
            const lv = L.easeOut(L.seg(tt, T0, lightDur));
            const fl = tt >= T0 ? 1 - L.seg(tt, T0, Math.max(0.3, 0.14 * B)) : 0;
            const aq = Math.round(alpha * 20) / 20, lq = Math.round(lv * 20) / 20, fq = Math.round(fl * 20) / 20;
            const kq = Math.round((unlit + (1 - unlit) * lv) * 40) / 40;
            const key = aq + "|" + lq + "|" + fq + "|" + kq;
            let bk = buckets.get(key); if (!bk) { bk = { aq, lq, fq, kq, items: [] }; buckets.set(key, bk); }
            bk.items.push([st, j]);
          }
        }
        // Nur Füllungen (Striche sind in Software-Rasterung teuer): Kontur = äußerer Kreis in Linienfarbe,
        // darüber Kreis (r - Linienbreite) in Drahtfarbe, dazu ein sichelförmiges Glanzlicht.
        const hlA = -2.8, hlB = -1.7;
        g.save();
        for (const bk of buckets.values()) {
          if (bk.aq <= 0) continue;
          // Einzelne Kreis-Füllungen sind in Skia schneller als ein Pfad mit vielen Kreisen (Oval-Fast-Path):
          // zuerst Kontur (Kreis r + lw/2 in Linienfarbe), darüber Drahtfläche (Kreis r - lw/2).
          const lwk = 1 + bk.fq * 0.9; // beim Aufleuchten kurz kräftigere Kontur
          const hl = bk.lq > 0 ? new Path2D() : null;
          const geo = [];
          for (const [st, j] of bk.items) {
            for (const w of lay.layers[j]) {
              const wx = st.x + Math.cos(st.rot + w.a) * w.R * s, wy = st.y + Math.sin(st.rot + w.a) * w.R * s, wr = w.r * s;
              const lw = Math.min(lwBase * lwk, wr * 0.35);
              geo.push(wx, wy, wr + lw * 0.5, Math.max(0.3, wr - lw * 0.5));
              if (hl) { const r1 = wr * 0.72, r2 = wr * 0.54; hl.moveTo(wx + Math.cos(hlA) * r1, wy + Math.sin(hlA) * r1); hl.arc(wx, wy, r1, hlA, hlB); hl.arc(wx, wy, r2, hlB, hlA, true); hl.closePath(); }
            }
          }
          const bodyC = [0, 1, 2].map((c) => DARK[c] + (LIT[c] - DARK[c]) * bk.lq);
          const lineC = [0, 1, 2].map((c) => CYN[c] + (AMB[c] - CYN[c]) * bk.fq);
          g.globalAlpha = bk.aq;
          g.fillStyle = rgb(bodyC, lineC, L.clamp(bk.kq + bk.fq * 0.5));
          for (let q = 0; q < geo.length; q += 4) { g.beginPath(); g.arc(geo[q], geo[q + 1], geo[q + 2], 0, TAU); g.fill(); }
          g.fillStyle = rgb(DARK, LIT, bk.lq);
          for (let q = 0; q < geo.length; q += 4) { g.beginPath(); g.arc(geo[q], geo[q + 1], geo[q + 3], 0, TAU); g.fill(); }
          if (hl) { g.globalAlpha = bk.aq * bk.lq * 0.5; g.fillStyle = "#eaf8ff"; g.fill(hl); }
        }
        g.restore();
        // Aufsetz-Impuls
        for (const st of sts) {
          const iq = L.seg(tt, st.t0 + flyDur * 0.8, 0.45);
          if (iq > 0 && iq < 1) L.circle(g, st.x, st.y, s * (1 + 0.35 * iq), C.cyan, 2, 1, { alpha: (1 - iq) * 0.6 });
        }
      };

      // Nach Abschluss aller Aufbau-Animationen ist der Seilkörper statisch -> einmal in eine Textur rendern und
      // pro Frame nur kopieren (nur bei unskalierter Kamera, damit nichts weichgezeichnet wird).
      const tFinal = Math.max(
        Math.max(0.12, 0.14 * B), 0.04 * B + Math.max(0.12, 0.18 * B),
        (0.12 + (0.22 * (n - 1)) / n) * B + flyDur + 0.5,
        lightT(n - 1, nL - 1) + Math.max(lightDur, 0.3, 0.14 * B)) + 0.05;
      const mt = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
      const exact = !!mt && mt.a === 1 && mt.d === 1 && mt.b === 0 && mt.c === 0 && Number.isInteger(mt.e) && Number.isInteger(mt.f);
      const tCore = Math.max(Math.max(0.12, 0.14 * B), 0.04 * B + Math.max(0.12, 0.18 * B)) + 0.05;
      // Litze i ist fertig (gelandet, aufgeleuchtet, Blitz abgeklungen) – monoton in i
      const tDone = (i) => Math.max((0.12 + (0.22 * i) / n) * B + flyDur + 0.5, lightT(i, nL - 1) + Math.max(lightDur, 0.3, 0.14 * B)) + 0.02;
      let kDone = 0; while (kDone < n && t >= tDone(kDone)) kDone++;
      const HB = Rr + 50;
      const geoKey = [n, W, steelCore, cx, cy, Rr, B.toFixed(4)].join("|");
      /** Textur: Grund + Einlage (+ die ersten k fertigen Litzen). Inhalt hängt nur von (Geometrie, k) ab -> deterministisch. */
      const texture = (k) => {
        const key = geoKey + "|" + k;
        let e = BODY.get(key);
        if (!e) {
          // fertige Endstufe dauerhaft, Zwischenstufen in einem wiederverwendeten Slot je Geometrie
          const slot = k > 0 && k < n ? "p|" + geoKey : key;
          e = BODY.get(slot);
          if (!e) { const cv = document.createElement("canvas"); cv.width = cv.height = HB * 2; e = { cv, g: cv.getContext("2d"), k: -1 }; BODY.set(slot, e); if (BODY.size > 12) BODY.delete(BODY.keys().next().value); }
          if (!e.g) return null;
          if (e.k !== k) {
            const g = e.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, HB * 2, HB * 2);
            g.translate(HB - cx, HB - cy); const tt = tFinal + 1;
            drawBody(g, tt, strandState(tt).slice(0, k), false, k > 0 ? 3 : 1);
            g.setTransform(1, 0, 0, 1, 0, 0); e.k = k;
          }
        }
        return e.cv;
      };
      const canCache = exact && typeof document !== "undefined" && t >= tCore;
      const tex = canCache ? texture(kDone) : null;
      if (tex) {
        ctx.drawImage(tex, cx - HB, cy - HB);
        if (!steelCore) { ctx.save(); drawFibres(ctx, t, 2); ctx.restore(); }
        if (kDone < n) drawBody(ctx, t, strands.slice(kDone), true, 2);
      } else drawBody(ctx, t, strands, true, 3);

      // Umkreis (Nenndurchmesser, gestrichelt, laufend) – liegt außerhalb der Litzen, daher nach dem Körper
      if (appear > 0) {
        ctx.save(); ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 14;
        ctx.globalAlpha = appear * 0.75; ctx.strokeStyle = C.cyan; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(cx, cy, Rr + 2.5, -Math.PI / 2, -Math.PI / 2 + TAU * L.easeInOut(appear)); ctx.stroke();
        ctx.restore();
      }

      // ---------- 4. Drahtbrüche (optional) ----------
      // Kandidaten: außenliegende Drähte der Außenlage (dort werden Drahtbrüche sichtbar), nicht der Callout-Draht
      const brQ = ph(0.7, 0.14);
      const cand = [];
      if (broken > 0) {
        const oL = lay.layers[nL - 1];
        for (const st of strands) for (const w of oL) if (Math.cos(w.a) > 0.2 && w.R > 0 && !(labels && st.i === wi && w === lay.outer)) cand.push([st, w]);
        const rr = L.rng(`rope-breaks-${n}-${W}`);
        for (let k = cand.length - 1; k > 0; k--) { const j = Math.floor(rr() * (k + 1)); const tmp = cand[k]; cand[k] = cand[j]; cand[j] = tmp; }
      }
      const nbPlanned = Math.min(broken, cand.length);
      if (nbPlanned > 0 && brQ > 0) {
        const nb = nbPlanned;
        for (let k = 0; k < nb; k++) {
          const [st, w] = cand[k]; if (st.q < 1) continue;
          const bq = L.seg(t, (0.7 + (0.12 * k) / Math.max(1, nb)) * B, 0.3);
          if (bq <= 0) continue;
          const wx = st.x + Math.cos(st.rot + w.a) * w.R * s, wy = st.y + Math.sin(st.rot + w.a) * w.R * s, wr = w.r * s;
          L.glowDot(ctx, wx, wy, wr * 2.6, C.red, bq * (0.45 + 0.35 * L.pulse(t + k * 0.3, 1.4)));
          ctx.save(); ctx.globalAlpha = bq; ctx.fillStyle = "rgba(90,14,20,0.95)"; ctx.beginPath(); ctx.arc(wx, wy, wr, 0, TAU); ctx.fill();
          ctx.strokeStyle = C.red; ctx.lineWidth = 2; ctx.stroke();
          const ca = st.rot + w.a + 1.1;
          ctx.beginPath();
          ctx.moveTo(wx - Math.cos(ca) * wr, wy - Math.sin(ca) * wr);
          ctx.lineTo(wx - Math.cos(ca) * wr * 0.2 + Math.cos(ca + 1.57) * wr * 0.25, wy - Math.sin(ca) * wr * 0.2 + Math.sin(ca + 1.57) * wr * 0.25);
          ctx.lineTo(wx + Math.cos(ca) * wr * 0.25 - Math.cos(ca + 1.57) * wr * 0.2, wy + Math.sin(ca) * wr * 0.25 - Math.sin(ca + 1.57) * wr * 0.2);
          ctx.lineTo(wx + Math.cos(ca) * wr, wy + Math.sin(ca) * wr);
          ctx.strokeStyle = "#ffd0d2"; ctx.lineWidth = 1.6; ctx.stroke();
          ctx.restore();
        }
      }

      // ---------- 5. Scan-Linie (Röntgen-Look, kontinuierliche Bewegung) ----------
      const scanA = ph(0.5, 0.15);
      if (scanA > 0) {
        const per = 3.8, k = (((t - 0.5 * B) / per) % 1 + 1) % 1;
        const sy = cy - Rr - 30 + k * (2 * Rr + 60);
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, Rr + 2, 0, TAU); ctx.clip();
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createLinearGradient(0, sy - 70, 0, sy + 4);
        g.addColorStop(0, "rgba(63,210,255,0)"); g.addColorStop(0.92, `rgba(63,210,255,${0.13 * scanA})`); g.addColorStop(1, "rgba(63,210,255,0)");
        ctx.fillStyle = g; ctx.fillRect(cx - Rr, sy - 70, Rr * 2, 74);
        ctx.globalAlpha = 0.26 * scanA; ctx.strokeStyle = C.cyan; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(cx - Rr, sy); ctx.lineTo(cx + Rr, sy); ctx.stroke();
        ctx.restore();
      }

      // ---------- 6. Rechte Spalte vorbereiten (gemeinsame Breite für Callouts + Zusammenfassung) ----------
      const LX = 1100, LY = [292, 430, 568];
      const ow = lay.outer;
      const titles = {
        core: String(pick(custom, ["einlage", "core", "Einlage"], "Einlage")),
        strand: String(pick(custom, ["litze", "strand", "Litze"], "Litze")),
        wire: String(pick(custom, ["draht", "wire", "Draht"], "Draht")),
      };
      const strandMm = (sFull / Rr) * dmm, wireMm = 2 * ow.r * (sFull / Rr) * (dmm / 2);
      const subs = {
        core: String(pick(custom, ["einlage_sub", "core_sub"], steelCore ? "Stahleinlage (IWRC), 7 × 7 Drähte" : "Fasereinlage (FC), speichert Schmierstoff")),
        strand: String(pick(custom, ["litze_sub", "strand_sub"], dmm > 0 ? `${lay.desc} · Ø ca. ${deNum(strandMm)} mm` : lay.desc)),
        wire: String(pick(custom, ["draht_sub", "wire_sub"], dmm > 0 ? `${ow.R > 0 ? "Außendraht" : "Draht"} Ø ca. ${deNum(wireMm)} mm` : "hochfester Stahldraht")),
      };
      const metrics = labels ? [tagMetrics(ctx, L, LX, titles.core, subs.core), tagMetrics(ctx, L, LX, titles.strand, subs.strand), tagMetrics(ctx, L, LX, titles.wire, subs.wire)] : [];
      // Zusammenfassung: Maße
      const total = n * W;
      const sumX = labels ? LX : cx + Rr + 130;
      const sumMax = 1830 - sumX;
      const l1 = `${n} Litzen × ${W} ${W === 1 ? "Draht" : "Drähte"}`;
      const F1 = fitText(ctx, L, l1, { size: 36, weight: 600, minSize: 22 }, sumMax - 60);
      const F2 = fitText(ctx, L, `= ${total} ${total === 1 ? "Draht" : "Drähte"}`, { size: 58, weight: 700, font: L.FONT.mono, minSize: 30 }, sumMax - 60);
      const hdr = `SEILAUFBAU · ${designation}`;
      const sumW = Math.max(F1.w, F2.w, L.measure(ctx, hdr, { size: 19, weight: 700, font: L.FONT.mono, letterSpacing: 3 })) + 64;
      const colW = Math.min(1830 - LX, Math.max(sumW, ...metrics.map((m) => m.w), 470));

      // ---------- 7. Beschriftungsebene: Bemaßung, Callouts, Zusammenfassung, Schriftfeld ----------
      // Zeitplan der Ebene (ph(a, b) = seg(t, a·B, max(0,12; b·B)))
      const cDur = Math.max(0.45, 0.16 * B);
      const qAt = (tt, a) => (labels ? L.seg(tt, a * B, cDur) : 0);
      const exitR = Rr + 38;
      const sAng = strands[si].a, wAng = strands[wi].a;
      const wcx = cx + Math.cos(wAng) * Rp, wcy = cy + Math.sin(wAng) * Rp;
      const wx0 = wcx + Math.cos(wAng + ow.a) * ow.R * s, wy0 = wcy + Math.sin(wAng + ow.a) * ow.R * s, wr0 = ow.r * s;
      const defs = [
        { at: 0.62, tgt: [cx + Math.cos(gAng) * coreR * 0.45, cy + Math.sin(gAng) * coreR * 0.45], ang: gAng, col: steelCore ? C.steel : C.amber, soft: steelCore ? "rgba(159,196,230,0.4)" : C.amberSoft },
        { at: 0.72, tgt: [cx + Math.cos(sAng) * Rp, cy + Math.sin(sAng) * Rp], ang: sAng, col: C.cyan, soft: C.cyanSoft },
        { at: 0.82, tgt: [wx0, wy0], ang: wAng, col: C.white, soft: "rgba(238,246,255,0.35)" },
      ];
      const extraBase = [];
      if (steelCore) extraBase.push({ text: "+ 49 Drähte in der Stahleinlage (7 × 7)", color: C.muted });
      if (nbPlanned > 0) extraBase.push({ text: nbPlanned === 1 ? "1 Drahtbruch" : `${nbPlanned} Drahtbrüche`, color: C.red, dot: true, brk: true });
      const sumH = 184 + extraBase.length * 32;
      const sumY = labels ? 650 : cy - sumH / 2;
      const sumWd = labels ? colW : Math.min(sumMax, Math.max(sumW, 470));
      const sumQAt = (tt) => (showSummary ? L.seg(tt, 0.34 * B, Math.max(0.12, 0.12 * B)) : 0);
      const brQAt = (tt) => L.seg(tt, 0.7 * B, Math.max(0.12, 0.14 * B));

      /** Statischer Teil der Beschriftung zum Zeitpunkt tt (ohne pulsierende Elemente). */
      const drawUI = (g, tt) => {
        // Bemaßung (Nenndurchmesser) – zuerst, damit Führungslinien darüber liegen
        const rq = showRuler ? L.seg(tt, 0.78 * B, Math.max(0.12, 0.2 * B)) : 0;
        if (rq > 0) {
          const yD = cy + Rr + 52, x1 = cx - Rr, x2 = cx + Rr, col = C.amber;
          const eq = L.easeOut(L.inv(0, 0.4, rq)), dq = L.easeInOut(L.inv(0.25, 0.8, rq)), tq = L.inv(0.55, 1, rq);
          g.save(); g.strokeStyle = col; g.globalAlpha = 0.6; g.lineWidth = 1.2;
          g.beginPath(); g.moveTo(x1, cy + 26); g.lineTo(x1, L.lerp(cy + 26, yD + 14, eq)); g.moveTo(x2, cy + 26); g.lineTo(x2, L.lerp(cy + 26, yD + 14, eq)); g.stroke(); g.restore();
          const label = `Ø ${deNum(dmm)} mm`;
          const tw = L.measure(g, label, { size: 30, weight: 700, font: L.FONT.mono }) + 30;
          const half = Rr * dq;
          if (dq > 0) {
            const gapL = cx - tw / 2, gapR = cx + tw / 2;
            const la = Math.max(cx - half, x1), ra = Math.min(cx + half, x2);
            if (la < gapL) L.line(g, la, yD, gapL, yD, col, 2, 0);
            if (ra > gapR) L.line(g, gapR, yD, ra, yD, col, 2, 0);
            if (dq >= 0.98) {
              g.save(); g.fillStyle = col; g.beginPath();
              g.moveTo(x1, yD); g.lineTo(x1 + 18, yD - 6.5); g.lineTo(x1 + 18, yD + 6.5); g.closePath();
              g.moveTo(x2, yD); g.lineTo(x2 - 18, yD - 6.5); g.lineTo(x2 - 18, yD + 6.5); g.closePath(); g.fill(); g.restore();
            }
          }
          if (tq > 0) L.text(g, label, cx, yD + 11, { size: 30, weight: 700, font: L.FONT.mono, color: col, align: "center", alpha: tq, glow: 8 });
        }
        // Callouts
        if (labels) defs.forEach((c, k) => {
          const q = qAt(tt, c.at); if (q <= 0) return;
          let er = exitR; if (cy + Math.sin(c.ang) * er < 214) er = Math.max(Rr + 8, (cy - 214) / Math.max(0.01, -Math.sin(c.ang)));
          const ex = [cx + Math.cos(c.ang) * er, cy + Math.sin(c.ang) * er];
          const anchor = [LX - 14, LY[k]];
          const a = L.clamp(q * 3);
          L.glowDot(g, c.tgt[0], c.tgt[1], 16, c.col, a * 0.9);
          L.fillCircle(g, c.tgt[0], c.tgt[1], 4.5, c.col);
          // Direkt zur Tafel; tritt die Einlage-Linie oben aus dem Seil (wenige Litzen), orthogonal um die Litze herum
          const pts = k === 0 && ex[1] < LY[k] - 40 ? [c.tgt, ex, [LX - 44, ex[1]], [LX - 44, LY[k]], anchor] : [c.tgt, ex, anchor];
          leader(g, L, pts, L.easeOut(L.inv(0, 0.5, q)), c.col, a);
          if (q > 0.45) L.fillCircle(g, anchor[0], anchor[1], 3.5, c.col);
          tag(g, L, LX, LY[k], metrics[k], colW, c.col, c.soft, L.inv(0.38, 1, q));
        });
        // Zusammenfassung (ohne die Zählerzeile)
        const sq = sumQAt(tt);
        if (sq > 0) {
          const xo = (1 - L.easeOut(sq)) * 40, x0 = sumX + xo, tx = x0 + 30;
          g.save(); g.globalAlpha = sq; g.fillStyle = "rgba(4,12,26,0.86)"; g.beginPath(); L.roundRectPath(g, x0, sumY, sumWd, sumH, 8); g.fill(); g.restore();
          L.glowPath(g, (c) => L.roundRectPath(c, x0, sumY, sumWd, sumH, 8), C.amberSoft, 1.5, 0, { alpha: sq });
          L.fillRect(g, x0, sumY, 5, sumH, C.amber);
          L.text(g, hdr, tx, sumY + 38, { size: 19, weight: 700, font: L.FONT.mono, letterSpacing: 3, color: C.cyan, alpha: sq * 0.9 });
          L.text(g, F1.str, tx, sumY + 88, { size: F1.size, weight: 600, color: C.white, alpha: sq });
          extraBase.forEach((ex, k) => {
            const yy = sumY + 196 + k * 32; const a = sq * (ex.brk ? brQAt(tt) : 1);
            if (a <= 0) return;
            if (ex.dot) L.fillCircle(g, tx + 7, yy - 7, 5, C.red);
            L.text(g, fitText(g, L, ex.text, { size: 21, weight: 600, minSize: 14 }, sumWd - 80).str, tx + (ex.dot ? 24 : 0), yy, { size: 21, weight: ex.dot ? 600 : 400, color: ex.color, alpha: a });
          });
        }
        // Schriftfeld (klein, links unten)
        const tbQ = L.seg(tt, 0.1 * B, Math.max(0.12, 0.2 * B));
        if (tbQ > 0 && cx - Rr > 330) {
          const x = 110, y = 792;
          L.line(g, x, y - 34, x + 190 * L.easeOut(tbQ), y - 34, C.cyanSoft, 1.5, 0, { alpha: tbQ });
          L.text(g, "SCHNITT A–A", x, y, { size: 22, weight: 700, font: L.FONT.head, letterSpacing: 4, color: C.cyan, alpha: tbQ * 0.9 });
          L.text(g, fitText(g, L, ropeName.toUpperCase(), { size: 17, weight: 700, font: L.FONT.mono, letterSpacing: 3, minSize: 12 }, cx - Rr - 150).str, x, y + 30, { size: 17, weight: 700, font: L.FONT.mono, letterSpacing: 3, color: C.muted, alpha: tbQ * 0.85 });
        }
      };

      // Pulsierende Hervorhebungen am Objekt (live, unter der Beschriftung)
      if (labels) {
        const hp = 0.65 + 0.35 * L.pulse(t, 1.1);
        const q1 = qAt(t, 0.62), q2 = qAt(t, 0.72), q3 = qAt(t, 0.82);
        if (q1 > 0) L.circle(ctx, cx, cy, coreR + 4, defs[0].col, 2.4, 1, { alpha: L.clamp(q1 * 2) * hp });
        if (q2 > 0) L.circle(ctx, defs[1].tgt[0], defs[1].tgt[1], s + 5, C.cyan, 2.6, 1, { alpha: L.clamp(q2 * 2) * hp });
        if (q3 > 0) L.circle(ctx, wx0, wy0, wr0 + 3.5, C.white, 2.2, 1, { alpha: L.clamp(q3 * 2) * hp });
      }
      // Beschriftung: nach Abschluss aller Einblendungen als Textur (nur unskalierte Kamera), sonst direkt
      const tUI = Math.max(0.78 * B + Math.max(0.12, 0.2 * B), 0.82 * B + cDur, 0.34 * B + Math.max(0.12, 0.12 * B), 0.1 * B + Math.max(0.12, 0.2 * B), 0.7 * B + Math.max(0.12, 0.14 * B)) + 0.05;
      const UI_X = 80, UI_Y = 186, UI_W = 1770, UI_H = 720; // Bereich aller Beschriftungen (Sicherheitsrand 90 px)
      let uiTex = null;
      if (exact && t >= tUI && typeof document !== "undefined") {
        const key = "ui|" + [cx, B.toFixed(4), JSON.stringify(P)].join("|");
        uiTex = BODY.get(key);
        if (!uiTex) {
          const cv = document.createElement("canvas"); cv.width = UI_W; cv.height = UI_H;
          const g = cv.getContext("2d");
          if (g) { g.translate(-UI_X, -UI_Y); drawUI(g, tUI + 1); uiTex = cv; BODY.set(key, cv); if (BODY.size > 12) BODY.delete(BODY.keys().next().value); }
        }
      }
      if (uiTex) ctx.drawImage(uiTex, UI_X, UI_Y); else drawUI(ctx, t);
      // Live-Elemente der Zusammenfassung: Zähler (synchron zu den aufleuchtenden Drähten) + pulsierender Bruch-Punkt
      const sumQ = sumQAt(t);
      if (sumQ > 0) {
        let lit = 0;
        for (let i = 0; i < n; i++) for (let j = 0; j < nL; j++) lit += lay.layers[j].length * L.seg(t, lightT(i, j), lightDur);
        const cnt = Math.min(total, Math.round(lit));
        const tx = sumX + (1 - L.easeOut(sumQ)) * 40 + 30;
        const done = cnt >= total ? L.seg(t, lightT(n - 1, nL - 1) + lightDur, 0.5) : 0;
        L.text(ctx, `= ${cnt} ${total === 1 ? "Draht" : "Drähte"}`, tx, sumY + 156, { size: F2.size, weight: 700, font: L.FONT.mono, color: C.amber, alpha: sumQ, glow: 10 + 6 * (1 - done) * (cnt > 0 ? 1 : 0) + 4 * pulse });
        extraBase.forEach((ex, k) => {
          if (!ex.dot) return;
          const a = sumQ * brQAt(t); if (a <= 0) return;
          const yy = sumY + 196 + k * 32;
          L.glowDot(ctx, tx + 7, yy - 7, 14, C.red, a * (0.6 + 0.4 * pulse));
        });
      }

      // ---------- 8. Schwebeteilchen ----------
      {
        ctx.save(); ctx.fillStyle = C.cyan;
        for (let k = 0; k < 26; k++) {
          const x = ((L.hash01(k * 3.1) * 1920 + t * (6 + 10 * L.hash01(k))) % 1920 + 1920) % 1920;
          const y = 60 + L.hash01(k * 7.7) * 860 + Math.sin(t * 0.5 + k) * 12;
          ctx.globalAlpha = 0.12 + 0.12 * Math.sin(t * 1.3 + k * 2.1);
          ctx.beginPath(); ctx.arc(x, y, 1.2 + 1.6 * L.hash01(k * 1.3), 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
    },
  });
})();
