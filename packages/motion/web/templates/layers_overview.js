/* Template „layers_overview“ – die Sicherheitskette als Stapel isometrischer Schichten (Stil „Visual Science“).
   Durchscheinende Isometrie-Platten stapeln sich (Schicht 1 unten), jede mit Innenraster und Glühkante,
   Führungslinie und Karte rechts (Nummer, Linien-Icon, deutsches Label). Links: Klammer um zusammenwirkende
   Schichten („arbeiten zusammen“). Rechts neben den Karten: Hinweise/Callouts.
   Zustände je Schicht: Umriss (leer) · aktiv (Cyan) · neu/hervorgehoben (Amber, Klick-Impuls) · Sync-Puls ·
   erloschen (Flackern → dunkelrot, gestrichelt) · Finale (alle leuchten gemeinsam + Häkchen).

   BEATS: params.beats = [Sekunden ab Szenenstart …]; null/fehlend = Standard; alles geklemmt auf [0,3 ; d−0,3]
     [0] = Aufbau-Start (Stapel erscheint bzw. baut sich Schicht für Schicht auf)
     [1] = „new“/„highlight“-Schicht leuchtet auf (Klick-Impuls, Amber)
     [2] = „extinguish“-Schichten erlöschen
     [3] = Klammer („bracket“) erscheint
     [4] = Hinweise: callout, emphasis, label, notes (sofern ohne eigenes „at“)
     [5] = Finale: alle Schichten leuchten gemeinsam, Häkchen
   Eigenes „at“ (Sekunden) akzeptieren: layers[i], sync[i], emphasis[i], extinguish[i], notes[i], labels (Array-/Objekt-Form
     {layer,text,at}), bracket bzw. brackets[i], callout, label, heritage; Kurzformen: new_at, extinguish_at, bracket_at,
     heritage_at, final_at, light_at (Umriss-Modus: Zeitpunkt, an dem die übrigen aktiven Schichten angehen).

   params (alle optional):
     layers       ["Tragseile", …] oder [{label, at, icon, note, tone, active, new}] – max. 8; Index 0 = unterste Schicht.
                  Standard: 7 Schichten (Mehrere Tragseile … Regelmäßige Prüfung).
     order        "bottom_up" (Standard, Schicht 1 unten) | "top_down" (Schicht 1 oben)
     active       Liste (Namen/Indizes, 0-basiert), "all" oder Zahl k (erste k) – Zustand am SZENENENDE.
                  Standard: alle; mit „new“: alle bis einschließlich „new“.
     new          Name/Index: diese Schicht ist anfangs Umriss und leuchtet bei BEATS[1] auf (Amber-Fokus).
     highlight    Name/Index (−1 = keine): aktive Schicht bekommt bei BEATS[1] den Amber-Fokus.
     new_color    "amber" (Standard) | "cyan"
     build        "present" (Standard bei active/new: Stapel steht nach ~0,6 s) | "in_order" (jede Schicht gleitet
                  aktiv herein, Standard ohne active/new) | "outline_bottom_up" (leere Umrisse stapeln sich, danach Licht)
     build_span   Sekunden vom ersten bis zum letzten Aufbau (Standard min(0,4·d, 0,42·(n−1))); stagger = Abstand je Schicht
     numbered     true (Standard) – Nummern auf Platte und Karte
     sync         ["Fangvorrichtung", …] oder [{layer, at}] – Takt-Impulse; jüngster Impuls = Amber-Fokus
     emphasis     [{layer, label, at, tone}] – Amber-Betonung (+ Hinweis rechts neben der Karte)
     extinguish   ["Tragseile", …] oder [{layer, at}] – Schicht flackert und erlischt (rot, gestrichelt)
     extinguish_simultaneous  true = alle gleichzeitig (sonst 0,3 s versetzt)
     bracket      {layers:[a,b,…], label, at, tone} (oder brackets:[…]) – Klammer links; UND/ODER werden farbig gesetzt
     labels       {"Tragseile":"12x"} oder [{layer,text,at}] – kleine Werte-Tags (erscheinen mit der Schicht); „12x“ → „12×“
     callout      "Text" oder {text, layer, at, tone, arrow:"down"|"up"|"left"|"right"} – Hinweis an der neuen/hervorgehobenen
                  Schicht (arrow = kleiner Richtungspfeil vor dem Text; gilt auch für label/notes/labels-Objekte)
     label        "Text" oder {text, layers, at, tone} – Hinweis an den erloschenen (sonst neuen/obersten) Schichten
     notes        [{layer|layers, text, at, tone}] – beliebige weitere Hinweise
     heritage_icon "otis_ratchet" (oder heritage:{icon,label,at,layer}) – Linien-Icon der Otis-Sperre wandert in die Schicht
     heritage_label  Beschriftung (Standard „Sperre von Otis“)
     final        true | "all_glow_cyan" | "all_glow_amber" | false – Standard nur ohne active/new/extinguish
     final_label  optionaler Text unter dem Häkchen; check:false = ohne Häkchen
     title        optionale kleine Überschrift über der Kartenspalte
     tone-Werte: "amber" | "red"/"danger" | "cyan" | "green"
   Text: p.text zeichnet die Engine oben links (Bereich bleibt frei). Kamerafahrten werden berücksichtigt
   (Layout schrumpft so, dass nichts in Overlay-/Untertitel-Zone oder aus dem Bild wandert). */
(function () {
  "use strict";
  const CEX = window.CE;
  if (!CEX || typeof CEX.register !== "function") return;

  // ---------------- Konstanten ----------------
  const W0 = 1920, H0 = 1080;
  const COL = { cyan: "#3fd2ff", amber: "#ffb347", red: "#ff5a5f", green: "#5be49b", white: "#eef6ff", muted: "#8fb3d9", ice: "#dff6ff", hot: "#fff3dc", panel: "#06101f" };
  const F_HEAD = "Oxanium", F_BODY = "Inter", F_MONO = "JetBrains Mono";
  const DEFAULT_LAYERS = ["Mehrere Tragseile", "Geschwindigkeitsbegrenzer", "Fangvorrichtung", "Puffer", "Bremse", "Sicherheitskreis", "Regelmäßige Prüfung"];
  const MAX_N = 8;
  const SAFE = { x0: 90, x1: 1830, y0: 208, y1: 902 };

  // ---------------- Helfer ----------------
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, d) => clamp((t - a) / Math.max(1e-6, d), 0, 1);
  const eo = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const sm = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const eio = (x) => { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const eob = (x) => { x = clamp(x, 0, 1); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const h01 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const num = (v) => { if (v === null || v === undefined || v === "" || typeof v === "boolean") return null; const x = typeof v === "number" ? v : parseFloat(String(v).replace(",", ".")); return isFinite(x) ? x : null; };
  const RGB = {};
  const rgb = (hex) => {
    if (RGB[hex]) return RGB[hex];
    const h = String(hex).replace("#", "");
    const v = [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
    RGB[hex] = v; return v;
  };
  const rgba = (hex, a) => { const c = rgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${clamp(a, 0, 1).toFixed(3)})`; };
  const mix = (h1, h2, t) => {
    t = clamp(t, 0, 1); if (t <= 0) return h1; if (t >= 1) return h2;
    const a = rgb(h1), b = rgb(h2);
    return "#" + [0, 1, 2].map((i) => Math.round(lerp(a[i], b[i], t)).toString(16).padStart(2, "0")).join("");
  };
  /** Übergang über heißes Weiß (statt trübem Grau zwischen Cyan und Amber). */
  const hotMix = (a, b, t) => (t <= 0 ? a : t >= 1 ? b : t < 0.5 ? mix(a, COL.hot, t * 2) : mix(COL.hot, b, (t - 0.5) * 2));
  const pick = (o, keys) => {
    if (!o || typeof o !== "object") return undefined;
    for (const k of keys) { const v = o[k]; if (v !== undefined && v !== null && v !== "") return v; }
    return undefined;
  };
  const low = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim();
  function setFont(ctx, weight, size, family, ls) {
    ctx.font = `${weight} ${Math.max(1, size).toFixed(1)}px "${family}"`;
    try { ctx.letterSpacing = `${ls || 0}px`; } catch (e) { /* ältere Canvas */ }
  }
  function txt(ctx, s, x, y, o) {
    const a = o.alpha === undefined ? 1 : o.alpha; if (a <= 0.003 || !s) return;
    ctx.save();
    ctx.globalAlpha = clamp(a, 0, 1);
    setFont(ctx, o.weight || 600, o.size || 30, o.font || F_BODY, o.ls || 0);
    ctx.textAlign = o.align || "left"; ctx.textBaseline = o.baseline || "alphabetic";
    ctx.fillStyle = o.color || COL.white; ctx.fillText(s, x, y);
    ctx.restore();
  }
  function toneColor(v, dflt) {
    if (typeof v !== "string") return dflt;
    const s = v.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(s)) return s;
    if (/red|rot|danger|gefahr|fail|versag|error|warn_red/.test(s)) return COL.red;
    if (/amber|gold|orange|gelb|warn/.test(s)) return COL.amber;
    if (/green|grün|gruen|ok|safe|sicher/.test(s)) return COL.green;
    if (/cyan|blau|blue|info/.test(s)) return COL.cyan;
    return dflt;
  }
  /** Notiztext aufbereiten: 12x → 12×, 1.5 → 1,5 (Tausenderpunkte bleiben). */
  const fmtNote = (s) => String(s).replace(/(\d)\s?[xX](?=$|[\s,.;:)!?])/g, "$1×").replace(/(\d)\.(\d{1,2}|\d{4,})(?!\d)/g, "$1,$2").trim();
  function roundRect(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  /** Glühender Strich: bis zu 3 Durchgänge (weich, mittel, Kern) – ohne shadowBlur. */
  function glowStroke(ctx, build, color, width, alpha, glow, dash, lite) {
    if (alpha <= 0.003) return;
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = color;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); build(ctx);
    if (glow > 0.02) {
      if (!lite && glow > 0.25) { ctx.globalAlpha = clamp(alpha * 0.09 * glow, 0, 1); ctx.lineWidth = width * 6.5; ctx.stroke(); }
      ctx.globalAlpha = clamp(alpha * (lite ? 0.26 : 0.22) * glow, 0, 1); ctx.lineWidth = width * 2.8; ctx.stroke();
    }
    ctx.globalAlpha = clamp(alpha, 0, 1); ctx.lineWidth = width; ctx.stroke();
    ctx.restore();
  }
  function glowDot(ctx, x, y, r, color, alpha) {
    if (alpha <= 0.003 || r <= 0) return;
    ctx.save(); ctx.globalAlpha = clamp(alpha, 0, 1);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, 0.9)); g.addColorStop(0.3, rgba(color, 0.35)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  // ---------------- Textumbruch ----------------
  function hyphenSplit(ctx, w, maxW) {
    for (let j = w.length - 2; j >= 1; j--) if (w[j] === "-" && ctx.measureText(w.slice(0, j + 1)).width <= maxW) return [w.slice(0, j + 1), w.slice(j + 1)];
    let k = w.length - 3;
    while (k > 3 && ctx.measureText(w.slice(0, k) + "-").width > maxW) k--;
    return [w.slice(0, Math.max(3, k)) + "-", w.slice(Math.max(3, k))];
  }
  function wrapLines(ctx, str, maxW) {
    const out = [];
    for (const para of String(str).split(/\n/)) {
      const words = para.split(/[ \t\r]+/).filter(Boolean);
      let cur = "";
      for (let w of words) {
        let guard = 0;
        while (ctx.measureText(w).width > maxW && w.length > 6 && guard++ < 12) {
          const [head, rest] = hyphenSplit(ctx, w, maxW);
          if (cur) { out.push(cur); cur = ""; }
          out.push(head); w = rest;
        }
        const test = cur ? cur + " " + w : w;
        if (cur && ctx.measureText(test).width > maxW) { out.push(cur); cur = w; } else cur = test;
      }
      if (cur) out.push(cur);
    }
    return out;
  }
  /** Ausgeglichene Zeilen (letzte Zeile nicht mit Einzelwort). */
  function wrapBalanced(ctx, str, maxW) {
    const base = wrapLines(ctx, str, maxW);
    if (base.length < 2) return base;
    let lo = maxW * 0.5, hi = maxW;
    for (let it = 0; it < 8; it++) { const mid = (lo + hi) / 2; if (wrapLines(ctx, str, mid).length === base.length) hi = mid; else lo = mid; }
    return wrapLines(ctx, str, hi + 0.5);
  }
  function ellipsize(ctx, s, maxW) {
    let t = s.replace(/[\s,;:.–-]+$/, "");
    if (ctx.measureText(t + "…").width <= maxW) return t + "…";
    while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
    return t.replace(/[\s,;:.–-]+$/, "") + "…";
  }
  /** Umbruch mit Vorzug vor Logik-Wörtern (UND/ODER …) – für Klammer-Labels. */
  const LOGIC = /^(UND|ODER|AND|OR|NICHT|NOT|XOR)(:?)$/;
  function wrapLogic(ctx, str, maxW) {
    const words = String(str).split(/\s+/).filter(Boolean);
    const segs = []; let cur = [];
    words.forEach((w, i) => { if (i > 0 && LOGIC.test(w)) { segs.push(cur); cur = []; } cur.push(w); });
    if (cur.length) segs.push(cur);
    if (segs.length < 2) return wrapBalanced(ctx, str, maxW);
    const out = []; let line = "";
    for (const sgm of segs) {
      const s = sgm.join(" ");
      const test = line ? line + " " + s : s;
      if (line && ctx.measureText(test).width > maxW) { out.push(line); line = ""; }
      if (ctx.measureText(s).width > maxW) { if (line) { out.push(line); line = ""; } const ww = wrapLines(ctx, s, maxW); out.push(...ww.slice(0, -1)); line = ww[ww.length - 1] || ""; }
      else line = line ? line + " " + s : s;
    }
    if (line) out.push(line);
    return out;
  }

  // ---------------- Parameter normalisieren ----------------
  const LABEL_KEYS = ["label", "name", "text", "title", "titel", "schicht"];
  const REF_KEYS = ["layer", "name", "index", "i", "schicht", "ebene"];
  const TEXT_KEYS = ["label", "text", "note", "caption", "hinweis", "value", "wert"];
  function normLayers(raw) {
    let arr = raw;
    if (typeof arr === "string") {
      const s = arr.trim();
      if (s.startsWith("[")) { try { arr = JSON.parse(s); } catch (e) { arr = s.split(/\n|;/); } } else arr = s.split(/\n|;|\|/);
    }
    if (!Array.isArray(arr)) return null;
    const out = [];
    for (const e of arr) {
      if (e === null || e === undefined) continue;
      let label, o = null;
      if (typeof e === "object" && !Array.isArray(e)) { o = e; label = pick(e, LABEL_KEYS); } else if (Array.isArray(e)) label = e[0]; else label = e;
      label = label === undefined || label === null ? "" : String(label).trim();
      label = label.replace(/^\d{1,2}(?:\s*[.):–-]\s*|\s+)(?=[A-ZÄÖÜa-zäöü])/, "");
      if (!label) continue;
      out.push({
        label: label.slice(0, 90), at: o ? num(o.at) : null, icon: o ? pick(o, ["icon", "symbol"]) : null,
        note: o ? pick(o, ["note", "hint", "hinweis", "tag", "value", "wert"]) : null, tone: o ? pick(o, ["tone", "color", "farbe"]) : null,
        activeFlag: o && typeof o.active === "boolean" ? o.active : null, newFlag: !!(o && (o.new === true || o.isNew === true)), hlFlag: !!(o && o.highlight === true),
      });
    }
    return out.length ? out : null;
  }
  function resolveRef(ref, layers) {
    if (ref === null || ref === undefined || ref === false) return -1;
    if (typeof ref === "object" && !Array.isArray(ref)) ref = pick(ref, REF_KEYS);
    if (Array.isArray(ref)) ref = ref[0];
    if (typeof ref === "number") { if (!isFinite(ref)) return -1; const k = Math.round(ref); return k >= 0 && k < layers.length ? k : -1; }
    if (typeof ref !== "string") return -1;
    const s = low(ref); if (!s) return -1;
    if (/^-?\d+$/.test(s)) { const k = parseInt(s, 10); return k >= 0 && k < layers.length ? k : -1; }
    if (/^(none|keine|keins|off|aus|null|false)$/.test(s)) return -1;
    let i = layers.findIndex((L) => low(L.label) === s); if (i >= 0) return i;
    i = layers.findIndex((L) => low(L.label).includes(s)); if (i >= 0) return i;
    i = layers.findIndex((L) => s.includes(low(L.label))); if (i >= 0) return i;
    const ws = s.split(/[\s/,-]+/).filter((w) => w.length > 3);
    return layers.findIndex((L) => ws.some((w) => low(L.label).includes(w)));
  }
  /** Listen-Parameter → [{i, at, text, tone}] (Namen, Indizes, Objekte oder Map {Name: Text}). */
  function refItems(v, layers) {
    if (v === undefined || v === null || v === false) return [];
    let arr = v;
    if (typeof arr === "string" || typeof arr === "number") arr = [arr];
    else if (!Array.isArray(arr)) {
      if (typeof arr !== "object") return [];
      if (pick(arr, REF_KEYS) !== undefined) arr = [arr];
      else arr = Object.keys(arr).map((k) => { const val = arr[k]; return val && typeof val === "object" ? Object.assign({ layer: k }, val) : { layer: k, text: val }; });
    }
    const out = [];
    for (const e of arr) {
      if (e === null || e === undefined) continue;
      if (typeof e === "object" && !Array.isArray(e)) {
        const i = resolveRef(pick(e, REF_KEYS), layers);
        const text = pick(e, TEXT_KEYS);
        out.push({ i, at: num(e.at), text: text !== undefined ? String(text) : "", tone: pick(e, ["tone", "color", "farbe"]) || null, arrow: e.arrow || null });
      } else out.push({ i: resolveRef(e, layers), at: null, text: "", tone: null });
    }
    return out.filter((o) => o.i >= 0);
  }
  function iconKind(label, forced) {
    if (typeof forced === "string" && forced) {
      const f = forced.toLowerCase();
      if (/none|kein/.test(f)) return "none";
      for (const k of ["ropes", "governor", "brake", "gear", "buffer", "inspect", "circuit", "door", "shield"]) if (f.includes(k)) return k;
      if (/seil|rope/.test(f)) return "ropes"; if (/fang|safety|keil/.test(f)) return "gear"; if (/prüf|check/.test(f)) return "inspect";
    }
    const s = String(label).toLowerCase();
    if (/begrenzer|regler|tacho|geschwindigkeit|governor/.test(s)) return "governor";
    if (/fang|keil|klemm|safety gear/.test(s)) return "gear";
    if (/puffer|dämpf|daempf|buffer/.test(s)) return "buffer";
    if (/brems|brake/.test(s)) return "brake";
    if (/prüf|pruef|wartung|inspekt|kontroll|tüv|tuev|check/.test(s)) return "inspect";
    if (/kreis|schalter|kontakt|elektr|steuerung|circuit/.test(s)) return "circuit";
    if (/seil|trag|rope/.test(s)) return "ropes";
    if (/tür|tuer|door/.test(s)) return "door";
    return "shield";
  }

  // ---------------- Kamera → sicherer Inhaltsbereich ----------------
  function camBox(p) {
    const cam = (p.scene && p.scene.camera) || "static";
    let s = 1, dx = 0, dy = 0;
    switch (cam) {
      case "slow_push_in": case "slow_pull_out": s = 1.1; break;
      case "pan_left": case "pan_right": s = 1.08; dx = 60; break;
      case "tilt_up": case "tilt_down": s = 1.08; dy = 45; break;
      default: s = 1;
    }
    const f = p.params && Array.isArray(p.params.focus) ? p.params.focus : null;
    const fx = (f && isFinite(f[0]) ? f[0] : 0.5) * W0, fy = (f && isFinite(f[1]) ? f[1] : 0.5) * H0;
    const b = { x0: fx + (SAFE.x0 - fx + dx) / s, x1: fx + (SAFE.x1 - fx - dx) / s, y0: fy + (SAFE.y0 - fy + dy) / s, y1: fy + (SAFE.y1 - fy - dy) / s };
    if (b.x1 - b.x0 < 1200) { const c = (b.x0 + b.x1) / 2; b.x0 = c - 600; b.x1 = c + 600; }
    if (b.y1 - b.y0 < 480) { const c = (b.y0 + b.y1) / 2; b.y0 = c - 240; b.y1 = c + 240; }
    return b;
  }

  // ---------------- Modell (Layout + Zeitplan, gecacht) ----------------
  const CACHE = new WeakMap(); let lastKey = null, lastM = null;
  function getModel(ctx, p) {
    const sc = p.scene && typeof p.scene === "object" ? p.scene : null;
    if (sc) { const m = CACHE.get(sc); if (m && m.d === p.d && m.P === p.params) return m; }
    let key = "";
    try { key = JSON.stringify(p.params) + "|" + p.d + "|" + (sc ? sc.camera : ""); } catch (e) { key = "?" + p.d; }
    if (!sc && key === lastKey && lastM) return lastM;
    const M = buildModel(ctx, p);
    M.d = p.d; M.P = p.params;
    if (sc) CACHE.set(sc, M);
    lastKey = key; lastM = M;
    return M;
  }

  function buildModel(ctx, p) {
    const P = p.params && typeof p.params === "object" ? p.params : {};
    const d = Math.max(1, num(p.d) || 8);
    const lo = Math.min(0.3, d / 2), hi = Math.max(lo, d - 0.3);
    const cT = (x) => clamp(x, lo, hi);
    const beats = Array.isArray(P.beats) ? P.beats : [];
    const bt = (i) => { const v = num(beats[i]); return v === null ? null : cT(v); };
    const atOr = (v, dflt) => { const x = num(v); return x === null ? dflt : cT(x); };
    const has = (k) => Object.prototype.hasOwnProperty.call(P, k) && P[k] !== null && P[k] !== undefined;

    let layers = normLayers(pick(P, ["layers", "schichten", "stack", "items", "list"])) || normLayers(DEFAULT_LAYERS);
    if (layers.length > MAX_N) layers = layers.slice(0, MAX_N);
    const n = layers.length;
    const topDown = /top.?down|oben.?nach.?unten|^oben/i.test(String(P.order || P.reihenfolge || ""));
    layers.forEach((L, i) => { L.i = i; L.rank = topDown ? n - 1 - i : i; L.num = String(i + 1); L.kind = iconKind(L.label, L.icon); });

    // --- Rollen ---
    const newRaw = pick(P, ["new", "neu", "new_layer", "newLayer"]);
    let newIdx = resolveRef(newRaw, layers);
    layers.forEach((L, i) => { if (L.newFlag && newIdx < 0) newIdx = i; });
    let hlIdx = has("highlight") ? resolveRef(P.highlight, layers) : -1;
    layers.forEach((L, i) => { if (L.hlFlag && hlIdx < 0) hlIdx = i; });
    if (hlIdx === newIdx) hlIdx = -1;
    const exItems = refItems(pick(P, ["extinguish", "erloeschen", "erlöschen", "failed", "ausfall", "off"]), layers);
    const aRaw = pick(P, ["active", "aktiv", "lit"]);
    const active = new Array(n).fill(false);
    if (aRaw === undefined) { if (newIdx >= 0) for (let i = 0; i <= newIdx; i++) active[i] = true; else active.fill(true); }
    else if (aRaw === true || /^(all|alle)$/i.test(String(aRaw))) active.fill(true);
    else if (typeof aRaw === "number") { for (let i = 0; i < Math.min(n, aRaw); i++) active[i] = true; }
    else refItems(aRaw, layers).forEach((o) => { active[o.i] = true; });
    layers.forEach((L, i) => { if (L.activeFlag !== null) active[i] = L.activeFlag; });
    if (newIdx >= 0) active[newIdx] = true;
    const specMode = aRaw === undefined && newIdx < 0 && !exItems.length;

    const bRaw = String(pick(P, ["build", "aufbau", "mode"]) ?? "").toLowerCase().trim();
    let mode;
    if (/outline|umriss|leer|empty|ghost/.test(bRaw)) mode = "outline";
    else if (/^(none|static|present|instant|sofort|off|keine|no|false|show)$/.test(bRaw)) mode = "present";
    else if (bRaw) mode = "order";
    else mode = specMode ? "order" : "present";

    // --- Aufbau ---
    const b0 = bt(0) ?? cT(mode === "present" ? 0.3 : 0.45);
    let stagger;
    if (mode === "present") stagger = n > 1 ? Math.min(0.07, 0.45 / (n - 1)) : 0;
    else {
      const spanP = num(pick(P, ["build_span", "buildSpan", "build_duration"]));
      const span = spanP !== null ? Math.max(0, spanP) : Math.min(0.4 * d, 0.42 * (n - 1));
      const stP = num(P.stagger);
      stagger = stP !== null ? Math.max(0, stP) : n > 1 ? span / (n - 1) : 0;
    }
    layers.forEach((L) => { L.ta = L.at !== null ? cT(L.at) : cT(b0 + L.rank * stagger); });
    const buildEnd = Math.max(...layers.map((L) => L.ta)) + (mode === "present" ? 0.35 : 0.45);

    // --- Zeitplan ---
    const newCyan = /cyan|blau|blue/i.test(String(P.new_color ?? P.highlight_color ?? ""));
    const newCol = newCyan ? COL.cyan : toneColor(String(P.new_color ?? P.highlight_color ?? ""), COL.amber);
    const newAtObj = newRaw && typeof newRaw === "object" && !Array.isArray(newRaw) ? num(newRaw.at) : null;
    const tNew = atOr(newAtObj ?? pick(P, ["new_at", "highlight_at"]), bt(1) ?? cT(mode === "present" ? Math.max(b0 + 0.55, clamp(0.35 * d, 0.9, 1.3)) : buildEnd + 0.25));
    const hasFocus = newIdx >= 0 || hlIdx >= 0;
    const exSimul = P.extinguish_simultaneous === true || /^(true|ja|yes)$/i.test(String(P.extinguish_simultaneous || ""));
    const exBase = atOr(P.extinguish_at, bt(2) ?? cT(Math.max(hasFocus ? tNew + 0.8 : 0, mode === "present" ? clamp(0.3 * d, 0.9, 2.2) : buildEnd + 0.4)));
    const lightAt = atOr(P.light_at, cT(buildEnd + 0.1));

    // Heritage (Otis-Sperre)
    const hRaw = pick(P, ["heritage", "heritage_icon", "heritageIcon", "erbe"]);
    let heritage = null;
    if (hRaw) {
      const ho = typeof hRaw === "object" ? hRaw : { icon: hRaw };
      let hi = resolveRef(pick(ho, REF_KEYS), layers);
      if (hi < 0) hi = newIdx >= 0 ? newIdx : hlIdx >= 0 ? hlIdx : layers.findIndex((L) => L.kind === "gear");
      if (hi < 0) hi = n - 1;
      const iconName = String(ho.icon || "otis");
      const lbl = pick(ho, ["label", "text"]) ?? P.heritage_label ?? (/otis|ratchet|sperre/i.test(iconName) ? "Sperre von Otis" : "");
      heritage = { i: hi, label: String(lbl || ""), t: atOr(ho.at ?? P.heritage_at, cT((hasFocus ? tNew : buildEnd) + 0.9)) };
    }
    const notesDefault = bt(4) ?? cT(Math.min(d - 1.0, Math.max(b0 + 0.8, hasFocus ? tNew + 0.9 : 0, exItems.length ? exBase + 1.0 : 0, heritage ? heritage.t + 1.9 : 0, mode !== "present" ? buildEnd + 0.4 : 0)));

    // Finale
    const fRaw = P.final;
    let finalOn = fRaw === undefined || fRaw === null ? specMode : !(fRaw === false || /^(false|none|off|nein|no|keins?)$/i.test(String(fRaw)));
    const fin = finalOn ? { t: atOr(P.final_at, bt(5) ?? cT(d - clamp(0.2 * d, 0.9, 1.8))), cyan: !/amber|gold/i.test(String(fRaw)), step: Math.min(0.09, 0.6 / Math.max(1, n)), check: P.check !== false, label: P.final_label ? String(P.final_label) : "" } : null;

    // Sync-Impulse
    const syncItems = refItems(P.sync, layers);
    const s0 = Math.max(mode !== "present" ? buildEnd + 0.2 : b0 + 0.6, hasFocus ? tNew + 0.6 : 0);
    const s1 = Math.max(s0 + 0.1, fin ? fin.t - 0.5 : d - 0.8);
    const m = syncItems.length;
    const syncEv = syncItems.map((o, k) => ({ i: o.i, t: o.at !== null ? cT(o.at) : cT(m > 1 ? lerp(s0, s1, k / (m - 1)) : lerp(s0, s1, 0.3)) })).sort((a, b) => a.t - b.t);
    syncEv.forEach((e, k) => { e.next = k + 1 < syncEv.length ? syncEv[k + 1].t : fin ? fin.t : Infinity; });

    // Emphasis
    const emphItems = refItems(P.emphasis ?? P.betonung, layers).map((o) => ({ i: o.i, t: o.at !== null ? cT(o.at) : notesDefault, text: o.text, col: toneColor(o.tone, COL.amber) }));

    // --- Rollen je Schicht ---
    layers.forEach((L, i) => {
      L.tLit = Infinity; L.tHot = Infinity; L.hotCol = COL.amber; L.tEx = Infinity; L.events = [];
      if (active[i]) {
        if (i === newIdx) L.tLit = tNew;
        else if (mode === "outline") L.tLit = cT(lightAt + L.rank * 0.07);
        else L.tLit = L.ta + 0.1;
      }
      if (i === newIdx && !newCyan) { L.tHot = tNew; L.hotCol = newCol; }
      if (i === hlIdx) { L.tHot = tNew; L.hotCol = newCol === COL.cyan ? COL.amber : newCol; }
      L.syncEv = syncEv.filter((e) => e.i === i);
      L.events.push({ t: L.ta + 0.32, col: COL.cyan, s: 0.45, ring: mode !== "present" });
      if (L.tLit !== Infinity && L.tLit > L.ta + 0.2) L.events.push({ t: L.tLit, col: i === newIdx ? newCol : COL.cyan, s: 1, ring: true });
      if (L.tHot !== Infinity && i !== newIdx) L.events.push({ t: L.tHot, col: L.hotCol, s: 1, ring: true });
      L.syncEv.forEach((e) => L.events.push({ t: e.t, col: COL.amber, s: 1, ring: true }));
      if (fin) L.events.push({ t: fin.t + L.rank * fin.step, col: fin.cyan ? COL.cyan : COL.amber, s: 0.8, ring: true });
    });
    emphItems.forEach((e) => {
      const L = layers[e.i];
      if (L.tHot === Infinity || e.t < L.tHot) { L.tHot = e.t; L.hotCol = e.col; }
      if (L.tLit === Infinity) L.tLit = e.t;
      L.events.push({ t: e.t, col: e.col, s: 1, ring: true });
    });
    exItems.forEach((o, k) => {
      const L = layers[o.i];
      L.tEx = o.at !== null ? cT(o.at) : cT(exBase + (exSimul ? 0 : k * 0.3));
      L.events.push({ t: L.tEx, col: COL.red, s: 1, ring: true });
    });
    layers.forEach((L) => L.events.sort((a, b) => a.t - b.t));

    // --- Layout ---
    const box = camBox(p);
    const BW = box.x1 - box.x0, BH = box.y1 - box.y0;
    const k = clamp(BW / 1740, 0.72, 1);
    const A = 206 * k;
    let B = A * 0.36;
    const th = 15 * k;
    const LZ = 262 * k;
    const brX = box.x0 + LZ + 22 * k;
    const cx = brX + 40 * k + A;
    const cardX = cx + A + 46 * k;
    let Pp = n > 1 ? (BH - 2 * B - th - 12) / (n - 1) : 0;
    if (n > 1 && Pp < 56) { B = Math.max(A * 0.24, (BH - th - 12 - 56 * (n - 1)) / 2); Pp = (BH - 2 * B - th - 12) / (n - 1); }
    const PI_ = n > 1 ? Math.min(104 * Math.max(k, 0.85), Pp) : 0;
    const total = 2 * B + (n - 1) * PI_ + th;
    const yTop = box.y0 + Math.max(0, (BH - total) / 2) + 2;
    const ycTop = yTop + B;
    layers.forEach((L) => { L.yc = ycTop + (n - 1 - L.rank) * PI_; });
    const CH = clamp(n > 1 ? PI_ * 0.7 : 72, 38, 74);
    const bs = CH * 0.6, is = CH * 0.66, pad = 13 * k;
    const textX0 = pad + bs + 12 * k + is + 14 * k;
    const maxTextW = box.x1 - cardX - textX0 - pad - 8;
    let LF = Math.min(34, CH * 0.46);
    setFont(ctx, 600, LF, F_BODY, 0);
    const widest = Math.max(...layers.map((L) => ctx.measureText(L.label).width));
    if (widest > maxTextW) LF = Math.max(LF * 0.8, LF * (maxTextW / widest));
    setFont(ctx, 600, LF, F_BODY, 0);
    const LF2 = Math.min(LF, CH * 0.36);
    layers.forEach((L) => {
      const w = ctx.measureText(L.label).width;
      if (w <= maxTextW) { L.lines = [L.label]; L.lf = LF; L.tw = w; }
      else {
        setFont(ctx, 600, LF2, F_BODY, 0);
        let lines = wrapBalanced(ctx, L.label, maxTextW);
        if (lines.length > 2) { lines = lines.slice(0, 2); lines[1] = ellipsize(ctx, lines[1], maxTextW); }
        L.lines = lines; L.lf = LF2; L.tw = Math.max(...lines.map((s) => ctx.measureText(s).width));
        setFont(ctx, 600, LF, F_BODY, 0);
      }
      L.cw = textX0 + L.tw + pad + 8;
    });
    const M = {
      n, layers, mode, k, A, B, th, cx, cardX, brX, CH, bs, is, pad, textX0, box, pitch: PI_, ycTop,
      ycBot: ycTop + (n - 1) * PI_, fin, heritage, numbered: P.numbered !== false, newIdx, hlIdx, lzx: (box.x0 + brX - 14 * k) / 2,
    };

    // --- Klammern ---
    let brList = [];
    const bAdd = (b) => { if (b && typeof b === "object" && !Array.isArray(b)) brList.push(b); };
    if (Array.isArray(P.brackets)) P.brackets.forEach(bAdd);
    if (Array.isArray(P.bracket)) P.bracket.forEach(bAdd); else bAdd(P.bracket);
    const brDefault = atOr(P.bracket_at, bt(3) ?? cT(mode === "present" ? b0 + 0.45 : Math.max(buildEnd, hasFocus ? tNew + 0.5 : 0) + 0.3));
    M.brackets = brList.map((b, bi) => {
      const rows = refItems(b.layers ?? b.schichten ?? b.items, layers).map((o) => o.i);
      if (!rows.length) return null;
      const ys = rows.map((i) => layers[i].yc);
      const x = brX - bi * 18 * k;
      const lbl = String(pick(b, ["label", "text", "title"]) ?? "");
      const bf = clamp(CH * 0.4, 20, 28);
      const maxW = x - 30 * k - box.x0;
      let f = bf, lines = [];
      if (lbl) {
        const fits = (ff, maxL) => { setFont(ctx, 600, ff, F_BODY, 0); const ls = wrapLogic(ctx, lbl, maxW); return ls.length <= maxL && Math.max(...ls.map((s) => ctx.measureText(s).width)) <= maxW ? ls : null; };
        let found = null;
        for (let maxL = 1; maxL <= 4 && !found; maxL++) for (let ff = bf; ff >= (maxL < 4 ? bf * 0.84 : 17); ff -= 1) { const ls = fits(ff, maxL); if (ls) { found = ls; f = ff; break; } }
        if (found) lines = found; else { f = 17; setFont(ctx, 600, f, F_BODY, 0); lines = wrapLogic(ctx, lbl, maxW); }
        if (lines.length > 4) { lines = lines.slice(0, 4); lines[3] = ellipsize(ctx, lines[3], maxW); }
      }
      setFont(ctx, 600, f, F_BODY, 0);
      const lw = lines.length ? Math.max(...lines.map((s) => ctx.measureText(s).width)) : 0;
      return { rows, yT: Math.min(...ys), yB: Math.max(...ys), x, lines, f, lw, lh: f * 1.3, at: atOr(b.at, brDefault), col: toneColor(b.tone, COL.amber) };
    }).filter(Boolean);

    // --- Hinweise (rechts neben den Karten) ---
    const notes = [];
    const addNote = (rows, text, at, tone, dfltCol, arrow) => {
      rows = [...new Set(rows.filter((i) => i >= 0 && i < n))];
      text = text === undefined || text === null ? "" : fmtNote(text);
      if (!rows.length || !text) return;
      notes.push({ rows, text, at, col: toneColor(tone, dfltCol || COL.amber), arrow: arrow || null });
    };
    layers.forEach((L) => { if (L.note) addNote([L.i], L.note, cT(L.ta + 0.35), L.tone); });
    refItems(pick(P, ["labels", "tags", "values", "werte"]), layers).forEach((o) => addNote([o.i], o.text, o.at !== null ? cT(o.at) : cT(layers[o.i].ta + 0.35), o.tone, COL.amber, o.arrow));
    emphItems.forEach((e) => { if (e.text) addNote([e.i], e.text, cT(e.t + 0.2), null, e.col); });
    const focusIdx = newIdx >= 0 ? newIdx : hlIdx >= 0 ? hlIdx : emphItems.length ? emphItems[0].i : layers.findIndex((L) => L.rank === n - 1);
    const cRaw = P.callout;
    if (cRaw) {
      const co = typeof cRaw === "object" && !Array.isArray(cRaw) ? cRaw : { text: Array.isArray(cRaw) ? cRaw.join(" ") : cRaw };
      let ci = resolveRef(pick(co, REF_KEYS), layers); if (ci < 0) ci = focusIdx;
      addNote([ci], pick(co, TEXT_KEYS), atOr(co.at, heritage ? Math.max(notesDefault, heritage.t + 1.9 <= d - 0.8 ? cT(heritage.t + 1.9) : notesDefault) : notesDefault), co.tone, COL.amber, co.arrow);
    }
    const gRaw = P.label;
    if (gRaw) {
      const go = typeof gRaw === "object" && !Array.isArray(gRaw) ? gRaw : { text: gRaw };
      let rows = refItems(go.layers, layers).map((o) => o.i);
      if (!rows.length) { const r1 = resolveRef(pick(go, ["layer"]), layers); if (r1 >= 0) rows = [r1]; }
      if (!rows.length) rows = exItems.length ? exItems.map((o) => o.i) : [focusIdx];
      const exMax = exItems.length ? Math.max(...exItems.map((o) => layers[o.i].tEx)) : 0;
      addNote(rows, pick(go, TEXT_KEYS), atOr(go.at, cT(Math.max(notesDefault, exItems.length ? exMax + 0.9 : 0))), go.tone, COL.amber, go.arrow);
    }
    if (Array.isArray(P.notes)) P.notes.forEach((o) => {
      if (!o || typeof o !== "object") return;
      let rows = refItems(o.layers, layers).map((x) => x.i);
      if (!rows.length) { const r1 = resolveRef(pick(o, REF_KEYS), layers); if (r1 >= 0) rows = [r1]; }
      addNote(rows.length ? rows : [focusIdx], pick(o, ["text", "label", "note"]), atOr(o.at, notesDefault), o.tone, COL.amber, o.arrow);
    });
    // Platzierung: je Zeile belegte rechte Kante merken
    const rowRight = layers.map((L) => cardX + L.cw);
    const NF = clamp(CH * 0.38, 20, 27);
    notes.forEach((nt) => {
      const multi = nt.rows.length > 1;
      const baseR = Math.max(...nt.rows.map((i) => rowRight[i]));
      nt.lx = baseR + 4; nt.xc = baseR + 16 * k;
      nt.x = multi ? nt.xc + 20 * k : baseR + 24 * k;
      const awGuess = nt.arrow && /^(down|up|left|right|unten|oben|runter|hoch)$/i.test(String(nt.arrow)) ? NF * 1.05 : 0;
      const maxW = Math.max(150, box.x1 - nt.x - 2 * 14 * k - awGuess);
      let f = NF, lines = null;
      const tryFit = (ff, maxL) => {
        setFont(ctx, 600, ff, F_BODY, 0);
        const parts = nt.text.split(/(?<=[?!:;.])\s+/);
        let ls = parts.length > 1 && parts.length <= maxL && parts.every((q) => ctx.measureText(q).width <= maxW) ? parts : wrapBalanced(ctx, nt.text, maxW);
        return ls.length <= maxL && Math.max(...ls.map((q) => ctx.measureText(q).width)) <= maxW ? ls : null;
      };
      for (let maxL = 1; maxL <= 4 && !lines; maxL++) for (let ff = NF; ff >= (maxL < 4 ? NF * 0.85 : 17); ff -= 1) { const ls = tryFit(ff, maxL); if (ls) { lines = ls; f = ff; break; } }
      if (!lines) { f = 17; setFont(ctx, 600, f, F_BODY, 0); lines = wrapBalanced(ctx, nt.text, maxW); }
      setFont(ctx, 600, f, F_BODY, 0);
      if (lines.length > 4) { lines = lines.slice(0, 4); lines[3] = ellipsize(ctx, lines[3], maxW); }
      nt.f = f; nt.lines = lines; nt.lh = f * 1.28;
      nt.aw = nt.arrow && /^(down|up|left|right|unten|oben|runter|hoch)$/i.test(String(nt.arrow)) ? f * 1.05 : 0;
      nt.w = Math.max(...lines.map((s) => ctx.measureText(s).width)) + 2 * 14 * k + 6 * k + nt.aw;
      nt.h = lines.length * nt.lh + 20 * k;
      const ys = nt.rows.map((i) => layers[i].yc);
      nt.yT = Math.min(...ys); nt.yB = Math.max(...ys);
      nt.cy = clamp((nt.yT + nt.yB) / 2, box.y0 + nt.h / 2, box.y1 - nt.h / 2);
      nt.rows.forEach((i) => { rowRight[i] = nt.x + nt.w; });
    });
    M.notes = notes;
    // Platz im linken Bereich für Häkchen / Heritage-Start: oben, außer ein Klammer-Label sitzt dort
    const slotFree = (yy) => M.brackets.every((b) => { if (!b.lines.length) return true; const ym = (b.yT + b.yB) / 2, hh = b.lines.length * b.lh / 2 + 20 * k; return Math.abs(yy - ym) > hh + 70 * k; });
    M.slotY = slotFree(ycTop + 6 * k) ? ycTop + 6 * k : slotFree(M.ycBot) ? M.ycBot : ycTop + 6 * k;
    M.syncEv = syncEv;
    M.title = P.title ? String(P.title) : "";
    return M;
  }

  // ---------------- Icons ----------------
  function iconPath(kind, c, x, y, s) {
    const X = (u) => x + u * s, Y = (v) => y + v * s;
    const mv = (u, v) => c.moveTo(X(u), Y(v)), ln = (u, v) => c.lineTo(X(u), Y(v));
    const circ = (u, v, r) => { c.moveTo(X(u) + r * s, Y(v)); c.arc(X(u), Y(v), r * s, 0, Math.PI * 2); };
    switch (kind) {
      case "ropes":
        mv(-0.4, -0.44); ln(0.4, -0.44);
        for (const u of [-0.18, 0, 0.18]) { mv(u, -0.44); ln(u, 0.06); }
        mv(-0.3, 0.06); ln(0.3, 0.06);
        c.rect(X(-0.27), Y(0.14), 0.54 * s, 0.3 * s);
        break;
      case "governor": {
        const cy = 0.2, r = 0.42;
        c.moveTo(X(Math.cos(Math.PI * 1.06) * r), Y(cy + Math.sin(Math.PI * 1.06) * r));
        c.arc(X(0), Y(cy), r * s, Math.PI * 1.06, Math.PI * 1.72);
        for (let q = 0; q < 5; q++) { const a = Math.PI * (1.1 + q * 0.2); mv(Math.cos(a) * r * 0.72, cy + Math.sin(a) * r * 0.72); ln(Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9); }
        mv(0, cy); ln(Math.cos(Math.PI * 1.62) * r * 0.78, cy + Math.sin(Math.PI * 1.62) * r * 0.78);
        circ(0, cy, 0.06);
        mv(-0.46, cy + 0.14); ln(0.46, cy + 0.14);
        break;
      }
      case "brake": {
        circ(-0.08, 0.04, 0.36); circ(-0.08, 0.04, 0.09);
        for (let q = 0; q < 5; q++) { const an = q * 1.2566 + 0.3; circ(-0.08 + Math.cos(an) * 0.22, 0.04 + Math.sin(an) * 0.22, 0.035); }
        roundRect(c, X(0.16), Y(-0.3), 0.3 * s, 0.6 * s, 0.08 * s);
        mv(0.24, -0.18); ln(0.24, 0.18);
        break;
      }
      case "gear":
        mv(0, -0.46); ln(0, 0.46);
        c.rect(X(-0.38), Y(-0.17), 0.76 * s, 0.46 * s);
        mv(-0.06, -0.09); ln(-0.06, 0.21); ln(-0.19, 0.21); c.closePath();
        mv(0.06, -0.09); ln(0.06, 0.21); ln(0.19, 0.21); c.closePath();
        mv(-0.16, -0.12); ln(-0.28, 0.24); mv(0.16, -0.12); ln(0.28, 0.24);
        break;
      case "buffer":
        mv(-0.4, 0.44); ln(0.4, 0.44);
        mv(0, 0.44); for (let q = 1; q <= 7; q++) ln(q < 7 ? (q % 2 ? -0.19 : 0.19) : 0, 0.44 - q * 0.078);
        mv(-0.28, -0.11); ln(0.28, -0.11);
        mv(0, -0.46); ln(0, -0.2); mv(-0.08, -0.29); ln(0, -0.2); ln(0.08, -0.29);
        break;
      case "inspect":
        circ(-0.08, -0.08, 0.27);
        mv(0.12, 0.12); ln(0.38, 0.38);
        mv(-0.21, -0.08); ln(-0.12, 0.02); ln(0.05, -0.19);
        break;
      case "circuit":
        mv(-0.12, -0.32); ln(-0.4, -0.32); ln(-0.4, 0.32); ln(-0.13, 0.32);
        mv(0.13, 0.32); ln(0.4, 0.32); ln(0.4, -0.32); ln(0.14, -0.32);
        mv(-0.12, -0.32); ln(0.1, -0.47);
        circ(-0.12, -0.32, 0.035); circ(0.14, -0.32, 0.035);
        circ(0, 0.32, 0.13);
        mv(-0.09, 0.23); ln(0.09, 0.41); mv(0.09, 0.23); ln(-0.09, 0.41);
        break;
      case "door":
        c.rect(X(-0.36), Y(-0.44), 0.72 * s, 0.88 * s);
        mv(0, -0.44); ln(0, 0.44); mv(-0.1, 0); ln(-0.04, 0); mv(0.04, 0); ln(0.1, 0);
        break;
      case "shield":
        mv(0, -0.44); ln(0.34, -0.3); ln(0.3, 0.1); c.quadraticCurveTo(X(0.22), Y(0.34), X(0), Y(0.46)); c.quadraticCurveTo(X(-0.22), Y(0.34), X(-0.3), Y(0.1)); ln(-0.34, -0.3); c.closePath();
        break;
      default: break;
    }
  }
  function drawIcon(ctx, kind, x, y, s, col, alpha, glow) {
    if (kind === "none" || alpha <= 0.01) return;
    glowStroke(ctx, (c) => iconPath(kind, c, x, y, s), col, Math.max(1.6, s * 0.05), alpha, glow, null, true);
    if (kind === "governor") { // roter Bereich (Übergeschwindigkeit)
      const r = 0.42 * s, cy = y + 0.2 * s;
      glowStroke(ctx, (c) => c.arc(x, cy, r, Math.PI * 1.74, Math.PI * 1.94), COL.red, Math.max(2, s * 0.07), alpha * 0.95, glow * 0.6, null, true);
    }
  }
  /** Otis-Sperre (1854): Zahnleisten an den Schienen, Blattfeder mit Klinken, Seil oben, Plattform unten. */
  function drawOtis(ctx, x, y, s, col, alpha, glow) {
    if (alpha <= 0.01) return;
    glowStroke(ctx, (c) => {
      const X = (u) => x + u * s, Y = (v) => y + v * s;
      for (const sd of [-1, 1]) {
        c.moveTo(X(sd * 0.4), Y(-0.5)); c.lineTo(X(sd * 0.4), Y(0.5));
        for (let q = 0; q < 6; q++) { const y0 = -0.44 + q * 0.155; c.moveTo(X(sd * 0.4), Y(y0)); c.lineTo(X(sd * 0.3), Y(y0)); c.lineTo(X(sd * 0.4), Y(y0 + 0.13)); }
      }
      c.moveTo(X(-0.27), Y(0.02)); c.quadraticCurveTo(X(0), Y(-0.26), X(0.27), Y(0.02));
      c.moveTo(X(-0.27), Y(0.02)); c.lineTo(X(-0.31), Y(-0.04)); c.moveTo(X(0.27), Y(0.02)); c.lineTo(X(0.31), Y(-0.04));
      c.moveTo(X(0), Y(-0.5)); c.lineTo(X(0), Y(-0.12));
      c.moveTo(X(-0.24), Y(0.06)); c.lineTo(X(0.24), Y(0.06));
      c.rect(X(-0.22), Y(0.14), 0.44 * s, 0.24 * s);
    }, col, Math.max(1.8, s * 0.028), alpha, glow);
  }

  // ---------------- Zustand je Schicht ----------------
  function stateOf(M, L, t) {
    const ap = seg(t, L.ta, M.mode === "present" ? 0.38 : 0.5);
    if (ap <= 0) return null;
    const S = { vis: sm(Math.min(1, ap * 1.7)), drop: M.mode === "present" ? (1 - eo(ap)) * 14 * M.k : (1 - eob(ap)) * 34 * M.k };
    let lit = L.tLit === Infinity ? 0 : sm(seg(t, L.tLit, 0.35));
    let hot = L.tHot === Infinity ? 0 : sm(seg(t, L.tHot, 0.45));
    let hotCol = L.hotCol, boost = 0;
    for (const e of L.syncEv) {
      if (t < e.t) continue;
      const q = sm(seg(t, e.t, 0.3));
      lit = Math.max(lit, q); boost = Math.max(boost, q);
      const h = q * (1 - sm(seg(t, e.next, 0.5)));
      if (h > hot) { hot = h; hotCol = COL.amber; }
    }
    let fin = 0;
    if (M.fin) {
      fin = sm(seg(t, M.fin.t + L.rank * M.fin.step, 0.4));
      if (fin > 0) { lit = Math.max(lit, fin); if (M.fin.cyan) hot *= 1 - fin; else { hot = Math.max(hot, fin); hotCol = COL.amber; } }
    }
    let dead = 0, flick = 1;
    if (L.tEx !== Infinity && t >= L.tEx) {
      const q = t - L.tEx;
      if (q < 0.62) flick = h01(Math.floor(q * 26) * 1.7 + L.i * 13.1) > 0.45 ? 1 : 0.18;
      dead = sm(seg(t, L.tEx + 0.45, 0.4));
    }
    let flash = 0;
    for (const e of L.events) { const q = t - e.t; if (q >= 0 && q < 0.6) flash = Math.max(flash, Math.pow(1 - q / 0.6, 2) * e.s); }
    let col = COL.cyan;
    if (hot > 0.002) col = hotMix(COL.cyan, hotCol, hot);
    if (dead > 0) col = mix(col, COL.red, dead);
    S.base = col;
    if (flash > 0.02 && dead < 0.5) col = mix(col, "#ffffff", flash * 0.5);
    const on = Math.max(lit, hot) * (1 - dead);
    const breathe = 1 + 0.1 * Math.sin(t * 2.1 + L.rank * 0.9) * on + 0.12 * fin * (0.5 + 0.5 * Math.sin(t * 3.2));
    Object.assign(S, { lit, hot, fin, dead, flick, flash, col, on, boost, breathe });
    S.sa = S.vis * (0.34 + 0.66 * Math.max(on, dead * 0.7)) * flick;
    S.glow = (on * (0.75 + 0.25 * boost + 0.3 * fin) + flash * 0.7) * breathe * flick;
    S.fa = S.vis * ((0.03 + 0.1 * on + 0.06 * hot + 0.05 * fin + 0.03 * boost) * breathe * (1 - 0.8 * dead) + 0.03 * dead) * flick;
    return S;
  }

  // ---------------- Zeichnen: Platte ----------------
  function platePath(c, cx, y, A, B) { c.moveTo(cx - A, y); c.lineTo(cx, y - B); c.lineTo(cx + A, y); c.lineTo(cx, y + B); c.closePath(); }
  function drawPlate(ctx, M, L, S, t) {
    const { A, B, th, cx } = M; const y = L.yc - S.drop; const col = S.col;
    ctx.save();
    // dunkle Grundfläche dämpft die Linien dahinter (Tiefe), danach farbige Füllungen
    ctx.globalAlpha = S.vis * 0.42;
    ctx.fillStyle = "#040b18";
    ctx.beginPath(); platePath(ctx, cx, y, A, B); ctx.moveTo(cx - A, y); ctx.lineTo(cx, y + B); ctx.lineTo(cx + A, y); ctx.lineTo(cx + A, y + th); ctx.lineTo(cx, y + B + th); ctx.lineTo(cx - A, y + th); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = rgba(col, S.fa * 1.25);
    ctx.beginPath(); ctx.moveTo(cx - A, y); ctx.lineTo(cx, y + B); ctx.lineTo(cx, y + B + th); ctx.lineTo(cx - A, y + th); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba(col, S.fa * 0.7);
    ctx.beginPath(); ctx.moveTo(cx, y + B); ctx.lineTo(cx + A, y); ctx.lineTo(cx + A, y + th); ctx.lineTo(cx, y + B + th); ctx.closePath(); ctx.fill();
    const g = ctx.createLinearGradient(cx - A * 0.3, y - B, cx + A * 0.3, y + B);
    g.addColorStop(0, rgba(col, S.fa * 1.7)); g.addColorStop(1, rgba(col, S.fa * 0.55));
    ctx.fillStyle = g; ctx.beginPath(); platePath(ctx, cx, y, A, B); ctx.fill();
    ctx.restore();
    const dash = S.dead > 0.3 ? [9, 7] : null;
    // Seitenkanten
    glowStroke(ctx, (c) => {
      c.moveTo(cx - A, y); c.lineTo(cx - A, y + th); c.lineTo(cx, y + B + th); c.lineTo(cx + A, y + th); c.lineTo(cx + A, y);
      c.moveTo(cx, y + B); c.lineTo(cx, y + B + th);
    }, col, 1.3, S.sa * 0.75, 0, dash);
    // Innendetails (Blueprint): eingerückte Raute + Schraffur im vorderen Bereich
    const on = S.on;
    if (S.vis > 0.05) {
      const ia = S.vis * (0.12 + 0.3 * on) * S.flick;
      ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.globalAlpha = clamp(ia, 0, 1);
      ctx.beginPath(); platePath(ctx, cx, y, A * 0.8, B * 0.8);
      const ex = A / 2, ey = B / 2;
      for (let q = 1; q <= 3; q++) { const a = 0.2 + q * 0.18; ctx.moveTo(cx + a * ex - 0.8 * ex, y + a * ey + 0.8 * ey); ctx.lineTo(cx + a * ex + 0.8 * ex, y + a * ey - 0.8 * ey); }
      if (dash) ctx.setLineDash([4, 5]);
      ctx.stroke(); ctx.restore();
    }
    // Oberkante (glühend)
    glowStroke(ctx, (c) => platePath(c, cx, y, A, B), col, 2 + 0.6 * on, S.sa, S.glow, dash);
    // Scanlinie über fokussierter Platte
    if (S.hot > 0.05 && S.dead < 0.5) {
      const ex = A / 2, ey = B / 2;
      const a = -0.85 + 1.7 * ((t * 0.45 + L.rank * 0.13) % 1);
      glowStroke(ctx, (c) => { c.moveTo(cx + a * ex - 0.9 * ex * (1 - Math.abs(a) * 0.1), y + a * ey + 0.9 * ey); c.lineTo(cx + a * ex + 0.9 * ex, y + a * ey - 0.9 * ey); }, col, 1.6, S.hot * 0.5 * S.vis, 0.8);
    }
    // erloschen: rotes Kreuz auf der Platte (entlang der Iso-Achsen)
    if (S.dead > 0.02) {
      const ex = A / 2, ey = B / 2, r = 0.42, q = S.dead;
      const ox = cx + 0.1 * A, oy = y + 0.12 * B;
      glowStroke(ctx, (c) => {
        c.moveTo(ox - r * ex, oy - r * ey); c.lineTo(ox + (2 * q - 1) * r * ex, oy + (2 * q - 1) * r * ey);
        c.moveTo(ox - r * ex, oy + r * ey); c.lineTo(ox + (2 * q - 1) * r * ex, oy - (2 * q - 1) * r * ey);
      }, COL.red, 3, 0.85 * S.vis, 0.9);
    }
    // Klick-Impuls: Raute dehnt sich aus
    for (const e of L.events) {
      if (!e.ring) continue;
      const q = (t - e.t) / 0.7; if (q < 0 || q >= 1) continue;
      const sc = 1 + 0.28 * eo(q);
      glowStroke(ctx, (c) => platePath(c, cx, y, A * sc, B * sc), e.col, 2, (1 - q) * 0.8 * S.vis * e.s, 1);
    }
  }

  // ---------------- Zeichnen: Karte ----------------
  function drawCard(ctx, M, L, S, t) {
    const cv = sm(seg(t, L.ta + 0.1, 0.42)); if (cv <= 0.003) return;
    const { CH, bs, is, pad, k } = M;
    const on = S.on, col = S.col;
    const x = M.cardX + (1 - eo(cv)) * 26 * k, y = L.yc - CH / 2, w = L.cw;
    const a = cv * S.flick;
    // Führungslinie Platte → Karte
    const vx = M.cx + M.A, vy = L.yc - S.drop;
    glowStroke(ctx, (c) => { c.moveTo(vx + 5, vy); c.lineTo(x - 3, L.yc); }, col, 1.5, a * (0.35 + 0.6 * on), on * 0.5, null, true);
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(vx, vy, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // Panel
    ctx.save(); ctx.globalAlpha = a * 0.86; ctx.fillStyle = COL.panel; ctx.beginPath(); roundRect(ctx, x, y, w, CH, 8 * k); ctx.fill(); ctx.restore();
    if (on > 0.02 || S.dead > 0.02) { ctx.save(); ctx.globalAlpha = a * (0.1 * on + 0.08 * S.hot + 0.05 * S.dead) * S.breathe; ctx.fillStyle = col; ctx.beginPath(); roundRect(ctx, x, y, w, CH, 8 * k); ctx.fill(); ctx.restore(); }
    glowStroke(ctx, (c) => roundRect(c, x, y, w, CH, 8 * k), col, 1.4 + 0.5 * S.hot, a * (0.26 + 0.5 * on + 0.2 * S.hot + 0.3 * S.dead), (0.25 * on + 0.5 * S.hot + 0.4 * S.flash) * S.breathe, S.dead > 0.3 ? [8, 6] : null, S.hot < 0.3 && S.flash < 0.3);
    // Akzentbalken links
    if (on > 0.02 || S.dead > 0.02) { ctx.save(); ctx.globalAlpha = a * Math.max(on, S.dead * 0.8); ctx.fillStyle = col; ctx.beginPath(); roundRect(ctx, x + 1, y + CH * 0.18, 4 * k, CH * 0.64, 2); ctx.fill(); ctx.restore(); }
    // Nummer
    const bx = x + pad, by = L.yc - bs / 2;
    const numCol = S.dead > 0.5 ? COL.red : on > 0.3 ? col : COL.muted;
    if (M.numbered) {
      glowStroke(ctx, (c) => roundRect(c, bx, by, bs, bs, 5 * k), numCol, 1.4, a * (0.4 + 0.5 * on + 0.3 * S.dead), 0.5 * on, null, true);
      txt(ctx, L.num, bx + bs / 2, L.yc + bs * 0.2, { font: F_MONO, weight: 700, size: bs * 0.56, align: "center", color: on > 0.3 ? mix(col, "#ffffff", 0.25) : numCol, alpha: a * (0.55 + 0.45 * Math.max(on, S.dead)) });
    }
    // Icon
    const icx = bx + (M.numbered ? bs + 12 * k : 0) + is / 2;
    const iconCol = S.dead > 0.5 ? mix(COL.muted, COL.red, 0.6) : on > 0.02 ? col : COL.muted;
    drawIcon(ctx, L.kind, icx, L.yc, is, iconCol, a * (0.45 + 0.55 * on), on * 0.7 + S.flash * 0.5);
    // Label
    const tx = x + (M.numbered ? M.textX0 : M.textX0 - bs - 12 * k);
    const lc = S.dead > 0.02 ? mix(COL.white, "#c98d90", S.dead) : on > 0.02 ? mix(COL.muted, COL.white, on) : COL.muted;
    const la = a * (0.62 + 0.38 * on) * (1 - 0.3 * S.dead);
    if (L.lines.length === 1) txt(ctx, L.lines[0], tx, L.yc + L.lf * 0.36, { size: L.lf, weight: 600, color: lc, alpha: la });
    else { const lh = L.lf * 1.12; L.lines.forEach((s, j) => txt(ctx, s, tx, L.yc + (j - (L.lines.length - 1) / 2) * lh + L.lf * 0.36, { size: L.lf, weight: 600, color: lc, alpha: la })); }
  }

  // ---------------- Zeichnen: Klammer ----------------
  function drawBracket(ctx, M, br, t) {
    const q = eo(seg(t, br.at, 0.6)); if (q <= 0.003) return;
    const { k } = M; const x = br.x, ym = (br.yT + br.yB) / 2, col = br.col;
    const yT = lerp(ym, br.yT, q), yB = lerp(ym, br.yB, q);
    const tickX = M.cx - M.A - 9 * k, r = Math.min(12 * k, (br.yB - br.yT) / 2);
    const pulse = 0.85 + 0.15 * Math.sin(t * 2.4);
    glowStroke(ctx, (c) => {
      if (br.yB - br.yT < 4) { c.moveTo(x, ym); c.lineTo(tickX, ym); return; }
      c.moveTo(lerp(x, tickX, q), yT); c.lineTo(x + r, yT); c.arcTo(x, yT, x, yT + r, r); c.lineTo(x, ym - 9 * k); c.lineTo(x - 11 * k, ym); c.lineTo(x, ym + 9 * k); c.lineTo(x, yB - r); c.arcTo(x, yB, x + r, yB, r); c.lineTo(lerp(x, tickX, q), yB);
    }, col, 2, q * 0.95, 0.8 * pulse);
    // weitere Ziel-Schichten (zwischen den Enden) mit kurzen Ticks
    br.rows.forEach((i) => {
      const yy = M.layers[i].yc;
      if (Math.abs(yy - br.yT) > 2 && Math.abs(yy - br.yB) > 2) glowStroke(ctx, (c) => { c.moveTo(x, yy); c.lineTo(lerp(x, tickX, q), yy); }, col, 1.6, q * 0.8, 0.5);
      ctx.save(); ctx.globalAlpha = q; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(tickX + 3, yy, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
    // Label (rechtsbündig links neben der Kerbe)
    if (!br.lines.length) return;
    const la = sm(seg(t, br.at + 0.25, 0.45)); if (la <= 0.003) return;
    const padX = 14 * k, padY = 10 * k;
    const w = br.lw + 2 * padX, h = br.lines.length * br.lh + 2 * padY - (br.lh - br.f);
    const px = x - 22 * k - w, py = clamp(ym - h / 2, M.box.y0, M.box.y1 - h);
    const sl = (1 - eo(la)) * 14 * k;
    ctx.save(); ctx.globalAlpha = la * 0.9; ctx.fillStyle = COL.panel; ctx.beginPath(); roundRect(ctx, px - sl, py, w, h, 7 * k); ctx.fill(); ctx.restore();
    glowStroke(ctx, (c) => roundRect(c, px - sl, py, w, h, 7 * k), col, 1.3, la * 0.75, 0.3, null, true);
    glowStroke(ctx, (c) => { c.moveTo(px - sl + w, ym); c.lineTo(x - 11 * k, ym); }, col, 1.4, la * 0.8, 0.3, null, true);
    br.lines.forEach((line, j) => {
      const yb = py + padY + br.f * 0.8 + j * br.lh;
      drawRich(ctx, line, px - sl + w - padX, yb, br.f, la, col);
    });
  }
  /** Rechtsbündige Zeile, Logik-Wörter (UND/ODER) in Akzentfarbe/Mono. */
  function drawRich(ctx, line, xr, yb, f, alpha, accent) {
    const words = line.split(" ");
    const parts = words.map((w) => {
      const m = w.match(LOGIC);
      const o = m ? { s: w, font: F_MONO, weight: 700, size: f * 0.92, color: accent } : { s: w, font: F_BODY, weight: 600, size: f, color: COL.white };
      setFont(ctx, o.weight, o.size, o.font, 0); o.w = ctx.measureText(w).width; return o;
    });
    setFont(ctx, 600, f, F_BODY, 0); const sp = ctx.measureText(" ").width;
    const total = parts.reduce((s, o) => s + o.w, 0) + sp * (parts.length - 1);
    let x = xr - total;
    for (const o of parts) { txt(ctx, o.s, x, yb, { font: o.font, weight: o.weight, size: o.size, color: o.color, alpha }); x += o.w + sp; }
  }

  // ---------------- Zeichnen: Hinweis ----------------
  function drawNote(ctx, M, nt, t) {
    const q = seg(t, nt.at, 0.55); if (q <= 0.003) return;
    const { k } = M; const col = nt.col; const a = sm(q);
    const x = nt.x + (1 - eo(q)) * 18 * k, y = nt.cy - nt.h / 2;
    // Verbinder
    if (nt.rows.length > 1) {
      glowStroke(ctx, (c) => {
        nt.rows.forEach((i) => { const L = M.layers[i]; c.moveTo(Math.min(nt.xc - 6, M.cardX + L.cw + 4), L.yc); c.lineTo(nt.xc, L.yc); });
        c.moveTo(nt.xc, nt.yT); c.lineTo(nt.xc, nt.yB); c.moveTo(nt.xc, nt.cy); c.lineTo(x - 2, nt.cy);
      }, col, 1.5, a * 0.8, 0.4, null, true);
    } else {
      const L = M.layers[nt.rows[0]];
      const x0 = Math.min(x - 2, nt.lx);
      glowStroke(ctx, (c) => { c.moveTo(x0, L.yc); c.lineTo(x - 2, nt.cy); }, col, 1.5, a * 0.8, 0.4, null, true);
    }
    const w = nt.w * (0.3 + 0.7 * eo(q));
    ctx.save(); ctx.globalAlpha = a * 0.9; ctx.fillStyle = COL.panel; ctx.beginPath(); roundRect(ctx, x, y, w, nt.h, 7 * k); ctx.fill();
    ctx.globalAlpha = a * 0.08; ctx.fillStyle = col; ctx.fill(); ctx.restore();
    glowStroke(ctx, (c) => roundRect(c, x, y, w, nt.h, 7 * k), col, 1.4, a * 0.85, 0.45 * (0.85 + 0.15 * Math.sin(t * 2.2)), null, true);
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(x + 1, y + nt.h * 0.2, 3.5 * k, nt.h * 0.6); ctx.restore();
    const ta = sm(seg(t, nt.at + 0.18, 0.4));
    const tc = col === COL.red ? "#ffc2c4" : col === COL.amber ? "#ffe2b8" : col === COL.green ? "#c9f7dd" : COL.white;
    if (nt.aw) { // kleiner Richtungspfeil vor dem Text
      const ax = x + 17 * k + nt.aw * 0.35, ay = nt.cy, r = nt.f * 0.42;
      const dir = String(nt.arrow).toLowerCase();
      const ang = /down|unten|runter/.test(dir) ? Math.PI / 2 : /up|oben|hoch/.test(dir) ? -Math.PI / 2 : /left/.test(dir) ? Math.PI : 0;
      const bob = Math.sin(t * 3) * 2.5 * ta;
      const cx2 = ax + Math.cos(ang) * bob, cy2 = ay + Math.sin(ang) * bob;
      glowStroke(ctx, (c) => {
        c.moveTo(cx2 - Math.cos(ang) * r, cy2 - Math.sin(ang) * r); c.lineTo(cx2 + Math.cos(ang) * r, cy2 + Math.sin(ang) * r);
        c.moveTo(cx2 + Math.cos(ang) * r + Math.cos(ang + 2.4) * r * 0.7, cy2 + Math.sin(ang) * r + Math.sin(ang + 2.4) * r * 0.7);
        c.lineTo(cx2 + Math.cos(ang) * r, cy2 + Math.sin(ang) * r);
        c.lineTo(cx2 + Math.cos(ang) * r + Math.cos(ang - 2.4) * r * 0.7, cy2 + Math.sin(ang) * r + Math.sin(ang - 2.4) * r * 0.7);
      }, col, 2.4, ta, 0.8);
    }
    nt.lines.forEach((s, j) => txt(ctx, s, x + 14 * k + 3 * k + nt.aw, y + 10 * k + nt.f * 0.82 + j * nt.lh, { size: nt.f, weight: 600, color: tc, alpha: ta }));
  }

  // ---------------- Zeichnen: Heritage (Otis-Sperre wandert in die Schicht) ----------------
  function drawHeritage(ctx, M, t) {
    const H = M.heritage; if (!H) return;
    const q0 = seg(t, H.t, 0.4); if (q0 <= 0) return;
    const L = M.layers[H.i]; const { k, A, B, cx } = M;
    const sx = M.lzx, sy = M.slotY + 6 * k;
    const ex = cx + 0.38 * A, ey = L.yc - 0.12 * B - 30 * k;
    const mv = eio(seg(t, H.t + 0.75, 0.95));
    const s = lerp(100 * k, 70 * k, mv);
    const cxp = lerp(sx, ex, mv), cyp = lerp(sy, ey, mv) - Math.sin(mv * Math.PI) * 60 * k;
    const arrive = H.t + 1.7;
    const settle = sm(seg(t, arrive, 0.5));
    const col = COL.amber;
    // Flugbahn (gestrichelt, verblasst nach Ankunft)
    if (mv > 0 && settle < 1) {
      ctx.save(); ctx.globalAlpha = 0.35 * (1 - settle) * sm(q0); ctx.strokeStyle = COL.amber; ctx.lineWidth = 1.5; ctx.setLineDash([6, 8]); ctx.lineDashOffset = -t * 40;
      ctx.beginPath(); for (let j = 0; j <= 20; j++) { const u = (j / 20) * mv; const px = lerp(sx, ex, u), py = lerp(sy, ey, u) - Math.sin(u * Math.PI) * 60 * k; if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke(); ctx.restore();
    }
    // Sockel-Schatten auf der Platte nach Ankunft
    if (settle > 0) {
      ctx.save(); ctx.globalAlpha = settle * 0.5; ctx.translate(ex, ey + s * 0.52); ctx.scale(1, B / A);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.7); g.addColorStop(0, rgba(COL.amber, 0.55)); g.addColorStop(1, rgba(COL.amber, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    const flash = t >= arrive ? Math.pow(1 - seg(t, arrive, 0.6), 2) : 0;
    drawOtis(ctx, cxp, cyp, s, mix(col, "#ffffff", flash * 0.6), sm(q0), 0.8 + flash + 0.15 * Math.sin(t * 2.3));
    if (flash > 0.01) glowStroke(ctx, (c) => platePath(c, cx, L.yc, A * (1 + 0.25 * (1 - flash)), B * (1 + 0.25 * (1 - flash))), COL.amber, 2, flash * 0.8, 1);
    // Beschriftung am Startpunkt (blendet beim Flug aus)
    if (H.label) {
      const la = sm(q0) * (1 - sm(seg(t, H.t + 0.8, 0.5)));
      txt(ctx, H.label, sx, sy + 96 * k * 0.5 + 34 * k, { size: 24 * k, weight: 600, color: "#ffe2b8", align: "center", alpha: la });
      const la2 = sm(seg(t, arrive + 0.1, 0.5));
      if (la2 > 0) {
        const fs = 20 * k; setFont(ctx, 600, fs, F_BODY, 0); const tw = ctx.measureText(H.label).width;
        const lx = ex + 44 * k, ly = ey - 10 * k;
        ctx.save(); ctx.globalAlpha = la2 * 0.85; ctx.fillStyle = COL.panel; ctx.beginPath(); roundRect(ctx, lx - 8 * k, ly - fs * 0.95, tw + 16 * k, fs * 1.4, 5 * k); ctx.fill(); ctx.restore();
        txt(ctx, H.label, lx, ly, { size: fs, weight: 600, color: "#ffe2b8", alpha: la2 });
      }
    }
  }

  // ---------------- Zeichnen: Finale-Häkchen ----------------
  function drawCheck(ctx, M, t) {
    const F = M.fin; if (!F || !F.check) return;
    const t0 = F.t + Math.min(0.3, M.n * F.step * 0.6);
    const q = seg(t, t0, 0.55); if (q <= 0) return;
    const { k } = M; const r = 46 * k; const x = M.lzx, y = M.slotY;
    const col = F.cyan ? COL.cyan : COL.amber;
    const sc = eob(q), a = sm(q * 1.5);
    glowDot(ctx, x, y, r * 2.2, col, 0.35 * a * (0.8 + 0.2 * Math.sin(t * 3)));
    ctx.save(); ctx.globalAlpha = a * 0.9; ctx.fillStyle = COL.panel; ctx.beginPath(); ctx.arc(x, y, r * sc, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    glowStroke(ctx, (c) => c.arc(x, y, r * sc, 0, Math.PI * 2), col, 3, a, 1);
    const cp = eo(seg(t, t0 + 0.12, 0.38));
    if (cp > 0) {
      const pts = [[-0.42, 0.02], [-0.12, 0.32], [0.46, -0.3]];
      const l1 = Math.hypot(0.3, 0.3), l2 = Math.hypot(0.58, 0.62), tot = l1 + l2; const d = cp * tot;
      glowStroke(ctx, (c) => {
        c.moveTo(x + pts[0][0] * r, y + pts[0][1] * r);
        if (d <= l1) { const u = d / l1; c.lineTo(x + lerp(pts[0][0], pts[1][0], u) * r, y + lerp(pts[0][1], pts[1][1], u) * r); }
        else { c.lineTo(x + pts[1][0] * r, y + pts[1][1] * r); const u = (d - l1) / l2; c.lineTo(x + lerp(pts[1][0], pts[2][0], u) * r, y + lerp(pts[1][1], pts[2][1], u) * r); }
      }, "#ffffff", 5.5 * k, a, 0.9);
    }
    const rq = seg(t, t0, 0.9);
    if (rq > 0 && rq < 1) glowStroke(ctx, (c) => c.arc(x, y, r * (1 + 0.9 * eo(rq)), 0, Math.PI * 2), col, 2, (1 - rq) * 0.7, 1);
    if (F.label) txt(ctx, F.label, x, y + r + 36 * k, { size: 24 * k, weight: 700, font: F_HEAD, ls: 1.5, color: COL.white, align: "center", alpha: sm(seg(t, t0 + 0.4, 0.5)) });
  }

  // ---------------- Umgebung (Boden, Stützlinien) ----------------
  function drawEnv(ctx, M, t, S0) {
    const { cx, A, B, th, k } = M;
    const yb = M.ycBot + th + 8 * k;
    const vis = S0;
    if (vis <= 0) return;
    ctx.save(); ctx.globalAlpha = vis * 0.55; ctx.translate(cx, yb); ctx.scale(1, B / A);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, A * 1.35);
    g.addColorStop(0, "rgba(63,210,255,0.16)"); g.addColorStop(0.6, "rgba(63,210,255,0.05)"); g.addColorStop(1, "rgba(63,210,255,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, A * 1.35, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // Stützlinien an den Außenecken (Explosionsdarstellung)
    if (M.n > 1) {
      const yT = M.ycTop, yB = M.ycBot + th;
      const fq = M.fin ? sm(seg(t, M.fin.t, 0.8)) : 0;
      ctx.save(); ctx.lineWidth = 1; ctx.setLineDash([3, 7]); ctx.lineDashOffset = fq > 0 ? t * 30 : 0;
      ctx.strokeStyle = fq > 0 ? mix("#2d6f8c", COL.cyan, fq) : "#2d6f8c"; ctx.globalAlpha = vis * (0.55 + 0.35 * fq);
      ctx.beginPath(); ctx.moveTo(cx - A, yT); ctx.lineTo(cx - A, yB); ctx.moveTo(cx + A, yT); ctx.lineTo(cx + A, yB); ctx.moveTo(cx, yT - B); ctx.lineTo(cx, M.ycBot - B); ctx.stroke(); ctx.restore();
    }
  }

  // ---------------- Template ----------------
  CEX.register("layers_overview", {
    draw(ctx, p) {
      const M = getModel(ctx, p);
      const t = p.t;
      const states = M.layers.map((L) => stateOf(M, L, t));
      const firstVis = Math.max(0, ...states.map((S) => (S ? S.vis : 0)));
      drawEnv(ctx, M, t, firstVis);
      // Platten von unten nach oben
      const order = M.layers.slice().sort((a, b) => a.rank - b.rank);
      for (const L of order) { const S = states[L.i]; if (S) drawPlate(ctx, M, L, S, t); }
      for (const br of M.brackets) drawBracket(ctx, M, br, t);
      for (const L of order) { const S = states[L.i]; if (S) drawCard(ctx, M, L, S, t); }
      for (const nt of M.notes) drawNote(ctx, M, nt, t);
      drawHeritage(ctx, M, t);
      drawCheck(ctx, M, t);
      if (M.title) {
        const a = sm(seg(t, 0.3, 0.6));
        const y = M.ycTop - M.CH / 2 - 22 * M.k;
        txt(ctx, M.title.toLocaleUpperCase("de-DE"), M.cardX, y, { size: 22 * M.k, weight: 700, font: F_HEAD, ls: 3, color: COL.muted, alpha: a });
      }
    },
  });
})();
