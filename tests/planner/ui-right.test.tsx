// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { defaultOwnerData } from "../../src/planner/domain/ownerData.ts";
import { openApp, planWith, snapshotWith } from "../helpers/ui.tsx";
import { snapPlayer } from "../helpers/planner.ts";

afterEach(cleanup);

const contract = (wageGbpWeek: number, end: string | null, extra: object = {}) => ({ clubId: 1, wageGbpWeek, start: "2024-07-01", end, squadNumber: null, squadStatusCode: null, ...extra });
const first = () => [
  snapPlayer(1, { GK: 20 }, { contract: contract(1000, "2026-05-31") }),
  snapPlayer(2, { DC: 20 }, { contract: contract(3000, "2028-05-31", { squadStatusCode: 4, squadNumber: 5 }) }),
  snapPlayer(3, { DC: 20 }, { contract: contract(2000, "2026-05-31", { squadStatusCode: 7 }) }),
  snapPlayer(4, { DR: 20 }, { contract: null }),
  snapPlayer(5, { ST: 20, AMC: 16 }, { contract: contract(500, "2027-05-31") }),
];
const squads = () => ({ first: first(), reserves: [snapPlayer(6, { DC: 20 })], u18: [snapPlayer(7, { DC: 20 })] });
const slot = (name: RegExp) => screen.getByRole("button", { name });

describe("slot editor", () => {
  it("shows the roles of the position and the four bands", async () => {
    await openApp(snapshotWith(squads()));
    fireEvent.click(slot(/^Puesto DFCI/));
    const roles = screen.getByRole("group", { name: "Rol del puesto" });
    expect(within(roles).getByRole("button", { name: "Líbero" })).toBeTruthy();
    const depth = screen.getByRole("group", { name: "Profundidad del puesto" });
    const counts = within(depth).getAllByRole("button").map((b) => b.textContent).filter((t) => /(Titular|Suplentes|Recambios|Otros)/.test(t ?? ""));
    expect(counts).toEqual(["Titular 0/1", "Suplentes 0/2", "Recambios / juveniles 0/3", "Otros 0"]);
  });
  it("lists naturals and covers first, then everything on demand, and youth squads only when asked", async () => {
    await openApp(snapshotWith(squads()));
    fireEvent.click(slot(/^Puesto DFCI/));
    expect(screen.getByText(/DFCI · 2 disponibles/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar todas las posiciones" }));
    expect(screen.getByText(/DFCI · 5 disponibles/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Solo naturales y que cubren" }));
    fireEvent.click(screen.getByRole("button", { name: "Mostrar Reservas y Sub-18" }));
    expect(screen.getByText(/DFCI · 4 disponibles/)).toBeTruthy();
  });
  it("picking a candidate makes him the titular and moves on to the next empty slot", async () => {
    await openApp(snapshotWith(squads()));
    fireEvent.click(slot(/^Puesto DFCI/));
    fireEvent.click(screen.getByRole("button", { name: "Poner a P2 como titular de DFCI" }));
    expect(slot(/^Puesto DFCI, P2, natural/)).toBeTruthy();
    expect(screen.getByRole("group", { name: "Profundidad del puesto" })).toBeTruthy();
  });
  it("disables the pick button when the band is full", async () => {
    const d = planWith((s) => { s[2].alt = [2, 3]; });
    await openApp(snapshotWith(squads()), d);
    fireEvent.click(slot(/^Puesto DFCI/));
    fireEvent.click(screen.getByRole("button", { name: /^Suplentes/ }));
    fireEvent.click(screen.getByRole("button", { name: "Mostrar todas las posiciones" }));
    const pick = screen.getByRole("button", { name: "Poner a P5 como suplente de DFCI" }) as HTMLButtonElement;
    expect(pick.disabled).toBe(true);
    expect(pick.textContent).toBe("Completa");
  });
  it("shows a player who left in the bands and the detail, and cannot pick him", async () => {
    const d = planWith((s) => { s[2].uid = 99; });
    d.known[99] = { name: "Ghost" };
    await openApp(snapshotWith(squads()), d);
    fireEvent.click(slot(/^Puesto DFCI, Ghost, ya no está en la plantilla/));
    expect(screen.getAllByText(/ya no está en la plantilla/).length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole("button", { name: /^1Ghost/ }));
    const detail = screen.getByRole("region", { name: "Detalle del jugador" });
    expect(within(detail).getByText("Ghost")).toBeTruthy();
    expect(within(detail).getByText(/ya no está en la plantilla/)).toBeTruthy();
  });
});

describe("analysis, KPIs and table", () => {
  it("shows the charts, switching between squad and XI", async () => {
    await openApp(snapshotWith(squads()), planWith((s) => { s[2].uid = 2; }));
    const analysis = screen.getByRole("region", { name: "Análisis del plantel" });
    expect(within(analysis).getByText("Jugadores").nextSibling?.textContent).toBe("5");
    fireEvent.click(within(analysis).getByRole("button", { name: "Once inicial" }));
    expect(within(analysis).getByText("Jugadores").nextSibling?.textContent).toBe("1");
  });
  it("shows the approximate canteranos KPIs over the first team", async () => {
    const f = first();
    f[1] = { ...f[1], homeGrownClubs: [{ clubId: 1, qualifier: 1 }] };
    f[2] = { ...f[2], homeGrownNations: [{ nationOrdinal: 1, qualifier: 8 }] };
    await openApp(snapshotWith({ first: f }));
    const kpi = screen.getByRole("region", { name: "KPIs" });
    expect(within(kpi).getByText("Canteranos · plantel total").parentElement!.textContent).toContain("1");
    expect(within(kpi).getByText("Canteranos · plantel total").parentElement!.textContent).toContain("de 5");
    expect(within(kpi).getAllByText(/Aproximado/).length).toBeGreaterThan(0);
  });
  it("applies the selected view's columns and sorts on header click", async () => {
    await openApp(snapshotWith(squads()));
    const table = () => screen.getByRole("table", { name: "Jugadores" });
    expect(within(table()).queryByRole("columnheader", { name: /Rol/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Táctica" }));
    expect(within(table()).getByRole("columnheader", { name: /Rol/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Finanzas" }));
    fireEvent.click(within(table()).getByRole("button", { name: /Sueldo\/sem\./ }));
    expect(within(table()).getByRole("button", { name: /Sueldo\/sem\./ }).textContent).toContain("↓");
    fireEvent.click(within(table()).getByRole("button", { name: /Sueldo\/sem\./ }));
    expect(within(table()).getByRole("button", { name: /Sueldo\/sem\./ }).textContent).toContain("↑");
  });
  it("searches by name and filters by group", async () => {
    await openApp(snapshotWith(squads()));
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar jugadores" }), { target: { value: "p4" } });
    expect(screen.getByRole("button", { name: "P4" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "P2" })).toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar jugadores" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "POR" }));
    expect(screen.queryByRole("button", { name: "P2" })).toBeNull();
    expect(screen.getByRole("button", { name: "P1" })).toBeTruthy();
  });
  it("shows a dash and $0 for a player without contract, and flags expiring contracts in a later season", async () => {
    await openApp(snapshotWith(squads()));
    fireEvent.click(screen.getByRole("button", { name: "Contratos" }));
    const row4 = screen.getByRole("button", { name: "P4" }).closest("[role=row]") as HTMLElement;
    expect(row4.textContent).toContain("–");
    expect(row4.textContent).toContain("$0");
    const row1 = screen.getByRole("button", { name: "P1" }).closest("[role=row]") as HTMLElement;
    expect(row1.textContent).not.toContain("▲");
    fireEvent.click(screen.getByRole("button", { name: /Temporada después/ }));
    expect(screen.getByRole("button", { name: "P1" }).closest("[role=row]")!.textContent).toContain("▲");
  });
  it("shows wages in the chosen currency", async () => {
    const d = defaultOwnerData();
    d.settings.currency = "GBP";
    await openApp(snapshotWith(squads()), d);
    fireEvent.click(screen.getByRole("button", { name: "Finanzas" }));
    expect(screen.getByRole("button", { name: "P2" }).closest("[role=row]")!.textContent).toContain("£3K");
  });
});

describe("player detail", () => {
  it("shows CA as Rtg, the contract end, the number and only labelled statuses", async () => {
    await openApp(snapshotWith(squads()));
    fireEvent.click(screen.getByRole("button", { name: "P2" }));
    const d = screen.getByRole("region", { name: "Detalle del jugador" });
    expect(within(d).getByText("Rating").nextSibling?.textContent).toBe("100");
    expect(within(d).getByText("Contrato hasta").nextSibling?.textContent).toBe("2028");
    expect(within(d).getByText("Jugador de plantilla")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "P3" }));
    expect(within(screen.getByRole("region", { name: "Detalle del jugador" })).queryByText(/Jugador de plantilla|Titular habitual/)).toBeNull();
  });
  it("cycles a position mark and refuses to remove the last natural", async () => {
    const storage = await openApp(snapshotWith(squads()));
    fireEvent.click(screen.getByRole("button", { name: "P4" }));
    const d = () => screen.getByRole("region", { name: "Detalle del jugador" });
    fireEvent.click(within(d()).getByRole("button", { name: /^DFC: no cubre/ }));
    expect(within(d()).getByRole("button", { name: /^DFC: natural/ })).toBeTruthy();
    fireEvent.click(within(d()).getByRole("button", { name: /^DFD: natural/ }));
    fireEvent.click(within(d()).getByRole("button", { name: /^DFC: natural/ }));
    expect(d().textContent).toContain("Dejá al menos una posición natural");
    await waitFor(() => expect(storage.write).toHaveBeenCalled(), { timeout: 3000 });
    expect(JSON.parse(storage.write.mock.calls.at(-1)![0]).marks["4"]).toBeDefined();
  });
  it("removes a player from the squad view", async () => {
    await openApp(snapshotWith(squads()));
    fireEvent.click(screen.getByRole("button", { name: "P4" }));
    fireEvent.click(screen.getByRole("button", { name: "Quitar del plantel" }));
    expect(screen.queryByRole("button", { name: "P4" })).toBeNull();
  });
});
