'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Copy, Check, Pencil, X, MessageCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, AuthorBadge } from '@/components/ui';
import { useProfiles } from '@/components/ProfilesProvider';

export default function TemplatesClient() {
  const supabase = useMemo(() => createClient(), []);
  const profiles = useProfiles();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('Todas');
  const [copiedId, setCopiedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});

  const emptyForm = { title: '', category: 'Primer contacto', content: '' };
  const [form, setForm] = useState(emptyForm);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('message_templates').select('*').order('updated_at', { ascending: false });
    setTemplates(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('templates-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_templates' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(() => {
    const set = new Set(templates.map((t) => t.category || 'General'));
    return ['Todas', ...Array.from(set)];
  }, [templates]);

  const add = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('message_templates').insert({ ...form, created_by: userData.user.id });
    setForm(emptyForm);
    setAdding(false);
    load();
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setDraft({ title: t.title, category: t.category, content: t.content });
  };

  const saveEdit = async () => {
    await supabase.from('message_templates').update({ ...draft, updated_at: new Date().toISOString() }).eq('id', editingId);
    setEditingId(null);
    load();
  };

  const remove = async (id) => {
    await supabase.from('message_templates').delete().eq('id', id);
    load();
  };

  const copy = async (t) => {
    try {
      await navigator.clipboard.writeText(t.content);
      setCopiedId(t.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {}
  };

  const visible = category === 'Todas' ? templates : templates.filter((t) => (t.category || 'General') === category);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-display text-ink text-[22px] tracking-wide">PLANTILLAS DE MENSAJES</h2>
          <div className="text-muted text-xs">Respuestas que copias y pegas. Tú y Ana podéis añadir y editar.</div>
        </div>
        <button onClick={() => setAdding(!adding)} className="rounded-lg px-3 py-2 flex items-center gap-1 font-semibold text-sm bg-cyan text-[#00161C] shrink-0">
          <Plus size={16} /> Nueva plantilla
        </button>
      </div>

      {adding && (
        <Card className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Título (ej. Primer mensaje a lead frío)"
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full sm:flex-1 outline-none focus:border-cyan"
            />
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Categoría (ej. Primer contacto)"
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full sm:w-56 outline-none focus:border-cyan"
            />
          </div>
          <textarea
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="Escribe el mensaje. Puedes usar [NOMBRE] como recordatorio para personalizarlo antes de enviarlo."
            rows={4}
            className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full outline-none focus:border-cyan resize-y"
          />
          <div className="flex gap-2">
            <button onClick={add} className="rounded-lg px-4 py-2 font-semibold text-sm bg-cyan text-[#00161C]">Guardar plantilla</button>
            <button onClick={() => setAdding(false)} className="rounded-lg px-4 py-2 font-semibold text-sm text-muted">Cancelar</button>
          </div>
        </Card>
      )}

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
          <Card className="text-center py-8 text-muted col-span-2">Sin plantillas aquí todavía.</Card>
        )}
        {visible.map((t) => {
          if (editingId === t.id) {
            return (
              <Card key={t.id} className="space-y-2 sm:col-span-2">
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full font-semibold outline-none focus:border-cyan"
                />
                <input
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full outline-none focus:border-cyan"
                />
                <textarea
                  value={draft.content}
                  onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                  rows={4}
                  className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full outline-none focus:border-cyan resize-y"
                />
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="rounded-lg px-3 py-1.5 font-semibold text-xs bg-cyan text-[#00161C] flex items-center gap-1"><Check size={13} /> Guardar</button>
                  <button onClick={() => setEditingId(null)} className="rounded-lg px-3 py-1.5 font-semibold text-xs text-muted flex items-center gap-1"><X size={13} /> Cancelar</button>
                </div>
              </Card>
            );
          }
          return (
            <Card key={t.id} className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <MessageCircle size={15} className="text-cyan shrink-0" />
                  <div className="text-ink font-semibold text-sm truncate">{t.title}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => startEdit(t)} className="text-muted p-1"><Pencil size={14} /></button>
                  <button onClick={() => remove(t.id)} className="text-muted p-1"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="text-muted text-xs whitespace-pre-wrap line-clamp-4">{t.content}</div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] uppercase tracking-wide text-muted px-1.5 py-0.5 rounded bg-surfaceAlt">{t.category || 'General'}</span>
                <div className="flex items-center gap-2">
                  <AuthorBadge profile={profiles?.[t.created_by]} />
                  <button
                    onClick={() => copy(t)}
                    className="rounded-lg px-2.5 py-1 text-xs font-semibold flex items-center gap-1"
                    style={{ background: copiedId === t.id ? '#4ADE8022' : '#5ECCFA22', color: copiedId === t.id ? '#4ADE80' : '#5ECCFA' }}
                  >
                    {copiedId === t.id ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
