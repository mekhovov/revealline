const FONT_PATHS = new Set([
  '/game/ui/fonts/departure-mono/DepartureMono-Regular.woff2',
  '/game/ui/fonts/field-kit/handjet-display-600.woff2',
  '/game/ui/fonts/field-kit/exo2-ui-400-600.woff2',
  '/game/ui/fonts/field-kit/ibm-plex-mono-500.woff2',
]);

/** Test clients only. Never changes requests from the real game/tool routes. */
export function fontResponseMode(clientURL, requestURL, scopeURL) {
  const client = new URL(clientURL),
    request = new URL(requestURL),
    scope = new URL(scopeURL);
  if (
    client.origin !== scope.origin ||
    request.origin !== scope.origin ||
    !client.pathname.startsWith(scope.pathname) ||
    !FONT_PATHS.has(request.pathname)
  )
    return 'normal';
  const mode = client.searchParams.get('fonts');
  return ['delayed', 'blocked'].includes(mode) ? mode : 'normal';
}

if (globalThis.clients) {
  const worker = globalThis;
  worker.addEventListener('install', (event) => event.waitUntil(worker.skipWaiting()));
  worker.addEventListener('activate', (event) => event.waitUntil(worker.clients.claim()));
  worker.addEventListener('fetch', (event) => {
    if (!FONT_PATHS.has(new URL(event.request.url).pathname)) return;
    event.respondWith(
      (async () => {
        const client = await worker.clients.get(event.clientId);
        const mode = client
          ? fontResponseMode(client.url, event.request.url, worker.registration.scope)
          : 'normal';
        if (mode !== 'normal')
          client.postMessage({
            type: 'fixture-font-response',
            mode,
            path: new URL(event.request.url).pathname,
          });
        if (mode === 'blocked')
          return new Response('Intentional fixture-only font failure', { status: 503 });
        if (mode === 'delayed') await new Promise((resolve) => setTimeout(resolve, 6000));
        return fetch(event.request);
      })(),
    );
  });
}
