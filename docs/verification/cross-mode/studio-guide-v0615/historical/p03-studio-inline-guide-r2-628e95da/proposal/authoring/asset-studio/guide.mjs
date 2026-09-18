// A passive disclosure: no workspace, operation, storage or preview ownership.
export function mountStudioGuide({ document }) {
  const guide = document.getElementById('studio-guide');
  const summary = document.getElementById('studio-guide-open');
  const close = document.getElementById('studio-guide-close');
  let disposed = false;
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
    event.preventDefault();
    event.stopPropagation();
    collapse();
  };
  guide.addEventListener('keydown', keydown);
  close.onclick = collapse;
  close.hidden = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      guide.removeEventListener('keydown', keydown);
      close.onclick = null;
      close.hidden = true;
    },
  };
}
