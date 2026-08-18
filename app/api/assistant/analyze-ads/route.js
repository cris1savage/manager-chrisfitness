import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Se llama SOLO cuando el usuario pulsa el botón "Analizar con IA" en
// Anuncios — nunca automáticamente. Así el consumo depende de cuánto lo
// use, no de cada vez que se abre la página.

const SYSTEM_PROMPT = `Eres un analista de marketing para Chris Fitness, un coaching online de fitness en España dirigido a hombres de 25 a 50 años. Te doy los datos de sus campañas de anuncios activas: gasto, objetivo, clientes atribuidos, facturación, ROI, y cuando estén disponibles también impresiones/clics/CTR reales de Meta Ads. Da un análisis breve y directo en español de España, máximo 130 palabras, sin rodeos ni relleno corporativo. Estructura:
- Qué campaña está funcionando mejor y por qué (usa el CTR si lo tienes: un CTR bajo con buen gasto suele indicar que el creativo no engancha, aunque el ROI de conversión pueda parecer aceptable)
- Qué campaña deberías pausar o revisar, si hay alguna floja
- Una recomendación concreta de siguiente paso (subir presupuesto, cambiar creativo, pausar, etc.)

Si no hay datos suficientes (ninguna campaña con clientes atribuidos todavía, y tampoco impresiones/clics), dilo directamente y sugiere esperar a tener más datos antes de sacar conclusiones. No inventes cifras que no te doy.

Importante sobre el formato: responde en TEXTO PLANO. No uses markdown, no pongas negrita con asteriscos (**texto**), no uses almohadillas para títulos, no uses listas con guiones. Sepera las ideas con saltos de línea normales, como si fuera un mensaje de texto.`;

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
  const { ads } = body;

  if (!ads || !Array.isArray(ads) || ads.length === 0) {
    return NextResponse.json({ error: 'No hay anuncios para analizar.' }, { status: 400 });
  }

  const summary = ads
    .map((a) => {
      const perf = a.impressions || a.clicks || a.ctr
        ? `, ${a.impressions ?? '?'} impresiones, ${a.clicks ?? '?'} clics${a.ctr ? `, CTR ${a.ctr}%` : ''}`
        : '';
      return `- "${a.campaign}" (${a.objective || 'sin objetivo'}, ${a.status}): gasto acumulado ${a.spend}€, ${a.attributedClients} cliente(s), ${a.attributedRevenue}€ facturado${a.roi !== null ? `, ROI ${a.roi}%` : ''}${perf}`;
    })
    .join('\n');

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
        messages: [{ role: 'user', content: `Campañas activas:\n${summary}` }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Error de la API de IA: ${errText.slice(0, 200)}` }, { status: 500 });
    }

    const data = await res.json();
    const textBlock = (data.content || []).find((c) => c.type === 'text');
    return NextResponse.json({ analysis: textBlock?.text || 'Sin respuesta.' });
  } catch {
    return NextResponse.json({ error: 'No se pudo conectar con la IA.' }, { status: 500 });
  }
}
