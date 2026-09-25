import { t, localizedText } from '../game/i18n/index.mjs';
import { attachControllerNavigation } from '../game/ui/controller-navigation.mjs';
import { createControllerRouter } from '../game/ui/controller-router.mjs';

/** The About page owns input independently of its optional catalogue requests. */
export function attachAboutNavigation({
  document: doc = globalThis.document,
  window: win = globalThis.window,
  navigator: nav = globalThis.navigator,
  requestAnimationFrame: requestFrame = globalThis.requestAnimationFrame,
  cancelAnimationFrame: cancelFrame = globalThis.cancelAnimationFrame,
} = {}) {
  const returnLink = doc.getElementById('about-return'),
    status = doc.getElementById('about-navigation-status'),
    listeners = [];
  let disposed = false,
    cached = false,
    blurred = doc.hasFocus?.() === false,
    frameId = null,
    lastStatus = null;
  const foreground = () =>
    !disposed && !cached && !blurred && !doc.hidden && doc.hasFocus?.() !== false;
  const hint = (text) => {
    if (!foreground()) return;
    // Select drafts already announce their text in the adjacent live preview.
    // Keep the page status for connection, cancellation and navigation hints.
    const editor = doc.querySelector('.controller-editor');
    if (editor?.getAttribute('role') === 'status' && editor.textContent === text) return;
    if (status.textContent !== text) localizedText(status, () =>text);
  };
  const router = createControllerRouter({
    readPads: () => nav?.getGamepads?.() ?? [],
    eventTarget: win,
  });
  const returnFocus = () => {
    if (!foreground()) return;
    returnLink.focus({ preventScroll: true });
    returnLink.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
    hint(t("website:returnToGameSelectedConfirmToLeaveThisPage"));
  };
  const navigation = attachControllerNavigation({
    document: doc,
    getScope: () => 'about',
    getRoot: () => doc,
    getDefaultFocus: () => returnLink,
    onBack: returnFocus,
    onMenu: returnFocus,
    onHint: hint,
    onNativeInput: () => router.clear(),
  });
  const listen = (target, type, handler, capture = false) => {
    target.addEventListener(type, handler, capture);
    listeners.push(() => target.removeEventListener(type, handler, capture));
  };
  const clear = () => {
    router.clear();
    navigation.clear();
  };
  const stop = () => {
    if (frameId !== null) cancelFrame(frameId);
    frameId = null;
    clear();
  };
  const schedule = () => {
    if (foreground() && frameId === null) frameId = requestFrame(poll);
  };
  function poll(timeMs) {
    frameId = null;
    if (!foreground()) {
      clear();
      return;
    }
    const sample = router.sample({ scope: 'about', timeMs });
    if (sample.disconnected) navigation.clear();
    if (sample.status.code !== lastStatus) {
      lastStatus = sample.status.code;
      hint(
        sample.status.code === 'connected'
          ? t("website:dPadMoveSouthChooseEastBackKeyboardAndTouch")
          : sample.status.message,
      );
    }
    // Joining establishes a visible selection but carries no page activation.
    // engage() preserves an already focused control; the router gates the hold.
    if (sample.status.code === 'joined') navigation.engage();
    navigation.handle(sample.ui);
    schedule();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    listeners.splice(0).forEach((remove) => remove());
    navigation.destroy();
    router.destroy();
  }
  // Native Tab/select/disclosure behavior stays with the browser. The adapter
  // consumes Escape only while cancelling a controller edit; an unconsumed
  // fresh Escape outside native editors is the deliberate Back-to-Return
  // focus action. Native editors retain Escape to dismiss their own UI.
  listen(
    doc,
    'keydown',
    (event) => {
      if (
        foreground() &&
        !event.defaultPrevented &&
        !event.repeat &&
        event.key === 'Escape' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.target?.closest?.(
          'input,select,textarea,[contenteditable]:not([contenteditable="false"])',
        )
      ) {
        event.preventDefault();
        returnFocus();
      }
    },
    true,
  );
  listen(win, 'blur', () => {
    blurred = true;
    stop();
  });
  listen(win, 'focus', () => {
    blurred = false;
    schedule();
  });
  listen(doc, 'visibilitychange', () => {
    if (doc.hidden) stop();
    else schedule();
  });
  listen(win, 'pagehide', (event) => {
    if (!event.persisted) dispose();
    else {
      cached = true;
      stop();
    }
  });
  listen(win, 'pageshow', (event) => {
    if (!event.persisted || disposed) return;
    cached = false;
    blurred = doc.hasFocus?.() === false;
    clear();
    schedule();
  });
  schedule();
  return { current: () => !disposed, dispose };
}
