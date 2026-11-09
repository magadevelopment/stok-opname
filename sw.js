self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('opname-v40').then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/css/style.css',
        '/js/db.js',
        '/js/beranda.js',
        '/js/master.js',
        '/js/scan.js',
        '/js/laporan.js',
        '/js/pengaturan.js'
      ]);
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});