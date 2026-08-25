'use client';

import { useState } from 'react';
import { Sparkles, Copy, Check, Loader2, Flame, AlertTriangle, Target, Save, Brain } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

function scoreColor(score) {
  if (score >= 76) return '#F87171';
  if (score >= 51) return '#FBBF24';
  if (score >= 26) return '#5ECCFA';
  return '#7C878B';
}

function priorAnalysisText(contact) {
  if (!contact.ai_lead_state) return '';
  const parts = [
    `Estado: ${contact.ai_lead_state}`,
    contact.ai_lead_score != null ? `Score: ${contact.ai_lead_score}/100` : null,
    contact.ai_objective ? `Objetivo: ${contact.ai_objective}` : null,
    contact.ai_problem ? `Problema: ${contact.ai_problem}` : null,
    contact.ai_objections ? `Objeciones: ${contact.ai_objections}` : null,
    contact.ai_next_step ? `Próximo paso: ${contact.ai_next_step}` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

export default function AIReplyAssistant({ contact }) {
  const [message, setMessage] = useState(contact.ai_last_conversation || '');
  const [loading, setLoading] = useState(false);
  const [coaching, setCoaching] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [coachText, setCoachText] = useState('');
  const [error, setError] = useState('');
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [saved, setSaved] = useState(false);

  const priorText = priorAnalysisText(contact);

  const callAI = async (mode) => {
    if (!message.trim()) return;
    if (mode === 'coach') setCoaching(true);
    else setLoading(true);
    setError('');
    setSaved(false);
    if (mode !== 'coach') setAnalysis(null);
    try {
      const res = await fetch('/api/assistant/ai-closer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: contact.name,
          stage: contact.stage,
          source: contact.source,
          notes: contact.notes,
          priorAnalysis: priorText,
          conversationText: message,
          mode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Algo falló.');
      } else if (mode === 'coach') {
        setCoachText(data.analysis || '');
      } else {
        setAnalysis(data);
      }
    } catch {
      setError('No se pudo conectar. Inténtalo de nuevo.');
    }
    if (mode === 'coach') setCoaching(false);
    else setLoading(false);
  };

  const copy = async (text, i) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {}
  };

  const saveToLead = async () => {
    if (!analysis) return;
    const supabase = createClient();
    await supabase
      .from('contacts')
      .update({
        ai_lead_state: analysis.lead_state || null,
        ai_lead_score: analysis.lead_score ?? null,
        ai_score_reason: analysis.score_reason || null,
        ai_objective: analysis.objective || null,
        ai_problem: analysis.problem || null,
        ai_situation: analysis.situation || null,
        ai_objections: analysis.objections || null,
        ai_next_step: analysis.next_step || null,
        ai_probability: analysis.probability || null,
        ai_last_analysis_at: new Date().toISOString(),
        ai_last_conversation: message,
      })
      .eq('id', contact.id);
    setSaved(true);
  };

  const applyStage = async () => {
    if (!analysis?.suggested_stage) return;
    const supabase = createClient();
    await supabase.from('contacts').update({ stage: analysis.suggested_stage, stage_updated_at: new Date().toISOString() }).eq('id', contact.id);
  };

  return (
    <div className="rounded-lg p-3 bg-surfaceAlt border border-border space-y-2">
      <div className="flex items-center gap-1.5 text-cyan text-xs font-semibold">
        <Sparkles size={14} /> AI Closer
      </div>

      {priorText && !analysis && (
        <div className="text-muted text-[10.5px] rounded-lg p-2 bg-surface border border-border">
          <span className="font-semibold">Última ficha guardada:</span> {priorText}
        </div>
      )}

      {contact.ai_last_conversation && (
        <div className="text-muted text-[10px]">Conversación guardada de esta ficha — la puedes editar o pegar la versión actualizada.</div>
      )}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Pega aquí la conversación de Instagram (los últimos mensajes)..."
        rows={4}
        className="bg-surface border border-border text-ink rounded-lg px-2.5 py-2 text-xs w-full outline-none focus:border-cyan resize-y"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => callAI('analyze')}
          disabled={loading || coaching || !message.trim()}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-cyan text-[#00161C] flex items-center gap-1.5 disabled:opacity-50"
        >
          {loading ? <><Loader2 size={13} className="animate-spin" /> Analizando...</> : 'Analizar conversación'}
        </button>
        <button
          onClick={() => callAI('coach')}
          disabled={loading || coaching || !message.trim()}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
          style={{ background: 'transparent', color: '#A78BFA', border: '1px solid #A78BFA55' }}
        >
          {coaching ? <><Loader2 size={13} className="animate-spin" /> Pensando...</> : <><Brain size={13} /> ¿Qué harías tú?</>}
        </button>
      </div>
      {error && <div className="text-red text-xs">{error}</div>}

      {coachText && (
        <div className="rounded-lg p-2.5 bg-surface border border-border">
          <div className="text-[#A78BFA] text-[10px] font-semibold uppercase tracking-wide mb-1 flex items-center gap-1"><Brain size={11} /> Modo coach</div>
          <div className="text-ink text-xs whitespace-pre-wrap leading-relaxed">{coachText}</div>
        </div>
      )}

      {analysis && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[10.5px] font-semibold uppercase px-2 py-1 rounded"
              style={{ background: '#5ECCFA22', color: '#5ECCFA' }}
            >
              {analysis.lead_state}
            </span>
            {analysis.lead_score != null && (
              <span
                className="text-[10.5px] font-semibold px-2 py-1 rounded"
                style={{ background: `${scoreColor(analysis.lead_score)}22`, color: scoreColor(analysis.lead_score) }}
              >
                Lead score: {analysis.lead_score}/100
              </span>
            )}
            {analysis.probability && (
              <span className="text-[10.5px] text-muted">Probabilidad: {analysis.probability}</span>
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

          {(analysis.objective || analysis.problem || analysis.situation || analysis.objections) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {analysis.objective && (
                <div className="rounded-lg p-2 bg-surface border border-border">
                  <div className="text-muted text-[9.5px] uppercase tracking-wide">Objetivo</div>
                  <div className="text-ink text-[11px]">{analysis.objective}</div>
                </div>
              )}
              {analysis.problem && (
                <div className="rounded-lg p-2 bg-surface border border-border">
                  <div className="text-muted text-[9.5px] uppercase tracking-wide">Problema</div>
                  <div className="text-ink text-[11px]">{analysis.problem}</div>
                </div>
              )}
              {analysis.situation && (
                <div className="rounded-lg p-2 bg-surface border border-border">
                  <div className="text-muted text-[9.5px] uppercase tracking-wide">Situación</div>
                  <div className="text-ink text-[11px]">{analysis.situation}</div>
                </div>
              )}
              {analysis.objections && (
                <div className="rounded-lg p-2 bg-surface border border-border">
                  <div className="text-muted text-[9.5px] uppercase tracking-wide">Objeciones</div>
                  <div className="text-ink text-[11px]">{analysis.objections}</div>
                </div>
              )}
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
                  <button
                    onClick={() => copy(s.text, i)}
                    className="mt-1.5 text-[11px] font-semibold flex items-center gap-1"
                    style={{ color: copiedIdx === i ? '#4ADE80' : '#5ECCFA' }}
                  >
                    {copiedIdx === i ? <><Check size={11} /> Copiado</> : <><Copy size={11} /> Copiar</>}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button
              onClick={saveToLead}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"
              style={{ background: saved ? '#4ADE8022' : '#5ECCFA22', color: saved ? '#4ADE80' : '#5ECCFA', border: `1px solid ${saved ? '#4ADE8055' : '#5ECCFA55'}` }}
            >
              {saved ? <><Check size={13} /> Guardado en la ficha</> : <><Save size={13} /> Guardar en la ficha</>}
            </button>
            {analysis.suggested_stage && analysis.suggested_stage !== contact.stage && (
              <button
                onClick={applyStage}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted border border-border"
              >
                Mover a etapa: {analysis.suggested_stage}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
