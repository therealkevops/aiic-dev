// Vite plugin: after the bundle is written, emit sw.js with the full list of build files so
// the app (every lazily loaded screen, fonts and icons included) works offline once installed.
import { createHash } from 'node:crypto';

const SW_SOURCE = (version, files) => `// Generated at build time; do not edit.
const CACHE = 'aiic-${version}';
const PRECACHE = ${JSON.stringify(files)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('aiic-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    // Pages: network first so a new release is picked up, the cached shell when offline.
    event.respondWith(fetch(request).catch(() => caches.match('./')));
    return;
  }
  // Build files are content-hashed, so the cached copy is always right.
  event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
});
`;

export function serviceWorker() {
  return {
    name: 'aiic-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      // .woff files are only a fallback for browsers without woff2, so they are not precached.
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map') && !f.endsWith('.woff'));
      const publicFiles = ['manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
      const all = ['./', ...[...files, ...publicFiles].map((f) => `./${f}`)].sort();
      const version = createHash('sha256').update(all.join('\n')).digest('hex').slice(0, 12);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: SW_SOURCE(version, all) });
    },
  };
}
