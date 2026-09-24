# 02 – Provider-/Tool-Recherche (Stand 2026-09-24)

Ziel: aktueller, belegter Stand. **OpenAI zuerst** (Policy). Andere Anbieter sind nur als Alternativen dokumentiert und im System **DISABLED**. Preise USD. „nf“ = in offiziellen Quellen nicht gefunden.

## A. OpenAI (offizielle Doku/Preisseiten/Help Center)

### Modelle & Preise (pro 1M Tokens)

| Modell | Input | Cached Input | Output | Anmerkung |
|---|---|---|---|---|
| gpt-6-astra | 5–10 $ (Quellen uneinheitlich; > 272K Kontext teurer) | 0,50–1,00 $ | 25–50 $ | Flagship, 1,05M Kontext, 128K Output, Batch/Flex −50 % |
| gpt-6-sol | 2,00 $ | 0,20 $ | 10,00 $ | „complex coding and professional work“ – unser Standard für Research/Script/Storyboard |
| gpt-6-luna | 0,10 $ | 0,01 $ | 0,50 $ | „focused, high-volume tasks“ – Scoring, Prompts, Metadaten, QA |
| gpt-5.6-sol | 4,00 $ (Promo) | 0,40 $ | 20,00 $ | Vorgänger |
| gpt-5.x (5.4/5.2/5.1/5) | 2,50/1,75/1,25/1,25 $ | – | 15/14/10/10 $ | ältere GPT-5/o3-Snapshots werden 2026-12-11 entfernt |
| web_search Tool | 10 $/1k Aufrufe + Content-Tokens | | | `url_citation`-Annotationen, `filters.allowed_domains` |
| o4-mini-deep-research / o3-deep-research | 2 $ / 10 $ | 0,50 $ / 2,50 $ | 8 $ / 40 $ | Responses API, Background-Modus empfohlen |
| gpt-image-2.5-flare / -sunburst / gpt-image-2 | Text 5 $, Bild-Input 8 $ | 1,25–2 $ | Bild-Output 30 $ | ≈ 0,004 $ (low) … 0,05 $ (medium) … 0,2 $ (high) je 1024²; Edits ohne Aufpreis (2.5); Custom-Auflösungen bis 3840 px Kante, Vielfache von 16 |
| gpt-image-1.5 / 1 / 1-mini | – | – | 32 $ / 40 $ / – | 1.5: 1024² low 0,009 $, medium 0,034 $; ältere GPT-Image-Modelle Abschaltung 2026-12-01 |
| sora-2 / sora-2-pro | **entfernt 2026-09-24** | | | zuvor 0,10 $/s (720p) bzw. 0,30–0,70 $/s |
| gpt-4o-mini-tts | 0,60 $ (Text) | | 12 $ (Audio-Tokens) ≈ 0,015 $/min | 13 Stimmen, `instructions`, Deutsch, 4096 Zeichen/Request, keine Zeitstempel |
| tts-1 / tts-1-hd | 15 $ / 30 $ pro 1M Zeichen | | | |
| whisper-1 | 0,006 $/min | | | einziges Modell mit `timestamp_granularities=word`; Abschaltung 2027-02-26 angekündigt |
| gpt-4o-transcribe / -mini / -diarize | 2,50 / 1,25 / 2,50 $ (≈ 0,006 / 0,003 / 0,006 $/min) | | | keine Wort-Zeitstempel |
| omni-moderation-latest | kostenlos | | | Text + Bild |

### Sonstiges (OpenAI)

- Responses API empfohlen; Chat Completions „remains supported“. Structured Outputs via `text.format` (JSON Schema, strict).
- Vision: alle aktuellen Modelle akzeptieren `input_image`; kein natives Video-Input (Frames extrahieren).
- Rate-Limit-Tiers: T1 (5 $ bezahlt) → 100 $/Monat, T2 (50 $) → 500 $, T3 (100 $) → 1.000 $, T4 (250 $) → 5.000 $, T5 (1.000 $) → 200.000 $.
- Usage/Costs API (`/v1/organization/usage/*`, `/v1/organization/costs`, Admin-Key) – Abgleich unseres Ledgers möglich; Projekt-Spend-Limits (soft/hard) im Dashboard.
- Automation: Agents SDK, `background: true`, Webhooks (`response.completed`, `batch.completed`), Batch −50 % (24 h).
- App-only (nicht per API): ChatGPT-Agent-Modus, Scheduled Tasks, Projects, Canvas, Custom GPTs, In-App-Deep-Research/-Bildgenerierung.
- Terms: Output gehört dem Kunden; Verbot programmatischer Extraktion aus ChatGPT und Umgehung von Limits; keine Likeness ohne Einwilligung.

Quellen: developers.openai.com/api/docs/pricing · …/models/gpt-6-astra · openai.com/index/introducing-gpt-6-sol-and-luna · …/docs/guides/tools-web-search · …/docs/guides/deep-research · …/docs/guides/image-generation · …/docs/models/gpt-image-2.5-flare · help.openai.com/en/articles/20001152 (Sora-Discontinuation) · …/docs/deprecations · …/docs/guides/text-to-speech · …/docs/guides/speech-to-text · …/docs/guides/moderation · …/docs/guides/rate-limits · help.openai.com/en/articles/9039756 (Billing getrennt) · …/8264644 (Prepaid) · …/8156019 (kein Abo-Transfer) · developers.openai.com/codex/auth · openai.com/policies/row-terms-of-use · openai.com/policies/usage-policies.

## B. YouTube (offiziell, verifiziert)

Siehe [09](09-youtube-policy.md) inkl. Quellen. Kernpunkte: drei Quota-Töpfe (100 Uploads/Tag à 1 Einheit, 100 Suchen/Tag, 10.000 Einheiten für den Rest; `thumbnails.set` 50, `videos.update` 50, `videos.list` 1); `status.containsSyntheticMedia` (seit 30.10.2024), `publishAt` nur mit `private`, `selfDeclaredMadeForKids`; Uploads unauditierter Projekte (nach 28.07.2020) privat bis Audit; Analytics API v2 (views, estimatedMinutesWatched, averageViewDuration, averageViewPercentage, subscribersGained, likes, shares, comments, engagedViews, estimatedRevenue/cpm mit Monetary-Scope + YPP, audienceWatchRatio × elapsedVideoTimeRatio); **Impressions + CTR über Reporting API** (`channel_reach_basic_a1`/`_combined_a1`, Metriken `video_thumbnail_impressions`, `video_thumbnail_impressions_ctr`, seit ~15.01.2026). Ob die gezielte Analytics API inzwischen `videoThumbnailImpressions` liefert, ist nur durch Drittquellen belegt – wir nutzen die offizielle Reporting API.

## C. Externe Alternativen (dokumentiert, im System DISABLED – nur nach ausdrücklicher Freigabe)

Stand 2026-09-24. Die offiziellen Hosts waren aus der Sandbox nicht direkt abrufbar; Zahlen stammen aus Such-Snippets der zitierten Seiten. **Vor einer Freigabe jede Zahl erneut prüfen.** „3P“ = nur Drittquelle.

### Video (Ersatz für eingestellte Sora-API)

| Anbieter | Modell | Preis (USD/s) | Fähigkeiten | Zugang | Nutzungsbedingungen | Quelle |
|---|---|---|---|---|---|---|
| Google | Veo 3.1 / Fast / Lite | Std 0,40 (720p/1080p), 0,60 (4K); **Fast 0,10/0,12/0,30**; Lite 0,05/0,08 – inkl. Audio | 8-s-Clips, Image-to-Video, First/Last-Frame, bis 3 Referenzbilder, Extend | Gemini API / Vertex | SynthID; KI-Indemnity auf Vertex | ai.google.dev/gemini-api/docs/pricing |
| Google | Gemini Omni Flash (Preview) | 0,10 (720p) | 3–10 s (Extend bis 40 s) | Gemini API | wie Veo | ai.google.dev/gemini-api/docs/pricing |
| Kling | 3.0 | 0,112 ohne / 0,168 mit Audio (1080p) | I2V, bis 15 s | Kling Open Platform (Prepaid) oder fal | kommerziell frei; Prompts nicht fürs Training | kling.ai/dev/pricing |
| Runway | Gen-4.5 (Gen-4 Turbo) | 0,12 (0,05) | I2V, 2–10 s, 720p | Runway Dev API | kommerziell frei; **Runway darf Inputs/Outputs zum Training nutzen** | docs.dev.runwayml.com/guides/pricing |
| Luma | Ray 3.2 | 5-s-Clip: 720p 0,30 $, 1080p 1,20 $ (0,24/s) | I2V, 5/10 s, HDR | Luma API (Preise „subject to change“) / fal | nicht geprüft | fal.ai (Modellseite) |
| MiniMax | Hailuo 2.3 Pro / H3 | ≈ 0,08 (Hailuo, 1080p); H3 0,047–0,081 (widersprüchlich) | 6–15 s, bis 2K, First/Last-Frame, Audio; H3-Base Open Weights | MiniMax / fal | Community-Lizenz nicht geprüft | platform.minimax.io |
| ByteDance | Seedance 2.0 / 2.5 | 0,30 (720p) / 0,68 (1080p); 2.5 ≈ 0,47 (720p) | bis 15–30 s, Audio | BytePlus / fal | nicht geprüft | fal.ai, docs.byteplus.com |
| Alibaba | Wan 3.0 (API) / Wan 2.2 (offen) | 0,10 (720p) / 0,20 (1080p); 2.2 selbst gehostet ≈ 0,05–0,07 (Schätzung, H100) | bis 30 s; 2.2 Apache-2.0 | Model Studio / Self-Host | 2.2 Apache-2.0 | alibabacloud.com, huggingface.co/Wan-AI |

### Musik

| Option | Preis | Rechte / Content ID | Quelle |
|---|---|---|---|
| ElevenLabs Music API | 0,15 $/min | „cleared for commercial use“ (Label-/Verlagsdeals); Content-ID-Status nicht dokumentiert | elevenlabs.io/pricing/api |
| Stable Audio 2.5 / 3.0 | ≈ 0,20–0,26 $/Generierung (Credit-Preis 3P) | lizenzierte Trainingsdaten | platform.stability.ai/pricing |
| Suno / Udio | keine öffentliche API (Suno nur Partnerprogramm; Udio ohne Downloads) | nicht nutzbar | – |
| **YouTube Audio Library** | kostenlos, **keine API** (manueller Download in die Bibliothek) | monetarisierbar, Content-ID-sicher; CC-Tracks mit Attribution | support.google.com/youtube/answer/3376882 |
| Epidemic Sound | ab 9,99 $/Monat | API nur per Partnerschaft | epidemicsound.com/pricing |
| Artlist | ab 9,99 $/Monat | **Automatisierte/Bot-Downloads verboten** | artlist.io Terms |
| Pixabay Music | kostenlos | **Content-ID-Risiko** bei markierten Tracks – herausfiltern | pixabay.com/service/license-summary |

### Soundeffekte

| Option | Preis | Bedingungen |
|---|---|---|
| ElevenLabs SFX | 0,12 $/min (≤ 30 s je Generierung) | kommerziell auf bezahlten Plänen |
| Freesound | kostenlos | CC0/CC-BY/CC-BY-NC; **API nur nicht-kommerziell kostenlos** – für monetarisierte Pipeline Lizenz der MTG-UPF nötig; manueller CC0-Download in die Bibliothek ist die saubere Variante |
| Pixabay SFX | kostenlos | keine Attribution, keine Audio-API |
| Zapsplat | kostenlos mit Attribution / 4,99 £/Monat | keine API |

### Stimme (alle mit Deutsch)

- ElevenLabs Eleven v3 / Multilingual v2: 0,10 $/1K Zeichen (Flash 0,05); Zeichen-Zeitstempel (`/with-timestamps`) + Forced Alignment.
- Cartesia Sonic-3: ≈ 0,037 $/1K Zeichen (Scale-Plan); Wort-Zeitstempel.
- Google Chirp 3 HD: 30 $/1M Zeichen (1M/Monat frei); keine nativen Wort-Zeitstempel.
- Azure Neural 16 $/1M, HD 22 $/1M; WordBoundary-Events.
- Zum Vergleich OpenAI gpt-4o-mini-tts ≈ 0,015 $/Minute (≈ 0,015 $ je ~900 Zeichen) – deutlich günstiger, aber ohne Zeitstempel und mit festen Stimmen.

### Suche

Perplexity Sonar 5–12 $/1k (+ Tokens) · Exa 7 $/1k · Tavily 8–16 $/1k · Brave 5 $/1k · zum Vergleich OpenAI `web_search` 10 $/1k (+ Content-Tokens).

### Empfehlung, falls Freigabe gewünscht

1. **Hero-Clips:** Google Veo 3.1 Fast (1080p, I2V, First/Last-Frame). 10 Clips à 8 s mit Retry-Reserve ≈ 160 s × 0,12 $ ≈ **19 $ pro Longform** (Lite ≈ 13 $). Alternative: Kling 3.0 ohne Audio ≈ 18 $.
2. **Musik:** zuerst kostenlos und manuell kuratiert aus der YouTube Audio Library (Content-ID-sicher). Generativ: ElevenLabs Music ≈ 3 $ pro Longform.
3. Nicht empfohlen: Artlist-Automation (AGB), Suno/Udio (keine API), Pixabay-Tracks mit Content-ID-Label, Freesound-API ohne kommerzielle Lizenz.

Quellen: siehe Tabellen; zusätzlich help.openai.com/en/articles/20001152 (Sora-Einstellung), cloud.google.com/terms/generative-ai-indemnified-services, docs.perplexity.ai, exa.ai/pricing, docs.tavily.com, api-dashboard.search.brave.com, freesound.org/help/tos_api.
