import { supabase } from './supabase'

// Viaje "actual": el próximo abierto por fecha de entrega (o el último creado)
export async function buscarViajeActual() {
  const { data, error } = await supabase
    .from('v_viajes')
    .select('*')
    .eq('cerrado', false)
    .order('fecha_entrega', { ascending: true, nullsFirst: false })
    .order('creado_en', { ascending: false })
    .limit(1)
  if (error) throw error
  return data[0] || null
}

export async function cargarPerfiles() {
  const { data } = await supabase.from('perfiles').select('id, nombre, activo').order('creado_en')
  return data || []
}

export const primerNombre = (n) => (n || '').split(' ')[0]
