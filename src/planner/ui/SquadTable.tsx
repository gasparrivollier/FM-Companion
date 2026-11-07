import { useState } from "react";
import { COLS, VIEWS } from "../domain/columns.ts";
import { GCOL, GLIST, GROUP } from "../domain/positions.ts";
import { slotLabels } from "../domain/tactics.ts";
import { rowModel, visibleRows } from "../domain/table.ts";
import { activePlan } from "../state/reducer.ts";
import type { Ui } from "./common.ts";

export function SquadTable({ state, dispatch, rowDown, justDragged, newId }: Ui & { newId: () => string }) {
  const [colsOpen, setColsOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const rows = visibleRows(state);
  const plan = activePlan(state);
  const labels = slotLabels(plan.slots);
  const active = COLS.filter((c) => c.k === "name" || state.data.cols.includes(c.k));
  const grid = active.map((c) => c.w).join(" ");
  const minW = active.reduce((a, c) => a + c.mw + 8, 20);
  const views = [...VIEWS, ...state.data.views];
  const total = state.players.filter((p) => !p.hidden && (state.data.includeYouth || p.squad === "first")).length;

  return (
    <section className="panel" aria-label="Plantel">
      <div className="row2" style={{ justifyContent: "space-between" }}>
        <div className="row2"><span className="h">Plantel · {total}</span></div>
        <input className="inp" style={{ flex: "0 1 200px" }} type="search" aria-label="Buscar jugadores" placeholder="Buscar nombre o posición" value={state.q}
          onChange={(e) => dispatch({ type: "setQuery", q: e.target.value })} />
      </div>
      <div className="row2" role="group" aria-label="Filtrar por posición">
        {["ALL", ...GLIST].map((f) => (
          <button key={f} type="button" className="chip" aria-pressed={state.filter === f} onClick={() => dispatch({ type: "setFilter", filter: f })}>{f === "ALL" ? "Todos" : f}</button>
        ))}
        <button type="button" className="chip" aria-pressed={state.data.includeYouth} onClick={() => dispatch({ type: "toggleYouth" })}>Incluir Reservas y Sub-18</button>
      </div>
      <div className="row2" role="group" aria-label="Vistas del plantel">
        <span className="h" style={{ minWidth: 34 }}>Vista</span>
        {views.map((v) => (
          <button key={v.id} type="button" className="chip" aria-pressed={state.data.viewId === v.id} onClick={() => dispatch({ type: "setView", id: v.id })}>{v.name}</button>
        ))}
        {state.data.viewId === null && <span className="tag mut">Vista modificada</span>}
        <div className="dd" onKeyDown={(e) => { if (e.key === "Escape") setColsOpen(false); }}>
          <button type="button" className="btn" style={{ position: "relative", zIndex: 11 }} aria-haspopup="true" aria-expanded={colsOpen} onClick={() => setColsOpen(!colsOpen)}>
            Columnas · {state.data.cols.length + 1} ▾
          </button>
          {colsOpen && (
            <>
              <button type="button" className="ddback" tabIndex={-1} aria-label="Cerrar menú de columnas" onClick={() => setColsOpen(false)} />
              <div className="ddmenu" style={{ left: "auto", right: 0, width: "min(320px,calc(100vw - 48px))" }}>
                <div className="ddgrp h">Columnas visibles</div>
                {COLS.filter((c) => c.k !== "name").map((c) => {
                  const on = state.data.cols.includes(c.k);
                  return (
                    <button key={c.k} type="button" className={"ddi" + (on ? " on" : "")} role="menuitemcheckbox" aria-checked={on} onClick={() => dispatch({ type: "toggleCol", key: c.k })}>
                      <span>{c.label}</span><span>{on ? "✓" : ""}</span>
                    </button>
                  );
                })}
                <div className="ddgrp h">Guardar como vista</div>
                <div className="row2" style={{ padding: "0 6px 6px" }}>
                  <input className="inp" type="text" maxLength={28} aria-label="Nombre de la vista" placeholder="Ej. Contratos por vencer" value={viewName} onChange={(e) => setViewName(e.target.value)} />
                  <button type="button" className="btn pri" onClick={() => { dispatch({ type: "saveView", name: viewName, id: newId() }); setViewName(""); }}>Guardar</button>
                  {state.data.views.some((v) => v.id === state.data.viewId) && <button type="button" className="btn warn" onClick={() => dispatch({ type: "deleteView" })}>Eliminar vista</button>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="tscroll">
        <div className="tin" role="table" aria-label="Jugadores" style={{ minWidth: minW }}>
          <div className="row head" role="row" style={{ gridTemplateColumns: grid }}>
            {active.map((c) => (
              <span key={c.k} role="columnheader" className={c.r ? "r" : ""}>
                <button type="button" className={"sortb" + (c.r ? " r" : "")} style={{ width: "100%" }} onClick={() => dispatch({ type: "setSort", key: c.k })}>
                  {c.label} {state.sortKey === c.k ? (state.sortDir === 1 ? "↑" : "↓") : ""}
                </button>
              </span>
            ))}
          </div>
          {rows.map((p) => {
            const m = rowModel(state, p);
            const natural = p.natural[0];
            return (
              <div key={p.uid} className={"row" + (m.slot !== null ? " xi" : "") + (state.view === p.uid ? " cur" : "")} role="row" style={{ gridTemplateColumns: grid }}
                onPointerDown={rowDown(p.uid)} onClick={() => { if (!justDragged()) dispatch({ type: "viewPlayer", uid: p.uid }); }}>
                {active.map((c) => {
                  switch (c.k) {
                    case "xi": return <span key={c.k} role="cell" style={{ minWidth: 0 }}>{m.slot !== null && <span className="sbadge" style={{ borderColor: GCOL[GROUP[plan.slots[m.slot].code]] }}>{labels[m.slot]}</span>}</span>;
                    case "name": return <span key={c.k} role="cell" style={{ minWidth: 0 }}><button type="button" className="namebtn" style={{ maxWidth: "100%" }} title={p.name} onClick={() => dispatch({ type: "viewPlayer", uid: p.uid })}>{p.name}</button></span>;
                    case "pos": return <span key={c.k} role="cell" style={{ minWidth: 0 }}><b style={{ color: GCOL[GROUP[natural]] }}>{natural}</b> <span className="muted small">{p.natural.slice(1).join(" ")}</span></span>;
                    case "cub": return <span key={c.k} role="cell" className="small muted" style={{ minWidth: 0 }}>{p.covers.join(" ") || "–"}</span>;
                    case "age": return <span key={c.k} role="cell" className="num">{m.age}</span>;
                    case "wage": return <span key={c.k} role="cell" className="num">{m.wage}</span>;
                    case "rating": return <span key={c.k} role="cell" className="num">{m.ca}</span>;
                    case "exp": return <span key={c.k} role="cell" className={"num" + (m.expWarn ? " warnx" : "")}>{m.exp}{m.expWarn ? " ▲" : ""}</span>;
                    default: return <span key={c.k} role="cell" className="small" style={{ minWidth: 0 }}>{m.role || "–"}</span>;
                  }
                })}
              </div>
            );
          })}
        </div>
      </div>
      {rows.length === 0 && <div className="muted">Ningún jugador coincide.</div>}
    </section>
  );
}
