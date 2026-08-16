'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, MessageSquare, Check, RotateCcw, CalendarPlus, CalendarX } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, AuthorBadge } from '@/components/ui';
import { useProfiles } from '@/components/ProfilesProvider';
import { CONTENT_TYPES, PRODUCTION_STATUSES, todayISO } from '@/lib/config';
import CommentThread from '@/components/CommentThread';

const STAGES = Object.keys(PRODUCTION_STATUSES);
const SCHEDULABLE = ['Editado', 'Programado'];

export default function VideosClient() {
  const supabase = useMemo(() => createClient(), []);
  const profiles = useProfiles();
  const [videos, setVideos] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Todos');
  const [showUploaded, setShowUploaded] = useState(false);
  const [openThread, setOpenThread] = useState(null);
  const [schedulingId, setSchedulingId] = useState(null);
  const [scheduleDate, setScheduleDate] = useState(todayISO());

  const emptyForm = { title: '', type: 'reel_ig', production_status: 'Guion', script_id: '' };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const [videosRes, scriptsRes] = await Promise.all([
      supabase.from('videos').select('*').order('created_at', { ascending: false }),
      supabase.from('scripts').select('id, title'),
    ]);
    setVideos(videosRes.data || []);
    setScripts(scriptsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('videos-pipeline-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'videos' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scriptTitle = (id) => scripts.find((s) => s.id === id)?.title;

  const add = async () => {
    if (!form.title.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('videos').insert({
      title: form.title.trim(),
      type: form.type,
      production_status: form.production_status,
      script_id: form.script_id || null,
      created_by: userData.user.id,
    });
    setForm(emptyForm);
    load();
  };

  const update = async (id, key, value) => {
    setVideos((v) => v.map((x) => (x.id === id ? { ...x, [key]: value } : x)));
    await supabase.from('videos').update({ [key]: value }).eq('id', id);
  };

  const markUploaded = async (id) => {
    await supabase.from('videos').update({ uploaded: true, uploaded_at: new Date().toISOString() }).eq('id', id);
    load();
  };
  const undoUploaded = async (id) => {
    await supabase.from('videos').update({ uploaded: false, uploaded_at: null }).eq('id', id);
    load();
  };

  const del = async (id) => {
    setVideos((v) => v.filter((x) => x.id !== id));
    await supabase.from('videos').delete().eq('id', id);
  };

  const scheduleToCalendar = async (v) => {
    const { data: userData } = await supabase.auth.getUser();
    const { data: entry } = await supabase
      .from('calendar_entries')
      .insert({
        title: v.title, type: v.type, date: scheduleDate, status: 'pendiente',
        script_id: v.script_id, notes: v.notes, created_by: userData.user.id,
      })
      .select()
      .single();
    if (entry) {
      await supabase.from('videos').update({ calendar_entry_id: entry.id, production_status: 'Programado' }).eq('id', v.id);
    }
    setSchedulingId(null);
    load();
  };

  const unscheduleFromCalendar = async (v) => {
    if (v.calendar_entry_id) await supabase.from('calendar_entries').delete().eq('id', v.calendar_entry_id);
    await supabase.from('videos').update({ calendar_entry_id: null }).eq('id', v.id);
    load();
  };

  const notUploaded = videos.filter((v) => !v.uploaded);
  const uploaded = videos.filter((v) => v.uploaded);

  const counts = { Todos: notUploaded.length };
  STAGES.forEach((s) => { counts[s] = notUploaded.filter((v) => (v.production_status || 'Guion') === s).length; });

  const pool = showUploaded ? uploaded : notUploaded;
  const visible = showUploaded ? pool : (filter === 'Todos' ? pool : pool.filter((v) => (v.production_status || 'Guion') === filter));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-ink text-[22px] tracking-wide">VÍDEOS</h2>
        <div className="text-muted text-xs">
          Todos tus vídeos en un solo sitio, vengan de un guion o sueltos. No aparecen en el Calendario. Al marcarlos
          subidos, desaparecen de la vista de trabajo (pero siguen contando para tu racha y estadísticas).
        </div>
      </div>

      {/* Añadir vídeo suelto */}
      <Card className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end sm:flex-wrap">
          <div className="w-full sm:flex-1 sm:min-w-[180px]">
            <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Título</div>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="Ej. Curl de bíceps - variante 1"
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-full outline-none focus:border-cyan"
            />
          </div>
          <div className="w-full sm:flex-1 sm:min-w-[140px]">
            <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Tipo</div>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-full outline-none focus:border-cyan"
            >
              {Object.entries(CONTENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="w-full sm:flex-1 sm:min-w-[140px]">
            <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Fase inicial</div>
            <select
              value={form.production_status}
              onChange={(e) => setForm({ ...form, production_status: e.target.value })}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-full outline-none focus:border-cyan"
            >
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="w-full sm:flex-1 sm:min-w-[160px]">
            <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Guion (opcional)</div>
            <select
              value={form.script_id}
              onChange={(e) => setForm({ ...form, script_id: e.target.value })}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-full outline-none focus:border-cyan"
            >
              <option value="">Sin guion</option>
              {scripts.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
          <button onClick={add} className="rounded-lg px-3 py-2 flex items-center justify-center gap-1 font-semibold text-sm bg-cyan text-[#00161C] shrink-0 w-full sm:w-auto">
            <Plus size={16} /> Añadir
          </button>
        </div>
      </Card>

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1.5" style={{ minWidth: 'max-content' }}>
          <button
            onClick={() => setShowUploaded(false)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0"
            style={{
              background: !showUploaded ? '#5ECCFA22' : 'transparent',
              border: `1px solid ${!showUploaded ? '#5ECCFA' : '#212729'}`,
              color: !showUploaded ? '#5ECCFA' : '#7C878B',
            }}
          >
            En curso <span className="opacity-70">{notUploaded.length}</span>
          </button>
          <button
            onClick={() => setShowUploaded(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0"
            style={{
              background: showUploaded ? '#4ADE8022' : 'transparent',
              border: `1px solid ${showUploaded ? '#4ADE80' : '#212729'}`,
              color: showUploaded ? '#4ADE80' : '#7C878B',
            }}
          >
            Subidos <span className="opacity-70">{uploaded.length}</span>
          </button>
        </div>
      </div>

      {!showUploaded && (
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-1.5" style={{ minWidth: 'max-content' }}>
            {['Todos', ...STAGES].map((s) => {
              const color = PRODUCTION_STATUSES[s]?.color || '#5ECCFA';
              return (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0"
                  style={{
                    background: filter === s ? `${color}22` : 'transparent',
                    border: `1px solid ${filter === s ? color : '#212729'}`,
                    color: filter === s ? color : '#7C878B',
                  }}
                >
                  {s} <span className="opacity-70">{counts[s] || 0}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {loading && <Card className="text-center py-8 text-muted">Cargando…</Card>}
        {!loading && visible.length === 0 && (
          <Card className="text-center py-8 text-muted">
            {showUploaded ? 'Todavía no has subido ningún vídeo.' : 'Nada en esta fase todavía.'}
          </Card>
        )}
        {visible.map((v) => {
          const meta = CONTENT_TYPES[v.type] || CONTENT_TYPES.reel_ig;
          const stageColor = PRODUCTION_STATUSES[v.production_status]?.color || '#7C878B';
          return (
            <Card key={v.id} className="!p-0" style={{ borderColor: showUploaded ? '#4ADE8055' : `${stageColor}55` }}>
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <input
                      value={v.title}
                      onChange={(e) => update(v.id, 'title', e.target.value)}
                      className="bg-transparent text-ink font-bold text-sm outline-none w-full"
                    />
                    <div className="text-muted text-[11px]">
                      {meta.label}
                      {scriptTitle(v.script_id) && <> · guion: {scriptTitle(v.script_id)}</>}
                      {v.calendar_entry_id && <span style={{ color: '#5ECCFA' }}> · en el Calendario</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <AuthorBadge profile={profiles?.[v.created_by]} />
                    <button
                      onClick={() => setOpenThread(openThread === v.id ? null : v.id)}
                      className={`p-1.5 rounded-lg ${openThread === v.id ? 'text-cyan' : 'text-muted'}`}
                      title="Notas de este vídeo"
                    >
                      <MessageSquare size={16} />
                    </button>
                    <button onClick={() => del(v.id)} className="p-1.5 rounded-lg text-red"><Trash2 size={16} /></button>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {!showUploaded && (
                    <>
                      <span className="text-muted text-[10.5px] uppercase tracking-wide">Fase:</span>
                      <select
                        value={v.production_status || 'Guion'}
                        onChange={(e) => update(v.id, 'production_status', e.target.value)}
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold outline-none"
                        style={{ background: `${stageColor}1A`, color: stageColor, border: `1px solid ${stageColor}55` }}
                      >
                        {STAGES.map((s) => <option key={s} value={s} style={{ color: '#000' }}>{s}</option>)}
                      </select>
                      <button
                        onClick={() => markUploaded(v.id)}
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold flex items-center gap-1"
                        style={{ background: '#4ADE8022', color: '#4ADE80', border: '1px solid #4ADE8055' }}
                      >
                        <Check size={13} /> Marcar subido
                      </button>
                      {SCHEDULABLE.includes(v.production_status) && !v.calendar_entry_id && (
                        <button
                          onClick={() => { setSchedulingId(schedulingId === v.id ? null : v.id); setScheduleDate(todayISO()); }}
                          className="rounded-lg px-2.5 py-1 text-xs font-semibold flex items-center gap-1"
                          style={{ background: '#5ECCFA22', color: '#5ECCFA', border: '1px solid #5ECCFA55' }}
                        >
                          <CalendarPlus size={13} /> Programar en Calendario
                        </button>
                      )}
                      {v.calendar_entry_id && (
                        <button
                          onClick={() => unscheduleFromCalendar(v)}
                          className="rounded-lg px-2.5 py-1 text-xs font-semibold flex items-center gap-1 text-muted border border-border"
                        >
                          <CalendarX size={13} /> Quitar del Calendario
                        </button>
                      )}
                    </>
                  )}
                  {showUploaded && (
                    <button
                      onClick={() => undoUploaded(v.id)}
                      className="rounded-lg px-2.5 py-1 text-xs font-semibold flex items-center gap-1 text-muted border border-border"
                    >
                      <RotateCcw size={13} /> Deshacer
                    </button>
                  )}
                </div>

                {schedulingId === v.id && (
                  <div className="flex items-center gap-2 rounded-lg p-2.5 bg-surfaceAlt border border-border">
                    <span className="text-ink text-xs">Fecha:</span>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="bg-surface border border-border text-ink rounded-lg px-2 py-1 text-xs outline-none focus:border-cyan"
                    />
                    <button onClick={() => scheduleToCalendar(v)} className="rounded-lg px-2.5 py-1 text-xs font-semibold bg-cyan text-[#00161C]">
                      Confirmar
                    </button>
                    <button onClick={() => setSchedulingId(null)} className="text-muted text-xs">Cancelar</button>
                  </div>
                )}

                <input
                  value={v.notes || ''}
                  onChange={(e) => update(v.id, 'notes', e.target.value)}
                  placeholder="Notas rápidas..."
                  className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-xs w-full outline-none focus:border-cyan"
                />
              </div>
              {openThread === v.id && (
                <div className="px-4 pb-4">
                  <CommentThread table="videos" entityId={v.id} />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
