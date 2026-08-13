'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, AuthorBadge } from '@/components/ui';
import { useProfiles } from '@/components/ProfilesProvider';
import { todayISO } from '@/lib/config';

export default function TasksClient() {
  const supabase = useMemo(() => createClient(), []);
  const profiles = useProfiles();
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState(todayISO());

  const profileList = Object.values(profiles || {});

  const load = async () => {
    const { data } = await supabase.from('tasks').select('*').order('due_date', { ascending: true });
    setTasks(data || []);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = async () => {
    if (!title.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('tasks').insert({
      title: title.trim(),
      assigned_to: assignedTo || userData.user.id,
      due_date: dueDate,
      created_by: userData.user.id,
    });
    setTitle('');
    load();
  };

  const toggle = async (t) => {
    await supabase.from('tasks').update({ done: !t.done }).eq('id', t.id);
    load();
  };

  const del = async (id) => {
    await supabase.from('tasks').delete().eq('id', id);
    load();
  };

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-ink text-[22px] tracking-wide">TAREAS ASIGNADAS</h2>
        <div className="text-muted text-xs">Reparte el trabajo de la semana entre las dos cuentas.</div>
      </div>

      <Card className="space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Ej. Contactar a 3 leads fríos"
          className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full outline-none focus:border-cyan"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm outline-none focus:border-cyan"
          >
            <option value="">Asignar a…</option>
            {profileList.map((p) => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm outline-none focus:border-cyan"
          />
        </div>
        <button onClick={add} className="rounded-lg px-3 py-2 flex items-center gap-1 font-semibold text-sm bg-cyan text-[#00161C]">
          <Plus size={16} /> Añadir tarea
        </button>
      </Card>

      <div className="space-y-2">
        <div className="text-muted text-[11px] uppercase tracking-wide">Pendientes ({pending.length})</div>
        {pending.length === 0 && <Card className="text-center py-6 text-muted text-sm">Sin tareas pendientes.</Card>}
        {pending.map((t) => {
          const overdue = t.due_date && t.due_date < todayISO();
          return (
            <Card key={t.id} className="flex items-center gap-3">
              <button onClick={() => toggle(t)} className="shrink-0">
                <div className="w-4 h-4 rounded border border-border" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-ink text-sm font-medium truncate">{t.title}</div>
                <div className={`text-xs ${overdue ? 'text-red' : 'text-muted'}`}>
                  {t.due_date ? new Date(t.due_date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : 'Sin fecha'}
                  {overdue ? ' · atrasada' : ''}
                </div>
              </div>
              <AuthorBadge profile={profiles?.[t.assigned_to]} />
              <button onClick={() => del(t.id)} className="text-red shrink-0"><Trash2 size={15} /></button>
            </Card>
          );
        })}
      </div>

      {done.length > 0 && (
        <div className="space-y-2">
          <div className="text-muted text-[11px] uppercase tracking-wide">Hechas ({done.length})</div>
          {done.map((t) => (
            <Card key={t.id} className="flex items-center gap-3 opacity-50">
              <button onClick={() => toggle(t)} className="shrink-0"><Check size={15} color="#4ADE80" /></button>
              <div className="text-ink text-sm line-through flex-1 truncate">{t.title}</div>
              <AuthorBadge profile={profiles?.[t.assigned_to]} />
              <button onClick={() => del(t.id)} className="text-red shrink-0"><Trash2 size={15} /></button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
