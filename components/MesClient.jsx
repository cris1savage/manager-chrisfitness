'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Video, Check, X, FileDown, Loader2, Trash2, Ruler,
  Dumbbell, Apple, Clock, Sparkles, Footprints, Percent,
  ChevronLeft, ChevronRight, Save, Edit3, Target,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Card from '@/components/Card';
import {
  phaseForDate, phaseColor, PHASE_NAMES, todayISO, defaultWeeklyNotes,
  MEASUREMENTS, WEEK_STRENGTHS, STRENGTH_COLOR, GOAL_STATUSES, GOAL_COLORS,
  monthLabelFull, realWeeksOfMonth, mondayOf, addDaysISO,
  LEVEL_OPTIONS, LEVEL_COLORS, calcKcalMedia, calcKcalFromMacros, avgWeeklyField,
} from '@/lib/timeline';
import { downloadCheckinPDF } from '@/lib/pdf';

// Meses navegables: ym anterior / siguiente
function prevMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y-1}-12` : `${y}-${String(m-1).padStart(2,'0')}`;
}
function nextMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return m === 12 ? `${y+1}-01` : `${y}-${String(m+1).padStart(2,'0')}`;
}

// Barra de progreso compacta
function ProgressBar({ value, goal, color = '#4ADE80' }) {
  if (!goal || value == null) return null;
  const pct = Math.min(Math.round((value / goal) * 100), 100);
  const over = value > goal;
  return (
    <div className="mt-1.5">
      <div className="flex items-center justify-between text-[9px] mb-0.5" style={{ color: over ? '#F87171' : '#7C878B' }}>
        <span>{value?.toLocaleString()} / {goal?.toLocaleString()}</span>
        <span style={{ color: pct >= 100 ? '#4ADE80' : color }}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: 'var(--color-border)' }}>
        <div className="h-1.5 rounded-full transition-all"
          style={{ width: `${pct}%`, background: pct >= 100 ? '#4ADE80' : color }} />
      </div>
    </div>
  );
}

export default function MesClient({ clienteId, clienteName, phases, initialCheckins }) {
  const supabase = useMemo(() => createClient(), []);
  const router   = useRouter();

  const [checkins,          setCheckins]          = useState(initialCheckins);
  const [measurementsDraft, setMeasurementsDraft] = useState(null);
  const [measurementsSaved, setMeasurementsSaved] = useState(false);
  const [exportingId,       setExportingId]       = useState(null);
  const [autoExported,      setAutoExported]       = useState(false);

  // Mes activo — navegable
  const [activeMonth, setActiveMonth] = useState(todayISO().slice(0, 7));
  const today = todayISO();
  const currentMonth = today.slice(0, 7);

  // Semanas reales del mes activo
  const realWeeks = useMemo(() => realWeeksOfMonth(activeMonth), [activeMonth]);

  // Checkin del mes activo
  const hasMonth    = checkins.some((c) => c.month === activeMonth);
  const checkin     = checkins.find((c) => c.month === activeMonth);

  // weekly_notes sincronizadas con las semanas reales
  const weeklyNotes = useMemo(() => {
    if (!checkin) return realWeeks.map((w) => ({
      weekStart: w.weekStart, weekEnd: w.weekEnd, label: w.label,
      note: '', strength: null, steps: null, steps_goal: null,
      kcal_on: null, kcal_off: null, dias_on: null,
      protein_on: null, carbs_on: null, fat_on: null,
      protein_off: null, carbs_off: null, fat_off: null,
      adherence: null, saved: false,
    }));
    const saved = checkin.weekly_notes || [];
    return realWeeks.map((w, i) => {
      const existing = saved.find((n) => n.weekStart === w.weekStart) || saved[i] || {};
      return {
        weekStart: w.weekStart, weekEnd: w.weekEnd, label: w.label,
        note: existing.note || '', strength: existing.strength || null,
        steps: existing.steps ?? null, steps_goal: existing.steps_goal ?? null,
        kcal_on: existing.kcal_on ?? null, kcal_off: existing.kcal_off ?? null,
        dias_on: existing.dias_on ?? null,
        protein_on: existing.protein_on ?? null, carbs_on: existing.carbs_on ?? null, fat_on: existing.fat_on ?? null,
        protein_off: existing.protein_off ?? null, carbs_off: existing.carbs_off ?? null, fat_off: existing.fat_off ?? null,
        adherence: existing.adherence ?? null,
        days: existing.days ?? Array(7).fill(null).map(() => ({ weight: null, steps: null, trained: null, diet: null })),
        saved: existing.saved || false,
      };
    });
  }, [checkin, realWeeks]);

  // Semana activa — la que contiene hoy si es el mes actual, si no la primera
  const todayWeekStart = mondayOf(today);
  const defaultWeekIdx = useMemo(() => {
    if (activeMonth === currentMonth) {
      const idx = realWeeks.findIndex((w) => w.weekStart <= today && w.weekEnd >= today);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  }, [activeMonth, currentMonth, realWeeks, today]);
  const [activeWeekIdx, setActiveWeekIdx] = useState(defaultWeekIdx);
  useEffect(() => setActiveWeekIdx(defaultWeekIdx), [defaultWeekIdx]);

  // Edición local de la semana activa
  const [weekDraft, setWeekDraft] = useState(null);
  const [weekSaving, setWeekSaving] = useState(false);
  const [weekSaved,  setWeekSaved]  = useState(false);

  // Al cambiar de semana — cargar borrador
  useEffect(() => {
    setWeekDraft(weeklyNotes[activeWeekIdx] ? { ...weeklyNotes[activeWeekIdx] } : null);
    setWeekSaved(false);
  }, [activeWeekIdx, activeMonth, checkin?.id]);

  const updateDraft = (patch) => setWeekDraft((d) => ({ ...d, ...patch }));

  const saveWeek = async () => {
    if (!checkin || !weekDraft) return;
    setWeekSaving(true);
    const updated = weeklyNotes.map((w, i) =>
      i === activeWeekIdx ? { ...weekDraft, saved: true } : w
    );
    await supabase.from('tracking_checkins')
      .update({ weekly_notes: updated, updated_at: new Date().toISOString() })
      .eq('id', checkin.id);
    setCheckins((cs) => cs.map((c) => c.id === checkin.id ? { ...c, weekly_notes: updated } : c));
    setWeekSaving(false);
    setWeekSaved(true);
    setTimeout(() => setWeekSaved(false), 2500);
  };

  const updateCheckin = async (id, patch) => {
    setCheckins((cs) => cs.map((c) => c.id === id ? { ...c, ...patch } : c));
    await supabase.from('tracking_checkins')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
  };

  const addMonth = async () => {
    const phase = phaseForDate(phases, `${activeMonth}-01`)?.name || null;
    const { data } = await supabase.from('tracking_checkins').insert({
      tracking_client_id: clienteId,
      month: activeMonth,
      phase,
      weekly_notes: defaultWeeklyNotes(activeMonth),
    }).select().single();
    if (data) { setCheckins((cs) => [data, ...cs]); router.refresh(); }
  };

  const editMeasurement = (name, value) => {
    setMeasurementsSaved(false);
    setMeasurementsDraft((d) => ({
      ...(d || checkin?.measurements || {}),
      [name]: value === '' ? null : Number(value),
    }));
  };

  const saveMeasurements = async () => {
    if (!checkin) return;
    await updateCheckin(checkin.id, { measurements: measurementsDraft || checkin.measurements || {} });
    setMeasurementsSaved(true);
    setTimeout(() => setMeasurementsSaved(false), 2500);
  };

  const removeCheckin = async (id, month) => {
    if (!window.confirm(`¿Borrar el seguimiento de ${monthLabelFull(month)}?`)) return;
    setCheckins((cs) => cs.filter((c) => c.id !== id));
    await supabase.from('tracking_checkins').delete().eq('id', id);
  };

  const toggleCall = async (ch) => {
    const newDone = !ch.call_done;
    await updateCheckin(ch.id, { call_done: newDone });
    if (newDone && !autoExported) {
      setTimeout(async () => {
        setExportingId(ch.id);
        await downloadCheckinPDF({ name: clienteName, id: clienteId }, { ...ch, call_done: true }, checkins);
        setExportingId(null);
        setAutoExported(true);
      }, 400);
    }
  };

  const exportPdf = async (ch) => {
    setExportingId(ch.id);
    await downloadCheckinPDF({ name: clienteName, id: clienteId }, ch, checkins);
    setExportingId(null);
  };

  const activeWeek = realWeeks[activeWeekIdx];
  const w = weekDraft || weeklyNotes[activeWeekIdx] || {};

  // Cálculos de la semana activa
  const kcalMediaW   = calcKcalMedia(w.kcal_on, w.kcal_off, w.dias_on);
  const kcalMacrosOn = calcKcalFromMacros(w.protein_on, w.carbs_on, w.fat_on);
  const kcalMacrosOff= calcKcalFromMacros(w.protein_off, w.carbs_off, w.fat_off);
  const diasOff      = w.dias_on != null ? 7 - Number(w.dias_on) : null;

  // Medias del mes
  const notesArr   = weeklyNotes;
  const avgSteps   = avgWeeklyField(notesArr, 'steps');
  const avgAdh     = avgWeeklyField(notesArr, 'adherence');
  const kcalMedias = notesArr.map((n) => calcKcalMedia(n.kcal_on, n.kcal_off, n.dias_on)).filter(Boolean);
  const avgKcal    = kcalMedias.length ? Math.round(kcalMedias.reduce((a,b)=>a+b,0)/kcalMedias.length) : null;

  return (
    <div className="space-y-4">

      {/* ── NAVEGACIÓN DE MES ── */}
      <div className="flex items-center justify-between">
        <button onClick={() => setActiveMonth(prevMonth(activeMonth))}
          className="p-2 rounded-lg text-muted hover:text-ink transition-colors"
          style={{ border: '1px solid var(--color-border)' }}>
          <ChevronLeft size={16} />
        </button>
        <div className="text-center">
          <div className="text-ink font-bold text-base">{monthLabelFull(activeMonth)}</div>
          {activeMonth === currentMonth && (
            <div className="text-cyan text-[10px] font-semibold uppercase tracking-widest">Mes actual</div>
          )}
        </div>
        <button onClick={() => setActiveMonth(nextMonth(activeMonth))}
          className="p-2 rounded-lg text-muted hover:text-ink transition-colors"
          style={{ border: '1px solid var(--color-border)' }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* ── SIN MES CREADO ── */}
      {!hasMonth && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="text-muted text-sm">Sin seguimiento para {monthLabelFull(activeMonth)}.</div>
          <button onClick={addMonth}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'var(--color-violet)', color: '#0D0A1F' }}>
            <Plus size={15} /> Crear seguimiento de {monthLabelFull(activeMonth)}
          </button>
        </div>
      )}

      {hasMonth && checkin && (
        <>
          {/* ── FASE DEL MES ── */}
          <Card>
            <div className="text-muted text-[10px] uppercase tracking-widest mb-3">Fase de este mes</div>
            <div className="flex flex-wrap gap-2">
              {PHASE_NAMES.filter((n) => n !== 'Otra').map((p) => (
                <button key={p} onClick={() => updateCheckin(checkin.id, { phase: p })}
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: checkin.phase === p ? phaseColor(phases, p) : 'transparent',
                    color:      checkin.phase === p ? '#00161C' : 'var(--color-muted)',
                    border:     `1px solid ${checkin.phase === p ? phaseColor(phases, p) : 'var(--color-border)'}`,
                  }}>{p}</button>
              ))}
            </div>
          </Card>

          {/* ── STATS RÁPIDOS DEL MES ── */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl p-4" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
              <div className="text-muted text-[10px] uppercase tracking-widest mb-1">Peso</div>
              <div className="flex items-baseline gap-1">
                <input type="number" step="0.1" value={checkin.weight ?? ''} placeholder="—"
                  onChange={(e) => updateCheckin(checkin.id, { weight: e.target.value ? Number(e.target.value) : null })}
                  className="text-cyan text-2xl font-bold bg-transparent outline-none w-full border-none" />
                {checkin.weight != null && <span className="text-cyan text-sm font-bold">kg</span>}
              </div>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
              <div className="text-muted text-[10px] uppercase tracking-widest mb-1">Media pasos</div>
              <div className="text-green text-xl font-bold">{avgSteps != null ? Math.round(avgSteps).toLocaleString() : '—'}</div>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
              <div className="text-muted text-[10px] uppercase tracking-widest mb-1">Cintura</div>
              <div className="flex items-baseline gap-1">
                <input type="number" step="0.5"
                  value={(measurementsDraft ?? checkin.measurements ?? {})['Cintura'] ?? ''}
                  onChange={(e) => editMeasurement('Cintura', e.target.value)}
                  className="text-amber text-2xl font-bold bg-transparent outline-none w-full border-none" placeholder="—" />
                {(measurementsDraft ?? checkin.measurements ?? {})['Cintura'] != null && <span className="text-amber text-sm font-bold">cm</span>}
              </div>
            </div>
          </div>

          {/* ── SEMANA A SEMANA ── */}
          <Card>
            <div className="flex items-center gap-2 text-muted text-[10px] uppercase tracking-widest mb-4">
              <Clock size={11} /> Semana a semana
            </div>

            {/* Tabs de semanas */}
            <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
              {realWeeks.map((rw, i) => {
                const wn    = weeklyNotes[i] || {};
                const isNow = rw.weekStart <= today && rw.weekEnd >= today;
                const isSaved = wn.saved;
                return (
                  <button key={i} onClick={() => setActiveWeekIdx(i)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 shrink-0 transition-all"
                    style={{
                      background: activeWeekIdx === i ? 'var(--color-cyan)' : 'transparent',
                      color:      activeWeekIdx === i ? '#00161C' : isNow ? 'var(--color-cyan)' : 'var(--color-muted)',
                      border:     `1px solid ${activeWeekIdx === i ? 'var(--color-cyan)' : isNow ? 'var(--color-cyan)' : 'var(--color-border)'}`,
                    }}>
                    {isSaved && <div className="w-1.5 h-1.5 rounded-full" style={{ background: STRENGTH_COLOR[wn.strength] || '#4ADE80' }} />}
                    {rw.shortLabel}
                  </button>
                );
              })}
            </div>

            {/* Contenido de la semana activa */}
            {activeWeek && (
              <div className="space-y-3">
                {/* Cabecera semana */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-ink text-sm font-bold">{activeWeek.label}</div>
                    <div className="text-muted text-[10px]">
                      {fmtDateFull(activeWeek.weekStart)} – {fmtDateFull(activeWeek.weekEnd)}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {WEEK_STRENGTHS.map((s) => (
                      <button key={s} onClick={() => updateDraft({ strength: s })}
                        className="px-3 py-1 rounded-md text-xs font-bold transition-all"
                        style={{
                          background: w.strength === s ? `${STRENGTH_COLOR[s]}20` : 'transparent',
                          color:      w.strength === s ? STRENGTH_COLOR[s] : 'var(--color-muted)',
                          border:     `1px solid ${w.strength === s ? STRENGTH_COLOR[s] : 'transparent'}`,
                        }}>{s}</button>
                    ))}
                  </div>
                </div>

                {/* Nota libre */}
                <input value={w.note || ''} onChange={(e) => updateDraft({ note: e.target.value })}
                  placeholder="Nota de esta semana..."
                  className="w-full text-muted text-sm bg-surfaceAlt border border-border rounded-lg px-3 py-2 outline-none focus:border-cyan" />

                {/* Pasos + Adherencia */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl p-3" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[9px] text-muted uppercase tracking-widest flex items-center gap-1">
                        <Footprints size={9} style={{ color: '#4ADE80' }} /> Pasos/día
                      </div>
                      <div className="flex items-center gap-1">
                        <Target size={9} className="text-muted" />
                        <input type="number" value={w.steps_goal ?? ''} placeholder="Obj."
                          onChange={(e) => updateDraft({ steps_goal: e.target.value === '' ? null : Number(e.target.value) })}
                          className="bg-transparent text-[10px] text-muted outline-none w-14 text-right border-none" />
                      </div>
                    </div>
                    <input type="number" value={w.steps ?? ''} placeholder="—"
                      onChange={(e) => updateDraft({ steps: e.target.value === '' ? null : Number(e.target.value) })}
                      className="bg-transparent text-green text-lg font-bold outline-none w-full border-none" />
                    <ProgressBar value={w.steps} goal={w.steps_goal} color="#4ADE80" />
                  </div>

                  <div className="rounded-xl p-3" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                    <div className="text-[9px] text-muted uppercase tracking-widest mb-1 flex items-center gap-1">
                      <Percent size={9} style={{ color: '#A78BFA' }} /> Adherencia
                    </div>
                    <div className="flex items-baseline gap-0.5">
                      <input type="number" min="0" max="100" value={w.adherence ?? ''} placeholder="—"
                        onChange={(e) => updateDraft({ adherence: e.target.value === '' ? null : Number(e.target.value) })}
                        className="bg-transparent text-violet text-lg font-bold outline-none w-full border-none" />
                      {w.adherence != null && <span className="text-violet text-xs font-bold">%</span>}
                    </div>
                    <ProgressBar value={w.adherence} goal={100} color="#A78BFA" />
                  </div>
                </div>

                {/* Kcal ON / OFF */}
                <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                  <div className="text-[9px] text-muted uppercase tracking-widest">Kcal días ON / OFF</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-[9px] font-bold text-amber mb-1">Kcal ON</div>
                      <input type="number" value={w.kcal_on ?? ''} placeholder="—"
                        onChange={(e) => updateDraft({ kcal_on: e.target.value === '' ? null : Number(e.target.value) })}
                        className="bg-transparent text-amber text-base font-bold outline-none w-full border-none" />
                    </div>
                    <div>
                      <div className="text-[9px] font-bold mb-1" style={{ color: '#FB923C' }}>Kcal OFF</div>
                      <input type="number" value={w.kcal_off ?? ''} placeholder="—"
                        onChange={(e) => updateDraft({ kcal_off: e.target.value === '' ? null : Number(e.target.value) })}
                        className="bg-transparent text-base font-bold outline-none w-full border-none" style={{ color: '#FB923C' }} />
                    </div>
                    <div>
                      <div className="text-[9px] text-muted mb-1">Días ON / OFF</div>
                      <div className="flex items-center gap-1">
                        <input type="number" min="0" max="7" value={w.dias_on ?? ''} placeholder="—"
                          onChange={(e) => updateDraft({ dias_on: e.target.value === '' ? null : Number(e.target.value) })}
                          className="bg-transparent text-amber text-base font-bold outline-none w-8 border-none" />
                        {diasOff != null && <span className="text-muted text-xs">/ {diasOff}d</span>}
                      </div>
                    </div>
                  </div>
                  {kcalMediaW != null && (
                    <div className="text-[10px] text-muted pt-1 border-t border-border">
                      Media: <span className="text-amber font-bold">{kcalMediaW} kcal/día</span>
                      {w.dias_on != null && <span className="ml-1">({w.dias_on}d on · {diasOff}d off)</span>}
                    </div>
                  )}
                </div>

                {/* Macros ON */}
                <div className="rounded-xl p-3" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                  <div className="text-[9px] text-muted uppercase tracking-widest mb-2">Macros días ON</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-[9px] font-bold text-cyan mb-1">Proteínas (g)</div>
                      <input type="number" value={w.protein_on ?? ''} placeholder="—"
                        onChange={(e) => updateDraft({ protein_on: e.target.value === '' ? null : Number(e.target.value) })}
                        className="bg-transparent text-cyan text-base font-bold outline-none w-full border-none" />
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-amber mb-1">Carbos (g)</div>
                      <input type="number" value={w.carbs_on ?? ''} placeholder="—"
                        onChange={(e) => updateDraft({ carbs_on: e.target.value === '' ? null : Number(e.target.value) })}
                        className="bg-transparent text-amber text-base font-bold outline-none w-full border-none" />
                    </div>
                    <div>
                      <div className="text-[9px] font-bold mb-1" style={{ color: '#FB923C' }}>Grasas (g)</div>
                      <input type="number" value={w.fat_on ?? ''} placeholder="—"
                        onChange={(e) => updateDraft({ fat_on: e.target.value === '' ? null : Number(e.target.value) })}
                        className="bg-transparent text-base font-bold outline-none w-full border-none" style={{ color: '#FB923C' }} />
                    </div>
                  </div>
                  {kcalMacrosOn != null && (
                    <div className="text-[10px] text-muted mt-2 pt-2 border-t border-border">
                      Kcal calculadas: <span className="text-green font-bold">{kcalMacrosOn} kcal</span>
                      <span className="ml-1 text-[9px]">({w.protein_on ?? 0}P×4 + {w.carbs_on ?? 0}C×4 + {w.fat_on ?? 0}G×9)</span>
                    </div>
                  )}
                </div>

                {/* Macros OFF */}
                <div className="rounded-xl p-3" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                  <div className="text-[9px] text-muted uppercase tracking-widest mb-2">Macros días OFF</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-[9px] font-bold text-cyan mb-1">Proteínas (g)</div>
                      <input type="number" value={w.protein_off ?? ''} placeholder="—"
                        onChange={(e) => updateDraft({ protein_off: e.target.value === '' ? null : Number(e.target.value) })}
                        className="bg-transparent text-cyan text-base font-bold outline-none w-full border-none" />
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-amber mb-1">Carbos (g)</div>
                      <input type="number" value={w.carbs_off ?? ''} placeholder="—"
                        onChange={(e) => updateDraft({ carbs_off: e.target.value === '' ? null : Number(e.target.value) })}
                        className="bg-transparent text-amber text-base font-bold outline-none w-full border-none" />
                    </div>
                    <div>
                      <div className="text-[9px] font-bold mb-1" style={{ color: '#FB923C' }}>Grasas (g)</div>
                      <input type="number" value={w.fat_off ?? ''} placeholder="—"
                        onChange={(e) => updateDraft({ fat_off: e.target.value === '' ? null : Number(e.target.value) })}
                        className="bg-transparent text-base font-bold outline-none w-full border-none" style={{ color: '#FB923C' }} />
                    </div>
                  </div>
                  {kcalMacrosOff != null && (
                    <div className="text-[10px] text-muted mt-2 pt-2 border-t border-border">
                      Kcal calculadas: <span className="font-bold" style={{ color: '#FB923C' }}>{kcalMacrosOff} kcal</span>
                    </div>
                  )}
                </div>

                {/* ── DÍAS DE LA SEMANA ── */}
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                  <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: 'var(--color-surfaceAlt)' }}>
                    <div className="text-[9px] text-muted uppercase tracking-widest">Registro diario</div>
                    {/* Media de peso de los días rellenados */}
                    {(() => {
                      const days = w.days || [];
                      const weights = days.map((d) => d.weight).filter((v) => v != null);
                      const avgW = weights.length ? Math.round(weights.reduce((a,b)=>a+b,0)/weights.length * 10) / 10 : null;
                      const avgS = (() => { const s = days.map((d) => d.steps).filter((v) => v != null); return s.length ? Math.round(s.reduce((a,b)=>a+b,0)/s.length) : null; })();
                      return avgW != null ? (
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-muted">Media peso: <span className="text-cyan font-bold">{avgW} kg</span></span>
                          {avgS != null && <span className="text-muted">Pasos: <span className="text-green font-bold">{avgS.toLocaleString()}</span></span>}
                        </div>
                      ) : null;
                    })()}
                  </div>

                  {/* Generar los 7 días de la semana activa */}
                  {activeWeek && (() => {
                    const DAY_NAMES = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
                    const days = w.days || Array(7).fill(null).map(() => ({
                      weight: null, steps: null, trained: null, diet: null,
                    }));

                    return DAY_NAMES.map((dayName, di) => {
                      const dateISO  = addDaysISO(activeWeek.weekStart, di);
                      const [,, dd]  = dateISO.split('-');
                      const [, mm]   = dateISO.split('-');
                      const MONTHS   = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
                      const label    = `${dayName} ${parseInt(dd)} ${MONTHS[parseInt(mm)-1]}`;
                      const day      = days[di] || { weight: null, steps: null, trained: null, diet: null };
                      const isToday  = dateISO === today;

                      const updateDay = (patch) => {
                        const next = [...Array(7)].map((_, j) => j === di ? { ...(days[j] || {}), ...patch } : (days[j] || {}));
                        updateDraft({ days: next });
                      };

                      return (
                        <div key={di}
                          style={{
                            borderTop: '1px solid var(--color-border)',
                            background: isToday ? 'rgba(94,204,250,0.04)' : di % 2 === 0 ? 'var(--color-bg)' : 'var(--color-surface)',
                          }}>
                          {/* Cabecera del día */}
                          <div className="px-4 py-2 flex items-center gap-3">
                            <div className="text-xs font-bold w-24 shrink-0 flex items-center gap-1.5">
                              {isToday && <div className="w-1.5 h-1.5 rounded-full bg-cyan shrink-0" />}
                              <span style={{ color: isToday ? 'var(--color-cyan)' : 'var(--color-ink)' }}>{label}</span>
                            </div>

                            {/* Peso del día */}
                            <div className="flex items-center gap-1 flex-1">
                              <input type="number" step="0.1" value={day.weight ?? ''} placeholder="Peso"
                                onChange={(e) => updateDay({ weight: e.target.value === '' ? null : Number(e.target.value) })}
                                className="bg-surfaceAlt border border-border text-cyan text-sm font-bold rounded-lg px-2 py-1 outline-none focus:border-cyan w-20" />
                              {day.weight != null && <span className="text-muted text-[10px]">kg</span>}
                            </div>

                            {/* Pasos del día */}
                            <div className="flex items-center gap-1 flex-1">
                              <input type="number" value={day.steps ?? ''} placeholder="Pasos"
                                onChange={(e) => updateDay({ steps: e.target.value === '' ? null : Number(e.target.value) })}
                                className="bg-surfaceAlt border border-border text-green text-sm font-bold rounded-lg px-2 py-1 outline-none focus:border-cyan w-24" />
                            </div>

                            {/* Entrenó */}
                            <div className="flex gap-1 shrink-0">
                              {[
                                { val: 'si',       label: '💪', title: 'Entrenó' },
                                { val: 'no',       label: '✗',  title: 'No entrenó' },
                                { val: 'descanso', label: '😴', title: 'Descanso programado' },
                              ].map((opt) => (
                                <button key={opt.val} title={opt.title}
                                  onClick={() => updateDay({ trained: day.trained === opt.val ? null : opt.val })}
                                  className="w-7 h-7 rounded-lg text-xs flex items-center justify-center transition-all"
                                  style={{
                                    background: day.trained === opt.val
                                      ? opt.val === 'si' ? '#4ADE8020' : opt.val === 'no' ? '#F8717120' : '#FBBF2420'
                                      : 'transparent',
                                    border: `1px solid ${day.trained === opt.val
                                      ? opt.val === 'si' ? '#4ADE80' : opt.val === 'no' ? '#F87171' : '#FBBF24'
                                      : 'var(--color-border)'}`,
                                  }}>{opt.label}</button>
                              ))}
                            </div>

                            {/* Dieta */}
                            <div className="flex gap-1 shrink-0">
                              {[
                                { val: 'si',      label: '✓', title: 'Dieta cumplida',  color: '#4ADE80' },
                                { val: 'parcial', label: '~', title: 'Dieta parcial',   color: '#FBBF24' },
                                { val: 'no',      label: '✗', title: 'Dieta no cumplida', color: '#F87171' },
                              ].map((opt) => (
                                <button key={opt.val} title={opt.title}
                                  onClick={() => updateDay({ diet: day.diet === opt.val ? null : opt.val })}
                                  className="w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center transition-all"
                                  style={{
                                    background: day.diet === opt.val ? `${opt.color}20` : 'transparent',
                                    color:      day.diet === opt.val ? opt.color : 'var(--color-muted)',
                                    border:     `1px solid ${day.diet === opt.val ? opt.color : 'var(--color-border)'}`,
                                  }}>{opt.label}</button>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}

                  {/* Resumen semanal de días */}
                  {(() => {
                    const days = w.days || [];
                    const trained   = days.filter((d) => d?.trained === 'si').length;
                    const descanso  = days.filter((d) => d?.trained === 'descanso').length;
                    const noTrained = days.filter((d) => d?.trained === 'no').length;
                    const dietaSi   = days.filter((d) => d?.diet === 'si').length;
                    const dietaParcial = days.filter((d) => d?.diet === 'parcial').length;
                    const dietaNo   = days.filter((d) => d?.diet === 'no').length;
                    const weights   = days.map((d) => d?.weight).filter((v) => v != null);
                    const avgW      = weights.length ? Math.round(weights.reduce((a,b)=>a+b,0)/weights.length*10)/10 : null;
                    if (!trained && !dietaSi && !avgW) return null;
                    return (
                      <div className="px-4 py-3 flex flex-wrap gap-x-4 gap-y-1 text-xs"
                        style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surfaceAlt)' }}>
                        {avgW != null && <span><span className="text-muted">Media peso: </span><span className="font-bold text-cyan">{avgW} kg</span></span>}
                        {trained > 0 && <span><span className="text-muted">Entrenos: </span><span className="font-bold text-green">{trained}d</span></span>}
                        {descanso > 0 && <span><span className="text-muted">Descanso: </span><span className="font-bold text-amber">{descanso}d</span></span>}
                        {noTrained > 0 && <span><span className="text-muted">Sin entrenar: </span><span className="font-bold text-red">{noTrained}d</span></span>}
                        {(dietaSi + dietaParcial + dietaNo) > 0 && (
                          <span><span className="text-muted">Dieta: </span>
                            <span className="font-bold text-green">{dietaSi}✓</span>
                            {dietaParcial > 0 && <span className="font-bold text-amber ml-1">{dietaParcial}~</span>}
                            {dietaNo > 0 && <span className="font-bold text-red ml-1">{dietaNo}✗</span>}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Botón guardar semana */}
                <button onClick={saveWeek} disabled={weekSaving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                  style={{
                    background: weekSaved ? '#4ADE8018' : 'var(--color-violet)',
                    color:      weekSaved ? 'var(--color-green)' : '#0D0A1F',
                    border:     weekSaved ? '1px solid var(--color-green)' : 'none',
                  }}>
                  {weekSaving ? <Loader2 size={14} className="animate-spin" /> : weekSaved ? <Check size={14} /> : <Save size={14} />}
                  {weekSaving ? 'Guardando…' : weekSaved ? 'Semana guardada' : 'Guardar esta semana'}
                </button>

                {/* Resumen medias del mes */}
                {(avgSteps != null || avgKcal != null || avgAdh != null) && (
                  <div className="rounded-xl p-3" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
                    <div className="text-[9px] text-muted uppercase tracking-widest mb-2">Medias del mes</div>
                    <div className="flex flex-wrap gap-4 text-xs">
                      {avgSteps != null && <span><span className="text-muted">Pasos: </span><span className="font-bold text-green">{Math.round(avgSteps).toLocaleString()}</span></span>}
                      {avgKcal  != null && <span><span className="text-muted">Kcal: </span><span className="font-bold text-amber">{avgKcal}</span></span>}
                      {avgAdh   != null && <span><span className="text-muted">Adherencia: </span><span className="font-bold text-violet">{avgAdh}%</span></span>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* ── ENTRENAMIENTO + NUTRICIÓN ── */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <div className="flex items-center justify-between mb-2.5 flex-wrap gap-1.5">
                <div className="flex items-center gap-1.5 text-muted text-[10px] uppercase tracking-widest"><Dumbbell size={11} /> Entrenamiento</div>
                <div className="flex gap-1">
                  {LEVEL_OPTIONS.map((lvl) => (
                    <button key={lvl} onClick={() => updateCheckin(checkin.id, { training_level: lvl })}
                      className="w-2.5 h-2.5 rounded-full transition-all" title={lvl}
                      style={{
                        background: checkin.training_level === lvl ? LEVEL_COLORS[lvl] : 'var(--color-border)',
                        outline: checkin.training_level === lvl ? `2px solid ${LEVEL_COLORS[lvl]}40` : 'none',
                      }} />
                  ))}
                </div>
              </div>
              {checkin.training_level && (
                <div className="text-[11px] font-bold mb-2" style={{ color: LEVEL_COLORS[checkin.training_level] }}>{checkin.training_level}</div>
              )}
              <textarea value={checkin.training_notes || ''} rows={3}
                onChange={(e) => updateCheckin(checkin.id, { training_notes: e.target.value })}
                placeholder="Progresión, ejercicios clave..."
                className="bg-transparent text-ink text-sm w-full outline-none resize-none leading-relaxed border-none" />
            </Card>
            <Card>
              <div className="flex items-center justify-between mb-2.5 flex-wrap gap-1.5">
                <div className="flex items-center gap-1.5 text-muted text-[10px] uppercase tracking-widest"><Apple size={11} /> Nutrición</div>
                <div className="flex gap-1">
                  {LEVEL_OPTIONS.map((lvl) => (
                    <button key={lvl} onClick={() => updateCheckin(checkin.id, { nutrition_level: lvl })}
                      className="w-2.5 h-2.5 rounded-full transition-all" title={lvl}
                      style={{
                        background: checkin.nutrition_level === lvl ? LEVEL_COLORS[lvl] : 'var(--color-border)',
                        outline: checkin.nutrition_level === lvl ? `2px solid ${LEVEL_COLORS[lvl]}40` : 'none',
                      }} />
                  ))}
                </div>
              </div>
              {checkin.nutrition_level && (
                <div className="text-[11px] font-bold mb-2" style={{ color: LEVEL_COLORS[checkin.nutrition_level] }}>{checkin.nutrition_level}</div>
              )}
              <textarea value={checkin.nutrition_notes || ''} rows={3}
                onChange={(e) => updateCheckin(checkin.id, { nutrition_notes: e.target.value })}
                placeholder="Adherencia, puntos débiles..."
                className="bg-transparent text-ink text-sm w-full outline-none resize-none leading-relaxed border-none" />
            </Card>
          </div>

          {/* ── OBJETIVO DEL MES ── */}
          <Card>
            <div className="text-muted text-[10px] uppercase tracking-widest mb-2">Objetivo del mes</div>
            <textarea value={checkin.goals || ''} rows={2}
              onChange={(e) => updateCheckin(checkin.id, { goals: e.target.value })}
              placeholder="Ej. Bajar a 80kg manteniendo fuerza..."
              className="bg-transparent text-ink text-sm w-full outline-none resize-none leading-relaxed border-none mb-3" />
            <div className="flex gap-2 flex-wrap">
              {GOAL_STATUSES.map((s) => (
                <button key={s} onClick={() => updateCheckin(checkin.id, { goal_status: s })}
                  className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: checkin.goal_status === s ? `${GOAL_COLORS[s]}20` : 'transparent',
                    color:      checkin.goal_status === s ? GOAL_COLORS[s] : 'var(--color-muted)',
                    border:     `1px solid ${checkin.goal_status === s ? GOAL_COLORS[s] : 'var(--color-border)'}`,
                  }}>{s}</button>
              ))}
            </div>
          </Card>

          {/* ── VIDEOLLAMADA ── */}
          <Card>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 text-ink font-semibold text-sm mb-0.5">
                  <Video size={14} className="text-muted" /> Videollamada mensual
                </div>
                <input type="date" value={checkin.call_date || ''}
                  onChange={(e) => updateCheckin(checkin.id, { call_date: e.target.value || null })}
                  className="bg-transparent text-muted text-xs outline-none border-none" />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleCall(checkin)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: checkin.call_done ? '#4ADE8018' : 'var(--color-bg)',
                    color:      checkin.call_done ? 'var(--color-green)' : 'var(--color-muted)',
                    border:     `1px solid ${checkin.call_done ? 'var(--color-green)' : 'var(--color-border)'}`,
                  }}>
                  {checkin.call_done ? <Check size={12} /> : <X size={12} />}
                  {checkin.call_done ? 'Realizada' : 'Pendiente'}
                </button>
                {checkin.call_done && (
                  <button onClick={() => exportPdf(checkin)} disabled={exportingId === checkin.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                    style={{ background: 'var(--color-surfaceAlt)', color: 'var(--color-cyan)', border: '1px solid var(--color-border)' }}>
                    {exportingId === checkin.id ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
                    PDF
                  </button>
                )}
              </div>
            </div>
            {autoExported && (
              <div className="mt-2 flex items-center gap-1.5 text-green text-xs">
                <Sparkles size={11} /> PDF exportado automáticamente
              </div>
            )}
            <textarea value={checkin.call_notes || ''} rows={2}
              onChange={(e) => updateCheckin(checkin.id, { call_notes: e.target.value })}
              placeholder="Guion / temas a tratar..."
              className="mt-3 bg-surface border border-border text-ink text-sm w-full outline-none resize-none rounded-lg px-3 py-2 focus:border-cyan" />
          </Card>

          {/* ── MEDICIONES ── */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5 text-muted text-[10px] uppercase tracking-widest"><Ruler size={11} /> Mediciones</div>
              <button onClick={saveMeasurements}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                style={{ background: measurementsSaved ? '#4ADE8018' : 'var(--color-violet)', color: measurementsSaved ? 'var(--color-green)' : '#0D0A1F' }}>
                {measurementsSaved ? <><Check size={11} /> Guardado</> : 'Guardar'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-x-4 gap-y-3">
              {MEASUREMENTS.map((m) => (
                <div key={m}>
                  <div className="text-muted text-[10px] mb-1">{m}</div>
                  <input type="number"
                    value={(measurementsDraft ?? checkin.measurements ?? {})[m] ?? ''}
                    onChange={(e) => editMeasurement(m, e.target.value)}
                    placeholder="—"
                    className="bg-surface border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full outline-none focus:border-cyan" />
                </div>
              ))}
            </div>
          </Card>

          {/* ── NOTAS + BORRAR ── */}
          <input value={checkin.notes || ''}
            onChange={(e) => updateCheckin(checkin.id, { notes: e.target.value })}
            placeholder="Notas adicionales..."
            className="w-full bg-surfaceAlt border border-border text-ink rounded-xl px-4 py-3 text-sm outline-none focus:border-cyan" />

          <button onClick={() => removeCheckin(checkin.id, checkin.month)}
            className="text-red text-xs flex items-center gap-1 mx-auto opacity-50 hover:opacity-100 transition-opacity">
            <Trash2 size={12} /> Borrar seguimiento de {monthLabelFull(activeMonth)}
          </button>
        </>
      )}
    </div>
  );
}

// Helper — formato de fecha legible
function fmtDateFull(iso) {
  if (!iso) return '';
  const DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const d = new Date(iso + 'T12:00:00Z');
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
