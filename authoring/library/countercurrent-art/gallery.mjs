import { mountAuthoringReference } from '../../../game/ui/authoring-reference.mjs';
import { mountRevealAuditViewer } from '../../design-atlas/reveal-audit-viewer.mjs';
import { COUNTERCURRENT_SOURCES } from './sources.mjs';

const owners = new WeakMap();

/** Read-only original inspection. The existing reference host owns all input;
 * these bindings never navigate, install artwork or write an adoption decision. */
export function mountCountercurrentGallery({
  document: doc = globalThis.document,
  window: win = doc.defaultView,
} = {}) {
  if (owners.has(doc)) return owners.get(doc);
  const host = mountAuthoringReference({ document: doc, window: win });
  const viewer = mountRevealAuditViewer({
    document: doc,
    window: win,
    navigation: host.navigation,
    sources: COUNTERCURRENT_SOURCES,
  });
  const cleanups = [];
  for (const source of COUNTERCURRENT_SOURCES) {
    const path = source.path.slice('authoring/library/countercurrent-art/'.length);
    for (const link of doc.querySelectorAll(`[data-countercurrent-source="${source.id}"]`)) {
      // Only the declared static source links acquire an owned viewer. A changed
      // attribute must not silently bind an unrelated destination to this pin.
      if (link.getAttribute('href') !== path) continue;
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

if (globalThis.document?.querySelector('[data-countercurrent-source]'))
  mountCountercurrentGallery();
