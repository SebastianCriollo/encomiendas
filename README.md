# Encomiendas

App web para llevar el control del negocio de encomiendas EE.UU. → Ecuador.
React + Vite + Tailwind · Supabase (PostgreSQL + Auth) · Netlify.

## Estructura

```
encomiendas/
├─ supabase/
│  ├─ schema.sql                       ← tablas, seguridad (RLS), auditoría
│  └─ functions/gestionar-usuarios/    ← función para crear socios (usa la clave secreta en el servidor)
├─ src/
│  ├─ lib/supabase.js                  ← conexión (solo anon key)
│  ├─ context/AuthContext.jsx          ← sesión y perfil del usuario
│  ├─ components/                      ← Layout y componentes base (Boton, Campo, Tarjeta, Chip)
│  └─ pages/                           ← Entrar, Inicio, Socios, Cuenta
├─ .env.example                        ← plantilla de variables (el .env real NO se sube)
└─ netlify.toml                        ← configuración de despliegue
```

## Base de datos (orden de los scripts)

En Supabase → SQL Editor, ejecutar **una vez cada uno y en este orden**:

1. `supabase/schema.sql` — usuarios, clientes, seguridad (RLS), auditoría
2. `supabase/02_clientes.sql`
3. `supabase/03_viajes_facturas.sql` — tarifas, viajes, facturas, abonos, gastos
4. `supabase/04_reparto.sql`
5. `supabase/05_participantes.sql` — reparto en partes iguales por viaje

Además: Edge Function `gestionar-usuarios` (Edge Functions → Via Editor, con
"Verify JWT with legacy secret" desactivado) y, en Authentication, registro
público desactivado y "Confirm email" desactivado.

## Desarrollo local

```
npm install
npm run dev            # http://localhost:5173
npm run dev -- --host  # para probar desde el celular en la misma Wi-Fi
```

Archivo `.env` (no se sube a GitHub):

```
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

## Publicación (Netlify)

- Repositorio en GitHub → Netlify "Import from Git".
- Build: `npm run build`, carpeta `dist` (ya está en `netlify.toml`).
- Variables de entorno en Netlify: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- Cada `git push` a `main` publica una versión nueva automáticamente.

## Roles

| | Admin | Socio con permiso de reparto | Socio |
|---|---|---|---|
| Ver todo el negocio | ✔ | ✔ | ✔ |
| Clientes, viajes, facturas, abonos, gastos | ✔ | ✔ | ✔ |
| Registrar pagos a socios y elegir quién va en cada viaje | ✔ | ✔ | ✘ |
| Borrar registros | ✔ | ✘ | ✘ |
| Socios, precios, datos del negocio, historial | ✔ | ✘ | ✘ |

Las reglas viven en la base de datos (RLS): se cumplen aunque alguien modifique la app.
