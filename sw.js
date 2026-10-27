/* Volla United — aggiornamento rapido PWA */
const CACHE = 'volla-united-v3';
const CORE = ['./', './index.html', './style.css', './app.js', './config.js'];
const OPTIONAL = ['./logo.png', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled([...CORE, ...OPTIONAL].map(async path => {
      const response = await fetch(new Request(path, {cache: 'reload'}));
      if (response.ok) await cache.put(path, response);
    }));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('volla-united-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Non intercettare richieste ad altri percorsi dello stesso dominio GitHub Pages.
  if (!url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      // Network-first: non blocca gli aggiornamenti di app.js, HTML o CSS.
      const response = await fetch(new Request(request, {cache: 'no-store'}));
      if (response.ok && response.type === 'basic') {
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await cache.match(request, {ignoreSearch: true});
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const fallback = await cache.match('./index.html');
        if (fallback) return fallback;
      }
      return Response.error();
    }
  })());
});

// Notifiche push inviate dal backend (Supabase Edge Function / Web Push).
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data ? event.data.json() : {}; }
    catch { payload = { body: event.data?.text() || '' }; }
    const title = String(payload.title || 'Volla United');
    const options = {
      body: String(payload.body || 'Hai una nuova comunicazione.'),
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: String(payload.tag || 'volla-notifica'),
      renotify: Boolean(payload.renotify),
      data: { url: typeof payload.url === 'string' ? payload.url : './' }
    };
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const scope = new URL(self.registration.scope);
    let target;
    try { target = new URL(event.notification.data?.url || './', scope); }
    catch { target = scope; }
    // Evita redirect esterni attraverso i payload delle notifiche.
    if (target.origin !== scope.origin || !target.pathname.startsWith(scope.pathname)) target = scope;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => {
      try { return new URL(client.url).origin === scope.origin && new URL(client.url).pathname.startsWith(scope.pathname); }
      catch { return false; }
    });
    if (existing) {
      await existing.focus();
      if ('navigate' in existing) await existing.navigate(target.href);
    } else {
      await self.clients.openWindow(target.href);
    }
  })());
});
