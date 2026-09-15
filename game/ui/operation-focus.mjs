/** One operation may return focus only while its actual initiating control owns it. */
export function captureOperationFocus(
  opener,
  { document: doc = opener?.ownerDocument, owned = [], restoreTo = opener } = {},
) {
  const root = opener?.closest('dialog'),
    win = doc?.defaultView ?? globalThis.window,
    targets = new Set([opener, restoreTo, ...owned]),
    removers = [];
  let active = !!(
    opener &&
    doc?.activeElement === opener &&
    root?.open &&
    restoreTo?.isConnected &&
    restoreTo.closest('dialog') === root &&
    !doc.hidden &&
    doc.hasFocus?.() !== false
  );
  const empty = (target) => !target || target === doc.body || target === doc.documentElement;
  const cancel = () => {
    active = false;
    for (const remove of removers.splice(0)) remove();
  };
  const listen = (node, event, callback) => {
    node?.addEventListener?.(event, callback, true);
    removers.push(() => node?.removeEventListener?.(event, callback, true));
  };
  if (active) {
    listen(doc, 'focusin', (event) => {
      if (!empty(event.target) && !targets.has(event.target)) cancel();
    });
    for (const type of ['pointerdown', 'keydown'])
      listen(doc, type, (event) => {
        if (![...targets].some((target) => target?.contains(event.target))) cancel();
      });
    listen(win, 'blur', (event) => {
      // Element blur is captured here too; only losing the page retires intent.
      if (event.target === win) cancel();
    });
    listen(win, 'pagehide', cancel);
    listen(doc, 'visibilitychange', () => {
      if (doc.hidden) cancel();
    });
    // Native dialog events are captured, including non-bubbling beforetoggle.
    // Closing and reopening the same dialog never resurrects an old operation.
    listen(doc, 'close', (event) => {
      if (event.target === root) cancel();
    });
    listen(doc, 'beforetoggle', (event) => {
      if (
        event.target?.tagName === 'DIALOG' &&
        (event.target === root || event.newState === 'open')
      )
        cancel();
    });
  }
  return Object.freeze({
    cancel,
    restore() {
      const focus = doc?.activeElement,
        allowed =
          active &&
          root.open &&
          restoreTo.isConnected &&
          restoreTo.closest('dialog') === root &&
          !restoreTo.disabled &&
          !restoreTo.closest('[hidden],[inert],dialog:not([open]),details:not([open])') &&
          !doc.hidden &&
          doc.hasFocus?.() !== false &&
          (empty(focus) || targets.has(focus));
      cancel(); // Retire before an external focus handler can reenter the owner.
      if (!allowed || focus === restoreTo) return false;
      restoreTo.focus({ preventScroll: true });
      return doc.activeElement === restoreTo;
    },
  });
}
