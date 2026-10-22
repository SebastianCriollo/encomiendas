// Textos y colores de estados y categorías (un solo lugar para toda la app)

export const ESTADOS_PAGO = {
  pendiente: { texto: 'Pendiente', clase: 'border-coral', punto: 'border-coral bg-transparent' },
  parcial: { texto: 'Parcial', clase: 'border-tinta', punto: 'border-tinta bg-[linear-gradient(90deg,var(--color-tinta)_50%,transparent_50%)]' },
  pagado: { texto: 'Pagado', clase: 'border-pasto bg-pasto', punto: 'border-tinta bg-tinta' },
}

export const CATEGORIAS_GASTO = {
  pasaje_avion: { texto: 'Pasaje de avión', icono: 'avion' },
  taxi: { texto: 'Taxi', icono: 'taxi' },
  bus_metro: { texto: 'Bus / metro', icono: 'bus' },
  comida: { texto: 'Comida', icono: 'comida' },
  otros: { texto: 'Otros', icono: 'otros' },
}

export const METODOS_PAGO = { efectivo: 'Efectivo', transferencia: 'Transferencia' }
