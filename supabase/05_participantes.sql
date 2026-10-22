-- =====================================================================
--  ENCOMIENDAS — Etapa 4 (ajuste): reparto en partes iguales entre
--  los socios que participan en cada viaje + permiso para registrar
--  pagos a socios.
--  Ejecutar en: Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ---------- 1. Permiso: quién puede manejar el reparto --------------
alter table public.perfiles
  add column if not exists puede_gestionar_reparto boolean not null default false;

-- Admin, o socio activo con el permiso
create or replace function public.puede_repartir()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and activo and (rol = 'admin' or puede_gestionar_reparto)
  );
$$;
revoke execute on function public.puede_repartir() from anon;

-- ---------- 2. Socios que participan en cada viaje ------------------
create table public.participantes_viaje (
  viaje_id       uuid not null references public.viajes (id) on delete cascade,
  socio_id       uuid not null references public.perfiles (id),
  creado_por     uuid references public.perfiles (id) default auth.uid(),
  creado_en      timestamptz not null default now(),
  modificado_por uuid references public.perfiles (id),
  modificado_en  timestamptz not null default now(),
  primary key (viaje_id, socio_id)
);

-- Se pasan los socios que ya estaban en el reparto de cada viaje
insert into public.participantes_viaje (viaje_id, socio_id)
select viaje_id, socio_id from public.porcentajes_viaje where porcentaje > 0
on conflict do nothing;

-- Al crear un viaje entran todos los socios activos; luego se quitan los que no van
create or replace function public.agregar_participantes_viaje()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.participantes_viaje (viaje_id, socio_id)
  select new.id, p.id from public.perfiles p where p.activo
  on conflict do nothing;
  return new;
end;
$$;

-- Se retira el modelo de porcentajes
drop view if exists public.v_reparto;
drop trigger if exists copiar_porcentajes on public.viajes;
drop function if exists public.copiar_porcentajes_viaje();
drop table if exists public.porcentajes_viaje;
drop function if exists public.registrar_historial_porcentajes();

create trigger agregar_participantes
  after insert on public.viajes
  for each row execute function public.agregar_participantes_viaje();

create trigger auditoria before insert or update on public.participantes_viaje
  for each row execute function public.poner_auditoria();

create or replace function public.registrar_historial_participantes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.historial (tabla, registro_id, accion, datos_antes, datos_despues, usuario_id)
  values ('participantes_viaje', coalesce(new.viaje_id, old.viaje_id)::text, tg_op,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end, auth.uid());
  return coalesce(new, old);
end;
$$;
create trigger historial after insert or update or delete on public.participantes_viaje
  for each row execute function public.registrar_historial_participantes();

alter table public.participantes_viaje enable row level security;
create policy "miembros leen"  on public.participantes_viaje for select to authenticated using (public.es_miembro());
create policy "reparto crea"   on public.participantes_viaje for insert to authenticated with check (public.puede_repartir());
create policy "reparto edita"  on public.participantes_viaje for update to authenticated using (public.puede_repartir()) with check (public.puede_repartir());
create policy "reparto borra"  on public.participantes_viaje for delete to authenticated using (public.puede_repartir());
revoke all on public.participantes_viaje from anon;

-- ---------- 3. Pagos a socios: admin o socio con permiso -------------
drop policy if exists "admin crea"  on public.pagos_socios;
drop policy if exists "admin edita" on public.pagos_socios;
drop policy if exists "admin borra" on public.pagos_socios;
create policy "reparto crea"  on public.pagos_socios for insert to authenticated with check (public.puede_repartir());
create policy "reparto edita" on public.pagos_socios for update to authenticated using (public.puede_repartir()) with check (public.puede_repartir());
create policy "reparto borra" on public.pagos_socios for delete to authenticated using (public.puede_repartir());

-- ---------- 4. Vista del reparto: partes iguales ---------------------
create view public.v_reparto with (security_invoker = true) as
with n as (
  select viaje_id, count(*) as cuantos from public.participantes_viaje group by 1
),
base as (
  select
    v.id   as viaje_id,
    v.ganancia,
    p.id   as socio_id,
    p.nombre,
    (pv.socio_id is not null) as participa,
    coalesce(n.cuantos, 0)    as num_participantes,
    coalesce((select sum(g.monto) from public.gastos g where g.viaje_id = v.id and g.pagado_por = p.id), 0) as gastos_pagados,
    coalesce((select sum(c.monto) from public.compras_tarjeta c join public.facturas f on f.id = c.factura_id
              where f.viaje_id = v.id and c.tarjeta_de = p.id), 0) as tarjeta,
    coalesce((select sum(ps.monto) from public.pagos_socios ps where ps.viaje_id = v.id and ps.socio_id = p.id), 0) as pagado,
    coalesce((select sum(a.monto) from public.abonos a join public.facturas f on f.id = a.factura_id
              where f.viaje_id = v.id and a.recibido_por = p.id), 0) as cobrado
  from public.v_viajes v
  cross join public.perfiles p
  left join public.participantes_viaje pv on pv.viaje_id = v.id and pv.socio_id = p.id
  left join n on n.viaje_id = v.id
)
select
  b.*,
  case when b.participa then round(100.0 / b.num_participantes, 2) else 0 end          as porcentaje,
  case when b.participa then round(b.ganancia / b.num_participantes, 2) else 0 end     as parte_ganancia,
  case when b.participa then round(b.ganancia / b.num_participantes, 2) else 0 end
    + b.gastos_pagados + b.tarjeta                                                      as corresponde,
  case when b.participa then round(b.ganancia / b.num_participantes, 2) else 0 end
    + b.gastos_pagados + b.tarjeta - b.pagado                                           as pendiente
from base b
where b.participa or b.gastos_pagados > 0 or b.tarjeta > 0 or b.pagado > 0 or b.cobrado > 0;
