/* YouTube-Thumbnail (1280x720 nach Skalierung). Varianten: snap | sparks | split. Wahr, keine Übertreibung. */
(function () {
  CE.register("thumbnail", {
    ownsText: true,
    draw(ctx, p) {
      const { L, K, W, H } = p; const C = L.C; const v = p.params.variant || "snap";
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
})();
