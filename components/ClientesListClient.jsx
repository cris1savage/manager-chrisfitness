'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Plus, LogOut, TrendingDown, TrendingUp, Minus,
  ChevronRight, AlertTriangle, Bell, Calendar, Users, CheckCircle, Phone, Check as CheckIcon, Trash2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { phaseColor, todayISO, mondayOf, addDaysISO } from '@/lib/timeline';
import NuevoClienteModal from './NuevoClienteModal';
import Logo from './Logo';
import BuscadorGlobal from './BuscadorGlobal';
import InstallAppButton from './InstallAppButton';

/* ─── helpers ─────────────────────────────────────────────── */
function getLatestWeight(c) {
  const ch = (c.tracking_checkins || []).filter((x) => x.weight != null).sort((a, b) => b.month.localeCompare(a.month));
  if (ch[0]) return ch[0].weight;
  const wk = (c.tracking_timeline_weeks || []).filter((x) => x.real_weight != null).sort((a, b) => b.week_start.localeCompare(a.week_start));
  return wk[0]?.real_weight ?? null;
}

function getWeightDiff(c) {
  const ch = (c.tracking_checkins || []).filter((x) => x.weight != null).sort((a, b) => a.month.localeCompare(b.month));
  if (ch.length >= 2) return Math.round((ch[ch.length - 1].weight - ch[0].weight) * 10) / 10;
  return null;
}

function getCurrentPhase(c) {
  const today = todayISO();
  return (c.phases || []).find((p) => today >= p.start_date && today <= p.end_date) || null;
}

function getGoalStatus(c) {
  const m = todayISO().slice(0, 7);
  return (c.tracking_checkins || []).find((x) => x.month === m)?.goal_status || null;
}

function daysSinceWeight(c) {
  const today = todayISO();
  // Buscar el registro más reciente con peso en checkins mensuales
  const ch = (c.tracking_checkins || []).filter((x) => x.weight != null).sort((a, b) => b.month.localeCompare(a.month));
  if (ch[0]) {
    // Calculamos desde el primer día del mes más reciente con peso
    const d = new Date(`${ch[0].month}-01T00:00:00`);
    const diff = (new Date(today) - d) / 86400000;
    return Math.floor(diff);
  }
  // Si no, miramos el real_weight más reciente del timeline
  const wk = (c.tracking_timeline_weeks || []).filter((x) => x.real_weight != null).sort((a, b) => b.week_start.localeCompare(a.week_start));
  if (wk[0]) {
    const diff = (new Date(today) - new Date(`${wk[0].week_start}T00:00:00`)) / 86400000;
    return Math.floor(diff);
  }
  return 999;
}

function nextCall(c) {
  const today = todayISO();
  const upcoming = (c.tracking_checkins || [])
    .filter((x) => x.call_date && x.call_date >= today && !x.call_done)
    .sort((a, b) => a.call_date.localeCompare(b.call_date));
  return upcoming[0]?.call_date || null;
}

function daysUntil(dateISO) {
  return Math.ceil((new Date(`${dateISO}T00:00:00`) - new Date()) / 86400000);
}

const GOAL_COLOR = { Cumplido: '#4ADE80', Parcial: '#FBBF24', 'No cumplido': '#F87171' };

/* ─── componente principal ───────────────────────────────── */
export default function ClientesListClient({ clientes }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [search,    setSearch]    = useState('');
  const [showNuevo, setShowNuevo] = useState(false);
  const [view,      setView]      = useState('lista'); // 'lista' | 'alertas' | 'semana' | 'llamadas'

  // Notas/guion de llamada — estado local editable, se guarda en client_checkins.call_notes
  const [callNotes, setCallNotes] = useState(() => {
    const map = {};
    clientes.forEach((c) => (c.tracking_checkins || []).forEach((ch) => { if (ch.call_notes != null) map[ch.id] = ch.call_notes; }));
    return map;
  });
  const [savedNoteId, setSavedNoteId] = useState(null);

  const saveCallNote = async (checkinId, value) => {
    await supabase.from('tracking_checkins').update({ call_notes: value }).eq('id', checkinId);
    setSavedNoteId(checkinId);
    setTimeout(() => setSavedNoteId((id) => id === checkinId ? null : id), 1500);
  };

  const toggleCallDone = async (checkinId, current) => {
    await supabase.from('tracking_checkins').update({ call_done: !current }).eq('id', checkinId);
    router.refresh();
  };

  const today       = todayISO();
  const thisMonth   = today.slice(0, 7);
  const thisWeekStart = mondayOf(today);

  // Alertas silenciadas — persisten en sessionStorage para esta sesión
  const [silenced, setSilenced] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('cf_silenced') || '{}'); } catch { return {}; }
  });
  const silence = (key) => {
    const next = { ...silenced, [key]: Date.now() };
    setSilenced(next);
    try { sessionStorage.setItem('cf_silenced', JSON.stringify(next)); } catch {}
  };
  const isSilenced = (key) => !!silenced[key];

  /* ── alertas ── */
  const alertas = useMemo(() => {
    const out = [];
    clientes.forEach((c) => {
      const dias = daysSinceWeight(c);
      if (dias > 14 && !isSilenced(`peso_${c.id}`)) out.push({ tipo: 'sin_peso', cliente: c, valor: dias, silenceKey: `peso_${c.id}` });

      const call = nextCall(c);
      if (call) {
        const d = daysUntil(call);
        if (d <= 3 && !isSilenced(`call_${c.id}`)) out.push({ tipo: 'llamada', cliente: c, valor: call, dias: d, silenceKey: `call_${c.id}` });
      }

      const gs = getGoalStatus(c);
      if (gs === 'No cumplido' && !isSilenced(`obj_${c.id}`)) out.push({ tipo: 'objetivo', cliente: c, silenceKey: `obj_${c.id}` });

      const hasMonth = (c.tracking_checkins || []).some((x) => x.month === thisMonth);
      if (!hasMonth && !isSilenced(`mes_${c.id}`)) out.push({ tipo: 'sin_mes', cliente: c, silenceKey: `mes_${c.id}` });
    });
    return out;
  }, [clientes, thisMonth, silenced]);

  /* ── parte semanal ── */
  const semana = useMemo(() => clientes.map((c) => {
    const week = (c.tracking_timeline_weeks || []).find((w) => w.week_start === thisWeekStart);
    const realW = week?.real_weight;
    const targetW = week?.target_weight;
    const diff = realW != null && targetW != null ? Math.round((realW - targetW) * 10) / 10 : null;
    return { c, week, realW, targetW, diff };
  }), [clientes, thisWeekStart]);

  /* ── llamadas programadas (todas las que tienen fecha) ── */
  const llamadas = useMemo(() => {
    const out = [];
    clientes.forEach((c) => {
      (c.tracking_checkins || []).forEach((ch) => {
        if (ch.call_date) out.push({ cliente: c, checkin: ch });
      });
    });
    return out.sort((a, b) => a.checkin.call_date.localeCompare(b.checkin.call_date));
  }, [clientes]);
  const proximasLlamadas = llamadas.filter((l) => !l.checkin.call_done && l.checkin.call_date >= today);
  const pasadasLlamadas  = llamadas.filter((l) => l.checkin.call_done || l.checkin.call_date < today).reverse();

  /* ── lista filtrada ── */
  const filtered = useMemo(() =>
    clientes.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [clientes, search]
  );

  const handleLogout = async () => {
    await createClient().auth.signOut();
    router.push('/login'); router.refresh();
  };

  const eliminarCliente = async (cliente, e) => {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar a ${cliente.name} del panel de seguimiento?\n\nSe borrarán todos sus datos de peso, fases y seguimiento. Esta acción no se puede deshacer.`)) return;
    const sb = createClient();
    await sb.from('tracking_clients').delete().eq('id', cliente.id);
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-bg">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Logo size={30} className="text-cyan shrink-0" />
            <div>
              <div className="font-display text-ink text-[17px] tracking-wide leading-none">CHRIS FITNESS</div>
              <div className="text-violet text-[9px] tracking-widest uppercase mt-0.5">Panel de seguimiento</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BuscadorGlobal clientes={clientes} />
            <InstallAppButton />
            <button onClick={() => setShowNuevo(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: 'var(--color-violet)', color: '#0D0A1F' }}>
              <Plus size={13} /> Añadir
            </button>
            <button onClick={handleLogout} className="p-2 text-muted hover:text-ink" title="Cerrar sesión">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* ── Tabs de vista ── */}
        <div className="max-w-4xl mx-auto px-4 flex gap-1 pb-0 overflow-x-auto">
          {[
            { key: 'lista',    label: 'Clientes',  icon: Users    },
            { key: 'alertas',  label: `Alertas${alertas.length ? ` (${alertas.length})` : ''}`, icon: Bell },
            { key: 'llamadas', label: `Llamadas${proximasLlamadas.length ? ` (${proximasLlamadas.length})` : ''}`, icon: Phone },
            { key: 'semana',   label: 'Esta semana', icon: Calendar },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setView(key)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors"
              style={{
                borderColor: view === key ? 'var(--color-cyan)' : 'transparent',
                color: view === key ? 'var(--color-cyan)' : 'var(--color-muted)',
              }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">

        {/* ══════════════ VISTA LISTA ══════════════ */}
        {view === 'lista' && (
          <>
            {/* Stats */}
            {(() => {
              const sinMes = clientes.filter((c) => !(c.tracking_checkins || []).some((x) => x.month === thisMonth));
              return (
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl p-3 text-center" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
                    <div className="text-ink text-xl font-bold">{clientes.length}</div>
                    <div className="text-muted text-[10px] mt-0.5">Activos</div>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
                    <div className="text-xl font-bold text-green">{clientes.filter((c) => getGoalStatus(c) === 'Cumplido').length}</div>
                    <div className="text-muted text-[10px] mt-0.5">Objetivo cumplido</div>
                  </div>
                  <button
                    onClick={() => sinMes.length > 0 && setView('alertas')}
                    className="rounded-xl p-3 text-center transition-all"
                    style={{
                      background: sinMes.length > 0 ? 'rgba(167,139,250,0.1)' : 'var(--color-surfaceAlt)',
                      border: `1px solid ${sinMes.length > 0 ? 'var(--color-violet)' : 'var(--color-border)'}`,
                    }}
                  >
                    <div className="text-xl font-bold" style={{ color: sinMes.length > 0 ? 'var(--color-violet)' : 'var(--color-ink)' }}>{sinMes.length}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: sinMes.length > 0 ? 'var(--color-violet)' : 'var(--color-muted)' }}>
                      {sinMes.length > 0 ? 'Ver alertas →' : 'Al día'}
                    </div>
                  </button>
                </div>
              );
            })()}

            {/* Buscador */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={`Buscar entre ${clientes.length} clientes…`}
                className="w-full bg-surface border border-border text-ink rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-cyan" />
            </div>

            {/* Lista */}
            {filtered.length === 0
              ? <div className="text-center py-12 text-muted text-sm">No se encontraron clientes.</div>
              : (
                <div className="space-y-2">
                  {filtered.map((c) => {
                    const w    = getLatestWeight(c);
                    const diff = getWeightDiff(c);
                    const ph   = getCurrentPhase(c);
                    const gs   = getGoalStatus(c);
                    const dias = daysSinceWeight(c);
                    const col  = ph ? phaseColor([], ph.name) : 'var(--color-muted)';

                    return (
                      <div key={c.id}
                        className="w-full text-left rounded-xl p-4 cursor-pointer"
                        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                        onClick={() => router.push(`/clientes/${c.id}`)}>
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                            style={{ background: `${col}20`, color: col, border: `1px solid ${col}` }}>
                            {c.name?.[0]?.toUpperCase()}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-ink font-semibold text-sm">{c.name}</span>
                              {ph && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                  style={{ background: `${col}18`, color: col }}>{ph.name}</span>
                              )}
                              {gs && GOAL_COLOR[gs] && (
                                <span className="text-[10px] font-bold" style={{ color: GOAL_COLOR[gs] }}>{gs}</span>
                              )}
                              {dias > 14 && (
                                <span className="text-[10px] font-bold text-amber flex items-center gap-0.5">
                                  <AlertTriangle size={10} /> {dias}d sin peso
                                </span>
                              )}
                            </div>
                            <div className="text-muted text-xs mt-0.5">{c.program || 'Sin programa'}</div>
                          </div>
                          {/* Peso */}
                          <div className="text-right shrink-0">
                            {w != null ? (
                              <>
                                <div className="text-cyan text-base font-bold">{w} kg</div>
                                {diff != null && (
                                  <div className="flex items-center justify-end gap-0.5 text-[11px] font-semibold"
                                    style={{ color: diff < 0 ? 'var(--color-green)' : diff > 0 ? 'var(--color-red)' : 'var(--color-muted)' }}>
                                    {diff < 0 ? <TrendingDown size={11} /> : diff > 0 ? <TrendingUp size={11} /> : <Minus size={11} />}
                                    {diff > 0 ? '+' : ''}{diff} kg
                                  </div>
                                )}
                              </>
                            ) : <div className="text-muted text-xs">Sin peso</div>}
                          </div>
                          <ChevronRight size={15} className="text-muted shrink-0" />
                          <button
                            onClick={(e) => eliminarCliente(c, e)}
                            className="p-1.5 rounded-lg text-muted hover:text-red transition-colors shrink-0"
                            title="Eliminar cliente"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </>
        )}

        {/* ══════════════ VISTA ALERTAS ══════════════ */}
        {view === 'alertas' && (
          <>
            {alertas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <CheckCircle size={36} className="text-green opacity-60" />
                <div className="text-ink font-semibold">Todo en orden</div>
                <div className="text-muted text-sm text-center">No hay alertas pendientes. Todos los clientes están al día.</div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Agrupar por tipo */}
                {[
                  {
                    tipo: 'llamada', label: 'Videollamadas próximas', color: '#5ECCFA',
                    render: (a) => `${a.dias === 0 ? 'HOY' : a.dias === 1 ? 'mañana' : `en ${a.dias} días`} — ${a.valor}`,
                  },
                  {
                    tipo: 'sin_peso', label: 'Sin registro de peso +14 días', color: '#FBBF24',
                    render: (a) => `${a.valor === 999 ? 'Nunca registrado' : `${a.valor} días sin actualizar`}`,
                  },
                  {
                    tipo: 'objetivo', label: 'Objetivo no cumplido este mes', color: '#F87171',
                    render: () => 'Objetivo marcado como no cumplido',
                  },
                  {
                    tipo: 'sin_mes', label: 'Sin seguimiento este mes', color: '#A78BFA',
                    render: () => 'Falta crear el seguimiento del mes actual',
                  },
                ].map(({ tipo, label, color, render }) => {
                  const grupo = alertas.filter((a) => a.tipo === tipo);
                  if (!grupo.length) return null;
                  // Deep link según el tipo de alerta
                  const deepLink = (a) => {
                    if (a.tipo === 'sin_peso')  return `/clientes/${a.cliente.id}/timeline`;
                    if (a.tipo === 'llamada')   return `/clientes/${a.cliente.id}/mes`;
                    if (a.tipo === 'objetivo')  return `/clientes/${a.cliente.id}/mes`;
                    if (a.tipo === 'sin_mes')   return `/clientes/${a.cliente.id}/mes`;
                    return `/clientes/${a.cliente.id}`;
                  };
                  return (
                    <div key={tipo}>
                      <div className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color }}>
                        <AlertTriangle size={10} /> {label} ({grupo.length})
                      </div>
                      <div className="space-y-1.5 mb-4">
                        {grupo.map((a, i) => (
                          <div key={i} className="rounded-xl px-4 py-3 flex items-center gap-3"
                            style={{ background: 'var(--color-surface)', border: `1px solid ${color}28` }}>
                            <button onClick={() => router.push(deepLink(a))} className="flex items-center gap-3 flex-1 text-left">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                                style={{ background: `${color}20`, color }}>
                                {a.cliente.name?.[0]?.toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-ink text-sm font-semibold">{a.cliente.name}</div>
                                <div className="text-muted text-xs mt-0.5">{render(a)}</div>
                              </div>
                              <ChevronRight size={14} className="text-muted shrink-0" />
                            </button>
                            <button
                              onClick={() => silence(a.silenceKey)}
                              title="Ignorar hasta la próxima sesión"
                              className="text-muted text-[10px] px-2 py-1 rounded-lg shrink-0 hover:text-ink transition-colors"
                              style={{ border: '1px solid var(--color-border)' }}
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ══════════════ VISTA LLAMADAS ══════════════ */}
        {view === 'llamadas' && (
          <>
            {llamadas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Phone size={36} className="text-muted opacity-50" />
                <div className="text-ink font-semibold">No hay llamadas programadas</div>
                <div className="text-muted text-sm text-center">Programa la fecha de la videollamada mensual desde la pestaña "Mes actual" de cada cliente.</div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Próximas */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5 text-cyan">
                    <Phone size={10} /> Próximas ({proximasLlamadas.length})
                  </div>
                  {proximasLlamadas.length === 0 ? (
                    <div className="text-muted text-xs px-1">No hay llamadas próximas pendientes.</div>
                  ) : (
                    <div className="space-y-2">
                      {proximasLlamadas.map(({ cliente: c, checkin: ch }) => {
                        const d = daysUntil(ch.call_date);
                        const dLabel = d === 0 ? 'HOY' : d === 1 ? 'MAÑANA' : `en ${d} días`;
                        const col = d <= 1 ? '#F87171' : d <= 3 ? '#FBBF24' : '#5ECCFA';
                        return (
                          <div key={ch.id} className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: `1px solid ${col}28` }}>
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <button onClick={() => router.push(`/clientes/${c.id}/mes`)} className="flex items-center gap-3 flex-1 text-left min-w-0">
                                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                                  style={{ background: `${col}20`, color: col }}>
                                  {c.name?.[0]?.toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-ink text-sm font-semibold truncate">{c.name}</div>
                                  <div className="text-xs mt-0.5" style={{ color: col }}>{dLabel} · {ch.call_date}</div>
                                </div>
                              </button>
                              <button onClick={() => toggleCallDone(ch.id, ch.call_done)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold shrink-0"
                                style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
                                <CheckIcon size={10} /> Marcar hecha
                              </button>
                            </div>
                            <textarea
                              defaultValue={callNotes[ch.id] || ''}
                              onChange={(e) => setCallNotes((m) => ({ ...m, [ch.id]: e.target.value }))}
                              onBlur={(e) => saveCallNote(ch.id, e.target.value)}
                              placeholder="Guion / notas de qué hablar en esta llamada..."
                              rows={2}
                              className="w-full bg-surfaceAlt border border-border text-ink text-xs rounded-lg px-2.5 py-2 outline-none focus:border-cyan resize-none leading-relaxed" />
                            {savedNoteId === ch.id && <div className="text-[10px] text-green mt-1">Guardado</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Pasadas / realizadas recientes */}
                {pasadasLlamadas.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5 text-muted">
                      Historial reciente ({pasadasLlamadas.length})
                    </div>
                    <div className="space-y-1.5">
                      {pasadasLlamadas.slice(0, 15).map(({ cliente: c, checkin: ch }) => (
                        <button key={ch.id} onClick={() => router.push(`/clientes/${c.id}/mes`)}
                          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left"
                          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                            style={{ background: ch.call_done ? '#4ADE8020' : '#F8717120', color: ch.call_done ? 'var(--color-green)' : 'var(--color-red)' }}>
                            {c.name?.[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-ink text-xs font-semibold truncate">{c.name}</div>
                            <div className="text-muted text-[10px]">{ch.call_date} · {ch.call_done ? 'Realizada' : 'No realizada'}</div>
                          </div>
                          <ChevronRight size={13} className="text-muted shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ══════════════ VISTA SEMANA ══════════════ */}
        {view === 'semana' && (
          <>
            <div className="text-muted text-xs mb-1">
              Semana del <span className="text-ink font-semibold">{thisWeekStart}</span>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
              {/* Cabecera */}
              <div className="grid grid-cols-[1fr_80px_80px_80px_60px] px-4 py-2.5 text-muted text-[10px] uppercase tracking-widest"
                style={{ background: 'var(--color-surfaceAlt)' }}>
                <div>Cliente</div>
                <div className="text-center">Objetivo</div>
                <div className="text-center">Real</div>
                <div className="text-center">Dif.</div>
                <div className="text-center">Kcal</div>
              </div>
              {semana.map(({ c, week, realW, targetW, diff }, idx) => {
                const ph  = getCurrentPhase(c);
                const col = ph ? phaseColor([], ph.name) : 'var(--color-muted)';
                const kcal = week?.kcal_on ?? week?.kcal ?? null;
                return (
                  <button key={c.id} onClick={() => router.push(`/clientes/${c.id}/timeline`)}
                    className="w-full grid grid-cols-[1fr_80px_80px_80px_60px] px-4 py-3 items-center text-left transition-colors hover:bg-surfaceAlt"
                    style={{
                      background: idx % 2 === 0 ? 'var(--color-bg)' : 'var(--color-surface)',
                      borderTop: '1px solid var(--color-border)',
                    }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: `${col}20`, color: col }}>
                        {c.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-ink text-xs font-semibold truncate">{c.name}</div>
                        {ph && <div className="text-[10px] font-semibold" style={{ color: col }}>{ph.name}</div>}
                      </div>
                    </div>
                    <div className="text-center text-xs text-muted">{targetW != null ? `${targetW} kg` : '—'}</div>
                    <div className="text-center text-xs font-semibold" style={{ color: realW != null ? 'var(--color-cyan)' : 'var(--color-muted)' }}>
                      {realW != null ? `${realW} kg` : '—'}
                    </div>
                    <div className="text-center text-xs font-bold"
                      style={{ color: diff == null ? 'var(--color-muted)' : diff <= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                      {diff != null ? `${diff > 0 ? '+' : ''}${diff}` : '—'}
                    </div>
                    <div className="text-center text-xs text-muted">{kcal ?? '—'}</div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </main>

      {showNuevo && <NuevoClienteModal onClose={() => setShowNuevo(false)} />}
    </div>
  );
}
