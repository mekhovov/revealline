import { t } from '../../../game/i18n/index.mjs';
import { mountAuthoringReference } from '../../../game/ui/authoring-reference.mjs';
import { mountRevealAuditViewer } from '../../design-atlas/reveal-audit-viewer.mjs';
import { mountReservePresentation } from './presentation.mjs';
import { RESERVE_MANIFEST, RESERVE_README } from './sources.mjs';

const owners = new WeakMap();
export function mountReserveCatalog({
  document: doc = globalThis.document,
  window: win = doc.defaultView,
  ...options
} = {}) {
  if (owners.has(doc)) return owners.get(doc);
  const host = mountAuthoringReference({ document: doc, window: win });
  const staticSources = [RESERVE_MANIFEST, RESERVE_README].map((file) => ({
    ...file,
    id: file.path,
    title: () => t('tools:reserveCatalog.' + file.id),
  }));
  let viewer = mountRevealAuditViewer({
    document: doc,
    window: win,
    navigation: host.navigation,
    sources: staticSources,
  });
  let installed = false;
  const presentation = mountReservePresentation({
    document: doc,
    window: win,
    ...options,
    autoStart: false,
    onManifest(manifest) {
      if (installed) return;
      const descriptors = new Map();
      const text = (file, key) =>
        descriptors.set(file.path, {
          ...file,
          id: file.path,
          kind: 'text',
          title: () => t('tools:reserveCatalog.' + key) + ' · ' + file.path.split('/').at(-1),
        });
      text(RESERVE_MANIFEST, 'manifest');
      text(RESERVE_README, 'readme');
      for (const entry of manifest.entries) {
        descriptors.set(entry.original.path, {
          ...entry.original,
          id: entry.original.path,
          kind: 'image',
          width: entry.width,
          height: entry.height,
          title: entry.title,
        });
        entry.prompts.forEach((pin, index) => text(pin, index ? 'cleanup' : 'prompt'));
        text(entry.provenance, 'provenance');
        text(entry.notes, 'notes');
      }
      viewer.destroy();
      viewer = mountRevealAuditViewer({
        document: doc,
        window: win,
        navigation: host.navigation,
        sources: [...descriptors.values()],
      });
      installed = true;
    },
  });
  const bindings = [
    ['image-read', () => presentation.current?.original],
    ['prompt', () => presentation.current?.prompts[0]],
    ['cleanup', () => presentation.current?.prompts[1]],
    ['provenance', () => presentation.current?.provenance],
    ['notes', () => presentation.current?.notes],
    ['catalog-manifest', () => RESERVE_MANIFEST],
    ['catalog-readme', () => RESERVE_README],
  ];
  const cleanup = bindings.map(([id, pin]) => {
    const node = doc.getElementById(id);
    const click = (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const source = pin();
      if (source && viewer) viewer.open(source.path, node);
    };
    node.addEventListener('click', click);
    return () => node.removeEventListener('click', click);
  });
  const originalDestroy = host.destroy;
  host.destroy = () => {
    presentation.destroy();
    viewer?.destroy();
    cleanup.forEach((fn) => fn());
    originalDestroy();
    owners.delete(doc);
  };
  host.presentation = presentation;
  owners.set(doc, host);
  presentation.load();
  return host;
}
if (globalThis.document?.getElementById('reserve-retry')) {
  globalThis.RevealLineToolLaunch?.attached();
  mountReserveCatalog();
}
