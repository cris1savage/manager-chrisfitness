'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Loader2, Check, X, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui';
import { dateToISO } from '@/lib/config';
import { syncTaskToGoogle } from '@/lib/googleSync';

const START_HOUR = 6;
const END_HOUR = 24; // hasta 23:59
const HOUR_HEIGHT = 52; // px por hora
const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function startOfWeek(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export default function WeeklyScheduleView() {
  const supabase = useMemo(() => createClient(), []);
  const [anchor, setAnchor] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [requestText, setRequestText] = useState('');
  const [thinking, setThinking] = useState(false);
  const [proposal, setProposal] = useState(null); // array de items propuestos, editables
  const [aiError, setAiError] = useState('');
  const [confirming, setConfirming] = useState(false);

  const weekStart = startOfWeek(anchor);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const weekStartISO = dateToISO(weekStart);
  const weekEndISO = dateToISO(weekDays[6]);

  const load = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', userData.user.id)
      .gte('due_date', weekStartISO)
      .lte('due_date', weekEndISO);
    setTasks(data || []);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('weekly-schedule-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartISO]);

  const shiftWeek = (dir) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + dir * 7);
    setAnchor(d);
  };

  const askAI = async () => {
    if (!requestText.trim()) return;
    setThinking(true);
    setAiError('');
    setProposal(null);
    try {
      const res = await fetch('/api/assistant/schedule-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestText, weekStart: weekStartISO, weekEnd: weekEndISO }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error || 'Algo falló.');
      } else {
        const todayISO = dateToISO(new Date());
        const items = data.items || [];
        const valid = items.filter((it) => it.date >= todayISO);
        const dropped = items.length - valid.length;
        setProposal(valid.map((it, i) => ({ ...it, _id: i })));
        if (dropped > 0) {
          setAiError(`Se descartaron ${dropped} elemento(s) que la IA propuso en fechas ya pasadas.`);
        }
      }
    } catch {
      setAiError('No se pudo conectar. Inténtalo de nuevo.');
    }
    setThinking(false);
  };

  const updateProposalItem = (id, key, value) => {
    setProposal((p) => p.map((it) => (it._id === id ? { ...it, [key]: value } : it)));
  };
  const removeProposalItem = (id) => {
    setProposal((p) => p.filter((it) => it._id !== id));
  };

  const confirmProposal = async () => {
    if (!proposal || proposal.length === 0) return;
    setConfirming(true);
    const { data: userData } = await supabase.auth.getUser();
    const rows = proposal.map((it) => ({
      title: it.title,
      due_date: it.date,
      due_time: it.start_time,
      duration_minutes: it.duration_minutes || 30,
      assigned_to: userData.user.id,
      created_by: userData.user.id,
    }));
    const { data: inserted } = await supabase.from('tasks').insert(rows).select();
    (inserted || []).forEach((t) => syncTaskToGoogle(t.id, 'upsert'));
    setProposal(null);
    setRequestText('');
    setConfirming(false);
    load();
  };

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const tasksByDay = (dateISO) => tasks.filter((t) => t.due_date === dateISO);
  const toggleDone = async (t) => {
    await supabase.from('tasks').update({ done: !t.done, completed_at: !t.done ? new Date().toISOString() : null }).eq('id', t.id);
    load();
  };
  const deleteTask = async (id) => {
    setTasks((t) => t.filter((x) => x.id !== id));
    syncTaskToGoogle(id, 'delete');
    await supabase.from('tasks').delete().eq('id', id);
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <div className="flex items-center gap-1.5 text-cyan text-xs font-semibold">
          <Sparkles size={14} /> Organiza mi semana con IA
        </div>
        <textarea
          value={requestText}
          onChange={(e) => setRequestText(e.target.value)}
          placeholder="Ej. grabar 3 reels, llamar a los leads fríos, revisar anuncios, hacer la compra, preparar la sesión con Ana del viernes..."
          rows={2}
          className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full outline-none focus:border-cyan resize-y"
        />
        <button
          onClick={askAI}
          disabled={thinking || !requestText.trim()}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-cyan text-[#00161C] flex items-center gap-1.5 disabled:opacity-50"
        >
          {thinking ? <><Loader2 size={13} className="animate-spin" /> Organizando...</> : 'Organizar esta semana'}
        </button>
        {aiError && <div className="text-red text-xs">{aiError}</div>}

        {proposal && (
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="text-muted text-[11px] uppercase tracking-wide">Propuesta — revisa y ajusta antes de confirmar</div>
            {proposal.length === 0 && <div className="text-muted text-xs">Sin elementos. Vuelve a intentarlo con otra descripción.</div>}
            {proposal.map((it) => (
              <div key={it._id} className="flex items-center gap-2 flex-wrap rounded-lg p-2 bg-surfaceAlt border border-border">
                <input
                  value={it.title}
                  onChange={(e) => updateProposalItem(it._id, 'title', e.target.value)}
                  className="bg-surface border border-border text-ink rounded px-2 py-1 text-xs flex-1 min-w-[140px] outline-none focus:border-cyan"
                />
                <input
                  type="date"
                  value={it.date}
                  onChange={(e) => updateProposalItem(it._id, 'date', e.target.value)}
                  className="bg-surface border border-border text-ink rounded px-1.5 py-1 text-[11px] outline-none focus:border-cyan"
                />
                <input
                  type="time"
                  value={it.start_time}
                  onChange={(e) => updateProposalItem(it._id, 'start_time', e.target.value)}
                  className="bg-surface border border-border text-ink rounded px-1.5 py-1 text-[11px] outline-none focus:border-cyan"
                />
                <input
                  type="number"
                  value={it.duration_minutes}
                  onChange={(e) => updateProposalItem(it._id, 'duration_minutes', Number(e.target.value))}
                  className="bg-surface border border-border text-ink rounded px-1.5 py-1 text-[11px] w-16 outline-none focus:border-cyan"
                  title="Duración en minutos"
                />
                <span className="text-muted text-[10px]">min</span>
                <button onClick={() => removeProposalItem(it._id)} className="text-red shrink-0 ml-auto"><Trash2 size={14} /></button>
              </div>
            ))}
            {proposal.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={confirmProposal}
                  disabled={confirming}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                  style={{ background: '#4ADE8022', color: '#4ADE80', border: '1px solid #4ADE8055' }}
                >
                  <Check size={13} /> {confirming ? 'Añadiendo...' : `Confirmar y añadir (${proposal.length})`}
                </button>
                <button onClick={() => setProposal(null)} className="text-muted text-xs flex items-center gap-1"><X size={13} /> Descartar</button>
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <button onClick={() => shiftWeek(-1)} className="p-2 rounded-lg border border-border text-ink shrink-0"><ChevronLeft size={16} /></button>
        <div className="text-ink font-bold text-sm text-center">
          {weekStart.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} – {weekDays[6].toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
        <button onClick={() => shiftWeek(1)} className="p-2 rounded-lg border border-border text-ink shrink-0"><ChevronRight size={16} /></button>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div style={{ minWidth: 780 }}>
          <div className="grid grid-cols-[50px_repeat(7,1fr)] gap-1 mb-1">
            <div />
            {weekDays.map((d, i) => {
              const iso = dateToISO(d);
              const isToday = iso === dateToISO(new Date());
              return (
                <div key={i} className="text-center">
                  <div className="text-muted text-[10px] uppercase">{DAY_NAMES[i]}</div>
                  <div className="text-sm font-bold" style={{ color: isToday ? '#5ECCFA' : '#F2F6F7' }}>{d.getDate()}</div>
                </div>
              );
            })}
          </div>

          {/* Tareas sin hora */}
          <div className="grid grid-cols-[50px_repeat(7,1fr)] gap-1 mb-2">
            <div className="text-muted text-[9px] flex items-center justify-end pr-1">Sin hora</div>
            {weekDays.map((d, i) => {
              const iso = dateToISO(d);
              const noTime = tasksByDay(iso).filter((t) => !t.due_time);
              return (
                <div key={i} className="space-y-0.5 min-h-[24px]">
                  {noTime.map((t) => (
                    <div key={t.id} className="rounded px-1.5 py-0.5 text-[10px] flex items-center gap-1" style={{ background: t.done ? '#4ADE8022' : '#5ECCFA22', color: t.done ? '#4ADE80' : '#5ECCFA' }}>
                      <button onClick={() => toggleDone(t)} className="shrink-0">{t.done ? <Check size={9} /> : <div className="w-2 h-2 rounded-full border border-current" />}</button>
                      <span className="truncate" style={{ textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="relative grid grid-cols-[50px_repeat(7,1fr)] gap-1 border-t border-border">
            <div>
              {hours.map((h) => (
                <div key={h} className="text-muted text-[9px] text-right pr-1" style={{ height: HOUR_HEIGHT }}>{h}:00</div>
              ))}
            </div>
            {weekDays.map((d, dayIdx) => {
              const iso = dateToISO(d);
              const dayTasks = tasksByDay(iso).filter((t) => t.due_time);
              return (
                <div key={dayIdx} className="relative border-l border-border" style={{ height: hours.length * HOUR_HEIGHT }}>
                  {hours.map((h) => (
                    <div key={h} className="border-b border-border" style={{ height: HOUR_HEIGHT }} />
                  ))}
                  {dayTasks.map((t) => {
                    const mins = timeToMinutes(t.due_time.slice(0, 5)) - START_HOUR * 60;
                    const top = (mins / 60) * HOUR_HEIGHT;
                    const height = Math.max(18, ((t.duration_minutes || 30) / 60) * HOUR_HEIGHT - 2);
                    return (
                      <div
                        key={t.id}
                        className="absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-[9.5px] overflow-hidden group"
                        style={{ top, height, background: t.done ? '#4ADE8033' : '#5ECCFA33', border: `1px solid ${t.done ? '#4ADE80' : '#5ECCFA'}` }}
                      >
                        <div className="flex items-center gap-1">
                          <button onClick={() => toggleDone(t)} className="shrink-0">
                            {t.done ? <Check size={9} color="#4ADE80" /> : <div className="w-2 h-2 rounded-full border border-cyan shrink-0" />}
                          </button>
                          <span className="truncate font-medium" style={{ color: '#F2F6F7', textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</span>
                          <button onClick={() => deleteTask(t.id)} className="ml-auto shrink-0 opacity-0 group-hover:opacity-100"><Trash2 size={9} className="text-red" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
