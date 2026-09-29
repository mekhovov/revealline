import { attachControllerNavigation } from './controller-navigation.mjs';
import { createControllerRouter } from './controller-router.mjs';
import { attachControllerConfirmGuard } from './controller-confirm-guard.mjs';
import { createControllerConfirmLifecycle } from './controller-confirm-lifecycle.mjs';

/** A focused embedded download page owns its controller; the host owns gameplay. */
export function attachDownloadsNavigation({
  document: doc = globalThis.document,
  window: win = globalThis.window,
  onBack = () => {},
  readPads,
  now = () => win.performance?.now?.() ?? Date.now(),
} = {}) {
  let visible = true,
    disposed = false,
    frame,
    lifecycle;
  const active = () => !disposed && visible && !doc.hidden && doc.hasFocus();
  const getRoot = () => (active() ? doc.body : null);
  const router = createControllerRouter({ eventTarget: win, autoJoin: true, readPads, now });
  const guard = attachControllerConfirmGuard({
    document: doc,
    now,
    confirmPressed: () => active() && router.menuConfirmPressed(),
    beforeNativeActivation: (event) => {
      if (active()) lifecycle?.beforeNativeActivation(event);
    },
  });
  const navigation = attachControllerNavigation({
    document: doc,
    getRoot,
    getScope: () => 'offline-downloads',
    getDefaultFocus: () => doc.getElementById('download-game'),
    keyboard: true,
    onBack,
    activateControl: (element) => guard.activate(element),
    onNativeInput: (event) => {
      lifecycle?.nativeInput(event);
      router.clear();
    },
  });
  lifecycle = createControllerConfirmLifecycle({
    document: doc,
    readConfirm: (options) => router.readMenuConfirm(options),
    getContext: () => ({
      scope: 'offline-downloads',
      root: getRoot(),
      focused: doc.activeElement,
      active: active(),
    }),
    navigation,
    guard,
    now,
  });
  const clear = () => {
    router.clear();
    lifecycle.cancel('downloads-input-clear');
    navigation.clear();
  };
  win.addEventListener('blur', clear);
  const sample = (timeMs) => {
    if (disposed) return;
    if (active()) {
      const state = router.sample({ scope: 'offline-downloads', timeMs });
      if (state.status.code === 'joined') navigation.engage();
      lifecycle.sample(state.confirmSnapshot);
      if (active()) navigation.handle({ ...state.ui, confirm: false });
    } else clear();
    frame = win.requestAnimationFrame(sample);
  };
  frame = win.requestAnimationFrame(sample);
  return {
    setVisible(value) {
      visible = value;
      if (!visible) clear();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      win.cancelAnimationFrame(frame);
      win.removeEventListener('blur', clear);
      lifecycle.destroy();
      router.destroy();
      navigation.destroy();
      guard.destroy();
    },
  };
}
