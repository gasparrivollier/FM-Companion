// Development: Vite dev server for the renderer + Electron pointed at it. Ctrl+C stops both.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

await new Promise((resolve, reject) => {
  const b = spawn(process.execPath, ["scripts/build-electron.mjs"], { stdio: "inherit" });
  b.on("exit", (c) => (c === 0 ? resolve() : reject(new Error("build failed"))));
});
const vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--port", "5173", "--strictPort"], { stdio: ["ignore", "pipe", "inherit"] });
vite.stdout.setEncoding("utf8");
let started = false;
vite.stdout.on("data", (t) => {
  process.stdout.write(t);
  if (!started && /Local:/.test(t)) {
    started = true;
    const electron = createRequire(import.meta.url)("electron");
    const e = spawn(electron, ["."], { stdio: "inherit", env: { ...process.env, ELECTRON_DEV_URL: "http://localhost:5173/" } });
    e.on("exit", () => { vite.kill(); process.exit(0); });
  }
});
