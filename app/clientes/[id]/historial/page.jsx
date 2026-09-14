import { createClient } from '@/lib/supabase/server';
import HistorialClient from '@/components/HistorialClient';

export default async function HistorialPage({ params }) {
  const supabase = createClient();
  const { data: checkins } = await supabase
    .from('tracking_checkins')
    .select('*')
    .eq('tracking_client_id', params.id)
    .order('month', { ascending: false });

  return <HistorialClient clienteId={params.id} checkins={checkins || []} />;
}
