import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configFaltante = !url || !anonKey

// Solo se usa la clave PÚBLICA (anon). La seguridad real la da RLS en la base de datos.
export const supabase = configFaltante ? null : createClient(url, anonKey)
