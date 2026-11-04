
/* Volla United Academy - Service Worker v20261104.2 */
const CACHE = 'volla-united-shell-20261104-2';

self.addEventListener('install', event =>
  event.waitUntil(self.skipWaiting())
);

self.addEventListener('activate', event =>
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k.startsWith('volla-') && k !== CACHE)
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })())
);

self.addEventListener('fetch', event => {
  const req = event.request;
  if (
    req.method !== 'GET' ||
    new URL(req.url).origin !== self.location.origin
  ) return;

  if (
    req.mode === 'navigate' ||
    /\.(?:js|html|webmanifest|css)(?:$|\?)/i.test(
      new URL(req.url).pathname
    )
  ) {
    event.respondWith(fetch(req, {cache:'no-store'}));
  }
});

self.addEventListener('push', event => {
  let payload = {};

  try {
    payload = event.data?.json() || {};
  } catch {
    payload = {body: event.data?.text() || ''};
  }

  const n = payload.notification || payload;
  const data = {
    ...(payload.data || {}),
    ...(n.data || {})
  };

  for (const k of [
    'notification_id',
    'match_id',
    'player_id',
    'url'
  ]) {
    if (data[k] == null && n[k] != null)
      data[k] = n[k];

    if (data[k] == null && payload[k] != null)
      data[k] = payload[k];
  }

  const options = {
    body: n.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    data
  };

  event.waitUntil(
    self.registration.showNotification(
      n.title || '⚽ Volla United Academy',
      options
    )
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const data = event.notification.data || {};
  const target = new URL('./', self.registration.scope);

  if (data.url) {
    try {
      const u = new URL(data.url, target);

      if (
        u.origin === target.origin &&
        u.pathname.startsWith(target.pathname)
      ) {
        target.pathname = u.pathname;
        target.search = u.search;
      }
    } catch (e) {
      console.warn('URL notifica non valido', e);
    }
  }

  if (data.match_id)
    target.searchParams.set(
      'vu_match',
      String(data.match_id)
    );

  if (data.notification_id)
    target.searchParams.set(
      'notification',
      String(data.notification_id)
    );

  if (data.player_id)
    target.searchParams.set(
      'vu_player',
      String(data.player_id)
    );

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    const sameApp = windows.find(c => {
      try {
        const u = new URL(c.url);
        return (
          u.origin === target.origin &&
          u.pathname.startsWith(
            new URL(self.registration.scope).pathname
          )
        );
      } catch {
        return false;
      }
    });

    if (sameApp) {
      try {
        await sameApp.navigate(target.href);
        await sameApp.focus();
        return;
      } catch (e) {
        console.warn('Navigazione PWA:', e);
      }
    }

    await self.clients.openWindow(target.href);
  })());
});
