"""Contract extractor for FM24 24.3.0+0 saves. Reference: docs/03-data-dictionary.md section 6 and docs/05-validation.md.

Input : decompressed game_db.dat bytes + the parser's player list (each needs source.person and optionally clubId).
Output: build() returns ({player index: current contract}, {club ref: club id}).

How it works (all offsets from the record start `rec`):
  - A contract record is anchored on its CLUB REFERENCE, a u32 at rec+8 (one value per club). The first 4 bytes of a record are a
    date field (null date 01 00 6c 07 in most records), so that tag is NOT a reliable anchor.
  - wage u32 @rec+17 (pounds per week) ; start date @rec-19 ; squad number u8 @rec-12 (255 = none)
  - end date @rec-9-29k (k event entries of 29 bytes) preceded by ff ff ff ff ; event count u8 @end+14 must equal k-1
  - squad status code u8 @end+8
  - a player's records lie between the PREVIOUS player's person record (+250 bytes) and his own
  - current contract = latest start <= game date among records at his own or an affiliated club;
    an older record at another club with the SAME wage and end date wins (parent club of an affiliate B team)
  - club refs are mapped to clubs by voting over players the parser linked to a club (each player votes with his nearest record);
    this also gives a club to players the parser left club-less (youth squads)
  - affiliated clubs are inferred from co-occurrence (>= 5 players and >= 15% of a club's players hold a record at the other club)
chain() is the older tag-based scan, still used only for the club-reference voting.
"""
import struct
from collections import Counter
from datetime import date, timedelta
TAG = bytes.fromhex("01006c07")
X = 64.957475656354  # displayed $/year per stored weekly GBP unit (52 x 1.2492); display currency dependent
def load(path): return open(path, "rb").read()
def d_of(db, o):
    a, y = struct.unpack_from("<HH", db, o); day = a & 511
    if not (1 <= day <= 366 and 2000 <= y <= 2060): return None
    return date(y, 1, 1) + timedelta(days=day - 1)
def chain(db, lo, hi):
    out = []; i = db.find(TAG, max(0, lo), hi)
    while i != -1:
        out.append({"tag": i, "ref": struct.unpack_from("<I", db, i + 8)[0], "wage": struct.unpack_from("<I", db, i + 17)[0], "start": d_of(db, i - 19)})
        i = db.find(TAG, i + 1, hi)
    return out
def index_records(db, refset):
    """All contract-like records in the database, found by the club reference at record+8 (alignment-free).
    Record layout: [date u16 day,u16 year][u32 selector][u32 club ref][...] wage u32 @+17, start date @-19.
    Returns parallel numpy arrays sorted by position: pos, ref, wage, start_ordinal."""
    import numpy as np
    n = len(db); b8 = np.frombuffer(db, dtype=np.uint8)
    refs = np.array(sorted(refset), dtype=np.uint32); pos_all = []
    for al in range(4):
        m = (n - al) // 4
        arr = np.frombuffer(db, dtype="<u4", count=m, offset=al)
        hit = np.nonzero(np.isin(arr, refs, assume_unique=False))[0]
        pos_all.append(al + 4 * hit - 8)
    pos = np.unique(np.concatenate(pos_all)); pos = pos[(pos >= 19) & (pos < n - 24)]
    w = (b8[pos + 17].astype(np.uint32) | (b8[pos + 18].astype(np.uint32) << 8) | (b8[pos + 19].astype(np.uint32) << 16) | (b8[pos + 20].astype(np.uint32) << 24))
    day = (b8[pos - 19].astype(np.uint32) | (b8[pos - 18].astype(np.uint32) << 8)) & 511
    yr = b8[pos - 17].astype(np.uint32) | (b8[pos - 16].astype(np.uint32) << 8)
    ok = (w >= 1) & (w <= 500000) & (day >= 1) & (day <= 366) & (yr >= 2000) & (yr <= 2060)
    pos = pos[ok]
    ref = (b8[pos + 8].astype(np.uint32) | (b8[pos + 9].astype(np.uint32) << 8) | (b8[pos + 10].astype(np.uint32) << 16) | (b8[pos + 11].astype(np.uint32) << 24))
    return pos, ref, w[ok], day[ok], yr[ok]
def end_of(db, tag, start):
    for k in range(1, 81):
        p = tag - 9 - 29 * k
        if p - 8 < 0: break
        if db[p - 8:p - 4] == b"\xff" * 4:  # first team: 8x ff ; youth: ff ff ff ff 88 ff 00 00
            e = d_of(db, p)
            if e and (start is None or e >= start) and db[p + 14] + 1 == k: return e, k, p
    return None, None, None
def build(db, players, game_date, max_back=3000):
    """returns {player index in `players`: contract dict} ; players need 'source.person' and optional clubId"""
    order = sorted(range(len(players)), key=lambda i: players[i]["source"]["person"])
    lower = {}
    prev = None
    for i in order:
        po = players[i]["source"]["person"]
        lower[i] = max(po - max_back, (prev + 250) if prev is not None else 0); prev = po
    # club ref per club id: each linked player votes with his NEAREST valid chain record only (neighbours' records are noise)
    votes = {}
    for i, p in enumerate(players):
        if p.get("clubId") is None: continue
        rs = [r for r in chain(db, lower[i], p["source"]["person"] - 17) if 1 <= r["wage"] <= 500000 and r["start"]]
        if rs: votes.setdefault(p["clubId"], Counter())[rs[-1]["ref"]] += 1
    club_refs = {cid: ({r for r, n in c.items() if n >= 2} or {c.most_common(1)[0][0]}) for cid, c in votes.items()}
    best = {}
    for cid, c in votes.items():
        for r, n in c.items():
            if n >= 2 and n > best.get(r, (0, None))[0]: best[r] = (n, cid)
    ref_to_club = {r: cid for r, (n, cid) in best.items()}
    import numpy as np
    refset = set(ref_to_club)
    ipos, iref, iwage, iday, iyr = index_records(db, refset)
    # pass 1: every player's candidate records (bounded window, started by the game date)
    win = {}
    for i, p in enumerate(players):
        po = p["source"]["person"]
        a, b = np.searchsorted(ipos, lower[i]), np.searchsorted(ipos, po - 17)
        recs = []
        for t in range(a, b):
            st = date(int(iyr[t]), 1, 1) + timedelta(days=int(iday[t]) - 1)
            if st <= game_date: recs.append({"tag": int(ipos[t]), "ref": int(iref[t]), "wage": int(iwage[t]), "start": st})
        win[i] = recs
    # affiliated clubs (parent / B team): many players linked to club A also hold a record with club B
    co = Counter(); size = Counter()
    for i, p in enumerate(players):
        c = p.get("clubId")
        if c is None: continue
        size[c] += 1
        for cb in {ref_to_club[r["ref"]] for r in win[i]} - {c}: co[(c, cb)] += 1
    affiliated = {}
    for (c, cb), n in co.items():
        if n >= 5 and n >= 0.15 * size[c]: affiliated.setdefault(c, set()).add(cb)
    # pass 2: choose the current contract
    res = {}
    for i, p in enumerate(players):
        recs = win[i]; c = p.get("clubId")
        if c is not None:
            ok_clubs = {c} | affiliated.get(c, set())
            recs = [r for r in recs if ref_to_club[r["ref"]] in ok_clubs] or recs
        if not recs: continue
        r = max(recs, key=lambda r: (r["start"], r["tag"]))
        e, k, ep = end_of(db, r["tag"], r["start"])
        # an affiliate (B team) registration duplicates the parent club's contract: same wage and end date, different club ref, later start.
        # The game shows the parent contract (its squad number, e.g. Prim 26), so prefer the older record in that case.
        for x in sorted(recs, key=lambda r: (r["start"], r["tag"])):
            if x is r or x["ref"] == r["ref"] or x["wage"] != r["wage"] or x["start"] >= r["start"]: continue
            xe, xk, xep = end_of(db, x["tag"], x["start"])
            if xe is not None and xe == e:
                r, e, k, ep = x, xe, xk, xep; break
        res[i] = {"club_id": ref_to_club[r["ref"]], "club_from_parser": c, "number": db[r["tag"] - 12], "wage_gbp_week": r["wage"],
                  "start": r["start"].isoformat(), "end": e.isoformat() if e else None, "events": (k - 1) if k else None,
                  "squad_status_raw": db[ep + 8] if ep else None, "tag": r["tag"], "end_pos": ep}
    build.affiliated = affiliated
    return res, ref_to_club
