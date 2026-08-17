'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2, Settings, X, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui';
import { useCategories } from '@/components/CategoriesProvider';

const SWATCHES = ['#5ECCFA', '#4ADE80', '#FBBF24', '#F87171', '#A78BFA', '#F472B6', '#38BDF8', '#FB923C'];

export default function CategoriesManager({ onClose }) {
  const supabase = useMemo(() => createClient(), []);
  const { list } = useCategories();
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#5ECCFA');
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('#5ECCFA');

  const add = async () => {
    if (!newLabel.trim()) return;
    const id = `cat_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    await supabase.from('content_categories').insert({
      id, label: newLabel.trim(), color: newColor, sort_order: list.length + 1,
    });
    setNewLabel('');
    setNewColor('#5ECCFA');
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditLabel(c.label);
    setEditColor(c.color);
  };

  const saveEdit = async () => {
    await supabase.from('content_categories').update({ label: editLabel.trim(), color: editColor }).eq('id', editingId);
    setEditingId(null);
  };

  const remove = async (id) => {
    await supabase.from('content_categories').delete().eq('id', id);
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-ink font-semibold text-sm flex items-center gap-1.5"><Settings size={15} /> Categorías de contenido</div>
        {onClose && <button onClick={onClose} className="text-muted"><X size={16} /></button>}
      </div>
      <div className="text-muted text-xs -mt-2">Estas categorías se usan igual en Calendario, Guiones y Vídeos.</div>

      <div className="space-y-1.5">
        {list.map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-lg p-2 bg-surfaceAlt border border-border">
            {editingId === c.id ? (
              <>
                <input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="w-7 h-7 rounded shrink-0 bg-transparent border-none cursor-pointer"
                />
                <input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="bg-surface border border-border text-ink rounded px-2 py-1 text-sm flex-1 min-w-0 outline-none focus:border-cyan"
                />
                <button onClick={saveEdit} className="text-cyan shrink-0"><Check size={16} /></button>
                <button onClick={() => setEditingId(null)} className="text-muted shrink-0"><X size={16} /></button>
              </>
            ) : (
              <>
                <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: c.color }} />
                <span className="text-ink text-sm flex-1 min-w-0 truncate">{c.label}</span>
                <button onClick={() => startEdit(c)} className="text-muted text-xs shrink-0">Editar</button>
                <button onClick={() => remove(c.id)} className="text-red shrink-0"><Trash2 size={14} /></button>
              </>
            )}
          </div>
        ))}
        {list.length === 0 && <div className="text-muted text-xs text-center py-3">Sin categorías todavía.</div>}
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <div className="text-muted text-[10.5px] uppercase tracking-wide">Nueva categoría</div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Ej. Carrusel Instagram"
            className="bg-surfaceAlt border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm flex-1 min-w-[140px] outline-none focus:border-cyan"
          />
          <div className="flex items-center gap-1">
            {SWATCHES.map((sw) => (
              <button
                key={sw}
                onClick={() => setNewColor(sw)}
                className="w-6 h-6 rounded-full shrink-0"
                style={{ background: sw, border: newColor === sw ? '2px solid white' : '2px solid transparent' }}
              />
            ))}
          </div>
          <button onClick={add} className="rounded-lg px-3 py-1.5 font-semibold text-xs bg-cyan text-[#00161C] flex items-center gap-1 shrink-0">
            <Plus size={14} /> Añadir
          </button>
        </div>
      </div>
    </Card>
  );
}
