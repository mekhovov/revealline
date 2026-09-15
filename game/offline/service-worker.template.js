/* Generated only in a distribution. No source page registers this template. */
(() => {
  'use strict';
  const CONFIG = __XONIX_OFFLINE_CONFIG__;
  const MAX_BYTES = 64 * 1024 * 1024;
  const DOWNLOAD_CONCURRENCY = 4;
  if (!Array.isArray(CONFIG.files) || CONFIG.files.length > 2000)
    throw new Error('Offline inventory exceeds its file budget');
  let inventoryBytes = 0;
  for (const file of CONFIG.files) {
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 0 || file.bytes > MAX_BYTES)
      throw new Error('Offline inventory has an invalid byte budget');
    inventoryBytes += file.bytes;
    if (inventoryBytes > MAX_BYTES) throw new Error('Offline inventory exceeds its byte budget');
  }
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
  async function downloadVerified(url, file, signal) {
    if (!sameScope(new URL(url))) throw new Error('Precache escaped its distribution scope');
    const response = await fetch(
      new Request(url, { cache: 'reload', credentials: 'same-origin', signal }),
    );
    let reader;
    try {
      if (
        response.redirected ||
        !response.ok ||
        response.type === 'opaque' ||
        response.status === 206 ||
        response.headers
          .get('Vary')
          ?.split(',')
          .some((value) => value.trim() === '*')
      )
        throw new Error(`Offline download failed integrity: ${file.path}`);
      const bytes = new Uint8Array(file.bytes);
      let length = 0;
      if (response.body) {
        reader = response.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!(value instanceof Uint8Array) || value.byteLength > bytes.byteLength - length)
            throw new Error(`Offline download exceeds its byte budget: ${file.path}`);
          bytes.set(value, length);
          length += value.byteLength;
        }
      }
      if (
        length !== file.bytes ||
        hex(await crypto.subtle.digest('SHA-256', bytes)) !== file.sha256
      )
        throw new Error(`Offline download failed integrity: ${file.path}`);
      const headers = new Headers(response.headers);
      // Fetch delivers decoded bytes; network encoding/length may describe the wire body.
      headers.delete('Content-Encoding');
      headers.set('Content-Length', String(bytes.byteLength));
      return { bytes, headers, status: response.status, statusText: response.statusText };
    } catch (error) {
      try {
        if (reader) await reader.cancel();
        else await response.body?.cancel();
      } catch {}
      throw error;
    } finally {
      reader?.releaseLock();
    }
  }
  function ownedResponse({ bytes, headers, status, statusText }) {
    const body = bytes.byteLength === 0 && [204, 205].includes(status) ? null : bytes;
    return new Response(body, { headers, status, statusText });
  }
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
  async function installFiles() {
    if ((await inspect()).status === 'ready') return;
    // Own and verify every body before creating a new version's cache. Avoid
    // retaining unread network branches while another clone is consumed.
    const entries = [...files],
      downloaded = new Array(entries.length),
      controller = new AbortController();
    let next = 0,
      failure;
    await Promise.all(
      Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, entries.length) }, async () => {
        while (!failure && next < entries.length) {
          const index = next++,
            [url, file] = entries[index];
          try {
            downloaded[index] = { url, ...(await downloadVerified(url, file, controller.signal)) };
          } catch (error) {
            if (!failure) {
              failure = error;
              controller.abort();
            }
          }
        }
      }),
    );
    if (failure) {
      downloaded.length = 0;
      throw failure;
    }
    const cache = await caches.open(cacheName);
    try {
      for (const item of downloaded) {
        await cache.put(item.url, ownedResponse(item));
        item.bytes = null;
      }
      await cache.put(
        readyURL,
        new Response(CONFIG.buildId, { headers: { 'Content-Type': 'text/plain' } }),
      );
    } catch (error) {
      await caches.delete(cacheName);
      throw error;
    } finally {
      downloaded.length = 0;
    }
  }
  let installation;
  function install() {
    // Two open tabs repairing one evicted cache share the same bounded work.
    return (installation ??= installFiles().finally(() => {
      installation = null;
    }));
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
          const owned = await downloadVerified(url.href, file);
          await cache.put(url.href, ownedResponse(owned));
          return ownedResponse(owned);
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
