-- =====================================================================
--  ENCOMIENDAS — Etapa 2: Clientes
--  Ejecutar en: Supabase > SQL Editor > New query > Run
-- =====================================================================

-- Clientes con sus totales: cuántas encomiendas, cuánto se les cobró,
-- cuánto han abonado y cuánto deben. Respeta RLS (security_invoker).
create or replace view public.v_clientes with (security_invoker = true) as
select
  c.*,
  count(e.id)::int                       as num_encomiendas,
  coalesce(sum(e.precio_cobrado), 0)     as total_cobrado,
  coalesce(sum(e.abonado), 0)            as total_abonado,
  coalesce(sum(greatest(e.saldo, 0)), 0) as saldo,
  max(e.fecha_pedido)                    as ultima_encomienda
from public.clientes c
left join public.v_encomiendas e on e.cliente_id = c.id
group by c.id;

-- Búsqueda rápida por nombre aunque haya muchos clientes
create index if not exists clientes_nombre_idx on public.clientes (lower(nombre));
