/* comparison_split – Zwei-Panel-Vergleich im Visual-Science-Stil (Röntgen/Blueprint).
   BEATS (params.beats, Sekunden ab Szenenstart, alle optional, auf [0,3; d−0,3] begrenzt):
     [0] = Panels, Trennlinie und Badge fahren ein (Standard 0)
     [1] = Aktion der linken Visualisierung (Fang greift / Balken / Zahl / Silhouetten-Markierung / Karussell dreht hoch / Kolben drückt)
     [2] = Aktion der rechten Visualisierung
     [3] = Urteil: Gewinner-Panel leuchtet (highlight) + Mythos-Punkte werden durchgestrichen (strike)
   "at" (Sekunden) akzeptieren: jeder Punkt {text, at}, jedes Panel {at} (Einfahrt dieses Panels),
     Panel {visualAt} (= Aktion, überschreibt beats[1]/[2]), bar {at, fromAt}, stat {at}, people {at}.
     Punkte ohne "at" werden automatisch nach der Szenendauer verteilt.
   Params:
     variant:   "vs" (Standard) | "then_now" | "myth_fact" | "bars" (= vs mit Höhenbalken aus panel.value)
     heading:   optionale zentrale Überschrift; headingCase / textCase: "upper" (Standard, Einheiten bleiben klein) | "none"
     left / right: { title, points: [string | {text, mark, at, strike, dim, strikeAt}], icon?, tag?, color?, caption?,
                     at?, visualAt?, diagramLabel? (string | false: Ergebnistext der Fang-Diagramme bzw. Luft-Beschriftung bei piston/air_cushion),
                     labels? (false = keine Legende in carousel/governor/piston/air_cushion),
                     bar? {value (Zahl | [lo,hi] | "6–7"), from?, fromAt?, fromLabel?, max?, unit?, prefix?, label?, text?, at?},
                     stat? {value | text, prefix?, suffix?, label?, decimals?, at?},
                     people? {count, highlight (Anteil 0..1 oder Anzahl), label?, restLabel?, at?} }
       icon: instantaneous_gear | progressive_gear | old_platform | modern_car | rope | belt |
             carousel | governor (synchron) | piston | air_cushion (synchron) | people | none
       Punkt-Präfixe: "+ " / "✓" → Haken, "✗" / "×" → Kreuz, "- " / "• " → Standardmarke; "~~Text~~" → durchgestrichen + blass
     reveal:    "alternate" (Standard, paarweise L/R) | "sequential" (erst links, dann rechts)
     marks:     "auto" | "ticks" | "dots" | "cross_tick" | "tick_cross"
     highlight: "left" | "right" | "none"   (myth_fact: Standard "right")
     strike:    true/false – Mythos-Punkte werden durchgestrichen (myth_fact: Standard true)
     badge:     Text im Mittel-Badge der Variante vs (Standard "VS")
     diagramLabels: false – blendet die Ergebnis-Beschriftung der Fang-Diagramme aus; syncAt: gemeinsame Aktionszeit der Analogie-Paare
       (fährt ein Paar-Panel erst nach syncAt ein, holt es die Aktion bei seinem eigenen visualAt bzw. kurz nach der Einfahrt nach –
        Endzustand beider Zeichnungen bleibt identisch)
     solo:      "auto" (Standard) | true | false – fährt ein Panel ≥ 1 s (true: ≥ 0,3 s) nach dem anderen ein, steht das erste bis dahin
                mittig und gleitet mit der Einfahrt des Partners auf seine Seite; Trennlinie und Badge kommen erst mit dem Partner
     heroHeading: false – schaltet die Frage-Karte ab (sonst: fährt das erste Panel ≥ 1,2 s nach Szenenstart ein, steht die heading
                groß in der Bildmitte und gleitet kurz vor dem ersten Panel an ihren Platz)
     stat mit eigenem "at": der Rahmen wird erst kurz vor der Zahl aufgedeckt (kein leerer Kasten)
     statScale: "linear" (Standard) | "log"; statBar: false blendet den Größenvergleichsbalken aus
   ownsText: p.text wird als Overlay-Box oben links im Engine-Stil gezeichnet (mit Umbruch/Verkleinerung). */
(function () {
  "use strict";
  const CE = window.CE;
  if (!CE || typeof CE.register !== "function" || !CE.lib) return;
  const L = CE.lib;
  const C = L.C;
  const FONT = L.FONT;
  const TAU = Math.PI * 2;
  const GREEN = C.green || "#5be49b";
  const PR = 16; // Panel-Eckradius

  /* ---------------- Farben ---------------- */
  const RGB = Object.create(null);
  function toRgb(col) {
    const key = String(col);
    if (RGB[key]) return RGB[key];
    let out = [63, 210, 255];
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(key.trim());
    if (m) {
      let h = m[1];
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      out = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    RGB[key] = out;
    return out;
  }
  function rgba(col, a) { const c = toRgb(col); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + L.clamp(a).toFixed(3) + ")"; }
  const NAMED = { cyan: C.cyan, blau: C.cyan, blue: C.cyan, amber: C.amber, orange: C.amber, gelb: C.amber, yellow: C.amber, gold: C.amber, red: C.red, rot: C.red, green: GREEN, gruen: GREEN, "grün": GREEN, steel: C.steel, stahl: C.steel, white: C.white, weiss: C.white, "weiß": C.white };
  function resolveColor(v, fb) {
    if (typeof v !== "string") return fb;
    const k = v.trim().toLowerCase();
    if (NAMED[k]) return NAMED[k];
    if (/^#[0-9a-f]{6}$/.test(k)) return k;
    if (/^#[0-9a-f]{3}$/.test(k)) return "#" + k[1] + k[1] + k[2] + k[2] + k[3] + k[3];
    return fb;
  }

  /* ---------------- Zeichen-Helfer (globaler Alpha-Multiplikator GA) ---------------- */
  let GA = 1;
  const al = (a) => L.clamp((a == null ? 1 : a) * GA);
  function gp(ctx, build, color, width, glow, opts) {
    const o = Object.assign({}, opts); o.alpha = al(o.alpha);
    if (o.alpha <= 0.004) return;
    L.glowPath(ctx, build, color, width, glow, o);
  }
  function line(ctx, x1, y1, x2, y2, color, width, glow, opts) { gp(ctx, (c) => { c.moveTo(x1, y1); c.lineTo(x2, y2); }, color, width, glow, opts); }
  function text(ctx, s, x, y, o) {
    if (!s) return;
    const oo = Object.assign({}, o); oo.alpha = al(oo.alpha);
    if (oo.alpha <= 0.004) return;
    L.text(ctx, s, x, y, oo);
  }
  /* Lichtpunkt als vorgerendertes Sprite (spart Gradienten-Aufbau pro Aufruf). */
  const SPRITES = Object.create(null);
  function glowSprite(col) {
    let sp = SPRITES[col];
    if (sp !== undefined) return sp;
    sp = null;
    try {
      const S = 96; sp = document.createElement("canvas"); sp.width = S; sp.height = S;
      const c = sp.getContext("2d"), g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      g.addColorStop(0, col); g.addColorStop(0.25, /^#[0-9a-f]{6}$/i.test(col) ? col + "99" : col); g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g; c.fillRect(0, 0, S, S);
    } catch (e) { sp = null; }
    SPRITES[col] = sp;
    return sp;
  }
  function glow(ctx, x, y, r, col, a) {
    const aa = al(a); if (aa <= 0.004 || !(r > 0.5)) return;
    const sp = glowSprite(col);
    if (!sp) { L.glowDot(ctx, x, y, r, col, aa); return; }
    ctx.save(); ctx.globalAlpha = aa; ctx.drawImage(sp, x - r, y - r, 2 * r, 2 * r); ctx.restore();
  }
  function dust(ctx, W, H, t, n) {
    const sp = glowSprite(C.cyanSoft); if (!sp) return;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const x = (L.hash01(i * 3.1) * W + t * 8 * (0.5 + L.hash01(i))) % W, y = L.hash01(i * 7.7) * (H - 60) + Math.sin(t * 0.5 + i) * 12;
      const r = 2 + 3 * L.hash01(i * 1.3), a = L.clamp(0.35 + 0.3 * Math.sin(t + i));
      if (a <= 0.01) continue;
      ctx.globalAlpha = a; ctx.drawImage(sp, x - r * 2, y - r * 2, r * 4, r * 4);
    }
    ctx.restore();
  }
  function fill(ctx, build, style, a) {
    const aa = al(a); if (aa <= 0.004) return;
    ctx.save(); ctx.globalAlpha = aa; ctx.fillStyle = style; ctx.beginPath(); build(ctx); ctx.fill(); ctx.restore();
  }
  function stroke(ctx, build, style, width, a, dash, dashOff) {
    const aa = al(a); if (aa <= 0.004) return;
    ctx.save(); ctx.globalAlpha = aa; ctx.strokeStyle = style; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (dash) { ctx.setLineDash(dash); ctx.lineDashOffset = dashOff || 0; }
    ctx.beginPath(); build(ctx); ctx.stroke(); ctx.restore();
  }
  const polyBuild = (pts, close) => (c) => { pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); if (close) c.closePath(); };
  function partial(pts, q) {
    if (q >= 1) return pts;
    const seg = []; let total = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); total += d; }
    let rem = total * L.clamp(q); const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      if (rem >= seg[i - 1]) { out.push(pts[i]); rem -= seg[i - 1]; }
      else { const f = rem / Math.max(1e-6, seg[i - 1]); out.push([L.lerp(pts[i - 1][0], pts[i][0], f), L.lerp(pts[i - 1][1], pts[i][1], f)]); break; }
    }
    return out;
  }
  function hatch(ctx, pts, col, spacing, a) {
    const aa = al(a); if (aa <= 0.004) return;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    pts.forEach((q) => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
    const hgt = y1 - y0; spacing = Math.max(3, spacing);
    // Schraffur analytisch auf das konvexe Polygon beschneiden (Cyrus-Beck) – ohne teure Clip-Maske
    const n = pts.length; let mx = 0, my = 0; pts.forEach((q) => { mx += q[0] / n; my += q[1] / n; });
    const edges = pts.map((q, i) => { const r = pts[(i + 1) % n]; let nx = -(r[1] - q[1]), ny = r[0] - q[0]; if ((mx - q[0]) * nx + (my - q[1]) * ny < 0) { nx = -nx; ny = -ny; } return [q[0], q[1], nx, ny]; });
    ctx.save(); ctx.globalAlpha = aa; ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath();
    for (let xx = x0 - hgt; xx < x1; xx += spacing) {
      const ax = xx, ay = y1, dx = hgt, dy = y0 - y1; let t0 = 0, t1 = 1;
      for (let k = 0; k < edges.length && t1 > t0; k++) {
        const e = edges[k], num = (ax - e[0]) * e[2] + (ay - e[1]) * e[3], den = dx * e[2] + dy * e[3];
        if (Math.abs(den) < 1e-9) { if (num < 0) t1 = -1; } else if (den > 0) t0 = Math.max(t0, -num / den); else t1 = Math.min(t1, -num / den);
      }
      if (t1 > t0) { ctx.moveTo(ax + dx * t0, ay + dy * t0); ctx.lineTo(ax + dx * t1, ay + dy * t1); }
    }
    ctx.stroke(); ctx.restore();
  }
  /* Beschriftung mit Führungslinie (Zeichnungs-Stil). */
  function label(ctx, s, lx, ly, tx, ty, col, a, right) {
    const o = { font: FONT.mono, size: 14, weight: 700, letterSpacing: 1 };
    const sg = right ? 1 : -1;
    stroke(ctx, (c) => { c.moveTo(tx, ty); c.lineTo(lx + sg * 8, ly - 5); c.lineTo(lx + sg * 3, ly - 5); }, rgba(col, 0.65), 1, a);
    fill(ctx, (c) => c.arc(tx, ty, 2.6, 0, TAU), col, a);
    text(ctx, s, lx, ly, Object.assign({ color: "rgba(226,240,255,0.95)", alpha: a, align: right ? "right" : "left" }, o));
  }

  /* ---------------- Ebenen-Cache (statische Teile einmal rendern, danach nur blitten) ---------------- */
  let VEC = false; // true, wenn die Kamera skaliert: große Ebenen dann als Vektoren zeichnen (Blits würden gefiltert)
  function getLayer(m, key, w, h, paint, allowVec) {
    if (VEC && !allowVec) return null;
    m.layers = m.layers || {};
    let cv = m.layers[key];
    if (cv === undefined) {
      cv = null;
      try {
        if (typeof document !== "undefined" && w >= 1 && h >= 1) {
          cv = document.createElement("canvas"); cv.width = Math.ceil(w); cv.height = Math.ceil(h);
          const c2 = cv.getContext("2d"); const saved = GA; GA = 1;
          try { paint(c2); } finally { GA = saved; }
        }
      } catch (e) { cv = null; }
      m.layers[key] = cv;
    }
    return cv;
  }
  /* Unskalierte Blits immer auf ganze Pixel legen – bilineares Filtern ist in Software-Rastern sehr teuer. */
  function blit(ctx, cv, x, y, a, w, h) {
    const aa = al(a); if (!cv || aa <= 0.004) return;
    ctx.save(); ctx.globalAlpha = aa;
    if (w != null && (Math.abs(w - cv.width) > 0.5 || Math.abs(h - cv.height) > 0.5)) ctx.drawImage(cv, x, y, w, h);
    else ctx.drawImage(cv, Math.round(x), Math.round(y));
    ctx.restore();
  }

  /* Kamera-Zoom aktiv? Dann sind große Blits teuer (bilineare Filterung) -> Vektor-Pfad bevorzugen. */
  function isScaled(ctx) {
    try { const tr = ctx.getTransform(); return Math.abs(tr.a - 1) > 1e-3 || Math.abs(tr.d - 1) > 1e-3 || Math.abs(tr.b) > 1e-3 || Math.abs(tr.c) > 1e-3; } catch (e) { return false; }
  }
  /* Vertikaler Lichtstreifen (vorgerendert), auf das Panel beschnitten ohne Clip-Maske. */
  function sweep(ctx, m, key, x, y, w, h, cx, bw, rgb, peak, a) {
    const band = getLayer(m, key + "_" + Math.round(h) + "_" + bw, bw, Math.max(1, Math.round(h - 6)), (c2) => {
      const g = c2.createLinearGradient(0, 0, bw, 0);
      g.addColorStop(0, "rgba(" + rgb + ",0)"); g.addColorStop(0.5, "rgba(" + rgb + "," + peak + ")"); g.addColorStop(1, "rgba(" + rgb + ",0)");
      c2.fillStyle = g; c2.fillRect(0, 0, bw, Math.round(h - 6));
    }, true);
    const aa = al(a); if (!band || aa <= 0.004) return;
    const left = Math.round(cx - bw / 2), sx0 = Math.max(Math.round(x + 2), left), sx1 = Math.min(Math.round(x + w - 2), left + bw);
    if (sx1 - sx0 < 1) return;
    ctx.save(); ctx.globalAlpha = aa;
    ctx.drawImage(band, sx0 - left, 0, sx1 - sx0, band.height, sx0, Math.round(y + 3), sx1 - sx0, band.height);
    ctx.restore();
  }

  /* ---------------- Text ---------------- */
  function wrapLines(ctx, s, maxW, o) {
    const out = []; out.broken = false;
    String(s).split(/\n/).forEach((para) => {
      const words = para.split(/\s+/).filter(Boolean); let cur = "";
      for (let w of words) {
        const test = cur ? cur + " " + w : w;
        if (L.measure(ctx, test, o) <= maxW) { cur = test; continue; }
        if (cur) { out.push(cur); cur = ""; }
        while (w.length > 3 && L.measure(ctx, w, o) > maxW) {
          let k = w.length - 1;
          while (k > 2 && L.measure(ctx, w.slice(0, k) + "-", o) > maxW) k--;
          k = hyphenAt(w, k);
          out.push(w.slice(0, k) + "-"); w = w.slice(k); out.broken = true;
        }
        cur = w;
      }
      if (cur) out.push(cur);
    });
    return out;
  }
  /* Silbengrenze für Notumbrüche langer Komposita suchen (einfache deutsche Heuristik: zwischen zwei Konsonanten
     – ohne ch/ck/sch/ph/th zu trennen – oder vor einem Konsonanten, dem ein Vokal folgt). */
  const VOW = /[aeiouäöüyAEIOUÄÖÜY]/, CONS = /[b-df-hj-np-tv-zßB-DF-HJ-NP-TV-Z]/;
  const ONSET = /^(sch[rlmnw]?|spr|str|sp|st|[bcdfgkpt][rl]|ph|pf|th|ch|qu|[b-df-hj-np-tv-zß])[aeiouäöüy]/i;
  function hyphenAt(w, k) {
    const lo = Math.max(3, k - 8);
    for (let j = k; j >= lo; j--) if (w.length - j >= 3 && /(keits|heits|ungs|ings|ions|täts|schafts)$/i.test(w.slice(0, j))) return j; // Fugen-s
    for (let j = k; j >= lo; j--) {
      if (w.length - j < 3) continue;
      const rest = w.slice(j), a = w[j - 1];
      if (!ONSET.test(rest)) continue;
      if (/^(ch|ck)/i.test(w.slice(j - 1, j + 1)) || /^sch/i.test(w.slice(j - 2, j + 1)) || /^sc/i.test(w.slice(j - 1, j + 1))) continue;
      if (CONS.test(a) && /s/i.test(a) && j - 2 >= lo && CONS.test(w[j - 2]) && /^(sp|st)[aeiouäöüy]/i.test(w.slice(j - 1))) return j - 1; // seil|spann statt seils|pann
      if (VOW.test(a) || CONS.test(a)) return j;
    }
    return k;
  }
  /* Ausgewogener Umbruch: gleiche Zeilenzahl, aber möglichst gleich lange Zeilen. */
  function wrapBalanced(ctx, s, maxW, o) {
    const base = wrapLines(ctx, s, maxW, o);
    if (base.length < 2 || base.broken) return base;
    let lo = maxW * 0.4, hi = maxW, best = base;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2, t = wrapLines(ctx, s, mid, o);
      if (t.length <= base.length && !t.broken) { best = t; hi = mid; } else lo = mid;
    }
    return best;
  }
  function clampLines(ctx, lines, max, maxW, o) {
    if (lines.length <= max) return lines;
    const r = lines.slice(0, max); let last = r[max - 1].replace(/-$/, "");
    while (last.length > 1 && L.measure(ctx, last + "…", o) > maxW) last = last.slice(0, -1).replace(/\s+$/, "");
    r[max - 1] = last + "…"; r.broken = lines.broken;
    return r;
  }
  function str(v) {
    if (v == null || v === false) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" && isFinite(v)) return String(v).replace(".", ",");
    if (typeof v === "object" && !Array.isArray(v)) return str(v.text ?? v.label ?? v.title ?? v.name ?? "");
    return String(v);
  }
  // Dezimalpunkt → Komma (0.63 → 0,63), Tausenderpunkte (1.000) und Datumsangaben bleiben unberührt.
  const deDecimal = (s) => s.replace(/(^|[^\d.,])(\d+)\.(\d{1,2})(?![\d.])/g, "$1$2,$3");
  const clean = (s) => deDecimal(String(s).replace(/[ \t\r]+/g, " ").replace(/ *\n */g, "\n").trim());

  /* ---------------- Versalien: Einheiten bleiben klein (m/s, cm/s, km/h, m, g …) ---------------- */
  const UNIT_NUM = /(\d)(\s?)(m\/s²|m\/s2|m\/s|cm\/s|mm\/s|km\/h|kWh|kW|kN|kg|mm|cm|km|min|ms|m²|m³|m|g|s|h|t|l)(?![\p{L}\d])/gu;
  const UNIT_ALONE = /(^|[\s(\/–—-])(m\/s²|m\/s|cm\/s|mm\/s|km\/h)(?![\p{L}\d])/gu;
  function smartUpper(s0) {
    const s = String(s0 == null ? "" : s0); if (!s) return s;
    const keep = new Uint8Array(s.length); let mm;
    UNIT_NUM.lastIndex = 0;
    while ((mm = UNIT_NUM.exec(s))) { const st = mm.index + mm[1].length + mm[2].length; keep.fill(1, st, st + mm[3].length); }
    UNIT_ALONE.lastIndex = 0;
    while ((mm = UNIT_ALONE.exec(s))) { const st = mm.index + mm[1].length; keep.fill(1, st, st + mm[2].length); }
    let out = "", i = 0;
    while (i < s.length) { let j = i; const kk = keep[i]; while (j < s.length && keep[j] === kk) j++; const part = s.slice(i, j); out += kk ? part : part.toUpperCase(); i = j; }
    return out;
  }
  const caseFn = (mode) => (/^(none|keep|original|as_?is|normal|mixed|false)$/i.test(String(mode == null ? "" : mode)) ? (x) => x : smartUpper);

  /* ---------------- Zahlen (deutsch) ---------------- */
  function parseNum(v) {
    if (typeof v === "number") return isFinite(v) ? v : null;
    if (typeof v !== "string") return null;
    let q = v.trim().replace(/\s/g, "").replace(/^[−–]/, "-");
    if (!q) return null;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(q)) q = q.replace(/\./g, "").replace(",", ".");
    else q = q.replace(",", ".");
    const x = Number(q); return isFinite(x) ? x : null;
  }
  function parseRange(v) {
    if (Array.isArray(v)) { const a = parseNum(v[0]), b = parseNum(v[1]); if (a != null && b != null) return [Math.min(a, b), Math.max(a, b)]; return a != null ? [a, a] : null; }
    if (typeof v === "string") { const mm = /^\s*(\d[\d.,]*)\s*(?:[–—-]|bis)\s*(\d[\d.,]*)/.exec(v); if (mm) return parseRange([mm[1], mm[2]]); }
    const x = parseNum(v); return x == null ? null : [x, x];
  }
  const decOf = (v) => { for (let d = 0; d < 3; d++) { const f = Math.pow(10, d); if (Math.abs(v * f - Math.round(v * f)) < 1e-6 * f) return d; } return 2; };
  function fmtNum(v, dec) {
    if (!isFinite(v)) return "";
    if (dec == null) dec = decOf(v);
    const q = Math.abs(v).toFixed(Math.max(0, Math.min(3, dec))).split(".");
    const ip = q[0].length > 4 ? q[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".") : q[0];
    return (v < 0 ? "−" : "") + ip + (q[1] ? "," + q[1] : "");
  }
  const fmtRange = (r, unit) => (r[0] === r[1] ? fmtNum(r[0]) : fmtNum(r[0]) + "–" + fmtNum(r[1])) + (unit ? " " + unit : "");

  /* ---------------- Parameter ---------------- */
  function normVariant(v) {
    const k = String(v == null ? "vs" : v).toLowerCase();
    if (/myth|fakt|fact|irrtum/.test(k)) return "myth_fact";
    if (/then|now|früher|frueher|heute|before|after|vorher|nachher|past|alt_neu|old_new|damals/.test(k)) return "then_now";
    return "vs";
  }
  const ICONS = {};
  [["instantaneous_gear", "instantaneous instant instant_gear instantaneous_safety_gear sperrfang sperrfangvorrichtung"],
   ["progressive_gear", "progressive progressive_safety_gear bremsfang bremsfangvorrichtung"],
   ["old_platform", "platform plattform old historic historisch old_elevator früher"],
   ["modern_car", "car cabin kabine modern elevator aufzug modern_elevator"],
   ["rope", "ropes seil seile steel_rope wire_rope stahlseil tragseil tragseile"],
   ["belt", "belts riemen tragriemen flat_belt gurt"],
   ["carousel", "chain_carousel kettenkarussell karussell swing_ride chairoplane wave_swinger"],
   ["governor", "speed_governor overspeed_governor begrenzer geschwindigkeitsbegrenzer flyweights fliehgewichte flyweight_governor"],
   ["piston", "syringe spritze kolben plunger"],
   ["air_cushion", "aircushion luftpolster car_in_shaft kolbeneffekt piston_effect air_piston"],
   ["people", "persons personen silhouettes silhouetten menschen workers pictogram piktogramm"]].forEach(([k, al2]) => { ICONS[k] = k; al2.split(" ").forEach((a) => (ICONS[a] = k)); });
  function normIcon(v) { if (typeof v !== "string") return "none"; return ICONS[v.trim().toLowerCase().replace(/[\s-]+/g, "_")] || "none"; }
  function normMark(v) {
    if (v === true) return "tick";
    if (v === false) return "cross";
    if (typeof v !== "string") return null;
    const k = v.trim().toLowerCase();
    if (/^(tick|ticks|check|checkmark|haken|ok|yes|ja|pro|plus|good|gut|true|richtig|✓|✔|\+)$/.test(k)) return "tick";
    if (/^(cross|x|kreuz|no|nein|con|contra|minus|bad|schlecht|false|falsch|✗|✘|×|-)$/.test(k)) return "cross";
    if (/^(dot|dots|neutral|bullet|punkt|info|none|•|·|o)$/.test(k)) return "dot";
    return null;
  }
  function parsePoint(v) {
    let s = "", mark = null, at = null, strike = false, dim = false, strikeAt = null;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      s = str(v.text ?? v.label ?? v.title ?? v.point ?? v.value ?? "");
      mark = normMark(v.mark ?? v.type ?? v.icon ?? v.status ?? v.kind ?? (v.good != null ? !!v.good : v.ok != null ? !!v.ok : v.pro != null ? !!v.pro : null));
      at = parseNum(v.at ?? v.t ?? v.time);
      strike = !!(v.strike ?? v.struck ?? v.crossed ?? v.strikethrough);
      dim = !!(v.dim ?? v.faded ?? v.muted ?? v.pale);
      strikeAt = parseNum(v.strikeAt ?? v.strike_at);
    } else s = str(v);
    s = clean(s);
    const sk = /^~~\s*([\s\S]*?)\s*~~$/.exec(s);
    if (sk) { s = sk[1]; strike = true; dim = true; }
    let mm;
    if ((mm = /^(?:\+\s+|[✓✔☑✅]\s*)/.exec(s))) { mark = mark || "tick"; s = s.slice(mm[0].length); }
    else if ((mm = /^(?:[✗✘×✕❌]\s*)/.exec(s))) { mark = mark || "cross"; s = s.slice(mm[0].length); }
    else if ((mm = /^(?:[-–—•·*]\s+)/.exec(s))) s = s.slice(mm[0].length);
    s = s.trim();
    return s ? { text: s, mark, explicit: !!mark, at, strike, dim, strikeAt } : null;
  }
  const THEME = {
    vs: { lc: C.cyan, rc: C.amber, ltag: "", rtag: "", lmark: "tick", rmark: "tick", lt: "Variante A", rt: "Variante B", hi: "none", strike: false },
    then_now: { lc: C.amber, rc: C.cyan, ltag: "FRÜHER", rtag: "HEUTE", lmark: "cross", rmark: "tick", lt: "Früher", rt: "Heute", hi: "none", strike: false },
    myth_fact: { lc: C.red, rc: GREEN, ltag: "MYTHOS", rtag: "FAKT", lmark: "cross", rmark: "tick", lt: "Mythos", rt: "Fakt", hi: "right", strike: true },
  };
  const DEFAULTS = {
    vs: {
      left: { title: "Sperrfangvorrichtung", icon: "instantaneous_gear", points: ["Klemmrolle blockiert sofort an der Führungsschiene", "Sehr kurzer Fangweg, hohe Verzögerung", "Nur bis 0,63 m/s Nenngeschwindigkeit"] },
      right: { title: "Bremsfangvorrichtung", icon: "progressive_gear", points: ["Keil und Federpaket bremsen kontrolliert", "Mittlere Verzögerung 0,2 bis 1 g", "Pflicht ab über 1 m/s Nenngeschwindigkeit"] },
    },
    then_now: {
      left: { title: "Offene Plattform um 1850", icon: "old_platform", points: ["Ein einzelnes Hanfseil", "Keine Fangvorrichtung", "Seilriss bedeutete Absturz"] },
      right: { title: "Moderner Aufzug", icon: "modern_car", points: ["Mehrere Tragseile mit hoher Sicherheitsreserve", "Geschwindigkeitsbegrenzer und Fangvorrichtung", "Puffer in der Schachtgrube"] },
    },
    myth_fact: {
      left: { title: "Seil reißt = freier Fall", icon: "rope", points: ["Die Kabine hängt an einem einzigen Seil", "Nach einem Seilriss stürzt sie ungebremst ab"] },
      right: { title: "So ist es wirklich", icon: "progressive_gear", points: ["Mehrere Tragseile, jedes mit hoher Reserve", "Geschwindigkeitsbegrenzer löst bei Übergeschwindigkeit aus", "Fangvorrichtung bremst an den Führungsschienen"] },
    },
  };
  const CAPTION = {
    instantaneous_gear: "Schema · Sperrfang", progressive_gear: "Schema · Bremsfang", old_platform: "Schema · frühe Plattform",
    modern_car: "Schema · Treibscheibenaufzug", rope: "Querschnitt · Stahlseil", belt: "Querschnitt · Tragriemen",
    carousel: "Schema · Kettenkarussell", governor: "Schema · Begrenzer", piston: "Schema · Spritze", air_cushion: "Schema · Kolbeneffekt",
  };
  const GEARS = { instantaneous_gear: 1, progressive_gear: 1 };
  const FAM = { carousel: "spin", governor: "spin", piston: "press", air_cushion: "press" };

  function parseBar(v) {
    if (v == null || v === false) return null;
    const o = v && typeof v === "object" && !Array.isArray(v) ? v : { value: v };
    const r = parseRange(o.value ?? o.height ?? o.v ?? o.to ?? o.wert);
    if (!r) return null;
    const fr = parseRange(o.from ?? o.start ?? o.before);
    const unit = o.unit != null ? clean(str(o.unit)) : "";
    return {
      lo: r[0], hi: r[1], from: fr ? (fr[0] + fr[1]) / 2 : null,
      max: parseNum(o.max ?? o.scaleMax), unit, prefix: clean(str(o.prefix ?? "")),
      label: clean(str(o.label ?? o.caption ?? "")), fromLabel: clean(str(o.fromLabel ?? o.from_label ?? "")),
      text: o.text != null && o.text !== false ? clean(str(o.text)) : fmtRange(r, unit),
      fromText: o.fromText != null ? clean(str(o.fromText)) : fr ? fmtRange(fr, unit) : "",
      at: parseNum(o.at ?? o.t), fromAt: parseNum(o.fromAt ?? o.from_at),
    };
  }
  function parseStat(v) {
    if (v == null || v === false) return null;
    const o = v && typeof v === "object" && !Array.isArray(v) ? v : typeof v === "number" ? { value: v } : { text: v };
    let val = parseNum(o.value ?? o.number ?? o.n), txt = o.text ?? o.display ?? null;
    if (val == null && typeof txt === "string" && parseNum(txt) != null) { val = parseNum(txt); txt = null; }
    if (val == null && (txt == null || txt === "")) return null;
    return { value: val, text: txt != null ? clean(str(txt)) : null, prefix: clean(str(o.prefix ?? "")), suffix: clean(str(o.suffix ?? o.unit ?? "")),
      label: clean(str(o.label ?? o.caption ?? "")), decimals: parseNum(o.decimals), at: parseNum(o.at ?? o.t), bar: o.bar !== false };
  }
  function parsePeople(v, raw) {
    const o = v && typeof v === "object" && !Array.isArray(v) ? v : typeof v === "number" ? { count: v } : {};
    const n = Math.round(L.clamp(parseNum(o.count ?? o.n ?? raw.count) ?? 10, 2, 24));
    const h = parseNum(o.highlight ?? o.highlighted ?? raw.highlight) ?? 0.5;
    return { count: n, hl: Math.round(L.clamp(h <= 1 ? h * n : h, 0, n)), label: clean(str(o.label ?? raw.peopleLabel ?? "")),
      restLabel: clean(str(o.restLabel ?? o.rest_label ?? "")), at: parseNum(o.at ?? o.t), helmet: o.helmet !== false };
  }

  function parsePanel(raw, side, th, P, variant, markMode, opt) {
    if (typeof raw === "string") raw = { title: raw };
    if (Array.isArray(raw)) raw = { points: raw };
    if (!raw || typeof raw !== "object") raw = {};
    const isL = side === "left";
    const flat = (k) => P[(isL ? "left" : "right") + k];
    const title = clean(str(raw.title ?? raw.label ?? raw.name ?? raw.heading ?? raw.headline ?? flat("Title") ?? ""));
    let pts = raw.points ?? raw.bullets ?? raw.items ?? raw.lines ?? raw.list ?? raw.facts ?? raw.punkte ?? flat("Points") ?? [];
    if (typeof pts === "string") pts = pts.split(/\n|;|\|/);
    if (!Array.isArray(pts)) pts = [];
    const icon = normIcon(raw.icon ?? raw.drawing ?? raw.schematic ?? raw.image ?? flat("Icon"));
    let tag = raw.tag ?? raw.badge ?? raw.kicker ?? raw.eyebrow ?? flat("Tag");
    tag = tag === false ? "" : tag == null ? (isL ? th.ltag : th.rtag) : clean(str(tag));
    tag = smartUpper(tag).slice(0, 28);
    const ttl = title || (isL ? th.lt : th.rt);
    if (tag && smartUpper(ttl) === tag) tag = "";
    const color = resolveColor(raw.color ?? raw.accent ?? flat("Color"), isL ? th.lc : th.rc);
    const defMark = normMark(raw.mark ?? raw.marks) || (isL ? markMode[0] : markMode[1]);
    const points = pts.map(parsePoint).filter(Boolean).slice(0, 8).map((pt) => {
      const mk = pt.mark || defMark;
      const mcol = mk === "cross" ? C.red : mk === "dot" ? color : (variant === "vs" && !pt.explicit) ? color : GREEN;
      return { text: pt.text, mark: mk, mcol, at: pt.at, strike: pt.strike, dim: pt.dim, strikeAt: pt.strikeAt };
    });
    const tagMark = variant === "myth_fact" && tag ? (isL ? "cross" : "tick") : null;
    // Visualisierung: Balken > Zahl > Silhouetten > Schema-Zeichnung
    let vis = "none", bar = null, stat = null, people = null;
    const barRaw = raw.bar ?? raw.heightBar ?? raw.height_bar ?? raw.balken ?? (opt.barsMode ? (raw.value ?? raw.height ?? raw.wert) : null);
    if (barRaw != null && barRaw !== false) { bar = parseBar(opt.barsMode && typeof barRaw !== "object" ? { value: barRaw, unit: raw.unit, label: raw.valueLabel, from: raw.from } : barRaw); if (bar) vis = "bar"; }
    if (vis === "none" && raw.stat != null && raw.stat !== false) { stat = parseStat(raw.stat); if (stat) vis = "stat"; }
    if (vis === "none" && (icon === "people" || (raw.people != null && raw.people !== false))) { people = parsePeople(raw.people, raw); vis = "people"; }
    if (vis === "none" && icon !== "none") vis = "icon";
    const capDef = vis === "icon" ? (CAPTION[icon] || "") : "";
    const caption = raw.caption != null && raw.caption !== false ? clean(str(raw.caption)) : raw.caption === false ? "" : capDef;
    const dl = raw.diagramLabel ?? raw.diagram_label ?? raw.resultLabel ?? raw.result_label;
    const diagLabel = opt.diagOff || dl === false || dl === "" ? "" : dl == null ? null : clean(str(dl));
    return { side, title: ttl, points, icon: vis === "icon" ? icon : "none", vis, bar, stat, people, tag, tagMark, color, caption, diagLabel,
      labels: raw.labels !== false && raw.legend !== false,
      at: parseNum(raw.at ?? raw.enterAt ?? raw.t), visualAt: parseNum(raw.visualAt ?? raw.visual_at ?? raw.actAt ?? raw.iconAt ?? raw.triggerAt) };
  }

  /* ---------------- Layout ---------------- */
  const TITLE_O = (sz) => ({ font: FONT.head, weight: 700, size: sz });
  const BODY_O = (sz) => ({ font: FONT.body, weight: 600, size: sz });

  function layoutTextBox(ctx, s, cf) {
    const up = (cf || smartUpper)(s);
    const o = (sz) => ({ size: sz, weight: 700, font: FONT.head, letterSpacing: 2 });
    const maxW = 1230;
    for (const sz of [40, 36]) { const w = L.measure(ctx, up, o(sz)); if (w <= maxW) return { lines: [up], size: sz, w: w + 70, h: sz + 34, lh: sz * 1.2 }; }
    const sz = 34; const lines = clampLines(ctx, wrapBalanced(ctx, up, maxW, o(sz)), 2, maxW, o(sz));
    const w = Math.max.apply(null, lines.map((l) => L.measure(ctx, l, o(sz))));
    return { lines, size: sz, w: w + 70, h: sz + 34 + (lines.length - 1) * sz * 1.2, lh: sz * 1.2 };
  }

  function layoutPanel(ctx, P, geo, fs, ih, maxLines) {
    let yy = geo.headerH;
    P.iconY = 0; P.ih = 0;
    if (P.vis !== "none" && ih > 0) { P.iconY = yy + 8; P.ih = ih; yy += ih + 34; }
    const lh = Math.round(fs * 1.28), gap = Math.round(fs * 0.66);
    const tw = geo.innerW - fs * 1.6, o = BODY_O(fs);
    P.rows = [];
    P.wc = P.wc || {};
    P.points.forEach((pt, i) => {
      const wk = fs + "|" + (maxLines || 0) + "|" + i + "|" + pt.text;
      let lines = P.wc[wk];
      if (!lines) {
        lines = wrapBalanced(ctx, pt.text, tw, o);
        if (maxLines) lines = clampLines(ctx, lines, maxLines, tw, o);
        P.wc[wk] = lines;
      }
      const h = (lines.length - 1) * lh + fs * 1.18;
      P.rows.push({ i, side: P.side, lines, widths: lines.map((l) => L.measure(ctx, l, o)), y: yy, h, mark: pt.mark, mcol: pt.mcol, k: 0,
        at: pt.at, strike: !!pt.strike, dim: !!pt.dim, strikeAt: pt.strikeAt });
      yy += h + gap;
    });
    if (P.rows.length) yy -= gap;
    yy += 32;
    P.fs = fs; P.lh = lh; P.gap = gap; P.contentH = yy;
    return yy;
  }

  const CAMS = { slow_push_in: [[1, 0, 0], [1.1, 0, 0]], slow_pull_out: [[1, 0, 0], [1.1, 0, 0]], pan_left: [[1.08, 60, 0], [1.08, -60, 0]], pan_right: [[1.08, 60, 0], [1.08, -60, 0]], tilt_down: [[1.08, 0, 45], [1.08, 0, -45]], tilt_up: [[1.08, 0, 45], [1.08, 0, -45]] };
  function safeBox(p, W, H) {
    const cams = CAMS[(p.scene && p.scene.camera) || ""] || [[1, 0, 0]];
    const f = p.params && Array.isArray(p.params.focus) ? p.params.focus : [];
    const fx = (isFinite(Number(f[0])) && f[0] != null ? L.clamp(Number(f[0])) : 0.5) * W, fy = (isFinite(Number(f[1])) && f[1] != null ? L.clamp(Number(f[1])) : 0.5) * H;
    // Bildschirmposition = Fokus + Versatz + (Inhalt − Fokus) · Skalierung  →  invertiert für alle Extremstellungen der Kamera
    const inv = (scr, fc, dd, ss) => fc + (scr - fc - dd) / ss;
    const ext = (fn, vals) => fn.apply(null, vals);
    return {
      x0: ext(Math.max, cams.map((c) => inv(94, fx, c[1], c[0]))), x1: ext(Math.min, cams.map((c) => inv(W - 94, fx, c[1], c[0]))),
      yMax: (scr) => ext(Math.max, cams.map((c) => inv(scr, fy, c[2], c[0]))),
      yMin: (scr) => ext(Math.min, cams.map((c) => inv(scr, fy, c[2], c[0]))),
    };
  }
  function buildModel(ctx, p) {
    const P = p.params && typeof p.params === "object" ? p.params : {};
    const W = p.W || 1920, H = p.H || 1080;
    const vRaw = P.variant ?? P.mode ?? P.kind;
    const barsMode = /bar|balken|height/i.test(String(vRaw ?? "")) || /bar|balken|height/i.test(String(P.style ?? P.layout ?? ""));
    const variant = normVariant(vRaw);
    const th = THEME[variant];
    let rawL = P.left ?? P.a ?? P.links ?? P.lhs;
    let rawR = P.right ?? P.b ?? P.rechts ?? P.rhs;
    const flatGiven = ["leftTitle", "rightTitle", "leftPoints", "rightPoints"].some((k) => P[k] != null);
    if (rawL == null && rawR == null && !flatGiven) { rawL = DEFAULTS[variant].left; rawR = DEFAULTS[variant].right; }
    const mm = String(P.marks ?? P.markStyle ?? "auto").toLowerCase();
    let markMode = [th.lmark, th.rmark];
    if (/^(ticks?|haken|checks?)$/.test(mm)) markMode = ["tick", "tick"];
    else if (/^(dots?|neutral|bullets?|none|punkte)$/.test(mm)) markMode = ["dot", "dot"];
    else if (/^(cross_?tick|bad_?good|contra_?pro)$/.test(mm)) markMode = ["cross", "tick"];
    else if (/^(tick_?cross|good_?bad|pro_?contra)$/.test(mm)) markMode = ["tick", "cross"];
    const m = { W, H, variant };
    const opt = { barsMode, diagOff: P.diagramLabels === false || P.diagramLabel === false };
    m.left = parsePanel(rawL, "left", th, P, variant, markMode, opt);
    m.right = parsePanel(rawR, "right", th, P, variant, markMode, opt);
    m.heading = caseFn(P.headingCase ?? P.heading_case)(clean(str(P.heading ?? P.headline ?? P.title ?? P.ueberschrift ?? "")));
    m.text = clean(str(p.text));
    m.textCase = caseFn(P.textCase ?? P.text_case ?? P.overlayCase);
    m.badgeText = smartUpper(clean(str(P.badge ?? P.vsLabel ?? "")) || "VS").slice(0, 5);
    let hi = String(P.highlight ?? P.winner ?? th.hi).toLowerCase();
    hi = /^(left|links|a|l)$/.test(hi) ? "left" : /^(right|rechts|b|r)$/.test(hi) ? "right" : "none";
    m.highlight = hi;
    const sk = P.strike ?? P.strikeMyths ?? th.strike;
    m.strikeSide = sk === true || sk === "left" ? "left" : sk === "right" ? "right" : "none";
    m.reveal = /seq|left_first|links_zuerst|nacheinander/.test(String(P.reveal ?? P.order ?? "alternate").toLowerCase()) ? "sequential" : "alternate";
    m.beats = (Array.isArray(P.beats) ? P.beats : []).map(parseNum);
    m.syncAt = parseNum(P.syncAt ?? P.sync_at);
    // Solo-Auftritt: kommt ein Panel deutlich später, steht das erste bis dahin mittig ("auto" | true | false)
    const soloRaw = P.solo ?? P.soloCenter ?? P.solo_center;
    m.heroOff = (P.heroHeading ?? P.headingHero) === false;
    m.solo = soloRaw === false || /^(off|false|no|nein|aus|none)$/i.test(String(soloRaw ?? "")) ? false : soloRaw === true ? true : "auto";
    // gemeinsame Skalen (Balken / Zahlen), damit beide Seiten direkt vergleichbar sind
    const bars = [m.left.bar, m.right.bar].filter(Boolean);
    if (bars.length) {
      let mx = 0; bars.forEach((b) => { mx = Math.max(mx, b.hi, b.from || 0); });
      const given = bars.map((b) => b.max).filter((x) => x != null && x > 0);
      const raw = given.length ? Math.max.apply(null, given) : mx * 1.08;
      let step = 1;
      const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1e-6, raw))));
      for (const f of [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10]) { if (raw / (f * mag) <= 6) { step = f * mag; break; } }
      m.barStep = step; m.barMax = given.length ? raw : Math.max(step, Math.ceil(raw / step - 1e-9) * step);
    }
    const stats = [m.left.stat, m.right.stat].filter((q) => q && q.value != null);
    m.statMax = stats.length ? Math.max.apply(null, stats.map((q) => Math.abs(q.value))) || 1 : 1;
    m.statCount = stats.length;
    m.statLog = /log/i.test(String(P.statScale ?? P.stat_scale ?? ""));
    m.statBar = P.statBar !== false;

    /* Sicherheitsrahmen in Inhalts-Koordinaten – berücksichtigt die Kamerafahrt der Engine,
       damit Panels auch bei Zoom/Schwenk nie über den 90-px-Rand bzw. in den Untertitelbereich laufen. */
    const sb = safeBox(p, W, H);
    m.mid = (sb.x0 + sb.x1) / 2;
    const YB = sb.yMin(H - 172);
    let top = sb.yMax(90);
    if (m.text) { m.tb = layoutTextBox(ctx, m.text, m.textCase); top = sb.yMax(96 + m.tb.h + 22); }
    let hdH = 0;
    if (m.heading) {
      const ho = (sz) => ({ font: FONT.head, weight: 700, size: sz, letterSpacing: 3 });
      const maxW = Math.min(1480, sb.x1 - sb.x0 - 180); let hd = null;
      for (const sz of [50, 44, 40]) { const w = L.measure(ctx, m.heading, ho(sz)); if (w <= maxW) { hd = { lines: [m.heading], size: sz, w0: w }; break; } }
      if (!hd) { const lines = clampLines(ctx, wrapBalanced(ctx, m.heading, maxW, ho(38)), 2, maxW, ho(38)); hd = { lines, size: 38, w0: Math.max.apply(null, lines.map((l) => L.measure(ctx, l, ho(38)))) }; }
      top = Math.max(top, sb.yMax(m.text ? 0 : 150)); hd.lh = hd.size * 1.15;
      m.hd = hd; hdH = hd.lines.length * hd.lh + 22;
    } else top = Math.max(top, sb.yMax(170));
    const top0 = top;
    const avail = YB - top0 - hdH;

    /* Panels */
    const GAPH = 86, X0 = sb.x0;
    m.pw = Math.max(320, Math.floor(m.mid - GAPH - X0));
    m.left.x = Math.round(X0); m.right.x = Math.round(m.mid + GAPH);
    const padX = 34, innerW = m.pw - 2 * padX;
    const VH = { icon: 256, bar: 300, stat: 200, people: 184 };
    const ihMax = Math.max(VH[m.left.vis] || 0, VH[m.right.vis] || 0);
    const nMax = Math.max(m.left.points.length, m.right.points.length);
    const fsMax = nMax <= 1 ? (ihMax ? 36 : 42) : nMax <= 2 ? (ihMax ? 34 : 38) : nMax <= 3 ? (ihMax ? 32 : 34) : 32;
    const tsMax = nMax <= 2 ? (ihMax ? 48 : 58) : 44;
    const titleFit = (cap) => {
      for (const sz of [58, 56, 52, 48, 44, 40, 36, 32]) {
        if (sz > cap) continue;
        const a = wrapBalanced(ctx, m.left.title, innerW, TITLE_O(sz)), b = wrapBalanced(ctx, m.right.title, innerW, TITLE_O(sz));
        if (a.length <= 2 && b.length <= 2 && !a.broken && !b.broken) return [sz, a, b];
      }
      return [30, clampLines(ctx, wrapLines(ctx, m.left.title, innerW, TITLE_O(30)), 3, innerW, TITLE_O(30)), clampLines(ctx, wrapLines(ctx, m.right.title, innerW, TITLE_O(30)), 3, innerW, TITLE_O(30))];
    };
    const hasTag = !!(m.left.tag || m.right.tag);
    const makeGeo = (tf) => {
      const ts = tf[0]; m.left.titleLines = tf[1]; m.right.titleLines = tf[2];
      let hy = 28; const chipY = hy; if (hasTag) hy += 34 + 16;
      const titleTop = hy; const nT = Math.max(tf[1].length, tf[2].length);
      hy += nT * ts * 1.12; const ulY = hy + 6; hy = ulY + 22;
      return { padX, innerW, headerH: hy, chipY, titleTop, ulY, ts, hasTag, nT };
    };
    let geo = makeGeo(titleFit(tsMax));
    const cands = [];
    if (ihMax) {
      for (let fs = fsMax; fs >= 27; fs--) for (let ih = ihMax; ih >= ihMax * 0.72 - 1; ih -= 20) cands.push([ih, fs]);
      [[196, 26], [176, 25], [156, 24], [136, 23], [116, 22], [116, 21], [0, 23], [0, 21], [0, 19]].forEach((c) => cands.push([c[0] ? Math.round(c[0] * ihMax / 256) : 0, c[1]]));
    } else for (let fs = fsMax; fs >= 19; fs--) cands.push([0, fs]);
    let ok = null;
    for (const c of cands) {
      const hl = layoutPanel(ctx, m.left, geo, c[1], c[0], 0), hr = layoutPanel(ctx, m.right, geo, c[1], c[0], 0);
      if (Math.max(hl, hr) <= avail) { ok = c; break; }
    }
    if (ok && geo.ts > Math.max(40, ok[1] * 1.5)) { // Titel nicht übermäßig größer als der Fließtext
      geo = makeGeo(titleFit(Math.max(40, ok[1] * 1.5)));
      layoutPanel(ctx, m.left, geo, ok[1], ok[0], 0); layoutPanel(ctx, m.right, geo, ok[1], ok[0], 0);
    }
    if (!ok) { // Notfall: Zeilen begrenzen, überzählige Punkte weglassen – nie überlaufen
      let guard = 0;
      while (guard++ < 20) {
        const hl = layoutPanel(ctx, m.left, geo, 19, 0, 2), hr = layoutPanel(ctx, m.right, geo, 19, 0, 2);
        if (Math.max(hl, hr) <= avail) break;
        const big = hl >= hr ? m.left : m.right;
        if (big.points.length) big.points = big.points.slice(0, -1); else break;
      }
    }
    m.geo = geo;
    m.ph = Math.max(m.left.contentH, m.right.contentH, 160);
    // wenig Inhalt: Panels etwas höher, Inhalt darin vertikal mittig (gleicher Versatz links/rechts -> Zeilen bleiben bündig)
    const minPh = Math.min(avail, Math.round(avail * 0.6));
    m.bodyOff = 0;
    if (m.ph < minPh) {
      m.bodyOff = Math.round((minPh - m.ph) * 0.5); m.ph = minPh;
      [m.left, m.right].forEach((Q) => { if (Q.ih > 0) Q.iconY += m.bodyOff; Q.rows.forEach((r) => (r.y += m.bodyOff)); });
    }
    // Block (Überschrift + Panels) vertikal zentrieren, leicht nach oben versetzt
    const blockTop = top0 + Math.max(0, avail - m.ph) * 0.44;
    if (m.hd) m.hd.top = blockTop;
    m.py = Math.round(blockTop + hdH);

    /* Aufdeck-Reihenfolge */
    const order = []; const nl = m.left.rows.length, nr = m.right.rows.length;
    if (m.reveal === "sequential") { for (let i = 0; i < nl; i++) order.push(m.left.rows[i]); for (let i = 0; i < nr; i++) order.push(m.right.rows[i]); }
    else for (let i = 0; i < Math.max(nl, nr); i++) { if (i < nl) order.push(m.left.rows[i]); if (i < nr) order.push(m.right.rows[i]); }
    order.forEach((r, k) => (r.k = k));
    m.order = order;
    m.nOrder = order.length;
    return m;
  }

  const CACHE = new Map();
  function getModel(ctx, p) {
    let key;
    try { key = JSON.stringify([p.params || null, p.text || "", p.W, p.H, (p.scene && p.scene.camera) || ""]); } catch (e) { key = "fallback"; }
    let m = CACHE.get(key);
    if (!m) { m = buildModel(ctx, p); if (CACHE.size > 8) CACHE.clear(); CACHE.set(key, m); }
    return m;
  }

  /* ---------------- Zeitplan (skaliert mit Szenendauer) ---------------- */
  function timings(m, d) {
    if (m._tm && m._tm.d === d) return m._tm;
    const k = L.clamp(d / 8, 0.5, 1.4), hiT = Math.max(0.3, d - 0.3);
    const T = (v) => (v == null || !isFinite(v) ? null : L.clamp(v, 0.3, hiT));
    const B = m.beats || [];
    const tm = { k, d };
    tm.T0 = T(B[0]) ?? 0;
    tm.panelD = 1.0 * k;
    tm.div0 = tm.T0 + 0.15 * k; tm.divD = 0.9 * k;
    tm.badge0 = tm.T0 + 0.5 * k; tm.badgeD = 0.7 * k;
    tm.head0 = 0.4 * k; tm.headD = 0.7 * k;
    tm.iconD = 0.9 * k;
    const actD = L.clamp(0.32 * d, 1.2, 4.2);
    const sides = ["left", "right"];
    sides.forEach((side, si) => {
      const P = m[side];
      const pt = (P.pt = { d, k, iconD: tm.iconD, actD, liftD: 0.2 * actD, tsInst: 0.08, tsProg: 0.42 * actD, rampD: L.clamp(0.2 * d, 1.0, 1.8), pressD: L.clamp(0.24 * d, 1.2, 2.4) });
      pt.enter = T(P.at) ?? tm.T0 + si * 0.08 * k;
      pt.visDef = pt.enter + 0.7 * k + si * 0.12 * k;
      pt.explicit = T(P.visualAt ?? (P.bar && P.bar.at) ?? (P.stat && P.stat.at) ?? (P.people && P.people.at) ?? B[1 + si]);
    });
    { // Frage-Karte: Überschrift groß in der Bildmitte, bis das erste Panel einfährt (nur wenn das ≥ 1,2 s dauert)
      const first = Math.min(m.left.pt.enter, m.right.pt.enter);
      if (m.hd && !m.heroOff && first >= 1.2) { tm.heroUntil = first; tm.heroMove0 = first - 0.6 * k; tm.heroMoveD = 0.8 * k; }
    }
    { // Solo: das früh erscheinende Panel steht mittig, bis sein Partner einfährt; Trennlinie + Badge kommen mit dem Partner
      const eL = m.left.pt.enter, eR = m.right.pt.enter;
      if (m.solo !== false && Math.abs(eR - eL) >= (m.solo === true ? 0.3 : 1.0)) {
        tm.soloSide = eL < eR ? "left" : "right"; tm.soloUntil = Math.max(eL, eR);
        tm.soloLead = 0.3 * k; tm.soloD = tm.panelD;
        tm.div0 = Math.max(tm.div0, tm.soloUntil - 0.1 * k);
        tm.badge0 = Math.max(tm.badge0, tm.soloUntil + 0.35 * k);
      }
    }
    const Lp = m.left, Rp = m.right, fam = FAM[Lp.icon];
    const sync = Lp.vis === "icon" && Rp.vis === "icon" && fam && fam === FAM[Rp.icon];
    if (sync) { // Analogie-Paar: beide Zeichnungen laufen exakt synchron
      const sh = T(m.syncAt) ?? Lp.pt.explicit ?? Rp.pt.explicit ?? (Math.max(Lp.pt.visDef, Rp.pt.visDef) + tm.iconD + 0.25 * k);
      [Lp, Rp].forEach((P) => {
        // Panel fährt erst nach der gemeinsamen Aktion ein: Aktion beim Auftritt nachholen (eigenes visualAt oder kurz nach der Einfahrt),
        // statt schon fertig einzufahren – der Endzustand ist wieder identisch (gleiche Drehzahl / gleiche Verdichtung).
        const own = T(P.visualAt);
        if (P.pt.enter > sh - 0.3 * k) { P.pt.late = true; P.pt.explicit = own != null && own >= P.pt.enter ? own : Math.max(sh, P.pt.enter + 0.45 * k); }
        else P.pt.explicit = sh;
      });
    }
    sides.forEach((side) => {
      const P = m[side], pt = P.pt;
      let act;
      if (P.vis === "icon" && GEARS[P.icon]) act = pt.explicit ?? (pt.enter + 1.15 * k + 0.42 * actD);
      else act = pt.explicit ?? (pt.visDef + tm.iconD + 0.25 * k);
      pt.tAct = act; pt.tE = act;
      // Zahl mit eigenem Zeitpunkt: Rahmen erst kurz vor der Zahl aufdecken (kein leerer Kasten)
      const statLate = P.vis === "stat" && P.stat && (P.stat.at != null || P.visualAt != null);
      pt.tVis = pt.explicit != null ? Math.max(pt.enter + 0.25 * k, statLate ? act - tm.iconD - 0.25 : Math.min(pt.visDef, act - tm.iconD - 0.25)) : pt.visDef;
      if (P.bar) pt.fromAt = T(P.bar.fromAt) ?? Math.max(pt.tVis + 0.2, Math.min(pt.tVis + 0.45 * tm.iconD, act - 1.0));
    });
    if (sync && !Lp.pt.late && !Rp.pt.late) Rp.pt.tVis = Lp.pt.tVis = Math.min(Lp.pt.tVis, Rp.pt.tVis + 0.1 * k);
    // Stichpunkte
    const order = m.order || [], n = Math.max(1, order.length);
    tm.b0 = tm.T0 + 1.2 * k;
    tm.b1 = Math.min(Math.max(tm.b0 + 0.22 * n, 0.56 * d), 0.8 * d);
    tm.step = (tm.b1 - tm.b0) / n;
    tm.bD = L.clamp(tm.step * 1.3, 0.35, 0.75);
    let lastExp = -1, lastEnd = order.length ? 0 : tm.b1;
    order.forEach((row, idx) => {
      const ex = T(row.at);
      if (ex != null) { row.t0 = ex; lastExp = ex; }
      else row.t0 = Math.min(hiT - 0.2, Math.max(tm.b0 + tm.step * idx, m[row.side].pt.enter + 0.6 * k, lastExp >= 0 ? lastExp + 0.35 : 0));
      lastEnd = Math.max(lastEnd, row.t0 + tm.bD);
    });
    const vb = T(B[3]);
    tm.hi0 = vb ?? Math.min(lastEnd + 0.25 * k, Math.max(0.3, d - 0.7));
    tm.strike0 = vb ?? Math.min(lastEnd + 0.1 * k, Math.max(0.3, d - 0.8));
    order.forEach((row) => {
      row.sideAt = Math.max(tm.strike0 + row.i * 0.14 * k, row.t0 + tm.bD * 0.6);
      row.sAt = T(row.strikeAt) ?? row.t0 + tm.bD * 0.9;
    });
    sides.forEach((side) => {
      const P = m[side]; let dn = 0;
      P.rows.forEach((r) => {
        dn = Math.max(dn, r.t0 + tm.bD);
        if (m.strikeSide === side) dn = Math.max(dn, r.sideAt + 0.5 * k);
        if (r.strike) dn = Math.max(dn, r.sAt + 0.45);
      });
      P.pt.doneT = dn + 0.02;
    });
    m._tm = tm;
    return tm;
  }

  /* ---------------- Marker ---------------- */
  function glyph(ctx, kind, cx, cy, r, col, q, width, a) {
    q = L.clamp(q); if (q <= 0) return;
    if (kind === "tick") {
      const pts = [[cx - 0.5 * r, cy + 0.02 * r], [cx - 0.14 * r, cy + 0.4 * r], [cx + 0.55 * r, cy - 0.42 * r]];
      gp(ctx, polyBuild(partial(pts, q)), col, width, 0.6, { alpha: a });
    } else if (kind === "cross") {
      const q1 = L.clamp(q * 2), q2 = L.clamp(q * 2 - 1), dd = 0.4 * r;
      gp(ctx, (c) => { c.moveTo(cx - dd, cy - dd); c.lineTo(cx - dd + 2 * dd * q1, cy - dd + 2 * dd * q1); if (q2 > 0) { c.moveTo(cx + dd, cy - dd); c.lineTo(cx + dd - 2 * dd * q2, cy - dd + 2 * dd * q2); } }, col, width, 0.6, { alpha: a });
    } else {
      const dd = 0.42 * r * q;
      fill(ctx, (c) => { c.moveTo(cx, cy - dd); c.lineTo(cx + dd, cy); c.lineTo(cx, cy + dd); c.lineTo(cx - dd, cy); c.closePath(); }, col, a);
    }
  }
  function drawMark(ctx, kind, cx, cy, r, col, pr, t, seed, m) {
    if (pr <= 0) return;
    if (pr >= 1 && m) {
      const S = Math.ceil(r * 5.6), key = "mark_" + kind + "_" + col + "_" + r.toFixed(2);
      const sp = getLayer(m, key, S, S, (c2) => drawMark(c2, kind, S / 2, S / 2, r, col, 1, Math.PI / 4.6, 0, null), true);
      if (sp) { blit(ctx, sp, cx - S / 2, cy - S / 2, 1); return; }
    }
    const pop = Math.max(0.01, L.easeOutBack(L.clamp(pr * 1.7)));
    const rr = r * pop, settled = L.clamp(pr * 1.3 - 0.3);
    glow(ctx, cx, cy, r * 2.5, col, (0.16 + 0.08 * Math.sin(t * 2.3 + seed * 1.7)) * settled + 0.55 * Math.sin(Math.PI * L.clamp(pr)));
    if (kind === "dot") {
      glyph(ctx, "dot", cx, cy, rr * 1.2, col, 1, 0, 1);
      gp(ctx, (c) => { const dd = rr * 0.78; c.moveTo(cx, cy - dd); c.lineTo(cx + dd, cy); c.lineTo(cx, cy + dd); c.lineTo(cx - dd, cy); c.closePath(); }, col, 1.2, 0.4, { alpha: 0.55 });
      return;
    }
    fill(ctx, (c) => c.arc(cx, cy, rr, 0, TAU), rgba(col, 0.14), 1);
    gp(ctx, (c) => c.arc(cx, cy, rr, -Math.PI / 2, -Math.PI / 2 + TAU * L.clamp(pr * 1.8)), col, 2, 0.5);
    glyph(ctx, kind, cx, cy, rr, col, L.clamp((pr - 0.25) / 0.6), Math.max(2.2, r * 0.17), 1);
  }

  /* ---------------- Icon-Rahmen ---------------- */
  function framePath(c, x, y, w, h, r, g0, g1) {
    c.moveTo(g1, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.lineTo(g0, y);
  }
  function drawFrame(ctx, bx, by, bw, bh, col, caption, t) {
    fill(ctx, (c) => L.roundRectPath(c, bx, by, bw, bh, 10), rgba(col, 0.045), 1);
    if (!VEC) stroke(ctx, (c) => {
      for (let gx = bx + 20; gx < bx + bw - 6; gx += 20) { c.moveTo(gx, by + 6); c.lineTo(gx, by + bh - 6); }
      for (let gy = by + 20; gy < by + bh - 6; gy += 20) { c.moveTo(bx + 6, gy); c.lineTo(bx + bw - 6, gy); }
    }, rgba(col, 0.055), 1, 1);
    const o = { font: FONT.mono, size: 13, weight: 700, letterSpacing: 2 };
    const cap = caption ? smartUpper(caption) : "";
    const cw = cap ? L.measure(ctx, cap, o) : 0;
    const g1 = bx + bw - 18, g0 = cap ? g1 - cw - 20 : g1;
    stroke(ctx, (c) => framePath(c, bx, by, bw, bh, 10, g0, g1), rgba(col, 0.34), 1.3, 1);
    if (cap) text(ctx, cap, g1 - 10, by + 5, Object.assign({ color: rgba(col, 0.92), align: "right" }, o));
    gp(ctx, (c) => {
      const q = 13;
      [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]].forEach((k) => { c.moveTo(k[0], k[1] + k[3] * q); c.lineTo(k[0], k[1]); c.lineTo(k[0] + k[2] * q, k[1]); });
    }, col, 1.8, 0.45, { alpha: 0.9 });
  }
  function scanLine(ctx, bx, by, bw, bh, col, t, phase) {
    const u = ((t * 0.2 + phase) % 1);
    const sy = by + 6 + u * (bh - 12);
    const a = Math.sin(Math.PI * u);
    fill(ctx, (c) => c.rect(bx + 3, sy - 10, bw - 6, 10), rgba(col, 0.035 * a), 1);
    stroke(ctx, (c) => { c.moveTo(bx + 4, sy); c.lineTo(bx + bw - 4, sy); }, rgba(col, 0.28), 1, a);
  }

  /* ---------------- Icons: statische Teile einmal gerendert (Ebene), bewegte Teile live ---------------- */
  function staticPart(ctx, m, key, x, y, w, h, paint) {
    const M = 24;
    const lay = m ? getLayer(m, key, w + 2 * M, h + 2 * M, (c2) => { c2.translate(M - x, M - y); paint(c2); }) : null;
    if (lay) blit(ctx, lay, x - M, y - M, 1); else paint(ctx);
  }
  function zigzag(c, x0, x1, yy, n, amp) {
    c.moveTo(x0, yy);
    for (let i = 1; i < n * 2; i++) c.lineTo(x0 + (x1 - x0) * i / (n * 2), yy + (i % 2 ? -amp : amp));
    c.lineTo(x1, yy);
  }

  /* ---- Fangvorrichtung (Sperrfang = Klemmrolle, Bremsfang = Keil + Federpaket) mit v-s-Diagramm ---- */
  const UE = 0.34, UB_I = 0.035, UB_P = 0.44;
  function gearState(tt, tm, prog) {
    const tE = tm.tE;
    if (tt <= tE) { const pos = 0.75 * tt + 0.125 * tt * tt / tE; return { u: UE * pos / (0.875 * tE), v: 0.75 + 0.25 * tt / tE, pos }; }
    const ts = prog ? tm.tsProg : tm.tsInst;
    const tau = Math.min(tt - tE, ts), b = tau - tau * tau / (2 * ts);
    return { u: UE + (prog ? UB_P : UB_I) * b / (ts / 2), v: Math.max(0, 1 - tau / ts), pos: 0.875 * tE + b };
  }
  function gearCurve(t, tm, prog) {
    const pts = [], N = 22, ta = Math.min(t, tm.tE);
    for (let i = 0; i <= N; i++) { const st = gearState(ta * i / N, tm, prog); pts.push([st.u, st.v]); }
    if (t > tm.tE) {
      const ts = prog ? tm.tsProg : tm.tsInst, tb = Math.min(t - tm.tE, ts);
      for (let i = 1; i <= N; i++) { const st = gearState(tm.tE + tb * i / N, tm, prog); pts.push([st.u, st.v]); }
    }
    return pts;
  }
  function gearGeo(bx, by, bw, bh, prog) {
    const s = bh / 196;
    const gx = bx + Math.min(bw * 0.2, 150 * s + 30), gy = by + bh * 0.52, gyC = gy - 8 * s;
    const railW = 14 * s, rf0 = gx + railW / 2, lf0 = gx - railW / 2;
    const kk = 0.22, r = 12 * s, ww = 16 * s, base = prog ? ww : 2 * r;
    const g = { s, gx, gy, gyC, railW, rf0, lf0, kk, r, ww, base, yA: by + 12 * s, yB: by + bh - 10 * s, hT: gyC - 46 * s, hB: gy + 56 * s, xO: rf0 + base + 36 * s, gap: 2 * s };
    g.xw = (yy) => rf0 + base + kk * (yy - gyC);
    g.cx0 = Math.max(g.xO + 70 * s, bx + bw * 0.45); g.cy0 = by + 32; g.cx1 = bx + bw - 30; g.cy1 = by + bh - 30;
    return g;
  }
  function gearStatic(c, g, col, prog) {
    const s = g.s;
    // Führungsschiene (Steg)
    fill(c, (q) => q.rect(g.lf0, g.yA, g.railW, g.yB - g.yA), rgba(C.steel, 0.13), 1);
    gp(c, (q) => { q.moveTo(g.lf0, g.yA); q.lineTo(g.lf0, g.yB); q.moveTo(g.rf0, g.yA); q.lineTo(g.rf0, g.yB); }, C.steel, 1.8, 0.5);
    // Gehäuse rechts mit schräger Keil-/Rollenbahn
    const poly = [[g.xw(g.hT), g.hT], [g.xO, g.hT], [g.xO, g.hB], [g.xw(g.hB), g.hB]];
    hatch(c, poly, rgba(col, 0.5), 7 * s, 1);
    gp(c, polyBuild(poly, true), col, 1.8, 0.5);
    stroke(c, (q) => { q.moveTo(g.rf0 + 3 * s, g.hT); q.lineTo(g.xw(g.hT), g.hT); q.moveTo(g.rf0 + 3 * s, g.hB); q.lineTo(g.xw(g.hB), g.hB); }, col, 1.6, 0.9);
    const jx = g.lf0 - g.gap;
    if (!prog) { // feste Gegenbacke
      const lp = [[jx - 30 * s, g.hT], [jx, g.hT], [jx, g.hB], [jx - 30 * s, g.hB]];
      hatch(c, lp, rgba(col, 0.5), 7 * s, 1);
      gp(c, polyBuild(lp, true), col, 1.8, 0.5);
      stroke(c, (q) => { q.moveTo(jx - 30 * s, g.hT); q.lineTo(g.rf0 + 3 * s, g.hT); }, rgba(col, 0.55), 1.2, 1, [5 * s, 4 * s]);
    } else { // Gehäusewand + Federpaket + Bremsbacke
      const wallX = g.lf0 - 60 * s, wp = [[wallX - 12 * s, g.hT], [wallX, g.hT], [wallX, g.hB], [wallX - 12 * s, g.hB]];
      hatch(c, wp, rgba(col, 0.5), 7 * s, 1);
      gp(c, polyBuild(wp, true), col, 1.8, 0.5);
      stroke(c, (q) => { q.moveTo(wallX, g.hT); q.lineTo(g.rf0 + 3 * s, g.hT); q.moveTo(wallX, g.hB); q.lineTo(g.rf0 + 3 * s, g.hB); }, rgba(col, 0.55), 1.2, 1, [5 * s, 4 * s]);
      const jw = 12 * s, jT = g.gyC - 32 * s, jB = g.gyC + 32 * s;
      fill(c, (q) => q.rect(jx - jw, jT, jw, jB - jT), rgba(col, 0.28), 1);
      gp(c, (q) => q.rect(jx - jw, jT, jw, jB - jT), col, 1.8, 0.5);
      gp(c, (q) => { zigzag(q, wallX, jx - jw, g.gyC - 16 * s, 6, 5 * s); zigzag(q, wallX, jx - jw, g.gyC + 16 * s, 6, 5 * s); }, col, 1.5, 0.4);
    }
    // Diagramm-Rahmen
    const x0 = g.cx0, y0 = g.cy0, x1 = g.cx1, y1 = g.cy1, ch = y1 - y0;
    stroke(c, (q) => { for (let i = 1; i <= 3; i++) { const yy = y1 - ch * 0.8 * i / 3; q.moveTo(x0, yy); q.lineTo(x1, yy); } }, rgba(C.steel, 0.16), 1, 1, [3, 5]);
    stroke(c, (q) => { q.moveTo(x0, y0 - 4); q.lineTo(x0, y1); q.lineTo(x1 + 4, y1); }, C.steel, 1.6, 0.85);
    fill(c, (q) => { q.moveTo(x0, y0 - 11); q.lineTo(x0 - 4.5, y0 - 2); q.lineTo(x0 + 4.5, y0 - 2); q.closePath(); q.moveTo(x1 + 11, y1); q.lineTo(x1 + 2, y1 - 4.5); q.lineTo(x1 + 2, y1 + 4.5); q.closePath(); }, C.steel, 0.85);
    const lo = { font: FONT.mono, size: 15, weight: 700, color: C.steel };
    text(c, "v", x0 - 10, y0 + 6, Object.assign({ align: "right" }, lo));
    text(c, "s", x1 + 8, y1 + 21, Object.assign({ align: "center" }, lo));
  }
  function gearDynamic(c, g, col, t, tm, prog, lbl) {
    const s = g.s, st = gearState(t, tm, prog), tE = tm.tE, ts = prog ? tm.tsProg : tm.tsInst;
    const lift = L.easeInOut(L.seg(t, tE - tm.liftD, tm.liftD));
    // Schienen-Markierungen laufen relativ zur Kabine (Kabine fährt abwärts)
    const sp = 15 * s, off = ((st.pos * 150 * s) % sp + sp) % sp;
    stroke(c, (q) => { for (let yy = g.yA + sp - off; yy < g.yB - 1; yy += sp) { q.moveTo(g.lf0 + 2.5 * s, yy); q.lineTo(g.rf0 - 2.5 * s, yy); } }, rgba(C.steel, 0.6), 1.3, 1);
    // Klemmrolle bzw. Keil – wird vom Auslösegestänge nach oben in den Spalt gezogen
    let cxr, cyr, topY;
    if (!prog) {
      const r = g.r, yr = g.gyC + 34 * s * (1 - lift);
      cxr = g.xw(yr) - r; cyr = yr; topY = yr - r;
      fill(c, (q) => q.arc(cxr, cyr, r, 0, TAU), rgba(col, 0.25), 1);
      gp(c, (q) => q.arc(cxr, cyr, r, 0, TAU), col, 2, 0.6);
      const ang = (34 * s * (1 - lift)) / r;
      stroke(c, (q) => { q.moveTo(cxr - Math.cos(ang) * r * 0.75, cyr - Math.sin(ang) * r * 0.75); q.lineTo(cxr + Math.cos(ang) * r * 0.75, cyr + Math.sin(ang) * r * 0.75); q.moveTo(cxr + 2.4 * s, cyr); q.arc(cxr, cyr, 2.4 * s, 0, TAU); }, col, 1.4, 0.9);
    } else {
      const yc = g.gyC + 34 * s * (1 - lift), hw = 22 * s, xl = g.xw(yc) - g.ww;
      const wp = [[xl, yc - hw], [g.xw(yc - hw), yc - hw], [g.xw(yc + hw), yc + hw], [xl, yc + hw]];
      fill(c, polyBuild(wp, true), rgba(col, 0.3), 1);
      gp(c, polyBuild(wp, true), col, 2, 0.6);
      cxr = (xl + g.xw(yc)) / 2; cyr = yc; topY = yc - hw;
    }
    const rodTop = g.hT - 16 * s;
    stroke(c, (q) => { q.moveTo(cxr, topY); q.lineTo(cxr, rodTop); q.lineTo(cxr + 20 * s, rodTop); }, C.steel, 1.6, 0.9);
    if (lift > 0.02 && lift < 0.98) { const ay = rodTop + 8 * s; fill(c, (q) => { q.moveTo(cxr + 7 * s, ay - 7 * s); q.lineTo(cxr + 3 * s, ay); q.lineTo(cxr + 11 * s, ay); q.closePath(); }, C.amber, 0.9); }
    // Kontakt: Blitz (Sperrfang) bzw. Reibglut + Funken (Bremsfang)
    if (t >= tE) {
      const dt = t - tE, cx0 = g.rf0, cy0 = cyr;
      if (!prog) {
        const fl = Math.exp(-dt * 5);
        glow(c, cx0, cy0, 44 * s, "#ffffff", 0.7 * fl);
        glow(c, cx0, cy0, 26 * s, col, 0.55 * fl + 0.3 + 0.12 * Math.sin(t * 3));
        if (fl > 0.05) stroke(c, (q) => { for (let i = 0; i < 6; i++) { const a = -0.3 + i * 0.5 + Math.PI * 0.5 * (i % 2), r0 = 12 * s, r1 = r0 + 24 * s * (1 - fl) + 6 * s; q.moveTo(cx0 + Math.cos(a) * r0, cy0 + Math.sin(a) * r0); q.lineTo(cx0 + Math.cos(a) * r1, cy0 + Math.sin(a) * r1); } }, "#ffe3a8", 2, fl);
      } else {
        const sl = dt < ts ? 1 - dt / ts : 0;
        glow(c, cx0, cy0, 30 * s, C.amber, 0.22 + 0.6 * sl + 0.08 * Math.sin(t * 3));
        if (sl > 0 && GA > 0.6) L.sparks(c, cx0, cy0, dt % 0.5, { seed: 7 + Math.floor(dt / 0.5), count: 8, life: 0.35, window: 0.45, dir: -Math.PI / 2, spread: 1.2, speed: 170 * s, gravity: 500 });
      }
    }
    // Bewegungspfeil der Kabine
    if (st.v > 0.02) {
      const ax = g.xO + 24 * s, aa = L.clamp(st.v * 1.1);
      L.arrow(c, ax, g.gy - 30 * s, ax, g.gy + 28 * s, col, 2.5, 12, al(aa));
      text(c, "v", ax + 9, g.gy - 4 * s, { font: FONT.mono, size: 15, weight: 700, color: col, alpha: aa });
    }
    // v-s-Kurve
    const x0 = g.cx0, y0 = g.cy0, x1 = g.cx1, y1 = g.cy1, cw = x1 - x0, ch = y1 - y0;
    const X = (u) => x0 + u * cw, Y = (v) => y1 - v * ch * 0.8;
    const pts = gearCurve(t, tm, prog).map((q) => [X(q[0]), Y(q[1])]), last = pts[pts.length - 1];
    fill(c, (q) => { polyBuild(pts)(q); q.lineTo(last[0], y1); q.lineTo(pts[0][0], y1); q.closePath(); }, rgba(col, 0.09), 1);
    gp(c, polyBuild(pts), col, 2.6, 0.9);
    glow(c, last[0], last[1], 16, col, 0.7 + 0.2 * Math.sin(t * 4));
    fill(c, (q) => q.arc(last[0], last[1], 3.4, 0, TAU), "#ffffff", 1);
    if (t >= tE) stroke(c, (q) => { q.moveTo(X(UE), y1); q.lineTo(X(UE), Y(1) - 8); }, rgba(col, 0.55), 1, L.seg(t, tE, 0.3), [3, 4]);
    const done = L.seg(t, tE + ts + 0.08, 0.5);
    if (done > 0) {
      const xa = X(UE), xb = X(UE + (prog ? UB_P : UB_I)), yy = y1 + 7;
      stroke(c, (q) => { q.moveTo(xa, yy - 4); q.lineTo(xa, yy); q.lineTo(xb, yy); q.lineTo(xb, yy - 4); }, col, 1.5, done);
      text(c, "Fangweg", Math.max(x0 + 34, (xa + xb) / 2), yy + 16, { font: FONT.mono, size: 13, weight: 700, color: col, align: "center", alpha: done });
      const lab = lbl == null ? (prog ? "Stopp gleitend" : "Stopp schlagartig") : lbl;
      if (lab) text(c, lab, x1, y0 + 8, { font: FONT.mono, size: 14, weight: 700, color: "rgba(226,240,255,0.95)", align: "right", alpha: done });
    }
  }
  function drawGear(ctx, m, key, bx, by, bw, bh, col, t, tm, prog, lbl) {
    const g = gearGeo(bx, by, bw, bh, prog);
    staticPart(ctx, m, key, bx, by, bw, bh, (c) => gearStatic(c, g, col, prog));
    gearDynamic(ctx, g, col, t, tm, prog, lbl);
  }

  /* ---- Frühe offene Plattform (um 1850): Holzführungen, ein Seil, Umlenkrolle, Winde ---- */
  function drawPlatform(ctx, m, key, bx, by, bw, bh, col, t) {
    const s = bh / 196;
    const px = bx + Math.min(bw * 0.3, 240 * s + 40);
    const top = by + 16 * s, bot = by + bh - 8 * s, gw = 12 * s, gL = px - 104 * s, gR = px + 104 * s, hbY = top - 4 * s;
    const pr = 11 * s, pcx = px + pr, pcy = hbY + 10 * s + pr + 4 * s;
    const dX = bx + Math.min(bw * 0.78, px - bx + 330 * s), dY = by + bh * 0.6, dR = 30 * s;
    staticPart(ctx, m, key, bx, by, bw, bh, (c) => {
      [gL, gR].forEach((g) => {
        fill(c, (q) => q.rect(g - gw / 2, top, gw, bot - top), rgba(col, 0.1), 1);
        stroke(c, (q) => q.rect(g - gw / 2, top, gw, bot - top), col, 1.5, 0.85);
        stroke(c, (q) => { for (let k = 0; k < 2; k++) { const xx = g - gw / 2 + gw * (0.33 + 0.34 * k); for (let yy = top + 8 * s + k * 9 * s; yy < bot - 10 * s; yy += 18 * s) { q.moveTo(xx, yy); q.lineTo(xx, yy + 9 * s); } } }, rgba(col, 0.4), 1, 1);
      });
      fill(c, (q) => q.rect(gL - 16 * s, hbY, gR - gL + 32 * s, 10 * s), rgba(col, 0.16), 1);
      gp(c, (q) => q.rect(gL - 16 * s, hbY, gR - gL + 32 * s, 10 * s), col, 1.5, 0.4);
      stroke(c, (q) => { q.moveTo(pcx - 7 * s, hbY + 10 * s); q.lineTo(pcx, pcy); q.lineTo(pcx + 7 * s, hbY + 10 * s); }, C.steel, 1.4, 0.8);
      gp(c, (q) => q.arc(pcx, pcy, pr, 0, TAU), col, 1.6, 0.5);
      fill(c, (q) => q.arc(pcx, pcy, 2.5 * s, 0, TAU), col, 1);
      stroke(c, (q) => { q.moveTo(dX - dR * 0.5, dY + dR * 0.87); q.lineTo(dX - 38 * s, bot); q.moveTo(dX + dR * 0.5, dY + dR * 0.87); q.lineTo(dX + 38 * s, bot); q.moveTo(dX - 52 * s, bot); q.lineTo(dX + 52 * s, bot); }, col, 1.6, 0.85);
      fill(c, (q) => q.arc(dX, dY, dR, 0, TAU), rgba(col, 0.1), 1);
      gp(c, (q) => q.arc(dX, dY, dR, 0, TAU), col, 2, 0.6);
      stroke(c, (q) => { for (let i = 0; i < 3; i++) { q.moveTo(dX + dR * (0.58 + i * 0.1), dY); q.arc(dX, dY, dR * (0.58 + i * 0.1), 0, TAU); } }, rgba(col, 0.45), 1, 1);
    });
    const bob = Math.sin(t * 0.9) * 6 * s, ang = bob / dR;
    const yF = by + bh * 0.84 + bob, yC = yF - 96 * s, pw = 84 * s;
    fill(ctx, (q) => q.rect(px - pw - 4 * s, yF, 2 * pw + 8 * s, 7 * s), rgba(col, 0.3), 1);
    gp(ctx, (q) => {
      q.rect(px - pw - 4 * s, yF, 2 * pw + 8 * s, 7 * s);
      q.moveTo(px - pw, yF); q.lineTo(px - pw, yC); q.moveTo(px + pw, yF); q.lineTo(px + pw, yC);
      q.moveTo(px - pw - 4 * s, yC); q.lineTo(px + pw + 4 * s, yC);
      q.moveTo(px - pw, yC + 22 * s); q.lineTo(px - 22 * s, yC); q.moveTo(px + pw, yC + 22 * s); q.lineTo(px + 22 * s, yC);
    }, col, 1.5, 0.4);
    stroke(ctx, (q) => { q.moveTo(px - pw, yF - 34 * s); q.lineTo(px + pw, yF - 34 * s); }, rgba(col, 0.6), 1.2, 1, [6 * s, 4 * s]);
    fill(ctx, (q) => { q.rect(px - 98 * s, yC - 3 * s, 14 * s, 7 * s); q.rect(px + 84 * s, yC - 3 * s, 14 * s, 7 * s); q.rect(px - 98 * s, yF - 6 * s, 14 * s, 7 * s); q.rect(px + 84 * s, yF - 6 * s, 14 * s, 7 * s); }, C.steel, 0.7);
    L.person(ctx, px - 42 * s, yF, 70 * s, C.steel, al(0.55));
    stroke(ctx, (q) => { const x = px + 18 * s, y = yF - 28 * s, w = 34 * s, h = 28 * s; q.rect(x, y, w, h); q.moveTo(x, y); q.lineTo(x + w, y + h); q.moveTo(x + w, y); q.lineTo(x, y + h); }, col, 1.3, 0.8);
    // Seil über Umlenkrolle zur Trommel (Tangentenpunkte)
    let dx = dX - pcx, dy = (dY - dR) - pcy; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const phi = Math.atan2(-dx, dy);
    const rope = (q) => { q.moveTo(px, yC); q.lineTo(px, pcy); q.arc(pcx, pcy, pr, Math.PI, phi + TAU); q.lineTo(dX + dR * Math.cos(phi), dY + dR * Math.sin(phi)); };
    gp(ctx, rope, col, 2.8 * Math.max(0.7, s), 0.8);
    stroke(ctx, rope, "rgba(255,255,255,0.45)", 1.2, 1, [2.5 * s, 3.5 * s], -bob);
    stroke(ctx, (q) => { for (let i = 0; i < 6; i++) { const a = ang + i * TAU / 6; q.moveTo(dX + Math.cos(a) * dR * 0.14, dY + Math.sin(a) * dR * 0.14); q.lineTo(dX + Math.cos(a) * dR * 0.52, dY + Math.sin(a) * dR * 0.52); } }, col, 1.4, 0.9);
    const ca = ang + 0.6, kx = dX + Math.cos(ca) * dR * 1.35, ky = dY + Math.sin(ca) * dR * 1.35;
    stroke(ctx, (q) => { q.moveTo(dX, dY); q.lineTo(kx, ky); }, C.steel, 2.2, 0.9);
    fill(ctx, (q) => { q.arc(kx, ky, 3.5 * s, 0, TAU); q.moveTo(dX + 3.5 * s, dY); q.arc(dX, dY, 3.5 * s, 0, TAU); }, C.steel, 0.9);
  }

  /* ---- Moderner Treibscheibenaufzug (1:1): Treibscheibe, Tragseile, Kabine, Gegengewicht, Begrenzer ---- */
  function drawModernCar(ctx, m, key, bx, by, bw, bh, col, t) {
    const s = bh / 196;
    const cx = bx + Math.min(bw * 0.27, 200 * s + 30);
    const R = 30 * s, sx = cx + R, sy = by + 42 * s;
    const carW = 66 * s, carH = 78 * s, cwW = 22 * s, cwH = 56 * s, cwX = sx + R, railX = 39 * s;
    const carTop0 = by + 88 * s, cwTop0 = by + 100 * s;
    const gvx = cx - 64 * s, gvy = by + 24 * s, gvr = 8 * s, tvy = by + bh - 14 * s;
    const mx = cwX + 38 * s, my = sy - 4 * s;
    const lx = Math.max(mx + 60 * s, bx + bw * 0.58), showLabels = lx + 150 < bx + bw;
    const use = bh >= 150 ? [0, 1, 2, 3] : bh >= 120 ? [0, 2, 3] : [0, 3];
    const labelY = (j) => by + 34 + j * (bh - 56) / Math.max(1, use.length - 1);
    staticPart(ctx, m, key, bx, by, bw, bh, (c) => {
      stroke(c, (q) => { q.moveTo(cx - railX, by + 60 * s); q.lineTo(cx - railX, by + bh - 6 * s); q.moveTo(cx + railX, by + 60 * s); q.lineTo(cx + railX, by + bh - 6 * s); }, C.steel, 2, 0.8);
      gp(c, (q) => { q.moveTo(gvx + gvr, gvy); q.arc(gvx, gvy, gvr, 0, TAU); q.moveTo(gvx + gvr, tvy); q.arc(gvx, tvy, gvr, 0, TAU); }, C.steel, 1.5, 0.4);
      gp(c, (q) => q.arc(sx, sy, R, Math.PI, TAU), col, 2.2, 0.6);
      stroke(c, (q) => { q.moveTo(sx, sy); q.lineTo(mx - 12 * s, my); }, rgba(C.steel, 0.7), 1.4, 1, [4, 4]);
      gp(c, (q) => q.arc(mx, my, 12 * s, 0, TAU), C.steel, 1.5, 0.4);
      text(c, "M", mx, my + 5 * s, { font: FONT.mono, size: Math.max(10, 14 * s), weight: 700, color: C.steel, align: "center" });
      fill(c, (q) => q.arc(sx, sy, R - 2 * s, 0, TAU), rgba(col, 0.08), 1);
      gp(c, (q) => q.arc(sx, sy, R - 2 * s, 0, TAU), col, 2, 0.7);
      stroke(c, (q) => { q.moveTo(sx + R * 0.7, sy); q.arc(sx, sy, R * 0.7, 0, TAU); }, rgba(col, 0.75), 1.3, 1);
      if (showLabels) use.forEach((ri, j) => {
        if (ri === 0) label(c, "Treibscheibe", lx, labelY(j), sx + R * 0.7, sy - R * 0.7, col, 1);
        if (ri === 1) label(c, "Tragseile", lx, labelY(j), cwX, (sy + cwTop0 - 9 * s) / 2 + 4 * s, col, 1);
      });
    });
    const bob = Math.sin(t * 0.75) * 9 * s, ang = -bob / R + 0.3;
    const carTop = carTop0 + bob, cwTop = cwTop0 - bob, cb = carTop + carH, sgY = cb + 1 * s;
    // Begrenzerseil läuft mit der Kabine
    stroke(ctx, (q) => { q.moveTo(gvx - gvr, gvy); q.lineTo(gvx - gvr, tvy); }, rgba(C.steel, 0.9), 1.2, 1, [5 * s, 4 * s], bob);
    stroke(ctx, (q) => { q.moveTo(gvx + gvr, gvy); q.lineTo(gvx + gvr, tvy); const a = -bob / gvr; q.moveTo(gvx, gvy); q.lineTo(gvx + Math.cos(a) * gvr, gvy + Math.sin(a) * gvr); }, rgba(C.steel, 0.9), 1.2, 1, [5 * s, 4 * s], -bob);
    // Tragseile
    stroke(ctx, (q) => { for (let k = -1; k <= 1; k++) { const o = k * 2.6 * s; q.moveTo(cx + o, carTop - 12 * s); q.lineTo(cx + o, sy); q.moveTo(cwX + o, cwTop); q.lineTo(cwX + o, sy); } }, col, 1.2, 0.9);
    stroke(ctx, (q) => { for (let i = 0; i < 5; i++) { const a = ang + i * TAU / 5; q.moveTo(sx + Math.cos(a) * R * 0.18, sy + Math.sin(a) * R * 0.18); q.lineTo(sx + Math.cos(a) * R * 0.68, sy + Math.sin(a) * R * 0.68); } }, rgba(col, 0.75), 1.3, 1);
    fill(ctx, (q) => q.arc(sx, sy, R * 0.16, 0, TAU), col, 1);
    // Kabine mit Fangrahmen
    stroke(ctx, (q) => { q.moveTo(cx - railX, carTop - 12 * s); q.lineTo(cx + railX, carTop - 12 * s); q.moveTo(cx - carW / 2 - 3 * s, carTop - 12 * s); q.lineTo(cx - carW / 2 - 3 * s, cb + 6 * s); q.moveTo(cx + carW / 2 + 3 * s, carTop - 12 * s); q.lineTo(cx + carW / 2 + 3 * s, cb + 6 * s); q.moveTo(cx - railX, cb + 6 * s); q.lineTo(cx + railX, cb + 6 * s); }, C.steel, 2, 0.9);
    fill(ctx, (q) => q.rect(cx - carW / 2, carTop, carW, carH), rgba(col, 0.1), 1);
    gp(ctx, (q) => q.rect(cx - carW / 2, carTop, carW, carH), col, 2, 0.6);
    stroke(ctx, (q) => { q.moveTo(cx, carTop + 14 * s); q.lineTo(cx, cb - 3 * s); q.rect(cx - carW / 2 + 5 * s, carTop + 14 * s, carW - 10 * s, carH - 17 * s); }, rgba(col, 0.5), 1, 1);
    fill(ctx, (q) => q.rect(cx - 9 * s, carTop + 5 * s, 18 * s, 5 * s), col, 0.7);
    L.person(ctx, cx + 16 * s, cb - 3 * s, carH * 0.62, C.steel, al(0.32));
    fill(ctx, (q) => { q.rect(cx - railX - 3 * s, carTop - 17 * s, 6 * s, 9 * s); q.rect(cx + railX - 3 * s, carTop - 17 * s, 6 * s, 9 * s); }, C.steel, 0.9);
    fill(ctx, (q) => { q.rect(cx - railX - 6 * s, sgY, 12 * s, 11 * s); q.rect(cx + railX - 6 * s, sgY, 12 * s, 11 * s); }, rgba(C.amber, 0.6), 1);
    stroke(ctx, (q) => { q.rect(cx - railX - 6 * s, sgY, 12 * s, 11 * s); q.rect(cx + railX - 6 * s, sgY, 12 * s, 11 * s); q.moveTo(gvx + gvr, sgY + 5 * s); q.lineTo(cx - railX - 6 * s, sgY + 5 * s); }, C.amber, 1.3, 1);
    // Gegengewicht (bewegt sich gegenläufig)
    fill(ctx, (q) => q.rect(cwX - cwW / 2, cwTop, cwW, cwH), rgba(col, 0.12), 1);
    gp(ctx, (q) => q.rect(cwX - cwW / 2, cwTop, cwW, cwH), col, 1.8, 0.5);
    stroke(ctx, (q) => { for (let yy = cwTop + 9 * s; yy < cwTop + cwH - 4 * s; yy += 9 * s) { q.moveTo(cwX - cwW / 2 + 3 * s, yy); q.lineTo(cwX + cwW / 2 - 3 * s, yy); } }, rgba(col, 0.5), 1, 1);
    if (showLabels) use.forEach((ri, j) => {
      if (ri === 2) label(ctx, "Gegengewicht", lx, labelY(j), cwX + cwW / 2, cwTop + cwH * 0.55, col, 1);
      if (ri === 3) label(ctx, "Fangvorrichtung", lx, labelY(j), cx + railX + 6 * s, sgY + 6 * s, col, 1);
    });
  }

  /* ---- Stahlseil: Querschnitt (8 Litzen à 1+6 Drähte um Einlage) + laufende Seitenansicht ---- */
  function drawRope(ctx, m, key, bx, by, bw, bh, col, t) {
    const s = bh / 196;
    const R = 72 * s, cx = bx + 26 + R, cy = by + bh * 0.53;
    const n = 8, sn = Math.sin(Math.PI / n), rs = R * sn / (1 + sn), rc = R - 2 * rs, rw = rs / 3, rot = -Math.PI / 8;
    const cs = []; for (let i = 0; i < n; i++) { const a = rot + i * TAU / n; cs.push([cx + Math.cos(a) * (R - rs), cy + Math.sin(a) * (R - rs), a]); }
    const x0 = Math.max(bx + bw * 0.5, cx + R + 150), x1 = bx + bw - 26, hh = 26 * s, yc = cy, side = x1 - x0 > 60;
    const ay = yc + hh + 22, arrow = side && ay < by + bh - 8;
    staticPart(ctx, m, key, bx, by, bw, bh, (c) => {
      fill(c, (q) => q.arc(cx, cy, rc - 1.5 * s, 0, TAU), rgba(col, 0.1), 1);
      stroke(c, (q) => { for (let i = 0; i < 11; i++) { const a = i * 2.4, rr = (rc - 6 * s) * Math.sqrt((i + 0.5) / 11), x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; q.moveTo(x + 2 * s, y); q.arc(x, y, 2 * s, 0, TAU); } }, rgba(col, 0.5), 1, 1);
      gp(c, (q) => q.arc(cx, cy, rc - 1.5 * s, 0, TAU), col, 1.4, 0.4, { alpha: 0.8 });
      fill(c, (q) => cs.forEach((p2) => { q.moveTo(p2[0] + rs, p2[1]); q.arc(p2[0], p2[1], rs, 0, TAU); }), rgba(col, 0.12), 1);
      gp(c, (q) => cs.forEach((p2) => { q.moveTo(p2[0] + rs, p2[1]); q.arc(p2[0], p2[1], rs, 0, TAU); }), col, 1.6, 0.45);
      stroke(c, (q) => cs.forEach((p2) => {
        q.moveTo(p2[0] + rw * 0.88, p2[1]); q.arc(p2[0], p2[1], rw * 0.88, 0, TAU);
        for (let j = 0; j < 6; j++) { const b = p2[2] + j * TAU / 6, wx = p2[0] + Math.cos(b) * 2 * rw, wy = p2[1] + Math.sin(b) * 2 * rw; q.moveTo(wx + rw * 0.88, wy); q.arc(wx, wy, rw * 0.88, 0, TAU); }
      }), rgba(col, 0.8), 1, 1);
      const lx = cx + R + 34, st = cs[7], wa = cs[0];
      label(c, "Litze", lx, cy - 40 * s, st[0] + rs * 0.2, st[1], col, 1);
      label(c, "Draht", lx, cy + 6 * s, wa[0] + Math.cos(wa[2]) * 2 * rw, wa[1] + Math.sin(wa[2]) * 2 * rw, col, 1);
      label(c, "Einlage", lx, cy + 52 * s, cx + rc * 0.35, cy + rc * 0.3, col, 1);
      if (side) fill(c, (q) => q.rect(x0, yc - hh, x1 - x0, 2 * hh), rgba(col, 0.09), 1);
      if (arrow) text(c, "Laufrichtung →", x1 - 20, ay + 12, { font: FONT.mono, size: 13, weight: 700, color: rgba(col, 0.9), align: "right" });
    });
    stroke(ctx, (q) => q.arc(cx, cy, R + 4 * s, 0, TAU), rgba(col, 0.35), 1, 1, [4, 5], -t * 8);
    if (side) {
      ctx.save(); ctx.beginPath(); ctx.rect(x0, yc - hh, x1 - x0, 2 * hh); ctx.clip();
      const pitch = 17 * s, off = (t * 34 * s) % (2 * pitch), xs = x0 - 2 * hh + off - 2 * pitch;
      const strand = (q, xx) => { q.moveTo(xx, yc + hh); q.quadraticCurveTo(xx + hh * 0.3, yc, xx + hh * 0.95, yc - hh); q.lineTo(xx + hh * 0.95 + pitch, yc - hh); q.quadraticCurveTo(xx + hh * 0.3 + pitch, yc, xx + pitch, yc + hh); q.closePath(); };
      fill(ctx, (q) => { for (let xx = xs; xx < x1 + pitch; xx += 2 * pitch) strand(q, xx); }, rgba(col, 0.22), 1);
      stroke(ctx, (q) => { for (let xx = xs; xx < x1 + pitch; xx += pitch) { q.moveTo(xx, yc + hh); q.quadraticCurveTo(xx + hh * 0.3, yc, xx + hh * 0.95, yc - hh); } }, rgba(col, 0.85), 1.5, 1);
      stroke(ctx, (q) => { q.moveTo(x0, yc - hh * 0.45); q.lineTo(x1, yc - hh * 0.45); }, "rgba(255,255,255,0.1)", 4 * s, 1);
      ctx.restore();
      gp(ctx, (q) => { q.moveTo(x0, yc - hh); q.lineTo(x1, yc - hh); q.moveTo(x0, yc + hh); q.lineTo(x1, yc + hh); }, col, 1.8, 0.6);
      stroke(ctx, (q) => { q.ellipse(x0, yc, 6 * s, hh, 0, 0, TAU); q.moveTo(x1 + 6 * s, yc); q.ellipse(x1, yc, 6 * s, hh, 0, 0, TAU); }, col, 1.4, 0.9);
      if (arrow) stroke(ctx, (q) => { q.moveTo(x0 + 20, ay - 6); q.lineTo(x1 - 20, ay - 6); }, rgba(col, 0.5), 1, 1, [4, 4], -t * 20);
    }
  }

  /* ---- Beschichteter Tragriemen: Querschnitt (Stahlcorde im PU-Mantel) + Lauf über kleine Treibscheibe ---- */
  function drawBelt(ctx, m, key, bx, by, bw, bh, col, t) {
    const s = bh / 196;
    const bwid = 200 * s, bth = 34 * s, cx = bx + 30 + bwid / 2, cy = by + bh * 0.5, x0 = cx - bwid / 2, y0 = cy - bth / 2;
    const n = 10, cr = 6.2 * s, cords = [];
    for (let i = 0; i < n; i++) cords.push([x0 + 17 * s + i * (bwid - 34 * s) / (n - 1), cy]);
    const R = 46 * s, th = 7 * s, sx = bx + bw - 34 - R - th, sy = cy, lx0 = Math.max(x0 + bwid + 90, bx + bw * 0.46), run = sx - lx0 > 40;
    const path = (q, rr) => { q.moveTo(lx0, sy - rr); q.lineTo(sx, sy - rr); q.arc(sx, sy, rr, -Math.PI / 2, Math.PI / 2); q.lineTo(lx0, sy + rr); };
    staticPart(ctx, m, key, bx, by, bw, bh, (c) => {
      fill(c, (q) => L.roundRectPath(q, x0, y0, bwid, bth, 12 * s), rgba(col, 0.15), 1);
      gp(c, (q) => L.roundRectPath(q, x0, y0, bwid, bth, 12 * s), col, 1.8, 0.6);
      fill(c, (q) => cords.forEach((p2) => { q.moveTo(p2[0] + cr, p2[1]); q.arc(p2[0], p2[1], cr, 0, TAU); }), rgba(C.steel, 0.22), 1);
      gp(c, (q) => cords.forEach((p2) => { q.moveTo(p2[0] + cr, p2[1]); q.arc(p2[0], p2[1], cr, 0, TAU); }), C.steel, 1.3, 0.35);
      fill(c, (q) => cords.forEach((p2) => { for (let j = 0; j < 3; j++) { const a = j * TAU / 3 - Math.PI / 2, x = p2[0] + Math.cos(a) * cr * 0.45, y = p2[1] + Math.sin(a) * cr * 0.45; q.moveTo(x + 1.5 * s, y); q.arc(x, y, 1.5 * s, 0, TAU); } }), C.steel, 0.9);
      label(c, "Stahlcord", x0 + 6, y0 - 34 * s, cords[1][0], cords[1][1] - cr, col, 1);
      label(c, "PU-Mantel", x0 + bwid * 0.5, y0 + bth + 44 * s, x0 + bwid * 0.8, y0 + bth, col, 1);
      if (run) {
        fill(c, (q) => q.arc(sx, sy, R - 1, 0, TAU), rgba(col, 0.07), 1);
        stroke(c, (q) => { q.moveTo(sx + R * 0.82, sy); q.arc(sx, sy, R * 0.82, 0, TAU); }, rgba(col, 0.7), 1.3, 1);
        const g = c.createLinearGradient(lx0, 0, lx0 + 80 * s, 0); g.addColorStop(0, rgba(col, 0)); g.addColorStop(1, col);
        const g2 = c.createLinearGradient(lx0, 0, lx0 + 80 * s, 0); g2.addColorStop(0, rgba(col, 0)); g2.addColorStop(1, rgba(col, 0.14));
        stroke(c, (q) => path(q, R + th / 2), g2, th, 1);
        gp(c, (q) => path(q, R), g, 1.5, 0.4);
        gp(c, (q) => path(q, R + th), g, 1.8, 0.6);
        label(c, "kleine Treibscheibe", sx - R - 22, sy + 5, sx - R * 0.72, sy + R * 0.3, col, 1, true);
      }
    });
    if (run) {
      const ang = t * 1.3;
      stroke(ctx, (q) => { for (let i = 0; i < 5; i++) { const a = ang + i * TAU / 5; q.moveTo(sx + Math.cos(a) * R * 0.2, sy + Math.sin(a) * R * 0.2); q.lineTo(sx + Math.cos(a) * R * 0.8, sy + Math.sin(a) * R * 0.8); } }, rgba(col, 0.7), 1.3, 1);
      fill(ctx, (q) => q.arc(sx, sy, R * 0.16, 0, TAU), col, 1);
      const lxd = lx0 + 60 * s, pathD = (q, rr) => { q.moveTo(lxd, sy - rr); q.lineTo(sx, sy - rr); q.arc(sx, sy, rr, -Math.PI / 2, Math.PI / 2); q.lineTo(lxd, sy + rr); };
      stroke(ctx, (q) => pathD(q, R + th / 2), "rgba(159,196,230,0.85)", 1.6 * Math.max(0.8, s), 1, [10 * s, 8 * s], -t * 1.3 * (R + th / 2));
    }
  }

  /* ---------------- Analogie-Paare: gemeinsame Phase ---------------- */
  const W0 = 0.9, W1 = 3.3; // rad/s vor bzw. nach dem Hochdrehen
  function spinState(t, pt) {
    const R = pt.rampD, x = (t - pt.tAct) / R;
    let ang, w;
    if (x <= 0) { ang = W0 * t; w = W0; }
    else if (x < 1) { ang = W0 * t + (W1 - W0) * R * (x * x * x - x * x * x * x / 2); w = W0 + (W1 - W0) * x * x * (3 - 2 * x); }
    else { ang = W0 * t + (W1 - W0) * (R * 0.5 + (t - pt.tAct - R)); w = W1; }
    return { ang, w, sw: (w - W0) / (W1 - W0) };
  }
  function pressState(t, pt) {
    const f = (x) => L.smooth(1 - Math.pow(1 - L.clamp(x), 1.6));
    const x = (t - pt.tAct) / pt.pressD, e = f(x);
    const v = x > 0 && x < 1 ? (f(x + 0.02) - e) / 0.02 : 0;
    return { x: L.clamp(x), e, v, vol: 1 - 0.56 * e };
  }
  function gauge(ctx, x, y, w, lbl, q, col, a) {
    text(ctx, lbl, x, y - 9, { font: FONT.mono, size: 13, weight: 700, letterSpacing: 2, color: rgba(col, 0.9), alpha: a });
    stroke(ctx, (c) => c.rect(x, y, w, 9), rgba(col, 0.55), 1, a);
    stroke(ctx, (c) => { for (let i = 1; i < 5; i++) { c.moveTo(x + w * i / 5, y + 9); c.lineTo(x + w * i / 5, y + 13); } }, rgba(col, 0.4), 1, a);
    const fw = Math.max(0, (w - 4) * L.clamp(q));
    fill(ctx, (c) => c.rect(x + 2, y + 2, fw, 5), col, a);
    glow(ctx, x + 2 + fw, y + 4.5, 14, col, 0.6 * a);
  }
  function legend(ctx, x, y, lbl, colDot, a) {
    fill(ctx, (c) => c.arc(x + 5, y - 5, 5, 0, TAU), colDot, a);
    glow(ctx, x + 5, y - 5, 13, colDot, 0.5 * a);
    text(ctx, lbl, x + 18, y, { font: FONT.mono, size: 15, weight: 700, color: "rgba(226,240,255,0.95)", alpha: a });
  }
  const MASS = "#eef6ff";
  /* Drehzahl-Anzeige (Rundinstrument) – identisch in beiden Panels, zeigt die Synchronität */
  function dial(ctx, m, key, cx, cy, r, q, col, lbl) {
    const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2, A = (f) => a0 + (a1 - a0) * f;
    staticPart(ctx, m, key, cx - r - 20, cy - r - 20, 2 * r + 40, 2 * r + 60, (c) => {
      fill(c, (qq) => qq.arc(cx, cy, r, 0, TAU), "rgba(5,13,28,0.6)", 1);
      stroke(c, (qq) => qq.arc(cx, cy, r, a0, a1), rgba(col, 0.5), 1.4, 1);
      stroke(c, (qq) => { for (let i = 0; i <= 20; i++) { const a = A(i / 20), big = i % 5 === 0, r0 = r - (big ? 12 : 7); qq.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); qq.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2)); } }, rgba(col, 0.75), 1.3, 1);
      text(c, lbl, cx, cy + r * 0.62, { font: FONT.mono, size: 13, weight: 700, letterSpacing: 2, color: rgba(col, 0.9), align: "center" });
    });
    const an = A(L.clamp(q));
    gp(ctx, (qq) => qq.arc(cx, cy, r - 4, a0, an), col, 3, 1);
    gp(ctx, (qq) => { qq.moveTo(cx - Math.cos(an) * 8, cy - Math.sin(an) * 8); qq.lineTo(cx + Math.cos(an) * (r - 16), cy + Math.sin(an) * (r - 16)); }, MASS, 2.2, 0.8);
    fill(ctx, (qq) => qq.arc(cx, cy, 5, 0, TAU), col, 1);
    glow(ctx, cx + Math.cos(an) * (r - 4), cy + Math.sin(an) * (r - 4), 16, col, 0.7);
  }
  /* p-V-Diagramm: Verdichtung der eingeschlossenen Luft (identisch in beiden Panels) */
  function pvDiagram(ctx, m, key, x0, y0, x1, y1, st, col) {
    const V = (v) => x0 + (x1 - x0) * (v - 0.3) / 0.8, Pp = (p) => y1 - (y1 - y0) * (p - 0.6) / 2.8;
    const curve = (vA, vB) => { const pts = []; for (let i = 0; i <= 24; i++) { const v = L.lerp(vA, vB, i / 24); pts.push([V(v), Pp(Math.pow(v, -1.4))]); } return pts; };
    staticPart(ctx, m, key, x0 - 30, y0 - 20, x1 - x0 + 60, y1 - y0 + 50, (c) => {
      stroke(c, (q) => { q.moveTo(x0, y0 - 6); q.lineTo(x0, y1); q.lineTo(x1 + 6, y1); }, C.steel, 1.5, 0.9);
      fill(c, (q) => { q.moveTo(x0, y0 - 13); q.lineTo(x0 - 4.5, y0 - 4); q.lineTo(x0 + 4.5, y0 - 4); q.closePath(); q.moveTo(x1 + 13, y1); q.lineTo(x1 + 4, y1 - 4.5); q.lineTo(x1 + 4, y1 + 4.5); q.closePath(); }, C.steel, 0.9);
      const lo = { font: FONT.mono, size: 15, weight: 700, color: C.steel };
      text(c, "p", x0 - 10, y0 + 6, Object.assign({ align: "right" }, lo));
      text(c, "V", x1 + 8, y1 + 21, Object.assign({ align: "center" }, lo));
      stroke(c, polyBuild(curve(1, 0.44)), rgba(col, 0.35), 1.2, 1, [4, 4]);
    });
    const v = st.vol, pts = curve(1, v), last = pts[pts.length - 1];
    fill(ctx, (q) => { polyBuild(pts)(q); q.lineTo(last[0], y1); q.lineTo(pts[0][0], y1); q.closePath(); }, rgba(col, 0.1), 1);
    gp(ctx, polyBuild(pts), col, 2.6, 0.9);
    stroke(ctx, (q) => { q.moveTo(last[0], y1); q.lineTo(last[0], last[1]); q.lineTo(x0, last[1]); }, rgba(col, 0.45), 1, 1, [3, 4]);
    glow(ctx, last[0], last[1], 16, col, 0.8);
    fill(ctx, (q) => q.arc(last[0], last[1], 3.4, 0, TAU), "#ffffff", 1);
  }
  /* rechte Info-Spalte einer Analogie-Zeichnung */
  const infoCol = (bx, bw) => ({ x0: bx + bw * 0.6, x1: bx + bw - 30 });
  const drawCx = (bx, bw) => bx + bw * 0.3;

  /* ---- Kettenkarussell (Seitenansicht, Sitze schwenken mit der Drehzahl aus) ---- */
  function drawCarousel(ctx, m, P, key, bx, by, bw, bh, col, t, pt) {
    const s = bh / 196, st = spinState(t, pt);
    const cx = drawCx(bx, bw);
    const yT = by + 52 * s, yb = by + bh - 12 * s, R0 = 44 * s, l = 78 * s, ry = 0.24, Rc = R0 + 9 * s, apexY = yT - 32 * s;
    const th = (9 + 43 * st.sw) * Math.PI / 180, r = R0 + l * Math.sin(th), ys = yT + l * Math.cos(th);
    const N = 8, seats = [];
    for (let i = 0; i < N; i++) { const ph = st.ang + i * TAU / N, sn = Math.sin(ph), cs = Math.cos(ph); seats.push({ sn, ax: cx + R0 * cs, ay: yT + R0 * ry * sn, sx: cx + r * cs, sy: ys + r * ry * sn }); }
    const seat = (sd) => {
      const dep = 0.5 + 0.5 * sd.sn, a = 0.35 + 0.65 * dep, sc = (0.82 + 0.18 * dep) * s;
      stroke(ctx, (c) => { c.moveTo(sd.ax, sd.ay); c.lineTo(sd.sx + 6.5 * s, sd.sy - 10 * s); }, rgba(C.steel, 0.9), 1.2, a);
      fill(ctx, (c) => { c.moveTo(sd.sx + 3.4 * sc, sd.sy - 15 * sc); c.arc(sd.sx, sd.sy - 15 * sc, 3.4 * sc, 0, TAU); L.roundRectPath(c, sd.sx - 4 * sc, sd.sy - 11 * sc, 8 * sc, 10 * sc, 2.5 * sc); }, C.steel, 0.85 * a);
      fill(ctx, (c) => { c.rect(sd.sx - 8 * sc, sd.sy - 1 * sc, 16 * sc, 4.5 * sc); c.rect(sd.sx + 5 * sc, sd.sy - 10 * sc, 3 * sc, 10 * sc); }, MASS, a);
      if (dep > 0.55) glow(ctx, sd.sx, sd.sy, 14 * s, col, 0.35 * a);
    };
    seats.filter((q) => q.sn < 0).forEach(seat); // hintere Sitze hinter dem Mast
    staticPart(ctx, m, key, bx, by, bw, bh, (c) => {
      fill(c, (q) => { q.moveTo(cx - 5 * s, yT); q.lineTo(cx + 5 * s, yT); q.lineTo(cx + 9 * s, yb); q.lineTo(cx - 9 * s, yb); q.closePath(); }, rgba(col, 0.14), 1);
      gp(c, (q) => { q.moveTo(cx - 5 * s, yT); q.lineTo(cx - 9 * s, yb); q.moveTo(cx + 5 * s, yT); q.lineTo(cx + 9 * s, yb); }, col, 1.6, 0.5);
      stroke(c, (q) => { let f = 0; for (let yy = yT + 8 * s; yy < yb - 10 * s; yy += 13 * s) { const w2 = 5 * s + 4 * s * (yy - yT) / (yb - yT); q.moveTo(cx - w2, yy); q.lineTo(cx + w2, yy + (f++ % 2 ? -1 : 1) * 6 * s); } }, rgba(col, 0.45), 1, 1);
      gp(c, (q) => { q.moveTo(cx - 74 * s, yb); q.lineTo(cx + 74 * s, yb); }, col, 1.8, 0.5);
      stroke(c, (q) => q.ellipse(cx, yb - 5 * s, 42 * s, 7 * s, 0, 0, TAU), rgba(col, 0.6), 1.2, 1);
    });
    // Umlaufbahn der Sitze + Schwenk-Kegel
    stroke(ctx, (c) => c.ellipse(cx, ys, r, r * ry, 0, 0, TAU), rgba(col, 0.32 + 0.2 * st.sw), 1, 1, [5, 5]);
    stroke(ctx, (c) => { c.moveTo(cx - R0, yT); c.lineTo(cx - r, ys); c.moveTo(cx + R0, yT); c.lineTo(cx + r, ys); }, rgba(col, 0.3 + 0.25 * st.sw), 1, 1, [3, 5]);
    // Dach (dreht sich)
    fill(ctx, (c) => { c.moveTo(cx, apexY); c.lineTo(cx + Rc, yT); c.ellipse(cx, yT, Rc, Rc * ry, 0, 0, Math.PI); c.closePath(); }, rgba(col, 0.2), 1);
    stroke(ctx, (c) => { for (let j = 0; j < 12; j++) { const ph = -st.ang * 0.999 + j * TAU / 12, sn = Math.sin(ph); if (sn < -0.05) continue; c.moveTo(cx, apexY); c.lineTo(cx + Rc * Math.cos(ph), yT + Rc * ry * sn); } }, rgba(col, 0.55), 1.1, 1);
    gp(ctx, (c) => { c.moveTo(cx + Rc, yT); c.lineTo(cx, apexY); c.lineTo(cx - Rc, yT); c.ellipse(cx, yT, Rc, Rc * ry, 0, Math.PI, 0, true); }, col, 1.8, 0.6);
    stroke(ctx, (c) => c.ellipse(cx, yT, Rc, Rc * ry, 0, Math.PI, TAU), rgba(col, 0.45), 1, 1);
    fill(ctx, (c) => c.arc(cx, apexY, 3 * s, 0, TAU), col, 1);
    seats.filter((q) => q.sn >= 0).forEach(seat);
    // Fliehkraft-Pfeile an den Umkehrpunkten
    if (st.sw > 0.05) [-1, 1].forEach((sg) => L.arrow(ctx, cx + sg * (r + 10 * s), ys, cx + sg * (r + (14 + 22 * st.sw) * s), ys, C.amber, 2, 9, al(L.clamp(st.sw * 1.4))));
    rotInfo(ctx, m, key, P, bx, by, bw, bh, col, st, "Sitze");
  }
  function rotInfo(ctx, m, key, P, bx, by, bw, bh, col, st, lab) {
    const ic = infoCol(bx, bw), w = ic.x1 - ic.x0;
    if (w < 110) return;
    const hasLeg = P.labels && lab && bh >= 150;
    const r = Math.min(w * 0.36, bh * 0.3, (bh - (hasLeg ? 64 : 36)) / 1.8), cx = (ic.x0 + ic.x1) / 2, cy = by + 26 + r * 1.02;
    if (r < 22) return;
    dial(ctx, m, key + "_dial", cx, cy, r, st.w / W1, col, r >= 50 ? "DREHZAHL" : "");
    if (hasLeg) { const lw = L.measure(ctx, lab, { font: FONT.mono, size: 15, weight: 700 }) + 18; legend(ctx, cx - lw / 2, by + bh - 20, lab, MASS, 1); }
  }

  /* ---- Geschwindigkeitsbegrenzer: Scheibe mit Fliehgewichten (Vorderansicht) ---- */
  function drawGovernor(ctx, m, P, key, bx, by, bw, bh, col, t, pt) {
    const s = bh / 196, st = spinState(t, pt);
    const R = 58 * s, gx = drawCx(bx, bw), gy = by + bh * 0.5, Rg = 0.9 * R;
    staticPart(ctx, m, key, bx, by, bw, bh, (c) => {
      // Lagerbock
      fill(c, (q) => { q.moveTo(gx - 10 * s, gy); q.lineTo(gx + 10 * s, gy); q.lineTo(gx + 42 * s, by + bh - 10 * s); q.lineTo(gx - 42 * s, by + bh - 10 * s); q.closePath(); }, rgba(C.steel, 0.08), 1);
      stroke(c, (q) => { q.moveTo(gx - 10 * s, gy); q.lineTo(gx - 42 * s, by + bh - 10 * s); q.moveTo(gx + 10 * s, gy); q.lineTo(gx + 42 * s, by + bh - 10 * s); q.moveTo(gx - 60 * s, by + bh - 10 * s); q.lineTo(gx + 60 * s, by + bh - 10 * s); }, C.steel, 1.6, 0.8);
      // Sperrverzahnung (feststehend, obere Hälfte)
      const r1 = R + 9 * s, r2 = R + 18 * s, nT = 22;
      stroke(c, (q) => { q.arc(gx, gy, r2, Math.PI * 1.02, Math.PI * 1.98); }, rgba(C.steel, 0.8), 1.6, 1);
      stroke(c, (q) => { for (let i = 0; i < nT; i++) { const a0 = Math.PI * (1.04 + 0.92 * i / nT), a1 = Math.PI * (1.04 + 0.92 * (i + 1) / nT); q.moveTo(gx + Math.cos(a0) * r2, gy + Math.sin(a0) * r2); q.lineTo(gx + Math.cos(a0) * r1, gy + Math.sin(a0) * r1); q.lineTo(gx + Math.cos(a1) * r2, gy + Math.sin(a1) * r2); } }, rgba(C.steel, 0.55), 1, 1);
      // Begrenzerseil
      gp(c, (q) => { q.moveTo(gx - Rg, gy); q.lineTo(gx - Rg, by + bh); q.moveTo(gx + Rg, gy); q.lineTo(gx + Rg, by + bh); }, rgba(C.steel, 0.8), 1.6, 0.4);
    });
    const ang = st.ang;
    stroke(ctx, (c) => { c.moveTo(gx - Rg, gy + 4); c.lineTo(gx - Rg, by + bh); }, "rgba(255,255,255,0.5)", 1.2, 1, [4 * s, 6 * s], ang * Rg);
    stroke(ctx, (c) => { c.moveTo(gx + Rg, gy + 4); c.lineTo(gx + Rg, by + bh); }, "rgba(255,255,255,0.5)", 1.2, 1, [4 * s, 6 * s], -ang * Rg);
    // Scheibe
    fill(ctx, (c) => c.arc(gx, gy, R, 0, TAU), "rgba(6,16,32,0.92)", 1);
    fill(ctx, (c) => c.arc(gx, gy, R, 0, TAU), rgba(col, 0.07), 1);
    gp(ctx, (c) => c.arc(gx, gy, R, 0, TAU), col, 2, 0.6);
    stroke(ctx, (c) => { c.moveTo(gx + Rg, gy); c.arc(gx, gy, Rg, 0, TAU); }, rgba(col, 0.5), 1, 1);
    stroke(ctx, (c) => { for (let i = 0; i < 12; i++) { const a = ang + i * TAU / 12; c.moveTo(gx + Math.cos(a) * Rg, gy + Math.sin(a) * Rg); c.lineTo(gx + Math.cos(a) * R, gy + Math.sin(a) * R); } }, rgba(col, 0.45), 1, 1);
    // Fliehgewichte: schwenken um ihren Drehpunkt nach außen, Feder zieht sie zurück
    const beta = 0.04 + 0.42 * st.sw, cb = Math.cos(-beta), sb2 = Math.sin(-beta);
    const shape = []; for (let j = 0; j <= 8; j++) { const a = 0.2 + 1.72 * j / 8; shape.push([0.66 * R * Math.cos(a), 0.66 * R * Math.sin(a)]); }
    for (let j = 8; j >= 0; j--) { const a = 0.2 + 1.72 * j / 8; shape.push([0.45 * R * Math.cos(a), 0.45 * R * Math.sin(a)]); }
    const pv = [0.555 * R * Math.cos(0.12), 0.555 * R * Math.sin(0.12)];
    const swing = (q) => { const dx = q[0] - pv[0], dy = q[1] - pv[1]; return [pv[0] + dx * cb - dy * sb2, pv[1] + dx * sb2 + dy * cb]; };
    for (let i = 0; i < 2; i++) {
      const al0 = ang + i * Math.PI, ca = Math.cos(al0), sa = Math.sin(al0);
      const W = (q) => [gx + q[0] * ca - q[1] * sa, gy + q[0] * sa + q[1] * ca];
      const poly = shape.map((q) => W(swing(q)));
      const tip = W(swing([0.5 * R * Math.cos(1.84), 0.5 * R * Math.sin(1.84)])), anc = W([0.2 * R * Math.cos(2.6), 0.2 * R * Math.sin(2.6)]);
      // Feder
      stroke(ctx, (c) => { const n2 = 7, dx = tip[0] - anc[0], dy = tip[1] - anc[1], ln = Math.hypot(dx, dy) || 1, nx = -dy / ln, ny = dx / ln; c.moveTo(anc[0], anc[1]); for (let j = 1; j < n2 * 2; j++) { const f = j / (n2 * 2), o = (j % 2 ? 1 : -1) * 4 * s; c.lineTo(anc[0] + dx * f + nx * o, anc[1] + dy * f + ny * o); } c.lineTo(tip[0], tip[1]); }, rgba(C.steel, 0.9), 1.2, 1);
      fill(ctx, polyBuild(poly, true), rgba(MASS, 0.85), 1);
      gp(ctx, polyBuild(poly, true), col, 1.4, 0.8);
      const pw = W(pv);
      fill(ctx, (c) => c.arc(pw[0], pw[1], 3.2 * s, 0, TAU), "#0a1830", 1);
      stroke(ctx, (c) => c.arc(pw[0], pw[1], 3.2 * s, 0, TAU), col, 1.2, 1);
      if (st.sw > 0.05) {
        const ot = W(swing([0.66 * R * Math.cos(1.6), 0.66 * R * Math.sin(1.6)])), dx = ot[0] - gx, dy = ot[1] - gy, ln = Math.hypot(dx, dy) || 1;
        L.arrow(ctx, ot[0] + dx / ln * 6 * s, ot[1] + dy / ln * 6 * s, ot[0] + dx / ln * (10 + 20 * st.sw) * s, ot[1] + dy / ln * (10 + 20 * st.sw) * s, C.amber, 2, 9, al(L.clamp(st.sw * 1.4)));
      }
    }
    fill(ctx, (c) => c.arc(gx, gy, 0.14 * R, 0, TAU), rgba(col, 0.35), 1);
    gp(ctx, (c) => c.arc(gx, gy, 0.14 * R, 0, TAU), col, 1.6, 0.6);
    fill(ctx, (c) => c.arc(gx, gy, 3 * s, 0, TAU), col, 1);
    // Drehrichtung
    const ra = R + 30 * s;
    stroke(ctx, (c) => c.arc(gx, gy, ra, -0.5, 0.35), rgba(col, 0.4 + 0.5 * st.sw), 1.6, 1);
    const ea = 0.35, ex = gx + Math.cos(ea) * ra, ey = gy + Math.sin(ea) * ra;
    fill(ctx, (c) => { c.moveTo(ex - Math.sin(ea) * 9 * s, ey + Math.cos(ea) * 9 * s); c.lineTo(ex - 5 * s * Math.cos(ea), ey - 5 * s * Math.sin(ea)); c.lineTo(ex + 5 * s * Math.cos(ea), ey + 5 * s * Math.sin(ea)); c.closePath(); }, rgba(col, 0.4 + 0.5 * st.sw), 1);
    rotInfo(ctx, m, key, P, bx, by, bw, bh, col, st, "Fliehgewichte");
  }

  /* ---- Druck-Schraffur (dichter bei kleinerem Volumen) ---- */
  function pressure(ctx, x0, y0, x1, y1, st, s) {
    if (y1 - y0 < 2) return;
    const sp = Math.max(3.2, 12 * s * st.vol);
    fill(ctx, (c) => c.rect(x0, y0, x1 - x0, y1 - y0), rgba(C.cyan, 0.07 + 0.14 * st.e), 1);
    hatch(ctx, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], rgba(C.cyan, 0.4 + 0.35 * st.e), sp, 1);
  }

  /* ---- Spritze: Kolben verdichtet eingeschlossene Luft ---- */
  function drawPiston(ctx, m, P, key, bx, by, bw, bh, col, t, pt) {
    const s = bh / 196, st = pressState(t, pt);
    const cx = drawCx(bx, bw), hw = 38 * s, x0 = cx - hw, x1 = cx + hw;
    const yT = by + 70 * s, yB = by + bh - 34 * s, hh = 11 * s;
    const yh0 = yT + 6 * s, yh1 = yh0 + (yB - yh0 - hh) * 0.54, yh = L.lerp(yh0, yh1, st.e), rodL = yh1 - yh0 + 10 * s;
    staticPart(ctx, m, key, bx, by, bw, bh, (c) => {
      fill(c, (q) => q.rect(x0, yT, 2 * hw, yB - yT), rgba(col, 0.05), 1);
      gp(c, (q) => { q.moveTo(x0, yT - 4 * s); q.lineTo(x0, yB); q.lineTo(cx - 5 * s, yB + 12 * s); q.lineTo(cx - 5 * s, yB + 18 * s); q.moveTo(x1, yT - 4 * s); q.lineTo(x1, yB); q.lineTo(cx + 5 * s, yB + 12 * s); q.lineTo(cx + 5 * s, yB + 18 * s); }, col, 1.8, 0.6);
      fill(c, (q) => q.rect(x0 - 22 * s, yT - 9 * s, 2 * hw + 44 * s, 6 * s), rgba(col, 0.3), 1);
      stroke(c, (q) => q.rect(x0 - 22 * s, yT - 9 * s, 2 * hw + 44 * s, 6 * s), col, 1.3, 1);
      fill(c, (q) => q.rect(cx - 8 * s, yB + 16 * s, 16 * s, 9 * s), col, 0.9); // Verschlusskappe
      stroke(c, (q) => { for (let yy = yT + 12 * s; yy < yB - 4 * s; yy += 11 * s) { const lg = Math.round((yy - yT) / (11 * s)) % 2 === 0; q.moveTo(x1, yy); q.lineTo(x1 - (lg ? 11 : 6) * s, yy); } }, rgba(col, 0.55), 1, 1);
      stroke(c, (q) => { q.moveTo(x0 + 6 * s, yT + 4 * s); q.lineTo(x0 + 6 * s, yB - 6 * s); }, "rgba(255,255,255,0.12)", 3 * s, 1);
    });
    pressure(ctx, x0 + 2, yh + hh, x1 - 2, yB, st, s);
    // Kolben mit Stange und Daumenplatte
    fill(ctx, (c) => c.rect(cx - 3 * s, yh - rodL, 6 * s, rodL), rgba(C.steel, 0.35), 1);
    stroke(ctx, (c) => { c.moveTo(cx - 3 * s, yh - rodL); c.lineTo(cx - 3 * s, yh); c.moveTo(cx + 3 * s, yh - rodL); c.lineTo(cx + 3 * s, yh); }, C.steel, 1.3, 1);
    fill(ctx, (c) => c.rect(cx - 24 * s, yh - rodL - 6 * s, 48 * s, 6 * s), rgba(C.steel, 0.5), 1);
    stroke(ctx, (c) => c.rect(cx - 24 * s, yh - rodL - 6 * s, 48 * s, 6 * s), C.steel, 1.3, 1);
    fill(ctx, (c) => c.rect(x0 + 2, yh, 2 * hw - 4, hh), "#1a2b44", 1);
    fill(ctx, (c) => c.rect(x0 + 2, yh, 2 * hw - 4, hh), rgba(MASS, 0.55), 1);
    stroke(ctx, (c) => { c.rect(x0 + 2, yh, 2 * hw - 4, hh); c.moveTo(x0 + 2, yh + hh * 0.5); c.lineTo(x1 - 2, yh + hh * 0.5); }, col, 1.2, 1);
    if (st.x > 0 && st.x < 1) L.arrow(ctx, cx + 36 * s, yh - rodL - 20 * s, cx + 36 * s, yh - rodL + 6 * s, C.amber, 2.5, 11, al(Math.sin(Math.PI * st.x)));
    // Druckpfeile an Wand und Kolbenboden
    const pa = L.clamp(st.e * 1.3);
    if (pa > 0.02) {
      const ym = (yh + hh + yB) / 2, L2 = (6 + 10 * st.e) * s;
      [[x0 + 8 * s, ym, -1, 0], [x1 - 8 * s, ym, 1, 0], [cx, yh + hh + 16 * s, 0, -1]].forEach((q) => L.arrow(ctx, q[0], q[1], q[0] + q[2] * L2, q[1] + q[3] * L2, C.cyan, 1.6, 7, al(pa)));
    }
    const lab = P.diagLabel == null ? "Luft" : P.diagLabel;
    pressInfo(ctx, m, key, P, bx, by, bw, bh, col, st, lab, x1 - 4, (yh + hh + yB) / 2, 1);
  }
  function pressInfo(ctx, m, key, P, bx, by, bw, bh, col, st, lab, ax, ay, la) {
    const ic = infoCol(bx, bw);
    if (P.labels && lab && la > 0.01) { const lx = Math.min(ax + 44, ic.x0 - 40), w0 = L.measure(ctx, lab, { font: FONT.mono, size: 14, weight: 700, letterSpacing: 1 }); if (lx + w0 < ic.x0 - 6) label(ctx, lab, lx, ay + 5, ax, ay, C.cyan, la); }
    if (ic.x1 - ic.x0 < 110) return;
    pvDiagram(ctx, m, key + "_pv", ic.x0 + 18, by + 36, ic.x1 - 8, by + bh - 34, st, C.cyan);
  }

  /* ---- Kabine im engen Schacht staut ein Luftpolster (Kolbeneffekt) ---- */
  function drawAirCushion(ctx, m, P, key, bx, by, bw, bh, col, t, pt) {
    const s = bh / 196, st = pressState(t, pt);
    const cx = drawCx(bx, bw), gap = 38 * s, wall = 15 * s;
    const yTop = by + 4 * s, yF = by + bh - 24 * s, carW = 2 * gap - 7 * s, carH = 54 * s;
    const yc0 = by + 14 * s, yc1 = yc0 + (yF - yc0 - carH) * 0.56, yc = L.lerp(yc0, yc1, st.e), cb = yc + carH;
    staticPart(ctx, m, key, bx, by, bw, bh, (c) => {
      [[cx - gap - wall, cx - gap], [cx + gap, cx + gap + wall]].forEach((wq) => {
        const pl = [[wq[0], yTop], [wq[1], yTop], [wq[1], yF], [wq[0], yF]];
        hatch(c, pl, rgba(C.steel, 0.35), 7 * s, 1);
        stroke(c, (q) => { q.moveTo(wq[0] === cx - gap - wall ? wq[1] : wq[0], yTop); q.lineTo(wq[0] === cx - gap - wall ? wq[1] : wq[0], yF); }, C.steel, 1.6, 0.9);
      });
      const fl = [[cx - gap - wall, yF], [cx + gap + wall, yF], [cx + gap + wall, yF + 12 * s], [cx - gap - wall, yF + 12 * s]];
      hatch(c, fl, rgba(C.steel, 0.35), 7 * s, 1);
      stroke(c, (q) => { q.moveTo(cx - gap, yF); q.lineTo(cx + gap, yF); }, C.steel, 1.6, 0.9);
      stroke(c, (q) => { for (let yy = yTop + 40 * s; yy < yF - 10 * s; yy += 58 * s) { q.moveTo(cx - gap - wall - 34 * s, yy); q.lineTo(cx - gap - wall, yy); q.moveTo(cx + gap + wall, yy); q.lineTo(cx + gap + wall + 34 * s, yy); } }, rgba(col, 0.3), 1, 1, [4, 4]);
      stroke(c, (q) => { q.moveTo(cx + gap + wall + 6 * s, yF); q.lineTo(cx + gap + wall + 40 * s, yF); }, rgba(C.steel, 0.5), 1, 1);
    });
    pressure(ctx, cx - gap + 1, cb + 1, cx + gap - 1, yF - 1, st, s);
    // Bewegungsstreifen über der Kabine
    if (st.v > 0.15) stroke(ctx, (c) => { for (let i = -1; i <= 1; i++) { const xx = cx + i * carW * 0.3; c.moveTo(xx, yc - 6 * s); c.lineTo(xx, yc - (10 + 26 * Math.min(1.2, st.v)) * s); } }, rgba(col, 0.5), 1.4, L.clamp(st.v - 0.15));
    // Kabine
    const kx = cx - carW / 2;
    fill(ctx, (c) => c.rect(kx, yc, carW, carH), "#0b1a30", 1);
    fill(ctx, (c) => c.rect(kx, yc, carW, carH), rgba(col, 0.14), 1);
    gp(ctx, (c) => c.rect(kx, yc, carW, carH), col, 1.8, 0.6);
    stroke(ctx, (c) => { c.moveTo(cx, yc + 8 * s); c.lineTo(cx, cb - 3 * s); c.rect(kx + 5 * s, yc + 8 * s, carW - 10 * s, carH - 11 * s); c.moveTo(kx - 1, yc - 5 * s); c.lineTo(kx + carW + 1, yc - 5 * s); }, rgba(col, 0.5), 1, 1);
    // Druck von unten
    const pa = L.clamp(st.e * 1.3);
    if (pa > 0.02) { const L2 = (8 + 12 * st.e) * s; [-0.3, 0, 0.3].forEach((f) => L.arrow(ctx, cx + f * carW, cb + L2 + 8 * s, cx + f * carW, cb + 5 * s, C.cyan, 1.8, 8, al(pa))); }
    const lab = P.diagLabel == null ? "Luftpolster" : P.diagLabel;
    pressInfo(ctx, m, key, P, bx, by, bw, bh, col, st, lab, cx + gap - 6 * s, (cb + yF) / 2, L.clamp((st.e - 0.3) * 3));
  }

  /* ---- Höhenbalken (gemeinsame Skala beider Seiten) ---- */
  function drawBar(ctx, m, P, bx, by, bw, bh, col, t, pt) {
    const B = P.bar, max = m.barMax || 1, step = m.barStep || max / 5, k = pt.k;
    const ax = bx + 84, base = by + bh - 26, topY = by + 34, H = base - topY;
    const Y = (v) => base - H * L.clamp(v / max, 0, 1.04);
    const bwid = Math.round(L.clamp(bw * 0.25, 90, 180)), x0 = ax + 26, x1 = x0 + bwid;
    staticPart(ctx, m, "bar_axis_" + P.side + "_" + Math.round(bh), bx, by, bw, bh, (c) => {
      stroke(c, (q) => { q.moveTo(ax, topY - 12); q.lineTo(ax, base); q.lineTo(x1 + 60, base); }, C.steel, 1.6, 0.9);
      const lo = { font: FONT.mono, size: 16, weight: 700, color: C.steel, align: "right" };
      const nT = Math.round(max / step);
      stroke(c, (q) => { for (let i = 1; i <= nT; i++) { const yy = Y(i * step); q.moveTo(ax, yy); q.lineTo(x1 + 20, yy); } }, rgba(C.steel, 0.14), 1, 1, [3, 5]);
      stroke(c, (q) => { for (let i = 0; i <= nT; i++) { const yy = Y(i * step); q.moveTo(ax - 7, yy); q.lineTo(ax, yy); } }, C.steel, 1.4, 0.9);
      for (let i = 0; i <= nT; i++) text(c, fmtNum(i * step) + (i === nT && B.unit ? " " + B.unit : ""), ax - 12, Y(i * step) + 5, lo);
    });
    // Wertverlauf: ggf. erst Ausgangswert, dann Änderung auf Zielwert
    let lo2, hi2, g2 = 1, show = 0;
    if (B.from != null) {
      const g1 = L.easeInOut(L.seg(t, pt.fromAt, 0.8 * k)); g2 = L.easeInOut(L.seg(t, pt.tAct, 1.1 * k));
      lo2 = L.lerp(B.from * g1, B.lo, g2); hi2 = L.lerp(B.from * g1, B.hi, g2); show = g1;
    } else { const g = L.easeOut(L.seg(t, pt.tAct, 0.9 * k)); lo2 = B.lo * g; hi2 = B.hi * g; show = g; }
    if (show <= 0.001) return;
    const yLo = Y(lo2), yHi = Y(hi2);
    if (B.from != null && g2 > 0) { // Geisterkontur des Ausgangswerts
      stroke(ctx, (c) => c.rect(x0, Y(B.from), bwid, base - Y(B.from)), rgba(col, 0.55), 1.2, L.clamp(g2 * 2), [5, 5]);
      text(ctx, B.fromText, x0 + 2, Math.max(topY - 4, Y(B.from) - 9), { font: FONT.mono, size: 15, weight: 700, color: rgba(col, 0.75), alpha: L.clamp(g2 * 2 - 0.8) });
    }
    const body = [[x0, yLo], [x1, yLo], [x1, base], [x0, base]];
    fill(ctx, (c) => c.rect(x0, yLo, bwid, base - yLo), rgba(col, 0.2), 1);
    hatch(ctx, body, rgba(col, 0.35), 9, 1);
    if (yHi < yLo - 0.5) { // Bandbreite (z. B. 6–7 m)
      fill(ctx, (c) => c.rect(x0, yHi, bwid, yLo - yHi), rgba(col, 0.1), 1);
      hatch(ctx, [[x0, yHi], [x1, yHi], [x1, yLo], [x0, yLo]], rgba(col, 0.28), 5, 1);
      stroke(ctx, (c) => { c.moveTo(x0, yLo); c.lineTo(x1, yLo); }, rgba(col, 0.8), 1.2, 1, [4, 3]);
    }
    gp(ctx, (c) => { c.moveTo(x0, base); c.lineTo(x0, yHi); c.lineTo(x1, yHi); c.lineTo(x1, base); }, col, 2, 0.8);
    gp(ctx, (c) => { c.moveTo(x0 - 4, yHi); c.lineTo(x1 + 4, yHi); }, col, 3, 1.2);
    glow(ctx, (x0 + x1) / 2, yHi, 30, col, 0.35 + 0.1 * Math.sin(t * 2.6));
    // Maßlinie + Wert
    const dx = x1 + 22, ym = (yLo + yHi) / 2;
    stroke(ctx, (c) => { c.moveTo(dx, base); c.lineTo(dx, yHi); c.moveTo(dx - 5, yHi); c.lineTo(dx + 5, yHi); c.moveTo(dx - 5, base); c.lineTo(dx + 5, base); }, rgba(col, 0.8), 1.2, 1);
    fill(ctx, (c) => { c.moveTo(dx, yHi); c.lineTo(dx - 4, yHi + 9); c.lineTo(dx + 4, yHi + 9); c.closePath(); c.moveTo(dx, base); c.lineTo(dx - 4, base - 9); c.lineTo(dx + 4, base - 9); c.closePath(); }, rgba(col, 0.8), 1);
    const tx = dx + 26, maxW = bx + bw - 24 - tx;
    const drawVal = (str2, a, pre, lab) => {
      if (a <= 0.01 || !str2) return;
      let main = str2, un = "";
      if (B.unit && str2.length > B.unit.length + 1 && str2.slice(-B.unit.length - 1) === " " + B.unit) { main = str2.slice(0, -B.unit.length - 1); un = B.unit; }
      const preS = pre ? pre + " " : "", MO = (z) => ({ font: FONT.mono, size: z, weight: 700 });
      const wid = (z) => (preS ? L.measure(ctx, preS, MO(Math.round(z * 0.5))) : 0) + L.measure(ctx, main, MO(z)) + (un ? z * 0.16 + L.measure(ctx, un, MO(Math.round(z * 0.55))) : 0);
      let sz = Math.round(Math.min(72, bh * 0.24)); while (sz > 20 && wid(sz) > maxW) sz -= 2;
      const ty = L.clamp(ym + sz * 0.36, topY + sz * 0.8, base - (lab ? 34 : 6));
      let xx = tx;
      if (preS) { text(ctx, preS, xx, ty, Object.assign({ color: rgba(col, 0.85), alpha: a }, MO(Math.round(sz * 0.5)))); xx += L.measure(ctx, preS, MO(Math.round(sz * 0.5))); }
      text(ctx, main, xx, ty, Object.assign({ color: col, glow: 16, glowColor: col, alpha: a }, MO(sz)));
      if (un) text(ctx, un, xx + L.measure(ctx, main, MO(sz)) + sz * 0.16, ty, Object.assign({ color: rgba(col, 0.9), alpha: a }, MO(Math.round(sz * 0.55))));
      if (lab) text(ctx, lab, tx, ty + 32, { font: FONT.body, size: 23, weight: 600, color: "rgba(226,240,255,0.88)", alpha: a });
    };
    if (B.from != null) { drawVal(B.fromText, show * (1 - L.clamp(g2 * 2.5)), "", B.fromLabel); drawVal(B.text, L.clamp(g2 * 2.5 - 1.5), B.prefix, B.label); }
    else drawVal(B.text, L.clamp(show * 2 - 1), B.prefix, B.label);
  }

  /* ---- Große Zahl mit Größenvergleichsbalken (gemeinsame Skala) ---- */
  function drawStat(ctx, m, P, bx, by, bw, bh, col, t, pt) {
    const S = P.stat, k = pt.k, g = L.seg(t, pt.tAct, 1.3 * k), a = L.easeOut(L.seg(t, pt.tAct, 0.35));
    const hasBar = m.statBar && m.statCount >= 2 && S.value != null && S.bar;
    const barY = by + bh - 34, labY = hasBar ? barY - 22 : by + bh - 26, numB = S.label ? labY - 38 : labY - 6;
    const finalStr = S.text != null ? S.text : fmtNum(S.value, S.decimals ?? decOf(S.value));
    const x0 = bx + 30, maxW = bw - 60;
    let sz = Math.round(Math.min(108, (numB - by - 16) / 0.74));
    const so = (z) => ({ font: FONT.mono, size: z, weight: 700 }), po = (z) => ({ font: FONT.head, size: Math.round(z * 0.36), weight: 700, letterSpacing: 1 });
    const wAll = (z) => (S.prefix ? L.measure(ctx, S.prefix + " ", po(z)) : 0) + L.measure(ctx, finalStr, so(z)) + (S.suffix ? L.measure(ctx, " " + S.suffix, po(z)) : 0);
    while (sz > 28 && wAll(sz) > maxW) sz -= 4;
    if (hasBar) { // Spur zuerst sichtbar
      stroke(ctx, (c) => c.rect(x0, barY, maxW, 12), rgba(col, 0.45), 1, 1);
      stroke(ctx, (c) => { for (let i = 1; i < 10; i++) { c.moveTo(x0 + maxW * i / 10, barY + 12); c.lineTo(x0 + maxW * i / 10, barY + (i === 5 ? 20 : 16)); } }, rgba(col, 0.35), 1, 1);
    }
    if (a <= 0.004) return;
    const cur = S.value != null ? S.value * L.easeOut(g) : null;
    const numStr = S.text != null ? S.text : fmtNum(g >= 1 ? S.value : cur, S.decimals ?? decOf(S.value));
    let xx = x0 + (1 - a) * 18;
    if (S.prefix) { text(ctx, S.prefix, xx, numB, Object.assign({ color: rgba(col, 0.9), alpha: a }, po(sz))); xx += L.measure(ctx, S.prefix + " ", po(sz)); }
    text(ctx, numStr, xx, numB, Object.assign({ color: col, glow: 20, glowColor: col, alpha: a }, so(sz)));
    xx += L.measure(ctx, finalStr, so(sz));
    if (S.suffix) text(ctx, " " + S.suffix, xx, numB, Object.assign({ color: rgba(col, 0.9), alpha: a }, po(sz)));
    if (S.label) text(ctx, S.label, x0, labY, { font: FONT.body, size: 24, weight: 600, color: "rgba(226,240,255,0.88)", alpha: a });
    if (hasBar) {
      const v = Math.max(0, cur), fr = m.statLog ? Math.log10(1 + v) / Math.log10(1 + m.statMax) : v / m.statMax;
      const fw = Math.max(v > 0 ? 3 : 0, (maxW - 4) * L.clamp(fr));
      fill(ctx, (c) => c.rect(x0 + 2, barY + 2, fw, 8), col, a);
      glow(ctx, x0 + 2 + fw, barY + 6, 22 + 6 * Math.sin(t * 3), col, 0.8 * a);
    }
  }

  /* ---- Silhouetten-Reihe, Anteil markiert (z. B. Beschäftigte mit Schutzhelm) ---- */
  function figPath(c, x, base, h) {
    const hr = 0.095 * h;
    c.moveTo(x + hr, base - 0.885 * h); c.arc(x, base - 0.885 * h, hr, 0, TAU);
    L.roundRectPath(c, x - 0.16 * h, base - 0.765 * h, 0.32 * h, 0.365 * h, 0.075 * h);
    c.rect(x - 0.135 * h, base - 0.4 * h, 0.115 * h, 0.4 * h); c.rect(x + 0.02 * h, base - 0.4 * h, 0.115 * h, 0.4 * h);
  }
  function helmetPath(c, x, yh, h) {
    const r = 0.112 * h;
    c.moveTo(x - r, yh); c.arc(x, yh, r, Math.PI, TAU); c.closePath();
    c.rect(x - 0.15 * h, yh - 0.012 * h, 0.3 * h, 0.034 * h);
  }
  function drawPeople(ctx, m, P, bx, by, bw, bh, col, t, pt) {
    const Q = P.people, n = Q.count, nh = Q.hl, rowsN = n > 12 ? 2 : 1, per = Math.ceil(n / rowsN);
    const hasLab = !!(Q.label || Q.restLabel), padX = 34, cw = (bw - 2 * padX) / per;
    const areaH = bh - 20 - (hasLab ? 46 : 12);
    const fh = Math.min(areaH / rowsN - (rowsN > 1 ? 8 : 0), cw * 2.1);
    const x0 = bx + padX + (bw - 2 * padX - cw * per) / 2;
    const hlA = L.smooth(L.seg(t, pt.tAct, 0.6 * pt.k));
    const pos = [];
    for (let i = 0; i < n; i++) { const r = Math.floor(i / per), c2 = i % per; pos.push([x0 + cw * (c2 + 0.5), by + 16 + fh * (r + 1) + r * 8]); }
    const grp = { base: [], hi: [] };
    for (let i = 0; i < n; i++) {
      const pop = L.easeOutBack(L.seg(t, pt.tVis + 0.2 + i * 0.045, 0.35)); if (pop <= 0.01) continue;
      const h = fh * Math.max(0.01, pop);
      (i < nh ? grp.hi : grp.base).push([pos[i][0], pos[i][1], h, i]);
    }
    const allP = (arr) => (c) => arr.forEach((q) => figPath(c, q[0], q[1], q[2]));
    fill(ctx, allP(grp.base), rgba(C.steel, 0.42 - 0.12 * hlA), 1);
    fill(ctx, allP(grp.hi), rgba(C.steel, 0.42 * (1 - hlA)), 1);
    if (hlA > 0.01 && grp.hi.length) {
      fill(ctx, allP(grp.hi), rgba(col, 0.9), hlA);
      grp.hi.forEach((q) => glow(ctx, q[0], q[1] - q[2] * 0.55, q[2] * 0.55, col, 0.18 * hlA));
      if (Q.helmet) {
        const hd = L.easeOut(L.seg(t, pt.tAct + 0.15, 0.5));
        fill(ctx, (c) => grp.hi.forEach((q) => helmetPath(c, q[0], q[1] - 0.9 * q[2] - (1 - hd) * 14, q[2])), C.amber, hd);
      }
    }
    // Klammer + Beschriftung
    const yb = by + 16 + fh * rowsN + (rowsN - 1) * 8 + 12;
    const brk = (i0, i1, lab, colB, a) => {
      if (a <= 0.01 || i1 < i0) return;
      const xa = pos[i0][0] - cw * 0.4, xb = pos[i1][0] + cw * 0.4, xm = (xa + xb) / 2, q = L.easeInOut(a);
      stroke(ctx, (c) => { c.moveTo(xm - (xm - xa) * q, yb); c.lineTo(xm - (xm - xa) * q, yb + 7); c.moveTo(xm - (xm - xa) * q, yb + 7); c.lineTo(xm + (xb - xm) * q, yb + 7); c.lineTo(xm + (xb - xm) * q, yb); c.moveTo(xm, yb + 7); c.lineTo(xm, yb + 13); }, colB, 1.6, 1);
      if (lab) {
        let sz = 24; while (sz > 15 && L.measure(ctx, lab, { font: FONT.body, size: sz, weight: 600 }) > Math.max(xb - xa + 60, 140)) sz--;
        text(ctx, lab, L.clamp(xm, bx + 20 + L.measure(ctx, lab, { font: FONT.body, size: sz, weight: 600 }) / 2, bx + bw - 20 - L.measure(ctx, lab, { font: FONT.body, size: sz, weight: 600 }) / 2), yb + 36, { font: FONT.body, size: sz, weight: 600, color: colB, align: "center", alpha: L.clamp(a * 1.5 - 0.5) });
      }
    };
    if (nh > 0) brk(0, Math.min(nh, n) - 1, Q.label, col, L.seg(t, pt.tAct + 0.25, 0.6));
    if (Q.restLabel && nh < n) brk(nh, n - 1, Q.restLabel, C.steel, L.seg(t, pt.tAct + 0.45, 0.6));
  }

  function drawIcon(ctx, m, P, side, x, y, w, h, t, tm) {
    const col = P.color, key = "ico_" + side + "_" + P.icon;
    if (P.vis === "bar") { drawBar(ctx, m, P, x, y, w, h, col, t, tm); return; }
    if (P.vis === "stat") { drawStat(ctx, m, P, x, y, w, h, col, t, tm); return; }
    if (P.vis === "people") { drawPeople(ctx, m, P, x, y, w, h, col, t, tm); return; }
    if (P.icon === "instantaneous_gear" || P.icon === "progressive_gear") {
      const prog = P.icon === "progressive_gear", settle = tm.tE + (prog ? tm.tsProg : tm.tsInst) + 0.7;
      if (t >= settle) { // Endzustand ist statisch -> einmal rendern, danach blitten
        const lay = getLayer(m, key + "_end_" + tm.d.toFixed(3) + "_" + tm.tE.toFixed(3), w + 48, h + 48, (c2) => { c2.translate(24 - x, 24 - y); drawGear(c2, null, key, x, y, w, h, col, settle, tm, prog, P.diagLabel); });
        if (lay) { blit(ctx, lay, x - 24, y - 24, 1); return; }
      }
      drawGear(ctx, m, key, x, y, w, h, col, t, tm, prog, P.diagLabel);
      return;
    }
    switch (P.icon) {
      case "old_platform": drawPlatform(ctx, m, key, x, y, w, h, col, t); break;
      case "modern_car": drawModernCar(ctx, m, key, x, y, w, h, col, t); break;
      case "rope": drawRope(ctx, m, key, x, y, w, h, col, t); break;
      case "belt": drawBelt(ctx, m, key, x, y, w, h, col, t); break;
      case "carousel": drawCarousel(ctx, m, P, key, x, y, w, h, col, t, tm); break;
      case "governor": drawGovernor(ctx, m, P, key, x, y, w, h, col, t, tm); break;
      case "piston": drawPiston(ctx, m, P, key, x, y, w, h, col, t, tm); break;
      case "air_cushion": drawAirCushion(ctx, m, P, key, x, y, w, h, col, t, tm); break;
      default: break;
    }
  }

  /* ---------------- Szenen-Bausteine ---------------- */
  function drawTextBox(ctx, m, t, d) {
    const tb = m.tb; if (!tb) return;
    const a = L.env(t, 0.5, d - 0.3, 0.45); if (a <= 0) return;
    // wie das Engine-Overlay im Bildschirmraum (ohne Kamerafahrt) zeichnen
    const vec0 = VEC; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); VEC = false;
    try { drawTextBoxInner(ctx, m, t, d, tb, a); } finally { VEC = vec0; ctx.restore(); }
  }
  function drawTextBoxInner(ctx, m, t, d, tb, a) {
    GA = 1;
    const x = 90, y0 = 96, slide = L.easeOut(L.seg(t, 0.5, 0.5));
    const paint = (c, aa, sl, ta) => {
      fill(c, (q) => q.rect(x, y0, 8, tb.h), C.amber, aa);
      L.panel(c, x + 14, y0, Math.max(10, tb.w * sl), tb.h, { fill: "rgba(4,12,26,0.82)", stroke: C.amberSoft, r: 4, alpha: aa });
      tb.lines.forEach((ln, i) => text(c, ln, x + 44, y0 + 14 + tb.size + i * tb.lh, { size: tb.size, weight: 700, font: FONT.head, letterSpacing: 2, color: C.white, alpha: ta }));
    };
    if (t >= 1.12) {
      const BM = 14;
      const lay = getLayer(m, "textbox", tb.w + 14 + 2 * BM, tb.h + 2 * BM, (c2) => { c2.translate(BM - x, BM - y0); paint(c2, 1, 1, 1); });
      if (lay) { blit(ctx, lay, x - BM, y0 - BM, a); return; }
    }
    paint(ctx, a, slide, a * L.seg(t, 0.75, 0.35));
  }

  function drawHeading(ctx, m, tm, t) {
    const hd = m.hd; if (!hd) return;
    const a = L.easeOut(L.seg(t, 0.15 * tm.k, 0.7 * tm.k)); if (a <= 0) return;
    GA = 1;
    const cx = m.mid;
    const HM = 30, lw = hd.w0 + 2 * HM, lh2 = hd.lines.length * hd.lh + 2 * HM;
    const yN = hd.top + hd.size * 0.5 + (hd.lines.length - 1) * hd.lh / 2; // Mitte der Überschrift im Normal-Layout
    const q = tm.heroUntil != null ? L.easeInOut(L.seg(t, tm.heroMove0, tm.heroMoveD)) : 1;
    if (q < 1) { // Frage-Karte: groß und mittig, gleitet vor dem ersten Panel an ihren Platz
      if (hd.heroS == null) {
        const maxW = Math.min(1500, m.W - 260);
        hd.heroS = L.clamp(maxW / (hd.w0 + 2 * 28 + 2 * 64), 1, 1.75);
        hd.heroY = Math.min(m.H * 0.5, (hd.top + m.py + m.ph) / 2);
      }
      const S = hd.heroS, sc = L.lerp(S, 1, q), yc = L.lerp(hd.heroY, yN, q) + (1 - a) * 12;
      const hb = getLayer(m, "heading_hero", Math.ceil(lw * S), Math.ceil(lh2 * S), (c2) => {
        c2.scale(S, S);
        hd.lines.forEach((ln, i) => text(c2, ln, lw / 2, HM + hd.size * 0.82 + i * hd.lh, { font: FONT.head, weight: 700, size: hd.size, align: "center", letterSpacing: 3, color: C.white, glow: 14, glowColor: C.cyan }));
      }, true);
      const oy = hd.size * 0.5 + (hd.lines.length - 1) * hd.lh / 2 + HM;
      if (hb) blit(ctx, hb, cx - sc * lw / 2, yc - sc * oy, a, lw * sc, lh2 * sc);
      else hd.lines.forEach((ln, i) => text(ctx, ln, cx, yc + sc * (hd.size * 0.32 + (i - (hd.lines.length - 1) / 2) * hd.lh), { font: FONT.head, weight: 700, size: hd.size * sc, align: "center", letterSpacing: 3 * sc, color: C.white, glow: 14, glowColor: C.cyan, alpha: a }));
      const half = (hd.w0 / 2 + 28) * sc, len = 64 * sc * L.easeOut(L.seg(t, 0.35 * tm.k, 0.8 * tm.k));
      if (len > 1) {
        line(ctx, cx - half - len, yc, cx - half, yc, m.left.color, 2, 0.8, { alpha: a });
        line(ctx, cx + half, yc, cx + half + len, yc, m.right.color, 2, 0.8, { alpha: a });
        glow(ctx, cx - half - len, yc, 10 * sc, m.left.color, a); glow(ctx, cx + half + len, yc, 10 * sc, m.right.color, a);
      }
      return;
    }
    const hl = getLayer(m, "heading", lw, lh2, (c2) => {
      hd.lines.forEach((ln, i) => text(c2, ln, lw / 2, HM + hd.size * 0.82 + i * hd.lh, { font: FONT.head, weight: 700, size: hd.size, align: "center", letterSpacing: 3, color: C.white, glow: 14, glowColor: C.cyan }));
    });
    if (hl) blit(ctx, hl, cx - lw / 2, hd.top - HM + (1 - a) * 12, a);
    else hd.lines.forEach((ln, i) => text(ctx, ln, cx, hd.top + hd.size * 0.82 + i * hd.lh + (1 - a) * 12, { font: FONT.head, weight: 700, size: hd.size, align: "center", letterSpacing: 3, color: C.white, glow: 14, glowColor: C.cyan, alpha: a }));
    const yl = yN, half = hd.w0 / 2 + 28, len = 64 * L.easeOut(L.seg(t, 0.35 * tm.k, 0.8 * tm.k));
    if (len > 1) {
      line(ctx, cx - half - len, yl, cx - half, yl, m.left.color, 2, 0.8, { alpha: a });
      line(ctx, cx + half, yl, cx + half + len, yl, m.right.color, 2, 0.8, { alpha: a });
      glow(ctx, cx - half - len, yl, 10, m.left.color, a); glow(ctx, cx + half + len, yl, 10, m.right.color, a);
    }
  }

  function drawDivider(ctx, m, tm, t) {
    const e = L.easeInOut(L.seg(t, tm.div0, tm.divD)); if (e <= 0) return;
    GA = 1;
    const x = Math.round(m.mid), yc = m.py + m.ph / 2, half = (m.ph / 2 + 14) * e;
    const lc = m.left.color, rc = m.right.color;
    const full = m.ph / 2 + 14, DW = 60, DM = 20;
    const lay = getLayer(m, "divider", DW, 2 * full + 2 * DM, (c2) => {
      const cx = DW / 2, y0 = DM, y1 = DM + 2 * full, ym = DM + full;
      const grad = (col) => { const g = c2.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.18, rgba(col, 0.9)); g.addColorStop(0.82, rgba(col, 0.9)); g.addColorStop(1, rgba(col, 0)); return g; };
      gp(c2, (c) => { c.moveTo(cx - 4, y0); c.lineTo(cx - 4, y1); }, grad(lc), 2, 0.8);
      gp(c2, (c) => { c.moveTo(cx + 4, y0); c.lineTo(cx + 4, y1); }, grad(rc), 2, 0.8);
      stroke(c2, (c) => { for (let k2 = -Math.floor((full - 16) / 24); k2 * 24 < full - 16; k2++) { const yy = ym + k2 * 24, big = k2 % 4 === 0; c.moveTo(cx - (big ? 18 : 13), yy); c.lineTo(cx - 9, yy); c.moveTo(cx + 9, yy); c.lineTo(cx + (big ? 18 : 13), yy); } }, rgba(C.steel, 0.35), 1, 1);
    });
    if (lay) {
      if (e < 1) { ctx.save(); ctx.beginPath(); ctx.rect(x - DW / 2, yc - half, DW, 2 * half); ctx.clip(); blit(ctx, lay, x - DW / 2, yc - full - DM, 1); ctx.restore(); glow(ctx, x - 4, yc - half, 18, lc, 1 - e); glow(ctx, x + 4, yc + half, 18, rc, 1 - e); }
      else blit(ctx, lay, x - DW / 2, yc - full - DM, 1);
    } else {
      const grad = (col) => { const g = ctx.createLinearGradient(0, yc - half, 0, yc + half); g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.18, rgba(col, 0.9)); g.addColorStop(0.82, rgba(col, 0.9)); g.addColorStop(1, rgba(col, 0)); return g; };
      gp(ctx, (c) => { c.moveTo(x - 4, yc - half); c.lineTo(x - 4, yc + half); }, grad(lc), 2, 0.8);
      gp(ctx, (c) => { c.moveTo(x + 4, yc - half); c.lineTo(x + 4, yc + half); }, grad(rc), 2, 0.8);
      stroke(ctx, (c) => { for (let k2 = -Math.floor((half - 16) / 24); k2 * 24 < half - 16; k2++) { const yy = yc + k2 * 24, big = k2 % 4 === 0; c.moveTo(x - (big ? 18 : 13), yy); c.lineTo(x - 9, yy); c.moveTo(x + 9, yy); c.lineTo(x + (big ? 18 : 13), yy); } }, rgba(C.steel, 0.35), 1, 1);
    }
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.26 + i / 3) % 1, off = ph * half, a = Math.sin(Math.PI * ph) * e;
      glow(ctx, x - 4, yc - off, 14, lc, 0.9 * a);
      glow(ctx, x + 4, yc + off, 14, rc, 0.9 * a);
    }
  }

  function drawBadge(ctx, m, tm, t) {
    const pr = L.seg(t, tm.badge0, tm.badgeD); if (pr <= 0) return;
    GA = 1;
    const x = Math.round(m.mid), y = Math.round(m.py + m.ph / 2), sc = Math.max(0.01, L.easeOutBack(pr)), r = 54 * sc;
    const lc = m.left.color, rc = m.right.color, pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    const HW = 250, HH = 214, CS = 150;
    const halo = getLayer(m, "badgeHalo", HW, HH, (c2) => { glow(c2, HW / 2 - 18, HH / 2, 105, lc, 1); glow(c2, HW / 2 + 18, HH / 2, 105, rc, 1); });
    const core = getLayer(m, "badgeCore", CS, CS, (c2) => {
      const q = CS / 2;
      fill(c2, (c) => c.arc(q, q, 54, 0, TAU), "rgba(5,13,28,0.96)", 1);
      gp(c2, (c) => c.arc(q, q, 54, Math.PI / 2, Math.PI * 1.5), lc, 3, 1);
      gp(c2, (c) => c.arc(q, q, 54, -Math.PI / 2, Math.PI / 2), rc, 3, 1);
    });
    if (halo && core) {
      blit(ctx, halo, x - HW / 2 * sc, y - HH / 2 * sc, 0.2 + 0.1 * pulse, HW * sc, HH * sc);
      blit(ctx, core, x - CS / 2 * sc, y - CS / 2 * sc, 1, CS * sc, CS * sc);
    } else {
      glow(ctx, x - 18 * sc, y, 105 * sc, lc, 0.2 + 0.1 * pulse); glow(ctx, x + 18 * sc, y, 105 * sc, rc, 0.2 + 0.1 * pulse);
      fill(ctx, (c) => c.arc(x, y, r, 0, TAU), "rgba(5,13,28,0.96)", 1);
      gp(ctx, (c) => c.arc(x, y, r, Math.PI / 2, Math.PI * 1.5), lc, 3, 1);
      gp(ctx, (c) => c.arc(x, y, r, -Math.PI / 2, Math.PI / 2), rc, 3, 1);
    }
    const rot = t * 0.45;
    stroke(ctx, (c) => { for (let i = 0; i < 12; i++) { const a0 = rot + i * TAU / 12; c.moveTo(x + Math.cos(a0) * (r + 11), y + Math.sin(a0) * (r + 11)); c.arc(x, y, r + 11, a0, a0 + 0.24); } }, rgba(C.steel, 0.75), 1.6, 1);
    const ca = L.clamp((pr - 0.3) / 0.5);
    if (m.variant === "vs") {
      const sz = m.badgeText.length <= 2 ? 42 : m.badgeText.length <= 3 ? 32 : 24, VM = 24, vw = 100 + 2 * VM, vh = sz + 2 * VM;
      const vl = getLayer(m, "vs", vw, vh, (c2) => text(c2, m.badgeText, vw / 2, vh / 2 + sz * 0.36, { font: FONT.head, weight: 700, size: sz, align: "center", color: C.white, glow: 12, glowColor: C.cyan, letterSpacing: 1 }));
      if (vl) blit(ctx, vl, x - vw * sc / 2, y - vh * sc / 2, ca, vw * sc, vh * sc);
      else text(ctx, m.badgeText, x, y + sz * sc * 0.36, { font: FONT.head, weight: 700, size: sz * sc, align: "center", color: C.white, glow: 12, glowColor: C.cyan, letterSpacing: 1, alpha: ca });
    } else if (m.variant === "then_now") {
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.7 + i / 3) % 1, xx = x - 30 * sc + ph * 46 * sc;
        stroke(ctx, (c) => { c.moveTo(xx - 6 * sc, y - 13 * sc); c.lineTo(xx + 5 * sc, y); c.lineTo(xx - 6 * sc, y + 13 * sc); }, rc, 2.4, ca * Math.sin(Math.PI * ph) * 0.6);
      }
      const sh = Math.sin(t * 2.4) * 3 * sc;
      L.arrow(ctx, x - 26 * sc + sh, y, x + 28 * sc + sh, y, C.white, 4, 18 * sc, al(ca));
    } else {
      const paintMF = (c2, q, s2, a2) => {
        stroke(c2, (c) => { c.moveTo(q, q - 30 * s2); c.lineTo(q, q + 30 * s2); }, "rgba(255,255,255,0.3)", 1.5, a2);
        glyph(c2, "cross", q - 21 * s2, q, 30 * s2, lc, a2, 4, 1);
        glyph(c2, "tick", q + 22 * s2, q, 30 * s2, rc, a2, 4, 1);
      };
      const mf = ca >= 1 ? getLayer(m, "badgeMF", 110, 110, (c2) => paintMF(c2, 55, 1, 1)) : null;
      if (mf) blit(ctx, mf, x - 55 * sc, y - 55 * sc, 1, 110 * sc, 110 * sc);
      else { ctx.save(); ctx.translate(x - 55, y - 55); paintMF(ctx, 55, sc, ca); ctx.restore(); }
    }
  }

  function drawChip(ctx, x, y, label2, col, markKind, a) {
    const o = { font: FONT.mono, size: 19, weight: 700, letterSpacing: 4 };
    const tw = L.measure(ctx, label2, o) - 4;
    const w = tw + 28 + (markKind ? 24 : 0), h = 34;
    fill(ctx, (c) => L.roundRectPath(c, x, y, w, h, 6), rgba(col, 0.16), a);
    gp(ctx, (c) => L.roundRectPath(c, x, y, w, h, 6), rgba(col, 0.85), 1.4, 0.5, { alpha: a });
    let tx0 = x + 14;
    if (markKind) { glyph(ctx, markKind, x + 21, y + h / 2, 17, col, 1, 2.4, a); tx0 = x + 38; }
    text(ctx, label2, tx0, y + h / 2 + 7, Object.assign({ color: col, alpha: a }, o));
  }

  function drawPanel(ctx, m, tm, t, side) {
    const P = m[side], isL = side === "left", k = tm.k, geo = m.geo, pt = P.pt;
    const e = L.easeOutExpo(L.seg(t, pt.enter, tm.panelD));
    if (e <= 0.001) return;
    const x = P.x, y = m.py, w = m.pw, h = m.ph, col = P.color;
    const hiP = L.smooth(L.seg(t, tm.hi0, 0.8 * k));
    const winner = m.highlight === side, loser = m.highlight !== "none" && !winner;
    const baseA = L.clamp(e * 1.4) * (loser ? 1 - 0.2 * hiP : 1);
    ctx.save();
    try {
      let sdx = 0; // Solo: mittig stehen, mit der Einfahrt des Partners auf die eigene Seite gleiten
      if (tm.soloSide === side) sdx = (m.mid - (x + w / 2)) * (1 - L.easeInOut(L.seg(t, tm.soloUntil - tm.soloLead, tm.soloD)));
      ctx.translate(Math.round((isL ? -1 : 1) * (1 - e) * (w + 220) + sdx), 0);
      GA = baseA;
      const scaled = VEC;
      // Hintergrund, Rahmen, Eckwinkel (gecacht)
      const M = 28, tint = "rgba(" + Math.round(11 + (toRgb(col)[0] - 11) * 0.16) + "," + Math.round(28 + (toRgb(col)[1] - 28) * 0.16) + "," + Math.round(56 + (toRgb(col)[2] - 56) * 0.16) + ",0.94)";
      const chromeStrokes = (c2) => {
        gp(c2, (c) => L.roundRectPath(c, x, y, w, h, PR), rgba(col, 0.45), 1.4, 0.5);
        line(c2, x + 44, y, x + w - 44, y, col, 2.2, 1, { alpha: 0.85 });
        gp(c2, (c) => {
          const q = 24, o = 7;
          c.moveTo(x - o, y + q); c.lineTo(x - o, y - o); c.lineTo(x + q, y - o);
          c.moveTo(x + w - q, y - o); c.lineTo(x + w + o, y - o); c.lineTo(x + w + o, y + q);
          c.moveTo(x - o, y + h - q); c.lineTo(x - o, y + h + o); c.lineTo(x + q, y + h + o);
          c.moveTo(x + w - q, y + h + o); c.lineTo(x + w + o, y + h + o); c.lineTo(x + w + o, y + h - q);
        }, col, 2.2, 0.8, { alpha: 0.9 });
      };
      const chrome = scaled ? null : getLayer(m, "chrome_" + side, w + 2 * M, h + 2 * M, (c2) => {
        c2.translate(M - x, M - y);
        const hh = Math.min(h, geo.headerH + 40) / h;
        const bg = c2.createLinearGradient(0, y, 0, y + h);
        bg.addColorStop(0, tint);
        bg.addColorStop(Math.min(0.95, hh), "rgba(9,23,46,0.93)"); bg.addColorStop(1, "rgba(5,14,30,0.92)");
        fill(c2, (c) => L.roundRectPath(c, x, y, w, h, PR), bg, 1);
        if (m.variant === "myth_fact" && m.bodyOff > 24) { const r = Math.min(86, h * 0.26); glyph(c2, isL ? "cross" : "tick", x + w - r - 34, y + h - r - 26, r, col, 1, 10, 0.07); }
        chromeStrokes(c2); });
      if (chrome) blit(ctx, chrome, x - M, y - M, 1);
      else { // Kamera skaliert: Vektor-Pfad ohne großflächige Verläufe (billiger als gefilterte Blits)
        fill(ctx, (c) => L.roundRectPath(c, x, y, w, h, PR), "rgba(8,21,42,0.93)", 1);
        const th2 = Math.min(h - PR, geo.headerH + 40), nb = 10, bhb = (th2 - PR) / nb; // Tönung in Stufen statt Verlauf (Verläufe sind unter Zoom teuer)
        fill(ctx, (c) => { c.moveTo(x, y + PR); c.arcTo(x, y, x + PR, y, PR); c.lineTo(x + w - PR, y); c.arcTo(x + w, y, x + w, y + PR, PR); c.closePath(); }, rgba(col, 0.13), 1);
        for (let i = 0; i < nb; i++) fill(ctx, (c) => c.rect(x, y + PR + i * bhb, w, bhb + 0.5), rgba(col, 0.13 * (1 - (i + 0.5) / nb)), 1);
        chromeStrokes(ctx);
      }
      // Sheen (langsamer Lichtstreifen)
      const per = 7, ph = ((t + (isL ? 0 : 3.5) + 20) % per) / 1.8;
      if (ph < 1) sweep(ctx, m, "sheen", x, y, w, h, x - 160 + (w + 320) * ph, 220, "190,230,255", 0.045, 1);
      if (winner && hiP > 0) {
        gp(ctx, (c) => L.roundRectPath(c, x - 2, y - 2, w + 4, h + 4, PR + 2), col, 2.4, 1.3, { alpha: hiP * (0.5 + 0.25 * Math.sin(t * 3)) });
        const sw = L.seg(t, tm.hi0, 1.1 * k);
        if (sw > 0 && sw < 1) { const c3 = toRgb(col); sweep(ctx, m, "sweep_" + side, x, y, w, h, x - 200 + (w + 400) * L.easeInOut(sw), 280, c3[0] + "," + c3[1] + "," + c3[2], 0.13, 1); }
      }
      // Kopf: Tag-Chip + Titel + Unterstrich
      const tH = pt.enter + tm.head0 + (isL ? 0 : 0.02 * k);
      const hp = L.easeOut(L.seg(t, tH, tm.headD));
      const px0 = x + geo.padX;
      if (P.tag && hp > 0) drawChip(ctx, px0 - (1 - hp) * 20, y + geo.chipY, P.tag, col, P.tagMark, hp);
      const tp = L.easeOut(L.seg(t, tH + 0.12 * k, tm.headD));
      const tOff = geo.hasTag ? 0 : (geo.nT - P.titleLines.length) * geo.ts * 1.12;
      if (tp > 0) {
        const TM = 26, th = geo.nT * geo.ts * 1.12 + 2 * TM;
        const tl = getLayer(m, "title_" + side, geo.innerW + 2 * TM, th, (c2) => {
          P.titleLines.forEach((ln, i) => text(c2, ln, TM, TM + tOff + geo.ts * 0.8 + i * geo.ts * 1.12, { font: FONT.head, weight: 700, size: geo.ts, color: C.white, glow: 12, glowColor: col }));
        });
        if (tl) blit(ctx, tl, px0 - TM, y + geo.titleTop - TM + (1 - tp) * 14, tp);
        else P.titleLines.forEach((ln, i) => text(ctx, ln, px0, y + geo.titleTop + tOff + geo.ts * 0.8 + i * geo.ts * 1.12 + (1 - tp) * 14, { font: FONT.head, weight: 700, size: geo.ts, color: C.white, glow: 12, glowColor: col, alpha: tp }));
      }
      const ug = L.easeInOut(L.seg(t, tH + 0.25 * k, 0.8 * k));
      if (ug > 0) {
        const uy = y + geo.ulY;
        line(ctx, px0, uy, px0 + geo.innerW * ug, uy, rgba(col, 0.5), 1.4, 0.4);
        line(ctx, px0, uy, px0 + Math.min(70, geo.innerW * ug), uy, col, 3, 1);
        const gx = px0 + ((t * 0.09 + (isL ? 0 : 0.5)) % 1) * geo.innerW * ug;
        glow(ctx, gx, uy, 12, col, 0.6 * ug);
      }
      // Schema-Zeichnung
      if (P.ih > 0) {
        const ix = px0, iy = y + P.iconY, iw = geo.innerW, ihh = P.ih;
        const rv = L.easeInOut(L.seg(t, pt.tVis, tm.iconD));
        if (rv > 0) {
          ctx.save();
          try {
            ctx.beginPath(); ctx.rect(ix - 20, iy - 14, Math.round((iw + 40) * rv), ihh + 30); ctx.clip();
            const FM = 20;
            const fl = scaled ? null : getLayer(m, "frame_" + side, iw + 2 * FM, ihh + 2 * FM, (c2) => { c2.translate(FM - ix, FM - iy); drawFrame(c2, ix, iy, iw, ihh, col, P.caption, t); });
            if (fl) blit(ctx, fl, ix - FM, iy - FM, 1); else drawFrame(ctx, ix, iy, iw, ihh, col, P.caption, t);
            drawIcon(ctx, m, P, side, ix, iy, iw, ihh, t, pt);
            scanLine(ctx, ix, iy, iw, ihh, col, t, isL ? 0 : 0.5);
          } finally { ctx.restore(); }
          if (rv < 1) { const sx = ix - 20 + (iw + 40) * rv; line(ctx, sx, iy - 6, sx, iy + ihh + 6, col, 2, 1, { alpha: 0.9 }); glow(ctx, sx, iy + ihh / 2, 40, col, 0.5); }
        }
      }
      // Stichpunkte (nach vollständigem Aufdecken als eine Ebene gecacht)
      if (P.rows.length) {
        const fs = P.fs, tx0 = px0 + fs * 1.6, nR = P.rows.length;
        const strikeSide = m.strikeSide === side;
        const paintRow = (c, row, pr, struck, tt, useM) => {
          const ep = L.easeOut(pr), ry = y + row.y, dimF = row.dim ? 0.5 : 1;
          if (row.i > 0) line(c, px0, ry - P.gap / 2, px0 + geo.innerW * ep, ry - P.gap / 2, rgba(col, 0.16), 1, 0);
          if (pr < 1) {
            const bx0 = x + 10, bx1 = x + 10 + (w - 20) * ep, by0 = ry - P.gap * 0.4, bhh = row.h + P.gap * 0.8;
            const bg2 = c.createLinearGradient(bx0, 0, Math.max(bx0 + 1, bx1), 0); bg2.addColorStop(0, rgba(col, 0)); bg2.addColorStop(1, rgba(col, 0.16));
            fill(c, (q) => q.rect(bx0, by0, bx1 - bx0, bhh), bg2, 1 - pr);
            line(c, bx1, by0 + 4, bx1, by0 + bhh - 4, col, 1.5, 0.8, { alpha: 0.8 * (1 - pr) });
          }
          const ga0 = GA; GA = ga0 * (row.dim ? 0.55 : 1);
          drawMark(c, row.mark, px0 + fs * 0.5, ry + fs * 0.56, fs * 0.5, row.mcol, pr, tt, row.k, useM);
          GA = ga0;
          row.lines.forEach((ln, j) => text(c, ln, tx0 + (1 - ep) * 26, ry + fs * 0.9 + j * P.lh, { size: fs, weight: 600, font: FONT.body, color: C.white, alpha: ep * (1 - 0.3 * struck) * dimF }));
          if (struck > 0) row.lines.forEach((ln, j) => { const yy = ry + fs * 0.9 + j * P.lh - fs * 0.3; line(c, tx0 - 4, yy, tx0 - 4 + (row.widths[j] + 8) * struck, yy, C.red, 2.4, 0.6, { alpha: 0.9 }); });
        };
        const strikeOf = (row, tt) => Math.max(strikeSide ? L.easeInOut(L.seg(tt, row.sideAt, 0.5 * k)) : 0, row.strike ? L.easeInOut(L.seg(tt, row.sAt, 0.45)) : 0);
        let cached = false;
        if (t >= pt.doneT && !scaled) {
          const r0 = P.rows[0], rl = P.rows[nR - 1], RY0 = Math.floor(y + r0.y - P.gap), RH = Math.ceil(rl.y + rl.h - r0.y + 2 * P.gap);
          const lay = getLayer(m, "rows_" + side + "_" + pt.doneT.toFixed(3), w + 20, RH, (c2) => { c2.translate(10 - x, -RY0); P.rows.forEach((row) => paintRow(c2, row, 1, strikeOf(row, 1e6), 0, m)); });
          if (lay) { blit(ctx, lay, x - 10, RY0, 1); cached = true; }
        }
        if (!cached) P.rows.forEach((row) => {
          const pr = L.seg(t, row.t0, tm.bD);
          if (pr <= 0) return;
          paintRow(ctx, row, pr, strikeOf(row, t), t, m);
        });
      }
    } finally {
      GA = 1; ctx.restore();
    }
  }

  let WARNED = false;
  CE.register("comparison_split", {
    ownsText: true,
    draw(ctx, p) {
      ctx.save();
      try {
        const m = getModel(ctx, p);
        const d = Math.max(0.5, Number(p.d) || 8);
        const t = Math.max(0, Number(p.t) || 0);
        const tm = timings(m, d);
        GA = 1; VEC = isScaled(ctx);
        dust(ctx, m.W, m.H, t, 30);
        drawTextBox(ctx, m, t, d);
        drawHeading(ctx, m, tm, t);
        drawDivider(ctx, m, tm, t);
        drawPanel(ctx, m, tm, t, "left");
        drawPanel(ctx, m, tm, t, "right");
        drawBadge(ctx, m, tm, t);
      } catch (e) {
        if (!WARNED) { WARNED = true; try { console.error("[comparison_split]", e && e.message); } catch (e2) { /* ignorieren */ } }
      } finally { GA = 1; VEC = false; ctx.restore(); }
    },
  });
})();
