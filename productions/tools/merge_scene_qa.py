#!/usr/bin/env python3
"""Führt Ergebnisse der Szenen-Abnahme (Workflow-Outputs) ins finale Storyboard zusammen.
   python merge_scene_qa.py <productionDir> <workflow_output.json> [...]
   Regel: Reviewer-Vorschlag (better_params_json) hat Vorrang, sonst getunte Parameter, sonst Original.
   Schreibt storyboard_final.json und scene_qa_report.json (offene Punkte)."""
import json, sys
from pathlib import Path
prod = Path(sys.argv[1]); outs = sys.argv[2:]
sb_path = prod / "storyboard_final.json" if (prod / "storyboard_final.json").exists() else prod / "storyboard.json"
sb = json.loads(sb_path.read_text(encoding="utf-8"))
by_id = {s["id"]: s for s in sb["scenes"]}
report = {"updated": [], "failed_review": [], "gaps": []}
for f in outs:
    d = json.loads(Path(f).read_text(encoding="utf-8"))
    res = d.get("result", d)
    for batch in res:
        rv = {v["scene_id"]: v for v in batch.get("review", [])}
        for t in batch.get("tuned", []):
            sid = t["scene_id"]; sc = by_id.get(sid)
            if not sc: continue
            v = rv.get(sid)
            params = t["params_json"]
            if v and not v["pass"] and v.get("better_params_json"):
                try: json.loads(v["better_params_json"]); params = v["better_params_json"]
                except Exception: pass
                report["failed_review"].append({"scene_id": sid, "problem": v["problem"]})
            try: json.loads(params)
            except Exception: continue
            sc["params_json"] = params; sc["on_screen_text"] = t.get("on_screen_text", sc["on_screen_text"]); sc["camera"] = t.get("camera") or sc["camera"]
            sc["qa"] = {"quality": t.get("quality"), "review_pass": v["pass"] if v else None}
            report["updated"].append(sid)
        report["gaps"] += batch.get("gaps", [])
(prod / "storyboard_final.json").write_text(json.dumps(sb, ensure_ascii=False, indent=1), encoding="utf-8")
(prod / "scene_qa_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
print(json.dumps({"updated": len(report["updated"]), "failed_review": len(report["failed_review"]), "gaps": len(report["gaps"])}))
