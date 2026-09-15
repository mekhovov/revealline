/** Fullscreen remains an explicit browser gesture. Safari versions without
 * document fullscreen keep the same responsive layout inside browser chrome. */
export function attachFullscreen(button, doc = globalThis.document) {
  if (!button) return () => {};
  const root = doc.documentElement;
  // A launched PWA does not set document.fullscreenElement, but its standalone
  // or fullscreen display mode should use the same arena-fit presentation.
  const displayMode = doc.defaultView?.matchMedia?.(
    '(display-mode: fullscreen), (display-mode: standalone)',
  );
  const iosStandalone = doc.defaultView?.navigator?.standalone === true;
  const supported = !!doc.fullscreenEnabled && !!doc.documentElement?.requestFullscreen;
  button.hidden = !supported;
  const sync = () => {
    const immersive = !!doc.fullscreenElement || !!displayMode?.matches || iosStandalone;
    if (immersive) root?.dataset && (root.dataset.gameFullscreen = 'true');
    else if (root?.dataset) delete root.dataset.gameFullscreen;
    button.setAttribute(
      'aria-label',
      doc.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen',
    );
    button.setAttribute('aria-pressed', String(!!doc.fullscreenElement));
  };
  const addDisplayListener = () => {
    if (displayMode?.addEventListener) displayMode.addEventListener('change', sync);
    else displayMode?.addListener?.(sync);
  };
  const removeDisplayListener = () => {
    if (displayMode?.removeEventListener) displayMode.removeEventListener('change', sync);
    else displayMode?.removeListener?.(sync);
  };
  sync();
  addDisplayListener();
  if (!supported) {
    return () => removeDisplayListener();
  }
  const click = async () => {
    try {
      if (doc.fullscreenElement) await doc.exitFullscreen();
      // Browsers that support this hint can remove their navigation UI too.
      else await doc.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      button.title =
        'Fullscreen is unavailable in this browser. The board fits the visible window.';
    }
    sync();
  };
  button.addEventListener('click', click);
  doc.addEventListener('fullscreenchange', sync);
  return () => {
    button.removeEventListener('click', click);
    doc.removeEventListener('fullscreenchange', sync);
    removeDisplayListener();
  };
}
