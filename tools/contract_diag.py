import json, sys
from collections import Counter
src = open("tools/contract_probe.py").read().split('if __name__ == "__main__":')[0]
sys.argv = ["x", "out/game_db.dat", "out/save.json", "tools/gt_aberdeen.json"]
ns = {}; exec(compile(src, "cp", "exec"), ns)
players = ns["players"]["players"] if isinstance(ns["players"], dict) else ns["players"]
ns["club_ref"].update(ns["compute_club_refs"](players))
why = Counter(); ex = {}
for p in players:
    if p["clubId"] is None: continue
    if ns["probe"](p): continue
    recs = ns["records"](p["source"]["person"], 1500)
    refs = ns["club_ref"].get(p["clubId"]) or set()
    if not recs: k = "no tag in 1500 bytes"
    elif not any(r["team"] in refs for r in recs): k = "tags exist, none with the club's team ref"
    elif not any(r["team"] in refs and 1 <= r["wage"] <= 500000 for r in recs): k = "club ref matches but wage out of range 200..500000"
    else: k = "ref+wage ok but start missing or after game date"
    why[k] += 1; ex.setdefault(k, (p["name"], p["club"], p["age"], p["ca"]))
for k, v in why.most_common(): print(v, k, ex[k])
