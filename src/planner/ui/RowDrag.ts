import { useEffect, useRef, useState } from "react";
import type { BandId } from "../domain/depth.ts";

export interface DragTarget { slot: number | null; band: BandId | null }
export interface DragView { uid: number; gx: number; gy: number; overSlot: number | null; overBand: BandId | null }

/**
 * Pointer-based drag of a player row onto a pitch token or a depth band (prototype lines 814-855). Plain pointer events, so
 * it works the same with a mouse or a pen; jsdom has no layout, so this is checked by hand in a browser.
 */
export function useRowDrag(onDrop: (uid: number, target: DragTarget) => void) {
  const [drag, setDrag] = useState<DragView | null>(null);
  const info = useRef<{ uid: number; sx: number; sy: number; moved: boolean } | null>(null);
  const just = useRef(false);
  const drop = useRef(onDrop);
  drop.current = onDrop;

  const hit = (e: PointerEvent): DragTarget => {
    const el = typeof document.elementFromPoint === "function" ? document.elementFromPoint(e.clientX, e.clientY) : null;
    const s = el?.closest?.("[data-slot]")?.getAttribute("data-slot");
    const b = el?.closest?.("[data-band]")?.getAttribute("data-band");
    return { slot: s != null ? parseInt(s, 10) : null, band: (b as BandId | null) ?? null };
  };
  const move = useRef((e: PointerEvent) => {
    const d = info.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return;
    if (!d.moved) { d.moved = true; document.body.style.userSelect = "none"; }
    const t = hit(e);
    setDrag({ uid: d.uid, gx: e.clientX, gy: e.clientY, overSlot: t.slot, overBand: t.band });
  });
  const up = useRef((e: PointerEvent) => {
    const d = info.current;
    document.removeEventListener("pointermove", move.current);
    document.removeEventListener("pointerup", up.current);
    document.removeEventListener("pointercancel", up.current);
    info.current = null;
    document.body.style.userSelect = "";
    setDrag(null);
    if (!d || !d.moved) return;
    just.current = true;
    setTimeout(() => { just.current = false; }, 150);
    if (e.type === "pointerup") {
      const t = hit(e);
      if (t.slot !== null || t.band !== null) drop.current(d.uid, t);
    }
  });
  useEffect(() => () => {
    document.removeEventListener("pointermove", move.current);
    document.removeEventListener("pointerup", up.current);
    document.removeEventListener("pointercancel", up.current);
  }, []);

  return {
    drag,
    justDragged: () => just.current,
    rowDown: (uid: number) => (e: React.PointerEvent) => {
      if (e.button > 0 || info.current) return;
      info.current = { uid, sx: e.clientX, sy: e.clientY, moved: false };
      document.addEventListener("pointermove", move.current);
      document.addEventListener("pointerup", up.current);
      document.addEventListener("pointercancel", up.current);
    },
  };
}
