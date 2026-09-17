import { createDisplayPreferences } from '../display-preferences.mjs';
import { applyFieldKitCopy, fieldKitCopy } from './field-kit-copy.mjs';

/** Adopt shared reading policy without operating the hosted tool or child game.
 * Only explicitly marked controls may persist a user-requested preference. */
export function mountToolDisplay({
  document: doc = globalThis.document,
  window: host = doc?.defaultView ?? globalThis,
  getStorage = () => host.localStorage,
} = {}) {
  if (!doc?.body) throw new Error('The display host needs a document body.');
  applyFieldKitCopy(doc);
  const controls = [...doc.querySelectorAll('[data-tool-text-size]')];
  const notice = doc.getElementById('host-display-notice');
  const ordinaryNotice = fieldKitCopy(
    'display.sharedToolNotice',
    doc.documentElement?.lang || 'en',
  );
  // This live notice has one owner. Later cosmetic copy mounting must not erase
  // a failed-save message from an early interaction.
  if (notice) notice.textContent = ordinaryNotice;
  let disposed = false;
  const preferences = createDisplayPreferences({
    window: host,
    getStorage,
    onWarning(message) {
      if (!disposed && notice) notice.textContent = message || ordinaryNotice;
    },
  });
  const stopView = preferences.subscribe((state) => {
    if (disposed) return;
    doc.body.dataset.textFace = state.textFace;
    doc.body.dataset.textSize = state.textSize;
    doc.body.dataset.effects = state.effectiveReducedEffects ? 'reduced' : 'full';
    for (const control of controls) control.value = state.textSize;
  });
  const changed = (event) => {
    if (disposed) return;
    preferences.set({ textSize: event.currentTarget.value === 'large' ? 'large' : 'standard' });
  };
  for (const control of controls) control.addEventListener('change', changed);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const control of controls) control.removeEventListener('change', changed);
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
