/* Template „myth_card“ – Mythos-Check im Stil „Visual Science“ (ownsText).
   Aufbau: Prüfkarte (Blueprint-Panel) mit Kopfzeile „MYTHOS“ (Amber, Mono) und Prüfstatus,
   die Behauptung wird in großen deutschen Anführungszeichen „…“ eingetippt, ein Prüf-Fadenkreuz
   analysiert, dann knallt ein Gummistempel (FALSCH rot / STIMMT grün / TEILWEISE amber) mit Drehung,
   Kamera-Stoß, Schockwelle und Tintenspritzern auf die Karte. Danach blendet die Erklärung („FAKT“) ein.

   params:
     myth         Behauptung (Deutsch). Fehlt sie, wird p.text verwendet.
                  (Aliase: claim, mythos, statement, behauptung, quote, title)
     verdict      FALSCH | STIMMT | TEILWEISE (Standard FALSCH). Auch true/false, richtig/wahr, teils/bedingt …
                  (Aliase: result, urteil, ergebnis, status, answer, stamp)
     explanation  kurze Erklärung (Deutsch), *Wort* = Amber-Akzent. Fehlt sie und ist myth gesetzt, wird p.text genutzt.
                  (Aliase: fact, fakt, erklaerung, erklärung, reason, detail, body, subtitle)
     label        Kopfzeilen-Label, Standard „MYTHOS“ (Alias: kicker)
     number       optionale Nummer → „MYTHOS #2“ (Aliase: nr, index, no)
     factLabel    Label über der Erklärung, Standard „FAKT“ (Aliase: explanationLabel, factTitle)
     stampAt      Zeitpunkt des Stempel-Aufpralls: ≤ 1 = Anteil von d, sonst Sekunden (Alias: verdictAt)
     typeSpeed    Tippgeschwindigkeit in Zeichen/s (Standard 30) */
(function () {
  "use strict";
  const CEX = window.CE;
  if (!CEX || typeof CEX.register !== "function") return;

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const COL = {
    cyan: "#3fd2ff", amber: "#ffb347", red: "#ff5a5f", green: "#5be49b",
    white: "#eef6ff", muted: "#8fb3d9", steel: "#9fc4e6", body: "#d4e4f5",
  };
  const VERDICTS = {
    FALSCH: { key: "FALSCH", word: "FALSCH", color: COL.red, rgb: "255,90,95", status: "WIDERLEGT", rot: -11 },
    STIMMT: { key: "STIMMT", word: "STIMMT", color: COL.green, rgb: "91,228,155", status: "BESTÄTIGT", rot: -8 },
    TEILWEISE: { key: "TEILWEISE", word: "TEILWEISE", color: COL.amber, rgb: "255,179,71", status: "BEDINGT RICHTIG", rot: -9 },
  };
  const DEFAULT_MYTH = "Kurz vor dem Aufprall hochspringen rettet dich";
  const SCRAMBLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/+<>";
  const MYTH_FONT = { family: "Inter", weight: 800 };
  const EXPL_FONT = { family: "Inter", weight: 600 };
  const HEAD_FONT = "Oxanium";
  const MONO = "JetBrains Mono";

  // ---------------- kleine Helfer ----------------
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, dur) => clamp((t - a) / Math.max(1e-6, dur), 0, 1);
  const eo = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const ei = (x) => { x = clamp(x, 0, 1); return x * x * x; };
  const sm = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const h01 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const pick = (o, keys) => {
    if (!o || typeof o !== "object") return undefined;
    for (const k of keys) { const v = o[k]; if (v !== undefined && v !== null && v !== "") return v; }
    return undefined;
  };
  const str = (v) => (v === undefined || v === null ? "" : String(v));
  const upper = (s) => { try { return String(s).toLocaleUpperCase("de-DE"); } catch (e) { return String(s).toUpperCase(); } };
  function setFont(ctx, weight, size, family, ls) {
    ctx.font = `${weight} ${Math.round(size * 10) / 10}px "${family}"`;
    try { ctx.letterSpacing = `${ls || 0}px`; } catch (e) { /* ältere Canvas-Implementierung */ }
  }
  function fontsReady() {
    try {
      return !!(document.fonts && document.fonts.check(`700 40px "${HEAD_FONT}"`) && document.fonts.check(`800 40px "Inter"`) && document.fonts.check(`700 40px "${MONO}"`));
    } catch (e) { return false; }
  }
  function rrPath(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  /** Glow-Pfad wie L.glowPath, aber mit Unterstützung für lineDashOffset. */
  function gpath(ctx, build, color, width, glow, o) {
    o = o || {}; const al = o.alpha ?? 1;
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = color;
    if (o.dash) { ctx.setLineDash(o.dash); ctx.lineDashOffset = o.dashOffset || 0; }
    if (glow > 0) {
      ctx.globalAlpha = al * 0.10 * glow; ctx.lineWidth = width * 7; ctx.beginPath(); build(ctx); ctx.stroke();
      ctx.globalAlpha = al * 0.22 * glow; ctx.lineWidth = width * 3.2; ctx.beginPath(); build(ctx); ctx.stroke();
    }
    ctx.globalAlpha = al; ctx.lineWidth = width; ctx.beginPath(); build(ctx); ctx.stroke();
    ctx.restore();
  }
  /** Anführungs-Komma in „9“-Form: Kopf (Radius r) bei 0,0, Schweif nach unten links. */
  function commaPath(c, r) {
    c.moveTo(r, 0);
    c.bezierCurveTo(r * 1.1, r * 1.35, r * 0.4, r * 2.25, -r * 0.72, r * 2.6);
    c.quadraticCurveTo(r * 0.1, r * 1.8, r * 0.02, r * 0.995);
    c.arc(0, 0, r, Math.atan2(0.995, 0.02), TAU, false);
    c.closePath();
  }
  const QGAP = 2.5; // Abstand der beiden Kommas in r
  const qWidth = (r) => r * (2 + QGAP);
  /** Deutsches Anführungszeichen als Vektor: kind "low" = „ (99, unten), "high" = “ (66, oben).
      x = linke Kante des Paars, y = Mittelpunkt der Köpfe. */
  function quoteMarks(ctx, x, y, r, kind, color, alpha, glow) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha; ctx.fillStyle = color;
    if (glow > 0) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
    ctx.beginPath();
    for (let i = 0; i < 2; i++) {
      ctx.save();
      ctx.translate(x + r + i * QGAP * r, y);
      if (kind === "high") ctx.rotate(Math.PI);
      commaPath(ctx, r);
      ctx.restore();
    }
    ctx.fill();
    ctx.restore();
  }
  function rgba(rgb, a) { return `rgba(${rgb},${clamp(a, 0, 1).toFixed(3)})`; }

  function parseVerdict(v) {
    if (v === true) return VERDICTS.STIMMT;
    if (v === false) return VERDICTS.FALSCH;
    const s = str(v).trim().toLowerCase();
    if (!s) return VERDICTS.FALSCH;
    if (/(nicht ganz|nicht immer|nur teil|nur bedingt)/.test(s)) return VERDICTS.TEILWEISE;
    if (/(nicht|falsch|false|wrong|nein|^no$|^0$|mythos|myth|unwahr|widerlegt|busted|irrtum)/.test(s)) return VERDICTS.FALSCH;
    if (/(teil|partial|halb|bedingt|jein|mixed|half|plausib|eher|manchmal|kommt drauf)/.test(s)) return VERDICTS.TEILWEISE;
    if (/(stimmt|richtig|wahr|true|^ja$|^yes$|^1$|korrekt|bestätigt|bestaetigt|correct|right|confirmed|fakt)/.test(s)) return VERDICTS.STIMMT;
    return VERDICTS.FALSCH;
  }
  function cleanMyth(s) {
    s = str(s).replace(/\*/g, "").replace(/\s+/g, " ").trim();
    const Q = /^[„“”"'‚‘’«»‹›\s]+|[„“”"'‚‘’«»‹›\s]+$/g;
    for (let i = 0; i < 3; i++) s = s.replace(Q, "").trim();
    return s;
  }
  /** Erklärung in Wörter mit Akzent-Markierung (*…*) zerlegen. */
  function tokenizeExpl(s) {
    s = str(s).replace(/\s+/g, " ").trim();
    const out = []; let accent = false;
    for (const raw of s.split(" ")) {
      if (!raw) continue;
      let w = raw; let acc = accent;
      if (w.startsWith("*")) { acc = true; accent = true; w = w.slice(1); }
      let closes = false;
      const m = w.match(/\*([^\wÄÖÜäöüß]*)$/);
      if (m) { w = w.slice(0, m.index) + m[1]; closes = true; }
      w = w.replace(/\*/g, "");
      if (w) out.push({ w, accent: acc });
      if (closes) accent = false;
    }
    // Zahl + Einheit nicht trennen („50 km/h“, „3,5 m/s“, „12 %“)
    const merged = [];
    for (let i = 0; i < out.length; i++) {
      const a = out[i], b = out[i + 1];
      if (b && /^[~≈<>+−-]?\d[\d.,]*$/.test(a.w) && b.w.length <= 6 && /^[%°‰a-zA-ZµΩ²³\/.,]+$/.test(b.w)) {
        merged.push({ w: a.w + "\u00a0" + b.w, accent: a.accent || b.accent }); i++;
      } else merged.push(a);
    }
    // „ca.“ / „etwa“ nicht vom folgenden Zahlenwert trennen
    const out2 = [];
    for (let i = 0; i < merged.length; i++) {
      const a = merged[i], b = merged[i + 1];
      if (b && /^(ca\.|ca|~|≈|je|rund|etwa)$/i.test(a.w) && /^[~≈<>+−-]?\d/.test(b.w)) {
        if (!a.accent === !b.accent) { out2.push({ w: a.w + "\u00a0" + b.w, accent: a.accent }); i++; }
        else out2.push({ ...a, glue: true }); // beim Umbruch mit dem Folgewort zusammenhalten
      } else out2.push(a);
    }
    return out2;
  }

  // ---------------- Layout (gecacht, rein aus Text + Schriften) ----------------
  const LAYOUTS = new Map();
  function wrapWords(ctx, words, maxW) {
    const lines = []; let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (cur && ctx.measureText(test).width > maxW) { lines.push(cur); cur = w; } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function computeLayout(ctx, S) {
    const hasExpl = S.explTokens.length > 0;
    const card = hasExpl ? { x: 170, y: 196, w: 1580, h: 676 } : { x: 170, y: 250, w: 1580, h: 560 };
    const cy0 = card.y, cy1 = card.y + card.h;
    const headY = cy0 + 66;
    const div1 = cy0 + 98;
    const textX = 300;

    // --- Erklärung (von unten nach oben) ---
    const E = { lines: [], size: 38, lh: 50, labelY: 0, divY: cy1 - 40, words: [] };
    if (hasExpl) {
      const maxW = 1380;
      let size = 38, lines = null;
      for (size = 38; size >= 26; size -= 2) {
        setFont(ctx, EXPL_FONT.weight, size, EXPL_FONT.family, 0);
        lines = wrapTokens(ctx, S.explTokens, maxW);
        if (lines.length <= 2) break;
        if (size <= 30 && lines.length <= 3) break;
      }
      setFont(ctx, EXPL_FONT.weight, size, EXPL_FONT.family, 0);
      if (!lines) lines = wrapTokens(ctx, S.explTokens, maxW);
      if (lines.length > 1 && lines.length <= 3) lines = balance(lines.length, (w) => wrapTokens(ctx, S.explTokens, w), maxW) || lines;
      if (lines.length > 3) { lines = lines.slice(0, 3); const last = lines[2]; if (last.length) last[last.length - 1] = { ...last[last.length - 1], w: last[last.length - 1].w.replace(/[.,;:]?$/, "…") }; }
      const lh = Math.round(size * 1.34);
      const lastBase = cy1 - 52;
      const firstBase = lastBase - (lines.length - 1) * lh;
      const space = ctx.measureText(" ").width;
      let idx = 0;
      const accW = (tk) => {
        if (!tk.accent) return ctx.measureText(tk.w).width;
        setFont(ctx, 800, size, EXPL_FONT.family, 0); const w = ctx.measureText(tk.w).width;
        setFont(ctx, EXPL_FONT.weight, size, EXPL_FONT.family, 0); return w;
      };
      lines.forEach((ln, li) => {
        let x = textX;
        for (const tk of ln) {
          const w = accW(tk);
          E.words.push({ w: tk.w, accent: tk.accent, x, y: firstBase + li * lh, idx: idx++ });
          x += w + space;
        }
      });
      E.size = size; E.lh = lh; E.lines = lines;
      E.labelY = firstBase - size - 24;
      E.divY = E.labelY - 40;
      E.firstBase = firstBase;
    }

    // --- Behauptung ---
    const regTop = div1 + 26, regBot = hasExpl ? E.divY - 26 : cy1 - 40;
    const regH = regBot - regTop;
    const words = S.myth.split(" ");
    // Umbruch inkl. Platz für das schließende “ hinter der letzten Zeile
    const qW = (sz) => sz * (0.12 + 0.2 * (2 + QGAP)) + 6;
    const wrapQ = (w, sz) => {
      let ls = wrapWords(ctx, words, w);
      const lastW = ctx.measureText(ls[ls.length - 1] || "").width;
      if (lastW + qW(sz) > w) ls = wrapWords(ctx, words, w - qW(sz));
      return ls;
    };
    const fit = (maxW) => {
      const sizes = [84, 78, 74, 68, 62, 56, 52, 48, 44, 40, 36];
      let size = 74, lines = [];
      for (let i = 0; i < sizes.length; i++) {
        size = sizes[i];
        setFont(ctx, MYTH_FONT.weight, size, MYTH_FONT.family, 0);
        lines = wrapQ(maxW, size);
        const bh = (lines.length - 1) * size * 1.2 + size * 0.98;
        // sehr große Schrift nur für kurze Behauptungen (mit Erklärung: max. 2 Zeilen)
        const maxL = size > 74 ? (hasExpl ? 2 : 3) : (size <= 48 ? 5 : 4);
        if (lines.length <= maxL && bh <= regH - 10) break;
      }
      setFont(ctx, MYTH_FONT.weight, size, MYTH_FONT.family, 0);
      if (lines.length > 1) lines = balance(lines.length, (w) => wrapQ(w, size), maxW) || lines;
      return { size, lines };
    };
    let textMaxW = 840, stamp = { cx: 1440, maxW: 530 };
    let F = fit(textMaxW);
    if (F.size < 56) { // lange Behauptung: breitere Textspalte, kompakterer Stempel
      textMaxW = 950; stamp = { cx: 1500, maxW: 450 };
      F = fit(textMaxW);
    }
    let size = F.size, lines = F.lines;
    setFont(ctx, MYTH_FONT.weight, size, MYTH_FONT.family, 0);
    const lh = Math.round(size * 1.2);
    const maxLines = Math.max(1, Math.floor((regH - size * 0.98) / lh) + 1);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/[\s.,;:!?]*$/, "") + "…"; }
    const blockH = (lines.length - 1) * lh + size * 0.98;
    const mid = (regTop + regBot) / 2;
    const firstBase = mid - blockH / 2 + size * 0.74;
    let start = 0;
    const M = { size, lh, lines: [], total: 0, x: textX, top: mid - blockH / 2, bottom: mid + blockH / 2, mid };
    lines.forEach((t, i) => {
      M.lines.push({ text: t, start, len: t.length, w: ctx.measureText(t).width, y: firstBase + i * lh });
      start += t.length;
    });
    M.total = start;
    // Präfixbreiten für Cursor/Frisch-Glow (pro Zeichen)
    for (const ln of M.lines) {
      ln.px = new Float32Array(ln.len + 1);
      for (let k = 1; k <= ln.len; k++) ln.px[k] = ctx.measureText(ln.text.slice(0, k)).width;
    }
    // Anführungszeichen „ “ (Vektor, groß)
    M.qr = Math.max(9, size * 0.2);

    // --- Stempel ---
    stamp.cy = M.mid;
    return { card, headY, div1, E, M, stamp, hasExpl };
  }
  /** Ausgeglichener Umbruch: kleinste Breite, die dieselbe Zeilenzahl liefert (keine Einzelwort-Waisen). */
  function balance(n, wrapFn, maxW) {
    if (n < 2) return null;
    let lo = maxW * 0.45, hi = maxW, best = null;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2; const ls = wrapFn(mid);
      if (ls.length <= n) { best = ls; hi = mid; } else lo = mid;
    }
    return best;
  }
  function wrapTokens(ctx, tokens, maxW) {
    const lines = []; let cur = []; let curW = 0; const sp = ctx.measureText(" ").width;
    for (let i = 0; i < tokens.length; i++) {
      const tk = tokens[i];
      const w = ctx.measureText(tk.w).width;
      const nw = cur.length ? curW + sp + w : w;
      const need = tk.glue && tokens[i + 1] ? nw + sp + ctx.measureText(tokens[i + 1].w).width : nw;
      if (cur.length && need > maxW) { lines.push(cur); cur = [tk]; curW = w; } else { cur.push(tk); curW = nw; }
    }
    if (cur.length) lines.push(cur);
    return lines;
  }
  function getLayout(ctx, S) {
    const ok = fontsReady();
    const key = `${ok}|${S.myth}|${S.explRaw}`;
    let Lo = LAYOUTS.get(key);
    if (!Lo) {
      ctx.save();
      try { Lo = computeLayout(ctx, S); } finally { ctx.restore(); }
      if (ok) { if (LAYOUTS.size > 40) LAYOUTS.clear(); LAYOUTS.set(key, Lo); }
    }
    return Lo;
  }

  // ---------------- Stempel (Offscreen-Cache mit Gummi-/Tintenstruktur) ----------------
  const STAMPS = new Map();
  const RES = 1.5; // Cache-Auflösung (scharf auch beim Heranfliegen / Kamera-Push)
  function stampGeom(ctx, V, maxW) {
    let F = 118;
    for (; F > 56; F -= 2) {
      setFont(ctx, 700, F, HEAD_FONT, F * 0.07);
      const ww = ctx.measureText(V.word).width - F * 0.07;
      if (ww + F * 0.95 <= maxW) break;
    }
    setFont(ctx, 700, F, HEAD_FONT, F * 0.07);
    const ww = ctx.measureText(V.word).width - F * 0.07;
    const w = Math.round(ww + F * 0.95);
    const h = Math.round(F * 1.62);
    return { F, w, h, ww };
  }
  /** Zeichnet den Stempel (ohne Struktur) zentriert bei 0,0 in Einheitsskala. */
  function paintStamp(c, V, g) {
    const { F, w, h } = g;
    c.save();
    c.strokeStyle = V.color; c.fillStyle = V.color; c.lineJoin = "round";
    // leicht getönte Innenfläche (Tinte auf dunklem Papier)
    c.globalAlpha = 0.10; c.beginPath(); rrPath(c, -w / 2, -h / 2, w, h, F * 0.16); c.fill(); c.globalAlpha = 1;
    c.lineWidth = F * 0.085; c.beginPath(); rrPath(c, -w / 2, -h / 2, w, h, F * 0.16); c.stroke();
    const ins = F * 0.15;
    c.lineWidth = F * 0.03; c.beginPath(); rrPath(c, -w / 2 + ins, -h / 2 + ins, w - 2 * ins, h - 2 * ins, F * 0.08); c.stroke();
    // Hauptwort
    setFont(c, 700, F, HEAD_FONT, F * 0.07);
    c.textAlign = "center"; c.textBaseline = "alphabetic";
    c.fillText(V.word, F * 0.035, F * 0.33);
    // Nieten-/Sternpunkte links/rechts in der Innenkante
    const dy = -h / 2 + ins + F * 0.13;
    for (const sx of [-1, 1]) {
      c.beginPath(); c.arc(sx * (w / 2 - ins - F * 0.14), dy, F * 0.035, 0, TAU); c.fill();
      c.beginPath(); c.arc(sx * (w / 2 - ins - F * 0.14), -dy, F * 0.035, 0, TAU); c.fill();
    }
    c.restore();
  }
  function buildStamp(mctx, V, maxW, rngFn) {
    const g = stampGeom(mctx, V, maxW);
    const m = 46; // Rand für Glow
    const cw = Math.ceil((g.w + 2 * m) * RES), ch = Math.ceil((g.h + 2 * m) * RES);
    const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
    const c = cv.getContext("2d");
    c.setTransform(RES, 0, 0, RES, cw / 2, ch / 2);
    paintStamp(c, V, g);
    // Gummistempel-Struktur: Tintenfehlstellen, Kratzer, ungleichmäßiger Druck (deterministisch)
    const r = rngFn("myth-stamp-" + V.key);
    c.globalCompositeOperation = "destination-out";
    const W2 = g.w / 2 + 8, H2 = g.h / 2 + 8;
    for (let i = 0; i < 900; i++) {
      const x = (r() * 2 - 1) * W2, y = (r() * 2 - 1) * H2;
      const rad = 0.5 + Math.pow(r(), 3) * 3.2;
      c.globalAlpha = 0.45 + 0.55 * r();
      c.beginPath(); c.arc(x, y, rad, 0, TAU); c.fill();
    }
    c.lineCap = "round";
    for (let i = 0; i < 16; i++) {
      const x = (r() * 2 - 1) * W2, y = (r() * 2 - 1) * H2, a = (r() - 0.5) * 0.9 + (r() < 0.5 ? 0 : Math.PI / 2) * 0.15;
      const len = 18 + r() * 70;
      c.globalAlpha = 0.35 + 0.4 * r(); c.lineWidth = 0.8 + r() * 1.6;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); c.stroke();
    }
    for (let i = 0; i < 3; i++) {
      const x = (r() * 2 - 1) * W2 * 0.8, y = (r() * 2 - 1) * H2 * 0.8, rad = 60 + r() * 90;
      const gr = c.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, "rgba(0,0,0,0.42)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      c.globalAlpha = 1; c.fillStyle = gr; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    c.globalCompositeOperation = "source-over"; c.globalAlpha = 1;
    // Glow-Version (weichgezeichnet)
    const gv = document.createElement("canvas"); gv.width = cw; gv.height = ch;
    const gc = gv.getContext("2d");
    try { gc.filter = `blur(${Math.round(14 * RES)}px)`; gc.drawImage(cv, 0, 0); gc.filter = "none"; }
    catch (e) { gc.shadowColor = V.color; gc.shadowBlur = 24; gc.drawImage(cv, 0, 0); }
    // Schatten-Version (dunkler, weicher Block)
    const sv = document.createElement("canvas"); sv.width = cw; sv.height = ch;
    const sc = sv.getContext("2d");
    try { sc.filter = `blur(${Math.round(16 * RES)}px)`; } catch (e) { /* ohne Weichzeichnung */ }
    sc.setTransform(RES, 0, 0, RES, cw / 2, ch / 2); sc.fillStyle = "rgba(0,0,0,0.9)";
    sc.beginPath(); rrPath(sc, -g.w / 2, -g.h / 2, g.w, g.h, g.F * 0.16); sc.fill();
    try { sc.filter = "none"; } catch (e) { /* */ }
    // Ruhezustand: vorgedrehte Sprites (Schatten+Stempel, Glow) -> pro Frame nur zwei Blits ohne Resampling
    const rot0 = V.rot * DEG, cs = Math.abs(Math.cos(rot0)), sn = Math.abs(Math.sin(rot0));
    const bw = cw / RES, bh = ch / RES;
    const hw = Math.ceil(bw * cs + bh * sn) + 16, hh = Math.ceil(bw * sn + bh * cs) + 16;
    const mk = () => { const c2 = document.createElement("canvas"); c2.width = hw; c2.height = hh; return c2; };
    const hb = mk(), hg = mk();
    const hbc = hb.getContext("2d");
    hbc.save(); hbc.translate(hw / 2 + 6, hh / 2 + 8); hbc.rotate(rot0); hbc.scale(1 / RES, 1 / RES); hbc.globalAlpha = 0.55; hbc.drawImage(sv, -cw / 2, -ch / 2); hbc.restore();
    hbc.save(); hbc.translate(hw / 2, hh / 2); hbc.rotate(rot0); hbc.scale(1 / RES, 1 / RES); hbc.globalAlpha = 0.96; hbc.drawImage(cv, -cw / 2, -ch / 2); hbc.restore();
    const hgc = hg.getContext("2d");
    hgc.translate(hw / 2, hh / 2); hgc.rotate(rot0); hgc.scale(1 / RES, 1 / RES); hgc.drawImage(gv, -cw / 2, -ch / 2);
    return { cv, gv, sv, cw, ch, g, hb, hg, hw, hh };
  }
  function getStamp(mctx, V, maxW, L) {
    const ok = fontsReady();
    const key = `${V.key}|${maxW}`;
    if (ok && STAMPS.has(key)) return STAMPS.get(key);
    let S = null;
    mctx.save();
    try { S = buildStamp(mctx, V, maxW, L.rng); } catch (e) { S = null; }
    mctx.restore();
    if (S && ok) STAMPS.set(key, S);
    return S;
  }

  // ---------------- Zeitplan ----------------
  function timing(p, S, M) {
    const d = Math.max(0.5, p.d || 6);
    const tType0 = clamp(0.08 * d, 0.25, 0.55);
    const cps = clamp(Number(S.typeSpeed) || 30, 8, 120);
    let typeDur = clamp(M.total / cps, 0.45, Math.max(0.45, 0.26 * d));
    let pause = clamp(0.07 * d, 0.25, 1.1);
    const drop = 0.26;
    let tImp = tType0 + typeDur + pause + drop;
    const sa = Number(S.stampAt);
    if (isFinite(sa) && sa > 0) {
      let want = sa <= 1 ? sa * d : sa;
      want = clamp(want, tType0 + 0.45 + drop, d - 0.3);
      if (want < tImp) { // Tippen/Pause stauchen
        const avail = want - drop - tType0;
        const k = avail / (typeDur + pause);
        typeDur *= k; pause *= k;
      } else pause += want - tImp;
      tImp = want;
    }
    const tTypeEnd = tType0 + typeDur;
    const tDrop = tImp - drop;
    const tExpl = tImp + clamp(0.08 * d, 0.28, 0.9);
    return { d, tType0, typeDur, tTypeEnd, pause, drop, tDrop, tImp, tExpl };
  }

  // ---------------- Zeichnen ----------------
  function drawCardFrame(ctx, L, Lo, t, V, impK, T) {
    const { card } = Lo;
    const a = eo(seg(t, 0, 0.55));
    if (a <= 0) return;
    // Fläche
    ctx.save();
    ctx.globalAlpha = 0.9 * a;
    ctx.fillStyle = "rgba(7,20,42,0.88)"; ctx.beginPath(); rrPath(ctx, card.x, card.y, card.w, card.h, 18); ctx.fill();
    ctx.restore();
    // Rahmen (zeichnet sich ein)
    const per = 2 * (card.w + card.h);
    const drawP = eo(seg(t, 0.05, 0.6));
    const borderCol = impK > 0 ? mixHex(COL.cyan, V.color, 0.55 * impK) : COL.cyan;
    L.glowPath(ctx, (c) => rrPath(c, card.x, card.y, card.w, card.h, 18), borderCol, 1.6, 0.5, { alpha: 0.55 * a, dash: [per * drawP, per + 10] });
    // Eckwinkel (pulsierend)
    const bl = 34, off = 12, pul = 0.55 + 0.45 * Math.sin(T * 2.4);
    const corners = [[card.x - off, card.y - off, 1, 1], [card.x + card.w + off, card.y - off, -1, 1], [card.x - off, card.y + card.h + off, 1, -1], [card.x + card.w + off, card.y + card.h + off, -1, -1]];
    const cp = eo(seg(t, 0, 0.45));
    for (const [x, y, sx, sy] of corners) {
      L.poly(ctx, [[x, y + sy * bl * cp], [x, y], [x + sx * bl * cp, y]], impK > 0 ? V.color : COL.cyan, 2.5, 0.9, { alpha: a * (0.6 + 0.4 * pul) });
    }
    // Blueprint-Lineal links innen
    ctx.save();
    ctx.globalAlpha = 0.28 * a; ctx.strokeStyle = COL.cyan; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = card.y + 40, i = 0; y < card.y + card.h - 30; y += 22, i++) {
      const len = i % 5 === 0 ? 16 : 8;
      ctx.moveTo(card.x + 22, y + 0.5); ctx.lineTo(card.x + 22 + len, y + 0.5);
    }
    ctx.stroke();
    ctx.restore();
  }
  function mixHex(a, b, k) {
    const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
    const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
    const m = pa.map((v, i) => Math.round(lerp(v, pb[i], clamp(k, 0, 1))));
    return `rgb(${m[0]},${m[1]},${m[2]})`;
  }
  /** Rahmen-Komet: separater Lauf entlang des Umfangs. */
  function drawComet(ctx, L, Lo, t, col, alpha) {
    const { card } = Lo; const per = 2 * (card.w + card.h);
    const pos = (t * 260) % per;
    gpath(ctx, (c) => rrPath(c, card.x, card.y, card.w, card.h, 18), col, 2.2, 1.2, { alpha, dash: [110, per - 110], dashOffset: -pos });
  }

  function drawHeader(ctx, L, Lo, t, S, V, tim, T) {
    const { card, headY, div1 } = Lo;
    const a = eo(seg(t, 0.1, 0.4));
    if (a <= 0) return;
    const x0 = card.x + 80;
    // Amber-Marker
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = COL.amber;
    ctx.fillRect(x0, headY - 24, 14, 26);
    ctx.restore();
    // Label mit Decode-Effekt
    const full = S.label;
    const dp = seg(t, 0.15, 0.55);
    let shown = "";
    const nFix = Math.floor(full.length * dp);
    for (let i = 0; i < full.length; i++) {
      if (i < nFix || full[i] === " ") shown += full[i];
      else if (i < nFix + 3 && dp > 0) shown += SCRAMBLE[Math.floor(h01(i * 7.1 + Math.floor(t * 24)) * SCRAMBLE.length)];
    }
    L.text(ctx, shown, x0 + 30, headY, { font: MONO, weight: 700, size: 32, color: COL.amber, letterSpacing: 10, alpha: a, glow: 10, glowColor: COL.amber });
    // Status rechts
    const xr = card.x + card.w - 70;
    const impK = seg(t, tim.tImp, 0.25);
    let status, col;
    if (t < tim.tImp) {
      const dots = ".".repeat(1 + (Math.floor(t * 3) % 3));
      status = (t < tim.tTypeEnd ? "ERFASSE" : "PRÜFE") + dots.padEnd(3, " ");
      col = COL.cyan;
    } else { status = V.status; col = V.color; }
    ctx.save();
    setFont(ctx, 700, 24, MONO, 4);
    const sw = ctx.measureText(status).width;
    ctx.restore();
    const sx = xr - sw;
    const blink = t < tim.tImp ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(T * 9)) : 0.8 + 0.2 * Math.sin(T * 3);
    L.glowDot(ctx, sx - 24, headY - 9, 16, col, a * blink);
    L.fillCircle(ctx, sx - 24, headY - 9, 5, col);
    L.text(ctx, status, sx, headY, { font: MONO, weight: 700, size: 24, color: col, letterSpacing: 4, alpha: a * (t < tim.tImp ? 0.9 : lerp(0.4, 1, impK)) });
    L.text(ctx, "FAKTENCHECK", sx - 52, headY, { font: MONO, weight: 400, size: 22, color: COL.muted, letterSpacing: 5, align: "right", alpha: a * 0.8 });
    // Trennlinie
    const lp = eo(seg(t, 0.2, 0.6));
    L.line(ctx, x0, div1, lerp(x0, card.x + card.w - 70, lp), div1, COL.cyanSoft || "rgba(63,210,255,0.35)", 1.5, 0.5, { alpha: a });
    // Fortschrittsbalken auf der Trennlinie (Prüfung)
    if (t > tim.tType0 && t < tim.tImp + 0.4) {
      const pr = seg(t, tim.tType0, tim.tImp - tim.tType0);
      const fa = 1 - seg(t, tim.tImp, 0.4);
      L.line(ctx, x0, div1, lerp(x0, card.x + card.w - 70, pr), div1, t < tim.tImp ? COL.cyan : V.color, 3, 1, { alpha: a * fa });
    }
  }

  /** Weicher Text-Glow der Behauptung als einmal gerendertes Sprite (statt shadowBlur pro Frame). */
  const GLOWS = new WeakMap();
  function mythGlow(M) {
    let G = GLOWS.get(M);
    if (G !== undefined) return G;
    G = null;
    try {
      const pad = 28;
      const maxW = Math.max(...M.lines.map((l) => l.w));
      const ox = M.x - pad, oy = Math.floor(M.top - pad);
      const w = Math.ceil(maxW + 2 * pad + 8), h = Math.ceil(M.bottom - M.top + 2 * pad + M.size * 0.1);
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      const c = cv.getContext("2d");
      c.filter = "blur(9px)";
      setFont(c, MYTH_FONT.weight, M.size, MYTH_FONT.family, 0);
      c.fillStyle = "rgba(63,210,255,0.42)";
      for (const ln of M.lines) c.fillText(ln.text, M.x - ox, ln.y - oy);
      c.filter = "none";
      G = { cv, ox, oy, pad, w, h };
    } catch (e) { G = null; }
    if (fontsReady()) GLOWS.set(M, G);
    return G;
  }
  function drawMyth(ctx, L, Lo, t, V, tim, T) {
    const { M } = Lo;
    const GL = mythGlow(M);
    const typeP = seg(t, tim.tType0, tim.typeDur);
    const n = Math.floor(M.total * typeP + 1e-6);
    const impK = seg(t, tim.tImp, 0.3);
    const dimTo = V.key === "FALSCH" ? 0.72 : 1;
    const textA = lerp(1, dimTo, impK);
    const qk = seg(t, tim.tImp + 0.08, 0.12);
    const qCol = qk > 0 ? mixHex(COL.cyan, V.color, qk) : COL.cyan;
    // öffnendes „ (hängend links, groß, sitzt auf der Grundlinie)
    const qr = M.qr;
    const qa = eo(seg(t, tim.tType0 - 0.15, 0.3));
    if (qa > 0) {
      const l0 = M.lines[0];
      const s = lerp(1.5, 1, eo(seg(t, tim.tType0 - 0.15, 0.35)));
      const qx = M.x - 30 - qWidth(qr), qy = l0.y - qr;
      ctx.save();
      ctx.translate(qx + qWidth(qr) / 2, qy); ctx.scale(s, s);
      quoteMarks(ctx, -qWidth(qr) / 2, 0, qr, "low", qCol, qa, 14);
      ctx.restore();
    }
    // STIMMT: Textmarker-Band hinter den Zeilen
    if (V.key === "STIMMT" && t > tim.tImp) {
      ctx.save(); ctx.fillStyle = V.color;
      M.lines.forEach((ln, i) => {
        const k = eo(seg(t, tim.tImp + 0.1 + i * 0.13, 0.3)); if (k <= 0) return;
        ctx.globalAlpha = 0.2;
        ctx.fillRect(M.x - 10, ln.y - M.size * 0.36, (ln.w + 22) * k, M.size * 0.48);
        ctx.globalAlpha = 0.85;
        ctx.fillRect(M.x - 10, ln.y + M.size * 0.12 - 2, (ln.w + 22) * k, 3);
      });
      ctx.restore();
    }
    // Zeilen tippen
    let cursorX = M.x, cursorY = M.lines[0].y, curLine = 0;
    for (let i = 0; i < M.lines.length; i++) {
      const ln = M.lines[i];
      const vis = clamp(n - ln.start, 0, ln.len);
      if (vis <= 0) { if (n <= ln.start && i > 0 && curLine === i - 1 && n === ln.start) { /* Cursor bleibt am Ende der Vorzeile */ } continue; }
      const s = vis >= ln.len ? ln.text : ln.text.slice(0, vis);
      if (GL) {
        // Glow-Band dieser Zeile (bis zum zuletzt getippten Zeichen) aus dem Sprite
        const top = i === 0 ? 0 : Math.round(ln.y - M.lh * 0.8 - GL.oy);
        const bot = i === M.lines.length - 1 ? GL.h : Math.round(ln.y + M.lh * 0.2 - GL.oy);
        const sw = Math.min(GL.w, Math.round(M.x - GL.ox + ln.px[vis] + (vis >= ln.len ? GL.pad : 8)));
        if (sw > 0 && bot > top) {
          ctx.save(); ctx.globalAlpha = textA;
          ctx.drawImage(GL.cv, 0, top, sw, bot - top, GL.ox, GL.oy + top, sw, bot - top);
          ctx.restore();
        }
      }
      L.text(ctx, s, M.x, ln.y, { font: MYTH_FONT.family, weight: MYTH_FONT.weight, size: M.size, color: COL.white, alpha: textA });
      // frisch getippte Zeichen leuchten cyan
      if (typeP < 1 && vis < ln.len + 1 && n - ln.start <= ln.len) {
        const k0 = Math.max(0, vis - 3);
        const frag = ln.text.slice(k0, vis);
        if (frag.trim()) L.text(ctx, frag, M.x + ln.px[k0], ln.y, { font: MYTH_FONT.family, weight: MYTH_FONT.weight, size: M.size, color: COL.cyan, alpha: 0.9 });
      }
      cursorX = M.x + ln.px[vis]; cursorY = ln.y; curLine = i;
    }
    // schließendes “ nach Tippende (oben, Schweif bis Versalhöhe)
    const last = M.lines[M.lines.length - 1];
    const closeX = M.x + last.w + M.size * 0.12;
    const cq = seg(t, tim.tTypeEnd, 0.25);
    if (cq > 0) {
      const s = lerp(1.7, 1, eo(cq));
      const qy = last.y - M.size * 0.73 + qr * 2.6;
      ctx.save();
      ctx.translate(closeX + qWidth(qr) / 2, qy); ctx.scale(s, s);
      quoteMarks(ctx, -qWidth(qr) / 2, 0, qr, "high", qCol, eo(cq), 14);
      ctx.restore();
    }
    // Cursor
    if (t >= tim.tType0 - 0.1 && t < tim.tImp + 0.1) {
      const typing = typeP > 0 && typeP < 1;
      const blink = typing ? 1 : (Math.sin(t * TAU * 1.8) > -0.1 ? 1 : 0);
      const ca = blink * (1 - seg(t, tim.tImp - 0.05, 0.15));
      if (ca > 0) {
        const cx = typeP >= 1 ? closeX + qWidth(qr) + 14 : cursorX + 6;
        const cy = typeP >= 1 ? last.y : cursorY;
        ctx.save(); ctx.globalAlpha = ca; ctx.fillStyle = COL.cyan;
        ctx.fillRect(cx, cy - M.size * 0.76, Math.max(4, M.size * 0.07), M.size * 0.92);
        ctx.restore();
        L.glowDot(ctx, cx + 3, cy - M.size * 0.3, M.size * 0.7, "rgba(63,210,255,0.35)", ca * 0.6);
      }
    }
    // Urteils-Markierung auf dem Text
    if (t > tim.tImp) {
      M.lines.forEach((ln, i) => {
        const k = eo(seg(t, tim.tImp + 0.1 + i * 0.13, 0.3));
        if (k <= 0) return;
        const xa = M.x - 10, xb = M.x + ln.w + 14;
        const xe = lerp(xa, xb, k);
        if (V.key === "FALSCH") {
          const yb = ln.y - M.size * 0.3;
          const j1 = (h01(i * 3.3) - 0.5) * 8, j2 = (h01(i * 5.9) - 0.5) * 8;
          const pts = [];
          const N = 8;
          for (let q = 0; q <= N; q++) {
            const x = lerp(xa, xb, q / N); if (x > xe) { pts.push([xe, yb + lerp(j1, j2, (xe - xa) / (xb - xa))]); break; }
            pts.push([x, yb + lerp(j1, j2, q / N) + (h01(i * 11 + q) - 0.5) * 3]);
          }
          if (pts.length > 1) L.poly(ctx, pts, V.color, Math.max(3.5, M.size * 0.058), 0.9, { alpha: 0.9 });
        } else if (V.key === "STIMMT") {
          // (Textmarker-Band wird hinter dem Text gezeichnet)
        } else {
          const yb = ln.y + M.size * 0.22;
          const amp = M.size * 0.07, wl = M.size * 0.55;
          L.glowPath(ctx, (c) => {
            c.moveTo(xa + 16, yb);
            for (let x = xa + 16; x <= xe - 16 * k; x += 6) c.lineTo(x, yb + Math.sin((x - xa) / wl * TAU) * amp);
          }, V.color, Math.max(3.5, M.size * 0.06), 1, { alpha: 0.9 });
        }
      });
    }
  }

  function drawReticle(ctx, L, Lo, t, tim, T, V) {
    const { stamp } = Lo;
    const a = eo(seg(t, 0.3, 0.6)) * (1 - seg(t, tim.tImp - 0.12, 0.14));
    if (a <= 0) return;
    const x = stamp.cx, y = stamp.cy;
    const active = seg(t, tim.tTypeEnd - 0.2, 0.3); // nach dem Tippen „scharf“
    const R = lerp(136, 118, active);
    const alpha = a * lerp(0.45, 0.9, active);
    ctx.save();
    ctx.translate(x, y);
    // äußerer Strichring, rotierend
    ctx.rotate(T * lerp(0.25, 0.9, active));
    gpath(ctx, (c) => c.arc(0, 0, R, 0, TAU), COL.cyan, 2, 0, { alpha: alpha * 0.8, dash: [18, 14] });
    ctx.rotate(-T * lerp(0.25, 0.9, active) * 2.2);
    for (let i = 0; i < 3; i++) {
      const a0 = (i / 3) * TAU;
      L.arc(ctx, 0, 0, R * 0.78, a0, a0 + 0.9, COL.cyan, 3, 0.5, { alpha: alpha * 0.7 });
    }
    ctx.restore();
    // Fadenkreuz-Ticks
    const tk = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of tk) L.line(ctx, x + dx * (R + 10), y + dy * (R + 10), x + dx * (R + 34), y + dy * (R + 34), COL.cyan, 2, 0.6, { alpha });
    L.line(ctx, x - 14, y, x + 14, y, COL.cyan, 1.5, 0.4, { alpha: alpha * 0.8 });
    L.line(ctx, x, y - 14, x, y + 14, COL.cyan, 1.5, 0.4, { alpha: alpha * 0.8 });
    // Analyse-Prozent
    const pr = seg(t, tim.tType0, tim.tImp - tim.tType0 - 0.05);
    const pct = Math.round(99 * eo(pr) + (pr >= 1 ? 1 : 0));
    L.text(ctx, "ANALYSE", x, y + R + 60, { font: MONO, weight: 400, size: 20, color: COL.muted, align: "center", letterSpacing: 6, alpha: alpha * 0.9 });
    L.text(ctx, `${pct} %`, x, y + R + 94, { font: MONO, weight: 700, size: 30, color: COL.cyan, align: "center", letterSpacing: 2, alpha });
  }

  function drawScan(ctx, Lo, t, tim, T, V) {
    const { card, M } = Lo;
    let y, a, col;
    if (t > tim.tTypeEnd - 0.1 && t < tim.tImp) {
      // Analyse-Sweep über den Behauptungsblock
      const span = Math.max(0.3, tim.tImp - tim.tTypeEnd);
      const ph = ((t - tim.tTypeEnd) / Math.min(span, 0.9)) % 1;
      y = lerp(M.top - 30, M.bottom + 30, sm(ph));
      a = 0.5 * seg(t, tim.tTypeEnd - 0.1, 0.2); col = "63,210,255";
    } else if (t > tim.tImp + 1.2) {
      const per = 5.5, ph = ((t - tim.tImp - 1.2) % per) / per;
      if (ph > 0.35) return;
      y = lerp(card.y + 20, card.y + card.h - 20, ph / 0.35);
      a = 0.18 * Math.sin((ph / 0.35) * Math.PI); col = V.rgb;
    } else return;
    ctx.save();
    const x0 = card.x + 40, w = card.w - 80;
    const g = ctx.createLinearGradient(0, y - 46, 0, y + 4);
    g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${(a * 0.35).toFixed(3)})`);
    ctx.fillStyle = g; ctx.fillRect(x0, y - 46, w, 50);
    ctx.globalAlpha = a; ctx.fillStyle = `rgb(${col})`; ctx.fillRect(x0, y, w, 1.5);
    ctx.restore();
  }

  function drawStampLayer(ctx, L, Lo, t, tim, V, ST) {
    const { stamp } = Lo;
    if (t < tim.tDrop) return;
    const rot0 = V.rot * DEG;
    const x = stamp.cx, y = stamp.cy;
    const k = seg(t, tim.tDrop, tim.drop);
    const dt = t - tim.tImp;
    let sc, rot, alpha;
    if (dt < 0) {
      const e = ei(k);
      sc = lerp(2.5, 1, e); rot = lerp(rot0 - 16 * DEG, rot0, e); alpha = clamp(k * 3.2, 0, 1);
    } else {
      sc = 1 - 0.07 * Math.exp(-dt * 13) * Math.cos(dt * 34);
      rot = rot0 + 0.6 * DEG * Math.exp(-dt * 9) * Math.sin(dt * 40);
      alpha = 1;
    }
    const g = ST ? ST.g : null;
    const w = g ? g.w : 480, h = g ? g.h : 180;
    // Schatten (Höhe: groß + versetzt, wird beim Aufprall klein & scharf)
    const lift = dt < 0 ? sc - 1 : 0;
    if (ST && !(ST.hb && dt > 0.65)) {
      ctx.save();
      ctx.translate(x + 18 * lift + 6, y + 30 * lift + 8); ctx.rotate(rot); ctx.scale(lerp(1, 1.25, lift / 1.5) / RES, lerp(1, 1.25, lift / 1.5) / RES);
      ctx.globalAlpha = dt < 0 ? 0.55 * alpha * (1 - lift / 2) : 0.55;
      ctx.drawImage(ST.sv, -ST.cw / 2, -ST.ch / 2);
      ctx.restore();
    }
    // Bewegungsunschärfe-Geister während des Falls
    if (dt < 0 && ST) {
      for (let gI = 1; gI <= 2; gI++) {
        const kk = clamp(k - gI * 0.12, 0, 1); const e = ei(kk);
        const s2 = lerp(2.5, 1, e);
        ctx.save(); ctx.translate(x, y); ctx.rotate(lerp(rot0 - 16 * DEG, rot0, e)); ctx.scale(s2 / RES, s2 / RES);
        ctx.globalAlpha = 0.16 * alpha / gI; ctx.drawImage(ST.cv, -ST.cw / 2, -ST.ch / 2); ctx.restore();
      }
    }
    // Stempel
    if (ST && ST.hb && dt > 0.65) {
      // Ruhezustand: vorgedrehte Sprites pixelgenau blitten
      const bx = Math.round(x - ST.hw / 2), by = Math.round(y - ST.hh / 2);
      ctx.save();
      ctx.drawImage(ST.hb, bx, by);
      const glowA = 0.34 + 0.9 * Math.exp(-dt * 5) + 0.12 * Math.sin(t * 2.6);
      ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = clamp(glowA, 0, 1);
      ctx.drawImage(ST.hg, bx, by);
      ctx.restore();
    } else {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    if (ST) {
      ctx.scale(sc / RES, sc / RES);
      const glowA = dt < 0 ? 0.3 * alpha : 0.34 + 0.9 * Math.exp(-dt * 5) + 0.12 * Math.sin(t * 2.6);
      ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = clamp(glowA, 0, 1);
      ctx.drawImage(ST.gv, -ST.cw / 2, -ST.ch / 2);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = alpha * 0.96;
      ctx.drawImage(ST.cv, -ST.cw / 2, -ST.ch / 2);
    } else {
      ctx.scale(sc, sc); ctx.globalAlpha = alpha;
      const gg = stampGeom(ctx, V, stamp.maxW);
      paintStamp(ctx, V, gg);
    }
    ctx.restore();
    }

    // Aufprall-Effekte
    if (dt >= 0 && dt < 1.0) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot0);
      // Schockwellen-Rahmen (2 Ringe)
      for (let r = 0; r < 2; r++) {
        const kk = seg(dt, r * 0.08, 0.55); if (kk <= 0 || kk >= 1) continue;
        const s = 1 + 0.32 * eo(kk) + r * 0.08;
        L.glowPath(ctx, (c) => rrPath(c, -w * s / 2, -h * s / 2, w * s, h * s, 20 * s), V.color, lerp(4, 1, kk), 1, { alpha: (1 - kk) * (1 - kk) * 0.85 });
      }
      // Tintenspritzer
      const life = 0.75;
      if (dt < life) {
        const q = dt / life;
        ctx.fillStyle = V.color;
        for (let i = 0; i < 38; i++) {
          const a = h01(i * 3.7 + 1) * TAU;
          const ex = Math.cos(a), ey = Math.sin(a);
          const bx = ex * w * 0.5, by = ey * h * 0.5;
          const dist = (26 + 150 * h01(i * 9.1)) * eo(Math.min(1, q * 1.6));
          const px = bx + ex * dist, py = by + ey * dist + 40 * q * q;
          const rr = (1.5 + 4.5 * h01(i * 1.9)) * (1 - q * 0.7);
          ctx.globalAlpha = (1 - q) * 0.9;
          ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill();
          if (i % 4 === 0) { ctx.globalAlpha = (1 - q) * 0.5; ctx.beginPath(); ctx.arc(px - ex * rr * 2.2, py - ey * rr * 2.2, rr * 0.55, 0, TAU); ctx.fill(); }
        }
      }
      ctx.restore();
      // Lichtblitz
      const fl = 1 - seg(dt, 0, 0.35);
      if (fl > 0) L.glowDot(ctx, x, y, 420, rgba(V.rgb, 0.5), fl * 0.7);
    }
  }

  function drawExplanation(ctx, L, Lo, t, tim, S, V, T) {
    const { E, card } = Lo;
    if (!Lo.hasExpl || t < tim.tExpl - 0.05) return;
    const x0 = card.x + 80;
    const a = eo(seg(t, tim.tExpl, 0.4));
    // Trennlinie + Label
    const lp = eo(seg(t, tim.tExpl, 0.5));
    L.line(ctx, x0, E.divY, lerp(x0, card.x + card.w - 70, lp), E.divY, "rgba(63,210,255,0.35)", 1.5, 0.4, { alpha: a });
    const lx = Lo.M.x;
    // Label-Chip
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = COL.cyan;
    ctx.beginPath(); ctx.moveTo(x0 + 2, E.labelY - 20); ctx.lineTo(x0 + 16, E.labelY - 11); ctx.lineTo(x0 + 2, E.labelY - 2); ctx.closePath(); ctx.fill();
    ctx.restore();
    L.text(ctx, S.factLabel, lx, E.labelY, { font: MONO, weight: 700, size: 24, color: COL.cyan, letterSpacing: 7, alpha: a });
    // linker Akzentbalken
    const barH = (E.lines.length - 1) * E.lh + E.size * 0.95;
    const bh = barH * eo(seg(t, tim.tExpl + 0.1, 0.5));
    ctx.save(); ctx.globalAlpha = a * (0.6 + 0.3 * Math.sin(T * 2.2)); ctx.fillStyle = COL.cyan;
    ctx.fillRect(x0 + 6, E.firstBase - E.size * 0.78, 4, bh);
    ctx.restore();
    // Wörter
    const nW = E.words.length;
    const stag = Math.min(0.05, Math.min(0.7, 0.12 * tim.d) / Math.max(1, nW));
    for (const wd of E.words) {
      const k = seg(t, tim.tExpl + 0.15 + wd.idx * stag, 0.35);
      if (k <= 0) continue;
      const e = eo(k);
      L.text(ctx, wd.w, wd.x, wd.y + (1 - e) * 14, { font: EXPL_FONT.family, weight: wd.accent ? 800 : EXPL_FONT.weight, size: E.size, color: wd.accent ? COL.amber : COL.body, alpha: e });
    }
  }

  function drawAmbient(ctx, L, Lo, t, tim, V, T, W, H) {
    // Staub (deterministisch, driftend)
    ctx.save();
    for (let i = 0; i < 26; i++) {
      const x = (h01(i * 3.1) * W + T * (6 + 10 * h01(i * 1.7))) % W;
      const y = (h01(i * 7.7) * H * 0.84 + Math.sin(T * 0.5 + i) * 14);
      const r = 1.2 + 2.2 * h01(i * 1.3);
      ctx.globalAlpha = 0.18 + 0.2 * (0.5 + 0.5 * Math.sin(T * 1.3 + i));
      ctx.fillStyle = i % 5 === 0 ? COL.amber : COL.cyan;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ---------------- Haupt-Draw ----------------
  function readState(p) {
    const P = (p && p.params && typeof p.params === "object") ? p.params : {};
    const mythParam = pick(P, ["myth", "claim", "mythos", "statement", "behauptung", "quote", "title"]);
    let myth = cleanMyth(mythParam);
    const txt = cleanMyth(p.text);
    if (!myth) myth = txt;
    if (!myth) myth = DEFAULT_MYTH;
    let explRaw = str(pick(P, ["explanation", "fact", "fakt", "erklaerung", "erklärung", "reason", "detail", "body", "subtitle"])).trim();
    if (!explRaw && mythParam && txt && txt !== myth) explRaw = str(p.text).trim();
    const V = parseVerdict(pick(P, ["verdict", "result", "urteil", "ergebnis", "status", "answer", "stamp"]));
    let label = str(pick(P, ["label", "kicker"])).trim();
    label = upper(label || "MYTHOS");
    const num = pick(P, ["number", "nr", "index", "no"]);
    if (num !== undefined && str(num).trim()) label += " #" + str(num).trim();
    const factLabel = upper(str(pick(P, ["factLabel", "explanationLabel", "factTitle"])).trim() || "FAKT");
    return {
      myth, explRaw, explTokens: tokenizeExpl(explRaw), V, label, factLabel,
      stampAt: pick(P, ["stampAt", "verdictAt"]), typeSpeed: pick(P, ["typeSpeed", "cps"]),
    };
  }

  function draw(ctx, p) {
    const L = p.L || (window.CE && window.CE.lib);
    if (!L) return;
    const W = p.W || 1920, H = p.H || 1080;
    const t = Math.max(0, Number(p.t) || 0);
    const T = Number(p.T) || t;
    let S = null, failed = false;
    ctx.save();
    try {
      try { ctx.letterSpacing = "0px"; } catch (e) { /* */ }
      S = readState(p);
      const V = S.V;
      const Lo = getLayout(ctx, S);
      const tim = timing(p, S, Lo.M);
      const ST = getStamp(ctx, V, Lo.stamp.maxW, L);
      const impK = seg(t, tim.tImp, 0.3);
      drawAmbient(ctx, L, Lo, t, tim, V, T, W, H);
      // Aufprall: Kamera-Stoß + Wackeln (klingt schnell ab)
      const dt = t - tim.tImp;
      if (dt >= 0 && dt < 0.9) {
        const dec = Math.exp(-dt * 6.5);
        const A = 15 * dec;
        const sx = A * (0.65 * Math.sin(dt * 73) + 0.35 * Math.sin(dt * 41 + 1.3));
        const sy = A * (0.65 * Math.cos(dt * 67 + 0.4) + 0.35 * Math.sin(dt * 37 + 2.1));
        const punch = 1 + 0.018 * Math.exp(-dt * 9);
        ctx.translate(Lo.stamp.cx + sx, Lo.stamp.cy + sy);
        ctx.rotate(0.25 * DEG * dec * Math.sin(dt * 53));
        ctx.scale(punch, punch);
        ctx.translate(-Lo.stamp.cx, -Lo.stamp.cy);
      }
      drawCardFrame(ctx, L, Lo, t, V, impK, T);
      if (t > 0.7) drawComet(ctx, L, Lo, t, impK > 0 ? V.color : COL.cyan, 0.55 * seg(t, 0.7, 0.4));
      drawHeader(ctx, L, Lo, t, S, V, tim, T);
      drawScan(ctx, Lo, t, tim, T, V);
      drawReticle(ctx, L, Lo, t, tim, T, V);
      drawMyth(ctx, L, Lo, t, V, tim, T);
      drawExplanation(ctx, L, Lo, t, tim, S, V, T);
      drawStampLayer(ctx, L, Lo, t, tim, V, ST);
      // Karten-Tönung beim Aufprall
      const fl = 1 - seg(t - tim.tImp, 0, 0.3);
      if (t >= tim.tImp && fl > 0) {
        ctx.save(); ctx.globalAlpha = 0.14 * fl; ctx.fillStyle = V.color;
        ctx.beginPath(); rrPath(ctx, Lo.card.x, Lo.card.y, Lo.card.w, Lo.card.h, 18); ctx.fill(); ctx.restore();
      }
    } catch (e) {
      failed = true;
    }
    ctx.restore();
    if (failed) {
      // niemals werfen – im Fehlerfall zumindest die Behauptung zeigen
      try {
        ctx.save();
        L.text(ctx, "„" + ((S && S.myth) || DEFAULT_MYTH) + "“", W / 2, H / 2, { size: 56, align: "center", color: COL.white, font: "Inter", weight: 800 });
        ctx.restore();
      } catch (e2) { /* */ }
    }
  }

  CEX.register("myth_card", { ownsText: true, draw });
})();
