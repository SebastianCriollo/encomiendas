import { primerNombre } from '../lib/datos'

// Chips para elegir varios socios
export default function SelectorSocios({ perfiles, elegidos, onCambio }) {
  const alternar = (id) => onCambio(elegidos.includes(id) ? elegidos.filter((x) => x !== id) : [...elegidos, id])
  return (
    <div className="flex flex-wrap gap-2">
      {perfiles.map((p) => {
        const on = elegidos.includes(p.id)
        return (
          <button type="button" key={p.id} onClick={() => alternar(p.id)} aria-pressed={on}
            className={`flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition ${on ? 'bg-tinta text-blanco' : 'border border-niebla bg-blanco'}`}>
            <span aria-hidden="true" className={`flex size-4 items-center justify-center rounded-full border-[1.5px] ${on ? 'border-pasto bg-pasto' : 'border-niebla'}`} />
            {primerNombre(p.nombre)}
          </button>
        )
      })}
    </div>
  )
}
