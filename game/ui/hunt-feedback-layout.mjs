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
    closed = false,
    observedHeight = null;
  const measure = () => {
    frame = null;
    if (closed) return;
    // The feedback rail uses horizontal writing, so blockSize is its height.
    // Reserve the border box (including padding), not just the text content.
    // Older observers without box sizes retain the original measurement path.
    const height = Math.ceil(observedHeight ?? container.getBoundingClientRect().height);
    const value = `${Math.max(0, height)}px`;
    if (body.style.getPropertyValue('--hunt-feedback-height') !== value)
      body.style.setProperty('--hunt-feedback-height', value);
  };
  const schedule = () => {
    if (!closed && frame === null) frame = win.requestAnimationFrame(measure);
  };
  const resize = win.ResizeObserver
    ? new win.ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target !== container) continue;
          const boxes = entry.borderBoxSize,
            box = boxes?.[0] ?? boxes,
            height = box?.blockSize;
          observedHeight = Number.isFinite(height) && height >= 0 ? height : null;
          schedule();
        }
      })
    : null;
  if (resize) {
    try {
      resize.observe(container, { box: 'border-box' });
    } catch {
      // Early ResizeObserver implementations only accept a target.
      resize.observe(container);
    }
  }
  // Text/style mutations that do not resize the rail need no measurement.
  // ResizeObserver also covers font loading, wrapping and viewport changes.
  const mutation = !resize && win.MutationObserver ? new win.MutationObserver(schedule) : null;
  mutation?.observe(container, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['hidden', 'style'],
  });
  if (!resize) {
    win.addEventListener('resize', schedule);
    schedule();
  }
  return () => {
    closed = true;
    if (frame !== null) win.cancelAnimationFrame(frame);
    resize?.disconnect();
    mutation?.disconnect();
    win.removeEventListener('resize', schedule);
    body.style.removeProperty('--hunt-feedback-height');
  };
}
