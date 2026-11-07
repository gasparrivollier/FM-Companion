import type { Action, PlannerState } from "../state/reducer.ts";
import { activePlan } from "../state/reducer.ts";
import type { PlannerPlayer } from "../domain/squad.ts";

export interface Ui {
  state: PlannerState;
  dispatch: (a: Action) => void;
  rowDown: (uid: number) => (e: React.PointerEvent) => void;
  justDragged: () => boolean;
}

/** Players shown by default: the first team, plus Reservas and Sub-18 when the owner asked for them; removed ones never. */
export function pool(state: PlannerState): PlannerPlayer[] {
  return state.players.filter((p) => !p.hidden && (state.data.includeYouth || p.squad === "first"));
}
export function slotIndexOf(state: PlannerState): Map<number, number> {
  const m = new Map<number, number>();
  activePlan(state).slots.forEach((s, i) => { if (s.uid !== null) m.set(s.uid, i); });
  return m;
}
