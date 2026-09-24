# @content-os/motion – Motion-Graphics-Engine

Deterministische 2D-Animationen (Canvas) in headless Chromium, Frame-Capture nach FFmpeg. Stil „Visual Science“: Röntgen/Blueprint, leuchtende Cyan-/Amber-Linien auf dunklem Navy.

## Aufbau
- `web/lib.js` – Zeichen-Primitive (`p.L`): Glow-Linien, Text, Callouts, Pfeile, Funken, Diagramme, Easing, deterministischer Zufall.
- `web/kit.js` – gemeinsame Aufzug-Bauteile (`p.K`): Schacht, Kabine, Gegengewicht, Seile, Treibscheibe, Puffer, Führungsschiene.
- `web/engine.js` – Timeline, Kamera (push/pull/pan/tilt), Übergänge (fade/cut/flash), Text-Overlay, Kapitel-Badge, Vignette.
- `web/templates/*.js` – je Datei ein Szenen-Template: `CE.register("name", { draw(ctx, p), ownsText? })`.
- `src/render.ts` – Chunk-paralleles Rendering (N Tabs × FFmpeg) + verlustfreies Zusammenfügen; `previewScene`, `contactSheet`.

## Template-Vertrag
`draw(ctx, p)` mit `p = { t, d, u, params, text, W, H, L, K, rng, T, fps }`. Deterministisch (kein `Math.random`, kein `Date`), robust für Dauern 3–20 s (Phasen relativ zu `d`), Defaults für fehlende Parameter, Sicherheitsrand 90 px, < 40 ms pro Frame.

## CLI
```bash
npx tsx packages/motion/src/cli.ts preview <template> --params '{…}' --text "…" --duration 8 --out <dir>   # 4 Standbilder + Kontaktbogen
npx tsx packages/motion/src/cli.ts bench <template> --params '{…}'                                          # ms pro Frame
npx tsx packages/motion/src/cli.ts render <timeline.json> --out video.mp4 --chunks 3                         # Rendering
```
