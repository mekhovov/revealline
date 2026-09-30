import { attachControllerNavigation } from './controller-navigation.mjs';
import { createControllerRouter } from './controller-router.mjs';
import { attachControllerConfirmGuard } from './controller-confirm-guard.mjs';
import { createControllerConfirmLifecycle } from './controller-confirm-lifecycle.mjs';

/** The frozen launcher uses the same input edges as the game, with no flight owner. */
export function attachLauncherNavigation({
  document: doc = globalThis.document,
  window: win = globalThis.window,
  readPads,
  now = () => win.performance?.now?.() ?? Date.now(),
} = {}) {
  let frame = null,
    disposed = false,
    suspended = false;
  const foreground = () => !disposed && !suspended && !doc.hidden && doc.hasFocus?.() !== false;
  const preferred = () =>
    ['play', 'prepare', 'updates', 'check']
      .map((id) => doc.getElementById(id))
      .find((element) => element && !element.hidden && !element.disabled);
  const router = createControllerRouter({ eventTarget: win, autoJoin: true, readPads, now });
  const guard = attachControllerConfirmGuard({
    document: doc,
    confirmPressed: () => foreground() && router.menuConfirmPressed(),
    beforeNativeActivation: (event) => lifecycle.beforeNativeActivation(event),
    now,
  });
  const navigation = attachControllerNavigation({
    document: doc,
    getRoot: () => (foreground() ? doc.body : null),
    getScope: () => 'launcher',
    getDefaultFocus: preferred,
    keyboard: true,
    ownsKeyboardEvent: () => !foreground(),
    onNativeInput: (event) => lifecycle.nativeInput(event),
    activateControl: (element) => guard.activate(element),
    onBack: () => preferred()?.focus(),
  });
  const lifecycle = createControllerConfirmLifecycle({
    document: doc,
    readConfirm: (options) => router.readMenuConfirm(options),
    getContext: () => ({
      scope: 'launcher',
      root: doc.body,
      focused: doc.activeElement,
      active: foreground(),
    }),
    navigation,
    guard,
    now,
  });
  const clear = () => {
    lifecycle.cancel('launcher-lifecycle', { hard: true });
    router.clear();
    navigation.clear();
  };
  const sample = (timeMs) => {
    frame = null;
    if (disposed || suspended) return;
    if (foreground()) {
      const state = router.sample({ scope: 'launcher', timeMs });
      if (state.status.code === 'joined') navigation.engage();
      lifecycle.sample(state.confirmSnapshot);
      // Native-event probes and the frame share one Confirm owner. Other
      // controller edges still reach the menu once through its usual handler.
      navigation.handle({
        ...state.ui,
        confirm: false,
        confirmStart: false,
        confirmCommit: false,
        confirmCancel: false,
      });
    } else clear();
    frame = win.requestAnimationFrame(sample);
  };
  const visibility = () => {
    if (doc.hidden) clear();
  };
  const pagehide = () => {
    suspended = true;
    win.cancelAnimationFrame(frame);
    frame = null;
    clear();
  };
  const pageshow = () => {
    if (disposed || !suspended) return;
    suspended = false;
    clear();
    frame = win.requestAnimationFrame(sample);
  };
  win.addEventListener('blur', clear);
  win.addEventListener('pagehide', pagehide);
  win.addEventListener('pageshow', pageshow);
  doc.addEventListener('visibilitychange', visibility);
  frame = win.requestAnimationFrame(sample);
  return {
    dispose() {
      if (disposed) return;
      pagehide();
      disposed = true;
      router.destroy();
      lifecycle.destroy();
      guard.destroy();
      navigation.destroy();
      win.removeEventListener('blur', clear);
      win.removeEventListener('pagehide', pagehide);
      win.removeEventListener('pageshow', pageshow);
      doc.removeEventListener('visibilitychange', visibility);
    },
  };
}
