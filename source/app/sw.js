// G-WIZ offline support. The first visit stores a copy of the app on the device; after that it opens
// from that copy, with or without internet. The page itself checks the website for a newer index.html
// and offers a restart when one has been downloaded; the other files are refreshed quietly here.
const VERSION = '__VERSION__';
const CACHE = 'gwiz-app';
const FILES = ['index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];
const abs = f => new URL(f, self.registration.scope).href;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // keep an existing copy: replacing index.html is the page's job, so updates always come with a notice
    for (const f of FILES){
      if (await c.match(abs(f))) continue;
      try { const r = await fetch(new Request(abs(f), { cache: 'reload' })); if (r.ok) await c.put(abs(f), r); } catch (err) {}
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // old copies of the app go; downloaded AI models stay
    for (const k of await caches.keys()) if (k !== CACHE && !k.startsWith('gwiz-models')) await caches.delete(k);
    await self.clients.claim();
  })());
});
const lastRefresh = new Map();
async function refresh(c, key){
  const now = Date.now(); if (now - (lastRefresh.get(key) || 0) < 60000) return; lastRefresh.set(key, now);
  try { const r = await fetch(new Request(key, { cache: 'no-cache' })); if (r.ok && r.type === 'basic') await c.put(key, r); } catch (err) {}
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.cache === 'no-store' || req.cache === 'reload') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate' || url.href === self.registration.scope || url.pathname.endsWith('/index.html');
  const key = isPage ? abs('index.html') : url.origin + url.pathname;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(key);
    if (hit){ if (!isPage) e.waitUntil(refresh(c, key)); return hit; }
    try {
      const r = await fetch(req);
      if (r.ok && r.type === 'basic' && (isPage || FILES.some(f => abs(f) === key))) await c.put(key, r.clone());
      return r;
    } catch (err) {
      return new Response('<h1>G-WIZ is offline</h1><p>Open G-WIZ once while connected to the internet so it can store a copy on this device.</p>', { status: 503, headers: { 'Content-Type': 'text/html' } });
    }
  })());
});
