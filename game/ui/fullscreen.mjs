function iosBrowser(navigator) {
  if (!navigator) return false;
  const platform = navigator.platform ?? '';
  return (
    /iPad|iPhone|iPod/.test(platform || navigator.userAgent || '') ||
    (platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** Fullscreen remains an explicit browser gesture. iPhone Safari cannot enter
 * document fullscreen, so its visible control explains the Home Screen route. */
export function attachFullscreen(button, doc = globalThis.document) {
  if (!button) return () => {};
  let active = true,
    pending = false;
  const root = doc.documentElement;
  // A launched PWA does not set document.fullscreenElement, but its standalone
  // or fullscreen display mode should use the same arena-fit presentation.
  const displayMode = doc.defaultView?.matchMedia?.(
    '(display-mode: fullscreen), (display-mode: standalone)',
  );
  const navigator = doc.defaultView?.navigator;
  const iosStandalone = navigator?.standalone === true;
  const supported = !!doc.fullscreenEnabled && !!doc.documentElement?.requestFullscreen;
  const installDialog = doc.getElementById?.('ios-home-screen-dialog');
  const offersInstallHelp =
    !supported && !iosStandalone && iosBrowser(navigator) && !!installDialog;
  button.hidden = !supported && !offersInstallHelp;
  const sync = () => {
    if (!active) return;
    const immersive = !!doc.fullscreenElement || !!displayMode?.matches || iosStandalone;
    if (immersive) root?.dataset && (root.dataset.gameFullscreen = 'true');
    else if (root?.dataset) delete root.dataset.gameFullscreen;
    button.setAttribute(
      'aria-label',
      offersInstallHelp
        ? 'Use full screen on iPhone or iPad'
        : doc.fullscreenElement
          ? 'Exit fullscreen'
          : 'Enter fullscreen',
    );
    if (offersInstallHelp) button.removeAttribute('aria-pressed');
    else button.setAttribute('aria-pressed', String(!!doc.fullscreenElement));
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
  if (!supported && !offersInstallHelp) {
    return () => {
      active = false;
      removeDisplayListener();
    };
  }
  const click = async () => {
    if (!active || pending) return;
    if (offersInstallHelp) {
      if (!installDialog.open) installDialog.showModal();
      doc.getElementById?.('ios-home-screen-close')?.focus?.({ preventScroll: true });
      return;
    }
    pending = true;
    try {
      if (doc.fullscreenElement) await doc.exitFullscreen();
      // Browsers that support this hint can remove their navigation UI too.
      else await doc.documentElement.requestFullscreen({ navigationUI: 'hide' });
      if (active) button.title = '';
    } catch {
      if (active)
        button.title =
          'Fullscreen is unavailable in this browser. The board fits the visible window.';
    } finally {
      pending = false;
    }
    sync();
  };
  button.addEventListener('click', click);
  doc.addEventListener('fullscreenchange', sync);
  return () => {
    active = false;
    button.removeEventListener('click', click);
    doc.removeEventListener('fullscreenchange', sync);
    removeDisplayListener();
  };
}
