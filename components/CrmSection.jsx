'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, MessageSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, Field, AuthorBadge } from '@/components/ui';
import { todayISO, eur } from '@/lib/config';
import { useProfiles } from '@/components/ProfilesProvider';
import CommentThread from '@/components/CommentThread';

export default function CrmSection({ config }) {
  const supabase = useMemo(() => createClient(), []);
  const profiles = useProfiles();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openThread, setOpenThread] = useState(null);

  const emptyForm = useMemo(() => {
    const o = {};
    config.fields.forEach((f) => (o[f.key] = f.key === 'date' ? todayISO() : ''));
    return o;
  }, [config]);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const { data } = await supabase.from(config.table).select('*').order('date', { ascending: false });
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`${config.table}-changes`)
      .on('postgres_changes', { event: '*', schema: 'public', table: config.table }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.table]);

  const add = async () => {
    const firstTextField = config.fields.find((f) => f.type === 'text');
    if (firstTextField && !form[firstTextField.key]) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from(config.table).insert({ ...form, created_by: userData.user.id });
    setForm(emptyForm);
    load();
  };

  const update = async (id, key, value) => {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
    await supabase.from(config.table).update({ [key]: value }).eq('id', id);
  };

  const remove = async (id) => {
    setRows((r) => r.filter((row) => row.id !== id));
    await supabase.from(config.table).delete().eq('id', id);
  };

  const total = config.amountField ? rows.reduce((s, r) => s + (Number(r[config.amountField]) || 0), 0) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-display text-ink text-[22px] tracking-wide">{config.title.toUpperCase()}</h2>
        {total !== null && <div className="text-cyan font-display text-lg">{eur(total)} total</div>}
      </div>

      <Card className="!p-0 overflow-x-auto">
        <div
          className="grid gap-2 items-end p-4"
          style={{ gridTemplateColumns: `repeat(${config.fields.length}, minmax(130px,1fr)) auto`, minWidth: config.fields.length > 3 ? 130 * config.fields.length + 100 : undefined }}
        >
          {config.fields.map((f) => (
            <div key={f.key}>
              <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">{f.label}</div>
              <Field f={f} value={form[f.key]} onChange={(v) => setForm({ ...form, [f.key]: v })} />
            </div>
          ))}
          <button
            onClick={add}
            className="rounded-lg px-3 py-2 flex items-center gap-1 font-semibold text-sm bg-cyan text-[#00161C] shrink-0"
          >
            <Plus size={16} /> Añadir
          </button>
        </div>
      </Card>

      <div className="space-y-2">
        {loading && <Card className="text-center py-8 text-muted">Cargando…</Card>}
        {!loading && rows.length === 0 && (
          <Card className="text-center py-8 text-muted">Todavía no hay registros. Añade el primero arriba.</Card>
        )}
        {rows.map((row) => (
          <Card key={row.id} className="!p-0 space-y-0 overflow-x-auto">
            <div
              className="grid gap-2 items-center p-4"
              style={{ gridTemplateColumns: `repeat(${config.fields.length}, minmax(130px,1fr)) auto`, minWidth: config.fields.length > 3 ? 130 * config.fields.length + 100 : undefined }}
            >
              {config.fields.map((f) => (
                <Field key={f.key} f={f} value={row[f.key]} onChange={(v) => update(row.id, f.key, v)} />
              ))}
              <div className="flex items-center gap-2 shrink-0">
                {config.comments && (
                  <button
                    onClick={() => setOpenThread(openThread === row.id ? null : row.id)}
                    className={`p-2 rounded-lg ${openThread === row.id ? 'text-cyan' : 'text-muted'}`}
                    title="Notas de esta ficha"
                  >
                    <MessageSquare size={16} />
                  </button>
                )}
                <AuthorBadge profile={profiles?.[row.created_by]} />
                <button onClick={() => remove(row.id)} className="p-2 rounded-lg text-red">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            {config.comments && openThread === row.id && (
              <div className="px-4 pb-4">
                <CommentThread table={config.table} entityId={row.id} />
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
