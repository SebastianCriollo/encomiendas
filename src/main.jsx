import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { configFaltante } from './lib/supabase'

function FaltaConfiguracion() {
  return (
    <main className="mx-auto max-w-md px-4 pt-20">
      <h1 className="titulo-pagina mb-3">Falta conectar Supabase</h1>
      <p className="text-piedra">
        Crea el archivo <code className="rounded bg-arena px-1.5">.env</code> a partir de{' '}
        <code className="rounded bg-arena px-1.5">.env.example</code> con la URL y la anon key de tu proyecto, y vuelve a
        ejecutar <code className="rounded bg-arena px-1.5">npm run dev</code>.
      </p>
    </main>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>{configFaltante ? <FaltaConfiguracion /> : <App />}</StrictMode>,
)
