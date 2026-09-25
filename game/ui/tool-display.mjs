import { t, localizedText } from '../i18n/index.mjs';
import { createDisplayPreferences } from '../display-preferences.mjs';
import { applyFieldKitCopy, fieldKitCopy } from './field-kit-copy.mjs';

/** Adopt shared reading policy without operating the hosted tool or child game.
 * Only explicitly marked controls may persist a user-requested preference. */
export function mountToolDisplay({
  document: doc = globalThis.document,
  window: host = doc?.defaultView ?? globalThis,
  getStorage = () => host.localStorage,
} = {}) {
  if (!doc?.body) throw new Error(t('interface:theDisplayHostNeedsADocumentBody'));
  applyFieldKitCopy(doc);
  const controls = [...doc.querySelectorAll('[data-tool-text-size]')];
  const notice = doc.getElementById('host-display-notice');
  const ordinaryNotice = fieldKitCopy(
    'display.sharedToolNotice',
    doc.documentElement?.lang || 'en',
  );
  // This live notice has one owner. Later cosmetic copy mounting must not erase
  // a failed-save message from an early interaction.
  if (notice) localizedText(notice, () => ordinaryNotice);
  let disposed = false,
    restoreTimer = null;
  const defer = host.setTimeout?.bind(host) ?? globalThis.setTimeout;
  const cancelDeferred = host.clearTimeout?.bind(host) ?? globalThis.clearTimeout;
  const preferences = createDisplayPreferences({
    window: host,
    getStorage,
    onWarning(message) {
      if (!disposed && notice) localizedText(notice, () => message || ordinaryNotice);
    },
  });
  const render = (state) => {
    if (disposed) return;
    doc.body.dataset.textFace = state.textFace;
    doc.body.dataset.textSize = state.textSize;
    doc.body.dataset.effects = state.effectiveReducedEffects ? 'reduced' : 'full';
    for (const control of controls) control.value = state.textSize;
  };
  const stopView = preferences.subscribe(render);
  const cancelRestore = () => {
    if (restoreTimer !== null) cancelDeferred(restoreTimer);
    restoreTimer = null;
  };
  const pageshow = () => {
    if (disposed) return;
    render(preferences.snapshot());
    cancelRestore();
    // History may restore old form values after pageshow. Read current owner
    // intent again in the next task; never adopt or save those browser values.
    restoreTimer = defer(() => {
      restoreTimer = null;
      if (!disposed) render(preferences.snapshot());
    }, 0);
  };
  const changed = (event) => {
    if (disposed) return;
    preferences.set({ textSize: event.currentTarget.value === 'large' ? 'large' : 'standard' });
  };
  for (const control of controls) control.addEventListener('change', changed);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelRestore();
    for (const control of controls) control.removeEventListener('change', changed);
    stopView();
    preferences.dispose();
    host.removeEventListener?.('pagehide', pagehide);
    host.removeEventListener?.('pageshow', pageshow);
  };
  const pagehide = (event) => {
    cancelRestore();
    if (!event.persisted) dispose();
  };
  host.addEventListener?.('pagehide', pagehide);
  host.addEventListener?.('pageshow', pageshow);
  return Object.freeze({ dispose });
}
