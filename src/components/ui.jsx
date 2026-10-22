import { Link } from 'react-router-dom'
import { ESTADOS_PAGO } from '../lib/estados'

// Componentes base reutilizables: un solo lugar para el estilo de botones, campos y tarjetas.

export function Tarjeta({ className = '', hundida = false, children, ...props }) {
  return (
    <div
      className={`${hundida ? 'bg-arena' : 'bg-blanco'} rounded-tarjeta p-5 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

// variante: "principal" (tinta + punto verde) | "secundario" (blanco con borde) | "peligro"
export function Boton({ variante = 'principal', cargando = false, className = '', children, ...props }) {
  const base =
    'inline-flex min-h-12 items-center gap-3 rounded-full px-5 text-[15px] font-medium transition active:scale-[0.98] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta'
  const estilos = {
    principal: 'bg-tinta text-blanco pl-6 pr-2 justify-between',
    secundario: 'justify-center bg-blanco text-tinta border border-niebla hover:border-tinta',
    peligro: 'justify-center bg-blanco text-tinta border-[1.5px] border-coral',
  }
  return (
    <button className={`${base} ${estilos[variante]} ${className}`} disabled={cargando || props.disabled} {...props}>
      <span>{cargando ? 'Un momento…' : children}</span>
      {variante === 'principal' && (
        <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-pasto text-tinta">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </span>
      )}
    </button>
  )
}

export function Campo({ etiqueta, ayuda, error, id, className = '', ...props }) {
  const campoId = id || props.name
  return (
    <label htmlFor={campoId} className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium">{etiqueta}</span>
      <input
        id={campoId}
        className={`h-13 w-full rounded-campo border bg-blanco px-4 text-base outline-none transition placeholder:text-piedra/70 focus:border-tinta ${error ? 'border-coral' : 'border-niebla'}`}
        aria-invalid={!!error}
        {...props}
      />
      {error ? (
        <span className="mt-1.5 block text-sm text-[#b8402f]">{error}</span>
      ) : ayuda ? (
        <span className="mt-1.5 block text-sm text-piedra">{ayuda}</span>
      ) : null}
    </label>
  )
}

export function Aviso({ tipo = 'error', children }) {
  if (!children) return null
  const estilos = {
    error: 'border-coral bg-coral-tinte',
    ok: 'border-pasto bg-pasto-tinte',
    info: 'border-cielo bg-cielo-tinte',
  }
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={`rounded-campo border-[1.5px] px-4 py-3 text-sm ${estilos[tipo]}`}>
      {children}
    </div>
  )
}

export function Chip({ color = 'arena', punto, children }) {
  const fondos = {
    arena: 'bg-arena', cielo: 'bg-cielo-tinte', sol: 'bg-sol-tinte', pasto: 'bg-pasto-tinte', coral: 'bg-coral-tinte',
  }
  const puntos = { arena: 'bg-piedra', cielo: 'bg-cielo', sol: 'bg-sol ring-1 ring-tinta', pasto: 'bg-pasto', coral: 'bg-coral' }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${fondos[color]}`}>
      {punto !== false && <span className={`size-2 rounded-full ${puntos[color]}`} />}
      {children}
    </span>
  )
}

export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-piedra" role="status">
      <span className="mr-3 size-5 animate-spin rounded-full border-2 border-niebla border-t-tinta" />
      {texto}
    </div>
  )
}

export function AreaTexto({ etiqueta, ayuda, id, className = '', ...props }) {
  const campoId = id || props.name
  return (
    <label htmlFor={campoId} className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium">{etiqueta}</span>
      <textarea
        id={campoId}
        rows={3}
        className="w-full rounded-campo border border-niebla bg-blanco px-4 py-3 text-base outline-none transition placeholder:text-piedra/70 focus:border-tinta"
        {...props}
      />
      {ayuda && <span className="mt-1.5 block text-sm text-piedra">{ayuda}</span>}
    </label>
  )
}

// Encabezado de página con flecha "volver" opcional
export function Encabezado({ titulo, subtitulo, volverA, accion }) {
  return (
    <div className="mb-1 px-1">
      {volverA && (
        <Link to={volverA} className="-ml-1 mb-2 inline-flex min-h-10 items-center gap-1.5 text-sm text-piedra">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
          Volver
        </Link>
      )}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="titulo-pagina break-words">{titulo}</h1>
          {subtitulo && <p className="mt-1 text-piedra">{subtitulo}</p>}
        </div>
        {accion}
      </div>
    </div>
  )
}

export function Vacio({ titulo, texto, children }) {
  return (
    <div className="rounded-tarjeta border-[1.5px] border-dashed border-arena px-6 py-10 text-center">
      <p className="text-lg font-medium">{titulo}</p>
      {texto && <p className="mx-auto mt-1 max-w-xs text-sm text-piedra">{texto}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  )
}

// Botón redondo verde con "+" (para agregar)
export function BotonMas({ to, etiqueta }) {
  return (
    <Link to={to} aria-label={etiqueta} className="flex size-12 shrink-0 items-center justify-center rounded-full bg-pasto text-tinta transition active:scale-95">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
    </Link>
  )
}

// Chip de pago: con borde e ícono, para distinguirlo del chip de envío
export function ChipPago({ estado }) {
  const e = ESTADOS_PAGO[estado] || ESTADOS_PAGO.pendiente
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-2.5 py-0.5 text-xs font-medium ${e.clase}`}>
      <span aria-hidden="true" className={`size-2.5 rounded-full border-[1.5px] ${e.punto}`} />{e.texto}
    </span>
  )
}

export function ChipEntrega({ entregada }) {
  return entregada ? <Chip color="pasto">Entregado</Chip> : <Chip color="sol">Por entregar</Chip>
}
