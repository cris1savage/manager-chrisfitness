'use client';

import { useEffect, useMemo, useState } from 'react';
import { Lock, TrendingUp, TrendingDown, Users, Tag, Calendar as CalendarIcon, DollarSign, Wallet, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { Card, StatCard } from '@/components/ui';
import { eur, todayISO } from '@/lib/config';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DURATION_MONTHS = { 'Mensual': 1, '3 meses': 3, '6 meses': 6, 'Anual': 12 };

function monthKeyOf(dateStr) {
  if (!dateStr) return null;
  return dateStr.slice(0, 7);
}
function monthLabel(key) {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[Number(m) - 1]} ${y.slice(2)}`;
}
function monthLabelFull(key) {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}
function monthsFor(duration) {
  return DURATION_MONTHS[duration] || 1; // Personalizada u otros: se trata como si el importe ya fuera mensual
}

export default function BillingClient() {
  const supabase = useMemo(() => createClient(), []);
  const [clients, setClients] = useState([]);
  const [billing, setBilling] = useState({}); // active_client_id -> row
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const load = async () => {
    const [clientsRes, billingRes, historyRes] = await Promise.all([
      supabase.from('active_clients').select('*').order('name', { ascending: true }),
      supabase.from('client_billing').select('*'),
      supabase.from('billing_history').select('*').order('month', { ascending: true }),
    ]);
    setClients(clientsRes.data || []);
    const map = {};
    (billingRes.data || []).forEach((b) => (map[b.active_client_id] = b));
    setBilling(map);
    setHistory(historyRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch1 = supabase.channel('billing-active-clients').on('postgres_changes', { event: '*', schema: 'public', table: 'active_clients' }, load).subscribe();
    const ch2 = supabase.channel('billing-client-billing').on('postgres_changes', { event: '*', schema: 'public', table: 'client_billing' }, load).subscribe();
    const ch3 = supabase.channel('billing-history').on('postgres_changes', { event: '*', schema: 'public', table: 'billing_history' }, load).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); supabase.removeChannel(ch3); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateBilling = async (clientId, key, value) => {
    const current = billing[clientId] || {};
    const next = { ...current, [key]: value, active_client_id: clientId, updated_at: new Date().toISOString() };
    setBilling((b) => ({ ...b, [clientId]: next }));
    await supabase.from('client_billing').upsert(next, { onConflict: 'active_client_id' });
  };

  const activeClients = clients.filter((c) => c.status === 'Activo');
  const priced = activeClients
    .map((c) => {
      const amount = billing[c.id]?.price_amount;
      if (amount == null || amount === '') return null;
      const months = monthsFor(c.duration);
      return { client: c, amount: Number(amount), months, monthlyEquivalent: Number(amount) / months };
    })
    .filter(Boolean);
  const mrr = priced.reduce((s, p) => s + p.monthlyEquivalent, 0);
  const avgTicket = priced.length ? mrr / priced.length : 0;
  const annualProjection = mrr * 12;

  const tagGroups = {};
  priced.forEach((p) => {
    const tag = billing[p.client.id]?.price_tag?.trim() || 'Sin etiqueta';
    if (!tagGroups[tag]) tagGroups[tag] = { count: 0, total: 0 };
    tagGroups[tag].count++;
    tagGroups[tag].total += p.monthlyEquivalent;
  });

  const altasPorMes = {};
  clients.forEach((c) => {
    const k = monthKeyOf(c.start_date);
    if (k) altasPorMes[k] = (altasPorMes[k] || 0) + 1;
  });
  const bajasPorMes = {};
  clients.filter((c) => c.status === 'Finalizado').forEach((c) => {
    const k = monthKeyOf(c.status_changed_at?.slice(0, 10));
    if (k) bajasPorMes[k] = (bajasPorMes[k] || 0) + 1;
  });
  const allMonths = [...new Set([...Object.keys(altasPorMes), ...Object.keys(bajasPorMes)])].sort().slice(-6);

  const currentMonth = todayISO().slice(0, 7);
  const historySorted = [...history].sort((a, b) => b.month.localeCompare(a.month));
  const chartData = history.slice(-12).map((h) => ({ label: monthLabel(h.month), 'Facturación real': Number(h.mrr) || 0 }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-display text-ink text-[22px] tracking-wide">FACTURACIÓN</h2>
          <div className="text-muted text-xs">Ticket real, quién paga qué, altas y bajas.</div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ background: '#FBBF2422', color: '#FBBF24', border: '1px solid #FBBF2455' }}>
          <Lock size={12} /> Solo tú ves esta página
        </div>
      </div>

      {loading && <Card className="text-center py-8 text-muted">Cargando…</Card>}

      {!loading && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={DollarSign} label="Facturación mensual real" value={eur(mrr)} color="#4ADE80" />
            <StatCard icon={Wallet} label="Ticket medio real" value={eur(avgTicket)} color="#5ECCFA" />
            <StatCard icon={TrendingUp} label="Proyección anual" value={eur(annualProjection)} color="#A78BFA" />
            <StatCard
              icon={Users}
              label="Clientes activos"
              value={activeClients.length}
              color="#FBBF24"
            />
          </div>
          {priced.length < activeClients.length && (
            <div className="text-muted text-[11px] -mt-2">{activeClients.length - priced.length} cliente(s) activo(s) sin precio puesto todavía.</div>
          )}

          {history.length > 0 && (
            <Card className="!p-0">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <div className="rounded-lg p-2 shrink-0" style={{ background: '#5ECCFA1A' }}>
                    <BarChart3 size={16} color="#5ECCFA" />
                  </div>
                  <div>
                    <div className="text-ink text-sm font-semibold">Historial mensual y anual</div>
                    <div className="text-muted text-[10.5px]">Evolución de tu facturación real, mes a mes</div>
                  </div>
                </div>
                {showHistory ? <ChevronUp size={16} className="text-muted shrink-0" /> : <ChevronDown size={16} className="text-muted shrink-0" />}
              </button>

              {showHistory && (
                <div className="px-4 pb-4 border-t border-border pt-3">
                  <div className="w-full h-[200px] mb-3">
                    <ResponsiveContainer>
                      <LineChart data={chartData}>
                        <CartesianGrid stroke="#212729" vertical={false} />
                        <XAxis dataKey="label" stroke="#7C878B" fontSize={9} tickLine={false} axisLine={{ stroke: '#212729' }} />
                        <YAxis stroke="#7C878B" fontSize={10} tickLine={false} axisLine={{ stroke: '#212729' }} width={40} />
                        <Tooltip contentStyle={{ background: '#151A1D', border: '1px solid #212729', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#F2F6F7' }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="Facturación real" stroke="#4ADE80" strokeWidth={2} dot={{ r: 3, fill: '#4ADE80' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5">
                    {historySorted.slice(0, 6).map((h) => (
                      <div key={h.month} className="flex items-center justify-between rounded-lg p-2 bg-surfaceAlt border border-border" style={{ borderColor: h.month === currentMonth ? '#5ECCFA' : undefined }}>
                        <div className="flex items-center gap-1.5">
                          <CalendarIcon size={12} className={h.month === currentMonth ? 'text-cyan' : 'text-muted'} />
                          <span className="text-ink text-sm capitalize">{monthLabelFull(h.month)}</span>
                          {h.month === currentMonth && <span className="text-cyan text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-cyan/15">En curso</span>}
                        </div>
                        <div className="text-right">
                          <div className="text-ink text-sm font-semibold">{eur(h.mrr)}</div>
                          <div className="text-muted text-[10px]">{h.active_clients_count} clientes · ticket {eur(h.avg_ticket)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {Object.keys(tagGroups).length > 0 && (
            <Card>
              <div className="text-muted text-[11.5px] uppercase tracking-wide mb-3 flex items-center gap-1.5"><Tag size={13} /> Por etiqueta de precio</div>
              <div className="space-y-2">
                {Object.entries(tagGroups).map(([tag, g]) => (
                  <div key={tag} className="flex items-center justify-between rounded-lg p-2.5 bg-surfaceAlt border border-border">
                    <div className="text-ink text-sm">{tag}</div>
                    <div className="text-right">
                      <div className="text-ink text-sm font-semibold">{eur(g.total)}/mes</div>
                      <div className="text-muted text-[11px]">{g.count} cliente{g.count !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {allMonths.length > 0 && (
            <Card>
              <div className="text-muted text-[11.5px] uppercase tracking-wide mb-3">Altas y bajas — últimos meses</div>
              <div className="space-y-1.5">
                {allMonths.map((m) => (
                  <div key={m} className="flex items-center justify-between text-sm">
                    <span className="text-ink">{monthLabel(m)}</span>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1" style={{ color: '#4ADE80' }}><TrendingUp size={13} /> {altasPorMes[m] || 0}</span>
                      <span className="flex items-center gap-1" style={{ color: '#F87171' }}><TrendingDown size={13} /> {bajasPorMes[m] || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <div className="text-muted text-[11.5px] uppercase tracking-wide mb-3 flex items-center gap-1.5"><Users size={13} /> Precio por cliente</div>
            <div className="text-muted text-[10.5px] -mt-2 mb-2">
              El importe es lo que paga cada vez que le toca (según su duración) — si es trimestral, pon lo que paga cada 3 meses; el equivalente mensual se calcula solo.
            </div>
            <div className="space-y-2">
              {clients.length === 0 && <div className="text-muted text-sm text-center py-4">Sin clientes activos todavía.</div>}
              {clients.map((c) => {
                const months = monthsFor(c.duration);
                const amount = billing[c.id]?.price_amount;
                const monthlyEq = amount != null && amount !== '' ? Number(amount) / months : null;
                return (
                  <div key={c.id} className="rounded-lg p-2.5 bg-surfaceAlt border border-border space-y-1.5">
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
                    {monthlyEq != null && months > 1 && (
                      <div className="text-muted text-[10.5px] pl-0.5">≈ {eur(monthlyEq)}/mes de media</div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
