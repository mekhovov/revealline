import {
  ARTWORK_COLLECTION_LIMITS,
  exportArtworkCollection,
  importArtworkCollection,
  validateArtworkCollection,
  verifyArtworkCollection,
} from './artwork-collection.mjs';
import { createStudioDownload } from './download.mjs';
import { prepareArtworkDerivative } from './artwork-derivative.mjs';
import { t, localizedText, localizedAttribute, formatNumber } from '../../game/i18n/index.mjs';

const copy = (key, values) => t(`tools:studio.artwork.${key}`, values);
const failure = (key) => Object.assign(new Error(copy(key)), { artworkMessage: key });
const errorText = (error) => (error.artworkMessage ? copy(error.artworkMessage) : error.message);

/** Independent authoring draft. Only a fully verified, still-owned operation
 * may replace it; failed/stale imports leave the accepted collection intact. */
export function createArtworkCollectionDraft() {
  let accepted = null,
    operation = null,
    generation = 0,
    disposed = false;
  function cancel() {
    generation++;
    operation?.abort();
    operation = null;
  }
  return Object.freeze({
    get current() {
      return accepted;
    },
    async load(prepare) {
      if (disposed) throw failure('closed');
      cancel();
      const token = generation,
        controller = new AbortController();
      operation = controller;
      try {
        const next = await prepare(controller.signal);
        if (disposed || token !== generation || controller.signal.aborted) return null;
        accepted = next;
        return next;
      } catch (error) {
        if (disposed || token !== generation || controller.signal.aborted) return null;
        throw error;
      } finally {
        if (operation === controller) operation = null;
      }
    },
    setTreatment(treatment) {
      if (disposed || !accepted) return null;
      if (treatment === accepted.document.treatment) return accepted;
      const document = validateArtworkCollection({
        ...accepted.document,
        revision: accepted.document.revision + 1,
        treatment,
      });
      cancel();
      accepted = Object.freeze({ document, assets: accepted.assets });
      return accepted;
    },
    cancel,
    dispose() {
      cancel();
      disposed = true;
      accepted = null;
    },
  });
}

/** Mounted inside Asset Studio; neither this packet nor its declarations enter
 * the saved .rltheme workspace, runtime bindings or approval history. */
export function mountArtworkCollectionPanel({
  document,
  window,
  urls = URL,
  prepareDerivative = prepareArtworkDerivative,
}) {
  const $ = (id) => document.getElementById(id),
    draft = createArtworkCollectionDraft();
  const picker = $('artwork-files'),
    selector = $('artwork-item'),
    treatment = $('artwork-treatment');
  const preview = $('artwork-preview'),
    details = $('artwork-provenance'),
    status = $('artwork-status');
  const download = createStudioDownload({ document, target: $('artwork-download'), urls });
  $('artwork-board').value = 'wide';
  $('artwork-fit').value = 'contain';
  let disposed = false,
    suspended = false,
    request = 0,
    previewURL = null,
    pendingImage = null;
  const message = (key, values = {}) => {
    if (!disposed)
      localizedText(status, () => copy(key, typeof values === 'function' ? values() : values));
  };
  status.removeAttribute?.('data-i18n');
  message('choosePacket');
  function clearPreview() {
    if (pendingImage) {
      pendingImage.onload = pendingImage.onerror = null;
      pendingImage.removeAttribute('src');
    }
    pendingImage = null;
    preview.replaceChildren();
    if (previewURL) urls.revokeObjectURL(previewURL);
    previewURL = null;
  }
  function busy(value) {
    $('artwork-cancel').disabled = !value;
    $('artwork-export').disabled = value || !draft.current || suspended;
    $('artwork-preview-source').disabled = value || !draft.current || suspended;
    treatment.disabled = selector.disabled = value || !draft.current || suspended;
    $('artwork-board').disabled = $('artwork-fit').disabled = value || !draft.current || suspended;
    $('artwork-prepare').disabled =
      value ||
      suspended ||
      !draft.current?.document.artworks.some(
        (artwork) => artwork.id === selector.value && artwork.role === 'reveal',
      );
    status.setAttribute('aria-busy', String(value));
  }
  function showSources(artwork, collection) {
    details.replaceChildren();
    const add = (key, values) => {
      const p = document.createElement('p');
      localizedText(p, () => copy(key, typeof values === 'function' ? values() : values));
      details.append(p);
    };
    add('collectionFacts', {
      name: collection.name,
      revision: collection.revision,
      treatment: collection.treatment,
    });
    add('fileFacts', () => ({
      ...artwork.file,
      bytes: formatNumber(artwork.file.bytes),
      medium: artwork.medium,
      role: artwork.role,
    }));
    add('creatorFacts', {
      creator: artwork.provenance.creator,
      origin: artwork.provenance.origin,
      ...artwork.provenance.license,
    });
    if (artwork.provenance.derivative) add('derivativeFacts', artwork.provenance.derivative);
    for (const id of artwork.provenance.sourceIds) {
      const source = collection.sources.find((entry) => entry.id === id);
      const p = document.createElement('p'),
        caption = document.createElement('span'),
        link = document.createElement('a');
      localizedText(caption, () =>
        copy('sourceFacts', {
          use: copy(source.use === 'reference-only' ? 'referenceOnly' : 'incorporated'),
          creator: source.creator,
          ...source.license,
        }),
      );
      link.textContent = source.source;
      link.href = source.source;
      link.target = '_blank';
      link.rel = 'noreferrer noopener';
      p.append(caption, link);
      details.append(p);
    }
    if (artwork.provenance.prompt) {
      const section = document.createElement('details'),
        summary = document.createElement('summary'),
        prompt = document.createElement('p');
      localizedText(summary, () => copy('prompt'));
      prompt.textContent = artwork.provenance.prompt;
      section.append(summary, prompt);
      details.append(section);
    }
  }
  function showSelected() {
    if (!draft.current || disposed || suspended) return;
    const collection = draft.current.document;
    const artwork =
      collection.artworks.find((entry) => entry.id === selector.value) ?? collection.artworks[0];
    clearPreview();
    showSources(artwork, collection);
    const shownAt = request;
    const image = document.createElement('img'),
      url = urls.createObjectURL(draft.current.assets.get(artwork.file.name));
    previewURL = url;
    pendingImage = image;
    localizedAttribute(image, 'alt', () =>
      copy('imageAlt', { id: artwork.id, medium: artwork.medium }),
    );
    image.dataset.medium = artwork.medium;
    image.onload = () => {
      if (disposed || suspended || pendingImage !== image || shownAt !== request) return;
      message('previewReady');
    };
    image.onerror = () => {
      if (pendingImage === image) {
        clearPreview();
        if (!disposed && !suspended && shownAt === request) message('displayFailed');
      }
    };
    image.src = url;
    preview.append(image);
  }
  function acceptedView(selectedId = null) {
    const collection = draft.current.document;
    selector.replaceChildren(
      ...collection.artworks.map((artwork) => {
        const option = document.createElement('option');
        option.value = artwork.id;
        option.textContent = artwork.id;
        return option;
      }),
    );
    selector.value = collection.artworks.some((artwork) => artwork.id === selectedId)
      ? selectedId
      : collection.artworks[0].id;
    treatment.value = collection.treatment;
    showSelected();
  }
  picker.onchange = async () => {
    const files = [...picker.files];
    picker.value = '';
    if (!files.length || disposed || suspended) return;
    const ticket = ++request;
    busy(true);
    message('verifying');
    try {
      const result = await draft.load(async (signal) => {
        if (files.length === 1 && files[0].name.endsWith('.rlart'))
          return importArtworkCollection(files[0], { signal });
        if (files.length > ARTWORK_COLLECTION_LIMITS.artworks + 1) throw failure('selectBounded');
        const metadata = files.filter((file) => file.name.endsWith('.json'));
        if (metadata.length !== 1 || metadata[0].size > ARTWORK_COLLECTION_LIMITS.metadataBytes)
          throw failure('selectTogether');
        const assets = new Map();
        for (const file of files.filter((file) => file !== metadata[0])) {
          if (assets.has(file.name)) throw failure('duplicateNames');
          assets.set(file.name, file);
        }
        const source = await metadata[0].text();
        signal.throwIfAborted();
        return verifyArtworkCollection(source, assets, { signal });
      });
      if (result && ticket === request && !suspended && !disposed) {
        download.dispose();
        acceptedView();
      }
    } catch (error) {
      if (ticket === request) message('importFailed', () => ({ message: errorText(error) }));
    } finally {
      if (ticket === request && !disposed) busy(false);
    }
  };
  selector.onchange = () => {
    showSelected();
    busy(false);
  };
  $('artwork-preview-source').onclick = showSelected;
  treatment.onchange = () => {
    try {
      draft.setTreatment(treatment.value);
      download.dispose();
      acceptedView(selector.value);
    } catch (error) {
      treatment.value = draft.current.document.treatment;
      message('changeFailed', () => ({ message: errorText(error) }));
    }
  };
  $('artwork-export').onclick = async () => {
    const current = draft.current;
    if (!current || disposed || suspended) return;
    const ticket = ++request;
    busy(true);
    message('exporting');
    try {
      // Reuse the operation owner, without replacing the accepted document.
      await draft.load(async (signal) => {
        const blob = await exportArtworkCollection(current.document, current.assets, { signal });
        signal.throwIfAborted();
        if (ticket === request && !disposed && !suspended) {
          download.offer(blob, `${current.document.id}-r${current.document.revision}.rlart`);
          message('exportReady');
        }
        return current;
      });
    } catch (error) {
      if (ticket === request) message('exportFailed', () => ({ message: errorText(error) }));
    } finally {
      if (ticket === request && !disposed) busy(false);
    }
  };
  $('artwork-prepare').onclick = async () => {
    const current = draft.current;
    if (!current || disposed || suspended) return;
    const parentId = selector.value;
    const options = { board: $('artwork-board').value, fit: $('artwork-fit').value };
    const ticket = ++request;
    busy(true);
    message('preparingBoard');
    try {
      const result = await draft.load((signal) =>
        prepareDerivative(current, parentId, options, { signal }),
      );
      if (result && ticket === request && !disposed && !suspended) {
        download.dispose();
        acceptedView(result.document.artworks.at(-1).id);
        message('boardReady');
      }
    } catch (error) {
      if (ticket === request) message('changeFailed', () => ({ message: errorText(error) }));
    } finally {
      if (ticket === request && !disposed) busy(false);
    }
  };
  $('artwork-cancel').onclick = () => {
    request++;
    draft.cancel();
    busy(false);
    message('cancelled');
  };
  function hide(event) {
    request++;
    suspended = true;
    draft.cancel();
    clearPreview();
    download.dispose();
    busy(false);
    if (!event.persisted) dispose();
  }
  function show(event) {
    if (!event.persisted || disposed) return;
    suspended = false;
    busy(false);
    message('returned');
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    request++;
    draft.dispose();
    clearPreview();
    download.dispose();
    for (const id of ['artwork-files', 'artwork-item', 'artwork-treatment']) $(id).onchange = null;
    for (const id of [
      'artwork-export',
      'artwork-cancel',
      'artwork-preview-source',
      'artwork-prepare',
    ])
      $(id).onclick = null;
    window.removeEventListener('pagehide', hide);
    window.removeEventListener('pageshow', show);
  }
  window.addEventListener('pagehide', hide);
  window.addEventListener('pageshow', show);
  busy(false);
  return Object.freeze({ dispose });
}
