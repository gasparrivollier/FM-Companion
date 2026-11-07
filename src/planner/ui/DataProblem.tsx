import { useState } from "react";

export interface DataTools { backupAndReset(): Promise<{ backupPath: string }>; openFolder(): Promise<void> }

/**
 * The owner's data file cannot be used. Nothing is written from here. "Empezar de cero" first asks, then copies the file,
 * and only then does the host remove it (backupAndReset refuses if the copy fails).
 */
export function DataProblem({ message, tools, onContinue }: { message: string; tools?: DataTools; onContinue: () => void }) {
  const [step, setStep] = useState<"idle" | "confirm" | "done">("idle");
  const [backup, setBackup] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = async () => {
    try { setBackup((await tools!.backupAndReset()).backupPath); setStep("done"); setError(null); }
    catch (e) { setError(`No se pudo guardar la copia, no se cambió nada: ${String((e as Error)?.message ?? e)}`); setStep("idle"); }
  };
  return (
    <div className="app">
      <div className="panel" role="alert" style={{ flex: "1 1 100%" }}>
        <h1 className="tname">No se pueden cargar tus datos</h1>
        <p>{message}</p>
        <p className="small muted">La app no escribió nada: tu archivo sigue como estaba.</p>
        {error && <p className="small warnx">{error}</p>}
        {tools && step === "idle" && (
          <div className="row2">
            <button type="button" className="btn" onClick={() => void tools.openFolder()}>Abrir carpeta de datos</button>
            <button type="button" className="btn warn" onClick={() => setStep("confirm")}>Guardar copia y empezar de cero</button>
          </div>
        )}
        {tools && step === "confirm" && (
          <div className="row2">
            <span>Se guardará una copia de tu archivo actual y se empezará con datos nuevos. ¿Continuar?</span>
            <button type="button" className="btn warn" onClick={() => void reset()}>Sí, guardar copia y empezar</button>
            <button type="button" className="btn" onClick={() => setStep("idle")}>No</button>
          </div>
        )}
        {step === "done" && (
          <div className="row2">
            <span>Copia guardada en: {backup}</span>
            <button type="button" className="btn pri" onClick={onContinue}>Continuar</button>
          </div>
        )}
      </div>
    </div>
  );
}
