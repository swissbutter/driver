const CACHE_NAME = "driving-ledger-v1";
const ASSETS = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "drive.js",
  "manifest.json",
  "images/call.webp",
  "images/icon.jpeg",
  "images/kakao.png",
  "images/logi.png",
  "images/openmile.png",
  "images/t.png",
  "images/icon-192.png",
  "images/icon-512.png",
  "images/icon-maskable.png",
  "images/apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => {
        console.warn("ServiceWorker pre-caching partial failure:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  // Only handle GET requests and http/https schemes
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // For Google API and external requests, let network handle normally
  if (!url.origin.includes(self.location.origin)) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (e.request.mode === "navigate") {
          return caches.match("index.html");
        }
      });

      return cached || fetchPromise;
    })
  );
});
