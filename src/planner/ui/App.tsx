import { useEffect, useRef, useState } from "react";
import type { FmApi } from "../../electron/api.ts";
import { isSnapshot, type Snapshot } from "../../shared/snapshot.ts";
import { defaultOwnerData, parseOwnerData, type OwnerData } from "../domain/ownerData.ts";
import { reconcile } from "../domain/reconcile.ts";
import { initialState, type PlannerState } from "../state/reducer.ts";
import type { ImporterPort, OwnerStorage, SnapshotSource } from "../state/storage.ts";
import { DataProblem, type DataTools } from "./DataProblem.tsx";
import { ImportDialog, useImportFlow } from "./ImportFlow.tsx";
import { Planner } from "./Planner.tsx";

type Phase =
  | { kind: "loading" }
  | { kind: "data-problem"; message: string }
  | { kind: "error"; title: string; message: string }
  | { kind: "welcome"; data: OwnerData }
  | { kind: "ready"; initial: PlannerState; snapshot: Snapshot };

export interface AppProps {
  source: SnapshotSource;
  storage: OwnerStorage;
  importer?: ImporterPort;
  newId?: () => string;
  dataTools?: DataTools;
  lifecycle?: FmApi["lifecycle"];
}

const msg = (e: unknown) => String((e as Error)?.message ?? e);

function build(data: OwnerData, raw: Snapshot): { initial: PlannerState; snapshot: Snapshot } {
  const r = reconcile(data, raw);
  const c = raw.meta.club;
  return { initial: initialState(r.data, r.players, raw.meta.gameDate, { id: c.id, nationOrdinal: c.nationOrdinal, name: c.name }, r.left), snapshot: raw };
}

/** Loads the owner's data and the snapshot. Any problem stops here: nothing is rendered that could write over the owner's data. */
export function App({ source, storage, importer, newId, dataTools, lifecycle }: AppProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [incoming, setIncoming] = useState<Snapshot | undefined>(undefined);
  const [reloadKey, setReloadKey] = useState(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    let live = true;
    const to = (p: Phase) => { if (live) setPhase(p); };
    (async () => {
      let data = defaultOwnerData();
      const text = await storage.read();
      if (text !== null) {
        const r = parseOwnerData(text);
        if (!r.ok) return to({ kind: "data-problem", message: r.message });
        data = r.data;
      }
      let raw: unknown;
      try { raw = await source.load(); } catch (e) {
        if (importer && msg(e).includes("NO_SNAPSHOT")) return to({ kind: "welcome", data });
        return to({ kind: "error", title: "No se pudo cargar el snapshot", message: msg(e) });
      }
      if (!isSnapshot(raw)) return to({ kind: "error", title: "El snapshot no es válido", message: "El archivo no tiene el formato esperado o es de otra versión. Volvé a importar el save." });
      to({ kind: "ready", ...build(data, raw) });
    })().catch((e: unknown) => to({ kind: "error", title: "Error inesperado", message: msg(e) }));
    return () => { live = false; };
  }, [source, storage, importer, reloadKey]);

  const flow = useImportFlow(importer, async () => {
    const raw = await source.load();
    if (!isSnapshot(raw)) throw new Error("El snapshot nuevo no es válido. Volvé a importar el save.");
    const p = phaseRef.current;
    if (p.kind === "welcome") setPhase({ kind: "ready", ...build(p.data, raw) });
    else if (p.kind === "ready") setIncoming(raw);
  });

  if (phase.kind === "loading") return <div className="app"><p role="status">Cargando…</p></div>;
  if (phase.kind === "data-problem") return <DataProblem message={phase.message} tools={dataTools} onContinue={() => { setPhase({ kind: "loading" }); setReloadKey((k) => k + 1); }} />;
  if (phase.kind === "error") {
    return <div className="app"><div className="panel" role="alert"><h1 className="tname">{phase.title}</h1><p>{phase.message}</p></div></div>;
  }
  if (phase.kind === "welcome") {
    return (
      <div className="app">
        <div className="panel" style={{ flex: "1 1 100%" }}>
          <h1 className="tname">FM24 Companion</h1>
          <p>Todavía no cargaste un save. Elegí el archivo <code>.fm</code> de tu partida de Football Manager 24: la app lo lee sin modificarlo.</p>
          <div className="row2"><button type="button" className="btn pri" onClick={() => void flow.begin()}>Cargar save</button></div>
        </div>
        <ImportDialog flow={flow} />
      </div>
    );
  }
  return (
    <>
      <Planner initial={phase.initial} snapshot={phase.snapshot} storage={storage} newId={newId} incoming={incoming}
        onLoadSave={importer ? () => void flow.begin() : undefined} lifecycle={lifecycle} />
      <ImportDialog flow={flow} />
    </>
  );
}
