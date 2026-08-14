'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Megaphone, Users, Video, DollarSign, Check, Target, UserCheck, CheckSquare,
  TrendingUp, TrendingDown, Minus, Activity, Percent, Plus, Trash2, ListChecks,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { Card, StatCard, Ring } from '@/components/ui';
import { CONTENT_TYPES, STAGES, todayISO, monthKey, eur, GOAL_METRICS } from '@/lib/config';
import ActivityFeed from '@/components/ActivityFeed';

export default function DashboardClient({ profile }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState(null);
  const [goals, setGoals] = useState([]);
  const [addingGoal, setAddingGoal] = useState(false);
  const [goalForm, setGoalForm] = useState({ title: '', metric: 'ventas', period: 'mensual', target: '' });

  const load = async () => {
    const [adSpend, contacts, calendarEntries, activeClients, tasks, goalsRows] = await Promise.all([
      supabase.from('ad_spend').select('*'),
      supabase.from('contacts').select('*'),
      supabase.from('calendar_entries').select('*'),
      supabase.from('active_clients').select('*'),
      supabase.from('tasks').select('*'),
      supabase.from('goals').select('*').order('created_at', { ascending: true }),
    ]);
    setData({
      adSpend: adSpend.data || [],
      contacts: contacts.data || [],
      calendarEntries: calendarEntries.data || [],
      activeClients: activeClients.data || [],
      tasks: tasks.data || [],
    });
    setGoals(goalsRows.data || []);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleEntry = async (entry) => {
    const nextStatus = entry.status === 'hecho' ? 'pendiente' : 'hecho';
    setData((d) => ({ ...d, calendarEntries: d.calendarEntries.map((e) => (e.id === entry.id ? { ...e, status: nextStatus } : e)) }));
    await supabase.from('calendar_entries').update({ status: nextStatus }).eq('id', entry.id);
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
    setGoalForm({ title: '', metric: 'ventas', period: 'mensual', target: '' });
    setAddingGoal(false);
    load();
  };

  const updateGoalManual = async (id, value) => {
    setGoals((g) => g.map((x) => (x.id === id ? { ...x, manual_current: value } : x)));
    await supabase.from('goals').update({ manual_current: Number(value) || 0 }).eq('id', id);
  };

  const removeGoal = async (id) => {
    setGoals((g) => g.filter((x) => x.id !== id));
    await supabase.from('goals').delete().eq('id', id);
  };

  if (!data) return <div className="text-muted py-12 text-center">Cargando panel…</div>;

  const thisMonth = monthKey(todayISO());
  const startOfWeekISO = (() => {
    const d = new Date();
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0, 10);
  })();

  const inPeriod = (dateStr, period) => {
    if (!dateStr) return false;
    if (period === 'semanal') return dateStr.slice(0, 10) >= startOfWeekISO;
    return monthKey(dateStr) === thisMonth;
  };

  // --- Contactos / embudo ---
  const stageCountsMonth = {};
  STAGES.forEach((s) => (stageCountsMonth[s] = 0));
  data.contacts.forEach((c) => {
    if (monthKey(c.stage_updated_at) === thisMonth) stageCountsMonth[c.stage] = (stageCountsMonth[c.stage] || 0) + 1;
  });
  const leadsM = data.contacts.filter((c) => monthKey(c.created_at) === thisMonth).length;
  const clientsThisMonth = data.contacts.filter((c) => c.stage === 'Cliente' && monthKey(c.stage_updated_at) === thisMonth);
  const salesM = clientsThisMonth.length;
  const revenueM = clientsThisMonth.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const callsM = data.contacts.filter((c) => ['Realizada', 'Cliente', 'Perdido'].includes(c.stage) && monthKey(c.stage_updated_at) === thisMonth).length;

  const funnel = STAGES.filter((s) => s !== 'Perdido').map((s, i) => ({
    label: s,
    value: stageCountsMonth[s] || 0,
    color: ['#5ECCFA', '#7FD9F7', '#FBBF24', '#4ADE80', '#4ADE80'][i] || '#5ECCFA',
  }));
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.value));

  // --- Anuncios (cálculo acumulado) ---
  const daysBetween = (a, b) => Math.max(0, Math.floor((new Date(b) - new Date(a)) / 86400000));
  const spendThisMonth = data.adSpend.reduce((sum, ad) => {
    const from = ad.start_date > `${thisMonth}-01` ? ad.start_date : `${thisMonth}-01`;
    const to = ad.status === 'Pausado' && ad.paused_at ? ad.paused_at : todayISO();
    if (to < from || monthKey(ad.start_date) > thisMonth) return sum;
    const days = daysBetween(from, to) + 1;
    return sum + Math.max(0, days) * (Number(ad.daily_amount) || 0);
  }, 0);

  const today = todayISO();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const todayEntries = data.calendarEntries.filter((e) => e.date === today);
  const tomorrowEntries = data.calendarEntries.filter((e) => e.date === tomorrow);

  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const renewalsSoon = (data.activeClients || []).filter((c) => c.status === 'Activo' && c.renewal_date && c.renewal_date <= in7);
  const pendingTasks = (data.tasks || []).filter((t) => !t.done).sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));
  const doneThisWeek = (data.tasks || []).filter((t) => t.done && t.completed_at && t.completed_at.slice(0, 10) >= startOfWeekISO).length;
  const dueThisWeek = (data.tasks || []).filter((t) => t.due_date && t.due_date >= startOfWeekISO);
  const taskCompletionPct = dueThisWeek.length ? dueThisWeek.filter((t) => t.done).length / dueThisWeek.length : (data.tasks.length ? data.tasks.filter((t) => t.done).length / data.tasks.length : 0);

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const idx = 13 - i;
    const d = new Date(Date.now() - idx * 86400000).toISOString().slice(0, 10);
    const label = new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    return {
      label,
      leads: data.contacts.filter((r) => r.created_at.slice(0, 10) === d).length,
      ventas: data.contacts.filter((r) => r.stage === 'Cliente' && r.stage_updated_at.slice(0, 10) === d).length,
    };
  });

  const costPerLead = leadsM > 0 ? spendThisMonth / leadsM : null;
  const costPerSale = salesM > 0 ? spendThisMonth / salesM : null;
  const roiPct = spendThisMonth > 0 ? ((revenueM - spendThisMonth) / spendThisMonth) * 100 : null;

  const goalProgress = (g) => {
    switch (g.metric) {
      case 'ventas': return { current: salesM, target: g.target };
      case 'clientes_nuevos': return { current: salesM, target: g.target };
      case 'facturacion': return { current: revenueM, target: g.target };
      case 'inversion_ads': return { current: spendThisMonth, target: g.target };
      default: return { current: Number(g.manual_current) || 0, target: g.target };
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-ink text-[26px] tracking-wide">HOLA, {(profile?.display_name || '').toUpperCase()}</h1>
        <div className="text-muted text-sm">
          Chris Fitness · Entrenador Online · {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      {/* Widget del día */}
      <Card style={{ border: '1px solid #5ECCFA', boxShadow: '0 0 24px -8px #5ECCFA55' }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-cyan" style={{ boxShadow: '0 0 8px 2px #5ECCFA' }} />
          <span className="text-cyan font-extrabold text-xs tracking-widest">HOY TIENES QUE SUBIR</span>
        </div>
        {todayEntries.length === 0 ? (
          <div className="text-muted text-sm">No hay nada programado para hoy en el calendario de contenido.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {todayEntries.map((e) => {
              const meta = CONTENT_TYPES[e.type] || CONTENT_TYPES.reel_ig;
              const done = e.status === 'hecho';
              return (
                <div key={e.id} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
                  <button onClick={() => toggleEntry(e)} className={`text-sm font-semibold text-left ${done ? 'line-through opacity-50' : ''}`} style={{ color: '#F2F6F7' }}>
                    {meta.label}: {e.title}
                  </button>
                  {done && <Check size={13} color="#4ADE80" />}
                </div>
              );
            })}
          </div>
        )}
        {tomorrowEntries.length > 0 && (
          <div className="text-muted text-[11.5px] mt-2.5 border-t border-border pt-2">Mañana: {tomorrowEntries.map((e) => e.title).join(' · ')}</div>
        )}
      </Card>

      {/* Widget de tareas */}
      {pendingTasks.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <div className="text-muted text-[11.5px] uppercase tracking-wide flex items-center gap-1.5"><ListChecks size={13} /> Tareas pendientes</div>
            <span className="text-ink text-xs font-bold">{pendingTasks.length}</span>
          </div>
          <div className="space-y-1.5">
            {pendingTasks.slice(0, 4).map((t) => {
              const overdue = t.due_date && t.due_date < todayISO();
              return (
                <div key={t.id} className="flex items-center gap-2">
                  <button onClick={() => toggleTask(t)} className="shrink-0">
                    <div className="w-3.5 h-3.5 rounded border border-border" />
                  </button>
                  <span className="text-ink text-sm truncate flex-1">{t.title}</span>
                  {overdue && <span className="text-red text-[10px] font-semibold shrink-0">ATRASADA</span>}
                </div>
              );
            })}
            {pendingTasks.length > 4 && <div className="text-muted text-xs pt-1">+{pendingTasks.length - 4} más — ve a Tareas</div>}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Megaphone} label="Inversión anuncios (mes)" value={eur(spendThisMonth)} color="#5ECCFA" />
        <StatCard icon={Users} label="Contactos nuevos (mes)" value={leadsM} color="#7FD9F7" />
        <StatCard icon={Video} label="Llamadas realizadas (mes)" value={callsM} color="#FBBF24" />
        <StatCard icon={DollarSign} label="Ingresos (mes)" value={eur(revenueM)} color="#4ADE80" />
      </div>

      {(renewalsSoon.length > 0 || pendingTasks.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={UserCheck} label="Renovaciones ≤ 7 días" value={renewalsSoon.length} color={renewalsSoon.length ? '#F87171' : '#7C878B'} />
          <StatCard icon={CheckSquare} label="Tareas pendientes" value={pendingTasks.length} color="#FBBF24" />
        </div>
      )}

      <Card>
        <div className="text-muted text-[11.5px] uppercase tracking-wide mb-3 flex items-center gap-1.5"><Percent size={13} /> Rentabilidad · este mes</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard icon={DollarSign} label="Coste por lead" value={costPerLead !== null ? eur(costPerLead) : '—'} color="#5ECCFA" />
          <StatCard icon={DollarSign} label="Coste por venta" value={costPerSale !== null ? eur(costPerSale) : '—'} color="#FBBF24" />
          <StatCard
            icon={roiPct !== null && roiPct >= 0 ? TrendingUp : TrendingDown}
            label="ROI de anuncios"
            value={roiPct !== null ? `${roiPct >= 0 ? '+' : ''}${roiPct.toFixed(0)}%` : '—'}
            color={roiPct === null ? '#7C878B' : roiPct >= 0 ? '#4ADE80' : '#F87171'}
          />
        </div>
        {roiPct === null && <div className="text-muted text-[11px] mt-2">Aparece en cuanto registres inversión en anuncios este mes.</div>}
      </Card>

      <div className="grid md:grid-cols-3 gap-3">
        <Card className="flex justify-around items-center flex-wrap gap-4 md:col-span-1">
          <Ring pct={taskCompletionPct} label="Tareas cumplidas" value={`${Math.round(taskCompletionPct * 100)}%`} color={taskCompletionPct >= 0.7 ? '#4ADE80' : taskCompletionPct >= 0.4 ? '#FBBF24' : '#F87171'} />
        </Card>
        <Card className="md:col-span-2">
          <div className="text-muted text-[11.5px] uppercase tracking-wide mb-3">Embudo · este mes</div>
          <div className="space-y-2">
            {funnel.map((f) => (
              <div key={f.label} className="flex items-center gap-2">
                <div className="text-ink text-xs w-[120px] shrink-0">{f.label}</div>
                <div className="flex-1 rounded bg-surfaceAlt h-4 overflow-hidden">
                  <div className="h-full transition-all" style={{ width: `${(f.value / maxFunnel) * 100}%`, background: f.color }} />
                </div>
                <div className="text-ink text-xs w-7 text-right shrink-0 font-bold">{f.value}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="text-muted text-[11.5px] uppercase tracking-wide mb-3">Contactos nuevos y ventas · últimos 14 días</div>
        <div className="w-full h-[180px]">
          <ResponsiveContainer>
            <BarChart data={last14}>
              <CartesianGrid stroke="#212729" vertical={false} />
              <XAxis dataKey="label" stroke="#7C878B" fontSize={10} tickLine={false} axisLine={{ stroke: '#212729' }} />
              <YAxis stroke="#7C878B" fontSize={10} allowDecimals={false} tickLine={false} axisLine={{ stroke: '#212729' }} width={24} />
              <Tooltip contentStyle={{ background: '#151A1D', border: '1px solid #212729', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#F2F6F7' }} />
              <Bar dataKey="leads" fill="#5ECCFA" radius={[3, 3, 0, 0]} name="Contactos" />
              <Bar dataKey="ventas" fill="#4ADE80" radius={[3, 3, 0, 0]} name="Ventas" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <div className="text-muted text-[11.5px] uppercase tracking-wide mb-3 flex items-center gap-1.5"><Activity size={13} /> Actividad reciente</div>
        <ActivityFeed limit={10} />
      </Card>

      {/* Objetivos personalizables */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="text-muted text-[11.5px] uppercase tracking-wide flex items-center gap-1.5"><Target size={13} /> Objetivos</div>
          <button onClick={() => setAddingGoal(!addingGoal)} className="text-cyan text-xs font-semibold flex items-center gap-1">
            <Plus size={14} /> Nuevo objetivo
          </button>
        </div>

        {addingGoal && (
          <div className="rounded-lg p-3 bg-surfaceAlt border border-border mb-3 space-y-2">
            <input
              value={goalForm.title}
              onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
              placeholder="Ej. Facturar 3000€ este mes"
              className="bg-surface border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full outline-none focus:border-cyan"
            />
            <div className="grid grid-cols-3 gap-2">
              <select
                value={goalForm.metric}
                onChange={(e) => setGoalForm({ ...goalForm, metric: e.target.value })}
                className="bg-surface border border-border text-ink rounded-lg px-2 py-2 text-xs outline-none focus:border-cyan"
              >
                {GOAL_METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
              <select
                value={goalForm.period}
                onChange={(e) => setGoalForm({ ...goalForm, period: e.target.value })}
                className="bg-surface border border-border text-ink rounded-lg px-2 py-2 text-xs outline-none focus:border-cyan"
              >
                <option value="mensual">Mensual</option>
                <option value="semanal">Semanal</option>
              </select>
              <input
                type="number"
                value={goalForm.target}
                onChange={(e) => setGoalForm({ ...goalForm, target: e.target.value })}
                placeholder="Meta"
                className="bg-surface border border-border text-ink rounded-lg px-2 py-2 text-xs w-full outline-none focus:border-cyan"
              />
            </div>
            <button onClick={addGoal} className="rounded-lg px-3 py-1.5 font-semibold text-xs bg-cyan text-[#00161C]">Crear objetivo</button>
          </div>
        )}

        {goals.length === 0 && !addingGoal && (
          <div className="text-muted text-sm text-center py-4">Sin objetivos todavía. Crea el primero arriba.</div>
        )}

        <div className="flex flex-wrap gap-4 justify-around">
          {goals.map((g) => {
            const { current, target } = goalProgress(g);
            const pct = target > 0 ? current / target : 0;
            const isMoney = g.metric === 'facturacion' || g.metric === 'inversion_ads';
            return (
              <div key={g.id} className="flex flex-col items-center gap-1.5">
                <Ring pct={pct} label={g.title} value={`${isMoney ? eur(current) : current}/${isMoney ? eur(target) : target}`} color="#5ECCFA" />
                {g.metric === 'manual' && (
                  <input
                    type="number"
                    value={g.manual_current}
                    onChange={(e) => updateGoalManual(g.id, e.target.value)}
                    className="bg-surfaceAlt border border-border text-ink rounded px-2 py-1 text-xs w-20 text-center outline-none focus:border-cyan"
                  />
                )}
                <button onClick={() => removeGoal(g.id)} className="text-muted"><Trash2 size={12} /></button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
