/* Template „end_card“ – YouTube-Endscreen (letzte 10–20 s) im Stil „Visual Science“.
   Platzhalter an festen Endscreen-Positionen (hier werden später die echten YouTube-Endscreen-Elemente
   überlagert): links großer 16:9-Rahmen „nächstes Video“ mit animierter Röntgen-Skizze (Reihenvierzylinder:
   rotierende Kurbelwelle, Pleuel, Kolben, Schwungrad + Drehzahlmesser), rechts optional kleiner 16:9-Rahmen
   „zweites Video“ (Zahnrad-Skizze) und ein runder Abo-Platzhalter (Iris-Emblem, KEIN YouTube-Logo).
   Dazu Titel des nächsten Videos, Kanalname, Claim und optional Schlusssatz mit Aufzug-Ruftaster ▲▼.
   ownsText: p.text wird als Kopfzeile oben links (Engine-Stil, bündig mit dem großen Rahmen) gezeichnet.
   Kamera: Standardmäßig wird die Engine-Kamera ignoriert (followCamera:false), damit die Platzhalter exakt
   an ihren Pixelpositionen bleiben.

   BEATS (params.beats, Sekunden ab Szenenstart, geklemmt auf [0,3; d−0,3]):
     [0] = Endscreen-Rahmen zeichnen sich auf (großes Video; 2. Video +0,25·ts; Abo-Kreis +0,45·ts) + Kopfzeile
     [1] = Titel des nächsten Videos erscheint Wort für Wort unter dem großen Rahmen
     [2] = Drehzahlmesser: Nadel läuft vom Leerlauf auf rpm hoch, Digitalanzeige zählt mit, Kurbelwelle dreht hoch
     [3] = Kanalname (Scan-Einblendung) + kurz danach der Claim
     [4] = Schlusssatz (signoff) mit Ruftaster-Symbol
   "at" (Sekunden, schlägt beats): slots[i].at (je Platzhalter), labels[i].at (Bauteil-Beschriftungen in der Skizze),
     headerAt, titleAt, rpmAt (bzw. rpm.at), channelAt, taglineAt, signoffAt, subscribeAt.
   Ohne Angaben skaliert das Default-Timing mit d: b0 0,3 s · b1 0,19·d · b2 0,33·d · b3 0,45·d · b4 0,56·d
   (ts = clamp(d/10; 0,45; 1) skaliert Animationsdauern).

   params:
     next_title  Titel unter dem großen Rahmen (Aliase: teaser, nextTitle, title). *Wort* = Amber-Akzent,
                 Zahlen (+ direkt folgende Einheit) werden automatisch Amber (highlightNumbers:false = aus).
     channel     Kanalname (Standard "Visual Science", in Versalien)      tagline  Claim (Standard s. u.; "" = aus)
     signoff     Schlusssatz (Standard aus)                              header   Kopfzeile statt p.text (false = aus)
     slots       Liste der Platzhalter: "next_video" | "second_video" | "subscribe" oder
                 {type, at, title}. Standard: alle drei. Nur ein Video -> es steht immer im großen Rahmen.
     teaser_visual "crankshaft" (Standard; Aliase engine, motor, crankshaft_rotating) | "gears" | "none"
     rpm         Zahl | "8.000" | {value, at, max, redline, unit} | false. Standard 8000 bei crankshaft.
                 rpmMax (Standard aufgerundet ~1,18·rpm), redline (Standard 0,85·max), rpmUnit ("U/min"),
                 rpmOvershoot bzw. rpm.overshoot (Nadel-Überschwingen, Standard 0,8; 0 = keins). Die Digital-
                 anzeige zählt immer nur bis zum Zielwert hoch (zeigt nie mehr als rpm).
     labels      Bauteil-Beschriftungen in der Motor-Skizze: Standard ["kurbelwelle"]; false = keine;
                 Einträge "kurbelwelle" | "kolben" | "pleuel" | "schwungrad" oder {part, text, at}
     second_title Unterzeile unter dem kleinen Rahmen (Standard leer), secondLabel Kicker (Standard "EMPFOHLEN")
     subscribeLabel  Text unter dem Abo-Kreis (Standard "ABONNIEREN", "" = aus)
     frameLabel  Kicker über dem großen Rahmen, nur wenn keine Kopfzeile (Standard "NÄCHSTES VIDEO")
     followCamera true = Engine-Kamera anwenden (Platzhalter wandern dann mit – nicht empfohlen)
   Layout (Pixel, 1920×1080): großes Video x120 y228 880×495 (mit 2. Video 832×468); Abo-Kreis rechts
   (Ø 284 px, mit 2. Video Ø 180 px); 2. Video 560×315 rechts oben. Unterkante aller Inhalte ≤ 910 px. */
(function () {
  "use strict";
  const CEX = window.CE;
  if (!CEX || typeof CEX.register !== "function") return;

  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const C = { cyan: "#3fd2ff", amber: "#ffb347", red: "#ff5a5f", white: "#eef6ff", muted: "#8fb3d9", steel: "#9fc4e6" };
  const DEF_TITLE = "Was passiert im Motor bei 8.000 U/min?";
  const DEF_CHANNEL = "Visual Science";
  const DEF_TAGLINE = "Mehr unsichtbare Technik sichtbar gemacht";
  const F_HEAD = "Oxanium", F_BODY = "Inter", F_MONO = "JetBrains Mono";

  // ---------------- Helfer ----------------
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (t, a, dur) => clamp((t - a) / Math.max(1e-6, dur), 0, 1);
  const eo = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const sm = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const backOut = (x, c1) => { x = clamp(x, 0, 1); const c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const h01 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const num = (v) => {
    if (v === undefined || v === null || v === "" || typeof v === "boolean") return undefined;
    if (typeof v === "string") {
      let s = v.trim().replace(/\s*(u\/min|1\/min|\/min|rpm|s)$/i, "");
      if (/^[+-]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "");
      const n = Number(s.replace(",", "."));
      return isFinite(n) ? n : undefined;
    }
    const n = Number(v); return isFinite(n) ? n : undefined;
  };
  const pick = (o, keys) => { if (!o || typeof o !== "object") return undefined; for (const k of keys) { const v = o[k]; if (v !== undefined && v !== null) return v; } return undefined; };
  const OFF = /^(0|false|nein|no|off|aus|none|keine?|hide|hidden)$/i;
  const isOff = (v) => v === false || v === 0 || (typeof v === "string" && OFF.test(v.trim()));
  const toBool = (v, d) => { if (v === undefined || v === null || v === "") return d; if (typeof v === "string") return /^(1|true|ja|yes|on|an|y)$/i.test(v.trim()); return !!v; };
  const upper = (s) => { try { return String(s).toLocaleUpperCase("de-DE"); } catch (e) { return String(s).toUpperCase(); } };
  const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const fmtInt = (v) => (v < 0 ? "−" : "") + String(Math.round(Math.abs(v))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const strOr = (v, d) => (v === undefined || v === null || (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") ? d : isOff(v) ? "" : v === true ? d : clean(v));

  function setFont(ctx, weight, size, family, ls) {
    ctx.font = `${weight} ${size}px "${family}"`;
    try { ctx.letterSpacing = `${ls || 0}px`; } catch (e) { /* ältere Canvas-Implementierung */ }
  }
  /** Glühender Pfad: Pfad einmal bauen, dreimal streichen; alpha multipliziert (statt L.glowPath, das alpha setzt). */
  function gp(ctx, build, color, width, glow, alpha, dash, cap) {
    if (!(alpha > 0.004)) return;
    ctx.save(); ctx.lineCap = cap || "round"; ctx.lineJoin = "round"; if (dash) ctx.setLineDash(dash);
    ctx.strokeStyle = color; ctx.beginPath(); build(ctx);
    if (glow < 0) { ctx.globalAlpha = alpha * 0.2 * -glow; ctx.lineWidth = width * 3.4; ctx.stroke(); }
    else if (glow > 0) {
      ctx.globalAlpha = alpha * 0.10 * glow; ctx.lineWidth = width * 7; ctx.stroke();
      ctx.globalAlpha = alpha * 0.22 * glow; ctx.lineWidth = width * 3.2; ctx.stroke();
    }
    ctx.globalAlpha = alpha; ctx.lineWidth = width; ctx.stroke();
    ctx.restore();
  }
  function fillPath(ctx, build, fill, alpha) {
    if (!(alpha > 0.004)) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.beginPath(); build(ctx); ctx.fill(); ctx.restore();
  }
  function txt(ctx, s, x, y, o) {
    const a = o.alpha ?? 1; if (!(a > 0.004) || !s) return;
    ctx.save(); ctx.globalAlpha = a; setFont(ctx, o.weight || 600, o.size || 30, o.font || F_BODY, o.ls);
    ctx.textAlign = o.align || "left"; ctx.textBaseline = "alphabetic";
    if (o.glow) { ctx.shadowColor = o.glowColor || o.color || C.cyan; ctx.shadowBlur = o.glow; }
    ctx.fillStyle = o.color || C.white; ctx.fillText(s, x, y); ctx.restore();
  }
  const MEAS = new Map();
  function measure(ctx, s, weight, size, family, ls) {
    const key = `${weight}|${size}|${family}|${ls || 0}|${s}`; const hit = MEAS.get(key); if (hit !== undefined) return hit;
    ctx.save(); setFont(ctx, weight, size, family, ls); const w = ctx.measureText(s).width; ctx.restore();
    if (MEAS.size > 400) MEAS.clear(); MEAS.set(key, w); return w;
  }
  /** Zeichnet eine umbrochene Zeile; Wörter mit gleichem Stil und fertig eingeblendet werden zu Läufen zusammengefasst. */
  function drawLine(ctx, ln, x0, y, o, wordAlpha, styleOf) {
    let run = null;
    const flush = () => { if (run) { txt(ctx, run.s, run.x, y, run.o); run = null; } };
    for (const wd of ln.words) {
      const a = wordAlpha(wd); if (a <= 0) { flush(); continue; }
      const st = styleOf(wd);
      if (a >= 1 && run && run.key === st.key) { run.s += " " + wd.w; continue; }
      flush();
      if (a >= 1) run = { s: wd.w, x: x0 + wd.x, key: st.key, o: Object.assign({}, o, st.o, { alpha: 1 }) };
      else txt(ctx, wd.w, x0 + wd.x, y + (1 - eo(a)) * (o.rise || 0), Object.assign({}, o, st.o, { alpha: a }));
    }
    flush();
  }
  function glowDot(ctx, x, y, r, color, alpha) {
    if (!(alpha > 0.004) || !(r > 0)) return;
    ctx.save(); ctx.globalAlpha = alpha; const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(0.25, color + "99"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
  }

  /** Bitmap-Cache für statische Teile (Skala, Kanalname mit Glow). Nur wenn die Schriften geladen sind. */
  const BMP = new Map();
  function fontsOk(spec) { try { return !document.fonts || document.fonts.check(spec); } catch (e) { return false; } }
  function cached(key, w, h, paint, fontSpec) {
    let cv = BMP.get(key); if (cv) return cv;
    if (fontSpec && !fontsOk(fontSpec)) return null;
    try { cv = document.createElement("canvas"); cv.width = Math.max(1, Math.ceil(w)); cv.height = Math.max(1, Math.ceil(h)); paint(cv.getContext("2d")); } catch (e) { return null; }
    if (BMP.size > 24) BMP.clear(); BMP.set(key, cv); return cv;
  }

  // ---------------- Text mit Akzenten + Umbruch (gecacht) ----------------
  const UNIT_RE = /^(U\/min|1\/min|\/min|min⁻¹|km\/h|m\/s²?|%|kg|t|mm|cm|m|km|s|ms|bar|kW|PS|Nm|°C|g|Hz|kN|N)[.,!?:;]*$/;
  function tokenize(str, autoNum) {
    const words = clean(str).split(" ").filter(Boolean); const out = []; let acc = false;
    for (let i = 0; i < words.length; i++) {
      let w = words[i]; let a = acc;
      if (w.startsWith("*")) { w = w.slice(1); a = true; acc = true; }
      const m = w.match(/\*([.,!?:;"“”]*)$/); if (m) { w = w.slice(0, w.length - m[0].length) + m[1]; acc = false; }
      if (!w) continue;
      if (autoNum && /\d/.test(w)) a = true;
      if (autoNum && out.length && /\d/.test(out[out.length - 1].w) && UNIT_RE.test(w)) a = true;
      out.push({ w, acc: a });
    }
    return out;
  }
  const LAYOUT_CACHE = new Map();
  /** Passt Text in maxW: probiert Größen absteigend (je [size, maxLines]); Zeilen werden ausbalanciert
      (kleinste Breite mit gleicher Zeilenzahl), damit keine einzelnen Wörter in der letzten Zeile hängen. */
  function fitText(ctx, str, maxW, sizes, weight, family, autoNum) {
    const key = `${str}|${maxW}|${sizes.join(",")}|${weight}|${family}|${autoNum}`;
    const hit = LAYOUT_CACHE.get(key); if (hit) return hit;
    const toks = tokenize(str, autoNum);
    let res = null;
    for (let si = 0; si < sizes.length; si++) {
      const [size, maxLines] = sizes[si];
      setFont(ctx, weight, size, family, 0);
      const sp = ctx.measureText(" ").width;
      const ws = toks.map((tk) => ctx.measureText(tk.w).width);
      const tooWide = ws.some((w) => w > maxW);
      const wrap = (mw) => {
        const lines = []; let cur = []; let cw = 0;
        toks.forEach((tk, i) => {
          const w = ws[i];
          if (cur.length && cw + sp + w > mw) { lines.push({ words: cur, w: cw }); cur = []; cw = 0; }
          cur.push({ w: tk.w, acc: tk.acc, x: cur.length ? cw + sp : 0, ww: w }); cw = cur.length > 1 ? cw + sp + w : w;
        });
        if (cur.length) lines.push({ words: cur, w: cw });
        return lines;
      };
      let lines = wrap(maxW);
      if (lines.length > 1 && !tooWide) {
        const n = lines.length; let lo = maxW * 0.4, hi = maxW;
        for (let it = 0; it < 12; it++) { const mid = (lo + hi) / 2; if (wrap(mid).length <= n) hi = mid; else lo = mid; }
        lines = wrap(hi);
      }
      res = { size, lines };
      if (!tooWide && lines.length <= maxLines) break;
      if (si === sizes.length - 1) { // letzte Stufe: auf maxLines kürzen
        if (lines.length > maxLines) { res.lines = wrap(maxW).slice(0, maxLines); const last = res.lines[maxLines - 1]; const lw = last.words[last.words.length - 1]; lw.w += " …"; }
        if (tooWide) res.squeeze = true;
      }
    }
    try { ctx.letterSpacing = "0px"; } catch (e) { /* */ }
    if (LAYOUT_CACHE.size > 60) LAYOUT_CACHE.clear();
    LAYOUT_CACHE.set(key, res);
    return res;
  }

  // ---------------- Parameter ----------------
  function parseSlots(v) {
    if (v === undefined || v === null) v = ["next_video", "second_video", "subscribe"];
    if (typeof v === "string") v = v.split(/[,;|+]/);
    if (!Array.isArray(v)) v = [v];
    const out = {};
    for (const it of v) {
      let o = it; if (typeof it === "string") o = { type: it }; if (!o || typeof o !== "object") continue;
      const ty = String(o.type ?? o.slot ?? o.kind ?? o.element ?? o.name ?? "").toLowerCase().trim().replace(/[\s-]+/g, "_");
      if (!ty) continue;
      let k = null;
      if (/^(second|zweit|2|video_?2|small|klein|playlist|empfohlen|recommend|best_?of|other|weitere|related)/.test(ty)) k = "small";
      else if (/^(sub|abo|abonn|channel|kanal|follow)/.test(ty)) k = "sub";
      else if (/^(next|n(ae|ä)chst|video|main|big|gro(ss|ß)|1|video_?1|best_?for|recent|latest|teaser|episode|folge)/.test(ty)) k = "big";
      if (!k || out[k]) continue;
      out[k] = { at: num(o.at), title: o.title ?? o.label ?? o.caption };
    }
    if (!out.big && out.small) { out.big = out.small; out.big.promoted = true; delete out.small; }
    return out;
  }
  function parseRpm(P, kind) {
    let v = pick(P, ["rpm", "drehzahl", "tacho", "tachometer", "rev", "revs"]);
    let o = {};
    if (v !== undefined && isOff(v)) return null;
    if (v && typeof v === "object" && !Array.isArray(v)) { o = v; v = pick(o, ["value", "rpm", "target", "wert"]); }
    let val = num(v);
    if (val === undefined) { if (v === undefined && kind !== "crank") return null; val = 8000; }
    val = clamp(Math.abs(val), 0, 99999);
    let max = num(pick(o, ["max", "rpmMax"]) ?? pick(P, ["rpmMax", "rpm_max", "tachoMax"]));
    if (!(max > val * 0.5)) max = Math.max(6000, Math.ceil((val * 1.18) / 1000) * 1000);
    let red = num(pick(o, ["redline", "red", "rot"]) ?? pick(P, ["redline", "rpmRedline", "red_line"]));
    if (!(red > 0 && red < max)) red = Math.round((max * 0.85) / 500) * 500;
    const unit = clean(pick(o, ["unit", "einheit"]) ?? pick(P, ["rpmUnit", "rpm_unit", "unit"]) ?? "U/min") || "U/min";
    let os = num(pick(o, ["overshoot", "overshoot_c"]) ?? pick(P, ["rpmOvershoot", "rpm_overshoot", "overshoot"]));
    os = os === undefined ? 0.8 : clamp(os, 0, 3);
    return { val, max, red, unit, os, atRaw: num(pick(o, ["at"]) ?? pick(P, ["rpmAt", "rpm_at", "tachoAt"])) };
  }
  const PARTS = {
    kurbelwelle: "Kurbelwelle", kolben: "Kolben", pleuel: "Pleuelstange", schwungrad: "Schwungrad",
  };
  const PART_ALIAS = [[/kurbel|crank/i, "kurbelwelle"], [/kolben|piston/i, "kolben"], [/pleuel|rod|conn/i, "pleuel"], [/schwung|fly/i, "schwungrad"]];
  function parseLabels(v) {
    if (v === undefined || v === null || v === true) v = ["kurbelwelle"];
    if (isOff(v)) return [];
    if (typeof v === "string") v = v.split(/[,;|]/);
    if (!Array.isArray(v)) return [];
    const out = []; const seen = {};
    for (const it of v) {
      const o = typeof it === "string" ? { part: it } : it; if (!o || typeof o !== "object") continue;
      const raw = String(o.part ?? o.id ?? o.name ?? o.text ?? o.label ?? "");
      let part = null; for (const [re, k] of PART_ALIAS) if (re.test(raw)) { part = k; break; }
      if (!part || seen[part]) continue; seen[part] = 1;
      const tx = o.text ?? o.label;
      out.push({ part, text: (typeof tx === "string" && clean(tx)) || PARTS[part], atRaw: num(o.at) });
    }
    return out;
  }

  // ---------------- Layout ----------------
  function layout(S) {
    const lay = {};
    const bigW = S.small ? 832 : 880;
    if (S.big) lay.big = { x: 120, y: 228, w: bigW, h: Math.round((bigW * 9) / 16) };
    if (S.big && S.small && S.sub) {
      lay.small = { x: 1136, y: 228, w: 560, h: 315 };
      lay.sub = { cx: 1226, cy: 718, r: 90 };
      lay.chan = { mode: "left", x: 1350, nameY: 694, maxW: 1830 - 1350, nameSizes: [44, 40, 36, 32, 28], tagSize: 25, signSize: 24 };
      lay.subLabelY = 718 + 90 + 42;
    } else if (S.big && S.small) {
      lay.small = { x: 1136, y: 228, w: 560, h: 315 };
      lay.chan = { mode: "left", x: 1136, nameY: 700, maxW: 1830 - 1136, nameSizes: [52, 46, 40, 34], tagSize: 28, signSize: 28 };
    } else if (S.big && S.sub) {
      lay.sub = { cx: 1455, cy: 392, r: 142 };
      lay.subLabelY = 392 + 142 + 58;
      lay.chan = { mode: "center", cx: 1455, nameY: 680, maxW: 740, nameSizes: [56, 50, 44, 38, 32], tagSize: 29, signSize: 30 };
    } else if (S.big) {
      lay.chan = { mode: "center", cx: 1455, nameY: 440, maxW: 740, nameSizes: [60, 54, 48, 40, 34], tagSize: 30, signSize: 30 };
    } else if (S.sub) {
      lay.sub = { cx: 960, cy: 390, r: 150 };
      lay.subLabelY = 390 + 150 + 58;
      lay.chan = { mode: "center", cx: 960, nameY: 700, maxW: 1400, nameSizes: [64, 56, 48, 40], tagSize: 32, signSize: 32 };
    } else {
      lay.chan = { mode: "center", cx: 960, nameY: 470, maxW: 1500, nameSizes: [96, 84, 72, 60, 48], tagSize: 38, signSize: 34 };
    }
    return lay;
  }

  // ---------------- Kopfzeile (Engine-Stil) ----------------
  function drawHeader(ctx, text, x, t, at) {
    const a = seg(t, at, 0.45); if (a <= 0) return;
    const T = upper(text); let size = 40; let w = 0;
    for (; size >= 24; size -= 2) { w = measure(ctx, T, 700, size, F_HEAD, 2); if (w <= 1320) break; }
    let s = T; if (w > 1320) { while (s.length > 4 && measure(ctx, s + "…", 700, size, F_HEAD, 2) > 1320) s = s.slice(0, -1); s = s.trimEnd() + "…"; w = measure(ctx, s, 700, size, F_HEAD, 2); }
    const y = 150, bw = w + 60, top = y - size - 14 + (40 - size) / 2, bh = size + 34;
    const slide = eo(seg(t, at, 0.5));
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = C.amber; ctx.fillRect(x, top, 8, bh); ctx.restore();
    fillPath(ctx, (c) => roundRect(c, x + 14, top, bw * slide, bh, 4), "rgba(4,12,26,0.82)", a);
    gp(ctx, (c) => roundRect(c, x + 14, top, bw * slide, bh, 4), "rgba(255,179,71,0.35)", 1.5, 0.6, a);
    txt(ctx, s, x + 44, top + bh / 2 + size * 0.36, { size, weight: 700, font: F_HEAD, ls: 2, color: C.white, alpha: a * seg(t, at + 0.25, 0.35) });
  }
  function roundRect(c, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  // ---------------- Platzhalter-Rahmen ----------------
  /** Rahmen zeichnet sich von links oben in beide Richtungen auf; Inhalt (clip) blendet ein. */
  function drawFrame(ctx, R, t, at, dur, content, col) {
    const pr = eo(seg(t, at, dur)); if (pr <= 0) return 0;
    const { x, y, w, h } = R;
    fillPath(ctx, (c) => c.rect(x, y, w, h), "rgba(3,10,22,0.66)", Math.min(1, pr * 1.4));
    const ca = seg(t, at + dur * 0.35, dur * 0.9);
    if (ca > 0 && content) { ctx.save(); ctx.beginPath(); ctx.rect(x + 1, y + 1, w - 2, h - 2); ctx.clip(); content(ca); ctx.restore(); }
    // Scanlinie (dezentes Leben)
    if (ca > 0) {
      const per = 6, ph = ((t - at) % per) / per, sy = y + h * ph, fade = Math.sin(ph * Math.PI);
      const g = ctx.createLinearGradient(0, sy - 70, 0, sy);
      g.addColorStop(0, "rgba(63,210,255,0)"); g.addColorStop(1, "rgba(63,210,255,0.05)");
      ctx.save(); ctx.globalAlpha = ca * fade; ctx.fillStyle = g; ctx.fillRect(x + 1, Math.max(y + 1, sy - 70), w - 2, Math.min(70, sy - y));
      ctx.fillStyle = "rgba(63,210,255,0.16)"; ctx.fillRect(x + 1, sy, w - 2, 1.5); ctx.restore();
    }
    // Rahmenlinie (zwei Wege ab links oben)
    const per = 2 * (w + h), half = per / 2 * pr;
    const path = (c, len, cw) => {
      const pts = cw ? [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]] : [[x, y], [x, y + h], [x + w, y + h], [x + w, y], [x, y]];
      c.moveTo(x, y); let rem = len;
      for (let i = 1; i < pts.length && rem > 0; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; const L = Math.hypot(bx - ax, by - ay); const k = Math.min(1, rem / L);
        c.lineTo(ax + (bx - ax) * k, ay + (by - ay) * k); rem -= L;
      }
    };
    const breathe = 0.85 + 0.15 * Math.sin((t - at) * 1.7);
    gp(ctx, (c) => { path(c, half, true); path(c, half, false); }, col || C.cyan, 2, 0.8 * breathe, 1);
    // Eckwinkel (Amber), fliegen ein
    const ck = eo(seg(t, at + dur * 0.5, dur * 0.6));
    if (ck > 0) {
      const o = 10 + 16 * (1 - ck), l = 30;
      gp(ctx, (c) => {
        c.moveTo(x - o, y - o + l); c.lineTo(x - o, y - o); c.lineTo(x - o + l, y - o);
        c.moveTo(x + w + o - l, y - o); c.lineTo(x + w + o, y - o); c.lineTo(x + w + o, y - o + l);
        c.moveTo(x + w + o, y + h + o - l); c.lineTo(x + w + o, y + h + o); c.lineTo(x + w + o - l, y + h + o);
        c.moveTo(x - o + l, y + h + o); c.lineTo(x - o, y + h + o); c.lineTo(x - o, y + h + o - l);
      }, C.amber, 2.5, 0.8, ck * (0.8 + 0.2 * Math.sin((t - at) * 2.3)), null, "square");
    }
    return pr;
  }

  // ---------------- Motor-Skizze: Reihenvierzylinder, Kurbeltrieb (Röntgen) ----------------
  const ENG = { r: 0.27, l: 0.9, R: 0.36, cyl: [-1.5, -0.5, 0.5, 1.5], ph: [0, Math.PI, Math.PI, 0], fire: [0, 3, 1, 2], deck: 1.55 };
  // Kurbelwange im mitdrehenden System (u entlang Kröpfung, v quer): Hubzapfen-Auge + Gegengewicht
  const WEB = (() => {
    const pts = []; const r = ENG.r;
    for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * Math.PI; pts.push([r + 0.16 * Math.cos(a), 0.16 * Math.sin(a)]); }
    for (let i = 0; i <= 8; i++) { const a = 118 * DEG + (i / 8) * 124 * DEG; pts.push([0.44 * Math.cos(a), 0.44 * Math.sin(a)]); }
    return pts;
  })();
  const VIEW = { cb: Math.cos(32 * DEG), sb: Math.sin(32 * DEG), ca: Math.cos(15 * DEG), sa: Math.sin(15 * DEG) };

  function crankState(t, rpm, tRpm, D, tStart) {
    const w0 = 0.42, w1 = rpm ? 1.75 : 0.9; // sichtbare Umdrehungen pro Sekunde (stilisiert, Zeitlupe)
    let I = 0; const tt = Math.max(0, t - tStart);
    if (rpm) {
      if (t > tRpm + D) I = D * 0.5 + (t - tRpm - D);
      else if (t > tRpm) { const x = (t - tRpm) / D; I = D * (x * x * x - (x * x * x * x) / 2); }
    }
    const theta = TAU * (w0 * tt + (w1 - w0) * I) + 0.6;
    const spd = rpm ? sm((t - tRpm) / D) : 0;
    return { theta, spd };
  }

  function drawEngine(ctx, box, st, A, t, labels, lt) {
    const { cb, sb, ca, sa } = VIEW;
    const S = Math.min(box.w / 4.55, box.h / 3.35);
    const ox = box.x + box.w / 2 - S * 0.02, oy = box.y + box.h / 2 + S * 0.55;
    const P = (x, y, z) => { const x1 = x * cb + z * sb, z1 = -x * sb + z * cb; return [ox + S * x1, oy - S * (y * ca - z1 * sa)]; };
    const ringYZ = (c, x0, y0, z0, rho, n, a0, a1, move) => {
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n; const q = P(x0, y0 + rho * Math.cos(a), z0 + rho * Math.sin(a));
        if (i === 0 && move !== false) c.moveTo(q[0], q[1]); else c.lineTo(q[0], q[1]);
      }
    };
    const hEll = (c, x0, y0, R, a0, a1) => { const q = P(x0, y0, 0); c.moveTo(q[0] + S * R * Math.cos(a0), q[1] + S * R * sa * Math.sin(a0)); c.ellipse(q[0], q[1], S * R, S * R * sa, 0, a0, a1); };
    const { r, l, R } = ENG; const th = st.theta;
    const lw = S / 125;

    // Motorblock + Zylinderkopf + Ölwanne (gestrichelt, dezent)
    const zf = 0.5, prof = [[-2.05, 1.85], [2.05, 1.85], [2.05, -0.2], [1.8, -0.2], [1.6, -0.72], [-1.6, -0.72], [-1.8, -0.2], [-2.05, -0.2]];
    fillPath(ctx, (c) => { prof.forEach(([x, y], i) => { const q = P(x, y, zf); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.closePath(); }, "rgba(63,210,255,0.035)", A);
    gp(ctx, (c) => {
      for (const z of [zf, -zf]) { prof.forEach(([x, y], i) => { const q = P(x, y, z); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.closePath(); }
      for (const [x, y] of prof) { const a = P(x, y, zf), b = P(x, y, -zf); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
      for (const z of [zf, -zf]) { const a = P(-2.05, ENG.deck, z), b = P(2.05, ENG.deck, z); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
    }, "rgba(63,210,255,0.5)", 1.2 * lw, 0, A * 0.55, [6, 6]);
    // Zylinderbohrungen + Zündkerzen
    gp(ctx, (c) => {
      for (const xc of ENG.cyl) {
        hEll(c, xc, ENG.deck, R, 0, TAU);
        const a1 = P(xc + R * cb, 0.62, R * sb), a2 = P(xc + R * cb, ENG.deck, R * sb), b1 = P(xc - R * cb, 0.62, -R * sb), b2 = P(xc - R * cb, ENG.deck, -R * sb);
        c.moveTo(a1[0], a1[1]); c.lineTo(a2[0], a2[1]); c.moveTo(b1[0], b1[1]); c.lineTo(b2[0], b2[1]);
        const k1 = P(xc, 1.85, 0), k2 = P(xc, 2.02, 0); c.moveTo(k1[0], k1[1]); c.lineTo(k2[0], k2[1]);
      }
    }, "rgba(143,179,217,0.9)", 1.3 * lw, -0.3, A * 0.6);

    // Kurbelwelle: Wangen (Füllung + Kontur)
    const webs = [];
    for (let i = 0; i < 4; i++) {
      const a = th + ENG.ph[i], ca_ = Math.cos(a), sa_ = Math.sin(a);
      for (const dx of [-0.22, 0.22]) {
        const x0 = ENG.cyl[i] + dx; const pts = [];
        for (const [u, v] of WEB) pts.push(P(x0, u * ca_ - v * sa_, u * sa_ + v * ca_));
        webs.push(pts);
      }
    }
    const webPath = (c) => { for (const pts of webs) { pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); } };
    fillPath(ctx, webPath, "rgba(63,210,255,0.10)", A);
    // Bewegungsspuren der Hubzapfen (bei hoher Drehzahl)
    if (st.spd > 0.05) {
      ctx.save(); ctx.globalAlpha = A * 0.28 * st.spd; ctx.strokeStyle = C.cyan; ctx.lineWidth = 7 * lw; ctx.lineCap = "round"; ctx.beginPath();
      for (let i = 0; i < 4; i++) { const a = th + ENG.ph[i]; ringYZ(ctx, ENG.cyl[i], 0, 0, r, 7, a - 1.3 * st.spd, a); }
      ctx.stroke(); ctx.restore();
    }
    // Wellenzapfen + Hubzapfen (je zwei Mantellinien)
    const ax = [cb, -sb * sa]; const an = Math.hypot(ax[0], ax[1]); const nx = -ax[1] / an, ny = ax[0] / an;
    const shaft = (c, xa, xb, y0, z0, rho) => {
      const a = P(xa, y0, z0), b = P(xb, y0, z0), o = S * rho;
      c.moveTo(a[0] + nx * o, a[1] + ny * o); c.lineTo(b[0] + nx * o, b[1] + ny * o);
      c.moveTo(a[0] - nx * o, a[1] - ny * o); c.lineTo(b[0] - nx * o, b[1] - ny * o);
    };
    gp(ctx, (c) => {
      const mains = [[-2.42, -1.72], [-1.28, -0.72], [-0.28, 0.28], [0.72, 1.28], [1.72, 2.3]];
      for (const [xa, xb] of mains) shaft(c, xa, xb, 0, 0, 0.12);
      for (let i = 0; i < 4; i++) { const a = th + ENG.ph[i]; shaft(c, ENG.cyl[i] - 0.22, ENG.cyl[i] + 0.22, r * Math.cos(a), r * Math.sin(a), 0.105); }
      webPath(c);
    }, C.cyan, 2 * lw, 0.9, A);
    // Riemenscheibe vorn (Speichen drehen mit)
    gp(ctx, (c) => {
      ringYZ(c, -2.46, 0, 0, 0.25, 22, 0, TAU); ringYZ(c, -2.46, 0, 0, 0.08, 10, 0, TAU);
      for (let k = 0; k < 3; k++) { const a = th + (k * TAU) / 3; const p1 = P(-2.46, 0.08 * Math.cos(a), 0.08 * Math.sin(a)), p2 = P(-2.46, 0.25 * Math.cos(a), 0.25 * Math.sin(a)); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); }
    }, C.cyan, 1.6 * lw, -0.7, A * 0.85);
    // Schwungrad hinten mit Zahnkranz-Marken (zeigt die Drehung)
    const fx = 2.36;
    gp(ctx, (c) => {
      ringYZ(c, fx, 0, 0, 0.64, 36, 0, TAU); ringYZ(c, fx, 0, 0, 0.5, 30, 0, TAU); ringYZ(c, fx, 0, 0, 0.14, 12, 0, TAU);
      for (let k = 0; k < 20; k++) { const a = th + (k * TAU) / 20; const p1 = P(fx, 0.5 * Math.cos(a), 0.5 * Math.sin(a)), p2 = P(fx, 0.64 * Math.cos(a), 0.64 * Math.sin(a)); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); }
    }, C.cyan, 1.4 * lw, -0.6, A * 0.75);
    { const a = th; const q = P(fx, 0.57 * Math.cos(a), 0.57 * Math.sin(a)); glowDot(ctx, q[0], q[1], 12 * lw, C.amber, A * 0.9); }
    if (st.spd > 0.05) {
      ctx.save(); ctx.globalAlpha = A * 0.25 * st.spd; ctx.strokeStyle = C.cyan; ctx.lineWidth = 4 * lw; ctx.lineCap = "round"; ctx.beginPath();
      for (let k = 0; k < 3; k++) { const a = th + (k * TAU) / 3 + 0.4; ringYZ(ctx, fx, 0, 0, 0.72, 8, a - 1.1 * st.spd, a); }
      ctx.stroke(); ctx.restore();
    }

    // Pleuel + Kolben
    const pistonTop = [];
    for (let i = 0; i < 4; i++) {
      const xc = ENG.cyl[i], a = th + ENG.ph[i];
      const py = r * Math.cos(a), pz = r * Math.sin(a);
      const yPin = py + Math.sqrt(l * l - pz * pz);
      const A1 = P(xc, yPin, 0), B1 = P(xc, py, pz);
      let dx = B1[0] - A1[0], dy = B1[1] - A1[1]; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const px = -dy, pyy = dx, w1 = 5 * lw, w2 = 9 * lw;
      gp(ctx, (c) => {
        c.moveTo(A1[0] + px * w1, A1[1] + pyy * w1); c.lineTo(B1[0] + px * w2, B1[1] + pyy * w2);
        c.moveTo(A1[0] - px * w1, A1[1] - pyy * w1); c.lineTo(B1[0] - px * w2, B1[1] - pyy * w2);
        ringYZ(c, xc, py, pz, 0.14, 14, 0, TAU);
        c.moveTo(A1[0] + 8 * lw, A1[1]); c.arc(A1[0], A1[1], 8 * lw, 0, TAU);
      }, C.steel, 1.6 * lw, -0.6, A * 0.95);
      // Kolben
      const yc = yPin + 0.26, ys = yPin - 0.13;
      const top = P(xc, yc, 0), bot = P(xc, ys, 0);
      fillPath(ctx, (c) => { c.rect(top[0] - S * R, top[1], 2 * S * R, bot[1] - top[1]); c.moveTo(top[0] + S * R, top[1]); c.ellipse(top[0], top[1], S * R, S * R * sa, 0, 0, TAU); }, "rgba(63,210,255,0.07)", A);
      gp(ctx, (c) => {
        hEll(c, xc, yc, R, 0, TAU); hEll(c, xc, ys, R, 0, Math.PI);
        c.moveTo(top[0] - S * R, top[1]); c.lineTo(bot[0] - S * R, bot[1]); c.moveTo(top[0] + S * R, top[1]); c.lineTo(bot[0] + S * R, bot[1]);
        hEll(c, xc, yc - 0.07, R, 0, Math.PI); hEll(c, xc, yc - 0.12, R, 0, Math.PI);
      }, "#bfeaff", 1.7 * lw, -0.8, A);
      pistonTop.push(top);
      // Verbrennung (Zündfolge 1-3-4-2): Blitz kurz nach OT des Arbeitstakts
      let fa = (th - ENG.fire[i] * Math.PI) % (2 * TAU); if (fa < 0) fa += 2 * TAU;
      const fl = fa < 1.3 ? Math.exp(-fa * 2.6) : 0;
      if (fl > 0.02) {
        const ch = P(xc, (yc + ENG.deck) / 2 + 0.02, 0);
        glowDot(ctx, ch[0], ch[1], S * 0.42, C.amber, A * fl * 0.9);
        const kp = P(xc, 1.9, 0); glowDot(ctx, kp[0], kp[1], S * 0.12, "#fff2d6", A * fl);
      }
    }
    // Bauteil-Beschriftungen
    if (labels && labels.length) {
      for (const lb of labels) {
        const k = seg(t, lb.at, 0.9); if (k <= 0) continue;
        let pt, lx, ly, al = "left";
        if (lb.part === "kurbelwelle") { pt = P(-1.0, 0, 0); lx = box.x + 4; ly = box.y + box.h - 22; }
        else if (lb.part === "kolben") { pt = pistonTop[0]; lx = box.x + 4; ly = box.y + 24; }
        else if (lb.part === "pleuel") { const a = th + ENG.ph[1]; const py = r * Math.cos(a), pz = r * Math.sin(a); const yPin = py + Math.sqrt(l * l - pz * pz); pt = P(ENG.cyl[1], (yPin + py) / 2, pz / 2); lx = box.x + box.w * 0.44; ly = box.y + box.h - 22; }
        else { pt = P(fx, 0.5, 0.3); lx = box.x + box.w; ly = box.y + 24; al = "right"; }
        drawCallout(ctx, pt[0], pt[1], lx, ly, lb.text, k * A, al, t);
      }
    }
  }
  function drawCallout(ctx, px, py, lx, ly, label, p, align, t) {
    if (p <= 0) return;
    const size = 21; const w = measure(ctx, label, 600, size, F_BODY, 0.5) + 30, h = size + 18;
    const bx = align === "right" ? lx - w : lx, ex = align === "right" ? lx - w * 0.5 : lx + w * 0.5, ey = ly - h / 2;
    const lp = eo(seg(p, 0, 0.5));
    glowDot(ctx, px, py, 12, C.amber, p * (0.7 + 0.3 * Math.sin(t * 3)));
    fillPath(ctx, (c) => c.arc(px, py, 3.5, 0, TAU), C.amber, p);
    gp(ctx, (c) => { c.moveTo(px, py); c.lineTo(px + (ex - px) * lp, py + (ey - py) * lp); }, C.amber, 1.5, 0.6, p * 0.9);
    const tp = seg(p, 0.4, 0.6); if (tp <= 0) return;
    fillPath(ctx, (c) => roundRect(c, bx, ly - h / 2, w * eo(tp), h, 6), "rgba(4,12,26,0.86)", tp);
    gp(ctx, (c) => roundRect(c, bx, ly - h / 2, w * eo(tp), h, 6), "rgba(255,179,71,0.5)", 1.4, 0.5, tp);
    txt(ctx, label, bx + 15, ly + size * 0.36, { size, weight: 600, ls: 0.5, color: C.white, alpha: seg(p, 0.6, 0.4) });
  }

  // ---------------- Drehzahlmesser ----------------
  function drawTacho(ctx, cx, cy, R, rp, val, readout, A, t) {
    const a0 = 150 * DEG, sw = 240 * DEG; const ang = (v) => a0 + sw * clamp(v / rp.max, 0, 1.02);
    const pad = 44, sz = 2 * (R + pad);
    const cv = cached(`dial|${R}|${rp.max}|${rp.red}|${rp.unit}`, sz, sz, (c) => drawDial(c, R + pad, R + pad, R, rp, 1), '700 17px "JetBrains Mono"');
    if (cv) { ctx.save(); ctx.globalAlpha = A; ctx.drawImage(cv, cx - R - pad, cy - R - pad); ctx.restore(); }
    else drawDial(ctx, cx, cy, R, rp, A);
    // Nadel
    const na = ang(val), tip = R - 16;
    gp(ctx, (c) => { c.moveTo(cx - Math.cos(na) * 16, cy - Math.sin(na) * 16); c.lineTo(cx + Math.cos(na) * tip, cy + Math.sin(na) * tip); }, C.amber, 4, 1, A);
    glowDot(ctx, cx + Math.cos(na) * tip, cy + Math.sin(na) * tip, 16, C.amber, A * 0.8);
    fillPath(ctx, (c) => c.arc(cx, cy, 9, 0, TAU), "#061226", A);
    gp(ctx, (c) => c.arc(cx, cy, 9, 0, TAU), C.amber, 2, -0.6, A);
    // Digitalanzeige
    const size = Math.round(R * 0.27);
    glowDot(ctx, cx, cy + R * 0.66 - size * 0.35, size * 1.9, "#ffb347", A * 0.16);
    txt(ctx, readout, cx, cy + R * 0.66, { size, weight: 700, font: F_MONO, align: "center", color: C.amber, alpha: A });
    txt(ctx, rp.unit, cx, cy + R * 0.66 + size * 0.85, { size: Math.round(size * 0.5), weight: 600, font: F_MONO, align: "center", color: C.muted, alpha: A });
  }
  function drawDial(ctx, cx, cy, R, rp, A) {
    const a0 = 150 * DEG, sw = 240 * DEG; const ang = (v) => a0 + sw * clamp(v / rp.max, 0, 1.02);
    fillPath(ctx, (c) => c.arc(cx, cy, R, 0, TAU), "rgba(4,12,26,0.8)", A);
    gp(ctx, (c) => c.arc(cx, cy, R, 0, TAU), C.cyan, 2, 0.7, A * 0.85);
    gp(ctx, (c) => c.arc(cx, cy, R - 11, ang(rp.red), ang(rp.max)), C.red, 6, 0.8, A * 0.9, null, "butt");
    const step = rp.max <= 12000 ? 1000 : rp.max <= 24000 ? 2000 : 5000;
    gp(ctx, (c) => {
      for (let v = 0; v <= rp.max + 1; v += step / 2) {
        const a = ang(v), major = Math.round(v / step) * step === Math.round(v);
        const r1 = R - 5, r2 = R - (major ? 22 : 13);
        c.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); c.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      }
    }, C.steel, 2, 0.3, A);
    for (let v = 0; v <= rp.max + 1; v += step) {
      const a = ang(v); const rr = R - 38;
      txt(ctx, String(Math.round(v / 1000)), cx + Math.cos(a) * rr, cy + Math.sin(a) * rr + 6, { size: 17, weight: 700, font: F_MONO, align: "center", color: v >= rp.red ? C.red : C.muted, alpha: A * 0.95 });
    }
    txt(ctx, "×1000 " + rp.unit, cx, cy - R * 0.36, { size: 14, weight: 400, font: F_MONO, align: "center", color: C.muted, alpha: A * 0.9 });
  }

  // ---------------- Zahnräder (2. Video) ----------------
  function gearPath(c, cx, cy, R, n, a0) {
    const hd = R * 0.16, pitch = TAU / n;
    for (let k = 0; k < n; k++) {
      const a = a0 + k * pitch; const pts = [[R - hd, a - pitch * 0.28], [R, a - pitch * 0.15], [R, a + pitch * 0.15], [R - hd, a + pitch * 0.28], [R - hd, a + pitch * 0.72]];
      pts.forEach(([rr, aa], i) => { const x = cx + Math.cos(aa) * rr, y = cy + Math.sin(aa) * rr; (k === 0 && i === 0) ? c.moveTo(x, y) : c.lineTo(x, y); });
    }
    c.closePath();
    c.moveTo(cx + R * 0.28, cy); c.arc(cx, cy, R * 0.28, 0, TAU);
    for (let k = 0; k < 4; k++) { const a = a0 * 1 + (k * TAU) / 4 + pitch / 2; c.moveTo(cx + Math.cos(a) * R * 0.28, cy + Math.sin(a) * R * 0.28); c.lineTo(cx + Math.cos(a) * (R - hd - 4), cy + Math.sin(a) * (R - hd - 4)); }
  }
  function drawGears(ctx, R, A, t) {
    const s = R.h / 315;
    const R1 = 92 * s, R2 = 62 * s, n1 = 18, n2 = 12;
    const phi = -0.5, dist = (R1 + R2) * 0.9, dx = dist * Math.cos(phi), dy = dist * Math.sin(phi);
    const c1x = R.x + R.w / 2 - (dx + R2 - R1) / 2, c1y = R.y + R.h / 2 - 8 - (R1 + dy - R2) / 2;
    const c2x = c1x + dx, c2y = c1y + dy;
    // Eingriff: Zahn von Rad 1 in Richtung phi <-> Lücke von Rad 2 in Richtung phi+π
    const a1 = t * 0.5, a2 = -(a1 - phi) * (n1 / n2) + phi + Math.PI + Math.PI / n2;
    fillPath(ctx, (c) => { gearPath(c, c1x, c1y, R1, n1, a1); }, "rgba(63,210,255,0.06)", A);
    gp(ctx, (c) => gearPath(c, c1x, c1y, R1, n1, a1), C.cyan, 1.8, 0.7, A * 0.9);
    gp(ctx, (c) => gearPath(c, c2x, c2y, R2, n2, a2), C.amber, 1.8, 0.7, A * 0.85);
    // Maßlinie (Blueprint)
    const my = R.y + R.h - 34 * s;
    gp(ctx, (c) => { c.moveTo(c1x - R1, my); c.lineTo(c1x + R1, my); c.moveTo(c1x - R1, my - 7); c.lineTo(c1x - R1, my + 7); c.moveTo(c1x + R1, my - 7); c.lineTo(c1x + R1, my + 7); }, C.muted, 1.2, 0, A * 0.6);
  }

  // ---------------- Abo-Platzhalter (Iris-Emblem, kein Logo) ----------------
  function drawSubscribe(ctx, s, t, at, dur, label, labelY) {
    const pr = eo(seg(t, at, dur)); if (pr <= 0) return;
    const { cx, cy, r } = s; const tt = t - at;
    // Pulsringe (Einladung zum Klicken)
    if (tt > dur) {
      for (let k = 0; k < 2; k++) {
        const ph = (((tt - dur) / 2.4 + k * 0.5) % 1); const rr = r * (1.04 + 0.32 * eo(ph));
        gp(ctx, (c) => c.arc(cx, cy, rr, 0, TAU), C.amber, 1.6, -0.5, 0.45 * (1 - ph) * seg(tt - dur, 0, 0.5));
      }
    }
    fillPath(ctx, (c) => c.arc(cx, cy, r, 0, TAU), "rgba(3,10,22,0.72)", pr);
    // äußerer Ring zeichnet sich auf
    gp(ctx, (c) => c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * pr), C.cyan, 2.6, 1, 1);
    // rotierender Strichring + Skalenmarken
    const k2 = seg(t, at + dur * 0.4, dur);
    gp(ctx, (c) => { c.arc(cx, cy, r * 1.1, tt * 0.25, tt * 0.25 + TAU); }, C.cyan, 1.4, -0.4, 0.45 * k2, [4, 10]);
    gp(ctx, (c) => { for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; const r1 = r * 0.86, r2 = r * (i % 6 === 0 ? 0.78 : 0.82); c.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); c.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); } }, C.steel, 1.4, 0, 0.7 * k2);
    // Iris (Blenden-Lamellen) – öffnet sich, atmet leicht
    const k3 = eo(seg(t, at + dur * 0.6, dur * 1.2));
    if (k3 > 0) {
      const ri = r * 0.7, open = (0.34 + 0.08 * k3 + 0.03 * Math.sin(tt * 1.3)) * ri, n = 7, rot = tt * 0.12;
      gp(ctx, (c) => {
        for (let i = 0; i < n; i++) {
          const a = rot + (i / n) * TAU; const q0 = [cx + Math.cos(a) * ri, cy + Math.sin(a) * ri];
          const b = a + (TAU / n) * 1.9; const tx = cx + Math.cos(b) * open, ty = cy + Math.sin(b) * open;
          c.moveTo(q0[0], q0[1]); c.quadraticCurveTo(cx + Math.cos(a + 0.9) * ri * 0.72, cy + Math.sin(a + 0.9) * ri * 0.72, tx, ty);
        }
        c.moveTo(cx + ri, cy); c.arc(cx, cy, ri, 0, TAU);
      }, C.cyan, 1.6, -0.8, 0.85 * k3);
      glowDot(ctx, cx, cy, open * 1.5, C.cyan, 0.5 * k3 * (0.8 + 0.2 * Math.sin(tt * 2)));
      fillPath(ctx, (c) => c.arc(cx, cy, open * 0.35, 0, TAU), "#dff6ff", 0.8 * k3);
      // Scan-Strahl
      const sa0 = tt * 1.1; gp(ctx, (c) => { c.moveTo(cx, cy); c.lineTo(cx + Math.cos(sa0) * r * 0.95, cy + Math.sin(sa0) * r * 0.95); }, C.cyan, 1.2, 0.8, 0.35 * k3);
    }
    // Umlaufender Amber-Punkt
    const oa = -Math.PI / 2 + tt * 0.9; glowDot(ctx, cx + Math.cos(oa) * r, cy + Math.sin(oa) * r, 14, C.amber, pr * 0.9);
    // Beschriftung
    if (label) {
      const lk = seg(t, at + dur * 0.7, 0.45); if (lk <= 0) return;
      const size = r > 120 ? 24 : 20; const tw = measure(ctx, label, 700, size, F_MONO, 4);
      const bw = size * 1.1, gap = 14, total = bw + gap + tw, x0 = cx - total / 2;
      bellIcon(ctx, x0 + bw / 2, labelY - size * 0.35, size * 0.95, lk, t);
      txt(ctx, label, x0 + bw + gap, labelY, { size, weight: 700, font: F_MONO, ls: 4, color: C.amber, alpha: lk });
    }
  }
  function bellIcon(ctx, x, y, s, a, t) {
    const ph = (t % 3.4); const wig = ph < 1.2 ? 0.35 * Math.sin(ph * 18) * Math.exp(-ph * 3) : 0;
    ctx.save(); ctx.translate(x, y - s * 0.45); ctx.rotate(wig); ctx.translate(0, s * 0.45);
    gp(ctx, (c) => {
      c.moveTo(-0.55 * s, 0.38 * s); c.quadraticCurveTo(-0.4 * s, 0.25 * s, -0.4 * s, -0.02 * s);
      c.bezierCurveTo(-0.4 * s, -0.45 * s, -0.2 * s, -0.6 * s, 0, -0.6 * s); c.bezierCurveTo(0.2 * s, -0.6 * s, 0.4 * s, -0.45 * s, 0.4 * s, -0.02 * s);
      c.quadraticCurveTo(0.4 * s, 0.25 * s, 0.55 * s, 0.38 * s); c.closePath();
      c.moveTo(-0.12 * s, 0.5 * s); c.arc(0, 0.5 * s, 0.12 * s, Math.PI, 0, true);
    }, C.amber, 2, 0.6, a);
    ctx.restore();
  }

  // ---------------- Kanalblock ----------------
  function drawChannel(ctx, ch, name, tagline, t, atName, atTag, sc) {
    if (!name && !tagline) return 0;
    let y = ch.nameY; let bottom = y;
    const nameT = upper(name);
    if (nameT) {
      const k = seg(t, atName, 0.75 * sc); if (k > 0) {
        let size = ch.nameSizes[0], w = 0;
        for (const s of ch.nameSizes) { size = s; w = measure(ctx, nameT, 700, s, F_HEAD, s * 0.08); if (w <= ch.maxW) break; }
        const x = ch.mode === "center" ? ch.cx - w / 2 : ch.x;
        const e = eo(k), edge = x - 20 + (w + 40) * e;
        ctx.save(); ctx.beginPath(); ctx.rect(x - 30, y - size * 1.2, (edge - x + 30), size * 1.6); ctx.clip();
        const pad = 36, cw = w + 2 * pad, chh = size * 1.5 + 2 * pad;
        const cv = cached(`name|${nameT}|${size}`, cw, chh, (c) => txt(c, nameT, pad, pad + size * 1.1, { size, weight: 700, font: F_HEAD, ls: size * 0.08, color: C.white, glow: 18, glowColor: C.cyan, alpha: 1 }), `700 ${size}px "${F_HEAD}"`);
        if (cv) ctx.drawImage(cv, x - pad, y - pad - size * 1.1);
        else txt(ctx, nameT, x, y, { size, weight: 700, font: F_HEAD, ls: size * 0.08, color: C.white, glow: 18, glowColor: C.cyan, alpha: 1 });
        ctx.restore();
        if (k < 1) gp(ctx, (c) => { c.moveTo(edge, y - size * 0.95); c.lineTo(edge, y + size * 0.25); }, C.cyan, 2.2, 1, Math.sin(k * Math.PI));
        // Trennlinie
        const lk = eo(seg(t, atName + 0.3 * sc, 0.6 * sc));
        if (lk > 0) {
          const ly = y + Math.round(size * 0.42), lw = Math.min(w, 520) * lk;
          const lx0 = ch.mode === "center" ? ch.cx - lw / 2 : x;
          gp(ctx, (c) => { c.moveTo(lx0, ly); c.lineTo(lx0 + lw, ly); }, C.cyan, 1.5, 0.7, 0.8);
          fillPath(ctx, (c) => c.arc(ch.mode === "center" ? ch.cx : lx0 + lw, ly, 3, 0, TAU), C.amber, lk);
        }
        y += Math.round(size * 0.42) + 16;
        bottom = y;
      } else y += Math.round(ch.nameSizes[0] * 0.42) + 16;
    }
    if (tagline) {
      const k = seg(t, atTag, 0.5 * sc);
      const lay = fitText(ctx, tagline, ch.maxW, [[ch.tagSize, 2], [Math.round(ch.tagSize * 0.88), 2], [Math.round(ch.tagSize * 0.78), 3]], 400, F_BODY, false);
      const lh = Math.round(lay.size * 1.3);
      y += lay.size;
      lay.lines.forEach((ln, i) => {
        const a = seg(t, atTag + i * 0.12, 0.5 * sc); if (a <= 0) return;
        const x0 = ch.mode === "center" ? ch.cx - ln.w / 2 : ch.x; const dy = (1 - eo(a)) * 10;
        drawLine(ctx, ln, x0, y + i * lh + dy, { size: lay.size }, () => a, (wd) => (wd.acc ? { key: 1, o: { weight: 600, color: C.cyan } } : { key: 0, o: { weight: 400, color: "#cfe3f7" } }));
      });
      y += (lay.lines.length - 1) * lh;
      if (k > 0) bottom = y;
    }
    return y;
  }

  // ---------------- Schlusssatz mit Ruftaster ----------------
  function drawSignoff(ctx, ch, text, y, t, at, sc) {
    const k = seg(t, at, 0.6 * sc); if (k <= 0 || !text) return;
    const size = ch.signSize; const maxW = ch.maxW - size * 1.6;
    const lay = fitText(ctx, text, maxW, [[size, 1], [Math.round(size * 0.9), 1], [Math.round(size * 0.8), 2]], 600, F_BODY, false);
    const tw = Math.max(...lay.lines.map((l) => l.w)), iw = lay.size * 0.95, gap = 16;
    const total = iw + gap + tw; const x0 = ch.mode === "center" ? ch.cx - total / 2 : ch.x;
    const lh = Math.round(lay.size * 1.25); const blockH = lay.size + (lay.lines.length - 1) * lh;
    // Ruftaster ▲▼
    const bx = x0, by = y - lay.size * 0.95, bh = Math.max(blockH + lay.size * 0.3, lay.size * 1.45), bw = iw;
    const e = eo(k);
    fillPath(ctx, (c) => roundRect(c, bx, by, bw, bh, 7), "rgba(4,12,26,0.85)", e);
    gp(ctx, (c) => roundRect(c, bx, by, bw, bh, 7), C.amber, 1.6, 0.6, e);
    const tt = Math.max(0, t - at), up = 0.5 + 0.5 * Math.sin(tt * 2.6), mx = bx + bw / 2, s = bw * 0.26;
    const tri = (c, cy, dir) => { c.moveTo(mx, cy - s * dir * 0.8); c.lineTo(mx + s, cy + s * dir * 0.6); c.lineTo(mx - s, cy + s * dir * 0.6); c.closePath(); };
    fillPath(ctx, (c) => tri(c, by + bh * 0.3, 1), C.amber, e * (0.35 + 0.65 * up));
    fillPath(ctx, (c) => tri(c, by + bh * 0.7, -1), C.amber, e * (0.35 + 0.65 * (1 - up)));
    if (up > 0.6) glowDot(ctx, mx, by + bh * 0.3, s * 2.4, C.amber, e * (up - 0.6) * 1.2);
    if (up < 0.4) glowDot(ctx, mx, by + bh * 0.7, s * 2.4, C.amber, e * (0.4 - up) * 1.2);
    lay.lines.forEach((ln, i) => {
      const a = seg(t, at + 0.15 * sc + i * 0.1, 0.5 * sc); if (a <= 0) return;
      const dx = (1 - eo(a)) * -14;
      drawLine(ctx, ln, x0 + iw + gap + dx, y + i * lh, { size: lay.size, weight: 600, color: C.amber }, () => a, () => ({ key: 0, o: {} }));
    });
  }

  // ---------------- Titel unter dem großen Rahmen ----------------
  function drawTitle(ctx, big, title, t, at, sc, autoNum) {
    if (!title) return;
    const x = big.x + 22, maxW = big.w - 22;
    const lay = fitText(ctx, title, maxW, [[38, 2], [35, 2], [32, 2], [30, 3], [27, 3], [24, 3]], 700, F_BODY, autoNum);
    const lh = Math.round(lay.size * 1.24), y0 = big.y + big.h + 20 + lay.size;
    const k = seg(t, at, 0.4 * sc); if (k <= 0) return;
    const nL = lay.lines.length;
    // Akzentbalken links
    const bh = lay.size + (nL - 1) * lh + 14;
    fillPath(ctx, (c) => c.rect(big.x, y0 - lay.size - 2, 4, bh * eo(k)), C.amber, 1);
    let wi = 0; const nW = lay.lines.reduce((s, l) => s + l.words.length, 0); const stag = Math.min(0.07, (0.9 * sc) / Math.max(1, nW));
    lay.lines.forEach((ln, i) => {
      if (lay.squeeze) {
        for (const wd of ln.words) {
          const a = seg(t, at + wi * stag, 0.35 * sc); wi++; if (a <= 0) continue;
          const sq = Math.min(1, maxW / Math.max(1, wd.ww));
          ctx.save(); ctx.translate(x + wd.x, 0); ctx.scale(sq, 1); txt(ctx, wd.w, 0, y0 + i * lh + (1 - eo(a)) * 12, { size: lay.size, weight: 700, color: wd.acc ? C.amber : C.white, alpha: a }); ctx.restore();
        }
        return;
      }
      const base = wi; const idx = new Map(ln.words.map((wd, k) => [wd, base + k])); wi += ln.words.length;
      drawLine(ctx, ln, x, y0 + i * lh, { size: lay.size, weight: 700, rise: 12 }, (wd) => seg(t, at + idx.get(wd) * stag, 0.35 * sc),
        (wd) => (wd.acc ? { key: 1, o: { color: C.amber, glow: 8, glowColor: C.amber } } : { key: 0, o: { color: C.white } }));
    });
  }

  // ---------------- Hintergrund-Leben ----------------
  function drawAmbient(ctx, W, H, t) {
    // langsamer Lichtschleier
    const per = 9, ph = (t % per) / per, gx = -300 + (W + 600) * ph;
    const g = ctx.createLinearGradient(gx - 200, 0, gx + 200, 0);
    g.addColorStop(0, "rgba(63,210,255,0)"); g.addColorStop(0.5, "rgba(63,210,255,0.025)"); g.addColorStop(1, "rgba(63,210,255,0)");
    ctx.save(); ctx.fillStyle = g; ctx.fillRect(gx - 200, 0, 400, H); ctx.restore();
    for (let i = 0; i < 12; i++) {
      const x = (h01(i * 3.1) * W + t * 9 * (0.5 + h01(i))) % W; const y = h01(i * 7.7) * (H - 200) + 60 + Math.sin(t * 0.5 + i) * 12;
      glowDot(ctx, x, y, 2 + 3 * h01(i * 1.3), "#3fd2ff", 0.18 + 0.12 * Math.sin(t + i));
    }
  }

  CEX.register("end_card", {
    ownsText: true,
    draw(ctx, p) {
      const W = p.W || 1920, H = p.H || 1080;
      const P = p.params && typeof p.params === "object" ? p.params : {};
      const t = Math.max(0, Number(p.t) || 0), d = Math.max(0.8, Number(p.d) || 10);
      if (!toBool(pick(P, ["followCamera", "follow_camera"]), false)) ctx.setTransform(1, 0, 0, 1, 0, 0);

      // --- Parameter ---
      const slots = parseSlots(pick(P, ["slots", "elements", "endscreen", "placeholders"]));
      const tvRaw = String(pick(P, ["teaser_visual", "teaserVisual", "visual", "sketch", "teaser_type"]) ?? "crankshaft").toLowerCase();
      const kind = /^(none|off|leer|blank|false|nein|aus)$/.test(tvRaw) ? "none" : /gear|zahn|getriebe/.test(tvRaw) ? "gears" : "crank";
      const rp = kind === "crank" ? parseRpm(P, kind) : null;
      const bigTitle = slots.big && slots.big.title !== undefined ? slots.big.title : undefined;
      const title = strOr(pick(P, ["next_title", "nextTitle", "teaser", "title", "next"]) ?? bigTitle, DEF_TITLE);
      const channel = strOr(pick(P, ["channel", "channel_name", "channelName", "kanal"]), DEF_CHANNEL);
      const tagline = strOr(pick(P, ["tagline", "claim", "slogan", "line"]), DEF_TAGLINE);
      const signoff = strOr(pick(P, ["signoff", "sign_off", "outro", "farewell", "closing"]), "");
      const hdrP = pick(P, ["header", "overlay", "headline"]);
      const header = hdrP === undefined ? clean(p.text) : isOff(hdrP) || hdrP === true ? (hdrP === true ? clean(p.text) : "") : clean(typeof hdrP === "object" ? hdrP.text ?? p.text : hdrP);
      const frameLabel = upper(strOr(pick(P, ["frameLabel", "frame_label", "kicker"]), "NÄCHSTES VIDEO"));
      const secondLabel = upper(strOr(pick(P, ["secondLabel", "second_label"]), "EMPFOHLEN"));
      const secondTitle = strOr(pick(P, ["second_title", "secondTitle"]) ?? (slots.small && slots.small.title), "");
      const subLabel = upper(strOr(pick(P, ["subscribeLabel", "subscribe_label", "aboLabel"]), "ABONNIEREN"));
      const autoNum = toBool(pick(P, ["highlightNumbers", "highlight_numbers"]), true);
      const labelsIn = kind === "crank" ? parseLabels(pick(P, ["labels", "callouts", "parts"])) : [];

      // --- Timing ---
      const ts = clamp(d / 10, 0.45, 1);
      const tMax = Math.max(0.3, d - 0.3); const cT = (x) => clamp(x, 0.3, tMax);
      const beats = Array.isArray(P.beats) ? P.beats.map(num) : [];
      const B = (i, def) => cT(beats[i] !== undefined ? beats[i] : def);
      const ex = (keys) => num(pick(P, keys));
      const b0 = B(0, 0.3), b1 = B(1, 0.19 * d), b2 = B(2, 0.33 * d), b3 = B(3, 0.45 * d), b4 = B(4, 0.56 * d);
      const fd = 0.85 * ts + 0.1;
      const atBig = slots.big && slots.big.at !== undefined ? cT(slots.big.at) : b0;
      const atSmall = slots.small && slots.small.at !== undefined ? cT(slots.small.at) : cT(b0 + 0.25 * ts);
      const subAtP = ex(["subscribeAt", "subscribe_at", "aboAt"]);
      const atSub = slots.sub && slots.sub.at !== undefined ? cT(slots.sub.at) : subAtP !== undefined ? cT(subAtP) : cT(b0 + 0.45 * ts);
      const hdrAtObj = hdrP && typeof hdrP === "object" ? num(hdrP.at) : undefined;
      const atHdr = cT(hdrAtObj ?? ex(["headerAt", "header_at", "overlayAt"]) ?? b0 + 0.1);
      const atTitle = cT(ex(["titleAt", "title_at", "teaserAt"]) ?? b1);
      const atRpm = rp ? cT(rp.atRaw ?? b2) : tMax;
      const atName = cT(ex(["channelAt", "channel_at"]) ?? b3);
      const atTag = cT(ex(["taglineAt", "tagline_at"]) ?? atName + 0.35 * ts);
      const atSign = cT(ex(["signoffAt", "signoff_at"]) ?? b4);
      labelsIn.forEach((lb, i) => { lb.at = cT(lb.atRaw ?? atBig + fd + 0.6 * ts + i * 0.35); });

      const lay = layout({ big: !!slots.big, small: !!slots.small, sub: !!slots.sub });
      drawAmbient(ctx, W, H, t);

      // --- Kopfzeile ---
      const hx = lay.big ? lay.big.x : 120;
      if (header) drawHeader(ctx, header, hx, t, atHdr);
      else if (lay.big && frameLabel) {
        const k = seg(t, atBig + 0.2, 0.4);
        txt(ctx, frameLabel, lay.big.x, lay.big.y - 22, { size: 20, weight: 700, font: F_MONO, ls: 4, color: C.amber, alpha: k });
      }

      // --- großes Video ---
      if (lay.big) {
        const R = lay.big; const promoted = slots.big.promoted;
        const D = clamp(0.75 * ts + 0.25, 0.5, 1.1);
        drawFrame(ctx, R, t, atBig, fd, (A) => {
          if (promoted || kind === "gears") { drawGears(ctx, R, A, t); return; }
          if (kind === "none") { playGlyph(ctx, R.x + R.w / 2, R.y + R.h / 2, R.h * 0.14, A, t); return; }
          const hasT = !!rp;
          const box = hasT ? { x: R.x + 22, y: R.y + 26, w: R.w * 0.6, h: R.h - 52 } : { x: R.x + 40, y: R.y + 26, w: R.w - 80, h: R.h - 52 };
          const st = crankState(t, rp ? rp.val : 0, atRpm, D, atBig);
          drawEngine(ctx, box, st, A, t, labelsIn, t);
          if (hasT) {
            const TR = Math.min(R.h * 0.25, R.w * 0.14), tcx = R.x + R.w - TR - 34, tcy = R.y + R.h * 0.47;
            const idle = Math.min(850, rp.val);
            let v = idle * eo(seg(t, atBig + fd * 0.5, 0.9));
            const k = seg(t, atRpm, D);
            if (k > 0) v = idle + (rp.val - idle) * backOut(k, rp.os);
            // Anzeige zählt monoton bis zum Zielwert (nie darüber) – nur die Nadel darf überschwingen
            const readout = k >= 1 ? fmtInt(rp.val) : fmtInt(Math.round(clamp(v, 0, rp.val) / 50) * 50);
            v += (Math.sin(t * 23) * 0.6 + Math.sin(t * 37 + 1) * 0.4) * (6 + 0.004 * v);
            drawTacho(ctx, tcx, tcy, TR, rp, Math.max(0, v), readout, A, t);
          }
        }, C.cyan);
        drawTitle(ctx, R, title, t, atTitle, ts, autoNum);
      }
      // --- zweites Video ---
      if (lay.small) {
        const R = lay.small;
        drawFrame(ctx, R, t, atSmall, fd, (A) => drawGears(ctx, R, A, t), C.cyan);
        if (secondLabel) txt(ctx, secondLabel, R.x, R.y - 22, { size: 20, weight: 700, font: F_MONO, ls: 4, color: C.amber, alpha: seg(t, atSmall + 0.2, 0.4) });
        if (secondTitle) {
          const tl = fitText(ctx, secondTitle, R.w, [[28, 1], [25, 1], [22, 2]], 600, F_BODY, autoNum);
          const a = seg(t, atSmall + fd, 0.5);
          tl.lines.forEach((ln, i) => drawLine(ctx, ln, R.x, R.y + R.h + 22 + tl.size + i * tl.size * 1.25, { size: tl.size, weight: 600 }, () => a, (wd) => (wd.acc ? { key: 1, o: { color: C.amber } } : { key: 0, o: { color: C.white } })));
        }
      }
      // --- Abo ---
      if (lay.sub) drawSubscribe(ctx, lay.sub, t, atSub, fd * 1.1, subLabel, lay.subLabelY);
      // --- Kanal + Schlusssatz ---
      const yEnd = drawChannel(ctx, lay.chan, channel, tagline, t, atName, atTag, ts);
      if (signoff) {
        let sy;
        if (lay.chan.mode === "center" && lay.big && lay.sub) sy = Math.max(yEnd + 70, 812);
        else sy = (yEnd || lay.chan.nameY) + (lay.chan.mode === "left" && lay.sub ? 58 : 84);
        sy = Math.min(sy, 890);
        drawSignoff(ctx, lay.chan, signoff, sy, t, atSign, ts);
      }
    },
  });

  function playGlyph(ctx, cx, cy, r, A, t) {
    gp(ctx, (c) => c.arc(cx, cy, r * 1.5, 0, TAU), C.cyan, 2, 0.8, A * (0.8 + 0.2 * Math.sin(t * 2)));
    fillPath(ctx, (c) => { c.moveTo(cx - r * 0.45, cy - r * 0.7); c.lineTo(cx + r * 0.75, cy); c.lineTo(cx - r * 0.45, cy + r * 0.7); c.closePath(); }, C.cyan, A * 0.8);
  }
})();
