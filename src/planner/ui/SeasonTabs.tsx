import { seasonLabel, tabs } from "../../planner/domain/season.ts";
import type { Action, PlannerState } from "../state/reducer.ts";

const NAMES = ["Temporada actual", "Próxima temporada", "Temporada después"];

export function SeasonTabs({ state, dispatch }: { state: PlannerState; dispatch: (a: Action) => void }) {
  return (
    <div className="seasons">
      <div className="stabs" role="group" aria-label="Temporada del plan">
        {tabs(state.base).map((year, i) => (
          <button key={year} type="button" className="stab" aria-pressed={state.season === year} onClick={() => dispatch({ type: "setSeason", season: year })}>
            {NAMES[i]} <span>{seasonLabel(year)}</span>
          </button>
        ))}
      </div>
      <div className="row2">
        {state.season > state.base && (
          <button type="button" className="btn" onClick={() => dispatch({ type: "copyPlan" })}>Copiar plan de la temporada actual</button>
        )}
      </div>
    </div>
  );
}
