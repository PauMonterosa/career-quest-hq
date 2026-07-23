interface Props {
  activeTasks: number;
  approvals: number;
  onImport: (file: File) => Promise<void>;
  importStatus: string;
}

export function ProductHeader({ activeTasks, approvals, onImport, importStatus }: Props) {
  const today = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short" }).format(new Date());
  return <header className="product-header">
    <div className="brand-lockup"><span className="brand-mark">CQ</span><div><strong>Career Quest HQ</strong><span>Plan profesional · {today}</span></div></div>
    <div className="header-focus" aria-label="Resumen del espacio de trabajo">
      <span><b>{activeTasks}</b> agentes activos</span><span><b>{approvals}</b> aprobaciones</span>
      <span>{importStatus}</span>
    </div>
    <nav className="header-actions" aria-label="Herramientas">
      <label className="import-button" title="Importar Excel">
        <input type="file" accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12" onChange={event => {
          const file = event.target.files?.[0]; if (file) void onImport(file); event.target.value = "";
        }} />
        <span aria-hidden="true">⇧</span><b>Importar Excel</b>
      </label>
      <button aria-label="Abrir búsqueda" title="Buscar">⌕</button>
      <button aria-label="Ver notificaciones" title="Notificaciones">◉</button>
      <button aria-label="Abrir ajustes" title="Ajustes">⚙</button>
    </nav>
  </header>;
}
