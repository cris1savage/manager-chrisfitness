'use client';

import { useEffect, useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, AuthorBadge } from '@/components/ui';
import { useProfiles } from '@/components/ProfilesProvider';
import { eur, monthKey, todayISO } from '@/lib/config';

export default function VentasClient() {
  const supabase = useMemo(() => createClient(), []);
  const profiles = useProfiles();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase.from('contacts').select('*').eq('stage', 'Cliente').order('stage_updated_at', { ascending: false });
    setClients(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('ventas-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const thisMonth = monthKey(todayISO());
  const totalAll = clients.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const totalMonth = clients
    .filter((c) => monthKey(c.stage_updated_at) === thisMonth)
    .reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const countMonth = clients.filter((c) => monthKey(c.stage_updated_at) === thisMonth).length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-ink text-[22px] tracking-wide">VENTAS</h2>
        <div className="text-muted text-xs">
          Se rellena solo cuando mueves un contacto a la etapa "Cliente". Para editarlas, ve a Contactos.
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="flex items-center gap-3">
          <div className="rounded-lg p-2.5 bg-cyan/15"><TrendingUp size={20} color="#5ECCFA" /></div>
          <div>
            <div className="text-muted text-[11.5px] uppercase tracking-wide">Ventas este mes</div>
            <div className="text-ink text-xl font-extrabold font-display">{countMonth}</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="rounded-lg p-2.5 bg-green/15"><TrendingUp size={20} color="#4ADE80" /></div>
          <div>
            <div className="text-muted text-[11.5px] uppercase tracking-wide">Facturado este mes</div>
            <div className="text-ink text-xl font-extrabold font-display">{eur(totalMonth)}</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3 col-span-2 md:col-span-1">
          <div className="rounded-lg p-2.5 bg-amber/15"><TrendingUp size={20} color="#FBBF24" /></div>
          <div>
            <div className="text-muted text-[11.5px] uppercase tracking-wide">Facturado histórico</div>
            <div className="text-ink text-xl font-extrabold font-display">{eur(totalAll)}</div>
          </div>
        </Card>
      </div>

      <div className="space-y-2">
        {loading && <Card className="text-center py-8 text-muted">Cargando…</Card>}
        {!loading && clients.length === 0 && (
          <Card className="text-center py-8 text-muted">
            Todavía no hay ventas. Mueve un contacto a la etapa "Cliente" desde el apartado Contactos.
          </Card>
        )}
        {clients.map((c) => (
          <Card key={c.id} className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-ink font-semibold text-sm">{c.name}</div>
              <div className="text-muted text-xs">{c.program || 'Sin programa especificado'}</div>
              <div className="text-muted text-[10.5px]">{new Date(c.stage_updated_at).toLocaleDateString('es-ES')}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-cyan font-display text-lg">{eur(c.amount)}</div>
              <AuthorBadge profile={profiles?.[c.created_by]} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
