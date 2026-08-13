import './globals.css';
import RegisterSW from '@/components/RegisterSW';

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

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-bg text-ink">
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
