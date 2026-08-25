import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ClientsClient from '@/components/ClientsClient';

export default async function ClientesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('is_owner').eq('id', user.id).single();
  if (!profile?.is_owner) redirect('/dashboard');

  return <ClientsClient />;
}
