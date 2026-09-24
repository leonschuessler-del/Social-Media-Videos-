# 08 – Implementierungsplan

Iterativ: PLAN → BUILD → TEST → MEASURE → FIX → DOCUMENT → NEXT. Kein Big Bang. Aufwände sind Schätzungen für einen Senior-Engineer bzw. einen Agenten mit Toolzugriff (Kalenderzeit hängt von Wartezeiten wie API-Audit ab).

## Meilensteine

| M | Ziel | Inhalt | Abhängigkeiten | Tests | Sicherheitsgrenzen | Aufwand | Status |
|---|---|---|---|---|---|---|---|
| **M0** Phase 0 | Machbarkeit, Recherche, Architektur, Kosten, Plan | Docs 01–12, ADRs | – | – | – | 1 Tag | ✅ (2026-09-24) |
| **M1** Vertical Slice offline | Thema → … → QA → Review → Mock-Upload mit echtem FFmpeg-Render, Mock-Providern | Monorepo, core, db, providers, render, pipeline, CLI | M0 | Unit (core), E2E (Mock) | Keine echten Kosten; Mock-Upload klar gekennzeichnet | 2 Tage | ✅ E2E grün |
| **M2** Live-Slice Short | Gleicher Ablauf mit OpenAI-API (Text, Websuche, Bilder, TTS, whisper) | M1 + `OPENAI_API_KEY` + Prepaid-Guthaben (**Freigabe**) | Manuelle Prüfung Short (Fakten, Bildqualität, Stimme); Kosten-Ledger vs. OpenAI-Dashboard abgleichen | Budget: 3 €/Short, 20 €/Tag; PROVIDER_MODE=live; SAFE MODE | 1–2 Tage (+ Iteration Prompts) | ⏳ Blocker: Key |
| **M3** Longform-Prototyp | 8–10 min, Chapters, Thumbnails, Kosten ≤ 6 € | M2 | Manuelle Prüfung; Retention-Vorhersage vs. Realität später | 25 €/Longform | 2 Tage | ⏳ |
| **M4** YouTube-Anbindung | OAuth-Flow, Upload privat/scheduled, Thumbnail, Analytics-Pull | Google-Cloud-Projekt, OAuth-Client (**manuell**), Kanal-Consent | Upload-Test (privat), Analytics-Test | Nur `private` bis Audit; Kill Switch getestet | 1 Tag + Audit-Wartezeit (Wochen) | ⏳ |
| **M5** Worker/Orchestrator in Betrieb | pg-boss Worker + API, Cron (Planung 06:00, Analytics 6-stündlich, Resume 10-minütlich), DLQ, persistenter Kill Switch | M1 | Integrationstest mit Postgres (Job-Kette) ✅, Kill-Switch-Test ✅, Capacity-Test (429-Simulation) ⏳ | Scale-Gate 1/Tag | 1–2 Tage | ✅ Code + Kette grün / ⏳ Docker-Betrieb |
| **M6** Minimal-Dashboard | Overview, Pipeline-Board, Review-Queue mit Player, Usage | M5 | Smoke | Read-only außer Review-Aktionen | 2–3 Tage | 🟡 statische Review-Seite (`GET /`) vorhanden; ausgebautes Dashboard später |
| **M7** Phase-1-Betrieb | 1–3 Videos/Tag, SAFE, wöchentliche Qualitäts-/Kostenreview | M2–M6 | Wöchentliche KPI-Auswertung | Budget-Monat 400 € | laufend, 4–6 Wochen | ⏳ |
| **M8** Lernschleife v1 | Experiment-Attribute ↔ Analytics, Reports; versionierte Regeln (manuell aktiviert) | ≥ 30 Videos Daten | Statistische Mindeststichprobe | Keine automatische Regeländerung | 3 Tage | 🟡 Report (n ≥ 30, 95%-KI) implementiert; Regel-Versionierung vorbereitet |
| **M9** Scale-Gate → Phase 2 | SEMI_AUTO, maxVideosPerDay ↑, Asset-Reuse, Batch-API | M7 KPIs grün (siehe 09) | Regressionstests | Stufenweise | 2 Tage | ⏳ |
| **M10** Multi-Projekt / Plattformen | Projekt 02, TikTok/Instagram-Adapter, Repurposing Longform→Shorts | M9 | E2E je Plattform | Separate Budgets je Projekt | 1–2 Wochen | ⏳ |

## Reihenfolge der nächsten konkreten Schritte

1. **E2E grün halten** (M1) – Test `pnpm test`; Longform-Mock-Lauf via CLI.
2. **Freigabe & Key**: OpenAI-API-Account mit Prepaid (Empfehlung: 20 $ Start), `OPENAI_API_KEY` in `.env`, `PROVIDER_MODE=live`, erster Live-Short.
3. Prompt-Iteration anhand echter Outputs (Research-Qualität, Bild-Stil-Konsistenz, Stimme).
4. Google-Cloud-Projekt + OAuth-Client + Audit-Antrag parallel starten (lange Wartezeit).
5. Musik-Bibliothek befüllen (`assets/music` + `license.json`), z. B. YouTube Audio Library / CC0.
6. Worker + API via Docker Compose betreiben; Integrationstest Job-Kette.
7. Minimal-Dashboard.

## Tests (bestehend / geplant)

| Ebene | Was | Datei/Kommando |
|---|---|---|
| Unit | State Machine, Scoring, Budget, Capacity, Usage/Preise, Ähnlichkeit | `packages/core/src/**/*.test.ts` |
| E2E (offline) | Vertical Slice Short mit Mock-Providern + echter FFmpeg-Render, Review, Mock-Upload, Originalität | `packages/pipeline/src/e2e.test.ts` |
| Integration | PgStore gegen Postgres ✅, pg-boss-Kette bis REVIEW ✅ | `packages/db/src/store-pg.test.ts`, `apps/server/src/jobs.test.ts` |
| Planer/Experimente | Tageslimit, Kill Switch, Mindeststichprobe | `packages/pipeline/src/planner.test.ts` |
| Live-Smoke (manuell, Freigabe) | 1 Short mit OpenAI; Kostenabgleich | CLI `produce` mit `PROVIDER_MODE=live` |

## Sicherheitsgrenzen (immer aktiv)

- Budgets: `BUDGET_PER_VIDEO_SHORT_EUR=3`, `…LONGFORM=25`, `BUDGET_DAILY_EUR=20`, `BUDGET_MONTHLY_EUR=400` → Überschreitung = PAUSED.
- Scale-Gate `maxVideosPerDay` (Seed: 3; für Live-Start 1 empfohlen).
- `KILL_SWITCH`, SAFE MODE, `private`-Uploads bis Audit, `containsSyntheticMedia=true`, `madeForKids=false`.
- Keine Fremdanbieter ohne `ENABLED_PROVIDERS`-Eintrag (= explizite Freigabe).
