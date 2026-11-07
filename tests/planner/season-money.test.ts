import { describe, expect, it } from "vitest";
import { defaultOwnerData } from "../../src/planner/domain/ownerData.ts";
import { ageAt, baseSeason, expiryWarn, expiryYear, seasonEndYear, seasonLabel, tabs } from "../../src/planner/domain/season.ts";
import { money } from "../../src/planner/domain/money.ts";

describe("seasons", () => {
  it("rolls the season over in July", () => {
    expect(seasonEndYear("2025-04-06")).toBe(2025);
    expect(seasonEndYear("2025-06-30")).toBe(2025);
    expect(seasonEndYear("2025-07-01")).toBe(2026);
  });
  it("labels and tabs", () => {
    expect(seasonLabel(2026)).toBe("2025/26");
    expect(tabs(2025)).toEqual([2025, 2026, 2027]);
  });
  it("baseSeason honours the override", () => {
    const d = defaultOwnerData();
    expect(baseSeason(d, "2025-04-06")).toBe(2025);
    d.settings.seasonEndOverride = 2030;
    expect(baseSeason(d, "2025-04-06")).toBe(2030);
  });
  it("projects age by one per season", () => {
    expect(ageAt("2000-05-10", "2025-04-06", 0)).toBe(24);
    expect(ageAt("2000-05-10", "2025-04-06", 2)).toBe(26);
    expect(ageAt("2000-04-06", "2025-04-06", 0)).toBe(25);
  });
  it("flags contracts that end before the season", () => {
    expect(expiryYear("2026-05-31")).toBe(2026);
    expect(expiryYear(null)).toBeNull();
    expect(expiryWarn("2026-05-31", 2026)).toBe(false);
    expect(expiryWarn("2026-05-31", 2027)).toBe(true);
    expect(expiryWarn(null, 2027)).toBe(false);
  });
});

describe("money", () => {
  const s = (currency: "GBP" | "USD" | "EUR") => ({ ...defaultOwnerData().settings, currency });
  it("applies the rate and the symbol", () => {
    expect(money(30, s("USD"))).toBe("$37");
    expect(money(30, s("GBP"))).toBe("£30");
    expect(money(100, s("EUR"))).toBe("€117");
  });
  it("abbreviates thousands and millions with a decimal comma", () => {
    expect(money(25000, s("USD"))).toBe("$31K");
    expect(money(900000, s("GBP"))).toBe("£900K");
    expect(money(1500000, s("GBP"))).toBe("£1,5M");
    expect(money(12000000, s("GBP"))).toBe("£12M");
    expect(money(0, s("USD"))).toBe("$0");
  });
});
