// A passive disclosure: no workspace, operation, storage or preview ownership.
export function mountStudioGuide({ document }) {
  const guide = document.getElementById('studio-guide');
  const summary = document.getElementById('studio-guide-open');
  const close = document.getElementById('studio-guide-close');
  let disposed = false;
  let escapeCloseHeld = false;
  const foreground = () => !document.hidden && document.hasFocus();
  const available = () =>
    guide.isConnected &&
    summary.parentElement === guide &&
    !summary.closest('[hidden],[inert]') &&
    summary.getClientRects().length > 0;
  const collapse = () => {
    if (disposed || !guide.open) return;
    const before = document.activeElement;
    const owned = guide.contains(before);
    guide.open = false;
    // Native collapse can blur the hidden Close button to body. Preserve a newer
    // focus choice; do not schedule a later return or alter native summary toggling.
    if (
      owned &&
      !disposed &&
      !guide.open &&
      foreground() &&
      available() &&
      [before, document.body].includes(document.activeElement)
    )
      summary.focus();
  };
  const keydown = (event) => {
    if (disposed || !guide.open || event.key !== 'Escape' || !guide.contains(event.target)) return;
    escapeCloseHeld = true;
    event.preventDefault();
    event.stopPropagation();
    collapse();
  };
  const guardRepeat = (event) => {
    if (disposed || event.key !== 'Escape') return;
    // A fresh press also releases a missed keyup. Only repeats of the press
    // that closed this guide stay owned, even if focus has since moved away.
    if (!event.repeat) {
      escapeCloseHeld = false;
      return;
    }
    if (!escapeCloseHeld) return;
    event.preventDefault();
    event.stopPropagation();
  };
  const releaseKey = (event) => {
    if (event.key === 'Escape') escapeCloseHeld = false;
  };
  document.addEventListener('keydown', guardRepeat, true);
  document.addEventListener('keyup', releaseKey, true);
  guide.addEventListener('keydown', keydown);
  close.onclick = collapse;
  close.hidden = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      escapeCloseHeld = false;
      document.removeEventListener('keydown', guardRepeat, true);
      document.removeEventListener('keyup', releaseKey, true);
      guide.removeEventListener('keydown', keydown);
      close.onclick = null;
      close.hidden = true;
    },
  };
}
