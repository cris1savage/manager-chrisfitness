'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Check, Clock, CalendarDays, Plus, Users, Megaphone, Lightbulb, ListChecks, Clapperboard,
  ChevronRight, Trophy, Sparkles, AlertTriangle, Phone,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui';
import { todayISO, monthKey, eur, dateToISO, PUBLISH_STATUSES, publishStatusOf, platformOf, PLATFORMS } from '@/lib/config';
import { useCategories } from '@/components/CategoriesProvider';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
const DAY = 86400000;
const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return dateToISO(d);
};
const hhmm = (t) => (t ? String(t).slice(0, 5) : '');
const inRange = (dateStr, start, end) => !!dateStr && dateStr.slice(0, 10) >= start && dateStr.slice(0, 10) <= end;
const fmtInt = (n) => (Number(n) || 0).toLocaleString('es-ES');
const fmtCompact = (n) => {
  const v = Number(n) || 0;
  if (v >= 10000) return `${(v / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })}k`;
  return v.toLocaleString('es-ES');
};
const pctChange = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 100) : null);
const daysBetween = (a, b) => Math.max(0, Math.floor((new Date(b) - new Date(a)) / DAY));

// Gasto en anuncios entre dos fechas (ambas incluidas)
const spendBetween = (ads, start, end) =>
  ads.reduce((sum, ad) => {
    if (!ad.start_date) return sum;
    const stop = ad.status === 'Pausado' && ad.paused_at ? ad.paused_at : todayISO();
    const from = ad.start_date > start ? ad.start_date : start;
    const to = stop < end ? stop : end;
    if (to < from) return sum;
    return sum + (daysBetween(from, to) + 1) * (Number(ad.daily_amount) || 0);
  }, 0);

function SectionTitle({ icon: Icon, children, href, linkLabel = 'Ver todo', right }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <h2 className="flex items-center gap-2 text-ink text-[15px] font-bold">
        {Icon && <Icon size={16} className="text-muted" />} {children}
      </h2>
      <div className="flex items-center gap-3">
        {right}
        {href && (
          <Link href={href} className="text-muted hover:text-cyan text-xs flex items-center gap-0.5 shrink-0">
            {linkLabel} <ChevronRight size={13} />
          </Link>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, sub, subColor }) {
  return (
    <div className="min-w-0">
      <div className="text-muted text-[12px]">{label}</div>
      <div className="text-ink text-[24px] font-extrabold tracking-tight leading-tight">{value}</div>
      {sub && <div className="text-[11.5px] truncate" style={{ color: subColor || 'var(--color-muted)' }}>{sub}</div>}
    </div>
  );
}

const Delta = (p) => (p === null ? null : `${p >= 0 ? '+' : ''}${p}%`);
const deltaColor = (p, invert = false) => (p === null ? undefined : (invert ? p <= 0 : p >= 0) ? 'var(--color-green)' : 'var(--color-red)');

// ---------------------------------------------------------------------------

export default function DashboardClient({ profile }) {
  const supabase = useMemo(() => createClient(), []);
  const { map: categoriesMap } = useCategories();
  const [data, setData] = useState(null);
  const [meId, setMeId] = useState(null);
  const [now, setNow] = useState(() => new Date());

  const load = async () => {
    const from = addDays(todayISO(), -45);
    const [entries, videos, tasks, contacts, ads, stats] = await Promise.all([
      supabase.from('calendar_entries').select('*').gte('date', from),
      supabase.from('videos').select('id, title, production_status, uploaded, uploaded_at, calendar_entry_id'),
      supabase.from('tasks').select('*'),
      supabase.from('contacts').select('id, name, stage, stage_updated_at, created_at, source, source_ad_id'),
      supabase.from('ad_spend').select('*'),
      supabase.from('social_daily_stats').select('*').gte('date', from),
    ]);
    setData({
      entries: entries.data || [],
      videos: videos.data || [],
      tasks: tasks.data || [],
      contacts: contacts.data || [],
      ads: ads.data || [],
      stats: stats.error ? [] : stats.data || [], // la tabla puede no existir aún
    });
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data?.user?.id || null));
    load();
    const channel = supabase
      .channel('dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, load)
      .subscribe();
    const tick = setInterval(() => setNow(new Date()), 60000); // "en 45 min" se mantiene al día
    return () => { supabase.removeChannel(channel); clearInterval(tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marcar una pieza como publicada / pendiente (coherente con Calendario y Agenda)
  const toggleEntry = async (entry) => {
    const done = publishStatusOf(entry) === 'publicado';
    const patch = { status: done ? 'pendiente' : 'hecho', publish_status: done ? null : 'publicado' };
    setData((d) => ({ ...d, entries: d.entries.map((e) => (e.id === entry.id ? { ...e, ...patch } : e)) }));
    const { error } = await supabase.from('calendar_entries').update(patch).eq('id', entry.id);
    if (error) await supabase.from('calendar_entries').update({ status: patch.status }).eq('id', entry.id); // por si aún no está el SQL nuevo
  };
  const toggleTask = async (t) => {
    const nextDone = !t.done;
    setData((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, done: nextDone } : x)) }));
    await supabase.from('tasks').update({ done: nextDone, completed_at: nextDone ? new Date().toISOString() : null }).eq('id', t.id);
  };

  if (!data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-64 rounded-lg bg-surface" />
        <div className="h-32 rounded-2xl bg-surface" />
        <div className="grid lg:grid-cols-3 gap-4"><div className="lg:col-span-2 h-96 rounded-2xl bg-surface" /><div className="h-96 rounded-2xl bg-surface" /></div>
      </div>
    );
  }

  const today = todayISO();
  const nowHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const videoByEntry = {};
  data.videos.forEach((v) => { if (v.calendar_entry_id) videoByEntry[v.calendar_entry_id] = v; });
  const statusOf = (e) => publishStatusOf(e, videoByEntry[e.id]);
  const metaOf = (e) => categoriesMap[e.type] || { label: 'Contenido', color: '#7C878B' };

  // --- Tu día: contenido + tareas de hoy, ordenado por hora -----------------
  const myTasks = meId ? data.tasks.filter((t) => !t.assigned_to || t.assigned_to === meId) : data.tasks;
  const dayItems = [
    ...data.entries.filter((e) => e.date === today).map((e) => {
      const st = statusOf(e);
      return {
        id: `e-${e.id}`, kind: 'contenido', time: hhmm(e.publish_time), title: e.title,
        tag: metaOf(e).label, tagColor: metaOf(e).color, status: st, done: st === 'publicado',
        toggle: () => toggleEntry(e), href: '/contenido',
      };
    }),
    ...myTasks.filter((t) => t.due_date === today).map((t) => ({
      id: `t-${t.id}`, kind: 'tarea', time: hhmm(t.due_time), title: t.title,
      tag: 'Tarea', tagColor: 'var(--color-muted)', done: !!t.done, toggle: () => toggleTask(t), href: '/tareas',
    })),
  ].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  const overdueTasks = myTasks.filter((t) => !t.done && t.due_date && t.due_date < today);
  const doneCount = dayItems.filter((i) => i.done).length;

  // --- Leads -------------------------------------------------------------------
  const C = data.contacts;
  const staleLimit = new Date(Date.now() - 3 * DAY).toISOString();
  const recentLimit = new Date(Date.now() - 30 * DAY).toISOString();
  const staleLeads = C.filter((c) => ['Frío', 'Contactado'].includes(c.stage) && c.stage_updated_at < staleLimit && c.created_at > recentLimit);
  const callsScheduled = C.filter((c) => c.stage === 'Llamada agendada');

  // --- Lo siguiente --------------------------------------------------------
  const pending = dayItems.filter((i) => !i.done);
  const next = pending.find((i) => i.time && i.time >= nowHM) || pending.find((i) => !i.time) || pending[0] || null;
  const minsTo = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m - (now.getHours() * 60 + now.getMinutes());
  };
  let nextWhen = '';
  if (next?.time) {
    const mins = minsTo(next.time);
    nextWhen = mins < 0 ? `ERA A LAS ${next.time}` : mins < 60 ? `EN ${mins} MIN` : `A LAS ${next.time}`;
  }

  // --- Semana (lunes a domingo) -------------------------------------------------
  const weekStart = addDays(today, -((new Date().getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(weekStart, i);
    const list = data.entries.filter((e) => e.date === iso && statusOf(e) !== 'error');
    return {
      iso,
      label: new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
      letter: ['L', 'M', 'X', 'J', 'V', 'S', 'D'][i],
      dayNum: Number(iso.slice(8, 10)),
      count: list.length,
      published: list.filter((e) => statusOf(e) === 'publicado').length,
      isToday: iso === today,
      gap: list.length === 0 && iso >= today,
    };
  });
  const weekPlanned = week.reduce((s, d) => s + d.count, 0);
  const weekPublished = week.reduce((s, d) => s + d.published, 0);

  // --- Redes: últimos 7 días vs los 7 anteriores ---------------------------
  const l7s = addDays(today, -6);
  const p7s = addDays(today, -13);
  const p7e = addDays(today, -7);
  const statsIn = (s, e) => data.stats.filter((r) => inRange(r.date, s, e));
  const gained = (rows) => (rows.some((r) => r.followers_gained != null) ? rows.reduce((a, r) => a + (r.followers_gained || 0), 0) : null);
  const followers7 = gained(statsIn(l7s, today));
  const followersPrev7 = gained(statsIn(p7s, p7e));
  const published = (s, e) => data.entries.filter((x) => inRange(x.date, s, e) && statusOf(x) === 'publicado');
  const pub7 = published(l7s, today);
  const pubPrev7 = published(p7s, p7e);
  const sumViews = (list) => (list.some((x) => x.views != null) ? list.reduce((a, x) => a + (x.views || 0), 0) : null);
  const views7 = sumViews(pub7);
  const viewsPrev7 = sumViews(pubPrev7);
  const withViews = pub7.filter((x) => x.views > 0);
  const engagement = withViews.length
    ? (withViews.reduce((a, x) => a + (x.likes || 0) + (x.comments || 0), 0) / withViews.reduce((a, x) => a + x.views, 0)) * 100
    : null;
  const platformRows = ['instagram', 'tiktok', 'youtube']
    .map((p) => {
      const rows = data.stats.filter((r) => r.platform === p);
      if (!rows.length) return null;
      const latest = [...rows].filter((r) => r.followers != null).sort((a, b) => b.date.localeCompare(a.date))[0];
      return { key: p, label: PLATFORMS[p].label, followers: latest?.followers ?? null, gained: gained(rows.filter((r) => inRange(r.date, l7s, today))) };
    })
    .filter(Boolean);
  const bestPost = [...pub7].filter((x) => x.views != null).sort((a, b) => (b.views || 0) - (a.views || 0))[0] || null;

  // --- Leads y anuncios del mes (comparado con el mismo día del mes pasado)
  const nowD = new Date();
  const monthStart = `${monthKey(today)}-01`;
  const prevMonthStart = dateToISO(new Date(nowD.getFullYear(), nowD.getMonth() - 1, 1));
  const prevLastDay = new Date(nowD.getFullYear(), nowD.getMonth(), 0).getDate();
  const prevSameDay = dateToISO(new Date(nowD.getFullYear(), nowD.getMonth() - 1, Math.min(nowD.getDate(), prevLastDay)));
  const leadsM = C.filter((c) => inRange(c.created_at, monthStart, today));
  const leadsPrev = C.filter((c) => inRange(c.created_at, prevMonthStart, prevSameDay)).length;
  const callsDoneM = C.filter((c) => ['Realizada', 'Cliente', 'Perdido'].includes(c.stage) && inRange(c.stage_updated_at, monthStart, today)).length;
  const spendM = spendBetween(data.ads, monthStart, today);
  const spendPrev = spendBetween(data.ads, prevMonthStart, prevSameDay);
  const cpl = leadsM.length && spendM ? spendM / leadsM.length : null;
  const cplPrev = leadsPrev && spendPrev ? spendPrev / leadsPrev : null;
  const activeAds = data.ads.filter((a) => a.status === 'Activo');
  const ctrAds = data.ads.filter((a) => a.ctr != null && (a.status === 'Activo' || monthKey(a.start_date) === monthKey(today)));
  const avgCtr = ctrAds.length ? ctrAds.reduce((s, a) => s + Number(a.ctr), 0) / ctrAds.length : null;
  const impressions = ctrAds.reduce((s, a) => s + (Number(a.impressions) || 0), 0);
  const campaignRows = activeAds.map((a) => {
    const leads = leadsM.filter((c) => c.source_ad_id === a.id).length;
    const spend = spendBetween([a], monthStart, today);
    return { id: a.id, name: a.campaign, daily: Number(a.daily_amount) || 0, leads, cpl: leads ? spend / leads : null };
  });

  // --- Racha de contenido ---------------------------------------------------
  const doneDates = new Set(data.entries.filter((e) => statusOf(e) === 'publicado' && !e.script_id).map((e) => e.date));
  data.videos.forEach((v) => { if (v.uploaded && v.uploaded_at) doneDates.add(v.uploaded_at.slice(0, 10)); });
  let streak = 0;
  {
    const cursor = new Date();
    if (!doneDates.has(dateToISO(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (doneDates.has(dateToISO(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  }

  // --- Avisos y sugerencias (reglas sobre tus datos, sin IA) -----------------
  const tips = [];
  const gapDays = week.filter((d) => d.gap && !d.isToday);
  if (gapDays.length) tips.push({ icon: CalendarDays, text: `${gapDays.map((d) => d.label).join(', ')} sin nada programado. Rellénalo con una idea del banco.`, href: '/contenido' });
  if (staleLeads.length) tips.push({ icon: Users, text: `${staleLeads.length} ${staleLeads.length === 1 ? 'lead lleva' : 'leads llevan'} más de 3 días sin respuesta.`, href: '/contactos', urgent: true });
  const draftsToday = dayItems.filter((i) => i.kind === 'contenido' && i.status === 'borrador').length;
  if (draftsToday) tips.push({ icon: Clapperboard, text: `${draftsToday} ${draftsToday === 1 ? 'pieza de hoy sigue' : 'piezas de hoy siguen'} en borrador.`, href: '/contenido' });
  const errorsWeek = data.entries.filter((e) => inRange(e.date, weekStart, addDays(weekStart, 6)) && statusOf(e) === 'error').length;
  if (errorsWeek) tips.push({ icon: AlertTriangle, text: `${errorsWeek} ${errorsWeek === 1 ? 'publicación falló' : 'publicaciones fallaron'} esta semana. Revísalas.`, href: '/contenido', urgent: true });
  if (bestPost) tips.push({ icon: Trophy, text: `Tu mejor pieza: «${bestPost.title}» (${fmtInt(bestPost.views)} vistas). Repite el formato.`, href: '/guiones' });
  if (cpl !== null && cplPrev !== null && cpl < cplPrev) tips.push({ icon: Megaphone, text: `El coste por lead ha bajado a ${cpl.toFixed(1).replace('.', ',')} € (antes ${cplPrev.toFixed(1).replace('.', ',')} €).`, href: '/anuncios' });

  const hour = now.getHours();
  const greeting = hour < 13 ? 'Buenos días' : hour < 21 ? 'Buenas tardes' : 'Buenas noches';
  const dateLabel = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const leadDelta = pctChange(leadsM.length, leadsPrev);
  const followersDelta = followers7 !== null && followersPrev7 ? pctChange(followers7, followersPrev7) : null;
  const viewsDelta = views7 !== null && viewsPrev7 ? pctChange(views7, viewsPrev7) : null;
  const cplDelta = cpl !== null && cplPrev !== null ? pctChange(cpl, cplPrev) : null;

  const quickActions = [
    { href: '/contenido', label: 'Contenido', icon: Clapperboard },
    { href: '/guiones', label: 'Idea', icon: Lightbulb },
    { href: '/contactos', label: 'Lead', icon: Users },
    { href: '/tareas', label: 'Tarea', icon: ListChecks },
  ];

  return (
    <div className="space-y-5">
      {/* ── Cabecera ─────────────────────────────────────────────── */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-muted text-sm first-letter:uppercase">{dateLabel}</div>
          <h1 className="font-display text-ink text-[28px] sm:text-[32px] leading-tight tracking-wide">
            {greeting.toUpperCase()}, {(profile?.display_name || '').toUpperCase()}
          </h1>
        </div>
        <div className="hidden md:flex gap-2">
          {quickActions.map(({ href, label, icon: Icon }, i) => (
            <Link
              key={href}
              href={href}
              className={i === 0
                ? 'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold bg-cyan text-[#00161C]'
                : 'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold border border-border text-ink hover:border-cyan'}
            >
              <Plus size={14} /> {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* ═════ Columna principal ═════ */}
        <div className="lg:col-span-2 space-y-4 min-w-0">
          {/* Lo siguiente */}
          <section className="rounded-2xl p-5 sm:p-6 flex items-center justify-between gap-4 flex-wrap" style={{ background: 'var(--color-cyan)', color: '#04151C' }}>
            {next ? (
              <>
                <div className="min-w-0">
                  <div className="text-[12px] font-extrabold tracking-wide">LO SIGUIENTE{nextWhen ? ` · ${nextWhen}` : ''}</div>
                  <div className="text-[22px] sm:text-[28px] font-extrabold tracking-tight leading-tight mt-1">{next.title}</div>
                  <div className="text-[13.5px] mt-1 font-medium opacity-80">
                    {next.tag}{next.status ? ` · ${PUBLISH_STATUSES[next.status].label}` : ''}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={next.toggle} className="rounded-xl px-4 py-3 text-sm font-bold" style={{ background: '#04151C', color: '#D6F3FE' }}>
                    {next.kind === 'contenido' ? 'Marcar publicado' : 'Marcar hecha'}
                  </button>
                  <Link href={next.href} className="rounded-xl px-4 py-3 text-sm font-bold" style={{ background: '#B7E9FD', color: '#04151C' }}>
                    {next.kind === 'contenido' ? 'Abrir calendario' : 'Ver tareas'}
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="text-[12px] font-extrabold tracking-wide">HOY</div>
                  <div className="text-[22px] sm:text-[28px] font-extrabold tracking-tight leading-tight mt-1">
                    {dayItems.length ? 'Todo lo de hoy está hecho' : 'Nada programado para hoy'}
                  </div>
                  <div className="text-[13.5px] mt-1 font-medium opacity-80">Buen momento para preparar el contenido de mañana.</div>
                </div>
                <Link href="/contenido" className="rounded-xl px-4 py-3 text-sm font-bold" style={{ background: '#04151C', color: '#D6F3FE' }}>Planificar contenido</Link>
              </>
            )}
          </section>

          {/* Acciones rápidas (móvil) */}
          <div className="grid grid-cols-4 gap-2 md:hidden">
            {quickActions.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex flex-col items-center gap-1.5 text-ink text-[11.5px] font-semibold">
                <span className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center"><Icon size={22} className="text-cyan" /></span>
                {label}
              </Link>
            ))}
          </div>

          {/* Tu día */}
          <Card className="!p-5 !rounded-2xl">
            <SectionTitle icon={Clock} right={dayItems.length > 0 && <span className="text-muted text-xs">{doneCount} de {dayItems.length} hechas</span>}>Tu día</SectionTitle>
            {overdueTasks.length > 0 && (
              <Link href="/tareas" className="flex items-center gap-2 rounded-lg px-3 py-2 mb-2 text-sm font-semibold" style={{ background: '#F871711A', color: 'var(--color-red)' }}>
                <AlertTriangle size={15} /> {overdueTasks.length} {overdueTasks.length === 1 ? 'tarea atrasada' : 'tareas atrasadas'}
              </Link>
            )}
            {dayItems.length === 0 && staleLeads.length === 0 && callsScheduled.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-muted text-sm">
                Nada para hoy. <Link href="/contenido" className="text-cyan font-semibold">Planifica algo →</Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {dayItems.map((it) => {
                  const isNext = next && it.id === next.id;
                  const s = it.status ? PUBLISH_STATUSES[it.status] : null;
                  return (
                    <div key={it.id} className="flex items-center gap-3 sm:gap-4 py-3">
                      <div className="w-11 shrink-0 text-[13px] font-bold" style={{ color: isNext ? 'var(--color-cyan)' : it.done ? 'var(--color-muted)' : 'var(--color-ink)' }}>
                        {it.time || '—'}
                      </div>
                      <button
                        onClick={it.toggle}
                        className="w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center shrink-0"
                        style={{ borderColor: it.done ? 'var(--color-green)' : isNext ? 'var(--color-cyan)' : 'var(--color-border)', background: it.done ? 'var(--color-green)' : 'transparent' }}
                        aria-label={it.done ? 'Marcar como pendiente' : 'Marcar como hecho'}
                      >
                        {it.done && <Check size={12} color="#06200F" strokeWidth={3.5} />}
                      </button>
                      <Link href={it.href} className={`flex-1 min-w-0 text-[14.5px] truncate ${it.done ? 'line-through text-muted' : isNext ? 'text-ink font-semibold' : 'text-ink'}`}>
                        {it.title}
                      </Link>
                      <span className="text-[11.5px] font-semibold shrink-0" style={{ color: s && !it.done ? s.color : it.tagColor }}>
                        {s && !it.done ? s.label : it.tag}
                      </span>
                    </div>
                  );
                })}
                {callsScheduled.length > 0 && (
                  <Link href="/contactos" className="flex items-center gap-3 sm:gap-4 py-3">
                    <div className="w-11 shrink-0 text-[13px] font-bold text-muted">—</div>
                    <Phone size={18} className="text-cyan shrink-0 mx-[2px]" />
                    <span className="flex-1 text-[14.5px] text-ink">{callsScheduled.length} {callsScheduled.length === 1 ? 'llamada agendada' : 'llamadas agendadas'} con leads</span>
                    <span className="text-[11.5px] font-semibold text-cyan shrink-0">Leads</span>
                  </Link>
                )}
                {staleLeads.length > 0 && (
                  <Link href="/contactos" className="flex items-center gap-3 sm:gap-4 py-3">
                    <div className="w-11 shrink-0 text-[13px] font-bold text-muted">—</div>
                    <Users size={18} className="text-red shrink-0 mx-[2px]" />
                    <span className="flex-1 text-[14.5px] text-ink">Contestar a {staleLeads.length} {staleLeads.length === 1 ? 'lead sin respuesta' : 'leads sin respuesta'}</span>
                    <span className="text-[11.5px] font-semibold text-red shrink-0">Urgente</span>
                  </Link>
                )}
              </div>
            )}
            <Link href="/contenido" className="mt-3 flex items-center justify-center gap-1.5 h-11 rounded-xl border border-dashed border-border text-muted text-sm font-semibold hover:border-cyan hover:text-cyan">
              <Plus size={15} /> Añadir al día
            </Link>
          </Card>

          {/* Semana */}
          <Card className="!p-5 !rounded-2xl">
            <SectionTitle icon={CalendarDays} href="/contenido" linkLabel="Calendario" right={<span className="text-muted text-xs">{weekPublished} de {weekPlanned} publicadas</span>}>
              Esta semana
            </SectionTitle>
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {week.map((d) => (
                <Link
                  key={d.iso}
                  href="/contenido"
                  className="rounded-xl px-1 py-2 sm:p-2.5 bg-surfaceAlt min-w-0"
                  style={{
                    border: d.isToday ? '1px solid var(--color-cyan)' : d.gap ? '1px dashed var(--color-red)' : '1px solid var(--color-border)',
                  }}
                >
                  <div className="text-[11px] sm:text-[11.5px] font-bold capitalize truncate text-center sm:text-left" style={{ color: d.isToday ? 'var(--color-cyan)' : 'var(--color-muted)' }}>
                    <span className="sm:hidden">{d.letter} {d.dayNum}</span>
                    <span className="hidden sm:inline">{d.label}</span>
                  </div>
                  <div className="text-[18px] sm:text-[20px] font-extrabold mt-0.5 text-center sm:text-left" style={{ color: d.gap ? 'var(--color-red)' : 'var(--color-ink)' }}>{d.count}</div>
                  <div className="hidden sm:block text-[10.5px] text-muted truncate">{d.gap ? 'hueco' : d.count === 1 ? 'pieza' : 'piezas'}</div>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {/* ═════ Lateral ═════ */}
        <aside className="space-y-4 min-w-0">
          {/* Redes */}
          <Card className="!p-5 !rounded-2xl">
            <SectionTitle icon={Sparkles}>Redes · últimos 7 días</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <Metric
                label="Seguidores nuevos"
                value={followers7 === null ? '—' : `${followers7 >= 0 ? '+' : ''}${fmtInt(followers7)}`}
                sub={followers7 === null ? 'al conectar las redes' : Delta(followersDelta) ? `${Delta(followersDelta)} vs semana pasada` : 'esta semana'}
                subColor={deltaColor(followersDelta)}
              />
              <Metric
                label="Vistas"
                value={views7 === null ? '—' : fmtCompact(views7)}
                sub={views7 === null ? 'apúntalas en cada post' : Delta(viewsDelta) || 'de lo publicado'}
                subColor={deltaColor(viewsDelta)}
              />
              <Metric label="Interacción" value={engagement === null ? '—' : `${engagement.toFixed(1).replace('.', ',')}%`} sub="likes + com. / vistas" />
              <Metric label="Racha" value={`${streak} ${streak === 1 ? 'día' : 'días'}`} sub={streak ? 'publicando seguido' : 'publica hoy para empezar'} subColor={streak >= 3 ? 'var(--color-amber)' : undefined} />
            </div>
            {platformRows.length > 0 ? (
              <div className="mt-4">
                {platformRows.map((p) => (
                  <div key={p.key} className="flex justify-between py-2 border-t border-border text-sm">
                    <span className="text-ink">{p.label}</span>
                    <span className="text-muted">
                      {p.followers != null ? fmtInt(p.followers) : '—'}
                      {p.gained != null && <b className="ml-1.5" style={{ color: p.gained >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>{p.gained >= 0 ? '+' : ''}{fmtInt(p.gained)}</b>}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 pt-3 border-t border-border text-muted text-xs">
                Seguidores por red (Instagram, TikTok, YouTube): aparecerán aquí al conectar las cuentas.
              </div>
            )}
          </Card>

          {/* Leads y anuncios */}
          <Card className="!p-5 !rounded-2xl">
            <SectionTitle icon={Megaphone} href="/anuncios" linkLabel="Anuncios">Leads y anuncios</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <Link href="/contactos"><Metric label="Leads este mes" value={fmtInt(leadsM.length)} sub={Delta(leadDelta) ? `${Delta(leadDelta)} vs mes pasado` : 'este mes'} subColor={deltaColor(leadDelta)} /></Link>
              <Metric label="Llamadas hechas" value={fmtInt(callsDoneM)} sub={`${callsScheduled.length} agendadas`} />
              <Metric label="Coste por lead" value={cpl === null ? '—' : `${cpl.toFixed(1).replace('.', ',')} €`} sub={Delta(cplDelta) ? `${Delta(cplDelta)} vs mes pasado` : spendM ? `${eur(spendM)} invertidos` : 'sin gasto este mes'} subColor={deltaColor(cplDelta, true)} />
              <Metric label="CTR anuncios" value={avgCtr === null ? '—' : `${avgCtr.toFixed(1).replace('.', ',')}%`} sub={impressions ? `${fmtCompact(impressions)} impresiones` : 'de Meta Ads'} />
            </div>
            {campaignRows.length > 0 ? (
              <div className="mt-4 space-y-2">
                {campaignRows.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 rounded-xl bg-surfaceAlt px-3 py-2.5 text-[13px]">
                    <span className="w-2 h-2 rounded-full bg-green shrink-0" />
                    <span className="text-ink font-semibold truncate flex-1">{c.name}</span>
                    <span className="text-muted shrink-0">{eur(c.daily)}/día · {c.leads} leads</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 pt-3 border-t border-border text-muted text-xs">Ninguna campaña activa ahora mismo.</div>
            )}
          </Card>

          {/* Mejor publicación */}
          {bestPost && (
            <Card className="!p-5 !rounded-2xl">
              <SectionTitle icon={Trophy}>Mejor publicación · 7 días</SectionTitle>
              <div className="flex items-center gap-3">
                <div className="w-12 h-16 rounded-lg bg-surfaceAlt border border-border flex items-center justify-center shrink-0" style={{ color: metaOf(bestPost).color }}>
                  <Clapperboard size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-ink text-sm font-semibold truncate">{bestPost.title}</div>
                  <div className="text-muted text-xs">
                    {(() => {
                      const label = metaOf(bestPost).label;
                      const platform = PLATFORMS[platformOf(bestPost.type, label)].label;
                      return label.toLowerCase().includes(platform.toLowerCase()) || platform === 'Otros' ? label : `${label} · ${platform}`;
                    })()}
                    {' · '}{new Date(bestPost.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long' })}
                  </div>
                  <div className="text-[13px] mt-1">
                    <b className="text-ink">{fmtInt(bestPost.views)}</b> <span className="text-muted">vistas</span>
                    {bestPost.likes != null && <> · <b className="text-ink">{fmtInt(bestPost.likes)}</b> <span className="text-muted">likes</span></>}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Avisos y sugerencias */}
          <Card className="!p-5 !rounded-2xl">
            <SectionTitle icon={Lightbulb}>Avisos y sugerencias</SectionTitle>
            {tips.length === 0 ? (
              <div className="text-muted text-sm">Todo en orden por ahora.</div>
            ) : (
              <div className="space-y-2">
                {tips.slice(0, 4).map((t, i) => (
                  <Link key={i} href={t.href} className="flex gap-2.5 rounded-xl bg-surfaceAlt px-3 py-3 text-[13.5px] leading-snug text-ink hover:border-cyan border border-transparent">
                    <t.icon size={16} className="shrink-0 mt-0.5" style={{ color: t.urgent ? 'var(--color-red)' : 'var(--color-cyan)' }} />
                    <span>{t.text}</span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
