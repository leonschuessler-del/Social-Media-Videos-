/* Template-Registry: jede Datei in templates/ registriert sich selbst über CE.register.
   Diese Datei lädt nichts selbst – der Treiber injiziert alle templates/*.js. Hier nur ein Debug-Template. */
CE.register("debug", {
  draw(ctx, p) {
    const { L } = p;
    L.heading(ctx, p.params.title || "Visual Science", p.W / 2, p.H / 2 - 40, { size: 90 });
    L.text(ctx, `t = ${p.t.toFixed(2)} s`, p.W / 2, p.H / 2 + 60, { size: 40, align: "center", font: L.FONT.mono, color: L.C.amber });
    L.sparks(ctx, p.W / 2, p.H / 2 + 200, p.t % 1.5, { seed: 3, count: 50 });
    p.K.sheave(ctx, 300, 300, 110, p.t * 2);
    p.K.ropes(ctx, 300, 410, 900, { count: 6, t: p.t, broken: p.t > 2 ? [1] : [] });
    p.K.car(ctx, 1450, 400, 260, 360, { people: 2 });
  },
});
