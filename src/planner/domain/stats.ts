import type { Settings, Slot } from "./ownerData.ts";
import { money } from "./money.ts";
import { GCOL, GLIST, GROUP, type Group } from "./positions.ts";
import { ageAt } from "./season.ts";
import type { PlannerPlayer } from "./squad.ts";

export interface ChartRow { label: Group; color: string; w: string; val: string }
export interface Chart { title: string; total: string; rows: ChartRow[] }

const dec = (v: string) => v.replace(".", ",");

function itemsFor(players: PlannerPlayer[], slots: Slot[], scope: "squad" | "xi"): { g: Group; p: PlannerPlayer }[] {
  const byUid = new Map(players.map((p) => [p.uid, p]));
  if (scope === "xi") {
    return slots.flatMap((s) => {
      const p = s.uid !== null ? byUid.get(s.uid) : undefined;
      return p ? [{ g: GROUP[s.code], p }] : [];
    });
  }
  return players.filter((p) => p.natural.length).map((p) => ({ g: GROUP[p.natural[0]], p }));
}

/** The three bar charts (prototype lines 1213-1228): count, weekly wages and average age by position group. */
export function chartsFor(
  players: PlannerPlayer[], slots: Slot[], scope: "squad" | "xi", seasonOffset: number, gameDate: string,
  settings: Pick<Settings, "currency" | "usdPerGbp" | "eurPerGbp">,
): Chart[] {
  const stat = GLIST.map((g) => ({ g, n: 0, wage: 0, age: 0 }));
  for (const { g, p } of itemsFor(players, slots, scope)) {
    const t = stat[GLIST.indexOf(g)];
    t.n++;
    t.wage += p.contract?.wageGbpWeek ?? 0;
    t.age += ageAt(p.birthDate, gameDate, seasonOffset);
  }
  const maxN = Math.max(1, ...stat.map((t) => t.n));
  const maxW = Math.max(1, ...stat.map((t) => t.wage));
  const totN = stat.reduce((a, t) => a + t.n, 0);
  const totW = stat.reduce((a, t) => a + t.wage, 0);
  const totA = stat.reduce((a, t) => a + t.age, 0);
  return [
    { title: "Jugadores", total: String(totN), rows: stat.map((t) => ({ label: t.g, color: GCOL[t.g], w: ((t.n / maxN) * 100).toFixed(1), val: String(t.n) })) },
    { title: "Sueldos / sem.", total: money(totW, settings), rows: stat.map((t) => ({ label: t.g, color: GCOL[t.g], w: ((t.wage / maxW) * 100).toFixed(1), val: money(t.wage, settings) })) },
    {
      title: "Edad promedio", total: totN ? dec((totA / totN).toFixed(1)) : "–",
      rows: stat.map((t) => {
        const a = t.n ? t.age / t.n : 0;
        return { label: t.g, color: GCOL[t.g], w: ((a / 36) * 100).toFixed(1), val: t.n ? dec(a.toFixed(1)) : "–" };
      }),
    },
  ];
}

export function xiTotals(
  players: PlannerPlayer[], slots: Slot[], seasonOffset: number, gameDate: string,
  settings: Pick<Settings, "currency" | "usdPerGbp" | "eurPerGbp">,
): { filled: number; age: string; wage: string; ca: string } {
  const xi = itemsFor(players, slots, "xi").map((i) => i.p);
  const n = xi.length;
  return {
    filled: n,
    age: n ? dec((xi.reduce((a, p) => a + ageAt(p.birthDate, gameDate, seasonOffset), 0) / n).toFixed(1)) : "–",
    wage: money(xi.reduce((a, p) => a + (p.contract?.wageGbpWeek ?? 0), 0), settings),
    ca: n ? String(Math.round(xi.reduce((a, p) => a + p.ca, 0) / n)) : "–",
  };
}

/**
 * Canteranos, approximate (spec section 7): first-team players trained at the club (relation 1,72) and trained in the club's
 * nation (relation 8,70). The game's exact rule is not reproduced yet.
 */
export function kpis(players: PlannerPlayer[], club: { id: number; nationOrdinal: number }): { total: number; local: number; of: number; approximate: true } {
  const first = players.filter((p) => p.squad === "first" && !p.hidden);
  return {
    total: first.filter((p) => p.snap.homeGrownClubs.some((h) => h.clubId === club.id)).length,
    local: first.filter((p) => p.snap.homeGrownNations.some((h) => h.nationOrdinal === club.nationOrdinal)).length,
    of: first.length,
    approximate: true,
  };
}

const STATUS: Record<number, string> = {
  2: "Jugador importante", 3: "Titular habitual", 4: "Jugador de plantilla", 5: "Revulsivo desde el banquillo",
  11: "Futura promesa", 13: "Joven", 21: "Recambio de emergencia",
};
/** Only the seven codes labelled in docs/04; anything else shows nothing rather than a guess. */
export function statusLabel(code: number | null): string | null {
  return code !== null && code in STATUS ? STATUS[code] : null;
}
