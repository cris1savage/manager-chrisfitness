import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

// Se llama cada vez que se crea/edita/borra algo en el Calendario del panel
// (desde Calendario, o al Programar/Quitar del Calendario en Guiones/Vídeos).
// Sincroniza hacia el Google Calendar de TODAS las cuentas conectadas —
// así lo que programa uno aparece también en el Google del otro, si los
// dos tenéis Google conectado.

async function refreshAccessToken(conn) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: conn.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  return res.json();
}

export async function POST(request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    // Google Calendar no está configurado — no es un error, simplemente no hay nada que sincronizar.
    return NextResponse.json({ synced: 0, skipped: 'not-configured' });
  }

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const body = await request.json().catch(() => ({}));
  const { calendarEntryId, action } = body;
  if (!calendarEntryId) return NextResponse.json({ error: 'Falta calendarEntryId' }, { status: 400 });

  const { data: connections } = await admin.from('google_calendar_connections').select('*');
  if (!connections || connections.length === 0) return NextResponse.json({ synced: 0 });

  let entry = null;
  if (action !== 'delete') {
    const { data } = await admin.from('calendar_entries').select('*').eq('id', calendarEntryId).single();
    entry = data;
    if (!entry) return NextResponse.json({ synced: 0, skipped: 'entry-not-found' });
  }

  let synced = 0;
  let lastError = null;

  for (const conn of connections) {
    try {
      let accessToken = conn.access_token;
      if (!conn.expiry_date || conn.expiry_date < Date.now() + 60000) {
        const refreshed = await refreshAccessToken(conn);
        if (refreshed.access_token) {
          accessToken = refreshed.access_token;
          await admin
            .from('google_calendar_connections')
            .update({ access_token: accessToken, expiry_date: Date.now() + (refreshed.expires_in || 3600) * 1000 })
            .eq('id', conn.id);
        } else {
          lastError = `No se pudo renovar el acceso a Google (${refreshed.error || 'motivo desconocido'}). Puede que haga falta reconectar.`;
          continue; // no se pudo renovar el token de esta cuenta, se salta
        }
      }

      const { data: mapping } = await admin
        .from('google_calendar_events')
        .select('*')
        .eq('calendar_entry_id', calendarEntryId)
        .eq('user_id', conn.user_id)
        .maybeSingle();

      if (action === 'delete') {
        if (mapping) {
          const delRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${mapping.google_event_id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          // 410/404 = ya no existe en Google, lo damos por borrado igualmente
          if (delRes.ok || delRes.status === 410 || delRes.status === 404) {
            await admin.from('google_calendar_events').delete().eq('id', mapping.id);
            synced++;
          } else {
            const errText = await delRes.text().catch(() => '');
            lastError = `Google respondió ${delRes.status} al borrar: ${errText.slice(0, 200)}`;
          }
        } else {
          synced++; // nada que borrar en Google, no es un fallo
        }
        continue;
      }

      const nextDay = new Date(`${entry.date}T00:00:00Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const nextDayISO = nextDay.toISOString().slice(0, 10);

      const eventBody = {
        summary: entry.title,
        description: entry.notes || '',
        start: { date: entry.date },
        end: { date: nextDayISO }, // Google trata el fin como excluyente: debe ser el día siguiente
      };

      if (mapping) {
        const patchRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${mapping.google_event_id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(eventBody),
        });
        if (patchRes.ok) {
          synced++;
        } else {
          const errText = await patchRes.text().catch(() => '');
          lastError = `Google respondió ${patchRes.status} al actualizar: ${errText.slice(0, 200)}`;
        }
      } else {
        const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(eventBody),
        });
        const created = await createRes.json().catch(() => ({}));
        if (createRes.ok && created.id) {
          await admin.from('google_calendar_events').insert({ calendar_entry_id: calendarEntryId, user_id: conn.user_id, google_event_id: created.id });
          synced++;
        } else {
          lastError = `Google respondió ${createRes.status} al crear: ${JSON.stringify(created).slice(0, 200)}`;
        }
      }
    } catch (e) {
      lastError = e.message || 'Error desconocido';
      console.error('Error sincronizando con Google para', conn.user_id, e);
    }
  }

  return NextResponse.json({ synced, total: connections.length, error: lastError || undefined });
}
