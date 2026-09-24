/* Template "historic_scene" – historische Szenen im Kupferstich-/Gravurstil: sepia-/amberfarbene Tuschlinien,
   feine Schraffuren, dezente Cyan-Akzente, eingefasst in eine "Druckplatte". Personen nur als Silhouetten ohne Gesicht.

   SZENEN (params.scene; Aliase: kurze Stichwörter wie "otis", "empire", "hoist" werden erkannt)
     otis_1854_demo (Default)  Kristallpalast New York: Plattform zwischen Holzschienen mit Sperrzahnleisten, Gehilfe kappt
                    das Tragseil mit der Axt, Plattform sackt wenige cm ab, Wagenfeder spreizt, Klinken rasten ein. Detail-Lupe.
                    variant "newspaper_overlay": stehende Vorführung abgedunkelt + stilisierte Zeitungsspalte mit Randnotiz.
     otis_principle Nahansicht Plattformkopf: solange das Seil zieht, hält die Blattfeder die Sperrklinken eingezogen;
                    reißt es, streckt sich die Feder, die Klinken greifen beidseits in die Zahnstangen.
                    (auch automatisch bei action "pawls_engage" / "rope_break", egal welche scene)
     haughwout_1857 gusseiserne Palazzo-Fassade, ein Feld aufgeschnitten: Schacht, Fahrkorb fährt, Tempo-Chip.
     empire_state_1945_schematic  respektvolle Schemazeichnung (kein Feuer, keine Opferdarstellung):
                    variant "fall" (Default): Schacht, Markierung, gestrichelter Absturzpfeil bis in die Schachtgrube, Maßkette.
                    variant "impact" (auto bei aircraft/impact_floor/engine_paths): Flugzeugsilhouette im Nebel, Einschlag-
                      Markierung am Stockwerk, amber Triebwerksbahn(en), Zahlenkarte (Label "14 Tote").
                    variant "rescue" (auto bei silhouettes "helpers_carry…"): Mini-Hochhaus + Detailfenster 80. Stock,
                      Helfer tragen die Liftführerin in eine andere Kabine, Scherengitter schließt, Pfeil nach unten.
     early_hoist    Handwinde: Seiltrommel, Zahnradvorgelege, Handkurbel, Sperrrad mit Klinke, Ausleger mit Last.

   TIMING (alle Zeiten in s ab Szenenstart, geklemmt auf [0,3 ; d-0,3]; ohne Angaben skalieren Defaults mit d)
     params.beats:
       otis_1854_demo  BEATS: [0] = Beschriftungen/Lupe, [1] = Axthieb = Seil gekappt (Plattform fängt 0,3 s später),
                              [2] = Maß "platform_drop" in der Lupe, [3] = Otis zieht den Hut / Publikum jubelt
         newspaper     BEATS: [0] = Zeitung schiebt sich ein (+ Abdunkeln), [1] = Randnotiz wird amber unterstrichen
       otis_principle  BEATS: [0] = Seilzug-Pfeile + Status, [1] = Seil reißt, [2] = Klinken greifen (Plattform hängt),
                              [3] = Zahnstangen beidseits leuchten
       haughwout_1857  BEATS: [0] = Fassade wird aufgeschnitten, [1] = Fahrkorb fährt los (+ Tempo-Chip), [2] = Fahrkorb hält
       empire fall     BEATS: [0] = Schacht leuchtet auf, [1] = Etagen-Markierung, [2] = Absturz beginnt, [3] = Maßkette/Fallhöhe
       empire impact   BEATS: [0] = Flugzeug erscheint, [1] = Einschlag, [2] = Triebwerksbahn(en)
       empire rescue   BEATS: [0] = Markierung am Hochhaus, [1] = Detailfenster öffnet, [2] = Helfer heben sie an,
                              [3] = sie sitzt in der anderen Kabine, [4] = Pfeil "nach unten"
       early_hoist     BEATS: [0] = Beschriftungen/Lupe, [1] = Heben beginnt, [2] = Last oben, Klinke sperrt
     "at" wird akzeptiert von: jedem Eintrag in labels ({text, at, target}), year_at (Jahreszahl/Titel), quote_at.

   PARAMS (alle optional)
     labels        true (Default-Beschriftungen) | false | ["Text", {text, at, target}]  – Text wird per Stichwort einem
                   Anker zugeordnet (z. B. "Elisha Otis"→Figur, "Kristallpalast…"→Bildunterschrift, "79. Stock"→Markierung,
                   "14 Tote"→Zahlenkarte, "Zahnstangen…"→beide Zahnstangen); target erzwingt den Anker.
     year_label / date_label  große Jahreszahl/Datum oben rechts (baut sich Ziffer für Ziffer auf); title, subtitle;
                   header false blendet die Kopfzeile aus. quote (Text|true), quote_by.
     otis: action "rope_cut"|"none", platform_drop ("wenige cm"), audience (true), inset (true), dim_background,
           newspaper_label ("1854"), highlight_note ("schneidet gelegentlich das Seil durch").
     principle: status (true).   haughwout: speed_label ("v ≈ 0,2 m/s" | false).
     empire: highlight ["elevator_shaft"] (Schacht amber), fog (true|0..1), floor/from_floor (75), impact_floor (79),
             aircraft ("B-25"), engine_paths ["through_building","into_shaft"], measure (true), distance_label, distance_sub,
             panel_title (rescue). */
(function () {
  "use strict";
  const CE = window.CE;
  if (!CE || typeof CE.register !== "function") return;

  const TAU = Math.PI * 2, D2R = Math.PI / 180;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const inv = (a, b, x) => clamp((x - a) / (b - a || 1e-6));
  const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const easeIn = (t) => Math.pow(clamp(t), 3);
  const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const easeOutBack = (t) => { t = clamp(t); const c1 = 1.6, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const h01 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const dnum = (v, dec = 1) => Number(v).toFixed(dec).replace(".", ",");

  const COL = {
    ink: "#ffb347", sepia: "#d99a52", pale: "#ffdcaa", deep: "#a86a2c", wood: "#e0a15a",
    cyan: "#3fd2ff", red: "#ff5a5f", white: "#eef6ff", muted: "#8fb3d9", steel: "#9fc4e6",
  };
  const RGB = {};
  const rgba = (hex, a) => { let c = RGB[hex]; if (!c) { const n = parseInt(hex.slice(1), 16); c = RGB[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; } return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };

  // ---------- Zeichen-Helfer (GA = Gruppen-Alpha, WM = Linienbreiten-Faktor für die Lupe) ----------
  let GA = 1, WM = 1;
  function stk(ctx, build, color, w, alpha = 1, glow = 0, dash = null, dashOff = 0) {
    const a = GA * alpha; if (a <= 0.004) return;
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = color;
    if (dash) { ctx.setLineDash(dash); ctx.lineDashOffset = dashOff; }
    ctx.beginPath(); build(ctx);
    if (glow > 0) { ctx.globalAlpha = a * Math.min(1, 0.22 * glow); ctx.lineWidth = w * WM * 3.4; ctx.stroke(); }
    ctx.globalAlpha = a; ctx.lineWidth = w * WM; ctx.stroke(); ctx.restore();
  }
  function fil(ctx, build, color, alpha = 1) { const a = GA * alpha; if (a <= 0.004) return; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = color; ctx.beginPath(); build(ctx); ctx.fill(); ctx.restore(); }
  /** Schraffur: parallele Linien im Winkel angDeg (Abstand gap), beschnitten auf die Form clip. */
  function hatch(ctx, clip, bx, by, bw, bh, angDeg, gap, color, w, alpha) {
    const a = GA * alpha; if (a <= 0.004 || gap < 0.8) return;
    ctx.save(); ctx.beginPath(); clip(ctx); ctx.clip();
    const an = angDeg * D2R, ca = Math.cos(an), sa = Math.sin(an);
    const cx = bx + bw / 2, cy = by + bh / 2, R = Math.hypot(bw, bh) / 2 + 2;
    ctx.beginPath();
    for (let s = -R; s <= R; s += gap) { const px = cx - sa * s, py = cy + ca * s; ctx.moveTo(px - ca * R, py - sa * R); ctx.lineTo(px + ca * R, py + sa * R); }
    ctx.globalAlpha = a; ctx.strokeStyle = color; ctx.lineWidth = w * WM; ctx.stroke(); ctx.restore();
  }
  const rr = (c, x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  const rectB = (x, y, w, h) => (c) => c.rect(x, y, w, h);
  const polyB = (pts, close) => (c) => { pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); if (close) c.closePath(); };
  function dot(ctx, x, y, r, color, alpha) {
    const a = GA * alpha; if (a <= 0.004 || r <= 0.5) return;
    ctx.save(); ctx.globalAlpha = a; const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, 0.95)); g.addColorStop(0.3, rgba(color, 0.38)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
  }
  function arrowHead(ctx, x, y, ang, size, color, alpha) {
    fil(ctx, (c) => { c.moveTo(x, y); c.lineTo(x - Math.cos(ang - 0.42) * size, y - Math.sin(ang - 0.42) * size); c.lineTo(x - Math.cos(ang + 0.42) * size, y - Math.sin(ang + 0.42) * size); c.closePath(); }, color, alpha);
  }
  /** Sägezahn-Kontur einer Zahnleiste: Leistenfläche bei x, Zähne ragen side*depth heraus.
      Waagerechte Zahnoberkante (Rastfläche) bei yTop0 + k*pitch, darunter die Schräge zurück zur Leiste. */
  function teethB(x, y1, y2, pitch, depth, side, yTop0) {
    return (c) => {
      let y = yTop0; while (y - pitch > y1) y -= pitch; while (y < y1) y += pitch;
      c.moveTo(x, y1); const sp = (y - y1) / pitch; if (sp > 0) c.lineTo(x + side * depth * (1 - sp), y1);
      c.lineTo(x, y);
      for (; y < y2; y += pitch) { c.lineTo(x + side * depth, y); const yn = Math.min(y + pitch, y2); c.lineTo(x + side * depth * (1 - (yn - y) / pitch), yn); }
    };
  }
  /** Schrägen-Position (x) einer Zahnleiste auf Höhe y (für die Klinke, die auf der Schräge reitet). */
  function slopeX(x, y, pitch, depth, side, yTop0) { const f = ((((y - yTop0) % pitch) + pitch) % pitch) / pitch; return x + side * depth * (1 - f); }

  // ---------- Sprite-Cache: statische Gravur einmal rastern ----------
  const SPR = new Map();
  function layer(ctx, key, x0, y0, w, h, alpha, drawFn) {
    const a = GA * alpha; if (a <= 0.004) return;
    let cv = SPR.get(key);
    if (cv === undefined) {
      cv = null;
      try {
        const c = document.createElement("canvas"); c.width = Math.ceil(w); c.height = Math.ceil(h);
        const g = c.getContext("2d");
        if (g) { const sG = GA, sW = WM; GA = 1; WM = 1; try { g.translate(-x0, -y0); drawFn(g); cv = c; } finally { GA = sG; WM = sW; } }
      } catch (e) { cv = null; }
      if (SPR.size > 24) { const bg = [...SPR].filter(([k]) => k.startsWith("bg|")); SPR.clear(); bg.forEach(([k, v]) => SPR.set(k, v)); }
      SPR.set(key, cv);
    }
    if (cv) { ctx.save(); ctx.globalAlpha = a; ctx.drawImage(cv, x0, y0); ctx.restore(); }
    else { const sG = GA; GA = a; drawFn(ctx); GA = sG; }
  }

  // ---------- Text ----------
  const MEAS = new Map();
  function meas(L, ctx, s, o) { const k = s + "|" + (o.size || 40) + "|" + (o.weight || 600) + "|" + (o.font || "") + "|" + (o.letterSpacing || 0); let w = MEAS.get(k); if (w == null) { w = L.measure(ctx, s, o); if (MEAS.size > 300) MEAS.clear(); MEAS.set(k, w); } return w; }
  function txt(L, ctx, s, x, y, o) { const a = GA * (o.alpha == null ? 1 : o.alpha); if (a <= 0.004 || !s) return; L.text(ctx, s, x, y, Object.assign({}, o, { alpha: a })); }

  const WRAP = new Map();
  function wrapC(L, ctx, s, maxW, size) { const k = s + "|" + size + "|" + maxW; let v = WRAP.get(k); if (!v) { v = L.wrap(ctx, s, maxW, { size, weight: 600 }); if (WRAP.size > 200) WRAP.clear(); WRAP.set(k, v); } return v; }

  /** Beschriftung mit Führungslinie(n). Ziel (tx,ty), optional o.t2 = [x,y] zweites Ziel. Box-Anker (bx,by):
      align "left" = linke Kante, "right" = rechte Kante, "center" = Mitte; by = vertikale Mitte. Lange Texte → max. 3 Zeilen. */
  function tag(ctx, L, tx, ty, bx, by, text, prog, o = {}) {
    const p = clamp(prog); if (p <= 0 || !text) return;
    const color = o.color || COL.ink, al = o.alpha == null ? 1 : o.alpha, align = o.align || "left";
    const avail = align === "right" ? bx - 110 : align === "center" ? 2 * Math.min(bx - 110, 1810 - bx) : 1810 - bx, maxW = Math.max(150, Math.min(o.maxW || 470, avail - 28));
    let size = o.size || 24, lines = [text], tw = meas(L, ctx, text, { size, weight: 600 });
    if (tw > maxW) {
      size = Math.max(19, Math.round(size * 0.88)); lines = wrapC(L, ctx, text, maxW, size).slice(0, 3);
      tw = 0; for (const s of lines) tw = Math.max(tw, meas(L, ctx, s, { size, weight: 600 }));
    }
    const lh = Math.round(size * 1.2), bw = tw + 28, bh = size + 16 + (lines.length - 1) * lh;
    const left = align === "right" ? bx - bw : align === "center" ? bx - bw / 2 : bx;
    const lp = easeOut(inv(0, 0.55, p)), bp = inv(0.35, 1, p);
    const leaders = o.t2 ? [[tx, ty], o.t2] : [[tx, ty]];
    for (const [qx, qy] of leaders) {
      const toLeft = align === "left" || (align === "center" && qx < bx);
      const edge = toLeft ? left : left + bw, ex = toLeft ? edge - 20 : edge + 20;
      if (!o.noDot) { fil(ctx, (c) => c.arc(qx, qy, 3.6, 0, TAU), color, al * p); stk(ctx, (c) => c.arc(qx, qy, 9, 0, TAU), color, 1.2, al * 0.55 * p); }
      stk(ctx, (c) => {
        c.moveTo(qx, qy); const k1 = clamp(lp / 0.8); c.lineTo(lerp(qx, ex, k1), lerp(qy, by, k1));
        if (lp > 0.8) c.lineTo(lerp(ex, edge, (lp - 0.8) / 0.2), by);
      }, color, 1.4, al * 0.85 * p, 0.5);
    }
    if (bp <= 0) return;
    const bwA = bw * easeOut(bp), bl = align === "right" ? left + bw - bwA : align === "center" ? bx - bwA / 2 : left;
    fil(ctx, (c) => rr(c, bl, by - bh / 2, bwA, bh, 4), "rgb(7,10,20)", al * 0.86 * bp);
    stk(ctx, (c) => rr(c, bl, by - bh / 2, bwA, bh, 4), color, 1.3, al * 0.75 * bp);
    const y0 = by - ((lines.length - 1) * lh) / 2 + size * 0.36;
    lines.forEach((s, i) => txt(L, ctx, s, left + 14, y0 + i * lh, { size, weight: 600, color: o.textColor || COL.white, alpha: al * inv(0.6, 1, p) }));
  }

  /** Nüchterne Zahlenkarte (z. B. "14 Tote"): führende Zahl groß, Rest klein. Rechtsbündig bei xr, vertikale Mitte yc. */
  function statCard(ctx, L, xr, yc, text, prog, o = {}) {
    const p = clamp(prog); if (p <= 0 || !text) return;
    const m = /^\s*([≈~<>]?\s*\d[\d.,]*\s*%?)\s*(.*)$/.exec(text);
    const num = m ? m[1].trim() : "", rest = m ? m[2] : text;
    const ns = o.numSize || 64, rs = o.size || 30;
    const nw = num ? meas(L, ctx, num, { size: ns, weight: 700, font: L.FONT.mono }) : 0;
    const rw = rest ? meas(L, ctx, rest, { size: rs, weight: 600 }) : 0;
    const w = nw + (num && rest ? 18 : 0) + rw + 60, h = (num ? ns : rs) + 40, x0 = xr - w, a = easeOut(p);
    fil(ctx, (c) => c.rect(x0, yc - h / 2, w, h), "rgb(8,8,12)", 0.88 * a);
    stk(ctx, (c) => { c.moveTo(xr - w * a, yc - h / 2); c.lineTo(xr, yc - h / 2); c.moveTo(x0, yc + h / 2); c.lineTo(x0 + w * a, yc + h / 2); }, COL.pale, 1.3, 0.7);
    fil(ctx, (c) => c.rect(x0, yc - h / 2, 5, h * a), COL.ink, 0.9);
    const base = yc + (num ? ns : rs) * 0.36;
    if (num) txt(L, ctx, num, x0 + 30, base, { size: ns, weight: 700, font: L.FONT.mono, color: COL.white, alpha: inv(0.15, 0.7, p), glow: 8, glowColor: "rgba(238,246,255,0.35)" });
    if (rest) txt(L, ctx, rest, x0 + 30 + nw + (num ? 18 : 0), base, { size: rs, weight: 600, color: COL.pale, alpha: inv(0.35, 1, p) });
  }

  // ---------- Timing: params.beats (Sekunden) + per-Item "at"; alles auf [0,3 ; d-0,3] geklemmt ----------
  function timing(p) {
    const d = Math.max(0.2, Number(p.d) || 8), P = p.params || {};
    const B = Array.isArray(P.beats) ? P.beats : [];
    const lo = Math.min(0.3, d * 0.5), hi = Math.max(d - 0.3, lo);
    const num = (v) => (v === null || v === undefined || v === "" || typeof v === "boolean" ? NaN : Number(v));
    const cl = (x) => clamp(x, lo, hi);
    return { d, cl, has: (i) => isFinite(num(B[i])), beat: (i, def) => { const v = num(B[i]); return cl(isFinite(v) ? v : def); }, at: (v, def) => { const n = num(v); return cl(isFinite(n) ? n : def); } };
  }

  // ---------- Beschriftungen: labels = true | false | ["Text", {text, at, target}] ----------
  function labelItems(P) {
    if (bool(pick(P, ["show_labels", "showLabels"])) === false) return [];
    const raw = pick(P, ["labels", "label", "callouts", "annotations", "beschriftungen"]);
    if (raw === undefined) return null;
    if (typeof raw === "boolean" || typeof raw === "number") return raw ? null : [];
    if (typeof raw === "string") { const b = bool(raw); if (b !== undefined) return b ? null : []; }
    const out = [];
    for (const it of Array.isArray(raw) ? raw : [raw]) {
      if (it == null) continue;
      if (typeof it === "object") { const text = str(it.text ?? it.label ?? it.name ?? it.title, 110); if (text) out.push({ text, at: it.at ?? it.t ?? it.time, target: it.target ?? it.anchor ?? it.for }); }
      else { const text = str(it, 110); if (text) out.push({ text }); }
      if (out.length >= 7) break;
    }
    return out;
  }
  /** Ordnet Beschriftungen Ankern zu: explizites target > Stichwort-Regex > nächster freier Anker aus fallback. */
  function resolveLabels(items, A, fallback, defs, t0, st) {
    const dflt = (key, i) => (A[key] && A[key].def != null ? A[key].def : t0 + i * st);
    if (items === null) return defs.map((q, i) => ({ text: q.text, key: q.key, def: q.def != null ? q.def : dflt(q.key, i) }));
    const used = new Set(), out = [];
    items.forEach((it) => {
      const low = it.text.toLowerCase(), tg = it.target != null ? String(it.target).toLowerCase() : "";
      let key = tg && A[tg] ? tg : null;
      if (!key) for (const k in A) if (!used.has(k) && A[k].re && A[k].re.test(low)) { key = k; break; }
      if (!key) key = fallback.find((k) => !used.has(k) && A[k]) || null;
      if (!key) return;
      used.add(key); out.push({ text: it.text, at: it.at, key, def: dflt(key, out.length) });
    });
    return out;
  }
  /** Zeichnet aufgelöste Beschriftungen. A[key].g(text) → {tx,ty,bx,by,align,color,size,t2} | {kind:"stat",x,y} | {kind:"caption"}. */
  function drawLabels(ctx, L, t, T, list, A, hdr) {
    for (const it of list) {
      const s = it.at != null ? T.at(it.at, it.def) : T.cl(it.def), pr = inv(s, s + 0.6, t);
      if (pr <= 0) continue;
      const g = A[it.key] && A[it.key].g(it.text); if (!g) continue;
      if (g.kind === "stat") statCard(ctx, L, g.x, g.y, it.text, pr, g);
      else if (g.kind === "caption") { captionLine(ctx, L, it.text, HX, hdr.y, pr); hdr.y += 34; }
      else tag(ctx, L, g.tx, g.ty, g.bx, g.by, it.text, pr, g);
    }
  }

  // ---------- Druckplatte (Rahmen) ----------
  const PL = { x: 102, y: 100, w: 1716, h: 798 }; // untere Kante 898 (< 910, Untertitel-Zone frei)
  const plateClip = (c) => c.rect(PL.x, PL.y, PL.w, PL.h);
  function drawPlateFrame(g) {
    fil(g, plateClip, "#1b1207", 0.34);
    stk(g, (c) => c.rect(PL.x - 7, PL.y - 7, PL.w + 14, PL.h + 14), COL.ink, 1, 0.3);
    stk(g, (c) => c.rect(PL.x, PL.y, PL.w, PL.h), COL.ink, 1.8, 0.5);
    const cs = [[PL.x, PL.y], [PL.x + PL.w, PL.y], [PL.x, PL.y + PL.h], [PL.x + PL.w, PL.y + PL.h]];
    for (const [x, y] of cs) { fil(g, (c) => { c.moveTo(x, y - 7); c.lineTo(x + 7, y); c.lineTo(x, y + 7); c.lineTo(x - 7, y); c.closePath(); }, COL.ink, 0.7); }
    // feine Randskala (Stichplatten-Kante)
    stk(g, (c) => { for (let x = PL.x + 40; x < PL.x + PL.w - 20; x += 40) { c.moveTo(x, PL.y + PL.h); c.lineTo(x, PL.y + PL.h - (x % 200 === 142 ? 9 : 5)); } }, COL.ink, 1, 0.28);
  }
  /** Titelplakette (Kartusche) – rechtsbündig bei x. */
  function titlePlate(ctx, L, x, y, title, sub, prog, o = {}) {
    const p = clamp(prog); if (p <= 0) return;
    const ts = o.size || 34, ss = o.subSize || 21;
    const tw = meas(L, ctx, title, { size: ts, weight: 700, font: L.FONT.head, letterSpacing: 4 });
    const sw = sub ? meas(L, ctx, sub, { size: ss, weight: 400 }) : 0;
    const w = Math.max(tw, sw) + 56, x0 = x - w, lp = easeOut(inv(0, 0.6, p));
    const a = inv(0.2, 0.8, p);
    fil(ctx, (c) => c.rect(x0, y - ts - 20, w, ts + (sub ? ss + 40 : 30)), "rgb(10,8,6)", 0.72 * a);
    stk(ctx, (c) => { c.moveTo(x - w * lp, y - ts - 20); c.lineTo(x, y - ts - 20); c.moveTo(x0 + w * (1 - lp), y + (sub ? ss + 20 : 10)); c.lineTo(x0 + w, y + (sub ? ss + 20 : 10)); }, COL.ink, 1.5, 0.8);
    stk(ctx, (c) => { c.moveTo(x - w * lp, y - ts - 25); c.lineTo(x, y - ts - 25); }, COL.ink, 0.8, 0.45);
    fil(ctx, (c) => { const cx = x0 + w / 2, cy = y - ts - 20; c.moveTo(cx, cy - 6); c.lineTo(cx + 6, cy); c.lineTo(cx, cy + 6); c.lineTo(cx - 6, cy); c.closePath(); }, COL.ink, a);
    txt(L, ctx, title, x - 28, y, { size: ts, weight: 700, font: L.FONT.head, letterSpacing: 4, color: COL.ink, align: "right", alpha: a, glow: 10, glowColor: "rgba(255,179,71,0.5)" });
    if (sub) txt(L, ctx, sub, x - 28, y + ss + 8, { size: ss, weight: 400, color: COL.pale, align: "right", alpha: inv(0.4, 1, p) * 0.92 });
  }

  // ---------- Kopfzeile rechts oben: große Jahreszahl ODER Titelplakette, darunter Orts-/Bildunterschrift ----------
  const HX = 1750;
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9äöüß]+/g, " ").trim();
  function captionLine(ctx, L, text, xr, y, prog) {
    const p = clamp(prog); if (p <= 0 || !text) return;
    const w = meas(L, ctx, text, { size: 23, weight: "italic 500" }), a = easeOut(p);
    stk(ctx, (c) => { c.moveTo(xr - w - 34, y - 8); c.lineTo(xr - w - 34 + 22 * a, y - 8); }, COL.ink, 1.2, 0.8 * a);
    txt(L, ctx, text, xr, y + (1 - a) * 6, { size: 23, weight: "italic 500", color: COL.pale, align: "right", alpha: inv(0.1, 0.8, p) });
  }
  /** Jahreszahl/Datum baut sich Ziffer für Ziffer auf (Kupferstich-Gold), rechtsbündig bei xr, Grundlinie y. */
  function yearReveal(ctx, L, s, xr, y, size, t, t0) {
    const o = { size, weight: 700, font: L.FONT.head, letterSpacing: 6 };
    const W = meas(L, ctx, s, o), x0 = xr - W, n = s.length, step = Math.min(0.12, 0.7 / Math.max(1, n));
    for (let i = 0; i < n; i++) {
      const ci = easeOut(inv(t0 + i * step, t0 + i * step + 0.45, t)); if (ci <= 0) continue;
      const xi = x0 + (i ? meas(L, ctx, s.slice(0, i), o) : 0);
      txt(L, ctx, s[i], xi, y + (1 - ci) * 22, Object.assign({}, o, { color: COL.ink, alpha: ci, glow: 16, glowColor: "rgba(255,179,71,0.55)" }));
    }
    const lp = easeOut(inv(t0 + 0.2, t0 + 1.0, t)); if (lp <= 0) return;
    stk(ctx, (c) => { c.moveTo(xr - W * lp, y + 18); c.lineTo(xr, y + 18); c.moveTo(xr - W * 0.6 * lp, y + 24); c.lineTo(xr, y + 24); }, COL.ink, 1.3, 0.75);
    fil(ctx, (c) => { const cx = xr - W * lp, cy = y + 18; c.moveTo(cx, cy - 5); c.lineTo(cx + 5, cy); c.lineTo(cx, cy + 5); c.lineTo(cx - 5, cy); c.closePath(); }, COL.ink, lp);
  }
  /** Gibt {y} zurück: Grundlinie für die nächste Zeile unter der Kopfzeile (für Bildunterschriften). */
  function drawHeader(ctx, L, t, T, cfg, def, ov) {
    const hdr = { y: 262 };
    if (!cfg.header) return hdr;
    const t0 = T.at(cfg.titleAt, 0.15);
    if (cfg.year) {
      const size = cfg.year.length <= 5 ? 104 : cfg.year.length <= 8 ? 76 : 62, base = 196 + size * 0.78;
      yearReveal(ctx, L, cfg.year, HX, base, size, t, t0);
      let y = base + 62;
      if (cfg.title) { txt(L, ctx, cfg.title.toUpperCase(), HX, y, { size: 24, weight: 700, font: L.FONT.head, letterSpacing: 4, color: COL.pale, align: "right", alpha: inv(t0 + 0.4, t0 + 0.9, t) }); y += 34; }
      if (cfg.subtitle) { captionLine(ctx, L, cfg.subtitle, HX, y, inv(t0 + 0.5, t0 + 1.1, t)); y += 34; }
      hdr.y = y; return hdr;
    }
    const dup = (s) => s && ov.includes(norm(s));
    const title = cfg.title || (dup(def.title) ? "" : def.title), sub = cfg.subtitle || (dup(def.sub) ? "" : def.sub);
    if (!title && !sub) return hdr;
    if (!title) { captionLine(ctx, L, sub, HX, 244, inv(t0, t0 + 0.8, t)); hdr.y = 284; return hdr; }
    titlePlate(ctx, L, HX, 262, title || sub, title ? sub : "", inv(t0, t0 + 0.8, t), { size: def.size, subSize: def.subSize });
    hdr.y = 262 + (title && sub ? 86 : 58); return hdr;
  }

  // ---------- Figuren (Silhouetten ohne Gesicht) ----------
  /** Person: Körper via L.person; optional Zylinder/Haube, Rock, Arme (Handpositionen absolut). */
  function figure(ctx, L, x, y, h, color, alpha, o = {}) {
    const a = GA * alpha; if (a <= 0.004) return;
    const s = h / 180;
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = color;
    if (o.dress) {
      ctx.beginPath(); ctx.arc(x, y - 165 * s, 14 * s, 0, TAU); ctx.fill();
      ctx.beginPath(); rr(ctx, x - 18 * s, y - 145 * s, 36 * s, 62 * s, 10 * s); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 16 * s, y - 92 * s); ctx.lineTo(x + 16 * s, y - 92 * s); ctx.quadraticCurveTo(x + 44 * s, y - 20 * s, x + 46 * s, y); ctx.lineTo(x - 46 * s, y); ctx.quadraticCurveTo(x - 44 * s, y - 20 * s, x - 16 * s, y - 92 * s); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y - 170 * s, 19 * s, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(x + 20 * s, y - 160 * s); ctx.lineTo(x - 20 * s, y - 160 * s); ctx.closePath(); ctx.fill();
    } else {
      L.person(ctx, x, y, h, color, a);
    }
    if (o.hat === "top") { ctx.fillRect(x - 11 * s, y - 204 * s, 22 * s, 26 * s); ctx.fillRect(x - 18 * s, y - 181 * s, 36 * s, 4.5 * s); }
    else if (o.hat === "cap") { ctx.beginPath(); ctx.arc(x, y - 170 * s, 16 * s, Math.PI, TAU); ctx.fill(); ctx.fillRect(x - 4 * s, y - 173 * s, 26 * s, 4 * s); }
    if (o.arms) {
      ctx.strokeStyle = color; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 10.5 * s;
      const sh = [[x - 17 * s, y - 136 * s], [x + 17 * s, y - 136 * s]];
      o.arms.forEach((hand, i) => {
        if (!hand) return; const S = sh[i === 0 ? 0 : 1];
        ctx.beginPath(); ctx.moveTo(S[0], S[1]);
        if (hand.length > 2) ctx.lineTo(hand[2], hand[3]); // Ellbogen
        ctx.lineTo(hand[0], hand[1]); ctx.stroke();
      });
    }
    ctx.restore();
  }

  /** Schwebeteilchen (Staub im Hallenlicht). */
  function motes(ctx, t, n, x0, y0, w, h, color, seed, alpha = 1) {
    ctx.save(); ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const x = x0 + ((h01(i * 3.7 + seed) * w + t * (5 + 9 * h01(i * 1.9 + seed))) % w);
      const y = y0 + h01(i * 9.1 + seed) * h + Math.sin(t * 0.55 + i * 1.7) * 12 - t * 2.5 * h01(i + seed * 3);
      const yy = y0 + ((((y - y0) % h) + h) % h);
      const r = 0.9 + 1.7 * h01(i * 1.3 + seed);
      ctx.globalAlpha = GA * alpha * (0.18 + 0.22 * (0.5 + 0.5 * Math.sin(t * 1.1 + i * 2.3)));
      ctx.beginPath(); ctx.arc(x, yy, r, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  /** Lichtbahnen durch Glasflächen (weiche Verläufe, pulsierend). */
  function lightBeam(ctx, pts, x1, y1, x2, y2, color, alpha) {
    const a = GA * alpha; if (a <= 0.004) return;
    ctx.save(); ctx.globalAlpha = a; const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, rgba(color, 0.16)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); polyB(pts, true)(ctx); ctx.fill(); ctx.restore();
  }
  /** Seilrolle mit Speichen (angle = Drehwinkel). */
  function pulley(ctx, x, y, r, angle, color, alpha = 1) {
    fil(ctx, (c) => c.arc(x, y, r, 0, TAU), "rgb(12,9,6)", 0.85 * alpha);
    stk(ctx, (c) => c.arc(x, y, r, 0, TAU), color, 2.2, alpha, 0.6);
    stk(ctx, (c) => c.arc(x, y, r * 0.78, 0, TAU), color, 1, 0.6 * alpha);
    stk(ctx, (c) => { for (let i = 0; i < 6; i++) { const q = angle + i * TAU / 6; c.moveTo(x + Math.cos(q) * r * 0.2, y + Math.sin(q) * r * 0.2); c.lineTo(x + Math.cos(q) * r * 0.76, y + Math.sin(q) * r * 0.76); } }, color, 1.3, 0.8 * alpha);
    fil(ctx, (c) => c.arc(x, y, r * 0.16, 0, TAU), color, alpha);
  }
  /** Seil als Doppellinie mit Schlag-Struktur (laufend über offset). */
  function rope(ctx, build, color, w, alpha, offset = 0) {
    stk(ctx, build, color, w, alpha, 0.6);
    stk(ctx, build, "rgba(20,12,4,0.9)", w * 0.45, alpha * 0.8, 0, [3, 5], -offset);
  }

  // =====================================================================================
  // Szene 1: Otis-Vorführung, Crystal Palace New York 1854
  // =====================================================================================
  const OT = {
    floor: 884, cx: 1100,
    lw0: 928, lw1: 954, lFace: 962,     // linker Holzpfosten 928–954, Eisen-Sperrleiste bis 962 (Zahnfläche)
    rFace: 1238, rw0: 1246, rw1: 1272,  // rechter: Zahnfläche 1238, Leiste bis 1246, Holz bis 1272
    top: 212, beamY: 190, beamH: 22,
    pitch: 20, depth: 11, tooth0: 250,  // Zahnoberkanten (Rastflächen) bei 250 + k*20
    ycF: 371, drop: 16,                 // Querhaupt-Oberkante nach dem Fangen; Fallweg (≈ wenige cm)
    stL: 980, stR: 1220, floorOff: 212,
    A: [1120, 240], B: [1318, 240], C: [1358, 836], pr: 20,
    drum: [1682, 836], drR: 20,
    cut: [1545, 856], tipOut: 984, tipIn: 965,
  };
  const INS = { x: 505, y: 585, r: 162, z: 3.3, fx: 973, fy: 364 };

  /** BEATS Otis: [0] Beschriftungen/Lupe, [1] Axthieb = Seil gekappt, [2] Maß "ein paar Zoll" in der Lupe, [3] Otis zieht den Hut / Jubel. */
  function otTimes(T, cfg) {
    const d = T.d, cut = cfg.action !== "none";
    const tc = cut ? T.beat(1, Math.max(0.9, Math.min(0.3 * d, 0.8 + 0.2 * d))) : 1e9;
    const fall = 0.32, tl = tc + fall;
    return {
      tc, fall, tl, cut, lab0: T.beat(0, Math.min(0.1 * d, 1.1) + 0.3), st: clamp(0.07 * d, 0.2, 0.42),
      dropAt: cut ? Math.max(tl + 0.05, T.beat(2, tl + 0.45)) : 1e9, cheerAt: cut ? Math.max(tl + 0.1, T.beat(3, tl + 0.3)) : 1e9,
    };
  }

  function otState(t, T) {
    const dt = t - T.tc, da = t - T.tl;
    let yc;
    if (dt <= 0) yc = OT.ycF - OT.drop + Math.sin(t * 1.9) * 0.5;
    else if (da <= 0) { const k = dt / T.fall; yc = OT.ycF - OT.drop + OT.drop * k * k; }
    else yc = OT.ycF - 3.4 * Math.abs(Math.sin(da * 20)) * Math.exp(-da * 9);
    let tipT = OT.tipOut;
    if (dt > 0.02) tipT = Math.max(OT.tipIn - 1.2, lerp(OT.tipOut, OT.tipIn, easeOutBack(clamp((dt - 0.02) / 0.15))));
    const sl = slopeX(OT.lFace, yc - 1.5, OT.pitch, OT.depth, 1, OT.tooth0);
    const tip = Math.max(tipT, sl);
    const hw = OT.cx - (tip + 32);
    const ext = clamp((OT.tipOut - tip) / (OT.tipOut - OT.tipIn));
    return { yc, tip, hw, bow: lerp(34, 12, ext), ext, dt, da, caught: da > 0, cut: dt > 0 };
  }

  // ---------- statische Halle (Eisen & Glas) ----------
  function otHall(g) {
    drawPlateFrame(g);
    g.save(); g.beginPath(); plateClip(g); g.clip();
    const A = 0.34, ink = COL.ink;
    // Dachbinder (Gitterträger)
    stk(g, (c) => { c.moveTo(PL.x, 118); c.lineTo(PL.x + PL.w, 118); c.moveTo(PL.x, 146); c.lineTo(PL.x + PL.w, 146); for (let x = PL.x; x < PL.x + PL.w; x += 36) { c.moveTo(x, 146); c.lineTo(x + 18, 118); c.lineTo(x + 36, 146); } }, ink, 1, A * 0.8);
    // große Lünette (Glas & Eisen) hinter dem Aufzug
    const LX = OT.cx, LY = 612, LR = 468;
    const ring = (r0, r1) => (c) => { c.arc(LX, LY, r1, Math.PI, TAU); c.lineTo(LX + r0, LY); c.arc(LX, LY, r0, TAU, Math.PI, true); c.closePath(); };
    fil(g, ring(90, LR - 26), "#2a1c0c", 0.35);
    for (let i = 0; i < 24; i++) {
      const a0 = Math.PI + i * Math.PI / 24, a1 = a0 + Math.PI / 24;
      for (let j = 0; j < 4; j++) {
        const r0 = [90, 170, 270, 360][j], r1 = [170, 270, 360, LR - 26][j];
        if (h01(i * 7 + j * 13) < 0.55) {
          const sect = (c) => { c.arc(LX, LY, r1, a0, a1); c.arc(LX, LY, r0, a1, a0, true); c.closePath(); };
          hatch(g, sect, LX - LR, LY - LR, LR * 2, LR, 20 + 15 * j, 3.2 + 1.4 * h01(i + j), ink, 0.7, A * 0.55);
        }
      }
    }
    stk(g, (c) => { for (let i = 0; i <= 24; i++) { const a = Math.PI + i * Math.PI / 24; c.moveTo(LX + Math.cos(a) * 90, LY + Math.sin(a) * 90); c.lineTo(LX + Math.cos(a) * (LR - 26), LY + Math.sin(a) * (LR - 26)); } }, ink, 1.2, A);
    stk(g, (c) => { for (const r of [90, 170, 270, 360, LR - 26, LR]) { c.moveTo(LX + r, LY); c.arc(LX, LY, r, TAU, Math.PI, true); } }, ink, 1.4, A * 1.1);
    stk(g, (c) => { for (let i = 0; i <= 60; i++) { const a = Math.PI + i * Math.PI / 60; c.moveTo(LX + Math.cos(a) * (LR - 26), LY + Math.sin(a) * (LR - 26)); c.lineTo(LX + Math.cos(a) * LR, LY + Math.sin(a) * LR); } }, ink, 1, A * 0.8);
    // Seitenfenster (Rundbogen, Sprossen) + gusseiserne Pfeiler
    const wins = [205, 375, 545, 1720];
    for (const wx of wins) {
      const w2 = 58, top = 300;
      const shape = (c) => { c.moveTo(wx - w2, 600); c.lineTo(wx - w2, top); c.arc(wx, top, w2, Math.PI, TAU); c.lineTo(wx + w2, 600); c.closePath(); };
      fil(g, shape, "#2a1c0c", 0.4);
      hatch(g, shape, wx - w2, top - w2, w2 * 2, 600 - top + w2, 62, 4.2, ink, 0.7, A * 0.5);
      stk(g, shape, ink, 1.5, A * 1.2);
      stk(g, (c) => { c.moveTo(wx, top - w2); c.lineTo(wx, 600); for (let y = top + 50; y < 600; y += 50) { c.moveTo(wx - w2, y); c.lineTo(wx + w2, y); } for (let k = -2; k <= 2; k++) { const a = -Math.PI / 2 + k * 0.5; c.moveTo(wx, top); c.lineTo(wx + Math.cos(a) * w2, top + Math.sin(a) * w2); } }, ink, 0.9, A);
    }
    const piers = [120, 290, 460, 632, 1568, 1636, 1804];
    for (const px of piers) {
      stk(g, (c) => { c.moveTo(px - 5, 168); c.lineTo(px - 5, 840); c.moveTo(px + 5, 168); c.lineTo(px + 5, 840); c.rect(px - 11, 250, 22, 8); c.rect(px - 11, 604, 22, 8); }, ink, 1.1, A * 0.9);
      hatch(g, rectB(px, 168, 5, 672), px, 168, 5, 672, 90, 2, ink, 0.6, A * 0.6);
    }
    // Wandflächen zwischen den Öffnungen: Kreuzschraffur
    const wall = (c) => { c.rect(PL.x, 150, PL.w, 460); c.moveTo(LX + LR, LY); c.arc(LX, LY, LR, TAU, Math.PI, true); c.closePath(); for (const wx of wins) { c.moveTo(wx + 58, 600); c.lineTo(wx + 58, 300); c.arc(wx, 300, 58, TAU, Math.PI, true); c.lineTo(wx - 58, 600); c.closePath(); } };
    g.save(); g.beginPath(); wall(g); g.clip("evenodd");
    hatch(g, rectB(PL.x, 150, PL.w, 460), PL.x, 150, PL.w, 460, 45, 9, ink, 0.6, A * 0.32);
    hatch(g, rectB(PL.x, 150, PL.w, 460), PL.x, 150, PL.w, 460, -45, 13, ink, 0.6, A * 0.22);
    g.restore();
    // Galerie mit Brüstung und kleinen Zuschauern
    for (let i = 0; i < 46; i++) {
      const x = 130 + i * 37 + h01(i * 3.3) * 14; if (x > 1810) break;
      if (x > 900 && x < 1300) continue;
      figure(g, CE.lib, x, 646, 34 + 6 * h01(i), rgba(COL.sepia, 0.8), A * 1.3, { hat: h01(i * 5.1) < 0.4 ? "top" : null, dress: h01(i * 2.7) > 0.72 });
    }
    stk(g, (c) => { c.moveTo(PL.x, 612); c.lineTo(PL.x + PL.w, 612); c.moveTo(PL.x, 618); c.lineTo(PL.x + PL.w, 618); c.moveTo(PL.x, 648); c.lineTo(PL.x + PL.w, 648); for (let x = PL.x + 4; x < PL.x + PL.w; x += 9) { c.moveTo(x, 620); c.lineTo(x, 646); } }, ink, 0.9, A * 1.1);
    fil(g, rectB(PL.x, 648, PL.w, 12), "#2a1c0c", 0.6); stk(g, (c) => { for (let x = PL.x; x < PL.x + PL.w; x += 12) { c.moveTo(x, 648); c.lineTo(x + 6, 660); } }, ink, 0.7, A * 0.8);
    // untere Arkade
    stk(g, (c) => { for (let x = 120; x < 1800; x += 170) { c.moveTo(x, 840); c.lineTo(x, 740); c.arc(x + 85, 740, 85, Math.PI, TAU); c.lineTo(x + 170, 840); } }, ink, 1.1, A * 0.75);
    hatch(g, rectB(PL.x, 660, PL.w, 180), PL.x, 660, PL.w, 180, 0, 6, ink, 0.6, A * 0.22);
    // Boden mit Fluchtlinien
    stk(g, (c) => { c.moveTo(PL.x, 840); c.lineTo(PL.x + PL.w, 840); for (let i = -14; i <= 14; i++) { c.moveTo(OT.cx + i * 38, 840); c.lineTo(OT.cx + i * 150, 900); } for (const y of [852, 868, 888]) { c.moveTo(PL.x, y); c.lineTo(PL.x + PL.w, y); } }, ink, 0.8, A * 0.55);
    // Wimpel / Fahnenschnüre unter dem Dach
    stk(g, (c) => { c.moveTo(PL.x, 190); c.quadraticCurveTo(560, 250, 900, 186); c.moveTo(1320, 186); c.quadraticCurveTo(1580, 250, PL.x + PL.w, 190); }, ink, 0.9, A);
    const quad = (p0, p1, p2, u) => [(1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0], (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1]];
    fil(g, (c) => { for (const cv of [[[PL.x, 190], [560, 250], [900, 186]], [[1320, 186], [1580, 250], [PL.x + PL.w, 190]]]) for (let i = 1; i < 13; i++) { const [x, y] = quad(cv[0], cv[1], cv[2], i / 13); c.moveTo(x - 8, y); c.lineTo(x + 8, y); c.lineTo(x, y + 18); c.closePath(); } }, COL.sepia, A * 0.9);
    g.restore();
  }

  // ---------- Führungsschienen (Holzpfosten + Sägezahn-Sperrleisten), Kopfbalken, Sockel ----------
  function otRails(g, yA, yB, leftOnly) {
    const P = OT;
    yA = Math.max(yA, P.top); yB = Math.min(yB, P.floor - 18);
    const post = (x0, x1, shadeRight) => {
      fil(g, rectB(x0, yA, x1 - x0, yB - yA), "#2b1a0a", 0.95);
      stk(g, (c) => { for (let k = 1; k < 4; k++) { const bx = x0 + (x1 - x0) * k / 4; c.moveTo(bx, yA); for (let y = yA; y <= yB; y += 14) c.lineTo(bx + Math.sin(y * 0.035 + k * 2.1) * 1.6 + Math.sin(y * 0.11 + k) * 0.5, y); } }, COL.wood, 0.8, 0.5);
      hatch(g, rectB(shadeRight ? (x0 + x1) / 2 : x0, yA, (x1 - x0) / 2, yB - yA), x0, yA, x1 - x0, yB - yA, 64, 3.2, COL.deep, 0.8, 0.7);
      stk(g, (c) => c.rect(x0, yA, x1 - x0, yB - yA), COL.wood, 1.7, 0.95, 0.5);
      stk(g, (c) => { for (let y = 330; y < yB; y += 173) if (y > yA + 6) { c.moveTo(x0 + 6, y); c.ellipse((x0 + x1) / 2, y, (x1 - x0) * 0.22, 5, 0, 0, TAU); } }, COL.wood, 0.8, 0.45);
    };
    const bar = (x0, x1, face, side) => {
      fil(g, rectB(x0, yA, x1 - x0, yB - yA), "#1a1410", 1);
      const tb = teethB(face, yA, yB, P.pitch, P.depth, side, P.tooth0);
      fil(g, (c) => { tb(c); c.lineTo(face, yB); c.closePath(); }, "#3a3026", 1);
      stk(g, (c) => { tb(c); }, COL.pale, 1.3, 0.9, 0.35);
      stk(g, (c) => c.rect(x0, yA, x1 - x0, yB - yA), COL.pale, 1, 0.65);
      // Rastflächen (Zahnoberkanten) mit dezentem Cyan-Akzent
      stk(g, (c) => { let y = P.tooth0; while (y - P.pitch >= yA) y -= P.pitch; while (y < yA) y += P.pitch; for (; y < yB; y += P.pitch) { c.moveTo(face, y); c.lineTo(face + side * P.depth, y); } }, COL.cyan, 1, 0.42);
      fil(g, (c) => { for (let y = 262; y < yB; y += 64) if (y > yA) { c.moveTo((x0 + x1) / 2 + 2, y); c.arc((x0 + x1) / 2, y, 2, 0, TAU); } }, COL.pale, 0.7);
    };
    post(P.lw0, P.lw1, true); bar(P.lw1, P.lFace, P.lFace, 1);
    if (!leftOnly) { post(P.rw0, P.rw1, false); bar(P.rFace, P.rw0, P.rFace, -1); }
  }
  function otFrame(g) {
    const P = OT;
    otRails(g, P.top, P.floor, false);
    // Kopfbalken mit Konsole für die rechte Umlenkrolle
    const beam = rectB(900, P.beamY, 446, P.beamH);
    fil(g, beam, "#2b1a0a", 0.95); hatch(g, beam, 900, P.beamY, 446, P.beamH, 0, 4, COL.wood, 0.7, 0.55); stk(g, beam, COL.wood, 1.7, 0.95, 0.5);
    stk(g, (c) => { c.moveTo(P.rw1, 318); c.lineTo(1336, P.beamY + P.beamH); c.moveTo(P.rw1, 336); c.lineTo(1346, P.beamY + P.beamH + 4); }, COL.wood, 2, 0.85, 0.3);
    // Rollenhalter
    stk(g, (c) => { for (const [x, y] of [P.A, P.B]) { c.moveTo(x - 12, P.beamY + P.beamH); c.lineTo(x - 5, y); c.moveTo(x + 12, P.beamY + P.beamH); c.lineTo(x + 5, y); } }, COL.pale, 2, 0.8);
    // Sockelschwelle + Kopfbänder
    const sill = rectB(896, P.floor - 18, 408, 18);
    fil(g, sill, "#2b1a0a", 0.95); hatch(g, sill, 896, P.floor - 18, 408, 18, 0, 4, COL.wood, 0.7, 0.5); stk(g, sill, COL.wood, 1.6, 0.9, 0.4);
    stk(g, (c) => { c.moveTo(P.lw0, 800); c.lineTo(902, P.floor - 18); c.moveTo(P.rw1, 800); c.lineTo(1298, P.floor - 18); }, COL.wood, 3, 0.8, 0.3);
    // Bodenrolle-Lagerbock
    stk(g, (c) => { c.rect(1340, P.floor - 14, 40, 14); c.moveTo(1346, P.floor - 14); c.lineTo(1354, P.C[1]); c.moveTo(1374, P.floor - 14); c.lineTo(1362, P.C[1]); }, COL.pale, 1.6, 0.75);
  }

  // ---------- Plattform mit Wagenfeder und Sperrklinken ----------
  function otSpringPts(S, leafK) {
    const P = OT, y0 = S.yc - 10, x0 = P.cx - S.hw, x1 = P.cx + S.hw, cyq = y0 - 2 * S.bow;
    const Lk = [1, 0.8, 0.6, 0.4][leafK], a = 0.5 - Lk / 2, b = 0.5 + Lk / 2, pts = [];
    for (let i = 0; i <= 14; i++) { const u = lerp(a, b, i / 14), m = 1 - u; pts.push([m * m * x0 + 2 * m * u * P.cx + u * u * x1, m * m * y0 + 2 * m * u * cyq + u * u * y0 + leafK * 3.4]); }
    return pts;
  }
  function otPlatform(ctx, L, S, o = {}) {
    const P = OT, yc = S.yc, yf = yc + P.floorOff, tipL = S.tip, tipR = 2 * P.cx - S.tip;
    const woodRect = (x, y, w, h, ang) => { const b = rectB(x, y, w, h); fil(ctx, b, "#2b1a0a", 0.96); if (!o.lite) hatch(ctx, b, x, y, w, h, ang, 4, COL.wood, 0.7, 0.5); stk(ctx, b, COL.wood, 1.6, 0.95, 0.4); };
    if (!o.detailOnly) {
      // Stiele, Streben, Boden
      woodRect(P.stL, yc - 2, 12, yf + 22 - yc, 90); woodRect(P.stR - 12, yc - 2, 12, yf + 22 - yc, 90);
      stk(ctx, (c) => { c.moveTo(P.stL + 12, yf - 56); c.lineTo(P.stL + 60, yf); c.moveTo(P.stR - 12, yf - 56); c.lineTo(P.stR - 60, yf); c.moveTo(P.stL + 12, yf + 22); c.lineTo(P.cx, yf + 36); c.lineTo(P.stR - 12, yf + 22); }, COL.wood, 2.4, 0.85, 0.3);
      const fl = rectB(P.stL, yf, P.stR - P.stL, 12);
      fil(ctx, fl, "#2b1a0a", 0.96); stk(ctx, (c) => { for (let x = P.stL + 20; x < P.stR; x += 20) { c.moveTo(x, yf); c.lineTo(x, yf + 12); } }, COL.wood, 0.8, 0.6); stk(ctx, fl, COL.wood, 1.6, 0.95, 0.4);
      woodRect(P.stL - 4, yf + 12, P.stR - P.stL + 8, 10, 0);
    }
    // Führungsschuhe (umgreifen die Pfosten)
    stk(ctx, (c) => { for (const y of [yc + 26, yf - 12]) { c.rect(P.lw0 - 5, y, P.stL + 12 - P.lw0 + 5, 14); c.rect(P.stR - 12, y, P.rw1 + 5 - P.stR + 12, 14); } }, COL.pale, 1.3, 0.75);
    fil(ctx, (c) => { for (const y of [yc + 26, yf - 12]) { c.rect(P.lw0 - 5, y, 7, 14); c.rect(P.rw1 - 2, y, 7, 14); } }, COL.pale, 0.55);
    // Querhaupt
    woodRect(P.stL, yc, P.stR - P.stL, 16, 0);
    // Sperrklinken (Eisen), Führungslaschen
    const pawl = (tip, side) => {
      const pts = [[tip, yc - 1], [tip + side * 8, yc - 12], [tip + side * 38, yc - 12], [tip + side * 38, yc - 1]];
      fil(ctx, polyB(pts, true), "#5a3a14", 1); stk(ctx, polyB(pts, true), COL.ink, 1.5, 1, 0.5);
      if (S.caught) stk(ctx, (c) => { c.moveTo(tip, yc - 1); c.lineTo(tip + side * 14, yc - 1); }, COL.cyan, 1.6, 0.6 + 0.4 * Math.sin(S.da * 5), 0.8);
      stk(ctx, (c) => c.arc(tip + side * 32, yc - 8, 2.4, 0, TAU), COL.pale, 1, 0.95);
    };
    pawl(tipL, 1); pawl(tipR, -1);
    stk(ctx, (c) => { c.rect(P.stL + 1, yc - 15, 14, 15); c.rect(P.stR - 15, yc - 15, 14, 15); }, COL.pale, 1.3, 0.85);
    // Wagenfeder (Blattfeder, gestufte Lagen)
    const bright = 0.75 + 0.25 * S.ext;
    for (let k = 3; k >= 0; k--) stk(ctx, polyB(otSpringPts(S, k)), k === 0 ? COL.ink : COL.sepia, k === 0 ? 3.2 : 2.4, bright, k === 0 ? 1 : 0.3);
    const apex = yc - 10 - S.bow;
    fil(ctx, (c) => { c.arc(P.cx - S.hw, yc - 10, 3.4, 0, TAU); c.moveTo(P.cx + S.hw + 3.4, yc - 10); c.arc(P.cx + S.hw, yc - 10, 3.4, 0, TAU); }, "#1c1712", 1);
    stk(ctx, (c) => { c.arc(P.cx - S.hw, yc - 10, 3.4, 0, TAU); c.moveTo(P.cx + S.hw + 3.4, yc - 10); c.arc(P.cx + S.hw, yc - 10, 3.4, 0, TAU); }, COL.pale, 1.2, 1);
    stk(ctx, (c) => { c.moveTo(P.cx - S.hw, yc - 10); c.lineTo(tipL + 32, yc - 8); c.moveTo(P.cx + S.hw, yc - 10); c.lineTo(tipR - 32, yc - 8); }, COL.pale, 2, 0.9);
    // Federbund + Schäkel
    fil(ctx, rectB(P.cx - 9, apex - 3, 18, 16), "#1c1712", 1); stk(ctx, rectB(P.cx - 9, apex - 3, 18, 16), COL.pale, 1.3, 1);
    stk(ctx, (c) => c.ellipse(P.cx, apex - 11, 6, 9, 0, 0, TAU), COL.pale, 1.8, 1);
    return { apex, yf };
  }

  // ---------- Handwinde mit Seiltrommel (rechts) ----------
  function otWinch(ctx, ang) {
    const [x, y] = OT.drum, r = OT.drR, fl = OT.floor;
    stk(ctx, (c) => { c.moveTo(x - 46, fl); c.lineTo(x - 6, y - 30); c.lineTo(x + 34, fl); c.moveTo(x - 30, fl - 20); c.lineTo(x + 20, fl - 20); }, COL.wood, 3.2, 0.9, 0.3);
    fil(ctx, (c) => c.arc(x, y, r, 0, TAU), "#1c1712", 1);
    stk(ctx, (c) => c.arc(x, y, r, 0, TAU), COL.pale, 1.8, 1, 0.4);
    stk(ctx, (c) => { for (let k = 1; k < 4; k++) { c.moveTo(x + r - k * 4, y); c.arc(x, y, r - k * 4, 0, TAU); } }, COL.sepia, 0.9, 0.7);
    const ca = ang, hx = x + Math.cos(ca) * 34, hy = y + Math.sin(ca) * 34;
    stk(ctx, (c) => { c.moveTo(x, y); c.lineTo(hx, hy); }, COL.pale, 3, 0.95, 0.3);
    fil(ctx, (c) => { c.arc(hx, hy, 4.5, 0, TAU); c.moveTo(x + 4, y); c.arc(x, y, 4, 0, TAU); }, COL.pale, 1);
  }

  // ---------- Seile ----------
  function otRopes(ctx, S, t, T) {
    const P = OT, [ax, ay] = P.A, [bx, by] = P.B, [cx, cy] = P.C, r = P.pr, dr = OT.drum;
    const col = COL.pale, w = 3.4;
    const slack = S.cut ? easeOut(clamp(S.dt / 0.35)) : 0;
    const topY = S.apexY - 20;
    const run = S.cut ? Math.min(OT.drop, S.dt * 50) : 0;
    // Plattform -> Rolle A -> Rolle B (nach dem Schnitt leicht durchhängend)
    rope(ctx, (c) => {
      c.moveTo(P.cx, topY);
      c.quadraticCurveTo(P.cx - 7 * slack, (topY + ay) / 2, ax - r, ay);
      c.arc(ax, ay, r, Math.PI, Math.PI * 1.5);
      c.quadraticCurveTo((ax + bx) / 2, ay - r + 5 * slack, bx, by - r);
      c.arc(bx, by, r, Math.PI * 1.5, TAU);
    }, col, w, 0.95, run);
    if (!S.cut) {
      rope(ctx, (c) => { c.moveTo(bx + r, by); c.lineTo(cx - r, cy); c.arc(cx, cy, r, Math.PI, Math.PI / 2, true); c.lineTo(dr[0], dr[1] + OT.drR); }, col, w, 0.95, 0);
      return;
    }
    // senkrechter Trum schlackert, freies Ende schnellt um die Bodenrolle zurück
    const dt = S.dt, wob = 16 * Math.exp(-dt * 2.2) * Math.sin(dt * 11);
    const rec = easeOut(clamp(dt / 0.5)), endX = lerp(P.cut[0] - 4, 1432, rec), endY = lerp(P.cut[1], P.floor - 4, easeIn(clamp(dt / 0.6)));
    rope(ctx, (c) => {
      c.moveTo(bx + r, by);
      c.bezierCurveTo(bx + r + wob, by + 200, bx + r - wob * 0.7, cy - 200, cx - r, cy);
      c.arc(cx, cy, r, Math.PI, Math.PI / 2, true);
      c.quadraticCurveTo((cx + endX) / 2, cy + r + 10 * rec + 6 * Math.sin(dt * 9) * Math.exp(-dt * 3), endX, endY);
    }, col, w, 0.95, run);
    // unteres Stück zur Winde fällt auf den Hackklotz
    const lx = lerp(P.cut[0] + 6, P.cut[0] + 16, rec), ly = lerp(P.cut[1], P.cut[1] + 6, rec);
    rope(ctx, (c) => { c.moveTo(dr[0], dr[1] + OT.drR); c.quadraticCurveTo((dr[0] + lx) / 2, P.cut[1] + 2, lx, ly); }, col, w, 0.95, 0);
    // ausgefranste Enden
    stk(ctx, (c) => { for (let i = 0; i < 4; i++) { const a = -0.6 + i * 0.4; c.moveTo(endX, endY); c.lineTo(endX - Math.cos(a) * 7, endY + Math.sin(a) * 7); c.moveTo(lx, ly); c.lineTo(lx + Math.cos(a) * 6, ly + Math.sin(a) * 6); } }, COL.pale, 1, 0.8);
  }

  // ---------- Gehilfe mit Axt + Hackklotz ----------
  function otAxe(ctx, L, t, T) {
    const P = OT, ax = 1466, fl = P.floor;
    // Hackklotz
    const blk = rectB(P.cut[0] - 26, P.cut[1] + 2, 52, fl - P.cut[1] - 2);
    fil(ctx, blk, "#2b1a0a", 0.95); hatch(ctx, blk, P.cut[0] - 26, P.cut[1], 52, 30, 0, 3.5, COL.wood, 0.7, 0.55); stk(ctx, blk, COL.wood, 1.5, 0.9, 0.3);
    // Pose: bereit -> ausholen -> Schlag -> Nachschwingen
    const tc = T.tc;
    const poses = { ready: [1500, 772, -1.25], raised: [1480, 700, -2.35], hit: [1488, 824, 0.3] };
    let hx, hy, th;
    const kw = smooth(inv(tc - 1.0, tc - 0.3, t)), ks = easeIn(inv(tc - 0.22, tc, t));
    if (t < tc) {
      hx = lerp(poses.ready[0], poses.raised[0], kw); hy = lerp(poses.ready[1], poses.raised[1], kw); th = lerp(poses.ready[2], poses.raised[2], kw);
      if (ks > 0) { hx = lerp(hx, poses.hit[0], ks); hy = lerp(hy, poses.hit[1], ks) - Math.sin(ks * Math.PI) * 30; th = lerp(th, poses.hit[2], ks); }
    } else { const db = t - tc; hx = poses.hit[0]; hy = poses.hit[1] + 3 * Math.exp(-db * 8) * Math.sin(db * 30); th = poses.hit[2] + 0.04 * Math.exp(-db * 6); }
    const ux = Math.cos(th), uy = Math.sin(th), nx = -uy, ny = ux, len = 66;
    const ex = hx + ux * len, ey = hy + uy * len;
    const h2x = hx + ux * 14, h2y = hy + uy * 14;
    figure(ctx, L, ax, fl, 150, rgba(COL.sepia, 1), 0.9, { hat: "cap", arms: [[h2x, h2y, ax - 18, 790], [hx, hy]] });
    stk(ctx, (c) => { c.moveTo(hx - ux * 8, hy - uy * 8); c.lineTo(ex, ey); }, COL.wood, 3.2, 1, 0.3);
    const blade = [[ex - ux * 6, ey - uy * 6], [ex + ux * 5, ey + uy * 5], [ex + ux * 9 + nx * 16, ey + uy * 9 + ny * 16], [ex - ux * 11 + nx * 16, ey - uy * 11 + ny * 16]];
    fil(ctx, polyB(blade, true), "#1c1712", 1); stk(ctx, polyB(blade, true), COL.pale, 1.4, 1, 0.5);
    // Bewegungsbogen während des Schlags
    if (ks > 0 && ks < 1) stk(ctx, (c) => { c.arc(hx, hy + 20, 70, th - 0.9, th, false); }, COL.pale, 2, 0.35 * Math.sin(ks * Math.PI));
  }

  // ---------- Zuschauer ----------
  function otCrowd(ctx, L, t, T) {
    const n = 19;
    for (let i = 0; i < n; i++) {
      const left = i < 16; const k = left ? i / 15 : (i - 16) / 2;
      const x = left ? 150 + k * 700 + (h01(i * 4.1) - 0.5) * 24 : 1738 + k * 62 + (h01(i * 4.1) - 0.5) * 10;
      const h = 124 + 30 * h01(i * 2.3), dress = h01(i * 7.7) > 0.7, top = !dress && h01(i * 1.9) < 0.55;
      const react = t > T.tc + 0.05 ? -4 * Math.exp(-(t - T.tc) * 5) * (0.6 + 0.4 * h01(i)) : 0;
      const sway = Math.sin(t * 0.8 + i * 1.3) * 0.8;
      const cheer = !dress && h01(i * 3.3) > 0.55 ? smooth(inv(T.cheerAt + 0.05 + 0.25 * h01(i * 9.1), T.cheerAt + 0.55 + 0.25 * h01(i * 9.1), t)) : 0;
      const y = 896 + 6 * h01(i * 5.5) + react, s = h / 180, xx = x + sway;
      const col = i % 3 === 0 ? COL.deep : COL.sepia, al = 0.3 + 0.14 * h01(i * 6.2);
      const arms = cheer > 0 ? [null, [xx + 30 * s, y - (138 + 90 * cheer) * s, xx + 30 * s, y - 120 * s]] : null;
      figure(ctx, L, xx, y, h, col, al, { dress, hat: top && cheer <= 0.5 ? "top" : null, arms });
      if (top && cheer > 0.5) fil(ctx, (c) => { const hx = xx + 30 * s, hy = y - (138 + 90 * cheer) * s; c.rect(hx - 9 * s, hy - 26 * s, 18 * s, 22 * s); c.rect(hx - 15 * s, hy - 5 * s, 30 * s, 4 * s); }, col, al);
    }
  }

  // ---------- Detail-Lupe ----------
  function otInset(ctx, L, S, t, a, T, cfg) {
    if (a <= 0.004) return;
    const I = INS, sc = lerp(0.86, 1, easeOut(a)), r = I.r * sc, sG = GA; GA = sG * a;
    // Verbindungslinien zur Quelle
    const vx = I.fx - I.x, vy = I.fy - I.y, vl = Math.hypot(vx, vy), nx = -vy / vl, ny = vx / vl, rs = I.r / I.z;
    stk(ctx, (c) => { c.moveTo(I.x + nx * r, I.y + ny * r); c.lineTo(I.fx + nx * rs, I.fy + ny * rs); c.moveTo(I.x - nx * r, I.y - ny * r); c.lineTo(I.fx - nx * rs, I.fy - ny * rs); }, COL.cyan, 1.1, 0.45);
    stk(ctx, (c) => c.arc(I.fx, I.fy, rs, 0, TAU), COL.cyan, 1.3, 0.7, 0.4, [5, 4], -t * 8);
    ctx.save(); ctx.beginPath(); ctx.arc(I.x, I.y, r, 0, TAU); ctx.clip();
    const insetBg = (g, z) => { fil(g, (c) => c.arc(I.x, I.y, I.r * z / I.z, 0, TAU), "rgb(9,8,8)", 0.95); g.save(); g.translate(I.x, I.y); g.scale(z, z); g.translate(-I.fx, -I.fy); const w0 = WM; WM = 0.42; otRails(g, I.fy - 60, I.fy + 60, true); WM = w0; g.restore(); };
    if (sc > 0.999) layer(ctx, "ot_inset", I.x - I.r - 2, I.y - I.r - 2, 2 * I.r + 4, 2 * I.r + 4, 1, (g) => insetBg(g, I.z));
    else insetBg(ctx, I.z * sc);
    ctx.translate(I.x, I.y); ctx.scale(I.z * sc, I.z * sc); ctx.translate(-I.fx, -I.fy);
    const sW = WM; WM = 0.42;
    // Geisterlinie: Ausgangslage der Klinke
    if (S.cut) stk(ctx, (c) => { c.moveTo(OT.lFace - 30, OT.ycF - OT.drop - 1); c.lineTo(OT.lFace + 70, OT.ycF - OT.drop - 1); }, COL.cyan, 1.4, 0.6 * inv(0, 0.3, S.dt), 0, [4, 3]);
    otPlatform(ctx, L, S, { detailOnly: true, lite: false });
    WM = sW;
    if (S.caught) { const f = Math.exp(-S.da * 4); dot(ctx, S.tip + 1, S.yc - 1, 5 + 6 * (1 - f), COL.ink, 0.7 * f + 0.25 * (0.5 + 0.5 * Math.sin(t * 4))); }
    ctx.restore();
    let dropTag = null;
    if (S.cut && t > T.dropAt) { // Maßkette Fallweg im Lupen-Maßstab (erscheint bei BEAT [2])
      const kd = easeOut(inv(T.dropAt, T.dropAt + 0.45, t)), zz = I.z * sc, sy0 = I.y + (OT.ycF - OT.drop - 1 - I.fy) * zz, sy1 = I.y + (OT.ycF - 1 - I.fy) * zz, ax = I.x + (OT.lFace - 2 - I.fx) * zz;
      stk(ctx, (c) => { c.moveTo(ax - 7, sy0); c.lineTo(ax + 7, sy0); c.moveTo(ax - 7, sy1); c.lineTo(ax + 7, sy1); }, COL.cyan, 1.4, kd);
      stk(ctx, (c) => { c.moveTo(ax, sy0); c.lineTo(ax, lerp(sy0, sy1, kd)); }, COL.cyan, 1.8, kd, 0.6);
      arrowHead(ctx, ax, sy0, -Math.PI / 2, 8, COL.cyan, kd); if (kd > 0.95) arrowHead(ctx, ax, sy1, Math.PI / 2, 8, COL.cyan, kd);
      if (cfg.dropText) dropTag = [ax - 3, (sy0 + sy1) / 2];
    }
    // Rahmen
    stk(ctx, (c) => c.arc(I.x, I.y, r, 0, TAU), COL.ink, 2.2, 0.95, 0.6);
    stk(ctx, (c) => { c.arc(I.x, I.y, r + 7, 0, TAU); }, COL.ink, 0.9, 0.45);
    stk(ctx, (c) => { for (let i = 0; i < 72; i++) { const q = i * TAU / 72 + t * 0.05; const l = i % 6 ? 4 : 9; c.moveTo(I.x + Math.cos(q) * (r + 7), I.y + Math.sin(q) * (r + 7)); c.lineTo(I.x + Math.cos(q) * (r + 7 + l), I.y + Math.sin(q) * (r + 7 + l)); } }, COL.ink, 1, 0.5);
    txt(L, ctx, "DETAIL · FANGVORRICHTUNG", I.x, I.y - r - 28, { size: 18, weight: 700, font: L.FONT.mono, color: COL.ink, align: "center", letterSpacing: 2 });
    // Status
    const st = S.caught ? "KLINKE RASTET EIN – HÄLT" : S.cut ? "SEIL GEKAPPT – FEDER SPREIZT" : "SEIL GESPANNT – KLINKE FREI";
    const sc2 = S.caught ? COL.ink : S.cut ? COL.red : COL.cyan;
    const sw = meas(L, ctx, st, { size: 17, weight: 700, font: L.FONT.head, letterSpacing: 1.5 }) + 24;
    fil(ctx, (c) => rr(c, I.x - sw / 2, I.y + r - 50, sw, 30, 4), "rgb(8,8,12)", 0.9);
    stk(ctx, (c) => rr(c, I.x - sw / 2, I.y + r - 50, sw, 30, 4), sc2, 1.2, 0.8);
    txt(L, ctx, st, I.x, I.y + r - 29, { size: 17, weight: 700, font: L.FONT.head, color: sc2, align: "center", letterSpacing: 1.5 });
    if (dropTag) tag(ctx, L, dropTag[0], dropTag[1], I.x - r - 24, dropTag[1], cfg.dropText, inv(T.dropAt, T.dropAt + 0.6, t), { align: "right", color: COL.cyan, size: 24, noDot: true, textColor: COL.white });
    GA = sG;
  }

  function quotePlate(ctx, L, xr, y, q, by, prog) {
    const p = clamp(prog); if (p <= 0) return;
    const a = easeOut(p);
    ctx.save(); ctx.globalAlpha = GA * a; ctx.font = 'italic 400 25px "Inter"'; ctx.textAlign = "right"; ctx.fillStyle = COL.pale;
    ctx.fillText(q, xr, y + (1 - a) * 8); ctx.restore();
    txt(L, ctx, by, xr, y + 30, { size: 16, weight: 700, font: L.FONT.mono, color: COL.ink, align: "right", letterSpacing: 2, alpha: inv(0.3, 1, p) });
  }

  function otAnchors(S, TT) {
    const P = OT;
    return {
      spring: { re: /feder/, g: () => { const sp = otSpringPts(S, 0)[4]; return { tx: sp[0], ty: sp[1], bx: 862, by: 292, align: "right" }; } },
      rack: { re: /zahn|leiste|ratsche|rack/, g: () => ({ tx: P.rFace + 3, ty: 488, bx: 1420, by: 452 }) },
      pawl: { re: /klinke|sperr|fang|pawl/, g: () => ({ tx: 2 * P.cx - S.tip - 16, ty: S.yc - 7, bx: 1420, by: 380 }) },
      cut: { re: /gekappt|kapp|schnitt|axt|durchtrenn|cut/, def: TT.cut ? TT.tc + 0.08 : undefined, g: () => ({ tx: P.cut[0], ty: P.cut[1] - 4, bx: 1600, by: 752, color: COL.red }) },
      rope: { re: /seil|rope|tau/, g: () => ({ tx: P.B[0] + P.pr, ty: 600, bx: 1420, by: 566 }) },
      otis: { re: /otis|mechaniker|erfinder|vorführ|elisha|mann/, g: () => ({ tx: 1072, ty: S.yf - 118, bx: 884, by: S.yf - 64, align: "right" }) },
      hall: { re: /palast|crystal|halle|ausstellung|new york|messe/, g: () => ({ kind: "caption" }) },
      crowd: { re: /publikum|zuschauer|menge|besucher|leute/, g: () => ({ tx: 470, ty: 800, bx: 700, by: 776 }) },
      helper: { re: /gehilf|helfer|assist|arbeiter/, g: () => ({ tx: 1462, ty: 774, bx: 1560, by: 660 }) },
      platform: { re: /plattform|fahrkorb|bühne|korb/, g: () => ({ tx: P.stR - 30, ty: S.yf + 6, bx: 1420, by: 652 }) },
    };
  }
  const OT_FALLBACK = ["otis", "spring", "rack", "rope", "pawl", "platform", "crowd", "helper"];

  function drawOtis(ctx, p, cfg, T) {
    const { L, t } = p, d = T.d, TT = otTimes(T, cfg), S = otState(t, TT), P = OT;
    S.apexY = S.yc - 10 - S.bow; S.yf = S.yc + P.floorOff;
    layer(ctx, "ot_hall", PL.x - 12, PL.y - 12, PL.w + 24, PL.h + 24, 1, otHall);
    ctx.save(); ctx.beginPath(); plateClip(ctx); ctx.clip();
    layer(ctx, "ot_beams", 240, 210, 1330, 680, 0.72 + 0.28 * Math.sin(t * 0.9), (g) => {
      lightBeam(g, [[820, 250], [930, 214], [1210, 884], [930, 884]], 900, 240, 1060, 884, COL.ink, 1);
      lightBeam(g, [[1330, 230], [1420, 260], [1560, 884], [1360, 884]], 1380, 250, 1460, 884, COL.ink, 0.8);
      lightBeam(g, [[250, 280], [330, 300], [560, 884], [380, 884]], 290, 300, 470, 884, COL.ink, 0.7);
    });
    motes(ctx, t, 46, 300, 230, 1300, 640, COL.pale, 3, 1);
    if (cfg.audience) otCrowd(ctx, L, t, TT);
    ctx.restore();
    layer(ctx, "ot_frame", 876, 176, 530, 716, 1, otFrame);
    const run = S.cut ? Math.min(OT.drop, S.dt * 50) : 0;
    pulley(ctx, P.A[0], P.A[1], P.pr, run / P.pr + Math.sin(t * 1.9) * 0.01, COL.pale);
    pulley(ctx, P.B[0], P.B[1], P.pr, run / P.pr, COL.pale);
    pulley(ctx, P.C[0], P.C[1], P.pr, -run / P.pr, COL.pale);
    otRopes(ctx, S, t, TT);
    const { yf } = otPlatform(ctx, L, S);
    // Otis auf der Plattform (Silhouette), zieht nach dem Fangen den Hut (BEAT [3])
    const s = 150 / 180, mx = 1068, cheer = smooth(inv(TT.cheerAt, TT.cheerAt + 0.6, t));
    const rh = [lerp(mx + 24 * s, mx + 60 * s, cheer), lerp(yf - 70 * s, yf - 212 * s, cheer), lerp(mx + 26 * s, mx + 50 * s, cheer), lerp(yf - 104 * s, yf - 160 * s, cheer)];
    figure(ctx, L, mx, yf, 150, COL.pale, 0.92, { hat: cheer < 0.5 ? "top" : null, arms: [[mx - 24 * s, yf - 70 * s, mx - 26 * s, yf - 104 * s], rh] });
    if (cheer >= 0.5) fil(ctx, (c) => { c.rect(rh[0] - 9 * s, rh[1] - 28 * s, 18 * s, 24 * s); c.rect(rh[0] - 15 * s, rh[1] - 6 * s, 30 * s, 4.5 * s); }, COL.pale, 0.92);
    otWinch(ctx, -0.6 + Math.sin(t * 0.4) * 0.05);
    otAxe(ctx, L, t, TT);
    // Effekte: Schnitt
    ctx.save(); ctx.beginPath(); plateClip(ctx); ctx.clip();
    if (S.cut && S.dt < 1.2) {
      const f = Math.exp(-S.dt * 5);
      dot(ctx, P.cut[0], P.cut[1], 26 + 40 * (1 - f), COL.red, 0.9 * f);
      stk(ctx, (c) => c.arc(P.cut[0], P.cut[1], 10 + 70 * easeOut(S.dt / 0.5), 0, TAU), COL.red, 2, 0.8 * f);
      stk(ctx, (c) => { for (let i = 0; i < 12; i++) { const a = -Math.PI * (0.1 + 0.8 * h01(i * 3.1)), v = 160 + 240 * h01(i * 1.7), q = S.dt; const x = P.cut[0] + Math.cos(a) * v * q, y = P.cut[1] + Math.sin(a) * v * q + 600 * q * q; c.moveTo(x, y); c.lineTo(x + Math.cos(a + 1) * 6, y + Math.sin(a + 1) * 6); } }, COL.pale, 1.3, clamp(1 - S.dt / 0.9));
    }
    // Effekte: Fangen
    if (S.caught) {
      const f = Math.exp(-S.da * 4.5);
      for (const [x, side] of [[S.tip, 1], [2 * P.cx - S.tip, -1]]) {
        dot(ctx, x, S.yc - 1, 18 + 22 * (1 - f), COL.ink, 0.85 * f + 0.25 * (0.5 + 0.5 * Math.sin(t * 4)));
        if (S.da < 0.6) stk(ctx, (c) => { for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + side * (0.2 + i * 0.28) * -1, r0 = 10 + 50 * easeOut(S.da / 0.5); c.moveTo(x + Math.cos(a) * r0, S.yc + Math.sin(a) * r0); c.lineTo(x + Math.cos(a) * (r0 + 10), S.yc + Math.sin(a) * (r0 + 10)); } }, COL.pale, 1.6, f);
      }
    }
    ctx.restore();
    // Abdunkeln (dim_background) – bei der Zeitungsvariante mit dem Einschieben
    if (cfg.dim > 0) {
      const kd = cfg.variant === "newspaper" ? smooth(inv(T.beat(0, 0.3), T.beat(0, 0.3) + 0.6, t)) : 1;
      fil(ctx, plateClip, "rgb(3,5,10)", cfg.dim * kd);
    }
    // Detail-Lupe
    if (cfg.inset) { const ti = Math.min(TT.lab0, Math.max(0.3, 0.08 * d)); otInset(ctx, L, S, t, easeOut(inv(ti, ti + 0.6, t)), TT, cfg); }
    if (cfg.variant === "newspaper") newspaper(ctx, L, t, T, cfg);
    // Kopfzeile + Beschriftungen
    const hdr = drawHeader(ctx, L, t, T, cfg, { title: "NEW YORK 1854", sub: "Kristallpalast · Otis-Vorführung" }, cfg.ov);
    const A = otAnchors(S, TT);
    const defs = [{ key: "rope", text: "Tragseil" }, { key: "spring", text: "Wagenfeder" }, { key: "rack", text: "Sperrzahnleiste" }];
    if (TT.cut) defs.push({ key: "cut", text: "Seil gekappt", def: TT.tc + 0.08 });
    drawLabels(ctx, L, t, T, resolveLabels(cfg.items, A, OT_FALLBACK, cfg.variant === "newspaper" ? [] : defs, TT.lab0, TT.st), A, hdr);
    if (cfg.quote) {
      const q = typeof cfg.quote === "string" ? cfg.quote : "Alles sicher, meine Herren!", qa = T.at(cfg.quoteAt, Math.min(TT.tl + 0.6, d - 0.9));
      quotePlate(ctx, L, HX, hdr.y + 30, "„" + q + "“", cfg.quoteBy || "ÜBERLIEFERT · ZEITGENÖSSISCH NICHT BELEGT", inv(qa, qa + 0.6, t));
    }
  }

  // ---------- Variante "newspaper_overlay": stilisierte Zeitungsspalte mit hervorgehobener Randnotiz ----------
  const NP = { x: 236, y: 214, w: 430, h: 656, noteY: 336, noteLH: 40 };
  function npPaper(g) {
    const w = NP.w, h = NP.h, ink = COL.pale;
    fil(g, rectB(0, 0, w, h), "#1d150b", 0.97);
    stk(g, (c) => { for (let y = 6; y < h; y += 5) { c.moveTo(4, y); c.lineTo(w - 4, y + (h01(y) - 0.5) * 2); } }, COL.ink, 0.5, 0.06);
    stk(g, (c) => c.rect(0, 0, w, h), ink, 1.3, 0.7);
    stk(g, (c) => c.rect(9, 9, w - 18, h - 18), ink, 0.8, 0.35);
    // Zeitungskopf: unlesbare Frakturzeichen (kein echter Titel)
    stk(g, (c) => {
      let x = 44; const y0 = 46, y1 = 88;
      for (let i = 0; i < 15 && x < w - 50; i++) {
        if (i === 6) { x += 16; continue; }
        const kind = h01(i * 3.7), lw = 17 + 8 * h01(i * 1.3);
        c.moveTo(x, y0 + 8); c.lineTo(x, y1); c.moveTo(x - 4, y0 + 10); c.lineTo(x + 3, y0 + 4);
        if (kind > 0.35) { c.moveTo(x, y0 + 12); c.lineTo(x + lw * 0.6, y0 + 6); c.lineTo(x + lw * 0.6, y1); }
        if (kind > 0.75) { c.moveTo(x + lw * 0.6, y0 + 12); c.lineTo(x + lw, y0 + 8); c.lineTo(x + lw, y1); }
        c.moveTo(x - 3, y1); c.lineTo(x + lw * 0.65, y1 - 3);
        x += lw + 8;
      }
    }, ink, 3.2, 0.85);
    stk(g, (c) => { c.moveTo(18, 104); c.lineTo(w - 18, 104); c.moveTo(18, 109); c.lineTo(w - 18, 109); c.moveTo(18, 152); c.lineTo(w - 18, 152); }, ink, 1.1, 0.7);
    stk(g, (c) => { for (const [a, b] of [[22, 130], [w - 130, w - 22]]) for (const y of [124, 138]) { c.moveTo(a, y); c.lineTo(b - 12 * h01(a + y), y); } }, ink, 1.6, 0.35);
    // Spalten mit Blindtext-Zeilen (Notizbereich ausgespart)
    const cols = [[22, 206], [224, 408]], n0 = NP.noteY - 48, n1 = NP.noteY + 3 * NP.noteLH;
    stk(g, (c) => { c.moveTo(215, 166); c.lineTo(215, n0 - 8); c.moveTo(215, n1 + 8); c.lineTo(215, h - 24); }, ink, 0.8, 0.4);
    stk(g, (c) => { for (const [a, b] of cols) { c.moveTo(a, 174); c.lineTo(a + (b - a) * 0.8, 174); c.moveTo(a, 184); c.lineTo(a + (b - a) * 0.55, 184); } }, ink, 3, 0.55);
    stk(g, (c) => {
      cols.forEach(([a, b], ci) => {
        let row = 0;
        for (let y = 204; y < h - 26; y += 14, row++) {
          if (y > n0 - 12 && y < n1 + 10) continue;
          if (ci === 1 && y > 486 && y < 612) continue;
          const last = row % 7 === 6; let x = a + (row % 7 === 0 ? 10 : 0); const end = last ? a + (b - a) * (0.3 + 0.4 * h01(y + ci)) : b;
          while (x < end - 8) { const wl = Math.min(end - x, 10 + 34 * h01(x * 0.37 + y * 1.3 + ci)); c.moveTo(x, y); c.lineTo(x + wl, y); x += wl + 6; }
        }
      });
    }, ink, 1.6, 0.34);
    // kleine Holzstich-Vignette: Plattform zwischen zwei Pfosten
    stk(g, (c) => { c.rect(236, 490, 160, 118); c.moveTo(270, 600); c.lineTo(270, 500); c.moveTo(362, 600); c.lineTo(362, 500); c.moveTo(262, 500); c.lineTo(370, 500); c.rect(282, 548, 68, 6); c.moveTo(282, 548); c.quadraticCurveTo(316, 530, 350, 548); c.moveTo(316, 538); c.lineTo(316, 500); }, ink, 1.2, 0.55);
    hatch(g, rectB(237, 491, 158, 116), 237, 491, 158, 116, 70, 4, COL.ink, 0.6, 0.18);
    fil(g, (c) => { c.arc(308, 516, 5, 0, TAU); c.rect(302, 522, 12, 24); }, ink, 0.55);
  }
  function newspaper(ctx, L, t, T, cfg) {
    const t0 = T.beat(0, 0.3), t1 = Math.max(t0 + 0.4, T.beat(1, Math.max(t0 + 0.9, 0.5 * T.d)));
    const ks = inv(t0, t0 + 0.7, t); if (ks <= 0) return;
    const k = easeOutBack(ks), sG = GA; GA = sG * clamp(ks * 3);
    ctx.save(); ctx.beginPath(); plateClip(ctx); ctx.clip();
    ctx.translate(NP.x + NP.w / 2 - (1 - k) * 560, NP.y + NP.h / 2); ctx.rotate(-2 * D2R); ctx.translate(-NP.w / 2, -NP.h / 2);
    fil(ctx, rectB(14, 16, NP.w, NP.h), "#000", 0.45);
    layer(ctx, "np_paper", -2, -2, NP.w + 4, NP.h + 4, 1, npPaper);
    if (cfg.paperLabel) txt(L, ctx, cfg.paperLabel, NP.w / 2, 140, { size: 28, weight: 700, font: L.FONT.head, letterSpacing: 6, color: COL.ink, align: "center", glow: 8, glowColor: "rgba(255,179,71,0.4)" });
    if (cfg.note) {
      let size = 27, lh = NP.noteLH, lines = L.wrap(ctx, "„" + cfg.note + "“", NP.w - 70, { size, weight: "italic 500" });
      if (lines.length > 3) { size = 23; lh = 33; lines = L.wrap(ctx, "„" + cfg.note + "“", NP.w - 60, { size, weight: "italic 500" }).slice(0, 4); }
      const hk = easeOut(inv(t1, t1 + 0.3, t));
      if (hk > 0) {
        fil(ctx, (c) => c.rect(20, NP.noteY - 36, NP.w - 40, lines.length * lh + 18), COL.ink, 0.09 * hk + 0.03 * hk * Math.sin(t * 3));
        stk(ctx, (c) => { c.moveTo(22, NP.noteY - 30); c.lineTo(14, NP.noteY - 30); c.lineTo(14, NP.noteY - 30 + (lines.length * lh + 6) * hk); c.lineTo(22, NP.noteY - 30 + (lines.length * lh + 6) * hk); }, COL.ink, 2.2, hk, 0.8);
      }
      lines.forEach((s, i) => {
        const y = NP.noteY + i * lh, w = meas(L, ctx, s, { size, weight: "italic 500" });
        txt(L, ctx, s, NP.w / 2, y, { size, weight: "italic 500", color: hk > 0.5 ? COL.white : COL.pale, align: "center", alpha: 0.9 });
        const ui = easeInOut(inv(t1 + 0.15 + i * 0.3, t1 + 0.55 + i * 0.3, t));
        if (ui > 0) stk(ctx, (c) => { c.moveTo(NP.w / 2 - w / 2, y + 10); c.lineTo(NP.w / 2 - w / 2 + w * ui, y + 10 + 1.5 * Math.sin(ui * 9)); }, COL.ink, 2.6, 1, 1);
      });
    }
    ctx.restore(); GA = sG;
  }

  // =====================================================================================
  // Szene 1b: otis_principle – Nahansicht Plattformkopf: Blattfeder hält die Sperrklinken eingezogen, solange das Seil
  // zieht; reißt es, streckt sich die Feder und die Klinken greifen beidseits in die Zahnstangen.
  // BEATS: [0] Seilzug-Pfeile/Status, [1] Seil reißt, [2] Klinken greifen (Plattform hängt), [3] Zahnstangen leuchten
  // =====================================================================================
  const OP = { cx: 960, fL: 652, fR: 1268, pitch: 46, depth: 26, per: 184, ycT: 446, tipOut: 706, tipIn: 658, pl: 96, rise: 15, yBreak: 226, bowT: 62, bowS: 15, yCut: 212 };
  OP.ph0 = PL.y - OP.per + 12; // Zahnoberkanten im Schienen-Sprite (bei Versatz 0)
  function opBg(g) {
    drawPlateFrame(g);
    g.save(); g.beginPath(); plateClip(g); g.clip();
    stk(g, (c) => { for (let y = PL.y + 8; y < PL.y + PL.h; y += 7) for (let x = PL.x; x < PL.x + PL.w; x += 96) if (h01(x * 0.7 + y * 1.3) < 0.42) { const o = h01(x + y) * 40; c.moveTo(x + o, y); c.lineTo(x + o + 30 + 40 * h01(y + x * 3), y); } }, COL.ink, 0.7, 0.1);
    stk(g, (c) => { for (const r of [300, 420, 540]) { c.moveTo(OP.cx + r, 1000); c.arc(OP.cx, 1000, r, 0, Math.PI, true); } }, COL.ink, 1, 0.12);
    stk(g, (c) => { for (let y = PL.y + 30; y < PL.y + PL.h - 10; y += 30) { c.moveTo(PL.x + 12, y); c.lineTo(PL.x + (y % 150 === 130 ? 30 : 20), y); } }, COL.ink, 1, 0.3);
    g.restore();
  }
  function opRails(g) {
    const P = OP, y1 = PL.y - P.per, y2 = PL.y + PL.h;
    const post = (x0, x1, shadeRight) => {
      fil(g, rectB(x0, y1, x1 - x0, y2 - y1), "#2b1a0a", 0.96);
      stk(g, (c) => { for (let k = 1; k < 5; k++) { const bx = x0 + (x1 - x0) * k / 5; c.moveTo(bx, y1); for (let y = y1; y <= y2; y += 8) c.lineTo(bx + Math.sin((y - y1) * TAU / P.per * (k % 2 ? 1 : 2) + k * 2.1) * 2.2, y); } }, COL.wood, 0.9, 0.5);
      hatch(g, rectB(shadeRight ? (x0 + x1) / 2 : x0, y1, (x1 - x0) / 2, y2 - y1), x0, y1, x1 - x0, y2 - y1, 90, 3.4, COL.deep, 0.8, 0.7);
      stk(g, (c) => { for (let y = y1 + 70; y < y2; y += P.per) { const m = (x0 + x1) / 2; c.moveTo(m + 9, y); c.ellipse(m, y, 9, 4.5, 0, 0, TAU); c.moveTo(m + 16, y); c.ellipse(m, y, 16, 9, 0, 0, TAU); } }, COL.wood, 1, 0.45);
      stk(g, (c) => c.rect(x0, y1, x1 - x0, y2 - y1), COL.wood, 2, 0.95, 0.5);
    };
    const bar = (x0, x1, face, side) => {
      fil(g, rectB(x0, y1, x1 - x0, y2 - y1), "#1a1410", 1);
      const tb = teethB(face, y1, y2, P.pitch, P.depth, side, P.ph0);
      fil(g, (c) => { tb(c); c.lineTo(face, y2); c.closePath(); }, "#3a3026", 1);
      stk(g, (c) => { for (let y = P.ph0; y < y2; y += P.pitch) { c.moveTo(face + side * 4, y + 6); c.lineTo(face + side * (P.depth - 4), y + 6); c.lineTo(face + side * 4, y + P.pitch - 6); } }, COL.pale, 0.8, 0.3);
      stk(g, (c) => tb(c), COL.pale, 1.7, 0.95, 0.4);
      stk(g, (c) => c.rect(x0, y1, x1 - x0, y2 - y1), COL.pale, 1.1, 0.6);
      stk(g, (c) => { for (let y = P.ph0; y < y2; y += P.pitch) { c.moveTo(face, y); c.lineTo(face + side * P.depth, y); } }, COL.cyan, 1.5, 0.5);
      fil(g, (c) => { for (let y = y1 + 23; y < y2; y += P.pitch * 2) { const m = (x0 + x1) / 2; c.moveTo(m + 3, y); c.arc(m, y, 3, 0, TAU); } }, COL.pale, 0.7);
    };
    post(560, 628, true); bar(628, P.fL, P.fL, 1);
    post(1292, 1360, false); bar(P.fR, 1292, P.fR, -1);
  }
  function opBody(g) {
    const y = OP.ycT;
    const wood = (x, yy, w, h, ang) => { const b = rectB(x, yy, w, h); fil(g, b, "#2b1a0a", 0.97); hatch(g, b, x, yy, w, h, ang, 4, COL.wood, 0.7, 0.5); stk(g, b, COL.wood, 1.8, 0.95, 0.4); };
    // Führungsschuhe (umgreifen die Schienen, liegen davor)
    for (const yy of [y + 46, y + 326]) for (const [a, b] of [[548, 708], [1212, 1372]]) { fil(g, rectB(a, yy, b - a, 18), "#1c1712", 0.9); stk(g, rectB(a, yy, b - a, 18), COL.pale, 1.4, 0.8); fil(g, (c) => { c.arc(a + 12, yy + 9, 2.5, 0, TAU); c.moveTo(b - 9, yy + 9); c.arc(b - 12, yy + 9, 2.5, 0, TAU); }, COL.pale, 0.8); }
    wood(706, y + 30, 26, 330, 90); wood(1188, y + 30, 26, 330, 90);
    stk(g, (c) => { c.moveTo(732, y + 240); c.lineTo(840, y + 360); c.moveTo(1188, y + 240); c.lineTo(1080, y + 360); }, COL.wood, 3.4, 0.85, 0.3);
    wood(694, y + 360, 532, 22, 0);
    stk(g, (c) => { for (let x = 714; x < 1226; x += 28) { c.moveTo(x, y + 360); c.lineTo(x, y + 382); } }, COL.wood, 0.9, 0.5);
    wood(690, y, 540, 30, 0);
    // Last: Kisten + Fass (Otis führte die Plattform beladen vor)
    const fy = y + 360;
    const crate = (x, w, h) => { const b = rectB(x, fy - h, w, h); fil(g, b, "#241a0e", 1); hatch(g, b, x, fy - h, w, h, 0, 5, COL.wood, 0.6, 0.35); stk(g, (c) => { c.rect(x, fy - h, w, h); c.moveTo(x, fy - h); c.lineTo(x + w, fy); c.moveTo(x + w, fy - h); c.lineTo(x, fy); c.rect(x + 5, fy - h + 5, w - 10, h - 10); }, COL.wood, 1.4, 0.8); };
    crate(752, 104, 92); crate(770, 70, 52); crate(1064, 112, 118);
    const barrel = (c) => { c.moveTo(884, fy); c.quadraticCurveTo(874, fy - 40, 884, fy - 80); c.lineTo(944, fy - 80); c.quadraticCurveTo(954, fy - 40, 944, fy); c.closePath(); };
    fil(g, barrel, "#241a0e", 1); hatch(g, barrel, 874, fy - 80, 80, 80, 90, 6, COL.wood, 0.6, 0.4); stk(g, barrel, COL.wood, 1.5, 0.9);
    stk(g, (c) => { for (const k of [14, 40, 66]) { c.moveTo(879, fy - k); c.lineTo(949, fy - k); } }, COL.pale, 1.4, 0.7);
  }
  function opTimes(T) {
    const d = T.d, tA = T.beat(0, Math.min(0.5, 0.1 * d)), tB = T.beat(1, Math.max(tA + 0.8, 0.48 * d));
    const tE = Math.max(tB + 0.18, Math.min(tB + 1.2, T.beat(2, tB + 0.34)));
    return { tA, tB, tE, tR: Math.max(tE, T.beat(3, tE + 0.5)) };
  }
  function opState(t, TT) {
    const P = OP, broke = t >= TT.tB, dtB = t - TT.tB;
    const travel = P.rise * Math.min(t, TT.tB), off = ((travel % P.per) + P.per) % P.per, phase = P.ph0 + off;
    const y0 = P.ycT - 2, want = y0 + 10, drop = want + ((((phase - want) % P.pitch) + P.pitch) % P.pitch) - y0;
    let yc = P.ycT + (broke ? 0 : Math.sin(t * 2.3) * 0.6), caught = false, da = 0;
    if (broke) {
      if (t < TT.tE) { const kf = clamp(dtB / (TT.tE - TT.tB)); yc = P.ycT + drop * kf * kf; }
      else { da = t - TT.tE; caught = true; yc = P.ycT + drop - 4 * Math.abs(Math.sin(da * 18)) * Math.exp(-da * 8); }
    }
    const tipT = broke ? lerp(P.tipOut, P.tipIn, easeOutBack(clamp((dtB - 0.02) / 0.14))) : P.tipOut;
    const tip = broke ? Math.max(tipT, Math.min(P.tipOut, slopeX(P.fL, yc - 2, P.pitch, P.depth, 1, phase))) : tipT;
    const ext = clamp((P.tipOut - tip) / (P.tipOut - P.tipIn));
    const bow = lerp(P.bowT, P.bowS, ext) + (broke ? 0 : Math.sin(t * 2.3) * 0.8);
    const S = { yc, tip, bow, ext, broke, dtB, caught, da, off, phase, drop, travel };
    S.ys = yc - 15; S.hw = P.cx - (tip + P.pl - 8); S.apex = S.ys - bow;
    return S;
  }
  function opSpringPts(S, k) {
    const x0 = OP.cx - S.hw, x1 = OP.cx + S.hw, cy = S.ys - 2 * S.bow, Lk = [1, 0.8, 0.6, 0.42][k], a = 0.5 - Lk / 2, b = 0.5 + Lk / 2, pts = [];
    for (let i = 0; i <= 16; i++) { const u = lerp(a, b, i / 16), m = 1 - u; pts.push([m * m * x0 + 2 * m * u * OP.cx + u * u * x1, m * m * S.ys + 2 * m * u * cy + u * u * S.ys + k * 4.6]); }
    return pts;
  }
  function opMech(ctx, S, t, TT) {
    const P = OP, yc = S.yc, mir = (x) => 2 * P.cx - x;
    // Sperrklinken (Eisen) auf dem Querhaupt
    for (const side of [1, -1]) {
      const X = (x) => (side > 0 ? x : mir(x)), tp = S.tip;
      const pts = [[X(tp), yc - 2], [X(tp), yc - 18], [X(tp + 12), yc - 28], [X(tp + P.pl), yc - 28], [X(tp + P.pl), yc - 2]];
      fil(ctx, polyB(pts, true), "#5a3a14", 1); hatch(ctx, polyB(pts, true), Math.min(X(tp), X(tp + P.pl)), yc - 28, P.pl, 26, 45, 5, COL.ink, 0.6, 0.35);
      stk(ctx, polyB(pts, true), COL.ink, 1.8, 1, 0.6);
      if (S.caught) stk(ctx, (c) => { c.moveTo(X(tp), yc - 2); c.lineTo(X(tp + 18), yc - 2); }, COL.cyan, 2.2, 0.6 + 0.4 * Math.sin(S.da * 5), 1);
      const gx = side > 0 ? 716 : 1180;
      fil(ctx, rectB(gx, yc - 34, 24, 34), "#1c1712", 1); stk(ctx, rectB(gx, yc - 34, 24, 34), COL.pale, 1.4, 0.9);
      fil(ctx, (c) => { c.arc(gx + 12, yc - 30, 2.2, 0, TAU); }, COL.pale, 0.9);
    }
    // Blattfeder (gestufte Lagen) + Bolzen an den Klinken
    const bright = 0.75 + 0.25 * S.ext;
    for (let k = 3; k >= 0; k--) stk(ctx, polyB(opSpringPts(S, k)), k === 0 ? COL.ink : COL.sepia, k === 0 ? 5 : 3.8, bright, k === 0 ? 1 : 0.3);
    stk(ctx, (c) => { for (const k of [0.3, 0.5, 0.7]) { const q = opSpringPts(S, 0)[Math.round(16 * k)]; c.moveTo(q[0], q[1] - 3); c.lineTo(q[0], q[1] + 16); } }, COL.pale, 1.2, 0.6);
    for (const x of [P.cx - S.hw, P.cx + S.hw]) { fil(ctx, (c) => c.arc(x, S.ys, 6.5, 0, TAU), "#1c1712", 1); stk(ctx, (c) => c.arc(x, S.ys, 6.5, 0, TAU), COL.pale, 1.6, 1); fil(ctx, (c) => c.arc(x, S.ys, 2, 0, TAU), COL.pale, 1); }
    fil(ctx, rectB(P.cx - 14, S.apex - 5, 28, 24), "#1c1712", 1); stk(ctx, rectB(P.cx - 14, S.apex - 5, 28, 24), COL.pale, 1.5, 1);
    stk(ctx, (c) => c.ellipse(P.cx, S.apex - 16, 9, 13, 0, 0, TAU), COL.pale, 2.4, 1);
  }
  function opRope(ctx, S, t, TT) {
    const P = OP, cx = P.cx, top = PL.y, s0 = S.apex - 28;
    if (!S.broke) {
      rope(ctx, (c) => { c.moveTo(cx, s0); c.lineTo(cx, top); }, COL.pale, 5, 0.95, 0);
      const fa = inv(TT.tA, TT.tA + 0.5, t);
      if (fa > 0) stk(ctx, (c) => { c.moveTo(cx, s0 - 12); c.lineTo(cx, top); }, COL.cyan, 2.2, 0.85 * fa, 1, [10, 16], t * 70);
      return;
    }
    const dt = S.dtB, k = easeOut(clamp(dt / 0.45)), yb = P.yBreak;
    const yu = yb - 460 * k, wu = 30 * Math.sin(dt * 14) * Math.exp(-dt * 4);
    if (yu > top - 30) rope(ctx, (c) => { c.moveTo(cx, top - 10); c.quadraticCurveTo(cx + wu, (top + yu) / 2, cx + wu * 0.5, yu); }, COL.pale, 5, 0.95, 0);
    const kl = easeIn(clamp(dt / 0.6)), ex = cx + 170 * easeOut(clamp(dt / 0.6)), ey = lerp(yb, S.yc - 44, kl) + 6 * Math.sin(dt * 10) * Math.exp(-dt * 3);
    rope(ctx, (c) => { c.moveTo(cx, s0); c.quadraticCurveTo(cx + 40 * kl, lerp(yb + 60, s0 - 90, kl), ex, ey); }, COL.pale, 5, 0.95, 0);
    stk(ctx, (c) => { for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.45; c.moveTo(ex, ey); c.lineTo(ex + Math.cos(a) * 12, ey + Math.sin(a) * 12); if (yu > top) { const b = a + Math.PI / 2; c.moveTo(cx + wu * 0.5, yu); c.lineTo(cx + wu * 0.5 + Math.cos(b) * 11, yu + Math.sin(b) * 11); } } }, COL.red, 2, 1, 0.6);
    if (dt < 1.1) { const f = Math.exp(-dt * 5); dot(ctx, cx, yb, 30 + 50 * (1 - f), COL.red, 0.9 * f); stk(ctx, (c) => c.arc(cx, yb, 12 + 80 * easeOut(dt / 0.5), 0, TAU), COL.red, 2, 0.8 * f); }
  }
  function arrowLn(ctx, x1, y1, x2, y2, color, w, alpha, glow = 0.6) {
    if (alpha <= 0.004) return; const a = Math.atan2(y2 - y1, x2 - x1);
    stk(ctx, (c) => { c.moveTo(x1, y1); c.lineTo(x2 - Math.cos(a) * 8, y2 - Math.sin(a) * 8); }, color, w, alpha, glow);
    arrowHead(ctx, x2, y2, a, 8 + w * 2.4, color, alpha);
  }
  function chip(ctx, L, cx, cy, text, color, alpha) {
    if (alpha <= 0.004 || !text) return;
    const o = { size: 19, weight: 700, font: L.FONT.head, letterSpacing: 1.5 }, w = meas(L, ctx, text, o) + 30;
    fil(ctx, (c) => rr(c, cx - w / 2, cy - 18, w, 36, 4), "rgb(8,8,12)", 0.9 * alpha);
    stk(ctx, (c) => rr(c, cx - w / 2, cy - 18, w, 36, 4), color, 1.4, 0.85 * alpha, 0.5);
    txt(L, ctx, text, cx, cy + 7, Object.assign({ color, align: "center", alpha }, o));
  }
  function drawPrinciple(ctx, p, cfg, T) {
    const { L, t } = p, P = OP, TT = opTimes(T), S = opState(t, TT);
    layer(ctx, "op_bg", PL.x - 12, PL.y - 12, PL.w + 24, PL.h + 24, 1, opBg);
    ctx.save(); ctx.beginPath(); plateClip(ctx); ctx.clip();
    const zz = (c, x0, x1, y, amp) => { const n = 4, w = (x1 - x0) / n; for (let i = 0; i < n; i++) { c.lineTo(x0 + w * (i + 0.25), y - amp); c.lineTo(x0 + w * (i + 0.75), y + amp); } c.lineTo(x1, y); };
    ctx.save(); ctx.beginPath(); ctx.moveTo(PL.x, PL.y + PL.h); ctx.lineTo(PL.x, P.yCut); ctx.lineTo(540, P.yCut); zz(ctx, 540, 712, P.yCut, 9); ctx.lineTo(1208, P.yCut); zz(ctx, 1208, 1380, P.yCut, 9); ctx.lineTo(PL.x + PL.w, P.yCut); ctx.lineTo(PL.x + PL.w, PL.y + PL.h); ctx.closePath(); ctx.clip();
    ctx.translate(0, S.off); layer(ctx, "op_rails", 540, PL.y - P.per, 840, PL.h + P.per, 1, opRails); ctx.restore();
    stk(ctx, (c) => { c.moveTo(546, P.yCut); zz(c, 546, 706, P.yCut, 9); c.moveTo(1214, P.yCut); zz(c, 1214, 1374, P.yCut, 9); }, COL.pale, 1.6, 0.85, 0.4);
    // Zahnstangen beidseits hervorheben (BEAT [3])
    const kr = easeOut(inv(TT.tR, TT.tR + 0.5, t));
    if (kr > 0) {
      const ya = Math.max(P.yCut + 14, S.yc - 300), yb = Math.min(PL.y + PL.h, S.yc + 380), pu = 0.75 + 0.25 * Math.sin(t * 3.2);
      stk(ctx, (c) => { teethB(P.fL, ya, yb, P.pitch, P.depth, 1, S.phase)(c); teethB(P.fR, ya, yb, P.pitch, P.depth, -1, S.phase)(c); }, COL.ink, 2.4, kr * pu, 1.4);
    }
    // Plattform (Querhaupt, Stiele, Boden, Last) folgt yc
    ctx.save(); ctx.translate(0, S.yc - P.ycT); layer(ctx, "op_body", 540, P.ycT - 10, 840, 420, 1, opBody); ctx.restore();
    opMech(ctx, S, t, TT);
    opRope(ctx, S, t, TT);
    // Kräfte: Seilzug (cyan) solange gespannt; Federkraft nach außen (amber) nach dem Riss
    const ka = inv(TT.tA, TT.tA + 0.5, t) * (1 - inv(TT.tB, TT.tB + 0.2, t));
    if (ka > 0) {
      arrowLn(ctx, P.cx - 42, 330, P.cx - 42, 226 - 6 * Math.sin(t * 4), COL.cyan, 3, ka);
      for (const side of [1, -1]) { const xe = P.cx - side * S.hw; arrowLn(ctx, xe - side * 8, S.ys - 34, xe + side * 40, S.ys - 34, COL.cyan, 2.4, 0.8 * ka); }
      // Spiel zwischen Klinke und Zähnen
      for (const side of [1, -1]) { const a = side > 0 ? P.fL + P.depth : P.fR - P.depth, b = side > 0 ? S.tip : 2 * P.cx - S.tip; stk(ctx, (c) => { c.moveTo(a, S.yc - 40); c.lineTo(a, S.yc - 50); c.moveTo(b, S.yc - 40); c.lineTo(b, S.yc - 50); c.moveTo(a, S.yc - 45); c.lineTo(b, S.yc - 45); }, COL.cyan, 1.3, 0.8 * ka); }
    }
    const kf = inv(TT.tB + 0.02, TT.tB + 0.2, t);
    if (kf > 0) {
      const fa = kf * (0.55 + 0.45 * Math.exp(-Math.max(0, t - TT.tE) * 1.2)) * (0.85 + 0.15 * Math.sin(t * 4));
      for (const side of [1, -1]) { const x0 = side > 0 ? S.tip + 78 : 2 * P.cx - S.tip - 78; arrowLn(ctx, x0, S.yc - 50, x0 - side * 66, S.yc - 50, COL.ink, 3.2, fa, 0.9); }
    }
    if (S.caught) {
      const f = Math.exp(-S.da * 4.5);
      for (const [x, side] of [[S.tip, 1], [2 * P.cx - S.tip, -1]]) {
        dot(ctx, x, S.yc - 2, 22 + 26 * (1 - f), COL.ink, 0.85 * f + 0.3 * (0.5 + 0.5 * Math.sin(t * 4)));
        if (S.da < 0.6) stk(ctx, (c) => { for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 - side * (0.2 + i * 0.28), r0 = 12 + 56 * easeOut(S.da / 0.5); c.moveTo(x + Math.cos(a) * r0, S.yc + Math.sin(a) * r0); c.lineTo(x + Math.cos(a) * (r0 + 12), S.yc + Math.sin(a) * (r0 + 12)); } }, COL.pale, 1.8, f);
      }
    }
    ctx.restore();
    // Status + Kopfzeile + Beschriftungen
    if (cfg.status) {
      const st = S.caught ? ["SPERRE GREIFT · PLATTFORM HÄLT", COL.ink] : S.broke ? ["SEIL REISST · FEDER STRECKT SICH", COL.red] : ["SEIL ZIEHT · SPERRE GELÖST", COL.cyan];
      chip(ctx, L, 1575, 452, st[0], st[1], easeOut(inv(TT.tA, TT.tA + 0.5, t)));
    }
    const hdr = drawHeader(ctx, L, t, T, cfg, { title: "FANGVORRICHTUNG", sub: "Prinzip nach Otis · Schema", size: 30, subSize: 20 }, cfg.ov);
    const A = {
      spring: { re: /feder|blatt/, def: TT.tA + 0.6, g: () => { const q = opSpringPts(S, 0)[4]; return { tx: q[0], ty: q[1], bx: 520, by: 318, align: "right" }; } },
      rack: { re: /zahn|stange|leiste|ratsche|rack|schiene/, def: TT.tR, g: () => ({ tx: P.fL + 14, ty: S.yc + 196, t2: [P.fR - 14, S.yc + 196], bx: P.cx, by: S.yc + 176, align: "center" }) },
      pawl: { re: /klinke|sperr|riegel|pawl|fang/, def: TT.tA + 1.0, g: () => ({ tx: S.tip + 40, ty: S.yc - 15, bx: 520, by: 470, align: "right" }) },
      rope: { re: /seil|zug|rope/, def: TT.tA + 0.2, g: () => (S.broke ? { tx: P.cx + 6, ty: S.apex - 46, bx: 1010, by: 250 } : { tx: P.cx, ty: 290, bx: 1010, by: 250 }) },
      platform: { re: /plattform|fahrkorb|kabine|last|korb/, g: () => ({ tx: 1150, ty: S.yc + 300, bx: 1420, by: 760 }) },
    };
    const defs = [{ key: "rope", text: "Tragseil", def: TT.tA + 0.2 }, { key: "spring", text: "Blattfeder", def: TT.tA + 0.6 }, { key: "pawl", text: "Sperrklinke", def: TT.tA + 1.0 }, { key: "rack", text: "Zahnstangen beidseits", def: TT.tR }];
    drawLabels(ctx, L, t, T, resolveLabels(cfg.items, A, ["spring", "rack", "pawl", "rope", "platform"], defs, TT.tA + 0.2, 0.45), A, hdr);
  }

  // =====================================================================================
  // Szene 2: E. V. Haughwout Building, New York 1857 – gusseiserne Palazzo-Fassade, Feld aufgeschnitten
  // =====================================================================================
  const HW = { x0: 290, x1: 1260, ground: 858, fl: [858, 712, 600, 488, 376, 264], corn: 214, bays: 7, cut: 5 };
  HW.bw = (HW.x1 - HW.x0) / HW.bays; HW.cx0 = HW.x0 + HW.cut * HW.bw; HW.cx1 = HW.cx0 + HW.bw;
  HW.wl = HW.cx0 + 10; HW.wr = HW.cx1 - 10; HW.railL = HW.cx0 + 19; HW.railR = HW.cx1 - 42; HW.carX0 = HW.railL + 8; HW.carX1 = HW.railR - 8;
  HW.carC = (HW.carX0 + HW.carX1) / 2; HW.retX = HW.cx1 - 26; HW.shR = (HW.retX - HW.carC) / 2; HW.shX = HW.carC + HW.shR; HW.shY = 244;
  let HW_WIN = null;
  function hwWindows() {
    if (HW_WIN) return HW_WIN;
    const P = typeof Path2D !== "undefined" ? new Path2D() : null; if (!P) return null;
    for (let f = 0; f < 5; f++) for (let b = 0; b < HW.bays; b++) { if (b === HW.cut) continue; const w = hwWin(f, b); P.moveTo(w.x0, w.yb); P.lineTo(w.x0, w.ys); P.arc((w.x0 + w.x1) / 2, w.ys, (w.x1 - w.x0) / 2, Math.PI, TAU); P.lineTo(w.x1, w.yb); P.closePath(); }
    HW_WIN = P; return P;
  }
  function hwWin(f, b) {
    const top = HW.fl[f + 1], bot = HW.fl[f], x0 = HW.x0 + b * HW.bw, g = f === 0 ? 0.2 : 0.26;
    const wx0 = x0 + HW.bw * g, wx1 = x0 + HW.bw * (1 - g), r = (wx1 - wx0) / 2;
    const yb = f === 0 ? bot - 4 : bot - 22, ys = top + 14 + r + (f === 0 ? 6 : 0);
    return { x0: wx0, x1: wx1, yb, ys, r, bx0: x0, top, bot };
  }
  function hwFacade(g) {
    drawPlateFrame(g);
    g.save(); g.beginPath(); plateClip(g); g.clip();
    const ink = COL.ink, A = 0.9;
    // Himmel (waagerechte Stichlagen) + Nachbarbauten
    stk(g, (c) => { for (let y = PL.y + 6; y < 560; y += 7) { const k = (y - PL.y) / 460; for (let x = PL.x; x < PL.x + PL.w; x += 90) { const l = 30 + 50 * h01(x * 0.3 + y); if (h01(x + y * 1.3) < 0.75 - k * 0.5) { c.moveTo(x + h01(y) * 30, y); c.lineTo(x + h01(y) * 30 + l, y); } } } }, ink, 0.7, 0.16);
    for (const [x0, x1, top] of [[PL.x, 270, 420], [1280, PL.x + PL.w, 520]]) {
      const b = rectB(x0, top, x1 - x0, HW.ground - top);
      fil(g, b, "#1a1208", 0.85); hatch(g, b, x0, top, x1 - x0, HW.ground - top, 90, 5, ink, 0.6, 0.14);
      stk(g, (c) => { c.rect(x0, top, x1 - x0, HW.ground - top); for (let y = top + 36; y < HW.ground - 60; y += 86) for (let x = x0 + 26; x < x1 - 40; x += 70) c.rect(x, y, 30, 50); }, ink, 1, 0.3);
      stk(g, (c) => { c.moveTo(x0, top - 8); c.lineTo(x1, top - 8); c.moveTo(x0, top); c.lineTo(x1, top); }, ink, 1.2, 0.35);
    }
    // Fassadengrund
    const fac = rectB(HW.x0, HW.corn, HW.x1 - HW.x0, HW.ground - HW.corn);
    fil(g, fac, "#22170b", 0.96);
    hatch(g, fac, HW.x0, HW.corn, HW.x1 - HW.x0, HW.ground - HW.corn, 0, 4, ink, 0.6, 0.18);
    // Geschosse
    for (let f = 0; f < 5; f++) {
      const top = HW.fl[f + 1], bot = HW.fl[f];
      for (let b = 0; b < HW.bays; b++) {
        const w = hwWin(f, b), cxw = (w.x0 + w.x1) / 2;
        const win = (c) => { c.moveTo(w.x0, w.yb); c.lineTo(w.x0, w.ys); c.arc(cxw, w.ys, w.r, Math.PI, TAU); c.lineTo(w.x1, w.yb); c.closePath(); };
        fil(g, win, "#0b0806", 0.95);
        hatch(g, win, w.x0, w.ys - w.r, w.x1 - w.x0, w.yb - w.ys + w.r, 58, 3.4, ink, 0.6, 0.3);
        stk(g, (c) => { c.moveTo(cxw, w.ys - w.r); c.lineTo(cxw, w.yb); for (let y = w.ys + 26; y < w.yb - 6; y += 30) { c.moveTo(w.x0, y); c.lineTo(w.x1, y); } }, ink, 0.8, 0.5);
        stk(g, win, COL.pale, 1.3, A);
        // Archivolte + Schlussstein, kleine Säulchen
        stk(g, (c) => { c.arc(cxw, w.ys, w.r + 6, Math.PI, TAU); c.moveTo(w.x0 - 6, w.ys); c.lineTo(w.x0 - 6, w.yb); c.moveTo(w.x1 + 6, w.ys); c.lineTo(w.x1 + 6, w.yb); c.moveTo(w.x0 - 10, w.ys); c.lineTo(w.x0 - 2, w.ys); c.moveTo(w.x1 + 2, w.ys); c.lineTo(w.x1 + 10, w.ys); }, ink, 1, 0.75);
        fil(g, (c) => c.rect(cxw - 5, w.ys - w.r - 10, 10, 12), ink, 0.55);
        // Brüstung mit Balustern
        if (f > 0) stk(g, (c) => { const y0 = bot - 20, y1 = bot - 4; c.moveTo(w.bx0 + 8, y0); c.lineTo(w.bx0 + HW.bw - 8, y0); c.moveTo(w.bx0 + 8, y1); c.lineTo(w.bx0 + HW.bw - 8, y1); for (let x = w.bx0 + 14; x < w.bx0 + HW.bw - 10; x += 8) { c.moveTo(x, y0 + 2); c.quadraticCurveTo(x + 3, (y0 + y1) / 2, x, y1); } }, ink, 0.8, 0.6);
      }
      // Pilaster/Säulen an Feldgrenzen mit Kapitell
      for (let b = 0; b <= HW.bays; b++) {
        const x = HW.x0 + b * HW.bw, cw = f === 0 ? 11 : 8;
        const col = rectB(x - cw, top + 8, cw * 2, bot - top - 8);
        fil(g, col, "#2a1d0f", 1); hatch(g, rectB(x, top + 8, cw, bot - top - 8), x, top + 8, cw, bot - top - 8, 90, 2.4, ink, 0.6, 0.45);
        stk(g, col, COL.pale, 1.1, 0.85);
        stk(g, (c) => { c.moveTo(x - cw - 5, top + 12); c.lineTo(x + cw + 5, top + 12); c.moveTo(x - cw - 3, top + 18); c.quadraticCurveTo(x, top + 26, x + cw + 3, top + 18); c.moveTo(x - cw - 4, bot - 4); c.lineTo(x + cw + 4, bot - 4); }, COL.pale, 1, 0.8);
      }
      // Gesims je Geschoss mit Zahnschnitt
      stk(g, (c) => { c.moveTo(HW.x0 - 8, top); c.lineTo(HW.x1 + 8, top); c.moveTo(HW.x0 - 6, top + 7); c.lineTo(HW.x1 + 6, top + 7); }, COL.pale, 1.3, 0.9);
      fil(g, (c) => { for (let x = HW.x0; x < HW.x1; x += 9) c.rect(x, top + 8, 5, 4); }, ink, 0.5);
    }
    // Hauptgesims mit Konsolen
    const cor = rectB(HW.x0 - 16, HW.corn, HW.x1 - HW.x0 + 32, 26);
    fil(g, cor, "#2a1d0f", 1); hatch(g, cor, HW.x0 - 16, HW.corn, HW.x1 - HW.x0 + 32, 26, 0, 3, ink, 0.6, 0.5); stk(g, cor, COL.pale, 1.4, 0.95);
    stk(g, (c) => { for (let x = HW.x0; x <= HW.x1; x += 24) { c.moveTo(x, HW.corn + 26); c.lineTo(x, HW.corn + 40); c.quadraticCurveTo(x + 8, HW.corn + 40, x + 8, HW.corn + 30); } }, ink, 1, 0.7);
    // Sockel, Gehweg, Straße
    stk(g, (c) => { c.moveTo(PL.x, HW.ground); c.lineTo(PL.x + PL.w, HW.ground); c.moveTo(PL.x, HW.ground + 12); c.lineTo(PL.x + PL.w, HW.ground + 12); for (let x = PL.x; x < PL.x + PL.w; x += 40) { c.moveTo(x, HW.ground); c.lineTo(x - 6, HW.ground + 12); } }, ink, 1, 0.55);
    hatch(g, rectB(PL.x, HW.ground + 12, PL.w, 30), PL.x, HW.ground + 12, PL.w, 30, 0, 4, ink, 0.6, 0.22);
    // Gaslaternen
    for (const lx of [230, 1320]) {
      stk(g, (c) => { c.moveTo(lx, HW.ground); c.lineTo(lx, 742); c.moveTo(lx - 8, 742); c.lineTo(lx + 8, 742); c.moveTo(lx - 8, 742); c.lineTo(lx - 11, 718); c.lineTo(lx + 11, 718); c.lineTo(lx + 8, 742); c.moveTo(lx - 11, 718); c.lineTo(lx, 708); c.lineTo(lx + 11, 718); }, COL.pale, 1.5, 0.8);
    }
    g.restore();
  }

  function hwInterior(ctx, L, t, carBot, travel, moving) {
    const H = HW, x0 = H.cx0, x1 = H.cx1, yTop = H.corn - 12, yBot = PL.y + PL.h;
    fil(ctx, rectB(x0, yTop, x1 - x0, yBot - yTop), "#090604", 1);
    // Rückwand (Mauerwerk)
    stk(ctx, (c) => { for (let y = yTop + 6, r = 0; y < H.ground; y += 10, r++) { c.moveTo(H.wl, y); c.lineTo(H.wr, y); for (let x = H.wl + (r % 2 ? 10 : 0); x < H.wr; x += 20) { c.moveTo(x, y); c.lineTo(x, y + 10); } } }, COL.ink, 0.6, 0.13);
    // Geschossdecken im Schnitt + Schachttüren (Scherengitter)
    for (let i = 0; i < H.fl.length; i++) {
      const y = H.fl[i];
      for (const [a, b] of [[x0, H.wl], [H.wr, x1]]) { const r = rectB(a, y - 6, b - a, 12); fil(ctx, r, "#2a1d0f", 1); hatch(ctx, r, a, y - 6, b - a, 12, 45, 3, COL.pale, 0.7, 0.8); stk(ctx, r, COL.pale, 1, 0.8); }
      if (i < 5) stk(ctx, (c) => { c.moveTo(H.wl, y); c.lineTo(H.wr, y); const gy = y - 62; for (let x = H.wl + 4; x < H.wr - 8; x += 12) { c.moveTo(x, y - 2); c.lineTo(x + 12, gy); c.moveTo(x + 12, y - 2); c.lineTo(x, gy); } c.moveTo(H.wl, gy); c.lineTo(H.wr, gy); }, COL.ink, 0.7, 0.22);
    }
    stk(ctx, (c) => { c.moveTo(H.wl, yTop); c.lineTo(H.wl, yBot); c.moveTo(H.wr, yTop); c.lineTo(H.wr, yBot); }, COL.pale, 1.4, 0.8);
    // Führungsschienen mit Sperrzähnen
    const rTop = H.shY + 10, rBot = H.ground;
    fil(ctx, (c) => { c.rect(H.railL - 7, rTop, 7, rBot - rTop); c.rect(H.railR, rTop, 7, rBot - rTop); }, "#1c1712", 1);
    stk(ctx, (c) => { c.rect(H.railL - 7, rTop, 7, rBot - rTop); c.rect(H.railR, rTop, 7, rBot - rTop); }, COL.pale, 1.1, 0.85);
    stk(ctx, (c) => { teethB(H.railL, rTop, rBot, 10, 5, 1, 300)(c); teethB(H.railR, rTop, rBot, 10, 5, -1, 300)(c); }, COL.cyan, 1, 0.6, 0.3);
    // Seilrolle + Seil
    const ct = carBot - 86, chY = ct - 30;
    pulley(ctx, H.shX, H.shY, H.shR, -travel / H.shR, COL.pale);
    stk(ctx, (c) => { c.moveTo(H.shX - 16, H.shY); c.lineTo(H.shX - 10, yTop + 4); c.moveTo(H.shX + 16, H.shY); c.lineTo(H.shX + 10, yTop + 4); c.moveTo(H.shX - 26, yTop + 4); c.lineTo(H.shX + 26, yTop + 4); }, COL.pale, 2, 0.8);
    rope(ctx, (c) => { c.moveTo(H.carC, chY - 8); c.lineTo(H.carC, H.shY); c.arc(H.shX, H.shY, H.shR, Math.PI, TAU); c.lineTo(H.retX, yBot); }, COL.pale, 2.6, 0.95, travel);
    // Fahrkorb (1857: offener Käfig mit Zierdach)
    const cx0 = H.carX0, cx1 = H.carX1, cw = cx1 - cx0;
    const cage = rectB(cx0, ct, cw, 86);
    fil(ctx, cage, "#1b1209", 0.92);
    hatch(ctx, cage, cx0, ct, cw, 86, 45, 9, COL.ink, 0.7, 0.35); hatch(ctx, cage, cx0, ct, cw, 86, -45, 9, COL.ink, 0.7, 0.35);
    figure(ctx, L, cx0 + cw * 0.34, carBot - 4, 58, COL.pale, 0.55, { hat: "top" });
    figure(ctx, L, cx0 + cw * 0.68, carBot - 4, 54, COL.pale, 0.5, { dress: true });
    stk(ctx, cage, COL.ink, 2, 1, 0.8);
    stk(ctx, (c) => { c.moveTo(cx0 - 4, ct); c.quadraticCurveTo(H.carC, ct - 18, cx1 + 4, ct); c.moveTo(H.carC, ct - 9); c.lineTo(H.carC, ct - 16); c.rect(cx0 - 3, carBot - 6, cw + 6, 6); }, COL.ink, 1.6, 1, 0.5);
    // Querhaupt mit Wagenfeder + Klinken
    stk(ctx, (c) => { c.rect(cx0 - 4, chY, cw + 8, 7); c.moveTo(cx0, chY + 7); c.lineTo(cx0, ct); c.moveTo(cx1, chY + 7); c.lineTo(cx1, ct); c.moveTo(cx0 + 6, chY - 2); c.quadraticCurveTo(H.carC, chY - 20, cx1 - 6, chY - 2); }, COL.pale, 1.5, 0.95, 0.4);
    fil(ctx, (c) => { c.rect(H.railL + 1, chY - 1, 9, 5); c.rect(H.railR - 10, chY - 1, 9, 5); }, COL.pale, 0.95);
  }

  function hwSpeed(ctx, L, carBot, moving, shown, text) {
    if (shown <= 0.01 || !text) return;
    const x0 = HW.cx0, ly = carBot - 44, w = meas(L, ctx, text, { size: 19, weight: 700, font: L.FONT.mono }) + 26;
    fil(ctx, (c) => rr(c, x0 - 24 - w, ly - 17, w, 32, 4), "rgb(8,8,12)", 0.86 * shown);
    stk(ctx, (c) => rr(c, x0 - 24 - w, ly - 17, w, 32, 4), COL.cyan, 1.2, 0.8 * shown);
    txt(L, ctx, text, x0 - 24 - w / 2, ly + 6, { size: 19, weight: 700, font: L.FONT.mono, color: COL.cyan, align: "center", alpha: shown });
    const ma = shown * (0.35 + 0.65 * moving);
    stk(ctx, (c) => { c.moveTo(x0 - 12, ly + 10); c.lineTo(x0 - 12, ly - 12); }, COL.cyan, 2, ma, 0.5);
    arrowHead(ctx, x0 - 12, ly - 16, -Math.PI / 2, 8, COL.cyan, ma);
  }

  /** BEATS Haughwout: [0] Fassade wird aufgeschnitten, [1] Fahrkorb fährt los (+ Tempo-Chip), [2] Fahrkorb hält oben. */
  function drawHaughwout(ctx, p, cfg, T) {
    const { L, t } = p, d = T.d, H = HW;
    const r0 = T.beat(0, 0.15 + 0.04 * d), rv = easeInOut(inv(r0, r0 + Math.max(0.8, 0.26 * d), t));
    layer(ctx, "hw_facade", PL.x - 12, PL.y - 12, PL.w + 24, PL.h + 24, 1 - 0.32 * rv, hwFacade);
    // Lichtreflex über die Fenster
    const wp = hwWindows();
    if (wp) {
      const bx = lerp(200, 1600, ((t * 0.09) + 0.1) % 1);
      ctx.save(); ctx.clip(wp); const g = ctx.createLinearGradient(bx - 150, 400, bx + 150, 460);
      g.addColorStop(0, "rgba(255,220,170,0)"); g.addColorStop(0.5, "rgba(255,220,170,0.16)"); g.addColorStop(1, "rgba(255,220,170,0)");
      ctx.globalAlpha = 1 - 0.4 * rv; ctx.fillStyle = g; ctx.fillRect(bx - 300, H.corn, 600, H.ground - H.corn); ctx.restore();
    }
    // Passanten
    ctx.save(); ctx.beginPath(); plateClip(ctx); ctx.clip();
    for (let i = 0; i < 6; i++) {
      const dir = i % 2 ? -1 : 1, sp = 14 + 10 * h01(i * 3.3), span = PL.w + 80;
      const x = PL.x - 40 + ((((h01(i * 7.1) * span + dir * t * sp) % span) + span) % span);
      const bob = Math.abs(Math.sin(t * 5 + i)) * 1.5;
      figure(ctx, L, x, H.ground + 26 - bob, 46 + 6 * h01(i), COL.sepia, 0.6, { hat: i % 3 === 0 ? null : "top", dress: i % 3 === 0 });
    }
    motes(ctx, t, 26, PL.x, 300, PL.w, 560, COL.pale, 7, 0.8);
    ctx.restore();
    // Aufschnitt
    const mv0 = T.beat(1, Math.max(r0 + 0.6, 0.3 * d + 0.1)), mv1 = Math.max(mv0 + 0.8, T.beat(2, Math.min(d - 0.4, mv0 + Math.max(1.8, 0.5 * d))));
    const km = easeInOut(inv(mv0, mv1, t)), travel = (H.fl[0] - H.fl[3]) * km;
    const moving = inv(mv0, mv0 + 0.3, t) * (1 - inv(mv1 - 0.3, mv1, t));
    const carBot = H.fl[0] - travel;
    if (rv > 0) {
      const yT = H.corn - 12, yW = lerp(yT, PL.y + PL.h, rv);
      ctx.save(); ctx.beginPath(); ctx.rect(H.cx0 - 1, yT, H.bw + 2, yW - yT); ctx.clip();
      hwInterior(ctx, L, t, carBot, travel, moving);
      ctx.restore();
      // Schnittkanten (gezackt, Schnittschraffur)
      const edge = (x, s) => (c) => { c.moveTo(x, yT); for (let y = yT, k = 0; y < yW; y += 12, k++) c.lineTo(x + s * (k % 2 ? 4 : -2) * (0.6 + 0.8 * h01(k * 1.7 + x)), Math.min(y + 12, yW)); };
      for (const [x, s] of [[H.cx0, -1], [H.cx1, 1]]) {
        const band = (c) => c.rect(s < 0 ? x - 8 : x, yT, 8, yW - yT);
        hatch(ctx, band, s < 0 ? x - 8 : x, yT, 8, yW - yT, 45, 3, COL.pale, 0.8, 0.8);
        stk(ctx, edge(x, s), COL.pale, 1.6, 1, 0.5);
      }
      if (rv < 1) { stk(ctx, (c) => { c.moveTo(H.cx0 - 20, yW); c.lineTo(H.cx1 + 20, yW); }, COL.cyan, 2.2, 1, 1.2); dot(ctx, lerp(H.cx0, H.cx1, 0.5 + 0.5 * Math.sin(t * 7)), yW, 22, COL.cyan, 0.7); }
    }
    if (rv > 0.5) { dot(ctx, H.carC, carBot - 46, 90, COL.ink, 0.16 * (rv - 0.5) * 2); hwSpeed(ctx, L, carBot, moving, inv(mv0, mv0 + 0.3, t) * inv(0.5, 0.8, rv), cfg.speed); }
    const hdr = drawHeader(ctx, L, t, T, cfg, { title: "HAUGHWOUT BUILDING", sub: "New York 1857 · erster Otis-Personenaufzug", size: 30, subSize: 20 }, cfg.ov);
    const A = {
      rail: { re: /schiene|zahn|sperr|führung/, g: () => ({ tx: H.railR + 3, ty: 330, bx: 1400, by: 404, size: 22 }) },
      rope: { re: /seil|rope/, g: () => ({ tx: H.carC, ty: (H.shY + carBot - 120) / 2, bx: 1400, by: 480, size: 22 }) },
      pulley: { re: /rolle|scheibe/, g: () => ({ tx: H.shX + H.shR, ty: H.shY + 6, bx: 1400, by: 560, size: 22 }) },
      car: { re: /fahrkorb|kabine|korb|aufzug|fahrg|passagier/, g: () => ({ tx: H.carX1, ty: carBot - 40, bx: 1400, by: 660, size: 22 }) },
      building: { re: /haughwout|gebäude|fassade|haus|building|palazzo|gusseis|broadway|new york/, g: () => ({ kind: "caption" }) },
    };
    const defs = [{ key: "rail", text: "Führungsschiene + Sperrzähne" }, { key: "rope", text: "Tragseil" }, { key: "car", text: "Fahrkorb" }];
    const l0 = Math.max(r0 + 0.5, 0.3 * d);
    drawLabels(ctx, L, t, T, resolveLabels(cfg.items, A, ["car", "rail", "rope", "pulley", "building"], defs, l0, clamp(0.06 * d, 0.2, 0.45)), A, hdr);
  }

  // =====================================================================================
  // Szene 3: Empire State Building 1945 – respektvolle Schemazeichnung
  // =====================================================================================
  const ES = { cx: 985, ground: 820, pit: 880, fh: 5.59, shX: 998, shW: 13, mark: 75 };
  const esY = (n) => ES.ground - n * ES.fh;
  const ES_PROF = [[0, 5, 104], [5, 21, 72], [21, 25, 67], [25, 30, 61], [30, 72, 54], [72, 81, 43], [81, 85, 33], [85, 86, 28], [86, 90, 17], [90, 102, 12]];
  function esOutline(c) {
    const X = ES.cx, top = esY(102);
    c.moveTo(X - ES_PROF[0][2], ES.ground);
    for (const [a, b, hw] of ES_PROF) { c.lineTo(X - hw, esY(a)); c.lineTo(X - (b === 102 ? 7 : hw), esY(b)); }
    c.lineTo(X - 4, top - 8); c.lineTo(X - 1.5, top - 20); c.lineTo(X, top - 34); c.lineTo(X + 1.5, top - 20); c.lineTo(X + 4, top - 8);
    for (let i = ES_PROF.length - 1; i >= 0; i--) { const [a, b, hw] = ES_PROF[i]; c.lineTo(X + (b === 102 ? 7 : hw), esY(b)); c.lineTo(X + hw, esY(a)); }
    c.closePath();
  }
  function esBg(g) {
    drawPlateFrame(g);
    g.save(); g.beginPath(); plateClip(g); g.clip();
    stk(g, (c) => { for (let y = PL.y + 8; y < ES.ground; y += 6) { const k = (y - PL.y) / (ES.ground - PL.y); for (let x = PL.x; x < PL.x + PL.w; x += 110) { if (h01(x * 0.7 + y * 1.1) < 0.35 + 0.45 * k) { const o = h01(y + x) * 50; c.moveTo(x + o, y); c.lineTo(x + o + 40 + 50 * h01(x + y * 3), y); } } } }, COL.ink, 0.7, 0.13);
    const halo = g.createRadialGradient(ES.cx, 520, 20, ES.cx, 560, 460);
    halo.addColorStop(0, "rgba(255,179,71,0.10)"); halo.addColorStop(1, "rgba(255,179,71,0)");
    g.fillStyle = halo; g.fillRect(PL.x, PL.y, PL.w, PL.h);
    // Stadtsilhouette
    for (let i = 0; i < 26; i++) {
      const w = 40 + 50 * h01(i * 2.1), x = PL.x + i * 68 + h01(i * 5.3) * 20, h = 50 + 150 * h01(i * 3.7) * (Math.abs(x - ES.cx) < 170 ? 0.45 : 1);
      if (x + w > PL.x + PL.w) break;
      const top = ES.ground - h, step = h01(i * 8.3) > 0.6 ? 12 : 0;
      const b = (c) => { c.moveTo(x, ES.ground); c.lineTo(x, top + step); c.lineTo(x + step, top + step); c.lineTo(x + step, top); c.lineTo(x + w - step, top); c.lineTo(x + w - step, top + step); c.lineTo(x + w, top + step); c.lineTo(x + w, ES.ground); c.closePath(); };
      fil(g, b, "#140e07", 0.95); hatch(g, b, x, top, w, h, 90, 4, COL.ink, 0.6, 0.18); stk(g, b, COL.ink, 1, 0.34);
      fil(g, (c) => { for (let yy = top + 12; yy < ES.ground - 10; yy += 14) for (let xx = x + 6; xx < x + w - 6; xx += 9) if (h01(xx * 1.3 + yy * 0.7) > 0.8) c.rect(xx, yy, 3, 5); }, COL.ink, 0.35);
      if (i % 3 === 1) { const tx = x + w * 0.62, ty = top; stk(g, (c) => { c.moveTo(tx - 7, ty); c.lineTo(tx - 6, ty - 10); c.moveTo(tx + 7, ty); c.lineTo(tx + 6, ty - 10); c.rect(tx - 9, ty - 26, 18, 16); c.moveTo(tx - 10, ty - 26); c.lineTo(tx, ty - 34); c.lineTo(tx + 10, ty - 26); }, COL.ink, 1, 0.45); }
    }
    g.restore();
  }
  function esBuilding(g) {
    const X = ES.cx;
    fil(g, esOutline, "#1b1309", 0.97);
    // Fensterbänder (senkrechte Pfeiler) je Abschnitt
    for (const [a, b, hw] of ES_PROF) {
      const y0 = esY(b), y1 = esY(a), x0 = X - hw, w = hw * 2;
      if (b <= 86) {
        stk(g, (c) => { for (let x = x0 + 5; x < x0 + w - 3; x += 6) { c.moveTo(x, y0 + 3); c.lineTo(x, y1 - 1); } }, COL.pale, 0.8, 0.45);
        stk(g, (c) => { for (let n = a + 2; n < b; n += 2) { c.moveTo(x0 + 3, esY(n)); c.lineTo(x0 + w - 3, esY(n)); } }, COL.ink, 0.6, 0.14);
      } else stk(g, (c) => { for (let x = x0 + 4; x < x0 + w - 2; x += 6) { c.moveTo(x, y0 + 2); c.lineTo(x, y1); } }, COL.pale, 0.7, 0.35);
      hatch(g, rectB(X + hw * 0.35, y0, hw * 0.65, y1 - y0), X + hw * 0.35, y0, hw * 0.65, y1 - y0, 62, 3.4, "#000", 1.2, 0.35);
      stk(g, (c) => { c.moveTo(x0 - 3, y0); c.lineTo(x0 + w + 3, y0); }, COL.pale, 1.2, 0.7);
    }
    stk(g, esOutline, COL.pale, 1.5, 0.9, 0.5);
    // Eingang
    stk(g, (c) => { c.moveTo(X - 14, ES.ground); c.lineTo(X - 14, ES.ground - 16); c.arc(X, ES.ground - 16, 14, Math.PI, TAU); c.lineTo(X + 14, ES.ground); }, COL.pale, 1.2, 0.8);
    // Untergeschosse im Schnitt (Erdreich schraffiert)
    const ug = rectB(PL.x, ES.ground, PL.w, PL.y + PL.h - ES.ground);
    fil(g, ug, "#120c06", 1);
    hatch(g, ug, PL.x, ES.ground, PL.w, PL.y + PL.h - ES.ground, 45, 7, COL.ink, 0.7, 0.2);
    const bx0 = X - 120, bw = 240, bsec = rectB(bx0, ES.ground, bw, ES.pit + 10 - ES.ground);
    fil(g, bsec, "#1b1309", 1);
    stk(g, (c) => { c.rect(bx0, ES.ground, bw, ES.pit + 10 - ES.ground); for (const y of [ES.ground + 20, ES.ground + 40]) { c.moveTo(bx0, y); c.lineTo(bx0 + bw, y); } }, COL.pale, 1.1, 0.6);
    stk(g, (c) => { c.moveTo(PL.x, ES.ground); c.lineTo(PL.x + PL.w, ES.ground); }, COL.pale, 1.8, 0.85, 0.4);
  }
  const ES_PH = (n) => { for (const [a, b, hw] of ES_PROF) if (n >= a && n < b) return hw; return 12; };
  /** Einmal gerastertes Hilfsbild (oder null). */
  function sprite(key, w, h, fn) {
    let cv = SPR.get(key);
    if (cv === undefined) { cv = null; try { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); if (g) { const sG = GA, sW = WM; GA = 1; WM = 1; try { fn(g); cv = c; } finally { GA = sG; WM = sW; } } } catch (e) { cv = null; } SPR.set(key, cv); }
    return cv;
  }
  function esSky(ctx, t, cfg) {
    layer(ctx, "es_bg", PL.x - 12, PL.y - 12, PL.w + 24, PL.h + 24, 1, esBg);
    ctx.save(); ctx.beginPath(); plateClip(ctx); ctx.clip();
    for (let i = 0; i < 5; i++) {
      const span = PL.w + 400, cx = PL.x - 200 + ((h01(i * 4.4) * span + t * (8 + 5 * h01(i))) % span), cy = 250 + 260 * h01(i * 2.9), cw = 150 + 120 * h01(i * 1.3);
      stk(ctx, (c) => { for (let k = 0; k < 7; k++) { const yy = cy + k * 7 - 21, ww = cw * Math.sqrt(Math.max(0, 1 - Math.pow((k - 3) / 3.6, 2))); c.moveTo(cx - ww / 2 + h01(i + k) * 20, yy); c.lineTo(cx + ww / 2, yy); } }, COL.ink, 1, 0.3);
    }
    ctx.restore();
  }
  /** Nebelbänder (weiche, horizontal kachelbare Schwaden), driften langsam. */
  function esFog(ctx, t, dens) {
    if (dens <= 0) return;
    const FW = 1900, FH = 420;
    const cv = sprite("es_fog", FW, FH, (g) => {
      for (let i = 0; i < 16; i++) {
        const cx = h01(i * 5.1) * FW, cy = 90 + h01(i * 3.3) * 240, ry = 36 + 60 * h01(i * 1.7), rx = ry * (3 + 3 * h01(i * 2.9));
        for (const ox of [-FW, 0, FW]) {
          g.save(); g.translate(cx + ox, cy); g.scale(rx / ry, 1);
          const gr = g.createRadialGradient(0, 0, 0, 0, 0, ry); gr.addColorStop(0, "rgba(214,200,176,0.22)"); gr.addColorStop(1, "rgba(214,200,176,0)");
          g.fillStyle = gr; g.beginPath(); g.arc(0, 0, ry, 0, TAU); g.fill(); g.restore();
        }
      }
    });
    if (!cv) return;
    ctx.save(); ctx.beginPath(); plateClip(ctx); ctx.clip();
    for (const [y, sp, a, o] of [[190, 16, 0.95, 0], [330, 9, 0.7, 700]]) {
      const off = (((t * sp + o) % FW) + FW) % FW;
      ctx.globalAlpha = GA * dens * a; ctx.drawImage(cv, PL.x - FW + off, y); ctx.drawImage(cv, PL.x + off, y);
    }
    ctx.restore();
  }
  function esShaft(ctx, t, cfg, ks, yS) {
    const sx = ES.shX, sw = ES.shW, pul = 0.5 + 0.5 * Math.sin(t * 2.2), col = cfg.hlShaft ? COL.ink : COL.cyan, yR = lerp(yS, ES.pit, ks);
    if (ks <= 0) return;
    fil(ctx, rectB(sx, yS, sw, yR - yS), col, (cfg.hlShaft ? 0.2 : 0.13) + 0.06 * pul);
    if (cfg.hlShaft) dot(ctx, sx + sw / 2, lerp(yS, yR, 0.5), 60 + 10 * pul, COL.ink, 0.12 * ks);
    stk(ctx, (c) => { c.moveTo(sx, yS); c.lineTo(sx, yR); c.moveTo(sx + sw, yS); c.lineTo(sx + sw, yR); c.moveTo(sx - 3, yS); c.lineTo(sx + sw + 3, yS); }, col, cfg.hlShaft ? 1.8 : 1.4, 0.9, cfg.hlShaft ? 1.4 : 0.9);
    stk(ctx, (c) => { for (let n = 0; n <= 80; n += 10) { const y = esY(n); if (y <= yR && y >= yS) { c.moveTo(sx - 5, y); c.lineTo(sx, y); } } }, col, 1, 0.6);
  }
  function esAnchorsBase(yM) {
    const sx = ES.shX, sw = ES.shW, X = ES.cx;
    return { // Reihenfolge = Stichwort-Priorität ("Schachtgrube · Untergeschoss" → pit, nicht shaft/floor)
      pit: { re: /grube|untergeschoss|keller|basement|boden/, g: () => ({ tx: sx + sw / 2, ty: ES.pit - 6, bx: 820, by: 856, align: "right", size: 22 }) },
      floor: { re: /stock|etage|floor|\d+\.\s*og\b/, g: () => ({ tx: sx, ty: yM + 4, bx: 860, by: yM - 40, align: "right", color: COL.ink }) },
      shaft: { re: /schacht|shaft/, g: () => ({ tx: sx, ty: esY(38), bx: 860, by: esY(38), align: "right", color: COL.cyan }) },
      building: { re: /empire|gebäude|building|hochhaus|wolkenkratzer|turm/, g: () => ({ tx: X + 14, ty: esY(92), bx: 1080, by: esY(97) }) },
    };
  }

  function drawEmpire(ctx, p, cfg, T) {
    if (cfg.variant === "impact") return drawEsImpact(ctx, p, cfg, T);
    if (cfg.variant === "rescue") return drawEsRescue(ctx, p, cfg, T);
    const { L, t } = p, d = T.d, X = ES.cx, sx = ES.shX, sw = ES.shW, mark = cfg.floor || 75, yM = esY(mark), yP = ES.pit - 2;
    esSky(ctx, t, cfg);
    layer(ctx, "es_bld", X - 140, esY(102) - 50, 280, ES.pit + 24 - esY(102) + 50, 1, esBuilding);
    // BEATS: [0] Schacht leuchtet auf, [1] Etagen-Markierung, [2] Absturz beginnt, [3] Maßkette/Fallhöhe
    const b0 = T.beat(0, 0.2), b1 = T.beat(1, 0.4), tf0 = T.beat(2, 0.2 * d + 0.3);
    const tf1 = tf0 + (T.has(3) ? clamp(T.beat(3, 0) - tf0 + 0.2, 0.8, 4) : clamp(0.3 * d, 1.1, 4)), tm = T.has(3) ? T.beat(3, 0) : T.cl(tf1 - 0.2);
    esShaft(ctx, t, cfg, easeOut(inv(b0, b0 + 0.7, t)), esY(Math.min(86, Math.max(80, mark + 4))));
    esFog(ctx, t, cfg.fog);
    const pul = 0.5 + 0.5 * Math.sin(t * 2.2);
    const kf = (tt) => easeIn(inv(tf0, tf1, tt)) * 0.85 + 0.15 * inv(tf0, tf1, tt);
    const carY = (tt) => lerp(yM, yP - 12, kf(tt)), fell = t >= tf1;
    const km = easeOut(inv(b1, b1 + 0.6, t));
    if (km > 0) {
      stk(ctx, (c) => c.arc(sx + sw / 2, yM + 6, 16 + 6 * pul, 0, TAU), COL.ink, 2, km * (0.6 + 0.4 * pul), 0.8);
      stk(ctx, (c) => { c.moveTo(X - 70, yM); c.lineTo(X + 70, yM); }, COL.ink, 1.2, 0.7 * km, 0, [6, 5]);
    }
    const ka = inv(tf0 - 0.1, tf1, t);
    if (ka > 0) {
      const ax = sx + sw + 18, ya = yM + 4, yb = lerp(ya, yP, easeInOut(ka));
      stk(ctx, (c) => { c.moveTo(ax, ya); c.lineTo(ax, yb - 10); }, COL.red, 3, 1, 0.9, [12, 9], -t * 40);
      arrowHead(ctx, ax, yb, Math.PI / 2, 16, COL.red, 1);
    }
    if (t > tf0 && !fell) for (let k = 6; k >= 1; k--) { const y = carY(t - k * 0.045); fil(ctx, rectB(sx + 2, y, sw - 4, 12), COL.cyan, 0.08 * (7 - k)); }
    const cy = carY(t);
    fil(ctx, rectB(sx + 2, cy, sw - 4, 12), fell ? COL.ink : COL.cyan, 0.95);
    stk(ctx, rectB(sx + 2, cy, sw - 4, 12), COL.white, 1, 0.8, 0.8);
    if (fell) { const f = t - tf1; stk(ctx, (c) => c.arc(sx + sw / 2, yP - 6, 14 + 10 * ((f * 0.8) % 1), 0, TAU), COL.red, 1.6, 0.7 * (1 - ((f * 0.8) % 1))); }
    // Maßkette rechts (BEAT [3])
    const kd = cfg.measure ? easeOut(inv(tm, tm + 0.7, t)) : 0;
    if (kd > 0) {
      const xd = 1150, yb2 = lerp(yM, yP, kd);
      stk(ctx, (c) => { c.moveTo(xd - 10, yM); c.lineTo(xd + 10, yM); c.moveTo(xd, yM); c.lineTo(xd, yb2); c.moveTo(sx + sw + 30, yM); c.lineTo(xd - 12, yM); }, COL.ink, 1.5, 0.9, 0.5);
      if (kd > 0.98) stk(ctx, (c) => { c.moveTo(xd - 10, yP); c.lineTo(xd + 10, yP); c.moveTo(X + 124, yP); c.lineTo(xd - 12, yP); }, COL.ink, 1.5, 0.9, 0.5);
      const main = cfg.distance || "≈ " + mark + " Stockwerke", sub = cfg.distanceSub != null ? cfg.distanceSub : mark === 75 ? "rund 300 m" : "";
      txt(L, ctx, main, xd + 22, (yM + yP) / 2 - 4, { size: 32, weight: 700, font: L.FONT.head, letterSpacing: 1, color: COL.ink, alpha: kd, glow: 10, glowColor: "rgba(255,179,71,0.5)" });
      if (sub) txt(L, ctx, sub, xd + 22, (yM + yP) / 2 + 28, { size: 21, weight: 600, color: COL.pale, alpha: kd });
    }
    const hdr = drawHeader(ctx, L, t, T, cfg, { title: "EMPIRE STATE BUILDING", sub: "New York · 28. Juli 1945", size: 28, subSize: 20 }, cfg.ov);
    const A = esAnchorsBase(yM);
    A.floor.def = b1 + 0.3; A.shaft.def = b0 + 0.7; A.pit.def = tf1 - 0.1;
    A.car = { re: /kabine|fahrkorb|aufzug/, def: tf0 + 0.2, g: () => ({ tx: sx + sw, ty: cy + 6, bx: 1080, by: yM + 120, color: COL.cyan }) };
    const defs = [{ key: "floor", text: mark + ". Stock", def: b1 + 0.3 }, { key: "shaft", text: "Aufzugsschacht", def: b0 + 0.7 }, { key: "pit", text: "Schachtgrube · Untergeschoss", def: tf1 - 0.1 }];
    drawLabels(ctx, L, t, T, resolveLabels(cfg.items, A, ["building", "floor", "shaft", "pit", "car"], defs, 0.6, 0.5), A, hdr);
    if (cfg.quote) { const qa = T.at(cfg.quoteAt, tf1 + 0.4); quotePlate(ctx, L, HX, hdr.y + 30, typeof cfg.quote === "string" ? cfg.quote : "Die Liftführerin überlebte den Absturz.", cfg.quoteBy || "SCHEMATISCHE DARSTELLUNG", inv(qa, qa + 0.6, t)); }
  }

  // ---------- Empire-Variante "impact": Flugzeugsilhouette im Nebel trifft die Fassade (schematisch, ohne Feuer) ----------
  function b25(ctx, x, y, s, ang, a) {
    if (a <= 0.004) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
    const body = polyB([[52, 0], [46, -6], [26, -8], [20, -11], [10, -11], [-30, -7], [-46, -5], [-52, -3], [-52, 1], [-30, 5], [30, 6], [46, 5]], true);
    const fin = polyB([[-54, -3], [-50, -24], [-43, -24], [-40, -4]], true);
    const nac = (c) => { rr(c, 4, -1, 28, 9, 4); };
    fil(ctx, (c) => { c.moveTo(-47, -2); c.lineTo(-45, -21); c.lineTo(-39, -21); c.lineTo(-37, -3); c.closePath(); }, COL.pale, 0.35 * a);
    for (const b of [body, fin, nac]) { fil(ctx, b, "#1b1309", a); stk(ctx, b, COL.pale, 1.5 / s, a, 0.5); }
    stk(ctx, (c) => { c.moveTo(-10, -1); c.lineTo(22, -1); c.moveTo(-58, -4); c.lineTo(-36, -4); c.moveTo(40, -5); c.lineTo(44, 4); c.moveTo(34, -6); c.lineTo(37, 5); c.moveTo(18, -10); c.lineTo(24, -7); }, COL.pale, 1.2 / s, 0.8 * a);
    stk(ctx, (c) => c.ellipse(34, 3.5, 1.6, 13, 0, 0, TAU), COL.pale, 1 / s, 0.45 * a);
    ctx.restore();
  }
  function drawEsImpact(ctx, p, cfg, T) {
    const { L, t } = p, d = T.d, X = ES.cx, fl = cfg.impactFloor || 79, yI = esY(fl) + ES.fh / 2, hw = ES_PH(fl), faceX = X - hw;
    esSky(ctx, t, cfg);
    layer(ctx, "es_bld", X - 140, esY(102) - 50, 280, ES.pit + 24 - esY(102) + 50, 1, esBuilding);
    if (cfg.hlShaft) esShaft(ctx, t, cfg, 1, esY(86));
    // BEATS: [0] Flugzeug erscheint, [1] Einschlag, [2] Triebwerksbahn(en)
    const t0 = T.beat(0, 0.3), tI = Math.max(t0 + 0.5, T.beat(1, Math.max(t0 + 1.2, 0.36 * d))), tE = Math.max(tI + 0.1, T.beat(2, tI + 0.6));
    const sx0 = 250, sy0 = yI - 70, s = 0.95, nose = 52 * s, ang = Math.atan2(yI - sy0, faceX - nose - sx0);
    const kp = inv(t0, tI, t), px = lerp(sx0, faceX - nose * Math.cos(ang), kp), py = lerp(sy0, yI - nose * Math.sin(ang), kp);
    // Flugbahn (gestrichelt) + Flugzeug
    const fa = easeOut(inv(t0, t0 + 0.4, t));
    if (fa > 0) {
      stk(ctx, (c) => { c.moveTo(PL.x + 20, lerp(sy0, yI, (PL.x + 20 - sx0) / (faceX - sx0))); c.lineTo(t < tI ? px : faceX, t < tI ? py : yI); }, COL.ink, 1.6, 0.45 * fa, 0, [9, 8], -t * 30);
      const pa = fa * (1 - inv(tI - 0.02, tI + 0.12, t)), ent = inv(tI - 0.02, tI + 0.12, t) * 14;
      b25(ctx, px + ent * Math.cos(ang), py + ent * Math.sin(ang), s, ang, pa);
    }
    esFog(ctx, t, cfg.fog);
    // Einschlag-Markierung (nüchtern: Ring + Etagenband, kein Feuer)
    const pul = 0.5 + 0.5 * Math.sin(t * 2.4);
    if (t >= tI) {
      const di = t - tI, f = Math.exp(-di * 4);
      dot(ctx, faceX, yI, 20 + 36 * (1 - f), COL.red, 0.75 * f);
      stk(ctx, (c) => c.arc(faceX, yI, 8 + 60 * easeOut(di / 0.6), 0, TAU), COL.red, 2, 0.8 * f);
      const kb = easeOut(inv(tI, tI + 0.5, t));
      stk(ctx, (c) => { c.moveTo(X - hw - 30, yI); c.lineTo(lerp(X - hw - 30, X + hw + 30, kb), yI); }, COL.red, 1.4, 0.8, 0.6, [6, 5]);
      stk(ctx, (c) => c.arc(faceX, yI, 14 + 5 * pul, 0, TAU), COL.red, 2, kb * (0.6 + 0.4 * pul), 0.8);
      fil(ctx, (c) => c.arc(faceX, yI, 3.5, 0, TAU), COL.red, kb);
    }
    // Triebwerksbahnen (amber, gestrichelt)
    const E = { x: faceX, y: yI };
    const ke = easeInOut(inv(tE, tE + 0.9, t));
    if (ke > 0) for (const path of cfg.engine) {
      let pts;
      if (path === "shaft") pts = [[faceX + 4, yI], [ES.shX + ES.shW / 2, yI], [ES.shX + ES.shW / 2, yI + 120]];
      else { pts = []; const c0 = [faceX + 4, yI], c1 = [X + 170, yI - 14], c2 = [1236, 690]; for (let i = 0; i <= 24; i++) { const u = i / 24, m = 1 - u; pts.push([m * m * c0[0] + 2 * m * u * c1[0] + u * u * c2[0], m * m * c0[1] + 2 * m * u * c1[1] + u * u * c2[1]]); } }
      let tot = 0; for (let i = 1; i < pts.length; i++) tot += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const want = tot * ke, part = [pts[0]]; let acc = 0;
      for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (acc + l >= want) { const u = (want - acc) / l; part.push([lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)]); break; } acc += l; part.push(pts[i]); }
      stk(ctx, polyB(part), COL.ink, 3, 1, 0.9, [12, 9], -t * 40);
      const q = part[part.length - 1], q0 = part[Math.max(0, part.length - 2)];
      arrowHead(ctx, q[0], q[1], Math.atan2(q[1] - q0[1], q[0] - q0[0]), 16, COL.ink, 1);
      if (path !== "shaft") { E.x = q[0]; E.y = q[1]; } else if (!cfg.engine.includes("through")) { E.x = q[0]; E.y = q[1]; }
    }
    const hdr = drawHeader(ctx, L, t, T, cfg, { title: "EMPIRE STATE BUILDING", sub: "New York · 28. Juli 1945", size: 28, subSize: 20 }, cfg.ov);
    const A = esAnchorsBase(yI);
    A.floor.g = () => ({ tx: X + hw, ty: yI, bx: 1090, by: yI - 56, color: COL.red }); A.floor.def = tI + 0.3;
    const B = {
      plane: { re: /b-?\s?25|bomber|flugzeug|maschine|mitchell|aircraft/, def: t0 + 0.5, g: () => ({ tx: t < tI ? px : faceX, ty: t < tI ? py - 4 : yI, bx: 440, by: sy0 - 72 }) },
      dead: { re: /tote|todesopfer|opfer|menschen|starben|sterben|verletzte/, def: tE + 1.2, g: () => ({ kind: "stat", x: HX, y: 610 }) },
      engine: { re: /triebwerk|motor|engine/, def: tE + 0.6, g: () => (ke > 0 ? { tx: E.x, ty: E.y, bx: 1300, by: 770 } : null) },
      fog: { re: /nebel|fog|sicht/, g: () => ({ tx: 640, ty: 440, bx: 440, by: 520 }) },
    };
    const AA = Object.assign({}, B, A);
    const defs = [{ key: "plane", text: cfg.aircraft || "B-25", def: t0 + 0.5 }, { key: "floor", text: fl + ". Stock", def: tI + 0.3 }];
    drawLabels(ctx, L, t, T, resolveLabels(cfg.items, AA, ["plane", "floor", "dead", "engine", "building"], defs, t0 + 0.5, 0.6), AA, hdr);
  }

  // ---------- Empire-Variante "rescue": Detail 80. Stock – Helfer tragen die verletzte Liftführerin in eine andere Kabine ----------
  const RB = { x: 372, g: ES.ground, s: 0.82 }, RP = { x: 690, y: 330, w: 1060, h: 540, F: 820, dA: 1300, dB: 1560, dw: 150, dh: 250 };
  const rbX = (x) => RB.x + (x - ES.cx) * RB.s, rbY = (y) => RB.g + (y - ES.ground) * RB.s;
  function rsPanel(g) {
    const P = RP, x1 = P.x + P.w, F = P.F;
    fil(g, rectB(P.x, P.y, P.w, P.h), "#0d0a07", 0.96);
    // Rückwand: Marmorfugen, Sockel, Brüstungsprofil
    stk(g, (c) => { for (let x = P.x + 60; x < x1; x += 96) { c.moveTo(x, 390); c.lineTo(x, F - 12); } c.moveTo(P.x, 700); c.lineTo(x1, 700); c.moveTo(P.x, 706); c.lineTo(x1, 706); c.moveTo(P.x, F - 12); c.lineTo(x1, F - 12); }, COL.ink, 0.9, 0.22);
    stk(g, (c) => { for (let i = 0; i < 26; i++) { const x = P.x + 30 + h01(i * 3.1) * (P.w - 60), y = 420 + h01(i * 7.3) * 260; c.moveTo(x, y); c.quadraticCurveTo(x + 20, y + 10 * h01(i), x + 40 + 30 * h01(i * 1.7), y + 16 * (h01(i * 2.3) - 0.5)); } }, COL.ink, 0.7, 0.14);
    // Decke + Boden im Schnitt
    for (const [y, h] of [[362, 26], [F, 28]]) { const b = rectB(P.x, y, P.w, h); fil(g, b, "#2a1d0f", 1); hatch(g, b, P.x, y, P.w, h, 45, 5, COL.pale, 0.7, 0.55); stk(g, b, COL.pale, 1.3, 0.85); }
    // Aufzugstüren (Art déco): Rahmen, Stufen-Sturz, Stockwerksanzeiger
    for (const dx of [P.dA, P.dB]) {
      const l = dx - P.dw / 2, r = dx + P.dw / 2, top = F - P.dh;
      stk(g, (c) => { c.rect(l - 12, top - 12, P.dw + 24, P.dh + 12); c.moveTo(l - 20, top - 12); c.lineTo(l - 20, top - 22); c.lineTo(r + 20, top - 22); c.lineTo(r + 20, top - 12); c.moveTo(l - 6, top - 32); c.lineTo(r + 6, top - 32); for (let k = -3; k <= 3; k++) { c.moveTo(dx + k * 16, top - 22); c.lineTo(dx + k * 10, top - 12); } }, COL.pale, 1.3, 0.8);
      stk(g, (c) => { c.moveTo(dx + 24, top - 56); c.arc(dx, top - 56, 24, 0, Math.PI, true); c.closePath(); for (let k = 0; k <= 8; k++) { const a = Math.PI + (k * Math.PI) / 8; c.moveTo(dx + Math.cos(a) * 20, top - 56 + Math.sin(a) * 20); c.lineTo(dx + Math.cos(a) * 24, top - 56 + Math.sin(a) * 24); } }, COL.ink, 1.2, 0.8);
    }
    // Tür A geschlossen
    { const l = P.dA - P.dw / 2, top = F - P.dh; const b = rectB(l, top, P.dw, P.dh); fil(g, b, "#1c1409", 1); hatch(g, b, l, top, P.dw, P.dh, 90, 6, COL.ink, 0.6, 0.3); stk(g, (c) => { c.rect(l, top, P.dw, P.dh); c.moveTo(P.dA, top); c.lineTo(P.dA, F); c.rect(l + 14, top + 20, P.dw / 2 - 28, P.dh - 40); c.rect(P.dA + 14, top + 20, P.dw / 2 - 28, P.dh - 40); }, COL.pale, 1.1, 0.7); }
    // Kabine B (offen): Innenraum cyan
    { const l = P.dB - P.dw / 2, top = F - P.dh; const b = rectB(l, top, P.dw, P.dh);
      fil(g, b, "#06121c", 1); const gr = g.createLinearGradient(0, top, 0, F); gr.addColorStop(0, "rgba(63,210,255,0.22)"); gr.addColorStop(1, "rgba(63,210,255,0.06)"); g.fillStyle = gr; g.fillRect(l, top, P.dw, P.dh);
      stk(g, (c) => { c.rect(l + 16, top + 16, P.dw - 32, P.dh - 30); c.moveTo(l + 16, top + 150); c.lineTo(l + P.dw - 16, top + 150); c.moveTo(l + 26, top + 16); c.lineTo(l + 26, top + P.dh - 14); c.moveTo(l + P.dw - 26, top + 16); c.lineTo(l + P.dw - 26, top + P.dh - 14); }, COL.cyan, 1.2, 0.55);
      stk(g, b, COL.cyan, 1.6, 0.9, 0.8); }
  }
  /** Stehende/gehende Silhouette (ohne Gesicht). ph = Schrittphase, amp 0..1, hands = [[x,y],[x,y]]. */
  function walker(ctx, x, F, h, ph, amp, color, alpha, hands, bend = 0) {
    const a = GA * alpha; if (a <= 0.004) return;
    const s = h / 180, hy = F - 80 * s, sx = x + bend * 10 * s, sy = F - 134 * s;
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.lineWidth = 15 * s; ctx.beginPath();
    for (const sg of [1, -1]) { const fx = x + sg * Math.sin(ph) * amp * 24 * s, kx = x + sg * Math.sin(ph) * amp * 10 * s + 3 * s; ctx.moveTo(x, hy); ctx.lineTo(kx, F - 40 * s); ctx.lineTo(fx, F - 4 * s); }
    ctx.stroke();
    ctx.lineWidth = 40 * s; ctx.beginPath(); ctx.moveTo(x, F - 94 * s); ctx.lineTo(sx, F - 126 * s); ctx.stroke();
    ctx.beginPath(); ctx.arc(sx + bend * 6 * s, F - 166 * s, 15 * s, 0, TAU); ctx.fill();
    ctx.lineWidth = 10 * s; ctx.beginPath();
    (hands || []).forEach((q, i) => { if (!q) return; const shx = sx + (i ? 14 : -14) * s; ctx.moveTo(shx, sy); ctx.lineTo((shx + q[0]) / 2, (sy + q[1]) / 2 + 12 * s); ctx.lineTo(q[0], q[1]); });
    ctx.stroke(); ctx.restore();
  }
  /** Liegende/sitzende Figur über Gelenkpunkte (Kopf, Schulter, Hüfte, Knie, Fuß). */
  function body(ctx, J, color, alpha) {
    const a = GA * alpha; if (a <= 0.004) return;
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.lineWidth = 32; ctx.beginPath(); ctx.moveTo(J.hp[0], J.hp[1]); ctx.lineTo(J.sh[0], J.sh[1]); ctx.stroke();
    ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(J.hp[0], J.hp[1]); ctx.lineTo(J.kn[0], J.kn[1]); ctx.lineTo(J.ft[0], J.ft[1]); ctx.stroke();
    ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(J.sh[0], J.sh[1]); ctx.lineTo(lerp(J.sh[0], J.hp[0], 0.55) + 8, lerp(J.sh[1], J.hp[1], 0.55) + 10); ctx.stroke();
    ctx.beginPath(); ctx.arc(J.hd[0], J.hd[1], 14, 0, TAU); ctx.fill(); ctx.restore();
  }
  const lerpJ = (A, B, k) => { const o = {}; for (const key in A) o[key] = [lerp(A[key][0], B[key][0], k), lerp(A[key][1], B[key][1], k)]; return o; };
  const seatedJ = (hx, F) => ({ hd: [hx - 12, F - 124], sh: [hx - 6, F - 92], hp: [hx, F - 20], kn: [hx + 46, F - 40], ft: [hx + 84, F - 4] });
  const carriedJ = (cx, F) => ({ hd: [cx - 78, F - 122], sh: [cx - 54, F - 110], hp: [cx + 16, F - 100], kn: [cx + 62, F - 108], ft: [cx + 104, F - 88] });
  function drawEsRescue(ctx, p, cfg, T) {
    const { L, t } = p, d = T.d, P = RP, F = P.F;
    esSky(ctx, t, cfg);
    ctx.save(); ctx.translate(RB.x, RB.g); ctx.scale(RB.s, RB.s); ctx.translate(-ES.cx, -ES.ground);
    layer(ctx, "es_bld", ES.cx - 140, esY(102) - 50, 280, ES.pit + 24 - esY(102) + 50, 1, esBuilding);
    ctx.restore();
    // BEATS: [0] Markierung 80. Stock, [1] Detailfenster öffnet, [2] Helfer heben sie an, [3] sie sitzt in der anderen Kabine, [4] Pfeil "nach unten"
    const b0 = T.beat(0, 0.3), b1 = Math.max(b0, T.beat(1, Math.max(b0 + 0.6, 0.12 * d + 0.3))), b2 = Math.max(b1 + 0.3, T.beat(2, Math.max(b1 + 1, 0.55 * d)));
    const b3 = Math.max(b2 + 0.9, T.beat(3, Math.max(b2 + 1.5, 0.8 * d))), b4 = Math.max(b3 + 0.2, T.beat(4, b3 + 0.6));
    const fl = cfg.floor || 80, mx = rbX(ES.shX + ES.shW / 2), my = rbY(esY(fl) + ES.fh / 2), pul = 0.5 + 0.5 * Math.sin(t * 2.4);
    if (cfg.hlShaft) { ctx.save(); ctx.translate(RB.x, RB.g); ctx.scale(RB.s, RB.s); ctx.translate(-ES.cx, -ES.ground); esShaft(ctx, t, cfg, 1, esY(86)); ctx.restore(); }
    const km = easeOut(inv(b0, b0 + 0.6, t));
    if (km > 0) {
      stk(ctx, (c) => c.arc(mx, my, 13 + 5 * pul, 0, TAU), COL.ink, 2, km * (0.6 + 0.4 * pul), 0.8);
      stk(ctx, (c) => { c.moveTo(rbX(ES.cx - 60), my); c.lineTo(rbX(ES.cx + 60), my); }, COL.ink, 1.2, 0.8 * km, 0, [5, 4]);
    }
    const rp = easeInOut(inv(b1, b1 + 0.7, t));
    const kl = smooth(inv(b2, b2 + 0.5, t)), kw = easeInOut(inv(b2 + 0.5, b3 - 0.05, t)), kp = smooth(inv(b3 - 0.05, b3 + 0.5, t));
    const cxp = lerp(975, 1348, kw), walk = inv(b2 + 0.5, b2 + 0.7, t) * (1 - inv(b3 - 0.25, b3 - 0.05, t)), ph = (t - b2) * 9;
    let J = lerpJ(seatedJ(940, F), carriedJ(cxp, F), kl);
    if (kp > 0) J = lerpJ(J, seatedJ(P.dB - 34, F), kp);
    const rearX = lerp(862, cxp - 96, kl) + 64 * kp, frontX = lerp(1066, cxp + 118, kl), dz = 1 - smooth(inv(b3 + 0.1, b3 + 0.6, t)), fX = frontX - 44 * kp;
    if (rp > 0) {
      stk(ctx, (c) => { c.moveTo(mx + 10, my - 6); c.lineTo(lerp(mx, P.x, rp), lerp(my, P.y, rp)); c.moveTo(mx + 10, my + 6); c.lineTo(lerp(mx, P.x, rp), lerp(my, P.y + P.h, rp)); }, COL.ink, 1.1, 0.55);
      ctx.save(); ctx.beginPath(); ctx.rect(P.x - 4, P.y - 4, (P.w + 8) * rp, P.h + 8); ctx.clip();
      layer(ctx, "rs_panel", P.x - 2, P.y - 2, P.w + 4, P.h + 4, 1, rsPanel);
      // Rauchschleier unter der Decke (nur angedeutet)
      stk(ctx, (c) => { for (let i = 0; i < 9; i++) { const y = 400 + i * 11 + 4 * Math.sin(t * 0.7 + i), x0 = P.x + (((h01(i * 2.7) * P.w + t * (18 + 8 * h01(i))) % (P.w + 200)) - 200); c.moveTo(x0, y); c.lineTo(x0 + 120 + 90 * h01(i * 1.9), y + 3); } }, COL.pale, 2.2, 0.08);
      // Figuren
      const hk = kl * (1 - smooth(inv(b3 + 0.05, b3 + 0.4, t))), hands = hk > 0 ? [[lerp(rearX + 30, J.sh[0], hk), lerp(F - 96, J.sh[1] + 12, hk)], [lerp(fX - 26, J.kn[0], hk), lerp(F - 96, J.kn[1] + 12, hk)]] : null;
      walker(ctx, rearX - 20 * kp, F, 188, ph, walk, COL.pale, 0.72, hands ? [null, hands[0]] : [[rearX + 24, F - 70], null], 0.4 * kl * dz + 0.35 * (1 - kl));
      dot(ctx, lerp(J.sh[0], J.hp[0], 0.5), lerp(J.sh[1], J.hp[1], 0.5), 70, COL.ink, 0.12);
      body(ctx, J, COL.pale, 0.95);
      walker(ctx, fX, F, 192, ph + Math.PI, walk, COL.pale, 0.8, hands ? [hands[1], null] : [[fX - 26, F - 72], null], -0.4 * kl * dz - 0.3 * (1 - kl));
      // Tür B schließt nach dem Einsteigen
      const kc = smooth(inv(b3 + 0.45, b3 + 1.05, t)), l = P.dB - P.dw / 2, top = F - P.dh, lw = (P.dw / 2) * kc;
      if (kc > 0) { // Scherengitter der Kabine (durchsichtig)
        const gw = P.dw * kc, g0 = P.dB + P.dw / 2 - gw, n = 7, st = gw / n;
        stk(ctx, (c) => { for (let i = 0; i < n; i++) { const x = g0 + i * st; c.moveTo(x, top + 4); c.lineTo(x + st, F - 4); c.moveTo(x + st, top + 4); c.lineTo(x, F - 4); } for (let i = 0; i <= n; i++) { c.moveTo(g0 + i * st, top + 2); c.lineTo(g0 + i * st, F - 2); } }, COL.pale, 1.3, 0.75);
      }
      // Anzeiger über Tür B zeigt abwärts, Pfeil nach unten (BEAT [4])
      const kn = easeInOut(inv(b4, b4 + 1.2, t)), na = Math.PI * (1.5 - 0.42 * kn);
      stk(ctx, (c) => { c.moveTo(P.dB, top - 56); c.lineTo(P.dB + Math.cos(na) * 20, top - 56 + Math.sin(na) * 20); }, COL.ink, 2, 1, 0.6);
      const kd = easeOut(inv(b4, b4 + 0.5, t));
      if (kd > 0) { const ax = P.dB + P.dw / 2 + 44; stk(ctx, (c) => { c.moveTo(ax, top + 10); c.lineTo(ax, lerp(top + 10, F + 14, kd)); }, COL.cyan, 3, 1, 1, [12, 9], -t * 50); arrowHead(ctx, ax, lerp(top + 10, F + 14, kd) + 8, Math.PI / 2, 16, COL.cyan, kd); }
      ctx.restore();
      stk(ctx, (c) => { c.rect(P.x, P.y, P.w * rp, P.h); }, COL.ink, 1.8, 0.9, 0.5);
      stk(ctx, (c) => { c.rect(P.x - 7, P.y - 7, (P.w + 14) * rp, P.h + 14); }, COL.ink, 0.8, 0.4);
      txt(L, ctx, cfg.panelTitle || "DETAIL · AUFZUGSVORRAUM", P.x + 18, P.y - 16, { size: 18, weight: 700, font: L.FONT.mono, color: COL.ink, letterSpacing: 2, alpha: inv(0.5, 1, rp) });
    }
    const hdr = drawHeader(ctx, L, t, T, cfg, { title: "EMPIRE STATE BUILDING", sub: "New York · 28. Juli 1945", size: 28, subSize: 20 }, cfg.ov);
    const tcx = lerp(J.sh[0], J.hp[0], 0.5), tcy = lerp(J.sh[1], J.hp[1], 0.5);
    const A = {
      floor: { re: /stock|etage|geschoss|floor/, def: b0 + 0.6, g: () => ({ tx: mx, ty: my, bx: 480, by: 506, color: COL.ink }) },
      person: { re: /liftführ|führerin|frau|verletzt|oliver|betty|opfer|patient|fahrstuhlführ/, def: b1 + 0.8, g: () => (rp > 0.5 ? { tx: tcx, ty: tcy, bx: clamp(tcx - 40, 720, 1300), by: 432 } : null) },
      car: { re: /kabine|aufzug|fahrkorb|lift(?!führ)/, def: b2 + 0.8, g: () => (rp > 0.5 ? { tx: P.dB + 40, ty: F - 170, bx: 1735, by: 500, align: "right", color: COL.cyan } : null) },
      helpers: { re: /helfer|retter|feuerwehr|männer|sanitäter/, def: b2, g: () => (rp > 0.5 ? { tx: rearX + 4, ty: F - 172, bx: clamp(rearX - 30, 720, 1300), by: 482 } : null) },
      building: { re: /empire|gebäude|building|hochhaus|wolkenkratzer/, g: () => ({ tx: rbX(ES.cx + 10), ty: rbY(esY(95)), bx: 480, by: rbY(esY(99)) }) },
    };
    const defs = [{ key: "floor", text: fl + ". Stock", def: b0 + 0.6 }, { key: "person", text: "Liftführerin", def: b1 + 0.8 }];
    drawLabels(ctx, L, t, T, resolveLabels(cfg.items, A, ["floor", "person", "car", "helpers", "building"], defs, b1 + 0.5, 0.6), A, hdr);
  }

  // =====================================================================================
  // Szene 4: frühes Hebezeug – Handwinde mit Zahnradvorgelege, Sperrrad und Ausleger
  // =====================================================================================
  const EH = { ground: 860, G: [720, 700], drR: 50, gR: 110, gN: 40, pR: 22, pN: 8, crR: 36, ratRoot: 27, ratTip: 36, ratN: 12, phiP: -2.1, P1: [1128, 362], P2: [1470, 362], pr: 18, rise: 250, hook0: 730 };
  EH.K = [EH.G[0] + Math.cos(160 * D2R) * (EH.gR + EH.pR), EH.G[1] + Math.sin(160 * D2R) * (EH.gR + EH.pR)];
  (function () { const pa = TAU / EH.ratN, loc0 = ((((EH.phiP + EH.rise / EH.drR) / pa) % 1) + 1) % 1; EH.rise += (1.04 - loc0) * pa * EH.drR; })(); // Hubende: Klinke gerade eingefallen
  const EINS = { x: 330, y: 452, r: 140, z: 2.25, fx: EH.G[0] - 4, fy: EH.G[1] - 12 };
  function gearB(cx, cy, r, n, dep, ang) {
    return (c) => { const pa = TAU / n; for (let i = 0; i < n; i++) { const a = ang + i * pa; const q = [[r - dep, a - 0.5 * pa], [r - dep, a - 0.3 * pa], [r, a - 0.15 * pa], [r, a + 0.15 * pa], [r - dep, a + 0.3 * pa]]; q.forEach(([R, A], j) => { const x = cx + Math.cos(A) * R, y = cy + Math.sin(A) * R; if (i === 0 && j === 0) c.moveTo(x, y); else c.lineTo(x, y); }); } c.closePath(); };
  }
  function ratchetB(cx, cy, r0, r1, n, ang) {
    return (c) => { const pa = TAU / n; for (let i = 0; i < n; i++) { const a = ang + i * pa; const p0 = [cx + Math.cos(a) * r0, cy + Math.sin(a) * r0]; if (i === 0) c.moveTo(p0[0], p0[1]); else c.lineTo(p0[0], p0[1]); c.lineTo(cx + Math.cos(a + pa) * r1, cy + Math.sin(a + pa) * r1); c.lineTo(cx + Math.cos(a + pa) * r0, cy + Math.sin(a + pa) * r0); } c.closePath(); };
  }
  /** BEATS Handwinde: [0] Beschriftungen/Lupe, [1] Heben beginnt, [2] Last oben – Klinke sperrt. */
  function ehTimes(T) { const d = T.d, t0 = T.beat(1, 0.08 * d + 0.25), t1 = Math.max(t0 + 0.8, T.beat(2, Math.max(t0 + 1.6, 0.62 * d))); return { t0, t1 }; }
  function ehState(t, T) {
    const k = easeInOut(inv(T.t0, T.t1, t)), travel = EH.rise * k, th = -travel / EH.drR;
    const pa = TAU / EH.ratN, loc = ((((EH.phiP - th) / pa) % 1) + 1) % 1;
    const lifting = inv(T.t0, T.t0 + 0.2, t) * (1 - inv(T.t1 - 0.15, T.t1, t));
    const sway = t > T.t1 ? 3 * Math.sin((t - T.t1) * 2.6) * Math.exp(-(t - T.t1) * 0.5) + 0.8 * Math.sin(t * 1.3) : 1.2 * Math.sin(t * 2.1) * lifting;
    return { T, k, travel, th, thK: -th * (EH.gR / EH.pR) + 0.2, loc, lifting, held: t > T.t1, sway, hook: EH.hook0 - travel };
  }
  function ehBg(g) {
    drawPlateFrame(g);
    g.save(); g.beginPath(); plateClip(g); g.clip();
    stk(g, (c) => { for (let y = PL.y + 8; y < 700; y += 7) for (let x = PL.x; x < PL.x + PL.w; x += 95) if (h01(x * 0.9 + y * 1.7) < 0.3 + 0.4 * (y - PL.y) / 600) { const o = h01(x + y) * 40; c.moveTo(x + o, y); c.lineTo(x + o + 30 + 45 * h01(y + x * 2), y); } }, COL.ink, 0.7, 0.13);
    // Hügel + ferne Stadt
    stk(g, (c) => { c.moveTo(PL.x, 700); for (let x = PL.x; x <= PL.x + PL.w; x += 20) c.lineTo(x, 690 - 30 * Math.sin(x * 0.004) - 12 * Math.sin(x * 0.013)); }, COL.ink, 1, 0.3);
    for (let i = 0; i < 14; i++) { const x = 170 + i * 36, h = 30 + 50 * h01(i * 3.1); const b = (c) => { c.moveTo(x, 700); c.lineTo(x, 700 - h); c.lineTo(x + 14, 700 - h - (i % 4 === 0 ? 40 : 12)); c.lineTo(x + 28, 700 - h); c.lineTo(x + 28, 700); c.closePath(); }; fil(g, b, "#140e07", 0.9); stk(g, b, COL.ink, 0.9, 0.25); }
    // Mauerwerk im Bau (rechts) mit Gerüst
    const wall = (c) => { c.moveTo(1290, EH.ground); c.lineTo(1290, 700); c.lineTo(1400, 700); c.lineTo(1400, 640); c.lineTo(1640, 640); c.lineTo(1640, 600); c.lineTo(PL.x + PL.w, 600); c.lineTo(PL.x + PL.w, EH.ground); c.closePath(); };
    fil(g, wall, "#1c140a", 0.95);
    g.save(); g.beginPath(); wall(g); g.clip();
    stk(g, (c) => { for (let y = 600, r = 0; y < EH.ground; y += 20, r++) { c.moveTo(1290, y); c.lineTo(PL.x + PL.w, y); for (let x = 1290 + (r % 2 ? 30 : 0); x < PL.x + PL.w; x += 60) { c.moveTo(x, y); c.lineTo(x, y + 20); } } }, COL.ink, 0.9, 0.45);
    hatch(g, wall, 1290, 600, 530, 260, 50, 5, COL.ink, 0.6, 0.18);
    g.restore();
    stk(g, wall, COL.pale, 1.3, 0.7);
    stk(g, (c) => { for (const x of [1560, 1700, 1800]) { c.moveTo(x, EH.ground); c.lineTo(x, 470); } c.moveTo(1540, 560); c.lineTo(PL.x + PL.w, 560); c.moveTo(1540, 480); c.lineTo(PL.x + PL.w, 480); c.moveTo(1560, 560); c.lineTo(1700, 480); }, COL.wood, 1.6, 0.5);
    // Boden
    stk(g, (c) => { c.moveTo(PL.x, EH.ground); c.lineTo(PL.x + PL.w, EH.ground); for (let x = PL.x; x < PL.x + PL.w; x += 26) { c.moveTo(x, EH.ground + 8 + 10 * h01(x)); c.lineTo(x + 14, EH.ground + 8 + 10 * h01(x)); } }, COL.ink, 1, 0.5);
    hatch(g, rectB(PL.x, EH.ground, PL.w, 40), PL.x, EH.ground, PL.w, 40, 20, 6, COL.ink, 0.6, 0.18);
    // Ausleger-Mast mit Streben
    const mast = rectB(1100, 316, 20, EH.ground - 316), jib = rectB(1086, 316, 424, 18);
    for (const b of [mast, jib]) { fil(g, b, "#2b1a0a", 0.96); hatch(g, b, 1086, 316, 424, EH.ground - 316, 90, 4, COL.wood, 0.7, 0.4); stk(g, b, COL.wood, 1.7, 0.95, 0.4); }
    stk(g, (c) => { c.moveTo(1120, 560); c.lineTo(1400, 334); c.moveTo(1100, 780); c.lineTo(1040, EH.ground); c.moveTo(1120, 780); c.lineTo(1180, EH.ground); }, COL.wood, 3, 0.9, 0.3);
    stk(g, (c) => { for (const [x, y] of [EH.P1, EH.P2]) { c.moveTo(x - 10, 334); c.lineTo(x - 4, y); c.moveTo(x + 10, 334); c.lineTo(x + 4, y); } }, COL.pale, 2, 0.8);
    // Windenbock
    stk(g, (c) => { c.moveTo(640, 700); c.lineTo(800, 700); }, COL.wood, 4, 0.55);
    stk(g, (c) => { c.moveTo(518, EH.ground); c.lineTo(640, 572); c.moveTo(922, EH.ground); c.lineTo(800, 572); c.moveTo(528, 836); c.lineTo(912, 836); c.moveTo(640, 700); c.lineTo(590, 700); c.moveTo(800, 700); c.lineTo(852, 700); c.moveTo(566, 745); c.lineTo(596, 745); }, COL.wood, 5, 0.95, 0.3);
    stk(g, (c) => { c.moveTo(545, 800); c.lineTo(600, 836); c.moveTo(895, 800); c.lineTo(840, 836); }, COL.wood, 3, 0.8);
    fil(g, rectB(704, 684, 32, 32), "#2b1a0a", 1); stk(g, rectB(704, 684, 32, 32), COL.pale, 1.2, 0.7);
    const cap = rectB(624, 560, 192, 14); fil(g, cap, "#2b1a0a", 1); hatch(g, cap, 624, 560, 192, 14, 0, 3.5, COL.wood, 0.7, 0.5); stk(g, cap, COL.wood, 1.6, 0.95);
    g.restore();
  }
  function ehMech(ctx, S, lite) {
    const [gx, gy] = EH.G, [kx, ky] = EH.K;
    // Seiltrommel (hinter dem Zahnrad) mit Seilwindungen
    fil(ctx, (c) => c.arc(gx, gy, EH.drR, 0, TAU), "#20150a", 1);
    stk(ctx, (c) => { for (let r = 30; r < EH.drR; r += 3.5) { c.moveTo(gx + r, gy); c.arc(gx, gy, r, 0, TAU); } }, COL.sepia, 0.9, 0.55);
    stk(ctx, (c) => c.arc(gx, gy, EH.drR, 0, TAU), COL.pale, 1.4, 0.9);
    // Stirnrad (Speichen) + Ritzel
    const gb = gearB(gx, gy, EH.gR, EH.gN, 8, S.th);
    stk(ctx, gb, COL.ink, 1.6, 1, lite ? 0 : 0.5);
    stk(ctx, (c) => { c.moveTo(gx + EH.gR - 14, gy); c.arc(gx, gy, EH.gR - 14, 0, TAU); for (let i = 0; i < 5; i++) { const a = S.th + i * TAU / 5; c.moveTo(gx + Math.cos(a) * 20, gy + Math.sin(a) * 20); c.lineTo(gx + Math.cos(a) * (EH.gR - 14), gy + Math.sin(a) * (EH.gR - 14)); c.moveTo(gx + Math.cos(a + 0.06) * 20, gy + Math.sin(a + 0.06) * 20); c.lineTo(gx + Math.cos(a + 0.03) * (EH.gR - 14), gy + Math.sin(a + 0.03) * (EH.gR - 14)); } }, COL.ink, 1.4, 0.85);
    const pb = gearB(kx, ky, EH.pR, EH.pN, 6, S.thK);
    fil(ctx, pb, "#20150a", 1); stk(ctx, pb, COL.ink, 1.5, 1, lite ? 0 : 0.5);
    // Sperrrad (auf der Trommelwelle) + Sperrklinke
    const rb = ratchetB(gx, gy, EH.ratRoot, EH.ratTip, EH.ratN, S.th);
    fil(ctx, rb, "#171210", 1); stk(ctx, rb, COL.cyan, 1.5, 1, 0.6);
    fil(ctx, (c) => c.arc(gx, gy, 7, 0, TAU), COL.pale, 1);
    const rTipNow = EH.ratRoot + (EH.ratTip - EH.ratRoot) * S.loc;
    const tx = gx + Math.cos(EH.phiP) * rTipNow, ty = gy + Math.sin(EH.phiP) * rTipNow;
    const pv = [gx + Math.cos(EH.phiP + 0.55) * (EH.ratTip + 24), gy + Math.sin(EH.phiP + 0.55) * (EH.ratTip + 24)];
    const ux = tx - pv[0], uy = ty - pv[1], ul = Math.hypot(ux, uy) || 1, nx = -uy / ul, ny = ux / ul;
    const pw = [[pv[0] + nx * 5, pv[1] + ny * 5], [tx + nx * 1.5, ty + ny * 1.5], [tx - nx * 1.5, ty - ny * 1.5], [pv[0] - nx * 5, pv[1] - ny * 5]];
    fil(ctx, polyB(pw, true), "#1c1712", 1); stk(ctx, polyB(pw, true), COL.pale, 1.4, 1, 0.5);
    fil(ctx, (c) => c.arc(pv[0], pv[1], 3.5, 0, TAU), COL.pale, 1);
    stk(ctx, (c) => { c.moveTo(pv[0] - 10, pv[1] - 14); c.lineTo(pv[0] + 10, pv[1] - 14); c.moveTo(pv[0], pv[1] - 14); c.lineTo(pv[0], pv[1]); c.moveTo(pv[0] - 6, pv[1] - 14); c.lineTo(pv[0] - 6, 574); c.moveTo(pv[0] + 6, pv[1] - 14); c.lineTo(pv[0] + 6, 574); }, COL.pale, 1.6, 0.9);
    { // Klick-Blitz beim Überspringen eines Zahns / Halten
      const fl = S.held ? 0.35 + 0.25 * Math.sin(S.tt * 4) : S.lifting * clamp(1 - S.loc / 0.25);
      if (fl > 0.02) dot(ctx, tx, ty, 12, S.held ? COL.ink : COL.cyan, fl);
    }
    // Handkurbel (auf der Ritzelwelle)
    const hx = kx + Math.cos(S.thK) * EH.crR, hy = ky + Math.sin(S.thK) * EH.crR;
    stk(ctx, (c) => { c.moveTo(kx, ky); c.lineTo(hx, hy); }, COL.pale, 4, 1, 0.4);
    fil(ctx, (c) => { c.arc(hx, hy, 5.5, 0, TAU); c.moveTo(kx + 5, ky); c.arc(kx, ky, 5, 0, TAU); }, COL.pale, 1);
    return { hx, hy, tx, ty };
  }
  function ehRope(ctx, S) {
    const [gx, gy] = EH.G, [p1x, p1y] = EH.P1, [p2x, p2y] = EH.P2, r = EH.pr;
    const D = Math.hypot(p1x - gx, p1y - gy), be = Math.atan2(p1y - gy, p1x - gx), a = be - Math.acos(EH.drR / D);
    const T0 = [gx + Math.cos(a) * EH.drR, gy + Math.sin(a) * EH.drR];
    const u = [p1x - T0[0], p1y - T0[1]], ul = Math.hypot(u[0], u[1]), na = Math.atan2(-u[0] / ul, u[1] / ul) + Math.PI;
    const hx = p2x + r + S.sway;
    rope(ctx, (c) => { c.moveTo(T0[0], T0[1]); c.lineTo(p1x + Math.cos(na) * r, p1y + Math.sin(na) * r); c.arc(p1x, p1y, r, na, Math.PI * 1.5); c.lineTo(p2x, p2y - r); c.arc(p2x, p2y, r, Math.PI * 1.5, TAU); c.lineTo(hx, S.hook); }, COL.pale, 3, 0.95, S.travel);
    return hx;
  }
  function ehLoad(ctx, hx, hy) {
    const bw = 120, bh = 84, top = hy + 44, x0 = hx - bw / 2;
    stk(ctx, (c) => { c.moveTo(hx, hy); c.quadraticCurveTo(hx + 12, hy + 12, hx + 4, hy + 18); c.moveTo(hx, hy + 14); c.lineTo(x0 + 10, top); c.moveTo(hx, hy + 14); c.lineTo(x0 + bw - 10, top); }, COL.pale, 2.2, 0.95, 0.4);
    const b = rectB(x0, top, bw, bh);
    fil(ctx, b, "#241a0e", 1); hatch(ctx, b, x0, top, bw, bh, 30, 4, COL.ink, 0.7, 0.45); hatch(ctx, rectB(x0 + bw * 0.6, top, bw * 0.4, bh), x0, top, bw, bh, -40, 4, COL.ink, 0.7, 0.4);
    stk(ctx, b, COL.ink, 1.8, 1, 0.6);
    stk(ctx, (c) => { c.moveTo(x0 + 6, top + 6); c.lineTo(x0 + bw - 6, top + 6); c.lineTo(x0 + bw - 6, top + bh - 6); }, COL.pale, 0.8, 0.5);
    return { top, bot: top + bh, x0, x1: x0 + bw };
  }
  function drawHoist(ctx, p, cfg, TM) {
    const { L, t } = p, d = TM.d, S = ehState(t, ehTimes(TM)); S.tt = t;
    const lab0 = TM.beat(0, Math.min(0.12 * d, 1.2) + 0.3), ti = Math.min(lab0, Math.max(0.3, 0.08 * d));
    layer(ctx, "eh_bg", PL.x - 12, PL.y - 12, PL.w + 24, PL.h + 24, 1, ehBg);
    ctx.save(); ctx.beginPath(); plateClip(ctx); ctx.clip();
    motes(ctx, t, 30, PL.x, 300, PL.w, 540, COL.pale, 11, 0.8);
    ctx.restore();
    pulley(ctx, EH.P1[0], EH.P1[1], EH.pr, -S.travel / EH.pr, COL.pale);
    pulley(ctx, EH.P2[0], EH.P2[1], EH.pr, -S.travel / EH.pr, COL.pale);
    const hx = ehRope(ctx, S);
    const ld = ehLoad(ctx, hx, S.hook);
    // Schatten der Last am Boden
    fil(ctx, (c) => c.ellipse(EH.P2[0] + EH.pr, EH.ground + 4, 70 * (1 - 0.4 * S.k), 6, 0, 0, TAU), "#000", 0.35);
    const m = ehMech(ctx, S, false);
    // Arbeiter an der Kurbel
    const lean = 6 * Math.cos(S.thK), wx = 522 + lean * S.lifting;
    figure(ctx, L, wx, EH.ground, 150, COL.sepia, 0.92, { hat: "cap", arms: [[m.hx, m.hy, wx + 20, 780], [m.hx + 3, m.hy + 3]] });
    fil(ctx, (c) => { c.arc(m.hx, m.hy, 5.5, 0, TAU); }, COL.pale, 1);
    // Detail-Lupe: Sperrrad
    const ai = easeOut(inv(ti, ti + 0.6, t));
    if (ai > 0.004) {
      const I = EINS, sc = lerp(0.86, 1, ai), r = I.r * sc, sG = GA; GA = sG * ai;
      const vx = I.fx - I.x, vy = I.fy - I.y, vl = Math.hypot(vx, vy), nx = -vy / vl, ny = vx / vl, rs = I.r / I.z;
      stk(ctx, (c) => { c.moveTo(I.x + nx * r, I.y + ny * r); c.lineTo(I.fx + nx * rs, I.fy + ny * rs); c.moveTo(I.x - nx * r, I.y - ny * r); c.lineTo(I.fx - nx * rs, I.fy - ny * rs); }, COL.cyan, 1.1, 0.45);
      stk(ctx, (c) => c.arc(I.fx, I.fy, rs, 0, TAU), COL.cyan, 1.3, 0.7, 0.4, [5, 4], -t * 8);
      ctx.save(); ctx.beginPath(); ctx.arc(I.x, I.y, r, 0, TAU); ctx.clip();
      fil(ctx, (c) => c.arc(I.x, I.y, r, 0, TAU), "rgb(9,8,8)", 0.95);
      ctx.translate(I.x, I.y); ctx.scale(I.z * sc, I.z * sc); ctx.translate(-I.fx, -I.fy);
      const sW = WM; WM = 0.5; ehMech(ctx, S, true); WM = sW;
      ctx.restore();
      stk(ctx, (c) => c.arc(I.x, I.y, r, 0, TAU), COL.ink, 2.2, 0.95, 0.6);
      stk(ctx, (c) => c.arc(I.x, I.y, r + 7, 0, TAU), COL.ink, 0.9, 0.45);
      stk(ctx, (c) => { for (let i = 0; i < 72; i++) { const q = i * TAU / 72 + t * 0.05, l = i % 6 ? 4 : 9; c.moveTo(I.x + Math.cos(q) * (r + 7), I.y + Math.sin(q) * (r + 7)); c.lineTo(I.x + Math.cos(q) * (r + 7 + l), I.y + Math.sin(q) * (r + 7 + l)); } }, COL.ink, 1, 0.5);
      txt(L, ctx, "DETAIL · SPERRRAD MIT KLINKE", I.x, I.y - r - 28, { size: 18, weight: 700, font: L.FONT.mono, color: COL.ink, align: "center", letterSpacing: 2 });
      const st = S.held ? "HALTEN – KLINKE SPERRT" : "HEBEN – KLINKE RATSCHT", sc2 = S.held ? COL.ink : COL.cyan;
      const sw = meas(L, ctx, st, { size: 16, weight: 700, font: L.FONT.head, letterSpacing: 1.5 }) + 24;
      fil(ctx, (c) => rr(c, I.x - sw / 2, I.y + r - 48, sw, 28, 4), "rgb(8,8,12)", 0.9);
      stk(ctx, (c) => rr(c, I.x - sw / 2, I.y + r - 48, sw, 28, 4), sc2, 1.2, 0.8);
      txt(L, ctx, st, I.x, I.y + r - 28, { size: 16, weight: 700, font: L.FONT.head, color: sc2, align: "center", letterSpacing: 1.5 });
      GA = sG;
    }
    const hdr = drawHeader(ctx, L, t, TM, cfg, { title: "FRÜHES HEBEZEUG", sub: "Seiltrommel · Handkurbel · Sperrklinke", size: 30, subSize: 20 }, cfg.ov);
    const A = {
      drum: { re: /trommel|welle|haspel|walze/, g: () => ({ tx: EH.G[0] - 34, ty: EH.G[1] + 36, bx: 470, by: 640, align: "right" }) },
      crank: { re: /kurbel/, g: () => ({ tx: m.hx, ty: m.hy, bx: 440, by: 790, align: "right" }) },
      gear: { re: /zahnrad|vorgelege|getriebe|ritzel|übersetz/, g: () => ({ tx: EH.G[0] + 80, ty: EH.G[1] + 76, bx: 940, by: 812 }) },
      pulley: { re: /rolle|umlenk|flasche/, g: () => ({ tx: EH.P2[0], ty: EH.P2[1] + 14, bx: 1560, by: 430 }) },
      load: { re: /last|stein|fracht|ladung|gewicht|kiste/, g: () => ({ tx: ld.x1, ty: (ld.top + ld.bot) / 2, bx: 1600, by: 560 }) },
      ratchet: { re: /sperr|klinke|ratsche/, g: () => ({ tx: m.tx, ty: m.ty, bx: 960, by: 520 }) },
      rope: { re: /seil|tau/, g: () => ({ tx: 930, ty: 531, bx: 960, by: 450 }) },
      worker: { re: /arbeiter|mann|knecht|mensch|person|helfer/, g: () => ({ tx: 526, ty: EH.ground - 150, bx: 440, by: 712, align: "right" }) },
      mast: { re: /ausleger|mast|kran|galgen/, g: () => ({ tx: 1300, ty: 325, bx: 1150, by: 250 }) },
    };
    const defs = [{ key: "drum", text: "Seiltrommel" }, { key: "crank", text: "Handkurbel" }, { key: "gear", text: "Zahnradvorgelege" }, { key: "pulley", text: "Umlenkrolle" }, { key: "load", text: "Last" }];
    drawLabels(ctx, L, t, TM, resolveLabels(cfg.items, A, ["drum", "crank", "gear", "pulley", "load", "ratchet", "rope", "worker", "mast"], defs, lab0, clamp(0.06 * d, 0.2, 0.4)), A, hdr);
  }

  // =====================================================================================
  // Parameter + Registrierung
  // =====================================================================================
  function pick(P, keys) { for (const k of keys) { const v = P[k]; if (v !== undefined && v !== null && v !== "") return v; } return undefined; }
  function bool(v) {
    if (v === undefined || v === null || v === "") return undefined;
    if (typeof v === "boolean") return v; if (typeof v === "number") return v !== 0;
    const s = String(v).trim().toLowerCase();
    if (["true", "1", "ja", "yes", "on", "wahr"].includes(s)) return true;
    if (["false", "0", "nein", "no", "off", "falsch"].includes(s)) return false;
    return undefined;
  }
  function str(v, n = 80) { return v === undefined || v === null || typeof v === "object" ? "" : String(v).trim().slice(0, n); }
  function numv(v) { if (v === undefined || v === null || v === "" || typeof v === "boolean") return undefined; const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : undefined; }
  function listv(v) { return Array.isArray(v) ? v.map((x) => String(x).toLowerCase()) : v == null || v === "" ? [] : String(v).toLowerCase().split(/[,;|]/); }
  function config(P, p) {
    P = P && typeof P === "object" ? P : {};
    const raw = String(pick(P, ["scene", "szene", "template_scene", "type", "name"]) || "").toLowerCase();
    const vraw = String(pick(P, ["variant", "mode", "variante"]) || "").toLowerCase();
    const act = String(pick(P, ["action", "aktion", "event"]) || "").toLowerCase();
    const sraw = raw || vraw;
    let scene = "otis_1854_demo";
    if (/princip|prinzip|otis_detail|safety_catch|federsperre|fangvorrichtung|catch_detail/.test(raw + " " + vraw) || /pawl|engage|greif|rope_break|rope_snap|snap|reiss|reiß|release/.test(act)) scene = "otis_principle";
    else if (/haughwout|1857|palazzo|broadway/.test(sraw)) scene = "haughwout_1857";
    else if (/empire|1945|esb|skyscraper|wolkenkratzer/.test(sraw)) scene = "empire_state_1945_schematic";
    else if (/hoist|winde|haspel|early|crank|kurbel|drum|trommel|medieval|mittelalter/.test(sraw)) scene = "early_hoist";
    const items = labelItems(P), texts = (items || []).map((q) => q.text);
    const has = (keys) => pick(P, keys) !== undefined;
    let variant = "";
    if (scene === "otis_1854_demo" && /newspaper|zeitung|paper|presse|notiz/.test(vraw)) variant = "newspaper";
    if (scene === "empire_state_1945_schematic") {
      const sil = String(pick(P, ["silhouettes", "figures", "people"]) || "").toLowerCase();
      if (/rescue|rettung|helfer|carry|trag|bergung/.test(vraw) || /helper|helfer|carry|trag/.test(sil)) variant = "rescue";
      else if (/impact|crash|b-?25|aufprall|einschlag|bomber|flugzeug|plane/.test(vraw) || has(["aircraft", "plane", "flugzeug", "impact_floor", "engine_paths"])) variant = "impact";
      else variant = "fall";
    }
    const np = variant === "newspaper";
    const floorFromLabels = (() => { for (const s of texts) { const m = /(\d{1,3})\s*\.?\s*(stock|etage|og|floor)/i.exec(s); if (m) return +m[1]; } return undefined; })();
    const year = str(pick(P, ["year_label", "date_label", "year", "jahr", "date", "datum"]), 12);
    const title = str(pick(P, ["title", "titel", "heading"])), capt = str(pick(P, ["subtitle", "untertitel", "sub", "caption"]));
    const ovText = norm((p && p.text) || "");
    const subtitle = capt && ovText && ovText.includes(norm(capt)) ? "" : capt;
    const hb = bool(pick(P, ["header", "title_plate", "show_title", "kopfzeile"]));
    const qv = pick(P, ["quote", "zitat"]), qb = bool(qv);
    const hl = listv(pick(P, ["highlight", "highlights", "hervorheben"])).join(" ");
    const fogv = pick(P, ["fog", "nebel"]), fb = bool(fogv), fn = numv(fogv);
    const dimv = pick(P, ["dim_background", "dim", "abdunkeln"]), db = bool(dimv), dn = numv(dimv);
    const dropv = pick(P, ["platform_drop", "drop_label", "drop", "fallweg"]);
    const spv = pick(P, ["speed_label", "speed", "tempo"]);
    const eng = listv(pick(P, ["engine_paths", "engine_path", "triebwerk"])).map((s) => (/shaft|schacht/.test(s) ? "shaft" : /through|durch|building|haus|out/.test(s) ? "through" : "")).filter(Boolean);
    const cfg = {
      scene, variant, items,
      action: np || /none|static|stand|idle|keine|ohne|still/.test(act) ? "none" : "rope_cut",
      audience: bool(pick(P, ["audience", "crowd", "publikum"])) !== false,
      inset: !np && bool(pick(P, ["inset", "detail_lens", "lupe", "show_inset"])) !== false,
      dropText: dropv === false ? "" : str(dropv, 40) || "wenige cm",
      dim: dn !== undefined ? clamp(dn, 0, 0.85) : db === true ? 0.55 : db === false ? 0 : np ? 0.5 : 0,
      paperLabel: str(pick(P, ["newspaper_label", "paper_label", "zeitung_label"]), 24) || (np ? year || "1854" : ""),
      note: str(pick(P, ["highlight_note", "note", "note_text", "randnotiz"]), 110) || "schneidet gelegentlich das Seil durch",
      year: np && !has(["year_label", "year", "jahr"]) ? "" : year, title, subtitle,
      titleAt: pick(P, ["year_at", "title_at", "header_at"]),
      quote: qb === true ? true : qb === false || qv === undefined ? false : str(qv, 90), quoteBy: str(pick(P, ["quote_by", "quote_source", "quelle"]), 60), quoteAt: pick(P, ["quote_at"]),
      hlShaft: /shaft|schacht|elevator|aufzug/.test(hl),
      floor: numv(pick(P, ["from_floor", "floor", "etage", "mark_floor", "stock"])) || floorFromLabels,
      impactFloor: numv(pick(P, ["impact_floor", "floor", "etage", "stock"])) || floorFromLabels,
      aircraft: str(pick(P, ["aircraft", "plane", "flugzeug"]), 24),
      engine: eng,
      fog: fn !== undefined ? clamp(fn, 0, 1) : fb === true ? 0.8 : fb === false ? 0 : variant === "impact" ? 0.5 : 0,
      measure: bool(pick(P, ["measure", "dimension", "show_distance", "masskette"])) !== false,
      distance: str(pick(P, ["distance_label", "fall_label", "distance"]), 40), distanceSub: pick(P, ["distance_sub", "fall_sub"]) !== undefined ? str(pick(P, ["distance_sub", "fall_sub"]), 40) : null,
      speed: spv === false || bool(spv) === false ? "" : str(spv, 30) || "v ≈ 0,2 m/s",
      status: bool(pick(P, ["status", "show_status"])) !== false,
      panelTitle: str(pick(P, ["panel_title", "detail_title"]), 40),
      ov: norm(((p && p.text) || "") + " " + texts.join(" ")),
    };
    cfg.header = hb === undefined ? !np || !!(cfg.year || title) : hb;
    if (cfg.floor) cfg.floor = clamp(Math.round(cfg.floor), 5, 101);
    if (cfg.impactFloor) cfg.impactFloor = clamp(Math.round(cfg.impactFloor), 5, 101);
    return cfg;
  }

  /** Hintergrund (Verlauf + Raster wie L.background) einmal rastern und ohne Kamera-Transformation blitten. */
  function backdrop(ctx, p) {
    const L = p.L, W = p.W || 1920, H = p.H || 1080;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    let cv = SPR.get("bg|" + W + "x" + H);
    if (cv === undefined) {
      cv = null;
      try { const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d", { alpha: false }); if (g) { L.background(g, W, H, 0); cv = c; } } catch (e) { cv = null; }
      SPR.set("bg|" + W + "x" + H, cv);
    }
    if (cv) ctx.drawImage(cv, 0, 0); else L.background(ctx, W, H, p.T || 0);
    ctx.restore();
  }

  CE.register("historic_scene", {
    ownsText: false,
    background: false,
    draw(ctx, p) {
      GA = 1; WM = 1;
      backdrop(ctx, p);
      let cfg; try { cfg = config(p.params, p); } catch (e) { cfg = config({}, p); }
      const T = timing(p);
      try {
        if (cfg.scene === "haughwout_1857") drawHaughwout(ctx, p, cfg, T);
        else if (cfg.scene === "empire_state_1945_schematic") drawEmpire(ctx, p, cfg, T);
        else if (cfg.scene === "early_hoist") drawHoist(ctx, p, cfg, T);
        else if (cfg.scene === "otis_principle") drawPrinciple(ctx, p, cfg, T);
        else drawOtis(ctx, p, cfg, T);
      } finally { GA = 1; WM = 1; }
    },
  });
})();
