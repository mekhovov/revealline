import { createDisplayPreferences } from '../../game/display-preferences.mjs';

/** Read-only host adoption for supporting tools. The owner can style this
 * document, but cannot operate its panels, media, embedded games or drafts. */
export function mountHostDisplay({
  document: doc = globalThis.document,
  window: host = doc?.defaultView ?? globalThis,
  getStorage = () => host.localStorage,
} = {}) {
  if (!doc?.body) throw new Error('The display host needs a document body.');
  let disposed = false;
  const preferences = createDisplayPreferences({ window: host, getStorage });
  const stopView = preferences.subscribe((state) => {
    if (disposed) return;
    doc.body.dataset.textFace = state.textFace;
    doc.body.dataset.textSize = state.textSize;
    doc.body.dataset.effects = state.effectiveReducedEffects ? 'reduced' : 'full';
  });
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    stopView();
    preferences.dispose();
    host.removeEventListener?.('pagehide', pagehide);
  };
  const pagehide = (event) => {
    if (!event.persisted) dispose();
  };
  host.addEventListener?.('pagehide', pagehide);
  return Object.freeze({ dispose });
}
