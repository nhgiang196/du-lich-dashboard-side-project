const CACHE_NAME = "dalat-trip-shell-v1";
const CORE_ASSETS = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "CACHE_URLS" || !Array.isArray(data.urls)) return;

  const sameOriginUrls = data.urls.filter((u) => {
    try {
      return new URL(u, self.location.origin).origin === self.location.origin;
    } catch {
      return false;
    }
  });

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of sameOriginUrls) {
        const existing = await cache.match(url);
        if (!existing) {
          try {
            const res = await fetch(url);
            if (res.ok) await cache.put(url, res);
          } catch {
            // Ignore offline errors while warming cache
          }
        }
      }
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put("/", copy.clone());
              cache.put("/index.html", copy);
            });
          }
          return response;
        })
        .catch(async () => {
          const cachedIndex =
            (await caches.match("/index.html")) ||
            (await caches.match("/")) ||
            (await caches.match(request));
          if (cachedIndex) return cachedIndex;
          throw new Error("Offline and no cached shell available");
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
