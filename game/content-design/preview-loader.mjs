import {
  journeyActorThemeMaterial,
  createJourneyActorTheme,
} from '../presentation/journey-actor-materials.mjs';

/** Fetch is bounded even when a host ignores cancellation. No storage or draft
 * mutations occur here; the caller must still check its request identity. */
export async function loadPreviewTheme({
  themeId = 'horizon',
  fetchTheme = (signal) => fetch(new URL('./themes.json', import.meta.url), { signal }),
  signal,
  timeoutMs = 20000,
} = {}) {
  if (typeof themeId !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,79}$/.test(themeId))
    throw new Error('Invalid preview theme ID.');
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
        let theme = body?.themes?.find((candidate) => candidate.id === themeId);
        const material = journeyActorThemeMaterial(themeId);
        if (!theme && material) {
          const base = body?.themes?.find((candidate) => candidate.id === material.sourceThemeId);
          if (base) theme = createJourneyActorTheme(base);
        }
        if (!theme) throw new Error('Preview theme is unavailable.');
        return theme;
      }),
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
