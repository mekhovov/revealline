/** Serialized by the optional builder. Keep the body self-contained. */
export function installPracticeWorker(scope, pins, revision) {
  const sha = async (bytes) =>
    [...new Uint8Array(await scope.crypto.subtle.digest('SHA-256', bytes))]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
  async function read(url, limit, signal, progress, options = {}) {
    const response = await scope.fetch(url, { cache: 'no-store', signal, ...options }),
      reader = response.body?.getReader();
    try {
      if (!response.ok || response.redirected || !reader)
        throw new Error('Optional package dependency unavailable');
      const advertised = response.headers.get('content-length');
      if (
        options.credentials &&
        advertised &&
        (!Number.isSafeInteger(+advertised) || +advertised < 0 || +advertised > limit)
      )
        throw new Error('Optional package dependency too large');
      const bytes = new Uint8Array(limit);
      let length = 0;
      for (;;) {
        signal.throwIfAborted();
        const chunk = await reader.read();
        if (chunk.done) break;
        if (length + chunk.value.byteLength > limit)
          throw new Error('Optional package dependency too large');
        bytes.set(chunk.value, length);
        length += chunk.value.byteLength;
        progress(chunk.value.byteLength);
      }
      return { bytes: bytes.subarray(0, length), headers: response.headers };
    } finally {
      if (reader) await reader.cancel().catch(() => {});
    }
  }
  // Explicit data requests reuse the verified generated file without registering
  // a service worker or downloading the runtime. One dedicated owner per request.
  if (!scope.registration) {
    let controller;
    scope.addEventListener('message', ({ data }) => {
      if (data?.type === 'world-cancel') return controller?.abort();
      if (controller) return;
      controller = new AbortController();
      void (async () => {
        try {
          const { url, bytes: limit, sha256 } = data ?? {},
            index =
              url ===
              'https://raw.githubusercontent.com/mekhovov/revealline/main/authoring/fpv-worlds/published/index.json';
          if (
            data?.type !== 'world-read' ||
            (index
              ? limit !== 8192 || sha256 !== undefined
              : !Number.isSafeInteger(limit) ||
                limit <= 0 ||
                limit > 67108864 ||
                typeof sha256 !== 'string' ||
                !/^[a-f0-9]{64}$/.test(sha256) ||
                typeof url !== 'string' ||
                !/^https:\/\/raw\.githubusercontent\.com\/mekhovov\/revealline\/[a-f0-9]{40}\/authoring\/fpv-worlds\/(?:[a-z0-9_-]+\/)+[a-z0-9_-]+(?:\.[a-z0-9_-]+)*\.rlpack$/.test(
                  url,
                ))
          )
            throw new Error('Invalid world request');
          let loaded = 0;
          const { bytes } = await read(
            url,
            limit,
            controller.signal,
            (count) => {
              loaded += count;
              scope.postMessage({ type: 'world-progress', bytes: loaded });
            },
            { credentials: 'omit', redirect: 'error' },
          );
          if (!index && (bytes.length !== limit || (await sha(bytes)) !== sha256))
            throw new Error('World content mismatch');
          controller.signal.throwIfAborted();
          scope.postMessage({ type: 'world-done', bytes }, [bytes.buffer]);
        } catch {
          scope.postMessage({ type: 'world-error' });
        }
      })();
    });
    return;
  }
  const base = scope.registration.scope;
  const owner = `revealline.optional.package.v1:${new URL(base).pathname}:`;
  const cacheName = owner + revision;
  const urls = new Map(pins.map((pin) => [new URL(pin.path, base).href, pin]));
  const total = pins.reduce((sum, pin) => sum + pin.bytes, 0);
  const ports = new Set();
  let controller,
    idleTimer,
    downloaded = 0,
    phase = 'available';
  const announce = () => {
    for (const port of ports) {
      try {
        port.postMessage({ type: 'practice-progress', phase, downloaded, total });
      } catch {
        ports.delete(port);
      }
    }
  };
  const activity = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller?.abort(), 30000);
  };
  scope.addEventListener('message', (event) => {
    if (event.source?.url && new URL(event.source.url).origin !== new URL(base).origin) return;
    if (event.data?.type === 'practice-cancel') {
      const launcherRoot = new URL(base).pathname.match(
        /^(.*\/practice\/[a-z0-9-]+\/)releases\//,
      )?.[1];
      const sourcePath = event.source?.url ? new URL(event.source.url).pathname : '';
      if (
        !event.source?.url ||
        event.source.url.startsWith(base) ||
        (launcherRoot &&
          [launcherRoot + 'app/', launcherRoot + 'app/index.html'].includes(sourcePath))
      )
        controller?.abort();
      return;
    }
    const port = event.ports?.[0];
    if (!port) return;
    if (event.data?.type === 'practice-progress') {
      ports.add(port);
      announce();
      return;
    }
    if (event.data?.type !== 'practice-status') return;
    const check = (async () => {
      let ready = false;
      try {
        if ((await scope.caches.keys()).includes(cacheName)) {
          const cache = await scope.caches.open(cacheName);
          ready = true;
          for (const [url, pin] of urls) {
            const response = await cache.match(url);
            if (!response) {
              ready = false;
              break;
            }
            const bytes = await response.arrayBuffer();
            if (bytes.byteLength !== pin.bytes || (await sha(bytes)) !== pin.sha256) {
              ready = false;
              break;
            }
          }
        }
      } catch {
        ready = false;
      }
      port.postMessage({ type: 'practice-status', ready, revision, total, scope: base });
    })();
    event.waitUntil?.(check);
  });
  scope.addEventListener('install', (event) =>
    event.waitUntil(
      (async () => {
        const existed = (await scope.caches.keys()).includes(cacheName);
        controller = new AbortController();
        const overall = setTimeout(() => controller.abort(), 300000);
        activity();
        phase = 'downloading';
        announce();
        try {
          const cache = await scope.caches.open(cacheName);
          for (const [url, pin] of urls) {
            const { bytes, headers } = await read(url, pin.bytes, controller.signal, (count) => {
              activity();
              downloaded += count;
              announce();
            });
            phase = 'verifying';
            announce();
            if (bytes.length !== pin.bytes || (await sha(bytes)) !== pin.sha256)
              throw new Error('Optional package dependency mismatch');
            if (controller.signal.aborted) throw new Error('Optional download cancelled');
            await cache.put(url, new Response(bytes, { status: 200, headers }));
            activity();
            phase = 'downloading';
          }
          phase = 'ready';
          announce();
          // Immutable release scopes activate naturally. Mutable launcher updates
          // wait for closed tabs, never replacing a worker under an active flight.
        } catch (error) {
          if (!existed) await scope.caches.delete(cacheName);
          phase = 'failed';
          announce();
          throw error;
        } finally {
          clearTimeout(overall);
          clearTimeout(idleTimer);
          controller = null;
        }
      })(),
    ),
  );
  scope.addEventListener('activate', (event) =>
    event.waitUntil(
      (async () => {
        const older = (await scope.caches.keys()).filter(
          (name) => name.startsWith(owner) && name !== cacheName,
        );
        for (const name of older.slice(0, -1)) await scope.caches.delete(name);
      })(),
    ),
  );
  scope.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const documentURL = new URL(url);
    documentURL.search = '';
    documentURL.hash = '';
    if (
      event.request.mode === 'navigate' &&
      (urls.has(documentURL.href) || documentURL.href === base)
    ) {
      url.search = '';
      url.hash = '';
    }
    if (url.href === base) url.pathname += 'index.html';
    if (event.request.method === 'GET' && urls.has(url.href))
      event.respondWith(
        (async () =>
          (await (await scope.caches.open(cacheName)).match(url.href)) ||
          scope.fetch(event.request))(),
      );
  });
}
