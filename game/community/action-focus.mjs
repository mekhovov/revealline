/** A page action may return focus only while it still owns the initiating choice. */
export function captureCommunityActionFocus({
  document: doc,
  window: win,
  opener,
  startedWithFocus,
  isCurrent,
}) {
  let active = startedWithFocus && !doc.hidden;
  const removers = [];
  const cancel = () => {
    active = false;
    for (const remove of removers.splice(0)) remove();
  };
  const listen = (target, event, handler) => {
    target?.addEventListener(event, handler, true);
    removers.push(() => target?.removeEventListener(event, handler, true));
  };
  const empty = (target) => [doc.body, doc.documentElement, null].includes(target);
  if (active) {
    listen(doc, 'focusin', (event) => {
      if (event.target !== opener && !empty(event.target)) cancel();
    });
    for (const event of ['pointerdown', 'keydown'])
      listen(doc, event, (input) => {
        if (!opener.contains(input.target)) cancel();
      });
    listen(win, 'blur', (event) => {
      if (event.target === win) cancel();
    });
    listen(win, 'pagehide', cancel);
    listen(doc, 'visibilitychange', () => {
      if (doc.hidden) cancel();
    });
  }
  return {
    cancel,
    restore(target) {
      const allowed =
        active &&
        isCurrent() &&
        !doc.hidden &&
        doc.hasFocus?.() !== false &&
        (doc.activeElement === opener || empty(doc.activeElement)) &&
        target?.isConnected &&
        !target.disabled &&
        !target.closest('[hidden],[inert],fieldset[disabled]');
      cancel();
      if (allowed) target.focus({ preventScroll: true });
    },
  };
}
