import { mountAuthoringReference } from '../../../game/ui/authoring-reference.mjs';
import { mountRevealAuditViewer } from '../../design-atlas/reveal-audit-viewer.mjs';
import { FPV_ENEMY_SOURCES } from './sources.mjs';
import { mountFpvEnemyPresentation } from './presentation.mjs';

const owners = new WeakMap();

/** Read-only original inspection. The existing reference host owns all input;
 * these bindings never navigate, install artwork or write an adoption decision. */
export function mountFpvEnemyGallery({
  document: doc = globalThis.document,
  window: win = doc.defaultView,
} = {}) {
  if (owners.has(doc)) return owners.get(doc);
  const presentation = mountFpvEnemyPresentation({ document: doc, window: win, autoStart: false });
  const host = mountAuthoringReference({ document: doc, window: win });
  const viewer = mountRevealAuditViewer({
    document: doc,
    window: win,
    navigation: host.navigation,
    sources: FPV_ENEMY_SOURCES,
  });
  const cleanups = [];
  for (const source of FPV_ENEMY_SOURCES) {
    const path = source.path.slice('authoring/library/fpv-enemy-presentations/'.length);
    for (const link of doc.querySelectorAll(`[data-fpv-enemy-source="${source.id}"]`)) {
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
    presentation.destroy();
    viewer.destroy();
    originalDestroy();
    owners.delete(doc);
  };
  host.presentation = presentation;
  presentation.load();
  owners.set(doc, host);
  return host;
}

if (globalThis.document?.querySelector('[data-fpv-enemy-source]')) mountFpvEnemyGallery();
