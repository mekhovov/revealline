/* Only the lightweight launcher is controlled here; editions own their workers. */
const CONFIG = __REVEALLINE_LAUNCHER_CONFIG__;
const scope = self.registration.scope;
const name = `revealline-launcher:${encodeURIComponent(scope)}:${CONFIG.id}`;
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(name);
      for (const file of CONFIG.files) {
        const url = new URL(file.path, scope).href,
          response = await fetch(url, { cache: 'reload' });
        if (
          !response.ok ||
          response.redirected ||
          response.status !== 200 ||
          file.bytes > 128 * 1024
        )
          throw new Error('Launcher download failed.');
        const reader = response.body.getReader(),
          bytes = new Uint8Array(file.bytes);
        let length = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (length + value.length > bytes.length)
              throw new Error('Launcher exceeded its file budget.');
            bytes.set(value, length);
            length += value.length;
          }
        } finally {
          await reader.cancel().catch(() => {});
        }
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('');
        if (length !== file.bytes || hash !== file.sha256)
          throw new Error('Launcher integrity check failed.');
        const headers = new Headers(response.headers);
        headers.delete('Content-Encoding');
        headers.set('Content-Length', String(length));
        await cache.put(url, new Response(bytes, { headers }));
      }
    })(),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith(`revealline-launcher:${encodeURIComponent(scope)}:`) && key !== name)
          await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.href.startsWith(scope)) return;
  url.search = '';
  url.hash = '';
  if (url.pathname.endsWith('/')) url.pathname += 'index.html';
  if (!CONFIG.files.some((file) => new URL(file.path, scope).href === url.href)) return;
  event.respondWith(
    (async () => (await (await caches.open(name)).match(url.href)) || fetch(event.request))(),
  );
});
