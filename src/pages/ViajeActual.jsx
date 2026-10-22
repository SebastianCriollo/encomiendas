import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { buscarViajeActual } from '../lib/datos'
import { mensajeError } from '../lib/formato'
import { Aviso, Cargando, Encabezado, Vacio } from '../components/ui'

// La pestaña "Viaje" abre directamente el viaje en curso
export default function ViajeActual() {
  const [estado, setEstado] = useState({ cargando: true })

  useEffect(() => {
    buscarViajeActual()
      .then((v) => setEstado({ viaje: v }))
      .catch((e) => setEstado({ error: mensajeError(e) }))
  }, [])

  if (estado.cargando) return <Cargando />
  if (estado.viaje) return <Navigate to={`/viajes/${estado.viaje.id}`} replace />
  return (
    <div className="space-y-4">
      <Encabezado titulo="Viaje" />
      <Aviso>{estado.error}</Aviso>
      <Vacio titulo="Crea tu próximo viaje" texto="Cada viaje agrupa las facturas de los clientes y los gastos (pasajes, taxis, buses).">
        <Link to="/viajes/nuevo" className="inline-flex min-h-12 items-center rounded-full bg-tinta px-6 font-medium text-blanco">Nuevo viaje</Link>
      </Vacio>
      <Link to="/viajes" className="block text-center text-sm text-piedra underline decoration-niebla underline-offset-4">Ver viajes anteriores</Link>
    </div>
  )
}
