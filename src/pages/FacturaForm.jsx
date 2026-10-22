import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { buscarViajeActual, cargarPerfiles, primerNombre } from '../lib/datos'
import { dinero, mensajeError, normalizar } from '../lib/formato'
import { soloDigitos } from '../lib/telefono'
import { Aviso, AreaTexto, Boton, Campo, Cargando, Encabezado, Tarjeta } from '../components/ui'
import Icono from '../components/Icono'

const num = (v) => Number(String(v ?? '').replace(',', '.'))
const redondear = (n) => Math.round(n * 100) / 100
let contador = 0
const nuevaClave = () => `l${++contador}`

export default function FacturaForm() {
  const { id } = useParams()
  const editando = Boolean(id)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [listo, setListo] = useState(false)
  const [tarifas, setTarifas] = useState([])
  const [viajes, setViajes] = useState([])
  const [perfiles, setPerfiles] = useState([])
  const [clientes, setClientes] = useState([])

  const [cliente, setCliente] = useState(null)
  const [viajeId, setViajeId] = useState('')
  const [items, setItems] = useState([])
  const [compras, setCompras] = useState([])
  const [notas, setNotas] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const enfocar = useRef(null)

  useEffect(() => {
    (async () => {
      const [t, v, c, p, actual] = await Promise.all([
        supabase.from('tarifas').select('*').order('orden'),
        supabase.from('viajes').select('id, nombre, cerrado').order('creado_en', { ascending: false }),
        supabase.from('clientes').select('id, nombre, telefono, ciudad').order('nombre'),
        cargarPerfiles(),
        buscarViajeActual().catch(() => null),
      ])
      const err = t.error || v.error || c.error
      if (err) { setError(mensajeError(err)); return }
      setTarifas(t.data); setViajes(v.data); setClientes(c.data); setPerfiles(p)

      if (editando) {
        const [f, it, co] = await Promise.all([
          supabase.from('facturas').select('*').eq('id', id).single(),
          supabase.from('items_factura').select('*').eq('factura_id', id).order('orden'),
          supabase.from('compras_tarjeta').select('*').eq('factura_id', id).order('orden'),
        ])
        if (f.error) { setError(mensajeError(f.error)); return }
        setViajeId(f.data.viaje_id)
        setCliente(c.data.find((x) => x.id === f.data.cliente_id) || null)
        setNotas(f.data.notas || '')
        setItems(it.data.map((x) => ({ clave: nuevaClave(), tarifa_id: x.tarifa_id, icono: t.data.find((tt) => tt.id === x.tarifa_id)?.icono || 'otro', descripcion: x.descripcion, modo: x.modo, cantidad: String(x.cantidad), precio_unitario: String(x.precio_unitario) })))
        setCompras(co.data.map((x) => ({ clave: nuevaClave(), descripcion: x.descripcion, monto: String(x.monto), tarjeta_de: x.tarjeta_de })))
      } else {
        setViajeId(params.get('viaje') || actual?.id || '')
        const cid = params.get('cliente')
        if (cid) setCliente(c.data.find((x) => x.id === cid) || null)
      }
      setListo(true)
    })()
  }, [id, editando, params])

  // Enfoca el campo de cantidad de la línea recién agregada
  useEffect(() => {
    if (enfocar.current) { document.getElementById(`cant-${enfocar.current}`)?.focus(); enfocar.current = null }
  }, [items])

  const resumen = useMemo(() => {
    const servicio = items.reduce((s, i) => s + (num(i.cantidad) > 0 && num(i.precio_unitario) >= 0 ? num(i.cantidad) * num(i.precio_unitario) : 0), 0)
    const tarjeta = compras.reduce((s, c) => s + (num(c.monto) > 0 ? num(c.monto) : 0), 0)
    return { servicio: redondear(servicio), tarjeta: redondear(tarjeta), total: redondear(servicio + tarjeta) }
  }, [items, compras])

  if (!listo) return error ? <Aviso>{error}</Aviso> : <Cargando />

  const viajesVisibles = viajes.filter((v) => !v.cerrado || v.id === viajeId)
  const volverA = editando ? `/facturas/${id}` : viajeId ? `/viajes/${viajeId}` : '/viaje'

  function agregarTarifa(t) {
    const clave = nuevaClave()
    enfocar.current = clave
    setItems((xs) => [...xs, { clave, tarifa_id: t.id, icono: t.icono, descripcion: t.nombre, modo: t.modo, cantidad: t.modo === 'por_lb' ? '' : '1', precio_unitario: String(t.precio) }])
  }
  function agregarOtro() {
    const clave = nuevaClave()
    setItems((xs) => [...xs, { clave, tarifa_id: null, icono: 'otro', descripcion: '', modo: 'por_unidad', cantidad: '1', precio_unitario: '' }])
    setTimeout(() => document.getElementById(`desc-${clave}`)?.focus(), 0)
  }
  const cambiarItem = (clave, campo, v) => setItems((xs) => xs.map((x) => (x.clave === clave ? { ...x, [campo]: v } : x)))
  const quitarItem = (clave) => setItems((xs) => xs.filter((x) => x.clave !== clave))
  const cambiarCompra = (clave, campo, v) => setCompras((xs) => xs.map((x) => (x.clave === clave ? { ...x, [campo]: v } : x)))

  async function guardar() {
    setError('')
    if (!cliente) { setError('Elige o crea el cliente.'); return }
    if (!viajeId) { setError('Elige el viaje.'); return }
    if (items.length + compras.length === 0) { setError('Agrega al menos un artículo.'); return }
    for (const i of items) {
      if (!i.descripcion.trim()) { setError('Hay un artículo sin nombre.'); return }
      if (!(num(i.cantidad) > 0)) { setError(`Falta ${i.modo === 'por_lb' ? 'el peso' : 'la cantidad'} de “${i.descripcion}”.`); return }
      if (!(num(i.precio_unitario) >= 0) || i.precio_unitario === '') { setError(`Falta el precio de “${i.descripcion}”.`); return }
    }
    for (const c of compras) {
      if (!c.descripcion.trim() || !(num(c.monto) > 0)) { setError('Completa el producto y el monto de cada compra con tarjeta.'); return }
    }
    setGuardando(true)
    const { data, error } = await supabase.rpc('guardar_factura', {
      p_factura: { id: id || null, viaje_id: viajeId, cliente_id: cliente.id, notas: notas.trim() },
      p_items: items.map((i) => ({ tarifa_id: i.tarifa_id, descripcion: i.descripcion.trim(), modo: i.modo, cantidad: num(i.cantidad), precio_unitario: num(i.precio_unitario) })),
      p_compras: compras.map((c) => ({ descripcion: c.descripcion.trim(), monto: num(c.monto), tarjeta_de: c.tarjeta_de })),
    })
    setGuardando(false)
    if (error) { setError(mensajeError(error)); return }
    navigate(`/facturas/${data}`, { replace: true })
  }

  return (
    <div className="space-y-4">
      <Encabezado titulo={editando ? 'Editar factura' : 'Nueva factura'} volverA={volverA} />

      {/* 1. Cliente */}
      <Tarjeta>
        <h2 className="mb-3 text-lg font-medium">Cliente</h2>
        <SelectorCliente
          clientes={clientes}
          cliente={cliente}
          onElegir={setCliente}
          onCreado={(c) => { setClientes((xs) => [...xs, c]); setCliente(c) }}
        />
        {viajesVisibles.length > 1 && (
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium">Viaje</span>
            <select value={viajeId} onChange={(e) => setViajeId(e.target.value)} className="h-13 w-full rounded-campo border border-niebla bg-blanco px-4 outline-none focus:border-tinta">
              {viajesVisibles.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
            </select>
          </label>
        )}
        {viajesVisibles.length === 0 && <div className="mt-4"><Aviso>Primero crea un viaje en la pestaña Viaje.</Aviso></div>}
      </Tarjeta>

      {/* 2. Artículos */}
      <Tarjeta>
        <h2 className="text-lg font-medium">¿Qué trae?</h2>
        <p className="mb-3 text-sm text-piedra">Toca para agregar. Puedes repetir.</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {tarifas.filter((t) => t.activa).map((t) => (
            <button key={t.id} type="button" onClick={() => agregarTarifa(t)}
              className="flex min-h-21 flex-col items-center justify-center gap-1 rounded-campo bg-crema px-1 py-2 text-center transition active:scale-95 active:bg-arena">
              <Icono nombre={t.icono} size={24} />
              <span className="text-xs font-medium leading-tight">{t.nombre}</span>
              <span className="text-[11px] text-piedra">{dinero(t.precio).replace(',00', '')}{t.modo === 'por_lb' ? '/lb' : ''}</span>
            </button>
          ))}
          <button type="button" onClick={agregarOtro}
            className="flex min-h-21 flex-col items-center justify-center gap-1 rounded-campo border-[1.5px] border-dashed border-arena px-1 py-2 transition active:scale-95">
            <Icono nombre="mas_simple" size={24} />
            <span className="text-xs font-medium">Otro</span>
          </button>
        </div>

        {items.length > 0 && (
          <ul className="mt-5 space-y-3">
            {items.map((i) => {
              const sub = num(i.cantidad) * num(i.precio_unitario)
              return (
                <li key={i.clave} className="rounded-campo border border-niebla p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-arena"><Icono nombre={i.icono} size={18} /></span>
                    <label className="min-w-0 flex-1">
                      <span className="sr-only">Descripción</span>
                      <input id={`desc-${i.clave}`} value={i.descripcion} onChange={(e) => cambiarItem(i.clave, 'descripcion', e.target.value)} placeholder="¿Qué es?"
                        className="h-10 w-full rounded-lg bg-transparent px-1 font-medium outline-none focus:bg-crema" />
                    </label>
                    <button type="button" onClick={() => quitarItem(i.clave)} aria-label={`Quitar ${i.descripcion}`} className="flex size-10 shrink-0 items-center justify-center rounded-full text-piedra active:bg-crema">
                      <Icono nombre="basura" size={18} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {!i.tarifa_id && (
                      <div className="flex rounded-full bg-crema p-0.5 text-xs">
                        {[['por_unidad', 'c/u'], ['por_lb', 'lb']].map(([m, t]) => (
                          <button type="button" key={m} onClick={() => cambiarItem(i.clave, 'modo', m)} aria-pressed={i.modo === m}
                            className={`min-h-9 rounded-full px-3 font-medium ${i.modo === m ? 'bg-tinta text-blanco' : ''}`}>{t}</button>
                        ))}
                      </div>
                    )}
                    <label className="flex items-center gap-1">
                      <span className="sr-only">{i.modo === 'por_lb' ? 'Peso en libras' : 'Cantidad'}</span>
                      <input id={`cant-${i.clave}`} inputMode="decimal" value={i.cantidad} onChange={(e) => cambiarItem(i.clave, 'cantidad', e.target.value)}
                        placeholder={i.modo === 'por_lb' ? '0,0' : '1'}
                        className="h-11 w-18 rounded-lg border border-niebla bg-blanco px-2 text-right text-lg font-medium outline-none focus:border-tinta" />
                      <span className="text-sm text-piedra">{i.modo === 'por_lb' ? 'lb' : 'u.'}</span>
                    </label>
                    <span className="text-piedra">×</span>
                    <label className="flex items-center gap-1">
                      <span className="text-sm text-piedra">$</span>
                      <span className="sr-only">Precio</span>
                      <input inputMode="decimal" value={i.precio_unitario} onChange={(e) => cambiarItem(i.clave, 'precio_unitario', e.target.value)} placeholder="0"
                        className="h-11 w-16 rounded-lg border border-niebla bg-blanco px-2 text-right outline-none focus:border-tinta" />
                    </label>
                    <span className="ml-auto text-right font-medium">{sub > 0 ? dinero(sub) : '—'}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Tarjeta>

      {/* 3. Compras con tarjeta */}
      <Tarjeta>
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-cielo-tinte"><Icono nombre="tarjeta" size={20} /></span>
          <div>
            <h2 className="text-lg font-medium">Compras con tarjeta</h2>
            <p className="text-sm text-piedra">Si ustedes compraron el producto, el cliente paga exactamente lo que salió en la tarjeta.</p>
          </div>
        </div>
        {compras.length > 0 && (
          <ul className="mt-4 space-y-3">
            {compras.map((c) => (
              <li key={c.clave} className="space-y-2 rounded-campo border border-niebla p-3">
                <div className="flex gap-2">
                  <input value={c.descripcion} onChange={(e) => cambiarCompra(c.clave, 'descripcion', e.target.value)} placeholder="Zapatos Nike (Amazon)" aria-label="Producto comprado"
                    className="h-11 min-w-0 flex-1 rounded-lg border border-niebla px-3 outline-none focus:border-tinta" />
                  <label className="flex items-center gap-1">
                    <span className="text-sm text-piedra">$</span>
                    <input inputMode="decimal" value={c.monto} onChange={(e) => cambiarCompra(c.clave, 'monto', e.target.value)} placeholder="0,00" aria-label="Monto cobrado en la tarjeta"
                      className="h-11 w-22 rounded-lg border border-niebla px-2 text-right font-medium outline-none focus:border-tinta" />
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-piedra">Tarjeta de</span>
                  {perfiles.filter((p) => p.activo || p.id === c.tarjeta_de).map((p) => (
                    <button type="button" key={p.id} onClick={() => cambiarCompra(c.clave, 'tarjeta_de', p.id)} aria-pressed={c.tarjeta_de === p.id}
                      className={`min-h-9 rounded-full px-3 text-sm font-medium ${c.tarjeta_de === p.id ? 'bg-tinta text-blanco' : 'border border-niebla'}`}>{primerNombre(p.nombre)}</button>
                  ))}
                  <button type="button" onClick={() => setCompras((xs) => xs.filter((x) => x.clave !== c.clave))} aria-label="Quitar compra"
                    className="ml-auto flex size-10 items-center justify-center rounded-full text-piedra active:bg-crema"><Icono nombre="basura" size={18} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={() => setCompras((xs) => [...xs, { clave: nuevaClave(), descripcion: '', monto: '', tarjeta_de: user.id }])}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-niebla font-medium">
          <Icono nombre="mas_simple" size={18} /> Agregar compra con tarjeta
        </button>
      </Tarjeta>

      <Tarjeta>
        <AreaTexto etiqueta="Notas (opcional)" name="notas" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Entregar en su trabajo, paga el viernes…" />
      </Tarjeta>

      {/* 4. Resumen en vivo */}
      <Tarjeta className="space-y-2">
        <div className="flex justify-between"><span className="text-piedra">Cobro por traer</span><span>{dinero(resumen.servicio)}</span></div>
        <div className="flex justify-between"><span className="text-piedra">Compras con tarjeta</span><span>{dinero(resumen.tarjeta)}</span></div>
        <div className="flex items-baseline justify-between border-t border-niebla pt-3">
          <span className="font-medium">Total a cobrar</span>
          <span className="text-3xl font-medium tracking-tight">{dinero(resumen.total)}</span>
        </div>
        <div className="flex justify-between rounded-campo bg-pasto-tinte px-4 py-3">
          <span>Ganancia <span className="text-sm text-piedra">(antes de gastos)</span></span>
          <span className="font-medium">{dinero(resumen.servicio)}</span>
        </div>
        <p className="text-xs text-piedra">El cliente solo ve el total y el detalle de lo que paga.</p>
      </Tarjeta>

      <Aviso>{error}</Aviso>
      <Boton onClick={guardar} cargando={guardando} className="w-full">{editando ? 'Guardar cambios' : 'Guardar factura'}</Boton>
    </div>
  )
}

// Buscar un cliente o crearlo sin salir de la factura
function SelectorCliente({ clientes, cliente, onElegir, onCreado }) {
  const [texto, setTexto] = useState('')
  const [creando, setCreando] = useState(false)
  const [nuevo, setNuevo] = useState({ telefono: '', ciudad: '' })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  if (cliente) {
    return (
      <div className="flex items-center gap-3 rounded-campo bg-crema p-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-arena font-medium">{cliente.nombre.charAt(0).toUpperCase()}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{cliente.nombre}</span>
          <span className="block truncate text-sm text-piedra">{[cliente.ciudad, cliente.telefono].filter(Boolean).join(' · ') || 'Sin teléfono'}</span>
        </span>
        <button type="button" onClick={() => onElegir(null)} className="min-h-10 rounded-full px-3 text-sm underline decoration-niebla underline-offset-4">Cambiar</button>
      </div>
    )
  }

  const q = normalizar(texto)
  const dig = soloDigitos(texto)
  const resultados = q
    ? clientes.filter((c) => normalizar(c.nombre).includes(q) || (dig.length >= 3 && soloDigitos(c.telefono).includes(dig))).slice(0, 6)
    : []

  async function crear() {
    setError('')
    if (!texto.trim()) { setError('Escribe el nombre.'); return }
    setGuardando(true)
    const { data, error } = await supabase.from('clientes')
      .insert({ nombre: texto.trim().replace(/\s+/g, ' '), telefono: nuevo.telefono.trim() || null, ciudad: nuevo.ciudad.trim() || null })
      .select('id, nombre, telefono, ciudad').single()
    setGuardando(false)
    if (error) { setError(mensajeError(error)); return }
    onCreado(data)
  }

  return (
    <div className="space-y-3">
      <input type="search" value={texto} onChange={(e) => { setTexto(e.target.value); setCreando(false) }} placeholder="Busca o escribe el nombre" aria-label="Cliente"
        className="h-13 w-full rounded-full border border-niebla bg-blanco px-5 text-base outline-none focus:border-tinta" />
      {resultados.length > 0 && (
        <ul className="overflow-hidden rounded-campo border border-niebla">
          {resultados.map((c) => (
            <li key={c.id} className="border-t border-niebla first:border-t-0">
              <button type="button" onClick={() => onElegir(c)} className="flex min-h-13 w-full items-center justify-between gap-3 px-4 text-left active:bg-crema">
                <span className="truncate font-medium">{c.nombre}</span>
                <span className="shrink-0 text-sm text-piedra">{c.ciudad || c.telefono}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {texto.trim() && !creando && (
        <button type="button" onClick={() => setCreando(true)} className="flex min-h-12 w-full items-center gap-2 rounded-full bg-pasto-tinte px-5 font-medium">
          <Icono nombre="mas_simple" size={18} /> Crear “{texto.trim()}” como cliente nuevo
        </button>
      )}
      {creando && (
        <div className="space-y-3 rounded-campo bg-crema p-4">
          <p className="font-medium">Nuevo cliente: {texto.trim()}</p>
          <Campo etiqueta="Teléfono (WhatsApp)" name="nuevo-telefono" type="tel" inputMode="tel" placeholder="0991234567" value={nuevo.telefono} onChange={(e) => setNuevo((n) => ({ ...n, telefono: e.target.value }))} />
          <Campo etiqueta="Ciudad" name="nuevo-ciudad" placeholder="Quito" value={nuevo.ciudad} onChange={(e) => setNuevo((n) => ({ ...n, ciudad: e.target.value }))} />
          <Aviso>{error}</Aviso>
          <Boton type="button" variante="secundario" onClick={crear} cargando={guardando} className="w-full">Crear y usar este cliente</Boton>
        </div>
      )}
    </div>
  )
}
