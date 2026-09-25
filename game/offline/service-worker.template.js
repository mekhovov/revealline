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
  const PROTOCOL = 'revealline.offline-progress.v1';
  const subscribers = new Set();
  const MAX_SUBSCRIBERS = 64;
  const SUBSCRIBER_LIFETIME = 5 * 60 * 1000;
  let operationSequence = 0,
    latestProgress;
  function progress(stage, completed = 0, counters = {}) {
    latestProgress = {
      status: 'preparing',
      stage,
      operationId: `${CONFIG.buildId}:${operationSequence}`,
      progress: files.size ? { completed, total: files.size, unit: 'files' } : null,
      ...counters,
    };
    for (const subscriber of subscribers) subscriber.send('progress', latestProgress);
  }
  function subscribe(port, requestId) {
    let closed = false;
    const subscriber = {
      send(kind, report) {
        if (closed) return;
        try {
          port.postMessage({
            ...report,
            format: PROTOCOL,
            requestId,
            kind,
            scope: scope.href,
            buildId: CONFIG.buildId,
            version: CONFIG.version,
          });
        } catch {
          subscriber.close();
        }
      },
      close() {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        subscribers.delete(subscriber);
        port.onmessage = null;
        port.onmessageerror = null;
        port.close?.();
      },
    };
    const timer = setTimeout(() => subscriber.close(), SUBSCRIBER_LIFETIME);
    port.onmessage = (event) => {
      if (event.data?.type === 'revealline.offline-detach' && event.data.requestId === requestId)
        subscriber.close();
    };
    port.onmessageerror = () => subscriber.close();
    // A tab that disappears without detaching must not retain a port indefinitely.
    if (subscribers.size >= MAX_SUBSCRIBERS) subscribers.values().next().value.close();
    subscribers.add(subscriber);
    return subscriber;
  }
  const hex = (bytes) =>
    Array.from(new Uint8Array(bytes), (n) => n.toString(16).padStart(2, '0')).join('');
  async function downloadVerified(url, file, signal, onDownloaded = () => {}) {
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
      if (length !== file.bytes) throw new Error(`Offline download failed integrity: ${file.path}`);
      onDownloaded();
      if (hex(await crypto.subtle.digest('SHA-256', bytes)) !== file.sha256)
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
  async function inspect(notify = () => {}) {
    notify(0, 0);
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
      bytes = 0,
      checked = 0;
    for (const [url, file] of files) {
      const response = await cache.match(url);
      if (!response) missing.push(file.path);
      else if (!(await verified(response, file))) corrupt.push(file.path);
      else {
        count++;
        bytes += file.bytes;
      }
      notify(++checked, count);
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
    // Finish any existing read before repair so a pre-repair snapshot cannot be
    // reused as the final report after this installation saves its files.
    const cached = await (inspection ??
      inspect((checked, cacheVerified) =>
        progress('checking', checked, { checked, cacheVerified }),
      ));
    if (cached.status === 'ready') return cached;
    // Own and verify every body before creating a new version's cache. Avoid
    // retaining unread network branches while another clone is consumed.
    const entries = [...files],
      downloaded = new Array(entries.length),
      controller = new AbortController();
    let next = 0,
      downloadedCount = 0,
      downloadVerifiedCount = 0,
      saved = 0,
      failure;
    const counters = () => ({
      downloaded: downloadedCount,
      downloadVerified: downloadVerifiedCount,
      saved,
    });
    progress('downloading', 0, counters());
    await Promise.all(
      Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, entries.length) }, async () => {
        while (!failure && next < entries.length) {
          const index = next++,
            [url, file] = entries[index];
          try {
            downloaded[index] = {
              url,
              ...(await downloadVerified(url, file, controller.signal, () => {
                downloadedCount++;
              })),
            };
            downloadVerifiedCount++;
            progress('downloading', downloadVerifiedCount, counters());
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
      progress('saving', 0, counters());
      for (const item of downloaded) {
        await cache.put(item.url, ownedResponse(item));
        item.bytes = null;
        progress('saving', ++saved, counters());
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
  let installation, inspection;
  function install() {
    // Two open tabs repairing one evicted cache share the same bounded work.
    if (!installation) {
      operationSequence++;
      latestProgress = null;
    }
    return (installation ??= installFiles().finally(() => {
      installation = null;
      latestProgress = null;
    }));
  }
  function check() {
    // Observing existing installation remains read-only; never start a repair here.
    if (installation) return installation.then((report) => report ?? check());
    if (!inspection) {
      operationSequence++;
      inspection = inspect((checked, cacheVerified) =>
        progress('verifying', checked, { checked, cacheVerified }),
      ).finally(() => {
        inspection = null;
        if (!installation) latestProgress = null;
      });
    }
    return inspection;
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
    const port = event.ports[0],
      request = event.data,
      streaming = request.protocol === PROTOCOL;
    if (streaming && (typeof request.requestId !== 'string' || request.requestId.length > 120))
      return;
    const subscriber = streaming ? subscribe(port, request.requestId) : null;
    event.waitUntil(
      (async () => {
        try {
          if (streaming && (request.buildId !== CONFIG.buildId || request.scope !== scope.href)) {
            subscriber.send('terminal', {
              status: 'not-ready',
              messageCode: 'differentBuild',
              message: 'Offline worker belongs to a different build. Reopen this version online.',
            });
            return;
          }
          if (latestProgress) subscriber?.send('progress', latestProgress);
          const report =
            (request.type === 'revealline.offline-prepare' ? await install() : null) ??
            (await check());
          if (subscriber) subscriber.send('terminal', report);
          else port.postMessage(report);
        } catch (error) {
          const report = {
            status: 'error',
            messageCode: 'downloadFailed',
            message: error.message,
            buildId: CONFIG.buildId,
          };
          if (subscriber) subscriber.send('terminal', report);
          else port.postMessage(report);
        } finally {
          subscriber?.close();
        }
      })(),
    );
  });
})();
