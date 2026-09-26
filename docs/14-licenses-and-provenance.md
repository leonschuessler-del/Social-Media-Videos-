# 14 – Lizenzen, Herkunft, Reproduzierbarkeit der lokalen Produktion

_Stand: 2026-09-26. Ergänzt/korrigiert Doku 13 um belastbare Versions- und Lizenzangaben._

Diese Datei trennt bewusst **drei verschiedene Lizenzebenen**, die bei einem trainierten
KI-Modell leicht durcheinandergehen: die Software (Programmcode), das trainierte Modell
(Gewichte) und der Trainingsdatensatz. Alle drei sind hier separat dokumentiert.

## 1. Sprachsynthese (TTS)

| Ebene | Lizenz | Quelle |
|---|---|---|
| Software `coqui-tts` | MPL-2.0 | PyPI-Paket `coqui-tts==0.27.5` (aktiver Fork des ursprünglichen, 2024 eingestellten Coqui-TTS) |
| Modell „Thorsten VITS“ (Gewichte) | Apache-2.0 | `https://github.com/coqui-ai/TTS/releases/download/v0.7.0_models/tts_models--de--thorsten--vits.zip`, Autor-Tag `@thorstenMueller` im offiziellen Coqui-Modellverzeichnis |
| Trainingsdatensatz „Thorsten-Voice“ | CC0 (gemeinfrei) | von Thorsten Müller unter CC0 veröffentlichter deutscher Sprachdatensatz, auf dem das Modell trainiert wurde |

**Korrektur gegenüber Doku 13:** Dort stand nur „Datensatz CC0“ in der Lizenzspalte.
Das ist richtig für den *Trainingsdatensatz*, aber unvollständig: Das *Modell selbst*
(die trainierten Gewichte, die hier tatsächlich ausgeführt werden) ist im offiziellen
Coqui-Modellverzeichnis separat als **Apache-2.0** lizenziert. Beide Lizenzen erlauben
kommerzielle Nutzung ohne Einschränkung; es besteht kein Widerspruch, nur eine fehlende
Unterscheidung in der ursprünglichen Notiz.

**Integritätsnachweis der aktuell verwendeten Modell-Dateien** (SHA-256, damit ein
späterer Download verifiziert werden kann):

```
ebb3792e89e261c92857ad1977f726bbaadfdf00d1b857dce4c44c393043de66  model_file.pth
f24e159768a8fc460764ccb163e37a08cd3c3d424bdb4f5a9e196636e58c0832  config.json
```

Diese Prüfsummen wurden am 2026-09-26 aus der laufenden Installation berechnet, nicht
vom Anbieter signiert – sie dienen nur dazu, eine künftige Neuinstallation gegen die
hier tatsächlich benutzte Version abzugleichen, nicht als Herstellernachweis.

**Aussprache-Hilfsdatensätze:** `gruut==2.4.0` (MIT-Lizenz) mit `gruut-lang-de==2.0.1`
für die deutsche Lautschrift-Prüfung (`pronounce_check.py`).

## 2. Musik und Geräusche

Vollständig prozedural erzeugt mit `productions/tools/audio_synth.py` (eigener Code,
additive Synthese + FFT-Faltungshall, kein Sample-Material, kein Trainingsdatensatz).
Es gibt keine Rechte Dritter zu dokumentieren. Rechtenachweis pro Datei in
`out/sfx/license.json` (Kopie: `productions/001-aufzugseil/provenance/sfx_license.json`).
Für die Musik existiert (Stand 2026-09-26) noch keine eigene `license.json` wie bei den
SFX – **offen**, siehe Doku 11.

## 3. Bilder/Animation

Ausschließlich eigener Canvas-Code (`packages/motion/`). Keine Fotos, keine
KI-Bildgenerierung, keine Stockbilder.

## 4. Schriften

| Schrift | Lizenz | Paket |
|---|---|---|
| Inter | OFL-1.1 | `@fontsource/inter` |
| Oxanium | OFL-1.1 | `@fontsource/oxanium` |
| JetBrains Mono | OFL-1.1 | `@fontsource/jetbrains-mono` |

## 5. Laufzeit-Werkzeuge (Software, keine Trainingsdaten)

| Werkzeug | Version (diese Sitzung) | Lizenz |
|---|---|---|
| FFmpeg | 6.1.1-3ubuntu5 | GPL/LGPL (je nach Build) |
| Chromium (headless, für `packages/motion`) | Build 1194 (`chromium_headless_shell-1194`) über `playwright-core@1.56.0` | BSD-3-Clause (Chromium) |
| Node.js | 22.22.2 | MIT |
| Python | 3.11.15 | PSF |

## 6. Ungeklärte/unbekannte Herkunft

- `assets/audio/song_tiktok.m4a` – liegt im Repository, Herkunft **unbekannt**, wird
  von Video 001 nicht verwendet. Vor jeder Nutzung Rechte klären oder entfernen.

## 7. Reproduzierbarkeit: gepinnte Abhängigkeiten

Die tatsächlich in dieser Sitzung installierten Python-Paketversionen (funktionierend
getestet, nicht nur behauptet) stehen in
`productions/tools/requirements-tts.lock.txt`. Für eine neue Einrichtung siehe
`productions/tools/README.md`.

**Nicht in dieser Sitzung erneut verifiziert:** Ein Frischinstall aus
`requirements-tts.lock.txt` in eine neue, leere virtuelle Umgebung wurde aus
Datenträger-Platzgründen nicht gegengetestet. Die Versionen sind exakt die laufend
benutzten (`pip freeze`), aber der Installationsweg selbst (Kompatibilität von Torch
2.8.0 mit einer zukünftigen Systemumgebung) ist nicht neu geprüft.
