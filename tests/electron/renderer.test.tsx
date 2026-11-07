// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ImportResult } from "../../src/electron/api.ts";
import { electronImporter, electronOwnerStorage, electronSnapshotSource } from "../../src/planner/state/electron.ts";
import { App } from "../../src/planner/ui/App.tsx";
import { fakeFm } from "../helpers/fm.ts";
import { snapPlayer, snapshotOf } from "../helpers/planner.ts";

afterEach(cleanup);

const snapA = (warnings: string[] = []) => snapshotOf([snapPlayer(1, { GK: 20 }), snapPlayer(2, { DC: 20 })], "2025-04-06", warnings);
const mount = (h: ReturnType<typeof fakeFm>) =>
  render(<App source={electronSnapshotSource(h.fm)} storage={electronOwnerStorage(h.fm)} importer={electronImporter(h.fm)}
    dataTools={{ backupAndReset: h.fm.owner.backupAndReset, openFolder: h.fm.owner.openFolder }} lifecycle={h.fm.lifecycle} />);
const deferred = <T,>() => { let resolve!: (v: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; };
const tab = () => screen.findByRole("button", { name: /2025\/26/ });

describe("welcome and import", () => {
  it("shows a welcome screen with Cargar save when there is no snapshot yet", async () => {
    mount(fakeFm());
    expect(await screen.findByRole("button", { name: "Cargar save" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("does nothing when the picker is cancelled", async () => {
    const h = fakeFm(); h.s.pick = null;
    mount(h);
    fireEvent.click(await screen.findByRole("button", { name: "Cargar save" }));
    await waitFor(() => expect(h.fm.importer.pickSave).toHaveBeenCalled());
    expect(h.fm.importer.start).not.toHaveBeenCalled();
  });
  it("imports from the welcome screen and opens the planner", async () => {
    const h = fakeFm();
    h.s.startImpl = async () => { h.s.snapshot = snapA(); return { ok: true, warnings: [] }; };
    mount(h);
    fireEvent.click(await screen.findByRole("button", { name: "Cargar save" }));
    expect(await tab()).toBeTruthy();
    expect(h.fm.importer.start).toHaveBeenCalledWith("C:\\saves\\Canadá.fm");
  });
  it("shows progress, ignores a second click while running, and cancels", async () => {
    const h = fakeFm({ snapshot: snapA() });
    const d = deferred<ImportResult>();
    h.s.startImpl = () => d.promise;
    mount(h);
    await tab();
    fireEvent.click(screen.getByRole("button", { name: "Cargar save" }));
    await waitFor(() => expect(h.fm.importer.start).toHaveBeenCalledTimes(1));
    act(() => h.emit(42, "Leyendo jugadores"));
    expect(screen.getByText(/42\s?%/)).toBeTruthy();
    expect(screen.getByText("Leyendo jugadores")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cargar save" }));
    expect(h.fm.importer.pickSave).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(h.fm.importer.cancel).toHaveBeenCalled();
    await act(async () => d.resolve({ ok: false, code: "CANCELLED", message: "Importación cancelada." }));
    expect(await screen.findByText("Importación cancelada.")).toBeTruthy();
  });
  it("a failed import shows the message and keeps the old snapshot on screen", async () => {
    const h = fakeFm({ snapshot: snapA() });
    h.s.startImpl = async () => ({ ok: false, code: "TRUNCATED", message: "El save está incompleto o dañado. Probá guardar de nuevo en el juego." });
    mount(h);
    await tab();
    fireEvent.click(screen.getByRole("button", { name: "Cargar save" }));
    expect(await screen.findByText(/El save está incompleto/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByText(/El save está incompleto/)).toBeNull();
    expect(await tab()).toBeTruthy();
  });
  it("a successful import is applied to the running planner: edits are kept and new warnings show", async () => {
    const h = fakeFm({ snapshot: snapA() });
    h.s.startImpl = async () => { h.s.snapshot = snapshotOf([snapPlayer(1, { GK: 20 }), snapPlayer(9, { ST: 20 })], "2025-04-06", ["2 players without a current contract."]); return { ok: true, warnings: ["2 players without a current contract."] }; };
    mount(h);
    fireEvent.click(await tab());
    fireEvent.click(screen.getByRole("button", { name: "Cargar save" }));
    expect(await screen.findByText(/2 players without a current contract/)).toBeTruthy();
    expect((await tab()).getAttribute("aria-pressed")).toBe("true"); // the season chosen before the import is still chosen
    expect(screen.getByRole("button", { name: "P9" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "P2" })).toBeNull();
  });
});

describe("a snapshot that cannot be used", () => {
  it("offers Cargar save on the error screen so the user can import again", async () => {
    const h = fakeFm({ snapshot: { garbage: true } });
    h.s.startImpl = async () => { h.s.snapshot = snapA(); return { ok: true, warnings: [] }; };
    mount(h);
    expect(await screen.findByText(/no tiene el formato esperado/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cargar save" }));
    expect(await tab()).toBeTruthy();
    expect(h.s.writes).toEqual([]);
  });
  it("also when the snapshot file cannot be read at all", async () => {
    const h = fakeFm({ snapshot: new Error("Unexpected end of JSON input") });
    mount(h);
    expect(await screen.findByText(/Unexpected end of JSON input/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cargar save" })).toBeTruthy();
  });
});

describe("data problems", () => {
  it("refuses a newer file, offers the folder, and asks before resetting", async () => {
    const h = fakeFm({ owner: JSON.stringify({ version: 2 }), snapshot: snapA() });
    mount(h);
    expect(await screen.findByText(/versión más nueva/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Abrir carpeta de datos" }));
    expect(h.fm.owner.openFolder).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Guardar copia y empezar de cero" }));
    expect(screen.getByText(/Se guardará una copia/)).toBeTruthy();
    expect(h.fm.owner.backupAndReset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(h.fm.owner.backupAndReset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Guardar copia y empezar de cero" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, guardar copia y empezar" }));
    expect(await screen.findByText(/owner-backup-20261107-010203\.json/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await tab()).toBeTruthy();
    expect(h.s.writes).toEqual([]);
    expect(h.s.syncWrites).toEqual([]);
  });
  it("shows the same screen for unparseable data and never writes", async () => {
    const h = fakeFm({ owner: "{", snapshot: snapA() });
    mount(h);
    expect(await screen.findByText(/JSON inválido/)).toBeTruthy();
    await new Promise((r) => setTimeout(r, 450));
    expect(h.s.writes).toEqual([]);
  });
});

describe("closing", () => {
  it("pagehide writes synchronously, once", async () => {
    const h = fakeFm({ snapshot: snapA() });
    mount(h);
    fireEvent.click(await tab());
    window.dispatchEvent(new Event("pagehide"));
    expect(h.s.syncWrites).toHaveLength(1);
    expect(h.s.writes).toEqual([]);
    expect(Object.keys(JSON.parse(h.s.syncWrites[0]).plans)).toContain("2026");
  });
  it("the before-close request flushes the pending edit and then acknowledges", async () => {
    const h = fakeFm({ snapshot: snapA() });
    mount(h);
    fireEvent.click(await tab());
    expect(h.s.closeCb).not.toBeNull();
    act(() => h.s.closeCb!());
    expect(h.s.syncWrites).toHaveLength(1);
    expect(h.s.acks).toBe(1);
  });
  it("acknowledges even when nothing is pending", async () => {
    const h = fakeFm({ snapshot: snapA() });
    mount(h);
    await tab();
    act(() => h.s.closeCb!());
    expect(h.s.acks).toBe(1);
    expect(h.s.syncWrites).toEqual([]);
  });
});
