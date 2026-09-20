/** Fetch is bounded even when a host ignores cancellation. No storage or draft
 * mutations occur here; the caller must still check its request identity. */
export async function loadPreviewTheme({
  fetchTheme = (signal) => fetch('../content/themes.json', { signal }),
  signal,
  timeoutMs = 20000,
} = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 20000)
    throw new Error('Invalid preview timeout.');
  const controller = new AbortController();
  let timer, cancel;
  const stopped = new Promise((_, reject) => {
    cancel = () => {
      controller.abort();
      reject(new DOMException('Preview was closed or replaced.', 'AbortError'));
    };
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new Error('Preview theme did not load in time. Close and retry; your draft is intact.'),
      );
    }, timeoutMs);
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
  });
  try {
    return await Promise.race([
      stopped,
      Promise.resolve().then(async () => {
        if (controller.signal.aborted) throw new DOMException('Preview cancelled.', 'AbortError');
        const response = await fetchTheme(controller.signal);
        if (!response.ok)
          throw new Error('Preview theme failed to load. Your draft remains unchanged.');
        const body = await response.json();
        const theme = body?.themes?.find((candidate) => candidate.id === 'retro');
        if (!theme) throw new Error('Preview theme is unavailable.');
        return theme;
      }),
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
