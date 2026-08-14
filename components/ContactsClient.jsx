'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, MessageSquare, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, AuthorBadge } from '@/components/ui';
import { useProfiles } from '@/components/ProfilesProvider';
import { STAGES, STAGE_COLORS, eur } from '@/lib/config';
import CommentThread from '@/components/CommentThread';

const SOURCES = ['Instagram', 'Referido', 'TusMacros', 'Otro'];

export default function ContactsClient() {
  const supabase = useMemo(() => createClient(), []);
  const profiles = useProfiles();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Todos');
  const [openThread, setOpenThread] = useState(null);

  const emptyForm = { name: '', source: 'Instagram', stage: 'Frío', notes: '' };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const { data } = await supabase.from('contacts').select('*').order('stage_updated_at', { ascending: false });
    setContacts(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('contacts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = async () => {
    if (!form.name.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('contacts').insert({ ...form, created_by: userData.user.id, stage_updated_at: new Date().toISOString() });
    setForm(emptyForm);
    load();
  };

  const update = async (id, key, value) => {
    setContacts((c) => c.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
    const patch = { [key]: value };
    if (key === 'stage') patch.stage_updated_at = new Date().toISOString();
    await supabase.from('contacts').update(patch).eq('id', id);
  };

  const remove = async (id) => {
    setContacts((c) => c.filter((row) => row.id !== id));
    await supabase.from('contacts').delete().eq('id', id);
  };

  const counts = useMemo(() => {
    const c = { Todos: contacts.length };
    STAGES.forEach((s) => (c[s] = contacts.filter((x) => x.stage === s).length));
    return c;
  }, [contacts]);

  const visible = filter === 'Todos' ? contacts : contacts.filter((c) => c.stage === filter);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-ink text-[22px] tracking-wide">CONTACTOS</h2>
        <div className="text-muted text-xs">Una ficha por persona. Muévela de etapa con el desplegable cuando avance.</div>
      </div>

      {/* Filtro por etapa */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1.5" style={{ minWidth: 'max-content' }}>
          {['Todos', ...STAGES].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5"
              style={{
                background: filter === s ? (STAGE_COLORS[s] || '#5ECCFA') + '22' : 'transparent',
                border: `1px solid ${filter === s ? (STAGE_COLORS[s] || '#5ECCFA') : '#212729'}`,
                color: filter === s ? (STAGE_COLORS[s] || '#5ECCFA') : '#7C878B',
              }}
            >
              {s} <span className="opacity-70">{counts[s] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Añadir contacto */}
      <Card className="!p-0 overflow-x-auto">
        <div className="grid gap-2 items-end p-4" style={{ gridTemplateColumns: 'minmax(160px,1fr) minmax(140px,1fr) minmax(160px,1fr) minmax(160px,1fr) auto', minWidth: 700 }}>
          <div>
            <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Nombre / @usuario</div>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-full outline-none focus:border-cyan"
            />
          </div>
          <div>
            <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Origen</div>
            <select
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-full outline-none focus:border-cyan"
            >
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Etapa inicial</div>
            <select
              value={form.stage}
              onChange={(e) => setForm({ ...form, stage: e.target.value })}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-full outline-none focus:border-cyan"
            >
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Notas</div>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-full outline-none focus:border-cyan"
            />
          </div>
          <button onClick={add} className="rounded-lg px-3 py-2 flex items-center gap-1 font-semibold text-sm bg-cyan text-[#00161C] shrink-0">
            <Plus size={16} /> Añadir
          </button>
        </div>
      </Card>

      {/* Lista */}
      <div className="space-y-2">
        {loading && <Card className="text-center py-8 text-muted">Cargando…</Card>}
        {!loading && visible.length === 0 && (
          <Card className="text-center py-8 text-muted">No hay contactos en esta etapa.</Card>
        )}
        {visible.map((c) => {
          const color = STAGE_COLORS[c.stage] || '#5ECCFA';
          const isClient = c.stage === 'Cliente';
          return (
            <Card key={c.id} className="!p-0" style={{ borderColor: `${color}55` }}>
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <input
                      value={c.name}
                      onChange={(e) => update(c.id, 'name', e.target.value)}
                      className="bg-transparent text-ink font-bold text-sm outline-none w-full"
                    />
                    <div className="text-muted text-[11px]">{c.source}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <AuthorBadge profile={profiles?.[c.created_by]} />
                    <button
                      onClick={() => setOpenThread(openThread === c.id ? null : c.id)}
                      className={`p-1.5 rounded-lg ${openThread === c.id ? 'text-cyan' : 'text-muted'}`}
                      title="Notas de esta ficha"
                    >
                      <MessageSquare size={16} />
                    </button>
                    <button onClick={() => remove(c.id)} className="p-1.5 rounded-lg text-red">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-muted text-[10.5px] uppercase tracking-wide">Etapa:</span>
                  <select
                    value={c.stage}
                    onChange={(e) => update(c.id, 'stage', e.target.value)}
                    className="rounded-lg px-2.5 py-1 text-xs font-semibold outline-none"
                    style={{ background: `${color}1A`, color, border: `1px solid ${color}55` }}
                  >
                    {STAGES.map((s) => <option key={s} value={s} style={{ color: '#000' }}>{s}</option>)}
                  </select>
                </div>

                {isClient && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Programa</div>
                      <input
                        value={c.program || ''}
                        onChange={(e) => update(c.id, 'program', e.target.value)}
                        placeholder="Ej. Coaching 3 meses"
                        className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-full outline-none focus:border-cyan"
                      />
                    </div>
                    <div>
                      <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Importe (€)</div>
                      <input
                        type="number"
                        value={c.amount || ''}
                        onChange={(e) => update(c.id, 'amount', e.target.value)}
                        className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-full outline-none focus:border-cyan"
                      />
                    </div>
                  </div>
                )}

                <input
                  value={c.notes || ''}
                  onChange={(e) => update(c.id, 'notes', e.target.value)}
                  placeholder="Notas rápidas..."
                  className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-xs w-full outline-none focus:border-cyan"
                />
              </div>
              {openThread === c.id && (
                <div className="px-4 pb-4">
                  <CommentThread table="contacts" entityId={c.id} />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
