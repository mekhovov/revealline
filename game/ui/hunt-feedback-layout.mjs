/** Measure Solo's optional feedback for its existing fixed/handheld board fit.
 * This only reserves DOM space; no simulation, input or camera values change. */
export function attachHuntFeedbackLayout({ container, window: win = globalThis.window } = {}) {
  const body = container?.ownerDocument?.body;
  if (
    container?.id !== 'hunt-feedback' ||
    !body ||
    !container.closest?.('.arena-panel') ||
    typeof win?.requestAnimationFrame !== 'function'
  )
    return () => {};
  let frame = null,
    closed = false;
  const measure = () => {
    frame = null;
    if (closed) return;
    const height = Math.ceil(container.getBoundingClientRect().height);
    const value = `${Math.max(0, height)}px`;
    if (body.style.getPropertyValue('--hunt-feedback-height') !== value)
      body.style.setProperty('--hunt-feedback-height', value);
  };
  const schedule = () => {
    if (!closed && frame === null) frame = win.requestAnimationFrame(measure);
  };
  const resize = win.ResizeObserver ? new win.ResizeObserver(schedule) : null;
  resize?.observe(container);
  const mutation = win.MutationObserver ? new win.MutationObserver(schedule) : null;
  mutation?.observe(container, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['hidden', 'style'],
  });
  win.addEventListener('resize', schedule);
  schedule();
  return () => {
    closed = true;
    if (frame !== null) win.cancelAnimationFrame(frame);
    resize?.disconnect();
    mutation?.disconnect();
    win.removeEventListener('resize', schedule);
    body.style.removeProperty('--hunt-feedback-height');
  };
}
