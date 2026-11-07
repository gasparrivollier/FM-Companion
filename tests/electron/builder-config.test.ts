import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const cfg = parse(readFileSync("electron-builder.yml", "utf8"));
const wf = readFileSync(".github/workflows/windows.yml", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

describe("electron-builder.yml", () => {
  it("builds only an NSIS installer for Windows, never an msi", () => {
    const targets = (cfg.win.target as ({ target: string } | string)[]).map((t) => (typeof t === "string" ? t : t.target));
    expect(targets).toEqual(["nsis"]);
    expect(JSON.stringify(cfg)).not.toMatch(/msi/i);
  });
  it("installs per user in one click and keeps the data when uninstalling", () => {
    expect(cfg.nsis.oneClick).toBe(true);
    expect(cfg.nsis.perMachine).toBe(false);
    expect(cfg.nsis.deleteAppDataOnUninstall).toBe(false);
  });
  it("is not code signed", () => {
    expect(cfg.win.signAndEditExecutable).toBe(false);
  });
  it("unpacks the importer so a child process can run it", () => {
    expect(cfg.asarUnpack).toContain("dist-electron/importer.cjs");
  });
  it("never packs saves or generated data", () => {
    for (const p of ["!saves/**", "!out/**", "!**/*.fm"]) expect(cfg.files).toContain(p);
    expect(cfg.files).toContain("dist/**");
    expect(cfg.files).toContain("dist-electron/**");
  });
  it("names the product", () => {
    expect(cfg.productName).toBe("FM24 Companion");
  });
  it("package.json points at the main bundle and has a dist script", () => {
    expect(pkg.main).toBe("dist-electron/main.cjs");
    expect(pkg.scripts.dist).toContain("electron-builder --win nsis");
    expect(pkg.license).toBe("GPL-3.0-only");
    // electron-builder 26 rejects a root "directories" field in package.json
    expect(pkg.directories).toBeUndefined();
  });
  it("never publishes from the dist script, not even on a tag", () => {
    expect(pkg.scripts.dist).toContain("--publish never");
  });
});

describe("windows workflow", () => {
  it("runs on windows-latest, tests before building, uploads the exe", () => {
    expect(wf).toContain("windows-latest");
    expect(wf.indexOf("npm test")).toBeGreaterThan(-1);
    expect(wf.indexOf("npm test")).toBeLessThan(wf.indexOf("npm run dist"));
    expect(wf).toContain("actions/upload-artifact");
    expect(wf).toContain("release/*.exe");
  });
  it("publishes nothing and uses no secrets", () => {
    expect(wf).not.toMatch(/secrets\./);
    expect(wf).not.toMatch(/gh release|softprops|action-gh-release|--publish/i);
    expect(wf).not.toMatch(/contents:\s*write/);
  });
  it("is triggered by hand or by a version tag", () => {
    expect(wf).toContain("workflow_dispatch");
    expect(wf).toMatch(/tags:\s*\n\s*-\s*["']?v\*/);
  });
});
