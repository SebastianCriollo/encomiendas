// Carga /logo.png (si existe en la carpeta public) para usarlo en recibos y reportes.
let promesa = null

export function cargarLogo() {
  if (!promesa) {
    promesa = (async () => {
      try {
        const r = await fetch('/logo.png', { cache: 'force-cache' })
        if (!r.ok || !(r.headers.get('content-type') || '').startsWith('image')) return null
        const blob = await r.blob()
        const dataUrl = await new Promise((ok, mal) => {
          const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = mal; fr.readAsDataURL(blob)
        })
        const { ancho, alto } = await new Promise((ok) => {
          const img = new Image(); img.onload = () => ok({ ancho: img.naturalWidth, alto: img.naturalHeight }); img.onerror = () => ok({ ancho: 1, alto: 1 }); img.src = dataUrl
        })
        return { dataUrl, ancho, alto, base64: dataUrl.split(',')[1] }
      } catch {
        return null
      }
    })()
  }
  return promesa
}

// Tamaño que cabe en una caja (mm) manteniendo la proporción
export function encajar(logo, maxAncho, maxAlto) {
  const k = Math.min(maxAncho / logo.ancho, maxAlto / logo.alto)
  return { w: logo.ancho * k, h: logo.alto * k }
}
