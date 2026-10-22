import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { mensajeError, normalizar } from '../lib/formato'
import { soloDigitos, telefonoSospechoso } from '../lib/telefono'
import { Aviso, AreaTexto, Boton, Campo, Cargando, Encabezado, Tarjeta } from '../components/ui'

const CIUDADES = [
  'Quito', 'Machachi', 'Sangolquí', 'Amaguaña', 'Conocoto', 'Cumbayá', 'Tumbaco', 'Guayaquil', 'Cuenca',
  'Ambato', 'Latacunga', 'Riobamba', 'Ibarra', 'Santo Domingo', 'Manta', 'Portoviejo', 'Loja', 'Esmeraldas',
]
const VACIO = { nombre: '', telefono: '', ciudad: '', notas: '' }

export default function ClienteForm() {
  const { id } = useParams()
  const editando = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState(editando ? null : VACIO)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [duplicado, setDuplicado] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!editando) return
    supabase.from('clientes').select('nombre, telefono, ciudad, notas').eq('id', id).single()
      .then(({ data, error }) => {
        if (error) setError(mensajeError(error))
        else setForm({ nombre: data.nombre, telefono: data.telefono || '', ciudad: data.ciudad || '', notas: data.notas || '' })
      })
  }, [id, editando])

  if (!form) return error ? <Aviso>{error}</Aviso> : <Cargando />

  const cambiar = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
    setErrores((x) => ({ ...x, [e.target.name]: '' }))
    setDuplicado(null)
  }

  // Busca un cliente con el mismo teléfono o el mismo nombre (sin importar tildes)
  async function buscarDuplicado() {
    const tel = soloDigitos(form.telefono).slice(-9)
    const { data } = await supabase.from('clientes').select('id, nombre, telefono')
    return (data || []).find((c) =>
      c.id !== id && (
        normalizar(c.nombre) === normalizar(form.nombre) ||
        (tel.length >= 7 && soloDigitos(c.telefono).slice(-9) === tel)
      ),
    )
  }

  async function guardar(e) {
    e.preventDefault()
    setError('')
    const nuevosErrores = {}
    if (!form.nombre.trim()) nuevosErrores.nombre = 'Escribe el nombre del cliente.'
    setErrores(nuevosErrores)
    if (Object.keys(nuevosErrores).length) return

    setGuardando(true)
    if (!duplicado) {
      const igual = await buscarDuplicado()
      if (igual) { setDuplicado(igual); setGuardando(false); return }
    }

    const datos = {
      nombre: form.nombre.trim().replace(/\s+/g, ' '),
      telefono: form.telefono.trim() || null,
      ciudad: form.ciudad.trim() || null,
      notas: form.notas.trim() || null,
    }
    const consulta = editando
      ? supabase.from('clientes').update(datos).eq('id', id).select('id').single()
      : supabase.from('clientes').insert(datos).select('id').single()
    const { data, error } = await consulta
    setGuardando(false)
    if (error) { setError(mensajeError(error)); return }
    navigate(`/clientes/${data.id}`, { replace: true })
  }

  return (
    <div className="space-y-4">
      <Encabezado titulo={editando ? 'Editar cliente' : 'Nuevo cliente'} volverA={editando ? `/clientes/${id}` : '/clientes'} />
      <Tarjeta>
        <form onSubmit={guardar} className="space-y-4" noValidate>
          <Campo etiqueta="Nombre" name="nombre" autoComplete="off" autoCapitalize="words" placeholder="María Andrade" value={form.nombre} onChange={cambiar} error={errores.nombre} />
          <Campo
            etiqueta="Teléfono (WhatsApp)"
            name="telefono"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="0991234567"
            value={form.telefono}
            onChange={cambiar}
            ayuda={telefonoSospechoso(form.telefono) ? 'Revisa el número: parece incompleto.' : 'Celular de Ecuador con el 0, o con +código si es de otro país.'}
          />
          <Campo etiqueta="Ciudad" name="ciudad" list="ciudades" autoComplete="off" placeholder="Quito" value={form.ciudad} onChange={cambiar} />
          <datalist id="ciudades">{CIUDADES.map((c) => <option key={c} value={c} />)}</datalist>
          <AreaTexto etiqueta="Notas" name="notas" placeholder="Talla, dirección de entrega, cómo prefiere pagar…" value={form.notas} onChange={cambiar} />

          {duplicado && (
            <Aviso tipo="info">
              Ya existe <strong className="font-medium">{duplicado.nombre}</strong>
              {duplicado.telefono ? ` (${duplicado.telefono})` : ''}. ¿Es otra persona? Pulsa guardar otra vez para crearlo igual.
            </Aviso>
          )}
          <Aviso>{error}</Aviso>
          <Boton type="submit" cargando={guardando} className="w-full">
            {duplicado ? 'Guardar de todos modos' : editando ? 'Guardar cambios' : 'Guardar cliente'}
          </Boton>
        </form>
      </Tarjeta>
    </div>
  )
}
