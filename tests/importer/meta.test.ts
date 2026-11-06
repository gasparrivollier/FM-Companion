import { describe, expect, it } from "vitest";
import { SUPPORTED_BUILD, checkFormatVersion, gameDateFromDb, managedTeamFromTactics } from "../../src/importer/meta.ts";

describe("checkFormatVersion", () => {
  it("accepts the supported build without a warning", () => {
    expect(SUPPORTED_BUILD).toBe("24.3.0+0");
    expect(checkFormatVersion("24.3.0+0")).toEqual({ ok: true });
  });
  it("accepts another FM24 build with a warning naming it", () => {
    const r = checkFormatVersion("24.4.1+0");
    expect(r.ok).toBe(true);
    expect(r.warning).toContain("24.4.1+0");
  });
  it("rejects FM23 saves", () => {
    expect(checkFormatVersion("23.4.0+0").ok).toBe(false);
  });
  it("rejects garbage", () => {
    expect(checkFormatVersion("garbage").ok).toBe(false);
  });
});

describe("gameDateFromDb", () => {
  it("reads day of year and year at offsets 36 and 38", () => {
    const db = Buffer.alloc(40);
    db.writeUInt16LE(96, 36);
    db.writeUInt16LE(2025, 38);
    expect(gameDateFromDb(db)).toBe("2025-04-06");
  });
  it("ignores the high bits of the day field", () => {
    const db = Buffer.alloc(40);
    db.writeUInt16LE(96 | 0x1000, 36);
    db.writeUInt16LE(2025, 38);
    expect(gameDateFromDb(db)).toBe("2025-04-06");
  });
});

describe("managedTeamFromTactics", () => {
  it("reads the managed team value and the manager person id", () => {
    const t = Buffer.alloc(29);
    t.writeUInt32LE(392082, 11);
    t.writeUInt32LE(1310, 19);
    expect(managedTeamFromTactics(t)).toEqual({ teamValue: 1310, managerPersonId: 392082 });
  });
});
