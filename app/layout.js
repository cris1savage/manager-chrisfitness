import './globals.css';
import RegisterSW from '@/components/RegisterSW';

export const metadata = {
  title: 'CF Clientes · Seguimiento',
  description: 'Panel de seguimiento de clientes — Chris Fitness',
  robots: { index: false, follow: false },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CF Clientes',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport = {
  themeColor: '#050708',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-bg text-ink min-h-screen">
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
