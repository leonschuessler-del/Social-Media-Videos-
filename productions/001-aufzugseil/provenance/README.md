# Provenance-Snapshot – Video 001 „Was passiert, wenn das Aufzugseil reißt?“

_Erzeugt: 2026-09-26, aus `out/` kopiert, damit diese kleinen Nachweisdateien dauerhaft
im Git-Verlauf liegen (`out/` selbst ist per `.gitignore` ausgeschlossen, weil dort die
großen Medien-Zwischenstände liegen)._

## Enthalten (alles < 200 KB, Text/JSON)

| Datei | Herkunft | Inhalt |
|---|---|---|
| `voice_timings.json` | `out/voice/timings.json` | Satz-/Wort-Zeitstempel der Sprachaufnahme, Dauer, WPM, Synthesezeit |
| `timeline.json` | `out/timeline.json` | Finale Szenen-Zeitleiste (90 Szenen, Kapitel) |
| `scene_narration.json` | `out/scene_narration.json` | Pro Szene: exakt gesprochener Text + Wortzeiten |
| `music_plan.json`, `sfx_cues.json` | `out/` | Musik-Stimmungsplan, SFX-Einsatzzeiten |
| `captions.srt`, `captions.ass` | `out/` | Untertitel (YouTube-Upload bzw. eingebrannt) |
| `metadata.json`, `description.txt` | `out/` | Titel, Kapitel, Tags, Beschreibungstext mit Quellen |
| `qa.json` | `out/qa.json` | Ergebnis der automatischen Medienprüfung (LUFS, Clipping, Schwarzbilder, Tonlücken) |
| `sfx_license.json` | `out/sfx/license.json` | Rechtenachweis der prozedural erzeugten Geräusche |

## Nicht enthalten (bewusst, siehe `docs/14-licenses-and-provenance.md`)

Video- und Audio-Binärdateien (`final.mp4`, `final_untertitelt.mp4`, `voice.wav`,
`music.wav`, `mix.wav`, SFX-`.wav`) werden **nicht** ins Git-Repository aufgenommen
(Projektvorgabe: keine großen Videos/Modellgewichte in Git). Sie sind:

1. teilweise bereits per Chat-Dateiübertragung an den Betreiber ausgeliefert
   (komprimierte 1080p-Fassungen, siehe Auslieferungsprotokoll), und/oder
2. reproduzierbar aus den hier gesicherten Skript-/Storyboard-/Timing-Daten mit
   `productions/tools/produce.sh` (erfordert dieselbe oder eine neu eingerichtete
   TTS-Umgebung, siehe `productions/tools/README.md`).

Aus `script.json`, `storyboard_final.json`, `factbase.json` und `lexicon.json`
(bereits im Repo-Wurzelverzeichnis der Produktion) plus dieser `voice_timings.json`
lässt sich der Produktionsstand jederzeit nachvollziehen, auch ohne die Binärdateien.
