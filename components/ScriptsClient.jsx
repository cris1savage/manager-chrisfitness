'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, FileText, X, Download, Film, Pencil, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, AuthorBadge } from '@/components/ui';
import { useProfiles } from '@/components/ProfilesProvider';
import { SCRIPT_STATUSES, CONTENT_TYPES, todayISO } from '@/lib/config';

const STATUS_COLORS = { Borrador: '#7C878B', Listo: '#FBBF24', Grabado: '#4ADE80' };

async function getLogoDataUrl() {
  try {
    const res = await fetch('/icon-512.png');
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function downloadScriptPDF(script) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const logo = await getLogoDataUrl();

  doc.setFillColor(5, 7, 8);
  doc.rect(0, 0, pageWidth, 38, 'F');
  if (logo) doc.addImage(logo, 'PNG', 14, 7, 24, 24);
  doc.setTextColor(94, 204, 250);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('CHRIS FITNESS', logo ? 44 : 14, 20);
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 180);
  doc.text('GUION DE CONTENIDO', logo ? 44 : 14, 27);

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(script.title || 'Sin título', 14, 52);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(`Categoria: ${script.category || 'General'}    Estado: ${script.status}`, 14, 59);

  doc.setDrawColor(210, 210, 210);
  doc.line(14, 64, pageWidth - 14, 64);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(script.content || 'Sin contenido todavía.', pageWidth - 28);
  let y = 74;
  lines.forEach((line) => {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, 14, y);
    y += 6;
  });

  doc.save(`guion-${(script.title || 'sin-titulo').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`);
}

function ScriptVideos({ scriptId }) {
  const supabase = useMemo(() => createClient(), []);
  const [videos, setVideos] = useState([]);
  const [form, setForm] = useState({ title: '', type: 'reel_ig', date: todayISO() });
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    const { data } = await supabase.from('calendar_entries').select('*').eq('script_id', scriptId).order('date', { ascending: true });
    setVideos(data || []);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`script-videos-${scriptId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_entries' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptId]);

  const add = async () => {
    if (!form.title.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('calendar_entries').insert({
      title: form.title.trim(), type: form.type, date: form.date, status: 'pendiente', script_id: scriptId, created_by: userData.user.id,
    });
    setForm({ title: '', type: 'reel_ig', date: todayISO() });
    load();
  };

  const update = async (id, key, value) => {
    setVideos((v) => v.map((x) => (x.id === id ? { ...x, [key]: value } : x)));
    await supabase.from('calendar_entries').update({ [key]: value }).eq('id', id);
  };

  const toggle = async (v) => {
    await update(v.id, 'status', v.status === 'hecho' ? 'pendiente' : 'hecho');
  };

  const del = async (id) => {
    setVideos((v) => v.filter((x) => x.id !== id));
    await supabase.from('calendar_entries').delete().eq('id', id);
  };

  return (
    <div className="space-y-3">
      <div className="text-ink font-semibold text-sm flex items-center gap-1.5"><Film size={15} /> Vídeos programados de este guion</div>
      <div className="text-muted text-xs -mt-2">Ponles fecha y aparecerán solos en el Calendario. Márcalos como subidos cuando estén listos.</div>

      <div className="rounded-lg p-3 bg-surfaceAlt border border-border grid grid-cols-1 sm:grid-cols-[1fr_140px_140px_auto] gap-2">
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Ej. Curl de bíceps - variante 1"
          className="bg-surface border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-cyan"
        />
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="bg-surface border border-border text-ink rounded-lg px-2 py-1.5 text-xs outline-none focus:border-cyan"
        >
          {Object.entries(CONTENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="bg-surface border border-border text-ink rounded-lg px-2 py-1.5 text-xs outline-none focus:border-cyan"
        />
        <button onClick={add} className="rounded-lg px-3 py-1.5 font-semibold text-xs bg-cyan text-[#00161C] flex items-center justify-center gap-1">
          <Plus size={14} /> Añadir
        </button>
      </div>

      <div className="space-y-1.5">
        {videos.length === 0 && <div className="text-muted text-xs text-center py-3">Todavía no hay vídeos programados para este guion.</div>}
        {videos.map((v) => {
          const meta = CONTENT_TYPES[v.type] || CONTENT_TYPES.reel_ig;
          const done = v.status === 'hecho';
          const editing = editingId === v.id;
          return (
            <div key={v.id} className="rounded-lg p-2.5 bg-surface border border-border">
              <div className="flex items-center gap-2">
                <button onClick={() => toggle(v)} className="shrink-0">
                  {done ? <Check size={16} color={meta.color} /> : <div className="w-4 h-4 rounded border border-border" />}
                </button>
                {editing ? (
                  <input
                    value={v.title}
                    onChange={(e) => update(v.id, 'title', e.target.value)}
                    className="bg-transparent text-ink text-sm outline-none flex-1 min-w-0"
                  />
                ) : (
                  <span className="text-ink text-sm flex-1 min-w-0 truncate" style={{ textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1 }}>
                    {v.title}
                  </span>
                )}
                <button onClick={() => setEditingId(editing ? null : v.id)} className="text-muted shrink-0"><Pencil size={13} /></button>
                <button onClick={() => del(v.id)} className="text-red shrink-0"><Trash2 size={13} /></button>
              </div>
              {editing && (
                <div className="flex items-center gap-2 mt-2 pl-6">
                  <select
                    value={v.type}
                    onChange={(e) => update(v.id, 'type', e.target.value)}
                    className="bg-surfaceAlt border border-border text-ink rounded px-1.5 py-1 text-[11px] outline-none focus:border-cyan"
                  >
                    {Object.entries(CONTENT_TYPES).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
                  </select>
                  <input
                    type="date"
                    value={v.date}
                    onChange={(e) => update(v.id, 'date', e.target.value)}
                    className="bg-surfaceAlt border border-border text-ink rounded px-1.5 py-1 text-[11px] outline-none focus:border-cyan"
                  />
                </div>
              )}
              {!editing && (
                <div className="text-[10.5px] pl-6 mt-0.5" style={{ color: meta.color }}>
                  {meta.label} · {new Date(v.date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ScriptsClient() {
  const supabase = useMemo(() => createClient(), []);
  const profiles = useProfiles();
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('Todas');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState({});

  const load = async () => {
    const { data } = await supabase.from('scripts').select('*').order('updated_at', { ascending: false });
    setScripts(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('scripts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scripts' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(() => {
    const set = new Set(scripts.map((s) => s.category || 'General'));
    return ['Todas', ...Array.from(set)];
  }, [scripts]);

  const createNew = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('scripts')
      .insert({ title: 'Nuevo guion', category: 'General', content: '', status: 'Borrador', created_by: userData.user.id })
      .select()
      .single();
    if (data) {
      setOpenId(data.id);
      setDraft(data);
      load();
    }
  };

  const openEditor = (s) => {
    setOpenId(s.id);
    setDraft(s);
  };

  const save = async () => {
    await supabase
      .from('scripts')
      .update({ title: draft.title, category: draft.category, content: draft.content, status: draft.status, updated_at: new Date().toISOString() })
      .eq('id', openId);
    setOpenId(null);
    load();
  };

  const remove = async (id) => {
    await supabase.from('scripts').delete().eq('id', id);
    if (openId === id) setOpenId(null);
    load();
  };

  const visible = scripts
    .filter((s) => category === 'Todas' || (s.category || 'General') === category)
    .filter((s) => statusFilter === 'Todos' || s.status === statusFilter);

  if (openId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-ink text-[20px] tracking-wide">EDITAR GUION</h2>
          <button onClick={() => setOpenId(null)} className="text-muted flex items-center gap-1 text-sm">
            <X size={16} /> Cerrar
          </button>
        </div>
        <Card className="space-y-3">
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Título del guion"
            className="bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2 text-sm font-semibold w-full outline-none focus:border-cyan"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              placeholder="Categoría (ej. Octubre, Pierna...)"
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2 text-sm w-full outline-none focus:border-cyan"
            />
            <select
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2 text-sm w-full outline-none focus:border-cyan"
            >
              {SCRIPT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <textarea
            value={draft.content || ''}
            onChange={(e) => setDraft({ ...draft, content: e.target.value })}
            placeholder="Escribe el guion aquí... Ana puede leerlo y corregirlo directamente."
            rows={14}
            className="bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2.5 text-sm w-full outline-none focus:border-cyan resize-y leading-relaxed"
          />
          <div className="flex gap-2 flex-wrap">
            <button onClick={save} className="rounded-lg px-4 py-2 font-semibold text-sm bg-cyan text-[#00161C]">
              Guardar
            </button>
            <button onClick={() => downloadScriptPDF(draft)} className="rounded-lg px-4 py-2 font-semibold text-sm bg-surfaceAlt border border-border text-ink flex items-center gap-1.5">
              <Download size={15} /> Descargar PDF
            </button>
            <button onClick={() => remove(openId)} className="rounded-lg px-4 py-2 font-semibold text-sm text-red flex items-center gap-1.5">
              <Trash2 size={15} /> Eliminar guion
            </button>
          </div>
        </Card>

        <Card>
          <ScriptVideos scriptId={openId} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-display text-ink text-[22px] tracking-wide">GUIONES</h2>
          <div className="text-muted text-xs">Biblioteca de guiones para grabar. Tú y Ana podéis leer y corregir. Toca un guion para abrirlo.</div>
        </div>
        <button onClick={createNew} className="rounded-lg px-3 py-2 flex items-center gap-1 font-semibold text-sm bg-cyan text-[#00161C] shrink-0">
          <Plus size={16} /> Nuevo guion
        </button>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1.5" style={{ minWidth: 'max-content' }}>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0"
              style={{
                background: category === c ? '#5ECCFA22' : 'transparent',
                border: `1px solid ${category === c ? '#5ECCFA' : '#212729'}`,
                color: category === c ? '#5ECCFA' : '#7C878B',
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1.5" style={{ minWidth: 'max-content' }}>
          {['Todos', ...SCRIPT_STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0"
              style={{
                background: statusFilter === s ? `${STATUS_COLORS[s] || '#5ECCFA'}22` : 'transparent',
                border: `1px solid ${statusFilter === s ? (STATUS_COLORS[s] || '#5ECCFA') : '#212729'}`,
                color: statusFilter === s ? (STATUS_COLORS[s] || '#5ECCFA') : '#7C878B',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {loading && <Card className="text-center py-8 text-muted col-span-2">Cargando…</Card>}
        {!loading && visible.length === 0 && (
          <Card className="text-center py-8 text-muted col-span-2">Sin guiones aquí. Crea el primero arriba.</Card>
        )}
        {visible.map((s) => (
          <Card key={s.id} className="cursor-pointer space-y-2" onClick={() => openEditor(s)}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={16} className="text-cyan shrink-0" />
                <div className="text-ink font-semibold text-sm truncate">{s.title}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); downloadScriptPDF(s); }}
                  className="text-muted p-1"
                  title="Descargar PDF"
                >
                  <Download size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); remove(s.id); }}
                  className="text-muted p-1"
                  title="Eliminar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="text-muted text-xs line-clamp-2">{s.content ? s.content.slice(0, 120) : 'Sin contenido todavía.'}</div>
            <div className="flex items-center justify-between">
              <span
                className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded"
                style={{ background: `${STATUS_COLORS[s.status]}22`, color: STATUS_COLORS[s.status] }}
              >
                {s.status}
              </span>
              <AuthorBadge profile={profiles?.[s.created_by]} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
