import { createDisplayPreferences } from '../../game/display-preferences.mjs';
import { applyFieldKitCopy, fieldKitCopy } from '../../game/ui/field-kit-copy.mjs';

const hosts = new WeakMap();

// Independent entry and application share this page-owned authority. No lab
// profile, renderer, preview selection or animation clock belongs to this owner.
export function getMotionDisplay(
  doc = globalThis.document,
  host = doc?.defaultView ?? globalThis.window,
) {
  if (hosts.has(doc)) return hosts.get(doc);
  applyFieldKitCopy(doc);
  const control = doc.querySelector('[data-motion-text-size]');
  const notice = doc.getElementById('motion-display-notice');
  const ordinaryNotice = fieldKitCopy('motion.sharedReading', doc.documentElement?.lang);
  let disposed = false,
    away = false,
    restoreTimer = null,
    restoreGeneration = 0;
  const defer = host.setTimeout?.bind(host) ?? globalThis.setTimeout;
  const cancelDeferred = host.clearTimeout?.bind(host) ?? globalThis.clearTimeout;
  let interrupted = doc.hidden === true || doc.hasFocus?.() === false;
  // The application graph can still be pending when this page is interrupted.
  // Remember that boundary here; restoring the page never grants Play intent.
  const blur = () => {
    if (!disposed) interrupted = true;
  };
  const visibility = () => {
    if (doc.hidden) blur();
  };
  const cancelRestore = () => {
    restoreGeneration++;
    if (restoreTimer !== null) cancelDeferred(restoreTimer);
    restoreTimer = null;
  };
  const pageshow = () => {
    if (disposed) return;
    away = false;
    render(preferences.snapshot());
    cancelRestore();
    const ticket = restoreGeneration;
    // Browser history can restore form values after pageshow. Reconcile from
    // current authority in the next task; restored values are never user intent.
    restoreTimer = defer(() => {
      if (disposed || away || ticket !== restoreGeneration) return;
      restoreTimer = null;
      render(preferences.snapshot());
    }, 0);
  };
  if (notice) notice.textContent = ordinaryNotice;
  const preferences = createDisplayPreferences({
    window: host,
    getStorage: () => host.localStorage,
    onWarning(message) {
      if (!disposed && notice) notice.textContent = message || ordinaryNotice;
    },
  });
  const render = (value) => {
    if (disposed) return;
    doc.body.dataset.textFace = value.textFace;
    doc.body.dataset.textSize = value.textSize;
    doc.body.dataset.effects = value.effectiveReducedEffects ? 'reduced' : 'full';
    if (control) control.value = value.textSize;
  };
  const stopView = preferences.subscribe(render);
  const change = () => {
    if (!disposed) preferences.set({ textSize: control.value === 'large' ? 'large' : 'standard' });
  };
  control?.addEventListener('change', change);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelRestore();
    control?.removeEventListener('change', change);
    host.removeEventListener?.('pagehide', pagehide);
    host.removeEventListener?.('pageshow', pageshow);
    host.removeEventListener?.('blur', blur);
    doc.removeEventListener?.('visibilitychange', visibility);
    stopView();
    preferences.dispose();
  };
  const pagehide = (event) => {
    if (disposed) return;
    interrupted = true;
    away = true;
    cancelRestore();
    if (!event.persisted) dispose();
  };
  host.addEventListener?.('pagehide', pagehide);
  host.addEventListener?.('pageshow', pageshow);
  host.addEventListener?.('blur', blur);
  doc.addEventListener?.('visibilitychange', visibility);
  const api = Object.freeze({
    snapshot: preferences.snapshot,
    subscribe: preferences.subscribe,
    get disposed() {
      return disposed;
    },
    get interrupted() {
      return interrupted;
    },
    get away() {
      return away;
    },
    dispose,
  });
  hosts.set(doc, api);
  return api;
}
