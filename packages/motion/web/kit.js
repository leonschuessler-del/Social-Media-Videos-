/* Elevator Kit – gemeinsame Bauteile im Röntgen-Stil. Wird von Templates genutzt (p.K).
   Wird im Template-Workflow erweitert; hier die Basis-Bauteile. */
(function () {
  const L = window.CE.lib; const C = L.C; const K = {};

  /** Führungsschiene (T-Profil, vertikal). */
  K.guideRail = (ctx, x, y1, y2, o = {}) => {
    L.line(ctx, x, y1, x, y2, o.color || C.steel, o.width || 6, 0.6, { alpha: o.alpha ?? 0.9 });
    for (let y = y1; y < y2; y += 80) L.line(ctx, x - 12, y, x + 12, y, C.cyanDim, 2, 0);
  };

  /** Stahlseile (n parallele Linien, optional gerissen). Seile laufen von y1 nach y2 bei Mitte cx. */
  K.ropes = (ctx, cx, y1, y2, o = {}) => {
    const n = o.count || 6, gap = o.gap || 10, broken = o.broken || [], t = o.t || 0;
    for (let i = 0; i < n; i++) {
      const x = cx + (i - (n - 1) / 2) * gap;
      if (broken.includes(i)) {
        const snapY = o.snapY ?? (y1 + (y2 - y1) * 0.35); const whip = Math.sin(t * 9 + i) * 14 * Math.exp(-t * 1.5);
        L.poly(ctx, [[x, y1], [x + whip * 0.3, snapY - 30], [x + whip, snapY - 4]], C.red, 3, 1);
        L.poly(ctx, [[x - whip, snapY + 20 + (o.fallOffset || 0)], [x - whip * 0.3, snapY + 60 + (o.fallOffset || 0)], [x, y2]], C.red, 3, 1, { alpha: 0.9 });
      } else {
        L.line(ctx, x, y1, x, y2, o.color || C.cyan, o.width || 3, 1, { alpha: o.alpha ?? 1 });
      }
    }
  };

  /** Aufzugskabine im Querschnitt (Rahmen, Tür, Fangvorrichtung unten). x,y = obere linke Ecke. */
  K.car = (ctx, x, y, w, h, o = {}) => {
    const col = o.color || C.cyan;
    ctx.save(); ctx.fillStyle = "rgba(63,210,255,0.06)"; ctx.fillRect(x, y, w, h); ctx.restore();
    L.rect(ctx, x, y, w, h, col, 3, 1);
    L.line(ctx, x + w * 0.5, y + 12, x + w * 0.5, y + h - 12, C.cyanSoft, 2, 0.4, { dash: [10, 8] }); // Türspalt
    L.rect(ctx, x - 14, y - 26, w + 28, 26, C.steel, 2, 0.5); // Tragrahmen oben
    L.rect(ctx, x - 14, y + h, w + 28, 22, C.steel, 2, 0.5); // Rahmen unten
    L.fillRect(ctx, x - 22, y + h + 2, 12, 18, o.safetyColor || C.amber); L.fillRect(ctx, x + w + 10, y + h + 2, 12, 18, o.safetyColor || C.amber); // Fangkeile
    if (o.people) { const n = o.people; for (let i = 0; i < n; i++) L.person(ctx, x + w * (0.25 + 0.5 * (i / Math.max(1, n - 1))), y + h - 8, h * 0.72, C.steel, 0.55); }
  };

  /** Gegengewicht (Rahmen mit Gewichtsplatten). */
  K.counterweight = (ctx, x, y, w, h, o = {}) => {
    L.rect(ctx, x, y, w, h, o.color || C.amber, 3, 1);
    for (let yy = y + 14; yy < y + h - 6; yy += 18) L.line(ctx, x + 6, yy, x + w - 6, yy, C.amberSoft, 2, 0);
  };

  /** Treibscheibe mit Rillen, rotierend (angle in rad). */
  K.sheave = (ctx, cx, cy, r, angle = 0, o = {}) => {
    L.circle(ctx, cx, cy, r, o.color || C.cyan, 4, 1);
    L.circle(ctx, cx, cy, r * 0.82, C.cyanSoft, 2, 0.4);
    L.circle(ctx, cx, cy, r * 0.16, C.cyan, 3, 1);
    for (let i = 0; i < 6; i++) { const a = angle + (i * Math.PI) / 3; L.line(ctx, cx + Math.cos(a) * r * 0.18, cy + Math.sin(a) * r * 0.18, cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8, C.cyanSoft, 3, 0.4); }
  };

  /** Puffer im Schachtgrund. compress 0..1. */
  K.buffer = (ctx, cx, yBase, o = {}) => {
    const h = (o.height || 120) * (1 - 0.5 * (o.compress || 0)); const w = o.width || 50;
    L.rect(ctx, cx - w / 2, yBase - h, w, h, o.color || C.amber, 3, 1);
    if (o.type === "spring") { const turns = 7; L.poly(ctx, Array.from({ length: turns * 2 + 1 }, (_, i) => [cx + (i % 2 ? w * 0.35 : -w * 0.35), yBase - (h * i) / (turns * 2)]), C.amber, 2.5, 1); }
    else { L.line(ctx, cx, yBase - h, cx, yBase - h - 30, C.steel, 6, 0.6); L.fillRect(ctx, cx - w * 0.6, yBase - h - 36, w * 1.2, 8, C.steel); }
  };

  /** Gebäude-/Schachtquerschnitt: gibt Geometrie zurück für weitere Elemente. */
  K.shaft = (ctx, x, y, w, h, o = {}) => {
    const floors = o.floors || 8; const fh = h / floors;
    L.rect(ctx, x, y, w, h, C.cyanSoft, 2, 0.5);
    for (let i = 1; i < floors; i++) { const yy = y + i * fh; L.line(ctx, x - 80, yy, x, yy, C.cyanDim, 2, 0); L.line(ctx, x + w, yy, x + w + 80, yy, C.cyanDim, 2, 0); }
    return { floorHeight: fh, floors };
  };

  window.CE.kit = K;
})();
