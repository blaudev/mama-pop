// Service worker: hace que el juego se pueda instalar y funcione sin conexión.
//
// Estrategia «primero la red»: con conexión siempre se carga la última versión
// (y se guarda una copia); sin conexión se usa la copia guardada. Así, al
// publicar cambios no hace falta tocar nada aquí para que lleguen.
//
// GitHub Pages dice al navegador que guarde cada archivo 10 minutos; por eso
// se pide al servidor con `cache: 'no-cache'` (pregunta siempre si hay versión
// nueva) y no con la copia de esos 10 minutos: lo publicado llega al momento.
//
// Si añades un archivo al juego, añádelo a ASSETS (el test test/pwa.test.js
// avisa si falta alguno). Sube VERSION si quieres forzar a tirar las copias viejas.

const VERSION = 'v2';
const CACHE = `mama-pop-${VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './src/animals.js',
  './src/cameo.js',
  './src/dedication.js',
  './src/game.js',
  './src/input.js',
  './src/launcher.js',
  './src/levels.js',
  './src/logic.js',
  './src/maps.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'no-cache' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('mama-pop-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Tipografías de Google: se guardan la primera vez y luego se sirven de la copia.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Archivos del juego: primero la red (sin la copia de 10 minutos del navegador);
  // si no hay conexión, la copia guardada.
  event.respondWith(
    fetch(request, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html'))),
  );
});
