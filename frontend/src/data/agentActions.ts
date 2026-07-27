export type ActionOption = {
  skill: string; title: string; purpose: string; source: string; outcome: string;
  kind: "local" | "web" | "auto"; approval?: boolean;
};

export const agentActions: Record<string, ActionOption[]> = {
  atlas: [
    { skill: "suggest_shortlist", title: "Comparar candidaturas", purpose: "Cruza tus preferencias con los programas guardados.", source: "Tu Excel privado", outcome: "Top 3 priorizado", kind: "local" },
    { skill: "research_master_sources", title: "Abrir radar de másteres", purpose: "Revisa fuentes oficiales y descubre páginas, fechas y requisitos nuevos.", source: "Radar web diario", outcome: "Hallazgos con URL", kind: "web" },
  ],
  nova: [
    { skill: "list_top_tfg_opportunities", title: "Comparar oportunidades", purpose: "Ordena tus TFG y centros guardados por prioridad.", source: "Tu Excel privado", outcome: "Top 3 priorizado", kind: "local" },
    { skill: "research_tfg_sources", title: "Explorar centros ahora", purpose: "Encuentra proyectos, grupos, personas y páginas nuevas.", source: "Radar web diario", outcome: "Descubrimientos verificables", kind: "web" },
  ],
  echo: [
    { skill: "draft_tfg_email", title: "Preparar en Gmail", purpose: "Crea el correo y lo abre en Gmail sin enviarlo.", source: "TFG seleccionado", outcome: "Borrador accionable", kind: "auto", approval: true },
    { skill: "draft_researched_tfg_email", title: "Personalizar con evidencias", purpose: "Usa los hallazgos de NOVA y abre el resultado en Gmail.", source: "Fuentes oficiales", outcome: "Correo listo para revisar", kind: "auto", approval: true },
  ],
  chronos: [
    { skill: "list_urgent_tasks", title: "Detectar urgencias reales", purpose: "Combina tareas privadas con alertas encontradas en la web.", source: "Excel + radar", outcome: "Lista inmediata", kind: "auto" },
    { skill: "build_weekly_plan", title: "Crear agenda y calendario", purpose: "Distribuye tareas y permite exportarlas al calendario.", source: "Fechas internas y externas", outcome: "Agenda de 7 tareas", kind: "auto" },
  ],
  pixel: [
    { skill: "list_portfolio_priorities", title: "Auditar mi GitHub", purpose: "Consulta repositorios, actividad, descripciones y demos.", source: "GitHub en tiempo real", outcome: "Problemas detectados", kind: "web" },
    { skill: "build_portfolio_delivery_plan", title: "Plan de publicación", purpose: "Convierte los fallos encontrados en entregables concretos.", source: "GitHub + portfolio", outcome: "Plan accionable", kind: "auto" },
  ],
  brasa: [
    { skill: "review_foodtruck_status", title: "Revisar cocina y compra", purpose: "Lee el menú, presupuesto y lista de compra activos de FoodTruck.", source: "FoodTruck en este dispositivo", outcome: "Plato y compra accionables", kind: "auto" },
    { skill: "coordinate_busy_week", title: "Coordinar con CHRONOS", purpose: "Adapta la cocina a tu carga real de tareas y propone una alternativa rápida cuando haga falta.", source: "FoodTruck + Excel", outcome: "Plan coordinado", kind: "auto" },
  ],
};
