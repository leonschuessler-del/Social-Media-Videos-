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
  const CFG_CACHE = new WeakMap();
  function config(p) {
    const P = isObj(p.params) ? p.params : {};
    const txt = str(p.text);
    const hit = CFG_CACHE.get(P);
    if (hit && hit.txt === txt) return hit.cfg;
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
    CFG_CACHE.set(P, { txt, cfg });
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
    ctx.lineWidth = size * 0.085; ctx.lineCap = "butt"; ctx.lineJoin = "miter"; ctx.miterLimit = 6;
    ctx.beginPath();
    if (ch === "≥" || ch === "≤") {
      const s = ch === "≥" ? 1 : -1;
      ctx.moveTo(cx - s * hw, axis - 0.25 * size); ctx.lineTo(cx + s * hw, axis - 0.09 * size); ctx.lineTo(cx - s * hw, axis + 0.07 * size);
      ctx.moveTo(cx - hw, axis + 0.23 * size); ctx.lineTo(cx + hw, axis + 0.23 * size);
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
    let x = 0;
    // Präfix
    if (cfg.prefix) {
      const sym = CENTER_SYM.test(cfg.prefix);
      const ps = sym ? S * 0.46 : S * 0.3;
      const pw = richWidth(ctx, cfg.prefix, ps);
      L.prefix = { x, w: pw, size: ps, sym };
      x += pw + (cfg.prefixGap ? S * 0.14 : S * 0.07);
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
      x += gap;
      setFont(ctx, 700, us, MONO);
      const mu = ctx.measureText(u.replace(/[≥≤≈≠→]/g, "="));
      L.unit = { x, w: uw, size: us, center: CENTER_SYM.test(u), top: TOP_SYM.test(u), asc: mu.actualBoundingBoxAscent || us * 0.7, desc: mu.actualBoundingBoxDescent || 0 };
      x += uw;
    }
    L.w = x;
    return L;
  }

  // ---------------- Rollende Ziffer (Zählwerk-Fenster) ----------------
  /** Ziffer im Zählwerk-Fenster, um off (Anteil des Rollwegs, −1…1) verschoben, leicht gestaucht wie auf einer Trommel. */
  function slideGlyph(ctx, ch, gx, mid, capH, off, alpha, lg) {
    if (!ch) return;
    const ao = Math.abs(off); if (ao >= 0.999) return;
    const travel = capH * 0.78;
    ctx.save();
    ctx.globalAlpha = alpha * Math.pow(1 - ao, 1.7);
    ctx.translate(gx, mid + off * travel); ctx.scale(1, 1 - 0.38 * ao);
    ctx.fillStyle = lg; // Verlauf im lokalen Glyph-System
    ctx.fillText(ch, 0, capH / 2);
    ctx.restore();
  }

  function drawNumber(ctx, cfg, L, st) {
    const { x0, base, acc, alpha, glow } = st;
    const S = L.S, cw = L.cw, capH = L.capH, mid = base - capH / 2;
    const X = st.x, spdX = st.spdX; // X = |v|·10^dec (kontinuierlich), spdX = |dX/dt|
    ctx.save();
    // Farbverlauf der Ziffern
    const grad = ctx.createLinearGradient(0, base - capH, 0, base + S * 0.05);
    grad.addColorStop(0, acc.hi); grad.addColorStop(0.45, acc.main); grad.addColorStop(1, acc.deep);
    const lg = ctx.createLinearGradient(0, -capH / 2, 0, capH / 2 + S * 0.05);
    lg.addColorStop(0, acc.hi); lg.addColorStop(0.45, acc.main); lg.addColorStop(1, acc.deep);
    setFont(ctx, 700, S, MONO);
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = grad; ctx.shadowColor = `rgba(${acc.rgb},0.9)`; ctx.shadowBlur = glow;
    let leftVisible = null;
    for (const sl of L.slots) {
      const gx = x0 + sl.x + cw / 2;
      if (sl.type === "d") {
        const k = sl.k, p10 = Math.pow(10, k);
        const q = X / p10, fq = Math.floor(q + 1e-9);
        const d0 = ((fq % 10) + 10) % 10;
        let f;
        if (k === 0) f = q - fq;
        else { const r = X - fq * p10; f = Math.max(0, r - (p10 - 1)); }
        f = clamp(f, 0, 0.99999);
        const lead = k > cfg.dec && fq === 0; // führende Null -> leer
        const chA = lead ? "" : String(d0);
        const chB = String((d0 + 1) % 10);
        const vis = lead ? f : 1;
        if (vis > 0.02 && leftVisible === null) leftVisible = sl.x;
        // Rollen nur im letzten Teil jedes Schritts (mechanischer Takt); schnelle Stellen rasten ein + Bewegungsunschärfe
        const spd = spdX / p10;
        const b = clamp((spd - 5) / 12);
        const fr = sm((f - 0.35) / 0.65) * (1 - b);
        if (fr > 0.002 || b > 0.02) {
          const am = alpha * (1 - 0.3 * b);
          if (fr > 0.002) {
            slideGlyph(ctx, chA, gx, mid, capH, -fr, am, lg);
            slideGlyph(ctx, chB, gx, mid, capH, 1 - fr, am, lg);
          } else slideGlyph(ctx, chA, gx, mid, capH, 0, am, lg);
          if (b > 0.02 && !lead) {
            slideGlyph(ctx, String((d0 + 9) % 10), gx, mid, capH, -0.5, alpha * 0.45 * b, lg);
            slideGlyph(ctx, chB, gx, mid, capH, 0.5, alpha * 0.45 * b, lg);
          }
        } else if (chA) {
          ctx.globalAlpha = alpha;
          ctx.fillText(chA, gx, base);
        }
      } else if (sl.type === "comma") {
        ctx.globalAlpha = alpha;
        ctx.fillText(",", x0 + sl.x + cw * 0.31, base);
      }
    }
    // Minuszeichen links der ersten sichtbaren Ziffer
    if (st.negNow && leftVisible !== null) {
      ctx.globalAlpha = alpha * st.negA;
      ctx.fillText("−", x0 + leftVisible - cw * 0.45, base);
    }
    // Präfix / Einheit
    ctx.shadowBlur = glow * 0.6;
    ctx.fillStyle = acc.main;
    if (L.prefix) {
      ctx.globalAlpha = alpha * 0.92;
      const pr = L.prefix;
      const axis = pr.sym ? mid : base - pr.size * 0.34;
      drawRich(ctx, cfg.prefix, x0 + pr.x, pr.sym ? mid + pr.size * 0.34 : base, pr.size, axis);
    }
    if (L.unit) {
      ctx.globalAlpha = alpha * 0.95;
      const un = L.unit;
      let ub = base;
      if (un.center) ub = mid + (un.asc - un.desc) / 2;
      else if (un.top) ub = base - capH + un.asc;
      drawRich(ctx, cfg.unit, x0 + un.x, ub, un.size, mid);
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

  function drawGauge(ctx, Lb, cx, cy, g) {
    const { t, acc, boxes, reveal, prog, done, breath } = g;
    const C = Lb.C;
    // Linse / Tiefe
    ctx.save();
    const lens = ctx.createRadialGradient(cx, cy, 40, cx, cy, R_TICK + 40);
    lens.addColorStop(0, "rgba(14,36,70,0.55)"); lens.addColorStop(0.7, "rgba(10,28,58,0.28)"); lens.addColorStop(1, "rgba(6,16,34,0)");
    ctx.globalAlpha = sm(reveal * 1.6);
    ctx.fillStyle = lens; ctx.beginPath(); ctx.arc(cx, cy, R_TICK + 40, 0, TAU); ctx.fill();
    ctx.restore();

    const rv = (i) => eo3(seg(reveal, i * 0.09, 0.62));
    const revA = (i) => A0 + SPAN * rv(i);

    // feiner Innenring mit Gradteilung
    {
      const aE = revA(4);
      const pc = pieces(R_FINE, A0, aE, boxes);
      Lb.glowPath(ctx, (c) => arcPath(c, cx, cy, R_FINE, pc), `rgba(${CYR},0.22)`, 1.2, 0);
      Lb.glowPath(ctx, (c) => {
        for (let a = A0; a <= aE + 1e-6; a += 10 * DEG) {
          const x1 = cx + R_FINE * Math.cos(a), y1 = cy + R_FINE * Math.sin(a);
          if (inBoxes(x1 - cx, y1 - cy, boxes)) continue;
          c.moveTo(x1, y1); c.lineTo(cx + (R_FINE - 7) * Math.cos(a), cy + (R_FINE - 7) * Math.sin(a));
        }
      }, `rgba(${CYR},0.3)`, 1.2, 0, { cap: "butt" });
    }

    // HUD-Segmente (gegenläufig rotierend, innerhalb der Skala)
    {
      const rot = t * 14 * DEG;
      const segs = [];
      for (let i = 0; i < 3; i++) {
        const s0 = A0 + (((rot + i * 120 * DEG) % TAU) + TAU) % TAU;
        for (const off of [-TAU, 0]) {
          const a = s0 + off, b = a + 30 * DEG;
          const ca = Math.max(a, A0), cb = Math.min(b, revA(3));
          if (cb > ca) for (const q of pieces(R_HUD, ca, cb, boxes)) segs.push(q);
        }
      }
      Lb.glowPath(ctx, (c) => arcPath(c, cx, cy, R_HUD, segs), `rgba(${CYR},0.55)`, 3, 0.6, { cap: "butt" });
      // gegenläufige kurze Marken
      const rot2 = -t * 22 * DEG;
      const marks = [];
      for (let i = 0; i < 6; i++) {
        const a = A0 + ((((rot2 + i * 60 * DEG) % TAU) + TAU) % TAU);
        const aa = a > A1 ? a - TAU : a;
        if (aa < A0 || aa > revA(3)) continue;
        const x = R_HUD * Math.cos(aa), y = R_HUD * Math.sin(aa);
        if (!inBoxes(x, y, boxes)) marks.push(aa);
      }
      Lb.glowPath(ctx, (c) => { for (const a of marks) { c.moveTo(cx + (R_HUD - 7) * Math.cos(a), cy + (R_HUD - 7) * Math.sin(a)); c.lineTo(cx + (R_HUD + 7) * Math.cos(a), cy + (R_HUD + 7) * Math.sin(a)); } }, C.cyan, 2, 0.5, { cap: "butt", alpha: 0.7 });
    }

    // Lichtfluss-Ring (laufende Punkte)
    {
      const pc = pieces(R_FLOW, A0, revA(2), boxes);
      ctx.save();
      ctx.setLineDash([2.5, 11]); ctx.lineDashOffset = -t * 26;
      ctx.strokeStyle = `rgba(${CYR},0.55)`; ctx.lineWidth = 2.4; ctx.lineCap = "round";
      ctx.beginPath(); arcPath(ctx, cx, cy, R_FLOW, pc); ctx.stroke();
      ctx.restore();
    }

    // Bogen: Spur + Fortschritt
    const aProg = A0 + SPAN * clamp(prog);
    {
      const aE = revA(1);
      const track = pieces(R_ARC, A0, aE, boxes);
      Lb.glowPath(ctx, (c) => arcPath(c, cx, cy, R_ARC, track), `rgba(${CYR},0.10)`, 12, 0, { cap: "butt" });
      Lb.glowPath(ctx, (c) => arcPath(c, cx, cy, R_ARC + 7, track), `rgba(${CYR},0.28)`, 1, 0, { cap: "butt" });
      Lb.glowPath(ctx, (c) => arcPath(c, cx, cy, R_ARC - 7, track), `rgba(${CYR},0.28)`, 1, 0, { cap: "butt" });
      // Endmarken der Spur
      if (reveal > 0.05) for (const a of [A0, aE]) if (!inBoxes(R_ARC * Math.cos(a), R_ARC * Math.sin(a), boxes)) Lb.line(ctx, cx + (R_ARC - 12) * Math.cos(a), cy + (R_ARC - 12) * Math.sin(a), cx + (R_ARC + 12) * Math.cos(a), cy + (R_ARC + 12) * Math.sin(a), `rgba(${CYR},0.6)`, 2, 0, { cap: "butt" });
      const pa = Math.min(aProg, aE);
      if (pa > A0 + 0.3 * DEG) {
        const fill = pieces(R_ARC, A0, pa, boxes);
        Lb.glowPath(ctx, (c) => arcPath(c, cx, cy, R_ARC, fill), acc.main, 6, 1.1 + 0.25 * breath, { cap: "butt" });
        // Zeiger am Kopf
        const hx = cx + R_ARC * Math.cos(pa), hy = cy + R_ARC * Math.sin(pa);
        if (!inBoxes(hx - cx, hy - cy, boxes)) {
          Lb.glowDot(ctx, hx, hy, 30 + 8 * breath, acc.main, 0.55 + 0.25 * breath);
          Lb.line(ctx, cx + (R_ARC - 20) * Math.cos(pa), cy + (R_ARC - 20) * Math.sin(pa), cx + (R_TICK + 8) * Math.cos(pa), cy + (R_TICK + 8) * Math.sin(pa), acc.hi, 3, 1, { cap: "butt" });
          Lb.fillCircle(ctx, hx, hy, 5.5, "#ffffff");
        }
      }
    }

    // Teilstriche (240° / 3° = 80 Teilungen)
    {
      const aE = revA(0);
      const litMinor = [], litMajor = [], offMinor = [], offMajor = [];
      for (let i = 0; i <= 80; i++) {
        const a = A0 + i * 3 * DEG;
        if (a > aE + 1e-6) break;
        const major = i % 10 === 0, mid = i % 5 === 0;
        const len = major ? 24 : mid ? 15 : 8;
        const x1 = R_TICK * Math.cos(a), y1 = R_TICK * Math.sin(a);
        if (inBoxes(x1, y1, boxes)) continue;
        const seg4 = [a, len];
        const lit = a <= aProg + 1e-6;
        (major || mid ? (lit ? litMajor : offMajor) : (lit ? litMinor : offMinor)).push(seg4);
      }
      const build = (list) => (c) => { for (const [a, len] of list) { c.moveTo(cx + R_TICK * Math.cos(a), cy + R_TICK * Math.sin(a)); c.lineTo(cx + (R_TICK - len) * Math.cos(a), cy + (R_TICK - len) * Math.sin(a)); } };
      Lb.glowPath(ctx, build(offMinor), `rgba(${CYR},0.30)`, 2, 0, { cap: "butt" });
      Lb.glowPath(ctx, build(offMajor), `rgba(${CYR},0.62)`, 3, 0.35, { cap: "butt" });
      Lb.glowPath(ctx, build(litMinor), acc.main, 2, 0.5, { cap: "butt", alpha: 0.85 });
      Lb.glowPath(ctx, build(litMajor), acc.hi, 3, 0.8, { cap: "butt" });
      // wandernder Abtastlichtpunkt über die Teilung (dauerhafte Bewegung)
      const per = 3.2, ph = ((t * (1 / per)) % 1) * 1.35 - 0.15;
      const sa = A0 + SPAN * ph;
      if (reveal > 0.9) {
        for (let i = 0; i <= 80; i++) {
          const a = A0 + i * 3 * DEG; const dd = Math.abs(a - sa) / (7 * DEG);
          if (dd >= 1) continue;
          const x1 = R_TICK * Math.cos(a), y1 = R_TICK * Math.sin(a);
          if (inBoxes(x1, y1, boxes)) continue;
          const len = i % 10 === 0 ? 24 : i % 5 === 0 ? 15 : 8;
          Lb.line(ctx, cx + x1, cy + y1, cx + (R_TICK - len - 4) * Math.cos(a), cy + (R_TICK - len - 4) * Math.sin(a), "#dff6ff", 2, 0.9, { cap: "butt", alpha: (1 - dd) * 0.8 });
        }
      }
    }

    // Abschluss-Ping
    if (done > 0 && done < 1) {
      const q = done;
      const r = R_ARC + 34 * eo3(q);
      const pc = pieces(r, A0, A1, boxes);
      Lb.glowPath(ctx, (c) => arcPath(c, cx, cy, r, pc), acc.main, 3 * (1 - q) + 1, 1, { alpha: (1 - q) * 0.9, cap: "butt" });
    }
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
    ctx.save();
    for (let i = 0; i < 22; i++) {
      const ang = h01(i * 3.7) * TAU + t * (0.05 + 0.08 * h01(i * 1.9)) * (i % 2 ? 1 : -1);
      const rr = 150 + 260 * h01(i * 5.3) + 10 * Math.sin(t * 0.7 + i);
      const x = cx + Math.cos(ang) * rr * 1.25, y = cy + Math.sin(ang) * rr * 0.9 - ((t * (6 + 8 * h01(i))) % 40);
      if (y > 900 || y < 100) continue;
      const tw = 0.5 + 0.5 * Math.sin(t * (1.3 + h01(i * 9.1)) + i * 2.1);
      ctx.globalAlpha = a * (0.12 + 0.3 * tw);
      ctx.fillStyle = i % 5 === 0 ? acc.main : "#9fe6ff";
      ctx.beginPath(); ctx.arc(x, y, 1.2 + 1.6 * h01(i * 7.7), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ---------------- Template ----------------
  CEX.register("stat_counter", {
    ownsText: true,
    draw(ctx, p) {
      const Lb = p.L; const W = p.W || 1920; const H = p.H || 1080;
      const t = Math.max(0, +p.t || 0), d = Math.max(0.5, +p.d || 6), u = clamp(t / d);
      const fps = p.fps || 30;
      const cfg = config(p);
      const acc = cfg.acc;
      const cx = W / 2;

      // --- Zeitsteuerung (relativ zu d) ---
      const tIn = clamp(0.12 * d, 0.5, 1.4);
      const reveal = seg(t, 0, tIn);
      const cStart = 0.03 * d, cEnd = 0.45 * d;
      const cu = seg(t, cStart, cEnd - cStart);
      const ease = (x) => 1 - Math.pow(1 - clamp(x), 3.2);
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
      const after = Math.max(0, t - cEnd);
      const breath = t >= cEnd ? 0.5 - 0.5 * Math.cos((after / 2.4) * TAU) : 0;

      // --- Texte vorbereiten ---
      const lab = cfg.label ? fitText(ctx, cfg.label, { caps: true, family: HEAD, weight: 700, tries: [[60, 1], [54, 1], [52, 2], [46, 2], [40, 3]], ls: 4, maxW: 1500 }) : null;
      const subT = cfg.sublabel ? fitText(ctx, cfg.sublabel, { caps: false, family: BODY, weight: 400, tries: [[36, 1], [34, 2], [30, 2], [28, 3]], maxW: 1320 }) : null;
      const labLH = lab ? lab.font.size * 1.14 : 0;
      const subLH = subT ? subT.font.size * 1.38 : 0;
      const labH = lab ? lab.font.size * 0.74 + (lab.lines.length - 1) * labLH : 0;
      const subH = subT ? subT.font.size * 0.74 + (subT.lines.length - 1) * subLH + subT.font.size * 0.24 : 0;
      const gapLS = lab && subT ? 58 : 0;
      const textH = labH + gapLS + subH;
      const gTopOff = R_TICK + 6; // Oberkante des Instruments über cy
      const textOff = R_TICK * 0.5 + 58; // Beginn der Texte unter cy
      // vertikal im Bereich [96, 905] zentrieren
      const blockH = gTopOff + textOff + textH;
      let cy = 500 - blockH / 2 + gTopOff;
      cy = clamp(cy, 96 + gTopOff, 480);
      const over = cy + textOff + textH - 905;
      if (over > 0) cy = Math.max(96 + gTopOff, cy - over);

      // --- Zahl: Schriftgröße passend wählen ---
      const L100 = numberLayout(ctx, cfg, 100);
      const S = clamp((1480 / Math.max(1, L100.w)) * 100, 84, 285);
      const NL = numberLayout(ctx, cfg, S);
      const numMid = cy - 4;
      const base = numMid + NL.capH / 2;
      const x0 = cx - NL.w / 2;
      const hasComma = cfg.dec > 0;
      const pad = 26;
      const boxes = [{ x0: x0 - pad - cx, x1: x0 + NL.w + pad - cx, y0: base - NL.capH - pad - cy, y1: base + (hasComma ? S * 0.16 : 0) + pad - cy }];
      // breite Zahl schneidet die Ringe seitlich: dann auch die Reststücke darunter weglassen (Skala wird zur „Haube")
      if (Math.min(-boxes[0].x0, boxes[0].x1) > R_FINE - 8) boxes[0].y1 = 2000;

      // --- Hintergrund-Glow hinter der Zahl ---
      const numIn = sm(seg(t, 0.05, Math.min(0.5, 0.1 * d)));
      {
        ctx.save();
        const gw = Math.max(260, NL.w * 0.62), gh = Math.max(150, NL.capH * 0.95);
        ctx.translate(cx, numMid); ctx.scale(gw / gh, 1);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, gh);
        const ga = (0.1 + 0.06 * cu + 0.05 * breath + 0.12 * (1 - done) * (done > 0 ? 1 : 0)) * numIn;
        g.addColorStop(0, `rgba(${acc.rgb},${ga.toFixed(3)})`); g.addColorStop(1, `rgba(${acc.rgb},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, gh, 0, TAU); ctx.fill();
        ctx.restore();
      }

      motes(ctx, cx, cy, t, sm(reveal), acc);

      // --- Instrument ---
      const prog = (v - cfg.sMin) / (cfg.sMax - cfg.sMin);
      drawGauge(ctx, Lb, cx, cy, { t, acc, boxes, reveal, prog, done, breath });

      // Skalenbeschriftung (nur mit explizitem max)
      if (cfg.showScale && reveal > 0.3) {
        const sa = sm(seg(reveal, 0.4, 0.6));
        const ends = [[A0, cfg.sMin], [A1, cfg.sMax]];
        for (const [a, val] of ends) {
          const lx = cx + (R_TICK + 4) * Math.cos(a), ly = cy + (R_TICK + 4) * Math.sin(a) + 36;
          Lb.text(ctx, fmtDe(val, Math.abs(val - Math.round(val)) > 1e-9 ? Math.min(2, cfg.dec || 1) : 0, cfg.doGroup ? true : "auto"), lx, ly, { font: MONO, weight: 700, size: 22, color: MUTED, align: "center", alpha: sa * 0.9 });
        }
      }

      // --- Zahl ---
      const pulseS = 1 + 0.007 * breath + 0.02 * (done > 0 && done < 1 ? Math.sin(done * Math.PI) * (1 - done) : 0);
      const glow = S * (0.1 + 0.03 * breath) * (1 + 0.9 * (done > 0 && done < 1 ? (1 - done) : 0));
      ctx.save();
      ctx.translate(cx, numMid); ctx.scale(pulseS * (0.97 + 0.03 * numIn), pulseS * (0.97 + 0.03 * numIn)); ctx.translate(-cx, -numMid);
      const negNow = v < 0 && X >= 0.5;
      drawNumber(ctx, cfg, NL, { x0, base, acc, alpha: numIn, glow, x: X, spdX, negNow, negA: 1 });
      ctx.restore();

      // --- Label ---
      let y = cy + textOff;
      if (lab) {
        const lStart = 0.12 * d, lDur = clamp(0.1 * d, 0.45, 1.0);
        const wr = eo3(seg(t, lStart, lDur));
        const la = sm(seg(t, lStart, lDur * 0.6));
        let ly = y + lab.font.size * 0.74;
        lab.lines.forEach((line, i) => {
          const wl = eo3(seg(t, lStart + i * 0.12 * lDur, lDur));
          if (wl <= 0) { ly += labLH; return; }
          const half = (line.w / 2 + 30) * wl;
          ctx.save();
          ctx.beginPath(); ctx.rect(cx - half, ly - lab.font.size * 1.1, half * 2, lab.font.size * 1.5); ctx.clip();
          ctx.globalAlpha = la;
          ctx.shadowBlur = 16;
          drawLine(ctx, lab, line, cx, ly + (1 - wr) * 6, { base: WHITE, glow: "rgba(63,210,255,0.55)", em: acc.main, emGlow: `rgba(${acc.rgb},0.8)` });
          ctx.restore();
          // Scan-Kanten während der Enthüllung
          if (wl < 1) {
            const ea = Math.sin(wl * Math.PI) * 0.9;
            for (const sx of [cx - half, cx + half]) Lb.line(ctx, sx, ly - lab.font.size * 0.95, sx, ly + lab.font.size * 0.22, "#bff0ff", 2, 1, { alpha: ea, cap: "butt" });
          }
          ly += labLH;
        });
        y += labH;
      }
      // --- Trenner + Sublabel ---
      if (subT) {
        const sStart = (lab ? 0.24 : 0.14) * d, sDur = clamp(0.1 * d, 0.45, 1.0);
        const dv = eo3(seg(t, sStart - 0.2 * sDur, sDur));
        if (lab) {
          const dy = y + gapLS * 0.5 - 2;
          const hwD = 70 * dv;
          if (dv > 0) {
            Lb.line(ctx, cx - hwD, dy, cx + hwD, dy, acc.main, 2, 0.8, { cap: "butt", alpha: 0.85 });
            ctx.save(); ctx.globalAlpha = dv; ctx.fillStyle = acc.main;
            for (const sx of [cx - hwD - 9, cx + hwD + 9]) { ctx.beginPath(); ctx.moveTo(sx, dy - 4); ctx.lineTo(sx + 4, dy); ctx.lineTo(sx, dy + 4); ctx.lineTo(sx - 4, dy); ctx.closePath(); ctx.fill(); }
            ctx.restore();
          }
          y += gapLS;
        }
        const sa = sm(seg(t, sStart, sDur));
        if (sa > 0) {
          let sy = y + subT.font.size * 0.74 + (1 - sa) * 10;
          ctx.save(); ctx.globalAlpha = sa; ctx.shadowBlur = 0;
          for (const line of subT.lines) { drawLine(ctx, subT, line, cx, sy, { base: MUTED, glow: "rgba(0,0,0,0)", em: acc.hi, emGlow: "rgba(0,0,0,0)" }); sy += subLH; }
          ctx.restore();
        }
      }
    },
  });
})();
