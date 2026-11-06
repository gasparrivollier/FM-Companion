"""Run the contract probe on every player and print sanity statistics (no ground truth)."""
import json, sys, time
from collections import Counter
src = open("tools/contract_probe.py").read().split('if __name__ == "__main__":')[0]
sys.argv = ["x", "out/game_db.dat", "out/save.json", "tools/gt_aberdeen.json"]
ns = {}
exec(compile(src, "contract_probe", "exec"), ns)
players = [p for p in ns["players"]["players"]] if isinstance(ns["players"], dict) else ns["players"]
ns["players"] = players
t = time.time()
refs = ns["compute_club_refs"](players); ns["club_ref"].update(refs)
print("club refs", len(refs), "in", round(time.time() - t), "s")
res = Counter(); wages = []; short = 0
GD = ns["GAME_DATE"]
for p in players:
    if p["clubId"] is None: res["no club"] += 1; continue
    r = ns["probe"](p)
    if not r: res["no current contract found"] += 1; continue
    if not r["end"]: res["contract, end not found"] += 1; continue
    from datetime import date
    e = date.fromisoformat(r["end"]); s = date.fromisoformat(r["start"])
    if e < GD: res["end already past (inconsistent)"] += 1
    elif e < s: res["end before start (inconsistent)"] += 1
    else: res["coherent"] += 1; wages.append(r["wage_gbp_week"])
print(dict(res)); wages.sort()
n = len(wages); print("coherent", n, "wage GBP/week p10/p50/p90/max:", wages[n // 10], wages[n // 2], wages[9 * n // 10], wages[-1])
