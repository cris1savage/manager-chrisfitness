import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import VistaPublicaClient from '@/components/VistaPublicaClient';

export default async function VerPage({ params }) {
  const supabase = createClient();
  const token    = params.token;

  // Buscar por read_token primero
  let { data: cliente } = await supabase
    .from('tracking_clients')
    .select(`
      id, name, program, phases, long_term_goal,
      tracking_checkins ( month, weight, phase, goal_status, goals, training_notes, nutrition_notes, weekly_notes ),
      tracking_timeline_weeks ( week_start, real_weight, target_weight )
    `)
    .eq('read_token', token)
    .maybeSingle();

  // Si no encuentra por token, intentar generarlo desde el ID
  // (clientes creados antes de que se generaran los tokens)
  if (!cliente) {
    const { data: all } = await supabase
      .from('tracking_clients')
      .select(`
        id, name, program, phases, long_term_goal,
        tracking_checkins ( month, weight, phase, goal_status, goals, training_notes, nutrition_notes, weekly_notes ),
        tracking_timeline_weeks ( week_start, real_weight, target_weight )
      `);

    if (all) {
      cliente = all.find((c) => {
        const raw = c.id.replace(/-/g, '');
        const generatedToken = raw.slice(0, 8) + raw.slice(-4);
        return generatedToken === token;
      }) || null;

      // Si encontramos por ID, guardar el token para futuras visitas
      if (cliente) {
        await supabase
          .from('tracking_clients')
          .update({ read_token: token })
          .eq('id', cliente.id);
      }
    }
  }

  if (!cliente) notFound();

  return <VistaPublicaClient cliente={cliente} />;
}
