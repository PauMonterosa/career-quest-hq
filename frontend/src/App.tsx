import { useEffect, useState } from "react";
import { api } from "./api/client";
import { AgentPanel } from "./components/AgentPanel";
import { GameCanvas } from "./components/GameCanvas";
import { ProductHeader } from "./components/ProductHeader";
import { ResultDrawer } from "./components/ResultDrawer";
import { ResultToast } from "./components/ResultToast";
import { clearMapFeedback, focusAgent, gameEvents, moveAgent, setVisualStatus, showAgentDialogue, syncAgents } from "./game/events";
import type { Agent, TaskResponse } from "./types";
import { importWorkbook } from "./services/localMode";

const destinations: Record<string, string> = {
  atlas: "masters_archive", nova: "tfg_laboratory", echo: "mail_room",
  chronos: "control_room", pixel: "portfolio_workshop",
  brasa: "food_kitchen",
  pilot: "air_operations",
};

const missionMessages: Record<string, string> = {
  suggest_shortlist: "Voy a comparar tus másteres y destacar los tres con mejor puntuación.",
  research_master_sources: "Voy a revisar las webs oficiales y guardar evidencias verificables.",
  list_top_tfg_opportunities: "Voy a ordenar tus oportunidades de TFG por prioridad.",
  research_tfg_sources: "Voy a investigar líneas, proyectos y contactos de estos centros.",
  draft_tfg_email: "Voy a preparar una plantilla de correo para que la revises.",
  draft_researched_tfg_email: "Voy a convertir la investigación de NOVA en un correo personalizado.",
  list_urgent_tasks: "Voy a detectar qué tareas requieren atención inmediata.",
  build_weekly_plan: "Voy a distribuir tus tareas por días según fecha y prioridad.",
  list_portfolio_priorities: "Voy a localizar las piezas más importantes de tu portfolio.",
  build_portfolio_delivery_plan: "Voy a convertir tus tareas en entregables claros y publicables.",
  review_foodtruck_status: "Voy a revisar tu menú, presupuesto y compra pendientes en FoodTruck.",
  coordinate_busy_week: "Voy a cruzar tu cocina con la carga de trabajo que gestiona CHRONOS.",
  scan_europe_flights: "Voy a consultar el radar diario y ordenar las tarifas europeas más bajas.",
  show_interesting_fares: "Voy a filtrar únicamente los vuelos que cumplen tu umbral de precio.",
};

const agentGreetings: Record<string, string> = {
  atlas: "Puedo comparar tus másteres o investigar sus fuentes oficiales.",
  nova: "Puedo priorizar tus TFG o investigar centros y líneas de trabajo.",
  echo: "Puedo preparar correos y personalizarlos con la investigación de NOVA.",
  chronos: "Puedo detectar urgencias y construir tu plan semanal.",
  pixel: "Puedo ordenar tu portfolio y convertirlo en entregables concretos.",
  brasa: "Puedo leer FoodTruck y coordinar comidas, compra y tiempo con CHRONOS.",
  pilot: "Vigilo vuelos europeos cada día y te aviso cuando aparece una tarifa interesante.",
};

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [result, setResult] = useState<TaskResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [importStatus, setImportStatus] = useState("Modo local disponible");
  const selected = agents.find(agent => agent.id === selectedId) ?? null;

  useEffect(() => {
    api.agents().then(data => {
      setAgents(data);
      setSelectedId(data.find(agent => agent.id === "chronos")?.id ?? data[0]?.id ?? null);
      window.setTimeout(() => syncAgents(data), 150);
    }).catch(() => setError("No se ha podido conectar con el HQ."));
    const listener = (event: Event) => {
      const agentId = (event as CustomEvent<string>).detail;
      setSelectedId(agentId); setResult(null); setDrawerOpen(false); setToastVisible(false); clearMapFeedback();
      showAgentDialogue(agentId, agentGreetings[agentId] ?? "Selecciona una misión para empezar.", "mission");
    };
    gameEvents.addEventListener("agent-selected", listener);
    return () => gameEvents.removeEventListener("agent-selected", listener);
  }, []);

  function select(agent: Agent) {
    setSelectedId(agent.id); setResult(null); setDrawerOpen(false); setToastVisible(false); clearMapFeedback(); focusAgent(agent.id);
    showAgentDialogue(agent.id, agentGreetings[agent.id] ?? "Selecciona una misión para empezar.", "mission");
  }

  async function handleImport(file: File) {
    setImportStatus("Importando…");
    try {
      const counts = await importWorkbook(file);
      setImportStatus(`${counts.tasks} tareas · ${counts.masters} másteres · ${counts.tfg} TFG`);
    } catch (caught) {
      setImportStatus(caught instanceof Error ? caught.message : "No se pudo leer el Excel");
    }
  }

  async function run(skill: string) {
    if (!selected) return;
    setBusy(true); setError(null); setResult(null); setDrawerOpen(false); setToastVisible(false); clearMapFeedback();
    showAgentDialogue(selected.id, missionMessages[skill] ?? "Voy a ejecutar esta misión con tus datos.", "mission");
    moveAgent(selected.id, destinations[selected.id]);
    setAgents(current => current.map(agent => agent.id === selected.id ? { ...agent, status: "walking" } : agent));
    await new Promise(resolve => window.setTimeout(resolve, 1950));
    setAgents(current => current.map(agent => agent.id === selected.id ? { ...agent, status: "working" } : agent));
    showAgentDialogue(selected.id, "Estoy trabajando. Te avisaré cuando el resultado esté listo.", "working");
    try {
      const response = await api.runTask(selected.id, skill);
      await new Promise(resolve => window.setTimeout(resolve, 2200));
      setResult(response); setToastVisible(true);
      setAgents(current => current.map(agent => agent.id === selected.id
        ? { ...agent, status: response.status, current_room: destinations[agent.id], last_result: response.result } : agent));
      setVisualStatus(selected.id, response.status);
      showAgentDialogue(selected.id, response.requires_approval ? "Resultado listo. Necesito tu aprobación." : "Resultado listo.", "result");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La tarea no se ha podido completar.");
      setVisualStatus(selected.id, "error");
    } finally { setBusy(false); }
  }

  return <main className="app-shell">
    <ProductHeader activeTasks={agents.filter(agent => ["walking", "working"].includes(agent.status)).length}
      approvals={agents.filter(agent => agent.status === "waiting_approval").length}
      onImport={handleImport} importStatus={importStatus} />
    <section className="main-workspace">
      <section className="hq-column" aria-label="Mundo Career Quest">
        <div className="hq-heading"><div><span>HQ WORLD · FLOOR 01</span><h1>Tu futuro, convertido en misiones.</h1></div><p>Selecciona un agente o pulsa sobre el suelo para explorar.</p></div>
        <div className="hq-viewport">
          <GameCanvas />
          {toastVisible && selected && result && <ResultToast agent={selected} result={result}
            onView={() => { setDrawerOpen(true); setToastVisible(false); }} onClose={() => setToastVisible(false)} />}
        </div>
        <nav className="agent-strip" aria-label="Seleccionar agente">
          {agents.map(agent => <button key={agent.id} className={selectedId === agent.id ? "active" : ""}
            aria-pressed={selectedId === agent.id} aria-label={`Seleccionar ${agent.name}, ${agent.status.replace("_", " ")}`}
            onClick={() => select(agent)}>
            <i style={{ background: agent.avatar.color }} />{agent.name}<small>{agent.status.replace("_", " ")}</small>
          </button>)}
        </nav>
        <ResultDrawer agent={selected} result={result} open={drawerOpen} onToggle={() => setDrawerOpen(value => !value)} />
      </section>
      <AgentPanel agent={selected} busy={busy} error={error} onRun={run} />
    </section>
    <footer className="product-footer"><span>Workbook de solo lectura</span><span>Acciones externas protegidas</span><span>Resultados auditables</span></footer>
  </main>;
}
