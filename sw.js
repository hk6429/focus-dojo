const VERSION = 'fd-v5';
const SHELL = ['./', 'index.html', 'css/style.css?v=5', 'js/store.js?v=5', 'js/ui.js?v=5', 'js/quotes.js?v=5', 'js/game.js?v=5', 'js/timer.js?v=5', 'js/breath.js?v=5', 'js/games.js?v=5', 'js/stats.js?v=5', 'js/app.js?v=5', 'manifest.json', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
    const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return res;
  }).catch(() => caches.match('index.html'))));
});
