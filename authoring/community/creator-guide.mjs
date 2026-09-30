import { mountAuthoringReference } from '../../game/ui/authoring-reference.mjs';
import { authoringLabel, authoringText } from '../../game/ui/authoring-copy.mjs';
import { localizedAttribute, localizedText, t } from '../../game/i18n/index.mjs';
import { setMenuIcon } from '../../game/ui/native-menu-icons.mjs';

const owners = new WeakMap();

/** The guide adds section destinations to the existing reference/input owner.
 * Links, downloads and the whole-page reader keep their existing contracts. */
export function mountCreatorGuide({
  document: doc = globalThis.document,
  window: win = doc.defaultView,
} = {}) {
  if (owners.has(doc)) return owners.get(doc);
  const host = mountAuthoringReference({ document: doc, window: win });
  const cleanups = [];
  for (const heading of doc.querySelectorAll('main h2[data-authoring-target]')) {
    const id = heading.id,
      entry = doc.getElementById(`creator-guide-read-${id}`),
      done = doc.getElementById(`creator-guide-read-${id}-done`),
      region = doc.getElementById(`creator-guide-${id}-region`),
      contents = doc.getElementById(`creator-guide-contents-${id}`);
    if (!entry || !done || !region) continue;
    // Resolve the established key directly: static DOM translation can run after
    // this module's locale callbacks, without leaving derived names a locale late.
    const label = () =>
      heading.dataset.i18n ? t(heading.dataset.i18n) : heading.textContent.trim();
    authoringLabel(entry, 'readPage');
    authoringLabel(done, 'back');
    localizedAttribute(entry, 'aria-label', () => `${authoringText('readPage')}: ${label()}`);
    setMenuIcon(entry, 'content');
    setMenuIcon(done, 'back');
    const refresh = () => {
      const active = host.navigation.readingState()?.regionId === region.id;
      entry.setAttribute('aria-pressed', String(active));
      done.disabled = !active;
      // A closed reader must not add an unsupported generic tabindex stop to
      // native Tab navigation. beginReading deliberately focuses it when owned.
      region.tabIndex = active ? 0 : -1;
    };
    entry.onclick = () => {
      region.tabIndex = 0;
      host.navigation.beginReading({
        region,
        origin: entry,
        label: label(),
        getLabel: label,
        exit: done,
      });
      refresh();
    };
    done.onclick = () => {
      host.navigation.endReading();
      refresh();
    };
    if (contents)
      contents.onclick = (event) => {
        event.preventDefault();
        if (doc.hidden || doc.hasFocus?.() === false || doc.querySelector('dialog[open]')) return;
        host.navigation.endReading({ restoreFocus: false });
        entry.focus();
        entry.scrollIntoView({ block: 'nearest' });
        refresh();
      };
    const observer = new win.MutationObserver(refresh);
    observer.observe(region, { attributes: true, attributeFilter: ['data-controller-reading'] });
    refresh();
    cleanups.push(() => {
      observer.disconnect();
      entry.onclick = done.onclick = null;
      if (contents) contents.onclick = null;
      entry.setAttribute('aria-pressed', 'false');
      done.disabled = true;
      region.tabIndex = -1;
    });
  }
  const rail = doc.querySelector('.authoring-reference-rail'),
    returnLink = rail?.querySelector('a');
  if (returnLink) {
    returnLink.id = 'creator-guide-return';
    if (returnLink.href === new URL('../../game/studio/', win.location.href).href)
      localizedText(returnLink, () => t('tools:contentStudio'));
  }
  const originalDestroy = host.destroy;
  let disposed = false;
  host.destroy = () => {
    if (disposed) return;
    disposed = true;
    cleanups.forEach((cleanup) => cleanup());
    originalDestroy();
    owners.delete(doc);
  };
  owners.set(doc, host);
  return host;
}

if (globalThis.document?.querySelector('#creator-guide-automatic-region')) mountCreatorGuide();
