import { useRef, useState } from "react";
import type { ImporterPort } from "../state/storage.ts";

export type FlowStatus =
  | { kind: "idle" }
  | { kind: "picking" }
  | { kind: "running"; percent: number; message: string }
  | { kind: "failed"; message: string };

/**
 * One import at a time: pick the save, run the importer with progress, then let the host apply the new snapshot.
 * A second click while anything is in progress does nothing. A failure never touches what is already on screen.
 */
export function useImportFlow(importer: ImporterPort | undefined, onImported: () => Promise<void>) {
  const [status, setStatus] = useState<FlowStatus>({ kind: "idle" });
  const busy = useRef(false);

  const begin = async () => {
    if (!importer || busy.current) return;
    busy.current = true;
    setStatus({ kind: "picking" });
    let off: (() => void) | null = null;
    try {
      const path = await importer.pickSave();
      if (!path) { setStatus({ kind: "idle" }); return; }
      setStatus({ kind: "running", percent: 0, message: "Iniciando…" });
      off = importer.onProgress((percent, message) => setStatus((s) => (s.kind === "running" ? { kind: "running", percent, message } : s)));
      const r = await importer.start(path).catch((e: unknown) => ({ ok: false as const, code: "INTERNAL" as const, message: String((e as Error)?.message ?? e) }));
      if (!r.ok) { setStatus({ kind: "failed", message: r.message }); return; }
      await onImported();
      setStatus({ kind: "idle" });
    } catch (e) {
      setStatus({ kind: "failed", message: String((e as Error)?.message ?? e) });
    } finally {
      off?.();
      busy.current = false;
    }
  };
  return { status, begin, cancel: () => { void importer?.cancel(); }, dismiss: () => setStatus({ kind: "idle" }) };
}

export function ImportDialog({ flow }: { flow: ReturnType<typeof useImportFlow> }) {
  const s = flow.status;
  if (s.kind === "running") {
    return (
      <>
        <div className="mback" />
        <div className="mbox" role="dialog" aria-modal="true" aria-label="Importando el save">
          <span className="h">Leyendo el save</span>
          <progress max={100} value={s.percent} style={{ width: "100%" }} />
          <div className="row2" style={{ justifyContent: "space-between" }}><span>{s.message}</span><b>{Math.round(s.percent)}%</b></div>
          <span className="small muted">Puede tardar un minuto o dos. Tu plantel y tus datos no se tocan hasta que termine.</span>
          <button type="button" className="btn" onClick={flow.cancel}>Cancelar</button>
        </div>
      </>
    );
  }
  if (s.kind === "failed") {
    return (
      <>
        <button type="button" className="mback" tabIndex={-1} aria-label="Cerrar aviso" onClick={flow.dismiss} />
        <div className="mbox" role="alert">
          <span className="h">No se pudo cargar el save</span>
          <p>{s.message}</p>
          <button type="button" className="btn pri" onClick={flow.dismiss}>Cerrar</button>
        </div>
      </>
    );
  }
  return null;
}
