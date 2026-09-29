import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { createControllerRouter } from '../ui/controller-router.mjs';
import { attachControllerConfirmGuard } from '../ui/controller-confirm-guard.mjs';
import { createControllerConfirmLifecycle } from '../ui/controller-confirm-lifecycle.mjs';
import { createAuthoringSourcePicker } from '../ui/authoring-sources.mjs';

/** One menu owner sampled by the player's existing RAF. Flight keeps its own
 * input adapter and hardware polling; menu actions activate the real controls. */
export function attachCreatorPlayerNavigation({
  document: doc = globalThis.document,
  window: win = globalThis.window,
  getScope,
  getDefaultFocus,
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
  const lifecycle = createControllerConfirmLifecycle();
  const guard = attachControllerConfirmGuard({
    document: doc,
    now,
    confirmPressed: () => getScope() !== 'flight' && router.menuConfirmPressed(),
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
    getScope: scope,
    getRoot: () => topDialog() || doc.body,
    getDefaultFocus: primary,
    accept: (element) => !element.closest('#arena,.touch-controls'),
    activateControl: (element) => guard.activate(element),
    activateFileInput: (element) => sources.open(element),
    onNativeInput: () => router.clear(),
    onBack: back,
    onMenu: back,
  });
  function refresh({ focus = false } = {}) {
    if (disposed) return;
    router.clear();
    lifecycle.reset('player-state');
    guard.cancel('player-state');
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
    const frame = lifecycle.filter(router.sample({ scope: currentScope, timeMs }), {
      scope: currentScope,
      timeMs,
    });
    if (frame.status.code === 'joined') navigation.engage();
    const command = frame.ui;
    const target = navigation.handle(command);
    if (command.confirmStart) {
      if (target) guard.begin(target);
      else lifecycle.reset('unavailable-target');
    } else if (command.confirmCancel) guard.cancel('lifecycle-cancel');
    else if (command.confirmCommit) {
      if (target) guard.finish('release');
      else guard.cancel('invalid-target');
    }
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
      navigation.destroy();
      guard.destroy();
      router.destroy();
      lifecycle.reset('dispose');
      win.removeEventListener('blur', clear);
      doc.removeEventListener('visibilitychange', clear);
    },
  };
}
