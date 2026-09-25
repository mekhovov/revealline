import { localizedText } from '../../game/i18n/index.mjs';
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
    revealingResize = false,
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
  const revealResizedControl = (event) => {
    if (revealingResize || event.target !== host) return;
    revealingResize = true;
    try {
      const focused = doc.activeElement,
        workspace = doc.querySelector('.workspace');
      const foreground = () => !disposed && !away && !doc.hidden && doc.hasFocus?.() !== false;
      const current = () => {
        if (
          !foreground() ||
          doc.activeElement !== focused ||
          !workspace?.isConnected ||
          !workspace.contains(focused) ||
          !focused?.matches('input,select,button,a[href]') ||
          focused.disabled ||
          !focused.getClientRects().length
        )
          return false;
        for (let node = focused; node; node = node.parentElement) {
          if (
            node.hidden ||
            node.inert ||
            node.hasAttribute('inert') ||
            node.getAttribute('aria-hidden') === 'true' ||
            (node.tagName === 'FIELDSET' && node.disabled) ||
            host.getComputedStyle?.(node)?.visibility === 'hidden'
          )
            return false;
        }
        return true;
      };
      if (!current()) return;
      const width = doc.documentElement.clientWidth || host.innerWidth,
        height = doc.documentElement.clientHeight || host.innerHeight;
      if (![width, height].every(Number.isFinite) || width <= 0 || height <= 0) return;
      const bounds = { left: 0, top: 0, right: width, bottom: height };
      let availableWidth = width,
        availableHeight = height;
      const controls = focused.closest('.controls'),
        style = controls && host.getComputedStyle?.(controls);
      if (controls && /auto|scroll|hidden|clip/.test(style?.overflowY || '')) {
        const rect = controls.getBoundingClientRect();
        bounds.top = Math.max(bounds.top, rect.top);
        bounds.bottom = Math.min(bounds.bottom, rect.bottom);
        availableHeight = Math.min(height, rect.height);
      }
      if (controls && /auto|scroll|hidden|clip/.test(style?.overflowX || '')) {
        const rect = controls.getBoundingClientRect();
        bounds.left = Math.max(bounds.left, rect.left);
        bounds.right = Math.min(bounds.right, rect.right);
        availableWidth = Math.min(width, rect.width);
      }
      if (![...Object.values(bounds), availableWidth, availableHeight].every(Number.isFinite))
        return;
      if (availableWidth <= 0 || availableHeight <= 0) return;
      // An entirely offscreen scrollport has an empty intersection. Native
      // nearest scrolling must still reveal both the panel and its control.
      // Reveal the slider's label and value together when they fit. A taller
      // field falls back to its focused control rather than hiding that control.
      let target = focused.closest('.range-field,.segmented label,.field') || focused,
        rect = target.getBoundingClientRect();
      if (rect.height > availableHeight || rect.width > availableWidth) {
        target = focused;
        rect = focused.getBoundingClientRect();
      }
      if (
        ![rect.left, rect.top, rect.right, rect.bottom, rect.width, rect.height].every(
          Number.isFinite,
        )
      )
        return;
      if (rect.width <= 0 || rect.height <= 0) return;
      if (
        (rect.left < bounds.left ||
          rect.top < bounds.top ||
          rect.right > bounds.right ||
          rect.bottom > bounds.bottom) &&
        current() &&
        foreground() &&
        doc.activeElement === focused &&
        target.isConnected &&
        target.contains(focused) &&
        workspace.contains(target)
      )
        target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    } finally {
      revealingResize = false;
    }
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
  if (notice) localizedText(notice, () =>ordinaryNotice);
  const preferences = createDisplayPreferences({
    window: host,
    getStorage: () => host.localStorage,
    onWarning(message) {
      if (!disposed && notice) localizedText(notice, () =>message || ordinaryNotice);
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
    host.removeEventListener?.('resize', revealResizedControl);
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
  host.addEventListener?.('resize', revealResizedControl);
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
