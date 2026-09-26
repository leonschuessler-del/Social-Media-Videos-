#!/usr/bin/env bash
# Vollständige lokale Video-Produktion aus einem vorhandenen Produktionsordner:
# validiert Eingaben -> Sprachaufnahme -> Musik/Geräusche -> Rendern -> Mux+Untertitel+Metadaten -> QA.
# Nutzt ausschließlich die lokale Motion-Graphics-Pipeline (kein bild-/OpenAI-basierter Pfad,
# ruft niemals "pnpm cli produce" auf). Jeder Schritt ist wiederaufnehmbar: unveränderte Eingaben
# werden übersprungen, geänderte Eingaben lösen automatisch den betroffenen Schritt und alle
# nachfolgenden neu aus. Kein automatischer Neuversuch bei Fehlern, kein Rückgriff auf kostenpflichtige Dienste.
#
# Aufruf:
#   PY=<pfad-zur-venv>/bin/python TTS_MODEL=<pfad-zum-thorsten-modell> \
#     productions/tools/produce.sh productions/<id> [Optionen]
#
# Optionen (alle optional):
#   --force                 alle Schritte neu ausführen, auch wenn unverändert
#   --from-step STEP        erst ab diesem Schritt (validate|voice|timeline|audio|render|mux|qa)
#   --to-step STEP          nur bis zu diesem Schritt
#   --dry-run               nur anzeigen, was laufen würde
#   --length-scale 0.9      TTS-Sprechtempo (Standard 1.0, kleiner = schneller)
#   --preset medium         FFmpeg/Render-Preset (Standard medium)
#   --chunks 4              parallele Render-Chunks (Standard 3)
#   --crf 18                Render-Qualität (Standard 18)
#   --min-duration 540      QA: Mindestlänge in Sekunden (Standard 540 = 9 min)
#   --max-duration 780      QA: Höchstlänge in Sekunden (Standard 780 = 13 min)
#
# Voraussetzung im Produktionsordner: script.json, storyboard.json (oder storyboard_final.json).
# factbase.json und lexicon.json sind optional, werden aber genutzt wenn vorhanden.
# Einrichtung von PY/TTS_MODEL: siehe productions/tools/README.md.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"

if [ -z "${1:-}" ] || [[ "$1" == --* ]]; then
  echo "Aufruf: PY=<venv-python> TTS_MODEL=<modell-ordner> $0 <productionDir> [Optionen]" >&2
  echo "Beispiel: PY=productions/.venv-tts/bin/python TTS_MODEL=/pfad/zu/thorsten_vits $0 productions/001-aufzugseil" >&2
  exit 2
fi

: "${PY:?PY muss auf den Python-Interpreter der TTS-venv zeigen (siehe productions/tools/README.md, Abschnitt Einrichtung)}"
: "${TTS_MODEL:?TTS_MODEL muss auf den Ordner mit model_file.pth und config.json zeigen (siehe productions/tools/README.md)}"

if [ ! -x "$PY" ]; then
  echo "Fehler: PY ist nicht ausführbar: $PY" >&2
  exit 2
fi

cd "$REPO"
# Direkt den tsx-Binärlink ausführen (nicht "npx tsx"): npx spawnt einen Wrapper-Prozess mit eigener PID,
# der Signale (SIGINT/SIGTERM) nicht an das eigentliche Node-Skript weiterreicht - dann liefe die Wiederaufnahme-
# Logik im Skript zwar korrekt, ein Abbruch von außen würde aber trotzdem Kindprozesse (ffmpeg/Chromium)
# verwaisen lassen. Der tsx-Wrapper unter node_modules/.bin selbst nutzt "exec node ...", erhält die PID also.
TSX_BIN="$REPO/node_modules/.bin/tsx"
if [ ! -x "$TSX_BIN" ]; then
  echo "Fehler: $TSX_BIN nicht gefunden - einmal 'pnpm install' im Repo-Wurzelverzeichnis ausführen." >&2
  exit 2
fi
exec env PY="$PY" TTS_MODEL="$TTS_MODEL" "$TSX_BIN" productions/tools/produce_local.ts "$@"
