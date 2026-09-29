const foreground = (doc) => !doc.hidden && doc.hasFocus?.() !== false;
const available = (node) =>
  node?.isConnected &&
  !node.disabled &&
  !node.closest('[hidden],[inert],details:not([open])') &&
  node.getClientRects().length > 0;

/** Transfer only the control whose synchronous state update removes its focus. */
export function disableStudioControl(control, fallback) {
  const doc = control.ownerDocument;
  if (foreground(doc) && doc.activeElement === control && available(fallback)) {
    fallback.focus({ preventScroll: true });
    if (doc.activeElement === fallback) fallback.scrollIntoView({ block: 'nearest' });
  }
  control.disabled = true;
}

export function syncStudioHistory({ undo, redo, fallback, canUndo, canRedo }) {
  if (canUndo) undo.disabled = false;
  if (canRedo) redo.disabled = false;
  if (!canUndo) disableStudioControl(undo, canRedo ? redo : fallback);
  if (!canRedo) disableStudioControl(redo, canUndo ? undo : fallback);
}

/** A page operation may reveal its result only while its actual opener keeps
 * foreground intent. Nothing is focused and this lease never owns mutations. */
export function captureStudioActionFocus(opener) {
  const doc = opener?.ownerDocument,
    win = doc?.defaultView,
    removers = [];
  let active = !!(doc && foreground(doc) && doc.activeElement === opener && available(opener));
  const cancel = () => {
    active = false;
    removers.splice(0).forEach((remove) => remove());
  };
  const listen = (node, type, callback) => {
    node?.addEventListener?.(type, callback, true);
    removers.push(() => node?.removeEventListener?.(type, callback, true));
  };
  if (active) {
    listen(doc, 'focusin', (event) => {
      if (event.target !== opener) cancel();
    });
    // The initiating key/pointer-down precedes click and this capture. Any
    // later input, including reading/scrolling while focus stays on Play,
    // supersedes the pending reveal intent.
    for (const type of ['pointerdown', 'touchstart', 'wheel', 'keydown']) listen(doc, type, cancel);
    listen(win, 'blur', (event) => {
      if (event.target === win) cancel();
    });
    listen(win, 'pagehide', cancel);
    listen(doc, 'visibilitychange', () => {
      if (doc.hidden) cancel();
    });
  }
  const current = () =>
    active && foreground(doc) && doc.activeElement === opener && available(opener);
  return {
    cancel,
    current,
    reveal(target) {
      if (!current() || !available(target)) return false;
      target.scrollIntoView({ block: 'start' });
      return true;
    },
  };
}
