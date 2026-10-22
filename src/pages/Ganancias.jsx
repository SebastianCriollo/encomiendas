import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { dinero, mensajeError } from '../lib/formato'
import { Aviso, Cargando, Encabezado, Tarjeta, Vacio } from '../components/ui'

// Mes de un viaje: el de su fecha de entrega (o el de creación si no tiene)
function claveMes(v) {
  const f = v.fecha_entrega || v.creado_en.slice(0, 10)
  return f.slice(0, 7) // AAAA-MM
}
function nombreMes(clave) {
  const [a, m] = clave.split('-').map(Number)
  const t = new Date(a, m - 1, 15).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export default function Ganancias() {
  const [viajes, setViajes] = useState(null)
  const [reparto, setReparto] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('v_viajes').select('*'),
      supabase.from('v_reparto').select('socio_id, nombre, corresponde, pagado, pendiente, parte_ganancia'),
    ]).then(([v, r]) => {
      if (v.error || r.error) { setError(mensajeError(v.error || r.error)); return }
      setViajes(v.data); setReparto(r.data)
    })
  }, [])

  const datos = useMemo(() => {
    if (!viajes) return null
    const suma = (xs, k) => xs.reduce((s, x) => s + Number(x[k] || 0), 0)
    const meses = {}
    for (const v of viajes) (meses[claveMes(v)] ||= []).push(v)
    const porMes = Object.entries(meses)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([k, vs]) => ({ clave: k, viajes: vs, ingresos: suma(vs, 'total_servicio'), gastos: suma(vs, 'total_gastos'), ganancia: suma(vs, 'ganancia'), porCobrar: suma(vs, 'por_cobrar') }))
    const socios = {}
    for (const r of reparto) {
      const s = (socios[r.socio_id] ||= { nombre: r.nombre, ganancia: 0, corresponde: 0, pagado: 0, pendiente: 0 })
      s.ganancia += Number(r.parte_ganancia); s.corresponde += Number(r.corresponde); s.pagado += Number(r.pagado); s.pendiente += Number(r.pendiente)
    }
    return {
      ingresos: suma(viajes, 'total_servicio'), gastos: suma(viajes, 'total_gastos'), ganancia: suma(viajes, 'ganancia'),
      porCobrar: suma(viajes, 'por_cobrar'), porMes, socios: Object.values(socios),
    }
  }, [viajes, reparto])

  if (error) return <div className="space-y-4"><Encabezado titulo="Ganancias" volverA="/mas" /><Aviso>{error}</Aviso></div>
  if (!datos) return <Cargando />

  return (
    <div className="space-y-4">
      <Encabezado titulo="Ganancias" subtitulo="Todos los viajes" volverA="/mas" />

      {viajes.length === 0 ? (
        <Vacio titulo="Aún no hay viajes" texto="Las ganancias aparecen cuando registres facturas y gastos en un viaje." />
      ) : (
        <>
          <Tarjeta>
            <p className="text-sm text-piedra">Ganancia neta total</p>
            <p className={`cifra-grande mt-1 ${datos.ganancia < 0 ? 'text-[#b8402f]' : ''}`}>{dinero(datos.ganancia)}</p>
            <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-niebla pt-4 text-sm">
              <div><dt className="text-piedra">Ingresos</dt><dd className="mt-0.5 text-base font-medium">{dinero(datos.ingresos)}</dd></div>
              <div><dt className="text-piedra">Gastos</dt><dd className="mt-0.5 text-base font-medium">{dinero(datos.gastos)}</dd></div>
              <div><dt className="text-piedra">Por cobrar</dt><dd className="mt-0.5 text-base font-medium">{dinero(datos.porCobrar)}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-piedra">Ingresos = lo cobrado por traer. Las compras con tarjeta no son ingreso: el cliente solo las devuelve.</p>
          </Tarjeta>

          {datos.socios.length > 0 && (
            <section className="space-y-2">
              <h2 className="px-1 text-lg font-medium">Por socio</h2>
              <ul className="overflow-hidden rounded-tarjeta bg-blanco">
                {datos.socios.map((s) => (
                  <li key={s.nombre} className="border-t border-niebla/70 px-5 py-4 first:border-t-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-medium">{s.nombre}</p>
                      <p className="text-sm text-piedra">ganó {dinero(s.ganancia)}</p>
                    </div>
                    <div className="mt-1 flex justify-between text-sm">
                      <span className="text-piedra">Recibido {dinero(s.pagado)} de {dinero(s.corresponde)}</span>
                      <span className={s.pendiente > 0.004 ? 'font-medium' : 'text-piedra'}>{s.pendiente > 0.004 ? `Falta ${dinero(s.pendiente)}` : 'Al día'}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="px-1 text-xs text-piedra">“Recibido” incluye lo que se le devolvió por gastos y compras con su tarjeta.</p>
            </section>
          )}

          <section className="space-y-2">
            <h2 className="px-1 text-lg font-medium">Por mes</h2>
            {datos.porMes.map((m) => (
              <Tarjeta key={m.clave} className="space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium">{nombreMes(m.clave)}</p>
                  <p className="text-xl font-medium">{dinero(m.ganancia)}</p>
                </div>
                <p className="text-sm text-piedra">Ingresos {dinero(m.ingresos)} − gastos {dinero(m.gastos)}{m.porCobrar > 0 ? ` · ${dinero(m.porCobrar)} por cobrar` : ''}</p>
                <ul className="space-y-1">
                  {m.viajes.map((v) => (
                    <li key={v.id}>
                      <Link to={`/viajes/${v.id}?ver=reparto`} className="flex min-h-11 items-center justify-between rounded-campo bg-crema px-4 text-sm">
                        <span>{v.nombre}</span><span className="font-medium">{dinero(v.ganancia)} →</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Tarjeta>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
