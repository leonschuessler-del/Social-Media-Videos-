# 09 – YouTube-Policy & Compliance (von der Pipeline erzwungen)

Grundlage: YouTube-Partnerprogramm-Richtlinien (u. a. „inauthentic content“, wirksam seit 15.07.2025), Richtlinie zu verändertem/synthetischem Inhalt, YouTube API Services Terms & Compliance-Audit. Details/Quellen in [02](02-research-apis.md). Die Regeln unten sind das, was der Code prüft oder erzwingt.

## Harte Regeln (Code)

| Regel | Wo | Label |
|---|---|---|
| Kein Video ohne echte Recherche mit Quellen; nur verifizierte Claims im Skript | RESEARCH/FACT_CHECK/SCRIPT, QA FACT | AUTOMATED |
| Originalität: Titel-, Hook-, Skript- und Szenenstruktur-Ähnlichkeit gegen alle Projekt-Videos; Duplikat-Themen blockiert | createTopic, SCRIPT, QA DUPLICATION | AUTOMATED |
| Keine Template-Farm: Wiederholte Prompts/Stilfolgen werden gemeldet; Pattern-Interrupts im Storyboard-Prompt | QA REPETITION, STORYBOARD | AUTOMATED |
| Kennzeichnung synthetischer/realistischer Inhalte: `status.containsSyntheticMedia = true` beim Upload + Disclosure-Text in Beschreibung | PUBLISH, METADATA | AUTOMATED |
| `selfDeclaredMadeForKids = false` (kein Kinderinhalt) | PUBLISH | AUTOMATED |
| Rechte: jedes Asset hat `rights.source` ∈ {generated, licensed_library, own, public_domain}; Musik nur mit `license.json` | ASSETS, EDIT, QA RIGHTS (critical → REJECT) | AUTOMATED |
| Policy-Check: Moderation (omni-moderation) + LLM-Prüfung auf Irreführung, gefährliche Anleitungen, medizinische Ratschläge | QA POLICY (critical → REJECT) | AUTOMATED |
| Keine echten Personen/Likeness/Marken/Logos in Bildprompts | STORYBOARD-Prompt-Regeln + Vision-QA | SEMI_AUTOMATED |
| Menschliche Freigabe vor Veröffentlichung (SAFE MODE) | routeAfterQa | MANUAL (gewollt) |
| Uploads nur über offizielle Data API; kein Browser-Hacking, keine Account-Rotation | YouTubePublishProvider | AUTOMATED |
| Scale-Gate: begrenzte Videos/Tag, Skalierung erst nach KPI-Nachweis | createVideoForTopic | AUTOMATED |

## API-Compliance (MANUAL, Vorlauf!)

- Google-Cloud-Projekt mit YouTube Data API v3 + YouTube Analytics API, OAuth-Consent-Screen.
- Standard-Quota 10.000 Einheiten/Tag (Upload = 1.600 → max. 6 Uploads/Tag ohne Erhöhung). Quota-Erhöhung beantragen, sobald Bedarf > 3/Tag.
- **Nicht auditierte API-Projekte: Uploads werden auf „privat“ gesperrt.** Compliance-Audit (YouTube API Services) rechtzeitig beantragen. Bis dahin: alle Uploads privat/unlisted, manuelle Freischaltung in Studio (MANUAL).
- Monetary-Scope (`yt-analytics-monetary.readonly`) nur mit monetarisiertem Kanal sinnvoll.

## Scale-Gate-Kriterien (Phase 1 → 2)

Skalierung (SEMI_AUTO, > 3 Videos/Tag) erst wenn über ≥ 20 veröffentlichte Videos:
- QA-Score-Median ≥ 0,75, keine Policy-Strikes, keine „Reused/Inauthentic“-Hinweise in Studio,
- Kosten/Video innerhalb Budget, Pipeline-Fehlerquote (DEAD_LETTER) < 5 %,
- APV (Longform) ≥ 35 % oder Shorts „viewed vs swiped“ ≥ 65 %,
- Retention-Kurven und CTR (manuell aus Studio) zeigen keine Verschlechterung über Zeit.

## Was das System NICHT tut

- Keine Deepfakes, keine Stimmen realer Personen, keine Nachrichten-/Politik-Themen mit hohem Faktenrisiko (Topic-Score-Filter `factualRisk`).
- Keine automatische Wiederverwertung fremder Videos.
- Keine Umgehung von Limits (weder OpenAI noch YouTube).
