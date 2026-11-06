// Contract extractor for FM24 24.3.0+0 saves. Port of tools/fm_contracts.py; see docs/03-data-dictionary.md section 6.
//
// A contract record is anchored on its CLUB REFERENCE, a u32 at rec+8 (one value per club). Offsets are from `rec`:
//   wage u32 @rec+17 (pounds per week); start date @rec-19; squad number u8 @rec-12 (255 = none);
//   end date @rec-9-29k (k event entries of 29 bytes) preceded by ff ff ff ff, event count u8 @end+14 == k-1;
//   squad status u8 @end+8.
// A player's records lie between the previous player's person record (+250 bytes) and his own.
// Current contract = latest start <= game date at his own or an affiliated club; an older record at another club with the
// same wage and end date wins (parent club of an affiliate B team). Club references are mapped to clubs by voting over the
// players the parser linked to a club. Affiliated clubs are inferred from co-occurrence.

export interface ContractInput { person: number; clubId: number | null }
export interface ContractRecord {
  clubId: number;
  clubFromParser: number | null;
  squadNumber: number | null;
  wageGbpWeek: number;
  start: string;
  end: string | null;
  squadStatusCode: number | null;
}

const TAG = Buffer.from("01006c07", "hex");
const MAX_WAGE = 500000;

const isoDate = (year: number, day: number) => new Date(Date.UTC(year, 0, day)).toISOString().slice(0, 10);

/** u16 day of year (low 9 bits, 1..366) + u16 year (2000..2060); null when invalid or outside the buffer. */
export function dateAt(db: Buffer, offset: number): string | null {
  if (offset < 0 || offset + 4 > db.length) return null;
  const day = db.readUInt16LE(offset) & 511;
  const year = db.readUInt16LE(offset + 2);
  if (!(day >= 1 && day <= 366 && year >= 2000 && year <= 2060)) return null;
  return isoDate(year, day);
}

/** The end date of the record at `rec`: k events of 29 bytes before it, `ff ff ff ff` marker, event count == k-1. */
export function endOf(db: Buffer, rec: number, start: string | null): { end: string; k: number; pos: number } | null {
  for (let k = 1; k <= 80; k++) {
    const p = rec - 9 - 29 * k;
    if (p - 8 < 0) break;
    if (db.readUInt32LE(p - 8) === 0xffffffff) {
      const e = dateAt(db, p);
      if (e && (start === null || e >= start) && db[p + 14] + 1 === k) return { end: e, k, pos: p };
    }
  }
  return null;
}

interface ChainRecord { tag: number; ref: number; wage: number; start: string | null }

/** Older tag-based scan (the `01 00 6c 07` null-date tag); used only for the club-reference voting. */
function chain(db: Buffer, lo: number, hi: number): ChainRecord[] {
  const out: ChainRecord[] = [];
  let i = db.indexOf(TAG, Math.max(0, lo));
  while (i !== -1 && i + 4 <= hi) {
    out.push({ tag: i, ref: db.readUInt32LE(i + 8), wage: db.readUInt32LE(i + 17), start: dateAt(db, i - 19) });
    i = db.indexOf(TAG, i + 1);
  }
  return out;
}

interface Indexed { pos: Int32Array; ref: Uint32Array; wage: Uint32Array; start: string[] }

/** Every contract-like record in the database, found by the club reference at record+8 (alignment-free). */
function indexRecords(db: Buffer, refs: Set<number>): Indexed {
  const n = db.length;
  const filter = new Uint8Array(1 << 24);
  const slot = (v: number) => Math.imul(v, 2654435761) >>> 8;
  for (const r of refs) filter[slot(r)] = 1;
  const found: number[] = [];
  for (let al = 0; al < 4; al++) {
    for (let q = al; q + 4 <= n; q += 4) {
      const v = db.readUInt32LE(q);
      if (filter[slot(v)] === 1 && refs.has(v)) found.push(q - 8);
    }
  }
  found.sort((a, b) => a - b);
  const pos: number[] = [], ref: number[] = [], wage: number[] = [], start: string[] = [];
  let last = -1;
  for (const p of found) {
    if (p === last) continue;
    last = p;
    if (p < 19 || p >= n - 24) continue;
    const w = db.readUInt32LE(p + 17);
    if (w < 1 || w > MAX_WAGE) continue;
    const s = dateAt(db, p - 19);
    if (!s) continue;
    pos.push(p); ref.push(db.readUInt32LE(p + 8)); wage.push(w); start.push(s);
  }
  return { pos: Int32Array.from(pos), ref: Uint32Array.from(ref), wage: Uint32Array.from(wage), start };
}

function lowerBound(a: Int32Array, x: number): number {
  let lo = 0, hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (a[mid] < x) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/** Current contract per player (key = index in `players`). Players without a candidate record are absent. */
export function readContracts(db: Buffer, players: ContractInput[], gameDate: string, maxBack = 3000): Map<number, ContractRecord> {
  const order = players.map((_, i) => i).sort((a, b) => players[a].person - players[b].person);
  const lower = new Array<number>(players.length);
  let prev: number | null = null;
  for (const i of order) {
    const po = players[i].person;
    lower[i] = Math.max(po - maxBack, prev !== null ? prev + 250 : 0);
    prev = po;
  }

  // club reference per club id: each linked player votes with his NEAREST valid chain record only
  const votes = new Map<number, Map<number, number>>();
  players.forEach((p, i) => {
    if (p.clubId === null) return;
    const rs = chain(db, lower[i], p.person - 17).filter((r) => r.wage >= 1 && r.wage <= MAX_WAGE && r.start);
    if (!rs.length) return;
    const m = votes.get(p.clubId) ?? new Map<number, number>();
    const ref = rs[rs.length - 1].ref;
    m.set(ref, (m.get(ref) ?? 0) + 1);
    votes.set(p.clubId, m);
  });
  const best = new Map<number, { n: number; cid: number }>();
  for (const [cid, m] of votes) {
    for (const [r, n] of m) {
      if (n >= 2 && n > (best.get(r)?.n ?? 0)) best.set(r, { n, cid });
    }
  }
  const refToClub = new Map<number, number>();
  for (const [r, v] of best) refToClub.set(r, v.cid);

  const idx = indexRecords(db, new Set(refToClub.keys()));

  // pass 1: every player's candidate records (bounded window, started by the game date)
  interface Rec { tag: number; ref: number; wage: number; start: string }
  const win: Rec[][] = new Array(players.length);
  players.forEach((p, i) => {
    const a = lowerBound(idx.pos, lower[i]);
    const b = lowerBound(idx.pos, p.person - 17);
    const recs: Rec[] = [];
    for (let t = a; t < b; t++) {
      if (idx.start[t] <= gameDate) recs.push({ tag: idx.pos[t], ref: idx.ref[t], wage: idx.wage[t], start: idx.start[t] });
    }
    win[i] = recs;
  });

  // affiliated clubs (parent / B team): many players linked to club A also hold a record with club B
  const co = new Map<string, number>();
  const size = new Map<number, number>();
  players.forEach((p, i) => {
    const c = p.clubId;
    if (c === null) return;
    size.set(c, (size.get(c) ?? 0) + 1);
    const others = new Set<number>();
    for (const r of win[i]) {
      const cb = refToClub.get(r.ref);
      if (cb !== undefined && cb !== c) others.add(cb);
    }
    for (const cb of others) co.set(`${c}:${cb}`, (co.get(`${c}:${cb}`) ?? 0) + 1);
  });
  const affiliated = new Map<number, Set<number>>();
  for (const [key, n] of co) {
    const [c, cb] = key.split(":").map(Number);
    if (n >= 5 && n >= 0.15 * (size.get(c) ?? 0)) {
      const s = affiliated.get(c) ?? new Set<number>();
      s.add(cb);
      affiliated.set(c, s);
    }
  }

  // pass 2: choose the current contract
  const cmp = (x: Rec, y: Rec) => (x.start < y.start ? -1 : x.start > y.start ? 1 : x.tag - y.tag);
  const result = new Map<number, ContractRecord>();
  players.forEach((p, i) => {
    let recs = win[i];
    const c = p.clubId;
    if (c !== null) {
      const ok = new Set<number>([c, ...(affiliated.get(c) ?? [])]);
      const filtered = recs.filter((r) => ok.has(refToClub.get(r.ref)!));
      if (filtered.length) recs = filtered;
    }
    if (!recs.length) return;
    let r = recs.reduce((a, b) => (cmp(a, b) >= 0 ? a : b));
    let e = endOf(db, r.tag, r.start);
    // an affiliate (B team) registration duplicates the parent club's contract: same wage and end date, different club
    // reference, later start. The game shows the parent contract, so prefer the older record in that case.
    for (const x of [...recs].sort(cmp)) {
      if (x === r || x.ref === r.ref || x.wage !== r.wage || x.start >= r.start) continue;
      const xe = endOf(db, x.tag, x.start);
      if (xe !== null && e !== null && xe.end === e.end) { r = x; e = xe; break; }
    }
    const number = db[r.tag - 12];
    result.set(i, {
      clubId: refToClub.get(r.ref)!,
      clubFromParser: c,
      squadNumber: number === 255 ? null : number,
      wageGbpWeek: r.wage,
      start: r.start,
      end: e ? e.end : null,
      squadStatusCode: e ? db[e.pos + 8] : null,
    });
  });
  return result;
}
