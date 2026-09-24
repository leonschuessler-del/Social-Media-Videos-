/* Template „stat_counter" – große Kennzahl, die hochzählt, vor einem technischen Rundinstrument (Blueprint-Gauge).
   Aufbau: Zahl (JetBrains Mono, Amber, Glow) als mechanisches Zählwerk mit rollenden Ziffern, dahinter eine offene
   240°-Skala mit Teilstrichen, Fortschrittsbogen, rotierenden HUD-Segmenten und Lichtfluss. Darunter – in der
   Öffnung der Skala – Label (Oxanium, Versalien) und Sublabel (Inter).
   Zeitablauf (relativ zu d): Skala zeichnet sich ein (0–12 %), Zählung mit easeOut (3–45 %), Label ab 12 %,
   Sublabel ab 24 %, bei 45 % „Ping" + Aufleuchten, danach dezentes Pulsieren (Glow, Zeiger, Lichtfluss).

   params (alle optional):
     value     Zielwert (Standard 12). Zahl oder String ("12,5", "1.250.000").   Aliase: to, target, wert, zahl, number
     from      Startwert (Standard 0). from > value zählt herunter.             Aliase: start, von
     unit      Einheit hinter der Zahl ("×", "%", "m/s", "Meter", "kN" …).       Aliase: einheit, suffix
     prefix    Präfix vor der Zahl ("≥ ", "ca. ", "bis zu ").                   Aliase: praefix, pre
     decimals  Nachkommastellen (Standard 0 bzw. aus value abgeleitet).          Aliase: dec, digits, precision, nachkommastellen
     label     Überschrift unter der Zahl; fehlt sie, wird p.text verwendet.    Aliase: headline, title, titel, caption
     sublabel  kleinere Zusatzzeile.                                             Aliase: sub, subtitle, untertitel, subline, note, detail
     accent    amber (Standard) | red | cyan | green (auch rot/gefahr/danger, blau, grün). Alias: color, tone, farbe
     danger    true = accent red
     max / min Skalenbereich des Instruments (sonst automatisch „schön" gerundet). Mit max werden die Skalenenden beschriftet.
     group     Tausender-Trennung mit schmalem Leerzeichen erzwingen (true) / verbieten (false). Standard: ab 5 Stellen.
   In label/sublabel markiert *Wort* die Akzentfarbe. */
(function () {
  "use strict";
  const CEX = window.CE;
  if (!CEX || typeof CEX.register !== "function") return;

  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const MONO = "JetBrains Mono", HEAD = "Oxanium", BODY = "Inter";
  const ACC = {
    amber: { main: "#ffb347", hi: "#ffe6bd", deep: "#ff9d2e", rgb: "255,179,71" },
    red: { main: "#ff5a5f", hi: "#ffd0d1", deep: "#ff3440", rgb: "255,90,95" },
    cyan: { main: "#3fd2ff", hi: "#d4f6ff", deep: "#18aee8", rgb: "63,210,255" },
    green: { main: "#5be49b", hi: "#d2f9e4", deep: "#2ccb7c", rgb: "91,228,155" },
  };
  const ACC_ALIAS = {
    amber: "amber", orange: "amber", gold: "amber", gelb: "amber", yellow: "amber", warn: "amber", warning: "amber",
    red: "red", rot: "red", danger: "red", gefahr: "red", fail: "red", failure: "red", error: "red", kritisch: "red",
    cyan: "cyan", blue: "cyan", blau: "cyan", info: "cyan", "türkis": "cyan",
    green: "green", "grün": "green", gruen: "green", ok: "green", safe: "green", sicher: "green",
  };
  const CYR = "63,210,255";
  const WHITE = "#eef6ff", MUTED = "#9fbde0";

  // Spannweite der Skala: 240°, Öffnung unten (für das Label)
  const A0 = 150 * DEG, SPAN = 240 * DEG, A1 = A0 + SPAN;
  const R_TICK = 322, R_ARC = 298, R_FLOW = 276, R_HUD = 257, R_FINE = 240;

  // ---------------- Helfer ----------------
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const seg = (t, a, d) => clamp((t - a) / Math.max(1e-6, d));
  const eo3 = (x) => 1 - Math.pow(1 - clamp(x), 3);
  const sm = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const h01 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const isObj = (o) => o !== null && typeof o === "object" && !Array.isArray(o);
  const pick = (o, keys) => {
    if (!isObj(o)) return undefined;
    for (const k of keys) { const v = o[k]; if (v !== undefined && v !== null) return v; }
    return undefined;
  };
  const str = (v) => (v === undefined || v === null || v === false ? "" : typeof v === "object" ? "" : String(v));
  const upper = (s) => { try { return String(s).toLocaleUpperCase("de-DE"); } catch (e) { return String(s).toUpperCase(); } };
  const toBool = (v, d) => {
    if (v === undefined || v === null || v === "") return d;
    if (typeof v === "string") { const s = v.trim().toLowerCase(); if (s === "auto") return d; return /^(1|true|ja|yes|on|y|an)$/.test(s); }
    return !!v;
  };
  function setFont(ctx, weight, size, family, ls) {
    ctx.font = `${weight} ${Math.max(1, size).toFixed(2)}px "${family}"`;
    try { ctx.letterSpacing = `${ls || 0}px`; } catch (e) { /* ältere Canvas-Implementierung */ }
  }

  /** Zahl aus Param lesen – akzeptiert deutsche Schreibweise ("12,5", "1.250.000", "1 250"). */
  function parseNum(v) {
    if (typeof v === "number") return isFinite(v) ? v : NaN;
    if (typeof v !== "string") return NaN;
    let s = v.trim().replace(/[\s   '’]/g, "").replace(/[−–]/g, "-");
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, "");
    const m = s.match(/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i);
    return m ? parseFloat(m[0]) : NaN;
  }
  /** implizite Nachkommastellen eines Roh-Params. */
  function decOf(v) {
    if (typeof v === "number") {
      if (!isFinite(v)) return 0; const s = String(v); if (/e/i.test(s)) return 0;
      const i = s.indexOf("."); return i < 0 ? 0 : Math.min(3, s.length - i - 1);
    }
    if (typeof v === "string") {
      const s = v.trim().replace(/[\s   ]/g, "");
      if (s.includes(",")) { const m = s.match(/,(\d+)/); return m ? Math.min(3, m[1].length) : 0; }
      const dots = (s.match(/\./g) || []).length;
      if (dots === 1) { const m = s.match(/\.(\d+)/); return m ? Math.min(3, m[1].length) : 0; }
    }
    return 0;
  }
  /** Deutsches Zahlenformat: Komma, schmales Leerzeichen als Tausendertrenner. */
  function fmtDe(v, dec, group) {
    const neg = v < 0 && Math.abs(v) >= 0.5 * Math.pow(10, -dec);
    const s = Math.abs(v).toFixed(dec);
    let [ip, fp] = s.split(".");
    if (group === true || (group !== false && ip.length >= 5)) ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return (neg ? "−" : "") + ip + (fp ? "," + fp : "");
  }
  /** „schöne" Skalenobergrenze. */
  function niceCeil(x) {
    if (!(x > 0)) return 1;
    const e = Math.pow(10, Math.floor(Math.log10(x))); const m = x / e;
    const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    for (const s of steps) if (m <= s + 1e-9) return s * e;
    return 10 * e;
  }

  // ---------------- Konfiguration (pro params-Objekt gecacht) ----------------
  const CFG_CACHE = new Map();
  function config(p) {
    const P = isObj(p.params) ? p.params : {};
    const txt = str(p.text);
    let key;
    try { key = JSON.stringify(P) + "\u0001" + txt; } catch (e) { key = "?" + txt; }
    const hit = CFG_CACHE.get(key);
    if (hit) return hit;
    const rawV = pick(P, ["value", "to", "target", "wert", "zahl", "number", "ziel", "end"]);
    const rawF = pick(P, ["from", "start", "von", "begin", "startwert"]);
    let value = parseNum(rawV); if (!isFinite(value)) value = 12;
    let from = parseNum(rawF); if (!isFinite(from)) from = 0;
    let dec = parseNum(pick(P, ["decimals", "dec", "digits", "precision", "nachkommastellen", "stellen"]));
    if (!isFinite(dec)) dec = Math.max(decOf(rawV), decOf(rawF));
    dec = clamp(Math.round(dec), 0, 4);
    const LIM = Math.pow(10, 12 - dec) - 1;
    value = clamp(value, -LIM, LIM); from = clamp(from, -LIM, LIM);
    let unit = str(pick(P, ["unit", "einheit", "suffix", "units"])).trim();
    if (/^[xX]$/.test(unit)) unit = "×";
    let prefix = str(pick(P, ["prefix", "praefix", "präfix", "pre", "vorsatz"]));
    const prefixGap = /\s$/.test(prefix);
    prefix = prefix.trim();
    if (prefix === ">=") prefix = "≥"; else if (prefix === "<=") prefix = "≤"; else if (prefix === "~" || prefix === "~=") prefix = "≈";
    let label = str(pick(P, ["label", "headline", "title", "titel", "caption", "heading", "ueberschrift", "überschrift"])).trim();
    if (!label) label = txt.trim();
    const sublabel = str(pick(P, ["sublabel", "subLabel", "sub_label", "sub", "subtitle", "untertitel", "subline", "note", "detail", "hint", "caption2"])).trim();
    let accKey = "amber";
    const accRaw = str(pick(P, ["accent", "color", "colour", "tone", "farbe", "variant"])).trim().toLowerCase();
    if (ACC_ALIAS[accRaw]) accKey = ACC_ALIAS[accRaw];
    if (toBool(pick(P, ["danger", "gefahr", "warnung", "critical"]), false)) accKey = "red";
    const groupRaw = pick(P, ["group", "grouping", "thousands", "tausender"]);
    const group = groupRaw === undefined || groupRaw === "auto" ? "auto" : toBool(groupRaw, true);
    // Skala
    const maxRaw = parseNum(pick(P, ["max", "scaleMax", "scale_max", "maximum", "range", "skala"]));
    const minRaw = parseNum(pick(P, ["min", "scaleMin", "scale_min", "minimum"]));
    let sMin = isFinite(minRaw) ? minRaw : Math.min(0, from, value);
    let sMax = isFinite(maxRaw) ? maxRaw : niceCeil(Math.max(Math.abs(from), Math.abs(value), 1e-9) * 1.18);
    if (!isFinite(maxRaw) && sMin < 0) sMin = -niceCeil(-sMin * 1.1);
    if (!(sMax > sMin)) { sMax = sMin + 1; }
    const showScale = isFinite(maxRaw);
    // Stellen
    const bigAbs = Math.max(Math.abs(from), Math.abs(value));
    const nInt = Math.max(1, Math.floor(Math.log10(Math.max(1, Math.round(bigAbs * Math.pow(10, dec)) / Math.pow(10, dec)))) + 1);
    const doGroup = group === "auto" ? nInt >= 5 : !!group;
    const neg = Math.min(from, value) < 0;
    const cfg = { value, from, dec, unit, prefix, prefixGap, label, sublabel, acc: ACC[accKey], accKey, doGroup, nInt, neg, sMin, sMax, showScale };
    if (CFG_CACHE.size > 12) CFG_CACHE.delete(CFG_CACHE.keys().next().value);
    CFG_CACHE.set(key, cfg);
    return cfg;
  }

  // ---------------- Symbole, die in den Web-Font-Subsets fehlen, als Vektor ----------------
  const VEC = { "≥": 1, "≤": 1, "≈": 1, "≠": 1, "→": 1 };
  const CENTER_SYM = /^[×·±+−\-~≈≥≤≠→=]+$/;
  const TOP_SYM = /^[°′″]+$/;
  function runs(s) {
    const out = []; let cur = "";
    for (const ch of s) { if (VEC[ch]) { if (cur) out.push({ t: cur }); cur = ""; out.push({ v: ch }); } else cur += ch; }
    if (cur) out.push({ t: cur });
    return out;
  }
  function richWidth(ctx, s, size) {
    setFont(ctx, 700, size, MONO); let w = 0;
    for (const r of runs(s)) w += r.v ? size * 0.6 : ctx.measureText(r.t).width;
    return w;
  }
  function vecGlyph(ctx, ch, x, axis, size) {
    const cx = x + size * 0.3, hw = size * 0.2;
    ctx.lineWidth = size * 0.09; ctx.lineCap = "butt"; ctx.lineJoin = "miter"; ctx.miterLimit = 6;
    ctx.beginPath();
    if (ch === "≥" || ch === "≤") {
      const s = ch === "≥" ? 1 : -1;
      ctx.moveTo(cx - s * hw, axis - 0.3 * size); ctx.lineTo(cx + s * hw, axis - 0.1 * size); ctx.lineTo(cx - s * hw, axis + 0.1 * size);
      ctx.moveTo(cx - hw, axis + 0.27 * size); ctx.lineTo(cx + hw, axis + 0.27 * size);
    } else if (ch === "≈") {
      for (const oy of [-0.09, 0.1]) {
        const y = axis + oy * size;
        ctx.moveTo(cx - hw, y + 0.02 * size);
        ctx.bezierCurveTo(cx - hw * 0.4, y - 0.09 * size, cx + hw * 0.4, y + 0.09 * size, cx + hw, y - 0.02 * size);
      }
    } else if (ch === "≠") {
      ctx.moveTo(cx - hw, axis - 0.08 * size); ctx.lineTo(cx + hw, axis - 0.08 * size);
      ctx.moveTo(cx - hw, axis + 0.08 * size); ctx.lineTo(cx + hw, axis + 0.08 * size);
      ctx.moveTo(cx + 0.1 * size, axis - 0.24 * size); ctx.lineTo(cx - 0.1 * size, axis + 0.24 * size);
    } else if (ch === "→") {
      ctx.moveTo(cx - hw - 0.04 * size, axis); ctx.lineTo(cx + hw, axis);
      ctx.moveTo(cx + hw - 0.13 * size, axis - 0.13 * size); ctx.lineTo(cx + hw, axis); ctx.lineTo(cx + hw - 0.13 * size, axis + 0.13 * size);
    }
    ctx.stroke();
  }
  /** Zeichnet s ab x (links) – Farbe/Schatten vom Aufrufer. axis = Mittelachse für Vektorsymbole. */
  function drawRich(ctx, s, x, base, size, axis) {
    setFont(ctx, 700, size, MONO); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.strokeStyle = ctx.fillStyle;
    let xx = x;
    for (const r of runs(s)) {
      if (r.v) { vecGlyph(ctx, r.v, xx, axis, size); xx += size * 0.6; }
      else { ctx.fillText(r.t, xx, base); xx += ctx.measureText(r.t).width; }
    }
  }

  // ---------------- Layout der Zahl ----------------
  function numberLayout(ctx, cfg, S) {
    setFont(ctx, 700, S, MONO);
    const m0 = ctx.measureText("0");
    const cw = m0.width;
    const capH = m0.actualBoundingBoxAscent || S * 0.73;
    const L = { S, cw, capH, items: [], w: 0 };
    // Seitenränder (Bearing) der ersten/letzten Ziffer des Endwerts – für optisch korrekte Abstände/Zentrierung
    ctx.textAlign = "left";
    const fin = Math.abs(cfg.value).toFixed(cfg.dec);
    const mF = ctx.measureText(fin.charAt(0)), mL = ctx.measureText(fin.charAt(fin.length - 1));
    L.leadBearing = cfg.neg ? 0 : clamp(-(mF.actualBoundingBoxLeft || 0), 0, cw * 0.4);
    L.tailBearing = clamp(cw - (mL.actualBoundingBoxRight || cw), 0, cw * 0.4);
    let x = 0;
    // Präfix
    if (cfg.prefix) {
      const sym = CENTER_SYM.test(cfg.prefix);
      const ps = sym ? S * 0.5 : S * 0.3;
      const pw = richWidth(ctx, cfg.prefix, ps);
      L.prefix = { x, w: pw, size: ps, sym };
      x += pw + (cfg.prefixGap ? S * 0.14 : S * 0.07) - L.leadBearing;
    }
    // Vorzeichen-Reserve
    if (cfg.neg) { L.signX0 = x; x += cw * 0.85; }
    // Ziffern
    const nD = cfg.nInt + cfg.dec;
    L.slots = [];
    for (let k = nD - 1; k >= 0; k--) {
      const i = k - cfg.dec; // Stelle im ganzzahligen Teil (0 = Einer)
      L.slots.push({ type: "d", k, x });
      x += cw;
      if (cfg.doGroup && i > 0 && i % 3 === 0) { L.slots.push({ type: "sep", k, x }); x += cw * 0.3; }
      if (cfg.dec > 0 && i === 0) { L.slots.push({ type: "comma", x }); x += cw * 0.62; }
    }
    L.numX1 = x;
    // Einheit
    if (cfg.unit) {
      const u = cfg.unit;
      const sym = u.length <= 2 && !/[A-Za-zÄÖÜäöüß0-9µ]/.test(u);
      const us = sym ? S * 0.52 : S * 0.3;
      const gap = /^[×x·]/.test(u) ? S * 0.05 : sym ? S * 0.1 : S * 0.14;
      const uw = richWidth(ctx, u, us);
      x += gap - L.tailBearing * 0.8;
      setFont(ctx, 700, us, MONO);
      const mu = ctx.measureText(u.replace(/[≥≤≈≠→]/g, "="));
      L.unit = { x, w: uw, size: us, center: CENTER_SYM.test(u), top: TOP_SYM.test(u), asc: mu.actualBoundingBoxAscent || us * 0.7, desc: mu.actualBoundingBoxDescent || 0 };
      x += uw;
    }
    L.w = x;
    L.inkL = L.prefix ? 0 : L.leadBearing;
    L.inkR = L.unit ? 0 : L.tailBearing;
    return L;
  }

  /** Nur cachen, wenn die Web-Fonts geladen sind (sonst würde ein Fallback-Font eingefroren). */
  let FONTS_OK = false;
  function fontsReady() {
    if (FONTS_OK) return true;
    try {
      const f = document.fonts;
      FONTS_OK = !f || (f.check(`700 40px "${MONO}"`) && f.check(`700 40px "${HEAD}"`) && f.check(`400 40px "${BODY}"`));
    } catch (e) { FONTS_OK = true; }
    return FONTS_OK;
  }

  // ---------------- Sprites (einmal gerendert, danach nur 1:1-Blits) ----------------
  // Große Glyphen (> 256 px) rendert Skia als Pfade ohne Masken-Cache; Glow per shadowBlur kostet dann pro Bild
  // mehrere ms. Deshalb: jede Ziffer einmal als Sprite (Glow-Ebene + Verlaufs-Ebene), danach nur noch Blits.
  function canvas(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
    return c;
  }
  const ATLAS = new Map();
  function atlasFor(cfg, NL) {
    const key = cfg.accKey + "|" + NL.S.toFixed(2);
    let A = ATLAS.get(key);
    if (A) return A;
    const B = Math.round(NL.S * 0.09);            // shadowBlur der Ziffern
    const m = Math.ceil(B * 1.4) + 6;              // Rand für den Glow
    A = { key, S: NL.S, cw: NL.cw, capH: NL.capH, B, m, w: Math.ceil(NL.cw + 2 * m), h: Math.ceil(NL.capH + NL.S * 0.3 + 2 * m), bl: m + Math.ceil(NL.capH), glow: {}, crisp: {} };
    ATLAS.set(key, A);
    if (ATLAS.size > 6) ATLAS.delete(ATLAS.keys().next().value);
    return A;
  }
  function glyphSprite(A, acc, ch, kind) {
    const store = A[kind];
    if (store[ch]) return store[ch];
    const c = canvas(A.w, A.h), g = c.getContext("2d");
    setFont(g, 700, A.S, MONO); g.textAlign = "center"; g.textBaseline = "alphabetic";
    // "glow": nur Leuchtschein (für den Aufblitz-Moment); "crisp": Leuchtschein + Ziffer mit Verlauf
    g.shadowColor = `rgba(${acc.rgb},${kind === "glow" ? 0.95 : 0.8})`; g.shadowBlur = A.B; g.fillStyle = acc.main;
    g.fillText(ch, A.w / 2, A.bl);
    if (kind !== "glow") {
      g.shadowBlur = 0; g.shadowColor = "rgba(0,0,0,0)";
      const gr = g.createLinearGradient(0, A.bl - A.capH, 0, A.bl + A.S * 0.05);
      gr.addColorStop(0, acc.hi); gr.addColorStop(0.45, acc.main); gr.addColorStop(1, acc.deep);
      g.fillStyle = gr; g.fillText(ch, A.w / 2, A.bl);
    }
    if (fontsReady()) store[ch] = c;
    return c;
  }
  /** Präfix bzw. Einheit (einfarbig mit Glow) als Sprite; Anker = Grundlinie der Zahl. */
  function richSprite(cfg, L, part) {
    const key = "_spr_" + part;
    if (cfg[key] !== undefined) return cfg[key];
    cfg[key] = null;
    const it = L[part]; const str = part === "prefix" ? cfg.prefix : cfg.unit;
    if (!it || !str) return null;
    const S = L.S, capH = L.capH, B = Math.round(S * 0.055), m = Math.ceil(B * 1.4) + 6;
    const bl = m + Math.ceil(S * 1.0), mid = bl - capH / 2;
    const c = canvas(it.w + 2 * m + S * 0.1, bl + S * 0.35 + m), g = c.getContext("2d");
    g.shadowColor = `rgba(${cfg.acc.rgb},0.9)`; g.shadowBlur = B; g.fillStyle = cfg.acc.main;
    let ub = bl, axis = mid;
    if (part === "prefix") { if (it.sym) ub = mid + it.size * 0.34; else axis = bl - it.size * 0.34; }
    else if (it.center) ub = mid + (it.asc - it.desc) / 2;
    else if (it.top) ub = bl - capH + it.asc;
    drawRich(g, str, m, ub, it.size, axis);
    const res = { c, m, bl };
    if (fontsReady()) cfg[key] = res; else cfg[key] = undefined;
    return res;
  }
  /** Warmer Dunst hinter der Zahl (Radialverlauf einmal in ein Sprite). */
  function hazeSprite(cfg, rx, ry) {
    if (cfg._haze) return cfg._haze;
    const c = canvas(rx * 2, ry * 2), g = c.getContext("2d");
    g.translate(rx, ry); g.scale(rx / ry, 1);
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, ry);
    rg.addColorStop(0, `rgba(${cfg.acc.rgb},0.3)`); rg.addColorStop(0.45, `rgba(${cfg.acc.rgb},0.12)`); rg.addColorStop(1, `rgba(${cfg.acc.rgb},0)`);
    g.fillStyle = rg; g.beginPath(); g.arc(0, 0, ry, 0, TAU); g.fill();
    cfg._haze = c;
    return c;
  }

  /** Zeichnet Präfix, Ziffern (mechanisches Zählwerk mit rollenden Stellen) und Einheit aus Sprites. */
  function drawNumber(ctx, cfg, L, st) {
    const { x0, base, acc, alpha } = st;
    const cw = L.cw, capH = L.capH;
    const A = atlasFor(cfg, L);
    const X = st.x, spdX = st.spdX; // X = |v|·10^dec (kontinuierlich), spdX = |dX/dt|
    const travel = Math.round(capH * 0.78);
    const blit = (ch, gx, off, a, glowA) => {
      if (!ch || a <= 0.004) return;
      const ao = Math.abs(off); if (ao >= 0.999) return;
      const k = Math.pow(1 - ao, 1.7);
      const dx = Math.round(gx - A.w / 2), dy = Math.round(base + off * travel - A.bl);
      if (glowA > 0) { ctx.globalAlpha = clamp(a * k * glowA); ctx.drawImage(glyphSprite(A, acc, ch, "glow"), dx, dy); }
      ctx.globalAlpha = clamp(a * k); ctx.drawImage(glyphSprite(A, acc, ch, "crisp"), dx, dy);
    };
    ctx.save();
    let leftVisible = null;
    for (const sl of L.slots) {
      if (sl.type === "comma") { blit(",", x0 + sl.x + cw * 0.31, 0, alpha, st.glowA); continue; }
      if (sl.type !== "d") continue;
      const k = sl.k, p10 = Math.pow(10, k);
      const q = X / p10, fq = Math.floor(q + 1e-9);
      const d0 = ((fq % 10) + 10) % 10;
      let f;
      if (k === 0) f = q - fq;
      else { const r = X - fq * p10; f = Math.max(0, r - (p10 - 1)); }
      f = clamp(f, 0, 0.99999);
      const lead = k > cfg.dec && fq === 0; // führende Null -> leer
      if ((lead ? f : 1) > 0.02 && leftVisible === null) leftVisible = sl.x;
      // Rollen nur im letzten Teil jedes Schritts (mechanischer Takt); schnelle Stellen rasten ein + Bewegungsunschärfe
      const b = clamp((spdX / p10 - 5) / 12);
      const fr = sm((f - 0.45) / 0.55) * (1 - b);
      const gx = x0 + sl.x + cw / 2;
      const chA = lead ? "" : String(d0), chB = String((d0 + 1) % 10);
      const am = alpha * (1 - 0.3 * b);
      if (fr > 0.002) { blit(chA, gx, -fr, am, st.glowA); blit(chB, gx, 1 - fr, am, st.glowA); }
      else blit(chA, gx, 0, am, st.glowA);
      if (b > 0.02 && !lead) { blit(String((d0 + 9) % 10), gx, -0.5, alpha * 0.35 * b, 0); blit(chB, gx, 0.5, alpha * 0.35 * b, 0); }
    }
    if (st.negNow && leftVisible !== null) blit("−", x0 + leftVisible - cw * 0.45, 0, alpha * st.negA, st.glowA);
    for (const part of ["prefix", "unit"]) {
      const sp = richSprite(cfg, L, part);
      if (!sp) continue;
      ctx.globalAlpha = alpha * (part === "prefix" ? 0.92 : 0.95);
      ctx.drawImage(sp.c, Math.round(x0 + L[part].x - sp.m), Math.round(base - sp.bl));
    }
    ctx.restore();
  }

  // ---------------- Instrument / Gauge ----------------
  /** Winkelintervalle eines Kreises r in [a, b], die NICHT in einer der Boxen liegen (Boxen relativ zum Zentrum). */
  function pieces(r, a, b, boxes) {
    if (b <= a) return [];
    if (!boxes.length) return [[a, b]];
    const out = []; const step = 0.6 * DEG; let s = null;
    const n = Math.max(2, Math.ceil((b - a) / step));
    for (let i = 0; i <= n; i++) {
      const ang = a + ((b - a) * i) / n;
      const x = r * Math.cos(ang), y = r * Math.sin(ang);
      let inside = false;
      for (const bx of boxes) if (x > bx.x0 && x < bx.x1 && y > bx.y0 && y < bx.y1) { inside = true; break; }
      if (!inside && s === null) s = ang;
      if (inside && s !== null) { out.push([s, ang]); s = null; }
    }
    if (s !== null) out.push([s, b]);
    return out.filter((q) => q[1] - q[0] > 0.2 * DEG);
  }
  const inBoxes = (x, y, boxes) => { for (const bx of boxes) if (x > bx.x0 && x < bx.x1 && y > bx.y0 && y < bx.y1) return true; return false; };
  function arcPath(c, cx, cy, r, list) { for (const [s, e] of list) { c.moveTo(cx + r * Math.cos(s), cy + r * Math.sin(s)); c.arc(cx, cy, r, s, e); } }

  /** Ein einzelner Strich-Durchgang (günstiger als glowPath, wenn kein Glow nötig ist). */
  function stroke(ctx, build, color, width, alpha, cap) {
    ctx.globalAlpha = alpha ?? 1; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = cap || "butt";
    ctx.beginPath(); build(ctx); ctx.stroke();
  }

  function drawGauge(ctx, Lb, cx, cy, g) {
    const { t, acc, boxes, reveal, prog, done, breath } = g;
    const rv = (i) => eo3(seg(reveal, i * 0.09, 0.62));
    const revA = (i) => A0 + SPAN * rv(i);
    const P = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    const radial = (c, a, r0, r1) => { const p0 = P(r0, a), p1 = P(r1, a); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); };
    ctx.save();
    ctx.lineJoin = "round";

    // feiner Innenring mit Gradteilung (alle 10°)
    {
      const aE = revA(4);
      const pc = pieces(R_FINE, A0, aE, boxes);
      stroke(ctx, (c) => {
        arcPath(c, cx, cy, R_FINE, pc);
        for (let a = A0; a <= aE + 1e-6; a += 10 * DEG) if (!inBoxes(R_FINE * Math.cos(a), R_FINE * Math.sin(a), boxes)) radial(c, a, R_FINE, R_FINE - 7);
      }, `rgba(${CYR},0.26)`, 1.2, 1);
    }

    // HUD-Segmente (rotierend, nur innerhalb der Skala) + gegenläufige Marken
    {
      const rot = t * 14 * DEG, aMax = revA(3);
      const segs = [];
      for (let i = 0; i < 3; i++) {
        const s0 = A0 + (((rot + i * 120 * DEG) % TAU) + TAU) % TAU;
        for (const off of [-TAU, 0]) {
          const ca = Math.max(s0 + off, A0), cb = Math.min(s0 + off + 30 * DEG, aMax);
          if (cb > ca) for (const q of pieces(R_HUD, ca, cb, boxes)) segs.push(q);
        }
      }
      stroke(ctx, (c) => arcPath(c, cx, cy, R_HUD, segs), `rgba(${CYR},0.5)`, 3, 1);
      const rot2 = -t * 22 * DEG;
      stroke(ctx, (c) => {
        for (let i = 0; i < 6; i++) {
          let a = A0 + ((((rot2 + i * 60 * DEG) % TAU) + TAU) % TAU); if (a > A1) a -= TAU;
          if (a < A0 || a > aMax || inBoxes(R_HUD * Math.cos(a), R_HUD * Math.sin(a), boxes)) continue;
          radial(c, a, R_HUD - 7, R_HUD + 7);
        }
      }, "#7fe0ff", 2, 0.75);
    }

    // Lichtfluss-Ring (laufende Punkte)
    {
      const pc = pieces(R_FLOW, A0, revA(2), boxes);
      ctx.setLineDash([2.5, 11]); ctx.lineDashOffset = -t * 26;
      stroke(ctx, (c) => arcPath(c, cx, cy, R_FLOW, pc), `rgba(${CYR},0.55)`, 2.4, 1, "round");
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
    }

    // Bogen: Spur + Fortschritt
    const aProg = A0 + SPAN * clamp(prog);
    {
      const aE = revA(1);
      const track = pieces(R_ARC, A0, aE, boxes);
      stroke(ctx, (c) => arcPath(c, cx, cy, R_ARC, track), `rgba(${CYR},0.10)`, 12, 1);
      stroke(ctx, (c) => {
        arcPath(c, cx, cy, R_ARC + 7, track); arcPath(c, cx, cy, R_ARC - 7, track);
        if (reveal > 0.05) for (const a of [A0, aE]) if (!inBoxes(R_ARC * Math.cos(a), R_ARC * Math.sin(a), boxes)) radial(c, a, R_ARC - 12, R_ARC + 12);
      }, `rgba(${CYR},0.34)`, 1.2, 1);
      const pa = Math.min(aProg, aE);
      if (pa > A0 + 0.3 * DEG) {
        const fill = pieces(R_ARC, A0, pa, boxes);
        const gl = 1 + 0.35 * breath;
        stroke(ctx, (c) => arcPath(c, cx, cy, R_ARC, fill), acc.main, 22, 0.12 * gl);
        stroke(ctx, (c) => arcPath(c, cx, cy, R_ARC, fill), acc.main, 6, 1);
        stroke(ctx, (c) => arcPath(c, cx, cy, R_ARC, fill), acc.hi, 1.6, 0.8);
      }
      // Zeiger am Kopf (auch bei 0 sichtbar, sobald die Skala steht)
      if (reveal > 0.6 && pa >= A0) {
        const [hx, hy] = P(R_ARC, pa);
        if (!inBoxes(hx - cx, hy - cy, boxes)) {
          Lb.glowDot(ctx, hx, hy, 30 + 8 * breath, acc.main, (0.55 + 0.25 * breath) * sm((reveal - 0.6) / 0.4));
          ctx.globalAlpha = 1;
          stroke(ctx, (c) => radial(c, pa, R_ARC - 20, R_TICK + 8), acc.main, 7, 0.25);
          stroke(ctx, (c) => radial(c, pa, R_ARC - 20, R_TICK + 8), acc.hi, 3, 1);
          ctx.globalAlpha = 1; ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(hx, hy, 5.5, 0, TAU); ctx.fill();
        }
      }
    }

    // Teilstriche (240° / 3° = 80 Teilungen); beleuchtet bis zum Zeiger
    {
      const aE = revA(0);
      const litMinor = [], litMajor = [], offMinor = [], offMajor = [];
      for (let i = 0; i <= 80; i++) {
        const a = A0 + i * 3 * DEG;
        if (a > aE + 1e-6) break;
        if (inBoxes(R_TICK * Math.cos(a), R_TICK * Math.sin(a), boxes)) continue;
        const len = i % 10 === 0 ? 24 : i % 5 === 0 ? 15 : 8;
        const lit = a <= aProg + 1e-6;
        (len > 8 ? (lit ? litMajor : offMajor) : (lit ? litMinor : offMinor)).push([a, len]);
      }
      const build = (list, ext = 0) => (c) => { for (const [a, len] of list) radial(c, a, R_TICK, R_TICK - len - ext); };
      stroke(ctx, build(offMinor), `rgba(${CYR},0.32)`, 2, 1);
      stroke(ctx, build(offMajor), `rgba(${CYR},0.66)`, 3, 1);
      stroke(ctx, build(litMinor), acc.main, 2, 0.85);
      stroke(ctx, build(litMajor), acc.main, 9, 0.16);
      stroke(ctx, build(litMajor), acc.hi, 3, 1);
      // wandernder Abtastlichtpunkt über die Teilung (dauerhafte Bewegung)
      if (reveal > 0.9) {
        const ph = ((t / 3.2) % 1) * 1.35 - 0.15;
        const sa = A0 + SPAN * ph;
        const core = [], halo = [];
        for (let i = 0; i <= 80; i++) {
          const a = A0 + i * 3 * DEG, dd = Math.abs(a - sa) / DEG;
          if (dd >= 8 || inBoxes(R_TICK * Math.cos(a), R_TICK * Math.sin(a), boxes)) continue;
          const len = (i % 10 === 0 ? 24 : i % 5 === 0 ? 15 : 8) + 4;
          (dd < 3.5 ? core : halo).push([a, len]);
        }
        stroke(ctx, build(halo), "#dff6ff", 2, 0.35);
        stroke(ctx, build(core), "#dff6ff", 2.2, 0.85);
      }
    }

    // Abschluss-Ping
    if (done > 0 && done < 1) {
      const q = done;
      const r = R_ARC + 34 * eo3(q);
      const pc = pieces(r, A0, A1, boxes);
      stroke(ctx, (c) => arcPath(c, cx, cy, r, pc), acc.main, 10 * (1 - q) + 2, (1 - q) * 0.25);
      stroke(ctx, (c) => arcPath(c, cx, cy, r, pc), acc.hi, 3 * (1 - q) + 1, (1 - q) * 0.9);
    }
    ctx.restore();
  }

  // ---------------- Texte (Label / Sublabel) ----------------
  /** "Text mit *Akzent*" -> Wörter mit Läufen [{t, em}] */
  function parseEm(s) {
    const words = []; let em = false; let cur = []; let buf = "";
    const flush = () => { if (buf) { cur.push({ t: buf, em }); buf = ""; } };
    const endWord = () => { flush(); if (cur.length) words.push(cur); cur = []; };
    for (const ch of String(s)) {
      if (ch === "*") { flush(); em = !em; }
      else if (/\s/.test(ch)) endWord();
      else buf += ch;
    }
    endWord();
    return words;
  }
  function layoutLines(ctx, words, maxW, font) {
    setFont(ctx, font.weight, font.size, font.family, font.ls);
    const sp = ctx.measureText(" ").width + (font.ls || 0);
    const ww = words.map((w) => w.reduce((s, r) => s + ctx.measureText(r.t).width, 0));
    const lines = []; let cur = [], cw = 0;
    words.forEach((w, i) => {
      const add = (cur.length ? sp : 0) + ww[i];
      if (cur.length && cw + add > maxW) { lines.push({ words: cur, w: cw }); cur = [i]; cw = ww[i]; }
      else { cur.push(i); cw += add; }
    });
    if (cur.length) lines.push({ words: cur, w: cw });
    return { lines, sp, ww };
  }
  /** Probiert [size, maxLines]-Stufen durch, bis der Text passt. */
  function fitText(ctx, raw, opts) {
    const words = parseEm(opts.caps ? upper(raw) : raw);
    if (!words.length) return null;
    let res = null;
    for (const [size, maxLines] of opts.tries) {
      const font = { weight: opts.weight, size, family: opts.family, ls: opts.ls ? opts.ls * (size / opts.tries[0][0]) : 0 };
      const lay = layoutLines(ctx, words, opts.maxW, font);
      res = { words, font, ...lay, maxLines };
      if (lay.lines.length <= maxLines && lay.lines.every((l) => l.w <= opts.maxW * 1.02)) return res;
    }
    res.lines = res.lines.slice(0, res.maxLines);
    return res;
  }
  function drawLine(ctx, T, line, cx, y, colors) {
    setFont(ctx, T.font.weight, T.font.size, T.font.family, T.font.ls);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    let x = cx - line.w / 2;
    line.words.forEach((wi, j) => {
      if (j) x += T.sp;
      for (const r of T.words[wi]) {
        ctx.fillStyle = r.em ? colors.em : colors.base;
        ctx.shadowColor = r.em ? colors.emGlow : colors.glow;
        ctx.fillText(r.t, x, y);
        x += ctx.measureText(r.t).width;
      }
    });
  }

  // ---------------- Schwebeteilchen ----------------
  function motes(ctx, cx, cy, t, a, acc) {
    if (a <= 0) return;
    ctx.save();
    for (let i = 0; i < 16; i++) {
      const ang = h01(i * 3.7) * TAU + t * (0.05 + 0.08 * h01(i * 1.9)) * (i % 2 ? 1 : -1);
      const rr = 150 + 260 * h01(i * 5.3) + 10 * Math.sin(t * 0.7 + i);
      const x = cx + Math.cos(ang) * rr * 1.25, y = cy + Math.sin(ang) * rr * 0.9 - ((t * (6 + 8 * h01(i))) % 40);
      if (y > 900 || y < 100) continue;
      const tw = 0.5 + 0.5 * Math.sin(t * (1.3 + h01(i * 9.1)) + i * 2.1);
      const sz = 2 + 2.5 * h01(i * 7.7);
      ctx.globalAlpha = a * (0.12 + 0.3 * tw);
      ctx.fillStyle = i % 5 === 0 ? acc.main : "#9fe6ff";
      ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    }
    ctx.restore();
  }

  // ---------------- Layout (einmal pro Konfiguration) ----------------
  function layout(ctx, cfg, W) {
    if (cfg._lay) return cfg._lay;
    const cx = W / 2;
    const lab = cfg.label ? fitText(ctx, cfg.label, { caps: true, family: HEAD, weight: 700, tries: [[60, 1], [54, 1], [52, 2], [46, 2], [40, 3]], ls: 4, maxW: 1500 }) : null;
    const subT = cfg.sublabel ? fitText(ctx, cfg.sublabel, { caps: false, family: BODY, weight: 400, tries: [[36, 1], [34, 2], [30, 2], [28, 3]], maxW: 1320 }) : null;
    const labLH = lab ? lab.font.size * 1.14 : 0;
    const subLH = subT ? subT.font.size * 1.38 : 0;
    const labH = lab ? lab.font.size * 0.74 + (lab.lines.length - 1) * labLH : 0;
    const subH = subT ? subT.font.size * 0.74 + (subT.lines.length - 1) * subLH + subT.font.size * 0.24 : 0;
    const gapLS = lab && subT ? 64 : 0;
    const textH = labH + gapLS + subH;
    const gTopOff = R_TICK + 6;          // Oberkante des Instruments über cy
    const textOff = R_TICK * 0.5 + 58;   // Beginn der Texte unter cy (unterhalb der Skalen-Enden)
    // Block vertikal im Bereich [96, 905] zentrieren (Untertitelzone frei)
    const blockH = gTopOff + textOff + textH;
    let cy = clamp(500 - blockH / 2 + gTopOff, 96 + gTopOff, 480);
    const over = cy + textOff + textH - 905;
    if (over > 0) cy = Math.max(96 + gTopOff, cy - over);
    // Zahl: Schriftgröße so, dass Präfix+Zahl+Einheit ≤ 1480 px
    const L100 = numberLayout(ctx, cfg, 100);
    const S = clamp((1480 / Math.max(1, L100.w)) * 100, 84, 285);
    const NL = numberLayout(ctx, cfg, S);
    const pad = 26;
    const wide = (NL.w - NL.inkL - NL.inkR) / 2 + pad > R_FINE - 8;
    const numMid = cy + (wide ? 30 : -4);
    const base = Math.round(numMid + NL.capH / 2);
    const x0 = Math.round(cx - (NL.inkL + NL.w - NL.inkR) / 2);
    const box = { x0: x0 + NL.inkL - pad - cx, x1: x0 + NL.w - NL.inkR + pad - cx, y0: base - NL.capH - pad - cy, y1: base + (cfg.dec > 0 ? S * 0.16 : 0) + pad - cy };
    // breite Zahl schneidet die Ringe seitlich: dann auch die Reststücke darunter weglassen (Skala wird zur „Haube")
    if (wide) box.y1 = 2000;
    const lay = { cx, cy, lab, subT, labLH, subLH, labH, subH, gapLS, textOff, S, NL, wide, numMid, base, x0, boxes: [box] };
    if (fontsReady()) cfg._lay = lay;
    return lay;
  }

  /** Label/Sublabel einmal in ein Sprite rendern (Zeilen-Bänder werden einzeln per Wisch-Maske gezeigt). */
  function textSprite(cfg, key, T, lh, colors, blur) {
    if (cfg[key] !== undefined) return cfg[key];
    cfg[key] = null;
    if (!T) return null;
    const m = 26 + blur;
    const maxW = Math.max(...T.lines.map((l) => l.w));
    const w = maxW + 2 * m, h = T.font.size * 0.74 + (T.lines.length - 1) * lh + T.font.size * 0.3 + 2 * m;
    const c = canvas(w, h), g = c.getContext("2d");
    g.shadowBlur = blur;
    const ys = [];
    let y = m + T.font.size * 0.74;
    for (const line of T.lines) { drawLine(g, T, line, c.width / 2, y, colors); ys.push(y); y += lh; }
    const res = { c, ys };
    if (fontsReady()) cfg[key] = res; else cfg[key] = undefined;
    return res;
  }

  // ---------------- Template ----------------
  CEX.register("stat_counter", {
    ownsText: true,
    draw(ctx, p) {
      const Lb = p.L; const W = p.W || 1920;
      const t = Math.max(0, +p.t || 0), d = Math.max(0.5, +p.d || 6);
      const fps = p.fps || 30;
      const cfg = config(p);
      const acc = cfg.acc;
      const lay = layout(ctx, cfg, W);
      const { cx, cy, lab, subT, S, NL, numMid, base, x0, boxes } = lay;

      // --- Zeitsteuerung (relativ zu d) ---
      const tIn = clamp(0.12 * d, 0.5, 1.4);
      const reveal = seg(t, 0, tIn);
      const cStart = 0.03 * d, cEnd = 0.45 * d;
      const cu = seg(t, cStart, cEnd - cStart);
      const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
      const valAt = (tt) => {
        const q = seg(tt, cStart, cEnd - cStart);
        return q >= 1 ? cfg.value : cfg.from + (cfg.value - cfg.from) * ease(q);
      };
      const v = valAt(t);
      const vPrev = valAt(t - 1 / fps);
      const p10d = Math.pow(10, cfg.dec);
      const X = Math.round(Math.abs(v) * p10d * 1e6) / 1e6;
      const spdX = Math.abs(Math.abs(v) - Math.abs(vPrev)) * p10d * fps;
      const done = t >= cEnd ? seg(t, cEnd, 0.9) : 0;
      const flash = done > 0 && done < 1 ? 1 - done : 0;
      const breath = t >= cEnd ? 0.5 - 0.5 * Math.cos(((t - cEnd) / 2.4) * TAU) : 0;
      const numIn = sm(seg(t, 0.05, Math.min(0.5, 0.1 * d)));

      motes(ctx, cx, cy, t, sm(reveal), acc);

      // --- Instrument ---
      const prog = (v - cfg.sMin) / (cfg.sMax - cfg.sMin);
      drawGauge(ctx, Lb, cx, cy, { t, acc, boxes, reveal, prog, done, breath });

      // Skalenbeschriftung (nur mit explizitem max)
      if (cfg.showScale && !lay.wide && reveal > 0.3) {
        const sa = sm(seg(reveal, 0.4, 0.6));
        for (const [a, val] of [[A0, cfg.sMin], [A1, cfg.sMax]]) {
          const lx = cx + (R_TICK - 6) * Math.cos(a), ly = cy + (R_TICK - 6) * Math.sin(a) + 40;
          Lb.text(ctx, fmtDe(val, Math.abs(val - Math.round(val)) > 1e-9 ? Math.min(2, cfg.dec || 1) : 0, cfg.doGroup ? true : "auto"), lx, ly, { font: MONO, weight: 700, size: 26, color: MUTED, align: "center", alpha: sa * 0.9 });
        }
      }

      // --- Zahl (Glow-Ebene + scharfe Ziffern), mit dezentem Puls ---
      // Skalierung nur beim Einblenden und beim „Einrasten" (dauerhafte Skalierung würde den Glyph-Cache umgehen)
      const pop = 0.018 * Math.sin(done * Math.PI) * flash;
      const pulseS = (1 + pop) * (0.97 + 0.03 * numIn);
      const negNow = v < 0 && X >= 0.5;
      const st = { x0, base, acc, alpha: numIn, x: X, spdX, negNow, negA: 1 };
      ctx.save();
      if (Math.abs(pulseS - 1) > 1e-4) { ctx.translate(cx, numMid); ctx.scale(pulseS, pulseS); ctx.translate(-cx, -numMid); }
      const ha = (0.6 + 0.15 * cu + 0.3 * breath + 0.5 * flash) * numIn;
      const hrx = Math.round(Math.max(240, (NL.w - NL.inkL - NL.inkR) * 0.52)), hry = Math.round(Math.max(140, NL.capH * 0.74));
      ctx.globalAlpha = clamp(ha); ctx.drawImage(hazeSprite(cfg, hrx, hry), cx - hrx, Math.round(numMid - hry)); ctx.globalAlpha = 1;
      st.glowA = 0.9 * flash; // zusätzlicher Leuchtschein nur beim Einrasten
      drawNumber(ctx, cfg, NL, st);
      ctx.restore();

      // --- Label (Wisch-Enthüllung von der Mitte, mit Scan-Kanten) ---
      let y = cy + lay.textOff;
      if (lab) {
        const lStart = 0.12 * d, lDur = clamp(0.1 * d, 0.45, 1.0);
        const wr = eo3(seg(t, lStart, lDur));
        const la = sm(seg(t, lStart, lDur * 0.6));
        let ly = y + lab.font.size * 0.74;
        lab.lines.forEach((line, i) => {
          const wl = eo3(seg(t, lStart + i * 0.12 * lDur, lDur));
          if (wl > 0) {
            const half = (line.w / 2 + 30) * wl;
            ctx.save();
            ctx.beginPath(); ctx.rect(cx - half, ly - lab.font.size * 1.1, half * 2, lab.font.size * 1.5); ctx.clip();
            ctx.globalAlpha = la;
            const sp = textSprite(cfg, "_labSpr", lab, lay.labLH, { base: WHITE, glow: "rgba(63,210,255,0.55)", em: acc.main, emGlow: `rgba(${acc.rgb},0.8)` }, 16);
            if (sp) ctx.drawImage(sp.c, Math.round(cx - sp.c.width / 2), Math.round(ly + (1 - wr) * 6 - sp.ys[i]));
            ctx.restore();
            if (wl < 1) {
              const ea = Math.sin(wl * Math.PI) * 0.9;
              for (const sx of [cx - half, cx + half]) Lb.line(ctx, sx, ly - lab.font.size * 0.95, sx, ly + lab.font.size * 0.22, "#bff0ff", 2, 1, { alpha: ea, cap: "butt" });
            }
          }
          ly += lay.labLH;
        });
        y += lay.labH;
      }
      // --- Trenner + Sublabel ---
      if (subT) {
        const sStart = (lab ? 0.24 : 0.14) * d, sDur = clamp(0.1 * d, 0.45, 1.0);
        const dv = eo3(seg(t, sStart - 0.2 * sDur, sDur));
        if (lab) {
          // Trenner: breite, zu den Enden ausblendende Linie mit Raute (liest sich nicht als Unterstreichung)
          const dy = Math.round(y + lay.gapLS * 0.5) + 0.5;
          const hwD = Math.min(340, Math.max(...lab.lines.map((l) => l.w)) * 0.5) * dv;
          if (dv > 0.01) {
            ctx.save();
            const lgd = ctx.createLinearGradient(cx - hwD, 0, cx + hwD, 0);
            lgd.addColorStop(0, `rgba(${CYR},0)`); lgd.addColorStop(0.5, `rgba(${CYR},0.55)`); lgd.addColorStop(1, `rgba(${CYR},0)`);
            ctx.strokeStyle = lgd; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - hwD, dy); ctx.lineTo(cx + hwD, dy); ctx.stroke();
            ctx.globalAlpha = dv; ctx.fillStyle = acc.main;
            ctx.beginPath(); ctx.moveTo(cx, dy - 6); ctx.lineTo(cx + 6, dy); ctx.lineTo(cx, dy + 6); ctx.lineTo(cx - 6, dy); ctx.closePath(); ctx.fill();
            ctx.restore();
          }
          y += lay.gapLS;
        }
        const sa = sm(seg(t, sStart, sDur));
        if (sa > 0) {
          const sy = y + subT.font.size * 0.74 + (1 - sa) * 10;
          const sp = textSprite(cfg, "_subSpr", subT, lay.subLH, { base: MUTED, glow: "rgba(0,0,0,0)", em: acc.hi, emGlow: "rgba(0,0,0,0)" }, 0);
          if (sp) { ctx.save(); ctx.globalAlpha = sa; ctx.drawImage(sp.c, Math.round(cx - sp.c.width / 2), Math.round(sy - sp.ys[0])); ctx.restore(); }
        }
      }
    },
  });
})();
