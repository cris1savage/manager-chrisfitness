'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PHASE_NAMES, phaseColor, addDaysISO } from '@/lib/timeline';

const STEPS = ['Datos básicos', 'Fases', 'Peso inicial'];
const DURACIONES = ['Mensual', 'Trimestral', 'Semestral', 'Anual', 'Personalizada'];

function StepDot({ n, active, done }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all"
        style={{
          background: done ? 'var(--color-green)' : active ? 'var(--color-violet)' : 'var(--color-surfaceAlt)',
          color:      done ? '#050708'             : active ? '#0D0A1F'             : 'var(--color-muted)',
          border:     `1px solid ${done ? 'var(--color-green)' : active ? 'var(--color-violet)' : 'var(--color-border)'}`,
        }}>
        {done ? <Check size={11} /> : n}
      </div>
    </div>
  );
}

export default function NuevoClienteModal({ onClose }) {
  const router  = useRouter();
  const today   = new Date().toISOString().slice(0, 10);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Paso 1 — datos básicos
  const [form, setForm] = useState({
    name: '', program: 'Coaching 1:1', start_date: today, duration: 'Mensual',
  });

  // Paso 2 — fases
  const [phases, setPhases] = useState([
    { name: 'Definición', start_date: today, end_date: addDaysISO(today, 90), rate: -0.5, goal: '' },
  ]);

  // Paso 3 — peso inicial
  const [startWeight, setStartWeight] = useState('');
  const [longTermGoal, setLongTermGoal] = useState('');

  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const addPhase = () => {
    const last  = phases[phases.length - 1];
    const start = last ? addDaysISO(last.end_date, 1) : today;
    setPhases([...phases, { name: 'Volumen', start_date: start, end_date: addDaysISO(start, 90), rate: 0.3, goal: '' }]);
  };
  const removePhase = (i) => setPhases(phases.filter((_, idx) => idx !== i));
  const updatePhase = (i, patch) => setPhases(phases.map((p, idx) => idx === i ? { ...p, ...patch } : p));

  const validate = () => {
    if (step === 0 && !form.name.trim()) { setErr('El nombre es obligatorio.'); return false; }
    if (step === 1 && phases.length === 0) { setErr('Añade al menos una fase.'); return false; }
    setErr(''); return true;
  };

  const next = () => { if (validate()) setStep((s) => s + 1); };
  const back = () => { setErr(''); setStep((s) => s - 1); };

  const handleCreate = async () => {
    setSaving(true);
    setErr('');
    const sb = createClient();

    const { data: cliente, error } = await sb
      .from('tracking_clients')
      .insert({
        ...form,
        status: 'Activo',
        phases,
        long_term_goal: longTermGoal || null,
      })
      .select()
      .single();

    if (error) {
      setSaving(false);
      setErr('No se pudo crear el cliente. Comprueba tu conexión e inténtalo de nuevo.');
      return;
    }

    // Si hay peso inicial, crear el checkin del mes actual
    if (startWeight && !isNaN(Number(startWeight))) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { error: checkinErr } = await sb.from('tracking_checkins').insert({
        tracking_client_id: cliente.id,
        month: currentMonth,
        weight: Number(startWeight),
        phase: phases.find((p) => {
          const today = new Date().toISOString().slice(0, 10);
          return today >= p.start_date && today <= p.end_date;
        })?.name || null,
      });
      if (checkinErr) console.warn('Error creando checkin inicial:', checkinErr.message);
    }

    setSaving(false);
    onClose();
    router.push(`/clientes/${cliente.id}/fases`);
    router.refresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: '#00000088' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>

        {/* Header con pasos */}
        <div className="px-6 pt-5 pb-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-ink font-bold text-base">Nuevo cliente</h2>
            <button onClick={onClose} className="text-muted p-1"><X size={18} /></button>
          </div>
          {/* Stepper */}
          <div className="flex items-center gap-0">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <StepDot n={i + 1} active={step === i} done={step > i} />
                  <span className="text-[9px] font-semibold whitespace-nowrap"
                    style={{ color: step === i ? 'var(--color-violet)' : step > i ? 'var(--color-green)' : 'var(--color-muted)' }}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 h-px mx-2 mb-4"
                    style={{ background: step > i ? 'var(--color-green)' : 'var(--color-border)' }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contenido del paso */}
        <div className="px-6 py-5 space-y-4 min-h-[280px]">

          {/* ── PASO 1: Datos básicos ── */}
          {step === 0 && (
            <>
              <div>
                <label className="text-muted text-[10px] uppercase tracking-widest mb-1.5 block">Nombre *</label>
                <input autoFocus value={form.name} onChange={(e) => setF('name', e.target.value)}
                  placeholder="Ej. Marcos García"
                  onKeyDown={(e) => e.key === 'Enter' && next()}
                  className="w-full bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2.5 text-sm outline-none focus:border-cyan" />
              </div>
              <div>
                <label className="text-muted text-[10px] uppercase tracking-widest mb-1.5 block">Programa</label>
                <input value={form.program} onChange={(e) => setF('program', e.target.value)}
                  placeholder="Coaching 1:1"
                  className="w-full bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2.5 text-sm outline-none focus:border-cyan" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-muted text-[10px] uppercase tracking-widest mb-1.5 block">Fecha inicio</label>
                  <input type="date" value={form.start_date} onChange={(e) => setF('start_date', e.target.value)}
                    className="w-full bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2.5 text-sm outline-none focus:border-cyan" />
                </div>
                <div>
                  <label className="text-muted text-[10px] uppercase tracking-widest mb-1.5 block">Duración</label>
                  <select value={form.duration} onChange={(e) => setF('duration', e.target.value)}
                    className="w-full bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2.5 text-sm outline-none">
                    {DURACIONES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* ── PASO 2: Fases ── */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="text-muted text-xs">Define las fases de entrenamiento. Puedes ajustarlas después.</div>
              {phases.map((p, i) => {
                const color = phaseColor([], p.name);
                return (
                  <div key={i} className="rounded-xl p-3 space-y-2"
                    style={{ background: 'var(--color-surfaceAlt)', border: `1px solid ${color}40` }}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                      <select value={p.name} onChange={(e) => updatePhase(i, { name: e.target.value })}
                        className="bg-transparent border-none text-sm font-bold outline-none flex-1" style={{ color }}>
                        {PHASE_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <div className="flex items-center gap-1 text-muted text-xs">
                        <input type="number" step="0.05" value={p.rate}
                          onChange={(e) => updatePhase(i, { rate: Number(e.target.value) })}
                          className="w-12 bg-surface border border-border text-ink rounded px-1.5 py-1 text-xs text-right outline-none focus:border-cyan" />
                        <span>%/sem</span>
                      </div>
                      {phases.length > 1 && (
                        <button onClick={() => removePhase(i)} className="text-muted hover:text-red text-xs">✕</button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <input type="date" value={p.start_date} onChange={(e) => updatePhase(i, { start_date: e.target.value })}
                        className="bg-surface border border-border text-ink rounded px-2 py-1 text-xs outline-none focus:border-cyan flex-1" />
                      <span className="text-muted">→</span>
                      <input type="date" value={p.end_date} onChange={(e) => updatePhase(i, { end_date: e.target.value })}
                        className="bg-surface border border-border text-ink rounded px-2 py-1 text-xs outline-none focus:border-cyan flex-1" />
                    </div>
                  </div>
                );
              })}
              <button onClick={addPhase}
                className="w-full py-2 rounded-lg text-xs font-semibold text-muted transition-colors"
                style={{ border: '1px dashed var(--color-border)' }}>
                + Añadir fase
              </button>
            </div>
          )}

          {/* ── PASO 3: Peso inicial ── */}
          {step === 2 && (
            <>
              <div>
                <label className="text-muted text-[10px] uppercase tracking-widest mb-1.5 block">Peso actual (kg)</label>
                <input autoFocus type="number" step="0.1" value={startWeight}
                  onChange={(e) => setStartWeight(e.target.value)}
                  placeholder="Ej. 88.5"
                  className="w-full bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2.5 text-sm outline-none focus:border-cyan" />
                <div className="text-muted text-[10px] mt-1">Se registrará como el peso de inicio del seguimiento.</div>
              </div>
              <div>
                <label className="text-muted text-[10px] uppercase tracking-widest mb-1.5 block">Objetivo a largo plazo</label>
                <textarea value={longTermGoal} onChange={(e) => setLongTermGoal(e.target.value)}
                  placeholder="Ej. Llegar a 78kg con visibilidad abdominal para junio 2027..."
                  rows={3}
                  className="w-full bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2.5 text-sm outline-none resize-none" />
              </div>
            </>
          )}

          {err && <div className="text-red text-xs">{err}</div>}
        </div>

        {/* Footer con navegación */}
        <div className="px-6 pb-5 flex gap-2">
          {step > 0 ? (
            <button onClick={back}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-muted border border-border">
              <ChevronLeft size={15} /> Atrás
            </button>
          ) : (
            <button onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold text-muted border border-border">
              Cancelar
            </button>
          )}
          <div className="flex-1" />
          {step < STEPS.length - 1 ? (
            <button onClick={next}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-bold"
              style={{ background: 'var(--color-violet)', color: '#0D0A1F' }}>
              Siguiente <ChevronRight size={15} />
            </button>
          ) : (
            <button onClick={handleCreate} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold disabled:opacity-60"
              style={{ background: 'var(--color-violet)', color: '#0D0A1F' }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? 'Creando…' : 'Crear cliente'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
