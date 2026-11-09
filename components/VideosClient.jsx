'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Trash2, MessageSquare, Check, ChevronLeft, ChevronDown, ChevronUp, ExternalLink, CalendarPlus, Search, Clapperboard,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, AuthorBadge } from '@/components/ui';
import { useProfiles } from '@/components/ProfilesProvider';
import { todayISO } from '@/lib/config';
import { useCategories } from '@/components/CategoriesProvider';
import CommentThread from '@/components/CommentThread';
import { syncToGoogle } from '@/lib/googleSync';

// Tablero de producción. Cada columna es una fase; en base de datos se
// guarda igual que siempre (production_status + uploaded), solo cambia cómo
// se ve: Guion = Recámara, Grabado = Por editar, uploaded = Publicado.
const COLUMNS = [
  { key: 'Guion', label: 'Recámara', sub: 'Sin grabar', color: '#FB923C', next: 'Marcar grabado', short: 'Grabado' },
  { key: 'Grabado', label: 'Por editar', sub: 'Grabado', color: '#5ECCFA', next: 'Marcar editado', short: 'Editado' },
  { key: 'Editado', label: 'Editado', sub: 'Listo para publicar', color: '#FBBF24', next: 'Programar', short: 'Programar' },
  { key: 'Programado', label: 'Programado', sub: 'En el calendario', color: '#A78BFA', next: 'Marcar publicado', short: 'Publicado' },
  { key: 'Publicado', label: 'Publicado', sub: 'Ya subido', color: '#4ADE80', next: null },
];
const COL = Object.fromEntries(COLUMNS.map((c, i) => [c.key, { ...c, index: i }]));
const columnOf = (v) => (v.uploaded ? 'Publicado' : COL[v.production_status] ? v.production_status : 'Guion');
const hhmm = (t) => (t ? String(t).slice(0, 5) : '');
const fmtDate = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });

function VideoCard({ v, script, entry, meta, profiles, actions }) {
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('18:00');
  const col = COL[columnOf(v)];

  const primary = () => {
    if (col.key === 'Editado') return setScheduling(!scheduling);
    actions.forward(v);
  };

  return (
    <div className="rounded-xl bg-surface border border-border overflow-hidden" style={{ borderLeft: `3px solid ${col.color}` }}>
      <div className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <button onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left" aria-expanded={open}>
            <div className="text-ink text-[13.5px] font-semibold leading-snug">{v.title}</div>
            <div className="text-[11px] mt-0.5" style={{ color: meta.color }}>{meta.label}</div>
            {entry && !v.uploaded && (
              <div className="text-cyan text-[11px] font-semibold first-letter:uppercase">{fmtDate(entry.date)}{entry.publish_time ? ` · ${hhmm(entry.publish_time)}` : ''}</div>
            )}
            {v.uploaded && v.uploaded_at && <div className="text-muted text-[11px]">Subido el {fmtDate(v.uploaded_at.slice(0, 10))}</div>}
          </button>
          <button onClick={() => setOpen(!open)} className="text-muted p-0.5 shrink-0" aria-label={open ? 'Cerrar detalles' : 'Ver guion y detalles'}>
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {col.index > 0 && (
            <button onClick={() => actions.back(v)} className="h-8 w-8 rounded-lg border border-border text-muted flex items-center justify-center hover:text-ink shrink-0" aria-label={`Volver a ${COLUMNS[col.index - 1].label}`} title={`Volver a ${COLUMNS[col.index - 1].label}`}>
              <ChevronLeft size={15} />
            </button>
          )}
          {col.next ? (
            <button
              onClick={primary}
              className="h-8 min-w-0 flex-1 rounded-lg px-1.5 text-xs font-bold flex items-center justify-center gap-1.5"
              style={{ background: `${COLUMNS[col.index + 1].color}22`, color: COLUMNS[col.index + 1].color, border: `1px solid ${COLUMNS[col.index + 1].color}55` }}
            >
              {col.key === 'Editado' ? <CalendarPlus size={13} className="shrink-0 lg:hidden" /> : <Check size={13} className="shrink-0 lg:hidden" />}
              <span className="truncate lg:hidden">{col.next}</span><span className="truncate hidden lg:inline" title={col.next}>{col.short}</span>
            </button>
          ) : <div className="flex-1" />}
          {v.reference_url && (
            <a href={v.reference_url} target="_blank" rel="noreferrer" className="h-8 w-8 rounded-lg border border-border text-muted flex items-center justify-center hover:text-cyan shrink-0" aria-label="Ver reel de referencia" title="Ver reel de referencia">
              <ExternalLink size={14} />
            </a>
          )}
        </div>

        {scheduling && (
          <div className="rounded-lg p-2.5 bg-surfaceAlt border border-border space-y-2">
            <div className="text-ink text-xs font-semibold">¿Cuándo se publica?</div>
            <div className="flex gap-2">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Fecha" className="flex-1 min-w-0 bg-surface border border-border text-ink rounded-lg px-2 py-1.5 text-xs outline-none focus:border-cyan" />
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Hora" className="w-[92px] bg-surface border border-border text-ink rounded-lg px-2 py-1.5 text-xs outline-none focus:border-cyan" />
            </div>
            <div className="flex gap-2">
              <button onClick={async () => { await actions.schedule(v, date, time); setScheduling(false); }} className="rounded-lg px-3 py-1.5 text-xs font-bold bg-cyan text-[#00161C]">Programar</button>
              <button onClick={() => setScheduling(false)} className="text-muted text-xs px-2">Cancelar</button>
            </div>
          </div>
        )}

        {open && (
          <div className="space-y-2 pt-1">
            {script?.content ? (
              <div className="rounded-lg bg-surfaceAlt border border-border p-3 text-[12.5px] leading-relaxed text-ink max-h-64 overflow-y-auto [&_p]:mb-2 [&_p:last-child]:mb-0">
                <div className="text-muted text-[10.5px] uppercase tracking-wide mb-1.5">Guion</div>
                <div dangerouslySetInnerHTML={{ __html: script.content }} />
              </div>
            ) : (
              <div className="text-muted text-xs">Sin guion vinculado.</div>
            )}
            <div className="grid grid-cols-1 gap-2">
              <input
                defaultValue={v.title}
                onBlur={(e) => e.target.value.trim() && e.target.value !== v.title && actions.update(v.id, { title: e.target.value.trim() })}
                aria-label="Título"
                className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-cyan"
              />
              <input
                defaultValue={v.reference_url || ''}
                onBlur={(e) => e.target.value !== (v.reference_url || '') && actions.update(v.id, { reference_url: e.target.value.trim() || null })}
                placeholder="Enlace al reel de referencia"
                aria-label="Enlace de referencia"
                className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-cyan"
              />
              <input
                defaultValue={v.notes || ''}
                onBlur={(e) => e.target.value !== (v.notes || '') && actions.update(v.id, { notes: e.target.value })}
                placeholder="Notas para la edición (música, cortes, texto en pantalla…)"
                aria-label="Notas"
                className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-cyan"
              />
            </div>
            <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
              <AuthorBadge profile={profiles?.[v.created_by]} />
              <button onClick={() => setThread(!thread)} className={`flex items-center gap-1 text-xs ${thread ? 'text-cyan' : 'text-muted'}`}>
                <MessageSquare size={13} /> Comentarios
              </button>
              <button
                onClick={() => window.confirm(`¿Borrar «${v.title}»?`) && actions.remove(v)}
                className="ml-auto flex items-center gap-1 text-xs text-red"
              >
                <Trash2 size={13} /> Borrar
              </button>
            </div>
            {thread && <CommentThread table="videos" entityId={v.id} />}
          </div>
        )}
      </div>
    </div>
  );
}

export default function VideosClient() {
  const supabase = useMemo(() => createClient(), []);
  const profiles = useProfiles();
  const { list: categoriesList, map: categoriesMap } = useCategories();
  const [videos, setVideos] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mobileCol, setMobileCol] = useState('Grabado');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: '', type: '', reference_url: '', production_status: 'Guion' });
  const [error, setError] = useState('');

  const load = async () => {
    const [videosRes, scriptsRes] = await Promise.all([
      supabase.from('videos').select('*').order('created_at', { ascending: true }),
      supabase.from('scripts').select('id, title, content'),
    ]);
    const vids = videosRes.data || [];
    setVideos(vids);
    setScripts(scriptsRes.data || []);
    const ids = vids.map((v) => v.calendar_entry_id).filter(Boolean);
    if (ids.length) {
      const { data } = await supabase.from('calendar_entries').select('*').in('id', ids);
      setEntries(data || []);
    } else setEntries([]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('videos-board-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'videos' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scriptById = useMemo(() => Object.fromEntries(scripts.map((s) => [s.id, s])), [scripts]);
  const entryById = useMemo(() => Object.fromEntries(entries.map((e) => [e.id, e])), [entries]);

  const patchLocal = (id, patch) => setVideos((vs) => vs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const update = async (id, patch) => {
    patchLocal(id, patch);
    const { error: err } = await supabase.from('videos').update(patch).eq('id', id);
    if (err) setError(/column/i.test(err.message) ? 'Falta aplicar la actualización de la base de datos (sección "PRODUCCIÓN DE VÍDEOS" de supabase/schema.sql).' : err.message);
  };

  // Actualiza la entrada del calendario; si aún no existen las columnas
  // nuevas (publish_status…), lo reintenta solo con el estado clásico.
  const updateEntry = async (entryId, patch) => {
    const { error: err } = await supabase.from('calendar_entries').update(patch).eq('id', entryId);
    if (err && patch.status) await supabase.from('calendar_entries').update({ status: patch.status }).eq('id', entryId);
    syncToGoogle(entryId, 'upsert');
  };

  const forward = async (v) => {
    const col = columnOf(v);
    if (col === 'Guion') return update(v.id, { production_status: 'Grabado' });
    if (col === 'Grabado') return update(v.id, { production_status: 'Editado' });
    if (col === 'Programado') {
      await update(v.id, { uploaded: true, uploaded_at: new Date().toISOString() });
      if (v.calendar_entry_id) await updateEntry(v.calendar_entry_id, { status: 'hecho', publish_status: 'publicado' });
      load();
    }
  };

  const back = async (v) => {
    const col = columnOf(v);
    if (col === 'Publicado') {
      await update(v.id, { uploaded: false, uploaded_at: null });
      if (v.calendar_entry_id) await updateEntry(v.calendar_entry_id, { status: 'pendiente', publish_status: 'programado' });
      return load();
    }
    if (col === 'Programado') {
      if (v.calendar_entry_id) {
        await syncToGoogle(v.calendar_entry_id, 'delete');
        await supabase.from('calendar_entries').delete().eq('id', v.calendar_entry_id);
      }
      await update(v.id, { production_status: 'Editado', calendar_entry_id: null });
      return load();
    }
    const prev = COLUMNS[COL[col].index - 1];
    if (prev) update(v.id, { production_status: prev.key });
  };

  const schedule = async (v, date, time) => {
    const { data: userData } = await supabase.auth.getUser();
    const base = { title: v.title, type: v.type, date, status: 'pendiente', notes: v.notes || null, created_by: userData.user.id };
    let res = await supabase.from('calendar_entries').insert({ ...base, publish_time: time || null, publish_status: 'programado' }).select().single();
    if (res.error) res = await supabase.from('calendar_entries').insert(base).select().single(); // sin el SQL nuevo
    if (res.error) return setError(`No se pudo programar: ${res.error.message}`);
    await update(v.id, { production_status: 'Programado', calendar_entry_id: res.data.id });
    syncToGoogle(res.data.id, 'upsert');
    load();
  };

  const remove = async (v) => {
    setVideos((vs) => vs.filter((x) => x.id !== v.id));
    await supabase.from('videos').delete().eq('id', v.id);
  };

  const add = async () => {
    if (!form.title.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    const row = {
      title: form.title.trim(),
      type: form.type || categoriesList[0]?.id || 'reel_ig',
      production_status: form.production_status,
      created_by: userData.user.id,
    };
    let res = await supabase.from('videos').insert({ ...row, reference_url: form.reference_url.trim() || null });
    if (res.error) res = await supabase.from('videos').insert(row);
    if (res.error) return setError(res.error.message);
    setForm({ title: '', type: form.type, reference_url: '', production_status: form.production_status });
    setAdding(false);
    load();
  };

  const actions = { forward, back, schedule, update, remove };
  const q = query.trim().toLowerCase();
  const filtered = q ? videos.filter((v) => v.title.toLowerCase().includes(q)) : videos;
  const byCol = Object.fromEntries(COLUMNS.map((c) => [c.key, []]));
  filtered.forEach((v) => byCol[columnOf(v)].push(v));
  // Publicados: lo último arriba
  byCol.Publicado.sort((a, b) => (b.uploaded_at || '').localeCompare(a.uploaded_at || ''));
  byCol.Programado.sort((a, b) => {
    const ea = entryById[a.calendar_entry_id];
    const eb = entryById[b.calendar_entry_id];
    return `${ea?.date || ''}${hhmm(ea?.publish_time)}`.localeCompare(`${eb?.date || ''}${hhmm(eb?.publish_time)}`);
  });

  const renderCard = (v) => (
    <VideoCard
      key={v.id}
      v={v}
      script={scriptById[v.script_id]}
      entry={entryById[v.calendar_entry_id]}
      meta={categoriesMap[v.type] || { label: 'Vídeo', color: 'var(--color-muted)' }}
      profiles={profiles}
      actions={actions}
    />
  );

  const inputCls = 'bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full outline-none focus:border-cyan';

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-ink text-[22px] tracking-wide">PRODUCCIÓN DE VÍDEOS</h2>
          <div className="text-muted text-xs mt-0.5">
            De la recámara a publicado. Pulsa el botón de cada vídeo para pasarlo a la siguiente fase; al programarlo entra en el Calendario de contenido.
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <label className="flex items-center gap-2 bg-surface border border-border rounded-lg px-2.5 h-9 flex-1 sm:w-56">
            <Search size={14} className="text-muted shrink-0" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar vídeo…" aria-label="Buscar vídeo" className="bg-transparent outline-none text-ink text-sm w-full" />
          </label>
          <button onClick={() => setAdding(!adding)} className="h-9 rounded-lg px-3 flex items-center gap-1 font-bold text-sm bg-cyan text-[#00161C] shrink-0">
            <Plus size={15} /> Vídeo
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm flex justify-between gap-2" style={{ background: '#F871711A', color: 'var(--color-red)' }}>
          <span>{error}</span><button onClick={() => setError('')} className="text-xs">Cerrar</button>
        </div>
      )}

      {adding && (
        <Card className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_2fr_auto] sm:items-end">
          <input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Título del vídeo" aria-label="Título" className={inputCls} />
          <select value={form.type || categoriesList[0]?.id || ''} onChange={(e) => setForm({ ...form, type: e.target.value })} aria-label="Formato" className={inputCls}>
            {categoriesList.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select value={form.production_status} onChange={(e) => setForm({ ...form, production_status: e.target.value })} aria-label="Fase" className={inputCls}>
            {COLUMNS.slice(0, 3).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <input value={form.reference_url} onChange={(e) => setForm({ ...form, reference_url: e.target.value })} placeholder="Enlace de referencia (opcional)" aria-label="Enlace de referencia" className={inputCls} />
          <button onClick={add} className="rounded-lg px-4 py-2 font-bold text-sm bg-cyan text-[#00161C]">Añadir</button>
        </Card>
      )}

      {loading ? (
        <Card className="text-center py-10 text-muted">Cargando…</Card>
      ) : videos.length === 0 ? (
        <Card className="text-center py-10 text-muted space-y-1">
          <Clapperboard size={28} className="mx-auto" />
          <div>Todavía no hay vídeos. Añade el primero con «+ Vídeo».</div>
        </Card>
      ) : (
        <>
          {/* Móvil: pestañas por fase */}
          <div className="lg:hidden space-y-3">
            <div className="grid grid-cols-5 gap-1">
              {COLUMNS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setMobileCol(c.key)}
                  className="rounded-lg py-2 px-1 text-center border"
                  style={{ borderColor: mobileCol === c.key ? c.color : 'var(--color-border)', background: mobileCol === c.key ? `${c.color}1A` : 'transparent' }}
                >
                  <div className="text-[17px] font-extrabold" style={{ color: c.color }}>{byCol[c.key].length}</div>
                  <div className="text-[10px] font-semibold text-ink truncate">{c.label}</div>
                </button>
              ))}
            </div>
            <div className="text-muted text-xs">{COL[mobileCol].label} · {COL[mobileCol].sub}</div>
            <div className="space-y-2">
              {byCol[mobileCol].length === 0 ? <div className="text-muted text-sm text-center py-6">Nada en esta fase.</div> : byCol[mobileCol].map(renderCard)}
            </div>
          </div>

          {/* Escritorio: tablero */}
          <div className="hidden lg:grid grid-cols-5 gap-3 items-start">
            {COLUMNS.map((c) => (
              <section key={c.key} className="rounded-2xl bg-surfaceAlt border border-border p-2.5 min-w-0" aria-label={c.label}>
                <div className="flex items-center justify-between px-1 pb-2.5">
                  <div>
                    <div className="flex items-center gap-1.5 text-ink text-sm font-bold">
                      <span className="w-2 h-2 rounded-full" style={{ background: c.color }} /> {c.label}
                    </div>
                    <div className="text-muted text-[11px]">{c.sub}</div>
                  </div>
                  <span className="text-xs font-bold rounded-full px-2 py-0.5" style={{ background: `${c.color}1A`, color: c.color }}>{byCol[c.key].length}</span>
                </div>
                <div className="space-y-2 max-h-[calc(100vh-230px)] overflow-y-auto pr-0.5">
                  {byCol[c.key].length === 0 ? <div className="text-muted text-xs text-center py-6 border border-dashed border-border rounded-xl">Vacío</div> : byCol[c.key].map(renderCard)}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
