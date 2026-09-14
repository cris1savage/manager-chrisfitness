'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Users, Film, Megaphone, Activity } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui';
import { useProfiles } from '@/components/ProfilesProvider';
import { eur, dateToISO } from '@/lib/config';

function startOfWeek(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function TeamClient() {
  const supabase = useMemo(() => createClient(), []);
  const profiles = useProfiles();
  const [data, setData] = useState(null);

  const load = async () => {
    const [tasks, contacts, calendarEntries, adSpend] = await Promise.all([
      supabase.from('tasks').select('*'),
      supabase.from('contacts').select('*'),
      supabase.from('calendar_entries').select('*'),
      supabase.from('ad_spend').select('*'),
    ]);
    setData({
      tasks: tasks.data || [],
      contacts: contacts.data || [],
      calendarEntries: calendarEntries.data || [],
      adSpend: adSpend.data || [],
    });
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('team-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = startOfWeek(new Date());
  const startISO = dateToISO(start);

  const profileList = Object.values(profiles || {});

  if (!data) return <div className="text-muted py-12 text-center">Cargando…</div>;

  const statsFor = (userId) => {
    const tasksDone = data.tasks.filter((t) => t.assigned_to === userId && t.done && t.completed_at && t.completed_at.slice(0, 10) >= startISO).length;
    const tasksPending = data.tasks.filter((t) => t.assigned_to === userId && !t.done).length;
    const contactsAdded = data.contacts.filter((c) => c.created_by === userId && c.created_at.slice(0, 10) >= startISO).length;
    const contactsMoved = data.contacts.filter((c) => c.created_by === userId && c.stage_updated_at.slice(0, 10) >= startISO).length;
    const sales = data.contacts.filter((c) => c.created_by === userId && c.stage === 'Cliente' && c.stage_updated_at.slice(0, 10) >= startISO);
    const contentUploaded = data.calendarEntries.filter((e) => e.created_by === userId && e.status === 'hecho' && e.date >= startISO).length;
    const adsAdded = data.adSpend.filter((a) => a.created_by === userId && a.created_at.slice(0, 10) >= startISO).length;
    const revenue = sales.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    return { tasksDone, tasksPending, contactsAdded, contactsMoved, salesCount: sales.length, revenue, contentUploaded, adsAdded };
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-ink text-[22px] tracking-wide">EQUIPO</h2>
        <div className="text-muted text-xs">Qué ha hecho cada uno esta semana ({start.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} en adelante). Visible para las dos cuentas.</div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {profileList.map((p) => {
          const s = statsFor(p.id);
          return (
            <Card key={p.id} className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold bg-cyan/15 text-cyan border border-cyan/30">
                  {(p.display_name || '?').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-ink font-bold">{p.display_name}</div>
                  <div className="text-muted text-xs">{p.role_title}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg p-2.5 bg-surfaceAlt border border-border">
                  <div className="flex items-center gap-1.5 text-muted text-[10px] uppercase tracking-wide mb-1"><CheckSquare size={12} /> Tareas cumplidas</div>
                  <div className="text-ink font-display text-lg">{s.tasksDone}</div>
                </div>
                <div className="rounded-lg p-2.5 bg-surfaceAlt border border-border">
                  <div className="flex items-center gap-1.5 text-muted text-[10px] uppercase tracking-wide mb-1"><CheckSquare size={12} /> Tareas pendientes</div>
                  <div className="text-ink font-display text-lg">{s.tasksPending}</div>
                </div>
                <div className="rounded-lg p-2.5 bg-surfaceAlt border border-border">
                  <div className="flex items-center gap-1.5 text-muted text-[10px] uppercase tracking-wide mb-1"><Users size={12} /> Contactos movidos</div>
                  <div className="text-ink font-display text-lg">{s.contactsMoved}</div>
                </div>
                <div className="rounded-lg p-2.5 bg-surfaceAlt border border-border">
                  <div className="flex items-center gap-1.5 text-muted text-[10px] uppercase tracking-wide mb-1"><Film size={12} /> Contenido subido</div>
                  <div className="text-ink font-display text-lg">{s.contentUploaded}</div>
                </div>
              </div>

              {s.salesCount > 0 && (
                <div className="rounded-lg p-2.5 bg-green/10 border border-green/30">
                  <div className="text-green text-xs font-semibold">{s.salesCount} venta{s.salesCount !== 1 ? 's' : ''} cerrada{s.salesCount !== 1 ? 's' : ''} · {eur(s.revenue)}</div>
                </div>
              )}
              {s.adsAdded > 0 && (
                <div className="flex items-center gap-1.5 text-muted text-xs">
                  <Megaphone size={12} /> {s.adsAdded} anuncio{s.adsAdded !== 1 ? 's' : ''} añadido{s.adsAdded !== 1 ? 's' : ''} esta semana
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="text-muted text-[11.5px] uppercase tracking-wide mb-1 flex items-center gap-1.5"><Activity size={13} /> Nota</div>
        <div className="text-muted text-xs">
          Los contactos cuentan como "movidos" si esa cuenta los creó o les cambió la etapa esta semana. Las tareas cumplidas se cuentan por a quién estaban asignadas, no por quién las creó.
        </div>
      </Card>
    </div>
  );
}
