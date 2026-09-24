"""Satz-Splitter für deutsche Sprechtexte: trennt nicht nach Ordinalzahlen vor Monatsnamen ('28. Juli')
oder vor kleingeschriebenen Wörtern ('im 80. stock' kommt in Sprechtexten nicht vor, aber in Untertiteln)."""
import re
MONTHS = {"Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember", "Stock", "Stockwerk", "Stockwerks", "Jahrhundert"}
_TOKEN = re.compile(r"[.!?]\s+")

def split_sentences(text: str) -> list[str]:
    text = text.strip(); out = []; start = 0
    for m in _TOKEN.finditer(text):
        end = m.start() + 1
        before = text[start:end]; after = text[m.end():]
        nxt = after.split(" ", 1)[0].strip("„\"'(").rstrip(".,;:!?") if after else ""
        prev_is_digit = len(before) >= 2 and before[-2].isdigit()
        if prev_is_digit and (nxt in MONTHS or (nxt[:1].islower())):
            continue
        out.append(text[start:end].strip()); start = m.end()
    if text[start:].strip(): out.append(text[start:].strip())
    return out
