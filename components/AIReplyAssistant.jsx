'use client';

import { useState } from 'react';
import { Sparkles, Copy, Check, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function AIReplyAssistant({ contact }) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [error, setError] = useState('');
  const [copiedIdx, setCopiedIdx] = useState(null);

  const generate = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setError('');
    setSuggestions(null);
    try {
      const supabase = createClient();
      const { data: notesData } = await supabase
        .from('comments')
        .select('body, created_at')
        .eq('entity_table', 'contacts')
        .eq('entity_id', contact.id)
        .order('created_at', { ascending: false })
        .limit(5);
      const recentNotes = (notesData || []).reverse().map((n) => `- ${n.body}`).join('\n');

      const res = await fetch('/api/assistant/suggest-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: contact.name,
          stage: contact.stage,
          source: contact.source,
          notes: contact.notes,
          recentNotes,
          incomingMessage: message,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Algo falló. Inténtalo de nuevo.');
      } else {
        setSuggestions(data.suggestions || []);
      }
    } catch {
      setError('No se pudo conectar. Inténtalo de nuevo.');
    }
    setLoading(false);
  };

  const copy = async (text, i) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {}
  };

  return (
    <div className="rounded-lg p-3 bg-surfaceAlt border border-border space-y-2">
      <div className="flex items-center gap-1.5 text-cyan text-xs font-semibold">
        <Sparkles size={14} /> Sugerir respuesta con IA
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Pega aquí lo que te acaba de escribir..."
        rows={3}
        className="bg-surface border border-border text-ink rounded-lg px-2.5 py-2 text-xs w-full outline-none focus:border-cyan resize-y"
      />
      <button
        onClick={generate}
        disabled={loading || !message.trim()}
        className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-cyan text-[#00161C] flex items-center gap-1.5 disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 size={13} className="animate-spin" /> Pensando...
          </>
        ) : (
          'Sugerir respuestas'
        )}
      </button>
      {error && <div className="text-red text-xs">{error}</div>}
      {suggestions && suggestions.length > 0 && (
        <div className="space-y-2 pt-1">
          {suggestions.map((s, i) => (
            <div key={i} className="rounded-lg p-2.5 bg-surface border border-border">
              <div className="text-cyan text-[10px] font-semibold uppercase tracking-wide mb-1">{s.label}</div>
              <div className="text-ink text-xs whitespace-pre-wrap">{s.text}</div>
              <button
                onClick={() => copy(s.text, i)}
                className="mt-1.5 text-[11px] font-semibold flex items-center gap-1"
                style={{ color: copiedIdx === i ? '#4ADE80' : '#5ECCFA' }}
              >
                {copiedIdx === i ? (
                  <>
                    <Check size={11} /> Copiado
                  </>
                ) : (
                  <>
                    <Copy size={11} /> Copiar
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
