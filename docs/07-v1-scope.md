# 07 – V1-Scope & Definition of Done

## V1 = funktionierende Content Engine (kein Dashboard-Projekt)

| DoD-Punkt (Master-Prompt) | Umsetzung V1 | Status heute | Label |
|---|---|---|---|
| 1. Projekt erstellen | `POST /projects/seed`, Seed „Project 01 – Visual Science“, CLI | ✅ | AUTOMATED |
| 2. Thema eingeben / automatisch wählen | `POST /projects/:id/topics`, `…/topics/discover` (LLM+Websuche), Topic-Score, Originalitäts-Check | ✅ (Discovery live erst mit OpenAI-Key) | AUTOMATED |
| 3. Research automatisch | Stage RESEARCH (Responses API + web_search, Zitate) | ✅ Mock / ⏳ live ohne Key | AUTOMATED |
| 4. Belegtes Skript | FACT_CHECK (Urteile je Claim) → SCRIPT nur mit verifizierten Claims | ✅ | AUTOMATED |
| 5. Storyboard | Stage STORYBOARD (Szenen, Prompts, Methoden, Kamera, Übergänge, Overlays) | ✅ | AUTOMATED |
| 6. Assets automatisiert | Stage ASSETS (Reuse → Infografik → OpenAI Images); KI-Video: BLOCKED_BY_PROVIDER | ✅ Bilder / ⛔ Video | AUTOMATED / BLOCKED |
| 7. Voiceover | Stage VOICE (OpenAI TTS + whisper-1 Alignment) | ✅ | AUTOMATED |
| 8. Video automatisch zusammengesetzt | Stage EDIT (FFmpeg: Ken Burns, xfade, Overlays, Captions, Musik-Ducking, loudnorm) | ✅ | AUTOMATED |
| 9. QA | Stage QA (8 Checks, Score, Entscheidung) | ✅ | AUTOMATED (Visual-QA im Mock: SEMI) |
| 10. Thumbnail + Titel | 3 Thumbnail-Varianten (sharp) + 5 Titelvarianten, Beschreibung, Chapters, Tags, Disclosure | ✅ | AUTOMATED |
| 11. Ergebnis überprüfen | CLI `status`/`review`, API `GET /videos/:id` (+Assets streamen); Dashboard minimal später | ✅ (CLI/API) | MANUAL (bewusst) |
| 12. Upload/Schedule über offizielle API | YouTube Data API v3 `videos.insert` (private + publishAt, containsSyntheticMedia, selfDeclaredMadeForKids=false) + Thumbnail; Upload-Quota-Topf 100/Tag im CapacityManager | ✅ Code / ⏳ OAuth-Client & Audit | AUTOMATED (Audit MANUAL) |
| 13. Analytics zurück ins System | YouTube Analytics API v2 (Views, Watchtime, AVD, APV, Subs, engagedViews, Revenue, Retention) + Reporting API (Impressions, CTR) alle 6 h | ✅ Code / ⏳ OAuth | AUTOMATED (Shorts-Swipe-Rate MANUAL) |
| 14. Kosten vollständig protokolliert | UsageManager → cost_entries, Budget-Guard, Usage-Summary API | ✅ | AUTOMATED |
| E2E-Testvideo | `packages/pipeline/src/e2e.test.ts` (Mock-Provider, echter FFmpeg-Render, 9:16 MP4, QA, Metadata, Freigabe, Mock-Upload) | ✅ | – |

## Explizit NICHT in V1

- Externe KI-Anbieter (Video/Bild/Voice/Musik) – DISABLED bis Freigabe.
- Dashboard-UI mit Charts, Nutzerverwaltung, Multi-User-Auth.
- TikTok/Instagram-Publishing (Interfaces vorhanden).
- Lernschleife, die Regeln automatisch ändert (nur Datensammlung + versionierte Regeln vorbereitet).
- Automatisches Repurposing Longform → Shorts (Datenmodell `parentVideoId` vorhanden).
