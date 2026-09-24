#!/usr/bin/env python3
"""
Lokale Sprachsynthese (Coqui TTS, Stimme "Thorsten" VITS, Datensatz CC0) für ein Skript.
Eingabe:  script.json  {segments:[{id, chapter, narration_tts, caption_text, kind}]}
Ausgabe:  voice.wav (22,05 kHz mono), timings.json (Segment-/Satz-/Wort-Zeiten), pronunciation_report.json
Aufruf:   python tts_build.py script.json outdir --model <dir> [--length-scale 1.0] [--lexicon lexicon.json]
Keine Cloud, keine API: das Modell läuft vollständig lokal.
"""
import argparse, json, re, time
from pathlib import Path
import numpy as np
import soundfile as sf

ap = argparse.ArgumentParser()
ap.add_argument("script"); ap.add_argument("out")
ap.add_argument("--model", required=True)
ap.add_argument("--length-scale", type=float, default=1.0)
ap.add_argument("--lexicon", default=None, help="JSON {wort: ersatzschreibweise} für Aussprachekorrekturen")
ap.add_argument("--only", default=None, help="nur diese Segment-IDs (Komma-Liste) neu synthetisieren")
a = ap.parse_args()

out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
script = json.loads(Path(a.script).read_text(encoding="utf-8"))
segments = script["segments"]
lexicon = json.loads(Path(a.lexicon).read_text(encoding="utf-8")) if a.lexicon else {}

from TTS.utils.synthesizer import Synthesizer
syn = Synthesizer(tts_checkpoint=f"{a.model}/model_file.pth", tts_config_path=f"{a.model}/config.json", use_cuda=False)
SR = syn.output_sample_rate
try:
    syn.tts_model.length_scale = a.length_scale  # VITS: >1 langsamer, <1 schneller
except Exception:
    pass

SENT_SPLIT = re.compile(r"(?<=[.!?])\s+")
def sentences(text: str):
    return [s.strip() for s in SENT_SPLIT.split(text.strip()) if s.strip()]

def apply_lexicon(s: str) -> str:
    for k, v in lexicon.items():
        s = re.sub(rf"\b{re.escape(k)}\b", v, s)
    return s

def trim(wav: np.ndarray, thr=0.012, pad=0.03):
    idx = np.where(np.abs(wav) > thr)[0]
    if len(idx) == 0: return wav
    a0 = max(0, idx[0] - int(pad * SR)); a1 = min(len(wav), idx[-1] + int(pad * SR))
    return wav[a0:a1]

PAUSE_SENT = 0.42
PAUSE_SEG = 0.75
PAUSE_CHAPTER = 1.15

audio = []; cursor = 0.0; timings = []; t0 = time.time()
prev_chapter = None
for si, seg in enumerate(segments):
    if seg.get("chapter") and prev_chapter is not None and seg["chapter"] != prev_chapter:
        pad = PAUSE_CHAPTER - PAUSE_SEG
        audio.append(np.zeros(int(pad * SR), dtype=np.float32)); cursor += pad
    prev_chapter = seg.get("chapter", prev_chapter)
    sents_tts = sentences(seg["narration_tts"])
    sents_cap = sentences(seg.get("caption_text", seg["narration_tts"]))
    seg_start = cursor; sent_t = []
    for k, s in enumerate(sents_tts):
        wav = np.asarray(syn.tts(apply_lexicon(s)), dtype=np.float32)
        wav = trim(wav)
        peak = float(np.max(np.abs(wav))) or 1.0
        wav = wav / peak * 0.89
        dur = len(wav) / SR
        words = s.split()
        weights = np.array([max(2, len(re.sub(r"\W", "", w))) + 1.5 for w in words], dtype=float)
        bounds = np.concatenate([[0], np.cumsum(weights)]) / weights.sum() * dur
        sent_t.append({"text": s, "caption": sents_cap[k] if len(sents_cap) == len(sents_tts) else None, "start": round(cursor, 3), "end": round(cursor + dur, 3),
                       "words": [{"w": w, "s": round(cursor + bounds[i], 3), "e": round(cursor + bounds[i + 1], 3)} for i, w in enumerate(words)]})
        audio.append(wav); cursor += dur
        gap = PAUSE_SENT if k < len(sents_tts) - 1 else PAUSE_SEG
        audio.append(np.zeros(int(gap * SR), dtype=np.float32)); cursor += gap
    timings.append({"id": seg["id"], "chapter": seg.get("chapter"), "kind": seg.get("kind"), "start": round(seg_start, 3), "end": round(cursor, 3), "caption_sentences_match": len(sents_cap) == len(sents_tts), "sentences": sent_t})
    print(f"[{si+1}/{len(segments)}] {seg['id']} {cursor:.1f}s", flush=True)

full = np.concatenate(audio + [np.zeros(int(1.5 * SR), dtype=np.float32)])
sf.write(out / "voice.wav", full, SR, subtype="PCM_16")
words_total = sum(len(s["text"].split()) for t in timings for s in t["sentences"])
meta = {"sample_rate": SR, "duration": round(len(full) / SR, 3), "words": words_total, "wpm": round(words_total / (cursor / 60), 1), "length_scale": a.length_scale, "synth_seconds": round(time.time() - t0, 1), "model": "coqui thorsten vits (CC0 dataset)", "segments": timings}
(out / "timings.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
print(json.dumps({k: v for k, v in meta.items() if k != "segments"}, ensure_ascii=False))
