/** Browser fullscreen is a user gesture. Unsupported browsers keep a useful
 * screen action that explains Home Screen play instead of hiding the control. */
export function attachFullscreen(button, doc = globalThis.document, { onHelp = () => {} } = {}) {
  if (!button) return () => {};
  const win = doc.defaultView ?? globalThis.window;
  const dialog = doc.getElementById('fullscreen-dialog');
  const message = doc.getElementById('fullscreen-message');
  const steps = doc.getElementById('fullscreen-home-steps');
  const homeNote = doc.getElementById('fullscreen-home-note');
  const retry = doc.getElementById('fullscreen-retry');
  const buttons = [button, ...doc.querySelectorAll('[data-fullscreen]')];
  const displayMode = win?.matchMedia?.('(display-mode: standalone), (display-mode: fullscreen)');
  const standalone = () => displayMode?.matches || win?.navigator?.standalone === true;
  const supported = () =>
    !!doc.fullscreenEnabled && typeof doc.documentElement.requestFullscreen === 'function';
  const sync = () => {
    const active = !!doc.fullscreenElement;
    button.hidden = false;
    button.setAttribute(
      'aria-label',
      active
        ? 'Exit fullscreen'
        : supported() && !standalone()
          ? 'Enter fullscreen'
          : 'Fullscreen options',
    );
    button.setAttribute('aria-pressed', String(active));
    button.title = button.getAttribute('aria-label');
    if (retry) retry.hidden = !supported() || active || standalone();
    if (steps) steps.hidden = !!standalone();
    if (homeNote) homeNote.hidden = !!standalone();
  };
  const help = (source, rejected = false) => {
    sync();
    if (!dialog) return;
    message.textContent = standalone()
      ? 'You are already playing in a Home Screen app without browser tabs or an address bar. The game fits around your device’s safe areas.'
      : rejected
        ? 'Your browser could not enter fullscreen. You can keep playing in this window, try again, or open the game from your Home Screen.'
        : supported()
          ? 'Enter fullscreen to hide browser controls, or launch the game from your Home Screen. You can also keep playing in this window.'
          : 'This browser cannot hide its tabs and toolbar for this game. The board already uses the available window. For more room on iPhone or iPad, open the game from your Home Screen.';
    if (retry) retry.textContent = rejected ? 'Try fullscreen again' : 'Enter fullscreen';
    onHelp();
    // Pause may focus Resume. Preserve the actual opener for native modal return.
    source?.focus({ preventScroll: true });
    if (!dialog.open) dialog.showModal();
  };
  const click = async (event) => {
    const source = event.currentTarget ?? button;
    if (
      source.id === 'settings-fullscreen' ||
      (!doc.fullscreenElement && (!supported() || standalone()))
    ) {
      help(source);
      return;
    }
    try {
      if (doc.fullscreenElement) await doc.exitFullscreen();
      else await doc.documentElement.requestFullscreen({ navigationUI: 'hide' });
      if (dialog?.open) dialog.close();
    } catch {
      help(source, true);
    }
    sync();
  };
  for (const control of buttons) control.addEventListener('click', click);
  doc.addEventListener('fullscreenchange', sync);
  displayMode?.addEventListener('change', sync);
  sync();
  return () => {
    for (const control of buttons) control.removeEventListener('click', click);
    doc.removeEventListener('fullscreenchange', sync);
    displayMode?.removeEventListener('change', sync);
  };
}
