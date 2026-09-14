'use client';

import { useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Card from '@/components/Card';
import { PHASE_NAMES, phaseColor, todayISO, addDaysISO } from '@/lib/timeline';

function weeksBetween(start, end) {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  return Math.max(0, Math.round((e - s) / (7 * 86400000)));
}

export default function FasesClient({ clienteId, initialPhases, initialGoal }) {
  const supabase = createClient();
  const [phases,       setPhases]       = useState(initialPhases);
  const [longTermGoal, setLongTermGoal] = useState(initialGoal);
  const [saved,        setSaved]        = useState(false);

  const today = todayISO();
  const currentPhaseName = phases.find((p) => today >= p.start_date && today <= p.end_date)?.name;

  const save = async (next) => {
    setPhases(next);
    await supabase.from('tracking_clients').update({ phases: next }).eq('id', clienteId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const saveGoal = async (v) => {
    setLongTermGoal(v);
    await supabase.from('tracking_clients').update({ long_term_goal: v }).eq('id', clienteId);
  };

  const addPhase = () => {
    const last  = phases[phases.length - 1];
    const start = last ? addDaysISO(last.end_date, 1) : today;
    const end   = addDaysISO(start, 90);
    save([...phases, { name: 'Definición', start_date: start, end_date: end, rate: -0.5, goal: '' }]);
  };

  const update = (i, patch) => save(phases.map((p, idx) => idx === i ? { ...p, ...patch } : p));
  const remove = (i)         => { if (window.confirm('¿Eliminar esta fase?')) save(phases.filter((_, idx) => idx !== i)); };

  return (
    <div className="space-y-5">

      {/* Objetivo largo plazo */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-0.5 h-5 rounded-full" style={{ background: 'var(--color-cyan)' }} />
          <span className="text-cyan text-[11px] font-bold uppercase tracking-widest">Objetivo a largo plazo</span>
        </div>
        <textarea
          value={longTermGoal}
          onChange={(e) => setLongTermGoal(e.target.value)}
          onBlur={(e) => saveGoal(e.target.value)}
          placeholder="Ej. Llegar a 78kg con visibilidad abdominal para junio de 2027..."
          rows={3}
          className="bg-transparent text-ink text-sm w-full outline-none resize-none leading-relaxed border-none"
        />
      </Card>

      {/* Línea de tiempo visual */}
      {phases.length > 0 && (
        <div className="space-y-1">
          <div className="text-muted text-[10px] uppercase tracking-widest mb-3">Periodización</div>
          <div className="flex gap-1 h-8 rounded-xl overflow-hidden">
            {phases.map((p, i) => {
              const weeks = weeksBetween(p.start_date, p.end_date);
              const color = phaseColor(phases, p.name);
              const isCurrent = p.name === currentPhaseName && today >= p.start_date && today <= p.end_date;
              return (
                <div key={i} className="relative flex items-center justify-center text-[9px] font-bold truncate px-1"
                  style={{
                    flex: Math.max(weeks, 1),
                    background: isCurrent ? color : `${color}40`,
                    color: isCurrent ? '#050708' : color,
                    outline: isCurrent ? `2px solid ${color}` : 'none',
                  }}
                  title={`${p.name}: ${p.start_date} → ${p.end_date} (${weeks} sem.)`}>
                  {weeks > 3 ? p.name : ''}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-muted text-[9px] px-0.5">
            <span>{phases[0]?.start_date}</span>
            <span>{phases[phases.length - 1]?.end_date}</span>
          </div>
        </div>
      )}

      {/* Editor de fases */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-muted text-[10px] uppercase tracking-widest">Fases ({phases.length})</div>
          {saved && (
            <span className="text-green text-xs flex items-center gap-1"><Check size={11} /> Guardado</span>
          )}
        </div>

        {phases.map((p, i) => {
          const color    = phaseColor(phases, p.name);
          const isCurrent = today >= p.start_date && today <= p.end_date;
          const weeks    = weeksBetween(p.start_date, p.end_date);
          const startW   = p.start_weight || null;
          const projectedLoss = startW && weeks && p.rate
            ? Math.round(startW * Math.pow(1 + p.rate / 100, weeks) * 10) / 10
            : null;

          return (
            <div key={i} className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${isCurrent ? color : 'var(--color-border)'}` }}>

              {/* Cabecera de fase */}
              <div className="px-4 py-3 flex items-center gap-3"
                style={{ background: isCurrent ? `${color}15` : 'var(--color-surfaceAlt)' }}>
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                <select value={p.name} onChange={(e) => update(i, { name: e.target.value })}
                  className="bg-transparent border-none text-base font-bold outline-none flex-1"
                  style={{ color }}>
                  {PHASE_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                {isCurrent && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${color}25`, color }}>EN CURSO</span>
                )}
                <button onClick={() => remove(i)} className="text-red opacity-50 hover:opacity-100 ml-auto">
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Cuerpo */}
              <div className="px-4 py-4 space-y-4" style={{ background: 'var(--color-bg)' }}>
                {/* Fechas + duración */}
                <div className="flex items-center gap-2 flex-wrap">
                  <input type="date" value={p.start_date} onChange={(e) => update(i, { start_date: e.target.value })}
                    className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-cyan" />
                  <span className="text-muted text-xs">→</span>
                  <input type="date" value={p.end_date} onChange={(e) => update(i, { end_date: e.target.value })}
                    className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-cyan" />
                  <span className="text-muted text-xs ml-1">{weeks} semanas</span>
                </div>

                {/* Ritmo + peso inicio + proyección */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg p-2.5" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
                    <div className="text-muted text-[10px] mb-1">Ritmo</div>
                    <div className="flex items-baseline gap-1">
                      <input type="number" step="0.05" value={p.rate}
                        onChange={(e) => update(i, { rate: Number(e.target.value) })}
                        className="bg-transparent text-ink text-base font-bold outline-none w-16 border-none" />
                      <span className="text-muted text-[10px]">%/sem</span>
                    </div>
                  </div>
                  <div className="rounded-lg p-2.5" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
                    <div className="text-muted text-[10px] mb-1">Peso inicio</div>
                    <div className="flex items-baseline gap-1">
                      <input type="number" step="0.1" value={p.start_weight ?? ''}
                        onChange={(e) => update(i, { start_weight: e.target.value ? Number(e.target.value) : null })}
                        placeholder="—"
                        className="bg-transparent text-ink text-base font-bold outline-none w-16 border-none" />
                      <span className="text-muted text-[10px]">kg</span>
                    </div>
                  </div>
                  <div className="rounded-lg p-2.5" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
                    <div className="text-muted text-[10px] mb-1">Proyección</div>
                    <div className="text-base font-bold" style={{ color: projectedLoss != null ? color : 'var(--color-muted)' }}>
                      {projectedLoss != null ? `${projectedLoss} kg` : '—'}
                    </div>
                  </div>
                </div>

                {/* Objetivo de la fase */}
                <div>
                  <div className="text-muted text-[10px] uppercase tracking-widest mb-1.5">Objetivo de la fase</div>
                  <input value={p.goal || ''} onChange={(e) => update(i, { goal: e.target.value })}
                    placeholder="Ej. Bajar a 80kg manteniendo fuerza en press banca por encima de 90kg..."
                    className="w-full bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan" />
                </div>
              </div>
            </div>
          );
        })}

        <button onClick={addPhase}
          className="w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          style={{ border: '2px dashed var(--color-border)', color: 'var(--color-muted)' }}>
          <Plus size={15} /> Añadir fase
        </button>
      </div>
    </div>
  );
}
