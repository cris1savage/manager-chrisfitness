'use client';

import { useState } from 'react';
import { Sparkles, Copy, Check, Loader2, Flame, AlertTriangle, Target, UserPlus, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const SOURCES = ['Instagram', 'Anuncio', 'Referido', 'TusMacros', 'Otro'];

function scoreColor(score) {
  if (score >= 76) return '#F87171';
  if (score >= 51) return '#FBBF24';
  if (score >= 26) return '#5ECCFA';
  return '#7C878B';
}

export default function NewLeadPanel({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [source, setSource] = useState('Instagram');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [creating, setCreating] = useState(false);

  const analyze = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setError('');
    setAnalysis(null);
    try {
      const res = await fetch('/api/assistant/ai-closer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: name || 'Nuevo lead',
          stage: 'Frío',
          source,
          notes: '',
          priorAnalysis: '',
          conversationText: message,
          mode: 'analyze',
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Algo falló.');
      else setAnalysis(data);
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

  const createContact = async () => {
    if (!name.trim()) {
      setError('Ponle un nombre al lead antes de crear la ficha.');
      return;
    }
    setCreating(true);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('contacts').insert({
      name: name.trim(),
      source,
      stage: analysis?.suggested_stage || 'Frío',
      notes: '',
      created_by: userData.user.id,
      stage_updated_at: new Date().toISOString(),
      ai_lead_state: analysis?.lead_state || null,
      ai_lead_score: analysis?.lead_score ?? null,
      ai_score_reason: analysis?.score_reason || null,
      ai_objective: analysis?.objective || null,
      ai_problem: analysis?.problem || null,
      ai_situation: analysis?.situation || null,
      ai_objections: analysis?.objections || null,
      ai_next_step: analysis?.next_step || null,
      ai_probability: analysis?.probability || null,
      ai_last_analysis_at: analysis ? new Date().toISOString() : null,
      ai_last_conversation: message || null,
    });
    setCreating(false);
    onCreated();
  };

  return (
    <div className="rounded-lg p-3 bg-surfaceAlt border border-cyan space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-cyan text-xs font-semibold">
          <Sparkles size={14} /> Lead nuevo con IA
        </div>
        <button onClick={onClose} className="text-muted"><X size={16} /></button>
      </div>
      <div className="text-muted text-[10.5px] -mt-1">
        Pega la conversación, analízala, y crea la ficha ya con el análisis dentro — sin tener que darlo de alta a mano antes.
      </div>

      <div className="flex gap-2 flex-wrap">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del lead"
          className="bg-surface border border-border text-ink rounded-lg px-2.5 py-1.5 text-xs flex-1 min-w-[140px] outline-none focus:border-cyan"
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="bg-surface border border-border text-ink rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-cyan"
        >
          {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Pega aquí la conversación de Instagram..."
        rows={4}
        className="bg-surface border border-border text-ink rounded-lg px-2.5 py-2 text-xs w-full outline-none focus:border-cyan resize-y"
      />
      <button
        onClick={analyze}
        disabled={loading || !message.trim()}
        className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-cyan text-[#00161C] flex items-center gap-1.5 disabled:opacity-50"
      >
        {loading ? <><Loader2 size={13} className="animate-spin" /> Analizando...</> : 'Analizar conversación'}
      </button>
      {error && <div className="text-red text-xs">{error}</div>}

      {analysis && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10.5px] font-semibold uppercase px-2 py-1 rounded" style={{ background: '#5ECCFA22', color: '#5ECCFA' }}>
              {analysis.lead_state}
            </span>
            {analysis.lead_score != null && (
              <span className="text-[10.5px] font-semibold px-2 py-1 rounded" style={{ background: `${scoreColor(analysis.lead_score)}22`, color: scoreColor(analysis.lead_score) }}>
                Lead score: {analysis.lead_score}/100
              </span>
            )}
          </div>
          {analysis.score_reason && <div className="text-muted text-[11px]">{analysis.score_reason}</div>}

          {typeof analysis.closing_ready === 'boolean' && (
            <div
              className="rounded-lg p-2 flex items-start gap-1.5 text-xs"
              style={{
                background: analysis.closing_ready ? '#4ADE8022' : '#FBBF2422',
                color: analysis.closing_ready ? '#4ADE80' : '#FBBF24',
                border: `1px solid ${analysis.closing_ready ? '#4ADE8055' : '#FBBF2455'}`,
              }}
            >
              {analysis.closing_ready ? <Flame size={14} className="shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
              <div>
                <div className="font-semibold">{analysis.closing_ready ? 'Listo para cierre' : 'Todavía no cierres'}</div>
                {analysis.closing_reason && <div className="opacity-90 mt-0.5">{analysis.closing_reason}</div>}
              </div>
            </div>
          )}

          {analysis.next_step && (
            <div className="rounded-lg p-2 flex items-start gap-1.5 text-xs bg-surface border border-border">
              <Target size={13} className="text-cyan shrink-0 mt-0.5" />
              <div><span className="text-muted">Próximo paso:</span> <span className="text-ink">{analysis.next_step}</span></div>
            </div>
          )}

          {analysis.suggestions && analysis.suggestions.length > 0 && (
            <div className="space-y-1.5">
              {analysis.suggestions.map((s, i) => (
                <div key={i} className="rounded-lg p-2.5 bg-surface border border-border">
                  <div className="text-cyan text-[10px] font-semibold uppercase tracking-wide mb-1">{s.label}</div>
                  <div className="text-ink text-xs whitespace-pre-wrap">{s.text}</div>
                  {s.why && <div className="text-muted text-[10.5px] mt-1 italic">{s.why}</div>}
                  <button onClick={() => copy(s.text, i)} className="mt-1.5 text-[11px] font-semibold flex items-center gap-1" style={{ color: copiedIdx === i ? '#4ADE80' : '#5ECCFA' }}>
                    {copiedIdx === i ? <><Check size={11} /> Copiado</> : <><Copy size={11} /> Copiar</>}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="text-muted text-[10.5px]">
            Se creará en etapa <span className="text-ink font-semibold">{analysis.suggested_stage || 'Frío'}</span>
          </div>
        </div>
      )}

      <button
        onClick={createContact}
        disabled={creating || !name.trim()}
        className="rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 w-fit"
        style={{ background: '#4ADE8022', color: '#4ADE80', border: '1px solid #4ADE8055' }}
      >
        {creating ? <><Loader2 size={13} className="animate-spin" /> Creando...</> : <><UserPlus size={13} /> Crear ficha de contacto</>}
      </button>
    </div>
  );
}
