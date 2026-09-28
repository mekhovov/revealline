import {
  boundedJSON,
  canonicalJSON,
  exactKeys,
  required,
  stableId,
} from '../../game/data-json.mjs';
import { CONTENT_LIMITS, inspectImageDataUrl } from '../../game/content.mjs';
import { hashPresentationBytes } from '../../game/presentation/bundle.mjs';

// An authoring transport, deliberately separate from historical .rltheme,
// mission and presentation schemas. Declarations are not approval or permission.
export const ARTWORK_COLLECTION_FORMAT = 'revealline-artwork-collection.v1';
export const ARTWORK_COLLECTION_MIME = 'application/vnd.revealline.artwork';
export const ARTWORK_COLLECTION_LIMITS = Object.freeze({
  metadataBytes: 256 * 1024,
  payloadBytes: 32 * 1024 * 1024,
  artworks: 16,
  sources: 32,
  assetBytes: CONTENT_LIMITS.maxImageBytes,
});
const magic = new TextEncoder().encode('RLART1\r\n');
const sizeOf = Object.getOwnPropertyDescriptor(Blob.prototype, 'size').get;
const text = (value, max = 2048) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const fields = (value, names, label) => {
  const keys = names.split(' ');
  exactKeys(value, keys, label);
  required(
    keys.every((key) => Object.hasOwn(value, key)),
    `${label} is missing fields.`,
  );
};
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const aborted = (signal) => signal?.throwIfAborted();
function https(value) {
  if (!text(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}
function license(value, incorporated) {
  fields(value, 'status name url evidence', 'rights declaration');
  required(
    ['unverified', 'public-domain', 'licensed', 'permission', 'original'].includes(value.status) &&
      text(value.name) &&
      (value.url === null || https(value.url)) &&
      text(value.evidence),
    'Invalid rights declaration.',
  );
  required(
    !incorporated || value.status !== 'unverified',
    'Incorporated material needs a declared reuse basis.',
  );
}
export function validateArtworkCollection(input) {
  const value = boundedJSON(input, {
    maxBytes: ARTWORK_COLLECTION_LIMITS.metadataBytes,
    maxNodes: 6000,
    maxArray: 32,
    maxString: 16384,
    maxDepth: 8,
  });
  fields(value, 'format id revision name treatment sources artworks', 'artwork collection');
  required(value.format === ARTWORK_COLLECTION_FORMAT, 'Unsupported artwork collection format.');
  required(
    stableId(value.id) &&
      Number.isSafeInteger(value.revision) &&
      value.revision > 0 &&
      text(value.name, 120),
    'Invalid artwork collection identity.',
  );
  required(
    ['pixel-art', 'photographic-reveals'].includes(value.treatment),
    'Unknown collection artwork treatment.',
  );
  required(
    Array.isArray(value.sources) && value.sources.length <= 32,
    'Too many reference sources.',
  );
  required(
    Array.isArray(value.artworks) && value.artworks.length > 0 && value.artworks.length <= 16,
    'An artwork collection needs 1–16 retained files.',
  );
  const sources = new Map();
  for (const source of value.sources) {
    fields(source, 'id use creator source license', 'artwork source');
    required(
      stableId(source.id) && !sources.has(source.id),
      'Duplicate or invalid source identity.',
    );
    required(
      ['reference-only', 'incorporated'].includes(source.use) &&
        text(source.creator) &&
        https(source.source),
      'Invalid source use, creator or HTTPS reference.',
    );
    license(source.license, source.use === 'incorporated');
    sources.set(source.id, source);
  }
  const artworks = new Map(),
    names = new Set();
  let total = 0;
  for (const artwork of value.artworks) {
    fields(artwork, 'id role medium file provenance', 'artwork');
    required(
      stableId(artwork.id) && !artworks.has(artwork.id),
      'Duplicate or invalid artwork identity.',
    );
    required(
      ['reveal', 'actor', 'interface'].includes(artwork.role) &&
        ['pixel-art', 'photograph'].includes(artwork.medium),
      'Invalid artwork role or medium.',
    );
    required(
      artwork.medium !== 'photograph' ||
        (value.treatment === 'photographic-reveals' && artwork.role === 'reveal'),
      'Photographs require an explicit photographic-reveals collection and reveal role.',
    );
    const file = artwork.file;
    fields(file, 'name sha256 bytes mime width height', 'artwork file');
    required(
      typeof file.name === 'string' &&
        /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(file.name) &&
        !names.has(file.name),
      'Files need unique local basenames; paths and URLs are not accepted.',
    );
    names.add(file.name);
    required(
      /^[a-f0-9]{64}$/.test(file.sha256) &&
        Number.isSafeInteger(file.bytes) &&
        file.bytes > 0 &&
        file.bytes <= ARTWORK_COLLECTION_LIMITS.assetBytes,
      'Invalid artwork hash or 4 MiB byte budget.',
    );
    required(
      ['image/png', 'image/jpeg', 'image/webp'].includes(file.mime),
      'Only static PNG, JPEG or WebP files are supported.',
    );
    required(
      [file.width, file.height].every(
        (n) => Number.isInteger(n) && n > 0 && n <= CONTENT_LIMITS.maxImageSide,
      ) && file.width * file.height <= CONTENT_LIMITS.maxImagePixels,
      'Artwork exceeds image dimensions.',
    );
    total += file.bytes;
    const provenance = artwork.provenance;
    fields(provenance, 'origin creator license sourceIds derivative prompt', 'artwork provenance');
    required(
      ['original', 'generated', 'derivative'].includes(provenance.origin) &&
        text(provenance.creator),
      'Missing original creator or origin.',
    );
    license(provenance.license, true);
    required(
      typeof provenance.prompt === 'string' &&
        provenance.prompt.length <= 16384 &&
        (provenance.origin !== 'generated' || text(provenance.prompt, 16384)),
      'Generated originals require their effective prompt.',
    );
    required(
      Array.isArray(provenance.sourceIds) &&
        new Set(provenance.sourceIds).size === provenance.sourceIds.length &&
        provenance.sourceIds.every((id) => sources.has(id)),
      'Unknown or duplicate provenance source.',
    );
    if (provenance.origin === 'derivative') {
      fields(provenance.derivative, 'parent changes', 'derivative provenance');
      required(
        stableId(provenance.derivative.parent) && text(provenance.derivative.changes),
        'Derivatives require retained parent and changes.',
      );
    } else
      required(provenance.derivative === null, 'Only a declared derivative may name a parent.');
    artworks.set(artwork.id, artwork);
  }
  required(
    total <= ARTWORK_COLLECTION_LIMITS.payloadBytes,
    'Artwork collection exceeds 32 MiB of originals.',
  );
  for (const artwork of artworks.values()) {
    const seen = new Set();
    let at = artwork;
    while (at) {
      required(!seen.has(at.id), 'Artwork derivative cycle.');
      seen.add(at.id);
      const parent = at.provenance.derivative?.parent;
      required(
        !parent || artworks.has(parent),
        'A derivative parent must be retained in this collection.',
      );
      at = parent ? artworks.get(parent) : null;
    }
  }
  return freeze(value);
}
export function createArtworkCollection({ treatment = 'pixel-art', sources = [], ...fields }) {
  return validateArtworkCollection({
    ...fields,
    format: ARTWORK_COLLECTION_FORMAT,
    treatment,
    sources,
  });
}
function ownBlob(value, limit) {
  let size;
  try {
    size = sizeOf.call(value);
  } catch {
    throw new TypeError('Original files must be native Blobs or Files.');
  }
  required(size > 0 && size <= limit, 'Original file exceeds its byte budget.');
  return Blob.prototype.slice.call(value, 0, size);
}
function dataURL(bytes, mime) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 16384)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
  return `data:${mime};base64,${btoa(binary)}`;
}
/** Temporary native decode; every exit releases its URL and image. */
export function decodeArtworkImage(blob, { signal } = {}) {
  aborted(signal);
  return new Promise((resolve, reject) => {
    const image = new Image(),
      url = URL.createObjectURL(blob);
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      const dimensions = { naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight };
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      image.onload = image.onerror = null;
      image.removeAttribute('src');
      URL.revokeObjectURL(url);
      if (error) reject(error);
      else resolve(dimensions);
    };
    const cancel = () => finish(new DOMException('Artwork import cancelled.', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('Artwork decode timed out.')), 15000);
    signal?.addEventListener('abort', cancel, { once: true });
    image.onerror = () => finish(new Error('Artwork could not decode.'));
    image.onload = async () => {
      try {
        await image.decode?.();
        finish();
      } catch (error) {
        finish(error);
      }
    };
    if (signal?.aborted) cancel();
    else {
      try {
        image.src = url;
      } catch (error) {
        finish(error);
      }
    }
  });
}
/** Snapshot all caller-owned data before awaiting. Verify all original hashes
 * and static headers before the first decode. Never fetch reference URLs. */
export async function verifyArtworkCollection(
  input,
  files,
  { signal, decodeImage = decodeArtworkImage } = {},
) {
  aborted(signal);
  const document = validateArtworkCollection(input),
    assets = new Map();
  required(
    files instanceof Map && files.size === document.artworks.length,
    'Provide exactly the declared original files.',
  );
  for (const { file } of document.artworks) {
    const blob = ownBlob(files.get(file.name), ARTWORK_COLLECTION_LIMITS.assetBytes);
    required(blob.size === file.bytes, `Original byte count differs: ${file.name}.`);
    assets.set(file.name, blob);
  }
  for (const { file } of document.artworks) {
    const blob = assets.get(file.name),
      bytes = new Uint8Array(await blob.arrayBuffer());
    aborted(signal);
    required(
      (await hashPresentationBytes(bytes)) === file.sha256,
      `Original SHA-256 differs: ${file.name}.`,
    );
    aborted(signal);
    const header = inspectImageDataUrl(dataURL(bytes, file.mime));
    required(
      header.valid &&
        header.width === file.width &&
        header.height === file.height &&
        header.mime === file.mime,
      `Static image header differs: ${file.name}.`,
    );
    assets.set(file.name, blob.slice(0, blob.size, file.mime));
  }
  for (const { file } of document.artworks) {
    aborted(signal);
    const decoded = await decodeImage(assets.get(file.name), { signal });
    aborted(signal);
    required(
      decoded?.naturalWidth === file.width && decoded?.naturalHeight === file.height,
      `Decoded image dimensions differ: ${file.name}.`,
    );
  }
  return Object.freeze({ document, assets });
}
export async function exportArtworkCollection(input, files, options = {}) {
  const { document, assets } = await verifyArtworkCollection(input, files, options);
  const metadata = new TextEncoder().encode(canonicalJSON(document)),
    header = new Uint8Array(12);
  header.set(magic);
  new DataView(header.buffer).setUint32(8, metadata.length);
  aborted(options.signal);
  return new Blob(
    [header, metadata, ...document.artworks.map(({ file }) => assets.get(file.name))],
    { type: ARTWORK_COLLECTION_MIME },
  );
}
export async function importArtworkCollection(input, options = {}) {
  aborted(options.signal);
  const blob = ownBlob(
    input,
    ARTWORK_COLLECTION_LIMITS.payloadBytes + ARTWORK_COLLECTION_LIMITS.metadataBytes + 12,
  );
  required(blob.size >= 12, 'Truncated artwork packet.');
  const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  aborted(options.signal);
  required(
    magic.every((value, index) => value === header[index]),
    'Unsupported artwork packet.',
  );
  const length = new DataView(header.buffer).getUint32(8);
  required(
    length > 0 && length <= ARTWORK_COLLECTION_LIMITS.metadataBytes && 12 + length <= blob.size,
    'Invalid artwork metadata length.',
  );
  const document = validateArtworkCollection(
    new TextDecoder('utf-8', { fatal: true }).decode(
      await blob.slice(12, 12 + length).arrayBuffer(),
    ),
  );
  aborted(options.signal);
  const assets = new Map();
  let offset = 12 + length;
  for (const { file } of document.artworks) {
    required(offset + file.bytes <= blob.size, 'Truncated original file.');
    assets.set(file.name, blob.slice(offset, offset + file.bytes));
    offset += file.bytes;
  }
  required(offset === blob.size, 'Unexpected trailing artwork bytes.');
  return verifyArtworkCollection(document, assets, options);
}
