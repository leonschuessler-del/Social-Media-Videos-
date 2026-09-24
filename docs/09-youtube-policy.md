# 09 – YouTube-Policy & Compliance (von der Pipeline erzwungen)

Grundlage (verifiziert 2026-09-24): YPP-Richtlinien inkl. „inauthentic content“ (15.07.2025, erweitert Juli 2026), „Disclosing use of GenAI content“, YouTube API Services Terms & Compliance-Audit, Data-API-Discovery-Dokument (Revision 20260902). Quellen am Ende. Die Regeln unten sind das, was der Code prüft oder erzwingt.

## Policy-Stand 2026 (was sich geändert hat)

- **Inauthentic content** (seit 15.07.2025, vormals „repetitious“): „mass-produced or repetitive content … made with a template with little to no variation across videos, or … easily replicable at scale“ → nicht monetarisierbar. **Juli 2026 erweitert** um verstörende Inhalte und **KI-Personas, die Gesundheits-, Rechts-, Finanz- oder Politik-Ratschläge geben**.
- **KI-Labels** (27.05.2026): YouTube labelt signifikante fotorealistische KI automatisch, auch ohne Selbstangabe; bei C2PA „fully generative“ dauerhaft. Das Label allein beeinflusst laut YouTube weder Empfehlungen noch Monetarisierung.
- **Disclosure-Pflicht** gilt für *realistische* Inhalte, die für echte Personen/Orte/Ereignisse gehalten werden könnten. Nicht nötig für klar animierte/unrealistische Inhalte oder Produktionshilfe (Skript, Gliederung, Thumbnail, Titel, Infografik).
- **YPP-Schwellen:** aktuell 1.000 Abos + 4.000 Stunden (12 Mon.) oder 10 Mio. Shorts-Views (90 Tage); **ab 01.02.2027 für Neubewerbungen 1.000 Abos + 8.000 Stunden oder 20 Mio. Shorts-Views**; Shorts-Umsatzbeteiligung künftig an 10 Mio. Shorts-Views/90 Tage gekoppelt. → Longform-Watchtime ist für die Monetarisierung wichtiger als Shorts-Masse.
- **Likeness Detection** wird für alle Creator ab 18 ausgerollt (Gesicht; Stimme geplant) – wir verwenden keine realen Personen.

## Harte Regeln (Code)

| Regel | Wo | Label |
|---|---|---|
| Kein Video ohne echte Recherche mit Quellen; nur verifizierte Claims im Skript | RESEARCH/FACT_CHECK/SCRIPT, QA FACT | AUTOMATED |
| Originalität: Titel-, Hook-, Skript- und Szenenstruktur-Ähnlichkeit gegen alle Projekt-Videos; Duplikat-Themen blockiert | createTopic, SCRIPT, QA DUPLICATION | AUTOMATED |
| Keine Template-Farm: Wiederholte Prompts/Stilfolgen werden gemeldet; Pattern-Interrupts im Storyboard-Prompt | QA REPETITION, STORYBOARD | AUTOMATED |
| Kennzeichnung synthetischer/realistischer Inhalte: `status.containsSyntheticMedia` = `styleGuide.syntheticMedia` (Default **true**, da fotorealistische Renders) + Disclosure-Text in Beschreibung | PUBLISH, METADATA | AUTOMATED |
| Keine KI-Persona mit Gesundheits-/Rechts-/Finanz-/Politik-Ratschlägen; Körper-Themen nur erklärend, nie als Empfehlung; hohes Faktenrisiko → REVIEW | Topic-Score `factualRisk`, Prompt-Regeln, QA POLICY | AUTOMATED + MANUAL (Review) |
| `selfDeclaredMadeForKids` explizit `false` senden | PUBLISH | AUTOMATED |
| `selfDeclaredMadeForKids = false` (kein Kinderinhalt) | PUBLISH | AUTOMATED |
| Rechte: jedes Asset hat `rights.source` ∈ {generated, licensed_library, own, public_domain}; Musik nur mit `license.json` | ASSETS, EDIT, QA RIGHTS (critical → REJECT) | AUTOMATED |
| Policy-Check: Moderation (omni-moderation) + LLM-Prüfung auf Irreführung, gefährliche Anleitungen, medizinische Ratschläge | QA POLICY (critical → REJECT) | AUTOMATED |
| Keine echten Personen/Likeness/Marken/Logos in Bildprompts | STORYBOARD-Prompt-Regeln + Vision-QA | SEMI_AUTOMATED |
| Menschliche Freigabe vor Veröffentlichung (SAFE MODE) | routeAfterQa | MANUAL (gewollt) |
| Uploads nur über offizielle Data API; kein Browser-Hacking, keine Account-Rotation | YouTubePublishProvider | AUTOMATED |
| Scale-Gate: begrenzte Videos/Tag, Skalierung erst nach KPI-Nachweis | createVideoForTopic | AUTOMATED |

## API-Compliance (MANUAL, Vorlauf!)

- Google-Cloud-Projekt mit YouTube Data API v3 + YouTube Analytics API, OAuth-Consent-Screen.
- **Drei Quota-Töpfe (Stand 2026):** 100 `videos.insert`/Tag (je 1 Einheit), 100 `search.list`/Tag, 10.000 Einheiten/Tag für alles andere (z. B. `thumbnails.set` 50, `videos.update` 50, `playlistItems.insert` 50, `captions.insert` 400, `videos.list` 1). Früher kostete ein Upload 1.600 Einheiten – ältere Anleitungen sind veraltet. Der CapacityManager führt `youtube:videos.insert` mit 100/Tag; Quota-Fehler → WAITING_FOR_CAPACITY.
- **„All videos uploaded via the videos.insert endpoint from unverified API projects created after 28 July 2020 will be restricted to private viewing mode. To lift this restriction, each project must undergo an audit.“** Audit-Formular: https://support.google.com/youtube/contact/yt_api_form. Bis dahin: alle Uploads privat, manuelle Freischaltung in Studio (MANUAL).
- Scheduling: `privacyStatus=private` + `publishAt`. Shorts: quadratisch/hochkant und ≤ 180 s; Longform 16:9.
- Analytics: `yt-analytics.readonly`; Umsatzmetriken nur mit `yt-analytics-monetary.readonly` **und** YPP-Kanal. Impressions/CTR über Reporting-API-Reach-Reports (`channel_reach_basic_a1`, seit Jan. 2026, tägliche CSV, erster Report bis ~48 h nach Job-Anlage) – im Code `fetchReach()`. Shorts-KPI: `engagedViews` (Shorts-`views` zählen seit 31.03.2025 jeden Start/Replay). „Viewed vs. swiped away“ nur in Studio (MANUAL).
- Monetary-Scope (`yt-analytics-monetary.readonly`) nur mit monetarisiertem Kanal sinnvoll.

## Scale-Gate-Kriterien (Phase 1 → 2)

Skalierung (SEMI_AUTO, > 3 Videos/Tag) erst wenn über ≥ 20 veröffentlichte Videos:
- QA-Score-Median ≥ 0,75, keine Policy-Strikes, keine „Reused/Inauthentic“-Hinweise in Studio,
- Kosten/Video innerhalb Budget, Pipeline-Fehlerquote (DEAD_LETTER) < 5 %,
- APV (Longform) ≥ 35 % oder Shorts „viewed vs swiped“ ≥ 65 %,
- Retention-Kurven und CTR (Reach-Report) zeigen keine Verschlechterung über Zeit.

## Was das System NICHT tut

- Keine Deepfakes, keine Stimmen realer Personen, keine Nachrichten-/Politik-Themen mit hohem Faktenrisiko (Topic-Score-Filter `factualRisk`).
- Keine automatische Wiederverwertung fremder Videos.
- Keine Umgehung von Limits (weder OpenAI noch YouTube).

## Quellen

developers.google.com/youtube/v3/determine_quota_cost · …/v3/guides/quota_and_compliance_audits · …/v3/revision_history · …/v3/docs/videos/insert · …/v3/docs/videos · googleapis youtube.v3.json (Discovery, Rev. 20260902) · support.google.com/youtube/contact/yt_api_form · support.google.com/youtube/answer/14328491 (GenAI-Disclosure) · …/answer/15424877 (Shorts ≤ 3 min) · developers.google.com/youtube/analytics/metrics · …/analytics/revision_history · developers.google.com/youtube/reporting/revision_history · …/reporting/v1/reports/channel_reports · support.google.com/youtube/answer/72851 (YPP) · blog.youtube/news-and-events/youtube-partner-program-updates-2027-new-opportunities-earn · support.google.com/youtube/answer/1311392 (Monetarisierungsrichtlinien) · techcrunch.com/2026/07/20/youtube-clarifies-policies-around-ai-slop-and-upsetting-videos · blog.youtube/news-and-events/improving-ai-labels-viewers-creators · support.google.com/youtube/answer/16440338 (Likeness Detection). Hinweis: Die Google-Hosts waren aus der Sandbox nicht direkt abrufbar; Aussagen stützen sich auf offizielle Such-Snippets und das heruntergeladene Discovery-Dokument.
