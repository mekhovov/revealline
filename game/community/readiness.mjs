import { localizedMessage, localizedText } from '../i18n/index.mjs';

/** Bound both the transport and response work; abort remains cooperative. */
export async function communityRequest(operation, { signal, timeoutMs = 4_000 } = {}) {
  const controller = new AbortController();
  let timer;
  let abort;
  const interrupted = new Promise((_, reject) => {
    abort = () => {
      controller.abort();
      reject(new Error('Community request was interrupted.'));
    };
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('The community service did not respond in time.'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      interrupted,
      Promise.resolve().then(() => {
        if (controller.signal.aborted) throw new Error('Community request was interrupted.');
        return operation(controller.signal);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export async function probeCommunityService({
  baseURL,
  fetchImpl = globalThis.fetch,
  signal,
  timeoutMs,
} = {}) {
  return communityRequest(
    async (requestSignal) => {
      const base = new URL(
        baseURL ?? '/community-api/',
        globalThis.location?.href ?? 'https://local/',
      );
      const response = await fetchImpl(new URL('ready', base), {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: requestSignal,
      });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json'))
        throw new Error('The community service is unavailable.');
      // The endpoint returns a tiny status object. Refuse HTML fallbacks and
      // oversized or streaming responses before buffering an unbounded body.
      const reader = response.body?.getReader();
      if (!reader) throw new Error('The community service returned no readiness status.');
      const chunks = [];
      let bytes = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > 4_096) throw new Error('The community readiness response is too large.');
          chunks.push(value);
        }
      } finally {
        void reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      const body = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const result = JSON.parse(new TextDecoder().decode(body));
      if (result?.status !== 'ready') throw new Error('The community service is not ready.');
      return true;
    },
    { signal, timeoutMs },
  );
}

/** Only gates service-dependent setup. Authentication and per-action busy
 * states remain owned by their existing account/publisher handlers. */
export function attachCommunityReadiness({
  document,
  probe,
  onReady = () => {},
  localCatalogAvailable = () => false,
}) {
  const $ = (id) => document.getElementById(id);
  let generation = 0;
  let controller = null;
  let state = 'checking';
  let returnFocus = null;
  const messages = {
    checking: 'interface:community.service.checking',
    ready: 'interface:community.service.ready',
    unavailable: 'interface:community.service.unavailable',
  };
  const render = () => {
    for (const id of ['service-catalog-fields', 'service-account-fields', 'service-publish-fields'])
      $(id).disabled =
        state !== 'ready' && !(id === 'service-catalog-fields' && localCatalogAvailable());
    $('service-retry').disabled = state === 'checking';
    $('service-status').dataset.state = state;
    localizedText($('service-status'), localizedMessage(messages[state]));
    if (state !== 'checking' && returnFocus) {
      if ([returnFocus, document.body, null].includes(document.activeElement))
        returnFocus.focus({ preventScroll: true });
      returnFocus = null;
    }
  };
  const cancel = () => {
    generation += 1;
    controller?.abort();
    controller = null;
  };
  const unavailable = () => {
    cancel();
    state = 'unavailable';
    render();
  };
  const check = async () => {
    returnFocus = document.activeElement === $('service-retry') ? $('service-retry') : null;
    cancel();
    const current = generation;
    controller = new AbortController();
    state = 'checking';
    render();
    try {
      await probe(controller.signal);
      if (current !== generation) return false;
      state = 'ready';
      render();
      await onReady();
      return state === 'ready';
    } catch {
      if (current !== generation) return false;
      state = 'unavailable';
      render();
      return false;
    }
  };
  $('service-retry').onclick = check;
  render();
  return Object.freeze({ check, cancel, unavailable, render, available: () => state === 'ready' });
}
