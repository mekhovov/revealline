/* Generated only in a distribution. No source page registers this template. */
(() => {
  'use strict';
  const CONFIG = __XONIX_OFFLINE_CONFIG__;
  const MAX_BYTES = 80 * 1024 * 1024;
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
  const officialFiles = new Map(
    (CONFIG.downloadFiles || []).map((file) => [new URL(file.path, scope).href, file]),
  );
  // Only the build's admitted, deliberately omitted source PNGs may produce a
  // local 404. All other unknown URLs retain ordinary network/error behavior.
  const omittedSourceOriginals = new Set();
  const omitted = CONFIG.omittedSourceOriginals ?? [];
  if (!Array.isArray(omitted) || omitted.length > 256)
    throw new Error('Invalid omitted source-original inventory');
  for (const relative of omitted) {
    if (
      typeof relative !== 'string' ||
      relative.length > 512 ||
      !relative.startsWith('authoring/') ||
      !relative.endsWith('.png') ||
      relative.split('/').some((part) => !part || part === '.' || part === '..') ||
      /[\\%?#:\u0000-\u0020\u007f]/.test(relative)
    )
      throw new Error('Invalid omitted source-original path');
    const url = new URL(relative, scope);
    if (
      url.origin !== scope.origin ||
      !url.href.startsWith(scope.href) ||
      omittedSourceOriginals.has(url.href) ||
      files.has(url.href) ||
      officialFiles.has(url.href)
    )
      throw new Error('Conflicting omitted source-original path');
    omittedSourceOriginals.add(url.href);
  }
  const officialKey = (hash) => new URL(`/.revealline-official/sha256/${hash}`, scope.origin).href;
  const sameScope = (url) => url.origin === scope.origin && url.pathname.startsWith(scope.pathname);
  const recoveryPath = new URL('.offline-recovery.mjs', scope).pathname;
  const startupRoutes = new Map(
    (CONFIG.startupRoutes || []).map((route) => [new URL(route.path, scope).href, route.files]),
  );
  async function startupMissing(cache, url) {
    const required = startupRoutes.get(url);
    if (!required) return false;
    // One bounded metadata read, no hashing or body reads on the launch path.
    // Only this document's static startup closure is considered, not optional packs.
    const available = new Set((await cache.keys()).map((request) => request.url));
    return required.some((path) => !available.has(new URL(path, scope).href));
  }
  const escapeHTML = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (character) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
    );
  function recoveryDocument(request) {
    const retry = new URL(request.url);
    // A ZIP or branded distribution may have no launcher at a guessed parent
    // address. Only offer the launcher this exact distribution actually ships.
    const manage = files.has(new URL('app/index.html', scope).href)
      ? new URL('app/?manage', scope)
      : null;
    return new Response(
      `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#091324"><title>FPV / LINE · Offline recovery</title>
<style>body{margin:0;padding:max(24px,env(safe-area-inset-top)) max(24px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left));background:#091324;color:#edf2e8;font:18px/1.5 system-ui}main{max-width:40rem;margin:auto}h1{font-size:1.8rem}button,a{box-sizing:border-box;display:inline-block;min-height:44px;padding:12px;margin:8px 8px 8px 0;font:inherit}a{color:#7fdbeb}button{border:1px solid #7fdbeb;border-radius:4px;background:#153049;color:#fff;cursor:pointer}button:disabled{opacity:.65}a:focus-visible,button:focus-visible{outline:3px solid #f6d572;outline-offset:3px}[role=status]{min-height:3em}.actions{display:flex;flex-wrap:wrap}</style>
<script src="${escapeHTML(new URL('.offline-recovery.mjs', scope).href)}" defer></script></head>
<body><main><p>FPV / LINE</p><h1 id="title">Your offline game needs repair</h1>
<p id="help">Some files needed to open this game are unavailable. Connect to the internet, then repair this edition.</p>
<p id="preservation">Repair replaces game files only. It does not change saved progress, imported pictures or music.</p>
<p id="status" role="status" aria-live="polite">You can retry after reconnecting. This screen does not start a download automatically.</p>
<div class="actions"><button id="repair" type="button" disabled>Repair game files</button>
<a id="retry" href="${escapeHTML(retry.href)}">Try opening the game</a>
${manage ? `<a id="manage" href="${escapeHTML(manage.href)}">Manage installed game</a>` : ''}</div>
<noscript><p>Enable JavaScript to repair game files. You can still use the links above.</p></noscript>
</main></body></html>`,
      {
        status: 503,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Security-Policy':
            "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
        },
      },
    );
  }
  function recoveryScript() {
    // This small script is served from the worker itself, so evicted application
    // modules cannot disable the repair button. Repair uses the existing exact-build
    // protocol; it never selects a new edition or opens a profile store.
    return new Response(
      `(() => {
const buildId = ${JSON.stringify(CONFIG.buildId)}, scope = ${JSON.stringify(scope.href)};
const protocol = 'revealline.offline-progress.v1';
const $ = (id) => document.getElementById(id);
const requested = new URL(location.href).searchParams.get('lang');
let saved;
try { saved = globalThis.localStorage?.getItem('revealline.locale.v1'); } catch { /* Storage can be unavailable. */ }
const supported = (value) => ['en','uk'].includes(value);
const detected = [...(navigator.languages || []), navigator.language].map(value => value?.split('-')[0]).find(supported);
const locale = supported(requested) ? requested : supported(saved) ? saved : detected || 'en';
const uk = locale === 'uk';
const copy = uk ? {
title:'Офлайн-гра потребує відновлення',
help:'Деякі файли, потрібні для запуску гри, недоступні. Підключіться до інтернету та відновіть це видання.',
preservation:'Відновлення замінює лише файли гри. Збережений прогрес, імпортовані зображення та музика не змінюються.',
status:'Після підключення можна повторити спробу. Цей екран не починає завантаження автоматично.',
repair:'Відновити файли гри',retry:'Спробувати відкрити гру',manage:'Керувати встановленою грою',
working:'Перевіряємо та відновлюємо файли гри… Залишайте цей екран відкритим.',
ready:'Файли гри відновлено. Тепер можна відкрити гру.',
failed:'Не вдалося завершити відновлення. Перевірте підключення та вільне місце, потім повторіть спробу. Не очищайте дані сайту.',
changed:'Видання змінилося. Відкрийте керування встановленою грою та перевірте оновлення.',
waiting:'Перевірка ще не завершилася. Можна повторити її після підключення; вже збережені файли залишаються.'
} : {
working:'Checking and repairing game files… Keep this screen open.',
ready:'Game files repaired. You can now open the game.',
failed:'Repair could not finish. Check your connection and free space, then retry. Do not clear site data.',
changed:'The edition changed. Open Manage installed game and check for an update.',
waiting:'The check has not finished. Retry after reconnecting; files already saved are kept.'
};
document.documentElement.lang = locale;
if (uk) for (const id of ['title','help','preservation','status','repair','retry','manage']) { const element = $(id); if (element) element.textContent = copy[id]; }
for (const id of ['retry','manage']) { const element = $(id); if (element?.href) { const url = new URL(element.href); url.searchParams.set('lang', locale); element.href = url.href; } }
let port, timer;
function finish(message) { clearTimeout(timer); port?.close(); port = null; $('repair').disabled = !navigator.serviceWorker?.controller; $('status').textContent = message; }
function observe() { clearTimeout(timer); timer = setTimeout(() => finish(copy.waiting), 30000); }
$('repair').disabled = !navigator.serviceWorker?.controller;
$('repair').onclick = () => {
  const worker = navigator.serviceWorker?.controller;
  if (!worker || port) return;
  const channel = new MessageChannel(), requestId = 'startup-repair-' + Date.now();
  port = channel.port1;
  $('repair').disabled = true; $('status').textContent = copy.working;
  port.onmessage = ({data}) => {
    if (data?.format !== protocol || data.requestId !== requestId || data.scope !== scope) return;
    if (data.buildId !== buildId && !(data.kind === 'terminal' && data.messageCode === 'differentBuild')) return;
    observe();
    if (data.kind === 'terminal') finish(data.status === 'ready' ? copy.ready : data.messageCode === 'differentBuild' ? copy.changed : copy.failed);
  };
  port.onmessageerror = () => finish(copy.failed);
  observe();
  try { worker.postMessage({type:'revealline.offline-prepare', protocol, requestId, scope, buildId}, [channel.port2]); }
  catch { finish(copy.failed); }
};
addEventListener('pagehide', () => { if (port) finish(copy.waiting); });
addEventListener('pageshow', () => { if (!port) $('repair').disabled = !navigator.serviceWorker?.controller; });
navigator.serviceWorker?.addEventListener?.('controllerchange', () => {
  if (port) finish(copy.changed);
  else $('repair').disabled = !navigator.serviceWorker?.controller;
});
})();`,
      {
        headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' },
      },
    );
  }
  async function requestedRange(response, request) {
    const range = request.headers?.get('Range');
    if (!range || response.status !== 200) return response;
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const blob = await response.blob(),
      total = blob.size;
    let start = match?.[1] ? Number(match[1]) : Math.max(0, total - Number(match?.[2]));
    let end = match?.[1] && match[2] ? Number(match[2]) : total - 1;
    if (
      !match ||
      (!match[1] && !match[2]) ||
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      start >= total ||
      end < start
    )
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
    end = Math.min(end, total - 1);
    const headers = new Headers(response.headers);
    headers.delete('Content-Encoding');
    headers.set('Content-Range', `bytes ${start}-${end}/${total}`);
    headers.set('Content-Length', String(end - start + 1));
    headers.set('Accept-Ranges', 'bytes');
    return new Response(blob.slice(start, end + 1), { status: 206, headers });
  }
  const PROTOCOL = 'revealline.offline-progress.v1';
  function authorizedSource(event) {
    if (!event.source?.url) return false;
    let source;
    try {
      source = new URL(event.source.url);
    } catch {
      return false;
    }
    if (sameScope(source)) return true;
    // The stable launcher prepares immutable editions from outside their game
    // scope. This single document must name the exact worker/build explicitly;
    // older same-scope callers retain their existing message compatibility.
    const release = scope.pathname.indexOf('/releases/');
    const root = release >= 0 ? scope.pathname.slice(0, release + 1) : scope.pathname;
    return (
      source.origin === scope.origin &&
      !source.username &&
      !source.password &&
      source.pathname === `${root}app/update.html` &&
      event.data?.protocol === PROTOCOL &&
      event.data.scope === scope.href &&
      event.data.buildId === CONFIG.buildId
    );
  }
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
  let durableController;
  async function installDurableFiles() {
    durableController = new AbortController();
    const signal = durableController.signal;
    const cache = await caches.open(cacheName);
    const indexes = await caches.open('revealline-core-index-v1');
    const candidates = new Map();
    for (const request of await indexes.keys()) {
      try {
        const prior = await (await indexes.match(request)).json();
        if (prior.cache === cacheName || !prior.cache.startsWith('revealline-offline:')) continue;
        for (const file of prior.files) {
          const list = candidates.get(file.sha256) || [];
          list.push({ cache: prior.cache, url: new URL(file.path, prior.scope).href });
          candidates.set(file.sha256, list);
        }
      } catch {
        /* Stale metadata never proves that content is present. */
      }
    }
    await indexes.put(
      new URL(`.offline-index-${CONFIG.buildId}`, scope).href,
      new Response(JSON.stringify({ cache: cacheName, scope: scope.href, files: CONFIG.files })),
    );
    const originalIndex = await caches.open('revealline-official-original-index-v1');
    for (const original of CONFIG.downloadOriginals || [])
      await originalIndex.put(officialKey(original.sha256), new Response(JSON.stringify(original)));
    let completed = 0;
    for (const [url, file] of files) {
      signal.throwIfAborted();
      if (await verified(await cache.match(url), file)) {
        candidates.set(file.sha256, [{ cache: cacheName, url }]);
        progress('saving', ++completed);
        continue;
      }
      let reusable = null;
      for (const candidate of candidates.get(file.sha256) || []) {
        const hit = await (await caches.open(candidate.cache)).match(candidate.url);
        if (await verified(hit, file)) {
          reusable = hit;
          break;
        }
      }
      const response = reusable || ownedResponse(await downloadVerified(url, file, signal));
      // Atomic, verified file checkpoints survive worker termination and quota errors.
      // Missing readiness marker keeps partial editions from being activated.
      await cache.put(url, response);
      candidates.set(file.sha256, [{ cache: cacheName, url }]);
      progress('saving', ++completed);
    }
    signal.throwIfAborted();
    await cache.put(
      readyURL,
      new Response(CONFIG.buildId, { headers: { 'Content-Type': 'text/plain' } }),
    );
  }
  async function installFiles() {
    if (Array.isArray(CONFIG.downloadFiles)) return installDurableFiles();
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
    if (url.pathname === recoveryPath) {
      event.respondWith(Promise.resolve(recoveryScript()));
      return;
    }
    url.search = '';
    url.hash = '';
    if (url.pathname.endsWith('/')) url.pathname += 'index.html';
    if (url.href === new URL('offline-cache.json', scope).href) {
      event.respondWith(
        Promise.resolve(
          new Response(JSON.stringify(CONFIG), { headers: { 'Content-Type': 'application/json' } }),
        ),
      );
      return;
    }
    const optional = officialFiles.get(url.href);
    if (optional) {
      event.respondWith(
        (async () => {
          // The downloader has already found a missing or corrupt file. Serving
          // a same-sized damaged cache entry again would make repair impossible.
          // Only its explicit request bypasses local bytes; verification and
          // the durable replacement remain the downloader's responsibility.
          if (CONFIG.packageConsent && event.request.cache === 'no-store')
            return fetch(event.request);
          // Prepared bytes are an optimization, never permission to play.
          // A normal request may load online without saving an offline package.
          try {
            const cache = await caches.open('revealline-official-content-v1');
            const hit = await cache.match(officialKey(optional.sha256));
            if (
              hit &&
              hit.status === 200 &&
              Number(hit.headers.get('Content-Length')) === optional.bytes
            )
              return requestedRange(hit, event.request);
          } catch {
            // Private browsing or unavailable storage must not prevent online play.
          }
          return fetch(event.request);
        })(),
      );
      return;
    }
    if (omittedSourceOriginals.has(url.href)) {
      event.respondWith(Promise.resolve(new Response(null, { status: 404 })));
      return;
    }
    const file = files.get(url.href);
    if (!file) return;
    event.respondWith(
      (async () => {
        let cache;
        try {
          cache = await caches.open(cacheName);
          if (event.request.mode === 'navigate' && (await startupMissing(cache, url.href)))
            return recoveryDocument(event.request);
          const hit = await cache.match(url.href);
          if (hit) return requestedRange(hit, event.request);
        } catch {
          // The network remains usable when local storage is denied.
        }
        try {
          const owned = await downloadVerified(url.href, file);
          await cache?.put(url.href, ownedResponse(owned)).catch(() => {});
          return requestedRange(ownedResponse(owned), event.request);
        } catch {
          if (event.request.mode === 'navigate' && file.path.endsWith('.html'))
            return recoveryDocument(event.request);
          return new Response(
            'This file is unavailable. Reconnect to play, or choose a chapter already downloaded for offline play.',
            { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
          );
        }
      })(),
    );
  });
  self.addEventListener('message', (event) => {
    if (event.data?.type === 'revealline.offline-pause') {
      if (event.data.buildId === CONFIG.buildId && authorizedSource(event))
        durableController?.abort();
      return;
    }
    if (
      !['revealline.offline-check', 'revealline.offline-prepare'].includes(event.data?.type) ||
      !event.ports?.[0]
    )
      return;
    if (!authorizedSource(event)) return;
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
