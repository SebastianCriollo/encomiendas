const usd = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' })
export const dinero = (n) => usd.format(Number(n) || 0)

// Traduce los errores más comunes de Supabase a mensajes claros
export function mensajeError(error) {
  const m = (error?.message || String(error || '')).toLowerCase()
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'Tu correo aún no está confirmado.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sin conexión. Revisa tu internet e intenta de nuevo.'
  if (m.includes('should be different')) return 'La nueva contraseña debe ser distinta a la actual.'
  if (m.includes('password should be at least')) return 'La contraseña debe tener al menos 8 caracteres.'
  if (m.includes('administrador activo')) return 'Debe quedar al menos un administrador activo.'
  if (m.includes('foreign key') && m.includes('encomiendas')) return 'No se puede borrar: tiene encomiendas registradas.'
  if (m.includes('row-level security') || m.includes('permission denied')) return 'No tienes permiso para hacer esto.'
  return error?.message || 'Algo salió mal. Intenta de nuevo.'
}

// Genera una contraseña temporal fácil de dictar por WhatsApp (sin 0/O, 1/l)
export function claveTemporal() {
  const letras = 'abcdefghjkmnpqrstuvwxyz'
  const nums = '23456789'
  const r = (s) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length]
  let p = ''
  for (let i = 0; i < 6; i++) p += r(letras)
  return p.charAt(0).toUpperCase() + p.slice(1) + r(nums) + r(nums)
}

export function fechaCorta(f) {
  if (!f) return ''
  // las fechas "date" llegan como "2026-10-21": se arman en hora local para no correr un día
  const d = typeof f === 'string' && f.length === 10 ? new Date(f + 'T12:00:00') : new Date(f)
  return d.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function numeroEncomienda(n) {
  return '#' + String(n ?? '').padStart(4, '0')
}

// Quita tildes y mayúsculas para buscar "maria" y encontrar "María"
export function normalizar(t) {
  return (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}
