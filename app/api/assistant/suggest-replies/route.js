import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Solo el servidor llama a la API de Anthropic — la clave nunca llega al
// navegador. Protegido: solo cuentas ya logueadas del panel pueden usarlo.

const SYSTEM_PROMPT = `Eres el asistente de Chris, entrenador personal online de Chris Fitness (chrisfitness.online), dirigido a hombres de 25 a 50 años en España que buscan perder peso y transformar su cuerpo. Su marca es cercana, motivadora, directa, sin tecnicismos, en español de España, tuteando siempre. El objetivo de negocio es mover al contacto por el embudo: Frío -> Contactado -> Llamada agendada -> Realizada -> Cliente.

Te voy a dar el contexto de una persona concreta (nombre, en qué etapa está, origen, notas si las hay) y el último mensaje que ha escrito. Da 3 sugerencias de respuesta MUY distintas entre sí en tono/enfoque, para que Chris elija la que mejor encaje. Cada respuesta debe:
- Sonar como una persona real escribiendo por Instagram/WhatsApp, no un email corporativo
- Ser corta (2-4 frases como mucho)
- Avanzar la conversación hacia el siguiente paso del embudo cuando tenga sentido, sin sonar agresivo vendiendo
- Estar en español de España

Responde ÚNICAMENTE en JSON válido, sin texto antes ni después ni backticks, con este formato exacto:
{"suggestions": [{"label": "...", "text": "..."}, {"label": "...", "text": "..."}, {"label": "...", "text": "..."}]}
Las etiquetas (label) describen el enfoque de cada una en 2-3 palabras (ej. "Cercana y curiosa", "Directa al grano", "Empuja a la llamada").`;

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Falta configurar ANTHROPIC_API_KEY en Vercel (ver README).' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const { contactName, stage, source, notes, recentNotes, incomingMessage } = body;

  if (!incomingMessage || !incomingMessage.trim()) {
    return NextResponse.json({ error: 'Falta el mensaje del contacto.' }, { status: 400 });
  }

  const userPrompt = `Contacto: ${contactName || 'sin nombre'}
Etapa actual: ${stage || 'desconocida'}
Origen: ${source || 'desconocido'}
${notes ? `Notas guardadas: ${notes}` : ''}
${recentNotes ? `Historial reciente:\n${recentNotes}` : ''}

Último mensaje del contacto:
"""
${incomingMessage.trim()}
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
        max_tokens: 700,
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
