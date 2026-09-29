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
  const lifecycle = createControllerConfirmLifecycle();
  const guard = attachControllerConfirmGuard({
    document: doc,
    confirmPressed: () => foreground() && router.menuConfirmPressed(),
    now,
  });
  const navigation = attachControllerNavigation({
    document: doc,
    getRoot: () => (foreground() ? doc.body : null),
    getScope: () => 'launcher',
    getDefaultFocus: preferred,
    keyboard: true,
    ownsKeyboardEvent: () => !foreground(),
    activateControl: (element) => guard.activate(element),
    onBack: () => preferred()?.focus(),
  });
  const clear = () => {
    router.clear();
    lifecycle.reset('launcher-lifecycle');
    guard.cancel('launcher-lifecycle');
    navigation.clear();
  };
  const sample = (timeMs) => {
    frame = null;
    if (disposed || suspended) return;
    if (foreground()) {
      const state = lifecycle.filter(router.sample({ scope: 'launcher', timeMs }), {
        scope: 'launcher',
        timeMs,
      });
      if (state.status.code === 'joined') navigation.engage();
      const command = state.ui;
      const target = navigation.handle(command);
      if (command.confirmStart) {
        if (target) guard.begin(target);
        else lifecycle.reset('unavailable-target');
      } else if (command.confirmCancel) guard.cancel('launcher-cancel');
      else if (command.confirmCommit) {
        if (target) guard.finish('release');
        else guard.cancel('invalid-target');
      }
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
      guard.destroy();
      navigation.destroy();
      win.removeEventListener('blur', clear);
      win.removeEventListener('pagehide', pagehide);
      win.removeEventListener('pageshow', pageshow);
      doc.removeEventListener('visibilitychange', visibility);
    },
  };
}
