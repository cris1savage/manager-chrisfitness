'use client';

import { useEffect, useMemo, useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AuthorBadge } from '@/components/ui';
import { useProfiles } from '@/components/ProfilesProvider';

export default function CommentThread({ table, entityId }) {
  const supabase = useMemo(() => createClient(), []);
  const profiles = useProfiles();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');

  const load = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('entity_table', table)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: true });
    setComments(data || []);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`comments-${table}-${entityId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, entityId]);

  const send = async () => {
    if (!text.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('comments').insert({
      entity_table: table,
      entity_id: entityId,
      body: text.trim(),
      created_by: userData.user.id,
    });
    setText('');
    load();
  };

  const del = async (id) => {
    await supabase.from('comments').delete().eq('id', id);
    load();
  };

  return (
    <div className="rounded-lg p-3 bg-surfaceAlt border border-border space-y-2">
      {comments.length === 0 && <div className="text-muted text-xs">Sin notas todavía en esta ficha.</div>}
      {comments.map((c) => (
        <div key={c.id} className="flex items-start gap-2">
          <AuthorBadge profile={profiles?.[c.created_by]} />
          <div className="flex-1 min-w-0">
            <div className="text-ink text-[13px]">{c.body}</div>
            <div className="text-muted text-[10.5px]">{new Date(c.created_at).toLocaleString('es-ES')}</div>
          </div>
          <button onClick={() => del(c.id)} className="text-muted shrink-0">
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Añadir nota (ej. lo que se habló, siguiente paso...)"
          className="bg-surface border border-border text-ink rounded-lg px-2.5 py-1.5 text-xs w-full outline-none focus:border-cyan"
        />
        <button onClick={send} className="p-1.5 rounded-lg bg-cyan text-[#00161C] shrink-0">
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
