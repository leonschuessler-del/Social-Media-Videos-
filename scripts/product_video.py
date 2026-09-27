#!/usr/bin/env python3
"""Erzeugt ein 20-Sekunden-Produktvideo (9:16, TikTok/Reels) aus einem freigestellten
Produktbild, animierten Text-Overlays und einem Song aus assets/audio.

Beispiel:
    python scripts/product_video.py \
        --product assets/images/skiin_more_cognac.png \
        --audio assets/audio/song_tiktok.m4a \
        --out exports/skiin_more_tiktok.mp4

Das Video wird Frame für Frame mit Pillow gerendert und per Pipe an ffmpeg
(aus imageio-ffmpeg) übergeben, es wird also kein systemweites ffmpeg benötigt.
"""
import argparse
import math
import os
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1920
FPS = 30
DURATION = 20.0

CREAM = (246, 243, 238)
DARK = (24, 22, 20)
INK = (26, 24, 22)
COGNAC = (181, 113, 63)
STAR = (196, 160, 96)
WHITE = (255, 255, 255)

FONT_BOLD = "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf"
FONT_REG = "/usr/share/fonts/truetype/freefont/FreeSans.ttf"

# Farbvarianten (Name, Zielfarbe des Leders). Cognac ist das Originalbild.
COLORS = [
    ("Cognac", None),
    ("Anthrazit", (78, 78, 80)),
    ("Dunkelbraun", (92, 72, 56)),
    ("Oliv", (88, 86, 62)),
]


# ----------------------------------------------------------------------------
# Hilfsfunktionen
# ----------------------------------------------------------------------------
def clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def ease_out_cubic(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def ease_in_out(t):
    t = clamp(t)
    return 0.5 - 0.5 * math.cos(math.pi * t)


def ease_out_back(t, s=1.4):
    t = clamp(t)
    return 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2


def font(size, bold=True):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)


def trim_shadow(img):
    """Entfernt den hellen Produktschatten unterhalb der Hülle (Zeilen von unten)."""
    a = np.array(img).astype(int)
    rgb, alpha = a[..., :3], a[..., 3]
    last = img.height - 1
    for y in range(img.height - 1, 0, -1):
        m = alpha[y] > 128
        if m.sum() < 5:
            continue
        px = rgb[y][m]
        bright = px.mean()
        sat = (px.max(axis=1) - px.min(axis=1)).mean()
        if bright < 150 or sat > 35:
            last = y
            break
    img = img.crop((0, 0, img.width, last + 1))
    # helle, halbtransparente Schattenreste an den Rändern entfernen
    a = np.array(img).astype(int)
    haze = (a[..., 3] < 200) & (a[..., :3].mean(axis=2) > 200)
    a[haze, 3] = 0
    # Reste des weißen Untergrunds in den unteren Ecken (innerhalb der Maske) löschen
    bottom = a[-80:]
    px = bottom[..., :3]
    white = (px.mean(axis=2) > 215) & ((px.max(axis=2) - px.min(axis=2)) < 14)
    bottom[white, 3] = 0
    return Image.fromarray(a.astype(np.uint8))


def tint(img, target):
    """Färbt das Produkt anhand seiner Helligkeit in eine Zielfarbe um."""
    a = np.array(img).astype(float)
    rgb, alpha = a[..., :3], a[..., 3:4]
    lum = rgb @ np.array([0.299, 0.587, 0.114])
    mask = alpha[..., 0] > 128
    l0 = lum[mask].mean()
    t = np.array(target, dtype=float)
    out = np.clip(t * (lum[..., None] / l0), 0, 255)
    out = np.concatenate([out, alpha], axis=2).astype(np.uint8)
    return Image.fromarray(out)


def drop_shadow(size, blur=40, alpha=110):
    w, h = size
    sh = Image.new("L", (w + blur * 4, h + blur * 4), 0)
    d = ImageDraw.Draw(sh)
    d.rounded_rectangle((blur * 2, blur * 2, blur * 2 + w, blur * 2 + h), radius=int(w * 0.16), fill=alpha)
    return sh.filter(ImageFilter.GaussianBlur(blur))


def paste_product(canvas, product, cx, cy, scale, alpha=1.0, angle=0.0, shadow=True):
    """Produkt mit Mittelpunkt (cx, cy) und Skalierung auf die Leinwand zeichnen."""
    w = int(product.width * scale)
    h = int(product.height * scale)
    if w < 2 or h < 2 or alpha <= 0:
        return
    img = product.resize((w, h), Image.BICUBIC)
    if angle:
        img = img.rotate(angle, resample=Image.BICUBIC, expand=True)
    if alpha < 1:
        a = img.getchannel("A").point(lambda v: int(v * alpha))
        img.putalpha(a)
    if shadow:
        sh = drop_shadow((w, h), blur=int(18 + 30 * scale), alpha=int(120 * alpha))
        sx = int(cx - sh.width / 2 + 10 * scale)
        sy = int(cy - sh.height / 2 + 40 * scale)
        layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        black = Image.new("RGBA", sh.size, (0, 0, 0, 255))
        black.putalpha(sh)
        layer.paste(black, (sx, sy))
        canvas.alpha_composite(layer)
    canvas.alpha_composite(img, (int(cx - img.width / 2), int(cy - img.height / 2)))


def draw_text(canvas, text, cy, size, color, t=1.0, bold=True, cx=W // 2, slide=40, spacing=1.0):
    """Zentrierter Text mit Einblend- und Slide-up-Animation (t = 0..1)."""
    if t <= 0:
        return
    e = ease_out_cubic(t)
    f = font(size, bold)
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    bbox = d.textbbox((0, 0), text, font=f)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = cx - tw / 2 - bbox[0]
    y = cy - th / 2 - bbox[1] + slide * (1 - e)
    d.text((x, y), text, font=f, fill=color + (int(255 * e),))
    canvas.alpha_composite(layer)


def draw_lines(canvas, lines, cy, size, color, t, bold=True, gap=1.15, stagger=0.15):
    total = (len(lines) - 1) * size * gap
    y0 = cy - total / 2
    for i, line in enumerate(lines):
        draw_text(canvas, line, y0 + i * size * gap, size, color, t=(t - i * stagger) / (1 - stagger * 0.5), bold=bold)


def draw_pill(canvas, text, cx, cy, t, fg=INK, bg=WHITE, size=40, outline=None):
    if t <= 0:
        return
    e = ease_out_back(t)
    f = font(size)
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    bbox = d.textbbox((0, 0), text, font=f)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pw, ph = (tw + 64) * e, (th + 44) * e
    a = int(255 * clamp(t * 2))
    d.rounded_rectangle((cx - pw / 2, cy - ph / 2, cx + pw / 2, cy + ph / 2), radius=ph / 2,
                        fill=bg + (a,), outline=(outline + (a,)) if outline else None, width=3)
    if e > 0.6:
        d.text((cx - tw / 2 - bbox[0], cy - th / 2 - bbox[1]), text, font=f, fill=fg + (int(a * clamp((e - 0.6) / 0.3)),))
    canvas.alpha_composite(layer)


def star(d, cx, cy, r, fill):
    pts = []
    for i in range(10):
        ang = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.45
        pts.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
    d.polygon(pts, fill=fill)


def background(color, vignette=0.18):
    bg = Image.new("RGBA", (W, H), color + (255,))
    if vignette:
        yy, xx = np.mgrid[0:H, 0:W]
        r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
        v = np.clip((r - 0.55) / 0.9, 0, 1) * vignette
        arr = np.array(bg).astype(float)
        arr[..., :3] *= (1 - v[..., None])
        bg = Image.fromarray(arr.astype(np.uint8))
    return bg


# ----------------------------------------------------------------------------
# Szenen: jede Funktion bekommt die lokale Zeit s (Sekunden seit Szenenstart)
# ----------------------------------------------------------------------------
def scene_hook(s, ctx):
    c = background(CREAM).copy()
    p = ctx["product"]
    # Hülle fährt mit Überschwinger von unten ein
    e = ease_out_back(s / 0.9, s=1.1)
    cy = H * 0.62 + (1 - e) * 900 + math.sin(s * 2.2) * 8
    paste_product(c, p, W / 2, cy, 0.98, angle=-4 + 3 * ease_out_cubic(s / 1.2))
    draw_text(c, "iPhone 17 Pro?", 300, 64, COGNAC, t=(s - 0.1) / 0.5)
    draw_lines(c, ["Diese Hülle", "musst du sehen."], 470, 104, INK, t=(s - 0.35) / 0.6)
    return c


def scene_leather(s, ctx):
    c = background(DARK, 0.3).copy()
    p = ctx["product"]
    # starker Zoom auf den Kamerabereich, langsamer Schwenk nach unten
    z = 2.05 + 0.15 * ease_in_out(s / 4)
    cy = H * 0.98 - 260 * ease_in_out(s / 4)
    paste_product(c, p, W / 2 + 20, cy, z, shadow=False)
    draw_text(c, "ECHTES LEDER", 260, 44, STAR, t=(s - 0.2) / 0.5)
    draw_lines(c, ["Weich. Griffig.", "Wird mit der Zeit", "nur schöner."], 460, 88, WHITE, t=(s - 0.4) / 0.7)
    return c


def scene_fit(s, ctx):
    c = background(CREAM).copy()
    p = ctx["product"]
    z = 0.92 + 0.06 * ease_in_out(s / 4)
    paste_product(c, p, W / 2, H * 0.60, z, angle=6 - 12 * ease_in_out(s / 4))
    draw_text(c, "PASSGENAU", 250, 44, COGNAC, t=(s - 0.1) / 0.5)
    draw_lines(c, ["Für iPhone 17 Pro", "& Pro Max"], 400, 84, INK, t=(s - 0.3) / 0.6)
    pills = [("Kamera-Schutzrand", 300, 700), ("Schlankes Design", 740, 1180), ("Logo-Prägung", 300, 1420)]
    for i, (txt, x, y) in enumerate(pills):
        draw_pill(c, txt, x, y, (s - 1.0 - i * 0.55) / 0.5, outline=COGNAC)
    return c


def scene_colors(s, ctx):
    c = background(DARK, 0.3).copy()
    variants = ctx["variants"]
    per = 0.95
    idx = min(int(s / per), len(variants) - 1)
    local = (s - idx * per) / per
    # aktuelle Variante wischt von rechts ein, vorherige nach links raus
    e = ease_out_cubic(local / 0.45)
    if idx > 0:
        paste_product(c, variants[idx - 1][1], W / 2 - 900 * e, H * 0.58, 0.88, alpha=1 - e, shadow=False)
    paste_product(c, variants[idx][1], W / 2 + 900 * (1 - e), H * 0.58, 0.88, angle=-3 + 3 * e)
    draw_text(c, "4 FARBEN", 250, 44, STAR, t=(s - 0.1) / 0.5)
    draw_text(c, "Welche ist deine?", 360, 88, WHITE, t=(s - 0.3) / 0.6)
    # Farbpunkte
    layer = Image.new("RGBA", c.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    r = 38
    gap = 130
    x0 = W / 2 - gap * 1.5
    for i, (name, img, col) in enumerate(variants):
        x = x0 + i * gap
        y = 1560
        rr = r + (10 if i == idx else 0)
        if i == idx:
            d.ellipse((x - rr - 8, y - rr - 8, x + rr + 8, y + rr + 8), outline=WHITE + (255,), width=4)
        d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=col + (255,))
    c.alpha_composite(layer)
    draw_text(c, variants[idx][0], 1670, 46, WHITE, t=clamp(local / 0.3), slide=20)
    return c


def scene_proof(s, ctx):
    c = background(CREAM).copy()
    p = ctx["product"]
    paste_product(c, p, W / 2, H * 0.72 + 30 * (1 - ease_out_cubic(s / 0.8)), 0.72, alpha=ease_out_cubic(s / 0.5))
    layer = Image.new("RGBA", c.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i in range(5):
        t = clamp((s - 0.15 - i * 0.12) / 0.25)
        e = ease_out_back(t)
        if t > 0:
            star(d, W / 2 - 2 * 92 + i * 92, 300, 40 * e, STAR + (255,))
    c.alpha_composite(layer)
    draw_text(c, "278 Bewertungen", 400, 52, INK, t=(s - 0.8) / 0.5, bold=False)
    draw_text(c, "49,95 €", 560, 120, COGNAC, t=(s - 1.1) / 0.5)
    draw_text(c, "inkl. MwSt.", 660, 38, INK, t=(s - 1.3) / 0.5, bold=False)
    return c


def scene_cta(s, ctx):
    c = background(DARK, 0.3).copy()
    p = ctx["product"]
    e = ease_out_cubic(s / 0.9)
    paste_product(c, p, W / 2, H * 0.66 + 200 * (1 - e), 0.85, alpha=e, angle=-8 + 8 * e)
    draw_text(c, "skiin MORE.", 250, 52, STAR, t=(s - 0.1) / 0.5)
    draw_text(c, "Jetzt sichern", 380, 96, WHITE, t=(s - 0.3) / 0.5)
    draw_pill(c, "wiiuka.de", W / 2, 520, (s - 0.7) / 0.5, fg=DARK, bg=WHITE, size=48)
    return c


SCENES = [
    (0.0, 3.0, scene_hook),
    (3.0, 7.0, scene_leather),
    (7.0, 11.0, scene_fit),
    (11.0, 15.0, scene_colors),
    (15.0, 18.0, scene_proof),
    (18.0, 20.0, scene_cta),
]
XFADE = 0.25


def render_frame(t, ctx):
    frame = None
    for i, (start, end, fn) in enumerate(SCENES):
        if start <= t < end:
            frame = fn(t - start, ctx)
            # Überblendung zur nächsten Szene
            if i + 1 < len(SCENES) and t > end - XFADE:
                nxt = SCENES[i + 1][2](0.0, ctx)
                a = (t - (end - XFADE)) / XFADE
                frame = Image.blend(frame, nxt, ease_in_out(a))
            break
    if frame is None:
        frame = SCENES[-1][2](SCENES[-1][1] - SCENES[-1][0], ctx)
    return frame.convert("RGB")


def build_context(product_path):
    product = Image.open(product_path).convert("RGBA")
    product = trim_shadow(product)
    # auf einheitliche Arbeitsgröße bringen (Höhe ~ 1000 px bei Skalierung 1.0)
    target_h = 1000
    product = product.resize((int(product.width * target_h / product.height), target_h), Image.LANCZOS)
    variants = []
    for name, col in COLORS:
        img = product if col is None else tint(product, col)
        dot = COGNAC if col is None else col
        variants.append((name, img, dot))
    return {"product": product, "variants": variants}


def main():
    ap = argparse.ArgumentParser(description="20s Produktvideo für TikTok rendern")
    ap.add_argument("--product", default="assets/images/skiin_more_cognac.png")
    ap.add_argument("--audio", default="assets/audio/song_tiktok.m4a")
    ap.add_argument("--out", default="exports/skiin_more_tiktok.mp4")
    ap.add_argument("--preview", action="store_true", help="nur ein Standbild pro Szene als PNG rendern")
    args = ap.parse_args()

    import imageio_ffmpeg
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    ctx = build_context(args.product)
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)

    if args.preview:
        for start, end, fn in SCENES:
            for frac in (0.15, 0.6):
                t = start + (end - start) * frac
                path = os.path.splitext(args.out)[0] + f"_preview_{t:05.2f}.png"
                render_frame(t, ctx).resize((W // 3, H // 3)).save(path)
                print("preview", path)
        return

    video_tmp = os.path.splitext(args.out)[0] + "_noaudio.mp4"
    cmd = [ffmpeg, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
           "-pix_fmt", "yuv420p", "-movflags", "+faststart", video_tmp]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    n = int(DURATION * FPS)
    for i in range(n):
        frame = render_frame(i / FPS, ctx)
        proc.stdin.write(frame.tobytes())
        if i % 60 == 0:
            print(f"frame {i}/{n}")
    proc.stdin.close()
    proc.wait()
    if proc.returncode != 0:
        raise SystemExit("ffmpeg (video) fehlgeschlagen")

    # Song in Schleife auf Videolänge bringen, am Ende ausblenden, muxen
    cmd = [ffmpeg, "-y", "-loglevel", "error", "-i", video_tmp, "-stream_loop", "-1", "-i", args.audio,
           "-t", str(DURATION), "-filter_complex",
           f"[1:a]afade=t=in:st=0:d=0.3,afade=t=out:st={DURATION - 1.5}:d=1.5,volume=0.9[a]",
           "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", args.out]
    subprocess.run(cmd, check=True)
    os.remove(video_tmp)
    print("fertig:", args.out)


if __name__ == "__main__":
    main()
