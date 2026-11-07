import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// Dev only: serves the importer's output so the planner can be tried in a browser.
function devSnapshot(): Plugin {
  return {
    name: "dev-snapshot",
    configureServer(server) {
      server.middlewares.use("/snapshot.json", (_req, res) => {
        const file = resolve(import.meta.dirname, "out", "snapshot.json");
        if (!existsSync(file)) { res.statusCode = 404; res.end("out/snapshot.json not found; run npm run import first"); return; }
        res.setHeader("content-type", "application/json");
        res.end(readFileSync(file));
      });
    },
  };
}

// base "./": the packaged app loads index.html from a file:// URL, so assets must be relative
export default defineConfig({ base: "./", plugins: [react(), devSnapshot()] });
