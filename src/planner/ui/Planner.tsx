import { useEffect, useReducer, useRef, useState } from "react";
import type { Snapshot } from "../../shared/snapshot.ts";
import { inkOn, liftOn } from "../domain/colors.ts";
import { reduce, type PlannerState } from "../state/reducer.ts";
import type { OwnerStorage } from "../state/storage.ts";
import { Header } from "./Header.tsx";
import { Pitch } from "./Pitch.tsx";
import { SeasonTabs } from "./SeasonTabs.tsx";
import { SettingsModal } from "./SettingsModal.tsx";
import { TacticPanel } from "./TacticPanel.tsx";

const SAVE_DELAY_MS = 300;
const defaultId = () => "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

export interface PlannerProps {
  initial: PlannerState; snapshot: Snapshot; storage: OwnerStorage; newId?: () => string; onLoadSave?: () => void;
}

export function Planner({ initial, snapshot, storage, newId = defaultId, onLoadSave }: PlannerProps) {
  const [state, dispatch] = useReducer(reduce, initial);
  const [dismissed, setDismissed] = useState(false);
  const [settings, setSettings] = useState(false);
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

  const { c1, c2 } = state.data.settings;
  void c1;
  return (
    <div className="app" style={{ ["--acc" as string]: c2, ["--acc-ink" as string]: inkOn(c2), ["--accl" as string]: liftOn(c2) }}>
      <Header state={state} onSettings={() => setSettings(true)} onLoadSave={onLoadSave} />
      {snapshot.warnings.length > 0 && !dismissed && (
        <div className="panel" role="status" style={{ flex: "1 1 100%" }}>
          <ul>{snapshot.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          <button type="button" className="btn" onClick={() => setDismissed(true)}>Cerrar aviso</button>
        </div>
      )}
      {saveError && <div className="panel" role="alert" style={{ flex: "1 1 100%" }}>No se pudieron guardar los datos propios: {saveError}</div>}
      <SeasonTabs state={state} dispatch={dispatch} />
      <div className="left">
        <TacticPanel state={state} dispatch={dispatch} newId={newId} />
        <Pitch state={state} dispatch={dispatch} />
      </div>
      {settings && <SettingsModal state={state} dispatch={dispatch} onClose={() => setSettings(false)} />}
    </div>
  );
}
