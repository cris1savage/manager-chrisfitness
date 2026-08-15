'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, AlertTriangle, Target, Pencil, Check, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, AuthorBadge, Ring } from '@/components/ui';
import { useProfiles } from '@/components/ProfilesProvider';
import { todayISO, addDaysISO, DURATIONS } from '@/lib/config';

function ActiveClientsGoal({ activeCount }) {
  const supabase = useMemo(() => createClient(), []);
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [targetInput, setTargetInput] = useState('');

  const load = async () => {
    const { data } = await supabase.from('goals').select('*').eq('metric', 'clientes_activos_total').order('created_at', { ascending: true }).limit(1);
    setGoal(data?.[0] || null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('active-clients-goal-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createGoal = async () => {
    const target = Number(targetInput) || 0;
    if (!target) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('goals').insert({
      title: 'Clientes activos', metric: 'clientes_activos_total', period: 'mensual', target, created_by: userData.user.id,
    });
    setTargetInput('');
    load();
  };

  const saveTarget = async () => {
    const target = Number(targetInput) || 0;
    await supabase.from('goals').update({ target }).eq('id', goal.id);
    setEditing(false);
    load();
  };

  if (loading) return null;

  if (!goal) {
    return (
      <Card className="flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="flex items-center gap-2 text-ink">
          <Target size={16} />
          <span className="text-sm">Ponte un objetivo de clientes activos para ver tu progreso aquí</span>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <input
            type="number"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            placeholder="Ej. 20"
            className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-full sm:w-24 outline-none focus:border-cyan"
          />
          <button onClick={createGoal} className="rounded-lg px-3 py-1.5 font-semibold text-xs bg-cyan text-[#00161C] shrink-0">Crear</button>
        </div>
      </Card>
    );
  }

  const pct = goal.target > 0 ? activeCount / goal.target : 0;
  const completed = goal.target > 0 && activeCount >= goal.target;

  return (
    <Card className="flex items-center justify-center gap-4 flex-wrap">
      <Ring pct={pct} label="Clientes activos" value={`${activeCount}/${goal.target}`} color={completed ? '#4ADE80' : '#5ECCFA'} size={100} />
      {completed && <span className="text-green text-xs font-bold">Objetivo cumplido 🎉</span>}
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-24 outline-none focus:border-cyan"
          />
          <button onClick={saveTarget} className="text-cyan"><Check size={16} /></button>
        </div>
      ) : (
        <button onClick={() => { setEditing(true); setTargetInput(String(goal.target)); }} className="text-muted flex items-center gap-1 text-xs">
          <Pencil size={13} /> Editar objetivo
        </button>
      )}
    </Card>
  );
}

export default function ClientsClient() {
  const supabase = useMemo(() => createClient(), []);
  const profiles = useProfiles();
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const emptyForm = { name: '', program: '', start_date: todayISO(), duration: 'Mensual', renewal_date: addDaysISO(todayISO(), 30), status: 'Activo' };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const { data } = await supabase.from('active_clients').select('*').order('renewal_date', { ascending: true });
    setClients(data || []);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('clients-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_clients' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setFormDuration = (duration) => {
    const days = DURATIONS[duration];
    setForm((f) => ({ ...f, duration, renewal_date: days ? addDaysISO(f.start_date, days) : f.renewal_date }));
  };
  const setFormStartDate = (start_date) => {
    const days = DURATIONS[form.duration];
    setForm((f) => ({ ...f, start_date, renewal_date: days ? addDaysISO(start_date, days) : f.renewal_date }));
  };

  const add = async () => {
    if (!form.name.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('active_clients').insert({ ...form, created_by: userData.user.id });
    setForm(emptyForm);
    load();
  };

  const update = async (id, key, value) => {
    setClients((c) => c.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
    const patch = { [key]: value };
    if (key === 'duration' || key === 'start_date') {
      const row = clients.find((c) => c.id === id);
      const nextDuration = key === 'duration' ? value : row.duration;
      const nextStart = key === 'start_date' ? value : row.start_date;
      const days = DURATIONS[nextDuration];
      if (days) patch.renewal_date = addDaysISO(nextStart, days);
    }
    setClients((c) => c.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    await supabase.from('active_clients').update(patch).eq('id', id);
  };

  const remove = async (id) => {
    setClients((c) => c.filter((row) => row.id !== id));
    await supabase.from('active_clients').delete().eq('id', id);
  };

  const soon = todayISO();
  const in7 = addDaysISO(soon, 7);
  const renewalsSoon = clients.filter((c) => c.status === 'Activo' && c.renewal_date && c.renewal_date <= in7);
  const visibleClients = search.trim()
    ? clients.filter((c) => (c.name || '').toLowerCase().includes(search.trim().toLowerCase()) || (c.program || '').toLowerCase().includes(search.trim().toLowerCase()))
    : clients;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-ink text-[22px] tracking-wide">CLIENTES ACTIVOS</h2>
        <div className="text-muted text-xs">Elige la duración y la renovación se calcula sola. Ámbar = ≤7 días, rojo = vencida.</div>
      </div>

      <ActiveClientsGoal activeCount={clients.filter((c) => c.status === 'Activo').length} />

      {renewalsSoon.length > 0 && (
        <Card style={{ border: '1px solid #FBBF24', boxShadow: '0 0 24px -8px #FBBF2455' }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} color="#FBBF24" />
            <span className="text-amber font-extrabold text-xs tracking-widest">RENOVACIONES PRÓXIMAS</span>
          </div>
          <div className="space-y-1">
            {renewalsSoon.map((c) => {
              const overdue = c.renewal_date < soon;
              return (
                <div key={c.id} className="text-sm flex items-center justify-between">
                  <span className="text-ink font-medium">{c.name}</span>
                  <span className={overdue ? 'text-red' : 'text-amber'}>
                    {overdue ? 'Vencida' : 'Renueva'} el {new Date(c.renewal_date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="w-full sm:flex-1">
            <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Cliente</div>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full outline-none focus:border-cyan"
            />
          </div>
          <div className="w-full sm:flex-1">
            <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Programa</div>
            <input
              value={form.program}
              onChange={(e) => setForm({ ...form, program: e.target.value })}
              placeholder="Ej. Coaching"
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full outline-none focus:border-cyan"
            />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="w-full sm:flex-1">
            <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Inicio</div>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setFormStartDate(e.target.value)}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full outline-none focus:border-cyan"
            />
          </div>
          <div className="w-full sm:flex-1">
            <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Duración</div>
            <select
              value={form.duration}
              onChange={(e) => setFormDuration(e.target.value)}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full outline-none focus:border-cyan"
            >
              {Object.keys(DURATIONS).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="w-full sm:flex-1">
            <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">
              Renovación {DURATIONS[form.duration] ? '(automática)' : ''}
            </div>
            <input
              type="date"
              value={form.renewal_date}
              disabled={!!DURATIONS[form.duration]}
              onChange={(e) => setForm({ ...form, renewal_date: e.target.value })}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full outline-none focus:border-cyan disabled:opacity-60"
            />
          </div>
          <button onClick={add} className="rounded-lg px-3 py-2 flex items-center justify-center gap-1 font-semibold text-sm bg-cyan text-[#00161C] shrink-0 sm:self-end">
            <Plus size={16} /> Añadir
          </button>
        </div>
      </Card>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o programa..."
          className="bg-surfaceAlt border border-border text-ink rounded-lg pl-9 pr-3 py-2 text-sm w-full outline-none focus:border-cyan"
        />
      </div>

      <div className="space-y-2">
        {clients.length === 0 && <Card className="text-center py-8 text-muted">Todavía no hay clientes activos registrados.</Card>}
        {clients.length > 0 && visibleClients.length === 0 && (
          <Card className="text-center py-8 text-muted">Sin resultados para esa búsqueda.</Card>
        )}
        {visibleClients.map((c) => {
          const overdue = c.renewal_date && c.renewal_date < soon && c.status === 'Activo';
          const dueSoon = c.renewal_date && c.renewal_date >= soon && c.renewal_date <= in7 && c.status === 'Activo';
          return (
            <Card key={c.id} style={{ borderColor: overdue ? '#F87171' : dueSoon ? '#FBBF24' : undefined }}>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={c.name}
                  onChange={(e) => update(c.id, 'name', e.target.value)}
                  className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-full sm:flex-1 outline-none focus:border-cyan font-semibold"
                />
                <input
                  value={c.program || ''}
                  onChange={(e) => update(c.id, 'program', e.target.value)}
                  placeholder="Programa"
                  className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-full sm:flex-1 outline-none focus:border-cyan"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-2 items-start sm:items-center">
                <input
                  type="date"
                  value={c.start_date || ''}
                  onChange={(e) => update(c.id, 'start_date', e.target.value)}
                  className="bg-surfaceAlt border border-border text-ink rounded-lg px-2 py-1.5 text-xs w-full sm:flex-1 outline-none focus:border-cyan"
                />
                <select
                  value={c.duration || 'Personalizada'}
                  onChange={(e) => update(c.id, 'duration', e.target.value)}
                  className="bg-surfaceAlt border border-border text-ink rounded-lg px-2 py-1.5 text-xs w-full sm:flex-1 outline-none focus:border-cyan"
                >
                  {Object.keys(DURATIONS).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <input
                  type="date"
                  value={c.renewal_date || ''}
                  disabled={!!DURATIONS[c.duration]}
                  onChange={(e) => update(c.id, 'renewal_date', e.target.value)}
                  className={`bg-surfaceAlt border border-border rounded-lg px-2 py-1.5 text-xs w-full sm:flex-1 outline-none focus:border-cyan disabled:opacity-60 ${overdue ? 'text-red' : dueSoon ? 'text-amber' : 'text-ink'}`}
                />
                <select
                  value={c.status}
                  onChange={(e) => update(c.id, 'status', e.target.value)}
                  className="bg-surfaceAlt border border-border text-ink rounded-lg px-2 py-1.5 text-xs w-full sm:flex-1 outline-none focus:border-cyan"
                >
                  <option value="Activo">Activo</option>
                  <option value="Pausado">Pausado</option>
                  <option value="Finalizado">Finalizado</option>
                </select>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                  <AuthorBadge profile={profiles?.[c.created_by]} />
                  <button onClick={() => remove(c.id)} className="p-1.5 rounded-lg text-red"><Trash2 size={16} /></button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
