import { useRef } from "react";
import { bandsOf } from "../domain/depth.ts";
import { GCOL, GROUP } from "../domain/positions.ts";
import { fitOf } from "../domain/squad.ts";
import { slotLabels } from "../domain/tactics.ts";
import { activePlan, type Action, type PlannerState } from "../state/reducer.ts";

const FIT_WORD = { nat: "natural", near: "cubre", out: "fuera de posición" } as const;

export function Pitch({ state, dispatch, dragOver }: { state: PlannerState; dispatch: (a: Action) => void; dragOver?: number | null }) {
  const slots = activePlan(state).slots;
  const labels = slotLabels(slots);
  const byUid = new Map(state.players.map((p) => [p.uid, p]));
  const drag = useRef<{ i: number; sx: number; sy: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width || !r.height) return;
    d.moved = true;
    dispatch({ type: "moveSlot", index: d.i, x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };
  const onUp = () => {
    if (drag.current?.moved) {
      justDragged.current = true;
      setTimeout(() => { justDragged.current = false; }, 120);
    }
    drag.current = null;
  };

  return (
    <div className="pitch" onClick={() => { if (justDragged.current) { justDragged.current = false; return; } dispatch({ type: "selectSlot", index: null }); }}
      onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onPointerCancel={onUp}>
      <svg className="lines" viewBox="0 0 78 100" aria-hidden="true">
        <g fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="0.35">
          <rect x="3" y="3" width="72" height="94" /><line x1="3" y1="50" x2="75" y2="50" /><circle cx="39" cy="50" r="8.5" />
          <rect x="15" y="3" width="48" height="15" /><rect x="26" y="3" width="26" height="5.5" /><path d="M33 18 A8.5 8.5 0 0 0 45 18" />
          <rect x="34" y="1.4" width="10" height="1.6" /><rect x="15" y="82" width="48" height="15" /><rect x="26" y="91.5" width="26" height="5.5" />
          <path d="M33 82 A8.5 8.5 0 0 1 45 82" /><rect x="34" y="97" width="10" height="1.6" />
        </g>
        <g fill="rgba(255,255,255,0.5)"><circle cx="39" cy="50" r="0.55" /><circle cx="39" cy="12" r="0.55" /><circle cx="39" cy="88" r="0.55" /></g>
      </svg>
      {slots.map((s, i) => {
        const p = s.uid !== null ? byUid.get(s.uid) : undefined;
        const name = p ? p.name : s.uid !== null ? state.data.known[s.uid]?.name ?? "Jugador" : null;
        const f = p ? fitOf(p, s.code) : null;
        const bad = f === "out";
        const near = f === "near";
        const b = bandsOf(s);
        const nat = (u: number | null | undefined) => { const q = u !== null && u !== undefined ? byUid.get(u) : undefined; return !!q && fitOf(q, s.code) === "nat"; };
        const lack = !(nat(b.t) && nat(b.s[0]));
        const col = GCOL[GROUP[s.code]];
        const left = s.uid !== null && state.left.includes(s.uid);
        const aria = `Puesto ${labels[i]}${s.role ? ", " + s.role : ""}, ${name ? name + ", " + (left ? "ya no está en la plantilla" : f ? FIT_WORD[f] : "") : "vacío"}` +
          `${lack ? ", alerta: faltan 2 naturales entre titular y suplente" : ""}${i === state.sel ? ", seleccionado" : ""}`;
        return (
          <button key={i} type="button" className={"tok " + (name ? "filled" : "empty") + (i === state.sel ? " sel" : "") + (i === dragOver ? " drop" : "")}
            data-slot={i} style={{ left: `${s.x}%`, top: `${s.y}%` }} aria-label={aria}
            onPointerDown={(e) => { drag.current = { i, sx: e.clientX, sy: e.clientY, moved: false }; dispatch({ type: "selectSlot", index: i }); }}
            onClick={(e) => { e.stopPropagation(); dispatch({ type: "selectSlot", index: i }); }}
            onKeyDown={(e) => {
              const m = ({ ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] } as Record<string, number[]>)[e.key];
              if (!m) return;
              e.preventDefault();
              dispatch({ type: "moveSlot", index: i, x: s.x + m[0], y: s.y + m[1] });
              dispatch({ type: "selectSlot", index: i });
            }}>
            <span className="dw">
              <span className={"disc" + (labels[i].length > 3 ? " long" : "")} style={{ borderColor: col, background: name ? col : "rgba(14,19,17,0.5)", color: name ? "#0e1311" : "#d5e4db" }}>{labels[i]}</span>
              {(bad || near) && <span className={"bdg " + (bad ? "out" : "near")} aria-hidden="true">{bad ? "!" : "~"}</span>}
              {lack && <span className="adot" aria-hidden="true" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
