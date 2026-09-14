import { createClient } from '@/lib/supabase/server';
import ResumenClient from '@/components/ResumenClient';

export default async function ResumenPage({ params }) {
  const supabase = createClient();
  const [checkins, weeks, clienteData] = await Promise.all([
    supabase.from('tracking_checkins').select('*').eq('tracking_client_id', params.id).order('month', { ascending: true }),
    supabase.from('tracking_timeline_weeks').select('*').eq('tracking_client_id', params.id).order('week_start', { ascending: true }),
    supabase.from('tracking_clients').select('*').eq('id', params.id).single(),
  ]);

  return (
    <ResumenClient
      clienteId={params.id}
      cliente={clienteData.data}
      initialCheckins={checkins.data || []}
      initialWeeks={weeks.data || []}
    />
  );
}
