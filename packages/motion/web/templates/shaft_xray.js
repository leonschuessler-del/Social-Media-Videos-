/* Template "shaft_xray" – Hero-Template: Röntgen-Querschnitt eines Gebäudes mit Treibscheibenaufzug.
   Triebwerksraum (Treibscheibe, Antrieb mit Bremse, Ablenkrolle, Geschwindigkeitsbegrenzer mit Schalter), Tragseile,
   Kabine mit Fangvorrichtung + Auslösehebel, Gegengewicht, Führungsschienen, Begrenzerseil mit Spannrolle, Puffer in der Schachtgrube.

   BEATS (params.beats = Sekunden ab Szenenstart, geklemmt auf [0,3 ; d-0,3]) – Bedeutung je state:
     idle            [0] = Start der Seil-Sequenz (rope_sequence)
     moving_up/down  [0] = Anfahren, [1] = Ankunft/Halt.  cruise:true = fährt ab t=0 mit Nenngeschwindigkeit (kein Halt);
                     cruise:"ramp" = [0] Beginn der Anfahrrampe, danach konstante Fahrt bis Szenenende
     rope_snap       [0] = erstes Seil reißt (weitere im Abstand snap_gap), [1] = „HÄLT“-Anzeige + safety_factor-Chip
     all_ropes_snap  [0] = Seile werden durchtrennt, [1] = Ende des Falls (Aufprall / Standbild / Ende des Zeitlupenfensters)
     overspeed       [0] = Begrenzer löst aus (115 %)
     runaway_up      [0] = Bremse versagt, Kabine startet nach oben, [1] = Begrenzer löst aus (nur mit trip:true)
     safety_engage   [0] = Keile greifen, [1] = Kabine steht
     stopped         [0] = Ruck (nur mit jolt:true)
     on_buffer       [0] = Aufsetzen, [1] = voll eingefedert
   "at" (Sekunden; Strings wie "60%" = Anteil an d) akzeptieren: labels[i].at, markers[i].at, overlay.at, readout(s)[i].at,
     stopwatch.at, ruler.at, safety_factor.at, rope_sequence.at (+step), debris.at, damage_at, safety_circuit.at, frame_at,
     air_cushion.at, rope_coil.at, air_escape.at (+dur), highlight_at. Ohne beats/at: Standard-Timing relativ zu d.
   Params (Auszug): focus full|car|machine_room|pit|ropes|plate, state (s. o.), rope_count, broken_ropes, broken_style snap|fade|damaged,
     damaged_ropes, highlight[], highlight_color, labels[{part,text,at,side}], floors, floor, to_floor, speed, people, passenger_pose,
     hud, cruise, v0/moving, slowmo_ms, v_end_factor, stopwatch, ruler, readout, fall_to, fall_floors, freeze_before_impact,
     pre_broken, floor_labels, level_marks, rope_sequence, safety_factor, panel_note, frame_color, jolt, safety_circuit,
     inspection_plate, direction, trip, debris, markers, overlay, air_cushion, rope_coil, air_escape, buffer_glow. */
(function () {
  const TAU = Math.PI * 2;
  const COL = { cyan: "#3fd2ff", amber: "#ffb347", red: "#ff5a5f", green: "#5be49b", white: "#eef6ff", steel: "#9fc4e6", muted: "#8fb3d9", hot: "#ffe3a8" };
  let HLC = COL.amber; // Hervorhebungsfarbe (pro Frame aus params.highlight_color)

  // ---------- kleine Helfer ----------
  const num = (v, d) => { if (v == null || v === "" || typeof v === "boolean") return d; const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : Number(v); return Number.isFinite(n) ? n : d; };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sat = (x) => clamp(x, 0, 1);
  const smooth = (x) => { x = sat(x); return x * x * (3 - 2 * x); };
  const easeOut = (x) => 1 - Math.pow(1 - sat(x), 3);
  const easeInOut = (x) => { x = sat(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const easeOutBack = (x) => { x = sat(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const h01 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const fmt = (v, dec) => Math.abs(v).toFixed(dec).replace(".", ",");
  const key = (s) => String(s == null ? "" : s).trim().toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[\s\-]+/g, "_");
  const rgba = (hex, a) => { const h = hex.replace("#", ""); return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`; };
  const FALSE_RE = /^(false|nein|no|0|off|aus|none|hide|hidden)$/i;
  const bool = (v, d) => { if (v == null || v === "") return d; if (typeof v === "string") return !FALSE_RE.test(v.trim()); return !!v; };
  /** Optionales Feature: false/null → null, Objekt → Objekt, sonst {} (aktiv mit Defaults). */
  const fo = (v) => (v == null || v === false || (typeof v === "string" && FALSE_RE.test(v.trim())) ? null : typeof v === "object" && !Array.isArray(v) ? v : {});
  /** Zeitangabe: Zahl = Sekunden, "60%" = Anteil an d. */
  const tsec = (v) => {
    if (v == null || v === "" || typeof v === "boolean") return null;
    if (typeof v === "string") { const s = v.trim(); const f = parseFloat(s.replace(",", ".")); if (!Number.isFinite(f)) return null; return /%$/.test(s) ? { f: f / 100 } : f; }
    const n = Number(v); return Number.isFinite(n) ? n : null;
  };
  const atS = (v, d) => (v == null ? null : clamp(typeof v === "object" ? v.f * d : v, 0.3, Math.max(0.3, d - 0.3)));
  const CMAP = { amber: COL.amber, orange: COL.amber, gelb: COL.amber, gold: COL.amber, cyan: COL.cyan, blau: COL.cyan, blue: COL.cyan, tuerkis: COL.cyan, red: COL.red, rot: COL.red, danger: COL.red, green: COL.green, gruen: COL.green, safe: COL.green, white: COL.white, weiss: COL.white };
  const colorOf = (v, d) => { if (v == null || v === "" || v === false) return d; const k = key(v); if (CMAP[k]) return CMAP[k]; const s = String(v).trim(); return /^#[0-9a-f]{6}$/i.test(s) ? s : d; };

  /** Einfache Linie ohne Glow (günstig). */
  function stroke(ctx, build, color, width, alpha, dash, dashOffset) {
    if (alpha <= 0.003) return;
    ctx.save(); ctx.globalAlpha = Math.min(1, alpha); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (dash) { ctx.setLineDash(dash); ctx.lineDashOffset = dashOffset || 0; }
    ctx.beginPath(); build(ctx); ctx.stroke(); ctx.restore();
  }
  let ZS = 1; // Zoomfaktor – Halo-Breiten bleiben in Nahansichten auf dem Bildschirm konstant (spart Füllfläche)
  let VIS = [-1e9, -1e9, 1e9, 1e9]; // sichtbarer Weltausschnitt (für Culling in Nahansichten)
  const vis = (x0, y0, x1, y1) => x1 >= VIS[0] && x0 <= VIS[2] && y1 >= VIS[1] && y0 <= VIS[3];
  /** Glühende Linie (2 Striche) – für Hauptbauteile. */
  function glow(ctx, L, build, color, width, g, alpha) {
    if (alpha <= 0.003) return;
    alpha = clamp(alpha, 0, 1);
    ctx.save(); ctx.strokeStyle = color; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); build(ctx);
    if (g > 0.01) { ctx.globalAlpha = alpha * Math.min(0.5, 0.2 * g); ctx.lineWidth = width + (5 * Math.min(g, 2)) / ZS; ctx.stroke(); }
    ctx.globalAlpha = alpha; ctx.lineWidth = width; ctx.stroke(); ctx.restore();
  }
  function fill(ctx, build, color, alpha) {
    if (alpha <= 0.003) return;
    ctx.save(); ctx.globalAlpha = Math.min(1, alpha); ctx.fillStyle = color; ctx.beginPath(); build(ctx); ctx.fill(); ctx.restore();
  }
  /** Günstiges Panel (Füllung + eine Kontur, ohne Glow-Mehrfachstriche). */
  function panel(ctx, x, y, w, h, o) {
    if (w <= 0.5 || (o.alpha ?? 1) <= 0.003) return;
    ctx.save(); ctx.globalAlpha = o.alpha ?? 1; ctx.fillStyle = o.fill || "rgba(6,16,34,0.84)";
    ctx.beginPath(); rr(ctx, x, y, w, h, o.r ?? 10); ctx.fill();
    ctx.strokeStyle = o.stroke || "rgba(63,210,255,0.4)"; ctx.lineWidth = o.lw || 1.5; ctx.stroke(); ctx.restore();
  }
  /** Günstiger Leuchtpunkt: drei konzentrische Kreise statt Radialverlauf. */
  function softDot(ctx, x, y, r, color, alpha) {
    if (alpha <= 0.01 || r <= 0) return;
    ctx.save(); ctx.fillStyle = color;
    ctx.globalAlpha = Math.min(1, 0.1 * alpha); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = Math.min(1, 0.16 * alpha); ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, TAU); ctx.fill();
    ctx.globalAlpha = Math.min(1, 0.35 * alpha); ctx.beginPath(); ctx.arc(x, y, r * 0.25, 0, TAU); ctx.fill();
    ctx.restore();
  }
  const rr = (c, x, y, w, h, r) => { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  /** Pfeil als Füllform (Welt- oder Bildschirmkoordinaten). */
  const arrowShape = (c, x, yTail, yHead, shaftW, headW, headL) => {
    const dir = yHead < yTail ? -1 : 1, yb = yHead - dir * headL;
    c.moveTo(x - shaftW / 2, yTail); c.lineTo(x - shaftW / 2, yb); c.lineTo(x - headW / 2, yb); c.lineTo(x, yHead);
    c.lineTo(x + headW / 2, yb); c.lineTo(x + shaftW / 2, yb); c.lineTo(x + shaftW / 2, yTail); c.closePath();
  };

  // ---------- Parameter ----------
  const STATE_ALIAS = {
    idle: "idle", normal: "idle", ruhe: "idle", stillstand: "idle", parked: "idle",
    moving_up: "moving_up", up: "moving_up", moving: "moving_up", move_up: "moving_up", aufwaerts: "moving_up", fahrt_aufwaerts: "moving_up", ascending: "moving_up",
    moving_down: "moving_down", down: "moving_down", move_down: "moving_down", abwaerts: "moving_down", fahrt_abwaerts: "moving_down", descending: "moving_down",
    rope_snap: "rope_snap", snap: "rope_snap", seilriss: "rope_snap", one_rope_snap: "rope_snap", rope_break: "rope_snap", rope_breaks: "rope_snap",
    all_ropes_snap: "all_ropes_snap", all_snap: "all_ropes_snap", all_ropes_break: "all_ropes_snap", all_ropes_broken: "all_ropes_snap", fall: "all_ropes_snap", falling: "all_ropes_snap", free_fall: "all_ropes_snap", freefall: "all_ropes_snap", freier_fall: "all_ropes_snap",
    overspeed: "overspeed", governor_trip: "overspeed", uebergeschwindigkeit: "overspeed", trip: "overspeed", governor: "overspeed",
    runaway_up: "runaway_up", runaway: "runaway_up", ascending_overspeed: "runaway_up", overspeed_up: "runaway_up", uncontrolled_up: "runaway_up", uncontrolled_ascent: "runaway_up",
    absturz_nach_oben: "runaway_up", up_runaway: "runaway_up", ucm_up: "runaway_up", aufwaerts_absturz: "runaway_up",
    safety_engage: "safety_engage", safety: "safety_engage", catch: "safety_engage", engage: "safety_engage", fangen: "safety_engage", safety_gear: "safety_engage", braking: "safety_engage",
    stopped: "stopped", stop: "stopped", held: "stopped", hold: "stopped", gehalten: "stopped", safe: "stopped", caught: "stopped",
    on_buffer: "on_buffer", buffer: "on_buffer", puffer: "on_buffer", bottom: "on_buffer", auf_puffer: "on_buffer", impact: "on_buffer",
  };
  const FOCUS_ALIAS = {
    full: "full", whole: "full", all: "full", building: "full", gebaeude: "full", overview: "full", total: "full",
    car: "car", cabin: "car", cab: "car", kabine: "car", fahrkorb: "car", safety_gear: "car", fangvorrichtung: "car",
    machine_room: "machine_room", machine: "machine_room", machineroom: "machine_room", top: "machine_room", triebwerksraum: "machine_room", maschinenraum: "machine_room", sheave: "machine_room", governor: "machine_room", treibscheibe: "machine_room",
    pit: "pit", bottom: "pit", schachtgrube: "pit", buffer: "pit", buffers: "pit", puffer: "pit",
    ropes: "ropes", rope: "ropes", seile: "ropes", tragseile: "ropes",
    plate: "plate", inspection_plate: "plate", pruefplakette: "plate", plakette: "plate",
  };
  const PART_ALIAS = {
    ropes: "ropes", rope: "ropes", tragseile: "ropes", tragseil: "ropes", seile: "ropes", seil: "ropes", suspension_ropes: "ropes",
    car: "car", cabin: "car", cab: "car", kabine: "car", fahrkorb: "car", elevator_car: "car",
    counterweight: "counterweight", gegengewicht: "counterweight", cw: "counterweight",
    sheave: "sheave", traction_sheave: "sheave", treibscheibe: "sheave",
    governor: "governor", overspeed_governor: "governor", geschwindigkeitsbegrenzer: "governor", begrenzer: "governor", regler: "governor",
    governor_rope: "governor_rope", begrenzerseil: "governor_rope", reglerseil: "governor_rope",
    safety_gear: "safety_gear", safety: "safety_gear", fangvorrichtung: "safety_gear", safeties: "safety_gear", wedges: "safety_gear", fangkeile: "safety_gear", keile: "safety_gear",
    lever: "lever", safety_lever: "lever", hebel: "lever", ausloesehebel: "lever", trip_lever: "lever", fanghebel: "lever", linkage: "lever",
    rails: "rails", rail: "rails", guide_rails: "rails", guide_rail: "rails", fuehrungsschienen: "rails", fuehrungsschiene: "rails", schienen: "rails",
    buffers: "buffers", buffer: "buffers", puffer: "buffers",
    brake: "brake", bremse: "brake", motor: "brake", machine: "brake", antrieb: "brake", drive: "brake",
    machine_room: "machine_room", triebwerksraum: "machine_room", maschinenraum: "machine_room",
    pit: "pit", schachtgrube: "pit", grube: "pit",
    deflector: "deflector", ablenkrolle: "deflector", umlenkrolle: "deflector", deflector_sheave: "deflector",
    tension_pulley: "tension_pulley", spannrolle: "tension_pulley", spanngewicht: "tension_pulley",
    shaft: "shaft", schacht: "shaft",
    switch: "switch", safety_switch: "switch", governor_switch: "switch", schalter: "switch", safety_circuit: "switch", sicherheitskreis: "switch", circuit: "switch",
    inspection_plate: "inspection_plate", plate: "inspection_plate", plakette: "inspection_plate", pruefplakette: "inspection_plate", inspection_sticker: "inspection_plate",
    air_cushion: "air_cushion", air: "air_cushion", air_pressure: "air_cushion", air_pressure_hatch: "air_cushion", luftpolster: "air_cushion", luftkissen: "air_cushion",
    rope_coil: "rope_coil", rope_coil_spring: "rope_coil", seilspirale: "rope_coil", seilhaufen: "rope_coil", rope_pile: "rope_coil", coil: "rope_coil",
    debris: "debris", engine: "debris", triebwerk: "debris", truemmer: "debris",
    shaft_head: "shaft_head", schachtkopf: "shaft_head", schachtdecke: "shaft_head", ceiling: "shaft_head", limit: "shaft_head",
  };
  const PART_NAME = { ropes: "Tragseile", car: "Kabine", counterweight: "Gegengewicht", sheave: "Treibscheibe", governor: "Geschwindigkeitsbegrenzer", governor_rope: "Begrenzerseil", safety_gear: "Fangvorrichtung", lever: "Auslösehebel", rails: "Führungsschienen", buffers: "Puffer", brake: "Antrieb mit Bremse", machine_room: "Triebwerksraum", pit: "Schachtgrube", deflector: "Ablenkrolle", tension_pulley: "Spannrolle", shaft: "Schacht", switch: "Sicherheitsschalter", inspection_plate: "Prüfplakette", air_cushion: "Luftpolster", rope_coil: "Seilhaufen", debris: "Triebwerk", shaft_head: "Schachtkopf" };
  const KEYWORDS = [
    [/hebel|lever/, "lever"], [/begrenzerseil|reglerseil|governor.?rope/, "governor_rope"], [/schalter|switch|sicherheitskreis/, "switch"], [/begrenzer|governor|regler/, "governor"], [/fang|safety|keil/, "safety_gear"],
    [/plakette|inspection|pruef/, "inspection_plate"], [/luftpolster|luftkissen|air/, "air_cushion"], [/seilspirale|seilhaufen|coil|aufgehaeuft/, "rope_coil"],
    [/treibscheibe|sheave/, "sheave"], [/ablenk|umlenk|deflect/, "deflector"], [/spannrolle|spanngewicht|tension/, "tension_pulley"],
    [/gegengewicht|counterweight/, "counterweight"], [/schiene|rail/, "rails"], [/puffer|buffer/, "buffers"],
    [/triebwerk(?!s)|engine|debris|truemmer/, "debris"],
    [/bremse|brake|motor|antrieb|maschine\b|drive/, "brake"], [/triebwerks|maschinenraum|machine.?room/, "machine_room"], [/grube|pit/, "pit"],
    [/schachtkopf|schachtdecke/, "shaft_head"], [/seil|rope/, "ropes"], [/kabine|fahrkorb|\bcar\b|cabin/, "car"], [/schacht|shaft/, "shaft"],
  ];
  const normPart = (s) => { const k = key(s); if (PART_ALIAS[k]) return PART_ALIAS[k]; const low = key(s); for (const [re, p] of KEYWORDS) if (re.test(low)) return p; return null; };
  const toList = (v) => (Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,;|]/) : v != null && typeof v === "object" ? [v] : []);
  const sideOf = (v) => { const k = key(v); return /^(left|links|l)$/.test(k) ? "left" : /^(right|rechts|r)$/.test(k) ? "right" : null; };
  const SYM = { question: "?", question_mark: "?", fragezeichen: "?", frage: "?", "?": "?", exclamation: "!", warning: "!", warnung: "!", "!": "!", check: "✓", ok: "✓", haken: "✓", cross: "✕", x: "✕", kreuz: "✕" };
  const symOf = (v) => { if (v == null || v === true) return "?"; const s = String(v).trim(); return SYM[key(s)] || (s.length && s.length <= 3 ? s : "?"); };

  function parseLabels(v, hl) {
    if (v === true || v === "auto" || v === "all") return (hl.length ? hl : ["car", "ropes", "sheave", "counterweight"]).map((p) => ({ part: p, text: PART_NAME[p], at: null, side: null, col: null }));
    const arr = Array.isArray(v) ? v : typeof v === "string" && v.trim() ? v.split(/[;|]/) : v && typeof v === "object" ? [v] : [];
    const out = [];
    for (const it of arr) {
      if (it == null || it === false) continue;
      if (typeof it === "object") {
        let part = normPart(it.part ?? it.target ?? it.id ?? it.name ?? it.of ?? "");
        const text = String(it.text ?? it.label ?? it.title ?? (part ? PART_NAME[part] : "") ?? "").trim();
        if (!part && text) part = normPart(text);
        if (text) out.push({ part, text, at: tsec(it.at ?? it.t ?? it.time ?? it.start ?? it.delay), side: sideOf(it.side ?? it.align), col: colorOf(it.color, null) });
      } else {
        const s = String(it).trim(); if (!s) continue;
        const m = s.match(/^([a-z_]+)\s*[:=]\s*(.+)$/);
        if (m && PART_NAME[m[1]]) out.push({ part: m[1], text: m[2].trim(), at: null, side: null, col: null });
        else out.push({ part: normPart(s), text: s, at: null, side: null, col: null });
      }
    }
    const used = new Set(out.filter((o) => o.part).map((o) => o.part));
    const fallback = [...hl, "car", "ropes", "sheave", "counterweight", "governor", "safety_gear", "rails", "buffers", "brake"];
    for (const o of out) if (!o.part) { o.part = fallback.find((p) => !used.has(p)) || "car"; used.add(o.part); }
    return out.slice(0, 8);
  }
  function parseMarkers(v) {
    const arr = Array.isArray(v) ? v : v == null || v === false ? [] : typeof v === "string" ? v.split(/[,;|]/) : [v];
    const out = [];
    for (const it of arr) {
      if (it == null || it === false) continue;
      if (typeof it === "object") { const part = normPart(it.part ?? it.target ?? it.on ?? ""); if (part) out.push({ part, sym: symOf(it.symbol ?? it.icon ?? it.text ?? it.type), at: tsec(it.at ?? it.t ?? it.time), col: colorOf(it.color, null) }); }
      else { const part = normPart(it); if (part) out.push({ part, sym: "?", at: null, col: null }); }
    }
    return out.slice(0, 6);
  }
  function parseReadouts(v) {
    const arr = Array.isArray(v) ? v : v == null || v === false || v === "" ? [] : [v];
    const out = [];
    for (const it of arr) {
      if (it == null || it === false || it === "") continue;
      if (typeof it === "object") { const text = String(it.text ?? it.value ?? it.label ?? "auto"); out.push({ text, at: tsec(it.at ?? it.t ?? it.time), cap: it.caption ?? it.title ?? it.sub ?? null, col: colorOf(it.color, null) }); }
      else out.push({ text: it === true ? "auto" : String(it), at: null, cap: null, col: null });
    }
    return out.slice(0, 3);
  }

  function parseParams(pr) {
    pr = pr && typeof pr === "object" ? pr : {};
    const sKey = key(pr.state ?? pr.mode ?? "idle");
    let state = STATE_ALIAS[sKey] || "idle";
    const dirUp = /^(up|aufwaerts|nach_oben|oben|upward|upwards|hoch|ascending)$/.test(key(pr.direction ?? pr.dir ?? ""));
    if ((state === "overspeed" && dirUp) || (state === "moving_up" && bool(pr.runaway ?? pr.uncontrolled, false))) state = "runaway_up";
    const fRaw = pr.focus ?? pr.frame_focus ?? pr.zoom ?? "full";
    const focus = (typeof fRaw === "string" && FOCUS_ALIAS[key(fRaw)]) || "full";
    const n = Math.round(clamp(num(pr.rope_count ?? pr.ropes ?? pr.n_ropes ?? pr.rope_n, 6), 1, 12));
    const floors = Math.round(clamp(num(pr.floors ?? pr.storeys ?? pr.stockwerke ?? pr.levels, 6), 3, 8));
    const spread = (k) => { const order = []; for (let j = 0; j < n; j++) order.push(j % 2 === 0 ? n - 1 - (j >> 1) : j >> 1); return order.slice(0, k); };
    const idxList = (raw) => {
      if (Array.isArray(raw)) return [...new Set(raw.map((x) => Math.round(num(x, -1))).filter((x) => x >= 0 && x < n))];
      if (typeof raw === "string" && /all|alle/i.test(raw)) return spread(n);
      if (raw === true) return spread(1);
      return spread(Math.round(clamp(num(raw, 0), 0, n)));
    };
    // gerissene Seile: Anzahl, Index-Liste oder "all"
    let broken = idxList(pr.broken_ropes ?? pr.broken ?? pr.snapped_ropes ?? pr.broken_rope);
    const bsK = key(pr.broken_style ?? pr.break_style ?? pr.rope_style ?? "snap");
    let brokenStyle = /fade|ghost|remove|ausblend/.test(bsK) ? "fade" : /damage|beschaed|fray/.test(bsK) ? "damaged" : "snap";
    if (state === "rope_snap" && broken.length === 0) broken = spread(Math.min(1, n));
    if (state === "all_ropes_snap") { broken = spread(n); if (brokenStyle !== "snap") brokenStyle = "snap"; }
    let damaged = idxList(pr.damaged_ropes ?? pr.damaged ?? pr.rope_damage ?? pr.damaged_rope);
    if (brokenStyle === "damaged") { damaged = [...new Set([...damaged, ...broken])]; broken = []; brokenStyle = "snap"; if (state === "rope_snap") state = "idle"; }
    broken.sort((a, b) => a - b);
    const highlight = [...new Set(toList(pr.highlight ?? pr.highlights ?? pr.hl).map(normPart).filter(Boolean))];
    const labels = parseLabels(pr.labels ?? pr.callouts ?? pr.label, highlight);
    const floorV = pr.floor ?? pr.car_floor ?? pr.start_floor ?? pr.from_floor ?? pr.position;
    const toV = pr.to_floor ?? pr.target_floor ?? pr.to ?? pr.end_floor;
    const vNom = clamp(num(pr.speed ?? pr.nominal_speed ?? pr.v_nenn ?? pr.rated_speed, 1.6), 0.3, 10);
    // Overlays (Liste oder Einzelwert)
    const ovList = [].concat(pr.overlay ?? [], pr.overlays ?? []);
    let big = null; const ovf = {};
    for (const it of ovList) {
      if (it == null || it === false) continue;
      const ob = typeof it === "object" ? it : null, k = key(ob ? ob.type ?? ob.name ?? ob.kind ?? ob.symbol ?? "question_mark" : it);
      if (/question|frage|^\?$/.test(k)) big = { sym: "?", part: normPart(ob?.part ?? "car") || "car", at: tsec(ob?.at ?? pr.overlay_at), col: colorOf(ob?.color, null) };
      else if (/exclam|warn|ausrufe|^!$/.test(k)) big = { sym: "!", part: normPart(ob?.part ?? "car") || "car", at: tsec(ob?.at ?? pr.overlay_at), col: colorOf(ob?.color, null) };
      else if (/escape|entweich/.test(k)) ovf.airEscape = ob || {};
      else if (/coil|spirale|seilhaufen|pile|spring|feder/.test(k)) ovf.ropeCoil = ob || {};
      else if (/air|luft|hatch|schraffur|cushion|polster|pressure/.test(k)) ovf.airCushion = ob || {};
    }
    // Seilsequenz
    const rsRaw = pr.rope_sequence ?? pr.highlight_sequence ?? pr.rope_seq ?? pr.sequence;
    let ropeSeq = null;
    if (typeof rsRaw === "number") ropeSeq = { at: null, step: clamp(rsRaw, 0.05, 2) };
    else { const r = fo(rsRaw); if (r) ropeSeq = { at: tsec(r.at ?? r.start), step: r.step != null ? clamp(num(r.step, 0.3), 0.05, 2) : null }; }
    // Fall
    const fallRaw = pr.fall_to ?? pr.fall_target ?? pr.fall ?? (state === "all_ropes_snap" ? toV : undefined);
    let fallTo = null;
    if (fallRaw != null && fallRaw !== false) {
      if (fallRaw === true || /^(pit|grube|schachtgrube|bottom|buffer|buffers|puffer|ug|untergeschoss|keller|basement|long|ground|boden)$/.test(key(fallRaw))) fallTo = "pit";
      else { const z = num(fallRaw, null); if (z != null) fallTo = z; }
    }
    const sw = fo(pr.stopwatch ?? pr.stop_watch ?? pr.stoppuhr);
    let slowmoMs = num(pr.slowmo_ms ?? pr.slow_motion_ms ?? pr.slowmo_window_ms, null);
    if (slowmoMs == null && typeof pr.slowmo === "number") slowmoMs = pr.slowmo;
    if (slowmoMs == null && sw && sw.to_ms != null) slowmoMs = num(sw.to_ms, 15) - num(sw.from_ms, 0);
    if (slowmoMs != null) slowmoMs = clamp(slowmoMs, 1, 3000);
    const vEndF = num(pr.v_end_factor ?? pr.end_factor ?? pr.speed_factor_end, null);
    let v0 = num(pr.v0 ?? pr.start_speed ?? pr.initial_speed ?? pr.v_start, null);
    if (v0 == null && bool(pr.moving ?? pr.start_moving ?? pr.in_motion, false)) v0 = vNom;
    const rulerRaw = pr.ruler ?? pr.lineal ?? (pr.ruler_cm != null ? { value_cm: pr.ruler_cm } : null);
    const ruler = fo(rulerRaw);
    if (ruler) { const mx = num(ruler.max_cm ?? ruler.max, null), vc = num(ruler.value_cm ?? ruler.cm, null); ruler.maxCm = clamp(mx != null ? Math.ceil(mx) : vc != null ? Math.ceil(vc + 0.35) : 2, 1, 20); ruler.auto = mx == null && vc == null; ruler.atv = tsec(ruler.at); }
    const sfRaw = pr.safety_factor ?? pr.load_factor ?? pr.load_chip ?? pr.reserve_chip;
    let safetyFactor = null;
    if (sfRaw != null && sfRaw !== false && sfRaw !== "") safetyFactor = typeof sfRaw === "object" ? { text: String(sfRaw.text ?? sfRaw.value ?? "≈2×"), at: tsec(sfRaw.at), cap: sfRaw.caption ?? null, col: colorOf(sfRaw.color, COL.green) } : { text: String(sfRaw), at: null, cap: null, col: COL.green };
    const pk = key(pr.passenger_pose ?? pr.pose ?? pr.people_pose ?? pr.person_pose ?? "");
    const pose = /float|schweb|weightless|schwerelos/.test(pk) ? "floating" : /seat|sit/.test(pk) ? "seated" : "stand";
    const elev = pr.elevations;
    const flRaw = pr.floor_labels ?? pr.floor_numbers ?? pr.floor_label ?? (elev === false ? false : undefined);
    const floorLabels = Array.isArray(flRaw) ? flRaw.map((s) => (s == null ? "" : String(s))) : bool(flRaw, true);
    const frameCol = colorOf(pr.frame_color ?? pr.car_frame ?? pr.frame, null);
    const circ = fo(pr.safety_circuit ?? pr.circuit ?? pr.governor_switch ?? pr.switch);
    const plateRaw = fo(pr.inspection_plate ?? pr.plate ?? pr.plakette);
    const debrisRaw = fo(pr.debris ?? pr.falling_object ?? pr.debris_object);
    const cruiseRaw = pr.cruise ?? pr.constant_speed ?? pr.hold_speed ?? (key(pr.ramp) === "in" ? "ramp" : undefined);
    const cruise = cruiseRaw == null || cruiseRaw === false || (typeof cruiseRaw === "string" && FALSE_RE.test(cruiseRaw)) ? null : /ramp|in|anfahr/.test(key(cruiseRaw)) ? "ramp" : "hold";
    const airC = fo(pr.air_cushion ?? pr.air_pressure_hatch ?? pr.air_hatch ?? pr.luftpolster ?? ovf.airCushion);
    const coil = fo(pr.rope_coil ?? pr.rope_coil_spring ?? pr.rope_pile ?? pr.seilhaufen ?? ovf.ropeCoil);
    const esc = fo(pr.air_escape ?? pr.luft_entweicht ?? ovf.airEscape);
    let markers = parseMarkers(pr.markers ?? pr.marker ?? pr.badges);
    const qm = pr.question_mark ?? pr.question;
    if (qm && typeof qm === "string") markers = markers.concat(parseMarkers(qm));
    if (qm === true && !big) big = { sym: "?", part: "car", at: tsec(pr.overlay_at), col: null };
    const o = {
      state, focus, n, floors, broken, allBroken: broken.length >= n, brokenStyle, damaged, highlight, hl: new Set(highlight), labels,
      floor: floorV == null ? null : num(floorV, null), toFloor: toV == null ? null : num(toV, null),
      vNom, people: Math.round(clamp(num(pr.people ?? pr.passengers ?? pr.persons, 2), 0, 4)), pose,
      hud: pr.hud !== false && pr.show_speed !== false && pr.panel !== false && !(typeof pr.hud === "string" && FALSE_RE.test(pr.hud)),
      hudAt: tsec(pr.hud_at ?? (pr.hud && typeof pr.hud === "object" ? pr.hud.at : null)),
      beats: toList(pr.beats ?? pr.beat ?? pr.times).map(tsec).filter((x) => x != null),
      hlColor: colorOf(pr.highlight_color ?? pr.hl_color ?? pr.glow_color, COL.amber), hlAt: tsec(pr.highlight_at ?? pr.hl_at),
      cruise, v0: v0 == null ? null : clamp(v0, 0, 30), slowmoMs, vEndFactor: vEndF == null ? null : clamp(vEndF, 1.001, 5),
      stopwatch: sw ? { at: tsec(sw.at), from: num(sw.from_ms, 0), to: sw.to_ms != null ? num(sw.to_ms, null) : null, label: sw.label ?? null } : null,
      ruler, readouts: parseReadouts(pr.readout ?? pr.readouts ?? pr.chip),
      fallTo, fallFloors: num(pr.fall_floors ?? pr.fall_storeys ?? pr.fall_levels, null), freeze: bool(pr.freeze_before_impact ?? pr.freeze ?? pr.freeze_frame, false),
      freezeIcon: bool(pr.freeze_icon, true), preBroken: bool(pr.pre_broken ?? pr.prebroken ?? pr.already_broken ?? pr.start_broken, /^(free_fall|freefall|freier_fall)$/.test(sKey)),
      floorLabels, levelMarks: bool(pr.level_marks ?? pr.height_marks ?? pr.elevation_marks ?? (elev === true ? true : undefined), false),
      ropeSeq, ropeGap: num(pr.rope_gap, null), safetyFactor,
      panelNote: pr.panel_note ?? pr.hold_text ?? pr.hold_note, frameCol, frameAt: tsec(pr.frame_at ?? pr.frame_time),
      jolt: bool(pr.jolt ?? pr.ruck ?? pr.jerk, false), circuit: circ ? { at: tsec(circ.at) } : null,
      plateOn: !!plateRaw || highlight.includes("inspection_plate") || labels.some((l) => l.part === "inspection_plate") || focus === "plate",
      plateText: pr.plate_text ?? plateRaw?.text ?? null,
      trip: bool(pr.trip ?? pr.governor_trips, false),
      debris: debrisRaw ? { type: key(debrisRaw.type ?? pr.debris ?? "engine"), at: tsec(debrisRaw.at), passAt: tsec(debrisRaw.pass_at ?? debrisRaw.through_at ?? debrisRaw.pass ?? pr.pass_at), passDur: num(debrisRaw.pass_dur ?? debrisRaw.through_dur, null), passFloor: num(debrisRaw.pass_floor ?? debrisRaw.through_floor, null) } : null,
      damageAt: tsec(pr.damage_at ?? pr.damaged_at),
      markers, big, airCushion: airC ? { at: tsec(airC.at) } : null, ropeCoil: coil ? { at: tsec(coil.at) } : null,
      airEscape: esc ? { at: tsec(esc.at), dur: num(esc.dur ?? esc.duration, null) } : null,
      bufferGlow: bool(pr.buffer_glow, true), floorM: clamp(num(pr.floor_height_m ?? pr.storey_height_m, 3), 2, 6),
      snapGap: num(pr.snap_gap, null),
      offX: clamp(num(pr.offset_x ?? pr.shift_x ?? pr.frame_offset_x, 0), -400, 400),
      inclCar: bool(pr.include_car ?? pr.frame_car ?? pr.show_car, false),
      loupe: focus === "plate" && bool(pr.plate_loupe ?? pr.loupe ?? (plateRaw && plateRaw.loupe), true),
      loupeAt: tsec(pr.loupe_at ?? plateRaw?.at),
      plateMonth: Math.round(clamp(num(pr.plate_month ?? plateRaw?.month, 6), 1, 12)),
    };
    if (o.ropeGap != null) o.ropeGap = clamp(o.ropeGap, 1.5, 6);
    return o;
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
    G.plateX = G.carX1 - 24; G.plateDY = CH * 0.58; G.plateR = 10;
    G.coilH0 = G.bufH * 1.35; G.coilW = 54;
    const n = o.n, gmax = o.ropeGap != null ? o.ropeGap : o.focus === "ropes" || o.ropeSeq ? 4 : 3.3, gap = n > 1 ? Math.min(gmax, 20 / (n - 1)) : 0;
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

  // ---------- Zeitplan (Beats) ----------
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
  function startZ(o, top, def, minZ) { return clamp(Math.max(o.floor != null ? o.floor : def, minZ), 0, top); }
  const GRAV = 9.81;

  function timing(o, G, d) {
    const hi = Math.max(0.3, d - 0.3), cl = (x) => clamp(x, 0.3, hi);
    const at = (v) => atS(v, d), bt = (i) => (o.beats.length > i ? at(o.beats[i]) : null);
    const T = { d, hi, cl, at }, top = G.N - 1, st = o.state, PXM = G.fh / o.floorM;
    T.PXM = PXM;
    if (st === "moving_up" || st === "moving_down") {
      const up = st === "moving_up";
      if (o.cruise) {
        const ramp = o.cruise === "ramp", a = ramp ? bt(0) ?? 0.3 : 0, R = ramp ? clamp(0.2 * d, 0.4, 1.0) : 0;
        const dist = (tt) => (tt <= a ? 0 : tt < a + R ? ((tt - a) * (tt - a)) / (2 * R) : R / 2 + (tt - a - R));
        let rate = o.vNom * PXM; const need = dist(d) * rate, avail = G.fh * top * 0.98;
        if (need > avail) rate *= avail / need;
        const dz = (dist(d) * rate) / G.fh;
        let z0 = o.floor != null ? clamp(o.floor, 0, top) : up ? 0.5 : top - 0.5;
        z0 = up ? clamp(z0, 0, top - dz) : clamp(z0, dz, top);
        T.cr = { a, R, dist, rate, y0: G.levelY(z0), up };
      } else {
        T.a = bt(0) ?? Math.min(0.06 * d, 0.6); const arr = bt(1);
        T.T = arr != null && arr > T.a + 0.4 ? arr - T.a : Math.min(0.84 * d, 10);
      }
    } else if (st === "rope_snap") {
      T.snap = bt(0) ?? (o.debris ? cl(Math.max(1.0, 0.45 * d)) : clamp(0.18 * d, 0.5, 2.2));
      T.gap = o.snapGap != null ? clamp(o.snapGap, 0, 1) : 0.12;
      T.hold = bt(1) ?? T.snap + T.gap * Math.max(0, o.broken.length - 1) + 0.55;
    } else if (st === "all_ropes_snap") {
      const F = {}, n = o.n, slow = o.slowmoMs != null || o.vEndFactor != null;
      F.v0 = Math.max(0, o.v0 ?? (slow ? o.vNom : 0));
      F.gap = o.snapGap != null ? clamp(o.snapGap, 0, 0.5) : slow ? 0.035 : Math.min(0.14, (0.22 * d) / Math.max(1, n));
      if (o.preBroken) { F.cut = -100; F.fall = 0; }
      else { F.cut = bt(0) ?? (o.debris ? cl(Math.max(1.0, 0.3 * d)) : clamp(0.12 * d, 0.4, 1.6)); F.fall = F.cut + F.gap * (n - 1) + (slow ? 0.02 : 0.08); }
      F.y0 = G.levelY(startZ(o, top, top - 1, 0.8));
      F.yF = F.y0 + F.v0 * PXM * Math.max(0, F.fall);
      F.yImp = G.bufTop - 16; F.freeze = o.freeze; F.impact = false; F.PXM = PXM;
      const yFreeze = G.yBot - 0.3 * G.fh;
      let yT = null;
      if (o.fallTo === "pit") yT = F.yImp;
      else if (typeof o.fallTo === "number") yT = Math.min(F.yImp, G.levelY(clamp(o.fallTo, -0.3, top)));
      else if (o.fallFloors != null) yT = Math.min(F.yImp, F.yF + Math.max(0, o.fallFloors) * G.fh);
      else if (F.freeze) yT = F.yImp;
      else if (o.preBroken && !slow) yT = Math.min(F.yImp, F.yF + 2.5 * G.fh);
      if (yT != null && F.freeze && yT > yFreeze) yT = yFreeze;
      const mode = slow ? "slowmo" : yT != null && yT > F.yF + 4 ? "long" : "short";
      if (mode === "slowmo") { F.tauEnd = o.slowmoMs != null ? o.slowmoMs / 1000 : Math.max(0.001, ((o.vEndFactor - 1) * Math.max(F.v0, 0.01)) / GRAV); F.D = F.v0 * F.tauEnd + 0.5 * GRAV * F.tauEnd * F.tauEnd; F.freeze = false; }
      else {
        if (mode === "long") { F.impact = !F.freeze; F.D = (yT - F.yF) / PXM; } else { F.D = (0.5 * G.fh) / PXM; F.freeze = false; }
        F.tauEnd = (-F.v0 + Math.sqrt(F.v0 * F.v0 + 2 * GRAV * F.D)) / GRAV;
      }
      const Dimp = Math.max(0.01, (F.yImp - F.yF) / PXM), tauImp = (-F.v0 + Math.sqrt(F.v0 * F.v0 + 2 * GRAV * Dimp)) / GRAV;
      F.tauStop = F.impact ? Math.max(F.tauEnd, tauImp) : F.tauEnd;
      let e = bt(1);
      const defEnd = mode === "short" || (o.preBroken && o.fallTo == null && o.fallFloors == null && !F.freeze) ? 0.97 * d : mode === "slowmo" ? F.fall + 0.55 * (d - F.fall) : F.fall + 0.72 * (d - F.fall);
      if (e == null || e < F.fall + 0.25) e = Math.max(F.fall + 0.25, defEnd);
      F.tEnd = e; F.k = F.tauEnd / Math.max(0.05, F.tEnd - F.fall); F.mode = mode; F.tImp = F.fall + F.tauStop / F.k;
      T.F = F;
    } else if (st === "overspeed") {
      T.ramp = Math.min(0.85 * d, 8.2); T.trip = bt(0) ?? 0.548 * T.ramp;
    } else if (st === "runaway_up") {
      const R = {};
      R.start = bt(0) ?? cl(Math.min(0.5, 0.1 * d));
      const zMax = (G.yBot - (G.slabBot + G.CH + 48)) / G.fh;
      const z0 = o.floor != null ? clamp(o.floor, 0, zMax - 0.5) : Math.min(1, top - 1);
      const zT = o.toFloor != null ? clamp(o.toFloor, z0 + 0.3, zMax) : zMax - 0.08;
      R.y0 = G.levelY(z0); R.yT = G.levelY(zT); R.yMin = G.levelY(zMax);
      R.trip = o.trip ? bt(1) ?? cl(0.75 * d) : null;
      if (R.trip != null && R.trip < R.start + 0.3) R.trip = Math.min(d, R.start + 0.3);
      const Tv = Math.max(0.3, d - R.start); R.Dm = (R.y0 - R.yT) / PXM; R.acc = (2 * R.Dm) / (Tv * Tv); R.brk = 0.5; R.PXM = PXM;
      T.R = R;
    } else if (st === "safety_engage") {
      T.te = bt(0) ?? clamp(0.12 * d, 0.35, 1.5);
      let tS = bt(1); if (tS == null || tS < T.te + 0.25) tS = T.te + clamp(0.4 * d, 1.0, 5);
      T.tS = tS; T.w0 = 0.45 / (T.te + (T.tS - T.te) / 2);
    } else if (st === "stopped") {
      T.jolt = o.jolt ? bt(0) ?? clamp(0.25 * d, 0.3, 1.2) : null;
    } else if (st === "on_buffer") {
      T.a = bt(0) ?? Math.min(0.12 * d, 0.8); const e = bt(1);
      T.c = e != null && e > T.a + 0.15 ? e - T.a : Math.min(0.33 * d, 2.4);
      T.landY = o.ropeCoil ? G.PB - G.coilH0 - 10 : G.bufTop - 16;
      T.landComp = o.ropeCoil ? 0.42 * G.coilH0 : 0.55 * G.bufH;
    }
    // Zusätze
    if (o.ropeSeq) { const ra = at(o.ropeSeq.at) ?? (st === "idle" ? bt(0) : null) ?? cl(0.25 * d); T.seq = { at: ra, step: o.ropeSeq.step ?? Math.min(0.45, (0.45 * d) / Math.max(1, o.n)) }; }
    T.hlAt = at(o.hlAt);
    T.hudAt = at(o.hudAt) ?? 0;
    if (o.debris) T.debrisT = at(o.debris.at) ?? (st === "rope_snap" ? T.snap : st === "all_ropes_snap" && !o.preBroken ? T.F.cut : cl(Math.max(1.0, 0.45 * d)));
    if (o.debris && o.debris.passAt != null) { // zweites Triebwerk: durchschlägt das Gebäude quer (hinter dem Schacht)
      T.passAt = at(o.debris.passAt); T.passDur = clamp(o.debris.passDur ?? 1.2, 0.5, 3);
      const zP = o.debris.passFloor != null ? clamp(o.debris.passFloor, 0.3, top) : top;
      T.passY = G.levelY(zP) - 0.5 * G.fh;
    }
    T.dmgAt = at(o.damageAt) ?? T.debrisT ?? cl(0.35 * d);
    const evEnd = st === "safety_engage" ? T.tS : st === "on_buffer" ? T.a + T.c : st === "stopped" ? (T.jolt != null ? T.jolt + 0.15 : 0.3) : st === "all_ropes_snap" ? (T.F.impact ? T.F.tImp : T.F.tEnd) : 0.3;
    T.frameAt = at(o.frameAt) ?? Math.min(hi, evEnd);
    T.swAt = o.stopwatch ? at(o.stopwatch.at) ?? (T.F && T.F.cut > 0 ? T.F.cut : 0.3) : null;
    T.rulerAt = o.ruler ? at(o.ruler.atv) ?? (T.F && T.F.cut > 0 ? T.F.cut : 0.3) : null;
    T.roAt = o.readouts.map((r, i) => at(r.at) ?? (T.F ? Math.min(hi, Math.min(T.F.tEnd, T.F.tImp) + 0.2 * i) : cl(0.6 * d + 0.3 * i)));
    T.sfAt = o.safetyFactor ? at(o.safetyFactor.at) ?? (T.hold != null ? Math.min(hi, T.hold + 0.3) : cl(0.6 * d)) : null;
    T.mkAt = o.markers.map((m, i) => at(m.at) ?? cl(0.5 + 0.3 * i));
    T.bigAt = o.big ? at(o.big.at) ?? (T.F ? Math.min(hi, Math.min(T.F.tEnd, T.F.tImp) + 0.2) : cl(0.6 * d)) : null;
    T.airAt = o.airCushion ? at(o.airCushion.at) ?? 0 : null;
    T.coilAt = o.ropeCoil ? at(o.ropeCoil.at) ?? 0 : null;
    if (o.loupe) T.loupeAt = at(o.loupeAt) ?? cl(0.3);
    if (o.airEscape) { T.escAt = at(o.airEscape.at) ?? cl(0.5 * d); T.escDur = clamp(o.airEscape.dur ?? Math.max(1, 0.35 * d), 0.3, d); }
    return T;
  }

  /** Fallmodell (all_ropes_snap): vor dem Schnitt Fahrt mit v0, danach freier Fall in (Zeitlupen-)Zeit τ = k·(t - fall). */
  function fallAt(F, tt) {
    if (tt < F.fall) return { y: F.y0 + F.v0 * F.PXM * Math.max(0, tt), v: F.v0, tau: 0, free: false, landed: false, frozen: false };
    const raw = F.k * (tt - F.fall), tau = Math.min(raw, F.tauStop), done = raw >= F.tauStop;
    const y = Math.min(F.yImp, F.yF + F.PXM * (F.v0 * tau + 0.5 * GRAV * tau * tau)), v = F.v0 + GRAV * tau;
    if (done && F.impact) { const q = (tt - F.tImp) / 0.2, bounce = 0.1 * Math.exp(-(tt - F.tImp) * 6) * Math.sin((tt - F.tImp) * 26); return { y: F.yImp + 38 * (0.78 * easeOut(q) + bounce * sat(q)), v: 0, tau, free: false, landed: true, frozen: false }; }
    return { y, v, tau, free: !done, landed: false, frozen: done && F.freeze, hold: done };
  }
  function runAt(R, tt) {
    if (tt <= R.start) return { y: R.y0, v: 0 };
    const tc = R.trip != null ? Math.min(tt, R.trip) : tt, tau = tc - R.start;
    let y = R.y0 - 0.5 * R.acc * tau * tau * R.PXM, v = R.acc * tau;
    if (R.trip != null && tt > R.trip) { const q = Math.min(tt - R.trip, R.brk), v1 = v; y -= R.PXM * (v1 * q - (0.5 * (v1 / R.brk) * q * q)); v = v1 * (1 - q / R.brk); }
    return { y: Math.max(R.yMin, y), v };
  }

  /** Kabinen-Schwellenhöhe (Welt-y) zur Zeit tt. */
  function carYAt(o, G, T, tt) {
    const top = G.N - 1, Y = G.levelY, d = T.d;
    switch (o.state) {
      case "moving_up": case "moving_down": {
        if (T.cr) { const C = T.cr; return C.y0 + (C.up ? -1 : 1) * C.dist(tt) * C.rate; }
        const [a, b] = travelEnds(o, top); return Y(a + (b - a) * trap((tt - T.a) / T.T).s);
      }
      case "rope_snap": { let y = Y(startZ(o, top, top - 1, 0)); if (tt > T.snap && o.brokenStyle === "snap") { const a = tt - T.snap; y += 3.2 * Math.exp(-a * 3.2) * Math.sin(a * 17); } return y; }
      case "all_ropes_snap": return fallAt(T.F, tt).y;
      case "overspeed": { const x = sat(tt / d); return Y(startZ(o, top, top - 1.5, 1.1)) + 0.9 * G.fh * (0.55 * x + 0.45 * x * x); }
      case "runaway_up": return runAt(T.R, tt).y;
      case "safety_engage": {
        let s;
        if (tt < T.te) s = T.w0 * tt;
        else if (tt < T.tS) { const q = tt - T.te; s = T.w0 * T.te + T.w0 * (q - (q * q) / (2 * (T.tS - T.te))); }
        else s = 0.45;
        return Y(startZ(o, top, top - 2.4, 0.8)) + s * G.fh;
      }
      case "stopped": {
        let y = Y(startZ(o, top, top - 2.85, 0.35));
        if (T.jolt != null) { if (tt < T.jolt) y -= 16 * (1 - tt / T.jolt); else { const a = tt - T.jolt; y += 3.5 * Math.exp(-a * 7) * Math.sin(a * 32); } }
        return y;
      }
      case "on_buffer": {
        if (tt < T.a) return T.landY - 12 * (1 - tt / T.a);
        return T.landY + T.landComp * easeOut((tt - T.a) / T.c);
      }
      default: return Y(startZ(o, top, Math.min(2, top), 0));
    }
  }

  function motion(o, G, T, t, d) {
    const vTrip = 1.15 * o.vNom;
    const M = { carY: carYAt(o, G, T, t), v: 0, brake: 1, wedge: 0, heat: 0, tripT: null, lever: 0, slow: false, speedPanel: false, status: "", statusCol: COL.cyan,
      snaps: {}, ropePanel: false, holdA: 0, streak: null, bufComp: 0, gov: COL.cyan, govSpin: 0, sparks: null, dir: 0, floatK: 0, bobT: t, danger: false, trail: false };
    const st = o.state;
    M.yAt = (tt) => carYAt(o, G, T, Math.max(0, tt));
    o.broken.forEach((idx, j) => { M.snaps[idx] = st === "rope_snap" ? T.snap + j * T.gap : st === "all_ropes_snap" ? T.F.cut + j * T.F.gap : -100; });
    if (st === "moving_up" || st === "moving_down") {
      const up = st === "moving_up";
      if (T.cr) {
        const C = T.cr, w = t <= C.a ? 0 : C.R > 0 ? sat((t - C.a) / C.R) : 1;
        M.v = (up ? 1 : -1) * o.vNom * w; M.dir = w > 0.01 ? (up ? 1 : -1) : 0; M.brake = 1 - smooth(w / 0.08);
        M.speedPanel = true; M.status = w < 0.01 ? "Stillstand" : up ? "Fahrt aufwärts" : "Fahrt abwärts";
      } else {
        const x = (t - T.a) / T.T, tr = trap(x);
        M.v = (up ? 1 : -1) * o.vNom * tr.w; M.dir = x > 0 && x < 1 ? (up ? 1 : -1) : 0;
        M.brake = 1 - smooth(x / 0.03) * smooth((1 - x) / 0.03);
        M.speedPanel = true; M.status = x >= 1 ? "Haltestelle erreicht" : x <= 0 ? "Stillstand" : up ? "Fahrt aufwärts" : "Fahrt abwärts"; M.statusCol = x >= 1 ? COL.green : COL.cyan;
      }
    } else if (st === "rope_snap") {
      M.ropePanel = true; M.holdA = smooth((t - T.hold) / 0.35);
    } else if (st === "all_ropes_snap") {
      const F = T.F, P = fallAt(F, t);
      M.fall = P; M.tau = P.tau; M.freeFall = P.free; M.landed = P.landed; M.frozen = P.frozen;
      M.v = -P.v; M.dir = P.v > 0.02 && !P.frozen && !P.hold && !P.landed ? -1 : 0; M.speedPanel = true; M.slow = t > F.cut && F.k < 0.8 && !P.landed;
      M.danger = t >= F.cut; M.trail = F.mode === "long" || F.mode === "short";
      if (P.frozen) M.frozenAge = t - F.tEnd;
      if (P.landed) M.impactAge = t - F.tImp;
      M.status = t < F.cut ? (F.v0 > 0.02 ? "Fahrt abwärts" : "Normalbetrieb") : t < F.fall ? "Tragseile reißen" : P.landed ? "Aufprall" : P.frozen ? "Standbild" : "Freier Fall";
      M.statusCol = t < F.cut ? COL.cyan : P.frozen ? COL.cyan : COL.red;
      if (o.pose === "floating") M.floatK = P.landed ? 0 : P.frozen ? 1 : smooth((t - F.fall) / 0.45);
      if (P.frozen || P.hold) M.bobT = F.tEnd;
    } else if (st === "overspeed") {
      const tTrip = T.trip;
      M.v = -o.vNom * Math.min(1.33, 0.9375 + (0.2125 * t) / Math.max(0.3, tTrip)); M.dir = -1; M.speedPanel = true; M.slow = true; M.danger = true;
      M.tripT = tTrip; M.brake = t >= tTrip ? 1 : 0;
      if (t >= tTrip) { M.lever = clamp((M.carY - carYAt(o, G, T, tTrip)) / 24, 0, 0.6); M.wedge = 0.3 * smooth((t - tTrip) / 0.5); }
      M.status = t < tTrip ? "Übergeschwindigkeit" : "Begrenzer ausgelöst"; M.statusCol = t < tTrip ? COL.amber : COL.red;
    } else if (st === "runaway_up") {
      const R = T.R, P = runAt(R, t);
      M.v = P.v; M.dir = P.v > 0.03 ? 1 : 0; M.speedPanel = true; M.brake = 0; M.brakeFail = t >= R.start - 0.05; M.runaway = true; M.danger = true; M.trail = true;
      if (R.trip != null) {
        M.tripT = R.trip;
        if (t >= R.trip) { M.wedge = smooth((t - R.trip) / 0.2); M.heat = t < R.trip + R.brk ? 1 : Math.exp(-(t - R.trip - R.brk) * 0.9); M.sparks = { t0: R.trip, t1: R.trip + R.brk, yAt: (tt) => runAt(R, tt).y - 26 }; }
      }
      M.status = t < R.start ? "Stillstand" : R.trip != null && t >= R.trip ? (t < R.trip + R.brk ? "Fangvorrichtung greift" : "Kabine gehalten") : "Bremse versagt – Kabine steigt";
      M.statusCol = R.trip != null && t >= R.trip + R.brk ? COL.green : COL.red;
    } else if (st === "safety_engage") {
      const v0 = (2.0 * o.vNom) / 1.6;
      M.v = t < T.te ? -v0 : t < T.tS ? -v0 * (1 - (t - T.te) / (T.tS - T.te)) : 0; M.dir = M.v < -0.01 ? -1 : 0;
      M.speedPanel = true; M.slow = true; M.tripT = -1; M.danger = true;
      M.lever = clamp((12 + M.carY - carYAt(o, G, T, 0)) / 24, 0, 0.6);
      M.wedge = smooth((t - (T.te - 0.2)) / 0.25);
      M.heat = t < T.te ? 0 : t < T.tS ? 1 : Math.exp(-(t - T.tS) * 0.9);
      M.streak = { y0: carYAt(o, G, T, T.te), y1: M.carY };
      M.sparks = { t0: T.te, t1: T.tS, yAt: (tt) => carYAt(o, G, T, tt) };
      M.status = t < T.te ? "Begrenzer ausgelöst" : t < T.tS ? "Fangvorrichtung greift" : "Kabine gehalten";
      M.statusCol = t < T.te ? COL.red : t < T.tS ? COL.amber : COL.green;
    } else if (st === "stopped") {
      M.speedPanel = true; M.tripT = -1; M.lever = 0.6; M.wedge = 1; M.heat = 0.18;
      M.streak = { y0: M.carY - 0.32 * G.fh, y1: M.carY };
      M.status = "Kabine gehalten"; M.statusCol = COL.green;
      if (T.jolt != null) {
        if (t < T.jolt) { M.v = -0.3; M.dir = -1; M.heat = 1; M.status = "Fangvorrichtung greift"; M.statusCol = COL.amber; M.danger = true; }
        else M.heat = 0.18 + 0.82 * Math.exp(-(t - T.jolt) * 1.6);
        M.sparks = { t0: 0, t1: T.jolt, yAt: (tt) => carYAt(o, G, T, tt) };
      }
    } else if (st === "on_buffer") {
      const q = (t - T.a) / T.c, vImp = Math.min(1.0, o.vNom);
      M.v = t < T.a ? -vImp : -vImp * Math.pow(1 - sat(q), 2);
      M.speedPanel = true; M.dir = M.v < -0.02 ? -1 : 0; M.slow = t >= T.a && q < 1;
      M.status = t < T.a ? "Aufsetzen" : q < 1 ? (o.ropeCoil ? "Seil federt" : "Puffer dämpft") : o.ropeCoil ? "Kabine liegt auf" : "Kabine auf Puffer"; M.statusCol = q < 1 ? COL.amber : COL.green;
    } else {
      M.status = "Stillstand";
    }
    if (o.pose === "floating" && st !== "all_ropes_snap") M.floatK = 1;
    // Puffer-Einfederung geometrisch aus der Kabinenlage
    M.bufComp = st === "on_buffer" || M.landed ? clamp(1 - (G.PB - M.carY - 13) / G.bufH, 0, 0.92) : 0;
    M.coilH = o.ropeCoil ? Math.min(G.coilH0, G.PB - (M.carY + 10)) : 0;
    // Geschwindigkeitsbegrenzer: Farbe + Drehwinkel (friert nach Auslösung ein)
    const av = Math.abs(M.v);
    if (M.tripT != null && t >= M.tripT) M.gov = COL.red;
    else if (st === "overspeed" || st === "all_ropes_snap" || st === "runaway_up") M.gov = av > vTrip ? COL.red : av > o.vNom * 1.01 ? COL.amber : COL.cyan;
    const tg = M.tripT != null ? Math.min(t, Math.max(0, M.tripT)) : t;
    M.govY = M.tripT === -1 ? carYAt(o, G, T, 0) : carYAt(o, G, T, tg);
    M.govSpin = (M.tripT != null && t >= M.tripT) || M.frozen ? 0 : av / Math.max(0.5, o.vNom);
    M.tripped = M.tripT != null && t >= M.tripT;
    M.trippedAge = M.tripped ? (M.tripT < 0 ? 5 + t : t - M.tripT) : 0;
    // Sicherheitskreis (Schalter am Begrenzer)
    if (o.circuit) { const ca = T.at(o.circuit.at); M.circOpenT = ca != null ? ca : M.tripT != null ? (M.tripT < 0 ? -1 : M.tripT + 0.04) : null; M.circOpen = M.circOpenT != null && t >= M.circOpenT; }
    // Gegengewicht (Seillänge konstant) bzw. frei fallend, wenn alle Seile gerissen
    let cwBot = G.cwBotLow - (M.carY - G.yTop), cwCut = null;
    if (o.allBroken) {
      if (st === "all_ropes_snap") {
        const F = T.F, cw0 = G.cwBotLow - (F.y0 - G.yTop);
        cwCut = cw0 - F.v0 * F.PXM * Math.max(0, F.fall);
        if (t < F.fall) cwBot = cw0 - F.v0 * F.PXM * t;
        else { const tau = Math.min(F.k * (t - F.fall), F.tauEnd * 1.6); cwBot = cwCut + F.PXM * (-F.v0 * tau + 0.5 * GRAV * tau * tau); }
      } else cwBot = G.cwBufTop + 0.3 * G.cwBufH;
    }
    M.cwBot = Math.min(cwBot, G.cwBufTop + 0.45 * G.cwBufH);
    M.cwComp = sat((M.cwBot - G.cwBufTop) / G.cwBufH);
    M.cwTop = M.cwBot - G.CWH;
    M.cwDrop = cwCut != null ? Math.max(0, M.cwBot - cwCut) : 0;
    // Treibscheibe: Drehwinkel aus Seilweg (Gegenuhrzeigersinn bei Aufwärtsfahrt)
    const refY = o.allBroken ? (st === "all_ropes_snap" ? carYAt(o, G, T, Math.min(t, Math.max(0, T.F.fall))) : carYAt(o, G, T, 0)) : M.carY;
    M.sheaveA = -(G.yBot - refY) / G.R;
    M.deflA = -(G.yBot - refY) / G.rd;
    M.govA = (G.yBot - M.govY) / G.rg;
    M.tpA = (G.yBot - M.govY) / G.tpR;
    M.hitchY = M.carY - G.CH - 26;
    M.allSnapped = o.allBroken && Object.values(M.snaps).every((tb) => t >= tb);
    return M;
  }

  // ---------- Stil: Hervorhebung (pulsierend) / Abdunkeln ----------
  function makeStyle(o, t, T) {
    const hk = T.hlAt == null ? 1 : smooth((t - T.hlAt) / 0.5);
    const any = o.hl.size > 0 && hk > 0, pulse = 0.5 + 0.5 * Math.sin(t * TAU * 0.8);
    return (part, base) => { const h = o.hl.has(part) && hk > 0.02; return { h, c: h ? HLC : base, a: any ? (h ? 1 : 1 - 0.48 * hk) : 1, g: h ? 1 + (0.2 + 0.7 * pulse) * hk : 1, w: h ? 1 + 0.3 * hk : 1, pulse, k: h ? hk : 0 }; };
  }

  // ---------- Bauwerk: Erdreich, Geschosse, Schacht, Triebwerksraum ----------
  function drawStructure(ctx, L, G, o, sty, t, base) {
    const sh = sty("shaft", COL.cyan), pit = sty("pit", COL.cyan), mr = sty("machine_room", COL.cyan);
    const x0 = G.BX0 - 120, x1 = G.BX1 + 120, yG = G.yBot + 8;
    const walls = (c) => { c.rect(G.S0 - 8, G.slabBot, 8, G.PB + 10 - G.slabBot); c.rect(G.S1, G.slabBot, 8, G.PB + 10 - G.slabBot); c.rect(G.S0 - 8, G.PB, G.SW + 16, 10); };
    const mrp = (c) => {
      c.rect(G.MR0 - 8, G.MRtop - 8, G.MR1 - G.MR0 + 16, 8);
      c.rect(G.MR0 - 8, G.MRtop, 8, G.yRoof - G.MRtop); c.rect(G.MR1, G.MRtop, 8, G.yRoof - G.MRtop);
      c.rect(G.MR0, G.slabTop, G.MR1 - G.MR0, G.slabBot - G.slabTop);
    };
    if (sh.h) glow(ctx, L, walls, HLC, 1.4 * sh.w, 0.45 * sh.g, 0.95);
    if (pit.h) glow(ctx, L, (c) => c.rect(G.S0 + 2, G.yBot + 10, G.SW - 4, G.PB - G.yBot - 12), HLC, 2, pit.g, 0.8);
    if (mr.h) { glow(ctx, L, mrp, HLC, 1.4 * mr.w, 0.45 * mr.g, 0.95); fill(ctx, (c) => c.rect(G.MR0, G.MRtop, G.MR1 - G.MR0, G.slabTop - G.MRtop), HLC, 0.04 + 0.03 * mr.pulse); }
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
    stroke(ctx, (c) => { for (let k = 0; k < G.N; k++) { const y = G.levelY(k); c.moveTo(G.BX0 - 4, y - G.fh * 0.25); c.lineTo(G.BX0 - 4, y - G.fh * 0.7); c.moveTo(G.BX1 + 4, y - G.fh * 0.25); c.lineTo(G.BX1 + 4, y - G.fh * 0.7); } }, COL.cyan, 2, 0.35 * base);
    // Schachttüren (Röntgen: vorne, gestrichelt)
    stroke(ctx, (c) => { for (let k = 0; k < G.N; k++) { const y = G.levelY(k); if (vis(G.carX0, y - G.CH, G.carX1, y)) c.rect(G.carX0 + 14, y - G.CH * 0.92, G.carW - 28, G.CH * 0.92); } }, COL.cyan, 1, 0.08 * base);
    fill(ctx, walls, "rgba(63,210,255,0.06)", base);
    if (!sh.h) stroke(ctx, walls, COL.cyan, 1.4, 0.5 * base);
    fill(ctx, mrp, "rgba(63,210,255,0.07)", base);
    if (!mr.h) stroke(ctx, mrp, COL.cyan, 1.4, 0.55 * base);
  }

  function drawRails(ctx, L, G, sty, M) {
    const s = sty("rails", COL.steel), yA = G.slabBot + 2, yB = G.PB;
    const rails = (c) => { c.moveTo(G.railL, yA); c.lineTo(G.railL, yB); c.moveTo(G.railR, yA); c.lineTo(G.railR, yB); };
    if (s.h) glow(ctx, L, rails, s.c, 3 * s.w, 0.45 * s.g, s.a); else { stroke(ctx, rails, s.c, 3 + 4 / ZS, 0.08 * s.a); stroke(ctx, rails, s.c, 3, 0.85 * s.a); }
    stroke(ctx, (c) => { c.moveTo(G.cwRailL, yA); c.lineTo(G.cwRailL, yB); c.moveTo(G.cwRailR, yA); c.lineTo(G.cwRailR, yB); }, s.c, 2, 0.7 * s.a);
    stroke(ctx, (c) => { for (let y = G.slabBot + G.fh * 0.35; y < G.PB - 10; y += G.fh * 0.5) { for (const x of [G.railL, G.railR, G.cwRailL, G.cwRailR]) { c.moveTo(x - 6, y); c.lineTo(x + 6, y); } } }, s.h ? HLC : COL.cyan, 1.5, 0.3 * s.a);
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

  function drawBuffers(ctx, L, G, o, sty, M) {
    if (!vis(G.S0, G.PB - 60, G.S1, G.PB + 10)) return;
    const s = sty("buffers", COL.steel), warm = M.bufComp > 0.02 && !s.h && o.bufferGlow, col = warm ? COL.amber : s.c;
    const dim = o.ropeCoil ? 0.6 : 1;
    const h = G.bufH * (1 - M.bufComp), cyl = G.bufH * 0.42;
    const oil = (c) => { for (const dx of [-36, 36]) { const x = G.carCX + dx; c.rect(x - 9, G.PB - cyl, 18, cyl); c.moveTo(x, G.PB - cyl); c.lineTo(x, G.PB - h + 2); c.rect(x - 13, G.PB - h - 3, 26, 4); } };
    fill(ctx, (c) => { for (const dx of [-36, 36]) c.rect(G.carCX + dx - 9, G.PB - cyl, 18, cyl); }, col, 0.1 * s.a * dim);
    if (s.h || warm) glow(ctx, L, oil, col, 2 * s.w, 0.6 * s.g, 0.9 * s.a * dim); else stroke(ctx, oil, col, 2, 0.9 * s.a * dim);
    if (warm) { const k = M.bufComp / 0.55; for (const dx of [-36, 36]) L.glowDot(ctx, G.carCX + dx, G.PB - cyl + 4, 22, COL.amber, 0.5 * Math.min(1, k)); }
    // Federpuffer unter dem Gegengewicht
    const hc = G.cwBufH * (1 - M.cwComp), x = G.cwCX, turns = 5, cc = M.cwComp > 0.02 && !s.h && o.bufferGlow ? COL.amber : s.c;
    glow(ctx, L, (c) => {
      c.moveTo(x - 12, G.PB - 2); for (let i = 0; i <= turns * 2; i++) c.lineTo(x + (i % 2 ? 9 : -9), G.PB - 3 - ((hc - 6) * i) / (turns * 2));
      c.rect(x - 13, G.PB - hc - 4, 26, 4);
    }, cc, 1.8 * s.w, s.h ? 0.5 * s.g : 0, 0.85 * s.a);
  }

  // ---------- Grube: Luftpolster, Seilhaufen, entweichende Luft ----------
  function drawAir(ctx, G, o, M, T, t) {
    if (!o.airCushion) return;
    const fin = smooth((t - T.airAt) / 0.6), fout = o.airEscape ? 1 - 0.92 * smooth((t - T.escAt) / T.escDur) : 1, a = fin * fout;
    if (a <= 0.01) return;
    const y0 = M.carY + 12, y1 = G.PB, x0 = G.S0 + 2, x1 = G.S1 - 2; if (y1 - y0 < 4) return;
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
    fill(ctx, (c) => c.rect(x0, y0, x1 - x0, y1 - y0), COL.cyan, 0.07 * a);
    stroke(ctx, (c) => { for (let k = x0 - (y1 - y0); k < x1; k += 9) { c.moveTo(k, y1); c.lineTo(k + (y1 - y0), y0); } }, COL.cyan, 1.2, 0.42 * a, null);
    ctx.restore();
    stroke(ctx, (c) => c.rect(x0, y0, x1 - x0, y1 - y0), COL.cyan, 1, 0.35 * a, [5, 4], -t * 12);
    // Druckpfeile unter dem Kabinenboden
    const ph = 0.5 + 0.5 * Math.sin(t * 4);
    for (const dx of [-44, 0, 44]) { const x = G.carCX + dx, yb = Math.min(y1 - 4, y0 + 18 + 6 * ph); if (yb - y0 < 10) continue; fill(ctx, (c) => arrowShape(c, x, yb, y0 + 3, 3, 12, 7), COL.white, 0.7 * a); }
  }
  function drawCoil(ctx, L, G, o, sty, M, T, t) {
    if (!o.ropeCoil) return;
    const grow = smooth((t - T.coilAt) / 0.9); if (grow <= 0.01) return;
    const s = sty("rope_coil", COL.amber), col = s.h ? HLC : COL.amber, h = M.coilH, cx = G.carCX, w = G.coilW, turns = 5, ry = 4.5;
    const nT = Math.max(1, Math.ceil(turns * grow));
    const yAt = (i) => G.PB - 5 - ((h - 10) * i) / turns;
    stroke(ctx, (c) => { for (let i = 0; i < nT; i++) { const y = yAt(i); c.moveTo(cx + w, y); c.ellipse(cx, y, w, ry, 0, 0, Math.PI, true); } }, col, 1.6, 0.35 * grow);
    const front = (c) => { for (let i = 0; i < nT; i++) { const y = yAt(i); c.moveTo(cx - w, y); c.ellipse(cx, y, w, ry, 0, Math.PI, TAU, true); } };
    glow(ctx, L, front, col, 2.2 * s.w, (M.bufComp > 0.02 || M.carY + 10 > G.PB - G.coilH0 ? 1.4 : 0.8) * s.g, grow);
    stroke(ctx, (c) => { for (let i = 0; i < nT; i++) { const y = yAt(i); c.moveTo(cx - w + 6, y + 2); c.ellipse(cx, y, w - 6, ry - 1, 0, Math.PI * 0.95, Math.PI * 0.2, true); } }, "#ffffff", 0.8, 0.35 * grow, [2, 4]);
  }
  function drawEscape(ctx, G, o, M, T, t) {
    if (!o.airEscape) return;
    const e = sat((t - T.escAt) / 0.4), a = e * (1 - 0.45 * smooth((t - T.escAt - T.escDur) / 0.8)); if (a <= 0.01) return;
    const yEx = G.levelY(0) - G.CH * 0.45;
    const paths = [[[G.S0 + 91, G.PB - 14], [G.S0 + 91, yEx], [G.S0 - 90, yEx]], [[G.S0 + 272, G.PB - 14], [G.S0 + 272, yEx], [G.S1 + 90, yEx]]];
    for (const P of paths) {
      const l1 = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]), l2 = Math.hypot(P[2][0] - P[1][0], P[2][1] - P[1][1]), Ltot = l1 + l2;
      stroke(ctx, (c) => { c.moveTo(P[0][0], P[0][1]); c.lineTo(P[1][0], P[1][1]); c.lineTo(P[2][0], P[2][1]); }, COL.cyan, 1.2, 0.18 * a, [3, 6], -t * 40);
      ctx.save(); ctx.fillStyle = COL.cyan;
      for (let i = 0; i < 7; i++) {
        const ph = (t * 0.55 + i / 7) % 1, dd = ph * Ltot;
        let x, y, ang;
        if (dd < l1) { const k = dd / l1; x = lerp(P[0][0], P[1][0], k); y = lerp(P[0][1], P[1][1], k); ang = -Math.PI / 2; }
        else { const k = (dd - l1) / l2; x = lerp(P[1][0], P[2][0], k); y = P[1][1]; ang = P[2][0] < P[1][0] ? Math.PI : 0; }
        const al = a * Math.sin(ph * Math.PI) * 0.95; if (al < 0.02) continue;
        ctx.globalAlpha = al; ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-2, 0); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      ctx.restore();
    }
    // Türspalte an der untersten Haltestelle
    stroke(ctx, (c) => { c.moveTo(G.S0 - 4, yEx - 10); c.lineTo(G.S0 - 4, yEx + 10); c.moveTo(G.S1 + 4, yEx - 10); c.lineTo(G.S1 + 4, yEx + 10); }, COL.white, 2, 0.5 * a);
  }

  // ---------- Begrenzerseil, Spannrolle, Geschwindigkeitsbegrenzer, Auslösehebel ----------
  function drawGovernor(ctx, L, G, o, sty, M, t) {
    const sr = sty("governor_rope", COL.steel), sg = sty("governor", COL.cyan), tp = sty("tension_pulley", COL.steel), lv = sty("lever", COL.steel);
    {
      const gx = G.gx, gy = G.gy;
      stroke(ctx, (c) => { rr(c, gx - 30, gy - 42, 60, G.slabTop - gy + 42, 6); }, sg.c, 1, 0.35 * sg.a, [4, 4]);
      stroke(ctx, (c) => { c.moveTo(gx - 18, G.slabTop); c.lineTo(gx - 3, gy + 3); c.moveTo(gx + 18, G.slabTop); c.lineTo(gx + 3, gy + 3); c.moveTo(gx - 22, G.slabTop - 1); c.lineTo(gx + 22, G.slabTop - 1); }, COL.steel, 1.6, 0.7 * sg.a);
    }
    const pivX = G.railR + 7, pivY = M.carY + 8, len = G.gL - pivX;
    const tipX = pivX + len * Math.cos(M.lever), tipY = pivY - len * Math.sin(M.lever);
    const loop = (c) => { c.moveTo(G.gL, tipY); c.lineTo(G.gL, G.gy); c.arc(G.gx, G.gy, G.rg, Math.PI, TAU); c.lineTo(G.gR, G.tpY); c.arc(G.gx, G.tpY, G.tpR, 0, Math.PI); c.closePath(); };
    const ropeCol = sr.h ? HLC : M.tripped ? COL.red : sr.c;
    if (sr.h) glow(ctx, L, loop, ropeCol, 1.5 * sr.w, 0.45 * sr.g, sr.a); else { stroke(ctx, loop, ropeCol, 4, 0.1 * sr.a); stroke(ctx, loop, ropeCol, 1.5, (M.tripped ? 0.85 : 0.75) * sr.a); }
    stroke(ctx, (c) => { c.moveTo(G.gL, tipY); c.lineTo(G.gL, G.gy); c.moveTo(G.gR, G.gy); c.lineTo(G.gR, G.tpY); }, "#ffffff", 1.2, 0.35 * sr.a, [2, 7], (G.gy - tipY) % 9);
    // Spannrolle mit Spanngewicht
    const tc = tp.h ? HLC : sr.h ? HLC : COL.steel;
    stroke(ctx, (c) => { c.moveTo(G.gx - 4, G.tpY); c.lineTo(G.gx - 6, G.PB - 13); c.moveTo(G.gx + 4, G.tpY); c.lineTo(G.gx + 6, G.PB - 13); c.rect(G.gx - 10, G.PB - 13, 20, 10); }, tc, 1.3, 0.75 * Math.max(tp.a, sr.a));
    fill(ctx, (c) => c.rect(G.gx - 10, G.PB - 13, 20, 10), tc, 0.2 * Math.max(tp.a, sr.a));
    stroke(ctx, (c) => { c.arc(G.gx, G.tpY, G.tpR - 4, 0, TAU); for (let i = 0; i < 3; i++) { const a = M.tpA + (i * TAU) / 3; c.moveTo(G.gx, G.tpY); c.lineTo(G.gx + Math.cos(a) * (G.tpR - 4), G.tpY + Math.sin(a) * (G.tpR - 4)); } }, tc, 1.3, 0.75 * Math.max(tp.a, sr.a));
    // Auslösehebel + Verbindungsgestänge zur Fangvorrichtung
    const lc = lv.h ? HLC : M.tripped ? COL.red : sty("safety_gear", COL.steel).c;
    glow(ctx, L, (c) => { c.moveTo(pivX, pivY); c.lineTo(tipX, tipY); }, lc, lv.h ? 3 : 2.4, lv.h ? 0.8 * lv.g : 0.6, 0.95 * Math.max(sr.a, lv.a, 0.6));
    L.fillCircle(ctx, pivX, pivY, 2.6, lc); L.fillCircle(ctx, tipX, tipY, 2.2, "#ffffff");
    M.leverMid = [(pivX + tipX) / 2, (pivY + tipY) / 2];
    // Geschwindigkeitsbegrenzer im Triebwerksraum
    if (!vis(G.gx - 40, G.gy - 50, G.gx + 40, G.slabTop + 2)) return;
    const gc = M.gov !== COL.cyan ? M.gov : sg.c, ga = Math.max(sg.a, M.gov !== COL.cyan ? 1 : 0);
    const gx = G.gx, gy = G.gy, r = G.rg;
    fill(ctx, (c) => c.arc(gx, gy, r, 0, TAU), "#06101f", 0.85);
    glow(ctx, L, (c) => c.arc(gx, gy, r, 0, TAU), gc, 2.2 * sg.w, (M.gov === COL.red ? 1.5 : 1) * sg.g, ga);
    stroke(ctx, (c) => { for (let i = 0; i < 12; i++) { const a = M.govA + (i * TAU) / 12; c.moveTo(gx + Math.cos(a) * (r - 5), gy + Math.sin(a) * (r - 5)); c.lineTo(gx + Math.cos(a + 0.18) * (r - 1.5), gy + Math.sin(a + 0.18) * (r - 1.5)); } }, gc, 1.2, 0.8 * ga);
    const spread = clamp(M.govSpin * 0.75, 0, 1), fl = r * (0.28 + 0.3 * spread);
    stroke(ctx, (c) => { for (const k of [0, Math.PI]) { const a = M.govA + k; c.moveTo(gx, gy); c.lineTo(gx + Math.cos(a) * fl, gy + Math.sin(a) * fl); } }, gc, 1.4, ga);
    for (const k of [0, Math.PI]) { const a = M.govA + k; L.fillCircle(ctx, gx + Math.cos(a) * fl, gy + Math.sin(a) * fl, 2.6, gc); }
    if (M.govSpin > 0.15) stroke(ctx, (c) => { for (let i = 0; i < 3; i++) { const a = M.govA + (i * TAU) / 3; c.moveTo(gx + Math.cos(a) * (r - 3), gy + Math.sin(a) * (r - 3)); c.arc(gx, gy, r - 3, a, a - 0.9 * Math.min(1.5, M.govSpin)); } }, gc, 2, 0.35 * ga * Math.min(1, M.govSpin));
    L.fillCircle(ctx, gx, gy, 2.5, "#ffffff");
    // Sperrklinke (fällt bei Auslösung in die Verzahnung)
    const pvx = gx + 23, pvy = gy - 25, a1 = Math.atan2(gy - 15.5 - pvy, gx + 9 - pvx), a0 = a1 + 0.95;
    const pk = M.tripped ? easeOutBack(sat(M.trippedAge / 0.3)) : 0, pa = lerp(a0, a1, pk);
    glow(ctx, L, (c) => { c.moveTo(pvx, pvy); c.lineTo(pvx + Math.cos(pa) * 16.5, pvy + Math.sin(pa) * 16.5); }, M.tripped ? COL.red : gc, 2.4, M.tripped ? 1.3 : 0.6, ga);
    L.fillCircle(ctx, pvx, pvy, 2.4, M.tripped ? COL.red : gc);
    if (M.tripped) L.glowDot(ctx, pvx + Math.cos(pa) * 16.5, pvy + Math.sin(pa) * 16.5, 12 + 10 * Math.exp(-M.trippedAge * 3), COL.red, 0.5 + 0.4 * Math.exp(-M.trippedAge * 2));
  }

  /** Sicherheitskreis: Schalter am Begrenzer, Leitung zum Antrieb (öffnet → rot). */
  function drawCircuit(ctx, L, G, o, sty, M, t) {
    if (!o.circuit || !vis(G.sx, G.MRtop, G.gx + 40, G.slabTop + 4)) return;
    const s = sty("switch", COL.cyan), open = M.circOpen, age = open ? (M.circOpenT < 0 ? 5 : t - M.circOpenT) : 0;
    const y = G.slabTop - 24, xa = G.gx - 48, xb = G.gx - 36, hx1 = G.sx + 72;
    const col = open ? COL.red : s.h ? HLC : COL.cyan, blink = open ? 0.65 + 0.35 * Math.sin(t * 7) : 1;
    stroke(ctx, (c) => { c.moveTo(xa, y); c.lineTo(hx1 + 1, y); c.moveTo(xb, y); c.lineTo(G.gx - 30, y); }, col, open ? 1.6 : 1.4, (open ? 0.85 : 0.7) * blink, open ? [5, 4] : [7, 5], open ? 0 : -t * 26);
    const ang = Math.PI + (open ? 0.75 * easeOutBack(sat(age / 0.25)) : 0);
    stroke(ctx, (c) => rr(c, xa - 5, y - 11, xb - xa + 10, 17, 3), s.h ? HLC : COL.steel, 1, 0.8);
    glow(ctx, L, (c) => { c.moveTo(xb, y); c.lineTo(xb + Math.cos(ang) * 13, y + Math.sin(ang) * 13); }, col, 2, s.h ? s.g : 0.8, 1);
    L.fillCircle(ctx, xa, y, 2.2, col); L.fillCircle(ctx, xb, y, 2.2, col);
    if (open && age < 0.6) { L.glowDot(ctx, (xa + xb) / 2, y - 3, 10 + 16 * (1 - age / 0.6), COL.red, 1 - age / 0.6); L.glowDot(ctx, (xa + xb) / 2, y - 3, 5, "#ffffff", 0.8 * (1 - age / 0.6)); }
    M.switchPt = [(xa + xb) / 2, y - 11];
  }

  // ---------- Antrieb: Treibscheibe, Motor-/Bremsblock, Ablenkrolle ----------
  function drawMachine(ctx, L, G, o, sty, M, t) {
    if (!vis(G.MR0, G.MRtop - 10, G.MR1, G.by + 45)) return;
    const sb = sty("brake", COL.steel), ss = sty("sheave", COL.cyan), sd = sty("deflector", COL.cyan);
    const sx = G.sx, sy = G.sy, Rs = G.R - G.bundle / 2 - 3, Rf = G.R + G.bundle / 2 + 3;
    const hx0 = sx - 50, hx1 = sx + 72, hy0 = sy - 66, hy1 = G.slabTop - 14;
    const hc = sb.h ? HLC : COL.steel;
    const bx = G.bx, by = G.by, rDisc = Math.max(8, G.rd - G.bundle / 2 - 3), rFl = G.rd + G.bundle / 2 + 3;
    const dc = sd.h ? HLC : COL.cyan, da = sd.h ? 1 : ss.a;
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
    if (sb.h) {
      fill(ctx, (c) => rr(c, hx0, hy0, hx1 - hx0, hy1 - hy0, 12), hc, 0.1 + 0.05 * sb.pulse);
      glow(ctx, L, (c) => rr(c, hx0, hy0, hx1 - hx0, hy1 - hy0, 12), hc, 1.5 * sb.w, 0.35 * sb.g, 0.95);
      stroke(ctx, (c) => { for (let y = hy0 + 12; y < hy1 - 8; y += 7) { c.moveTo(hx1, y); c.lineTo(hx1 + 7, y); } }, hc, 1.3, 0.5);
      stroke(ctx, (c) => c.arc(sx, sy, Rs + 4, 0, TAU), hc, 1, 0.35, [3, 4]);
    }
    // Bremszangen (unten, frei von Seilen); versagende Bremse: offen + rot blinkend
    const fail = !!M.brakeFail, gap = fail ? 6 : 3.5 * (1 - M.brake), bc = fail ? COL.red : sb.h ? HLC : M.brake > 0.5 ? COL.steel : COL.cyan;
    const fa = fail ? 0.6 + 0.4 * Math.sin(t * 8) : 1;
    for (const ang of [1.2, 1.94]) {
      const ca = Math.cos(ang), sa = Math.sin(ang), r0 = Rs + 5 + gap;
      const cal = (c) => { c.arc(sx, sy, r0, ang - 0.2, ang + 0.2); c.lineTo(sx + Math.cos(ang + 0.2) * (r0 + 8), sy + Math.sin(ang + 0.2) * (r0 + 8)); c.lineTo(sx + Math.cos(ang - 0.2) * (r0 + 8), sy + Math.sin(ang - 0.2) * (r0 + 8)); c.closePath(); };
      if (sb.h || fail) glow(ctx, L, cal, bc, 1.6 * sb.w, (fail ? 1.2 : 0.6) * sb.g, fa); else stroke(ctx, cal, bc, 1.6, 0.95 * Math.max(sb.a, 0.6));
      stroke(ctx, (c) => { c.moveTo(sx + ca * (r0 + 8), sy + sa * (r0 + 8)); c.lineTo(sx + ca * (r0 + 14), sy + sa * (r0 + 14)); }, bc, 3, 0.8 * Math.max(sb.a, fail ? 1 : 0));
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

  // ---------- Tragseile (inkl. Riss, Ausblenden, Beschädigung, Sequenz) ----------
  function burst(ctx, x, y, a, seed, n, color, g = 420) {
    if (a < 0 || a > 0.6) return;
    const segs = [];
    for (let i = 0; i < n; i++) {
      const ang = h01(seed + i * 1.7) * TAU, sp = 110 + 260 * h01(seed * 3 + i), vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp + g * a;
      const px = x + Math.cos(ang) * sp * a, py = y + Math.sin(ang) * sp * a + 0.5 * g * a * a, k = 0.022;
      segs.push([px, py, px - vx * k, py - vy * k, i % 3 ? color : "#ffffff", 1 - a / 0.6]);
    }
    batchSegs(ctx, segs, 2);
  }
  /** Riss-/Schadstelle (Welt-y) eines Seils. */
  const snapYOf = (G, hitch, i, multi) => hitch - clamp(0.42 * (hitch - G.sy), 26, 120) + (multi ? (h01(i * 7.3) - 0.5) * 18 : 0);

  function drawRopes(ctx, L, G, o, sty, M, T, t) {
    const s0 = sty("ropes", COL.cyan), seq = T.seq;
    const s = seq ? { ...s0, h: false, c: COL.cyan, g: 1, w: 1 } : s0;
    const tailOf = (rp) => (c) => { c.arc(G.sx, G.sy, rp.Ra, 0, rp.be, true); c.lineTo(rp.px, rp.py); c.arc(G.bx, G.by, rp.Rb, rp.be, Math.PI, true); c.lineTo(rp.cwX, M.cwTop - 5); };
    const isBroken = (rp) => M.snaps[rp.i] != null && t >= M.snaps[rp.i];
    const intact = G.ropes.filter((rp) => !isBroken(rp));
    const flow = M.dir !== 0 && !o.allBroken ? ((G.yBot - M.carY) % 8) : 0;
    if (intact.length) {
      const all = (c) => { for (const rp of intact) { c.moveTo(rp.carX, M.hitchY); c.lineTo(rp.carX, G.sy); tailOf(rp)(c); } };
      const ce = G.center, cp = (c) => { c.moveTo(G.carCX, M.hitchY); c.lineTo(G.carCX, G.sy); tailOf(ce)(c); };
      const band = seq || o.focus === "ropes" ? 0.55 : 1;
      if (intact.length === G.ropes.length) stroke(ctx, cp, s.c, G.bundle + 2 + 7 / ZS, (s.h ? 0.16 + 0.12 * s.pulse : 0.12) * s.a * band);
      else stroke(ctx, all, s.c, 2 + 7 / ZS, (s.h ? 0.2 + 0.14 * s.pulse : 0.14) * s.a);
      stroke(ctx, all, s.c, s.h ? 2 : 1.7, s.a);
      stroke(ctx, (c) => { for (const rp of intact) { c.moveTo(rp.carX, M.hitchY); c.lineTo(rp.carX, G.sy); } }, "#ffffff", 1, 0.4 * s.a, [3, 5], flow);
      stroke(ctx, (c) => { for (const rp of intact) { c.moveTo(rp.cwX, M.cwTop - 5); c.lineTo(rp.cwX, G.by); } }, "#ffffff", 1, 0.4 * s.a, [3, 5], -flow);
    }
    // Seil-Sequenz: Seile leuchten einzeln nacheinander auf (unabhängig, parallel)
    if (seq) {
      let lit = 0;
      for (const rp of G.ropes) {
        if (isBroken(rp)) continue;
        const ti = seq.at + rp.i * seq.step, a = t - ti; if (a < 0) continue; lit++;
        const k = smooth(a / 0.25), run = (c) => { c.moveTo(rp.carX, M.hitchY); c.lineTo(rp.carX, G.sy); tailOf(rp)(c); };
        stroke(ctx, run, HLC, 2 + 5 / ZS, 0.22 * k);
        stroke(ctx, run, HLC, 2.1, k * (0.85 + 0.15 * Math.sin(t * 5 + rp.i)));
        const ph = (a * 0.7) % 1, yP = lerp(M.hitchY, G.sy, ph), pa = a < 1.4 ? 1 : 0.45;
        stroke(ctx, (c) => { c.moveTo(rp.carX, Math.min(M.hitchY, yP + 16)); c.lineTo(rp.carX, Math.max(G.sy, yP - 16)); }, "#ffffff", 2.2, 0.9 * k * pa);
        if (a < 0.6) { const f = 1 - a / 0.6; softDot(ctx, rp.carX, M.hitchY - 4, 10 + 14 * f, HLC, 1.6 * f); }
      }
      if (lit >= G.ropes.length && lit > 0) { const k2 = smooth((t - (seq.at + G.ropes.length * seq.step)) / 0.6); stroke(ctx, (c) => { c.moveTo(G.carCX, M.hitchY); c.lineTo(G.carCX, G.sy); }, HLC, G.bundle + 2 + 8 / ZS, 0.12 * k2 * (0.6 + 0.4 * s0.pulse)); }
    }
    // Beschädigte Seile: rote, flackernde Schadstelle mit abstehenden Drähten (ohne Riss)
    if (o.damaged.length && t >= T.dmgAt) {
      const a = t - T.dmgAt, fin = smooth(a / 0.3), dy = M.dmgY;
      for (const idx of o.damaged) {
        const rp = G.ropes[idx]; if (!rp || isBroken(rp)) continue;
        const fl = 0.55 + 0.45 * Math.sin(t * 19 + idx * 2.3);
        stroke(ctx, (c) => { c.moveTo(rp.carX, dy - 24); c.lineTo(rp.carX, dy + 24); }, COL.red, 2.6, fin * fl);
        stroke(ctx, (c) => { for (let k = 0; k < 5; k++) { const yk = dy - 14 + k * 7, sd = (k + idx) % 2 ? 1 : -1; c.moveTo(rp.carX, yk); c.lineTo(rp.carX + sd * (4 + 4 * h01(idx * 5 + k)), yk - 3 - 3 * h01(k * 3 + idx)); } }, COL.red, 1.1, fin);
        softDot(ctx, rp.carX, dy, 14, COL.red, fin * (0.8 + 0.6 * fl));
      }
    }
    for (const rp of G.ropes) {
      const tb = M.snaps[rp.i]; if (!isBroken(rp)) continue;
      const tail = tailOf(rp), a = t - tb;
      if (o.brokenStyle === "fade") { // hypothetisch entfernt: blasst zur gestrichelten Geisterlinie aus
        const f = smooth(a / 0.7), run = (c) => { c.moveTo(rp.carX, M.hitchY); c.lineTo(rp.carX, G.sy); tail(c); };
        stroke(ctx, run, COL.cyan, 1.7, (1 - 0.85 * f) * s.a, f > 0.35 ? [3, 6] : null);
        continue;
      }
      const side = rp.off > 0.01 ? 1 : rp.off < -0.01 ? -1 : 1;
      const hitchTb = M.hitchAt(Math.max(0, tb));
      const snapY = M.debrisHit != null ? M.debrisHit + (h01(rp.i * 7.3) - 0.5) * 10 : snapYOf(G, hitchTb, rp.i, o.broken.length > 1);
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

  // ---------- Trümmer: Triebwerk stürzt in den Schacht ----------
  function debrisPath(G, M, T, tt) {
    const tI = T.debrisT, tE = tI - 0.85, xI = G.carCX + 6, yI = M.dmgY, r = 24;
    const xE = G.S1 - 10, yE = Math.max(G.slabBot + 40, yI - 1.4 * G.fh);
    const xL = G.carCX + 38, yL = M.hitchY + 10 - r;
    if (tt < tE) return null;
    if (tt < tI) { const q = (tt - tE) / 0.85; return { x: lerp(xE, xI + r * 0.7, q), y: yE + (yI - yE) * (0.3 * q + 0.7 * q * q), rot: (tt - tE) * 5, fly: true, r }; }
    if (tt < tI + 0.45) { const q = (tt - tI) / 0.45; return { x: lerp(xI + r * 0.7, xL, easeOut(q)), y: yI + (yL - yI) * q * q - 22 * Math.sin(q * Math.PI) * (1 - q), rot: 0.85 * 5 + q * 2.2, fly: true, r }; }
    const a = tt - tI - 0.45; return { x: xL, y: yL - 5 * Math.exp(-a * 6) * Math.abs(Math.sin(a * 16)), rot: 0.85 * 5 + 2.2, fly: false, r };
  }
  function drawDebris(ctx, L, G, o, M, T, t) {
    if (!o.debris || T.debrisT == null) return;
    const P = debrisPath(G, M, T, t); if (!P) return;
    const tI = T.debrisT, tE = tI - 0.85, xE = G.S1 - 10, yE = Math.max(G.slabBot + 40, M.dmgY - 1.4 * G.fh);
    // Wanddurchbruch
    const ba = smooth((t - tE) / 0.15);
    fill(ctx, (c) => c.rect(G.S1 - 1, yE - 30, 11, 60), "#07101f", ba);
    stroke(ctx, (c) => { c.moveTo(G.S1 + 10, yE - 30); c.lineTo(G.S1 + 2, yE - 18); c.lineTo(G.S1 + 8, yE - 6); c.lineTo(G.S1 - 1, yE + 8); c.lineTo(G.S1 + 7, yE + 20); c.lineTo(G.S1 + 10, yE + 30); }, COL.red, 1.4, 0.8 * ba);
    if (t - tE < 0.6) burst(ctx, xE + 6, yE, t - tE, 71, 14, COL.amber, 700);
    // Bewegungsspuren
    if (P.fly) { const Q = debrisPath(G, M, T, t - 0.06); if (Q) stroke(ctx, (c) => { for (const dx of [-0.6, 0, 0.6]) { c.moveTo(P.x + dx * P.r, P.y - 0.3 * P.r); c.lineTo(Q.x + dx * P.r + (Q.x - P.x) * 2, Q.y - 0.3 * P.r + (Q.y - P.y) * 2); } }, COL.amber, 2, 0.35); }
    // Sternmotor (stilisiert, ohne Marke)
    const sd = sty0("debris");
    softDot(ctx, P.x, P.y, P.r * (P.fly ? 2.6 : 1.8), P.fly ? COL.hot : COL.amber, P.fly ? 1.3 : 0.7);
    engineGlyph(ctx, L, P.x, P.y, P.r, P.rot, sd ? HLC : COL.amber, 1);
    // Einschlag in das Seilbündel
    const ai = t - tI;
    if (ai >= 0 && ai < 0.7) { const f = 1 - ai / 0.7; L.glowDot(ctx, G.carCX, M.dmgY, 16 + 50 * f, COL.hot, f); L.glowDot(ctx, G.carCX, M.dmgY, 8 + 12 * f, "#ffffff", 0.9 * f); burst(ctx, G.carCX, M.dmgY, ai, 33, 18, COL.amber); }
  }
  let sty0 = () => false; // wird pro Frame gesetzt (Hervorhebung für Trümmer)
  /** Sternmotor (stilisiert, ohne Marke). */
  function engineGlyph(ctx, L, x, y, r, rot, col, al) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    fill(ctx, (c) => c.arc(0, 0, r, 0, TAU), "#0a1426", 0.9 * al);
    glow(ctx, L, (c) => { c.arc(0, 0, r, 0, TAU); c.moveTo(r * 0.36, 0); c.arc(0, 0, r * 0.36, 0, TAU); }, col, 2, 1, al);
    stroke(ctx, (c) => { for (let k = 0; k < 7; k++) { const a = (k * TAU) / 7, ca = Math.cos(a), sa = Math.sin(a); const x1 = ca * r * 0.4, y1 = sa * r * 0.4, x2 = ca * r * 0.88, y2 = sa * r * 0.88; c.moveTo(x1, y1); c.lineTo(x2, y2); for (let f = 0; f < 3; f++) { const q = 0.55 + f * 0.12, px = ca * r * q, py = sa * r * q; c.moveTo(px - sa * 3.5, py + ca * 3.5); c.lineTo(px + sa * 3.5, py - ca * 3.5); } } }, col, 1.3, 0.85 * al);
    stroke(ctx, (c) => { for (let k = 0; k < 3; k++) { const a = 0.4 + (k * TAU) / 3; c.moveTo(Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36); c.lineTo(Math.cos(a) * r * 0.36 + Math.cos(a + 0.3) * r * 0.55, Math.sin(a) * r * 0.36 + Math.sin(a + 0.3) * r * 0.55); } }, COL.steel, 2.4, 0.8 * al);
    ctx.restore();
  }
  /** Zweites Triebwerk (debris.pass_at): tritt rechts in die Fassade ein, quert das Gebäude hinter dem Schacht, tritt links wieder aus. */
  function passPath(G, T, tt) {
    const t0 = T.passAt, D = T.passDur, y0 = T.passY, xR = G.BX1 + 8, xL = G.BX0 - 8, r = 21, dr = 0.22 * G.fh;
    if (tt < t0 - 0.45) return null;
    if (tt < t0) { const q = (tt - t0 + 0.45) / 0.45; return { x: lerp(xR + 520, xR + r * 0.4, q), y: y0 - 24 * (1 - q), rot: tt * 7, r, a: smooth(q * 3) }; }
    if (tt < t0 + D) { const q = (tt - t0) / D; return { x: lerp(xR + r * 0.4, xL - r * 0.4, q * (1.2 - 0.2 * q)), y: y0 + dr * q * q, rot: tt * 7, r, a: 1 }; }
    const q = (tt - t0 - D) / 0.45; if (q > 1) return null;
    return { x: xL - r * 0.4 - 330 * q, y: y0 + dr + 0.5 * G.fh * q * q, rot: tt * 7, r, a: 1 - smooth(q) };
  }
  function drawPassThrough(ctx, L, G, o, T, t) {
    if (T.passAt == null) return;
    const t0 = T.passAt, D = T.passDur, y0 = T.passY;
    // Durchbrüche in beiden Fassaden (bleiben sichtbar)
    const hole = (xw, yc, age, sgn, seed) => {
      if (age < 0) return;
      const ba = smooth(age / 0.15);
      fill(ctx, (c) => c.rect(xw - 5, yc - 28, 18, 56), "#07101f", ba);
      stroke(ctx, (c) => { c.moveTo(xw + 4 * sgn, yc - 32); c.lineTo(xw - 3 * sgn, yc - 20); c.lineTo(xw + 5 * sgn, yc - 7); c.lineTo(xw - 4 * sgn, yc + 6); c.lineTo(xw + 4 * sgn, yc + 19); c.lineTo(xw - 2 * sgn, yc + 32); }, COL.red, 1.5, 0.85 * ba);
      stroke(ctx, (c) => { c.moveTo(xw, yc - 12); c.lineTo(xw + 16 * sgn, yc - 22); c.moveTo(xw, yc + 10); c.lineTo(xw + 14 * sgn, yc + 20); c.moveTo(xw, yc - 26); c.lineTo(xw - 10 * sgn, yc - 38); }, COL.red, 1, 0.55 * ba);
      if (age < 0.6) { L.glowDot(ctx, xw, yc, 20 + 40 * (1 - age / 0.6), COL.hot, 1 - age / 0.6); burst(ctx, xw, yc, age, seed, 16, COL.amber, 600); }
    };
    hole(G.BX1 + 4, y0, t - t0, 1, 83);
    hole(G.BX0 - 4, y0 + 0.22 * G.fh, t - t0 - D, -1, 47);
    const P = passPath(G, T, t); if (!P) return;
    const inShaft = P.x > G.S0 - 12 && P.x < G.S1 + 12, al = P.a * (inShaft ? 0.42 : 1);
    const Q = passPath(G, T, t - 0.07);
    if (Q) stroke(ctx, (c) => { for (const dy of [-0.55, 0, 0.55]) { c.moveTo(P.x + P.r * 0.8, P.y + dy * P.r); c.lineTo(Q.x + (Q.x - P.x) * 2.2 + P.r * 0.8, Q.y + dy * P.r + (Q.y - P.y) * 2); } }, COL.amber, 2, 0.35 * al);
    softDot(ctx, P.x, P.y, P.r * 2.4, COL.hot, (inShaft ? 0.5 : 1.1) * P.a);
    engineGlyph(ctx, L, P.x, P.y, P.r, P.rot, COL.amber, al);
    if (inShaft) stroke(ctx, (c) => c.arc(P.x, P.y, P.r + 5, 0, TAU), COL.amber, 1.2, 0.5 * P.a, [4, 5], -t * 30);
  }

  // ---------- Gegengewicht ----------
  function drawCounterweight(ctx, L, G, sty, M, t) {
    const s = sty("counterweight", COL.steel), x = G.cwX0, y = M.cwTop, w = G.cwW, h = G.CWH;
    fill(ctx, (c) => c.rect(x, y, w, h), s.c, (s.h ? 0.16 : 0.08) * s.a);
    stroke(ctx, (c) => { for (let yy = y + 8; yy < y + h - 4; yy += 7) { c.moveTo(x + 5, yy); c.lineTo(x + w - 5, yy); } }, s.c, 1.2, 0.45 * s.a);
    const cwp = (c) => { c.rect(x, y, w, h); c.moveTo(G.cwCX - 15, y - 5); c.lineTo(G.cwCX + 15, y - 5); c.moveTo(G.cwCX, y - 5); c.lineTo(G.cwCX, y); };
    if (s.h) glow(ctx, L, cwp, s.c, 2.2 * s.w, 0.8 * s.g, s.a); else { stroke(ctx, cwp, s.c, 2.2 + 4 / ZS, 0.1 * s.a); stroke(ctx, cwp, s.c, 2.2, s.a); }
    stroke(ctx, (c) => { for (const yy of [y + 4, y + h - 4]) { c.moveTo(x, yy); c.lineTo(G.cwRailL + 3, yy); c.moveTo(x + w, yy); c.lineTo(G.cwRailR - 3, yy); } }, COL.steel, 2.5, 0.7 * s.a);
    // Absturz nach oben: Gegengewicht zieht nach unten – Pfeil in Fahrtrichtung
    if (M.runaway && M.v > 0.05) {
      const a = Math.min(1, M.v / 0.8) * (0.75 + 0.25 * Math.sin(t * 6)), y0 = M.cwBot + 10, len = Math.min(0.85 * G.fh, G.PB - 40 - y0);
      if (len > 18) { fill(ctx, (c) => arrowShape(c, G.cwCX, y0, y0 + len, 10, 30, 18), COL.amber, 0.3 * a); glow(ctx, L, (c) => arrowShape(c, G.cwCX, y0, y0 + len, 10, 30, 18), COL.amber, 2, 1.2, a); }
    }
  }

  // ---------- Fahrgäste (Silhouetten, ohne Gesicht) ----------
  function figure(ctx, x, yF, h, pose, fl, tt, i, col, alpha, lift) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (pose === "seated") { // Profil, auf einem Hocker
      const sY = yF - h * 0.3, hx = x - h * 0.04, hy = sY - h * 0.035;
      ctx.lineWidth = Math.max(0.8, h * 0.03); ctx.globalAlpha = alpha * 0.75;
      ctx.beginPath(); ctx.moveTo(hx - h * 0.11, sY); ctx.lineTo(hx + h * 0.1, sY); ctx.moveTo(hx - h * 0.08, sY); ctx.lineTo(hx - h * 0.11, yF); ctx.moveTo(hx + h * 0.07, sY); ctx.lineTo(hx + h * 0.1, yF); ctx.stroke();
      ctx.globalAlpha = alpha; ctx.lineWidth = h * 0.085;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + h * 0.2, hy + h * 0.005); ctx.lineTo(hx + h * 0.215, yF - h * 0.035); ctx.stroke();
      ctx.beginPath(); rr(ctx, hx - h * 0.09, hy - h * 0.37, h * 0.18, h * 0.39, h * 0.06); ctx.fill();
      ctx.beginPath(); ctx.arc(hx + h * 0.015, hy - h * 0.47, h * 0.085, 0, TAU); ctx.fill();
      ctx.lineWidth = h * 0.06; ctx.beginPath(); ctx.moveTo(hx + h * 0.03, hy - h * 0.31); ctx.lineTo(hx + h * 0.1, hy - h * 0.15); ctx.lineTo(hx + h * 0.19, hy - h * 0.07); ctx.stroke();
    } else { // Frontansicht; fl = 0 stehend … 1 schwebend (Arme gehoben, Knie leicht gebeugt)
      const by = yF - lift;
      if (fl > 0.01) { const piv = by - h * 0.5, r = fl * 0.08 * Math.sin(tt * 1.3 + i * 2); ctx.translate(x, piv); ctx.rotate(r); ctx.translate(-x, -piv); }
      ctx.beginPath(); ctx.arc(x, by - h * 0.9, h * 0.085, 0, TAU); ctx.fill();
      ctx.beginPath(); rr(ctx, x - h * 0.11, by - h * 0.8, h * 0.22, h * 0.36, h * 0.07); ctx.fill();
      ctx.lineWidth = h * 0.06; ctx.beginPath();
      for (const sd of [-1, 1]) {
        const w1 = fl * (0.8 + 0.2 * Math.sin(tt * 2 + i + sd));
        ctx.moveTo(x + sd * h * 0.1, by - h * 0.75);
        ctx.lineTo(x + sd * lerp(0.14, 0.24, w1) * h, by - lerp(0.6, 0.86, w1) * h);
        ctx.lineTo(x + sd * lerp(0.15, 0.28, w1) * h, by - lerp(0.46, 1.0, w1) * h);
      }
      ctx.stroke();
      ctx.lineWidth = h * 0.085; ctx.beginPath();
      for (const sd of [-1, 1]) {
        ctx.moveTo(x + sd * h * 0.05, by - h * 0.46);
        ctx.lineTo(x + sd * lerp(0.055, 0.13, fl) * h, by - lerp(0.24, 0.27, fl) * h);
        ctx.lineTo(x + sd * lerp(0.055, 0.075, fl) * h, by - lerp(0.02, 0.06, fl) * h);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- Prüfplakette (stilisiert, ohne Logo) ----------
  function drawPlate(ctx, L, G, o, sty, M, t) {
    if (!o.plateOn) return;
    const s = sty("inspection_plate", COL.cyan), x = G.plateX, y = M.carY - G.plateDY, r = G.plateR;
    if (!vis(x - r - 8, y - r - 8, x + r + 8, y + r + 8)) return;
    const col = s.h ? HLC : COL.cyan;
    fill(ctx, (c) => rr(c, x - r - 4, y - r - 4, 2 * r + 8, 2 * r + 8, 2.5), "#07142a", 0.95);
    stroke(ctx, (c) => rr(c, x - r - 4, y - r - 4, 2 * r + 8, 2 * r + 8, 2.5), COL.steel, 0.8, 0.7);
    glow(ctx, L, (c) => c.arc(x, y, r, 0, TAU), col, 1.3 * s.w, s.h ? s.g : 0.6, 1);
    // Monatsring: Trennstriche zwischen den Monatsfeldern; nächster Prüfmonat oben = amber Feld + Kerbe (unabhängig von der Hervorhebung)
    stroke(ctx, (c) => { for (let k = 0; k < 12; k++) { const a = -Math.PI / 2 + TAU / 24 + (k * TAU) / 12; if (k === 0 || k === 11) continue; c.moveTo(x + Math.cos(a) * r * 0.64, y + Math.sin(a) * r * 0.64); c.lineTo(x + Math.cos(a) * r * 0.88, y + Math.sin(a) * r * 0.88); } }, col, 0.8, 0.85);
    const a0 = -Math.PI / 2 - TAU / 24 - 0.05, a1 = -Math.PI / 2 + TAU / 24 + 0.05;
    fill(ctx, (c) => { c.arc(x, y, r * 0.97, a0, a1); c.arc(x, y, r * 0.55, a1, a0, true); c.closePath(); }, COL.amber, 0.8 + 0.2 * Math.sin(t * 3));
    fill(ctx, (c) => { c.moveTo(x, y - r - 0.5); c.lineTo(x - r * 0.3, y - r - 4); c.lineTo(x + r * 0.3, y - r - 4); c.closePath(); }, COL.amber, 0.95);
    stroke(ctx, (c) => c.arc(x, y, r * 0.52, 0, TAU), col, 0.6, 0.6);
    if (o.plateText) { ctx.save(); ctx.globalAlpha = 0.95; ctx.fillStyle = COL.white; ctx.font = `700 ${(r * 0.42).toFixed(2)}px "JetBrains Mono"`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(o.plateText).slice(0, 4), x, y + 0.3); ctx.restore(); }
    else stroke(ctx, (c) => { c.moveTo(x - r * 0.28, y - r * 0.1); c.lineTo(x + r * 0.28, y - r * 0.1); c.moveTo(x - r * 0.18, y + r * 0.16); c.lineTo(x + r * 0.18, y + r * 0.16); }, COL.white, 0.9, 0.8);
  }

  /** Lupe (focus "plate"): vergrößerte Prüfplakette in Bildschirmkoordinaten, mit Verbindungslinien zur Plakette in der Kabine. */
  function drawLoupe(ctx, L, G, o, sty, M, T, t, toS) {
    const Lp = M.loupe; if (!Lp) return;
    const q = (t - T.loupeAt) / 0.7, a = smooth(q * 1.4); if (a <= 0.01) return;
    const e = easeOut(q), [px, py] = toS(G.plateX, M.carY - G.plateDY), pr = (G.plateR + 8) * Lp.ws;
    const cx = lerp(px, Lp.cx, e), cy = lerp(py, Lp.cy, e), R = lerp(pr, Lp.R, e), k = R / Lp.R;
    const s = sty("inspection_plate", COL.cyan), col = s.h ? HLC : COL.cyan;
    // Ring um die kleine Plakette + Tangenten zur Lupe
    stroke(ctx, (c) => c.arc(px, py, pr, 0, TAU), col, 1.8, 0.9 * a);
    const dx = cx - px, dy = cy - py, D = Math.hypot(dx, dy);
    if (D > R - pr + 4) {
      const th = Math.atan2(dy, dx), al = Math.acos(clamp((pr - R) / D, -1, 1));
      const tl = (c) => { for (const sg of [1, -1]) { const w = th + sg * al; c.moveTo(px + pr * Math.cos(w), py + pr * Math.sin(w)); c.lineTo(cx + R * Math.cos(w), cy + R * Math.sin(w)); } };
      fill(ctx, (c) => { const w1 = th + al, w2 = th - al; c.moveTo(px + pr * Math.cos(w1), py + pr * Math.sin(w1)); c.lineTo(cx + R * Math.cos(w1), cy + R * Math.sin(w1)); c.lineTo(cx + R * Math.cos(w2), cy + R * Math.sin(w2)); c.lineTo(px + pr * Math.cos(w2), py + pr * Math.sin(w2)); c.closePath(); }, col, 0.035 * a);
      stroke(ctx, tl, col, 1.4, 0.6 * a, [7, 6], -t * 18);
    }
    // Glas
    fill(ctx, (c) => c.arc(cx, cy, R, 0, TAU), "#050d1d", 0.95 * a);
    fill(ctx, (c) => c.arc(cx, cy, R, 0, TAU), col, 0.04 * a);
    glow(ctx, L, (c) => c.arc(cx, cy, R, 0, TAU), col, 3, 1.4, a);
    stroke(ctx, (c) => c.arc(cx, cy, R + 9 * k, 0, TAU), COL.steel, 1.2, 0.45 * a);
    stroke(ctx, (c) => c.arc(cx, cy, R - 10 * k, Math.PI * 1.08, Math.PI * 1.42), "#ffffff", 3 * k, 0.12 * a);
    if (k < 0.25) return;
    // Plakette (rund, ohne Logo): Rand mit Perforation, Monatsring 1–12, nächster Prüfmonat oben (amber + Kerbe), Jahresfeld
    const r0 = 0.8 * R, rO = 0.74 * R, rI = 0.53 * R, pa = a * sat((k - 0.25) / 0.4), m0 = o.plateMonth;
    fill(ctx, (c) => c.arc(cx, cy, r0, 0, TAU), "#0b1b36", pa);
    glow(ctx, L, (c) => c.arc(cx, cy, r0, 0, TAU), col, 2.4, s.h ? s.g : 0.8, pa);
    ctx.save(); ctx.globalAlpha = 0.55 * pa; ctx.fillStyle = COL.steel; ctx.beginPath();
    for (let i = 0; i < 48; i++) { const w = (i * TAU) / 48, rx = cx + Math.cos(w) * (r0 - 7 * k), ry = cy + Math.sin(w) * (r0 - 7 * k); ctx.moveTo(rx + 1.6 * k, ry); ctx.arc(rx, ry, 1.6 * k, 0, TAU); }
    ctx.fill(); ctx.restore();
    const w0 = -Math.PI / 2 - TAU / 24, w1 = -Math.PI / 2 + TAU / 24, pulse = 0.82 + 0.18 * Math.sin(t * 3.2);
    fill(ctx, (c) => { c.arc(cx, cy, rO, w0, w1); c.arc(cx, cy, rI, w1, w0, true); c.closePath(); }, COL.amber, 0.92 * pa * pulse);
    stroke(ctx, (c) => { c.arc(cx, cy, rO, 0, TAU); c.moveTo(cx + rI, cy); c.arc(cx, cy, rI, 0, TAU); for (let i = 0; i < 12; i++) { const w = w1 + (i * TAU) / 12; c.moveTo(cx + Math.cos(w) * rI, cy + Math.sin(w) * rI); c.lineTo(cx + Math.cos(w) * rO, cy + Math.sin(w) * rO); } }, col, 1.4, 0.8 * pa);
    glow(ctx, L, (c) => { c.arc(cx, cy, rO, w0, w1); c.arc(cx, cy, rI, w1, w0, true); c.closePath(); }, COL.amber, 2, 1.2, pa);
    // Kerbe außen (zeigt auf den Prüfmonat)
    const nk = (c) => { c.moveTo(cx, cy - r0 + 3 * k); c.lineTo(cx - 13 * k, cy - r0 - 16 * k); c.lineTo(cx + 13 * k, cy - r0 - 16 * k); c.closePath(); };
    fill(ctx, nk, COL.amber, pa); glow(ctx, L, nk, COL.amber, 1.5, 1, pa);
    const fsM = Math.round(0.1 * R);
    if (fsM >= 7) for (let i = 0; i < 12; i++) {
      const w = -Math.PI / 2 + (i * TAU) / 12, rm = (rI + rO) / 2, mm = ((m0 - 1 + i) % 12) + 1;
      L.text(ctx, String(mm), cx + Math.cos(w) * rm, cy + Math.sin(w) * rm + fsM * 0.36, { size: fsM, weight: 700, font: L.FONT.mono, color: i === 0 ? "#07142a" : COL.white, align: "center", alpha: (i === 0 ? 1 : 0.82) * pa });
    }
    // Mitte: Beschriftung + Jahresfeld (Text nur über plate_text, sonst Platzhalterbalken)
    const fsC = Math.round(0.062 * R);
    if (fsC >= 6) L.text(ctx, "NÄCHSTE PRÜFUNG", cx, cy - 0.2 * R, { size: fsC, weight: 700, font: L.FONT.mono, letterSpacing: Math.max(1, 1.5 * k), color: COL.muted, align: "center", alpha: pa });
    const yw = 0.5 * R, yh = 0.2 * R, yx = cx - yw / 2, yy = cy - 0.07 * R;
    stroke(ctx, (c) => rr(c, yx, yy, yw, yh, 6 * k), COL.white, 1.6, 0.75 * pa);
    if (o.plateText) L.text(ctx, String(o.plateText).slice(0, 6), cx, yy + yh * 0.74, { size: Math.round(yh * 0.72), weight: 700, font: L.FONT.mono, color: COL.white, align: "center", alpha: pa });
    else stroke(ctx, (c) => { c.moveTo(cx - yw * 0.3, yy + yh * 0.38); c.lineTo(cx + yw * 0.3, yy + yh * 0.38); c.moveTo(cx - yw * 0.2, yy + yh * 0.66); c.lineTo(cx + yw * 0.2, yy + yh * 0.66); }, COL.white, 3 * k, 0.8 * pa);
    if (fsC >= 6) L.text(ctx, "JAHR", cx, yy + yh + 0.1 * R, { size: Math.round(fsC * 0.9), weight: 600, font: L.FONT.mono, letterSpacing: Math.max(1, 1.5 * k), color: COL.muted, align: "center", alpha: 0.8 * pa });
  }

  // ---------- Kabine mit Rahmen, Führungsschuhen, Fangvorrichtung ----------
  function drawCar(ctx, L, G, o, sty, M, T, t) {
    const s = sty("car", COL.cyan), sg = sty("safety_gear", COL.steel);
    const x0 = G.carX0, x1 = G.carX1, y = M.carY, top = y - G.CH, hy = M.hitchY;
    const av = Math.abs(M.v);
    // Bewegungsunschärfe: Geisterbilder entlang der Bahn (auch eingefroren)
    if (M.trail) {
      const tRef = M.frozen ? T.F.tEnd : t;
      for (let k = 1; k <= 3; k++) {
        const yk = M.yAt(tRef - k * 0.045); if (Math.abs(yk - y) < 3) break;
        stroke(ctx, (c) => { c.rect(x0, yk - G.CH, G.carW, G.CH); c.rect(x0 - 10, yk + 2, G.carW + 20, 8); }, M.danger ? COL.red : s.c, 1.6, (0.3 - 0.08 * k) * s.a);
      }
    }
    // Fahrtstreifen bei schneller Bewegung
    if (M.dir < 0 && av > 0.25) stroke(ctx, (c) => { for (let i = 0; i < 6; i++) { const xx = x0 + 10 + i * ((G.carW - 20) / 5), ph = (t * 260 + i * 41) % 70, len = 24 + 30 * Math.min(1, av / 2); c.moveTo(xx, hy - 14 - ph); c.lineTo(xx, hy - 14 - ph - len); } }, s.c, 1.5, 0.25 * Math.min(1, av / 1.5) * s.a);
    if (M.dir > 0 && av > 0.25) stroke(ctx, (c) => { for (let i = 0; i < 6; i++) { const xx = x0 + 10 + i * ((G.carW - 20) / 5), ph = (t * 260 + i * 41) % 70, len = 24 + 30 * Math.min(1, av / 2); c.moveTo(xx, y + 24 + ph); c.lineTo(xx, y + 24 + ph + len); } }, s.c, 1.5, 0.25 * Math.min(1, av / 1.5) * s.a);
    fill(ctx, (c) => c.rect(x0, top, G.carW, G.CH), s.h ? rgba(HLC, 0.12) : "rgba(63,210,255,0.07)", 1);
    // Innenraum: Deckenlicht, Personen, Kabinentür (vorn), Prüfplakette
    stroke(ctx, (c) => { c.moveTo(x0 + 18, top + 6); c.lineTo(x1 - 18, top + 6); }, COL.white, 2, (0.45 + 0.2 * Math.sin(t * 2.4)) * s.a);
    drawPlate(ctx, L, G, o, sty, M, t);
    for (let i = 0; i < o.people; i++) {
      const px = o.people === 1 ? (o.pose === "seated" ? x0 + G.carW * 0.36 : (x0 + x1) / 2) : x0 + 28 + ((G.carW - 56) * i) / (o.people - 1);
      const fk = o.pose === "floating" ? M.floatK : 0, lift = fk * (G.CH * 0.15 + 2.2 * Math.sin(M.bobT * 2.2 + i * 1.7));
      const h = G.CH * (fk > 0.01 ? lerp(0.8, 0.7, fk) : 0.8);
      if (fk > 0.05) { stroke(ctx, (c) => c.ellipse(px, y - 2, h * 0.16, 1.6, 0, 0, TAU), COL.cyan, 1, 0.35 * fk * s.a); softDot(ctx, px, y - h * 0.5 - lift, h * 0.55, COL.cyan, 0.5 * fk); }
      figure(ctx, px, y - 1, h, o.pose === "seated" ? "seated" : "front", fk, M.bobT, i, COL.steel, lerp(0.62, 0.9, fk) * Math.max(0.75, s.a), lift);
    }
    stroke(ctx, (c) => { c.moveTo((x0 + x1) / 2, top + 10); c.lineTo((x0 + x1) / 2, y - 3); }, s.c, 1.2, 0.35 * s.a, [6, 5]);
    glow(ctx, L, (c) => c.rect(x0, top, G.carW, G.CH), s.c, 2.6 * s.w, 1 * s.g, s.a);
    // Tragrahmen: Querhaupt, Seitenständer, Unterholm, Seilaufhängung
    const fr = (c) => { c.rect(x0 - 10, hy + 10, G.carW + 20, 8); c.moveTo(x0 - 7, hy + 18); c.lineTo(x0 - 7, y + 2); c.moveTo(x1 + 7, hy + 18); c.lineTo(x1 + 7, y + 2); c.rect(x0 - 10, y + 2, G.carW + 20, 8); };
    stroke(ctx, fr, COL.steel, 1.6, 0.8 * s.a);
    stroke(ctx, (c) => { c.rect(G.carCX - G.bundle / 2 - 6, hy + 5, G.bundle + 12, 5); for (const rp of G.ropes) { c.moveTo(rp.carX, hy - 1); c.lineTo(rp.carX, hy + 5); } }, COL.steel, 1.4, 0.85 * s.a);
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
    // Absturz nach oben: großer Pfeil in der Kabine
    if (M.runaway && M.v > 0.05) {
      const a = Math.min(1, M.v / 0.8) * (0.75 + 0.25 * Math.sin(t * 6)), yT0 = y - 8, yH = top + 8;
      fill(ctx, (c) => arrowShape(c, G.carCX, yT0, yH, 22, 58, 26), COL.amber, 0.28 * a);
      glow(ctx, L, (c) => arrowShape(c, G.carCX, yT0, yH, 22, 58, 26), COL.amber, 2.2, 1.3, a);
    }
    // Rahmen in Signalfarbe (z. B. grün = sicher gehalten)
    if (o.frameCol) {
      const fa = smooth((t - T.frameAt) / 0.5); if (fa > 0.01) {
        const pad = 8 * (1 - easeOut((t - T.frameAt) / 0.5)), fx0 = G.railL - 20 - pad, fx1 = G.railR + 20 + pad, fy0 = hy - 10 - pad, fy1 = y + 28 + pad;
        const bld = (c) => rr(c, fx0, fy0, fx1 - fx0, fy1 - fy0, 10);
        fill(ctx, bld, o.frameCol, 0.05 * fa);
        glow(ctx, L, bld, o.frameCol, 2.4, 1.2 + 0.5 * Math.sin(t * 3), fa);
      }
    }
  }

  /** Pulsierende Ortungsringe um hervorgehobene (kleine) Bauteile. */
  function drawHalos(ctx, G, o, M, T, t, s) {
    if (!o.hl.size) return;
    const hk = T.hlAt == null ? 1 : smooth((t - T.hlAt) / 0.5); if (hk <= 0.02) return;
    const spots = [];
    if (o.hl.has("governor")) spots.push([G.gx, G.gy, 30]);
    if (o.hl.has("safety_gear")) spots.push([G.railL, M.carY + 8, 20], [G.railR, M.carY + 8, 20]);
    if (o.hl.has("lever") && M.leverMid) spots.push([M.leverMid[0], M.leverMid[1], 18]);
    if (o.hl.has("brake")) spots.push([G.sx, G.sy + 50, 24]);
    if (o.hl.has("sheave")) spots.push([G.sx, G.sy, G.R + 16]);
    if (o.hl.has("deflector")) spots.push([G.bx, G.by, 32]);
    if (o.hl.has("tension_pulley")) spots.push([G.gx, G.tpY, 28]);
    if (o.hl.has("switch") && M.switchPt) spots.push([M.switchPt[0], M.switchPt[1] + 11, 16]);
    if (o.hl.has("inspection_plate") && o.plateOn) spots.push([G.plateX, M.carY - G.plateDY, G.plateR + 8]);
    if (o.hl.has("buffers")) spots.push([G.carCX - 36, G.PB - 18, 22], [G.carCX + 36, G.PB - 18, 22], [G.cwCX, G.PB - 16, 20]);
    if (!spots.length) return;
    ctx.save(); ctx.strokeStyle = HLC; ctx.lineWidth = 2 / s;
    for (const [x, y, r] of spots) for (let k = 0; k < 2; k++) {
      const ph = (t / 1.8 + k * 0.5) % 1;
      ctx.globalAlpha = 0.55 * (1 - ph) * hk; ctx.beginPath(); ctx.arc(x, y, r * (1 + 0.9 * ph), 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- Funken der Fangvorrichtung ----------
  function frictionSparks(ctx, G, M, t) {
    if (!M.sparks) return;
    const { t0, t1, yAt } = M.sparks, life = 0.5, n = 190, segs = [], up = M.runaway ? -1 : 1;
    for (const side of [-1, 1]) {
      const rail = side < 0 ? G.railL : G.railR;
      for (let i = 0; i < n; i++) {
        const b = t0 + (t1 - t0) * Math.pow(h01(i * 13.1 + side * 7.7), 1.4), age = t - b;
        if (age < 0 || age > life) continue;
        const inten = 1 - (0.65 * (b - t0)) / Math.max(0.01, t1 - t0);
        const ang = (up * Math.PI) / 2 - side * (0.15 + 1.25 * h01(i * 3.7 + side * 1.3)) * up, sp = (120 + 280 * h01(i * 5.3 + side)) * (0.5 + 0.5 * inten);
        const ox = rail + side * 4, oy = yAt(b) + 17;
        const px = ox + Math.cos(ang) * sp * age, py = oy + Math.sin(ang) * sp * age + 260 * age * age;
        const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp + 520 * age, k = 0.03;
        segs.push([px, py, px - vx * k, py - vy * k, i % 3 ? COL.amber : COL.hot, Math.min(1, (1.25 - age / life) * inten), i % 4 ? 1.8 : 2.8]);
      }
    }
    batchSegs(ctx, segs, 2);
  }

  /** Rote Warnlinie am Schachtkopf (Absturz nach oben). */
  function drawLimit(ctx, L, G, M, T, t) {
    if (!M.runaway) return;
    const a = smooth((t - T.R.start) / 0.3); if (a <= 0) return;
    const near = sat(1 - (M.carY - G.CH - 26 - G.slabBot) / (1.6 * G.fh)), bl = (0.5 + 0.5 * (Math.sin(t * (7 + 6 * near)) > 0 ? 1 : 0.25)) * a;
    const y = G.slabBot + 5;
    fill(ctx, (c) => c.rect(G.S0 + 2, G.slabBot, G.SW - 4, 10), COL.red, 0.08 * bl);
    stroke(ctx, (c) => { for (let x = G.S0 + 6; x < G.S1 - 6; x += 12) { c.moveTo(x, G.slabBot + 9); c.lineTo(x + 7, G.slabBot + 1); } }, COL.red, 1.2, 0.45 * bl);
    glow(ctx, L, (c) => { c.moveTo(G.S0 + 2, y + 6); c.lineTo(G.S1 - 2, y + 6); }, COL.red, 2.2, 1.4 + near, bl);
  }

  // ---------- Kamera / Fokus ----------
  function camera(o, G, M, t, d, wide) {
    let rect = null, sMax = 2.8;
    if (o.focus === "machine_room") rect = [G.MR0 - 40, G.MRtop - 24, G.MR1 + 56, G.slabBot + 66];
    else if (o.focus === "car") { const cy = M.carY - G.CH * 0.45 - (o.state === "rope_snap" ? 40 : 0); rect = [G.carCX - 250, cy - 150, G.carCX + 200, cy + 150]; }
    else if (o.focus === "plate") {
      if (o.loupe) { const s0 = 3.1; return { s: s0 * lerp(0.9, 1, easeInOut(t / Math.max(0.3, Math.min(1.4, 0.3 * d)))), s0, cx: G.carCX, cy: M.carY - G.CH * 0.5, scx: 560, scy: 570 }; }
      const px = G.plateX, py = M.carY - G.plateDY; rect = [px - 120, py - 72, px + 70, py + 72]; sMax = 4.2;
    }
    else if (o.focus === "pit") rect = [G.S0 - 60, G.yBot - 186, G.S1 + 60, G.PB + 14];
    else if (o.focus === "ropes") rect = [G.S0 - 20, G.sy - G.R - 34, G.S1 + 20, Math.max(M.hitchY + 70, G.sy + 250, o.inclCar ? M.carY + 56 : -1e9)];
    if (!rect) return { s: 1, s0: 1, cx: 1110 - o.offX, cy: 500, scx: 1110, scy: 500 };
    const bx0 = wide ? 300 : 330, bx1 = wide ? 1580 : 1450, by0 = 215, by1 = 890;
    const s0 = clamp(Math.min((bx1 - bx0) / (rect[2] - rect[0]), (by1 - by0) / (rect[3] - rect[1])), 1, sMax);
    const s = s0 * lerp(0.88, 1, easeInOut(t / Math.max(0.3, Math.min(1.4, 0.3 * d))));
    return { s, s0, cx: (rect[0] + rect[2]) / 2, cy: (rect[1] + rect[3]) / 2, scx: (bx0 + bx1) / 2, scy: (by0 + by1) / 2 };
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
  function drawDirection(ctx, L, G, M, t, side, fadeAt) {
    if (!M.dir || Math.abs(M.v) < 0.05) return;
    const col = M.danger ? COL.red : COL.cyan;
    const x = side === "left" ? G.S0 - 44 : G.S1 + 44, yc = M.carY - G.CH / 2, dir = M.dir, a = Math.min(1, Math.abs(M.v) / 0.6) * (fadeAt != null ? 1 - smooth((t - fadeAt + 0.1) / 0.3) : 1);
    if (a <= 0.01) return;
    for (let i = 0; i < 3; i++) {
      const ph = (t * 1.6 + i / 3) % 1, y = yc - dir * (ph - 0.5) * 60, al = Math.sin(ph * Math.PI) * a;
      L.poly(ctx, [[x - 11, y + dir * 6], [x, y - dir * 6], [x + 11, y + dir * 6]], col, 2.4, 0.8, { alpha: al });
    }
  }

  // ---------- Bildschirm-Overlays ----------
  /** Ankerpunkt eines Bauteils. want = gewünschte Seite ("left"/"right", seitenabhängige Anker für car, ropes, safety_gear,
      counterweight, rails, governor_rope, buffers, pit, inspection_plate), k = Index gleichartiger Labels (versetzte Anker). */
  function anchorOf(part, G, M, R, o, want, k) {
    const lf = want === "left", rt = want === "right", kk = k || 0;
    const band = (x, y0, y1) => { // sichtbarer Abschnitt eines senkrechten Bauteils in der Referenzkamera (ohne Kamerafahrt → stabil)
      const qx = R.rx(x); if (qx < 100 || qx > 1820) return null;
      const a = Math.max(Math.min(y0, y1), R.wy0), b = Math.min(Math.max(y0, y1), R.wy1);
      return a <= b ? [a, b] : null;
    };
    const mid = (x, y0, y1, f = 0.5) => { const bd = band(x, y0, y1); return { x, y: bd ? lerp(bd[0], bd[1], f) : lerp(Math.min(y0, y1), Math.max(y0, y1), f) }; };
    const far = (x) => { // stabiler Punkt entlang eines langen Bauteils, abseits der Kabinenbahn
      if (M.focus === "car" || M.focus === "plate") return { x, y: M.carY + 64 };
      const a = Math.min(M.carY0, M.carY1) - G.CH - 36, b = Math.max(M.carY0, M.carY1) + 36, top = G.slabBot + 40, bot = G.PB - 40;
      const y = a - top > bot - b ? (top + Math.max(top, a)) / 2 : (Math.min(bot, b) + bot) / 2;
      return band(x, y, y) ? { x, y } : mid(x, G.slabBot + 20, G.PB - 30);
    };
    switch (part) {
      case "ropes": {
        const sx = lf ? -1 : 1, sd = lf ? "left" : "right";
        if (o.ropeCoil && o.state === "on_buffer" && o.allBroken) return { x: G.carCX + sx * (G.coilW - 6), y: G.PB - M.coilH * 0.5, side: sd };
        if (M.allSnapped) return { x: G.carCX + sx * 18, y: M.hitchY - 2, side: sd };
        if (o.damaged.length && M.dmgY != null) return { x: G.carCX + sx * (G.bundle / 2 + 2), y: M.dmgY + 20 * kk, side: sd };
        const f = mid(G.carCX + sx * (G.bundle / 2 + 1), G.sy + 30, M.hitchY - 12, clamp(0.5 + 0.24 * kk, 0.1, 0.86)); return { x: f.x, y: f.y, side: sd };
      }
      case "car": return { x: lf ? G.carX0 + 6 : G.carX1 - 6, y: M.carY - G.CH * Math.max(0.14, 0.55 - 0.25 * kk), side: lf ? "left" : "right" };
      case "counterweight": return rt ? { x: G.cwX0 + G.cwW, y: M.cwTop + G.CWH * 0.5, side: "right" } : { x: G.cwX0, y: M.cwTop + G.CWH * 0.5, side: "left" };
      case "sheave": return { x: G.sx - 26, y: G.sy - 26, side: "left" };
      case "brake": return { x: G.sx + 72, y: G.sy - 20, side: "right" };
      case "governor": return { x: G.gx + G.rg + 2, y: G.gy + 2, side: "right" };
      case "governor_rope": { const f = far(lf ? G.gL : G.gR); return { x: f.x, y: f.y, side: lf ? "left" : "right" }; }
      case "safety_gear": return rt ? { x: G.railR + 11, y: M.carY + 10, side: "right" } : { x: G.railL - 11, y: M.carY + 10, side: "left" };
      case "lever": { const m = M.leverMid || [G.railR + 18, M.carY + 6]; return { x: m[0], y: m[1], side: "right" }; }
      case "rails": { const f = far(rt ? G.railR : G.railL); return { x: f.x, y: f.y, side: rt ? "right" : "left" }; }
      case "buffers": return { x: G.carCX + (lf ? -49 : 49), y: G.PB - G.bufH * (1 - M.bufComp) + 4, side: lf ? "left" : "right" };
      case "machine_room": return { x: G.MR0 + 6, y: G.MRtop + 40, side: "left" };
      case "pit": return rt ? { x: G.S1 - 6, y: G.PB - 14, side: "right" } : { x: G.S0 + 6, y: G.PB - 14, side: "left" };
      case "deflector": return { x: G.bx - G.rd - 12, y: G.by, side: "left" };
      case "tension_pulley": return { x: G.gx + G.tpR, y: G.tpY, side: "right" };
      case "shaft": return { x: G.S0 - 4, y: lerp(G.slabBot, G.PB, 0.5), side: "left" };
      case "switch": return { x: G.gx - 42, y: G.slabTop - 35, side: "right" };
      case "inspection_plate": return lf ? { x: G.plateX - G.plateR - 4, y: M.carY - G.plateDY, side: "left" } : { x: G.plateX + G.plateR + 4, y: M.carY - G.plateDY, side: "right" };
      case "air_cushion": return { x: G.S0 + 112, y: (Math.min(G.PB - 4, M.carY + 20) + G.PB) / 2, side: "left" };
      case "rope_coil": return { x: G.carCX + G.coilW - 4, y: G.PB - Math.max(12, M.coilH * 0.55), side: "right" };
      case "debris": return M.debrisPt ? { x: M.debrisPt[0] + M.debrisPt[2], y: M.debrisPt[1], side: "right" } : { x: G.S1 - 6, y: Math.max(G.slabBot + 40, (M.dmgY ?? M.hitchY - 60) - 1.4 * G.fh), side: "right" };
      case "shaft_head": return { x: G.S1 - 30, y: G.slabBot + 11, side: "right" };
      default: return null;
    }
  }

  const WRAP = new Map();
  /** Umbruch mit manuellen Zeilenumbrüchen ("\n") und ausgeglichenen Zeilenlängen (keine Einzelwort-Waisen). */
  function layoutText(ctx, L, text, avail) {
    const k = text + "|" + Math.round(avail / 8);
    const hit = WRAP.get(k); if (hit) return hit;
    const maxW = clamp(avail - 36, 200, 440), paras = String(text).split(/\n|\\n/).map((s) => s.trim()).filter(Boolean);
    let res = null;
    for (let fs = 25; fs >= 18; fs--) {
      const st = { size: fs, weight: 600 }, lines = [];
      for (const para of paras) {
        let ls = L.wrap(ctx, para, maxW, st);
        if (ls.length > 1) { let lo = maxW * 0.35, hi = maxW; for (let it = 0; it < 7; it++) { const m = (lo + hi) / 2; if (L.wrap(ctx, para, m, st).length > ls.length) lo = m; else hi = m; } ls = L.wrap(ctx, para, hi + 1, st); }
        lines.push(...ls);
      }
      const tw = Math.max(...lines.map((ln) => L.measure(ctx, ln, st)));
      if ((tw <= maxW && lines.length <= 3) || fs === 18) { const ln = lines.slice(0, 4); res = { fs, lines: ln, w: Math.min(tw, maxW + 60) + 36, h: fs * 1.24 * ln.length + 24 - fs * 0.24 }; break; }
    }
    if (WRAP.size > 300) WRAP.clear();
    WRAP.set(k, res); return res;
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
    panel(ctx, alignRight ? bx + w - ew : bx, by, ew, h, { alpha: tp, stroke: rgba(color, 0.55), r: 8, fill: "rgba(8,22,44,0.8)" });
    const ta = sat((p - 0.6) / 0.4), lh = it.fs * 1.24;
    it.lines.forEach((ln, i) => L.text(ctx, ln, bx + 18, by + 12 + lh * i + it.fs * 0.95, { size: it.fs, weight: 600, color: COL.white, alpha: ta }));
  }

  /** Layout aller Callouts (auch später erscheinender → stabile Positionen), Ausweichen vor Richtungspfeilen. */
  function layoutCallouts(ctx, L, G, o, M, T, toS, R, col, chev) {
    const res = { items: [], chevSide: "right" };
    if (!o.labels.length) return res;
    const d = T.d, full = o.focus === "full";
    const leftEdge = full ? toS(G.BX0 - 8, 0)[0] - 100 : -1e4, rightEdge = full ? toS(G.BX1 + 8, 0)[0] + 44 : 1e4;
    const items = [], dup = {};
    const loupeAnchor = (sd) => { const Lp = M.loupe, w = 0.42; return [Lp.cx + (sd === "left" ? -1 : 1) * Lp.R * Math.cos(w), Lp.cy + Lp.R * Math.sin(w)]; };
    o.labels.forEach((lb, i) => {
      const dk = lb.part + "|" + (lb.side || ""), kk = (dup[dk] = (dup[dk] ?? -1) + 1);
      const an = anchorOf(lb.part, G, M, R, o, lb.side, kk); if (!an) return;
      let [ax, ay] = toS(an.x, an.y);
      if (lb.part === "inspection_plate" && M.loupe) [ax, ay] = loupeAnchor(lb.side || "right");
      if (ax < 60 || ax > 1860 || ay < 60 || ay > 1000) return;
      const it = { ...lb, ax, ay, side: lb.side || an.side, i, start: lb.at != null ? T.at(lb.at) : Math.min(0.4 + i * 0.3, 0.42 * d) };
      let availR = 1830 - (full ? Math.max(rightEdge, ax + 60) : ax + 70), availL = (full ? Math.min(leftEdge, ax - 60) : ax - 70) - 90;
      if (availR < 240) availR = 1830 - (ax + 60);
      if (availL < 240) availL = ax - 60 - 90;
      const lim = lb.side ? 150 : 230;
      if (it.side === "right" && availR < lim && availL > availR) it.side = "left";
      if (it.side === "left" && availL < lim && availR > availL) it.side = "right";
      if (lb.side && it.side !== lb.side) { // explizite Seite musste weichen → Anker auf die tatsächliche Seite legen
        if (lb.part === "inspection_plate" && M.loupe) [it.ax, it.ay] = loupeAnchor(it.side);
        else { const an2 = anchorOf(lb.part, G, M, R, o, it.side, kk); if (an2) [it.ax, it.ay] = toS(an2.x, an2.y); }
      }
      Object.assign(it, layoutText(ctx, L, lb.text, it.side === "left" ? availL : availR));
      items.push(it);
    });
    for (const side of ["left", "right"]) {
      const list = items.filter((it) => it.side === side).sort((a, b) => a.ay - b.ay);
      if (!list.length) continue;
      const wMax = Math.max(...list.map((it) => it.w));
      let x;
      if (side === "left") { x = full && leftEdge - wMax >= 90 ? leftEdge : Math.min(...list.map((it) => it.ax)) - 70; x = clamp(x, 90 + wMax, 1830); }
      else {
        x = full && rightEdge + wMax <= 1830 ? rightEdge : Math.max(...list.map((it) => it.ax)) + 70;
        if (chev && x < chev.x1 + 12 && x + wMax > chev.x0 - 12) { if (!items.some((it) => it.side === "left")) res.chevSide = "left"; else if (chev.x1 + 26 + wMax <= 1830) x = chev.x1 + 26; else res.chevSide = "left"; }
        x = clamp(x, 90, 1830 - wMax);
      }
      const yMin = side === "left" ? 232 : 200, yMax = 890;
      const hitsCol = (y, h) => col && side === "right" && x < col.x1 && x + wMax > col.x0 && y + h / 2 > col.y0 - 12 && y - h / 2 < col.y1 + 12;
      let prev = null;
      for (const it of list) { let y = Math.max(it.ay, prev ? prev.ly + prev.h / 2 + it.h / 2 + 12 : -1e9, yMin + it.h / 2); if (hitsCol(y, it.h)) y = col.y1 + 16 + it.h / 2; it.ly = y; prev = it; }
      let next = null;
      for (let j = list.length - 1; j >= 0; j--) { const it = list[j]; it.ly = Math.min(it.ly, next ? next.ly - next.h / 2 - it.h / 2 - 12 : 1e9, yMax - it.h / 2); next = it; }
      for (const it of list) { it.lx = x; it.box = side === "left" ? [x - it.w, it.ly - it.h / 2, x, it.ly + it.h / 2] : [x, it.ly - it.h / 2, x + it.w, it.ly + it.h / 2]; }
    }
    if (full && items.some((it) => it.part === "car" && it.side === "right") && !items.some((it) => it.part === "car" && it.side === "left")) res.chevSide = "left";
    else if (full && items.some((it) => it.part === "car" && it.side === "left")) { // Kabinen-Labels auf beiden Seiten: Pfeile rechts, ausblenden sobald das rechte Label kommt
      const rs = items.filter((it) => it.part === "car" && it.side === "right").map((it) => it.start);
      if (rs.length) res.chevFade = Math.min(...rs);
    }
    res.items = items;
    return res;
  }
  function drawCallouts(ctx, L, o, lay, t) {
    for (const it of lay.items) {
      if (it.lx == null) continue;
      const pr = sat((t - it.start) / 0.8); if (pr <= 0) continue;
      callout(ctx, L, it.ax, it.ay, it.lx, it.ly, it, pr, it.col || (o.hl.has(it.part) ? HLC : COL.cyan), it.side === "left");
    }
  }

  function chip(ctx, L, str, x, y, col, alpha, alignRight) {
    const w = L.measure(ctx, str, { size: 13, weight: 700, font: L.FONT.mono, letterSpacing: 2 }) + 18, bx = alignRight ? x - w : x;
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = "rgba(6,16,34,0.85)"; ctx.beginPath(); rr(ctx, bx, y, w, 22, 4); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.stroke(); ctx.restore();
    L.text(ctx, str, bx + 9, y + 16, { size: 13, weight: 700, font: L.FONT.mono, letterSpacing: 2, color: col, alpha });
  }

  const COLX = 1492, COLW = 338;
  function drawSpeedPanel(ctx, L, o, M, t, y, T) {
    const x = COLX, w = COLW, h = 206, a = smooth((t - T.hudAt) / 0.5), vTrip = 1.15 * o.vNom, av = Math.abs(M.v);
    if (a <= 0.01) return;
    panel(ctx, x, y, w, h, { alpha: a, r: 10, fill: "rgba(6,16,34,0.84)" });
    L.text(ctx, "GESCHWINDIGKEIT", x + 22, y + 34, { size: 15, weight: 700, font: L.FONT.mono, letterSpacing: 3, color: COL.muted, alpha: a });
    if (M.slow) chip(ctx, L, "ZEITLUPE", x + w - 18, y + 17, COL.amber, a * (0.75 + 0.25 * Math.sin(t * 4)), true);
    const col = av > vTrip + 0.004 ? COL.red : av > o.vNom * 1.01 ? COL.amber : COL.cyan;
    const val = fmt(av, 2);
    L.text(ctx, val, x + 22, y + 104, { size: 60, weight: 700, font: L.FONT.mono, color: col, alpha: a });
    const vw = L.measure(ctx, val, { size: 60, weight: 700, font: L.FONT.mono });
    L.text(ctx, "m/s", x + 32 + vw, y + 104, { size: 24, weight: 600, color: COL.muted, alpha: a });
    if (M.dir && av > 0.02) { const ax = x + w - 42, ay = y + 82, dd = M.dir; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(ax - 13, ay + dd * 9); ctx.lineTo(ax + 13, ay + dd * 9); ctx.lineTo(ax, ay - dd * 13); ctx.closePath(); ctx.fill(); ctx.restore(); }
    const bx = x + 22, bw = w - 44, by = y + 124, vmax = o.vNom * 1.5, xs = (v) => bx + bw * Math.min(1, v / vmax);
    fill(ctx, (c) => rr(c, bx, by, bw, 8, 4), "rgba(143,179,217,0.18)", a);
    if (av > 0.004) fill(ctx, (c) => rr(c, bx, by, Math.max(8, xs(av) - bx), 8, 4), col, a);
    stroke(ctx, (c) => { c.moveTo(xs(o.vNom), by - 5); c.lineTo(xs(o.vNom), by + 13); }, COL.cyan, 2, a);
    stroke(ctx, (c) => { c.moveTo(xs(vTrip), by - 5); c.lineTo(xs(vTrip), by + 13); }, COL.red, 2, a);
    L.text(ctx, "Nenn " + fmt(o.vNom, 1), xs(o.vNom) - 5, by + 31, { size: 13, weight: 400, font: L.FONT.mono, color: COL.muted, align: "right", alpha: a });
    L.text(ctx, "115 %", xs(vTrip) + 5, by + 31, { size: 13, weight: 400, font: L.FONT.mono, color: COL.red, alpha: a });
    const sc = M.statusCol, blink = sc === COL.red ? 0.55 + 0.45 * Math.sin(t * 9) : 1;
    L.glowDot(ctx, x + 30, y + 180, 12, sc, a * blink); L.fillCircle(ctx, x + 30, y + 180, 4.5, sc);
    L.text(ctx, M.status, x + 46, y + 187, { size: M.status.length > 24 ? 17 : 20, weight: 600, color: COL.white, alpha: a });
    return { x0: x, y0: y, x1: x + w, y1: y + h };
  }

  function drawRopePanel(ctx, L, o, M, t, y, T) {
    const x = COLX, w = COLW, h = 204, a = smooth((t - T.hudAt) / 0.5), n = o.n, fade = o.brokenStyle === "fade";
    if (a <= 0.01) return;
    const brokenNow = Object.entries(M.snaps).filter(([, tb]) => t >= tb).map(([i]) => +i);
    const intact = n - brokenNow.length;
    panel(ctx, x, y, w, h, { alpha: a, r: 10, fill: "rgba(6,16,34,0.84)" });
    L.text(ctx, "TRAGSEILE", x + 22, y + 34, { size: 15, weight: 700, font: L.FONT.mono, letterSpacing: 3, color: COL.muted, alpha: a });
    const sp = Math.min(17, 120 / Math.max(1, n - 1)), x0 = x + 30, yA = y + 54, yB = y + 110;
    for (let i = 0; i < n; i++) {
      const xx = x0 + i * sp, br = brokenNow.includes(i);
      if (!br) glow(ctx, L, (c) => { c.moveTo(xx, yA); c.lineTo(xx, yB); }, COL.cyan, 3.2, 0.7, a);
      else if (fade) { const f = smooth((t - M.snaps[i]) / 0.7); stroke(ctx, (c) => { c.moveTo(xx, yA); c.lineTo(xx, yB); }, COL.muted, 2.4, a * (1 - 0.7 * f), f > 0.35 ? [3, 5] : null); }
      else {
        const age = t - M.snaps[i];
        glow(ctx, L, (c) => { c.moveTo(xx, yA); c.lineTo(xx + 4, yA + 22); c.moveTo(xx - 4, yA + 36); c.lineTo(xx, yB); }, COL.red, 3.2, 1.2, a);
        if (age < 0.8) L.glowDot(ctx, xx, yA + 29, 26 * (1 - age / 0.8) + 8, COL.red, a * (1 - age / 0.8));
      }
    }
    const xr = x0 + (n - 1) * sp + 34, cnt = `${intact}/${n}`;
    L.text(ctx, cnt, xr, y + 96, { size: 44, weight: 700, font: L.FONT.mono, color: intact < n ? COL.white : COL.cyan, alpha: a });
    L.text(ctx, "intakt", xr + L.measure(ctx, cnt, { size: 44, weight: 700, font: L.FONT.mono }) + 10, y + 96, { size: 18, weight: 600, color: COL.muted, alpha: a });
    const ha = M.holdA * a, yS = y + 160;
    const note = o.panelNote != null ? (o.panelNote === false ? "" : String(o.panelNote)) : fade ? "" : "Kabine bleibt stehen";
    if (ha > 0.01 && intact > 0) {
      const sc = 0.75 + 0.25 * easeOutBack(M.holdA);
      ctx.save(); ctx.translate(x + 22, note ? yS : yS + 12); ctx.scale(sc, sc);
      L.poly(ctx, [[2, -12], [11, -3], [27, -22]], COL.green, 4.5, 1, { alpha: ha });
      L.text(ctx, "HÄLT", 38, 0, { size: 36, weight: 700, font: L.FONT.head, color: COL.green, stroke: 6, strokeColor: rgba(COL.green, 0.2), letterSpacing: 2, alpha: ha });
      ctx.restore();
      if (note) L.text(ctx, note, x + 22, y + 189, { size: 16, weight: 400, color: COL.muted, alpha: ha });
    } else if (intact === 0 && brokenNow.length) L.text(ctx, "ALLE GERISSEN", x + 22, yS, { size: 30, weight: 700, font: L.FONT.head, color: COL.red, alpha: a });
    else if (brokenNow.length) L.text(ctx, fade ? "" : "Seil gerissen!", x + 22, yS - 4, { size: 22, weight: 700, color: COL.red, alpha: a });
    else L.text(ctx, "Normalbetrieb", x + 22, yS - 4, { size: 20, weight: 600, color: COL.muted, alpha: a });
    return { x0: x, y0: y, x1: x + w, y1: y + h };
  }

  /** Stoppuhr (Zeitlupe): zählt die reale Zeit τ seit dem Seilschnitt. */
  function drawStopwatch(ctx, L, o, M, T, t, y) {
    const S = o.stopwatch, a = smooth((t - T.swAt) / 0.4); if (a <= 0.01) return;
    const x = COLX, w = COLW, h = 150, pop = 0.94 + 0.06 * easeOutBack(sat((t - T.swAt) / 0.4));
    let sec;
    if (T.F) sec = S.to != null ? (S.from + (S.to - S.from) * sat(M.tau / Math.max(1e-6, T.F.tauEnd))) / 1000 : M.tau + S.from / 1000;
    else sec = Math.max(0, t - T.swAt) + S.from / 1000;
    const useMs = T.F ? T.F.tauEnd < 1.5 : sec < 1;
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(pop, pop); ctx.translate(-(x + w / 2), -(y + h / 2));
    panel(ctx, x, y, w, h, { alpha: a, r: 10, fill: "rgba(6,16,34,0.86)", stroke: rgba(COL.amber, 0.5) });
    L.text(ctx, S.label ? String(S.label).toUpperCase() : "STOPPUHR", x + 22, y + 32, { size: 15, weight: 700, font: L.FONT.mono, letterSpacing: 3, color: COL.muted, alpha: a });
    if (M.slow && T.F) chip(ctx, L, "ZEITLUPE", x + w - 18, y + 15, COL.amber, a * (0.75 + 0.25 * Math.sin(t * 4)), true);
    const cx = x + 66, cy = y + 94, r = 38, dialMax = useMs ? (T.F ? Math.max(5, Math.ceil((T.F.tauEnd * 1000 * 1.25) / 5) * 5) : 1000) : 60;
    const val = useMs ? sec * 1000 : sec, ang = -Math.PI / 2 + TAU * sat(val / dialMax);
    stroke(ctx, (c) => { c.arc(cx, cy, r, 0, TAU); c.moveTo(cx - 6, cy - r - 8); c.lineTo(cx + 6, cy - r - 8); c.moveTo(cx, cy - r - 8); c.lineTo(cx, cy - r); }, COL.steel, 2, a);
    stroke(ctx, (c) => { for (let k = 0; k < 20; k++) { const q = -Math.PI / 2 + (k * TAU) / 20, l = k % 5 ? 5 : 9; c.moveTo(cx + Math.cos(q) * (r - 3), cy + Math.sin(q) * (r - 3)); c.lineTo(cx + Math.cos(q) * (r - 3 - l), cy + Math.sin(q) * (r - 3 - l)); } }, COL.muted, 1.2, a);
    if (val > 0) fill(ctx, (c) => { c.moveTo(cx, cy); c.arc(cx, cy, r - 4, -Math.PI / 2, ang); c.closePath(); }, COL.amber, 0.16 * a);
    glow(ctx, L, (c) => { c.moveTo(cx, cy); c.lineTo(cx + Math.cos(ang) * (r - 6), cy + Math.sin(ang) * (r - 6)); }, COL.amber, 2.4, 1, a);
    L.fillCircle(ctx, cx, cy, 3.5, COL.white);
    const str = useMs ? fmt(val, 1) : fmt(val, 2), unit = useMs ? "ms" : "s";
    L.text(ctx, str, x + 124, y + 116, { size: 54, weight: 700, font: L.FONT.mono, color: COL.amber, alpha: a });
    L.text(ctx, unit, x + 132 + L.measure(ctx, str, { size: 54, weight: 700, font: L.FONT.mono }), y + 116, { size: 24, weight: 600, color: COL.muted, alpha: a });
    ctx.restore();
  }

  function drawReadout(ctx, L, o, M, T, t, r, at, y) {
    const a = smooth((t - at) / 0.35); if (a <= 0.01) return;
    let text = r.text;
    if (/^auto$/i.test(text)) { const ref = T.F && T.F.v0 > 0.02 ? T.F.v0 : o.vNom, pct = Math.round((Math.abs(M.v) / ref - 1) * 100); text = (pct >= 0 ? "+" : "−") + Math.abs(pct) + " %"; }
    const col = r.col || COL.amber, size = 46, tw = L.measure(ctx, text, { size, weight: 700, font: L.FONT.mono }), cap = r.cap ? String(r.cap).toUpperCase() : null;
    const h = cap ? 96 : 72, w = Math.max(tw + 48, cap ? L.measure(ctx, cap, { size: 13, weight: 700, font: L.FONT.mono, letterSpacing: 2 }) + 48 : 0), x = COLX + COLW - w;
    const sc = 0.8 + 0.2 * easeOutBack(sat((t - at) / 0.4));
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(sc, sc); ctx.translate(-(x + w / 2), -(y + h / 2));
    panel(ctx, x, y, w, h, { alpha: a, r: 10, fill: "rgba(6,16,34,0.88)", stroke: rgba(col, 0.75), lw: 2 });
    if (cap) L.text(ctx, cap, x + 24, y + 28, { size: 13, weight: 700, font: L.FONT.mono, letterSpacing: 2, color: COL.muted, alpha: a });
    L.text(ctx, text, x + 24, y + h - 20, { size, weight: 700, font: L.FONT.mono, color: col, alpha: a, glow: 14, glowColor: col });
    ctx.restore();
  }
  /** Plan der rechten Spalte (HUD, Stoppuhr, Readouts) – vorab, damit Callouts ausweichen. */
  function columnPlan(o, M) {
    const rows = []; let y = 212;
    if (o.hud && (M.speedPanel || M.ropePanel)) { rows.push({ k: "hud", y }); y += (M.speedPanel ? 206 : 204) + 16; }
    if (o.stopwatch) { rows.push({ k: "sw", y }); y += 150 + 16; }
    o.readouts.forEach((r, i) => { rows.push({ k: "ro", i, y }); y += (r.cap ? 96 : 72) + 14; });
    return rows.length ? { rows, x0: COLX, x1: COLX + COLW, y0: 212, y1: y - 14 } : null;
  }

  /** Lineal an der Führungsschiene (Lupe): Fallweg in cm. */
  function drawRuler(ctx, L, G, o, M, T, t, toS) {
    const Rr = o.ruler, a = smooth((t - T.rulerAt) / 0.5); if (a <= 0.01) return;
    const PXM = T.PXM, yRef = T.F ? T.F.yF : M.carY0, sCm = Math.max(0, ((M.carY - yRef) / PXM) * 100);
    const maxCm = Rr.auto && T.F && T.F.mode === "slowmo" ? clamp(Math.ceil(T.F.D * 100 * 1.15), 1, 20) : Rr.maxCm;
    const [ax, ay] = toS(G.railL, M.carY + 16);
    const rx = clamp(ax - 190, 170, 1640), Hs = 230, y0 = clamp(ay - 30, 262, 880 - Hs), pxc = Hs / maxCm;
    panel(ctx, rx - 70, y0 - 46, 222, Hs + 78, { alpha: a * 0.95, r: 8, fill: "rgba(6,16,34,0.86)" });
    L.text(ctx, "FALLWEG", rx - 52, y0 - 20, { size: 13, weight: 700, font: L.FONT.mono, letterSpacing: 2, color: COL.muted, alpha: a });
    // Lupe: Verbindung zur Schiene
    stroke(ctx, (c) => { c.moveTo(ax, ay); c.lineTo(rx + 2, y0); }, COL.cyan, 1.2, 0.5 * a, [4, 4]);
    stroke(ctx, (c) => c.arc(ax, ay, 12, 0, TAU), COL.cyan, 1.5, 0.8 * a);
    stroke(ctx, (c) => { c.moveTo(rx, y0); c.lineTo(rx, y0 + Hs); for (let mm = 0; mm <= maxCm * 10; mm++) { const yy = y0 + (mm / 10) * pxc, l = mm % 10 === 0 ? 20 : mm % 5 === 0 ? 13 : 7; c.moveTo(rx, yy); c.lineTo(rx - l, yy); } }, COL.steel, 1.3, a);
    for (let cm = 0; cm <= maxCm; cm++) L.text(ctx, String(cm), rx - 26, y0 + cm * pxc + 6, { size: 16, weight: 600, font: L.FONT.mono, color: COL.muted, align: "right", alpha: a });
    const ym = y0 + Math.min(1, sCm / maxCm) * Hs;
    if (sCm > 0.005) fill(ctx, (c) => c.rect(rx + 2, y0, 6, ym - y0), COL.amber, 0.5 * a);
    fill(ctx, (c) => { c.moveTo(rx + 3, ym); c.lineTo(rx + 15, ym - 7); c.lineTo(rx + 15, ym + 7); c.closePath(); }, COL.amber, a);
    L.text(ctx, fmt(sCm, 1) + " cm", rx + 20, ym + 9, { size: 26, weight: 700, font: L.FONT.mono, color: COL.amber, alpha: a });
  }

  /** Last-/Reserve-Chip am verbleibenden Seil (z. B. „≈2×“). */
  function drawFactorChip(ctx, L, G, o, M, T, t, toS) {
    const S = o.safetyFactor, a = smooth((t - T.sfAt) / 0.4); if (a <= 0.01) return;
    const rp = G.ropes.find((r) => !(M.snaps[r.i] != null && t >= M.snaps[r.i])) || G.ropes[0];
    const [ax, ay] = toS(rp.carX - 1, lerp(G.sy + 30, M.hitchY - 12, 0.62));
    const size = 34, tw = L.measure(ctx, S.text, { size, weight: 700, font: L.FONT.mono }), cap = S.cap ? String(S.cap) : null;
    const w = Math.max(tw, cap ? L.measure(ctx, cap, { size: 15, weight: 600 }) : 0) + 40, h = cap ? 84 : 58, bx = clamp(ax - 46 - w, 90, 1830 - w), by = clamp(ay - h / 2, 232, 890 - h);
    const sc = 0.8 + 0.2 * easeOutBack(sat((t - T.sfAt) / 0.4));
    stroke(ctx, (c) => { c.moveTo(ax, ay); c.lineTo(bx + w, by + h / 2); }, S.col, 1.8, a);
    L.glowDot(ctx, ax, ay, 14, S.col, a); L.fillCircle(ctx, ax, ay, 4, S.col);
    ctx.save(); ctx.translate(bx + w / 2, by + h / 2); ctx.scale(sc, sc); ctx.translate(-(bx + w / 2), -(by + h / 2));
    panel(ctx, bx, by, w, h, { alpha: a, r: 10, fill: "rgba(6,16,34,0.9)", stroke: rgba(S.col, 0.8), lw: 2 });
    L.text(ctx, S.text, bx + 20, by + (cap ? 42 : 42), { size, weight: 700, font: L.FONT.mono, color: S.col, alpha: a, glow: 12, glowColor: S.col });
    if (cap) L.text(ctx, cap, bx + 20, by + 70, { size: 15, weight: 600, color: COL.muted, alpha: a });
    ctx.restore();
  }

  /** Symbol-Badges an Bauteilen („?“, „!“ …) und großes Overlay-Symbol. */
  function drawMarkers(ctx, L, G, o, M, T, t, toS, R) {
    o.markers.forEach((m, i) => {
      const at = T.mkAt[i], a = sat((t - at) / 0.35); if (a <= 0) return;
      const an = anchorOf(m.part, G, M, R, o); if (!an) return;
      const [ax, ay] = toS(an.x, an.y), col = m.col || COL.red, dx = an.side === "left" ? 36 : -36;
      const bx = clamp(ax + dx, 110, 1810), by = clamp(ay - 44, 250, 880), sc = easeOutBack(a), pulse = 0.5 + 0.5 * Math.sin(t * 4 + i);
      stroke(ctx, (c) => { c.moveTo(ax, ay); c.lineTo(bx, by); }, col, 1.6, 0.8 * a);
      ctx.save(); ctx.translate(bx, by); ctx.scale(sc, sc);
      fill(ctx, (c) => c.arc(0, 0, 22, 0, TAU), "#0a1224", 0.92);
      glow(ctx, L, (c) => c.arc(0, 0, 22, 0, TAU), col, 2.4, 1 + pulse, 1);
      stroke(ctx, (c) => c.arc(0, 0, 22 + 8 * ((t * 0.8 + i * 0.3) % 1), 0, TAU), col, 1.4, 0.5 * (1 - ((t * 0.8 + i * 0.3) % 1)));
      L.text(ctx, m.sym, 0, 11, { size: 30, weight: 700, font: L.FONT.head, color: COL.white, align: "center" });
      ctx.restore();
    });
    if (o.big) {
      const B = o.big, a = sat((t - T.bigAt) / 0.45); if (a <= 0) return;
      const an = anchorOf(B.part, G, M, R, o) || { x: G.carCX, y: M.carY - G.CH };
      let [qx, qy] = B.part === "car" ? toS(G.carCX, M.hitchY - 40) : toS(an.x, an.y - 60);
      qx = clamp(qx, 200, 1720); qy = clamp(qy + 6 * Math.sin(t * 2.2), 320, 820);
      const col = B.col || COL.amber, sc = easeOutBack(a);
      ctx.save(); ctx.translate(qx, qy); ctx.scale(sc, sc);
      softDot(ctx, 0, -50, 120, col, 0.9 * a);
      L.text(ctx, B.sym, 0, 0, { size: 170, weight: 700, font: L.FONT.head, color: col, align: "center", glow: 30, glowColor: col, stroke: 8, strokeColor: "rgba(4,10,22,0.8)", alpha: a });
      ctx.restore();
    }
  }

  function drawScreenLabels(ctx, L, G, o, M, toS, t, boxes) {
    const base = o.hl.size ? 0.6 : 0.85, mono = L.FONT.mono;
    const clash = (x0, y0, x1, y1) => boxes.some((b) => x1 > b[0] - 6 && x0 < b[2] + 6 && y1 > b[1] - 6 && y0 < b[3] + 6);
    if (M.tripped) { const [gx, gy] = toS(G.gx + G.rg + 12, G.gy - 44); chip(ctx, L, "AUSGELÖST", gx, gy, COL.red, sat(M.trippedAge / 0.25) * (0.8 + 0.2 * Math.sin(t * 6)), false); }
    const leftLabels = o.focus === "full" && o.labels.some((lb) => ["counterweight", "sheave", "safety_gear", "rails", "machine_room", "pit", "deflector", "shaft", "air_cushion"].includes(lb.part));
    if (o.floorLabels !== false || o.levelMarks) for (let k = 0; k < G.N; k++) {
      const yW = G.levelY(k), [fx, fy] = toS(G.BX0 + 10, yW - 9), [ex, ey] = toS(G.BX0 - 16, yW);
      const free = (qx, qy) => qy > 110 && qy < 905 && qx > 90 && qx < 1830 && !(qx < 940 && qy < 238);
      const lab = Array.isArray(o.floorLabels) ? o.floorLabels[k] ?? "" : o.floorLabels ? (k === 0 ? "EG" : `${k}. OG`) : "";
      if (lab && free(fx, fy)) L.text(ctx, lab, fx, fy, { size: 15, weight: 700, font: mono, color: COL.muted, alpha: base });
      if (o.levelMarks && !leftLabels && free(ex - 60, ey) && free(ex, ey)) {
        L.text(ctx, (k === 0 ? "±" : "+") + fmt(k * o.floorM, 2), ex - 14, ey + 5, { size: 13, weight: 400, font: mono, color: COL.muted, align: "right", alpha: 0.7 * base });
        fill(ctx, (c) => { c.moveTo(ex - 8, ey - 6); c.lineTo(ex, ey - 6); c.lineTo(ex - 4, ey); c.closePath(); }, COL.muted, 0.7 * base);
      }
    }
    const [mx, my] = toS(G.MR1 - 8, G.MRtop + 20);
    if (my > 60 && mx < 1900 && !o.labels.some((l) => l.part === "machine_room") && !clash(mx - 150, my - 14, mx, my + 4)) L.text(ctx, "TRIEBWERKSRAUM", mx, my, { size: 13, weight: 700, font: mono, letterSpacing: 2, color: COL.cyan, align: "right", alpha: 0.6 });
    const [px, py] = toS(G.S0 - 14, G.PB + 4);
    if (py < 905 && px > 150 && !o.labels.some((l) => l.part === "pit") && !clash(px - 130, py - 14, px, py + 4)) L.text(ctx, "SCHACHTGRUBE", px, py, { size: 13, weight: 700, font: mono, letterSpacing: 2, color: COL.cyan, align: "right", alpha: 0.6 });
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
  const CACHE = new WeakMap();
  function setup(params, d) {
    const k = params && typeof params === "object" ? params : null;
    const c = k && CACHE.get(k);
    if (c && c.d === d) return c;
    const o = parseParams(params), G = geometry(o), T = timing(o, G, d), r = { d, o, G, T };
    if (k) CACHE.set(k, r);
    return r;
  }

  function draw(ctx, p) {
    const L = p.L, t = Math.max(0, p.t || 0), d = Math.max(0.5, p.d || 6);
    const { o, G, T } = setup(p.params, d);
    HLC = o.hlColor;
    const M = motion(o, G, T, t, d);
    M.hitchAt = (tt) => carYAt(o, G, T, tt) - G.CH - 26;
    M.carY0 = carYAt(o, G, T, 0); M.carY1 = carYAt(o, G, T, d); M.focus = o.focus;
    // Schad-/Einschlagstelle im Seilbündel (fest ab Einschlag)
    if (o.damaged.length || o.debris) { const hT = M.hitchAt(T.dmgAt); M.dmgY = snapYOf(G, hT, 0, false); if (o.debris) M.debrisHit = M.dmgY; }
    if (o.debris && T.debrisT != null) { const P = debrisPath(G, M, T, t); M.debrisPt = P ? [P.x, P.y, P.r] : null; }
    const sty = makeStyle(o, t, T);
    sty0 = (part) => sty(part, COL.cyan).h;
    fixCamera(ctx, p);
    const col = columnPlan(o, M);
    const C = camera(o, G, M, t, d, !col);
    ZS = Math.max(1, C.s);
    VIS = [C.cx - (C.scx + 140) / C.s, C.cy - (C.scy + 140) / C.s, C.cx + (p.W - C.scx + 140) / C.s, C.cy + (p.H - C.scy + 140) / C.s];
    let E = null; try { E = ctx.getTransform(); } catch (e) { E = null; }
    const toS = (x, y) => { const sx = C.scx + (x - C.cx) * C.s, sy = C.scy + (y - C.cy) * C.s; return E ? [E.a * sx + E.c * sy + E.e, E.b * sx + E.d * sy + E.f] : [sx, sy]; };
    const R = { rx: (x) => C.scx + (x - C.cx) * C.s0, wy0: C.cy + (250 - C.scy) / C.s0, wy1: C.cy + (860 - C.scy) / C.s0 };
    if (o.loupe) { const es = E ? Math.hypot(E.a, E.b) : 1, lx = 1275, ly = 535; M.loupe = { cx: E ? E.a * lx + E.c * ly + E.e : lx, cy: E ? E.b * lx + E.d * ly + E.f : ly, R: 205 * es, ws: C.s * es }; }
    // Kamera-Erschütterung
    let sh = 0; const hit = (te, amp) => { if (te != null && t >= te) sh += amp * Math.exp(-(t - te) * 7); };
    if (o.state === "safety_engage") hit(T.te, 6);
    else if (o.state === "on_buffer") hit(T.a, 4.5);
    else if (o.state === "rope_snap" && o.brokenStyle === "snap") hit(T.snap, 3);
    else if (o.state === "all_ropes_snap") { if (T.F.cut > 0) hit(T.F.cut, 3.5); if (T.F.impact) hit(T.F.tImp, 10); }
    else if (o.state === "stopped") hit(T.jolt, 8);
    else if (o.state === "runaway_up" && T.R.trip != null) hit(T.R.trip, 6);
    if (o.debris) hit(T.debrisT, 4);
    if (T.passAt != null) { hit(T.passAt, 2.5); hit(T.passAt + T.passDur, 1.5); }
    if (sh < 0.05) sh = 0;
    const shx = sh * Math.sin(t * 83), shy = sh * Math.cos(t * 71);
    // Callout-Layout vorab (Richtungspfeile weichen aus)
    const chevOn = ["moving_up", "moving_down", "all_ropes_snap", "overspeed", "runaway_up", "safety_engage", "on_buffer", "stopped"].includes(o.state);
    let chev = null;
    if (chevOn && o.focus !== "full") { const [cx] = toS(G.S1 + 44, M.carY - G.CH / 2); chev = { x0: cx - 14 * C.s, x1: cx + 14 * C.s }; }
    const lay = layoutCallouts(ctx, L, G, o, M, T, toS, R, col, chev);
    const hk = T.hlAt == null ? 1 : smooth((t - T.hlAt) / 0.5), base = o.hl.size ? 1 - 0.45 * hk : 1;
    const world = (g) => { g.translate(C.scx + shx, C.scy + shy); g.scale(C.s, C.s); g.translate(-C.cx, -C.cy); };
    ctx.save(); world(ctx);
    drawStructure(ctx, L, G, o, sty, t, base);
    drawAmbient(ctx, G, t, o.hl.size ? 1 - 0.4 * hk : 1);
    drawLimit(ctx, L, G, M, T, t);
    drawAir(ctx, G, o, M, T, t);
    drawPassThrough(ctx, L, G, o, T, t);
    drawRails(ctx, L, G, sty, M);
    drawBuffers(ctx, L, G, o, sty, M);
    drawGovernor(ctx, L, G, o, sty, M, t);
    drawCounterweight(ctx, L, G, sty, M, t);
    drawMachine(ctx, L, G, o, sty, M, t);
    drawCircuit(ctx, L, G, o, sty, M, t);
    drawRopes(ctx, L, G, o, sty, M, T, t);
    drawCoil(ctx, L, G, o, sty, M, T, t);
    drawCar(ctx, L, G, o, sty, M, T, t);
    drawDebris(ctx, L, G, o, M, T, t);
    frictionSparks(ctx, G, M, t);
    drawEscape(ctx, G, o, M, T, t);
    drawDirection(ctx, L, G, M, t, lay.chevSide, lay.chevFade);
    drawHalos(ctx, G, o, M, T, t, C.s);
    if (M.landed && M.impactAge < 0.7) { const f = 1 - M.impactAge / 0.7; L.glowDot(ctx, G.carCX, G.PB - 20, 60 + 90 * f, COL.red, 0.8 * f); L.glowDot(ctx, G.carCX, G.PB - 20, 20 + 30 * f, "#ffffff", 0.7 * f); burst(ctx, G.carX0 + 6, M.carY + 12, M.impactAge, 91, 14, COL.amber); burst(ctx, G.carX1 - 6, M.carY + 12, M.impactAge, 57, 14, COL.amber); }
    ctx.restore();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (M.frozen && M.frozenAge < 0.6) fill(ctx, (c) => c.rect(0, 0, p.W, p.H), "#dff6ff", 0.22 * Math.exp(-M.frozenAge * 7));
    drawScreenLabels(ctx, L, G, o, M, toS, t, lay.items.filter((it) => it.box && t >= it.start).map((it) => it.box));
    if (col) for (const row of col.rows) {
      if (row.k === "hud") { if (M.speedPanel) drawSpeedPanel(ctx, L, o, M, t, row.y, T); else drawRopePanel(ctx, L, o, M, t, row.y, T); }
      else if (row.k === "sw") drawStopwatch(ctx, L, o, M, T, t, row.y);
      else drawReadout(ctx, L, o, M, T, t, o.readouts[row.i], T.roAt[row.i], row.y);
    }
    if (o.ruler) drawRuler(ctx, L, G, o, M, T, t, toS);
    if (o.safetyFactor) drawFactorChip(ctx, L, G, o, M, T, t, toS);
    if (M.frozen && o.freezeIcon) { const [qx, qy] = toS(G.carX1 + 34, M.carY - G.CH); const a = smooth(M.frozenAge / 0.3) * (0.7 + 0.3 * Math.sin(t * 3)); fill(ctx, (c) => { c.rect(qx, qy, 7, 24); c.rect(qx + 13, qy, 7, 24); }, COL.cyan, a); stroke(ctx, (c) => c.arc(qx + 10, qy + 12, 22, 0, TAU), COL.cyan, 1.5, 0.6 * a); }
    drawLoupe(ctx, L, G, o, sty, M, T, t, toS);
    drawCallouts(ctx, L, o, lay, t);
    drawMarkers(ctx, L, G, o, M, T, t, toS, R);
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
