const CACHE = 'chris-fitness-v1';
const SHELL = ['/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first: siempre intenta traer datos frescos (login/CRM en vivo);
// si no hay conexión, cae al caché para que la cáscara de la app no se rompa.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// Notificaciones push: recibe el aviso del servidor y lo muestra.
self.addEventListener('push', (event) => {
  let data = { title: 'Chris Fitness', body: 'Tienes novedades en el panel.', url: '/dashboard' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/dashboard' },
    })
  );
});

// Al tocar la notificación, abre (o enfoca) el panel en la sección relevante.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url.includes(self.location.origin));
      if (existing) {
        existing.navigate(url);
        return existing.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
