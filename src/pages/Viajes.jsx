import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { dinero, fechaCorta, mensajeError } from '../lib/formato'
import { Aviso, BotonMas, Cargando, Chip, Encabezado, Vacio } from '../components/ui'

export default function Viajes() {
  const [viajes, setViajes] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('v_viajes').select('*')
      .order('fecha_entrega', { ascending: false, nullsFirst: true })
      .order('creado_en', { ascending: false })
      .then(({ data, error }) => (error ? setError(mensajeError(error)) : setViajes(data)))
  }, [])

  return (
    <div className="space-y-4">
      <Encabezado titulo="Viajes" volverA="/mas" accion={<BotonMas to="/viajes/nuevo" etiqueta="Nuevo viaje" />} />
      <Aviso>{error}</Aviso>
      {!viajes && !error && <Cargando />}
      {viajes?.length === 0 && <Vacio titulo="Aún no hay viajes" texto="Crea el primero con el botón +." />}
      <ul className="space-y-2">
        {viajes?.map((v) => (
          <li key={v.id}>
            <Link to={`/viajes/${v.id}`} className="block rounded-tarjeta bg-blanco p-5 transition active:bg-crema">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-medium">{v.nombre}</p>
                  <p className="text-sm text-piedra">{v.fecha_entrega ? `Entrega ${fechaCorta(v.fecha_entrega)}` : 'Sin fecha de entrega'}</p>
                </div>
                {v.cerrado ? <Chip color="arena" punto={false}>Cerrado</Chip> : <Chip color="cielo">Abierto</Chip>}
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div><dt className="text-piedra">Ganancia</dt><dd className="font-medium">{dinero(v.ganancia)}</dd></div>
                <div><dt className="text-piedra">Por cobrar</dt><dd className="font-medium">{dinero(v.por_cobrar)}</dd></div>
                <div><dt className="text-piedra">Entregadas</dt><dd className="font-medium">{v.num_entregadas}/{v.num_facturas}</dd></div>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
