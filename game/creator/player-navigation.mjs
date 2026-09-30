import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { createControllerRouter } from '../ui/controller-router.mjs';
import { attachControllerConfirmGuard } from '../ui/controller-confirm-guard.mjs';
import { createControllerConfirmLifecycle } from '../ui/controller-confirm-lifecycle.mjs';
import { settingsTabOwnsKey } from '../ui/settings-panels.mjs';
import { createAuthoringSourcePicker } from '../ui/authoring-sources.mjs';

/** One menu owner sampled by the player's existing RAF. Flight keeps its own
 * input adapter and hardware polling; menu actions activate the real controls. */
export function attachCreatorPlayerNavigation({
  document: doc = globalThis.document,
  window: win = globalThis.window,
  getScope,
  getDefaultFocus,
  getRoot = () => doc.body,
  onBack = () => false,
  readPads = () => win.navigator.getGamepads?.() || [],
  now = () => win.performance?.now?.() ?? Date.now(),
} = {}) {
  let disposed = false,
    lastScope = null;
  const router = createControllerRouter({
    readPads,
    now,
    eventTarget: win,
    autoJoin: true,
    navigationAliases: true,
  });
  let lifecycle;
  const guard = attachControllerConfirmGuard({
    document: doc,
    now,
    confirmPressed: () => getScope() !== 'flight' && router.menuConfirmPressed(),
    beforeNativeActivation: (event) => {
      if (getScope() !== 'flight') lifecycle?.beforeNativeActivation(event);
    },
  });
  const topDialog = () => [...doc.querySelectorAll('dialog[open]')].at(-1);
  const scope = () =>
    getScope() === 'flight' ? 'flight' : `${getScope()}:${topDialog()?.id || 'page'}`;
  let navigation;
  const sources = createAuthoringSourcePicker({
    document: doc,
    window: win,
    onOpen: () => refresh(),
    onClose: () => refresh(),
  });
  sources.dialog.id = 'creator-player-sources';
  const primary = () => topDialog()?.querySelector('button:not(:disabled)') || getDefaultFocus();
  const back = () => {
    if (onBack() === true) return;
    const dialog = topDialog();
    if (dialog === sources.dialog) sources.close();
    else if (dialog) {
      const event = new win.Event('cancel', { cancelable: true });
      if (dialog.dispatchEvent(event)) dialog.close();
    } else {
      const details = doc.activeElement?.closest('details[open]');
      if (details) {
        details.open = false;
        details.querySelector('summary')?.focus();
      } else primary()?.focus();
    }
  };
  navigation = attachControllerNavigation({
    document: doc,
    keyboard: true,
    ownsKeyboardEvent: (event) => settingsTabOwnsKey(event, topDialog()),
    getScope: scope,
    getRoot: () => topDialog() || getRoot(),
    getDefaultFocus: primary,
    accept: (element) => !element.closest('#arena,.touch-controls'),
    activateControl: (element) => guard.activate(element),
    activateFileInput: (element) => sources.open(element),
    onNativeInput: (event) => {
      lifecycle?.nativeInput(event);
      router.clear();
    },
    onBack: back,
    onMenu: back,
  });
  lifecycle = createControllerConfirmLifecycle({
    document: doc,
    readConfirm: (options) => router.readMenuConfirm(options),
    getContext: () => ({
      scope: scope(),
      root: topDialog() || getRoot(),
      focused: doc.activeElement,
      active:
        !disposed &&
        getScope() !== 'flight' &&
        !doc.hidden &&
        doc.hasFocus?.() !== false &&
        doc.activeElement?.tagName !== 'IFRAME',
    }),
    navigation,
    guard,
    now,
  });
  function refresh({ focus = false } = {}) {
    if (disposed) return;
    router.clear();
    lifecycle?.cancel('player-state');
    navigation?.clear();
    navigation?.sync();
    lastScope = scope();
    if (focus && lastScope !== 'flight' && !doc.hidden && doc.hasFocus?.() !== false)
      navigation?.focusAvailable();
  }
  function update(timeMs) {
    if (disposed) return;
    const currentScope = scope();
    if (currentScope !== lastScope) refresh();
    if (
      currentScope === 'flight' ||
      doc.hidden ||
      doc.hasFocus?.() === false ||
      doc.activeElement?.tagName === 'IFRAME'
    ) {
      if (currentScope !== 'flight') refresh();
      return;
    }
    const frame = router.sample({ scope: currentScope, timeMs });
    if (frame.status.code === 'joined') navigation.engage();
    lifecycle.sample(frame.confirmSnapshot);
    // Confirm has one release-committed owner; dispatch all other router edges once.
    if (scope() === currentScope) navigation.handle({ ...frame.ui, confirm: false });
  }
  const clear = () => refresh();
  win.addEventListener('blur', clear);
  doc.addEventListener('visibilitychange', clear);
  return {
    update,
    refresh,
    destroy() {
      if (disposed) return;
      disposed = true;
      sources.destroy();
      lifecycle.destroy();
      navigation.destroy();
      guard.destroy();
      router.destroy();
      win.removeEventListener('blur', clear);
      doc.removeEventListener('visibilitychange', clear);
    },
  };
}
