export type ActionOption = {
  skill: string; title: string; purpose: string; source: string; outcome: string;
  kind: "local" | "web" | "auto"; approval?: boolean;
};

export const agentActions: Record<string, ActionOption[]> = {
  atlas: [
    { skill: "suggest_shortlist", title: "Analizar mi Excel", purpose: "Ordena los másteres según su puntuación.", source: "13 programas", outcome: "Top 3 priorizado", kind: "local" },
    { skill: "research_master_sources", title: "Investigar fuentes oficiales", purpose: "Busca requisitos, plazos, tasas y becas.", source: "3 webs oficiales", outcome: "Evidencias con URL", kind: "web" },
  ],
  nova: [
    { skill: "list_top_tfg_opportunities", title: "Analizar mis TFG", purpose: "Ordena las oportunidades por prioridad.", source: "10 oportunidades", outcome: "Top 3 priorizado", kind: "local" },
    { skill: "research_tfg_sources", title: "Investigar centros", purpose: "Detecta líneas, proyectos y contactos.", source: "3 webs oficiales", outcome: "Notas con fuentes", kind: "web" },
  ],
  echo: [
    { skill: "draft_tfg_email", title: "Preparar plantilla", purpose: "Crea un primer correo editable; nunca lo envía.", source: "TFG importados", outcome: "Borrador", kind: "local", approval: true },
    { skill: "draft_researched_tfg_email", title: "Personalizar correo", purpose: "Usa evidencias de NOVA para hacerlo relevante.", source: "Investigación oficial", outcome: "Correo personalizado", kind: "auto", approval: true },
  ],
  chronos: [
    { skill: "list_urgent_tasks", title: "Ver tareas urgentes", purpose: "Detecta prioridades altas todavía pendientes.", source: "Acciones del Excel", outcome: "Lista inmediata", kind: "local" },
    { skill: "build_weekly_plan", title: "Construir plan semanal", purpose: "Distribuye tareas por fecha y prioridad.", source: "Fechas y estados", outcome: "Agenda de 7 tareas", kind: "auto" },
  ],
  pixel: [
    { skill: "list_portfolio_priorities", title: "Revisar portfolio", purpose: "Localiza las piezas con más impacto.", source: "Tareas del Excel", outcome: "Prioridades", kind: "local" },
    { skill: "build_portfolio_delivery_plan", title: "Crear entregables", purpose: "Convierte tareas en piezas terminables y publicables.", source: "Tareas y documentos", outcome: "Plan de entregables", kind: "auto" },
  ],
};

