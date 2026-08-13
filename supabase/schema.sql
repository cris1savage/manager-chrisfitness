-- ============================================================================
-- CHRIS FITNESS · Panel de Control
-- Pega este archivo entero en Supabase > SQL Editor > New query > Run
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

-- Crea el perfil automáticamente en cuanto se crea el usuario en Supabase Auth
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
-- TABLAS DE NEGOCIO — cada fila guarda quién la creó (created_by)
-- ---------------------------------------------------------------------------
create table if not exists public.ad_spend (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  date date not null default current_date,
  campaign text,
  amount numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  date date not null default current_date,
  name text,
  source text,
  status text default 'Nuevo',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  date date not null default current_date,
  name text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  date date not null default current_date,
  name text,
  status text default 'Pendiente',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  date date not null default current_date,
  name text,
  result text default 'Neutral',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  date date not null default current_date,
  name text,
  program text,
  amount numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

-- Programa de recompensas: clientes que refieren a otros clientes
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  date date not null default current_date,
  referrer text,          -- cliente que refiere
  referred text,          -- persona nueva referida
  reward text,            -- ej. "1 mes gratis", "50€ descuento"
  status text default 'Pendiente', -- Pendiente / Entregada
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
  status text default 'Activo', -- Activo / Pausado / Finalizado
  notes text,
  created_at timestamptz not null default now()
);

-- Tareas semanales asignadas entre las dos cuentas
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  assigned_to uuid references auth.users(id),
  title text not null,
  due_date date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- Notas / comentarios colgados de cualquier registro (leads, conversaciones...)
-- entity_table = nombre de la tabla de origen, entity_id = id de esa fila
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  entity_table text not null,
  entity_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_entity_idx on public.comments (entity_table, entity_id);

create table if not exists public.calendar_entries (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  date date not null,
  type text not null default 'reel',
  title text not null,
  status text not null default 'pendiente',
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  title text not null,
  content text,
  created_at timestamptz not null default now()
);

create table if not exists public.goals (
  id int primary key default 1,
  leads_goal int not null default 40,
  sales_goal int not null default 6,
  ad_budget_monthly numeric not null default 250,
  revenue_goal numeric not null default 3000,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);
insert into public.goals (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- REGISTRO DE ACTIVIDAD
-- Se rellena solo mediante triggers, así queda constancia pase lo que pase
-- de qué se creó, editó o borró, quién lo hizo y cuándo.
-- ---------------------------------------------------------------------------
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  row_id uuid,
  action text not null, -- insert / update / delete
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
  foreach t in array array['leads','conversations','invites','calls','sales','ad_spend','referrals','content_ideas','active_clients','tasks','calendar_entries','notes']
  loop
    execute format('drop trigger if exists log_activity_trigger on public.%1$s;', t);
    execute format('create trigger log_activity_trigger after insert or update or delete on public.%1$s for each row execute function public.log_activity();', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- SEGURIDAD (Row Level Security)
-- Solo las cuentas invitadas (autenticadas) pueden leer/escribir.
-- No hay registro público: las cuentas se crean a mano desde Supabase.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.ad_spend enable row level security;
alter table public.leads enable row level security;
alter table public.conversations enable row level security;
alter table public.invites enable row level security;
alter table public.calls enable row level security;
alter table public.sales enable row level security;
alter table public.referrals enable row level security;
alter table public.content_ideas enable row level security;
alter table public.active_clients enable row level security;
alter table public.tasks enable row level security;
alter table public.comments enable row level security;
alter table public.calendar_entries enable row level security;
alter table public.notes enable row level security;
alter table public.goals enable row level security;
alter table public.activity_log enable row level security;

create policy "profiles_read_all_authenticated" on public.profiles for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "activity_log_read_authenticated" on public.activity_log for select to authenticated using (true);

do $$
declare
  t text;
begin
  foreach t in array array['ad_spend','leads','conversations','invites','calls','sales','referrals','content_ideas','active_clients','tasks','comments','calendar_entries','notes','goals']
  loop
    execute format('create policy "%1$s_full_access_authenticated" on public.%1$s for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime (opcional, para que los cambios se vean en vivo entre las dos cuentas)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.leads, public.conversations, public.invites, public.calls, public.sales, public.ad_spend, public.referrals, public.content_ideas, public.active_clients, public.tasks, public.comments, public.calendar_entries, public.notes, public.goals, public.activity_log;
