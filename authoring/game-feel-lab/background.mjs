export const PHOTO_CHOICE = 'synevyr';
const PHOTO_PATH = 'authoring/library/real-world-references/synevyr-lake-rafts.jpg';
const PHOTO_URL = new URL(
  '../library/real-world-references/synevyr-lake-rafts.jpg',
  import.meta.url,
);
const METADATA_URL = new URL(
  '../library/real-world-references/synevyr-lake-rafts.json',
  import.meta.url,
);

/** Read the untouched local original only on explicit selection. The closable
 * bitmap belongs to the selection controller, never a production asset cache. */
export async function loadSynevyrPhoto(
  signal,
  { fetchResource = fetch, decode = createImageBitmap } = {},
) {
  signal.throwIfAborted();
  const metadataResponse = await fetchResource(METADATA_URL, { signal });
  if (!metadataResponse.ok) throw new Error('Photograph attribution could not be loaded.');
  const provenance = await metadataResponse.json();
  signal.throwIfAborted();
  if (
    provenance.format !== 'revealline.reference-artwork.v1' ||
    provenance.license !== 'CC0-1.0' ||
    provenance.file?.path !== PHOTO_PATH
  )
    throw new Error('Photograph attribution does not match this example.');
  const response = await fetchResource(PHOTO_URL, { signal });
  if (!response.ok) throw new Error('Photograph could not be loaded.');
  const blob = await response.blob();
  signal.throwIfAborted();
  if (blob.size !== provenance.file.bytes)
    throw new Error('Photograph file size does not match its record.');
  const sourceBytes = await blob.arrayBuffer();
  signal.throwIfAborted();
  const digest = await crypto.subtle.digest('SHA-256', sourceBytes);
  signal.throwIfAborted();
  const sha256 = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  if (sha256 !== provenance.file.sha256)
    throw new Error('Photograph SHA-256 does not match its original byte record.');
  const image = await decode(blob);
  try {
    signal.throwIfAborted();
    if (image.width !== provenance.file.width || image.height !== provenance.file.height)
      throw new Error('Photograph dimensions do not match its record.');
    return { image, provenance, decodedBytes: image.width * image.height * 4 };
  } catch (error) {
    image.close();
    throw error;
  }
}

/** Preserve the current view until a replacement is decoded. Generations also
 * reject decoders that complete after abort or BFCache restoration. */
export function createBackgroundSelection({
  loadPhoto = loadSynevyrPhoto,
  onChange = () => {},
  onStatus = () => {},
} = {}) {
  let current = Object.freeze({ key: 'dark', photo: null });
  let pending = null;
  let generation = 0;
  let active = true;
  let disposed = false;
  let released = false;
  function invalidate() {
    generation++;
    pending?.abort();
    pending = null;
  }
  function commit(next) {
    const previous = current;
    current = Object.freeze(next);
    onChange(current);
    if (previous.photo !== current.photo) previous.photo?.image.close();
  }
  return {
    get current() {
      return current;
    },
    async select(key) {
      if (!active || disposed) return false;
      if (!['dark', 'light', PHOTO_CHOICE].includes(key)) throw new Error('Unknown background.');
      invalidate();
      if (key !== PHOTO_CHOICE) {
        commit({ key, photo: null });
        onStatus('');
        return true;
      }
      if (current.photo) {
        onChange(current);
        onStatus('Photograph ready.');
        return true;
      }
      const controller = new AbortController();
      pending = controller;
      const owner = generation;
      const isCurrent = () => active && !disposed && owner === generation;
      onStatus('Loading the licensed photograph… The current view stays visible.');
      try {
        const photo = await loadPhoto(controller.signal);
        if (!isCurrent()) {
          photo.image.close();
          return false;
        }
        pending = null;
        commit({ key, photo });
        onStatus('Photograph ready. Original image fitted through secured cells.');
        return true;
      } catch (error) {
        if (isCurrent()) {
          pending = null;
          onChange(current);
          onStatus(`Photograph unavailable: ${error.message} The previous view is preserved.`);
        }
        return false;
      }
    },
    suspend() {
      if (!active || disposed) return;
      active = false;
      released = Boolean(pending || current.photo);
      invalidate();
      if (current.photo) {
        current.photo.image.close();
        current = Object.freeze({ key: 'dark', photo: null });
      }
    },
    resume() {
      if (active || disposed) return;
      active = true;
      onChange(current);
      if (released)
        onStatus('Photograph released when the page was left. Select it again when ready.');
      released = false;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      active = false;
      invalidate();
      current.photo?.image.close();
      current = Object.freeze({ key: 'dark', photo: null });
    },
  };
}
