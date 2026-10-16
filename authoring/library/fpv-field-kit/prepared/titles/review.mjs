import {
  attachLanguageControls,
  localizedAttribute,
  localizedText,
} from '../../../../../game/i18n/index.mjs';
import { mountAuthoringReference } from '../../../../../game/ui/authoring-reference.mjs';
import { setMenuIcon } from '../../../../../game/ui/native-menu-icons.mjs';
import { mountRevealAuditViewer } from '../../../../design-atlas/reveal-audit-viewer.mjs';
import { titleReviewText } from './review-copy.mjs';
import { PREPARED_TITLE_SOURCES } from './review-sources.mjs';

const owners = new WeakMap();

/** Historical static comparison. The existing reference host remains the only
 * input owner, and the shared viewer owns verified source loading and return. */
export function mountPreparedTitleReview({
  document: doc = globalThis.document,
  window: win = doc.defaultView,
} = {}) {
  if (owners.has(doc)) return owners.get(doc);
  for (const node of doc.querySelectorAll('[data-title-copy]'))
    localizedText(node, () => titleReviewText(node.dataset.titleCopy));
  for (const node of doc.querySelectorAll('[data-title-alt]'))
    localizedAttribute(node, 'alt', () => titleReviewText(node.dataset.titleAlt));
  attachLanguageControls(doc);
  const host = mountAuthoringReference({ document: doc, window: win });
  const viewer = mountRevealAuditViewer({
    document: doc,
    window: win,
    navigation: host.navigation,
    sources: PREPARED_TITLE_SOURCES,
  });
  const cleanups = [];
  for (const source of PREPARED_TITLE_SOURCES) {
    for (const link of doc.querySelectorAll(`[data-prepared-title-source="${source.id}"]`)) {
      if (link.getAttribute('href') !== source.href) continue;
      setMenuIcon(link, source.kind === 'image' ? 'collection' : 'content');
      if (source.kind === 'image')
        localizedAttribute(
          link,
          'aria-label',
          () => `${titleReviewText('inspect')}: ${source.title()}`,
        );
      const open = (event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        viewer.open(source.id, link);
      };
      link.addEventListener('click', open);
      cleanups.push(() => link.removeEventListener('click', open));
    }
  }
  const originalDestroy = host.destroy;
  let disposed = false;
  host.destroy = () => {
    if (disposed) return;
    disposed = true;
    cleanups.forEach((cleanup) => cleanup());
    viewer.destroy();
    originalDestroy();
    owners.delete(doc);
  };
  owners.set(doc, host);
  return host;
}

if (globalThis.document?.querySelector('[data-prepared-title-source]')) mountPreparedTitleReview();
