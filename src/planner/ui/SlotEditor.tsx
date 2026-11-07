import { BAND, BANDS, bandsOf, type BandId } from "../domain/depth.ts";
import { money } from "../domain/money.ts";
import { GCOL, GROUP, ROLES } from "../domain/positions.ts";
import { ageAt, expiryWarn, expiryYear } from "../domain/season.ts";
import { fitOf } from "../domain/squad.ts";
import { slotLabels } from "../domain/tactics.ts";
import { activePlan } from "../state/reducer.ts";
import { slotIndexOf, type Ui } from "./common.ts";

const FIT_TXT = ["Natural", "Cubre", "Fuera de pos."];
const EMPTY_TXT: Record<BandId, string> = { t: "Sin titular", s: "Hasta 2 suplentes", r: "Hasta 3 recambios o juveniles", o: "Sin jugadores" };

export function SlotEditor({ state, dispatch, rowDown, justDragged, overBand }: Ui & { overBand: BandId | null }) {
  const plan = activePlan(state);
  const sel = state.sel!;
  const slot = plan.slots[sel];
  const label = slotLabels(plan.slots)[sel];
  const bands = bandsOf(slot);
  const band = state.band;
  const byUid = new Map(state.players.map((p) => [p.uid, p]));
  const inXi = slotIndexOf(state);
  const labels = slotLabels(plan.slots);
  const bandOf = (uid: number): BandId | null => (bands.t === uid ? "t" : (["s", "r", "o"] as const).find((k) => bands[k].includes(uid)) ?? null);
  const full = (k: BandId) => k !== "t" && bands[k].length >= BAND[k].max;
  const rank = (p: { natural: never[] } & Parameters<typeof fitOf>[0]) => { const f = fitOf(p, slot.code); return f === "nat" ? 0 : f === "near" ? 1 : 2; };
  const offset = state.season - state.base;
  const cands = state.players
    .filter((p) => !p.hidden)
    .map((p) => ({ p, r: rank(p as never) }))
    .sort((a, b) => a.r - b.r || b.p.ca - a.p.ca)
    .filter(({ p, r }) => (state.showAll || r < 2) && (state.data.includeYouth || p.squad === "first" || bandOf(p.uid) !== null));
  const nameOf = (uid: number) => byUid.get(uid)?.name ?? state.data.known[uid]?.name ?? "?";
  const gone = (uid: number) => state.left.includes(uid);
  const emptySlot = slot.uid === null && !slot.role && slot.alt.length === 0;

  return (
    <section className="panel" aria-label="Rol y jugador para el puesto elegido">
      <div className="row2" style={{ justifyContent: "space-between" }}>
        <span className="h">{label} · {cands.length} disponibles</span>
        <div className="row2">
          <button type="button" className="btn warn" disabled={emptySlot} onClick={() => dispatch({ type: "clearSlot" })}>Vaciar posición</button>
          <button type="button" className="btn" onClick={() => dispatch({ type: "selectSlot", index: null })}>Ver plantel completo</button>
        </div>
      </div>
      <div className="row2" role="group" aria-label="Rol del puesto">
        <span className="h" style={{ minWidth: 34 }}>Rol</span>
        {(ROLES[slot.code] ?? []).map((r) => (
          <button key={r} type="button" className="chip" aria-pressed={slot.role === r} onClick={() => dispatch({ type: "setRole", role: r })}>{r}</button>
        ))}
      </div>
      <div className="card" role="group" aria-label="Profundidad del puesto">
        <span className="h">Profundidad · tocá una franja y elegí abajo, o arrastrá jugadores a la franja</span>
        {BANDS.map((k) => {
          const arr = k === "t" ? (bands.t !== null ? [bands.t] : []) : bands[k];
          return (
            <div key={k} className={"band" + (overBand === k ? " drop" : "")} data-band={k}>
              <div className="bhead">
                <button type="button" className="bsel" aria-pressed={k === band} onClick={() => { if (!justDragged()) dispatch({ type: "setBand", band: k }); }}>
                  {BAND[k].title} <span className="bcount">{k === "o" ? String(arr.length) : `${arr.length}/${BAND[k].max}`}</span>
                </button>
                <span className="bline" aria-hidden="true" />
              </div>
              {arr.length === 0 && <div className="bempty">{EMPTY_TXT[k]}</div>}
              {arr.map((uid, i) => (
                <div className="drow" key={uid}>
                  <button type="button" className="item" onPointerDown={rowDown(uid)} onClick={() => { if (!justDragged()) dispatch({ type: "viewPlayer", uid }); }}>
                    <b>{i + 1}</b><span>{nameOf(uid)}</span>{gone(uid) && <span className="muted small"> ya no está en la plantilla</span>}
                  </button>
                  {k !== "t" && (
                    <>
                      <button type="button" className="mini" aria-label={`Subir a ${nameOf(uid)}`} disabled={i === 0} onClick={() => dispatch({ type: "moveInBand", band: k, i, dir: -1 })}>▲</button>
                      <button type="button" className="mini" aria-label={`Bajar a ${nameOf(uid)}`} disabled={i === arr.length - 1} onClick={() => dispatch({ type: "moveInBand", band: k, i, dir: 1 })}>▼</button>
                    </>
                  )}
                  <button type="button" className="mini" aria-label={`Quitar a ${nameOf(uid)} de la lista`} onClick={() => dispatch({ type: "removeInBand", band: k, i })}>✕</button>
                </div>
              ))}
            </div>
          );
        })}
        {state.bandMsg && <div className="small warnx" role="alert">{state.bandMsg}</div>}
      </div>
      <div className="row2">
        <button type="button" className="btn" onClick={() => dispatch({ type: "toggleShowAll" })}>{state.showAll ? "Solo naturales y que cubren" : "Mostrar todas las posiciones"}</button>
        <button type="button" className="btn" onClick={() => dispatch({ type: "toggleYouth" })}>{state.data.includeYouth ? "Ocultar Reservas y Sub-18" : "Mostrar Reservas y Sub-18"}</button>
      </div>
      <div className="tscroll" style={{ maxHeight: 340 }}>
        <div className="tin" role="table" aria-label="Jugadores para el puesto elegido" style={{ minWidth: 780 }}>
          {cands.map(({ p, r }) => {
            const si = inXi.get(p.uid);
            const u = bandOf(p.uid);
            const inSel = u === band;
            const isFull = !inSel && full(band);
            const end = p.contract?.end ?? null;
            const warn = expiryWarn(end, state.season);
            const word = BAND[band].word;
            return (
              <div key={p.uid} className={"prow" + (u ? " cur" : "")} role="row" onPointerDown={rowDown(p.uid)}>
                <span role="cell"><span className={"fit f" + r}>{FIT_TXT[r]}</span></span>
                <span role="cell" style={{ minWidth: 0 }}><b>{p.name}</b> <span className="muted small">{u ? `${BAND[u].word} aquí` : si !== undefined ? `en el XI como ${labels[si]}` : ""}</span></span>
                <span role="cell"><b style={{ color: GCOL[GROUP[p.natural[0]]] }}>{p.natural[0]}</b> <span className="muted small">{p.natural.slice(1).join(" ")}</span></span>
                <span role="cell" className="num">{ageAt(p.birthDate, state.gameDate, offset)}</span>
                <span role="cell" className="num">{money(p.contract?.wageGbpWeek ?? 0, state.data.settings)}</span>
                <span role="cell" className="num">{p.ca}</span>
                <span role="cell" className={"num" + (warn ? " warnx" : "")}>{expiryYear(end) ?? "–"}{warn ? " ▲" : ""}</span>
                <span role="cell" className="num">
                  <button type="button" className="pick" disabled={inSel || isFull}
                    aria-label={(inSel ? `${p.name} ya es ` : `Poner a ${p.name} como `) + `${word} de ${label}`}
                    onClick={() => { if (!justDragged()) dispatch({ type: "pick", uid: p.uid }); }}>
                    {inSel ? "Elegido" : isFull ? "Completa" : u ? "Mover aquí" : si !== undefined && band === "t" ? "Intercambiar" : "Elegir"}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {cands.length === 0 && <div className="muted">No hay jugadores naturales ni que cubran el puesto. Mostrá todas las posiciones para elegir a alguien fuera de posición.</div>}
    </section>
  );
}
