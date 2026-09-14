import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import BillingClient from '@/components/BillingClient';

export default async function FacturacionPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('is_owner').eq('id', user.id).single();

  // Comprobación en el servidor, además de la RLS de la base de datos y del
  // menú escondido — tres capas, no solo una pantalla ocultada.
  if (!profile?.is_owner) redirect('/dashboard');

  return <BillingClient />;
}
