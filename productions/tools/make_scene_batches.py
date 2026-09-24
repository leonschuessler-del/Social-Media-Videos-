#!/usr/bin/env python3
"""Erzeugt Batch-Dateien für die Szenen-Abnahme mit exaktem Sprechertext und Wortzeiten.
   python make_scene_batches.py <productionDir> <outDir> [maxPerBatch=6] [prevBatchDir]
   Voraussetzung: out/scene_narration.json (build_video.ts --stage timeline)."""
import json, sys, glob, math
from pathlib import Path
prod = Path(sys.argv[1]); outd = Path(sys.argv[2]); outd.mkdir(parents=True, exist_ok=True)
maxn = int(sys.argv[3]) if len(sys.argv) > 3 else 6
prev_dir = sys.argv[4] if len(sys.argv) > 4 else None
sb = json.loads((prod / "storyboard_final.json").read_text(encoding="utf-8"))
narr = {n["id"]: n for n in json.loads((prod / "out/scene_narration.json").read_text(encoding="utf-8"))}
rep = json.loads((prod / "scene_qa_report.json").read_text(encoding="utf-8")) if (prod / "scene_qa_report.json").exists() else {"failed_review": []}
problems = {f["scene_id"]: f["problem"] for f in rep.get("failed_review", [])}
notes = {}
if prev_dir:
    for f in glob.glob(f"{prev_dir}/*.json"):
        for s in json.loads(Path(f).read_text(encoding="utf-8")):
            if s.get("editor_note"): notes[s["scene_id"]] = s["editor_note"]
order = [s["id"] for s in sb["scenes"]]
by_id = {s["id"]: s for s in sb["scenes"]}
def brief(sid):
    if sid not in by_id: return None
    s = by_id[sid]; n = narr.get(sid, {})
    return {"scene_id": sid, "template": s["template"], "on_screen_text": s.get("on_screen_text", ""), "narration": n.get("narration", "")}
groups = {}
for i, sid in enumerate(order):
    s = by_id[sid]; n = narr.get(sid)
    if not n: continue
    try: params = json.loads(s.get("params_json") or "{}")
    except Exception: params = {}
    item = {"scene_id": sid, "segment_id": s["segment_id"], "duration_s": n["duration"], "narration_during_scene": n["narration"],
            "word_times_s": n["words"], "params": params, "on_screen_text": s.get("on_screen_text", ""), "camera": s.get("camera", "static"),
            "description": s.get("description", ""), "previous_review_problem": problems.get(sid, ""),
            "prev_scene": brief(order[i - 1]) if i > 0 else None, "next_scene": brief(order[i + 1]) if i + 1 < len(order) else None}
    if sid in notes: item["editor_note"] = notes[sid]
    groups.setdefault(s["template"], []).append(item)
index = {}
for tpl, items in groups.items():
    k = math.ceil(len(items) / maxn); size = math.ceil(len(items) / k)
    index[tpl] = []
    for b in range(k):
        part = items[b * size:(b + 1) * size]; name = f"{tpl}_{b + 1}"
        f = outd / f"{name}.json"; f.write_text(json.dumps(part, ensure_ascii=False, indent=1), encoding="utf-8")
        index[tpl].append({"name": name, "file": str(f), "count": len(part)})
(outd / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
print(json.dumps({t: [b["count"] for b in v] for t, v in index.items()}))
