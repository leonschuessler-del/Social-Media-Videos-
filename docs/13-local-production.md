# 13 – Lokale Produktion ohne externe KI-Anbieter

Stand 2026-09-24. Auf Wunsch des Betreibers entsteht das erste Video **ohne weitere KI-Dienste oder APIs**: Recherche, Skript und Storyboard erarbeitet Claude (in dieser Arbeitsumgebung), alles Mediale wird lokal erzeugt.

| Baustein | Umsetzung | Lizenz / Rechte | Label |
|---|---|---|---|
| Recherche, Faktencheck, Skript, Storyboard | Multi-Agenten-Workflow (5 Recherche-Agenten + je 1 unabhängiger Prüfer, 2 konkurrierende Skriptentwürfe, 2 Juroren, Synthese, 2 adversariale Faktenchecks, Überarbeitung, Storyboard) | eigene Texte, Quellen in der Beschreibung | SEMI_AUTOMATED (Freigabe durch Mensch) |
| Visuals | `packages/motion`: 2D-Motion-Graphics im Röntgen-/Blueprint-Stil, deterministisch in Chromium gerendert; ~20 Szenen-Vorlagen, jede von einem Agenten gebaut und von einem zweiten adversarial geprüft | eigener Code | AUTOMATED |
| Stimme | Coqui TTS, Stimme „Thorsten“ (VITS, 22 kHz), vollständig lokal | Datensatz CC0 (kommerziell frei) | AUTOMATED |
| Aussprache-QA | Lautschrift-Prüfung (gruut), `lexicon.json` für Korrekturen – kein Anhören möglich, daher Stichprobe durch Menschen empfohlen | – | SEMI_AUTOMATED |
| Musik | prozedural erzeugt (`audio_synth.py`), Stimmung je Kapitel, EQ mit Aussparung für die Stimme | eigene Erzeugung, kein Content-ID-Risiko | AUTOMATED |
| Soundeffekte | prozedural erzeugt (Whoosh, Impact, Seilriss, Metallknarzen, Ratsche, Funken, Hydraulik, Klick, Rumpeln, Riser) | eigene Erzeugung | AUTOMATED |
| Schnitt, Mischung | `build_video.ts`: Timeline aus Sprach-Timing, Sidechain-Ducking, −14 LUFS, Untertitel (ASS eingebrannt + SRT für YouTube) | – | AUTOMATED |
| Thumbnail | Vorlage `thumbnail` (3 Varianten), nur belegbare Aussagen | eigener Code | AUTOMATED |

## Qualitätsniveau (ehrlich)

- **Optik:** hochwertige, konsistente Motion Graphics – kein fotorealistisches Filmmaterial. Passt zum Kanalkonzept „Unsichtbares sichtbar machen“ (Querschnitte, Röntgenblick, Zeitlupe).
- **Stimme:** gut verständlich, natürliches Tempo; hörbar synthetischer als ein Profi-Sprecher oder Premium-TTS. Einzelne Wörter können falsch betont sein (Fremdwörter, Eigennamen).
- **Musik:** ruhiges, atmosphärisches Klangbett; kein komponierter Soundtrack.

## Zeitbedarf (gemessen in der Cloud-Sandbox, 4 vCPU, Video 001, 10:23 min)

Gemessen unter Volllast (parallel liefen bis zu 12 Agenten mit Vorschau-Renderings):

| Schritt | gemessen | ohne Parallellast (Schätzung) |
|---|---|---|
| Stimme (Coqui Thorsten VITS, 140 Sätze, 1.643 Wörter) | 33 min (2.003 s) für 10:23 min Audio | ≈ 8–12 min |
| Musik (prozedural) + SFX + Mischung (−14,1 LUFS integriert) | 3:53 min | ≈ 2 min |
| Rendering Motion Graphics | 4.884 Frames in 260 s ≈ 19 fps (Vorschau-Abschnitt) → ganzes Video ≈ 17–25 min | ≈ 10–15 min |
| Mux, Untertitel einbrennen | ≈ 3–5 min | ≈ 3 min |

Der große Zeitblock des ersten Videos ist **einmalig**: Bau von 22 Szenen-Vorlagen (je 40–90 min Agentenzeit) und die Szenen-Abnahme (jede der 90 Szenen wird auf die Wortzeiten der Sprachaufnahme getaktet, als Standbild-Bogen geprüft, von einem unabhängigen Prüfer abgenommen, Fehlschläge in einer Fix-Runde nachgebessert).

### Szenen-Timing (seit Video 001)

- `build_video.ts --stage timeline` legt Szenenwechsel auf Satzgrenzen (Fallback Wortgrenzen) statt starr nach Gewicht.
- Es schreibt `out/scene_narration.json`: pro Szene exakt gesprochener Text + Wortzeiten relativ zum Szenenstart.
- Alle Vorlagen unterstützen `params.beats` (Sekunden je Hauptschritt) und `at` pro Listeneintrag – Zahlen/Ergebnisse erscheinen erst, wenn sie gesprochen werden.
- `make_scene_batches.py` erzeugt daraus die Batches für die Szenen-Abnahme; `journal_to_batches.py` + `merge_scene_qa.py` übernehmen die Ergebnisse in `storyboard_final.json`.

Auf einem MacBook Air (Apple Silicon, 2026) ist mit ähnlichen oder kürzeren Zeiten zu rechnen (höhere Einzelkernleistung); erster echter Messwert folgt.

## Einordnung in das automatisierte System

Für den späteren Dauerbetrieb braucht die Text-/Recherche-Stufe weiterhin ein Sprachmodell. Optionen: OpenAI-API (wie geplant) oder Claude. Die Medienproduktion (Bilder als Motion Graphics, Stimme, Musik, Schnitt) läuft vollständig lokal und kostenlos. Neue Themenfelder (z. B. Motor, Vulkan) brauchen einmalig neue Szenen-Vorlagen.
