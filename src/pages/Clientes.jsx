import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { dinero, mensajeError, normalizar } from '../lib/formato'
import { soloDigitos } from '../lib/telefono'
import { Aviso, BotonMas, Cargando, Encabezado, Vacio } from '../components/ui'

const ORDENES = [
  { id: 'nombre', etiqueta: 'A–Z' },
  { id: 'saldo', etiqueta: 'Más deben' },
  { id: 'reciente', etiqueta: 'Recientes' },
]

export default function Clientes() {
  const [clientes, setClientes] = useState(null)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState('nombre')

  useEffect(() => {
    supabase
      .from('v_clientes')
      .select('id, nombre, telefono, ciudad, num_facturas, saldo, ultima_factura, creado_en')
      .then(({ data, error }) => {
        if (error) setError(mensajeError(error))
        else setClientes(data)
      })
  }, [])

  const lista = useMemo(() => {
    if (!clientes) return []
    const q = normalizar(busqueda)
    const qDig = soloDigitos(busqueda)
    const filtrados = clientes.filter((c) =>
      !q ||
      normalizar(c.nombre).includes(q) ||
      normalizar(c.ciudad).includes(q) ||
      (qDig.length >= 3 && soloDigitos(c.telefono).includes(qDig)),
    )
    const comparar = {
      nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
      saldo: (a, b) => Number(b.saldo) - Number(a.saldo) || a.nombre.localeCompare(b.nombre, 'es'),
      reciente: (a, b) => (b.ultima_factura || b.creado_en).localeCompare(a.ultima_factura || a.creado_en),
    }[orden]
    return [...filtrados].sort(comparar)
  }, [clientes, busqueda, orden])

  const totalPorCobrar = clientes?.reduce((s, c) => s + Number(c.saldo), 0) ?? 0

  return (
    <div className="space-y-4">
      <Encabezado
        titulo="Clientes"
        subtitulo={clientes ? `${clientes.length} en total · ${dinero(totalPorCobrar)} por cobrar` : ''}
        accion={<BotonMas to="/clientes/nuevo" etiqueta="Nuevo cliente" />}
      />

      <Aviso>{error}</Aviso>

      {clientes === null && !error && <Cargando />}

      {clientes?.length === 0 && (
        <Vacio titulo="Agrega tu primer cliente" texto="Guarda su nombre y teléfono para hacerle facturas y escribirle por WhatsApp. También puedes crearlo desde una factura.">
          <Link to="/clientes/nuevo" className="inline-flex min-h-12 items-center rounded-full bg-tinta px-6 font-medium text-blanco">
            Nuevo cliente
          </Link>
        </Vacio>
      )}

      {clientes?.length > 0 && (
        <>
          <div className="space-y-3">
            <label className="relative block">
              <span className="sr-only">Buscar cliente</span>
              <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-piedra" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre, ciudad o teléfono"
                className="h-13 w-full rounded-full border border-niebla bg-blanco pl-12 pr-4 text-base outline-none focus:border-tinta"
              />
            </label>
            <div className="flex gap-2" role="group" aria-label="Ordenar">
              {ORDENES.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setOrden(o.id)}
                  aria-pressed={orden === o.id}
                  className={`min-h-10 rounded-full px-4 text-sm font-medium transition ${orden === o.id ? 'bg-tinta text-blanco' : 'bg-blanco text-tinta'}`}
                >
                  {o.etiqueta}
                </button>
              ))}
            </div>
          </div>

          {lista.length === 0 ? (
            <p className="px-1 py-8 text-center text-piedra">Ningún cliente coincide con “{busqueda}”.</p>
          ) : (
            <ul className="overflow-hidden rounded-tarjeta bg-blanco">
              {lista.map((c) => (
                <li key={c.id} className="border-t border-niebla/70 first:border-t-0">
                  <Link to={`/clientes/${c.id}`} className="flex min-h-18 items-center gap-3 px-5 py-3.5 transition active:bg-crema">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-arena font-medium">
                      {c.nombre.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.nombre}</span>
                      <span className="block truncate text-sm text-piedra">
                        {[c.ciudad, c.num_facturas === 1 ? '1 factura' : `${c.num_facturas} facturas`].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    {Number(c.saldo) > 0 ? (
                      <span className="shrink-0 text-right">
                        <span className="block text-[11px] text-piedra">Debe</span>
                        <span className="block font-medium">{dinero(c.saldo)}</span>
                      </span>
                    ) : c.num_facturas > 0 ? (
                      <span className="shrink-0 rounded-full bg-pasto-tinte px-2.5 py-1 text-xs font-medium">Al día</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
