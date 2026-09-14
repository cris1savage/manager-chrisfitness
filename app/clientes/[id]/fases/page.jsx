import { createClient } from '@/lib/supabase/server';
import FasesClient from '@/components/FasesClient';

export default async function FasesPage({ params }) {
  const supabase = createClient();
  const { data: cliente } = await supabase
    .from('tracking_clients')
    .select('id, phases, long_term_goal')
    .eq('id', params.id)
    .single();

  return <FasesClient clienteId={params.id} initialPhases={cliente?.phases || []} initialGoal={cliente?.long_term_goal || ''} />;
}
