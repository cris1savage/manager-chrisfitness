import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Conversacional: la IA puede preguntar (máx. 1-2 veces) antes de dar la
// propuesta final. El cliente manda el historial completo cada vez (la API
// no tiene memoria propia entre llamadas). Solo se llama cuando el usuario
// escribe algo — nunca automático. La propuesta nunca crea nada por su
// cuenta; eso lo hace el usuario al confirmar en pantalla.

const SYSTEM_PROMPT = `Eres el asistente de planificación de Chris, entrenador personal online de Chris Fitness. Te va a describir en lenguaje natural lo que necesita hacer, y tu trabajo es repartirlo en días y horas concretas, evitando los huecos que ya tiene ocupados.

Reglas, en este orden de importancia:
1. NUNCA propongas una fecha anterior a "Hoy" (te la doy exacta en el primer mensaje). Si un día de la semana ya ha pasado, no lo uses — usa solo desde hoy en adelante, dentro de la semana dada. Si hoy es el último o penúltimo día de la semana y no queda margen razonable, concentra lo que haga falta en los días que quedan en vez de inventar fechas pasadas.
2. Respeta SIEMPRE cualquier restricción de horario que el usuario mencione (ej. "los martes y miércoles entreno de 11 a 16" significa que esos días, esas horas, están completamente prohibidas).
3. No pongas nada en los huecos que ya aparecen en la lista de "Ya ocupado esta semana".
4. Solo puedes usar horas entre 06:00 y 23:59.
5. Varía las horas de forma realista a lo largo del día — NO metas todo a primera hora de la mañana. Reparte entre mañana, mediodía y tarde según tenga sentido, con separación entre tareas del mismo día.
6. Reparte de forma razonable entre los días disponibles, salvo que el usuario indique que debe ir junto o en un día concreto.
7. Duración realista por tipo de tarea: cosas rápidas 15-30 min; grabar contenido 45-90 min; gestión 30-60 min. Si el usuario da una duración, respétala.
8. Si menciona varias unidades de lo mismo (ej. "grabar 3 reels"), créalas como tareas separadas.
9. Títulos cortos y claros, en español.

Sobre preguntar antes de proponer: SOLO pregunta si de verdad te falta algo importante para organizar bien (por ejemplo, no sabes en qué franja prefiere un tipo de tarea, o cuántas veces a la semana hace algo y es ambiguo). Como mucho 1-2 preguntas en total, cortas y concretas — no alargues la conversación más de lo necesario. Si ya tienes información suficiente, no preguntes nada: da la propuesta final directamente.

Responde ÚNICAMENTE en JSON válido, sin texto antes ni después ni backticks, en uno de estos dos formatos exactos:
- Si necesitas preguntar algo antes de continuar: {"type": "question", "text": "tu pregunta, corta y concreta"}
- Si ya puedes dar la propuesta final: {"type": "proposal", "items": [{"title": "...", "date": "YYYY-MM-DD", "start_time": "HH:MM", "duration_minutes": 30}]}
Sé conciso para no alargar la respuesta innecesariamente.`;

function extractJSON(rawText) {
  const cleaned = rawText.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(rawText.slice(start, end + 1));
    }
    throw new Error('no-json-found');
  }
}

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
  const { messages, weekStart, weekEnd } = body;
  if (!Array.isArray(messages) || messages.length === 0 || !weekStart || !weekEnd) {
    return NextResponse.json({ error: 'Falta el mensaje o el rango de la semana.' }, { status: 400 });
  }

  // ¿Es el primer turno? (solo hay un mensaje de usuario y nada de la IA todavía)
  const isFirstTurn = messages.filter((m) => m.role === 'user').length === 1 && messages.filter((m) => m.role === 'assistant').length === 0;

  let apiMessages = messages;
  if (isFirstTurn) {
    const [tasksRes, calendarRes] = await Promise.all([
      supabase.from('tasks').select('title, due_date, due_time, duration_minutes').eq('assigned_to', user.id).eq('done', false).gte('due_date', weekStart).lte('due_date', weekEnd),
      supabase.from('calendar_entries').select('title, date').gte('date', weekStart).lte('date', weekEnd),
    ]);
    const busyLines = [
      ...(tasksRes.data || []).filter((t) => t.due_time).map((t) => `- ${t.due_date} ${t.due_time.slice(0, 5)}${t.duration_minutes ? ` (${t.duration_minutes} min)` : ''}: ${t.title}`),
      ...(calendarRes.data || []).map((c) => `- ${c.date} (todo el día, contenido programado): ${c.title}`),
    ];
    const MAX_BUSY_LINES = 40;
    const busyLinesCapped = busyLines.slice(0, MAX_BUSY_LINES);
    const busyExtra = busyLines.length - busyLinesCapped.length;
    if (busyExtra > 0) busyLinesCapped.push(`(+ ${busyExtra} más, ya no cabían aquí)`);

    const now = new Date();
    const todayISO = now.toISOString().slice(0, 10);
    const todayLabel = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const nowTime = now.toTimeString().slice(0, 5);

    const context = `Hoy es ${todayISO} (${todayLabel}), y son las ${nowTime}.
Semana a organizar: del ${weekStart} al ${weekEnd}.

Ya ocupado esta semana:
${busyLinesCapped.length ? busyLinesCapped.join('\n') : '(nada todavía)'}

Lo que necesito organizar:
"""
${messages[0].content.trim()}
"""`;

    apiMessages = [{ role: 'user', content: context }, ...messages.slice(1)];
  }

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
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: apiMessages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Error de la API de IA: ${errText.slice(0, 200)}` }, { status: 500 });
    }

    const data = await res.json();
    if (data.type === 'error') {
      return NextResponse.json({ error: `Error de la API de IA: ${data.error?.message || JSON.stringify(data).slice(0, 200)}` }, { status: 500 });
    }

    const textBlock = (data.content || []).find((c) => c.type === 'text');
    const rawText = textBlock?.text || '';

    if (!rawText) {
      const reason = data.stop_reason || 'desconocido';
      return NextResponse.json({ error: `La IA no devolvió texto (motivo: ${reason}). Prueba con una descripción más corta.` }, { status: 500 });
    }

    let parsed;
    try {
      parsed = extractJSON(rawText);
    } catch {
      return NextResponse.json(
        { error: `La IA respondió en un formato inesperado (motivo: ${data.stop_reason || 'desconocido'}). Texto recibido: "${rawText.slice(0, 150)}"` },
        { status: 500 }
      );
    }

    if (parsed.type === 'question' && typeof parsed.text === 'string') {
      return NextResponse.json({ type: 'question', text: parsed.text, raw: rawText });
    }
    if (parsed.type === 'proposal' && Array.isArray(parsed.items)) {
      return NextResponse.json({ type: 'proposal', items: parsed.items, raw: rawText });
    }
    return NextResponse.json({ error: 'La IA no devolvió una respuesta válida. Inténtalo de nuevo.' }, { status: 500 });
  } catch {
    return NextResponse.json({ error: 'No se pudo conectar con la IA.' }, { status: 500 });
  }
}
