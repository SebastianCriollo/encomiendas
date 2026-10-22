-- =====================================================================
--  ENCOMIENDAS — Esquema de base de datos (Etapa 1)
--  Ejecutar completo en: Supabase > SQL Editor > New query > Run
--  Es seguro ejecutarlo una sola vez en un proyecto nuevo.
-- =====================================================================

-- ---------- Tipos ----------------------------------------------------
create type public.rol_usuario     as enum ('admin', 'socio');
create type public.estado_envio    as enum ('pedido', 'en_camino', 'en_ecuador', 'entregado');
create type public.categoria_gasto as enum ('flete', 'impuestos', 'transporte_local', 'otros');

-- ---------- Usuarios del negocio ------------------------------------
-- Una fila por cada usuario de Supabase Auth.
create table public.perfiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  nombre              text not null,
  email               text,
  rol                 public.rol_usuario not null default 'socio',
  porcentaje_ganancia numeric(5,2) not null default 50
                      check (porcentaje_ganancia between 0 and 100),
  activo              boolean not null default true,
  creado_en           timestamptz not null default now()
);

-- ---------- Clientes -------------------------------------------------
create table public.clientes (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null check (length(trim(nombre)) > 0),
  telefono       text,
  ciudad         text,
  notas          text,
  creado_por     uuid references public.perfiles (id) default auth.uid(),
  creado_en      timestamptz not null default now(),
  modificado_por uuid references public.perfiles (id),
  modificado_en  timestamptz not null default now()
);

-- ---------- Encomiendas ----------------------------------------------
create table public.encomiendas (
  id             uuid primary key default gen_random_uuid(),
  numero         serial unique,                 -- se muestra como #0001
  cliente_id     uuid not null references public.clientes (id) on delete restrict,
  descripcion    text not null,
  tracking       text,
  costo_compra   numeric(10,2) not null default 0 check (costo_compra >= 0),
  peso_lb        numeric(8,2)  check (peso_lb >= 0),
  flete          numeric(10,2) not null default 0 check (flete >= 0),
  impuestos      numeric(10,2) not null default 0 check (impuestos >= 0),
  precio_cobrado numeric(10,2) not null default 0 check (precio_cobrado >= 0),
  estado         public.estado_envio not null default 'pedido',
  fecha_pedido   date not null default current_date,
  fecha_entrega  date,
  notas          text,
  creado_por     uuid references public.perfiles (id) default auth.uid(),
  creado_en      timestamptz not null default now(),
  modificado_por uuid references public.perfiles (id),
  modificado_en  timestamptz not null default now()
);
create index on public.encomiendas (cliente_id);
create index on public.encomiendas (fecha_pedido);

-- ---------- Abonos (pagos del cliente) ------------------------------
create table public.abonos (
  id             uuid primary key default gen_random_uuid(),
  encomienda_id  uuid not null references public.encomiendas (id) on delete cascade,
  monto          numeric(10,2) not null check (monto > 0),
  fecha          date not null default current_date,
  metodo         text not null default 'efectivo',
  recibido_por   uuid references public.perfiles (id) default auth.uid(),
  creado_por     uuid references public.perfiles (id) default auth.uid(),
  creado_en      timestamptz not null default now(),
  modificado_por uuid references public.perfiles (id),
  modificado_en  timestamptz not null default now()
);
create index on public.abonos (encomienda_id);

-- ---------- Gastos ---------------------------------------------------
create table public.gastos (
  id             uuid primary key default gen_random_uuid(),
  encomienda_id  uuid references public.encomiendas (id) on delete set null, -- null = gasto general
  categoria      public.categoria_gasto not null,
  monto          numeric(10,2) not null check (monto > 0),
  fecha          date not null default current_date,
  descripcion    text,
  creado_por     uuid references public.perfiles (id) default auth.uid(),
  creado_en      timestamptz not null default now(),
  modificado_por uuid references public.perfiles (id),
  modificado_en  timestamptz not null default now()
);
create index on public.gastos (encomienda_id);
create index on public.gastos (fecha);

-- ---------- Pagos a socios ------------------------------------------
create table public.pagos_socios (
  id             uuid primary key default gen_random_uuid(),
  socio_id       uuid not null references public.perfiles (id),
  monto          numeric(10,2) not null check (monto > 0),
  fecha          date not null default current_date,
  periodo        date not null,   -- primer día del mes al que corresponde
  notas          text,
  creado_por     uuid references public.perfiles (id) default auth.uid(),
  creado_en      timestamptz not null default now(),
  modificado_por uuid references public.perfiles (id),
  modificado_en  timestamptz not null default now()
);

-- ---------- Configuración del negocio (una sola fila) ---------------
create table public.configuracion (
  id              int primary key default 1 check (id = 1),
  nombre_negocio  text not null default 'Mi negocio de encomiendas',
  telefono        text,
  mensaje_recibo  text default 'Gracias por tu compra.',
  tarifa_lb       numeric(8,2) default 0,      -- flete sugerido por libra
  logo_url        text
);
insert into public.configuracion (id) values (1);

-- ---------- Historial (bitácora de cambios) -------------------------
create table public.historial (
  id            bigserial primary key,
  tabla         text not null,
  registro_id   text,
  accion        text not null,          -- INSERT / UPDATE / DELETE
  datos_antes   jsonb,
  datos_despues jsonb,
  usuario_id    uuid default auth.uid(),
  fecha         timestamptz not null default now()
);
create index on public.historial (tabla, registro_id);

-- =====================================================================
--  FUNCIONES DE APOYO
-- =====================================================================

-- ¿El usuario actual pertenece al negocio (perfil activo)?
create or replace function public.es_miembro()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and activo);
$$;

-- ¿El usuario actual es admin activo?
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and activo and rol = 'admin');
$$;

-- Al crear un usuario en Auth se crea su perfil.
-- El PRIMER usuario del sistema queda como admin automáticamente.
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre, email, rol)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), split_part(new.email, '@', 1)),
    new.email,
    case when exists (select 1 from public.perfiles) then 'socio' else 'admin' end::public.rol_usuario
  );
  return new;
end;
$$;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();

-- Llena creado_por / modificado_por / modificado_en automáticamente.
create or replace function public.poner_auditoria()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.creado_por := coalesce(auth.uid(), new.creado_por);
    new.creado_en  := now();
  else
    new.creado_por := old.creado_por;   -- no se puede cambiar quién lo creó
    new.creado_en  := old.creado_en;
  end if;
  new.modificado_por := auth.uid();
  new.modificado_en  := now();
  return new;
end;
$$;

-- Guarda una copia de cada cambio en historial.
create or replace function public.registrar_historial()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.historial (tabla, registro_id, accion, datos_antes, datos_despues, usuario_id)
  values (
    tg_table_name,
    coalesce(new.id, old.id)::text,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;

-- Evita que el negocio se quede sin ningún admin activo.
create or replace function public.proteger_ultimo_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.rol = 'admin' and old.activo
     and (new.rol <> 'admin' or not new.activo)
     and not exists (select 1 from public.perfiles
                     where rol = 'admin' and activo and id <> old.id) then
    raise exception 'Debe quedar al menos un administrador activo';
  end if;
  return new;
end;
$$;
create trigger proteger_ultimo_admin
  before update on public.perfiles
  for each row execute function public.proteger_ultimo_admin();

-- Aplicar auditoría + historial a las tablas del negocio
do $$
declare t text;
begin
  foreach t in array array['clientes','encomiendas','abonos','gastos','pagos_socios'] loop
    execute format('create trigger auditoria before insert or update on public.%I
                    for each row execute function public.poner_auditoria()', t);
    execute format('create trigger historial after insert or update or delete on public.%I
                    for each row execute function public.registrar_historial()', t);
  end loop;
end $$;

create trigger historial after insert or update or delete on public.perfiles
  for each row execute function public.registrar_historial();
create trigger historial after update on public.configuracion
  for each row execute function public.registrar_historial();

-- =====================================================================
--  VISTA: encomiendas con totales calculados
-- =====================================================================
create view public.v_encomiendas with (security_invoker = true) as
select
  e.*,
  c.nombre                                                    as cliente_nombre,
  coalesce(a.total, 0)                                        as abonado,
  e.precio_cobrado - coalesce(a.total, 0)                     as saldo,
  e.costo_compra + e.flete + e.impuestos + coalesce(g.total, 0) as costo_total,
  e.precio_cobrado - (e.costo_compra + e.flete + e.impuestos + coalesce(g.total, 0)) as ganancia,
  case
    when coalesce(a.total, 0) <= 0                then 'pendiente'
    when coalesce(a.total, 0) < e.precio_cobrado  then 'parcial'
    else 'pagado'
  end                                                         as estado_pago
from public.encomiendas e
join public.clientes c on c.id = e.cliente_id
left join (select encomienda_id, sum(monto) total from public.abonos group by 1) a
       on a.encomienda_id = e.id
left join (select encomienda_id, sum(monto) total from public.gastos
           where encomienda_id is not null group by 1) g
       on g.encomienda_id = e.id;

-- =====================================================================
--  SEGURIDAD: Row Level Security en TODAS las tablas
-- =====================================================================
alter table public.perfiles      enable row level security;
alter table public.clientes      enable row level security;
alter table public.encomiendas   enable row level security;
alter table public.abonos        enable row level security;
alter table public.gastos        enable row level security;
alter table public.pagos_socios  enable row level security;
alter table public.configuracion enable row level security;
alter table public.historial     enable row level security;

-- Tablas operativas: miembros leen, crean y editan; solo admin borra
do $$
declare t text;
begin
  foreach t in array array['clientes','encomiendas','abonos','gastos'] loop
    execute format('create policy "miembros leen" on public.%I for select to authenticated using (public.es_miembro())', t);
    execute format('create policy "miembros crean" on public.%I for insert to authenticated with check (public.es_miembro())', t);
    execute format('create policy "miembros editan" on public.%I for update to authenticated using (public.es_miembro()) with check (public.es_miembro())', t);
    execute format('create policy "admin borra" on public.%I for delete to authenticated using (public.es_admin())', t);
  end loop;

  -- Tablas sensibles: miembros leen; solo admin escribe
  foreach t in array array['perfiles','pagos_socios','configuracion'] loop
    execute format('create policy "miembros leen" on public.%I for select to authenticated using (public.es_miembro())', t);
    execute format('create policy "admin crea" on public.%I for insert to authenticated with check (public.es_admin())', t);
    execute format('create policy "admin edita" on public.%I for update to authenticated using (public.es_admin()) with check (public.es_admin())', t);
    execute format('create policy "admin borra" on public.%I for delete to authenticated using (public.es_admin())', t);
  end loop;
end $$;

-- Historial: solo el admin lo lee; nadie lo escribe directamente (lo hace el trigger)
create policy "admin lee historial" on public.historial
  for select to authenticated using (public.es_admin());

-- El rol anónimo (sin sesión) no tiene acceso a nada
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;
