import { attachControllerConfirmGuard } from './controller-confirm-guard.mjs';
import { createControllerConfirmLifecycle } from './controller-confirm-lifecycle.mjs';

/** Parent authoring input owner. A focused child game must have sole controller ownership. */
export function createEnemyCatalogInput({
  document: doc,
  frame,
  router,
  navigation,
  getScope,
  getRoot = () => doc.querySelector('dialog[open]') || doc.body,
  now = () => doc.defaultView?.performance?.now?.() ?? Date.now(),
}) {
  let disposed = false,
    lifecycle;
  const menu = () => (typeof navigation === 'function' ? navigation() : navigation);
  const active = () =>
    !!menu() && !disposed && !doc.hidden && doc.hasFocus() && doc.activeElement !== frame;
  const guard = attachControllerConfirmGuard({
    document: doc,
    now,
    confirmPressed: () => active() && router.menuConfirmPressed(),
    beforeNativeActivation: (event) => {
      if (active()) lifecycle?.beforeNativeActivation(event);
    },
  });
  lifecycle = createControllerConfirmLifecycle({
    document: doc,
    readConfirm: (options) => router.readMenuConfirm(options),
    getContext: () => ({
      scope: getScope(),
      root: getRoot(),
      focused: doc.activeElement,
      active: active(),
    }),
    navigation: {
      beginConfirm: (target) => menu()?.beginConfirm(target),
      commitConfirm: () => menu()?.commitConfirm(),
      cancelConfirm: () => menu()?.cancelConfirm(),
      confirmCurrent: () => menu()?.confirmCurrent(),
    },
    guard,
    now,
  });
  const clear = () => {
    router.clear();
    lifecycle.cancel('enemy-input-clear');
    menu()?.clear();
  };
  return {
    clear,
    activate: (element) => guard.activate(element),
    nativeInput(event) {
      lifecycle.nativeInput(event);
      router.clear();
    },
    poll(timeMs) {
      if (disposed) return false;
      if (!active()) {
        clear();
        return false;
      }
      const scope = getScope(),
        state = router.sample({ scope, timeMs });
      if (state.status.code === 'joined') menu().engage();
      lifecycle.sample(state.confirmSnapshot);
      if (active() && scope === getScope()) menu().handle({ ...state.ui, confirm: false });
      return true;
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      lifecycle.destroy();
      menu()?.clear();
      guard.destroy();
    },
  };
}
