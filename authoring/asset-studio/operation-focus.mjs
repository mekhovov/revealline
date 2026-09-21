/** A Studio mutation may restore only its still-owned foreground attention. */
export function captureStudioOperationFocus(
  opener,
  {
    document: doc = opener?.ownerDocument,
    window: win = doc?.defaultView,
    cancelButton,
    isCurrent,
    resolveTarget,
  },
) {
  const empty = (target) => !target || target === doc.body || target === doc.documentElement;
  const eligible = (target) => {
    if (!target?.isConnected || target.disabled || target.ownerDocument !== doc) return false;
    for (let node = target; node; node = node.parentElement) {
      if (node.hidden || node.inert || (node.tagName === 'DIALOG' && !node.open)) return false;
      if (
        node.tagName === 'DETAILS' &&
        !node.open &&
        !node.querySelector('summary')?.contains(target)
      )
        return false;
      const style = win?.getComputedStyle?.(node);
      if (style?.display === 'none' || style?.visibility === 'hidden') return false;
    }
    return typeof target.getClientRects !== 'function' || target.getClientRects().length > 0;
  };
  const foreground = () => !doc.hidden && doc.hasFocus?.() !== false;
  const owned = new Set([opener, cancelButton]);
  let active = !!(
    opener &&
    !empty(opener) &&
    doc.activeElement === opener &&
    eligible(opener) &&
    foreground() &&
    isCurrent()
  );
  const removers = [];
  const cancel = () => {
    active = false;
    for (const remove of removers.splice(0)) remove();
  };
  const listen = (node, type, callback) => {
    node?.addEventListener?.(type, callback, true);
    removers.push(() => node?.removeEventListener?.(type, callback, true));
  };
  if (active) {
    listen(doc, 'focusin', (event) => {
      if (!empty(event.target) && !owned.has(event.target)) cancel();
    });
    for (const type of ['pointerdown', 'keydown'])
      listen(doc, type, (event) => {
        const emptyEscape = type === 'keydown' && event.key === 'Escape' && empty(event.target);
        if (!emptyEscape && ![...owned].some((control) => control?.contains(event.target)))
          cancel();
      });
    listen(win, 'blur', (event) => {
      if (event.target === win) cancel();
    });
    listen(win, 'pagehide', cancel);
    listen(doc, 'visibilitychange', () => {
      if (doc.hidden) cancel();
    });
    listen(doc, 'beforetoggle', (event) => {
      if (event.target?.tagName === 'DIALOG' && event.newState === 'open') cancel();
    });
  }
  return Object.freeze({
    cancel,
    restore() {
      const current = () =>
        active &&
        isCurrent() &&
        foreground() &&
        (empty(doc.activeElement) || owned.has(doc.activeElement));
      if (!current()) {
        cancel();
        return false;
      }
      let target;
      try {
        target = resolveTarget(eligible);
      } catch {
        cancel();
        return false;
      }
      const allowed = current() && eligible(target);
      cancel(); // Retire before focus can synchronously start another operation.
      if (!allowed || doc.activeElement === target) return false;
      target.focus();
      return doc.activeElement === target;
    },
  });
}
