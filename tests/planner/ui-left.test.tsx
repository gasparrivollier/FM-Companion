// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { inkOn } from "../../src/planner/domain/colors.ts";
import { defaultOwnerData, type OwnerData } from "../../src/planner/domain/ownerData.ts";
import { blankSlots, PRESETS } from "../../src/planner/domain/tactics.ts";
import { memoryStorage, type ImporterPort, type OwnerStorage } from "../../src/planner/state/storage.ts";
import { App } from "../../src/planner/ui/App.tsx";
import { snapPlayer, snapshotOf } from "../helpers/planner.ts";

afterEach(cleanup);

const squad = () => [
  snapPlayer(1, { GK: 20 }), snapPlayer(2, { DC: 20 }), snapPlayer(3, { DC: 20 }), snapPlayer(4, { DR: 20 }), snapPlayer(5, { ST: 20, AMC: 16 }),
];
const spy = (data?: OwnerData): OwnerStorage & { write: ReturnType<typeof vi.fn> } => {
  const inner = memoryStorage(data ? JSON.stringify(data) : undefined);
  return { read: () => inner.read(), write: vi.fn((t: string) => inner.write(t)) };
};
async function open(opts: { data?: OwnerData; date?: string; importer?: ImporterPort } = {}) {
  const storage = spy(opts.data);
  render(<App source={{ load: async () => snapshotOf(squad(), opts.date ?? "2025-04-06") }} storage={storage} importer={opts.importer} />);
  await screen.findByRole("group", { name: "Temporada del plan" });
  return storage;
}
const withPlan = (assign: (slots: ReturnType<typeof blankSlots>) => void, season = 2025): OwnerData => {
  const d = defaultOwnerData();
  const slots = blankSlots(PRESETS[0].slots);
  assign(slots);
  d.plans[season] = { tacticId: "442", slots, dirty: false };
  return d;
};
const tokens = () => screen.getAllByRole("button", { name: /^Puesto / });

describe("colors", () => {
  it("picks a readable ink colour", () => {
    expect(inkOn("#0b5d3b")).toBe("#ffffff");
    expect(inkOn("#f2b84b")).toBe("#0e1311");
  });
});

describe("header and seasons", () => {
  it("shows three seasons from the snapshot date and switches", async () => {
    await open({ date: "2025-09-01" });
    const group = screen.getByRole("group", { name: "Temporada del plan" });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Temporada actual 2025/26", "Próxima temporada 2026/27", "Temporada después 2027/28",
    ]);
    fireEvent.click(within(group).getByRole("button", { name: /2026\/27/ }));
    expect(within(group).getByRole("button", { name: /2026\/27/ }).getAttribute("aria-pressed")).toBe("true");
  });
  it("shows the team name and the load button only when the host provides it", async () => {
    await open();
    expect(screen.getByRole("heading", { name: "Mi equipo" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cargar save" })).toBeNull();
    cleanup();
    const pickSave = vi.fn(async () => null);
    await open({ importer: { pickSave, start: vi.fn(), cancel: vi.fn(), onProgress: () => () => {} } });
    fireEvent.click(screen.getByRole("button", { name: "Cargar save" }));
    await waitFor(() => expect(pickSave).toHaveBeenCalledOnce());
  });
  it("asks for confirmation before emptying the XI", async () => {
    await open({ data: withPlan((s) => { s[2].uid = 2; }) });
    expect(screen.getByRole("button", { name: /^Puesto DFCI, P2/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Vaciar XI" }));
    expect(screen.getByRole("alert").textContent).toContain("¿Vaciar el XI de esta temporada?");
    expect(screen.getByRole("button", { name: /^Puesto DFCI, P2/ })).toBeTruthy(); // not yet
    fireEvent.click(screen.getByRole("button", { name: "Sí, vaciar" }));
    expect(screen.getByRole("button", { name: /^Puesto DFCI, vacío/ })).toBeTruthy();
  });
});

describe("settings", () => {
  it("changes the currency and rate and persists them", async () => {
    const storage = await open();
    fireEvent.click(screen.getByRole("button", { name: "Ajustes" }));
    const dialog = screen.getByRole("dialog", { name: "Ajustes" });
    fireEvent.change(within(dialog).getByLabelText("Moneda"), { target: { value: "EUR" } });
    fireEvent.change(within(dialog).getByLabelText("Euros por libra"), { target: { value: "1.2" } });
    fireEvent.change(within(dialog).getByLabelText("Nombre del equipo"), { target: { value: "Aberdeen" } });
    expect(screen.getByRole("heading", { name: "Aberdeen" })).toBeTruthy();
    await waitFor(() => expect(storage.write).toHaveBeenCalled(), { timeout: 3000 });
    const doc = JSON.parse(storage.write.mock.calls.at(-1)![0]);
    expect(doc.settings).toMatchObject({ currency: "EUR", eurPerGbp: 1.2, team: "Aberdeen" });
  });
  it("swaps and resets the colours, and an empty season-end override means automatic", async () => {
    const storage = await open();
    fireEvent.click(screen.getByRole("button", { name: "Ajustes" }));
    fireEvent.click(screen.getByRole("button", { name: "Invertir colores" }));
    fireEvent.change(screen.getByLabelText("Año en que termina la temporada actual"), { target: { value: "2030" } });
    fireEvent.change(screen.getByLabelText("Año en que termina la temporada actual"), { target: { value: "" } });
    await waitFor(() => expect(storage.write).toHaveBeenCalled(), { timeout: 3000 });
    let doc = JSON.parse(storage.write.mock.calls.at(-1)![0]);
    expect(doc.settings).toMatchObject({ c1: "#f2b84b", c2: "#0b5d3b", seasonEndOverride: null });
    fireEvent.click(screen.getByRole("button", { name: "Restablecer" }));
    await waitFor(() => expect(JSON.parse(storage.write.mock.calls.at(-1)![0]).settings.c1).toBe("#0b5d3b"), { timeout: 3000 });
    doc = JSON.parse(storage.write.mock.calls.at(-1)![0]);
    expect(doc.settings.c2).toBe("#f2b84b");
  });
});

describe("tactics", () => {
  it("lists the eight formations, switches, and shows unsaved changes until another formation is chosen", async () => {
    await open();
    expect(screen.queryByText("Cambios sin guardar")).toBeNull();
    fireEvent.keyDown(tokens()[0], { key: "ArrowUp" });
    expect(screen.getByText("Cambios sin guardar")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /4-4-2/ }));
    expect(document.querySelectorAll(".ddi")).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: /^4-3-3/ }));
    expect(screen.queryByText("Cambios sin guardar")).toBeNull();
    expect(tokens()).toHaveLength(11);
  });
  it("saves a custom tactic, updates it and deletes it after confirming", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Nombre de la nueva táctica"), { target: { value: "Presión alta" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar como nueva" }));
    expect(screen.getByRole("button", { name: /Guardar cambios en “Presión alta”/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(screen.queryByRole("button", { name: /Guardar cambios en/ })).toBeNull();
  });
});

describe("pitch", () => {
  it("has 11 named tokens and marks out-of-position and covering players", async () => {
    const data = withPlan((s) => { s[0].uid = 1; s[2].uid = 1 + 0; s[4].uid = 3; s[9].uid = 5; s[10].uid = 3; });
    // uid 1 (GK) in a DFC slot is out of position; uid 3 (DC) in a DFD slot is out; uid 5 (ST) in slot 9 (DLC) is natural
    await open({ data });
    expect(tokens()).toHaveLength(11);
    const out = screen.getByRole("button", { name: /^Puesto DFCI, P1, fuera de posición/ });
    expect(out.textContent).toContain("!");
    const nat = screen.getByRole("button", { name: /^Puesto DLCI, P5, natural/ });
    expect(nat.textContent).not.toContain("!");
    expect(screen.getByRole("button", { name: /^Puesto POR, P1, natural/ })).toBeTruthy();
  });
  it("a player who only covers shows ~", async () => {
    const d = withPlan((s) => { s[9].uid = 5; });
    d.marks[5] = { natural: ["MPC"], covers: ["DLC"] };
    await open({ data: d });
    const t = screen.getByRole("button", { name: /^Puesto DLCI, P5, cubre/ });
    expect(t.textContent).toContain("~");
  });
  it("nudges a focused token by 2 and stops at the edge", async () => {
    await open();
    const dfd = () => screen.getByRole("button", { name: /^Puesto DFD/ });
    fireEvent.keyDown(dfd(), { key: "ArrowUp" });
    expect(dfd().style.top).toBe("71%");
    for (let i = 0; i < 6; i++) fireEvent.keyDown(dfd(), { key: "ArrowRight" });
    expect(dfd().style.left).toBe("94%");
  });
  it("shows the alert dot unless starter and first backup are both natural", async () => {
    const d = withPlan((s) => { s[2].uid = 2; s[2].alt = [3]; });
    await open({ data: d });
    const dfci = screen.getByRole("button", { name: /^Puesto DFCI/ });
    expect(dfci.querySelector(".adot")).toBeNull();
    expect(screen.getByRole("button", { name: /^Puesto POR/ }).querySelector(".adot")).not.toBeNull();
  });
});
