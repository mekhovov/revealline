/* Only the lightweight launcher is controlled here; editions own their workers. */
const CONFIG = __REVEALLINE_LAUNCHER_CONFIG__;
const scope = self.registration.scope;
const name = `revealline-launcher:${encodeURIComponent(scope)}:${CONFIG.id}`;
const hash = async (bytes) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
async function checked(response, file) {
  if (
    !response ||
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
  if (length !== file.bytes || (await hash(bytes)) !== file.sha256)
    throw new Error('Launcher integrity check failed.');
  const headers = new Headers(response.headers);
  headers.delete('Content-Encoding');
  headers.set('Content-Length', String(length));
  return new Response(bytes, { headers });
}
async function verify({ repair = false } = {}) {
  const cache = await caches.open(name),
    missing = [];
  for (const file of CONFIG.files) {
    const url = new URL(file.path, scope).href;
    try {
      await checked(await cache.match(url), file);
    } catch {
      if (!repair) {
        missing.push(file.path);
        continue;
      }
      await cache.put(url, await checked(await fetch(url, { cache: 'reload' }), file));
    }
  }
  return { status: missing.length ? 'incomplete' : 'ready', missing };
}
self.addEventListener('install', (event) => event.waitUntil(verify({ repair: true })));
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
self.addEventListener('message', (event) => {
  if (
    !['revealline.launcher-check', 'revealline.launcher-prepare'].includes(event.data?.type) ||
    !event.ports?.[0]
  )
    return;
  event.waitUntil(
    (async () => {
      let report;
      try {
        report = await verify({ repair: event.data.type === 'revealline.launcher-prepare' });
      } catch (error) {
        report = { status: 'incomplete', message: error.message };
      }
      event.ports[0].postMessage({
        ...report,
        format: 'revealline.launcher-health.v1',
        requestId: event.data.requestId,
      });
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
