import { createClient } from '@/lib/supabase/server';
import TimelineClient from '@/components/TimelineClient';

export default async function TimelinePage({ params }) {
  const supabase = createClient();
  const [weeks, clienteData, checkins] = await Promise.all([
    supabase.from('tracking_timeline_weeks').select('*').eq('tracking_client_id', params.id).order('week_start', { ascending: true }),
    supabase.from('tracking_clients').select('phases').eq('id', params.id).single(),
    supabase.from('tracking_checkins').select('weight, month').eq('tracking_client_id', params.id).order('month', { ascending: false }),
  ]);

  return (
    <TimelineClient
      clienteId={params.id}
      phases={clienteData.data?.phases || []}
      initialWeeks={weeks.data || []}
      initialCheckins={checkins.data || []}
    />
  );
}
