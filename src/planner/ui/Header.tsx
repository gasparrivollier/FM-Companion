import { inkOn } from "../domain/colors.ts";
import type { PlannerState } from "../state/reducer.ts";

export function Header({ state, onSettings, onLoadSave }: { state: PlannerState; onSettings: () => void; onLoadSave?: () => void }) {
  const { c1, c2 } = state.data.settings;
  const team = state.data.settings.team.trim() || "Mi equipo";
  return (
    <header className="top" style={{ background: c1, color: inkOn(c1) }}>
      <div className="tbar">
        <div>
          <h1 className="tname">{team}</h1>
          <div className="tsub">FM24 Companion · Football Manager 24 · plan de plantilla</div>
        </div>
        <div className="row2">
          <span className="small">{state.club.name} · {state.gameDate}</span>
          {onLoadSave && (
            <button type="button" className="tbtn" style={{ background: c2, color: inkOn(c2), borderColor: c2 }} onClick={onLoadSave}>Cargar save</button>
          )}
          <button type="button" className="tbtn" aria-haspopup="dialog" onClick={onSettings}>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" style={{ marginRight: 8 }}>
              <path d="M2 5h12M2 11h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              <circle cx="10" cy="5" r="2" fill="currentColor" /><circle cx="6" cy="11" r="2" fill="currentColor" />
            </svg>
            Ajustes
          </button>
        </div>
      </div>
      <div className="stripe" style={{ background: c2 }} />
    </header>
  );
}
