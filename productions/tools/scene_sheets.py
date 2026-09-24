#!/usr/bin/env python3
"""QA-Bögen: pro Szene 2 Standbilder (bei 45 % und 92 % der Szenendauer) aus dem gerenderten Video,
   beschriftet mit Szenen-ID/Vorlage, 5x4 Kacheln pro Bogen.  python scene_sheets.py <prodDir> <video> <outDir>"""
import json, sys, subprocess
from pathlib import Path
prod, video, outd = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3]); outd.mkdir(parents=True, exist_ok=True)
tl = json.loads((prod / "out/timeline.json").read_text(encoding="utf-8"))
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
tiles = []
for sc in tl["scenes"]:
    d = sc["end"] - sc["start"]
    for frac in (0.45, 0.92):
        t = sc["start"] + d * frac; f = outd / f"{sc['id']}_{int(frac*100)}.jpg"
        label = f"{sc['id']} {sc['template']} {frac:.0%}".replace("%", "\\%").replace(":", "\\:")
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{t:.3f}", "-i", video, "-frames:v", "1",
                        "-vf", f"scale=480:-1,drawtext=fontfile={FONT}:text='{label}':x=6:y=6:fontsize=16:fontcolor=yellow:box=1:boxcolor=black@0.7",
                        str(f)], check=True)
        tiles.append(f)
per = 20
for i in range(0, len(tiles), per):
    chunk = tiles[i:i + per]; lst = outd / f"list_{i // per}.txt"
    args = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
    for f in chunk: args += ["-i", str(f)]
    n = len(chunk); fc = "".join(f"[{k}]" for k in range(n)) + f"xstack=inputs={n}:layout=" + "|".join(f"{(k % 4) * 480}_{(k // 4) * 270}" for k in range(n)) + f":fill=black[o]"
    subprocess.run(args + ["-filter_complex", fc, "-map", "[o]", str(outd / f"sheet_{i // per + 1:02d}.jpg")], check=True)
print(f"{len(tiles)} Standbilder, {(len(tiles) + per - 1) // per} Bögen in {outd}")
