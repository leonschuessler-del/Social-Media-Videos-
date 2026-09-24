/* Template "physics_fall" – Physik des freien Falls (Röntgen-/Blueprint-Stil).
   Links: hohes Höhenlineal (Höhe in Metern) neben einem Schacht mit Führungsschienen, Puffer und Schachtgrube.
   Die Kabine (kleine Silhouette mit Tragrahmen und Fangvorrichtung) hängt kurz, das Tragseil reißt, die Kabine
   fällt nach echter Kinematik s = ½·g·t² (zeitlich auf die Szenendauer skaliert, Anzeige „Zeitlupe ×N“ /
   „Echtzeit“ / „Zeitraffer ×N“). Stroboskop-Spur: Geisterbilder + Zeitmarken in gleichen Zeitabständen zeigen die
   quadratisch wachsenden Wegstrecken; Maßpfeil „h“ wächst am Lineal mit.
   Rechts: Panel mit Formel v = √(2 · g · h) (echtes Wurzelzeichen mit Überstrich), g = 9,81 m/s², Live-Anzeigen
   Fallhöhe h, Zeit t, Geschwindigkeit v in m/s und km/h, Mini-Diagramm v(h). Nach dem Aufprall bleibt die
   Endgeschwindigkeit groß stehen, die Rechnung mit eingesetzten Werten erscheint.
   Params:
     height_m            Fallhöhe in m (Default 30; Aliase: height, hoehe, höhe, h, fallhoehe, fall_height)
     show_air_resistance bool (Default false) – true: Hinweis „ohne Luftwiderstand“
     air_label           optional: eigener Hinweistext (z. B. „rechnerisch, ohne Luftwiderstand“; blendet den Hinweis ein)
     slowmo              optional: fester Zeitlupenfaktor (>1 Zeitlupe, <1 Zeitraffer, 1 Echtzeit)
     g                   optional: Fallbeschleunigung in m/s² (Default 9,81)
     title               optional: Panel-Überschrift (Default „Freier Fall“; wird gegen Badge gemessen, ggf. ohne
                         Zusatz „ENERGIEERHALTUNG“, verkleinert oder mit „…“ gekürzt)
     markers             optional: [{h, label?, at?}] (oder [10, 100]) – Zwischenmarken bei Fallstrecke h in m:
                         Strich am Lineal + gestrichelte Ziellinie; passiert die Kabine h, friert ein Chip
                         „h = 10 m / ≈ 50 km/h“ an der Zeitspur ein (Default-Label automatisch gerundet) und bleibt stehen.
     kmh_round           optional: Rundungsschritt in km/h (z. B. 10, true = automatisch) – ab BEAT [2] zeigt die
                         km/h-Anzeige „≈ 160“ statt „159“; gilt auch für die automatischen Marken-Labels.
     result_label        optional: Text statt km/h-Wert ab BEAT [2], z. B. „≈ 160 km/h“ oder „über 250 km/h“.
     end_label           optional: leiser Schlusstext nach dem Aufprall (z. B. „sie überlebte“)
     end_label_pos       "shaft" (Default: im Schacht über der Kabine) | "panel" (unter der Aufprallgeschwindigkeit)
     beats               optional: Zeitpunkte in s ab Szenenstart (null = Default), geklemmt auf [0,3; d−0,3]
   BEATS: [0] = Seilriss / Fallbeginn, [1] = Aufprall (mit [0] zusammen bestimmt es den Zeitfaktor:
          N = ([1] − [0]) / echte Fallzeit, Badge zeigt ihn an; nur [1] + slowmo → Fallbeginn wird zurückgerechnet),
          [2] = Ergebnis (eingesetzte Rechnung + gerundeter km/h-Wert; Default Aufprall + 0,3 s),
          [3] = end_label (Default Aufprall + 0,8 s).
   "at": markers[i].at = frühester Zeitpunkt für das Label-Chip der Marke (erscheint nie, bevor die Kabine h passiert).
   Ohne beats: Aufbau ≈ 13 % der Dauer, Fall endet bei ≈ 60 % der Dauer, danach hält das Ergebnis.
   Text: p.text wird selbst als Overlay oben links im Engine-Stil gezeichnet (ownsText: true), lange Texte
         werden zweizeilig umbrochen bzw. verkleinert, damit sie nicht ins Bild ragen. */
(function () {
  "use strict";
  const CE = window.CE;
  if (!CE || typeof CE.register !== "function") return;

  // ---------------- Helfer ----------------
  const TAU = Math.PI * 2;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, s, d) => clamp((t - s) / Math.max(1e-6, d));
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const easeOutBack = (t) => { t = clamp(t); const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const h01 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  const COL = {
    cyan: "#3fd2ff", amber: "#ffb347", red: "#ff5a5f", white: "#eef6ff", muted: "#8fb3d9", steel: "#9fc4e6",
    hot: "#ffe3a8", navy: "#040a16",
  };
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a)})`; };
  const F_HEAD = "Oxanium", F_BODY = "Inter", F_MONO = "JetBrains Mono";

  /** Deutsche Zahl: Dezimalkomma, Tausenderpunkt. */
  function fmt(v, dec) {
    if (!isFinite(v)) v = 0;
    const neg = v < 0; v = Math.abs(v);
    let s = v.toFixed(dec);
    let [ip, fp] = s.split(".");
    if (ip.length > 3) ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (neg ? "-" : "") + ip + (fp ? "," + fp : "");
  }
  const fmtH = (h) => (Math.abs(h - Math.round(h)) < 0.05 ? fmt(Math.round(h), 0) : fmt(h, 1));
  const fmtFactor = (f) => (Math.abs(f - Math.round(f)) < 0.05 ? fmt(Math.round(f), 0) : fmt(f, 1));

  const clampT = (v, d) => clamp(v, Math.min(0.3, d / 2), Math.max(d - 0.3, d / 2));
  const autoStep = (k) => (k >= 100 ? 10 : 1);
  /** Gerundeter km/h-Wert als deutscher String (step −1/0 = automatisch). */
  function fmtKmh(k, step) {
    const st = step > 0 ? step : autoStep(k);
    const v = Math.round(k / st) * st;
    const dec = st >= 1 ? 0 : Math.min(2, Math.ceil(-Math.log10(st) - 1e-9));
    return fmt(v, dec);
  }
  /** „≈ 160 km/h“ -> { pre: "≈", num: "160", unit: "km/h" }; sonst freier Text. */
  function parseResult(str) {
    const s = String(str).trim().replace(/\s+/g, " ");
    const m = s.match(/^(.*?)(\d[\d.,]*)\s*(km\/h|m\/s|kmh)?$/i);
    if (m) return { pre: m[1].trim(), num: m[2], unit: m[3] ? (m[3].toLowerCase() === "kmh" ? "km/h" : m[3]) : "", text: s };
    return { pre: "", num: "", unit: "", text: s };
  }
  function pick(P, keys) { for (const k of keys) if (P && P[k] !== undefined && P[k] !== null && P[k] !== "") return P[k]; return undefined; }
  function num(v, def) {
    if (typeof v === "number") return isFinite(v) ? v : def;
    if (typeof v === "string") { const m = v.replace(/\s/g, "").replace(",", ".").match(/-?\d+(\.\d+)?/); if (m) { const n = parseFloat(m[0]); return isFinite(n) ? n : def; } }
    return def;
  }
  function bool(v, def) {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") { const s = v.trim().toLowerCase(); if (["true", "ja", "yes", "1", "on", "wahr", "y", "j"].includes(s)) return true; if (["false", "nein", "no", "0", "off", "falsch", "n", ""].includes(s)) return false; }
    return def;
  }

  function setFont(ctx, weight, size, family, ls, italic) {
    ctx.font = `${italic ? "italic " : ""}${weight} ${size}px "${family}"`;
    try { ctx.letterSpacing = `${ls || 0}px`; } catch (e) { /* ältere Engines */ }
  }
  function meas(ctx, s, weight, size, family, ls, italic) { ctx.save(); setFont(ctx, weight, size, family, ls, italic); const w = ctx.measureText(s).width; ctx.restore(); return w; }
  /** Text mit Optionen; gibt Breite zurück. */
  function txt(ctx, s, x, y, o) {
    o = o || {};
    const a = o.alpha ?? 1; if (a <= 0.003) return 0;
    ctx.save();
    ctx.globalAlpha = a;
    setFont(ctx, o.weight || 600, o.size || 30, o.font || F_BODY, o.ls, o.italic);
    ctx.textAlign = o.align || "left"; ctx.textBaseline = o.baseline || "alphabetic";
    if (o.glow) { ctx.shadowColor = o.glowColor || o.color || COL.cyan; ctx.shadowBlur = o.glow; }
    ctx.fillStyle = o.color || COL.white;
    ctx.fillText(s, x, y);
    const w = ctx.measureText(s).width;
    ctx.restore();
    return w;
  }
  /** Polylinie teilweise (0..1 der Länge) zeichnen – für „Schreib“-Animationen. */
  function partialPts(pts, f) {
    f = clamp(f); if (f >= 1) return pts;
    let tot = 0; const lens = [];
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); lens.push(l); tot += l; }
    let rem = tot * f; const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const l = lens[i - 1];
      if (rem >= l) { out.push(pts[i]); rem -= l; }
      else { const k = l > 0 ? rem / l : 0; out.push([lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]); break; }
    }
    return out;
  }
  function strokePoly(ctx, pts, color, width, alpha) {
    if (!pts || pts.length < 2 || alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = clamp(alpha); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke(); ctx.restore();
  }
  /** Günstiger Glow: breite, transparente Unterstriche + Kernlinie. */
  function glowPoly(ctx, pts, color, width, alpha, glow) {
    if (!pts || pts.length < 2 || alpha <= 0) return;
    const g = glow ?? 1;
    if (g > 0) { strokePoly(ctx, pts, color, width * 6, alpha * 0.08 * g); strokePoly(ctx, pts, color, width * 2.8, alpha * 0.2 * g); }
    strokePoly(ctx, pts, color, width, alpha);
  }
  function fillRR(ctx, x, y, w, h, r, fill, alpha) {
    if (alpha <= 0 || w <= 0 || h <= 0) return;
    ctx.save(); ctx.globalAlpha = clamp(alpha); ctx.fillStyle = fill; ctx.beginPath(); rrPath(ctx, x, y, w, h, r); ctx.fill(); ctx.restore();
  }
  function strokeRR(ctx, x, y, w, h, r, color, width, alpha) {
    if (alpha <= 0 || w <= 0 || h <= 0) return;
    ctx.save(); ctx.globalAlpha = clamp(alpha); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); rrPath(ctx, x, y, w, h, r); ctx.stroke(); ctx.restore();
  }
  function rrPath(c, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function dot(ctx, x, y, r, color, alpha) { if (alpha <= 0) return; ctx.save(); ctx.globalAlpha = clamp(alpha); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore(); }
  function halo(ctx, x, y, r, color, alpha) {
    if (alpha <= 0.003 || r <= 0) return;
    if (r <= 32) { // günstig: drei weiche Kreisscheiben statt Verlauf
      ctx.save(); ctx.fillStyle = color;
      ctx.globalAlpha = clamp(alpha) * 0.1; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.globalAlpha = clamp(alpha) * 0.16; ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, TAU); ctx.fill();
      ctx.globalAlpha = clamp(alpha) * 0.3; ctx.beginPath(); ctx.arc(x, y, r * 0.32, 0, TAU); ctx.fill();
      ctx.restore(); return;
    }
    ctx.save(); ctx.globalAlpha = clamp(alpha);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, 0.9)); g.addColorStop(0.3, rgba(color, 0.35)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
  }

  // ---------------- Layout ----------------
  const YT = 318;            // Linealoberkante (Höhe R)
  const Y0 = 818;            // 0 m = Pufferoberkante
  const BUF_H = 50;          // Pufferhöhe (unbelastet)
  const PIT = Y0 + BUF_H;    // Schachtgrube (Boden)
  const RX = 250;            // Linealachse
  const BX = 290;            // Maßpfeil h
  const SH_L = 346, SH_R = 530; // Schachtwände
  const CX = 438;            // Kabinenmitte
  const CAR_W = 70, CAB_H = 72, PLANK = 9, XHEAD = 10;
  const RAIL_L = CX - CAR_W / 2 - 13, RAIL_R = CX + CAR_W / 2 + 13;
  const TX = 572;            // Stroboskop-Zeitspur
  const SNAP_D = 24;         // Rissstelle über der Seilaufhängung
  const PX = 800, PY = 232, PW = 1030, PH = 648; // Panel
  const IX0 = PX + 50, IX1 = PX + PW - 50;

  // ---------------- Modell (gecacht pro Parametersatz + Dauer) ----------------
  const NICE_SLOW = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 150, 200];
  let MKEY = null, MOD = null;
  function nice125(x) {
    const e = Math.floor(Math.log10(Math.max(1e-9, x))); const b = Math.pow(10, e);
    let best = b, bd = Infinity;
    for (const m of [1, 2, 5, 10]) { const c = m * b; const dd = Math.abs(Math.log(c / x)); if (dd < bd) { bd = dd; best = c; } }
    return best;
  }
  function getModel(params, d) {
    let key;
    try { key = JSON.stringify(params || {}) + "|" + d; } catch (e) { key = "x|" + d; }
    if (key === MKEY && MOD) return MOD;
    const P = params && typeof params === "object" ? params : {};
    let h = num(pick(P, ["height_m", "height", "hoehe", "höhe", "h", "fallhoehe", "fallhöhe", "fall_height", "height_meters", "drop_m", "hoehe_m"]), 30);
    if (!(h > 0)) h = 30; h = clamp(h, 0.5, 5000);
    let g = num(pick(P, ["g", "gravity", "erdbeschleunigung"]), 9.81); if (!(g > 0.5) || g > 100) g = 9.81;
    const air = bool(pick(P, ["show_air_resistance", "air_resistance", "ohne_luftwiderstand", "no_air_resistance", "air_note", "luftwiderstand"]), false);
    const titleRaw = pick(P, ["title", "titel", "label", "heading"]);
    const title = (typeof titleRaw === "string" && titleRaw.trim()) ? titleRaw.trim() : "Freier Fall";
    const Tf = Math.sqrt((2 * h) / g), vEnd = g * Tf;

    // Beats (Sekunden ab Szenenstart, geklemmt auf [0,3; d−0,3])
    const bt = [NaN, NaN, NaN, NaN];
    const rawB = P.beats;
    if (Array.isArray(rawB)) for (let i = 0; i < 4 && i < rawB.length; i++) { const v = num(rawB[i], NaN); if (isFinite(v)) bt[i] = clampT(v, d); }
    else if (rawB && typeof rawB === "object") { // tolerant: {snap, impact, result, end}
      const keys = [["snap", "fall", "start"], ["impact", "aufprall"], ["result", "ergebnis"], ["end", "end_label"]];
      keys.forEach((ks, i) => { const v = num(pick(rawB, ks), NaN); if (isFinite(v)) bt[i] = clampT(v, d); });
    }

    // Zeitplan: Intro (Aufbau, Seil gespannt) -> Fall -> Aufprall -> Halten
    let I = clamp(0.13 * d, 0.45, 1.8);
    if (isFinite(bt[0])) I = bt[0];
    const slowP = num(pick(P, ["slowmo", "slow_motion", "zeitlupe", "time_scale", "slowmo_factor"]), NaN);
    let N, Ts;
    if (isFinite(bt[1])) {
      // Aufprall-Beat: Zeitfaktor so, dass die echte Kinematik genau zwischen Fallbeginn und Aufprall passt
      if (!isFinite(bt[0]) && slowP > 0) I = Math.max(0.3, bt[1] - Tf * slowP);
      if (bt[1] - I < 0.2) I = Math.max(0.05, bt[1] - 0.2);
      Ts = Math.max(0.2, bt[1] - I); N = Ts / Tf;
    } else {
      const target = Math.max(0.35, 0.6 * d - I - 0.1);
      N = slowP;
      if (!(N > 0)) {
        const Nid = target / Tf;
        if (Nid >= 1) { N = 1; for (const c of NICE_SLOW) if (c <= Nid * 1.12) N = c; }
        else if (I + Tf <= 0.8 * d) N = 1;
        else { const need = Tf / target; let M = NICE_SLOW[NICE_SLOW.length - 1]; for (let i = NICE_SLOW.length - 1; i >= 0; i--) if (NICE_SLOW[i] >= need) M = NICE_SLOW[i]; N = 1 / M; }
      }
      N = clamp(N, 0.005, 1000);
      Ts = Tf * N;
      const maxTs = Math.max(0.3, d - I - Math.min(1.0, 0.25 * d));
      if (Ts > maxTs) { Ts = maxTs; N = Ts / Tf; }
    }
    N = clamp(N, 0.005, 1000);
    const t0 = I, t1 = I + Ts;
    // Ergebnis- und Schlusstext-Zeitpunkte
    const late = Math.max(t1, d - 0.3);
    let tRes = isFinite(bt[2]) ? Math.max(bt[2], t1) : t1 + 0.3;
    tRes = Math.min(tRes, late);
    const endAtP = num(pick(P, ["end_label_at", "end_at"]), NaN);
    const bEnd = isFinite(bt[3]) ? bt[3] : isFinite(endAtP) ? clampT(endAtP, d) : NaN;
    let tEnd = isFinite(bEnd) ? Math.max(bEnd, t1 + 0.1) : clamp(t1 + 0.8, t1 + 0.2, Math.max(t1 + 0.2, d - 0.7));
    tEnd = Math.min(tEnd, late);

    // km/h-Rundung / Ergebnislabel
    const kr = pick(P, ["kmh_round", "round_kmh", "kmh_rounding", "rounding"]);
    const kStep = kr === true ? -1 : Math.max(0, num(kr, 0)); // -1 = automatisch
    const kmhEnd = vEnd * 3.6;
    let result = null;
    const rl = pick(P, ["result_label", "result", "ergebnis_label", "result_text"]);
    if (typeof rl === "string" && rl.trim()) result = parseResult(rl);
    else if (kStep !== 0) result = { pre: "≈", num: fmtKmh(kmhEnd, kStep), unit: "km/h", text: "" };

    // Hinweis Luftwiderstand
    let airText = "ohne Luftwiderstand";
    const al = pick(P, ["air_label", "air_note_text", "air_text", "air_note"]);
    let airOn = air;
    if (typeof al === "string" && al.trim() && bool(al, null) === null) { airText = al.trim(); airOn = true; }

    // Schlusstext
    const elRaw = pick(P, ["end_label", "endlabel", "end_text", "outro_label", "epilog"]);
    const endLabel = typeof elRaw === "string" && elRaw.trim() ? elRaw.trim() : "";
    const endPos = String(pick(P, ["end_label_pos", "end_label_position"]) || "shaft").toLowerCase() === "panel" ? "panel" : "shaft";

    // Zwischenmarken (Fallstrecke in m)
    let rawM = pick(P, ["markers", "marker", "marks", "height_markers", "checkpoints", "milestones"]);
    if (rawM !== undefined && !Array.isArray(rawM)) rawM = [rawM];
    const markers = [];
    for (const it of rawM || []) {
      let hm = NaN, lab = "", at = NaN;
      if (typeof it === "number" || typeof it === "string") hm = num(it, NaN);
      else if (it && typeof it === "object") {
        hm = num(pick(it, ["h", "height", "height_m", "m", "s", "distance", "fall", "meters"]), NaN);
        const l = pick(it, ["label", "text", "title", "value"]); if (typeof l === "string" || typeof l === "number") lab = String(l).trim();
        at = num(pick(it, ["at", "show_at"]), NaN);
      }
      if (!(hm > 0) || hm > h * 1.0001) continue;
      hm = Math.min(hm, h);
      const tPass = I + Math.sqrt((2 * hm) / g) * N;
      const vm = Math.sqrt(2 * g * hm);
      if (!lab) lab = "≈ " + fmtKmh(vm * 3.6, kStep) + " km/h";
      markers.push({ s: hm, label: lab, tPass, tShow: isFinite(at) ? Math.max(tPass, clampT(at, d)) : tPass, v: vm });
      if (markers.length >= 6) break;
    }
    markers.sort((a, b) => a.s - b.s);
    let mode, badge;
    if (Math.abs(N - 1) < 0.03) { mode = "real"; badge = "ECHTZEIT"; }
    else if (N > 1) { mode = "slow"; badge = "ZEITLUPE ×" + fmtFactor(N); }
    else { mode = "fast"; badge = "ZEITRAFFER ×" + fmtFactor(1 / N); }

    // Lineal
    const step = nice125(h / 5.5);
    const R = Math.max(step, Math.ceil(h / step - 1e-9) * step);
    const pxm = (Y0 - YT) / R;
    const pxStep = step * pxm;
    let minor = 0;
    if (pxStep / 5 >= 8) minor = step / 5; else if (pxStep / 2 >= 8) minor = step / 2;
    const stepDec = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;

    // Stroboskop-Takt
    let dt = 0.25, bd = Infinity;
    for (const c of [0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10]) { const dd = Math.abs(Tf / c - 8); if (dd < bd) { bd = dd; dt = c; } }
    const dtDec = dt >= 1 ? 0 : (dt === 0.25 || dt < 0.1) ? 2 : 1;
    const ghosts = [];
    for (let k = 1; k * dt < Tf - 1e-6; k++) ghosts.push(k * dt);
    // Zeit-Beschriftungen: nur wenn genug Abstand (in px) – von unten nach oben ausdünnen
    const yOfS = (s) => Y0 - (h - s) * pxm;
    const marks = [{ t: 0, y: yOfS(0), label: "0 s", final: false }];
    for (const tk of ghosts) marks.push({ t: tk, y: yOfS(0.5 * g * tk * tk), label: fmt(tk, dtDec) + " s", final: false });
    marks.push({ t: Tf, y: yOfS(h), label: fmt(Tf, 2) + " s", final: true });
    // Beschriftung: Start und Aufprall immer, dazwischen nur mit Mindestabstand 27 px
    const fin = marks[marks.length - 1];
    let lastY = marks[0].y; marks[0].showLabel = true; fin.showLabel = true;
    for (let i = 1; i < marks.length - 1; i++) { const m = marks[i]; m.showLabel = m.y - lastY >= 27 && fin.y - m.y >= 27; if (m.showLabel) lastY = m.y; }

    MOD = { h, g, air: airOn, airText, title, Tf, vEnd, I, Ts, N, t0, t1, tRes, tEnd, result, endLabel, endPos, markers, mode, badge, step, R, pxm, minor, stepDec, dt, dtDec, ghosts, marks, yOfS, kmh: kmhEnd, d };
    MKEY = key;
    return MOD;
  }

  // ---------------- Overlay-Text (Engine-Stil, mit Umbruch) ----------------
  let OV_KEY = null, OV = null;
  function ellipsize(ctx, s, maxW, size) { if (meas(ctx, s, 700, size, F_HEAD, 2) <= maxW) return s; let t = s; while (t.length > 1 && meas(ctx, t + "…", 700, size, F_HEAD, 2) > maxW) t = t.slice(0, -1); return t.trimEnd() + "…"; }
  function wrapLines(ctx, s, maxW, size) {
    const words = s.split(/\s+/).filter(Boolean); const lines = []; let cur = "";
    for (const w of words) { const test = cur ? cur + " " + w : w; if (cur && meas(ctx, test, 700, size, F_HEAD, 2) > maxW) { lines.push(cur); cur = w; } else cur = test; }
    if (cur) lines.push(cur); return lines;
  }
  function overlayLayout(ctx, text) {
    if (OV_KEY === text && OV) return OV;
    const s = String(text).toUpperCase().replace(/\s+/g, " ").trim();
    // Box darf bis x ≈ 1200 reichen (darunter/rechts davon liegt nichts Wichtiges; Kapitel-Badge ab x ≈ 1400)
    const MAXW = 1030;
    const fits = (ls, sz) => ls.every((l) => meas(ctx, l, 700, sz, F_HEAD, 2) <= MAXW);
    let size = 40, lines = [s];
    if (meas(ctx, s, 700, size, F_HEAD, 2) > MAXW) {
      // ausgewogener Umbruch: kleinste Breite, die noch dieselbe Zeilenzahl ergibt
      const balanced = (sz, n) => {
        let lo = 80, hi = MAXW, best = wrapLines(ctx, s, MAXW, sz);
        if (best.length > n) return null;
        for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; const ls = wrapLines(ctx, s, mid, sz); if (ls.length <= n && fits(ls, sz)) { best = ls; hi = mid; } else lo = mid; }
        return best;
      };
      let ok = false;
      for (let sz = 40; sz >= 28 && !ok; sz -= 2) { const ls = balanced(sz, 2); if (ls && fits(ls, sz)) { size = sz; lines = ls; ok = true; } }
      for (let sz = 28; sz >= 24 && !ok; sz -= 2) { const ls = balanced(sz, 3); if (ls && fits(ls, sz)) { size = sz; lines = ls; ok = true; } }
      if (!ok) { size = 24; lines = wrapLines(ctx, s, MAXW, size); if (lines.length > 3) { const rest = lines.slice(2).join(" "); lines = [lines[0], lines[1], ellipsize(ctx, rest, MAXW, size)]; } lines = lines.map((l) => ellipsize(ctx, l, MAXW, size)); }
    }
    let w = 0; for (const ln of lines) w = Math.max(w, meas(ctx, ln, 700, size, F_HEAD, 2));
    OV_KEY = text; OV = { size, lines, w: w + 70 };
    return OV;
  }
  function drawOverlay(ctx, L, text, t, d) {
    if (!text || !String(text).trim()) return;
    const a = L.env(t, 0.5, d - 0.3, 0.45); if (a <= 0) return;
    const O = overlayLayout(ctx, String(text));
    const x = 90, top = 96, lhh = O.size * 1.18;
    const h = O.size + 34 + (O.lines.length - 1) * lhh;
    const slide = easeOut(seg(t, 0.5, 0.5));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = a;
    ctx.fillStyle = COL.amber; ctx.fillRect(x, top, 8, h);
    L.panel(ctx, x + 14, top, O.w * slide, h, { fill: "rgba(4,12,26,0.82)", stroke: "rgba(255,179,71,0.35)", r: 4, alpha: a });
    O.lines.forEach((ln, k) => txt(ctx, ln, x + 44, top + 17 + 0.97 * O.size + k * lhh, { font: F_HEAD, weight: 700, size: O.size, ls: 2, color: COL.white, alpha: a * seg(t, 0.75, 0.35) }));
    ctx.restore();
  }

  /** Overlay-Box (Bildschirmkoordinaten) des aktuellen Frames – für Kollisionsvermeidung unter Kamerafahrten. */
  let OVR = null;
  function overlayRect(ctx, text) {
    if (!text || !String(text).trim()) return null;
    const O = overlayLayout(ctx, String(text));
    const lhh = O.size * 1.18;
    return { x0: 90, y0: 96, x1: 104 + O.w, y1: 96 + O.size + 34 + (O.lines.length - 1) * lhh };
  }
  /** 1 = frei, → 0 wenn das Rechteck (Weltkoordinaten) unter der Overlay-Box läge. */
  function overlayClear(ctx, x, y, w, h) {
    if (!OVR) return 1;
    let m; try { m = ctx.getTransform(); } catch (e) { return 1; }
    const sx0 = m.a * x + m.c * y + m.e, sy0 = m.b * x + m.d * y + m.f;
    const sx1 = sx0 + w * m.a;
    if (sx1 < OVR.x0 - 8 || sx0 > OVR.x1 + 12) return 1;
    return clamp((sy0 - OVR.y1 - 8) / 22);
  }

  // ---------------- Zustand zum Zeitpunkt t ----------------
  function state(M, t) {
    const tr = clamp((t - M.t0) / M.N, 0, M.Tf); // reale Fallzeit
    const falling = t >= M.t0 && t < M.t1;
    const impacted = t >= M.t1;
    const s = impacted ? M.h : 0.5 * M.g * tr * tr;
    const v = impacted ? M.vEnd : M.g * tr;
    const ti = impacted ? t - M.t1 : -1; // Zeit seit Aufprall (Bildschirmzeit)
    const tb = t * Math.max(1, 1.04 / M.I); // Aufbau-Zeit: in kurzen Szenen schneller
    return { tr: impacted ? M.Tf : tr, falling, impacted, s, v, ti, vf: M.vEnd > 0 ? v / M.vEnd : 0, tb };
  }

  // ---------------- Hintergrund-Staub ----------------
  /** Schwebstaub: in drei Gruppen gebündelt (je ein Pfad), Gruppen-Helligkeit pulsiert. */
  function drawDust(ctx, t, S) {
    ctx.save(); ctx.fillStyle = COL.cyan;
    const span = PIT - 260;
    for (let gI = 0; gI < 3; gI++) {
      ctx.globalAlpha = 0.2 + 0.16 * (0.5 + 0.5 * Math.sin(t * 1.3 + gI * 2.1));
      ctx.beginPath();
      for (let i = gI; i < 26; i += 3) {
        const x = SH_L + 8 + h01(i * 3.7) * (SH_R - SH_L - 16) + Math.sin(t * 0.8 + i) * 4;
        let y = 250 + h01(i * 9.1) * span + Math.sin(t * 0.6 + i * 1.7) * 10 - t * (4 + 5 * h01(i));
        y = 250 + ((((y - 250) % span) + span) % span);
        const r = 1.2 + 1.6 * h01(i * 1.3);
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
      }
      ctx.fill();
      ctx.globalAlpha = 0.1 + 0.08 * (0.5 + 0.5 * Math.sin(t * 1.1 + gI * 1.7));
      ctx.beginPath();
      for (let i = gI; i < 18; i += 3) {
        const x = PX - 60 + h01(i * 5.3 + 2) * (PW + 60);
        const y = 250 + ((h01(i * 2.9 + 1) * 640 - t * (6 + 6 * h01(i * 1.9))) % 640 + 640) % 640;
        const r = 1 + 1.4 * h01(i * 4.1);
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
      }
      ctx.fill();
    }
    ctx.restore();
    void S;
  }

  // ---------------- Lineal ----------------
  function drawRuler(ctx, M, t, S, L) {
    const a = easeOut(seg(S.tb, 0.05, 0.6));
    if (a <= 0) return;
    const grow = easeInOut(seg(S.tb, 0.0, 0.9));
    const yTopNow = lerp(Y0, YT, grow);
    // Achse
    glowPoly(ctx, [[RX, Y0], [RX, yTopNow]], COL.cyan, 2, 0.75 * a, 0.7);
    // Striche (ein Pfad je Stärke)
    ctx.save();
    ctx.strokeStyle = COL.cyan; ctx.lineCap = "butt";
    if (M.minor > 0) {
      ctx.globalAlpha = 0.45 * a; ctx.lineWidth = 1.5; ctx.beginPath();
      const n = Math.round(M.R / M.minor);
      for (let i = 0; i <= n; i++) { const m = i * M.minor; const y = Y0 - m * M.pxm; if (y < yTopNow - 0.5) break; if (Math.abs(m / M.step - Math.round(m / M.step)) < 1e-6) continue; ctx.moveTo(RX - 10, y); ctx.lineTo(RX, y); }
      ctx.stroke();
    }
    ctx.globalAlpha = 0.9 * a; ctx.lineWidth = 2.2; ctx.beginPath();
    const nMaj = Math.round(M.R / M.step);
    for (let i = 0; i <= nMaj; i++) { const y = Y0 - i * M.step * M.pxm; if (y < yTopNow - 0.5) break; ctx.moveTo(RX - 22, y); ctx.lineTo(RX, y); }
    ctx.stroke();
    // feine Hilfslinien quer durch den Schacht
    ctx.globalAlpha = 0.07 * a; ctx.lineWidth = 1; ctx.setLineDash([4, 8]); ctx.beginPath();
    for (let i = 1; i <= nMaj; i++) { const y = Y0 - i * M.step * M.pxm; if (y < yTopNow - 0.5) break; ctx.moveTo(RX + 4, y + 0.5); ctx.lineTo(SH_R + 20, y + 0.5); }
    ctx.stroke();
    ctx.restore();
    // Zahlen
    for (let i = 0; i <= nMaj; i++) {
      const m = i * M.step; const y = Y0 - m * M.pxm; if (y < yTopNow - 0.5) break;
      txt(ctx, fmt(m, M.stepDec), RX - 32, y + 8, { font: F_MONO, weight: 700, size: 24, color: i === 0 ? COL.white : COL.muted, align: "right", alpha: a });
    }
    // Achsenbeschriftung (gedreht)
    ctx.save();
    ctx.translate(122, (YT + Y0) / 2); ctx.rotate(-Math.PI / 2);
    txt(ctx, "HÖHE IN METERN", 0, 0, { font: F_MONO, weight: 700, size: 20, ls: 4, color: COL.cyan, align: "center", alpha: 0.85 * a });
    ctx.restore();
    // Scan-Licht, das am Lineal auf und ab gleitet (Ruhebewegung)
    const sc = 0.5 + 0.5 * Math.sin(t * 0.9);
    const ys = lerp(Y0, YT, sc);
    if (grow >= 1) halo(ctx, RX, ys, 26, COL.cyan, 0.22 * a);
    void S; void L;
  }

  // ---------------- Schacht, Schienen, Puffer, Grube ----------------
  let SHAFT_CACHE = null;
  function shaftCache() {
    if (SHAFT_CACHE !== null) return SHAFT_CACHE;
    SHAFT_CACHE = false;
    try {
      const k = 1, ox = SH_L - 24, oy = 226, w = SH_R + 24 - ox, h = PIT + 26 - oy;
      const cv = document.createElement("canvas"); cv.width = w * k; cv.height = h * k;
      const c = cv.getContext("2d"); if (!c) return SHAFT_CACHE;
      c.scale(k, k); c.translate(-ox, -oy);
      drawShaftRaw(c);
      SHAFT_CACHE = { cv, ox, oy, w, h };
    } catch (e) { SHAFT_CACHE = false; }
    return SHAFT_CACHE;
  }
  /** Schacht (statisch) – einmal in einen Offscreen-Canvas gerendert, danach nur noch drawImage. */
  function drawShaft(ctx, M, t, S) {
    const a = easeOut(seg(S.tb, 0.1, 0.7));
    if (a <= 0) return;
    const C = shaftCache();
    ctx.save(); ctx.globalAlpha = a;
    if (C) ctx.drawImage(C.cv, C.ox, C.oy, C.w, C.h); else drawShaftRaw(ctx);
    ctx.restore();
    void M; void t;
  }
  function drawShaftRaw(ctx) {
    const yTop = 236;
    // Wände (Schnitt) mit Schraffur außen
    ctx.save();
    const grad = ctx.createLinearGradient(0, yTop, 0, yTop + 90);
    grad.addColorStop(0, rgba(COL.cyan, 0)); grad.addColorStop(1, rgba(COL.cyan, 0.42));
    ctx.strokeStyle = grad; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(SH_L, yTop); ctx.lineTo(SH_L, PIT); ctx.moveTo(SH_R, yTop); ctx.lineTo(SH_R, PIT); ctx.stroke();
    const hg = ctx.createLinearGradient(0, yTop, 0, yTop + 90);
    hg.addColorStop(0, rgba(COL.cyan, 0)); hg.addColorStop(1, rgba(COL.cyan, 0.16));
    ctx.strokeStyle = hg; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let y = yTop; y < PIT; y += 16) { ctx.moveTo(SH_L - 12, y + 12); ctx.lineTo(SH_L, y); ctx.moveTo(SH_R, y + 12); ctx.lineTo(SH_R + 12, y); }
    ctx.stroke();
    // Führungsschienen
    const rg = ctx.createLinearGradient(0, yTop, 0, yTop + 90);
    rg.addColorStop(0, rgba(COL.steel, 0)); rg.addColorStop(1, rgba(COL.steel, 0.75));
    ctx.strokeStyle = rg; ctx.lineWidth = 4; ctx.beginPath();
    ctx.moveTo(RAIL_L, yTop); ctx.lineTo(RAIL_L, PIT); ctx.moveTo(RAIL_R, yTop); ctx.lineTo(RAIL_R, PIT); ctx.stroke();
    // Schienenbügel
    ctx.lineWidth = 2; ctx.strokeStyle = rgba(COL.steel, 0.35); ctx.beginPath();
    for (let y = PIT - 40; y > yTop + 60; y -= 96) { ctx.moveTo(SH_L, y); ctx.lineTo(RAIL_L - 3, y); ctx.moveTo(RAIL_R + 3, y); ctx.lineTo(SH_R, y); }
    ctx.stroke();
    // Grubenboden mit Schraffur
    ctx.strokeStyle = rgba(COL.cyan, 0.7); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(SH_L - 14, PIT); ctx.lineTo(SH_R + 14, PIT); ctx.stroke();
    ctx.strokeStyle = rgba(COL.cyan, 0.2); ctx.lineWidth = 1.2; ctx.beginPath();
    for (let x = SH_L - 12; x < SH_R + 12; x += 13) { ctx.moveTo(x, PIT + 16); ctx.lineTo(x + 13, PIT + 3); }
    ctx.stroke();
    ctx.restore();
  }

  function drawBuffer(ctx, t, S, M) {
    const a = easeOut(seg(S.tb, 0.2, 0.6)); if (a <= 0) return;
    let c = 0;
    if (S.impacted) { const k = S.ti; c = 0.42 * easeOut(seg(k, 0, 0.12)) - 0.1 * Math.sin(seg(k, 0.12, 0.5) * Math.PI) * (1 - seg(k, 0.12, 0.5)); }
    const topY = Y0 + BUF_H * 0.62 * c;
    const w = 44, x = CX - w / 2;
    const col = S.impacted ? COL.red : COL.amber;
    const glowK = S.impacted ? 1 - seg(S.ti, 0.1, 1.2) * 0.6 : 0.6;
    // Grundplatte
    fillRR(ctx, x - 6, PIT - 7, w + 12, 7, 2, rgba(COL.amber, 0.8), a);
    // Feder
    const turns = 5; const pts = [];
    const y1 = PIT - 8, y2 = topY + 7;
    for (let i = 0; i <= turns * 2; i++) pts.push([CX + (i === 0 || i === turns * 2 ? 0 : (i % 2 ? 17 : -17)), lerp(y1, y2, i / (turns * 2))]);
    glowPoly(ctx, pts, col, 2.4, a, glowK);
    // Stößelplatte
    fillRR(ctx, x - 4, topY, w + 8, 7, 2, col, a);
    halo(ctx, CX, topY, 30, col, 0.2 * a * glowK);
    void M;
  }

  // ---------------- Kabine ----------------
  function carPath(ctx, x0, yb) {
    // nur Umriss (für Geisterbilder)
    ctx.rect(x0, yb - PLANK - CAB_H, CAR_W, CAB_H);
  }
  function drawCar(ctx, yb, o) {
    const a = o.alpha ?? 1; if (a <= 0) return;
    const col = o.color || COL.cyan;
    const x0 = CX - CAR_W / 2;
    const cabTop = yb - PLANK - CAB_H;
    const xh = cabTop - XHEAD;
    ctx.save();
    ctx.globalAlpha = a;
    // Kabinen-Füllung
    ctx.fillStyle = rgba(col, 0.1); ctx.fillRect(x0, cabTop, CAR_W, CAB_H);
    ctx.restore();
    // Person (Silhouette) – dezent
    if (o.person && o.L) o.L.person(ctx, CX - 12, yb - PLANK - 3, CAB_H * 0.74, COL.steel, 0.28 * a);
    // Kabine
    glowPoly(ctx, [[x0, cabTop], [x0 + CAR_W, cabTop], [x0 + CAR_W, yb - PLANK], [x0, yb - PLANK], [x0, cabTop]], col, 2.4, a, o.glow ?? 1);
    // Türspalt
    ctx.save(); ctx.globalAlpha = 0.45 * a; ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(CX + 10, cabTop + 8); ctx.lineTo(CX + 10, yb - PLANK - 6); ctx.stroke(); ctx.restore();
    // Tragrahmen: Querhaupt, Stiele, Bodenrahmen
    const sx0 = x0 - 6, sx1 = x0 + CAR_W + 6;
    fillRR(ctx, sx0 - 1, xh, sx1 - sx0 + 2, XHEAD, 2, rgba(COL.steel, 0.9), a);
    fillRR(ctx, sx0 - 1, yb - PLANK, sx1 - sx0 + 2, PLANK, 2, rgba(COL.steel, 0.9), a);
    strokePoly(ctx, [[sx0 + 1, xh + XHEAD], [sx0 + 1, yb - PLANK]], rgba(COL.steel, 0.9), 3, a);
    strokePoly(ctx, [[sx1 - 1, xh + XHEAD], [sx1 - 1, yb - PLANK]], rgba(COL.steel, 0.9), 3, a);
    // Führungsschuhe an den Schienen
    for (const yy of [xh + 2, yb - PLANK - 2]) {
      fillRR(ctx, RAIL_L - 5, yy - 5, 10, 10, 2, rgba(COL.steel, 0.85), a);
      fillRR(ctx, RAIL_R - 5, yy - 5, 10, 10, 2, rgba(COL.steel, 0.85), a);
    }
    // Fangvorrichtung (Keile an der Schiene, unten)
    const fc = o.gearColor || COL.amber;
    fillRR(ctx, RAIL_L + 4, yb - PLANK - 14, 6, 14, 1, fc, a);
    fillRR(ctx, RAIL_R - 10, yb - PLANK - 14, 6, 14, 1, fc, a);
    // Seilaufhängung
    fillRR(ctx, CX - 9, xh - 5, 18, 5, 1, rgba(COL.steel, 0.9), a);
  }

  // ---------------- Tragseile + Seilriss ----------------
  function drawRopes(ctx, M, t, S, yb, L) {
    const a = easeOut(seg(S.tb, 0.15, 0.5)); if (a <= 0) return;
    const xh = yb - PLANK - CAB_H - XHEAD - 5; // Oberkante Seilaufhängung
    const ropeTop = 110; // Seile laufen nach oben (Richtung Triebwerksraum) aus
    const xs = [-6, 0, 6];
    const tSnap = M.t0;
    const pre = seg(t, tSnap - Math.min(0.45, M.I * 0.6), Math.min(0.45, M.I * 0.6)); // Spannung vor dem Riss
    const snapY = xh - SNAP_D; // Rissstelle
    const ybStart = M.yOfS(0);
    const snapWorld = ybStart - PLANK - CAB_H - XHEAD - 5 - SNAP_D;
    if (t < tSnap) {
      // intakte Seile: laufen nach oben aus (Verlauf)
      ctx.save();
      const g = ctx.createLinearGradient(0, ropeTop, 0, ropeTop + 90);
      const flick = pre > 0 ? 0.5 + 0.5 * Math.sin(t * 60) : 0;
      const colHex = pre > 0.02 ? COL.red : COL.cyan;
      g.addColorStop(0, rgba(colHex, 0)); g.addColorStop(1, rgba(colHex, 0.95));
      ctx.globalAlpha = a; ctx.strokeStyle = g; ctx.lineWidth = 2;
      ctx.beginPath(); for (const dx of xs) { ctx.moveTo(CX + dx, ropeTop); ctx.lineTo(CX + dx, xh); } ctx.stroke();
      ctx.globalAlpha = a * 0.25 * (1 + pre * flick); ctx.lineWidth = 7;
      ctx.beginPath(); for (const dx of xs) { ctx.moveTo(CX + dx, ropeTop + 70); ctx.lineTo(CX + dx, xh); } ctx.stroke();
      ctx.restore();
      if (pre > 0) halo(ctx, CX, snapY, 22 + 10 * flick, COL.red, 0.35 * pre);
      void L;
      return;
    }
    const k = t - tSnap; // Bildschirmzeit seit Riss
    // oberes Seilstück schnellt nach oben und verblasst
    const ua = a * (1 - 0.55 * seg(k, 0.25, 0.9)); // oberes Seilende bleibt (gedimmt) hängen
    if (ua > 0) {
      const lift = 70 * easeOut(seg(k, 0, 0.6));
      ctx.save();
      const g = ctx.createLinearGradient(0, ropeTop, 0, ropeTop + 90);
      g.addColorStop(0, rgba(COL.red, 0)); g.addColorStop(1, rgba(COL.red, 0.9));
      ctx.globalAlpha = ua; ctx.strokeStyle = g; ctx.lineWidth = 2;
      ctx.beginPath();
      xs.forEach((dx, i) => {
        const endY = snapWorld - lift; const whip = Math.sin(k * 26 + i * 1.7) * 12 * Math.exp(-k * 3);
        ctx.moveTo(CX + dx, ropeTop); ctx.quadraticCurveTo(CX + dx + whip, (ropeTop + endY) / 2, CX + dx + whip * 1.6 + (i - 1) * 4, endY);
      });
      ctx.stroke(); ctx.restore();
    }
    // Funken an der Rissstelle
    if (k < 0.8) L.sparks(ctx, CX, snapWorld, k, { seed: 7, count: 22, life: 0.5, window: 0.12, speed: 380, spread: Math.PI * 1.6, dir: -Math.PI / 2, gravity: 700 });
    if (k < 0.35) halo(ctx, CX, snapWorld, 60 * (1 - k / 0.35) + 10, COL.hot, 0.8 * (1 - k / 0.35));
    // Seilstummel an der Kabine (flattern im Fahrtwind nach oben)
    const vf = S.vf; const st = S.impacted ? Math.exp(-S.ti * 2.5) : 1;
    ctx.save(); ctx.strokeStyle = COL.red; ctx.lineWidth = 2.2; ctx.globalAlpha = a * 0.95; ctx.lineCap = "round";
    ctx.beginPath();
    xs.forEach((dx, i) => {
      const len = 30 + 4 * i;
      const flap = Math.sin(t * (14 + 3 * i) + i * 2) * (2 + 6 * vf) * st + (S.impacted ? Math.sin(S.ti * 18 + i) * 8 * Math.exp(-S.ti * 3) : 0);
      const x1 = CX + dx, y1 = xh;
      const bend = S.impacted ? 1 - Math.exp(-S.ti * 4) : 0; // nach dem Aufprall kippen die Stummel zur Seite
      const ex = x1 + flap + (i - 1) * (6 + 16 * bend), ey = y1 - len * (1 - 0.45 * bend);
      ctx.moveTo(x1, y1); ctx.quadraticCurveTo(x1 + flap * 0.4, y1 - len * 0.5, ex, ey);
      // ausgefranstes Ende
      ctx.moveTo(ex, ey); ctx.lineTo(ex - 4, ey - 5); ctx.moveTo(ex, ey); ctx.lineTo(ex + 4, ey - 6);
    });
    ctx.stroke(); ctx.restore();
    void snapY;
  }

  // ---------------- Stroboskop (Geisterbilder + Zeitspur) ----------------
  function drawStrobe(ctx, M, t, S) {
    const a0 = easeOut(seg(S.tb, 0.2, 0.6)); if (a0 <= 0) return;
    const ybStart = M.yOfS(0);
    // Zeitspur-Achse
    const trackA = a0 * 0.8;
    ctx.save(); ctx.globalAlpha = 0.28 * trackA; ctx.strokeStyle = COL.steel; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(TX, ybStart); ctx.lineTo(TX, Y0); ctx.stroke(); ctx.restore();
    txt(ctx, "t", TX, ybStart - 18, { font: F_BODY, italic: true, weight: 600, size: 24, color: COL.white, align: "center", alpha: 0.8 * trackA });
    // Geisterbilder
    ctx.save(); ctx.lineWidth = 1.5; ctx.strokeStyle = COL.cyan;
    const x0 = CX - CAR_W / 2;
    for (const tk of M.ghosts) {
      if (S.tr < tk) break;
      const age = t - (M.t0 + tk * M.N); // Bildschirmzeit seit Passieren
      const yb = M.yOfS(0.5 * M.g * tk * tk);
      ctx.globalAlpha = a0 * (0.13 + 0.4 * Math.exp(-age * 3));
      ctx.beginPath(); carPath(ctx, x0, yb); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0 - 6, yb); ctx.lineTo(x0 + CAR_W + 6, yb); ctx.stroke();
    }
    ctx.restore();
    // Marken + Beschriftung
    const MK = M.mkL; // Chip-Layout der Zwischenmarken (falls vorhanden)
    let lastDot = -1e9;
    for (const m of M.marks) {
      const age = t - (M.t0 + m.t * M.N); // Bildschirmzeit seit Passieren
      if (age < 0) break;
      const pop = easeOutBack(seg(age, 0, 0.25));
      const col = m.final ? COL.amber : COL.cyan;
      // Zeitlabel ausblenden, wo ein Marken-Chip steht
      let hide = 0;
      if (MK && !m.final) for (const c of MK) { if (Math.abs(m.y - c.cy) < c.h / 2 + 16) hide = Math.max(hide, seg(t, c.m.tShow - 0.16, 0.16)); }
      const dotOk = m.final || Math.abs(m.y - lastDot) >= 9;
      if (dotOk) lastDot = m.y;
      // Verbindung Kabinenunterkante -> Zeitspur
      ctx.save(); ctx.globalAlpha = a0 * (m.final ? 0.5 : 0.22); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(CX + CAR_W / 2 + 8, m.y); ctx.lineTo(TX - 6, m.y); ctx.stroke(); ctx.restore();
      if (dotOk) {
        halo(ctx, TX, m.y, 14, col, a0 * (0.35 + 0.5 * Math.exp(-age * 3)) * pop);
        dot(ctx, TX, m.y, 4.2 * pop, col, a0);
      }
      if (m.showLabel && hide < 0.99) {
        txt(ctx, m.label, TX + 16, m.y + 8, { font: F_MONO, weight: 700, size: m.final ? 24 : 20, color: m.final ? COL.amber : COL.muted, alpha: a0 * seg(age, 0.03, 0.2) * (1 - hide) });
      }
    }
  }

  // ---------------- Zwischenmarken (markers) ----------------
  const CHIP_X = TX + 18, CHIP_MAXW = PX - 18 - (TX + 18);
  function chipAlpha(c, t) { return seg(t, c.m.tShow, 0.3); }
  /** Chip-Layout (einmal pro Modell): Größe, Umbruch, vertikale Entzerrung. */
  function markerLayout(ctx, M) {
    if (M.mkL !== undefined) return M.mkL;
    if (!M.markers.length) { M.mkL = null; return null; }
    const out = [];
    for (const m of M.markers) {
      const r1 = "h = " + fmtH(m.s) + " m";
      const w1 = meas(ctx, r1, 700, 15, F_MONO, 1);
      const inner = CHIP_MAXW - 26;
      let sz = 24, lines = [m.label];
      while (sz > 16 && meas(ctx, m.label, 700, sz, F_BODY, 0) > inner) sz -= 1;
      if (meas(ctx, m.label, 700, sz, F_BODY, 0) > inner) {
        sz = 17; lines = []; let cur = "";
        for (const w of m.label.split(/\s+/)) { const tt = cur ? cur + " " + w : w; if (cur && meas(ctx, tt, 700, sz, F_BODY, 0) > inner) { lines.push(cur); cur = w; } else cur = tt; }
        if (cur) lines.push(cur);
        if (lines.length > 3) lines = [lines[0], lines[1], lines.slice(2).join(" ")];
        lines = lines.map((ln) => { if (meas(ctx, ln, 700, sz, F_BODY, 0) <= inner) return ln; let q = ln; while (q.length > 1 && meas(ctx, q + "…", 700, sz, F_BODY, 0) > inner) q = q.slice(0, -1); return q.trimEnd() + "…"; });
      }
      let w2 = 0; for (const ln of lines) w2 = Math.max(w2, meas(ctx, ln, 700, sz, F_BODY, 0));
      const lh = sz * 1.15;
      const h = Math.round(24 + sz * 0.95 + (lines.length - 1) * lh + 10);
      out.push({ m, r1, lines, sz, lh, w: Math.min(CHIP_MAXW, Math.max(w1, w2) + 26), h, y: M.yOfS(m.s), cy: M.yOfS(m.s) });
    }
    // vertikal entzerren (Abstand 8 px), unten Platz für die Aufprall-Zeitmarke lassen
    const bottom = Y0 - 20, gap = 8;
    for (let i = 1; i < out.length; i++) { const p = out[i - 1], c = out[i]; c.cy = Math.max(c.cy, p.cy + p.h / 2 + gap + c.h / 2); }
    for (let i = out.length - 1; i >= 0; i--) { const c = out[i]; const lim = i === out.length - 1 ? bottom : out[i + 1].cy - out[i + 1].h / 2 - gap; if (c.cy + c.h / 2 > lim) c.cy = lim - c.h / 2; }
    M.mkL = out;
    return out;
  }
  /** Strich am Lineal, Ziellinie und Zielring (hinter der Kabine). */
  function drawMarkerGuides(ctx, M, t, S) {
    const MK = M.mkL; if (!MK) return;
    const a = easeOut(seg(S.tb, 0.55, 0.5)); if (a <= 0) return;
    for (const c of MK) {
      const y = c.y, passed = t >= c.m.tPass, k = t - c.m.tPass;
      const flash = passed ? Math.exp(-k * 3) : 0;
      // Ziellinie quer durch den Schacht
      ctx.save(); ctx.globalAlpha = a * (passed ? 0.34 + 0.4 * flash : 0.2); ctx.strokeStyle = COL.amber; ctx.lineWidth = 1.3; ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -t * 10;
      ctx.beginPath(); ctx.moveTo(RX + 8, y + 0.5); ctx.lineTo(TX - 8, y + 0.5); ctx.stroke(); ctx.restore();
      if (flash > 0.02) glowPoly(ctx, [[SH_L + 4, y], [SH_R - 4, y]], COL.amber, 2, flash * a, 1);
      // Strich am Lineal
      glowPoly(ctx, [[RX - 26, y], [RX + 8, y]], COL.amber, 2.6, a, 0.8);
      // Zielring an der Zeitspur
      if (!passed) {
        const pu = 0.5 + 0.5 * Math.sin(t * 3 + y * 0.05);
        ctx.save(); ctx.globalAlpha = a * (0.55 + 0.3 * pu); ctx.strokeStyle = COL.amber; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(TX, y, 6, 0, TAU); ctx.stroke(); ctx.restore();
      }
    }
  }
  /** Eingefrorene Label-Chips (vor allem anderen links). */
  function drawMarkerChips(ctx, M, t, S) {
    const MK = M.mkL; if (!MK) return;
    const a0 = easeOut(seg(S.tb, 0.55, 0.5)); if (a0 <= 0) return;
    for (const c of MK) {
      const passed = t >= c.m.tPass;
      if (passed) {
        const k = t - c.m.tPass;
        halo(ctx, TX, c.y, 26, COL.amber, a0 * (0.3 + 0.55 * Math.exp(-k * 2.5) + 0.12 * Math.sin(t * 2.2 + c.y)));
        dot(ctx, TX, c.y, 5.2, COL.amber, a0);
      }
      const ca = chipAlpha(c, t) * a0; if (ca <= 0) continue;
      const pop = easeOutBack(seg(t, c.m.tShow, 0.35));
      const x = CHIP_X, top = c.cy - c.h / 2;
      // Verbindung Punkt -> Chip
      strokePoly(ctx, Math.abs(c.cy - c.y) < 2 ? [[TX + 7, c.y], [x, c.y]] : [[TX + 7, c.y], [TX + 11, c.y], [x - 2, c.cy]], rgba(COL.amber, 0.8), 1.4, ca);
      const w = Math.max(20, c.w * clamp(0.35 + 0.65 * pop, 0, 1.08));
      fillRR(ctx, x, top, w, c.h, 6, "rgba(10,14,22,0.92)", ca);
      strokeRR(ctx, x, top, w, c.h, 6, rgba(COL.amber, 0.75 + 0.2 * Math.sin(t * 2 + c.y * 0.1)), 1.5, ca);
      fillRR(ctx, x, top + 6, 3, c.h - 12, 1.5, COL.amber, ca);
      const ta = ca * seg(t, c.m.tShow + 0.08, 0.25);
      txt(ctx, c.r1, x + 14, top + 20, { font: F_MONO, weight: 700, size: 15, ls: 1, color: COL.muted, alpha: ta });
      c.lines.forEach((ln, i) => txt(ctx, ln, x + 14, top + 24 + c.sz * 0.9 + i * c.lh, { font: F_BODY, weight: 700, size: c.sz, color: COL.amber, alpha: ta }));
    }
  }

  // ---------------- Schlusstext (end_label) ----------------
  function endLayout(ctx, M, maxW, size0, minSize, maxLines) {
    maxLines = maxLines || 3;
    const key = maxW + "|" + size0 + "|" + maxLines;
    if (M.elL && M.elL.key === key) return M.elL;
    const s = M.endLabel; let sz = size0, lines = [s];
    while (sz > minSize && meas(ctx, s, 600, sz, F_BODY, 0.3, true) > maxW) sz -= 1;
    if (meas(ctx, s, 600, sz, F_BODY, 0.3, true) > maxW) {
      lines = []; let cur = "";
      for (const w of s.split(/\s+/)) { const tt = cur ? cur + " " + w : w; if (cur && meas(ctx, tt, 600, sz, F_BODY, 0.3, true) > maxW) { lines.push(cur); cur = w; } else cur = tt; }
      if (cur) lines.push(cur);
      if (lines.length > maxLines) lines = lines.slice(0, maxLines - 1).concat([lines.slice(maxLines - 1).join(" ")]);
      lines = lines.map((ln) => { if (meas(ctx, ln, 600, sz, F_BODY, 0.3, true) <= maxW) return ln; let q = ln; while (q.length > 1 && meas(ctx, q + "…", 600, sz, F_BODY, 0.3, true) > maxW) q = q.slice(0, -1); return q.trimEnd() + "…"; });
    }
    let w = 0; for (const ln of lines) w = Math.max(w, meas(ctx, ln, 600, sz, F_BODY, 0.3, true));
    M.elL = { key, lines, sz, w };
    return M.elL;
  }
  function drawEndLabelShaft(ctx, M, t, yb) {
    if (!M.endLabel || M.endPos !== "shaft") return;
    const a = easeOut(seg(t, M.tEnd, 0.9)); if (a <= 0) return;
    const E = endLayout(ctx, M, 200, 26, 18, 3);
    const lh = E.sz * 1.2;
    const bw = E.w + 32, bh = E.sz + 22 + (E.lines.length - 1) * lh;
    const carTop = yb - PLANK - CAB_H - XHEAD;
    const by = carTop - 58 - bh + (1 - a) * 10;
    const bx = CX - bw / 2;
    fillRR(ctx, bx, by, bw, bh, bh / 2 > 24 ? 12 : bh / 2, "rgba(6,12,24,0.9)", a);
    strokeRR(ctx, bx, by, bw, bh, bh / 2 > 24 ? 12 : bh / 2, rgba(COL.steel, 0.55), 1.3, a);
    E.lines.forEach((ln, i) => txt(ctx, ln, CX, by + 11 + E.sz * 0.86 + i * lh, { font: F_BODY, italic: true, weight: 600, size: E.sz, ls: 0.3, color: COL.white, align: "center", alpha: a * 0.95 }));
    // feine Führungslinie zur Kabine
    const ly0 = by + bh + 4, ly1 = carTop - 34;
    if (ly1 > ly0 + 4) { ctx.save(); ctx.globalAlpha = 0.5 * a; ctx.strokeStyle = COL.steel; ctx.lineWidth = 1.2; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(CX, ly0); ctx.lineTo(CX, ly1); ctx.stroke(); ctx.restore(); }
  }

  // ---------------- Maßpfeil h (Fallhöhe) + Positionszeiger ----------------
  function drawDim(ctx, M, t, S, yb) {
    const a = easeOut(seg(S.tb, 0.3, 0.5)); if (a <= 0) return;
    const ys = M.yOfS(0);
    // Startlinie (Hilfslinie)
    ctx.save(); ctx.globalAlpha = 0.4 * a; ctx.strokeStyle = COL.cyan; ctx.lineWidth = 1; ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.moveTo(RX + 4, ys); ctx.lineTo(CX - CAR_W / 2 - 16, ys); ctx.stroke();
    ctx.globalAlpha = 0.65 * a; ctx.beginPath(); ctx.moveTo(RX + 4, yb); ctx.lineTo(RAIL_L - 8, yb); ctx.stroke();
    ctx.restore();
    // Zeiger am Lineal
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = COL.cyan;
    ctx.beginPath(); ctx.moveTo(RX + 2, yb); ctx.lineTo(RX + 14, yb - 7); ctx.lineTo(RX + 14, yb + 7); ctx.closePath(); ctx.fill(); ctx.restore();
    halo(ctx, RX + 6, yb, 18, COL.cyan, (0.3 + 0.25 * pulse) * a);
    // Maßpfeil
    const len = yb - ys;
    if (len > 3) {
      glowPoly(ctx, [[BX, ys], [BX, yb]], COL.cyan, 2, a, 0.9);
      strokePoly(ctx, [[BX - 7, ys], [BX + 7, ys]], COL.cyan, 2, a);
      strokePoly(ctx, [[BX - 7, yb], [BX + 7, yb]], COL.cyan, 2, a);
      if (len > 16) {
        ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = COL.cyan;
        ctx.beginPath(); ctx.moveTo(BX, ys + 1); ctx.lineTo(BX - 5, ys + 10); ctx.lineTo(BX + 5, ys + 10); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(BX, yb - 1); ctx.lineTo(BX - 5, yb - 10); ctx.lineTo(BX + 5, yb - 10); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      const lab = "h = " + fmt(S.s, 1) + " m";
      const lw = meas(ctx, lab, 700, 22, F_MONO, 0) + 16;
      const la = a * seg(len, lw * 0.55, lw + 10);
      if (la > 0) {
        ctx.save(); ctx.translate(BX + 22, (ys + yb) / 2); ctx.rotate(-Math.PI / 2);
        fillRR(ctx, -lw / 2, -15, lw, 26, 4, "rgba(4,12,26,0.85)", la);
        txt(ctx, lab, 0, 4, { font: F_MONO, weight: 700, size: 20, color: COL.cyan, align: "center", alpha: la });
        ctx.restore();
      }
    }
  }

  // ---------------- Geschwindigkeits-Streifen & Aufprall ----------------
  function drawSpeedLines(ctx, M, t, S, yb) {
    if (!S.falling || S.vf < 0.05) return;
    const top = yb - PLANK - CAB_H - XHEAD;
    ctx.save(); ctx.lineCap = "round";
    ctx.globalAlpha = 0.5 * S.vf; ctx.strokeStyle = COL.cyan; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const x = CX - CAR_W / 2 - 2 + (i / 5) * (CAR_W + 4);
      const L0 = (26 + 150 * S.vf) * (0.55 + 0.45 * h01(i * 3.3 + Math.floor(t * 12) * 0.1));
      const off = 14 + 10 * h01(i * 7.1);
      ctx.moveTo(x, top - off); ctx.lineTo(x, Math.max(200, top - off - L0));
    }
    ctx.stroke();
    // Bewegungsunschärfe der Kabine (zwei schwache Kopien)
    ctx.lineWidth = 2;
    for (const k of [1, 2]) {
      ctx.globalAlpha = 0.18 * S.vf / k; ctx.beginPath(); carPath(ctx, CX - CAR_W / 2, yb - k * 9 * S.vf); ctx.stroke();
    }
    ctx.restore();
    void M;
  }

  /** Geschwindigkeitsvektor v neben der Kabine (Länge ∝ v). */
  function drawVelocityArrow(ctx, M, t, S, yb, a, L) {
    if (!S.falling || S.vf < 0.02 || a <= 0) return;
    const x = SH_L + 20;
    const y1 = yb - PLANK - CAB_H - XHEAD;
    const len = Math.min(18 + 104 * S.vf, PIT - 8 - y1);
    L.arrow(ctx, x, y1, x, y1 + len, COL.amber, 3, 13, a);
    txt(ctx, "v", x + 9, y1 + 18, { font: F_BODY, italic: true, weight: 800, size: 22, color: COL.amber, alpha: a });
    void M; void t;
  }

  function drawImpact(ctx, M, t, S, L) {
    if (!S.impacted) return;
    const k = S.ti;
    const y = Y0;
    // Blitz
    if (k < 0.5) halo(ctx, CX, y, 160 * (0.4 + k), COL.hot, 0.9 * (1 - k / 0.5));
    // Stoßringe
    for (let i = 0; i < 2; i++) {
      const kk = k - i * 0.12; if (kk < 0 || kk > 0.9) continue;
      const r = 20 + 220 * easeOut(kk / 0.9);
      ctx.save(); ctx.globalAlpha = 0.7 * (1 - kk / 0.9); ctx.strokeStyle = COL.red; ctx.lineWidth = 3 - i;
      ctx.beginPath(); ctx.ellipse(CX, y, r, r * 0.28, 0, 0, TAU); ctx.stroke(); ctx.restore();
    }
    // Funken + Staub
    if (k < 1.2) {
      L.sparks(ctx, CX - CAR_W / 2 - 4, y, k, { seed: 11, count: 18, life: 0.7, window: 0.1, speed: 520, spread: 1.4, dir: -Math.PI * 0.8, gravity: 1100 });
      L.sparks(ctx, CX + CAR_W / 2 + 4, y, k, { seed: 23, count: 18, life: 0.7, window: 0.1, speed: 520, spread: 1.4, dir: -Math.PI * 0.2, gravity: 1100 });
    }
    for (let i = 0; i < 14; i++) {
      const ang = -Math.PI * (0.1 + 0.8 * h01(i * 3.7));
      const sp = 60 + 120 * h01(i * 1.9);
      const kk = Math.min(k, 3);
      const px = CX + Math.cos(ang) * sp * (1 - Math.exp(-kk * 1.6)) * 1.3;
      const py = y + 8 + Math.sin(ang) * sp * 0.5 * (1 - Math.exp(-kk * 1.6)) + kk * 6;
      const aa = 0.28 * Math.exp(-kk * 0.6) * seg(k, 0, 0.1);
      if (px > SH_L + 6 && px < SH_R - 6) dot(ctx, px, py, 6 + 10 * h01(i * 5.3) * (0.5 + kk * 0.3), COL.steel, aa * 0.5);
    }
    // ruhiger Warnpuls am Aufprallpunkt (Halten)
    const pp = ((k - 0.6) % 1.6) / 1.6;
    if (k > 0.6) {
      ctx.save(); ctx.globalAlpha = 0.35 * (1 - pp); ctx.strokeStyle = COL.red; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(CX, y, 50 + 70 * pp, (50 + 70 * pp) * 0.26, 0, 0, TAU); ctx.stroke(); ctx.restore();
    }
  }

  // ---------------- Beschriftungen links ----------------
  function drawLeftLabels(ctx, M, t, S) {
    const a = easeOut(seg(S.tb, 0.5, 0.6)); if (a <= 0) return;
    // Puffer / Schachtgrube
    const lx = SH_R + 18;
    strokePoly(ctx, [[CX + 26, PIT - 16], [SH_R + 10, PIT - 5]], rgba(COL.amber, 0.6), 1.2, a);
    txt(ctx, "Puffer", lx, PIT + 2, { size: 21, weight: 600, color: COL.amber, alpha: a });
    txt(ctx, "SCHACHTGRUBE", CX, PIT + 38, { font: F_MONO, weight: 700, size: 16, ls: 3, color: COL.muted, align: "center", alpha: 0.8 * a });
    // Seilriss-Hinweis
    const k = t - M.t0;
    let sa = seg(k, 0.02, 0.25) * (1 - 0.35 * seg(k, Math.max(1.2, 0.5 * M.Ts), 0.6)); // bleibt lesbar
    if (sa > 0) {
      const ys = M.yOfS(0) - PLANK - CAB_H - XHEAD - 5 - SNAP_D;
      const x = SH_R + 12, y = ys + 26;
      const w = meas(ctx, "TRAGSEIL GERISSEN", 700, 18, F_HEAD, 2) + 24;
      sa *= overlayClear(ctx, x, y, w, 28);
      if (sa <= 0.003) return;
      strokePoly(ctx, [[CX + 8, ys + 2], [CX + 40, y + 14], [x, y + 14]], rgba(COL.red, 0.8), 1.5, sa);
      fillRR(ctx, x, y, w, 28, 4, "rgba(40,6,10,0.85)", sa);
      strokeRR(ctx, x, y, w, 28, 4, COL.red, 1.5, sa);
      txt(ctx, "TRAGSEIL GERISSEN", x + 12, y + 20, { font: F_HEAD, weight: 700, size: 18, ls: 2, color: COL.red, alpha: sa });
    }
    void S;
  }

  // ---------------- Panel rechts ----------------
  function drawFormula(ctx, x, base, size, t, M, a) {
    // v = √(2 · g · h)  – echtes Wurzelzeichen mit Überstrich
    if (a <= 0) return x;
    const wr = easeOut(seg(t, 0.35, 0.5));
    let cx = x;
    const fa = a;
    cx += txt(ctx, "v", cx, base, { font: F_BODY, italic: true, weight: 600, size, color: COL.amber, alpha: fa });
    cx += size * 0.2;
    cx += txt(ctx, "=", cx, base, { font: F_BODY, weight: 400, size, color: COL.white, alpha: fa });
    cx += size * 0.2;
    const rx = cx;
    const radW = size * 0.62;
    const argX = rx + radW;
    // Radikand (mit Einblendung)
    const parts = [
      { s: "2", it: false, col: COL.white },
      { s: " · ", it: false, col: COL.muted },
      { s: "g", it: true, col: COL.white },
      { s: " · ", it: false, col: COL.muted },
      { s: "h", it: true, col: COL.cyan },
    ];
    let ax = argX;
    parts.forEach((pp, i) => {
      const pa = fa * seg(wr, 0.15 + i * 0.1, 0.3);
      const w = txt(ctx, pp.s, ax, base, { font: F_BODY, italic: pp.it, weight: pp.it ? 600 : 400, size, color: pp.col, alpha: pa });
      ax += w + (pp.it ? size * 0.04 : 0);
    });
    const endX = ax + size * 0.08;
    const vy = base - size * 0.86;
    const pts = [
      [rx, base - size * 0.3], [rx + size * 0.12, base - size * 0.37], [rx + size * 0.3, base + size * 0.1],
      [rx + size * 0.52, vy], [endX, vy], [endX, vy + size * 0.08],
    ];
    glowPoly(ctx, partialPts(pts, wr), COL.cyan, size * 0.045, fa, 1);
    return endX;
  }

  function headerLayout(ctx, M) {
    if (M.hd) return M.hd;
    const bw = meas(ctx, M.badge, 700, 20, F_MONO, 3) + 56;
    const avail = IX1 - bw - 26 - IX0;
    const title = M.title.toUpperCase();
    const subW = meas(ctx, "ENERGIEERHALTUNG", 700, 16, F_MONO, 3);
    let size = 30, ls = 5, tw = meas(ctx, title, 700, size, F_HEAD, ls);
    const sub = tw + 22 + subW <= avail;
    let out = title;
    if (!sub) {
      for (const [sz, l] of [[30, 5], [30, 4], [30, 3], [28, 3], [26, 3], [25, 2.5], [24, 2], [22, 2]]) { size = sz; ls = l; tw = meas(ctx, title, 700, sz, F_HEAD, l); if (tw <= avail) break; }
      if (tw > avail) { let q = title; while (q.length > 1 && meas(ctx, q + "…", 700, size, F_HEAD, ls) > avail) q = q.slice(0, -1); out = q.trimEnd() + "…"; tw = meas(ctx, out, 700, size, F_HEAD, ls); }
    }
    M.hd = { title: out, size, ls, tw, sub, bw };
    return M.hd;
  }

  function drawPanel(ctx, M, t, S, L, d) {
    const ap = easeOut(seg(S.tb, 0.1, 0.6)); if (ap <= 0) return;
    const slide = (1 - ap) * 40;
    ctx.save(); ctx.translate(slide, 0);
    L.panel(ctx, PX, PY, PW, PH, { fill: "rgba(6,16,34,0.8)", stroke: "rgba(63,210,255,0.3)", r: 14, alpha: ap });
    // Eckmarken (Blueprint)
    const cm = [[PX, PY, 1, 1], [PX + PW, PY, -1, 1], [PX, PY + PH, 1, -1], [PX + PW, PY + PH, -1, -1]];
    for (const [x, y, sx, sy] of cm) strokePoly(ctx, [[x + sx * 26, y + sy * 8], [x + sx * 8, y + sy * 8], [x + sx * 8, y + sy * 26]], COL.cyan, 2, 0.7 * ap);

    // Kopfzeile (gegen Badge gemessen)
    const hy = PY + 56;
    const HD = headerLayout(ctx, M);
    txt(ctx, HD.title, IX0, hy, { font: F_HEAD, weight: 700, size: HD.size, ls: HD.ls, color: COL.white, alpha: ap });
    if (HD.sub) txt(ctx, "ENERGIEERHALTUNG", IX0 + HD.tw + 22, hy - 2, { font: F_MONO, weight: 700, size: 16, ls: 3, color: COL.muted, alpha: 0.8 * ap });
    // Zeitlupen-Badge
    const bw = HD.bw;
    const bx = IX1 - bw, by = hy - 28;
    const bcol = M.mode === "slow" ? COL.amber : M.mode === "fast" ? COL.cyan : COL.steel;
    const running = S.falling ? 1 : 0.35;
    fillRR(ctx, bx, by, bw, 38, 19, "rgba(4,12,26,0.9)", ap);
    strokeRR(ctx, bx, by, bw, 38, 19, rgba(bcol, 0.8), 1.5, ap);
    const blink = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (S.falling ? 7 : 3)));
    dot(ctx, bx + 22, by + 19, 6, S.impacted ? COL.red : bcol, ap * (running > 0.5 ? blink : 0.5 + 0.3 * blink));
    halo(ctx, bx + 22, by + 19, 16, S.impacted ? COL.red : bcol, 0.4 * ap * blink);
    txt(ctx, M.badge, bx + 38, by + 26, { font: F_MONO, weight: 700, size: 20, ls: 3, color: bcol, alpha: ap });
    strokePoly(ctx, [[IX0, hy + 26], [IX1, hy + 26]], rgba(COL.cyan, 0.22), 1.2, ap);

    // Formel
    const fBase = PY + 180;
    const fEnd = drawFormula(ctx, IX0, fBase, 92, S.tb, M, ap);
    // Gegeben: g
    const gx = Math.max(fEnd + 70, IX0 + 600);
    const ga = ap * seg(S.tb, 0.55, 0.4);
    strokePoly(ctx, [[gx - 26, fBase - 96], [gx - 26, fBase + (M.air ? 36 : 4)]], rgba(COL.cyan, 0.3), 1.5, ga);
    txt(ctx, "ERDBESCHLEUNIGUNG", gx, fBase - 74, { font: F_MONO, weight: 700, size: 16, ls: 3, color: COL.muted, alpha: ga });
    const gw = txt(ctx, "g", gx, fBase - 24, { font: F_BODY, italic: true, weight: 600, size: 42, color: COL.white, alpha: ga });
    txt(ctx, " = " + fmt(M.g, 2) + " m/s²", gx + gw, fBase - 24, { font: F_BODY, weight: 600, size: 42, color: COL.white, alpha: ga });
    if (M.air) {
      const na = ap * seg(S.tb, 0.8, 0.4);
      const nt = M.airText;
      const nMax = IX1 - gx - 42;
      const nfs = Math.max(14, Math.min(20, (20 * nMax) / Math.max(1, meas(ctx, nt, 600, 20, F_BODY, 0))));
      const nw = meas(ctx, nt, 600, nfs, F_BODY, 0) + 42;
      const ny = fBase + 4;
      fillRR(ctx, gx, ny, nw, 32, 16, rgba(COL.amber, 0.1), na);
      strokeRR(ctx, gx, ny, nw, 32, 16, rgba(COL.amber, 0.7), 1.3, na);
      // Info-Symbol
      strokeRR(ctx, gx + 10, ny + 7, 18, 18, 9, COL.amber, 1.5, na);
      txt(ctx, "i", gx + 19, ny + 22, { font: F_BODY, weight: 800, size: 14, color: COL.amber, align: "center", alpha: na });
      txt(ctx, nt, gx + 34, ny + 16 + nfs * 0.36, { font: F_BODY, weight: 600, size: nfs, color: COL.amber, alpha: na });
    }
    // Herleitung -> nach Aufprall: eingesetzte Werte
    const dy = PY + 250;
    // erst blendet die Herleitung aus, dann erscheint die Rechnung mit eingesetzten Werten (kein Textsalat)
    const fo0 = Math.max(M.t1, M.tRes - 0.28);
    const derOut = S.impacted ? seg(t, fo0, Math.max(0.05, M.tRes - fo0)) : 0;
    const subA = S.impacted ? seg(t, M.tRes, 0.4) : 0;
    const derA = ap * seg(S.tb, 0.8, 0.5) * (1 - derOut);
    if (derA > 0) {
      let x = IX0;
      x += txt(ctx, "aus  ", x, dy, { size: 24, weight: 400, color: COL.muted, alpha: derA });
      x += txt(ctx, "m · g · h", x, dy, { size: 24, weight: 600, italic: true, color: COL.steel, alpha: derA });
      x += txt(ctx, "  =  ½ · ", x, dy, { size: 24, weight: 400, color: COL.steel, alpha: derA });
      x += txt(ctx, "m · v²", x, dy, { size: 24, weight: 600, italic: true, color: COL.steel, alpha: derA });
      txt(ctx, "   (Lageenergie wird zu Bewegungsenergie)", x, dy, { size: 21, weight: 400, color: COL.muted, alpha: derA * 0.85 });
    }
    if (subA > 0) {
      let x = IX0;
      const o = { size: 28, weight: 600, color: COL.white, alpha: ap * subA, font: F_BODY };
      x += txt(ctx, "v", x, dy, { ...o, italic: true, color: COL.amber });
      x += txt(ctx, " = ", x, dy, o);
      // kleines Wurzelzeichen
      const rs = 28, rx = x + 2;
      const inner = "2 · " + fmt(M.g, 2) + " m/s² · " + fmtH(M.h) + " m";
      const iw = meas(ctx, inner, 600, rs, F_BODY, 0);
      const ix = rx + rs * 0.62;
      txt(ctx, inner, ix, dy, o);
      const vy = dy - rs * 0.9, ex = ix + iw + 4;
      strokePoly(ctx, [[rx, dy - rs * 0.3], [rx + rs * 0.12, dy - rs * 0.37], [rx + rs * 0.3, dy + rs * 0.1], [rx + rs * 0.52, vy], [ex, vy]], COL.cyan, 2, ap * subA);
      x = ex + 10;
      x += txt(ctx, "= ", x, dy, o);
      txt(ctx, fmt(M.vEnd, 1) + " m/s", x, dy, { ...o, weight: 800, color: COL.amber });
    }
    strokePoly(ctx, [[IX0, PY + 282], [IX1, PY + 282]], rgba(COL.cyan, 0.18), 1.2, ap);

    // Live-Anzeigen h, t
    const ry = PY + 318;
    const ra = ap * seg(S.tb, 0.3, 0.5);
    const cell = (x, label, sym, symCol, val, unit, w, maxStr) => {
      const fs = Math.min(60, (60 * w) / Math.max(1, meas(ctx, maxStr, 700, 60, F_MONO, 0)));
      txt(ctx, label, x, ry, { font: F_MONO, weight: 700, size: 17, ls: 3, color: COL.muted, alpha: ra });
      const lw = meas(ctx, label, 700, 17, F_MONO, 3);
      txt(ctx, sym, x + lw + 6, ry + 1, { font: F_BODY, italic: true, weight: 600, size: 22, color: symCol, alpha: ra });
      const vx = x + w;
      txt(ctx, val, vx, ry + 70, { font: F_MONO, weight: 700, size: fs, color: COL.white, align: "right", alpha: ra });
      txt(ctx, unit, vx + 12, ry + 70, { font: F_BODY, weight: 600, size: 28, color: COL.muted, alpha: ra });
    };
    cell(IX0, "FALLHÖHE", "h", COL.cyan, fmt(S.s, 1), "m", 230, fmt(M.h, 1));
    cell(IX0 + 330, "ZEIT", "t", COL.white, fmt(S.tr, 2), "s", 200, fmt(M.Tf, 2));

    // Mini-Diagramm v(h)
    drawMiniChart(ctx, M, t, S, IX1 - 330, PY + 300, 330, 112, ra);

    strokePoly(ctx, [[IX0, PY + 424], [IX1, PY + 424]], rgba(COL.cyan, 0.18), 1.2, ap);

    // Große Geschwindigkeitsanzeige
    const vy0 = PY + 462;
    const hit = S.impacted ? 1 : 0;
    const flash = S.impacted ? Math.exp(-S.ti * 3.5) : 0;
    const hold = S.impacted ? easeOut(seg(S.ti, 0, 0.5)) : 0;
    const va = ap * seg(S.tb, 0.35, 0.5);
    // Hervorhebung nach Aufprall
    if (hit) {
      fillRR(ctx, IX0 - 24, vy0 - 34, IX1 - IX0 + 48, PY + PH - 18 - (vy0 - 34), 10, rgba(COL.red, 0.07 + 0.1 * flash), va * hold);
      strokeRR(ctx, IX0 - 24, vy0 - 34, IX1 - IX0 + 48, PY + PH - 18 - (vy0 - 34), 10, rgba(COL.red, 0.55 + 0.4 * flash), 1.5, va * hold);
    }
    const label = hit ? "AUFPRALLGESCHWINDIGKEIT" : "GESCHWINDIGKEIT";
    txt(ctx, label, IX0, vy0, { font: F_MONO, weight: 700, size: 17, ls: 3, color: hit ? COL.red : COL.muted, alpha: va });
    const lw = meas(ctx, label, 700, 17, F_MONO, 3);
    txt(ctx, "v", IX0 + lw + 6, vy0 + 1, { font: F_BODY, italic: true, weight: 600, size: 22, color: COL.amber, alpha: va });
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
    const bigS = 140 * (1 + 0.05 * hold * easeOutBack(seg(S.ti, 0, 0.45)));
    const nb = PY + PH - 58; // Grundlinie große Zahl
    const numRight = IX0 + 470;
    const vCol = COL.amber;
    txt(ctx, fmt(S.v, 1), numRight, nb, { font: F_MONO, weight: 700, size: bigS, color: flash > 0.3 ? COL.hot : vCol, align: "right", alpha: va, glow: 18 + 16 * hold * pulse + 30 * flash, glowColor: hit ? COL.red : COL.amber });
    txt(ctx, "m/s", numRight + 16, nb, { font: F_BODY, weight: 600, size: 44, color: COL.amber, alpha: va });
    // km/h
    const kx = IX1 - 150;
    const mEnd = numRight + 16 + meas(ctx, "m/s", 600, 44, F_BODY, 0);
    const kS = Math.min(92, (92 * (kx - mEnd - 50)) / Math.max(1, meas(ctx, fmt(M.kmh, 0), 700, 92, F_MONO, 0)));
    // Marken-Blitz: km/h leuchtet kurz, wenn die Kabine eine Zwischenmarke passiert
    let mf = 0; for (const m of M.markers) if (t >= m.tPass && !(hit && m.s >= M.h - 1e-6)) mf = Math.max(mf, Math.exp(-(t - m.tPass) * 3));
    const rr = hit && M.result ? easeOut(seg(t, M.tRes, 0.45)) : 0;
    if (rr < 1) txt(ctx, fmt(S.v * 3.6, 0), kx, nb - 14 * rr, { font: F_MONO, weight: 700, size: kS, color: mf > 0.05 ? COL.hot : COL.white, align: "right", alpha: va * (1 - rr), glow: hit ? 10 + 8 * pulse : 26 * mf, glowColor: hit ? COL.red : COL.amber });
    const unitOut = rr > 0 && M.result && (!M.result.num || (M.result.unit && M.result.unit !== "km/h")); // freier Text / andere Einheit ersetzt „km/h“
    txt(ctx, "km/h", kx + 14, nb, { font: F_BODY, weight: 600, size: 40, color: COL.muted, alpha: va * (unitOut ? 1 - rr : 1) });
    if (rr > 0) drawResult(ctx, M, kx, nb + 12 * (1 - rr), mEnd, va * rr, pulse);
    txt(ctx, "ENTSPRICHT", kx - 200, vy0, { font: F_MONO, weight: 700, size: 15, ls: 3, color: COL.muted, alpha: va * 0.8 });
    // Balken v / v_end (weicht im Panel-Modus dem Schlusstext)
    const ea = M.endLabel && M.endPos === "panel" ? easeOut(seg(t, M.tEnd, 0.9)) : 0;
    const barY = nb + 24, bx0 = IX0, bx1 = IX1;
    if (ea > 0) drawEndLabelPanel(ctx, M, nb, ea * ap);
    if (ea < 1) {
    const va0 = va; { const va = va0 * (1 - ea);
    fillRR(ctx, bx0, barY, bx1 - bx0, 6, 3, rgba(COL.cyan, 0.12), va);
    const fw = (bx1 - bx0) * clamp(S.vf);
    if (fw > 1) {
      const g = ctx.createLinearGradient(bx0, 0, bx1, 0);
      g.addColorStop(0, rgba(COL.cyan, 0.8)); g.addColorStop(0.7, rgba(COL.amber, 0.95)); g.addColorStop(1, rgba(COL.red, 1));
      fillRR(ctx, bx0, barY, fw, 6, 3, g, va);
      halo(ctx, bx0 + fw, barY + 3, 18, hit ? COL.red : COL.amber, 0.7 * va * (hit ? 0.6 + 0.4 * pulse : 1));
    }
    } }
    ctx.restore();
    void d;
  }

  /** Gerundeter / freier Ergebniswert im km/h-Feld (rechtsbündig an kx, Einheit bleibt an kx + 14). */
  function drawResult(ctx, M, kx, nb, mEnd, a, pulse) {
    const R = M.result; if (!R || a <= 0) return;
    if (!M.resL) {
      const avail = kx - (mEnd + 36);
      if (R.num) {
        const pw = R.pre ? meas(ctx, R.pre, 600, 46, F_BODY, 0) : 0;
        const nw = meas(ctx, R.num, 700, 92, F_MONO, 0);
        const tot = nw + (R.pre ? pw + 14 : 0);
        const k = Math.min(1, avail / Math.max(1, tot));
        const unit = R.unit && R.unit !== "km/h" ? R.unit : "";
        M.resL = { size: 92 * k, pre: 46 * Math.max(0.75, k), gap: 14 * k, unit };
      } else {
        const full = kx + 14 + meas(ctx, "km/h", 600, 40, F_BODY, 0) - (mEnd + 36);
        let sz = 56; while (sz > 22 && meas(ctx, R.text, 700, sz, F_BODY, 0) > full) sz -= 2;
        M.resL = { size: sz, full };
      }
    }
    const RL = M.resL;
    if (R.num) {
      txt(ctx, R.num, kx, nb, { font: F_MONO, weight: 700, size: RL.size, color: COL.white, align: "right", alpha: a, glow: 12 + 10 * pulse, glowColor: COL.amber });
      if (R.pre) {
        const nw = meas(ctx, R.num, 700, RL.size, F_MONO, 0);
        txt(ctx, R.pre, kx - nw - RL.gap, nb - RL.size * 0.08, { font: F_BODY, weight: 600, size: RL.pre, color: COL.amber, align: "right", alpha: a });
      }
      if (RL.unit) txt(ctx, RL.unit, kx + 14, nb, { font: F_BODY, weight: 600, size: 40, color: COL.muted, alpha: a });
    } else {
      const right = kx + 14 + meas(ctx, "km/h", 600, 40, F_BODY, 0);
      txt(ctx, R.text, right, nb, { font: F_BODY, weight: 700, size: RL.size, color: COL.white, align: "right", alpha: a, glow: 10 + 8 * pulse, glowColor: COL.amber });
    }
  }

  function drawEndLabelPanel(ctx, M, nb, a) {
    const E = endLayout(ctx, M, 400, 23, 16, 1);
    const y = nb + 31 + (1 - a) * 6;
    const lw = 34, xr = IX1;
    const w = E.w;
    strokePoly(ctx, [[xr - w - 14 - lw, y - E.sz * 0.33], [xr - w - 14, y - E.sz * 0.33]], rgba(COL.steel, 0.7), 1.5, a);
    txt(ctx, E.lines[0], xr, y, { font: F_BODY, italic: true, weight: 600, size: E.sz, ls: 0.3, color: COL.white, align: "right", alpha: a * 0.95 });
  }

  function drawMiniChart(ctx, M, t, S, x, y, w, h, a) {
    if (a <= 0) return;
    const x0 = x + 34, y0 = y + h - 22, x1 = x + w - 16, y1 = y + 10;
    // Achsen
    ctx.save(); ctx.globalAlpha = 0.6 * a; ctx.strokeStyle = COL.muted; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0, y1 - 4); ctx.lineTo(x0, y0); ctx.lineTo(x1 + 6, y0); ctx.stroke();
    ctx.fillStyle = COL.muted; ctx.beginPath(); ctx.moveTo(x0, y1 - 10); ctx.lineTo(x0 - 4, y1 - 2); ctx.lineTo(x0 + 4, y1 - 2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x1 + 12, y0); ctx.lineTo(x1 + 4, y0 - 4); ctx.lineTo(x1 + 4, y0 + 4); ctx.closePath(); ctx.fill();
    ctx.restore();
    txt(ctx, "v", x0 - 16, y1 + 8, { font: F_BODY, italic: true, weight: 600, size: 22, color: COL.amber, align: "center", alpha: a });
    txt(ctx, "h", x1 + 6, y0 + 24, { font: F_BODY, italic: true, weight: 600, size: 22, color: COL.cyan, align: "center", alpha: a });
    txt(ctx, "v ~ √h", x0 + 14, y1 + 10, { font: F_BODY, weight: 400, size: 17, color: COL.muted, alpha: 0 });
    // Kurve (gesamt, gestrichelt) + gefahrene Strecke
    const pts = [];
    const n = 40;
    for (let i = 0; i <= n; i++) { const f = i / n; pts.push([lerp(x0, x1, f), lerp(y0, y1, Math.sqrt(f))]); }
    ctx.save(); ctx.globalAlpha = 0.25 * a; ctx.strokeStyle = COL.amber; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]);
    ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke(); ctx.restore();
    const f = clamp(S.s / M.h);
    const cur = [];
    const m = Math.max(1, Math.ceil(f * n));
    for (let i = 0; i <= m; i++) { const ff = Math.min(f, i / n); cur.push([lerp(x0, x1, ff), lerp(y0, y1, Math.sqrt(ff))]); }
    glowPoly(ctx, cur, COL.amber, 2.5, a, 0.9);
    for (const mk of M.markers) {
      const fm = clamp(mk.s / M.h), mx = lerp(x0, x1, fm), my = lerp(y0, y1, Math.sqrt(fm));
      if (S.s >= mk.s - 1e-9) { dot(ctx, mx, my, 4, COL.amber, a); strokePoly(ctx, [[mx, my + 6], [mx, y0]], rgba(COL.amber, 0.35), 1, a); }
      else { ctx.save(); ctx.globalAlpha = 0.6 * a; ctx.strokeStyle = COL.amber; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(mx, my, 4, 0, TAU); ctx.stroke(); ctx.restore(); }
    }
    const px = lerp(x0, x1, f), py = lerp(y0, y1, Math.sqrt(f));
    halo(ctx, px, py, 16, COL.amber, 0.6 * a * (0.7 + 0.3 * Math.sin(t * 5)));
    dot(ctx, px, py, 4.5, COL.white, a);
    // Projektionslinien
    ctx.save(); ctx.globalAlpha = 0.3 * a; ctx.strokeStyle = COL.amber; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, y0); ctx.moveTo(px, py); ctx.lineTo(x0, py); ctx.stroke(); ctx.restore();
  }

  // ---------------- Hintergrund (gecacht) ----------------
  // Identisch zu L.background der Engine (Verlauf + statisches Raster), aber nur einmal gerendert und danach
  // per drawImage kopiert: der bildschirmfüllende Radialverlauf kostet sonst ~10 ms pro Frame (Software-Raster).
  let BG_CACHE = null;
  function drawBackground(ctx, p, L) {
    const W = p.W || 1920, H = p.H || 1080;
    if (BG_CACHE === null || (BG_CACHE && (BG_CACHE.width !== W || BG_CACHE.height !== H))) {
      BG_CACHE = false;
      try {
        const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
        const c = cv.getContext("2d");
        if (c) { L.background(c, W, H, 0); BG_CACHE = cv; }
      } catch (e) { BG_CACHE = false; }
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    if (BG_CACHE) ctx.drawImage(BG_CACHE, 0, 0); else L.background(ctx, W, H, p.T || 0);
    ctx.restore();
  }

  // ---------------- Szene ----------------
  function drawScene(ctx, p) {
    const L = p.L || (window.CE && window.CE.lib);
    if (!L) return;
    const d = Math.max(0.5, +p.d || 8);
    const t = Math.max(0, +p.t || 0);
    const M = getModel(p.params, d);
    const S = state(M, t);

    // Kabinenposition (Unterkante)
    let yb = M.yOfS(S.s);
    if (S.impacted) {
      const k = S.ti;
      const c = 0.42 * easeOut(seg(k, 0, 0.12)) - 0.1 * Math.sin(seg(k, 0.12, 0.5) * Math.PI) * (1 - seg(k, 0.12, 0.5));
      yb = Y0 + BUF_H * 0.62 * c + Math.sin(k * 40) * 3 * Math.exp(-k * 7);
    } else if (t < M.t0) {
      yb += Math.sin(t * 2.2) * 0.8; // leichtes Pendeln am Seil
    }

    markerLayout(ctx, M);
    OVR = overlayRect(ctx, p.text);
    drawDust(ctx, t, S);
    drawShaft(ctx, M, t, S);
    drawRuler(ctx, M, t, S, L);
    drawMarkerGuides(ctx, M, t, S);
    drawStrobe(ctx, M, t, S);
    drawBuffer(ctx, t, S, M);
    drawSpeedLines(ctx, M, t, S, yb);
    drawRopes(ctx, M, t, S, yb, L);
    const carA = easeOut(seg(S.tb, 0.15, 0.5));
    const carCol = S.impacted ? COL.red : COL.cyan;
    drawCar(ctx, yb, { alpha: carA, color: carCol, person: true, L, gearColor: S.impacted ? COL.red : COL.amber, glow: S.falling ? 1 + S.vf * 0.6 : 1 });
    drawDim(ctx, M, t, S, yb);
    drawVelocityArrow(ctx, M, t, S, yb, carA, L);
    drawImpact(ctx, M, t, S, L);
    drawLeftLabels(ctx, M, t, S);
    drawMarkerChips(ctx, M, t, S);
    drawEndLabelShaft(ctx, M, t, yb);
    drawPanel(ctx, M, t, S, L, d);
    drawOverlay(ctx, L, p.text, t, d);
  }

  CE.register("physics_fall", {
    ownsText: true,
    background: false, // eigener, gecachter Hintergrund (siehe drawBackground)
    draw(ctx, p) {
      try { const L = p.L || (window.CE && window.CE.lib); if (L) drawBackground(ctx, p, L); } catch (e) { /* nie werfen */ }
      try { drawScene(ctx, p); }
      catch (err) { try { console.error("[physics_fall]", err && err.message); } catch (e) { /* nie werfen */ } }
    },
  });
})();
