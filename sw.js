/* Volla United Academy - Service Worker v20261031.1 */
const CACHE = 'volla-united-shell-20261031-1';
self.addEventListener('install', event => { event.waitUntil(self.skipWaiting()); });
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('volla-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Non conservare HTML, JS, configurazione o richieste API: evita versioni incompatibili.
  if (req.mode === 'navigate' || /\.(?:js|html|webmanifest|css)(?:$|\?)/i.test(new URL(req.url).pathname)) {
    event.respondWith(fetch(req, {cache:'no-store'}));
  }
});
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = {body: event.data?.text() || ''}; }
  const n = payload.notification || payload;
  const title = n.title || '⚽ Volla United Academy';
  const options = { body: n.body || '', icon: './icon-192.png', badge: './icon-192.png', data: n.data || payload.data || {} };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = new URL('./', self.registration.scope);
  if (data.url) {
    try { const u = new URL(data.url, target); if(u.origin === target.origin) {target.pathname=u.pathname;target.search=u.search;} } catch {}
  } else {
    if (data.match_id) target.searchParams.set('vu_match', data.match_id);
    if (data.notification_id) target.searchParams.set('notification', data.notification_id);
  }
  event.waitUntil((async()=>{
    const clients = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const c of clients){ if(new URL(c.url).origin===target.origin){await c.focus(); if('navigate' in c) await c.navigate(target.href); return;} }
    await self.clients.openWindow(target.href);
  })());
});
