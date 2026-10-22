import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { primerNombre } from '../lib/datos'
import { dinero, fechaCorta, mensajeError } from '../lib/formato'
import { Aviso, Boton, Campo, Cargando, Tarjeta } from '../components/ui'
import SelectorSocios from '../components/SelectorSocios'

const hoyISO = () => new Date().toLocaleDateString('en-CA')

// Pestaña "Reparto" dentro de un viaje
export default function Reparto({ viaje, perfiles, onCambio }) {
  const { puedeRepartir } = useAuth()
  const [filas, setFilas] = useState(null)
  const [pagos, setPagos] = useState([])
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    const [r, p] = await Promise.all([
      supabase.from('v_reparto').select('*').eq('viaje_id', viaje.id).order('porcentaje', { ascending: false }),
      supabase.from('pagos_socios').select('*').eq('viaje_id', viaje.id).order('fecha'),
    ])
    if (r.error || p.error) { setError(mensajeError(r.error || p.error)); return }
    setFilas(r.data); setPagos(p.data)
  }, [viaje.id])
  useEffect(() => { cargar() }, [cargar, viaje])

  if (!filas) return error ? <Aviso>{error}</Aviso> : <Cargando />

  const actualizar = () => { cargar(); onCambio?.() }
  const totalPendiente = filas.reduce((s, f) => s + Math.max(Number(f.pendiente), 0), 0)
  const cobrado = filas.filter((f) => Number(f.cobrado) > 0)
  const participantes = filas.filter((f) => f.participa)

  return (
    <div className="space-y-4">
      <Aviso>{error}</Aviso>

      {Number(viaje.por_cobrar) > 0 && (
        <Aviso tipo="info">
          Aún faltan <strong className="font-medium">{dinero(viaje.por_cobrar)}</strong> por cobrar a clientes. El reparto ya cuenta esas facturas como si estuvieran pagadas.
        </Aviso>
      )}
      {participantes.length === 0 ? (
        <Aviso>Este viaje no tiene socios participantes. {puedeRepartir ? 'Elígelos abajo.' : 'Pídele al administrador que los elija.'}</Aviso>
      ) : (
        <p className="px-1 text-sm text-piedra">
          La ganancia se reparte en partes iguales entre {participantes.length === 1 ? '1 socio' : `${participantes.length} socios`}: {participantes.map((f) => primerNombre(f.nombre)).join(', ')}.
        </p>
      )}

      {filas.length === 0 && <Tarjeta><p className="text-piedra">Todavía no hay nada para repartir en este viaje.</p></Tarjeta>}

      {filas.map((f) => (
        <TarjetaSocio
          key={f.socio_id}
          f={f}
          pagos={pagos.filter((p) => p.socio_id === f.socio_id)}
          viajeId={viaje.id}
          puedeRepartir={puedeRepartir}
          onCambio={actualizar}
        />
      ))}

      {filas.length > 0 && (
        <Tarjeta hundida className="space-y-2 text-sm">
          <div className="flex justify-between"><span>Falta pagar a socios</span><strong className="font-medium">{dinero(totalPendiente)}</strong></div>
          {cobrado.length > 0 && (
            <div>
              <p className="mt-2 font-medium">¿Quién tiene el dinero cobrado?</p>
              {cobrado.map((f) => (
                <div key={f.socio_id} className="flex justify-between"><span>{primerNombre(f.nombre)} recibió de clientes</span><span>{dinero(f.cobrado)}</span></div>
              ))}
            </div>
          )}
        </Tarjeta>
      )}

      {puedeRepartir && <EditarParticipantes viajeId={viaje.id} filas={filas} perfiles={perfiles} onCambio={actualizar} />}
    </div>
  )
}

function TarjetaSocio({ f, pagos, viajeId, puedeRepartir, onCambio }) {
  const [abierto, setAbierto] = useState(false)
  const [form, setForm] = useState({ monto: '', fecha: hoyISO(), notas: '' })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const pendiente = Number(f.pendiente)

  async function guardar(e) {
    e.preventDefault()
    const monto = Number(String(form.monto).replace(',', '.'))
    if (!(monto > 0)) { setError('Escribe el monto pagado.'); return }
    setGuardando(true)
    const { error } = await supabase.from('pagos_socios').insert({
      viaje_id: viajeId, socio_id: f.socio_id, monto, fecha: form.fecha || hoyISO(), periodo: (form.fecha || hoyISO()).slice(0, 8) + '01', notas: form.notas.trim() || null,
    })
    setGuardando(false)
    if (error) { setError(mensajeError(error)); return }
    setAbierto(false)
    onCambio()
  }

  async function quitar(id) {
    const { error } = await supabase.from('pagos_socios').delete().eq('id', id)
    if (error) setError(mensajeError(error)); else onCambio()
  }

  const Fila = ({ texto, valor, fuerte }) => (
    <div className={`flex justify-between gap-3 ${fuerte ? 'border-t border-niebla pt-2 font-medium' : ''}`}>
      <span className={fuerte ? '' : 'text-piedra'}>{texto}</span><span>{valor}</span>
    </div>
  )

  return (
    <Tarjeta>
      <div className="mb-3 flex items-center gap-3">
        <span className={`flex size-11 items-center justify-center rounded-full font-medium ${f.participa ? 'bg-pasto' : 'bg-arena'}`}>{f.nombre.charAt(0).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-medium">{f.nombre}</p>
          <p className="text-sm text-piedra">{f.participa ? `Participa · ${f.num_participantes === 2 ? 'mitad' : `1/${f.num_participantes}`} de la ganancia` : 'No participa en este viaje'}</p>
        </div>
      </div>

      <div className="space-y-1.5 text-sm">
        {f.participa && <Fila texto="Su parte de la ganancia" valor={dinero(f.parte_ganancia)} />}
        {Number(f.gastos_pagados) > 0 && <Fila texto="Gastos que pagó él/ella" valor={`+ ${dinero(f.gastos_pagados)}`} />}
        {Number(f.tarjeta) > 0 && <Fila texto="Compras con su tarjeta" valor={`+ ${dinero(f.tarjeta)}`} />}
        <Fila texto="Le corresponde" valor={dinero(f.corresponde)} fuerte />
        {Number(f.pagado) > 0 && <Fila texto="Ya recibió" valor={`− ${dinero(f.pagado)}`} />}
      </div>

      <div className={`mt-4 rounded-campo px-4 py-3 ${pendiente > 0.004 ? 'bg-sol-tinte' : 'bg-pasto-tinte'}`}>
        <p className="text-sm">{pendiente > 0.004 ? 'Falta pagarle' : pendiente < -0.004 ? 'Recibió de más' : 'Está al día'}</p>
        <p className="text-3xl font-medium tracking-tight">{dinero(Math.abs(pendiente))}</p>
      </div>

      {pagos.length > 0 && (
        <ul className="mt-3 divide-y divide-niebla/70 text-sm">
          {pagos.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2">
              <span>{fechaCorta(p.fecha)} · {dinero(p.monto)}{p.notas ? ` · ${p.notas}` : ''}</span>
              {puedeRepartir && <button onClick={() => quitar(p.id)} className="min-h-10 px-2 text-piedra underline decoration-niebla underline-offset-4">Quitar</button>}
            </li>
          ))}
        </ul>
      )}

      {puedeRepartir && !abierto && (
        <Boton variante="secundario" className="mt-3 w-full" onClick={() => { setForm({ monto: pendiente > 0 ? pendiente.toFixed(2) : '', fecha: hoyISO(), notas: '' }); setError(''); setAbierto(true) }}>
          Registrar pago a {primerNombre(f.nombre)}
        </Boton>
      )}
      {abierto && (
        <form onSubmit={guardar} className="mt-3 space-y-3 rounded-campo bg-crema p-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Monto (USD)" name={`pago-${f.socio_id}`} inputMode="decimal" value={form.monto} onChange={(e) => setForm((x) => ({ ...x, monto: e.target.value }))} autoFocus />
            <Campo etiqueta="Fecha" name={`fecha-pago-${f.socio_id}`} type="date" value={form.fecha} onChange={(e) => setForm((x) => ({ ...x, fecha: e.target.value }))} />
          </div>
          <Campo etiqueta="Nota (opcional)" name={`nota-pago-${f.socio_id}`} placeholder="Transferencia Pichincha" value={form.notas} onChange={(e) => setForm((x) => ({ ...x, notas: e.target.value }))} />
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

function EditarParticipantes({ viajeId, filas, perfiles, onCambio }) {
  const actuales = filas.filter((f) => f.participa).map((f) => f.socio_id)
  const [abierto, setAbierto] = useState(false)
  const [elegidos, setElegidos] = useState(actuales)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const candidatos = perfiles.filter((p) => p.activo || actuales.includes(p.id))

  async function guardar() {
    if (elegidos.length === 0) { setError('Elige al menos un socio.'); return }
    setGuardando(true)
    setError('')
    const agregar = elegidos.filter((id) => !actuales.includes(id)).map((socio_id) => ({ viaje_id: viajeId, socio_id }))
    const quitar = actuales.filter((id) => !elegidos.includes(id))
    const r1 = agregar.length ? await supabase.from('participantes_viaje').insert(agregar) : {}
    const r2 = quitar.length ? await supabase.from('participantes_viaje').delete().eq('viaje_id', viajeId).in('socio_id', quitar) : {}
    setGuardando(false)
    if (r1.error || r2.error) { setError(mensajeError(r1.error || r2.error)); return }
    setAbierto(false)
    onCambio()
  }

  if (!abierto) {
    return (
      <button onClick={() => { setElegidos(actuales); setError(''); setAbierto(true) }} className="block w-full py-2 text-center text-sm text-piedra underline decoration-niebla underline-offset-4">
        Cambiar quién participa en este viaje
      </button>
    )
  }
  return (
    <Tarjeta className="space-y-3">
      <h3 className="font-medium">¿Quién participa en este viaje?</h3>
      <SelectorSocios perfiles={candidatos} elegidos={elegidos} onCambio={setElegidos} />
      <p className="text-sm text-piedra">{elegidos.length > 0 ? `Cada uno recibe ${elegidos.length === 1 ? 'toda' : elegidos.length === 2 ? 'la mitad de' : `1/${elegidos.length} de`} la ganancia.` : ''}</p>
      <Aviso>{error}</Aviso>
      <div className="grid grid-cols-2 gap-2">
        <Boton variante="secundario" onClick={() => setAbierto(false)}>Cancelar</Boton>
        <Boton onClick={guardar} cargando={guardando}>Guardar</Boton>
      </div>
    </Tarjeta>
  )
}
