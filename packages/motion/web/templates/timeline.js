/* Template „timeline“ – horizontale Zeitleiste im Stil „Visual Science“.
   Eine leuchtende Zeitachse zeichnet sich (Lichtkopf) von links nach rechts – oder mit direction:"rtl" als
   „Zurückspulen“ von rechts nach links –, an jedem Ereignis poppt ein Knoten auf, ein Stiel wächst zur Karte
   (Jahr + umbrochenes Label), Karten wechseln oberhalb/unterhalb der Achse. Große Zeitsprünge: Bruchlinie
   (nicht maßstäblich) + Abstand in Jahren. Danach läuft ein Lichtimpuls wiederholt über die Achse; das
   hervorgehobene Ereignis wächst mit Glow in seiner Tonfarbe (Standard Amber).

   BEATS (params.beats = Sekunden ab Szenenstart; jede Stelle optional/null; auf [0,3 ; d−0,3] geklemmt):
     [0] = Achse beginnt sich zu zeichnen (Lichtkopf startet)          Standard min(0,04·d ; 0,4 s)
     [1] = Highlight: Ereignis wächst, Glow + Eckklammern, Rest dimmt   Standard: Highlight-Karte fertig
           (Vorrang: highlightAt > events[hl].hlAt > beats[1])          (ohne events[].at: nach dem letzten Ereignis)
     [2] = Lichtimpuls-Schleife startet                                 Standard: 0,2 s nach Ende des Achsenaufbaus
     [3] = Titel erscheint (title.at / titleAt haben Vorrang)           Standard 0,35 s
   sweep: [von, bis] (Sekunden; auch {from,to} oder "2.4-5.3") = Achsen-Aufbaufenster: der Lichtkopf zeichnet die Achse
          GLEICHMÄSSIG in diesem Fenster (unabhängig von den Pop-Zeiten, aber nie später als ein Knoten poppt).
          Ersetzt beats[0] als Start (beats[0] hat Vorrang). Funktioniert auch mit direction:"rtl" (Zurückspulen).
   "at" (Sekunden ab Szenenstart; String "40%" = Anteil von d) akzeptieren:
     events[i].at  – Knoten poppt; Karte ist ≈ 0,8·pop später ganz lesbar (pop = 0,11·d, 0,4 … 1,2 s).
                     Fehlende "at" werden zwischen gesetzten interpoliert; Array-Form [year, label, tone, at].
                     Der Lichtkopf erreicht jeden Knoten spätestens zu dessen "at". events[i].hlAt = Highlight-Zeit.
     title.at, title.subAt, title.until (Heldentitel), titleAt, highlightAt.
     Ohne beats/at skaliert alles mit d (Ereignisse ≈ 0,1·d … 0,55·d).
   Abstands-Labels („3 Jahre“) erscheinen erst mit dem später poppenden der beiden Ereignisse.

   params (alle optional):
     events     [{ year, label, tone, at, hlAt, side, highlight:true }] – höchstens 6 sichtbar (bei mehr: Fenster
                um das Highlight). Aliase: items, ereignisse, entries, eintraege; Felder: year|jahr|date|datum,
                label|text|title|titel. Auch erlaubt: ["1854: Otis …", …], [[1854, "…", "amber", 2.1], …], { "1854": "…" }.
                tone: "danger"|"red" (Versagen), "green" (sicher), "amber", "#rrggbb"; side: "up"|"down".
     highlight  Index (0-basiert) | Jahr/Jahrestext ("1945", "heute") | Labeltext-Teil | "last" | -1/false/"none". Std. 0.
     highlightTone  Farbe des Highlights: "amber"|"green"|"red"|"#hex". Standard: Ton des Ereignisses, sonst Amber.
     dimOthers  true (Std.): beim Highlight dimmen die VORHER erschienenen Karten; später poppende bleiben hell.
     direction  "ltr" (Std.) | "rtl" (= rewind:true / reverse:true): Lichtkopf startet rechts (Pfeil) und spult
                zurück; spätestes Ereignis poppt zuerst, das früheste zuletzt. Zeitpfeil zeigt weiter nach rechts.
     counter    rollender Jahreszähler am Lichtkopf zwischen zwei Jahres-Knoten (Std.: an bei rtl, sonst aus).
     gaps       true (Std.) | false/"none" (keine Abstands-Labels, keine Bruchlinien) | "labels" | "breaks".
                Aliase: showGaps, show_gaps, gapLabels.
     title      "Text" oder { text, at, tone, sub, subAt, hero, until } – zentrierte Titelzeile oberhalb der Achse (unter der
                Overlay-Zone); Achse/Karten rücken dafür nach unten. Aliase: titel, heading, headline, caption.
                sub (oder "Haupt\nZusatz"): Zusatzzeile; einzeilig erscheint der Titel als „HAUPT, ZUSATZ“ mit Zusatz in Amber.
                hero:true (oder hero:{until} / hero:Sekunden): HELDENTITEL – solange noch keine Karte da ist, steht der Titel
                groß (bis 88 px, bis 2 Zeilen, Zusatzzeile in Amber mit eigener Zeit subAt) mit Eckklammern mittig zwischen
                Overlay und Achse; ab until (Std.: 0,55 s vor dem ersten Pop, spätestens so, dass er vor der ersten Karte weg
                ist) fliegen Haupt- und Zusatzzeile in 0,65 s passgenau in die Titelzeile. Ohne at: Ereignisse folgen danach.
                Die Achse (Geisterschiene, mit sweep auch der Lichtkopf) darf unter dem Heldentitel schon laufen.
     firstSide  "up" (Std.) | "down" – Seite der ersten Karte (Wechsel danach). flip:true = "down".
     revealStart / revealEnd   Zeit des ersten/letzten Ereignisses (≤ 1 = Anteil von d, sonst Sekunden).
     pop        Pop-Dauer je Ereignis in s.
     pulse      true (Std.) | false/"none" (keine Lichtimpuls-Schleife) | "ltr"/"rtl" (Richtung; Std. wie die Achse).
                Nach einem Zurückspulen mit Vorwärts-Wiedergabe der Karten: pulse:false oder "ltr".
     rewindLabel  nur bei rtl: Plakette „◀◀ TEXT“ fährt beim Zurückspulen mit dem Lichtkopf (unter der Achse; mit Zähler
                darüber) und verschwindet, wenn der Kopf links ankommt. Z. B. "Zurückspulen".
   Text: p.text wird selbst als Overlay oben links im Engine-Stil gezeichnet (ownsText) – lange Texte werden
         verkleinert/zweizeilig. Karten oberhalb der Achse halten dazu ≥ 40 px Abstand (inkl. Kamerafahrt). */
(function () {
  "use strict";
  const CEX = window.CE;
  if (!CEX || typeof CEX.register !== "function") return;

  // ---------------- Konstanten ----------------
  const TAU = Math.PI * 2;
  const W0 = 1920, H0 = 1080;
  const SAFE_L = 90, SAFE_R = 1830, SAFE_T = 204, SAFE_B = 900;
  const SUB_Y = 904;          // Bildschirm-y: darunter liegt die Untertitelzone (unterste 170 px) – mit Luft
  const OV_X = 90, OV_TOP = 96, OV_GAP = 40;
  const STEM_MIN = 72, STEM_MAX = 124; // Abstand Achse -> Kartenkante (passt sich der Kartenhöhe an)
  const MAX_VIS = 6;
  const PADX = 26, PADT = 20, PADB = 22;
  const GAPW = 7;             // halbe Breite der Achsenlücke an einer Bruchlinie
  const TODAY_GUESS = 2025;   // nur Heuristik (Bruchlinie, rollender Zähler) – „heute“ wird nie als Zahl gezeigt
  const COL = { cyan: "#3fd2ff", amber: "#ffb347", red: "#ff5a5f", green: "#5be49b", white: "#eef6ff", muted: "#8fb3d9", bg: "#07152b", ice: "#dff6ff" };
  const F_HEAD = "Oxanium", F_BODY = "Inter", F_MONO = "JetBrains Mono";
  const DEFAULT_EVENTS = [
    { year: 1854, label: "Otis führt die Fangvorrichtung vor" },
    { year: 1857, label: "Erster Personenaufzug mit Fangvorrichtung, New York" },
    { year: 1945, label: "Empire State Building" },
    { year: "heute", label: "Mehrfach redundante Sicherheitskette" },
  ];
  const DIG = "0123456789", ALPH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const ZW = /[​-‍⁠﻿]/g;

  // ---------------- Helfer ----------------
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, d) => clamp((t - a) / Math.max(1e-6, d), 0, 1);
  const eo = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const sm = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const eob = (x) => { x = clamp(x, 0, 1); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const h01 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const RGB = {};
  const rgb = (hex) => {
    if (RGB[hex]) return RGB[hex];
    const h = String(hex).replace("#", "");
    const v = [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
    RGB[hex] = v; return v;
  };
  const rgba = (hex, a) => { const c = rgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${clamp(a, 0, 1).toFixed(3)})`; };
  const mix = (h1, h2, t) => {
    const a = rgb(h1), b = rgb(h2); t = clamp(t, 0, 1);
    return "#" + [0, 1, 2].map((i) => Math.round(lerp(a[i], b[i], t)).toString(16).padStart(2, "0")).join("");
  };
  /** Übergang über ein heißes Weiß (statt über ein trübes Grau zwischen Cyan und Amber). */
  const hotMix = (a, b, t) => (t < 0.5 ? mix(a, "#fff3dc", t * 2) : mix("#fff3dc", b, (t - 0.5) * 2));
  const pick = (o, keys) => {
    if (!o || typeof o !== "object") return undefined;
    for (const k of keys) { const v = o[k]; if (v !== undefined && v !== null && v !== "") return v; }
    return undefined;
  };
  const upper = (s) => { try { return String(s).toLocaleUpperCase("de-DE"); } catch (e) { return String(s).toUpperCase(); } };
  const fmtInt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const clampT = (x, d) => clamp(x, 0.3, Math.max(0.3, d - 0.3));
  function setFont(ctx, weight, size, family, ls) {
    ctx.font = `${weight} ${size}px "${family}"`;
    try { ctx.letterSpacing = `${ls || 0}px`; } catch (e) { /* ältere Canvas-Implementierung */ }
  }
  function txt(ctx, s, x, y, o) {
    const a = o.alpha === undefined ? 1 : o.alpha; if (a <= 0.003 || !s) return;
    ctx.save();
    ctx.globalAlpha = clamp(a, 0, 1);
    setFont(ctx, o.weight || 600, o.size || 30, o.font || F_BODY, o.ls || 0);
    ctx.textAlign = o.align || "left"; ctx.textBaseline = "alphabetic";
    if (o.glow) { ctx.shadowColor = o.glowColor || o.color || COL.cyan; ctx.shadowBlur = o.glow; }
    ctx.fillStyle = o.color || COL.white; ctx.fillText(s, x, y);
    ctx.restore();
  }
  /** Zeitangabe -> Sekunden. Zahl/"2,5"/"2.5s" = Sekunden, "40%" = Anteil von d; fracMode: Werte ≤ 1 = Anteil von d. */
  function tArg(v, d, fracMode) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    if (typeof v === "object" && !Array.isArray(v)) return tArg(pick(v, ["at", "t", "s", "sec"]), d, fracMode);
    let x = null, pct = false;
    if (typeof v === "number") x = v;
    else if (typeof v === "string") {
      const m = v.trim().replace(",", ".").match(/^(-?\d+(?:\.\d+)?)\s*(%|s|sek|sec)?$/i);
      if (m) { x = parseFloat(m[1]); pct = m[2] === "%"; }
    }
    if (x === null || !isFinite(x)) return null;
    if (pct) return (x / 100) * d;
    if (fracMode && x <= 1) return x * d;
    return x;
  }
  const truthy = (v) => v === true || v === 1 || (typeof v === "string" && /^(true|ja|yes|on|an|1)$/i.test(v.trim()));
  const falsy = (v) => v === false || v === 0 || (typeof v === "string" && /^(false|nein|no|off|aus|none|kein|keine|0)$/i.test(v.trim()));

  // ---------------- Parameter normalisieren ----------------
  const YEAR_KEYS = ["year", "jahr", "date", "datum", "when", "wann", "zeit", "time", "y"];
  const LABEL_KEYS = ["label", "text", "title", "titel", "desc", "description", "beschreibung", "name", "event", "ereignis", "caption"];
  const TONE_KEYS = ["tone", "color", "farbe", "accent", "kind", "typ", "type"];
  const AT_KEYS = ["at", "at_s", "atS", "appear", "appearAt", "appear_at", "showAt", "show_at", "revealAt", "reveal_at", "zeitpunkt"];
  const HLAT_KEYS = ["hlAt", "hl_at", "highlightAt", "highlight_at"];
  const SIDE_KEYS = ["side", "seite", "place", "lage"];
  function toneColor(v) {
    if (typeof v !== "string") return null;
    const s = v.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(s)) return s;
    if (/^(red|rot|danger|gefahr|fail|failure|versagen|unfall|accident|crash|bruch|error)$/.test(s)) return COL.red;
    if (/^(amber|gold|orange|gelb|warn|warning|warnung)$/.test(s)) return COL.amber;
    if (/^(green|grün|gruen|ok|safe|sicher|success)$/.test(s)) return COL.green;
    return null;
  }
  function sideOf(v) {
    if (typeof v !== "string") return null;
    const s = v.trim().toLowerCase();
    if (/^(up|top|above|oben|über|ueber|oberhalb)$/.test(s)) return "up";
    if (/^(down|bottom|below|unten|unter|unterhalb)$/.test(s)) return "down";
    return null;
  }
  function parseEntry(e) {
    if (e === null || e === undefined) return null;
    let y, l, tone, at = null, hlAt = null, side = null, flag = false;
    if (Array.isArray(e)) { y = e[0]; l = e[1]; tone = e[2]; at = e[3]; }
    else if (typeof e === "object") {
      y = pick(e, YEAR_KEYS); l = pick(e, LABEL_KEYS); tone = pick(e, TONE_KEYS);
      at = pick(e, AT_KEYS); hlAt = pick(e, HLAT_KEYS); side = pick(e, SIDE_KEYS);
      flag = truthy(e.highlight) || truthy(e.hl) || truthy(e.highlighted) || truthy(e.hervorheben);
    } else {
      const s = String(e).trim();
      let m = s.match(/^([^:|]{1,24}?)\s*[:|]\s*(.+)$/);
      if (!m) m = s.match(/^(\d{1,4}(?:er)?|heute|today)\s*[–—-]?\s+(.+)$/i);
      if (m) { y = m[1]; l = m[2]; } else { y = ""; l = s; }
    }
    y = y === null || y === undefined ? "" : String(y).trim().slice(0, 60);
    l = l === null || l === undefined ? "" : String(l).trim().slice(0, 360); // Karten sind keine Fließtexte
    const yc = y.replace(ZW, "").trim(); // Nullbreiten-Zeichen (alter Workaround gegen Abstands-Labels) nicht anzeigen
    if (!yc && !l) return null;
    // Zahl nur aus dem Original: „20​09“ bleibt bewusst ohne Zahlwert (kein Abstands-Label) – rückwärtskompatibel
    const exact = /^[+-]?\d{1,4}$/.test(y) ? parseInt(y, 10) : null;
    const approx = exact === null ? y.match(/(\d{3,4})/) : null;
    const today = /^(heute|today|jetzt|gegenwart|now|aktuell)$/i.test(yc);
    return {
      year: yc, yearKey: yc.toLowerCase(), yearTxt: /\d/.test(yc) ? yc : upper(yc), label: l, tone: toneColor(tone), today,
      num: exact !== null ? exact : approx ? parseInt(approx[1], 10) : today ? TODAY_GUESS : null,
      exact: exact !== null, at, hlAt, side: sideOf(side), flag,
    };
  }
  function normEvents(raw) {
    let arr = raw;
    if (typeof arr === "string") {
      const s = arr.trim();
      if (s.startsWith("[") || s.startsWith("{")) { try { arr = JSON.parse(s); } catch (e) { arr = s.split(/\n|;/); } }
      else arr = s.split(/\n|;/);
    }
    if (arr && typeof arr === "object" && !Array.isArray(arr)) {
      if (pick(arr, YEAR_KEYS) !== undefined || pick(arr, LABEL_KEYS) !== undefined) arr = [arr];
      else arr = Object.keys(arr).map((k) => [k, arr[k]]);
    }
    if (!Array.isArray(arr)) return null;
    const out = [];
    for (const e of arr) { const r = parseEntry(e); if (r) out.push(r); }
    return out.length ? out : null;
  }
  const HL_KEYS = ["highlight", "highlightIndex", "highlighted", "hervorheben", "hervorhebung", "active", "markiert", "hl"];
  function rawHighlight(P) {
    for (const k of HL_KEYS) if (Object.prototype.hasOwnProperty.call(P, k)) return { set: true, v: P[k] };
    return { set: false, v: undefined };
  }
  function resolveHighlight(h, evs) {
    if (!h.set) { const f = evs.findIndex((e) => e.flag); return f >= 0 ? f : 0; }
    let v = h.v;
    if (Array.isArray(v)) v = v[0];
    if (v === undefined || v === "") return 0;
    if (v === null || v === false) return -1;
    if (v === true) return 0;
    if (typeof v === "string") {
      const s = v.replace(ZW, "").trim().toLowerCase();
      if (/^(none|kein|keins|keine|false|nein|off|aus|null)$/.test(s)) return -1;
      if (/^(last|letztes|letzte|ende)$/.test(s)) return evs.length - 1;
      if (/^(first|erstes|erste)$/.test(s)) return 0;
      if (/^[+-]?\d+$/.test(s)) v = parseInt(s, 10);
      else {
        let k = evs.findIndex((e) => e.yearKey === s);
        if (k < 0 && s.length >= 3) k = evs.findIndex((e) => e.label.toLowerCase().includes(s));
        return k;
      }
    }
    if (typeof v === "number" && isFinite(v)) {
      const k = Math.round(v);
      if (k >= 0 && k < evs.length) return k;
      if (k < 0) return -1;
      return evs.findIndex((e) => e.num === k && e.exact);
    }
    return 0;
  }
  function parseDir(P) {
    const v = pick(P, ["direction", "dir", "richtung", "flow"]);
    if (typeof v === "string" && /^(rtl|rewind|reverse|back|backward|backwards|zurück|zurueck|rückwärts|rueckwaerts|right_to_left|right-to-left|left)$/i.test(v.trim())) return true;
    return truthy(P.rewind) || truthy(P.reverse) || truthy(P.rueckwaerts) || truthy(P.zurueck);
  }
  function parseGaps(P) {
    let labels = true, breaks = true;
    const v = pick(P, ["gaps", "showGaps", "show_gaps", "gapLabels", "gap_labels", "yearGaps", "abstaende"]);
    if (v !== undefined) {
      if (falsy(v)) { labels = false; breaks = false; }
      else if (typeof v === "string" && /^(labels?|text)$/i.test(v.trim())) breaks = false;
      else if (typeof v === "string" && /^(breaks?|bruch|brueche|brüche)$/i.test(v.trim())) labels = false;
    }
    if (falsy(P.breaks)) breaks = false;
    return { labels, breaks };
  }
  const HERO_KEYS = ["hero", "big", "gross", "groß", "intro"];
  const SUB_KEYS = ["sub", "subtitle", "untertitel", "line2", "zeile2", "zusatz"];
  const SUBAT_KEYS = ["subAt", "sub_at", "subtitleAt", "subtitle_at"];
  const HEROUNTIL_KEYS = ["heroUntil", "hero_until", "heroOut", "hero_out", "heroEnd", "hero_end", "until", "bis"];
  function parseTitle(P) {
    const v = pick(P, ["title", "titel", "heading", "headline", "ueberschrift", "überschrift", "caption"]);
    if (v === undefined || typeof v === "boolean") return null;
    let text = v, at = pick(P, ["titleAt", "title_at", "titelAt"]), tone = null;
    let hero = pick(P, ["titleHero", "title_hero", "heroTitle", "hero_title"]), sub = pick(P, ["titleSub", "title_sub"]);
    let subAt = pick(P, ["titleSubAt", "title_sub_at"]), heroUntil = pick(P, ["heroUntil", "hero_until", "titleHeroUntil"]);
    let compact = null;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      text = pick(v, ["text", "label", "title", "titel"]);
      const a = pick(v, AT_KEYS); if (a !== undefined) at = a;
      tone = toneColor(pick(v, TONE_KEYS));
      const h = pick(v, HERO_KEYS); if (h !== undefined) hero = h;
      const sb = pick(v, SUB_KEYS); if (sb !== undefined) sub = sb;
      const sa = pick(v, SUBAT_KEYS); if (sa !== undefined) subAt = sa;
      const hu = pick(v, HEROUNTIL_KEYS); if (hu !== undefined) heroUntil = hu;
      const cp = pick(v, ["compact", "short", "kurz"]); if (typeof cp === "string" && cp.trim()) compact = cp;
    }
    if (Array.isArray(text)) text = text.join(" ");
    if (text === undefined || text === null || typeof text === "boolean") return null;
    text = String(text);
    // Heldentitel: true | Sekunden (Ende der großen Phase) | { until }
    let heroOn = false;
    if (hero && typeof hero === "object" && !Array.isArray(hero)) {
      heroOn = !falsy(pick(hero, ["on", "enabled", "an"]));
      const hu = pick(hero, HEROUNTIL_KEYS.concat(["at", "t"])); if (hu !== undefined) heroUntil = hu;
    } else if (typeof hero === "number" && isFinite(hero)) { heroOn = hero > 0; if (hero > 1) heroUntil = hero; }
    else if (typeof hero === "string" && /^\s*\d/.test(hero)) { heroOn = true; heroUntil = hero; }
    else heroOn = truthy(hero);
    // Zeilenumbruch im Text = Hauptzeile / Zusatzzeile (nur, wenn keine eigene Zusatzzeile gesetzt ist)
    if ((sub === undefined || sub === null || sub === "") && /\n/.test(text)) {
      const parts = text.split(/\n+/);
      text = parts.shift(); sub = parts.join(" ");
    }
    text = text.replace(/\s+/g, " ").trim();
    sub = sub === undefined || sub === null || typeof sub === "boolean" ? "" : String(Array.isArray(sub) ? sub.join(" ") : sub).replace(/\s+/g, " ").trim().slice(0, 100);
    if (!text && sub) { text = sub; sub = ""; }
    if (!text) return null;
    const trimEnd = (x) => x.replace(/[\s,;:·–—-]+$/, "");
    const full = compact ? String(compact).replace(/\s+/g, " ").trim() : sub ? trimEnd(text) + ", " + sub : text;
    return { text: full.slice(0, 140), main: text.slice(0, 100), mainTrim: trimEnd(text), sub, explicitCompact: !!compact, at, subAt, tone, hero: heroOn, heroUntil };
  }

  // ---------------- Textumbruch ----------------
  const SHY = "­";
  const vis = (w) => w.split(SHY).join("");
  // Fugen deutscher Komposita (Technik-Wortschatz) als bevorzugte Trennstellen
  const HY_SUFFIX = /(keits|heits|ungs|schafts|tions|täts|ings|werks|gangs|fahrts|stands|gewichts|seil|seils|sicherheits)$/i;
  const HY_PARTS = ["begrenzer", "vorrichtung", "schiene", "scheibe", "gewicht", "seil", "aufzug", "aufzüge", "kabine", "bremse", "raum", "grube",
    "kette", "sicherheit", "geschwindigkeit", "puffer", "anlage", "prüfung", "richtlinie", "antrieb", "motor", "schacht", "werk", "maschine", "system", "kraft", "fahrt", "rolle", "norm", "palast"];
  /** Überlanges Wort trennen: vorhandener Bindestrich > weiches Trennzeichen > Kompositionsfuge > Zeichen. Gibt [kopf, rest] zurück. */
  function hyphenSplit(ctx, w, maxW) {
    const fits = (s2) => ctx.measureText(s2).width <= maxW;
    for (let j = w.length - 2; j >= 1; j--) if (w[j] === "-" && fits(vis(w.slice(0, j + 1)))) return [w.slice(0, j + 1), w.slice(j + 1)];
    for (let j = w.length - 2; j >= 2; j--) if (w[j] === SHY && fits(vis(w.slice(0, j)) + "-")) return [w.slice(0, j) + "-", w.slice(j + 1)];
    const plain = vis(w);
    let lo = 2, hi = Math.max(2, plain.length - 3); // größtes passendes Präfix per Bisektion
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (fits(plain.slice(0, mid) + "-")) lo = mid; else hi = mid - 1; }
    const kFit = lo;
    for (let k = kFit; k >= Math.max(3, Math.floor(kFit * 0.45)); k--) {
      const head = plain.slice(0, k), tail = plain.slice(k).toLowerCase();
      if (tail.length < 3) continue;
      if (HY_SUFFIX.test(head) || HY_PARTS.some((q) => tail.startsWith(q))) return [head + "-", plain.slice(k)];
    }
    return [plain.slice(0, Math.max(2, kFit)) + "-", plain.slice(Math.max(2, kFit))];
  }
  function wrapLines(ctx, str, maxW) {
    const out = [];
    for (const para of String(str).split(/\n/)) {
      const words = para.split(/[ \t\r]+/).filter(Boolean); // geschützte Leerzeichen ( ) bleiben zusammen
      let cur = "";
      for (let w of words) {
        let guard = 0;
        while (ctx.measureText(vis(w)).width > maxW && vis(w).length > 5 && guard++ < 20) {
          const [head, rest] = hyphenSplit(ctx, w, maxW);
          if (cur) { out.push(cur); cur = ""; }
          out.push(vis(head)); w = rest;
        }
        w = vis(w);
        const test = cur ? cur + " " + w : w;
        if (cur && ctx.measureText(test).width > maxW) { out.push(cur); cur = w; } else cur = test;
      }
      if (cur) out.push(cur);
    }
    return out;
  }
  /** Umbruch mit ausgeglichenen Zeilen (keine einzelnen Wörter in der letzten Zeile). */
  function wrapBalanced(ctx, str, maxW) {
    const base = wrapLines(ctx, str, maxW);
    if (base.length < 2) return base;
    let widest = 0;
    for (const w of String(str).split(/[ \t\r\n]+/)) widest = Math.max(widest, ctx.measureText(vis(w)).width);
    const lo0 = Math.max(maxW * 0.55, widest + 1);
    let lo = lo0, hi = maxW;
    if (lo >= hi) return base;
    for (let it = 0; it < 9; it++) {
      const mid = (lo + hi) / 2;
      if (wrapLines(ctx, str, mid).length === base.length) hi = mid; else lo = mid;
    }
    return wrapLines(ctx, str, hi + 0.5);
  }
  const cardH = (yearBase, ls, lh, nl) => (nl ? yearBase + 32 + 0.74 * ls + (nl - 1) * lh + 0.26 * ls + PADB : yearBase + PADB + 6);
  function ellipsize(ctx, s, maxW) {
    const trim = (x) => x.replace(/[\s,;:.–—-]+$/, "");
    let t = trim(s);
    if (ctx.measureText(t + "…").width <= maxW) return t + "…";
    const words = t.split(" ");
    while (words.length > 1 && ctx.measureText(trim(words.join(" ")) + "…").width > maxW) words.pop();
    t = trim(words.join(" "));
    if (t.length > 80) t = t.slice(0, 80);
    while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
    return t + "…";
  }

  // ---------------- Kamera (Engine-Fahrten) -> sichere Weltkoordinaten ----------------
  /** Zusätzlicher Seitenrand, damit Kamerafahrten der Engine (Zoom/Pan) nichts aus dem Bild schieben. */
  function cameraInset(cam) {
    switch (cam) {
      case "slow_push_in": case "slow_pull_out": return 80;
      case "pan_left": case "pan_right": return 120;
      case "tilt_up": case "tilt_down": return 66;
      default: return 0;
    }
  }
  /** Extremzustände der Kamera {s, dx, dy} (Engine: translate(c+d) · scale(s) · translate(−c)). */
  function camStates(cam) {
    switch (cam) {
      case "slow_push_in": case "slow_pull_out": return [{ s: 1, dx: 0, dy: 0 }, { s: 1.1, dx: 0, dy: 0 }];
      case "pan_left": case "pan_right": return [{ s: 1.08, dx: 60, dy: 0 }, { s: 1.08, dx: -60, dy: 0 }];
      case "tilt_up": case "tilt_down": return [{ s: 1.08, dx: 0, dy: 45 }, { s: 1.08, dx: 0, dy: -45 }];
      default: return [{ s: 1, dx: 0, dy: 0 }];
    }
  }
  /** Welt-y, unterhalb dessen Inhalte in JEDEM Kamerazustand unter Bildschirm-y ys liegen. */
  const worldTop = (ys, cams, cy) => cams.reduce((m, c) => Math.max(m, cy + (ys - cy - c.dy) / c.s), -1e9);
  /** Welt-y, oberhalb dessen Inhalte in jedem Kamerazustand über Bildschirm-y ys bleiben. */
  const worldBot = (ys, cams, cy) => cams.reduce((m, c) => Math.min(m, cy + (ys - cy - c.dy) / c.s), 1e9);
  /** Welt-x, rechts davon liegen Inhalte in jedem Kamerazustand rechts von Bildschirm-x xs. */
  const worldRight = (xs, cams, cx) => cams.reduce((m, c) => Math.max(m, cx + (xs - cx - c.dx) / c.s), -1e9);

  // ---------------- Titel / Overlay-Layout ----------------
  let OV_KEY = null, OV = null;
  function overlayLayout(ctx, text) {
    if (OV && OV_KEY === text) return OV;
    const str = upper(text).replace(/\s+/g, " ").trim();
    const MAXW = 1160; // Box bis x ≈ 1250 – Kapitel-Badge rechts oben bleibt frei
    let size = 40, lines = [str];
    ctx.save();
    const meas = (sz, s2) => { setFont(ctx, 700, sz, F_HEAD, 2); return ctx.measureText(s2).width; };
    while (size > 30 && meas(size, str) + 70 > MAXW) size -= 2;
    if (meas(size, str) + 70 > MAXW) {
      size = 32;
      for (;;) {
        setFont(ctx, 700, size, F_HEAD, 2);
        lines = wrapBalanced(ctx, str, MAXW - 70);
        if (lines.length <= 2 || size <= 24) break;
        size -= 2;
      }
      if (lines.length > 2) { setFont(ctx, 700, size, F_HEAD, 2); lines = lines.slice(0, 2); lines[1] = ellipsize(ctx, lines[1], MAXW - 70); }
    }
    let w = 0;
    for (const ln of lines) w = Math.max(w, meas(size, ln));
    ctx.restore();
    const lhh = size * 1.18;
    OV_KEY = text; OV = { size, lines, w: w + 70, lhh, h: size + 34 + (lines.length - 1) * lhh };
    return OV;
  }
  function titleLayout(ctx, text) {
    const str = upper(text);
    const MAXW = 1300;
    ctx.save();
    const meas = (sz, s2) => { setFont(ctx, 700, sz, F_HEAD, 3); return ctx.measureText(s2).width; };
    let size = 36, lines = [str];
    while (size > 28 && meas(size, str) > MAXW) size -= 2;
    if (meas(size, str) > MAXW) {
      size = 30; setFont(ctx, 700, size, F_HEAD, 3);
      lines = wrapBalanced(ctx, str, MAXW);
      if (lines.length > 2) { lines = lines.slice(0, 2); lines[1] = ellipsize(ctx, lines[1], MAXW); }
    }
    let w = 0;
    for (const ln of lines) w = Math.max(w, meas(size, ln));
    ctx.restore();
    const lh = Math.round(size * 1.28);
    return { size, lines, w, lh, h: Math.round(size * 0.74 + (lines.length - 1) * lh) };
  }

  /** Großer Heldentitel (Hauptzeile + optionale Zusatzzeile), zentriert; schrumpft später in den Titelplatz. */
  function heroLayout(ctx, main, sub) {
    const MAXW = 1380;
    const meas = (sz, s2) => { setFont(ctx, 700, sz, F_HEAD, 4); return ctx.measureText(s2).width; };
    const m = upper(main);
    ctx.save();
    let size = 88, lines = [m];
    while (size > 58 && meas(size, m) > MAXW) size -= 2;
    if (meas(size, m) > MAXW) {
      // zweizeilig; erst verkleinern, dann (notfalls) kürzen
      for (size = 66; ; size -= 4) {
        setFont(ctx, 700, size, F_HEAD, 4);
        lines = wrapBalanced(ctx, m, MAXW);
        if (lines.length <= 2 || size <= 46) break;
      }
      if (lines.length > 2) { lines = lines.slice(0, 2); lines[1] = ellipsize(ctx, lines[1], MAXW); }
    }
    let w = 0;
    for (const ln of lines) w = Math.max(w, meas(size, ln));
    let ss = 0, subLines = [];
    if (sub) {
      const su = upper(sub);
      ss = clamp(Math.round(size * 0.53), 30, 46);
      while (ss > 28 && meas(ss, su) > MAXW) ss -= 2;
      subLines = [su];
      if (meas(ss, su) > MAXW) {
        setFont(ctx, 700, ss, F_HEAD, 4);
        subLines = wrapBalanced(ctx, su, MAXW);
        if (subLines.length > 2) { subLines = subLines.slice(0, 2); subLines[1] = ellipsize(ctx, subLines[1], MAXW); }
      }
      for (const ln of subLines) w = Math.max(w, meas(ss, ln));
    }
    ctx.restore();
    const lh = Math.round(size * 1.14), slh = Math.round(ss * 1.3);
    const hMain = 0.74 * size + (lines.length - 1) * lh;
    const gap = subLines.length ? Math.round(Math.max(36, size * 0.62)) : 0;
    const hSub = subLines.length ? 0.74 * ss + (subLines.length - 1) * slh : 0;
    return { size, lines, w, lh, ss, subLines, slh, hMain, gap, hSub, h: hMain + gap + hSub };
  }

  // ---------------- Modell (Layout, gecacht pro Parametersatz/Kamera/Text/Dauer) ----------------
  let CACHE_KEY = null, CACHE_M = null;
  function getModel(ctx, params, env) {
    let key = "";
    try { key = JSON.stringify(params === undefined ? null : params); } catch (e) { key = "?"; }
    key += "|" + env.cam + "|" + env.fx + "|" + env.fy + "|" + env.text + "|" + env.d;
    if (CACHE_M && key === CACHE_KEY) return CACHE_M;
    const P = params && typeof params === "object" && !Array.isArray(params) ? params : {};
    const M = buildModel(ctx, P, env);
    M.T = buildTiming(M, P, env.d);
    CACHE_KEY = key; CACHE_M = M;
    return M;
  }
  function buildModel(ctx, P, env) {
    const all = normEvents(pick(P, ["events", "items", "ereignisse", "entries", "eintraege", "einträge", "timeline", "data", "list"])) || normEvents(DEFAULT_EVENTS);
    let hl = resolveHighlight(rawHighlight(P), all);
    let ws = 0;
    if (all.length > MAX_VIS) ws = hl >= 0 ? clamp(hl - 2, 0, all.length - MAX_VIS) : 0;
    const ev = all.slice(ws, ws + MAX_VIS).map((e) => Object.assign({}, e));
    hl = hl >= 0 ? hl - ws : -1;
    if (hl >= ev.length) hl = -1;
    const n = ev.length;
    const rtl = parseDir(P);
    const GM = parseGaps(P);
    const fs = sideOf(pick(P, ["firstSide", "first_side", "startSide", "erste_seite"]));
    const firstDown = fs === "down" || (fs === null && truthy(P.flip));
    const hlTone = toneColor(pick(P, ["highlightTone", "highlight_tone", "hlTone", "highlightColor", "highlight_color"]));
    const dimOthers = !falsy(pick(P, ["dimOthers", "dim_others", "dim", "abdunkeln"]));
    const cv = pick(P, ["counter", "yearCounter", "year_counter", "zaehler", "zähler"]);
    const counter = cv === undefined ? rtl : truthy(cv);
    const rwl = pick(P, ["rewindLabel", "rewind_label", "rewindText", "rewind_text", "rueckspulText"]);
    const rewindLabel = rtl && typeof rwl === "string" && rwl.trim() ? upper(rwl.replace(/\s+/g, " ").trim()).slice(0, 28) : "";

    // ---- horizontal ----
    const inset = cameraInset(env.cam);
    const SL = SAFE_L + inset, SR = SAFE_R - inset;
    ev.forEach((e, i) => { e.i = i; e.idx = ws + i; e.up = e.side ? e.side === "up" : (i % 2 === 0) !== firstDown; });
    let minStep = 99;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (ev[i].up === ev[j].up) { minStep = Math.min(minStep, j - i); break; }
    const spacingFor = (cw) => (n > 1 ? Math.min(560, (SR - SL - cw) / (n - 1)) : 0);
    let cardW = n <= 3 ? 500 : n === 4 ? 480 : n === 5 ? 430 : 400;
    // Karten auf derselben Seite dürfen sich auch vergrößert nicht berühren
    if (minStep < 99) while (cardW > 260 && cardW * 1.1 + 24 > minStep * spacingFor(cardW)) cardW -= 10;
    const baseYS = n <= 3 ? 76 : n === 4 ? 72 : n === 5 ? 62 : 56;
    const baseLS = n <= 3 ? 34 : n === 4 ? 33 : n === 5 ? 30 : 27;
    const sizes = [0, 2, 4, 6].map((k) => [baseLS - k, Math.round((baseLS - k) * 1.32)]);
    const spacing = spacingFor(cardW);
    const x0 = W0 / 2 - (spacing * (n - 1)) / 2;
    const xs = SL + 22 + (ws > 0 ? 34 : 0), xe = SR - 12; // bei abgeschnittener Vorgeschichte: Platz für gepunkteten Auslauf
    const inner = cardW - 2 * PADX;

    // ---- vertikal: Untertitelzone, Overlay-Box, Titel (alles über alle Kamerazustände abgesichert) ----
    const cams = camStates(env.cam);
    const botLim = Math.min(SAFE_B, worldBot(SUB_Y, cams, env.fy));
    let topLim = SAFE_T;
    const OVL = env.text && String(env.text).trim() ? overlayLayout(ctx, String(env.text)) : null;
    let ovTop = null, ovRight = null;
    if (OVL) {
      ovTop = Math.max(SAFE_T, worldTop(OV_TOP + OVL.h + OV_GAP, cams, env.fy));
      ovRight = worldRight(OV_X + 14 + OVL.w + 24, cams, env.fx);
    }
    const TI = parseTitle(P);
    let TT = null;
    if (TI) {
      const lay = titleLayout(ctx, TI.text);
      let top = SAFE_T - 6;
      if (OVL) top = Math.max(top, worldTop(OV_TOP + OVL.h + OV_GAP, cams, env.fy));
      TT = Object.assign({}, TI, lay, { top: Math.round(top) });
      if (TI.hero) TT.HL = heroLayout(ctx, TI.main, TI.sub);
      if (TI.sub && !TI.explicitCompact && lay.lines.length === 1) {
        // einzeiliger Titel „HAUPT, ZUSATZ“: Zusatz in Amber; Heldentitel verwandelt sich passgenau hinein
        ctx.save(); setFont(ctx, 700, lay.size, F_HEAD, 3);
        const prefix = upper(TI.mainTrim + ", "), subStr = upper(TI.sub);
        const wPrefix = ctx.measureText(prefix).width, wMain = ctx.measureText(upper(TI.mainTrim)).width, wSub = ctx.measureText(subStr).width;
        ctx.restore();
        const left = W0 / 2 - (wPrefix + wSub) / 2;
        TT.split = { prefix, subStr, left, wPrefix, mainCX: left + wMain / 2, subCX: left + wPrefix + wSub / 2 };
      }
      topLim = TT.top + lay.h + 36;
    }
    const AY0 = Math.round((topLim + botLim) / 2) + 4;

    ctx.save();
    ev.forEach((e) => {
      e.x = x0 + e.i * spacing;
      e.color = e.tone || COL.cyan;
      e.hlColor = (e.i === hl && hlTone) || e.tone || COL.amber;
      // Jahreszahl: Größe passend zur Kartenbreite (Platz für Index rechts)
      let ys = baseYS;
      setFont(ctx, 700, ys, F_HEAD, 1);
      while (ys > 28 && ctx.measureText(e.yearTxt || " ").width > inner - 50) { ys -= 2; setFont(ctx, 700, ys, F_HEAD, 1); }
      e.ys = ys;
      e.yearBase = PADT + 0.76 * ys;
      // Oberkante: Karten, die horizontal unter der Overlay-Box liegen, halten Abstand zu ihr
      e.topLim = topLim;
      if (e.up && ovTop !== null) {
        const cx = clamp(e.x, SL + 16 + cardW * 0.55, SR - 16 - cardW * 0.55);
        if (cx - cardW * 0.55 - 12 < ovRight) e.topLim = Math.max(topLim, ovTop);
      }
    });
    const bound = ev.some((e) => e.topLim > topLim);

    /** Kartenlayout für eine Achsenhöhe AY: gemeinsame Label-Schriftgröße, Umbruch, ggf. Kürzung. */
    function layoutFor(AY, ysc) {
      const room = ev.map((e) => (e.up ? AY - STEM_MIN - e.topLim : botLim - AY - STEM_MIN) - 14);
      const yss = ev.map((e) => Math.round(e.ys * ysc));
      const yb = yss.map((ys) => PADT + 0.76 * ys);
      const layoutAt = (ls, lh) => ev.map((e, i) => {
        setFont(ctx, 600, ls, F_BODY, 0);
        const lines = e.label ? wrapBalanced(ctx, e.label, inner) : [];
        return { lines, hh: cardH(yb[i], ls, lh, lines.length) };
      });
      const sumLines = (R) => R.reduce((a, r) => a + r.lines.length, 0);
      // Karten, die selbst in der kleinsten Stufe nicht passen, werden gekürzt und bestimmen die Größe nicht
      const smallest = layoutAt(sizes[sizes.length - 1][0], sizes[sizes.length - 1][1]);
      const hopeless = smallest.map((r, i) => r.hh > room[i] || r.lines.length > 3);
      let chosen = null;
      for (let k = 0; k < sizes.length && !chosen; k++) {
        const [ls, lh] = sizes[k];
        const R1 = layoutAt(ls, lh);
        const ok = R1.every((r, i) => hopeless[i] || (r.hh <= room[i] && r.lines.length <= 3));
        if (!ok && k < sizes.length - 1) continue;
        chosen = { ls, lh, res: R1 };
        // eine Stufe kleiner, wenn das Zeilen spart (weniger Umbrüche = ruhigeres Bild)
        if (ok && k + 1 < sizes.length) {
          const [ls2, lh2] = sizes[k + 1];
          const R2 = layoutAt(ls2, lh2);
          if (sumLines(R2) < sumLines(R1)) chosen = { ls: ls2, lh: lh2, res: R2 };
        }
      }
      let ellip = 0;
      const res = ev.map((e, i) => {
        let lines = chosen.res[i].lines, hh = chosen.res[i].hh;
        if (hh > room[i] && lines.length > 1) {
          // notfalls kürzen (Ellipse)
          let keep = lines.length;
          while (keep > 1 && cardH(yb[i], chosen.ls, chosen.lh, keep) > room[i]) keep--;
          setFont(ctx, 600, chosen.ls, F_BODY, 0);
          lines = lines.slice(0, keep);
          lines[keep - 1] = ellipsize(ctx, lines[keep - 1], inner);
          hh = cardH(yb[i], chosen.ls, chosen.lh, keep);
          ellip++;
        }
        return { lines, h: Math.round(hh) };
      });
      // Stiellänge: so lang wie möglich (luftiger), ohne dass Karten den sicheren Bereich verlassen
      let lim = STEM_MAX;
      ev.forEach((e, i) => { lim = Math.min(lim, e.up ? AY - e.topLim - res[i].h * 1.08 - 16 : botLim - AY - res[i].h * 1.08 - 16); });
      const stem = Math.round(clamp(lim, STEM_MIN, STEM_MAX));
      const score = -ellip * 1000 + chosen.ls * 10 - sumLines(res) * 2 - Math.abs(AY - AY0) * 0.05 - (ysc < 1 ? 25 : 0);
      return { AY, ls: chosen.ls, lh: chosen.lh, res, stem, score, ellip, yss, yb };
    }
    let best = layoutFor(AY0, 1);
    // Overlay drückt eine obere Karte nach unten: Achse etwas absenken, wenn unten Platz ist;
    // müsste gekürzt werden: kompaktere Jahreszahl (0,8×) versuchen, bevor Text verloren geht
    for (const ysc of [1, 0.8]) {
      if (ysc < 1 && best.ellip === 0) break;
      for (const dy of bound ? [0, 18, 36, 54] : [0]) {
        if (ysc === 1 && dy === 0) continue;
        if (dy > 0 && AY0 + dy + STEM_MIN + 120 > botLim) break;
        const c = layoutFor(AY0 + dy, ysc);
        if (c.score > best.score) best = c;
      }
    }
    ctx.restore();
    const AY = best.AY, stem = best.stem;
    if (TT && TT.HL) {
      // Heldentitel: mittig im Band zwischen Titelplatz und Achse (Achse + Platzhalter bleiben frei)
      const HB = TT.HL, lo = TT.top, hi = AY - 74;
      TT.heroTop = Math.round(Math.max(lo - 20, Math.min((lo + hi) / 2 - HB.h / 2, hi - HB.h)));
    }
    ev.forEach((e, i) => {
      e.ls = best.ls; e.lh = best.lh; e.lines = best.res[i].lines; e.h = best.res[i].h;
      e.ys = best.yss[i]; e.yearBase = best.yb[i];
      const room = e.up ? AY - stem - e.topLim : botLim - AY - stem;
      e.sMax = clamp(Math.min(1.1, room / (e.h + 16)), 1, 1.1);
    });

    // ---- Zeitsprünge zwischen benachbarten Ereignissen ----
    const gaps = [];
    const rawG = [];
    for (let i = 0; i < n - 1; i++) {
      const a = ev[i], b = ev[i + 1];
      rawG.push(a.num !== null && b.num !== null ? b.num - a.num : null);
    }
    const exactG = rawG.filter((g, i) => g !== null && g > 0 && !ev[i].today && !ev[i + 1].today);
    const anyG = rawG.filter((g) => g !== null && g > 0);
    const unit = exactG.length ? Math.min(...exactG) : anyG.length ? Math.min(...anyG) : 0;
    ctx.save();
    for (let i = 0; i < n - 1; i++) {
      const a = ev[i], b = ev[i + 1], g = rawG[i];
      let label = "";
      if (GM.labels && g !== null && g > 0 && !a.today && !b.today) label = (a.exact && b.exact ? "" : "ca. ") + fmtInt(g) + (g === 1 ? " Jahr" : " Jahre");
      const brk = GM.breaks && g !== null && g > 0 && unit > 0 && g >= 1.8 * unit && g - unit >= 8;
      setFont(ctx, 700, 20, F_MONO, 1);
      const lw = label ? ctx.measureText(label).width : 0;
      gaps.push({ xm: (a.x + b.x) / 2, label, lw, brk, g: g || 0, i });
    }
    ctx.restore();
    // höchstens zwei Bruchlinien (die größten Sprünge) – sonst wirkt die Achse zerhackt
    const brks = gaps.filter((g) => g.brk).sort((a, b) => b.g - a.g || a.i - b.i);
    for (let k = 2; k < brks.length; k++) brks[k].brk = false;
    // Achsenstücke zwischen den Bruchlinien
    const pieces = [];
    let a0 = xs;
    for (const g of gaps) if (g.brk) { pieces.push([a0, g.xm - GAPW]); a0 = g.xm + GAPW; }
    pieces.push([a0, xe]);
    return { ev, n, hl, cardW, spacing, stem, xs, xe, SL, SR, AY, gaps, pieces, TT, rtl, counter, rewindLabel, dimOthers, truncL: ws > 0, truncR: ws + MAX_VIS < all.length };
  }

  // ---------------- Zeitplan (BEATS / at, sonst skaliert mit d) ----------------
  function beatsOf(P, d) {
    let b = pick(P, ["beats", "beat", "takte"]);
    if (typeof b === "string") b = b.split(/[;\s]+/).filter(Boolean);
    if (typeof b === "number") b = [b];
    if (!Array.isArray(b)) return [];
    return b.map((v) => { const x = tArg(v, d, false); return x === null ? null : clampT(x, d); });
  }
  /** Achsen-Aufbaufenster [von, bis] in Sekunden (Lichtkopf fährt gleichmäßig, unabhängig von den Pop-Zeiten). */
  function sweepOf(P, d) {
    const v = pick(P, ["sweep", "axisSweep", "axis_sweep", "axisBuild", "axis_build", "aufbau"]);
    if (v === undefined) return null;
    let a = null, b = null;
    if (Array.isArray(v)) { a = tArg(v[0], d, false); b = tArg(v[1], d, false); }
    else if (v && typeof v === "object") { a = tArg(pick(v, ["from", "start", "von", "a"]), d, false); b = tArg(pick(v, ["to", "end", "bis", "b"]), d, false); }
    else if (typeof v === "string") {
      const m = v.trim().split(/\s*(?:\.\.|–|—|;|\/)\s*|\s+-\s+|(?<=\d)-(?=\d)/).filter(Boolean);
      if (m.length >= 2) { a = tArg(m[0], d, false); b = tArg(m[1], d, false); }
    }
    if (a === null || b === null) return null;
    a = clampT(a, d); b = clampT(b, d);
    if (b < a + 0.3) b = Math.min(d - 0.05, a + 0.3);
    return [a, b];
  }
  /** Lichtimpuls-Schleife: an/aus und Richtung (null = wie die Achse). */
  function pulseOf(P) {
    const v = pick(P, ["pulse", "pulses", "impuls", "pulseDir", "pulse_dir"]);
    if (v === undefined) return { on: true, rtl: null };
    if (falsy(v)) return { on: false, rtl: null };
    if (typeof v === "string") {
      const s2 = v.trim();
      if (/^(ltr|forward|forwards|vorwärts|vorwaerts|right|rechts)$/i.test(s2)) return { on: true, rtl: false };
      if (/^(rtl|back|backward|backwards|reverse|rückwärts|rueckwaerts|left|links)$/i.test(s2)) return { on: true, rtl: true };
    }
    return { on: true, rtl: null };
  }
  const HERO_MORPH = 0.65; // Dauer: Heldentitel -> Titelplatz
  function buildTiming(M, P, d) {
    const n = M.n, B = beatsOf(P, d);
    const has = (k) => B[k] !== null && B[k] !== undefined;
    const popIn = tArg(pick(P, ["pop", "popDur", "pop_s", "popDuration"]), d, false);
    const pop = popIn !== null ? clamp(popIn, 0.25, 2) : clamp(0.11 * d, 0.4, 1.2);
    const SW = sweepOf(P, d);
    const PU = pulseOf(P);
    // Titel / Heldentitel
    let titleAt = 0.35, subAt = 0.35;
    if (M.TT) {
      const ta = tArg(M.TT.at, d, false);
      titleAt = ta !== null ? clampT(ta, d) : has(3) ? B[3] : 0.35;
      const sa = tArg(M.TT.subAt, d, false);
      subAt = sa !== null ? clampT(sa, d) : titleAt + 0.45;
    }
    let heroOn = !!(M.TT && M.TT.HL), heroOut = null;
    if (heroOn) { const hu = tArg(M.TT.heroUntil, d, false); if (hu !== null) heroOut = clampT(hu, d); }
    let head0 = has(0) ? B[0] : SW ? SW[0] : Math.min(0.04 * d, 0.4);
    const lateCap = Math.max(0.3, d - 0.3 - 0.55 * pop); // späteste sinnvolle Pop-Zeit (Karte noch lesbar)
    const order = [];
    for (let k = 0; k < n; k++) order.push(M.rtl ? n - 1 - k : k);
    const seqAt = order.map((i) => { const x = tArg(M.ev[i].at, d, false); return x === null ? null : clampT(x, d); });
    const anyAt = seqAt.some((v) => v !== null);
    const rs = tArg(pick(P, ["revealStart", "reveal_start", "firstAt", "first_at"]), d, true);
    const re = tArg(pick(P, ["revealEnd", "reveal_end", "lastAt", "last_at", "spread"]), d, true);
    // Heldentitel ohne Zeitangaben: erst groß stehen lassen, Ereignisse danach
    if (heroOn && heroOut === null && !anyAt && rs === null) heroOut = Math.min(titleAt + clamp(0.3 * d, 1.5, 3.5), 0.6 * d);
    const heroFloor = heroOn && heroOut !== null && !anyAt && rs === null ? heroOut + 0.55 : 0;
    // Standardverteilung (ohne at)
    let first = Math.max(head0 + 0.35, heroFloor, n > 1 ? Math.min(0.1 * d, 1.2) : Math.min(0.2 * d, 1.8));
    if (rs !== null) first = clampT(rs, d);
    let last = n > 1 ? Math.max(first + 0.3 * (n - 1), 0.55 * d) : first;
    if (re !== null) last = clampT(re, d);
    last = Math.min(last, lateCap); first = Math.min(first, last);
    const seqDef = order.map((_, k) => (n > 1 ? lerp(first, last, k / (n - 1)) : first));
    const seq = anyAt ? seqAt.slice() : seqDef.slice();
    if (anyAt) {
      const step0 = n > 1 ? Math.max(0.3, (last - first) / (n - 1)) : 0.6;
      for (let k = 0; k < n; k++) {
        if (seqAt[k] !== null) continue;
        let kp = -1, kn = -1;
        for (let j = k - 1; j >= 0; j--) if (seqAt[j] !== null) { kp = j; break; }
        for (let j = k + 1; j < n; j++) if (seqAt[j] !== null) { kn = j; break; }
        if (kp >= 0 && kn >= 0) seq[k] = lerp(seqAt[kp], seqAt[kn], (k - kp) / (kn - kp));
        else if (kn >= 0) seq[k] = Math.min(seqDef[k], seqAt[kn] - 0.45 * (kn - k));
        else {
          const st = Math.min(step0, Math.max(0, lateCap - seqAt[kp]) / Math.max(1, n - 1 - kp));
          seq[k] = seqAt[kp] + Math.max(0.12, st) * (k - kp);
        }
        seq[k] = clampT(seq[k], d);
      }
    }
    const tn = new Array(n);
    order.forEach((i, k) => { tn[i] = seq[k]; });
    // Ankunft des Lichtkopfs (monoton): spätestens, wenn ein Knoten auf oder hinter ihm poppt
    // (bei nicht monotonen "at" fährt er zügig, aber sichtbar – min. 0,3 s je Knotenabstand – vor).
    // Mit sweep: gleichmäßige Fahrt im Aufbaufenster, aber nie später als der Pop eines Knotens.
    const arr = seq.slice();
    if (SW) {
      const xa = M.rtl ? M.xe : M.xs, xb = M.rtl ? M.xs : M.xe, span = Math.max(1, Math.abs(xb - xa));
      order.forEach((i, k) => { arr[k] = Math.min(seq[k], SW[0] + ((SW[1] - SW[0]) * Math.abs(M.ev[i].x - xa)) / span); });
    }
    const arr0 = arr.slice();
    for (let k = n - 2; k >= 0; k--) arr[k] = Math.min(arr[k], arr[k + 1] - (arr0[k] > arr[k + 1] ? 0.3 : 0));
    if (n && arr[0] < 0.2) { const sh = 0.2 - arr[0]; for (let k = 0; k < n; k++) arr[k] = Math.min(arr0[k], arr[k] + sh); }
    for (let k = 1; k < n; k++) arr[k] = Math.max(arr[k], arr[k - 1]);
    // Heldentitel: spätestens so schrumpfen, dass er weg ist, bevor die erste Karte aufklappt
    if (heroOn) {
      const firstPop = n ? Math.min.apply(null, tn) : d;
      if (heroOut === null) heroOut = firstPop - 0.55;
      heroOut = Math.min(heroOut, firstPop + 0.3 * pop - HERO_MORPH);
      if (heroOut < titleAt + 0.6) heroOn = false;
    }
    if (!has(0) && !SW && heroOn) head0 = heroOut;
    head0 = Math.max(0, Math.min(head0, (n ? arr[0] : d) - (SW ? 0.05 : 0.3)));
    const lastArr = n ? arr[n - 1] : head0;
    let headEnd = Math.max(lastArr, Math.min(d - 0.1, lastArr + Math.max(0.35, 0.06 * d)));
    if (SW) headEnd = Math.max(lastArr + 0.05, Math.min(d - 0.1, SW[1]));
    // Highlight
    let hl = 1e9;
    if (M.hl >= 0) {
      const hx = tArg(pick(P, ["highlightAt", "highlight_at", "hlAt", "hl_at"]), d, false);
      const ex = tArg(M.ev[M.hl].hlAt, d, false);
      if (hx !== null) hl = clampT(hx, d);
      else if (ex !== null) hl = clampT(ex, d);
      else if (has(1)) hl = B[1];
      else {
        const base = anyAt ? tn[M.hl] : Math.max.apply(null, tn);
        hl = Math.min(base + 0.75 * pop, Math.max(0.3, d - 0.45));
      }
    }
    const hlDur = clamp(0.1 * d, 0.35, 1.0);
    const pulse0 = has(2) ? B[2] : headEnd + 0.2;
    const period = clamp(0.3 * d, 2.0, 3.6);
    const gapT = M.gaps.map((g) => Math.max(tn[g.i], tn[g.i + 1]) + 0.3 * pop);
    const kt = [head0].concat(arr, [headEnd]);
    const kx = [M.rtl ? M.xe : M.xs].concat(order.map((i) => M.ev[i].x), [M.rtl ? M.xs : M.xe]);
    for (let k = 1; k < kt.length; k++) kt[k] = Math.max(kt[k], kt[k - 1]);
    return {
      head0, headEnd, pop, hl, hlDur, pulse0, period, tn, gapT, titleAt, subAt, heroOn, heroOut: heroOn ? heroOut : null, kt, kx,
      lin: !!SW, pulseOn: PU.on, pulseRtl: PU.rtl,
    };
  }
  function headPos(t, T) {
    const kt = T.kt, kx = T.kx;
    if (t <= kt[0]) return kx[0];
    for (let k = 0; k < kt.length - 1; k++) {
      if (t < kt[k + 1]) {
        const f = (t - kt[k]) / Math.max(1e-6, kt[k + 1] - kt[k]);
        if (T.lin) return lerp(kx[k], kx[k + 1], f); // sweep: gleichmäßige Fahrt
        return lerp(kx[k], kx[k + 1], 0.45 * f + 0.55 * sm(f)); // bremst an jedem Knoten leicht ab
      }
    }
    return kx[kx.length - 1];
  }

  /** Jahreszahl „entschlüsseln“: Zeichen lösen sich von links nach rechts aus Zufallsziffern/-buchstaben. */
  function decode(str, p, frame, salt) {
    if (p >= 1) return str;
    if (p <= 0) return "";
    let out = "";
    const n = str.length;
    for (let k = 0; k < n; k++) {
      const ch = str[k];
      const at = ((k + 1) / (n + 1)) * 0.8;
      if (p >= at + 0.2) { out += ch; continue; }
      if (p < at - 0.3) break;
      if (!/[0-9A-Za-zÄÖÜäöüß]/.test(ch)) { out += ch; continue; }
      const r = h01(frame * 13.7 + k * 7.1 + salt);
      const c = /[0-9]/.test(ch) ? DIG[Math.floor(r * 10)] : ALPH[Math.floor(r * 26)];
      out += /[a-zäöüß]/.test(ch) ? c.toLowerCase() : c;
    }
    return out;
  }

  // ---------------- Zeichnen: Atmosphäre ----------------
  function drawAtmosphere(ctx, t, W, AY) {
    // weiches Lichtband entlang der Achse – gestufte Vollflächen statt Verlauf (Verläufe großer Flächen sind teuer)
    ctx.save();
    ctx.fillStyle = "rgba(63,210,255,0.022)";
    for (const hh of [240, 90]) ctx.fillRect(0, AY - hh / 2, W, hh);
    // Staub/Partikel, die langsam in Zeitrichtung (nach rechts) treiben
    ctx.fillStyle = "#9fdcff";
    for (let i = 0; i < 40; i++) {
      const sp = 5 + 16 * h01(i * 3.7);
      const x = ((h01(i * 1.31) * (W + 40) + t * sp) % (W + 40)) - 20;
      const y = 210 + h01(i * 7.9) * 690 + Math.sin(t * 0.6 + i) * 9;
      ctx.globalAlpha = (0.07 + 0.2 * h01(i * 5.3)) * (0.6 + 0.4 * Math.sin(t * 1.3 + i * 2.1));
      ctx.beginPath(); ctx.arc(x, y, 0.8 + 1.5 * h01(i * 2.9), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ---------------- Zeichnen: Titel ----------------
  function drawTitle(ctx, L, M, T, t) {
    const TT = M.TT;
    if (!TT) return;
    if (T.heroOn && TT.HL) {
      if (t < T.titleAt) return;
      const m = seg(t, T.heroOut, HERO_MORPH), mk = eo(m);
      const exact = !!(TT.split && TT.HL.lines.length === 1 && TT.HL.subLines.length === 1);
      if (m < 1) drawHero(ctx, L, M, T, t, exact ? m : mk, exact);
      const ca = exact ? seg(m, 0.78, 0.2) : seg(mk, 0.45, 0.55);
      if (ca > 0) drawCompactTitle(ctx, L, TT, t, ca, T.heroOut + HERO_MORPH * 0.6, true);
      return;
    }
    const a = seg(t, T.titleAt, 0.55);
    if (a <= 0) return;
    drawCompactTitle(ctx, L, TT, t, a, T.titleAt + 0.15, false);
  }
  function drawCompactTitle(ctx, L, TT, t, a, ruleAt, noRise) {
    const cx = W0 / 2, col = TT.tone || COL.cyan;
    const rise = noRise ? 0 : 10 * (1 - eo(a));
    if (TT.split) {
      const SP = TT.split, by = TT.top + 0.74 * TT.size + rise;
      txt(ctx, SP.prefix, SP.left, by, { font: F_HEAD, weight: 700, size: TT.size, ls: 3, color: COL.white, glow: 14, glowColor: rgba(col, 0.75), alpha: eo(a) });
      txt(ctx, SP.subStr, SP.left + SP.wPrefix, by, { font: F_HEAD, weight: 700, size: TT.size, ls: 3, color: COL.amber, glow: 10, glowColor: rgba(COL.amber, 0.55), alpha: eo(a) });
    } else {
      TT.lines.forEach((ln, k) => txt(ctx, ln, cx, TT.top + 0.74 * TT.size + k * TT.lh + rise, {
        font: F_HEAD, weight: 700, size: TT.size, ls: 3, color: COL.white, align: "center", glow: 14, glowColor: rgba(col, 0.75), alpha: eo(a),
      }));
    }
    // Seitenlinien mit Rauten (Blueprint-Überschrift)
    const midY = TT.top + TT.h / 2;
    const half = TT.w / 2 + 28;
    const len = clamp(W0 / 2 - SAFE_L - 40 - half, 0, 170) * eo(seg(t, ruleAt, 0.6));
    if (len > 3) {
      L.glowPath(ctx, (c) => {
        c.moveTo(cx - half, midY); c.lineTo(cx - half - len, midY); c.lineTo(cx - half - len, midY + 9);
        c.moveTo(cx + half, midY); c.lineTo(cx + half + len, midY); c.lineTo(cx + half + len, midY + 9);
      }, col, 1.6, 0.6, { alpha: 0.7 * a, cap: "butt" });
      ctx.save();
      ctx.globalAlpha = a * (0.8 + 0.2 * Math.sin(t * 2.3)); ctx.fillStyle = COL.amber;
      for (const sx of [-1, 1]) {
        const x = cx + sx * half;
        ctx.beginPath(); ctx.moveTo(x, midY - 5); ctx.lineTo(x + 5, midY); ctx.lineTo(x, midY + 5); ctx.lineTo(x - 5, midY); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }
  /** Eine Zeile des Heldentitels an (x, Grundlinie y) mit Skalierung s; öffnet sich von der Mitte (rv < 1) mit leuchtenden Kanten. */
  function heroLine(ctx, L, str, x, y, s, size, ls, color, glowColor, glow, alpha, rv, halfW) {
    if (alpha <= 0.003) return;
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    const ex = (halfW + 24) * rv, capH = 0.74 * size;
    if (rv < 1) { ctx.save(); ctx.beginPath(); ctx.rect(-ex, -capH - 40, 2 * ex, capH + 80); ctx.clip(); }
    txt(ctx, str, 0, 0, { font: F_HEAD, weight: 700, size, ls, color, align: "center", glow, glowColor, alpha });
    if (rv < 1) {
      ctx.restore();
      const ea = (1 - rv) * alpha;
      L.line(ctx, -ex, -capH - 14, -ex, 14, COL.ice, 2, 1, { alpha: ea, cap: "butt" });
      L.line(ctx, ex, -capH - 14, ex, 14, COL.ice, 2, 1, { alpha: ea, cap: "butt" });
    }
    ctx.restore();
  }
  /** Heldentitel: große Hauptzeile (+ Zusatzzeile) mit Zielerfassungs-Klammern; mk = Fortschritt der Verwandlung in den Titelplatz.
      exact: Haupt- und Zusatzzeile fliegen einzeln an ihre Stelle in der einzeiligen Titelzeile (passgenaue Überblendung). */
  function drawHero(ctx, L, M, T, t, mk, exact) {
    const TT = M.TT, H = TT.HL, col = TT.tone || COL.cyan, cx = W0 / 2;
    // exact: mk ist linear; Geometrie ist bei 0,82 fertig (gestaffelt: erst Größe + seitlich, dann hoch), danach reine Überblendung
    const q = clamp(mk / 0.82, 0, 1);
    const qx = eo(seg(q, 0, 0.7)), qy = sm(seg(q, 0.3, 0.7)), qs = sm(seg(q, 0, 0.85));
    const heroA = exact ? 1 - seg(mk, 0.82, 0.18) : 1 - seg(mk, 0.3, 0.45);
    if (heroA <= 0) return;
    const deco = 1 - seg(mk, 0, 0.3);
    // Blocktransformation (einfache Verwandlung); bei exact bleiben Linie/Klammern stehen und blenden nur aus
    const sc = exact ? 1 : lerp(1, TT.size / H.size, mk), bcy = exact ? TT.heroTop + H.h / 2 : lerp(TT.heroTop + H.h / 2, TT.top + TT.h / 2, mk);
    const blk = (dy) => bcy + (dy - H.h / 2) * sc; // Blockversatz ab Oberkante -> absolute y (einfache Verwandlung)
    const cb = TT.top + 0.74 * TT.size;            // Grundlinie der Titelzeile
    const breath = 0.85 + 0.15 * Math.sin(t * 2.1);
    const halfW = H.w / 2;
    // Hauptzeile(n)
    const ma = seg(t, T.titleAt, 0.6), rv = eo(ma);
    H.lines.forEach((ln, k) => {
      const by = 0.74 * H.size + k * H.lh;
      let x = cx, y = blk(by), s2 = sc, ls = 4;
      if (exact) { const se = TT.size / H.size; x = lerp(cx, TT.split.mainCX, qx); y = lerp(TT.heroTop + by, cb, qy); s2 = lerp(1, se, qs); ls = lerp(4, 3 / se, qs); }
      heroLine(ctx, L, ln, x, y + 8 * (1 - rv) * s2, s2, H.size, ls, COL.white, rgba(col, 0.8), 20, heroA * Math.min(1, ma * 1.6), rv, halfW);
    });
    // Trennlinie (Blueprint) mit Rauten an den Enden
    const ruleDy = H.subLines.length ? H.hMain + H.gap * 0.5 : H.hMain + 26;
    const rl = halfW * 0.72 * eo(seg(t, T.titleAt + 0.2, 0.7)) * sc;
    const ra = deco * heroA;
    if (rl > 2 && ra > 0) {
      const ry = blk(ruleDy);
      L.line(ctx, cx - rl, ry, cx + rl, ry, col, 1.5, 0.7, { alpha: 0.55 * ra, cap: "butt" });
      ctx.save(); ctx.globalAlpha = ra * breath; ctx.fillStyle = COL.amber;
      for (const sx of [-1, 1]) {
        const x = cx + sx * rl;
        ctx.beginPath(); ctx.moveTo(x, ry - 5); ctx.lineTo(x + 5, ry); ctx.lineTo(x, ry + 5); ctx.lineTo(x - 5, ry); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    // Zusatzzeile (z. B. Beispiele) – eigene Einblendzeit
    if (H.subLines.length) {
      const sa = seg(t, T.subAt, 0.55), srv = eo(sa);
      if (sa > 0) H.subLines.forEach((ln, k) => {
        const by = H.hMain + H.gap + 0.74 * H.ss + k * H.slh;
        let x = cx, y = blk(by), s2 = sc, ls = 4, a = heroA * (exact ? 1 : deco);
        if (exact) { const se = TT.size / H.ss; x = lerp(cx, TT.split.subCX, qx); y = lerp(TT.heroTop + by, cb, qy); s2 = lerp(1, se, qs); ls = lerp(4, 3 / se, qs); }
        heroLine(ctx, L, ln, x, y + 6 * (1 - srv) * s2, s2, H.ss, ls, COL.amber, rgba(COL.amber, 0.6), 12, a * Math.min(1, sa * 1.6), srv, halfW);
      });
    }
    // Zielerfassung: Eckklammern um den ganzen Block (ziehen sich zusammen, atmen leicht)
    const ba = seg(t, T.titleAt, 0.5) * deco * heroA;
    if (ba > 0) {
      const o = lerp(46, 26, eo(seg(t, T.titleAt, 0.8))) * sc;
      const bw = (halfW + 12) * sc, y1 = blk(0) - o, y2 = blk(H.h) + o, k = 28 * sc;
      const x1 = cx - bw - o, x2 = cx + bw + o;
      L.glowPath(ctx, (c) => {
        c.moveTo(x1, y1 + k); c.lineTo(x1, y1); c.lineTo(x1 + k, y1);
        c.moveTo(x2 - k, y1); c.lineTo(x2, y1); c.lineTo(x2, y1 + k);
        c.moveTo(x2, y2 - k); c.lineTo(x2, y2); c.lineTo(x2 - k, y2);
        c.moveTo(x1 + k, y2); c.lineTo(x1, y2); c.lineTo(x1, y2 - k);
      }, col, 2.2, 0.9, { alpha: ba * (0.75 + 0.25 * breath), cap: "square" });
    }
  }

  // ---------------- Zeichnen: Achse ----------------
  function axisPath(c, M, x0, x1) {
    const AY = M.AY;
    for (const pc of M.pieces) {
      const a = Math.max(pc[0], x0), b = Math.min(pc[1], x1);
      if (b > a) { c.moveTo(a, AY); c.lineTo(b, AY); }
    }
  }
  function drawAxis(ctx, L, M, T, t, headX) {
    const AY = M.AY, tn = T.tn;
    // Geisterschiene (gestrichelt, driftet langsam in Laufrichtung)
    ctx.save();
    ctx.strokeStyle = "rgba(63,210,255,0.17)"; ctx.lineWidth = 1.5; ctx.setLineDash([3, 9]); ctx.lineDashOffset = (M.rtl ? 1 : -1) * t * 14;
    ctx.beginPath(); ctx.moveTo(M.xs, AY); ctx.lineTo(M.xe, AY); ctx.stroke();
    // Platzhalter der kommenden Knoten (Blueprint-Vorzeichnung)
    ctx.setLineDash([]); ctx.lineWidth = 1.5;
    for (let i = 0; i < M.n; i++) {
      const a = 1 - seg(t, tn[i] - 0.05, 0.15);
      if (a <= 0) continue;
      ctx.globalAlpha = a * (0.22 + 0.08 * Math.sin(t * 2.5 + i * 1.3));
      ctx.strokeStyle = COL.cyan;
      ctx.beginPath(); ctx.arc(M.ev[i].x, AY, 9, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(M.ev[i].x, AY + (M.ev[i].up ? -16 : 16)); ctx.lineTo(M.ev[i].x, AY + (M.ev[i].up ? -34 : 34)); ctx.stroke();
    }
    ctx.restore();
    if (t < T.head0) return;
    const s0 = M.rtl ? headX : M.xs, s1 = M.rtl ? M.xe : headX; // bereits gezeichneter Abschnitt

    if (s1 - s0 > 0.5) {
      // Teilstriche unterhalb der Achse (Lineal-Optik), nur im gezeichneten Abschnitt
      ctx.save();
      ctx.strokeStyle = "rgba(63,210,255,0.26)"; ctx.lineWidth = 1.4; ctx.beginPath();
      for (let x = M.xs + 20, k = 1; x < M.xe - 6; x += 20, k++) {
        if (x < s0 + 6 || x > s1 - 6) continue;
        let skip = false;
        for (const e of M.ev) if (Math.abs(x - e.x) < 26) { skip = true; break; }
        if (!skip) for (const g of M.gaps) if (g.brk && Math.abs(x - g.xm) < GAPW + 12) { skip = true; break; }
        if (skip) continue;
        const hh = k % 5 === 0 ? 9 : 4;
        ctx.moveTo(x + 0.5, AY + 8); ctx.lineTo(x + 0.5, AY + 8 + hh);
      }
      ctx.stroke(); ctx.restore();
      // leuchtende Achse (mit Lücken an Bruchlinien)
      L.glowPath(ctx, (c) => axisPath(c, M, s0, s1), COL.cyan, 3, 1);
    }
    // linke Endkappe (rtl: erst, wenn der Kopf links angekommen ist)
    const capA = M.rtl ? seg(M.xs + 30 - headX, 0, 30) : seg(t, T.head0, 0.25);
    if (capA > 0) {
      L.line(ctx, M.xs, AY - 11, M.xs, AY + 11, COL.cyan, 2.5, 0.8, { alpha: capA });
      if (M.truncL) {
        ctx.save(); ctx.globalAlpha = 0.6 * capA; ctx.strokeStyle = COL.cyan; ctx.lineWidth = 2; ctx.setLineDash([4, 7]);
        ctx.beginPath(); ctx.moveTo(M.xs - 8, AY); ctx.lineTo(M.SL, AY); ctx.stroke(); ctx.restore();
      }
    }

    // Bruchlinien + Zeitabstände
    for (let gi = 0; gi < M.gaps.length; gi++) {
      const g = M.gaps[gi];
      if (g.brk) {
        const a = M.rtl ? seg(g.xm - GAPW - headX, 0, 40) : seg(headX, g.xm + GAPW, 40);
        if (a > 0) {
          L.glowPath(ctx, (c) => {
            c.moveTo(g.xm - GAPW - 5, AY + 13); c.lineTo(g.xm - GAPW + 5, AY - 13);
            c.moveTo(g.xm + GAPW - 5, AY + 13); c.lineTo(g.xm + GAPW + 5, AY - 13);
          }, COL.cyan, 2.2, 0.8, { alpha: a });
        }
      }
      if (g.label) {
        const a = seg(t, T.gapT[gi], 0.35);
        if (a > 0) {
          const y = AY - 24 - 6 * (1 - eo(a));
          txt(ctx, g.label, g.xm, y, { font: F_MONO, weight: 700, size: 20, color: COL.muted, align: "center", ls: 1, alpha: 0.9 * a });
          // kleine Maßklammer über der Strecke (links/rechts neben dem Text)
          const inner = g.lw / 2 + 10;
          const half = Math.min(M.spacing / 2 - 34, inner + 34);
          if (half > inner + 12) {
            L.glowPath(ctx, (c) => { c.moveTo(g.xm - half, AY - 12); c.lineTo(g.xm - half, AY - 18); c.lineTo(g.xm - inner, AY - 18); c.moveTo(g.xm + inner, AY - 18); c.lineTo(g.xm + half, AY - 18); c.lineTo(g.xm + half, AY - 12); },
              COL.muted, 1.2, 0, { alpha: 0.45 * a, cap: "butt" });
          }
        }
      }
    }

    // Pfeilspitze + „Zeit“ (Zeit läuft immer nach rechts – beim Zurückspulen steht der Pfeil von Anfang an)
    const arrA = M.rtl ? seg(t, T.head0, 0.25) : seg(headX, M.xe - 30, 30);
    if (arrA > 0) {
      L.poly(ctx, [[M.xe - 17, AY - 12], [M.xe + 1, AY], [M.xe - 17, AY + 12]], COL.cyan, 3, 1, { alpha: arrA });
      txt(ctx, "ZEIT", M.xe + 2, AY + 40, { font: F_MONO, weight: 700, size: 16, color: COL.muted, align: "right", ls: 4, alpha: 0.75 * arrA });
    }
  }

  function drawHead(ctx, L, M, T, t, headX) {
    if (t < T.head0 || t > T.headEnd + 0.45) return;
    const ha = t < T.headEnd ? seg(t, T.head0, 0.15) : 1 - seg(t, T.headEnd, 0.45);
    if (ha <= 0) return;
    const AY = M.AY;
    const x0 = M.rtl ? Math.min(M.xe, headX + 260) : Math.max(M.xs, headX - 260); // Schweif hinter dem Kopf
    ctx.save();
    if (Math.abs(headX - x0) > 1) {
      const g = ctx.createLinearGradient(x0, 0, headX, 0);
      g.addColorStop(0, "rgba(63,210,255,0)"); g.addColorStop(1, "rgba(210,244,255,0.95)");
      ctx.globalAlpha = ha; ctx.strokeStyle = g; ctx.lineWidth = 5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x0, AY); ctx.lineTo(headX, AY); ctx.stroke();
    }
    // vertikale Scanlinie
    const v = ctx.createLinearGradient(0, AY - 80, 0, AY + 80);
    v.addColorStop(0, "rgba(63,210,255,0)"); v.addColorStop(0.5, "rgba(63,210,255,0.55)"); v.addColorStop(1, "rgba(63,210,255,0)");
    ctx.globalAlpha = ha; ctx.strokeStyle = v; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(headX, AY - 80); ctx.lineTo(headX, AY + 80); ctx.stroke();
    ctx.restore();
    L.glowDot(ctx, headX, AY, 58, COL.cyan, 0.5 * ha);
    L.glowDot(ctx, headX, AY, 13, "#ffffff", 0.95 * ha);
    const moving = t < T.headEnd;
    if (M.rtl && moving) {
      // Zurückspulen: wandernde Doppel-Chevrons vor dem Kopf („◀◀“)
      const ph = (t * 2.6) % 1;
      ctx.save();
      ctx.strokeStyle = COL.ice; ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (let k = 0; k < 3; k++) {
        const q = (k + ph) / 3;
        const x = headX - 24 - q * 42;
        if (x < M.xs + 4) continue;
        ctx.globalAlpha = ha * Math.sin(Math.PI * q) * 0.9;
        ctx.beginPath(); ctx.moveTo(x + 7, AY - 8); ctx.lineTo(x, AY); ctx.lineTo(x + 7, AY + 8); ctx.stroke();
      }
      ctx.restore();
    }
    if (M.rewindLabel && M.rtl && moving) drawRewindBadge(ctx, L, M, T, t, headX, ha);
    if (M.counter && moving) {
      // rollender Jahreszähler zwischen zwei Jahres-Knoten
      for (let k = 0; k < M.n - 1; k++) {
        const a = M.ev[k], b = M.ev[k + 1];
        if (headX <= a.x || headX >= b.x) continue;
        if (a.num !== null && b.num !== null && a.num !== b.num) {
          const f = (headX - a.x) / (b.x - a.x);
          const va = ha * sm(Math.min(f, 1 - f) / 0.14);
          const yr = Math.round(lerp(a.num, b.num, f));
          txt(ctx, String(yr), headX, AY + 54, { font: F_MONO, weight: 700, size: 24, color: COL.ice, align: "center", ls: 2, alpha: 0.9 * va, glow: 10, glowColor: COL.cyan });
        }
        break;
      }
    }
  }

  /** „◀◀ ZURÜCKSPULEN“-Plakette, die beim Zurückspulen mit dem Lichtkopf mitfährt (unter der Achse; mit Zähler darüber). */
  function drawRewindBadge(ctx, L, M, T, t, headX, ha) {
    const a = ha * (1 - seg(t, T.headEnd - 0.35, 0.3));
    if (a <= 0.01) return;
    const AY = M.AY, label = M.rewindLabel, fs = 21;
    ctx.save();
    setFont(ctx, 700, fs, F_MONO, 4);
    const tw = ctx.measureText(label).width;
    ctx.restore();
    const icon = 30, w = 16 + icon + 12 + tw + 14, h = 40;
    const cx = clamp(headX, M.SL + w / 2 + 4, M.SR - w / 2 - 4);
    const cy = M.counter ? AY - 70 : AY + 78;
    const x0 = cx - w / 2, y0 = cy - h / 2;
    const pop = eob(seg(t, T.head0, 0.35));
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(pop, pop); ctx.translate(-cx, -cy);
    L.panel(ctx, x0, y0, w, h, { fill: "rgba(4,12,26,0.86)", stroke: rgba(COL.cyan, 0.55), r: 6, alpha: a });
    // Doppel-Dreieck ◀◀ (gezeichnet, nicht aus der Schrift) – blinkt leicht im Spultakt
    const blink = 0.7 + 0.3 * Math.sin(t * 9);
    ctx.globalAlpha = a * blink; ctx.fillStyle = COL.ice;
    const ix = x0 + 16, iy = cy;
    for (const off of [0, 14]) { ctx.beginPath(); ctx.moveTo(ix + off, iy); ctx.lineTo(ix + off + 15, iy - 9); ctx.lineTo(ix + off + 15, iy + 9); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    txt(ctx, label, x0 + 16 + icon + 12, cy + fs * 0.36, { font: F_MONO, weight: 700, size: fs, ls: 4, color: COL.ice, glow: 8, glowColor: COL.cyan, alpha: a * pop });
    // feine Verbindung zum Kopf
    L.line(ctx, headX, AY + (M.counter ? -14 : 14), headX, cy + (M.counter ? h / 2 : -h / 2), COL.ice, 1.2, 0.4, { alpha: 0.5 * a, cap: "butt" });
  }

  /** Lichtimpuls, der nach dem Aufbau wiederholt über die Achse läuft (in Laufrichtung). Gibt x und Stärke zurück. */
  function pulseState(M, T, t) {
    if (!T.pulseOn || t < T.pulse0) return null;
    const ph = ((t - T.pulse0) / T.period) % 1;
    const TRAVEL = 0.72;
    if (ph >= TRAVEL) return null;
    const q = ph / TRAVEL;
    const rtl = T.pulseRtl === null ? M.rtl : T.pulseRtl;
    return { x: rtl ? lerp(M.xe, M.xs, q) : lerp(M.xs, M.xe, q), a: Math.min(1, q / 0.05, (1 - q) / 0.05), rtl };
  }
  function drawPulse(ctx, L, M, P) {
    if (!P || P.a <= 0) return;
    const AY = M.AY;
    const x0 = P.rtl ? Math.min(M.xe, P.x + 200) : Math.max(M.xs, P.x - 200);
    ctx.save();
    if (Math.abs(P.x - x0) > 1) {
      const g = ctx.createLinearGradient(x0, 0, P.x, 0);
      g.addColorStop(0, "rgba(63,210,255,0)"); g.addColorStop(1, "rgba(220,247,255,0.9)");
      ctx.globalAlpha = P.a; ctx.strokeStyle = g; ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x0, AY); ctx.lineTo(P.x, AY); ctx.stroke();
    }
    ctx.restore();
    L.glowDot(ctx, P.x, AY, 36, COL.cyan, 0.6 * P.a);
    L.glowDot(ctx, P.x, AY, 7, "#ffffff", 0.9 * P.a);
  }

  // ---------------- Zeichnen: Knoten + Stiel ----------------
  function drawStem(ctx, L, M, e, pp, col, dim, t) {
    const sp = eo(seg(pp, 0.12, 0.3));
    if (sp <= 0) return;
    const AY = M.AY, dir = e.up ? -1 : 1;
    const y0 = AY + dir * 20, y1 = AY + dir * M.stem;
    const yy = lerp(y0, y1, sp);
    L.line(ctx, e.x, y0, e.x, yy, col, 2, 0.7, { alpha: 0.9 * dim, cap: "butt" });
    ctx.save();
    ctx.globalAlpha = 0.6 * dim * sp; ctx.strokeStyle = COL.ice; ctx.lineWidth = 2;
    ctx.setLineDash([3, 10]); ctx.lineDashOffset = -t * 36;
    ctx.beginPath(); ctx.moveTo(e.x, y0); ctx.lineTo(e.x, yy); ctx.stroke();
    ctx.restore();
  }
  function drawNode(ctx, L, M, e, pp, col, dim, flash, isHL, hlS, T, t) {
    const s = eob(seg(pp, 0, 0.35));
    if (s <= 0) return;
    const x = e.x, AY = M.AY;
    const r = (11 + (isHL ? 5 * hlS : 0)) * s;
    // Halo
    L.glowDot(ctx, x, AY, 30 + 30 * flash + (isHL ? 26 * hlS : 0), col, (0.28 + 0.55 * flash + (isHL ? 0.3 * hlS : 0)) * dim);
    // Achse unter dem Knoten abdecken
    ctx.save(); ctx.globalAlpha = dim; ctx.fillStyle = COL.bg; ctx.beginPath(); ctx.arc(x, AY, r + 1.5, 0, TAU); ctx.fill(); ctx.restore();
    const breath = 0.85 + 0.15 * Math.sin(t * 2.2 + e.i * 1.7);
    L.circle(ctx, x, AY, r, col, 2.6, 1, { alpha: dim });
    ctx.save(); ctx.globalAlpha = dim * breath; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, AY, r * 0.45, 0, TAU); ctx.fill(); ctx.restore();
    if (flash > 0.05) L.glowDot(ctx, x, AY, 10, "#ffffff", 0.8 * flash * dim);
    // Schockwelle beim Erscheinen
    const sw = seg(pp, 0.06, 0.5);
    if (sw > 0 && sw < 1) L.circle(ctx, x, AY, lerp(r, 72, eo(sw)), col, 2, 0.5, { alpha: (1 - sw) * 0.8 * dim });
    // Highlight: Blitz + wiederkehrende Ringe
    if (isHL && hlS > 0) {
      const fl = 1 - seg(t, T.hl, 0.7);
      if (fl > 0) L.glowDot(ctx, x, AY, 170, e.hlColor, 0.45 * fl);
      for (let k = 0; k < 2; k++) {
        const ph = (((t - T.hl) / 1.8 + k * 0.5) % 1 + 1) % 1;
        L.circle(ctx, x, AY, r + 6 + 46 * eo(ph), e.hlColor, 1.8, 0.4, { alpha: (1 - ph) * 0.65 * hlS });
      }
    }
  }

  // ---------------- Zeichnen: Karte ----------------
  function cardGeom(M, e, isHL, hlB) {
    const w = M.cardW;
    const s = isHL ? 1 + (e.sMax - 1) * hlB : 1;
    const ay = e.up ? M.AY - M.stem : M.AY + M.stem;
    const cx = clamp(e.x, M.SL + 16 + (w * s) / 2, M.SR - 16 - (w * s) / 2);
    return { w, s, ay, cx, cy: ay + (e.up ? -1 : 1) * (e.h * s) / 2 };
  }
  function drawCard(ctx, L, M, e, pp, t, col, dim, isHL, hlS, hlB) {
    const cp = seg(pp, 0.3, 0.55);
    if (cp <= 0) return;
    const G = cardGeom(M, e, isHL, hlB);
    const w = G.w, h = e.h;
    const ox = (e.x - G.cx) / G.s; // Stielposition in Kartenkoordinaten
    const top = e.up ? -h : 0;
    const wP = eo(seg(cp, 0, 0.4)), hP = eo(seg(cp, 0.25, 0.5));
    ctx.save();
    ctx.translate(G.cx, G.ay); ctx.scale(G.s, G.s);

    const revealing = cp < 1 && hP < 1;
    let lx = -w / 2, rx = w / 2, rh = h;
    if (revealing) {
      lx = lerp(ox, -w / 2, wP); rx = lerp(ox, w / 2, wP); rh = Math.max(3, h * hP);
      ctx.save();
      ctx.beginPath();
      if (e.up) ctx.rect(lx - 14, -rh - 3, rx - lx + 28, rh + 18);
      else ctx.rect(lx - 14, -15, rx - lx + 28, rh + 18);
      ctx.clip();
    }

    // Kartenkörper
    L.panel(ctx, -w / 2, top, w, h, { fill: "rgba(5,14,30,0.9)", stroke: rgba(col, 0.5), r: 10, alpha: dim });
    if (isHL && hlS > 0) {
      L.glowPath(ctx, (c) => L.roundRectPath(c, -w / 2, top, w, h, 10), e.hlColor, 2.4, 1.15 + 0.35 * Math.sin(t * 2.4), { alpha: hlS });
    }
    // Akzent an der Anschlusskante (zur Achse hin)
    L.line(ctx, ox - 34, 0, ox + 34, 0, col, 3, 1, { alpha: dim, cap: "butt" });

    // Jahreszahl (Decode-Effekt) + Index
    const yp = seg(cp, 0.3, 0.45);
    const yTxt = decode(e.yearTxt, yp, Math.floor(t * 24), e.i * 31 + 5);
    // Glow (shadowBlur) nur, solange die Karte nicht abgedimmt ist – spart Rechenzeit, optisch ohnehin kaum sichtbar
    const yGlow = isHL ? 12 + 10 * hlS : dim > 0.75 ? 12 : 0;
    txt(ctx, yTxt, -w / 2 + PADX, top + e.yearBase, { font: F_HEAD, weight: 700, size: e.ys, color: col, glow: yGlow, glowColor: isHL ? col : rgba(col, clamp((dim - 0.75) * 4, 0, 1)), ls: 1, alpha: dim * seg(cp, 0.25, 0.12) });
    txt(ctx, String(e.idx + 1).padStart(2, "0"), w / 2 - PADX, top + PADT + 17, { font: F_MONO, weight: 700, size: 16, color: isHL ? mix(COL.muted, e.hlColor, hlS) : COL.muted, align: "right", ls: 2, alpha: 0.7 * dim * seg(cp, 0.35, 0.3) });

    if (e.lines.length) {
      const sepY = top + e.yearBase + 16;
      const sw = (w - 2 * PADX) * eo(seg(cp, 0.4, 0.35));
      ctx.save();
      ctx.globalAlpha = 0.35 * dim; ctx.fillStyle = COL.muted; ctx.fillRect(-w / 2 + PADX, sepY, sw, 1.2);
      ctx.globalAlpha = dim; ctx.fillStyle = col; ctx.fillRect(-w / 2 + PADX, sepY - 1, Math.min(sw, 52), 3);
      ctx.restore();
      const fb = sepY + 16 + 0.74 * e.ls;
      for (let k = 0; k < e.lines.length; k++) {
        const la = seg(cp, 0.5 + k * 0.08, 0.3);
        if (la <= 0) break;
        txt(ctx, e.lines[k], -w / 2 + PADX + 10 * (1 - eo(la)), fb + k * e.lh, { font: F_BODY, weight: 600, size: e.ls, color: isHL ? "#ffffff" : COL.white, alpha: (isHL ? 1 : 0.95) * dim * la });
      }
    }

    if (revealing) {
      ctx.restore();
      // leuchtende Aufklapp-Kante
      const ey = e.up ? -rh : rh;
      L.line(ctx, lx, ey, rx, ey, col, 2, 1, { alpha: 0.9 * dim * (1 - hP * 0.6), cap: "butt" });
    }

    // Zielerfassung: Eckklammern um das Highlight
    if (isHL && hlS > 0) {
      const o = lerp(34, 10, eo(hlS)), k = 22;
      const x1 = -w / 2 - o, x2 = w / 2 + o, y1 = top - o, y2 = top + h + o;
      L.glowPath(ctx, (c) => {
        c.moveTo(x1, y1 + k); c.lineTo(x1, y1); c.lineTo(x1 + k, y1);
        c.moveTo(x2 - k, y1); c.lineTo(x2, y1); c.lineTo(x2, y1 + k);
        c.moveTo(x2, y2 - k); c.lineTo(x2, y2); c.lineTo(x2 - k, y2);
        c.moveTo(x1 + k, y2); c.lineTo(x1, y2); c.lineTo(x1, y2 - k);
      }, e.hlColor, 2.5, 1, { alpha: hlS, cap: "square" });
    }
    ctx.restore();
  }

  // ---------------- Text-Overlay (Engine-Stil, aber mit Verkleinerung/Umbruch für lange Texte) ----------------
  function drawOverlay(ctx, L, text, t, d) {
    if (!text || !String(text).trim()) return;
    const a = L.env(t, 0.5, d - 0.3, 0.45);
    if (a <= 0) return;
    const O = overlayLayout(ctx, String(text));
    const x = OV_X, top = OV_TOP;
    const slide = eo(seg(t, 0.5, 0.5));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // wie die Engine: unabhängig von der Kamerafahrt
    ctx.globalAlpha = a;
    ctx.fillStyle = COL.amber; ctx.fillRect(x, top, 8, O.h);
    L.panel(ctx, x + 14, top, O.w * slide, O.h, { fill: "rgba(4,12,26,0.82)", stroke: "rgba(255,179,71,0.35)", r: 4, alpha: a });
    O.lines.forEach((ln, k) => txt(ctx, ln, x + 44, top + 17 + 0.97 * O.size + k * O.lhh, { font: F_HEAD, weight: 700, size: O.size, ls: 2, color: COL.white, alpha: a * seg(t, 0.75, 0.35) }));
    ctx.restore();
  }

  // ---------------- Szene ----------------
  function drawScene(ctx, p) {
    const L = p.L || (window.CE && window.CE.lib);
    if (!L) return;
    const W = p.W || W0;
    const t = Math.max(0, +p.t || 0);
    const d = Math.max(0.5, +p.d || 8);
    const sc = p.scene || {};
    const foc = p.params && Array.isArray(p.params.focus) ? p.params.focus : null;
    const env = {
      cam: sc.camera || "static", d, text: p.text ? String(p.text) : "",
      fx: (foc && isFinite(+foc[0]) ? +foc[0] : 0.5) * W0, fy: (foc && isFinite(+foc[1]) ? +foc[1] : 0.5) * H0,
    };
    const M = getModel(ctx, p.params, env);
    const T = M.T, tn = T.tn;
    const headX = headPos(t, T);
    const hlE = M.hl >= 0 ? seg(t, T.hl, T.hlDur) : 0;
    const hlS = eo(hlE), hlB = eob(hlE);
    const P = pulseState(M, T, t);

    drawAtmosphere(ctx, t, W, M.AY);

    // Ambientes Leuchten hinter der hervorgehobenen Karte
    if (M.hl >= 0 && hlS > 0 && t >= tn[M.hl]) {
      const e = M.ev[M.hl];
      const G = cardGeom(M, e, true, hlB);
      // Halo um die Karte: gestaffelte, transparente Vollflächen (günstig, kein Verlauf)
      const hw = (M.cardW * G.s) / 2, hh = (e.h * G.s) / 2;
      const br = 0.85 + 0.15 * Math.sin(t * 2);
      ctx.save();
      ctx.fillStyle = rgba(e.hlColor, 0.024 * hlS * br);
      for (const g of [88, 64, 42, 24, 10]) { ctx.beginPath(); L.roundRectPath(ctx, G.cx - hw - g, G.cy - hh - g, 2 * (hw + g), 2 * (hh + g), 10 + g); ctx.fill(); }
      ctx.restore();
    }

    drawTitle(ctx, L, M, T, t);

    // Stiele liegen unter Achse und Knoten
    const st = M.ev.map((e, i) => {
      const isHL = i === M.hl;
      const pp = seg(t, tn[i], T.pop);
      const col = isHL ? hotMix(e.color, e.hlColor, hlS) : e.color;
      // gedimmt werden nur Karten, die VOR dem Highlight da waren – spätere Ereignisse bleiben hell
      const dim = M.hl >= 0 && !isHL && M.dimOthers && tn[i] <= T.hl + 0.05 ? 1 - 0.42 * hlS : 1;
      const flash = P ? P.a * Math.max(0, 1 - Math.abs(P.x - e.x) / 70) : 0;
      return { e, i, isHL, pp, col, dim, flash, on: t >= tn[i] };
    });
    for (const s of st) if (s.on) drawStem(ctx, L, M, s.e, s.pp, s.col, s.dim, t);

    drawAxis(ctx, L, M, T, t, headX);
    drawPulse(ctx, L, M, P);
    for (const s of st) if (s.on) drawNode(ctx, L, M, s.e, s.pp, s.col, s.dim, s.flash, s.isHL, hlS, T, t);
    drawHead(ctx, L, M, T, t, headX);

    // Karten: Highlight zuletzt (liegt oben)
    for (const s of st) if (s.on && !s.isHL) drawCard(ctx, L, M, s.e, s.pp, t, s.col, s.dim, false, 0, 0);
    for (const s of st) if (s.on && s.isHL) drawCard(ctx, L, M, s.e, s.pp, t, s.col, s.dim, true, hlS, hlB);

    drawOverlay(ctx, L, p.text, t, d);
  }

  CEX.register("timeline", {
    ownsText: true,
    draw(ctx, p) {
      try { drawScene(ctx, p); }
      catch (err) { try { console.error("[timeline]", err && err.message); } catch (e) { /* nie werfen */ } }
    },
  });
})();
