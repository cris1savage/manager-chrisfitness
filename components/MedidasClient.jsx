'use client';

import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { MEASUREMENTS } from '@/lib/timeline';
import MunecoMedidas from '@/components/MunecoMedidas';

const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const MEASURE_COLORS = {
  Cuello: '#5ECCFA', Hombros: '#A78BFA', Pecho: '#4ADE80',
  'Bíceps izq': '#FBBF24', 'Bíceps der': '#FB923C',
  'Antebrazo izq': '#F87171', 'Antebrazo der': '#F472B6',
  Cintura: '#FBBF24', Cadera: '#A78BFA',
  'Muslo izq': '#34D399', 'Muslo der': '#6EE7B7',
  'Gemelo izq': '#93C5FD', 'Gemelo der': '#BAE6FD',
};

function monthLabel(ym) {
  const [, mm] = ym.split('-');
  return MONTH_SHORT[Number(mm) - 1];
}

export default function MedidasClient({ checkins }) {
  const [selected, setSelected] = useState('Cintura');

  // Última y penúltima medición de cada parte
  const sortedCheckins = [...checkins].sort((a, b) => b.month.localeCompare(a.month));
  const lastMeasurements = {};
  const prevMeasurements = {};
  sortedCheckins.forEach((c) => {
    if (!c.measurements) return;
    Object.entries(c.measurements).forEach(([k, v]) => {
      if (v == null) return;
      if (lastMeasurements[k] == null) lastMeasurements[k] = { val: v, month: c.month };
      else if (prevMeasurements[k] == null) prevMeasurements[k] = { val: v, month: c.month };
    });
  });

  // Mediciones actuales y previas para el muñeco
  const currentVals = Object.fromEntries(Object.entries(lastMeasurements).map(([k, v]) => [k, v.val]));
  const prevVals    = Object.fromEntries(Object.entries(prevMeasurements).map(([k, v]) => [k, v.val]));

  // Serie para la gráfica
  const serie = [...checkins]
    .sort((a, b) => a.month.localeCompare(b.month))
    .filter((c) => c.measurements?.[selected] != null)
    .map((c) => ({ label: monthLabel(c.month), valor: Number(c.measurements[selected]) }));

  const firstVal = serie.length ? serie[0].valor : null;
  const lastVal  = serie.length ? serie[serie.length - 1].valor : null;
  const totalDiff = firstVal != null && lastVal != null && serie.length >= 2
    ? Math.round((lastVal - firstVal) * 10) / 10 : null;

  return (
    <div className="space-y-5">

      {/* Layout: muñeco + tabla lado a lado en pantallas grandes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">

        {/* Muñeco interactivo */}
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
          <div className="text-muted text-[10px] uppercase tracking-widest mb-3">
            Pulsa un punto para ver el detalle
          </div>
          <MunecoMedidas
            measurements={currentVals}
            prevMeasurements={prevVals}
            onSelect={(key) => setSelected(key)}
          />
        </div>

        {/* Tabla de medidas */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          <div className="grid grid-cols-[1fr_70px_70px_50px] px-4 py-2.5 text-muted text-[10px] uppercase tracking-widest"
            style={{ background: 'var(--color-surfaceAlt)' }}>
            <div>Medida</div>
            <div className="text-right">Actual</div>
            <div className="text-right">Anterior</div>
            <div className="text-right">Dif.</div>
          </div>
          {MEASUREMENTS.map((m, idx) => {
            const last = lastMeasurements[m];
            const prev = prevMeasurements[m];
            const diff = last && prev ? Math.round((last.val - prev.val) * 10) / 10 : null;
            const isSelected = selected === m;
            return (
              <button key={m} onClick={() => setSelected(m)}
                className="w-full grid grid-cols-[1fr_70px_70px_50px] px-4 py-2.5 items-center text-left transition-all"
                style={{
                  background: isSelected ? `${MEASURE_COLORS[m]}12` : idx % 2 === 0 ? 'var(--color-bg)' : 'var(--color-surface)',
                  borderTop: '1px solid var(--color-border)',
                  borderLeft: `2px solid ${isSelected ? MEASURE_COLORS[m] : 'transparent'}`,
                }}>
                <span className="text-sm font-semibold" style={{ color: isSelected ? MEASURE_COLORS[m] : 'var(--color-ink)' }}>
                  {m}
                </span>
                <span className="text-right text-sm font-bold" style={{ color: last ? 'var(--color-ink)' : 'var(--color-muted)' }}>
                  {last ? `${last.val}` : '—'}
                </span>
                <span className="text-right text-sm text-muted">{prev ? `${prev.val}` : '—'}</span>
                <span className="text-right text-xs font-bold"
                  style={{ color: diff == null ? 'var(--color-muted)' : diff < 0 ? 'var(--color-green)' : diff > 0 ? 'var(--color-red)' : 'var(--color-muted)' }}>
                  {diff != null ? `${diff > 0 ? '+' : ''}${diff}` : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Gráfica de evolución de la medida seleccionada */}
      <div className="rounded-xl p-4" style={{ background: '#0D1117', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-muted text-[10px] font-semibold uppercase tracking-widest">
            Evolución · <span style={{ color: MEASURE_COLORS[selected] }}>{selected}</span>
          </div>
          {totalDiff != null && (
            <div className="text-xs font-bold"
              style={{ color: totalDiff < 0 ? 'var(--color-green)' : totalDiff > 0 ? 'var(--color-red)' : 'var(--color-muted)' }}>
              Total: {totalDiff > 0 ? '+' : ''}{totalDiff} cm
            </div>
          )}
        </div>
        {serie.length < 2 ? (
          <div className="flex items-center justify-center h-28 text-muted text-sm">
            {serie.length === 0 ? `Sin registros de ${selected}` : 'Necesitas al menos 2 meses para ver la gráfica'}
          </div>
        ) : (
          <div className="w-full h-[180px]">
            <ResponsiveContainer>
              <LineChart data={serie} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#1C2226" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#5A6870', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#5A6870', fontSize: 11 }} tickLine={false} axisLine={false} width={30}
                  domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip
                  contentStyle={{ background: '#0D1117', border: '1px solid #1C2226', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#C8D5DA' }}
                  itemStyle={{ color: MEASURE_COLORS[selected] }}
                  formatter={(v) => [`${v} cm`, selected]}
                />
                <Line type="monotone" dataKey="valor"
                  stroke={MEASURE_COLORS[selected]} strokeWidth={2.5}
                  dot={{ r: 4, fill: MEASURE_COLORS[selected], stroke: '#0D1117', strokeWidth: 2 }}
                  activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Historial */}
      <div className="space-y-2">
        <div className="text-muted text-[10px] uppercase tracking-widest">Historial de mediciones</div>
        {sortedCheckins.filter((c) => c.measurements && Object.values(c.measurements).some((v) => v != null)).map((c) => (
          <div key={c.month} className="rounded-xl p-4" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
            <div className="text-ink text-xs font-bold mb-2">
              {MONTH_SHORT[Number(c.month.split('-')[1]) - 1]} {c.month.split('-')[0]}
              {c.weight && <span className="text-cyan ml-2">{c.weight} kg</span>}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {Object.entries(c.measurements).filter(([, v]) => v != null).map(([k, v]) => (
                <div key={k} className="text-xs">
                  <span className="text-muted">{k}: </span>
                  <span className="font-semibold" style={{ color: k === selected ? MEASURE_COLORS[k] : 'var(--color-ink)' }}>{v} cm</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {sortedCheckins.filter((c) => c.measurements && Object.values(c.measurements).some((v) => v != null)).length === 0 && (
          <div className="text-center py-8 text-muted text-sm">Sin mediciones registradas todavía.</div>
        )}
      </div>
    </div>
  );
}
