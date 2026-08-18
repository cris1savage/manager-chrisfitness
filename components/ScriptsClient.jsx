'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, FileText, X, Download, Film, Pencil, Check, Bold, Heading1, Heading2, List, CalendarPlus, CalendarX, Type } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, AuthorBadge } from '@/components/ui';
import { useProfiles } from '@/components/ProfilesProvider';
import { SCRIPT_STATUSES, SCRIPT_STATUS_COLORS, PRODUCTION_STATUSES, todayISO } from '@/lib/config';
import { useCategories } from '@/components/CategoriesProvider';
import { syncToGoogle } from '@/lib/googleSync';

const SCHEDULABLE = ['Editado', 'Programado'];

/* ---------------------------------------------------------------------- */
/* Compatibilidad con guiones antiguos guardados como "# **texto**"       */
/* ---------------------------------------------------------------------- */

function looksLikeHtml(text) {
  return /<(h1|h2|h3|strong|b|ul|li|div|p|br)[\s>]/i.test(text || '');
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function markdownLiteToHtml(text) {
  if (!text) return '';
  if (looksLikeHtml(text)) return text;
  const boldInline = (s) => escapeHtml(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const lines = text.split('\n');
  let html = '';
  let inList = false;
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
  lines.forEach((line) => {
    if (line.startsWith('## ')) { closeList(); html += `<h3>${boldInline(line.slice(3))}</h3>`; }
    else if (line.startsWith('# ')) { closeList(); html += `<h2>${boldInline(line.slice(2))}</h2>`; }
    else if (line.startsWith('- ')) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${boldInline(line.slice(2))}</li>`; }
    else if (line.trim() === '') { closeList(); html += '<div><br></div>'; }
    else { closeList(); html += `<div>${boldInline(line)}</div>`; }
  });
  closeList();
  return html;
}

function htmlToPlainSnippet(html, maxLen = 120) {
  if (!html) return '';
  const text = looksLikeHtml(html) ? html.replace(/<[^>]+>/g, ' ') : html.replace(/\*\*/g, '').replace(/^#+\s*/gm, '');
  return text.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

/* ---------------------------------------------------------------------- */
/* PDF: recorre el HTML del editor y lo dibuja con títulos/negrita reales */
/* ---------------------------------------------------------------------- */

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

// Convierte un elemento del editor en tokens {text, bold} para una línea
function extractInlineTokens(el) {
  const tokens = [];
  const walk = (node, bold) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        const words = child.textContent.split(' ');
        words.forEach((w, i) => {
          if (w === '' && words.length === 1) return;
          tokens.push({ text: w + (i < words.length - 1 ? ' ' : ''), bold });
        });
      } else if (child.nodeType === 1) {
        const tag = child.tagName.toLowerCase();
        walk(child, bold || tag === 'strong' || tag === 'b');
      }
    });
  };
  walk(el, false);
  return tokens;
}

// Convierte el HTML guardado en bloques {type, tokens/text} en orden, para imprimir en el PDF
function htmlToBlocks(html) {
  if (!html) return [];
  const container = document.createElement('div');
  container.innerHTML = looksLikeHtml(html) ? html : markdownLiteToHtml(html);
  const blocks = [];
  Array.from(container.childNodes).forEach((node) => {
    if (node.nodeType === 3) {
      if (node.textContent.trim() !== '') blocks.push({ type: 'p', tokens: [{ text: node.textContent, bold: false }] });
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'h2') blocks.push({ type: 'h1', text: node.textContent });
    else if (tag === 'h3') blocks.push({ type: 'h2', text: node.textContent });
    else if (tag === 'ul' || tag === 'ol') {
      Array.from(node.children).forEach((li) => blocks.push({ type: 'li', tokens: extractInlineTokens(li) }));
    } else if (tag === 'div' || tag === 'p') {
      const isBreak = node.childNodes.length === 0 || (node.childNodes.length === 1 && node.firstChild.nodeType === 1 && node.firstChild.tagName === 'BR');
      if (isBreak) blocks.push({ type: 'break' });
      else blocks.push({ type: 'p', tokens: extractInlineTokens(node) });
    }
  });
  return blocks;
}

async function downloadScriptPDF(script) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const maxX = pageWidth - marginX;
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
  doc.text(script.title || 'Sin título', marginX, 52);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(`Categoria: ${script.category || 'General'}    Estado: ${script.status}`, marginX, 59);

  doc.setDrawColor(210, 210, 210);
  doc.line(marginX, 64, pageWidth - marginX, 64);

  let y = 76;
  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - 16) {
      doc.addPage();
      y = 20;
    }
  };

  const printTokens = (tokens, x, size, lineHeight) => {
    doc.setFontSize(size);
    let curX = x;
    tokens.forEach((tok) => {
      doc.setFont('helvetica', tok.bold ? 'bold' : 'normal');
      const w = doc.getTextWidth(tok.text);
      if (curX + w > maxX) {
        curX = marginX;
        y += lineHeight;
        ensureSpace(lineHeight);
      }
      doc.setTextColor(30, 30, 30);
      doc.text(tok.text, curX, y);
      curX += w;
    });
  };

  const blocks = htmlToBlocks(script.content);
  if (blocks.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(120, 120, 120);
    doc.text('Sin contenido todavia.', marginX, y);
  }
  blocks.forEach((block) => {
    if (block.type === 'h1') {
      ensureSpace(14);
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(58, 156, 196);
      doc.text(block.text, marginX, y);
      y += 8;
    } else if (block.type === 'h2') {
      ensureSpace(12);
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(20, 20, 20);
      doc.text(block.text, marginX, y);
      y += 7;
    } else if (block.type === 'li') {
      ensureSpace(6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(94, 204, 250);
      doc.text('\u2022', marginX, y);
      printTokens(block.tokens, marginX + 5, 10.5, 6);
      y += 6;
    } else if (block.type === 'break') {
      y += 4;
    } else {
      ensureSpace(6);
      printTokens(block.tokens, marginX, 10.5, 6);
      y += 6;
    }
  });

  doc.save(`guion-${(script.title || 'sin-titulo').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`);
}

/* ---------------------------------------------------------------------- */
/* Editor de texto enriquecido (WYSIWYG): negrita/títulos reales al escribir */
/* ---------------------------------------------------------------------- */

function FormatToolbar({ onAction }) {
  const buttons = [
    { icon: Heading1, action: 'h1', title: 'Título grande' },
    { icon: Heading2, action: 'h2', title: 'Subtítulo' },
    { icon: Bold, action: 'bold', title: 'Negrita' },
    { icon: List, action: 'list', title: 'Lista' },
    { icon: Type, action: 'normal', title: 'Quitar formato (volver a texto normal)' },
  ];
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-surfaceAlt p-1 w-fit">
      {buttons.map(({ icon: Icon, action, title }) => (
        <button
          key={action}
          type="button"
          title={title}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAction(action)}
          className="p-1.5 rounded-md text-muted hover:text-cyan hover:bg-surface transition-colors"
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}

function RichEditor({ draft, setDraft }) {
  const editorRef = useRef(null);
  const [wordCount, setWordCount] = useState(0);
  const loadedIdRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && loadedIdRef.current !== draft.id) {
      editorRef.current.innerHTML = markdownLiteToHtml(draft.content || '');
      loadedIdRef.current = draft.id;
      setWordCount((editorRef.current.textContent || '').trim().split(/\s+/).filter(Boolean).length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.id]);

  const handleInput = () => {
    const html = editorRef.current.innerHTML;
    setDraft((d) => ({ ...d, content: html }));
    setWordCount((editorRef.current.textContent || '').trim().split(/\s+/).filter(Boolean).length);
  };

  const applyFormat = (action) => {
    editorRef.current.focus();
    if (action === 'bold') document.execCommand('bold');
    else if (action === 'h1') document.execCommand('formatBlock', false, 'h2');
    else if (action === 'h2') document.execCommand('formatBlock', false, 'h3');
    else if (action === 'list') document.execCommand('insertUnorderedList');
    else if (action === 'normal') {
      // Quita título/lista del bloque actual y la negrita si la hubiera
      document.execCommand('formatBlock', false, 'div');
      if (document.queryCommandState('bold')) document.execCommand('bold');
      if (document.queryCommandState('insertUnorderedList')) document.execCommand('insertUnorderedList');
    }
    handleInput();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <FormatToolbar onAction={applyFormat} />
        <span className="text-muted text-[10.5px]">{wordCount} palabras</span>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        data-placeholder="Escribe el guion aquí... selecciona texto y usa la barra de arriba para darle formato."
        className="rich-editor bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2.5 text-sm w-full outline-none focus:border-cyan leading-relaxed overflow-y-auto"
        style={{ minHeight: 280 }}
      />
      <div className="text-muted text-[10px]">Selecciona texto y pulsa un botón para aplicar formato — el último botón (Aa) lo quita y vuelve al texto normal.</div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function ScriptVideos({ scriptId }) {
  const supabase = useMemo(() => createClient(), []);
  const { list: categoriesList, map: categoriesMap } = useCategories();
  const [videos, setVideos] = useState([]);
  const [form, setForm] = useState({ title: '', type: '', date: '', production_status: 'Guion' });
  const [editingId, setEditingId] = useState(null);
  const [schedulingId, setSchedulingId] = useState(null);
  const [scheduleDate, setScheduleDate] = useState(todayISO());

  useEffect(() => {
    if (!form.type && categoriesList[0]) setForm((f) => ({ ...f, type: categoriesList[0].id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriesList.length]);

  const load = async () => {
    const { data } = await supabase.from('videos').select('*').eq('script_id', scriptId).order('created_at', { ascending: true });
    setVideos(data || []);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`script-videos-${scriptId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'videos' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptId]);

  const add = async () => {
    if (!form.title.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('videos').insert({
      title: form.title.trim(), type: form.type, date: form.date || null,
      production_status: form.production_status, script_id: scriptId, created_by: userData.user.id,
    });
    setForm({ title: '', type: categoriesList[0]?.id || '', date: '', production_status: 'Guion' });
    load();
  };

  const update = async (id, key, value) => {
    setVideos((v) => v.map((x) => (x.id === id ? { ...x, [key]: value } : x)));
    await supabase.from('videos').update({ [key]: value }).eq('id', id);
  };

  const toggle = async (v) => {
    const nextUploaded = !v.uploaded;
    await supabase.from('videos').update({ uploaded: nextUploaded, uploaded_at: nextUploaded ? new Date().toISOString() : null }).eq('id', v.id);
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
      .insert({ title: v.title, type: v.type, date: scheduleDate, status: 'pendiente', script_id: scriptId, notes: v.notes, created_by: userData.user.id })
      .select()
      .single();
    if (entry) {
      await supabase.from('videos').update({ calendar_entry_id: entry.id, production_status: 'Programado' }).eq('id', v.id);
      syncToGoogle(entry.id, 'upsert');
    }
    setSchedulingId(null);
    load();
  };

  const unscheduleFromCalendar = async (v) => {
    if (v.calendar_entry_id) {
      await syncToGoogle(v.calendar_entry_id, 'delete');
      await supabase.from('calendar_entries').delete().eq('id', v.calendar_entry_id);
    }
    await supabase.from('videos').update({ calendar_entry_id: null }).eq('id', v.id);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="text-ink font-semibold text-sm flex items-center gap-1.5"><Film size={15} /> Vídeos de este guion</div>
      <div className="text-muted text-xs -mt-2">
        Viven solo aquí y en el apartado "Vídeos" del menú — no aparecen en el Calendario a menos que tú los añadas allí aparte.
      </div>

      <div className="rounded-lg p-3 bg-surfaceAlt border border-border grid grid-cols-1 sm:grid-cols-[1fr_130px_130px_130px_auto] gap-2">
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
          {categoriesList.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select
          value={form.production_status}
          onChange={(e) => setForm({ ...form, production_status: e.target.value })}
          className="bg-surface border border-border text-ink rounded-lg px-2 py-1.5 text-xs outline-none focus:border-cyan"
        >
          {Object.keys(PRODUCTION_STATUSES).map((s) => <option key={s} value={s}>{s}</option>)}
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
        {videos.length === 0 && <div className="text-muted text-xs text-center py-3">Todavía no hay vídeos para este guion. Añade uno arriba.</div>}
        {videos.map((v) => {
          const meta = categoriesMap[v.type] || { label: 'Sin categoría', color: '#7C878B' };
          const prodColor = (PRODUCTION_STATUSES[v.production_status] || PRODUCTION_STATUSES['Guion']).color;
          const done = v.uploaded;
          const editing = editingId === v.id;
          return (
            <div key={v.id} className="rounded-lg p-2.5 bg-surface border border-border">
              <div className="flex items-center gap-2">
                <button onClick={() => toggle(v)} className="shrink-0" title="Marcar como subido/pendiente">
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
                <select
                  value={v.production_status || 'Guion'}
                  onChange={(e) => update(v.id, 'production_status', e.target.value)}
                  className="rounded px-1.5 py-0.5 text-[10.5px] font-semibold outline-none shrink-0"
                  style={{ background: `${prodColor}1A`, color: prodColor, border: `1px solid ${prodColor}55` }}
                >
                  {Object.keys(PRODUCTION_STATUSES).map((s) => <option key={s} value={s} style={{ color: '#000' }}>{s}</option>)}
                </select>
                {SCHEDULABLE.includes(v.production_status) && !v.calendar_entry_id && (
                  <button
                    onClick={() => { setSchedulingId(schedulingId === v.id ? null : v.id); setScheduleDate(todayISO()); }}
                    className="text-cyan shrink-0"
                    title="Programar en Calendario"
                  >
                    <CalendarPlus size={14} />
                  </button>
                )}
                {v.calendar_entry_id && (
                  <button onClick={() => unscheduleFromCalendar(v)} className="text-muted shrink-0" title="Quitar del Calendario">
                    <CalendarX size={14} />
                  </button>
                )}
                <button onClick={() => setEditingId(editing ? null : v.id)} className="text-muted shrink-0"><Pencil size={13} /></button>
                <button onClick={() => del(v.id)} className="text-red shrink-0"><Trash2 size={13} /></button>
              </div>
              {schedulingId === v.id && (
                <div className="flex items-center gap-2 mt-2 pl-6">
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="bg-surfaceAlt border border-border text-ink rounded px-1.5 py-1 text-[11px] outline-none focus:border-cyan"
                  />
                  <button onClick={() => scheduleToCalendar(v)} className="rounded px-2 py-1 text-[11px] font-semibold bg-cyan text-[#00161C]">Confirmar</button>
                  <button onClick={() => setSchedulingId(null)} className="text-muted text-[11px]">Cancelar</button>
                </div>
              )}
              {editing && (
                <div className="flex items-center gap-2 mt-2 pl-6">
                  <select
                    value={v.type}
                    onChange={(e) => update(v.id, 'type', e.target.value)}
                    className="bg-surfaceAlt border border-border text-ink rounded px-1.5 py-1 text-[11px] outline-none focus:border-cyan"
                  >
                    {categoriesList.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                  <input
                    type="date"
                    value={v.date || ''}
                    onChange={(e) => update(v.id, 'date', e.target.value || null)}
                    className="bg-surfaceAlt border border-border text-ink rounded px-1.5 py-1 text-[11px] outline-none focus:border-cyan"
                  />
                </div>
              )}
              {!editing && (
                <div className="text-[10.5px] pl-6 mt-0.5" style={{ color: meta.color }}>
                  {meta.label}
                  {v.date && <> · {new Date(v.date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</>}
                  {v.calendar_entry_id && <span style={{ color: '#5ECCFA' }}> · en el Calendario</span>}
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
  const emptyQuickForm = { title: '', category: 'General', status: 'Idea' };
  const [quickForm, setQuickForm] = useState(emptyQuickForm);

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

  const quickAdd = async () => {
    if (!quickForm.title.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('scripts').insert({
      title: quickForm.title.trim(),
      category: quickForm.category || 'General',
      content: '',
      status: quickForm.status,
      created_by: userData.user.id,
    });
    setQuickForm(emptyQuickForm);
    load();
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

          <RichEditor draft={draft} setDraft={setDraft} />

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
      <div>
        <h2 className="font-display text-ink text-[22px] tracking-wide">GUIONES</h2>
        <div className="text-muted text-xs">
          Desde una idea suelta hasta el guion grabado, todo en un sitio. Tú y Ana podéis leer y corregir. Toca uno para abrirlo y escribir.
        </div>
      </div>

      <Card className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end sm:flex-wrap">
          <div className="w-full sm:flex-1 sm:min-w-[180px]">
            <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Título / idea</div>
            <input
              value={quickForm.title}
              onChange={(e) => setQuickForm({ ...quickForm, title: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && quickAdd()}
              placeholder="Ej. 3 errores al hacer déficit calórico"
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-full outline-none focus:border-cyan"
            />
          </div>
          <div className="w-full sm:flex-1 sm:min-w-[140px]">
            <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Categoría</div>
            <input
              value={quickForm.category}
              onChange={(e) => setQuickForm({ ...quickForm, category: e.target.value })}
              placeholder="Ej. Pierna, Octubre..."
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-full outline-none focus:border-cyan"
            />
          </div>
          <div className="w-full sm:flex-1 sm:min-w-[140px]">
            <div className="text-muted text-[10.5px] mb-1 uppercase tracking-wide">Etapa</div>
            <select
              value={quickForm.status}
              onChange={(e) => setQuickForm({ ...quickForm, status: e.target.value })}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-full outline-none focus:border-cyan"
            >
              {SCRIPT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button onClick={quickAdd} className="rounded-lg px-3 py-2 flex items-center justify-center gap-1 font-semibold text-sm bg-cyan text-[#00161C] shrink-0 w-full sm:w-auto">
            <Plus size={16} /> Añadir
          </button>
        </div>
      </Card>

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
                background: statusFilter === s ? `${SCRIPT_STATUS_COLORS[s] || '#5ECCFA'}22` : 'transparent',
                border: `1px solid ${statusFilter === s ? (SCRIPT_STATUS_COLORS[s] || '#5ECCFA') : '#212729'}`,
                color: statusFilter === s ? (SCRIPT_STATUS_COLORS[s] || '#5ECCFA') : '#7C878B',
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
            <div className="text-muted text-xs line-clamp-2">
              {s.content ? htmlToPlainSnippet(s.content) : 'Sin contenido todavía.'}
            </div>
            <div className="flex items-center justify-between">
              <span
                className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded"
                style={{ background: `${SCRIPT_STATUS_COLORS[s.status]}22`, color: SCRIPT_STATUS_COLORS[s.status] }}
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
