-- ============================================================================
-- CHRIS FITNESS · Panel de Control
-- Pega este archivo entero en Supabase > SQL Editor > New query > Run
-- Es seguro volver a pegarlo y ejecutarlo las veces que haga falta.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- PERFILES (uno por cada persona con acceso: tú y tu socia)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Usuario',
  role_title text not null default '',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, role_title)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role_title', '')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- CONTACTOS
-- Reemplaza lo que antes eran 5 tablas separadas (leads, conversaciones,
-- invitaciones, videollamadas, ventas). Ahora cada persona es UNA ficha que
-- se mueve por etapas con un desplegable, en vez de anotarla 5 veces.
-- ---------------------------------------------------------------------------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  name text not null,
  source text default 'Instagram',       -- Instagram / Referido / TusMacros / Otro
  stage text not null default 'Frío',    -- Frío / Contactado / Llamada agendada / Realizada / Cliente / Perdido
  program text,                          -- solo relevante en etapa Cliente
  amount numeric,                        -- solo relevante en etapa Cliente
  notes text,
  stage_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ANUNCIOS
-- Ahora se calcula solo: pones fecha de inicio + inversión diaria, y el
-- gasto acumulado se calcula automáticamente (días transcurridos × diario).
-- Al pausar, deja de sumar desde ese día.
--
-- IMPORTANTE: la estructura cambió por completo respecto a la versión
-- anterior, así que reseteamos la tabla (si ya tenías algo aquí, como estaba
-- a 0€ no se pierde nada real).
-- ---------------------------------------------------------------------------
drop table if exists public.ad_spend cascade;
create table public.ad_spend (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  campaign text not null,
  start_date date not null default current_date,
  daily_amount numeric not null default 0,
  status text not null default 'Activo', -- Activo / Pausado
  paused_at date,
  notes text,
  created_at timestamptz not null default now()
);

-- Programa de recompensas: clientes que refieren a otros clientes
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  date date not null default current_date,
  referrer text,
  referred text,
  reward text,
  status text default 'Pendiente',
  notes text,
  created_at timestamptz not null default now()
);

-- Banco de ideas de contenido (sin fecha, se arrastran al calendario)
create table if not exists public.content_ideas (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  title text not null,
  type text default 'reel',
  notes text,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

-- Clientes activos: seguimiento de coaching en curso y renovaciones
create table if not exists public.active_clients (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  name text not null,
  program text,
  start_date date,
  renewal_date date,
  status text default 'Activo',
  notes text,
  created_at timestamptz not null default now()
);

-- Tareas asignadas entre las dos cuentas
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  assigned_to uuid references auth.users(id),
  title text not null,
  due_date date,
  done boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.tasks add column if not exists completed_at timestamptz;

-- Notas / comentarios colgados de cualquier registro (contactos, etc.)
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  entity_table text not null,
  entity_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_entity_idx on public.comments (entity_table, entity_id);

-- Calendario de contenido: ahora con notas y más tipos (se controlan desde el frontend)
create table if not exists public.calendar_entries (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  date date not null,
  type text not null default 'reel',
  title text not null,
  notes text,
  status text not null default 'pendiente',
  created_at timestamptz not null default now()
);
alter table public.calendar_entries add column if not exists notes text;

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  title text not null,
  content text,
  created_at timestamptz not null default now()
);

-- Guiones: biblioteca de guiones para grabar, organizados por categoría/etiqueta
create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  title text not null,
  category text default 'General',
  content text,
  status text not null default 'Borrador', -- Borrador / Listo / Grabado
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Objetivos: lista personalizable en vez de 4 campos fijos.
-- metric: 'ventas' | 'clientes_nuevos' | 'facturacion' | 'inversion_ads' | 'manual'
-- Para 'manual', el progreso se edita a mano (manual_current); el resto se calcula solo.
--
-- IMPORTANTE: antes era una única fila fija con 4 columnas; ahora es una
-- lista de objetivos personalizables, así que reseteamos la tabla.
drop table if exists public.goals cascade;
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  title text not null,
  metric text not null default 'manual',
  period text not null default 'mensual', -- mensual / semanal
  target numeric not null default 0,
  manual_current numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- REGISTRO DE ACTIVIDAD
-- ---------------------------------------------------------------------------
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  row_id uuid,
  action text not null,
  summary text,
  actor uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create or replace function public.log_activity()
returns trigger as $$
declare
  label text;
begin
  if TG_OP = 'DELETE' then
    label := coalesce(to_jsonb(OLD)->>'name', to_jsonb(OLD)->>'title', to_jsonb(OLD)->>'campaign', to_jsonb(OLD)->>'referrer', '');
    insert into public.activity_log (table_name, row_id, action, summary, actor)
    values (TG_TABLE_NAME, OLD.id, 'delete', label, auth.uid());
    return OLD;
  else
    label := coalesce(to_jsonb(NEW)->>'name', to_jsonb(NEW)->>'title', to_jsonb(NEW)->>'campaign', to_jsonb(NEW)->>'referrer', '');
    insert into public.activity_log (table_name, row_id, action, summary, actor)
    values (TG_TABLE_NAME, NEW.id, lower(TG_OP), label, auth.uid());
    return NEW;
  end if;
end;
$$ language plpgsql security definer;

do $$
declare
  t text;
begin
  foreach t in array array['contacts','ad_spend','referrals','content_ideas','active_clients','tasks','calendar_entries','notes','scripts']
  loop
    execute format('drop trigger if exists log_activity_trigger on public.%1$s;', t);
    execute format('create trigger log_activity_trigger after insert or update or delete on public.%1$s for each row execute function public.log_activity();', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- SEGURIDAD (Row Level Security)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.ad_spend enable row level security;
alter table public.referrals enable row level security;
alter table public.content_ideas enable row level security;
alter table public.active_clients enable row level security;
alter table public.tasks enable row level security;
alter table public.comments enable row level security;
alter table public.calendar_entries enable row level security;
alter table public.notes enable row level security;
alter table public.scripts enable row level security;
alter table public.goals enable row level security;
alter table public.activity_log enable row level security;

drop policy if exists "profiles_read_all_authenticated" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "activity_log_read_authenticated" on public.activity_log;

create policy "profiles_read_all_authenticated" on public.profiles for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "activity_log_read_authenticated" on public.activity_log for select to authenticated using (true);

do $$
declare
  t text;
begin
  foreach t in array array['contacts','ad_spend','referrals','content_ideas','active_clients','tasks','comments','calendar_entries','notes','scripts','goals']
  loop
    execute format('drop policy if exists "%1$s_full_access_authenticated" on public.%1$s;', t);
    execute format('create policy "%1$s_full_access_authenticated" on public.%1$s for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.contacts, public.ad_spend, public.referrals, public.content_ideas, public.active_clients, public.tasks, public.comments, public.calendar_entries, public.notes, public.scripts, public.goals, public.activity_log;
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- LIMPIEZA OPCIONAL
-- Las tablas antiguas (leads, conversations, invites, calls, sales) ya no las
-- usa la app. Si NO tienes datos importantes ahí, puedes borrarlas con esto
-- (opcional, no es necesario para que la app funcione):
-- ---------------------------------------------------------------------------
-- drop table if exists public.leads, public.conversations, public.invites, public.calls, public.sales cascade;
