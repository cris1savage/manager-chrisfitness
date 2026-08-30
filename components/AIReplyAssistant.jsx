'use client';

import { useEffect, useState } from 'react';
import {
  Sparkles, Copy, Check, Loader2, Flame, AlertTriangle, Target, Save, Brain,
  Image as ImageIcon, X, Clock, PhoneCall, StickyNote, Plus,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useProfiles } from '@/components/ProfilesProvider';

const TABS = [
  { key: 'analizar', label: 'Analizar', icon: Sparkles },
  { key: 'historial', label: 'Historial', icon: Clock },
  { key: 'llamada', label: 'Preparar llamada', icon: PhoneCall },
];

function scoreColor(score) {
  if (score >= 76) return '#F87171';
  if (score >= 51) return '#FBBF24';
  if (score >= 26) return '#5ECCFA';
  return '#7C878B';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Construye el texto que se manda a la IA con TODO el historial, para que
// el análisis se base en el patrón real del lead, no en un fragmento suelto.
// Con meses de uso esto podría crecer sin límite, así que se queda con las
// entradas más recientes si hay demasiadas — evita que un lead muy antiguo
// vuelva a dar el mismo problema de respuestas cortadas.
const MAX_TIMELINE_ENTRIES = 30;
function buildTimelineText(timeline, profiles) {
  const trimmed = timeline.length > MAX_TIMELINE_ENTRIES ? timeline.slice(-MAX_TIMELINE_ENTRIES) : timeline;
  const omitted = timeline.length - trimmed.length;
  const parts = trimmed.map((e) => {
    const author = profiles?.[e.created_by]?.display_name || 'Chris';
    const label = e.entry_type === 'note' ? 'Nota de Chris' : 'Conversación';
    const p = [`[${fmtDate(e.created_at)} · ${author}] ${label}:\n${e.content}`];
    if (e.ai_summary) p.push(`Resumen IA de ese momento: ${e.ai_summary}`);
    return p.join('\n');
  });
  const text = parts.join('\n\n---\n\n');
  return omitted > 0 ? `(+ ${omitted} entradas más antiguas, no incluidas aquí por espacio)\n\n${text}` : text;
}

export default function AIReplyAssistant({ contact }) {
  const supabase = createClient();
  const profiles = useProfiles();
  const [tab, setTab] = useState('analizar');
  const [timeline, setTimeline] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(true);

  // --- Analizar ---
  const [newText, setNewText] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [coaching, setCoaching] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [coachText, setCoachText] = useState('');
  const [error, setError] = useState('');
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [saved, setSaved] = useState(false);

  // --- Historial (notas manuales) ---
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // --- Preparar llamada ---
  const [callPrep, setCallPrep] = useState(null);
  const [loadingCallPrep, setLoadingCallPrep] = useState(false);
  const [callPrepError, setCallPrepError] = useState('');

  const loadTimeline = async () => {
    const { data } = await supabase.from('lead_timeline').select('*').eq('contact_id', contact.id).order('created_at', { ascending: false });
    setTimeline(data || []);
    setLoadingTimeline(false);
  };

  useEffect(() => {
    loadTimeline();
    const channel = supabase
      .channel(`lead-timeline-${contact.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_timeline', filter: `contact_id=eq.${contact.id}` }, loadTimeline)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact.id]);

  const timelineText = buildTimelineText([...timeline].reverse(), profiles); // de más antigua a más reciente para la IA
  const hasInput = newText.trim() || image;

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    setImage({ dataUrl: URL.createObjectURL(file), base64, mediaType: file.type });
    e.target.value = '';
  };

  const callAI = async (mode) => {
    if (!hasInput) return;
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
          timelineText,
          conversationText: newText,
          imageBase64: image?.base64,
          imageMediaType: image?.mediaType,
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
    const transcribed = (analysis.transcribed_new_messages || newText).trim();
    const summaryParts = [
      analysis.lead_state ? `Estado: ${analysis.lead_state}` : null,
      analysis.lead_score != null ? `Score: ${analysis.lead_score}/100` : null,
      analysis.objective ? `Objetivo: ${analysis.objective}` : null,
      analysis.problem ? `Problema: ${analysis.problem}` : null,
      analysis.objections ? `Objeciones: ${analysis.objections}` : null,
      analysis.next_step ? `Próximo paso: ${analysis.next_step}` : null,
    ].filter(Boolean);

    // Guarda como una entrada NUEVA en el historial (no sobrescribe nada) —
    // así queda un registro real de cada conversación, no un borrón y cuenta nueva.
    await supabase.from('lead_timeline').insert({
      contact_id: contact.id,
      entry_type: 'conversation',
      content: transcribed || '(sin texto)',
      ai_summary: summaryParts.join(' · '),
    });

    // Y también actualiza el "estado actual" en la ficha, para el badge en la lista de Contactos.
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
      })
      .eq('id', contact.id);

    setNewText('');
    setImage(null);
    setSaved(true);
  };

  const applyStage = async () => {
    if (!analysis?.suggested_stage) return;
    await supabase.from('contacts').update({ stage: analysis.suggested_stage, stage_updated_at: new Date().toISOString() }).eq('id', contact.id);
  };

  const saveNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    await supabase.from('lead_timeline').insert({ contact_id: contact.id, entry_type: 'note', content: noteText.trim() });
    setNoteText('');
    setSavingNote(false);
  };

  const generateCallPrep = async () => {
    setLoadingCallPrep(true);
    setCallPrepError('');
    setCallPrep(null);
    try {
      const res = await fetch('/api/assistant/ai-closer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: contact.name,
          stage: contact.stage,
          source: contact.source,
          notes: contact.notes,
          timelineText,
          mode: 'call_prep',
        }),
      });
      const data = await res.json();
      if (!res.ok) setCallPrepError(data.error || 'Algo falló.');
      else setCallPrep(data);
    } catch {
      setCallPrepError('No se pudo conectar. Inténtalo de nuevo.');
    }
    setLoadingCallPrep(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
              style={{
                background: tab === t.key ? '#5ECCFA22' : 'transparent',
                border: `1px solid ${tab === t.key ? '#5ECCFA' : '#212729'}`,
                color: tab === t.key ? '#5ECCFA' : '#7C878B',
              }}
            >
              <Icon size={13} /> {t.label}
              {t.key === 'historial' && timeline.length > 0 && (
                <span className="text-[9.5px] px-1 rounded-full" style={{ background: '#7C878B33' }}>{timeline.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'analizar' && (
        <div className="rounded-lg p-3 bg-surfaceAlt border border-border space-y-2">
          {!loadingTimeline && timeline.length > 0 && (
            <div className="text-muted text-[10.5px] rounded-lg p-2 bg-surface border border-border">
              Este lead ya tiene {timeline.length} entrada{timeline.length !== 1 ? 's' : ''} en su historial — la IA las va a tener en cuenta al analizar.
            </div>
          )}
          {!loadingTimeline && timeline.length === 0 && (
            <div className="text-muted text-[10.5px]">Primera vez que se analiza este lead — sin historial todavía.</div>
          )}

          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Pega aquí los mensajes nuevos de Instagram..."
            rows={4}
            className="bg-surface border border-border text-ink rounded-lg px-2.5 py-2 text-xs w-full outline-none focus:border-cyan resize-y"
          />

          {image && (
            <div className="relative w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.dataUrl} alt="Captura adjunta" className="h-20 rounded-lg border border-border" />
              <button onClick={() => setImage(null)} className="absolute -top-1.5 -right-1.5 bg-surface border border-border rounded-full p-0.5 text-red">
                <X size={11} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => callAI('analyze')}
              disabled={loading || coaching || !hasInput}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-cyan text-[#00161C] flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? <><Loader2 size={13} className="animate-spin" /> Analizando...</> : 'Analizar conversación'}
            </button>
            <button
              onClick={() => callAI('coach')}
              disabled={loading || coaching || !hasInput}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: 'transparent', color: '#A78BFA', border: '1px solid #A78BFA55' }}
            >
              {coaching ? <><Loader2 size={13} className="animate-spin" /> Pensando...</> : <><Brain size={13} /> ¿Qué harías tú?</>}
            </button>
            <label className="rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 text-muted border border-border cursor-pointer">
              <ImageIcon size={13} /> Adjuntar captura
              <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
            </label>
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
                <span className="text-[10.5px] font-semibold uppercase px-2 py-1 rounded" style={{ background: '#5ECCFA22', color: '#5ECCFA' }}>
                  {analysis.lead_state}
                </span>
                {analysis.lead_score != null && (
                  <span className="text-[10.5px] font-semibold px-2 py-1 rounded" style={{ background: `${scoreColor(analysis.lead_score)}22`, color: scoreColor(analysis.lead_score) }}>
                    Lead score: {analysis.lead_score}/100
                  </span>
                )}
                {analysis.probability && <span className="text-[10.5px] text-muted">Probabilidad: {analysis.probability}</span>}
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
                      <button onClick={() => copy(s.text, i)} className="mt-1.5 text-[11px] font-semibold flex items-center gap-1" style={{ color: copiedIdx === i ? '#4ADE80' : '#5ECCFA' }}>
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
                  {saved ? <><Check size={13} /> Guardado en el historial</> : <><Save size={13} /> Guardar en el historial</>}
                </button>
                {analysis.suggested_stage && analysis.suggested_stage !== contact.stage && (
                  <button onClick={applyStage} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted border border-border">
                    Mover a etapa: {analysis.suggested_stage}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'historial' && (
        <div className="space-y-2">
          <div className="rounded-lg p-3 bg-surfaceAlt border border-border space-y-2">
            <div className="text-muted text-[10.5px] uppercase tracking-wide flex items-center gap-1.5"><StickyNote size={12} /> Añadir nota — qué hiciste, qué decidiste</div>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Ej. Le llamé, quedamos en que lo piensa hasta el viernes. Le insistí en el tema de flexibilidad de horarios..."
              rows={2}
              className="bg-surface border border-border text-ink rounded-lg px-2.5 py-2 text-xs w-full outline-none focus:border-cyan resize-y"
            />
            <button
              onClick={saveNote}
              disabled={savingNote || !noteText.trim()}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: '#4ADE8022', color: '#4ADE80', border: '1px solid #4ADE8055' }}
            >
              {savingNote ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Guardar nota
            </button>
          </div>

          {loadingTimeline && <div className="text-muted text-xs text-center py-4">Cargando…</div>}
          {!loadingTimeline && timeline.length === 0 && (
            <div className="text-muted text-xs text-center py-4">Sin historial todavía para este lead.</div>
          )}
          {timeline.map((e) => (
            <div key={e.id} className="rounded-lg p-2.5 bg-surfaceAlt border border-border">
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-[9.5px] font-semibold uppercase px-1.5 py-0.5 rounded flex items-center gap-1"
                  style={{ background: e.entry_type === 'note' ? '#A78BFA22' : '#5ECCFA22', color: e.entry_type === 'note' ? '#A78BFA' : '#5ECCFA' }}
                >
                  {e.entry_type === 'note' ? <StickyNote size={9} /> : <Sparkles size={9} />}
                  {e.entry_type === 'note' ? 'Nota' : 'Conversación'}
                </span>
                <span className="text-muted text-[10px]">{fmtDate(e.created_at)} · {profiles?.[e.created_by]?.display_name || 'Chris'}</span>
              </div>
              <div className="text-ink text-xs whitespace-pre-wrap">{e.content}</div>
              {e.ai_summary && <div className="text-muted text-[10.5px] mt-1.5 pt-1.5 border-t border-border italic">{e.ai_summary}</div>}
            </div>
          ))}
        </div>
      )}

      {tab === 'llamada' && (
        <div className="space-y-2">
          {contact.stage === 'Llamada agendada' && (
            <div className="text-cyan text-[10.5px] rounded-lg p-2 bg-cyan/10 border border-cyan/30">Este lead está en "Llamada agendada" — buen momento para preparar la llamada.</div>
          )}
          <button
            onClick={generateCallPrep}
            disabled={loadingCallPrep}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-cyan text-[#00161C] flex items-center gap-1.5 disabled:opacity-50"
          >
            {loadingCallPrep ? <><Loader2 size={13} className="animate-spin" /> Preparando...</> : <><PhoneCall size={13} /> Generar preparación de llamada</>}
          </button>
          {callPrepError && <div className="text-red text-xs">{callPrepError}</div>}

          {callPrep && (
            <div className="space-y-2 pt-1">
              {callPrep.summary && (
                <div className="rounded-lg p-2.5 bg-surfaceAlt border border-border">
                  <div className="text-muted text-[9.5px] uppercase tracking-wide mb-1">Resumen</div>
                  <div className="text-ink text-xs">{callPrep.summary}</div>
                </div>
              )}
              {callPrep.opening_line && (
                <div className="rounded-lg p-2.5 bg-surface border border-border">
                  <div className="text-cyan text-[9.5px] uppercase tracking-wide mb-1">Cómo arrancar</div>
                  <div className="text-ink text-xs italic">"{callPrep.opening_line}"</div>
                </div>
              )}
              {callPrep.angles?.length > 0 && (
                <div className="rounded-lg p-2.5 bg-surfaceAlt border border-border">
                  <div className="text-muted text-[9.5px] uppercase tracking-wide mb-1.5">Ángulos a tratar</div>
                  <ul className="space-y-1">
                    {callPrep.angles.map((a, i) => <li key={i} className="text-ink text-xs flex gap-1.5"><span className="text-cyan">•</span> {a}</li>)}
                  </ul>
                </div>
              )}
              {callPrep.talking_points?.length > 0 && (
                <div className="rounded-lg p-2.5 bg-surfaceAlt border border-border">
                  <div className="text-muted text-[9.5px] uppercase tracking-wide mb-1.5">Puntos a mencionar</div>
                  <ul className="space-y-1">
                    {callPrep.talking_points.map((a, i) => <li key={i} className="text-ink text-xs flex gap-1.5"><span className="text-cyan">•</span> {a}</li>)}
                  </ul>
                </div>
              )}
              {callPrep.objections_to_expect && (
                <div className="rounded-lg p-2.5 flex items-start gap-1.5 text-xs" style={{ background: '#FBBF2422', color: '#FBBF24', border: '1px solid #FBBF2455' }}>
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <div><span className="font-semibold">Objeciones esperables:</span> {callPrep.objections_to_expect}</div>
                </div>
              )}
              {callPrep.avoid && (
                <div className="rounded-lg p-2.5 flex items-start gap-1.5 text-xs" style={{ background: '#F8717122', color: '#F87171', border: '1px solid #F8717155' }}>
                  <X size={13} className="shrink-0 mt-0.5" />
                  <div><span className="font-semibold">Evita:</span> {callPrep.avoid}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
