"""Prototype v2: contract start/end/wage for a player straight from game_db.dat (FM24 24.3.0+0).
Rule (empirical, validated on the Aberdeen sample, see docs/research/fm24-save-files.md section 12):
  - contract chain records are introduced by tag 01 00 6c 07 in the bytes before the person record
  - wage = u32 at tag+17 (GBP per week); start = date at tag-19; team ref = u32 at tag+8
  - squad number = u8 at tag-12
  - the CURRENT contract is the chain record whose team ref equals the club's ref and whose start
    is on or before the in-game date (later records are pre-agreed future contracts, e.g. renewals)
  - end = date preceded by eight 0xFF bytes at tag-9-29k, k in 1..80 (k unknown; first valid with end>=start wins)
usage: python3 -I tools/contract_probe.py out/game_db.dat out/aberdeen.json tools/gt_aberdeen.json [YYYY-MM-DD game date]"""
import json, struct, sys
from collections import Counter
from datetime import date, timedelta
db = open(sys.argv[1], "rb").read()
players = json.load(open(sys.argv[2])); gt = json.load(open(sys.argv[3]))["players"]
X = 64.957475656354
TAG = bytes.fromhex("01006c07")
GAME_DATE = date.fromisoformat(sys.argv[4]) if len(sys.argv) > 4 else date(2025, 4, 6)
def d_of(raw):
    a, y = struct.unpack_from("<HH", db, raw)
    day = a & 511
    if not (1 <= day <= 366 and 2000 <= y <= 2060): return None
    return date(y, 1, 1) + timedelta(days=day - 1)
def records(po, span=3000):
    out = []
    i = db.find(TAG, max(0, po - span), po - 17)
    while i != -1:
        wage = struct.unpack_from("<I", db, i + 17)[0]
        out.append({"tag": i, "rel": i - po, "team": struct.unpack_from("<I", db, i + 8)[0], "wage": wage, "start": d_of(i - 19)})
        i = db.find(TAG, i + 1, po - 17)
    return out
def end_of(tag, start=None):
    for k in range(1, 81):
        p = tag - 9 - 29 * k
        if p - 8 >= 0 and db[p - 8:p] == b"\xff" * 8:
            e = d_of(p)
            # the record stores its own event count at end+14 (count + 1 == k, 33/33 on Aberdeen)
            if e and (start is None or e >= start) and p + 14 < len(db) and db[p + 14] + 1 == k: return e, k
    return None, None
def compute_club_refs(players):
    """club ref = most common team ref among wage-bearing chain records of the club's players"""
    groups = {}
    for p in players:
        if p["clubId"] is not None: groups.setdefault(p["clubId"], []).append(p)
    refs = {}
    for cid, ps in groups.items():
        c = Counter()
        for p in ps:
            for r in records(p["source"]["person"]):
                if 1 <= r["wage"] <= 500000 and r["start"]: c[r["team"]] += 1
        # a club has several teams (first team, reserves, youth), each with its own ref: keep every
        # ref seen at least twice, or the single most common one for tiny clubs
        keep = {r for r, n in c.items() if n >= 2} or ({c.most_common(1)[0][0]} if c else set())
        refs[cid] = keep
    return refs
club_ref = {}
def probe(p):
    refs = club_ref.get(p["clubId"]) or set(); cands = [r for r in records(p["source"]["person"]) if r["team"] in refs and 1 <= r["wage"] <= 500000]
    if not cands: return None
    started = [r for r in cands if r["start"] and r["start"] <= GAME_DATE]
    if not started: return None
    r = max(started, key=lambda r: (r["start"], r["tag"]))  # latest contract already in force
    e, k = end_of(r["tag"], r["start"])
    num = db[r["tag"] - 12]  # squad number: u8 at tag-12 (20/20 verified on Aberdeen's selected squad)
    status = db[r["tag"] - 9 - 29 * k + 8] if k else None  # raw squad-status code at end+8 (4 = "Jugador de plantilla", 1 data point)
    return {"number": num, "squad_status_raw": status, "start": r["start"].isoformat() if r["start"] else None, "end": e.isoformat() if e else None, "wage_gbp_week": r["wage"], "k": k}
if __name__ == "__main__":
    club_ref.update(compute_club_refs([p for p in players if p["clubId"] in (1122, 3972)]))
    print("club refs:", {c: v for c, v in club_ref.items()})
    oe = ow = tot = 0
    for p in players:
        if p["name"] not in gt or p["clubId"] != 1122: continue
        w, e = gt[p["name"]]; r = probe(p); tot += 1
        ge = bool(r and r["end"] == e); gw = bool(r and w and abs(r["wage_gbp_week"] * X - w) / w < 0.004)
        oe += ge; ow += gw
        print(f"{p['name']:32s} truth {e} {w} -> {r} {'END-OK' if ge else 'end-X'} {'WAGE-OK' if (gw or w is None) else 'wage-X'}")
    print(f"end correct {oe}/{tot}, wage correct {ow}/{tot} (wage unknown for 1)")
