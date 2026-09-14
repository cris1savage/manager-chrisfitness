import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

// Botón "Renovar vencidas ahora" en Clientes activos — hace lo mismo que
// el aviso diario hace solo cada día, pero al momento, sin esperar a
// mañana. Cualquiera de las dos cuentas puede pulsarlo (Clientes activos es
// compartida) — pero usa la clave de servicio para el trabajo en sí, para
// que el registro del cobro real (que sí es solo tuyo) quede anotado igual
// lo pulse quien lo pulse, sin toparse con el bloqueo de Facturación.

const DURATION_MONTHS = { Mensual: 1, '3 meses': 3, '6 meses': 6, Anual: 12 };

function addMonthsISO(dateISO, months) {
  const d = new Date(`${dateISO}T00:00:00Z`);
  const targetMonthIndex = d.getUTCMonth() + months;
  const result = new Date(Date.UTC(d.getUTCFullYear(), targetMonthIndex, d.getUTCDate()));
  const expectedMonth = ((targetMonthIndex % 12) + 12) % 12;
  if (result.getUTCMonth() !== expectedMonth) {
    result.setUTCDate(0);
  }
  return result.toISOString().slice(0, 10);
}

export async function POST() {
  const authClient = createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en Vercel.' }, { status: 500 });
  }
  const supabase = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const todayISO = new Date().toISOString().slice(0, 10);

  const { data: dueClients, error } = await supabase
    .from('active_clients')
    .select('id, start_date, renewal_date, duration')
    .eq('status', 'Activo')
    .not('renewal_date', 'is', null)
    .lt('renewal_date', todayISO);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let renewed = 0;
  for (const c of dueClients || []) {
    const cycleMonths = DURATION_MONTHS[c.duration];
    if (!cycleMonths) continue; // "Personalizada" se gestiona a mano
    let newStart = c.renewal_date;
    let newRenewal = addMonthsISO(newStart, cycleMonths);
    const cycleDates = [newStart];
    while (newRenewal < todayISO) {
      newStart = newRenewal;
      newRenewal = addMonthsISO(newStart, cycleMonths);
      cycleDates.push(newStart);
    }
    await supabase.from('active_clients').update({ renewal_date: newRenewal }).eq('id', c.id);
    renewed++;

    const { data: billingRow } = await supabase.from('client_billing').select('price_amount').eq('active_client_id', c.id).maybeSingle();
    if (billingRow?.price_amount != null) {
      await supabase.from('billing_events').upsert(
        cycleDates.map((eventDate) => ({ active_client_id: c.id, amount: billingRow.price_amount, event_date: eventDate })),
        { onConflict: 'active_client_id,event_date', ignoreDuplicates: true }
      );
    }
  }

  return NextResponse.json({ renewed });
}
