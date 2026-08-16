'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Trash2, MessagesSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, AuthorBadge } from '@/components/ui';
import { useProfiles } from '@/components/ProfilesProvider';

function linkify(text) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline break-all" style={{ color: '#5ECCFA' }}>
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function ChannelClient() {
  const supabase = useMemo(() => createClient(), []);
  const profiles = useProfiles();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState(null);
  const bottomRef = useRef(null);

  const load = async () => {
    const { data } = await supabase.from('channel_messages').select('*').order('created_at', { ascending: true }).limit(200);
    setMessages(data || []);
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data?.user?.id || null));
    load();
    const channel = supabase
      .channel('channel-messages-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channel_messages' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async () => {
    if (!text.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('channel_messages').insert({ body: text.trim(), created_by: userData.user.id });
    setText('');
    load();
  };

  const del = async (id) => {
    setMessages((m) => m.filter((x) => x.id !== id));
    await supabase.from('channel_messages').delete().eq('id', id);
  };

  const sameDay = (a, b) => a && b && a.slice(0, 10) === b.slice(0, 10);
  const dayLabel = (iso) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);
    if (d.toDateString() === today.toDateString()) return 'Hoy';
    if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long' });
  };

  return (
    <div className="space-y-4 flex flex-col" style={{ minHeight: '70vh' }}>
      <div>
        <h2 className="font-display text-ink text-[22px] tracking-wide flex items-center gap-2">
          <MessagesSquare size={20} className="text-cyan" /> CANAL
        </h2>
        <div className="text-muted text-xs">Cosas puntuales entre los dos — enlaces, avisos rápidos — sin depender de WhatsApp.</div>
      </div>

      <Card className="flex-1 flex flex-col !p-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-1" style={{ maxHeight: '55vh' }}>
          {loading && <div className="text-muted text-sm text-center py-8">Cargando…</div>}
          {!loading && messages.length === 0 && (
            <div className="text-muted text-sm text-center py-8">Sin mensajes todavía. Escribe el primero abajo.</div>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const showDay = !prev || !sameDay(prev.created_at, m.created_at);
            const mine = m.created_by === meId;
            return (
              <div key={m.id}>
                {showDay && (
                  <div className="text-center text-muted text-[10.5px] uppercase tracking-wide py-2">{dayLabel(m.created_at)}</div>
                )}
                <div className={`flex items-start gap-2 py-1 ${mine ? 'flex-row-reverse' : ''}`}>
                  <AuthorBadge profile={profiles?.[m.created_by]} />
                  <div className={`max-w-[75%] rounded-xl px-3 py-2 ${mine ? 'rounded-tr-sm' : 'rounded-tl-sm'}`} style={{ background: mine ? '#5ECCFA1A' : '#151A1D' }}>
                    <div className="text-ink text-sm whitespace-pre-wrap break-words">{linkify(m.body)}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-muted text-[10px]">
                        {new Date(m.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {mine && (
                        <button onClick={() => del(m.id)} className="text-muted"><Trash2 size={11} /></button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border p-3 flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Escribe un mensaje... (pega un enlace si hace falta)"
            className="bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2 text-sm w-full outline-none focus:border-cyan"
          />
          <button onClick={send} className="rounded-lg p-2.5 bg-cyan text-[#00161C] shrink-0">
            <Send size={16} />
          </button>
        </div>
      </Card>
    </div>
  );
}
