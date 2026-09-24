# AI Content OS – Visual Edutainment Content Engine

Autonome, mehrprojektfähige Content-Engine für YouTube (Projekt 01: **Visual Science – „Was passiert, wenn …?“**). OpenAI-first, deterministischer FFmpeg-Schnitt, PostgreSQL, pg-boss, offizielle YouTube-APIs.

**Vertical Slice:** Thema → Research → Fact-Check → Skript → Storyboard → Visuals → Voice → Edit → QA → Review → YouTube-ready.

## Schnellstart

```bash
pnpm install
cp .env.example .env
pnpm test                      # Unit + E2E (offline, Mock-Provider, echter FFmpeg-Render)
pnpm cli produce --memory      # erstes Testvideo (Short) ohne DB/Keys
pnpm cli providers             # Provider-Status: AVAILABLE / MOCK / BLOCKED_BY_PROVIDER / DISABLED
```

Voraussetzungen: Node 22, pnpm 10, FFmpeg ≥ 6, PostgreSQL 16 (für Nicht-Memory-Betrieb). Details: [docs/10-setup-operations.md](docs/10-setup-operations.md).

## Dokumentation

Einstieg: [docs/00-README.md](docs/00-README.md) – Machbarkeit, Provider-Recherche, OpenAI-Matrix, Kostenmodelle, Architektur, Datenmodell, V1-Scope, Plan, YouTube-Policy, Setup, Status/Blocker, Testvideo-Konzept, ADRs.

## Struktur

```
apps/server     API (Hono) + Worker (pg-boss)      apps/cli   CLI für den Vertical Slice
packages/core   Domäne, State Machine, Budget, Usage, Provider-Interfaces, Router
packages/db     Drizzle-Schema, Migrationen, PgStore
packages/providers  OpenAI, Mock, Storage (local/S3), Musik/SFX-Bibliothek, YouTube
packages/render FFmpeg-Compositor, Captions, Thumbnails, Media-QA
packages/pipeline   Stages, Runner, Review, Mock-LLM, E2E-Test
legacy/         altes MoviePy-Schnittskript
```

## Wichtige Prinzipien

- **OpenAI-first:** andere KI-Anbieter sind standardmäßig DISABLED (`ENABLED_PROVIDERS`). Kein stiller Fallback – bei Limits `WAITING_FOR_CAPACITY`.
- **Ehrliche Labels:** AUTOMATED / SEMI_AUTOMATED / MANUAL / BLOCKED_BY_PROVIDER überall.
- **SAFE MODE** in V1: jedes Video braucht menschliche Freigabe.
- **Keine Secrets im Repo** – nur Variablennamen in `.env.example`.
