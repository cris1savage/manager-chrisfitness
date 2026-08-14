'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, X, ChevronLeft, ChevronRight, ListChecks, Film } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, AuthorBadge, Ring } from '@/components/ui';
import { useProfiles } from '@/components/ProfilesProvider';
import { CONTENT_TYPES } from '@/lib/config';

function startOfWeek(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
const toISO = (d) => d.toISOString().slice(0, 10);

export default function WeeklyReviewClient() {
  const supabase = useMemo(() => createClient(), []);
  const profiles = useProfiles();
  const [tab, setTab] = useState('tareas');
  const [tasks, setTasks] = useState([]);
  const [entries, setEntries] = useState([]);
  const [anchor, setAnchor] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [t, e] = await Promise.all([
      supabase.from('tasks').select('*'),
      supabase.from('calendar_entries').select('*'),
    ]);
    setTasks(t.data || []);
    setEntries(e.data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('weekly-review-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleEntry = async (entry) => {
    const nextStatus = entry.status === 'hecho' ? 'pendiente' : 'hecho';
    setEntries((list) => list.map((x) => (x.id === entry.id ? { ...x, status: nextStatus } : x)));
    await supabase.from('calendar_entries').update({ status: nextStatus }).eq('id', entry.id);
  };

  const start = startOfWeek(anchor);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const startISO = toISO(start);
  const endISO = toISO(end);

  const weekTasks = tasks.filter((t) => {
    const due = t.due_date;
    const completedDate = t.completed_at ? t.completed_at.slice(0, 10) : null;
    return (due && due >= startISO && due <= endISO) || (completedDate && completedDate >= startISO && completedDate <= endISO);
  });
  const completedTasks = weekTasks.filter((t) => t.done);
  const notCompletedTasks = weekTasks.filter((t) => !t.done);
  const taskPct = weekTasks.length ? completedTasks.length / weekTasks.length : 0;

  const weekEntries = entries.filter((e) => e.date >= startISO && e.date <= endISO);
  const uploadedEntries = weekEntries.filter((e) => e.status === 'hecho');
  const pendingEntries = weekEntries.filter((e) => e.status !== 'hecho');
  const contentPct = weekEntries.length ? uploadedEntries.length / weekEntries.length : 0;

  const shift = (dir) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + dir * 7);
    setAnchor(d);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-ink text-[22px] tracking-wide">RESUMEN SEMANAL</h2>
        <div className="text-muted text-xs">Qué se cumplió y qué no, semana a semana.</div>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => shift(-1)} className="p-2 rounded-lg border border-border text-ink"><ChevronLeft size={16} /></button>
        <div className="text-ink font-bold text-sm text-center">
          {start.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} – {end.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
        <button onClick={() => shift(1)} className="p-2 rounded-lg border border-border text-ink"><ChevronRight size={16} /></button>
      </div>

      <div className="flex rounded-lg overflow-hidden border border-border w-fit">
        {[{ k: 'tareas', l: 'Tareas', Icon: ListChecks }, { k: 'contenido', l: 'Contenido', Icon: Film }].map(({ k, l, Icon }) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className="px-3 py-1.5 text-xs font-semibold uppercase flex items-center gap-1.5"
            style={{ background: tab === k ? '#5ECCFA' : 'transparent', color: tab === k ? '#00161C' : '#7C878B' }}
          >
            <Icon size={13} /> {l}
          </button>
        ))}
      </div>

      {loading && <Card className="text-center py-8 text-muted">Cargando…</Card>}

      {!loading && tab === 'tareas' && (
        <>
          <Card className="flex items-center justify-around flex-wrap gap-4">
            <Ring pct={taskPct} label="Cumplimiento" value={`${completedTasks.length}/${weekTasks.length || 0}`} color={taskPct >= 0.7 ? '#4ADE80' : taskPct >= 0.4 ? '#FBBF24' : '#F87171'} size={110} />
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-green text-2xl font-display font-extrabold">{completedTasks.length}</div>
                <div className="text-muted text-xs">Cumplidas</div>
              </div>
              <div className="text-center">
                <div className="text-red text-2xl font-display font-extrabold">{notCompletedTasks.length}</div>
                <div className="text-muted text-xs">Pendientes</div>
              </div>
            </div>
          </Card>

          <div className="space-y-2">
            <div className="text-green text-[11px] uppercase tracking-wide font-semibold flex items-center gap-1.5"><Check size={13} /> Cumplidas</div>
            {completedTasks.length === 0 && <Card className="text-center py-4 text-muted text-sm">Ninguna todavía esta semana.</Card>}
            {completedTasks.map((t) => (
              <Card key={t.id} className="flex items-center gap-3">
                <Check size={16} color="#4ADE80" className="shrink-0" />
                <div className="text-ink text-sm flex-1 truncate">{t.title}</div>
                <AuthorBadge profile={profiles?.[t.assigned_to]} />
              </Card>
            ))}
          </div>

          <div className="space-y-2">
            <div className="text-red text-[11px] uppercase tracking-wide font-semibold flex items-center gap-1.5"><X size={13} /> No cumplidas</div>
            {notCompletedTasks.length === 0 && <Card className="text-center py-4 text-muted text-sm">Ninguna pendiente esta semana. 🎉</Card>}
            {notCompletedTasks.map((t) => (
              <Card key={t.id} className="flex items-center gap-3">
                <X size={16} color="#F87171" className="shrink-0" />
                <div className="text-ink text-sm flex-1 truncate">{t.title}</div>
                <AuthorBadge profile={profiles?.[t.assigned_to]} />
              </Card>
            ))}
          </div>
        </>
      )}

      {!loading && tab === 'contenido' && (
        <>
          <Card className="flex items-center justify-around flex-wrap gap-4">
            <Ring pct={contentPct} label="Subido" value={`${uploadedEntries.length}/${weekEntries.length || 0}`} color={contentPct >= 0.7 ? '#4ADE80' : contentPct >= 0.4 ? '#FBBF24' : '#F87171'} size={110} />
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-green text-2xl font-display font-extrabold">{uploadedEntries.length}</div>
                <div className="text-muted text-xs">Subido</div>
              </div>
              <div className="text-center">
                <div className="text-red text-2xl font-display font-extrabold">{pendingEntries.length}</div>
                <div className="text-muted text-xs">Pendiente</div>
              </div>
            </div>
          </Card>

          <div className="space-y-2">
            <div className="text-green text-[11px] uppercase tracking-wide font-semibold flex items-center gap-1.5"><Check size={13} /> Subido esta semana</div>
            {uploadedEntries.length === 0 && <Card className="text-center py-4 text-muted text-sm">Nada subido todavía esta semana.</Card>}
            {uploadedEntries.map((e) => {
              const meta = CONTENT_TYPES[e.type] || CONTENT_TYPES.reel_ig;
              return (
                <Card key={e.id} className="flex items-center gap-3 cursor-pointer" onClick={() => toggleEntry(e)}>
                  <Check size={16} color="#4ADE80" className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-wide" style={{ color: meta.color }}>{meta.label} · {new Date(e.date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</div>
                    <div className="text-ink text-sm truncate">{e.title}</div>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="space-y-2">
            <div className="text-red text-[11px] uppercase tracking-wide font-semibold flex items-center gap-1.5"><X size={13} /> Pendiente de subir</div>
            {pendingEntries.length === 0 && <Card className="text-center py-4 text-muted text-sm">Todo subido esta semana. 🎉</Card>}
            {pendingEntries.map((e) => {
              const meta = CONTENT_TYPES[e.type] || CONTENT_TYPES.reel_ig;
              return (
                <Card key={e.id} className="flex items-center gap-3 cursor-pointer" onClick={() => toggleEntry(e)}>
                  <X size={16} color="#F87171" className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-wide" style={{ color: meta.color }}>{meta.label} · {new Date(e.date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</div>
                    <div className="text-ink text-sm truncate">{e.title}</div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
