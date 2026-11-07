import { useState } from "react";
import type { CurrencyCode, Settings } from "../domain/ownerData.ts";
import { seasonEndYear } from "../domain/season.ts";
import type { Action, PlannerState } from "../state/reducer.ts";

function NumberField({ id, label, value, valid, onCommit, hint }: {
  id: string; label: string; value: number | null; valid: (n: number) => boolean; onCommit: (n: number | null) => void; hint?: string;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  return (
    <div className="fld">
      <label className="h" htmlFor={id}>{label}</label>
      <input id={id} className="inp" style={{ flex: "none" }} type="number" step="any" value={text} placeholder={hint}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value === "") { onCommit(null); return; }
          const n = Number(e.target.value);
          if (Number.isFinite(n) && valid(n)) onCommit(n);
        }} />
    </div>
  );
}

export function SettingsModal({ state, dispatch, onClose }: { state: PlannerState; dispatch: (a: Action) => void; onClose: () => void }) {
  const s = state.data.settings;
  const set = (patch: Partial<Settings>) => dispatch({ type: "setSettings", patch });
  return (
    <>
      <button type="button" className="mback" tabIndex={-1} aria-label="Cerrar ajustes" onClick={onClose} />
      <div className="mbox" role="dialog" aria-modal="true" aria-label="Ajustes" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
        <div className="row2" style={{ justifyContent: "space-between" }}>
          <span className="h">Ajustes</span>
          <button type="button" className="btn" onClick={onClose}>Cerrar</button>
        </div>
        <div className="fld">
          <label className="h" htmlFor="teamName">Nombre del equipo</label>
          <input id="teamName" className="inp" style={{ flex: "none" }} type="text" maxLength={28} placeholder="Mi equipo" value={s.team} onChange={(e) => set({ team: e.target.value })} />
        </div>
        <NumberField id="baseYear" label="Año en que termina la temporada actual" value={s.seasonEndOverride}
          valid={(n) => Number.isInteger(n) && n >= 2000 && n <= 2100} onCommit={(n) => set({ seasonEndOverride: n })} hint={String(seasonEndYear(state.gameDate))} />
        <span className="small muted">Vacío = automático, según la fecha del save. Se usa para marcar contratos que vencen antes de cada temporada y para sumar edad en las próximas.</span>
        <div className="fld">
          <label className="h" htmlFor="currency">Moneda</label>
          <select id="currency" className="inp" style={{ flex: "none" }} value={s.currency} onChange={(e) => set({ currency: e.target.value as CurrencyCode })}>
            <option value="GBP">£ libra</option><option value="USD">$ dólar</option><option value="EUR">€ euro</option>
          </select>
          <span className="small muted">El save guarda los sueldos en libras por semana.</span>
        </div>
        <NumberField id="usdRate" label="Dólares por libra" value={s.usdPerGbp} valid={(n) => n > 0} onCommit={(n) => n !== null && set({ usdPerGbp: n })} />
        <NumberField id="eurRate" label="Euros por libra" value={s.eurPerGbp} valid={(n) => n > 0} onCommit={(n) => n !== null && set({ eurPerGbp: n })} />
        <div className="fld">
          <span className="h">Colores del equipo</span>
          <div className="crow2">
            <input id="k1" type="color" value={s.c1} onChange={(e) => set({ c1: e.target.value })} />
            <label htmlFor="k1">Principal · cabecera <span className="muted small">{s.c1}</span></label>
          </div>
          <div className="crow2">
            <input id="k2" type="color" value={s.c2} onChange={(e) => set({ c2: e.target.value })} />
            <label htmlFor="k2">Acento · botones y selección <span className="muted small">{s.c2}</span></label>
          </div>
        </div>
        <div className="row2">
          <button type="button" className="btn" onClick={() => set({ c1: s.c2, c2: s.c1 })}>Invertir colores</button>
          <button type="button" className="btn" onClick={() => set({ c1: "#0b5d3b", c2: "#f2b84b" })}>Restablecer</button>
        </div>
      </div>
    </>
  );
}
