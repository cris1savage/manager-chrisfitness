-- ============================================================
-- CF Clientes — Tablas propias independientes del manager
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Tabla de clientes propia
create table if not exists public.tracking_clients (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  program         text,
  start_date      date,
  duration        text,
  status          text default 'Activo',
  phases          jsonb default '[]',
  long_term_goal  text,
  notes           text,
  tracking_metrics jsonb default '{}',
  read_token      text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- 2. Tabla de checkins mensuales propia
create table if not exists public.tracking_checkins (
  id                uuid primary key default gen_random_uuid(),
  tracking_client_id uuid references public.tracking_clients(id) on delete cascade,
  month             text not null,
  weight            numeric,
  phase             text,
  goals             text,
  goal_status       text,
  training_notes    text,
  nutrition_notes   text,
  training_level    text,
  nutrition_level   text,
  weekly_notes      jsonb default '[]',
  measurements      jsonb default '{}',
  steps_avg         numeric,
  call_date         date,
  call_done         boolean default false,
  call_notes        text,
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- 3. Tabla de timeline semanal propia
create table if not exists public.tracking_timeline_weeks (
  id                  uuid primary key default gen_random_uuid(),
  tracking_client_id  uuid references public.tracking_clients(id) on delete cascade,
  week_start          date not null,
  kcal                numeric,
  kcal_on             numeric,
  kcal_off            numeric,
  target_weight       numeric,
  target_overridden   boolean default false,
  real_weight         numeric,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  unique (tracking_client_id, week_start)
);

-- 4. RLS — solo usuarios autenticados
alter table public.tracking_clients enable row level security;
alter table public.tracking_checkins enable row level security;
alter table public.tracking_timeline_weeks enable row level security;

drop policy if exists "tracking_clients_auth" on public.tracking_clients;
drop policy if exists "tracking_checkins_auth" on public.tracking_checkins;
drop policy if exists "tracking_timeline_weeks_auth" on public.tracking_timeline_weeks;

create policy "tracking_clients_auth"
  on public.tracking_clients for all to authenticated
  using (true) with check (true);

create policy "tracking_checkins_auth"
  on public.tracking_checkins for all to authenticated
  using (true) with check (true);

create policy "tracking_timeline_weeks_auth"
  on public.tracking_timeline_weeks for all to authenticated
  using (true) with check (true);

-- 5. Política lectura pública por token (para /ver/:token)
drop policy if exists "tracking_clients_public_read" on public.tracking_clients;
create policy "tracking_clients_public_read"
  on public.tracking_clients for select to anon
  using (read_token is not null);

drop policy if exists "tracking_checkins_public_read" on public.tracking_checkins;
create policy "tracking_checkins_public_read"
  on public.tracking_checkins for select to anon
  using (true);

-- 6. Generar read_token para clientes existentes
-- (si migras clientes a mano, este update los cubrirá)
update public.tracking_clients
set read_token = substring(replace(id::text, '-', ''), 1, 8) || substring(replace(id::text, '-', ''), 29, 4)
where read_token is null;

-- ============================================================
-- OPCIONAL: Migrar clientes existentes de active_clients
-- Descomenta si quieres copiar los clientes del manager
-- ============================================================
-- insert into public.tracking_clients (id, name, program, start_date, duration, status, phases, long_term_goal, notes, tracking_metrics, read_token)
-- select id, name, program, start_date, duration, status, phases, long_term_goal, notes, tracking_metrics, read_token
-- from public.active_clients;
--
-- insert into public.tracking_checkins (tracking_client_id, month, weight, phase, goals, goal_status, training_notes, nutrition_notes, training_level, nutrition_level, weekly_notes, measurements, steps_avg, call_date, call_done, call_notes, notes)
-- select active_client_id, month, weight, phase, goals, goal_status, training_notes, nutrition_notes, training_level, nutrition_level, weekly_notes, measurements, steps_avg, call_date, call_done, call_notes, notes
-- from public.client_checkins;
--
-- insert into public.tracking_timeline_weeks (tracking_client_id, week_start, kcal, kcal_on, kcal_off, target_weight, target_overridden, real_weight)
-- select active_client_id, week_start, kcal, kcal_on, kcal_off, target_weight, target_overridden, real_weight
-- from public.client_timeline_weeks;

-- ============================================================
-- PARCHE: Políticas de lectura pública para subtablas
-- Ejecutar si el enlace /ver/:token da error
-- ============================================================

-- Lectura pública de checkins (para el enlace del cliente)
drop policy if exists "tracking_checkins_public_read" on public.tracking_checkins;
create policy "tracking_checkins_public_read"
  on public.tracking_checkins for select to anon
  using (
    exists (
      select 1 from public.tracking_clients tc
      where tc.id = tracking_checkins.tracking_client_id
      and tc.read_token is not null
    )
  );

-- Lectura pública de timeline (para el enlace del cliente)
drop policy if exists "tracking_timeline_public_read" on public.tracking_timeline_weeks;
create policy "tracking_timeline_public_read"
  on public.tracking_timeline_weeks for select to anon
  using (
    exists (
      select 1 from public.tracking_clients tc
      where tc.id = tracking_timeline_weeks.tracking_client_id
      and tc.read_token is not null
    )
  );
