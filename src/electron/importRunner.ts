// Runs the importer as a child process and turns its JSON lines into one result. No `electron` import.
import { spawn, type ChildProcess } from "node:child_process";
import type { ImportFailureCode, ImportResult } from "./api.ts";

const TEXT: Record<ImportFailureCode, (detail: string) => string> = {
  NOT_A_SAVE: () => "Ese archivo no es un save de Football Manager 24.",
  UNSUPPORTED_VERSION: () => "Ese save es de otra versión del juego; esta app necesita FM24.",
  TRUNCATED: () => "El save está incompleto o dañado. Probá guardar de nuevo en el juego.",
  NO_MANAGED_CLUB: () => "No se encontró tu club en el save.",
  OUT_OF_MEMORY: () => "Faltó memoria para leer el save. Cerrá otros programas y reintentá.",
  SAVE_CHANGED: () => "El save cambió mientras se leía. Esperá a que el juego termine de guardar y reintentá.",
  UNSUPPORTED_SAVE: (d) => `No se pudo leer este save${d ? ": " + d : "."}`,
  OUTPUT_FAILED: (d) => `No se pudo guardar el resultado de la importación${d ? ": " + d : "."}`,
  INTERNAL: (d) => `Error inesperado al leer el save${d ? ": " + d : "."}`,
  CANCELLED: () => "Importación cancelada.",
  CRASHED: (d) => "La lectura del save se interrumpió. Tus datos y el plantel anterior siguen intactos." + (d ? ` (${d})` : ""),
  BUSY: () => "Ya hay una importación en curso.",
};
export function describeFailure(code: ImportFailureCode, detail: string): string {
  return TEXT[code](detail);
}

export interface ImportRunner {
  start(savePath: string, onProgress: (percent: number, message: string) => void): Promise<ImportResult>;
  cancel(): void;
  running(): boolean;
}
export interface RunnerOptions { command: string; args: string[]; env?: Record<string, string>; outPath: string; timeoutMs?: number }

const fail = (code: ImportFailureCode, detail = ""): ImportResult => ({ ok: false, code, message: describeFailure(code, detail) });

export function createImportRunner(opts: RunnerOptions): ImportRunner {
  let child: ChildProcess | null = null;
  let cancelled = false;

  return {
    running: () => child !== null,
    cancel() {
      if (!child) return;
      cancelled = true;
      child.kill();
    },
    start(savePath, onProgress) {
      if (child) return Promise.resolve(fail("BUSY"));
      cancelled = false;
      return new Promise<ImportResult>((resolve) => {
        let final: ImportResult | null = null;
        let timedOut = false;
        let stderrTail = "";
        let buf = "";
        let settled = false;
        const finish = (r: ImportResult) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          child = null;
          resolve(r);
        };
        // arguments, never a shell: paths with spaces, accents and backslashes arrive untouched
        const c = spawn(opts.command, [...opts.args, savePath, opts.outPath], {
          shell: false, env: { ...process.env, ...opts.env }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
        });
        child = c;
        const timer = opts.timeoutMs ? setTimeout(() => { timedOut = true; c.kill(); }, opts.timeoutMs) : undefined;

        const onLine = (line: string) => {
          let o: any;
          try { o = JSON.parse(line); } catch { return; }
          if (o?.type === "progress" && typeof o.percent === "number") onProgress(o.percent, String(o.message ?? ""));
          else if (o?.type === "done") final = { ok: true, warnings: Array.isArray(o.warnings) ? o.warnings.map(String) : [] };
          else if (o?.type === "error") final = fail((o.code as ImportFailureCode) ?? "INTERNAL", String(o.message ?? ""));
        };
        c.stdout!.setEncoding("utf8");
        c.stdout!.on("data", (chunk: string) => {
          buf += chunk;
          let i: number;
          while ((i = buf.indexOf("\n")) >= 0) { onLine(buf.slice(0, i).trim()); buf = buf.slice(i + 1); }
        });
        c.stderr!.setEncoding("utf8");
        c.stderr!.on("data", (t: string) => { stderrTail = (stderrTail + t).slice(-300); });
        c.on("error", (e) => finish(fail("CRASHED", e.message)));
        c.on("close", (code, signal) => {
          if (buf.trim()) onLine(buf.trim());
          if (cancelled) return finish(fail("CANCELLED"));
          if (timedOut) return finish(fail("CRASHED", "tiempo agotado"));
          if (final) return finish(final);
          finish(fail("CRASHED", signal ? `señal ${signal}` : `código ${code}${stderrTail.trim() ? ": " + stderrTail.trim() : ""}`));
        });
      });
    },
  };
}
