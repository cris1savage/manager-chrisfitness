'use client';

import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, AreaChart, Area, ReferenceLine, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from 'recharts';
import {
  Plus, Trash2, Video, Check, X, FileDown, Loader2, Flag, Ruler, Footprints,
  Calendar as CalendarIcon, ChevronDown, ChevronRight, Dumbbell, Apple, TrendingDown, Info, Clock,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui';
import { todayISO } from '@/lib/config';
import { phaseForDate, generateWeeks, recalcFrom, monthKeyOf, mondayOf, addDaysISO } from '@/lib/clientTimeline';

const PHASE_NAMES = ['Volumen', 'Definición', 'Mantenimiento', 'Recomposición', 'Otra'];
const GOAL_STATUSES = ['Pendiente', 'Cumplido', 'Parcial', 'No cumplido'];
const GOAL_COLORS = { Pendiente: '#7C878B', Cumplido: '#4ADE80', Parcial: '#FBBF24', 'No cumplido': '#F87171' };
const PHASE_COLOR_PALETTE = ['#5ECCFA', '#FBBF24', '#4ADE80', '#A78BFA', '#F87171'];
const MONTH_NAMES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MEASUREMENTS = ['Cuello', 'Hombros', 'Pecho', 'Biceps izq', 'Biceps der', 'Antebrazo izq', 'Antebrazo der', 'Cintura', 'Cadera', 'Muslo izq', 'Muslo der', 'Gemelo izq', 'Gemelo der'];
const WEEK_STRENGTHS = ['Fuerte', 'Normal', 'Floja'];
const STRENGTH_COLOR = { Fuerte: '#4ADE80', Normal: '#FBBF24', Floja: '#F87171' };

function defaultWeeklyNotes(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const ranges = [[1, 7], [8, 14], [15, 21], [22, lastDay]];
  return ranges.map(([a, b], i) => ({ label: `Semana ${i + 1} (${a}-${b})`, strength: 'Normal', note: '' }));
}
const TABS = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'mes', label: 'Mes actual' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'historial', label: 'Historial' },
];

function monthLabelFull(key) {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES_FULL[Number(m) - 1]} ${y}`;
}
function fmtDate(dateISO) {
  return new Date(dateISO + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}
function phaseColor(phases, name) {
  const idx = (phases || []).findIndex((p) => p.name === name);
  return PHASE_COLOR_PALETTE[idx % PHASE_COLOR_PALETTE.length] || '#7C878B';
}

async function getLogoDataUrl() {
  try {
    const res = await fetch('/icon-512.png');
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Aproxima un anillo de progreso con segmentos de línea — jsPDF no tiene
// arcos nativos, pero esto da el mismo efecto visual.
function drawProgressRing(doc, cx, cy, r, pct, rgb) {
  doc.setLineWidth(2.6);
  doc.setDrawColor(228, 228, 228);
  doc.circle(cx, cy, r, 'S');
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  const totalSteps = 72;
  const activeSteps = Math.round(pct * totalSteps);
  for (let i = 0; i < activeSteps; i++) {
    const a1 = (-90 + (360 * i) / totalSteps) * (Math.PI / 180);
    const a2 = (-90 + (360 * (i + 1)) / totalSteps) * (Math.PI / 180);
    doc.line(cx + r * Math.cos(a1), cy + r * Math.sin(a1), cx + r * Math.cos(a2), cy + r * Math.sin(a2));
  }
}

// Dibuja un gráfico de líneas a mano (ejes, cuadrícula, puntos) — jsPDF no
// puede incrustar un gráfico de React, así que se traza igual que el
// anillo: con líneas nativas del propio PDF.
function drawLineChartPDF(doc, x, y, w, h, points, colorRGB) {
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.15 || 1;
  const yMin = min - pad;
  const yMax = max + pad;

  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.2);
  for (let i = 0; i <= 3; i++) {
    const gy = y + (h * i) / 3;
    doc.line(x, gy, x + w, gy);
  }

  const px = (i) => x + (w * i) / Math.max(1, points.length - 1);
  const py = (v) => y + h - ((v - yMin) / (yMax - yMin)) * h;

  doc.setDrawColor(colorRGB[0], colorRGB[1], colorRGB[2]);
  doc.setLineWidth(0.7);
  for (let i = 0; i < points.length - 1; i++) {
    doc.line(px(i), py(points[i].value), px(i + 1), py(points[i + 1].value));
  }
  doc.setFillColor(colorRGB[0], colorRGB[1], colorRGB[2]);
  points.forEach((p, i) => doc.circle(px(i), py(p.value), 1.1, 'F'));

  doc.setFontSize(7.5);
  doc.setTextColor(140, 140, 140);
  doc.setFont('helvetica', 'normal');
  points.forEach((p, i) => doc.text(p.label, px(i), y + h + 6, { align: 'center' }));
  doc.text(yMax.toFixed(0), x - 3, y + 2, { align: 'right' });
  doc.text(yMin.toFixed(0), x - 3, y + h, { align: 'right' });
}

async function downloadCheckinPDF(client, checkin, allCheckins = []) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  const maxX = pageWidth - marginX;
  const logo = await getLogoDataUrl();

  doc.setFillColor(5, 7, 8);
  doc.rect(0, 0, pageWidth, 38, 'F');
  if (logo) doc.addImage(logo, 'PNG', 14, 7, 24, 24);
  doc.setTextColor(94, 204, 250);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('CHRIS FITNESS', logo ? 44 : 14, 20);
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 180);
  doc.text('INFORME DE SEGUIMIENTO MENSUAL', logo ? 44 : 14, 27);

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(client.name, marginX, 52);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(`${monthLabelFull(checkin.month)} · Fase: ${checkin.phase || '—'}`, marginX, 59);

  const weeklyNotes = checkin.weekly_notes && checkin.weekly_notes.length ? checkin.weekly_notes : [];
  const ratedWeeks = weeklyNotes.filter((w) => w.strength);
  if (ratedWeeks.length) {
    const strongPct = ratedWeeks.filter((w) => w.strength === 'Fuerte').length / ratedWeeks.length;
    const ringColor = strongPct >= 0.6 ? [22, 163, 74] : strongPct >= 0.3 ? [180, 83, 9] : [220, 38, 38];
    const cx = maxX - 12;
    const cy = 46;
    drawProgressRing(doc, cx, cy, 11, strongPct, ringColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(ringColor[0], ringColor[1], ringColor[2]);
    doc.text(`${Math.round(strongPct * 100)}%`, cx, cy + 1.5, { align: 'center' });
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(130, 130, 130);
    doc.text('Semanas fuertes', cx, cy + 17, { align: 'center' });
  }

  doc.setDrawColor(210, 210, 210);
  doc.line(marginX, 64, maxX, 64);

  // Tarjetas de datos clave
  const cardY = 74;
  const cardW = (maxX - marginX - 10) / 3;
  const cards = [
    ['Peso', checkin.weight ? `${checkin.weight} kg` : '—'],
    ['Media pasos', checkin.steps_avg ? Number(checkin.steps_avg).toLocaleString('es-ES') : '—'],
    ['Objetivo', checkin.goal_status || 'Pendiente'],
  ];
  cards.forEach(([label, value], i) => {
    const x = marginX + i * (cardW + 5);
    doc.setFillColor(245, 247, 248);
    doc.roundedRect(x, cardY, cardW, 24, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(label.toUpperCase(), x + 5, cardY + 9);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(i === 2 ? (GOAL_STATUSES.includes(checkin.goal_status) && checkin.goal_status === 'Cumplido' ? 22 : checkin.goal_status === 'No cumplido' ? 200 : 30) : 20, 20, 20);
    doc.text(String(value), x + 5, cardY + 19);
    doc.setFont('helvetica', 'normal');
  });

  let y = cardY + 36;

  // Gráfica real de progreso de peso — con el histórico completo del
  // cliente, no solo este mes, igual que en el panel.
  const weightSeries = [...allCheckins]
    .filter((c) => c.weight != null)
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-8)
    .map((c) => ({ label: monthLabelFull(c.month).slice(0, 3), value: Number(c.weight) }));
  if (weightSeries.length >= 2) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(130, 130, 130);
    doc.text('PROGRESO DE PESO', marginX, y);
    y += 4;
    drawLineChartPDF(doc, marginX + 8, y, maxX - marginX - 12, 32, weightSeries, [8, 145, 178]);
    y += 32 + 12;
  }

  const field = (label, value) => {
    if (!value) return;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(94, 156, 196);
    doc.text(label.toUpperCase(), marginX, y);
    y += 6;
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(String(value), maxX - marginX);
    lines.forEach((line) => { doc.text(line, marginX, y); y += 5.5; });
    y += 4;
  };

  const measurementsText = checkin.measurements && Object.keys(checkin.measurements).length
    ? Object.entries(checkin.measurements).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}cm`).join(' · ')
    : null;

  field('Objetivos del mes', checkin.goals);
  field('Entrenamiento', checkin.training_notes);
  field('Nutrición', checkin.nutrition_notes);
  field('Mediciones', measurementsText);
  field('Otros datos', checkin.other_metrics);
  field('Videollamada', checkin.call_date ? `${new Date(checkin.call_date + 'T00:00:00').toLocaleDateString('es-ES')} — ${checkin.call_done ? 'Realizada' : 'Pendiente'}` : null);
  field('Notas', checkin.notes);

  // Semanas del mes, con su punto de color — igual que en el panel
  if (weeklyNotes.length) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(130, 130, 130);
    doc.text('SEMANAS DEL MES', marginX, y);
    y += 7;
    const dotColors = { Fuerte: [22, 163, 74], Normal: [180, 83, 9], Floja: [220, 38, 38] };
    weeklyNotes.forEach((w) => {
      const c = dotColors[w.strength] || [150, 150, 150];
      doc.setFillColor(c[0], c[1], c[2]);
      doc.circle(marginX + 1.5, y - 1.5, 1.5, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 20, 20);
      doc.text(w.label || '', marginX + 6, y);
      if (w.note) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(110, 110, 110);
        const noteLines = doc.splitTextToSize(w.note, maxX - marginX - 55);
        doc.text(noteLines[0] || '', marginX + 44, y);
      }
      y += 6.5;
    });
    y += 4;
  }

  // Resultado del objetivo, destacado
  const okColors = { Cumplido: [22, 163, 74, 234, 243, 222], Parcial: [180, 83, 9, 250, 238, 218], 'No cumplido': [220, 38, 38, 252, 235, 235] };
  const status = checkin.goal_status || 'Pendiente';
  if (okColors[status]) {
    const [tr, tg, tb, br, bg, bb] = okColors[status];
    doc.setFillColor(br, bg, bb);
    doc.roundedRect(marginX, y, maxX - marginX, 14, 2, 2, 'F');
    doc.setTextColor(tr, tg, tb);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${status === 'Cumplido' ? '✓' : status === 'No cumplido' ? '✗' : '~'} ${status}`, marginX + 6, y + 9.5);
  }

  doc.save(`${client.name.replace(/\s+/g, '_')}_${checkin.month}.pdf`);
}

export default function ClientProfileModal({ client }) {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState('resumen');
  const [checkins, setCheckins] = useState([]);
  const [phases, setPhases] = useState(client.phases || []);
  const [longTermGoal, setLongTermGoal] = useState(client.long_term_goal || '');
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState(null);
  const [expandedMonths, setExpandedMonths] = useState({});
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [measurementsDraft, setMeasurementsDraft] = useState(null);
  const [measurementsSaved, setMeasurementsSaved] = useState(false);
  const [chartMeasurement, setChartMeasurement] = useState(MEASUREMENTS[0]);

  const currentMonth = todayISO().slice(0, 7);
  const currentWeekStart = mondayOf(todayISO());

  const load = async () => {
    const [checkinsRes, weeksRes] = await Promise.all([
      supabase.from('client_checkins').select('*').eq('active_client_id', client.id).order('month', { ascending: false }),
      supabase.from('client_timeline_weeks').select('*').eq('active_client_id', client.id).order('week_start', { ascending: true }),
    ]);
    setCheckins(checkinsRes.data || []);
    setWeeks(weeksRes.data || []);
    setLoading(false);
    setExpandedMonths((m) => (Object.keys(m).length ? m : { [currentMonth]: true }));
  };

  useEffect(() => {
    load();
    const ch1 = supabase.channel(`checkins-${client.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'client_checkins', filter: `active_client_id=eq.${client.id}` }, load).subscribe();
    const ch2 = supabase.channel(`timeline-${client.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'client_timeline_weeks', filter: `active_client_id=eq.${client.id}` }, load).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  const savePhases = async (next) => {
    setPhases(next);
    await supabase.from('active_clients').update({ phases: next }).eq('id', client.id);
  };
  const saveLongTermGoal = async (value) => {
    setLongTermGoal(value);
    await supabase.from('active_clients').update({ long_term_goal: value }).eq('id', client.id);
  };

  const addPhase = () => {
    const last = phases[phases.length - 1];
    const start = last ? addDaysISO(last.end_date, 1) : todayISO();
    savePhases([...phases, { name: 'Definición', start_date: start, end_date: addDaysISO(start, 90), rate: -0.5 }]);
  };
  const updatePhase = (i, patch) => savePhases(phases.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const removePhase = (i) => savePhases(phases.filter((_, idx) => idx !== i));

  const hasCurrentMonth = checkins.some((c) => c.month === currentMonth);
  const addMonth = async () => {
    await supabase.from('client_checkins').insert({ active_client_id: client.id, month: currentMonth, phase: phaseForDate(phases, todayISO())?.name || null, weekly_notes: defaultWeeklyNotes(currentMonth) });
  };
  const currentCheckin = checkins.find((c) => c.month === currentMonth);
  useEffect(() => {
    setMeasurementsDraft(null);
    setMeasurementsSaved(false);
  }, [currentCheckin?.id]);
  const updateCheckin = async (id, patch) => {
    setCheckins((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    await supabase.from('client_checkins').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  };
  const editMeasurement = (name, value) => {
    setMeasurementsSaved(false);
    setMeasurementsDraft((d) => ({ ...(d || currentCheckin?.measurements || {}), [name]: value === '' ? null : Number(value) }));
  };
  const saveMeasurements = async () => {
    if (!currentCheckin) return;
    await updateCheckin(currentCheckin.id, { measurements: measurementsDraft || currentCheckin.measurements || {} });
    setMeasurementsSaved(true);
    setTimeout(() => setMeasurementsSaved(false), 2500);
  };
  const updateWeekNote = (checkin, weekIdx, patch) => {
    const notes = (checkin.weekly_notes && checkin.weekly_notes.length ? checkin.weekly_notes : defaultWeeklyNotes(checkin.month)).map((w, i) => (i === weekIdx ? { ...w, ...patch } : w));
    updateCheckin(checkin.id, { weekly_notes: notes });
  };
  const removeCheckin = async (id, month) => {
    if (!window.confirm(`¿Borrar el seguimiento de ${monthLabelFull(month)}? No se puede deshacer.`)) return;
    setCheckins((cs) => cs.filter((c) => c.id !== id));
    await supabase.from('client_checkins').delete().eq('id', id);
  };
  const exportPdf = async (checkin) => {
    setExportingId(checkin.id);
    await downloadCheckinPDF(client, checkin, checkins);
    setExportingId(null);
  };

  // ---------- Timeline ----------
  const ensureWeeks = async () => {
    if (phases.length === 0) return;
    const startWeight = currentCheckin?.weight || checkins.find((c) => c.weight != null)?.weight || 80;
    const generated = generateWeeks(phases, phases[0].start_date, 52, startWeight);
    await supabase.from('client_timeline_weeks').upsert(
      generated.map((w) => ({ active_client_id: client.id, ...w })),
      { onConflict: 'active_client_id,week_start', ignoreDuplicates: true }
    );
  };

  const editWeekTarget = async (idx, value) => {
    const v = Number(value);
    if (Number.isNaN(v)) return;
    const updated = recalcFrom(weeks, phases, idx, v);
    setWeeks((w) => w.map((row, i) => (i >= idx ? updated[i - idx] : row)));
    await supabase.from('client_timeline_weeks').upsert(
      updated.map((w) => ({ active_client_id: client.id, ...w, updated_at: new Date().toISOString() })),
      { onConflict: 'active_client_id,week_start' }
    );
  };
  const editWeekField = async (id, patch) => {
    setWeeks((w) => w.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    await supabase.from('client_timeline_weeks').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  };

  const weeksByMonth = useMemo(() => {
    const map = {};
    weeks.forEach((w) => {
      const k = monthKeyOf(w.week_start);
      if (!map[k]) map[k] = [];
      map[k].push(w);
    });
    return map;
  }, [weeks]);

  const chartData = weeks.map((w) => ({ label: fmtDate(w.week_start), Objetivo: w.target_weight, Real: w.real_weight }));
  const finalTargetWeight = weeks.length ? weeks[weeks.length - 1].target_weight : null;

  const currentPhaseObj = phaseForDate(phases, todayISO());
  const currentPhaseName = currentPhaseObj?.name;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: tab === t.key ? 'var(--color-cyan)' : 'transparent', color: tab === t.key ? '#00161C' : 'var(--color-muted)', border: `1px solid ${tab === t.key ? 'var(--color-cyan)' : 'var(--color-border)'}` }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <Card className="text-center py-8 text-muted">Cargando…</Card>}

      {!loading && tab === 'resumen' && (
        <div className="space-y-3">
          <Card style={{ borderColor: 'var(--color-cyan)' }}>
            <div className="flex items-center gap-1.5 text-cyan text-[11px] font-bold mb-2"><Flag size={13} /> FASE ACTUAL: {(currentPhaseName || 'sin definir').toUpperCase()}</div>
            <div className="space-y-2">
              {phases.map((p, i) => (
                <div key={i} className="rounded-lg p-2.5 flex items-center gap-2 flex-wrap" style={{ background: p.name === currentPhaseName ? `${phaseColor(phases, p.name)}22` : 'var(--color-surfaceAlt)', border: `1px solid ${p.name === currentPhaseName ? phaseColor(phases, p.name) : 'var(--color-border)'}` }}>
                  <select value={p.name} onChange={(e) => updatePhase(i, { name: e.target.value })} className="bg-surface border border-border rounded px-1.5 py-1 text-xs font-bold" style={{ color: phaseColor(phases, p.name) }}>
                    {PHASE_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <input type="date" value={p.start_date} onChange={(e) => updatePhase(i, { start_date: e.target.value })} className="bg-surface border border-border rounded px-1.5 py-1 text-[11px] text-ink" />
                  <span className="text-muted text-[11px]">→</span>
                  <input type="date" value={p.end_date} onChange={(e) => updatePhase(i, { end_date: e.target.value })} className="bg-surface border border-border rounded px-1.5 py-1 text-[11px] text-ink" />
                  <div className="flex items-center gap-1">
                    <input type="number" step="0.05" value={p.rate} onChange={(e) => updatePhase(i, { rate: Number(e.target.value) })} className="bg-surface border border-border rounded px-1.5 py-1 text-[11px] text-ink w-14" />
                    <span className="text-muted text-[10px]">%/sem</span>
                  </div>
                  <button onClick={() => removePhase(i)} className="text-red ml-auto"><Trash2 size={13} /></button>
                  <input
                    value={p.goal || ''}
                    onChange={(e) => updatePhase(i, { goal: e.target.value })}
                    placeholder="Objetivo de esta fase (ej. Bajar a 80kg manteniendo fuerza...)"
                    className="bg-surface border border-border rounded px-2 py-1 text-[11px] text-ink w-full mt-1"
                  />
                </div>
              ))}
              <button onClick={addPhase} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted border border-border flex items-center gap-1.5"><Plus size={13} /> Añadir fase</button>
            </div>
            <div className="text-muted text-[10.5px] mt-2">Cada fase con su propio ritmo semanal — tú lo pones, se detecta sola según la fecha de hoy.</div>
          </Card>

          <Card>
            <div className="flex items-center gap-1.5 text-muted text-[11px] uppercase tracking-wide mb-2"><Flag size={13} /> Objetivos</div>
            <div className="space-y-2.5">
              <div className="flex gap-2.5">
                <div className="w-1 rounded shrink-0" style={{ background: 'var(--color-cyan)' }} />
                <div className="flex-1">
                  <div className="text-cyan text-[10.5px] font-bold mb-1">LARGO PLAZO</div>
                  <textarea
                    value={longTermGoal}
                    onChange={(e) => setLongTermGoal(e.target.value)}
                    onBlur={(e) => saveLongTermGoal(e.target.value)}
                    placeholder="Ej. Llegar a 78kg con visibilidad abdominal para junio de 2027..."
                    rows={2}
                    className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-xs w-full outline-none focus:border-cyan resize-y"
                  />
                </div>
              </div>
              {currentPhaseObj && (
                <div className="flex gap-2.5">
                  <div className="w-1 rounded shrink-0" style={{ background: 'var(--color-amber)' }} />
                  <div className="flex-1">
                    <div className="text-amber text-[10.5px] font-bold mb-1">FASE ACTUAL — {currentPhaseName?.toUpperCase()}</div>
                    <textarea
                      value={currentPhaseObj.goal || ''}
                      onChange={(e) => updatePhase(phases.indexOf(currentPhaseObj), { goal: e.target.value })}
                      placeholder="Objetivo de esta fase (ej. Bajar a 80kg manteniendo fuerza en press banca...)"
                      rows={2}
                      className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-xs w-full outline-none focus:border-cyan resize-y"
                    />
                  </div>
                </div>
              )}
            </div>
          </Card>

          {chartData.some((d) => d.Real != null) && (
            <Card>
              <div className="flex items-center gap-1.5 text-muted text-[11.5px] uppercase tracking-wide mb-3"><TrendingDown size={13} /> Progreso de peso</div>
              <div className="w-full h-[190px]">
                <ResponsiveContainer>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id={`weightFill-${client.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-cyan)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--color-cyan)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="label" stroke="var(--color-muted)" fontSize={9} tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} interval={Math.ceil(chartData.length / 8)} />
                    <YAxis stroke="var(--color-muted)" fontSize={10} tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} width={32} domain={['dataMin - 2', 'dataMax + 2']} />
                    <Tooltip contentStyle={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: 'var(--color-ink)' }} />
                    {finalTargetWeight != null && (
                      <ReferenceLine y={finalTargetWeight} stroke="var(--color-green)" strokeDasharray="4 4" label={{ value: `Objetivo ${finalTargetWeight}kg`, position: 'insideTopRight', fill: 'var(--color-green)', fontSize: 10 }} />
                    )}
                    <Area type="monotone" dataKey="Real" stroke="var(--color-cyan)" strokeWidth={2.5} fill={`url(#weightFill-${client.id})`} dot={{ r: 3.5 }} connectNulls={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </div>
      )}

      {!loading && tab === 'mes' && (
        <div className="space-y-3">
          {!hasCurrentMonth && (
            <button onClick={addMonth} className="rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5" style={{ background: 'var(--color-cyan)', color: '#00161C' }}>
              <Plus size={13} /> Añadir {monthLabelFull(currentMonth)}
            </button>
          )}
          {hasCurrentMonth && currentCheckin && (
            <Card className="space-y-3" style={{ borderColor: 'var(--color-cyan)' }}>
              <div className="flex items-center justify-between">
                <span className="text-ink font-bold text-sm capitalize">{monthLabelFull(currentCheckin.month)}</span>
                <button onClick={() => removeCheckin(currentCheckin.id, currentCheckin.month)} className="text-red p-1"><Trash2 size={14} /></button>
              </div>

              <div>
                <div className="text-muted text-[10px] uppercase tracking-wide mb-1">Fase</div>
                <div className="flex flex-wrap gap-1.5">
                  {PHASE_NAMES.map((p) => (
                    <button key={p} onClick={() => updateCheckin(currentCheckin.id, { phase: p })} className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: currentCheckin.phase === p ? 'var(--color-cyan)' : 'var(--color-surfaceAlt)', color: currentCheckin.phase === p ? '#00161C' : 'var(--color-muted)', border: '1px solid var(--color-border)' }}>{p}</button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-muted text-[10px] uppercase tracking-wide mb-1">Objetivos del mes</div>
                <textarea value={currentCheckin.goals || ''} onChange={(e) => updateCheckin(currentCheckin.id, { goals: e.target.value })} rows={2} placeholder="Bajar a 80kg, 10.000 pasos diarios..." className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-xs w-full outline-none focus:border-cyan resize-y" />
              </div>

              <div className="rounded-lg p-3" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-1.5 text-muted text-[10px] uppercase tracking-wide mb-2"><Clock size={11} /> Semana a semana</div>
                <div className="space-y-2">
                  {(currentCheckin.weekly_notes && currentCheckin.weekly_notes.length ? currentCheckin.weekly_notes : defaultWeeklyNotes(currentCheckin.month)).map((w, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: STRENGTH_COLOR[w.strength] || 'var(--color-muted)' }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-ink text-xs font-semibold">{w.label}</span>
                          <div className="flex gap-1">
                            {WEEK_STRENGTHS.map((s) => (
                              <button
                                key={s}
                                onClick={() => updateWeekNote(currentCheckin, i, { strength: s })}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold"
                                style={{ background: w.strength === s ? `${STRENGTH_COLOR[s]}22` : 'transparent', color: w.strength === s ? STRENGTH_COLOR[s] : 'var(--color-muted)', border: `1px solid ${w.strength === s ? STRENGTH_COLOR[s] : 'var(--color-border)'}` }}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                        <input
                          value={w.note || ''}
                          onChange={(e) => updateWeekNote(currentCheckin, i, { note: e.target.value })}
                          placeholder="Nota rápida de esta semana..."
                          className="bg-surface border border-border text-ink rounded px-2 py-1 text-[11px] w-full outline-none focus:border-cyan mt-1"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <div className="text-muted text-[10px] uppercase tracking-wide mb-1 flex items-center gap-1"><Dumbbell size={11} /> Entrenamiento</div>
                  <textarea value={currentCheckin.training_notes || ''} onChange={(e) => updateCheckin(currentCheckin.id, { training_notes: e.target.value })} rows={2} className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-xs w-full outline-none focus:border-cyan resize-y" />
                </div>
                <div>
                  <div className="text-muted text-[10px] uppercase tracking-wide mb-1 flex items-center gap-1"><Apple size={11} /> Nutrición</div>
                  <textarea value={currentCheckin.nutrition_notes || ''} onChange={(e) => updateCheckin(currentCheckin.id, { nutrition_notes: e.target.value })} rows={2} className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-xs w-full outline-none focus:border-cyan resize-y" />
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1">
                  <span className="text-muted text-xs">Peso</span>
                  <input type="number" step="0.1" value={currentCheckin.weight ?? ''} onChange={(e) => updateCheckin(currentCheckin.id, { weight: e.target.value ? Number(e.target.value) : null })} className="bg-surfaceAlt border border-border text-ink rounded-lg px-2 py-1.5 text-xs w-16 outline-none focus:border-cyan" placeholder="kg" />
                </div>
                <div className="flex items-center gap-1">
                  <Footprints size={13} className="text-muted" />
                  <input type="number" value={currentCheckin.steps_avg ?? ''} onChange={(e) => updateCheckin(currentCheckin.id, { steps_avg: e.target.value ? Number(e.target.value) : null })} className="bg-surfaceAlt border border-border text-ink rounded-lg px-2 py-1.5 text-xs w-20 outline-none focus:border-cyan" placeholder="media" />
                </div>
                <select value={currentCheckin.goal_status || 'Pendiente'} onChange={(e) => updateCheckin(currentCheckin.id, { goal_status: e.target.value })} className="bg-surfaceAlt border rounded-lg px-2 py-1.5 text-xs font-semibold outline-none" style={{ borderColor: GOAL_COLORS[currentCheckin.goal_status], color: GOAL_COLORS[currentCheckin.goal_status] }}>
                  {GOAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="flex items-center gap-1">
                  <Video size={13} className="text-muted" />
                  <input type="date" value={currentCheckin.call_date || ''} onChange={(e) => updateCheckin(currentCheckin.id, { call_date: e.target.value || null })} className="bg-surfaceAlt border border-border text-ink rounded-lg px-2 py-1.5 text-xs outline-none focus:border-cyan" />
                  <button onClick={() => updateCheckin(currentCheckin.id, { call_done: !currentCheckin.call_done })} className="px-2 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1" style={{ background: currentCheckin.call_done ? '#4ADE8022' : 'var(--color-surfaceAlt)', color: currentCheckin.call_done ? 'var(--color-green)' : 'var(--color-muted)', border: '1px solid var(--color-border)' }}>
                    {currentCheckin.call_done ? <Check size={12} /> : <X size={12} />} {currentCheckin.call_done ? 'Realizada' : 'Pendiente'}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-muted text-[10px] uppercase tracking-wide flex items-center gap-1"><Ruler size={11} /> Mediciones (cm)</div>
                  <button
                    onClick={saveMeasurements}
                    className="rounded-lg px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1"
                    style={{ background: measurementsSaved ? '#4ADE8022' : 'var(--color-cyan)', color: measurementsSaved ? 'var(--color-green)' : '#00161C', border: measurementsSaved ? '1px solid var(--color-green)' : 'none' }}
                  >
                    {measurementsSaved ? <><Check size={12} /> Guardado</> : 'Guardar mediciones'}
                  </button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {MEASUREMENTS.map((m) => (
                    <div key={m}>
                      <div className="text-muted text-[9.5px]">{m}</div>
                      <input
                        type="number"
                        value={(measurementsDraft ?? currentCheckin.measurements ?? {})[m] ?? ''}
                        onChange={(e) => editMeasurement(m, e.target.value)}
                        className="bg-surfaceAlt border border-border text-ink rounded px-1.5 py-1 text-xs w-full outline-none focus:border-cyan"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg p-3" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="text-muted text-[10px] uppercase tracking-wide">Progreso de la medida</div>
                  <select value={chartMeasurement} onChange={(e) => setChartMeasurement(e.target.value)} className="bg-surface border border-border rounded px-2 py-1 text-[11px] text-ink outline-none">
                    {MEASUREMENTS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                {(() => {
                  const series = [...checkins].filter((c) => c.measurements?.[chartMeasurement] != null).sort((a, b) => a.month.localeCompare(b.month)).map((c) => ({ label: fmtDate(`${c.month}-01`), Valor: Number(c.measurements[chartMeasurement]) }));
                  if (series.length < 2) return <div className="text-muted text-[11px] text-center py-4">Todavía no hay suficientes meses con esta medida para comparar.</div>;
                  return (
                    <div className="w-full h-[140px]">
                      <ResponsiveContainer>
                        <LineChart data={series}>
                          <CartesianGrid stroke="var(--color-border)" vertical={false} />
                          <XAxis dataKey="label" stroke="var(--color-muted)" fontSize={9} tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} />
                          <YAxis stroke="var(--color-muted)" fontSize={10} tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} width={30} domain={['dataMin - 1', 'dataMax + 1']} />
                          <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: 'var(--color-ink)' }} />
                          <Line type="monotone" dataKey="Valor" stroke="var(--color-amber)" strokeWidth={2.5} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}
              </div>

              <input value={currentCheckin.notes || ''} onChange={(e) => updateCheckin(currentCheckin.id, { notes: e.target.value })} placeholder="Notas de la videollamada..." className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-xs w-full outline-none focus:border-cyan" />

              <button onClick={() => exportPdf(currentCheckin)} disabled={exportingId === currentCheckin.id} className="rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 w-fit" style={{ background: 'transparent', color: 'var(--color-cyan)', border: '1px solid var(--color-cyan)' }}>
                {exportingId === currentCheckin.id ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />} Exportar informe PDF
              </button>
            </Card>
          )}
        </div>
      )}

      {!loading && tab === 'timeline' && (
        <div className="space-y-3">
          {weeks.length === 0 && (
            <Card className="text-center py-6 space-y-2">
              <div className="text-muted text-sm">Todavía no hay timeline generado para este cliente.</div>
              <button onClick={ensureWeeks} disabled={phases.length === 0} className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40" style={{ background: 'var(--color-cyan)', color: '#00161C' }}>
                Generar 52 semanas
              </button>
              {phases.length === 0 && <div className="text-muted text-[10.5px]">Añade al menos una fase en Resumen primero.</div>}
            </Card>
          )}

          {weeks.length > 0 && (
            <>
              <Card>
                <div className="text-muted text-[11px] uppercase tracking-wide mb-2">Objetivo vs. real — año completo</div>
                <div className="w-full h-[190px]">
                  <ResponsiveContainer>
                    <LineChart data={chartData}>
                      <CartesianGrid stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="label" stroke="var(--color-muted)" fontSize={9} tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} interval={Math.ceil(chartData.length / 8)} />
                      <YAxis stroke="var(--color-muted)" fontSize={10} tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} width={32} domain={['dataMin - 2', 'dataMax + 2']} />
                      <Tooltip contentStyle={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: 'var(--color-ink)' }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="Objetivo" stroke="var(--color-muted)" strokeDasharray="4 4" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="Real" stroke="var(--color-cyan)" strokeWidth={2.5} dot={{ r: 2.5 }} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {Object.entries(weeksByMonth).map(([mk, mWeeks]) => {
                const isOpen = !!expandedMonths[mk];
                const withReal = mWeeks.filter((w) => w.real_weight != null);
                const onTrack = withReal.length ? withReal.filter((w) => Math.abs(w.real_weight - w.target_weight) <= 0.3).length / withReal.length : null;
                return (
                  <Card key={mk} className="!p-0">
                    <button onClick={() => setExpandedMonths((m) => ({ ...m, [mk]: !m[mk] }))} className="w-full flex items-center justify-between px-4 py-3 text-left">
                      <div className="flex items-center gap-2">
                        <CalendarIcon size={14} className={mk === currentMonth ? 'text-cyan' : 'text-muted'} />
                        <span className="text-ink text-sm font-semibold capitalize">{monthLabelFull(mk)}</span>
                        {mk === currentMonth && <span className="text-cyan text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan/15">En curso</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {onTrack != null && <span className="text-[10.5px] font-semibold" style={{ color: onTrack >= 0.6 ? 'var(--color-green)' : onTrack >= 0.3 ? 'var(--color-amber)' : 'var(--color-red)' }}>{Math.round(onTrack * 100)}% en línea</span>}
                        {isOpen ? <ChevronDown size={16} className="text-muted" /> : <ChevronRight size={16} className="text-muted" />}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 border-t border-border pt-3">
                        <div className="hidden sm:grid text-muted text-[10px] uppercase tracking-wide px-2.5 mb-1.5 sm:grid-cols-[28px_90px_1fr_100px_100px_100px_60px]">
                          <div></div><div>Fecha</div><div>Fase</div><div>Kcal</div><div>Objetivo</div><div>Real</div><div>Dif.</div>
                        </div>
                        <div className="space-y-1.5">
                          {mWeeks.map((w) => {
                            const idx = weeks.findIndex((x) => x.id === w.id);
                            const ph = phaseForDate(phases, w.week_start);
                            const diff = w.real_weight != null ? Math.round((w.real_weight - w.target_weight) * 10) / 10 : null;
                            const isThisWeek = w.week_start === currentWeekStart;
                            const rowStyle = {
                              background: isThisWeek ? 'color-mix(in srgb, var(--color-cyan) 6%, var(--color-surfaceAlt))' : 'var(--color-surfaceAlt)',
                              border: `1px solid ${isThisWeek ? 'var(--color-cyan)' : 'var(--color-border)'}`,
                            };
                            return (
                              <div key={w.id} className="rounded-lg p-2.5 flex items-center gap-2 flex-wrap sm:grid sm:grid-cols-[28px_90px_1fr_100px_100px_100px_60px] sm:gap-2" style={rowStyle}>
                                <div className="w-2 h-2 rounded-full shrink-0 hidden sm:block" style={{ background: ph ? phaseColor(phases, ph.name) : 'var(--color-muted)' }} />
                                <span className="text-ink text-xs font-medium">{fmtDate(w.week_start)}</span>
                                <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded w-fit" style={{ background: ph ? `${phaseColor(phases, ph.name)}22` : 'transparent', color: ph ? phaseColor(phases, ph.name) : 'var(--color-muted)' }}>{ph?.name || '—'}</span>
                                <div className="flex items-center gap-1 sm:contents">
                                  <span className="text-muted text-[10px] sm:hidden">Kcal</span>
                                  <input type="number" value={w.kcal ?? ''} onChange={(e) => editWeekField(w.id, { kcal: e.target.value ? Number(e.target.value) : null })} className="bg-surface border border-border rounded px-2 py-1.5 text-xs w-16 sm:w-full outline-none focus:border-cyan" />
                                </div>
                                <div className="flex items-center gap-1 sm:contents">
                                  <span className="text-muted text-[10px] sm:hidden">Objetivo</span>
                                  <input type="number" step="0.1" value={w.target_weight ?? ''} onChange={(e) => editWeekTarget(idx, e.target.value)} className="border rounded px-2 py-1.5 text-xs w-16 sm:w-full outline-none font-semibold" style={{ background: w.target_overridden ? '#FBBF2422' : 'var(--color-surface)', borderColor: w.target_overridden ? 'var(--color-amber)' : 'var(--color-border)', color: 'var(--color-ink)' }} />
                                </div>
                                <div className="flex items-center gap-1 sm:contents">
                                  <span className="text-muted text-[10px] sm:hidden">Real</span>
                                  <input type="number" step="0.1" value={w.real_weight ?? ''} placeholder="—" onChange={(e) => editWeekField(w.id, { real_weight: e.target.value === '' ? null : Number(e.target.value) })} className="bg-surface border border-border rounded px-2 py-1.5 text-xs w-16 sm:w-full outline-none focus:border-cyan" />
                                </div>
                                <span className="text-[11px] font-bold sm:text-right" style={{ color: diff == null ? 'var(--color-muted)' : diff <= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>{diff != null ? `${diff > 0 ? '+' : ''}${diff}` : '—'}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </>
          )}
        </div>
      )}

      {!loading && tab === 'historial' && (
        <div className="space-y-2">
          {checkins.filter((c) => c.month !== currentMonth).length === 0 && <Card className="text-center py-8 text-muted">Sin meses anteriores todavía.</Card>}
          {checkins.filter((c) => c.month !== currentMonth).map((c) => (
            <Card key={c.id} className="!p-0">
              <button onClick={() => setExpandedHistory(expandedHistory === c.id ? null : c.id)} className="w-full flex items-center justify-between px-4 py-3 text-left">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={14} className="text-muted" />
                  <span className="text-ink text-sm font-semibold capitalize">{monthLabelFull(c.month)}</span>
                  <span className="text-muted text-[10.5px]">· {c.phase || 'sin fase'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold" style={{ color: GOAL_COLORS[c.goal_status] }}>{c.goal_status}</span>
                  {expandedHistory === c.id ? <ChevronDown size={15} className="text-muted" /> : <ChevronRight size={15} className="text-muted" />}
                </div>
              </button>
              {expandedHistory === c.id && (
                <div className="px-4 pb-4 border-t border-border pt-3 space-y-2">
                  {c.goals && <div className="text-xs"><span className="text-muted">Objetivos: </span>{c.goals}</div>}
                  {c.weight && <div className="text-xs"><span className="text-muted">Peso: </span>{c.weight}kg</div>}
                  {c.weekly_notes && c.weekly_notes.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {c.weekly_notes.map((w, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STRENGTH_COLOR[w.strength] || 'var(--color-muted)' }} />
                          <span className="text-ink font-medium">{w.label}</span>
                          {w.note && <span className="text-muted">— {w.note}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {c.training_notes && <div className="text-xs"><span className="text-muted">Entrenamiento: </span>{c.training_notes}</div>}
                  {c.nutrition_notes && <div className="text-xs"><span className="text-muted">Nutrición: </span>{c.nutrition_notes}</div>}
                  {c.notes && <div className="text-xs"><span className="text-muted">Notas: </span>{c.notes}</div>}
                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={() => exportPdf(c)} className="rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5" style={{ background: 'transparent', color: 'var(--color-cyan)', border: '1px solid var(--color-cyan)' }}><FileDown size={13} /> Exportar PDF</button>
                    <button onClick={() => removeCheckin(c.id, c.month)} className="text-red p-1"><Trash2 size={14} /></button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
