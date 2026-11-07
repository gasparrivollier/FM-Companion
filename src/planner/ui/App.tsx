import { useEffect, useState } from "react";
import { isSnapshot, type Snapshot } from "../../shared/snapshot.ts";
import { defaultOwnerData, parseOwnerData } from "../domain/ownerData.ts";
import { reconcile } from "../domain/reconcile.ts";
import { initialState, type PlannerState } from "../state/reducer.ts";
import type { OwnerStorage, SnapshotSource } from "../state/storage.ts";
import { Planner } from "./Planner.tsx";

type Phase =
  | { kind: "loading" }
  | { kind: "error"; title: string; message: string }
  | { kind: "ready"; initial: PlannerState; snapshot: Snapshot };

export interface AppProps { source: SnapshotSource; storage: OwnerStorage; newId?: () => string }

/** Loads the owner's data and the snapshot. Any problem stops here: nothing is rendered that could write over the owner's data. */
export function App({ source, storage, newId }: AppProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  useEffect(() => {
    let live = true;
    (async () => {
      let data = defaultOwnerData();
      const text = await storage.read();
      if (text !== null) {
        const r = parseOwnerData(text);
        if (!r.ok) return live && setPhase({ kind: "error", title: "No se pueden cargar tus datos", message: r.message });
        data = r.data;
      }
      let raw: unknown;
      try { raw = await source.load(); } catch (e) {
        return live && setPhase({ kind: "error", title: "No se pudo cargar el snapshot", message: String((e as Error)?.message ?? e) });
      }
      if (!isSnapshot(raw)) return live && setPhase({ kind: "error", title: "El snapshot no es válido", message: "El archivo no tiene el formato esperado o es de otra versión. Volvé a importar el save." });
      const r = reconcile(data, raw);
      const c = raw.meta.club;
      const initial = initialState(r.data, r.players, raw.meta.gameDate, { id: c.id, nationOrdinal: c.nationOrdinal, name: c.name }, r.left);
      if (live) setPhase({ kind: "ready", initial, snapshot: raw });
    })().catch((e: unknown) => live && setPhase({ kind: "error", title: "Error inesperado", message: String((e as Error)?.message ?? e) }));
    return () => { live = false; };
  }, [source, storage]);

  if (phase.kind === "loading") return <div className="app"><p role="status">Cargando…</p></div>;
  if (phase.kind === "error") {
    return <div className="app"><div className="panel" role="alert"><h1 className="tname">{phase.title}</h1><p>{phase.message}</p></div></div>;
  }
  return <Planner initial={phase.initial} snapshot={phase.snapshot} storage={storage} newId={newId} />;
}
