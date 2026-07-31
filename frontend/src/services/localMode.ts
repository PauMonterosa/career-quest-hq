import readXlsxFile from "read-excel-file/browser";
import type { Agent, TaskResponse } from "../types";
import { compactEvidence, fetchIntelligence, inspectGitHub } from "./liveIntelligence";

type Row = Record<string, unknown>;
type LocalData = { masters: Row[]; tfg: Row[]; tasks: Row[]; emails: Row[]; documents: Row[]; importedAt?: string };
type DataTarget = Exclude<keyof LocalData, "importedAt">;
const STORAGE_KEY = "career-quest-hq-data-v1";
const FOODTRUCK_KEY = "career-quest-foodtruck-v1";
const FOODTRUCK_URL = "https://paumonterosa.github.io/foodtruck/";
const normalize = (input: unknown) => String(input ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const value = (row: Row, keys: string[]) => keys.map(normalize).map(key => row[key]).find(item => item !== "" && item != null);

function detectTarget(sheetName: string, headers: string[]): DataTarget | null {
  const name = normalize(sheetName); const headerSet = new Set(headers);
  const has = (...candidates: string[]) => candidates.some(candidate => headerSet.has(normalize(candidate)));
  if (/mapa.*master|master.*mapa/.test(name) || (has("programa") && has("universitat", "universidad"))) return "masters";
  if (/tfg/.test(name) || (has("possible_tfg", "posible_tfg") && has("centre", "centro"))) return "tfg";
  if (/pla.*accio|accion|tasques|tareas/.test(name) || (has("tasca", "tarea") && has("estat", "estado", "status"))) return "tasks";
  if (/correu|email|mail/.test(name) || has("assumpte", "asunto", "destinatari", "destinatario")) return "emails";
  if (/document|portfolio/.test(name) || (has("document", "fitxer", "archivo") && has("estat", "estado", "status"))) return "documents";
  return null;
}

const DEFAULT_AGENTS: Agent[] = [
  ["atlas", "ATLAS", "Master Programme Scout", "Analytical explorer", "masters_archive", "#4b8cff", "map"],
  ["nova", "NOVA", "TFG and Research Scout", "Curious scientist", "tfg_laboratory", "#48c98a", "flask"],
  ["echo", "ECHO", "Email and Communication Assistant", "Diplomatic and precise", "mail_room", "#ef5b62", "envelope"],
  ["chronos", "CHRONOS", "Deadline Manager", "Strict but helpful", "control_room", "#f5c84c", "clock"],
  ["pixel", "PIXEL", "Portfolio and Project Coach", "Creative engineer", "portfolio_workshop", "#a775ff", "tools"],
  ["brasa", "BRASA", "Chef and Provisions Coordinator", "Practical, warm and resourceful", "food_kitchen", "#df774d", "chef_hat"],
  ["pilot", "SKY", "European Flight Deal Pilot", "Alert, practical and adventurous", "air_operations", "#4f83d9", "pilot_cap"],
].map(([id, name, role, personality, current_room, color, accessory]) => ({
  id, name, role, personality, current_room, current_task: null, status: "idle",
  task_queue: [], last_result: null, avatar: { color, accessory },
})) as Agent[];
export function localAgents() { return DEFAULT_AGENTS; }

type FoodTruckSnapshot = {
  updated_at?: string; foodtruck_url?: string;
  today?: { day?: string; name?: string; minutes?: number; cost?: number; reason?: string };
  quick_alternative?: { name?: string; minutes?: number; cost?: number };
  weekly?: { total_cost?: number; budget?: number; budget_delta?: number };
  shopping?: { pending?: number; next_items?: Array<{ name?: string; amount?: number; unit?: string; best_store?: string }> };
};

function foodTruckSnapshot(): FoodTruckSnapshot | null {
  try { return JSON.parse(localStorage.getItem(FOODTRUCK_KEY) ?? "null") as FoodTruckSnapshot | null; }
  catch { return null; }
}
export function localData(): LocalData {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as LocalData; }
  catch { return { masters: [], tfg: [], tasks: [], emails: [], documents: [] }; }
}

export async function importWorkbook(file: File) {
  if (!/\.(xlsx|xlsm)$/i.test(file.name)) throw new Error("Selecciona un archivo .xlsx o .xlsm.");
  const result: LocalData = { masters: [], tfg: [], tasks: [], emails: [], documents: [], importedAt: new Date().toISOString() };
  for (const sheet of await readXlsxFile(file)) {
    const rows = sheet.data;
    const headerIndex = rows.findIndex(row => row.filter(cell => cell != null && cell !== "").length >= 2);
    if (headerIndex < 0) continue;
    const headers = rows[headerIndex].map((cell, index) => normalize(cell) || `column_${index + 1}`);
    const target = detectTarget(sheet.sheet, headers); if (!target) continue;
    result[target] = rows.slice(headerIndex + 1).filter(row => row.some(cell => cell != null && cell !== "")).map(row =>
      Object.fromEntries(headers.map((header, index) => [header, row[index] instanceof Date ? (row[index] as Date).toISOString() : row[index]])));
  }
  const total = result.masters.length + result.tfg.length + result.tasks.length + result.emails.length + result.documents.length;
  if (!total) throw new Error("El libro se abrió, pero no se reconocieron las hojas de datos.");
  localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
  return { masters: result.masters.length, tfg: result.tfg.length, tasks: result.tasks.length, emails: result.emails.length, documents: result.documents.length };
}

let localTaskId = 10_000;
const response = (agentId: string, skill: string, result: Record<string, unknown>, approval = false): TaskResponse => ({
  task_id: ++localTaskId, agent_id: agentId, skill, status: approval ? "waiting_approval" : "completed",
  requires_approval: approval, is_mock: false, result: { ...result, mode: "live_mobile_pwa" },
});

export async function runLocalTask(agentId: string, skill: string): Promise<TaskResponse> {
  const data = localData();
  if (agentId === "pilot") {
    type FlightDeal = { title: string; source: string; summary?: string; price_eur: number; interesting: boolean; near_home?: boolean; new?: boolean; source_url: string; verification_url: string };
    type FlightFeed = { generated_at: string; configured: boolean; status: string; threshold_eur: number; deals: FlightDeal[]; message?: string; provider?: string };
    let feed: FlightFeed;
    try {
      const radar = await fetch(`${import.meta.env.BASE_URL}data/flight-deals.json`, { cache: "no-store" });
      feed = await radar.json() as FlightFeed;
    } catch {
      return response(agentId, skill, { title: "Radar temporalmente no disponible", summary: { resultados: 0 }, items: [], next_actions: ["Vuelve a intentarlo cuando haya conexión."] });
    }
    if (!feed.configured) return response(agentId, skill, {
      title: "Activa el radar de vuelos reales", summary: { estado: "Faltan credenciales", proveedor: feed.provider ?? "Amadeus" }, items: [],
      note: feed.message, next_actions: ["Añade AMADEUS_CLIENT_ID y AMADEUS_CLIENT_SECRET en GitHub → Settings → Secrets and variables → Actions."],
    });
    const deals = (skill === "show_interesting_fares" ? feed.deals.filter(deal => deal.interesting) : feed.deals).slice(0, 10);
    return response(agentId, skill, {
      title: skill === "show_interesting_fares" ? "Ofertas europeas detectadas" : "Radar europeo actualizado",
      summary: { rutas: deals.length, umbral: `${feed.threshold_eur} €`, actualizado: feed.generated_at?.slice(0, 16).replace("T", " ") },
      items: deals.map(deal => ({ offer: deal.title, price: `${deal.price_eur} €`, source: deal.source, nearby_departure: deal.near_home ? "Sí" : "No confirmado", new: deal.new ? "Nueva" : "Ya observada", source_url: deal.source_url, google_flights: deal.verification_url })),
      generated_at: feed.generated_at, note: "Radar gratuito de ofertas públicas. El precio puede cambiar; verifícalo antes de comprar.",
    });
  }
  if (agentId === "brasa") {
    const kitchen = foodTruckSnapshot();
    if (!kitchen?.today) return response(agentId, skill, {
      title: "Conecta FoodTruck con BRASA", summary: { estado: "Sin sincronizar", pasos: 1 },
      items: [{ task: "Abrir FoodTruck una vez", next_action: "El menú semanal se sincronizará automáticamente en este iPhone." }],
      external_url: FOODTRUCK_URL,
      next_actions: ["Abre FoodTruck, espera a que cargue el menú y vuelve a ejecutar esta misión."],
    });
    const foodtruckUrl = kitchen.foodtruck_url ?? FOODTRUCK_URL;
    const pendingItems = kitchen.shopping?.next_items ?? [];
    if (skill === "review_foodtruck_status") return response(agentId, skill, {
      title: "Servicio de cocina preparado",
      summary: { menu_hoy: kitchen.today.name ?? "Sin plato", tiempo: `${kitchen.today.minutes ?? "?"} min`, coste_semanal: `${kitchen.weekly?.total_cost ?? "?"} €`, compra_pendiente: kitchen.shopping?.pending ?? 0 },
      items: [
        { task: `Cocinar: ${kitchen.today.name}`, day: kitchen.today.day, minutes: kitchen.today.minutes, cost: `${kitchen.today.cost ?? "?"} €` },
        ...pendingItems.slice(0, 4).map(item => ({ task: `Comprar ${item.name}`, amount: `${item.amount ?? ""} ${item.unit ?? ""}`.trim(), best_store: item.best_store })),
      ],
      external_url: foodtruckUrl, updated_at: kitchen.updated_at,
      note: "Datos leídos directamente del plan activo de FoodTruck en este dispositivo.",
    });
    const openTasks = (data.tasks ?? []).filter(row => !["completed", "completat", "fet"].includes(normalize(value(row, ["estat", "status"]))));
    const busy = openTasks.filter(row => ["critica", "alta", "high", "urgent"].includes(normalize(value(row, ["prioritat", "priority"])))).length;
    const quick = kitchen.quick_alternative;
    return response(agentId, skill, {
      title: "Plan de cocina coordinado con CHRONOS",
      summary: { tareas_abiertas: openTasks.length, urgencias: busy, compra_pendiente: kitchen.shopping?.pending ?? 0 },
      items: [
        { task: busy >= 3 && quick ? `Usar opción rápida: ${quick.name}` : `Mantener menú: ${kitchen.today.name}`, reason: busy >= 3 ? `${busy} tareas prioritarias detectadas` : "La carga de trabajo permite mantener el menú", minutes: busy >= 3 ? quick?.minutes : kitchen.today.minutes },
        { task: "Bloque de preparación", next_action: pendingItems.length ? `Comprar primero: ${pendingItems.slice(0, 3).map(item => item.name).join(", ")}` : "La compra está completada" },
      ],
      external_url: foodtruckUrl,
      next_actions: ["Revisa el plato y la compra en FoodTruck.", "Pide a CHRONOS el plan semanal para incluir la preparación."],
    });
  }
  if (skill === "research_master_sources" || skill === "research_tfg_sources") {
    const feed = await fetchIntelligence();
    const expectedAgent = skill === "research_master_sources" ? "atlas" : "nova";
    const evidence = [...feed.changes, ...feed.discoveries, ...feed.sources].filter(item => item.agent === expectedAgent && item.status !== "error");
    const items = evidence.slice(0, 8).map(item => ({
      entity: item.entity, finding: item.message ?? compactEvidence(item.signals),
      page: item.title ?? "Fuente oficial", source_url: item.url,
    }));
    return response(agentId, skill, {
      title: expectedAgent === "atlas" ? "Radar actualizado de másteres" : "Radar actualizado de centros y TFG",
      summary: { fuentes_verificadas: feed.summary.verified, paginas_descubiertas: feed.summary.discoveries, cambios: feed.summary.changes },
      items, generated_at: feed.generated_at,
      next_actions: ["Abre las fuentes relevantes y marca las oportunidades que quieras seguir."],
      note: "Investigación automática diaria basada en páginas oficiales. Cada hallazgo conserva su URL.",
    });
  }
  if (skill === "suggest_shortlist") {
    const items = [...(data.masters ?? [])].sort((a, b) => Number(value(b, ["puntuacio", "score"]) ?? 0) - Number(value(a, ["puntuacio", "score"]) ?? 0)).slice(0, 3)
      .map(row => ({ name: value(row, ["nom", "master", "programa", "titol"]) ?? "Máster", university: value(row, ["universitat", "university", "centre"]), score: value(row, ["puntuacio", "score"]) }));
    return response(agentId, skill, { title: "Másteres prioritarios", summary: { programas: data.masters?.length ?? 0, seleccionados: items.length }, items });
  }
  if (skill.includes("tfg")) {
    const items = (data.tfg ?? []).slice(0, 3).map(row => ({ title: value(row, ["possible_tfg", "titol", "tema"]) ?? "Oportunidad TFG", centre: value(row, ["centre", "institucio"]), supervisor: value(row, ["supervisor", "investigador"]) }));
    return response(agentId, skill, { title: "Oportunidades de TFG", summary: { oportunidades: data.tfg?.length ?? 0, seleccionadas: items.length }, items });
  }
  if (skill.includes("email")) {
    const tfg = data.tfg?.[0] ?? {};
    const subject = `Consulta sobre TFG: ${value(tfg, ["possible_tfg", "tema"]) ?? "oportunidad"}`;
    const body = "Bon dia,\n\nM'agradaria consultar la possibilitat de desenvolupar el TFG en aquesta línia de recerca.\n\nMoltes gràcies,";
    return response(agentId, skill, {
      title: "Borrador listo para revisar", subject, body, summary: { estado: "Borrador", envio: "No enviado" },
      compose_url: `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    }, true);
  }
  if (skill.includes("weekly") || skill.includes("urgent")) {
    const feed = await fetchIntelligence();
    const alerts = [...feed.changes, ...feed.discoveries, ...feed.sources].filter(item => item.agent === "atlas" && item.signals?.deadlines?.length).slice(0, 3)
      .map(item => ({ task: `Revisar fecha oficial: ${item.entity}`, due_date: "Detectada en la fuente", priority: "Alta", source_url: item.url }));
    const tasks = (data.tasks ?? []).filter(row => !["completed", "completat", "fet"].includes(normalize(value(row, ["estat", "status"])))).slice(0, 7)
      .map(row => ({ task: value(row, ["tasca", "titol", "title"]) ?? "Tarea", due_date: value(row, ["data_limit", "data", "termini"]) ?? "Sin fecha", priority: value(row, ["prioritat", "priority"]) ?? "Normal" }));
    const kitchen = foodTruckSnapshot();
    const foodTask = kitchen?.today ? [{ task: `Preparar comida: ${kitchen.today.name}`, due_date: kitchen.today.day ?? "Esta semana", priority: (kitchen.shopping?.pending ?? 0) > 0 ? "Media" : "Baja", source_url: kitchen.foodtruck_url ?? FOODTRUCK_URL }] : [];
    const items = [...alerts, ...tasks, ...foodTask].slice(0, 7);
    return response(agentId, skill, { title: "Plan semanal con vigilancia externa", summary: { pendientes_excel: data.tasks?.length ?? 0, alertas_web: alerts.length, cocina: foodTask.length, planificadas: items.length }, items });
  }
  if (agentId === "pixel") {
    const repos = await inspectGitHub();
    const items = repos.slice(0, 8).map(repo => ({
      deliverable: repo.name, status: repo.archived ? "Archivado" : "Activo", language: repo.language,
      last_update: repo.updated_at.slice(0, 10),
      next_action: repo.description ? "Añadir capturas, demo y resultados medibles" : "Escribir descripción y README orientado a impacto",
      source_url: repo.url,
    }));
    return response(agentId, skill, { title: "Auditoría actual de tu GitHub", summary: { repositorios: repos.length, con_pages: repos.filter(repo => repo.has_pages).length }, items });
  }
  return response(agentId, skill, { title: "Sin resultados", summary: { resultados: 0 }, items: [] });
}

function icsEscape(input: unknown) {
  return String(input ?? "").replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;");
}
export function localCalendarFile() {
  const events = (localData().tasks ?? []).flatMap((row, index) => {
    const rawDate = value(row, ["data_limit", "data", "termini", "due_date"]); const date = rawDate ? new Date(String(rawDate)) : null;
    if (!date || Number.isNaN(date.getTime())) return [];
    const day = date.toISOString().slice(0, 10).replaceAll("-", "");
    return ["BEGIN:VEVENT", `UID:career-quest-${index}-${day}@local`, `DTSTAMP:${new Date().toISOString().replaceAll(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`,
      `DTSTART;VALUE=DATE:${day}`, `SUMMARY:${icsEscape(value(row, ["tasca", "titol", "title"]) ?? `Tarea ${index + 1}`)}`, "END:VEVENT"];
  });
  return new Blob([["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Career Quest HQ//Local PWA//ES", ...events, "END:VCALENDAR", ""].join("\r\n")], { type: "text/calendar;charset=utf-8" });
}
