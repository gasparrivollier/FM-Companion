import { useState } from "react";
import { PRESETS } from "../domain/tactics.ts";
import { activePlan, type Action, type PlannerState } from "../state/reducer.ts";

export function TacticPanel({ state, dispatch, newId }: { state: PlannerState; dispatch: (a: Action) => void; newId: () => string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const plan = activePlan(state);
  const custom = state.data.custom;
  const pre = PRESETS.find((t) => t.id === plan.tacticId);
  const cur = custom.find((c) => c.id === plan.tacticId);
  const tacticName = pre ? pre.name : cur ? cur.name : "4-4-2";
  const pick = (id: string) => { dispatch({ type: "selectTactic", id }); setMenuOpen(false); setConfirmDel(false); };
  const saveNew = () => { dispatch({ type: "saveNewTactic", name: saveName, id: newId() }); setSaveName(""); setConfirmDel(false); };

  return (
    <section className="panel" aria-label="Táctica">
      <div className="row2" style={{ justifyContent: "space-between" }}>
        <span className="h">Táctica</span>
        {plan.dirty && <span className="tag">Cambios sin guardar</span>}
      </div>
      <div className="dd" onKeyDown={(e) => { if (e.key === "Escape") setMenuOpen(false); }}>
        <button type="button" className="ddbtn" aria-haspopup="true" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          <span>{tacticName}</span>
          <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true"><path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        {menuOpen && (
          <>
            <button type="button" className="ddback" tabIndex={-1} aria-label="Cerrar menú de tácticas" onClick={() => setMenuOpen(false)} />
            <div className="ddmenu">
              <div className="ddgrp h">Formaciones</div>
              {PRESETS.map((t) => (
                <button key={t.id} type="button" className={"ddi" + (t.id === plan.tacticId ? " on" : "")} onClick={() => pick(t.id)}>
                  <span>{t.name}</span><span className="muted small">{t.id === plan.tacticId ? "actual" : ""}</span>
                </button>
              ))}
              {custom.length > 0 && <div className="ddgrp h">Mis tácticas</div>}
              {custom.map((t) => (
                <button key={t.id} type="button" className={"ddi" + (t.id === plan.tacticId ? " on" : "")} onClick={() => pick(t.id)}>
                  <span>{t.name}</span><span className="muted small">{t.id === plan.tacticId ? "actual" : "guardada"}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="row2">
        <input className="inp" type="text" maxLength={32} aria-label="Nombre de la nueva táctica" placeholder="Nombrá esta táctica, ej. Presión alta 4-3-3"
          value={saveName} onChange={(e) => setSaveName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveNew(); }} />
        <button type="button" className="btn pri" onClick={saveNew}>Guardar como nueva</button>
      </div>
      {cur && (
        <div className="row2">
          <button type="button" className="btn" onClick={() => dispatch({ type: "updateTactic" })}>Guardar cambios en “{cur.name}”</button>
          {!confirmDel && <button type="button" className="btn warn" onClick={() => setConfirmDel(true)}>Eliminar</button>}
          {confirmDel && (
            <>
              <button type="button" className="btn warn" onClick={() => { dispatch({ type: "deleteTactic" }); setConfirmDel(false); }}>Confirmar</button>
              <button type="button" className="btn" onClick={() => setConfirmDel(false)}>Cancelar</button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
