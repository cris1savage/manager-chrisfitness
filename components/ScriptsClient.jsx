'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, FileText, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, AuthorBadge } from '@/components/ui';
import { useProfiles } from '@/components/ProfilesProvider';
import { SCRIPT_STATUSES } from '@/lib/config';

const STATUS_COLORS = { Borrador: '#7C878B', Listo: '#FBBF24', Grabado: '#4ADE80' };

export default function ScriptsClient() {
  const supabase = useMemo(() => createClient(), []);
  const profiles = useProfiles();
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('Todas');
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState({});

  const load = async () => {
    const { data } = await supabase.from('scripts').select('*').order('updated_at', { ascending: false });
    setScripts(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('scripts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scripts' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(() => {
    const set = new Set(scripts.map((s) => s.category || 'General'));
    return ['Todas', ...Array.from(set)];
  }, [scripts]);

  const createNew = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('scripts')
      .insert({ title: 'Nuevo guion', category: 'General', content: '', status: 'Borrador', created_by: userData.user.id })
      .select()
      .single();
    if (data) {
      setOpenId(data.id);
      setDraft(data);
      load();
    }
  };

  const openEditor = (s) => {
    setOpenId(s.id);
    setDraft(s);
  };

  const save = async () => {
    await supabase
      .from('scripts')
      .update({ title: draft.title, category: draft.category, content: draft.content, status: draft.status, updated_at: new Date().toISOString() })
      .eq('id', openId);
    setOpenId(null);
    load();
  };

  const remove = async (id) => {
    await supabase.from('scripts').delete().eq('id', id);
    if (openId === id) setOpenId(null);
    load();
  };

  const visible = category === 'Todas' ? scripts : scripts.filter((s) => (s.category || 'General') === category);
  const editing = openId ? scripts.find((s) => s.id === openId) || draft : null;

  if (openId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-ink text-[20px] tracking-wide">EDITAR GUION</h2>
          <button onClick={() => setOpenId(null)} className="text-muted flex items-center gap-1 text-sm">
            <X size={16} /> Cerrar
          </button>
        </div>
        <Card className="space-y-3">
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Título del guion"
            className="bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2 text-sm font-semibold w-full outline-none focus:border-cyan"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              placeholder="Categoría (ej. Octubre, Pierna...)"
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2 text-sm w-full outline-none focus:border-cyan"
            />
            <select
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2 text-sm w-full outline-none focus:border-cyan"
            >
              {SCRIPT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <textarea
            value={draft.content || ''}
            onChange={(e) => setDraft({ ...draft, content: e.target.value })}
            placeholder="Escribe el guion aquí... Ana puede leerlo y corregirlo directamente."
            rows={16}
            className="bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2.5 text-sm w-full outline-none focus:border-cyan resize-y leading-relaxed"
          />
          <div className="flex gap-2">
            <button onClick={save} className="rounded-lg px-4 py-2 font-semibold text-sm bg-cyan text-[#00161C]">
              Guardar
            </button>
            <button onClick={() => remove(openId)} className="rounded-lg px-4 py-2 font-semibold text-sm text-red flex items-center gap-1.5">
              <Trash2 size={15} /> Eliminar guion
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-display text-ink text-[22px] tracking-wide">GUIONES</h2>
          <div className="text-muted text-xs">Biblioteca de guiones para grabar. Tú y Ana podéis leer y corregir.</div>
        </div>
        <button onClick={createNew} className="rounded-lg px-3 py-2 flex items-center gap-1 font-semibold text-sm bg-cyan text-[#00161C] shrink-0">
          <Plus size={16} /> Nuevo guion
        </button>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1.5" style={{ minWidth: 'max-content' }}>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0"
              style={{
                background: category === c ? '#5ECCFA22' : 'transparent',
                border: `1px solid ${category === c ? '#5ECCFA' : '#212729'}`,
                color: category === c ? '#5ECCFA' : '#7C878B',
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {loading && <Card className="text-center py-8 text-muted col-span-2">Cargando…</Card>}
        {!loading && visible.length === 0 && (
          <Card className="text-center py-8 text-muted col-span-2">Sin guiones en esta categoría. Crea el primero arriba.</Card>
        )}
        {visible.map((s) => (
          <Card key={s.id} className="cursor-pointer space-y-2" onClick={() => openEditor(s)}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={16} className="text-cyan shrink-0" />
                <div className="text-ink font-semibold text-sm truncate">{s.title}</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); remove(s.id); }}
                className="text-muted shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="text-muted text-xs line-clamp-2">{s.content ? s.content.slice(0, 120) : 'Sin contenido todavía.'}</div>
            <div className="flex items-center justify-between">
              <span
                className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded"
                style={{ background: `${STATUS_COLORS[s.status]}22`, color: STATUS_COLORS[s.status] }}
              >
                {s.status}
              </span>
              <AuthorBadge profile={profiles?.[s.created_by]} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
