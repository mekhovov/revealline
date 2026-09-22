import { createDisplayPreferences } from '../display-preferences.mjs';
import { attachPreferenceRestoration } from '../ui/preference-restoration.mjs';

/** The theater's interface follows the shared display policy. This owner has
 * no access to recordings, playback, themes, imports or player progress. */
export function mountReplayDisplay({
  document: doc = globalThis.document,
  window: host = doc?.defaultView ?? globalThis,
  getStorage = () => host.localStorage,
} = {}) {
  const control = (id) => {
    const element = doc.getElementById(id);
    if (!element) throw new Error(`Replay display control is unavailable: ${id}`);
    return element;
  };
  const font = control('replay-text-face'),
    size = control('replay-text-size'),
    reduced = control('reduced'),
    cap = control('replay-system-reduction'),
    notice = control('replay-display-status');
  let disposed = false;
  const warning = (message) => {
    if (disposed) return;
    notice.textContent = message;
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
    cap.textContent = systemCap
      ? 'Your system requests reduced motion. Replay effects remain reduced; your saved choice is unchanged.'
      : '';
    cap.hidden = !systemCap;
  };
  const stopView = preferences.subscribe(render);
  const restoration = attachPreferenceRestoration({
    window: host,
    getSnapshot: preferences.snapshot,
    render,
  });
  warning(preferences.getWarning());
  const change = (patch) => {
    if (disposed) return;
    try {
      preferences.set(patch);
    } catch (error) {
      render(preferences.snapshot());
      warning(`The display preference could not be applied: ${error.message || error}`);
    }
  };
  const bindings = [
    [font, () => change({ textFace: font.value })],
    [size, () => change({ textSize: size.value })],
    [reduced, () => change({ reducedEffects: reduced.checked })],
  ];
  for (const [element, listener] of bindings) element.addEventListener('change', listener);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const [element, listener] of bindings) element.removeEventListener('change', listener);
    restoration.dispose();
    stopView();
    preferences.dispose();
    host.removeEventListener?.('pagehide', pagehide);
  };
  const pagehide = (event) => {
    if (!event.persisted) dispose();
  };
  host.addEventListener?.('pagehide', pagehide);
  for (const [element] of bindings) element.disabled = false;
  return Object.freeze({ snapshot: () => preferences.snapshot(), dispose });
}
