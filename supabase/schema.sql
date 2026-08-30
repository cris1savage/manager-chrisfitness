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
$$ language plpgsql security definer set search_path = public;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

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
-- ---------------------------------------------------------------------------
create table if not exists public.ad_spend (
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
create table if not exists public.goals (
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
$$ language plpgsql security definer set search_path = public;
revoke execute on function public.log_activity() from public, anon, authenticated;

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
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id);
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
$$ language plpgsql security definer set search_path = public;
revoke execute on function public.contact_became_client() from public, anon, authenticated;

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
create policy "push_subscriptions_own_access" on public.push_subscriptions for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

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
-- ATRIBUCIÓN DE ANUNCIOS
-- Cada anuncio tiene un objetivo (Visitas/Mensajes/Web...), y cada contacto
-- puede venir de uno en concreto — así el ROI se calcula por campaña real,
-- no solo mezclado en un total del mes.
-- ---------------------------------------------------------------------------
alter table public.ad_spend add column if not exists objective text default 'Visitas';
alter table public.contacts add column if not exists source_ad_id uuid references public.ad_spend(id) on delete set null;

-- ---------------------------------------------------------------------------
-- DOCUMENTOS
-- Almacén de archivos privado (PDFs y demás) con visor dentro de la web.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;

drop policy if exists "documents_bucket_select" on storage.objects;
create policy "documents_bucket_select" on storage.objects for select to authenticated using (bucket_id = 'documents');
drop policy if exists "documents_bucket_insert" on storage.objects;
create policy "documents_bucket_insert" on storage.objects for insert to authenticated with check (bucket_id = 'documents');
drop policy if exists "documents_bucket_delete" on storage.objects;
create policy "documents_bucket_delete" on storage.objects for delete to authenticated using (bucket_id = 'documents');

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) default auth.uid(),
  name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  category text default 'General',
  created_at timestamptz not null default now()
);
alter table public.documents enable row level security;
drop policy if exists "documents_full_access_authenticated" on public.documents;
create policy "documents_full_access_authenticated" on public.documents for all to authenticated using (true) with check (true);

drop trigger if exists log_activity_trigger on public.documents;
create trigger log_activity_trigger after insert or update or delete on public.documents for each row execute function public.log_activity();

do $$
begin
  alter publication supabase_realtime add table public.documents;
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- RENDIMIENTO REAL DE ANUNCIOS (manual)
-- Copias estos 3 datos desde Meta Ads Manager de vez en cuando; no se
-- calculan solos porque no hay conexión directa con Meta.
-- ---------------------------------------------------------------------------
alter table public.ad_spend add column if not exists impressions bigint;
alter table public.ad_spend add column if not exists clicks bigint;
alter table public.ad_spend add column if not exists ctr numeric;

-- ---------------------------------------------------------------------------
-- HISTORIAL MENSUAL
-- Una fila por mes con los números clave (gasto en ads, altas, ventas,
-- facturación, contenido subido, tareas cumplidas). El aviso diario ya
-- programado actualiza el mes en curso cada día; en cuanto cambia de mes,
-- esa fila queda congelada como historial — nunca se reescribe sola.
-- ---------------------------------------------------------------------------
create table if not exists public.monthly_history (
  month text primary key, -- 'YYYY-MM'
  ad_spend numeric not null default 0,
  new_contacts int not null default 0,
  new_clients int not null default 0,
  churned_clients int not null default 0,
  revenue numeric not null default 0,
  active_clients_count int,
  content_uploaded int not null default 0,
  tasks_completed int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.monthly_history add column if not exists churned_clients int not null default 0;
alter table public.monthly_history enable row level security;
drop policy if exists "monthly_history_full_access_authenticated" on public.monthly_history;
create policy "monthly_history_full_access_authenticated" on public.monthly_history for all to authenticated using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table public.monthly_history;
exception
  when duplicate_object then null;
end $$;

-- Relleno único de los últimos 12 meses con datos reales ya existentes
-- (gasto en ads reconstruido por solape de fechas, altas/ventas/contenido/
-- tareas por su fecha real). No se pierde nada al volver a pegar esto: solo
-- rellena meses que todavía no tengan fila (on conflict do nothing).
insert into public.monthly_history (month, ad_spend, new_contacts, new_clients, revenue, content_uploaded, tasks_completed)
select
  to_char(m, 'YYYY-MM'),
  coalesce((
    select sum(greatest(0, (least(coalesce(a.paused_at, current_date), (m + interval '1 month - 1 day')::date) - greatest(a.start_date, m::date) + 1)) * a.daily_amount)
    from public.ad_spend a
    where a.start_date <= (m + interval '1 month - 1 day')::date
      and coalesce(a.paused_at, current_date) >= m::date
  ), 0),
  (select count(*) from public.contacts c where c.created_at >= m and c.created_at < (m + interval '1 month')),
  (select count(*) from public.contacts c where c.stage = 'Cliente' and c.stage_updated_at >= m and c.stage_updated_at < (m + interval '1 month')),
  coalesce((select sum(c.amount) from public.contacts c where c.stage = 'Cliente' and c.stage_updated_at >= m and c.stage_updated_at < (m + interval '1 month')), 0),
  coalesce((select count(*) from public.calendar_entries ce where ce.status = 'hecho' and ce.script_id is null and ce.date >= m::date and ce.date < (m + interval '1 month')::date), 0)
    + coalesce((select count(*) from public.videos v where v.uploaded and v.uploaded_at >= m and v.uploaded_at < (m + interval '1 month')), 0),
  coalesce((select count(*) from public.tasks t where t.completed_at >= m and t.completed_at < (m + interval '1 month')), 0)
from generate_series(date_trunc('month', current_date) - interval '11 months', date_trunc('month', current_date), interval '1 month') as m
on conflict (month) do nothing;

-- ---------------------------------------------------------------------------
-- HISTORIAL SEMANAL
-- Apartado aparte del mensual, a propósito (corto plazo vs. largo plazo).
-- Semana de lunes a domingo. El mismo aviso diario actualiza la semana en
-- curso cada día; al cambiar de semana, queda congelada como historial.
-- ---------------------------------------------------------------------------
create table if not exists public.weekly_history (
  week_start date primary key, -- lunes de esa semana
  ad_spend numeric not null default 0,
  new_contacts int not null default 0,
  new_clients int not null default 0,
  revenue numeric not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.weekly_history enable row level security;
drop policy if exists "weekly_history_full_access_authenticated" on public.weekly_history;
create policy "weekly_history_full_access_authenticated" on public.weekly_history for all to authenticated using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table public.weekly_history;
exception
  when duplicate_object then null;
end $$;

-- Relleno único de las últimas 12 semanas con datos reales ya existentes.
insert into public.weekly_history (week_start, ad_spend, new_contacts, new_clients, revenue)
select
  w::date,
  coalesce((
    select sum(greatest(0, (least(coalesce(a.paused_at, current_date), (w + interval '6 days')::date) - greatest(a.start_date, w::date) + 1)) * a.daily_amount)
    from public.ad_spend a
    where a.start_date <= (w + interval '6 days')::date
      and coalesce(a.paused_at, current_date) >= w::date
  ), 0),
  (select count(*) from public.contacts c where c.created_at >= w and c.created_at < (w + interval '7 days')),
  (select count(*) from public.contacts c where c.stage = 'Cliente' and c.stage_updated_at >= w and c.stage_updated_at < (w + interval '7 days')),
  coalesce((select sum(c.amount) from public.contacts c where c.stage = 'Cliente' and c.stage_updated_at >= w and c.stage_updated_at < (w + interval '7 days')), 0)
from generate_series(
  date_trunc('week', current_date) - interval '11 weeks',
  date_trunc('week', current_date),
  interval '1 week'
) as w
on conflict (week_start) do nothing;

-- ---------------------------------------------------------------------------
-- GUIONES: se fusiona el Banco de ideas en el propio flujo de Guiones.
-- Una idea ya no es una tabla y página aparte — es simplemente un guion en
-- su primera etapa. Etapas: Idea -> Borrador -> Listo -> Grabado.
-- ---------------------------------------------------------------------------
alter table public.scripts add column if not exists migrated_from_idea_id uuid;

insert into public.scripts (created_by, title, category, content, status, migrated_from_idea_id, created_at, updated_at)
select
  ci.created_by,
  ci.title,
  case ci.type when 'reel' then 'Reel' when 'video' then 'Video' when 'historia' then 'Historia' else 'General' end,
  coalesce(ci.notes, ''),
  case when ci.used then 'Grabado' else 'Idea' end,
  ci.id,
  ci.created_at,
  ci.created_at
from public.content_ideas ci
where not exists (select 1 from public.scripts s where s.migrated_from_idea_id = ci.id);

-- ---------------------------------------------------------------------------
-- GOOGLE CALENDAR
-- Cada cuenta conecta su propio Google Calendar. Lo que se programa en el
-- Calendario del panel se sincroniza solo (creación, edición y borrado),
-- hacia el Google Calendar de cada cuenta conectada.
-- ---------------------------------------------------------------------------
create table if not exists public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  access_token text not null,
  refresh_token text not null,
  expiry_date bigint,
  connected_at timestamptz not null default now()
);
alter table public.google_calendar_connections enable row level security;
drop policy if exists "google_calendar_connections_own" on public.google_calendar_connections;
create policy "google_calendar_connections_own" on public.google_calendar_connections for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Qué evento de Google corresponde a cada entrada del Calendario, por cuenta
-- (cada persona conectada tiene su propio evento, en su propio calendario).
create table if not exists public.google_calendar_events (
  id uuid primary key default gen_random_uuid(),
  calendar_entry_id uuid references public.calendar_entries(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  google_event_id text not null,
  created_at timestamptz not null default now(),
  unique (calendar_entry_id, user_id)
);
alter table public.google_calendar_events enable row level security;
drop policy if exists "google_calendar_events_full_access_authenticated" on public.google_calendar_events;
create policy "google_calendar_events_full_access_authenticated" on public.google_calendar_events for all to authenticated using (true) with check (true);

-- Extiende la tabla anterior para que también sirva para Tareas (con hora),
-- no solo para el Calendario de contenido — mismo mecanismo, misma tabla.
alter table public.google_calendar_events alter column calendar_entry_id drop not null;
alter table public.google_calendar_events add column if not exists task_id uuid references public.tasks(id) on delete cascade;
create unique index if not exists google_calendar_events_task_user_uidx on public.google_calendar_events (task_id, user_id) where task_id is not null;

-- ---------------------------------------------------------------------------
-- DURACIÓN DE TAREAS
-- Para la vista semanal por horas — cuánto ocupa cada tarea en el calendario.
-- ---------------------------------------------------------------------------
alter table public.tasks add column if not exists duration_minutes int;

-- ---------------------------------------------------------------------------
-- AI CLOSER — ficha del lead
-- Se guarda dentro del propio contacto (no una tabla aparte): estado, score,
-- objetivo/problema/objeciones detectados, y el próximo paso sugerido. Se
-- actualiza solo cuando TÚ le das a "Guardar en la ficha", nunca sola.
-- ---------------------------------------------------------------------------
alter table public.contacts add column if not exists ai_lead_state text;
alter table public.contacts add column if not exists ai_lead_score int;
alter table public.contacts add column if not exists ai_score_reason text;
alter table public.contacts add column if not exists ai_objective text;
alter table public.contacts add column if not exists ai_problem text;
alter table public.contacts add column if not exists ai_situation text;
alter table public.contacts add column if not exists ai_objections text;
alter table public.contacts add column if not exists ai_next_step text;
alter table public.contacts add column if not exists ai_probability text; -- Baja / Media / Alta
alter table public.contacts add column if not exists ai_last_analysis_at timestamptz;
alter table public.contacts add column if not exists ai_last_conversation text;

-- ---------------------------------------------------------------------------
-- FACTURACIÓN (solo el propietario la ve — protección real en la base de
-- datos, no solo escondida en la pantalla)
-- ---------------------------------------------------------------------------

-- Marca tu propia cuenta como propietaria. Sustituye el email por el tuyo
-- y ejecuta esta línea UNA VEZ (ver README, sección "Facturación privada"):
-- update public.profiles set is_owner = true where id = (select id from auth.users where email = 'tu-email@ejemplo.com');
alter table public.profiles add column if not exists is_owner boolean not null default false;

-- Refuerza la política de "editar mi propio perfil" para que NADIE pueda
-- marcarse a sí mismo como propietario cambiando su propia fila — solo se
-- puede hacer desde fuera (el UPDATE manual de arriba, o directamente en
-- Supabase). Sin esto, cualquier cuenta podría auto-concederse acceso a
-- Facturación y Clientes activos.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check (
    (select auth.uid()) = id
    and is_owner = (select p.is_owner from public.profiles p where p.id = (select auth.uid()))
  );

-- Fecha en que cambió el estado (Activo/Pausado/Finalizado) — no es dato
-- económico, se queda en la tabla compartida de Clientes activos para que
-- Ana también la vea; solo el precio y la etiqueta van aparte.
alter table public.active_clients add column if not exists status_changed_at timestamptz;

-- Precio real y etiqueta (ej. "Precio antiguo") de cada cliente activo.
-- Tabla separada a propósito: nunca visible para nadie que no sea el
-- propietario, aunque tenga acceso al resto del panel.
-- "price_amount" es lo que paga cada vez que le toca pagar (según su
-- duración: mensual/3 meses/6 meses/anual, ya la tenías en Clientes
-- activos) — el equivalente mensual se calcula dividiendo entre esos meses,
-- no hace falta un campo de frecuencia nuevo.
create table if not exists public.client_billing (
  id uuid primary key default gen_random_uuid(),
  active_client_id uuid references public.active_clients(id) on delete cascade unique,
  price_amount numeric,
  price_tag text,
  updated_at timestamptz not null default now()
);
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'client_billing' and column_name = 'monthly_price')
     and not exists (select 1 from information_schema.columns where table_name = 'client_billing' and column_name = 'price_amount') then
    alter table public.client_billing rename column monthly_price to price_amount;
  end if;
end $$;
alter table public.client_billing enable row level security;
drop policy if exists "client_billing_owner_only" on public.client_billing;
create policy "client_billing_owner_only" on public.client_billing for all to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_owner = true))
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and is_owner = true));

do $$
begin
  alter publication supabase_realtime add table public.client_billing;
exception
  when duplicate_object then null;
end $$;

-- Clientes activos vuelve a ser compartida con Ana — el precio nunca vivió
-- aquí (siempre estuvo aparte, en client_billing, que sigue solo para ti
-- más abajo), así que devolver esta tabla no filtra ningún dato de dinero.
drop policy if exists "active_clients_owner_only" on public.active_clients;
drop policy if exists "active_clients_full_access_authenticated" on public.active_clients;
create policy "active_clients_full_access_authenticated" on public.active_clients for all to authenticated using (true) with check (true);

-- Historial de facturación real, mes a mes — igual que el Historial normal,
-- pero solo con lo que de verdad facturaste (usando el precio prorrateado
-- de cada cliente), y solo visible para ti. Se actualiza sola cada día con
-- el mismo aviso diario de siempre.
create table if not exists public.billing_history (
  month text primary key, -- 'YYYY-MM'
  mrr numeric not null default 0,
  avg_ticket numeric not null default 0,
  active_clients_count int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.billing_history enable row level security;
drop policy if exists "billing_history_owner_only" on public.billing_history;
create policy "billing_history_owner_only" on public.billing_history for all to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_owner = true))
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and is_owner = true));

do $$
begin
  alter publication supabase_realtime add table public.billing_history;
exception
  when duplicate_object then null;
end $$;

-- Registro real de cada cobro (no prorrateado): una fila por cada vez que
-- a un cliente le toca pagar de verdad, con la fecha real. Esto es lo que
-- alimenta las pestañas "Mensual" y "Anual" de Facturación — si un cliente
-- es semestral, aquí solo aparece el mes en que de verdad paga, con el
-- importe completo, no repartido en 6.
create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  active_client_id uuid references public.active_clients(id) on delete cascade,
  amount numeric not null,
  event_date date not null,
  created_at timestamptz not null default now()
);
alter table public.billing_events enable row level security;
drop policy if exists "billing_events_owner_only" on public.billing_events;
create policy "billing_events_owner_only" on public.billing_events for all to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_owner = true))
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and is_owner = true));

do $$
begin
  alter publication supabase_realtime add table public.billing_events;
exception
  when duplicate_object then null;
end $$;

-- Barrera permanente: un cliente no puede tener dos cobros anotados el
-- mismo día, pase lo que pase (aunque el aviso corra dos veces, aunque se
-- mezclen versiones de código). A partir de ahora es imposible duplicar
-- exactamente la misma fecha.
create unique index if not exists billing_events_client_date_uidx on public.billing_events (active_client_id, event_date);

-- Limpieza TOTAL, de una sola vez: lo de arriba solo bloqueaba fechas
-- IDÉNTICAS, pero el lío real generó fechas distintas muy próximas entre sí
-- (ej. dos cobros de un cliente mensual con solo 6 días de diferencia) al
-- mezclarse el cálculo viejo con el nuevo. Eso no se puede separar de forma
-- fiable a estas alturas, así que se borra todo y se pone un único punto de
-- partida limpio para cada cliente activo que ya tiene precio puesto — a
-- partir de ahí se va acumulando bien, sin arrastrar el lío. Protegido para
-- que esto pase UNA sola vez.
do $$
begin
  if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = '_billing_events_reset_done') then
    truncate public.billing_events;
    insert into public.billing_events (active_client_id, amount, event_date)
    select cb.active_client_id, cb.price_amount, current_date
    from public.client_billing cb
    join public.active_clients ac on ac.id = cb.active_client_id and ac.status = 'Activo'
    where cb.price_amount is not null
    on conflict (active_client_id, event_date) do nothing;
    create table public._billing_events_reset_done (done boolean default true);
    alter table public._billing_events_reset_done enable row level security;
  end if;
end $$;

-- Corrección del arranque limpio de arriba: aquel puso la fecha de HOY a
-- todo el mundo, sin mirar cuándo le toca renovar de verdad a cada uno —
-- por eso aparecían clientes "cobrados" en meses donde todavía no les
-- tocaba pagar. Esta segunda pasada sustituye ese punto de partida por uno
-- real: la fecha de renovación de cada cliente MENOS un ciclo (su duración),
-- que es cuándo pagó la última vez de verdad. Protegido igual, una sola vez.
do $$
begin
  if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = '_billing_events_reset_v2_done') then
    truncate public.billing_events;
    insert into public.billing_events (active_client_id, amount, event_date)
    select
      cb.active_client_id,
      cb.price_amount,
      (ac.renewal_date - ((
        case ac.duration
          when 'Mensual' then 1
          when '3 meses' then 3
          when '6 meses' then 6
          when 'Anual' then 12
          else 1
        end)::text || ' months')::interval
      )::date
    from public.client_billing cb
    join public.active_clients ac on ac.id = cb.active_client_id and ac.status = 'Activo'
    where cb.price_amount is not null and ac.renewal_date is not null
    on conflict (active_client_id, event_date) do nothing;
    create table public._billing_events_reset_v2_done (done boolean default true);
    alter table public._billing_events_reset_v2_done enable row level security;
  end if;
end $$;

-- Por si ya habías pegado este archivo antes de este arreglo: activa RLS en
-- estas dos tablas-marcador aunque ya existieran de antes (Supabase las
-- señala como aviso de seguridad si se quedan sin activar).
alter table if exists public._billing_events_reset_done enable row level security;
alter table if exists public._billing_events_reset_v2_done enable row level security;

-- ---------------------------------------------------------------------------
-- LÍNEA DE TIEMPO DEL LEAD (AI Closer)
-- Reemplaza el "ai_last_conversation" de una sola pieza por un historial de
-- verdad: cada conversación que analizas queda como su propia entrada (con
-- el resumen de la IA de ese momento), y puedes añadir tus propias notas
-- ("qué hice, qué decidí") como entradas aparte. Compartida (como el resto
-- de Contactos), no es dato de dinero.
-- ---------------------------------------------------------------------------
create table if not exists public.lead_timeline (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade,
  entry_type text not null default 'conversation', -- 'conversation' | 'note'
  content text not null,
  ai_summary text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.lead_timeline enable row level security;
drop policy if exists "lead_timeline_full_access_authenticated" on public.lead_timeline;
create policy "lead_timeline_full_access_authenticated" on public.lead_timeline for all to authenticated using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table public.lead_timeline;
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
