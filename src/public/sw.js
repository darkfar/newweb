/* Service worker Story Map: app shell, caching data dinamis, dan push notification. */

const VERSION = 'v1';
const SHELL_CACHE = `story-map-shell-${VERSION}`;
const API_CACHE = `story-map-api-${VERSION}`;
const IMAGE_CACHE = `story-map-images-${VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, API_CACHE, IMAGE_CACHE];

const API_ORIGIN = 'https://story-api.dicoding.dev';
const API_PATH_PREFIX = '/v1/stories';
const MAX_IMAGE_ENTRIES = 60;

// Path relatif terhadap lokasi sw.js, sehingga aman jika di-host di sub-path (mis. GitHub Pages).
const APP_SHELL = [
  './',
  './index.html',
  './app.bundle.js',
  './app.css',
  './manifest.json',
  './favicon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ---------- Lifecycle ----------

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // allSettled: berkas yang tidak ada (mis. app.css saat mode development) tidak menggagalkan instalasi.
      await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('story-map-') && !CURRENT_CACHES.includes(name))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

// ---------- Caching strategies ----------

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreVary: true });
    if (cached) return cached;

    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    return Response.error();
  }
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
  }
}

async function staleWhileRevalidate(event, cacheName, maxEntries) {
  const { request } = event;
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const update = fetch(request)
    .then(async (response) => {
      // Gambar lintas-origin (no-cors) berupa opaque response; tetap boleh disimpan.
      if (response.ok || response.type === 'opaque') {
        await cache.put(request, response.clone());
        await trimCache(cache, maxEntries);
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(update);
    return cached;
  }
  return (await update) ?? Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1) Data dinamis dari Story API: network first, cadangan dari cache saat offline.
  if (url.origin === API_ORIGIN && url.pathname.startsWith(API_PATH_PREFIX)) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // 2) Foto cerita: tampil cepat dari cache, diperbarui di belakang layar.
  if (request.destination === 'image' && url.origin === API_ORIGIN) {
    event.respondWith(staleWhileRevalidate(event, IMAGE_CACHE, MAX_IMAGE_ENTRIES));
    return;
  }

  // 3) App shell (satu origin dengan aplikasi).
  if (url.origin === self.location.origin) {
    const fallback = request.mode === 'navigate' ? './index.html' : undefined;
    event.respondWith(networkFirst(request, SHELL_CACHE, fallback));
  }
});

// ---------- Push notification ----------

function scopeUrl(path) {
  return new URL(path, self.registration.scope).href;
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      // Skema dari Story API: { title, options: { body, data: { id } } }
      let payload = {};
      if (event.data) {
        try {
          payload = event.data.json();
        } catch {
          payload = { title: 'Story Map', options: { body: event.data.text() } };
        }
      }

      const title = payload.title || 'Story Map';
      const options = payload.options || {};
      const storyId = options.data?.id;

      await self.registration.showNotification(title, {
        body: options.body || 'Ada pembaruan baru di Story Map.',
        icon: options.icon || scopeUrl('./icons/icon-192.png'),
        badge: scopeUrl('./icons/icon-192.png'),
        tag: storyId ? `story-${storyId}` : 'story-map',
        data: { ...(options.data || {}), id: storyId },
        actions: storyId
          ? [
              { action: 'view-detail', title: 'Lihat detail' },
              { action: 'dismiss', title: 'Tutup' },
            ]
          : [],
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const storyId = event.notification.data?.id;
  const hash = storyId ? `#/stories/${storyId}` : '#/';

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((client) => client.url.startsWith(self.registration.scope));

      if (existing) {
        await existing.focus();
        existing.postMessage({ type: 'NAVIGATE', hash });
        return;
      }
      await self.clients.openWindow(scopeUrl(`./${hash}`));
    })(),
  );
});
