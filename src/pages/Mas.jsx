import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Encabezado } from '../components/ui'
import Icono from '../components/Icono'

export default function Mas() {
  const { esAdmin } = useAuth()
  const opciones = [
    { a: '/ganancias', titulo: 'Ganancias', texto: 'Por mes, por viaje y cuánto le toca a cada socio', icono: 'ganancias' },
    { a: '/viajes', titulo: 'Todos los viajes', texto: 'Historial de viajes y su ganancia', icono: 'calendario' },
    { a: '/precios', titulo: 'Lista de precios', texto: esAdmin ? 'Cambia lo que cobras por libra o por artículo' : 'Lo que se cobra por libra o por artículo', icono: 'precios' },
    ...(esAdmin ? [{ a: '/negocio', titulo: 'Datos del negocio', texto: 'Nombre y WhatsApp para el recibo PDF', icono: 'tarjeta' }] : []),
    ...(esAdmin ? [{ a: '/socios', titulo: 'Socios', texto: 'Accesos y reparto de ganancias', icono: 'socios' }] : []),
    { a: '/cuenta', titulo: 'Mi cuenta', texto: 'Contraseña y cerrar sesión', icono: 'cuenta' },
  ]
  return (
    <div className="space-y-4">
      <Encabezado titulo="Más" />
      <ul className="overflow-hidden rounded-tarjeta bg-blanco">
        {opciones.map((o) => (
          <li key={o.a} className="border-t border-niebla/70 first:border-t-0">
            <Link to={o.a} className="flex min-h-18 items-center gap-4 px-5 py-4 transition active:bg-crema">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-arena"><Icono nombre={o.icono} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{o.titulo}</span>
                <span className="block text-sm text-piedra">{o.texto}</span>
              </span>
              <Icono nombre="flecha" size={18} className="text-piedra" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
