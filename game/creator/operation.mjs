/** Keep asynchronous editor work on its Cancel control while ordinary inputs
 * are disabled. A newer interaction permanently retires the return intent. */
export async function runCreatorOperation(
  action,
  {
    document: doc,
    window: win = doc.defaultView,
    cancel,
    opener = null,
    restoreTo = opener,
    onStart,
    onFinish,
    onError,
    onSuccessFocus = null,
  },
) {
  const controller = new AbortController(),
    owned = new Set([opener, cancel]),
    removers = [];
  let current = !!(
    opener &&
    opener !== doc.body &&
    opener !== doc.documentElement &&
    doc.activeElement === opener &&
    !doc.hidden &&
    doc.hasFocus?.() !== false
  );
  const empty = (target) => !target || target === doc.body || target === doc.documentElement;
  const retire = () => {
    current = false;
    for (const remove of removers.splice(0)) remove();
  };
  const listen = (node, type, callback) => {
    node?.addEventListener?.(type, callback, true);
    removers.push(() => node?.removeEventListener?.(type, callback, true));
  };
  const ownsFocus = () =>
    current &&
    !doc.hidden &&
    doc.hasFocus?.() !== false &&
    (empty(doc.activeElement) || owned.has(doc.activeElement));
  if (current) {
    listen(doc, 'focusin', (event) => {
      if (!empty(event.target) && !owned.has(event.target)) retire();
    });
    for (const type of ['pointerdown', 'keydown'])
      listen(doc, type, (event) => {
        if (![...owned].some((element) => element?.contains(event.target))) retire();
      });
    listen(win, 'blur', (event) => {
      if (event.target === win) retire();
    });
    listen(doc, 'visibilitychange', () => {
      if (doc.hidden) retire();
    });
    listen(win, 'pagehide', retire);
    listen(win, 'gamepaddisconnected', retire);
  }
  let succeeded = false;
  try {
    onStart(controller);
    if (ownsFocus() && cancel?.isConnected && !cancel.hidden && !cancel.disabled) cancel.focus();
    const result = await action(controller.signal);
    succeeded = !controller.signal.aborted;
    return result;
  } catch (error) {
    onError(error);
  } finally {
    try {
      // Reveal/re-enable the destination before returning focus. No disabled
      // opener is briefly focused just to satisfy a later success handoff.
      onFinish();
      if (ownsFocus()) {
        if (succeeded && onSuccessFocus) onSuccessFocus({ opener, ownedFocus: [cancel] });
        else if (
          restoreTo?.isConnected &&
          !restoreTo.disabled &&
          !restoreTo.closest('[hidden],[inert]') &&
          restoreTo.getClientRects().length
        )
          restoreTo.focus();
      }
    } finally {
      retire();
    }
  }
}
