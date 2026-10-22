import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Aviso, Boton, Campo, Chip, Tarjeta, Cargando, Encabezado } from '../components/ui'
import { claveTemporal, mensajeError } from '../lib/formato'

async function llamarFuncion(body) {
  const { data, error } = await supabase.functions.invoke('gestionar-usuarios', { body })
  if (error) {
    // La función responde { error: "..." } con el motivo
    let motivo = error.message
    try { motivo = (await error.context.json()).error || motivo } catch { /* sin cuerpo */ }
    if (/failed to send|not found|fetch/i.test(motivo)) {
      motivo = 'No se pudo contactar la función "gestionar-usuarios". ¿Ya la creaste en Supabase?'
    }
    throw new Error(motivo)
  }
  return data
}

export default function Socios() {
  const { esAdmin, user, recargarPerfil } = useAuth()
  const [perfiles, setPerfiles] = useState(null)
  const [mensaje, setMensaje] = useState({ tipo: 'ok', texto: '' })

  async function cargar() {
    const { data, error } = await supabase.from('perfiles').select('*').order('creado_en')
    if (error) { setMensaje({ tipo: 'error', texto: mensajeError(error) }); return }
    setPerfiles(data)
  }
  useEffect(() => { cargar() }, [])

  if (!esAdmin) return <Navigate to="/" replace />
  if (!perfiles) return <Cargando />

  async function cambiarPermiso(p) {
    const { error } = await supabase.from('perfiles').update({ puede_gestionar_reparto: !p.puede_gestionar_reparto }).eq('id', p.id)
    if (error) setMensaje({ tipo: 'error', texto: mensajeError(error) })
    else {
      setMensaje({ tipo: 'ok', texto: p.puede_gestionar_reparto ? `${p.nombre} ya no maneja el reparto.` : `${p.nombre} ahora puede registrar pagos a socios y elegir quién va en cada viaje.` })
      cargar()
    }
  }

  async function cambiarActivo(p) {
    const { error } = await supabase.from('perfiles').update({ activo: !p.activo }).eq('id', p.id)
    if (error) setMensaje({ tipo: 'error', texto: mensajeError(error) })
    else { setMensaje({ tipo: 'ok', texto: p.activo ? `${p.nombre} ya no tiene acceso.` : `${p.nombre} tiene acceso de nuevo.` }); cargar() }
    if (p.id === user.id) recargarPerfil()
  }

  return (
    <div className="space-y-4">
      <Encabezado titulo="Socios" subtitulo="Quién entra a la app y qué puede hacer." volverA="/mas" />

      <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>

      <Tarjeta className="space-y-1">
        <h2 className="mb-1 text-lg font-medium">Personas con acceso</h2>
        <p className="mb-2 text-sm text-piedra">La ganancia de cada viaje se reparte en partes iguales entre los socios que participan. Se eligen al crear o editar el viaje.</p>
        {perfiles.map((p) => (
          <FilaSocio
            key={p.id}
            p={p}
            esYo={p.id === user.id}
            onActivo={() => cambiarActivo(p)}
            onPermiso={() => cambiarPermiso(p)}
            onMensaje={setMensaje}
          />
        ))}
      </Tarjeta>

      <NuevoSocio onCreado={(texto) => { setMensaje({ tipo: 'ok', texto }); cargar() }} />
    </div>
  )
}

function FilaSocio({ p, esYo, onActivo, onPermiso, onMensaje }) {
  const [abierto, setAbierto] = useState(false)
  const [clave, setClave] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function restablecer() {
    if (clave.length < 8) { onMensaje({ tipo: 'error', texto: 'La contraseña debe tener al menos 8 caracteres.' }); return }
    setEnviando(true)
    try {
      await llamarFuncion({ accion: 'restablecer_clave', id: p.id, password: clave })
      onMensaje({ tipo: 'ok', texto: `Nueva contraseña de ${p.nombre}: ${clave} — envíasela por WhatsApp.` })
      setAbierto(false)
    } catch (e) {
      onMensaje({ tipo: 'error', texto: e.message })
    }
    setEnviando(false)
  }

  return (
    <div className={`border-t border-niebla py-4 first-of-type:border-t-0 ${p.activo ? '' : 'opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{p.nombre}{esYo && <span className="font-normal text-piedra"> (tú)</span>}</p>
          <p className="truncate text-sm text-piedra">{p.email}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip color={p.rol === 'admin' ? 'pasto' : 'cielo'}>{p.rol === 'admin' ? 'Admin' : 'Socio'}</Chip>
            {p.rol !== 'admin' && p.puede_gestionar_reparto && <Chip color="sol">Maneja el reparto</Chip>}
            {!p.activo && <Chip color="coral">Sin acceso</Chip>}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <button className="underline decoration-niebla underline-offset-4" onClick={() => { setAbierto((v) => !v); setClave(claveTemporal()) }}>
          {abierto ? 'Cancelar' : 'Nueva contraseña'}
        </button>
        {p.rol !== 'admin' && p.activo && (
          <button className="underline decoration-niebla underline-offset-4" onClick={onPermiso}>
            {p.puede_gestionar_reparto ? 'Quitar permiso de reparto' : 'Dar permiso de reparto'}
          </button>
        )}
        {!esYo && (
          <button className="underline decoration-niebla underline-offset-4" onClick={onActivo}>
            {p.activo ? 'Quitar acceso' : 'Devolver acceso'}
          </button>
        )}
      </div>

      {abierto && (
        <div className="mt-3 space-y-3 rounded-campo bg-crema p-4">
          <Campo etiqueta="Contraseña nueva" name={`clave-${p.id}`} value={clave} onChange={(e) => setClave(e.target.value)} ayuda="Se la envías a la persona; luego ella puede cambiarla en Cuenta." />
          <Boton variante="secundario" onClick={restablecer} cargando={enviando} className="w-full">Asignar contraseña</Boton>
        </div>
      )}
    </div>
  )
}

function NuevoSocio({ onCreado }) {
  const [form, setForm] = useState({ nombre: '', email: '', password: claveTemporal() })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  async function crear(e) {
    e.preventDefault()
    setError('')
    if (!form.nombre.trim() || !form.email.trim()) { setError('Escribe el nombre y el correo.'); return }
    if (form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    setEnviando(true)
    try {
      await llamarFuncion({ accion: 'crear', ...form })
      onCreado(`${form.nombre} ya puede entrar con ${form.email} y la contraseña ${form.password}. Envíaselo por WhatsApp.`)
      setForm({ nombre: '', email: '', password: claveTemporal() })
    } catch (err) {
      setError(err.message)
    }
    setEnviando(false)
  }

  return (
    <Tarjeta>
      <h2 className="mb-1 text-lg font-medium">Agregar socio</h2>
      <p className="mb-4 text-sm text-piedra">Tendrá su propio usuario. Luego lo eliges como participante en los viajes donde vaya.</p>
      <form onSubmit={crear} className="space-y-4" noValidate>
        <Campo etiqueta="Nombre" name="nombre" autoComplete="off" placeholder="Ana Vega" value={form.nombre} onChange={cambiar} />
        <Campo etiqueta="Correo" name="email" type="email" inputMode="email" autoComplete="off" placeholder="ana@correo.com" value={form.email} onChange={cambiar} />
        <Campo etiqueta="Contraseña temporal" name="password" autoComplete="off" value={form.password} onChange={cambiar} ayuda="Generada al azar. Puedes cambiarla." />
        <Aviso>{error}</Aviso>
        <Boton type="submit" cargando={enviando} className="w-full">Crear socio</Boton>
      </form>
    </Tarjeta>
  )
}
