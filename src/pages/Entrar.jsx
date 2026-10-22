import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Aviso, Boton, Campo, Tarjeta } from '../components/ui'
import { mensajeError } from '../lib/formato'

export default function Entrar() {
  const { session, entrar } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (session) return <Navigate to={location.state?.desde || '/'} replace />

  async function enviar(e) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) { setError('Escribe tu correo y tu contraseña.'); return }
    setEnviando(true)
    const { error } = await entrar(email.trim(), password)
    setEnviando(false)
    if (error) setError(mensajeError(error))
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <img src="/logo.png" alt="Encomiendas Sandra" className="mb-6 h-32 w-auto self-start rounded-tarjeta bg-blanco p-2" onError={(e) => { e.currentTarget.src = '/icono.svg'; e.currentTarget.className = 'mb-6 size-14' }} />
      <h1 className="mb-2 text-[3rem] font-medium leading-[0.95] tracking-[-0.05em]">
        Tus encomiendas,
        <br />
        en orden.
      </h1>
      <p className="mb-8 text-lg text-piedra">Entra con el correo que te dio el administrador.</p>

      <Tarjeta className="space-y-4">
        <form onSubmit={enviar} className="space-y-4" noValidate>
          <Campo
            etiqueta="Correo"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="nombre@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div>
            <Campo
              etiqueta="Contraseña"
              name="password"
              type={verClave ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setVerClave((v) => !v)}
              className="mt-2 text-sm text-piedra underline decoration-niebla underline-offset-4"
            >
              {verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            </button>
          </div>
          <Aviso>{error}</Aviso>
          <Boton type="submit" cargando={enviando} className="w-full">Entrar</Boton>
        </form>
      </Tarjeta>
      <p className="mt-6 text-center text-sm text-piedra">
        ¿Olvidaste tu contraseña? Pídele al administrador que te asigne una nueva.
      </p>
    </main>
  )
}
