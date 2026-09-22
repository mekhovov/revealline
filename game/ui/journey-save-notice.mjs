/** Presentation only. The Journey store and existing recovery handlers keep
 * ownership of saving/export; a warning never pauses, focuses or starts play. */
export function attachJourneySaveNotice({ document: doc = globalThis.document } = {}) {
  const $ = (id) => doc.getElementById(id);
  const menu = $('shell-menu'),
    recovery = $('journey-save-status'),
    message = $('journey-save-message'),
    action = $('journey-save-options'),
    badge = $('journey-save-badge'),
    announcement = $('journey-save-announcement');
  const menuLabel = menu.getAttribute('aria-label');
  const text = (node, value) => {
    if (node.textContent !== value) node.textContent = value;
  };
  action.onclick = () => {
    // Use the shell's existing explicit pause/input path, not another modal.
    menu.click();
    if ($('shell-home').open && !recovery.hidden) {
      $('journey-save-retry').focus();
    }
  };
  return {
    update({ ready, durable, error }) {
      const unsaved = !!(ready && !durable && error);
      badge.hidden = action.hidden = !unsaved;
      menu.dataset.journeyUnsaved = String(unsaved);
      menu.setAttribute(
        'aria-label',
        unsaved ? `${menuLabel} — Journey progress not saved. Save options.` : menuLabel,
      );
      text(
        announcement,
        unsaved ? 'Journey progress is not saved. Save options are in Game menu.' : '',
      );
      // Do not remove the currently focused Retry/Export controls on success.
      // The panel can disappear on the next status update after focus leaves it.
      recovery.hidden = !unsaved && !recovery.contains(doc.activeElement);
      text(
        message,
        unsaved
          ? `Journey progress is session-only. Keep playing, retry saving, or export before closing. ${error}`
          : ready && durable
            ? 'Journey progress saved locally. You can continue playing.'
            : '',
      );
    },
  };
}
