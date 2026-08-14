'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, AuthorBadge, Ring } from '@/components/ui';
import { useProfiles } from '@/components/ProfilesProvider';

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
  const [tasks, setTasks] = useState([]);
  const [anchor, setAnchor] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase.from('tasks').select('*');
    setTasks(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('weekly-review-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = startOfWeek(anchor);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const startISO = toISO(start);
  const endISO = toISO(end);

  // Tareas "de esta semana": vencían en el rango, o se completaron en el rango
  const weekTasks = tasks.filter((t) => {
    const due = t.due_date;
    const completedDate = t.completed_at ? t.completed_at.slice(0, 10) : null;
    return (due && due >= startISO && due <= endISO) || (completedDate && completedDate >= startISO && completedDate <= endISO);
  });

  const completed = weekTasks.filter((t) => t.done);
  const notCompleted = weekTasks.filter((t) => !t.done);
  const pct = weekTasks.length ? completed.length / weekTasks.length : 0;

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

      <Card className="flex items-center justify-around flex-wrap gap-4">
        <Ring pct={pct} label="Cumplimiento" value={`${completed.length}/${weekTasks.length || 0}`} color={pct >= 0.7 ? '#4ADE80' : pct >= 0.4 ? '#FBBF24' : '#F87171'} size={110} />
        <div className="flex gap-6">
          <div className="text-center">
            <div className="text-green text-2xl font-display font-extrabold">{completed.length}</div>
            <div className="text-muted text-xs">Cumplidas</div>
          </div>
          <div className="text-center">
            <div className="text-red text-2xl font-display font-extrabold">{notCompleted.length}</div>
            <div className="text-muted text-xs">Pendientes</div>
          </div>
        </div>
      </Card>

      {loading && <Card className="text-center py-8 text-muted">Cargando…</Card>}

      {!loading && (
        <>
          <div className="space-y-2">
            <div className="text-green text-[11px] uppercase tracking-wide font-semibold flex items-center gap-1.5"><Check size={13} /> Cumplidas</div>
            {completed.length === 0 && <Card className="text-center py-4 text-muted text-sm">Ninguna todavía esta semana.</Card>}
            {completed.map((t) => (
              <Card key={t.id} className="flex items-center gap-3">
                <Check size={16} color="#4ADE80" className="shrink-0" />
                <div className="text-ink text-sm flex-1 truncate">{t.title}</div>
                <AuthorBadge profile={profiles?.[t.assigned_to]} />
              </Card>
            ))}
          </div>

          <div className="space-y-2">
            <div className="text-red text-[11px] uppercase tracking-wide font-semibold flex items-center gap-1.5"><X size={13} /> No cumplidas</div>
            {notCompleted.length === 0 && <Card className="text-center py-4 text-muted text-sm">Ninguna pendiente esta semana. 🎉</Card>}
            {notCompleted.map((t) => (
              <Card key={t.id} className="flex items-center gap-3">
                <X size={16} color="#F87171" className="shrink-0" />
                <div className="text-ink text-sm flex-1 truncate">{t.title}</div>
                <AuthorBadge profile={profiles?.[t.assigned_to]} />
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
