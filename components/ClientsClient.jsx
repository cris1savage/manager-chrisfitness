'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Target, Pencil, Check, Search, Sparkles, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, AuthorBadge, Ring } from '@/components/ui';
import { useProfiles } from '@/components/ProfilesProvider';
import { todayISO, addDaysISO, addMonthsISO, DURATIONS } from '@/lib/config';
import FullScreenModal from '@/components/FullScreenModal';
import ClientProfileModal from '@/components/ClientProfileModal';

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
      <Ring pct={pct} label="Clientes activos" value={`${activeCount}/${goal.target}`} color={completed ? 'var(--color-green)' : 'var(--color-cyan)'} size={100} />
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
  const emptyForm = { name: '', program: '', start_date: todayISO(), duration: 'Mensual', renewal_date: addMonthsISO(todayISO(), 1), status: 'Activo' };
  const [form, setForm] = useState(emptyForm);
  const [openProfile, setOpenProfile] = useState(null);

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
    const months = DURATIONS[duration];
    setForm((f) => ({ ...f, duration, renewal_date: months ? addMonthsISO(f.start_date, months) : f.renewal_date }));
  };
  const setFormStartDate = (start_date) => {
    const months = DURATIONS[form.duration];
    setForm((f) => ({ ...f, start_date, renewal_date: months ? addMonthsISO(start_date, months) : f.renewal_date }));
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
    if (key === 'status') patch.status_changed_at = new Date().toISOString();
    if (key === 'duration' || key === 'start_date') {
      const row = clients.find((c) => c.id === id);
      const nextDuration = key === 'duration' ? value : row.duration;
      const nextStart = key === 'start_date' ? value : row.start_date;
      const months = DURATIONS[nextDuration];
      if (months) patch.renewal_date = addMonthsISO(nextStart, months);
    }
    setClients((c) => c.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    await supabase.from('active_clients').update(patch).eq('id', id);
  };

  const remove = async (id, name) => {
    const ok = window.confirm(`¿Seguro que quieres borrar a "${name}"? También se perderá su historial de precios y cobros en Facturación — no se puede deshacer.`);
    if (!ok) return;
    setClients((c) => c.filter((row) => row.id !== id));
    await supabase.from('active_clients').delete().eq('id', id);
  };

  const soon = todayISO();
  const in7 = addDaysISO(soon, 7);
  const visibleClients = search.trim()
    ? clients.filter((c) => (c.name || '').toLowerCase().includes(search.trim().toLowerCase()) || (c.program || '').toLowerCase().includes(search.trim().toLowerCase()))
    : clients;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-ink text-[22px] tracking-wide">CLIENTES ACTIVOS</h2>
        <div className="text-muted text-xs">Elige la duración y la renovación se calcula sola, mismo día cada ciclo. Se renueva sola hasta que la pauses o finalices a mano.</div>
      </div>

      <ActiveClientsGoal activeCount={clients.filter((c) => c.status === 'Activo').length} />

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
          const isNew = c.created_at && (Date.now() - new Date(c.created_at).getTime()) < 7 * 86400000;
          return (
            <Card
              key={c.id}
              style={{
                borderColor: isNew ? 'var(--color-green)' : overdue ? 'var(--color-red)' : dueSoon ? 'var(--color-amber)' : undefined,
                boxShadow: isNew ? '0 0 20px -6px #4ADE8088' : undefined,
              }}
            >
              {isNew && (
                <div className="flex items-center gap-1 mb-2 w-fit px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide" style={{ background: '#4ADE8022', color: 'var(--color-green)' }}>
                  <Sparkles size={10} /> NUEVO CLIENTE
                </div>
              )}
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
                  <button onClick={() => setOpenProfile(c)} className="p-1.5 rounded-lg text-cyan" title="Ver perfil de seguimiento"><User size={16} /></button>
                  <button onClick={() => remove(c.id, c.name)} className="p-1.5 rounded-lg text-red"><Trash2 size={16} /></button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {openProfile && (
        <FullScreenModal
          title={openProfile.name}
          subtitle={`${openProfile.program || 'Sin programa'} · ${openProfile.duration || ''} · ${openProfile.status}`}
          avatar={
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-display text-lg shrink-0" style={{ background: 'var(--color-cyan)22', color: 'var(--color-cyan)' }}>
              {openProfile.name?.[0]?.toUpperCase() || '?'}
            </div>
          }
          onClose={() => setOpenProfile(null)}
        >
          <ClientProfileModal key={openProfile.id} client={openProfile} />
        </FullScreenModal>
      )}
    </div>
  );
}
