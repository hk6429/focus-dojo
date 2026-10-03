const VERSION = 'fd-v7';
const SHELL = ['./', 'index.html', 'css/style.css?v=6', 'js/store.js?v=6', 'js/ui.js?v=6', 'js/quotes.js?v=6', 'js/game.js?v=6', 'js/timer.js?v=6', 'js/breath.js?v=6', 'js/sound.js?v=6', 'js/games.js?v=6', 'js/stats.js?v=6', 'js/app.js?v=6', 'manifest.json', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return; // 學習航站 SDK 等外站資源不進快取
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
    const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return res;
  }).catch(() => caches.match('index.html'))));
});
