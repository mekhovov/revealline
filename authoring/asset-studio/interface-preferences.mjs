import { t, localizedText, localizedMessage } from '../../game/i18n/index.mjs';
import { createDisplayPreferences } from '../../game/display-preferences.mjs';

/** One page-owned view of the shared policy. This module cannot refresh a
 * workspace, write a theme revision, replace media or modify Solo progress. */
export function mountInterfacePreferences({
  document: doc = globalThis.document,
  window: host = globalThis,
  getStorage = () => globalThis.localStorage,
} = {}) {
  const control = (id) => {
    const element = doc.getElementById(id);
    if (!element) throw new Error(`Studio Interface control is unavailable: ${id}`);
    return element;
  };
  const font = control('studio-interface-font'),
    size = control('studio-interface-size'),
    reduced = control('studio-interface-reduced'),
    cap = control('studio-interface-cap'),
    notice = control('studio-interface-status');
  let disposed = false;
  const warning = (message, key) => {
    if (disposed) return;
    localizedText(notice, () => (key ? t(key) : message));
    notice.hidden = !message;
  };
  const preferences = createDisplayPreferences({
    window: host,
    getStorage,
    onWarning: warning,
  });
  const render = (state) => {
    if (disposed) return;
    doc.body.dataset.textFace = state.textFace;
    doc.body.dataset.textSize = state.textSize;
    doc.body.dataset.effects = state.effectiveReducedEffects ? 'reduced' : 'full';
    font.value = state.textFace;
    size.value = state.textSize;
    reduced.checked = state.reducedEffects;
    const systemCap = state.effectiveReducedEffects && !state.reducedEffects;
    localizedText(cap, () =>
      systemCap ? t('tools:yourSystemRequestsReducedMotionPreviewEffectsRemainReduced') : '',
    );
    cap.hidden = !systemCap;
  };
  const stopView = preferences.subscribe(render);
  warning(preferences.getWarning(), preferences.getWarningKey());
  const change = (patch) => {
    if (disposed) return;
    try {
      preferences.set(patch);
    } catch (error) {
      render(preferences.snapshot());
      warning(
        localizedMessage('common:preferences.applyFailed', {
          error: error.message || String(error),
        }),
      );
    }
  };
  const bindings = [
    [font, () => change({ textFace: font.value })],
    [size, () => change({ textSize: size.value })],
    [reduced, () => change({ reducedEffects: reduced.checked })],
  ];
  for (const [element, listener] of bindings) element.addEventListener('change', listener);
  return Object.freeze({
    motion: Object.freeze({
      snapshot: () => preferences.snapshot(),
      subscribe: (listener) => preferences.subscribe(listener),
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const [element, listener] of bindings) element.removeEventListener('change', listener);
      stopView();
      preferences.dispose();
    },
  });
}
