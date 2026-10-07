/* Service worker de "Sobrevive à Noite": o jogo abre e corre sem internet.
   - páginas: rede primeiro (apanha sempre a versão nova), com a cópia local como reserva
   - ficheiros estáticos (fontes, ícones): cache primeiro
   - /api: nunca vai à cache */
const VERSION = 'sn-v3';
const SHELL = [
  '/', '/index.html', '/manifest.webmanifest',
  '/fonts/nunito-latin-600-normal.woff2', '/fonts/nunito-latin-800-normal.woff2', '/fonts/pixelify-sans-latin-600-normal.woff2',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png', '/icons/favicon-32.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function networkFirst(req){
  const cache = await caches.open(VERSION);
  try {
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(req, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    if (res.ok) cache.put('/index.html', res.clone());
    return res;
  } catch (e) {
    return (await cache.match('/index.html')) || (await cache.match('/')) || Response.error();
  }
}
async function cacheFirst(req){
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(req.mode === 'navigate' ? networkFirst(req) : cacheFirst(req));
});
