// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { memoryStorage } from "../../src/planner/state/storage.ts";
import { App } from "../../src/planner/ui/App.tsx";
import { snapPlayer, snapshotOf } from "../helpers/planner.ts";

afterEach(cleanup);

describe("App", () => {
  it("renders the app title once loaded", async () => {
    render(<App source={{ load: async () => snapshotOf([snapPlayer(1, { GK: 20 })]) }} storage={memoryStorage()} />);
    expect(await screen.findByText(/FM24 Companion/)).toBeTruthy();
  });
});
