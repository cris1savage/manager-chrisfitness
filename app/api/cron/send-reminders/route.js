import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Se ejecuta una vez al día (ver vercel.json) y manda, a cada cuenta, un
// único aviso con sus tareas pendientes de los próximos 3-4 días. Nada
// compartido: cada uno solo ve las suyas.

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return NextResponse.json({ error: 'Faltan variables de entorno (service role / VAPID). Revisa el README.' }, { status: 500 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  webpush.setVapidDetails('mailto:hola@chrisfitness.online', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const tomorrowISO = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);
  const windowEnd = new Date(today.getTime() + 3 * 86400000).toISOString().slice(0, 10); // hoy + 3 días más = ventana de 4 días

  const { data: tasks, error: tasksErr } = await supabase
    .from('tasks')
    .select('*')
    .eq('done', false)
    .not('assigned_to', 'is', null)
    .gte('due_date', todayISO)
    .lte('due_date', windowEnd);

  if (tasksErr) return NextResponse.json({ error: tasksErr.message }, { status: 500 });
  if (!tasks || tasks.length === 0) return NextResponse.json({ sent: 0, reason: 'Sin tareas en los próximos días' });

  const byUser = {};
  tasks.forEach((t) => {
    if (!byUser[t.assigned_to]) byUser[t.assigned_to] = [];
    byUser[t.assigned_to].push(t);
  });

  const dayLabel = (d) => {
    if (d === todayISO) return 'Hoy';
    if (d === tomorrowISO) return 'Mañana';
    return new Date(`${d}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' });
  };

  let sent = 0;
  let removedStale = 0;

  for (const userId of Object.keys(byUser)) {
    const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('user_id', userId);
    if (!subs || subs.length === 0) continue;

    const userTasks = byUser[userId].sort((a, b) =>
      `${a.due_date}${a.due_time || ''}`.localeCompare(`${b.due_date}${b.due_time || ''}`)
    );

    const lines = userTasks.slice(0, 4).map((t) => {
      const time = t.due_time ? ` ${t.due_time.slice(0, 5)}` : '';
      return `${dayLabel(t.due_date)}${time}: ${t.title}`;
    });
    if (userTasks.length > 4) lines.push(`+${userTasks.length - 4} más`);

    const payload = JSON.stringify({
      title: `${userTasks.length} tarea${userTasks.length !== 1 ? 's' : ''} en los próximos días`,
      body: lines.join('\n'),
      url: '/tareas',
    });

    for (const sub of subs) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        sent++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          removedStale++;
        }
      }
    }
  }

  return NextResponse.json({ sent, removedStale });
}
