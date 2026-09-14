'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  phaseForDate, phaseColor, todayISO, STRENGTH_COLOR, GOAL_COLORS, monthLabelFull, calcKcalMedia,
} from '@/lib/timeline';

const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function safeMonth(ym) {
  if (!ym) return '';
  const [, mm] = ym.split('-');
  return MONTHS_SHORT[Number(mm) - 1] || '';
}

export default function VistaPublicaClient({ cliente }) {
  if (!cliente) return <div style={{ color: '#fff', padding: 40, textAlign: 'center' }}>Perfil no encontrado.</div>;

  const today   = todayISO();
  const phases  = cliente.phases || [];
  const phase   = phaseForDate(phases, today);
  const color   = phase ? phaseColor(phases, phase.name) : '#7C878B';

  const checkins = [...(cliente.tracking_checkins || [])].sort((a, b) => a.month.localeCompare(b.month));
  const weeks    = [...(cliente.tracking_timeline_weeks || [])].sort((a, b) => a.week_start.localeCompare(b.week_start));

  const thisMonth      = today.slice(0, 7);
  const currentCheckin = [...checkins].reverse().find((c) => c.month === thisMonth) || checkins[checkins.length - 1];

  // Peso
  const latestCh = [...checkins].reverse().find((c) => c.weight != null);
  const firstCh  = checkins.find((c) => c.weight != null);
  const latestWk = [...weeks].reverse().find((w) => w.real_weight != null);
  const currentW = latestCh?.weight ?? latestWk?.real_weight ?? null;
  const firstW   = firstCh?.weight ?? null;
  const diff     = currentW != null && firstW != null && latestCh?.month !== firstCh?.month
    ? Math.round((currentW - firstW) * 10) / 10 : null;

  // Objetivo peso de la fase
  let goalW = null;
  if (phase?.goal) {
    const m = phase.goal.match(/(\d{2,3}(?:[.,]\d)?)\s*kg/i);
    if (m) goalW = Number(m[1].replace(',', '.'));
  }

  // Gráfica
  const chartData = checkins
    .filter((c) => c.weight != null)
    .map((c) => ({ label: safeMonth(c.month), Peso: Number(c.weight) }));

  const pesos     = chartData.map((d) => d.Peso);
  const domainMin = pesos.length ? Math.floor(Math.min(...pesos, goalW ?? Infinity) - 2) : 60;
  const domainMax = pesos.length ? Math.ceil(Math.max(...pesos) + 1) : 100;

  // Stats del mes actual
  const weekNotes = (currentCheckin?.weekly_notes || []).filter((w) => w && (w.strength || w.note || w.steps));

  const adherencias = (currentCheckin?.weekly_notes || []).map((w) => w?.adherence).filter((v) => v != null);
  const avgAdherencia = adherencias.length ? Math.round(adherencias.reduce((a, b) => a + b, 0) / adherencias.length) : null;

  const stepsArr = (currentCheckin?.weekly_notes || []).map((w) => w?.steps).filter((v) => v != null);
  const avgSteps = stepsArr.length ? Math.round(stepsArr.reduce((a, b) => a + b, 0) / stepsArr.length) : null;

  // Racha de semanas fuertes
  const allWeeks   = checkins.flatMap((c) => c.weekly_notes || []).filter((w) => w?.strength);
  let racha = 0;
  for (const w of [...allWeeks].reverse()) {
    if (w.strength === 'Fuerte') racha++; else break;
  }

  const semanasMes  = (currentCheckin?.weekly_notes || []).filter((w) => w?.strength);
  const fuertesMes  = semanasMes.filter((w) => w.strength === 'Fuerte').length;
  const pctFuertes  = semanasMes.length ? Math.round((fuertesMes / semanasMes.length) * 100) : null;

  const s = (val, fallback = '—') => val ?? fallback;

  return (
    <div style={{ minHeight: '100vh', background: '#050708', color: '#F2F6F7', fontFamily: 'Inter,system-ui,sans-serif' }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid #212729', padding: '14px 16px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${color}20`, color, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
            {(cliente.name || '?')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{cliente.name}</div>
            <div style={{ color: '#7C878B', fontSize: 11 }}>Chris Fitness · Seguimiento personal</div>
          </div>
          {phase && (
            <div style={{ background: `${color}18`, color, padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
              {phase.name}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Cards principales */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div style={{ background: '#151A1D', border: '1px solid #212729', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 9, color: '#7C878B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Peso actual</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#5ECCFA' }}>{currentW != null ? `${currentW} kg` : '—'}</div>
          </div>
          <div style={{ background: '#151A1D', border: '1px solid #212729', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 9, color: '#7C878B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Cambio total</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: diff == null ? '#7C878B' : diff < 0 ? '#4ADE80' : '#F87171' }}>
              {diff != null ? `${diff > 0 ? '+' : ''}${diff} kg` : '—'}
            </div>
          </div>
          <div style={{ background: '#151A1D', border: '1px solid #212729', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 9, color: '#7C878B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Fase</div>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{phase?.name || '—'}</div>
          </div>
        </div>

        {/* Stats compromiso */}
        {(racha > 0 || pctFuertes != null || avgSteps != null || avgAdherencia != null) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {racha > 0 && (
              <div style={{ background: '#151A1D', border: '1px solid #212729', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 9, color: '#7C878B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>🔥 Racha semanas fuertes</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#4ADE80' }}>{racha}</div>
                <div style={{ fontSize: 10, color: '#7C878B' }}>semanas consecutivas</div>
              </div>
            )}
            {pctFuertes != null && (
              <div style={{ background: '#151A1D', border: '1px solid #212729', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 9, color: '#7C878B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>💪 Semanas fuertes</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: pctFuertes >= 75 ? '#4ADE80' : pctFuertes >= 50 ? '#FBBF24' : '#F87171' }}>{pctFuertes}%</div>
                <div style={{ fontSize: 10, color: '#7C878B' }}>{fuertesMes}/{semanasMes.length} este mes</div>
              </div>
            )}
            {avgSteps != null && (
              <div style={{ background: '#151A1D', border: '1px solid #212729', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 9, color: '#7C878B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>👣 Media pasos/día</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#4ADE80' }}>{avgSteps.toLocaleString()}</div>
              </div>
            )}
            {avgAdherencia != null && (
              <div style={{ background: '#151A1D', border: '1px solid #212729', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 9, color: '#7C878B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>🎯 Adherencia media</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#A78BFA' }}>{avgAdherencia}%</div>
                <div style={{ height: 4, background: '#212729', borderRadius: 4, marginTop: 6 }}>
                  <div style={{ height: 4, background: '#A78BFA', borderRadius: 4, width: `${Math.min(avgAdherencia, 100)}%` }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Objetivo */}
        {(cliente.long_term_goal || phase?.goal) && (
          <div style={{ background: '#151A1D', border: '1px solid #212729', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cliente.long_term_goal && (
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 3, background: '#5ECCFA', borderRadius: 4, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 9, color: '#5ECCFA', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>Tu objetivo</div>
                  <div style={{ fontSize: 13 }}>{cliente.long_term_goal}</div>
                </div>
              </div>
            )}
            {phase?.goal && (
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 3, background: color, borderRadius: 4, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3, color }}>Objetivo fase actual</div>
                  <div style={{ fontSize: 13 }}>{phase.goal}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Gráfica */}
        {chartData.length >= 2 && (
          <div style={{ background: '#0D1117', border: '1px solid #212729', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 9, color: '#7C878B', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>Progreso de peso</div>
            <div style={{ height: 180 }}>
              <ResponsiveContainer>
                <AreaChart data={chartData} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5ECCFA" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#5ECCFA" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1C2226" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#5A6870', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#5A6870', fontSize: 10 }} tickLine={false} axisLine={false} domain={[domainMin, domainMax]} width={26} />
                  <Tooltip
                    contentStyle={{ background: '#0D1117', border: '1px solid #1C2226', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#C8D5DA' }}
                    itemStyle={{ color: '#5ECCFA' }}
                    formatter={(v) => [`${v} kg`, 'Peso']}
                  />
                  {goalW != null && (
                    <ReferenceLine y={goalW} stroke="#4ADE80" strokeDasharray="6 4" strokeWidth={1.5}
                      label={{ value: `Objetivo ${goalW}kg`, position: 'insideBottomRight', fill: '#4ADE80', fontSize: 9, dy: -5 }} />
                  )}
                  <Area type="monotone" dataKey="Peso" stroke="#5ECCFA" strokeWidth={2.5} fill="url(#pg)"
                    dot={{ r: 4, fill: '#5ECCFA', stroke: '#0D1117', strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: '#5ECCFA', stroke: '#0D1117', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Mes actual */}
        {currentCheckin && (
          <div style={{ background: '#151A1D', border: '1px solid #212729', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: '#0E1214', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{monthLabelFull(currentCheckin.month)}</div>
                {currentCheckin.phase && <div style={{ color: '#7C878B', fontSize: 11, marginTop: 1 }}>{currentCheckin.phase}</div>}
              </div>
              {currentCheckin.goal_status && GOAL_COLORS[currentCheckin.goal_status] && (
                <div style={{ fontSize: 11, fontWeight: 700, color: GOAL_COLORS[currentCheckin.goal_status] }}>
                  {currentCheckin.goal_status}
                </div>
              )}
            </div>
            <div style={{ padding: '12px 16px' }}>
              {weekNotes.length > 0 && weekNotes.map((w, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: i < weekNotes.length - 1 ? 10 : 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: STRENGTH_COLOR[w.strength] || '#212729', marginTop: 4, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{w.label || `Semana ${i + 1}`}</span>
                      {w.strength && <span style={{ fontSize: 10, fontWeight: 700, color: STRENGTH_COLOR[w.strength] }}>{w.strength}</span>}
                    </div>
                    {w.note && <div style={{ color: '#7C878B', fontSize: 11, marginTop: 2 }}>{w.note}</div>}
                    <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                      {w.steps != null && <span style={{ fontSize: 10, color: '#4ADE80' }}>👣 {Number(w.steps).toLocaleString()} pasos</span>}
                      {w.adherence != null && <span style={{ fontSize: 10, color: '#A78BFA' }}>🎯 {w.adherence}% adherencia</span>}
                      {calcKcalMedia(w.kcal_on, w.kcal_off, w.dias_on) != null && (
                        <span style={{ fontSize: 10, color: '#FBBF24' }}>🔥 {calcKcalMedia(w.kcal_on, w.kcal_off, w.dias_on)} kcal/día</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {currentCheckin.goals && (
                <div style={{ marginTop: weekNotes.length ? 12 : 0, padding: '10px 12px', background: '#0E1214', borderRadius: 8 }}>
                  <div style={{ fontSize: 9, color: '#7C878B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Objetivo del mes</div>
                  <div style={{ fontSize: 13 }}>
                    {currentCheckin.goals}
                    {currentCheckin.goal_status && GOAL_COLORS[currentCheckin.goal_status] && (
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: GOAL_COLORS[currentCheckin.goal_status] }}>
                        · {currentCheckin.goal_status}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', color: '#5A6870', fontSize: 10, padding: '8px 0 16px' }}>
          Seguimiento generado por Chris Fitness · Este enlace es privado
        </div>
      </div>
    </div>
  );
}
