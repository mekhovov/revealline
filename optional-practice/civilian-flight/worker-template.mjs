/** Serialized by the optional builder. Keep the body self-contained. */
export function installPracticeWorker(scope, pins, revision) {
  const base = scope.registration.scope;
  const owner = `revealline.optional.civilian-flight.v1:${new URL(base).pathname}:`;
  const cacheName = owner + revision;
  const urls = new Map(pins.map((pin) => [new URL(pin.path, base).href, pin]));
  const total = pins.reduce((sum, pin) => sum + pin.bytes, 0);
  const ports = new Set();
  let controller,
    idleTimer,
    downloaded = 0,
    phase = 'available',
    cancelled = false;
  const sha = async (bytes) =>
    [...new Uint8Array(await scope.crypto.subtle.digest('SHA-256', bytes))]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
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
      ) {
        cancelled = true;
        controller?.abort();
      }
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
        if (urls.size > 0 && (await scope.caches.keys()).includes(cacheName)) {
          ready = true;
          for (const [url, pin] of urls) {
            const response = await scope.caches.match(url, { cacheName });
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
        if (cancelled) controller.abort();
        const overall = setTimeout(() => controller.abort(), 300000);
        activity();
        phase = 'downloading';
        announce();
        try {
          if (controller.signal.aborted) throw new Error('Optional download cancelled');
          const cache = await scope.caches.open(cacheName);
          for (const [url, pin] of urls) {
            if (controller.signal.aborted) throw new Error('Optional download cancelled');
            const response = await scope.fetch(url, {
              cache: 'no-store',
              signal: controller.signal,
            });
            if (!response.ok || response.redirected)
              throw new Error('Optional package dependency unavailable');
            const reader = response.body?.getReader();
            if (!reader) throw new Error('Bounded optional download unavailable');
            const chunks = [];
            let length = 0;
            try {
              for (;;) {
                if (controller.signal.aborted) throw new Error('Optional download cancelled');
                const chunk = await reader.read();
                if (chunk.done) break;
                activity();
                length += chunk.value.byteLength;
                if (length > pin.bytes) throw new Error('Optional package dependency too large');
                downloaded += chunk.value.byteLength;
                chunks.push(chunk.value);
                announce();
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
            phase = 'verifying';
            announce();
            if (length !== pin.bytes || (await sha(bytes)) !== pin.sha256)
              throw new Error('Optional package dependency mismatch');
            if (controller.signal.aborted) throw new Error('Optional download cancelled');
            await cache.put(url, new Response(bytes, { status: 200, headers: response.headers }));
            if (controller.signal.aborted) throw new Error('Optional download cancelled');
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
          (await scope.caches.match(url.href, { cacheName })) || scope.fetch(event.request))(),
      );
  });
}
