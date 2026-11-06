// Person-record relation table (FM24 24.3.0+0). See docs/03-data-dictionary.md section 8.
import type { HomeGrownClub, HomeGrownNation } from "../shared/snapshot.ts";

export interface RelationEntry { referencedId: number; kind: number; role: number; qualifier: number; sentinel: number }

/**
 * end = person + 19 + u32@(person+15); flag u8@end+33 must be 1; count u8@end+34;
 * 16-byte entries from end+35: u32 id @0, kind @10, role @11, qualifier @12, sentinel @15.
 */
export function readRelations(db: Buffer, personOffset: number, identityOffset?: number): RelationEntry[] | null {
  const end = personOffset + 19 + db.readUInt32LE(personOffset + 15);
  if (db[end + 33] !== 1) return null;
  const count = db[end + 34];
  if (identityOffset !== undefined && end + 35 + count * 16 > identityOffset) return null;
  const out: RelationEntry[] = [];
  for (let k = 0; k < count; k++) {
    const p = end + 35 + k * 16;
    out.push({
      referencedId: db.readUInt32LE(p), kind: db[p + 10], role: db[p + 11], qualifier: db[p + 12], sentinel: db[p + 15],
    });
  }
  return out;
}

/** Home-grown club: kind 1, role 72, club id = referenced id - 1. Home-grown nation: kind 8, role 70. */
export function homeGrownFrom(entries: RelationEntry[]): { clubs: HomeGrownClub[]; nations: HomeGrownNation[] } {
  const clubs: HomeGrownClub[] = [];
  const nations: HomeGrownNation[] = [];
  for (const e of entries) {
    if (e.kind === 1 && e.role === 72) clubs.push({ clubId: e.referencedId - 1, qualifier: e.qualifier });
    else if (e.kind === 8 && e.role === 70) nations.push({ nationOrdinal: e.referencedId, qualifier: e.qualifier });
  }
  return { clubs, nations };
}
