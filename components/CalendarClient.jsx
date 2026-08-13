'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, X, Check, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { todayISO } from '@/lib/config';

const CONTENT_TYPES = {
  video: { label: 'Video', color: '#5ECCFA' },
  reel: { label: 'Reel', color: '#4ADE80' },
  historia: { label: 'Historia', color: '#FBBF24' },
};

function startOfWeek(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
const toISO = (d) => d.toISOString().slice(0, 10);

function DayCell({ dateISO, entries, onAdd, onToggle, onDelete, compact }) {
  const isToday = dateISO === todayISO();
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState('reel');
  const [title, setTitle] = useState('');

  const submit = () => {
    if (!title.trim()) return;
    onAdd({ date: dateISO, type, title: title.trim(), status: 'pendiente' });
    setTitle('');
    setAdding(false);
  };

  return (
    <div
      className="rounded-lg p-2 flex flex-col gap-1 border"
      style={{
        background: isToday ? '#5ECCFA0D' : '#0E1214',
        borderColor: isToday ? '#5ECCFA' : '#212729',
        minHeight: compact ? 90 : 120,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold" style={{ color: isToday ? '#5ECCFA' : '#7C878B' }}>
          {new Date(dateISO + 'T00:00:00').getDate()}
        </span>
        <button onClick={() => setAdding(!adding)} className="text-muted">
          <Plus size={13} />
        </button>
      </div>
      <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: 90 }}>
        {entries.map((e) => {
          const meta = CONTENT_TYPES[e.type] || CONTENT_TYPES.reel;
          const done = e.status === 'hecho';
          return (
            <div key={e.id} className="flex items-center gap-1 rounded px-1.5 py-1" style={{ background: `${meta.color}14`, opacity: done ? 0.55 : 1 }}>
              <button onClick={() => onToggle(e)} className="shrink-0">
                {done ? <Check size={11} color={meta.color} /> : <div className="w-2 h-2 rounded-full" style={{ background: meta.color }} />}
              </button>
              <span className="text-[10.5px] truncate flex-1" style={{ color: '#F2F6F7', textDecoration: done ? 'line-through' : 'none' }}>
                {e.title}
              </span>
              <button onClick={() => onDelete(e.id)} className="text-muted shrink-0">
                <X size={10} />
              </button>
            </div>
          );
        })}
      </div>
      {adding && (
        <div className="flex flex-col gap-1 mt-1">
          <select value={type} onChange={(e) => setType(e.target.value)} className="bg-surfaceAlt border border-border text-ink text-[10.5px] rounded px-1 py-0.5">
            {Object.entries(CONTENT_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Título..."
            className="bg-surfaceAlt border border-border text-ink text-[10.5px] rounded px-1 py-1"
          />
          <button onClick={submit} className="bg-cyan text-[#00161C] text-[10.5px] rounded py-0.5 font-bold">
            Guardar
          </button>
        </div>
      )}
    </div>
  );
}

function DayView({ dateISO, entries, onAdd, onToggle, onDelete }) {
  const [type, setType] = useState('reel');
  const [title, setTitle] = useState('');
  const isToday = dateISO === todayISO();

  const submit = () => {
    if (!title.trim()) return;
    onAdd({ date: dateISO, type, title: title.trim(), status: 'pendiente' });
    setTitle('');
  };

  const label = new Date(dateISO + 'T00:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className="space-y-3">
      <div
        className="rounded-xl p-3"
        style={{ background: isToday ? '#5ECCFA0D' : '#0E1214', border: `1px solid ${isToday ? '#5ECCFA' : '#212729'}` }}
      >
        <div className="capitalize font-bold" style={{ color: isToday ? '#5ECCFA' : '#F2F6F7' }}>
          {label} {isToday && <span className="text-xs font-normal">· hoy</span>}
        </div>
      </div>

      <div className="rounded-xl p-3 bg-surfaceAlt border border-border flex flex-col sm:flex-row gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="bg-surface border border-border text-ink text-sm rounded-lg px-2.5 py-2 outline-none focus:border-cyan"
        >
          {Object.entries(CONTENT_TYPES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Ej. Reel: 3 errores en el déficit calórico"
          className="bg-surface border border-border text-ink text-sm rounded-lg px-2.5 py-2 flex-1 outline-none focus:border-cyan"
        />
        <button onClick={submit} className="rounded-lg px-4 py-2 font-semibold text-sm bg-cyan text-[#00161C] flex items-center justify-center gap-1 shrink-0">
          <Plus size={16} /> Añadir
        </button>
      </div>

      <div className="space-y-2">
        {entries.length === 0 && (
          <div className="rounded-xl p-6 bg-surface border border-border text-center text-muted text-sm">
            Nada programado este día todavía.
          </div>
        )}
        {entries.map((e) => {
          const meta = CONTENT_TYPES[e.type] || CONTENT_TYPES.reel;
          const done = e.status === 'hecho';
          return (
            <div
              key={e.id}
              className="rounded-xl p-3 bg-surface border border-border flex items-center gap-3"
              style={{ opacity: done ? 0.55 : 1 }}
            >
              <button onClick={() => onToggle(e)} className="shrink-0">
                {done ? <Check size={18} color={meta.color} /> : <div className="w-3.5 h-3.5 rounded-full" style={{ background: meta.color }} />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wide" style={{ color: meta.color }}>{meta.label}</div>
                <div className="text-ink text-sm font-medium truncate" style={{ textDecoration: done ? 'line-through' : 'none' }}>
                  {e.title}
                </div>
              </div>
              <button onClick={() => onDelete(e.id)} className="text-red shrink-0">
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarClient() {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState([]);
  const [mode, setMode] = useState('mes');
  const [anchor, setAnchor] = useState(new Date());

  const load = async () => {
    const { data } = await supabase.from('calendar_entries').select('*');
    setEntries(data || []);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('calendar-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_entries' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byDate = useMemo(() => {
    const m = {};
    entries.forEach((e) => (m[e.date] = m[e.date] || []).push(e));
    return m;
  }, [entries]);

  const add = async (entry) => {
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('calendar_entries').insert({ ...entry, created_by: userData.user.id });
    load();
  };
  const toggle = async (entry) => {
    const nextStatus = entry.status === 'hecho' ? 'pendiente' : 'hecho';
    await supabase.from('calendar_entries').update({ status: nextStatus }).eq('id', entry.id);
    load();
  };
  const del = async (id) => {
    await supabase.from('calendar_entries').delete().eq('id', id);
    load();
  };

  const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  let grid = [];
  let titleLabel = '';
  if (mode === 'dia') {
    titleLabel = anchor.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  } else if (mode === 'semana') {
    const start = startOfWeek(anchor);
    grid = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
    titleLabel = `${start.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} – ${grid[6].toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })}`;
  } else {
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    const first = new Date(y, m, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
    while (cells.length % 7 !== 0) cells.push(null);
    grid = cells;
    titleLabel = anchor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  }

  const shift = (dir) => {
    const d = new Date(anchor);
    if (mode === 'dia') d.setDate(d.getDate() + dir);
    else if (mode === 'semana') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setAnchor(d);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-display text-ink text-[20px] sm:text-[22px] tracking-wide">CALENDARIO</h2>
        <div className="flex rounded-lg overflow-hidden border border-border shrink-0">
          {['dia', 'semana', 'mes'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold uppercase"
              style={{ background: mode === m ? '#5ECCFA' : 'transparent', color: mode === m ? '#00161C' : '#7C878B' }}
            >
              {m === 'dia' ? 'Día' : m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => shift(-1)} className="p-2 rounded-lg border border-border text-ink shrink-0">
          <ChevronLeft size={16} />
        </button>
        <div className="text-ink font-bold capitalize text-sm sm:text-base text-center px-2">{titleLabel}</div>
        <button onClick={() => shift(1)} className="p-2 rounded-lg border border-border text-ink shrink-0">
          <ChevronRight size={16} />
        </button>
      </div>

      {mode === 'dia' ? (
        <DayView
          dateISO={toISO(anchor)}
          entries={byDate[toISO(anchor)] || []}
          onAdd={add}
          onToggle={toggle}
          onDelete={del}
        />
      ) : (
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="grid grid-cols-7 gap-1.5" style={{ minWidth: 630 }}>
            {weekDays.map((d) => (
              <div key={d} className="text-center text-muted text-[11px] font-bold">
                {d}
              </div>
            ))}
            {grid.map((d, i) =>
              d ? (
                <DayCell key={i} dateISO={toISO(d)} entries={byDate[toISO(d)] || []} onAdd={add} onToggle={toggle} onDelete={del} compact={mode === 'mes'} />
              ) : (
                <div key={i} />
              )
            )}
          </div>
        </div>
      )}

      <div className="flex gap-4 flex-wrap pt-1">
        {Object.entries(CONTENT_TYPES).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: v.color }} />
            <span className="text-muted text-xs">{v.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
