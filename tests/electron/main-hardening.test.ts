import { describe, expect, it, vi } from "vitest";
import { cspHeader, hardenWindow } from "../../src/electron/hardening.ts";

function fakeWindow() {
  let open: (() => { action: "deny" }) | undefined;
  let nav: ((e: { preventDefault(): void }, url: string) => void) | undefined;
  return {
    win: { webContents: { setWindowOpenHandler: (f: () => { action: "deny" }) => { open = f; }, on: (_ev: "will-navigate", f: (e: { preventDefault(): void }, url: string) => void) => { nav = f; } } },
    open: () => open!(), navigate: (url: string) => { const e = { preventDefault: vi.fn() }; nav!(e, url); return e.preventDefault; },
  };
}

describe("hardenWindow", () => {
  it("denies every new window", () => {
    const f = fakeWindow();
    hardenWindow(f.win, "file:///C:/app/dist/index.html");
    expect(f.open()).toEqual({ action: "deny" });
  });
  it("blocks navigation to anything but the app itself", () => {
    const f = fakeWindow();
    hardenWindow(f.win, "file:///C:/app/dist/index.html");
    expect(f.navigate("https://example.com")).toHaveBeenCalled();
    expect(f.navigate("file:///C:/other/file.html")).toHaveBeenCalled();
    expect(f.navigate("http://localhost:5173/")).toHaveBeenCalled();
    expect(f.navigate("file:///C:/app/dist/index.html")).not.toHaveBeenCalled();
    expect(f.navigate("file:///C:/app/dist/index.html#x")).not.toHaveBeenCalled();
  });
});

describe("cspHeader", () => {
  it("allows only the app's own files and no network", () => {
    const csp = cspHeader();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'none'");
    expect(csp).not.toMatch(/https?:/);
    expect(csp).not.toContain("unsafe-eval");
  });
});
