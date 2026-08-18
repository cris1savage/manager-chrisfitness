'use client';

import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui';
import { eur, todayISO } from '@/lib/config';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const PAGE_SIZE = 8;

function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-');
  return `${MONTH_NAMES[Number(m) - 1]} ${y.slice(2)}`;
}
function monthLabelFull(monthKey) {
  const [y, m] = monthKey.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}
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

export default function HistoryClient() {
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState('mensual'); // mensual | semanal
  const [monthlyRows, setMonthlyRows] = useState([]);
  const [weeklyRows, setWeeklyRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const load = async () => {
    const [m, w] = await Promise.all([
      supabase.from('monthly_history').select('*').order('month', { ascending: true }),
      supabase.from('weekly_history').select('*').order('week_start', { ascending: true }),
    ]);
    setMonthlyRows(m.data || []);
    setWeeklyRows(w.data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch1 = supabase.channel('monthly-history-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_history' }, load).subscribe();
    const ch2 = supabase.channel('weekly-history-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'weekly_history' }, load).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [mode]);

  const isMonthly = mode === 'mensual';
  const rows = isMonthly ? monthlyRows : weeklyRows;
  const keyField = isMonthly ? 'month' : 'week_start';
  const labelFn = isMonthly ? monthLabel : weekLabel;
  const currentKey = isMonthly ? todayISO().slice(0, 7) : startOfWeek(new Date()).toISOString().slice(0, 10);

  const chartData = rows.slice(-12).map((r) => ({
    label: labelFn(r[keyField]),
    Facturación: Number(r.revenue) || 0,
    'Inversión ads': Number(r.ad_spend) || 0,
  }));
  const sortedDesc = [...rows].sort((a, b) => b[keyField].localeCompare(a[keyField]));
  const visibleRows = sortedDesc.slice(0, visibleCount);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-ink text-[22px] tracking-wide">HISTORIAL</h2>
          <div className="text-muted text-xs">
            {isMonthly ? 'Tendencias reales, mes a mes — la referencia fiable.' : 'Pulso a corto plazo, semana a semana — más ruidoso, para tendencias mira Mensual.'}
          </div>
        </div>
        <div className="flex rounded-lg overflow-hidden border border-border shrink-0">
          {[{ k: 'mensual', l: 'Mensual' }, { k: 'semanal', l: 'Semanal' }].map(({ k, l }) => (
            <button
              key={k}
              onClick={() => setMode(k)}
              className="px-3 py-1.5 text-xs font-semibold"
              style={{ background: mode === k ? '#5ECCFA' : 'transparent', color: mode === k ? '#00161C' : '#7C878B' }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading && <Card className="text-center py-8 text-muted">Cargando…</Card>}
      {!loading && rows.length === 0 && (
        <Card className="text-center py-8 text-muted">Todavía no hay historial {isMonthly ? 'mensual' : 'semanal'} — se irá rellenando solo a partir de hoy.</Card>
      )}

      {!loading && rows.length > 0 && (
        <>
          <Card>
            <div className="text-muted text-[11.5px] uppercase tracking-wide mb-3">Facturación vs. inversión en anuncios</div>
            <div className="w-full h-[220px]">
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#212729" vertical={false} />
                  <XAxis dataKey="label" stroke="#7C878B" fontSize={isMonthly ? 10 : 9} tickLine={false} axisLine={{ stroke: '#212729' }} />
                  <YAxis stroke="#7C878B" fontSize={10} tickLine={false} axisLine={{ stroke: '#212729' }} width={40} />
                  <Tooltip contentStyle={{ background: '#151A1D', border: '1px solid #212729', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#F2F6F7' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="Facturación" stroke="#4ADE80" strokeWidth={2} dot={{ r: 3, fill: '#4ADE80' }} />
                  <Line type="monotone" dataKey="Inversión ads" stroke="#5ECCFA" strokeWidth={2} dot={{ r: 3, fill: '#5ECCFA' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="space-y-2">
            {visibleRows.map((r, i) => {
              const prev = sortedDesc[i + 1];
              const isCurrent = r[keyField] === currentKey;
              const profit = isMonthly ? (Number(r.revenue) || 0) - (Number(r.ad_spend) || 0) : null;
              const revenueDiff = prev && Number(prev.revenue) > 0 ? ((Number(r.revenue) - Number(prev.revenue)) / Number(prev.revenue)) * 100 : null;
              const DiffIcon = revenueDiff === null ? Minus : revenueDiff > 0 ? TrendingUp : revenueDiff < 0 ? TrendingDown : Minus;
              const diffColor = revenueDiff === null || revenueDiff === 0 ? '#7C878B' : revenueDiff > 0 ? '#4ADE80' : '#F87171';

              return (
                <Card key={r[keyField]} style={{ border: isCurrent ? '1px solid #5ECCFA' : undefined }}>
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <CalendarIcon size={15} className={isCurrent ? 'text-cyan' : 'text-muted'} />
                      <span className="text-ink font-bold text-sm capitalize">{isMonthly ? monthLabelFull(r.month) : weekLabel(r.week_start)}</span>
                      {isCurrent && <span className="text-cyan text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan/15">En curso</span>}
                    </div>
                    {revenueDiff !== null && (
                      <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: diffColor }}>
                        <DiffIcon size={13} /> {revenueDiff > 0 ? '+' : ''}{revenueDiff.toFixed(0)}% vs. {isMonthly ? 'mes' : 'semana'} anterior
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
                    {isMonthly ? (
                      <div className="rounded-lg p-2.5 bg-surfaceAlt border border-border">
                        <div className="text-muted text-[10px] uppercase tracking-wide">Beneficio</div>
                        <div className="font-display text-base" style={{ color: profit >= 0 ? '#4ADE80' : '#F87171' }}>{eur(profit)}</div>
                      </div>
                    ) : (
                      <div className="rounded-lg p-2.5 bg-surfaceAlt border border-border">
                        <div className="text-muted text-[10px] uppercase tracking-wide">Contactos nuevos</div>
                        <div className="text-ink font-display text-base">{r.new_contacts}</div>
                      </div>
                    )}
                    <div className="rounded-lg p-2.5 bg-surfaceAlt border border-border">
                      <div className="text-muted text-[10px] uppercase tracking-wide">{isMonthly ? 'Contactos nuevos' : 'Altas (clientes)'}</div>
                      <div className="text-ink font-display text-base">{isMonthly ? r.new_contacts : r.new_clients}</div>
                    </div>
                    {isMonthly && (
                      <>
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
                      </>
                    )}
                  </div>
                </Card>
              );
            })}

            {sortedDesc.length > visibleCount && (
              <button
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="w-full rounded-lg py-2.5 text-sm font-semibold text-muted border border-border flex items-center justify-center gap-1.5"
              >
                <ChevronDown size={15} /> Ver {Math.min(PAGE_SIZE, sortedDesc.length - visibleCount)} más ({sortedDesc.length - visibleCount} restantes)
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
