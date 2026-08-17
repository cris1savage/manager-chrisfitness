'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Check, Repeat, Power } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, AuthorBadge } from '@/components/ui';
import { useProfiles } from '@/components/ProfilesProvider';
import { todayISO } from '@/lib/config';

const WEEKDAYS = [
  { v: 1, l: 'Lunes' }, { v: 2, l: 'Martes' }, { v: 3, l: 'Miércoles' }, { v: 4, l: 'Jueves' },
  { v: 5, l: 'Viernes' }, { v: 6, l: 'Sábado' }, { v: 0, l: 'Domingo' },
];

function RecurringTasks() {
  const supabase = useMemo(() => createClient(), []);
  const profiles = useProfiles();
  const profileList = Object.values(profiles || {});
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState({ title: '', assigned_to: '', recurrence_type: 'daily', recurrence_day: 1, due_time: '' });

  const load = async () => {
    const { data } = await supabase.from('task_templates').select('*').order('created_at', { ascending: false });
    setTemplates(data || []);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('task-templates-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_templates' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = async () => {
    if (!form.title.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('task_templates').insert({
      title: form.title.trim(),
      assigned_to: form.assigned_to || userData.user.id,
      recurrence_type: form.recurrence_type,
      recurrence_day: form.recurrence_type === 'daily' ? null : Number(form.recurrence_day),
      due_time: form.due_time || null,
      created_by: userData.user.id,
    });
    setForm({ title: '', assigned_to: '', recurrence_type: 'daily', recurrence_day: 1, due_time: '' });
    load();
  };

  const toggleActive = async (t) => {
    await supabase.from('task_templates').update({ active: !t.active }).eq('id', t.id);
    load();
  };

  const del = async (id) => {
    await supabase.from('task_templates').delete().eq('id', id);
    load();
  };

  const describe = (t) => {
    if (t.recurrence_type === 'daily') return 'Todos los días';
    if (t.recurrence_type === 'weekly') return `Cada ${WEEKDAYS.find((w) => w.v === t.recurrence_day)?.l || ''}`;
    return `El día ${t.recurrence_day} de cada mes`;
  };

  return (
    <div className="space-y-3">
      <div className="text-ink font-semibold text-sm flex items-center gap-1.5"><Repeat size={15} /> Tareas repetitivas</div>
      <div className="text-muted text-xs -mt-1">
        Se crean solas cada día que toque (con el aviso diario ya programado). No hace falta repetirlas a mano.
      </div>

      <Card className="space-y-2">
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Ej. Revisar anuncios y ajustar presupuesto"
          className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full outline-none focus:border-cyan"
        />
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={form.assigned_to}
            onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
            className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full sm:flex-1 outline-none focus:border-cyan"
          >
            <option value="">Asignar a…</option>
            {profileList.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
          </select>
          <select
            value={form.recurrence_type}
            onChange={(e) => setForm({ ...form, recurrence_type: e.target.value })}
            className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full sm:flex-1 outline-none focus:border-cyan"
          >
            <option value="daily">Diaria</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensual</option>
          </select>
          {form.recurrence_type === 'weekly' && (
            <select
              value={form.recurrence_day}
              onChange={(e) => setForm({ ...form, recurrence_day: e.target.value })}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full sm:flex-1 outline-none focus:border-cyan"
            >
              {WEEKDAYS.map((w) => <option key={w.v} value={w.v}>{w.l}</option>)}
            </select>
          )}
          {form.recurrence_type === 'monthly' && (
            <select
              value={form.recurrence_day}
              onChange={(e) => setForm({ ...form, recurrence_day: e.target.value })}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full sm:flex-1 outline-none focus:border-cyan"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Día {d}</option>)}
            </select>
          )}
          <input
            type="time"
            value={form.due_time}
            onChange={(e) => setForm({ ...form, due_time: e.target.value })}
            className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full sm:flex-1 outline-none focus:border-cyan"
          />
        </div>
        <button onClick={add} className="rounded-lg px-3 py-2 flex items-center gap-1 font-semibold text-sm bg-cyan text-[#00161C]">
          <Plus size={16} /> Crear rutina
        </button>
      </Card>

      <div className="space-y-1.5">
        {templates.length === 0 && <div className="text-muted text-xs text-center py-3">Sin rutinas todavía.</div>}
        {templates.map((t) => (
          <Card key={t.id} className="flex items-center gap-3" style={{ opacity: t.active ? 1 : 0.5 }}>
            <button onClick={() => toggleActive(t)} className="shrink-0" title={t.active ? 'Pausar rutina' : 'Reactivar rutina'}>
              <Power size={16} color={t.active ? '#4ADE80' : '#7C878B'} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-ink text-sm font-medium truncate">{t.title}</div>
              <div className="text-muted text-[11px]">
                {describe(t)}{t.due_time && ` · ${t.due_time.slice(0, 5)}`}
              </div>
            </div>
            <AuthorBadge profile={profiles?.[t.assigned_to]} />
            <button onClick={() => del(t.id)} className="text-red shrink-0"><Trash2 size={15} /></button>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function TasksClient() {
  const supabase = useMemo(() => createClient(), []);
  const profiles = useProfiles();
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState(todayISO());
  const [dueTime, setDueTime] = useState('');
  const [meId, setMeId] = useState(null);
  const [view, setView] = useState('mias'); // mias | todas

  const profileList = Object.values(profiles || {});

  const load = async () => {
    const { data } = await supabase.from('tasks').select('*').order('due_date', { ascending: true });
    setTasks(data || []);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data?.user?.id || null));
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
      due_time: dueTime || null,
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

  const scoped = view === 'mias' && meId ? tasks.filter((t) => t.assigned_to === meId) : tasks;
  const pending = scoped.filter((t) => !t.done);
  const done = scoped.filter((t) => t.done);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-display text-ink text-[22px] tracking-wide">TAREAS ASIGNADAS</h2>
          <div className="text-muted text-xs">Reparte el trabajo de la semana entre las dos cuentas.</div>
        </div>
        <div className="flex rounded-lg overflow-hidden border border-border shrink-0">
          {[{ k: 'mias', l: 'Mis tareas' }, { k: 'todas', l: 'Todas' }].map(({ k, l }) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className="px-3 py-1.5 text-xs font-semibold"
              style={{ background: view === k ? '#5ECCFA' : 'transparent', color: view === k ? '#00161C' : '#7C878B' }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <Card className="space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Ej. Contactar a 3 leads fríos"
          className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full outline-none focus:border-cyan"
        />
        <div className="grid grid-cols-3 gap-2">
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
          <input
            type="time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
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
                <input
                  type="time"
                  value={t.due_time || ''}
                  onChange={(e) => update(t.id, 'due_time', e.target.value || null)}
                  className="bg-surfaceAlt border border-border text-ink rounded px-2 py-1 text-xs outline-none focus:border-cyan"
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

      <div className="border-t border-border pt-4">
        <RecurringTasks />
      </div>
    </div>
  );
}
