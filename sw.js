/**
 * sw.js - Service Worker para MotoTracker PWA
 * Gestiona caché offline y notificaciones Push
 */

const CACHE_NAME = 'mototracker-v2';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './html/dashboard.html',
  './html/registro.html',
  './html/mantenimiento.html',
  './html/configuracion.html',
  './css/global.css',
  './css/registro.css',
  './css/dashboard.css',
  './css/mantenimiento.css',
  './css/configuracion.css',
  './js/storage.js',
  './js/ocr.js',
  './js/notifications.js',
  './js/brevo.js',
  './js/registro.js',
  './js/dashboard.js',
  './js/mantenimiento.js',
  './js/configuracion.js',
];

// ─── Instalación del SW: pre-cachear recursos estáticos de forma resiliente ────
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker v2...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Cacheando archivos de la aplicación');
      // Cachear individualmente para que un error en una ruta no aborte todo el proceso
      await Promise.all(
        URLS_TO_CACHE.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] No se pudo cachear ${url}:`, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// ─── Activación: limpiar cachés antiguas ──────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Eliminando caché antigua:', name);
            return caches.delete(name);
          })
      )
    )
  );
  self.clients.claim();
});

// ─── Intercepción de fetch: Cache First con Network Fallback ──────────────────
self.addEventListener('fetch', (event) => {
  // No interceptar llamadas a APIs externas (Brevo, CDN Tesseract, fuentes)
  const url = event.request.url;
  if (
    url.includes('api.brevo.com') ||
    url.includes('jsdelivr.net') ||
    url.includes('fonts.googleapis.com') ||
    url.includes('fonts.gstatic.com') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Si está offline y pide navegación, servir dashboard o registro
          if (event.request.mode === 'navigate') {
            return caches.match('./html/dashboard.html') || caches.match('./index.html');
          }
        });
    })
  );
});

// ─── Manejo de Push Notifications ─────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: '🏍️ MotoTracker', body: 'Tienes una alerta de mantenimiento' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: 'https://api.iconify.design/mdi/motorbike.svg?color=%23f97316&width=192&height=192',
    badge: 'https://api.iconify.design/mdi/motorbike.svg?color=%23f97316&width=96&height=96',
    vibrate: [200, 100, 200, 100, 200],
    data: { url: data.url || './html/dashboard.html' },
    actions: [
      { action: 'ver', title: 'Ver Dashboard', icon: '' },
      { action: 'dismiss', title: 'Descartar', icon: '' },
    ],
    tag: 'mototracker-alert',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// ─── Click en notificación ─────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || './html/dashboard.html';

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
