// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../src/planner/ui/App.tsx";

describe("App", () => {
  it("renders the app title", () => {
    render(<App />);
    expect(screen.getByText("FM24 Companion")).toBeTruthy();
  });
});
