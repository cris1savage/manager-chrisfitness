'use client';

import { useEffect, useMemo, useState } from 'react';
import { Lock, TrendingUp, TrendingDown, Users, Tag } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui';
import { eur } from '@/lib/config';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function monthKey(dateStr) {
  if (!dateStr) return null;
  return dateStr.slice(0, 7);
}
function monthLabel(key) {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[Number(m) - 1]} ${y.slice(2)}`;
}

export default function BillingClient() {
  const supabase = useMemo(() => createClient(), []);
  const [clients, setClients] = useState([]);
  const [billing, setBilling] = useState({}); // active_client_id -> row
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [clientsRes, billingRes] = await Promise.all([
      supabase.from('active_clients').select('*').order('name', { ascending: true }),
      supabase.from('client_billing').select('*'),
    ]);
    setClients(clientsRes.data || []);
    const map = {};
    (billingRes.data || []).forEach((b) => (map[b.active_client_id] = b));
    setBilling(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch1 = supabase.channel('billing-active-clients').on('postgres_changes', { event: '*', schema: 'public', table: 'active_clients' }, load).subscribe();
    const ch2 = supabase.channel('billing-client-billing').on('postgres_changes', { event: '*', schema: 'public', table: 'client_billing' }, load).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateBilling = async (clientId, key, value) => {
    const current = billing[clientId] || {};
    const next = { ...current, [key]: value, active_client_id: clientId, updated_at: new Date().toISOString() };
    setBilling((b) => ({ ...b, [clientId]: next }));
    await supabase.from('client_billing').upsert(next, { onConflict: 'active_client_id' });
  };

  const activeClients = clients.filter((c) => c.status === 'Activo');
  const priced = activeClients.filter((c) => billing[c.id]?.monthly_price != null && billing[c.id]?.monthly_price !== '');
  const mrr = priced.reduce((s, c) => s + (Number(billing[c.id]?.monthly_price) || 0), 0);
  const avgTicket = priced.length ? mrr / priced.length : 0;
  const annualProjection = mrr * 12;

  const tagGroups = {};
  priced.forEach((c) => {
    const tag = billing[c.id]?.price_tag?.trim() || 'Sin etiqueta';
    if (!tagGroups[tag]) tagGroups[tag] = { count: 0, total: 0 };
    tagGroups[tag].count++;
    tagGroups[tag].total += Number(billing[c.id]?.monthly_price) || 0;
  });

  const altasPorMes = {};
  clients.forEach((c) => {
    const k = monthKey(c.start_date);
    if (k) altasPorMes[k] = (altasPorMes[k] || 0) + 1;
  });
  const bajasPorMes = {};
  clients.filter((c) => c.status === 'Finalizado').forEach((c) => {
    const k = monthKey(c.status_changed_at?.slice(0, 10));
    if (k) bajasPorMes[k] = (bajasPorMes[k] || 0) + 1;
  });
  const allMonths = [...new Set([...Object.keys(altasPorMes), ...Object.keys(bajasPorMes)])].sort().slice(-6);

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
            <Card>
              <div className="text-muted text-[11px] uppercase tracking-wide">Facturación mensual</div>
              <div className="text-ink text-xl font-extrabold font-display">{eur(mrr)}</div>
            </Card>
            <Card>
              <div className="text-muted text-[11px] uppercase tracking-wide">Ticket medio real</div>
              <div className="text-ink text-xl font-extrabold font-display">{eur(avgTicket)}</div>
            </Card>
            <Card>
              <div className="text-muted text-[11px] uppercase tracking-wide">Proyección anual</div>
              <div className="text-ink text-xl font-extrabold font-display">{eur(annualProjection)}</div>
            </Card>
            <Card>
              <div className="text-muted text-[11px] uppercase tracking-wide">Clientes activos</div>
              <div className="text-ink text-xl font-extrabold font-display">{activeClients.length}</div>
              {priced.length < activeClients.length && (
                <div className="text-muted text-[10px] mt-0.5">{activeClients.length - priced.length} sin precio puesto</div>
              )}
            </Card>
          </div>

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
            <div className="space-y-2">
              {clients.length === 0 && <div className="text-muted text-sm text-center py-4">Sin clientes activos todavía.</div>}
              {clients.map((c) => (
                <div key={c.id} className="flex items-center gap-2 flex-wrap rounded-lg p-2.5 bg-surfaceAlt border border-border">
                  <div className="flex-1 min-w-[120px]">
                    <div className="text-ink text-sm font-medium">{c.name}</div>
                    <div className="text-muted text-[10.5px]">{c.status}{c.program && ` · ${c.program}`}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted text-xs">€</span>
                    <input
                      type="number"
                      value={billing[c.id]?.monthly_price ?? ''}
                      onChange={(e) => updateBilling(c.id, 'monthly_price', e.target.value ? Number(e.target.value) : null)}
                      placeholder="0"
                      className="bg-surface border border-border text-ink rounded-lg px-2 py-1.5 text-xs w-20 outline-none focus:border-cyan"
                    />
                    <span className="text-muted text-[10.5px]">/mes</span>
                  </div>
                  <input
                    value={billing[c.id]?.price_tag ?? ''}
                    onChange={(e) => updateBilling(c.id, 'price_tag', e.target.value)}
                    placeholder="Etiqueta (ej. Precio antiguo)"
                    className="bg-surface border border-border text-ink rounded-lg px-2.5 py-1.5 text-xs w-full sm:w-48 outline-none focus:border-cyan"
                  />
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
