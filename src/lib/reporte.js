// Reporte completo de un viaje: clientes y sus pedidos, gastos, ganancia y reparto.
// Se descarga como Excel (para revisar y sumar) o PDF (para guardar o enviar).
import { supabase } from './supabase'
import { dinero, fechaCorta, numeroEncomienda } from './formato'
import { CATEGORIAS_GASTO } from './estados'
import { cargarLogo, encajar } from './logo'

const num = (v) => Math.round(Number(v || 0) * 100) / 100
const nombreArchivo = (viaje, ext) => `Reporte-${viaje.nombre.replace(/[^\wÁÉÍÓÚÑáéíóúñ]+/g, '-')}.${ext}`

function detalleItem(i) {
  const c = Number(i.cantidad).toLocaleString('es-EC', { maximumFractionDigits: 2 })
  const cant = i.modo === 'por_lb' ? `${c} lb` : Number(i.cantidad) === 1 ? '' : `x${c}`
  return `${i.descripcion}${cant ? ' ' + cant : ''} (${dinero(i.subtotal)})`
}

export async function cargarDatosReporte(viajeId) {
  const [v, f, g, r, p, conf] = await Promise.all([
    supabase.from('v_viajes').select('*').eq('id', viajeId).single(),
    supabase.from('v_facturas').select('*').eq('viaje_id', viajeId).order('cliente_nombre'),
    supabase.from('gastos').select('*').eq('viaje_id', viajeId).order('fecha'),
    supabase.from('v_reparto').select('*').eq('viaje_id', viajeId),
    supabase.from('perfiles').select('id, nombre'),
    supabase.from('configuracion').select('*').maybeSingle(),
  ])
  const err = v.error || f.error || g.error || r.error
  if (err) throw err
  const ids = f.data.map((x) => x.id)
  const [it, co, ab] = ids.length
    ? await Promise.all([
        supabase.from('items_factura').select('*').in('factura_id', ids).order('orden'),
        supabase.from('compras_tarjeta').select('*').in('factura_id', ids).order('orden'),
        supabase.from('abonos').select('*').in('factura_id', ids).order('fecha'),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]
  const nombres = Object.fromEntries((p.data || []).map((x) => [x.id, x.nombre]))

  const facturas = f.data.map((fa) => {
    const items = it.data.filter((x) => x.factura_id === fa.id)
    const compras = co.data.filter((x) => x.factura_id === fa.id)
    return {
      ...fa,
      detalle: [
        ...items.map(detalleItem),
        ...compras.map((c) => `${c.descripcion} - compra con tarjeta de ${(nombres[c.tarjeta_de] || '').split(' ')[0]} (${dinero(c.monto)})`),
      ].join(', '),
      abonos: ab.data.filter((x) => x.factura_id === fa.id),
    }
  })
  return { viaje: v.data, facturas, gastos: g.data, reparto: r.data, nombres, negocio: conf.data, generado: new Date() }
}

// ----------------------------------------------------------------- EXCEL
export async function descargarExcel(datos) {
  const ExcelJS = (await import('exceljs')).default
  const { viaje, facturas, gastos, reparto, nombres, negocio } = datos
  const wb = new ExcelJS.Workbook()
  wb.creator = negocio?.nombre_negocio || 'Encomiendas'
  const USD = '"$"#,##0.00'
  const TINTA = 'FF2C2E2A', CREMA = 'FFF5F1E4', PASTO = 'FFE4F4D8', SOL = 'FFFBF5BE'
  const borde = { bottom: { style: 'thin', color: { argb: 'FFD5D5D4' } } }

  const encabezado = (ws, titulo, columnas) => {
    ws.mergeCells(1, 1, 1, columnas.length)
    ws.getCell(1, 1).value = `${negocio?.nombre_negocio || 'Encomiendas'} — ${titulo}`
    ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: TINTA } }
    ws.mergeCells(2, 1, 2, columnas.length)
    ws.getCell(2, 1).value = `Viaje ${viaje.nombre}${viaje.fecha_entrega ? ' · entrega ' + fechaCorta(viaje.fecha_entrega) : ''} · generado ${fechaCorta(datos.generado.toISOString())}`
    ws.getCell(2, 1).font = { size: 10, color: { argb: 'FF6B6D6A' } }
    ws.columns = columnas.map((c) => ({ key: c.key, width: c.width }))
    const h = ws.getRow(4)
    columnas.forEach((c, i) => {
      const cell = h.getCell(i + 1)
      cell.value = c.titulo
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINTA } }
      cell.alignment = { vertical: 'middle', horizontal: c.dinero ? 'right' : 'left' }
    })
    h.height = 22
    ws.views = [{ state: 'frozen', ySplit: 4 }]
  }

  // --- Hoja 1: Clientes
  const colsC = [
    { key: 'n', titulo: 'N°', width: 8 },
    { key: 'cliente', titulo: 'Cliente', width: 24 },
    { key: 'telefono', titulo: 'Teléfono', width: 14 },
    { key: 'detalle', titulo: 'Detalle de paquetes', width: 60 },
    { key: 'servicio', titulo: 'Cobro por traer', width: 15, dinero: true },
    { key: 'tarjeta', titulo: 'Compras con tarjeta', width: 17, dinero: true },
    { key: 'total', titulo: 'Total', width: 13, dinero: true },
    { key: 'abonado', titulo: 'Abonado', width: 13, dinero: true },
    { key: 'saldo', titulo: 'Total adeudado', width: 15, dinero: true },
    { key: 'entregado', titulo: 'Entregado', width: 11 },
  ]
  const wsC = wb.addWorksheet('Clientes', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } })
  encabezado(wsC, 'Clientes y pedidos', colsC)
  facturas.forEach((f) => {
    const row = wsC.addRow({
      n: numeroEncomienda(f.numero), cliente: f.cliente_nombre, telefono: f.cliente_telefono || '', detalle: f.detalle,
      servicio: num(f.total_servicio), tarjeta: num(f.total_tarjeta), total: num(f.total), abonado: num(f.abonado), saldo: num(f.saldo),
      entregado: f.entregada ? 'Sí' : 'No',
    })
    row.alignment = { vertical: 'top', wrapText: true }
    row.eachCell((c) => { c.border = borde })
    if (num(f.saldo) > 0) row.getCell('saldo').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOL } }
  })
  const primera = 5, ultima = 4 + facturas.length
  const tot = wsC.addRow({ cliente: 'TOTAL', detalle: `${facturas.length} clientes` })
  for (const k of ['servicio', 'tarjeta', 'total', 'abonado', 'saldo']) {
    const col = wsC.getColumn(k).letter
    tot.getCell(k).value = facturas.length ? { formula: `SUM(${col}${primera}:${col}${ultima})`, result: facturas.reduce((s, f) => s + num(f[{ servicio: 'total_servicio', tarjeta: 'total_tarjeta', total: 'total', abonado: 'abonado', saldo: 'saldo' }[k]]), 0) } : 0
  }
  tot.font = { bold: true }
  tot.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREMA } } })
  for (const k of ['servicio', 'tarjeta', 'total', 'abonado', 'saldo']) wsC.getColumn(k).numFmt = USD

  // --- Hoja 2: Gastos
  const colsG = [
    { key: 'fecha', titulo: 'Fecha', width: 13 },
    { key: 'categoria', titulo: 'Categoría', width: 18 },
    { key: 'detalle', titulo: 'Detalle', width: 36 },
    { key: 'pago', titulo: 'Pagó', width: 20 },
    { key: 'monto', titulo: 'Monto', width: 13, dinero: true },
  ]
  const wsG = wb.addWorksheet('Gastos')
  encabezado(wsG, 'Gastos del viaje', colsG)
  gastos.forEach((g) => {
    const row = wsG.addRow({ fecha: fechaCorta(g.fecha), categoria: CATEGORIAS_GASTO[g.categoria]?.texto || g.categoria, detalle: g.descripcion || '', pago: nombres[g.pagado_por] || '', monto: num(g.monto) })
    row.eachCell((c) => { c.border = borde })
  })
  const totG = wsG.addRow({ categoria: 'TOTAL', monto: gastos.length ? { formula: `SUM(E5:E${4 + gastos.length})`, result: gastos.reduce((s, g) => s + num(g.monto), 0) } : 0 })
  totG.font = { bold: true }
  totG.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREMA } } })
  wsG.getColumn('monto').numFmt = USD

  // --- Hoja 3: Resumen
  const wsR = wb.addWorksheet('Resumen')
  wsR.columns = [{ width: 38 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }]
  wsR.mergeCells('A1:G1')
  wsR.getCell('A1').value = `${negocio?.nombre_negocio || 'Encomiendas'} — Resumen del viaje ${viaje.nombre}`
  wsR.getCell('A1').font = { bold: true, size: 14 }
  const filas = [
    ['Cobrado por traer (ingresos)', num(viaje.total_servicio)],
    ['Gastos del viaje', -num(viaje.total_gastos)],
    ['GANANCIA NETA', num(viaje.ganancia)],
    [],
    ['Compras con tarjeta (se devuelven, no son ganancia)', num(viaje.total_tarjeta)],
    ['Total a cobrar a clientes', num(viaje.total_a_cobrar)],
    ['Ya cobrado', num(viaje.total_abonado)],
    ['Falta por cobrar', num(viaje.por_cobrar)],
    ['Pedidos entregados', `${viaje.num_entregadas} de ${viaje.num_facturas}`],
  ]
  filas.forEach((f, i) => {
    const row = wsR.getRow(3 + i)
    row.values = f
    if (typeof f[1] === 'number') row.getCell(2).numFmt = USD
    if (f[0] === 'GANANCIA NETA') { row.font = { bold: true, size: 12 }; row.getCell(1).fill = row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PASTO } } }
  })
  const inicioRep = 3 + filas.length + 2
  wsR.getRow(inicioRep - 1).values = ['Reparto entre socios']
  wsR.getRow(inicioRep - 1).font = { bold: true, size: 12 }
  const cab = wsR.getRow(inicioRep)
  cab.values = ['Socio', 'Parte ganancia', 'Gastos pagados', 'Su tarjeta', 'Le corresponde', 'Ya recibió', 'Falta pagarle']
  cab.eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINTA } } })
  reparto.forEach((r, i) => {
    const row = wsR.getRow(inicioRep + 1 + i)
    row.values = [`${r.nombre}${r.participa ? '' : ' (no participa)'}`, num(r.parte_ganancia), num(r.gastos_pagados), num(r.tarjeta), num(r.corresponde), num(r.pagado), num(r.pendiente)]
    for (let c = 2; c <= 7; c++) row.getCell(c).numFmt = USD
  })

  const buffer = await wb.xlsx.writeBuffer()
  bajar(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nombreArchivo(viaje, 'xlsx'))
}

// ------------------------------------------------------------------- PDF
export async function descargarPdf(datos) {
  const [{ jsPDF }, { default: autoTable }, logo] = await Promise.all([import('jspdf'), import('jspdf-autotable'), cargarLogo()])
  const { viaje, facturas, gastos, reparto, nombres, negocio } = datos
  const limpio = (t) => String(t ?? '').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—−]/g, '-').replace(/[^\x00-\xFF]/g, '')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 14
  const TINTA = [44, 46, 42], PIEDRA = [107, 109, 106], CREMA = [245, 241, 228]

  // Cabecera
  doc.setFillColor(...TINTA); doc.rect(0, 0, W, 32, 'F')
  let x = M
  if (logo) {
    const { w, h } = encajar(logo, 24, 24)
    doc.setFillColor(255, 255, 255); doc.roundedRect(M, 3, w + 4, h + 4, 2, 2, 'F')
    doc.addImage(logo.dataUrl, 'PNG', M + 2, 5, w, h)
    x = M + w + 9
  }
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16)
  doc.text(limpio(negocio?.nombre_negocio || 'Encomiendas'), x, 15)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(220, 220, 215)
  doc.text(limpio(`Reporte del viaje ${viaje.nombre}${viaje.fecha_entrega ? ' - entrega ' + fechaCorta(viaje.fecha_entrega) : ''}`), x, 21)

  // Tarjetas de resumen
  const cajas = [
    ['Ganancia neta', dinero(viaje.ganancia)],
    ['Cobrado por traer', dinero(viaje.total_servicio)],
    ['Gastos', dinero(viaje.total_gastos)],
    ['Falta por cobrar', dinero(viaje.por_cobrar)],
  ]
  const ancho = (W - 2 * M - 9) / 4
  cajas.forEach(([t, v], i) => {
    const cx = M + i * (ancho + 3)
    doc.setFillColor(...(i === 0 ? [228, 244, 216] : CREMA)); doc.roundedRect(cx, 39, ancho, 18, 3, 3, 'F')
    doc.setTextColor(...PIEDRA); doc.setFontSize(8.5); doc.text(t, cx + 4, 45)
    doc.setTextColor(...TINTA); doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.text(limpio(v), cx + 4, 53); doc.setFont('helvetica', 'normal')
  })

  const estilo = {
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2, textColor: TINTA, lineColor: [213, 213, 212], lineWidth: 0.1 },
    headStyles: { fillColor: TINTA, textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: CREMA, textColor: TINTA, fontStyle: 'bold' },
    margin: { left: M, right: M },
  }
  const titulo = (t, y) => { doc.setTextColor(...TINTA); doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text(t, M, y); doc.setFont('helvetica', 'normal') }

  titulo(`Clientes y pedidos (${facturas.length})`, 66)
  const suma = (k) => dinero(facturas.reduce((s, f) => s + num(f[k]), 0))
  autoTable(doc, {
    ...estilo,
    startY: 69,
    head: [['N°', 'Cliente', 'Detalle de paquetes', 'Total', 'Abonado', 'Adeuda']],
    body: facturas.map((f) => [numeroEncomienda(f.numero), limpio(f.cliente_nombre) + (f.entregada ? '\n(entregado)' : ''), limpio(f.detalle), dinero(f.total), dinero(f.abonado), num(f.saldo) > 0 ? dinero(f.saldo) : '-']),
    foot: [['', 'TOTAL', '', suma('total'), suma('abonado'), dinero(facturas.reduce((s, f) => s + Math.max(num(f.saldo), 0), 0))]],
    columnStyles: { 0: { cellWidth: 13 }, 1: { cellWidth: 32 }, 3: { halign: 'right', cellWidth: 20 }, 4: { halign: 'right', cellWidth: 20 }, 5: { halign: 'right', cellWidth: 20 } },
    didParseCell: (h) => { if (h.section !== 'body' && h.column.index >= 3) h.cell.styles.halign = 'right' },
  })

  let y = doc.lastAutoTable.finalY + 10
  if (y > 250) { doc.addPage(); y = 20 }
  titulo(`Gastos del viaje (${gastos.length})`, y)
  autoTable(doc, {
    ...estilo,
    startY: y + 3,
    head: [['Fecha', 'Categoría', 'Detalle', 'Pagó', 'Monto']],
    body: gastos.length ? gastos.map((g) => [limpio(fechaCorta(g.fecha)), limpio(CATEGORIAS_GASTO[g.categoria]?.texto), limpio(g.descripcion || ''), limpio(nombres[g.pagado_por] || ''), dinero(g.monto)]) : [['', 'Sin gastos registrados', '', '', '']],
    foot: [['', 'TOTAL', '', '', dinero(viaje.total_gastos)]],
    columnStyles: { 4: { halign: 'right', cellWidth: 24 } },
    didParseCell: (h) => { if (h.section !== 'body' && h.column.index === 4) h.cell.styles.halign = 'right' },
  })

  y = doc.lastAutoTable.finalY + 10
  if (y > 240) { doc.addPage(); y = 20 }
  titulo('Reparto entre socios', y)
  autoTable(doc, {
    ...estilo,
    startY: y + 3,
    head: [['Socio', 'Parte ganancia', 'Gastos pagados', 'Su tarjeta', 'Le corresponde', 'Ya recibió', 'Falta pagarle']],
    body: reparto.map((r) => [limpio(r.nombre) + (r.participa ? '' : ' (no participa)'), dinero(r.parte_ganancia), dinero(r.gastos_pagados), dinero(r.tarjeta), dinero(r.corresponde), dinero(r.pagado), dinero(r.pendiente)]),
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' }, 5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold' } },
  })
  y = doc.lastAutoTable.finalY + 6
  doc.setFontSize(8); doc.setTextColor(...PIEDRA)
  doc.text(limpio('Ganancia neta = cobrado por traer - gastos del viaje. Las compras con tarjeta no son ganancia: el cliente devuelve el valor exacto y se reembolsa al dueño de la tarjeta.'), M, y, { maxWidth: W - 2 * M })

  // Pie con número de página
  const paginas = doc.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(...PIEDRA)
    doc.text(limpio(`Generado el ${fechaCorta(datos.generado.toISOString())} · Uso interno entre socios`), M, 290)
    doc.text(`${i} / ${paginas}`, W - M, 290, { align: 'right' })
  }
  doc.save(nombreArchivo(viaje, 'pdf'))
}

function bajar(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nombre
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

