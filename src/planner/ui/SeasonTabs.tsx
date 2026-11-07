import { useState } from "react";
import { seasonLabel, tabs } from "../domain/season.ts";
import type { Action, PlannerState } from "../state/reducer.ts";

const NAMES = ["Temporada actual", "Próxima temporada", "Temporada después"];

export function SeasonTabs({ state, dispatch }: { state: PlannerState; dispatch: (a: Action) => void }) {
  const [confirmClear, setConfirmClear] = useState(false);
  return (
    <div className="seasons">
      <div className="stabs" role="group" aria-label="Temporada del plan">
        {tabs(state.base).map((year, i) => (
          <button key={year} type="button" className="stab" aria-pressed={state.season === year}
            onClick={() => { setConfirmClear(false); dispatch({ type: "setSeason", season: year }); }}>
            {NAMES[i]} <span>{seasonLabel(year)}</span>
          </button>
        ))}
      </div>
      <div className="row2">
        {state.season > state.base && (
          <button type="button" className="btn" onClick={() => dispatch({ type: "copyPlan" })}>Copiar plan de la temporada actual</button>
        )}
        {!confirmClear && <button type="button" className="btn danger" onClick={() => setConfirmClear(true)}>Vaciar XI</button>}
        {confirmClear && (
          <>
            <span className="small" role="alert">¿Vaciar el XI de esta temporada?</span>
            <button type="button" className="btn danger" onClick={() => { dispatch({ type: "clearXI" }); setConfirmClear(false); }}>Sí, vaciar</button>
            <button type="button" className="btn" onClick={() => setConfirmClear(false)}>No</button>
          </>
        )}
      </div>
    </div>
  );
}
