'use client';

import { useEffect, useMemo, useState } from 'react';
import { Lock, TrendingUp, ChevronLeft, ChevronRight, DollarSign, Wallet, Users } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { Card, StatCard } from '@/components/ui';
import { eur, todayISO } from '@/lib/config';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTH_NAMES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DURATION_MONTHS = { 'Mensual': 1, '3 meses': 3, '6 meses': 6, 'Anual': 12 };
const TABS = [
  { key: 'clientes', label: 'Clientes' },
  { key: 'mensual', label: 'Mensual' },
  { key: 'anual', label: 'Anual' },
];

function monthsFor(duration) {
  return DURATION_MONTHS[duration] || 1;
}

export default function BillingClient() {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState('clientes');
  const [clients, setClients] = useState([]);
  const [billing, setBilling] = useState({}); // active_client_id -> row
  const [events, setEvents] = useState([]); // billing_events, todos
  const [loading, setLoading] = useState(true);
  const [monthAnchor, setMonthAnchor] = useState(new Date());
  const [yearAnchor, setYearAnchor] = useState(new Date().getFullYear());

  const load = async () => {
    const [clientsRes, billingRes, eventsRes] = await Promise.all([
      supabase.from('active_clients').select('*').order('name', { ascending: true }),
      supabase.from('client_billing').select('*'),
      supabase.from('billing_events').select('*').order('event_date', { ascending: true }),
    ]);
    setClients(clientsRes.data || []);
    const map = {};
    (billingRes.data || []).forEach((b) => (map[b.active_client_id] = b));
    setBilling(map);
    setEvents(eventsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch1 = supabase.channel('billing-active-clients').on('postgres_changes', { event: '*', schema: 'public', table: 'active_clients' }, load).subscribe();
    const ch2 = supabase.channel('billing-client-billing').on('postgres_changes', { event: '*', schema: 'public', table: 'client_billing' }, load).subscribe();
    const ch3 = supabase.channel('billing-events').on('postgres_changes', { event: '*', schema: 'public', table: 'billing_events' }, load).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); supabase.removeChannel(ch3); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clientById = useMemo(() => {
    const m = {};
    clients.forEach((c) => (m[c.id] = c));
    return m;
  }, [clients]);

  const updateBilling = async (clientId, key, value) => {
    const current = billing[clientId] || {};
    const wasUnset = current.price_amount == null;
    const next = { ...current, [key]: value, active_client_id: clientId, updated_at: new Date().toISOString() };
    setBilling((b) => ({ ...b, [clientId]: next }));
    await supabase.from('client_billing').upsert(next, { onConflict: 'active_client_id' });
    // Primera vez que se pone precio a este cliente: deja un primer punto en
    // el historial real, para no esperar al próximo ciclo de renovación.
    if (key === 'price_amount' && wasUnset && value != null) {
      await supabase.from('billing_events').upsert(
        { active_client_id: clientId, amount: value, event_date: todayISO() },
        { onConflict: 'active_client_id,event_date', ignoreDuplicates: true }
      );
    }
  };

  // ---------- Pestaña Mensual ----------
  const monthKey = `${monthAnchor.getFullYear()}-${String(monthAnchor.getMonth() + 1).padStart(2, '0')}`;
  const monthEvents = events.filter((e) => e.event_date.slice(0, 7) === monthKey);
  const monthTotal = monthEvents.reduce((s, e) => s + Number(e.amount), 0);
  const monthByDuration = {};
  monthEvents.forEach((e) => {
    const c = clientById[e.active_client_id];
    const dur = c?.duration || 'Sin duración';
    if (!monthByDuration[dur]) monthByDuration[dur] = { total: 0, items: [] };
    monthByDuration[dur].total += Number(e.amount);
    monthByDuration[dur].items.push({ ...e, clientName: c?.name || 'Cliente eliminado' });
  });

  // ---------- Pestaña Anual ----------
  const yearMonths = Array.from({ length: 12 }, (_, i) => {
    const key = `${yearAnchor}-${String(i + 1).padStart(2, '0')}`;
    const total = events.filter((e) => e.event_date.slice(0, 7) === key).reduce((s, e) => s + Number(e.amount), 0);
    return { key, i, total };
  });
  const yearTotal = yearMonths.reduce((s, m) => s + m.total, 0);
  const nonZeroMonths = yearMonths.filter((m) => m.total > 0);
  const maxMonth = nonZeroMonths.length ? nonZeroMonths.reduce((a, b) => (b.total > a.total ? b : a)) : null;
  const minMonth = nonZeroMonths.length ? nonZeroMonths.reduce((a, b) => (b.total < a.total ? b : a)) : null;
  const chartData = yearMonths.map((m) => ({ label: MONTH_NAMES[m.i], Facturación: m.total }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-display text-ink text-[22px] tracking-wide">FACTURACIÓN</h2>
          <div className="text-muted text-xs">Ticket real, quién paga qué, mensual y anual.</div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ background: '#FBBF2422', color: 'var(--color-amber)', border: '1px solid #FBBF2455' }}>
          <Lock size={12} /> Solo tú ves esta página
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1.5" style={{ minWidth: 'max-content' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0"
              style={{
                background: tab === t.key ? '#5ECCFA22' : 'transparent',
                border: `1px solid ${tab === t.key ? 'var(--color-cyan)' : 'var(--color-border)'}`,
                color: tab === t.key ? 'var(--color-cyan)' : 'var(--color-muted)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <Card className="text-center py-8 text-muted">Cargando…</Card>}

      {!loading && tab === 'clientes' && (
        <Card>
          <div className="text-muted text-[11.5px] uppercase tracking-wide mb-2 flex items-center gap-1.5"><Users size={13} /> Precio por cliente</div>
          <div className="text-muted text-[10.5px] -mt-1 mb-3">
            El importe es lo que paga cada vez que le toca (según su duración) — si es trimestral, pon lo que paga cada 3 meses.
          </div>
          <div className="space-y-2">
            {clients.length === 0 && <div className="text-muted text-sm text-center py-4">Sin clientes activos todavía.</div>}
            {clients.map((c) => {
              const months = monthsFor(c.duration);
              const amount = billing[c.id]?.price_amount;
              return (
                <div key={c.id} className="rounded-lg p-2.5 bg-surfaceAlt border border-border">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex-1 min-w-[120px]">
                      <div className="text-ink text-sm font-medium">{c.name}</div>
                      <div className="text-muted text-[10.5px]">{c.status} · {c.duration || 'Sin duración'}{c.program && ` · ${c.program}`}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted text-xs">€</span>
                      <input
                        type="number"
                        value={amount ?? ''}
                        onChange={(e) => updateBilling(c.id, 'price_amount', e.target.value ? Number(e.target.value) : null)}
                        placeholder="0"
                        className="bg-surface border border-border text-ink rounded-lg px-2 py-1.5 text-xs w-20 outline-none focus:border-cyan"
                      />
                      <span className="text-muted text-[10.5px]">/ {months === 1 ? 'mes' : `${months} meses`}</span>
                    </div>
                    <input
                      value={billing[c.id]?.price_tag ?? ''}
                      onChange={(e) => updateBilling(c.id, 'price_tag', e.target.value)}
                      placeholder="Etiqueta (ej. Precio antiguo)"
                      className="bg-surface border border-border text-ink rounded-lg px-2.5 py-1.5 text-xs w-full sm:w-48 outline-none focus:border-cyan"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {!loading && tab === 'mensual' && (
        <>
          <div className="flex items-center justify-between">
            <button onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))} className="p-2 rounded-lg border border-border text-ink shrink-0"><ChevronLeft size={16} /></button>
            <div className="text-ink font-bold capitalize">{MONTH_NAMES_FULL[monthAnchor.getMonth()]} {monthAnchor.getFullYear()}</div>
            <button onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))} className="p-2 rounded-lg border border-border text-ink shrink-0"><ChevronRight size={16} /></button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={DollarSign} label="Facturado este mes" value={eur(monthTotal)} color="var(--color-green)" />
            <StatCard icon={Users} label="Cobros este mes" value={monthEvents.length} color="var(--color-cyan)" />
          </div>

          {Object.keys(monthByDuration).length === 0 && (
            <Card className="text-center py-8 text-muted">Nada facturado este mes todavía.</Card>
          )}

          {Object.entries(monthByDuration).map(([dur, g]) => (
            <Card key={dur}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-ink text-sm font-semibold">{dur}</div>
                <div className="text-ink text-sm font-bold">{eur(g.total)}</div>
              </div>
              <div className="space-y-1">
                {g.items.map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-xs py-1 border-t border-border first:border-t-0 first:pt-0">
                    <span className="text-ink">{e.clientName}</span>
                    <span className="text-muted">{eur(e.amount)} · {new Date(e.event_date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </>
      )}

      {!loading && tab === 'anual' && (
        <>
          <div className="flex items-center justify-between">
            <button onClick={() => setYearAnchor(yearAnchor - 1)} className="p-2 rounded-lg border border-border text-ink shrink-0"><ChevronLeft size={16} /></button>
            <div className="text-ink font-bold">{yearAnchor}</div>
            <button onClick={() => setYearAnchor(yearAnchor + 1)} className="p-2 rounded-lg border border-border text-ink shrink-0"><ChevronRight size={16} /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard icon={Wallet} label={`Total ${yearAnchor}`} value={eur(yearTotal)} color="var(--color-green)" />
            <StatCard icon={TrendingUp} label="Mejor mes" value={maxMonth ? `${MONTH_NAMES[maxMonth.i]} · ${eur(maxMonth.total)}` : '—'} color="var(--color-cyan)" />
            <StatCard icon={TrendingUp} label="Mes más flojo" value={minMonth ? `${MONTH_NAMES[minMonth.i]} · ${eur(minMonth.total)}` : '—'} color="var(--color-red)" />
          </div>

          <Card>
            <div className="text-muted text-[11.5px] uppercase tracking-wide mb-3">Evolución del año</div>
            <div className="w-full h-[220px]">
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--color-muted)" fontSize={10} tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} />
                  <YAxis stroke="var(--color-muted)" fontSize={10} tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} width={44} />
                  <Tooltip contentStyle={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: 'var(--color-ink)' }} />
                  <Line type="monotone" dataKey="Facturación" stroke="var(--color-green)" strokeWidth={2} dot={{ r: 3, fill: 'var(--color-green)' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <div className="text-muted text-[11.5px] uppercase tracking-wide mb-3">Mes a mes</div>
            <div className="space-y-1.5">
              {yearMonths.map((m) => (
                <div key={m.key} className="flex items-center justify-between text-sm">
                  <span className="text-ink">{MONTH_NAMES_FULL[m.i]}</span>
                  <span
                    className="font-semibold"
                    style={{ color: maxMonth?.i === m.i && m.total > 0 ? 'var(--color-green)' : minMonth?.i === m.i && m.total > 0 ? 'var(--color-red)' : 'var(--color-ink)' }}
                  >
                    {eur(m.total)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
