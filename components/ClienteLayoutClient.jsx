'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, BarChart2, Calendar, GitBranch, BookOpen, Layers, Copy, Check } from 'lucide-react';
import { phaseColor, readToken } from '@/lib/timeline';
import Logo from '@/components/Logo';

const TABS = [
  { key: 'resumen',   label: 'Resumen',    icon: BarChart2 },
  { key: 'mes',       label: 'Mes actual', icon: Calendar  },
  { key: 'medidas',   label: 'Medidas',    icon: Layers    },
  { key: 'timeline',  label: 'Timeline',   icon: GitBranch },
  { key: 'fases',     label: 'Fases',      icon: GitBranch },
  { key: 'historial', label: 'Historial',  icon: BookOpen  },
];

export default function ClienteLayoutClient({ cliente, children }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [copied, setCopied] = useState(false);

  const activeTab = TABS.find((t) => pathname.endsWith(`/${t.key}`))?.key || 'resumen';
  const today  = new Date().toISOString().slice(0, 10);
  const phases = cliente.phases || [];
  const phase  = phases.find((p) => today >= p.start_date && today <= p.end_date) || null;
  const color  = phase ? phaseColor(phases, phase.name) : 'var(--color-muted)';
  const token  = cliente.read_token || readToken(cliente.id);

  const copyLink = async () => {
    const url = `${window.location.origin}/ver/${token}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4">

          {/* Fila nombre */}
          <div className="flex items-center gap-3 py-3">
            <button
              onClick={() => { router.push('/clientes'); router.refresh(); }}
              className="text-muted hover:text-ink shrink-0 transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft size={16} />
              <Logo size={18} className="text-cyan" />
            </button>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
              style={{ background: `${color}20`, color, border: `1px solid ${color}` }}>
              {cliente.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-ink font-bold text-base leading-tight truncate">{cliente.name}</div>
              <div className="text-muted text-xs truncate">
                {cliente.program || 'Sin programa'} · {cliente.duration || ''} · {cliente.status}
              </div>
            </div>
            {phase && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg shrink-0"
                style={{ background: `${color}18`, color }}>{phase.name}</span>
            )}
            <button
              onClick={copyLink}
              title={copied ? '¡Copiado!' : 'Copiar enlace del cliente'}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all"
              style={{
                background: copied ? '#4ADE8018' : 'var(--color-surfaceAlt)',
                color:      copied ? 'var(--color-green)' : 'var(--color-muted)',
                border:     `1px solid ${copied ? 'var(--color-green)' : 'var(--color-border)'}`,
              }}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span className="hidden sm:inline">{copied ? 'Copiado' : 'Enlace cliente'}</span>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {TABS.map((t) => {
              const Icon     = t.icon;
              const isActive = activeTab === t.key;
              return (
                <Link key={t.key} href={`/clientes/${cliente.id}/${t.key}`}
                  className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors"
                  style={{
                    borderColor: isActive ? 'var(--color-cyan)' : 'transparent',
                    color:       isActive ? 'var(--color-cyan)' : 'var(--color-muted)',
                  }}>
                  <Icon size={12} /> {t.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
