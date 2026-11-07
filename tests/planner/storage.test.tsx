// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OWNER_VERSION } from "../../src/planner/domain/ownerData.ts";
import { memoryStorage, type OwnerStorage } from "../../src/planner/state/storage.ts";
import { App } from "../../src/planner/ui/App.tsx";
import { snapPlayer, snapshotOf } from "../helpers/planner.ts";

afterEach(cleanup);

const good = () => snapshotOf([snapPlayer(1, { GK: 20 }), snapPlayer(2, { DC: 20 })]);
const spyStorage = (initial?: string): OwnerStorage & { write: ReturnType<typeof vi.fn> } => {
  const inner = memoryStorage(initial);
  return { read: () => inner.read(), write: vi.fn((t: string) => inner.write(t)) };
};

describe("App loading", () => {
  it("renders the planner and writes a v1 document after a change", async () => {
    const storage = spyStorage();
    render(<App source={{ load: async () => good() }} storage={storage} />);
    fireEvent.click(await screen.findByRole("button", { name: /2025\/26/ }));
    await waitFor(() => expect(storage.write).toHaveBeenCalled(), { timeout: 3000 });
    const doc = JSON.parse(storage.write.mock.calls.at(-1)![0]);
    expect(doc.version).toBe(OWNER_VERSION);
    expect(Object.keys(doc.plans)).toContain("2026");
  });
  it("refuses data from a newer version and never writes", async () => {
    const storage = spyStorage(JSON.stringify({ version: 2 }));
    render(<App source={{ load: async () => good() }} storage={storage} />);
    expect(await screen.findByText(/Los datos propios son de una versión más nueva de la app/)).toBeTruthy();
    await new Promise((r) => setTimeout(r, 500));
    expect(storage.write).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /2025\/26/ })).toBeNull();
  });
  it("refuses unparseable data and never writes", async () => {
    const storage = spyStorage("{");
    render(<App source={{ load: async () => good() }} storage={storage} />);
    expect(await screen.findByText(/JSON inválido/)).toBeTruthy();
    await new Promise((r) => setTimeout(r, 500));
    expect(storage.write).not.toHaveBeenCalled();
  });
  it("rejects an invalid snapshot", async () => {
    const storage = spyStorage();
    render(<App source={{ load: async () => ({ nope: true }) }} storage={storage} />);
    expect(await screen.findByText(/El snapshot no es válido/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /2025\/26/ })).toBeNull();
    expect(storage.write).not.toHaveBeenCalled();
  });
  it("reports a snapshot that cannot be loaded", async () => {
    render(<App source={{ load: async () => { throw new Error("no hay archivo"); } }} storage={spyStorage()} />);
    expect(await screen.findByText(/no hay archivo/)).toBeTruthy();
  });
  it("shows the snapshot warnings in a dismissible banner", async () => {
    render(<App source={{ load: async () => snapshotOf([snapPlayer(1, { GK: 20 })], "2025-04-06", ["2 players without a current contract."]) }} storage={spyStorage()} />);
    expect(await screen.findByText(/2 players without a current contract/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(screen.queryByText(/2 players without a current contract/)).toBeNull();
  });
});
