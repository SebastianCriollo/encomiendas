import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { cargarPerfiles, primerNombre } from '../lib/datos'
import { dinero, fechaCorta, mensajeError, normalizar, numeroEncomienda } from '../lib/formato'
import { CATEGORIAS_GASTO } from '../lib/estados'
import { Aviso, Boton, Campo, Cargando, Chip, ChipEntrega, ChipPago, Encabezado, Tarjeta, Vacio } from '../components/ui'
import Icono from '../components/Icono'
import Reparto from './Reparto'
import { cargarDatosReporte, descargarExcel, descargarPdf } from '../lib/reporte'

const hoyISO = () => new Date().toLocaleDateString('en-CA') // AAAA-MM-DD en hora local

export default function ViajeDetalle() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const pestana = ['gastos', 'reparto'].includes(params.get('ver')) ? params.get('ver') : 'facturas'
  const [viaje, setViaje] = useState(null)
  const [facturas, setFacturas] = useState([])
  const [gastos, setGastos] = useState([])
  const [tarjetas, setTarjetas] = useState([])
  const [perfiles, setPerfiles] = useState([])
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    const [v, f, g, t, p] = await Promise.all([
      supabase.from('v_viajes').select('*').eq('id', id).maybeSingle(),
      supabase.from('v_facturas').select('id, numero, cliente_nombre, entregada, estado_pago, total, saldo, num_items').eq('viaje_id', id).order('cliente_nombre'),
      supabase.from('gastos').select('*').eq('viaje_id', id).order('fecha', { ascending: false }).order('creado_en', { ascending: false }),
      supabase.from('compras_tarjeta').select('monto, tarjeta_de, facturas!inner(viaje_id)').eq('facturas.viaje_id', id),
      cargarPerfiles(),
    ])
    const err = v.error || f.error || g.error
    if (err) { setError(mensajeError(err)); return }
    if (!v.data) { setError('Este viaje no existe.'); return }
    setViaje(v.data); setFacturas(f.data); setGastos(g.data); setTarjetas(t.data || []); setPerfiles(p)
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  if (error) return <div className="space-y-4"><Encabezado titulo="Viaje" volverA="/viajes" /><Aviso>{error}</Aviso></div>
  if (!viaje) return <Cargando />

  const fechas = [
    viaje.fecha_limite_pedidos && `Pedidos hasta ${fechaCorta(viaje.fecha_limite_pedidos)}`,
    viaje.fecha_entrega && `Entrega ${fechaCorta(viaje.fecha_entrega)}`,
  ].filter(Boolean).join(' · ')

  return (
    <div className="space-y-4">
      <Encabezado
        titulo={viaje.nombre}
        subtitulo={fechas || 'Sin fechas'}
        accion={<Link to={`/viajes/${id}/editar`} className="min-h-10 rounded-full bg-blanco px-4 py-2 text-sm font-medium">Editar</Link>}
      />
      {viaje.cerrado && <Aviso tipo="info">Este viaje está cerrado.</Aviso>}

      <Tarjeta>
        <p className="text-sm text-piedra">Ganancia del viaje</p>
        <p className={`cifra-grande mt-1 ${Number(viaje.ganancia) < 0 ? 'text-[#b8402f]' : ''}`}>{dinero(viaje.ganancia)}</p>
        <p className="mt-1 text-sm text-piedra">{dinero(viaje.total_servicio)} cobrado por traer − {dinero(viaje.total_gastos)} de gastos</p>
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-niebla pt-4 text-sm">
          <div><dt className="text-piedra">Por cobrar</dt><dd className="mt-0.5 text-base font-medium">{dinero(viaje.por_cobrar)}</dd></div>
          <div><dt className="text-piedra">Entregadas</dt><dd className="mt-0.5 text-base font-medium">{viaje.num_entregadas} de {viaje.num_facturas}</dd></div>
          <div><dt className="text-piedra">Tarjetas</dt><dd className="mt-0.5 text-base font-medium">{dinero(viaje.total_tarjeta)}</dd></div>
        </dl>
      </Tarjeta>

      <BotonesReporte viajeId={id} />

      <div className="grid grid-cols-3 gap-1 rounded-full bg-arena p-1" role="tablist">
        {[['facturas', `Facturas (${facturas.length})`], ['gastos', `Gastos (${gastos.length})`], ['reparto', 'Reparto']].map(([k, txt]) => (
          <button
            key={k}
            role="tab"
            aria-selected={pestana === k}
            onClick={() => setParams(k === 'facturas' ? {} : { ver: k }, { replace: true })}
            className={`min-h-11 rounded-full text-sm font-medium transition ${pestana === k ? 'bg-blanco' : 'text-tinta/70'}`}
          >
            {txt}
          </button>
        ))}
      </div>

      {pestana === 'facturas' && <ListaFacturas viajeId={id} facturas={facturas} />}
      {pestana === 'gastos' && <Gastos viajeId={id} gastos={gastos} tarjetas={tarjetas} perfiles={perfiles} onCambio={cargar} />}
      {pestana === 'reparto' && <Reparto viaje={viaje} perfiles={perfiles} onCambio={cargar} />}
    </div>
  )
}

function ListaFacturas({ viajeId, facturas }) {
  const [filtro, setFiltro] = useState('todas')
  const [busqueda, setBusqueda] = useState('')
  const filtros = [
    ['todas', 'Todas'],
    ['por_entregar', `Por entregar (${facturas.filter((f) => !f.entregada).length})`],
    ['por_cobrar', `Por cobrar (${facturas.filter((f) => Number(f.saldo) > 0).length})`],
  ]
  const lista = useMemo(() => facturas.filter((f) =>
    (filtro === 'todas' || (filtro === 'por_entregar' && !f.entregada) || (filtro === 'por_cobrar' && Number(f.saldo) > 0)) &&
    (!busqueda || normalizar(f.cliente_nombre).includes(normalizar(busqueda))),
  ), [facturas, filtro, busqueda])

  return (
    <div className="space-y-3">
      <Link to={`/facturas/nueva?viaje=${viajeId}`} className="flex min-h-13 items-center justify-between rounded-full bg-tinta py-2 pl-6 pr-2 font-medium text-blanco">
        Nueva factura
        <span className="flex size-9 items-center justify-center rounded-full bg-pasto text-tinta"><Icono nombre="mas_simple" size={18} grosor={2.4} /></span>
      </Link>

      {facturas.length === 0 ? (
        <Vacio titulo="Sin facturas en este viaje" texto="Crea una factura por cada cliente con lo que trae: ropa por libra, perfumes, celulares…" />
      ) : (
        <>
          {facturas.length > 5 && (
            <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar cliente"
              className="h-12 w-full rounded-full border border-niebla bg-blanco px-5 outline-none focus:border-tinta" />
          )}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filtros.map(([k, txt]) => (
              <button key={k} onClick={() => setFiltro(k)} aria-pressed={filtro === k}
                className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-medium ${filtro === k ? 'bg-tinta text-blanco' : 'bg-blanco'}`}>{txt}</button>
            ))}
          </div>
          {lista.length === 0 && <p className="py-6 text-center text-piedra">Nada por aquí.</p>}
          <ul className="space-y-2">
            {lista.map((f) => (
              <li key={f.id}>
                <Link to={`/facturas/${f.id}`} className="block rounded-tarjeta bg-blanco p-4 transition active:bg-crema">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 truncate font-medium">{f.cliente_nombre}</p>
                    <p className="shrink-0 font-medium">{dinero(f.total)}</p>
                  </div>
                  <p className="text-sm text-piedra">{numeroEncomienda(f.numero)} · {f.num_items} {f.num_items === 1 ? 'artículo' : 'artículos'}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <ChipEntrega entregada={f.entregada} />
                    <ChipPago estado={f.estado_pago} />
                    {Number(f.saldo) > 0 && <span className="ml-auto text-sm">Debe <strong className="font-medium">{dinero(f.saldo)}</strong></span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function Gastos({ viajeId, gastos, tarjetas, perfiles, onCambio }) {
  const { user, esAdmin } = useAuth()
  const vacio = { id: null, categoria: 'taxi', monto: '', fecha: hoyISO(), descripcion: '', pagado_por: user.id }
  const [form, setForm] = useState(vacio)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const nombre = (pid) => primerNombre(perfiles.find((p) => p.id === pid)?.nombre) || '—'
  const total = gastos.reduce((s, g) => s + Number(g.monto), 0)

  // Lo que puso cada socio de su bolsillo en este viaje
  const porSocio = perfiles.map((p) => ({
    ...p,
    gastos: gastos.filter((g) => g.pagado_por === p.id).reduce((s, g) => s + Number(g.monto), 0),
    tarjeta: tarjetas.filter((t) => t.tarjeta_de === p.id).reduce((s, t) => s + Number(t.monto), 0),
  })).filter((p) => p.gastos > 0 || p.tarjeta > 0)

  async function guardar(e) {
    e.preventDefault()
    setError('')
    const monto = Number(String(form.monto).replace(',', '.'))
    if (!(monto > 0)) { setError('Escribe el monto del gasto.'); return }
    setGuardando(true)
    const datos = { viaje_id: viajeId, categoria: form.categoria, monto, fecha: form.fecha || hoyISO(), descripcion: form.descripcion.trim() || null, pagado_por: form.pagado_por }
    const { error } = form.id
      ? await supabase.from('gastos').update(datos).eq('id', form.id)
      : await supabase.from('gastos').insert(datos)
    setGuardando(false)
    if (error) { setError(mensajeError(error)); return }
    setForm(vacio)
    onCambio()
  }

  async function borrar() {
    setGuardando(true)
    const { error } = await supabase.from('gastos').delete().eq('id', form.id)
    setGuardando(false)
    if (error) { setError(mensajeError(error)); return }
    setForm(vacio)
    onCambio()
  }

  return (
    <div className="space-y-4">
      <Tarjeta>
        <h2 className="mb-4 text-lg font-medium">{form.id ? 'Editar gasto' : 'Agregar gasto'}</h2>
        <form onSubmit={guardar} className="space-y-4" noValidate>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Categoría">
            {Object.entries(CATEGORIAS_GASTO).map(([k, c]) => (
              <button type="button" key={k} onClick={() => setForm((f) => ({ ...f, categoria: k }))} aria-pressed={form.categoria === k}
                className={`flex min-h-18 flex-col items-center justify-center gap-1 rounded-campo px-1 text-xs font-medium transition ${form.categoria === k ? 'bg-tinta text-blanco' : 'bg-crema'}`}>
                <Icono nombre={c.icono} size={22} />
                {c.texto}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Monto (USD)" name="monto" inputMode="decimal" placeholder="12,50" value={form.monto} onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))} />
            <Campo etiqueta="Fecha" name="fecha" type="date" value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} />
          </div>
          <Campo etiqueta="Detalle (opcional)" name="descripcion" placeholder="Uber al aeropuerto JFK" value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} />
          <div>
            <p className="mb-1.5 text-sm font-medium">¿Quién lo pagó?</p>
            <div className="flex flex-wrap gap-2">
              {perfiles.filter((p) => p.activo || p.id === form.pagado_por).map((p) => (
                <button type="button" key={p.id} onClick={() => setForm((f) => ({ ...f, pagado_por: p.id }))} aria-pressed={form.pagado_por === p.id}
                  className={`min-h-11 rounded-full px-4 text-sm font-medium ${form.pagado_por === p.id ? 'bg-tinta text-blanco' : 'border border-niebla'}`}>
                  {primerNombre(p.nombre)}{p.id === user.id ? ' (yo)' : ''}
                </button>
              ))}
            </div>
          </div>
          <Aviso>{error}</Aviso>
          <Boton type="submit" cargando={guardando} className="w-full">{form.id ? 'Guardar cambios' : 'Agregar gasto'}</Boton>
          {form.id && (
            <div className="grid grid-cols-2 gap-2">
              <Boton type="button" variante="secundario" onClick={() => setForm(vacio)}>Cancelar</Boton>
              {esAdmin && <Boton type="button" variante="peligro" onClick={borrar}>Eliminar</Boton>}
            </div>
          )}
        </form>
      </Tarjeta>

      {porSocio.length > 0 && (
        <Tarjeta hundida>
          <p className="mb-2 font-medium">Lo que puso cada uno</p>
          <ul className="space-y-1.5 text-sm">
            {porSocio.map((p) => (
              <li key={p.id} className="flex justify-between gap-3">
                <span>{primerNombre(p.nombre)}</span>
                <span className="text-right">
                  {p.gastos > 0 && <>Gastos {dinero(p.gastos)}</>}
                  {p.gastos > 0 && p.tarjeta > 0 && ' · '}
                  {p.tarjeta > 0 && <>Tarjeta {dinero(p.tarjeta)}</>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-piedra">Se les devuelve en la pestaña Reparto, además de su parte de la ganancia.</p>
        </Tarjeta>
      )}

      {gastos.length === 0 ? (
        <Vacio titulo="Sin gastos todavía" texto="Anota pasajes, taxis, buses y metro. Los clientes nunca ven esto." />
      ) : (
        <div>
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h3 className="font-medium">Gastos del viaje</h3>
            <span className="font-medium">{dinero(total)}</span>
          </div>
          <ul className="overflow-hidden rounded-tarjeta bg-blanco">
            {gastos.map((g) => (
              <li key={g.id} className="border-t border-niebla/70 first:border-t-0">
                <button
                  onClick={() => { setForm({ id: g.id, categoria: g.categoria, monto: String(g.monto), fecha: g.fecha, descripcion: g.descripcion || '', pagado_por: g.pagado_por }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-crema"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-arena"><Icono nombre={CATEGORIAS_GASTO[g.categoria]?.icono} size={20} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{g.descripcion || CATEGORIAS_GASTO[g.categoria]?.texto}</span>
                    <span className="block text-sm text-piedra">{fechaCorta(g.fecha)} · pagó {nombre(g.pagado_por)}</span>
                  </span>
                  <span className="font-medium">{dinero(g.monto)}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 px-1 text-xs text-piedra">Toca un gasto para corregirlo.</p>
        </div>
      )}
    </div>
  )
}

function BotonesReporte({ viajeId }) {
  const [estado, setEstado] = useState('')
  const [error, setError] = useState('')
  async function generar(tipo) {
    setEstado(tipo); setError('')
    try {
      const datos = await cargarDatosReporte(viajeId)
      await (tipo === 'excel' ? descargarExcel(datos) : descargarPdf(datos))
    } catch (e) {
      setError('No se pudo crear el reporte: ' + mensajeError(e))
    }
    setEstado('')
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-full bg-blanco p-1.5 pl-5">
        <span className="flex-1 text-sm font-medium">Reporte del viaje</span>
        <button onClick={() => generar('excel')} disabled={!!estado} className="flex min-h-11 items-center gap-1.5 rounded-full bg-pasto-tinte px-4 text-sm font-medium disabled:opacity-60">
          <span className="size-2 rounded-full bg-pasto" aria-hidden="true" />{estado === 'excel' ? 'Creando…' : 'Excel'}
        </button>
        <button onClick={() => generar('pdf')} disabled={!!estado} className="flex min-h-11 items-center gap-1.5 rounded-full bg-coral-tinte px-4 text-sm font-medium disabled:opacity-60">
          <span className="size-2 rounded-full bg-coral" aria-hidden="true" />{estado === 'pdf' ? 'Creando…' : 'PDF'}
        </button>
      </div>
      <Aviso>{error}</Aviso>
    </div>
  )
}
