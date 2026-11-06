import json, sys
sys.path.insert(0, "tools")
import fm_contracts as fc
from datetime import date
db = fc.load("out/game_db.dat"); players = json.load(open("out/save.json"))["players"]
import os, pickle
res, ref_to_club = fc.build(db, players, date(2025, 4, 6))
print("players with a current contract:", len(res), "of", len(players), "| clubs recovered for club-less players:",
      sum(1 for i, r in res.items() if r["club_from_parser"] is None), "| refs:", len(ref_to_club))
idx = {}
for i, p in enumerate(players): idx.setdefault(p["name"], []).append(i)
def check(path, has_age):
    gt = json.load(open(path))["players"]; ok_e = ok_w = tot = 0; bad = []
    for n, v in gt.items():
        w, e = (v[1], v[2]) if has_age else (v[0], v[1])
        cand = [i for i in idx[n] if (not has_age) or players[i]["age"] == v[0]]
        if not cand: continue
        r = res.get(cand[0]); tot += 1
        ge = bool(r and r["end"] == e); gw = (w is None) or bool(r and abs(r["wage_gbp_week"] * fc.X - w) / w < 0.03)
        ok_e += ge; ok_w += gw
        if not (ge and gw): bad.append((n, e, w, r))
    print(f"{path}: end ok {ok_e}/{tot}, wage ok {ok_w}/{tot}"); [print("   X", b) for b in bad[:6]]
check("tools/gt_aberdeen.json", False); check("tools/gt_aberdeen_u18.json", True)
rg = json.load(open("tools/gt_reservas_barca.json"))["reservas"]["players"]
ok_e = ok_w = 0
for n, (age, w, e) in rg.items():
    i = [j for j in idx[n] if players[j]["age"] == age][0]; r = res.get(i)
    ge = bool(r and r["end"] == e); gw = bool(r and abs(r["wage_gbp_week"] * fc.X - w) / w < 0.03); ok_e += ge; ok_w += gw
print(f"reservas: end ok {ok_e}/{len(rg)}, wage ok {ok_w}/{len(rg)}")
