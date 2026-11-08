
/* Volla United Academy - Offline shell */
const CACHE = 'volla-united-offline-v1';
const shell = ['./offline.html','./offline.js','./style.css'].map(path=>new URL(path,self.registration.scope).href);

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(shell)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    await Promise.all((await caches.keys()).filter(key=>key.startsWith('volla-')&&key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>caches.match(shell[0])));
  }else if(shell.includes(url.href)){
    event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>caches.match(request)));
  }else if(/\.(?:js|html|webmanifest|css)$/i.test(url.pathname)){
    event.respondWith(fetch(request,{cache:'no-store'}));
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
