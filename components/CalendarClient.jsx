'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, X, Check, ChevronLeft, ChevronRight, Trash2, Pencil, Settings } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { todayISO, dateToISO } from '@/lib/config';
import { useCategories } from '@/components/CategoriesProvider';
import CategoriesManager from '@/components/CategoriesManager';
import { syncToGoogle } from '@/lib/googleSync';

function startOfWeek(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
const toISO = (d) => dateToISO(d);
const FALLBACK_META = { label: 'Sin categoría', color: '#7C878B' };

function EntryEditor({ initial, categories, onSave, onCancel }) {
  const firstKey = categories[0]?.id || '';
  const [type, setType] = useState(initial?.type || firstKey);
  const [title, setTitle] = useState(initial?.title || '');
  const [notes, setNotes] = useState(initial?.notes || '');

  const submit = () => {
    if (!title.trim()) return;
    onSave({ type, title: title.trim(), notes });
  };

  return (
    <div className="flex flex-col gap-1.5 mt-1 p-2 rounded-lg bg-surfaceAlt border border-border">
      <select value={type} onChange={(e) => setType(e.target.value)} className="bg-surface border border-border text-ink text-[10.5px] rounded px-1.5 py-1 outline-none focus:border-cyan">
        {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Título..."
        className="bg-surface border border-border text-ink text-[10.5px] rounded px-1.5 py-1 outline-none focus:border-cyan"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas (opcional)"
        rows={2}
        className="bg-surface border border-border text-ink text-[10.5px] rounded px-1.5 py-1 outline-none focus:border-cyan resize-none"
      />
      <div className="flex gap-1">
        <button onClick={submit} className="flex-1 bg-cyan text-[#00161C] text-[10.5px] rounded py-1 font-bold">Guardar</button>
        <button onClick={onCancel} className="px-2 text-muted text-[10.5px]">Cancelar</button>
      </div>
    </div>
  );
}

function DayCell({ dateISO, entries, categoriesMap, categoriesList, onAdd, onUpdate, onToggle, onDelete, compact }) {
  const isToday = dateISO === todayISO();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

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
        <button onClick={() => { setAdding(!adding); setEditingId(null); }} className="text-muted">
          <Plus size={13} />
        </button>
      </div>
      <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: 110 }}>
        {entries.map((e) => {
          const meta = categoriesMap[e.type] || FALLBACK_META;
          const done = e.status === 'hecho';
          if (editingId === e.id) {
            return (
              <EntryEditor
                key={e.id}
                initial={e}
                categories={categoriesList}
                onSave={(patch) => { onUpdate(e.id, patch); setEditingId(null); }}
                onCancel={() => setEditingId(null)}
              />
            );
          }
          return (
            <div key={e.id} className="flex items-center gap-1 rounded px-1.5 py-1 group" style={{ background: `${meta.color}14`, opacity: done ? 0.55 : 1 }}>
              <button onClick={() => onToggle(e)} className="shrink-0">
                {done ? <Check size={11} color={meta.color} /> : <div className="w-2 h-2 rounded-full" style={{ background: meta.color }} />}
              </button>
              <span className="text-[10.5px] truncate flex-1" style={{ color: '#F2F6F7', textDecoration: done ? 'line-through' : 'none' }} title={e.notes || ''}>
                {e.title}
              </span>
              <button onClick={() => { setEditingId(e.id); setAdding(false); }} className="text-muted shrink-0"><Pencil size={9} /></button>
              <button onClick={() => onDelete(e.id)} className="text-muted shrink-0"><X size={10} /></button>
            </div>
          );
        })}
      </div>
      {adding && (
        <EntryEditor
          categories={categoriesList}
          onSave={(patch) => { onAdd({ date: dateISO, status: 'pendiente', ...patch }); setAdding(false); }}
          onCancel={() => setAdding(false)}
        />
      )}
    </div>
  );
}

function DayView({ dateISO, entries, categoriesMap, categoriesList, onAdd, onUpdate, onToggle, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const isToday = dateISO === todayISO();

  const label = new Date(dateISO + 'T00:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className="space-y-3">
      <div className="rounded-xl p-3" style={{ background: isToday ? '#5ECCFA0D' : '#0E1214', border: `1px solid ${isToday ? '#5ECCFA' : '#212729'}` }}>
        <div className="capitalize font-bold" style={{ color: isToday ? '#5ECCFA' : '#F2F6F7' }}>
          {label} {isToday && <span className="text-xs font-normal">· hoy</span>}
        </div>
      </div>

      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="rounded-xl p-3 bg-surfaceAlt border border-border w-full flex items-center justify-center gap-2 text-cyan font-semibold text-sm"
        >
          <Plus size={16} /> Añadir a este día
        </button>
      )}
      {adding && (
        <div className="rounded-xl p-3 bg-surfaceAlt border border-border">
          <EntryEditor
            categories={categoriesList}
            onSave={(patch) => { onAdd({ date: dateISO, status: 'pendiente', ...patch }); setAdding(false); }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      <div className="space-y-2">
        {entries.length === 0 && !adding && (
          <div className="rounded-xl p-6 bg-surface border border-border text-center text-muted text-sm">Nada programado este día todavía.</div>
        )}
        {entries.map((e) => {
          const meta = categoriesMap[e.type] || FALLBACK_META;
          const done = e.status === 'hecho';
          if (editingId === e.id) {
            return (
              <div key={e.id} className="rounded-xl p-3 bg-surface border border-border">
                <EntryEditor initial={e} categories={categoriesList} onSave={(patch) => { onUpdate(e.id, patch); setEditingId(null); }} onCancel={() => setEditingId(null)} />
              </div>
            );
          }
          return (
            <div key={e.id} className="rounded-xl p-3 bg-surface border border-border flex items-start gap-3" style={{ opacity: done ? 0.55 : 1 }}>
              <button onClick={() => onToggle(e)} className="shrink-0 mt-0.5">
                {done ? <Check size={18} color={meta.color} /> : <div className="w-3.5 h-3.5 rounded-full" style={{ background: meta.color }} />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wide" style={{ color: meta.color }}>{meta.label}</div>
                <div className="text-ink text-sm font-medium" style={{ textDecoration: done ? 'line-through' : 'none' }}>{e.title}</div>
                {e.notes && <div className="text-muted text-xs mt-1 whitespace-pre-wrap">{e.notes}</div>}
              </div>
              <button onClick={() => setEditingId(e.id)} className="text-muted shrink-0"><Pencil size={15} /></button>
              <button onClick={() => onDelete(e.id)} className="text-red shrink-0"><Trash2 size={16} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarClient() {
  const supabase = useMemo(() => createClient(), []);
  const { list: categoriesList, map: categoriesMap } = useCategories();
  const [entries, setEntries] = useState([]);
  const [mode, setMode] = useState('mes');
  const [anchor, setAnchor] = useState(new Date());
  const [showCategories, setShowCategories] = useState(false);

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
    const { data } = await supabase.from('calendar_entries').insert({ ...entry, created_by: userData.user.id }).select().single();
    load();
    if (data) syncToGoogle(data.id, 'upsert');
  };
  const update = async (id, patch) => {
    await supabase.from('calendar_entries').update(patch).eq('id', id);
    load();
    syncToGoogle(id, 'upsert');
  };
  const toggle = async (entry) => {
    const nextStatus = entry.status === 'hecho' ? 'pendiente' : 'hecho';
    await supabase.from('calendar_entries').update({ status: nextStatus }).eq('id', entry.id);
    load();
    syncToGoogle(entry.id, 'upsert');
  };
  const del = async (id) => {
    await syncToGoogle(id, 'delete');
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
    grid = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
    titleLabel = `${start.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} – ${grid[6].toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}`;
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
        <button onClick={() => shift(-1)} className="p-2 rounded-lg border border-border text-ink shrink-0"><ChevronLeft size={16} /></button>
        <div className="text-ink font-bold capitalize text-sm sm:text-base text-center px-2">{titleLabel}</div>
        <button onClick={() => shift(1)} className="p-2 rounded-lg border border-border text-ink shrink-0"><ChevronRight size={16} /></button>
      </div>

      {mode === 'dia' ? (
        <DayView
          dateISO={toISO(anchor)}
          entries={byDate[toISO(anchor)] || []}
          categoriesMap={categoriesMap}
          categoriesList={categoriesList}
          onAdd={add} onUpdate={update} onToggle={toggle} onDelete={del}
        />
      ) : (
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="grid grid-cols-7 gap-1.5" style={{ minWidth: 630 }}>
            {weekDays.map((d) => <div key={d} className="text-center text-muted text-[11px] font-bold">{d}</div>)}
            {grid.map((d, i) =>
              d ? (
                <DayCell
                  key={i} dateISO={toISO(d)} entries={byDate[toISO(d)] || []}
                  categoriesMap={categoriesMap} categoriesList={categoriesList}
                  onAdd={add} onUpdate={update} onToggle={toggle} onDelete={del} compact={mode === 'mes'}
                />
              ) : <div key={i} />
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
        <div className="flex gap-3 flex-wrap">
          {categoriesList.map((c) => (
            <div key={c.id} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: c.color }} />
              <span className="text-muted text-xs">{c.label}</span>
            </div>
          ))}
        </div>
        <button onClick={() => setShowCategories(!showCategories)} className="text-muted text-xs flex items-center gap-1.5">
          <Settings size={13} /> Editar categorías
        </button>
      </div>

      {showCategories && <CategoriesManager onClose={() => setShowCategories(false)} />}
    </div>
  );
}
