-- =====================================================================
--  ENCOMIENDAS — Etapa 3: Viajes, tarifas, facturas, abonos y gastos
--  Reemplaza las tablas "encomiendas" y "gastos" de la etapa 1
--  (aún vacías) por el modelo real del negocio.
--  Ejecutar en: Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ---------- 1. Quitar el modelo anterior ----------------------------
drop view  if exists public.v_clientes;
drop view  if exists public.v_encomiendas;
drop table if exists public.abonos;
drop table if exists public.gastos;
drop table if exists public.encomiendas;
drop type  if exists public.estado_envio;
drop type  if exists public.categoria_gasto;

-- ---------- 2. Tipos -------------------------------------------------
create type public.modo_tarifa     as enum ('por_lb', 'por_unidad');
create type public.categoria_gasto as enum ('pasaje_avion', 'taxi', 'bus_metro', 'comida', 'otros');

-- ---------- 3. Lista de precios -------------------------------------
create table public.tarifas (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  modo           public.modo_tarifa not null,
  precio         numeric(10,2) not null check (precio >= 0),
  icono          text,                         -- nombre del ícono en la app
  orden          int not null default 0,
  activa         boolean not null default true,
  creado_por     uuid references public.perfiles (id) default auth.uid(),
  creado_en      timestamptz not null default now(),
  modificado_por uuid references public.perfiles (id),
  modificado_en  timestamptz not null default now()
);

insert into public.tarifas (nombre, modo, precio, icono, orden) values
  ('Ropa',        'por_lb',     8,  'ropa',      1),
  ('Zapatos',     'por_lb',     10, 'zapatos',   2),
  ('Perfume',     'por_unidad', 15, 'perfume',   3),
  ('Vitaminas',   'por_unidad', 9,  'vitaminas', 4),
  ('Reloj',       'por_unidad', 25, 'reloj',     5),
  ('AirPods',     'por_unidad', 20, 'airpods',   6),
  ('Celular',     'por_unidad', 50, 'celular',   7),
  ('Tablet',      'por_unidad', 60, 'tablet',    8),
  ('Laptop',      'por_unidad', 80, 'laptop',    9),
  ('Consola',     'por_unidad', 80, 'consola',   10),
  ('Apple Watch', 'por_unidad', 25, 'watch',     11);

-- ---------- 4. Viajes ------------------------------------------------
create table public.viajes (
  id                   uuid primary key default gen_random_uuid(),
  nombre               text not null,                  -- "Diciembre 2026"
  fecha_limite_pedidos date,
  fecha_entrega        date,
  cerrado              boolean not null default false,
  notas                text,
  creado_por           uuid references public.perfiles (id) default auth.uid(),
  creado_en            timestamptz not null default now(),
  modificado_por       uuid references public.perfiles (id),
  modificado_en        timestamptz not null default now()
);

-- ---------- 5. Facturas (una por cliente y viaje) -------------------
create table public.facturas (
  id             uuid primary key default gen_random_uuid(),
  numero         serial unique,                    -- #0001 en el recibo
  viaje_id       uuid not null references public.viajes (id) on delete restrict,
  cliente_id     uuid not null references public.clientes (id) on delete restrict,
  entregada      boolean not null default false,
  fecha_entregada date,
  notas          text,
  creado_por     uuid references public.perfiles (id) default auth.uid(),
  creado_en      timestamptz not null default now(),
  modificado_por uuid references public.perfiles (id),
  modificado_en  timestamptz not null default now()
);
create index on public.facturas (viaje_id);
create index on public.facturas (cliente_id);

-- Líneas cobradas por traer el producto (lo que es ganancia)
create table public.items_factura (
  id              uuid primary key default gen_random_uuid(),
  factura_id      uuid not null references public.facturas (id) on delete cascade,
  tarifa_id       uuid references public.tarifas (id) on delete set null,
  descripcion     text not null,                  -- "Ropa", "Perfume Chanel", ...
  modo            public.modo_tarifa not null,
  cantidad        numeric(10,2) not null check (cantidad > 0),   -- libras o unidades
  precio_unitario numeric(10,2) not null check (precio_unitario >= 0),
  subtotal        numeric(12,2) generated always as (round(cantidad * precio_unitario, 2)) stored,
  orden           int not null default 0,
  creado_por      uuid references public.perfiles (id) default auth.uid(),
  creado_en       timestamptz not null default now(),
  modificado_por  uuid references public.perfiles (id),
  modificado_en   timestamptz not null default now()
);
create index on public.items_factura (factura_id);

-- Productos comprados con la tarjeta de un socio: el cliente devuelve
-- exactamente ese valor. NO es ganancia.
create table public.compras_tarjeta (
  id             uuid primary key default gen_random_uuid(),
  factura_id     uuid not null references public.facturas (id) on delete cascade,
  descripcion    text not null,
  monto          numeric(10,2) not null check (monto > 0),
  tarjeta_de     uuid not null references public.perfiles (id),
  orden          int not null default 0,
  creado_por     uuid references public.perfiles (id) default auth.uid(),
  creado_en      timestamptz not null default now(),
  modificado_por uuid references public.perfiles (id),
  modificado_en  timestamptz not null default now()
);
create index on public.compras_tarjeta (factura_id);

-- ---------- 6. Abonos (pagos del cliente) ---------------------------
create table public.abonos (
  id             uuid primary key default gen_random_uuid(),
  factura_id     uuid not null references public.facturas (id) on delete cascade,
  monto          numeric(10,2) not null check (monto > 0),
  fecha          date not null default current_date,
  metodo         text not null default 'efectivo' check (metodo in ('efectivo', 'transferencia')),
  recibido_por   uuid references public.perfiles (id) default auth.uid(),
  creado_por     uuid references public.perfiles (id) default auth.uid(),
  creado_en      timestamptz not null default now(),
  modificado_por uuid references public.perfiles (id),
  modificado_en  timestamptz not null default now()
);
create index on public.abonos (factura_id);

-- ---------- 7. Gastos del viaje (internos, entre socios) ------------
create table public.gastos (
  id             uuid primary key default gen_random_uuid(),
  viaje_id       uuid not null references public.viajes (id) on delete cascade,
  categoria      public.categoria_gasto not null,
  monto          numeric(10,2) not null check (monto > 0),
  fecha          date not null default current_date,
  descripcion    text,
  pagado_por     uuid not null references public.perfiles (id) default auth.uid(),
  creado_por     uuid references public.perfiles (id) default auth.uid(),
  creado_en      timestamptz not null default now(),
  modificado_por uuid references public.perfiles (id),
  modificado_en  timestamptz not null default now()
);
create index on public.gastos (viaje_id);

-- ---------- 8. Auditoría + historial en las tablas nuevas -----------
do $$
declare t text;
begin
  foreach t in array array['tarifas','viajes','facturas','items_factura','compras_tarjeta','abonos','gastos'] loop
    execute format('create trigger auditoria before insert or update on public.%I
                    for each row execute function public.poner_auditoria()', t);
    execute format('create trigger historial after insert or update or delete on public.%I
                    for each row execute function public.registrar_historial()', t);
  end loop;
end $$;

-- ---------- 9. Seguridad (RLS) --------------------------------------
alter table public.tarifas         enable row level security;
alter table public.viajes          enable row level security;
alter table public.facturas        enable row level security;
alter table public.items_factura   enable row level security;
alter table public.compras_tarjeta enable row level security;
alter table public.abonos          enable row level security;
alter table public.gastos          enable row level security;

do $$
declare t text;
begin
  -- Todos los miembros leen todo
  foreach t in array array['tarifas','viajes','facturas','items_factura','compras_tarjeta','abonos','gastos'] loop
    execute format('create policy "miembros leen" on public.%I for select to authenticated using (public.es_miembro())', t);
  end loop;

  -- Miembros crean y editan; solo admin borra
  foreach t in array array['viajes','facturas','abonos','gastos'] loop
    execute format('create policy "miembros crean" on public.%I for insert to authenticated with check (public.es_miembro())', t);
    execute format('create policy "miembros editan" on public.%I for update to authenticated using (public.es_miembro()) with check (public.es_miembro())', t);
    execute format('create policy "admin borra" on public.%I for delete to authenticated using (public.es_admin())', t);
  end loop;

  -- Líneas de factura: los miembros también pueden quitarlas al corregir una factura
  foreach t in array array['items_factura','compras_tarjeta'] loop
    execute format('create policy "miembros crean" on public.%I for insert to authenticated with check (public.es_miembro())', t);
    execute format('create policy "miembros editan" on public.%I for update to authenticated using (public.es_miembro()) with check (public.es_miembro())', t);
    execute format('create policy "miembros borran" on public.%I for delete to authenticated using (public.es_miembro())', t);
  end loop;
end $$;

-- Lista de precios: solo el admin la cambia
create policy "admin crea"  on public.tarifas for insert to authenticated with check (public.es_admin());
create policy "admin edita" on public.tarifas for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin borra" on public.tarifas for delete to authenticated using (public.es_admin());

revoke all on public.tarifas, public.viajes, public.facturas, public.items_factura,
              public.compras_tarjeta, public.abonos, public.gastos from anon;

-- ---------- 10. Vistas con totales ----------------------------------
create view public.v_facturas with (security_invoker = true) as
select
  f.*,
  c.nombre   as cliente_nombre,
  c.telefono as cliente_telefono,
  v.nombre   as viaje_nombre,
  coalesce(i.total, 0)                          as total_servicio,   -- ganancia bruta
  coalesce(i.n, 0)::int                         as num_items,
  coalesce(t.total, 0)                          as total_tarjeta,    -- se devuelve, no es ganancia
  coalesce(i.total, 0) + coalesce(t.total, 0)   as total,
  coalesce(a.total, 0)                          as abonado,
  coalesce(i.total, 0) + coalesce(t.total, 0) - coalesce(a.total, 0) as saldo,
  case
    when coalesce(a.total, 0) <= 0 then 'pendiente'
    when coalesce(a.total, 0) < coalesce(i.total, 0) + coalesce(t.total, 0) then 'parcial'
    else 'pagado'
  end as estado_pago
from public.facturas f
join public.clientes c on c.id = f.cliente_id
join public.viajes   v on v.id = f.viaje_id
left join (select factura_id, sum(subtotal) total, count(*) n from public.items_factura group by 1) i on i.factura_id = f.id
left join (select factura_id, sum(monto) total from public.compras_tarjeta group by 1) t on t.factura_id = f.id
left join (select factura_id, sum(monto) total from public.abonos group by 1) a on a.factura_id = f.id;

create view public.v_clientes with (security_invoker = true) as
select
  c.*,
  count(f.id)::int                       as num_facturas,
  coalesce(sum(f.total), 0)              as total_cobrado,
  coalesce(sum(f.abonado), 0)            as total_abonado,
  coalesce(sum(greatest(f.saldo, 0)), 0) as saldo,
  max(f.creado_en)                       as ultima_factura
from public.clientes c
left join public.v_facturas f on f.cliente_id = c.id
group by c.id;

create view public.v_viajes with (security_invoker = true) as
select
  v.*,
  coalesce(f.n, 0)::int            as num_facturas,
  coalesce(f.entregadas, 0)::int   as num_entregadas,
  coalesce(f.servicio, 0)          as total_servicio,
  coalesce(f.tarjeta, 0)           as total_tarjeta,
  coalesce(f.total, 0)             as total_a_cobrar,
  coalesce(f.abonado, 0)           as total_abonado,
  coalesce(f.saldo, 0)             as por_cobrar,
  coalesce(g.total, 0)             as total_gastos,
  coalesce(f.servicio, 0) - coalesce(g.total, 0) as ganancia
from public.viajes v
left join (
  select viaje_id, count(*) n, count(*) filter (where entregada) entregadas,
         sum(total_servicio) servicio, sum(total_tarjeta) tarjeta, sum(total) total,
         sum(abonado) abonado, sum(greatest(saldo, 0)) saldo
  from public.v_facturas group by 1
) f on f.viaje_id = v.id
left join (select viaje_id, sum(monto) total from public.gastos group by 1) g on g.viaje_id = v.id;

-- ---------- 11. Guardar una factura completa de una sola vez --------
-- Recibe la factura con sus líneas y la guarda en una transacción:
-- o se guarda todo, o no se guarda nada. Respeta RLS (security invoker).
create or replace function public.guardar_factura(p_factura jsonb, p_items jsonb, p_compras jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid := nullif(p_factura ->> 'id', '')::uuid;
  v_item jsonb;
  v_compra jsonb;
  v_orden int := 0;
begin
  if not public.es_miembro() then
    raise exception 'No tienes permiso';
  end if;
  if coalesce(jsonb_array_length(p_items), 0) + coalesce(jsonb_array_length(p_compras), 0) = 0 then
    raise exception 'La factura debe tener al menos una línea';
  end if;

  if v_id is null then
    insert into facturas (viaje_id, cliente_id, notas)
    values ((p_factura ->> 'viaje_id')::uuid, (p_factura ->> 'cliente_id')::uuid, nullif(p_factura ->> 'notas', ''))
    returning id into v_id;
  else
    update facturas set
      viaje_id   = (p_factura ->> 'viaje_id')::uuid,
      cliente_id = (p_factura ->> 'cliente_id')::uuid,
      notas      = nullif(p_factura ->> 'notas', '')
    where id = v_id;
    if not found then raise exception 'La factura no existe'; end if;
    delete from items_factura   where factura_id = v_id;
    delete from compras_tarjeta where factura_id = v_id;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    v_orden := v_orden + 1;
    insert into items_factura (factura_id, tarifa_id, descripcion, modo, cantidad, precio_unitario, orden)
    values (v_id, nullif(v_item ->> 'tarifa_id', '')::uuid, v_item ->> 'descripcion',
            (v_item ->> 'modo')::modo_tarifa, (v_item ->> 'cantidad')::numeric,
            (v_item ->> 'precio_unitario')::numeric, v_orden);
  end loop;

  v_orden := 0;
  for v_compra in select * from jsonb_array_elements(coalesce(p_compras, '[]')) loop
    v_orden := v_orden + 1;
    insert into compras_tarjeta (factura_id, descripcion, monto, tarjeta_de, orden)
    values (v_id, v_compra ->> 'descripcion', (v_compra ->> 'monto')::numeric,
            (v_compra ->> 'tarjeta_de')::uuid, v_orden);
  end loop;

  return v_id;
end;
$$;
revoke execute on function public.guardar_factura(jsonb, jsonb, jsonb) from anon, public;
grant  execute on function public.guardar_factura(jsonb, jsonb, jsonb) to authenticated;
