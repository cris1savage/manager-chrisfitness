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
    const nextDone = !t.done;
    setTasks((list) => list.map((x) => (x.id === t.id ? { ...x, done: nextDone } : x)));
    await supabase.from('tasks').update({ done: nextDone, completed_at: nextDone ? new Date().toISOString() : null }).eq('id', t.id);
    load();
  };

  const update = async (id, key, value) => {
    setTasks((list) => list.map((t) => (t.id === id ? { ...t, [key]: value } : t)));
    await supabase.from('tasks').update({ [key]: value }).eq('id', id);
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
            <Card key={t.id} className="space-y-2">
              <div className="flex items-center gap-3">
                <button onClick={() => toggle(t)} className="shrink-0" title="Marcar como realizada">
                  <div className="w-6 h-6 rounded-md border-2 border-border hover:border-cyan flex items-center justify-center transition-colors">
                    <Check size={15} className="opacity-0" />
                  </div>
                </button>
                <input
                  value={t.title}
                  onChange={(e) => update(t.id, 'title', e.target.value)}
                  className="bg-transparent text-ink text-sm font-medium outline-none flex-1 min-w-0"
                />
                <AuthorBadge profile={profiles?.[t.assigned_to]} />
                <button onClick={() => del(t.id)} className="text-red shrink-0"><Trash2 size={15} /></button>
              </div>
              <div className="flex items-center gap-2 pl-8 flex-wrap">
                <select
                  value={t.assigned_to || ''}
                  onChange={(e) => update(t.id, 'assigned_to', e.target.value)}
                  className="bg-surfaceAlt border border-border text-ink rounded px-2 py-1 text-xs outline-none focus:border-cyan"
                >
                  {profileList.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
                </select>
                <input
                  type="date"
                  value={t.due_date || ''}
                  onChange={(e) => update(t.id, 'due_date', e.target.value)}
                  className={`bg-surfaceAlt border border-border rounded px-2 py-1 text-xs outline-none focus:border-cyan ${overdue ? 'text-red' : 'text-ink'}`}
                />
                {overdue && <span className="text-red text-[10px] font-semibold">ATRASADA</span>}
              </div>
            </Card>
          );
        })}
      </div>

      {done.length > 0 && (
        <div className="space-y-2">
          <div className="text-muted text-[11px] uppercase tracking-wide">Hechas ({done.length})</div>
          {done.map((t) => (
            <Card key={t.id} className="flex items-center gap-3">
              <button onClick={() => toggle(t)} className="shrink-0" title="Marcar como pendiente">
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: '#4ADE80' }}>
                  <Check size={15} color="#00220C" strokeWidth={3} />
                </div>
              </button>
              <div className="text-ink text-sm line-through flex-1 truncate opacity-60">{t.title}</div>
              <AuthorBadge profile={profiles?.[t.assigned_to]} />
              <button onClick={() => del(t.id)} className="text-red shrink-0"><Trash2 size={15} /></button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
