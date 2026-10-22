// Íconos de línea simples (sin librerías externas)
const trazos = {
  inicio: <path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
  clientes: <><rect x="4" y="4" width="16" height="16" rx="4" /><circle cx="12" cy="10" r="2.6" /><path d="M7.5 17c.8-2 2.4-3 4.5-3s3.7 1 4.5 3" /></>,
  socios: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" /><circle cx="17" cy="9" r="2.4" /><path d="M16 14.6c2.3.1 3.9 1.5 4.5 4.4" /></>,
  cuenta: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></>,
  viaje: <path d="M10.5 13.5L4 11l1.5-1.5 7 1L17 6c1-1 2.5-1 3 0s0 2-1 3l-4.5 4.5 1 7L14 22l-2.5-6.5L8 19v2l-1.5 1L5 18l-4-1.5L2 15h2l3.5-3.5" />,
  mas: <><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></>,
  precios: <><path d="M3 12V4h8l9 9-8 8z" /><circle cx="7.5" cy="8.5" r="1.5" /></>,
  ganancias: <><path d="M4 19h16" /><path d="M6 15l4-4 3 3 5-6" /><path d="M15 8h3v3" /></>,
  calendario: <><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  flecha: <path d="M9 6l6 6-6 6" />,
  mas_simple: <path d="M12 5v14M5 12h14" />,
  basura: <path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />,
  tarjeta: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M3 10h18M7 15h4" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  // tarifas
  ropa: <path d="M8 4l-5 3 2 4 2-1v10h10V10l2 1 2-4-5-3c-.5 1.5-2 2.5-4 2.5S8.5 5.5 8 4z" />,
  zapatos: <path d="M3 16v-5l4-1 3 3 4 1 5 1c1.5.3 2 1 2 2v2H3z M3 18h18" />,
  perfume: <><rect x="6" y="9" width="12" height="12" rx="3" /><path d="M10 9V6h4v3M9 4h6" /></>,
  vitaminas: <><rect x="7" y="7" width="10" height="14" rx="2" /><path d="M8 3h8v4H8zM10 14h4M12 12v4" /></>,
  reloj: <><circle cx="12" cy="12" r="5" /><path d="M9 7.5L10 3h4l1 4.5M9 16.5l1 4.5h4l1-4.5M12 10v2l1.5 1" /></>,
  airpods: <path d="M8 4a3 3 0 0 0-3 3v1a3 3 0 0 0 3 3v9M16 4a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3v9" />,
  celular: <><rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M11 18h2" /></>,
  tablet: <><rect x="4.5" y="3" width="15" height="18" rx="2.5" /><path d="M11 18h2" /></>,
  laptop: <><rect x="5" y="5" width="14" height="10" rx="1.5" /><path d="M2.5 19h19l-2-4h-15z" /></>,
  consola: <path d="M7 8h10a4 4 0 0 1 4 4l.5 4a2.5 2.5 0 0 1-4.5 1.5L15 15H9l-2 2.5A2.5 2.5 0 0 1 2.5 16L3 12a4 4 0 0 1 4-4zM7.5 11v3M6 12.5h3M15.5 12h.01M17.5 13.5h.01" />,
  watch: <><rect x="7" y="7" width="10" height="10" rx="3" /><path d="M9 7l.5-4h5l.5 4M9 17l.5 4h5l.5-4" /></>,
  otro: <><rect x="4" y="7" width="16" height="13" rx="2" /><path d="M4 11h16M12 7v13M8.5 7C7 7 6 6 6 4.8S7 3 8 3.5 12 7 12 7s3-3 4-3.5 2 .2 2 1.3S17 7 15.5 7" /></>,
  // gastos
  avion: <path d="M10.5 13.5L4 11l1.5-1.5 7 1L17 6c1-1 2.5-1 3 0s0 2-1 3l-4.5 4.5 1 7L14 22l-2.5-6.5L8 19v2l-1.5 1L5 18l-4-1.5L2 15h2l3.5-3.5" />,
  taxi: <><path d="M5 16V12l2-5h10l2 5v4M3 12h18v5H3zM9 7l.5-3h5l.5 3" /><circle cx="7" cy="17.5" r="1.5" /><circle cx="17" cy="17.5" r="1.5" /></>,
  bus: <><rect x="5" y="3" width="14" height="15" rx="3" /><path d="M5 11h14M8 18v2M16 18v2" /><circle cx="8.5" cy="14.5" r=".6" /><circle cx="15.5" cy="14.5" r=".6" /></>,
  comida: <path d="M6 3v8a2 2 0 0 0 2 2v8M10 3v8a2 2 0 0 1-2 2M8 3v6M17 21V3c-2 1-3 4-3 7h3" />,
  otros: <><circle cx="12" cy="12" r="8.5" /><path d="M12 8v4l2.5 2.5" /></>,
}

export default function Icono({ nombre, size = 22, className = '', grosor = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {trazos[nombre] || trazos.otro}
    </svg>
  )
}
