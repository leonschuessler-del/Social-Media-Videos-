# AI CONTENT OS – Zentrale Dokumentation

> Stand: 2026-09-24 · Phase: **0 → 1 (Vertical Slice)** · Review-Modus: **SAFE** · Provider-Policy: **OpenAI-first**

Ein neuer Entwickler oder Agent muss das Projekt anhand dieser Doku übernehmen können. Reihenfolge zum Einlesen:

| Nr | Dokument | Inhalt |
|----|----------|--------|
| 01 | [Machbarkeit & Risiken](01-feasibility.md) | Technisch, wirtschaftlich, YouTube-Policy – inkl. Widerspruch zu Annahmen des Master-Prompts |
| 02 | [Provider-/Tool-Recherche](02-research-apis.md) | Stand der APIs (OpenAI zuerst; Alternativen nur dokumentiert, DISABLED) |
| 03 | [OpenAI-Capability-Matrix & Make-or-Buy](03-openai-matrix-make-or-buy.md) | Was ist mit OpenAI offiziell automatisierbar – Komponente für Komponente |
| 04 | [Kostenmodelle](04-cost-models.md) | 1 Short, 1 Longform, 100 Videos, 1.000 Videos – MVP / Quality / Scale |
| 05 | [Architektur](05-architecture.md) | Module, Datenfluss, Provider-Abstraktion, Usage Manager, Limit-aware Scheduling |
| 06 | [Datenmodell & State Machine](06-data-model-state-machine.md) | Tabellen, Stufen, Zustände, Übergänge, Review-Modi |
| 07 | [V1-Scope & Definition of Done](07-v1-scope.md) | Was V1 ist – und was explizit nicht |
| 08 | [Implementierungsplan](08-implementation-plan.md) | Reihenfolge, Abhängigkeiten, Meilensteine, Tests, Sicherheitsgrenzen, Aufwand |
| 09 | [YouTube-Policy & Compliance](09-youtube-policy.md) | Harte Regeln, die die Pipeline erzwingt |
| 10 | [Setup, Betrieb, Tests](10-setup-operations.md) | Lokal starten, Docker, CLI, API, Env-Variablen (nur Namen) |
| 11 | [Status, bekannte Probleme, offene Entscheidungen](11-status-and-decisions.md) | Aktueller Stand, Blocker, nächste Schritte |
| 12 | [Erstes Testvideo-Konzept](12-first-test-video.md) | „Was passiert, wenn ein Aufzugseil reißt?“ – Short + Longform-Prototyp |
| ADR | [adr/](adr/) | Architekturentscheidungen (kurz, versioniert) |

## Automatisierungs-Labels (ehrlich)

Jeder Workflow-Schritt trägt eines dieser Labels – im Code (`AutomationLevel`), in QA-Reports und in dieser Doku:

- **AUTOMATED** – läuft ohne Mensch, offiziell unterstützte API.
- **SEMI_AUTOMATED** – läuft automatisch, braucht aber stichprobenartig oder im SAFE-Modus einen Menschen.
- **MANUAL** – muss ein Mensch tun (z. B. YouTube-Impressions/CTR ablesen, API-Audit beantragen).
- **BLOCKED** / **BLOCKED_BY_PROVIDER** – technisch nicht offiziell automatisierbar (z. B. KI-Video bei OpenAI seit 2026-09-24).
