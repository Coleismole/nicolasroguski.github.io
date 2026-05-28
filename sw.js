const CACHE = 'nr-portfolio-v1';
const RUNTIME = 'nr-runtime-v1';
const PRECACHE = [
  '/',
  '/styles.min.css?v=5',
  '/analytics.js',
  '/nicolas-photo.webp',
  '/myostatin-inhibitors.html',
  '/subpage-styles.min.css?v=5',
  '/offline.html',
  '/favicon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== RUNTIME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return;

  // Navigation requests — network-first with offline fallback
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
          return res;
        })
        .catch(() =>
          caches.match(request).then(cached => cached || caches.match('/offline.html'))
        )
    );
    return;
  }

  // For other GETs: try cache first, then network and update runtime cache (stale-while-revalidate)
  e.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(RUNTIME).then(c => c.put(request, clone));
        // Trim runtime cache if it grows too large
        trimCache(RUNTIME, 120);
        return res;
      }).catch(() => null);

      // Serve cached if available immediately, otherwise wait for network
      return cached || networkFetch.then(r => r || cached) ;
    })
  );
});

// Simple cache trimming: keep newest `maxItems` entries
function trimCache(cacheName, maxItems) {
  caches.open(cacheName).then(cache => {
    cache.keys().then(keys => {
      if (keys.length <= maxItems) return;
      const excess = keys.length - maxItems;
      // delete oldest entries
      Promise.all(keys.slice(0, excess).map(k => cache.delete(k)));
    });
  });
}
