# 03 – OpenAI-Capability-Matrix & Make-or-Buy

Quelle: offizielle OpenAI-Dokumentation/Preisseiten und Help-Center, Stand **2026-09-24** (Details und URLs in [02](02-research-apis.md)). Keine Annahmen; wo nichts Offizielles gefunden wurde, steht „nicht gefunden“.

## Harte Fakten zur Abrechnung

- „ChatGPT and the API platform have separate billing systems. API usage is billed separately from your ChatGPT subscription.“ (help.openai.com)
- API = Prepaid-Guthaben (min. 5 $, verfällt nach 12 Monaten) oder Pay-as-you-go; Nutzungs-Tiers (Tier 1 ab 5 $ Zahlung → 100 $/Monat Limit, Tier 2 ab 50 $ → 500 $/Monat …).
- ChatGPT-Credits (Plus/Pro/Business) gelten für Codex, ChatGPT-Produkte – **nicht** für die API.
- Codex-CLI „Sign in with ChatGPT“: offiziell nur für Codex-Workflows; für Automation empfiehlt OpenAI ausdrücklich API-Keys. Nicht als allgemeines LLM-Backend nutzbar.
- Nutzungsbedingungen verbieten programmatisches Extrahieren von Output aus ChatGPT und das Umgehen von Limits → **keine Browser-/Session-Automation** (auch nicht „nur zum Testen“).
- Output-Eigentum: „You retain your ownership rights in Input and own the Output.“ Business Terms: Customer owns all Output. Kommerzielle Nutzung generierter Bilder/Texte/Audio ist damit gedeckt (Usage Policies beachten: keine Likeness ohne Einwilligung etc.).

## Matrix

| Komponente | OpenAI/ChatGPT möglich? | Im Abo enthalten? | Programmatisch automatisierbar? | Separate API-Kosten? | Limit? | Alternative (DISABLED) | Status |
|---|---|---|---|---|---|---|---|
| Research | Ja – Responses API `web_search` (mit `url_citation`), Deep-Research-Modelle | Nur in der ChatGPT-App | **Ja** | Ja: 10 $/1k Suchaufrufe + Tokens; Deep Research o4-mini-deep-research 2 $/8 $ pro 1M | Tier-Rate-Limits | Perplexity Sonar, Exa, Tavily, Brave | **AVAILABLE (API_ONLY_PAID)** |
| Reasoning | gpt-6-astra / gpt-6-sol / gpt-6-luna, gpt-5.6 | App: ja | **Ja** | Sol 2 $/10 $, Luna 0,10 $/0,50 $ pro 1M Tokens | Tier-Limits, 1,05M Kontext | Claude, Gemini, DeepSeek | **AVAILABLE** |
| Script | dito, Structured Outputs (`text.format` json_schema) | App: ja | **Ja** | wie Reasoning | – | dito | **AVAILABLE** |
| Fact Checking | dito + `web_search` (Domain-Filter), zweites Modell/Effort | App: ja | **Ja** | wie Research | – | unabhängiges Zweitmodell (Claude) – DISABLED | **AVAILABLE** (nur OpenAI-intern „unabhängig“ über anderes Modell/Effort) |
| Image Generation | gpt-image-2.5-flare/-sunburst, gpt-image-2, gpt-image-1.5 (Images API + Responses `image_generation`) | App: ja | **Ja** | Ja, tokenbasiert: ~0,004–0,05 $/Bild (low–medium), high bis ~0,2 $ | Org-Verifizierung ggf. nötig; Tier-Limits | FLUX, Imagen, Ideogram (fal/Replicate) | **AVAILABLE** |
| Image Editing | `/v1/images/edits` (Maske, bis 10 Referenzbilder), Multi-Turn via Responses | App: ja | **Ja** | wie Bild (Edit ohne Aufpreis bei 2.5) | – | FLUX Kontext | **AVAILABLE** |
| Video Generation | **Nein** – Sora-App 26.04.2026 und Videos-API 24.09.2026 eingestellt, kein Nachfolger | Nein | **Nein** | – | – | Veo 3.x, Kling, Runway Gen-4, Luma, Hailuo, Wan (open) | **BLOCKED_BY_PROVIDER** |
| Voice (TTS) | gpt-4o-mini-tts (13 Stimmen, `instructions`, Deutsch), tts-1/-hd; Custom Voices nur mit Einwilligung/„eligible customers“ | App: nur Voice-Chat | **Ja** | ~0,015 $/Audio-Minute (+0,60 $/1M Text-Tokens) | 4096 Zeichen/Request (wir chunken) | ElevenLabs, Cartesia, Google | **AVAILABLE** (keine Zeitstempel → STT-Alignment) |
| Wort-Zeitstempel (STT) | whisper-1 `timestamp_granularities=word` | – | **Ja** | 0,006 $/Minute | whisper-1 Abschaltung angekündigt 2027-02-26 | Deepgram, AssemblyAI, whisper.cpp lokal | **AVAILABLE** |
| Music | nicht gefunden (keine Musik-API) | Nein | **Nein** | – | – | Lokale lizenzierte Bibliothek (jetzt), ElevenLabs Music/Stable Audio (später) | **BLOCKED_BY_PROVIDER** → lokale Bibliothek |
| Sound Effects | nicht gefunden | Nein | **Nein** | – | – | Lokale Bibliothek (Freesound CC0), ElevenLabs SFX | **BLOCKED_BY_PROVIDER** → lokale Bibliothek |
| Video Editing | keine Schnitt-API (Sora-Remix weg) | Nein | **Ja – aber lokal** | 0 $ (FFmpeg, eigener Code) | CPU-Zeit | Remotion, Creatomate | **AVAILABLE (deterministisch, lokal)** |
| Thumbnail | Bildmodelle + programmatischer Text (sharp/SVG) | App: ja | **Ja** | wie Bild | – | – | **AVAILABLE** |
| Upload | keine OpenAI-Funktion; **YouTube Data API v3** (offiziell) | – | **Ja** (YouTube) | kostenlos; eigener Upload-Topf 100 Uploads/Tag (1 Einheit je Upload) | API-Audit nötig, sonst Uploads privat | – | **AVAILABLE (YouTube)**, Audit **MANUAL** |
| Analytics | OpenAI Usage/Costs API für eigene Verbräuche (Admin-Key); **YouTube Analytics API** (Views, Watchtime, AVD, APV, Retention, Subs, Revenue) + **Reporting API** (Impressions, CTR) | – | **Ja** | kostenlos | Reach-Reports täglich, erster bis ~48 h Verzug; „viewed vs. swiped“ nur Studio | – | **AVAILABLE**; Shorts-Swipe-Rate **MANUAL** |
| QA (Fakten/Visual/Policy) | GPT-6-Vision auf Frames, omni-moderation (kostenlos) | App: ja | **Ja** | Tokens (Bild-Input) | – | Claude Vision | **AVAILABLE** |

## Make-or-Buy je Komponente

| Komponente | Entscheidung | Begründung |
|---|---|---|
| LLM/Reasoning/Script/QA | **Buy (OpenAI API)** | Kein sinnvolles Self-Hosting auf diesem Qualitätsniveau; Kosten pro Video im Cent-Bereich. |
| Web-Research | **Buy (OpenAI web_search)** | Zitate inklusive, ein Anbieter, ein Key. Exa/Tavily nur wenn Qualität nicht reicht (Freigabe). |
| Bild | **Buy (OpenAI Images)** | Beste Verfügbarkeit im OpenAI-Ökosystem; Edit ohne Aufpreis. |
| Video-Clips | **Nicht verfügbar** → **Make (bildbasiert, FFmpeg Ken Burns)** | Einziger OpenAI-konformer Weg; extern nur nach Freigabe. |
| TTS | **Buy (OpenAI TTS)** | Deutsch ok, steuerbar; Wiedererkennbarkeit über feste Stimme + `instructions`. Custom Voice erst bei Bedarf. |
| Untertitel-Timing | **Buy (whisper-1)** | 0,006 $/min, Wortzeitstempel. Lokales whisper.cpp später möglich (Make). |
| Musik/SFX | **Make (lokale Bibliothek + license.json)** | OpenAI hat nichts; lizenzrechtlich sauberste Lösung. |
| Schnitt/Render | **Make (FFmpeg-Compositor in TypeScript)** | Deterministisch, 0 €, Docker-fähig; Remotion optional (ADR-003). |
| Thumbnails | **Make (sharp/SVG) + Buy (Bild)** | Text muss exakt sein → programmatisch. |
| Orchestrierung | **Make (pg-boss auf PostgreSQL)** | Kein Redis, transaktional, Retry/DLQ/Cron eingebaut (ADR-002). |
| Storage | **Buy (S3-kompatibel: Cloudflare R2/MinIO)**, lokal im Dev | Kein Egress bei R2. |
| Publishing | **Buy (YouTube Data API v3)** | Offiziell, kein Browser-Hacking. |
| Analytics | **Buy (YouTube Analytics API)** | Offiziell; Impressions/CTR bleibt manuell. |
| Dashboard | **Make (minimal, später)** | Vertical Slice zuerst; CLI + API decken V1-Review ab. |
