# Nutzungsprotokoll Video 001 (gemessen)

_Quelle: Claude-Code-Sitzungsprotokolle (`~/.claude/projects/.../*.jsonl`, inkl. aller
Subagenten-Transkripte). Diese Rohprotokolle liegen außerhalb des Repositories und sind
**nicht dauerhaft gespeichert** – diese Datei ist die extrahierte, dauerhafte Kopie der
relevanten Zahlen. Aufsummiert nach `message.usage`-Feldern, dedupliziert nach
Message-ID._

## Tokens, aufgeteilt nach Phase und Modell (gemessen)

Siehe `usage_tokens_by_model.json` für die Rohzahlen. Phase „system_build“ = Aufbau der
Plattform vor dem Video-Auftrag (2026-09-24, vor 15:18 UTC); „video_production“ = ab dem
Auftrag „vollständiges 10–12-Minuten-Video“, inklusive der Nacharbeiten in dieser
Sitzung (Backup/Reproduzierbarkeit).

| Phase | Modell | cache_read | cache_write | output | normale Eingabe |
|---|---|---:|---:|---:|---:|
| system_build | claude-fable-5-1 | 25.398.953 | 886.444 | 291.070 | 2.806 |
| system_build | claude-opus-5-5 | 16.685.725 | 704.139 | 51.500 | 182 |
| video_production | claude-opus-5-5 | 1.003.061.059 | 32.013.238 | 978.615 | 10.544 |
| video_production | claude-sonnet-5 | 10.387.877 | 508.753 | 26.703 | 44 |

**Summe video_production:** ≈ 1,013 Mrd. Tokens aus dem Zwischenspeicher gelesen,
≈ 32,5 Mio. neu hineingeschrieben, ≈ 1,01 Mio. erzeugt.

## Render-/Synthese-Laufzeiten (gemessen, aus Task-Logs)

| Schritt | Messwert |
|---|---|
| Sprachsynthese, 10:23 min Audio, 140 Sätze | 2.003 s (≈ 33 min), 158,7 Wörter/min (`out/voice/timings.json`) |
| Musik + Geräusche + Mischung | 3:53 min |
| Rendering Vorschau-Ausschnitt (2:43 min, veryfast) | 4.884 Frames in 260 s |
| Rendering Gesamtvideo (10:23 min, medium) | 18.680 Frames in 748 s (12:28 min) |
| Ton, Untertitel, Mux, Metadaten, QA (gesamt) | 12:48 min |
| Medienprüfung (`out/qa.json`) | −14,1 LUFS integriert, True Peak −1,2 dBTP, kein Clipping, keine Schwarzbilder, keine Tonlücken |

Alle Zeiten wurden unter **Volllast** gemessen (bis zu 12 parallele Agenten auf 4 vCPU
während der Szenen-Feinarbeit) – Laufzeiten im Alleinbetrieb (z. B. auf einem eigenen
Rechner) sind daher als Obergrenze zu verstehen, nicht als Bestwert.

## Geschätzt, nicht gemessen

- API-Äquivalenzkosten für Video 001: ≈ 380–470 $ (aus obigen Token-Zahlen mit den
  Anthropic-Listenpreisen für Claude Opus 5.5 gerechnet; das Schreiben in den
  Zwischenspeicher wurde dabei mit 5–8 $/Mio. angenommen, da der genaue Satz zum
  Zeitpunkt der Rechnung nicht öffentlich vorlag).
- Anteil am Chat-Abo-Kontingent: **unbekannt**, da kein programmatischer Zugriff auf
  den Kontoverbrauch besteht.
