# 11 – Status, bekannte Probleme, offene Entscheidungen

_Stand: 2026-09-24 (wird bei jedem Meilenstein aktualisiert)_

## Aktuelle Phase

**Phase 0 abgeschlossen, Phase 1 (Vertical Slice) implementiert.** Review-Modus SAFE, PROVIDER_MODE mock, `maxVideosPerDay=3` (Seed) – für Live-Start auf 1 setzen.

## Was funktioniert (verifiziert, 2026-09-24)

- **E2E-Vertical-Slice grün** (`packages/pipeline/src/e2e.test.ts`, Mock-Provider, echter FFmpeg-Render, ~2,5 min):
  Thema „Was passiert, wenn ein Aufzugseil reißt?“ → RESEARCH (7 Claims, 4 Quellen) → FACT_CHECK (Urteile je Claim, 1 Korrektur) → SCRIPT (6 Sektionen, HOOK zuerst) → STORYBOARD (10 Szenen) → ASSETS (8 Bilder + Infografik + Textkarte) → VOICE (Wort-Zeitstempel) → EDIT (MP4 1080×1920, ≈55 s, −13,9 LUFS, Wort-Captions, Overlays, Musik-Ducking) → QA (8 Checks, PASS, Score > 0,6) → REVIEW (SAFE) → APPROVE → READY → Mock-Upload → SCHEDULED. Kosten-Ledger: > 10 Einträge, 0 € (Mock). Originalitäts-Check blockiert Duplikat-Thema.
- Unit-Tests (33): State Machine, Scoring, Budget, Capacity, Usage/Preise, Ähnlichkeit, Szenen-Alignment, Publish-Slot, ASS/SRT-Captions, OpenAI-Helfer, Produktionsplaner (Tageslimit, Kill Switch), Experiment-Report (Mindeststichprobe, 95%-KI).
- **Orchestrator-Integrationstest grün** (`apps/server/src/jobs.test.ts`): pg-boss auf PostgreSQL, `video.produce` → 9 automatische Übergänge SELECTED → … → REVIEW, Kosten-Ledger in Postgres.
- **Longform-Render verifiziert** (Mock): 1920×1080, 165,7 s, −13,9 LUFS, Wort-Captions, Overlays, 3 Thumbnails.
- Tests haben während der Entwicklung echte Fehler gefunden und behoben: LUFS-Parsing in der Audio-QA, xfade-Timebase/Offset-Drift (Video kürzer als Ton), pg-boss-Singleton verwarf Folge-Jobs, **Scale-Gate zählte eingeplante Videos nicht** (Tageslimit umgehbar).
- PgStore-Integrationstest gegen PostgreSQL 16 (Migration, CRUD, Kosten-Snapshot, Asset-Reuse, Analytics-Upsert).
- QA hat während der Entwicklung einen echten Messfehler gefunden (LUFS-Parsing) – der Check greift.

## Bekannte Probleme

- Longform-Prototyp (Mock, ~16 Szenen 16:9): Render-Zeit auf 2 vCPU mehrere Minuten; Ergebnis siehe Abschnitt unten, sobald Lauf abgeschlossen.
- Mock-Visual-QA bewertet Platzhalterbilder pauschal mit 0,7 – im Mock ist Visual-QA `SEMI_AUTOMATED`.
- `gpt-6-astra`-Preise in Quellen uneinheitlich (5–10 $ / 25–50 $ pro 1M) → konservativ 10/50 in Preistabelle, `unknown=true`.
- Storyboard-Narrationsverteilung: bei inkonsistenter LLM-Ausgabe wird das Skript deterministisch gleichmäßig auf Szenen verteilt (Bild-Text-Sync dann gröber).
- Kill Switch ist persistent (`system_flags`), Worker übernehmen ihn innerhalb von ~5 s vor dem nächsten Job bzw. der nächsten Stufe. Eine bereits laufende FFmpeg-Stufe wird nicht hart abgebrochen (läuft zu Ende, danach Stopp).
- Render-Dauer: Longform-Mock (16 Szenen, 2,75 min) ≈ 10–12 min auf 4 vCPU, weil Ken-Burns bei 2× Überabtastung CPU-intensiv ist. Für 10-min-Longforms (≈ 60 Szenen) sind ≈ 40–60 min Render pro Video auf 4 vCPU zu erwarten → Worker-Parallelität/CPU entsprechend dimensionieren oder Überabtastung auf 1,5× senken.
- Live-Modus (OpenAI) ist implementiert, aber mangels Key **nicht live getestet** – erste Live-Runs werden Prompt-/Parameter-Anpassungen brauchen (Responses-API-Feldnamen, Bildgrößen, Stimme).

## Blocker (benötigen dich)

| # | Blocker | Warum | Was ich brauche |
|---|---|---|---|
| B1 | **OpenAI-API-Key + Prepaid-Guthaben** | ChatGPT-Abo ist offiziell nicht als API-Kontingent nutzbar; ohne Key läuft nur Mock | Freigabe: API-Account, Prepaid (Vorschlag 20 $), `OPENAI_API_KEY` in `.env` |
| B2 | **Google-Cloud-Projekt + OAuth-Client** | Upload/Analytics nur über offizielle API mit deinem Kanal-Consent | Client-ID/Secret (Env), Consent im Browser; Audit-Antrag (Wartezeit) |
| B3 | **KI-Video-Generierung** | OpenAI: nicht verfügbar (Sora eingestellt) | Entscheidung: bildbasiert bleiben (Empfehlung für Phase 1) oder externen Anbieter freigeben (Veo/Kling/Runway – Kosten ~0,10–0,50 $/s) |
| B4 | **Musik/SFX-Quelle** | OpenAI bietet keine; Bibliothek nötig | Entscheidung: YouTube Audio Library/CC0 (0 €) vs. Abo (Epidemic/Artlist) vs. generativ (ElevenLabs Music – externer Anbieter) |
| B5 | **Kanalstimme** | OpenAI-Stimmen (13) sind fest; Custom Voice nur mit Einwilligung/Freischaltung | Auswahl einer Stimme (Vorschlag `onyx` oder `ash`) nach Hörprobe im Live-Slice |

## Offene Entscheidungen (technisch, reversibel – ich habe entschieden, du kannst ändern)

- FFmpeg statt Remotion (ADR-003), pg-boss statt BullMQ/Redis (ADR-002), TypeScript-only statt TS+Python (ADR-001), bildbasierte Produktion statt KI-Video (ADR-004), R2/MinIO als Storage.

## Nächste Schritte

1. Live-Slice (erstes echtes Short mit OpenAI), sobald B1 vorliegt – danach Prompt-/Stil-Iteration anhand echter Bilder und Stimme.
2. Google-Cloud-Projekt + OAuth + Audit-Antrag parallel starten (B2), erster privater Upload.
3. Musikbibliothek befüllen (B4), Stimme wählen (B5).
4. Render-Performance für echte Longforms messen und Worker dimensionieren.
5. Abgleich Kosten-Ledger ↔ OpenAI Usage/Costs API (Admin-Key) als täglicher Job.
