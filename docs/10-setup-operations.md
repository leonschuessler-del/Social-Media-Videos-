# 10 – Setup, Betrieb, Tests

## Voraussetzungen

- Node 22, pnpm 10, FFmpeg ≥ 6 (`apt install ffmpeg`), Fonts (`fonts-dejavu-core`), PostgreSQL 16 (lokal oder Docker).
- Optional: Docker/Compose, MinIO oder Cloudflare R2.

## Lokal starten

```bash
pnpm install
cp .env.example .env          # Werte eintragen (nur Namen sind dokumentiert, nie Secrets committen)
pnpm db:migrate               # Migrationen (packages/db/drizzle)
pnpm test                     # Unit + E2E + Integration (Postgres-Tests werden ohne DB übersprungen)

# Vertical Slice per CLI (ohne Dashboard)
pnpm cli produce --memory                                   # Aufzugseil-Short, In-Memory, bis REVIEW
pnpm cli produce --format LONGFORM --memory                 # Longform-Prototyp (Mock)
pnpm cli produce --title "Was passiert in einer Mikrowelle wirklich?" --format SHORT   # mit Postgres
pnpm cli status
pnpm cli review <videoId> --decision APPROVE --publish      # SAFE MODE Freigabe + Upload/Schedule (Mock oder YouTube)
pnpm cli providers                                          # Provider-Status (AVAILABLE/MOCK/BLOCKED/DISABLED)
pnpm cli plan                                               # Ideen bewerten, beste bis Tageslimit einplanen
pnpm cli experiments --dimension visualStyle --metric averagePercentageViewed
pnpm cli kill-switch on|off                                 # persistenter Kill Switch (wirkt auf alle Worker)

# Dienste
pnpm dev:api      # http://localhost:3000 (Bearer API_TOKEN)
pnpm dev:worker   # pg-boss Worker
docker compose up # Postgres + MinIO + API + Worker
```

## Provider-Modus

| `PROVIDER_MODE` | Verhalten |
|---|---|
| `mock` (Default) | Alles offline, 0 €. Mock-LLM mit Fixture für das Testthema, Platzhalterbilder, synthetische Sprachspur, Mock-Upload. Beweist Pipeline-Mechanik, nicht Inhaltsqualität. |
| `live` | OpenAI-API für Text/Websuche/Bilder/TTS/STT/Moderation (Key nötig). Video: BLOCKED_BY_PROVIDER → bildbasiert. YouTube real, wenn OAuth-Client + Kanal-Consent vorhanden. |

`ENABLED_PROVIDERS=openai,local,mock` – nur diese dürfen aufgerufen werden. Ein weiterer Anbieter (z. B. `anthropic`) wird erst durch Eintrag hier freigegeben (= ausdrückliche Freigabe des Betreibers).

## Umgebungsvariablen (Namen)

Siehe `.env.example`. Gruppen: Core (DATABASE_URL, KILL_SWITCH, DEFAULT_REVIEW_MODE), Storage (STORAGE_DRIVER, S3_*), Provider (PROVIDER_MODE, ENABLED_PROVIDERS, OPENAI_API_KEY, OPENAI_IMAGE_MODEL, OPENAI_TTS_MODEL), Musik/SFX (MUSIC_LIBRARY_DIR, SFX_LIBRARY_DIR), YouTube (YOUTUBE_CLIENT_ID/SECRET/REDIRECT_URI, SECRETS_ENCRYPTION_KEY), Budgets (BUDGET_*), Render (FFMPEG_PATH, RENDER_THREADS), API (API_PORT, API_TOKEN).

## YouTube-Kanal verbinden (offizieller OAuth-Flow)

1. Google-Cloud-Projekt → YouTube Data API v3 + YouTube Analytics API aktivieren → OAuth-Client (Web) mit Redirect `YOUTUBE_REDIRECT_URI`.
2. `POST /projects/:id/channels` → channelId.
3. Browser: `GET /oauth/youtube/start?channelId=…` → Consent → Refresh-Token wird verschlüsselt gespeichert (`secrets`).
4. Uploads sind privat, bis das API-Projekt auditiert ist (MANUAL).

## Musik/SFX-Bibliothek

`assets/music/license.json`:
```json
{ "tracks": { "calm_tech_01.mp3": { "title": "Calm Tech", "mood": ["documentary", "tension"], "license": "YouTube Audio Library – free", "attributionRequired": false, "source": "YouTube Audio Library" } } }
```
Ohne Einträge nutzt der Renderer ein synthetisches Ambient-Pad (eigene Erzeugung, klingt simpel, rechtlich sauber).

## API-Kurzreferenz (Bearer API_TOKEN)

`GET /` (Review-Seite) · `GET /health` · `GET /overview` · `POST /projects/:id/plan` · `GET /projects/:id/experiments?dimension=…&metric=…` · `GET/POST /projects…` · `POST /projects/:id/topics` · `POST /projects/:id/topics/discover` · `POST /topics/:id/produce` · `GET /videos?stage=REVIEW` · `GET /videos/:id` · `GET /videos/:id/asset/:assetId` (Stream) · `POST /videos/:id/review {decision}` · `POST /videos/:id/run|pause|resume` · `GET /usage` · `GET /audit` · `POST /kill-switch {enabled}`

## Deployment

`apps/server/Dockerfile` (Node 22 + FFmpeg). Compose startet API + Worker getrennt (gleiches Image). Produktion: 1× API, 1–N× Worker (CPU-lastig durch FFmpeg), Postgres managed, R2 als Storage.
