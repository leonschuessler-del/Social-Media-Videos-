/* Template "shaft_xray" – Hero-Template: Röntgen-Querschnitt eines Gebäudes mit Treibscheibenaufzug.
   Triebwerksraum (Treibscheibe, Antrieb mit Bremse, Ablenkrolle, Geschwindigkeitsbegrenzer), Tragseile,
   Kabine mit Fangvorrichtung, Gegengewicht, Führungsschienen, Begrenzerseil mit Spannrolle, Puffer in der Schachtgrube.
   Params: focus (full|car|machine_room|pit|ropes), state (idle|moving_up|moving_down|rope_snap|all_ropes_snap|
   overspeed|safety_engage|stopped|on_buffer), rope_count, broken_ropes, highlight[], labels[],
   optional: floors (3–8), floor (Start-Haltestelle, 0 = EG), to_floor, speed (Nenngeschwindigkeit m/s), people, hud. */
(function () {
  const TAU = Math.PI * 2;
  const COL = { cyan: "#3fd2ff", amber: "#ffb347", red: "#ff5a5f", green: "#5be49b", white: "#eef6ff", steel: "#9fc4e6", muted: "#8fb3d9", hot: "#ffe3a8" };

  // ---------- kleine Helfer ----------
  const num = (v, d) => { if (v == null || v === "") return d; const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : Number(v); return Number.isFinite(n) ? n : d; };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sat = (x) => clamp(x, 0, 1);
  const smooth = (x) => { x = sat(x); return x * x * (3 - 2 * x); };
  const easeOut = (x) => 1 - Math.pow(1 - sat(x), 3);
  const easeInOut = (x) => { x = sat(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const lerp = (a, b, t) => a + (b - a) * t;
  const h01 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const fmt = (v, dec) => Math.abs(v).toFixed(dec).replace(".", ",");
  const key = (s) => String(s == null ? "" : s).trim().toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[\s\-]+/g, "_");
  const rgba = (hex, a) => { const h = hex.replace("#", ""); return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`; };

  /** Einfache Linie ohne Glow (günstig). */
  function stroke(ctx, build, color, width, alpha, dash, dashOffset) {
    if (alpha <= 0.003) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (dash) { ctx.setLineDash(dash); ctx.lineDashOffset = dashOffset || 0; }
    ctx.beginPath(); build(ctx); ctx.stroke(); ctx.restore();
  }
  /** Glühende Linie (3 Striche) – für Hauptbauteile. */
  let ZS = 1; // Zoomfaktor – Halo-Breiten bleiben in Nahansichten auf dem Bildschirm konstant (spart Füllfläche)
  let VIS = [-1e9, -1e9, 1e9, 1e9]; // sichtbarer Weltausschnitt (für Culling in Nahansichten)
  const vis = (x0, y0, x1, y1) => x1 >= VIS[0] && x0 <= VIS[2] && y1 >= VIS[1] && y0 <= VIS[3];
  function glow(ctx, L, build, color, width, g, alpha) {
    if (alpha <= 0.003) return;
    alpha = clamp(alpha, 0, 1);
    ctx.save(); ctx.strokeStyle = color; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); build(ctx);
    if (g > 0.01) { ctx.globalAlpha = alpha * Math.min(0.5, 0.2 * g); ctx.lineWidth = width + (5 * Math.min(g, 2)) / ZS; ctx.stroke(); }
    ctx.globalAlpha = alpha; ctx.lineWidth = width; ctx.stroke(); ctx.restore();
  }
  function fill(ctx, build, color, alpha) {
    if (alpha <= 0.003) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.beginPath(); build(ctx); ctx.fill(); ctx.restore();
  }
  /** Günstiges Panel (Füllung + eine Kontur, ohne Glow-Mehrfachstriche). */
  function panel(ctx, x, y, w, h, o) {
    if (w <= 0.5 || (o.alpha ?? 1) <= 0.003) return;
    ctx.save(); ctx.globalAlpha = o.alpha ?? 1; ctx.fillStyle = o.fill || "rgba(6,16,34,0.84)";
    ctx.beginPath(); rr(ctx, x, y, w, h, o.r ?? 10); ctx.fill();
    ctx.strokeStyle = o.stroke || "rgba(63,210,255,0.4)"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
  }
  /** Günstiger Leuchtpunkt: drei konzentrische Kreise statt Radialverlauf. */
  function softDot(ctx, x, y, r, color, alpha) {
    if (alpha <= 0.01 || r <= 0) return;
    ctx.save(); ctx.fillStyle = color;
    ctx.globalAlpha = 0.1 * alpha; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.16 * alpha; ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.35 * alpha; ctx.beginPath(); ctx.arc(x, y, r * 0.25, 0, TAU); ctx.fill();
    ctx.restore();
  }
  const rr = (c, x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };

  // ---------- Parameter ----------
  const STATE_ALIAS = {
    idle: "idle", normal: "idle", ruhe: "idle", stillstand: "idle", parked: "idle",
    moving_up: "moving_up", up: "moving_up", moving: "moving_up", move_up: "moving_up", aufwaerts: "moving_up", fahrt_aufwaerts: "moving_up", ascending: "moving_up",
    moving_down: "moving_down", down: "moving_down", move_down: "moving_down", abwaerts: "moving_down", fahrt_abwaerts: "moving_down", descending: "moving_down",
    rope_snap: "rope_snap", snap: "rope_snap", seilriss: "rope_snap", one_rope_snap: "rope_snap", rope_break: "rope_snap", rope_breaks: "rope_snap",
    all_ropes_snap: "all_ropes_snap", all_snap: "all_ropes_snap", all_ropes_break: "all_ropes_snap", all_ropes_broken: "all_ropes_snap", fall: "all_ropes_snap", falling: "all_ropes_snap", free_fall: "all_ropes_snap", freefall: "all_ropes_snap",
    overspeed: "overspeed", governor_trip: "overspeed", uebergeschwindigkeit: "overspeed", trip: "overspeed", governor: "overspeed",
    safety_engage: "safety_engage", safety: "safety_engage", catch: "safety_engage", engage: "safety_engage", fangen: "safety_engage", safety_gear: "safety_engage", braking: "safety_engage",
    stopped: "stopped", stop: "stopped", held: "stopped", hold: "stopped", gehalten: "stopped", safe: "stopped", caught: "stopped",
    on_buffer: "on_buffer", buffer: "on_buffer", puffer: "on_buffer", bottom: "on_buffer", auf_puffer: "on_buffer",
  };
  const FOCUS_ALIAS = {
    full: "full", whole: "full", all: "full", building: "full", gebaeude: "full", overview: "full", total: "full",
    car: "car", cabin: "car", cab: "car", kabine: "car", fahrkorb: "car", safety_gear: "car", fangvorrichtung: "car",
    machine_room: "machine_room", machine: "machine_room", machineroom: "machine_room", top: "machine_room", triebwerksraum: "machine_room", maschinenraum: "machine_room", sheave: "machine_room", governor: "machine_room", treibscheibe: "machine_room",
    pit: "pit", bottom: "pit", schachtgrube: "pit", buffer: "pit", buffers: "pit", puffer: "pit",
    ropes: "ropes", rope: "ropes", seile: "ropes", tragseile: "ropes",
  };
  const PART_ALIAS = {
    ropes: "ropes", rope: "ropes", tragseile: "ropes", tragseil: "ropes", seile: "ropes", seil: "ropes", suspension_ropes: "ropes",
    car: "car", cabin: "car", cab: "car", kabine: "car", fahrkorb: "car", elevator_car: "car",
    counterweight: "counterweight", gegengewicht: "counterweight", cw: "counterweight",
    sheave: "sheave", traction_sheave: "sheave", treibscheibe: "sheave",
    governor: "governor", overspeed_governor: "governor", geschwindigkeitsbegrenzer: "governor", begrenzer: "governor", regler: "governor",
    governor_rope: "governor_rope", begrenzerseil: "governor_rope", reglerseil: "governor_rope",
    safety_gear: "safety_gear", safety: "safety_gear", fangvorrichtung: "safety_gear", safeties: "safety_gear", wedges: "safety_gear", fangkeile: "safety_gear",
    rails: "rails", rail: "rails", guide_rails: "rails", guide_rail: "rails", fuehrungsschienen: "rails", fuehrungsschiene: "rails", schienen: "rails",
    buffers: "buffers", buffer: "buffers", puffer: "buffers",
    brake: "brake", bremse: "brake", motor: "brake", machine: "brake", antrieb: "brake", drive: "brake",
    machine_room: "machine_room", triebwerksraum: "machine_room", maschinenraum: "machine_room",
    pit: "pit", schachtgrube: "pit", grube: "pit",
    deflector: "deflector", ablenkrolle: "deflector", umlenkrolle: "deflector", deflector_sheave: "deflector",
    tension_pulley: "tension_pulley", spannrolle: "tension_pulley", spanngewicht: "tension_pulley",
    shaft: "shaft", schacht: "shaft",
  };
  const PART_NAME = { ropes: "Tragseile", car: "Kabine", counterweight: "Gegengewicht", sheave: "Treibscheibe", governor: "Geschwindigkeitsbegrenzer", governor_rope: "Begrenzerseil", safety_gear: "Fangvorrichtung", rails: "Führungsschienen", buffers: "Puffer", brake: "Antrieb mit Bremse", machine_room: "Triebwerksraum", pit: "Schachtgrube", deflector: "Ablenkrolle", tension_pulley: "Spannrolle", shaft: "Schacht" };
  const KEYWORDS = [
    [/begrenzerseil|reglerseil|governor.?rope/, "governor_rope"], [/begrenzer|governor|regler/, "governor"], [/fang|safety|keil/, "safety_gear"],
    [/treibscheibe|sheave/, "sheave"], [/ablenk|umlenk|deflect/, "deflector"], [/spannrolle|spanngewicht|tension/, "tension_pulley"],
    [/gegengewicht|counterweight/, "counterweight"], [/schiene|rail/, "rails"], [/puffer|buffer/, "buffers"],
    [/bremse|brake|motor|antrieb|maschine\b|drive/, "brake"], [/triebwerk|maschinenraum|machine.?room/, "machine_room"], [/grube|pit/, "pit"],
    [/seil|rope/, "ropes"], [/kabine|fahrkorb|\bcar\b|cabin/, "car"], [/schacht|shaft/, "shaft"],
  ];
  const normPart = (s) => { const k = key(s); if (PART_ALIAS[k]) return PART_ALIAS[k]; const low = String(s || "").toLowerCase(); for (const [re, p] of KEYWORDS) if (re.test(low)) return p; return null; };
  const toList = (v) => (Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,;|]/) : v != null && typeof v === "object" ? [v] : []);

  function parseLabels(v, hl) {
    if (v === true || v === "auto" || v === "all") return (hl.length ? hl : ["car", "ropes", "sheave", "counterweight"]).map((p) => ({ part: p, text: PART_NAME[p] }));
    const arr = Array.isArray(v) ? v : typeof v === "string" && v.trim() ? v.split(/[;|]/) : v && typeof v === "object" ? [v] : [];
    const out = [];
    for (const it of arr) {
      if (it == null || it === false) continue;
      if (typeof it === "object") {
        let part = normPart(it.part ?? it.target ?? it.id ?? it.name ?? it.of ?? "");
        const text = String(it.text ?? it.label ?? it.title ?? (part ? PART_NAME[part] : "") ?? "").trim();
        if (!part && text) part = normPart(text);
        if (text) out.push({ part, text });
      } else {
        const s = String(it).trim(); if (!s) continue;
        const m = s.match(/^([a-z_]+)\s*[:=]\s*(.+)$/);
        if (m && PART_NAME[m[1]]) out.push({ part: m[1], text: m[2].trim() });
        else out.push({ part: normPart(s), text: s });
      }
    }
    const used = new Set(out.filter((o) => o.part).map((o) => o.part));
    const fallback = [...hl, "car", "ropes", "sheave", "counterweight", "governor", "safety_gear", "rails", "buffers", "brake"];
    for (const o of out) if (!o.part) { o.part = fallback.find((p) => !used.has(p)) || "car"; used.add(o.part); }
    return out.slice(0, 8);
  }

  function parseParams(pr) {
    pr = pr && typeof pr === "object" ? pr : {};
    const state = STATE_ALIAS[key(pr.state ?? pr.mode ?? "idle")] || "idle";
    const fRaw = pr.focus ?? pr.frame ?? pr.zoom ?? "full";
    const focus = (typeof fRaw === "string" && FOCUS_ALIAS[key(fRaw)]) || "full";
    const n = Math.round(clamp(num(pr.rope_count ?? pr.ropes ?? pr.n_ropes ?? pr.rope_n, 6), 1, 12));
    const floors = Math.round(clamp(num(pr.floors ?? pr.storeys ?? pr.stockwerke ?? pr.levels, 6), 3, 8));
    // gerissene Seile: Anzahl, Index-Liste oder "all"
    let bRaw = pr.broken_ropes ?? pr.broken ?? pr.snapped_ropes ?? pr.broken_rope;
    let broken = [];
    const spread = (k) => { const order = []; for (let j = 0; j < n; j++) order.push(j % 2 === 0 ? n - 1 - (j >> 1) : j >> 1); return order.slice(0, k); };
    if (Array.isArray(bRaw)) broken = [...new Set(bRaw.map((x) => Math.round(num(x, -1))).filter((x) => x >= 0 && x < n))];
    else if (typeof bRaw === "string" && /all|alle/i.test(bRaw)) broken = spread(n);
    else if (bRaw === true) broken = spread(1);
    else { const k = Math.round(clamp(num(bRaw, 0), 0, n)); broken = spread(k); }
    if (state === "rope_snap" && broken.length === 0) broken = spread(Math.min(1, n));
    if (state === "all_ropes_snap") broken = spread(n);
    broken.sort((a, b) => a - b);
    const highlight = [...new Set(toList(pr.highlight ?? pr.highlights ?? pr.hl).map(normPart).filter(Boolean))];
    const labels = parseLabels(pr.labels ?? pr.callouts ?? pr.label, highlight);
    const floorV = pr.floor ?? pr.car_floor ?? pr.start_floor ?? pr.from_floor ?? pr.position;
    const toV = pr.to_floor ?? pr.target_floor ?? pr.to ?? pr.end_floor;
    return {
      state, focus, n, floors, broken, allBroken: broken.length >= n, highlight, hl: new Set(highlight), labels,
      floor: floorV == null ? null : num(floorV, null), toFloor: toV == null ? null : num(toV, null),
      vNom: clamp(num(pr.speed ?? pr.nominal_speed ?? pr.v_nenn ?? pr.rated_speed, 1.6), 0.3, 10),
      people: Math.round(clamp(num(pr.people ?? pr.passengers ?? pr.persons, 2), 0, 4)),
      hud: pr.hud !== false && pr.show_speed !== false && pr.panel !== false,
    };
  }

  // ---------- Geometrie (Welt = Bildschirm-Pixel in der Gesamtansicht) ----------
  function geometry(o) {
    const N = o.floors, S0 = 943, SW = 334, S1 = S0 + SW;
    const yBot = 832, PB = 900;
    const fh = clamp(437 / (N - 1), 62, 100);
    const yTop = yBot - fh * (N - 1);
    const CH = Math.min(70, 0.8 * fh);
    const slabBot = yTop - CH - 26 - 36, slabTop = slabBot - 16;
    const G = {
      N, S0, S1, SW, yBot, PB, fh, yTop, CH, slabBot, slabTop,
      MRtop: slabTop - 142, MR0: S0 - 28, MR1: S1 + 40, yRoof: yTop - fh, BX0: S0 - 150, BX1: S1 + 150,
      cwRailL: S0 + 16, cwRailR: S0 + 80, cwX0: S0 + 26, cwW: 44, cwCX: S0 + 48, CWH: 70,
      railL: S0 + 102, railR: S0 + 258, carX0: S0 + 116, carW: 128, carCX: S0 + 180,
      gx: S0 + 304, rg: 17, gy: slabTop - 30, R: 50, rd: 26,
      bufH: 38, cwBufH: 30,
    };
    G.carX1 = G.carX0 + G.carW;
    G.gL = G.gx - G.rg; G.gR = G.gx + G.rg;
    G.sx = G.carCX - G.R; G.sy = slabTop - 70;
    G.bx = G.cwCX + G.rd; G.by = slabBot + 39;
    G.bufTop = PB - G.bufH; G.cwBufTop = PB - G.cwBufH;
    G.cwBotLow = G.cwBufTop - 8;
    G.tpY = PB - 40; G.tpR = G.rg;
    const n = o.n, gap = n > 1 ? Math.min(3.3, 20 / (n - 1)) : 0;
    G.bundle = gap * (n - 1);
    G.ropes = [];
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * gap, Ra = G.R + off, Rb = G.rd + off;
      const dx = G.bx - G.sx, dy = G.by - G.sy, D = Math.hypot(dx, dy);
      const be = Math.atan2(dy, dx) + Math.acos(clamp((Ra - Rb) / D, -1, 1));
      G.ropes.push({ i, off, Ra, Rb, be, px: G.bx + Rb * Math.cos(be), py: G.by + Rb * Math.sin(be), carX: G.carCX + off, cwX: G.bx - Rb });
    }
    { const Ra = G.R, Rb = G.rd, dx = G.bx - G.sx, dy = G.by - G.sy, be = Math.atan2(dy, dx) + Math.acos(clamp((Ra - Rb) / Math.hypot(dx, dy), -1, 1));
      G.center = { i: -1, off: 0, Ra, Rb, be, px: G.bx + Rb * Math.cos(be), py: G.by + Rb * Math.sin(be), carX: G.carCX, cwX: G.bx - Rb }; }
    G.levelY = (z) => yBot - z * fh;
    return G;
  }

  // ---------- Bewegungsmodell (deterministisch, Phasen relativ zu d) ----------
  const trap = (x, fa = 0.22) => { // Trapez-Fahrkurve: Weg s und normierte Geschwindigkeit w (0..1)
    x = sat(x); const vp = 1 / (1 - fa);
    if (x < fa) return { s: 0.5 * (vp / fa) * x * x, w: x / fa };
    if (x > 1 - fa) return { s: 1 - 0.5 * (vp / fa) * (1 - x) * (1 - x), w: (1 - x) / fa };
    return { s: 0.5 * vp * fa + vp * (x - fa), w: 1 };
  };
  function travelEnds(o, top) {
    const up = o.state === "moving_up";
    let a = o.floor != null ? clamp(o.floor, 0, top) : up ? Math.min(1, top - 1) : Math.max(1, top - 1);
    let b = o.toFloor != null ? clamp(o.toFloor, 0, top) : up ? (o.floor != null ? Math.min(top, a + 3) : top - 1) : (o.floor != null ? Math.max(0, a - 3) : 1);
    if (up && b <= a) { if (a >= top) a = top - 1; b = Math.min(top, a + 1); }
    if (!up && b >= a) { if (a <= 0) a = 1; b = Math.max(0, a - 1); }
    return [a, b];
  }
  const snapStart = (d) => clamp(0.18 * d, 0.5, 2.2);
  const allSnapTimes = (d, n) => { const t0 = clamp(0.12 * d, 0.4, 1.6), gap = Math.min(0.14, (0.22 * d) / Math.max(1, n)); return { t0, gap, end: t0 + gap * (n - 1) + 0.08 }; };
  const engageTimes = (d) => { const te = clamp(0.12 * d, 0.35, 1.5); const tS = te + clamp(0.4 * d, 1.0, 5); return { te, tS, w0: 0.45 / (te + (tS - te) / 2) }; };
  const rampT = (d) => Math.min(0.85 * d, 8.2); // overspeed: v steigt von 1,5 auf 2,12 m/s (×vNenn/1,6); Auslösung bei 115 % nach 0,548·rampT
  const bufTimes = (d) => ({ a: Math.min(0.12 * d, 0.8), c: Math.min(0.33 * d, 2.4) }); // on_buffer: Anfahrt, Einfedern
  const travelT = (d) => ({ a: Math.min(0.06 * d, 0.6), T: Math.min(0.84 * d, 10) }); // moving_*: Start, Fahrzeit

  function startZ(o, top, def, minZ) { return clamp(Math.max(o.floor != null ? o.floor : def, minZ), 0, top); }

  /** Kabinen-Schwellenhöhe (Welt-y) zur Zeit tt. */
  function carYAt(o, G, tt, d) {
    const top = G.N - 1, Y = G.levelY;
    switch (o.state) {
      case "moving_up": case "moving_down": { const [a, b] = travelEnds(o, top), T = travelT(d); return Y(a + (b - a) * trap((tt - T.a) / T.T).s); }
      case "rope_snap": { const ts = snapStart(d); let y = Y(startZ(o, top, top - 1, 0)); if (tt > ts) { const a = tt - ts; y += 3.2 * Math.exp(-a * 3.2) * Math.sin(a * 17); } return y; }
      case "all_ropes_snap": { const S = allSnapTimes(d, o.n); const x = sat((tt - S.end) / Math.max(0.5, 0.97 * d - S.end)); return Y(startZ(o, top, top - 1, 0.8)) + 0.5 * G.fh * x * x; }
      case "overspeed": { const x = sat(tt / d); return Y(startZ(o, top, top - 1.5, 1.1)) + 0.9 * G.fh * (0.55 * x + 0.45 * x * x); }
      case "safety_engage": {
        const E = engageTimes(d); let s;
        if (tt < E.te) s = E.w0 * tt;
        else if (tt < E.tS) { const q = tt - E.te; s = E.w0 * E.te + E.w0 * (q - (q * q) / (2 * (E.tS - E.te))); }
        else s = 0.45;
        return Y(startZ(o, top, top - 2.4, 0.8)) + s * G.fh;
      }
      case "stopped": return Y(startZ(o, top, top - 2.85, 0.35));
      case "on_buffer": {
        const B = bufTimes(d), yc = G.bufTop - 16;
        if (tt < B.a) return yc - 12 * (1 - tt / B.a);
        return yc + 0.55 * easeOut((tt - B.a) / B.c) * G.bufH;
      }
      default: return Y(startZ(o, top, Math.min(2, top), 0));
    }
  }

  function motion(o, G, t, d, u) {
    const k = o.vNom / 1.6, vTrip = 1.15 * o.vNom;
    const M = { carY: carYAt(o, G, t, d), v: 0, brake: 1, wedge: 0, heat: 0, tripT: null, lever: 0, slow: false, speedPanel: false, status: "", statusCol: COL.cyan,
      snaps: {}, ropePanel: false, holdA: 0, streak: null, bufComp: 0, gov: COL.cyan, govSpin: 0, sparks: null, dir: 0 };
    const st = o.state;
    // Riss-Zeitpunkte je Seil
    const S = allSnapTimes(d, o.n);
    o.broken.forEach((idx, j) => { M.snaps[idx] = st === "rope_snap" ? snapStart(d) + j * 0.12 : st === "all_ropes_snap" ? S.t0 + j * S.gap : -100; });
    if (st === "moving_up" || st === "moving_down") {
      const T = travelT(d), x = (t - T.a) / T.T, tr = trap(x), up = st === "moving_up";
      M.v = (up ? 1 : -1) * o.vNom * tr.w; M.dir = x > 0 && x < 1 ? (up ? 1 : -1) : 0;
      M.brake = 1 - smooth(x / 0.03) * smooth((1 - x) / 0.03);
      M.speedPanel = true; M.status = x >= 1 ? "Haltestelle erreicht" : up ? "Fahrt aufwärts" : "Fahrt abwärts"; M.statusCol = x >= 1 ? COL.green : COL.cyan;
    } else if (st === "rope_snap") {
      M.ropePanel = true; M.holdA = smooth((t - snapStart(d) - 0.55) / 0.35);
    } else if (st === "all_ropes_snap") {
      const x = sat((t - S.end) / Math.max(0.5, 0.97 * d - S.end));
      M.v = -1.72 * k * x; M.dir = x > 0 ? -1 : 0; M.speedPanel = true; M.slow = t > S.t0;
      M.status = t < S.t0 ? "Normalbetrieb" : t < S.end ? "Tragseile reißen" : "Alle Seile gerissen"; M.statusCol = t < S.t0 ? COL.cyan : COL.red;
    } else if (st === "overspeed") {
      const tTrip = 0.548 * rampT(d);
      M.v = -(1.5 + 0.62 * Math.min(1, t / rampT(d))) * k; M.dir = -1; M.speedPanel = true; M.slow = true;
      M.tripT = tTrip; M.brake = t >= tTrip ? 1 : 0;
      if (t >= tTrip) { M.lever = clamp((M.carY - carYAt(o, G, tTrip, d)) / 24, 0, 0.6); M.wedge = 0.3 * smooth((t - tTrip) / 0.5); }
      M.status = t < tTrip ? "Übergeschwindigkeit" : "Begrenzer ausgelöst"; M.statusCol = t < tTrip ? COL.amber : COL.red;
    } else if (st === "safety_engage") {
      const E = engageTimes(d), v0 = 2.0 * k;
      M.v = t < E.te ? -v0 : t < E.tS ? -v0 * (1 - (t - E.te) / (E.tS - E.te)) : 0; M.dir = M.v < -0.01 ? -1 : 0;
      M.speedPanel = true; M.slow = true; M.tripT = -1;
      M.lever = clamp((12 + M.carY - carYAt(o, G, 0, d)) / 24, 0, 0.6);
      M.wedge = smooth((t - (E.te - 0.2)) / 0.25);
      M.heat = t < E.te ? 0 : t < E.tS ? 1 : Math.exp(-(t - E.tS) * 0.9);
      const yE = carYAt(o, G, E.te, d); M.streak = { y0: yE, y1: M.carY };
      M.sparks = { t0: E.te, t1: E.tS, yAt: (tt) => carYAt(o, G, tt, d) };
      M.status = t < E.te ? "Begrenzer ausgelöst" : t < E.tS ? "Fangvorrichtung greift" : "Kabine gehalten";
      M.statusCol = t < E.te ? COL.red : t < E.tS ? COL.amber : COL.green;
    } else if (st === "stopped") {
      M.speedPanel = true; M.tripT = -1; M.lever = 0.6; M.wedge = 1; M.heat = 0.18;
      M.streak = { y0: M.carY - 0.32 * G.fh, y1: M.carY };
      M.status = "Kabine gehalten"; M.statusCol = COL.green;
    } else if (st === "on_buffer") {
      const B = bufTimes(d), q = (t - B.a) / B.c;
      const vImp = Math.min(1.0, o.vNom);
      M.v = t < B.a ? -vImp : -vImp * Math.pow(1 - sat(q), 2);
      M.bufComp = t < B.a ? 0 : 0.55 * easeOut(q);
      M.speedPanel = true; M.dir = M.v < -0.02 ? -1 : 0; M.slow = t >= B.a && q < 1;
      M.status = t < B.a ? "Aufsetzen" : q < 1 ? "Puffer dämpft" : "Kabine auf Puffer"; M.statusCol = q < 1 ? COL.amber : COL.green;
    } else {
      M.status = "Stillstand";
    }
    // Geschwindigkeitsbegrenzer: Farbe + Drehwinkel (friert nach Auslösung ein)
    const av = Math.abs(M.v);
    if (M.tripT != null && t >= M.tripT) M.gov = COL.red;
    else if (st === "overspeed" || st === "all_ropes_snap") M.gov = av > vTrip ? COL.red : av > o.vNom * 1.01 ? COL.amber : COL.cyan;
    const tg = M.tripT != null ? Math.min(t, Math.max(0, M.tripT)) : t;
    M.govY = M.tripT === -1 ? carYAt(o, G, 0, d) : carYAt(o, G, tg, d);
    M.govSpin = M.tripT != null && t >= M.tripT ? 0 : av / Math.max(0.5, o.vNom);
    M.tripped = M.tripT != null && t >= M.tripT;
    M.trippedAge = M.tripped ? (M.tripT < 0 ? 5 + t : t - M.tripT) : 0;
    // Gegengewicht (Seillänge konstant) bzw. frei fallend, wenn alle Seile gerissen
    let cwBot = G.cwBotLow - (M.carY - G.yTop);
    if (o.allBroken) {
      if (st === "all_ropes_snap") { const x = sat((t - S.end) / Math.max(0.5, 0.97 * d - S.end)); cwBot = G.cwBotLow - (carYAt(o, G, 0, d) - G.yTop) + 0.5 * G.fh * x * x; }
      else cwBot = G.cwBufTop + 0.3 * G.cwBufH;
    }
    M.cwBot = Math.min(cwBot, G.cwBufTop + 0.45 * G.cwBufH);
    M.cwComp = sat((M.cwBot - G.cwBufTop) / G.cwBufH);
    M.cwTop = M.cwBot - G.CWH;
    M.cwDrop = o.allBroken && st === "all_ropes_snap" ? M.cwBot - (G.cwBotLow - (carYAt(o, G, 0, d) - G.yTop)) : 0;
    // Treibscheibe: Drehwinkel aus Seilweg (Gegenuhrzeigersinn bei Aufwärtsfahrt)
    const refY = o.allBroken ? carYAt(o, G, 0, d) : M.carY;
    M.sheaveA = -(G.yBot - refY) / G.R;
    M.deflA = -(G.yBot - refY) / G.rd;
    M.govA = (G.yBot - M.govY) / G.rg;
    M.tpA = (G.yBot - M.govY) / G.tpR;
    M.hitchY = M.carY - G.CH - 26;
    M.allSnapped = o.allBroken && Object.values(M.snaps).every((tb) => t >= tb);
    return M;
  }

  // ---------- Stil: Hervorhebung (Amber, pulsierend) / Abdunkeln ----------
  function makeStyle(o, t) {
    const any = o.hl.size > 0, pulse = 0.5 + 0.5 * Math.sin(t * TAU * 0.8);
    return (part, base) => { const h = o.hl.has(part); return { h, c: h ? COL.amber : base, a: any ? (h ? 1 : 0.52) : 1, g: h ? 1.2 + 0.7 * pulse : 1, w: h ? 1.3 : 1, pulse }; };
  }

  // ---------- Bauwerk: Erdreich, Geschosse, Schacht, Triebwerksraum ----------
  function drawStructure(ctx, L, G, o, sty, t) {
    const sh = sty("shaft", COL.cyan), pit = sty("pit", COL.cyan), mr = sty("machine_room", COL.cyan);
    const base = o.hl.size ? 0.55 : 1;
    const x0 = G.BX0 - 120, x1 = G.BX1 + 120, yG = G.yBot + 8;
    const walls = (c) => {
      c.rect(G.S0 - 8, G.slabBot, 8, G.PB + 10 - G.slabBot); c.rect(G.S1, G.slabBot, 8, G.PB + 10 - G.slabBot); c.rect(G.S0 - 8, G.PB, G.SW + 16, 10);
    };
    const mrp = (c) => {
      c.rect(G.MR0 - 8, G.MRtop - 8, G.MR1 - G.MR0 + 16, 8);
      c.rect(G.MR0 - 8, G.MRtop, 8, G.yRoof - G.MRtop); c.rect(G.MR1, G.MRtop, 8, G.yRoof - G.MRtop);
      c.rect(G.MR0, G.slabTop, G.MR1 - G.MR0, G.slabBot - G.slabTop);
    };
    {
      if (sh.h) glow(ctx, L, walls, COL.amber, 1.4 * sh.w, 0.45 * sh.g, 0.95);
      if (pit.h) glow(ctx, L, (c) => c.rect(G.S0 + 2, G.yBot + 10, G.SW - 4, G.PB - G.yBot - 12), COL.amber, 2, pit.g, 0.8);
      if (mr.h) { glow(ctx, L, mrp, COL.amber, 1.4 * mr.w, 0.45 * mr.g, 0.95); fill(ctx, (c) => c.rect(G.MR0, G.MRtop, G.MR1 - G.MR0, G.slabTop - G.MRtop), COL.amber, 0.04 + 0.03 * mr.pulse); }
    }
    // Erdreich-Schraffur (ohne Schachtgrube)
    stroke(ctx, (c) => {
      for (const [rx0, ry0, rx1, ry1] of [[x0, yG, G.S0 - 8, G.PB + 46], [G.S1 + 8, yG, x1, G.PB + 46], [G.S0 - 8, G.PB + 10, G.S1 + 8, G.PB + 46]]) {
        if (!vis(rx0, ry0, rx1, ry1)) continue;
        for (let k = Math.ceil((rx0 + ry0) / 16) * 16; k < rx1 + ry1; k += 16) { const ya = Math.min(ry1, k - rx0), yb = Math.max(ry0, k - rx1); c.moveTo(k - ya, ya); c.lineTo(k - yb, yb); }
      }
    }, COL.cyan, 1, 0.075 * base);
    const gGrad = ctx.createLinearGradient(x0, 0, x1, 0);
    gGrad.addColorStop(0, "rgba(63,210,255,0)"); gGrad.addColorStop(0.12, "rgba(63,210,255,0.55)"); gGrad.addColorStop(0.88, "rgba(63,210,255,0.55)"); gGrad.addColorStop(1, "rgba(63,210,255,0)");
    stroke(ctx, (c) => { c.moveTo(x0, yG); c.lineTo(G.S0 - 8, yG); c.moveTo(G.S1 + 8, yG); c.lineTo(x1, yG); }, gGrad, 2, base);
    // Geschossdecken + Außenwände + Dach
    const slabs = (c) => {
      for (let k = 1; k < G.N; k++) { const y = G.levelY(k); c.rect(G.BX0, y, G.S0 - 8 - G.BX0, 7); c.rect(G.S1 + 8, y, G.BX1 - G.S1 - 8, 7); }
      c.rect(G.BX0 - 8, G.yRoof - 8, G.MR0 - 8 - (G.BX0 - 8), 8); c.rect(G.MR1 + 8, G.yRoof - 8, G.BX1 + 8 - (G.MR1 + 8), 8);
      c.rect(G.BX0 - 8, G.yRoof - 8, 8, G.yBot + 8 - G.yRoof + 8); c.rect(G.BX1, G.yRoof - 8, 8, G.yBot + 8 - G.yRoof + 8);
    };
    fill(ctx, slabs, "rgba(63,210,255,0.07)", base);
    stroke(ctx, slabs, COL.cyan, 1.2, 0.3 * base);
    // Fenster (angedeutet) in den Außenwänden
    stroke(ctx, (c) => { for (let k = 0; k < G.N; k++) { const y = G.levelY(k); c.moveTo(G.BX0 - 4, y - G.fh * 0.25); c.lineTo(G.BX0 - 4, y - G.fh * 0.7); c.moveTo(G.BX1 + 4, y - G.fh * 0.25); c.lineTo(G.BX1 + 4, y - G.fh * 0.7); } }, COL.cyan, 2, 0.35 * base);
    // Schachttüren (Röntgen: vorne, gestrichelt)
    stroke(ctx, (c) => { for (let k = 0; k < G.N; k++) { const y = G.levelY(k); if (vis(G.carX0, y - G.CH, G.carX1, y)) c.rect(G.carX0 + 14, y - G.CH * 0.92, G.carW - 28, G.CH * 0.92); } }, COL.cyan, 1, 0.08 * base);
    // Schachtwände + Grube, Triebwerksraum (Aufbau auf dem Dach)
    fill(ctx, walls, "rgba(63,210,255,0.06)", base);
    if (!sh.h) stroke(ctx, walls, COL.cyan, 1.4, 0.5 * base);
    fill(ctx, mrp, "rgba(63,210,255,0.07)", base);
    if (!mr.h) stroke(ctx, mrp, COL.cyan, 1.4, 0.55 * base);
  }

  function drawRails(ctx, L, G, sty, M) {
    const s = sty("rails", COL.steel), yA = G.slabBot + 2, yB = G.PB;
    const rails = (c) => { c.moveTo(G.railL, yA); c.lineTo(G.railL, yB); c.moveTo(G.railR, yA); c.lineTo(G.railR, yB); };
    {
      if (s.h) glow(ctx, L, rails, s.c, 3 * s.w, 0.45 * s.g, s.a); else { stroke(ctx, rails, s.c, 3 + 4 / ZS, 0.08 * s.a); stroke(ctx, rails, s.c, 3, 0.85 * s.a); }
      stroke(ctx, (c) => { c.moveTo(G.cwRailL, yA); c.lineTo(G.cwRailL, yB); c.moveTo(G.cwRailR, yA); c.lineTo(G.cwRailR, yB); }, s.c, 2, 0.7 * s.a);
      stroke(ctx, (c) => { for (let y = G.slabBot + G.fh * 0.35; y < G.PB - 10; y += G.fh * 0.5) { for (const x of [G.railL, G.railR, G.cwRailL, G.cwRailR]) { c.moveTo(x - 6, y); c.lineTo(x + 6, y); } } }, s.h ? COL.amber : COL.cyan, 1.5, 0.3 * s.a);
    }
    // Bremsspur der Fangvorrichtung
    if (M.streak) {
      const y0 = Math.min(M.streak.y0, M.streak.y1) + 10, y1 = Math.max(M.streak.y0, M.streak.y1) + 12;
      if (y1 - y0 > 1) for (const x of [G.railL, G.railR]) {
        const gr = ctx.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, "rgba(255,90,95,0.15)"); gr.addColorStop(1, `rgba(255,179,71,${0.55 + 0.4 * M.heat})`);
        stroke(ctx, (c) => { c.moveTo(x, y0); c.lineTo(x, y1); }, gr, 5, 1);
        stroke(ctx, (c) => { c.moveTo(x, y0); c.lineTo(x, y1); }, gr, 12, 0.3);
        stroke(ctx, (c) => { c.moveTo(x, y0 + (y1 - y0) * 0.4); c.lineTo(x, y1); }, "#fff2d6", 1.6, 0.4 + 0.5 * M.heat);
      }
    }
  }

  function drawBuffers(ctx, L, G, sty, M) {
    if (!vis(G.S0, G.PB - 60, G.S1, G.PB + 10)) return;
    const s = sty("buffers", COL.steel), col = M.bufComp > 0.02 && !s.h ? COL.amber : s.c;
    const h = G.bufH * (1 - M.bufComp), cyl = G.bufH * 0.42;
    const oil = (c) => { for (const dx of [-36, 36]) { const x = G.carCX + dx; c.rect(x - 9, G.PB - cyl, 18, cyl); c.moveTo(x, G.PB - cyl); c.lineTo(x, G.PB - h + 2); c.rect(x - 13, G.PB - h - 3, 26, 4); } };
    fill(ctx, (c) => { for (const dx of [-36, 36]) c.rect(G.carCX + dx - 9, G.PB - cyl, 18, cyl); }, col, 0.1 * s.a);
    if (s.h || M.bufComp > 0.02) glow(ctx, L, oil, col, 2 * s.w, 0.6 * s.g, 0.9 * s.a); else stroke(ctx, oil, col, 2, 0.9 * s.a);
    if (M.bufComp > 0.01) { const k = M.bufComp / 0.55; for (const dx of [-36, 36]) L.glowDot(ctx, G.carCX + dx, G.PB - cyl + 4, 22, COL.amber, 0.5 * k); }
    // Federpuffer unter dem Gegengewicht
    const hc = G.cwBufH * (1 - M.cwComp), x = G.cwCX, turns = 5, cc = M.cwComp > 0.02 && !s.h ? COL.amber : s.c;
    glow(ctx, L, (c) => {
      c.moveTo(x - 12, G.PB - 2); for (let i = 0; i <= turns * 2; i++) c.lineTo(x + (i % 2 ? 9 : -9), G.PB - 3 - ((hc - 6) * i) / (turns * 2));
      c.rect(x - 13, G.PB - hc - 4, 26, 4);
    }, cc, 1.8 * s.w, s.h ? 0.5 * s.g : 0, 0.85 * s.a);
  }

  // ---------- Begrenzerseil, Spannrolle, Geschwindigkeitsbegrenzer ----------
  function drawGovernor(ctx, L, G, o, sty, M, t) {
    const sr = sty("governor_rope", COL.steel), sg = sty("governor", COL.cyan), tp = sty("tension_pulley", COL.steel);
    {
      const gx = G.gx, gy = G.gy;
      stroke(ctx, (c) => { rr(c, gx - 30, gy - 42, 60, G.slabTop - gy + 42, 6); }, sg.c, 1, 0.35 * sg.a, [4, 4]);
      stroke(ctx, (c) => { c.moveTo(gx - 18, G.slabTop); c.lineTo(gx - 3, gy + 3); c.moveTo(gx + 18, G.slabTop); c.lineTo(gx + 3, gy + 3); c.moveTo(gx - 22, G.slabTop - 1); c.lineTo(gx + 22, G.slabTop - 1); }, COL.steel, 1.6, 0.7 * sg.a);
    }
    const pivX = G.railR + 7, pivY = M.carY + 8, len = G.gL - pivX;
    const tipX = pivX + len * Math.cos(M.lever), tipY = pivY - len * Math.sin(M.lever);
    const loop = (c) => { c.moveTo(G.gL, tipY); c.lineTo(G.gL, G.gy); c.arc(G.gx, G.gy, G.rg, Math.PI, TAU); c.lineTo(G.gR, G.tpY); c.arc(G.gx, G.tpY, G.tpR, 0, Math.PI); c.closePath(); };
    const ropeCol = sr.h ? COL.amber : M.tripped ? COL.red : sr.c;
    if (sr.h) glow(ctx, L, loop, ropeCol, 1.5 * sr.w, 0.45 * sr.g, sr.a); else { stroke(ctx, loop, ropeCol, 4, 0.1 * sr.a); stroke(ctx, loop, ropeCol, 1.5, (M.tripped ? 0.85 : 0.75) * sr.a); }
    stroke(ctx, (c) => { c.moveTo(G.gL, tipY); c.lineTo(G.gL, G.gy); c.moveTo(G.gR, G.gy); c.lineTo(G.gR, G.tpY); }, "#ffffff", 1.2, 0.35 * sr.a, [2, 7], (G.gy - tipY) % 9);
    // Spannrolle mit Spanngewicht
    const tc = tp.h ? COL.amber : sr.h ? COL.amber : COL.steel;
    stroke(ctx, (c) => { c.moveTo(G.gx - 4, G.tpY); c.lineTo(G.gx - 6, G.PB - 13); c.moveTo(G.gx + 4, G.tpY); c.lineTo(G.gx + 6, G.PB - 13); c.rect(G.gx - 10, G.PB - 13, 20, 10); }, tc, 1.3, 0.75 * Math.max(tp.a, sr.a));
    fill(ctx, (c) => c.rect(G.gx - 10, G.PB - 13, 20, 10), tc, 0.2 * Math.max(tp.a, sr.a));
    stroke(ctx, (c) => { c.arc(G.gx, G.tpY, G.tpR - 4, 0, TAU); for (let i = 0; i < 3; i++) { const a = M.tpA + (i * TAU) / 3; c.moveTo(G.gx, G.tpY); c.lineTo(G.gx + Math.cos(a) * (G.tpR - 4), G.tpY + Math.sin(a) * (G.tpR - 4)); } }, tc, 1.3, 0.75 * Math.max(tp.a, sr.a));
    // Hebel + Verbindungsgestänge zur Fangvorrichtung
    const lc = M.tripped ? COL.red : sty("safety_gear", COL.steel).c;
    glow(ctx, L, (c) => { c.moveTo(pivX, pivY); c.lineTo(tipX, tipY); }, lc, 2.4, 0.6, 0.95 * Math.max(sr.a, 0.6));
    L.fillCircle(ctx, pivX, pivY, 2.6, lc); L.fillCircle(ctx, tipX, tipY, 2.2, "#ffffff");
    // Geschwindigkeitsbegrenzer im Triebwerksraum
    if (!vis(G.gx - 40, G.gy - 50, G.gx + 40, G.slabTop + 2)) return;
    const gc = M.gov !== COL.cyan ? M.gov : sg.c, ga = Math.max(sg.a, M.gov !== COL.cyan ? 1 : 0);
    const gx = G.gx, gy = G.gy, r = G.rg;
    fill(ctx, (c) => c.arc(gx, gy, r, 0, TAU), "#06101f", 0.85);
    glow(ctx, L, (c) => c.arc(gx, gy, r, 0, TAU), gc, 2.2 * sg.w, (M.gov === COL.red ? 1.5 : 1) * sg.g, ga);
    stroke(ctx, (c) => { for (let i = 0; i < 12; i++) { const a = M.govA + (i * TAU) / 12; c.moveTo(gx + Math.cos(a) * (r - 5), gy + Math.sin(a) * (r - 5)); c.lineTo(gx + Math.cos(a + 0.18) * (r - 1.5), gy + Math.sin(a + 0.18) * (r - 1.5)); } }, gc, 1.2, 0.8 * ga);
    const spread = clamp(M.govSpin * 0.75, 0, 1), fl = r * (0.28 + 0.3 * spread);
    stroke(ctx, (c) => { for (const k of [0, Math.PI]) { const a = M.govA * 1 + k; c.moveTo(gx, gy); c.lineTo(gx + Math.cos(a) * fl, gy + Math.sin(a) * fl); } }, gc, 1.4, ga);
    for (const k of [0, Math.PI]) { const a = M.govA + k; L.fillCircle(ctx, gx + Math.cos(a) * fl, gy + Math.sin(a) * fl, 2.6, gc); }
    if (M.govSpin > 0.15) stroke(ctx, (c) => { for (let i = 0; i < 3; i++) { const a = M.govA + (i * TAU) / 3; c.moveTo(gx + Math.cos(a) * (r - 3), gy + Math.sin(a) * (r - 3)); c.arc(gx, gy, r - 3, a, a - 0.9 * Math.min(1.5, M.govSpin)); } }, gc, 2, 0.35 * ga * Math.min(1, M.govSpin));
    L.fillCircle(ctx, gx, gy, 2.5, "#ffffff");
    // Sperrklinke (fällt bei Auslösung in die Verzahnung)
    const pvx = gx + 23, pvy = gy - 25, a1 = Math.atan2(gy - 15.5 - pvy, gx + 9 - pvx), a0 = a1 + 0.95;
    const pk = M.tripped ? L.easeOutBack(sat(M.trippedAge / 0.3)) : 0, pa = lerp(a0, a1, pk);
    glow(ctx, L, (c) => { c.moveTo(pvx, pvy); c.lineTo(pvx + Math.cos(pa) * 16.5, pvy + Math.sin(pa) * 16.5); }, M.tripped ? COL.red : gc, 2.4, M.tripped ? 1.3 : 0.6, ga);
    L.fillCircle(ctx, pvx, pvy, 2.4, M.tripped ? COL.red : gc);
    if (M.tripped) L.glowDot(ctx, pvx + Math.cos(pa) * 16.5, pvy + Math.sin(pa) * 16.5, 12 + 10 * Math.exp(-M.trippedAge * 3), COL.red, 0.5 + 0.4 * Math.exp(-M.trippedAge * 2));
  }

  // ---------- Antrieb: Treibscheibe, Motor-/Bremsblock, Ablenkrolle ----------
  function drawMachine(ctx, L, G, o, sty, M, t) {
    if (!vis(G.MR0, G.MRtop - 10, G.MR1, G.by + 45)) return;
    const sb = sty("brake", COL.steel), ss = sty("sheave", COL.cyan), sd = sty("deflector", COL.cyan);
    const sx = G.sx, sy = G.sy, Rs = G.R - G.bundle / 2 - 3, Rf = G.R + G.bundle / 2 + 3;
    const hx0 = sx - 50, hx1 = sx + 72, hy0 = sy - 66, hy1 = G.slabTop - 14;
    const hc = sb.h ? COL.amber : COL.steel;
    const bx = G.bx, by = G.by, rDisc = G.rd - G.bundle / 2 - 3, rFl = G.rd + G.bundle / 2 + 3;
    const dc = sd.h ? COL.amber : COL.cyan, da = sd.h ? 1 : ss.a;
    {
      // Maschinenrahmen + Schwingungsdämpfer, Motor-/Bremsblock (hinter der Scheibe)
      stroke(ctx, (c) => { c.rect(sx - 64, G.slabTop - 14, 144, 7); for (const dx of [-54, -14, 26, 66]) c.rect(sx + dx - 5, G.slabTop - 7, 10, 7); }, COL.steel, 1.3, 0.7 * sb.a);
      if (!sb.h) {
        fill(ctx, (c) => rr(c, hx0, hy0, hx1 - hx0, hy1 - hy0, 12), hc, 0.06);
        stroke(ctx, (c) => rr(c, hx0, hy0, hx1 - hx0, hy1 - hy0, 12), hc, 1.5, 0.55 * sb.a);
        stroke(ctx, (c) => { for (let y = hy0 + 12; y < hy1 - 8; y += 7) { c.moveTo(hx1, y); c.lineTo(hx1 + 7, y); } }, hc, 1.3, 0.5 * sb.a);
        stroke(ctx, (c) => c.arc(sx, sy, Rs + 4, 0, TAU), hc, 1, 0.35 * sb.a, [3, 4]);
      }
      stroke(ctx, (c) => { c.arc(sx, sy, Rf, 0, TAU); }, ss.c, 1, 0.3 * ss.a);
      stroke(ctx, (c) => { c.moveTo(bx - 10, G.slabBot); c.lineTo(bx, by); c.lineTo(bx + 10, G.slabBot); }, COL.steel, 1.5, 0.7 * da);
      stroke(ctx, (c) => c.arc(bx, by, rFl, 0, TAU), dc, 1, 0.12 * da);
    }
    if (sb.h) {
      fill(ctx, (c) => rr(c, hx0, hy0, hx1 - hx0, hy1 - hy0, 12), hc, 0.1 + 0.05 * sb.pulse);
      glow(ctx, L, (c) => rr(c, hx0, hy0, hx1 - hx0, hy1 - hy0, 12), hc, 1.5 * sb.w, 0.35 * sb.g, 0.95);
      stroke(ctx, (c) => { for (let y = hy0 + 12; y < hy1 - 8; y += 7) { c.moveTo(hx1, y); c.lineTo(hx1 + 7, y); } }, hc, 1.3, 0.5);
      stroke(ctx, (c) => c.arc(sx, sy, Rs + 4, 0, TAU), hc, 1, 0.35, [3, 4]);
    }
    // Bremszangen (unten, frei von Seilen)
    const gap = 3.5 * (1 - M.brake), bc = sb.h ? COL.amber : M.brake > 0.5 ? COL.steel : COL.cyan;
    for (const ang of [1.2, 1.94]) {
      const ca = Math.cos(ang), sa = Math.sin(ang), r0 = Rs + 5 + gap;
      const cal = (c) => { c.arc(sx, sy, r0, ang - 0.2, ang + 0.2); c.lineTo(sx + Math.cos(ang + 0.2) * (r0 + 8), sy + Math.sin(ang + 0.2) * (r0 + 8)); c.lineTo(sx + Math.cos(ang - 0.2) * (r0 + 8), sy + Math.sin(ang - 0.2) * (r0 + 8)); c.closePath(); };
      if (sb.h) glow(ctx, L, cal, bc, 1.6 * sb.w, 0.6 * sb.g, 1); else stroke(ctx, cal, bc, 1.6, 0.95 * Math.max(sb.a, 0.6));
      stroke(ctx, (c) => { c.moveTo(sx + ca * (r0 + 8), sy + sa * (r0 + 8)); c.lineTo(sx + ca * (r0 + 14), sy + sa * (r0 + 14)); }, bc, 3, 0.8 * sb.a);
    }
    // Treibscheibe
    fill(ctx, (c) => c.arc(sx, sy, Rs, 0, TAU), "#06101f", 0.75);
    glow(ctx, L, (c) => c.arc(sx, sy, Rs, 0, TAU), ss.c, 2.6 * ss.w, 1 * ss.g, ss.a);
    stroke(ctx, (c) => { c.arc(sx, sy, Rs - 5, 0, TAU); c.moveTo(sx + 7, sy); c.arc(sx, sy, 7, 0, TAU); for (let i = 0; i < 6; i++) { const a = M.sheaveA + (i * TAU) / 6; c.moveTo(sx + Math.cos(a) * 9, sy + Math.sin(a) * 9); c.lineTo(sx + Math.cos(a) * (Rs - 6), sy + Math.sin(a) * (Rs - 6)); } }, ss.c, 1.6, 0.75 * ss.a);
    stroke(ctx, (c) => { for (let i = 0; i < 3; i++) { const a = M.sheaveA + (i * TAU) / 3 + 0.5; c.moveTo(sx + Math.cos(a) * (Rf - 3), sy + Math.sin(a) * (Rf - 3)); c.lineTo(sx + Math.cos(a) * (Rf + 3), sy + Math.sin(a) * (Rf + 3)); } }, "#ffffff", 2, 0.6 * ss.a);
    L.fillCircle(ctx, sx, sy, 3, "#ffffff");
    // Ablenkrolle unter der Triebwerksraum-Decke
    fill(ctx, (c) => c.arc(bx, by, rDisc, 0, TAU), "#06101f", 0.8);
    glow(ctx, L, (c) => c.arc(bx, by, rDisc, 0, TAU), dc, 2 * sd.w, 0.8 * sd.g, da);
    stroke(ctx, (c) => { for (let i = 0; i < 3; i++) { const a = M.deflA + (i * TAU) / 3; c.moveTo(bx, by); c.lineTo(bx + Math.cos(a) * (rDisc - 2), by + Math.sin(a) * (rDisc - 2)); } }, dc, 1.3, 0.7 * da);
  }

  /** Segmente nach Farbe/Alpha bündeln und mit wenigen Strichen zeichnen (günstig bei vielen Partikeln). */
  function batchSegs(ctx, segs, width) {
    if (!segs.length) return;
    const buckets = new Map();
    for (const sg of segs) { const k = sg[4] + "|" + Math.min(4, Math.round(sg[5] * 4)) + "|" + (sg[6] || width); let b = buckets.get(k); if (!b) buckets.set(k, (b = [])); b.push(sg); }
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
    for (const [k, list] of buckets) {
      const [col, aq, w] = k.split("|"); if (+aq <= 0) continue;
      ctx.globalAlpha = +aq / 4; ctx.strokeStyle = col; ctx.lineWidth = +w; ctx.beginPath();
      for (const sg of list) { ctx.moveTo(sg[0], sg[1]); ctx.lineTo(sg[2], sg[3]); }
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- Tragseile (inkl. Riss) ----------
  function burst(ctx, x, y, a, seed, n, color) {
    if (a < 0 || a > 0.6) return;
    const segs = [];
    for (let i = 0; i < n; i++) {
      const ang = h01(seed + i * 1.7) * TAU, sp = 110 + 260 * h01(seed * 3 + i), vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp + 420 * a;
      const px = x + Math.cos(ang) * sp * a, py = y + Math.sin(ang) * sp * a + 210 * a * a, k = 0.022;
      segs.push([px, py, px - vx * k, py - vy * k, i % 3 ? color : "#ffffff", 1 - a / 0.6]);
    }
    batchSegs(ctx, segs, 2);
  }

  function drawRopes(ctx, L, G, o, sty, M, t) {
    const s = sty("ropes", COL.cyan);
    const tailOf = (rp) => (c) => { c.arc(G.sx, G.sy, rp.Ra, 0, rp.be, true); c.lineTo(rp.px, rp.py); c.arc(G.bx, G.by, rp.Rb, rp.be, Math.PI, true); c.lineTo(rp.cwX, M.cwTop - 5); };
    const intact = G.ropes.filter((rp) => !(M.snaps[rp.i] != null && t >= M.snaps[rp.i]));
    if (intact.length) {
      const all = (c) => { for (const rp of intact) { c.moveTo(rp.carX, M.hitchY); c.lineTo(rp.carX, G.sy); tailOf(rp)(c); } };
      const ce = G.center, cp = (c) => { c.moveTo(G.carCX, M.hitchY); c.lineTo(G.carCX, G.sy); tailOf(ce)(c); };
      stroke(ctx, cp, s.c, G.bundle + 2 + 7 / ZS, (s.h ? 0.16 + 0.12 * s.pulse : 0.12) * s.a);
      stroke(ctx, all, s.c, s.h ? 2 : 1.7, s.a);
      stroke(ctx, (c) => { for (const rp of intact) { c.moveTo(rp.carX, M.hitchY); c.lineTo(rp.carX, G.sy); } }, "#ffffff", 1, 0.4 * s.a, [3, 5], 0);
      stroke(ctx, (c) => { for (const rp of intact) { c.moveTo(rp.cwX, M.cwTop - 5); c.lineTo(rp.cwX, G.by); } }, "#ffffff", 1, 0.4 * s.a, [3, 5], 0);
    }
    for (const rp of G.ropes) {
      const tb = M.snaps[rp.i], broken = tb != null && t >= tb, tail = tailOf(rp);
      if (!broken) continue;
      const a = t - tb, side = rp.off > 0.01 ? 1 : rp.off < -0.01 ? -1 : 1;
      const hitchTb = M.hitchAt(Math.max(0, tb));
      const snapY = hitchTb - clamp(0.42 * (hitchTb - G.sy), 26, 120) + (o.broken.length > 1 ? (h01(rp.i * 7.3) - 0.5) * 18 : 0);
      // oberes Stück: schnellt zurück, peitscht, hängt über der Treibscheibe
      const recoil = Math.min(60, 0.38 * (snapY - G.sy)) * easeOut(a / 0.3);
      const endY = Math.max(G.sy + 12, snapY - recoil - M.cwDrop);
      const wx = side * (12 * sat(a / 0.5) + 34 * Math.exp(-2.2 * a) * Math.sin(15 * a + rp.i));
      const up = (c) => { c.moveTo(rp.carX + wx, endY); c.quadraticCurveTo(rp.carX + wx * 0.35, (endY + G.sy) / 2, rp.carX, G.sy); c.arc(G.sx, G.sy, rp.Ra, 0, -0.5, true); };
      const fade = a > 2 ? 0.8 : 1;
      glow(ctx, L, (c) => { c.moveTo(G.sx + rp.Ra * Math.cos(-0.5), G.sy + rp.Ra * Math.sin(-0.5)); tail(c); }, COL.red, 1.7, 0.35, 0.5 * Math.max(0.8, s.a));
      glow(ctx, L, up, COL.red, 2.2, 1.1, fade * Math.max(0.8, s.a));
      L.fillCircle(ctx, rp.carX + wx, endY, 2.6, "#ffd0d0");
      // unteres Stück: fällt schlaff auf das Kabinendach
      const L0 = hitchTb - snapY, e = easeOut(a / 0.8), wob = 12 * Math.exp(-3 * a) * Math.sin(13 * a);
      const ex = rp.carX + side * (Math.min(0.45 * L0, 26 + 5 * Math.abs(rp.off)) * e + wob), ey = lerp(M.hitchY - L0, M.hitchY + 14, e);
      const cx = rp.carX + side * 4 * e, cy = lerp(M.hitchY - L0 * 0.5, M.hitchY - 16, e);
      glow(ctx, L, (c) => { c.moveTo(rp.carX, M.hitchY); c.quadraticCurveTo(cx, cy, ex, ey); }, COL.red, 2.2, 1.1, fade * Math.max(0.8, s.a));
      if (a < 0.7) {
        L.glowDot(ctx, rp.carX, snapY, 12 + 40 * (1 - a / 0.7), COL.red, 1 - a / 0.7);
        L.glowDot(ctx, rp.carX, snapY, 8 + 10 * (1 - a / 0.7), "#ffffff", 0.8 * (1 - a / 0.7));
        burst(ctx, rp.carX, snapY, a, rp.i * 11 + 3, 12, COL.red);
      }
    }
  }

  // ---------- Gegengewicht ----------
  function drawCounterweight(ctx, L, G, sty, M) {
    const s = sty("counterweight", COL.steel), x = G.cwX0, y = M.cwTop, w = G.cwW, h = G.CWH;
    fill(ctx, (c) => c.rect(x, y, w, h), s.c, (s.h ? 0.16 : 0.08) * s.a);
    stroke(ctx, (c) => { for (let yy = y + 8; yy < y + h - 4; yy += 7) { c.moveTo(x + 5, yy); c.lineTo(x + w - 5, yy); } }, s.c, 1.2, 0.45 * s.a);
    const cwp = (c) => { c.rect(x, y, w, h); c.moveTo(G.cwCX - 15, y - 5); c.lineTo(G.cwCX + 15, y - 5); c.moveTo(G.cwCX, y - 5); c.lineTo(G.cwCX, y); };
    if (s.h) glow(ctx, L, cwp, s.c, 2.2 * s.w, 0.8 * s.g, s.a); else { stroke(ctx, cwp, s.c, 2.2 + 4 / ZS, 0.1 * s.a); stroke(ctx, cwp, s.c, 2.2, s.a); }
    stroke(ctx, (c) => { for (const yy of [y + 4, y + h - 4]) { c.moveTo(x, yy); c.lineTo(G.cwRailL + 3, yy); c.moveTo(x + w, yy); c.lineTo(G.cwRailR - 3, yy); } }, COL.steel, 2.5, 0.7 * s.a);
  }

  // ---------- Kabine mit Rahmen, Führungsschuhen, Fangvorrichtung ----------
  function drawCar(ctx, L, G, o, sty, M, t) {
    const s = sty("car", COL.cyan), sg = sty("safety_gear", COL.steel);
    const x0 = G.carX0, x1 = G.carX1, y = M.carY, top = y - G.CH, hy = M.hitchY;
    // Fahrtstreifen bei schneller Abwärtsbewegung
    const av = Math.abs(M.v);
    if (M.dir < 0 && av > 0.25) stroke(ctx, (c) => { for (let i = 0; i < 6; i++) { const xx = x0 + 10 + i * ((G.carW - 20) / 5), ph = (t * 260 + i * 41) % 70, len = 24 + 30 * Math.min(1, av / 2); c.moveTo(xx, hy - 14 - ph); c.lineTo(xx, hy - 14 - ph - len); } }, s.c, 1.5, 0.25 * Math.min(1, av / 1.5) * s.a);
    fill(ctx, (c) => c.rect(x0, top, G.carW, G.CH), s.h ? "rgba(255,179,71,0.12)" : "rgba(63,210,255,0.07)", 1);
    // Innenraum: Deckenlicht, Personen, Kabinentür (vorn)
    stroke(ctx, (c) => { c.moveTo(x0 + 18, top + 6); c.lineTo(x1 - 18, top + 6); }, COL.white, 2, (0.45 + 0.2 * Math.sin(t * 2.4)) * s.a);
    for (let i = 0; i < o.people; i++) { const px = o.people === 1 ? (x0 + x1) / 2 : x0 + 28 + ((G.carW - 56) * i) / (o.people - 1); L.person(ctx, px, y - 1, G.CH * 0.8, COL.steel, 0.38 * s.a); }
    stroke(ctx, (c) => { c.moveTo((x0 + x1) / 2, top + 10); c.lineTo((x0 + x1) / 2, y - 3); }, s.c, 1.2, 0.35 * s.a, [6, 5]);
    glow(ctx, L, (c) => c.rect(x0, top, G.carW, G.CH), s.c, 2.6 * s.w, 1 * s.g, s.a);
    // Tragrahmen: Querhaupt, Seitenständer, Unterholm, Seilaufhängung
    const fr = (c) => { c.rect(x0 - 10, hy + 10, G.carW + 20, 8); c.moveTo(x0 - 7, hy + 18); c.lineTo(x0 - 7, y + 2); c.moveTo(x1 + 7, hy + 18); c.lineTo(x1 + 7, y + 2); c.rect(x0 - 10, y + 2, G.carW + 20, 8); };
    stroke(ctx, fr, COL.steel, 1.6, 0.8 * s.a);
    stroke(ctx, (c) => { c.rect(G.carCX - G.bundle / 2 - 6, hy + 5, G.bundle + 12, 5); for (const rp of G.ropes) { c.moveTo(rp.carX, hy - 1); c.lineTo(rp.carX, hy + 5); } }, COL.steel, 1.4, 0.85 * s.a);
    // Führungsschuhe oben/unten
    stroke(ctx, (c) => { for (const yy of [hy + 14, y + 6]) { c.moveTo(x0 - 10, yy); c.lineTo(G.railL - 5, yy); c.moveTo(G.railL - 5, yy - 4); c.lineTo(G.railL - 5, yy + 4); c.moveTo(x1 + 10, yy); c.lineTo(G.railR + 5, yy); c.moveTo(G.railR + 5, yy - 4); c.lineTo(G.railR + 5, yy + 4); } }, COL.steel, 2, 0.75 * s.a);
    // Fangvorrichtung an beiden Schienen (Keile heben sich beim Einrücken)
    const lift = 5 * M.wedge, hot = M.heat;
    const gc = M.wedge > 0.5 ? (hot > 0.5 ? COL.hot : COL.amber) : sg.c, ga = Math.max(sg.a, M.wedge > 0.05 ? 1 : 0);
    const gw = M.wedge > 0.5 ? 1.3 + 0.4 * Math.sin(t * 5) * (1 - hot) + hot : sg.g;
    const gear = (c) => { for (const r of [G.railL, G.railR]) { c.rect(r - 11, y - 3, 22, 21); c.moveTo(r - 3, y + 15 - lift); c.lineTo(r - 3, y + 1 - lift); c.lineTo(r - 8, y + 15 - lift); c.closePath(); c.moveTo(r + 3, y + 15 - lift); c.lineTo(r + 3, y + 1 - lift); c.lineTo(r + 8, y + 15 - lift); c.closePath(); } };
    fill(ctx, gear, gc, (M.wedge > 0.5 ? 0.3 : 0.12) * ga);
    if (sg.h || M.wedge > 0.05) glow(ctx, L, gear, gc, 1.6 * sg.w, gw, ga); else stroke(ctx, gear, gc, 1.6, ga);
    stroke(ctx, (c) => { c.moveTo(G.railL, y + 18 - lift * 0.6); c.lineTo(G.railR + 8, y + 18 - lift * 0.6); c.lineTo(G.railR + 8, y + 8); }, M.wedge > 0.05 ? COL.amber : COL.steel, 1.4, 0.7 * ga);
    if (hot > 0.02) for (const r of [G.railL, G.railR]) { softDot(ctx, r, y + 14, 16 + 22 * hot, COL.amber, 0.5 + 0.8 * hot); softDot(ctx, r, y + 15, 7, "#fff2d6", 1.6 * hot * (0.8 + 0.2 * Math.sin(t * 40 + r))); }
  }

  /** Pulsierende Ortungsringe um hervorgehobene (kleine) Bauteile. */
  function drawHalos(ctx, G, o, M, t, s) {
    if (!o.hl.size) return;
    const spots = [];
    if (o.hl.has("governor")) spots.push([G.gx, G.gy, 30]);
    if (o.hl.has("safety_gear")) spots.push([G.railL, M.carY + 8, 20], [G.railR, M.carY + 8, 20]);
    if (o.hl.has("brake")) spots.push([G.sx, G.sy + 50, 24]);
    if (o.hl.has("sheave")) spots.push([G.sx, G.sy, G.R + 16]);
    if (o.hl.has("deflector")) spots.push([G.bx, G.by, 32]);
    if (o.hl.has("tension_pulley")) spots.push([G.gx, G.tpY, 28]);
    if (o.hl.has("buffers")) spots.push([G.carCX - 36, G.PB - 18, 22], [G.carCX + 36, G.PB - 18, 22], [G.cwCX, G.PB - 16, 20]);
    if (!spots.length) return;
    ctx.save(); ctx.strokeStyle = COL.amber; ctx.lineWidth = 2 / s;
    for (const [x, y, r] of spots) for (let k = 0; k < 2; k++) {
      const ph = (t / 1.8 + k * 0.5) % 1;
      ctx.globalAlpha = 0.55 * (1 - ph); ctx.beginPath(); ctx.arc(x, y, r * (1 + 0.9 * ph), 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- Funken der Fangvorrichtung ----------
  function frictionSparks(ctx, G, M, t) {
    if (!M.sparks) return;
    const { t0, t1, yAt } = M.sparks, life = 0.5, n = 190, segs = [];
    for (const side of [-1, 1]) {
      const rail = side < 0 ? G.railL : G.railR;
      for (let i = 0; i < n; i++) {
        const b = t0 + (t1 - t0) * Math.pow(h01(i * 13.1 + side * 7.7), 1.4), age = t - b;
        if (age < 0 || age > life) continue;
        const inten = 1 - 0.65 * (b - t0) / (t1 - t0);
        const ang = Math.PI / 2 - side * (0.15 + 1.25 * h01(i * 3.7 + side * 1.3)), sp = (120 + 280 * h01(i * 5.3 + side)) * (0.5 + 0.5 * inten);
        const ox = rail + side * 4, oy = yAt(b) + 17;
        const px = ox + Math.cos(ang) * sp * age, py = oy + Math.sin(ang) * sp * age + 260 * age * age;
        const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp + 520 * age, k = 0.03;
        segs.push([px, py, px - vx * k, py - vy * k, i % 3 ? COL.amber : COL.hot, Math.min(1, (1.25 - age / life) * inten), i % 4 ? 1.8 : 2.8]);
      }
    }
    batchSegs(ctx, segs, 2);
  }

  // ---------- Kamera / Fokus ----------
  function camera(o, G, M, t, d, u) {
    let rect = null;
    if (o.focus === "machine_room") rect = [G.MR0 - 40, G.MRtop - 24, G.MR1 + 56, G.slabBot + 66];
    else if (o.focus === "car") { const cy = M.carY - G.CH * 0.45 - (o.state === "rope_snap" ? 40 : 0); rect = [G.carCX - 250, cy - 150, G.carCX + 200, cy + 150]; }
    else if (o.focus === "pit") rect = [G.S0 - 60, G.yBot - 186, G.S1 + 60, G.PB + 14];
    else if (o.focus === "ropes") rect = [G.S0 - 20, G.sy - G.R - 34, G.S1 + 20, Math.max(M.hitchY + 70, G.sy + 250)];
    if (!rect) return { s: 1, cx: 1110, cy: 500, scx: 1110, scy: 500 };
    const bx0 = 330, bx1 = 1450, by0 = 215, by1 = 890;
    let s = clamp(Math.min((bx1 - bx0) / (rect[2] - rect[0]), (by1 - by0) / (rect[3] - rect[1])), 1, 2.8);
    s *= lerp(0.88, 1, easeInOut(t / Math.max(0.3, Math.min(1.4, 0.3 * d))));
    return { s, cx: (rect[0] + rect[2]) / 2, cy: (rect[1] + rect[3]) / 2, scx: (bx0 + bx1) / 2, scy: (by0 + by1) / 2 };
  }
  /** Engine-Kamera nutzt params.focus als [x,y]; bei String-Fokus wird sie um (0,0) skaliert – hier korrigieren. */
  function fixCamera(ctx, p) {
    try {
      const f = p.params && p.params.focus, cam = p.scene && p.scene.camera;
      if (typeof f !== "string" || !cam || cam === "static" || !ctx.getTransform) return;
      const m = ctx.getTransform();
      if (Math.abs(m.e) > 1e-6 || Math.abs(m.f) > 1e-6 || Math.abs(m.a - 1) < 1e-6) return;
      const e = easeInOut(p.u); let s = 1, dx = 0, dy = 0;
      if (cam === "slow_push_in") s = lerp(1, 1.1, e); else if (cam === "slow_pull_out") s = lerp(1.1, 1, e);
      else if (cam === "pan_left") { s = 1.08; dx = lerp(60, -60, e); } else if (cam === "pan_right") { s = 1.08; dx = lerp(-60, 60, e); }
      else if (cam === "tilt_down") { s = 1.08; dy = lerp(45, -45, e); } else if (cam === "tilt_up") { s = 1.08; dy = lerp(-45, 45, e); }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.translate(p.W / 2 + dx, p.H / 2 + dy); ctx.scale(s, s); ctx.translate(-p.W / 2, -p.H / 2);
    } catch (e) { /* ignorieren */ }
  }

  // ---------- Atmosphäre: Röntgen-Scan + Staub ----------
  function drawAmbient(ctx, G, t, base) {
    const span = G.PB + 140 - (G.MRtop - 100), yS = G.MRtop - 100 + ((t * 85) % span);
    const x0 = G.BX0 - 30, x1 = G.BX1 + 30;
    ctx.save(); ctx.globalAlpha = base;
    const regions = [[G.BX0 - 8, G.BX1 + 8, G.yRoof - 8, G.yBot + 8], [G.MR0 - 8, G.MR1 + 8, G.MRtop - 8, G.yRoof - 8], [G.S0 - 8, G.S1 + 8, G.yBot + 8, G.PB + 10]];
    const steps = [[0, 7, "rgba(63,210,255,0.07)"], [7, 18, "rgba(63,210,255,0.04)"], [18, 40, "rgba(63,210,255,0.02)"]];
    if (vis(x0, yS - 42, x1, yS + 2)) for (const [rx0, rx1, ry0, ry1] of regions) {
      for (const [h0, h1, col] of steps) { const a0 = Math.max(ry0, yS - h1), a1 = Math.min(ry1, yS - h0); if (a1 > a0) { ctx.fillStyle = col; ctx.fillRect(rx0, a0, rx1 - rx0, a1 - a0); } }
      if (yS >= ry0 && yS <= ry1) { ctx.fillStyle = "rgba(120,225,255,0.22)"; ctx.fillRect(rx0, yS, rx1 - rx0, 1.5); }
    }
    ctx.fillStyle = "rgba(160,220,255,1)";
    const H = G.PB - G.slabBot;
    for (let b = 0; b < 3; b++) {
      ctx.globalAlpha = (0.14 + 0.08 * b + 0.05 * Math.sin(t * 1.3 + b * 2.1)) * base; ctx.beginPath();
      for (let i = b; i < 27; i += 3) {
        const x = G.S0 + 6 + h01(i * 3.1) * (G.SW - 12), y = G.PB - ((h01(i * 7.7) * H + t * (6 + 10 * h01(i))) % H) + Math.sin(t * 0.7 + i) * 3, r = 1 + 1.4 * h01(i * 1.3);
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
      }
      ctx.fill();
    }
    ctx.restore();
  }

  /** Richtungspfeile neben der Kabine (Fahrt / Fall). */
  function drawDirection(ctx, L, G, M, t) {
    if (!M.dir || Math.abs(M.v) < 0.05) return;
    const col = M.v < 0 && (M.status.includes("Seil") || M.status.includes("Über") || M.status.includes("Begrenzer") || M.status.includes("Fang")) ? COL.red : COL.cyan;
    const x = G.S1 + 44, yc = M.carY - G.CH / 2, dir = M.dir, a = Math.min(1, Math.abs(M.v) / 0.6);
    for (let i = 0; i < 3; i++) {
      const ph = (t * 1.6 + i / 3) % 1, y = yc - dir * (ph - 0.5) * 60, al = Math.sin(ph * Math.PI) * a;
      L.poly(ctx, [[x - 11, y + dir * 6], [x, y - dir * 6], [x + 11, y + dir * 6]], col, 2.4, 0.8, { alpha: al });
    }
  }

  // ---------- Bildschirm-Overlays ----------
  function anchorOf(part, G, M, toS) {
    const pick = (x, y0, y1, pref) => { // sichtbaren Punkt entlang eines langen Bauteils wählen
      let best = null, bs = -1e9; const cy = M.carY - G.CH / 2;
      for (let k = 0; k <= 16; k++) {
        const y = lerp(y0, y1, k / 16), [qx, qy] = toS(x, y);
        if (qx < 100 || qx > 1820 || qy < 250 || qy > 860) continue;
        const sc = pref === "mid" ? -Math.abs(k - 8) : Math.min(Math.abs(y - cy), 180) - 0.15 * Math.abs(qy - 520);
        if (sc > bs) { bs = sc; best = y; }
      }
      return { x, y: best == null ? lerp(y0, y1, 0.5) : best };
    };
    const far = (x) => { // stabiler Punkt entlang eines langen Bauteils, abseits der Kabinenbahn
      if (M.focus === "car") return { x, y: M.carY + 64 };
      const a = Math.min(M.carY0, M.carY1) - G.CH - 36, b = Math.max(M.carY0, M.carY1) + 36, top = G.slabBot + 40, bot = G.PB - 40;
      const y = a - top > bot - b ? (top + Math.max(top, a)) / 2 : (Math.min(bot, b) + bot) / 2;
      const [qx, qy] = toS(x, y);
      return qx < 100 || qx > 1820 || qy < 250 || qy > 860 ? pick(x, G.slabBot + 20, G.PB - 30) : { x, y };
    };
    switch (part) {
      case "ropes": { if (M.allSnapped) return { x: G.carCX + 18, y: M.hitchY - 2, side: "right" }; const f = pick(G.carCX + G.bundle / 2 + 1, G.sy + 30, M.hitchY - 12, "mid"); return { x: f.x, y: f.y, side: "right" }; }
      case "car": return { x: G.carX1 - 6, y: M.carY - G.CH * 0.55, side: "right" };
      case "counterweight": return { x: G.cwX0, y: M.cwTop + G.CWH * 0.5, side: "left" };
      case "sheave": return { x: G.sx - 26, y: G.sy - 26, side: "left" };
      case "brake": return { x: G.sx + 72, y: G.sy - 20, side: "right" };
      case "governor": return { x: G.gx + G.rg + 2, y: G.gy + 2, side: "right" };
      case "governor_rope": { const f = far(G.gR); return { x: f.x, y: f.y, side: "right" }; }
      case "safety_gear": return { x: G.railL - 11, y: M.carY + 10, side: "left" };
      case "rails": { const f = far(G.railL); return { x: f.x, y: f.y, side: "left" }; }
      case "buffers": return { x: G.carCX + 49, y: G.PB - G.bufH * (1 - M.bufComp) + 4, side: "right" };
      case "machine_room": return { x: G.MR0 + 6, y: G.MRtop + 40, side: "left" };
      case "pit": return { x: G.S0 + 6, y: G.PB - 14, side: "left" };
      case "deflector": return { x: G.bx - G.rd - 12, y: G.by, side: "left" };
      case "tension_pulley": return { x: G.gx + G.tpR, y: G.tpY, side: "right" };
      case "shaft": return { x: G.S0 - 4, y: lerp(G.slabBot, G.PB, 0.5), side: "left" };
      default: return null;
    }
  }

  function callout(ctx, L, px, py, lx, ly, it, p, color, alignRight) {
    if (p <= 0) return;
    L.glowDot(ctx, px, py, 14, color, p); L.fillCircle(ctx, px, py, 4, color);
    const lp = easeOut(p / 0.5), ex = alignRight ? lx + 26 : lx - 26;
    const l1 = Math.hypot(ex - px, ly - py), l2 = Math.abs(lx - ex), dist = lp * (l1 + l2);
    const lead = (c) => {
      c.moveTo(px, py);
      if (dist <= l1) { const k = l1 > 0 ? dist / l1 : 1; c.lineTo(lerp(px, ex, k), lerp(py, ly, k)); }
      else { c.lineTo(ex, ly); c.lineTo(lerp(ex, lx, (dist - l1) / Math.max(1, l2)), ly); }
    };
    stroke(ctx, lead, color, 5, 0.12 * p);
    stroke(ctx, lead, color, 1.8, p);
    const tp = sat((p - 0.4) / 0.6); if (tp <= 0) return;
    const w = it.w, h = it.h, bx = alignRight ? lx - w : lx, by = ly - h / 2, e = easeOut(tp), ew = w * e;
    panel(ctx, alignRight ? bx + w - ew : bx, by, ew, h, { alpha: tp, stroke: color === COL.amber ? "rgba(255,179,71,0.55)" : "rgba(63,210,255,0.5)", r: 8, fill: "rgba(8,22,44,0.8)" });
    const ta = sat((p - 0.6) / 0.4), lh = it.fs * 1.24;
    it.lines.forEach((ln, i) => L.text(ctx, ln, bx + 18, by + 12 + lh * i + it.fs * 0.95, { size: it.fs, weight: 600, color: COL.white, alpha: ta }));
  }

  function drawCallouts(ctx, L, G, o, M, toS, t, d, panel) {
    if (!o.labels.length) return;
    const full = o.focus === "full";
    const leftEdge = full ? toS(G.BX0 - 8, 0)[0] - 100 : -1e4, rightEdge = full ? toS(G.BX1 + 8, 0)[0] + 44 : 1e4;
    const layout = (it, avail) => { // Zeilenumbruch + Schriftgröße passend zur verfügbaren Breite
      const maxW = clamp(avail - 36, 200, 440);
      for (let fs = 25; fs >= 18; fs--) {
        const lines = L.wrap(ctx, it.text, maxW, { size: fs, weight: 600 });
        const tw = Math.max(...lines.map((ln) => L.measure(ctx, ln, { size: fs, weight: 600 })));
        if ((tw <= maxW && lines.length <= 3) || fs === 18) { it.fs = fs; it.lines = lines.slice(0, 3); it.w = Math.min(tw, maxW + 60) + 36; it.h = fs * 1.24 * it.lines.length + 24 - fs * 0.24; return; }
      }
    };
    const items = [];
    o.labels.forEach((lb, i) => {
      const an = anchorOf(lb.part, G, M, toS); if (!an) return;
      const [ax, ay] = toS(an.x, an.y);
      if (ax < 60 || ax > 1860 || ay < 60 || ay > 1000) return;
      const it = { ...lb, ax, ay, side: an.side, i };
      let availR = 1830 - (full ? Math.max(rightEdge, ax + 60) : ax + 70), availL = (full ? Math.min(leftEdge, ax - 60) : ax - 70) - 90;
      if (availR < 240) availR = 1830 - (ax + 60);
      if (availL < 240) availL = ax - 60 - 90;
      if (it.side === "right" && availR < 230 && availL > availR) it.side = "left";
      if (it.side === "left" && availL < 230 && availR > availL) it.side = "right";
      layout(it, it.side === "left" ? availL : availR);
      items.push(it);
    });
    for (const side of ["left", "right"]) {
      const list = items.filter((it) => it.side === side).sort((a, b) => a.ay - b.ay);
      if (!list.length) continue;
      const wMax = Math.max(...list.map((it) => it.w));
      let x;
      if (side === "left") { x = full && leftEdge - wMax >= 90 ? leftEdge : Math.min(...list.map((it) => it.ax)) - 70; x = clamp(x, 90 + wMax, 1830); }
      else { x = full && rightEdge + wMax <= 1830 ? rightEdge : Math.max(...list.map((it) => it.ax)) + 70; x = clamp(x, 90, 1830 - wMax); }
      const yMin = side === "left" ? 232 : 200, yMax = 890;
      const hitsPanel = (y, h) => panel && side === "right" && x < panel.x1 && x + wMax > panel.x0 && y + h / 2 > panel.y0 - 12 && y - h / 2 < panel.y1 + 12;
      let prev = null;
      for (const it of list) { let y = Math.max(it.ay, prev ? prev.ly + prev.h / 2 + it.h / 2 + 12 : -1e9, yMin + it.h / 2); if (hitsPanel(y, it.h)) y = panel.y1 + 16 + it.h / 2; it.ly = y; prev = it; }
      let next = null;
      for (let j = list.length - 1; j >= 0; j--) { const it = list[j]; it.ly = Math.min(it.ly, next ? next.ly - next.h / 2 - it.h / 2 - 12 : 1e9, yMax - it.h / 2); next = it; }
      for (const it of list) {
        const start = Math.min(0.4 + it.i * 0.3, 0.42 * d), pr = sat((t - start) / 0.9);
        callout(ctx, L, it.ax, it.ay, x, it.ly, it, pr, o.hl.has(it.part) ? COL.amber : COL.cyan, side === "left");
      }
    }
  }

  function chip(ctx, L, str, x, y, col, alpha, alignRight) {
    const w = L.measure(ctx, str, { size: 13, weight: 700, font: L.FONT.mono, letterSpacing: 2 }) + 18, bx = alignRight ? x - w : x;
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = "rgba(6,16,34,0.85)"; ctx.beginPath(); rr(ctx, bx, y, w, 22, 4); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.stroke(); ctx.restore();
    L.text(ctx, str, bx + 9, y + 16, { size: 13, weight: 700, font: L.FONT.mono, letterSpacing: 2, color: col, alpha });
  }

  function drawSpeedPanel(ctx, L, o, M, t) {
    const x = 1492, y = 212, w = 338, h = 206, a = smooth(t / 0.5), vTrip = 1.15 * o.vNom, av = Math.abs(M.v);
    panel(ctx, x, y, w, h, { alpha: a, r: 10, fill: "rgba(6,16,34,0.84)" });
    L.text(ctx, "GESCHWINDIGKEIT", x + 22, y + 34, { size: 15, weight: 700, font: L.FONT.mono, letterSpacing: 3, color: COL.muted, alpha: a });
    if (M.slow) chip(ctx, L, "ZEITLUPE", x + w - 18, y + 17, COL.amber, a * (0.75 + 0.25 * Math.sin(t * 4)), true);
    const col = av > vTrip + 0.004 ? COL.red : av > o.vNom * 1.01 ? COL.amber : COL.cyan;
    const val = fmt(av, 2);
    L.text(ctx, val, x + 22, y + 104, { size: 60, weight: 700, font: L.FONT.mono, color: col, alpha: a });
    const vw = L.measure(ctx, val, { size: 60, weight: 700, font: L.FONT.mono });
    L.text(ctx, "m/s", x + 32 + vw, y + 104, { size: 24, weight: 600, color: COL.muted, alpha: a });
    if (M.dir && av > 0.02) { const ax = x + w - 42, ay = y + 82, dd = M.dir; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(ax - 13, ay + dd * 9); ctx.lineTo(ax + 13, ay + dd * 9); ctx.lineTo(ax, ay - dd * 13); ctx.closePath(); ctx.fill(); ctx.restore(); }
    // Balken mit Nennwert und Auslöseschwelle (115 %)
    const bx = x + 22, bw = w - 44, by = y + 124, vmax = o.vNom * 1.5, xs = (v) => bx + bw * Math.min(1, v / vmax);
    fill(ctx, (c) => rr(c, bx, by, bw, 8, 4), "rgba(143,179,217,0.18)", a);
    if (av > 0.004) fill(ctx, (c) => rr(c, bx, by, Math.max(8, xs(av) - bx), 8, 4), col, a);
    stroke(ctx, (c) => { c.moveTo(xs(o.vNom), by - 5); c.lineTo(xs(o.vNom), by + 13); }, COL.cyan, 2, a);
    stroke(ctx, (c) => { c.moveTo(xs(vTrip), by - 5); c.lineTo(xs(vTrip), by + 13); }, COL.red, 2, a);
    L.text(ctx, "Nenn " + fmt(o.vNom, 1), xs(o.vNom) - 5, by + 31, { size: 13, weight: 400, font: L.FONT.mono, color: COL.muted, align: "right", alpha: a });
    L.text(ctx, "115 %", xs(vTrip) + 5, by + 31, { size: 13, weight: 400, font: L.FONT.mono, color: COL.red, alpha: a });
    // Status
    const sc = M.statusCol, blink = sc === COL.red ? 0.55 + 0.45 * Math.sin(t * 9) : 1;
    L.glowDot(ctx, x + 30, y + 180, 12, sc, a * blink); L.fillCircle(ctx, x + 30, y + 180, 4.5, sc);
    L.text(ctx, M.status, x + 46, y + 187, { size: 20, weight: 600, color: COL.white, alpha: a });
    return { x0: x, y0: y, x1: x + w, y1: y + h };
  }

  function drawRopePanel(ctx, L, o, M, t) {
    const x = 1492, y = 212, w = 338, h = 204, a = smooth(t / 0.5), n = o.n;
    const brokenNow = Object.entries(M.snaps).filter(([, tb]) => t >= tb).map(([i]) => +i);
    const intact = n - brokenNow.length;
    panel(ctx, x, y, w, h, { alpha: a, r: 10, fill: "rgba(6,16,34,0.84)" });
    L.text(ctx, "TRAGSEILE", x + 22, y + 34, { size: 15, weight: 700, font: L.FONT.mono, letterSpacing: 3, color: COL.muted, alpha: a });
    const sp = Math.min(17, 120 / Math.max(1, n - 1)), x0 = x + 30, yA = y + 54, yB = y + 110;
    for (let i = 0; i < n; i++) {
      const xx = x0 + i * sp, br = brokenNow.includes(i);
      if (!br) glow(ctx, L, (c) => { c.moveTo(xx, yA); c.lineTo(xx, yB); }, COL.cyan, 3.2, 0.7, a);
      else {
        const age = t - M.snaps[i];
        glow(ctx, L, (c) => { c.moveTo(xx, yA); c.lineTo(xx + 4, yA + 22); c.moveTo(xx - 4, yA + 36); c.lineTo(xx, yB); }, COL.red, 3.2, 1.2, a);
        if (age < 0.8) L.glowDot(ctx, xx, yA + 29, 26 * (1 - age / 0.8) + 8, COL.red, a * (1 - age / 0.8));
      }
    }
    const xr = x0 + (n - 1) * sp + 34;
    const cnt = `${intact}/${n}`;
    L.text(ctx, cnt, xr, y + 96, { size: 44, weight: 700, font: L.FONT.mono, color: intact < n ? COL.white : COL.cyan, alpha: a });
    L.text(ctx, "intakt", xr + L.measure(ctx, cnt, { size: 44, weight: 700, font: L.FONT.mono }) + 10, y + 96, { size: 18, weight: 600, color: COL.muted, alpha: a });
    const ha = M.holdA * a;
    const yS = y + 160;
    if (ha > 0.01 && intact > 0) {
      const sc = 0.75 + 0.25 * L.easeOutBack(M.holdA);
      ctx.save(); ctx.translate(x + 22, yS); ctx.scale(sc, sc);
      L.poly(ctx, [[2, -12], [11, -3], [27, -22]], COL.green, 4.5, 1, { alpha: ha });
      L.text(ctx, "HÄLT", 38, 0, { size: 36, weight: 700, font: L.FONT.head, color: COL.green, stroke: 6, strokeColor: rgba(COL.green, 0.2), letterSpacing: 2, alpha: ha });
      ctx.restore();
      L.text(ctx, "Kabine bleibt stehen", x + 22, y + 189, { size: 16, weight: 400, color: COL.muted, alpha: ha });
    } else if (intact === 0 && brokenNow.length) {
      L.text(ctx, "ALLE GERISSEN", x + 22, yS, { size: 30, weight: 700, font: L.FONT.head, color: COL.red, alpha: a });
    } else if (brokenNow.length) L.text(ctx, "Seil gerissen!", x + 22, yS - 4, { size: 22, weight: 700, color: COL.red, alpha: a });
    else L.text(ctx, "Normalbetrieb", x + 22, yS - 4, { size: 20, weight: 600, color: COL.muted, alpha: a });
    return { x0: x, y0: y, x1: x + w, y1: y + h };
  }

  function drawScreenLabels(ctx, L, G, o, M, toS, t) {
    const base = o.hl.size ? 0.6 : 0.85, mono = L.FONT.mono;
    if (M.tripped) { const [gx, gy] = toS(G.gx + G.rg + 12, G.gy - 44); chip(ctx, L, "AUSGELÖST", gx, gy, COL.red, sat(M.trippedAge / 0.25) * (0.8 + 0.2 * Math.sin(t * 6)), false); }
    const leftLabels = o.focus === "full" && o.labels.some((lb) => ["counterweight", "sheave", "safety_gear", "rails", "machine_room", "pit", "deflector", "shaft"].includes(lb.part));
    for (let k = 0; k < G.N; k++) {
      const yW = G.levelY(k), [fx, fy] = toS(G.BX0 + 10, yW - 9), [ex, ey] = toS(G.BX0 - 16, yW);
      const free = (qx, qy) => qy > 110 && qy < 905 && qx > 90 && qx < 1830 && !(qx < 940 && qy < 238);
      if (free(fx, fy)) L.text(ctx, k === 0 ? "EG" : `${k}. OG`, fx, fy, { size: 15, weight: 700, font: mono, color: COL.muted, alpha: base });
      if (!leftLabels && free(ex - 60, ey) && free(ex, ey)) {
        L.text(ctx, (k === 0 ? "±" : "+") + fmt(k * 3, 2), ex - 14, ey + 5, { size: 13, weight: 400, font: mono, color: COL.muted, align: "right", alpha: 0.7 * base });
        fill(ctx, (c) => { c.moveTo(ex - 8, ey - 6); c.lineTo(ex, ey - 6); c.lineTo(ex - 4, ey); c.closePath(); }, COL.muted, 0.7 * base);
      }
    }
    const [mx, my] = toS(G.MR1 - 8, G.MRtop + 20);
    if (my > 60 && mx < 1900) L.text(ctx, "TRIEBWERKSRAUM", mx, my, { size: 13, weight: 700, font: mono, letterSpacing: 2, color: COL.cyan, align: "right", alpha: 0.6 });
    const [px, py] = toS(G.S0 - 14, G.PB + 4);
    if (py < 1000 && px > 150) L.text(ctx, "SCHACHTGRUBE", px, py, { size: 13, weight: 700, font: mono, letterSpacing: 2, color: COL.cyan, align: "right", alpha: 0.6 });
  }

  /** Titel-Overlay im Engine-Stil, aber mit Zeilenumbruch (bleibt links von x = 900). */
  function drawTitle(ctx, L, text, t, d) {
    if (!text) return;
    const a = L.env(t, 0.5, d - 0.3, 0.45); if (a <= 0) return;
    const up = String(text).toUpperCase(), st = (sz) => ({ size: sz, weight: 700, font: L.FONT.head, letterSpacing: 2 });
    let size = 40, lines = [up];
    for (size = 40; size >= 28; size -= 2) { lines = L.wrap(ctx, up, 730, st(size)); if (lines.length <= 2 && Math.max(...lines.map((l) => L.measure(ctx, l, st(size)))) <= 760) break; }
    lines = lines.slice(0, 3);
    const lh = size * 1.22, w = Math.max(...lines.map((l) => L.measure(ctx, l, st(size)))) + 70, h = size + 34 + lh * (lines.length - 1), x = 90, top = 96;
    const slide = easeOut(L.seg(t, 0.5, 0.5));
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a;
    L.fillRect(ctx, x, top, 8, h, COL.amber);
    panel(ctx, x + 14, top, w * slide, h, { fill: "rgba(4,12,26,0.82)", stroke: "rgba(255,179,71,0.45)", r: 4, alpha: a });
    lines.forEach((ln, i) => L.text(ctx, ln, x + 44, top + size * 0.9 + 20 + lh * i, { ...st(size), color: COL.white, alpha: a * L.seg(t, 0.75, 0.35) }));
    ctx.restore();
  }

  // ---------- Hauptfunktion ----------
  function draw(ctx, p) {
    const L = p.L, t = Math.max(0, p.t || 0), d = Math.max(0.5, p.d || 6), u = sat(t / d);
    const o = parseParams(p.params);
    const G = geometry(o);
    const M = motion(o, G, t, d, u);
    M.hitchAt = (tt) => carYAt(o, G, tt, d) - G.CH - 26;
    M.carY0 = carYAt(o, G, 0, d); M.carY1 = carYAt(o, G, d, d); M.focus = o.focus;
    const sty = makeStyle(o, t);
    fixCamera(ctx, p);
    const C = camera(o, G, M, t, d, u);
    ZS = Math.max(1, C.s);
    VIS = [C.cx - (C.scx + 140) / C.s, C.cy - (C.scy + 140) / C.s, C.cx + (p.W - C.scx + 140) / C.s, C.cy + (p.H - C.scy + 140) / C.s];
    let E = null; try { E = ctx.getTransform(); } catch (e) { E = null; }
    const toS = (x, y) => { const sx = C.scx + (x - C.cx) * C.s, sy = C.scy + (y - C.cy) * C.s; return E ? [E.a * sx + E.c * sy + E.e, E.b * sx + E.d * sy + E.f] : [sx, sy]; };
    let sh = 0; const hit = (te, amp) => { if (t >= te) sh += amp * Math.exp(-(t - te) * 7); };
    if (o.state === "safety_engage") hit(engageTimes(d).te, 6);
    else if (o.state === "on_buffer") hit(bufTimes(d).a, 4.5);
    else if (o.state === "rope_snap") hit(snapStart(d), 3);
    else if (o.state === "all_ropes_snap") hit(allSnapTimes(d, o.n).t0, 3.5);
    if (sh < 0.05) sh = 0;
    const shx = sh * Math.sin(t * 83), shy = sh * Math.cos(t * 71);
    const world = (g) => { g.translate(C.scx + shx, C.scy + shy); g.scale(C.s, C.s); g.translate(-C.cx, -C.cy); };
    ctx.save(); world(ctx);
    drawStructure(ctx, L, G, o, sty, t);
    drawAmbient(ctx, G, t, o.hl.size ? 0.6 : 1);
    drawRails(ctx, L, G, sty, M);
    drawBuffers(ctx, L, G, sty, M);
    drawGovernor(ctx, L, G, o, sty, M, t);
    drawCounterweight(ctx, L, G, sty, M);
    drawMachine(ctx, L, G, o, sty, M, t);
    drawRopes(ctx, L, G, o, sty, M, t);
    drawCar(ctx, L, G, o, sty, M, t);
    frictionSparks(ctx, G, M, t);
    drawDirection(ctx, L, G, M, t);
    drawHalos(ctx, G, o, M, t, C.s);
    ctx.restore();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawScreenLabels(ctx, L, G, o, M, toS, t);
    let panel = null;
    if (o.hud && M.speedPanel) panel = drawSpeedPanel(ctx, L, o, M, t);
    else if (o.hud && M.ropePanel) panel = drawRopePanel(ctx, L, o, M, t);
    drawCallouts(ctx, L, G, o, M, toS, t, d, panel);
    drawTitle(ctx, L, p.text, t, d);
    ctx.restore();
  }

  CE.register("shaft_xray", {
    ownsText: true,
    draw(ctx, p) {
      ctx.save();
      try { draw(ctx, p); } catch (e) { if (typeof console !== "undefined") console.error("[shaft_xray]", e && e.message); }
      ctx.restore();
    },
  });
})();
