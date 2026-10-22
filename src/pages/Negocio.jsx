import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { mensajeError } from '../lib/formato'
import { Aviso, AreaTexto, Boton, Campo, Cargando, Encabezado, Tarjeta } from '../components/ui'

// Datos que aparecen en el recibo PDF y en los mensajes de WhatsApp
export default function Negocio() {
  const { esAdmin } = useAuth()
  const [form, setForm] = useState(null)
  const [mensaje, setMensaje] = useState({ tipo: 'ok', texto: '' })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase.from('configuracion').select('*').eq('id', 1).maybeSingle().then(({ data, error }) => {
      if (error) setMensaje({ tipo: 'error', texto: mensajeError(error) })
      else setForm({ nombre_negocio: data?.nombre_negocio || '', telefono: data?.telefono || '', mensaje_recibo: data?.mensaje_recibo || '' })
    })
  }, [])

  if (!esAdmin) return <Navigate to="/mas" replace />
  if (!form) return mensaje.texto ? <Aviso>{mensaje.texto}</Aviso> : <Cargando />
  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  async function guardar(e) {
    e.preventDefault()
    if (!form.nombre_negocio.trim()) { setMensaje({ tipo: 'error', texto: 'Escribe el nombre del negocio.' }); return }
    setGuardando(true)
    const { error } = await supabase.from('configuracion').update({
      nombre_negocio: form.nombre_negocio.trim(), telefono: form.telefono.trim() || null, mensaje_recibo: form.mensaje_recibo.trim() || null,
    }).eq('id', 1)
    setGuardando(false)
    setMensaje(error ? { tipo: 'error', texto: mensajeError(error) } : { tipo: 'ok', texto: 'Datos guardados. Los próximos recibos ya salen así.' })
  }

  return (
    <div className="space-y-4">
      <Encabezado titulo="Datos del negocio" subtitulo="Aparecen en el recibo PDF y en los mensajes de WhatsApp." volverA="/mas" />
      <Tarjeta>
        <form onSubmit={guardar} className="space-y-4" noValidate>
          <Campo etiqueta="Nombre del negocio" name="nombre_negocio" placeholder="Encargos desde New York" value={form.nombre_negocio} onChange={cambiar} />
          <Campo etiqueta="WhatsApp del negocio" name="telefono" type="tel" inputMode="tel" placeholder="0991234567" value={form.telefono} onChange={cambiar} />
          <AreaTexto etiqueta="Mensaje al pie del recibo" name="mensaje_recibo" placeholder="Gracias por tu compra. Próximo viaje: recepción de pedidos hasta el 7 de diciembre." value={form.mensaje_recibo} onChange={cambiar} />
          <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>
          <Boton type="submit" cargando={guardando} className="w-full">Guardar</Boton>
        </form>
      </Tarjeta>
    </div>
  )
}
