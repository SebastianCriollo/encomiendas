import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { cargarPerfiles, primerNombre } from '../lib/datos'
import { dinero, fechaCorta, mensajeError, numeroEncomienda } from '../lib/formato'
import { METODOS_PAGO } from '../lib/estados'
import { whatsappUrl } from '../lib/telefono'
import { compartirRecibo, descargarRecibo } from '../lib/recibo'
import { Aviso, Boton, Campo, Cargando, ChipEntrega, ChipPago, Encabezado, Tarjeta } from '../components/ui'

const hoyISO = () => new Date().toLocaleDateString('en-CA')
const cantidadTexto = (i) => {
  const c = Number(i.cantidad).toLocaleString('es-EC', { maximumFractionDigits: 2 })
  return i.modo === 'por_lb' ? `${c} lb × ${dinero(i.precio_unitario)}` : `${c} × ${dinero(i.precio_unitario)}`
}

export default function FacturaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, esAdmin } = useAuth()
  const [f, setF] = useState(null)
  const [items, setItems] = useState([])
  const [compras, setCompras] = useState([])
  const [abonos, setAbonos] = useState([])
  const [perfiles, setPerfiles] = useState([])
  const [config, setConfig] = useState(null)
  const [pdf, setPdf] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)

  const cargar = useCallback(async () => {
    const [fa, it, co, ab, pe, conf] = await Promise.all([
      supabase.from('v_facturas').select('*').eq('id', id).maybeSingle(),
      supabase.from('items_factura').select('*').eq('factura_id', id).order('orden'),
      supabase.from('compras_tarjeta').select('*').eq('factura_id', id).order('orden'),
      supabase.from('abonos').select('*').eq('factura_id', id).order('fecha').order('creado_en'),
      cargarPerfiles(),
      supabase.from('configuracion').select('*').maybeSingle(),
    ])
    if (fa.error) { setError(mensajeError(fa.error)); return }
    if (!fa.data) { setError('Esta factura no existe o fue eliminada.'); return }
    setF(fa.data); setItems(it.data || []); setCompras(co.data || []); setAbonos(ab.data || [])
    setPerfiles(pe); setConfig(conf.data || null)
  }, [id])
  useEffect(() => { cargar() }, [cargar])

  if (error && !f) return <div className="space-y-4"><Encabezado titulo="Factura" volverA="/viaje" /><Aviso>{error}</Aviso></div>
  if (!f) return <Cargando />

  const nombre = (pid) => primerNombre(perfiles.find((p) => p.id === pid)?.nombre) || '—'
  const saldo = Number(f.saldo)

  async function cambiarEntrega() {
    setOcupado(true)
    const entregada = !f.entregada
    const { error } = await supabase.from('facturas').update({ entregada, fecha_entregada: entregada ? hoyISO() : null }).eq('id', id)
    setOcupado(false)
    if (error) setError(mensajeError(error)); else cargar()
  }

  async function borrarFactura() {
    setOcupado(true)
    const { error, count } = await supabase.from('facturas').delete({ count: 'exact' }).eq('id', id)
    setOcupado(false)
    if (error) { setError(mensajeError(error)); return }
    if (!count) { setError('No tienes permiso para eliminar facturas.'); return }
    navigate(`/viajes/${f.viaje_id}`, { replace: true })
  }

  // Resumen en texto para WhatsApp (el PDF llega en la etapa 5). Sin costos internos.
  const lineas = [
    ...items.map((i) => `• ${i.descripcion} (${cantidadTexto(i)}): ${dinero(i.subtotal)}`),
    ...compras.map((c) => `• ${c.descripcion} (compra con tarjeta): ${dinero(c.monto)}`),
  ]
  const mensaje = [
    `Hola ${primerNombre(f.cliente_nombre)}, te saluda ${config?.nombre_negocio || 'tu servicio de encargos'} 📦`,
    `Detalle de tu pedido ${numeroEncomienda(f.numero)}:`,
    ...lineas,
    `*Total: ${dinero(f.total)}*`,
    Number(f.abonado) > 0 ? `Abonado: ${dinero(f.abonado)}` : null,
    saldo > 0 ? `*Por pagar: ${dinero(saldo)}*` : '¡Todo pagado, gracias!',
  ].filter(Boolean).join('\n')
  const wa = whatsappUrl(f.cliente_telefono, mensaje)
  const datosRecibo = { factura: f, items, compras, abonos, negocio: config }

  async function enviarPdf() {
    setPdf('generando')
    try {
      const r = await compartirRecibo(datosRecibo)
      setPdf(r === 'descargado' ? 'descargado' : '')
    } catch (e) {
      setPdf(''); setError('No se pudo crear el PDF: ' + (e?.message || e))
    }
  }

  return (
    <div className="space-y-4">
      <Encabezado
        titulo={f.cliente_nombre}
        subtitulo={`Factura ${numeroEncomienda(f.numero)} · ${f.viaje_nombre}`}
        volverA={`/viajes/${f.viaje_id}`}
      />
      <div className="flex flex-wrap gap-1.5 px-1">
        <ChipEntrega entregada={f.entregada} />
        <ChipPago estado={f.estado_pago} />
      </div>

      <Tarjeta>
        <p className="text-sm text-piedra">{saldo > 0 ? 'Por cobrar' : saldo < 0 ? 'Saldo a favor del cliente' : 'Pagado completo'}</p>
        <p className={`cifra-grande mt-1 ${saldo > 0 ? '' : 'text-piedra'}`}>{dinero(Math.abs(saldo))}</p>
        <p className="mt-1 text-sm text-piedra">Total {dinero(f.total)} · abonado {dinero(f.abonado)}</p>
      </Tarjeta>

      <div className="grid grid-cols-1 gap-2">
        <Boton onClick={cambiarEntrega} cargando={ocupado} variante={f.entregada ? 'secundario' : 'principal'} className="w-full">
          {f.entregada ? `Entregado el ${fechaCorta(f.fecha_entregada)} · deshacer` : 'Marcar como entregado'}
        </Boton>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={enviarPdf} disabled={pdf === 'generando'} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-blanco px-3 font-medium disabled:opacity-60">
            <span className="size-2.5 rounded-full bg-coral" aria-hidden="true" />{pdf === 'generando' ? 'Creando…' : 'Recibo PDF'}
          </button>
          {wa ? (
            <a href={wa} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-blanco px-3 font-medium">
              <span className="size-2.5 rounded-full bg-pasto" aria-hidden="true" />Texto por WhatsApp
            </a>
          ) : (
            <button onClick={() => descargarRecibo(datosRecibo)} className="flex min-h-12 items-center justify-center rounded-full bg-blanco px-3 font-medium">Descargar PDF</button>
          )}
        </div>
        {pdf === 'descargado' && (
          <p className="text-center text-sm text-piedra">El recibo se descargó. Ábrelo en WhatsApp con 📎 → Documento.</p>
        )}
        {!wa && <p className="text-center text-sm text-piedra">Agrega el teléfono del cliente para enviarle el texto por WhatsApp.</p>}
      </div>

      <Aviso>{error}</Aviso>

      <Tarjeta>
        <h2 className="mb-3 text-lg font-medium">Detalle</h2>
        <ul className="divide-y divide-niebla/70">
          {items.map((i) => (
            <li key={i.id} className="flex items-baseline justify-between gap-3 py-2.5">
              <span className="min-w-0"><span className="block">{i.descripcion}</span><span className="block text-sm text-piedra">{cantidadTexto(i)}</span></span>
              <span className="shrink-0 font-medium">{dinero(i.subtotal)}</span>
            </li>
          ))}
          {compras.map((c) => (
            <li key={c.id} className="flex items-baseline justify-between gap-3 py-2.5">
              <span className="min-w-0"><span className="block">{c.descripcion}</span><span className="block text-sm text-piedra">Compra con tarjeta de {nombre(c.tarjeta_de)}</span></span>
              <span className="shrink-0 font-medium">{dinero(c.monto)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-baseline justify-between border-t border-niebla pt-3">
          <span className="font-medium">Total</span><span className="text-2xl font-medium">{dinero(f.total)}</span>
        </div>
        <p className="mt-3 rounded-campo bg-pasto-tinte px-4 py-2.5 text-sm">
          Ganancia de esta factura: <strong className="font-medium">{dinero(f.total_servicio)}</strong> <span className="text-piedra">(solo la ven los socios)</span>
        </p>
        {f.notas && <p className="mt-3 whitespace-pre-line text-sm"><span className="text-piedra">Notas: </span>{f.notas}</p>}
      </Tarjeta>

      <Abonos facturaId={id} abonos={abonos} saldo={saldo} perfiles={perfiles} usuarioId={user.id} esAdmin={esAdmin} nombre={nombre} onCambio={cargar} />

      <div className="grid grid-cols-1 gap-2 pt-2">
        <Link to={`/facturas/${id}/editar`} className="flex min-h-12 items-center justify-center rounded-full border border-niebla bg-blanco font-medium">Editar factura</Link>
        <Link to={`/clientes/${f.cliente_id}`} className="flex min-h-12 items-center justify-center rounded-full font-medium text-piedra">Ver ficha del cliente</Link>
        {esAdmin && !confirmarBorrar && <Boton variante="peligro" onClick={() => setConfirmarBorrar(true)}>Eliminar factura</Boton>}
        {confirmarBorrar && (
          <Tarjeta className="space-y-3 border-[1.5px] border-coral">
            <p>¿Eliminar esta factura{abonos.length ? ' y sus abonos' : ''}? Esto no se puede deshacer.</p>
            <div className="grid grid-cols-2 gap-2">
              <Boton variante="secundario" onClick={() => setConfirmarBorrar(false)}>Cancelar</Boton>
              <Boton variante="peligro" onClick={borrarFactura} cargando={ocupado}>Sí, eliminar</Boton>
            </div>
          </Tarjeta>
        )}
      </div>

      <p className="px-1 text-xs leading-relaxed text-piedra">
        Creada por {nombre(f.creado_por)} el {fechaCorta(f.creado_en)}
        {f.modificado_por && f.modificado_en !== f.creado_en && <> · Última edición por {nombre(f.modificado_por)} el {fechaCorta(f.modificado_en)}</>}
      </p>
    </div>
  )
}

function Abonos({ facturaId, abonos, saldo, perfiles, usuarioId, esAdmin, nombre, onCambio }) {
  const [abierto, setAbierto] = useState(false)
  const [form, setForm] = useState({ monto: '', metodo: 'efectivo', recibido_por: usuarioId, fecha: hoyISO() })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  function abrir() {
    setForm({ monto: saldo > 0 ? String(saldo) : '', metodo: 'efectivo', recibido_por: usuarioId, fecha: hoyISO() })
    setError('')
    setAbierto(true)
  }

  async function guardar(e) {
    e.preventDefault()
    const monto = Number(String(form.monto).replace(',', '.'))
    if (!(monto > 0)) { setError('Escribe el monto recibido.'); return }
    setGuardando(true)
    const { error } = await supabase.from('abonos').insert({ factura_id: facturaId, monto, metodo: form.metodo, recibido_por: form.recibido_por, fecha: form.fecha || hoyISO() })
    setGuardando(false)
    if (error) { setError(mensajeError(error)); return }
    setAbierto(false)
    onCambio()
  }

  async function borrar(id) {
    const { error } = await supabase.from('abonos').delete().eq('id', id)
    if (error) setError(mensajeError(error)); else onCambio()
  }

  return (
    <Tarjeta>
      <h2 className="mb-3 text-lg font-medium">Abonos</h2>
      {abonos.length === 0 && !abierto && <p className="mb-3 text-sm text-piedra">Todavía no ha pagado nada.</p>}
      {abonos.length > 0 && (
        <ul className="mb-3 divide-y divide-niebla/70">
          {abonos.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block font-medium">{dinero(a.monto)}</span>
                <span className="block text-sm text-piedra">{fechaCorta(a.fecha)} · {METODOS_PAGO[a.metodo] || a.metodo} · recibió {nombre(a.recibido_por)}</span>
              </span>
              {esAdmin && (
                <button onClick={() => borrar(a.id)} className="min-h-10 shrink-0 rounded-full px-3 text-sm text-piedra underline decoration-niebla underline-offset-4">Quitar</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!abierto ? (
        <Boton variante={saldo > 0 ? 'principal' : 'secundario'} onClick={abrir} className="w-full">Registrar abono</Boton>
      ) : (
        <form onSubmit={guardar} className="space-y-4 rounded-campo bg-crema p-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Monto (USD)" name="monto-abono" inputMode="decimal" value={form.monto} onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))} autoFocus />
            <Campo etiqueta="Fecha" name="fecha-abono" type="date" value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Método">
            {Object.entries(METODOS_PAGO).map(([k, t]) => (
              <button type="button" key={k} onClick={() => setForm((f) => ({ ...f, metodo: k }))} aria-pressed={form.metodo === k}
                className={`min-h-11 rounded-full text-sm font-medium ${form.metodo === k ? 'bg-tinta text-blanco' : 'border border-niebla bg-blanco'}`}>{t}</button>
            ))}
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">¿Quién recibió el dinero?</p>
            <div className="flex flex-wrap gap-2">
              {perfiles.filter((p) => p.activo || p.id === form.recibido_por).map((p) => (
                <button type="button" key={p.id} onClick={() => setForm((f) => ({ ...f, recibido_por: p.id }))} aria-pressed={form.recibido_por === p.id}
                  className={`min-h-11 rounded-full px-4 text-sm font-medium ${form.recibido_por === p.id ? 'bg-tinta text-blanco' : 'border border-niebla bg-blanco'}`}>{primerNombre(p.nombre)}</button>
              ))}
            </div>
          </div>
          <Aviso>{error}</Aviso>
          <div className="grid grid-cols-2 gap-2">
            <Boton type="button" variante="secundario" onClick={() => setAbierto(false)}>Cancelar</Boton>
            <Boton type="submit" cargando={guardando}>Guardar</Boton>
          </div>
        </form>
      )}
    </Tarjeta>
  )
}
