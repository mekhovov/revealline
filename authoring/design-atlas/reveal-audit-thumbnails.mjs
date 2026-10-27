import { loadProductionImage } from '../production/preview.mjs';
import { localizedText, t } from '../../game/i18n/index.mjs';

/** Lazy, sequential thumbnail loads share the exact source viewer admission path.
 * The gallery owns each decoded image until replacement or final page departure. */
export function mountRevealAuditThumbnails({
  entries,
  rootURL,
  document: doc,
  window: win,
  loadImage = loadProductionImage,
}) {
  const pending = new Set(),
    ready = new Map(),
    byBox = new Map(entries.map((entry) => [entry.box, entry]));
  let disposed = false,
    paused = doc.hidden,
    active = null;
  const observer =
    typeof win.IntersectionObserver === 'function'
      ? new win.IntersectionObserver(
          (changes) => {
            for (const change of changes)
              if (change.isIntersecting) {
                const entry = byBox.get(change.target);
                if (entry && !ready.has(entry)) pending.add(entry);
                observer.unobserve(change.target);
              }
            void pump();
          },
          { rootMargin: '300px' },
        )
      : null;
  async function pump() {
    if (disposed || paused || active || !pending.size) return;
    const entry = pending.values().next().value,
      operation = { controller: new AbortController() };
    active = operation;
    let image = null;
    try {
      image = await loadImage(entry.source, {
        rootURL,
        signal: operation.controller.signal,
        fetchSource: (url, options) => win.fetch(url, options),
        cryptoSource: win.crypto,
        urlAPI: win.URL,
        makeImage: () => doc.createElement('img'),
      });
      if (disposed || paused || operation.controller.signal.aborted) {
        image.dispose();
        return;
      }
      image.image.alt = entry.alt;
      image.image.width = entry.source.width;
      image.image.height = entry.source.height;
      entry.box.replaceChildren(image.image);
      ready.set(entry, image);
      pending.delete(entry);
    } catch {
      image?.dispose();
      if (!disposed && !operation.controller.signal.aborted) {
        const message = doc.createElement('p');
        localizedText(message, () =>
          t('tools:originalUnavailableHereOpenThisAtlasFromItsSourceCheckout'),
        );
        entry.box.replaceChildren(message);
        pending.delete(entry);
      }
    } finally {
      if (active === operation) active = null;
      void pump();
    }
  }
  function pause() {
    paused = true;
    active?.controller.abort();
  }
  function resume() {
    if (disposed || doc.hidden) return;
    paused = false;
    void pump();
  }
  const visibility = () => (doc.hidden ? pause() : resume());
  const pagehide = (event) => (event.persisted ? pause() : dispose());
  function dispose() {
    if (disposed) return;
    disposed = true;
    pause();
    observer?.disconnect();
    pending.clear();
    byBox.clear();
    for (const image of ready.values()) image.dispose();
    ready.clear();
    doc.removeEventListener('visibilitychange', visibility);
    win.removeEventListener('pagehide', pagehide);
    win.removeEventListener('pageshow', resume);
  }
  doc.addEventListener('visibilitychange', visibility);
  win.addEventListener('pagehide', pagehide);
  win.addEventListener('pageshow', resume);
  for (const entry of entries) {
    if (observer) observer.observe(entry.box);
    else pending.add(entry);
  }
  void pump();
  return Object.freeze({ dispose });
}
