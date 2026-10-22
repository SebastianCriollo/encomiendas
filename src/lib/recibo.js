// Genera el recibo PDF de una factura para enviarlo al cliente.
// Solo incluye lo que el cliente debe ver: nada de ganancias ni de quién puso la tarjeta.
import { dinero, fechaCorta, numeroEncomienda } from './formato'
import { cargarLogo, encajar } from './logo'

const TINTA = [44, 46, 42]
const PIEDRA = [107, 109, 106]
const PASTO = [142, 212, 98]
const CREMA = [245, 241, 228]
const NIEBLA = [213, 213, 212]

const ANCHO = 110 // mm: angosto para leerse bien en el celular
const M = 9 // margen

// jsPDF con fuentes estándar solo entiende Latin-1: se limpian caracteres fuera de ese rango
const limpio = (t) => String(t ?? '').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—−]/g, '-').replace(/…/g, '...').replace(/[^\x00-\xFF]/g, '')

function cantidadTexto(i) {
  const c = Number(i.cantidad).toLocaleString('es-EC', { maximumFractionDigits: 2 })
  return i.modo === 'por_lb' ? `${c} lb x ${dinero(i.precio_unitario)}` : `${c} x ${dinero(i.precio_unitario)}`
}

async function crearPdf({ factura, items, compras, abonos, negocio }) {
  const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), cargarLogo()]) // se carga solo cuando se pide un recibo

  // Medición previa para saber el alto de la página
  const medir = new jsPDF({ unit: 'mm', format: [ANCHO, 300] })
  medir.setFontSize(10)
  const anchoDesc = ANCHO - 2 * M - 28
  const lineas = [
    ...items.map((i) => ({ desc: medir.splitTextToSize(limpio(i.descripcion), anchoDesc), sub: cantidadTexto(i), monto: i.subtotal })),
    ...compras.map((c) => ({ desc: medir.splitTextToSize(limpio(c.descripcion), anchoDesc), sub: 'Compra con tarjeta (valor exacto)', monto: c.monto })),
  ]
  const mensaje = limpio(negocio?.mensaje_recibo || 'Gracias por tu compra.')
  const mensajeLineas = medir.splitTextToSize(mensaje, ANCHO - 2 * M)
  const alto = 102 + lineas.reduce((s, l) => s + l.desc.length * 4.6 + 6.5, 0) + (abonos.length ? 10 + abonos.length * 5.5 : 0) + mensajeLineas.length * 4.5 + 22

  const doc = new jsPDF({ unit: 'mm', format: [ANCHO, Math.max(alto, 150)] })
  const altoPag = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica', 'normal')
  const color = (c) => doc.setTextColor(...c)

  // Fondo crema y encabezado tinta
  doc.setFillColor(...CREMA); doc.rect(0, 0, ANCHO, altoPag, 'F')
  const altoCab = logo ? 36 : 30
  doc.setFillColor(...TINTA); doc.rect(0, 0, ANCHO, altoCab, 'F')
  let xNombre = M
  if (logo) {
    const { w, h } = encajar(logo, 26, 26)
    doc.setFillColor(255, 255, 255); doc.roundedRect(M, 4, w + 4, h + 4, 2, 2, 'F')
    doc.addImage(logo.dataUrl, 'PNG', M + 2, 6, w, h)
    xNombre = M + w + 8
  } else {
    doc.setFillColor(...PASTO); doc.circle(ANCHO - M - 4, 15, 4, 'F')
  }
  color([255, 255, 255]); doc.setFontSize(logo ? 13 : 15); doc.setFont('helvetica', 'bold')
  doc.text(limpio(negocio?.nombre_negocio || 'Encargos desde EE.UU.'), xNombre, logo ? 16 : 14, { maxWidth: ANCHO - xNombre - M })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); color([220, 220, 215])
  doc.text(limpio(negocio?.telefono ? `WhatsApp ${negocio.telefono}` : 'Encargos EE.UU. - Ecuador'), xNombre, logo ? 23 : 21)

  // Datos del recibo
  let y = altoCab + 12
  color(PIEDRA); doc.setFontSize(9)
  doc.text('RECIBO', M, y)
  doc.text(limpio(fechaCorta(new Date().toISOString())), ANCHO - M, y, { align: 'right' })
  y += 7
  color(TINTA); doc.setFontSize(18); doc.setFont('helvetica', 'bold')
  doc.text(numeroEncomienda(factura.numero), M, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); color(PIEDRA)
  doc.text(limpio(factura.viaje_nombre), ANCHO - M, y, { align: 'right' })

  // Cliente
  y += 9
  doc.setFillColor(255, 255, 255); doc.roundedRect(M, y, ANCHO - 2 * M, 15, 3, 3, 'F')
  color(PIEDRA); doc.setFontSize(8); doc.text('CLIENTE', M + 4, y + 5.5)
  color(TINTA); doc.setFontSize(11); doc.setFont('helvetica', 'bold')
  doc.text(limpio(factura.cliente_nombre), M + 4, y + 11, { maxWidth: ANCHO - 2 * M - 8 })
  doc.setFont('helvetica', 'normal')
  if (factura.cliente_telefono) { doc.setFontSize(9); color(PIEDRA); doc.text(limpio(factura.cliente_telefono), ANCHO - M - 4, y + 11, { align: 'right' }) }

  // Detalle
  y += 23
  color(PIEDRA); doc.setFontSize(8); doc.text('DETALLE', M, y)
  y += 5
  for (const l of lineas) {
    color(TINTA); doc.setFontSize(10)
    doc.text(l.desc, M, y)
    doc.text(dinero(l.monto), ANCHO - M, y, { align: 'right' })
    y += (l.desc.length - 1) * 4.6 + 4.4
    color(PIEDRA); doc.setFontSize(8.5); doc.text(limpio(l.sub), M, y)
    y += 2.2
    doc.setDrawColor(...NIEBLA); doc.setLineWidth(0.2); doc.line(M, y, ANCHO - M, y)
    y += 4.5
  }

  // Totales
  y += 2
  color(TINTA); doc.setFontSize(11); doc.text('Total', M, y)
  doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.text(dinero(factura.total), ANCHO - M, y + 0.5, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  y += 7
  if (Number(factura.abonado) > 0) {
    color(PIEDRA); doc.setFontSize(9.5); doc.text('Abonado', M, y); doc.text(`- ${dinero(factura.abonado)}`, ANCHO - M, y, { align: 'right' })
    y += 6
  }
  const saldo = Number(factura.saldo)
  if (saldo > 0.004) {
    doc.setFillColor(251, 245, 190); doc.roundedRect(M, y, ANCHO - 2 * M, 13, 3, 3, 'F')
    color(TINTA); doc.setFontSize(10); doc.text('Por pagar', M + 4, y + 8.3)
    doc.setFontSize(15); doc.setFont('helvetica', 'bold'); doc.text(dinero(saldo), ANCHO - M - 4, y + 8.8, { align: 'right' })
  } else {
    doc.setFillColor(...PASTO); doc.roundedRect(M, y, ANCHO - 2 * M, 13, 3, 3, 'F')
    color(TINTA); doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('PAGADO - Gracias', ANCHO / 2, y + 8.5, { align: 'center' })
  }
  doc.setFont('helvetica', 'normal')
  y += 19

  // Abonos
  if (abonos.length) {
    color(PIEDRA); doc.setFontSize(8); doc.text('PAGOS RECIBIDOS', M, y)
    y += 5
    doc.setFontSize(9)
    for (const a of abonos) {
      color(PIEDRA); doc.text(`${limpio(fechaCorta(a.fecha))} - ${a.metodo === 'transferencia' ? 'Transferencia' : 'Efectivo'}`, M, y)
      color(TINTA); doc.text(dinero(a.monto), ANCHO - M, y, { align: 'right' })
      y += 5.5
    }
    y += 3
  }

  // Pie
  color(PIEDRA); doc.setFontSize(9)
  doc.text(mensajeLineas, M, y)
  return doc
}

const nombreArchivo = (f) => `Recibo-${numeroEncomienda(f.numero).slice(1)}-${limpio(f.cliente_nombre).replace(/[^\w]+/g, '-')}.pdf`

export async function descargarRecibo(datos) {
  const doc = await crearPdf(datos)
  doc.save(nombreArchivo(datos.factura))
}

// En el celular abre el menú de compartir (WhatsApp, etc.). Si no se puede, lo descarga.
export async function compartirRecibo(datos) {
  const doc = await crearPdf(datos)
  const nombre = nombreArchivo(datos.factura)
  const archivo = new File([doc.output('blob')], nombre, { type: 'application/pdf' })
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombre })
      return 'compartido'
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelado'
    }
  }
  doc.save(nombre)
  return 'descargado'
}
