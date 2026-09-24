#!/usr/bin/env python3
"""
Selbst erzeugte Filmmusik und Soundeffekte (numpy/scipy), rechtefrei (eigene Erzeugung, kein Content-ID-Risiko).
  python audio_synth.py sfx <outdir>                  -> whoosh.wav, impact.wav, … + license.json
  python audio_synth.py music <plan.json> <out.wav>   -> Stereo-Musikbett nach Kapitel-Stimmungen
plan.json: {"duration": s, "sections": [{"start": s, "end": s, "mood": "tension|wonder|drive|resolve|calm"}], "hits": [s…], "risers": [s…]}
"""
import json, sys
from pathlib import Path
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt

SR = 48000
RNG = np.random.default_rng(7)

def note(n):  # MIDI -> Hz
    return 440.0 * 2 ** ((n - 69) / 12)

def env_adsr(n, a, r, sr=SR):
    e = np.ones(n, dtype=np.float32)
    na, nr = min(n, int(a * sr)), min(n, int(r * sr))
    if na: e[:na] = np.linspace(0, 1, na) ** 1.5
    if nr: e[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e

def lp(x, cutoff, order=2):
    sos = butter(order, cutoff / (SR / 2), btype="low", output="sos"); return sosfilt(sos, x, axis=0)
def hp(x, cutoff, order=2):
    sos = butter(order, cutoff / (SR / 2), btype="high", output="sos"); return sosfilt(sos, x, axis=0)
def bp(x, lo, hi, order=2):
    sos = butter(order, [lo / (SR / 2), hi / (SR / 2)], btype="band", output="sos"); return sosfilt(sos, x, axis=0)

def reverb_ir(seconds=3.2, damp=5500, stereo=True):
    n = int(seconds * SR); t = np.arange(n) / SR
    chans = []
    for c in range(2 if stereo else 1):
        noise = RNG.standard_normal(n) * np.exp(-t * 6.9 / seconds)
        noise = lp(noise, damp)
        noise[: int(0.018 * SR)] = 0
        chans.append(noise / np.sqrt(np.sum(noise ** 2)))
    return np.stack(chans, axis=1)

def apply_reverb(x, mix=0.35, seconds=3.2):
    ir = reverb_ir(seconds)
    wet = np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], axis=1)
    return (1 - mix) * x + mix * wet * 0.9

def soft_clip(x, drive=1.0):
    return np.tanh(x * drive) / np.tanh(drive)

def stereo(mono, width=0.0):
    return np.stack([mono * (1 - width), mono * (1 + width)], axis=1)

# ---------------------------------------------------------------- SFX
def sfx_whoosh(d=1.1):
    n = int(d * SR); t = np.arange(n) / SR
    noise = RNG.standard_normal(n)
    out = np.zeros(n)
    for lo, hi, a in [(300, 900, 0.5), (900, 2500, 0.7), (2500, 6000, 0.35)]:
        out += bp(noise, lo, hi) * a
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2.2
    pan = np.linspace(-0.6, 0.6, n)
    return np.stack([out * e * (1 - pan), out * e * (1 + pan)], axis=1) * 0.5

def sfx_impact(d=2.5):
    n = int(d * SR); t = np.arange(n) / SR
    f = 52 + 70 * np.exp(-t * 18)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.6)
    crack = lp(RNG.standard_normal(n), 2200) * np.exp(-t * 22) * 0.5
    x = stereo(soft_clip(boom * 1.4 + crack, 1.6))
    return apply_reverb(x, 0.3, 2.4) * 0.8

def sfx_rope_snap(d=1.4):
    n = int(d * SR); t = np.arange(n) / SR
    crack = hp(RNG.standard_normal(n), 1800) * np.exp(-t * 60)
    twang_f = 180 * np.exp(-t * 1.5) + 60
    twang = np.sin(2 * np.pi * np.cumsum(twang_f) / SR) * np.exp(-t * 3.2) * 0.6
    whip = bp(RNG.standard_normal(n), 800, 3000) * np.exp(-((t - 0.12) ** 2) / 0.004) * 0.5
    return apply_reverb(stereo(crack * 1.2 + twang + whip, 0.1), 0.25, 1.6) * 0.8

def sfx_metal_creak(d=2.2):
    n = int(d * SR); t = np.arange(n) / SR
    base = 95 + 25 * np.sin(2 * np.pi * 0.7 * t) + 10 * np.sin(2 * np.pi * 3.1 * t)
    ph = 2 * np.pi * np.cumsum(base) / SR
    mod = np.sin(ph * 3.07) * 2.4
    x = np.sin(ph + mod) * (0.6 + 0.4 * np.sin(2 * np.pi * 11 * t) ** 2)
    x = bp(x, 150, 2500) * env_adsr(n, 0.3, 0.8)
    return apply_reverb(stereo(x * 0.7, 0.05), 0.35, 2.0)

def sfx_ratchet(d=1.2, rate=18):
    n = int(d * SR); out = np.zeros(n)
    click = hp(RNG.standard_normal(int(0.012 * SR)), 2500) * np.exp(-np.arange(int(0.012 * SR)) / SR * 400)
    for k in range(int(d * rate)):
        i = int(k / rate * SR)
        if i + len(click) < n: out[i:i + len(click)] += click * (0.6 + 0.4 * (k % 2))
    return apply_reverb(stereo(out * 0.6), 0.2, 0.9)

def sfx_sparks(d=2.0):
    n = int(d * SR); t = np.arange(n) / SR
    screech = bp(RNG.standard_normal(n), 3000, 9000) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 23 * t)))
    tone = np.sin(2 * np.pi * (2300 + 300 * np.sin(2 * np.pi * 4 * t)) * t) * 0.15
    crackle = np.zeros(n); idx = RNG.integers(0, n - 200, 220)
    for i in idx: crackle[i:i + 120] += hp(RNG.standard_normal(120), 4000) * 0.8
    e = env_adsr(n, 0.05, 0.9)
    return apply_reverb(stereo((screech * 0.5 + tone + crackle * 0.4) * e, 0.15), 0.2, 1.2) * 0.6

def sfx_hiss(d=1.8):
    n = int(d * SR); t = np.arange(n) / SR
    x = bp(RNG.standard_normal(n), 1500, 7000) * env_adsr(n, 0.08, 1.2) * (1 - 0.3 * t / d)
    return stereo(x * 0.45, 0.1)

def sfx_click(d=0.25):
    n = int(d * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 90) + hp(RNG.standard_normal(n), 3000) * np.exp(-t * 200) * 0.3
    return stereo(x * 0.5)

def sfx_rumble(d=3.0):
    n = int(d * SR)
    x = lp(RNG.standard_normal(n), 120, 4) * 3.0 * env_adsr(n, 0.6, 1.2)
    return stereo(soft_clip(x, 1.2) * 0.7, 0.1)

def sfx_riser(d=2.6):
    n = int(d * SR); t = np.arange(n) / SR; p = t / d
    noise = RNG.standard_normal(n); out = np.zeros(n)
    for k in range(8):  # stückweise ansteigender Bandpass
        a, b = int(k * n / 8), int((k + 1) * n / 8)
        lo = 300 + 3000 * (k / 8); out[a:b] = bp(noise, lo, lo * 2.2)[a:b]
    f = 180 + 700 * p ** 2
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    e = p ** 2.2
    return apply_reverb(stereo((out * 0.5 + tone) * e, 0.2), 0.3, 1.8) * 0.7

SFX = {"whoosh": sfx_whoosh, "impact": sfx_impact, "rope_snap": sfx_rope_snap, "metal_creak": sfx_metal_creak, "ratchet": sfx_ratchet,
       "sparks_screech": sfx_sparks, "hydraulic_hiss": sfx_hiss, "click": sfx_click, "rumble": sfx_rumble, "riser": sfx_riser}

def write(path, x):
    import soundfile as sf
    peak = np.max(np.abs(x)) or 1; x = x / peak * min(peak, 0.95)
    sf.write(path, x.astype(np.float32), SR, subtype="PCM_24")

# ---------------------------------------------------------------- MUSIK
MOODS = {
    # (Akkorde als MIDI-Grundtöne + Intervalle), Sekunden pro Akkord, Arpeggio-Dichte, Puls
    "tension": ([(50, [0, 3, 7, 14]), (46, [0, 4, 7, 11]), (43, [0, 3, 7, 10]), (45, [0, 5, 7, 12])], 8.0, 0.0, 0.55),
    "wonder":  ([(50, [0, 3, 7, 10, 14]), (53, [0, 4, 7, 14]), (48, [0, 4, 7, 11]), (46, [0, 4, 7, 14])], 8.0, 0.45, 0.0),
    "drive":   ([(50, [0, 3, 7, 12]), (46, [0, 4, 7, 12]), (53, [0, 4, 7, 12]), (48, [0, 4, 7, 12])], 4.0, 1.0, 1.0),
    "resolve": ([(53, [0, 4, 7, 11, 14]), (48, [0, 4, 7, 14]), (50, [0, 3, 7, 10]), (46, [0, 4, 7, 11])], 8.0, 0.5, 0.3),
    "calm":    ([(50, [0, 3, 7, 10, 14])], 16.0, 0.2, 0.0),
}
BPM = 96

def pad_tone(freq, n, detune=0.004):
    t = np.arange(n) / SR; out = np.zeros(n)
    for d in (-detune, 0, detune):
        f = freq * (1 + d)
        for h in range(1, 7):
            out += np.sin(2 * np.pi * f * h * t + h * 0.7) / (h ** 1.35)
    return out / 3

def render_music(plan):
    dur = float(plan["duration"]); n = int(dur * SR)
    L = np.zeros(n); R = np.zeros(n)
    for sec in plan["sections"]:
        a, b = float(sec["start"]), float(sec["end"]); mood = sec.get("mood", "wonder")
        chords, cdur, arp, pulse = MOODS.get(mood, MOODS["wonder"])
        t = a; ci = 0
        while t < b:
            root, ints = chords[ci % len(chords)]; ci += 1
            seg = min(cdur, b - t) + 2.0  # Überlappung für weichen Übergang
            i0 = int(t * SR); m = min(int(seg * SR), n - i0)
            if m <= 0: break
            e = env_adsr(m, 1.6, 2.0)
            chord = sum(pad_tone(note(root + iv), m) * (0.9 if iv < 12 else 0.55) for iv in ints) / len(ints)
            chord = lp(chord, 2400 if mood != "tension" else 1500)
            sub = np.sin(2 * np.pi * note(root - 12) * np.arange(m) / SR) * 0.12
            L[i0:i0 + m] += (chord * 0.9 + sub) * e; R[i0:i0 + m] += (chord * 1.0 + sub) * e
            # Arpeggio (weiche Plucks)
            if arp > 0:
                step = 60 / BPM / 2; k = 0; tt = 0.0
                seq = [root + 12 + iv for iv in ints] + [root + 24 + ints[1 % len(ints)]]
                while tt < seg - 2.0:
                    if (k % 4 != 3) or arp >= 1.0:
                        j = int((t + tt) * SR); ln = int(0.6 * SR)
                        if j + ln < n:
                            tn = np.arange(ln) / SR; f = note(seq[k % len(seq)])
                            pl = (np.sin(2 * np.pi * f * tn) + 0.3 * np.sin(4 * np.pi * f * tn)) * np.exp(-tn * 6) * 0.18 * arp
                            pan = 0.35 * np.sin(k * 0.9)
                            L[j:j + ln] += pl * (1 - pan); R[j:j + ln] += pl * (1 + pan)
                    k += 1; tt += step
            # Puls (tiefer, weicher Herzschlag / Beat)
            if pulse > 0:
                beat = 60 / BPM * (2 if mood == "tension" else 1); tt = 0.0
                while tt < seg - 2.0:
                    j = int((t + tt) * SR); ln = int(0.25 * SR)
                    if j + ln < n:
                        tn = np.arange(ln) / SR; f = 48 + 60 * np.exp(-tn * 30)
                        th = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tn * 14) * 0.22 * pulse
                        L[j:j + ln] += th; R[j:j + ln] += th
                    tt += beat
            t += cdur
    x = np.stack([L, R], axis=1)
    x = apply_reverb(x, 0.38, 3.6)
    # Mix-EQ: Tiefbass begrenzen (kein Dröhnen auf Laptop-Lautsprechern), Stimmfrequenzen 1-4 kHz aussparen
    x = hp(x, 55, 4)
    x = x - 0.3 * bp(x, 180, 380)
    x = x - 0.45 * bp(x, 1000, 4000)
    for tr in plan.get("risers", []):
        r = sfx_riser(2.6); j = int((tr - 2.6) * SR)
        if j >= 0 and j + len(r) < n: x[j:j + len(r)] += r * 0.55
    for th in plan.get("hits", []):
        h = sfx_impact(2.5); j = int(th * SR)
        if 0 <= j and j + len(h) < n: x[j:j + len(h)] += h * 0.6
    x = hp(x, 45, 4)  # auch Hits/Riser ohne unhörbaren Tiefstbass
    # sanftes Ein-/Ausblenden
    fi, fo = int(2 * SR), int(4 * SR); x[:fi] *= np.linspace(0, 1, fi)[:, None]; x[-fo:] *= np.linspace(1, 0, fo)[:, None]
    x = soft_clip(x / (np.max(np.abs(x)) or 1) * 0.9, 1.1) * 0.8
    return x

if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "sfx":
        out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True); lic = {"tracks": {}}
        for name, fn in SFX.items():
            write(out / f"{name}.wav", fn()); lic["tracks"][f"{name}.wav"] = {"title": name, "tags": name.split("_"), "license": "own-generated (procedural synthesis, audio_synth.py)", "attributionRequired": False, "source": "Visual Science"}
        (out / "license.json").write_text(json.dumps(lic, indent=1))
        print("sfx:", ", ".join(SFX))
    elif cmd == "music":
        plan = json.loads(Path(sys.argv[2]).read_text()); x = render_music(plan); write(sys.argv[3], x); print("music ok", round(len(x) / SR, 1), "s")
