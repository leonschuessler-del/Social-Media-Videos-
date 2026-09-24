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
