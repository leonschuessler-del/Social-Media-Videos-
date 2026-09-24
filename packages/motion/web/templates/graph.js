/* Template „graph“ – animiertes Liniendiagramm im Stil „Visual Science“ (Blueprint-Instrument).
   Achsen fahren ein, Raster/Ticks (deutsches Zahlenformat) blenden gestaffelt auf, die Kurven zeichnen sich mit
   leuchtendem Kopf (optional Live-Messwert). Annotationen schießen als gestrichelte Markierung mit Ring-Puls und
   Label auf. Danach laufen Lichtimpulse über die fertige Kurve (kein Standbild).

   BEATS (params.beats, Sekunden ab Szenenstart; alle Zeiten werden auf [0,3 s ; d − 0,3 s] geklemmt):
     [0] = Kurve(n) beginnen sich zu zeichnen        (Standard: 10 % von d, 0,4–1,4 s)
     [1] = Kurve(n) vollständig gezeichnet            (Standard: 70 % von d)
   Einträge mit eigenem "at" (Sekunden ab Szenenstart):
     series[i].at (+ end | dur)   eigener Zeichenbeginn/-ende dieser Kurve; ihr Legendeneintrag erscheint mit ihr
     annotations[i].at            Markierung + Label erscheinen (Standard: wenn der Kurvenkopf x passiert)
     annotations[i].sub_at        zweite Zeile (z. B. Zahl) erscheint erst dann, die Box wächst nach
     ref_lines[i].at              Grenzlinie + Label fahren ein (Standard: Intro)
     zones[i].at                  x-Bereich wird aufgezogen (Standard: folgt dem Kurvenkopf)
     y_bands[i].at                y-Band wird aufgezogen (Standard: Intro)
     footnote.at | footnote_at    Fußnote (Standard: mit Zeichenbeginn)
     inset.at (+ value_at)        Maßstabs-Inset (Standard: 45 % von d); value_at = Maßzahl erscheint
   Ohne beats/at skaliert alles mit d. Einmal Erschienenes bleibt bis Szenenende sichtbar (Puls, Lichtimpulse).
   CARRY_IN (params.carry_in, Fortsetzung derselben Grafik aus der Vorszene): Panel, Achsen, Ticks, Titel, Legende und
     jede Serie/Grenzlinie/y-Band/Zone/Annotation/Fußnote/Inset OHNE eigenes at (oder mit at <= 0,3 s) stehen ab t = 0
     fertig da – kein Einzeichnen, kein Aufziehen, kein Blitz, kein Pop-Ring; Blinken läuft weiter. Nur Elemente mit
     at > 0,3 s sowie sub_at/value_at animieren. Annotationen ohne at gelten nur als übernommen, wenn ihre Serie es ist.
     carry_in: true | <Dauer der Vorszene in s> (dann laufen Staub, Strichfluss und Pulse phasengleich weiter).
     Negatives at (bzw. series.end) = so viele Sekunden VOR Szenenbeginn erschienen/fertig gezeichnet (Phase von
     Blinken, Ringen, Lichtstreifen wie in der Vorszene: at_neu = at_alt − Dauer_Vorszene).

   params (alle optional – ohne gültige Serie wird das Standardbeispiel „Seilriss → Fangvorrichtung“ gezeigt):
     title                  Diagrammtitel (Aliase: titel, heading)
     x_label / y_label      Achsenbeschriftungen (Aliase: xLabel, x_achse, …)
     y_unit / x_unit        Einheiten (x_unit wird sonst aus „… in s“, „(s)“, „[s]“ im x_label gelesen)
     series                 [{ name, points: [[x,y],…] | [{x,y},…] | [y0,y1,…], color?, at?, end?, dur? }]
     annotations            [{ x, y?, label, color?, sub?, at?, sub_at?, blink?, series?, place? }] – sub = zweite Zeile
                            (Standard: x-Wert mit Einheit, "" = keine); blink: true = Marke blinkt deutlich;
                            place: "near" = Label-Box so nah wie möglich am Punkt (knapp darüber, sonst weiter oben,
                            dann darunter) statt oben im Plot gestapelt.
     x_min/x_max/y_min/y_max  Achsenbereich (sonst automatisch; y mit „schönem“ Rundungswert)
     ref_lines              horizontale Grenzlinien [{ y, label, color, at? }]
     zones                  x-Bereiche [{ from|x0, to|x1, label, color, at? }]
     y_bands                y-Bänder (gefüllt, hinter der Kurve) [{ y0|from, y1|to, label?, color?, at?, edges? }]
     x_ticks / y_ticks      false = keine Zahlen + Striche (schematische Achse) | [Werte] = eigene Ticks;
                            x_tick_labels / y_tick_labels: false = nur Zahlen aus; hide_x_ticks: true
     x_reverse              true = x-Achse läuft von rechts (x_min) nach links (x_max)
     draw_direction         "ltr" (Std., links → rechts am Bildschirm) | "rtl" | "desc" (hohe x zuerst) | "asc"
     footnote               Fußnote unten links: "Text" oder { text, at, color } (Aliase: caption, fussnote)
     inset                  Maßstabs-Inset: { value, unit="m", label, sub, title, storeys=2, storey_h=3, person=true,
                            color="red", corner="auto"|"top-left"|…, at, value_at, h } – gestrichelte Säule
                            der Höhe value neben Geschossen + Maßlinie
     fill                   Flächenverlauf unter der ersten Kurve (Standard: an bei ≤ 2 Serien)
     readout                Live-Messwert am Kurvenkopf (Standard: true)
     beats                  siehe oben
   Text: p.text wird selbst oben links im Engine-Stil gezeichnet (ownsText: true) – gleiche Optik und Zeitsteuerung,
         aber lange Texte werden verkleinert bzw. zweizeilig umbrochen statt aus dem Bild zu laufen. */
(function () {
  "use strict";
  const CEX = window.CE;
  if (!CEX || typeof CEX.register !== "function") return;

  // ---------------- Konstanten ----------------
  const COL = { cyan: "#3fd2ff", amber: "#ffb347", red: "#ff5a5f", green: "#5be49b", white: "#eef6ff", muted: "#8fb3d9", steel: "#9fc4e6", violet: "#b89cff", ice: "#e6f8ff", navy: "#06122a" };
  const NAMED = {
    cyan: COL.cyan, blue: COL.cyan, blau: COL.cyan, "türkis": COL.cyan, tuerkis: COL.cyan, info: COL.cyan,
    amber: COL.amber, orange: COL.amber, gold: COL.amber, warn: COL.amber, warning: COL.amber, warnung: COL.amber,
    yellow: "#ffd166", gelb: "#ffd166",
    red: COL.red, rot: COL.red, danger: COL.red, gefahr: COL.red, fail: COL.red, failure: COL.red, error: COL.red,
    green: COL.green, "grün": COL.green, gruen: COL.green, ok: COL.green, safe: COL.green, sicher: COL.green, success: COL.green,
    white: COL.white, "weiß": COL.white, weiss: COL.white,
    steel: COL.steel, stahl: COL.steel, grey: COL.muted, gray: COL.muted, grau: COL.muted, muted: COL.muted, neutral: COL.steel,
    violet: COL.violet, purple: COL.violet, lila: COL.violet,
  };
  const SERIES_COLS = [COL.cyan, COL.amber, COL.green, COL.violet, COL.steel, COL.red];
  const F_HEAD = "Oxanium", F_BODY = "Inter", F_MONO = "JetBrains Mono";

  // Layout (px) – Panel unterhalb des Engine-Textfelds (y < 190), Unterkante über der Untertitelzone (y > 910).
  const PANEL = { x: 90, y: 206, w: 1740, h: 698 };
  const IN_L = 132;          // linke Innenkante (Titel, y-Label)
  const PR = 1778;           // rechte Plotkante
  const PT = 352, PB = 786;  // Plot oben / unten
  const TITLE_Y = 268, YLAB_Y = 334, XTICK_Y = 826, XLAB_Y = 870;
  const MAX_SERIES = 6, MAX_ANN = 8, MAX_REF = 4, MAX_ZONE = 5, MAX_YBAND = 4;

  // ---------------- Helfer ----------------
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, d) => clamp((t - a) / Math.max(1e-6, d), 0, 1);
  const sm = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const eo = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const eob = (x) => { x = clamp(x, 0, 1); const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const h01 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const isObj = (o) => o !== null && typeof o === "object" && !Array.isArray(o);
  const pick = (o, keys) => {
    if (!isObj(o)) return undefined;
    for (const k of keys) { const v = o[k]; if (v !== undefined && v !== null && v !== "") return v; }
    return undefined;
  };
  const num = (v, d) => {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return d;
    if (typeof v === "number") return Number.isFinite(v) ? v : d;
    const s = String(v).trim().replace(/\s/g, "").replace("−", "-");
    // "1.234,5" -> 1234.5 ; "1,84" -> 1.84 ; "1.84" -> 1.84
    const n = /,/.test(s) ? parseFloat(s.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")) : parseFloat(s);
    return Number.isFinite(n) ? n : d;
  };
  const str = (v, d) => (v === undefined || v === null ? d : (typeof v === "string" ? v : (typeof v === "number" ? String(v) : d)));
  const RGBC = {};
  const rgbOf = (hex) => {
    if (RGBC[hex]) return RGBC[hex];
    const h = String(hex).replace("#", "");
    const v = [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
    RGBC[hex] = v; return v;
  };
  const rgba = (hex, a) => { const c = rgbOf(hex); return `rgba(${c[0]},${c[1]},${c[2]},${clamp(a, 0, 1).toFixed(3)})`; };
  const mix = (h1, h2, t) => { const a = rgbOf(h1), b = rgbOf(h2); t = clamp(t, 0, 1); return "#" + [0, 1, 2].map((i) => Math.round(lerp(a[i], b[i], t)).toString(16).padStart(2, "0")).join(""); };
  function colorOf(c, fb) {
    if (typeof c !== "string") return fb;
    const s = c.trim().toLowerCase();
    if (NAMED[s]) return NAMED[s];
    if (/^#[0-9a-f]{6}$/.test(s)) return s;
    if (/^#[0-9a-f]{8}$/.test(s)) return s.slice(0, 7);
    if (/^#[0-9a-f]{3}$/.test(s)) return "#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
    const m = s.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
    if (m) return "#" + [m[1], m[2], m[3]].map((x) => clamp(parseInt(x, 10), 0, 255).toString(16).padStart(2, "0")).join("");
    return fb;
  }
  /** Deutsches Zahlenformat: Dezimalkomma, Minuszeichen U+2212, Tausenderpunkt ab 5 Stellen (Jahreszahlen bleiben 2025). */
  function fmt(v, dec) {
    if (!Number.isFinite(v)) return "–";
    dec = clamp(Math.round(dec || 0), 0, 4);
    let s = Math.abs(v).toFixed(dec);
    const neg = v < 0 && Number(s) !== 0;
    let [ip, fp] = s.split(".");
    if (ip.length > 4) ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (neg ? "−" : "") + ip + (fp ? "," + fp : "");
  }
  function niceStep(span, target) {
    const raw = Math.abs(span) / Math.max(1, target);
    if (!(raw > 0) || !Number.isFinite(raw)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    const k = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
    return k * p;
  }
  function decFor(step) {
    for (let d = 0; d < 4; d++) { const s = step * Math.pow(10, d); if (Math.abs(s - Math.round(s)) < 1e-6 * Math.max(1, s)) return d; }
    return 4;
  }
  function ticksFor(min, max, step) {
    const out = []; if (!(step > 0)) return out;
    const i0 = Math.ceil(min / step - 1e-7), i1 = Math.floor(max / step + 1e-7);
    for (let i = i0; i <= i1 && out.length < 40; i++) out.push(Number((i * step).toFixed(10)));
    return out;
  }
  function unitFrom(label) {
    if (!label) return "";
    let m = label.match(/\[([^\]]{1,12})\]\s*$/); if (m) return m[1].trim();
    m = label.match(/\(([^)]{1,12})\)\s*$/); if (m) return m[1].trim();
    m = label.match(/\bin\s+(\S{1,12})\s*$/); if (m) return m[1].trim();
    return "";
  }
  const upperTitle = (s) => {
    // Einheiten/Formelzeichen würden durch Versalien verfälscht („m/s“ -> „M/S“) – dann Schreibweise belassen.
    if (/[\/()\[\]²³=]|\d\s*[a-zµ]/.test(s)) return s;
    try { return s.toLocaleUpperCase("de-DE"); } catch (e) { return s.toUpperCase(); }
  };

  function setFont(ctx, weight, size, family, ls) {
    ctx.font = `${weight} ${size}px "${family}"`;
    try { ctx.letterSpacing = `${ls || 0}px`; } catch (e) { /* ältere Canvas */ }
  }
  // Mini-Markup für Formelzeichen: „v_N“, „v_{max}“ -> Index, „m/s^2“ -> Exponent.
  const RICH_RE = /(_\{[^}]*\}|_[A-Za-z0-9äöüÄÖÜ]+|\^\{[^}]*\}|\^[0-9+\-−]+)/;
  const RUN_CACHE = new Map();
  function runsOf(s) {
    let r = RUN_CACHE.get(s);
    if (r) return r;
    r = [];
    if (!RICH_RE.test(s)) r.push({ t: s, k: 0 });
    else {
      for (const part of s.split(RICH_RE)) {
        if (!part) continue;
        if (part[0] === "_" && part.length > 1) r.push({ t: part[1] === "{" ? part.slice(2, -1) : part.slice(1), k: 1 });
        else if (part[0] === "^" && part.length > 1) r.push({ t: part[1] === "{" ? part.slice(2, -1) : part.slice(1), k: -1 });
        else r.push({ t: part, k: 0 });
      }
    }
    if (RUN_CACHE.size > 2000) RUN_CACHE.clear();
    RUN_CACHE.set(s, r); return r;
  }
  const MCACHE = new Map();
  function measureRaw(ctx, s, weight, size, family, ls) {
    const key = `${weight}|${size}|${family}|${ls || 0}|${s}`;
    let w = MCACHE.get(key);
    if (w === undefined) {
      ctx.save(); setFont(ctx, weight, size, family, ls); w = ctx.measureText(s).width; ctx.restore();
      if (MCACHE.size > 3000) MCACHE.clear();
      MCACHE.set(key, w);
    }
    return w;
  }
  function measure(ctx, s, weight, size, family, ls) {
    const runs = runsOf(String(s));
    let w = 0;
    for (const r of runs) w += measureRaw(ctx, r.t, weight, r.k ? Math.round(size * 0.68) : size, family, r.k ? 0 : ls);
    return w;
  }
  function txt(ctx, s, x, y, o) {
    const a = o.alpha === undefined ? 1 : o.alpha;
    if (a <= 0.004 || !s) return;
    s = String(s);
    const runs = runsOf(s);
    const size = o.size || 26, weight = o.weight || 600, fam = o.font || F_BODY;
    ctx.save();
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.textBaseline = "alphabetic";
    if (o.glow) { ctx.shadowColor = o.glowColor || o.color || COL.cyan; ctx.shadowBlur = o.glow; }
    ctx.fillStyle = o.color || COL.white;
    if (runs.length === 1 && !runs[0].k) {
      setFont(ctx, weight, size, fam, o.ls || 0);
      ctx.textAlign = o.align || "left";
      if (o.stroke) { ctx.save(); ctx.shadowBlur = 0; ctx.lineJoin = "round"; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor || "rgba(3,9,20,0.9)"; ctx.strokeText(s, x, y); ctx.restore(); }
      ctx.fillText(s, x, y);
    } else {
      const total = measure(ctx, s, weight, size, fam, o.ls || 0);
      let cx = o.align === "center" ? x - total / 2 : o.align === "right" ? x - total : x;
      ctx.textAlign = "left";
      for (const r of runs) {
        const sz = r.k ? Math.round(size * 0.68) : size;
        setFont(ctx, weight, sz, fam, r.k ? 0 : o.ls || 0);
        const yy = y + (r.k === 1 ? size * 0.2 : r.k === -1 ? -size * 0.38 : 0);
        if (o.stroke) { ctx.save(); ctx.shadowBlur = 0; ctx.lineJoin = "round"; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor || "rgba(3,9,20,0.9)"; ctx.strokeText(r.t, cx, yy); ctx.restore(); }
        ctx.fillText(r.t, cx, yy);
        cx += measureRaw(ctx, r.t, weight, sz, fam, r.k ? 0 : o.ls || 0);
      }
    }
    ctx.restore();
  }
  /** Wortumbruch auf maxLines Zeilen (letzte Zeile mit „…“ gekürzt). */
  function wrapLines(ctx, s, maxW, weight, size, family, ls, maxLines) {
    const words = String(s).split(/\s+/).filter(Boolean);
    const lines = []; let cur = "";
    for (let i = 0; i < words.length; i++) {
      const test = cur ? cur + " " + words[i] : words[i];
      if (measure(ctx, test, weight, size, family, ls) <= maxW || !cur) cur = test;
      else { lines.push(cur); cur = words[i]; if (lines.length >= maxLines) { cur = words.slice(i).join(" "); break; } }
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1] + " " + "…"; }
    const last = lines.length - 1;
    if (last >= 0 && measure(ctx, lines[last], weight, size, family, ls) > maxW) {
      let t = lines[last].replace(/\s*…$/, "");
      while (t.length > 1 && measure(ctx, t + "…", weight, size, family, ls) > maxW) t = t.slice(0, -1);
      lines[last] = t.replace(/\s+$/, "") + "…";
    }
    return lines;
  }
  const ellipsize = (ctx, s, maxW, weight, size, family, ls) => wrapLines(ctx, s, maxW, weight, size, family, ls, 1)[0] || "";

  function rrect(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  /** Günstiger Glow: breite, transparente Unterlagen + scharfe Linie (kein shadowBlur). */
  function glowStroke(ctx, build, color, width, glow, alpha, dash, dashOff) {
    if (alpha <= 0.004) return;
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = color;
    if (dash) { ctx.setLineDash(dash); ctx.lineDashOffset = dashOff || 0; }
    if (glow > 0) {
      ctx.globalAlpha = alpha * 0.09 * glow; ctx.lineWidth = width * 6.5; ctx.beginPath(); build(ctx); ctx.stroke();
      ctx.globalAlpha = alpha * 0.2 * glow; ctx.lineWidth = width * 2.8; ctx.beginPath(); build(ctx); ctx.stroke();
    }
    ctx.globalAlpha = alpha; ctx.lineWidth = width; ctx.beginPath(); build(ctx); ctx.stroke();
    ctx.restore();
  }
  function line(ctx, x1, y1, x2, y2, color, width, glow, alpha, dash, dashOff) {
    glowStroke(ctx, (c) => { c.moveTo(x1, y1); c.lineTo(x2, y2); }, color, width, glow, alpha, dash, dashOff);
  }
  function dot(ctx, x, y, r, color, alpha) {
    if (alpha <= 0.004 || r <= 0) return;
    ctx.save(); ctx.globalAlpha = clamp(alpha, 0, 1);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, 0.95)); g.addColorStop(0.28, rgba(color, 0.45)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function disc(ctx, x, y, r, color, alpha) {
    if (alpha <= 0.004) return;
    ctx.save(); ctx.globalAlpha = clamp(alpha, 0, 1); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function interpY(pts, x) {
    const n = pts.length; if (!n) return NaN;
    if (x <= pts[0][0]) return pts[0][1];
    if (x >= pts[n - 1][0]) return pts[n - 1][1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m][0] <= x) lo = m; else hi = m; }
    const a = pts[lo], b = pts[hi]; const dx = b[0] - a[0];
    return dx > 0 ? lerp(a[1], b[1], (x - a[0]) / dx) : b[1];
  }
  function segHitsRect(x1, y1, x2, y2, r) {
    if (Math.max(x1, x2) < r.x || Math.min(x1, x2) > r.x + r.w) return false;
    let ya = y1, yb = y2;
    if (x2 !== x1) {
      const ta = clamp((r.x - x1) / (x2 - x1), 0, 1), tb = clamp((r.x + r.w - x1) / (x2 - x1), 0, 1);
      ya = y1 + (y2 - y1) * ta; yb = y1 + (y2 - y1) * tb;
    }
    return Math.max(ya, yb) >= r.y && Math.min(ya, yb) <= r.y + r.h;
  }
  const rectsHit = (a, b, m) => a.x - m < b.x + b.w && a.x + a.w + m > b.x && a.y - m < b.y + b.h && a.y + a.h + m > b.y;

  // ---------------- Standardbeispiel: Kabinengeschwindigkeit nach Seilriss ----------------
  // Kabine steht, Tragseile reißen -> freier Fall (a ≈ g). Begrenzer löst bei 1,15 · v_N aus, nach kurzem
  // Einrückweg greift die Bremsfangvorrichtung und verzögert mit ≈ 0,6 g (zulässig: 0,2 … 1,0 g) bis zum Stillstand.
  function defaultModel() {
    const g = 9.81, vN = 1.6, vTrip = 1.15 * vN, tTrip = vTrip / g, tGrip = 0.23, aBrake = 0.6 * g, blend = 0.022, dt = 0.0005;
    const pts = [[0, 0]];
    let v = 0, tStop = null, sBrake = 0, vMax = 0, tt = 0;
    for (let i = 1; tt < 0.7 - 1e-9; i++) {
      tt = i * dt;
      const k = sm((tt - (tGrip - blend * 0.3)) / blend);
      const a = lerp(g, -aBrake, k);
      const vPrev = v;
      v = v + a * dt;
      if (tt > tGrip && v <= 0) { v = 0; if (tStop === null) { tStop = tt; pts.push([tt, 0]); } }
      if (tt > tGrip - blend * 0.3 && tStop === null) sBrake += 0.5 * (v + vPrev) * dt;
      vMax = Math.max(vMax, v);
      if (i % 10 === 0 && !(tStop !== null && Math.abs(tt - tStop) < 1e-9)) pts.push([Number(tt.toFixed(4)), v]);
    }
    if (tStop === null) tStop = 0.61;
    return {
      title: "Geschwindigkeit der Kabine nach dem Seilriss",
      xLabel: "Zeit t in s", yLabel: "Geschwindigkeit v in m/s", yUnit: "m/s", xUnit: "s",
      series: [{ name: "Kabinengeschwindigkeit", color: COL.cyan, pts }],
      anns: [
        { x: 0, y: 0, label: "Seile reißen", color: COL.red, sub: "freier Fall, a ≈ g" },
        { x: tTrip, y: vTrip, label: "Begrenzer löst aus", color: COL.amber, sub: "bei 1,15 · v_N" },
        { x: tGrip, y: null, label: "Fangvorrichtung greift", color: COL.amber, sub: `v_max ≈ ${fmt(vMax, 1)} m/s` },
        { x: tStop, y: 0, label: "Stillstand", color: COL.green, sub: `Bremsweg ≈ ${fmt(sBrake, 2)} m` },
      ],
      refs: [
        { y: vN, label: `Nenngeschwindigkeit v_N = ${fmt(vN, 1)} m/s`, color: COL.steel },
        { y: vTrip, label: `Auslösegrenze 1,15 · v_N = ${fmt(vTrip, 2)} m/s`, color: COL.amber },
      ],
      zones: [
        { x0: 0, x1: tGrip, label: "FREIER FALL", color: COL.red },
        { x0: tGrip, x1: tStop, label: "FANGBREMSUNG ≈ 0,6 g", color: COL.amber },
      ],
      xMin: 0, xMax: 0.7, yMin: 0, yMax: 3, fill: true, readout: true, isDefault: true,
    };
  }

  // ---------------- Parameter normalisieren ----------------
  function normPoints(raw) {
    let arr = raw;
    if (isObj(raw)) {
      const xs = pick(raw, ["x", "xs", "t"]), ys = pick(raw, ["y", "ys", "v", "values"]);
      if (Array.isArray(xs) && Array.isArray(ys)) arr = xs.map((x, i) => [x, ys[i]]);
      else arr = Object.keys(raw).map((k) => [k, raw[k]]);
    }
    if (!Array.isArray(arr)) return [];
    const out = [];
    arr.forEach((pt, i) => {
      let x, y;
      if (Array.isArray(pt)) { x = num(pt[0], NaN); y = num(pt[1], NaN); }
      else if (isObj(pt)) { x = num(pick(pt, ["x", "t", "time", "zeit", "s"]), NaN); y = num(pick(pt, ["y", "v", "value", "wert", "val"]), NaN); }
      else { x = i; y = num(pt, NaN); }
      if (Number.isFinite(x) && Number.isFinite(y)) out.push([x, y, i]);
    });
    out.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
    return out.slice(0, 4000).map((q) => [q[0], q[1]]);
  }
  function normSeries(params) {
    let raw = pick(params, ["series", "data", "lines", "kurven", "reihen", "datasets"]);
    if (raw === undefined) { const pts = pick(params, ["points", "punkte", "values", "werte"]); if (pts !== undefined) raw = [{ points: pts, name: pick(params, ["name", "series_name"]) }]; }
    if (isObj(raw)) raw = pick(raw, ["points", "data", "values", "werte", "punkte"]) !== undefined ? [raw] : Object.keys(raw).map((k) => ({ name: k, points: raw[k] }));
    if (!Array.isArray(raw)) return [];
    // Einzelne Punktliste direkt als series: [[x,y],…]
    if (raw.length && (Array.isArray(raw[0]) || typeof raw[0] === "number")) raw = [{ points: raw }];
    const out = [];
    for (const s of raw) {
      if (out.length >= MAX_SERIES) break;
      const pts = normPoints(isObj(s) ? pick(s, ["points", "data", "values", "werte", "punkte", "pts"]) : s);
      if (pts.length < 2) continue;
      const idx = out.length;
      const so = isObj(s) ? s : {};
      out.push({
        name: str(pick(so, ["name", "label", "title", "titel", "bezeichnung"]), ""), color: colorOf(pick(so, ["color", "colour", "farbe", "tone"]), SERIES_COLS[idx % SERIES_COLS.length]), pts,
        at: num(pick(so, ["at", "draw_at", "start_at"]), NaN), end: num(pick(so, ["end", "until", "end_at", "draw_end"]), NaN), dur: num(pick(so, ["dur", "duration", "dauer", "draw_dur"]), NaN),
      });
    }
    return out;
  }
  const truthy = (v) => v === true || v === 1 || (typeof v === "string" && /^(true|ja|yes|1|on|an)$/i.test(v.trim()));
  const falsy = (v) => v === false || v === 0 || (typeof v === "string" && /^(false|nein|no|0|off|aus|none|keine?|hidden)$/i.test(v.trim()));
  const timeOf = (o, keys) => (isObj(o) ? num(pick(o, keys), NaN) : NaN);

  function normAnns(params, xUnit, xDecHint) {
    let raw = pick(params, ["annotations", "markers", "marker", "events", "ereignisse", "annotationen", "markierungen"]);
    if (isObj(raw)) raw = [raw];
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const a of raw) {
      if (out.length >= MAX_ANN) break;
      let x, y = null, label = "", color = COL.amber, sub, ser, at = NaN, subAt = NaN, blink = false, near = false;
      if (Array.isArray(a)) { x = num(a[0], NaN); label = str(a[1], ""); if (a.length > 2) y = num(a[2], null); }
      else if (isObj(a)) {
        x = num(pick(a, ["x", "t", "time", "zeit", "bei", "pos", "x_value"]), NaN);
        at = timeOf(a, ["at", "show_at", "appear_at"]);
        if (!Number.isFinite(x) && Number.isFinite(at)) { x = at; at = NaN; } // Altform: "at" als x-Position
        y = num(pick(a, ["y", "value_y", "wert_y"]), null);
        label = str(pick(a, ["label", "text", "title", "titel", "name"]), "");
        ser = pick(a, ["series", "serie", "on", "kurve", "series_index"]);
        color = colorOf(pick(a, ["color", "colour", "tone", "farbe"]), COL.amber);
        const sv = a.sub !== undefined ? a.sub : pick(a, ["detail", "subtitle", "note", "info", "value", "wert"]);
        if (sv === false || sv === "" || sv === null) sub = "";
        else if (sv !== undefined) sub = typeof sv === "number" ? fmt(sv, decFor(sv)) : str(sv, undefined);
        subAt = timeOf(a, ["sub_at", "value_at", "detail_at"]);
        blink = truthy(pick(a, ["blink", "blinks", "blinken", "pulse", "emphasis", "highlight"]));
        const pl = str(pick(a, ["place", "placement", "label_place", "label_pos", "platzierung"]), "").trim().toLowerCase();
        near = /^(near|nah|nahe|close|point|punkt|am_punkt|at_point|local)/.test(pl);
      } else continue;
      if (!Number.isFinite(x)) continue;
      if (sub === undefined) sub = `${fmt(x, Math.min(3, Math.max(decFor(x), xDecHint)))}${xUnit ? " " + xUnit : ""}`;
      out.push({ x, y: Number.isFinite(y) ? y : null, label: label.trim(), color, sub: String(sub).trim(), ser, at, subAt, blink, near });
    }
    out.sort((p, q) => p.x - q.x);
    return out;
  }
  function normRefs(params, yUnit) {
    let raw = pick(params, ["ref_lines", "refLines", "reference_lines", "references", "thresholds", "hlines", "grenzwerte", "referenzlinien"]);
    if (isObj(raw)) raw = [raw];
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const r of raw) {
      if (out.length >= MAX_REF) break;
      let y, label = "", color = COL.steel, at = NaN;
      if (typeof r === "number" || typeof r === "string") y = num(r, NaN);
      else if (Array.isArray(r)) { y = num(r[0], NaN); label = str(r[1], ""); }
      else if (isObj(r)) {
        y = num(pick(r, ["y", "value", "wert", "level", "y_value"]), NaN);
        at = timeOf(r, ["at", "show_at"]);
        if (!Number.isFinite(y) && Number.isFinite(at)) { y = at; at = NaN; } // Altform: "at" als y-Wert
        label = str(pick(r, ["label", "text", "name", "title"]), "");
        color = colorOf(pick(r, ["color", "colour", "tone", "farbe"]), COL.steel);
      }
      if (!Number.isFinite(y)) continue;
      if (!label) label = `${fmt(y, decFor(y))}${yUnit ? " " + yUnit : ""}`;
      out.push({ y, label, color, at });
    }
    return out;
  }
  function normZones(params) {
    let raw = pick(params, ["zones", "bands", "phases", "bereiche", "phasen", "ranges", "x_bands"]);
    if (isObj(raw)) raw = [raw];
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const z of raw) {
      if (out.length >= MAX_ZONE) break;
      let x0, x1, label = "", color = COL.cyan, at = NaN;
      if (Array.isArray(z)) { x0 = num(z[0], NaN); x1 = num(z[1], NaN); label = str(z[2], ""); }
      else if (isObj(z)) {
        x0 = num(pick(z, ["x0", "from", "start", "von", "x_start", "xmin", "x_min"]), NaN);
        x1 = num(pick(z, ["x1", "to", "end", "bis", "x_end", "xmax", "x_max"]), NaN);
        label = str(pick(z, ["label", "text", "name", "title"]), "");
        color = colorOf(pick(z, ["color", "colour", "tone", "farbe"]), COL.cyan);
        at = timeOf(z, ["at", "show_at"]);
      }
      if (!Number.isFinite(x0) || !Number.isFinite(x1) || x0 === x1) continue;
      out.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), label, color, at });
    }
    return out;
  }
  function normYBands(params) {
    let raw = pick(params, ["y_bands", "yBands", "ybands", "y_band", "hbands", "h_bands", "y_ranges", "y_zones", "y_bereiche", "horizontal_bands", "bands_y"]);
    if (isObj(raw)) raw = [raw];
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const b of raw) {
      if (out.length >= MAX_YBAND) break;
      let y0, y1, label = "", color = COL.cyan, at = NaN, edges = true;
      if (Array.isArray(b)) { y0 = num(b[0], NaN); y1 = num(b[1], NaN); label = str(b[2], ""); }
      else if (isObj(b)) {
        y0 = num(pick(b, ["y0", "from", "von", "min", "y_min", "ymin", "lo", "low", "unten"]), NaN);
        y1 = num(pick(b, ["y1", "to", "bis", "max", "y_max", "ymax", "hi", "high", "oben"]), NaN);
        label = str(pick(b, ["label", "text", "name", "title"]), "");
        color = colorOf(pick(b, ["color", "colour", "tone", "farbe"]), COL.cyan);
        at = timeOf(b, ["at", "show_at"]);
        const e = pick(b, ["edges", "lines", "kanten", "border"]); if (e !== undefined) edges = !falsy(e);
      } else continue;
      if (!Number.isFinite(y0) || !Number.isFinite(y1) || y0 === y1) continue;
      out.push({ y0: Math.min(y0, y1), y1: Math.max(y0, y1), label: label.trim(), color, at, edges });
    }
    return out;
  }
  function normFootnote(params) {
    const raw = pick(params, ["footnote", "fussnote", "fußnote", "caption", "anmerkung", "note", "hinweis", "source", "quelle"]);
    let text = "", at = timeOf(params, ["footnote_at", "caption_at", "note_at"]), color = mix(COL.muted, "#ffffff", 0.12);
    if (typeof raw === "string" || typeof raw === "number") text = String(raw);
    else if (Array.isArray(raw)) text = raw.filter((q) => typeof q === "string").join(" · ");
    else if (isObj(raw)) {
      text = str(pick(raw, ["text", "label", "value"]), "");
      const a2 = timeOf(raw, ["at", "show_at"]); if (Number.isFinite(a2)) at = a2;
      color = colorOf(pick(raw, ["color", "colour", "farbe"]), color);
    }
    text = text.replace(/\s+/g, " ").trim();
    return text ? { text, at, color } : null;
  }
  function normInset(params) {
    let raw = pick(params, ["inset", "illustration", "scale_inset", "massstab", "maßstab", "vergleich"]);
    if (raw === true) raw = {};
    if (!isObj(raw)) return null;
    const vis = pick(raw, ["show", "visible", "enabled"]);
    if (vis !== undefined && falsy(vis)) return null;
    const unit = str(pick(raw, ["unit", "einheit"]), "m").trim() || "m";
    const f = unit === "cm" ? 100 : unit === "mm" ? 1000 : 1;
    const value = num(pick(raw, ["value", "height", "hoehe", "höhe", "wert", "hub"]), NaN);
    const storeys = clamp(Math.round(num(pick(raw, ["storeys", "stories", "floors", "stockwerke", "geschosse", "etagen"]), 2)), 0, 6);
    const storeyH = Math.max(1e-6, num(pick(raw, ["storey_h", "storey_height", "floor_height", "geschosshoehe", "geschosshöhe"]), 3 * f));
    const pv = pick(raw, ["person", "silhouette", "mensch"]);
    const personOn = pv === undefined ? true : !falsy(pv);
    const hasVal = Number.isFinite(value) && value > 0;
    if (!hasVal && !storeys) return null;
    const label = str(pick(raw, ["label", "value_label", "text"]), hasVal ? `≈ ${fmt(value, value >= 10 ? 0 : 1)} ${unit}` : "");
    const sub = str(pick(raw, ["sub", "column_label", "bar_label", "beschriftung", "caption"]), "");
    const title = str(pick(raw, ["title", "titel", "heading"]), "");
    const color = colorOf(pick(raw, ["color", "colour", "farbe", "tone"]), COL.red);
    const corner = str(pick(raw, ["corner", "position", "ecke", "place"]), "auto").toLowerCase();
    const pos = Array.isArray(raw.pos) && raw.pos.length >= 2 ? [num(raw.pos[0], NaN), num(raw.pos[1], NaN)] : null;
    return {
      value: hasVal ? value : NaN, unit, storeys, storeyH, person: personOn, personH: 1.75 * f, label, sub, title, color, corner,
      pos: pos && Number.isFinite(pos[0]) && Number.isFinite(pos[1]) ? pos : null,
      h: num(pick(raw, ["h", "box_h", "size"]), NaN),
      at: timeOf(raw, ["at", "show_at"]), valueAt: timeOf(raw, ["value_at", "label_at"]),
    };
  }
  function tickOpt(params, ax) {
    const o = { marks: true, labels: true, values: null };
    const v = pick(params, [`${ax}_ticks`, `${ax}Ticks`, `${ax}_tick_values`]);
    if (v !== undefined) {
      if (Array.isArray(v)) { const vals = v.map((q) => num(q, NaN)).filter(Number.isFinite).sort((a, b) => a - b); if (vals.length) o.values = vals; else { o.marks = false; o.labels = false; } }
      else if (falsy(v)) { o.marks = false; o.labels = false; }
    }
    const lab = pick(params, [`${ax}_tick_labels`, `${ax}TickLabels`, `${ax}_numbers`, `${ax}_zahlen`]);
    if (lab !== undefined && falsy(lab)) o.labels = false;
    const hide = pick(params, [`hide_${ax}_ticks`, `hide_${ax}_tick_labels`, `${ax}_schematic`, `${ax}_schematisch`]);
    if (hide !== undefined && truthy(hide)) { o.marks = false; o.labels = false; }
    return o;
  }
  /** Gemeinsame Zusatzoptionen (auch für das Standardbeispiel). */
  function applyExtras(M, params) {
    const br = pick(params, ["beats", "beat", "takte"]);
    M.beats = Array.isArray(br) ? br.map((b) => num(b, NaN)) : br !== undefined ? [num(br, NaN)] : [];
    M.footnote = normFootnote(params);
    M.inset = normInset(params);
    // carry_in: Fortsetzung einer vorherigen graph-Szene – alles ohne eigenes at (bzw. at <= 0,3 s) steht ab t = 0 fertig da.
    // true | Zahl (= Dauer der Vorszene: Umgebungsbewegung wie Staub, Strichfluss, Pulse läuft nahtlos weiter) | { prev_d }
    {
      const cr = pick(params, ["carry_in", "carryIn", "carry", "carry_over", "continue", "continued", "fortsetzung", "weiter"]);
      let on = false, t0 = 0;
      if (typeof cr === "number") { on = Number.isFinite(cr) && cr > 0; t0 = on ? cr : 0; }
      else if (isObj(cr)) { on = true; t0 = num(pick(cr, ["prev_d", "prev_duration", "t0", "offset", "from", "since"]), 0); }
      else if (cr !== undefined) on = truthy(cr);
      const t0b = num(pick(params, ["carry_t0", "carry_prev_d", "prev_d"]), NaN);
      if (Number.isFinite(t0b)) t0 = t0b;
      M.carry = on ? { t0: clamp(Number.isFinite(t0) ? t0 : 0, 0, 600) } : null;
    }
    M.xTickOpt = tickOpt(params, "x");
    M.yTickOpt = tickOpt(params, "y");
    M.xReverse = truthy(pick(params, ["x_reverse", "reverse_x", "x_reversed", "invert_x", "x_invert", "x_umgekehrt"]));
    const dirS = str(pick(params, ["draw_direction", "draw_dir", "direction", "draw_from", "zeichenrichtung", "richtung"]), "").trim().toLowerCase();
    let ddir = M.xReverse ? -1 : 1; // Standard: am Bildschirm von links nach rechts
    if (/^(rtl|right|rechts|from_right|right_to_left|r2l|von_rechts)/.test(dirS)) ddir = M.xReverse ? 1 : -1;
    else if (/^(ltr|left|links|from_left|left_to_right|l2r|von_links)/.test(dirS)) ddir = M.xReverse ? -1 : 1;
    else if (/^(reverse|desc|backward|rückwärts|rueckwaerts|absteigend|high_to_low)/.test(dirS)) ddir = -1;
    else if (/^(asc|forward|aufsteigend|low_to_high)/.test(dirS)) ddir = 1;
    M.ddir = ddir;
    if (!M.ybands) M.ybands = normYBands(params);
    return M;
  }
  function buildModel(params) {
    params = isObj(params) ? params : {};
    const series = normSeries(params);
    if (!series.length) {
      const M = defaultModel();
      // Beschriftungen dürfen das Standardbeispiel überschreiben
      const tt = pick(params, ["title", "titel", "heading", "headline"]); if (typeof tt === "string") M.title = tt;
      return applyExtras(M, params);
    }
    const title = str(pick(params, ["title", "titel", "heading", "headline", "ueberschrift"]), "");
    const xLabel = str(pick(params, ["x_label", "xLabel", "xlabel", "x_axis", "x_achse", "xAxis"]), "");
    let yLabel = str(pick(params, ["y_label", "yLabel", "ylabel", "y_axis", "y_achse", "yAxis"]), "");
    const yUnit = str(pick(params, ["y_unit", "yUnit", "unit", "einheit", "y_einheit"]), "").trim();
    const xUnit = str(pick(params, ["x_unit", "xUnit", "x_einheit"]), "").trim() || unitFrom(xLabel);
    if (yUnit && yLabel && !unitFrom(yLabel) && yLabel.indexOf(yUnit) < 0) yLabel = `${yLabel} in ${yUnit}`;
    else if (yUnit && !yLabel) yLabel = `in ${yUnit}`;
    let dxMin = Infinity, dxMax = -Infinity, dyMin = Infinity, dyMax = -Infinity;
    for (const s of series) for (const q of s.pts) { dxMin = Math.min(dxMin, q[0]); dxMax = Math.max(dxMax, q[0]); dyMin = Math.min(dyMin, q[1]); dyMax = Math.max(dyMax, q[1]); }
    let xMin = num(pick(params, ["x_min", "xMin", "xmin"]), dxMin), xMax = num(pick(params, ["x_max", "xMax", "xmax"]), dxMax);
    if (xMax < xMin) { const tmp = xMin; xMin = xMax; xMax = tmp; }
    if (xMax - xMin < 1e-12) { xMin -= 1; xMax += 1; }
    const xDecHint = decFor(niceStep(xMax - xMin, 7));
    const anns = normAnns(params, xUnit, xDecHint);
    const refs = normRefs(params, yUnit);
    const zones = normZones(params);
    const ybands = normYBands(params);
    for (const a of anns) if (a.y !== null) { dyMin = Math.min(dyMin, a.y); dyMax = Math.max(dyMax, a.y); }
    for (const r of refs) { dyMin = Math.min(dyMin, r.y); dyMax = Math.max(dyMax, r.y); }
    for (const b of ybands) { dyMin = Math.min(dyMin, b.y0); dyMax = Math.max(dyMax, b.y1); }
    const uyMin = num(pick(params, ["y_min", "yMin", "ymin"]), NaN), uyMax = num(pick(params, ["y_max", "yMax", "ymax"]), NaN);
    let yMin, yMax, yStepChosen = 0;
    {
      let lo = Number.isFinite(uyMin) ? uyMin : (dyMin >= 0 ? 0 : dyMin);
      let hi = Number.isFinite(uyMax) ? uyMax : dyMax;
      if (hi < lo) { const tmp = lo; lo = hi; hi = tmp; }
      if (hi - lo < 1e-12) { hi = lo + (Math.abs(lo) > 0 ? Math.abs(lo) * 0.5 : 1); if (!Number.isFinite(uyMin) && lo > 0) lo = 0; }
      const span = hi - lo;
      if (!Number.isFinite(uyMax)) hi += span * 0.14;
      if (!Number.isFinite(uyMin) && lo < 0) lo -= span * 0.08;
      // Schrittweite so wählen, dass möglichst wenig leerer Achsenbereich entsteht (4–8 Ticks)
      let best = null;
      for (const target of [5, 4, 6, 7]) {
        const st = niceStep(hi - lo, target);
        const a0 = Number.isFinite(uyMin) ? lo : Math.floor(lo / st + 1e-9) * st;
        const a1 = Number.isFinite(uyMax) ? hi : Math.ceil(hi / st - 1e-9) * st;
        const n = Math.round((a1 - a0) / st) + 1;
        const waste = (a1 - a0) / Math.max(1e-12, hi - lo) + (n > 8 || n < 4 ? 1 : 0);
        if (!best || waste < best.waste - 0.02) best = { a0, a1, waste, st };
      }
      yMin = best.a0; yMax = best.a1; yStepChosen = best.st;
      if (yMax - yMin < 1e-12) yMax = yMin + 1;
    }
    const fillP = params.fill;
    const readoutP = pick(params, ["readout", "live_value", "messwert"]);
    return applyExtras({
      title, xLabel, yLabel, yUnit, xUnit, series, anns, refs, zones, ybands, xMin, xMax, yMin, yMax, yStep: yStepChosen,
      fill: fillP === undefined ? series.length <= 2 : !!fillP && !falsy(fillP),
      readout: readoutP === undefined ? true : !!readoutP && !falsy(readoutP),
      isDefault: false,
    }, params);
  }

  // ---------------- Geometrie + Label-Layout (einmal pro Parametersatz, gecacht) ----------------
  function buildGeom(ctx, M) {
    const G = { M };
    const XO = M.xTickOpt || { marks: true, labels: true, values: null }, YO = M.yTickOpt || { marks: true, labels: true, values: null };
    const ySt = M.yStep > 0 && (M.yMax - M.yMin) / M.yStep <= 12 ? M.yStep : niceStep(M.yMax - M.yMin, 5), xSt = niceStep(M.xMax - M.xMin, 7.5);
    G.yGrid = ticksFor(M.yMin, M.yMax, ySt); G.xGrid = ticksFor(M.xMin, M.xMax, xSt);
    G.xStep = xSt; G.yStep = ySt;
    const inY = (v) => v >= M.yMin - 1e-9 && v <= M.yMax + 1e-9, inX = (v) => v >= M.xMin - 1e-9 && v <= M.xMax + 1e-9;
    G.yTicks = YO.values ? YO.values.filter(inY).slice(0, 30) : G.yGrid;
    G.xTicks = XO.values ? XO.values.filter(inX).slice(0, 30) : G.xGrid;
    G.yDec = YO.values ? G.yTicks.reduce((m, v) => Math.max(m, decFor(v)), 0) : decFor(ySt);
    G.xDec = XO.values ? G.xTicks.reduce((m, v) => Math.max(m, decFor(v)), 0) : decFor(xSt);
    G.xCustom = !!XO.values;
    G.yLabels = G.yTicks.map((v) => fmt(v, G.yDec));
    G.xLabels = G.xTicks.map((v) => fmt(v, G.xDec));
    G.XO = XO; G.YO = YO;
    let tw = 0; if (YO.labels) for (const s of G.yLabels) tw = Math.max(tw, measure(ctx, s, 400, 22, F_MONO));
    G.PL = Math.round(IN_L + (YO.labels && G.yLabels.length ? tw + 22 : YO.marks ? 14 : 8));
    G.PR = PR; G.PT = PT; G.PB = PB;
    G.ylabX = G.PL + 20; // y-Beschriftung rechts neben der Achsspitze (kollidiert nicht mit dem Pfeil)
    const xr = !!M.xReverse;
    const spanX = G.PR - G.PL;
    const sx = xr ? (x) => G.PR - ((x - M.xMin) / (M.xMax - M.xMin)) * spanX : (x) => G.PL + ((x - M.xMin) / (M.xMax - M.xMin)) * spanX;
    const sy = (y) => G.PB - ((y - M.yMin) / (M.yMax - M.yMin)) * (G.PB - G.PT);
    G.sx = sx; G.sy = sy; G.xr = xr;
    G.ddir = M.ddir === -1 ? -1 : 1;
    G.sdir = (G.ddir > 0) !== xr ? 1 : -1; // Zeichenrichtung am Bildschirm
    G.base = sy(clamp(0, M.yMin, M.yMax));
    // Serien in px (Datenreihenfolge, Zeichenreihenfolge, Bildschirm-aufsteigend)
    G.series = M.series.map((s) => {
      const px = s.pts.map((q) => [sx(q[0]), sy(q[1])]);
      return {
        ...s, px,
        ordPts: G.ddir > 0 ? s.pts : s.pts.slice().reverse(), ordPx: G.ddir > 0 ? px : px.slice().reverse(),
        scr: xr ? px.slice().reverse() : px, x0: s.pts[0][0], x1: s.pts[s.pts.length - 1][0],
      };
    });
    let x0 = Infinity, x1 = -Infinity;
    for (const s of M.series) { x0 = Math.min(x0, s.pts[0][0]); x1 = Math.max(x1, s.pts[s.pts.length - 1][0]); }
    G.dx0 = clamp(x0, M.xMin, M.xMax); G.dx1 = clamp(x1, M.xMin, M.xMax);
    if (G.dx1 <= G.dx0) { G.dx0 = M.xMin; G.dx1 = M.xMax; }
    /** Kurve schneidet Rechteck? Optional nur im Bildschirmintervall [lo, hi] (bereits gezeichneter Teil). */
    const curveHits = (r, lo, hi) => {
      const L0 = lo === undefined ? -Infinity : lo, H0 = hi === undefined ? Infinity : hi;
      for (const s of G.series) {
        const P = s.scr;
        for (let i = 1; i < P.length; i++) {
          const a = P[i - 1], b = P[i];
          if (b[0] < r.x - 2 || b[0] < L0) continue;
          if (a[0] > r.x + r.w + 2 || a[0] > H0) break;
          if (segHitsRect(a[0], a[1], b[0], b[1], r)) return true;
        }
      }
      return false;
    };
    G.curveHits = curveHits;
    const inflate = (r, m) => ({ x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m });

    // Serie je Annotation (für y-Interpolation und Timing)
    const serOf = (a) => {
      let si = -1;
      if (typeof a.ser === "number" && M.series[Math.round(a.ser)]) si = Math.round(a.ser);
      else if (typeof a.ser === "string") {
        const k = M.series.findIndex((q) => q.name && q.name.toLowerCase() === a.ser.toLowerCase());
        si = k >= 0 ? k : /^\d+$/.test(a.ser) && M.series[Number(a.ser)] ? Number(a.ser) : -1;
      }
      if (si < 0) { const k = M.series.findIndex((q) => a.x >= q.pts[0][0] && a.x <= q.pts[q.pts.length - 1][0]); si = k >= 0 ? k : 0; }
      return si;
    };

    // Referenzlinien-Labels: frei von Kurve, Annotations-Markierungen und anderen Ref-Labels
    G.refs = [];
    const obst = [];
    const annXs = M.anns.filter((a) => a.x >= M.xMin && a.x <= M.xMax).map((a) => sx(a.x)).sort((p, q) => q - p);
    for (const r of M.refs) {
      if (r.y < M.yMin || r.y > M.yMax) continue;
      const py = sy(r.y); const lab = ellipsize(ctx, r.label, (G.PR - G.PL) * 0.46, 600, 19, F_BODY, 0.5); const w = measure(ctx, lab, 600, 19, F_BODY, 0.5) + 8; const h = 24;
      const xs = [{ x: G.PR - 10 - w, align: "right" }];
      for (const mx of annXs) { xs.push({ x: mx - 14 - w, align: "right" }); xs.push({ x: mx + 14, align: "left" }); }
      xs.push({ x: G.PL + 14, align: "left" });
      let best = null;
      for (const strict of [true, false]) {
        for (const c of xs) {
          for (const yy of [py - 8 - h, py + 8]) {
            const box = { x: c.x, y: yy, w, h };
            if (box.x < G.PL + 6 || box.x + box.w > G.PR - 4) continue;
            if (box.y < G.PT + 2 || box.y + box.h > G.PB - 2) continue;
            if (curveHits(inflate(box, 6))) continue;
            if (obst.some((o) => rectsHit(o, box, 4))) continue;
            if (strict && annXs.some((mx) => mx > box.x - 10 && mx < box.x + box.w + 10)) continue;
            best = { ...c, y: yy }; break;
          }
          if (best) break;
        }
        if (best) break;
      }
      if (!best) best = { x: G.PR - 10 - w, y: py - 8 - h, align: "right" };
      const box = { x: best.x, y: best.y, w, h, ref: true };
      obst.push(box);
      G.refs.push({ ...r, label: lab, py, box, align: best.align });
    }

    // y-Bänder: Fläche + Beschriftung (innen oben/unten links/rechts, sonst außen)
    G.ybands = [];
    for (const b of M.ybands || []) {
      const y0 = clamp(b.y0, M.yMin, M.yMax), y1 = clamp(b.y1, M.yMin, M.yMax);
      const pyTop = sy(y1), pyBot = sy(y0);
      if (pyBot - pyTop < 2) continue;
      // Kante, die mit einer Grenzlinie zusammenfällt: nur sichtbar, solange diese Linie noch nicht eingefahren ist
      const sameY = (r, v) => Math.abs(r.y - v) < 1e-9 * Math.max(1, Math.abs(v));
      const edgeTopRef = G.refs.findIndex((r) => sameY(r, y1)), edgeBotRef = G.refs.findIndex((r) => sameY(r, y0));
      const edgeTop = b.edges && y1 < M.yMax && (edgeTopRef >= 0 || !M.refs.some((r) => sameY(r, y1)));
      const edgeBot = b.edges && y0 > M.yMin && (edgeBotRef >= 0 || !M.refs.some((r) => sameY(r, y0)));
      let cap = null;
      if (b.label) {
        const size = 19;
        const lab = ellipsize(ctx, b.label, (G.PR - G.PL) * 0.5, 700, size, F_BODY, 2);
        const w = measure(ctx, lab, 700, size, F_BODY, 2) + 8, h = size + 8;
        const inside = pyBot - pyTop >= h + 12;
        const xl = G.PL + 16, xrr = G.PR - 16 - w, xm = (G.PL + G.PR) / 2 - w / 2;
        const cands = [];
        if (inside) cands.push([xl, pyTop + 7], [xrr, pyTop + 7], [xl, pyBot - 7 - h], [xrr, pyBot - 7 - h], [xm, pyTop + 7], [xm, pyBot - 7 - h]);
        cands.push([xl, pyTop - 7 - h], [xrr, pyTop - 7 - h], [xl, pyBot + 7], [xrr, pyBot + 7]);
        let best = null;
        for (const lvl of [0, 1, 2]) {
          for (const c of cands) {
            const box = { x: c[0], y: c[1], w, h };
            if (box.y < G.PT + 2 || box.y + box.h > G.PB - 2) continue;
            if (lvl < 2 && curveHits(inflate(box, 6))) continue;
            if (obst.some((o) => rectsHit(o, box, 6))) continue;
            if (lvl < 1 && annXs.some((mx) => mx > box.x - 10 && mx < box.x + box.w + 10)) continue;
            best = box; break;
          }
          if (best) break;
        }
        if (!best) best = { x: xl, y: inside ? pyTop + 7 : Math.max(G.PT + 2, pyTop - 7 - h), w, h };
        cap = { label: lab, size, box: best, inside: best.y >= pyTop && best.y + best.h <= pyBot };
        obst.push(best);
      }
      G.ybands.push({ ...b, pyTop, pyBot, edgeTop, edgeBot, edgeTopRef, edgeBotRef, cap });
    }

    // Inset mit fester Ecke vor den Annotationen platzieren (Labels weichen aus)
    const annPts = [];
    const insetFixed = M.inset && (M.inset.pos || M.inset.corner !== "auto");
    if (insetFixed) { G.inset = placeInset(ctx, G, obst, [], [], inflate); if (G.inset) obst.push(G.inset.box); }

    // Annotationen: Kurvenpunkt, Label-Box (Seite + Höhe frei von Kurve/anderen Labels)
    G.anns = [];
    const anns = M.anns.filter((a) => a.x >= M.xMin - 1e-9 && a.x <= M.xMax + 1e-9);
    const PAD = 14, GAP = 12;
    const items = anns.map((a) => {
      const si = serOf(a);
      let y = a.y;
      if (y === null) y = interpY(M.series[si].pts, a.x);
      const lines = a.label ? wrapLines(ctx, a.label, 460, 600, 24, F_BODY, 0, 2) : [];
      const sub = a.sub ? ellipsize(ctx, a.sub, 420, 600, 18, F_MONO, 0) : "";
      let lw = 0; for (const l of lines) lw = Math.max(lw, measure(ctx, l, 600, 24, F_BODY));
      const sw = sub ? measure(ctx, sub, 600, 18, F_MONO) : 0;
      const w = Math.ceil(Math.max(lw, sw) + PAD * 2 + 6);
      const lastBase = lines.length ? 32 + (lines.length - 1) * 28 : 0;
      const subBase = sub ? (lines.length ? lastBase + 23 : 28) : 0;
      const h = sub ? subBase + 11 : (lines.length ? lastBase + 14 : 44);
      const hNoSub = lines.length ? lastBase + 14 : h;
      const wNoSub = lines.length ? Math.ceil(lw + PAD * 2 + 6) : w;
      return { ...a, si, lines, subT: sub, lastBase, subBase, hNoSub, wNoSub, yv: y, px: sx(a.x), py: sy(clamp(y, M.yMin, M.yMax)), w, h, hasBox: !!(lines.length || sub) };
    });
    items.sort((p, q) => p.px - q.px);
    const markerXs = items.map((a) => a.px);
    for (const a of items) annPts.push([a.px, a.py]);
    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      if (!a.hasBox) { G.anns.push({ ...a, box: null }); continue; }
      const next = items[i + 1];
      let prefRight = true;
      if (next && next.px - a.px < a.w + GAP + 30) prefRight = false;
      if (a.px + GAP + a.w > G.PR - 4) prefRight = false;
      const RMAX = G.PR + 34; // Labels dürfen bis in den rechten Innenrand des Panels ragen
      if (a.px + GAP + a.w > RMAX) prefRight = false;
      // level 0: frei von Kurve, Labels und fremden Markierungen; 1: Markierungen erlaubt; 2: Kurve erlaubt
      const boxOk = (box, level) => {
        if (obst.some((o) => rectsHit(o, box, o.ref ? 18 : 10))) return false;
        if (level < 2 && curveHits({ x: box.x - 6, y: box.y - 12, w: box.w + 12, h: box.h + 24 })) return false;
        if (level < 1 && markerXs.some((mx, j) => j !== i && mx > box.x - 8 && mx < box.x + box.w + 8)) return false;
        // Kurvenpunkt der eigenen Markierung nicht verdecken
        if (a.px > box.x - 10 && a.px < box.x + box.w + 10 && a.py > box.y - 10 && a.py < box.y + box.h + 10) return false;
        return true;
      };
      const tryPlace = (side, level) => {
        const bx = side > 0 ? a.px + GAP : a.px - GAP - a.w;
        if (bx < G.PL + 4 || bx + a.w > RMAX) return null;
        for (let by = G.PT + 6; by <= G.PB - a.h - 8; by += 6) {
          const box = { x: bx, y: by, w: a.w, h: a.h };
          if (boxOk(box, level)) return box;
        }
        return null;
      };
      // place: "near" – Box so nah wie möglich am Markierungspunkt (zuerst knapp darüber, dann weiter oben, dann darunter)
      const nearCost = (box) => {
        const above = a.py - (box.y + box.h), below = box.y - a.py;
        return above >= 0 ? Math.max(0, above - 16) : below >= 0 ? below - 16 + 24 : 1e6;
      };
      const tryNear = (side, level) => {
        const bx = side > 0 ? a.px + GAP : a.px - GAP - a.w;
        if (bx < G.PL + 4 || bx + a.w > RMAX) return null;
        let best = null, bc = Infinity;
        for (let by = G.PT + 6; by <= G.PB - a.h - 8; by += 3) {
          const box = { x: bx, y: by, w: a.w, h: a.h };
          const c = nearCost(box);
          if (c >= bc) continue;
          if (boxOk(box, level)) { best = box; bc = c; }
        }
        return best ? { box: best, c: bc } : null;
      };
      let chosen = null, side = 1;
      for (const level of [0, 1, 2]) {
        if (a.near) {
          const r = tryNear(1, level), l = tryNear(-1, level);
          const sr = r ? r.c + (prefRight ? 0 : 30) : Infinity, sl = l ? l.c + (prefRight ? 30 : 0) : Infinity;
          if (r || l) { if (sr <= sl) { chosen = r.box; side = 1; } else { chosen = l.box; side = -1; } break; }
          continue;
        }
        const r = tryPlace(1, level), l = tryPlace(-1, level);
        const sr = r ? r.y + (prefRight ? 0 : 70) : Infinity, sl = l ? l.y + (prefRight ? 70 : 0) : Infinity;
        if (r || l) { if (sr <= sl) { chosen = r; side = 1; } else { chosen = l; side = -1; } break; }
      }
      if (!chosen) {
        // Notlösung: oben, horizontal in den Plot geklemmt
        side = a.px + GAP + a.w <= RMAX ? 1 : -1;
        const bx = clamp(side > 0 ? a.px + GAP : a.px - GAP - a.w, G.PL + 4, RMAX - a.w);
        chosen = { x: bx, y: G.PT + 6, w: a.w, h: a.h };
      }
      obst.push(chosen);
      G.anns.push({ ...a, box: chosen, side });
    }

    // Bereichs-Beschriftungen
    G.zones = [];
    for (const z of M.zones) {
      const za = sx(clamp(z.x0, M.xMin, M.xMax)), zb = sx(clamp(z.x1, M.xMin, M.xMax));
      const zx0 = Math.min(za, zb), zx1 = Math.max(za, zb);
      if (zx1 - zx0 < 4) continue;
      let cap = null;
      if (z.label) {
        let size = 19; let w = measure(ctx, z.label, 700, size, F_BODY, 2);
        while (w > zx1 - zx0 - 16 && size > 14) { size -= 1; w = measure(ctx, z.label, 700, size, F_BODY, 2); }
        if (w <= zx1 - zx0 - 10) {
          const cx = (zx0 + zx1) / 2; const h = size + 8;
          const cands = [G.PB - 14 - h];
          for (const r of G.refs) cands.push(r.py - 10 - h, r.py + 10);
          cands.push(G.PT + 8, G.PB - 60 - h);
          let yb = cands[0];
          for (const cy of cands) {
            const box = { x: cx - w / 2, y: cy, w, h };
            if (box.y < G.PT + 4 || box.y + box.h > G.PB - 8) continue;
            if (curveHits(inflate(box, 6))) continue;
            if (obst.some((o) => rectsHit(o, box, 6))) continue;
            if (G.refs.some((r) => r.py > box.y - 6 && r.py < box.y + box.h + 6)) continue;
            yb = cy; break;
          }
          cap = { x: cx, y: yb + h - 6, size, box: { x: cx - w / 2, y: yb, w, h } };
          obst.push(cap.box);
        }
      }
      G.zones.push({ ...z, zx0, zx1, cap });
    }
    // Inset automatisch: freie Stelle nach allen Labels
    if (M.inset && !insetFixed) { G.inset = placeInset(ctx, G, obst, markerXs, annPts, inflate); if (G.inset) obst.push(G.inset.box); }
    G.obst = obst;

    // Fußnote unten links (Zeile der x-Beschriftung), bei Platzmangel kleiner bzw. zweizeilig
    if (M.footnote) {
      const xLabW = M.xLabel ? measure(ctx, M.xLabel, 600, 23, F_BODY, 0.3) : 0;
      const fx = IN_L + 14;
      const maxW = Math.max(240, PR + 24 - xLabW - (M.xReverse ? 40 : 0) - 48 - fx);
      let size = 19, lines = [M.footnote.text];
      while (size > 16 && measure(ctx, lines[0], 400, size, F_BODY, 0.2) > maxW) size--;
      if (measure(ctx, lines[0], 400, size, F_BODY, 0.2) > maxW) lines = wrapLines(ctx, M.footnote.text, maxW, 400, size, F_BODY, 0.2, 2);
      const lh = size + 5;
      G.foot = { lines, size, lh, x: fx, y0: XLAB_Y - (lines.length - 1) * lh, color: M.footnote.color };
    }

    // Titel + Legende (Kopfzeile): Legende rechts in Zeile 0 (neben Titel) und/oder Zeile 1 (neben y-Label).
    G.header = layoutHeader(ctx, M, G.ylabX - IN_L);
    return G;
  }

  /** Inset-Größe (Breite aus Label, Höhe wählbar). */
  function insetLayout(ctx, S, h) {
    const hasCol = Number.isFinite(S.value) && S.value > 0;
    const labW = hasCol ? Math.max(S.label ? measure(ctx, S.label, 700, 24, F_MONO) : 0, S.sub ? measure(ctx, S.sub, 600, 16, F_BODY) : 0) : 0;
    const title = S.title ? upperTitle(S.title) : "";
    const titleW = title ? measure(ctx, title, 700, 16, F_BODY, 2) + 32 : 0;
    const BW = S.storeys ? 100 : 44;
    const inner = 22 + BW + (hasCol ? 16 + 24 + 16 + 14 + labW : 0) + 16;
    return { w: Math.round(clamp(Math.max(inner, titleW, 170), 170, 560)), h: Math.round(h), BW, hasCol, title };
  }
  function insetGeom(S, box, lay) {
    const I = { box, hasCol: lay.hasCol, title: lay.title };
    I.bx0 = box.x + 22; I.bx1 = I.bx0 + lay.BW;
    I.personX = I.bx0 + (S.storeys ? 22 : lay.BW / 2);
    I.cx0 = I.bx1 + 16; I.cw = 24; I.dimX = I.cx0 + I.cw + 16;
    I.gy = box.y + box.h - 22;
    const topY = box.y + (I.title ? 46 : 20);
    const maxV = Math.max(lay.hasCol ? S.value : 0, S.storeys * S.storeyH, S.person ? S.personH * 1.1 : 0, 1e-6);
    I.ppu = (I.gy - topY) / (maxV * 1.03);
    I.colH = lay.hasCol ? S.value * I.ppu : 0;
    return I;
  }
  /** Freie Stelle im Plot für das Inset suchen (Ecke bevorzugt, frei von Kurve, Labels, Markierungen). */
  function placeInset(ctx, G, obst, markerXs, annPts, inflate) {
    const S = G.M.inset; if (!S) return null;
    const pL = G.PL, pR = G.PR, pT = G.PT, pB = G.PB;
    const c = S.corner || "auto";
    const top = /top|oben|^t/.test(c), bottom = /bottom|unten|^b/.test(c), left = /left|links|l$/.test(c), right = /right|rechts|r$/.test(c);
    const hs = Number.isFinite(S.h) ? [clamp(S.h, 150, pB - pT - 16)] : [260, 236, 212, 190, 170];
    let firstLay = null;
    for (const hTry of hs) {
      const lay = insetLayout(ctx, S, Math.min(hTry, pB - pT - 16));
      if (!firstLay) firstLay = lay;
      const w = lay.w, h = lay.h;
      if (w > pR - pL - 24) continue;
      const xMinB = pL + 16, xMaxB = pR - w - 8, yMinB = pT + 8, yMaxB = pB - h - 8;
      if (S.pos) {
        const box = { x: Math.round(lerp(xMinB, xMaxB, clamp(S.pos[0], 0, 1))), y: Math.round(lerp(yMinB, yMaxB, clamp(S.pos[1], 0, 1))), w, h };
        return insetGeom(S, box, lay);
      }
      const corners = [[xMinB, yMinB], [xMaxB, yMinB], [xMaxB, yMaxB], [xMinB, yMaxB]];
      let targets = corners;
      if (c !== "auto") {
        const tx = left ? xMinB : right ? xMaxB : (xMinB + xMaxB) / 2, ty = top ? yMinB : bottom ? yMaxB : (yMinB + yMaxB) / 2;
        targets = [[tx, ty]];
      }
      for (const level of [0, 1, 2]) {
        let best = null, bestS = Infinity;
        for (let y = yMinB; y <= yMaxB; y += 8) {
          for (let x = xMinB; x <= xMaxB; x += 12) {
            let sc = Infinity;
            for (let ti = 0; ti < targets.length; ti++) { const dd = Math.hypot(x - targets[ti][0], (y - targets[ti][1]) * 1.3) + ti * 60; if (dd < sc) sc = dd; }
            if (sc >= bestS) continue;
            const box = { x, y, w, h };
            if (curveHits2(G, inflate(box, level < 2 ? 16 : 6))) continue;
            if (obst.some((o) => rectsHit(o, box, 12))) continue;
            if (level < 1 && markerXs.some((mx) => mx > box.x - 12 && mx < box.x + box.w + 12)) continue;
            if (annPts.some((q) => q[0] > box.x - 20 && q[0] < box.x + box.w + 20 && q[1] > box.y - 20 && q[1] < box.y + box.h + 20)) continue;
            best = box; bestS = sc;
          }
        }
        if (best) return insetGeom(S, best, lay);
      }
    }
    // Notlösung: kleinste Größe oben links
    const lay = insetLayout(ctx, S, 170);
    return insetGeom(S, { x: pL + 16, y: pT + 8, w: lay.w, h: lay.h }, lay || firstLay);
  }
  const curveHits2 = (G, r) => G.curveHits(r);

  function fitTitle(ctx, title, maxW, lines) {
    if (!title) return { lines: [], size: 0, w: 0 };
    if (maxW < 200) return null;
    const sizes = lines === 1 ? [40, 38, 36, 34, 32, 30] : [32, 30, 28];
    for (const sz of sizes) {
      if (lines === 1) { const w = measure(ctx, title, 700, sz, F_HEAD, 2); if (w <= maxW) return { lines: [title], size: sz, w }; }
      else {
        const ls = wrapLines(ctx, title, maxW, 700, sz, F_HEAD, 2, 3);
        if (ls.length <= 2) { let w = 0; for (const l of ls) w = Math.max(w, measure(ctx, l, 700, sz, F_HEAD, 2)); if (w <= maxW) return { lines: ls, size: sz, w }; }
      }
    }
    return null;
  }
  function layoutHeader(ctx, M, yOff) {
    const title = M.title ? upperTitle(M.title) : "";
    const avail = PR + 24 - IN_L;
    const yLabW = (M.yLabel ? measure(ctx, M.yLabel, 600, 23, F_BODY, 0.3) : 0) + (yOff || 0);
    const items = M.series.filter((s) => s.name).map((s) => ({ name: s.name, color: s.color, at: s.at }));
    const GAPL = 34;
    const widthOf = (arr) => (arr.length ? arr.reduce((a, it) => a + it.w, 0) + GAPL * (arr.length - 1) : 0);
    for (const lf of [23, 20, 18]) {
      const its = items.map((it) => { const name = ellipsize(ctx, it.name, 540, 600, lf, F_BODY, 0); return { ...it, name, w: 44 + measure(ctx, name, 600, lf, F_BODY) }; });
      for (const nl of [1, 2]) {
        let best = null;
        for (let k = its.length; k >= 0; k--) {
          const r0 = its.slice(0, k), r1 = its.slice(k);
          const w0 = widthOf(r0), w1 = widthOf(r1);
          if (w1 > 0 && yLabW + 60 + w1 > avail) continue;
          const tf = fitTitle(ctx, title, avail - (w0 ? w0 + 60 : 0), nl);
          if (!tf) continue;
          if (!best || tf.size > best.title.size) best = { title: tf, rows: [r0, r1], lf };
        }
        if (best) return best;
      }
    }
    // Notlösung: Titel einzeilig gekürzt, Legende klein in Zeile 1
    const lf = 18;
    const its = items.map((it) => { const name = ellipsize(ctx, it.name, 260, 600, lf, F_BODY, 0); return { ...it, name, w: 44 + measure(ctx, name, 600, lf, F_BODY) }; });
    const r1 = []; let acc = yLabW + 60;
    for (const it of its) { if (acc + it.w <= avail) { r1.push(it); acc += it.w + GAPL; } }
    const tl = title ? ellipsize(ctx, title, avail, 700, 30, F_HEAD, 2) : "";
    return { title: { lines: tl ? [tl] : [], size: 30, w: tl ? measure(ctx, tl, 700, 30, F_HEAD, 2) : 0 }, rows: [[], r1], lf };
  }

  const GEOM_CACHE = new WeakMap();
  const MODEL_CACHE = new WeakMap();
  function getModel(params) {
    if (isObj(params)) { const c = MODEL_CACHE.get(params); if (c) return c; }
    let M;
    try { M = buildModel(params); } catch (e) { M = defaultModel(); }
    if (isObj(params)) MODEL_CACHE.set(params, M);
    return M;
  }
  function getGeom(ctx, M) {
    let G = GEOM_CACHE.get(M);
    if (!G) { G = buildGeom(ctx, M); GEOM_CACHE.set(M, G); }
    return G;
  }

  // ---------------- Zeichnen ----------------
  /** Hintergrund wie die Engine (Radialverlauf + 60-px-Raster, statisch im Bildraum), aber ohne Raster im Panel;
      das Panel selbst wird deckend gefüllt – so kostet die Fläche nur einen Vollbild-Füllvorgang. */
  function drawBackdrop(ctx, p, a) {
    const W = p.W || 1920, H = p.H || 1080, Lb = p.L;
    const m = ctx.getTransform();
    const px0 = m.a * PANEL.x + m.c * PANEL.y + m.e, py0 = m.b * PANEL.x + m.d * PANEL.y + m.f;
    const px1 = m.a * (PANEL.x + PANEL.w) + m.c * (PANEL.y + PANEL.h) + m.e, py1 = m.b * (PANEL.x + PANEL.w) + m.d * (PANEL.y + PANEL.h) + m.f;
    const sc = Math.abs(m.a) || 1;
    const bg0 = (Lb && Lb.C && Lb.C.bg0) || "#040a16", bg1 = (Lb && Lb.C && Lb.C.bg1) || "#0a1830";
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // außen: Engine-Verlauf + Raster
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); rrect(ctx, px0, py0, px1 - px0, py1 - py0, 10 * sc);
    ctx.clip("evenodd");
    const g = ctx.createRadialGradient(W * 0.5, H * 0.45, 50, W * 0.5, H * 0.5, W * 0.75);
    g.addColorStop(0, bg1); g.addColorStop(1, bg0);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = 1;
    const gs = 60;
    const gridA = (Lb && Lb.C && Lb.C.grid) || "rgba(80,170,255,0.07)", gridB = (Lb && Lb.C && Lb.C.gridStrong) || "rgba(80,170,255,0.14)";
    for (const strong of [false, true]) {
      ctx.strokeStyle = strong ? gridB : gridA; ctx.beginPath();
      for (let x = 0; x <= W; x += gs) if (((x / gs) % 5 === 0) === strong) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
      for (let y = 0; y <= H; y += gs) if (((y / gs) % 5 === 0) === strong) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
      ctx.stroke();
    }
    ctx.restore();
    // Panel deckend (Farbe ≈ Panel-Glas über dem Verlaufszentrum); beim Einblenden aus dem Verlauf heraus
    ctx.fillStyle = a >= 0.999 ? "#06101f" : mix("#0a1830", "#06101f", a);
    ctx.beginPath(); rrect(ctx, px0, py0, px1 - px0, py1 - py0, 10 * sc); ctx.fill();
    ctx.restore();
  }
  function drawPanel(ctx, t, a) {
    const { x, y, w, h } = PANEL;
    ctx.save(); ctx.globalAlpha = a;
    ctx.strokeStyle = "rgba(63,210,255,0.16)"; ctx.lineWidth = 1.2; ctx.beginPath(); rrect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 10); ctx.stroke();
    ctx.restore();
    // Eck-Winkel (Blueprint)
    const L = 34, c = rgba(COL.cyan, 0.75);
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.beginPath();
    for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) { ctx.moveTo(cx + sx * L, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * L); }
    ctx.stroke(); ctx.restore();
    // kleine Messmarken an der Unterkante (Instrumenten-Look), langsam laufend
    ctx.save(); ctx.globalAlpha = a * 0.5; ctx.fillStyle = COL.cyan;
    const off = (t * 14) % 24;
    for (let xx = x + 60 + off; xx < x + w - 60; xx += 24) ctx.fillRect(xx, y + h - 7, 1, (Math.round((xx - x) / 24) % 5 === 0) ? 5 : 3);
    ctx.restore();
  }

  function drawDust(ctx, t, a) {
    ctx.save();
    for (let i = 0; i < 26; i++) {
      const r0 = h01(i * 3.17 + 0.5), r1 = h01(i * 7.31 + 1.1), r2 = h01(i * 1.93 + 2.7);
      const x = PANEL.x + 24 + ((r0 * (PANEL.w - 48) + t * (4 + 6 * r2)) % (PANEL.w - 48));
      const yy = PANEL.y + 24 + (((r1 * (PANEL.h - 48) - t * (7 + 9 * r2)) % (PANEL.h - 48)) + (PANEL.h - 48)) % (PANEL.h - 48);
      const al = a * (0.10 + 0.14 * (0.5 + 0.5 * Math.sin(t * (0.8 + r2) + i)));
      ctx.globalAlpha = al; ctx.fillStyle = i % 5 === 0 ? COL.amber : COL.cyan;
      ctx.beginPath(); ctx.arc(x, yy, 1 + 1.6 * r2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /** Teilpolylinie einer Serie bis zur Kopf-Position hxData (in Zeichenrichtung) + interpolierter Kopf. */
  function partial(s, hxData, G) {
    const P = s.ordPts, X = s.ordPx, n = P.length, dd = G.ddir;
    if (!n || (hxData - P[0][0]) * dd < 0) return null;
    const out = [];
    let i = 0;
    for (; i < n && (P[i][0] - hxData) * dd <= 0; i++) out.push(X[i]);
    let headY;
    if (i < n && i > 0) {
      const a = P[i - 1], b = P[i]; const f = (hxData - a[0]) / ((b[0] - a[0]) || 1e-12);
      headY = lerp(a[1], b[1], f); out.push([G.sx(hxData), G.sy(headY)]);
    } else headY = P[Math.min(i, n) - 1][1];
    return { pts: out, head: out[out.length - 1], headY };
  }

  function drawLabelBox(ctx, a, k, textA, subK) {
    const b = a.box; if (!b || k <= 0.002) return;
    const hasLate = a.subT && a.lines.length && subK < 1;
    const wFull = hasLate ? lerp(Math.min(a.wNoSub, b.w), b.w, eo(subK)) : b.w;
    const h = hasLate ? lerp(a.hNoSub, b.h, eo(subK)) : b.h;
    const w = wFull * eo(k);
    const x = a.side > 0 ? b.x : b.x + b.w - w;
    const x0 = a.side > 0 ? b.x : b.x + b.w - wFull;
    ctx.save();
    ctx.globalAlpha = clamp(k * 1.4, 0, 1);
    ctx.fillStyle = "rgba(4,11,25,0.9)"; ctx.beginPath(); rrect(ctx, x, b.y, w, h, 6); ctx.fill();
    ctx.strokeStyle = rgba(a.color, 0.55); ctx.lineWidth = 1.4; ctx.beginPath(); rrect(ctx, x + 0.5, b.y + 0.5, w - 1, h - 1, 6); ctx.stroke();
    // Akzentleiste an der Markierungsseite
    ctx.fillStyle = a.color;
    if (a.side > 0) ctx.fillRect(x, b.y + 6, 3, h - 12); else ctx.fillRect(x + w - 3, b.y + 6, 3, h - 12);
    ctx.restore();
    // Verbinder Markierungslinie -> Box
    const cy = b.y + (a.lines.length ? 23 : h / 2);
    const ex = a.side > 0 ? b.x : b.x + b.w;
    line(ctx, a.px, cy, ex, cy, a.color, 1.6, 0, clamp(k * 1.5, 0, 1));
    disc(ctx, a.px, cy, 3.2, a.color, clamp(k * 1.5, 0, 1));
    if (textA <= 0.01) return;
    ctx.save(); ctx.beginPath(); ctx.rect(x, b.y, w, h); ctx.clip();
    const tx = x0 + 14 + (a.side > 0 ? 4 : 0);
    a.lines.forEach((l, i) => txt(ctx, l, tx, b.y + 32 + i * 28 - (a.subT ? 0 : 2), { size: 24, weight: 600, color: COL.white, alpha: textA }));
    if (a.subT) txt(ctx, a.subT, tx, b.y + a.subBase, { size: 18, weight: 600, font: F_MONO, color: mix(a.color, "#ffffff", 0.18), alpha: textA * 0.95 * (a.lines.length ? subK : 1) });
    ctx.restore();
  }

  function person(ctx, x, y, h, color, alpha) {
    if (alpha <= 0.004 || h <= 2) return;
    const s = h / 180; ctx.save(); ctx.globalAlpha = clamp(alpha, 0, 1); ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y - 165 * s, 15 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); rrect(ctx, x - 22 * s, y - 145 * s, 44 * s, 75 * s, 12 * s); ctx.fill();
    ctx.fillRect(x - 20 * s, y - 75 * s, 16 * s, 75 * s); ctx.fillRect(x + 4 * s, y - 75 * s, 16 * s, 75 * s);
    ctx.restore();
  }
  function tri(ctx, x, y, dir, size, color, alpha) {
    // dir: -1 = Spitze nach oben, 1 = nach unten
    if (alpha <= 0.004) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x - size * 0.55, y - dir * size); ctx.lineTo(x + size * 0.55, y - dir * size); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  /** Maßstabs-Inset: Geschosse (Schnitt), Personen-Silhouette, gestrichelte Säule der Höhe value + Maßlinie. */
  function drawInset(ctx, G, t, tI, tV, f) {
    const I = G.inset; if (!I) return;
    const S = G.M.inset, b = I.box, col = S.color;
    f = clamp(f || 1, 0.25, 1); // Aufbau-Tempo (kürzer, wenn das Inset spät in einer kurzen Szene startet)
    const k = eo(seg(t, tI, 0.45 * f)); if (k <= 0.004) return;
    ctx.save(); ctx.globalAlpha = k;
    ctx.fillStyle = "rgba(4,11,25,0.94)"; ctx.beginPath(); rrect(ctx, b.x, b.y, b.w, b.h, 8); ctx.fill();
    ctx.strokeStyle = rgba(COL.cyan, 0.3); ctx.lineWidth = 1.2; ctx.beginPath(); rrect(ctx, b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, 8); ctx.stroke();
    ctx.strokeStyle = rgba(COL.cyan, 0.85); ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.beginPath();
    const cl = 14 * eo(seg(t, tI, 0.6 * f));
    for (const [cx, cy, ux, uy] of [[b.x, b.y, 1, 1], [b.x + b.w, b.y, -1, 1], [b.x, b.y + b.h, 1, -1], [b.x + b.w, b.y + b.h, -1, -1]]) { ctx.moveTo(cx + ux * cl, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + uy * cl); }
    ctx.stroke(); ctx.restore();
    if (I.title) txt(ctx, I.title, b.x + 16, b.y + 28, { size: 16, weight: 700, color: COL.muted, alpha: k, ls: 2 });
    const gy = I.gy, ppu = I.ppu;
    // Boden mit Schraffur
    const gk = eo(seg(t, tI + 0.1 * f, 0.5 * f));
    const gx0 = b.x + 12, gx1 = lerp(b.x + 12, b.x + b.w - 12, gk);
    line(ctx, gx0, gy, gx1, gy, COL.steel, 2, 0, 0.9 * k);
    ctx.save(); ctx.globalAlpha = 0.35 * k; ctx.strokeStyle = COL.steel; ctx.lineWidth = 1; ctx.beginPath();
    for (let xx = gx0 + 9; xx < gx1; xx += 10) { ctx.moveTo(xx, gy + 2); ctx.lineTo(xx - 7, gy + 9); }
    ctx.stroke(); ctx.restore();
    // Geschosse (Schnitt): Wände, Decken, Fenster
    const sh = S.storeyH * ppu;
    for (let i = 0; i < S.storeys; i++) {
      const sk = eo(seg(t, tI + (0.15 + i * 0.18) * f, 0.45 * f)); if (sk <= 0) continue;
      const y0 = gy - i * sh, y1 = gy - (i + 1) * sh, al = 0.85 * k;
      line(ctx, I.bx0, y0, I.bx0, lerp(y0, y1, sk), COL.steel, 1.6, 0, al);
      line(ctx, I.bx1, y0, I.bx1, lerp(y0, y1, sk), COL.steel, 1.6, 0, al);
      ctx.save(); ctx.globalAlpha = al * sk; ctx.fillStyle = rgba(COL.steel, 0.9);
      ctx.fillRect(I.bx0 - 5, y1 - 3, (I.bx1 - I.bx0 + 10) * sk, 5);
      const wx = I.bx0 + (I.bx1 - I.bx0) * 0.55, ww = (I.bx1 - I.bx0) * 0.3, wy = y0 - sh * 0.66, wh = sh * 0.36;
      ctx.strokeStyle = rgba(COL.cyan, 0.7); ctx.lineWidth = 1.2; ctx.strokeRect(wx, wy, ww, wh);
      ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.stroke();
      ctx.restore();
    }
    if (S.person) person(ctx, I.personX, gy - 1, S.personH * ppu, COL.steel, 0.85 * k * sm(seg(t, tI + 0.35 * f, 0.4 * f)));
    if (I.hasCol) {
      const ck = eo(seg(t, tI + 0.45 * f, 0.9 * f));
      if (ck > 0) {
        const ch = I.colH * ck, cy = gy - ch;
        ctx.save(); ctx.globalAlpha = k;
        const gr = ctx.createLinearGradient(0, cy, 0, gy); gr.addColorStop(0, rgba(col, 0.32)); gr.addColorStop(1, rgba(col, 0.05));
        ctx.fillStyle = gr; ctx.fillRect(I.cx0, cy, I.cw, ch); ctx.restore();
        glowStroke(ctx, (c2) => c2.rect(I.cx0, cy, I.cw, ch), col, 2, 0.6, k, [8, 6], -t * 14);
        const topP = ck < 1 ? 1 : 0.7 + 0.3 * Math.sin(t * 3.2);
        line(ctx, I.cx0 - 5, cy, I.cx0 + I.cw + 5, cy, col, 3, 1, k * topP);
        const dx = I.dimX;
        line(ctx, I.cx0 + I.cw + 5, cy, dx + 7, cy, col, 1, 0, 0.55 * k, [3, 4], 0);
        line(ctx, dx, gy - 2, dx, cy + 2, col, 1.6, 0, 0.9 * k);
        line(ctx, dx - 7, gy, dx + 7, gy, col, 1.6, 0, 0.9 * k);
        line(ctx, dx - 7, cy, dx + 7, cy, col, 1.6, 0, 0.9 * k);
        if (ch > 30) { tri(ctx, dx, cy + 1, -1, 10, col, 0.95 * k); tri(ctx, dx, gy - 1, 1, 10, col, 0.95 * k); }
      }
      const va = sm(seg(t, Math.max(tV, tI + 1.05 * f), 0.4 * f));
      if (va > 0 && S.label) {
        const ly = Math.max(b.y + (I.title ? 46 : 20) + 18, gy - I.colH + 20);
        txt(ctx, S.label, dx2(I), ly, { size: 24, weight: 700, font: F_MONO, color: mix(col, "#ffffff", 0.25), alpha: va * k, glow: 10, glowColor: rgba(col, 0.8) });
        if (S.sub) txt(ctx, S.sub, dx2(I), ly + 22, { size: 16, weight: 600, color: COL.muted, alpha: va * k });
      }
    }
  }
  const dx2 = (I) => I.dimX + 14;

  /** Text-Overlay oben links – optisch identisch zur Engine, aber lange Texte werden verkleinert bzw. zweizeilig. */
  function drawOverlay(ctx, p) {
    const text = typeof p.text === "string" ? p.text.trim() : "";
    if (!text) return;
    const L = p.L; const t = p.t || 0, d = Math.max(1, p.d || 8);
    const a = Math.min(seg(t, 0.5, 0.45), 1 - seg(t, d - 0.3 - 0.45, 0.45));
    if (a <= 0) return;
    let up; try { up = text.toLocaleUpperCase("de-DE"); } catch (e) { up = text.toUpperCase(); }
    const MAXW = 1020;
    let size = 40, lines = [up];
    let w = measure(ctx, up, 700, size, F_HEAD, 2);
    while (w > MAXW && size > 32) { size -= 2; w = measure(ctx, up, 700, size, F_HEAD, 2); }
    if (w > MAXW) { size = 30; lines = wrapLines(ctx, up, MAXW, 700, size, F_HEAD, 2, 2); w = 0; for (const l of lines) w = Math.max(w, measure(ctx, l, 700, size, F_HEAD, 2)); }
    const lh = Math.round(size * 1.14);
    const x = 90, top = 96, h = size + (lines.length > 1 ? 30 : 34) + (lines.length - 1) * lh, bw = w + 70;
    const slide = eo(seg(t, 0.5, 0.5));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = a;
    try {
      L.fillRect(ctx, x, top, 8, h, L.C.amber);
      L.panel(ctx, x + 14, top, bw * slide, h, { fill: "rgba(4,12,26,0.82)", stroke: L.C.amberSoft, r: 4, alpha: a });
    } catch (e) { /* Lib fehlt -> nur Text */ }
    const ta = a * seg(t, 0.75, 0.35);
    lines.forEach((l, i) => txt(ctx, l, x + 44, top + (lines.length > 1 ? 12 : 14) + size + 2 + i * lh - (size < 40 ? 1 : 0), { size, weight: 700, font: F_HEAD, ls: 2, color: COL.white, alpha: ta }));
    ctx.restore();
  }

  function draw(ctx, p) {
    const t = Math.max(0, Number(p.t) || 0);
    const d = Math.max(1, Number(p.d) || 8);
    const M = getModel(p.params);
    const G = getGeom(ctx, M);
    const { PL, PT: pT, PB: pB } = G; const pR = G.PR;
    const cT = (v) => clamp(v, 0.3, Math.max(0.3, d - 0.3));
    const fin = Number.isFinite;
    // carry_in: Elemente ohne eigenes at (oder at <= 0,3 s) stehen ab t = 0 fertig da; negatives at = so viele Sekunden
    // vor Szenenbeginn erschienen (nur für die Phase von Blinken/Ringen/Lichtstreifen). tA = Umgebungszeit (Staub,
    // Strichfluss, Pulse), mit Zahl in carry_in um die Dauer der Vorszene versetzt -> nahtlos über die Überblendung.
    const CI = !!M.carry;
    const tA = t + (CI ? M.carry.t0 : 0);
    const CARRY_AGE = 3;
    const carriedAt = (at) => CI && (!fin(at) || at <= 0.3);
    const lifeStart = (at) => (fin(at) && at < 0 ? at : -CARRY_AGE);

    // ---- Phasen (BEATS bzw. relativ zu d) ----
    const B = M.beats || [];
    const introDur = clamp(0.1 * d, 0.45, 1.2);
    const drawStart = fin(B[0]) ? cT(B[0]) : clamp(0.1 * d, 0.4, 1.4);
    let drawEnd;
    if (fin(B[1])) drawEnd = cT(B[1]);
    else { drawEnd = Math.max(drawStart + 1.0, 0.7 * d); if (fin(B[0]) && drawEnd > d - 0.3) drawEnd = Math.max(drawStart + 0.4, d - 0.3); }
    if (drawEnd < drawStart + 0.2) drawEnd = drawStart + 0.2;
    const annDur = clamp(0.08 * d, 0.35, 0.75);
    const segT = G.series.map((s) => {
      const own = fin(s.at);
      if (carriedAt(s.at)) {
        const t1c = fin(s.end) && s.end < 0 ? s.end : -CARRY_AGE;
        const xa = own ? s.x0 : G.dx0, xb = own ? s.x1 : G.dx1;
        return { t0: t1c - 0.5, t1: t1c, xs: G.ddir > 0 ? xa : xb, xe: G.ddir > 0 ? xb : xa, carried: true };
      }
      const t0 = own ? cT(s.at) : drawStart;
      let t1 = fin(s.end) ? cT(s.end) : fin(s.dur) ? t0 + Math.max(0.2, s.dur) : own ? t0 + (drawEnd - drawStart) : drawEnd;
      if (!fin(s.end) && own && t1 > d - 0.3) t1 = Math.max(t0 + 0.3, d - 0.3);
      if (t1 < t0 + 0.2) t1 = t0 + 0.2;
      const xa = own ? s.x0 : G.dx0, xb = own ? s.x1 : G.dx1;
      return { t0, t1, xs: G.ddir > 0 ? xa : xb, xe: G.ddir > 0 ? xb : xa };
    });
    const progF = (u) => 0.72 * u + 0.28 * sm(u);
    const headOf = (si, tt) => { const T = segT[si]; return tt >= T.t1 ? T.xe : lerp(T.xs, T.xe, progF(seg(tt, T.t0, T.t1 - T.t0))); };
    const passTime = (si, x) => {
      const T = segT[si] || segT[0]; const span = T.xe - T.xs;
      if (Math.abs(span) < 1e-12) return T.t0;
      const target = (x - T.xs) / span;
      if (target <= 1e-9) return T.t0;
      if (target >= 1 - 1e-9) return T.t1;
      let lo = 0, hi = 1;
      for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2; if (progF(m) < target) lo = m; else hi = m; }
      return T.t0 + ((lo + hi) / 2) * (T.t1 - T.t0);
    };
    const T0 = segT[0];
    const allDone = segT.every((T) => t >= T.t1);
    const tAllDone = segT.reduce((m, T) => Math.max(m, T.t1), 0);

    // ---- Panel + Staub ----
    const panelA = CI ? 1 : eo(seg(t, 0, Math.min(0.35, introDur * 0.6)));
    drawBackdrop(ctx, p, panelA);
    drawPanel(ctx, tA, panelA);
    drawDust(ctx, tA, panelA);

    // Einfahr-Fortschritt der Grenzlinien (auch für zusammenfallende Band-Kanten)
    const refCar = G.refs.map((r) => carriedAt(r.at));
    const refTr = G.refs.map((r, i) => (refCar[i] ? -CARRY_AGE : fin(r.at) ? cT(r.at) : introDur * 0.6 + i * 0.12));
    const refK = refTr.map((tr) => eo(seg(t, tr, 0.7)));

    // ---- y-Bänder (hinter Raster und Kurve) ----
    const bandCar = G.ybands.map((b) => carriedAt(b.at));
    const bandTb = G.ybands.map((b, bi) => (bandCar[bi] ? lifeStart(b.at) : fin(b.at) ? cT(b.at) : introDur * 0.6 + 0.1 + bi * 0.15));
    G.ybands.forEach((b, bi) => {
      const tb = bandTb[bi];
      const k = bandCar[bi] ? 1 : eo(seg(t, tb, 0.75)); if (k <= 0) return;
      const wv = (pR - PL) * k, xa = G.sdir > 0 ? PL : pR - wv;
      const hB = b.pyBot - b.pyTop;
      const breathe = 0.85 + 0.15 * Math.sin(tA * 1.7 + bi * 1.3);
      ctx.save();
      ctx.fillStyle = rgba(b.color, 0.07 * breathe); ctx.fillRect(xa, b.pyTop, wv, hB);
      // weiche Innenkanten
      const eh = Math.min(22, hB / 2);
      let gr = ctx.createLinearGradient(0, b.pyTop, 0, b.pyTop + eh); gr.addColorStop(0, rgba(b.color, 0.13)); gr.addColorStop(1, rgba(b.color, 0));
      ctx.fillStyle = gr; ctx.fillRect(xa, b.pyTop, wv, eh);
      gr = ctx.createLinearGradient(0, b.pyBot - eh, 0, b.pyBot); gr.addColorStop(0, rgba(b.color, 0)); gr.addColorStop(1, rgba(b.color, 0.13));
      ctx.fillStyle = gr; ctx.fillRect(xa, b.pyBot - eh, wv, eh);
      // Schraffur (langsam wandernd)
      ctx.beginPath(); ctx.rect(xa, b.pyTop, wv, hB); ctx.clip();
      ctx.globalAlpha = 0.06; ctx.strokeStyle = b.color; ctx.lineWidth = 1; ctx.beginPath();
      const off = (tA * 9) % 26;
      for (let xx = xa - hB + off; xx < xa + wv; xx += 26) { ctx.moveTo(xx, b.pyBot); ctx.lineTo(xx + hB, b.pyTop); }
      ctx.stroke();
      // Lichtstreifen, der regelmäßig durch das Band wandert
      if (k >= 1) {
        const per = 3.6, ph = ((t - tb) % per) / per;
        if (ph < 0.55) {
          const cx = G.sdir > 0 ? lerp(PL - 80, pR + 80, ph / 0.55) : lerp(pR + 80, PL - 80, ph / 0.55);
          const g2 = ctx.createLinearGradient(cx - 70, 0, cx + 70, 0);
          g2.addColorStop(0, rgba(b.color, 0)); g2.addColorStop(0.5, rgba(b.color, 0.1)); g2.addColorStop(1, rgba(b.color, 0));
          ctx.globalAlpha = 1; ctx.fillStyle = g2; ctx.fillRect(cx - 70, b.pyTop, 140, hB);
        }
      }
      ctx.restore();
      const edge = (py, ri) => {
        let e0 = xa, e1 = xa + wv;
        if (ri >= 0) { // von der gleichliegenden Grenzlinie bereits überdeckten Teil auslassen
          const wr = (pR - PL) * refK[ri];
          if (G.sdir > 0) e0 = Math.max(e0, PL + wr); else e1 = Math.min(e1, pR - wr);
        }
        if (e1 > e0 + 0.5) line(ctx, e0, py, e1, py, b.color, 1.5, 0.5, 0.6);
      };
      if (b.edgeTop) edge(b.pyTop, b.edgeTopRef);
      if (b.edgeBot) edge(b.pyBot, b.edgeBotRef);
    });

    // ---- x-Bereiche (hinter dem Raster) ----
    const revealOf = () => {
      if (t < T0.t0) return null;
      const a = G.sx(T0.xs), h = G.sx(headOf(0, t));
      return [Math.min(a, h), Math.max(a, h)];
    };
    const rev0 = revealOf();
    for (const z of G.zones) {
      let va, vb, fa, ca;
      if (carriedAt(z.at)) { va = z.zx0; vb = z.zx1; fa = 1; ca = 1; }
      else if (fin(z.at)) {
        const tz = cT(z.at); const k = eo(seg(t, tz, 0.6)); if (k <= 0) continue;
        const wz = (z.zx1 - z.zx0) * k;
        if (G.sdir > 0) { va = z.zx0; vb = z.zx0 + wz; } else { va = z.zx1 - wz; vb = z.zx1; }
        fa = eo(seg(t, tz, 0.3)); ca = sm(seg(t, tz + 0.3, 0.4));
      } else {
        if (!rev0) continue;
        va = Math.max(z.zx0, rev0[0]); vb = Math.min(z.zx1, rev0[1]);
        const edge = G.ddir > 0 ? z.x0 : z.x1;
        fa = eo(seg(t, passTime(0, edge), 0.35));
        ca = eo(seg(t, passTime(0, (z.x0 + z.x1) / 2) - 0.1, 0.35)) * fa;
      }
      if (vb <= va + 0.5) continue;
      ctx.save(); ctx.globalAlpha = fa;
      ctx.fillStyle = rgba(z.color, 0.035); ctx.fillRect(va, pT, vb - va, pB - pT);
      const gr = ctx.createLinearGradient(0, pB - 70, 0, pB);
      gr.addColorStop(0, rgba(z.color, 0)); gr.addColorStop(1, rgba(z.color, 0.12));
      ctx.fillStyle = gr; ctx.fillRect(va, pB - 70, vb - va, 70);
      ctx.restore();
      line(ctx, va, pB - 6, vb, pB - 6, z.color, 2, 0, 0.6 * fa);
      if (z.cap) txt(ctx, z.label, z.cap.x, z.cap.y, { size: z.cap.size, weight: 700, color: mix(z.color, "#ffffff", 0.25), alpha: ca * 0.85, align: "center", ls: 2 });
    }

    // ---- Raster, Achsen, Ticks ----
    const ax = CI ? 1 : eo(seg(t, 0.05, introDur));
    const ay = CI ? 1 : eo(seg(t, 0.12, introDur));
    ctx.save();
    ctx.lineWidth = 1;
    G.yGrid.forEach((v, i) => {
      const py = Math.round(G.sy(v)) + 0.5; const k = CI ? 1 : sm(seg(t, 0.15 + i * 0.05, 0.4));
      if (k <= 0) return;
      ctx.globalAlpha = k;
      ctx.strokeStyle = Math.abs(v - M.yMin) < 1e-12 ? "rgba(143,179,217,0)" : "rgba(143,179,217,0.15)";
      ctx.beginPath(); ctx.moveTo(PL, py); ctx.lineTo(PL + (pR - PL) * k, py); ctx.stroke();
      if (i < G.yGrid.length - 1) {
        const pm = Math.round(G.sy(v + G.yStep / 2)) + 0.5;
        ctx.strokeStyle = "rgba(143,179,217,0.055)"; ctx.beginPath(); ctx.moveTo(PL, pm); ctx.lineTo(PL + (pR - PL) * k, pm); ctx.stroke();
      }
    });
    G.xGrid.forEach((v, i) => {
      const px = Math.round(G.sx(v)) + 0.5; const k = CI ? 1 : sm(seg(t, 0.2 + i * 0.04, 0.4));
      if (k <= 0 || px < PL + 2) return;
      ctx.globalAlpha = k; ctx.strokeStyle = "rgba(143,179,217,0.075)";
      ctx.beginPath(); ctx.moveTo(px, pB); ctx.lineTo(px, pB - (pB - pT) * k); ctx.stroke();
    });
    ctx.restore();
    // Achsen
    const axisCol = "#a9c9ea";
    line(ctx, PL, pB, PL + (pR - PL + 14) * ax, pB, axisCol, 2, 0, ax > 0 ? 0.95 : 0);
    line(ctx, PL, pB, PL, pB - (pB - pT + 14) * ay, axisCol, 2, 0, ay > 0 ? 0.95 : 0);
    if (ax > 0.98 && !G.xr) { ctx.save(); ctx.fillStyle = axisCol; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.moveTo(pR + 24, pB); ctx.lineTo(pR + 12, pB - 6); ctx.lineTo(pR + 12, pB + 6); ctx.closePath(); ctx.fill(); ctx.restore(); }
    if (ay > 0.98) { ctx.save(); ctx.fillStyle = axisCol; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.moveTo(PL, pT - 24); ctx.lineTo(PL - 6, pT - 12); ctx.lineTo(PL + 6, pT - 12); ctx.closePath(); ctx.fill(); ctx.restore(); }
    // Ticks + Beschriftung
    ctx.save(); ctx.strokeStyle = axisCol; ctx.lineWidth = 1.5;
    if (G.YO.marks || G.YO.labels) G.yTicks.forEach((v, i) => {
      const k = CI ? 1 : sm(seg(t, 0.25 + i * 0.05, 0.35)); if (k <= 0) return;
      const py = G.sy(v); ctx.globalAlpha = k;
      if (G.YO.marks) { ctx.beginPath(); ctx.moveTo(PL - 8, py); ctx.lineTo(PL, py); ctx.stroke(); }
      if (G.YO.labels) txt(ctx, G.yLabels[i], PL - 16, py + 8, { size: 22, weight: 400, font: F_MONO, color: COL.muted, align: "right", alpha: k });
    });
    // x: Haupt- und Nebenteilung
    const minorN = G.xCustom ? 0 : [1, 2, 5].includes(Math.round(G.xStep / Math.pow(10, Math.floor(Math.log10(G.xStep))))) ? 5 : 4;
    if (G.XO.marks || G.XO.labels) G.xTicks.forEach((v, i) => {
      const k = CI ? 1 : sm(seg(t, 0.3 + i * 0.04, 0.35)); if (k <= 0) return;
      const px = G.sx(v); ctx.globalAlpha = k;
      if (G.XO.marks) { ctx.beginPath(); ctx.moveTo(px, pB); ctx.lineTo(px, pB + 9); ctx.stroke(); }
      if (G.XO.labels) txt(ctx, G.xLabels[i], px, XTICK_Y, { size: 22, weight: 400, font: F_MONO, color: COL.muted, align: "center", alpha: k });
      if (G.XO.marks && minorN) {
        ctx.globalAlpha = k * 0.6; ctx.lineWidth = 1;
        for (let m = 1; m < minorN; m++) { const xv = v + (G.xStep * m) / minorN; if (xv > M.xMax + 1e-9) break; const mx = G.sx(xv); ctx.beginPath(); ctx.moveTo(mx, pB); ctx.lineTo(mx, pB + 4); ctx.stroke(); }
        ctx.lineWidth = 1.5;
      }
    });
    ctx.restore();

    // ---- Achsenbeschriftungen, Titel, Legende ----
    const labA = CI ? 1 : sm(seg(t, introDur * 0.5, 0.5));
    if (M.yLabel) txt(ctx, M.yLabel, G.ylabX, YLAB_Y, { size: 23, weight: 600, color: COL.muted, alpha: labA, ls: 0.3 });
    if (M.xLabel) {
      txt(ctx, M.xLabel, pR + 24, XLAB_Y, { size: 23, weight: 600, color: COL.muted, alpha: labA, align: "right", ls: 0.3 });
      if (G.xr) {
        // umgekehrte Achse: Pfeil „wächst nach links“ vor der Beschriftung
        const lw = measure(ctx, M.xLabel, 600, 23, F_BODY, 0.3); const ex = pR + 24 - lw - 14, yy = XLAB_Y - 8;
        line(ctx, ex - 26, yy, ex, yy, axisCol, 2, 0, labA * 0.9);
        ctx.save(); ctx.globalAlpha = labA * 0.9; ctx.fillStyle = axisCol; ctx.beginPath(); ctx.moveTo(ex - 34, yy); ctx.lineTo(ex - 22, yy - 6); ctx.lineTo(ex - 22, yy + 6); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
    const HD = G.header;
    if (HD.title.lines.length) {
      const ta = CI ? 1 : sm(seg(t, 0.1, 0.55)); const slide = CI ? 0 : (1 - eo(seg(t, 0.1, 0.7))) * -18;
      const nl = HD.title.lines.length, sz = HD.title.size, lh = Math.round(sz * 1.14);
      const lastY = nl > 1 ? TITLE_Y + 12 : TITLE_Y;
      HD.title.lines.forEach((l, i) => txt(ctx, l, IN_L + slide, lastY - (nl - 1 - i) * lh, { size: sz, weight: 700, font: F_HEAD, color: COL.white, alpha: ta, ls: 2, glow: 12, glowColor: rgba(COL.cyan, 0.7) }));
      const ul = CI ? 1 : eo(seg(t, 0.35, 0.8)); const uy = lastY + 14;
      ctx.save(); ctx.globalAlpha = ta; ctx.fillStyle = COL.amber; ctx.fillRect(IN_L, uy, 64 * ul, 3); ctx.fillStyle = rgba(COL.cyan, 0.35); ctx.fillRect(IN_L + 70 * ul, uy + 1, Math.max(0, (Math.min(HD.title.w, 520) - 70) * ul), 1); ctx.restore();
    }
    HD.rows.forEach((row, ri) => {
      if (!row.length) return;
      let x = pR + 24; const y = ri === 0 ? TITLE_Y - 9 : YLAB_Y - 8;
      for (let j = row.length - 1; j >= 0; j--) {
        const it = row[j];
        const k = carriedAt(it.at) ? 1 : fin(it.at) ? sm(seg(t, cT(it.at) - 0.1, 0.5)) : sm(seg(t, 0.35 + (ri * 3 + j) * 0.08, 0.5));
        x -= it.w;
        const pulse = 0.75 + 0.25 * Math.sin(tA * 2.4 + j + ri);
        line(ctx, x, y, x + 30, y, it.color, 3.5, 0.8, k);
        dot(ctx, x + 30, y, 12, it.color, k * pulse);
        disc(ctx, x + 30, y, 3.5, "#ffffff", k);
        txt(ctx, it.name, x + 44, y + Math.round(HD.lf * 0.35), { size: HD.lf, weight: 600, color: COL.white, alpha: k * 0.92 });
        x -= 34;
      }
    });

    // ---- Referenzlinien ----
    G.refs.forEach((r, i) => {
      const tr = refTr[i];
      const k = refK[i]; if (k <= 0) return;
      const wr = (pR - PL) * k;
      if (G.sdir > 0) line(ctx, PL, r.py, PL + wr, r.py, r.color, 1.6, 0, 0.6, [10, 9], -tA * 10);
      else line(ctx, pR - wr, r.py, pR, r.py, r.color, 1.6, 0, 0.6, [10, 9], tA * 10);
      if (fin(r.at) && !refCar[i]) { const fl = 1 - seg(t, tr, 0.9); if (fl > 0) line(ctx, PL, r.py, pR, r.py, r.color, 2.4, 1, 0.35 * fl * k); }
      const b = r.box;
      txt(ctx, r.label, r.align === "right" ? b.x + b.w - 4 : b.x + 4, b.y + 18, { size: 19, weight: 600, color: mix(r.color, "#ffffff", 0.15), alpha: sm(seg(k, 0.6, 0.4)) * 0.9, align: r.align, ls: 0.5, stroke: 5 });
    });

    // ---- y-Band-Beschriftungen ----
    G.ybands.forEach((b, bi) => {
      if (!b.cap) return;
      const ka = bandCar[bi] ? 1 : sm(seg(t, bandTb[bi] + 0.35, 0.45)); if (ka <= 0) return;
      const c = b.cap;
      txt(ctx, c.label, c.box.x + 4, c.box.y + c.box.h - 7, { size: c.size, weight: 700, color: mix(b.color, "#ffffff", 0.3), alpha: ka * 0.92, ls: 2, stroke: 4 });
    });

    // ---- Markierungslinien der Annotationen (hinter der Kurve) ----
    const annState = G.anns.map((a) => {
      const own = fin(a.at);
      const T = segT[a.si] || T0;
      const car = CI && (own ? a.at <= 0.3 : !!T.carried);
      const tp = car ? lifeStart(a.at) : own ? cT(a.at) : passTime(a.si, a.x);
      const lt = t - tp;
      return { a, tp, lt, on: lt >= 0 && (car || own || t >= T.t0) };
    });
    for (const s of annState) {
      if (!s.on) continue;
      const a = s.a; const k = eo(seg(s.lt, 0, annDur * 0.7));
      const up = lerp(a.py, pT - 4, k), dn = lerp(a.py, pB, k);
      const bl = a.blink && s.lt > 0.5 ? 0.55 + 0.45 * (0.5 + 0.5 * Math.cos((s.lt - 0.5) * Math.PI * 2.6)) : 1;
      line(ctx, a.px, up, a.px, dn, a.color, 1.8, 0, 0.8 * bl, [7, 7], -tA * 12);
    }

    // ---- Kurven ----
    const anyVisible = segT.some((T) => t >= T.t0);
    const heads = G.series.map(() => null);
    if (anyVisible) {
      ctx.save();
      ctx.beginPath(); ctx.rect(PL - 8, pT - 14, pR - PL + 22, pB - pT + 20); ctx.clip();
      G.series.forEach((s, si) => {
        const T = segT[si]; if (t < T.t0) return;
        const sDone = t >= T.t1;
        const part = partial(s, headOf(si, t), G); if (!part || part.pts.length < 1) return;
        const pts = part.pts;
        if (M.fill && si === 0 && pts.length > 1) {
          ctx.save();
          const gr = ctx.createLinearGradient(0, pT, 0, G.base);
          gr.addColorStop(0, rgba(s.color, 0.26)); gr.addColorStop(1, rgba(s.color, 0.02));
          ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(pts[0][0], G.base);
          for (const q of pts) ctx.lineTo(q[0], q[1]);
          ctx.lineTo(pts[pts.length - 1][0], G.base); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        if (pts.length > 1) {
          glowStroke(ctx, (c) => { c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); }, s.color, si === 0 ? 4.2 : 3.4, 1, 1);
          if (!sDone) {
            // helle Kern-Spur am Kopf (Kometenschweif)
            const hxp = part.head[0]; const tail = [];
            for (let i = pts.length - 1; i >= 0; i--) { tail.unshift(pts[i]); if (Math.abs(hxp - pts[i][0]) > 120) break; }
            if (tail.length > 1) {
              ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
              const x0g = tail[0][0], x1g = Math.abs(hxp - x0g) < 0.5 ? x0g + 0.5 * (G.sdir || 1) : hxp;
              const gr = ctx.createLinearGradient(x0g, 0, x1g, 0);
              gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(255,255,255,0.85)");
              ctx.strokeStyle = gr; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tail[0][0], tail[0][1]); for (let i = 1; i < tail.length; i++) ctx.lineTo(tail[i][0], tail[i][1]); ctx.stroke();
              ctx.restore();
            }
          }
        }
        heads[si] = { x: part.head[0], y: part.head[1], v: part.headY, color: s.color, done: sDone };
      });
      ctx.restore();

      // Lichtimpuls über die fertige Kurve (Haltephase)
      if (allDone) {
        const per = clamp(0.22 * d, 1.8, 3.2), trav = per * 0.6;
        const ph = ((t - tAllDone) % per) / trav;
        if (ph < 1) {
          const xsG = G.ddir > 0 ? G.dx0 : G.dx1, xeG = G.ddir > 0 ? G.dx1 : G.dx0;
          const xd = lerp(xsG, xeG, sm(ph));
          G.series.forEach((s, si) => {
            if (xd < s.x0 || xd > s.x1) return;
            const px = G.sx(xd), py = G.sy(clamp(interpY(s.pts, xd), M.yMin, M.yMax));
            const al = Math.sin(Math.PI * ph) * (si === 0 ? 0.9 : 0.6);
            dot(ctx, px, py, 26, s.color, al * 0.8); disc(ctx, px, py, 3, "#ffffff", al);
          });
        }
      }
    }

    // ---- Annotations-Punkte (Ring-Puls beim Erscheinen) ----
    for (const s of annState) {
      if (!s.on) continue;
      const a = s.a; const lt = s.lt;
      const pop = eob(seg(lt, 0, 0.35));
      const breathe = a.blink ? 0.45 + 0.55 * (0.5 + 0.5 * Math.cos(lt * Math.PI * 2.6)) : 0.8 + 0.2 * Math.sin(tA * 2.2 + a.x * 7);
      dot(ctx, a.px, a.py, (a.blink ? 30 : 22) * pop, a.color, (a.blink ? 0.75 : 0.55) * breathe);
      const fl = 1 - seg(lt, 0, 0.45);
      if (fl > 0) { dot(ctx, a.px, a.py, 60 * (0.6 + 0.4 * fl), a.color, fl * 0.75); }
      const ringK = seg(lt, 0, 0.8);
      if (ringK < 1) { ctx.save(); ctx.globalAlpha = (1 - ringK) * 0.9; ctx.strokeStyle = a.color; ctx.lineWidth = 2.5 * (1 - ringK) + 0.5; ctx.beginPath(); ctx.arc(a.px, a.py, 8 + 44 * eo(ringK), 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      const perR = a.blink ? 0.77 : 2.6;
      const rep = (Math.max(0, lt - 0.8) % perR) / perR;
      if (lt > 0.8) { ctx.save(); ctx.globalAlpha = (1 - rep) * (a.blink ? 0.75 : 0.35); ctx.strokeStyle = a.color; ctx.lineWidth = a.blink ? 2 : 1.2; ctx.beginPath(); ctx.arc(a.px, a.py, 8 + (a.blink ? 30 : 22) * rep, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      disc(ctx, a.px, a.py, 6 * pop, a.color, 1);
      disc(ctx, a.px, a.py, 2.6 * pop, "#ffffff", 1);
    }

    // ---- Kurvenköpfe ----
    heads.forEach((h, si) => {
      if (!h) return;
      const pul = 0.8 + 0.2 * Math.sin(tA * 6 + si);
      const endK = h.done ? 0.75 + 0.25 * Math.sin(tA * 2.6 + si) : 1;
      if (!h.done) dot(ctx, h.x, h.y, 78 * pul, h.color, 0.22);
      dot(ctx, h.x, h.y, (h.done ? 26 : 34) * pul, h.color, 0.9 * endK);
      disc(ctx, h.x, h.y, 7, h.color, 1);
      disc(ctx, h.x, h.y, 3.8, "#ffffff", 1);
      if (!h.done) { ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = h.color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(h.x, h.y, 12 + 3 * Math.sin(t * 8), 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    });

    // ---- Cursor + Live-Messwerte an den Kurvenköpfen (max. 3 Serien) ----
    if (M.readout && heads[0]) {
      const RO = G.series.slice(0, 3);
      const decR = G.yStep >= 10 ? 0 : Math.min(3, G.yDec + 1 + (G.yStep >= 1 && G.yStep <= 2 && M.yMax - M.yMin <= 12 ? 1 : 0));
      const unit = M.yUnit ? " " + M.yUnit : "";
      const ph = heads[0];
      const drawing0 = t >= T0.t0 && t < T0.t1;
      const curA = drawing0 ? 1 : 1 - seg(t, T0.t1, 0.5);
      if (curA > 0) {
        line(ctx, ph.x, ph.y + 14, ph.x, pB, ph.color, 1.2, 0, 0.35 * curA, [3, 5], 0);
        ctx.save(); ctx.globalAlpha = curA; ctx.fillStyle = ph.color; ctx.beginPath(); ctx.moveTo(ph.x, pB - 1); ctx.lineTo(ph.x - 6, pB + 8); ctx.lineTo(ph.x + 6, pB + 8); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      const labels = RO.map((s, i) => (heads[i] ? `${fmt(heads[i].v, decR)}${unit}` : ""));
      const bws = labels.map((l) => (l ? measure(ctx, l, 700, 24, F_MONO) + 22 : 0)), bh = 34;
      const staticBoxes = G.refs.map((r) => r.box);
      // Plätze um die Köpfe wählen (frei von Labels, Kurven, anderen Messwerten), über die letzten Zeitpunkte geglättet
      const placeAt = (tt) => {
        const boxes = [];
        for (const st of annState) if (st.a.box && tt >= st.tp) boxes.push(st.a.box);
        if (G.inset) boxes.push(G.inset.box);
        const outs = [];
        RO.forEach((s, i) => {
          const bw = bws[i]; const T = segT[i];
          if (!bw || tt < T.t0) { outs.push(null); return; }
          const hxT = headOf(i, tt);
          if ((hxT - s.ordPts[0][0]) * G.ddir < 0) { outs.push(null); return; }
          const xd = clamp(hxT, s.x0, s.x1);
          const hpx = G.sx(xd), hpy = G.sy(clamp(interpY(s.pts, xd), M.yMin, M.yMax));
          const sa = G.sx(T.xs), lo = Math.min(sa, hpx) - 1, hi = Math.max(sa, hpx) + 1;
          const cands = [[16, -bh - 16], [-bw - 16, -bh - 16], [16, 16], [-bw - 16, 16], [-bw / 2, -bh - 26], [-bw / 2, 24], [22, -bh / 2], [-bw - 22, -bh / 2]];
          if (G.sdir < 0) for (const c of cands) c[0] = -bw - c[0]; // Messwert vor dem Kopf (in Zeichenrichtung) bevorzugen
          let pickC = cands[0], bestP = Infinity;
          for (let ci = 0; ci < cands.length; ci++) {
            const c = cands[ci];
            const r = { x: hpx + c[0], y: hpy + c[1], w: bw, h: bh };
            let pen = ci * 0.1;
            if (r.x < PL + 4 || r.x + r.w > pR + 30 || r.y < pT - 10 || r.y + r.h > pB - 4) pen += 100;
            for (const b of boxes) if (rectsHit(b, r, 6)) pen += 10;
            for (const b of staticBoxes) if (rectsHit(b, r, 4)) pen += 2;
            if (G.curveHits(r, lo, hi)) pen += 3;
            if (pen < bestP) { bestP = pen; pickC = c; }
            if (pen < 1) break;
          }
          boxes.push({ x: hpx + pickC[0], y: hpy + pickC[1], w: bw, h: bh });
          outs.push(pickC);
        });
        return outs;
      };
      const acc = RO.map(() => [0, 0, 0]);
      for (let k = 0; k < 6; k++) {
        const w = 6 - k; const outs = placeAt(Math.max(T0.t0, t - k * 0.06));
        outs.forEach((c, i) => { if (c) { acc[i][0] += c[0] * w; acc[i][1] += c[1] * w; acc[i][2] += w; } });
      }
      const roA = sm(seg(t, T0.t0, 0.3));
      RO.forEach((s, i) => {
        const h = heads[i];
        if (!h || roA <= 0.004 || !acc[i][2]) return;
        const bw = bws[i];
        const bx = clamp(h.x + acc[i][0] / acc[i][2], PL + 4, pR + 30 - bw), by = clamp(h.y + acc[i][1] / acc[i][2], pT - 10, pB - 4 - bh);
        ctx.save(); ctx.globalAlpha = roA;
        ctx.fillStyle = "rgba(3,10,22,0.88)"; ctx.beginPath(); rrect(ctx, bx, by, bw, bh, 5); ctx.fill();
        ctx.strokeStyle = rgba(s.color, 0.7); ctx.lineWidth = 1.3; ctx.beginPath(); rrect(ctx, bx + 0.5, by + 0.5, bw - 1, bh - 1, 5); ctx.stroke();
        ctx.restore();
        txt(ctx, labels[i], bx + bw / 2, by + 25, { size: 24, weight: 700, font: F_MONO, color: mix(s.color, "#ffffff", 0.35), align: "center", alpha: roA });
      });
    }

    // ---- Maßstabs-Inset ----
    if (G.inset) {
      const S = M.inset;
      const carI = carriedAt(S.at);
      const tI = carI ? lifeStart(S.at) - 2 : fin(S.at) ? cT(S.at) : cT(Math.max(drawStart + 0.5, 0.45 * d));
      const fI = carI ? 1 : clamp((d - 0.1 - tI) / 1.5, 0.25, 1);
      const tV = carI ? (fin(S.valueAt) && S.valueAt > 0.3 ? cT(S.valueAt) : tI) : fin(S.valueAt) ? cT(S.valueAt) : Math.min(tI + 1.2 * fI, Math.max(tI, d - 0.3));
      drawInset(ctx, G, t, tI, tV, fI);
    }

    // ---- Annotations-Labels (oben) ----
    for (const s of annState) {
      if (!s.on || !s.a.box) continue;
      const k = seg(s.lt, annDur * 0.15, annDur * 0.6);
      const ta = sm(seg(s.lt, annDur * 0.28, annDur * 0.45));
      const subK = fin(s.a.subAt) ? sm(seg(t, Math.max(cT(s.a.subAt), s.tp + annDur * 0.5), 0.4)) : 1;
      drawLabelBox(ctx, s.a, k, ta, subK);
    }

    // ---- Fußnote ----
    if (G.foot) {
      const F = G.foot;
      const fa = carriedAt(M.footnote.at) ? 1 : sm(seg(t, fin(M.footnote.at) ? cT(M.footnote.at) : Math.max(introDur, drawStart) + 0.15, 0.5));
      if (fa > 0) {
        ctx.save(); ctx.globalAlpha = fa; ctx.fillStyle = COL.amber;
        ctx.fillRect(F.x - 14, F.y0 - F.size * 0.78, 3, F.size * 0.95 + (F.lines.length - 1) * F.lh); ctx.restore();
        F.lines.forEach((l, i) => txt(ctx, l, F.x, F.y0 + i * F.lh, { size: F.size, weight: 400, color: F.color, alpha: fa * 0.95, ls: 0.2 }));
      }
    }
  }

  CEX.register("graph", {
    background: false,
    draw(ctx, p) {
      try { draw(ctx, p); } catch (e) { /* nie werfen – Rest der Szene bleibt stehen */ }
      try { drawOverlay(ctx, p); } catch (e) { /* ignorieren */ }
    },
    ownsText: true,
  });
})();
