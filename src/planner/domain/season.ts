import type { OwnerData } from "./ownerData.ts";

/** The year in which the season of `gameDate` ends (the season rolls over in July). */
export function seasonEndYear(gameDate: string): number {
  const year = Number(gameDate.slice(0, 4));
  const month = Number(gameDate.slice(5, 7));
  return month >= 7 ? year + 1 : year;
}
export function seasonLabel(endYear: number): string {
  return `${endYear - 1}/${String(endYear).slice(2)}`;
}
export function baseSeason(data: OwnerData, gameDate: string): number {
  return data.settings.seasonEndOverride ?? seasonEndYear(gameDate);
}
export function tabs(base: number): [number, number, number] {
  return [base, base + 1, base + 2];
}
/** Age on the game date plus `seasonOffset` years. */
export function ageAt(birthDate: string, gameDate: string, seasonOffset: number): number {
  const by = Number(birthDate.slice(0, 4));
  const gy = Number(gameDate.slice(0, 4));
  const before = gameDate.slice(5) < birthDate.slice(5);
  return gy - by - (before ? 1 : 0) + seasonOffset;
}
export function expiryYear(end: string | null): number | null {
  return end ? Number(end.slice(0, 4)) : null;
}
export function expiryWarn(end: string | null, seasonEnd: number): boolean {
  const y = expiryYear(end);
  return y !== null && y < seasonEnd;
}
