import { useEffect, useReducer, useRef, useState } from "react";
import type { Snapshot } from "../../shared/snapshot.ts";
import { initialState, reduce, type PlannerState } from "../state/reducer.ts";
import type { OwnerStorage } from "../state/storage.ts";
import { SeasonTabs } from "./SeasonTabs.tsx";

const SAVE_DELAY_MS = 300;

export function Planner({ initial, snapshot, storage }: { initial: PlannerState; snapshot: Snapshot; storage: OwnerStorage; newId?: () => string }) {
  const [state, dispatch] = useReducer(reduce, initial);
  const [dismissed, setDismissed] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flush = () => {
    const text = pending.current;
    pending.current = null;
    if (text !== null) storage.write(text).then(() => setSaveError(null), (e: unknown) => setSaveError(String((e as Error)?.message ?? e)));
  };
  useEffect(() => {
    pending.current = JSON.stringify(state.data);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }, [state.data]);
  useEffect(() => () => { clearTimeout(timer.current); flush(); }, []);

  return (
    <div className="app">
      <h1 className="tname">FM24 Companion</h1>
      {snapshot.warnings.length > 0 && !dismissed && (
        <div className="panel" role="status" style={{ flex: "1 1 100%" }}>
          <ul>{snapshot.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          <button type="button" className="btn" onClick={() => setDismissed(true)}>Cerrar aviso</button>
        </div>
      )}
      {saveError && <div className="panel" role="alert" style={{ flex: "1 1 100%" }}>No se pudieron guardar los datos propios: {saveError}</div>}
      <SeasonTabs state={state} dispatch={dispatch} />
    </div>
  );
}

export { initialState };
