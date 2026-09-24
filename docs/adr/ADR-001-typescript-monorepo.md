# ADR-001: TypeScript-Monorepo statt TypeScript + Python

**Status:** akzeptiert (2026-09-24)

**Kontext:** Master-Prompt schlägt TS + Python (Media/AI) vor. FFmpeg lässt sich aus Node genauso steuern; Wort-Zeitstempel kommen per whisper-1-API; Bild-Compositing via sharp.

**Entscheidung:** Eine Sprache (TypeScript, Node 22, pnpm-Workspaces). Python bleibt Option für lokale ML-QA (Whisper lokal, CLIP-Checks) – dann als separater Worker-Service mit gleichem Store.

**Folgen:** Weniger Betriebs- und Typkomplexität; ein Docker-Image. Altes MoviePy-Skript nach `legacy/`.
