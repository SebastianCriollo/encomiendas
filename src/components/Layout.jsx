import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Cargando } from './ui'
import Icono from './Icono'

export default function Layout() {
  const { session, perfil, esAdmin, cargando } = useAuth()
  const location = useLocation()

  if (cargando) return <Cargando />
  if (!session) return <Navigate to="/entrar" replace state={{ desde: location.pathname }} />

  // Usuario con sesión pero sin perfil activo (desactivado por el admin)
  if (perfil && !perfil.activo) {
    return (
      <main className="mx-auto max-w-md px-4 pt-24 text-center">
        <h1 className="titulo-pagina mb-3">Cuenta desactivada</h1>
        <p className="text-piedra">Habla con el administrador del negocio para volver a tener acceso.</p>
      </main>
    )
  }

  const items = [
    { a: '/', etiqueta: 'Inicio', icono: 'inicio' },
    { a: '/clientes', etiqueta: 'Clientes', icono: 'clientes' },
    { a: '/viaje', etiqueta: 'Viaje', icono: 'viaje', activoEn: ['/viaje', '/facturas'] },
    { a: '/mas', etiqueta: 'Más', icono: 'mas', activoEn: ['/mas', '/socios', '/precios', '/cuenta', '/ganancias', '/negocio'] },
  ]
  const estaActivo = (it, isActive) => isActive || (it.activoEn || []).some((r) => location.pathname.startsWith(r))

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-32 pt-4">
      {/* Barra superior en forma de píldora */}
      <header className="mb-6 flex items-center justify-between rounded-full bg-blanco py-1.5 pl-4 pr-1.5">
        <div className="flex items-center gap-2.5">
          <img src="/icono.svg" alt="" className="size-8" />
          <span className="text-[15px] font-medium">Encomiendas</span>
        </div>
        <NavLink
          to="/cuenta"
          aria-label="Mi cuenta"
          className="flex size-10 items-center justify-center rounded-full bg-pasto text-sm font-medium"
        >
          {(perfil?.nombre || '?').charAt(0).toUpperCase()}
        </NavLink>
      </header>

      <main>
        <Outlet />
      </main>

      {/* Navegación inferior: al alcance del pulgar */}
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <ul className="mx-auto flex max-w-md justify-around rounded-full bg-tinta p-1.5">
          {items.map((it) => (
            <li key={it.a} className="flex-1">
              <NavLink
                to={it.a}
                end={it.a === '/'}
                className={({ isActive }) =>
                  estaActivo(it, isActive) ?
                  'flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium transition bg-pasto text-tinta'
                  : 'flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium transition text-blanco/80'
                }
              >
                <Icono nombre={it.icono} />
                {it.etiqueta}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
