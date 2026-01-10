importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js"
);

workbox.setConfig({ debug: false });
// Force waiting service worker to become active
self.skipWaiting();
workbox.core.clientsClaim();

// Precache critical files with revisions (update revisions when files change)
workbox.precaching.precacheAndRoute(
  [
    { url: "./", revision: "1" },
    { url: "./favicon.ico", revision: "1" },
    { url: "./index.html", revision: "1" },
    { url: "./app.html", revision: "2" },
    { url: "./manifest.json", revision: "1" },

    { url: "./src/style.css", revision: "1" },
    { url: "./src/script.js", revision: "2" },

    { url: "./assets/quran.sqlite", revision: "1" },
    // bootstrap
    {
      url: "https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css",
      revision: "1",
    },
    {
      url: "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css",
      revision: "1",
    },
    {
      url: "https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js",
      revision: "1",
    },
    {
      url: "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js",
      revision: "1",
    },
  ],
  {
    // Ignore URL parameters to prevent duplicate caching
    ignoreURLParametersMatching: [/.*/],
  }
);

// Cache-first for precached local and CDN files
workbox.routing.registerRoute(
  ({ url }) =>
    url.origin === location.origin ||
    url.origin === "https://fonts.googleapis.com" ||
    url.origin === "https://cdnjs.cloudflare.com" ||
    url.origin === "https://cdn.jsdelivr.net",
  new workbox.strategies.NetworkFirst({
    cacheName: "core-cache",
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxAgeSeconds: 30 * 24 * 60 * 60,
        maxEntries: 100,
      }),
    ],
  })
);

// Cache images
workbox.routing.registerRoute(
  ({ request }) => request.destination === "image",
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: "image-cache",
  })
);

// Serve Cached Resources
workbox.routing.registerRoute(
  ({ url }) => url.origin === self.location.origin,
  new workbox.strategies.CacheFirst({
    cacheName: "static-cache",
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxAgeSeconds: 7 * 24 * 60 * 60, // Cache static resources for 7 days
      }),
    ],
  })
);

// Serve HTML pages with Network First and offline fallback
workbox.routing.registerRoute(
  ({ request }) => request.mode === "navigate",
  async ({ event }) => {
    try {
      const response = await workbox.strategies
        .networkFirst({
          cacheName: "pages-cache",
          plugins: [
            new workbox.expiration.ExpirationPlugin({
              maxEntries: 50,
            }),
          ],
        })
        .handle({ event });
      return response || (await caches.match("./index.html"));
    } catch (error) {
      return await caches.match("./index.html");
    }
  }
);

// Clean up old/unused caches during activation
self.addEventListener("activate", (event) => {
  const currentCaches = [
    workbox.core.cacheNames.precache,
    "core-cache",
    "image-cache",
    "pages-cache",
    "static-cache",
  ];

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!currentCaches.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
