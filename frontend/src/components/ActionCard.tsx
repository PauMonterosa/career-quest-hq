import type { ActionOption } from "../data/agentActions";

export function ActionCard({ action, busy, onRun }: { action: ActionOption; busy: boolean; onRun: () => void }) {
  const category = action.approval ? "APPROVAL" : action.kind === "web" ? "WEB" : action.kind === "auto" ? "HQ AUTO" : "HQ";
  const verb = action.kind === "web" ? "Investigar" : action.approval ? "Preparar borrador" : action.kind === "auto" ? "Crear plan" : "Analizar";
  return <article className={`action-card action-${action.kind}`}>
    <div className="action-card-head"><span>{category}</span><i aria-hidden="true">{action.kind === "web" ? "⌁" : action.approval ? "✎" : "◆"}</i></div>
    <h3>{action.title}</h3>
    <p>{action.purpose}</p>
    <dl><div><dt>Entrada</dt><dd>{action.source}</dd></div><div><dt>Resultado</dt><dd>{action.outcome}</dd></div></dl>
    <button onClick={onRun} disabled={busy}>{busy ? "Trabajando…" : verb}</button>
  </article>;
}

