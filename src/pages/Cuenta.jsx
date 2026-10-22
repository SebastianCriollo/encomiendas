import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Aviso, Boton, Campo, Chip, Encabezado, Tarjeta } from '../components/ui'
import { mensajeError } from '../lib/formato'

export default function Cuenta() {
  const { perfil, user, esAdmin, salir } = useAuth()
  const [clave, setClave] = useState('')
  const [clave2, setClave2] = useState('')
  const [mensaje, setMensaje] = useState({ tipo: 'ok', texto: '' })
  const [enviando, setEnviando] = useState(false)

  async function cambiarClave(e) {
    e.preventDefault()
    setMensaje({ tipo: 'ok', texto: '' })
    if (clave.length < 8) { setMensaje({ tipo: 'error', texto: 'La contraseña debe tener al menos 8 caracteres.' }); return }
    if (clave !== clave2) { setMensaje({ tipo: 'error', texto: 'Las dos contraseñas no coinciden.' }); return }
    setEnviando(true)
    const { error } = await supabase.auth.updateUser({ password: clave })
    setEnviando(false)
    if (error) setMensaje({ tipo: 'error', texto: mensajeError(error) })
    else { setMensaje({ tipo: 'ok', texto: 'Contraseña actualizada.' }); setClave(''); setClave2('') }
  }

  return (
    <div className="space-y-4">
      <Encabezado titulo="Mi cuenta" volverA="/mas" />

      <Tarjeta>
        <p className="text-xl font-medium">{perfil?.nombre}</p>
        <p className="text-piedra">{user?.email}</p>
        <div className="mt-3 flex gap-1.5">
          <Chip color={esAdmin ? 'pasto' : 'cielo'}>{esAdmin ? 'Administrador' : 'Socio'}</Chip>
          {perfil?.puede_gestionar_reparto && !esAdmin && <Chip color="arena" punto={false}>Maneja el reparto</Chip>}
        </div>
      </Tarjeta>

      <Tarjeta>
        <h2 className="mb-4 text-lg font-medium">Cambiar contraseña</h2>
        <form onSubmit={cambiarClave} className="space-y-4" noValidate>
          <Campo etiqueta="Contraseña nueva" name="nueva" type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} ayuda="Mínimo 8 caracteres." />
          <Campo etiqueta="Repite la contraseña" name="repetir" type="password" autoComplete="new-password" value={clave2} onChange={(e) => setClave2(e.target.value)} />
          <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>
          <Boton type="submit" cargando={enviando} className="w-full">Guardar contraseña</Boton>
        </form>
      </Tarjeta>

      <Boton variante="secundario" onClick={salir} className="w-full">Cerrar sesión</Boton>
    </div>
  )
}
