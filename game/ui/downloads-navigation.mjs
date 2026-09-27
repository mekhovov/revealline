import { attachControllerNavigation } from './controller-navigation.mjs';
import { createControllerRouter } from './controller-router.mjs';

/** A focused embedded download page owns its controller; the host owns gameplay. */
export function attachDownloadsNavigation({
  document: doc = globalThis.document,
  window: win = globalThis.window,
  onBack = () => {},
} = {}) {
  let visible = true,
    frame;
  const active = () => visible && !doc.hidden && doc.hasFocus();
  const navigation = attachControllerNavigation({
    document: doc,
    getRoot: () => (active() ? doc.body : null),
    getScope: () => 'offline-downloads',
    getDefaultFocus: () => doc.getElementById('download-game'),
    keyboard: true,
    onBack,
  });
  const router = createControllerRouter({ eventTarget: win, autoJoin: true });
  const clear = () => {
    router.clear();
    navigation.clear();
  };
  win.addEventListener('blur', clear);
  const sample = () => {
    if (active()) {
      const state = router.sample({ scope: 'offline-downloads' });
      if (state.status.code === 'joined') navigation.engage();
      navigation.handle(state.ui);
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
      win.cancelAnimationFrame(frame);
      win.removeEventListener('blur', clear);
      router.destroy();
      navigation.destroy();
    },
  };
}
