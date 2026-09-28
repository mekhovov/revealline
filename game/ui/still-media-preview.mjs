import { t } from '../i18n/index.mjs';
import { boundedJSON, required } from '../data-json.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { validateStillAsset } from '../media-library.mjs';
import { BoardPainter, boardPaintSizeForLevel } from './render.mjs';

const cancelled = () => new DOMException(t("interface:stillPreviewCancelled"), 'AbortError');
const check = (signal) => {
  if (signal.aborted) throw cancelled();
};
const disposeImage = (image) => {
  image?.removeAttribute?.('src');
  image?.close?.();
};

function decodeBrowserImage(source, { signal, ImageClass }) {
  required(typeof ImageClass === 'function', t("interface:browserImageDecodingIsUnavailable"));
  check(signal);
  return new Promise((resolve, reject) => {
    const image = new ImageClass();
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      image.onload = image.onerror = null;
      if (error) {
        disposeImage(image);
        reject(error);
      } else resolve(image);
    };
    const abort = () => finish(cancelled());
    const timer = setTimeout(() => finish(new Error(t("interface:stillPreviewDecodeTimedOut"))), 15000);
    signal.addEventListener('abort', abort, { once: true });
    image.onerror = () => finish(new Error(t("interface:thePreviewImageCouldNotDecode")));
    image.onload = async () => {
      try {
        required(typeof image.decode === 'function', t("interface:completeImageDecodingIsUnavailable"));
        await image.decode();
        finish();
      } catch (error) {
        finish(error);
      }
    };
    if (signal.aborted) return abort();
    try {
      image.src = source;
    } catch (error) {
      finish(error);
    }
  });
}

// An injected decoder still cannot hold cancellation or publish a late image.
function decodeUntilCancelled(decode, source, signal) {
  check(signal);
  return new Promise((resolve, reject) => {
    let settled = false;
    const abort = () => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      reject(cancelled());
    };
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve()
      .then(() => {
        check(signal);
        return decode(source, { signal });
      })
      .then(
        (image) => {
          signal.removeEventListener('abort', abort);
          if (settled) return disposeImage(image);
          settled = true;
          resolve(image);
        },
        (error) => {
          signal.removeEventListener('abort', abort);
          if (settled) return;
          settled = true;
          reject(error);
        },
      );
    if (signal.aborted) abort();
  });
}

/** Source-only still preview. decodeImage(sourceURL,{signal}) must return an
 * owned, completely decoded drawable, not the preparation adapter's dimensions.
 * No storage, setLook, live run, award or simulation calls. The caller must
 * clear() when its authored context changes; a failed same-context candidate
 * intentionally leaves the previously committed preview intact.
 */
export function createStillMediaPreview({
  canvas,
  presets,
  decodeImage,
  URLImpl = globalThis.URL,
  ImageClass = globalThis.Image,
} = {}) {
  required(
    canvas?.ownerDocument?.createElement && canvas.getContext?.('2d'),
    t("interface:stillPreviewNeedsAWorking2dCanvas"),
  );
  const painter = new BoardPainter(presets);
  const decode =
    decodeImage ?? ((src, options) => decodeBrowserImage(src, { ...options, ImageClass }));
  required(typeof decode === 'function', t("interface:aStillPreviewDecoderIsRequired"));
  let generation = 0,
    pending = null,
    disposed = false;

  async function show(
    { theme, level, seed = 1, asset = null, blob = null, legacyBackground = null },
    { signal } = {},
  ) {
    if (disposed) throw new Error(t("interface:stillPreviewHasBeenDisposed"));
    const ticket = ++generation;
    pending?.abort();
    const own = new AbortController();
    pending = own;
    const abort = () => own.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) own.abort();
    let objectURL = null,
      image = null;
    try {
      check(own.signal);
      const size = boardPaintSizeForLevel(level);
      const look = boundedJSON(theme, { maxBytes: 65536, maxNodes: 2048 });
      const map = boundedJSON({ id: level.id, revision: level.revision }, { maxBytes: 1024 });
      let source = null,
        expected = null,
        fit = 'cover';
      required(
        (asset === null) === (blob === null),
        t("interface:previewNeedsBothTheStillAssetAndItsOriginalBlob"),
      );
      if (asset !== null) {
        const record = validateStillAsset(asset);
        let owned;
        try {
          const bytes = Object.getOwnPropertyDescriptor(Blob.prototype, 'size').get.call(blob);
          required(bytes === record.bytes, t("interface:previewBytesDifferFromTheStillRecord"));
          owned = Blob.prototype.slice.call(blob, 0, bytes, record.mime);
        } catch (error) {
          throw new TypeError(t("gameplay:previewRequiresTheMatchingOriginalBlob", { value1: error.message }));
        }
        const digest = new Uint8Array(
          await crypto.subtle.digest('SHA-256', await owned.arrayBuffer()),
        );
        check(own.signal);
        const hash = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
        required(hash === record.sha256, t("interface:previewOriginalBytesDoNotMatchTheSavedSha256"));
        required(
          typeof URLImpl?.createObjectURL === 'function' &&
            typeof URLImpl?.revokeObjectURL === 'function',
          t("interface:localPreviewObjectUrlsAreUnavailable"),
        );
        objectURL = URLImpl.createObjectURL(owned);
        source = objectURL;
        expected = record;
        fit = 'contain';
      } else if (legacyBackground !== null) {
        const background = boundedJSON(legacyBackground, {
          maxBytes: 6 * 1024 * 1024,
          maxString: 6 * 1024 * 1024,
        });
        const header = inspectImageDataUrl(background.dataUrl);
        required(header.valid, t("interface:theAuthoredBackgroundImageIsInvalid"));
        required(
          ['contain', 'cover'].includes(background.fit ?? 'cover'),
          t("interface:theAuthoredBackgroundFitIsUnsupported"),
        );
        source = background.dataUrl;
        expected = header;
        fit = background.fit ?? 'cover';
      }
      if (source) {
        image = await decodeUntilCancelled(decode, source, own.signal);
        check(own.signal);
        required(
          image &&
            image.width === expected.width &&
            image.height === expected.height &&
            (image.naturalWidth ?? image.width) === expected.width &&
            (image.naturalHeight ?? image.height) === expected.height,
          t("interface:decodedPreviewDimensionsDifferFromTheOriginalImage"),
        );
      }
      const staged = canvas.ownerDocument.createElement('canvas');
      staged.width = size.width;
      staged.height = size.height;
      const context = staged.getContext('2d');
      required(context, t("interface:stillPreviewStagingCanvasIsUnavailable"));
      painter.drawGallery(context, {
        theme: look,
        level: map,
        seed,
        width: size.width,
        height: size.height,
        image,
        fit,
      });
      check(own.signal);
      if (disposed || ticket !== generation) return false;
      // There is no await between sizing and copying a fully painted frame.
      if (canvas.width !== size.width) canvas.width = size.width;
      if (canvas.height !== size.height) canvas.height = size.height;
      const target = canvas.getContext('2d');
      target.save();
      try {
        target.setTransform(1, 0, 0, 1, 0, 0);
        target.globalAlpha = 1;
        target.globalCompositeOperation = 'copy';
        target.imageSmoothingEnabled = false;
        target.drawImage(staged, 0, 0);
      } finally {
        target.restore();
      }
      canvas.style.aspectRatio = `${size.width} / ${size.height}`;
      return true;
    } catch (error) {
      if (disposed || ticket !== generation) return false;
      throw error;
    } finally {
      signal?.removeEventListener('abort', abort);
      if (pending === own) pending = null;
      disposeImage(image);
      if (objectURL !== null) URLImpl.revokeObjectURL(objectURL);
    }
  }
  function clear() {
    ++generation;
    pending?.abort();
    pending = null;
    const context = canvas.getContext('2d');
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    clear();
  }
  return Object.freeze({ canvas, show, clear, dispose });
}
