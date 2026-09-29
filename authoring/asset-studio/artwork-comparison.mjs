import { required } from '../../game/data-json.mjs';
import { validateArtworkCollection } from './artwork-collection.mjs';

/** Resolve only the packet's explicit relation; names and media imply nothing. */
export function artworkComparisonPair(input, selectedId) {
  const collection = validateArtworkCollection(input);
  const selected = collection.artworks.find((artwork) => artwork.id === selectedId);
  required(selected, 'Select retained artwork.');
  const parentId = selected.provenance.derivative?.parent;
  return Object.freeze({
    collection,
    selected,
    parent: parentId ? collection.artworks.find((artwork) => artwork.id === parentId) : null,
  });
}

/** One optional display decode from the already verified draft. No fetch,
 * conversion, animation, saved selection, or collection mutation. */
export function createArtworkParentPreview({
  document,
  preview,
  urls = URL,
  onState = () => {},
  schedule = setTimeout,
  cancel = clearTimeout,
}) {
  let disposed = false,
    pending = null,
    displayed = null;
  const release = (entry) => {
    if (!entry) return;
    cancel(entry.timer);
    entry.image.onload = entry.image.onerror = null;
    entry.image.removeAttribute('src');
    urls.revokeObjectURL(entry.url);
  };
  function cancelPending() {
    if (!pending) return false;
    const old = pending;
    pending = null;
    release(old);
    old.resolve(false);
    return true;
  }
  function clear() {
    cancelPending();
    release(displayed);
    displayed = null;
    preview.replaceChildren();
  }
  return Object.freeze({
    cancel() {
      if (cancelPending() && !disposed) onState('cancelled');
    },
    clear,
    show(current, selectedId) {
      if (disposed) return Promise.resolve(false);
      clear();
      let pair;
      try {
        pair = artworkComparisonPair(current.document, selectedId);
        if (!pair.parent) {
          onState('noParent', pair);
          return Promise.resolve(false);
        }
        const blob = current.assets.get(pair.parent.file.name);
        required(
          blob instanceof Blob && blob.size === pair.parent.file.bytes,
          'Missing parent bytes.',
        );
        const owned = Blob.prototype.slice.call(blob, 0, blob.size, pair.parent.file.mime);
        const image = document.createElement('img');
        image.dataset.medium = pair.parent.medium;
        image.width = pair.parent.file.width;
        image.height = pair.parent.file.height;
        const url = urls.createObjectURL(owned);
        return new Promise((resolve) => {
          const entry = { image, url, resolve, timer: null };
          pending = entry;
          const finish = (error) => {
            if (disposed || pending !== entry) return;
            pending = null;
            cancel(entry.timer);
            image.onload = image.onerror = null;
            if (error) {
              release(entry);
              onState('failed', pair);
              resolve(false);
            } else {
              displayed = entry;
              preview.replaceChildren(image);
              onState('ready', pair, image);
              resolve(true);
            }
          };
          entry.timer = schedule(() => finish(new Error('Parent preview timed out.')), 15000);
          image.onerror = () => finish(new Error('Parent preview failed.'));
          image.onload = async () => {
            try {
              await image.decode?.();
              if (disposed || pending !== entry) return;
              required(
                image.naturalWidth === pair.parent.file.width &&
                  image.naturalHeight === pair.parent.file.height,
                'Parent dimensions differ.',
              );
              finish();
            } catch (error) {
              finish(error);
            }
          };
          onState('loading', pair);
          try {
            image.src = url;
          } catch (error) {
            finish(error);
          }
        });
      } catch {
        onState('failed', pair);
        return Promise.resolve(false);
      }
    },
    dispose() {
      disposed = true;
      clear();
    },
  });
}
