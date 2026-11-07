import { bandsOf, BAND } from "../domain/depth.ts";
import { money } from "../domain/money.ts";
import { GCOL, GROUP, POS_LIST } from "../domain/positions.ts";
import { ageAt, expiryWarn, expiryYear } from "../domain/season.ts";
import { fitOf } from "../domain/squad.ts";
import { statusLabel } from "../domain/stats.ts";
import { slotLabels } from "../domain/tactics.ts";
import { activePlan } from "../state/reducer.ts";
import { slotIndexOf, type Ui } from "./common.ts";

const FIT_WORD = { nat: "natural", near: "cubre", out: "fuera de posición" } as const;

export function PlayerDetail({ state, dispatch }: Ui) {
  const plan = activePlan(state);
  const labels = slotLabels(plan.slots);
  const p = state.view !== null ? state.players.find((x) => x.uid === state.view) : undefined;
  const ghost = state.view !== null && !p ? state.data.known[state.view]?.name : undefined;
  const sel = state.sel !== null ? plan.slots[state.sel] : null;
  const selLabel = state.sel !== null ? labels[state.sel] : "";
  const bands = sel ? bandsOf(sel) : null;
  const here = p && bands ? (bands.t === p.uid ? "t" : (["s", "r", "o"] as const).find((k) => bands[k].includes(p.uid)) ?? null) : null;
  const bandFull = bands && state.band !== "t" ? bands[state.band].length >= BAND[state.band].max : false;
  const slot = p ? slotIndexOf(state).get(p.uid) : undefined;
  const offset = state.season - state.base;

  return (
    <section className="panel" aria-label="Detalle del jugador">
      <span className="h">Jugador</span>
      {!p && !ghost && <div className="muted">Elegí un jugador de la lista, o hacé clic en un puesto ocupado de la cancha.</div>}
      {ghost && !p && (
        <div className="detail"><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="dname">{ghost}</span><span className="small warnx">ya no está en la plantilla</span>
        </div></div>
      )}
      {p && (
        <>
          <div className="detail">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="dname">{p.name}</span>
              <span>{p.natural.map((c) => <span key={c} className={"pc" + (sel && c === sel.code ? " on" : "")} style={{ borderColor: GCOL[GROUP[c]] }}>{c}</span>)}</span>
            </div>
            <div className="st"><span className="h">Edad</span><b>{ageAt(p.birthDate, state.gameDate, offset)}</b></div>
            <div className="st"><span className="h">Sueldo / sem.</span><b>{money(p.contract?.wageGbpWeek ?? 0, state.data.settings)}</b></div>
            <div className="st"><span className="h">Rating</span><b>{p.ca}</b></div>
            <div className="st"><span className="h">Contrato hasta</span><b className={expiryWarn(p.contract?.end ?? null, state.season) ? "warnx" : ""}>{expiryYear(p.contract?.end ?? null) ?? "–"}{expiryWarn(p.contract?.end ?? null, state.season) ? " ▲" : ""}</b></div>
            {p.contract?.squadNumber != null && <div className="st"><span className="h">Dorsal</span><b>{p.contract.squadNumber}</b></div>}
            {statusLabel(p.contract?.squadStatusCode ?? null) && <div className="st"><span className="h">Estado</span><b style={{ fontSize: 18 }}>{statusLabel(p.contract?.squadStatusCode ?? null)}</b></div>}
            <div className="st"><span className="h">Rol</span><b style={{ fontSize: 18 }}>{slot !== undefined ? `${labels[slot]} · ${FIT_WORD[fitOf(p, plan.slots[slot].code)]}` : "No está en el XI"}</b></div>
          </div>
          <div className="row2" role="group" aria-label="Posiciones del jugador: natural, cubre o no cubre">
            {POS_LIST.map((c) => {
              const s = p.natural.includes(c) ? 2 : p.covers.includes(c) ? 1 : 0;
              const word = ["No cubre", "Cubre", "Natural"][s];
              return (
                <button key={c} type="button" className={"pst s" + s} aria-label={`${c}: ${word.toLowerCase()}. Clic para cambiar`} onClick={() => dispatch({ type: "cyclePos", uid: p.uid, code: c })}>
                  {c}<span>{word}</span>
                </button>
              );
            })}
          </div>
          {state.posMsg && <div className="small warnx">{state.posMsg}</div>}
          <div className="row2" role="group" aria-label="Posición principal">
            <span className="h" style={{ minWidth: 78 }}>Principal</span>
            {p.natural.map((c, k) => <button key={c} type="button" className="chip" aria-pressed={k === 0} onClick={() => dispatch({ type: "setPrimary", uid: p.uid, code: c })}>{c}</button>)}
          </div>
          <div className="small muted">Tocá una posición para ir alternando: no cubre → natural → cubre → no cubre. Es tu criterio como DT, más allá de lo que diga el juego. La primera natural (“Principal”) define el grupo en gráficos y filtros.</div>
          <div className="row2">
            {sel && (
              <button type="button" className="btn pri" disabled={here === state.band || bandFull} onClick={() => dispatch({ type: "pick", uid: p.uid })}>
                {here === state.band ? `Ya es ${BAND[state.band].word} de ${selLabel}` : bandFull ? `${BAND[state.band].title}: franja completa` : `Poner como ${BAND[state.band].word} de ${selLabel}`}
              </button>
            )}
            <button type="button" className="btn warn" onClick={() => dispatch({ type: "removePlayer", uid: p.uid })}>Quitar del plantel</button>
          </div>
        </>
      )}
    </section>
  );
}
