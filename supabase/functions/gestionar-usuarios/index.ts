// Edge Function: gestionar-usuarios
// Permite que SOLO el admin cree socios y restablezca contraseñas.
// La clave secreta (service_role) vive aquí, en el servidor de Supabase,
// nunca en la app del navegador.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const responder = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // 1. ¿Quién llama? Se valida con su propio token.
  const authHeader = req.headers.get('Authorization') ?? ''
  const comoUsuario = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: { user } } = await comoUsuario.auth.getUser()
  if (!user) return responder({ error: 'Sesión no válida' }, 401)

  // 2. ¿Es admin activo?
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: perfil } = await admin.from('perfiles').select('rol, activo').eq('id', user.id).single()
  if (!perfil || perfil.rol !== 'admin' || !perfil.activo) {
    return responder({ error: 'Solo el administrador puede hacer esto' }, 403)
  }

  let body: Record<string, string>
  try { body = await req.json() } catch { return responder({ error: 'Datos inválidos' }, 400) }

  // 3. Acciones
  if (body.accion === 'crear') {
    const email = (body.email ?? '').trim().toLowerCase()
    const nombre = (body.nombre ?? '').trim()
    const password = body.password ?? ''
    if (!email || !nombre) return responder({ error: 'Nombre y correo son obligatorios' }, 400)
    if (password.length < 8) return responder({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400)

    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { nombre },
    })
    if (error) {
      const yaExiste = /already|registered|exists/i.test(error.message)
      return responder({ error: yaExiste ? 'Ya existe un usuario con ese correo' : error.message }, 400)
    }
    return responder({ ok: true, id: data.user?.id })
  }

  if (body.accion === 'restablecer_clave') {
    if (!body.id) return responder({ error: 'Falta el usuario' }, 400)
    if ((body.password ?? '').length < 8) return responder({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400)
    const { error } = await admin.auth.admin.updateUserById(body.id, { password: body.password })
    if (error) return responder({ error: error.message }, 400)
    return responder({ ok: true })
  }

  return responder({ error: 'Acción desconocida' }, 400)
})
