# ADR-003: FFmpeg-Compositor statt Remotion (V1)

**Status:** akzeptiert

**Kontext:** Remotion bietet React-basierte Animationen, benötigt aber Chrome-Rendering, ist langsamer und hat Lizenzbedingungen für Firmen (>3 Personen kostenpflichtig). Unser V1-Bedarf: Ken Burns, Übergänge, Overlays, Captions, Audio-Mix.

**Entscheidung:** Reines FFmpeg (deterministisch, 0 €, Docker-freundlich). Infografiken programmatisch als SVG→PNG (sharp).

**Folgen:** Komplexe animierte Diagramme später optional via Remotion (Interface `TimelineScene.videoPath` erlaubt vorgerenderte Clips).
