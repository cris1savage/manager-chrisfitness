import './globals.css';
import RegisterSW from '@/components/RegisterSW';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Chris Fitness · Panel de Control',
  description: 'Panel privado de gestión — Chris Fitness',
  robots: { index: false, follow: false },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Chris Fitness',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport = {
  themeColor: '#050708',
};

export default async function RootLayout({ children }) {
  let theme = 'dark';
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('theme').eq('id', user.id).single();
      if (profile?.theme === 'light') theme = 'light';
    }
  } catch {
    // sin sesión (ej. /login) o fallo puntual — se queda en oscuro por defecto
  }

  return (
    <html lang="es" className={theme === 'light' ? 'light' : ''}>
      <body className="bg-bg text-ink">
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
