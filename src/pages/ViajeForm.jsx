import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { cargarPerfiles } from '../lib/datos'
import SelectorSocios from '../components/SelectorSocios'
import { mensajeError } from '../lib/formato'
import { Aviso, AreaTexto, Boton, Campo, Cargando, Encabezado, Tarjeta } from '../components/ui'

function nombreSugerido() {
  const d = new Date()
  const mes = d.toLocaleDateString('es-EC', { month: 'long' })
  return mes.charAt(0).toUpperCase() + mes.slice(1) + ' ' + d.getFullYear()
}

export default function ViajeForm() {
  const { id } = useParams()
  const editando = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState(editando ? null : { nombre: nombreSugerido(), fecha_limite_pedidos: '', fecha_entrega: '', notas: '', cerrado: false })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const { puedeRepartir } = useAuth()
  const [perfiles, setPerfiles] = useState([])
  const [participantes, setParticipantes] = useState(null) // ids
  const [participantesOriginales, setParticipantesOriginales] = useState([])

  useEffect(() => {
    cargarPerfiles().then((ps) => {
      setPerfiles(ps)
      if (!editando) setParticipantes(ps.filter((p) => p.activo).map((p) => p.id))
    })
    if (editando) {
      supabase.from('participantes_viaje').select('socio_id').eq('viaje_id', id).then(({ data }) => {
        const ids = (data || []).map((x) => x.socio_id)
        setParticipantes(ids); setParticipantesOriginales(ids)
      })
    }
  }, [id, editando])

  useEffect(() => {
    if (!editando) return
    supabase.from('viajes').select('nombre, fecha_limite_pedidos, fecha_entrega, notas, cerrado').eq('id', id).single()
      .then(({ data, error }) => error ? setError(mensajeError(error)) : setForm({
        ...data, fecha_limite_pedidos: data.fecha_limite_pedidos || '', fecha_entrega: data.fecha_entrega || '', notas: data.notas || '',
      }))
  }, [id, editando])

  if (!form) return error ? <Aviso>{error}</Aviso> : <Cargando />
  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  async function guardar(e) {
    e.preventDefault()
    setError('')
    if (!form.nombre.trim()) { setError('Ponle un nombre al viaje.'); return }
    if (puedeRepartir && participantes && participantes.length === 0) { setError('Elige al menos un socio que participe.'); return }
    if (form.fecha_limite_pedidos && form.fecha_entrega && form.fecha_entrega < form.fecha_limite_pedidos) {
      setError('La entrega no puede ser antes del cierre de pedidos.'); return
    }
    setGuardando(true)
    const datos = {
      nombre: form.nombre.trim(),
      fecha_limite_pedidos: form.fecha_limite_pedidos || null,
      fecha_entrega: form.fecha_entrega || null,
      notas: form.notas.trim() || null,
      cerrado: form.cerrado,
    }
    const q = editando
      ? supabase.from('viajes').update(datos).eq('id', id).select('id').single()
      : supabase.from('viajes').insert(datos).select('id').single()
    const { data, error } = await q
    if (error) { setGuardando(false); setError(mensajeError(error)); return }

    // Sincroniza los socios que participan (al crear, la base agrega a todos los activos)
    if (puedeRepartir && participantes) {
      const antes = editando ? participantesOriginales : perfiles.filter((p) => p.activo).map((p) => p.id)
      const agregar = participantes.filter((x) => !antes.includes(x)).map((socio_id) => ({ viaje_id: data.id, socio_id }))
      const quitar = antes.filter((x) => !participantes.includes(x))
      const r1 = agregar.length ? await supabase.from('participantes_viaje').insert(agregar) : {}
      const r2 = quitar.length ? await supabase.from('participantes_viaje').delete().eq('viaje_id', data.id).in('socio_id', quitar) : {}
      if (r1.error || r2.error) { setGuardando(false); setError(mensajeError(r1.error || r2.error)); return }
    }
    setGuardando(false)
    navigate(`/viajes/${data.id}`, { replace: true })
  }

  return (
    <div className="space-y-4">
      <Encabezado titulo={editando ? 'Editar viaje' : 'Nuevo viaje'} volverA={editando ? `/viajes/${id}` : '/viaje'} />
      <Tarjeta>
        <form onSubmit={guardar} className="space-y-4" noValidate>
          <Campo etiqueta="Nombre" name="nombre" value={form.nombre} onChange={cambiar} placeholder="Diciembre 2026" />
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Pedidos hasta" name="fecha_limite_pedidos" type="date" value={form.fecha_limite_pedidos} onChange={cambiar} />
            <Campo etiqueta="Entrega en Quito" name="fecha_entrega" type="date" value={form.fecha_entrega} onChange={cambiar} />
          </div>
          {puedeRepartir && participantes && (
            <div>
              <p className="mb-1.5 text-sm font-medium">¿Qué socios participan?</p>
              <SelectorSocios perfiles={perfiles.filter((p) => p.activo || participantes.includes(p.id))} elegidos={participantes} onCambio={setParticipantes} />
              <p className="mt-1.5 text-sm text-piedra">La ganancia se reparte en partes iguales entre ellos.</p>
            </div>
          )}
          <AreaTexto etiqueta="Notas" name="notas" value={form.notas} onChange={cambiar} placeholder="Vuelo, hotel, quién viaja…" />
          {editando && (
            <label className="flex min-h-12 items-center gap-3 rounded-campo bg-crema px-4">
              <input type="checkbox" checked={form.cerrado} onChange={(e) => setForm((f) => ({ ...f, cerrado: e.target.checked }))} className="size-5 accent-tinta" />
              <span>
                <span className="block font-medium">Viaje cerrado</span>
                <span className="block text-sm text-piedra">Ya se entregó y cobró todo. Deja de ser el viaje actual.</span>
              </span>
            </label>
          )}
          <Aviso>{error}</Aviso>
          <Boton type="submit" cargando={guardando} className="w-full">{editando ? 'Guardar cambios' : 'Crear viaje'}</Boton>
        </form>
      </Tarjeta>
    </div>
  )
}
