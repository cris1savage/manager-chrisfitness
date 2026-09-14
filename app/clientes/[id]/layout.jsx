import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import ClienteLayoutClient from '@/components/ClienteLayoutClient';

export default async function ClienteLayout({ children, params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: cliente } = await supabase
    .from('tracking_clients')
    .select('id, name, program, start_date, status, phases, long_term_goal, duration, notes, read_token')
    .eq('id', params.id)
    .single();

  if (!cliente) notFound();

  return <ClienteLayoutClient cliente={cliente}>{children}</ClienteLayoutClient>;
}
