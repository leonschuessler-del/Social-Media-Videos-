# Produktions-Werkzeuge (lokal, ohne externe KI-Anbieter)

| Werkzeug | Zweck |
|---|---|
| `tts_build.py` | Sprachsynthese mit Coqui TTS, Stimme „Thorsten“ (VITS, Datensatz CC0), vollständig lokal; Satz-/Wort-Timings |
| `pronounce_check.py` | Aussprache-QA ohne Anhören: geratene Lautschrift (gruut) und verdächtige Wörter → `lexicon.json` |
| `audio_synth.py` | Selbst erzeugte Filmmusik (Stimmungen je Kapitel) und Soundeffekte – rechtefrei, kein Content-ID-Risiko |
| `build_video.ts` | Timeline aus Stimm-Timing + Storyboard, Musikplan, SFX-Cues, Untertitel (ASS/SRT), Mischung (Ducking, −14 LUFS), Rendering, Mux, Metadaten, QA |

## Einrichtung (einmalig)

```bash
python3 -m venv .venv-tts && .venv-tts/bin/pip install coqui-tts "transformers>=4.57,<5" "gruut[de]" torch torchaudio
# Modell (GitHub-Release von Coqui):
curl -L -o thorsten_vits.zip https://github.com/coqui-ai/TTS/releases/download/v0.7.0_models/tts_models--de--thorsten--vits.zip && unzip thorsten_vits.zip
```

## Ablauf pro Video

```bash
PY=.venv-tts/bin/python
$PY productions/tools/pronounce_check.py productions/<id>/script.json          # Aussprache prüfen, lexicon.json pflegen
$PY productions/tools/tts_build.py productions/<id>/script.json productions/<id>/out/voice --model <modelDir> --lexicon productions/<id>/lexicon.json
PY=$PY npx tsx productions/tools/build_video.ts productions/<id>               # alles Weitere
```
