/** Keep the current form control clear of a modal's measured sticky regions. */
export function attachFocusClearance({
  container,
  heading,
  footer,
  includeControlLabel = false,
  document: doc = globalThis.document,
}) {
  const view = doc.defaultView ?? globalThis;
  let disposed = false,
    queued = false;
  const visible = (node) => node && !node.hidden && node.getClientRects().length > 0;
  const update = () => {
    if (disposed || !container.open || doc.hidden || doc.hasFocus?.() === false) return;
    const box = container.getBoundingClientRect(),
      top =
        Math.max(box.top, visible(heading) ? heading.getBoundingClientRect().bottom : box.top) + 8,
      bottom =
        Math.min(box.bottom, visible(footer) ? footer.getBoundingClientRect().top : box.bottom) - 8;
    container.style.scrollPaddingBlockStart = `${Math.max(0, top - box.top)}px`;
    container.style.scrollPaddingBlockEnd = `${Math.max(0, box.bottom - bottom)}px`;
    const focused = doc.activeElement;
    if (
      bottom <= top ||
      !focused ||
      !container.contains(focused) ||
      heading?.contains(focused) ||
      footer?.contains(focused) ||
      focused.disabled ||
      !visible(focused)
    )
      return;
    const label = includeControlLabel ? focused.closest?.('label') : null;
    const targetNode = label && container.contains(label) && visible(label) ? label : focused;
    const target = targetNode.getBoundingClientRect();
    if (target.top < top) container.scrollTop += target.top - top;
    else if (target.bottom > bottom)
      container.scrollTop += Math.min(target.bottom - bottom, target.top - top);
  };
  const schedule = () => {
    if (disposed || queued || typeof view.requestAnimationFrame !== 'function') return;
    queued = true;
    view.requestAnimationFrame(() => {
      queued = false;
      update();
    });
  };
  const Observer = view.ResizeObserver ?? globalThis.ResizeObserver,
    observer = typeof Observer === 'function' ? new Observer(schedule) : null;
  for (const node of [heading, footer]) if (node) observer?.observe(node);
  container.addEventListener('focusin', schedule);
  view.addEventListener?.('resize', schedule);
  return {
    refresh: schedule,
    destroy() {
      disposed = true;
      observer?.disconnect();
      container.removeEventListener('focusin', schedule);
      view.removeEventListener?.('resize', schedule);
      container.style.scrollPaddingBlockStart = '0px';
      container.style.scrollPaddingBlockEnd = '0px';
    },
  };
}
