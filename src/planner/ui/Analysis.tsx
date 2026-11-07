import { activePlan } from "../state/reducer.ts";
import { chartsFor, kpis } from "../domain/stats.ts";
import { pool, type Ui } from "./common.ts";

export function Analysis({ state, dispatch }: Ui) {
  const charts = chartsFor(pool(state), activePlan(state).slots, state.scope, state.season - state.base, state.gameDate, state.data.settings);
  return (
    <section className="panel" aria-label="Análisis del plantel">
      <div className="row2" style={{ justifyContent: "space-between" }}>
        <span className="h">Por posición</span>
        <div className="seg" role="group" aria-label="Alcance de los gráficos">
          <button type="button" aria-pressed={state.scope === "squad"} onClick={() => dispatch({ type: "setScope", scope: "squad" })}>Todo el plantel</button>
          <button type="button" aria-pressed={state.scope === "xi"} onClick={() => dispatch({ type: "setScope", scope: "xi" })}>Once inicial</button>
        </div>
      </div>
      <div className="charts">
        {charts.map((c) => (
          <div className="card" key={c.title}>
            <div className="cap"><span className="h">{c.title}</span><b>{c.total}</b></div>
            {c.rows.map((r) => (
              <div className="crow" key={r.label}>
                <span><i className="dot" style={{ background: r.color }} />{r.label}</span>
                <span className="track" aria-hidden="true"><span className="bar" style={{ width: `${r.w}%`, background: r.color }} /></span>
                <span className="cval">{r.val}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export function Kpis({ state }: Ui) {
  const k = kpis(state.players, state.club);
  return (
    <section className="panel" aria-label="KPIs">
      <span className="h">KPIs</span>
      <div className="charts">
        <div className="card"><span className="h">Canteranos · plantel total</span><b className="kpi">{k.total}</b><span className="small muted">de {k.of}</span></div>
        <div className="card"><span className="h">Canteranos · liga local</span><b className="kpi">{k.local}</b><span className="small muted">de {k.of}</span></div>
      </div>
      <span className="small muted">Aproximado, solo primer equipo: plantel total = formado en el club; liga local = formado en la nación del club. Aún no reproduce la regla exacta del juego.</span>
    </section>
  );
}
