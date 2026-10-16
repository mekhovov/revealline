import { boundedJSON, exactKeys, required } from '../../game/data-json.mjs';
import { hashPresentationBytes } from '../../game/presentation/bundle.mjs';
import {
  ARTWORK_COLLECTION_LIMITS,
  validateArtworkCollection,
  verifyArtworkCollection,
} from './artwork-collection.mjs';

const boards = Object.freeze({ wide: [1152, 576], classic: [768, 576] });

/** Geometry belongs to artwork only. Never stretch or alter logical boards. */
export function artworkDerivativePlan(file, options) {
  const choice = boundedJSON(options, { maxBytes: 1024 });
  exactKeys(choice, ['board', 'fit'], 'board preparation');
  required(Object.hasOwn(boards, choice.board), 'Choose a supported board size.');
  required(['contain', 'cover'].includes(choice.fit), 'Choose contain or centre crop.');
  required(
    [file.width, file.height].every((n) => Number.isSafeInteger(n) && n > 0 && n <= 8192),
    'Invalid original dimensions.',
  );
  const [width, height] = boards[choice.board];
  const scale = Math[choice.fit === 'contain' ? 'min' : 'max'](
    width / file.width,
    height / file.height,
  );
  required(scale <= 1, 'Keep the larger original; this source would need upscaling.');
  const source =
    choice.fit === 'cover'
      ? [
          (file.width - width / scale) / 2,
          (file.height - height / scale) / 2,
          width / scale,
          height / scale,
        ]
      : [0, 0, file.width, file.height];
  const destination =
    choice.fit === 'cover'
      ? [0, 0, width, height]
      : [
          (width - file.width * scale) / 2,
          (height - file.height * scale) / 2,
          file.width * scale,
          file.height * scale,
        ];
  return Object.freeze({
    version: 'board-derivative.v1',
    ...choice,
    width,
    height,
    sourceWidth: file.width,
    sourceHeight: file.height,
    source: Object.freeze(source),
    destination: Object.freeze(destination),
    background: '#08131e',
  });
}

/** Native, bounded decode/draw/encode. All exits release image, URL and canvas. */
export function rasterizeArtworkDerivative(
  blob,
  plan,
  {
    signal,
    sampling,
    document = globalThis.document,
    Image = globalThis.Image,
    urls = URL,
    schedule = setTimeout,
    cancel = clearTimeout,
  } = {},
) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const image = new Image(),
      canvas = document.createElement('canvas');
    let settled = false,
      url = null,
      timer;
    function finish(error, result) {
      if (settled) return;
      settled = true;
      cancel(timer);
      signal?.removeEventListener('abort', abort);
      image.onload = image.onerror = null;
      image.removeAttribute('src');
      if (url) urls.revokeObjectURL(url);
      canvas.width = canvas.height = 0;
      if (error) reject(error);
      else resolve(result);
    }
    const abort = () => finish(new DOMException('Board preparation cancelled.', 'AbortError'));
    timer = schedule(() => finish(new Error('Board preparation timed out.')), 15000);
    signal?.addEventListener('abort', abort, { once: true });
    image.onerror = () => finish(new Error('Original artwork could not decode.'));
    image.onload = async () => {
      try {
        await image.decode?.();
        if (settled) return;
        signal?.throwIfAborted();
        required(
          image.naturalWidth === plan.sourceWidth && image.naturalHeight === plan.sourceHeight,
          'Decoded original dimensions changed.',
        );
        canvas.width = plan.width;
        canvas.height = plan.height;
        const ctx = canvas.getContext('2d');
        required(ctx, 'Canvas preparation is unavailable.');
        ctx.fillStyle = plan.background;
        ctx.fillRect(0, 0, plan.width, plan.height);
        ctx.imageSmoothingEnabled = sampling === 'smooth';
        if (sampling === 'smooth') ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, ...plan.source, ...plan.destination);
        canvas.toBlob((result) => {
          if (settled) return;
          if (!result) finish(new Error('Board image encoding failed.'));
          else finish(null, result);
        }, 'image/png');
      } catch (error) {
        finish(error);
      }
    };
    try {
      signal?.throwIfAborted();
      url = urls.createObjectURL(blob);
      image.src = url;
    } catch (error) {
      finish(error);
    }
  });
}

/** Append a separately identified derivative, preserving every original byte.
 * Native encoders may differ; record actual PNG hashes, never promise a global
 * reproducible raster or promote the result to production approval. */
export async function prepareArtworkDerivative(
  current,
  parentId,
  options,
  { signal, decodeImage, rasterize = rasterizeArtworkDerivative } = {},
) {
  signal?.throwIfAborted();
  const document = validateArtworkCollection(current.document);
  const parent = document.artworks.find((artwork) => artwork.id === parentId);
  required(parent?.role === 'reveal', 'Select retained reveal artwork.');
  required(
    document.artworks.length < ARTWORK_COLLECTION_LIMITS.artworks,
    'Artwork file limit reached.',
  );
  const plan = artworkDerivativePlan(parent.file, options);
  const sampling = parent.medium === 'pixel-art' ? 'nearest' : 'smooth';
  const revision = document.revision + 1;
  required(Number.isSafeInteger(revision), 'Artwork revision limit reached.');
  const id = `${parent.id.slice(0, 48)}-${plan.board}-r${revision}`;
  const name = `${id}.png`;
  required(
    !document.artworks.some((a) => a.id === id || a.file.name === name),
    'Derivative identity already exists.',
  );
  const verified = await verifyArtworkCollection(document, new Map(current.assets), {
    signal,
    decodeImage,
  });
  signal?.throwIfAborted();
  const blob = await rasterize(verified.assets.get(parent.file.name), plan, { signal, sampling });
  signal?.throwIfAborted();
  required(
    blob instanceof Blob && blob.size > 0 && blob.size <= ARTWORK_COLLECTION_LIMITS.assetBytes,
    'Prepared image exceeds its byte budget.',
  );
  const bytes = new Uint8Array(await blob.arrayBuffer());
  signal?.throwIfAborted();
  const sha256 = await hashPresentationBytes(bytes);
  signal?.throwIfAborted();
  const artwork = {
    id,
    role: parent.role,
    medium: parent.medium,
    file: {
      name,
      bytes: bytes.length,
      sha256,
      mime: 'image/png',
      width: plan.width,
      height: plan.height,
    },
    provenance: {
      origin: 'derivative',
      creator: parent.provenance.creator,
      license: parent.provenance.license,
      sourceIds: parent.provenance.sourceIds,
      derivative: {
        parent: parent.id,
        changes: JSON.stringify({
          ...plan,
          sampling,
          tool: 'Reveal Line Asset Studio',
          encoder: 'native-canvas-png',
          review: 'candidate-not-production-approved',
        }),
      },
      prompt: '',
    },
  };
  const next = validateArtworkCollection({
    ...document,
    revision,
    artworks: [...document.artworks, artwork],
  });
  const files = new Map(verified.assets);
  files.set(name, new Blob([bytes], { type: 'image/png' }));
  return verifyArtworkCollection(next, files, { signal, decodeImage });
}
