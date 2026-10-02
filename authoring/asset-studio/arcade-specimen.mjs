import { localizedText, t } from '../../game/i18n/index.mjs';
import { createPresentationHost } from '../../game/presentation/host.mjs';
import {
  createArcadeAdapter,
  getArcadeCollection,
} from '../../game/presentation/industrial-arcade.mjs';
import { getThemeFamily } from '../../game/presentation/theme-system.mjs';
import { createCoopPainter } from '../../game/couch/coop-view.mjs';
import { createCoop } from '../../game/coop/core.mjs';
import { RELAY_YARD } from '../../game/coop/relay-yard.mjs';
import { compileStudioRuntime } from '../../game/presentation/runtime-transfer.mjs';

/** The regular host validates/decodes the selected workspace's exact files.
 * No network or published-release substitution belongs in this preview lease. */
export function createWorkspaceSpecimenHost({ source, assets, document, ...hostOptions }) {
  const manifest = compileStudioRuntime(source);
  const baseURL = new URL('./workspace-preview/', document.baseURI);
  const files = new Map([
    ['runtime.json', new Blob([JSON.stringify(manifest)], { type: 'application/json' })],
  ]);
  for (const asset of Object.values(manifest.resolved.assets)) {
    if (!asset.file) continue;
    const blob = assets.get(asset.file.sha256);
    if (!blob) throw new Error(`Workspace preview asset unavailable: ${asset.id}`);
    files.set(manifest.urls[asset.file.sha256].slice(2), blob);
  }
  return createPresentationHost({
    ...hostOptions,
    document,
    baseURL,
    skipTitleArtwork: true,
    fetch: async (address, { signal } = {}) => {
      signal?.throwIfAborted();
      const url = new URL(address);
      const relative =
        url.origin === baseURL.origin && url.pathname.startsWith(baseURL.pathname)
          ? url.pathname.slice(baseURL.pathname.length)
          : '';
      const blob = !url.search && !url.hash && files.get(relative);
      if (!blob) return new Response(null, { status: 404 });
      return new Response(blob, {
        headers: { 'content-length': String(blob.size), 'content-type': blob.type },
      });
    },
  });
}

/** Both boards use the actual Team painter, same initial run and candidate
 * snapshot. This review never writes player preferences or published assets. */
export function mountArcadeSpecimen({
  document,
  target,
  source,
  assets,
  interfacePresentation,
  familyId = 'industrial-workshop',
}) {
  let closed = false,
    host;
  const adapter = createArcadeAdapter(),
    painters = [],
    family = getThemeFamily(familyId),
    collection = family?.arcade
      ? getArcadeCollection(family.arcade.id, family.arcade.revision)
      : null;
  const copy = (key, values) => t(`tools:studio.themes.${key}`, values);
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  localizedText(status, () => copy('arcadeLoading'));
  const content = document.createElement('div');
  content.className = 'arcade-specimen';
  target.replaceChildren(status, content);
  void Promise.resolve()
    .then(() => {
      if (closed) return null;
      host = createWorkspaceSpecimenHost({ source, assets, document });
      return host.load();
    })
    .then((snapshot) => {
      if (closed) return;
      const run = createCoop(RELAY_YARD);
      for (const industrial of [false, true]) {
        const figure = document.createElement('figure'),
          caption = document.createElement('figcaption'),
          canvas = document.createElement('canvas');
        localizedText(caption, () => (industrial ? family.name : copy('arcadeAuthored')));
        canvas.width = 1152;
        canvas.height = 576;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute(
          'aria-label',
          copy(industrial ? 'arcadeIndustrialBoard' : 'arcadeAuthoredBoard'),
        );
        figure.append(caption, canvas);
        content.append(figure);
        const painter = createCoopPainter(canvas);
        painters.push(painter);
        if (interfacePresentation) painter.setInterfaceProvider(() => interfacePresentation);
        painter.setPresentation(snapshot);
        if (industrial) {
          painter.setArcadeProvider(() => ({
            familyId,
            arcadeArt: 'follow-game',
          }));
          painter.captureArcadeCollection(run);
        }
        painter.paint(run, { reduced: true });
      }
      const derived = adapter.resolve(snapshot, collection),
        roster = document.createElement('div');
      roster.className = 'arcade-specimen-roster';
      let count = 0;
      for (const slot of collection?.roles ?? []) {
        const original = snapshot.image(slot),
          industrial = derived.image(slot);
        if (!original || original === industrial) continue;
        count++;
        const figure = document.createElement('figure'),
          caption = document.createElement('figcaption'),
          canvas = document.createElement('canvas');
        caption.textContent = slot;
        canvas.width = 144;
        canvas.height = 72;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', slot);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        for (const [index, frame] of [original, industrial].entries()) {
          const width = frame.image.naturalWidth ?? frame.image.width,
            height = frame.image.naturalHeight ?? frame.image.height,
            scale = Math.max(1, Math.floor(64 / Math.max(width, height)));
          ctx.drawImage(
            frame.image,
            index * 72 + (72 - width * scale) / 2,
            (72 - height * scale) / 2,
            width * scale,
            height * scale,
          );
        }
        figure.append(canvas, caption);
        roster.append(figure);
      }
      content.append(roster);
      localizedText(
        status,
        () => `${copy('arcadeReady', { count })} · ${manifestLabel(snapshot.resolved)}`,
      );
    })
    .catch((error) => {
      if (!closed) status.textContent = error.message;
    });
  return () => {
    closed = true;
    for (const painter of painters) painter.dispose();
    adapter.clear();
    host?.close();
    target.replaceChildren();
  };
}

function manifestLabel(resolved) {
  return `${resolved.theme.name} · ${resolved.theme.id}@${resolved.theme.revision}`;
}
