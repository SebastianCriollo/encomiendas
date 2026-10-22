import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { dinero, mensajeError } from '../lib/formato'
import { Aviso, Boton, Campo, Cargando, Encabezado, Tarjeta } from '../components/ui'
import Icono from '../components/Icono'

export default function Precios() {
  const { esAdmin } = useAuth()
  const [tarifas, setTarifas] = useState(null)
  const [cambios, setCambios] = useState({})
  const [mensaje, setMensaje] = useState({ tipo: 'ok', texto: '' })
  const [guardando, setGuardando] = useState(false)
  const [nueva, setNueva] = useState({ nombre: '', modo: 'por_unidad', precio: '' })

  async function cargar() {
    const { data, error } = await supabase.from('tarifas').select('*').order('orden')
    if (error) setMensaje({ tipo: 'error', texto: mensajeError(error) })
    else { setTarifas(data); setCambios({}) }
  }
  useEffect(() => { cargar() }, [])

  if (!tarifas) return <Cargando />

  const valor = (t, campo) => (cambios[t.id]?.[campo] ?? t[campo])
  const cambiar = (id, campo, v) => setCambios((c) => ({ ...c, [id]: { ...c[id], [campo]: v } }))
  const hayCambios = Object.keys(cambios).length > 0

  async function guardar() {
    setGuardando(true)
    setMensaje({ tipo: 'ok', texto: '' })
    for (const [id, c] of Object.entries(cambios)) {
      const datos = { ...c }
      if ('precio' in datos) {
        const n = Number(String(datos.precio).replace(',', '.'))
        if (!(n >= 0) || datos.precio === '') { setGuardando(false); setMensaje({ tipo: 'error', texto: 'Revisa los precios: deben ser números.' }); return }
        datos.precio = n
      }
      const { error } = await supabase.from('tarifas').update(datos).eq('id', id)
      if (error) { setGuardando(false); setMensaje({ tipo: 'error', texto: mensajeError(error) }); return }
    }
    setGuardando(false)
    setMensaje({ tipo: 'ok', texto: 'Precios guardados. Las facturas ya hechas no cambian.' })
    cargar()
  }

  async function agregar(e) {
    e.preventDefault()
    const precio = Number(String(nueva.precio).replace(',', '.'))
    if (!nueva.nombre.trim() || !(precio >= 0) || nueva.precio === '') { setMensaje({ tipo: 'error', texto: 'Escribe el nombre y el precio.' }); return }
    const { error } = await supabase.from('tarifas').insert({ nombre: nueva.nombre.trim(), modo: nueva.modo, precio, orden: tarifas.length + 1, icono: 'otro' })
    if (error) { setMensaje({ tipo: 'error', texto: mensajeError(error) }); return }
    setNueva({ nombre: '', modo: 'por_unidad', precio: '' })
    setMensaje({ tipo: 'ok', texto: 'Artículo agregado a la lista.' })
    cargar()
  }

  return (
    <div className="space-y-4">
      <Encabezado titulo="Lista de precios" subtitulo="Lo que se cobra por traer cada cosa." volverA="/mas" />
      <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>

      <ul className="overflow-hidden rounded-tarjeta bg-blanco">
        {tarifas.map((t) => {
          const activa = valor(t, 'activa')
          return (
            <li key={t.id} className={`flex items-center gap-3 border-t border-niebla/70 px-4 py-3 first:border-t-0 ${activa ? '' : 'opacity-50'}`}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-arena"><Icono nombre={t.icono} size={20} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{t.nombre}</span>
                <span className="block text-xs text-piedra">{t.modo === 'por_lb' ? 'por libra' : 'por artículo'}</span>
              </span>
              {esAdmin ? (
                <span className="flex items-center gap-2">
                  <label className="flex items-center gap-1">
                    <span className="text-piedra">$</span>
                    <span className="sr-only">Precio de {t.nombre}</span>
                    <input
                      inputMode="decimal"
                      value={valor(t, 'precio')}
                      onChange={(e) => cambiar(t.id, 'precio', e.target.value)}
                      className="h-11 w-18 rounded-campo border border-niebla bg-blanco px-2 text-right font-medium outline-none focus:border-tinta"
                    />
                  </label>
                  <button
                    onClick={() => cambiar(t.id, 'activa', !activa)}
                    className="min-h-11 rounded-full px-2 text-xs text-piedra underline decoration-niebla underline-offset-4"
                  >
                    {activa ? 'Ocultar' : 'Mostrar'}
                  </button>
                </span>
              ) : (
                <span className="font-medium">{dinero(t.precio)}{t.modo === 'por_lb' ? '/lb' : ''}</span>
              )}
            </li>
          )
        })}
      </ul>

      {esAdmin && (
        <>
          {hayCambios && <Boton onClick={guardar} cargando={guardando} className="w-full">Guardar precios</Boton>}
          <Tarjeta>
            <h2 className="mb-4 text-lg font-medium">Agregar a la lista</h2>
            <form onSubmit={agregar} className="space-y-4" noValidate>
              <Campo etiqueta="Nombre" name="nombre" placeholder="Audífonos" value={nueva.nombre} onChange={(e) => setNueva((n) => ({ ...n, nombre: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Cómo se cobra">
                {[['por_unidad', 'Por artículo'], ['por_lb', 'Por libra']].map(([m, txt]) => (
                  <button type="button" key={m} onClick={() => setNueva((n) => ({ ...n, modo: m }))} aria-pressed={nueva.modo === m}
                    className={`min-h-12 rounded-full font-medium ${nueva.modo === m ? 'bg-tinta text-blanco' : 'border border-niebla'}`}>{txt}</button>
                ))}
              </div>
              <Campo etiqueta="Precio (USD)" name="precio" inputMode="decimal" placeholder="20" value={nueva.precio} onChange={(e) => setNueva((n) => ({ ...n, precio: e.target.value }))} />
              <Boton type="submit" variante="secundario" className="w-full">Agregar</Boton>
            </form>
          </Tarjeta>
          <p className="px-1 text-sm text-piedra">“Ocultar” quita un artículo de las facturas nuevas sin borrarlo de las antiguas.</p>
        </>
      )}
    </div>
  )
}
