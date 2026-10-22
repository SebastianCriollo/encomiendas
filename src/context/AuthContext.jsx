import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)

  const cargarPerfil = useCallback(async (userId) => {
    if (!userId) { setPerfil(null); return }
    const { data } = await supabase.from('perfiles').select('*').eq('id', userId).maybeSingle()
    setPerfil(data ?? null)
  }, [])

  useEffect(() => {
    let activo = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!activo) return
      setSession(data.session)
      await cargarPerfil(data.session?.user.id)
      if (activo) setCargando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, nueva) => {
      setSession(nueva)
      // diferido para no bloquear el callback de Supabase
      setTimeout(() => cargarPerfil(nueva?.user.id), 0)
    })
    return () => { activo = false; sub.subscription.unsubscribe() }
  }, [cargarPerfil])

  const valor = {
    session,
    user: session?.user ?? null,
    perfil,
    esAdmin: perfil?.rol === 'admin' && perfil?.activo,
    // Admin o socio con permiso para registrar pagos y elegir socios del viaje
    puedeRepartir: Boolean(perfil?.activo && (perfil?.rol === 'admin' || perfil?.puede_gestionar_reparto)),
    cargando,
    recargarPerfil: () => cargarPerfil(session?.user.id),
    entrar: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    salir: () => supabase.auth.signOut(),
  }
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
