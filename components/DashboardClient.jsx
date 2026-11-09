'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Megaphone, Users, DollarSign, Check, Target, UserCheck, TrendingUp, TrendingDown, Activity,
  Plus, Trash2, Pencil, X, Flame, CalendarDays, ArrowUpRight, ArrowDownRight, ChevronRight,
  ListChecks, Filter, Percent, Clock, ShoppingBag,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui';
import {
  STAGES, todayISO, monthKey, eur, GOAL_METRICS, dateToISO, PUBLISH_STATUSES, publishStatusOf,
} from '@/lib/config';
import { useCategories } from '@/components/CategoriesProvider';
import ActivityFeed from '@/components/ActivityFeed';

// ---------------------------------------------------------------------------
// Piezas visuales
// ---------------------------------------------------------------------------

function SectionTitle({ icon: Icon, children, href, linkLabel = 'Ver todo', right }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-2 text-ink text-[13px] font-bold">
        {Icon && <Icon size={15} className="text-muted" />} {children}
      </div>
      {right}
      {href && (
        <Link href={href} className="text-muted hover:text-cyan text-xs flex items-center gap-0.5 shrink-0">
          {linkLabel} <ChevronRight size={13} />
        </Link>
      )}
    </div>
  );
}

// Variación frente al mismo punto del mes pasado
function Delta({ current, previous, invert = false }) {
  if (!previous && !current) return <span className="text-muted text-[11px]">sin datos aún</span>;
  if (!previous) return <span className="text-muted text-[11px]">mes pasado: 0</span>;
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.5) return <span className="text-muted text-[11px]">= que el mes pasado</span>;
  const up = pct > 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold" style={{ color: good ? 'var(--color-green)' : 'var(--color-red)' }}>
      <Icon size={12} /> {up ? '+' : ''}{pct.toFixed(0)}% <span className="text-muted font-normal ml-1">vs mes pasado</span>
    </span>
  );
}

function KpiCard({ icon: Icon, label, value, current, previous, accent, href, invert }) {
  const body = (
    <Card className="!p-4 h-full hover:border-cyan transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-muted text-[12px] font-medium">{label}</span>
        <span className="rounded-lg p-1.5" style={{ background: `${accent}1A` }}>
          <Icon size={15} color={accent} />
        </span>
      </div>
      <div className="font-display text-ink text-[28px] leading-none tracking-wide">{value}</div>
      <div className="mt-2"><Delta current={current} previous={previous} invert={invert} /></div>
    </Card>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

function ProgressBar({ pct, color }) {
  return (
    <div className="h-2 rounded-full bg-surfaceAlt overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%`, background: color }} />
    </div>
  );
}

const inputCls = 'bg-surface border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full outline-none focus:border-cyan';

function GoalForm({ value, onChange, onSubmit, onCancel, submitLabel }) {
  return (
    <div className="rounded-lg p-3 bg-surfaceAlt border border-border space-y-2">
      <input value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} placeholder="Ej. Facturar 3000€ este mes" className={inputCls} />
      <div className="grid grid-cols-3 gap-2">
        <select value={value.metric} onChange={(e) => onChange({ ...value, metric: e.target.value })} className={`${inputCls} !text-xs !px-2`}>
          {GOAL_METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        <select value={value.period} onChange={(e) => onChange({ ...value, period: e.target.value })} className={`${inputCls} !text-xs !px-2`}>
          <option value="mensual">Mensual</option>
          <option value="semanal">Semanal</option>
        </select>
        <input type="number" value={value.target} onChange={(e) => onChange({ ...value, target: e.target.value })} placeholder="Meta" className={`${inputCls} !text-xs !px-2`} />
      </div>
      <div className="flex gap-2">
        <button onClick={onSubmit} className="rounded-lg px-3 py-1.5 font-semibold text-xs bg-cyan text-[#00161C]">{submitLabel}</button>
        <button onClick={onCancel} className="rounded-lg px-3 py-1.5 font-semibold text-xs text-muted flex items-center gap-1"><X size={13} /> Cancelar</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utilidades de fechas
// ---------------------------------------------------------------------------

const DAY = 86400000;
const daysBetween = (a, b) => Math.max(0, Math.floor((new Date(b) - new Date(a)) / DAY));
const inRange = (dateStr, start, end) => !!dateStr && dateStr.slice(0, 10) >= start && dateStr.slice(0, 10) <= end;

// Gasto acumulado en anuncios entre dos fechas (ambas incluidas)
const spendBetween = (ads, start, end) =>
  ads.reduce((sum, ad) => {
    if (!ad.start_date) return sum;
    const stop = ad.status === 'Pausado' && ad.paused_at ? ad.paused_at : todayISO();
    const from = ad.start_date > start ? ad.start_date : start;
    const to = stop < end ? stop : end;
    if (to < from) return sum;
    return sum + (daysBetween(from, to) + 1) * (Number(ad.daily_amount) || 0);
  }, 0);

// ---------------------------------------------------------------------------

export default function DashboardClient({ profile }) {
  const supabase = useMemo(() => createClient(), []);
  const { map: categoriesMap } = useCategories();
  const [data, setData] = useState(null);
  const [meId, setMeId] = useState(null);
  const [goals, setGoals] = useState([]);
  const [addingGoal, setAddingGoal] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const emptyGoal = { title: '', metric: 'ventas', period: 'mensual', target: '' };
  const [goalForm, setGoalForm] = useState(emptyGoal);

  const load = async () => {
    const [adSpend, contacts, calendarEntries, activeClients, tasks, goalsRows, videos] = await Promise.all([
      supabase.from('ad_spend').select('*'),
      supabase.from('contacts').select('*'),
      supabase.from('calendar_entries').select('*'),
      supabase.from('active_clients').select('*'),
      supabase.from('tasks').select('*'),
      supabase.from('goals').select('*').order('created_at', { ascending: true }),
      supabase.from('videos').select('*'),
    ]);
    setData({
      adSpend: adSpend.data || [],
      contacts: contacts.data || [],
      calendarEntries: calendarEntries.data || [],
      activeClients: activeClients.data || [],
      tasks: tasks.data || [],
      videos: videos.data || [],
    });
    setGoals(goalsRows.data || []);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data?.user?.id || null));
    load();
    const channel = supabase
      .channel('dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marcar una pieza de hoy como publicada / pendiente. Mantiene coherente el
  // Calendario de contenido (publish_status) y la Agenda (status).
  const toggleEntry = async (entry) => {
    const done = entry.status === 'hecho';
    const patch = { status: done ? 'pendiente' : 'hecho', publish_status: done ? null : 'publicado' };
    setData((d) => ({ ...d, calendarEntries: d.calendarEntries.map((e) => (e.id === entry.id ? { ...e, ...patch } : e)) }));
    const { error } = await supabase.from('calendar_entries').update(patch).eq('id', entry.id);
    if (error) await supabase.from('calendar_entries').update({ status: patch.status }).eq('id', entry.id); // por si aún no está el SQL nuevo
  };

  const toggleTask = async (t) => {
    const nextDone = !t.done;
    await supabase.from('tasks').update({ done: nextDone, completed_at: nextDone ? new Date().toISOString() : null }).eq('id', t.id);
    load();
  };

  const addGoal = async () => {
    if (!goalForm.title.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('goals').insert({ ...goalForm, target: Number(goalForm.target) || 0, created_by: userData.user.id });
    setGoalForm(emptyGoal);
    setAddingGoal(false);
    load();
  };
  const updateGoalManual = async (id, value) => {
    setGoals((g) => g.map((x) => (x.id === id ? { ...x, manual_current: value } : x)));
    await supabase.from('goals').update({ manual_current: Number(value) || 0 }).eq('id', id);
  };
  const startEditGoal = (g) => {
    setEditingGoalId(g.id);
    setEditForm({ title: g.title, metric: g.metric, period: g.period, target: g.target });
  };
  const saveEditGoal = async () => {
    await supabase.from('goals').update({ ...editForm, target: Number(editForm.target) || 0 }).eq('id', editingGoalId);
    setEditingGoalId(null);
    load();
  };
  const removeGoal = async (id) => {
    if (!window.confirm('¿Borrar este objetivo?')) return;
    setGoals((g) => g.filter((x) => x.id !== id));
    await supabase.from('goals').delete().eq('id', id);
  };

  if (!data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-64 rounded-lg bg-surface" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-xl bg-surface" />)}</div>
        <div className="h-64 rounded-xl bg-surface" />
      </div>
    );
  }

  // --- Periodos: mes en curso vs. el mismo tramo del mes pasado ------------
  const today = todayISO();
  const now = new Date();
  const thisMonth = monthKey(today);
  const monthStart = `${thisMonth}-01`;
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStart = dateToISO(prevMonthDate);
  const prevMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const prevSameDay = dateToISO(new Date(now.getFullYear(), now.getMonth() - 1, Math.min(now.getDate(), prevMonthLastDay)));
  const startOfWeekISO = (() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return dateToISO(d);
  })();

  // --- Ventas, leads, ingresos, anuncios ------------------------------------
  const C = data.contacts;
  const leadsIn = (s, e) => C.filter((c) => inRange(c.created_at, s, e)).length;
  const salesIn = (s, e) => C.filter((c) => c.stage === 'Cliente' && inRange(c.stage_updated_at, s, e));
  const leadsM = leadsIn(monthStart, today);
  const leadsPrev = leadsIn(prevMonthStart, prevSameDay);
  const salesListM = salesIn(monthStart, today);
  const salesM = salesListM.length;
  const salesPrev = salesIn(prevMonthStart, prevSameDay).length;
  const revenueM = salesListM.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const revenuePrev = salesIn(prevMonthStart, prevSameDay).reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const spendThisMonth = spendBetween(data.adSpend, monthStart, today);
  const spendPrev = spendBetween(data.adSpend, prevMonthStart, prevSameDay);
  const callsM = C.filter((c) => ['Realizada', 'Cliente', 'Perdido'].includes(c.stage) && monthKey(c.stage_updated_at) === thisMonth).length;

  const costPerLead = leadsM > 0 ? spendThisMonth / leadsM : null;
  const costPerSale = salesM > 0 ? spendThisMonth / salesM : null;
  const roiPct = spendThisMonth > 0 ? ((revenueM - spendThisMonth) / spendThisMonth) * 100 : null;
  const closeRate = callsM > 0 ? salesM / callsM : null;

  const adsWithPerf = data.adSpend.filter((ad) => monthKey(ad.start_date) === thisMonth && (ad.impressions || ad.ctr));
  const totalImpressions = adsWithPerf.reduce((s, ad) => s + (Number(ad.impressions) || 0), 0);
  const withCtr = adsWithPerf.filter((ad) => ad.ctr);
  const avgCtr = withCtr.length ? (withCtr.reduce((s, ad) => s + Number(ad.ctr), 0) / withCtr.length).toFixed(2) : null;

  // --- Embudo del mes --------------------------------------------------------
  const stageCounts = {};
  STAGES.forEach((s) => (stageCounts[s] = 0));
  C.forEach((c) => {
    if (monthKey(c.stage_updated_at) === thisMonth) stageCounts[c.stage] = (stageCounts[c.stage] || 0) + 1;
  });
  const funnelColors = ['#5ECCFA', '#7FD9F7', '#FBBF24', '#A3E3FB', '#4ADE80'];
  const funnel = STAGES.filter((s) => s !== 'Perdido').map((s, i) => ({ label: s, value: stageCounts[s] || 0, color: funnelColors[i] }));
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.value));

  // --- Contenido de hoy / mañana ------------------------------------------
  const videoByEntry = {};
  data.videos.forEach((v) => { if (v.calendar_entry_id) videoByEntry[v.calendar_entry_id] = v; });
  const byTime = (a, b) => String(a.publish_time || '99').localeCompare(String(b.publish_time || '99'));
  const tomorrow = dateToISO(new Date(Date.now() + DAY));
  const todayEntries = data.calendarEntries.filter((e) => e.date === today).sort(byTime);
  const tomorrowEntries = data.calendarEntries.filter((e) => e.date === tomorrow).sort(byTime);
  const todayDone = todayEntries.filter((e) => publishStatusOf(e, videoByEntry[e.id]) === 'publicado').length;

  // Racha: días seguidos subiendo contenido (Calendario "hecho" + Vídeos subidos)
  const doneDates = new Set(data.calendarEntries.filter((e) => e.status === 'hecho' && !e.script_id).map((e) => e.date));
  data.videos.forEach((v) => { if (v.uploaded && v.uploaded_at) doneDates.add(v.uploaded_at.slice(0, 10)); });
  let streak = 0;
  {
    const cursor = new Date();
    if (!doneDates.has(dateToISO(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (doneDates.has(dateToISO(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }
  const totalCompletedEver = data.calendarEntries.filter((e) => e.status === 'hecho' && !e.script_id).length + data.videos.filter((v) => v.uploaded).length;
  const streakColor = streak >= 7 ? 'var(--color-green)' : streak >= 3 ? 'var(--color-amber)' : 'var(--color-cyan)';
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * DAY);
    return { iso: dateToISO(d), label: d.toLocaleDateString('es-ES', { weekday: 'narrow' }) };
  });

  // --- Tareas y renovaciones ------------------------------------------------
  const in7 = dateToISO(new Date(Date.now() + 7 * DAY));
  const renewalsSoon = data.activeClients
    .filter((c) => c.status === 'Activo' && c.renewal_date && c.renewal_date <= in7)
    .sort((a, b) => a.renewal_date.localeCompare(b.renewal_date));
  const myTasks = meId ? data.tasks.filter((t) => t.assigned_to === meId) : data.tasks;
  const pendingTasks = myTasks.filter((t) => !t.done).sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
  const dueThisWeek = myTasks.filter((t) => t.due_date && t.due_date >= startOfWeekISO);
  const taskPct = dueThisWeek.length
    ? dueThisWeek.filter((t) => t.done).length / dueThisWeek.length
    : myTasks.length ? myTasks.filter((t) => t.done).length / myTasks.length : 0;
  const activeClientsCount = data.activeClients.filter((c) => c.status === 'Activo').length;

  // --- Gráfica 14 días ------------------------------------------------------
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = dateToISO(new Date(Date.now() - (13 - i) * DAY));
    return {
      label: new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
      Contactos: C.filter((r) => (r.created_at || '').slice(0, 10) === d).length,
      Ventas: C.filter((r) => r.stage === 'Cliente' && (r.stage_updated_at || '').slice(0, 10) === d).length,
    };
  });
  const leads14 = last14.reduce((s, x) => s + x.Contactos, 0);
  const sales14 = last14.reduce((s, x) => s + x.Ventas, 0);

  // --- Objetivos -------------------------------------------------------------
  const goalProgress = (g) => {
    switch (g.metric) {
      case 'ventas':
      case 'clientes_nuevos': return { current: salesM, target: g.target };
      case 'facturacion': return { current: revenueM, target: g.target };
      case 'inversion_ads': return { current: spendThisMonth, target: g.target };
      case 'clientes_activos_total': return { current: activeClientsCount, target: g.target };
      default: return { current: Number(g.manual_current) || 0, target: g.target };
    }
  };

  const hour = now.getHours();
  const greeting = hour < 13 ? 'Buenos días' : hour < 21 ? 'Buenas tardes' : 'Buenas noches';
  const dateLabel = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtDay = (iso) => {
    const diff = daysBetween(today, iso);
    if (iso < today) return 'vencida';
    if (diff === 0) return 'hoy';
    if (diff === 1) return 'mañana';
    return new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
  };

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
        <div className="flex gap-2 flex-wrap">
          <Link href="/contenido" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold bg-cyan text-[#00161C]">
            <Plus size={14} /> Contenido
          </Link>
          <Link href="/contactos" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold border border-border text-ink hover:border-cyan">
            <Plus size={14} /> Lead
          </Link>
          <Link href="/tareas" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold border border-border text-ink hover:border-cyan">
            <Plus size={14} /> Tarea
          </Link>
        </div>
      </div>

      {/* ── KPIs del mes ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={DollarSign} label="Ingresos del mes" value={eur(revenueM)} current={revenueM} previous={revenuePrev} accent="#4ADE80" href="/ventas" />
        <KpiCard icon={ShoppingBag} label="Ventas del mes" value={salesM} current={salesM} previous={salesPrev} accent="#5ECCFA" href="/ventas" />
        <KpiCard icon={Users} label="Leads nuevos" value={leadsM} current={leadsM} previous={leadsPrev} accent="#7FD9F7" href="/contactos" />
        <KpiCard icon={Megaphone} label="Inversión en anuncios" value={eur(spendThisMonth)} current={spendThisMonth} previous={spendPrev} accent="#FBBF24" href="/anuncios" invert />
      </div>

      {/* ── Tu día ───────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-3">
        {/* Contenido de hoy */}
        <Card className="lg:col-span-2" style={{ borderColor: todayEntries.length && todayDone < todayEntries.length ? 'var(--color-cyan)' : undefined }}>
          <SectionTitle
            icon={CalendarDays}
            href="/contenido"
            linkLabel="Calendario"
            right={todayEntries.length > 0 && (
              <span className="ml-auto mr-2 text-[11px] font-bold rounded-full px-2 py-0.5" style={{ background: '#5ECCFA1A', color: 'var(--color-cyan)' }}>
                {todayDone}/{todayEntries.length} publicado
              </span>
            )}
          >
            Contenido de hoy
          </SectionTitle>
          {todayEntries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-5 text-center">
              <div className="text-muted text-sm">No hay nada programado para hoy.</div>
              <Link href="/contenido" className="inline-flex items-center gap-1 text-cyan text-xs font-semibold mt-2"><Plus size={13} /> Planificar contenido</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {todayEntries.map((e) => {
                const meta = categoriesMap[e.type] || { label: 'Sin categoría', color: '#7C878B' };
                const st = publishStatusOf(e, videoByEntry[e.id]);
                const s = PUBLISH_STATUSES[st];
                const done = st === 'publicado';
                return (
                  <div key={e.id} className="flex items-center gap-3 rounded-lg bg-surfaceAlt border border-border p-2.5">
                    <button
                      onClick={() => toggleEntry(e)}
                      className="w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0"
                      style={{ borderColor: done ? 'var(--color-green)' : 'var(--color-border)', background: done ? 'var(--color-green)' : 'transparent' }}
                      aria-label={done ? 'Marcar como pendiente' : 'Marcar como publicado'}
                    >
                      {done && <Check size={14} color="#00161C" strokeWidth={3} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className={`text-ink text-sm font-semibold truncate ${done ? 'line-through opacity-60' : ''}`}>{e.title}</div>
                      <div className="flex items-center gap-2 text-[11px] mt-0.5">
                        <span className="flex items-center gap-1" style={{ color: meta.color }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} /> {meta.label}
                        </span>
                        {e.publish_time && <span className="text-muted flex items-center gap-1"><Clock size={11} /> {String(e.publish_time).slice(0, 5)}</span>}
                      </div>
                    </div>
                    <span className="text-[10.5px] font-bold rounded-full px-2 py-0.5 shrink-0" style={{ background: `${s.color}1A`, color: s.color }}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          )}
          {tomorrowEntries.length > 0 && (
            <div className="text-muted text-xs mt-3 pt-3 border-t border-border">
              <span className="text-ink font-semibold">Mañana:</span> {tomorrowEntries.map((e) => e.title).join(' · ')}
            </div>
          )}
        </Card>

        {/* Racha */}
        <Card className="flex flex-col">
          <SectionTitle icon={Flame}>Racha de contenido</SectionTitle>
          <div className="flex items-end gap-3">
            <div className="font-display text-[44px] leading-none" style={{ color: streakColor }}>{streak}</div>
            <div className="pb-1">
              <div className="text-ink text-sm font-semibold">{streak === 1 ? 'día seguido' : 'días seguidos'}</div>
              <div className="text-muted text-[11px]">{streak === 0 ? 'Sube algo hoy para empezar' : 'Que no se corte hoy'}</div>
            </div>
          </div>
          <div className="flex gap-1.5 mt-4">
            {last7.map((d) => {
              const hit = doneDates.has(d.iso);
              return (
                <div key={d.iso} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full h-7 rounded-md"
                    style={{ background: hit ? streakColor : 'var(--color-surfaceAlt)', border: d.iso === today ? '1px solid var(--color-cyan)' : '1px solid var(--color-border)' }}
                    title={hit ? 'Subiste contenido' : 'Sin contenido'}
                  />
                  <span className="text-muted text-[10px] uppercase">{d.label}</span>
                </div>
              );
            })}
          </div>
          <div className="flex-1" />
          <div className="text-muted text-xs mt-4 pt-3 border-t border-border">
            <span className="text-ink font-bold">{totalCompletedEver}</span> piezas subidas en total
          </div>
        </Card>
      </div>

      {/* ── Pendientes ───────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2">
          <SectionTitle icon={ListChecks} href="/tareas">
            Tus tareas
            {pendingTasks.length > 0 && (
              <span className="ml-1 text-[10.5px] font-bold rounded-full px-2 py-0.5" style={{ background: '#FBBF241A', color: 'var(--color-amber)' }}>
                {pendingTasks.length}
              </span>
            )}
          </SectionTitle>
          <div className="mb-3">
            <ProgressBar pct={taskPct} color={taskPct >= 0.7 ? 'var(--color-green)' : taskPct >= 0.4 ? 'var(--color-amber)' : 'var(--color-red)'} />
            <div className="text-muted text-[11px] mt-1.5">{Math.round(taskPct * 100)}% de tus tareas de esta semana cumplidas</div>
          </div>
          {pendingTasks.length === 0 ? (
            <div className="text-muted text-sm py-3 text-center">Nada pendiente. Buen trabajo.</div>
          ) : (
            <div className="divide-y divide-border">
              {pendingTasks.slice(0, 5).map((t) => {
                const overdue = t.due_date && t.due_date < today;
                return (
                  <div key={t.id} className="flex items-center gap-3 py-2">
                    <button onClick={() => toggleTask(t)} className="w-5 h-5 rounded-md border-2 border-border shrink-0 hover:border-cyan" aria-label="Completar tarea" />
                    <span className="text-ink text-sm truncate flex-1">{t.title}</span>
                    {t.due_date && (
                      <span className="text-[11px] font-semibold shrink-0" style={{ color: overdue ? 'var(--color-red)' : 'var(--color-muted)' }}>
                        {overdue ? 'Atrasada' : fmtDay(t.due_date)}
                      </span>
                    )}
                  </div>
                );
              })}
              {pendingTasks.length > 5 && (
                <Link href="/tareas" className="block text-muted text-xs pt-2 hover:text-cyan">+{pendingTasks.length - 5} más</Link>
              )}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle icon={UserCheck} href="/clientes" linkLabel="Clientes">Renovaciones (7 días)</SectionTitle>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-display text-[32px] leading-none" style={{ color: renewalsSoon.length ? 'var(--color-amber)' : 'var(--color-ink)' }}>{renewalsSoon.length}</span>
            <span className="text-muted text-xs">de {activeClientsCount} clientes activos</span>
          </div>
          {renewalsSoon.length === 0 ? (
            <div className="text-muted text-sm">Ninguna renovación esta semana.</div>
          ) : (
            <div className="divide-y divide-border">
              {renewalsSoon.slice(0, 4).map((c) => (
                <div key={c.id} className="flex items-center justify-between py-1.5 text-sm gap-2">
                  <span className="text-ink truncate">{c.name}</span>
                  <span className="text-[11px] font-semibold shrink-0" style={{ color: c.renewal_date < today ? 'var(--color-red)' : 'var(--color-muted)' }}>{fmtDay(c.renewal_date)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Captación y ventas ───────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2">
          <SectionTitle
            icon={TrendingUp}
            right={
              <div className="ml-auto flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5 text-muted"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#5ECCFA' }} /> Contactos <b className="text-ink">{leads14}</b></span>
                <span className="flex items-center gap-1.5 text-muted"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#4ADE80' }} /> Ventas <b className="text-ink">{sales14}</b></span>
              </div>
            }
          >
            Últimos 14 días
          </SectionTitle>
          <div className="w-full h-[220px]">
            <ResponsiveContainer>
              <BarChart data={last14} barGap={2} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="0" vertical={false} />
                <XAxis dataKey="label" stroke="var(--color-muted)" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis stroke="var(--color-muted)" fontSize={10} allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <Tooltip
                  cursor={{ fill: 'var(--color-surfaceAlt)' }}
                  contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: 'var(--color-ink)', fontWeight: 700 }}
                  itemStyle={{ color: 'var(--color-ink)' }}
                />
                <Bar dataKey="Contactos" fill="#5ECCFA" radius={[4, 4, 0, 0]} maxBarSize={14} />
                <Bar dataKey="Ventas" fill="#4ADE80" radius={[4, 4, 0, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle icon={Filter} href="/contactos" linkLabel="Leads">Embudo del mes</SectionTitle>
          <div className="space-y-2.5">
            {funnel.map((f) => (
              <div key={f.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted">{f.label}</span>
                  <span className="text-ink font-bold">{f.value}</span>
                </div>
                <ProgressBar pct={f.value / maxFunnel} color={f.color} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-border">
            <div>
              <div className="text-ink font-display text-xl leading-none">{callsM}</div>
              <div className="text-muted text-[11px] mt-1">llamadas hechas</div>
            </div>
            <div>
              <div className="text-ink font-display text-xl leading-none">{closeRate === null ? '—' : `${Math.round(closeRate * 100)}%`}</div>
              <div className="text-muted text-[11px] mt-1">tasa de cierre</div>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Rentabilidad + objetivos ─────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-3">
        <Card>
          <SectionTitle icon={Percent} href="/anuncios" linkLabel="Anuncios">Rentabilidad del mes</SectionTitle>
          <div className="space-y-3">
            {[
              { label: 'Coste por lead', value: costPerLead !== null ? eur(costPerLead) : '—' },
              { label: 'Coste por venta', value: costPerSale !== null ? eur(costPerSale) : '—' },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between">
                <span className="text-muted text-sm">{r.label}</span>
                <span className="text-ink font-bold">{r.value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <span className="text-muted text-sm">ROI de anuncios</span>
              <span className="font-bold flex items-center gap-1" style={{ color: roiPct === null ? 'var(--color-muted)' : roiPct >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                {roiPct !== null && (roiPct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />)}
                {roiPct !== null ? `${roiPct >= 0 ? '+' : ''}${roiPct.toFixed(0)}%` : '—'}
              </span>
            </div>
            {(totalImpressions > 0 || avgCtr !== null) && (
              <div className="pt-3 border-t border-border space-y-3">
                {totalImpressions > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted text-sm">Impresiones (Meta)</span>
                    <span className="text-ink font-bold">{totalImpressions.toLocaleString('es-ES')}</span>
                  </div>
                )}
                {avgCtr !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted text-sm">CTR medio</span>
                    <span className="text-ink font-bold">{avgCtr}%</span>
                  </div>
                )}
              </div>
            )}
            {roiPct === null && <div className="text-muted text-[11px]">Aparece en cuanto registres inversión en anuncios este mes.</div>}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle
            icon={Target}
            right={
              <button onClick={() => setAddingGoal(!addingGoal)} className="text-cyan text-xs font-semibold flex items-center gap-1">
                <Plus size={14} /> Nuevo objetivo
              </button>
            }
          >
            Objetivos
          </SectionTitle>

          {addingGoal && (
            <div className="mb-3">
              <GoalForm value={goalForm} onChange={setGoalForm} onSubmit={addGoal} onCancel={() => setAddingGoal(false)} submitLabel="Crear objetivo" />
            </div>
          )}

          {goals.length === 0 && !addingGoal && (
            <div className="rounded-lg border border-dashed border-border p-5 text-center text-muted text-sm">
              Sin objetivos todavía. Crea el primero (p. ej. «Facturar 3000€ este mes»).
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            {goals.map((g) => {
              if (editingGoalId === g.id) {
                return (
                  <div key={g.id} className="sm:col-span-2">
                    <GoalForm value={editForm} onChange={setEditForm} onSubmit={saveEditGoal} onCancel={() => setEditingGoalId(null)} submitLabel="Guardar" />
                  </div>
                );
              }
              const { current, target } = goalProgress(g);
              const pct = target > 0 ? current / target : 0;
              const isMoney = g.metric === 'facturacion' || g.metric === 'inversion_ads';
              const done = target > 0 && current >= target;
              const fmt = (n) => (isMoney ? eur(n) : Number(n || 0).toLocaleString('es-ES'));
              return (
                <div key={g.id} className="group rounded-lg bg-surfaceAlt border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-ink text-sm font-semibold truncate">{g.title}</div>
                      <div className="text-muted text-[11px]">{g.period === 'semanal' ? 'Semanal' : 'Mensual'}</div>
                    </div>
                    <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 shrink-0">
                      <button onClick={() => startEditGoal(g)} className="text-muted" aria-label="Editar"><Pencil size={12} /></button>
                      <button onClick={() => removeGoal(g.id)} className="text-muted" aria-label="Borrar"><Trash2 size={12} /></button>
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between mt-2 mb-1.5">
                    <span className="text-ink font-bold text-sm">
                      {fmt(current)} <span className="text-muted font-normal">/ {fmt(target)}</span>
                    </span>
                    <span className="text-xs font-bold" style={{ color: done ? 'var(--color-green)' : 'var(--color-cyan)' }}>
                      {done ? '✓ Conseguido' : `${Math.round(pct * 100)}%`}
                    </span>
                  </div>
                  <ProgressBar pct={pct} color={done ? 'var(--color-green)' : 'var(--color-cyan)'} />
                  {g.metric === 'manual' && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-muted text-[11px]">Valor actual:</span>
                      <input
                        type="number"
                        value={g.manual_current ?? ''}
                        onChange={(e) => updateGoalManual(g.id, e.target.value)}
                        className="bg-surface border border-border text-ink rounded px-2 py-1 text-xs w-24 outline-none focus:border-cyan"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── Actividad ────────────────────────────────────────────── */}
      <Card>
        <SectionTitle icon={Activity}>Actividad reciente</SectionTitle>
        <ActivityFeed limit={8} />
      </Card>
    </div>
  );
}
