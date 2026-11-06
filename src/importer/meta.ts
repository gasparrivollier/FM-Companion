// Save metadata: format version gate, in-game date, managed team.
export const SUPPORTED_BUILD = "24.3.0+0";

export function checkFormatVersion(v: string): { ok: boolean; warning?: string } {
  if (v === SUPPORTED_BUILD) return { ok: true };
  if (/^24\./.test(v)) {
    return { ok: true, warning: `Save format ${v} differs from the supported build ${SUPPORTED_BUILD}; offsets may have moved.` };
  }
  return { ok: false };
}

/** u16 at 36 (& 511 = day of year, 1-based) and u16 at 38 (year) of game_db.dat. */
export function gameDateFromDb(db: Buffer): string {
  const day = db.readUInt16LE(36) & 511;
  const year = db.readUInt16LE(38);
  return new Date(Date.UTC(year, 0, day)).toISOString().slice(0, 10);
}

/** tactics_man.dat header: manager person id u32 at 11, managed team value u32 at 19. */
export function managedTeamFromTactics(t: Buffer): { teamValue: number; managerPersonId: number } {
  return { teamValue: t.readUInt32LE(19), managerPersonId: t.readUInt32LE(11) };
}
