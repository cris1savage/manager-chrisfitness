'use client';

import { useEffect, useMemo, useState } from 'react';
import { Trash2, MessageSquare, Check, RotateCcw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, AuthorBadge } from '@/components/ui';
import { useProfiles } from '@/components/ProfilesProvider';
import { CONTENT_TYPES, PRODUCTION_STATUSES } from '@/lib/config';
import CommentThread from '@/components/CommentThread';

const STAGES = Object.keys(PRODUCTION_STATUSES);

export default function VideosClient() {
  const supabase = useMemo(() => createClient(), []);
  const profiles = useProfiles();
  const [videos, setVideos] = useState([]);
  const [scripts, setScripts] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Todos');
  const [showUploaded, setShowUploaded] = useState(false);
  const [openThread, setOpenThread] = useState(null);

  const load = async () => {
    const [videosRes, scriptsRes] = await Promise.all([
      supabase.from('calendar_entries').select('*').not('script_id', 'is', null).order('date', { ascending: true }),
      supabase.from('scripts').select('id, title'),
    ]);
    setVideos(videosRes.data || []);
    const map = {};
    (scriptsRes.data || []).forEach((s) => (map[s.id] = s.title));
    setScripts(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('videos-pipeline-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_entries' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = async (id, key, value) => {
    setVideos((v) => v.map((x) => (x.id === id ? { ...x, [key]: value } : x)));
    await supabase.from('calendar_entries').update({ [key]: value }).eq('id', id);
  };

  const markUploaded = async (id) => update(id, 'status', 'hecho');
  const undoUploaded = async (id) => update(id, 'status', 'pendiente');

  const del = async (id) => {
    setVideos((v) => v.filter((x) => x.id !== id));
    await supabase.from('calendar_entries').delete().eq('id', id);
  };

  const notUploaded = videos.filter((v) => v.status !== 'hecho');
  const uploaded = videos.filter((v) => v.status === 'hecho');

  const counts = { Todos: notUploaded.length };
  STAGES.forEach((s) => { counts[s] = notUploaded.filter((v) => (v.production_status || 'Guion') === s).length; });

  const pool = showUploaded ? uploaded : notUploaded;
  const visible = showUploaded ? pool : (filter === 'Todos' ? pool : pool.filter((v) => (v.production_status || 'Guion') === filter));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-ink text-[22px] tracking-wide">VÍDEOS</h2>
        <div className="text-muted text-xs">
          Todos los vídeos de tus guiones en un solo sitio. Muévelos de fase con el desplegable; al marcarlos
          subidos, desaparecen de aquí (pero siguen contando en tu racha y estadísticas).
        </div>
      </div>

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
                      {meta.label} · {new Date(v.date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      {scripts[v.script_id] && <> · guion: {scripts[v.script_id]}</>}
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

                <input
                  value={v.notes || ''}
                  onChange={(e) => update(v.id, 'notes', e.target.value)}
                  placeholder="Notas rápidas..."
                  className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-xs w-full outline-none focus:border-cyan"
                />
              </div>
              {openThread === v.id && (
                <div className="px-4 pb-4">
                  <CommentThread table="calendar_entries" entityId={v.id} />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
