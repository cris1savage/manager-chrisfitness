'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, ExternalLink, Clapperboard, LayoutGrid, List } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui';
import Modal from '@/components/Modal';
import { useCategories } from '@/components/CategoriesProvider';
import { syncToGoogle } from '@/lib/googleSync';
import { dateToISO, todayISO, PUBLISH_STATUSES, PLATFORMS, platformOf } from '@/lib/config';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const FALLBACK_META = { label: 'Sin categoría', color: '#7C878B' };
const MIGRATION_HINT =
  'Falta aplicar la actualización de la base de datos: ejecuta en Supabase la sección "CALENDARIO DE CONTENIDO" del final de supabase/schema.sql.';

const fmtNum = (n) => (Number(n) || 0).toLocaleString('es-ES');
const hhmm = (t) => (t ? String(t).slice(0, 5) : '');

// Estado de publicación: si está guardado explícitamente se usa ese; si no,
// se deduce de lo que ya existía (marcado como hecho, o vídeo Programado).
function statusOf(entry, video) {
  if (entry.publish_status && PUBLISH_STATUSES[entry.publish_status]) return entry.publish_status;
  if (entry.status === 'hecho' || video?.uploaded) return 'publicado';
  if (video?.production_status === 'Programado') return 'programado';
  return 'borrador';
}

function monthGrid(anchor) {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const first = new Date(y, m, 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7)); // lunes de la primera semana
  const last = new Date(y, m + 1, 0);
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - ((last.getDay() + 6) % 7))); // domingo de la última semana
  const days = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push(new Date(d));
  return { days, monthStart: dateToISO(first), monthEnd: dateToISO(last), gridStart: dateToISO(start), gridEnd: dateToISO(end) };
}

const intOrNull = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = parseInt(String(v).replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};

function EntryModal({ entry, video, categoriesList, onClose, onSave, onDelete }) {
  const isNew = !entry.id;
  const [form, setForm] = useState({
    title: entry.title || '',
    type: entry.type || categoriesList[0]?.id || '',
    date: entry.date,
    publish_time: hhmm(entry.publish_time),
    publish_status: entry.id ? statusOf(entry, video) : 'borrador',
    post_url: entry.post_url || '',
    views: entry.views ?? '',
    likes: entry.likes ?? '',
    comments: entry.comments ?? '',
    publish_error: entry.publish_error || '',
    notes: entry.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.title.trim()) return setError('Pon un título.');
    setSaving(true);
    setError('');
    const err = await onSave({
      title: form.title.trim(),
      type: form.type,
      date: form.date,
      publish_time: form.publish_time || null,
      publish_status: form.publish_status,
      // mantiene coherente la Agenda día/semana (hecho = publicado)
      status: form.publish_status === 'publicado' ? 'hecho' : 'pendiente',
      post_url: form.post_url.trim() || null,
      views: intOrNull(form.views),
      likes: intOrNull(form.likes),
      comments: intOrNull(form.comments),
      publish_error: form.publish_status === 'error' ? form.publish_error.trim() || null : null,
      notes: form.notes,
    });
    setSaving(false);
    if (err) setError(err);
  };

  const input = 'bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full outline-none focus:border-cyan';
  const label = 'text-muted text-[11px] uppercase tracking-wide mb-1 block';

  return (
    <Modal title={isNew ? 'Nueva pieza de contenido' : 'Editar pieza de contenido'} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <span className={label}>Título</span>
          <input autoFocus value={form.title} onChange={set('title')} className={input} placeholder="Ej. 3 errores comiendo fuera" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <span className={label}>Formato</span>
            <select value={form.type} onChange={set('type')} className={input}>
              {categoriesList.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <span className={label}>Fecha</span>
            <input type="date" value={form.date} onChange={set('date')} className={input} />
          </div>
          <div>
            <span className={label}>Hora</span>
            <input type="time" value={form.publish_time} onChange={set('publish_time')} className={input} />
          </div>
        </div>

        <div>
          <span className={label}>Estado</span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PUBLISH_STATUSES).map(([k, s]) => (
              <button
                key={k}
                type="button"
                onClick={() => setForm((f) => ({ ...f, publish_status: k }))}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border"
                style={{
                  borderColor: form.publish_status === k ? s.color : 'var(--color-border)',
                  background: form.publish_status === k ? `${s.color}1F` : 'transparent',
                  color: form.publish_status === k ? s.color : 'var(--color-muted)',
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} /> {s.label}
              </button>
            ))}
          </div>
        </div>

        {form.publish_status === 'error' && (
          <div>
            <span className={label}>Qué falló</span>
            <input value={form.publish_error} onChange={set('publish_error')} className={input} placeholder="Ej. el vídeo no cumplía el formato" />
          </div>
        )}

        {form.publish_status === 'publicado' && (
          <>
            <div>
              <span className={label}>Enlace al post</span>
              <input value={form.post_url} onChange={set('post_url')} className={input} placeholder="https://www.instagram.com/reel/..." />
              {/^https?:\/\//.test(form.post_url.trim()) && (
                <a href={form.post_url.trim()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan text-xs mt-1.5">
                  <ExternalLink size={12} /> Abrir post
                </a>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <span className={label}>Vistas</span>
                <input inputMode="numeric" value={form.views} onChange={set('views')} className={input} />
              </div>
              <div>
                <span className={label}>Likes</span>
                <input inputMode="numeric" value={form.likes} onChange={set('likes')} className={input} />
              </div>
              <div>
                <span className={label}>Comentarios</span>
                <input inputMode="numeric" value={form.comments} onChange={set('comments')} className={input} />
              </div>
            </div>
            <div className="text-muted text-[11px]">Por ahora se apuntan a mano. Al conectar Instagram/YouTube se rellenarán solas.</div>
          </>
        )}

        <div>
          <span className={label}>Notas / copy</span>
          <textarea value={form.notes} onChange={set('notes')} rows={4} className={`${input} resize-y`} placeholder="Copy, hashtags, ideas..." />
        </div>

        {video && (
          <div className="flex items-center gap-2 text-xs text-muted rounded-lg bg-surfaceAlt border border-border p-2.5">
            <Clapperboard size={14} /> Vinculado al vídeo «{video.title}» · {video.production_status}{video.uploaded ? ' · subido' : ''}
          </div>
        )}

        {error && <div className="text-red text-xs">{error}</div>}

        <div className="flex items-center gap-2 pt-1">
          <button onClick={submit} disabled={saving} className="flex-1 bg-cyan text-[#00161C] rounded-lg py-2.5 text-sm font-bold disabled:opacity-60">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          {!isNew && (
            <button
              onClick={() => { if (window.confirm('¿Borrar esta pieza del calendario?')) onDelete(); }}
              className="px-3 py-2.5 rounded-lg border border-border text-red"
              aria-label="Borrar"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function PostChip({ entry, status, meta, onClick, compact = true }) {
  const s = PUBLISH_STATUSES[status];
  const hasMetrics = entry.views != null || entry.likes != null || entry.comments != null;
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-md bg-surfaceAlt border border-border hover:border-cyan transition-colors overflow-hidden flex"
    >
      <span className="w-[3px] shrink-0" style={{ background: s.color }} />
      <span className="min-w-0 flex-1 px-1.5 py-1">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} title={meta.label} />
          <span className="text-ink text-[11px] font-bold">{hhmm(entry.publish_time) || '--:--'}</span>
          {!compact && <span className="text-[10px] uppercase tracking-wide" style={{ color: meta.color }}>{meta.label}</span>}
        </span>
        <span className={`block text-ink text-[11px] leading-tight ${compact ? 'truncate' : ''}`}>{entry.title}</span>
        <span className={`block text-[10px] leading-tight mt-0.5 ${compact ? 'truncate' : ''}`} style={{ color: status === 'publicado' ? 'var(--color-muted)' : s.color }}>
          {status === 'publicado' && hasMetrics
            ? `${fmtNum(entry.views)} vistas · ${fmtNum(entry.likes)} likes · ${fmtNum(entry.comments)} com.`
            : status === 'error' && entry.publish_error
              ? entry.publish_error
              : s.label}
        </span>
      </span>
    </button>
  );
}

export default function ContentCalendarClient() {
  const supabase = useMemo(() => createClient(), []);
  const { list: categoriesList, map: categoriesMap } = useCategories();
  const [entries, setEntries] = useState([]);
  const [videos, setVideos] = useState([]);
  const [stats, setStats] = useState([]);
  const [anchor, setAnchor] = useState(() => new Date());
  const [platform, setPlatform] = useState('todas');
  const [hiddenStatuses, setHiddenStatuses] = useState([]);
  const [view, setView] = useState('mes');
  const [editing, setEditing] = useState(null);

  const grid = useMemo(() => monthGrid(anchor), [anchor]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) setView('lista');
  }, []);

  const load = async () => {
    const [e, v, s] = await Promise.all([
      supabase.from('calendar_entries').select('*').gte('date', grid.gridStart).lte('date', grid.gridEnd),
      supabase.from('videos').select('id, title, production_status, uploaded, calendar_entry_id').not('calendar_entry_id', 'is', null),
      supabase.from('social_daily_stats').select('*').gte('date', grid.gridStart).lte('date', grid.gridEnd),
    ]);
    setEntries(e.data || []);
    setVideos(v.data || []);
    setStats(s.error ? [] : s.data || []); // la tabla puede no existir aún
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('content-calendar-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_entries' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'videos' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid.gridStart]);

  const videoByEntry = useMemo(() => {
    const m = {};
    videos.forEach((v) => (m[v.calendar_entry_id] = v));
    return m;
  }, [videos]);

  // Entradas enriquecidas con estado y plataforma, ya filtradas por plataforma
  const items = useMemo(
    () =>
      entries
        .map((e) => {
          const meta = categoriesMap[e.type] || FALLBACK_META;
          return { entry: e, meta, status: statusOf(e, videoByEntry[e.id]), platform: platformOf(e.type, meta.label) };
        })
        .filter((x) => platform === 'todas' || x.platform === platform),
    [entries, categoriesMap, videoByEntry, platform]
  );

  const visibleItems = items.filter((x) => !hiddenStatuses.includes(x.status));

  const byDate = useMemo(() => {
    const m = {};
    visibleItems.forEach((x) => (m[x.entry.date] = m[x.entry.date] || []).push(x));
    Object.values(m).forEach((list) => list.sort((a, b) => (hhmm(a.entry.publish_time) || '99').localeCompare(hhmm(b.entry.publish_time) || '99')));
    return m;
  }, [visibleItems]);

  const statsFiltered = stats.filter((s) => platform === 'todas' || s.platform === platform);
  const followersByDate = useMemo(() => {
    const m = {};
    statsFiltered.forEach((s) => {
      if (s.followers_gained != null) m[s.date] = (m[s.date] || 0) + s.followers_gained;
    });
    return m;
  }, [statsFiltered]);

  // KPIs del mes en pantalla (no de los días de relleno de otros meses)
  const inMonth = (iso) => iso >= grid.monthStart && iso <= grid.monthEnd;
  const monthItems = items.filter((x) => inMonth(x.entry.date));
  const count = (st) => monthItems.filter((x) => x.status === st).length;
  const monthStats = statsFiltered.filter((s) => inMonth(s.date));
  const followersMonth = monthStats.some((s) => s.followers_gained != null)
    ? monthStats.reduce((acc, s) => acc + (s.followers_gained || 0), 0)
    : null;
  const viewsMonth = monthItems.some((x) => x.entry.views != null)
    ? monthItems.reduce((acc, x) => acc + (x.entry.views || 0), 0)
    : null;

  const monthLabel = anchor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const monthName = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const shift = (dir) => setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + dir, 1));
  const today = todayISO();

  const save = async (patch) => {
    const current = editing;
    let res;
    if (current.id) {
      res = await supabase.from('calendar_entries').update(patch).eq('id', current.id).select().single();
    } else {
      const { data: userData } = await supabase.auth.getUser();
      res = await supabase.from('calendar_entries').insert({ ...patch, created_by: userData.user.id }).select().single();
    }
    if (res.error) {
      return /column|schema cache/i.test(res.error.message) ? MIGRATION_HINT : `No se pudo guardar: ${res.error.message}`;
    }
    if (res.data) syncToGoogle(res.data.id, 'upsert');
    setEditing(null);
    load();
    return null;
  };

  const remove = async () => {
    const id = editing.id;
    await syncToGoogle(id, 'delete');
    await supabase.from('calendar_entries').delete().eq('id', id);
    setEditing(null);
    load();
  };

  const toggleStatus = (k) =>
    setHiddenStatuses((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]));

  const kpis = [
    { label: 'Publicados', sub: 'este mes', value: count('publicado'), color: PUBLISH_STATUSES.publicado.color },
    { label: 'Programados', sub: 'este mes', value: count('programado'), color: PUBLISH_STATUSES.programado.color },
    { label: 'Borradores', sub: 'este mes', value: count('borrador'), color: PUBLISH_STATUSES.borrador.color },
    { label: 'Con error', sub: 'este mes', value: count('error'), color: PUBLISH_STATUSES.error.color },
    { label: 'Seguidores nuevos', sub: followersMonth == null ? 'sin datos aún' : 'este mes', value: followersMonth == null ? '—' : `+${fmtNum(followersMonth)}`, color: 'var(--color-ink)' },
    { label: 'Vistas', sub: viewsMonth == null ? 'sin datos aún' : 'de lo publicado', value: viewsMonth == null ? '—' : fmtNum(viewsMonth), color: 'var(--color-ink)' },
  ];

  const usedPlatforms = new Set(entries.map((e) => platformOf(e.type, (categoriesMap[e.type] || FALLBACK_META).label)));
  const platformTabs = ['todas', 'instagram', 'tiktok', 'youtube', ...(usedPlatforms.has('otro') ? ['otro'] : [])];

  const openNew = (dateISO) => setEditing({ date: dateISO });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-ink text-[20px] sm:text-[22px] tracking-wide">CALENDARIO DE CONTENIDO</h2>
          <div className="text-muted text-xs mt-0.5">
            Todo lo que se publica, se programa o está en borrador, mes a mes. Seguidores y vistas se rellenarán solos al conectar Instagram, TikTok y YouTube.
          </div>
        </div>
        <button onClick={() => openNew(today)} className="flex items-center gap-1.5 bg-cyan text-[#00161C] rounded-lg px-3 py-2 text-sm font-bold">
          <Plus size={15} /> Nueva pieza
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-muted text-xs">Ver:</span>
        {platformTabs.map((p) => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            className="rounded-full px-3 py-1 text-xs font-semibold border"
            style={{
              background: platform === p ? 'var(--color-red)' : 'transparent',
              borderColor: platform === p ? 'var(--color-red)' : 'var(--color-border)',
              color: platform === p ? '#fff' : 'var(--color-ink)',
            }}
          >
            {p === 'todas' ? 'Todas' : PLATFORMS[p].label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {kpis.map((k) => (
          <Card key={k.label} className="!p-3">
            <div className="font-display text-[26px] leading-none tracking-wide" style={{ color: k.color }}>{k.value}</div>
            <div className="text-ink text-[12px] font-semibold mt-1.5">{k.label}</div>
            <div className="text-muted text-[11px]">{k.sub}</div>
          </Card>
        ))}
      </div>

      <Card className="!p-2 sm:!p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <div className="flex items-center gap-1.5">
            <button onClick={() => shift(-1)} className="p-1.5 rounded-lg border border-border text-ink" aria-label="Mes anterior"><ChevronLeft size={15} /></button>
            <div className="text-ink font-bold text-sm sm:text-base min-w-[130px] text-center">{monthName}</div>
            <button onClick={() => shift(1)} className="p-1.5 rounded-lg border border-border text-ink" aria-label="Mes siguiente"><ChevronRight size={15} /></button>
            <button onClick={() => setAnchor(new Date())} className="ml-1 px-2 py-1 rounded-lg border border-border text-muted text-xs">Hoy</button>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {Object.entries(PUBLISH_STATUSES).map(([k, s]) => (
              <button key={k} onClick={() => toggleStatus(k)} className="flex items-center gap-1.5 text-xs" style={{ opacity: hiddenStatuses.includes(k) ? 0.35 : 1 }} title="Mostrar / ocultar">
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <span className="text-muted">{s.label}</span>
              </button>
            ))}
            <div className="flex rounded-lg overflow-hidden border border-border">
              <button onClick={() => setView('mes')} className="px-2 py-1" style={{ background: view === 'mes' ? 'var(--color-cyan)' : 'transparent', color: view === 'mes' ? '#00161C' : 'var(--color-muted)' }} aria-label="Vista mes"><LayoutGrid size={14} /></button>
              <button onClick={() => setView('lista')} className="px-2 py-1" style={{ background: view === 'lista' ? 'var(--color-cyan)' : 'transparent', color: view === 'lista' ? '#00161C' : 'var(--color-muted)' }} aria-label="Vista lista"><List size={14} /></button>
            </div>
          </div>
        </div>

        {view === 'mes' ? (
          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 gap-px bg-border border border-border rounded-lg overflow-hidden" style={{ minWidth: 760 }}>
              {WEEKDAYS.map((d) => (
                <div key={d} className="bg-surface text-muted text-[11px] font-bold px-2 py-1.5">{d}</div>
              ))}
              {grid.days.map((d) => {
                const iso = dateToISO(d);
                const outside = !inMonth(iso);
                const isToday = iso === today;
                const list = byDate[iso] || [];
                const gained = followersByDate[iso];
                return (
                  <div
                    key={iso}
                    className="group bg-surface p-1.5 flex flex-col gap-1 min-h-[118px]"
                    style={{ opacity: outside ? 0.45 : 1, boxShadow: isToday ? 'inset 0 0 0 2px var(--color-cyan)' : 'none' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold" style={{ color: isToday ? 'var(--color-cyan)' : 'var(--color-muted)' }}>
                        {d.getDate()}
                        {gained != null && <span className="ml-1.5 font-semibold" style={{ color: 'var(--color-green)' }}>{gained >= 0 ? '+' : ''}{fmtNum(gained)} seg.</span>}
                      </span>
                      <button onClick={() => openNew(iso)} className="text-muted opacity-60 group-hover:opacity-100" aria-label="Añadir"><Plus size={13} /></button>
                    </div>
                    {list.map((x) => (
                      <PostChip key={x.entry.id} entry={x.entry} status={x.status} meta={x.meta} onClick={() => setEditing(x.entry)} />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {grid.days.filter((d) => inMonth(dateToISO(d)) && (byDate[dateToISO(d)] || []).length > 0).length === 0 && (
              <div className="text-muted text-sm text-center py-8">Nada en el calendario este mes todavía.</div>
            )}
            {grid.days
              .filter((d) => inMonth(dateToISO(d)) && (byDate[dateToISO(d)] || []).length > 0)
              .map((d) => {
                const iso = dateToISO(d);
                const gained = followersByDate[iso];
                return (
                  <div key={iso}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-xs font-bold" style={{ color: iso === today ? 'var(--color-cyan)' : 'var(--color-ink)' }}>
                        {(() => {
                          const s = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
                          return s.charAt(0).toUpperCase() + s.slice(1);
                        })()}
                        {iso === today && ' · hoy'}
                        {gained != null && <span className="ml-2" style={{ color: 'var(--color-green)' }}>{gained >= 0 ? '+' : ''}{fmtNum(gained)} seguidores</span>}
                      </div>
                      <button onClick={() => openNew(iso)} className="text-muted" aria-label="Añadir"><Plus size={14} /></button>
                    </div>
                    <div className="space-y-1.5">
                      {byDate[iso].map((x) => (
                        <PostChip key={x.entry.id} entry={x.entry} status={x.status} meta={x.meta} compact={false} onClick={() => setEditing(x.entry)} />
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </Card>

      {editing && (
        <EntryModal
          key={editing.id || `new-${editing.date}`}
          entry={editing}
          video={editing.id ? videoByEntry[editing.id] : null}
          categoriesList={categoriesList}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={remove}
        />
      )}
    </div>
  );
}
