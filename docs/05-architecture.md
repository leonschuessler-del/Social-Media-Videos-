# 05 – Systemarchitektur

## Überblick

```
AI CONTENT OS (Monorepo, TypeScript, pnpm)
│
├── apps/server        CONTROL PLANE + ORCHESTRATOR
│   ├── api.ts         Hono REST-API (Projekte, Topics, Videos, Review, Usage, Kill Switch, YouTube-OAuth)
│   ├── worker.ts      pg-boss Worker (Queues: video.stage, video.produce, analytics.pull, capacity.resume)
│   └── bootstrap.ts   DB, Store, Secrets (AES-256-GCM), Provider-Registry, Kontext
├── apps/cli           Vertical Slice ohne UI: produce / run-stage / review / status / providers
├── apps/web           (später) Dashboard – bewusst nach dem Vertical Slice
│
├── packages/core      DOMÄNE (keine I/O-Abhängigkeiten)
│   ├── domain.ts      Typen: Project, Channel, Topic, ResearchDoc, Script, Storyboard/Scene, Asset, Video, QAReport, CostEntry, Experiment…
│   ├── workflow/      State Machine (Stufen, Übergänge, routeAfterQa, MAX_STAGE_ATTEMPTS)
│   ├── scoring/       Topic-Score (gewichtet, versioniert), Quality-Score, QA-Entscheidung
│   ├── budget/        BudgetGuard (pro Video/Tag/Monat/Provider), CapacityManager (Token-Bucket, WAITING_FOR_CAPACITY)
│   ├── usage/         Preistabelle (versioniert), UsageManager (jeder Provider-Call → Ledger)
│   ├── providers/     Interfaces: LLM, Search, Image, Video, TTS, STT, Music, SFX, Moderation, Storage, Publish, Analytics + Registry (Freigabeliste)
│   ├── router/        AIRouter: Task → (Provider, Modell, Effort) – OpenAI-first, versioniert
│   ├── originality/   Ähnlichkeitsmaße (Shingles/Jaccard, LCS) für Duplikat-/Wiederholungs-QA
│   └── store.ts       Store-Interface + In-Memory-Implementierung (Tests/E2E ohne DB)
│
├── packages/db        PostgreSQL (Drizzle): Schema, Migrationen, PgStore (implementiert Store)
├── packages/providers OpenAI (Responses/Images/TTS/STT/Moderation), Mock-Provider, Local/S3-Storage, Musik/SFX-Bibliothek, YouTube (Data v3 + Analytics v2), Factory
├── packages/render    FFmpeg-Compositor (Ken Burns, xfade, drawtext, ASS-Captions, Ducking, loudnorm), Thumbnail (sharp), Media-QA (blackdetect/silence/ebur128), synthetische Mock-Medien
└── packages/pipeline  Stages (Topic → Research → FactCheck → Script → Storyboard → Assets → Voice → Edit → QA → Metadata/Thumbnail → Publish → Analytics), Runner, Review, Mock-LLM + Fixtures, E2E-Test
```

## Datenfluss eines Videos

```
Topic (manual|discovery) ──score──▶ SELECTED
  ▶ RESEARCH     LLM+web_search → ResearchDoc {claims[], sources[], riskFlags}
  ▶ FACT_CHECK   zweites Routing (anderes Effort/Modell) → verdicts, corrections, mustFix
  ▶ SCRIPT       nur verifizierte Claims → Script {hookType, sections[claimIds]}
  ▶ STORYBOARD   Szenen {narration, prompt, method, camera, transition, overlay, styleTag}; Video-Methoden nur wenn Provider frei
  ▶ ASSETS       Reuse-Library (promptHash) → Infografik (lokal) → OpenAI Images; Fortschritt persistiert (idempotent)
  ▶ VOICE        OpenAI TTS (chunked) → whisper-1 Wortzeitstempel → Sidecar JSON
  ▶ EDIT         alignScenesToWords → TimelineSpec → FFmpeg → MP4 (+ ASS) → Metadata + 3 Thumbnails
  ▶ QA           TECHNICAL, AUDIO, RIGHTS, POLICY(moderation+LLM), FACT(LLM), VISUAL(Vision auf Frames), DUPLICATION, REPETITION → Score → Entscheidung
  ▶ routeAfterQa SAFE → REVIEW | SEMI_AUTO → READY wenn Score ≥ Threshold | FULL_AUTO → READY
  ▶ READY        YouTube videos.insert (private + publishAt, containsSyntheticMedia=true) → SCHEDULED
  ▶ PUBLISHED    Analytics-Cron → AnalyticsSnapshot (Views, AVD, APV, Retention, Subs, Revenue)
```

## OpenAI Media Router (OpenAI-first)

- `ENABLED_PROVIDERS=openai,local,mock` (Default). Jeder andere Provider ist registrierbar, aber **DISABLED**: Aufruf wirft `ProviderDisabledError` – kein stiller Fallback.
- `ROUTING_V1` (versioniert in git): jede Aufgabe hat eine Präferenzliste; das erste freigegebene Ziel gewinnt. Standard: `gpt-6-luna` (cheap: Scoring, Prompts, Metadaten, QA), `gpt-6-sol` (Research-Synthese, Script, Storyboard), Fact-Check mit `high` Effort auf `gpt-6-sol` (bewusst anderes Setting als Research).
- Video-Generierung: `openai-video` ist als `BLOCKED_BY_PROVIDER` registriert. Storyboard bekommt `videoGenerationAvailable=false` und plant nur IMAGE_KENBURNS/INFOGRAPHIC/TEXT_CARD.

## Usage Manager & Limit-aware Scheduling

- **Jeder** Provider-Call läuft durch `recordUsage` → `cost_entries` (Provider, Modell, Capability, Einheiten, USD/EUR, failed, retry, coveredByQuota, requestId). Video.costEur wird mitgeführt.
- `BudgetGuard.assertCanSpend` **vor** jedem kostenpflichtigen Call (Schätzung) → `BudgetExceededError` → Video **PAUSED** (Mensch entscheidet).
- `CapacityManager` (Token-Bucket je `provider:capability`) + `reportLimit` bei 429/insufficient_quota → `CapacityExhaustedError` → Video **WAITING_FOR_CAPACITY** mit `resumeAfter`; `capacity.resume`-Cron plant neu. **Kein Wechsel auf Fremdanbieter.**
- Scale-Gate: `project.maxVideosPerDay`; Priorisierung über Topic-Score (beste zuerst).

## Sicherheit

- Secrets nur über Env (`.env` ignoriert) bzw. verschlüsselt in `secrets` (AES-256-GCM, Key `SECRETS_ENCRYPTION_KEY`).
- Logging mit Redaction (pino) – keine Keys in Logs.
- Kill Switch (`KILL_SWITCH=true` / `POST /kill-switch`): keine Provider-Calls, keine Uploads.
- Idempotente Stufen (Assets werden übersprungen, wenn vorhanden), Retry mit Limit je Stufe, DEAD_LETTER, Audit-Log für jede Transition/Review/Upload.
- Least Privilege: YouTube-Scopes nur upload/youtube/analytics; API-Token für Control Plane.

## Erweiterbarkeit (AI MEDIA OS)

- Projekte/Kanäle sind Daten, nicht Code: neuer Kanal = neues `projects`-Row mit eigenem Styleguide, Review-Modus, Budget.
- Plattformen über `PublishProvider.platform` (youtube | tiktok | instagram) – TikTok/Instagram-Adapter später ohne Pipeline-Änderung.
- Sprachen: `Video.language` durchgereicht bis TTS/STT/Metadata.
- Lernschleife: `rule_versions` (versioniert, aktivierbar/reversibel), `experiment` je Video verknüpft mit `analytics_snapshots`.
