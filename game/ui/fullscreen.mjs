/** Fullscreen remains an explicit browser gesture. Safari versions without
 * document fullscreen keep the same responsive layout inside browser chrome. */
export function attachFullscreen(button, doc = globalThis.document) {
  if (!button) return () => {};
  button.hidden = !doc.fullscreenEnabled || !doc.documentElement.requestFullscreen;
  const sync = () => {
    button.setAttribute(
      'aria-label',
      doc.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen',
    );
    button.setAttribute('aria-pressed', String(!!doc.fullscreenElement));
  };
  const click = async () => {
    try {
      if (doc.fullscreenElement) await doc.exitFullscreen();
      else await doc.documentElement.requestFullscreen();
    } catch {
      button.title =
        'Fullscreen is unavailable in this browser. The board fits the visible window.';
    }
    sync();
  };
  button.addEventListener('click', click);
  doc.addEventListener('fullscreenchange', sync);
  sync();
  return () => {
    button.removeEventListener('click', click);
    doc.removeEventListener('fullscreenchange', sync);
  };
}
