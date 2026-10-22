import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { dinero, mensajeError } from '../lib/formato'
import { whatsappUrl } from '../lib/telefono'
import { Aviso, Cargando, Tarjeta } from '../components/ui'
import Icono from '../components/Icono'

const mesDe = (v) => (v.fecha_entrega || v.creado_en.slice(0, 10)).slice(0, 7)

function diasHasta(fecha) {
  if (!fecha) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  return Math.round((new Date(fecha + 'T00:00:00') - hoy) / 86400000)
}

export default function Inicio() {
  const { perfil } = useAuth()
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  const nombre = perfil?.nombre?.split(' ')[0] || ''
  const ahora = new Date()
  const fecha = ahora.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })
  const mesNombre = ahora.toLocaleDateString('es-EC', { month: 'long' })
  const mesActual = ahora.toLocaleDateString('en-CA').slice(0, 7)

  useEffect(() => {
    Promise.all([
      supabase.from('v_viajes').select('*'),
      supabase.from('v_clientes').select('id, nombre, telefono, saldo').gt('saldo', 0).order('saldo', { ascending: false }).limit(5),
      supabase.from('configuracion').select('nombre_negocio').maybeSingle(),
    ]).then(([v, c, conf]) => {
      if (v.error || c.error) { setError(mensajeError(v.error || c.error)); return }
      const abiertos = v.data.filter((x) => !x.cerrado)
      const actual = [...abiertos].sort((a, b) => (a.fecha_entrega || '9999').localeCompare(b.fecha_entrega || '9999'))[0] || null
      const delMes = v.data.filter((x) => mesDe(x) === mesActual)
      setD({
        actual,
        gananciaMes: delMes.reduce((s, x) => s + Number(x.ganancia), 0),
        viajesMes: delMes.length,
        porCobrar: v.data.reduce((s, x) => s + Number(x.por_cobrar), 0),
        porEntregar: abiertos.reduce((s, x) => s + (x.num_facturas - x.num_entregadas), 0),
        deudores: c.data,
        negocio: conf.data?.nombre_negocio || '',
      })
    })
  }, [mesActual])

  return (
    <div className="space-y-4">
      <div className="px-1">
        <p className="text-sm text-piedra">{fecha.charAt(0).toUpperCase() + fecha.slice(1)}</p>
        <h1 className="titulo-pagina mt-1">Hola{nombre ? `, ${nombre}` : ''}</h1>
      </div>

      <Aviso>{error}</Aviso>
      {!d && !error && <Cargando />}

      {d && (
        <>
          {/* Número principal */}
          <Tarjeta>
            <p className="text-sm text-piedra">Ganancia de {mesNombre}</p>
            <p className={`mt-2 text-[3.75rem] font-medium leading-[0.95] tracking-[-0.045em] ${d.gananciaMes < 0 ? 'text-[#b8402f]' : ''}`}>{dinero(d.gananciaMes)}</p>
            <p className="mt-2 text-sm text-piedra">
              {d.viajesMes === 0 ? 'Sin viajes con entrega este mes' : d.viajesMes === 1 ? '1 viaje este mes, ya descontados los gastos' : `${d.viajesMes} viajes este mes, ya descontados los gastos`}
            </p>
          </Tarjeta>

          <div className="grid grid-cols-2 gap-3">
            <Tarjeta className="!p-4">
              <p className="text-sm text-piedra">Por cobrar</p>
              <p className="mt-1 text-[1.75rem] font-medium leading-tight tracking-tight">{dinero(d.porCobrar)}</p>
            </Tarjeta>
            <Tarjeta hundida className="!p-4">
              <p className="text-sm">Por entregar</p>
              <p className="mt-1 text-[1.75rem] font-medium leading-tight tracking-tight">{d.porEntregar} <span className="text-base font-normal">{d.porEntregar === 1 ? 'pedido' : 'pedidos'}</span></p>
            </Tarjeta>
          </div>

          {/* Viaje en curso */}
          {d.actual ? (
            <Link to={`/viajes/${d.actual.id}`} className="block rounded-tarjeta bg-blanco p-5 transition active:bg-crema">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-piedra">Viaje en curso</p>
                  <p className="truncate text-xl font-medium">{d.actual.nombre}</p>
                </div>
                <EtiquetaDias dias={diasHasta(d.actual.fecha_entrega)} />
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm"><span>Entregados {d.actual.num_entregadas} de {d.actual.num_facturas}</span><span className="text-piedra">Ganancia {dinero(d.actual.ganancia)}</span></div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-arena" role="progressbar" aria-valuemin={0} aria-valuemax={d.actual.num_facturas} aria-valuenow={d.actual.num_entregadas}>
                  <div className="h-full rounded-full bg-pasto" style={{ width: `${d.actual.num_facturas ? (100 * d.actual.num_entregadas) / d.actual.num_facturas : 0}%` }} />
                </div>
              </div>
            </Link>
          ) : (
            <Tarjeta>
              <p className="text-lg font-medium">No hay un viaje abierto</p>
              <p className="mt-1 text-sm text-piedra">Crea el viaje para empezar a registrar facturas y gastos.</p>
              <Link to="/viajes/nuevo" className="mt-4 flex min-h-12 items-center justify-center rounded-full bg-tinta font-medium text-blanco">Nuevo viaje</Link>
            </Tarjeta>
          )}

          {d.actual && (
            <div className="grid grid-cols-2 gap-2">
              <Link to={`/facturas/nueva?viaje=${d.actual.id}`} className="flex min-h-13 items-center justify-center gap-2 rounded-full bg-tinta font-medium text-blanco">
                <Icono nombre="mas_simple" size={18} grosor={2.4} /> Factura
              </Link>
              <Link to={`/viajes/${d.actual.id}?ver=gastos`} className="flex min-h-13 items-center justify-center gap-2 rounded-full bg-blanco font-medium">
                <Icono nombre="mas_simple" size={18} grosor={2.4} /> Gasto
              </Link>
            </div>
          )}

          {/* Clientes que más deben */}
          <section className="space-y-2 pt-2">
            <div className="flex items-baseline justify-between px-1">
              <h2 className="text-lg font-medium">Quién debe más</h2>
              <Link to="/clientes" className="text-sm text-piedra underline decoration-niebla underline-offset-4">Ver todos</Link>
            </div>
            {d.deudores.length === 0 ? (
              <Tarjeta><p className="text-piedra">Nadie te debe. 🎉</p></Tarjeta>
            ) : (
              <ul className="overflow-hidden rounded-tarjeta bg-blanco">
                {d.deudores.map((c, i) => {
                  const wa = whatsappUrl(c.telefono, `Hola ${c.nombre.split(' ')[0]}, te saluda ${d.negocio || 'tu servicio de encargos'}. Te recuerdo tu saldo pendiente de ${dinero(c.saldo)}. ¡Gracias!`)
                  return (
                    <li key={c.id} className="flex items-center gap-3 border-t border-niebla/70 px-4 py-3 first:border-t-0">
                      <span className="w-5 text-center text-sm text-piedra">{i + 1}</span>
                      <Link to={`/clientes/${c.id}`} className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{c.nombre}</span>
                      </Link>
                      <span className="font-medium">{dinero(c.saldo)}</span>
                      {wa && (
                        <a href={wa} target="_blank" rel="noreferrer" aria-label={`Recordar a ${c.nombre} por WhatsApp`}
                          className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-pasto-tinte px-3 text-sm font-medium">
                          <span className="size-2 rounded-full bg-pasto" aria-hidden="true" />Recordar
                        </a>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function EtiquetaDias({ dias }) {
  if (dias === null) return null
  const texto = dias > 1 ? `Entrega en ${dias} días` : dias === 1 ? 'Entrega mañana' : dias === 0 ? 'Entrega hoy' : `Entrega fue hace ${-dias} ${dias === -1 ? 'día' : 'días'}`
  const color = dias < 0 ? 'bg-arena' : dias <= 3 ? 'bg-sol-tinte' : 'bg-cielo-tinte'
  return <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${color}`}>{texto}</span>
}
