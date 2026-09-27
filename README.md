# Social Media Videos

Eigenständiges Projekt zum Schneiden von Videos für Social Media (Reels, TikTok, Shorts etc.).
Dieses Repository ist komplett getrennt von anderen Projekten (z. B. der Vertriebsplattform) –
eigener Ordner, eigene Git-Historie, eigenes GitHub-Repo.

## Struktur

```
raw_videos/   Ausgangsmaterial (Rohvideos, nicht versioniert)
exports/      Fertig geschnittene Clips (nicht versioniert)
scripts/      Tools zum Schneiden/Bearbeiten
```

Videodateien selbst werden nicht ins Git-Repo eingecheckt (siehe `.gitignore`) – nur der Code
und die Ordnerstruktur.

## Setup

1. Python-Abhängigkeiten installieren:
   ```bash
   pip install -r requirements.txt
   ```
2. `ffmpeg` installieren (wird von moviepy zum Encodieren benötigt):
   - macOS: `brew install ffmpeg`
   - Ubuntu/Debian: `sudo apt install ffmpeg`
   - Windows: [ffmpeg.org/download](https://ffmpeg.org/download.html)

## Benutzung

Rohvideo nach `raw_videos/` legen, dann z. B.:

```bash
# Ausschnitt von Sekunde 10 bis 25 herausschneiden
python scripts/cut_video.py raw_videos/input.mp4 --start 10 --end 25 --out exports/clip1.mp4

# Video automatisch in 30-Sekunden-Häppchen aufteilen (z. B. für mehrere Reels)
python scripts/cut_video.py raw_videos/input.mp4 --split 30

# Ausschnitt zusätzlich auf 9:16 zuschneiden (Reels/TikTok/Shorts-Format)
python scripts/cut_video.py raw_videos/input.mp4 --start 0 --end 15 --vertical
```

Fertige Clips landen in `exports/`.

## Produktvideo aus einem Produktbild (TikTok, 20 s)

`scripts/product_video.py` rendert ein 9:16-Produktvideo (1080x1920, 30 fps, 20 s) aus einem
freigestellten Produktbild (PNG mit Transparenz), animierten Text-Overlays und dem Song aus
`assets/audio/`. Die Szenen (Hook, Leder-Detail, Passform, 4 Farben, Bewertungen/Preis, Call-to-Action)
sind im Skript unter `SCENES` definiert und lassen sich dort anpassen.

```bash
pip install -r requirements.txt
python scripts/product_video.py \
    --product assets/images/skiin_more_cognac.png \
    --audio assets/audio/song_tiktok.m4a \
    --out exports/skiin_more_tiktok.mp4

# nur Standbilder pro Szene zur Kontrolle rendern
python scripts/product_video.py --preview --out exports/check.mp4
```

Ein systemweites `ffmpeg` wird nicht benötigt, das Skript nutzt das Binary aus `imageio-ffmpeg`.
