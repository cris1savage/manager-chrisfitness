import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Solo se llama cuando el usuario escribe lo que necesita hacer y pulsa el
// botón — nunca automático. Devuelve una PROPUESTA de horario; no crea
// nada todavía, eso lo hace el usuario al confirmar.

const SYSTEM_PROMPT = `Eres el asistente de planificación de Chris, entrenador personal online de Chris Fitness. Te va a describir en lenguaje natural lo que necesita hacer esta semana, y tu trabajo es repartirlo en días y horas concretas dentro de la semana que te doy, evitando los huecos que ya tiene ocupados.

Reglas:
- Solo puedes usar horas entre 06:00 y 23:59.
- No pongas nada en huecos que ya aparecen como ocupados en la lista de "Ya ocupado esta semana".
- Reparte de forma razonable entre los días de la semana — no lo metas todo el mismo día si son varias cosas independientes, salvo que el propio texto del usuario indique que debe ir junto o en un día concreto.
- Calcula una duración realista para cada tarea (en minutos) según el tipo de tarea: cosas rápidas (llamadas, revisar algo) 15-30 min; grabar contenido 45-90 min; tareas de gestión 30-60 min. Si el usuario da una duración o número de repeticiones, respétalo.
- Si el usuario menciona varias unidades de lo mismo (ej. "grabar 3 reels"), créalas como tareas separadas, no una sola.
- Usa títulos cortos y claros, en español.

Responde ÚNICAMENTE en JSON válido, sin texto antes ni después ni backticks, con este formato exacto:
{"items": [{"title": "...", "date": "YYYY-MM-DD", "start_time": "HH:MM", "duration_minutes": 30}]}`;

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Falta configurar ANTHROPIC_API_KEY en Vercel.' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const { requestText, weekStart, weekEnd } = body;
  if (!requestText || !requestText.trim() || !weekStart || !weekEnd) {
    return NextResponse.json({ error: 'Falta la petición o el rango de la semana.' }, { status: 400 });
  }

  // Contexto de lo que ya está ocupado esa semana, para no chocar cosas.
  const [tasksRes, calendarRes] = await Promise.all([
    supabase.from('tasks').select('title, due_date, due_time, duration_minutes').eq('assigned_to', user.id).eq('done', false).gte('due_date', weekStart).lte('due_date', weekEnd),
    supabase.from('calendar_entries').select('title, date').gte('date', weekStart).lte('date', weekEnd),
  ]);

  const busyLines = [
    ...(tasksRes.data || []).filter((t) => t.due_time).map((t) => `- ${t.due_date} ${t.due_time.slice(0, 5)}${t.duration_minutes ? ` (${t.duration_minutes} min)` : ''}: ${t.title}`),
    ...(calendarRes.data || []).map((c) => `- ${c.date} (todo el día, contenido programado): ${c.title}`),
  ];

  const userPrompt = `Semana: del ${weekStart} al ${weekEnd}.

Ya ocupado esta semana:
${busyLines.length ? busyLines.join('\n') : '(nada todavía)'}

Lo que necesito organizar esta semana:
"""
${requestText.trim()}
"""`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Error de la API de IA: ${errText.slice(0, 200)}` }, { status: 500 });
    }

    const data = await res.json();
    const textBlock = (data.content || []).find((c) => c.type === 'text');
    let parsed;
    try {
      const cleaned = (textBlock?.text || '').replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'La IA respondió en un formato inesperado. Inténtalo de nuevo.' }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: 'No se pudo conectar con la IA.' }, { status: 500 });
  }
}
