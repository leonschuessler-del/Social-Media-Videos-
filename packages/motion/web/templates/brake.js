/* Template "brake" – Triebwerksbremse (Maschinenbremse) einer Treibscheibenmaschine, Röntgen-/Blueprint-Stil.
   Axialansicht: Bremstrommel auf der Motorwelle, zwei Bremshebel mit Bremsbacken + Bremsbelägen (zwei unabhängige
   Bremskreise), Druckfedern auf der Zugstange drücken die Hebel an die Trommel, Bremslüftmagnet oben: bestromt drückt er
   die Hebel auseinander (Bremse gelüftet, Luftspalt, Trommel dreht). Stromlos schließen die Federn die Bremse (fail-safe).
   Optionales Inset "Sicherheitskreis": Netz -> Tür-Kontakt -> Schalter am Begrenzer -> Motor + Bremse.

   BEATS (params.beats, Sekunden ab Szenenstart):
     [0] = Strom aus (Kontakt öffnet, Stromfluss stoppt, Blitz erlischt, Magnet wird dunkel, Motor aus)
           bzw. bei off->on: Strom an (Kontakt schließt, Magnet leuchtet)
     [1] = Bremse fällt ein (Federn strecken sich, Beläge klemmen, Funken, Trommel steht nach ca. 0,5–0,8 s)
           bzw. bei off->on: Bremse lüftet (Hebel öffnen, Trommel läuft an)
     [2] = Kraft-Betonung (Federkraft-Pfeile + Beläge pulsen; im gelüfteten Zustand: Magnetkraft-Pfeile)
     [3] = Bremskreis 1 / Bremskreis 2 hervorheben (Umriss-Glühen je Hebel/Backe/Feder + Labels)
   "at" (Sekunden) akzeptieren: labels[] (Statuskarten links), parts[] (Bauteil-Beschriftungen rechts),
     circuits[] (Bremskreis-Labels). Alle Zeiten werden auf [0,3 ; d-0,3] begrenzt; einmal sichtbar bleibt alles stehen.

   Params:
     power        "on" | "off" | "on_off" | "off_on" (Default: Sequenz on -> off). "off" = Sequenz on -> off
                  (statisch zu nur mit power_from:"off"); "on" = statisch gelüftet (off -> on mit power_from:"off").
                  Aliase: an/aus/true/false/stromausfall/zu/gelüftet …   power_from  "on" | "off"
     switch_inset bool (Default false) – Inset Sicherheitskreis links oben (Schalter öffnet, Motor + Bremse stromlos)
     switch_label Text unter dem Schaltkontakt (Default "Begrenzer")   contacts  weitere Kontakte (Default ["Tür"])
     circuit_title Default "Sicherheitskreis"
     labels       Statuskarten: [string | {text, at, target, color}] – target: switch|motor|magnet|brake|spring|lining|drum|circuits
                  (sonst per Stichwort erkannt), color: red|amber|cyan|green. Default je nach Modus, z. B.
                  ["Sicherheitskreis offen","Motor aus","Stromausfall = Bremse zu"]; [] = keine.
     parts        true | false | [key | {part, text, sub, at}] – key: magnet|spring|lining|drum (Default alle vier)
     circuits     true | false | [string | {text, at}] (Default ["Bremskreis 1","Bremskreis 2"] zu beats[3], +0,35 s; circuits_at = Startzeit)
     sparks       bool (Default true)   force_arrows bool (Default true)   failsafe_label  Text der Default-Karte */
(function () {
  "use strict";
  const CE = window.CE;
  if (!CE || typeof CE.register !== "function") return;

  const TAU = Math.PI * 2, D2R = Math.PI / 180;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, dur) => clamp((t - a) / Math.max(1e-6, dur));
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
  const easeIn = (x) => Math.pow(clamp(x), 2.2);
  const easeOutBack = (x) => { x = clamp(x); const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const h01 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  const COL = { cyan: "#3fd2ff", amber: "#ffb347", red: "#ff5a5f", white: "#eef6ff", muted: "#8fb3d9", steel: "#9fc4e6", hot: "#fff1cf", navy: "#07142a", panel: "#040c1a", green: "#5be49b", flow: "#c8f3ff" };
  const RGB = {};
  const rgbOf = (hex) => { let c = RGB[hex]; if (!c) { const n = parseInt(hex.slice(1), 16); c = RGB[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; } return c; };
  const rgba = (hex, a) => { const c = rgbOf(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  const mix = (h1, h2, k) => { const a = rgbOf(h1), b = rgbOf(h2); k = clamp(k); return `rgb(${Math.round(lerp(a[0], b[0], k))},${Math.round(lerp(a[1], b[1], k))},${Math.round(lerp(a[2], b[2], k))})`; };

  // ---------- Geometrie (px) ----------
  const DY = 570, R = 138, LIN = 12, SHOE = 20, SPAN = 46 * D2R; // Trommelmitte y, Trommelradius, Belag, Backe, halber Backenwinkel
  const AX = 204, AP = 830, AT = 281, PY = 292, SY = 386, NUT = 350, BASE_Y = 850; // Hebel x, Drehpunkt y, Hebelende, Stößel, Federachse, Federteller
  const GAP = 18, PHI = Math.asin(GAP / (AP - DY)); // Luftspalt am Belag (gelüftet, überzeichnet), Hebelwinkel
  const MW = 95, MH = 55, CABLE_Y = 260, SPR_AMP = 17, SPR_N = 7;
  const INS = { x: 170, y: 222, w: 480, h: 276 };
  const LA = AP - AT;

  // ---------- Zeichen-Helfer (Gruppen-Alpha GA) ----------
  let GA = 1;
  function stk(ctx, build, color, w, glow, alpha, o) {
    const a = Math.min(1, GA * (alpha == null ? 1 : alpha)); if (!(a > 0.004)) return;
    ctx.save(); ctx.lineCap = (o && o.cap) || "round"; ctx.lineJoin = "round"; ctx.strokeStyle = color;
    if (o && o.dash) { ctx.setLineDash(o.dash); ctx.lineDashOffset = o.dashOff || 0; }
    ctx.beginPath(); build(ctx);
    if (glow > 0) { ctx.globalAlpha = a * Math.min(1, 0.24 * glow); ctx.lineWidth = w * 3.4; ctx.stroke(); }
    ctx.globalAlpha = a; ctx.lineWidth = w; ctx.stroke(); ctx.restore();
  }
  function fil(ctx, build, color, alpha) { const a = Math.min(1, GA * alpha); if (!(a > 0.004)) return; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = color; ctx.beginPath(); build(ctx); ctx.fill(); ctx.restore(); }
  function txt(L, ctx, s, x, y, o) { const a = Math.min(1, GA * (o.alpha == null ? 1 : o.alpha)); if (!(a > 0.004)) return; L.text(ctx, s, x, y, Object.assign({}, o, { alpha: a })); }
  function dot(ctx, x, y, r, color, alpha) {
    const a = Math.min(1, GA * alpha); if (!(a > 0.004) || !(r > 0.5)) return;
    ctx.save(); ctx.globalAlpha = a; const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, 0.95)); g.addColorStop(0.3, rgba(color, 0.38)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
  }
  const rr = (c, x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  function arrow(ctx, x1, y1, x2, y2, color, w, head, alpha) {
    const ang = Math.atan2(y2 - y1, x2 - x1), hx = x2 - Math.cos(ang) * head * 0.7, hy = y2 - Math.sin(ang) * head * 0.7;
    stk(ctx, (c) => { c.moveTo(x1, y1); c.lineTo(hx, hy); }, color, w, 0.8, alpha);
    fil(ctx, (c) => { c.moveTo(x2, y2); c.lineTo(x2 - Math.cos(ang - 0.42) * head, y2 - Math.sin(ang - 0.42) * head); c.lineTo(x2 - Math.cos(ang + 0.42) * head, y2 - Math.sin(ang + 0.42) * head); c.closePath(); }, color, alpha);
  }
  const BOLT = [[0.2, -1], [-0.5, 0.14], [-0.06, 0.14], [-0.22, 1], [0.52, -0.18], [0.08, -0.18]];
  const boltB = (x, y, s) => (c) => { BOLT.forEach((q, i) => (i ? c.lineTo(x + q[0] * s, y + q[1] * s) : c.moveTo(x + q[0] * s, y + q[1] * s))); c.closePath(); };
  function drawBolt(ctx, x, y, s, lit, alpha) {
    if (lit > 0.01) { dot(ctx, x, y, s * 2.8, COL.cyan, 0.55 * lit * alpha); fil(ctx, boltB(x, y, s), COL.cyan, lit * alpha); }
    stk(ctx, boltB(x, y, s), lit > 0.5 ? COL.white : COL.muted, 1.6, 0.5 * lit, (0.3 + 0.7 * lit) * alpha);
  }
  const annulus = (c, r0, r1, a0, a1) => { c.arc(0, 0, r1, a0, a1); c.arc(0, 0, r0, a1, a0, true); c.closePath(); };

  // ---------- Sprite-Cache (statische Teile einmal rastern) ----------
  const SPR = new Map();
  function blit(ctx, key, w, h, ox, oy, alpha, drawFn) { // Sprite mit lokalem Ursprung (ox, oy) im Canvas, gezeichnet am aktuellen Ursprung
    const a = Math.min(1, GA * alpha); if (!(a > 0.004)) return;
    let e = SPR.get(key);
    if (e === undefined) {
      e = null;
      try {
        const cv = document.createElement("canvas"); cv.width = Math.ceil(w); cv.height = Math.ceil(h);
        const g = cv.getContext("2d");
        if (g) { g.translate(ox, oy); const sG = GA; GA = 1; try { drawFn(g); } finally { GA = sG; } e = cv; }
      } catch (err) { e = null; }
      if (SPR.size > 80) SPR.clear();
      SPR.set(key, e);
    }
    if (e) { const sa = ctx.globalAlpha; ctx.globalAlpha = a; ctx.drawImage(e, -ox, -oy); ctx.globalAlpha = sa; }
    else { const sG = GA; GA = a; drawFn(ctx); GA = sG; }
  }
  const MEAS = new Map();
  function meas(L, ctx, text, o) { const k = text + "|" + (o.size || 40) + "|" + (o.weight || 600) + "|" + (o.font || "") + "|" + (o.letterSpacing || 0); let w = MEAS.get(k); if (w == null) { w = L.measure(ctx, text, o); if (MEAS.size > 300) MEAS.clear(); MEAS.set(k, w); } return w; }

  // ---------- Bauteile ----------
  function drumSprite(g) {
    fil(g, (c) => annulus(c, R - 12, R, 0, TAU), COL.cyan, 0.10);
    fil(g, (c) => c.arc(0, 0, R - 18, 0, TAU), COL.cyan, 0.035);
    stk(g, (c) => c.arc(0, 0, R, 0, TAU), COL.cyan, 3, 1, 1);
    stk(g, (c) => c.arc(0, 0, R - 12, 0, TAU), COL.cyan, 1.4, 0, 0.45);
    stk(g, (c) => c.arc(0, 0, R - 18, 0, TAU), COL.cyan, 2, 0.4, 0.65);
    stk(g, (c) => { for (let i = 0; i < 36; i++) { const a = (i * TAU) / 36; c.moveTo(Math.cos(a) * (R - 10), Math.sin(a) * (R - 10)); c.lineTo(Math.cos(a) * (R - 3), Math.sin(a) * (R - 3)); } }, COL.cyan, 1.2, 0, 0.32);
    stk(g, (c) => { for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6 + TAU / 12, x = Math.cos(a) * 78, y = Math.sin(a) * 78; c.moveTo(x + 17, y); c.arc(x, y, 17, 0, TAU); } }, COL.cyan, 2, 0.5, 0.75);
    stk(g, (c) => { for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6; c.moveTo(Math.cos(a) * 46, Math.sin(a) * 46); c.lineTo(Math.cos(a) * (R - 20), Math.sin(a) * (R - 20)); } }, COL.cyan, 1.2, 0, 0.22);
    fil(g, (c) => c.arc(0, 0, 44, 0, TAU), COL.navy, 0.92);
    stk(g, (c) => c.arc(0, 0, 44, 0, TAU), COL.cyan, 2.5, 0.8, 0.95);
    fil(g, (c) => { for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6; c.moveTo(Math.cos(a) * 32 + 3.5, Math.sin(a) * 32); c.arc(Math.cos(a) * 32, Math.sin(a) * 32, 3.5, 0, TAU); } }, COL.cyan, 0.8);
    fil(g, (c) => c.arc(0, 0, 21, 0, TAU), COL.navy, 1);
    stk(g, (c) => c.arc(0, 0, 21, 0, TAU), COL.steel, 2.4, 0.6, 1);
    fil(g, (c) => c.rect(-5, -21, 10, 8), COL.steel, 0.9); // Passfeder
    fil(g, (c) => c.arc(0, 0, 3, 0, TAU), COL.steel, 0.8);
    stk(g, (c) => c.arc(0, 0, R - 6.5, -0.13, 0.13), COL.white, 5, 0.9, 0.95); // Indexmarke (zeigt die Drehung)
  }
  function armPath(c) { c.moveTo(-15, 0); c.lineTo(-11, -LA + 11); c.arc(0, -LA + 11, 11, Math.PI, 0); c.lineTo(15, 0); c.arc(0, 0, 15, 0, Math.PI); c.closePath(); }
  function armSprite(g) {
    fil(g, armPath, COL.navy, 0.94);
    stk(g, armPath, COL.steel, 2.4, 0.7, 1);
    const ys = -(AP - DY), yr = -(AP - SY), yp = -(AP - PY);
    stk(g, (c) => { rr(c, -4, ys + 36, 8, -ys - 72, 4); rr(c, -4, yr + 22, 8, ys - yr - 56, 4); }, COL.steel, 1.3, 0, 0.45);
    fil(g, (c) => c.arc(0, ys, 17, 0, TAU), COL.navy, 1);
    stk(g, (c) => c.arc(0, ys, 17, 0, TAU), COL.steel, 2.2, 0.5, 1);
    fil(g, (c) => c.arc(0, ys, 6, 0, TAU), COL.steel, 0.95);
    stk(g, (c) => c.arc(0, yr, 7, 0, TAU), COL.steel, 1.8, 0, 0.9);
    stk(g, (c) => c.arc(0, yp, 5, 0, TAU), COL.steel, 1.6, 0, 0.8);
    fil(g, (c) => c.arc(0, 0, 6, 0, TAU), COL.steel, 0.95);
    stk(g, (c) => c.arc(0, 0, 11, 0, TAU), COL.steel, 1.4, 0, 0.6);
  }
  const shoeBody = (c) => annulus(c, R + LIN, R + LIN + SHOE, -SPAN - 0.03, SPAN + 0.03);
  const shoeWeb = (c) => { const r0 = R + LIN + SHOE - 2; c.moveTo(r0, -62); c.lineTo(AX - 4, -13); c.lineTo(AX - 4, 13); c.lineTo(r0, 62); c.closePath(); };
  const liningB = (c) => annulus(c, R, R + LIN, -SPAN, SPAN);
  function shoeSprite(g) { // rechte Backe, Ursprung = Trommelmitte
    fil(g, shoeWeb, COL.navy, 0.95); stk(g, shoeWeb, COL.steel, 1.6, 0.3, 0.85);
    fil(g, shoeBody, COL.navy, 0.96); stk(g, shoeBody, COL.steel, 2.3, 0.6, 1);
    fil(g, liningB, COL.amber, 0.62); stk(g, liningB, COL.amber, 1.8, 0.6, 1);
    stk(g, (c) => { for (let a = -SPAN + 0.1; a < SPAN - 0.05; a += 0.13) { c.moveTo(Math.cos(a) * (R + 3), Math.sin(a) * (R + 3)); c.lineTo(Math.cos(a + 0.05) * (R + LIN - 3), Math.sin(a + 0.05) * (R + LIN - 3)); } }, "#7a4a12", 1.4, 0, 0.7);
    fil(g, (c) => { for (const a of [-SPAN * 0.55, 0, SPAN * 0.55]) { const x = Math.cos(a) * (R + LIN + SHOE / 2), y = Math.sin(a) * (R + LIN + SHOE / 2); c.moveTo(x + 3, y); c.arc(x, y, 3, 0, TAU); } }, COL.steel, 0.8);
  }
  function magnetSprite(g, on) {
    const body = (c) => rr(c, -MW, -MH, 2 * MW, 2 * MH, 10);
    fil(g, body, COL.navy, 0.96); stk(g, body, on ? COL.cyan : COL.steel, 2.6, on ? 1 : 0.4, on ? 1 : 0.8);
    stk(g, (c) => rr(c, -MW + 8, -MH + 8, 2 * MW - 16, 2 * MH - 16, 6), on ? COL.cyan : COL.steel, 1.3, 0, on ? 0.6 : 0.35);
    for (const sx of [-1, 1]) {
      const x0 = sx < 0 ? -80 : 22;
      fil(g, (c) => c.rect(x0, -38, 58, 76), on ? COL.cyan : COL.steel, on ? 0.16 : 0.05);
      stk(g, (c) => c.rect(x0, -38, 58, 76), on ? COL.cyan : COL.steel, 1.6, on ? 0.6 : 0, on ? 0.9 : 0.45);
      stk(g, (c) => { for (let y = -32; y <= 32; y += 6.4) { c.moveTo(x0 + 5, y); c.lineTo(x0 + 53, y + 3); } }, on ? COL.cyan : COL.muted, 1.3, on ? 0.5 : 0, on ? 0.85 : 0.3);
    }
    stk(g, (c) => c.rect(-12, -MH + 8, 24, 2 * MH - 16), on ? COL.cyan : COL.steel, 1.6, 0, on ? 0.8 : 0.45);
    fil(g, (c) => { c.arc(-MW, CABLE_Y - PY, 4.5, 0, TAU); }, on ? COL.cyan : COL.steel, 0.9);
  }
  function baseSprite(g) {
    stk(g, (c) => { for (let x = -296; x <= 300; x += 18) { c.moveTo(x, 15); c.lineTo(x - 13, 30); } }, COL.muted, 1.2, 0, 0.35);
    fil(g, (c) => c.rect(-300, 0, 600, 14), COL.navy, 0.95); stk(g, (c) => c.rect(-300, 0, 600, 14), COL.steel, 2, 0.5, 0.9);
    for (const sx of [-1, 1]) {
      const x = sx * AX, yp = AP - BASE_Y;
      const br = (c) => { c.moveTo(x - 32, 0); c.lineTo(x - 18, yp); c.lineTo(x + 18, yp); c.lineTo(x + 32, 0); c.closePath(); };
      fil(g, br, COL.navy, 0.95); stk(g, br, COL.steel, 2, 0.4, 0.9);
      fil(g, (c) => c.arc(x, yp, 21, 0, TAU), COL.navy, 1); stk(g, (c) => c.arc(x, yp, 21, 0, TAU), COL.steel, 2, 0.4, 0.9);
    }
  }
  function springB(xa, xb, y, amp, n, front, jit) {
    return (c) => {
      const pitch = (xb - xa) / n;
      for (let i = 0; i < n; i++) {
        const x = xa + i * pitch, a2 = amp + (jit || 0) * (i % 2 ? 1 : -1);
        if (front) { c.moveTo(x, y - a2); c.quadraticCurveTo(x + pitch * 0.12, y + 2, x + pitch * 0.5, y + a2); }
        else { c.moveTo(x + pitch * 0.5, y + a2); c.quadraticCurveTo(x + pitch * 0.88, y - 2, x + pitch, y - a2); }
      }
    };
  }

  // ---------- Parameter ----------
  function num(v, def) { const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : Number(v); return Number.isFinite(n) ? n : def; }
  function bool(v, def) {
    if (v === undefined || v === null || v === "") return def;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    const s = String(v).trim().toLowerCase();
    if (["true", "1", "ja", "yes", "y", "on", "an", "wahr"].includes(s)) return true;
    if (["false", "0", "nein", "no", "n", "off", "aus", "falsch", "none"].includes(s)) return false;
    return def;
  }
  function pick(P, keys) { for (const k of keys) { const v = P[k]; if (v !== undefined && v !== null && v !== "") return v; } return undefined; }
  function powerVal(v) {
    if (v === undefined || v === null || v === "") return undefined;
    if (typeof v === "boolean" || typeof v === "number") return v ? "on" : "off";
    const s = String(v).trim().toLowerCase().replace(/[\s>→-]+/g, "_").replace(/_+/g, "_");
    if (/^(on_off|an_aus|ein_aus|sequence|sequenz|seq|cut|power_cut|failure|ausfall)$/.test(s)) return "on_off";
    if (/^(off_on|aus_an|aus_ein|restore|lift|lueften|lüften|release)$/.test(s)) return "off_on";
    if (/^(on|an|ein|true|1|yes|ja|powered|bestromt|open|offen|gelüftet|gelueftet|lifted|released)$/.test(s)) return "on";
    if (/^(off|aus|false|0|no|nein|stromausfall|stromlos|unpowered|closed|zu|geschlossen|engaged|applied)$/.test(s)) return "off";
    return undefined;
  }
  const KIND_ALIAS = { switch: "switch", schalter: "switch", kontakt: "switch", contact: "switch", circuit: "switch", sicherheitskreis: "switch", begrenzer: "switch",
    motor: "motor", magnet: "magnet", coil: "magnet", spule: "magnet", brake: "brake", bremse: "brake", failsafe: "brake", spring: "spring", springs: "spring", feder: "spring", federn: "spring",
    lining: "lining", linings: "lining", belag: "lining", "beläge": "lining", shoe: "lining", shoes: "lining", backe: "lining", drum: "drum", trommel: "drum", shaft: "drum", welle: "drum",
    circuits: "circuits", bremskreise: "circuits", sets: "circuits", arms: "circuits" };
  function kindOf(text) {
    const s = String(text).toLowerCase();
    if (/bremskreis/.test(s)) return "circuits";
    if (/sicherheitskreis|schalter|kontakt|begrenzer/.test(s)) return "switch";
    if (/motor/.test(s)) return "motor";
    if (/feder/.test(s)) return "spring";
    if (/belag|beläge|belaege|backe/.test(s)) return "lining";
    if (/(^|[^a-zäöüß])zu([^a-zäöüß]|$)|stromausfall|fail|gelüftet|gelueftet|lüftet|bremse/.test(s)) return "brake";
    if (/magnet|strom|spule/.test(s)) return "magnet";
    if (/trommel|welle|stillstand|dreh/.test(s)) return "drum";
    return "brake";
  }
  const COLOR_NAMES = { red: COL.red, rot: COL.red, amber: COL.amber, orange: COL.amber, gelb: COL.amber, cyan: COL.cyan, blau: COL.cyan, blue: COL.cyan, green: COL.green, "grün": COL.green, white: COL.white };
  function colorOf(item, kind) {
    const c = item && item.color; if (c) { const k = String(c).toLowerCase(); if (COLOR_NAMES[k]) return COLOR_NAMES[k]; if (/^#[0-9a-f]{6}$/i.test(c)) return c; }
    const s = String(item.text).toLowerCase();
    if (kind === "brake") return /gelüftet|gelueftet|lüftet|offen/.test(s) ? COL.cyan : COL.amber;
    if (/offen|(^|[^a-zäöüß])aus([^a-zäöüß]|$)|ausfall|stromlos|unterbrochen|weg/.test(s)) return COL.red;
    if (kind === "spring" || kind === "lining") return COL.amber;
    return COL.cyan;
  }
  const PART_DEF = { magnet: { text: "Bremslüftmagnet" }, spring: { text: "Druckfeder" }, lining: { text: "Bremsbelag" }, drum: { text: "Bremstrommel", sub: "auf der Motorwelle" } };
  const PART_ORDER = ["magnet", "spring", "lining", "drum"];

  const CFG = new WeakMap();
  function config(P, d, L, ctx) {
    const hit = CFG.get(P); if (hit && hit.d === d) return hit.cfg;
    const pw = powerVal(pick(P, ["power", "state", "mode", "strom", "zustand"]));
    const pfv = powerVal(pick(P, ["power_from", "powerFrom", "from", "start_state", "initial"]));
    const pf = pfv === "on" || pfv === "off" ? pfv : undefined;
    let from = "on", to = "off";
    if (pw === "on_off") { from = "on"; to = "off"; }
    else if (pw === "off_on") { from = "off"; to = "on"; }
    else if (pw === "on" || pw === "off") { to = pw; from = pf || "on"; }
    else { to = "off"; from = pf || "on"; }
    const seq = from !== to;
    const lo = Math.min(0.3, d / 2), hi = Math.max(d - 0.3, d / 2);
    const TT = (x) => clamp(x, lo, hi);
    const bIn = Array.isArray(P.beats) ? P.beats.map((v) => num(v, NaN)) : [];
    const B = (i, def) => TT(Number.isFinite(bIn[i]) ? bIn[i] : def);
    const b0 = B(0, 0.28 * d);
    let b1 = B(1, b0 + clamp(0.14 * d, 0.3, 1.2));
    if (b1 < b0 + 0.1) b1 = Math.min(b0 + 0.12, Math.max(b0, hi));
    const closeDur = seq && to === "off" ? 0.2 : 0.3;
    const tc = b1 + closeDur;                       // Belag trifft Trommel (bzw. Hebel offen)
    const tb = clamp(0.1 * d, 0.5, 0.8);            // Bremszeit bis Stillstand
    const b2 = B(2, seq ? Math.max(tc + tb + 0.5, 0.68 * d) : 0.3 * d);
    const b3 = B(3, seq ? Math.max(b2 + 0.8, 0.82 * d) : 0.55 * d);
    const inset = bool(pick(P, ["switch_inset", "switchInset", "inset", "safety_circuit", "sicherheitskreis", "show_circuit"]), false);
    const switchLabel = String(pick(P, ["switch_label", "switchLabel", "contact_label"]) ?? "Begrenzer");
    let contacts = pick(P, ["contacts", "kontakte"]);
    contacts = Array.isArray(contacts) ? contacts.slice(0, 1).map(String) : typeof contacts === "string" ? [contacts] : ["Tür"];
    const circuitTitle = String(pick(P, ["circuit_title", "circuitTitle", "inset_title"]) ?? "Sicherheitskreis");
    const failsafe = String(pick(P, ["failsafe_label", "failsafeLabel", "failsafe"]) ?? "Stromausfall = Bremse zu");

    // --- Statuskarten ---
    let rawLabels = pick(P, ["labels", "callouts", "status", "cards"]);
    if (rawLabels === false || rawLabels === "none") rawLabels = [];
    if (typeof rawLabels === "string") rawLabels = [rawLabels];
    if (!Array.isArray(rawLabels)) {
      if (seq && to === "off") rawLabels = inset ? [{ text: "Sicherheitskreis offen", target: "switch" }, { text: "Motor aus", target: "motor" }, { text: failsafe, target: "brake" }] : [{ text: "Magnet stromlos", target: "magnet" }, { text: failsafe, target: "brake" }];
      else if (seq) rawLabels = [{ text: "Magnet bestromt", target: "magnet" }, { text: "Bremse gelüftet", target: "brake" }];
      else rawLabels = [{ text: to === "off" ? failsafe : "Strom an = Bremse gelüftet", target: "brake" }];
    }
    const cardSeqDefault = (kind, i, n) => {
      if (!seq) return 0.7 + i * Math.min(0.6, 0.12 * d);
      if (kind === "switch") return b0 + 0.3;
      if (kind === "motor") return b0 + 0.8;
      if (kind === "magnet") return b0 + 0.45;
      if (kind === "brake") return tc + 0.55;
      if (kind === "spring" || kind === "lining") return b2 + 0.15;
      if (kind === "drum") return tc + tb + 0.2;
      return lerp(0.25 * d, 0.8 * d, n > 1 ? i / (n - 1) : 0.5);
    };
    const cards = [];
    rawLabels.slice(0, 6).forEach((it, i, arr) => {
      const item = typeof it === "string" || typeof it === "number" ? { text: String(it) } : it && typeof it === "object" ? Object.assign({}, it) : null;
      if (!item) return;
      item.text = String(item.text ?? item.label ?? item.title ?? "").trim(); if (!item.text) return;
      const tk = item.target ?? item.to ?? item.kind ?? item.part;
      const kind = (tk && KIND_ALIAS[String(tk).toLowerCase()]) || kindOf(item.text);
      const at = TT(Number.isFinite(num(item.at, NaN)) ? num(item.at, NaN) : cardSeqDefault(kind, i, arr.length));
      cards.push({ text: item.text, kind, at, color: colorOf(item, kind) });
    });

    // --- Bauteil-Beschriftungen ---
    let rawParts = pick(P, ["parts", "part_labels", "partLabels", "components"]);
    const partsOn = rawParts === undefined ? true : bool(rawParts, true);
    const parts = [];
    const partAtDefault = (k, i) => {
      if (seq && to === "off") return { magnet: 0.6, drum: Math.min(1.0, 0.2 * d), spring: tc + 0.3, lining: tc + 0.65 }[k] ?? 0.6 + i * 0.3;
      const st = Math.min(0.28, 0.06 * d); return 0.45 + PART_ORDER.indexOf(k) * st;
    };
    if (Array.isArray(rawParts)) {
      rawParts.forEach((it, i) => {
        const item = typeof it === "string" ? { part: it } : it && typeof it === "object" ? it : null; if (!item) return;
        let key = KIND_ALIAS[String(item.part ?? item.key ?? item.target ?? "").toLowerCase()];
        if (!PART_DEF[key]) { const tx = String(item.part ?? item.text ?? ""); key = kindOf(tx); if (!PART_DEF[key]) return; if (!item.text && item.part && !KIND_ALIAS[String(item.part).toLowerCase()]) item.text = item.part; }
        if (parts.some((q) => q.key === key)) return;
        const text = String(item.text ?? PART_DEF[key].text); const sub = item.sub !== undefined ? (item.sub ? String(item.sub) : "") : (item.text ? "" : PART_DEF[key].sub || "");
        parts.push({ key, text, sub, at: TT(Number.isFinite(num(item.at, NaN)) ? num(item.at, NaN) : partAtDefault(key, i)) });
      });
    } else if (partsOn) PART_ORDER.forEach((k, i) => parts.push({ key: k, text: PART_DEF[k].text, sub: PART_DEF[k].sub || "", at: TT(partAtDefault(k, i)) }));

    // --- Bremskreise ---
    const rawC = pick(P, ["circuits", "brake_circuits", "bremskreise", "sets"]);
    const cOn = rawC === undefined ? true : Array.isArray(rawC) ? true : bool(rawC, true);
    const circuits = [];
    if (cOn) {
      const defs = ["Bremskreis 1", "Bremskreis 2"];
      const arr = Array.isArray(rawC) ? rawC : [];
      for (let i = 0; i < 2; i++) {
        const it = arr[i]; const item = typeof it === "string" ? { text: it } : it && typeof it === "object" ? it : {};
        const at = TT(Number.isFinite(num(item.at, NaN)) ? num(item.at, NaN) : Number.isFinite(num(pick(P, ["circuits_at", "circuitsAt"]), NaN)) ? num(P.circuits_at ?? P.circuitsAt, 0) + i * 0.35 : b3 + i * 0.35);
        circuits.push({ text: String(item.text ?? defs[i]), at });
      }
    }

    // --- Layout ---
    const CX = inset ? 1120 : cards.length ? 1090 : parts.length ? 910 : 960;
    const cardX = 170, cardMaxW = inset ? 480 : Math.min(500, CX - NUT - 60 - cardX);
    let cardY0 = inset ? INS.y + INS.h + 46 : 300;
    let size = 30; const avail = 890 - cardY0;
    if (cards.length * 76 > avail) size = 25;
    let yy = cardY0;
    for (const c of cards) {
      let sz = size; const o = { size: sz, weight: 600 };
      let tw = meas(L, ctx, c.text, o);
      while (tw > cardMaxW - 50 && sz > 22) { sz -= 2; tw = meas(L, ctx, c.text, { size: sz, weight: 600 }); }
      let lines = [c.text];
      if (tw > cardMaxW - 50) { lines = L.wrap(ctx, c.text, cardMaxW - 50, { size: sz, weight: 600 }).slice(0, 2); tw = Math.max(...lines.map((ln) => meas(L, ctx, ln, { size: sz, weight: 600 }))); }
      c.size = sz; c.lines = lines; c.w = Math.ceil(Math.min(cardMaxW, tw + 52)); c.h = Math.ceil(lines.length * sz * 1.22 + 26); c.x = cardX; c.y = yy;
      yy += c.h + (cards.length > 4 ? 10 : 16);
    }
    if (!inset && cards.length) { const tot = yy - cardY0, sh = Math.round(clamp(DY - tot / 2 - cardY0, 0, Math.max(0, 890 - yy))); for (const c of cards) c.y += sh; }
    const sw = { size: 17, lines: [switchLabel] }, SWW = 148;
    if (meas(L, ctx, switchLabel, { size: 17, weight: 700 }) > SWW) {
      const toks = [];
      for (const wd of switchLabel.split(/\s+/)) { // lange Komposita an einer Fuge trennen (bevorzugt nach Fugen-s)
        if (wd.length < 16) { toks.push({ s: wd, j: false }); continue; }
        let best = -1, bestScore = 1e9;
        for (let i = 5; i < wd.length - 4; i++) { if (/[a-zäöüß]/.test(wd[i])) { const sc = Math.abs(i - wd.length / 2) + (wd[i - 1] === "s" ? 0 : /[nr]/.test(wd[i - 1]) ? 6 : 12); if (sc < bestScore) { bestScore = sc; best = i; } } }
        toks.push({ s: wd.slice(0, best), j: true }, { s: wd.slice(best), j: false });
      }
      const wrapT = (sz) => {
        const o = { size: sz, weight: 700 }, out = []; let cur = "", pj = false;
        for (const tk of toks) {
          const cand = cur ? cur + (pj ? "" : " ") + tk.s : tk.s;
          if (!cur || meas(L, ctx, cand + (tk.j ? "-" : ""), o) <= SWW) { cur = cand; pj = tk.j; }
          else { out.push(cur + (pj ? "-" : "")); cur = tk.s; pj = tk.j; }
        }
        if (cur) out.push(cur);
        return out;
      };
      let sz = 16, lines = [];
      for (; sz >= 12; sz--) { lines = wrapT(sz); if (lines.length <= (sz <= 13 ? 4 : 3) && lines.every((ln) => meas(L, ctx, ln, { size: sz, weight: 700 }) <= SWW)) break; }
      sw.size = Math.max(12, sz); sw.lines = lines.slice(0, 4);
    }
    const cfg = { from, to, seq, b0, b1, b2, b3, tc, tb, closeDur, inset, switchLabel, sw, contacts, circuitTitle, cards, parts, circuits, CX,
      sparks: bool(pick(P, ["sparks", "funken"]), true), arrows: bool(pick(P, ["force_arrows", "forceArrows", "arrows", "kraftpfeile"]), true), w0: 2.3 };
    CFG.set(P, { d, cfg });
    return cfg;
  }

  // ---------- Zustand zur Zeit t ----------
  function state(S, t) {
    const w0 = S.w0;
    let P = 1, s = 1, I = 1, co = 0, theta = 0, omega = 0, heat = 0, flash = 0, brakeI = 0, spark = -1;
    if (!S.seq) {
      if (S.to === "on") { theta = w0 * t; omega = w0; }
      else { P = 0; s = 0; I = 0; co = 1; theta = 0.35; heat = 0; }
    } else if (S.from === "on") {
      P = 1 - smooth(seg(t, S.b0, 0.3)); I = 1 - smooth(seg(t, S.b0, 0.18)); co = easeOut(seg(t, S.b0, 0.16));
      s = 1 - easeIn(seg(t, S.b1, S.closeDur));
      const tc = S.tc, tb = S.tb, span = Math.max(0.05, tc - S.b0), w1 = w0 * (1 - Math.min(0.3, 0.12 * span));
      if (t <= S.b0) { theta = w0 * t; omega = w0; }
      else if (t <= tc) { const x = t - S.b0; omega = lerp(w0, w1, x / span); theta = w0 * S.b0 + w0 * x - 0.5 * ((w0 - w1) / span) * x * x; }
      else {
        const thB = w0 * S.b0 + w0 * span - 0.5 * (w0 - w1) * span;
        const x = Math.min(t - tc, tb); omega = t - tc < tb ? w1 * (1 - x / tb) : 0; theta = thB + w1 * x - 0.5 * (w1 / tb) * x * x;
        brakeI = t - tc < tb ? 1 - x / tb : 0;
        heat = t - tc < tb ? 0.55 + 0.45 * brakeI : 0.55 * Math.exp(-(t - tc - tb) / 1.1);
        flash = Math.exp(-(t - tc) / 0.12); spark = t - tc;
      }
    } else { // off -> on
      P = smooth(seg(t, S.b0, 0.3)); I = smooth(seg(t, S.b0, 0.18)); co = 1 - easeOut(seg(t, S.b0, 0.16));
      s = easeOut(seg(t, S.b1, S.closeDur));
      const ts = S.b1 + 0.15, ta = 1.1;
      if (t > ts) { const x = Math.min(t - ts, ta); omega = w0 * (x / ta); theta = 0.35 + 0.5 * (w0 / ta) * x * x + (t - ts > ta ? w0 * (t - ts - ta) : 0); }
      else theta = 0.35;
    }
    return { P, s, I, co, theta, omega, heat, flash, brakeI, spark, phi: s * PHI };
  }

  // ---------- Inset Sicherheitskreis ----------
  function insetGeo() { const x0 = INS.x, y0 = INS.y; return { x0, y0, yW: y0 + 138, yM: y0 + 206, nx: x0 + 312, c1a: x0 + 104, c1b: x0 + 144, c2a: x0 + 206, c2b: x0 + 258, mx: x0 + 376 }; }
  function drawInset(ctx, L, S, st, t, A) {
    const g = insetGeo(), { x0, y0, yW, yM, nx } = g, w = INS.w, h = INS.h;
    const E = st.I;
    GA = A;
    ctx.save(); ctx.translate(x0 - 18 * (1 - A), y0);
    blit(ctx, "brk_inset|" + S.circuitTitle + "|" + S.contacts.join(",") + "|" + S.sw.lines.join("/"), w + 30, h + 30, 15, 15, 1, (c) => {
      fil(c, (q) => rr(q, 0, 0, w, h, 12), COL.panel, 0.84);
      stk(c, (q) => rr(q, 0, 0, w, h, 12), COL.cyan, 1.3, 0.3, 0.38);
      stk(c, (q) => { for (const [px, py, dx, dy] of [[0, 0, 1, 1], [w, 0, -1, 1], [0, h, 1, -1], [w, h, -1, -1]]) { q.moveTo(px + dx * 22, py); q.lineTo(px, py); q.lineTo(px, py + dy * 22); } }, COL.cyan, 2.4, 0.8, 0.9);
      fil(c, (q) => q.rect(24, 28, 8, 8), COL.amber, 1);
      L.text(c, S.circuitTitle.toUpperCase(), 42, 38, { size: 17, weight: 700, font: L.FONT.mono, color: COL.muted, letterSpacing: 2.5 });
      const sy = yW - y0;
      fil(c, (q) => q.arc(56, sy, 22, 0, TAU), COL.navy, 1); stk(c, (q) => q.arc(56, sy, 22, 0, TAU), COL.cyan, 2, 0.5, 0.9);
      stk(c, (q) => { q.moveTo(44, sy); q.bezierCurveTo(50, sy - 12, 56, sy - 12, 56, sy); q.bezierCurveTo(56, sy + 12, 62, sy + 12, 68, sy); }, COL.cyan, 2, 0, 0.95);
      const cx1 = (g.c1a + g.c1b) / 2 - x0;
      L.text(c, S.contacts[0] || "Tür", cx1, sy + 38, { size: 17, weight: 600, color: COL.muted, align: "center" });
      const cx2 = (g.c2a + g.c2b) / 2 - x0;
      S.sw.lines.forEach((ln, i) => L.text(c, ln, cx2, sy + 38 + i * S.sw.size * 1.15, { size: S.sw.size, weight: 700, color: COL.amber, align: "center" }));
      L.text(c, "zur Bremse", w - 16, CABLE_Y - y0 - 11, { size: 15, weight: 600, color: COL.muted, align: "right" });
      L.text(c, "Motor", g.mx - x0 + 36, yM - y0 + 7, { size: 19, weight: 600, color: COL.white, align: "left" });
    });
    ctx.restore();
    ctx.save(); ctx.translate(-18 * (1 - A), 0);
    // Leitungen
    const upCol = COL.cyan, dnCol = mix(COL.muted, COL.cyan, E);
    const upA = 0.55 + 0.35 * E, dnA = 0.3 + 0.6 * E;
    const pathUp = (c) => { c.moveTo(x0 + 78, yW); c.lineTo(g.c1a, yW); c.moveTo(g.c1b, yW); c.lineTo(g.c2a, yW); };
    const pathDn = (c) => { c.moveTo(g.c2b, yW); c.lineTo(nx, yW); c.lineTo(nx, CABLE_Y); c.lineTo(x0 + w, CABLE_Y); c.moveTo(nx, yW); c.lineTo(nx, yM); c.lineTo(g.mx - 24, yM); };
    stk(ctx, pathUp, upCol, 2.4, 0.5, upA);
    stk(ctx, pathDn, dnCol, 2.4, 0.5 * E, dnA);
    if (E > 0.02) {
      const fo = { dash: [2, 24], dashOff: -t * 64, cap: "round" };
      stk(ctx, (c) => { c.moveTo(x0 + 78, yW); c.lineTo(g.c2b, yW); c.lineTo(nx, yW); c.lineTo(nx, CABLE_Y); c.lineTo(x0 + w, CABLE_Y); }, COL.flow, 4.2, 0.9, E, fo);
      stk(ctx, (c) => { c.moveTo(nx, yW); c.lineTo(nx, yM); c.lineTo(g.mx - 24, yM); }, COL.flow, 4.2, 0.9, E, fo);
    }
    fil(ctx, (c) => c.arc(nx, yW, 4.5, 0, TAU), dnCol, 0.9);
    // Kontakt 1 (bleibt zu)
    stk(ctx, (c) => { c.moveTo(g.c1a, yW); c.lineTo(g.c1b - 3, yW - 3); }, COL.cyan, 2.6, 0.5, 0.9);
    for (const x of [g.c1a, g.c1b]) { fil(ctx, (c) => c.arc(x, yW, 4.5, 0, TAU), COL.navy, 1); stk(ctx, (c) => c.arc(x, yW, 4.5, 0, TAU), COL.cyan, 1.8, 0, 0.9); }
    // Kontakt 2 (Begrenzer) – öffnet
    const openK = st.co, red = S.seq ? (S.from === "on" ? seg(t, S.b0, 0.2) : 1 - seg(t, S.b0, 0.2)) : (S.to === "off" ? 1 : 0);
    const bc = mix(COL.amber, COL.red, red), pulse = 0.5 + 0.5 * Math.sin(t * 5);
    stk(ctx, (c) => rr(c, g.c2a - 16, yW - 40, g.c2b - g.c2a + 32, 58, 8), bc, 1.6, 0.5 + 0.6 * red * pulse, 0.55 + 0.35 * red, { dash: [6, 5] });
    const ang = -32 * D2R * openK, L2 = g.c2b - g.c2a - 3;
    const bladeCol = mix(COL.cyan, COL.red, red);
    stk(ctx, (c) => { c.moveTo(g.c2a, yW); c.lineTo(g.c2a + Math.cos(ang) * L2, yW - 3 * (1 - openK) + Math.sin(ang) * L2); }, bladeCol, 3, 0.8, 1);
    for (const x of [g.c2a, g.c2b]) { fil(ctx, (c) => c.arc(x, yW, 4.8, 0, TAU), COL.navy, 1); stk(ctx, (c) => c.arc(x, yW, 4.8, 0, TAU), bladeCol, 1.8, 0.3, 1); }
    if (S.seq && S.from === "on" && t > S.b0 && t < S.b0 + 0.5) { // Abreißfunke
      const k = (t - S.b0) / 0.5; dot(ctx, g.c2b - 6, yW - 8, 34 * (1 - k * 0.5), COL.amber, (1 - k) * 0.9);
      stk(ctx, (c) => { for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (h01(i * 3.3) - 0.5) * 2.4, r0 = 6 + 30 * k * (0.5 + h01(i)), r1 = r0 + 8 * (1 - k); c.moveTo(g.c2b - 6 + Math.cos(a) * r0, yW - 8 + Math.sin(a) * r0); c.lineTo(g.c2b - 6 + Math.cos(a) * r1, yW - 8 + Math.sin(a) * r1); } }, COL.hot, 1.8, 0.8, 1 - k);
    }
    // Motor
    const mc = mix(COL.muted, COL.cyan, E);
    if (E > 0.02) dot(ctx, g.mx, yM, 46, COL.cyan, 0.35 * E);
    fil(ctx, (c) => c.arc(g.mx, yM, 24, 0, TAU), COL.navy, 1);
    stk(ctx, (c) => c.arc(g.mx, yM, 24, 0, TAU), mc, 2.4, 0.8 * E, 0.55 + 0.45 * E);
    txt(L, ctx, "M", g.mx, yM + 9, { size: 25, weight: 700, font: L.FONT.head, color: mc, align: "center", alpha: 0.6 + 0.4 * E });
    if (E > 0.02) { const a0 = t * 4.5; stk(ctx, (c) => c.arc(g.mx, yM, 31, a0, a0 + 1.4), COL.cyan, 2, 0.6, 0.8 * E); }
    // Status
    const sy = y0 + h - 30;
    const stTxt = (label, col, a) => { if (a <= 0.01) return; fil(ctx, (c) => c.arc(x0 + 30, sy - 6, 6, 0, TAU), col, a); dot(ctx, x0 + 30, sy - 6, 16, col, 0.5 * a); txt(L, ctx, label, x0 + 46, sy, { size: 16, weight: 700, font: L.FONT.mono, color: col, letterSpacing: 2, alpha: a }); };
    stTxt("KREIS GESCHLOSSEN", COL.cyan, clamp(1 - 2 * red));
    stTxt("KREIS OFFEN", COL.red, clamp(2 * red - 1));
    ctx.restore();
    GA = 1;
  }

  // ---------- Beschriftungen ----------
  function tagGeo(key, CX, st) {
    const dxs = (AP - DY) * Math.sin(st.phi);
    switch (key) {
      case "magnet": return { tx: CX + MW, ty: 250, bx: CX + 272, by: 250 };
      case "spring": { const xa = CX + AX + (AP - SY) * Math.sin(st.phi) + 16; return { tx: (xa + CX + NUT) / 2, ty: SY + SPR_AMP - 1, bx: CX + 318, by: 466 }; }
      case "lining": { const a = 22 * D2R; return { tx: CX + dxs + Math.cos(a) * (R + LIN / 2), ty: DY + Math.sin(a) * (R + LIN / 2), bx: CX + 318, by: 628 }; }
      case "drum": { const a = 76 * D2R; return { tx: CX + Math.cos(a) * R, ty: DY + Math.sin(a) * R, bx: CX + 318, by: 734 }; }
    }
    return null;
  }
  function tagBox(ctx, L, x, y, text, sub, color, pr, emph, alignRight) {
    const size = 24, tw = meas(L, ctx, text, { size, weight: 600 }), sw = sub ? meas(L, ctx, sub, { size: 17, weight: 500 }) : 0;
    const bw = Math.ceil(Math.max(tw, sw) + 30), bh = sub ? size + 42 : size + 18;
    const bp = clamp((pr - 0.35) / 0.65); if (bp <= 0) return;
    const left = alignRight ? x - bw : x, bwA = bw * easeOut(bp);
    const bl = alignRight ? x - bwA : left;
    const ta = clamp((pr - 0.6) / 0.4), tyo = sub ? -bh / 2 + size + 6 : size * 0.36;
    const body = (g, ox, oy, a) => {
      fil(g, (c) => rr(c, ox, oy - bh / 2, bw, bh, 7), COL.panel, 0.88 * a);
      txt(L, g, text, ox + 15, oy + tyo, { size, weight: 600, color: COL.white, alpha: a });
      if (sub) txt(L, g, sub, ox + 15, oy + tyo + 24, { size: 17, weight: 500, color: COL.muted, alpha: a });
    };
    if (ta >= 1) { ctx.save(); ctx.translate(Math.round(left), Math.round(y)); blit(ctx, "brk_tag|" + text + "|" + sub, bw + 4, bh + 4, 2, bh / 2 + 2, 1, (g) => body(g, 0, 0, 1)); ctx.restore(); }
    else {
      fil(ctx, (c) => rr(c, bl, y - bh / 2, bwA, bh, 7), COL.panel, 0.88 * bp);
      if (ta > 0) { txt(L, ctx, text, left + 15, y + tyo, { size, weight: 600, color: COL.white, alpha: ta }); if (sub) txt(L, ctx, sub, left + 15, y + tyo + 24, { size: 17, weight: 500, color: COL.muted, alpha: ta }); }
    }
    stk(ctx, (c) => rr(c, bl, y - bh / 2, bwA, bh, 7), color, 1.4, 0.4, 0.6 * bp * (1 - emph));
    if (emph > 0.01) stk(ctx, (c) => rr(c, bl, y - bh / 2, bwA, bh, 7), COL.amber, 1.6 + emph, 0.4 + 0.8 * emph, bp * (0.5 + 0.5 * emph));
  }
  function leader(ctx, tx, ty, bx, by, color, pr, under) {
    const lp = easeOut(clamp(pr / 0.55)); if (lp <= 0) return;
    if (under) stk(ctx, (c) => { c.moveTo(tx, ty); c.lineTo(lerp(tx, bx, lp), lerp(ty, by, lp)); }, color, 1.5, 0.5, 0.8);
    else { dot(ctx, tx, ty, 13, color, 0.75 * clamp(pr * 3)); fil(ctx, (c) => c.arc(tx, ty, 3.6, 0, TAU), color, clamp(pr * 3)); }
  }
  function ping(ctx, x, y, color, k) {
    if (k <= 0 || k >= 1) return;
    stk(ctx, (c) => c.arc(x, y, 10 + 52 * easeOut(k), 0, TAU), color, 3 * (1 - k) + 1, 0.8, Math.pow(1 - k, 1.4));
    dot(ctx, x, y, 26, color, 0.8 * (1 - k));
  }

  // ---------- Hauptzeichnung ----------
  function draw(ctx, p) {
    const L = p.L, t = p.t, d = Math.max(0.6, p.d || 8), P = p.params || {};
    const S = config(P, d, L, ctx);
    const st = state(S, t);
    const CX = S.CX;
    const A = easeOut(seg(t, 0.02, 0.5));
    const phi = st.phi, sinP = Math.sin(phi), cosP = Math.cos(phi);
    const armCX = (sg, y) => CX + sg * (AX + (AP - y) * sinP);
    const dxs = (AP - DY) * sinP, dys = -(AP - DY) * (1 - cosP);
    const pr = (at, dur) => seg(t, at, dur || 0.6);
    const emph = t >= S.b2 ? easeOutBack(seg(t, S.b2, 0.45)) : 0;
    const emphPulse = t >= S.b2 ? (0.5 + 0.5 * Math.sin((t - S.b2) * 7)) * Math.exp(-(t - S.b2) / 1.6) : 0;
    const closedK = 1 - s01(st.s);

    GA = A;
    // Mittellinien (Blueprint)
    stk(ctx, (c) => { c.moveTo(CX - 118, DY); c.lineTo(CX + 118, DY); c.moveTo(CX, DY - 158); c.lineTo(CX, DY + 158); c.moveTo(CX, SY - 8); c.lineTo(CX, PY + MH + 6); }, COL.cyan, 1, 0, 0.22, { dash: [22, 5, 3, 5] });
    ctx.save(); ctx.translate(CX, BASE_Y); blit(ctx, "brk_base", 680, 90, 340, 50, 1, baseSprite); ctx.restore();

    // Führungslinien der Bauteil-Labels (unter den Bauteilen)
    const tags = S.parts.map((q) => ({ q, g: tagGeo(q.key, CX, st), pr: pr(q.at, 0.7) }));
    for (const tg of tags) if (tg.g && tg.pr > 0) leader(ctx, tg.g.tx, tg.g.ty, tg.g.bx, tg.g.by, COL.cyan, tg.pr, true);
    const circ = S.circuits.map((q, i) => ({ q, i, sg: i ? 1 : -1, pr: pr(q.at, 0.6) }));
    for (const c of circ) if (c.pr > 0) { const ax = armCX(c.sg, 792) + c.sg * 14; leader(ctx, ax, 792, CX + c.sg * 252, 812, COL.cyan, c.pr, true); }

    // Zugstange
    stk(ctx, (c) => { c.moveTo(CX - NUT - 26, SY); c.lineTo(CX + NUT + 26, SY); }, COL.steel, 4, 0.3, 0.85);

    // Trommel
    ctx.save(); ctx.translate(CX, DY); ctx.rotate(st.theta);
    blit(ctx, "brk_drum", 2 * R + 34, 2 * R + 34, R + 17, R + 17, 1, drumSprite);
    ctx.restore();
    const wk = st.omega / S.w0;
    if (wk > 0.02) {
      const trail = Math.min(0.9, 0.34 * wk + 0.12);
      stk(ctx, (c) => { for (let i = 0; i < 6; i++) { const a = st.theta + (i * TAU) / 6 + TAU / 12; c.moveTo(CX + Math.cos(a - 0.24) * 78, DY + Math.sin(a - 0.24) * 78); c.arc(CX, DY, 78, a - 0.24, a - 0.24 - trail, true); } }, COL.cyan, 3, 0.6, 0.3 * wk);
      stk(ctx, (c) => c.arc(CX, DY, 160, -118 * D2R, -66 * D2R), COL.cyan, 2.4, 0.8, 0.85 * wk);
      const ea = -62 * D2R; arrow(ctx, CX + Math.cos(-70 * D2R) * 160, DY + Math.sin(-70 * D2R) * 160, CX + Math.cos(ea) * 160, DY + Math.sin(ea) * 160, COL.cyan, 2.4, 15, 0.9 * wk);
    }
    if (st.heat > 0.01) { // Reibwärme auf der Bremsfläche
      const hc = mix(COL.amber, COL.hot, st.brakeI);
      stk(ctx, (c) => { c.moveTo(CX + Math.cos(-SPAN) * (R - 3), DY + Math.sin(-SPAN) * (R - 3)); c.arc(CX, DY, R - 3, -SPAN, SPAN); c.moveTo(CX + Math.cos(Math.PI - SPAN) * (R - 3), DY + Math.sin(Math.PI - SPAN) * (R - 3)); c.arc(CX, DY, R - 3, Math.PI - SPAN, Math.PI + SPAN); }, hc, 4, 1.4, 0.8 * st.heat);
    }

    // Backen (+ Beläge)
    for (const sg of [-1, 1]) {
      ctx.save(); ctx.translate(CX + sg * dxs, DY + dys); if (sg < 0) ctx.scale(-1, 1);
      blit(ctx, "brk_shoe", 130, 300, -114, 150, 1, shoeSprite);
      const pressed = closedK * (0.35 + 0.25 * Math.sin(t * 3.2 + (sg > 0 ? 0 : 1.3))) * 0.5 + 0.35 * emph * closedK + 0.5 * emphPulse * closedK;
      const lg = Math.max(st.heat, pressed);
      if (lg > 0.01) stk(ctx, (c) => { c.moveTo(Math.cos(-SPAN) * (R + LIN / 2), Math.sin(-SPAN) * (R + LIN / 2)); c.arc(0, 0, R + LIN / 2, -SPAN, SPAN); }, mix(COL.amber, COL.hot, st.brakeI * 0.8), LIN - 3, 1.2, 0.75 * clamp(lg));
      ctx.restore();
    }
    // Hebel
    for (const sg of [-1, 1]) { ctx.save(); ctx.translate(CX + sg * AX, AP); ctx.rotate(sg * phi); blit(ctx, "brk_arm", 70, LA + 50, 35, LA + 22, 1, armSprite); ctx.restore(); }

    // Druckfedern (außen, drücken die Hebel zur Trommel)
    const jit = st.spark >= 0 && st.spark < 0.5 ? 2.2 * Math.sin(st.spark * 42) * Math.exp(-st.spark / 0.16) : 0;
    const springGlow = lerp(0.55, 1, closedK) + 0.35 * emphPulse;
    for (const sg of [-1, 1]) {
      const xa = armCX(sg, SY) + sg * 16, xb = CX + sg * NUT;
      fil(ctx, (c) => c.rect(Math.min(xa, xb), SY - SPR_AMP, Math.abs(xb - xa), 2 * SPR_AMP), COL.amber, 0.05 + 0.05 * closedK);
      stk(ctx, springB(xa, xb, SY, SPR_AMP, SPR_N, false, jit), COL.amber, 1.8, 0, 0.35 * springGlow);
      stk(ctx, springB(xa, xb, SY, SPR_AMP, SPR_N, true, jit), COL.amber, 3.2, 0.5 + 0.7 * closedK + emphPulse, springGlow);
      for (const [x, hgt] of [[xa - sg * 3, SPR_AMP + 8], [xb + sg * 3, SPR_AMP + 10]]) { fil(ctx, (c) => c.rect(x - 3, SY - hgt, 6, 2 * hgt), COL.navy, 1); stk(ctx, (c) => c.rect(x - 3, SY - hgt, 6, 2 * hgt), COL.steel, 1.8, 0.3, 0.95); }
      const nx = CX + sg * (NUT + 14);
      fil(ctx, (c) => c.rect(nx - 6, SY - 12, 12, 24), COL.navy, 1); stk(ctx, (c) => c.rect(nx - 6, SY - 12, 12, 24), COL.steel, 1.8, 0.3, 0.95);
      stk(ctx, (c) => { c.moveTo(nx - 6, SY - 4); c.lineTo(nx + 6, SY - 4); c.moveTo(nx - 6, SY + 4); c.lineTo(nx + 6, SY + 4); }, COL.steel, 1, 0, 0.6);
    }

    // Bremslüftmagnet + Stößel
    const Pw = st.P, pz = 0.85 + 0.15 * Math.sin(t * 4.2);
    for (const sg of [-1, 1]) {
      const xin = CX + sg * MW, xout = armCX(sg, PY) - sg * 10;
      const pb = (c) => c.rect(Math.min(xin, xout), PY - 7, Math.abs(xout - xin), 14);
      fil(ctx, pb, COL.navy, 1); stk(ctx, pb, mix(COL.steel, COL.cyan, Pw), 2, 0.8 * Pw, 0.95);
      fil(ctx, (c) => c.arc(xout, PY, 7, 0, TAU), mix(COL.steel, COL.cyan, Pw), 0.9);
    }
    if (Pw > 0.01) dot(ctx, CX, PY, 150, COL.cyan, 0.22 * Pw * pz);
    ctx.save(); ctx.translate(CX, PY);
    blit(ctx, "brk_mag0", 2 * MW + 30, 2 * MH + 30, MW + 15, MH + 15, 1 - Pw * 0.999, (g) => magnetSprite(g, false));
    if (Pw > 0.01) blit(ctx, "brk_mag1", 2 * MW + 30, 2 * MH + 30, MW + 15, MH + 15, Pw, (g) => magnetSprite(g, true));
    ctx.restore();
    if (Pw > 0.01) {
      const fo = { dash: [7, 7], dashOff: -t * 34 };
      stk(ctx, (c) => { for (const sx of [-1, 1]) { c.moveTo(CX + sx * 51 + 38, PY); c.ellipse(CX + sx * 51, PY, 38, 44, 0, 0, TAU); c.moveTo(CX + sx * 51 + 22, PY); c.ellipse(CX + sx * 51, PY, 22, 30, 0, 0, TAU); } }, COL.flow, 1.3, 0.6, 0.55 * Pw * pz, fo);
    }
    drawBolt(ctx, CX, 219, 14, Pw, 1);

    // Stromzuführung
    if (S.inset) {
      const E = st.I;
      stk(ctx, (c) => { c.moveTo(INS.x + INS.w, CABLE_Y); c.lineTo(CX - MW, CABLE_Y); }, mix(COL.muted, COL.cyan, E), 2.4, 0.5 * E, 0.3 + 0.6 * E);
      if (E > 0.02) stk(ctx, (c) => { c.moveTo(INS.x + INS.w, CABLE_Y); c.lineTo(CX - MW, CABLE_Y); }, COL.flow, 4.2, 0.9, E, { dash: [2, 24], dashOff: -t * 64 });
    } else {
      const E = st.I, tx = CX - 330;
      stk(ctx, (c) => { c.moveTo(tx + 20, CABLE_Y); c.lineTo(CX - MW, CABLE_Y); }, mix(COL.muted, COL.cyan, E), 2.4, 0.5 * E, 0.3 + 0.6 * E);
      if (E > 0.02) stk(ctx, (c) => { c.moveTo(tx + 20, CABLE_Y); c.lineTo(CX - MW, CABLE_Y); }, COL.flow, 4.2, 0.9, E, { dash: [2, 24], dashOff: -t * 64 });
      fil(ctx, (c) => c.arc(tx, CABLE_Y, 20, 0, TAU), COL.navy, 1);
      stk(ctx, (c) => c.arc(tx, CABLE_Y, 20, 0, TAU), mix(COL.muted, COL.cyan, E), 2, 0.6 * E, 0.6 + 0.4 * E);
      stk(ctx, (c) => { c.moveTo(tx - 11, CABLE_Y); c.bezierCurveTo(tx - 5, CABLE_Y - 11, tx, CABLE_Y - 11, tx, CABLE_Y); c.bezierCurveTo(tx, CABLE_Y + 11, tx + 5, CABLE_Y + 11, tx + 11, CABLE_Y); }, mix(COL.muted, COL.cyan, E), 2, 0, 0.9);
      if (S.seq && S.from === "on" && E < 0.98 && E > 0.02) dot(ctx, tx + 24, CABLE_Y, 30, COL.amber, 0.8 * E);
    }

    // Kraftpfeile
    if (S.arrows) {
      const fa = closedK * (S.seq && S.from === "on" ? seg(t, S.tc + 0.05, 0.35) : 1);
      if (fa > 0.01) {
        const k = 1 + 0.3 * emph, aa = fa * (0.8 + 0.2 * emph);
        for (const sg of [-1, 1]) {
          const x2 = armCX(sg, SY - 42) + sg * 22, x1 = x2 + sg * 88 * k;
          arrow(ctx, x1, SY - 42, x2, SY - 42, COL.amber, 3 + emph, 15 + 3 * emph, aa);
          txt(L, ctx, "F", x1 + sg * 14, SY - 34, { size: 22, weight: 700, font: L.FONT.mono, color: COL.amber, align: sg > 0 ? "left" : "right", alpha: aa });
          const y = DY, xs2 = armCX(sg, y) + sg * 22, xs1 = xs2 + sg * 60 * k;
          arrow(ctx, xs1, y, xs2, y, COL.amber, 3 + emph, 14 + 3 * emph, aa * 0.9);
        }
      }
      const ma = Pw * st.s;
      if (ma > 0.01) {
        const k = 1 + (S.to === "on" ? 0.3 * emph : 0);
        for (const sg of [-1, 1]) arrow(ctx, CX + sg * (MW + 8), PY + 27, CX + sg * (MW + 8 + 50 * k), PY + 27, COL.cyan, 2.6, 13, ma * 0.95);
      }
    }
    // Aufprall-Blitz + Funken
    if (st.flash > 0.01) for (const sg of [-1, 1]) { dot(ctx, CX + sg * (R + 4), DY, 70, COL.hot, 0.7 * st.flash); }
    if (S.sparks && st.spark >= 0 && st.spark < S.tb + 0.4) {
      const tt = st.spark;
      stk(ctx, (c) => {
        for (const sg of [-1, 1]) {
          const a0 = sg > 0 ? SPAN + 0.03 : Math.PI + SPAN + 0.03; const px = CX + Math.cos(a0) * (R + 1), py = DY + Math.sin(a0) * (R + 1);
          const tx = -Math.sin(a0), ty = Math.cos(a0);
          for (let i = 0; i < 26; i++) {
            const born = Math.pow(h01(i * 7.1 + (sg > 0 ? 3 : 11)), 1.6) * S.tb * 0.95, age = tt - born, life = 0.25 + 0.25 * h01(i * 2.3 + sg);
            if (age < 0 || age > life) continue;
            const sp = (330 + 420 * h01(i * 5.7 + sg)) * (1 - (born / S.tb) * 0.55), dv = (h01(i * 9.1 + sg * 2) - 0.5) * 0.8;
            const vx = (tx * Math.cos(dv) - ty * Math.sin(dv)) * sp, vy = (tx * Math.sin(dv) + ty * Math.cos(dv)) * sp;
            const x = px + vx * age, y = py + vy * age + 600 * age * age, ln = 0.055 * (1 - (age / life) * 0.6);
            c.moveTo(x, y); c.lineTo(x - vx * ln, y - (vy + 1200 * age) * ln);
          }
        }
      }, COL.hot, 2.2, 1.2, 1);
      if (tt < S.tb) for (const sg of [-1, 1]) { const a0 = sg > 0 ? SPAN : Math.PI + SPAN; dot(ctx, CX + Math.cos(a0) * (R + 2), DY + Math.sin(a0) * (R + 2), 34, COL.amber, 0.7 * (1 - tt / S.tb)); }
    }

    // Bremskreise hervorheben
    for (const c of circ) {
      if (c.pr <= 0) continue;
      const since = t - c.q.at, hl = c.pr * (0.3 + 0.7 * Math.exp(-since / 0.7)) + 0.08 * Math.sin(t * 3 + c.i);
      const sg = c.sg;
      ctx.save(); ctx.translate(CX + sg * AX, AP); ctx.rotate(sg * phi); stk(ctx, armPath, COL.white, 2, 1.2, hl); ctx.restore();
      ctx.save(); ctx.translate(CX + sg * dxs, DY + dys); if (sg < 0) ctx.scale(-1, 1); stk(ctx, shoeBody, COL.white, 1.8, 1.2, hl); ctx.restore();
      const xa = armCX(sg, SY) + sg * 16; stk(ctx, springB(xa, CX + sg * NUT, SY, SPR_AMP, SPR_N, true, 0), COL.hot, 2, 1, hl * 0.8);
      const ax = armCX(sg, 792) + sg * 14; leader(ctx, ax, 792, CX + sg * 252, 812, COL.cyan, c.pr, false);
      tagBox(ctx, L, CX + sg * 252, 812, c.q.text, "", COL.cyan, c.pr, 0, sg < 0);
    }
    // Bauteil-Labels
    for (const tg of tags) {
      if (!tg.g || tg.pr <= 0) continue;
      leader(ctx, tg.g.tx, tg.g.ty, tg.g.bx, tg.g.by, COL.cyan, tg.pr, false);
      const em = (tg.q.key === "spring" || tg.q.key === "lining") && closedK > 0.5 ? clamp(emphPulse * 1.2 + 0.25 * emph) : 0;
      tagBox(ctx, L, tg.g.bx, tg.g.by, tg.q.text, tg.q.sub, COL.cyan, tg.pr, em, false);
    }

    // Inset
    if (S.inset) drawInset(ctx, L, S, st, t, easeOut(seg(t, 0.12, 0.5)) * 1);
    GA = 1;

    // Statuskarten + Ping am Ziel
    for (const c of S.cards) {
      const k = seg(t, c.at, 0.45); if (k <= 0) continue;
      const a = easeOut(k), x = c.x - 26 * (1 - a), y = c.y;
      GA = a;
      const tA = clamp((k - 0.25) / 0.75);
      const body = (g, ox, oy, al) => {
        fil(g, (q) => rr(q, ox, oy, c.w, c.h, 8), COL.panel, 0.9);
        c.lines.forEach((ln, i) => txt(L, g, ln, ox + 26, oy + 13 + c.size * 0.92 + i * c.size * 1.22, { size: c.size, weight: 600, color: COL.white, alpha: al }));
      };
      if (k >= 1) { ctx.save(); ctx.translate(x, y); blit(ctx, "brk_card|" + c.text + "|" + c.size + "|" + c.w, c.w + 4, c.h + 4, 2, 2, 1, (g) => body(g, 0, 0, 1)); ctx.restore(); }
      else body(ctx, x, y, tA);
      stk(ctx, (q) => rr(q, x, y, c.w, c.h, 8), c.color, 1.5, 0.5, 0.55);
      const since = t - c.at, glowK = Math.exp(-since / 0.6);
      fil(ctx, (q) => q.rect(x, y + 4, 6, c.h - 8), c.color, 1);
      if (glowK > 0.02) dot(ctx, x + 3, y + c.h / 2, 26 + 16 * glowK, c.color, 0.6 * glowK);
      fil(ctx, (q) => q.rect(x, y + 4, 6, c.h - 8), COL.white, 0.12 + 0.1 * Math.sin(t * 3 + c.y));
      GA = 1;
      const pk = (t - c.at) / 0.9;
      if (pk > 0 && pk < 1) for (const [px, py] of pingTargets(c.kind, S, st, CX)) ping(ctx, px, py, c.color, pk);
    }
    GA = 1;
  }
  function s01(x) { return clamp(x); }
  function pingTargets(kind, S, st, CX) {
    const dxs = (AP - DY) * Math.sin(st.phi), g = insetGeo();
    const sp = (sg) => [(CX + sg * (AX + (AP - SY) * Math.sin(st.phi) + 16) + CX + sg * NUT) / 2, SY];
    switch (kind) {
      case "switch": return S.inset ? [[(g.c2a + g.c2b) / 2, g.yW - 6]] : [[CX - 330, CABLE_Y]];
      case "motor": return S.inset ? [[g.mx, g.yM]] : [[CX, DY]];
      case "magnet": return [[CX, PY]];
      case "spring": return [sp(-1), sp(1)];
      case "lining": case "brake": return [[CX - dxs - R - 6, DY], [CX + dxs + R + 6, DY]];
      case "drum": return [[CX, DY]];
      case "circuits": return [[CX - AX - dxs, DY], [CX + AX + dxs, DY]];
    }
    return [[CX, DY]];
  }

  CE.register("brake", { draw });
})();
