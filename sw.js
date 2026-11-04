/* Service worker: la app abre sin señal. Cambiá VERSION para forzar actualización. */
var VERSION = 'rt-v1';
var CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
var LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return Promise.all([
      c.addAll(CORE),
      // librerías externas: si alguna falla, no se cancela la instalación
      Promise.all(LIBS.map(function (u) { return c.add(new Request(u, { mode: 'no-cors' })).catch(function () {}); }))
    ]);
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return; // el puente con Google Sheets (POST) no se toca
  var url = new URL(req.url);
  if (url.hostname === 'script.google.com' || url.hostname.endsWith('googleusercontent.com') && url.pathname.indexOf('/macros/') === 0) return;

  // páginas y archivos propios: sale del caché al instante y se actualiza en segundo plano
  if (url.origin === self.location.origin) {
    e.respondWith(caches.open(VERSION).then(function (c) {
      return c.match(req, { ignoreSearch: true }).then(function (hit) {
        var net = fetch(req).then(function (res) {
          if (res && res.ok) c.put(req, res.clone());
          return res;
        }).catch(function () { return hit; });
        if (hit) { e.waitUntil(net.catch(function () {})); return hit; }
        if (req.mode === 'navigate') return net.then(function (r) { return r || c.match('./index.html'); });
        return net;
      });
    }));
    return;
  }

  // librerías y tipografías externas: caché primero, se llena sola la primera vez
  e.respondWith(caches.open(VERSION).then(function (c) {
    return c.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
        return res;
      });
    });
  }));
});
