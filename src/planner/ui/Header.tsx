import { useState } from "react";
import { inkOn } from "../domain/colors.ts";
import type { PlannerState } from "../state/reducer.ts";

/** Import warnings live behind a button, so they take no room until the user asks for them. */
function Notices({ warnings }: { warnings: string[] }) {
  const [open, setOpen] = useState(false);
  if (warnings.length === 0) return null;
  return (
    <div className="dd notif" onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
      <button type="button" className="tbtn" aria-haspopup="dialog" aria-expanded={open} aria-label={`Avisos (${warnings.length})`} onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="M8 2a4 4 0 0 0-4 4v2.5L2.5 11h11L12 8.5V6a4 4 0 0 0-4-4Z M6.5 12.5a1.5 1.5 0 0 0 3 0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        <span className="nbadge" aria-hidden="true">{warnings.length}</span>
      </button>
      {open && (
        <>
          <button type="button" className="ddback" tabIndex={-1} aria-label="Cerrar avisos" onClick={() => setOpen(false)} />
          <div className="npop" role="dialog" aria-label="Avisos" onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
            <span className="h">Avisos de la importación</span>
            <ul>{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </div>
        </>
      )}
    </div>
  );
}

export function Header({ state, warnings = [], onSettings, onLoadSave }: { state: PlannerState; warnings?: string[]; onSettings: () => void; onLoadSave?: () => void }) {
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
          <Notices warnings={warnings} />
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
