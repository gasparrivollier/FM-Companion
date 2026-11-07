// Electron main process: lifecycle, the window, and the wiring of ipc.ts. The logic lives in the modules it imports.
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, session, shell } from "electron";
import { cspHeader, hardenWindow } from "./hardening.ts";
import { createImportRunner } from "./importRunner.ts";
import { createCloseGate, importerOptions, registerIpc } from "./ipc.ts";
import { runSmoke } from "./smoke.ts";

declare const __dirname: string;
const DEV_URL = process.env.ELECTRON_DEV_URL;

function savesFolder(): string | undefined {
  const p = join(app.getPath("documents"), "Sports Interactive", "Football Manager 2024", "games");
  return existsSync(p) ? p : undefined;
}

function start(hidden = false): BrowserWindow {
  const dir = app.getPath("userData");
  // inside the installed app the importer is unpacked next to app.asar so a child process can run it
  const importerPath = join(__dirname, "importer.cjs").replace("app.asar", "app.asar.unpacked");
  const runner = createImportRunner(importerOptions(dir, importerPath));
  let win: BrowserWindow | null = null;

  const appUrl = DEV_URL ?? pathToFileURL(join(__dirname, "..", "dist", "index.html")).href;
  const gate = createCloseGate(() => win?.webContents.send("app:before-close"), 1500);
  ipcMain.on("app:flushed", () => gate.ack());

  registerIpc(ipcMain, {
    dir, runner,
    openFolder: async (d) => { await shell.openPath(d); },
    sendProgress: (percent, message) => win?.webContents.send("importer:progress", percent, message),
    pickSave: async () => {
      const r = await dialog.showOpenDialog(win!, {
        title: "Elegí tu save de Football Manager 24", defaultPath: savesFolder(), properties: ["openFile"],
        filters: [{ name: "Saves de Football Manager", extensions: ["fm"] }],
      });
      return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
    },
  });

  if (!DEV_URL) {
    session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
      cb({ responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [cspHeader()] } });
    });
  }

  win = new BrowserWindow({
    width: 1440, height: 1000, minWidth: 900, minHeight: 600, backgroundColor: "#0e1311", autoHideMenuBar: true, show: !hidden, title: "FM24 Companion",
    webPreferences: { preload: join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  hardenWindow(win, appUrl);
  let closing = false;
  win.on("close", (e) => {
    if (closing) return;
    e.preventDefault();
    closing = true;
    runner.cancel();
    void gate.request().then(() => win?.destroy());
  });
  win.on("closed", () => { win = null; });
  void win.loadURL(appUrl);
  return win;
}

const smokeUi = process.argv.indexOf("--smoke-ui");
const smoke = process.argv.indexOf("--smoke");
if (smokeUi >= 0) {
  // the packaged page in a hidden window with the real CSP and preload, on an empty data folder: it must reach the welcome screen
  app.setPath("userData", mkdtempSync(join(tmpdir(), "fm-smoke-ui-")));
  void app.whenReady().then(async () => {
    const w = start(true);
    let last: { fm: string; text: string } = { fm: "?", text: "" };
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 250));
      try { last = await w.webContents.executeJavaScript("({ fm: typeof window.fm, text: document.body.innerText })"); } catch { /* still loading */ }
      if (last.text.includes("Cargar save")) break;
    }
    const ok = last.fm === "object" && last.text.includes("Cargar save");
    process.stdout.write(JSON.stringify({ ok, fm: last.fm, text: last.text.slice(0, 120) }) + "\n");
    app.exit(ok ? 0 : 1);
  });
} else if (smoke >= 0) {
  // no window: import a save with the real runner, print one JSON line, exit
  void app.whenReady().then(async () => {
    const save = process.argv[smoke + 1];
    const r = save ? await runSmoke(save, join(__dirname, "importer.cjs")) : { code: 2, line: JSON.stringify({ ok: false, message: "usage: --smoke <save.fm>" }) };
    process.stdout.write(r.line + "\n");
    app.exit(r.code);
  });
} else if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
  });
  void app.whenReady().then(() => start());
  app.on("window-all-closed", () => app.quit());
}
