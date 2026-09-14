'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, AuthorBadge } from '@/components/ui';
import { useProfiles } from '@/components/ProfilesProvider';

export default function NotesClient() {
  const supabase = useMemo(() => createClient(), []);
  const profiles = useProfiles();
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ title: '', content: '' });

  const load = async () => {
    const { data } = await supabase.from('notes').select('*').order('created_at', { ascending: false });
    setNotes(data || []);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('notes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = async () => {
    if (!title.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('notes').insert({ title: title.trim(), content, created_by: userData.user.id });
    setTitle('');
    setContent('');
    load();
  };

  const startEdit = (n) => {
    setEditingId(n.id);
    setDraft({ title: n.title, content: n.content || '' });
  };

  const saveEdit = async () => {
    await supabase.from('notes').update({ title: draft.title.trim(), content: draft.content }).eq('id', editingId);
    setEditingId(null);
    load();
  };

  const del = async (id) => {
    await supabase.from('notes').delete().eq('id', id);
    load();
  };

  return (
    <div className="space-y-4">
      <h2 className="font-display text-ink text-[22px] tracking-wide">DATOS IMPORTANTES</h2>
      <Card className="space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título"
          className="bg-surfaceAlt border border-border text-ink rounded-lg px-2 py-2 w-full text-sm outline-none focus:border-cyan"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Detalle..."
          rows={3}
          className="bg-surfaceAlt border border-border text-ink rounded-lg px-2 py-2 w-full text-sm outline-none focus:border-cyan resize-y"
        />
        <button onClick={add} className="rounded-lg px-3 py-2 font-semibold text-sm flex items-center gap-1 bg-cyan text-[#00161C]">
          <Plus size={16} /> Guardar nota
        </button>
      </Card>
      <div className="space-y-2">
        {notes.length === 0 && <Card className="text-center py-8 text-muted">Sin notas todavía.</Card>}
        {notes.map((n) => {
          if (editingId === n.id) {
            return (
              <Card key={n.id} className="space-y-2">
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="bg-surfaceAlt border border-border text-ink rounded-lg px-2 py-2 w-full text-sm font-bold outline-none focus:border-cyan"
                />
                <textarea
                  value={draft.content}
                  onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                  rows={3}
                  className="bg-surfaceAlt border border-border text-ink rounded-lg px-2 py-2 w-full text-sm outline-none focus:border-cyan resize-y"
                />
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="rounded-lg px-3 py-1.5 font-semibold text-xs bg-cyan text-[#00161C] flex items-center gap-1">
                    <Check size={14} /> Guardar
                  </button>
                  <button onClick={() => setEditingId(null)} className="rounded-lg px-3 py-1.5 font-semibold text-xs text-muted flex items-center gap-1">
                    <X size={14} /> Cancelar
                  </button>
                </div>
              </Card>
            );
          }
          return (
            <Card key={n.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-ink font-bold text-sm">{n.title}</div>
                  <div className="text-muted text-[11px]">{new Date(n.created_at).toLocaleDateString('es-ES')}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <AuthorBadge profile={profiles?.[n.created_by]} />
                  <button onClick={() => startEdit(n)} className="text-muted"><Pencil size={15} /></button>
                  <button onClick={() => del(n.id)} className="text-red"><Trash2 size={15} /></button>
                </div>
              </div>
              {n.content && <div className="text-ink text-sm mt-1.5 whitespace-pre-wrap">{n.content}</div>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
