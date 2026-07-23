import readXlsxFile from "read-excel-file/browser";
import type { Agent, TaskResponse } from "../types";

type Row = Record<string, unknown>;
type LocalData = { masters: Row[]; tfg: Row[]; tasks: Row[]; emails: Row[]; documents: Row[]; importedAt?: string };
type DataTarget = Exclude<keyof LocalData, "importedAt">;

const STORAGE_KEY = "career-quest-hq-data-v1";
const normalize = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const value = (row: Row, keys: string[]) => keys.map(normalize).map(key => row[key]).find(item => item !== "" && item != null);

function detectTarget(sheetName: string, headers: string[]): DataTarget | null {
  const name = normalize(sheetName);
  const headerSet = new Set(headers);
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
].map(([id, name, role, personality, current_room, color, accessory]) => ({
  id, name, role, personality, current_room, current_task: null, status: "idle",
  task_queue: [], last_result: null, avatar: { color, accessory },
})) as Agent[];

export function localAgents() { return DEFAULT_AGENTS; }
export function localData(): LocalData {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as LocalData; }
  catch { return { masters: [], tfg: [], tasks: [], emails: [], documents: [] }; }
}

export async function importWorkbook(file: File) {
  if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
    throw new Error("Formato no compatible. Selecciona un archivo .xlsx o .xlsm.");
  }
  const result: LocalData = { masters: [], tfg: [], tasks: [], emails: [], documents: [], importedAt: new Date().toISOString() };
  const sheets = await readXlsxFile(file);
  for (const sheet of sheets) {
    const rows = sheet.data;
    const headerIndex = rows.findIndex(row => row.filter(cell => cell != null && cell !== "").length >= 2);
    if (headerIndex < 0) continue;
    const headers = rows[headerIndex].map((cell, index) => normalize(cell) || `column_${index + 1}`);
    const target = detectTarget(sheet.sheet, headers);
    if (!target) continue;
    result[target] = rows.slice(headerIndex + 1).filter(row => row.some(cell => cell != null && cell !== "")).map(row =>
      Object.fromEntries(headers.map((header, index) => [header, row[index] instanceof Date ? (row[index] as Date).toISOString() : row[index]])));
  }
  const total = result.masters.length + result.tfg.length + result.tasks.length + result.emails.length + result.documents.length;
  if (total === 0) {
    throw new Error("El libro se abrió, pero no contiene las hojas esperadas: mapa_masters, tfg_barcelona, pla_d_accio, correus o documents.");
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
  return {
    masters: result.masters.length,
    tfg: result.tfg.length,
    tasks: result.tasks.length,
    emails: result.emails.length,
    documents: result.documents.length,
  };
}

let localTaskId = 10_000;
const response = (agentId: string, skill: string, result: Record<string, unknown>, approval = false): TaskResponse => ({
  task_id: ++localTaskId, agent_id: agentId, skill, status: approval ? "waiting_approval" : "completed",
  requires_approval: approval, is_mock: false, result: { ...result, mode: "local_first_pwa" },
});

export function runLocalTask(agentId: string, skill: string): TaskResponse {
  const data = localData();
  if (skill === "research_master_sources" || skill === "research_tfg_sources") {
    const sourceRows = skill === "research_master_sources" ? data.masters : data.tfg;
    const items = (sourceRows ?? []).slice(0, 3).map(row => ({
      entity: value(row, ["nom", "master", "programa", "possible_tfg", "titol", "tema"]) ?? "Elemento pendiente",
      status: "Pendiente de investigación web",
      next_step: "Ejecutar con el backend conectado para consultar fuentes oficiales",
    }));
    return response(agentId, skill, {
      title: "Investigación preparada",
      summary: { elementos: sourceRows?.length ?? 0, fuentes_consultadas: 0 },
      items,
      next_actions: ["Conecta el backend para investigar y guardar evidencias verificables."],
      note: "En modo local no se inventan fuentes ni resultados de Internet.",
    });
  }
  if (skill === "suggest_shortlist") {
    const items = [...(data.masters ?? [])].sort((a, b) => Number(value(b, ["puntuacio", "score"]) ?? 0) - Number(value(a, ["puntuacio", "score"]) ?? 0)).slice(0, 3)
      .map(row => ({ name: value(row, ["nom", "master", "programa", "titol"]) ?? "Máster", university: value(row, ["universitat", "university", "centre"]), score: value(row, ["puntuacio", "score"]) }));
    return response(agentId, skill, { title: "Másteres prioritarios", summary: { programas: data.masters?.length ?? 0, seleccionados: items.length }, items, note: "Calculado localmente en tu iPhone." });
  }
  if (skill.includes("tfg")) {
    const items = (data.tfg ?? []).slice(0, 3).map(row => ({ title: value(row, ["possible_tfg", "titol", "tema"]) ?? "Oportunidad TFG", centre: value(row, ["centre", "institucio"]), supervisor: value(row, ["supervisor", "investigador"]) }));
    return response(agentId, skill, { title: "Oportunidades de TFG", summary: { oportunidades: data.tfg?.length ?? 0, seleccionadas: items.length }, items, note: "Datos privados procesados en este dispositivo." });
  }
  if (skill.includes("email")) {
    const tfg = data.tfg?.[0] ?? {};
    return response(agentId, skill, { title: "Borrador listo para revisar", subject: `Consulta sobre TFG: ${value(tfg, ["possible_tfg", "tema"]) ?? "oportunidad"}`, body: "Bon dia,\n\nM'agradaria consultar la possibilitat de desenvolupar el TFG en aquesta línia de recerca.\n\nMoltes gràcies,", summary: { estado: "Borrador", envio: "No enviado" } }, true);
  }
  if (skill.includes("weekly") || skill.includes("urgent")) {
    const items = (data.tasks ?? []).filter(row => !["completed", "completat", "fet"].includes(normalize(value(row, ["estat", "status"])))).slice(0, 7)
      .map(row => ({ task: value(row, ["tasca", "titol", "title"]) ?? "Tarea", due_date: value(row, ["data_limit", "data", "termini"]) ?? "Sin fecha", priority: value(row, ["prioritat", "priority"]) ?? "Normal" }));
    return response(agentId, skill, { title: "Plan semanal local", summary: { pendientes: data.tasks?.length ?? 0, planificadas: items.length }, items, next_actions: ["Empieza por la tarea con fecha más próxima."] });
  }
  const items = [...(data.tasks ?? []), ...(data.documents ?? [])].filter(row => /portfolio|github|cv|openpv/i.test(JSON.stringify(row))).slice(0, 7)
    .map(row => ({ deliverable: value(row, ["tasca", "document", "nom", "title"]) ?? "Entregable", status: value(row, ["estat", "status"]) ?? "Pendiente", next_action: "Preparar una versión revisable" }));
  return response(agentId, skill, { title: "Plan de entregables local", summary: { entregables: items.length }, items });
}

function icsEscape(input: unknown) {
  return String(input ?? "").replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;");
}

export function localCalendarFile() {
  const tasks = localData().tasks ?? [];
  const events = tasks.flatMap((row, index) => {
    const rawDate = value(row, ["data_limit", "data", "termini", "due_date"]);
    const date = rawDate ? new Date(String(rawDate)) : null;
    if (!date || Number.isNaN(date.getTime())) return [];
    const day = date.toISOString().slice(0, 10).replaceAll("-", "");
    const title = value(row, ["tasca", "titol", "title"]) ?? `Tarea ${index + 1}`;
    return [
      "BEGIN:VEVENT",
      `UID:career-quest-${index}-${day}@local`,
      `DTSTAMP:${new Date().toISOString().replaceAll(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`,
      `DTSTART;VALUE=DATE:${day}`,
      `SUMMARY:${icsEscape(title)}`,
      "END:VEVENT",
    ];
  });
  return new Blob([
    ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Career Quest HQ//Local PWA//ES", ...events, "END:VCALENDAR", ""].join("\r\n"),
  ], { type: "text/calendar;charset=utf-8" });
}
