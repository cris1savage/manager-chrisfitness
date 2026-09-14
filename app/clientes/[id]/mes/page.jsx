import { createClient } from '@/lib/supabase/server';
import MesClient from '@/components/MesClient';

export default async function MesPage({ params }) {
  const supabase = createClient();
  const [checkins, clienteData] = await Promise.all([
    supabase.from('tracking_checkins').select('*').eq('tracking_client_id', params.id).order('month', { ascending: false }),
    supabase.from('tracking_clients').select('phases, name').eq('id', params.id).single(),
  ]);

  return (
    <MesClient
      clienteId={params.id}
      clienteName={clienteData.data?.name || ''}
      phases={clienteData.data?.phases || []}
      initialCheckins={checkins.data || []}
    />
  );
}
