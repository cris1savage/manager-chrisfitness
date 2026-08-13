'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AuthorBadge } from '@/components/ui';
import { useProfiles } from '@/components/ProfilesProvider';

const TABLE_LABELS = {
  leads: 'un lead',
  conversations: 'una conversación',
  invites: 'una invitación',
  calls: 'una videollamada',
  sales: 'una venta',
  ad_spend: 'un gasto en anuncios',
  referrals: 'un referido',
  content_ideas: 'una idea de contenido',
  active_clients: 'un cliente activo',
  tasks: 'una tarea',
  calendar_entries: 'un contenido del calendario',
  notes: 'una nota',
};

const ACTION_LABELS = { insert: 'añadió', update: 'editó', delete: 'eliminó' };

export default function ActivityFeed({ limit = 12 }) {
  const supabase = useMemo(() => createClient(), []);
  const profiles = useProfiles();
  const [items, setItems] = useState([]);

  const load = async () => {
    const { data } = await supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    setItems(data || []);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('activity-log-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  if (items.length === 0) {
    return <div className="text-muted text-sm py-4 text-center">Todavía no hay actividad registrada.</div>;
  }

  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <div key={it.id} className="flex items-start gap-2.5">
          <AuthorBadge profile={profiles?.[it.actor]} />
          <div className="min-w-0 flex-1">
            <div className="text-ink text-[13px]">
              <span className="font-semibold">{profiles?.[it.actor]?.display_name || 'Alguien'}</span>{' '}
              {ACTION_LABELS[it.action] || it.action} {TABLE_LABELS[it.table_name] || it.table_name}
              {it.summary ? <span className="text-muted"> · {it.summary}</span> : null}
            </div>
            <div className="text-muted text-[10.5px]">
              {new Date(it.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
