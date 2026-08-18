'use client';

import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, CalendarDays } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui';
import { eur } from '@/lib/config';

function startOfWeek(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function weekLabel(weekStart) {
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${start.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} – ${end.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}`;
}

export default function WeeklyHistoryClient() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase.from('weekly_history').select('*').order('week_start', { ascending: true });
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('weekly-history-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weekly_history' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentWeekStart = startOfWeek(new Date()).toISOString().slice(0, 10);
  const chartData = rows.slice(-12).map((r) => ({
    label: weekLabel(r.week_start),
    Facturación: Number(r.revenue) || 0,
    'Inversión ads': Number(r.ad_spend) || 0,
  }));
  const sortedDesc = [...rows].sort((a, b) => b.week_start.localeCompare(a.week_start));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-ink text-[22px] tracking-wide">HISTORIAL SEMANAL</h2>
        <div className="text-muted text-xs">
          Pulso a corto plazo — inversión, altas y facturación semana a semana. Para tendencias más fiables, mira el Historial mensual.
        </div>
      </div>

      {loading && <Card className="text-center py-8 text-muted">Cargando…</Card>}
      {!loading && rows.length === 0 && (
        <Card className="text-center py-8 text-muted">Todavía no hay historial semanal — se irá rellenando solo a partir de hoy.</Card>
      )}

      {!loading && rows.length > 0 && (
        <>
          <Card>
            <div className="text-muted text-[11.5px] uppercase tracking-wide mb-3">Últimas semanas</div>
            <div className="w-full h-[200px]">
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid stroke="#212729" vertical={false} />
                  <XAxis dataKey="label" stroke="#7C878B" fontSize={9} tickLine={false} axisLine={{ stroke: '#212729' }} />
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
              const prev = sortedDesc[i + 1];
              const isCurrent = r.week_start === currentWeekStart;
              const revenueDiff = prev && Number(prev.revenue) > 0 ? ((Number(r.revenue) - Number(prev.revenue)) / Number(prev.revenue)) * 100 : null;
              const DiffIcon = revenueDiff === null ? Minus : revenueDiff > 0 ? TrendingUp : revenueDiff < 0 ? TrendingDown : Minus;
              const diffColor = revenueDiff === null || revenueDiff === 0 ? '#7C878B' : revenueDiff > 0 ? '#4ADE80' : '#F87171';

              return (
                <Card key={r.week_start} style={{ border: isCurrent ? '1px solid #5ECCFA' : undefined }}>
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <CalendarDays size={15} className={isCurrent ? 'text-cyan' : 'text-muted'} />
                      <span className="text-ink font-bold text-sm">{weekLabel(r.week_start)}</span>
                      {isCurrent && <span className="text-cyan text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan/15">En curso</span>}
                    </div>
                    {revenueDiff !== null && (
                      <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: diffColor }}>
                        <DiffIcon size={13} /> {revenueDiff > 0 ? '+' : ''}{revenueDiff.toFixed(0)}% vs. semana anterior
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
                      <div className="text-muted text-[10px] uppercase tracking-wide">Contactos nuevos</div>
                      <div className="text-ink font-display text-base">{r.new_contacts}</div>
                    </div>
                    <div className="rounded-lg p-2.5 bg-surfaceAlt border border-border">
                      <div className="text-muted text-[10px] uppercase tracking-wide">Altas (clientes)</div>
                      <div className="text-ink font-display text-base">{r.new_clients}</div>
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
