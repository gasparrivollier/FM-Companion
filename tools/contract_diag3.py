import json, sys, struct
from collections import Counter
src = open("tools/contract_probe.py").read().split('if __name__ == "__main__":')[0]
sys.argv = ["x", "out/game_db.dat", "out/save.json", "tools/gt_aberdeen.json"]
ns = {}; exec(compile(src, "cp", "exec"), ns)
players = ns["players"]["players"] if isinstance(ns["players"], dict) else ns["players"]
ns["club_ref"].update(ns["compute_club_refs"](players)); db = ns["db"]; d_of = ns["d_of"]
bad = []
for p in players:
    if p["clubId"] is None: continue
    r = ns["probe"](p)
    if r and not r["end"]: bad.append((p, r))
print("end-not-found:", len(bad))
import random; random.seed(1)
offs = Counter(); ff = Counter()
for p, r in random.sample(bad, 400):
    # find tag of the chosen record: wage+start match; recompute
    for rec in ns["records"](p["source"]["person"]):
        if rec["wage"] == r["wage_gbp_week"] and rec["start"] and rec["start"].isoformat() == r["start"]:
            t = rec["tag"]; break
    found = None
    for q in range(t - 400, t - 8):
        d = d_of(q)
        if d and d.year >= 2025 and d.year <= 2040:
            found = t - q if found is None else found  # closest above? keep first (farthest)
    # nearest valid future date before the tag
    near = [t - q for q in range(t - 400, t - 8) if (lambda d: d and 2025 <= d.year <= 2040)(d_of(q))]
    offs[tuple(sorted(set(n for n in near)))[-1] if near else None] += 1
print(offs.most_common(12))
p, r = bad[0]
print(p["name"], p["club"], r)
