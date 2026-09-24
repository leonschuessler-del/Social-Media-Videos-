/* Template „stat_counter" – große Kennzahl, die hochzählt, vor einem technischen Rundinstrument (Blueprint-Gauge).
   Aufbau: Zahl (JetBrains Mono, Amber, Glow) als mechanisches Zählwerk mit rollenden Ziffern, dahinter eine offene
   240°-Skala mit Teilstrichen, Fortschrittsbogen, rotierenden HUD-Segmenten und Lichtfluss. Wort-Einheiten
   („Stockwerke") stehen unter der Zahl, Wort-Präfixe („alle") darüber – beides im Zifferblatt. Optional: Kicker-Plakette
   auf dem Skalenrand, Spanne („1,2 bis 2×") mit Bereichsband, Stoppuhr-Schleife, Fußnote mit Sternchen.
   Darunter – in der Öffnung der Skala – Label (Oxanium, Versalien), Sublabel (Inter) und Fußnote.

   BEATS (params.beats = Sekunden ab Szenenstart, jede Stelle optional, geklemmt auf [0,3; d−0,3]):
     [0] = Kicker-Plakette erscheint            (Standard 0,3 s)
     [1] = Zählbeginn: Zahl + Einheit/Präfix blenden ein, Zeiger läuft los   (Standard 0,06·d)
     [2] = Zahl rastet auf dem Endwert ein („Ping", Aufleuchten)            (Standard [1] + 0,39·d)
     [3] = Label erscheint                      (Standard 0,14·d)
     [4] = Sublabel erscheint                   (Standard Label + 0,12·d)
     [5] = Fußnote (+ Sternchen an der Zahl)    (Standard [2] + 0,2 s)
     [6] = nur Spanne: Untergrenze („1,2") erscheint schon vorher   (Standard = [1]; „bis", Obergrenze und
           Einheit kommen mit [1]). Die Obergrenze wird erst sichtbar, sobald sie mehr als die Untergrenze zeigt.
   Vor [1] ist nur das Instrument mit unbeleuchteten Ziffern („88") zu sehen – die Zahl darf also spät kommen.
   Zählkurve easeOut: der Wert liest sich schon bei ~60 % zwischen [1] und [2] fast final.
   "at" (Sekunden) statt beats: kicker/label/sublabel/footnote auch als Objekt {text, at}; oder benannte Schlüssel
   kickerAt, countAt, landAt, labelAt, sublabelAt, footnoteAt, loAt (Vorrang vor beats). Das Instrument baut sich
   immer ab Szenenstart auf (0 … 0,12·d). Ein Symbol-Präfix links („≥", „≈") rückt an die erste sichtbare Ziffer,
   solange führende Stellen noch leer sind (keine Lücke bei „≈ 5").

   params (alle optional):
     value     Zielwert (12). Zahl oder String ("12,5", "1.250.000").        Aliase: to, target, wert, zahl, number
     from      Startwert (0). from > value zählt herunter.                     Aliase: start, von
     unit      Einheit ("×"/"x", "%", "m/s", "-fach", "Stockwerke" …).         Aliase: einheit, suffix
     prefix    Präfix ("≈ ", "≥ ", "alle ", "ca. ").                           Aliase: praefix, pre
     unitPos   auto | right | below  (auto: Wörter ≥ 5 Buchstaben unter die Zahl, sonst rechts; "-fach" hängt direkt an)
     prefixPos auto | left | above   (auto: Symbole ≈ ≥ ≤ ~ + links, Wörter darüber; in der „Haube" links)
   Layout: passt der Zahlenstapel ins Zifferblatt, steht er darin (Schrift ≤ 285 px); sonst (Spanne, ≥ 5 Stellen)
   wölbt sich die Skala als „Haube" über die breite Zahl. Zu viel Text -> Instrument schrumpft (bis 76 %).
     decimals  Nachkommastellen (sonst aus value/from abgeleitet).           Aliase: dec, digits, precision
     label     Überschrift unter der Zahl; fehlt sie, wird p.text verwendet (sonst wird p.text NICHT gezeigt).
               Aliase: headline, title, caption. Geschützte Leerzeichen (U+00A0) verhindern Umbrüche.
     sublabel  kleinere Zusatzzeile (Inter).                                  Aliase: sub, subtitle, note, detail
     kicker    kurze Plakette oben auf dem Skalenrand (z. B. Name). true = p.text als Kicker.  Aliase: eyebrow, dachzeile
     footnote  kleine Fußnote unten, mit „*" an der Zahl (footnoteMark:false = ohne Sternchen). Aliase: fussnote, quelle
     lo        Untergrenze einer Spanne → Anzeige „lo bis value" + Bereichsband (auch range:true = from als lo,
               oder value_text "1,2x bis 2x"). rangeSep: Trennwort ("bis" | "–").
     value_text  "≈ 30 Tote" / "1,2x bis 2x" – Fallback für prefix/value/unit/lo, wenn diese fehlen.
     loop      Stoppuhr: nach dem Einrasten läuft der Zeiger alle loop Sekunden von from bis value, mit Ping.
     accent    amber (Standard) | red | cyan | green (auch rot/gefahr, blau, grün).   danger:true = red
     max / min Skalenbereich (sonst automatisch). Mit max werden die Skalenenden beschriftet.
     group     Tausendertrennung (schmales Leerzeichen) erzwingen/verbieten. Standard: ab 5 Stellen.
   In label/sublabel/kicker markiert *Wort* die Akzentfarbe. */
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
  const NNBSP = " ";

  // Spannweite der Skala: 240°, Öffnung unten (für Einheit + Label)
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
  const str = (v) => (v === undefined || v === null || v === false || v === true ? "" : typeof v === "object" ? "" : String(v));
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
    if (group === true || (group !== false && ip.length >= 5)) ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
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
  /** Text-Param als String oder {text, at}. */
  function txtAt(v) {
    if (isObj(v)) return { s: str(pick(v, ["text", "label", "t", "s", "value"])).trim(), at: parseNum(pick(v, ["at", "time"])) };
    return { s: str(v).trim(), at: NaN };
  }
  /** "≈ 30 Tote" | "alle 30 Sekunden" | "1,2x bis 2x" -> {pre, loRaw?, hiRaw, unit, sep?} */
  function parseValueText(s) {
    s = String(s || "").trim();
    if (!s || !/\d/.test(s)) return null;
    const bis = /\sbis\s/i.test(s);
    const parts = s.split(/\s+bis\s+|\s*[–—]\s*|\s+-\s+/i).filter((q) => q.trim());
    const one = (q) => {
      const m = q.trim().match(/^([^\d+\-−]*?)\s*([+\-−]?\d[\d.,\s   ]*)(.*)$/);
      if (!m) return null;
      const raw = m[2].trim();
      return { pre: m[1].trim(), raw, num: parseNum(raw), unit: m[3].trim() };
    };
    const a = parts.length ? one(parts[0]) : null;
    if (!a || !isFinite(a.num)) return null;
    if (parts.length >= 2) {
      const b = one(parts[parts.length - 1]);
      if (b && isFinite(b.num)) return { pre: a.pre, loRaw: a.raw, hiRaw: b.raw, unit: b.unit || a.unit, sep: bis ? "bis" : "–" };
    }
    return { pre: a.pre, hiRaw: a.raw, unit: a.unit };
  }

  // ---------------- Konfiguration (pro params-Objekt gecacht) ----------------
  const CENTER_SYM = /^[×·±+−\-–~≈≥≤≠→=]+$/;
  const TOP_SYM = /^[°′″]+$/;
  const CFG_CACHE = new Map();
  function config(p) {
    const P = isObj(p.params) ? p.params : {};
    const txt = str(p.text).trim();
    let key;
    try { key = JSON.stringify(P) + "\u0001" + txt; } catch (e) { key = "?" + txt; }
    const hit = CFG_CACHE.get(key);
    if (hit) return hit;
    const vt = parseValueText(str(pick(P, ["value_text", "valueText", "display", "anzeige"])));
    let rawV = pick(P, ["value", "to", "target", "wert", "zahl", "number", "ziel", "end"]);
    if ((rawV === undefined || isObj(rawV)) && vt) rawV = vt.hiRaw;
    const rawF0 = pick(P, ["from", "start", "von", "begin", "startwert"]);
    // Spanne (lo … value)
    let loRaw = pick(P, ["lo", "lower", "low", "rangeFrom", "range_from", "untergrenze", "minValue", "min_value"]);
    if (loRaw === undefined && vt && vt.loRaw !== undefined) loRaw = vt.loRaw;
    if (loRaw === undefined && toBool(pick(P, ["range", "spanne", "bereich"]), false) && rawF0 !== undefined) loRaw = rawF0;
    let lo = parseNum(loRaw); const hasLo = isFinite(lo);
    const rawF = rawF0 !== undefined ? rawF0 : hasLo ? loRaw : undefined;
    let value = parseNum(rawV); if (!isFinite(value)) value = 12;
    let from = parseNum(rawF); if (!isFinite(from)) from = 0;
    let dec = parseNum(pick(P, ["decimals", "dec", "digits", "precision", "nachkommastellen", "stellen"]));
    const decSet = isFinite(dec);
    if (!decSet) dec = hasLo ? decOf(rawV) : Math.max(decOf(rawV), decOf(rawF));
    dec = clamp(Math.round(dec), 0, 4);
    let loDec = parseNum(pick(P, ["loDecimals", "lo_decimals"]));
    if (!isFinite(loDec)) loDec = decSet ? Math.max(dec, decOf(loRaw)) : decOf(loRaw);
    loDec = clamp(Math.round(loDec), 0, 4);
    const LIM = Math.pow(10, 12 - dec) - 1;
    value = clamp(value, -LIM, LIM); from = clamp(from, -LIM, LIM); if (hasLo) lo = clamp(lo, -LIM, LIM);
    let unit = str(pick(P, ["unit", "einheit", "suffix", "units"])).trim();
    if (!unit && vt) unit = vt.unit || "";
    if (/^[xX]$/.test(unit)) unit = "×";
    let prefix = str(pick(P, ["prefix", "praefix", "präfix", "pre", "vorsatz"]));
    if (!prefix.trim() && vt && vt.pre) prefix = vt.pre + " ";
    const prefixGap = /\s$/.test(prefix);
    prefix = prefix.trim();
    if (prefix === ">=") prefix = "≥"; else if (prefix === "<=") prefix = "≤"; else if (prefix === "~" || prefix === "~=") prefix = "≈";
    // Platzierung von Einheit/Präfix
    const posU = str(pick(P, ["unitPos", "unit_pos", "unitPosition", "unitPlacement"])).trim().toLowerCase();
    const posP = str(pick(P, ["prefixPos", "prefix_pos", "prefixPosition", "prefixPlacement"])).trim().toLowerCase();
    const unitAttached = /^[-‑]/.test(unit);
    const unitIsWord = !!unit && !unitAttached && (/\s/.test(unit) || (unit.match(/[A-Za-zÄÖÜäöüß]/g) || []).length >= 5);
    const unitBelow = !!unit && (posU === "below" || posU === "unten" || (posU !== "right" && posU !== "rechts" && unitIsWord));
    const prefixForced = posP === "above" || posP === "oben";
    const prefixAbove = !!prefix && (prefixForced || (posP !== "left" && posP !== "links" && !CENTER_SYM.test(prefix)));
    const capsOk = (s) => /^[A-Za-zÄÖÜäöüß.]+(\s+[A-Za-zÄÖÜäöüß.]+)*$/.test(s) && !/^[a-zµ]{1,3}$/.test(s);
    const unitText = unitBelow ? (capsOk(unit) && /^[A-ZÄÖÜ]/.test(unit) ? upper(unit) : unit) : "";
    const prefixText = prefixAbove ? (capsOk(prefix) ? upper(prefix) : prefix) : "";
    // Texte
    const kRaw = pick(P, ["kicker", "eyebrow", "overline", "dachzeile", "topline"]);
    const kFromText = kRaw === true || kRaw === "text";
    const K = kFromText ? { s: txt, at: NaN } : txtAt(kRaw);
    const LB = txtAt(pick(P, ["label", "headline", "title", "titel", "caption", "heading", "ueberschrift", "überschrift"]));
    if (!LB.s && !kFromText) LB.s = txt;
    const SB = txtAt(pick(P, ["sublabel", "subLabel", "sub_label", "sub", "subtitle", "untertitel", "subline", "note", "detail", "hint"]));
    const FN = txtAt(pick(P, ["footnote", "fussnote", "fußnote", "footer", "source", "quelle", "anmerkung"]));
    const footMark = !!FN.s && toBool(pick(P, ["footnoteMark", "footnote_mark", "asterisk", "sternchen"]), true);
    // Farbe
    let accKey = "amber";
    const accRaw = str(pick(P, ["accent", "color", "colour", "tone", "farbe", "variant"])).trim().toLowerCase();
    if (ACC_ALIAS[accRaw]) accKey = ACC_ALIAS[accRaw];
    if (toBool(pick(P, ["danger", "gefahr", "warnung", "critical"]), false)) accKey = "red";
    const groupRaw = pick(P, ["group", "grouping", "thousands", "tausender"]);
    const group = groupRaw === undefined || groupRaw === "auto" ? "auto" : toBool(groupRaw, true);
    // Skala
    const maxRaw = parseNum(pick(P, ["max", "scaleMax", "scale_max", "maximum", "skala"]));
    const minRaw = parseNum(pick(P, ["min", "scaleMin", "scale_min", "minimum"]));
    let sMin = isFinite(minRaw) ? minRaw : Math.min(0, from, value, hasLo ? lo : 0);
    let sMax = isFinite(maxRaw) ? maxRaw : niceCeil(Math.max(Math.abs(from), Math.abs(value), hasLo ? Math.abs(lo) : 0, 1e-9) * 1.18);
    if (!isFinite(maxRaw) && sMin < 0) sMin = -niceCeil(-sMin * 1.1);
    if (!(sMax > sMin)) { sMax = sMin + 1; }
    const showScale = isFinite(maxRaw);
    // Stellen
    const bigAbs = Math.max(Math.abs(from), Math.abs(value));
    const nInt = Math.max(1, Math.floor(Math.log10(Math.max(1, Math.round(bigAbs * Math.pow(10, dec)) / Math.pow(10, dec)))) + 1);
    const doGroup = group === "auto" ? nInt >= 5 : !!group;
    const neg = Math.min(from, value) < 0;
    const loStr = hasLo ? fmtDe(lo, loDec, doGroup ? true : group === false ? false : "auto") : "";
    let rangeSep = str(pick(P, ["rangeSep", "range_sep", "separator", "trenner"])).trim();
    if (!rangeSep) rangeSep = (vt && vt.sep) || "bis";
    // Zeiten
    const firstNum = (...xs) => { for (const x of xs) { const n = parseNum(x); if (isFinite(n)) return n; } return NaN; };
    const beats = Array.isArray(P.beats) ? P.beats.map((b) => parseNum(b)) : [];
    const at = {
      kicker: firstNum(pick(P, ["kickerAt", "kicker_at"]), K.at),
      count: firstNum(pick(P, ["countAt", "count_at", "startAt", "numberAt", "valueAt"])),
      land: firstNum(pick(P, ["landAt", "land_at", "endAt", "doneAt"])),
      label: firstNum(pick(P, ["labelAt", "label_at"]), LB.at),
      sub: firstNum(pick(P, ["sublabelAt", "sublabel_at", "subAt"]), SB.at),
      foot: firstNum(pick(P, ["footnoteAt", "footnote_at", "footAt"]), FN.at),
      lo: firstNum(pick(P, ["loAt", "lo_at", "rangeAt", "range_at", "lowAt"])),
    };
    let loop = parseNum(pick(P, ["loop", "cycle", "period", "lap", "takt"]));
    loop = loop > 0.6 ? loop : 0;
    const cfg = {
      value, from, dec, unit, prefix, prefixGap, unitAttached, unitBelow, prefixAbove, prefixForced, unitText, prefixText,
      hasLo, lo, loDec, loStr, rangeSep, kicker: K.s, label: LB.s, sublabel: SB.s, footnote: FN.s, footMark,
      acc: ACC[accKey], accKey, doGroup, nInt, neg, sMin, sMax, showScale, beats, at, loop,
    };
    if (CFG_CACHE.size > 12) CFG_CACHE.delete(CFG_CACHE.keys().next().value);
    CFG_CACHE.set(key, cfg);
    return cfg;
  }

  // ---------------- Zeitplan (beats / at / Standard relativ zu d) ----------------
  function timing(cfg, d) {
    const hi = Math.max(0.3, d - 0.3);
    const cl = (x) => clamp(x, 0.3, hi);
    const B = cfg.beats;
    const get = (named, i) => (isFinite(named) ? cl(named) : isFinite(B[i]) ? cl(B[i]) : NaN);
    let count = get(cfg.at.count, 1), land = get(cfg.at.land, 2);
    if (!isFinite(count) && !isFinite(land)) { count = cl(0.06 * d); land = count + clamp(0.39 * d, 0.8, 4.5); }
    else if (!isFinite(land)) land = count + clamp(0.3 * d, 0.8, 2.5);
    else if (!isFinite(count)) count = Math.max(0.3, land - clamp(0.3 * d, 0.8, 2.5));
    if (land < count + 0.3) land = count + 0.3;
    let kicker = get(cfg.at.kicker, 0); if (!isFinite(kicker)) kicker = cl(0.3);
    let label = get(cfg.at.label, 3); if (!isFinite(label)) label = cl(0.14 * d);
    let sub = get(cfg.at.sub, 4); if (!isFinite(sub)) sub = cl(cfg.label ? label + Math.max(0.35, 0.12 * d) : 0.14 * d);
    let foot = get(cfg.at.foot, 5); if (!isFinite(foot)) foot = cl(land + 0.2);
    let lo = get(cfg.at.lo, 6); if (!isFinite(lo) || lo > count) lo = count;
    return { count, land, kicker, label, sub, foot, lo };
  }

  // ---------------- Symbole, die in den Web-Font-Subsets fehlen, als Vektor ----------------
  const VEC = { "≥": 1, "≤": 1, "≈": 1, "≠": 1, "→": 1, "–": 1 };
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
    } else if (ch === "–") {
      ctx.moveTo(cx - hw * 1.15, axis); ctx.lineTo(cx + hw * 1.15, axis);
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

  // ---------------- Layout der Zahlenzeile ----------------
  function numberLayout(ctx, cfg, S) {
    setFont(ctx, 700, S, MONO);
    const m0 = ctx.measureText("0");
    const cw = m0.width;
    const capH = m0.actualBoundingBoxAscent || S * 0.73;
    const L = { S, cw, capH, slots: [], w: 0 };
    ctx.textAlign = "left";
    const fin = Math.abs(cfg.value).toFixed(cfg.dec);
    const first = cfg.hasLo ? cfg.loStr.replace(/^−/, "") : fin;
    const mF = ctx.measureText(first.charAt(0)), mL = ctx.measureText(fin.charAt(fin.length - 1));
    L.leadBearing = cfg.neg && !cfg.hasLo ? 0 : clamp(-(mF.actualBoundingBoxLeft || 0), 0, cw * 0.4);
    L.tailBearing = clamp(cw - (mL.actualBoundingBoxRight || cw), 0, cw * 0.4);
    let x = 0;
    // Präfix links (Symbole)
    if (cfg.prefix && !cfg.prefixAbove) {
      const sym = CENTER_SYM.test(cfg.prefix);
      const ps = sym ? S * 0.5 : S * 0.3;
      const pw = richWidth(ctx, cfg.prefix, ps);
      L.prefix = { x, w: pw, size: ps, sym };
      x += pw + (cfg.prefixGap || !sym ? S * 0.14 : S * 0.07) - L.leadBearing;
    }
    // Untergrenze einer Spanne (statisch) + Trennwort
    if (cfg.hasLo) {
      L.lo = [];
      for (const ch0 of cfg.loStr) {
        const ch = ch0 === "-" ? "−" : ch0;
        const w = /\d/.test(ch) ? cw : ch === "," ? cw * 0.62 : ch === "−" ? cw * 0.85 : cw * 0.3;
        L.lo.push({ ch, x, w }); x += w;
      }
      const sym = CENTER_SYM.test(cfg.rangeSep);
      const ss = sym ? S * 0.42 : S * 0.3;
      const sw = richWidth(ctx, cfg.rangeSep, ss);
      setFont(ctx, 700, ss, MONO);
      const ms = ctx.measureText(cfg.rangeSep.replace(/[≥≤≈≠→–]/g, "="));
      x += S * 0.13 - L.tailBearing * 0.6;
      L.sep = { x, w: sw, size: ss, center: sym, top: false, asc: ms.actualBoundingBoxAscent || ss * 0.3, desc: ms.actualBoundingBoxDescent || 0 };
      x += sw + S * 0.13 - L.leadBearing * 0.6;
    }
    // Vorzeichen-Reserve
    if (cfg.neg) { L.signX0 = x; x += cw * 0.85; }
    // Ziffern
    const nD = cfg.nInt + cfg.dec;
    for (let k = nD - 1; k >= 0; k--) {
      const i = k - cfg.dec; // Stelle im ganzzahligen Teil (0 = Einer)
      L.slots.push({ type: "d", k, x });
      x += cw;
      if (cfg.doGroup && i > 0 && i % 3 === 0) { L.slots.push({ type: "sep", k, x }); x += cw * 0.3; }
      if (cfg.dec > 0 && i === 0) { L.slots.push({ type: "comma", x }); x += cw * 0.62; }
    }
    L.numX1 = x;
    { let nx = null; for (let i = L.slots.length - 1; i >= 0; i--) { const s = L.slots[i]; if (s.type === "d") { s.nx = nx === null ? s.x + cw : nx; nx = s.x; } } }
    // Einheit rechts
    if (cfg.unit && !cfg.unitBelow) {
      const u = cfg.unit;
      const sym = u.length <= 2 && !/[A-Za-zÄÖÜäöüß0-9µ]/.test(u);
      const us = sym ? S * 0.52 : S * 0.3;
      const gap = cfg.unitAttached ? S * 0.015 : /^[×x·]/.test(u) ? S * 0.05 : sym ? S * 0.1 : S * 0.14;
      const uw = richWidth(ctx, u, us);
      x += gap - L.tailBearing * (cfg.unitAttached ? 1 : 0.8);
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
  /** Präfix, Trennwort bzw. Einheit (einfarbig mit Glow) als Sprite; Anker = Grundlinie der Zahl. */
  function richSprite(cfg, L, part) {
    const key = "_spr_" + part;
    if (cfg[key] !== undefined) return cfg[key];
    cfg[key] = null;
    const it = L[part]; const s = part === "prefix" ? cfg.prefix : part === "sep" ? cfg.rangeSep : cfg.unit;
    if (!it || !s) return null;
    const S = L.S, capH = L.capH, B = Math.round(S * 0.055), m = Math.ceil(B * 1.4) + 6;
    const bl = m + Math.ceil(S * 1.0), mid = bl - capH / 2;
    const c = canvas(it.w + 2 * m + S * 0.1, bl + S * 0.35 + m), g = c.getContext("2d");
    g.shadowColor = `rgba(${cfg.acc.rgb},0.9)`; g.shadowBlur = B; g.fillStyle = cfg.acc.main;
    let ub = bl, axis = mid;
    if (part === "prefix") { if (it.sym) ub = mid + it.size * 0.34; else axis = bl - it.size * 0.34; }
    else if (it.center) ub = mid + (it.asc - it.desc) / 2;
    else if (it.top) ub = bl - capH + it.asc;
    if (part === "sep") g.fillStyle = cfg.acc.hi;
    drawRich(g, s, m, ub, it.size, axis);
    const res = { c, m, bl };
    if (fontsReady()) cfg[key] = res; else cfg[key] = undefined;
    return res;
  }
  /** Wort-Einheit / Wort-Präfix (Oxanium, Versalien, Glow) als Sprite. */
  function wordSprite(cfg, key, text, size) {
    if (cfg[key] !== undefined) return cfg[key];
    cfg[key] = null;
    if (!text || !(size > 0)) return null;
    const ls = size * 0.14;
    const g0 = canvas(2, 2).getContext("2d");
    setFont(g0, 700, size, HEAD, ls);
    const w = g0.measureText(text).width - ls;
    const B = Math.round(size * 0.32), m = B * 2 + 4;
    const c = canvas(w + 2 * m + 4, size * 1.25 + 2 * m), g = c.getContext("2d");
    setFont(g, 700, size, HEAD, ls); g.textAlign = "left"; g.textBaseline = "alphabetic";
    const bl = m + Math.round(size * 0.95);
    g.shadowColor = `rgba(${cfg.acc.rgb},0.7)`; g.shadowBlur = B; g.fillStyle = cfg.acc.main;
    g.fillText(text, m, bl);
    g.shadowBlur = 0; g.shadowColor = "rgba(0,0,0,0)"; g.globalAlpha = 0.35; g.fillStyle = cfg.acc.hi; g.fillText(text, m, bl);
    const res = { c, m, bl, w };
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

  /** Zeichnet Präfix, Untergrenze, Ziffern (mechanisches Zählwerk mit rollenden Stellen) und Einheit aus Sprites. */
  function drawNumber(ctx, cfg, L, st) {
    const { x0, base, acc, alpha } = st;
    const loAl = st.loAlpha === undefined ? alpha : st.loAlpha; // Untergrenze / Präfix (Spanne: eigener Einsatz)
    const dA = alpha * (st.digitA === undefined ? 1 : st.digitA); // Ziffern der (Ober-)Zahl
    const cw = L.cw, capH = L.capH;
    const A = atlasFor(cfg, L);
    const X = st.x, spdX = st.spdX; // X = |v|·10^dec (kontinuierlich), spdX = |dX/dt|
    const travel = Math.round(capH * 1.06);
    const blit = (ch, gx, off, a, glowA) => {
      if (!ch || a <= 0.004) return;
      const ao = Math.abs(off); if (ao >= 0.999) return;
      const k = Math.pow(1 - ao, 1.2);
      const dx = Math.round(gx - A.w / 2), dy = Math.round(base + off * travel - A.bl);
      if (glowA > 0) { ctx.globalAlpha = clamp(a * k * glowA); ctx.drawImage(glyphSprite(A, acc, ch, "glow"), dx, dy); }
      ctx.globalAlpha = clamp(a * k); ctx.drawImage(glyphSprite(A, acc, ch, "crisp"), dx, dy);
    };
    ctx.save();
    // Untergrenze (statisch)
    if (L.lo) for (const it of L.lo) { if (/\d|,|−/.test(it.ch)) blit(it.ch, x0 + it.x + (it.ch === "," ? cw * 0.31 : it.w / 2), 0, loAl, st.glowA); }
    let leftVisible = null, edge = null, firstD = null;
    // Zählwerk-Fenster: nur rollende Ziffern werden oben/unten abgeschnitten (ruhende behalten ihren vollen Glow)
    const winY = base - capH - L.S * 0.1, winH = capH + L.S * 0.28;
    for (const sl of L.slots) {
      if (sl.type === "comma") { blit(",", x0 + sl.x + cw * 0.31, 0, dA, st.glowA); continue; }
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
      // linke Kante der sichtbaren Ziffern (stetig, während eine neue führende Stelle hereinrollt)
      if (firstD === null) firstD = sl.x;
      if (edge === null) {
        if (!lead) edge = sl.x;
        else { const pr = sm((f - 0.45) / 0.55); if (pr > 0) edge = sl.x + ((sl.nx === undefined ? sl.x + cw : sl.nx) - sl.x) * (1 - pr); }
      }
      // Rollen nur im letzten Teil jedes Schritts (mechanischer Takt); schnelle Stellen rasten ein + Bewegungsunschärfe
      const b = clamp((spdX / p10 - 5) / 12);
      const fr = sm((f - 0.45) / 0.55) * (1 - b);
      const gx = x0 + sl.x + cw / 2;
      const chA = lead ? "" : String(d0), chB = String((d0 + 1) % 10);
      const am = dA * (1 - 0.3 * b);
      if (fr > 0.002 || (b > 0.02 && !lead)) {
        ctx.save(); ctx.beginPath(); ctx.rect(gx - cw, winY, 2 * cw, winH); ctx.clip();
        if (fr > 0.002) { blit(chA, gx, -fr, am, st.glowA); blit(chB, gx, 1 - fr, am, st.glowA); }
        else blit(chA, gx, 0, am, st.glowA);
        if (b > 0.02 && !lead) { blit(String((d0 + 9) % 10), gx, -0.5, dA * 0.35 * b, 0); blit(chB, gx, 0.5, dA * 0.35 * b, 0); }
        ctx.restore();
      } else blit(chA, gx, 0, am, st.glowA);
    }
    if (st.negNow && leftVisible !== null) blit("−", x0 + leftVisible - cw * 0.45, 0, dA * st.negA, st.glowA);
    // Symbol-/Wort-Präfix links rückt an die erste sichtbare Ziffer (sonst „≥   5×" mit Lücke der leeren Zehnerstelle)
    const hug = !L.lo && !cfg.neg && edge !== null && firstD !== null ? Math.max(0, edge - firstD) : 0;
    for (const part of ["prefix", "sep", "unit"]) {
      if (!L[part]) continue;
      const sp = richSprite(cfg, L, part);
      if (!sp) continue;
      ctx.globalAlpha = (part === "prefix" ? loAl : alpha) * (part === "unit" ? 0.95 : 0.92);
      ctx.drawImage(sp.c, Math.round(x0 + L[part].x + (part === "prefix" ? hug : 0) - sp.m), Math.round(base - sp.bl));
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

    // Bogen: Spur + Fortschritt (bei einer Spanne: Band von lo bis Zeiger)
    const aProg = A0 + SPAN * clamp(prog);
    const aLo = g.prog0 === null || g.prog0 === undefined ? A0 : A0 + SPAN * clamp(g.prog0);
    {
      const aE = revA(1);
      const track = pieces(R_ARC, A0, aE, boxes);
      stroke(ctx, (c) => arcPath(c, cx, cy, R_ARC, track), `rgba(${CYR},0.10)`, 12, 1);
      stroke(ctx, (c) => {
        arcPath(c, cx, cy, R_ARC + 7, track); arcPath(c, cx, cy, R_ARC - 7, track);
        if (reveal > 0.05) for (const a of [A0, aE]) if (!inBoxes(R_ARC * Math.cos(a), R_ARC * Math.sin(a), boxes)) radial(c, a, R_ARC - 12, R_ARC + 12);
      }, `rgba(${CYR},0.34)`, 1.2, 1);
      const pa = Math.min(aProg, aE);
      if (pa > aLo + 0.3 * DEG) {
        const fill = pieces(R_ARC, aLo, pa, boxes);
        const gl = 1 + 0.35 * breath;
        stroke(ctx, (c) => arcPath(c, cx, cy, R_ARC, fill), acc.main, 22, 0.12 * gl);
        stroke(ctx, (c) => arcPath(c, cx, cy, R_ARC, fill), acc.main, 6, 1);
        stroke(ctx, (c) => arcPath(c, cx, cy, R_ARC, fill), acc.hi, 1.6, 0.8);
      }
      // Marke der Untergrenze
      if (aLo > A0 && g.loA > 0 && aLo <= aE && !inBoxes(R_ARC * Math.cos(aLo), R_ARC * Math.sin(aLo), boxes)) {
        stroke(ctx, (c) => radial(c, aLo, R_ARC - 16, R_TICK + 4), acc.main, 6, 0.22 * g.loA);
        stroke(ctx, (c) => radial(c, aLo, R_ARC - 16, R_TICK + 4), acc.hi, 2.5, g.loA);
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

    // Teilstriche (240° / 3° = 80 Teilungen); beleuchtet im Band bis zum Zeiger
    {
      const aE = revA(0);
      const litMinor = [], litMajor = [], offMinor = [], offMajor = [];
      for (let i = 0; i <= 80; i++) {
        const a = A0 + i * 3 * DEG;
        if (a > aE + 1e-6) break;
        if (inBoxes(R_TICK * Math.cos(a), R_TICK * Math.sin(a), boxes)) continue;
        const len = i % 10 === 0 ? 24 : i % 5 === 0 ? 15 : 8;
        const lit = a <= aProg + 1e-6 && a >= aLo - 1e-6;
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

  // ---------------- Texte (Label / Sublabel / Kicker / Fußnote) ----------------
  /** "Text mit *Akzent*" -> Wörter mit Läufen [{t, em}] */
  function parseEm(s) {
    const words = []; let em = false; let cur = []; let buf = "";
    const flush = () => { if (buf) { cur.push({ t: buf, em }); buf = ""; } };
    const endWord = () => { flush(); if (cur.length) words.push(cur); cur = []; };
    for (const ch of String(s)) {
      if (ch === "*") { flush(); em = !em; }
      else if (/[ \t\n\r]/.test(ch)) endWord(); // geschützte Leerzeichen (U+00A0/U+202F) halten Wörter zusammen
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
    const words = opts.words || parseEm(opts.caps ? upper(raw) : raw);
    if (!words.length) return null;
    let res = null;
    for (const [size, maxLines] of opts.tries) {
      const font = { weight: opts.weight, size, family: opts.family, ls: opts.ls ? opts.ls * (size / opts.tries[0][0]) : 0 };
      const lay = layoutLines(ctx, words, opts.maxW, font);
      res = { words, font, ...lay, maxLines };
      if (lay.lines.length <= maxLines && lay.lines.every((l) => l.w <= opts.maxW * 1.02)) {
        // ausgewogener Umbruch: kleinste Breite mit gleicher Zeilenzahl (keine Einzelwort-Restzeilen)
        const n = lay.lines.length;
        if (n > 1) {
          let lo = opts.maxW / n, hi = opts.maxW;
          for (let k = 0; k < 11; k++) { const mid = (lo + hi) / 2; if (layoutLines(ctx, words, mid, font).lines.length <= n) hi = mid; else lo = mid; }
          const bal = layoutLines(ctx, words, hi + 0.5, font);
          if (bal.lines.length === n) return { words, font, ...bal, maxLines };
        }
        return res;
      }
    }
    return res; // letzte Stufe: lieber eine Zeile mehr als Wörter verlieren
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
  /** Textblock einmal in ein Sprite rendern (Zeilen-Bänder werden einzeln gezeigt). */
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
  function capsWidth(ctx, text, size) {
    if (!text) return 0;
    const ls = size * 0.14;
    setFont(ctx, 700, size, HEAD, ls);
    return ctx.measureText(text).width - ls;
  }
  /** Zahlen-Stapel (Wort-Präfix / Zahlenzeile / Wort-Einheit) bei Schrift S; Maße relativ zur Stapeloberkante. */
  function stackMetrics(ctx, cfg, S, gs) {
    const NL = numberLayout(ctx, cfg, S);
    const inkW = NL.w - NL.inkL - NL.inkR;
    let aSize = cfg.prefixAbove ? Math.round(clamp(S * 0.17, 26, 46)) : 0;
    let uSize = cfg.unitBelow ? Math.round(clamp(S * 0.2, 28, 54)) : 0;
    let aW = capsWidth(ctx, cfg.prefixText, aSize), uW = capsWidth(ctx, cfg.unitText, uSize);
    const uMax = 400 * gs;
    if (uW > uMax) { uSize = Math.max(24, Math.floor(uSize * uMax / uW)); uW = capsWidth(ctx, cfg.unitText, uSize); }
    if (aW > uMax) { aSize = Math.max(22, Math.floor(aSize * uMax / aW)); aW = capsWidth(ctx, cfg.prefixText, aSize); }
    const hasComma = cfg.dec > 0 || /,/.test(cfg.loStr);
    const aGap = S * 0.11, uGap = S * 0.14 + (hasComma ? S * 0.08 : 0);
    const aboveH = aSize ? aSize * 0.72 + aGap : 0;
    const belowH = uSize ? uGap + uSize * 0.72 : 0;
    return { S, NL, inkW, aSize, uSize, aW, uW, aGap, uGap, aboveH, belowH, total: aboveH + NL.capH + belowH };
  }
  function stackFor(ctx, cfg, gs) {
    const Rin = 224 * gs;
    const inC = (x, y) => x * x + y * y <= Rin * Rin;
    const place = (m, rowMid) => {
      const rowTop = rowMid - m.NL.capH / 2, rowBot = rowMid + m.NL.capH / 2;
      const aBase = rowTop - m.aGap, uBase = rowBot + m.uGap + m.uSize * 0.72;
      const top = m.aSize ? aBase - m.aSize * 0.72 : rowTop;
      const hasComma = cfg.dec > 0 || /,/.test(cfg.loStr);
      const bottom = m.uSize ? uBase + m.uSize * 0.12 : rowBot + (hasComma ? m.S * 0.16 : 0);
      return { ...m, rowTop, rowBot, numMid: rowMid, aBase, uBase, top, bottom };
    };
    // 1) Stapel passt ins Zifferblatt?
    for (let S = 285 * gs; S >= 158 * gs; S *= 0.96) {
      const m = stackMetrics(ctx, cfg, S, gs);
      const rowMid = 8 * gs + (m.aboveH - m.belowH) / 2 + (m.belowH > 0 ? m.belowH * 0.3 : 0) - (m.aboveH > 0 ? m.aboveH * 0.1 : 0);
      const P = place(m, rowMid);
      const hw = m.inkW / 2;
      if (!inC(hw, P.rowTop) || !inC(hw, P.rowBot)) continue;
      if (m.aSize && !inC(m.aW / 2, P.top)) continue;
      return { mode: "inside", nc: cfg, ...P };
    }
    // 2) sonst „Haube": Skala wölbt sich über die breite Zahl (Wort-Präfix dann links neben der Zahl)
    const nc = cfg.prefixAbove && !cfg.prefixForced ? Object.assign({}, cfg, { prefixAbove: false, prefixText: "", prefixGap: true }) : cfg;
    const m100 = stackMetrics(ctx, nc, 100, gs);
    const S = clamp((1400 / Math.max(1, m100.inkW)) * 100, 84, 255 * gs);
    const m = stackMetrics(ctx, nc, S, gs);
    return { mode: "hood", nc, ...place(m, -46 * gs + m.aboveH + m.NL.capH / 2) };
  }
  function layout(ctx, cfg, W) {
    if (cfg._lay) return cfg._lay;
    const cx = W / 2;
    const lab = cfg.label ? fitText(ctx, cfg.label, { caps: true, family: HEAD, weight: 700, tries: [[60, 1], [54, 1], [52, 2], [46, 2], [40, 3], [34, 4]], ls: 4, maxW: 1500 }) : null;
    const subT = cfg.sublabel ? fitText(ctx, cfg.sublabel, { caps: false, family: BODY, weight: 400, tries: [[36, 1], [34, 2], [30, 2], [28, 3]], maxW: 1320 }) : null;
    let foot = null;
    if (cfg.footnote) {
      const words = cfg.footnote.split(/\s+/).filter(Boolean).map((w) => [{ t: w, em: false }]);
      if (cfg.footMark) words.unshift([{ t: "*", em: true }]);
      foot = fitText(ctx, "", { words, family: BODY, weight: 400, tries: [[27, 1], [25, 2], [23, 2]], maxW: 1300 });
    }
    const kick = cfg.kicker ? fitText(ctx, cfg.kicker, { caps: true, family: HEAD, weight: 700, tries: [[30, 1], [27, 1], [24, 1], [22, 2]], ls: 5, maxW: 820 }) : null;
    const labLH = lab ? lab.font.size * 1.14 : 0;
    const subLH = subT ? subT.font.size * 1.38 : 0;
    const footLH = foot ? foot.font.size * 1.38 : 0;
    const kickLH = kick ? kick.font.size * 1.25 : 0;
    const labH = lab ? lab.font.size * 0.74 + (lab.lines.length - 1) * labLH : 0;
    const subH = subT ? subT.font.size * 0.74 + (subT.lines.length - 1) * subLH + subT.font.size * 0.24 : 0;
    const footH = foot ? foot.font.size * 0.74 + (foot.lines.length - 1) * footLH + foot.font.size * 0.24 : 0;
    const BOT = 897;
    let gapLS = lab && subT ? 64 : 0;
    let gapF = foot && (lab || subT) ? 40 : 0;
    let textH = labH + gapLS + subH + gapF + footH;
    const hasText = textH > 0;
    const kickH = kick ? Math.round(kick.font.size * 0.74 + (kick.lines.length - 1) * kickLH + 34) : 0;
    const kickW = kick ? Math.round(Math.max(...kick.lines.map((l) => l.w)) + 76) : 0;
    // Instrument notfalls verkleinern, bis alles zwischen y 96 und 905 passt
    let G = null;
    for (let pass = 0; pass < 2; pass++) {
      if (pass === 1) { // zu voll: Abstände straffen
        if (G.blockH <= BOT - 96) break;
        gapLS = gapLS ? 46 : 0; gapF = gapF ? 24 : 0; textH = labH + gapLS + subH + gapF + footH;
      }
      for (let gs = 1; gs >= 0.759; gs -= 0.03) {
        const st = stackFor(ctx, cfg, gs);
        const gTop = Math.max((R_TICK + 6) * gs, kick ? (R_TICK - 12) * gs + kickH / 2 + 4 : 0, -st.top + 10);
        const textOff = hasText ? Math.max((R_TICK * 0.5 + (pass ? 46 : 58)) * gs, st.bottom + (pass ? 40 : 50)) : Math.max(R_TICK * 0.5 * gs + 12, st.bottom + 12);
        G = { gs, st, gTop, textOff, blockH: gTop + textOff + textH };
        if (G.blockH <= BOT - 96) break;
      }
    }
    const { gs, st } = G;
    let cy = clamp(500 - G.blockH / 2 + G.gTop, 96 + G.gTop, 600);
    const over = cy + G.textOff + textH - BOT;
    if (over > 0) cy = Math.max(96 + G.gTop, cy - over);
    const { S, NL } = st;
    const numMid = cy + st.numMid;
    const base = Math.round(numMid + NL.capH / 2);
    const x0 = Math.round(cx - (NL.inkL + NL.w - NL.inkR) / 2);
    // Aussparungen im Instrument (Koordinaten relativ zum Zentrum, in Instrument-Einheiten = Pixel / gs)
    const pad = 26;
    const hwStack = Math.max(st.inkW, st.aW, st.uW) / 2 + pad;
    const nb = { x0: -hwStack / gs, x1: hwStack / gs, y0: (st.top - pad) / gs, y1: st.mode === "hood" ? 2000 : (st.bottom + pad) / gs };
    const boxes = [nb];
    const kickY = Math.round(cy - (R_TICK - 12) * gs);
    if (kick) boxes.push({ x0: -(kickW / 2 + 14) / gs, x1: (kickW / 2 + 14) / gs, y0: (kickY - kickH / 2 - 6 - cy) / gs, y1: (kickY + kickH / 2 + 3 - cy) / gs });
    const lay = { cx, cy, gs, mode: st.mode, nc: st.nc, st, S, NL, numMid, base, x0, boxes, lab, subT, foot, kick, labLH, subLH, footLH, kickLH, labH, subH, footH, gapLS, gapF, textOff: G.textOff, kickY, kickW, kickH };
    if (fontsReady()) cfg._lay = lay;
    return lay;
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
      ctx.save();
      const lay = layout(ctx, cfg, W);
      setFont(ctx, 700, 10, MONO, 0);
      const { cx, cy, gs, lab, subT, foot, kick, S, NL, numMid, base, x0, st } = lay;
      const nc = lay.nc || cfg; // Zahlen-Konfiguration (in der „Haube" steht ein Wort-Präfix links)
      const tm = timing(cfg, d);

      // --- Zeitsteuerung ---
      const tIn = clamp(0.12 * d, 0.5, 1.4);
      const reveal = seg(t, 0, tIn);
      const cS = tm.count, cE = tm.land;
      const valAt = (tt) => {
        const q = seg(tt, cS, cE - cS);
        return q >= 1 ? cfg.value : cfg.from + (cfg.value - cfg.from) * eo3(q);
      };
      const v = valAt(t);
      const vPrev = valAt(t - 1 / fps);
      const p10d = Math.pow(10, cfg.dec);
      const X = Math.round(Math.abs(v) * p10d * 1e6) / 1e6;
      const spdX = Math.abs(Math.abs(v) - Math.abs(vPrev)) * p10d * fps;
      const range = cfg.sMax - cfg.sMin;
      // Zeiger: bei einer Spanne läuft er von der Untergrenze los (Band wächst ab der lo-Marke), sonst wie die Zahl
      const g0 = cfg.hasLo ? cfg.lo : cfg.from;
      const qG = seg(t, cS, cE - cS);
      const vG = cfg.hasLo ? (qG >= 1 ? cfg.value : g0 + (cfg.value - g0) * eo3(qG)) : v;
      let prog = (vG - cfg.sMin) / range;
      let done = t >= cE ? seg(t, cE, 0.9) : 0;
      // Stoppuhr-Schleife: Zeiger fliegt zurück und läuft erneut bis zum Wert, Ping bei jedem Umlauf
      if (cfg.loop && t > cE) {
        const P = cfg.loop, lt = t - cE, loc = lt % P;
        const pF = (g0 - cfg.sMin) / range, pV = (cfg.value - cfg.sMin) / range;
        const back = Math.min(0.35, P * 0.25);
        prog = loc < back ? pV + (pF - pV) * sm(loc / back) : pF + (pV - pF) * ((loc - back) / (P - back));
        done = seg(loc, 0, 0.9);
      }
      const flash = done > 0 && done < 1 ? 1 - done : 0;
      const breath = t >= cE ? 0.5 - 0.5 * Math.cos(((t - cE) / 2.4) * TAU) : 0;
      const numIn = sm(seg(t, cS - 0.12, 0.4));
      const loIn = cfg.hasLo ? sm(seg(t, tm.lo - 0.12, 0.4)) : numIn; // Spanne: Untergrenze darf früher kommen
      const nIn = Math.max(numIn, loIn);
      // Spanne: Obergrenze erst zeigen, wenn sie mehr als die Untergrenze anzeigt (nie „1,2 bis 1×")
      let digitA = 1;
      if (cfg.hasLo) {
        const nMin = Math.floor(cfg.lo * p10d + 1e-6) + 1;
        if (cfg.value * p10d >= nMin - 1e-6) digitA = sm((X - (nMin - 0.45)) / 0.4);
      }

      motes(ctx, cx, cy, t, sm(reveal), acc);

      // --- Instrument (ggf. verkleinert) ---
      ctx.save();
      if (gs !== 1) { ctx.translate(cx, cy); ctx.scale(gs, gs); ctx.translate(-cx, -cy); }
      drawGauge(ctx, Lb, cx, cy, { t, acc, boxes: lay.boxes, reveal, prog, prog0: cfg.hasLo ? (cfg.lo - cfg.sMin) / range : null, loA: loIn, done, breath });
      ctx.restore();

      // Skalenbeschriftung (nur mit explizitem max), außen neben den Skalenenden
      if (cfg.showScale && lay.mode === "inside" && reveal > 0.3) {
        const sa = sm(seg(reveal, 0.4, 0.6)) * 0.9;
        const fd = (val) => fmtDe(val, Math.abs(val - Math.round(val)) > 1e-9 ? Math.min(2, cfg.dec || 1) : 0, cfg.doGroup ? true : "auto");
        for (const [a, val, al] of [[A0, cfg.sMin, "right"], [A1, cfg.sMax, "left"]]) {
          const ex = cx + R_TICK * gs * Math.cos(a), ey = cy + R_TICK * gs * Math.sin(a);
          Lb.text(ctx, fd(val), ex + (al === "right" ? -12 : 12), ey + 16, { font: MONO, weight: 700, size: 26, color: MUTED, align: al, alpha: sa });
        }
      }

      // --- unbeleuchtete Ziffern, bis gezählt wird ---
      // schnell ausblenden, sonst liest sich Geister-8 + echte 0 kurz als 80 (Spanne: auch schon mit der Untergrenze,
      // sonst stünde „1,2 bis 8" im Bild)
      const ghostA = 0.085 * sm(reveal) * (1 - sm(nIn * 3));
      const ghostLo = 0.085 * sm(reveal) * (1 - sm(loIn * 3));
      if (Math.max(ghostA, ghostLo) > 0.004) {
        ctx.save();
        setFont(ctx, 700, S, MONO, 0); ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        ctx.globalAlpha = ghostA; ctx.fillStyle = "#7fdcff";
        for (const sl of NL.slots) {
          if (sl.type === "d") ctx.fillText("8", x0 + sl.x + NL.cw / 2, base);
          else if (sl.type === "comma") ctx.fillText(",", x0 + sl.x + NL.cw * 0.31, base);
        }
        if (NL.lo) {
          ctx.globalAlpha = ghostLo;
          for (const it of NL.lo) if (/\d|,/.test(it.ch)) ctx.fillText(/\d/.test(it.ch) ? "8" : ",", x0 + it.x + (it.ch === "," ? NL.cw * 0.31 : it.w / 2), base);
          ctx.globalAlpha = ghostA;
          if (NL.sep && !CENTER_SYM.test(cfg.rangeSep)) { setFont(ctx, 700, NL.sep.size, MONO, 0); ctx.textAlign = "left"; ctx.fillText(cfg.rangeSep, x0 + NL.sep.x, base); }
        }
        ctx.restore();
      }

      // --- Zahl (Dunst + scharfe Ziffern) ---
      const pop = 0.018 * Math.sin(done * Math.PI) * flash;
      const pulseS = (1 + pop) * (0.97 + 0.03 * nIn);
      const negNow = v < 0 && X >= 0.5;
      ctx.save();
      if (Math.abs(pulseS - 1) > 1e-4) { ctx.translate(cx, numMid); ctx.scale(pulseS, pulseS); ctx.translate(-cx, -numMid); }
      const cu = seg(t, cS, cE - cS);
      const ha = (0.6 + 0.15 * cu + 0.3 * breath + 0.5 * flash) * nIn;
      const hrx = Math.round(Math.max(240, st.inkW * 0.52)), hry = Math.round(Math.max(140, NL.capH * 0.74 + (st.belowH + st.aboveH) * 0.3));
      if (ha > 0.003) { ctx.globalAlpha = clamp(ha); ctx.drawImage(hazeSprite(cfg, hrx, hry), cx - hrx, Math.round(numMid - hry)); ctx.globalAlpha = 1; }
      if (nIn > 0.003) drawNumber(ctx, nc, NL, { x0, base, acc, alpha: numIn, loAlpha: loIn, digitA, x: X, spdX, negNow, negA: 1, glowA: 0.9 * flash });
      ctx.restore();

      // --- Wort-Präfix über / Wort-Einheit unter der Zahl ---
      if (numIn > 0.003) {
        const wa = sm(seg(t, cS, 0.5));
        for (const [key, text, size, y] of [["_wP", nc.prefixText, st.aSize, cy + st.aBase], ["_wU", cfg.unitText, st.uSize, cy + st.uBase]]) {
          if (!text || !size || wa <= 0) continue;
          const sp = wordSprite(cfg, key, text, size);
          if (!sp) continue;
          ctx.save(); ctx.globalAlpha = wa;
          ctx.drawImage(sp.c, Math.round(cx - sp.w / 2 - sp.m), Math.round(y + (1 - wa) * 8 - sp.bl));
          ctx.restore();
        }
      }

      // --- Fußnoten-Sternchen an der Zahl ---
      const fa = foot ? sm(seg(t, tm.foot, 0.5)) : 0;
      if (fa > 0 && cfg.footMark && numIn > 0.05) {
        const ms = Math.round(clamp(S * 0.3, 34, 80));
        const inkR = x0 + NL.w - NL.inkR;
        Lb.text(ctx, "*", inkR + ms * 0.02, base - NL.capH + ms * 0.5, { font: BODY, weight: 700, size: ms, color: acc.main, alpha: fa * numIn, glow: 10, glowColor: acc.main });
      }

      // --- Kicker-Plakette auf dem Skalenrand ---
      if (kick) {
        const ka = seg(t, tm.kicker, 0.6);
        if (ka > 0) {
          const e = eo3(ka), w = Math.max(8, lay.kickW * e), h = lay.kickH;
          const px = cx - w / 2, py = lay.kickY - h / 2;
          ctx.save();
          ctx.globalAlpha = sm(ka * 2.5);
          ctx.fillStyle = "rgba(4,12,26,0.92)"; ctx.beginPath(); Lb.roundRectPath(ctx, px, py, w, h, 5); ctx.fill();
          ctx.strokeStyle = `rgba(${acc.rgb},0.55)`; ctx.lineWidth = 1.5; ctx.beginPath(); Lb.roundRectPath(ctx, px + 0.5, py + 0.5, w - 1, h - 1, 5); ctx.stroke();
          ctx.fillStyle = acc.main;
          ctx.fillRect(px + 7, py + 8, 3, h - 16); ctx.fillRect(px + w - 10, py + 8, 3, h - 16);
          const ta = sm(seg(ka, 0.35, 0.65));
          if (ta > 0) {
            const sp = textSprite(cfg, "_kickSpr", kick, lay.kickLH, { base: WHITE, glow: "rgba(63,210,255,0.5)", em: acc.main, emGlow: `rgba(${acc.rgb},0.8)` }, 10);
            if (sp) {
              ctx.beginPath(); ctx.rect(px + 12, py, Math.max(0, w - 24), h); ctx.clip();
              ctx.globalAlpha = ta;
              const firstY = lay.kickY - ((kick.lines.length - 1) * lay.kickLH) / 2 + kick.font.size * 0.37;
              ctx.drawImage(sp.c, Math.round(cx - sp.c.width / 2), Math.round(firstY - sp.ys[0]));
            }
          }
          ctx.restore();
        }
      }

      // --- Label (Wisch-Enthüllung von der Mitte, mit Scan-Kanten) ---
      let y = cy + lay.textOff;
      if (lab) {
        const lStart = tm.label, lDur = clamp(0.1 * d, 0.45, 1.0);
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
        const sStart = tm.sub, sDur = clamp(0.1 * d, 0.45, 1.0);
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
        y += lay.subH;
      }
      // --- Fußnote ---
      if (foot && fa > 0) {
        y += lay.gapF;
        const fy = y + foot.font.size * 0.74 + (1 - fa) * 8;
        const sp = textSprite(cfg, "_footSpr", foot, lay.footLH, { base: "rgba(159,189,224,0.82)", glow: "rgba(0,0,0,0)", em: acc.main, emGlow: "rgba(0,0,0,0)" }, 0);
        if (sp) { ctx.save(); ctx.globalAlpha = fa; ctx.drawImage(sp.c, Math.round(cx - sp.c.width / 2), Math.round(fy - sp.ys[0])); ctx.restore(); }
      }
      ctx.restore();
    },
  });
})();
