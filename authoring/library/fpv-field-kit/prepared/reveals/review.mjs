import { localizedText, localizedAttribute } from '../../../../../game/i18n/index.mjs';
import { authoringLabel, authoringText } from '../../../../../game/ui/authoring-copy.mjs';
import { setMenuIcon } from '../../../../../game/ui/native-menu-icons.mjs';
import { mountAuthoringReference } from '../../../../../game/ui/authoring-reference.mjs';
import { mountRevealAuditViewer } from '../../../../design-atlas/reveal-audit-viewer.mjs';
import { mountPreparedRevealManifestViewer } from './review-manifest-viewer.mjs';
import { attachPreparedRevealReaders } from './review-readers.mjs';
import { reviewText } from './review-copy.mjs';
import { PREPARED_REVEAL_GUIDE, PREPARED_REVEAL_ORIGINALS } from './review-sources.mjs';
import {
  revealReviewURLs,
  readPreparedRevealManifest,
  validatePreparedRevealManifest,
  loadPreparedRevealImage,
} from './review-model.mjs';
export { revealReviewURLs } from './review-model.mjs';

const owners = new WeakMap();

/** Historical read-only review. All navigation remains on the shared reference
 * owner; only a complete verified inventory can replace retained specimens. */
export function mountPreparedRevealReview({
  document: doc = globalThis.document,
  window: win = doc.defaultView,
  readManifest = (options) => readPreparedRevealManifest({ ...options, window: win }),
  loadImage = (asset, options) =>
    loadPreparedRevealImage(asset, { ...options, window: win, pageURL: win.location.href }),
  autoStart = true,
} = {}) {
  if (owners.has(doc)) return owners.get(doc);
  const host = mountAuthoringReference({ document: doc, window: win }),
    viewer = mountRevealAuditViewer({
      document: doc,
      window: win,
      navigation: host.navigation,
      sources: [PREPARED_REVEAL_GUIDE, ...PREPARED_REVEAL_ORIGINALS],
    }),
    manifestViewer = mountPreparedRevealManifestViewer({
      document: doc,
      window: win,
      navigation: host.navigation,
    });
  const status = doc.getElementById('status'),
    retry = doc.getElementById('prepared-reveal-retry'),
    cancelButton = doc.getElementById('prepared-reveal-cancel'),
    inventory = doc.getElementById('inventory'),
    removers = [],
    cards = new Map();
  let disposed = false,
    suspended = false,
    generation = 0,
    operation = null,
    ready = Promise.resolve(),
    retained = [],
    staging = null,
    timeout = null,
    readers = null;
  const listen = (node, event, fn) => {
    node.addEventListener(event, fn);
    removers.push(() => node.removeEventListener(event, fn));
  };
  const foreground = () => !suspended && !doc.hidden && doc.hasFocus?.() !== false;
  const modal = () => !!doc.querySelector('dialog[open]');
  const make = (tag, id, className) => {
    const node = doc.createElement(tag);
    if (id) node.id = id;
    if (className) node.className = className;
    return node;
  };
  const label = (node, key, values = {}) => localizedText(node, () => reviewText(key, values));
  for (const node of doc.querySelectorAll('[data-review-copy]'))
    label(node, node.dataset.reviewCopy);
  function readButton(id, name) {
    const button = make('button', id, 'prepared-reader');
    button.type = 'button';
    authoringLabel(button, 'readPage');
    localizedAttribute(button, 'aria-label', () => `${authoringText('readPage')}: ${name()}`);
    setMenuIcon(button, 'content');
    return button;
  }
  const regionLabel = (region, name) => {
    region.setAttribute('role', 'region');
    localizedAttribute(region, 'aria-label', name);
  };
  function buildCards(data) {
    if (cards.size) return;
    const targets = [];
    for (const asset of data.assets) {
      const id = asset.id,
        article = make('article'),
        heading = make('h2', `prepared-reveal-${id}`),
        specimen = make('div', `prepared-reveal-specimen-${id}`, 'preview'),
        specimenName = () => reviewText('specimen', { id }),
        read = readButton(`prepared-reveal-read-${id}`, specimenName),
        dimensions = make('p', null, 'meta'),
        preparation = make('p', null, 'meta');
      article.dataset.assetId = id;
      heading.textContent = id;
      heading.dataset.authoringTarget = read.id;
      regionLabel(specimen, specimenName);
      label(dimensions, 'dimensions', {
        width: asset.file.width,
        height: asset.file.height,
        bytes: asset.file.bytes,
        owners: asset.slotIds.length,
      });
      label(preparation, 'preparation', {
        width: asset.preparation.logicalWidth,
        height: asset.preparation.logicalHeight,
        scale: asset.preparation.integerScale,
        colors: asset.preparation.usedColors.length,
      });
      article.append(heading, read, specimen, dimensions, preparation);
      const native = make('details', `prepared-reveal-native-details-${id}`),
        summary = make('summary', `prepared-reveal-native-toggle-${id}`),
        nativeName = () => `${reviewText('native')} · ${id}`,
        nativeRead = readButton(`prepared-reveal-native-read-${id}`, nativeName),
        nativeRegion = make('div', `prepared-reveal-native-${id}`, 'native');
      label(summary, 'native');
      regionLabel(nativeRegion, nativeName);
      native.append(summary, nativeRead, nativeRegion);
      article.append(native);
      const urls = revealReviewURLs(asset, win.location.href);
      if (urls.sourceOriginal) {
        const original = make('button', `prepared-reveal-original-${id}`);
        original.type = 'button';
        label(original, 'original');
        setMenuIcon(original, 'content');
        listen(original, 'click', () => viewer.open(`original-${asset.compositionId}`, original));
        article.append(original);
      } else {
        const note = make('p', null, 'meta');
        label(note, 'originalNote');
        article.append(note);
      }
      const provenance = make('details', `prepared-reveal-provenance-details-${id}`),
        provenanceToggle = make('summary', `prepared-reveal-provenance-toggle-${id}`),
        provenanceName = () => `${reviewText('provenance')} · ${id}`,
        provenanceRead = readButton(`prepared-reveal-provenance-read-${id}`, provenanceName),
        provenanceRegion = make('div', `prepared-reveal-provenance-${id}`, 'prepared-provenance'),
        text = make('pre');
      label(provenanceToggle, 'provenance');
      regionLabel(provenanceRegion, provenanceName);
      text.textContent = JSON.stringify(
        {
          compositionId: asset.compositionId,
          source: asset.provenance.source,
          crop: asset.preparation.sourceCrop,
          cropDecision: asset.preparation.cropDecision,
          clippedEdgePixels: asset.preparation.clippedEdgePixels,
          owners: asset.slotIds,
          prompt: asset.provenance.prompt,
        },
        null,
        2,
      );
      provenanceRegion.append(text);
      provenance.append(provenanceToggle, provenanceRead, provenanceRegion);
      article.append(provenance);
      inventory.append(article);
      targets.push(
        { read, region: specimen },
        { read: nativeRead, region: nativeRegion },
        { read: provenanceRead, region: provenanceRegion },
      );
      cards.set(id, { article, specimen, nativeRegion });
    }
    readers = attachPreparedRevealReaders({
      document: doc,
      window: win,
      navigation: host.navigation,
      targets,
    });
  }
  function publish(data, images) {
    buildCards(data);
    data.assets.forEach((asset, index) => {
      const card = cards.get(asset.id),
        image = images[index].image,
        nativeImage = doc.createElement('img');
      localizedAttribute(image, 'alt', () => reviewText('specimen', { id: asset.id }));
      image.width = nativeImage.width = asset.file.width;
      image.height = nativeImage.height = asset.file.height;
      nativeImage.src = image.src;
      localizedAttribute(nativeImage, 'alt', () => `${reviewText('native')} · ${asset.id}`);
      card.specimen.replaceChildren(image);
      card.nativeRegion.replaceChildren(nativeImage);
    });
  }
  const show = (state) => {
    status.dataset.state = state;
    label(status, state);
  };
  const ownsCancel = () => doc.activeElement === cancelButton && foreground() && !modal();
  const clearDeadline = () => {
    if (timeout !== null) win.clearTimeout(timeout);
    timeout = null;
  };
  function releaseStaging() {
    const pending = staging;
    staging = null;
    pending?.splice(0).forEach((item) => item?.dispose());
  }
  function settle(state) {
    const restore = ownsCancel();
    clearDeadline();
    operation?.abort();
    releaseStaging();
    operation = null;
    retry.disabled = false;
    cancelButton.hidden = true;
    show(state);
    if (restore) retry.focus();
  }
  function cancel({ restoreFocus = true } = {}) {
    if (!operation) return;
    const restore = restoreFocus && ownsCancel();
    generation++;
    operation.abort();
    clearDeadline();
    releaseStaging();
    operation = null;
    retry.disabled = false;
    cancelButton.hidden = true;
    show('cancelled');
    if (restore) retry.focus();
  }
  function load() {
    if (disposed) return Promise.resolve();
    cancel({ restoreFocus: false });
    const controller = new AbortController(),
      visit = ++generation;
    operation = controller;
    const current = () =>
      !disposed && operation === controller && visit === generation && !controller.signal.aborted;
    const initiating = doc.activeElement === retry && foreground() && !modal();
    retry.disabled = true;
    cancelButton.hidden = false;
    show('loading');
    if (initiating) cancelButton.focus();
    timeout = win.setTimeout(() => {
      if (current()) settle('error');
    }, 30_000);
    const pending = [];
    staging = pending;
    ready = (async () => {
      try {
        const data = validatePreparedRevealManifest(
          JSON.stringify(await readManifest({ signal: controller.signal })),
        );
        if (!current()) return;
        await Promise.all(
          data.assets.map(async (asset, index) => {
            const image = await loadImage(asset, { signal: controller.signal });
            if (!current()) {
              image.dispose();
              return;
            }
            pending[index] = image;
            if (
              image.image.naturalWidth !== asset.file.width ||
              image.image.naturalHeight !== asset.file.height
            )
              throw new Error('Prepared frame dimensions differ');
          }),
        );
        if (!current()) return;
        if (!foreground() || modal()) {
          cancel({ restoreFocus: false });
          return;
        }
        publish(data, pending);
        retained.forEach((item) => item.dispose());
        retained = pending.splice(0);
        settle('ready');
      } catch {
        if (current()) settle('error');
      } finally {
        pending.splice(0).forEach((item) => item?.dispose());
      }
    })();
    return ready;
  }
  listen(retry, 'click', () => void load());
  listen(cancelButton, 'click', () => cancel());
  const guide = doc.getElementById('prepared-reveal-source-guide'),
    manifest = doc.getElementById('prepared-reveal-source-manifest');
  for (const [link, owner, id] of [
    [guide, viewer, 'guide'],
    [manifest, manifestViewer, 'manifest'],
  ])
    listen(link, 'click', (event) => {
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      owner.open(id, link);
    });
  const interrupt = () => {
    suspended = true;
    cancel({ restoreFocus: false });
  };
  const resume = () => {
    suspended = doc.hidden || doc.hasFocus?.() === false;
  };
  listen(win, 'blur', interrupt);
  listen(win, 'pagehide', interrupt);
  listen(win, 'focus', resume);
  listen(win, 'pageshow', resume);
  listen(doc, 'visibilitychange', () => (doc.hidden ? interrupt() : resume()));
  const observer = new win.MutationObserver(() => {
    if (modal()) cancel({ restoreFocus: false });
  });
  observer.observe(doc.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
  const originalDestroy = host.destroy;
  const destroy = () => {
    if (disposed) return;
    cancel({ restoreFocus: false });
    disposed = true;
    generation++;
    retained.forEach((item) => item.dispose());
    retained = [];
    readers?.destroy();
    viewer.destroy();
    manifestViewer.destroy();
    observer.disconnect();
    removers.forEach((remove) => remove());
    originalDestroy();
    owners.delete(doc);
  };
  const presentation = {
    load,
    cancel,
    destroy,
    get ready() {
      return ready;
    },
  };
  host.presentation = presentation;
  host.load = load;
  host.cancel = cancel;
  Object.defineProperty(host, 'ready', { get: () => ready });
  host.destroy = destroy;
  owners.set(doc, host);
  if (autoStart) load();
  return host;
}
if (globalThis.document?.getElementById('prepared-reveal-retry')) mountPreparedRevealReview();
