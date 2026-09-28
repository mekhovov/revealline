/** Serialized by the optional builder. Keep the body self-contained. */
export function installPracticeWorker(scope, pins, revision) {
  const base = scope.registration.scope;
  const owner = `revealline.optional.package.v1:${new URL(base).pathname}:`;
  const cacheName = owner + revision;
  const urls = new Map(pins.map((pin) => [new URL(pin.path, base).href, pin]));
  const sha = async (bytes) =>
    [...new Uint8Array(await scope.crypto.subtle.digest('SHA-256', bytes))]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
  scope.addEventListener('install', (event) =>
    event.waitUntil(
      (async () => {
        const existed = (await scope.caches.keys()).includes(cacheName);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
          const verified = [];
          for (const [url, pin] of urls) {
            const response = await scope.fetch(url, {
              cache: 'no-store',
              signal: controller.signal,
            });
            if (!response.ok) throw new Error('Optional package dependency unavailable');
            const reader = response.body?.getReader();
            if (!reader) throw new Error('Bounded optional download unavailable');
            const chunks = [];
            let length = 0;
            try {
              for (;;) {
                if (controller.signal.aborted) throw new Error('Optional download cancelled');
                const chunk = await reader.read();
                if (chunk.done) break;
                length += chunk.value.byteLength;
                if (length > pin.bytes) throw new Error('Optional package dependency too large');
                chunks.push(chunk.value);
              }
            } finally {
              await reader.cancel().catch(() => {});
            }
            const bytes = new Uint8Array(length);
            let offset = 0;
            for (const chunk of chunks) {
              bytes.set(chunk, offset);
              offset += chunk.byteLength;
            }
            if (length !== pin.bytes || (await sha(bytes)) !== pin.sha256)
              throw new Error('Optional package dependency mismatch');
            verified.push([url, bytes, response.headers]);
          }
          if (controller.signal.aborted) throw new Error('Optional download cancelled');
          const cache = await scope.caches.open(cacheName);
          for (const [url, bytes, headers] of verified)
            await cache.put(url, new Response(bytes, { status: 200, headers }));
          await scope.skipWaiting();
        } catch (error) {
          // Existing exact revision bytes remain useful if a redundant install fails.
          if (!existed) await scope.caches.delete(cacheName);
          throw error;
        } finally {
          clearTimeout(timeout);
        }
      })(),
    ),
  );
  scope.addEventListener('activate', (event) =>
    event.waitUntil(
      (async () => {
        for (const name of await scope.caches.keys())
          if (name.startsWith(owner) && name !== cacheName) await scope.caches.delete(name);
        await scope.clients.claim();
      })(),
    ),
  );
  scope.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (url.href === base) url.pathname += 'index.html';
    if (event.request.method === 'GET' && urls.has(url.href))
      event.respondWith(
        (async () =>
          (await (await scope.caches.open(cacheName)).match(url.href)) ||
          scope.fetch(event.request))(),
      );
  });
}
