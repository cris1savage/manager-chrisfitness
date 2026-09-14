'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Calendar } from 'lucide-react';
import { monthLabelFull, STRENGTH_COLOR, GOAL_COLORS } from '@/lib/timeline';

export default function HistorialClient({ clienteId, checkins }) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const past         = checkins.filter((c) => c.month < currentMonth);
  const [expanded, setExpanded] = useState(null);

  if (past.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Calendar size={32} className="text-muted mb-3 opacity-40" />
        <div className="text-muted text-sm">Sin meses anteriores todavía.</div>
        <div className="text-muted text-xs mt-1">Aquí irá apareciendo el historial mes a mes.</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {past.map((c) => {
        const isOpen    = expanded === c.id;
        const strongWeeks = (c.weekly_notes || []).filter((w) => w.strength === 'Fuerte').length;
        const totalWeeks  = (c.weekly_notes || []).filter((w) => w.strength).length;
        const pct         = totalWeeks ? Math.round((strongWeeks / totalWeeks) * 100) : null;

        return (
          <div key={c.id} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            {/* Cabecera del mes */}
            <button
              onClick={() => setExpanded(isOpen ? null : c.id)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors"
              style={{ background: 'var(--color-surfaceAlt)' }}
            >
              <Calendar size={15} className="text-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-ink text-sm font-semibold">{monthLabelFull(c.month)}</div>
                <div className="text-muted text-xs mt-0.5">{c.phase || 'Sin fase'}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {c.weight != null && (
                  <span className="text-cyan text-sm font-bold">{c.weight} kg</span>
                )}
                {c.goal_status && GOAL_COLORS[c.goal_status] && (
                  <span className="text-xs font-bold" style={{ color: GOAL_COLORS[c.goal_status] }}>
                    {c.goal_status}
                  </span>
                )}
                {pct != null && (
                  <span className="text-muted text-xs">{pct}% semanas fuertes</span>
                )}
                {isOpen ? <ChevronDown size={15} className="text-muted" /> : <ChevronRight size={15} className="text-muted" />}
              </div>
            </button>

            {/* Detalle expandido */}
            {isOpen && (
              <div className="px-4 pb-5 pt-3 space-y-3" style={{ background: 'var(--color-bg)' }}>

                {/* Semanas */}
                {c.weekly_notes?.length > 0 && (
                  <div className="space-y-2">
                    {c.weekly_notes.map((w, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: STRENGTH_COLOR[w.strength] || 'var(--color-border)' }} />
                        <span className="text-ink text-xs font-semibold">{w.label}</span>
                        {w.strength && (
                          <span className="text-xs font-bold" style={{ color: STRENGTH_COLOR[w.strength] }}>
                            {w.strength}
                          </span>
                        )}
                        {w.note && <span className="text-muted text-xs truncate">— {w.note}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Datos */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  {c.goals && (
                    <div className="col-span-2">
                      <span className="text-muted">Objetivo: </span>
                      <span className="text-ink">{c.goals}</span>
                    </div>
                  )}
                  {c.training_notes && (
                    <div>
                      <div className="text-muted mb-0.5">Entrenamiento</div>
                      <div className="text-ink">{c.training_notes}</div>
                    </div>
                  )}
                  {c.nutrition_notes && (
                    <div>
                      <div className="text-muted mb-0.5">Nutrición</div>
                      <div className="text-ink">{c.nutrition_notes}</div>
                    </div>
                  )}
                  {c.steps_avg != null && (
                    <div><span className="text-muted">Pasos/día: </span><span className="text-green">{c.steps_avg.toLocaleString()}</span></div>
                  )}
                  {c.call_date && (
                    <div>
                      <span className="text-muted">Videollamada: </span>
                      <span className="text-ink">{c.call_date}</span>
                      <span className="ml-1" style={{ color: c.call_done ? 'var(--color-green)' : 'var(--color-muted)' }}>
                        {c.call_done ? '· Realizada' : '· Pendiente'}
                      </span>
                    </div>
                  )}
                  {c.notes && (
                    <div className="col-span-2">
                      <span className="text-muted">Notas: </span>
                      <span className="text-ink">{c.notes}</span>
                    </div>
                  )}
                </div>

                {/* Mediciones si las hay */}
                {c.measurements && Object.values(c.measurements).some((v) => v != null) && (
                  <div>
                    <div className="text-muted text-[10px] uppercase tracking-widest mb-2">Mediciones</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {Object.entries(c.measurements).filter(([, v]) => v != null).map(([k, v]) => (
                        <div key={k} className="text-xs">
                          <span className="text-muted">{k}: </span>
                          <span className="text-ink font-semibold">{v} cm</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
