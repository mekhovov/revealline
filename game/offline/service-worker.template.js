/* Generated only in a distribution. No source page registers this template. */
(() => {
  'use strict';
  const CONFIG = __XONIX_OFFLINE_CONFIG__;
  const scope = new URL(self.registration.scope);
  const prefix = `revealline-offline:${encodeURIComponent(scope.href)}:`;
  const cacheName = `${prefix}${CONFIG.buildId}`;
  const readyURL = new URL('.offline-ready', scope).href;
  const files = new Map(
    CONFIG.files.map((file) => [
      new URL(file.path.split('/').map(encodeURIComponent).join('/'), scope).href,
      file,
    ]),
  );
  const sameScope = (url) => url.origin === scope.origin && url.pathname.startsWith(scope.pathname);
  const hex = (bytes) =>
    Array.from(new Uint8Array(bytes), (n) => n.toString(16).padStart(2, '0')).join('');
  async function verified(response, file) {
    if (!response || !response.ok || response.type === 'opaque') return false;
    const bytes = await response.clone().arrayBuffer();
    return (
      bytes.byteLength === file.bytes &&
      hex(await crypto.subtle.digest('SHA-256', bytes)) === file.sha256
    );
  }
  async function inspect() {
    const existing = await caches.keys();
    if (!existing.includes(cacheName))
      return {
        status: 'not-ready',
        version: CONFIG.version,
        buildId: CONFIG.buildId,
        count: CONFIG.files.length,
        verified: 0,
        bytes: 0,
        missing: CONFIG.files.map((f) => f.path),
        corrupt: [],
      };
    const cache = await caches.open(cacheName),
      missing = [],
      corrupt = [];
    let count = 0,
      bytes = 0;
    for (const [url, file] of files) {
      const response = await cache.match(url);
      if (!response) missing.push(file.path);
      else if (!(await verified(response, file))) corrupt.push(file.path);
      else {
        count++;
        bytes += file.bytes;
      }
    }
    const marker = await cache.match(readyURL);
    return {
      status: marker && !missing.length && !corrupt.length ? 'ready' : 'not-ready',
      version: CONFIG.version,
      buildId: CONFIG.buildId,
      count: files.size,
      verified: count,
      bytes,
      missing,
      corrupt,
    };
  }
  async function install() {
    if ((await inspect()).status === 'ready') return;
    // Verify all downloaded bytes before creating a new version's cache. The
    // installed worker continues using its own content-addressed cache meanwhile.
    const downloaded = [];
    for (const [url, file] of files) {
      if (!sameScope(new URL(url))) throw new Error('Precache escaped its distribution scope');
      const response = await fetch(
        new Request(url, { cache: 'reload', credentials: 'same-origin' }),
      );
      if (response.redirected || !(await verified(response, file)))
        throw new Error(`Offline download failed integrity: ${file.path}`);
      downloaded.push([url, response]);
    }
    const cache = await caches.open(cacheName);
    try {
      for (const [url, response] of downloaded) await cache.put(url, response);
      await cache.put(
        readyURL,
        new Response(CONFIG.buildId, { headers: { 'Content-Type': 'text/plain' } }),
      );
    } catch (error) {
      await caches.delete(cacheName);
      throw error;
    }
  }
  self.addEventListener('install', (event) => event.waitUntil(install()));
  self.addEventListener('activate', (event) =>
    event.waitUntil(
      (async () => {
        const report = await inspect();
        if (report.status !== 'ready') throw new Error('Incomplete offline cache cannot activate');
        // This only runs once old clients no longer use their worker. No skipWaiting.
        for (const key of await caches.keys())
          if (key.startsWith(prefix) && key !== cacheName) await caches.delete(key);
        await self.clients.claim();
      })(),
    ),
  );
  self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (!sameScope(url)) return;
    url.search = '';
    url.hash = '';
    if (url.pathname.endsWith('/')) url.pathname += 'index.html';
    const file = files.get(url.href);
    if (!file) return;
    event.respondWith(
      (async () => {
        const cache = await caches.open(cacheName),
          hit = await cache.match(url.href);
        if (hit) return hit;
        try {
          const response = await fetch(
            new Request(url.href, { cache: 'reload', credentials: 'same-origin' }),
          );
          if (response.redirected || !(await verified(response, file)))
            throw new Error('File changed');
          await cache.put(url.href, response.clone());
          return response;
        } catch {
          return new Response(
            'This offline file is unavailable. Reconnect and prepare this game version again.',
            { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
          );
        }
      })(),
    );
  });
  self.addEventListener('message', (event) => {
    if (
      !['revealline.offline-check', 'revealline.offline-prepare'].includes(event.data?.type) ||
      !event.ports?.[0]
    )
      return;
    if (!event.source?.url || !sameScope(new URL(event.source.url))) return;
    event.waitUntil(
      (async () => {
        try {
          if (event.data.type === 'revealline.offline-prepare') await install();
          event.ports[0].postMessage(await inspect());
        } catch (error) {
          event.ports[0].postMessage({ status: 'error', message: error.message });
        }
      })(),
    );
  });
})();
