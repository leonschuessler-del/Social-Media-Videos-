#!/usr/bin/env python3
"""High-End-Produktfilm für eine Handyhülle (9:16, 1080x1920, 60 fps, 20 s).

Stil: dunkles Studio, Lichtsweeps über das Leder, Pseudo-3D-Drehung, Makro-Shots,
technische Callouts, kinetische Typografie, Filmkorn, Vignette, Spiegelung und ein
komplett synthetisiertes Sound-Design (Booms, Whooshes, Ticks, Shimmer), das auf die
Schnitte gelegt wird. Der Song aus assets/audio läuft als Bett darunter.

Beispiel:
    python scripts/product_video_pro.py --out exports/skiin_more_pro.mp4
    python scripts/product_video_pro.py --preview          # Standbilder pro Szene
    python scripts/product_video_pro.py --fps 30 --workers 2

Es wird kein systemweites ffmpeg benötigt (Binary aus imageio-ffmpeg).
"""
import argparse
import math
import os
import subprocess
import sys
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1920
FPS = 60
DURATION = 20.0
SR = 44100

FONT_BOLD = "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf"
FONT_REG = "/usr/share/fonts/truetype/freefont/FreeSans.ttf"

WHITE = (255, 255, 255)
GOLD = (214, 184, 132)
GREY = (170, 166, 160)

# Farbvarianten (Name, Ziel-Lederfarbe). Cognac = Originalbild.
COLORS = [
    ("Cognac", None, (181, 113, 63)),
    ("Anthrazit", (74, 74, 78), (92, 92, 96)),
    ("Dunkelbraun", (86, 66, 52), (110, 84, 66)),
    ("Oliv", (84, 84, 60), (104, 104, 74)),
]

# Landmarken in Pixeln des Original-Freistellers (470x929), gemessen.
LM = {
    "lens1": (101, 99), "lens2": (214, 154), "lens3": (107, 211),
    "flash": (360, 102), "mic": (367, 215),
    "plateau": (240, 160), "logo": (235, 772), "grain": (235, 470),
}

# ----------------------------------------------------------------------------
# Timeline (Sekunden)
# ----------------------------------------------------------------------------
# Alle Schnitte liegen auf dem Beat-Raster des Songs (81 BPM, Halbtakt 0.741 s,
# erster Downbeat des Songs auf 2.60 s gelegt).
BEAT = 0.741
DOWNBEAT0 = 2.60
SONG_OFFSET = 1.04          # Songzeit 0 liegt bei Videozeit 1.04 s
SONG_LOOP = (1.56, 8.97)    # nahtloser 5-Takt-Loop im Song (Downbeat zu Downbeat)
T_REVEAL = (0.0, 2.60)
T_HERO = (2.60, 4.82)
T_MACRO1 = (4.82, 6.30)
T_MACRO2 = (6.30, 7.79)
T_CAMERA = (7.79, 10.75)
T_FIT = (10.75, 12.98)
T_COLORS = (12.98, 16.68)
T_FINALE = (16.68, 18.91)
T_END = (18.91, 20.0)


# ----------------------------------------------------------------------------
# Easing
# ----------------------------------------------------------------------------
def clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def smoothstep(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def ease_out_expo(t):
    t = clamp(t)
    return 1 if t >= 1 else 1 - 2 ** (-10 * t)


def ease_in_expo(t):
    t = clamp(t)
    return 0 if t <= 0 else 2 ** (10 * (t - 1))


def ease_out_cubic(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def ease_in_out(t):
    t = clamp(t)
    return 0.5 - 0.5 * math.cos(math.pi * t)


def ease_out_back(t, s=1.2):
    t = clamp(t)
    return 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2


def lerp(a, b, t):
    return a + (b - a) * t


# ----------------------------------------------------------------------------
# Produktbild
# ----------------------------------------------------------------------------
def trim_shadow(img):
    """Entfernt den hellen Produktschatten unterhalb der Hülle."""
    a = np.array(img).astype(int)
    rgb, alpha = a[..., :3], a[..., 3]
    last = img.height - 1
    for y in range(img.height - 1, 0, -1):
        m = alpha[y] > 128
        if m.sum() < 5:
            continue
        px = rgb[y][m]
        if px.mean() < 150 or (px.max(axis=1) - px.min(axis=1)).mean() > 35:
            last = y
            break
    img = img.crop((0, 0, img.width, last + 1))
    a = np.array(img).astype(int)
    haze = (a[..., 3] < 200) & (a[..., :3].mean(axis=2) > 200)
    a[haze, 3] = 0
    # Graue/weiße Reste des Untergrunds im unteren Bereich (Leder ist gesättigt, Untergrund nicht)
    bottom = a[-int(img.height * 0.15):]
    px = bottom[..., :3]
    sat = px.max(axis=2) - px.min(axis=2)
    grey = (sat < 22) & (px.mean(axis=2) > 70)
    bottom[grey, 3] = 0
    out = Image.fromarray(a.astype(np.uint8))
    alpha = out.getchannel("A").filter(ImageFilter.MinFilter(3))
    out.putalpha(alpha)
    return out


def load_product(path, target_h=1400):
    img = Image.open(path).convert("RGBA")
    orig_h = img.height
    img = trim_shadow(img)
    k = target_h / img.height
    img = img.resize((round(img.width * k), target_h), Image.LANCZOS)
    rgb = img.convert("RGB").filter(ImageFilter.UnsharpMask(radius=2.2, percent=70, threshold=2))
    # Alpha leicht erodieren + weichzeichnen: keine hellen Ränder auf Schwarz
    alpha = img.getchannel("A").filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.0))
    rgb.putalpha(alpha)
    landmarks = {n: (x * k, y * k) for n, (x, y) in LM.items()}
    return rgb, landmarks


def tint(img, target):
    a = np.array(img).astype(np.float32)
    rgb, alpha = a[..., :3], a[..., 3:4]
    lum = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    mask = alpha[..., 0] > 128
    l0 = lum[mask].mean()
    t = np.array(target, dtype=np.float32)
    out = np.clip(t * (lum[..., None] / l0), 0, 255)
    return Image.fromarray(np.concatenate([out, alpha], axis=2).astype(np.uint8))


# ----------------------------------------------------------------------------
# Bildoperationen
# ----------------------------------------------------------------------------
def find_coeffs(pa, pb):
    """Perspektiv-Koeffizienten: pa = Punkte im Zielbild, pb = Punkte im Quellbild."""
    matrix = []
    for p1, p2 in zip(pa, pb):
        matrix.append([p1[0], p1[1], 1, 0, 0, 0, -p2[0] * p1[0], -p2[0] * p1[1]])
        matrix.append([0, 0, 0, p1[0], p1[1], 1, -p2[1] * p1[0], -p2[1] * p1[1]])
    A = np.array(matrix, dtype=np.float64)
    B = np.array(pb, dtype=np.float64).reshape(8)
    return np.linalg.solve(A, B)


def warp3d(img, yaw=0.0, pitch=0.0, shade=0.28):
    """Pseudo-3D: Ebene um Y (yaw) und X (pitch) drehen, perspektivisch projizieren, schattieren."""
    if abs(yaw) < 0.05 and abs(pitch) < 0.05:
        return img
    w, h = img.size
    ty, tp = math.radians(yaw), math.radians(pitch)
    if shade and abs(yaw) > 0.05:
        a = np.array(img).astype(np.float32)
        g = np.linspace(-1, 1, w, dtype=np.float32)
        gain = 1 + shade * math.sin(ty) * g - 0.06 * abs(math.sin(ty))
        a[..., :3] = np.clip(a[..., :3] * gain[None, :, None], 0, 255)
        img = Image.fromarray(a.astype(np.uint8))
    f = 2.6 * h
    corners = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
    proj = []
    for x, y in corners:
        xr, zr = x * math.cos(ty), -x * math.sin(ty)
        yr, zr = y * math.cos(tp) - zr * math.sin(tp), y * math.sin(tp) + zr * math.cos(tp)
        s = f / (f + zr)
        proj.append((xr * s, yr * s))
    xs, ys = [p[0] for p in proj], [p[1] for p in proj]
    minx, miny = min(xs), min(ys)
    ow, oh = int(math.ceil(max(xs) - minx)), int(math.ceil(max(ys) - miny))
    dst = [(x - minx, y - miny) for x, y in proj]
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    coeffs = find_coeffs(dst, src)
    return img.transform((ow, oh), Image.PERSPECTIVE, coeffs, Image.BICUBIC)


def _diag(shape, angle_deg):
    h, w = shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    ang = math.radians(angle_deg)
    d = (xx / w) * math.cos(ang) + (yy / h) * math.sin(ang)
    d = (d - d.min()) / (d.max() - d.min() + 1e-6)
    return d


def add_sweep(img, pos, width=0.10, strength=0.55, angle=-30.0):
    """Spekularer Lichtsweep über das Produkt (Screen-Blend, maskiert durch Alpha)."""
    if pos < -width * 3 or pos > 1 + width * 3 or strength <= 0:
        return img
    a = np.array(img).astype(np.float32)
    d = _diag(a.shape[:2], angle)
    band = np.exp(-((d - pos) / width) ** 2)
    m = band * strength * (a[..., 3] / 255.0)
    a[..., :3] += m[..., None] * (255 - a[..., :3])
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def wipe_reveal(img, pos, soft=0.18, glow=0.9):
    """Produkt von oben nach unten aufdecken, mit leuchtender Kante an der Wischfront."""
    a = np.array(img).astype(np.float32)
    h, w = a.shape[:2]
    yy = (np.arange(h, dtype=np.float32) / h)[:, None]
    m = np.clip((pos - yy) / soft, 0, 1)
    m = m * m * (3 - 2 * m)
    edge = np.exp(-((yy - pos + soft * 0.35) / (soft * 0.35)) ** 2) * glow
    a[..., 3] *= np.broadcast_to(m, (h, w))
    a[..., :3] += (edge[..., None] * (a[..., 3:4] / 255.0)) * (255 - a[..., :3])
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def color_morph(img_a, img_b, pos, soft=0.07, angle=-55.0, glow=0.45):
    """Diagonaler Farb-Wipe von img_a nach img_b mit leuchtender Kante."""
    a = np.array(img_a).astype(np.float32)
    b = np.array(img_b).astype(np.float32)
    d = _diag(a.shape[:2], angle)
    m = np.clip((pos - d) / soft, 0, 1)
    m = m * m * (3 - 2 * m)
    out = a.copy()
    out[..., :3] = a[..., :3] * (1 - m[..., None]) + b[..., :3] * m[..., None]
    edge = np.exp(-((d - pos + soft * 0.3) / (soft * 0.22)) ** 2) * glow * (a[..., 3] / 255.0)
    out[..., :3] += edge[..., None] * (255 - out[..., :3])
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def set_alpha(img, alpha):
    if alpha >= 1:
        return img
    a = img.getchannel("A").point(lambda v: int(v * alpha))
    img = img.copy()
    img.putalpha(a)
    return img


def blit(canvas, img, x, y):
    """RGBA-Bild an (x, y) einkomponieren, auch mit negativen Koordinaten/Überhang."""
    x, y = int(round(x)), int(round(y))
    sx0, sy0 = max(0, -x), max(0, -y)
    sx1, sy1 = min(img.width, canvas.width - x), min(img.height, canvas.height - y)
    if sx1 <= sx0 or sy1 <= sy0:
        return
    part = img.crop((sx0, sy0, sx1, sy1)) if (sx0, sy0, sx1, sy1) != (0, 0, img.width, img.height) else img
    canvas.alpha_composite(part, (x + sx0, y + sy0))


def blit_center(canvas, img, cx, cy):
    blit(canvas, img, cx - img.width / 2, cy - img.height / 2)


def reflection(img, strength=0.22, length=0.28, blur=6):
    """Bodenspiegelung: vertikal gespiegelt, nach unten auslaufend."""
    r = img.transpose(Image.FLIP_TOP_BOTTOM)
    a = np.array(r.getchannel("A")).astype(np.float32)
    h = a.shape[0]
    fade = np.clip(1 - (np.arange(h, dtype=np.float32) / (h * length)), 0, 1) ** 1.6
    a *= fade[:, None] * strength
    r.putalpha(Image.fromarray(a.astype(np.uint8)))
    return r.filter(ImageFilter.GaussianBlur(blur))


# ----------------------------------------------------------------------------
# Typografie
# ----------------------------------------------------------------------------
_font_cache = {}


def font(size, bold=True):
    key = (size, bold)
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)
    return _font_cache[key]


def text_layer(text, size, color, bold=True, tracking=0.0, alpha=1.0):
    f = font(size, bold)
    asc, desc = f.getmetrics()
    pad = 6
    if tracking == 0:
        bbox = f.getbbox(text)
        w = bbox[2] - bbox[0]
        layer = Image.new("RGBA", (w + pad * 2, asc + desc + pad * 2), (0, 0, 0, 0))
        ImageDraw.Draw(layer).text((pad - bbox[0], pad), text, font=f, fill=color + (int(255 * alpha),))
        return layer
    widths = [f.getlength(c) for c in text]
    total = sum(widths) + tracking * (len(text) - 1)
    layer = Image.new("RGBA", (int(total) + pad * 2, asc + desc + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x = pad
    for c, cw in zip(text, widths):
        d.text((x, pad), c, font=f, fill=color + (int(255 * alpha),))
        x += cw + tracking
    return layer


def caption(canvas, text, cy, t, size=30, color=GOLD, cx=W / 2, hairline=True, fade_out=None):
    """Kleine, gesperrte Versalien mit Tracking-In-Animation und Haarlinie."""
    if t <= 0:
        return
    e = ease_out_expo(t / 0.7)
    a = smoothstep(t / 0.45)
    if fade_out is not None:
        a *= 1 - smoothstep(fade_out)
    if a <= 0:
        return
    tracking = lerp(size * 0.9, size * 0.32, e)
    layer = text_layer(text.upper(), size, color, bold=True, tracking=tracking, alpha=a)
    blit_center(canvas, layer, cx, cy)
    if hairline:
        lw = int(lerp(0, 56, e))
        if lw > 0:
            line = Image.new("RGBA", (lw, 2), color + (int(200 * a),))
            blit_center(canvas, line, cx, cy - size * 1.1)


def headline(canvas, text, cy, t, size=104, color=WHITE, stagger=0.09, dur=0.55, fade_out=None, cx=W / 2):
    """Große Headline, Wort für Wort eingeblendet (Slide-up + Fade)."""
    if t <= 0:
        return
    words = text.split(" ")
    f = font(size, True)
    space = f.getlength(" ")
    layers = [text_layer(wd, size, color, True) for wd in words]
    total = sum(l.width - 12 for l in layers) + space * (len(words) - 1)
    x = cx - total / 2
    fo = 1 - smoothstep(fade_out) if fade_out is not None else 1
    for i, layer in enumerate(layers):
        p = (t - i * stagger) / dur
        if p > 0:
            e = ease_out_expo(p)
            a = smoothstep(p * 1.6) * fo
            if a > 0:
                blit(canvas, set_alpha(layer, a), x - 6, cy - layer.height / 2 + 34 * (1 - e))
        x += layer.width - 12 + space


# ----------------------------------------------------------------------------
# Sprites / Hintergrund
# ----------------------------------------------------------------------------
def soft_disc(r, color=WHITE):
    s = int(r * 4)
    im = Image.new("L", (s, s), 0)
    ImageDraw.Draw(im).ellipse((s / 2 - r, s / 2 - r, s / 2 + r, s / 2 + r), fill=255)
    im = im.filter(ImageFilter.GaussianBlur(r * 0.8))
    out = Image.new("RGBA", (s, s), color + (0,))
    out.putalpha(im)
    return out


def sparkle(size=140):
    ss = 3
    s = size * ss
    im = Image.new("L", (s, s), 0)
    d = ImageDraw.Draw(im)
    c = s / 2
    for ang, ln, wd in [(0, 0.48, 0.030), (90, 0.48, 0.030), (45, 0.22, 0.02), (135, 0.22, 0.02)]:
        a = math.radians(ang)
        dx, dy = math.cos(a), math.sin(a)
        nx, ny = -dy, dx
        L, Wd = s * ln, s * wd
        d.polygon([(c + dx * L, c + dy * L), (c + nx * Wd, c + ny * Wd), (c - dx * L, c - dy * L), (c - nx * Wd, c - ny * Wd)], fill=255)
    d.ellipse((c - s * 0.05, c - s * 0.05, c + s * 0.05, c + s * 0.05), fill=255)
    im = im.resize((size, size), Image.LANCZOS)
    glow = im.filter(ImageFilter.GaussianBlur(size * 0.08))
    a = np.clip(np.array(im).astype(np.float32) + np.array(glow).astype(np.float32) * 0.8, 0, 255).astype(np.uint8)
    out = Image.new("RGBA", (size, size), WHITE + (0,))
    out.putalpha(Image.fromarray(a))
    return out


def make_background(warm=(64, 50, 40), floor=(7, 7, 8), sigma=0.42, cy=0.5):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H * cy) / (W / 2)) ** 2)
    spot = np.exp(-(r ** 2) / (2 * sigma ** 2))
    base = np.array(floor, dtype=np.float32)[None, None, :] + spot[..., None] * np.array(warm, dtype=np.float32)
    return base, spot


def make_vignette(strength=0.55):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    v = 1 - strength * np.clip((r - 0.45) / 0.85, 0, 1) ** 1.6
    return v[..., None]


# ----------------------------------------------------------------------------
# Kontext (pro Worker einmal aufgebaut)
# ----------------------------------------------------------------------------
CTX = {}


def build_context(product_path, seed=7):
    product, lm = load_product(product_path)
    variants = []
    for name, col, dot in COLORS:
        variants.append((name, product if col is None else tint(product, col), dot))
    rs = np.random.RandomState(seed)
    particles = []
    for _ in range(34):
        particles.append(dict(x=rs.uniform(0, W), y=rs.uniform(0, H), r=rs.uniform(2.5, 9),
                              v=rs.uniform(10, 34), a=rs.uniform(0.10, 0.42), ph=rs.uniform(0, 6.28),
                              sway=rs.uniform(8, 30)))
    grain = [rs.normal(0, 1, (H, W, 1)).astype(np.float32) for _ in range(6)]
    bg, spot = make_background()
    return dict(product=product, lm=lm, variants=variants, particles=particles, grain=grain,
                bg=bg, spot=spot[..., None], vignette=make_vignette(), rs=rs,
                discs={r: soft_disc(r) for r in (3, 5, 7, 9)}, sparkle=sparkle(150))


def init_worker(product_path):
    global CTX
    CTX = build_context(product_path)


# ----------------------------------------------------------------------------
# Szenenbausteine
# ----------------------------------------------------------------------------
def new_canvas(spot_intensity=1.0, warm_shift=0.0):
    bg = CTX["bg"]
    if spot_intensity != 1.0 or warm_shift:
        floor = np.array((7, 7, 8), dtype=np.float32)
        warm = np.array((64, 50, 40), dtype=np.float32) * spot_intensity
        if warm_shift:
            warm = warm * np.array((1 - warm_shift * 0.4, 1 - warm_shift * 0.2, 1 + warm_shift * 0.6), dtype=np.float32)
        bg = floor[None, None, :] + CTX["spot"] * warm[None, None, :]
    rgb = np.clip(bg, 0, 255).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb, np.full((H, W, 1), 255, np.uint8)]))


def particles(canvas, t, alpha=1.0):
    if alpha <= 0:
        return
    for p in CTX["particles"]:
        y = (p["y"] - t * p["v"]) % (H + 60) - 30
        x = p["x"] + math.sin(t * 0.5 + p["ph"]) * p["sway"]
        r = 3 if p["r"] < 4 else 5 if p["r"] < 6.5 else 7 if p["r"] < 8.2 else 9
        tw = 0.65 + 0.35 * math.sin(t * 1.7 + p["ph"] * 2)
        sprite = set_alpha(CTX["discs"][r], p["a"] * alpha * tw)
        blit_center(canvas, sprite, x, y)


def place_product(canvas, img, cx, cy, scale, yaw=0.0, pitch=0.0, alpha=1.0, sweep=None, reflect=True, wipe=None):
    """Produkt skalieren, drehen, sweepen und mit Spiegelung platzieren. Gibt (x, y, w, h) zurück."""
    w = max(2, int(img.width * scale))
    h = max(2, int(img.height * scale))
    im = img.resize((w, h), Image.BICUBIC if scale < 0.999 else Image.BILINEAR) if scale != 1 else img
    if sweep is not None:
        im = add_sweep(im, *sweep)
    if wipe is not None:
        im = wipe_reveal(im, wipe)
    im = warp3d(im, yaw, pitch)
    if alpha < 1:
        im = set_alpha(im, alpha)
    x, y = cx - im.width / 2, cy - im.height / 2
    if reflect:
        r = reflection(im)
        blit(canvas, r, x, y + im.height + 4)
    blit(canvas, im, x, y)
    return x, y, im.width, im.height


def macro(product, center_px, zoom, offset=(0, 0), canvas_bg=(10, 9, 9)):
    """Makro-Ausschnitt: nur den benötigten Bereich croppen und hochskalieren."""
    cw, ch = W / zoom, H / zoom
    cx, cy = center_px[0] + offset[0], center_px[1] + offset[1]
    box = (int(cx - cw / 2), int(cy - ch / 2), int(cx + cw / 2), int(cy + ch / 2))
    crop = product.crop(box)  # ausserhalb -> transparent
    im = crop.resize((W, H), Image.BICUBIC)
    im = im.filter(ImageFilter.UnsharpMask(radius=3, percent=45, threshold=3))
    bg = Image.new("RGBA", (W, H), canvas_bg + (255,))
    bg.alpha_composite(im)
    return bg


def depth_of_field(canvas, center=(0.5, 0.5), radius=0.55, blur=7):
    """Radiale Tiefenschärfe: Mitte scharf, Ränder weich."""
    blurred = canvas.filter(ImageFilter.GaussianBlur(blur))
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx / W - center[0]) * 1.0) ** 2 + ((yy / H - center[1]) * (H / W)) ** 2)
    m = np.clip((r - radius * 0.55) / (radius * 0.9), 0, 1) ** 1.5
    mask = Image.fromarray((m * 255).astype(np.uint8))
    return Image.composite(blurred, canvas, mask)


def ring_callout(canvas, cx, cy, r, t, label=None, t_label=0.0, color=WHITE):
    """Dünner Ring, der sich zeichnet (0..1), plus Haarlinie und Label."""
    if t <= 0:
        return
    ss = 3
    e = ease_out_cubic(t)
    size = int(r * 2 + 40)
    im = Image.new("RGBA", (size * ss, size * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    box = (20 * ss, 20 * ss, (20 + 2 * r) * ss, (20 + 2 * r) * ss)
    d.arc(box, start=-90, end=-90 + 360 * e, fill=color + (235,), width=3 * ss)
    im = im.resize((size, size), Image.LANCZOS)
    blit_center(canvas, im, cx, cy)
    if label and t_label > 0:
        el = ease_out_expo(t_label / 0.6)
        lay = text_layer(label.upper(), 26, color, True, tracking=7, alpha=smoothstep((t_label - 0.25) / 0.45))
        # Label rechtsbündig am Sicherheitsrand, Haarlinie wächst vom Ring dorthin
        lx = W - 72 - lay.width
        x0 = cx + r + 10
        ln = int(lerp(0, max(10, lx - 14 - x0), el))
        line = Image.new("RGBA", (max(1, ln), 2), color + (210,))
        blit(canvas, line, x0, cy)
        blit(canvas, lay, lx, cy - lay.height / 2)


# ----------------------------------------------------------------------------
# Szenen
# ----------------------------------------------------------------------------
def s_reveal(t):
    """0.0-2.6: Lichtlinie, dann Aufdeckung der Hülle aus dem Dunkel."""
    spot = smoothstep((t - 0.6) / 1.4)
    c = new_canvas(spot_intensity=spot)
    # Lichtlinie
    if t < 1.0:
        e = ease_out_expo(t / 0.5)
        width = int(720 * e)
        fade = 1 - smoothstep((t - 0.55) / 0.4)
        if width > 2 and fade > 0:
            line = Image.new("RGBA", (width, 3), WHITE + (int(255 * fade),))
            glow = Image.new("RGBA", (width + 80, 60), (0, 0, 0, 0))
            gl = Image.new("L", (width, 6), 255).filter(ImageFilter.GaussianBlur(3))
            glow.paste(Image.new("RGBA", (width, 6), (255, 235, 210, int(160 * fade))), (40, 27), gl)
            glow = glow.filter(ImageFilter.GaussianBlur(12))
            blit_center(c, glow, W / 2, H * 0.55)
            blit_center(c, line, W / 2, H * 0.55)
    particles(c, t, alpha=spot)
    if t > 0.55:
        p = (t - 0.55) / 1.6
        wipe = ease_out_cubic(p) * 1.25
        scale = lerp(0.98, 0.84, ease_out_cubic((t - 0.55) / 2.05))
        yaw = lerp(26, 9, ease_out_cubic((t - 0.55) / 2.05))
        cy = lerp(H * 0.58, H * 0.56, ease_out_cubic((t - 0.55) / 2.05))
        place_product(c, CTX["product"], W / 2, cy, scale, yaw=yaw, wipe=min(wipe, 1.3),
                      reflect=p > 0.75, sweep=(lerp(-0.4, 1.4, ease_in_out((t - 1.6) / 1.2)), 0.10, 0.45))
    return c, {}


def s_hero(t):
    """2.6-5.4: Hero-Orbit mit Headline und Lichtsweep."""
    c = new_canvas(1.0)
    particles(c, t + T_HERO[0])
    yaw = lerp(9, -7, ease_in_out(t / 2.2))
    cy = H * 0.56 + math.sin(t * 1.1) * 4
    sweep = (lerp(-0.4, 1.4, ease_in_out((t - 0.4) / 1.2)), 0.09, 0.5)
    place_product(c, CTX["product"], W / 2, cy, 0.84, yaw=yaw, pitch=-2, sweep=sweep)
    headline(c, "Aus echtem Leder.", 300, t - 0.05, size=108, fade_out=(t - 2.02) / 0.18)
    caption(c, "skiin MORE. · iPhone 17 Pro", 420, t - 0.6, fade_out=(t - 2.02) / 0.18)
    return c, {}


def s_macro1(t):
    """5.4-7.0: Makro auf die Maserung, langsame Drift, am Ende Whip-Pan nach rechts."""
    lm = CTX["lm"]
    drift = ease_in_out(t / 1.48)
    off = (lerp(-60, 50, drift), lerp(-70, 40, drift))
    whip = ease_in_expo((t - 1.30) / 0.18)
    off = (off[0] + whip * 900, off[1])
    c = macro(CTX["product"], lm["grain"], 2.1, off)
    c = depth_of_field(c, radius=0.7, blur=4)
    caption(c, "Natürliche Maserung", H * 0.80, t - 0.2, size=32, fade_out=(t - 1.18) / 0.14)
    return c, {"mblur": int(whip * 70)}


def s_macro2(t):
    """7.0-8.4: Makro auf die Logo-Prägung, Whip-Pan-Einfahrt von links."""
    lm = CTX["lm"]
    win = 1 - ease_out_expo(t / 0.22)
    drift = ease_in_out(t / 1.4)
    off = (lerp(40, -30, drift) - win * 900, lerp(30, -30, drift))
    c = macro(CTX["product"], lm["logo"], 2.4, off)
    c = depth_of_field(c, radius=0.7, blur=4)
    caption(c, "Geprägtes Logo", H * 0.80, t - 0.3, size=32, fade_out=(t - 1.3) / 0.15)
    return c, {"mblur": int(win * 70)}


def s_camera(t):
    """8.4-11.2: Kameramodul, Lichtsweep mit Glints, Callout-Ring."""
    c = new_canvas(0.6)
    prod = CTX["product"]
    lm = CTX["lm"]
    scale = 1.35
    yaw = lerp(10, -9, ease_in_out(t / 2.96))
    pitch = lerp(6, 2, ease_in_out(t / 2.96))
    # Produkt so platzieren, dass das Kameraplateau im oberen Drittel liegt
    pl = lm["plateau"]
    cx = W / 2 - (pl[0] - prod.width / 2) * scale
    cy = H * 0.40 - (pl[1] - prod.height / 2) * scale
    sweep_pos = lerp(-0.4, 1.4, ease_in_out((t - 0.6) / 1.1))
    x, y, w, h = place_product(c, prod, cx, cy, scale, yaw=yaw, pitch=pitch, reflect=False,
                               sweep=(sweep_pos, 0.08, 0.6, -30))
    # Glints an den Linsen, wenn der Sweep sie passiert
    for name, at in (("lens1", 0.95), ("lens2", 1.10), ("lens3", 1.25), ("flash", 1.02)):
        p = (t - at) / 0.45
        if 0 < p < 1:
            k = math.sin(p * math.pi)
            lx = cx + (lm[name][0] - prod.width / 2) * scale * math.cos(math.radians(yaw))
            ly = cy + (lm[name][1] - prod.height / 2) * scale
            sp = CTX["sparkle"].resize((int(150 * (0.5 + 0.7 * k)),) * 2, Image.BILINEAR)
            blit_center(c, set_alpha(sp, 0.95 * k), lx, ly)
    headline(c, "Schützt, was zählt.", 1380, t - 0.25, size=96)
    # Ring um die Hauptlinse
    lx = cx + (lm["lens2"][0] - prod.width / 2) * scale * math.cos(math.radians(yaw))
    ly = cy + (lm["lens2"][1] - prod.height / 2) * scale
    ring_callout(c, lx, ly, 96 * scale * 0.72, (t - 1.35) / 0.8, label="Erhöhter Rand", t_label=t - 2.05)
    return c, {}


def s_fit(t):
    """11.2-13.6: Die Hülle setzt sich aus drei Segmenten zusammen (Assembly)."""
    c = new_canvas(0.9)
    particles(c, t + T_FIT[0], alpha=0.6)
    prod = CTX["product"]
    scale = 0.80
    w, h = int(prod.width * scale), int(prod.height * scale)
    im = prod.resize((w, h), Image.BICUBIC)
    im = add_sweep(im, lerp(-0.4, 1.4, ease_in_out((t - 0.9) / 1.2)), 0.09, 0.45)
    cx, cy = W / 2, H * 0.56
    x0, y0 = cx - w / 2, cy - h / 2
    cuts = [0.0, 0.34, 0.66, 1.0]
    offsets = [(-260, -220), (300, 0), (-240, 240)]
    done = True
    seam_flash = []
    for i in range(3):
        p = ease_out_expo((t - 0.05 - i * 0.09) / 0.75)
        if p < 0.999:
            done = False
        ya, yb = int(h * cuts[i]), int(h * cuts[i + 1])
        seg = im.crop((0, ya, w, yb))
        ox, oy = offsets[i]
        blit(c, set_alpha(seg, smoothstep(p * 3)), x0 + ox * (1 - p), y0 + ya + oy * (1 - p))
        if i < 2:
            seam_flash.append((y0 + yb, clamp(1 - (t - 0.8 - i * 0.09) / 0.45)))
    if done:
        blit(c, reflection(im), x0, y0 + h + 4)
        blit(c, im, x0, y0)
    else:
        for sy, k in seam_flash:
            if 0 < k < 1:
                line = Image.new("RGBA", (w - 40, 2), (255, 240, 220, int(200 * k)))
                blit_center(c, line, cx, sy)
    headline(c, "Wie angegossen.", 300, t - 0.74, size=104, fade_out=(t - 2.08) / 0.15)
    caption(c, "iPhone 17 Pro · Pro Max", 420, t - 1.25, fade_out=(t - 2.08) / 0.15)
    return c, {}


def s_colors(t):
    """12.98-16.68: Farbwechsel als diagonale Wipes auf den Downbeats, dann Auffächern."""
    variants = CTX["variants"]
    times = [BEAT, 2 * BEAT, 3 * BEAT]   # Wipes -> Anthrazit, Dunkelbraun, Oliv
    fan_t = 4 * BEAT
    idx = sum(1 for ts in times if t >= ts)
    cur, prev = idx, max(0, idx - 1)
    ts = times[idx - 1] if idx > 0 else -1
    p = (t - ts) / 0.36 if idx > 0 else 2
    c = new_canvas(0.85, warm_shift=(0.0 if cur == 0 else 0.5) * smoothstep(p))
    particles(c, t + T_COLORS[0], alpha=0.5)
    if t < fan_t:
        yaw = lerp(-8, 8, ease_in_out(t / fan_t))
        if p < 1.2:
            img = color_morph(variants[prev][1], variants[cur][1], lerp(-0.2, 1.25, ease_in_out(p)))
        else:
            img = variants[cur][1]
        place_product(c, img, W / 2, H * 0.54, 0.80, yaw=yaw)
        nxt = times[idx] if idx < len(times) else fan_t
        caption(c, variants[cur][0], H * 0.86, t - (ts + 0.1 if idx > 0 else 0.15), size=30,
                fade_out=(t - (nxt - 0.12)) / 0.12)
    else:
        fan = ease_out_back((t - fan_t) / 0.5, s=0.9)
        xs = [-372, -124, 124, 372]
        for i, (name, img, dot) in enumerate(variants):
            sx = lerp(0, xs[i], fan)
            sc = lerp(0.80, 0.30, ease_out_cubic((t - fan_t) / 0.5))
            place_product(c, img, W / 2 + sx, H * 0.54, sc, yaw=lerp(0, (i - 1.5) * 9, fan), reflect=True,
                          alpha=1.0 if i == 3 else smoothstep(fan * 1.5))
        headline(c, "Vier Charaktere.", 300, t - fan_t - 0.1, size=104)
        for i, (name, img, dot) in enumerate(variants):
            caption(c, name, H * 0.74, t - fan_t - 0.3 - i * 0.06, size=17, cx=W / 2 + xs[i], hairline=False, color=GREY)
    return c, {}


def s_finale(t):
    """16.6-18.8: Hero-Totale mit Markenclaim."""
    c = new_canvas(1.0)
    particles(c, t + T_FINALE[0])
    yaw = lerp(-12, 10, ease_in_out(t / 2.23))
    sweep = (lerp(-0.4, 1.4, ease_in_out((t - 0.35) / 1.3)), 0.09, 0.5)
    place_product(c, CTX["product"], W / 2, H * 0.60, 0.86, yaw=yaw, pitch=-3, sweep=sweep)
    layer = text_layer("skiin MORE.", 128, WHITE, True, tracking=lerp(22, 4, ease_out_expo((t - 0.2) / 0.9)),
                       alpha=smoothstep((t - 0.2) / 0.5))
    blit_center(c, layer, W / 2, 300)
    caption(c, "Hülle Leder für iPhone 17", 420, t - 0.8, size=28)
    return c, {}


def s_end(t):
    """18.8-20.0: Endcard mit Wortmarke, Ausblende."""
    c = new_canvas(0.35)
    particles(c, t + T_END[0], alpha=0.5)
    e = ease_out_expo(t / 0.8)
    layer = text_layer("wiiuka", 150, WHITE, True, tracking=lerp(40, 10, e), alpha=smoothstep(t / 0.4))
    blit_center(c, layer, W / 2, H * 0.47)
    lw = int(lerp(0, 220, e))
    if lw > 0:
        blit_center(c, Image.new("RGBA", (lw, 2), GOLD + (220,)), W / 2, H * 0.47 + 110)
    caption(c, "wiiuka.de", H * 0.47 + 170, t - 0.3, size=26, hairline=False, color=GREY)
    fade = smoothstep((t - 0.62) / 0.45)
    return c, {"fade": fade}


SCENES = [
    (T_REVEAL, s_reveal), (T_HERO, s_hero), (T_MACRO1, s_macro1), (T_MACRO2, s_macro2),
    (T_CAMERA, s_camera), (T_FIT, s_fit), (T_COLORS, s_colors), (T_FINALE, s_finale), (T_END, s_end),
]
XFADES = {T_END[0]: 0.35}  # weiche Überblendungen (Zeitpunkt -> Dauer), sonst harte Schnitte


# ----------------------------------------------------------------------------
# Frame-Rendering + Post
# ----------------------------------------------------------------------------
def motion_blur_x(arr, amount):
    if amount < 3:
        return arr
    step = 4
    k = max(1, int(amount / step))
    acc = np.zeros_like(arr)
    for i in range(-k, k + 1):
        acc += np.roll(arr, i * step, axis=1)
    return acc / (2 * k + 1)


def post(canvas, fx, frame_index):
    arr = np.asarray(canvas.convert("RGB")).astype(np.float32)
    if fx.get("mblur", 0) >= 3:
        arr = motion_blur_x(arr, fx["mblur"])
    arr *= CTX["vignette"]
    # leichte Farbgradation: Schatten minimal warm anheben, Kontrast-S-Kurve
    arr = arr / 255.0
    arr = np.clip(arr, 0, 1)
    arr = arr * arr * (3 - 2 * arr) * 0.85 + arr * 0.15
    arr = arr * 255.0
    arr[..., 0] += 2.0
    arr[..., 2] -= 1.0
    g = CTX["grain"][frame_index % len(CTX["grain"])]
    shift = (frame_index * 37) % W
    arr += np.roll(g, shift, axis=1) * 4.2
    if fx.get("fade", 0) > 0:
        arr *= 1 - fx["fade"]
    return np.clip(arr, 0, 255).astype(np.uint8)


def render_time(t):
    for (start, end), fn in SCENES:
        if start <= t < end:
            canvas, fx = fn(t - start)
            xf = XFADES.get(end)
            if xf and t > end - xf:
                nxt = None
                for (s2, e2), fn2 in SCENES:
                    if s2 == end:
                        nxt = fn2(0.0)[0]
                if nxt is not None:
                    canvas = Image.blend(canvas, nxt, ease_in_out((t - (end - xf)) / xf))
            return canvas, fx
    (start, end), fn = SCENES[-1]
    return fn(end - start - 1e-3)


def render_frame(i):
    canvas, fx = render_time(i / FPS)
    return post(canvas, fx, i).tobytes()


# ----------------------------------------------------------------------------
# Sound-Design
# ----------------------------------------------------------------------------
def sfx_bank():
    from scipy.signal import butter, sosfilt, fftconvolve

    rs = np.random.RandomState(3)

    def tl(d):
        return np.arange(int(d * SR)) / SR

    def bp(x, lo, hi, order=2):
        return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)

    def lp(x, fc, order=2):
        return sosfilt(butter(order, fc, btype="low", fs=SR, output="sos"), x)

    def hp(x, fc, order=2):
        return sosfilt(butter(order, fc, btype="high", fs=SR, output="sos"), x)

    def norm(x, peak=1.0):
        m = np.abs(x).max()
        return x / m * peak if m > 0 else x

    def resample_sweep(x, r0, r1, curve=1.0):
        n = len(x)
        rate = r0 + (r1 - r0) * (np.linspace(0, 1, n) ** curve)
        pos = np.cumsum(rate)
        pos = pos[pos < n - 1]
        return np.interp(pos, np.arange(n), x)

    def reverb(x, tail=1.4, mix=0.18):
        t = tl(tail)
        ir = rs.normal(0, 1, len(t)) * np.exp(-t * 4.5)
        ir = lp(ir, 5000)
        wet = fftconvolve(x, ir)[: len(x) + len(ir)]
        out = np.zeros(len(wet))
        out[: len(x)] += x
        out += wet / (np.abs(wet).max() + 1e-9) * np.abs(x).max() * mix
        return out

    def boom(d=1.6, f0=72, f1=36, decay=3.0):
        t = tl(d)
        f = f1 + (f0 - f1) * np.exp(-t * 6)
        ph = np.cumsum(2 * np.pi * f / SR)
        x = np.sin(ph) * np.exp(-t * decay)
        x += lp(rs.normal(0, 1, len(t)), 180) * np.exp(-t * 7) * 0.5
        return norm(reverb(x, 1.2, 0.12))

    def hit(d=1.2, soft=False):
        t = tl(d)
        x = boom(d, 90 if not soft else 70, 40, 4.0)[: len(t)] * 0.9
        n = rs.normal(0, 1, len(t))
        x += bp(n, 250, 3200) * np.exp(-t * (26 if soft else 18)) * (0.35 if soft else 0.6)
        x += np.sin(2 * np.pi * 140 * t) * np.exp(-t * 30) * 0.5
        return norm(reverb(x, 1.0, 0.15))

    def whoosh(d=0.7, r0=0.5, r1=1.9, lo=300, hi=3500):
        n = rs.normal(0, 1, int(d * SR * 2))
        x = bp(n, lo, hi)
        x = resample_sweep(x, r0, r1, 1.3)[: int(d * SR)]
        t = tl(len(x) / SR)
        env = np.sin(np.pi * np.clip(t / t[-1], 0, 1)) ** 1.6
        return norm(x * env)

    def riser(d=2.0):
        n = rs.normal(0, 1, int(d * SR * 2))
        x = bp(n, 200, 4000)
        x = resample_sweep(x, 0.25, 2.2, 2.0)[: int(d * SR)]
        t = tl(len(x) / SR)
        env = (t / t[-1]) ** 2.2
        tone = np.sin(np.cumsum(2 * np.pi * (60 + 500 * (t / t[-1]) ** 2) / SR)) * env * 0.35
        x = x * env + tone
        return norm(hp(x, 120))

    def tick(d=0.12):
        t = tl(d)
        x = bp(rs.normal(0, 1, len(t)), 2500, 7000) * np.exp(-t * 120)
        x += np.sin(2 * np.pi * 2100 * t) * np.exp(-t * 90) * 0.6
        return norm(x)

    def click(d=0.16):
        t = tl(d)
        x = lp(rs.normal(0, 1, len(t)), 1400) * np.exp(-t * 110)
        x += np.sin(2 * np.pi * 320 * t) * np.exp(-t * 55) * 0.8
        return norm(reverb(x, 0.4, 0.1))

    def shimmer(d=0.7):
        t = tl(d)
        x = np.zeros(len(t))
        for f, a, dec in ((3520, 0.5, 9), (5280, 0.35, 11), (7040, 0.25, 14), (2640, 0.3, 8)):
            x += np.sin(2 * np.pi * f * t + rs.uniform(0, 6.28)) * a * np.exp(-t * dec)
        x += bp(rs.normal(0, 1, len(t)), 5000, 11000) * np.exp(-t * 16) * 0.35
        return norm(reverb(x, 0.8, 0.25))

    def swell(d=2.0):
        t = tl(d)
        env = np.sin(np.pi * np.clip(t / t[-1], 0, 1)) ** 2
        x = np.zeros(len(t))
        for f, a in ((110, 0.5), (165, 0.3), (220, 0.3), (330, 0.15)):
            x += np.sin(2 * np.pi * f * t + rs.uniform(0, 6.28)) * a
        x = lp(x, 900) * env
        return norm(reverb(x, 1.5, 0.3))

    return dict(boom=boom, hit=hit, whoosh=whoosh, riser=riser, tick=tick, click=click, shimmer=shimmer, swell=swell)


def build_audio(song_path, ffmpeg, out_wav):
    from scipy.io import wavfile

    n = int(DURATION * SR)
    bank = sfx_bank()
    mix = np.zeros((n, 2), dtype=np.float64)

    def put(x, at, gain=1.0, pan=0.0, pan_to=None):
        """Mono-Signal an Zeitpunkt at einmischen. pan -1..1, optional Pan-Fahrt."""
        i0 = int(at * SR)
        x = x[: max(0, n - i0)]
        if len(x) == 0:
            return
        if pan_to is None:
            ang = np.full(len(x), (pan + 1) / 2 * np.pi / 2)
        else:
            ang = np.linspace((pan + 1) / 2, (pan_to + 1) / 2, len(x)) * np.pi / 2
        mix[i0:i0 + len(x), 0] += x * np.cos(ang) * gain
        mix[i0:i0 + len(x), 1] += x * np.sin(ang) * gain

    # --- Events (synchron zur Timeline, Schnitte auf Downbeats) ---
    h, m1, m2, cam, fit, col, fin, end = (T_HERO[0], T_MACRO1[0], T_MACRO2[0], T_CAMERA[0],
                                          T_FIT[0], T_COLORS[0], T_FINALE[0], T_END[0])
    put(bank["shimmer"](0.9), 0.02, 0.35)
    put(bank["boom"](2.0), 0.55, 0.9)
    put(bank["riser"](2.0), h - 2.0, 0.55)
    put(bank["hit"](1.4), h, 0.85)
    put(bank["whoosh"](0.9), h + 0.4, 0.35, -0.6, 0.6)
    put(bank["hit"](1.2), m1, 0.8)
    put(bank["whoosh"](0.5, 0.6, 2.2), m1 + 0.02, 0.3, 0.3, -0.3)
    put(bank["whoosh"](0.55, 0.8, 2.4), m2 - 0.17, 0.75, -0.8, 0.8)
    put(bank["hit"](1.2, soft=True), cam, 0.7)
    put(bank["whoosh"](1.0, 0.4, 1.6), cam + 0.55, 0.35, -0.7, 0.7)
    for at in (0.95, 1.02, 1.10, 1.25):
        put(bank["shimmer"](0.6), cam + at, 0.3, (at - 1.1) * 4)
    put(bank["tick"](), cam + 2.15, 0.5, 0.15)
    put(bank["tick"](), cam + 2.65, 0.35, 0.25)
    put(bank["hit"](1.2), fit, 0.8)
    for i, at in enumerate((0.70, 0.79, 0.88)):
        put(bank["click"](), fit + at, 0.6, (-0.35, 0.35, -0.3)[i])
    put(bank["whoosh"](0.9), fit + 0.9, 0.25, -0.5, 0.5)
    put(bank["hit"](1.2, soft=True), col, 0.65)
    for k in (1, 2, 3):
        put(bank["whoosh"](0.45, 0.7, 2.0, 400, 5000), col + k * BEAT, 0.5, -0.7, 0.7)
    put(bank["whoosh"](0.6, 0.5, 1.8), col + 4 * BEAT, 0.45, 0.0, 0.0)
    put(bank["hit"](1.6), fin, 0.95)
    put(bank["swell"](2.2), fin, 0.45)
    put(bank["whoosh"](1.0), fin + 0.35, 0.3, -0.6, 0.6)
    put(bank["boom"](1.6, 60, 34, 2.2), end, 0.7)
    put(bank["shimmer"](0.9), end + 0.05, 0.25)

    # --- Song als Bett: Intro ab SONG_OFFSET, danach taktgenauer Loop, Ducking auf den Hits ---
    bed = np.zeros((n, 2))
    if song_path and os.path.exists(song_path):
        raw = subprocess.run([ffmpeg, "-loglevel", "error", "-i", song_path, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                             capture_output=True, check=True).stdout
        song = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)
        song /= (np.abs(song).max() + 1e-9)
        xf = int(0.012 * SR)
        l0, l1 = int(SONG_LOOP[0] * SR), int(SONG_LOOP[1] * SR)

        def place_seg(seg, at):
            seg = seg.copy()
            seg[:xf] *= np.linspace(0, 1, xf)[:, None]
            seg[-xf:] *= np.linspace(1, 0, xf)[:, None]
            i0 = int(at * SR)
            end_i = min(n, i0 + len(seg))
            if end_i > i0:
                bed[i0:end_i] += seg[: end_i - i0]

        place_seg(song[:l1], SONG_OFFSET)
        at = SONG_OFFSET + SONG_LOOP[1]
        while at < DURATION:
            place_seg(song[l0:l1], at - xf / SR)
            at += SONG_LOOP[1] - SONG_LOOP[0]
        t = np.arange(n) / SR
        env = np.ones(n)
        env *= np.clip((DURATION - t) / 1.6, 0, 1)
        for at in (h, m1, cam, fit, col, fin):
            d = np.clip((t - at) / 0.6, 0, 1)
            env *= np.where(t >= at, 0.55 + 0.45 * d, 1.0)
        bed *= env[:, None] * 0.55

    out = mix * 0.8 + bed
    out = np.tanh(out * 1.1) / np.tanh(1.1)
    out = out / (np.abs(out).max() + 1e-9) * 0.93
    wavfile.write(out_wav, SR, (out * 32767).astype(np.int16))


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def main():
    global FPS
    ap = argparse.ArgumentParser(description="High-End-Produktfilm rendern (9:16, 20 s)")
    ap.add_argument("--product", default="assets/images/skiin_more_cognac.png")
    ap.add_argument("--audio", default="assets/audio/song_tiktok.m4a")
    ap.add_argument("--out", default="exports/skiin_more_pro.mp4")
    ap.add_argument("--fps", type=int, default=FPS)
    ap.add_argument("--workers", type=int, default=max(1, os.cpu_count() or 1))
    ap.add_argument("--preview", action="store_true", help="Standbilder pro Szene als PNG rendern")
    ap.add_argument("--no-audio", action="store_true")
    args = ap.parse_args()
    FPS = args.fps

    import imageio_ffmpeg
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)

    if args.preview:
        init_worker(args.product)
        base = os.path.splitext(args.out)[0]
        for (start, end), fn in SCENES:
            for frac in (0.2, 0.55, 0.9):
                t = start + (end - start) * frac
                canvas, fx = render_time(t)
                Image.fromarray(post(canvas, fx, int(t * FPS))).resize((W // 3, H // 3), Image.LANCZOS).save(f"{base}_prev_{t:05.2f}.png")
                print("preview", f"{base}_prev_{t:05.2f}.png")
        return

    video_tmp = os.path.splitext(args.out)[0] + "_noaudio.mp4"
    cmd = [ffmpeg, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "17",
           "-pix_fmt", "yuv420p", "-movflags", "+faststart", video_tmp]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    n = int(DURATION * FPS)
    with Pool(args.workers, initializer=init_worker, initargs=(args.product,)) as pool:
        for i, data in enumerate(pool.imap(render_frame, range(n), chunksize=6)):
            proc.stdin.write(data)
            if i % (FPS * 2) == 0:
                print(f"frame {i}/{n}", flush=True)
    proc.stdin.close()
    proc.wait()
    if proc.returncode != 0:
        raise SystemExit("ffmpeg (video) fehlgeschlagen")

    if args.no_audio:
        os.replace(video_tmp, args.out)
        print("fertig:", args.out)
        return

    wav = os.path.splitext(args.out)[0] + "_mix.wav"
    build_audio(args.audio, ffmpeg, wav)
    subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", video_tmp, "-i", wav, "-t", str(DURATION),
                    "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", args.out], check=True)
    os.remove(video_tmp)
    os.remove(wav)
    print("fertig:", args.out)


if __name__ == "__main__":
    main()
