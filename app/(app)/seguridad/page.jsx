import { createClient } from '@/lib/supabase/server';
import SecurityClient from '@/components/SecurityClient';

export default async function SeguridadPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return <SecurityClient profile={profile} />;
}
