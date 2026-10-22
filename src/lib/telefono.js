// Teléfonos de Ecuador: la gente escribe "0991234567", "099 123 4567" o "+593 99 123 4567".
// Guardamos lo que escriben y convertimos al formato internacional solo para WhatsApp.

export function soloDigitos(t) {
  return (t || '').replace(/\D/g, '')
}

export function internacional(t) {
  const d = soloDigitos(t)
  if (!d) return ''
  if (d.startsWith('593')) return d
  if (d.startsWith('0') && d.length === 10) return '593' + d.slice(1) // celular 09XXXXXXXX
  if (d.startsWith('0') && d.length === 9) return '593' + d.slice(1)  // fijo 02XXXXXXX
  if (d.length === 9 && d.startsWith('9')) return '593' + d           // sin el 0 inicial
  return d // número de otro país escrito con su código
}

export function whatsappUrl(t, mensaje = '') {
  const n = internacional(t)
  if (!n) return null
  return `https://wa.me/${n}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''}`
}

export function llamarUrl(t) {
  const n = internacional(t)
  return n ? `tel:+${n}` : null
}

// Validación suave: avisa si parece incompleto, pero no bloquea
export function telefonoSospechoso(t) {
  const d = soloDigitos(t)
  if (!d) return false
  return d.length < 9 || d.length > 13
}
