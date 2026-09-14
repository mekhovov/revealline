import { applyFieldKitCopy } from './field-kit-copy.mjs';

/** Presentation navigation only. Original host controls own preferences and saves. */
export function attachFieldKitSurfaces({ document: doc = globalThis.document } = {}) {
  applyFieldKitCopy(doc);
  const removers = [];
  const listen = (node, type, handler) => {
    if (!node) return;
    node.addEventListener(type, handler);
    removers.push(() => node.removeEventListener(type, handler));
  };
  const tabs = [
    ...(doc.querySelector('.field-kit-settings-tabs')?.querySelectorAll('[role="tab"]') ?? []),
  ];
  const select = (tab, focus = false) => {
    const capture = doc.getElementById('cancel-key-capture');
    const cancelling =
      tab.id !== 'settings-tab-controls' && capture && !capture.hidden && !capture.disabled;
    if (cancelling) capture.click();
    for (const candidate of tabs) {
      const selected = candidate === tab;
      candidate.setAttribute('aria-selected', String(selected));
      candidate.setAttribute('tabindex', selected ? '0' : '-1');
      const panel = doc.getElementById(candidate.getAttribute('aria-controls'));
      if (panel) panel.hidden = !selected;
    }
    if (focus || cancelling) tab.focus();
  };
  for (const tab of tabs) {
    listen(tab, 'click', () => select(tab));
    listen(tab, 'keydown', (event) => {
      const index = tabs.indexOf(tab);
      const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      const next =
        event.key === 'Home'
          ? tabs[0]
          : event.key === 'End'
            ? tabs.at(-1)
            : direction
              ? tabs[(index + direction + tabs.length) % tabs.length]
              : null;
      if (!next) return;
      event.preventDefault();
      event.stopPropagation();
      select(next, true);
    });
  }
  const openLibrary = (panel) => {
    // Use the real library entry and section handlers, including its pause and
    // modal return-focus bookkeeping. No library state is recreated here.
    doc.getElementById('library-button')?.click();
    doc.querySelector(`[data-library-panel="${panel}"]`)?.click();
  };
  listen(doc.getElementById('settings-saves'), 'click', () => openLibrary('saves'));
  listen(doc.getElementById('settings-packs'), 'click', () => openLibrary('packs'));
  listen(doc.getElementById('collection-records'), 'click', () => openLibrary('scores'));
  listen(doc.getElementById('library-dialog'), 'close', () => {
    if (
      !doc.getElementById('library-dialog')?.open &&
      doc.getElementById('collection-dialog')?.open
    )
      doc.getElementById('collection-button')?.click();
  });
  for (const control of doc.querySelectorAll('[data-field-kit-text-size]')) {
    listen(control, 'change', () => {
      doc.body.dataset.textSize = control.value === 'large' ? 'large' : 'standard';
    });
  }
  return { destroy: () => removers.forEach((remove) => remove()) };
}

// Supporting tools opt in explicitly. The game calls this from its shell so
// teardown remains part of the existing host lifecycle.
if (globalThis.document?.body?.dataset.fieldKitPage) attachFieldKitSurfaces();
