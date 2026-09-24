#!/usr/bin/env python3
"""Aussprache-QA ohne Anhören: listet Wörter, die gruut (Phonemizer des Thorsten-Modells) nicht im Lexikon hat
(geratene Aussprache) und markiert verdächtige Muster. Ausgabe: JSON mit Kandidaten für lexicon.json."""
import json, re, sys
from gruut import sentences
text = " ".join(s["narration_tts"] for s in json.load(open(sys.argv[1], encoding="utf-8"))["segments"])
seen = {}
for sent in sentences(text, lang="de-de"):
    for w in sent:
        if not w.is_spoken: continue
        key = w.text
        if key in seen: continue
        ph = "".join(w.phonemes or [])
        guessed = bool(getattr(w, "is_guessed", False))
        flags = []
        if guessed: flags.append("guessed")
        if re.search(r"[A-Z]{2,}", key): flags.append("acronym")
        if re.search(r"\d", key): flags.append("digit")
        if re.search(r"[a-z]*(th|sh|ch)[a-z]*", key.lower()) and guessed: flags.append("foreign?")
        seen[key] = {"phonemes": ph, "flags": flags}
flagged = {k: v for k, v in seen.items() if v["flags"]}
print(json.dumps({"unique_words": len(seen), "flagged": flagged}, ensure_ascii=False, indent=1))
