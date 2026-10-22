-- =====================================================================
--  ENCOMIENDAS — Etapa 4: Ganancias y reparto entre socios
--  Ejecutar en: Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ---------- 1. Porcentajes de reparto por viaje ----------------------
-- Se copian de Socios al crear el viaje. Cambiarlos después en Socios
-- no altera viajes anteriores; el admin puede ajustar los de cada viaje.
create table public.porcentajes_viaje (
  viaje_id       uuid not null references public.viajes (id) on delete cascade,
  socio_id       uuid not null references public.perfiles (id),
  porcentaje     numeric(5,2) not null check (porcentaje between 0 and 100),
  creado_por     uuid references public.perfiles (id) default auth.uid(),
  creado_en      timestamptz not null default now(),
  modificado_por uuid references public.perfiles (id),
  modificado_en  timestamptz not null default now(),
  primary key (viaje_id, socio_id)
);

create or replace function public.copiar_porcentajes_viaje()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.porcentajes_viaje (viaje_id, socio_id, porcentaje)
  select new.id, p.id, p.porcentaje_ganancia
  from public.perfiles p
  where p.activo and p.porcentaje_ganancia > 0;
  return new;
end;
$$;
create trigger copiar_porcentajes
  after insert on public.viajes
  for each row execute function public.copiar_porcentajes_viaje();

-- Viajes que ya existían: se les copian los porcentajes actuales
insert into public.porcentajes_viaje (viaje_id, socio_id, porcentaje)
select v.id, p.id, p.porcentaje_ganancia
from public.viajes v cross join public.perfiles p
where p.activo and p.porcentaje_ganancia > 0
on conflict do nothing;

create trigger auditoria before insert or update on public.porcentajes_viaje
  for each row execute function public.poner_auditoria();

-- registrar_historial usa la columna "id"; esta tabla tiene llave doble,
-- así que tiene su propia versión del historial.
create or replace function public.registrar_historial_porcentajes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.historial (tabla, registro_id, accion, datos_antes, datos_despues, usuario_id)
  values ('porcentajes_viaje', coalesce(new.viaje_id, old.viaje_id)::text, tg_op,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end, auth.uid());
  return coalesce(new, old);
end;
$$;
create trigger historial after insert or update or delete on public.porcentajes_viaje
  for each row execute function public.registrar_historial_porcentajes();

alter table public.porcentajes_viaje enable row level security;
create policy "miembros leen" on public.porcentajes_viaje for select to authenticated using (public.es_miembro());
create policy "admin crea"    on public.porcentajes_viaje for insert to authenticated with check (public.es_admin());
create policy "admin edita"   on public.porcentajes_viaje for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin borra"   on public.porcentajes_viaje for delete to authenticated using (public.es_admin());
revoke all on public.porcentajes_viaje from anon;

-- ---------- 2. Pagos a socios: ahora se registran por viaje ----------
alter table public.pagos_socios add column viaje_id uuid references public.viajes (id) on delete cascade;
alter table public.pagos_socios alter column periodo drop not null;
create index if not exists pagos_socios_viaje_idx on public.pagos_socios (viaje_id);

-- ---------- 3. Vista del reparto: una fila por socio y viaje ----------
create view public.v_reparto with (security_invoker = true) as
with base as (
  select
    v.id   as viaje_id,
    v.ganancia,
    p.id   as socio_id,
    p.nombre,
    coalesce(pv.porcentaje, 0) as porcentaje,
    coalesce((select sum(g.monto) from public.gastos g where g.viaje_id = v.id and g.pagado_por = p.id), 0) as gastos_pagados,
    coalesce((select sum(c.monto) from public.compras_tarjeta c join public.facturas f on f.id = c.factura_id
              where f.viaje_id = v.id and c.tarjeta_de = p.id), 0) as tarjeta,
    coalesce((select sum(ps.monto) from public.pagos_socios ps where ps.viaje_id = v.id and ps.socio_id = p.id), 0) as pagado,
    coalesce((select sum(a.monto) from public.abonos a join public.facturas f on f.id = a.factura_id
              where f.viaje_id = v.id and a.recibido_por = p.id), 0) as cobrado
  from public.v_viajes v
  cross join public.perfiles p
  left join public.porcentajes_viaje pv on pv.viaje_id = v.id and pv.socio_id = p.id
)
select
  b.*,
  round(b.ganancia * b.porcentaje / 100, 2)                                  as parte_ganancia,
  round(b.ganancia * b.porcentaje / 100, 2) + b.gastos_pagados + b.tarjeta   as corresponde,
  round(b.ganancia * b.porcentaje / 100, 2) + b.gastos_pagados + b.tarjeta - b.pagado as pendiente
from base b
where b.porcentaje > 0 or b.gastos_pagados > 0 or b.tarjeta > 0 or b.pagado > 0 or b.cobrado > 0;
