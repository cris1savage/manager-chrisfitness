-- ============================================================
-- Migración para CF Clientes
-- Ejecutar en Supabase SQL Editor antes de desplegar
-- ============================================================

-- 1. Métricas de seguimiento por cliente (compromiso, nivel entrenos, pasos, adherencia)
alter table public.active_clients
  add column if not exists tracking_metrics jsonb default '{}';

-- 2. Kcal ON / OFF en el timeline semanal
alter table public.client_timeline_weeks
  add column if not exists kcal_on  numeric,
  add column if not exists kcal_off numeric;

-- Retrocompatibilidad: copiar kcal existente a kcal_on
update public.client_timeline_weeks
set kcal_on = kcal
where kcal is not null and kcal_on is null;

-- 3. Token de lectura pública por cliente (para el enlace sin login)
alter table public.active_clients
  add column if not exists read_token text;

-- Generar tokens para clientes existentes (basado en el id)
update public.active_clients
set read_token = substring(replace(id::text, '-', ''), 1, 8) || substring(replace(id::text, '-', ''), 29, 4)
where read_token is null;

-- Política de lectura pública para la ruta /ver/:token
-- Permite leer activos y sus checkins a cualquiera que tenga el token
-- (Las políticas RLS actuales ya permiten lectura autenticada; esto añade lectura anon por token)

-- ============================================================
-- 4. Nuevas columnas: guion de llamada + nivel de entrenamiento/nutrición
-- ============================================================
alter table public.client_checkins
  add column if not exists call_notes      text,
  add column if not exists training_level  text,
  add column if not exists nutrition_level text;

-- Nota: weekly_notes ya es jsonb, así que los nuevos campos por semana
-- (steps, kcal_avg, adherence) no requieren migración de columnas.
