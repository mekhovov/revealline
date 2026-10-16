/** Reveal a native form field's label after the browser chooses validation focus. */
export function attachFormFocus({ form, document: doc = form.ownerDocument }) {
  const view = doc.defaultView;
  let disposed = false,
    queued = false;
  const pending = new Set();
  const current = (field) =>
    !disposed &&
    !doc.hidden &&
    doc.hasFocus?.() !== false &&
    form.isConnected &&
    doc.activeElement === field &&
    form.contains(field) &&
    field.isConnected &&
    !field.disabled &&
    !field.closest('[hidden],[inert],details:not([open])') &&
    field.getClientRects().length > 0;
  const schedule = (event) => {
    if (disposed || doc.hidden || doc.hasFocus?.() === false || !form.contains(event.target))
      return;
    pending.add(event.target);
    if (queued || typeof view?.requestAnimationFrame !== 'function') return;
    queued = true;
    view.requestAnimationFrame(() => {
      queued = false;
      const field = doc.activeElement,
        owned = pending.has(field);
      pending.clear();
      if (!owned || !current(field)) return;
      const label = field.closest('label');
      if (!label || !form.contains(label)) return;
      const viewport = view.visualViewport,
        height = viewport?.height ?? doc.documentElement.clientHeight,
        box = label.getBoundingClientRect();
      // The CSS margin leaves room for the 3px outline and its 3px offset.
      const target = box.height > 0 && box.height <= height - 16 ? label : field;
      if (current(field))
        target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
    });
  };
  const cancel = () => pending.clear();
  const visibility = () => {
    if (doc.hidden) cancel();
  };
  doc.addEventListener?.('visibilitychange', visibility);
  view?.addEventListener?.('blur', cancel);
  view?.addEventListener?.('pagehide', cancel);
  form.addEventListener('focusin', schedule);
  // invalid does not bubble. Do not cancel it or replace native validation focus.
  form.addEventListener('invalid', schedule, true);
  return {
    destroy() {
      disposed = true;
      pending.clear();
      doc.removeEventListener?.('visibilitychange', visibility);
      view?.removeEventListener?.('blur', cancel);
      view?.removeEventListener?.('pagehide', cancel);
      form.removeEventListener('focusin', schedule);
      form.removeEventListener('invalid', schedule, true);
    },
  };
}
