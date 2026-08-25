import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// MVP del AI Closer: analiza una conversación que TÚ pegas (copiada de
// Instagram) — no hay conexión directa con Instagram todavía. Nunca envía
// nada por su cuenta; solo propone. Guardar en la ficha del contacto es una
// acción explícita del usuario, nunca automática.

const LEAD_STATES = [
  'Nuevo', 'Curioso', 'Interesado', 'Problema identificado', 'Necesidad clara',
  'Cualificado', 'Objeción', 'Precio', 'Listo para llamada', 'Listo para comprar',
  'No interesado', 'Seguimiento pendiente', 'Cliente',
];
const STAGES = ['Frío', 'Contactado', 'Llamada agendada', 'Realizada', 'Cliente', 'Perdido'];

const SHARED_CONTEXT = `Eres el copiloto de ventas de Chris, entrenador personal online de Chris Fitness (chrisfitness.online), dirigido a hombres de 25-50 años en España que quieren perder grasa, ganar músculo o mejorar su composición corporal. Los leads le escriben por Instagram tras ver contenido, un anuncio, o por recomendación.

Principios que debes respetar SIEMPRE, sin excepción:
- Nunca inventes precios, resultados, testimonios, disponibilidad, ni prometas resultados garantizados. Si no tienes esa información, dilo o déjalo en blanco.
- Nunca sugieras manipulación, presión artificial, falsas urgencias, ni testimonios inventados. El objetivo es ayudar a la persona a decidir, no forzarla.
- Las respuestas sugeridas nunca deben sonar a interrogatorio (varias preguntas seguidas tipo formulario). Deben sonar como un mensaje real de una persona, natural, en español de España, tuteando.
- No intentes cerrar la venta antes de tiempo. Solo recomienda avanzar hacia llamada o cierre cuando el lead ya ha mostrado objetivo claro y ha reconocido su problema.`;

function buildAnalyzePrompt() {
  return `${SHARED_CONTEXT}

Vas a analizar una conversación de Instagram y devolver un análisis completo. Estados de lead posibles (usa EXACTAMENTE uno de estos, el que mejor encaje): ${LEAD_STATES.join(', ')}.

Etapas del embudo de Chris (para sugerir si conviene mover al contacto, usa EXACTAMENTE una de estas o null si no cambia): ${STAGES.join(', ')}.

Lead score (0-100): basado en señales reales — objetivo claro, problema reconocido, urgencia, nivel de interacción, preguntas sobre el servicio o precio, disponibilidad expresada, compromiso mostrado, objeciones (bajan el score), historial de intentos previos. Explica brevemente por qué ese número, citando señales concretas de la conversación, no una cifra sin justificar.

Da también 3 sugerencias de respuesta MUY distintas en tono/enfoque entre sí, cada una corta (2-4 frases), con una explicación breve de por qué esa respuesta (qué está pensando el lead, qué NO hacer todavía).

IMPORTANTE — transcripción: además del análisis, transcribe a texto plano los mensajes que se te han dado en ESTE turno (vinieran escritos o en una captura de pantalla), tal como aparecen, conservando quién dice qué y las horas si se ven. Esto es necesario para poder guardar el historial de la conversación aunque venga de una imagen — sin esto, lo que hay en la captura se perdería.

Responde ÚNICAMENTE en JSON válido, sin texto antes ni después ni backticks, con este formato exacto:
{
  "lead_state": "uno de la lista",
  "lead_score": 0,
  "score_reason": "explicación breve y concreta",
  "closing_ready": true o false,
  "closing_reason": "por qué está o no está listo para avanzar hacia llamada/cierre",
  "objective": "qué quiere conseguir, o vacío si no está claro todavía",
  "problem": "qué se lo impide, o vacío si no está claro",
  "situation": "situación actual relevante (experiencia, tiempo, etc.), o vacío",
  "objections": "objeciones detectadas y de qué tipo, o vacío si no hay",
  "next_step": "próximo paso concreto recomendado",
  "probability": "Baja, Media o Alta",
  "suggested_stage": "una etapa de la lista o null",
  "suggestions": [{"label": "enfoque en 2-3 palabras", "text": "...", "why": "por qué esta respuesta, en una frase corta"}, {"label": "...", "text": "...", "why": "..."}, {"label": "...", "text": "...", "why": "..."}],
  "transcribed_new_messages": "transcripción en texto plano de los mensajes de este turno (de la imagen y/o el texto dado)"
}`;
}

function buildCoachPrompt() {
  return `${SHARED_CONTEXT}

Ahora actúa como un coach de ventas experimentado enseñándole a Chris a leer esta conversación, no solo dándole una respuesta para copiar. Cubre estos 6 puntos, en prosa clara y directa, en español de España:
1. Qué está pensando probablemente el lead en este momento.
2. Qué nivel de intención de compra tiene.
3. Qué error NO debería cometer Chris ahora mismo.
4. Qué respondería (una propuesta concreta de mensaje).
5. Qué está intentando conseguir con ese mensaje (el objetivo táctico de esa respuesta).
6. Cuál sería el siguiente paso de Chris después de la respuesta del lead a ese mensaje.

Responde ÚNICAMENTE en JSON válido, sin texto antes ni después ni backticks, con este formato exacto:
{"type": "coach", "analysis": "texto con los 6 puntos, con saltos de línea entre ellos, sin markdown ni asteriscos"}`;
}

function extractJSON(rawText) {
  const cleaned = rawText.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) return JSON.parse(rawText.slice(start, end + 1));
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
  const { contactName, stage, source, notes, priorAnalysis, conversationText, imageBase64, imageMediaType, mode } = body;

  if ((!conversationText || !conversationText.trim()) && !imageBase64) {
    return NextResponse.json({ error: 'Falta la conversación a analizar (texto o captura).' }, { status: 400 });
  }

  const contextBlock = `Contacto: ${contactName || 'sin nombre'}
Etapa actual en el CRM: ${stage || 'desconocida'}
Origen: ${source || 'desconocido'}
${notes ? `Notas guardadas: ${notes}` : ''}
${priorAnalysis ? `Análisis anterior guardado en la ficha:\n${priorAnalysis}` : ''}

${imageBase64 ? 'Se adjunta una captura de pantalla de la conversación de Instagram. Léela tal cual aparece en la imagen.' : ''}
${conversationText && conversationText.trim() ? `Conversación (últimos mensajes, tal como los pegó Chris):\n"""\n${conversationText.trim()}\n"""` : ''}`;

  const systemPrompt = mode === 'coach' ? buildCoachPrompt() : buildAnalyzePrompt();

  const userContent = imageBase64
    ? [
        { type: 'image', source: { type: 'base64', media_type: imageMediaType || 'image/jpeg', data: imageBase64 } },
        { type: 'text', text: contextBlock },
      ]
    : contextBlock;

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
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
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
      return NextResponse.json({ error: `La IA no devolvió texto (motivo: ${data.stop_reason || 'desconocido'}).` }, { status: 500 });
    }

    let parsed;
    try {
      parsed = extractJSON(rawText);
    } catch {
      return NextResponse.json({ error: `La IA respondió en un formato inesperado. Texto recibido: "${rawText.slice(0, 150)}"` }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: 'No se pudo conectar con la IA.' }, { status: 500 });
  }
}
