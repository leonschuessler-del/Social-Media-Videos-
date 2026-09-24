/* rope_macro – Makro-Nahaufnahme eines Stahldrahtseils (Tragseil) im Röntgen-/Blueprint-Stil.
   Seilmodell: 8 Litzen (8 × 19 Seale, Kreuzschlag) auf Fasereinlage – die Litzen sind echte Helices,
   die Außendrähte laufen gegenläufig (an der Litzenkrone nahezu achsparallel, wie beim Kreuzschlag).
   PARAMS (alle optional)
     broken_wires   int 0..24 (Default 0) – Drahtbrüche: rote Drahtenden springen nacheinander (links -> rechts) mit Funken heraus
     breaks         Array Sekunden | [{at}] – Zeitpunkte der einzelnen Brüche (Anzahl = Länge, wenn broken_wires fehlt); Alias break_times
     initial_breaks int (0) – so viele Brüche sind bei Szenenstart schon da (ohne Animation), z. B. Anschluss an die Vorszene
     tension_glow   0..1 (0,3) – Amber-Spannungsglühen, das in Pulsen am Seil entlangläuft
     label          string | {text, at} – Callout am Bruch; label_at (s)
     inspection     bool (Default: broken_wires > 0) – Prüf-Lupe fährt am Seil entlang und zählt Drahtbrüche (rote Prüfringe)
     count_label    string ("Drahtbrüche") – Beschriftung der Zähleranzeige über der Lupe
     count_display  "number" | "gauge" | "ticks" | "none" – number = Ziffer (Default); gauge = Füllbalken OHNE Zahl;
                    ticks = Strichliste ohne Zahl; none = nur Beschriftung + Zähl-Blinklicht. Jeder Zählschritt pulsiert.
                    show_count:false => gauge (wenn threshold oder stamp gesetzt), sonst none.
     threshold      true | Zahl | string | {label ("Grenzwert"), value, show_value (false), at} – abstrakte Grenzmarke auf
                    Balken/Strichliste (bei number: dünner Balken unter der Ziffer). value = Bruchzahl der Grenze
                    (Default: alle Brüche -> Grenze wird genau mit dem letzten Zählschritt erreicht). Wert nur mit show_value.
     stamp          string | true ("AUSTAUSCHEN") | {text, sub, at, color} – Stempel knallt auf das Seil; stamp_sub (Unterzeile),
                    stamp_color "red" (Default) | "green" | "amber" | "cyan" | #rrggbb
     stamp_at       Sekunden | "threshold" (Default) – threshold: 0,35 s nachdem der Zähler die Grenze erreicht (ohne Lupe:
                    0,5 s nach dem letzten Bruch). stamp_count N = wenn N Brüche gezählt sind. Grenze nie erreicht -> kein Stempel.
     carry          {d, camera, params} – ANSCHLUSS an die vorherige rope_macro-Szene (Aliase continue_from, from_prev):
                    params = deren params (1:1 kopiert), d = deren Dauer, camera = deren Kamera. Die Vorszene wird mit
                    derselben Rechnung bis zu ihrem Ende nachgerechnet und über beide Kameras (Vorszene u = 1, diese u = 0)
                    auf den Szenenstart abgebildet: dieselben Brüche an denselben Bildstellen (gleiches Aussehen, Prüfringe
                    bleiben), Litzenmuster phasengleich, Lupe offen an ihrer Parkstelle, Anzeige in ihrer Form; die Anzeige
                    wird danach (kurz vor dem ersten neuen Zählschritt bzw. der Grenzmarke) zur eigenen Form umgebaut.
                    broken_wires = Gesamtzahl (vorhandene + neue). Neue Brüche liegen in Scanrichtung vor der Lupe, 1–3 davon
                    im Kern der End-Lupe, keine Flächenbrüche auf der Achse, wo der Stempel landet (bei Platzmangel weniger).
                    Tipp: Kamera mit ähnlicher Startskala wählen (Ende pan_* 1,08 -> slow_pull_out 1,1), dann gibt es beim
                    Überblenden praktisch kein Doppelbild.
     initial_counted bool – vorhandene Brüche sind schon gezählt (Ring ab t = 0, Anzeige startet damit); carry: aus der Vorszene
     lens_open_at_start bool – Lupe ist bei t = 0 schon offen (carry: automatisch); ohne Startlage am letzten vorhandenen Bruch
     lens_start_x   Bildschirm-x – Startlage der Lupe; scan_dir "left" | "right" (Default: zur Seite der ungezählten Brüche)
     orientation    "diagonal" | "horizontal" (Default diagonal), angle (Grad -22..8, überschreibt)
     speed          px/s (12) – Seillauf; diameter_mm (10), spec ("8 × 19 Seale · Fasereinlage"), dimension (true)
   BEATS  params.beats = Sekunden ab Szenenstart (auf [0,3 ; d-0,3] geklemmt, null/fehlend = Default):
     [0] = erster Drahtbruch, [1] = letzter Drahtbruch (dazwischen gleichmäßig), [2] = Lupe beginnt zu scannen (öffnet ~0,4 s vorher),
     [3] = Lupe am Ziel = Zählung abgeschlossen, [4] = Callout (label), [5] = Stempel
     (mit carry: [0]/[1] gelten für die NEUEN Brüche, [2] = die schon offene Lupe fährt los)
   "at" (s) akzeptieren: breaks[i] bzw. breaks[i].at, label.at / label_at, stamp.at / stamp_at, threshold.at / threshold_at
     (Grenzmarke erscheint), scan_start / scan_end (= beats[2]/[3]).
   Ohne beats/at: Brüche 0,08–0,42·d, Lupe öffnet 0,12·d und scannt 0,2–0,62·d; Callout 0,52·d (bei verdeckter Zahl nach der
     Zählung, ohne Lupe 0,35 s nach dem letzten Bruch). Ein gesetzter Stempelzeitpunkt verkürzt den Scan, damit die Zählung vorher endet.
   Endlage der Lupe: Skalenring (RL+29) nach Kamera (p.scene.camera) über dem Untertitelbereich (y ≤ 908) und ≥ 95 px vom Rand.
   CE.debugRopeMacro(params, d, t, camera) liefert Zeitplan, Zählzeiten und Bildlagen (nur lesend, für die Wort-Synchronisation). */
(function () {
  "use strict";
  const CE = window.CE;
  if (!CE || typeof CE.register !== "function") return;

  const TAU = Math.PI * 2, HALF = Math.PI / 2;
  // ---- Seilgeometrie (px): Ø 300 px ≙ Nenndurchmesser ----
  const RR = 150;                       // Seilradius
  const NS = 8;                         // Litzen
  const RS = 41;                        // Litzenradius (d_Litze ≈ 0,27 d)
  const RP = RR - RS;                   // Teilkreisradius der Litzenmitten
  const RSD = 38.8;                     // gezeichnete Litzen-Halbbreite: halber projizierter Litzenabstand -> Nachbarlitzen berühren sich exakt
  const LAY = 1740;                     // Seilschlaglänge ≈ 5,8 d
  const TH1 = TAU / LAY;                // dθ/ds
  const A = RP * TH1;                   // Steigung der projizierten Litzenachse
  const KB = Math.sqrt(1 + A * A);
  const NW = 9;                         // Außendrähte je Litze (Seale 1-9-9)
  const RW = 30;                        // Radius der Außendrahtmitten in der Litze
  const LAT = LAY / NS;                 // Raster der Litzenkronen entlang der Achse
  // Kreuzschlag: Drähte an der Krone ≈ achsparallel (≈ 0,9·KB·TH1·(RP+RW)/RW); exakt so gewählt,
  // dass das Muster mit LAT periodisch ist (Draht j -> j+5) – erlaubt ein gecachtes, verschiebbares Seilbild.
  const PSI1 = (5 * TAU) / (NW * LAT);
  const HH = RR + 58;                   // halbe Höhe des Streifens (inkl. Halo)
  const PIECE = 0.3, DELTA = 0.45;      // Zerlegung der Litzenbänder für Tiefensortierung
  const ZOOM = 1.2, RL = 250;           // Prüf-Lupe
  const RED = "#ff5a5f";

  // ---------- kleine Helfer ----------
  const num = (v, d) => { const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v); return Number.isFinite(n) ? n : d; };
  const pick = (o, keys, d) => { if (o && typeof o === "object") for (const k of keys) { const v = o[k]; if (v !== undefined && v !== null && v !== "") return v; } return d; };
  const bool = (v, d) => { if (v === undefined || v === null || v === "") return d; if (typeof v === "string") return !/^(false|0|no|nein|off|aus|none)$/i.test(v.trim()); return !!v; };
  const deNum = (x) => String(Math.round(x * 10) / 10).replace(".", ",");
  const L_lerp = (a, b, t) => a + (b - a) * t;
  const H = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const str = (v) => (typeof v === "string" || typeof v === "number" ? String(v).trim() : "");
  /** Zeitangabe (Sekunden) aus Zahl, "1,5" oder {at}; sonst null. */
  const tNum = (v) => {
    if (isObj(v)) v = pick(v, ["at", "t", "time", "start"], null);
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    const n = num(v, NaN); return Number.isFinite(n) ? n : null;
  };
  const list = (v) => (Array.isArray(v) ? v : typeof v === "number" ? [v] : typeof v === "string" ? v.split(/[;\s|]+/).filter(Boolean) : []);

  function parseParams(pr, depth = 0) {
    const bArr = [pr.breaks, pr.break_times, pr.breakTimes, pr.breaks_at].find((v) => Array.isArray(v)) || [];
    const breakTimes = bArr.map(tNum).filter((x) => x !== null);
    const nbRaw = pick(pr, ["broken_wires", "brokenWires", "broken", "wire_breaks", "drahtbrueche", "drahtbrüche"], Array.isArray(pr.breaks) ? undefined : pr.breaks);
    let nb = nbRaw === undefined ? bArr.length : Math.round(num(nbRaw, 0));
    nb = Math.max(0, Math.min(24, nb));
    const initBreaks = Math.max(0, Math.min(nb, Math.round(num(pick(pr, ["initial_breaks", "initialBreaks", "breaks_initial", "preexisting", "existing_breaks"], 0), 0))));
    const beats = list(pick(pr, ["beats", "beat", "takte"], [])).map(tNum);
    const tg = Math.max(0, Math.min(1, num(pick(pr, ["tension_glow", "tensionGlow", "tension", "stress", "glow"], 0.3), 0.3)));
    const labelRaw = pick(pr, ["label", "callout", "callout_text"], "");
    const label = isObj(labelRaw) ? str(pick(labelRaw, ["text", "label", "title"], "")) : str(labelRaw);
    const labelAt = tNum(pick(pr, ["label_at", "labelAt", "callout_at"], isObj(labelRaw) ? labelRaw.at : null));
    const insp = bool(pick(pr, ["inspection", "inspect", "magnifier", "lens", "lupe"], undefined), nb > 0);
    const orient = String(pick(pr, ["orientation", "direction", "layout"], "diagonal")).toLowerCase();
    const angRaw = pick(pr, ["angle", "angle_deg", "rotation"], undefined);
    let angle = angRaw === undefined ? (orient.startsWith("h") ? 0 : -10) : num(angRaw, -10);
    angle = Math.max(-22, Math.min(8, angle)); // fallendes Seil nur leicht (sonst Konflikt mit Textfeld oben links)
    const speed = Math.max(-40, Math.min(40, num(pick(pr, ["speed", "scroll_speed", "rope_speed"], 12), 12)));
    const diameter = Math.max(1, num(pick(pr, ["diameter_mm", "diameter", "d_mm"], 10), 10));
    const specRaw = pick(pr, ["spec", "construction", "rope_type"], "8 × 19 Seale · Fasereinlage");
    const spec = typeof specRaw === "string" ? specRaw : "";
    const showDim = bool(pick(pr, ["dimension", "show_dimension", "dim"], undefined), true);
    const countLabel = str(pick(pr, ["count_label", "counter_label", "countLabel"], "Drahtbrüche")) || "Drahtbrüche";
    // Stempel
    const stRaw = pick(pr, ["stamp", "stempel"], undefined);
    let stamp = "", stampSub = "", stampAtRaw = pick(pr, ["stamp_at", "stampAt", "stempel_at"], undefined);
    if (isObj(stRaw)) { stamp = str(pick(stRaw, ["text", "label", "title"], "AUSTAUSCHEN")); stampSub = str(pick(stRaw, ["sub", "subtitle", "subline"], "")); if (stampAtRaw === undefined) stampAtRaw = pick(stRaw, ["at", "t"], undefined); }
    else if (stRaw === true) stamp = "AUSTAUSCHEN";
    else if (stRaw !== false && stRaw !== undefined && !/^(false|0|no|nein|off|aus|none)$/i.test(str(stRaw))) stamp = str(stRaw);
    stampSub = str(pick(pr, ["stamp_sub", "stampSub", "stamp_subtitle"], stampSub));
    const scRaw = String(pick(pr, ["stamp_color", "stampColor"], isObj(stRaw) ? pick(stRaw, ["color"], "red") : "red")).toLowerCase();
    const stampCol = /^#[0-9a-f]{6}$/.test(scRaw) ? scRaw : /gr(ü|ue|u)n|green/.test(scRaw) ? "#5be49b" : /amber|gelb|orange|yellow/.test(scRaw) ? "#ffb347" : /cyan|blau|blue/.test(scRaw) ? "#3fd2ff" : RED;
    const stampAtWord = typeof stampAtRaw === "string" && /[a-zäöü]/i.test(stampAtRaw);
    let stampCountRaw = pick(pr, ["stamp_count", "stampCount", "stamp_after_count"], undefined);
    if (stampCountRaw === undefined && isObj(stampAtRaw) && stampAtRaw.count != null) stampCountRaw = stampAtRaw.count;
    if (stampCountRaw === undefined && stampAtWord && /\d/.test(stampAtRaw)) stampCountRaw = stampAtRaw.replace(/\D+/g, " ").trim().split(" ")[0];
    const stampAt = stampAtWord || (isObj(stampAtRaw) && stampAtRaw.at == null) ? null : tNum(stampAtRaw);
    const stampCount = stampCountRaw === undefined ? null : Math.max(1, Math.round(num(stampCountRaw, 1)));
    // Grenzwert
    const thRaw = pick(pr, ["threshold", "limit", "grenzwert", "grenze"], undefined);
    let thr = null;
    if (thRaw !== undefined && thRaw !== false && !/^(false|0|no|nein|off|aus|none)$/i.test(str(thRaw) || "x")) {
      thr = { label: "Grenzwert", value: null, showValue: false, at: null };
      if (isObj(thRaw)) {
        thr.label = str(pick(thRaw, ["label", "text", "title"], "Grenzwert")) || "Grenzwert";
        const v = pick(thRaw, ["value", "count", "n"], null); thr.value = v === null ? null : Math.max(1, Math.round(num(v, 1)));
        thr.showValue = bool(pick(thRaw, ["show_value", "showValue"], undefined), false);
        thr.at = tNum(pick(thRaw, ["at", "t"], null));
      } else if (typeof thRaw === "number" || (typeof thRaw === "string" && /^\s*\d+\s*$/.test(thRaw))) thr.value = Math.max(1, Math.round(num(thRaw, 1)));
      else if (typeof thRaw === "string") thr.label = thRaw.trim();
      thr.label = str(pick(pr, ["threshold_label", "limit_label"], thr.label)) || "Grenzwert";
      const ta = tNum(pick(pr, ["threshold_at", "thresholdAt", "limit_at"], null)); if (ta !== null) thr.at = ta;
      thr.showValue = bool(pick(pr, ["threshold_show_value", "show_threshold_value"], undefined), thr.showValue);
    }
    // Zähleranzeige
    const showCount = bool(pick(pr, ["show_count", "showCount", "show_number"], undefined), true);
    let disp = String(pick(pr, ["count_display", "countDisplay", "counter_display", "count_mode", "counter"], "")).toLowerCase();
    disp = /gauge|bar|balken|fill/.test(disp) ? "gauge" : /tick|strich|tally/.test(disp) ? "ticks" : /none|off|hide|label|aus/.test(disp) ? "none" : /num|zahl|digit/.test(disp) ? "number" : "";
    if (!disp) disp = showCount ? "number" : thr || stamp ? "gauge" : "none";
    const scanStart = tNum(pick(pr, ["scan_start", "scanStart", "lens_at", "inspection_at"], null));
    const scanEnd = tNum(pick(pr, ["scan_end", "scanEnd", "count_end"], null));
    const breaksStart = tNum(pick(pr, ["breaks_start", "breaksStart"], null)), breaksEnd = tNum(pick(pr, ["breaks_end", "breaksEnd"], null));
    // Anschluss an die Vorszene (carry = Parameter + Dauer + Kamera der vorherigen rope_macro-Szene)
    let carry = null;
    const cRaw = depth ? undefined : pick(pr, ["carry", "continue_from", "from_prev", "prev_scene"], undefined);
    if (isObj(cRaw)) {
      const cp = isObj(cRaw.params) ? cRaw.params : cRaw;
      const cd = num(pick(cRaw, ["d", "duration", "dur"], NaN), NaN);
      if (Number.isFinite(cd) && cd >= 0.5) carry = { params: cp, d: Math.min(60, cd), camera: str(pick(cRaw, ["camera", "cam"], "")) || "static", focus: Array.isArray(cRaw.focus) ? cRaw.focus : Array.isArray(cp.focus) ? cp.focus : null };
    }
    const tri = (keys) => { const v = pick(pr, keys, undefined); return v === undefined ? null : bool(v, null); };
    const initialCounted = tri(["initial_counted", "initialCounted", "precounted", "initial_breaks_counted"]);
    const lensOpenStart = tri(["lens_open_at_start", "lensOpenAtStart", "lens_open_start", "lens_open"]);
    const lsx = num(pick(pr, ["lens_start_x", "lensStartX", "lens_x"], NaN), NaN);
    const lensStartX = Number.isFinite(lsx) ? Math.max(200, Math.min(1720, lsx)) : null;
    const sd = String(pick(pr, ["scan_dir", "scanDir", "scan_direction"], "")).toLowerCase().trim();
    const scanDir = /^(l|left|links|-1|back|rück|rueck)/.test(sd) ? -1 : /^(r|right|rechts|1|\+1|fwd|forward|vor)/.test(sd) ? 1 : 0;
    return { nb, tg, label, labelAt, insp, angle, speed, diameter, spec, showDim, countLabel, breakTimes, initBreaks, beats,
      stamp, stampSub, stampCol, stampAt, stampCount, thr, disp, scanStart, scanEnd, breaksStart, breaksEnd,
      carry, initialCounted, lensOpenStart, lensStartX, scanDir };
  }

  // Seil-Koordinaten (u entlang der Achse, y quer) -> Bildschirm
  const toScreen = (S, u, y) => [S.CX + u * S.ca - y * S.sa, S.CY + u * S.sa + y * S.ca];
  const ropeTransform = (ctx, S) => { ctx.translate(S.CX, S.CY); ctx.rotate(S.ang); };
  // Kamera (Spiegel von cameraTransform in engine.js): Welt -> Bild = o + s·(p − c)
  function camOf(name, u, focus, L) {
    const e = L.easeInOut(L.clamp(num(u, 0)));
    const fx = num(focus && focus[0] != null ? focus[0] : 0.5, 0.5), fy = num(focus && focus[1] != null ? focus[1] : 0.5, 0.5);
    const cx = fx * 1920, cy = fy * 1080;
    let s = 1, dx = 0, dy = 0;
    switch (name) {
      case "slow_push_in": s = L.lerp(1.0, 1.1, e); break;
      case "slow_pull_out": s = L.lerp(1.1, 1.0, e); break;
      case "pan_left": s = 1.08; dx = L.lerp(60, -60, e); break;
      case "pan_right": s = 1.08; dx = L.lerp(-60, 60, e); break;
      case "tilt_down": s = 1.08; dy = L.lerp(45, -45, e); break;
      case "tilt_up": s = 1.08; dy = L.lerp(-45, 45, e); break;
      default: break;
    }
    return { s, cx, cy, ox: cx + dx, oy: cy + dy };
  }
  const camFwd = (c, x, y) => [c.ox + c.s * (x - c.cx), c.oy + c.s * (y - c.cy)];
  const camInv = (c, X, Y) => [c.cx + (X - c.ox) / c.s, c.cy + (Y - c.oy) / c.s];

  // ---------- Drahtbrüche: Positionen auf Litzenkronen ----------
  const TYPE_TH = { top: -HALF, bottom: HALF, face: 0, up45: -Math.PI / 4, lo45: Math.PI / 4, up22: -Math.PI / 8, lo22: Math.PI / 8 };

  // ---------- Zeitplan (Beats / at) ----------
  function timing(S) {
    const d = S.d, B = S.beats;
    const cl = (x) => Math.max(0.3, Math.min(d - 0.3, x));
    const bt = (i, alt) => (B[i] != null ? cl(B[i]) : alt != null ? cl(alt) : null);
    const T = { cl };
    T.bS = bt(0, S.breaksStart) ?? cl(0.08 * d);
    T.bE = bt(1, S.breaksEnd) ?? Math.max(T.bS, cl(0.42 * d));
    if (T.bE < T.bS) T.bE = T.bS;
    T.bExplicit = B[0] != null || S.breaksStart != null;
    T.tS = bt(2, S.scanStart) ?? cl(0.2 * d);
    const tEx = bt(3, S.scanEnd);
    T.tE = tEx ?? Math.max(cl(0.62 * d), Math.min(d - 0.3, T.tS + 0.6));
    if (T.tE < T.tS + 0.3) T.tE = Math.min(d - 0.05, T.tS + 0.6);
    T.labelAt = bt(4, S.labelAt);
    T.stampAt = bt(5, S.stampAt);
    // gesetzter Stempelzeitpunkt: Scan (falls nicht explizit) so kürzen, dass die Zählung vorher fertig ist
    if (tEx == null && T.stampAt != null && S.insp) T.tE = Math.max(T.tS + 0.6, Math.min(T.tE, T.stampAt - 0.4));
    const scanSet = B[2] != null || S.scanStart != null;
    T.openS = scanSet ? Math.max(0.1, T.tS - 0.45) : Math.min(0.12 * d, Math.max(0.1, T.tS - 0.3));
    T.openD = scanSet ? Math.max(0.25, Math.min(0.45, T.tS - T.openS + 0.1)) : Math.max(0.3, Math.min(0.5, 0.08 * d));
    if (S.lensOpenStart) { T.openS = -1; T.openD = 0.3; } // Anschluss: Lupe ist schon offen
    return T;
  }

  function buildBreaks(S) {
    if (S.carryI && (S.carryI.breaks.length || S.lensStartU != null)) return buildCarryBreaks(S);
    const n = S.nb; const d = S.d;
    const out = { list: [], sFirst: 0, sLast: 0 };
    if (!n) return out;
    const cols = n <= 3 ? n : 4;
    // letzte Spalte (dort parkt die Lupe) unten, davor abwechselnd oben/unten; Einzelbruch oben
    const order = [["bottom", "top", "face", "lo45", "up45"], ["top", "bottom", "face", "up45", "lo45"]];
    const slots = [];
    for (let pass = 0; pass < 5 && slots.length < n; pass++) for (let c = 0; c < cols && slots.length < n; c++) slots.push({ col: c, type: n === 1 ? "top" : order[(cols - 1 - c) % 2][pass] });
    for (let pass = 0; pass < 2 && slots.length < n; pass++) for (let c = 0; c < cols - 1 && slots.length < n; c++) slots.push({ col: c + 0.5, type: pass ? "lo22" : "up22" });
    const span = (cols - 1) * LAT;
    const tS = S.tim.tS, tE = S.tim.tE;
    let uF = 60 - span / 2 - S.v * (tE - tS);
    const lo = -330, hi = 430 - span - S.v * (d - tS);
    uF = Math.max(lo, Math.min(uF, Math.max(lo, hi)));
    const iBase = Math.round((uF - S.v * tS) / LAT);
    slots.forEach((sl, i) => {
      const jit = (H(i * 7.3 + 1.1) - 0.5) * 44;
      const th = TYPE_TH[sl.type] + TH1 * jit;
      const edge = sl.type === "top" || sl.type === "bottom";
      const y0 = RR * Math.sin(th) * (edge ? 0.985 : 1);
      const dir = Math.sin(TYPE_TH[sl.type]) > 0 ? 1 : -1;
      out.list.push({ s: (iBase + sl.col) * LAT + jit, y0, dir, edge, face: !edge, type: sl.type, lenA: 26 + 10 * H(i * 3.7 + 2), lenB: 20 + 10 * H(i * 5.1 + 3), seed: 11 + i * 17 });
    });
    out.list.sort((a, b) => a.s - b.s);
    const m = out.list.length, T = S.tim, n0 = S.initBreaks, m2 = m - n0;
    // Zeitpunkte: vorhandene Brüche zuerst (links), dann gleichmäßig zwischen beats[0] und beats[1] bzw. explizit (breaks[i].at)
    const times = [];
    for (let k = 0; k < m2; k++) {
      const ex = S.breakTimes[k];
      if (ex != null) times.push(T.cl(ex));
      else if (m2 === 1 && !T.bExplicit) times.push(T.cl(0.14 * d));
      else times.push(m2 > 1 ? L_lerp(T.bS, T.bE, k / (m2 - 1)) : T.bS);
    }
    times.sort((a, b) => a - b);
    out.list.forEach((b, j) => { b.ta = j < n0 ? -10 : times[j - n0]; b.pre = j < n0; b.counted = b.pre && !!S.initialCounted; });
    out.sFirst = out.list[0].s; out.sLast = out.list[m - 1].s;
    return out;
  }

  // Anschluss: vorhandene Brüche exakt aus der Vorszene (Lage, Typ, Aussehen), neue Brüche in freie Litzenkronen
  // in Scanrichtung der Lupe (weit gestreut, nicht unter dem Lupenrand, Achse beim Stempel frei)
  function buildCarryBreaks(S) {
    const CI = S.carryI, T = S.tim, d = S.d, L = S.L;
    const out = { list: [], sFirst: 0, sLast: 0, dir: 1 };
    const old = CI.breaks.slice(0, 24).map((b) => Object.assign({}, b, { s: b.s - S.scroll0, ta: -10, pre: true, counted: S.initialCounted == null ? !!b.counted : !!S.initialCounted }));
    const need = Math.max(0, Math.min(24, S.nb) - old.length);
    // sichtbarer Bereich (Material-Koordinaten) bei Szenenstart und -ende, Kamera beachtet
    const range = (tt) => { const c = camOf(S.cam, tt / d, S.focus, L); const a = camInv(c, 250, S.CY), b = camInv(c, 1670, S.CY); return [(a[0] - S.CX) / S.ca - S.v * tt - S.scroll0, (b[0] - S.CX) / S.ca - S.v * tt - S.scroll0]; };
    const r0 = range(0), r1 = range(d);
    const sLo = Math.max(r0[0], r1[0]), sHi = Math.min(r0[1], r1[1]);
    const lu = S.lensStartU, ly = S.lensStartY || 0;
    let dir = S.scanDir;
    if (!dir) dir = lu == null ? 1 : lu - sLo > sHi - lu ? -1 : 1;
    out.dir = dir;
    const os = old.map((b) => b.s), oMin = os.length ? Math.min(...os) : Infinity, oMax = os.length ? Math.max(...os) : -Infinity;
    // Spalten (halbe Kronenteilung) in Scanrichtung; je Spalte die zulässigen Bruchlagen
    const mk = (k, type) => {
      const i = 40 + Math.round(k * 2 + 200) * 7 + ["top", "bottom", "face", "up45", "lo45", "up22", "lo22"].indexOf(type);
      const jit = (H(i * 7.3 + 1.1) - 0.5) * 44, edge = type === "top" || type === "bottom";
      const th = TYPE_TH[type] + TH1 * jit;
      return { s: k * LAT + jit, y0: RR * Math.sin(th) * (edge ? 0.985 : 1), dir: Math.sin(TYPE_TH[type]) > 0 ? 1 : -1, edge, face: !edge, type,
        lenA: 26 + 10 * H(i * 3.7 + 2), lenB: 20 + 10 * H(i * 5.1 + 3), seed: 11 + i * 17, pre: false, counted: false };
    };
    const gap = (c, arr) => { let md = Infinity; for (const o of arr) md = Math.min(md, Math.hypot(c.s - o.s, 0.7 * (c.y0 - o.y0))); return md; };
    // Ziel der Lupe am Scan-Ende: fernes Ende des freien Bereichs, Lupe samt Skala (nach Kamera) im Bild
    const lensOk = (m, tt) => { const c = camOf(S.cam, tt / d, S.focus, L), [X] = camFwd(c, ...toScreen(S, m + S.v * tt + S.scroll0, 0)), rr = (RL + 29) * c.s; return X - rr >= 100 && X + rr <= 1820; };
    let mEnd = dir < 0 ? sLo + 70 : sHi - 70;
    for (let q = 0; q < 250 && !(lensOk(mEnd, T.tE) && lensOk(mEnd, d)); q++) mEnd -= dir * 8;
    if (lu != null && (mEnd - lu) * dir < 60) mEnd = lu + dir * 60;
    out.mEnd = mEnd;
    // Lage zur End-Lupe: 1 = sicher innen, 2 = sicher außen, 0 = Rand (auch bei leicht versetzter Endlage)
    const endCls = (c) => { let r = -1; for (const [dm, dy] of [[0, 0], [-24, 20], [24, -20], [24, 20], [-24, -20]]) { const k = classify(c, mEnd + dm, dy); if (!k || (r > 0 && k !== r)) return 0; r = k; } return r; };
    const cols = [];
    for (let k = Math.ceil((2 * sLo) / LAT) / 2; k * LAT <= sHi + 1e-6; k += 0.5) {
      const half = Math.abs(k - Math.round(k)) > 0.25;
      for (const type of half ? ["up22", "lo22"] : ["top", "bottom", "face", "up45", "lo45"]) {
        const c = mk(k, type);
        if (c.s < sLo || c.s > sHi) continue;
        if (lu != null && (classify(c, lu, ly) === 0 || (c.s - lu) * dir < -150)) continue; // nicht unter dem Lupenrand, nicht hinter der Lupe
        if (gap(c, old) < 95) continue;
        c.zone = endCls(c); if (!c.zone) continue;
        c.axisOk = c.edge || !S.stamp || c.zone === 1 || (dir < 0 ? c.s < oMin - 40 : c.s > oMax + 40); // Achse beim Stempel frei halten
        let col = cols.find((q) => q.k === k && q.zone === c.zone);
        if (!col) cols.push((col = { k, zone: c.zone, opts: [] }));
        col.opts.push(c);
      }
    }
    cols.sort((p, q) => (p.k - q.k) * dir);
    // gewünschte Folge: Seiten wechseln, Tiefe variiert (Kante, Flanke, Mitte)
    const k0 = cols.length ? cols[0].k * LAT : 0;
    const nearOld = old.slice().sort((p, q) => Math.abs(p.s - k0) - Math.abs(q.s - k0))[0];
    const seqW = nearOld && nearOld.y0 < 0 ? ["bottom", "up", "top", "lo", "face"] : ["top", "lo", "bottom", "up", "face"];
    const Y = { top: -RR, bottom: RR, face: 0, up: -0.7 * RR, lo: 0.7 * RR };
    const picked = [];
    const take = (col, w, relax) => {
      const cand = col.opts.filter((c) => !c.used && (relax || c.axisOk) && gap(c, picked) >= (relax ? 70 : 95));
      if (!cand.length) return false;
      cand.sort((p, q) => (relax ? (p.axisOk ? 0 : 1000) - (q.axisOk ? 0 : 1000) : 0) + Math.abs(p.y0 - Y[w]) - Math.abs(q.y0 - Y[w]));
      cand[0].used = true; picked.push(cand[0]); col.n = (col.n || 0) + 1;
      return true;
    };
    const spread = (list, n) => { // n Spalten gleichmäßig verteilt, je Spalte ein Bruch
      if (n <= 0) return;
      if (list.length <= n) { for (const c of list) take(c, seqW[picked.length % 5], false); return; }
      for (let j = 0; j < n; j++) take(list[Math.round((n > 1 ? j / (n - 1) : 0) * (list.length - 1))], seqW[picked.length % 5], false);
    };
    // unterwegs (außerhalb der End-Lupe) und ein Nest von 1–3 Brüchen im Kern der End-Lupe
    const mid = cols.filter((c) => c.zone === 2), core = cols.filter((c) => c.zone === 1);
    const nCore = Math.min(core.length ? 3 : 0, need <= 2 ? 1 : need <= 4 ? 2 : 3);
    spread(mid, need - nCore);
    for (let pass = 0; pass < 4 && picked.length < need; pass++) {
      for (const col of pass < 2 ? core : cols) {
        if (picked.length >= need) break;
        if (pass % 2 === 0 && col.n) continue;
        take(col, seqW[picked.length % 5], pass === 3);
      }
    }
    // Zeitpunkte in Scanrichtung (der Lupe voraus)
    const seq = picked.sort((a, b) => (a.s - b.s) * dir), m2 = seq.length;
    const times = [];
    for (let k = 0; k < m2; k++) {
      const ex = S.breakTimes[k];
      times.push(ex != null ? T.cl(ex) : m2 > 1 ? L_lerp(T.bS, T.bE, k / (m2 - 1)) : T.bExplicit ? T.bS : T.cl(0.14 * d));
    }
    times.sort((a, b) => a - b);
    seq.forEach((b, j) => { b.ta = times[j]; });
    out.list = old.concat(seq).sort((a, b) => a.s - b.s);
    out.sFirst = out.list[0].s; out.sLast = out.list[out.list.length - 1].s;
    return out;
  }

  // ---------- Prüf-Lupe: Weg in Material-Koordinaten ----------
  // Sichtbarkeit eines Bruchs bei Lupen-Ruhelage (m, yL): 1 = vergrößert in der Lupe, 2 = außerhalb sichtbar, 0 = verdeckt
  function classify(b, m, yL) {
    const dx = b.s - m, dy = b.y0 + b.dir * 16 - yL;
    const dist = Math.hypot(dx, dy);
    if (ZOOM * (dist + 34) <= RL - 8) return 1;
    if (dist - 36 >= RL + 16) return 2;
    return 0;
  }
  function planLens(S, B) {
    const d = S.d, tS = S.tim.tS, tE = S.tim.tE, RH = S.readH || 62, L = S.L;
    const plan = { tS, tE, mS: 0, mE: 0, yE: 0, yS: 0, dir: 1 };
    let hasStart = S.lensStartU != null;
    if (hasStart) { plan.mS = S.lensStartU; plan.yS = S.lensStartY || 0; }
    if (!B.list.length) {
      if (hasStart) { plan.mE = plan.mS; plan.yE = plan.yS; plan.park = true; } else { plan.mS = -520 - S.v * tS; plan.mE = 220 - S.v * tE; }
      return plan;
    }
    const pre = B.list.filter((b) => b.pre);
    if (!hasStart && S.lensOpenStart && pre.length) { hasStart = true; plan.mS = pre[pre.length - 1].s; } // offen am letzten vorhandenen Bruch
    if (!hasStart) plan.mS = Math.max(B.sFirst - 300, -600 - S.v * tS);
    const todo = B.list.filter((b) => !b.counted), pool = todo.length ? todo : B.list;
    if (hasStart && !todo.length) { plan.mE = plan.mS; plan.yE = plan.yS; plan.park = true; return plan; } // nichts Neues zu zählen: Lupe bleibt stehen
    let dir = 1;
    if (hasStart) dir = B.dir || S.scanDir || (pool.reduce((a, b) => a + b.s, 0) / pool.length < plan.mS ? -1 : 1);
    plan.dir = dir;
    const last = dir > 0 ? pool[pool.length - 1] : pool[0];
    // Lupe zur Kante des letzten Bruchs versetzen (unten: bis 45 % der Kantenhöhe, oben weniger – Platz für die Anzeige darüber)
    const yOpts = (last.y0 > 0 ? [0.45, 0.32, 0.18, 0] : [0.24, 0.16, 0.08, 0]).map((k) => k * last.y0);
    let best = null, bestScore = Infinity;
    for (const yE of yOpts) {
      const g = B.mEnd != null, mA = g ? B.mEnd - 24 : dir > 0 ? last.s - 150 : last.s - 40, mB = g ? B.mEnd + 24 : dir > 0 ? last.s + 40 : last.s + 150;
      for (let m = mA; m <= mB; m += 4) {
        let score = Math.abs(m - (g ? B.mEnd : last.s)) + Math.abs(yE - yOpts[0]) * 0.6;
        for (const b of B.list) if (!classify(b, m, yE)) score += 10000;
        if (classify(last, m, yE) !== 1) score += 4000;
        // Anzeige über der Lupe muss passen; Lupe samt Skalenring (RL+29) nach Kamera weder im Untertitelbereich noch am Rand
        for (const tt of [tE, d]) {
          const [lx, ly] = toScreen(S, m + S.v * tt + S.scroll0, yE);
          if (ly - RL - 30 - RH < 208) score += 3000;
          const c = camOf(S.cam, tt / d, S.focus, L), [X, Y] = camFwd(c, lx, ly), rr = (RL + 29) * c.s;
          if (Y + rr > 908) score += 3000;
          if (X - rr < 95 || X + rr > 1825) score += 3000;
        }
        if (score < bestScore) { bestScore = score; best = [m, yE]; }
      }
    }
    plan.mE = dir > 0 ? Math.max(best[0], plan.mS + 60) : Math.min(best[0], plan.mS - 60); plan.yE = best[1];
    return plan;
  }
  const lensM = (L, plan, t) => L.lerp(plan.mS, plan.mE, L.easeInOut((t - plan.tS) / (plan.tE - plan.tS)));
  // Querlage der Lupe: vom Start-Versatz (Anschluss) zur Achse, spät zur Kante des Zielbruchs
  function lensY(S, L, t) {
    const P = S.plan; if (P.park) return P.yS;
    const late = P.yE * L.smooth(L.inv(P.tS + 0.55 * (P.tE - P.tS), P.tE, t));
    return P.yS ? late + P.yS * (1 - L.smooth(L.inv(P.tS, P.tS + 0.4 * (P.tE - P.tS), t))) : late;
  }
  function crossTime(L, plan, target) {
    if (plan.dir < 0) { // Lupe fährt nach links
      if (plan.mS <= target) return plan.tS;
      if (plan.mE > target) return Infinity;
      let a = 0, b = 1;
      for (let i = 0; i < 20; i++) { const q = (a + b) / 2; if (L.lerp(plan.mS, plan.mE, L.easeInOut(q)) > target) a = q; else b = q; }
      return plan.tS + b * (plan.tE - plan.tS);
    }
    if (plan.mS >= target) return plan.tS;
    if (plan.mE < target) return Infinity;
    let a = 0, b = 1;
    for (let i = 0; i < 20; i++) { const q = (a + b) / 2; if (L.lerp(plan.mS, plan.mE, L.easeInOut(q)) < target) a = q; else b = q; }
    return plan.tS + b * (plan.tE - plan.tS);
  }

  // ---------- Seil zeichnen (in Seil-Koordinaten; nur beim einmaligen Vorrendern) ----------

  function strandLayer(ctx, S, uMin, uMax) {
    const sc = S.scroll;
    const bandHalf = HALF + DELTA;
    const nPc = Math.ceil((2 * bandHalf) / PIECE), pw = (2 * bandHalf) / nPc;
    const pcs = [];
    for (let k = 0; k < NS; k++) {
      const phi = (TAU * k) / NS;
      const thA = (uMin - sc) * TH1 + phi, thB = (uMax - sc) * TH1 + phi;
      const m0 = Math.ceil((thA - bandHalf) / TAU), m1 = Math.floor((thB + bandHalf) / TAU);
      for (let m = m0; m <= m1; m++) {
        const c0 = TAU * m - bandHalf;
        for (let q = 0; q < nPc; q++) {
          const a0 = c0 + q * pw, a1 = a0 + pw;
          if (a1 < thA || a0 > thB) continue;
          const mid = (a0 + a1) / 2 - TAU * m;
          pcs.push({ phi, a0: Math.max(a0, thA), a1: Math.min(a1, thB), z: Math.cos(mid), sn: Math.abs(Math.sin(mid)) });
        }
      }
    }
    // Maler-Algorithmus in z-Ebenen: Stücke gleicher Tiefe überlappen sich praktisch nie (Nachbarlitzen liegen π/4
    // auseinander, gezeichnete Halbbreite = halber projizierter Abstand) -> je Ebene gebündelte Draw-Calls.
    const buckets = [[], [], []];
    const NL = 26, levels = Array.from({ length: NL }, () => []);
    for (const pc of pcs) levels[Math.max(0, Math.min(NL - 1, Math.floor(((pc.z + 0.62) / 1.63) * NL)))].push(pc);
    const cyan = S.C.cyan;
    const EXT = 0.005;
    const samp = (pc, a0, a1) => {
      const n = Math.max(2, Math.ceil((a1 - a0) / 0.06));
      const e1 = [], e2 = [], cl = [];
      for (let i = 0; i <= n; i++) {
        const th = a0 + ((a1 - a0) * i) / n;
        const u = (th - pc.phi) / TH1 + sc;
        const sn = Math.sin(th), c = Math.cos(th);
        const yc = RP * sn, sl = A * c, inv = 1 / Math.sqrt(1 + sl * sl);
        const nx = -sl * inv * RSD, ny = inv * RSD;
        e1.push(u + nx, yc + ny); e2.push(u - nx, yc - ny); cl.push(u, yc);
      }
      return { e1, e2, cl };
    };
    const poly = (arr, dy = 0) => { ctx.moveTo(arr[0], arr[1] + dy); for (let i = 2; i < arr.length; i += 2) ctx.lineTo(arr[i], arr[i + 1] + dy); };
    ctx.lineJoin = "round"; ctx.lineCap = "butt";
    for (const lv of levels) {
      if (!lv.length) continue;
      const z = lv.reduce((acc, pc) => acc + pc.z, 0) / lv.length;
      const fz = Math.max(0, z), sn = Math.sqrt(Math.max(0, 1 - z * z));
      const ext = lv.map((pc) => samp(pc, pc.a0 - EXT, pc.a1 + EXT));
      const ex = lv.map((pc) => samp(pc, pc.a0, pc.a1));
      // Körper
      ctx.beginPath();
      for (const g of ext) { const n = g.e1.length; poly(g.e1); for (let i = n - 2; i >= 0; i -= 2) ctx.lineTo(g.e2[i], g.e2[i + 1]); ctx.closePath(); }
      ctx.globalAlpha = 1; ctx.fillStyle = S.fillGrad; ctx.fill();
      if (z < 0) { ctx.globalAlpha = Math.min(0.55, -z * 0.8 + 0.18); ctx.fillStyle = "#020812"; ctx.fill(); }
      // Glanz auf der Litzenkrone (Röhren-Schattierung)
      ctx.beginPath(); for (const g of ex) poly(g.cl, -5);
      ctx.strokeStyle = "#6fd6ff"; ctx.globalAlpha = 0.07; ctx.lineWidth = RS * 0.55; ctx.stroke();
      // Tal zwischen den Litzen abdunkeln (Röhrenform)
      ctx.beginPath(); for (const g of ex) { poly(g.e1); poly(g.e2); }
      ctx.globalAlpha = 0.66; ctx.strokeStyle = "#020a16"; ctx.lineWidth = 16; ctx.stroke();
      // Außendrähte (Kreuzschlag) – Sichtbarkeit nach Flächennormale, 3 Helligkeitsstufen, als Polylinien
      if (z > -0.4) {
        buckets[0].length = buckets[1].length = buckets[2].length = 0;
        for (const pc of lv) {
          const a0 = pc.a0, a1 = pc.a1;
          const nw = Math.max(3, Math.ceil((a1 - a0) / 0.045));
          for (let j = 0; j < NW; j++) {
            const pj = (TAU * j) / NW; let cur = null, curB = -1;
            for (let i = 0; i <= nw; i++) {
              const th = a0 + ((a1 - a0) * i) / nw;
              const s0 = (th - pc.phi) / TH1;
              const psi = pj + PSI1 * s0;
              const snt = Math.sin(th), c = Math.cos(th), cp = Math.cos(psi), sp = Math.sin(psi);
              const nz = cp * c + (sp * snt) / KB;
              const x = s0 + sc + (RW * sp * A) / KB, y = RP * snt + RW * (cp * snt - (sp * c) / KB);
              const bk = nz > 0.62 ? 2 : nz > 0.38 ? 1 : nz > 0.16 ? 0 : -1;
              if (bk !== curB) {
                if (cur && bk >= 0 && curB >= 0) cur.push(x, y);
                cur = bk >= 0 ? [x, y] : null; if (cur) buckets[bk].push(cur); curB = bk;
              } else if (cur) cur.push(x, y);
            }
          }
        }
        const wa = [0.16, 0.34, 0.6];
        for (let q = 0; q < 3; q++) {
          const B2 = buckets[q]; if (!B2.length) continue;
          ctx.beginPath(); for (const pl of B2) if (pl.length >= 4) poly(pl);
          ctx.globalAlpha = wa[q]; ctx.strokeStyle = "#aeeaff"; ctx.lineWidth = q === 2 ? 1.7 : 1.4; ctx.stroke();
        }
      }
      // Litzenkanten (Röntgen-Kontur) – leicht überlappend, damit an den Stößen keine Lücken entstehen
      ctx.beginPath(); for (const g of ext) { poly(g.e1); poly(g.e2); }
      ctx.strokeStyle = cyan;
      ctx.globalAlpha = 0.1; ctx.lineWidth = 6.5; ctx.stroke();
      ctx.globalAlpha = z < 0 ? 0.55 : 0.5 + 0.45 * sn; ctx.lineWidth = 1.7; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Durchleuchtung: Rückseite der Litzen + Fasereinlage schwach sichtbar (Röntgen-Effekt)
  function xrayLayer(ctx, S, uMin, uMax) {
    const sc = S.scroll;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    for (let k = 0; k < NS; k++) {
      const phi = (TAU * k) / NS;
      const thA = (uMin - sc) * TH1 + phi, thB = (uMax - sc) * TH1 + phi;
      const m0 = Math.ceil((thA - 1.5 * Math.PI) / TAU), m1 = Math.floor((thB - HALF) / TAU);
      for (let m = m0; m <= m1; m++) {
        const a0 = Math.max(thA, TAU * m + HALF + 0.15), a1 = Math.min(thB, TAU * m + 1.5 * Math.PI - 0.15);
        if (a1 <= a0) continue;
        const n = Math.max(2, Math.ceil((a1 - a0) / 0.09));
        for (let side = -1; side <= 1; side += 2) {
          for (let i = 0; i <= n; i++) {
            const th = a0 + ((a1 - a0) * i) / n;
            const u = (th - phi) / TH1 + sc, c = Math.cos(th);
            const sl = A * c, inv = 1 / Math.sqrt(1 + sl * sl);
            const x = u - side * sl * inv * RS, y = RP * Math.sin(th) + side * inv * RS;
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
        }
      }
    }
    ctx.strokeStyle = "rgba(63,210,255,0.085)"; ctx.lineWidth = 1.4; ctx.stroke();
    // Fasereinlage (Kern)
    const rc = RP - RS;
    ctx.beginPath(); ctx.moveTo(uMin, -rc); ctx.lineTo(uMax, -rc); ctx.moveTo(uMin, rc); ctx.lineTo(uMax, rc);
    ctx.setLineDash([5, 9.5]); ctx.lineDashOffset = -sc;
    ctx.strokeStyle = "rgba(255,179,71,0.10)"; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  }

  function haloLayer(ctx, uMin, uMax) {
    const w = uMax - uMin, ext = HH - RR;
    const g = ctx.createLinearGradient(0, -HH, 0, HH);
    const f = ext / (2 * HH);
    g.addColorStop(0, "rgba(63,210,255,0)"); g.addColorStop(f, "rgba(63,210,255,0.11)");
    g.addColorStop(1 - f, "rgba(63,210,255,0.11)"); g.addColorStop(1, "rgba(63,210,255,0)");
    ctx.fillStyle = g; ctx.fillRect(uMin, -HH, w, 2 * HH);
    // dunkle Unterlage (deckt Gitter zwischen den Litzen ab)
    ctx.fillStyle = "#06101f"; ctx.fillRect(uMin, -RR + 12, w, 2 * RR - 24);
  }

  function amberHaloLayer(ctx, uMin, uMax, k) {
    if (k <= 0) return;
    const ext = HH - RR + 10;
    for (let side = -1; side <= 1; side += 2) {
      const y0 = side * (RR - 6), y1 = side * (RR + ext);
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, `rgba(255,179,71,${k.toFixed(3)})`); g.addColorStop(0.35, `rgba(255,170,60,${(0.45 * k).toFixed(3)})`); g.addColorStop(1, "rgba(255,179,71,0)");
      ctx.fillStyle = g; ctx.fillRect(uMin, Math.min(y0, y1), uMax - uMin, Math.abs(y1 - y0));
    }
  }

  // ---------- Vorgerenderte Ebenen (einmal pro Neigung/Spannung; pro Frame nur ganzzahlig verschoben) ----------
  // Gedrehtes drawImage kostet in Software-Rastern > 20 ms, ganzzahliges Blitten < 1 ms.
  // Das Seil wird in senkrechte Kacheln mit enger Höhe zerlegt, damit kaum transparente Fläche geblittet wird.
  const mkCanvas = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

  function paintRope(c, S, uA, uB, amberK) {
    const fg = c.createLinearGradient(0, -RR, 0, RR);
    fg.addColorStop(0, "#06142a"); fg.addColorStop(0.3, "#0d2c4c"); fg.addColorStop(0.5, "#113456"); fg.addColorStop(0.75, "#0b2644"); fg.addColorStop(1, "#051226");
    const S0 = { scroll: 0, fillGrad: fg, C: S.C };
    amberHaloLayer(c, uA, uB, amberK);
    haloLayer(c, uA, uB);
    strandLayer(c, S0, uA, uB);
    xrayLayer(c, S0, uA, uB);
    // Mittellinie (Strich-Punkt) wie in technischer Zeichnung
    c.save(); c.setLineDash([46, 10, 6, 10]); c.strokeStyle = "rgba(63,210,255,0.22)"; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(uA, 0); c.lineTo(uB, 0); c.stroke(); c.restore();
  }

  const CACHE = []; // kleine LRU (Überblendungen zwischen zwei rope_macro-Szenen dürfen nicht neu rendern)
  const cacheGet = (key) => { const i = CACHE.findIndex((e) => e.key === key); if (i < 0) return null; const e = CACHE[i]; if (i) { CACHE.splice(i, 1); CACHE.unshift(e); } return e; };
  const cachePut = (e) => { CACHE.unshift(e); while (CACHE.length > 3) CACHE.pop(); return e; };

  // gedrehten Seilausschnitt (Welt-Rechteck x∈[XA,XB]) einmal rendern
  function renderBand(S, XA, XB, scale, uLo, uHi, amberK) {
    const sa = Math.abs(S.sa), tn = S.sa / S.ca, hb = HH / S.ca + 2;
    const ya = S.CY + (XA - S.CX) * tn, yb = S.CY + (XB - S.CX) * tn;
    const Y0 = Math.max(-160, Math.floor(Math.min(ya, yb) - hb)), Y1 = Math.min(1240, Math.ceil(Math.max(ya, yb) + hb));
    const cv = mkCanvas((XB - XA) * scale, (Y1 - Y0) * scale);
    const c = cv.getContext("2d");
    c.scale(scale, scale); c.translate(-XA, -Y0); ropeTransform(c, S);
    const uA = Math.max(uLo, (XA - S.CX - HH * sa) / S.ca - 60), uB = Math.min(uHi, (XB - S.CX + HH * sa) / S.ca + 60);
    paintRope(c, S, uA, uB, amberK);
    return { cv, X0: XA, Y0 };
  }

  function getLayers(S) {
    const tgQ = Math.round(S.tg * 20) / 20;
    const sh = S.v * S.d * S.ca, s0 = S.scroll0 * S.ca; // Anschluss: Musterphase verschoben -> Kacheln entsprechend breiter
    const XA = Math.floor(-40 - Math.max(0, sh) - Math.max(0, s0)), XB = Math.ceil(1960 - Math.min(0, sh) - Math.min(0, s0));
    const key = [S.angle.toFixed(3), S.CY, tgQ, XA, XB].join("|");
    const hit = cacheGet(key); if (hit) return hit;
    const tn = S.sa / S.ca, hb = HH / S.ca + 2;
    const amberK = 0.4 * tgQ;
    const big = renderBand(S, XA, XB, 1, -1e9, 1e9, amberK);
    const tiles = [];
    const TW = 280;
    for (let x0 = XA; x0 < XB; x0 += TW) {
      const x1 = Math.min(XB, x0 + TW);
      const ya = S.CY + (x0 - S.CX) * tn, yb = S.CY + (x1 - S.CX) * tn;
      const y0 = Math.max(big.Y0, Math.floor(Math.min(ya, yb) - hb)), y1 = Math.min(big.Y0 + big.cv.height, Math.ceil(Math.max(ya, yb) + hb));
      if (y1 <= y0) continue;
      const cv = mkCanvas(x1 - x0, y1 - y0);
      cv.getContext("2d").drawImage(big.cv, x0 - XA, y0 - big.Y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
      tiles.push({ cv, x: x0, y: y0 });
    }
    big.cv.width = big.cv.height = 1; // Speicher freigeben
    // Spannungs-Puls (elliptischer Amber-Glow, bereits gedreht, Alpha eingebacken)
    const ay = RR * 1.15, sx = 2.6, ax = sx * ay;
    const hx = Math.ceil(Math.hypot(ax * S.ca, ay * S.sa)), hy = Math.ceil(Math.hypot(ax * S.sa, ay * S.ca));
    let pulse = null;
    if (tgQ > 0) {
      pulse = mkCanvas(2 * hx, 2 * hy);
      const c = pulse.getContext("2d"); c.translate(hx, hy); c.rotate(S.ang); c.scale(sx, 1);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, ay); const k = Math.min(1, 0.5 * tgQ);
      g.addColorStop(0, `rgba(255,179,71,${k.toFixed(3)})`); g.addColorStop(0.5, `rgba(255,160,50,${(0.42 * k).toFixed(3)})`); g.addColorStop(1, "rgba(255,150,40,0)");
      c.fillStyle = g; c.fillRect(-ay, -ay, 2 * ay, 2 * ay);
    }
    return cachePut({ key, amberK, tiles, pulse, hx, hy, zoom: null });
  }

  // Vergrößerte Ebene für die Lupe (nur für den Weg, den die Lupe tatsächlich fährt)
  let LENS_SPRITES = null;
  function lensSprites() {
    if (LENS_SPRITES) return LENS_SPRITES;
    const RLP = RL + 4, RLW = RL + 16;
    // Lupen-Hintergrund (dunkler Verlauf + Raster), wird im Kreis-Clip geblittet
    const lensBg = mkCanvas(2 * RLW, 2 * RLW);
    {
      const g2 = lensBg.getContext("2d");
      g2.save(); g2.beginPath(); g2.arc(RLW, RLW, RL, 0, TAU); g2.clip();
      const g = g2.createRadialGradient(RLW, RLW, 10, RLW, RLW, RL);
      g.addColorStop(0, "#0d2442"); g.addColorStop(1, "#040b18");
      g2.fillStyle = g; g2.fillRect(0, 0, 2 * RLW, 2 * RLW);
      g2.strokeStyle = "rgba(80,170,255,0.08)"; g2.lineWidth = 1; g2.beginPath();
      for (let q = RLW % 72; q < 2 * RLW; q += 72) { g2.moveTo(q, 0); g2.lineTo(q, 2 * RLW); g2.moveTo(0, q); g2.lineTo(2 * RLW, q); }
      g2.stroke(); g2.restore();
    }
    const glass = mkCanvas(2 * RLP, 2 * RLP);
    {
      const g2 = glass.getContext("2d");
      const rim = g2.createRadialGradient(RLP, RLP, RL * 0.7, RLP, RLP, RL);
      rim.addColorStop(0, "rgba(4,10,22,0)"); rim.addColorStop(0.8, "rgba(20,70,110,0.10)"); rim.addColorStop(1, "rgba(63,210,255,0.22)");
      g2.fillStyle = rim; g2.beginPath(); g2.arc(RLP, RLP, RL, 0, TAU); g2.fill();
      g2.lineCap = "round"; g2.strokeStyle = "#eaf8ff";
      g2.globalAlpha = 0.17; g2.lineWidth = 7; g2.beginPath(); g2.arc(RLP, RLP, RL - 16, Math.PI * 1.1, Math.PI * 1.34); g2.stroke();
      g2.globalAlpha = 0.1; g2.lineWidth = 4; g2.beginPath(); g2.arc(RLP, RLP, RL - 16, Math.PI * 1.38, Math.PI * 1.44); g2.stroke();
      g2.globalAlpha = 0.06; g2.lineWidth = 5; g2.beginPath(); g2.arc(RLP, RLP, RL - 14, Math.PI * 0.12, Math.PI * 0.3); g2.stroke();
    }
    LENS_SPRITES = { RLP, RLW, lensBg, glass, rings: {} };
    return LENS_SPRITES;
  }
  function getZoom(Ly, S) {
    const q = 40;
    let lo = Math.floor((S.lensULo - RL / ZOOM - 60) / q) * q, hi = Math.ceil((S.lensUHi + RL / ZOOM + 60) / q) * q;
    if (Ly.zoom && Ly.zoom.lo <= lo && Ly.zoom.hi >= hi) return Ly.zoom;
    if (Ly.zoom) { lo = Math.min(lo, Ly.zoom.lo); hi = Math.max(hi, Ly.zoom.hi); } // Vereinigung -> kein Hin-und-her bei Überblendungen
    const xs = [toScreen(S, lo, -HH)[0], toScreen(S, lo, HH)[0], toScreen(S, hi, -HH)[0], toScreen(S, hi, HH)[0]];
    const XA = Math.floor(Math.min(...xs)) - 4, XB = Math.ceil(Math.max(...xs)) + 4;
    const band = renderBand(S, XA, XB, ZOOM, lo - 40, hi + 40, Ly.amberK);
    Ly.zoom = Object.assign({ lo, hi }, band, lensSprites());
    return Ly.zoom;
  }

  // Verschiebung des Seils (Seillauf) in Bildschirm-Koordinaten
  const scrollVec = (S) => [S.scroll * S.ca, S.scroll * S.sa];

  function drawRopeTiles(ctx, S, Ly) {
    const [svx, svy] = scrollVec(S);
    const dx = Math.round(svx), dy = Math.round(svy);
    for (const tl of Ly.tiles) {
      const x = tl.x + dx; if (x > 1960 || x + tl.cv.width < -40) continue;
      ctx.drawImage(tl.cv, x, tl.y + dy);
    }
  }

  // Spannungs-Glühen: Amber-Pulse laufen entlang des Seils
  function drawPulses(ctx, S, Ly) {
    if (!Ly.pulse) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    // ein Puls läuft in Seilrichtung durch das Bild (je höher die Spannung, desto schneller; Periode 3–5 s)
    const spd = 460 + 300 * S.tg, span = 2300;
    const uc = ((((S.t * spd + 450) % span) + span) % span) - span / 2;
    const [x, y] = toScreen(S, uc, 0);
    if (x > -Ly.hx && x < 1920 + Ly.hx) ctx.drawImage(Ly.pulse, Math.round(x - Ly.hx), Math.round(y - Ly.hy));
    ctx.restore();
  }

  // ---------- Drahtbrüche (Seil-Koordinaten; fertige Brüche gebündelt in wenigen Draw-Calls) ----------
  let GLOW = null; // kleines rotes Glow-Sprite
  function glowSprite() {
    if (GLOW) return GLOW;
    const r = 36, cv = mkCanvas(2 * r, 2 * r), c = cv.getContext("2d");
    const g = c.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, "rgba(255,90,95,1)"); g.addColorStop(0.25, "rgba(255,90,95,0.6)"); g.addColorStop(1, "rgba(255,90,95,0)");
    c.fillStyle = g; c.fillRect(0, 0, 2 * r, 2 * r);
    GLOW = { cv, r };
    return GLOW;
  }

  function addBreakPath(c, x, y0, b, g) {
    const e = b.dir;
    const sw = b.edge ? 44 : 34;
    c.moveTo(x - sw, y0); c.lineTo(x - 6, y0); c.moveTo(x + 6, y0); c.lineTo(x + sw - 6, y0);
    if (b.edge) {
      const lA = b.lenA * g, lB = b.lenB * g;
      c.moveTo(x - 6, y0); c.quadraticCurveTo(x - 7, y0 + e * lA * 0.6, x - 6 - lA * 0.45, y0 + e * lA);
      c.moveTo(x + 6, y0); c.quadraticCurveTo(x + 8, y0 + e * lB * 0.5, x + 6 + lB * 0.55, y0 + e * lB * 0.9);
    } else {
      const l = b.lenA * 0.85 * g;
      c.moveTo(x + 6, y0); c.quadraticCurveTo(x + 8, y0 + e * l * 0.4, x + 6 + l * 0.5, y0 + e * l * 0.8);
      c.moveTo(x - 6, y0); c.lineTo(x - 13, y0 + e * l * 0.3);
    }
  }
  function addTips(c, x, y0, b, g) {
    const e = b.dir;
    const pts = b.edge
      ? [[x - 6 - b.lenA * g * 0.45, y0 + e * b.lenA * g], [x + 6 + b.lenB * g * 0.55, y0 + e * b.lenB * g * 0.9]]
      : [[x + 6 + b.lenA * 0.85 * g * 0.5, y0 + e * b.lenA * 0.85 * g * 0.8]];
    for (const [px, py] of pts) { c.moveTo(px + 2.6, py); c.arc(px, py, 2.6, 0, TAU); }
  }
  function drawBreakVec(ctx, S, b, g, alpha) {
    const x = b.s + S.scroll;
    S.L.glowPath(ctx, (c) => addBreakPath(c, x, b.y0, b, g), RED, 2.8, 1, { alpha });
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = "#ffd6d6"; ctx.beginPath(); addTips(ctx, x, b.y0, b, g); ctx.fill(); ctx.restore();
  }
  // fertiger Bruch als vorgedrehtes Sprite (Blit statt Vektor)
  function breakSprite(Ly, S, b, scale = 1) {
    Ly.bsp = Ly.bsp || {};
    const key = b.seed + "|" + b.type + "|" + b.y0.toFixed(1) + "|" + scale;
    if (Ly.bsp[key]) return Ly.bsp[key];
    const R = Math.ceil(72 * scale), cv = mkCanvas(2 * R, 2 * R), c = cv.getContext("2d");
    c.translate(R, R); c.scale(scale, scale); c.rotate(S.ang);
    const gs = glowSprite(); // roter Schein eingebacken (spart einen Blit je Bruch)
    c.globalAlpha = 0.26; c.drawImage(gs.cv, -gs.r, b.dir * 8 - gs.r); c.globalAlpha = 1;
    S.L.glowPath(c, (q) => addBreakPath(q, 0, 0, b, 1), RED, 2.8, 1);
    c.fillStyle = "#ffd6d6"; c.beginPath(); addTips(c, 0, 0, b, 1); c.fill();
    return (Ly.bsp[key] = { cv, R });
  }
  const RINGS = {}; // gestrichelter Prüfmarkierungs-Ring (rotationsinvariant)
  function ringSprite(L, mr) {
    if (RINGS[mr]) return RINGS[mr];
    const R = mr + 16, cv = mkCanvas(2 * R, 2 * R), c = cv.getContext("2d");
    L.glowPath(c, (q) => q.arc(R, R, mr, 0, TAU), RED, 1.8, 0.6, { alpha: 0.85, dash: [7, 6] });
    return (RINGS[mr] = { cv, R });
  }

  // Brüche in der Lupe (ctx bereits auf den Lupenkreis beschnitten): fertige als vergrößerte Sprites, animierte als Vektor
  function drawBreaksLens(c, S, Ly, lx, ly) {
    let vec = false;
    for (const b of S.B.list) {
      const x = b.s + S.scroll; if (Math.abs(x - S.lens.u) > RL + 60) continue;
      const age = S.t - b.ta; if (age < -0.45) continue;
      if (age < 0.3) { vec = true; continue; }
      const [sx, sy] = toScreen(S, x, b.y0);
      const wx = lx + ZOOM * (sx - lx), wy = ly + ZOOM * (sy - ly);
      const sp = breakSprite(Ly, S, b, ZOOM);
      c.drawImage(sp.cv, Math.round(wx - sp.R), Math.round(wy - sp.R));
    }
    if (vec) {
      c.save(); c.translate(lx, ly); c.scale(ZOOM, ZOOM); c.translate(-lx, -ly); ropeTransform(c, S);
      const keepB = S.B;
      S.B = { list: keepB.list.filter((b) => { const age = S.t - b.ta; return age >= -0.45 && age < 0.3; }) };
      drawBreaksAll(c, S, S.lens.u - RL, S.lens.u + RL, true, Ly);
      S.B = keepB;
      c.restore();
    }
  }

  // Drahtbrüche + Markierungen. inLens: Vektor in Seil-Koordinaten (ctx bereits transformiert);
  // sonst Welt-Koordinaten mit Sprites für fertige Brüche.
  function drawBreaksAll(ctx, S, uMin, uMax, inLens, Ly) {
    const L = S.L;
    const gs = glowSprite();
    const anim = [];
    for (const b of S.B.list) {
      const x = b.s + S.scroll; if (x < uMin - 80 || x > uMax + 80) continue;
      const age = S.t - b.ta;
      if (age < -0.45) continue;
      if (age < 0 || age < 0.3 || inLens) { anim.push(b); continue; }
      const [sx, sy] = toScreen(S, x, b.y0);
      const sp = breakSprite(Ly, S, b);
      ctx.drawImage(sp.cv, Math.round(sx - sp.R), Math.round(sy - sp.R));
    }
    if (anim.length) {
      if (!inLens) { ctx.save(); ropeTransform(ctx, S); }
      for (const b of anim) {
        const x = b.s + S.scroll, age = S.t - b.ta;
        if (age < 0) { // Vorglühen: Spannungsspitze am Draht, kurz vor dem Bruch
          const k = L.clamp(1 + age / 0.45);
          L.glowDot(ctx, x, b.y0, 10 + 18 * k, S.C.amber, 0.25 + 0.6 * k);
          L.line(ctx, x - 30, b.y0, x + 30, b.y0, S.C.amber, 2, 0.8, { alpha: 0.3 + 0.6 * k });
          continue;
        }
        const aIn = L.clamp(age / 0.1);
        ctx.globalAlpha = (0.2 + 0.12 * L.pulse(S.t + b.seed * 0.1, 1.2)) * aIn;
        ctx.drawImage(gs.cv, x - gs.r, b.y0 + b.dir * 8 - gs.r);
        ctx.globalAlpha = 1;
        drawBreakVec(ctx, S, b, L.easeOutBack(L.clamp(age / 0.3)), aIn);
        if (age < 0.25) L.glowDot(ctx, x, b.y0, 30 + 90 * age, "#fff1e0", 1 - age / 0.25);
      }
      if (!inLens) ctx.restore();
    }
    if (!S.insp || inLens) return;
    // Prüfmarkierungen der gezählten Brüche
    const mr = S.B.list.length > 8 ? 27 : 36;
    const rs = ringSprite(L, mr);
    const rot = (S.t + S.phase) * 0.6;
    ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 2; ctx.globalAlpha = 0.9; ctx.beginPath();
    let anyTick = false;
    for (const b of S.B.list) {
      const x = b.s + S.scroll; if (x < uMin - 80 || x > uMax + 80) continue;
      const k = L.clamp((S.t - b.tc) / 0.35); if (k <= 0) continue;
      const [mx, my] = toScreen(S, x, b.y0 + b.dir * (b.edge ? 12 : 6));
      if (k >= 1) {
        ctx.save(); ctx.globalAlpha = 1; ctx.drawImage(rs.cv, Math.round(mx - rs.R), Math.round(my - rs.R)); ctx.restore();
        for (let i = 0; i < 4; i++) { const a = rot + b.seed + (i * Math.PI) / 2; ctx.moveTo(mx + Math.cos(a) * (mr + 4), my + Math.sin(a) * (mr + 4)); ctx.lineTo(mx + Math.cos(a) * (mr + 12), my + Math.sin(a) * (mr + 12)); }
        anyTick = true;
      } else {
        const r = mr + 10 * (1 - L.easeOut(k));
        L.glowPath(ctx, (c) => c.arc(mx, my, r, 0, TAU), RED, 1.8, 0.6, { alpha: 0.85 * k, dash: [7, 6] });
      }
    }
    if (anyTick) ctx.stroke();
    ctx.restore();
  }

  // ---------- Overlays (Bildschirm-Koordinaten) ----------
  function drawSparks(ctx, S) {
    const L = S.L;
    for (const b of S.B.list) {
      const age = S.t - b.ta; if (age < 0 || age > 0.7) continue;
      const [sx, sy] = toScreen(S, b.s + S.scroll, b.y0);
      if (S.insp && S.lens && Math.hypot(sx - S.lens.x, sy - S.lens.y) < S.lens.r) continue;
      const dir = (b.dir < 0 ? -HALF : HALF) + S.ang;
      L.sparks(ctx, sx, sy, age, { seed: b.seed, count: 12, life: 0.5, speed: 360, gravity: 700, window: 0.05, dir, spread: 1.9 });
    }
  }

  function drawDust(ctx, S) {
    const L = S.L;
    ctx.save();
    for (let i = 0; i < 26; i++) {
      const x = ((H(i * 3.1) * 2100 + S.t * (6 + 12 * H(i * 1.7))) % 2100) - 90;
      const y = 200 + H(i * 7.7) * 680 + Math.sin(S.t * 0.5 + i) * 12;
      const a = 0.18 + 0.2 * (0.5 + 0.5 * Math.sin(S.t * 1.3 + i * 2.1));
      ctx.globalAlpha = a; ctx.fillStyle = i % 5 === 0 ? L.C.amber : L.C.cyan;
      ctx.beginPath(); ctx.arc(x, y, 1.2 + 1.8 * H(i * 1.3), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // Glas + Fassung der Lupe (Glow-Ring, Außenring, Skala, Fadenkreuz-Marken) als ein Sprite je Neigung
  function lensRing(Z, S) {
    const key = S.angle.toFixed(3);
    if (Z.rings[key]) return Z.rings[key];
    const RO = RL + 34, cv = mkCanvas(2 * RO, 2 * RO), c = cv.getContext("2d"), L = S.L;
    c.drawImage(Z.glass, RO - Z.RLP, RO - Z.RLP);
    L.circle(c, RO, RO, RL, S.C.cyan, 3, 1);
    c.globalAlpha = 0.45; c.strokeStyle = S.C.cyan; c.lineWidth = 1.2; c.beginPath(); c.arc(RO, RO, RL + 13, 0, TAU); c.stroke();
    c.globalAlpha = 0.6; c.lineWidth = 1.5; c.beginPath();
    for (let i = 0; i < 72; i++) { const a = (i * TAU) / 72; const len = i % 6 === 0 ? 12 : 5; c.moveTo(RO + Math.cos(a) * (RL + 17), RO + Math.sin(a) * (RL + 17)); c.lineTo(RO + Math.cos(a) * (RL + 17 + len), RO + Math.sin(a) * (RL + 17 + len)); }
    c.stroke();
    c.globalAlpha = 0.9; c.lineWidth = 2.2; c.beginPath();
    for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2 + S.ang; c.moveTo(RO + Math.cos(a) * (RL - 22), RO + Math.sin(a) * (RL - 22)); c.lineTo(RO + Math.cos(a) * (RL - 5), RO + Math.sin(a) * (RL - 5)); }
    c.stroke();
    return (Z.rings[key] = { cv, RO });
  }

  function drawLens(ctx, S, Ly) {
    const C = S.C, Lz = S.lens;
    const r = Lz.r; if (r < 2) return;
    const lx = Lz.x, ly = Lz.y;
    const Z = getZoom(Ly, S), RLW = Z.RLW;
    const [svx, svy] = scrollVec(S);
    // Kreis-Clip direkt im Hauptbild; nur ganzzahlige Blits (Hintergrund + Ausschnitt der vergrößerten Seilebene)
    const ox = Math.round(lx - RLW), oy = Math.round(ly - RLW);
    ctx.save();
    ctx.beginPath(); ctx.arc(lx, ly, Math.min(r, RL), 0, TAU); ctx.clip();
    ctx.drawImage(Z.lensBg, ox, oy);
    const sx = Math.round(ZOOM * (lx - svx - Z.X0) - RLW), sy = Math.round(ZOOM * (ly - svy - Z.Y0) - RLW);
    const x0 = Math.max(0, sx), y0 = Math.max(0, sy), x1 = Math.min(Z.cv.width, sx + 2 * RLW), y1 = Math.min(Z.cv.height, sy + 2 * RLW);
    if (x1 > x0 && y1 > y0) ctx.drawImage(Z.cv, x0, y0, x1 - x0, y1 - y0, ox + x0 - sx, oy + y0 - sy, x1 - x0, y1 - y0);
    drawBreaksLens(ctx, S, Ly, lx, ly);
    ctx.restore();
    // Glas + Fassung (ein Sprite), dazu ein umlaufender Scan-Bogen als Bewegung
    const ring = lensRing(Z, S), RO = ring.RO;
    if (r >= RL - 0.5) ctx.drawImage(ring.cv, Math.round(lx - RO), Math.round(ly - RO));
    else { const gs = r / RL; ctx.save(); ctx.globalAlpha = Lz.a; ctx.drawImage(ring.cv, lx - RO * gs, ly - RO * gs, 2 * RO * gs, 2 * RO * gs); ctx.restore(); }
    const rot = (S.t + S.phase) * 0.9;
    ctx.save(); ctx.globalAlpha = 0.85 * Lz.a; ctx.strokeStyle = C.cyan; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath();
    for (let i = 0; i < 3; i++) { const a0 = rot + (i * TAU) / 3; ctx.moveTo(lx + Math.cos(a0) * (r + 13), ly + Math.sin(a0) * (r + 13)); ctx.arc(lx, ly, r + 13, a0, a0 + 0.22); }
    ctx.stroke(); ctx.restore();
  }

  const READ = {};
  // Farbmischung zweier #rrggbb-Farben
  const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (c1, c2, k) => { const a = hexRgb(c1), b = hexRgb(c2); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(",")})`; };

  // Zähleranzeige: Panel + Beschriftung (+ Balkenbett) einmal rendern. Modi: number | gauge | ticks | none
  function readoutGeom(S) {
    const L = S.L, C = S.C, mode = S.disp;
    const bar = S.readH > 62;
    const lab = mode === "number" && !/[:：]\s*$/.test(S.countLabel) ? S.countLabel + ":" : S.countLabel;
    const key = [lab, mode, bar ? 1 : 0, S.thrTag].join("|");
    if (READ[key]) return READ[key];
    const mc = mkCanvas(4, 4).getContext("2d");
    const fs = 32;
    const wl = L.measure(mc, lab, { size: fs, weight: 600 });
    const wn = mode === "number" ? L.measure(mc, "00", { size: 38, weight: 700, font: L.FONT.mono }) : 0;
    const tagW = S.thrTag ? L.measure(mc, S.thrTag, { size: 19, weight: 700, font: L.FONT.mono, letterSpacing: 1.5 }) : 0;
    let w = 24 + wl + (wn ? 14 + wn : 0) + (mode === "none" ? 36 : 0) + 34;
    if (bar) w = Math.max(w + (tagW ? tagW + 26 : 0), 420);
    w = Math.ceil(w);
    const h = bar ? 90 : 62, pad = 12;
    const cv = mkCanvas(w + 2 * pad, h + 2 * pad), c = cv.getContext("2d");
    L.panel(c, pad, pad, w, h, { fill: "rgba(4,12,26,0.88)", stroke: C.cyanSoft, r: 6 });
    L.fillRect(c, pad, pad + 10, 5, h - 20, C.cyan);
    const row1 = bar ? 41 : h / 2 + 11;
    L.text(c, lab, pad + 24, pad + row1, { size: fs, weight: 600, color: C.white });
    const bx = 24, bw = w - 48, by = 58, bh = 12;
    if (bar) { // Balkenbett
      c.save(); c.fillStyle = "rgba(63,210,255,0.07)"; c.beginPath(); L.roundRectPath(c, pad + bx, pad + by, bw, bh, 4); c.fill();
      c.strokeStyle = "rgba(63,210,255,0.28)"; c.lineWidth = 1; c.stroke(); c.restore();
    }
    return (READ[key] = { cv, w, h, pad, wl, wn, bar, tagW, row1, bx, bw, by, bh, lab });
  }
  // Position der Anzeige für eine Lupenposition (auch für die Stempel-Planung)
  function readoutPos(G, lx, ly, lr) {
    let x = lx - G.w / 2, y = ly - lr - 30 - G.h;
    return [Math.round(Math.max(116, Math.min(1800 - G.w, x))), Math.round(Math.max(208, y))];
  }

  // Inhalt der Anzeige je Modus (Ziffer bzw. Zähl-Blinklicht); Balken zeichnet drawBar
  function drawReadContent(ctx, S, mode, G, x, row1, a, pop) {
    const L = S.L, C = S.C, cnt = S.count, tp = S.t + S.phase;
    if (a <= 0.01) return;
    if (mode === "number") {
      const done = S.t > S.plan.tE + 0.1;
      const col = cnt > 0 ? RED : (done ? C.green : C.cyan);
      const ns = 38 * (1 + 0.28 * pop);
      L.text(ctx, String(cnt), x + 24 + G.wl + 14 + G.wn / 2, row1 + 2 + (ns - 38) * 0.3, { size: ns, weight: 700, font: L.FONT.mono, color: col, align: "center", alpha: a, glow: pop > 0.02 ? 10 * pop : 0, glowColor: col });
    } else if (mode === "none") {
      // Zähl-Blinklicht: atmet ruhig (cyan), blitzt bei jedem gezählten Bruch rot auf
      const bx = x + 24 + G.wl + 24, by = row1 - 11;
      const breath = 0.45 + 0.3 * L.pulse(tp, 1.1);
      ctx.save(); ctx.globalAlpha = a;
      ctx.strokeStyle = cnt > 0 ? RED : C.cyan; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, 8, 0, TAU); ctx.stroke();
      ctx.fillStyle = cnt > 0 ? RED : C.cyan; ctx.globalAlpha = a * (cnt > 0 ? Math.max(0.55 + 0.25 * L.pulse(tp, 1.4), pop) : breath * 0.6);
      ctx.beginPath(); ctx.arc(bx, by, 4.5 + 1.5 * pop, 0, TAU); ctx.fill();
      ctx.restore();
      if (pop > 0.02) { const gs = glowSprite(); ctx.save(); ctx.globalAlpha = a * pop * 0.9; ctx.drawImage(gs.cv, bx - gs.r, by - gs.r); ctx.restore(); }
    }
  }

  function drawReadout(ctx, S) {
    const L = S.L, C = S.C, Lz = S.lens;
    const a = Lz.a; if (a <= 0.01) return;
    const G = readoutGeom(S);
    const t = S.t;
    const pop = L.clamp(1 - (t - S.lastCountT) / 0.35);
    // Anschluss: Anzeige beginnt exakt wie am Ende der Vorszene und wird dann umgebaut (Größe, Lage, Inhalt)
    const R0 = S.carryI && S.carryI.read;
    let G1 = null, k = 1;
    if (R0 && Number.isFinite(S.morphT)) {
      G1 = readoutGeom({ L, C, disp: R0.disp, countLabel: R0.countLabel, readH: R0.readH, thrTag: R0.thrTag });
      k = L.easeInOut(L.clamp((t - S.morphT) / 0.5));
    }
    const w = k < 1 ? L.lerp(G1.w, G.w, k) : G.w, h = k < 1 ? L.lerp(G1.h, G.h, k) : G.h;
    let [x, y] = readoutPos({ w: Math.round(w), h: Math.round(h) }, Lz.x, Lz.y, Lz.r);
    if (k < 1) { // Kamerasprung zwischen den Szenen ausgleichen, klingt mit dem Umbau aus
      const [x0, y0] = readoutPos(G1, R0.lx, R0.ly, RL);
      x = Math.round(x + (R0.x - x0) * (1 - k)); y = Math.round(y + (R0.y - y0) * (1 - k));
    }
    S.readoutRect = { x, y, w: Math.max(w, G.w), h: Math.max(h, G.h) };
    const reachK = Number.isFinite(S.reachT) ? L.clamp((t - S.reachT - 0.12) / 0.25) : 0;
    const row1 = y + (k < 1 ? L.lerp(G1.row1, G.row1, k) : G.row1);
    ctx.save(); ctx.globalAlpha = a;
    if (k >= 1) ctx.drawImage(G.cv, x - G.pad, y - G.pad);
    else if (k <= 0) ctx.drawImage(G1.cv, x - G1.pad, y - G1.pad);
    else {
      L.panel(ctx, x, y, w, h, { fill: "rgba(4,12,26,0.88)", stroke: C.cyanSoft, r: 6, alpha: a });
      ctx.globalAlpha = a; ctx.fillStyle = C.cyan; ctx.fillRect(x, y + 10, 5, h - 20);
      if (G1.lab === G.lab) L.text(ctx, G.lab, x + 24, row1, { size: 32, weight: 600, color: C.white, alpha: a });
      else { L.text(ctx, G1.lab, x + 24, row1, { size: 32, weight: 600, color: C.white, alpha: a * (1 - k) }); L.text(ctx, G.lab, x + 24, row1, { size: 32, weight: 600, color: C.white, alpha: a * k }); }
      if (G.bar) { // Balkenbett wächst ein
        ctx.globalAlpha = a * k; ctx.fillStyle = "rgba(63,210,255,0.07)"; ctx.beginPath(); L.roundRectPath(ctx, x + G.bx, y + h - 32, w - 48, G.bh, 4); ctx.fill();
        ctx.strokeStyle = "rgba(63,210,255,0.28)"; ctx.lineWidth = 1; ctx.stroke();
      }
    }
    // Zählschritt: Akzent blitzt rot
    if (pop > 0.02 || reachK > 0) { ctx.globalAlpha = a * Math.max(pop, reachK); ctx.fillStyle = RED; ctx.fillRect(x, y + 10, 5, h - 20); }
    // Führungslinie zur Lupe
    const tx = Math.round(Math.max(x + 20, Math.min(x + w - 20, Lz.x))) + 0.5;
    ctx.globalAlpha = a * 0.6; ctx.strokeStyle = C.cyan; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(tx, y + h); ctx.lineTo(tx, Math.max(y + h, Lz.y - Lz.r - 16)); ctx.stroke();
    ctx.restore();
    if (k < 1) drawReadContent(ctx, S, R0.disp, G1, x, row1, a * (1 - L.clamp(k * 2)), pop);
    if (k > 0) drawReadContent(ctx, S, S.disp, G, x, row1, a * (G1 ? L.clamp(k * 2 - 1) : 1), pop);
    if (G.bar && k > 0) drawBar(ctx, S, k < 1 ? Object.assign({}, G, { w, h, bw: w - 48, by: h - 32, row1: row1 - y }) : G, x, y, a * k, pop, reachK);
  }

  function drawBar(ctx, S, G, x, y, a, pop, reachK) {
    const L = S.L, C = S.C, t = S.t;
    const bx = x + G.bx, bw = G.bw, by = y + G.by, bh = G.bh;
    const cs = S.countSm, thr = S.thrV;
    ctx.save(); ctx.globalAlpha = a;
    let mx = null;
    if (S.disp === "ticks") {
      const n = S.slots, gap = n > 16 ? 3 : 5, sw = (bw - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) {
        const k = L.clamp(cs - i), sx = bx + i * (sw + gap);
        if (k <= 0) { ctx.fillStyle = "rgba(63,210,255,0.13)"; ctx.fillRect(Math.round(sx), by + 2, Math.max(1, Math.round(sw)), bh - 4); continue; }
        const g = 1 + 0.5 * (1 - L.easeOut(k)); // neuer Strich springt kurz hoch
        ctx.fillStyle = reachK > 0.5 ? RED : C.amber;
        ctx.fillRect(Math.round(sx), Math.round(by + bh / 2 - (bh / 2) * g - 2), Math.max(1, Math.round(sw)), Math.round(bh * g + 4));
      }
      if (thr != null) mx = bx + Math.min(n, thr) * (sw + gap) - gap / 2;
    } else {
      const f = L.clamp(cs / S.gMax);
      const col = reachK > 0 ? mix(C.amber, RED, reachK) : C.amber;
      const fw = bw * f;
      if (fw > 0.5) {
        ctx.globalAlpha = a * 0.28; ctx.fillStyle = col; ctx.fillRect(bx, by - 4, fw, bh + 8); // Schein
        ctx.globalAlpha = a; ctx.beginPath(); L.roundRectPath(ctx, bx, by, Math.max(fw, 8), bh, 4); ctx.fill();
        // Glanz läuft durch die Füllung (Leben)
        const sh = ((t * 0.55) % 1) * (fw + 60) - 30;
        const g = ctx.createLinearGradient(bx + sh - 30, 0, bx + sh + 30, 0);
        g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,0.45)"); g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.save(); ctx.beginPath(); ctx.rect(bx, by, fw, bh); ctx.clip(); ctx.fillStyle = g; ctx.fillRect(bx, by, fw, bh); ctx.restore();
        if (pop > 0.02) { ctx.globalAlpha = a * pop; ctx.fillStyle = "#fff2dc"; ctx.fillRect(bx + fw - 3, by - 3, 3, bh + 6); }
      }
      if (thr != null) mx = bx + bw * L.clamp(thr / S.gMax);
    }
    ctx.restore();
    // Grenzmarke + Beschriftung
    if (mx != null && S.thrTag) {
      const ka = L.clamp((t - S.thrAt) / 0.35); if (ka <= 0) return;
      const col = reachK > 0 ? RED : C.amber;
      const mxr = Math.round(mx) + 0.5, grow = L.easeOut(ka);
      const y0 = by + bh / 2 - (bh / 2 + 10) * grow, y1 = by + bh / 2 + (bh / 2 + 10) * grow;
      const glowK = reachK > 0 ? 0.6 + 0.4 * L.pulse(t, 1.6) : 0.5;
      L.line(ctx, mxr, y0, mxr, y1, col, 2.5, glowK, { alpha: a * ka, cap: "butt" });
      ctx.save(); ctx.globalAlpha = a * ka; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(mxr - 7, y0 - 9); ctx.lineTo(mxr + 7, y0 - 9); ctx.lineTo(mxr, y0 - 1); ctx.closePath(); ctx.fill(); ctx.restore();
      const minX = x + 24 + G.wl + (G.wn ? 14 + G.wn : 0) + 20, maxX = x + G.w - 16 - G.tagW;
      const tagX = Math.max(minX, Math.min(maxX, mx - G.tagW / 2));
      L.text(ctx, S.thrTag, tagX, y + G.row1 - 10, { size: 19, weight: 700, font: L.FONT.mono, letterSpacing: 1.5, color: col, alpha: a * L.clamp((ka - 0.3) / 0.7) });
    }
  }

  // ---------- Stempel ----------
  const STAMP_ROT = -0.1;
  let STAMP_LAYOUT = null; // Layout-Cache (einmal je Szene)
  const STAMPS = {};
  function stampSprite(S, scale = 1) {
    const L = S.L;
    const txt = S.stamp.toUpperCase(), key = txt + "|" + S.stampSub + "|" + scale + "|" + S.stampCol, col = S.stampCol;
    if (STAMPS[key]) return STAMPS[key];
    const mc = mkCanvas(4, 4).getContext("2d");
    let fsz = Math.round(80 * scale); const ls = Math.round(7 * scale);
    let tw = L.measure(mc, txt, { size: fsz, weight: 700, font: L.FONT.head, letterSpacing: ls });
    if (tw > 900 * scale) { fsz = Math.max(36, Math.floor((fsz * 900 * scale) / tw)); tw = L.measure(mc, txt, { size: fsz, weight: 700, font: L.FONT.head, letterSpacing: ls }); }
    let ssz = Math.round(26 * Math.max(0.85, scale)), sw = S.stampSub ? L.measure(mc, S.stampSub, { size: ssz, weight: 600 }) : 0;
    if (sw > 900) { ssz = Math.max(16, Math.floor((ssz * 900) / sw)); sw = L.measure(mc, S.stampSub, { size: ssz, weight: 600 }); }
    const w = Math.ceil(Math.max(tw, sw) + 100 * scale), h = Math.ceil(fsz * 1.1 + 48 * scale + (S.stampSub ? ssz + 12 : 0));
    const cs = Math.abs(Math.cos(STAMP_ROT)), sn = Math.abs(Math.sin(STAMP_ROT));
    const W2 = Math.ceil(w * cs + h * sn + 70), H2 = Math.ceil(w * sn + h * cs + 70);
    // Tinte (Rahmen + Schrift) mit Stempel-Struktur (deterministische Fehlstellen)
    const ink = mkCanvas(W2, H2), k = ink.getContext("2d");
    k.translate(W2 / 2, H2 / 2); k.rotate(STAMP_ROT);
    k.strokeStyle = col; k.lineWidth = 7; k.beginPath(); L.roundRectPath(k, -w / 2, -h / 2, w, h, 12); k.stroke();
    k.lineWidth = 2.5; k.beginPath(); L.roundRectPath(k, -w / 2 + 14, -h / 2 + 14, w - 28, h - 28, 6); k.stroke();
    const ty = S.stampSub ? -h / 2 + 24 * scale + fsz * 0.95 : fsz * 0.36;
    L.text(k, txt, ls / 2, ty, { size: fsz, weight: 700, font: L.FONT.head, letterSpacing: ls, color: col, align: "center" });
    if (S.stampSub) L.text(k, S.stampSub, 0, ty + ssz + 16, { size: ssz, weight: 600, color: mix(col, "#ffffff", 0.6), align: "center" });
    k.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 260; i++) {
      const px = (H(i * 1.73 + 0.2) - 0.5) * w, py = (H(i * 3.31 + 0.7) - 0.5) * h, r = 0.5 + 2.4 * H(i * 5.17) ** 2;
      k.globalAlpha = 0.3 + 0.55 * H(i * 7.91); k.beginPath(); k.arc(px, py, r, 0, TAU); k.fill();
    }
    k.lineWidth = 1.2;
    for (let i = 0; i < 9; i++) {
      const px = (H(i * 11.3) - 0.5) * w, py = (H(i * 13.7) - 0.5) * h, l = 20 + 60 * H(i * 17.1), an = 0.3 * (H(i * 19.9) - 0.5);
      k.globalAlpha = 0.45; k.beginPath(); k.moveTo(px, py); k.lineTo(px + Math.cos(an) * l, py + Math.sin(an) * l); k.stroke();
    }
    const cv = mkCanvas(W2, H2), c = cv.getContext("2d");
    c.save(); c.translate(W2 / 2, H2 / 2); c.rotate(STAMP_ROT);
    c.fillStyle = col === RED ? "rgba(24,5,10,0.82)" : "rgba(4,12,24,0.84)"; c.beginPath(); L.roundRectPath(c, -w / 2, -h / 2, w, h, 12); c.fill();
    c.restore();
    c.shadowColor = col; c.shadowBlur = 20; c.drawImage(ink, 0, 0); c.shadowBlur = 0;
    return (STAMPS[key] = { cv, W2, H2, w, h, bw: w * cs + h * sn, bh: w * sn + h * cs });
  }

  // Stempelposition: auf der Seilachse, weit weg von Lupe/Anzeige, ohne Drahtbrüche zu verdecken (einmal je Szene)
  function stampLayout(S) {
    const key = [S.stamp, S.stampSub, S.stampCol, S.stampT, S.d, S.angle, S.CY, S.nb, S.v, S.insp ? [S.plan.mS, S.plan.mE, S.plan.yE, S.plan.yS, S.plan.tS, S.plan.tE].join("|") : "", S.readH, S.showDim, S.B.list.map((b) => b.s.toFixed(1)).join(",")].join("|");
    if (S.cacheSL && S.cacheSL.key === key) return S.cacheSL.val;
    const ts = Math.min(S.stampT, S.d), tn = S.sa / S.ca;
    // Lupe + Anzeige ab dem Aufprall bis Szenenende (Lupe kann noch fahren)
    const lenses = [], rects = [];
    if (S.insp) {
      const G = readoutGeom(S);
      const tt = ts < S.plan.tE ? [ts, (ts + S.plan.tE) / 2, S.plan.tE, S.d] : [ts, S.d];
      for (const q of tt) {
        const m = q < S.plan.tS ? S.plan.mS : lensM(S.L, S.plan, q);
        const [lx, ly] = toScreen(S, m + S.v * q + S.scroll0, lensY(S, S.L, q));
        lenses.push([lx, ly]);
        const [rx, ry] = readoutPos(G, lx, ly, RL);
        rects.push({ x: rx, y: ry, w: G.w, h: G.h });
      }
    }
    const dimX = S.showDim ? toScreen(S, S.dimU + S.v * ts, 0)[0] : null;
    let res = null;
    for (const scale of [1, 0.88, 0.76, 0.66]) {
      const sp = stampSprite(S, scale), hw = sp.bw / 2 + 6, hh = sp.bh / 2 + 6;
      let best = null, bestSc = Infinity;
      const x0 = 120 + hw, x1 = 1800 - hw;
      for (let cx = Math.min(x0, 960); cx <= Math.max(x1, 960); cx += 16) {
        const cy = Math.max(215 + hh, Math.min(895 - hh, S.CY + (cx - S.CX) * tn));
        let sc = Math.abs(cx - 900) * 0.25 + (1 - scale) * 800 + Math.max(0, 210 - (cx - hw)) * 4 + Math.max(0, cx + hw - 1710) * 4;
        for (const [lx, ly] of lenses) {
          const dx = Math.max(0, Math.abs(lx - cx) - hw), dy = Math.max(0, Math.abs(ly - cy) - hh), dd = Math.hypot(dx, dy);
          if (dd < RL + 44) sc += 6000 + (RL + 44 - dd) * 20;
          else if (dd < RL + 110) sc += (RL + 110 - dd) * 8; // Luft zur Lupe
        }
        for (const R of rects) if (cx - hw < R.x + R.w + 16 && cx + hw > R.x - 16 && cy - hh < R.y + R.h + 16 && cy + hh > R.y - 16) sc += 6000;
        for (const b of S.B.list) {
          const [bx, by] = toScreen(S, b.s + S.v * ts + S.scroll0, b.y0);
          if (Math.abs(bx - cx) < hw + 26 && Math.abs(by - cy) < hh + 26) sc += 500;
        }
        if (dimX !== null && Math.abs(dimX - cx) < hw + 40) sc += 250;
        if (sc < bestSc) { bestSc = sc; best = [cx, cy]; }
      }
      const cand = { sp, cx: best[0], cy: best[1], hw, hh, sc: bestSc };
      if (!res || cand.sc < res.sc) res = cand;
    }
    S.cacheSL = { key, val: res };
    return res;
  }

  function drawStamp(ctx, S) {
    const L = S.L, age = S.t - S.stampT;
    if (!S.stamp || !(age >= 0)) return;
    const SL = S.stampL, sp = SL.sp, cx = SL.cx, cy = SL.cy;
    const IMP = 0.2; // Aufprall
    if (age < IMP) { // Anflug: groß und transparent -> knallt auf das Seil
      const k = age / IMP, sc = 1.4 - 0.4 * L.easeIn(k);
      ctx.save(); ctx.globalAlpha = 0.1 + 0.9 * k;
      ctx.drawImage(sp.cv, cx - (sp.W2 * sc) / 2, cy - (sp.H2 * sc) / 2, sp.W2 * sc, sp.H2 * sc);
      ctx.restore();
      return;
    }
    const q = age - IMP;
    // Aufprall-Schein auf dem Seil
    if (q < 0.45) {
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      L.glowDot(ctx, cx, cy, sp.bw * 0.55, S.stampCol, 0.35 * (1 - q / 0.45));
      ctx.restore();
    }
    const bounce = q < 0.24 ? 1 - 0.04 * Math.sin((Math.PI * q) / 0.24) : 1;
    if (bounce !== 1) ctx.drawImage(sp.cv, cx - (sp.W2 * bounce) / 2, cy - (sp.H2 * bounce) / 2, sp.W2 * bounce, sp.H2 * bounce);
    else ctx.drawImage(sp.cv, Math.round(cx - sp.W2 / 2), Math.round(cy - sp.H2 / 2));
    // Schockwelle (gedrehter Rahmen, der sich ausdehnt)
    if (q < 0.6) {
      const e = L.easeOut(q / 0.6), g = 1 + 0.22 * e, w = sp.w * g, h = sp.h * g;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(STAMP_ROT);
      L.glowPath(ctx, (c) => L.roundRectPath(c, -w / 2, -h / 2, w, h, 14), S.stampCol, 3 * (1 - e) + 1, 1, { alpha: 0.85 * (1 - e) });
      ctx.restore();
    }
    // Leben: Tinte glimmt leicht
    if (q > 0.5) {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.07 + 0.09 * L.pulse(S.t, 0.9);
      ctx.drawImage(sp.cv, Math.round(cx - sp.W2 / 2), Math.round(cy - sp.H2 / 2)); ctx.restore();
    }
  }

  function drawCallout(ctx, S) {
    const L = S.L, C = S.C;
    if (!S.label || !S.call) return;
    const k = L.clamp((S.t - S.call.t0) / Math.max(0.6, 0.12 * S.d)); if (k <= 0) return;
    const col = S.call.color;
    const [tx, ty] = S.call.pos();
    const r = S.call.r;
    const size = 30, lh = 40, maxW = 520;
    const lines = L.wrap(ctx, S.label, maxW, { size, weight: 600 }).slice(0, 3);
    const tw = Math.max(...lines.map((ln) => L.measure(ctx, ln, { size, weight: 600 })));
    const w = tw + 52, h = size + 26 + lh * (lines.length - 1);
    // Leitlinie: vom Markierungskreis schräg nach oben, dann waagrecht zur Box
    // Bruch an der Unterkante: Box nach unten (wenn über den Untertiteln Platz ist), sonst nach oben
    const vs = S.call.down && ty + r * 0.7 + 64 - 22 + h <= 905 ? 1 : -1;
    let side = -1;
    const cpx = tx + side * r * 0.7, cpy = ty + vs * r * 0.7;
    let ex = cpx + side * 46, ey = cpy + vs * 64;
    let bx = ex + side * 22 - (side < 0 ? w : 0);
    if (bx < 116) { side = 1; ex = tx + r * 0.7 + 46; bx = ex + 22; }
    const qx = tx + side * r * 0.7;
    let by = vs < 0 ? Math.max(210, ey + 22 - h) : Math.min(905 - h, ey - 22);
    // nicht mit der Lupen-Anzeige kollidieren: erst seitlich ausweichen, sonst nach oben
    const R = S.readoutRect;
    if (R && bx < R.x + R.w + 16 && bx + w > R.x - 16 && by < R.y + R.h + 12 && by + h > R.y - 12) {
      if (side < 0 && R.x - 36 - w >= 116) bx = R.x - 36 - w;
      else if (side > 0 && R.x + R.w + 36 + w <= 1800) bx = R.x + R.w + 36;
      else if (R.y - 14 - h >= 208) by = R.y - 14 - h;
    }
    if (side > 0) bx = Math.min(bx, 1800 - w);
    const SL = S.stampL;
    if (SL && bx < SL.cx + SL.hw + 14 && bx + w > SL.cx - SL.hw - 14 && by < SL.cy + SL.hh + 12 && by + h > SL.cy - SL.hh - 12) {
      if (SL.cy - SL.hh - 16 - h >= 208) by = SL.cy - SL.hh - 16 - h; else by = Math.min(905 - h, SL.cy + SL.hh + 16);
    }
    const joinY = Math.min(Math.max(ey, by + 18), by + h - 18);
    const kl = L.easeOut(L.clamp(k / 0.45));
    // Markierungskreis
    if (!S.call.noCircle) L.glowPath(ctx, (c) => c.arc(tx, ty, r, 0, TAU), col, 2, 0.8, { alpha: kl });
    const px1 = L.lerp(qx, ex, kl), py1 = L.lerp(cpy, joinY, kl);
    L.glowPath(ctx, (c) => { c.moveTo(qx, cpy); c.lineTo(px1, py1); if (kl >= 1) c.lineTo(side < 0 ? bx + w : bx, joinY); }, col, 1.8, 0.7, { alpha: kl });
    const kb = L.easeOut(L.clamp((k - 0.35) / 0.35)); if (kb <= 0) return;
    const bw = w * kb, bxx = side < 0 ? bx + w - bw : bx;
    L.panel(ctx, bxx, by, bw, h, { fill: "rgba(4,12,26,0.88)", stroke: col === RED ? C.redSoft : C.cyanSoft, r: 8, alpha: kb });
    L.fillRect(ctx, bxx, by + 10, 5, h - 20, col);
    const kt = L.clamp((k - 0.6) / 0.3);
    lines.forEach((ln, i) => L.text(ctx, ln, bx + 26, by + 13 + size * 0.86 + i * lh, { size, weight: 600, color: C.white, alpha: kt }));
  }

  // Bemaßung (Ø) als einmal gerendertes Sprite; pro Frame nur Blit mit Alpha
  const DIMS = {};
  function dimSprite(S) {
    const L = S.L, C = S.C, u = S.dimU;
    const below = S.angle < -3;
    const t1 = `Ø ${deNum(S.diameter)} mm`;
    const key = [S.angle.toFixed(3), S.CY, t1, S.spec, u].join("|");
    if (DIMS[key]) return DIMS[key];
    const [ax, ay] = toScreen(S, u, below ? RR + 80 : -RR - 80);
    const mc = document.createElement("canvas").getContext("2d");
    const w2 = S.spec ? L.measure(mc, S.spec, { size: 22, weight: 400 }) : 0;
    const W1 = L.measure(mc, t1, { size: 30, weight: 700, font: L.FONT.mono });
    const right = Math.min(1770, ax + Math.max(W1, w2) / 2);
    const ty = below ? ay + 42 : ay - 50;
    const pts = [toScreen(S, u - 10, -RR - 84), toScreen(S, u + 10, -RR - 84), toScreen(S, u - 10, RR + 84), toScreen(S, u + 10, RR + 84)];
    const X0 = Math.floor(Math.min(right - Math.max(W1, w2) - 10, ...pts.map((q) => q[0])) - 8), X1 = Math.ceil(Math.max(right + 10, ...pts.map((q) => q[0])) + 8);
    const Y0 = Math.floor(Math.min(ty - 36, ...pts.map((q) => q[1])) - 8), Y1 = Math.ceil(Math.max(ty + 44, ...pts.map((q) => q[1])) + 8);
    const cv = mkCanvas(X1 - X0, Y1 - Y0), c = cv.getContext("2d");
    c.translate(-X0, -Y0);
    c.save(); ropeTransform(c, S);
    const arrow = (y1, y2) => {
      L.line(c, u, y1, u, y2, C.cyan, 1.6, 0.5);
      const dir = Math.sign(y2 - y1);
      c.fillStyle = C.cyan; c.beginPath(); c.moveTo(u, y2); c.lineTo(u - 7, y2 - dir * 18); c.lineTo(u + 7, y2 - dir * 18); c.closePath(); c.fill();
    };
    arrow(-RR - 80, -RR - 3); arrow(RR + 80, RR + 3);
    c.globalAlpha = 0.5; c.setLineDash([4, 7]); c.strokeStyle = C.cyan; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(u, -RR); c.lineTo(u, RR); c.stroke();
    c.restore();
    L.text(c, t1, right, ty, { size: 30, weight: 700, font: L.FONT.mono, color: C.cyan, align: "right" });
    if (S.spec) L.text(c, S.spec, right, ty + 32, { size: 22, weight: 400, color: C.muted, align: "right" });
    return (DIMS[key] = { cv, X0, Y0 });
  }
  function drawDimension(ctx, S) {
    const L = S.L;
    if (!S.showDim) return;
    let a = L.clamp((S.t - 0.03 * S.d) / Math.max(0.4, 0.08 * S.d));
    if (S.lens && S.lens.r > 0) a *= L.inv(RL + 230, RL + 330, Math.abs(S.dimU - S.lens.u)); // Lupe in der Nähe -> Bemaßung ausblenden
    if (a <= 0.01) return;
    const sp = dimSprite(S);
    ctx.save(); ctx.globalAlpha = a; ctx.drawImage(sp.cv, sp.X0, sp.Y0); ctx.restore();
  }

  // ---------- Szenenzustand (auch für die Vorszene beim Anschluss) ----------
  function prepare(L, t, d, prm, cam, focus, depth) {
    const cfg = parseParams(prm || {}, depth);
    const ang = (cfg.angle * Math.PI) / 180;
    const S = Object.assign({ L, C: L.C, t, d, ang, ca: Math.cos(ang), sa: Math.sin(ang), CX: 960, CY: cfg.angle === 0 ? 575 : cfg.angle > 0 ? 600 : 590,
      cam: typeof cam === "string" ? cam : "static", focus: Array.isArray(focus) ? focus : null, phase: 0, lensStartU: null, lensStartY: 0, scroll0: 0 }, cfg);
    S.v = Math.sign(cfg.speed) * Math.min(Math.abs(cfg.speed), 200 / d);
    S.scroll = S.v * t;
    // Anschluss an die Vorszene: Brüche, Lupe und Anzeige übernehmen
    const CI = (S.carryI = depth || !S.carry ? null : carryState(L, S));
    if (CI) {
      S.phase = CI.phase;
      S.scroll0 = CI.tex; S.scroll = S.v * t + S.scroll0; // Litzenmuster phasengleich zur Vorszene
      if (CI.breaks.length) { S.initBreaks = Math.min(24, CI.breaks.length); S.nb = Math.min(24, Math.max(S.nb, S.initBreaks)); }
      if (CI.lens && S.insp) { S.lensStartU = CI.lens.u - S.scroll0; S.lensStartY = CI.lens.y; }
    }
    if (S.lensStartX != null) {
      const [wx, wy] = camInv(camOf(S.cam, 0, S.focus, L), S.lensStartX, S.CY);
      S.lensStartU = (wx - S.CX) * S.ca + (wy - S.CY) * S.sa - S.scroll0; S.lensStartY = 0;
    }
    if (S.lensOpenStart == null) S.lensOpenStart = !!(CI && CI.lens && S.insp);
    S.tim = timing(S);
    const cl = S.tim.cl;
    S.readH = S.insp && (S.disp === "gauge" || S.disp === "ticks" || S.thr) ? 90 : 62;
    S.B = buildBreaks(S);
    S.nb = S.B.list.length;
    S.thrV = S.thr ? (S.thr.value != null ? S.thr.value : Math.max(1, S.nb)) : null;
    S.thrTag = S.thr && S.insp ? (S.thr.label.toUpperCase() + (S.thr.showValue ? " " + S.thrV : "")) : "";
    S.dimU = 745;

    // Zeitplan der Prüf-Lupe
    S.plan = planLens(S, S.B);
    S.count = 0; S.lastCountT = -99; S.countSm = 0;
    const tcs = [];
    for (const b of S.B.list) {
      b.tc = b.pre && b.counted && S.insp ? -10 : S.insp ? Math.max(crossTime(L, S.plan, S.plan.dir < 0 ? b.s + 150 : b.s - 150), b.ta + 0.2) : Infinity;
      if (Number.isFinite(b.tc)) tcs.push(b.tc);
      if (t >= b.tc) { S.count++; S.lastCountT = Math.max(S.lastCountT, b.tc); S.countSm += L.easeOut((t - b.tc) / 0.3); }
    }
    tcs.sort((x, y) => x - y);
    // Grenzwert / Anzeige-Skala
    S.reachT = S.insp && S.thrV != null && S.thrV <= tcs.length ? tcs[S.thrV - 1] : Infinity;
    S.gMax = S.thrV != null ? Math.max(S.thrV / 0.8, S.nb * 1.06) : Math.max(1, S.nb) / 0.8;
    S.slots = S.thrV != null ? Math.max(S.nb, S.thrV) + Math.max(2, Math.round(S.thrV * 0.25)) : Math.max(1, S.nb);
    S.thrAt = S.thr && S.thr.at != null ? cl(S.thr.at) : S.tim.openS + S.tim.openD * 0.6;
    // Anschluss: Anzeige wird kurz vor dem ersten neuen Zählschritt bzw. der Grenzmarke zur eigenen Form umgebaut
    S.morphT = Infinity;
    if (CI && CI.read && S.insp) {
      const firstNew = tcs.find((x) => x > 0.05);
      S.morphT = Math.max(0.35, Math.min(firstNew != null ? firstNew : d, S.thr && S.thrAt > 0.5 ? S.thrAt : d, d - 0.9) - 0.55);
    }
    // Stempel-Zeitpunkt
    S.stampT = Infinity;
    if (S.stamp) {
      const last = S.B.list.length ? S.B.list[S.B.list.length - 1] : null;
      if (S.tim.stampAt != null) S.stampT = S.tim.stampAt;
      else if (S.stampCount != null) {
        const src = S.insp ? tcs : S.B.list.map((b) => b.ta);
        if (S.stampCount <= src.length) S.stampT = cl(src[S.stampCount - 1] + (S.insp ? 0.35 : 0.5));
      } else if (S.insp) {
        const base = S.thrV != null ? S.reachT : tcs.length ? tcs[tcs.length - 1] : S.tim.tE;
        if (Number.isFinite(base)) S.stampT = cl(base + 0.35);
      } else S.stampT = cl(last ? Math.max(last.ta, 0) + 0.5 : 0.6 * d);
    }
    S.lens = null;
    if (S.insp) {
      const open = L.easeOut(L.seg(t, S.tim.openS, S.tim.openD));
      const m = t < S.plan.tS ? S.plan.mS : lensM(L, S.plan, t);
      const u = m + S.scroll;
      const yl = lensY(S, L, t);
      const [x, y] = toScreen(S, u, yl);
      S.lens = { u, yl, x, y, r: RL * Math.max(0, open), a: L.clamp(open) };
      S.lensULo = Math.min(S.plan.mS, S.plan.mE) + Math.min(0, S.v * d);
      S.lensUHi = Math.max(S.plan.mS, S.plan.mE) + Math.max(0, S.v * d);
    }
    return S;
  }

  // Endzustand der Vorszene (gleiche Rechnung wie dort) -> Lage im Bild -> Welt der aktuellen Szene bei t = 0
  let CARRY = null;
  function carryState(L, S) {
    const c = S.carry;
    let key = "";
    try { key = JSON.stringify([c, S.angle, S.CY, S.cam, S.focus, S.v]); } catch (e) { return null; }
    if (CARRY && CARRY.key === key) return CARRY.val;
    const dP = c.d, P = prepare(L, dP, dP, c.params, c.camera, c.focus, 1);
    const cP = camOf(c.camera, 1, c.focus, L), cC = camOf(S.cam, 0, S.focus, L);
    const toCur = (x, y) => { const [X, Y] = camFwd(cP, x, y); return camInv(cC, X, Y); };
    const toRope = (x, y) => [(x - S.CX) * S.ca + (y - S.CY) * S.sa, -(x - S.CX) * S.sa + (y - S.CY) * S.ca];
    const breaks = P.B.list.filter((b) => b.ta <= dP).map((b) => {
      const [wx, wy] = toScreen(P, b.s + P.scroll, 0);
      const u = toRope(...toCur(wx, wy))[0];
      return { s: u, y0: b.y0, dir: b.dir, edge: b.edge, face: b.face, type: b.type, lenA: b.lenA, lenB: b.lenB, seed: b.seed, counted: !!P.insp && b.tc <= dP };
    });
    let lens = null, read = null;
    if (P.lens && P.lens.a > 0.5) {
      const [x, y] = toCur(P.lens.x, P.lens.y), [u, yy] = toRope(x, y);
      lens = { u, y: yy };
      const G = readoutGeom(P), [rx, ry] = readoutPos(G, P.lens.x, P.lens.y, P.lens.r), [qx, qy] = toCur(rx, ry);
      read = { disp: P.disp, countLabel: P.countLabel, readH: P.readH, thrTag: P.thrTag, x: qx, y: qy, lx: x, ly: y };
    }
    // Musterphase: am Anker (Lupe, sonst Bildmitte) liegt dieselbe Litzenstelle wie in der Vorszene
    const A = lens ? toCur(P.lens.x, P.lens.y) : camInv(cC, 960, S.CY);
    const [ax, ay] = camInv(cP, ...camFwd(cC, A[0], A[1]));
    const mP = (ax - P.CX) * P.ca + (ay - P.CY) * P.sa - P.scroll, uC = toRope(A[0], A[1])[0];
    let tex = (uC - mP) % LAT; if (tex >= LAT / 2) tex -= LAT; if (tex < -LAT / 2) tex += LAT;
    const val = { breaks, lens, read, phase: dP, tex: Number.isFinite(tex) ? tex : 0 };
    CARRY = { key, val };
    return val;
  }

  // ---------- Hauptfunktion ----------
  function render(ctx, p) {
    const L = p.L;
    const t = Math.max(0, num(p.t, 0)), d = Math.max(1, num(p.d, 8));
    const prm = p.params && typeof p.params === "object" ? p.params : {};
    const S = prepare(L, t, d, prm, p.scene && p.scene.camera, prm.focus, 0);
    const cl = S.tim.cl;
    const ext = 1000 / Math.max(0.5, S.ca) + 260;
    const uMin = -ext, uMax = ext;

    const Ly = getLayers(S);
    ctx.save();
    if (S.stamp && Number.isFinite(S.stampT)) {
      S.stampL = stampLayout(Object.assign(S, { cacheSL: STAMP_LAYOUT }));
      STAMP_LAYOUT = S.cacheSL;
      // kleiner Ruck beim Aufprall des Stempels
      const q = t - S.stampT - 0.2;
      if (q > 0 && q < 0.3) { const e = Math.exp(-q * 16); ctx.translate(Math.round(Math.sin(q * 90) * 5 * e), Math.round(Math.cos(q * 70) * 3 * e)); }
    }
    drawDust(ctx, S);
    drawRopeTiles(ctx, S, Ly);
    drawPulses(ctx, S, Ly);
    drawBreaksAll(ctx, S, uMin, uMax, false, Ly);
    drawSparks(ctx, S);
    drawDimension(ctx, S);
    if (S.lens) drawLens(ctx, S, Ly);
    if (S.stampL) drawStamp(ctx, S);

    // Callout-Ziel bestimmen
    if (S.label) {
      let target = null, magnified = false;
      const list = S.B.list;
      const tDef = S.insp ? (S.disp === "number" ? 0.52 * d : Math.min(d - 0.9, S.tim.tE + 0.25)) : list.length ? Math.min(0.56 * d, Math.max(0, list[list.length - 1].ta) + 0.35) : 0.22 * d;
      const t0 = S.tim.labelAt != null ? S.tim.labelAt : cl(tDef);
      if (list.length) {
        // nur auf Brüche zeigen, die zum Callout-Zeitpunkt schon da sind
        const ready = list.filter((b) => b.ta <= t0 + 0.05);
        const pool = ready.length ? ready : [list[0]];
        const vis = (b) => (S.insp ? classify(b, S.plan.mE, S.plan.yE) : 2);
        const outs = pool.filter((b) => vis(b) === 2);
        const outTops = outs.filter((b) => b.type === "top");
        if (outTops.length) target = S.insp ? outTops[outTops.length - 1] : outTops[Math.floor((outTops.length - 1) / 2)];
        else if (outs.length) target = outs[outs.length - 1];
        else {
          const ins = pool.filter((b) => vis(b) === 1);
          target = ins.find((b) => b.type === "top") || ins[ins.length - 1] || pool[pool.length - 1];
          magnified = S.insp;
        }
      }
      const color = list.length ? RED : L.C.cyan;
      if (target) {
        const b = target;
        S.call = {
          t0, color, r: magnified ? 36 * ZOOM + 4 : 40, noCircle: S.insp && !magnified, down: b.dir > 0 && !magnified,
          pos: () => {
            const yy = b.y0 + b.dir * (b.edge ? 12 : 6);
            const [sx, sy] = toScreen(S, b.s + S.scroll, yy);
            if (magnified && S.lens) return [S.lens.x + (sx - S.lens.x) * ZOOM, S.lens.y + (sy - S.lens.y) * ZOOM];
            return [sx, sy];
          },
        };
      } else {
        const sT = Math.round((-160 - S.v * d * 0.6) / LAT) * LAT;
        S.call = { t0, color, r: 30, pos: () => toScreen(S, sT + S.scroll, -RR + 6) };
      }
    }
    if (S.lens) drawReadout(ctx, S);
    drawCallout(ctx, S);
    ctx.restore();
  }

  // Prüfhilfe (nur lesend): Zeitplan/Lagen einer Szene, z. B. für die Wort-Synchronisation
  CE.debugRopeMacro = (params, d, t, camera) => {
    try {
      const S = prepare(CE.lib, num(t, 0), Math.max(1, num(d, 8)), params || {}, camera, params && params.focus, 0);
      const c = camOf(S.cam, S.t / S.d, S.focus, CE.lib), scr = (u, y) => camFwd(c, ...toScreen(S, u, y)).map((v) => Math.round(v));
      return { nb: S.nb, dir: S.plan.dir, plan: S.plan, tim: { bS: S.tim.bS, bE: S.tim.bE, tS: S.tim.tS, tE: S.tim.tE, openS: S.tim.openS }, reachT: S.reachT, stampT: S.stampT, morphT: S.morphT, count: S.count,
        lens: S.lens && { x: Math.round(S.lens.x), y: Math.round(S.lens.y), r: S.lens.r, screen: scr(S.lens.u, S.lens.yl) },
        breaks: S.B.list.map((b) => ({ type: b.type, s: Math.round(b.s), ta: +b.ta.toFixed(2), tc: +(Number.isFinite(b.tc) ? b.tc : -1).toFixed(2), pre: !!b.pre, counted: !!b.counted, screen: scr(b.s + S.scroll, b.y0) })) };
    } catch (e) { return { error: String(e && e.message) }; }
  };

  CE.register("rope_macro", {
    ownsText: false,
    draw(ctx, p) {
      ctx.save();
      try { render(ctx, p); }
      catch (e) { /* nie werfen – bei unerwarteten Daten bleibt das bisher Gezeichnete stehen */ }
      finally { ctx.restore(); }
    },
  });
})();
