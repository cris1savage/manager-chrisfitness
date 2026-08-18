'use client';

import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Calendar as CalendarIcon } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui';
import { eur, todayISO } from '@/lib/config';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-');
  return `${MONTH_NAMES[Number(m) - 1]} ${y.slice(2)}`;
}
function monthLabelFull(monthKey) {
  const [y, m] = monthKey.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

export default function HistoryClient() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase.from('monthly_history').select('*').order('month', { ascending: true });
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('monthly-history-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_history' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentMonth = todayISO().slice(0, 7);
  const chartData = rows.map((r) => ({
    label: monthLabel(r.month),
    Facturación: Number(r.revenue) || 0,
    'Inversión ads': Number(r.ad_spend) || 0,
  }));
  const sortedDesc = [...rows].sort((a, b) => b.month.localeCompare(a.month));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-ink text-[22px] tracking-wide">HISTORIAL MENSUAL</h2>
        <div className="text-muted text-xs">
          Un resumen automático de cada mes — se actualiza solo cada día. El mes en curso se ve al final, marcado como &quot;en curso&quot;.
        </div>
      </div>

      {loading && <Card className="text-center py-8 text-muted">Cargando…</Card>}
      {!loading && rows.length === 0 && (
        <Card className="text-center py-8 text-muted">
          Todavía no hay historial guardado — se irá rellenando solo a partir de hoy, día a día.
        </Card>
      )}

      {!loading && rows.length > 0 && (
        <>
          <Card>
            <div className="text-muted text-[11.5px] uppercase tracking-wide mb-3">Facturación vs. inversión en anuncios</div>
            <div className="w-full h-[220px]">
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid stroke="#212729" vertical={false} />
                  <XAxis dataKey="label" stroke="#7C878B" fontSize={10} tickLine={false} axisLine={{ stroke: '#212729' }} />
                  <YAxis stroke="#7C878B" fontSize={10} tickLine={false} axisLine={{ stroke: '#212729' }} width={40} />
                  <Tooltip contentStyle={{ background: '#151A1D', border: '1px solid #212729', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#F2F6F7' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Facturación" fill="#4ADE80" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Inversión ads" fill="#5ECCFA" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="space-y-2">
            {sortedDesc.map((r, i) => {
              const prev = sortedDesc[i + 1]; // mes anterior en el tiempo (viene después en el array desc)
              const isCurrent = r.month === currentMonth;
              const profit = (Number(r.revenue) || 0) - (Number(r.ad_spend) || 0);
              const revenueDiff = prev && Number(prev.revenue) > 0 ? ((Number(r.revenue) - Number(prev.revenue)) / Number(prev.revenue)) * 100 : null;
              const DiffIcon = revenueDiff === null ? Minus : revenueDiff > 0 ? TrendingUp : revenueDiff < 0 ? TrendingDown : Minus;
              const diffColor = revenueDiff === null || revenueDiff === 0 ? '#7C878B' : revenueDiff > 0 ? '#4ADE80' : '#F87171';

              return (
                <Card key={r.month} style={{ border: isCurrent ? '1px solid #5ECCFA' : undefined }}>
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <CalendarIcon size={15} className={isCurrent ? 'text-cyan' : 'text-muted'} />
                      <span className="text-ink font-bold text-sm capitalize">{monthLabelFull(r.month)}</span>
                      {isCurrent && <span className="text-cyan text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan/15">En curso</span>}
                    </div>
                    {revenueDiff !== null && (
                      <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: diffColor }}>
                        <DiffIcon size={13} /> {revenueDiff > 0 ? '+' : ''}{revenueDiff.toFixed(0)}% vs. mes anterior
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="rounded-lg p-2.5 bg-surfaceAlt border border-border">
                      <div className="text-muted text-[10px] uppercase tracking-wide">Facturación</div>
                      <div className="text-ink font-display text-base">{eur(r.revenue)}</div>
                    </div>
                    <div className="rounded-lg p-2.5 bg-surfaceAlt border border-border">
                      <div className="text-muted text-[10px] uppercase tracking-wide">Inversión ads</div>
                      <div className="text-ink font-display text-base">{eur(r.ad_spend)}</div>
                    </div>
                    <div className="rounded-lg p-2.5 bg-surfaceAlt border border-border">
                      <div className="text-muted text-[10px] uppercase tracking-wide">Beneficio</div>
                      <div className="font-display text-base" style={{ color: profit >= 0 ? '#4ADE80' : '#F87171' }}>{eur(profit)}</div>
                    </div>
                    <div className="rounded-lg p-2.5 bg-surfaceAlt border border-border">
                      <div className="text-muted text-[10px] uppercase tracking-wide">Contactos nuevos</div>
                      <div className="text-ink font-display text-base">{r.new_contacts}</div>
                    </div>
                    <div className="rounded-lg p-2.5 bg-surfaceAlt border border-border">
                      <div className="text-muted text-[10px] uppercase tracking-wide">Clientes nuevos</div>
                      <div className="text-ink font-display text-base">{r.new_clients}</div>
                    </div>
                    <div className="rounded-lg p-2.5 bg-surfaceAlt border border-border">
                      <div className="text-muted text-[10px] uppercase tracking-wide">Clientes activos</div>
                      <div className="text-ink font-display text-base">{r.active_clients_count ?? '—'}</div>
                    </div>
                    <div className="rounded-lg p-2.5 bg-surfaceAlt border border-border">
                      <div className="text-muted text-[10px] uppercase tracking-wide">Contenido subido</div>
                      <div className="text-ink font-display text-base">{r.content_uploaded}</div>
                    </div>
                    <div className="rounded-lg p-2.5 bg-surfaceAlt border border-border">
                      <div className="text-muted text-[10px] uppercase tracking-wide">Tareas cumplidas</div>
                      <div className="text-ink font-display text-base">{r.tasks_completed}</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
