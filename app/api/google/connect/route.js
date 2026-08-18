import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Botón "Conectar Google Calendar" en Cuenta y Seguridad manda aquí.
// Redirige a la pantalla de consentimiento de Google; cada cuenta conecta
// la suya (state = id del usuario, para saber a quién guardarle el token
// cuando Google vuelva a /api/google/callback).

export async function GET(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  if (!user) return NextResponse.redirect(`${appUrl}/login`);

  if (!process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.redirect(`${appUrl}/seguridad?google=config`);
  }

  const redirectUri = `${appUrl}/api/google/callback`;
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent',
    state: user.id,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
