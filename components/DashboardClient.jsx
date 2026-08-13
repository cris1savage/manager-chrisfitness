'use client';

import { useEffect, useMemo, useState } from 'react';
import { Megaphone, Users, Video, DollarSign, Check, Target, Film, Clapperboard, Instagram, UserCheck, CheckSquare, TrendingUp, TrendingDown, Minus, Activity, Percent } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { Card, StatCard, Ring } from '@/components/ui';
import { todayISO, monthKey, eur } from '@/lib/config';
import ActivityFeed from '@/components/ActivityFeed';

const CONTENT_META = {
  video: { label: 'Video', color: '#5ECCFA', Icon: Film },
  reel: { label: 'Reel', color: '#4ADE80', Icon: Clapperboard },
  historia: { label: 'Historia', color: '#FBBF24', Icon: Instagram },
};

const TABLES = ['ad_spend', 'leads', 'conversations', 'invites', 'calls', 'sales', 'calendar_entries'];

export default function DashboardClient({ profile }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState(null);
  const [goals, setGoals] = useState({ leads_goal: 40, sales_goal: 6, ad_budget_monthly: 250, revenue_goal: 3000 });

  const load = async () => {
    const [adSpend, leads, conversations, invites, calls, sales, calendarEntries, activeClients, tasks, goalsRow] = await Promise.all([
      supabase.from('ad_spend').select('*'),
      supabase.from('leads').select('*'),
      supabase.from('conversations').select('*'),
      supabase.from('invites').select('*'),
      supabase.from('calls').select('*'),
      supabase.from('sales').select('*'),
      supabase.from('calendar_entries').select('*'),
      supabase.from('active_clients').select('*'),
      supabase.from('tasks').select('*'),
      supabase.from('goals').select('*').eq('id', 1).single(),
    ]);
    setData({
      adSpend: adSpend.data || [],
      leads: leads.data || [],
      conversations: conversations.data || [],
      invites: invites.data || [],
      calls: calls.data || [],
      sales: sales.data || [],
      calendarEntries: calendarEntries.data || [],
      activeClients: activeClients.data || [],
      tasks: tasks.data || [],
    });
    if (goalsRow.data) setGoals(goalsRow.data);
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
    setData((d) => ({
      ...d,
      calendarEntries: d.calendarEntries.map((e) => (e.id === entry.id ? { ...e, status: nextStatus } : e)),
    }));
    await supabase.from('calendar_entries').update({ status: nextStatus }).eq('id', entry.id);
  };

  const saveGoals = async (next) => {
    setGoals(next);
    await supabase.from('goals').update(next).eq('id', 1);
  };

  if (!data) {
    return <div className="text-muted py-12 text-center">Cargando panel…</div>;
  }

  const thisMonth = monthKey(todayISO());
  const countMonth = (arr) => arr.filter((r) => monthKey(r.date) === thisMonth).length;
  const sumMonth = (arr, f) => arr.filter((r) => monthKey(r.date) === thisMonth).reduce((s, r) => s + (Number(r[f]) || 0), 0);

  const leadsM = countMonth(data.leads);
  const convM = countMonth(data.conversations);
  const invM = countMonth(data.invites);
  const callsM = countMonth(data.calls);
  const salesM = countMonth(data.sales);
  const revenueM = sumMonth(data.sales, 'amount');
  const adSpendM = sumMonth(data.adSpend, 'amount');

  const today = todayISO();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const todayEntries = data.calendarEntries.filter((e) => e.date === today);
  const tomorrowEntries = data.calendarEntries.filter((e) => e.date === tomorrow);

  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const renewalsSoon = (data.activeClients || []).filter(
    (c) => c.status === 'Activo' && c.renewal_date && c.renewal_date <= in7
  );
  const pendingTasks = (data.tasks || []).filter((t) => !t.done);

  const funnel = [
    { label: 'Leads', value: leadsM, color: '#5ECCFA' },
    { label: 'Conversaciones', value: convM, color: '#7FD9F7' },
    { label: 'Invitaciones', value: invM, color: '#4ADE80' },
    { label: 'Videollamadas', value: callsM, color: '#FBBF24' },
    { label: 'Ventas', value: salesM, color: '#F87171' },
  ];
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.value));

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const idx = 13 - i;
    const d = new Date(Date.now() - idx * 86400000).toISOString().slice(0, 10);
    const label = new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    return {
      label,
      leads: data.leads.filter((r) => r.date === d).length,
      ventas: data.sales.filter((r) => r.date === d).length,
    };
  });

  // ROI y coste por lead / venta (mes actual)
  const costPerLead = leadsM > 0 ? adSpendM / leadsM : null;
  const costPerSale = salesM > 0 ? adSpendM / salesM : null;
  const roiPct = adSpendM > 0 ? ((revenueM - adSpendM) / adSpendM) * 100 : null;

  // Resumen semanal: últimos 7 días vs los 7 anteriores (sin email, solo en pantalla)
  const inRange = (arr, from, to) => arr.filter((r) => r.date >= from && r.date <= to);
  const weekStart = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const prevWeekStart = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);
  const prevWeekEnd = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const weekly = [
    { label: 'Leads', now: inRange(data.leads, weekStart, today).length, prev: inRange(data.leads, prevWeekStart, prevWeekEnd).length },
    { label: 'Conversaciones', now: inRange(data.conversations, weekStart, today).length, prev: inRange(data.conversations, prevWeekStart, prevWeekEnd).length },
    { label: 'Videollamadas', now: inRange(data.calls, weekStart, today).length, prev: inRange(data.calls, prevWeekStart, prevWeekEnd).length },
    { label: 'Ventas', now: inRange(data.sales, weekStart, today).length, prev: inRange(data.sales, prevWeekStart, prevWeekEnd).length },
    {
      label: 'Ingresos',
      now: inRange(data.sales, weekStart, today).reduce((s, r) => s + (Number(r.amount) || 0), 0),
      prev: inRange(data.sales, prevWeekStart, prevWeekEnd).reduce((s, r) => s + (Number(r.amount) || 0), 0),
      money: true,
    },
    {
      label: 'Inversión ads',
      now: inRange(data.adSpend, weekStart, today).reduce((s, r) => s + (Number(r.amount) || 0), 0),
      prev: inRange(data.adSpend, prevWeekStart, prevWeekEnd).reduce((s, r) => s + (Number(r.amount) || 0), 0),
      money: true,
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-ink text-[26px] tracking-wide">HOLA, {(profile?.display_name || '').toUpperCase()}</h1>
        <div className="text-muted text-sm">
          Chris Fitness · Entrenador Online ·{' '}
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
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
              const meta = CONTENT_META[e.type] || CONTENT_META.reel;
              const done = e.status === 'hecho';
              return (
                <div key={e.id} className="flex items-center gap-2">
                  <meta.Icon size={15} color={meta.color} />
                  <button
                    onClick={() => toggleEntry(e)}
                    className={`text-sm font-semibold ${done ? 'line-through opacity-50' : ''}`}
                    style={{ color: '#F2F6F7' }}
                  >
                    {meta.label}: {e.title}
                  </button>
                  {done && <Check size={13} color="#4ADE80" />}
                </div>
              );
            })}
          </div>
        )}
        {tomorrowEntries.length > 0 && (
          <div className="text-muted text-[11.5px] mt-2.5 border-t border-border pt-2">
            Mañana: {tomorrowEntries.map((e) => e.title).join(' · ')}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Megaphone} label="Inversión anuncios (mes)" value={eur(adSpendM)} color="#5ECCFA" />
        <StatCard icon={Users} label="Leads (mes)" value={leadsM} color="#7FD9F7" />
        <StatCard icon={Video} label="Videollamadas (mes)" value={callsM} color="#FBBF24" />
        <StatCard icon={DollarSign} label="Ingresos (mes)" value={eur(revenueM)} color="#4ADE80" />
      </div>

      {(renewalsSoon.length > 0 || pendingTasks.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={UserCheck} label="Renovaciones ≤ 7 días" value={renewalsSoon.length} color={renewalsSoon.length ? '#F87171' : '#7C878B'} />
          <StatCard icon={CheckSquare} label="Tareas pendientes" value={pendingTasks.length} color="#FBBF24" />
        </div>
      )}

      <Card>
        <div className="text-muted text-[11.5px] uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Percent size={13} /> Rentabilidad · este mes
        </div>
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
          <Ring pct={leadsM / (goals.leads_goal || 1)} label="Leads" value={`${leadsM}/${goals.leads_goal}`} color="#5ECCFA" />
          <Ring pct={salesM / (goals.sales_goal || 1)} label="Ventas" value={`${salesM}/${goals.sales_goal}`} color="#4ADE80" />
          <Ring
            pct={adSpendM / (goals.ad_budget_monthly || 1)}
            label="Presup. Ads"
            value={`${eur(adSpendM)}/${eur(goals.ad_budget_monthly)}`}
            color="#FBBF24"
          />
        </Card>

        <Card className="md:col-span-2">
          <div className="text-muted text-[11.5px] uppercase tracking-wide mb-3">Embudo de ventas · este mes</div>
          <div className="space-y-2">
            {funnel.map((f) => (
              <div key={f.label} className="flex items-center gap-2">
                <div className="text-ink text-xs w-[100px] shrink-0">{f.label}</div>
                <div className="flex-1 rounded bg-surfaceAlt h-4 overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${(f.value / maxFunnel) * 100}%`, background: f.color }}
                  />
                </div>
                <div className="text-ink text-xs w-7 text-right shrink-0 font-bold">{f.value}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="text-muted text-[11.5px] uppercase tracking-wide mb-3">Leads y ventas · últimos 14 días</div>
        <div className="w-full h-[180px]">
          <ResponsiveContainer>
            <BarChart data={last14}>
              <CartesianGrid stroke="#212729" vertical={false} />
              <XAxis dataKey="label" stroke="#7C878B" fontSize={10} tickLine={false} axisLine={{ stroke: '#212729' }} />
              <YAxis stroke="#7C878B" fontSize={10} allowDecimals={false} tickLine={false} axisLine={{ stroke: '#212729' }} width={24} />
              <Tooltip contentStyle={{ background: '#151A1D', border: '1px solid #212729', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#F2F6F7' }} />
              <Bar dataKey="leads" fill="#5ECCFA" radius={[3, 3, 0, 0]} name="Leads" />
              <Bar dataKey="ventas" fill="#4ADE80" radius={[3, 3, 0, 0]} name="Ventas" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <div className="text-muted text-[11.5px] uppercase tracking-wide mb-3">Resumen semanal · últimos 7 días vs los 7 anteriores</div>
        <div className="space-y-2">
          {weekly.map((w) => {
            const diff = w.prev === 0 ? (w.now > 0 ? 100 : 0) : ((w.now - w.prev) / w.prev) * 100;
            const flat = w.now === w.prev;
            const Icon = flat ? Minus : diff > 0 ? TrendingUp : TrendingDown;
            const color = flat ? '#7C878B' : diff > 0 ? '#4ADE80' : '#F87171';
            return (
              <div key={w.label} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid #212729' }}>
                <div className="text-ink text-sm">{w.label}</div>
                <div className="flex items-center gap-2">
                  <span className="text-ink text-sm font-bold">{w.money ? eur(w.now) : w.now}</span>
                  <span className="flex items-center gap-0.5 text-xs font-semibold" style={{ color }}>
                    <Icon size={12} /> {flat ? 'igual' : `${diff > 0 ? '+' : ''}${diff.toFixed(0)}%`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="text-muted text-[11.5px] uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Activity size={13} /> Actividad reciente
        </div>
        <ActivityFeed limit={10} />
      </Card>

      <Card>
        <div className="text-muted text-[11.5px] uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Target size={13} /> Metas mensuales
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { key: 'leads_goal', label: 'Meta de leads' },
            { key: 'sales_goal', label: 'Meta de ventas' },
            { key: 'ad_budget_monthly', label: 'Presupuesto ads (€)' },
            { key: 'revenue_goal', label: 'Meta de ingresos (€)' },
          ].map((g) => (
            <div key={g.key}>
              <div className="text-muted text-[10.5px] mb-1">{g.label}</div>
              <input
                type="number"
                value={goals[g.key]}
                onChange={(e) => saveGoals({ ...goals, [g.key]: Number(e.target.value) })}
                className="bg-surfaceAlt border border-border text-ink rounded-lg px-2 py-1.5 w-full text-sm outline-none focus:border-cyan"
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
