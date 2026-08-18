import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

// Google vuelve aquí después de que el usuario autoriza. Cambia el código
// por tokens, y guarda el refresh_token (solo viene la primera vez, con
// prompt=consent) asociado a esa cuenta.

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // id del usuario
  const error = searchParams.get('error');

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl}/seguridad?google=error`);
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.redirect(`${appUrl}/seguridad?google=config`);
  }

  const redirectUri = `${appUrl}/api/google/callback`;

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
      return NextResponse.redirect(`${appUrl}/seguridad?google=error`);
    }

    const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Si Google no manda refresh_token esta vez (raro con prompt=consent,
    // pero por si acaso), conserva el que ya hubiera guardado.
    let refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      const { data: existing } = await admin.from('google_calendar_connections').select('refresh_token').eq('user_id', state).maybeSingle();
      refreshToken = existing?.refresh_token;
    }
    if (!refreshToken) {
      return NextResponse.redirect(`${appUrl}/seguridad?google=error`);
    }

    await admin.from('google_calendar_connections').upsert(
      {
        user_id: state,
        access_token: tokens.access_token,
        refresh_token: refreshToken,
        expiry_date: Date.now() + (tokens.expires_in || 3600) * 1000,
      },
      { onConflict: 'user_id' }
    );

    return NextResponse.redirect(`${appUrl}/seguridad?google=connected`);
  } catch {
    return NextResponse.redirect(`${appUrl}/seguridad?google=error`);
  }
}
