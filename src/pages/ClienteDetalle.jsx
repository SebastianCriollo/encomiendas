import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { dinero, fechaCorta, mensajeError, numeroEncomienda } from '../lib/formato'
import { llamarUrl, whatsappUrl } from '../lib/telefono'
import { Aviso, Boton, Cargando, ChipEntrega, ChipPago, Encabezado, Tarjeta, Vacio } from '../components/ui'

export default function ClienteDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { esAdmin } = useAuth()
  const [cliente, setCliente] = useState(null)
  const [encomiendas, setEncomiendas] = useState([])
  const [nombres, setNombres] = useState({})
  const [negocio, setNegocio] = useState('')
  const [error, setError] = useState('')
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const [borrando, setBorrando] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('v_clientes').select('*').eq('id', id).maybeSingle(),
      supabase.from('v_facturas')
        .select('id, numero, viaje_nombre, entregada, estado_pago, total, saldo, num_items, creado_en')
        .eq('cliente_id', id).order('creado_en', { ascending: false }),
      supabase.from('perfiles').select('id, nombre'),
      supabase.from('configuracion').select('nombre_negocio').maybeSingle(),
    ]).then(([c, e, p, conf]) => {
      const err = c.error || e.error
      if (err) { setError(mensajeError(err)); return }
      if (!c.data) { setError('Este cliente no existe o fue eliminado.'); return }
      setCliente(c.data)
      setEncomiendas(e.data)
      setNombres(Object.fromEntries((p.data || []).map((x) => [x.id, x.nombre])))
      setNegocio(conf.data?.nombre_negocio || '')
    })
  }, [id])

  if (error) return <div className="space-y-4"><Encabezado titulo="Cliente" volverA="/clientes" /><Aviso>{error}</Aviso></div>
  if (!cliente) return <Cargando />

  const saldo = Number(cliente.saldo)
  const primerNombre = cliente.nombre.split(' ')[0]
  const recordatorio =
    `Hola ${primerNombre}, te saluda ${negocio || 'tu proveedor de encomiendas'}. ` +
    `Te comento que tienes un saldo pendiente de ${dinero(saldo)}. ¡Gracias!`
  const wa = whatsappUrl(cliente.telefono)
  const tel = llamarUrl(cliente.telefono)

  async function borrar() {
    setBorrando(true)
    const { error, count } = await supabase.from('clientes').delete({ count: 'exact' }).eq('id', id)
    setBorrando(false)
    if (error) { setError(mensajeError(error)); return }
    if (!count) { setError('No tienes permiso para borrar clientes.'); return }
    navigate('/clientes', { replace: true })
  }

  return (
    <div className="space-y-4">
      <Encabezado
        titulo={cliente.nombre}
        subtitulo={[cliente.ciudad, cliente.telefono].filter(Boolean).join(' · ')}
        volverA="/clientes"
      />

      {(wa || tel) && (
        <div className="grid grid-cols-2 gap-2">
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-blanco font-medium">
              <span className="size-2.5 rounded-full bg-pasto" aria-hidden="true" />WhatsApp
            </a>
          )}
          {tel && (
            <a href={tel} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-blanco font-medium">
              <span className="size-2.5 rounded-full bg-cielo" aria-hidden="true" />Llamar
            </a>
          )}
        </div>
      )}

      <Tarjeta>
        <p className="text-sm text-piedra">{saldo > 0 ? 'Debe' : 'Saldo'}</p>
        <p className={`cifra-grande mt-1 ${saldo > 0 ? '' : 'text-piedra'}`}>{dinero(saldo)}</p>
        <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-niebla pt-4 text-sm">
          <div><dt className="text-piedra">Facturas</dt><dd className="mt-0.5 text-base font-medium">{cliente.num_facturas}</dd></div>
          <div><dt className="text-piedra">Cobrado</dt><dd className="mt-0.5 text-base font-medium">{dinero(cliente.total_cobrado)}</dd></div>
          <div><dt className="text-piedra">Abonado</dt><dd className="mt-0.5 text-base font-medium">{dinero(cliente.total_abonado)}</dd></div>
        </dl>
        {saldo > 0 && wa && (
          <a
            href={whatsappUrl(cliente.telefono, recordatorio)}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-coral font-medium"
          >
            Recordar saldo por WhatsApp
          </a>
        )}
      </Tarjeta>

      {cliente.notas && (
        <Tarjeta hundida>
          <p className="mb-1 text-sm font-medium">Notas</p>
          <p className="whitespace-pre-line">{cliente.notas}</p>
        </Tarjeta>
      )}

      <section aria-labelledby="historial" className="space-y-3">
        <h2 id="historial" className="px-1 text-lg font-medium">Historial de facturas</h2>
        <Link to={`/facturas/nueva?cliente=${id}`} className="flex min-h-13 items-center justify-center rounded-full bg-tinta font-medium text-blanco">
          Nueva factura para {primerNombre}
        </Link>
        {encomiendas.length === 0 ? (
          <Vacio titulo="Sin facturas todavía" texto="Cuando le hagas una factura aparecerá aquí con lo que debe." />
        ) : (
          <ul className="space-y-2">
            {encomiendas.map((e) => (
              <li key={e.id}>
                <Link to={`/facturas/${e.id}`} className="block rounded-tarjeta bg-blanco p-4 transition active:bg-crema">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 truncate font-medium">{e.viaje_nombre}</p>
                    <p className="shrink-0 text-xs text-piedra">{numeroEncomienda(e.numero)}</p>
                  </div>
                  <p className="mt-0.5 text-sm text-piedra">{e.num_items} {e.num_items === 1 ? 'artículo' : 'artículos'} · {dinero(e.total)}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <ChipEntrega entregada={e.entregada} />
                    <ChipPago estado={e.estado_pago} />
                    {Number(e.saldo) > 0 && <span className="ml-auto text-sm">Debe <strong className="font-medium">{dinero(e.saldo)}</strong></span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-2 pt-2">
        <Link to={`/clientes/${id}/editar`} className="flex min-h-12 items-center justify-center rounded-full border border-niebla bg-blanco font-medium">
          Editar datos
        </Link>
        {esAdmin && cliente.num_facturas === 0 && !confirmarBorrar && (
          <Boton variante="peligro" onClick={() => setConfirmarBorrar(true)}>Eliminar cliente</Boton>
        )}
        {confirmarBorrar && (
          <Tarjeta className="space-y-3 border-[1.5px] border-coral">
            <p>¿Eliminar a <strong className="font-medium">{cliente.nombre}</strong>? Esto no se puede deshacer.</p>
            <div className="grid grid-cols-2 gap-2">
              <Boton variante="secundario" onClick={() => setConfirmarBorrar(false)}>Cancelar</Boton>
              <Boton variante="peligro" onClick={borrar} cargando={borrando}>Sí, eliminar</Boton>
            </div>
          </Tarjeta>
        )}
      </div>

      <p className="px-1 text-xs leading-relaxed text-piedra">
        Creado por {nombres[cliente.creado_por] || '—'} el {fechaCorta(cliente.creado_en)}
        {cliente.modificado_por && cliente.modificado_en !== cliente.creado_en && (
          <> · Última edición por {nombres[cliente.modificado_por] || '—'} el {fechaCorta(cliente.modificado_en)}</>
        )}
      </p>
    </div>
  )
}
