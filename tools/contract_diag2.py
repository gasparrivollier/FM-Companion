import json, sys
from collections import Counter
src = open("tools/contract_probe.py").read().split('if __name__ == "__main__":')[0]
sys.argv = ["x", "out/game_db.dat", "out/save.json", "tools/gt_aberdeen.json"]
ns = {}; exec(compile(src, "cp", "exec"), ns)
players = ns["players"]["players"] if isinstance(ns["players"], dict) else ns["players"]
refs = ns["compute_club_refs"](players); ns["club_ref"].update(refs)
for nm, club in (("Thato Mokeke","Gol Gohar"),("Vladimir Semenov","Vitebsk")):
    p = next(x for x in players if x["name"] == nm and x["club"] == club)
    print("==", nm, club, "clubId", p["clubId"], "club refs", refs[p["clubId"]])
    for r in ns["records"](p["source"]["person"], 1500): print("  ", r["rel"], "team", r["team"], "wage", r["wage"], "start", r["start"])
    mates = [q for q in players if q["clubId"] == p["clubId"]][:6]
    print("   teammates' latest record refs:", [(q["name"].split()[-1], [r["team"] for r in ns["records"](q["source"]["person"],1500)][-2:]) for q in mates])
