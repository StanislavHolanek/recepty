// Offline režim: aplikace se načte i bez signálu.
// VERSION doplní při vydání nastroje/vydej.mjs (edice + otisk souborů), při vývoji zůstává 'vyvoj'
const VERSION = 'martinka-10897a6d14';
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'config.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/apple-touch-icon.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Soubory aplikace: nejdřív síť (aby se projevily úpravy), při výpadku mezipaměť.
// Volání Supabase (data, přihlášení, fotky) a převod fotek se nekešují.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const isShell = e.request.method === 'GET' &&
    (url.origin === location.origin || /^https:\/\/(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)\//.test(url.href));
  if (!isShell) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }) // ověřit u serveru, ne starou kopii prohlížeče
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
