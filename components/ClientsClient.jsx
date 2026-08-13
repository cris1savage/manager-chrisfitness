'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, Field, AuthorBadge } from '@/components/ui';
import { useProfiles } from '@/components/ProfilesProvider';
import { todayISO } from '@/lib/config';

const FIELDS = [
  { key: 'name', label: 'Cliente', type: 'text' },
  { key: 'program', label: 'Programa', type: 'text', placeholder: 'Ej. Coaching 3 meses' },
  { key: 'start_date', label: 'Inicio', type: 'date' },
  { key: 'renewal_date', label: 'Próxima renovación', type: 'date' },
  { key: 'status', label: 'Estado', type: 'select', options: ['Activo', 'Pausado', 'Finalizado'] },
];

function Field2({ f, value, onChange }) {
  const base = 'bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-full outline-none focus:border-cyan';
  if (f.type === 'select') {
    return (
      <select className={base} value={value || ''} onChange={(e) => onChange(e.target.value)}>
        {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  return (
    <input className={base} type={f.type} placeholder={f.placeholder || f.label} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
  );
}

export default function ClientsClient() {
  const supabase = useMemo(() => createClient(), []);
  const profiles = useProfiles();
  const [clients, setClients] = useState([]);
  const emptyForm = { name: '', program: '', start_date: todayISO(), renewal_date: '', status: 'Activo' };
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

  const add = async () => {
    if (!form.name.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('active_clients').insert({ ...form, created_by: userData.user.id });
    setForm(emptyForm);
    load();
  };

  const update = async (id, key, value) => {
    setClients((c) => c.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
    await supabase.from('active_clients').update({ [key]: value }).eq('id', id);
  };

  const remove = async (id) => {
    setClients((c) => c.filter((row) => row.id !== id));
    await supabase.from('active_clients').delete().eq('id', id);
  };

  const soon = todayISO();
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-ink text-[22px] tracking-wide">CLIENTES ACTIVOS</h2>
        <div className="text-muted text-xs">Las renovaciones en los próximos 7 días se marcan en ámbar; las vencidas en rojo.</div>
      </div>

      <Card className="!p-0 overflow-x-auto">
        <div
          className="grid gap-2 items-end p-4"
          style={{ gridTemplateColumns: `repeat(${FIELDS.length}, minmax(130px,1fr)) auto`, minWidth: 130 * FIELDS.length + 100 }}
        >
          {FIELDS.map((f) => (
            <div key={f.key}>
              <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">{f.label}</div>
              <Field2 f={f} value={form[f.key]} onChange={(v) => setForm({ ...form, [f.key]: v })} />
            </div>
          ))}
          <button onClick={add} className="rounded-lg px-3 py-2 flex items-center gap-1 font-semibold text-sm bg-cyan text-[#00161C] shrink-0">
            <Plus size={16} /> Añadir
          </button>
        </div>
      </Card>

      <div className="space-y-2">
        {clients.length === 0 && <Card className="text-center py-8 text-muted">Todavía no hay clientes activos registrados.</Card>}
        {clients.map((c) => {
          const overdue = c.renewal_date && c.renewal_date < soon && c.status === 'Activo';
          const dueSoon = c.renewal_date && c.renewal_date >= soon && c.renewal_date <= in7 && c.status === 'Activo';
          return (
            <Card
              key={c.id}
              className="!p-0 overflow-x-auto"
              style={{ borderColor: overdue ? '#F87171' : dueSoon ? '#FBBF24' : undefined }}
            >
              <div
                className="grid gap-2 items-center p-4"
                style={{ gridTemplateColumns: `repeat(${FIELDS.length}, minmax(130px,1fr)) auto`, minWidth: 130 * FIELDS.length + 100 }}
              >
                {FIELDS.map((f) => (
                  <Field2 key={f.key} f={f} value={c[f.key]} onChange={(v) => update(c.id, f.key, v)} />
                ))}
                <div className="flex items-center gap-2 shrink-0">
                  <AuthorBadge profile={profiles?.[c.created_by]} />
                  <button onClick={() => remove(c.id)} className="p-2 rounded-lg text-red"><Trash2 size={16} /></button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
