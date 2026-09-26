# Produktions-Werkzeuge (lokal, ohne externe KI-Anbieter)

| Werkzeug | Zweck |
|---|---|
| `produce.sh` / `produce_local.ts` | **Vollständige, wiederaufnehmbare Produktion** aus einem geprüften Produktionsordner: validiert Eingaben, ruft die untenstehenden Werkzeuge in der richtigen Reihenfolge auf, überspringt unveränderte Schritte, protokolliert Fehler verständlich. Siehe Abschnitt „Vollständige Produktion“. |
| `tts_build.py` | Sprachsynthese mit Coqui TTS, Stimme „Thorsten“ (VITS-Modell, Apache-2.0; Trainingsdatensatz CC0 – siehe `docs/14-licenses-and-provenance.md`), vollständig lokal; Satz-/Wort-Timings |
| `pronounce_check.py` | Aussprache-QA ohne Anhören: geratene Lautschrift (gruut) und verdächtige Wörter → `lexicon.json` |
| `audio_synth.py` | Selbst erzeugte Filmmusik (Stimmungen je Kapitel) und Soundeffekte – rechtefrei, kein Content-ID-Risiko |
| `build_video.ts` | Timeline aus Stimm-Timing + Storyboard, Musikplan, SFX-Cues, Untertitel (ASS/SRT), Mischung (Ducking, −14 LUFS), Rendering, Mux, Metadaten, QA. Wird von `produce.sh` aufgerufen, ist aber auch einzeln nutzbar (`--stage`). |
| `make_scene_batches.py`, `journal_to_batches.py`, `merge_scene_qa.py`, `scene_sheets.py` | Werkzeuge für die manuelle Szenen-Abnahme (siehe `docs/13-local-production.md`) |

## Einrichtung (einmalig)

Gepinnte, tatsächlich getestete Versionen stehen in `requirements-tts.lock.txt`
(erzeugt aus einer laufenden Installation, nicht nur behauptet). Diese Datei
ist die Quelle der Wahrheit; die folgenden Befehle sind der Installationsweg dazu.

```bash
# 1) venv anlegen (Konvention: productions/.venv-tts, siehe .gitignore)
python3 -m venv productions/.venv-tts
productions/.venv-tts/bin/pip install -r productions/tools/requirements-tts.lock.txt

# 2) Sprachmodell laden (offizielles Coqui-Release, Apache-2.0, siehe docs/14-licenses-and-provenance.md)
mkdir -p productions/.models && cd productions/.models
curl -L -o thorsten_vits.zip https://github.com/coqui-ai/TTS/releases/download/v0.7.0_models/tts_models--de--thorsten--vits.zip
unzip thorsten_vits.zip && cd -

# 3) Prüfsummen gegen die in docs/14-licenses-and-provenance.md dokumentierten Werte abgleichen
sha256sum productions/.models/tts_models--de--thorsten--vits/model_file.pth
sha256sum productions/.models/tts_models--de--thorsten--vits/config.json
```

**Nicht in dieser Sitzung erneut gegengetestet:** ob dieser Installationsweg in einer
komplett frischen, leeren venv fehlerfrei durchläuft (siehe Doku 14, Abschnitt 7) –
die Versionen selbst sind aber exakt die laufend benutzten.

Zusätzlich erforderlich (Systempakete, nicht über pip): FFmpeg, Node.js 22, ein
installiertes Chromium für `packages/motion` (`pnpm --filter @content-os/motion exec
playwright install chromium` bzw. wird über `playwright-core` aufgelöst).

## Vollständige Produktion (empfohlen)

```bash
PY=productions/.venv-tts/bin/python \
TTS_MODEL=productions/.models/tts_models--de--thorsten--vits \
  productions/tools/produce.sh productions/<id>
```

Führt validate → voice → timeline → audio → render → mux (inkl. Metadaten) → qa aus.
Details, alle Optionen (`--force`, `--from-step`, `--to-step`, `--length-scale`, `--preset`,
`--chunks`, `--min-duration`/`--max-duration`, `--dry-run`) stehen im Kopfkommentar von
`produce.sh`. Kurzer Funktionstest ohne echten Longform-Render:
`productions/000-smoketest/` (siehe dortige README).

### Wiederaufnahme, Zustand, Fehlerverhalten

- Jeder Schritt speichert einen Zustand (Hash der Eingabedateien + Parameter) in
  `out/.state/<schritt>.json`. Ein erneuter Aufruf überspringt Schritte, deren Eingaben
  sich nicht geändert haben und deren Ausgabedateien noch vorhanden sind.
- Ändert sich eine Eingabedatei (z. B. `script.json` oder `lexicon.json`), werden dieser
  Schritt und automatisch alle davon abhängigen Folgeschritte neu ausgeführt – ohne
  manuell eine Abhängigkeitskette pflegen zu müssen, weil jeder Schritt die tatsächlichen
  Ausgabedateien des vorherigen Schritts hasht.
- Ein fehlgeschlagener Schritt bricht die Produktion sofort ab (kein automatischer
  Neuversuch, kein Rückgriff auf einen kostenpflichtigen Dienst). Fehler stehen lesbar
  in `out/produce.log` und auf der Konsole, inklusive der letzten Zeilen der
  Fehlerausgabe des jeweiligen Werkzeugs.
- **Unterbrechen und fortsetzen:** Strg+C, `kill <pid>` (ohne `-9`) oder `docker stop`
  beenden auch laufende Unterprozesse (ffmpeg, Chromium) sauber, bevor sich das Skript
  beendet. Ein anschließender erneuter Aufruf setzt korrekt beim unterbrochenen Schritt
  fort. Ein gezieltes `kill -9` **nur** gegen die `produce.sh`/`produce_local.ts`-PID
  lässt sich grundsätzlich nicht abfangen (SIGKILL) und kann einzelne ffmpeg-/
  Chromium-Prozesse verwaist zurücklassen; in dem Fall vor dem nächsten Aufruf manuell
  aufräumen: `pkill -9 -f headless_shell; pkill -9 -f 'render_work/chunk'`. Die
  Wiederaufnahme-Logik selbst ist davon nicht betroffen (der unterbrochene Schritt hat
  ohnehin keinen "ok"-Zustand gespeichert und wird beim nächsten Aufruf neu ausgeführt).

## Ablauf pro Video (einzelne Schritte, zum manuellen Nachvollziehen/Debuggen)

```bash
PY=productions/.venv-tts/bin/python
$PY productions/tools/pronounce_check.py productions/<id>/script.json          # Aussprache prüfen, lexicon.json pflegen
$PY productions/tools/tts_build.py productions/<id>/script.json productions/<id>/out/voice --model <modelDir> --lexicon productions/<id>/lexicon.json
PY=$PY npx tsx productions/tools/build_video.ts productions/<id>               # alles Weitere (einzeln, ohne Zustand/Wiederaufnahme)
```

Dieser manuelle Weg ist nützlich zum Debuggen einzelner Schritte, hat aber keine
Wiederaufnahme-Logik und keine Eingabeprüfung – für die eigentliche Produktion
`produce.sh` verwenden.

## Bekannte Einschränkungen

- Die Metadaten-Stufe (`build_video.ts --stage mux`/`meta`) hat den Beschreibungs-Hook
  und die YouTube-Tags noch fest auf das Aufzugseil-Thema kodiert (`--hook` überschreibt
  nur den ersten Satz, Tags sind nicht überschreibbar). Für ein neues Thema muss das im
  Code angepasst oder die Stufe per `--tags`-Erweiterung ergänzt werden – **offen**.
- `produce.sh` erkennt eine verwaiste ffmpeg-/Chromium-Instanz aus einem `kill -9`
  vorheriger Läufe nicht automatisch (siehe oben) – kein Zustand wird darüber geführt,
  welche System-PIDs zu einem Lauf gehörten, über den aktuellen Prozessbaum hinaus.
