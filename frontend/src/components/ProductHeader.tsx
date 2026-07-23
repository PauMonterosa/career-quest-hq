interface Props {
  activeTasks: number;
  approvals: number;
}

export function ProductHeader({ activeTasks, approvals }: Props) {
  const today = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short" }).format(new Date());
  return <header className="product-header">
    <div className="brand-lockup"><span className="brand-mark">CQ</span><div><strong>Career Quest HQ</strong><span>Plan profesional · {today}</span></div></div>
    <div className="header-focus" aria-label="Resumen del espacio de trabajo">
      <span><b>{activeTasks}</b> agentes activos</span><span><b>{approvals}</b> aprobaciones</span>
    </div>
    <nav className="header-actions" aria-label="Herramientas">
      <button aria-label="Abrir búsqueda" title="Buscar">⌕</button>
      <button aria-label="Ver notificaciones" title="Notificaciones">◉</button>
      <button aria-label="Abrir ajustes" title="Ajustes">⚙</button>
    </nav>
  </header>;
}

