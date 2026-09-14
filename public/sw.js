// Service worker mínimo — solo habilita la instalación como app (PWA).
// No cachea nada: todas las peticiones van directas a red para no interferir
// con los datos en vivo de Supabase (login, clientes, checkins, etc).
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
