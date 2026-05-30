const CACHE_VERSION = 'v10';
const CACHE = 'nr-portfolio-' + CACHE_VERSION;
const RUNTIME = 'nr-runtime-' + CACHE_VERSION;
const PRECACHE = [
  '/',
  '/assets/css/styles.min.css?v=9',
  '/assets/js/analytics.js',
  '/assets/img/nicolas-photo.webp',
  '/assets/img/nicolas-photo.avif',
  '/myostatin-inhibitors.html',
  '/assets/css/subpage-styles.min.css?v=9',
  '/offline.html',
  '/assets/img/favicon.svg',
  '/assets/fonts/fonts.css',
  '/assets/js/main.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE.filter(url => {
        // Skip optional assets that may not exist yet
        return !url.includes('.avif') && !url.includes('fonts.css') && !url.includes('main.js');
      })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE && k !== RUNTIME)
          .map(k => caches.delete(k))
      )
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

  // Fonts & versioned assets — cache-first (they have immutable headers)
  if (url.pathname.startsWith('/assets/fonts/') || url.searchParams.has('v')) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (!res || res.status !== 200) return res;
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
          return res;
        });
      })
    );
    return;
  }

  // Everything else — stale-while-revalidate via runtime cache
  e.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(RUNTIME).then(c => {
          c.put(request, clone);
          trimCache(RUNTIME, 80);
        });
        return res;
      }).catch(() => null);

      return cached || networkFetch.then(r => r || cached);
    })
  );
});

function trimCache(cacheName, maxItems) {
  caches.open(cacheName).then(cache => {
    cache.keys().then(keys => {
      if (keys.length <= maxItems) return;
      const excess = keys.length - maxItems;
      Promise.all(keys.slice(0, excess).map(k => cache.delete(k)));
    });
  });
}
