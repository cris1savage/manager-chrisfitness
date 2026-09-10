-- Migración: añadir kcal_on (alias de kcal) y kcal_off a client_timeline_weeks
-- Ejecutar en Supabase SQL Editor

alter table public.client_timeline_weeks
  add column if not exists kcal_on numeric,
  add column if not exists kcal_off numeric;

-- Rellenar kcal_on con los valores existentes de kcal (retrocompatibilidad)
update public.client_timeline_weeks
set kcal_on = kcal
where kcal is not null and kcal_on is null;
