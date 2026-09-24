/* Template „map_or_scale“ – Größen- und Maßstabsvergleiche im Stil „Visual Science“ (Röntgen/Blueprint).

   Modi (params.mode, Standard „rope_vs_finger“):
     rope_vs_finger    Querschnitt Tragseil (≈ 10 mm) neben Fingerumriss und Münze (bzw. Bleistift), alles im gleichen
                       Maßstab über einem mm-Lineal. Objekte werden nacheinander „eingescannt“, Projektionslinien fallen
                       aufs Lineal, Bemaßungen klappen auf. Optional Kennwert-Kachel (then_readout) mit hängender Last.
                       Aliase: rope, rope_scale, size, scale, cross_section …
     building_floors   Hochhaus-Silhouette wächst Stockwerk für Stockwerk (Zähler für Stockwerke und Höhe), Höhenachse in
                       m, Stockwerksmarken, leuchtender Aufzugsschacht, Vergleichsbalken im gleichen Maßstab.
                       Aliase: building, floors, height, skyscraper, hochhaus …
     speed_comparison  Horizontale Balken wachsen nacheinander (m/s und km/h), Geschwindigkeitsschlieren im Balken laufen
                       proportional zum Wert. Aliase: speed, speeds, velocity, geschwindigkeit …
     bar_scale         Allgemeine Balken im gleichen Maßstab (z. B. 1 Mio. gegen 17.000), optional Fußnote.
     vertical_ruler    Senkrechtes Lineal an der Führungsschiene: Bremswege als Balken + weiches Band („real: …“).
     order_of_magnitude  Ein amber Punkt in einem Punktefeld, Zoom über Zehnerpotenzen bis 1 Milliarde, Ergebnis-Kachel.

   params:
     mode              s. o. (ohne mode wird aus items geraten: shape/size_mm → Seil, m/s|km/h → Geschwindigkeit …)
     items             [{ label|name, value, unit, color?, note?, … }] – je Modus:
                         rope:     { label, shape: rope_section|pencil_section|finger_outline|coin|circle, size_mm | value+unit,
                                     show_dimension (true), dim_label? }
                         building: { label, value, unit: "m" | "Stockwerke", style?: "dashed", text? }
                         speed:    { label, value, unit: "m/s" | "km/h", note? }
                         bars:     { label, value, unit?, note? }
                         vruler:   { label ("Kopf, Unterzeile" – Komma trennt), value_cm | value+unit } bzw. Band
                                   { label, style: "band", from_cm (20), to_cm (50), notes?: ["…" | {text, at}] }
     diameter_mm       Seildurchmesser (rope, Standard 10)
     then_readout      { value: "3 bis gut 4 t", label: "Bruchkraft …" } – Zahlen im Wert zählen hoch (Alias: readout)
     floors, height_m  Gebäude (Standard 102 Stockwerke / 381 m), name (optional Gebäudename)
     title / kicker    optionale Überschrift / Kennzeile oben im Bild (kicker "" blendet die Kennzeile aus)
     footnote          kleine Fußnote (bars, dots, vruler …)
     label, scope      (order_of_magnitude) Ergebnis-Text und Geltungsbereich; label "" = keine Kachel;
                       exponent (9) bzw. total; unit ("Fahrten"), unit_one (Einzahl für die Legende, sonst geraten)
     ratio             (bar_scale) true | "≈ 60 : 1" | { text, label ("Verhältnis"), items: [iGroß, iKlein], at }
     stop_cm, zero_label, cabin_label   (vertical_ruler) Haltepunkt der Kabine (Standard Bandmitte), Texte
   Text: p.text wird im Engine-Stil oben links selbst gezeichnet (ownsText) – lange Texte werden verkleinert/umbrochen.

   TIMING (Narrations-Sync): params.beats = [Sekunden ab Szenenstart] für die Hauptschritte; einzelne Einträge dürfen
   null sein (→ Standard). Listen-Einträge akzeptieren "at" (Sekunden). Alle Zeiten werden auf [0,3; d − 0,3] geklemmt.
   Ohne beats/at skaliert der Standard-Zeitplan mit p.d. Einmal Sichtbares bleibt bis Szenenende stehen.
     rope_vs_finger   BEATS: [0] = Lineal zeichnet sich ein (0), [1] = Kennwert-Kachel mit Last erscheint (bis dahin steht
                             die Objektgruppe mittig im Bild und gleitet ab beats[1] − 0,3 s mit der Kachel nach links),
                             [2] = Kennwert-Zahl erscheint/zählt hoch (spät möglich; das „t“ auf dem Gewicht kommt mit
                             dem Einheitenwort des Werts).
                      "at": items[].at = Objekt wird eingescannt; items[].dim_at = Bemaßung („Ø 8 mm“) klappt auf;
                            then_readout.at = Kachel (wie beats[1]), then_readout.value_at = Zahl (wie beats[2]).
     speed_comparison / bar_scale
                      BEATS: [0] = Achse + Raster, [1] = Fußnote, [2] = Verhältnis-Plakette (nur mit params.ratio).
                      "at": items[].at = Balken beginnt zu wachsen (Wert zählt mit); items[].label_at = Beschriftung
                            vorab (Standard at − 0,25 s). footnote_at = Fußnote (wie beats[1]).
     building_floors  BEATS: [0] = Boden + Höhenachse, [1] = Gebäude beginnt zu wachsen, [2] = Gebäude fertig
                             (Endzahlen Stockwerke/Höhe), [3] = Aufzugsschacht leuchtet auf (≥ beats[2]).
                      "at": items[].at = Vergleichsbalken wächst.
     vertical_ruler   BEATS: [0] = Schiene, Lineal, Kabine, [1] = Fangvorrichtung greift – Kabine beginnt zu rutschen,
                             [2] = Kabine steht (Ende des Rutschens), [3] = Fußnote.
                      "at": items[].at = Balken bzw. Band erscheint; Band-Notizen items[].notes = [„…“ | {text, at}]
                            (oder note/sub als ein String), footnote_at.
     order_of_magnitude
                      BEATS: [0] = Punktefeld + amber Punkt, [1] = Herauszoomen beginnt, [2] = Zoom erreicht 10^exp,
                             [3] = Ergebnis-Kachel (label + scope), [4] = Fußnote.  (keine Listen) */
(function () {
  "use strict";
  const CEX = window.CE;
  if (!CEX || typeof CEX.register !== "function") return;

  // Die Engine lädt JetBrains Mono nur in 700 vor – 400 hier anstoßen, damit CE.fontsReady (document.fonts.ready) darauf wartet
  // und das erste Bild eines Render-Chunks nicht mit Ersatzschrift gezeichnet wird.
  try { if (typeof document !== "undefined" && document.fonts && document.fonts.load) { for (const f of ['400 20px "JetBrains Mono"', '700 20px "JetBrains Mono"', '400 20px "Inter"', '600 20px "Inter"', '800 20px "Inter"', '700 20px "Oxanium"']) document.fonts.load(f).catch(() => {}); } } catch (e) { /* ohne Font-API weiter */ }

  const TAU = Math.PI * 2;
  const COL = { cyan: "#3fd2ff", amber: "#ffb347", red: "#ff5a5f", green: "#5be49b", white: "#eef6ff", muted: "#8fb3d9", steel: "#9fc4e6", navy: "#06122a" };
  const NAMED = {
    cyan: COL.cyan, blue: COL.cyan, blau: COL.cyan, info: COL.cyan,
    amber: COL.amber, orange: COL.amber, gold: COL.amber, gelb: COL.amber, warn: COL.amber, warning: COL.amber,
    red: COL.red, rot: COL.red, danger: COL.red, gefahr: COL.red, error: COL.red,
    green: COL.green, "grün": COL.green, gruen: COL.green, ok: COL.green, safe: COL.green,
    white: COL.white, "weiß": COL.white, weiss: COL.white,
    steel: COL.steel, stahl: COL.steel, grey: COL.muted, gray: COL.muted, grau: COL.muted, muted: COL.muted, neutral: COL.steel,
  };
  const F_HEAD = "Oxanium", F_BODY = "Inter", F_MONO = "JetBrains Mono";

  // ---------------------------------------------------------------- Helfer
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const seg = (x, a, dur) => clamp((x - a) / Math.max(1e-6, dur));
  const sm = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const eo = (x) => 1 - Math.pow(1 - clamp(x), 3);
  const eio = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const eob = (x) => { x = clamp(x); const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const h01 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const isObj = (o) => o !== null && typeof o === "object" && !Array.isArray(o);
  const pick = (o, keys, d) => {
    if (isObj(o)) for (const k of keys) { const v = o[k]; if (v !== undefined && v !== null && v !== "") return v; }
    return d;
  };
  const str = (v, d = "") => (v === undefined || v === null || typeof v === "object" ? d : String(v));
  /** Zahl aus Zahl oder deutschem/englischem String („1,15“, „1.000.000“, „≈ 19,8 m/s“). */
  const toNum = (v, d) => {
    if (typeof v === "string") {
      const s = v.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
      const m = s.match(/-?\d+(\.\d+)?/);
      v = m ? parseFloat(m[0]) : NaN;
    }
    const n = typeof v === "number" ? v : NaN;
    return Number.isFinite(n) ? n : d;
  };
  const toBool = (v, d) => {
    if (v === undefined || v === null || v === "") return d;
    if (typeof v === "string") return !/^(false|0|no|nein|off|aus|none|hide)$/i.test(v.trim());
    return !!v;
  };
  const colorOf = (v, d) => {
    if (typeof v !== "string") return d;
    const k = v.trim().toLowerCase();
    if (NAMED[k]) return NAMED[k];
    if (/^#[0-9a-f]{6}$/i.test(k)) return k;
    return d;
  };
  const rgba = (hex, a) => {
    if (typeof hex !== "string" || !/^#[0-9a-f]{6}$/i.test(hex)) return `rgba(63,210,255,${a})`;
    return `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
  };
  const decimalsOf = (x) => {
    const a = Math.abs(x);
    for (let k = 0; k <= 2; k++) { const f = Math.pow(10, k); if (Math.abs(Math.round(a * f) - a * f) < 1e-6 * Math.max(1, a * f)) return k; }
    return 2;
  };
  /** Deutsches Zahlenformat: Dezimalkomma, Tausenderpunkt ab 1.000. */
  const deNum = (x, dec) => {
    if (!Number.isFinite(x)) return "–";
    if (dec === undefined || dec === null) dec = decimalsOf(x);
    const neg = x < 0; const s = Math.abs(x).toFixed(dec);
    let [i, f] = s.split(".");
    if (i.length > 3) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (neg ? "−" : "") + i + (f ? "," + f : "");
  };
  /** Kompakt für Achsen: 1 Mio., 250.000, 2,5 Mrd. */
  const deCompact = (x) => {
    const a = Math.abs(x);
    if (a >= 1e9) return deNum(x / 1e9, decimalsOf(Math.round((x / 1e9) * 10) / 10) > 0 ? 1 : 0) + " Mrd.";
    if (a >= 1e6) return deNum(x / 1e6, decimalsOf(Math.round((x / 1e6) * 10) / 10) > 0 ? 1 : 0) + " Mio.";
    return deNum(x, a >= 100 ? 0 : undefined);
  };
  // ---------------------------------------------------------------- Timing (Narrations-Sync)
  /** Sekunden aus Zahl oder String („3,2“, „3.2 s“); sonst NaN. */
  const secNum = (v) => {
    if (typeof v === "number") return v;
    if (typeof v === "string") { const m = v.replace(",", ".").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; }
    return NaN;
  };
  const tClamp = (x, d) => clamp(x, Math.min(0.3, d * 0.5), Math.max(d * 0.5, d - 0.3));
  const AT_KEYS = ["at", "time", "t_at", "start_at"];
  const hasAt = (o, keys = AT_KEYS) => isObj(o) && keys.some((k) => Number.isFinite(secNum(o[k])));
  /** o.at (bzw. andere Schlüssel) → geklemmte Sekunden; sonst Default. */
  const atOf = (o, d, def, keys = AT_KEYS) => {
    if (isObj(o)) for (const k of keys) { const n = secNum(o[k]); if (Number.isFinite(n)) return tClamp(n, d); }
    return def;
  };
  /** params.beats[i] → geklemmte Sekunden; sonst Default. */
  const beatOf = (p, i, def) => {
    const b = p.beats; if (!b || i >= b.length) return def;
    const n = secNum(b[i]); return Number.isFinite(n) ? tClamp(n, p.d) : def;
  };

  const niceStep = (raw) => {
    if (!(raw > 0)) return 1;
    const e = Math.pow(10, Math.floor(Math.log10(raw)));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * e >= raw * 0.999) return m * e;
    return 10 * e;
  };

  // Text-Messung mit Cache (L.measure setzt jedes Mal Font + save/restore)
  const MCACHE = new Map();
  const fontStr = (o) => `${o.weight || 600} ${o.size || 40}px "${o.font || F_BODY}"`;
  function measure(ctx, s, o) {
    const key = fontStr(o) + "|" + (o.letterSpacing || 0) + "|" + s;
    let w = MCACHE.get(key);
    if (w === undefined) {
      ctx.save(); ctx.font = fontStr(o); if (o.letterSpacing) ctx.letterSpacing = `${o.letterSpacing}px`;
      w = ctx.measureText(s).width; ctx.restore();
      if (MCACHE.size > 3000) MCACHE.clear();
      MCACHE.set(key, w);
    }
    return w;
  }
  function wrap(ctx, s, maxW, o) {
    const words = String(s).split(/\s+/).filter(Boolean); const lines = []; let cur = "";
    for (const w of words) { const test = cur ? cur + " " + w : w; if (measure(ctx, test, o) > maxW && cur) { lines.push(cur); cur = w; } else cur = test; }
    if (cur) lines.push(cur);
    return lines;
  }
  /** Größte Schriftgröße ≤ size, bei der s in maxW passt. */
  function fitSize(ctx, s, maxW, o, minSize = 14) {
    let size = o.size || 40;
    while (size > minSize && measure(ctx, s, { ...o, size }) > maxW) size -= 2;
    return size;
  }
  function text(ctx, s, x, y, o) {
    ctx.save();
    ctx.globalAlpha = clamp(o.alpha ?? 1);
    ctx.font = fontStr(o); ctx.textAlign = o.align || "left"; ctx.textBaseline = o.baseline || "alphabetic";
    if (o.letterSpacing) ctx.letterSpacing = `${o.letterSpacing}px`;
    if (o.glow) { ctx.shadowColor = o.glowColor || o.color || COL.cyan; ctx.shadowBlur = o.glow; }
    if (o.stroke) { ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor || "rgba(2,8,20,0.9)"; ctx.lineJoin = "round"; ctx.strokeText(s, x, y); }
    ctx.fillStyle = o.color || COL.white; ctx.fillText(s, x, y);
    ctx.restore();
  }

  // ---------------------------------------------------------------- gemeinsame Bildelemente
  /** Schwebende Staubpartikel (billig: kleine Kreise, kein Verlauf). */
  function dust(ctx, p, n = 30, color = COL.cyan) {
    const { W, t } = p; const y0 = 210, hh = 700;
    ctx.save(); ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const a = h01(i * 3.1 + 1), b = h01(i * 7.7 + 2), c = h01(i * 1.3 + 3);
      const x = ((a * W + t * (5 + 9 * c)) % W + W) % W;
      const y = y0 + (((b * hh - t * (3 + 6 * a)) % hh) + hh) % hh;
      ctx.globalAlpha = 0.07 + 0.12 * (0.5 + 0.5 * Math.sin(t * (0.7 + b) + i * 1.7));
      ctx.beginPath(); ctx.arc(x, y, 0.8 + 1.5 * c, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  /** Eckwinkel eines Blueprint-Rahmens. */
  function brackets(ctx, x, y, w, h, a, len = 30) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a * 0.55; ctx.strokeStyle = COL.cyan; ctx.lineWidth = 1.6; ctx.beginPath();
    ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
    ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len);
    ctx.moveTo(x, y + h - len); ctx.lineTo(x, y + h); ctx.lineTo(x + len, y + h);
    ctx.moveTo(x + w - len, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - len);
    ctx.stroke(); ctx.restore();
  }
  /** Kennzeile (Mono, Versalien) + optionaler Titel. Gibt die y-Unterkante zurück. */
  function header(ctx, p, kick, title, a) {
    let y = 262;
    if (kick) {
      const kx = 150;
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = COL.amber; ctx.fillRect(kx, y - 15, 22, 3); ctx.restore();
      text(ctx, kick.toUpperCase(), kx + 34, y - 6, { font: F_MONO, weight: 700, size: 19, color: COL.amber, letterSpacing: 4, alpha: a });
    }
    if (title) {
      y += 42;
      const size = fitSize(ctx, title.toUpperCase(), 1640, { font: F_HEAD, weight: 700, size: 38, letterSpacing: 2 }, 24);
      text(ctx, title.toUpperCase(), 150, y, { font: F_HEAD, weight: 700, size, letterSpacing: 2, color: COL.white, glow: 12, glowColor: COL.cyan, alpha: a });
    }
    return y;
  }
  function footnote(ctx, s, x, y, a, align = "left") {
    if (!s || a <= 0) return;
    text(ctx, s, x, y, { font: F_BODY, weight: 400, size: 21, color: COL.muted, alpha: a * 0.9, align });
  }
  /** Engine-Textfeld oben links, aber lange Texte schrumpfen bzw. brechen zweizeilig um. */
  function overlayText(ctx, L, s, t, d) {
    if (!s) return;
    const a = L.env(t, 0.5, d - 0.3, 0.45); if (a <= 0) return;
    const T = String(s).toUpperCase(); const x = 90, y = 150; const maxTW = 1330;
    const o = { font: F_HEAD, weight: 700, size: 40, letterSpacing: 2 };
    let size = fitSize(ctx, T, maxTW, o, 32); let lines = [T];
    if (measure(ctx, T, { ...o, size }) > maxTW) { size = 32; lines = wrap(ctx, T, maxTW, { ...o, size }).slice(0, 2); }
    const lh = size * 1.18;
    const tw = Math.max(...lines.map((l) => measure(ctx, l, { ...o, size })));
    const w = tw + 70, top = y - 40 - 14, hBox = 74 + (lines.length - 1) * lh;
    const slide = L.easeOut(L.seg(t, 0.5, 0.5));
    ctx.save(); ctx.globalAlpha = a;
    L.fillRect(ctx, x, top, 8, hBox, COL.amber);
    L.panel(ctx, x + 14, top, w * slide, hBox, { fill: "rgba(4,12,26,0.82)", stroke: L.C.amberSoft, r: 4, alpha: a });
    const ty = top + 37 + size * 0.36 + (lines.length > 1 ? -lh * 0.02 : 0);
    lines.forEach((l, i) => text(ctx, l, x + 44, (lines.length > 1 ? top + 22 + size * 0.8 : ty) + i * lh, { ...o, size, color: COL.white, alpha: a * L.seg(t, 0.75, 0.35) }));
    ctx.restore();
  }
  /** Bemaßungspfeil (horizontal) mit Text darüber. */
  function dimLine(ctx, L, x1, x2, y, label, color, a, textA) {
    if (a <= 0) return;
    const cx = (x1 + x2) / 2; const hw = ((x2 - x1) / 2) * eo(a);
    const l = cx - hw, r = cx + hw, head = Math.min(11, Math.max(5, (x2 - x1) * 0.18));
    L.line(ctx, l, y, r, y, color, 1.8, 0.6, { alpha: a });
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(l, y); ctx.lineTo(l + head, y - head * 0.42); ctx.lineTo(l + head, y + head * 0.42); ctx.closePath();
    ctx.moveTo(r, y); ctx.lineTo(r - head, y - head * 0.42); ctx.lineTo(r - head, y + head * 0.42); ctx.closePath();
    ctx.fill(); ctx.restore();
    if (label && textA > 0) text(ctx, label, cx, y - 13, { font: F_MONO, weight: 700, size: 25, color, align: "center", alpha: textA, stroke: 5 });
  }
  /** Weiche horizontale Scanlinie (Röntgen-Scanner) an y über [x1,x2]. */
  function scanLine(ctx, x1, x2, y, color, a) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    const g = ctx.createLinearGradient(0, y - 26, 0, y + 4);
    g.addColorStop(0, rgba(color, 0)); g.addColorStop(0.85, rgba(color, 0.22)); g.addColorStop(1, rgba(color, 0.0));
    ctx.fillStyle = g; ctx.fillRect(x1, y - 26, x2 - x1, 30);
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
    ctx.globalAlpha = a * 0.35; ctx.lineWidth = 7; ctx.stroke();
    ctx.restore();
  }
  /** Zahlen in einem Text hochzählen lassen („3 bis gut 4 t“ → 0…3 / 0…4). */
  function countText(s, k) {
    if (k >= 1) return s;
    return s.replace(/\d+(?:[.,]\d+)?/g, (m) => {
      const v = toNum(m.replace(/\.(?=\d{3})/g, ""), 0);
      const dec = (m.split(/[,.]/)[1] || "").length;
      const isThousands = /\.\d{3}/.test(m) && !m.includes(",");
      return deNum(v * eo(k), isThousands ? 0 : Math.min(2, dec));
    });
  }

  /** Statische Bauteile einmal in eine Offscreen-Textur zeichnen (spart pro Frame Hunderte Pfade). */
  const TEX = new Map();
  function texture(key, w, h, paint) {
    let cv = TEX.get(key);
    if (cv) return cv;
    if (typeof document === "undefined") return null;
    cv = document.createElement("canvas"); cv.width = Math.max(1, Math.ceil(w)); cv.height = Math.max(1, Math.ceil(h));
    const g = cv.getContext("2d"); if (!g) return null;
    paint(g);
    if (TEX.size > 24) TEX.clear();
    TEX.set(key, cv); return cv;
  }

  // ================================================================ MODUS: rope_vs_finger
  const SHAPES = {
    rope: { name: "Tragseil", mm: 10, color: COL.cyan, prefix: "Ø " },
    pencil: { name: "Bleistift", mm: 7, color: COL.amber, prefix: "≈ " },
    finger: { name: "Zeigefinger", mm: 17, color: COL.steel, prefix: "≈ " },
    coin: { name: "1-Euro-Münze", mm: 23.25, color: COL.amber, prefix: "Ø " },
    circle: { name: "Objekt", mm: 10, color: COL.green, prefix: "Ø " },
  };
  function normShape(s, label) {
    const test = (x) => {
      x = String(x || "").toLowerCase();
      if (/seil|rope|cable|kabel|litze/.test(x)) return "rope";
      if (/pencil|bleistift|stift|crayon/.test(x)) return "pencil";
      if (/finger|daumen|thumb/.test(x)) return "finger";
      if (/coin|münze|muenze|euro|cent|geldst/.test(x)) return "coin";
      if (/circle|kreis|round|rund|disc|scheibe/.test(x)) return "circle";
      return "";
    };
    return test(s) || test(label) || "circle";
  }
  function scaleItem(it, P) {
    if (typeof it === "string" || typeof it === "number") it = { label: String(it) };
    if (!isObj(it)) return null;
    const label = str(pick(it, ["label", "name", "title", "text", "bezeichnung"], ""));
    const shape = normShape(pick(it, ["shape", "type", "kind", "icon", "form"], ""), label);
    const def = SHAPES[shape];
    let mm = toNum(pick(it, ["size_mm", "diameter_mm", "mm", "width_mm", "durchmesser_mm", "d_mm"]), NaN);
    if (!Number.isFinite(mm)) {
      const v = toNum(pick(it, ["value", "size", "diameter", "width", "wert"]), NaN);
      if (Number.isFinite(v)) {
        const unit = String(pick(it, ["unit", "einheit"], "mm")).toLowerCase().trim();
        mm = v * (unit.startsWith("cm") ? 10 : unit === "m" ? 1000 : /µm|um|mikro/.test(unit) ? 0.001 : 1);
      }
    }
    if (!Number.isFinite(mm) && shape === "rope") mm = toNum(pick(P, ["diameter_mm", "rope_mm", "rope_diameter_mm", "seil_mm"]), def.mm);
    if (!Number.isFinite(mm) || mm <= 0) mm = def.mm;
    mm = clamp(mm, 1, 120);
    const showDim = toBool(pick(it, ["show_dimension", "dimension", "show_dim", "bemassung"]), true);
    const dimText = str(pick(it, ["dim_label", "dimension_label", "value_label", "size_label"], "")) || def.prefix + deNum(mm) + " mm";
    return { shape, name: label || def.name, mm, showDim, dimText, color: colorOf(pick(it, ["color", "farbe"]), null), raw: it };
  }
  function parseReadout(P, items) {
    let r = pick(P, ["then_readout", "readout", "stat", "result", "kennwert"], null);
    if (r === null) return null;
    if (typeof r === "string" || typeof r === "number") r = { value: String(r) };
    if (!isObj(r)) return null;
    const value = str(pick(r, ["value", "text", "wert"], ""));
    if (!value) return null;
    const rope = items.find((i) => i.shape === "rope");
    const kick = str(pick(r, ["kicker", "title", "headline"], "")) || (rope ? `${rope.name.length > 16 ? SHAPES.rope.name : rope.name} ${rope.dimText}` : "");
    return { value, label: str(pick(r, ["label", "caption", "note", "sub"], "")), kick, unitTon: /\bt\b|tonne/i.test(value + " " + str(r.unit, "")), raw: r };
  }

  /** Seilquerschnitt 8 × 19 mit Fasereinlage (Röntgen-Stil). */
  function drawRope(ctx, L, cx, cy, R, rot, col, a) {
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(3,10,22,0.92)"; ctx.beginPath(); ctx.arc(cx, cy, R + 2, 0, TAU); ctx.fill();
    // Fasereinlage
    const rs = 0.2768 * R, Rm = R - rs, Rc = Rm - rs;
    ctx.fillStyle = "rgba(255,179,71,0.10)"; ctx.beginPath(); ctx.arc(cx, cy, Rc * 0.97, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(255,179,71,0.55)"; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = "rgba(255,200,120,0.55)";
    for (let i = 0; i < 26; i++) {
      const rr = Rc * 0.85 * Math.sqrt(h01(i * 2.3)), aa = h01(i * 5.9) * TAU + rot * 0.5;
      ctx.beginPath(); ctx.arc(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr, Math.max(0.6, R * 0.012), 0, TAU); ctx.fill();
    }
    // Litzen (1 + 6 + 12 Drähte)
    const rw = 0.2 * rs * 0.97;
    ctx.fillStyle = rgba(col, 0.13);
    ctx.beginPath();
    for (let s = 0; s < 8; s++) { const aa = rot + (s * TAU) / 8; const sx = cx + Math.cos(aa) * Rm, sy = cy + Math.sin(aa) * Rm; ctx.moveTo(sx + rs * 0.98, sy); ctx.arc(sx, sy, rs * 0.98, 0, TAU); }
    ctx.fill();
    ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = Math.max(0.8, R * 0.012);
    ctx.beginPath();
    for (let s = 0; s < 8; s++) {
      const aa = rot + (s * TAU) / 8; const sx = cx + Math.cos(aa) * Rm, sy = cy + Math.sin(aa) * Rm; const sr = aa * 1.7;
      ctx.moveTo(sx + rw, sy); ctx.arc(sx, sy, rw, 0, TAU);
      for (let k = 0; k < 6; k++) { const b = sr + (k * TAU) / 6; const wx = sx + Math.cos(b) * rs * 0.4, wy = sy + Math.sin(b) * rs * 0.4; ctx.moveTo(wx + rw, wy); ctx.arc(wx, wy, rw, 0, TAU); }
      for (let k = 0; k < 12; k++) { const b = sr + (k * TAU) / 12 + TAU / 24; const wx = sx + Math.cos(b) * rs * 0.8, wy = sy + Math.sin(b) * rs * 0.8; ctx.moveTo(wx + rw, wy); ctx.arc(wx, wy, rw, 0, TAU); }
    }
    ctx.stroke();
    ctx.restore();
    L.circle(ctx, cx, cy, R, col, 2.4, 1, { alpha: a });
  }
  /** Bleistift-Querschnitt (Sechskant, Schlüsselweite = w, Spitzen oben/unten) mit Mine. */
  function drawPencil(ctx, L, cx, cy, w, col, a, mmPerPx) {
    const Rh = w / Math.sqrt(3);
    const hex = (r) => { const pts = []; for (let k = 0; k < 6; k++) { const ang = -Math.PI / 2 + (k * Math.PI) / 3; pts.push([cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]); } return pts; };
    const P0 = hex(Rh);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(3,10,22,0.92)"; ctx.beginPath(); P0.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba(col, 0.12); ctx.fill();
    // Holzmaserung
    ctx.strokeStyle = rgba(col, 0.28); ctx.lineWidth = 1;
    for (const f of [0.42, 0.6, 0.76]) { ctx.beginPath(); ctx.arc(cx + w * 0.02, cy - w * 0.01, (w / 2) * f, 0, TAU); ctx.stroke(); }
    ctx.restore();
    L.poly(ctx, hex(Rh * 0.9), rgba(col, 0.45), 1, 0, { close: true, alpha: a });
    L.poly(ctx, P0, col, 2.2, 1, { close: true, alpha: a });
    // Mine Ø 2 mm
    const rm = Math.max(3, (2 / mmPerPx) / 2);
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = "#1a2433"; ctx.beginPath(); ctx.arc(cx, cy, rm, 0, TAU); ctx.fill();
    ctx.strokeStyle = COL.steel; ctx.lineWidth = 1.4; ctx.stroke(); ctx.restore();
  }
  /** 1-Euro-Münze (Bimetall, 12 Sterne) – ohne Motiv/Logo, nur Wertzahl. */
  function drawCoin(ctx, L, cx, cy, R, col, a) {
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(3,10,22,0.92)"; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    // Ring (Messing) und Kern (Kupfernickel)
    const gRing = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R); gRing.addColorStop(0, rgba(col, 0.05)); gRing.addColorStop(1, rgba(col, 0.13));
    ctx.fillStyle = gRing; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.arc(cx, cy, R * 0.7, 0, TAU, true); ctx.fill();
    ctx.fillStyle = "rgba(159,196,230,0.10)"; ctx.beginPath(); ctx.arc(cx, cy, R * 0.7, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(col, 0.45); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, R * 0.93, 0, TAU); ctx.stroke();
    ctx.strokeStyle = "rgba(159,196,230,0.7)"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(cx, cy, R * 0.7, 0, TAU); ctx.stroke();
    // 12 Sterne
    ctx.fillStyle = rgba(col, 0.75);
    const sr = R * 0.045;
    for (let k = 0; k < 12; k++) {
      const ang = -Math.PI / 2 + (k * TAU) / 12; const sx = cx + Math.cos(ang) * R * 0.815, sy = cy + Math.sin(ang) * R * 0.815;
      ctx.beginPath();
      for (let j = 0; j < 10; j++) { const rr = j % 2 ? sr * 0.45 : sr; const b = -Math.PI / 2 + (j * Math.PI) / 5; const px = sx + Math.cos(b) * rr, py = sy + Math.sin(b) * rr; j ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    text(ctx, "1", cx, cy + R * 0.2, { font: F_HEAD, weight: 700, size: Math.round(R * 0.62), color: "rgba(159,196,230,0.75)", align: "center", alpha: a });
    text(ctx, "EURO", cx, cy + R * 0.44, { font: F_MONO, weight: 700, size: Math.max(10, Math.round(R * 0.11)), color: "rgba(159,196,230,0.6)", align: "center", letterSpacing: 3, alpha: a });
    L.circle(ctx, cx, cy, R, col, 2.4, 1, { alpha: a });
  }
  function coinSheen(ctx, cx, cy, R, a, t) {
    const ph = ((t * 0.22) % 1.6) - 0.3;
    if (ph > -0.2 && ph < 1.2) {
      ctx.save(); ctx.globalAlpha = a * 0.5; ctx.beginPath(); ctx.arc(cx, cy, R - 2, 0, TAU); ctx.clip();
      const gx = cx - R + ph * 2 * R; const g = ctx.createLinearGradient(gx - R * 0.35, cy - R, gx + R * 0.35, cy + R);
      g.addColorStop(0, "rgba(255,230,190,0)"); g.addColorStop(0.5, "rgba(255,230,190,0.16)"); g.addColorStop(1, "rgba(255,230,190,0)");
      ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R); ctx.restore();
    }
  }
  /** Stilisierter Zeigefinger (Rückseite, Spitze oben) mit Nagel, Nagelmond und Gelenkfalten. */
  function drawFinger(ctx, L, cx, top, w, h, col, a) {
    const r = w / 2, rx = r * 0.96, ry = r * 1.18, bot = top + h;
    const outline = (c) => { c.moveTo(cx - r * 1.02, bot); c.bezierCurveTo(cx - r * 1.0, bot - h * 0.3, cx - rx, top + ry * 1.4, cx - rx, top + ry); c.ellipse(cx, top + ry, rx, ry, 0, Math.PI, TAU); c.bezierCurveTo(cx + rx, top + ry * 1.4, cx + r * 1.0, bot - h * 0.3, cx + r * 1.02, bot); };
    const fade = (alpha0, c0 = col) => { const g = ctx.createLinearGradient(0, top, 0, bot); g.addColorStop(0, rgba(c0, alpha0)); g.addColorStop(0.6, rgba(c0, alpha0)); g.addColorStop(1, rgba(c0, 0)); return g; };
    ctx.save(); ctx.globalAlpha = a;
    ctx.beginPath(); outline(ctx); ctx.closePath();
    const gF = ctx.createLinearGradient(0, top, 0, bot); gF.addColorStop(0, "rgba(3,10,22,0.92)"); gF.addColorStop(0.7, "rgba(3,10,22,0.8)"); gF.addColorStop(1, "rgba(3,10,22,0)");
    ctx.fillStyle = gF; ctx.fill();
    // Röntgen-Weichteil: heller Saum innen (vertikal ausblendend)
    ctx.clip();
    ctx.beginPath(); outline(ctx); ctx.strokeStyle = fade(0.07); ctx.lineWidth = w * 0.22; ctx.stroke();
    ctx.lineWidth = w * 0.08; ctx.strokeStyle = fade(0.08); ctx.stroke();
    ctx.restore();
    // Nagel (Breite ≈ 0,58 w, Länge ≈ 0,72 w), freier Rand folgt der Kuppe
    const nw = w * 0.29, nTop = top + w * 0.11, nSide = top + w * 0.36, nBot = top + w * 0.8;
    const nail = (c) => {
      c.moveTo(cx - nw, nBot - w * 0.05);
      c.bezierCurveTo(cx - nw * 1.04, nBot - w * 0.25, cx - nw * 1.06, nSide + w * 0.05, cx - nw, nSide);
      c.bezierCurveTo(cx - nw * 0.9, nTop + w * 0.04, cx - nw * 0.45, nTop, cx, nTop);
      c.bezierCurveTo(cx + nw * 0.45, nTop, cx + nw * 0.9, nTop + w * 0.04, cx + nw, nSide);
      c.bezierCurveTo(cx + nw * 1.06, nSide + w * 0.05, cx + nw * 1.04, nBot - w * 0.25, cx + nw, nBot - w * 0.05);
      c.bezierCurveTo(cx + nw * 0.6, nBot + w * 0.03, cx - nw * 0.6, nBot + w * 0.03, cx - nw, nBot - w * 0.05);
      c.closePath();
    };
    ctx.save(); ctx.globalAlpha = a;
    ctx.beginPath(); nail(ctx); ctx.fillStyle = rgba(col, 0.09); ctx.fill();
    // Nagelmond
    ctx.beginPath(); ctx.moveTo(cx - nw * 0.62, nBot - w * 0.035); ctx.bezierCurveTo(cx - nw * 0.5, nBot - w * 0.16, cx + nw * 0.5, nBot - w * 0.16, cx + nw * 0.62, nBot - w * 0.035);
    ctx.strokeStyle = rgba(col, 0.35); ctx.lineWidth = 1.1; ctx.stroke();
    // freier Nagelrand (weiße Linie parallel zur Kuppe)
    ctx.beginPath(); ctx.moveTo(cx - nw * 0.86, nSide - w * 0.05); ctx.bezierCurveTo(cx - nw * 0.6, nTop + w * 0.07, cx + nw * 0.6, nTop + w * 0.07, cx + nw * 0.86, nSide - w * 0.05);
    ctx.strokeStyle = rgba(col, 0.28); ctx.stroke();
    // Nagelwall / Haut um den Nagel
    ctx.beginPath(); ctx.moveTo(cx - nw * 1.25, nBot - w * 0.2); ctx.bezierCurveTo(cx - nw * 1.2, nBot + w * 0.02, cx - nw * 0.5, nBot + w * 0.1, cx, nBot + w * 0.1); ctx.bezierCurveTo(cx + nw * 0.5, nBot + w * 0.1, cx + nw * 1.2, nBot + w * 0.02, cx + nw * 1.25, nBot - w * 0.2);
    ctx.strokeStyle = rgba(col, 0.22); ctx.lineWidth = 1.2; ctx.stroke();
    // Gelenkfalten (Endgelenk)
    const yj = top + w * 1.08;
    ctx.lineWidth = 1.3;
    for (let k = 0; k < 4; k++) {
      const yy = yj + k * w * 0.05, ww = w * (0.2 - Math.abs(k - 1.5) * 0.035);
      ctx.strokeStyle = rgba(col, 0.38 - k * 0.06);
      ctx.beginPath(); ctx.moveTo(cx - ww, yy + w * 0.012); ctx.quadraticCurveTo(cx, yy - w * 0.035, cx + ww, yy + w * 0.012); ctx.stroke();
    }
    ctx.restore();
    L.glowPath(ctx, nail, rgba(col, 0.85), 1.6, 0.5, { alpha: a });
    L.glowPath(ctx, outline, fade(1), 2.4, 1, { alpha: a });
  }

  function modeRope(ctx, p) {
    const { L, t, d } = p; const P = p.params || {};
    // ---- Objekte
    const raw = Array.isArray(P.items) ? P.items : [];
    let items = raw.map((it) => scaleItem(it, P)).filter(Boolean).slice(0, 5);
    if (!items.length) {
      const dRope = clamp(toNum(pick(P, ["diameter_mm", "rope_mm", "rope_diameter_mm", "seil_mm", "size_mm"]), 10), 1, 120);
      items = [scaleItem({ shape: "rope", size_mm: dRope }, P), scaleItem({ shape: "finger" }, P), scaleItem({ shape: "coin" }, P)];
    }
    // Farben: Seil cyan, Münze amber (Messing), Finger stahl, Bleistift amber – bei Doppelung weicht der Nachrangige aus
    const used = new Set(); const spare = [COL.amber, COL.steel, COL.white, COL.green, COL.cyan];
    const prio = { rope: 0, coin: 1, finger: 2, pencil: 3, circle: 4 };
    for (const it of items.filter((i) => i.color)) used.add(it.color);
    for (const it of [...items].sort((a, b) => prio[a.shape] - prio[b.shape])) {
      if (it.color) continue;
      let c = it.color || SHAPES[it.shape].color;
      if (!it.color && used.has(c)) c = spare.find((x) => !used.has(x)) || c;
      it.color = c; used.add(c);
    }
    const ro = parseReadout(P, items);
    const n = items.length;

    // ---- Layout (gleicher Maßstab: s px/mm)
    const areaL = 165, areaR = ro ? 1310 : 1755;
    const longName = items.some((i) => measure(ctx, i.name, { font: F_BODY, weight: 600, size: 28 }) > 380);
    const objTop = longName ? 332 : 305, objBot = 716, yc = (objTop + objBot) / 2, rulerY = 792;
    for (const it of items) { it.wmm = it.mm; it.hmm = it.shape === "finger" ? it.mm * 1.32 : it.shape === "pencil" ? (it.mm * 2) / Math.sqrt(3) : it.mm; }
    const maxH = Math.max(...items.map((i) => i.hmm));
    const sumW = items.reduce((s, i) => s + i.wmm, 0);
    const gapPx = n > 3 ? 95 : 125; const padPx = 50;
    let s = Math.min(26, (objBot - objTop) / maxH, (areaR - areaL - gapPx * (n - 1) - 2 * padPx) / Math.max(1e-6, sumW));
    let pos = [], Rmm = 0;
    for (let iter = 0; iter < 4; iter++) {
      const gapMm = Math.ceil(gapPx / s), padMm = Math.max(2, Math.ceil(padPx / s));
      pos = []; let m = padMm;
      for (const it of items) { pos.push(m); m = Math.ceil(m + it.wmm + gapMm); }
      Rmm = Math.ceil((pos[n - 1] + items[n - 1].wmm + padMm) / 5) * 5;
      if (Rmm * s <= areaR - areaL + 0.5) break;
      s = (areaR - areaL) / Rmm;
    }
    const x0L = areaL + (areaR - areaL - Rmm * s) / 2;

    // ---- Zeitplan: BEATS [0] Lineal; items[].at Einscannen, items[].dim_at Bemaßung
    const tR0 = beatOf(p, 0, 0), tR1 = Math.max(0.5, Math.min(0.16 * d, 1.6));
    const span = 0.36 / n, dur = Math.max(0.16, span * 1.45);
    items.forEach((it, i) => {
      const own = hasAt(it.raw);
      it.t0 = own ? atOf(it.raw, d, 0) : (0.06 + i * span) * d;
      it.dur = own ? clamp(0.13 * d, 0.6, 1.4) : dur * d;
      it.dimDur = clamp(0.14 * d, 0.4, 0.9);
      it.tDim = atOf(it.raw, d, Math.min(it.t0 + it.dur * 0.7, d - 0.3 - it.dimDur * 0.5), ["dim_at", "dimension_at", "value_at"]);
    });
    const appear = (i) => seg(t, items[i].t0, items[i].dur);
    const dimsK = (i) => seg(t, items[i].tDim, items[i].dimDur);
    const tAll = Math.max(...items.map((it) => Math.max(it.t0 + it.dur, it.showDim ? it.tDim + it.dimDur : 0))) + Math.min(0.1 * d, 0.6);
    // Kennwert-Zeitplan (BEATS [1] Kachel, [2] Wert)
    const tileDur = clamp(0.14 * d, 0.4, 0.8), valDur = clamp(0.22 * d, 0.6, 1.3);
    let tTile = 0, tVal = 0;
    if (ro) {
      tTile = atOf(ro.raw, d, beatOf(p, 1, Math.min(Math.max(tAll - 0.05 * d, 0.5 * d), d - 0.3 - tileDur)));
      tVal = atOf(ro.raw, d, beatOf(p, 2, Math.min(Math.max(tTile + 0.35, tAll, 0.52 * d), d - 0.3 - valDur * 0.6)), ["value_at", "count_at", "number_at"]);
    }
    // Horizontale Lage: Maßstab s bleibt für die Kachel reserviert; solange die Kachel noch nicht da ist, steht die Gruppe
    // (Lineal inkl. Rand + „cm“) mittig im Bild und gleitet erst mit der Kachel in die linke Position (die Kachel fährt mit,
    // der Abstand Gruppe↔Kachel bleibt dabei konstant → keine Überlappung während des Übergangs).
    const x0C = (p.W || 1920) / 2 - (Rmm * s) / 2 - 8;
    const gStart = tTile - 0.3;
    const glide = !ro ? 1 : gStart <= 0.25 ? 1 : eio(seg(t, gStart, 0.8));
    const x0 = lerp(x0C, x0L, glide), shiftX = x0 - x0L; const X = (mm) => x0 + mm * s;

    // ---- Rahmen & Kennzeile
    const aHead = seg(t, 0, 0.5);
    brackets(ctx, 100, 222, 1720, 676, aHead);
    const kick = str(pick(P, ["kicker", "kennzeile"], "GLEICHER MASSSTAB"));
    header(ctx, p, P.kicker === "" || P.kicker === false ? "" : kick, str(pick(P, ["title", "titel", "heading"], "")), aHead);
    dust(ctx, p, 26);

    // ---- Lineal
    const rp = eio(seg(t, tR0, tR1));
    const rx1 = X(Rmm), revealX = lerp(x0 - 20, rx1 + 36, rp);
    if (rp > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(x0 - 24, rulerY - 4, revealX + 30 - (x0 - 24), 70); ctx.clip();
      ctx.fillStyle = "rgba(10,28,54,0.72)"; ctx.fillRect(x0 - 20, rulerY, rx1 - x0 + 56, 60);
      ctx.strokeStyle = "rgba(63,210,255,0.35)"; ctx.lineWidth = 1.2; ctx.strokeRect(x0 - 20 + 0.5, rulerY + 0.5, rx1 - x0 + 56, 60);
      // Markierungsbänder der Objekte
      items.forEach((it, i) => {
        const k = dimsK(i); if (k <= 0) return;
        const a0 = X(pos[i]), a1 = X(pos[i] + it.wmm);
        const gb = ctx.createLinearGradient(0, rulerY, 0, rulerY + 60); gb.addColorStop(0, rgba(it.color, 0.26 * k)); gb.addColorStop(1, rgba(it.color, 0.02 * k));
        ctx.fillStyle = gb; ctx.fillRect(a0, rulerY + 1, a1 - a0, 59);
      });
      // Teilstriche
      const tick = (cond, len, style, lw) => { ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.beginPath(); for (let mm = 0; mm <= Rmm; mm++) { if (!cond(mm)) continue; const x = Math.round(X(mm)) + 0.5; ctx.moveTo(x, rulerY); ctx.lineTo(x, rulerY + len); } ctx.stroke(); };
      if (s >= 5) tick((mm) => mm % 5 !== 0, 11, "rgba(63,210,255,0.55)", 1);
      tick((mm) => mm % 5 === 0 && mm % 10 !== 0, 18, "rgba(63,210,255,0.8)", 1.3);
      tick((mm) => mm % 10 === 0, 27, COL.cyan, 1.8);
      for (let mm = 0; mm <= Rmm; mm += 10) text(ctx, String(mm / 10), X(mm), rulerY + 50, { font: F_MONO, weight: 700, size: 19, color: COL.cyan, align: "center" });
      text(ctx, "cm", X(Rmm) + 12, rulerY + 50, { font: F_MONO, weight: 400, size: 16, color: COL.muted, align: "left" });
      // Scanner-Lichtpunkt läuft über das Lineal
      const sp = ((t * 0.18) % 1.25); if (sp < 1 && rp >= 1) { const sx = lerp(x0, rx1, sp); const g = ctx.createLinearGradient(sx - 60, 0, sx + 6, 0); g.addColorStop(0, "rgba(63,210,255,0)"); g.addColorStop(1, "rgba(63,210,255,0.16)"); ctx.fillStyle = g; ctx.fillRect(sx - 60, rulerY + 1, 66, 59); }
      ctx.restore();
      L.line(ctx, x0 - 20, rulerY, revealX, rulerY, COL.cyan, 2, 1);
      items.forEach((it, i) => { const k = dimsK(i); if (k > 0) L.line(ctx, X(pos[i]), rulerY, X(pos[i]) + it.wmm * s * eo(k), rulerY, it.color, 3.2, 1, { alpha: k }); });
    }

    // ---- Objekte
    const rot = t * 0.16; const names = [];
    items.forEach((it, i) => {
      const e = appear(i); if (e <= 0) return;
      const w = it.wmm * s, hh = it.hmm * s; const cx = X(pos[i]) + w / 2;
      const top = it.shape === "finger" ? yc - hh / 2 : yc - hh / 2; const bot = top + hh;
      const k = dimsK(i);
      // Projektionslinien
      if (k > 0) {
        const yEdge = it.shape === "finger" ? bot - hh * 0.25 : yc;
        const yEnd = lerp(yEdge, rulerY, eo(k));
        for (const ex of [X(pos[i]), X(pos[i] + it.wmm)]) L.line(ctx, ex, yEdge, ex, yEnd, it.color, 1.2, 0.3, { alpha: 0.6 * k, dash: [6, 6] });
        if (it.showDim) dimLine(ctx, L, X(pos[i]), X(pos[i] + it.wmm), rulerY - 40, it.dimText, it.color, seg(k, 0.35, 0.65), seg(k, 0.55, 0.45));
      }
      // Objekt, per Scanlinie von oben eingeblendet
      const pad = 16; const revY = lerp(top - pad, bot + pad, eio(e));
      ctx.save(); ctx.beginPath(); ctx.rect(cx - w / 2 - 40, top - 40, w + 80, revY - (top - 40)); ctx.clip();
      const alpha = 0.35 + 0.65 * e;
      if (it.shape === "rope") {
        const R = w / 2; const S = Math.ceil(R * 2 + 60);
        if (e >= 1) L.glowDot(ctx, cx, yc, R * 1.9, "rgba(63,210,255,0.14)", 0.8 + 0.2 * Math.sin(t * 2));
        const cv = texture(`rope|${Math.round(R * 10)}|${it.color}`, S, S, (g) => drawRope(g, L, S / 2, S / 2, R, 0, it.color, 1));
        if (cv) { ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, yc); ctx.rotate(rot); ctx.drawImage(cv, -S / 2, -S / 2); ctx.restore(); }
        else drawRope(ctx, L, cx, yc, R, rot, it.color, alpha);
      } else if (it.shape === "pencil") drawPencil(ctx, L, cx, yc, w, it.color, alpha, 1 / s);
      else if (it.shape === "coin") {
        const R = w / 2; const S = Math.ceil(R * 2 + 60);
        const cv = texture(`coin|${Math.round(R * 10)}|${it.color}`, S, S, (g) => drawCoin(g, L, S / 2, S / 2, R, it.color, 1));
        if (cv) { ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(cv, cx - S / 2, yc - S / 2); ctx.restore(); }
        else drawCoin(ctx, L, cx, yc, R, it.color, alpha);
        coinSheen(ctx, cx, yc, R, alpha, t);
      } else if (it.shape === "finger") {
        const Wc = Math.ceil(w + 80), Hc = Math.ceil(hh + 80);
        const cv = texture(`finger|${Math.round(w * 10)}|${Math.round(hh * 10)}|${it.color}`, Wc, Hc, (g) => drawFinger(g, L, Wc / 2, 40, w, hh, it.color, 1));
        if (cv) { ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(cv, cx - Wc / 2, top - 40); ctx.restore(); }
        else drawFinger(ctx, L, cx, top, w, hh, it.color, alpha);
      }
      else {
        ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = rgba(it.color, 0.1); ctx.beginPath(); ctx.arc(cx, yc, w / 2, 0, TAU); ctx.fill(); ctx.restore();
        L.circle(ctx, cx, yc, w / 2, it.color, 2.2, 1, { alpha });
      }
      ctx.restore();
      if (e < 1) scanLine(ctx, cx - w / 2 - 24, cx + w / 2 + 24, revY, it.color, Math.sin(Math.PI * e));
      // Name über dem Objekt (wird nach allen Objekten gezeichnet)
      const na = seg(e, 0.35, 0.5);
      if (na > 0) names.push({ it, cx, top, w, na });
    });
    const centers = items.map((it, i) => X(pos[i]) + (it.wmm * s) / 2);
    for (const { it, cx, top, na } of names) {
      const i = items.indexOf(it);
      const leftB = i === 0 ? x0 - 40 : (centers[i - 1] + cx) / 2, rightB = i === n - 1 ? (ro ? Math.min(1800, 1335 + shiftX) : 1800) : (cx + centers[i + 1]) / 2;
      const maxW = clamp(2 * Math.min(cx - leftB, rightB - cx) - 18, 120, 420);
      const maxLines = it.hmm >= maxH * 0.9 ? 2 : 3;
      const o = { font: F_BODY, weight: 600, size: 28 };
      let lines = [it.name], size = 28;
      if (measure(ctx, it.name, o) > maxW) {
        size = 24; lines = wrap(ctx, it.name, maxW, { ...o, size });
        if (lines.length > maxLines) { size = 20; lines = wrap(ctx, it.name, maxW, { ...o, size }); }
        if (lines.length > maxLines) lines = [...lines.slice(0, maxLines - 1), lines.slice(maxLines - 1).join(" ")];
        for (const l of lines) size = Math.min(size, fitSize(ctx, l, maxW, { ...o, size }, 18));
      }
      const lh = size * 1.18; const by = top - 22 + (1 - eo(na)) * 10;
      lines.forEach((l, j) => text(ctx, l, cx, by - (lines.length - 1 - j) * lh, { ...o, size, color: COL.white, align: "center", alpha: na, stroke: 5 }));
    }

    // ---- Hervorhebung Seil (nach allen Objekten): pulsierender Ring
    const ropeIdx = items.findIndex((i) => i.shape === "rope");
    if (ropeIdx >= 0 && t > tAll) {
      const it = items[ropeIdx]; const R = (it.wmm * s) / 2; const cx = X(pos[ropeIdx]) + R;
      const k = seg(t, tAll, 0.6); const ph = ((t - tAll) * 0.7) % 1;
      L.circle(ctx, cx, yc, R + 10 + ph * 26, it.color, 1.5, 0.5, { alpha: k * (1 - ph) * 0.6 });
      L.arc(ctx, cx, yc, R + 9, -Math.PI * 0.5 + t * 0.6, -Math.PI * 0.1 + t * 0.6, it.color, 2, 0.8, { alpha: k * 0.8 });
      L.arc(ctx, cx, yc, R + 9, Math.PI * 0.5 + t * 0.6, Math.PI * 0.9 + t * 0.6, it.color, 2, 0.8, { alpha: k * 0.8 });
    }

    // ---- Kennwert-Kachel (then_readout)
    if (ro) {
      const nl = ro.label ? Math.min(3, wrap(ctx, ro.label, 360, { font: F_BODY, weight: 400, size: 25 }).length) : 0;
      const ph = 290 + nl * 32; const py = clamp(yc - ph / 2, 290, 740 - ph);
      const k = seg(t, tTile, tileDur); if (k > 0) drawReadout(ctx, L, p, ro, Math.min(1350 + shiftX, 1390), py, 420, ph, k, seg(t, tVal, valDur));
    }
  }

  /** Kachel mit hängender Last und hochzählendem Kennwert. */
  function drawReadout(ctx, L, p, ro, x, y, w, h, k, cnt) {
    const { t } = p; const a = eo(k);
    const yy = y + (1 - a) * 24;
    L.panel(ctx, x, yy, w, h, { alpha: a, fill: "rgba(5,14,30,0.86)", stroke: L.C.amberSoft, r: 10 });
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = COL.amber; ctx.fillRect(x, yy + 14, 5, h - 28); ctx.restore();
    const ix = x + 34;
    if (ro.kick) {
      let kk = ro.kick.toUpperCase(); const ko = { font: F_MONO, weight: 700, size: 18, letterSpacing: 3 };
      const ks = fitSize(ctx, kk, w - 60, ko, 13);
      while (kk.length > 4 && measure(ctx, kk, { ...ko, size: ks }) > w - 60) kk = kk.slice(0, -2).trimEnd() + "…";
      text(ctx, kk, ix, yy + 46, { ...ko, size: ks, color: COL.cyan, alpha: a });
    }
    // hängende Last (Seil → Schäkel → Gewicht), leichtes Pendeln
    const ax = x + w / 2, ay = yy + 66;
    const drop = eob(seg(cnt, 0, 0.45));
    const ang = (0.12 * Math.exp(-3 * seg(cnt, 0.2, 1)) + 0.025) * Math.sin(p.t * 2.4);
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang); ctx.globalAlpha = a;
    const ropeLen = 34 + 26 * drop;
    L.line(ctx, 0, 0, 0, ropeLen, COL.cyan, 3, 1, { alpha: a });
    ctx.strokeStyle = COL.steel; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, ropeLen + 8, 8, -Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
    const wy = ropeLen + 16, ww = 118, wh = 62;
    ctx.beginPath(); ctx.moveTo(-ww * 0.36, wy); ctx.lineTo(ww * 0.36, wy); ctx.lineTo(ww / 2, wy + wh); ctx.lineTo(-ww / 2, wy + wh); ctx.closePath();
    ctx.fillStyle = "rgba(255,179,71,0.14)"; ctx.fill(); ctx.strokeStyle = COL.amber; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang);
    // Einheit auf dem Gewicht: „t“ erst mit dem gesprochenen Wert (bei Wort-für-Wort-Aufdeckung mit dem Einheitenwort)
    let ua = 1;
    if (ro.unitTon) {
      const nums = ro.value.match(/\d+(?:[.,]\d+)?/g) || [];
      if (nums.length > 1) {
        const ws = ro.value.split(/\s+/).filter(Boolean); let ui = ws.findIndex((w) => /^t\.?$|^tonne/i.test(w)); if (ui < 0) ui = ws.length - 1;
        ua = seg(cnt, ui / ws.length, 0.8 / ws.length);
      } else ua = seg(cnt, 0, 0.25);
    }
    if (ua > 0) text(ctx, ro.unitTon ? "t" : "F", 0, ropeLen + 16 + 45 + (1 - eo(ua)) * 8, { font: F_HEAD, weight: 700, size: 32, color: COL.amber, align: "center", alpha: a * ua, glow: ua < 1 ? 14 * ua : 0 });
    ctx.restore();
    // Wert – erst zum Beat; vorher gestrichelter Platzhalter mit blinkendem Cursor
    const vo = { font: F_MONO, weight: 700, size: fitSize(ctx, ro.value, w - 60, { font: F_MONO, weight: 700, size: 56 }, 26) };
    const vy = yy + 262;
    if (cnt <= 0) {
      const pw = Math.min(w - 68, measure(ctx, ro.value, vo));
      ctx.save(); ctx.globalAlpha = a * 0.4; ctx.strokeStyle = COL.amber; ctx.lineWidth = 2; ctx.setLineDash([10, 9]);
      ctx.beginPath(); ctx.moveTo(ix, vy + 10); ctx.lineTo(ix + pw, vy + 10); ctx.stroke(); ctx.restore();
      if (Math.sin(t * 7) > -0.2) { ctx.save(); ctx.globalAlpha = a * 0.75; ctx.fillStyle = COL.amber; ctx.fillRect(ix, vy - vo.size * 0.72, 4, vo.size * 0.8); ctx.restore(); }
    } else drawValue(ctx, ro.value, cnt, ix, vy, { ...vo, color: COL.amber, glow: 18, glowColor: COL.amber }, a);
    if (ro.label) {
      const lines = wrap(ctx, ro.label, w - 60, { font: F_BODY, weight: 400, size: 25 }).slice(0, 3);
      lines.forEach((l, i) => text(ctx, l, ix, yy + 304 + i * 32, { font: F_BODY, weight: 400, size: 25, color: "rgba(238,246,255,0.86)", alpha: a * seg(k, 0.45, 0.55) }));
    }
  }
  /** Kennwert zeichnen: eine Zahl zählt hoch; mehrere Zahlen („3 bis gut 4 t“) werden Wort für Wort aufgedeckt. */
  function drawValue(ctx, s, k, x, y, o, alpha) {
    const nums = s.match(/\d+(?:[.,]\d+)?/g) || [];
    if (nums.length <= 1 || k >= 1) { text(ctx, countText(s, k), x, y, { ...o, alpha: alpha * clamp(k * 3) }); return; }
    const words = s.split(/\s+/).filter(Boolean); const n = words.length;
    const pos = k * n; const m = Math.min(n, Math.floor(pos) + 1); const frac = clamp(pos - (m - 1));
    let xx = x;
    for (let i = 0; i < m; i++) {
      const wa = i < m - 1 ? 1 : eo(clamp(frac * 2.2));
      text(ctx, words[i], xx, y + (1 - wa) * 10, { ...o, alpha: alpha * wa });
      xx += measure(ctx, words[i] + " ", o);
    }
  }

  // ================================================================ MODUS: speed_comparison / bar_scale
  const SPEED_DEFAULT = [
    { label: "Nenngeschwindigkeit Aufzug", value: 1, unit: "m/s", note: "typisch im Wohnhaus" },
    { label: "Auslösegeschwindigkeit", value: 1.15, unit: "m/s", note: "Geschwindigkeitsbegrenzer, mind. 115 %" },
    { label: "Auto in der Stadt", value: 13.9, unit: "m/s", note: "innerorts" },
    { label: "Freier Fall nach 20 m", value: 19.8, unit: "m/s", note: "rechnerisch, ohne Luftwiderstand" },
  ];
  const BAR_DEFAULT = [
    { label: "Treppe: über 1 Mio.", value: 1000000, color: "red" },
    { label: "Aufzüge und Fahrtreppen: rund 17.000", value: 17000, color: "cyan" },
  ];
  function autoColor(label, i) {
    const s = String(label).toLowerCase();
    if (/fall\b|freier fall|absturz|sturz|aufprall|crash|\btod|unfall|gefahr/.test(s)) return COL.red;
    if (/aufzug|aufzüg|lift|elevator|kabine|fahrtreppe|rolltreppe|escalator/.test(s)) return COL.cyan;
    if (/auslös|begrenzer|fang|grenz|max|treppe|stair/.test(s)) return COL.amber;
    if (/\bauto|\bpkw|\bstadt|fahrrad|fußg|fussg|mensch|\bzug\b|\bbahn|läufer|laeufer|sprinter|gehen|radfahr/.test(s)) return COL.steel;
    return [COL.cyan, COL.amber, COL.steel, COL.green, COL.cyan, COL.amber, COL.steel][i % 7];
  }
  function barItems(P, kind) {
    let raw = Array.isArray(P.items) ? P.items : null;
    if (!raw || !raw.length) raw = kind === "speed" ? SPEED_DEFAULT : BAR_DEFAULT;
    const out = [];
    raw.slice(0, 7).forEach((it, i) => {
      if (typeof it === "number") it = { value: it };
      if (!isObj(it)) return;
      let v = toNum(pick(it, ["value", "wert", "speed", "v", "amount", "count"]), NaN);
      const label = str(pick(it, ["label", "name", "title", "text"], ""));
      if (!Number.isFinite(v)) v = toNum(label, NaN);
      if (!Number.isFinite(v)) return;
      let unit = str(pick(it, ["unit", "einheit"], kind === "speed" ? "m/s" : "")).trim();
      let base = v;
      if (kind === "speed") {
        const u = unit.toLowerCase().replace(/\s/g, "");
        if (u === "km/h" || u === "kmh" || u === "kph") base = v / 3.6;
        else if (u === "mph") base = v * 0.44704;
        else if (!u) unit = "m/s";
      }
      out.push({ label: label || deNum(v), value: v, base: Math.max(0, base), unit, note: str(pick(it, ["note", "sub", "hint", "hinweis", "detail"], "")),
        color: colorOf(pick(it, ["color", "farbe"]), null) || autoColor(label, i), valueText: str(pick(it, ["value_label", "value_text", "display"], "")), raw: it });
    });
    if (!out.length) return barItems({}, kind);
    return out;
  }
  function speedTexts(it) {
    const u = it.unit.toLowerCase().replace(/\s/g, "");
    if (it.valueText) return [it.valueText, ""];
    if (u === "km/h" || u === "kmh") { const ms = it.value / 3.6; return [`${deNum(it.value)} km/h`, `${Math.abs(ms - Math.round(ms * 10) / 10) < 1e-6 ? "" : "≈ "}${deNum(ms, ms >= 10 ? 0 : 1)} m/s`]; }
    const kmh = it.base * 3.6; const dec = kmh >= 10 ? 0 : 1; const r = Math.round(kmh * Math.pow(10, dec)) / Math.pow(10, dec);
    return [`${deNum(it.value)} ${it.unit || "m/s"}`, `${Math.abs(r - kmh) < 1e-6 ? "" : "≈ "}${deNum(r, dec)} km/h`];
  }

  function modeBars(ctx, p, kind) {
    const { L, t, d } = p; const P = p.params || {};
    const items = barItems(P, kind); const n = items.length;
    const speed = kind === "speed";
    const aHead = seg(t, 0, 0.5);
    brackets(ctx, 100, 222, 1720, 676, aHead);
    const kickDef = speed ? "GESCHWINDIGKEIT · IN M/S UND KM/H" : "GLEICHER MASSSTAB";
    const kick = P.kicker === "" || P.kicker === false ? "" : str(pick(P, ["kicker", "kennzeile"], kickDef));
    const hy = header(ctx, p, kick, str(pick(P, ["title", "titel", "heading"], "")), aHead);
    dust(ctx, p, 24);
    const foot = str(pick(P, ["footnote", "fussnote", "fußnote", "source", "quelle", "note"], ""));

    // Geometrie
    const top0 = hy + 34, axisY = foot ? 800 : 812;
    const rowH = Math.min(n <= 2 ? 190 : 150, (axisY - top0 - 12) / n);
    const top = top0 + Math.max(0, (axisY - top0 - 12 - rowH * n) / 2) - (n <= 2 ? 10 : 0);
    const barH = clamp(rowH * 0.36, 16, 56);
    const x0 = 165;
    const texts = items.map((it) => (speed ? speedTexts(it) : [it.valueText || (/\d/.test(it.label) ? "" : `${deNum(it.value)}${it.unit ? " " + it.unit : ""}`), ""]));
    const vSize = clamp(barH * 0.82, 22, 34);
    const tW = Math.max(60, ...texts.map((tx) => measure(ctx, tx[0], { font: F_MONO, weight: 700, size: vSize }) + (tx[1] ? 18 + measure(ctx, tx[1], { font: F_BODY, weight: 600, size: vSize * 0.72 }) : 0)));
    const maxB = Math.max(1e-9, ...items.map((i) => i.base));
    const step = niceStep(maxB / 4); const niceMax = Math.ceil(maxB / step - 1e-9) * step;
    const x1 = clamp(1770 - tW - 36, 900, 1540);
    const XV = (v) => x0 + (v / niceMax) * (x1 - x0);

    // Zeitplan: Balken wachsen nacheinander (BEATS [0] Achse, [1] Fußnote, [2] Verhältnis; items[].at Wachstum)
    const spanU = 0.5 / n, growU = Math.max(0.14, spanU * 1.25);
    items.forEach((it, i) => {
      const own = hasAt(it.raw);
      it.tg = own ? atOf(it.raw, d, 0) : (0.1 + i * spanU) * d + 0.1;
      it.gd = own ? clamp(0.14 * d, 0.5, 1.2) : Math.min(growU * d, 2.2);
      it.tl = Math.min(it.tg - 0.1, atOf(it.raw, d, it.tg - 0.25, ["label_at"]));
    });
    const start = (i) => items[i].tg - 0.1;

    // Raster + Achse
    const ga = seg(t, beatOf(p, 0, 0.05 * d), 0.4);
    if (ga > 0) {
      ctx.save(); ctx.globalAlpha = ga; ctx.strokeStyle = "rgba(143,179,217,0.16)"; ctx.lineWidth = 1; ctx.setLineDash([4, 7]);
      ctx.beginPath(); for (let v = step; v <= niceMax + 1e-9; v += step) { const x = Math.round(XV(v)) + 0.5; ctx.moveTo(x, top - 6); ctx.lineTo(x, axisY); } ctx.stroke(); ctx.restore();
      L.line(ctx, x0, axisY, lerp(x0, x1, eo(ga)), axisY, COL.muted, 1.6, 0.3, { alpha: ga });
      L.line(ctx, x0, axisY - 14, x0, axisY, COL.muted, 1.6, 0.3, { alpha: ga });
      for (let v = 0; v <= niceMax + 1e-9; v += step) {
        const x = XV(v);
        L.line(ctx, x, axisY, x, axisY + 8, COL.muted, 1.4, 0, { alpha: ga });
        text(ctx, speed ? deNum(v) : deCompact(v), x, axisY + 34, { font: F_MONO, weight: 400, size: 20, color: COL.muted, align: "center", alpha: ga });
        if (speed) text(ctx, deNum(v * 3.6, v * 3.6 >= 10 || v === 0 ? 0 : 1), x, axisY + 60, { font: F_MONO, weight: 400, size: 17, color: "rgba(143,179,217,0.6)", align: "center", alpha: ga });
      }
      if (speed) {
        text(ctx, "m/s", x1 + 26, axisY + 34, { font: F_MONO, weight: 700, size: 18, color: COL.muted, alpha: ga });
        text(ctx, "km/h", x1 + 26, axisY + 60, { font: F_MONO, weight: 400, size: 16, color: "rgba(143,179,217,0.6)", alpha: ga });
      } else {
        const unit = items.find((i) => i.unit)?.unit || "";
        if (unit) text(ctx, unit, x1 + 26, axisY + 34, { font: F_MONO, weight: 700, size: 18, color: COL.muted, alpha: ga });
      }
    }
    if (foot) footnote(ctx, foot, x0, axisY + (speed ? 92 : 72), seg(t, atOf(P, d, beatOf(p, 1, Math.min(0.6 * d, d - 0.9)), ["footnote_at", "fussnote_at"]), 0.5));

    // Zeilen
    items.forEach((it, i) => {
      const ts = start(i); const la = seg(t, it.tl, 0.45); if (la <= 0) return;
      const g = eo(seg(t, it.tg, it.gd));
      const cy = top + rowH * (i + 0.5) + rowH * 0.16; const by = cy - barH / 2;
      const col = it.color;
      // Label + Hinweis
      const ly = by - 13;
      const lbl = it.label;
      const lsize = fitSize(ctx, lbl, 1760 - x0, { font: F_BODY, weight: 600, size: clamp(rowH * 0.24, 20, 30) }, 16);
      const lw = measure(ctx, lbl, { font: F_BODY, weight: 600, size: lsize });
      text(ctx, lbl, x0 + (1 - eo(la)) * -14, ly, { font: F_BODY, weight: 600, size: lsize, color: COL.white, alpha: la });
      if (it.note) {
        const nx = x0 + lw + 16; const maxNW = 1770 - nx; const nt = "·  " + it.note;
        const nsize = fitSize(ctx, nt, maxNW, { font: F_BODY, weight: 400, size: Math.round(lsize * 0.78) }, 15);
        if (measure(ctx, nt, { font: F_BODY, weight: 400, size: nsize }) <= maxNW) text(ctx, nt, nx, ly, { font: F_BODY, weight: 400, size: nsize, color: COL.muted, alpha: la * seg(t, ts + 0.1, 0.5) });
      }
      // Balken
      const bw = Math.max(0, (XV(it.base) - x0) * g); const minVis = 4;
      const rr = Math.min(barH / 2, 8);
      ctx.save(); ctx.globalAlpha = la;
      ctx.fillStyle = "rgba(143,179,217,0.05)"; ctx.fillRect(x0, by, x1 - x0, barH);
      ctx.restore();
      if (g > 0) {
        const wv = Math.max(minVis, bw);
        const gr = ctx.createLinearGradient(x0, 0, x0 + wv, 0); gr.addColorStop(0, rgba(col, 0.12)); gr.addColorStop(1, rgba(col, 0.5));
        ctx.save(); ctx.beginPath(); L.roundRectPath(ctx, x0, by, wv, barH, Math.min(rr, wv / 2)); ctx.fillStyle = gr; ctx.fill(); ctx.clip();
        // Chevrons laufen mit Tempo proportional zum Wert (≤ 0,4 Abstand pro Frame gegen Stroboskop-Effekt)
        const spacing = Math.max(30, barH * 0.95);
        const kPx = speed ? Math.min(34, (spacing * 0.4 * 30) / maxB) : 0; const spx = speed ? Math.max(8, it.base * kPx) : 36;
        const off = (t * spx) % spacing; const ch = barH * 0.26;
        ctx.strokeStyle = rgba(col === COL.steel ? COL.white : col, 0.34); ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round";
        ctx.beginPath();
        for (let x = x0 - spacing + off; x < x0 + wv + spacing; x += spacing) { ctx.moveTo(x - ch, by + barH * 0.24); ctx.lineTo(x, cy); ctx.lineTo(x - ch, by + barH * 0.76); }
        ctx.stroke();
        ctx.restore();
        L.glowPath(ctx, (c) => L.roundRectPath(c, x0, by, wv, barH, Math.min(rr, wv / 2)), col, 2, 0.9);
        // Spitze
        const tipX = x0 + wv; const pul = 0.75 + 0.25 * Math.sin(t * 5 + i);
        L.line(ctx, tipX, by - 4, tipX, by + barH + 4, col, 3, 1, { alpha: pul });
        if (g < 1) L.glowDot(ctx, tipX, cy, 34, col, 0.8);
        // Werte
        const [v1, v2] = texts[i];
        const cntV = it.value * g;
        let v1s = v1;
        if (g < 1 && v1 && !it.valueText) v1s = v1.replace(/^[\d.,−-]+/, deNum(cntV, decimalsOf(it.value)));
        const vx = tipX + 20; const va = seg(g, 0.05, 0.3);
        if (v1s) text(ctx, v1s, vx, cy + vSize * 0.36, { font: F_MONO, weight: 700, size: vSize, color: col === COL.steel ? COL.white : col, alpha: va, glow: col === COL.red ? 14 : 0, glowColor: col });
        if (v2) text(ctx, v2, vx + measure(ctx, v1, { font: F_MONO, weight: 700, size: vSize }) + 18, cy + vSize * 0.36, { font: F_BODY, weight: 600, size: vSize * 0.72, color: COL.muted, alpha: va * seg(g, 0.5, 0.5) });
        // Blitz beim Erreichen des Endwerts
        const fl = seg(t, it.tg + it.gd, 0.5);
        if (fl > 0 && fl < 1) L.circle(ctx, tipX, cy, 10 + 40 * eo(fl), col, 2, 0.8, { alpha: (1 - fl) * 0.8 });
        // winzige Balken: dauerhaft pulsierender Markierungsring, damit sie nicht übersehen werden
        if (g >= 1 && wv < 44) { const ph = ((t - ts) * 0.8) % 1; L.circle(ctx, x0 + wv / 2, cy, barH * 0.75 + ph * 30, col, 1.6, 0.6, { alpha: (1 - ph) * 0.8 }); }
      }
      it.geo = { cy, tipX: x0 + Math.max(4, (XV(it.base) - x0)), barH };
    });

    // Verhältnis-Plakette (optional): params.ratio = true | "≈ 59 : 1" | { text, label, at }
    const ratioP = pick(P, ["ratio", "verhaeltnis", "verhältnis"], null);
    if (!speed && n >= 2 && ratioP !== null && ratioP !== false && toBool(ratioP, true)) {
      const sorted = [...items].sort((a, b) => b.base - a.base); let big = sorted[0], small = sorted[n - 1];
      const pair = isObj(ratioP) && Array.isArray(ratioP.items) ? ratioP.items.map((x) => Math.round(toNum(x, -1))) : null;
      if (pair && pair.length >= 2 && items[pair[0]] && items[pair[1]]) { big = items[pair[0]]; small = items[pair[1]]; }
      let rt = typeof ratioP === "string" && !/^(true|1|ja|yes|on)$/i.test(ratioP.trim()) ? ratioP : isObj(ratioP) ? str(pick(ratioP, ["text", "value"], "")) : "";
      if (!rt && small.base > 0) { const r = big.base / small.base; rt = `≈ ${deNum(r, r >= 10 ? 0 : 1)} : 1`; }
      const rl = isObj(ratioP) ? str(pick(ratioP, ["label", "caption"], "Verhältnis")) : "Verhältnis";
      const tEnd = Math.max(...items.map((i) => i.tg + i.gd));
      const tr = atOf(isObj(ratioP) ? ratioP : null, d, beatOf(p, 2, Math.min(tEnd + 0.3, d - 0.9)));
      const k = seg(t, tr, 0.5);
      if (rt && k > 0 && small.geo) {
        const ro = { font: F_BODY, weight: 800, size: 38 }; const lo = { font: F_MONO, weight: 700, size: 15, letterSpacing: 3 };
        const pw = Math.max(measure(ctx, rt, ro), measure(ctx, rl.toUpperCase(), lo)) + 56, ph = 92;
        const px = x1 - pw, py = small.geo.cy - ph / 2 + (1 - eo(k)) * 12;
        L.line(ctx, small.geo.tipX + 14, small.geo.cy, lerp(small.geo.tipX + 14, px - 10, eo(k)), small.geo.cy, COL.amber, 1.4, 0.4, { alpha: k * 0.7, dash: [5, 7] });
        L.panel(ctx, px, py, pw, ph, { alpha: k, fill: "rgba(5,14,30,0.9)", stroke: L.C.amberSoft, r: 8 });
        text(ctx, rl.toUpperCase(), px + 28, py + 30, { ...lo, color: COL.amber, alpha: k * 0.9 });
        text(ctx, rt, px + 28, py + 74, { ...ro, color: COL.white, alpha: k, glow: 10, glowColor: COL.amber });
      }
    }
  }

  // ================================================================ MODUS: building_floors
  function modeBuilding(ctx, p) {
    const { L, t, d } = p; const P = p.params || {};
    const floors = Math.round(clamp(toNum(pick(P, ["floors", "stockwerke", "etagen", "floor_count", "storeys", "stories"]), 102), 1, 200));
    let heightM = toNum(pick(P, ["height_m", "height", "hoehe_m", "höhe_m", "hoehe", "höhe", "meters"]), NaN);
    if (!(heightM > 0)) heightM = floors === 102 ? 381 : floors * (floors >= 12 ? 3.7 : 3);
    heightM = clamp(heightM, 2, 2000);
    const fH = heightM / floors;
    const tall = floors >= 12;
    const name = str(pick(P, ["name", "building", "building_label", "gebaeude", "gebäude"], ""));
    // Vergleichsbalken
    let rawItems = P.items;
    if (!Array.isArray(rawItems)) rawItems = floors >= 76 ? [{ label: "Absturz 1945", value: 75, unit: "Stockwerke", text: "rund 75 Stockwerke" }] : [];
    const comps = [];
    rawItems.slice(0, 3).forEach((it, i) => {
      if (typeof it === "number") it = { value: it, unit: "m" };
      if (!isObj(it)) return;
      const v = toNum(pick(it, ["value", "wert", "height", "height_m", "floors"]), NaN); if (!(v > 0)) return;
      const unit = str(pick(it, ["unit", "einheit"], it.floors !== undefined ? "Stockwerke" : "m")).toLowerCase();
      const isFloors = /stock|floor|etage|geschoss|story|storey/.test(unit);
      const vm = isFloors ? v * fH : unit === "cm" ? v / 100 : unit === "km" ? v * 1000 : v;
      const label = str(pick(it, ["label", "name", "title"], ""));
      const txt = str(pick(it, ["text", "value_label", "display"], "")) || (isFloors ? `${deNum(v)} Stockwerke` : `${deNum(v)} m`);
      const fall = /fall|absturz|sturz/.test(label.toLowerCase());
      comps.push({ label, vm, txt, isFloors, floorsN: isFloors ? v : vm / fH, color: colorOf(pick(it, ["color", "farbe"]), null) || (fall ? COL.red : [COL.amber, COL.green, COL.steel][i % 3]),
        dashed: /dash|gestrichelt|strich/.test(str(pick(it, ["style", "stil"], ""))) || toBool(it.dashed, false), fall, raw: it });
    });

    const groundY = 856, topLim = name ? 318 : 300;
    const maxM = Math.max(heightM, ...comps.map((c) => c.vm)) * 1.02;
    const pxm = (groundY - topLim) / maxM; const Hpx = heightM * pxm; const roofY = groundY - Hpx;
    const floorPx = fH * pxm;
    // Breiten
    const bw = tall ? clamp(Hpx * 0.56, 170, 340) : clamp(Math.max(Hpx * 1.15, 12 * pxm), 280, 560);
    // horizontales Layout (zentriert)
    const labelW = comps.length ? Math.max(...comps.map((c) => Math.max(measure(ctx, c.label, { font: F_BODY, weight: 600, size: 32 }), measure(ctx, c.txt, { font: F_MONO, weight: 700, size: 28 })))) : 0;
    const barW = tall ? 96 : 84, barGap = 40;
    const compsW = comps.length ? comps.length * barW + (comps.length - 1) * barGap + 26 + Math.min(360, labelW) : 0;
    const personPx = 1.75 * pxm; const showPerson = personPx >= 34;
    const fLabW = measure(ctx, String(floors), { font: F_MONO, weight: 700, size: 30 }) + 30 + measure(ctx, "Stockwerke", { font: F_BODY, weight: 600, size: 21 });
    const leftGap = showPerson ? 150 : 60;
    const clearOfLabel = comps.every((c) => c.vm < heightM * 0.88);
    const floorGap = comps.length ? (clearOfLabel ? 120 : Math.max(120, fLabW + 44)) : fLabW + 20;
    const totalW = 100 + leftGap + bw + 26 + floorGap + compsW;
    const gx = clamp((1920 - totalW) / 2, 130, 700);
    const axisX = gx + 100, bl = axisX + leftGap, br = bl + bw, bcx = (bl + br) / 2;
    const floorAxisX = br + 26; const barsX = floorAxisX + floorGap;

    // Zeitplan: BEATS [0] Boden/Achse, [1] Wachstum beginnt, [2] Gebäude fertig, [3] Schacht; items[].at Vergleichsbalken
    const tG0 = beatOf(p, 0, 0);
    const tG = seg(t, tG0, 0.5);
    const tRise0 = beatOf(p, 1, 0.06 * d), tRise1 = Math.max(tRise0 + 0.4, beatOf(p, 2, 0.4 * d));
    const rise = eio(seg(t, tRise0, tRise1 - tRise0));
    const tShaft = Math.max(tRise1, beatOf(p, 3, tRise1));
    const shaftK = seg(t, tShaft, clamp(0.12 * d, 0.4, 0.8));
    comps.forEach((c, i) => { c.t0 = atOf(c.raw, d, Math.min((0.44 + i * 0.07) * d, d - 1.2)); });
    const compStart = (i) => comps[i].t0;
    const cGrow = clamp(0.16 * d, 0.5, 1.4);

    const aHead = tG;
    brackets(ctx, 100, 222, 1720, 676, aHead);
    const kick = P.kicker === "" || P.kicker === false ? "" : str(pick(P, ["kicker", "kennzeile"], "HÖHE IM GLEICHEN MASSSTAB"));
    header(ctx, p, kick, str(pick(P, ["title", "titel", "heading"], "")), aHead);
    dust(ctx, p, 22);

    // Boden (Schraffur)
    const gl0 = gx - 10, gl1 = Math.min(1780, gx + totalW + 30);
    L.line(ctx, gl0, groundY, lerp(gl0, gl1, eo(tG)), groundY, COL.steel, 2, 0.6, { alpha: tG });
    ctx.save(); ctx.globalAlpha = tG * 0.35; ctx.strokeStyle = COL.steel; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = gl0; x < gl1; x += 14) { ctx.moveTo(x, groundY + 2); ctx.lineTo(x - 10, groundY + 14); } ctx.stroke(); ctx.restore();

    // Höhenachse (m)
    const step = niceStep(heightM / 4.5);
    const aA = seg(t, tG0 + 0.04 * d, 0.5);
    if (aA > 0) {
      L.line(ctx, axisX, groundY, axisX, groundY - (groundY - topLim + 10) * eo(aA), COL.muted, 1.6, 0.3, { alpha: aA });
      for (let v = 0; v <= maxM + 1e-9; v += step) {
        const y = groundY - v * pxm; if (y < topLim - 2) break;
        if ((Math.abs(v - heightM) < step * 0.3 && v > 0) || v === 0) continue;
        L.line(ctx, axisX - 9, y, axisX, y, COL.muted, 1.4, 0, { alpha: aA });
        text(ctx, `${deNum(v)} m`, axisX - 16, y + 7, { font: F_MONO, weight: 400, size: 19, color: COL.muted, align: "right", alpha: aA * (v === 0 ? 0.8 : 1) });
      }
    }

    // Gebäude (wächst von unten)
    const revealTop = groundY - Hpx * rise;
    const profile = tall
      ? [[0, 0.055, 1.0], [0.055, 0.2, 0.8], [0.2, 0.26, 0.68], [0.26, 0.8, 0.56], [0.8, 0.86, 0.45], [0.86, 0.93, 0.35], [0.93, 1.0, 0.24]]
      : [[0, 1, 1.0]];
    if (rise > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(bl - 60, revealTop, bw + 120, groundY - revealTop + 40); ctx.clip();
      // Silhouette
      const outline = (c) => {
        let first = true; const pts = [];
        for (const [a0, a1, wf] of profile) { const hw = (bw * wf) / 2; pts.push([bcx - hw, groundY - a0 * Hpx], [bcx - hw, groundY - a1 * Hpx]); }
        const right = [];
        for (let k = profile.length - 1; k >= 0; k--) { const [a0, a1, wf] = profile[k]; const hw = (bw * wf) / 2; right.push([bcx + hw, groundY - a1 * Hpx], [bcx + hw, groundY - a0 * Hpx]); }
        for (const q of pts.concat(right)) { if (first) { c.moveTo(q[0], q[1]); first = false; } else c.lineTo(q[0], q[1]); }
        c.closePath();
      };
      ctx.fillStyle = "rgba(5,16,34,0.94)"; ctx.beginPath(); outline(ctx); ctx.fill();
      const gB = ctx.createLinearGradient(0, roofY, 0, groundY); gB.addColorStop(0, "rgba(63,210,255,0.10)"); gB.addColorStop(1, "rgba(63,210,255,0.03)");
      ctx.fillStyle = gB; ctx.fill();
      // Geschossdecken + Fensterraster
      ctx.save(); ctx.beginPath(); outline(ctx); ctx.clip();
      const every = floorPx >= 5 ? 1 : Math.ceil(5 / floorPx);
      ctx.strokeStyle = tall ? "rgba(63,210,255,0.07)" : "rgba(63,210,255,0.3)"; ctx.lineWidth = 1; ctx.beginPath();
      for (let f = every; f < floors; f += every) { const y = Math.round(groundY - f * floorPx) + 0.5; ctx.moveTo(bl - 2, y); ctx.lineTo(br + 2, y); }
      ctx.stroke();
      if (tall) {
        ctx.strokeStyle = "rgba(63,210,255,0.055)"; ctx.beginPath();
        for (let x = bcx - Math.floor(bw / 18) * 9; x < br; x += 9) { ctx.moveTo(Math.round(x) + 0.5, roofY); ctx.lineTo(Math.round(x) + 0.5, groundY); }
        ctx.stroke();
        ctx.strokeStyle = "rgba(63,210,255,0.2)"; ctx.beginPath();
        const tenStep = floors > 60 ? 10 : 5;
        for (let f = tenStep; f < floors; f += tenStep) { const y = Math.round(groundY - f * floorPx) + 0.5; ctx.moveTo(bl, y); ctx.lineTo(br, y); }
        ctx.stroke();
        // blinkende Fenster
        ctx.fillStyle = "rgba(255,179,71,0.5)";
        for (let k = 0; k < 12; k++) {
          const f = Math.floor(h01(k * 4.1) * (floors * 0.95)); const on = Math.sin(t * (0.6 + h01(k)) + k * 2.3) > 0.55; if (!on) continue;
          const y = groundY - (f + 1) * floorPx + 1; const frac = f / floors; let wf = 1; for (const [a0, a1, w] of profile) if (frac >= a0 && frac < a1) wf = w;
          const x = bcx + (h01(k * 9.3) - 0.5) * bw * wf * 0.86;
          ctx.fillRect(Math.round(x), Math.round(y), 3, clamp(floorPx - 2, 2, 5));
        }
      } else {
        // niedriges Gebäude: Fenster pro Geschoss
        const nWin = Math.max(2, Math.round(bw / 90));
        for (let f = 0; f < floors; f++) {
          const y0 = groundY - (f + 1) * floorPx, y1 = groundY - f * floorPx;
          for (let k = 0; k < nWin; k++) {
            const cw = bw / nWin; const wx = bl + k * cw + cw * 0.22, ww = cw * 0.56; const wy = y0 + floorPx * 0.25, wh = floorPx * 0.42;
            if (Math.abs(wx + ww / 2 - bcx) < bw * 0.1) continue;
            ctx.strokeStyle = "rgba(63,210,255,0.32)"; ctx.lineWidth = 1.2; ctx.strokeRect(wx, wy, ww, wh);
            ctx.fillStyle = "rgba(63,210,255,0.05)"; ctx.fillRect(wx, wy, ww, wh);
          }
          void y1;
        }
        ctx.fillStyle = "rgba(63,210,255,0.24)"; ctx.fillRect(bl, groundY - floorPx * 0.12 - 1, bw, 0);
      }
      ctx.restore();
      L.glowPath(ctx, outline, COL.cyan, 2.2, 0.9);
      // Wachstumskante
      if (rise < 1) scanLine(ctx, bl - 40, br + 40, revealTop, COL.cyan, 1);
      ctx.restore();
      // Live-Zähler an der Kante bzw. Endmarken
      const curF = Math.round(floors * rise), curM = heightM * rise;
      const labY = rise < 1 ? revealTop : roofY;
      const aL = seg(t, tRise0 + 0.02 * d, 0.3);
      const hLabel = `${deNum(rise < 1 ? Math.round(curM) : heightM, rise < 1 ? 0 : undefined)} m`;
      const fLabel = `${curF}`;
      if (rise >= 1) L.line(ctx, axisX, roofY, bcx - (bw * profile[profile.length - 1][2]) / 2 - 6, roofY, COL.amber, 1.4, 0.4, { alpha: 0.8, dash: [6, 6] });
      text(ctx, hLabel, axisX - 16, labY + 10, { font: F_MONO, weight: 700, size: 30, color: COL.amber, align: "right", alpha: aL, glow: 12, glowColor: COL.amber, stroke: 6 });
      L.line(ctx, axisX - 10, labY, axisX + 10, labY, COL.amber, 2.4, 1, { alpha: aL });
      // Stockwerke rechts
      const fx = floorAxisX;
      L.line(ctx, fx, groundY, fx, labY, COL.cyanDim, 1.4, 0, { alpha: aL });
      const fstep = tall ? (floors > 80 ? 25 : floors > 40 ? 10 : 5) : 1;
      if (tall) {
        for (let f = fstep; f < curF - fstep * 0.4; f += fstep) { const y = groundY - f * floorPx; L.line(ctx, fx, y, fx + 8, y, COL.cyan, 1.2, 0, { alpha: aL * 0.8 }); text(ctx, String(f), fx + 14, y + 7, { font: F_MONO, weight: 400, size: 18, color: "rgba(63,210,255,0.75)", alpha: aL }); }
      } else {
        for (let f = 0; f < floors && f < curF + 1; f++) {
          const y = groundY - (f + 0.5) * floorPx; if ((f + 0.5) / floors > rise) break;
          text(ctx, f === 0 ? "EG" : `${f}. OG`, fx + 14, y + 7, { font: F_MONO, weight: 400, size: 19, color: "rgba(63,210,255,0.8)", alpha: aL });
          L.line(ctx, fx, groundY - (f + 1) * floorPx, fx + 8, groundY - (f + 1) * floorPx, COL.cyan, 1.2, 0, { alpha: aL * 0.8 });
        }
      }
      L.line(ctx, fx - 2, labY, fx + 12, labY, COL.white, 2.4, 1, { alpha: aL });
      text(ctx, fLabel, fx + 18, labY + 10, { font: F_MONO, weight: 700, size: 30, color: COL.white, alpha: aL, stroke: 6 });
      text(ctx, curF === 1 ? "Stockwerk" : "Stockwerke", fx + 22 + measure(ctx, fLabel, { font: F_MONO, weight: 700, size: 30 }), labY + 8, { font: F_BODY, weight: 600, size: 21, color: COL.muted, alpha: aL, stroke: 5 });
      if (name) text(ctx, name, bcx, roofY - 26, { font: F_BODY, weight: 600, size: 26, color: COL.white, align: "center", alpha: seg(rise, 0.95, 0.05), stroke: 5 });
    }

    // Aufzugsschacht
    if (shaftK > 0 && rise >= 1) {
      const sw = tall ? clamp(bw * 0.075, 9, 20) : clamp(bw * 0.12, 30, 60);
      const sx = tall ? bcx - sw / 2 : bcx - sw / 2;
      const pit = Math.max(8, floorPx * (tall ? 1.4 : 0.35));
      const sTop = groundY - (floors - (tall ? 1 : 0)) * floorPx + (tall ? 0 : floorPx * 0.08); const sBot = groundY + Math.min(pit, 30);
      const k = eo(shaftK);
      ctx.save(); ctx.globalAlpha = k;
      const gS = ctx.createLinearGradient(sx, 0, sx + sw, 0); gS.addColorStop(0, "rgba(63,210,255,0.08)"); gS.addColorStop(0.5, "rgba(63,210,255,0.28)"); gS.addColorStop(1, "rgba(63,210,255,0.08)");
      ctx.fillStyle = gS; ctx.fillRect(sx, sTop, sw, sBot - sTop); ctx.restore();
      L.rect(ctx, sx, sTop, sw, sBot - sTop, COL.cyan, 1.6, 1, { alpha: k });
      // Triebwerksraum oben
      const mrH = Math.max(8, floorPx * (tall ? 1.6 : 0.5));
      if (tall) L.rect(ctx, sx - sw * 0.4, sTop - mrH, sw * 1.8, mrH, COL.cyan, 1.4, 0.6, { alpha: k });
      // Energiefluss im Schacht (Seile)
      ctx.save(); ctx.globalAlpha = k * 0.7; ctx.strokeStyle = COL.cyan; ctx.lineWidth = 1; ctx.setLineDash([6, 10]); ctx.lineDashOffset = -t * 40;
      ctx.beginPath(); ctx.moveTo(sx + sw / 2, sTop); ctx.lineTo(sx + sw / 2, sBot); ctx.stroke(); ctx.restore();
      // Fall-Hervorhebung
      const fallC = comps.find((c) => c.fall);
      const fk = fallC ? seg(t, compStart(comps.indexOf(fallC)) + Math.min(0.1 * d, 0.7), clamp(0.14 * d, 0.5, 1.0)) : 0;
      if (fallC && fk > 0) {
        const yF = groundY - Math.min(fallC.floorsN, floors) * floorPx; const yB = sBot;
        const yCur = lerp(yF, yB, eo(fk));
        ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = "rgba(255,90,95,0.25)"; ctx.fillRect(sx - 1, yF, sw + 2, yCur - yF); ctx.restore();
        L.line(ctx, sx + sw / 2, yF, sx + sw / 2, yCur, COL.red, 2.4, 1);
        // Chevrons nach unten
        ctx.save(); ctx.beginPath(); ctx.rect(sx - 10, yF, sw + 20, yCur - yF); ctx.clip(); ctx.strokeStyle = COL.red; ctx.lineWidth = 2; ctx.globalAlpha = 0.9;
        const cs = Math.max(16, sw * 1.3); const off = (t * 90) % cs;
        ctx.beginPath(); for (let y = yF - cs + off; y < yCur; y += cs) { ctx.moveTo(sx + sw * 0.15, y); ctx.lineTo(sx + sw / 2, y + sw * 0.35); ctx.lineTo(sx + sw * 0.85, y); } ctx.stroke(); ctx.restore();
      }
      // Kabine
      let carF;
      if (fallC) carF = Math.min(fallC.floorsN, floors - 1);
      else { const ph = (t * 0.07) % 2; const q = sm(ph < 1 ? ph : 2 - ph); carF = lerp(0, Math.max(0, floors - 1.2), tall ? lerp(0.15, 0.7, q) : q); }
      const carH = Math.max(tall ? 11 : 6, floorPx * (tall ? 1.6 : 0.82)), carW = sw - 4;
      const cyC = groundY - carF * floorPx - carH - (tall ? 0 : floorPx * 0.02);
      ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = fallC ? "rgba(255,90,95,0.55)" : "rgba(63,210,255,0.55)"; ctx.fillRect(sx + 2, cyC, carW, carH); ctx.restore();
      L.rect(ctx, sx + 2, cyC, carW, carH, fallC ? COL.red : COL.white, 1.5, 1, { alpha: k * (0.7 + 0.3 * Math.sin(t * 4)) });
      if (!tall) {
        // Seile vom Triebwerk zur Kabine
        L.line(ctx, sx + sw * 0.4, sTop, sx + sw * 0.4, cyC, COL.cyan, 1.2, 0.4, { alpha: k * 0.8 });
        L.line(ctx, sx + sw * 0.6, sTop, sx + sw * 0.6, cyC, COL.cyan, 1.2, 0.4, { alpha: k * 0.8 });
      }
      // Beschriftung senkrecht am Schacht
      const lab = "AUFZUGSSCHACHT";
      ctx.save(); ctx.translate(sx - 8, groundY - (tall ? Hpx * 0.2 : floorPx * 0.1)); ctx.rotate(-Math.PI / 2);
      text(ctx, lab, 0, 0, { font: F_MONO, weight: 700, size: tall ? 14 : 15, color: COL.cyan, letterSpacing: 3, alpha: k * 0.9, stroke: 4 });
      ctx.restore();
    }
    // Person als Maßstab (nur wenn sinnvoll groß)
    if (showPerson && rise >= 1) {
      const pa = seg(t, tRise1, 0.5); const px = bl - leftGap / 2 + 10;
      L.person(ctx, px, groundY, personPx, COL.steel, 0.8 * pa);
      if (personPx > 60) {
        L.line(ctx, px + personPx * 0.2, groundY, px + personPx * 0.2, groundY - personPx, COL.muted, 1, 0, { alpha: pa * 0.6 });
        text(ctx, "1,75 m", px, groundY - personPx - 12, { font: F_MONO, weight: 400, size: 17, color: COL.muted, align: "center", alpha: pa });
      }
    }
    // Flugwarnlicht
    if (tall && rise >= 1) { const on = (t * 0.9) % 1 < 0.18; L.glowDot(ctx, bcx, roofY - 3, on ? 16 : 6, COL.red, on ? 0.9 : 0.3); }

    // Vergleichsbalken
    comps.forEach((c, i) => {
      const ts = compStart(i); const k = eo(seg(t, ts, cGrow)); if (k <= 0) return;
      const x = barsX + i * (barW + barGap); const hpx = c.vm * pxm * k; const y = groundY - hpx;
      const col = c.color;
      ctx.save();
      const g = ctx.createLinearGradient(0, groundY, 0, groundY - c.vm * pxm); g.addColorStop(0, rgba(col, 0.1)); g.addColorStop(1, rgba(col, 0.42));
      ctx.fillStyle = g; ctx.fillRect(x, y, barW, hpx);
      if (c.dashed) { ctx.beginPath(); ctx.rect(x, y, barW, hpx); ctx.clip(); ctx.strokeStyle = rgba(col, 0.35); ctx.lineWidth = 1.5; ctx.beginPath(); const off = (t * 12) % 18; for (let yy = y - barW - 18 + off; yy < groundY + barW; yy += 18) { ctx.moveTo(x, yy + barW); ctx.lineTo(x + barW, yy); } ctx.stroke(); }
      ctx.restore();
      L.rect(ctx, x, y, barW, hpx, col, 2, 1, { dash: c.dashed ? [10, 7] : null });
      L.line(ctx, x - 6, y, x + barW + 6, y, col, 3, 1);
      // Leitlinie zum Gebäude
      const la = seg(t, ts + cGrow * 0.75, 0.4);
      const yTop = (j) => groundY - comps[j].vm * pxm;
      let freePath = true; for (let j = 0; j < i; j++) if (!(y < yTop(j) - 70)) freePath = false;
      if (la > 0 && freePath) L.line(ctx, x - 8, y, lerp(x - 8, floorAxisX + 4, eo(la)), y, col, 1.4, 0.5, { alpha: 0.75 * la, dash: [5, 6] });
      // Beschriftung rechts oben am Balken (nur beim letzten Balken rechts, sonst über dem Balken)
      const lx = x + barW + 18; const ta = seg(t, ts + cGrow * 0.5, 0.4);
      const isLast = i === comps.length - 1;
      const maxLW = isLast ? 1775 - lx : barW + barGap;
      const ls = fitSize(ctx, c.label, maxLW, { font: F_BODY, weight: 600, size: 32 }, 16);
      if (isLast) {
        text(ctx, c.label, lx, y + 8, { font: F_BODY, weight: 600, size: ls, color: COL.white, alpha: ta, stroke: 5 });
        text(ctx, c.txt, lx, y + 46, { font: F_MONO, weight: 700, size: fitSize(ctx, c.txt, maxLW, { font: F_MONO, weight: 700, size: 28 }, 14), color: col, alpha: ta, stroke: 5, glow: col === COL.red ? 6 : 0, glowColor: col });
      } else {
        text(ctx, c.txt, x + barW / 2, y - 14, { font: F_MONO, weight: 700, size: 20, color: col, align: "center", alpha: ta, stroke: 5 });
        text(ctx, c.label, x + barW / 2, y - 40, { font: F_BODY, weight: 600, size: Math.min(ls, 20), color: COL.white, align: "center", alpha: ta, stroke: 5 });
      }
    });
  }

  // ================================================================ MODUS: vertical_ruler (Bremsweg an der Schiene)
  function modeVRuler(ctx, p) {
    const { L, t, d } = p; const P = p.params || {};
    let raw = Array.isArray(P.items) && P.items.length ? P.items : [
      { label: "gut 11 cm, volle Erdbeschleunigung (Obergrenze)", value_cm: 11 },
      { label: "knapp 60 cm, ein Fünftel davon", value_cm: 57 },
      { label: "real: einige Dezimeter", style: "band", notes: ["+ Reaktionszeit", "+ Einrücken der Keile"] },
    ];
    const bars = [], bands = [];
    raw.slice(0, 5).forEach((it) => {
      if (typeof it === "number") it = { value_cm: it };
      if (typeof it === "string") it = { label: it, style: "band" };
      if (!isObj(it)) return;
      const label = str(pick(it, ["label", "name", "text"], ""));
      const style = str(pick(it, ["style", "type", "kind"], "")).toLowerCase();
      let cm = toNum(pick(it, ["value_cm", "cm"]), NaN);
      if (!Number.isFinite(cm)) { const v = toNum(pick(it, ["value", "wert"]), NaN); const u = str(pick(it, ["unit", "einheit"], "cm")).toLowerCase(); if (Number.isFinite(v)) cm = v * (u === "m" ? 100 : u === "mm" ? 0.1 : u === "dm" ? 10 : 1); }
      if (/band|range|bereich|soft/.test(style) || !Number.isFinite(cm)) {
        let a = toNum(pick(it, ["from_cm", "min_cm", "from", "min"]), NaN), b = toNum(pick(it, ["to_cm", "max_cm", "to", "max"]), NaN);
        if (!Number.isFinite(a) || !Number.isFinite(b)) { a = 20; b = 50; }
        let notes = pick(it, ["notes", "note", "sub", "detail", "reasons"], []);
        if (!Array.isArray(notes)) notes = [notes];
        notes = notes.map((nt) => (isObj(nt) ? { text: str(pick(nt, ["text", "label"], "")), raw: nt } : { text: str(nt, ""), raw: null })).filter((nt) => nt.text).slice(0, 3);
        bands.push({ label, a: clamp(Math.min(a, b), 0, 500), b: clamp(Math.max(a, b), 0.5, 500), color: colorOf(it.color, COL.amber), notes, raw: it });
      } else bars.push({ label, cm: clamp(cm, 0, 500), color: colorOf(it.color, null) || [COL.cyan, COL.amber, COL.green, COL.steel][bars.length % 4], raw: it });
    });
    const maxCm = Math.max(10, ...bars.map((b) => b.cm), ...bands.map((b) => b.b));
    const stepCm = maxCm > 240 ? 50 : maxCm > 120 ? 20 : maxCm > 40 ? 10 : 5;
    const rangeCm = Math.ceil((maxCm * 1.1) / stepCm) * stepCm;
    const y0 = 484, y1 = 862; const pxc = (y1 - y0) / rangeCm; const Y = (cm) => y0 + cm * pxc;
    const foot = str(pick(P, ["footnote", "fussnote", "fußnote"], ""));
    const aHead = seg(t, 0, 0.5);
    brackets(ctx, 100, 222, 1720, 676, aHead);
    const kick = P.kicker === "" || P.kicker === false ? "" : str(pick(P, ["kicker"], "BREMSWEG AN DER FÜHRUNGSSCHIENE"));
    header(ctx, p, kick, str(pick(P, ["title", "titel"], "")), aHead);
    dust(ctx, p, 22);
    const railX = 340, cabX = 366, cabW = 210, cabH = 156, rulerX = 660, bx0 = 800, RIGHT = 1765;
    // Zeitplan: BEATS [0] Aufbau, [1] Rutschen beginnt, [2] Kabine steht, [3] Fußnote; items[].at
    const tIn = beatOf(p, 0, 0.02 * d);
    const aR = seg(t, tIn, 0.5);
    const tSlide0 = beatOf(p, 1, 0.1 * d), tSlide1 = Math.max(tSlide0 + 0.5, beatOf(p, 2, 0.4 * d)), tSlideD = tSlide1 - tSlide0;
    const growD = clamp(0.16 * d, 0.5, 1.2), bandD = clamp(0.2 * d, 0.5, 1.2);
    bars.forEach((b, i) => { b.t0 = atOf(b.raw, d, Math.min((0.16 + i * 0.13) * d, d - 1.0)); });
    bands.forEach((b, i) => {
      b.t0 = atOf(b.raw, d, Math.min((0.16 + bars.length * 0.13 + 0.03 + i * 0.1) * d, d - 1.0));
      b.notes.forEach((nt, j) => { nt.t0 = atOf(nt.raw, d, Math.min(b.t0 + 0.4 + j * 0.35, d - 0.5)); });
    });
    const tFoot = atOf(P, d, beatOf(p, 3, Math.min(0.6 * d, d - 0.9)), ["footnote_at", "fussnote_at"]);

    // Nulllinie
    L.line(ctx, railX - 40, Y(0), RIGHT, Y(0), COL.white, 1.3, 0.3, { alpha: aR * 0.55, dash: [8, 8] });
    text(ctx, str(pick(P, ["zero_label", "null_label"], "Fangvorrichtung greift")), RIGHT, Y(0) - 14, { font: F_BODY, weight: 600, size: 22, color: COL.white, align: "right", alpha: aR });

    // weiche Bänder (hinter den Balken)
    const bandLabels = [];
    bands.forEach((bd) => {
      const k = seg(t, bd.t0, bandD);
      const ya = Y(bd.a), yb = Y(bd.b); const x = rulerX + 64, w = RIGHT - x;
      bandLabels.push({ bd, k, y: (ya + yb) / 2 }); // Notizen dürfen schon vor dem Band erscheinen
      if (k <= 0) return;
      ctx.save(); ctx.globalAlpha = k * (0.85 + 0.15 * Math.sin(t * 1.6));
      const g = ctx.createLinearGradient(0, ya - 34, 0, yb + 34);
      g.addColorStop(0, rgba(bd.color, 0)); g.addColorStop(0.3, rgba(bd.color, 0.15)); g.addColorStop(0.7, rgba(bd.color, 0.15)); g.addColorStop(1, rgba(bd.color, 0));
      ctx.fillStyle = g; ctx.fillRect(x, ya - 34, w * eo(k), yb - ya + 68);
      const g2 = ctx.createLinearGradient(0, ya - 20, 0, yb + 20); g2.addColorStop(0, rgba(bd.color, 0)); g2.addColorStop(0.25, rgba(bd.color, 0.8)); g2.addColorStop(0.75, rgba(bd.color, 0.8)); g2.addColorStop(1, rgba(bd.color, 0));
      ctx.fillStyle = g2; ctx.fillRect(rulerX + 58, ya - 20, 7, yb - ya + 40);
      // wandernde Lichtkante: „Unschärfe“ des realen Bereichs
      const ph = (t * 0.35) % 1; const yl = lerp(ya, yb, sm(ph < 0.5 ? ph * 2 : 2 - ph * 2));
      ctx.globalAlpha = k * 0.35; ctx.fillStyle = rgba(bd.color, 0.6); ctx.fillRect(x, yl - 1, w * eo(k), 2);
      ctx.restore();
    });

    // Führungsschiene
    L.line(ctx, railX, 300, railX, lerp(300, y1 + 16, eo(aR)), COL.steel, 7, 0.6, { alpha: aR });
    L.line(ctx, railX - 13, 300, railX - 13, lerp(300, y1 + 16, eo(aR)), "rgba(159,196,230,0.3)", 2, 0, { alpha: aR });
    ctx.save(); ctx.globalAlpha = aR * 0.5; ctx.strokeStyle = COL.cyanDim; ctx.lineWidth = 2; ctx.beginPath(); for (let y = 320; y < y1; y += 64) { ctx.moveTo(railX - 12, y); ctx.lineTo(railX + 10, y); } ctx.stroke(); ctx.restore();
    text(ctx, "Führungsschiene", railX - 18, y1 + 6, { font: F_BODY, weight: 600, size: 19, color: COL.steel, align: "right", alpha: aR });

    // Kabine rutscht bis in den realistischen Bereich und steht
    const target = clamp(toNum(pick(P, ["stop_cm", "slide_cm", "halt_cm"]), bands.length ? (bands[0].a + bands[0].b) / 2 : bars.length ? bars[bars.length - 1].cm : 20), 0, rangeCm);
    const slide = eio(seg(t, tSlide0, tSlideD));
    const dt = t - tSlide1;
    const settle = slide >= 1 ? Math.sin(dt * 9) * Math.exp(-dt * 5) * 1.5 : 0;
    const cmNow = target * slide;
    const floorY = Y(cmNow) + settle; const frameH = 20; const cabBot = floorY - frameH; const cabTop = cabBot - cabH;
    // Reibspur
    if (cmNow > 0.2) L.line(ctx, railX + 5, Y(0), railX + 5, floorY, COL.amber, 2.4, 0.9, { alpha: 0.75 * aR });
    // Kabinenkörper
    ctx.save(); ctx.globalAlpha = aR;
    const gC = ctx.createLinearGradient(0, cabTop, 0, cabBot); gC.addColorStop(0, "rgba(63,210,255,0.03)"); gC.addColorStop(1, "rgba(63,210,255,0.10)");
    ctx.fillStyle = "rgba(4,12,26,0.85)"; ctx.fillRect(cabX, cabTop, cabW, cabH); ctx.fillStyle = gC; ctx.fillRect(cabX, cabTop, cabW, cabH); ctx.restore();
    L.rect(ctx, cabX, cabTop, cabW, cabH, COL.cyan, 2.4, 1, { alpha: aR });
    L.line(ctx, cabX + cabW / 2, cabTop + 12, cabX + cabW / 2, cabBot - 12, "rgba(63,210,255,0.45)", 1.6, 0, { alpha: aR, dash: [9, 7] });
    L.rect(ctx, cabX - 14, cabTop - 22, cabW + 28, 22, COL.steel, 2, 0.5, { alpha: aR }); // Tragrahmen oben
    text(ctx, str(pick(P, ["cabin_label", "car_label", "kabine"], "KABINE")).toUpperCase(), cabX + cabW / 2, cabTop + cabH / 2 + 7, { font: F_MONO, weight: 700, size: 17, color: "rgba(63,210,255,0.7)", align: "center", letterSpacing: 4, alpha: aR, stroke: 4 });
    // Tragrahmen unten + Fangvorrichtung am Schienenkopf
    L.rect(ctx, cabX - 14, cabBot, cabW + 28, frameH, COL.steel, 2, 0.5, { alpha: aR });
    const eng = seg(t, tSlide0, 0.25);
    ctx.save(); ctx.globalAlpha = aR;
    ctx.fillStyle = eng > 0 ? "rgba(255,179,71,0.22)" : "rgba(255,179,71,0.1)"; ctx.fillRect(railX + 5, cabBot - 26, 30, frameH + 30);
    ctx.strokeStyle = COL.amber; ctx.lineWidth = 2; ctx.strokeRect(railX + 5, cabBot - 26, 30, frameH + 30);
    ctx.fillStyle = COL.amber; ctx.beginPath(); ctx.moveTo(railX + 5 + 8 * (1 - eng), cabBot - 20); ctx.lineTo(railX + 16, cabBot - 20); ctx.lineTo(railX + 16, cabBot + frameH); ctx.lineTo(railX + 5 + 4 * (1 - eng), cabBot + frameH - 4); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (eng > 0 && eng < 1) L.circle(ctx, railX + 12, cabBot, 10 + 30 * eo(eng), COL.amber, 2, 0.8, { alpha: (1 - eng) * 0.8 });
    if (slide > 0.02 && slide < 0.98) L.sparks(ctx, railX + 6, floorY - 2, (t - tSlide0) % 0.5, { seed: 7, count: 16, life: 0.35, window: 0.3, speed: 280, dir: Math.PI * 0.62, spread: 1.0, gravity: 700 });
    text(ctx, "Fangvorrichtung", railX + 44, floorY + 30, { font: F_BODY, weight: 600, size: 18, color: COL.amber, alpha: aR * (0.55 + 0.45 * eng), stroke: 4 });

    // Lineal
    const rl = lerp(y0, y1, eo(aR));
    ctx.save(); ctx.globalAlpha = aR; ctx.fillStyle = "rgba(10,28,54,0.72)"; ctx.fillRect(rulerX, y0, 58, rl - y0); ctx.strokeStyle = "rgba(63,210,255,0.35)"; ctx.lineWidth = 1.2; ctx.strokeRect(rulerX + 0.5, y0 + 0.5, 58, rl - y0); ctx.restore();
    const unitStep = pxc >= 4 ? 1 : pxc >= 0.8 ? 5 : 10;
    const tickPass = (cond, len, style, lw) => { ctx.save(); ctx.globalAlpha = aR; ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.beginPath(); for (let cm = 0; cm <= rangeCm; cm += unitStep) { if (!cond(cm)) continue; const y = Math.round(Y(cm)) + 0.5; if (y > rl) break; ctx.moveTo(rulerX, y); ctx.lineTo(rulerX + len, y); } ctx.stroke(); ctx.restore(); };
    if (unitStep === 1) tickPass((cm) => cm % 5 !== 0, 10, "rgba(63,210,255,0.55)", 1);
    tickPass((cm) => cm % 5 === 0 && cm % 10 !== 0, 18, "rgba(63,210,255,0.8)", 1.3);
    tickPass((cm) => cm % 10 === 0, 28, COL.cyan, 1.8);
    L.line(ctx, rulerX, y0, rulerX, rl, COL.cyan, 2, 1, { alpha: aR });
    for (let cm = 0; cm <= rangeCm; cm += stepCm) {
      const y = Y(cm); if (y > rl) break;
      const near = slide > 0 ? clamp(Math.abs(y - floorY) / 16 - 0.4) : 1; // Zahl unter dem Zeiger ausblenden
      text(ctx, `${cm}`, rulerX - 14, y + 7, { font: F_MONO, weight: cm ? 400 : 700, size: 19, color: cm ? COL.muted : COL.white, align: "right", alpha: aR * near });
    }
    text(ctx, "cm", rulerX + 29, y1 + 30, { font: F_MONO, weight: 700, size: 17, color: COL.muted, align: "center", alpha: aR });
    // Zeiger: Kabinenboden → Lineal
    if (slide > 0) {
      L.line(ctx, cabX + cabW + 14, floorY, rulerX + 58, floorY, COL.white, 1.3, 0.5, { alpha: 0.75 * aR });
      ctx.save(); ctx.globalAlpha = aR; ctx.fillStyle = COL.white; ctx.beginPath(); ctx.moveTo(rulerX - 2, floorY); ctx.lineTo(rulerX - 14, floorY - 7); ctx.lineTo(rulerX - 14, floorY + 7); ctx.closePath(); ctx.fill(); ctx.restore();
    }

    // Balken (Rechenwerte)
    const barW = 58;
    const labs = bars.map((b) => { const parts = b.label ? b.label.split(/,\s*/) : []; return { head: parts[0] || `${deNum(b.cm)} cm`, sub: parts.slice(1).join(", ") }; });
    const slot = (RIGHT - bx0) / Math.max(1, bars.length);
    bars.forEach((bb, i) => {
      const ts = bb.t0; const k = eo(seg(t, ts, growD)); if (k <= 0) return;
      const x = bx0 + i * slot; const yb = Y(bb.cm * k); const maxLW = slot - barW - 40;
      ctx.save(); const g = ctx.createLinearGradient(0, Y(0), 0, Y(bb.cm)); g.addColorStop(0, rgba(bb.color, 0.08)); g.addColorStop(1, rgba(bb.color, 0.45)); ctx.fillStyle = g; ctx.fillRect(x, Y(0), barW, yb - Y(0)); ctx.restore();
      L.rect(ctx, x, Y(0), barW, yb - Y(0), bb.color, 2, 0.9);
      L.line(ctx, rulerX + 64, yb, x - 6, yb, bb.color, 1.3, 0.4, { alpha: 0.65 * k, dash: [5, 6] });
      L.line(ctx, x - 6, yb, x + barW + 6, yb, bb.color, 3, 1);
      if (k >= 1) L.glowDot(ctx, x + barW / 2, yb, 22, bb.color, 0.25 + 0.15 * Math.sin(t * 2.2 + i));
      const ta = seg(t, ts + growD * 0.5, 0.4); const tx = x + barW + 18;
      const hs = fitSize(ctx, labs[i].head, maxLW, { font: F_MONO, weight: 700, size: 30 }, 16);
      text(ctx, labs[i].head, tx, yb + 10, { font: F_MONO, weight: 700, size: hs, color: bb.color, alpha: ta, stroke: 5 });
      if (labs[i].sub) {
        const sl = wrap(ctx, labs[i].sub, maxLW, { font: F_BODY, weight: 400, size: 21 }).slice(0, 2);
        sl.forEach((l, j) => text(ctx, l, tx, yb + 42 + j * 26, { font: F_BODY, weight: 400, size: 21, color: COL.muted, alpha: ta, stroke: 4 }));
      }
    });
    bandLabels.forEach(({ bd, k, y }) => {
      const bs = fitSize(ctx, bd.label, 520, { font: F_BODY, weight: 700, size: 32 }, 18);
      const ny = bd.notes.length ? y - bd.notes.length * 14 : y;
      if (k > 0) text(ctx, bd.label, RIGHT - 20, ny + 11 + (1 - eo(k)) * 8, { font: F_BODY, weight: 700, size: bs, color: bd.color, align: "right", alpha: k, stroke: 6 });
      bd.notes.forEach((nt, j) => {
        const na = seg(t, nt.t0, 0.45); if (na <= 0) return;
        const ns = fitSize(ctx, nt.text, 520, { font: F_BODY, weight: 400, size: 22 }, 15);
        text(ctx, nt.text, RIGHT - 20 + (1 - eo(na)) * 12, ny + 46 + j * 28, { font: F_BODY, weight: 400, size: ns, color: "rgba(238,246,255,0.85)", align: "right", alpha: na, stroke: 4 });
      });
    });
    if (foot) footnote(ctx, foot, RIGHT, 896, seg(t, tFoot, 0.5), "right");
  }

  // ================================================================ MODUS: order_of_magnitude (1 in 1 Milliarde)
  let DOT_TILE = null;
  function dotTile() {
    if (DOT_TILE || typeof document === "undefined") return DOT_TILE;
    const cv = document.createElement("canvas"); cv.width = cv.height = 32; const g = cv.getContext("2d"); if (!g) return null;
    g.fillStyle = "rgba(63,210,255,0.85)"; g.beginPath(); g.arc(16, 16, 6, 0, TAU); g.fill();
    DOT_TILE = cv; return cv;
  }
  const POW_WORDS = ["1", "10", "100", "1.000", "10.000", "100.000", "1 Million", "10 Millionen", "100 Millionen", "1 Milliarde", "10 Milliarden", "100 Milliarden", "1 Billion"];
  function modeDots(ctx, p) {
    const { L, t, d } = p; const P = p.params || {};
    let exp = toNum(pick(P, ["exponent", "power", "zehnerpotenz"]), NaN);
    if (!Number.isFinite(exp)) { const v = toNum(pick(P, ["total", "n", "count", "of"]), NaN); exp = Number.isFinite(v) && v > 1 ? Math.log10(v) : 9; }
    exp = Math.round(clamp(exp, 2, 12));
    const label = P.label === "" || P.label === false ? "" : str(pick(P, ["label", "result", "ergebnis", "value"], "≈ 1 Todesfall pro 1 Milliarde Fahrten"));
    const scope = str(pick(P, ["scope", "sub", "bereich"], ""));
    const unitWord = str(pick(P, ["unit", "einheit", "what"], "Fahrten"));
    const ONE = { fahrten: "Fahrt", aufzugsfahrten: "Aufzugsfahrt", menschen: "Mensch", personen: "Person", jahre: "Jahr", tage: "Tag", stunden: "Stunde", fälle: "Fall", faelle: "Fall", unfälle: "Unfall", starts: "Start", flüge: "Flug" };
    const unitOne = str(pick(P, ["unit_one", "unit_singular", "einheit_einzahl"], "")) || ONE[unitWord.toLowerCase()] || unitWord;
    const foot = str(pick(P, ["footnote", "fussnote", "note"], ""));
    // Zeitplan: BEATS [0] Feld, [1] Zoom beginnt, [2] Zoom am Ziel, [3] Ergebnis-Kachel, [4] Fußnote
    const tField = beatOf(p, 0, 0);
    const tZ0 = beatOf(p, 1, 0.06 * d), tZ1 = Math.max(tZ0 + 0.5, beatOf(p, 2, 0.58 * d));
    const resD = clamp(0.14 * d, 0.4, 0.8);
    const tRes = atOf(P, d, beatOf(p, 3, Math.min(Math.max(0.6 * d, tZ1 - 0.3), d - 0.3 - resD)), ["result_at", "label_at"]);
    const tFoot = atOf(P, d, beatOf(p, 4, Math.min(Math.max(0.7 * d, tRes + 0.4), d - 0.8)), ["footnote_at", "fussnote_at"]);
    const aHead = seg(t, tField, 0.5);
    brackets(ctx, 100, 222, 1720, 676, aHead);
    const kick = P.kicker === "" || P.kicker === false ? "" : str(pick(P, ["kicker"], "GRÖSSENORDNUNG"));
    header(ctx, p, kick, str(pick(P, ["title", "titel"], "")), aHead);
    // Feld
    const fx = 160, fy = 290, fw = 860, fh = 540; const cx = Math.round(fx + fw / 2), cy = Math.round(fy + fh / 2);
    const c = lerp(1, exp, eio(seg(t, tZ0, tZ1 - tZ0))); // angezeigte Zehnerpotenz (stetig)
    const sp = Math.sqrt((fw * fh) / Math.pow(10, c)); // Punktabstand in px: Feld zeigt ≈ 10^c Punkte
    ctx.save(); ctx.beginPath(); ctx.rect(fx, fy, fw, fh); ctx.clip();
    ctx.globalAlpha = aHead; ctx.fillStyle = "rgba(3,10,22,0.7)"; ctx.fillRect(fx, fy, fw, fh);
    // Punkte
    if (sp >= 22) {
      const r = Math.min(7, sp * 0.16); ctx.fillStyle = "rgba(63,210,255,0.8)"; ctx.beginPath();
      const i0 = Math.ceil((fx - cx) / sp) - 1, i1 = Math.floor((fx + fw - cx) / sp) + 1, j0 = Math.ceil((fy - cy) / sp) - 1, j1 = Math.floor((fy + fh - cy) / sp) + 1;
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { if (!i && !j) continue; const x = cx + i * sp, y = cy + j * sp; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
      ctx.globalAlpha = aHead * clamp((t - tField) / 0.6 + 0.2); ctx.fill();
    } else if (sp >= 2.2) {
      const tile = dotTile(); const pat = tile && ctx.createPattern(tile, "repeat");
      if (pat && typeof DOMMatrix !== "undefined") {
        const k = sp / 32; pat.setTransform(new DOMMatrix([k, 0, 0, k, cx - 16 * k, cy - 16 * k]));
        ctx.globalAlpha = aHead * clamp((sp - 2.2) / 5) * 0.9; ctx.fillStyle = pat; ctx.fillRect(fx, fy, fw, fh);
      }
    }
    // Dichte-Schleier, wenn Punkte verschmelzen
    const fog = clamp(1 - (sp - 1.5) / 5);
    if (fog > 0) {
      const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, fw * 0.7); g.addColorStop(0, "rgba(63,210,255,0.22)"); g.addColorStop(1, "rgba(63,210,255,0.12)");
      ctx.globalAlpha = aHead * fog; ctx.fillStyle = g; ctx.fillRect(fx, fy, fw, fh);
      ctx.fillStyle = "#c8f3ff";
      for (let i = 0; i < 220; i++) { const x = fx + h01(i * 1.7 + Math.floor(t * 8) * 0.013) * fw, y = fy + h01(i * 2.9 + 0.3) * fh; ctx.globalAlpha = aHead * fog * 0.35 * h01(i * 5.1); ctx.fillRect(x, y, 1.5, 1.5); }
    }
    // Blockraster: je 10 × 10 Punkte ein Block, Blöcke wieder zu 10 × 10 …
    ctx.lineWidth = 1;
    let legK = 0, legA = 0;
    for (let k = 1; k <= 7; k++) {
      const n = Math.pow(10, k); const G = sp * n; if (G < 14) continue; if (G > fh * 2.2) break;
      const a = clamp((G - 14) / 50) * clamp((fh * 2.2 - G) / (fh * 1.2));
      if (a > legA + 0.05) { legA = a; legK = k; }
      const start = cx - sp / 2 - Math.floor((n - 1) / 2) * sp;
      ctx.globalAlpha = aHead * a * (0.18 + 0.1 * k / 7); ctx.strokeStyle = COL.cyan; ctx.beginPath();
      for (let x = start - Math.ceil((start - fx) / G) * G; x <= fx + fw; x += G) { ctx.moveTo(Math.round(x) + 0.5, fy); ctx.lineTo(Math.round(x) + 0.5, fy + fh); }
      for (let y = start - cx + cy - Math.ceil((start - cx + cy - fy) / G) * G; y <= fy + fh; y += G) { ctx.moveTo(fx, Math.round(y) + 0.5); ctx.lineTo(fx + fw, Math.round(y) + 0.5); }
      ctx.stroke();
      // Block des amber Punkts hervorheben
      ctx.globalAlpha = aHead * a * 0.55; ctx.strokeStyle = COL.amber; ctx.strokeRect(Math.round(start) + 0.5, Math.round(start - cx + cy) + 0.5, G, G);
    }
    ctx.restore();
    L.rect(ctx, fx, fy, fw, fh, "rgba(63,210,255,0.55)", 1.4, 0.5, { alpha: aHead });
    // Legende unter dem Feld: was ein Punkt bzw. ein Kästchen bedeutet
    {
      const ly = fy + fh + 38; const dotA = clamp((sp - 10) / 14);
      const lo = { font: F_BODY, weight: 600, size: 22 };
      let lx = fx;
      if (dotA > 0.02) {
        L.fillCircle(ctx, lx + 7, ly - 7, 6, "rgba(63,210,255,0.85)");
        const s1 = `= 1 ${unitOne}`; text(ctx, s1, lx + 22, ly, { ...lo, color: COL.muted, alpha: aHead * dotA });
        lx += 22 + measure(ctx, s1, lo) + 34;
      }
      if (legK > 0 && legA > 0.02) {
        const bs = 16; ctx.save(); ctx.globalAlpha = aHead * legA; ctx.strokeStyle = COL.amber; ctx.lineWidth = 1.5; ctx.strokeRect(lx + 0.5, ly - bs + 0.5, bs, bs); ctx.restore();
        text(ctx, `= ${POW_WORDS[Math.min(POW_WORDS.length - 1, 2 * legK)]} ${unitWord}`, lx + bs + 12, ly, { ...lo, color: COL.white, alpha: aHead * legA });
      }
    }
    // der eine Punkt
    const r = clamp(sp * 0.2, 5, 9);
    L.glowDot(ctx, cx, cy, 34 + 6 * Math.sin(t * 3), COL.amber, 0.7 * aHead);
    L.fillCircle(ctx, cx, cy, r, COL.amber);
    const ph = (t * 0.6) % 1;
    L.circle(ctx, cx, cy, r + 8 + ph * 34, COL.amber, 1.5, 0.6, { alpha: (1 - ph) * 0.8 * aHead });
    // Zähler + Dekadenleiter
    const rx = 1080, rw = 680;
    const zi = clamp(Math.floor(c + 0.03), 0, POW_WORDS.length - 1); const word = POW_WORDS[zi]; // Zielwort erst, wenn der Zoom es erreicht
    text(ctx, "1 von", rx, 372, { font: F_BODY, weight: 600, size: 30, color: COL.muted, alpha: aHead });
    const ws = fitSize(ctx, "100 Milliarden", rw, { font: F_MONO, weight: 700, size: 72 }, 30);
    text(ctx, word, rx, 452, { font: F_MONO, weight: 700, size: ws, color: COL.cyan, glow: 14, alpha: aHead });
    text(ctx, unitWord, rx, 500, { font: F_BODY, weight: 600, size: 30, color: COL.white, alpha: aHead });
    const lx0 = rx + 4, lx1 = rx + rw - 30, ly = 548;
    L.line(ctx, lx0, ly, lx1, ly, COL.muted, 1.4, 0.2, { alpha: aHead * 0.8 });
    for (let e = 1; e <= exp; e++) {
      const x = lerp(lx0, lx1, (e - 1) / Math.max(1, exp - 1)); const on = c >= e - 0.5;
      L.line(ctx, x, ly - (e % 3 === 0 ? 10 : 6), x, ly + (e % 3 === 0 ? 10 : 6), on ? COL.cyan : COL.muted, 1.6, on ? 0.6 : 0, { alpha: aHead });
      if (e % 3 === 0 || e === 1 || e === exp) {
        text(ctx, "10", x - 4, ly + 38, { font: F_MONO, weight: 700, size: 21, color: on ? COL.cyan : COL.muted, align: "center", alpha: aHead });
        text(ctx, String(e), x + 10, ly + 26, { font: F_MONO, weight: 700, size: 14, color: on ? COL.cyan : COL.muted, align: "left", alpha: aHead });
      }
    }
    const mx = lerp(lx0, lx1, clamp((c - 1) / Math.max(1, exp - 1)));
    L.glowDot(ctx, mx, ly, 16, COL.amber, aHead); L.fillCircle(ctx, mx, ly, 4.5, COL.amber);
    // Ergebnis-Kachel
    const rk = seg(t, tRes, resD);
    if (rk > 0 && (label || scope)) {
      const by = 620 + (1 - eo(rk)) * 20, bh = scope ? 150 : 104;
      L.panel(ctx, rx, by, rw, bh, { alpha: rk, fill: "rgba(5,14,30,0.88)", stroke: L.C.amberSoft, r: 10 });
      ctx.save(); ctx.globalAlpha = rk; ctx.fillStyle = COL.amber; ctx.fillRect(rx, by + 14, 5, bh - 28); ctx.restore();
      const ls = fitSize(ctx, label, rw - 60, { font: F_BODY, weight: 800, size: 38 }, 20);
      text(ctx, label, rx + 32, by + 64, { font: F_BODY, weight: 800, size: ls, color: COL.amber, alpha: rk });
      if (scope) { const ss = fitSize(ctx, scope, rw - 60, { font: F_BODY, weight: 400, size: 25 }, 16); text(ctx, scope, rx + 32, by + 110, { font: F_BODY, weight: 400, size: ss, color: "rgba(238,246,255,0.85)", alpha: rk }); }
    }
    if (foot) { const fl = wrap(ctx, foot, rw, { font: F_BODY, weight: 400, size: 21 }).slice(0, 2); fl.forEach((l, i) => text(ctx, l, rx, 812 + i * 28, { font: F_BODY, weight: 400, size: 21, color: COL.muted, alpha: seg(t, tFoot, 0.5) })); }
  }

  // ================================================================ Dispatcher
  function resolveMode(P) {
    const m = String(pick(P, ["mode", "type", "variant", "kind", "modus"], "")).toLowerCase().trim().replace(/[\s-]+/g, "_");
    if (m) {
      if (m.includes("rope") || m.includes("finger") || /^(seil|coin|size|scale|cross|pencil|object|diameter|durchmesser|mass|maß|münze|muenze)/.test(m)) return "rope";
      if (/speed|veloc|geschw|tempo/.test(m)) return "speed";
      if (/build|floor|stock|etage|hoch|sky|tower|turm|height|hoehe|höhe|gebäude|gebaeude/.test(m)) return "building";
      if (/vertical|ruler|lineal|brems|stopping|distance/.test(m)) return "vruler";
      if (/magnitude|order|dot|punkt|billion|milliard|probab|chance|risk/.test(m)) return "dots";
      if (/bar|balken|compar|vergleich|chart/.test(m)) return "bars";
    }
    const items = Array.isArray(P.items) ? P.items.filter(isObj) : [];
    if (items.some((i) => i.shape !== undefined || i.size_mm !== undefined || i.diameter_mm !== undefined)) return "rope";
    if (items.some((i) => /m\/s|km\/h|kmh/i.test(str(i.unit)))) return "speed";
    if (items.some((i) => i.value_cm !== undefined)) return "vruler";
    if (items.some((i) => /stock|floor|etage/i.test(str(i.unit))) || P.floors !== undefined) return "building";
    if (items.length && items.every((i) => i.value !== undefined && !i.unit)) return "bars";
    return "rope";
  }

  CEX.register("map_or_scale", {
    ownsText: true,
    draw(ctx, p) {
      const L = p.L; const P = isObj(p.params) ? p.params : {};
      const q = { ...p, params: P, d: Math.max(0.5, p.d || 8), t: Math.max(0, p.t || 0) };
      q.beats = Array.isArray(P.beats) ? P.beats : Array.isArray(P.cues) ? P.cues : null;
      const mode = resolveMode(P);
      ctx.save();
      try {
        if (mode === "speed") modeBars(ctx, q, "speed");
        else if (mode === "bars") modeBars(ctx, q, "bars");
        else if (mode === "building") modeBuilding(ctx, q);
        else if (mode === "vruler") modeVRuler(ctx, q);
        else if (mode === "dots") modeDots(ctx, q);
        else modeRope(ctx, q);
      } catch (e) {
        ctx.restore(); ctx.save();
        text(ctx, `map_or_scale: ${e && e.message ? e.message : e}`, 120, 880, { size: 22, color: COL.red, font: F_MONO, weight: 400 });
      }
      ctx.restore();
      // Textfeld liegt außerhalb der Kamerabewegung? Die Engine zeichnet es nach restore – hier innerhalb der Kamera, daher Kamera neutralisieren
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      overlayText(ctx, L, p.text, q.t, q.d);
      ctx.restore();
    },
  });
})();
