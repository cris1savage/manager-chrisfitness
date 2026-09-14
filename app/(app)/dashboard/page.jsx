import { createClient } from '@/lib/supabase/server';
import DashboardClient from '@/components/DashboardClient';

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  return <DashboardClient profile={profile} />;
}
