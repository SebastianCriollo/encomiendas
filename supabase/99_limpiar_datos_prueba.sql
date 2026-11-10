-- =====================================================================
--  ENCOMIENDAS — Borrar los datos de prueba (NO SE PUEDE DESHACER)
--
--  Borra: clientes, viajes, facturas (con artículos y compras con
--  tarjeta), abonos, gastos, pagos a socios, participantes de viajes
--  y el historial de cambios. La numeración de facturas vuelve a #0001.
--
--  Conserva: usuarios/socios, lista de precios y datos del negocio.
--
--  Ejecutar en: Supabase > SQL Editor > New query > Run
-- =====================================================================

truncate table
  public.abonos,
  public.compras_tarjeta,
  public.items_factura,
  public.facturas,
  public.gastos,
  public.pagos_socios,
  public.participantes_viaje,
  public.viajes,
  public.clientes,
  public.historial
restart identity;

-- Comprobación: todo debe salir en 0
select
  (select count(*) from public.clientes)  as clientes,
  (select count(*) from public.viajes)    as viajes,
  (select count(*) from public.facturas)  as facturas,
  (select count(*) from public.gastos)    as gastos,
  (select count(*) from public.perfiles)  as usuarios_conservados,
  (select count(*) from public.tarifas)   as precios_conservados;
