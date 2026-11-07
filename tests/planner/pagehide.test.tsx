// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../../src/planner/ui/App.tsx";
import { snapPlayer, snapshotOf } from "../helpers/planner.ts";
import { spyStorage } from "../helpers/ui.tsx";

afterEach(cleanup);

describe("flush on page hide", () => {
  it("writes the pending text at once on pagehide, once, even if unmount follows", async () => {
    const storage = spyStorage();
    const view = render(<App source={{ load: async () => snapshotOf([snapPlayer(1, { GK: 20 })]) }} storage={storage} />);
    fireEvent.click(await screen.findByRole("button", { name: /2025\/26/ }));
    window.dispatchEvent(new Event("pagehide"));
    await waitFor(() => expect(storage.write).toHaveBeenCalledTimes(1), { timeout: 120, interval: 10 }); // well before the 300 ms debounce
    expect(Object.keys(JSON.parse(storage.write.mock.calls[0][0]).plans)).toContain("2026");
    view.unmount();
    await new Promise((r) => setTimeout(r, 450));
    expect(storage.write).toHaveBeenCalledTimes(1);
  });
});
