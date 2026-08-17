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
-- MEJORAS: vídeos de guion en el calendario + cliente activo automático
-- ---------------------------------------------------------------------------

-- Un "vídeo" dentro de un guion es, en realidad, una entrada normal del
-- calendario que además apunta al guion del que viene. Así, al marcarla
-- como subida en el Calendario, cuenta igual en Resumen semanal.
alter table public.calendar_entries add column if not exists script_id uuid references public.scripts(id) on delete set null;

-- Vincula cada cliente activo con el contacto del que viene, para no
-- duplicar la ficha si el contacto cambia de etapa varias veces.
alter table public.active_clients add column if not exists contact_id uuid references public.contacts(id) on delete set null;
create unique index if not exists active_clients_contact_unique on public.active_clients (contact_id) where contact_id is not null;

-- Cuando un contacto pasa a la etapa "Cliente", se crea su ficha en
-- Clientes activos automáticamente (si no existía ya para ese contacto).
create or replace function public.contact_became_client()
returns trigger as $$
begin
  if NEW.stage = 'Cliente' and (TG_OP = 'INSERT' or OLD.stage is distinct from 'Cliente') then
    insert into public.active_clients (name, program, start_date, status, contact_id, created_by)
    values (NEW.name, NEW.program, current_date, 'Activo', NEW.id, NEW.created_by)
    on conflict (contact_id) where contact_id is not null do nothing;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists contact_became_client_trigger on public.contacts;
create trigger contact_became_client_trigger
  after insert or update on public.contacts
  for each row execute procedure public.contact_became_client();

-- Backfill retroactivo: si ya tenías contactos marcados como "Cliente"
-- ANTES de que existiera este disparador, no se habían creado en Clientes
-- activos. Esto los captura, sin duplicar a los que ya tienen ficha.
insert into public.active_clients (name, program, start_date, status, contact_id, created_by)
select c.name, c.program, coalesce(c.stage_updated_at::date, current_date), 'Activo', c.id, c.created_by
from public.contacts c
where c.stage = 'Cliente'
  and not exists (select 1 from public.active_clients ac where ac.contact_id = c.id);

-- ---------------------------------------------------------------------------
-- RENOVACIÓN AUTOMÁTICA
-- En vez de escribir la fecha de renovación a mano, eliges una duración
-- (mensual, 3 meses, 6 meses, anual) y se calcula sola a partir del inicio.
-- ---------------------------------------------------------------------------
alter table public.active_clients add column if not exists duration text default 'Personalizada';

-- ---------------------------------------------------------------------------
-- PLANTILLAS DE MENSAJES
-- Respuestas que se copian y pegan (primer contacto, seguimiento, post-llamada).
-- ---------------------------------------------------------------------------
create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  title text not null,
  category text default 'General',
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.message_templates enable row level security;
drop policy if exists "message_templates_full_access_authenticated" on public.message_templates;
create policy "message_templates_full_access_authenticated" on public.message_templates for all to authenticated using (true) with check (true);

drop trigger if exists log_activity_trigger on public.message_templates;
create trigger log_activity_trigger after insert or update or delete on public.message_templates for each row execute function public.log_activity();

do $$
begin
  alter publication supabase_realtime add table public.message_templates;
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- NOTIFICACIONES
-- Hora concreta en las tareas + suscripciones push por cuenta.
-- ---------------------------------------------------------------------------
alter table public.tasks add column if not exists due_time time;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_subscriptions_own_access" on public.push_subscriptions;
create policy "push_subscriptions_own_access" on public.push_subscriptions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- ESTADO DE PRODUCCIÓN DE VÍDEOS (dentro de Guiones)
-- Guion -> Grabado -> Editado -> Programado. Independiente del "subido/
-- pendiente" del Calendario, que sigue midiendo si ya está publicado.
-- ---------------------------------------------------------------------------
alter table public.calendar_entries add column if not exists production_status text default 'Guion';

-- ---------------------------------------------------------------------------
-- CANAL
-- Un chat sencillo entre las dos cuentas para cosas puntuales (enlaces,
-- avisos rápidos) sin depender de WhatsApp.
-- ---------------------------------------------------------------------------
create table if not exists public.channel_messages (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.channel_messages enable row level security;
drop policy if exists "channel_messages_full_access_authenticated" on public.channel_messages;
create policy "channel_messages_full_access_authenticated" on public.channel_messages for all to authenticated using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table public.channel_messages;
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- VÍDEOS (independiente del Calendario)
-- Antes, un "vídeo" dentro de un guion era en realidad una fila del
-- Calendario, así que aparecía ahí sin querer. Ahora vive en su propia
-- tabla: se puede añadir desde un guion o suelto, y NUNCA toca el
-- Calendario a menos que tú añadas algo allí aparte a mano.
-- ---------------------------------------------------------------------------
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  script_id uuid references public.scripts(id) on delete set null,
  title text not null,
  type text default 'reel_ig',
  production_status text not null default 'Guion', -- Guion / Grabado / Editado / Programado
  date date,
  notes text,
  uploaded boolean not null default false,
  uploaded_at timestamptz,
  source_calendar_entry_id uuid, -- solo interno, para la migración de abajo
  created_at timestamptz not null default now()
);
alter table public.videos enable row level security;
drop policy if exists "videos_full_access_authenticated" on public.videos;
create policy "videos_full_access_authenticated" on public.videos for all to authenticated using (true) with check (true);

drop trigger if exists log_activity_trigger on public.videos;
create trigger log_activity_trigger after insert or update or delete on public.videos for each row execute function public.log_activity();

do $$
begin
  alter publication supabase_realtime add table public.videos;
exception
  when duplicate_object then null;
end $$;

-- Enlace opcional a la entrada del Calendario, cuando programas el vídeo a
-- mano desde el panel de Vídeos (una vez está Editado o Programado).
alter table public.videos add column if not exists calendar_entry_id uuid references public.calendar_entries(id) on delete set null;

-- ---------------------------------------------------------------------------
-- CATEGORÍAS DE CONTENIDO (editables)
-- Antes eran 4 fijas en el código (Reel/Historia/Video/TikTok). Ahora se
-- pueden añadir, editar el color, o borrar, y se usan igual en Calendario,
-- Guiones y Vídeos. Se guardan aquí los 4 valores de siempre para que nada
-- de lo ya creado se rompa.
-- ---------------------------------------------------------------------------
create table if not exists public.content_categories (
  id text primary key,
  created_by uuid references auth.users(id) default auth.uid(),
  label text not null,
  color text not null default '#5ECCFA',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
insert into public.content_categories (id, label, color, sort_order) values
  ('reel_ig', 'Reel Instagram', '#4ADE80', 1),
  ('historia_ig', 'Historia Instagram', '#FBBF24', 2),
  ('video_youtube', 'Video YouTube', '#5ECCFA', 3),
  ('tiktok', 'TikTok', '#F87171', 4)
on conflict (id) do nothing;

alter table public.content_categories enable row level security;
drop policy if exists "content_categories_full_access_authenticated" on public.content_categories;
create policy "content_categories_full_access_authenticated" on public.content_categories for all to authenticated using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table public.content_categories;
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- TAREAS REPETITIVAS
-- Reglas que generan tareas solas cada día (el aviso diario ya programado
-- se encarga de crearlas): diaria, semanal (un día de la semana) o mensual
-- (un día del mes).
-- ---------------------------------------------------------------------------
create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  assigned_to uuid references auth.users(id),
  title text not null,
  recurrence_type text not null, -- 'daily' | 'weekly' | 'monthly'
  recurrence_day int, -- semanal: 0=domingo..6=sábado (getDay JS). mensual: 1-31
  due_time time,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.task_templates enable row level security;
drop policy if exists "task_templates_full_access_authenticated" on public.task_templates;
create policy "task_templates_full_access_authenticated" on public.task_templates for all to authenticated using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table public.task_templates;
exception
  when duplicate_object then null;
end $$;

alter table public.tasks add column if not exists template_id uuid references public.task_templates(id) on delete set null;

-- Migración única: rescata los vídeos que ya tenías creados como filas del
-- Calendario (con script_id) y los copia aquí. No los borra del Calendario
-- ni los duplica si vuelves a pegar este archivo.
insert into public.videos (created_by, script_id, title, type, production_status, date, notes, uploaded, uploaded_at, source_calendar_entry_id, calendar_entry_id, created_at)
select ce.created_by, ce.script_id, ce.title, ce.type, coalesce(ce.production_status, 'Guion'), ce.date, ce.notes,
       (ce.status = 'hecho'), case when ce.status = 'hecho' then ce.created_at else null end, ce.id, ce.id, ce.created_at
from public.calendar_entries ce
where ce.script_id is not null
  and not exists (select 1 from public.videos v where v.source_calendar_entry_id = ce.id);

-- ---------------------------------------------------------------------------
-- LIMPIEZA OPCIONAL
-- Las tablas antiguas (leads, conversations, invites, calls, sales) ya no las
-- usa la app. Si NO tienes datos importantes ahí, puedes borrarlas con esto
-- (opcional, no es necesario para que la app funcione):
-- ---------------------------------------------------------------------------
-- drop table if exists public.leads, public.conversations, public.invites, public.calls, public.sales cascade;
