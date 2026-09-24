/* Template „myth_card“ – Mythos-Check im Stil „Visual Science“ (ownsText).
   Prüfkarte (Blueprint-Panel) mit Kopfzeile „MYTHOS“ (Amber, Mono) und Prüfstatus; die Behauptung wird in
   großen deutschen Anführungszeichen „…“ eingetippt, ein Prüf-Fadenkreuz analysiert, dann knallt ein
   Gummistempel (Wort + Farbe frei wählbar) mit Drehung, Kamera-Stoß, Schockwelle und Tintenspritzern auf.
   Danach blenden Erklärung („FAKT“) und optionale Fußzeile („QUELLE“) ein. Optional eine Hintergrund-Szene
   rechts neben der Karte (Split-Layout): Otis-Vorführung 1854 als ruhige Silhouette oder Film-Szene mit Funken,
   die durchgestrichen wird.

   BEATS (params.beats = Sekunden ab Szenenstart, alle optional, geklemmt auf [0,3 ; d−0,3]):
     [0] = Behauptung wird eingetippt (Tipp-Start; die Karte selbst steht ab 0 s)
     [1] = Stempel-Aufprall (Urteil) – darf spät kommen, erst wenn es gesprochen wird
     [2] = Erklärung/Fakt (erster Eintrag) blendet ein (auch vor dem Stempel erlaubt)
     [3] = Fußzeile/Quelle blendet ein
     [4] = Hintergrund-Szene wird durchgestrichen (nur background mit crossOut, z. B. Film-Szene)
   Per-Item "at" (Sekunden): explanation als Liste [{ text, at }] (jeder Eintrag eigene Zeile),
     background als Objekt { type, at, sparksAt, crossAt }, footer als Objekt { text, label, at }.
   Einzel-Keys statt beats: typeAt, stampAt, explanationAt, footerAt, crossAt, backgroundAt, sparksAt, textAt.
   Ohne beats/at: Standard-Zeitplan relativ zu d.

   params:
     myth | statement | claim   Behauptung (Deutsch). Fehlt sie, wird p.text verwendet (dann kein Overlay).
     verdict      Stempelwort. FALSCH | STIMMT | TEILWEISE (Standard FALSCH) oder frei: WIDERLEGT, WAHR,
                  LEGENDE, KINO … (wird so gestempelt). true/false/yes/no → STIMMT/FALSCH.
     verdict_color  red | green | amber | cyan | #rrggbb (Standard: aus dem Wort abgeleitet, sonst rot)
     statusText   Status rechts oben nach dem Urteil (Standard je Farbe: WIDERLEGT / BESTÄTIGT / NICHT BELEGT …)
     mark         strike | highlight | wave | underline | none – Markierung der Behauptung (Standard je Farbe)
     explanation | fact | subline  Erklärung (String oder Liste), *Wort* = Amber-Akzent, Zahlen automatisch Amber
     factLabel    Label über der Erklärung (Standard „FAKT“, "" = aus)
     footer | source  Fußzeile (z. B. „MythBusters, 2004“), footerLabel (Standard „QUELLE“)
     label        Kopfzeilen-Label (Standard „MYTHOS“), number → „MYTHOS #2“
     background   otis_demo_silhouette | safety_gear_sparks_crossed_out (Split-Layout, Szene rechts)
     stampOn      quote (Karte) | scene (auf die Hintergrund-Szene). Standard: Film-Szene → scene, sonst quote
     crossOut     Hintergrund-Szene durchstreichen (Standard true bei *crossed_out*)
     textAs       overlay (Standard: p.text als Overlay-Box oben links wie die Engine) | explanation | header | none
     textAt       Einblendzeit des Overlays (Standard 0,5 s)
     typeSpeed    Zeichen/s (Standard 30), typeDur Tippdauer in s
     showStamp    false = kein Stempel (Cliffhanger: Status bleibt „PRÜFE…“, Urteil kommt in der Folgeszene)
     overlay      false = Overlay-Box unterdrücken; accentNumbers false = Zahlen nicht automatisch Amber
     stampRotation Stempeldrehung in Grad; cameraSafe (Standard true) gleicht Kamera-Zoom/-Pan/-Tilt aus */
(function () {
  "use strict";
  const CEX = window.CE;
  if (!CEX || typeof CEX.register !== "function") return;

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const COL = {
    cyan: "#3fd2ff", amber: "#ffb347", red: "#ff5a5f", green: "#5be49b",
    white: "#eef6ff", muted: "#8fb3d9", steel: "#9fc4e6", body: "#d4e4f5",
    sepia: "#d99a52", pale: "#ffdcaa",
  };
  const CATS = {
    red: { color: COL.red, rgb: "255,90,95", mark: "strike", rot: -11, status: "WIDERLEGT" },
    green: { color: COL.green, rgb: "91,228,155", mark: "highlight", rot: -8, status: "BESTÄTIGT" },
    amber: { color: COL.amber, rgb: "255,179,71", mark: "wave", rot: -9, status: "NICHT BELEGT" },
    cyan: { color: COL.cyan, rgb: "63,210,255", mark: "underline", rot: -8, status: "GEPRÜFT" },
  };
  const CANON = {
    FALSCH: { cat: "red", status: "WIDERLEGT", rot: -11 },
    STIMMT: { cat: "green", status: "BESTÄTIGT", rot: -8 },
    TEILWEISE: { cat: "amber", status: "BEDINGT RICHTIG", rot: -9 },
  };
  const EXACT = {
    falsch: "FALSCH", false: "FALSCH", no: "FALSCH", nein: "FALSCH", "0": "FALSCH", wrong: "FALSCH", busted: "FALSCH",
    stimmt: "STIMMT", true: "STIMMT", yes: "STIMMT", ja: "STIMMT", "1": "STIMMT", correct: "STIMMT", right: "STIMMT", confirmed: "STIMMT",
    teilweise: "TEILWEISE", partial: "TEILWEISE", partly: "TEILWEISE", mixed: "TEILWEISE", half: "TEILWEISE", plausible: "TEILWEISE", jein: "TEILWEISE",
  };
  const DEFAULT_MYTH = "Kurz vor dem Aufprall hochspringen rettet dich";
  const SCRAMBLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/+<>";
  const MYTH_FONT = { family: "Inter", weight: 800 };
  const EXPL_FONT = { family: "Inter", weight: 600 };
  const HEAD_FONT = "Oxanium";
  const MONO = "JetBrains Mono";
  // Split-Layout: Szene rechts neben der Karte
  const SCN = { x: 1190, y: 200, w: 640, h: 690 };
  const FR = { x: 1260, y: 300, w: 500, h: 490 }; // Filmbild (Hauptframe)

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
  const num = (v) => {
    if (v === undefined || v === null || v === "" || typeof v === "boolean" || typeof v === "object") return undefined;
    const n = Number(v); return isFinite(n) ? n : undefined;
  };
  const bool = (v, def) => {
    if (v === undefined || v === null || v === "") return def;
    if (typeof v === "string") return !/^(false|0|nein|no|off|aus)$/i.test(v.trim());
    return !!v;
  };
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
    ctx.save(); ctx.lineCap = o.cap || "round"; ctx.lineJoin = "round"; ctx.strokeStyle = color;
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
  /** Deutsches Anführungszeichen als Vektor: kind "low" = „ (99, unten), "high" = “ (66, oben). */
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
  function mixHex(a, b, k) {
    const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
    const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
    const m = pa.map((v, i) => Math.round(lerp(v, pb[i], clamp(k, 0, 1))));
    return `rgb(${m[0]},${m[1]},${m[2]})`;
  }

  // ---------------- Urteil (Wort, Farbe, Status, Markierung) ----------------
  function classify(s) {
    if (/(nicht ganz|nicht immer|nur teil|nur bedingt)/.test(s)) return "TEILWEISE";
    if (/(nicht|falsch|false|wrong|nein|^no$|^0$|mythos|myth|unwahr|widerlegt|busted|irrtum|l(ü|ue)ge|fake)/.test(s)) return "FALSCH";
    if (/(teil|partial|halb|bedingt|jein|mixed|half|plausib|eher|manchmal|kommt drauf)/.test(s)) return "TEILWEISE";
    if (/(stimmt|richtig|wahr|true|^ja$|^yes$|^1$|korrekt|best(ä|ae)tigt|correct|right|confirmed|fakt)/.test(s)) return "STIMMT";
    return null;
  }
  function parseColor(v) {
    const s = str(v).trim().toLowerCase();
    if (!s) return null;
    const m = s.match(/^#?([0-9a-f]{6})$/);
    if (m) {
      const hex = "#" + m[1];
      const r = parseInt(m[1].slice(0, 2), 16), g = parseInt(m[1].slice(2, 4), 16), b = parseInt(m[1].slice(4, 6), 16);
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let hue = 0;
      if (mx !== mn) {
        if (mx === r) hue = (60 * ((g - b) / (mx - mn)) + 360) % 360;
        else if (mx === g) hue = 60 * ((b - r) / (mx - mn)) + 120;
        else hue = 60 * ((r - g) / (mx - mn)) + 240;
      }
      const cat = hue < 22 || hue >= 330 ? "red" : hue < 70 ? "amber" : hue < 170 ? "green" : "cyan";
      return { cat, color: hex, rgb: `${r},${g},${b}` };
    }
    if (/(red|rot|danger|fehler|false|falsch)/.test(s)) return { cat: "red" };
    if (/(green|gr(ü|ue)n|true|ok|stimmt|wahr)/.test(s)) return { cat: "green" };
    if (/(amber|orange|gelb|yellow|gold|warn)/.test(s)) return { cat: "amber" };
    if (/(cyan|blau|blue|info|t(ü|ue)rkis)/.test(s)) return { cat: "cyan" };
    return null;
  }
  function buildVerdict(P) {
    const raw = pick(P, ["verdict", "result", "urteil", "ergebnis", "status", "answer", "stamp"]);
    const override = str(pick(P, ["stampText", "stamp_text", "verdictText", "verdict_text", "verdictLabel", "verdict_label", "stampWord"])).trim();
    let canon = null, word = "", guess = null;
    if (raw === true) canon = "STIMMT";
    else if (raw === false) canon = "FALSCH";
    else {
      const s = str(raw).replace(/\s+/g, " ").trim();
      const lc = s.toLowerCase();
      if (!s) canon = "FALSCH";
      else if (EXACT[lc]) canon = EXACT[lc];
      else { word = upper(s); guess = classify(lc); }
    }
    if (canon) word = canon;
    if (override) { word = upper(override); if (!guess && !canon) guess = classify(override.toLowerCase()); }
    const col = parseColor(pick(P, ["verdict_color", "verdictColor", "stampColor", "stamp_color", "color"]));
    const catKey = col ? col.cat : canon ? CANON[canon].cat : guess ? CANON[guess].cat : "red";
    const cat = CATS[catKey];
    const color = col && col.color ? col.color : cat.color;
    const rgb = col && col.rgb ? col.rgb : cat.rgb;
    let status = upper(str(pick(P, ["statusText", "status_text", "statusLabel"])).trim());
    if (!status) {
      if (canon && CANON[canon].cat === catKey) status = CANON[canon].status;
      else if (catKey === "amber" && (canon === "TEILWEISE" || guess === "TEILWEISE")) status = "BEDINGT RICHTIG";
      else status = cat.status;
      if (status === word) status = catKey === "red" ? "FALSCH" : catKey === "green" ? "STIMMT" : "GEPRÜFT";
    }
    const mk = str(pick(P, ["mark", "markStyle", "marker"])).trim().toLowerCase();
    const mark = /^(strike|highlight|wave|underline|none)$/.test(mk) ? mk : cat.mark;
    const rr = num(pick(P, ["stampRotation", "stampRot", "rotation"]));
    const rot = rr !== undefined ? clamp(rr, -30, 30) : canon && CANON[canon].cat === catKey ? CANON[canon].rot : cat.rot;
    return { key: `${word}|${color}|${rot}`, word, color, rgb, status, rot, cat: catKey, mark };
  }

  function cleanMyth(s) {
    s = str(s).replace(/\*/g, "").replace(/\s+/g, " ").trim();
    const Q = /^[„“”"'‚‘’«»‹›\s]+|[„“”"'‚‘’«»‹›\s]+$/g;
    for (let i = 0; i < 3; i++) s = s.replace(Q, "").trim();
    return s;
  }
  /** Erklärung in Wörter mit Akzent-Markierung (*…*) zerlegen. */
  function tokenizeExpl(s, accentNums) {
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
        merged.push({ w: a.w + " " + b.w, accent: a.accent || b.accent, num: true }); i++;
      } else merged.push(a);
    }
    if (accentNums) for (const tk of merged) if (/\d/.test(tk.w) && !/^\d{4}[,.;:]?$/.test(tk.w)) tk.accent = true;
    // „ca.“ / „etwa“ nicht vom folgenden Zahlenwert trennen
    const out2 = [];
    for (let i = 0; i < merged.length; i++) {
      const a = merged[i], b = merged[i + 1];
      if (b && /^(ca\.|ca|~|≈|je|rund|etwa|über|unter|bis)$/i.test(a.w) && /^[~≈<>+−-]?\d/.test(b.w)) {
        if (!a.accent === !b.accent) { out2.push({ w: a.w + " " + b.w, accent: a.accent }); i++; }
        else out2.push({ ...a, glue: true }); // beim Umbruch mit dem Folgewort zusammenhalten
      } else out2.push(a);
    }
    return out2;
  }
  function parseExplItems(src, accentNums) {
    if (src === undefined || src === null || src === "") return [];
    const arr = Array.isArray(src) ? src : [src];
    const out = [];
    for (const it of arr) {
      let text, at;
      if (it && typeof it === "object") { text = pick(it, ["text", "label", "fact", "line", "t"]); at = num(it.at); }
      else text = it;
      const tokens = tokenizeExpl(str(text), accentNums);
      if (tokens.length) out.push({ tokens, at, raw: str(text) });
      if (out.length >= 3) break;
    }
    return out;
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
  /** Ausgewogener Umbruch in genau n Zeilen (DP, minimale quadratische Restbreite, keine Einzelwort-Schlusszeile). */
  function bestWrap(ctx, words, maxW, n, lastExtra) {
    const N = words.length;
    if (N > 40 || n < 2 || n > N) return null;
    const Wm = [];
    const segW = (i, j) => { const k = i * 64 + j; if (Wm[k] === undefined) Wm[k] = ctx.measureText(words.slice(i, j).join(" ")).width; return Wm[k]; };
    const INF = 1e18;
    const dp = [], from = [];
    for (let k = 0; k <= n; k++) { dp.push(new Array(N + 1).fill(INF)); from.push(new Array(N + 1).fill(-1)); }
    dp[0][0] = 0;
    for (let k = 1; k <= n; k++) {
      for (let j = k; j <= N; j++) {
        for (let i = k - 1; i < j; i++) {
          if (dp[k - 1][i] >= INF) continue;
          const last = j === N;
          if (last && k !== n) continue;
          const w = segW(i, j) + (last ? lastExtra : 0);
          if (w > maxW) continue;
          let c = Math.pow((maxW - w) / maxW, 2);
          if (last && j - i === 1) c += 4; // Waise vermeiden
          if (dp[k - 1][i] + c < dp[k][j]) { dp[k][j] = dp[k - 1][i] + c; from[k][j] = i; }
        }
      }
    }
    if (dp[n][N] >= INF) return null;
    const out = []; let j = N;
    for (let k = n; k >= 1; k--) { const i = from[k][j]; out.unshift(words.slice(i, j).join(" ")); j = i; }
    return out;
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
  function stampGeom(ctx, V, maxW) {
    let F = 118;
    for (; F > 40; F -= 2) {
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

  function computeLayout(ctx, S) {
    const V = S.V;
    const split = !!S.bg;
    const onScene = split && S.stampOn === "scene";
    const rowStamp = split && !onScene;
    const hasExpl = S.explItems.length > 0;
    const hasFooter = !!S.footer;
    const footH = hasFooter ? 60 : 0;
    const cx0 = split ? 110 : 170, cw = split ? 1030 : 1580;
    let ch = (hasExpl ? 676 : 560) + footH + (rowStamp ? 40 : 0);
    ch = Math.min(ch, 690);
    const cy0 = clamp(Math.round(548 - ch / 2), 200, 890 - ch);
    const card = { x: cx0, y: cy0, w: cw, h: ch };
    const cy1 = cy0 + ch;
    const headY = cy0 + 66;
    const div1 = cy0 + 98;
    const textX = cx0 + 130;
    const xR = cx0 + cw - 70;

    // --- Fußzeile ---
    const Fo = hasFooter ? { y: cy1 - 26, divY: cy1 - footH - 4, x0: cx0 + 80 } : null;

    // --- Erklärung (von unten nach oben) ---
    const E = { lines: [], size: 38, lh: 50, labelY: 0, divY: cy1 - 40, words: [], firstBase: 0 };
    if (hasExpl) {
      const maxW = cw - 200;
      const nI = S.explItems.length;
      const wrapAll = (w) => {
        const ls = [];
        S.explItems.forEach((it, ii) => { for (const ln of wrapTokens(ctx, it.tokens, w)) { ln.item = ii; ls.push(ln); } });
        return ls;
      };
      let size = 38, lines = null;
      for (size = 38; size >= 26; size -= 2) {
        setFont(ctx, EXPL_FONT.weight, size, EXPL_FONT.family, 0);
        lines = wrapAll(maxW);
        if (lines.length <= Math.max(2, nI)) break;
        if (size <= 30 && lines.length <= 3) break;
      }
      size = Math.max(26, size);
      setFont(ctx, EXPL_FONT.weight, size, EXPL_FONT.family, 0);
      if (!lines) lines = wrapAll(maxW);
      if (nI === 1 && lines.length > 1 && lines.length <= 3) lines = balance(lines.length, wrapAll, maxW) || lines;
      if (lines.length > 3) {
        lines = lines.slice(0, 3); const last = lines[2];
        if (last.length) last[last.length - 1] = { ...last[last.length - 1], w: last[last.length - 1].w.replace(/[.,;:]?$/, "…") };
      }
      const lh = Math.round(size * 1.34);
      const lastBase = cy1 - 52 - footH;
      const firstBase = lastBase - (lines.length - 1) * lh;
      const space = ctx.measureText(" ").width;
      const idxOf = {};
      const accW = (tk) => {
        if (!tk.accent) return ctx.measureText(tk.w).width;
        setFont(ctx, 800, size, EXPL_FONT.family, 0); const w = ctx.measureText(tk.w).width;
        setFont(ctx, EXPL_FONT.weight, size, EXPL_FONT.family, 0); return w;
      };
      lines.forEach((ln, li) => {
        let x = textX;
        for (const tk of ln) {
          const w = accW(tk);
          const it = ln.item || 0; idxOf[it] = (idxOf[it] || 0);
          E.words.push({ w: tk.w, accent: tk.accent, x, y: firstBase + li * lh, idx: idxOf[it]++, item: it });
          x += w + space;
        }
      });
      E.size = size; E.lh = lh; E.lines = lines;
      E.labelY = firstBase - size - 24;
      E.divY = E.labelY - 40;
      E.firstBase = firstBase;
    }

    // --- Stempel-Geometrie für die Zeile unter dem Zitat (Split) ---
    let rowG = null, rowH = 0;
    if (rowStamp) { rowG = stampGeom(ctx, V, 440); rowH = rowG.h + 14; }

    // --- Behauptung ---
    const regTop = div1 + 26, regBot = hasExpl ? E.divY - 26 : hasFooter ? Fo.divY - 22 : cy1 - 40;
    const regH = regBot - regTop - (rowStamp ? rowH : 0);
    const words = S.myth.split(" ");
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
        if (lines.length > 1) lines = bestWrap(ctx, words, maxW, lines.length, qW(size)) || balance(lines.length, (w) => wrapQ(w, size), maxW) || lines;
        const bh = (lines.length - 1) * size * 1.2 + size * 0.98;
        const maxL = size > 74 ? (hasExpl || rowStamp ? 2 : 3) : (size <= 48 ? 5 : 4);
        const lastL = lines[lines.length - 1] || "";
        const orphan = lines.length > 1 && !/\s/.test(lastL) && ctx.measureText(lastL).width < maxW * 0.3;
        if (lines.length <= maxL && bh <= regH - 10 && !orphan) break;
      }
      setFont(ctx, MYTH_FONT.weight, size, MYTH_FONT.family, 0);
      return { size, lines };
    };
    let textMaxW, stamp;
    if (!split) {
      textMaxW = 840; stamp = { cx: 1440, maxW: 530, mode: "card" };
    } else if (onScene) {
      textMaxW = cw - 200; stamp = { cx: SCN.x + SCN.w / 2, cy: S.bg.type === "film" ? FR.y + FR.h / 2 : SCN.y + SCN.h * 0.42, maxW: 500, mode: "scene" };
    } else {
      textMaxW = cw - 200; stamp = { maxW: 440, mode: "row", g: rowG };
    }
    let F = fit(textMaxW);
    if (!split && F.size < 56) { // lange Behauptung: breitere Textspalte, kompakterer Stempel
      textMaxW = 950; stamp = { cx: 1500, maxW: 450, mode: "card" };
      F = fit(textMaxW);
    }
    let size = F.size, lines = F.lines;
    setFont(ctx, MYTH_FONT.weight, size, MYTH_FONT.family, 0);
    const lh = Math.round(size * 1.2);
    const maxLines = Math.max(1, Math.floor((regH - size * 0.98) / lh) + 1);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/[\s.,;:!?]*$/, "") + "…"; }
    const blockH = (lines.length - 1) * lh + size * 0.98;
    let mid, top;
    if (rowStamp) {
      const total = blockH + rowH;
      top = (regTop + regBot) / 2 - total / 2;
      mid = top + blockH / 2;
      stamp.cy = top + blockH + rowH / 2 + 4;
      stamp.cx = xR - 24 - rowG.w / 2;
    } else {
      mid = (regTop + regBot) / 2; top = mid - blockH / 2;
    }
    const firstBase = top + size * 0.74;
    let start = 0;
    const M = { size, lh, lines: [], total: 0, x: textX, top, bottom: top + blockH, mid };
    lines.forEach((t, i) => {
      M.lines.push({ text: t, start, len: t.length, w: ctx.measureText(t).width, y: firstBase + i * lh });
      start += t.length;
    });
    M.total = start;
    for (const ln of M.lines) {
      ln.px = new Float32Array(ln.len + 1);
      for (let k = 1; k <= ln.len; k++) ln.px[k] = ctx.measureText(ln.text.slice(0, k)).width;
    }
    M.qr = Math.max(9, size * 0.2);
    if (stamp.mode === "card") stamp.cy = M.mid;
    return { card, headY, div1, E, M, Fo, stamp, hasExpl, split, xR };
  }
  function getLayout(ctx, S) {
    const ok = fontsReady();
    const key = [ok, S.myth, S.explItems.map((i) => i.raw).join("¦"), S.footer, S.footerLabel, S.bg ? S.bg.type : "", S.stampOn, S.V.key, S.accentNums].join("|");
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
  const RES = 1.5;
  function paintStamp(c, V, g) {
    const { F, w, h } = g;
    c.save();
    c.strokeStyle = V.color; c.fillStyle = V.color; c.lineJoin = "round";
    c.globalAlpha = 0.10; c.beginPath(); rrPath(c, -w / 2, -h / 2, w, h, F * 0.16); c.fill(); c.globalAlpha = 1;
    c.lineWidth = F * 0.085; c.beginPath(); rrPath(c, -w / 2, -h / 2, w, h, F * 0.16); c.stroke();
    const ins = F * 0.15;
    c.lineWidth = F * 0.03; c.beginPath(); rrPath(c, -w / 2 + ins, -h / 2 + ins, w - 2 * ins, h - 2 * ins, F * 0.08); c.stroke();
    setFont(c, 700, F, HEAD_FONT, F * 0.07);
    c.textAlign = "center"; c.textBaseline = "alphabetic";
    c.fillText(V.word, F * 0.035, F * 0.33);
    const dy = -h / 2 + ins + F * 0.13;
    for (const sx of [-1, 1]) {
      c.beginPath(); c.arc(sx * (w / 2 - ins - F * 0.14), dy, F * 0.035, 0, TAU); c.fill();
      c.beginPath(); c.arc(sx * (w / 2 - ins - F * 0.14), -dy, F * 0.035, 0, TAU); c.fill();
    }
    c.restore();
  }
  function buildStamp(mctx, V, maxW, rngFn) {
    const g = stampGeom(mctx, V, maxW);
    const m = 46;
    const cw = Math.ceil((g.w + 2 * m) * RES), ch = Math.ceil((g.h + 2 * m) * RES);
    const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
    const c = cv.getContext("2d");
    c.setTransform(RES, 0, 0, RES, cw / 2, ch / 2);
    paintStamp(c, V, g);
    const r = rngFn("myth-stamp-" + V.word);
    c.globalCompositeOperation = "destination-out";
    const W2 = g.w / 2 + 8, H2 = g.h / 2 + 8;
    const nDots = Math.round(900 * clamp((g.w * g.h) / (480 * 190), 0.35, 1.6));
    for (let i = 0; i < nDots; i++) {
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
    const gv = document.createElement("canvas"); gv.width = cw; gv.height = ch;
    const gc = gv.getContext("2d");
    try { gc.filter = `blur(${Math.round(14 * RES)}px)`; gc.drawImage(cv, 0, 0); gc.filter = "none"; }
    catch (e) { gc.shadowColor = V.color; gc.shadowBlur = 24; gc.drawImage(cv, 0, 0); }
    const sv = document.createElement("canvas"); sv.width = cw; sv.height = ch;
    const sc = sv.getContext("2d");
    try { sc.filter = `blur(${Math.round(16 * RES)}px)`; } catch (e) { /* ohne Weichzeichnung */ }
    sc.setTransform(RES, 0, 0, RES, cw / 2, ch / 2); sc.fillStyle = "rgba(0,0,0,0.9)";
    sc.beginPath(); rrPath(sc, -g.w / 2, -g.h / 2, g.w, g.h, g.F * 0.16); sc.fill();
    try { sc.filter = "none"; } catch (e) { /* */ }
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
    if (S && ok) { if (STAMPS.size > 24) STAMPS.clear(); STAMPS.set(key, S); }
    return S;
  }

  // ---------------- Zeitplan ----------------
  function timing(p, S, Lo) {
    const M = Lo.M;
    const d = Math.max(0.6, Number(p.d) || 6);
    const lo = Math.min(0.3, d * 0.1), hi = Math.max(lo, d - 0.3);
    const cl = (x) => clamp(x, lo, hi);
    const drop = 0.26;
    const cps = clamp(num(S.typeSpeed) ?? 30, 8, 120);
    let tType0 = S.typeAt !== undefined ? cl(S.typeAt) : clamp(0.08 * d, lo, 0.55);
    let typeDur = S.typeDur !== undefined ? clamp(S.typeDur, 0.15, d) : clamp(M.total / cps, 0.45, Math.max(0.45, 0.26 * d));
    const pause0 = clamp(0.07 * d, 0.25, 1.1);
    const noStamp = !S.showStamp;
    const tImp = noStamp ? 1e6 : S.stampAt !== undefined ? cl(S.stampAt) : Math.min(hi, tType0 + typeDur + pause0 + drop);
    const latest = noStamp ? hi - 0.3 : tImp - drop - 0.08; // Tippen endet vor dem Stempel-Fall
    if (tType0 + typeDur > latest) {
      if (latest - tType0 >= 0.3) typeDur = latest - tType0;
      else { tType0 = clamp(latest - 0.3, 0, tType0); typeDur = Math.max(0.12, latest - tType0); }
    }
    const tTypeEnd = tType0 + typeDur;
    const tDrop = tImp - drop;
    const tAfter = noStamp ? tTypeEnd + clamp(0.1 * d, 0.4, 1.2) : tImp + clamp(0.08 * d, 0.28, 0.9);
    const tExpl = S.explAt !== undefined ? cl(S.explAt) : Math.min(hi, tAfter);
    const gap = clamp(0.1 * d, 0.5, 1.2);
    const itemAt = [];
    S.explItems.forEach((it, i) => {
      if (it.at !== undefined) itemAt.push(cl(it.at));
      else itemAt.push(i === 0 ? tExpl : Math.min(hi, itemAt[i - 1] + gap));
    });
    const tExpl0 = itemAt.length ? Math.min(...itemAt) : tExpl;
    const tFooter = S.footerAt !== undefined ? cl(S.footerAt) : Math.min(hi, itemAt.length ? Math.max(...itemAt) + 0.5 : noStamp ? tAfter : tImp + 0.45);
    const bg = S.bg;
    const tBg = bg && bg.at !== undefined ? cl(bg.at) : 0;
    const tSparks = bg && bg.sparksAt !== undefined ? cl(bg.sparksAt) : Math.min(hi, tBg + clamp(0.06 * d, 0.2, 0.6));
    const tCross = S.crossAt !== undefined ? cl(S.crossAt) : noStamp ? Math.min(hi, tAfter) : Math.max(lo, tImp - (Lo.stamp.mode === "scene" ? 0.6 : 0.4));
    const tText = S.overlay ? clamp(S.overlay.at !== undefined ? S.overlay.at : 0.5, 0, Math.max(0, d - 1.2)) : 0;
    const tJudge = noStamp ? hi : tImp;
    return { d, tType0, typeDur, tTypeEnd, drop, tDrop, tImp, tJudge, tExpl, tExpl0, itemAt, tFooter, tBg, tSparks, tCross, tText };
  }

  // ---------------- Karte ----------------
  function drawCardFrame(ctx, L, Lo, t, V, impK, T) {
    const { card } = Lo;
    const a = eo(seg(t, 0, 0.55));
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = 0.9 * a;
    ctx.fillStyle = "rgba(7,20,42,0.88)"; ctx.beginPath(); rrPath(ctx, card.x, card.y, card.w, card.h, 18); ctx.fill();
    ctx.restore();
    const per = 2 * (card.w + card.h);
    const drawP = eo(seg(t, 0.05, 0.6));
    const borderCol = impK > 0 ? mixHex(COL.cyan, V.color, 0.55 * impK) : COL.cyan;
    L.glowPath(ctx, (c) => rrPath(c, card.x, card.y, card.w, card.h, 18), borderCol, 1.6, 0.5, { alpha: 0.55 * a, dash: [per * drawP, per + 10] });
    const bl = 34, off = 12, pul = 0.55 + 0.45 * Math.sin(T * 2.4);
    const corners = [[card.x - off, card.y - off, 1, 1], [card.x + card.w + off, card.y - off, -1, 1], [card.x - off, card.y + card.h + off, 1, -1], [card.x + card.w + off, card.y + card.h + off, -1, -1]];
    const cp = eo(seg(t, 0, 0.45));
    for (const [x, y, sx, sy] of corners) {
      L.poly(ctx, [[x, y + sy * bl * cp], [x, y], [x + sx * bl * cp, y]], impK > 0 ? V.color : COL.cyan, 2.5, 0.9, { alpha: a * (0.6 + 0.4 * pul) });
    }
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
  function drawComet(ctx, L, Lo, t, col, alpha) {
    const { card } = Lo; const per = 2 * (card.w + card.h);
    const pos = (t * 260) % per;
    gpath(ctx, (c) => rrPath(c, card.x, card.y, card.w, card.h, 18), col, 2.2, 1.2, { alpha, dash: [110, per - 110], dashOffset: -pos });
  }

  function drawHeader(ctx, L, Lo, t, S, V, tim, T) {
    const { card, headY, div1, xR } = Lo;
    const a = eo(seg(t, 0.1, 0.4));
    if (a <= 0) return;
    const x0 = card.x + 80;
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = COL.amber;
    ctx.fillRect(x0, headY - 24, 14, 26);
    ctx.restore();
    const full = S.label;
    const dp = seg(t, 0.15, 0.55);
    let shown = "";
    const nFix = Math.floor(full.length * dp);
    for (let i = 0; i < full.length; i++) {
      if (i < nFix || full[i] === " ") shown += full[i];
      else if (i < nFix + 3 && dp > 0) shown += SCRAMBLE[Math.floor(h01(i * 7.1 + Math.floor(t * 24)) * SCRAMBLE.length)];
    }
    L.text(ctx, shown, x0 + 30, headY, { font: MONO, weight: 700, size: 32, color: COL.amber, letterSpacing: 10, alpha: a, glow: 10, glowColor: COL.amber });
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
    const sx = xR - sw;
    const blink = t < tim.tImp ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(T * 9)) : 0.8 + 0.2 * Math.sin(T * 3);
    L.glowDot(ctx, sx - 24, headY - 9, 16, col, a * blink);
    L.fillCircle(ctx, sx - 24, headY - 9, 5, col);
    L.text(ctx, status, sx, headY, { font: MONO, weight: 700, size: 24, color: col, letterSpacing: 4, alpha: a * (t < tim.tImp ? 0.9 : lerp(0.4, 1, impK)) });
    L.text(ctx, "FAKTENCHECK", sx - 52, headY, { font: MONO, weight: 400, size: 22, color: COL.muted, letterSpacing: 5, align: "right", alpha: a * 0.8 });
    const lp = eo(seg(t, 0.2, 0.6));
    L.line(ctx, x0, div1, lerp(x0, xR, lp), div1, "rgba(63,210,255,0.35)", 1.5, 0.5, { alpha: a });
    if (t > tim.tType0 && t < tim.tImp + 0.4) {
      const pr = seg(t, tim.tType0, tim.tJudge - tim.tType0);
      const fa = 1 - seg(t, tim.tImp, 0.4);
      L.line(ctx, x0, div1, lerp(x0, xR, pr), div1, t < tim.tImp ? COL.cyan : V.color, 3, 1, { alpha: a * fa });
    }
  }

  /** Weicher Text-Glow der Behauptung als einmal gerendertes Sprite. */
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
    const dimTo = V.mark === "strike" ? 0.72 : 1;
    const textA = lerp(1, dimTo, impK);
    const qk = seg(t, tim.tImp + 0.08, 0.12);
    const qCol = qk > 0 ? mixHex(COL.cyan, V.color, qk) : COL.cyan;
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
    if (V.mark === "highlight" && t > tim.tImp) {
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
    let cursorX = M.x, cursorY = M.lines[0].y;
    for (let i = 0; i < M.lines.length; i++) {
      const ln = M.lines[i];
      const vis = clamp(n - ln.start, 0, ln.len);
      if (vis <= 0) continue;
      const s = vis >= ln.len ? ln.text : ln.text.slice(0, vis);
      if (GL) {
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
      if (typeP < 1 && vis < ln.len + 1 && n - ln.start <= ln.len) {
        const k0 = Math.max(0, vis - 3);
        const frag = ln.text.slice(k0, vis);
        if (frag.trim()) L.text(ctx, frag, M.x + ln.px[k0], ln.y, { font: MYTH_FONT.family, weight: MYTH_FONT.weight, size: M.size, color: COL.cyan, alpha: 0.9 });
      }
      cursorX = M.x + ln.px[vis]; cursorY = ln.y;
    }
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
    if (t > tim.tImp && V.mark !== "none" && V.mark !== "highlight") {
      M.lines.forEach((ln, i) => {
        const k = eo(seg(t, tim.tImp + 0.1 + i * 0.13, 0.3));
        if (k <= 0) return;
        const xa = M.x - 10, xb = M.x + ln.w + 14;
        const xe = lerp(xa, xb, k);
        if (V.mark === "strike") {
          const yb = ln.y - M.size * 0.3;
          const j1 = (h01(i * 3.3) - 0.5) * 8, j2 = (h01(i * 5.9) - 0.5) * 8;
          const pts = [];
          const N = 8;
          for (let q = 0; q <= N; q++) {
            const x = lerp(xa, xb, q / N); if (x > xe) { pts.push([xe, yb + lerp(j1, j2, (xe - xa) / (xb - xa))]); break; }
            pts.push([x, yb + lerp(j1, j2, q / N) + (h01(i * 11 + q) - 0.5) * 3]);
          }
          if (pts.length > 1) L.poly(ctx, pts, V.color, Math.max(3.5, M.size * 0.058), 0.9, { alpha: 0.9 });
        } else if (V.mark === "underline") {
          const yb = ln.y + M.size * 0.2;
          L.line(ctx, xa + 10, yb, xe, yb, V.color, Math.max(3, M.size * 0.05), 1, { alpha: 0.9 });
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

  function reticleAlpha(t, tim) { return eo(seg(t, 0.3, 0.6)) * (1 - seg(t, Math.min(tim.tImp, tim.d + 1) - 0.12, 0.14)); }
  function drawReticle(ctx, L, Lo, t, tim, T) {
    const { stamp } = Lo;
    const a = reticleAlpha(t, tim);
    if (a <= 0) return;
    const x = stamp.cx, y = stamp.cy;
    const active = seg(t, tim.tTypeEnd - 0.2, 0.3);
    const R = lerp(136, 118, active);
    const alpha = a * lerp(0.45, 0.9, active);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(T * lerp(0.25, 0.9, active));
    gpath(ctx, (c) => c.arc(0, 0, R, 0, TAU), COL.cyan, 2, 0, { alpha: alpha * 0.8, dash: [18, 14] });
    ctx.rotate(-T * lerp(0.25, 0.9, active) * 2.2);
    for (let i = 0; i < 3; i++) {
      const a0 = (i / 3) * TAU;
      L.arc(ctx, 0, 0, R * 0.78, a0, a0 + 0.9, COL.cyan, 3, 0.5, { alpha: alpha * 0.7 });
    }
    ctx.restore();
    const tk = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of tk) L.line(ctx, x + dx * (R + 10), y + dy * (R + 10), x + dx * (R + 34), y + dy * (R + 34), COL.cyan, 2, 0.6, { alpha });
    L.line(ctx, x - 14, y, x + 14, y, COL.cyan, 1.5, 0.4, { alpha: alpha * 0.8 });
    L.line(ctx, x, y - 14, x, y + 14, COL.cyan, 1.5, 0.4, { alpha: alpha * 0.8 });
    const pr = seg(t, tim.tType0, tim.tJudge - tim.tType0 - 0.05);
    const pct = Math.round(99 * eo(pr) + (pr >= 1 ? 1 : 0));
    if (stamp.mode === "scene") {
      L.text(ctx, `ANALYSE ${pct} %`, x, y + R + 62, { font: MONO, weight: 700, size: 22, color: COL.cyan, align: "center", letterSpacing: 4, alpha, stroke: 5, strokeColor: "rgba(2,6,14,0.85)" });
    } else {
      L.text(ctx, "ANALYSE", x, y + R + 60, { font: MONO, weight: 400, size: 20, color: COL.muted, align: "center", letterSpacing: 6, alpha: alpha * 0.9 });
      L.text(ctx, `${pct} %`, x, y + R + 94, { font: MONO, weight: 700, size: 30, color: COL.cyan, align: "center", letterSpacing: 2, alpha });
    }
  }
  /** Kompakter Ziel-Rahmen (Eckwinkel) für den Stempel unter dem Zitat. */
  function drawReticleRow(ctx, L, Lo, t, tim, T) {
    const { stamp } = Lo; const g = stamp.g; if (!g) return;
    const a = reticleAlpha(t, tim);
    if (a <= 0) return;
    const active = seg(t, tim.tTypeEnd - 0.2, 0.3);
    const alpha = a * lerp(0.4, 0.9, active);
    const x = stamp.cx, y = stamp.cy;
    const hw = g.w / 2 + lerp(34, 16, active) + 3 * Math.sin(T * 3), hh = g.h / 2 + lerp(22, 10, active) + 2 * Math.sin(T * 3);
    const bl = 26;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const cx = x + sx * hw, cy = y + sy * hh;
      L.poly(ctx, [[cx, cy - sy * bl], [cx, cy], [cx - sx * bl, cy]], COL.cyan, 2.2, 0.7, { alpha });
    }
    // Suchlauf
    const ph = (T * 0.9) % 1;
    const sxp = lerp(x - hw + 8, x + hw - 8, sm(ph < 0.5 ? ph * 2 : 2 - ph * 2));
    L.line(ctx, sxp, y - hh + 8, sxp, y + hh - 8, COL.cyan, 1.5, 0.8, { alpha: alpha * 0.5 });
    const pr = seg(t, tim.tType0, tim.tJudge - tim.tType0 - 0.05);
    const pct = Math.round(99 * eo(pr) + (pr >= 1 ? 1 : 0));
    L.text(ctx, "ANALYSE", x, y - 4, { font: MONO, weight: 400, size: 20, color: COL.muted, align: "center", letterSpacing: 6, alpha: alpha * 0.9 });
    L.text(ctx, `${pct} %`, x, y + 30, { font: MONO, weight: 700, size: 28, color: COL.cyan, align: "center", letterSpacing: 2, alpha });
  }

  /** Ziel-Rahmen um die Hintergrund-Szene (Stempel auf die Szene). */
  function drawSceneTarget(ctx, L, Lo, t, tim, T, S) {
    const a = reticleAlpha(t, tim);
    if (a <= 0) return;
    const film = S.bg && S.bg.type === "film";
    const R = film ? FR : { x: SCN.x + 30, y: SCN.y + 60, w: SCN.w - 60, h: SCN.h - 120 };
    const active = seg(t, tim.tTypeEnd - 0.2, 0.3);
    const alpha = a * lerp(0.45, 0.95, active);
    const o = lerp(22, 8, active) + 2.5 * Math.sin(T * 3);
    const bl = 34;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const cx = sx < 0 ? R.x - o : R.x + R.w + o, cy = sy < 0 ? R.y - o : R.y + R.h + o;
      L.poly(ctx, [[cx, cy - sy * bl], [cx, cy], [cx - sx * bl, cy]], COL.cyan, 2.5, 0.9, { alpha });
    }
    const pr = seg(t, tim.tType0, tim.tJudge - tim.tType0 - 0.05);
    const pct = Math.round(99 * eo(pr) + (pr >= 1 ? 1 : 0));
    const ly = film ? FR.y + FR.h + 58 : R.y - 22;
    const bw = 230 * eo(pr);
    L.line(ctx, R.x + R.w / 2 - 115, ly + 16, R.x + R.w / 2 - 115 + bw, ly + 16, COL.cyan, 3, 1, { alpha });
    L.line(ctx, R.x + R.w / 2 - 115 + bw, ly + 16, R.x + R.w / 2 + 115, ly + 16, "rgba(63,210,255,0.25)", 3, 0, { alpha });
    L.text(ctx, `ANALYSE ${pct} %`, R.x + R.w / 2, ly, { font: MONO, weight: 700, size: 22, color: COL.cyan, align: "center", letterSpacing: 4, alpha });
  }

  function drawScan(ctx, Lo, t, tim, V) {
    const { card, M } = Lo;
    let y, a, col;
    if (t > tim.tTypeEnd - 0.1 && t < tim.tImp) {
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
      sc = lerp(2.1, 1, e); rot = lerp(rot0 - 16 * DEG, rot0, e); alpha = clamp(k * 3.2, 0, 1);
    } else {
      sc = 1 - 0.07 * Math.exp(-dt * 13) * Math.cos(dt * 34);
      rot = rot0 + 0.6 * DEG * Math.exp(-dt * 9) * Math.sin(dt * 40);
      alpha = 1;
    }
    const g = ST ? ST.g : null;
    const w = g ? g.w : 480, h = g ? g.h : 180;
    const lift = dt < 0 ? sc - 1 : 0;
    if (ST && !(ST.hb && dt > 0.65)) {
      ctx.save();
      ctx.translate(x + 22 * lift + 6, y + 36 * lift + 8); ctx.rotate(rot); ctx.scale(lerp(1, 1.25, lift / 1.1) / RES, lerp(1, 1.25, lift / 1.1) / RES);
      ctx.globalAlpha = dt < 0 ? 0.55 * alpha * (1 - lift / 1.6) : 0.55;
      ctx.drawImage(ST.sv, -ST.cw / 2, -ST.ch / 2);
      ctx.restore();
    }
    if (dt < 0 && ST) {
      for (let gI = 1; gI <= 2; gI++) {
        const kk = clamp(k - gI * 0.12, 0, 1); const e = ei(kk);
        const s2 = lerp(2.1, 1, e);
        ctx.save(); ctx.translate(x, y); ctx.rotate(lerp(rot0 - 16 * DEG, rot0, e)); ctx.scale(s2 / RES, s2 / RES);
        ctx.globalAlpha = 0.16 * alpha / gI; ctx.drawImage(ST.cv, -ST.cw / 2, -ST.ch / 2); ctx.restore();
      }
    }
    if (ST && ST.hb && dt > 0.65) {
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
    if (dt >= 0 && dt < 1.0) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot0);
      for (let r = 0; r < 2; r++) {
        const kk = seg(dt, r * 0.08, 0.55); if (kk <= 0 || kk >= 1) continue;
        const s = 1 + 0.32 * eo(kk) + r * 0.08;
        L.glowPath(ctx, (c) => rrPath(c, -w * s / 2, -h * s / 2, w * s, h * s, 20 * s), V.color, lerp(4, 1, kk), 1, { alpha: (1 - kk) * (1 - kk) * 0.85 });
      }
      const life = 0.75;
      if (dt < life) {
        const q = dt / life;
        ctx.fillStyle = V.color;
        const spread = stamp.mode === "row" ? 0.55 : 1;
        for (let i = 0; i < 38; i++) {
          const a = h01(i * 3.7 + 1) * TAU;
          const ex = Math.cos(a), ey = Math.sin(a);
          const bx = ex * w * 0.5, by = ey * h * 0.5;
          const dist = (26 + 150 * h01(i * 9.1)) * spread * eo(Math.min(1, q * 1.6));
          const px = bx + ex * dist, py = by + ey * dist + 40 * q * q;
          const rr = (1.5 + 4.5 * h01(i * 1.9)) * (1 - q * 0.7);
          ctx.globalAlpha = (1 - q) * 0.9;
          ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill();
          if (i % 4 === 0) { ctx.globalAlpha = (1 - q) * 0.5; ctx.beginPath(); ctx.arc(px - ex * rr * 2.2, py - ey * rr * 2.2, rr * 0.55, 0, TAU); ctx.fill(); }
        }
      }
      ctx.restore();
      const fl = 1 - seg(dt, 0, 0.35);
      if (fl > 0) L.glowDot(ctx, x, y, stamp.mode === "row" ? 300 : 420, rgba(V.rgb, 0.5), fl * 0.7);
    }
  }

  function drawExplanation(ctx, L, Lo, t, tim, S, T) {
    const { E, card } = Lo;
    if (!Lo.hasExpl || t < tim.tExpl0 - 0.05) return;
    const x0 = card.x + 80;
    const a = eo(seg(t, tim.tExpl0, 0.4));
    const lp = eo(seg(t, tim.tExpl0, 0.5));
    L.line(ctx, x0, E.divY, lerp(x0, Lo.xR, lp), E.divY, "rgba(63,210,255,0.35)", 1.5, 0.4, { alpha: a });
    if (S.factLabel) {
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = COL.cyan;
      ctx.beginPath(); ctx.moveTo(x0 + 2, E.labelY - 20); ctx.lineTo(x0 + 16, E.labelY - 11); ctx.lineTo(x0 + 2, E.labelY - 2); ctx.closePath(); ctx.fill();
      ctx.restore();
      L.text(ctx, S.factLabel, Lo.M.x, E.labelY, { font: MONO, weight: 700, size: 24, color: COL.cyan, letterSpacing: 7, alpha: a });
    }
    // linker Akzentbalken: wächst mit den Einträgen
    let shownLines = 0;
    E.lines.forEach((ln) => { if (t >= (tim.itemAt[ln.item || 0] ?? tim.tExpl0) - 0.02) shownLines++; });
    const lastItemAt = tim.itemAt.length ? Math.max(...tim.itemAt.filter((v) => v <= t + 0.02)) : tim.tExpl0;
    const barFull = (Math.max(1, shownLines) - 1) * E.lh + E.size * 0.95;
    const barPrev = Math.max(0, shownLines - 2) * E.lh + (shownLines > 1 ? E.size * 0.95 : 0);
    const bh = lerp(shownLines > 1 ? barPrev : 0, barFull, eo(seg(t, lastItemAt + 0.1, 0.5)));
    ctx.save(); ctx.globalAlpha = a * (0.6 + 0.3 * Math.sin(T * 2.2)); ctx.fillStyle = COL.cyan;
    ctx.fillRect(x0 + 6, E.firstBase - E.size * 0.78, 4, bh);
    ctx.restore();
    const counts = {};
    for (const wd of E.words) counts[wd.item] = (counts[wd.item] || 0) + 1;
    for (const wd of E.words) {
      const at = tim.itemAt[wd.item] ?? tim.tExpl0;
      const nW = counts[wd.item] || 1;
      // alle Wörter sind spätestens kurz vor Szenenende vollständig sichtbar
      const span = clamp(tim.d - 0.25 - at - 0.1, 0.12, 1.0);
      const fade = Math.min(0.35, 0.08 + span * 0.35);
      const stag = Math.min(0.05, Math.min(0.7, 0.12 * tim.d) / Math.max(1, nW), Math.max(0, span - fade) / Math.max(1, nW - 1));
      const k = seg(t, at + Math.min(0.15, span * 0.15) + wd.idx * stag, fade);
      if (k <= 0) continue;
      const e = eo(k);
      L.text(ctx, wd.w, wd.x, wd.y + (1 - e) * 14, { font: EXPL_FONT.family, weight: wd.accent ? 800 : EXPL_FONT.weight, size: E.size, color: wd.accent ? COL.amber : COL.body, alpha: e });
    }
  }

  function drawFooter(ctx, L, Lo, t, tim, S, T) {
    const Fo = Lo.Fo; if (!Fo) return;
    const a = eo(seg(t, tim.tFooter, 0.45));
    if (a <= 0) return;
    const x0 = Fo.x0;
    L.line(ctx, x0, Fo.divY, lerp(x0, Lo.xR, eo(seg(t, tim.tFooter, 0.6))), Fo.divY, "rgba(143,179,217,0.28)", 1, 0, { alpha: a, dash: [6, 6] });
    // Symbol: kleiner Prüfschein (Rahmen + Zeilen)
    const iy = Fo.y - 20;
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = COL.amber; ctx.lineWidth = 2;
    ctx.beginPath(); rrPath(ctx, x0, iy, 18, 22, 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0 + 4, iy + 7); ctx.lineTo(x0 + 14, iy + 7); ctx.moveTo(x0 + 4, iy + 12); ctx.lineTo(x0 + 14, iy + 12); ctx.moveTo(x0 + 4, iy + 17); ctx.lineTo(x0 + 10, iy + 17); ctx.stroke();
    ctx.restore();
    let x = x0 + 36;
    if (S.footerLabel) {
      L.text(ctx, S.footerLabel, x, Fo.y - 2, { font: MONO, weight: 700, size: 22, color: COL.amber, letterSpacing: 5, alpha: a * 0.9 });
      ctx.save(); setFont(ctx, 700, 22, MONO, 5); x += ctx.measureText(S.footerLabel).width + 24; ctx.restore();
      L.text(ctx, "·", x - 13, Fo.y - 2, { font: MONO, weight: 700, size: 22, color: COL.muted, align: "center", alpha: a });
      x += 8;
    }
    const e = eo(seg(t, tim.tFooter + 0.1, 0.45));
    L.text(ctx, S.footer, x + (1 - e) * 16, Fo.y, { font: "Inter", weight: 600, size: 31, color: COL.white, alpha: a * e });
  }

  function drawAmbient(ctx, T, W, H) {
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

  /** Overlay-Box oben links – exakt wie die Engine (für ownsText-Szenen mit eigener Behauptung). */
  function drawOverlay(ctx, L, text, t, d, at) {
    if (!text) return;
    const a = Math.min(seg(t, at, 0.45), 1 - seg(t, d - 0.3 - 0.45, 0.45)); if (a <= 0) return;
    const size = 40; const x = 90; const y = 150;
    const up = upper(text);
    const w = L.measure(ctx, up, { size, weight: 700, font: L.FONT.head, letterSpacing: 2 }) + 70;
    const slide = eo(seg(t, at, 0.5));
    ctx.save(); ctx.globalAlpha = a;
    L.fillRect(ctx, x, y - size - 14, 8, size + 34, L.C.amber);
    L.panel(ctx, x + 14, y - size - 14, w * slide, size + 34, { fill: "rgba(4,12,26,0.82)", stroke: L.C.amberSoft, r: 4, alpha: a });
    L.text(ctx, up, x + 44, y + 2, { size, weight: 700, font: L.FONT.head, letterSpacing: 2, color: L.C.white, alpha: a * seg(t, at + 0.25, 0.35) });
    ctx.restore();
  }

  // ---------------- Hintergrund-Szenen (Split-Layout, rechts) ----------------
  const BGCACHE = new Map();
  function cached(key, build) {
    if (BGCACHE.has(key)) return BGCACHE.get(key);
    let cv = null;
    try { cv = build(); } catch (e) { cv = null; }
    BGCACHE.set(key, cv);
    return cv;
  }
  function figure(g, L, x, y, h, color, alpha, o) {
    o = o || {};
    const s = h / 180;
    g.save(); g.globalAlpha = alpha; g.fillStyle = color;
    if (o.dress) {
      g.beginPath(); g.arc(x, y - 165 * s, 14 * s, 0, TAU); g.fill();
      g.beginPath(); rrPath(g, x - 18 * s, y - 145 * s, 36 * s, 62 * s, 10 * s); g.fill();
      g.beginPath(); g.moveTo(x - 16 * s, y - 92 * s); g.lineTo(x + 16 * s, y - 92 * s); g.quadraticCurveTo(x + 44 * s, y - 20 * s, x + 46 * s, y); g.lineTo(x - 46 * s, y); g.quadraticCurveTo(x - 44 * s, y - 20 * s, x - 16 * s, y - 92 * s); g.fill();
      g.beginPath(); g.arc(x, y - 170 * s, 19 * s, Math.PI * 1.05, Math.PI * 1.95); g.lineTo(x + 20 * s, y - 160 * s); g.lineTo(x - 20 * s, y - 160 * s); g.closePath(); g.fill();
    } else {
      g.beginPath(); g.arc(x, y - 165 * s, 15 * s, 0, TAU); g.fill();
      g.beginPath(); rrPath(g, x - 22 * s, y - 145 * s, 44 * s, 75 * s, 12 * s); g.fill();
      if (o.coat) { g.beginPath(); g.moveTo(x - 22 * s, y - 80 * s); g.lineTo(x + 22 * s, y - 80 * s); g.lineTo(x + 27 * s, y - 40 * s); g.lineTo(x - 27 * s, y - 40 * s); g.closePath(); g.fill(); }
      g.fillRect(x - 20 * s, y - 75 * s, 16 * s, 75 * s); g.fillRect(x + 4 * s, y - 75 * s, 16 * s, 75 * s);
    }
    if (o.hat === "top") { g.fillRect(x - 11 * s, y - 204 * s, 22 * s, 26 * s); g.fillRect(x - 18 * s, y - 181 * s, 36 * s, 4.5 * s); }
    if (o.arms) {
      g.strokeStyle = color; g.lineCap = "round"; g.lineJoin = "round"; g.lineWidth = 10.5 * s;
      const sh = [[x - 17 * s, y - 136 * s], [x + 17 * s, y - 136 * s]];
      o.arms.forEach((hand, i) => {
        if (!hand) return; const S0 = sh[i === 0 ? 0 : 1];
        g.beginPath(); g.moveTo(S0[0], S0[1]);
        if (hand.length > 2) g.lineTo(hand[2], hand[3]);
        g.lineTo(hand[0], hand[1]); g.stroke();
      });
    }
    g.restore();
  }
  // Otis-Vorführung (Crystal Palace, New York 1854): offener Holzturm mit Sägezahn-Sperrleisten, Plattform
  // mit Wagenfeder und Sperrklinken, Tragseil gekappt, Otis zieht den Hut, Publikum davor.
  const OT = { cx: 1510, G: 850, xL: 1400, xR: 1620, top: 250, spring: 404, bar: 412, deck: 590 };
  function buildOtis(L) {
    const cv = document.createElement("canvas"); cv.width = SCN.w; cv.height = SCN.h;
    const g = cv.getContext("2d");
    g.translate(-SCN.x, -SCN.y);
    const { cx, G, xL, xR, top } = OT;
    const ink = COL.sepia, pale = COL.pale;
    // Lichtkegel/Halo hinter der Plattform
    const hg = g.createRadialGradient(cx, 520, 20, cx, 520, 340);
    hg.addColorStop(0, "rgba(255,179,71,0.13)"); hg.addColorStop(1, "rgba(255,179,71,0)");
    g.fillStyle = hg; g.fillRect(SCN.x, SCN.y, SCN.w, SCN.h);
    // Ausstellungshalle: Kuppelbogen + Stützen (sehr dezent)
    L.arc(g, cx, 600, 300, Math.PI + 0.12, TAU - 0.12, ink, 1.5, 0.4, { alpha: 0.22 });
    L.arc(g, cx, 600, 276, Math.PI + 0.16, TAU - 0.16, ink, 1, 0, { alpha: 0.14 });
    for (let i = 1; i < 8; i++) {
      const an = Math.PI + (i / 8) * Math.PI;
      L.line(g, cx + Math.cos(an) * 276, 600 + Math.sin(an) * 276, cx + Math.cos(an) * 300, 600 + Math.sin(an) * 300, ink, 1, 0, { alpha: 0.2 });
    }
    for (const x of [1222, 1798]) L.line(g, x, 560, x, G, ink, 2, 0.3, { alpha: 0.2 });
    // Boden
    L.line(g, SCN.x + 14, G, SCN.x + SCN.w - 14, G, ink, 2, 0.5, { alpha: 0.5 });
    g.save(); g.strokeStyle = ink; g.globalAlpha = 0.18; g.lineWidth = 1; g.beginPath();
    for (let x = SCN.x + 24; x < SCN.x + SCN.w - 14; x += 18) { g.moveTo(x, G + 2); g.lineTo(x - 10, G + 12); }
    g.stroke(); g.restore();
    // Turm: zwei Holzpfosten mit Sägezahn-Sperrleisten
    for (const [xo, xi] of [[xL - 8, xL + 8], [xR + 8, xR - 8]]) {
      g.save(); g.fillStyle = "rgba(40,24,8,0.55)"; g.fillRect(Math.min(xo, xi), top, 16, G - top); g.restore();
      L.line(g, xo, top, xo, G, ink, 2, 0.6, { alpha: 0.75 });
      L.line(g, xi, top, xi, G, ink, 1.5, 0.3, { alpha: 0.6 });
      const dir = Math.sign(xo < xi ? 1 : -1);
      const pts = [];
      for (let y = top + 40; y < G - 12; y += 16) { pts.push([xi, y]); pts.push([xi + dir * 9, y + 13]); pts.push([xi, y + 16]); }
      L.poly(g, pts, ink, 1.4, 0.3, { alpha: 0.7 });
    }
    // Streben
    L.line(g, xL - 8, 650, xL - 78, G, ink, 2, 0.4, { alpha: 0.55 });
    L.line(g, xR + 8, 650, xR + 78, G, ink, 2, 0.4, { alpha: 0.55 });
    // Querhaupt + Umlenkrolle
    g.save(); g.fillStyle = "rgba(40,24,8,0.6)"; g.fillRect(xL - 22, top - 14, xR - xL + 44, 14); g.restore();
    L.rect(g, xL - 22, top - 14, xR - xL + 44, 14, ink, 1.6, 0.5, { alpha: 0.75 });
    L.circle(g, cx, top - 22, 14, pale, 2, 0.6, { alpha: 0.7 });
    L.fillCircle(g, cx, top - 22, 3, pale);
    // Tragseil: oben gekappt (ausgefranste Enden)
    L.line(g, cx, top - 8, cx, 300, pale, 2, 0.4, { alpha: 0.65 });
    L.poly(g, [[cx, 300], [cx - 5, 309]], COL.red, 1.6, 0.6, { alpha: 0.6 });
    L.poly(g, [[cx, 300], [cx + 4, 310]], COL.red, 1.6, 0.6, { alpha: 0.6 });
    L.line(g, cx, 330, cx, OT.spring - 8, pale, 2, 0.4, { alpha: 0.65 });
    L.poly(g, [[cx, 330], [cx - 5, 321]], COL.red, 1.6, 0.6, { alpha: 0.6 });
    L.poly(g, [[cx, 330], [cx + 4, 320]], COL.red, 1.6, 0.6, { alpha: 0.6 });
    // Wagenfeder (Blattfeder) + Querhaupt der Plattform
    L.glowPath(g, (c) => { c.moveTo(cx - 62, OT.spring + 2); c.quadraticCurveTo(cx, OT.spring - 22, cx + 62, OT.spring + 2); c.quadraticCurveTo(cx, OT.spring - 4, cx - 62, OT.spring + 2); }, pale, 1.8, 0.6, { alpha: 0.75 });
    L.line(g, cx - 62, OT.spring + 2, cx + 62, OT.spring + 2, ink, 1.4, 0, { alpha: 0.5 });
    L.rect(g, xL + 12, OT.bar, xR - xL - 24, 10, ink, 1.6, 0.4, { alpha: 0.7 });
    // Sperrklinken-Gestänge (Federenden → Klinken an den Zähnen)
    L.line(g, cx - 62, OT.spring + 2, xL + 16, OT.bar - 8, pale, 1.6, 0.4, { alpha: 0.6 });
    L.line(g, cx + 62, OT.spring + 2, xR - 16, OT.bar - 8, pale, 1.6, 0.4, { alpha: 0.6 });
    // Plattform-Seitenteile, Boden, Unterzug
    L.line(g, xL + 14, OT.bar, xL + 14, OT.deck, ink, 2, 0.4, { alpha: 0.7 });
    L.line(g, xR - 14, OT.bar, xR - 14, OT.deck, ink, 2, 0.4, { alpha: 0.7 });
    g.save(); g.fillStyle = "rgba(40,24,8,0.7)"; g.fillRect(xL + 8, OT.deck, xR - xL - 16, 12); g.restore();
    L.rect(g, xL + 8, OT.deck, xR - xL - 16, 12, ink, 1.6, 0.5, { alpha: 0.8 });
    L.poly(g, [[xL + 14, OT.deck + 12], [cx, OT.deck + 40], [xR - 14, OT.deck + 12]], ink, 1.4, 0.3, { alpha: 0.55 });
    // Ladung: Kisten
    for (const [bx, by, bw, bh] of [[1532, 548, 50, 42], [1542, 524, 32, 24]]) {
      g.save(); g.fillStyle = "rgba(40,24,8,0.6)"; g.fillRect(bx, by, bw, bh); g.restore();
      L.rect(g, bx, by, bw, bh, ink, 1.3, 0.3, { alpha: 0.7 });
      L.line(g, bx, by, bx + bw, by + bh, ink, 1, 0, { alpha: 0.45 }); L.line(g, bx + bw, by, bx, by + bh, ink, 1, 0, { alpha: 0.45 });
    }
    // Otis (Silhouette ohne Gesicht) zieht den Zylinder
    const s = 124 / 180, mx = 1466, yf = OT.deck;
    const hand = [mx + 58 * s, yf - 214 * s, mx + 46 * s, yf - 164 * s];
    figure(g, L, mx, yf, 124, pale, 0.62, { coat: true, arms: [[mx - 26 * s, yf - 70 * s, mx - 28 * s, yf - 104 * s], hand] });
    g.save(); g.globalAlpha = 0.62; g.fillStyle = pale;
    g.fillRect(hand[0] - 9 * s, hand[1] - 30 * s, 18 * s, 26 * s); g.fillRect(hand[0] - 15 * s, hand[1] - 6 * s, 30 * s, 4.5 * s);
    g.restore();
    // Publikum (Silhouetten)
    const crowd = [[1232, 84, 1, 0], [1268, 92, 0, 1], [1306, 80, 0, 0], [1342, 90, 1, 0], [1386, 76, 0, 1], [1640, 82, 0, 0], [1676, 94, 1, 0], [1712, 78, 0, 1], [1748, 88, 1, 0], [1790, 80, 0, 0]];
    crowd.forEach(([x, h, top2, dress], i) => figure(g, L, x, G + 10 + (i % 2) * 6, h, pale, 0.34 + 0.08 * h01(i * 1.7), { hat: top2 ? "top" : null, dress: !!dress }));
    return cv;
  }
  function drawOtisBg(ctx, L, t, tim, T) {
    const cv = cached("otis", () => buildOtis(L));
    const a = tim.tBg > 0.05 ? eo(seg(t, tim.tBg, 0.7)) : eo(seg(t, 0, 0.35));
    if (a <= 0) return;
    if (cv) {
      ctx.save(); ctx.globalAlpha = a * (0.88 + 0.06 * Math.sin(T * 0.8)); ctx.drawImage(cv, SCN.x, SCN.y); ctx.restore();
    }
    // Sperrklinken halten (Amber-Puls) – leises Leben
    const pl = 0.55 + 0.45 * Math.sin(T * 2.2);
    for (const x of [OT.xL + 16, OT.xR - 16]) {
      L.glowDot(ctx, x, OT.bar - 6, 20, COL.amber, a * 0.55 * pl);
      L.fillCircle(ctx, x, OT.bar - 6, 3.5, COL.amber);
    }
    // aufsteigende Lichtpartikel
    ctx.save(); ctx.fillStyle = COL.pale;
    for (let i = 0; i < 12; i++) {
      const per = 7 + 5 * h01(i * 2.3);
      const ph = ((T + h01(i * 5.1) * per) % per) / per;
      const x = SCN.x + 40 + h01(i * 3.7) * (SCN.w - 80) + Math.sin(T * 0.7 + i) * 8;
      const y = lerp(OT.G - 20, SCN.y + 60, ph);
      ctx.globalAlpha = a * 0.35 * Math.sin(ph * Math.PI);
      ctx.beginPath(); ctx.arc(x, y, 1.3 + 1.4 * h01(i * 9.3), 0, TAU); ctx.fill();
    }
    ctx.restore();
    L.text(ctx, "NEW YORK · 1854", OT.cx, 886, { font: MONO, weight: 700, size: 18, color: COL.sepia, align: "center", letterSpacing: 5, alpha: a * 0.8 });
  }

  // Film-Szene: Filmstreifen mit Perforation, im Bild rast eine Kabine an zwei Führungsschienen abwärts,
  // Funken sprühen an den Fangvorrichtungen (Kino-Klischee). Wird durchgestrichen und eingefroren.
  const CAR = { x: 1422, y: 548, w: 176, h: 176 };
  const RAIL_L = CAR.x - 27, RAIL_R = CAR.x + CAR.w + 27;
  function buildFilmStrip(L) {
    const cv = document.createElement("canvas"); cv.width = SCN.w; cv.height = SCN.h;
    const g = cv.getContext("2d");
    g.translate(-SCN.x, -SCN.y);
    const sx0 = 1214, sw = 592, y0 = SCN.y, y1 = SCN.y + SCN.h;
    g.fillStyle = "rgba(3,7,15,0.94)"; g.beginPath(); rrPath(g, sx0, y0, sw, y1 - y0, 6); g.fill();
    g.fillStyle = "rgba(255,179,71,0.045)"; g.fillRect(sx0, y0, 46, y1 - y0); g.fillRect(sx0 + sw - 46, y0, 46, y1 - y0);
    // Perforation ausstanzen (Hintergrund scheint durch)
    const holes = [];
    for (let y = y0 + 12; y < y1 - 30; y += 44) { holes.push([sx0 + 13, y]); holes.push([sx0 + sw - 33, y]); }
    g.globalCompositeOperation = "destination-out"; g.fillStyle = "#000";
    g.beginPath(); for (const [x, y] of holes) rrPath(g, x, y, 20, 26, 4); g.fill();
    g.globalCompositeOperation = "source-over";
    g.strokeStyle = "rgba(255,179,71,0.4)"; g.lineWidth = 1.2;
    g.beginPath(); for (const [x, y] of holes) rrPath(g, x, y, 20, 26, 4); g.stroke();
    // Bildfelder: Hauptbild + angeschnittene Nachbarbilder
    const frames = [[y0 + 6, FR.y - 12], [FR.y, FR.y + FR.h], [FR.y + FR.h + 12, y1 - 6]];
    for (const [a, b] of frames) {
      const gr = g.createLinearGradient(0, a, 0, b);
      gr.addColorStop(0, "#0b1a33"); gr.addColorStop(1, "#050c1a");
      g.fillStyle = gr; g.beginPath(); rrPath(g, FR.x, a, FR.w, b - a, 5); g.fill();
    }
    // Schachtwand-Fugen (statisch, dezent) + Schienen in den Nachbarbildern
    g.save(); g.globalAlpha = 0.5;
    for (const [a, b] of [frames[0], frames[2]]) {
      g.fillStyle = "rgba(159,196,230,0.35)"; g.fillRect(RAIL_L - 5, a, 10, b - a); g.fillRect(RAIL_R - 5, a, 10, b - a);
    }
    g.restore();
    // Führungsschienen (T-Profil) im Hauptbild – statisch, daher im Cache
    g.save(); g.beginPath(); rrPath(g, FR.x, FR.y, FR.w, FR.h, 5); g.clip();
    for (const rx of [RAIL_L, RAIL_R]) {
      L.line(g, rx, FR.y, rx, FR.y + FR.h, COL.steel, 9, 0.5, { alpha: 0.85, cap: "butt" });
      L.line(g, rx + (rx < 1500 ? -9 : 9), FR.y, rx + (rx < 1500 ? -9 : 9), FR.y + FR.h, "rgba(159,196,230,0.45)", 3, 0, { cap: "butt" });
    }
    g.restore();
    // Bildrand
    g.strokeStyle = "rgba(255,179,71,0.5)"; g.lineWidth = 1.5;
    for (const [a, b] of frames) { g.beginPath(); rrPath(g, FR.x, a, FR.w, b - a, 5); g.stroke(); }
    // Innen-Vignette des Hauptbilds
    const vg = g.createRadialGradient(FR.x + FR.w / 2, FR.y + FR.h / 2, FR.h * 0.25, FR.x + FR.w / 2, FR.y + FR.h / 2, FR.h * 0.78);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.55)");
    return { cv, vg };
  }
  function sparkStream(ctx, x, y, ts, o, bright, dim) {
    const n = o.count, life = o.life, P = life * 1.7;
    for (let i = 0; i < n; i++) {
      const ph = h01(o.seed * 31 + i * 1.13) * P;
      const lt = ts + ph; const cyc = Math.floor(lt / P); const age = lt - cyc * P;
      if (age > life || ts - age < 0) continue;
      const hs = o.seed * 13 + i * 7 + cyc * 3.3;
      const ang = o.dir + (h01(hs) - 0.5) * o.spread;
      const sp = o.speed * (0.35 + 0.65 * h01(hs + 1.7));
      const px = x + Math.cos(ang) * sp * age, py = y + Math.sin(ang) * sp * age + 0.5 * o.g * age * age;
      const a2 = Math.max(0, age - (o.tail || 0.035));
      const qx = x + Math.cos(ang) * sp * a2, qy = y + Math.sin(ang) * sp * a2 + 0.5 * o.g * a2 * a2;
      const arr = age < life * 0.45 ? bright : dim;
      arr.push(px, py, qx, qy);
    }
  }
  function strokeSegs(ctx, arr, color, width, alpha) {
    if (!arr.length) return;
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = 0; i < arr.length; i += 4) { ctx.moveTo(arr[i], arr[i + 1]); ctx.lineTo(arr[i + 2], arr[i + 3]); }
    ctx.stroke();
  }
  function drawFilmBg(ctx, L, K, t, tim, T, V) {
    const B = cached("film", () => buildFilmStrip(L));
    const a = tim.tBg > 0.05 ? eo(seg(t, tim.tBg, 0.6)) : eo(seg(t, 0, 0.35));
    if (a <= 0) return;
    const cross = !!(tim.crossOn);
    const frozen = cross && t >= tim.tCross;
    const tf = frozen ? tim.tCross : t; // Film friert beim Durchstreichen ein
    const ts = Math.max(0, tf - tim.tSparks);
    const run = eo(seg(tf, tim.tSparks, 0.5)); // Fahrt/Funken setzen ein
    const fi = Math.floor(tf * 24);
    ctx.save();
    ctx.globalAlpha = a;
    if (B) ctx.drawImage(B.cv, SCN.x, SCN.y);
    // --- Hauptbild (geclippt) ---
    ctx.save();
    ctx.beginPath(); rrPath(ctx, FR.x, FR.y, FR.w, FR.h, 5); ctx.clip();
    const scroll = tf * 60 + ts * 1100 * run; // Fahrtweg (px)
    // Schachtwand-Fugen, nach oben rasend
    ctx.strokeStyle = "rgba(143,179,217,0.13)"; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let k = 0; k < 8; k++) { const y = FR.y + ((k * 70 - scroll) % 490 + 490) % 490; ctx.moveTo(FR.x, y); ctx.lineTo(FR.x + FR.w, y); }
    ctx.stroke();
    // Schienen (T-Profil) mit vorbeirasenden Halterungen
    for (const rx of [RAIL_L, RAIL_R]) {
      ctx.fillStyle = "rgba(159,196,230,0.5)";
      for (let k = 0; k < 4; k++) {
        const y = FR.y + ((k * 150 - scroll * 1.0) % 600 + 600) % 600 - 60;
        const len = lerp(14, 90, run);
        ctx.fillRect(rx + (rx < 1500 ? -26 : 8), y, 18, len);
      }
    }
    // Tragseile gerissen, peitschen über der Kabine
    const jx = Math.sin(T * 57) * 2.2 * run, jy = Math.sin(T * 43) * 2 * run;
    const cx = CAR.x + jx, cy = CAR.y + jy;
    for (let i = 0; i < 3; i++) {
      const rx = cx + CAR.w / 2 + (i - 1) * 12;
      const wh = Math.sin(tf * 9 + i * 1.7) * 16 * run;
      L.poly(ctx, [[rx, cy - 26], [rx + wh * 0.4, cy - 70], [rx + wh, cy - 118 - i * 10]], COL.cyan, 2.4, 0.6, { alpha: 0.8 });
      L.line(ctx, rx + wh, cy - 118 - i * 10, rx + wh * 1.15 - 5, cy - 130 - i * 10, COL.red, 2.2, 0.8, { alpha: 0.9 });
    }
    // Kabine
    const carS = cached("filmcar", () => {
      if (!K || !K.car) return null;
      const pad = 48, cv = document.createElement("canvas");
      cv.width = CAR.w + 2 * pad; cv.height = CAR.h + 2 * pad;
      const g = cv.getContext("2d"); g.translate(pad, pad);
      K.car(g, 0, 0, CAR.w, CAR.h, { people: 2, safetyColor: COL.amber });
      return { cv, pad };
    });
    if (carS) ctx.drawImage(carS.cv, Math.round(cx - carS.pad), Math.round(cy - carS.pad));
    else if (K && K.car) K.car(ctx, cx, cy, CAR.w, CAR.h, { people: 2, safetyColor: COL.amber });
    // Glühen + Funken an den Fangvorrichtungen (Funkenfontänen nach oben, Kino-Klischee)
    const spots = [[RAIL_L + 5, cy + CAR.h + 11, -1, 1], [RAIL_R - 5, cy + CAR.h + 11, 1, 1], [RAIL_L + 5, cy - 13, -1, 0], [RAIL_R - 5, cy - 13, 1, 0]];
    if (run > 0) {
      const flick = 0.75 + 0.25 * h01(fi * 1.31);
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (const [x, y, s, main] of spots) L.glowDot(ctx, x, y, (main ? 130 : 70) * flick, COL.amber, 0.65 * run);
      ctx.restore();
      const bright = [], dim = [];
      spots.forEach(([x, y, s, main], si) => {
        sparkStream(ctx, x, y, ts, { count: main ? 46 : 18, life: main ? 0.66 : 0.42, seed: si + 3, dir: -Math.PI / 2 + s * 0.2, spread: main ? 0.8 : 0.65, speed: main ? 1100 : 720, g: 900, tail: 0.055 }, bright, dim);
        if (main) sparkStream(ctx, x, y, ts, { count: 22, life: 0.5, seed: si + 11, dir: -Math.PI / 2 + s * 1.1, spread: 1.0, speed: 680, g: 1400, tail: 0.045 }, bright, dim);
      });
      ctx.save(); ctx.lineCap = "round"; ctx.globalCompositeOperation = "lighter";
      strokeSegs(ctx, bright, COL.amber, 10, 0.2 * run);
      strokeSegs(ctx, dim, COL.amber, 6, 0.12 * run);
      strokeSegs(ctx, dim, "#ffc877", 2.4, 0.75 * run);
      strokeSegs(ctx, bright, "#fff0c8", 3, 1 * run);
      ctx.restore();
      ctx.save(); ctx.fillStyle = "#fff1d0"; ctx.beginPath();
      for (const [x, y, s, main] of spots) { const r = main ? 6 : 4; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
      ctx.fill(); ctx.restore();
    }
    // Fahrtstreifen (Speed-Lines)
    if (run > 0) {
      ctx.save(); ctx.strokeStyle = "rgba(210,235,255,1)"; ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.16 * run; ctx.beginPath();
      for (let k = 0; k < 14; k++) {
        const x = FR.x + 20 + h01(k * 4.1) * (FR.w - 40);
        const len = 60 + 140 * h01(k * 2.9);
        const y = FR.y + ((h01(k * 7.3) * 700 - ts * 1600 * (0.7 + 0.6 * h01(k))) % 700 + 700) % 700 - 100;
        ctx.moveTo(x, y); ctx.lineTo(x, y + len);
      }
      ctx.stroke(); ctx.restore();
    }
    // Filmkorn, Kratzer, Flackern
    if (B) { ctx.fillStyle = B.vg; ctx.fillRect(FR.x, FR.y, FR.w, FR.h); }
    if (!frozen) {
      ctx.save();
      ctx.fillStyle = "rgba(255,240,220,1)"; ctx.globalAlpha = 0.035 * h01(fi * 0.77); ctx.fillRect(FR.x, FR.y, FR.w, FR.h);
      if (h01(fi * 1.7) > 0.55) { ctx.globalAlpha = 0.22; ctx.fillRect(FR.x + h01(fi * 3.3) * FR.w, FR.y, 1.2, FR.h); }
      ctx.globalAlpha = 0.35;
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(FR.x + h01(fi * 5.1 + k) * FR.w, FR.y + h01(fi * 6.7 + k * 2.1) * FR.h, 0.8 + 1.6 * h01(fi + k * 9.2), 0, TAU); ctx.fill(); }
      ctx.restore();
    } else {
      const fk = eo(seg(t, tim.tCross, 0.35));
      ctx.save(); ctx.globalAlpha = 0.5 * fk; ctx.fillStyle = "#040a16"; ctx.fillRect(FR.x, FR.y, FR.w, FR.h);
      ctx.globalAlpha = 0.09 * fk; ctx.fillStyle = V.color; ctx.fillRect(FR.x, FR.y, FR.w, FR.h); ctx.restore();
    }
    ctx.restore(); // clip
    // Kopfzeile im oberen Nachbarbild: Klappe + „FILMSZENE“
    const ly = SCN.y + 50;
    ctx.save(); ctx.strokeStyle = COL.amber; ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.rect(FR.x + 24, ly - 14, 34, 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(FR.x + 22, ly - 18); ctx.lineTo(FR.x + 58, ly - 28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(FR.x + 30, ly - 20); ctx.lineTo(FR.x + 34, ly - 14); ctx.moveTo(FR.x + 40, ly - 23); ctx.lineTo(FR.x + 44, ly - 14); ctx.moveTo(FR.x + 50, ly - 25); ctx.lineTo(FR.x + 54, ly - 16); ctx.stroke();
    ctx.restore();
    L.text(ctx, "FILMSZENE", FR.x + 72, ly + 7, { font: MONO, weight: 700, size: 22, color: COL.amber, letterSpacing: 6, alpha: 0.9 });
    const rec = frozen ? "STOP" : "▶ " + String(Math.floor(tf)).padStart(2, "0") + ":" + String(Math.floor((tf % 1) * 24)).padStart(2, "0");
    L.text(ctx, rec, FR.x + FR.w - 22, ly + 7, { font: MONO, weight: 700, size: 20, color: frozen ? V.color : COL.muted, align: "right", letterSpacing: 3, alpha: 0.9 });
    // Durchstreichen: großes X über das Bild
    if (cross && t >= tim.tCross) {
      const k1 = eo(seg(t, tim.tCross, 0.26)), k2 = eo(seg(t, tim.tCross + 0.16, 0.26));
      const x0 = FR.x + 26, y0 = FR.y + 26, x1 = FR.x + FR.w - 26, y1 = FR.y + FR.h - 26;
      const pw = 1 + 0.25 * Math.exp(-(t - tim.tCross) * 4);
      if (k1 > 0) L.line(ctx, x0, y0, lerp(x0, x1, k1), lerp(y0, y1, k1), V.color, 10 * pw, 1.1, { alpha: 0.92 });
      if (k2 > 0) L.line(ctx, x1, y0, lerp(x1, x0, k2), lerp(y0, y1, k2), V.color, 10 * pw, 1.1, { alpha: 0.92 });
      const fl = 1 - seg(t, tim.tCross, 0.3);
      if (fl > 0) L.glowDot(ctx, FR.x + FR.w / 2, FR.y + FR.h / 2, 300, rgba(V.rgb, 0.4), fl * 0.6);
    }
    ctx.restore();
  }

  // ---------------- Haupt-Draw ----------------
  function readState(p) {
    const P = (p && p.params && typeof p.params === "object") ? p.params : {};
    const mythParam = pick(P, ["myth", "claim", "mythos", "statement", "behauptung", "quote", "title"]);
    let myth = cleanMyth(Array.isArray(mythParam) ? mythParam.join(" ") : mythParam);
    const txtRaw = str(p.text).trim();
    const txt = cleanMyth(txtRaw);
    let textIsMyth = false;
    if (!myth && txt) { myth = txt; textIsMyth = true; }
    if (!myth) myth = DEFAULT_MYTH;
    const textRole = str(pick(P, ["textAs", "textRole", "textMode"])).trim().toLowerCase() || "overlay";
    const accentNums = bool(P.accentNumbers, true);
    let explSrc = pick(P, ["explanation", "fact", "facts", "fakt", "subline", "erklaerung", "erklärung", "reason", "detail", "body", "subtitle"]);
    if (explSrc === undefined && !textIsMyth && txtRaw && textRole === "explanation") explSrc = txtRaw;
    const explItems = parseExplItems(explSrc, accentNums);
    const V = buildVerdict(P);
    let label = str(pick(P, ["label", "kicker"])).trim();
    if (!label && !textIsMyth && txtRaw && /^(header|label|kicker)$/.test(textRole)) label = txtRaw;
    label = upper(label || "MYTHOS");
    const nr = pick(P, ["number", "nr", "index", "no"]);
    if (nr !== undefined && str(nr).trim()) label += " #" + str(nr).trim();
    const flRaw = P.factLabel ?? P.explanationLabel ?? P.factTitle;
    const factLabel = flRaw === "" || flRaw === false ? "" : upper(str(flRaw).trim() || "FAKT");
    // Fußzeile
    let footRaw = pick(P, ["footer", "source", "quelle", "credit", "footnote"]);
    let footer = "", footerLabelRaw, footerAt;
    if (footRaw && typeof footRaw === "object") { footer = str(pick(footRaw, ["text", "label", "source"])); footerLabelRaw = footRaw.label !== undefined && footRaw.text !== undefined ? footRaw.label : undefined; footerAt = num(footRaw.at); }
    else footer = str(footRaw);
    footer = footer.replace(/\s+/g, " ").trim();
    const flr = footerLabelRaw ?? P.footerLabel ?? P.sourceLabel;
    const footerLabel = flr === "" || flr === false ? "" : upper(str(flr).trim() || "QUELLE");
    // Hintergrund-Szene
    const bgRaw = pick(P, ["background", "bg", "backdrop"]);
    let bg = null;
    if (bgRaw && bgRaw !== true) {
      const o = typeof bgRaw === "object" && !Array.isArray(bgRaw) ? bgRaw : { type: bgRaw };
      const name = str(o.type || o.name || o.kind || o.variant).trim().toLowerCase();
      let type = null;
      if (/(otis|1854|demo|vorf(ü|ue)hrung|crystal|historic|silhouette)/.test(name)) type = "otis";
      else if (/(spark|funken|kino|film|movie|cinema|safety|fang|rail|schiene)/.test(name)) type = "film";
      if (type) {
        bg = {
          type, at: num(o.at) ?? num(P.backgroundAt) ?? num(P.bgAt),
          sparksAt: num(o.sparksAt) ?? num(P.sparksAt), crossAt: num(o.crossAt),
          cross: bool(o.crossOut ?? o.cross ?? P.crossOut ?? P.cross, /(cross|durchgestrichen|strike|x_?out)/.test(name)),
        };
      }
    }
    const so = str(pick(P, ["stampOn", "stampTarget", "stampPos"])).trim().toLowerCase();
    let stampOn = bg && bg.type === "film" ? "scene" : "quote";
    if (bg && /(scene|szene|background|bg|film|bild)/.test(so)) stampOn = "scene";
    else if (/(quote|card|karte|zitat|myth|text)/.test(so)) stampOn = "quote";
    // Zeiten
    const beats = Array.isArray(P.beats) ? P.beats : [];
    const B = (i) => num(beats[i]);
    const overlay = !textIsMyth && txtRaw && textRole === "overlay" && bool(P.overlay, true) ? { text: txtRaw, at: num(P.textAt) } : null;
    return {
      myth, explItems, V, label, factLabel, footer, footerLabel, bg, stampOn, overlay, accentNums,
      typeSpeed: pick(P, ["typeSpeed", "cps"]), typeDur: num(P.typeDur),
      typeAt: B(0) ?? num(P.typeAt) ?? num(P.mythAt),
      stampAt: B(1) ?? num(P.stampAt) ?? num(P.verdictAt),
      explAt: B(2) ?? num(P.explanationAt) ?? num(P.factAt) ?? num(P.sublineAt) ?? num(P.explAt),
      footerAt: B(3) ?? footerAt ?? num(P.footerAt) ?? num(P.sourceAt),
      crossAt: B(4) ?? (bg ? bg.crossAt : undefined) ?? num(P.crossAt),
      cameraSafe: bool(P.cameraSafe, true), focus: P.focus,
      showStamp: bool(P.showStamp ?? P.showVerdict, true),
    };
  }

  /** Skalierung, die den Inhalt auch bei Kamera-Zoom/-Pan/-Tilt der Engine im Sicherheitsrand hält
      (Overlay oben links und Untertitelzone bleiben frei). */
  function cameraFit(Lo, S, cam, fx, fy, W) {
    let s = 1, dx = 0, dy = 0;
    if (cam === "slow_push_in" || cam === "slow_pull_out") s = 1.1;
    else if (cam === "pan_left" || cam === "pan_right") { s = 1.08; dx = 60; }
    else if (cam === "tilt_up" || cam === "tilt_down") { s = 1.08; dy = 45; }
    else return 1;
    const c = Lo.card;
    const x0 = c.x - 14, x1 = Lo.split ? SCN.x + SCN.w : c.x + c.w + 14;
    const y0 = Math.min(c.y - 14, Lo.split ? SCN.y : 1e9), y1 = Math.max(c.y + c.h + 14, Lo.split ? SCN.y + SCN.h : 0);
    const top = S.overlay ? 182 : 90, bot = 910, left = 90, right = W - 90;
    let k = 1;
    const lim = (num0, den) => { if (den > 1e-6) k = Math.min(k, num0 / den); };
    lim(fx - dx - left, s * (fx - x0)); lim(right - fx - dx, s * (x1 - fx));
    lim(fy - dy - top, s * (fy - y0)); lim(bot - fy - dy, s * (y1 - fy));
    return clamp(k, 0.75, 1);
  }

  function draw(ctx, p) {
    const L = p.L || (window.CE && window.CE.lib);
    if (!L) return;
    const W = p.W || 1920, H = p.H || 1080;
    const t = Math.max(0, Number(p.t) || 0);
    const T = Number(p.T) || t;
    let S = null, failed = false, tim = null;
    ctx.save();
    try {
      try { ctx.letterSpacing = "0px"; } catch (e) { /* */ }
      S = readState(p);
      const V = S.V;
      const Lo = getLayout(ctx, S);
      tim = timing(p, S, Lo);
      tim.crossOn = !!(S.bg && S.bg.cross);
      const ST = getStamp(ctx, V, Lo.stamp.maxW, L);
      drawAmbient(ctx, T, W, H);
      // Kamera-Ausgleich: Zoom/Pan der Engine soll den Inhalt nicht über den Sicherheitsrand schieben
      const cam = str(p.scene && p.scene.camera).toLowerCase();
      const f = Array.isArray(S.focus) ? S.focus : [0.5, 0.5];
      const fx = (Number(f[0]) || 0.5) * W, fy = (Number(f[1]) || 0.5) * H;
      const kz = S.cameraSafe ? cameraFit(Lo, S, cam, fx, fy, W) : 1;
      if (kz !== 1) { ctx.translate(fx, fy); ctx.scale(kz, kz); ctx.translate(-fx, -fy); }
      // Aufprall: Kamera-Stoß + Wackeln (klingt schnell ab)
      const dt = t - tim.tImp;
      if (dt >= 0 && dt < 0.9) {
        const dec = Math.exp(-dt * 6.5);
        const A = (Lo.stamp.mode === "card" ? 15 : 11) * dec;
        const sx = A * (0.65 * Math.sin(dt * 73) + 0.35 * Math.sin(dt * 41 + 1.3));
        const sy = A * (0.65 * Math.cos(dt * 67 + 0.4) + 0.35 * Math.sin(dt * 37 + 2.1));
        const punch = 1 + 0.018 * Math.exp(-dt * 9);
        ctx.translate(Lo.stamp.cx + sx, Lo.stamp.cy + sy);
        ctx.rotate(0.25 * DEG * dec * Math.sin(dt * 53));
        ctx.scale(punch, punch);
        ctx.translate(-Lo.stamp.cx, -Lo.stamp.cy);
      }
      if (S.bg) {
        if (S.bg.type === "otis") drawOtisBg(ctx, L, t, tim, T);
        else drawFilmBg(ctx, L, p.K || (window.CE && window.CE.kit), t, tim, T, V);
      }
      const impK = Lo.stamp.mode === "scene" ? 0 : seg(t, tim.tImp, 0.3);
      drawCardFrame(ctx, L, Lo, t, V, impK, T);
      if (t > 0.7) drawComet(ctx, L, Lo, t, seg(t, tim.tImp, 0.3) > 0 ? V.color : COL.cyan, 0.55 * seg(t, 0.7, 0.4));
      drawHeader(ctx, L, Lo, t, S, V, tim, T);
      drawScan(ctx, Lo, t, tim, V);
      if (Lo.stamp.mode === "row") drawReticleRow(ctx, L, Lo, t, tim, T);
      else if (Lo.stamp.mode === "card") drawReticle(ctx, L, Lo, t, tim, T);
      drawMyth(ctx, L, Lo, t, V, tim, T);
      drawExplanation(ctx, L, Lo, t, tim, S, T);
      drawFooter(ctx, L, Lo, t, tim, S, T);
      if (Lo.stamp.mode === "scene") drawSceneTarget(ctx, L, Lo, t, tim, T, S);
      drawStampLayer(ctx, L, Lo, t, tim, V, ST);
      const fl = 1 - seg(t - tim.tImp, 0, 0.3);
      if (t >= tim.tImp && fl > 0) {
        ctx.save(); ctx.globalAlpha = 0.14 * fl; ctx.fillStyle = V.color;
        ctx.beginPath();
        if (Lo.stamp.mode === "scene") rrPath(ctx, FR.x, FR.y, FR.w, FR.h, 5); else rrPath(ctx, Lo.card.x, Lo.card.y, Lo.card.w, Lo.card.h, 18);
        ctx.fill(); ctx.restore();
      }
    } catch (e) {
      failed = true;
    }
    ctx.restore();
    // Overlay-Box im Bildschirmraum (unabhängig von Kamera/Stoß), wie die Engine
    if (!failed && S && S.overlay && tim) {
      try {
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        drawOverlay(ctx, L, S.overlay.text, t, tim.d, tim.tText);
        ctx.restore();
      } catch (e) { /* */ }
    }
    if (failed) {
      try {
        ctx.save();
        L.text(ctx, "„" + ((S && S.myth) || DEFAULT_MYTH) + "“", W / 2, H / 2, { size: 56, align: "center", color: COL.white, font: "Inter", weight: 800 });
        ctx.restore();
      } catch (e2) { /* */ }
    }
  }

  CEX.register("myth_card", { ownsText: true, draw });
})();
