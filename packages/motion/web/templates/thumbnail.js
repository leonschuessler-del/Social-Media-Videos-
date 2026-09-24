/* YouTube-Thumbnail (1280x720 nach Skalierung). Varianten: hero (Default) | snap | sparks | split. Wahr, keine Übertreibung.
   hero – EINE Bildidee, lesbar bis 168x94 px: große Röntgen-Kabine im Schacht, ALLE Tragseile gerissen (rot, jedes an
     anderer Stelle; oben peitschen die Enden hoch, unten Stummel an der Aufhängung, ausgefranste glühende Litzen), die
     Kabine hängt trotzdem: die Fangkeile klemmen an beiden Führungsschienen (Amber-Glühen an der Reibfläche + kurze
     Bremsspur ≈ 20 cm Fangweg im Kabinenmaßstab). KEIN Funkenregen – den nennt das Video einen Kinomythos.
     Headline links, 2–3 Wörter, jede Zeile auf dieselbe Blockbreite gesetzt (Zeilengröße automatisch).
   PARAMS (hero, alle optional)
     headline  Text, "|" = Zeilenumbruch (Default "ALLE SEILE|GERISSEN"); letzte Zeile Amber
     accent    kurzes Zeichen nach der letzten Zeile in Rot, z. B. "?" (Default: keins)
     tone      "amber" | "red" – Farbe der letzten Zeile (Default amber; liest klein deutlich besser als Rot)
     ropes     Anzahl Tragseile 3–8 (Default 6, wie im Gedankenexperiment des Videos)
     people    Personen-Silhouetten in der Kabine 0–3 (Default 2) */
(function () {
  CE.register("thumbnail", {
    ownsText: true,
    draw(ctx, p) {
      const { L, K, W, H } = p; const C = L.C; const v = p.params.variant || "hero";
      if (v === "hero") return drawHero(ctx, p);
      const headline = p.params.headline || "SEIL GERISSEN"; const sub = p.params.sub || "Warum der Aufzug trotzdem hält";
      // dramatischer Hintergrund
      const g = ctx.createRadialGradient(W * 0.68, H * 0.5, 40, W * 0.68, H * 0.5, W * 0.7); g.addColorStop(0, "#12305a"); g.addColorStop(1, "#02060e");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); L.grid(ctx, W, H, 60, 0);
      if (v === "snap" || v === "sparks") {
        const cx = W * 0.7, carY = 430, carW = 340, carH = 430;
        K.guideRail(ctx, cx - carW / 2 - 60, 0, H); K.guideRail(ctx, cx + carW / 2 + 60, 0, H);
        // Seile: oben intakt, gerissen mit roten Enden
        const n = 6;
        for (let i = 0; i < n; i++) {
          const x = cx + (i - (n - 1) / 2) * 22; const broken = v === "snap" ? i === 2 || i === 3 : i === 2;
          if (broken) {
            // oberes Ende peitscht zur Seite, unteres hängt lose – deutliche Lücke mit ausgefransten Drähten
            L.poly(ctx, [[x, 0], [x + 18, 120], [x + 70, 185]], C.red, 8, 1.8); L.poly(ctx, [[x - 60, 285], [x - 14, 330], [x, carY - 26]], C.red, 8, 1.8);
            for (let k = 0; k < 7; k++) { const a = -0.9 + k * 0.3; L.line(ctx, x + 70, 185, x + 70 + Math.cos(a) * 34, 185 + Math.sin(a) * 34, "#ffb0a8", 2.5, 1); L.line(ctx, x - 60, 285, x - 60 - Math.cos(a) * 30, 285 - Math.sin(a) * 30, "#ffb0a8", 2.5, 1); }
            L.glowDot(ctx, x + 70, 185, 70, C.red, 1); L.glowDot(ctx, x - 60, 285, 60, C.red, 0.9);
          }
          else L.line(ctx, x, 0, x, carY - 26, C.cyan, 7, 1.3);
        }
        K.car(ctx, cx - carW / 2, carY, carW, carH, { people: 2 });
        // Fangvorrichtung greift: Funken
        if (v === "sparks") { for (const sx of [cx - carW / 2 - 60, cx + carW / 2 + 60]) { L.sparks(ctx, sx, carY + carH + 20, 0.35, { seed: sx, count: 90, window: 0.35, speed: 700, spread: Math.PI * 1.2 }); L.glowDot(ctx, sx, carY + carH + 20, 90, C.amber, 0.9); } }
        else { L.glowDot(ctx, cx, 230, 160, C.red, 0.35); }
        // Headline links
        const x0 = 90; const size = headline.length > 12 ? 128 : 150;
        const lines = headline.split("|");
        lines.forEach((ln, i) => L.text(ctx, ln, x0, 330 + i * (size * 1.02), { font: L.FONT.head, weight: 700, size, color: i === lines.length - 1 ? C.amber : C.white, stroke: 16, strokeColor: "#000", glow: 28, glowColor: i === lines.length - 1 ? C.amber : C.cyan }));
        L.text(ctx, sub, x0, 330 + lines.length * size * 1.02 + 30, { font: L.FONT.body, weight: 800, size: 58, color: C.white, stroke: 10, strokeColor: "#000" });
      } else {
        // split: 1854 vs heute
        L.fillRect(ctx, W / 2 - 3, 0, 6, H, C.amber);
        L.text(ctx, "1854", W * 0.25, 260, { font: L.FONT.head, weight: 700, size: 170, color: C.amber, align: "center", stroke: 14, strokeColor: "#000", glow: 24 });
        L.text(ctx, "HEUTE", W * 0.75, 260, { font: L.FONT.head, weight: 700, size: 170, color: C.cyan, align: "center", stroke: 14, strokeColor: "#000", glow: 24 });
        // links: Plattform mit Sägezahnschienen
        const lx = W * 0.25; for (const rx of [lx - 170, lx + 170]) { L.line(ctx, rx, 330, rx, H - 60, C.amber, 6, 1); for (let y = 340; y < H - 60; y += 28) L.poly(ctx, [[rx, y], [rx + (rx < lx ? 18 : -18), y + 14], [rx, y + 28]], C.amberSoft, 2, 0); }
        L.rect(ctx, lx - 150, 650, 300, 26, C.amber, 5, 1); L.person(ctx, lx, 650, 190, C.steel, 0.9);
        // rechts: moderne Kabine mit Seilen
        const rx = W * 0.75; for (let i = 0; i < 6; i++) L.line(ctx, rx + (i - 2.5) * 20, 330, rx + (i - 2.5) * 20, 520, C.cyan, 6, 1.2);
        K.car(ctx, rx - 150, 520, 300, 400, { people: 2 });
        L.text(ctx, headline.replace("|", " "), W / 2, H - 70, { font: L.FONT.head, weight: 700, size: 86, color: C.white, align: "center", stroke: 12, strokeColor: "#000", glow: 20 });
      }
    },
  });

  // ---------------------------------------------------------------- hero
  function drawHero(ctx, p) {
    const { L, W, H } = p; const C = L.C;
    const HOT = "#fff1cf", FRAY = "#ffc4bd";
    const P = p.params || {};
    const headline = String(P.headline || "ALLE SEILE|GERISSEN");
    const accent = P.accent ? String(P.accent) : "";
    const tone = P.tone === "red" ? C.red : C.amber;   // Farbe der letzten Headline-Zeile
    const nRopes = Math.max(3, Math.min(8, Math.round(P.ropes ?? 6)));
    const nPeople = Math.max(0, Math.min(3, Math.round(P.people ?? 2)));
    const h01 = L.hash01;
    /** additives Leuchten (Canvas "lighter") – liest auch in 168 px Breite als Lichtquelle */
    const bloom = (x, y, r, rgb, a) => {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.3, `rgba(${rgb},${a * 0.45})`); gr.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
    };
    const RED = "255,90,95", AMB = "255,179,71", HOTRGB = "255,241,207";

    // ---- Geometrie (1920x1080) ----
    const cx = 1392, carW = 420, carH = 495, carTop = 350, carBot = carTop + carH;
    const drop = 50;                          // Bremsspur ≈ 20 cm Fangweg im Maßstab der Kabine (2,2 m ≙ 495 px)
    const railOff = carW / 2 + 64, rails = [cx - railOff, cx + railOff];
    const wallOff = railOff + 70;
    const headTop = carTop - 50, headBot = carTop - 20;   // Tragrahmen oben (Querhaupt)
    const plankTop = carBot + 14, plankBot = carBot + 48; // Tragrahmen unten
    const gearTop = carBot + 4, gearBot = carBot + 92, clampY = (gearTop + gearBot) / 2;
    const hitchTop = headTop - 34;

    // ---- Hintergrund: Navy, Licht hinter der Kabine, Blueprint-Raster, Abdunklung hinter der Headline ----
    const g = ctx.createRadialGradient(cx, 480, 40, cx, 520, W * 0.62);
    g.addColorStop(0, "#15345f"); g.addColorStop(0.55, "#081a33"); g.addColorStop(1, "#02060e");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); L.grid(ctx, W, H, 60, 0);
    const lg = ctx.createLinearGradient(0, 0, 1000, 0); lg.addColorStop(0, "rgba(2,6,14,0.72)"); lg.addColorStop(1, "rgba(2,6,14,0)");
    ctx.fillStyle = lg; ctx.fillRect(0, 0, 1000, H);

    // ---- Schacht: Wände, Schienenbügel ----
    for (const s of [-1, 1]) {
      const wx = cx + s * wallOff;
      ctx.save(); ctx.fillStyle = "rgba(63,210,255,0.035)"; ctx.fillRect(s < 0 ? wx - 34 : wx, 0, 34, H); ctx.restore();
      L.line(ctx, wx, 0, wx, H, C.cyanSoft, 3, 0.6);
      L.line(ctx, wx + s * 34, 0, wx + s * 34, H, C.cyanDim, 2, 0);
      for (let y = 90; y < H; y += 180) L.line(ctx, rails[s < 0 ? 0 : 1], y, wx, y, C.cyanDim, 3, 0);
    }

    // ---- Führungsschienen (T-Profil) mit kurzer Bremsspur über den Keilen ----
    for (const rx of rails) {
      ctx.save(); ctx.fillStyle = "rgba(159,196,230,0.10)"; ctx.fillRect(rx - 16, 0, 32, H); ctx.restore();
      L.line(ctx, rx, 0, rx, H, C.steel, 10, 0.6, { cap: "butt", alpha: 0.8 });
      L.line(ctx, rx - 16, 0, rx - 16, H, "rgba(159,196,230,0.35)", 2, 0, { cap: "butt" });
      L.line(ctx, rx + 16, 0, rx + 16, H, "rgba(159,196,230,0.35)", 2, 0, { cap: "butt" });
    }

    // ---- Kabine mit Tragrahmen ----
    const cg = ctx.createLinearGradient(0, carTop, 0, carBot); cg.addColorStop(0, "rgba(63,210,255,0.17)"); cg.addColorStop(1, "rgba(63,210,255,0.07)");
    ctx.save(); ctx.fillStyle = cg; ctx.fillRect(cx - carW / 2, carTop, carW, carH); ctx.restore();
    const fx0 = rails[0] + 20, fx1 = rails[1] - 20;
    L.rect(ctx, fx0, headTop, fx1 - fx0, headBot - headTop, C.steel, 4, 0.6);
    L.rect(ctx, fx0, plankTop, fx1 - fx0, plankBot - plankTop, C.steel, 4, 0.6);
    for (const s of [-1, 1]) { const sx = cx + s * (carW / 2 + 22); L.line(ctx, sx, headBot, sx, plankTop, C.steel, 6, 0.5, { cap: "butt" }); }
    for (const rx of rails) L.poly(ctx, [[rx - 24, headTop - 8], [rx - 24, headBot + 8], [rx + 24, headBot + 8], [rx + 24, headTop - 8]], C.steel, 4, 0.5, { close: true });
    for (let i = 0; i < nPeople; i++) {
      const fx = nPeople === 1 ? 0.5 : nPeople === 2 ? [0.3, 0.7][i] : [0.22, 0.5, 0.78][i];
      L.person(ctx, cx - carW / 2 + carW * fx, carBot - 10, carH * (i === 1 && nPeople === 3 ? 0.5 : 0.66), "#8fc4ee", 0.62);
    }
    L.rect(ctx, cx - carW / 2, carTop, carW, carH, C.cyan, 7, 1.3);
    L.line(ctx, cx, carTop + 18, cx, carBot - 18, C.cyanSoft, 3, 0.4, { dash: [12, 10] });
    L.line(ctx, cx - carW / 2, carBot - 3, cx + carW / 2, carBot - 3, C.cyan, 9, 1.2, { cap: "butt" });

    // ---- Fangvorrichtung: Keile klemmen die Schiene – heißes Amber-Glühen an der Reibfläche + kurze Bremsspur
    //      auf dem Schienensteg (≈ Fangweg). KEIN Funkenregen: den nennt das Video ausdrücklich einen Kinomythos.
    const gw = 50;   // halbe Gehäusebreite
    for (const rx of rails) {
      bloom(rx, clampY, 270, AMB, 0.34);
      bloom(rx, clampY, 120, AMB, 0.5);
      // Bremsspur: zwei Reibspuren auf den Stegflanken, unten heiß, nach oben abkühlend
      const sTop = gearTop - drop - 20, sg = ctx.createLinearGradient(0, sTop, 0, gearTop + 4);
      sg.addColorStop(0, "rgba(255,179,71,0)"); sg.addColorStop(0.6, "rgba(255,179,71,0.95)"); sg.addColorStop(1, HOT);
      for (const s of [-1, 1]) L.line(ctx, rx + s * 5, sTop, rx + s * 5, gearTop + 4, sg, 4, 1.4, { cap: "butt" });
      // Gehäuse (dunkel, Amber-Kontur), Schiene läuft sichtbar hindurch
      ctx.save(); ctx.fillStyle = "rgba(26,15,4,0.92)"; ctx.fillRect(rx - gw, gearTop, gw * 2, gearBot - gearTop); ctx.restore();
      L.line(ctx, rx, gearTop - 2, rx, gearBot + 2, C.steel, 10, 0, { cap: "butt" });
      for (const s of [-1, 1]) {   // Keile: außen schräg (Keilbahn), innen plan an der Schiene
        const pts = [[rx + s * 9, gearTop + 12], [rx + s * 9, gearBot - 10], [rx + s * (gw - 8), gearBot - 10], [rx + s * 22, gearTop + 12]];
        ctx.save(); ctx.fillStyle = "#b8762a"; ctx.beginPath(); pts.forEach((q, j) => (j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); ctx.fill(); ctx.restore();
        L.poly(ctx, pts, C.amber, 3, 0.6, { close: true });
        L.line(ctx, rx + s * 9, gearTop + 12, rx + s * 9, gearBot - 10, HOT, 6, 1.6, { cap: "butt" });   // Reibfläche glüht
      }
      L.rect(ctx, rx - gw, gearTop, gw * 2, gearBot - gearTop, C.amber, 6, 1.3);
      bloom(rx, clampY, 54, HOTRGB, 0.75);
    }

    // ---- Tragseile: ALLE gerissen, jedes an anderer Stelle. Unten Stummel an der Aufhängung (Zug weg, kippen leicht
    //      nach außen), oben schnellen die Enden hoch und schlagen aus. Aufgedrehte Litzen, kurze rote Glut an den Bruchstellen.
    const gap = Math.min(46, 190 / (nRopes - 1)), rw = nRopes <= 4 ? 15 : nRopes <= 6 ? 13 : 11;
    const rope = (pts) => {   // Seil mit angedeuteter Litzen-Schlagrichtung
      L.poly(ctx, pts, C.red, rw, 1.25);
      ctx.save(); ctx.strokeStyle = "rgba(90,8,16,0.55)"; ctx.lineWidth = 2; ctx.beginPath(); let acc = 0;
      for (let j = 1; j < pts.length; j++) {
        const [ax, ay] = pts[j - 1], [bx, by] = pts[j], dl = Math.hypot(bx - ax, by - ay); acc += dl; if (acc < 13 || dl < 1e-3) continue; acc = 0;
        const nx = -(by - ay) / dl, ny = (bx - ax) / dl, tx = (bx - ax) / dl, ty = (by - ay) / dl, hw = rw * 0.45;
        ctx.moveTo(bx - nx * hw - tx * 4, by - ny * hw - ty * 4); ctx.lineTo(bx + nx * hw + tx * 4, by + ny * hw + ty * 4);
      }
      ctx.stroke(); ctx.restore();
    };
    const frayed = (x, y, ang, seed, len) => {   // aufgedrehte Drahtlitzen
      bloom(x, y, 40, RED, 0.75);
      for (let k = 0; k < 7; k++) {
        const a = ang + (k - 3) * 0.15 + (h01(seed * 9 + k) - 0.5) * 0.2, l = len * (0.5 + 0.7 * h01(seed * 5 + k));
        L.line(ctx, x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, FRAY, 2.5, 0.7);
      }
      bloom(x, y, 10, HOTRGB, 0.9);
    };
    const bandMid = (hitchTop + 30) / 2 + 6;
    bloom(cx, bandMid, 340, RED, 0.42);
    for (let i = 0; i < nRopes; i++) {
      const k = i - (nRopes - 1) / 2, x = cx + k * gap, q = h01(i + 3.7), r = h01(i * 2.3 + 1.1);
      const s = k < 0 ? -1 : k > 0 ? 1 : (i % 2 ? 1 : -1);
      L.rect(ctx, x - 7, hitchTop, 14, headTop - hitchTop, C.steel, 3, 0.4);   // Seilendverbindung
      const brk = bandMid + (((i * 5) % nRopes) / Math.max(1, nRopes - 1) - 0.5) * 34 + (q - 0.5) * 10;   // Bruchstelle (gestaffelt)
      const lo = brk + 44 + 8 * r, hi = brk - 50 - 10 * q;
      // unterer Stummel
      const lp = []; for (let j = 0; j <= 12; j++) { const u = j / 12; lp.push([x + s * (6 + 10 * q) * u * u, hitchTop + (lo - hitchTop) * u]); }
      rope(lp); frayed(lp[12][0], lp[12][1], Math.atan2(lp[12][1] - lp[10][1], lp[12][0] - lp[10][0]), i * 3 + 1, 30);
      // oberer Teil: gerade von oben, die letzten ~90 px peitschen seitlich aus
      const up = []; for (let j = 0; j <= 20; j++) { const u = j / 20, w = L.clamp((u - 0.55) / 0.45); up.push([x + s * (20 + 14 * r) * w * w + Math.sin(w * Math.PI) * -s * 7, -20 + (hi + 20) * u]); }
      rope(up); frayed(up[20][0], up[20][1], Math.atan2(up[20][1] - up[18][1], up[20][0] - up[18][0]), i * 3 + 2, 30);
    }

    // ---- Headline links: jede Zeile auf dieselbe Blockbreite gesetzt, letzte Zeile Amber ----
    const lines = headline.split("|").map((s) => s.trim()).filter(Boolean);
    const blockW = 885, x0 = 92, maxSize = 240;
    const sizes = lines.map((ln, i) => { const w = L.measure(ctx, ln + (accent && i === lines.length - 1 ? " " + accent : ""), { font: L.FONT.head, weight: 700, size: 100 }); return Math.min(maxSize, (100 * blockW) / Math.max(1, w)); });
    const gapY = 20; const totalH = sizes.reduce((a, s) => a + s * 0.74, 0) + gapY * (lines.length - 1);
    let y = 530 - totalH / 2;
    lines.forEach((ln, i) => {
      const size = sizes[i]; const last = i === lines.length - 1; y += size * 0.74;
      const col = last ? tone : C.white;
      L.text(ctx, ln, x0, y, { font: L.FONT.head, weight: 700, size, color: col, stroke: Math.round(size * 0.1), strokeColor: "#01040a", glow: 34, glowColor: last ? tone : "rgba(63,210,255,0.8)" });
      if (last && accent) {
        const w = L.measure(ctx, ln, { font: L.FONT.head, weight: 700, size });
        ctx.save(); ctx.translate(x0 + w + size * 0.1, y); ctx.rotate(0.1);
        L.text(ctx, accent, 0, 0, { font: L.FONT.head, weight: 700, size, color: tone === C.red ? C.amber : C.red, stroke: Math.round(size * 0.1), strokeColor: "#01040a", glow: 30, glowColor: C.red });
        ctx.restore();
      }
      y += gapY;
    });
  }
})();
