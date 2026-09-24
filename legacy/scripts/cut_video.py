#!/usr/bin/env python3
"""CLI-Tool zum Schneiden von Videos für Social-Media-Formate.

Beispiele:
    # Einen Ausschnitt von 00:10 bis 00:25 herausschneiden
    python scripts/cut_video.py raw_videos/input.mp4 --start 10 --end 25 --out exports/clip1.mp4

    # Video in 30-Sekunden-Häppchen aufteilen
    python scripts/cut_video.py raw_videos/input.mp4 --split 30

    # Ausschnitt zusätzlich auf 9:16 (Reels/TikTok/Shorts) zuschneiden
    python scripts/cut_video.py raw_videos/input.mp4 --start 0 --end 15 --vertical
"""
import argparse
import os

from moviepy.editor import VideoFileClip


def crop_to_vertical(clip):
    target_ratio = 9 / 16
    w, h = clip.size
    new_w = int(h * target_ratio)
    if new_w >= w:
        return clip
    x_center = w / 2
    return clip.crop(x1=x_center - new_w / 2, x2=x_center + new_w / 2)


def cut_clip(input_path, start, end, out_path, vertical=False):
    with VideoFileClip(input_path) as clip:
        sub = clip.subclip(start, end)
        if vertical:
            sub = crop_to_vertical(sub)
        os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
        sub.write_videofile(out_path, codec="libx264", audio_codec="aac")


def split_clip(input_path, segment_length, out_dir, vertical=False):
    os.makedirs(out_dir, exist_ok=True)
    base_name = os.path.splitext(os.path.basename(input_path))[0]
    with VideoFileClip(input_path) as clip:
        duration = clip.duration
        start = 0
        index = 1
        while start < duration:
            end = min(start + segment_length, duration)
            sub = clip.subclip(start, end)
            if vertical:
                sub = crop_to_vertical(sub)
            out_path = os.path.join(out_dir, f"{base_name}_part{index:02d}.mp4")
            sub.write_videofile(out_path, codec="libx264", audio_codec="aac")
            start = end
            index += 1


def main():
    parser = argparse.ArgumentParser(description="Videos für Social Media schneiden")
    parser.add_argument("input", help="Pfad zum Quellvideo")
    parser.add_argument("--start", type=float, help="Startzeit in Sekunden")
    parser.add_argument("--end", type=float, help="Endzeit in Sekunden")
    parser.add_argument("--out", default="exports/clip.mp4", help="Zielpfad für den Ausschnitt")
    parser.add_argument("--split", type=float, help="Video in Segmente dieser Länge (Sekunden) aufteilen")
    parser.add_argument("--out-dir", default="exports", help="Zielordner beim Aufteilen (--split)")
    parser.add_argument("--vertical", action="store_true", help="Auf 9:16 zuschneiden (Reels/TikTok/Shorts)")
    args = parser.parse_args()

    if args.split:
        split_clip(args.input, args.split, args.out_dir, vertical=args.vertical)
    else:
        if args.start is None or args.end is None:
            parser.error("--start und --end werden benötigt, wenn --split nicht gesetzt ist")
        cut_clip(args.input, args.start, args.end, args.out, vertical=args.vertical)


if __name__ == "__main__":
    main()
