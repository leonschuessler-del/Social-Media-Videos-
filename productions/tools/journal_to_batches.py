#!/usr/bin/env python3
"""Liest Workflow-Journale (auch laufender Workflows) und schreibt die bisher fertigen Szenen-Ergebnisse
   im Format von merge_scene_qa.py: python journal_to_batches.py out.json journal.jsonl [...]"""
import json, sys, re
out = sys.argv[1]; batches = []
for jf in sys.argv[2:]:
    labels, res = {}, {}
    for l in open(jf, encoding="utf-8"):
        j = json.loads(l)
        if j.get("type") == "started": labels[j["key"]] = j.get("label", "")
        elif j.get("type") == "result": res[j["key"]] = j.get("result")
    by_label = {labels.get(k, ""): v for k, v in res.items()}
    fixes = []
    for lab, v in by_label.items():
        if lab.startswith("tune:") and isinstance(v, dict):
            b = lab[5:]; rv = by_label.get(f"review:{b}")
            batches.append({"batch": b, "template": re.sub(r"_\d+$", "", b), "tuned": v.get("scenes", []), "gaps": v.get("template_gaps", []),
                            "review": (rv or {}).get("verdicts", []) if isinstance(rv, dict) else []})
        elif lab.startswith("fix:") and isinstance(v, dict):
            fixes.append({"batch": f"{lab[4:]}_fix", "template": lab[4:], "tuned": v.get("scenes", []), "gaps": v.get("template_gaps", []), "review": []})
    batches += fixes
json.dump({"result": batches}, open(out, "w", encoding="utf-8"), ensure_ascii=False)
print(json.dumps({b["batch"]: [len(b["tuned"]), sum(1 for r in b["review"] if not r["pass"])] for b in batches}))
