# 11 – Status, bekannte Probleme, offene Entscheidungen

_Stand: 2026-09-24 (wird bei jedem Meilenstein aktualisiert)_

## Aktuelle Phase

**Phase 0 abgeschlossen, Phase 1 (Vertical Slice) implementiert.** Review-Modus SAFE, PROVIDER_MODE mock, `maxVideosPerDay=3` (Seed) – für Live-Start auf 1 setzen.

## Was funktioniert (verifiziert)

- Unit-Tests core: State Machine, Scoring, Budget, Capacity, Usage, Ähnlichkeit (21 Tests grün).
- Postgres-Schema + Migration angewendet (16 Tabellen).
- FFmpeg-Render: Szenenclips (Ken Burns), xfade, Overlays, ASS-Wort-Captions, Musik-Ducking, loudnorm → MP4 1080×1920 (E2E-Lauf 3 erzeugte ein 53-s-Short).
- E2E-Test: Ergebnis siehe Abschnitt „Bekannte Probleme“ (wird bei grün hier aktualisiert).

## Bekannte Probleme

- (wird nach E2E-Fix aktualisiert)
- Mock-Visual-QA bewertet Platzhalterbilder pauschal mit 0,7 – im Mock ist Visual-QA `SEMI_AUTOMATED`.
- `gpt-6-astra`-Preise in Quellen uneinheitlich (5–10 $ / 25–50 $ pro 1M) → konservativ 10/50 in Preistabelle, `unknown=true`.
- Storyboard-Narrationsverteilung: bei inkonsistenter LLM-Ausgabe wird das Skript deterministisch gleichmäßig auf Szenen verteilt (Bild-Text-Sync dann gröber).

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

1. E2E vollständig grün (QA-Frame-Extraktion), Longform-Mock-Lauf.
2. Commit/Push, dann Live-Slice sobald B1 vorliegt.
3. Integrationstest Worker-Kette; Minimal-Dashboard.
