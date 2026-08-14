'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Film, Clapperboard, Instagram, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, AuthorBadge } from '@/components/ui';
import { useProfiles } from '@/components/ProfilesProvider';

const TYPES = {
  video: { label: 'Video', color: '#5ECCFA', Icon: Film },
  reel: { label: 'Reel', color: '#4ADE80', Icon: Clapperboard },
  historia: { label: 'Historia', color: '#FBBF24', Icon: Instagram },
};

export default function IdeasClient() {
  const supabase = useMemo(() => createClient(), []);
  const profiles = useProfiles();
  const [ideas, setIdeas] = useState([]);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('reel');
  const [notes, setNotes] = useState('');

  const load = async () => {
    const { data } = await supabase.from('content_ideas').select('*').order('created_at', { ascending: false });
    setIdeas(data || []);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('ideas-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_ideas' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = async () => {
    if (!title.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('content_ideas').insert({ title: title.trim(), type, notes, created_by: userData.user.id });
    setTitle('');
    setNotes('');
    load();
  };

  const update = async (id, key, value) => {
    setIdeas((list) => list.map((i) => (i.id === id ? { ...i, [key]: value } : i)));
    await supabase.from('content_ideas').update({ [key]: value }).eq('id', id);
  };

  const toggleUsed = async (idea) => {
    await supabase.from('content_ideas').update({ used: !idea.used }).eq('id', idea.id);
    load();
  };

  const del = async (id) => {
    await supabase.from('content_ideas').delete().eq('id', id);
    load();
  };

  const pending = ideas.filter((i) => !i.used);
  const used = ideas.filter((i) => i.used);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-ink text-[22px] tracking-wide">BANCO DE IDEAS</h2>
        <div className="text-muted text-xs">Apunta ideas sueltas aquí; puedes editarlas en cualquier momento, y marcarlas como usadas cuando grabéis.</div>
      </div>

      <Card className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Ej. 3 errores al hacer déficit calórico"
            className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm outline-none focus:border-cyan"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm outline-none focus:border-cyan"
          >
            {Object.entries(TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas opcionales (guion, referencia, gancho...)"
          className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full outline-none focus:border-cyan"
        />
        <button onClick={add} className="rounded-lg px-3 py-2 flex items-center gap-1 font-semibold text-sm bg-cyan text-[#00161C]">
          <Plus size={16} /> Añadir idea
        </button>
      </Card>

      <div className="space-y-2">
        <div className="text-muted text-[11px] uppercase tracking-wide">Pendientes ({pending.length})</div>
        {pending.length === 0 && <Card className="text-center py-6 text-muted text-sm">No hay ideas pendientes. Añade una arriba.</Card>}
        {pending.map((idea) => {
          const meta = TYPES[idea.type] || TYPES.reel;
          return (
            <Card key={idea.id} className="space-y-2">
              <div className="flex items-center gap-3">
                <button onClick={() => toggleUsed(idea)} className="shrink-0">
                  <div className="w-4 h-4 rounded border border-border hover:border-cyan transition-colors" />
                </button>
                <meta.Icon size={15} color={meta.color} className="shrink-0" />
                <input
                  value={idea.title}
                  onChange={(e) => update(idea.id, 'title', e.target.value)}
                  className="bg-transparent text-ink text-sm font-medium outline-none flex-1 min-w-0"
                />
                <select
                  value={idea.type}
                  onChange={(e) => update(idea.id, 'type', e.target.value)}
                  className="bg-surfaceAlt border border-border text-ink rounded px-1.5 py-1 text-xs outline-none focus:border-cyan shrink-0"
                >
                  {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <AuthorBadge profile={profiles?.[idea.created_by]} />
                <button onClick={() => del(idea.id)} className="text-red shrink-0"><Trash2 size={15} /></button>
              </div>
              <input
                value={idea.notes || ''}
                onChange={(e) => update(idea.id, 'notes', e.target.value)}
                placeholder="Notas..."
                className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-xs w-full outline-none focus:border-cyan ml-7"
                style={{ width: 'calc(100% - 1.75rem)' }}
              />
            </Card>
          );
        })}
      </div>

      {used.length > 0 && (
        <div className="space-y-2">
          <div className="text-muted text-[11px] uppercase tracking-wide">Ya usadas ({used.length})</div>
          {used.map((idea) => {
            const meta = TYPES[idea.type] || TYPES.reel;
            return (
              <Card key={idea.id} className="flex items-center gap-3 opacity-50">
                <button onClick={() => toggleUsed(idea)} className="shrink-0">
                  <Check size={15} color="#4ADE80" />
                </button>
                <meta.Icon size={15} color={meta.color} className="shrink-0" />
                <div className="text-ink text-sm line-through flex-1 truncate">{idea.title}</div>
                <button onClick={() => del(idea.id)} className="text-red shrink-0"><Trash2 size={15} /></button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
