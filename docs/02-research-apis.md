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

## B. YouTube (offiziell)

Siehe [09](09-youtube-policy.md). Kernpunkte: Data API v3 Quota 10.000/Tag, `videos.insert` 1.600, `thumbnails.set` 50, `videos.list` 1; `status.containsSyntheticMedia` (Kennzeichnung), `publishAt` (nur mit `private`), Uploads unauditierter Projekte privat; Analytics API v2 mit views, estimatedMinutesWatched, averageViewDuration, averageViewPercentage, subscribersGained, likes, shares, comments, estimatedRevenue/cpm (Monetary-Scope), audienceWatchRatio (Retention), insightTrafficSourceType, country; **Impressions/CTR nicht per API**.

## C. Alternativen (dokumentiert, DISABLED – nur nach Freigabe)

_Dieser Abschnitt wird mit den Ergebnissen der laufenden Marktrecherche (Video-, Bild-, Voice-, Musik-, LLM-/Search-, Rendering-Anbieter) ergänzt – siehe Unterabschnitte unten, sobald verfügbar._
