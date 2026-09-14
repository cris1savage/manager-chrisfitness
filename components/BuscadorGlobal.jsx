'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { phaseColor, todayISO } from '@/lib/timeline';

export default function BuscadorGlobal({ clientes = [] }) {
  const router  = useRouter();
  const [open,   setOpen]   = useState(false);
  const [query,  setQuery]  = useState('');
  const inputRef = useRef(null);

  // Atajo de teclado: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) { setQuery(''); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  const results = query.length >= 1
    ? clientes.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : [];

  const today = todayISO();

  const go = (id) => {
    setOpen(false);
    router.push(`/clientes/${id}`);
  };

  return (
    <>
      {/* Botón trigger */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-muted transition-colors"
        style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}
        title="Buscar cliente (Cmd+K)"
      >
        <Search size={13} />
        <span className="hidden sm:inline">Buscar cliente</span>
        <span className="hidden sm:inline text-[10px] opacity-50 ml-1">⌘K</span>
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search size={16} className="text-muted shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nombre del cliente…"
                className="flex-1 bg-transparent text-ink text-sm outline-none border-none"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-muted">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Resultados */}
            {results.length > 0 && (
              <div className="py-1">
                {results.map((c) => {
                  const phase = (c.phases || []).find((p) => today >= p.start_date && today <= p.end_date);
                  const color = phase ? phaseColor([], phase.name) : 'var(--color-muted)';
                  const latestCheckin = [...(c.tracking_checkins || [])].sort((a, b) => b.month.localeCompare(a.month)).find((x) => x.weight != null);
                  const peso = latestCheckin?.weight ?? null;
                  return (
                    <button
                      key={c.id}
                      onClick={() => go(c.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                      style={{ borderBottom: '1px solid var(--color-border)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surfaceAlt)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ background: `${color}20`, color, border: `1px solid ${color}` }}
                      >
                        {c.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-ink font-semibold text-sm">{c.name}</div>
                        <div className="text-muted text-xs mt-0.5">{phase?.name || 'Sin fase'} · {c.program || 'Sin programa'}</div>
                      </div>
                      {peso != null && (
                        <div className="text-cyan text-sm font-bold shrink-0">{peso} kg</div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {query.length >= 1 && results.length === 0 && (
              <div className="px-4 py-8 text-center text-muted text-sm">
                Sin resultados para "{query}"
              </div>
            )}

            {!query && (
              <div className="px-4 py-6 text-center text-muted text-xs">
                Escribe el nombre del cliente para buscarlo
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
