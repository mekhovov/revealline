import { boundedJSON, canonicalJSON, exactKeys, plainObject, required } from './data-json.mjs';
import { SOUNDTRACK_LIMITS, resolveSoundtrackLibrary } from './soundtrack.mjs';
import {
  inspectMP3,
  ownSoundtrackBlob,
  probeMP3Media,
  throwIfSoundtrackAborted,
  verifyMP3Media,
} from './mp3.mjs';

export const SOUNDTRACK_BUNDLE_FORMAT = 'revealline-soundtrack-bundle.v1';
const MAGIC = new TextEncoder().encode('RLSTB1\r\n');
const MANIFEST_BYTES = SOUNDTRACK_LIMITS.metadataBytes + 32768;
const preparedLibraries = new WeakSet();
const hashValid = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
/** Snapshot the finite Blob table without reading accessors or copying payload bytes. */
export function ownSoundtrackAssets(value) {
  required(
    Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype && value.length <= 128,
    'Invalid soundtrack asset table.',
  );
  const descriptors = Object.getOwnPropertyDescriptors(value);
  required(
    Reflect.ownKeys(descriptors).length === value.length + 1,
    'Sparse or decorated audio asset table.',
  );
  const result = [],
    seen = new Set();
  for (let i = 0; i < value.length; i++) {
    const d = descriptors[i];
    required(
      d?.enumerable && Object.hasOwn(d, 'value') && plainObject(d.value),
      'Invalid audio asset entry.',
    );
    const fields = Object.getOwnPropertyDescriptors(d.value);
    required(
      Reflect.ownKeys(fields).length === 2 &&
        ['sha256', 'blob'].every((k) => fields[k]?.enumerable && Object.hasOwn(fields[k], 'value')),
      'Audio asset entry requires owned hash and Blob.',
    );
    const hash = fields.sha256.value;
    required(hashValid(hash) && !seen.has(hash), 'Invalid or duplicate audio asset hash.');
    seen.add(hash);
    result.push(Object.freeze({ sha256: hash, blob: ownSoundtrackBlob(fields.blob.value) }));
  }
  return Object.freeze(result);
}
function referencedAssets(library, assets) {
  const wanted = new Map(library.tracks.map((t) => [t.asset.sha256, t.asset]));
  required(
    wanted.size === assets.length && assets.every((a) => wanted.has(a.sha256)),
    'Complete soundtrack transfer requires every referenced asset and no extras.',
  );
  let total = 0;
  for (const { sha256, blob } of assets) {
    required(
      blob.size === wanted.get(sha256).bytes,
      'Audio asset byte length differs from metadata.',
    );
    total += blob.size;
  }
  required(
    total <= SOUNDTRACK_LIMITS.managedBytes,
    'Soundtrack assets exceed the managed byte budget.',
  );
  return wanted;
}
async function verifyAssets(library, assets, { signal, probeMedia } = {}) {
  const wanted = referencedAssets(library, assets);
  for (const { sha256, blob } of assets) {
    throwIfSoundtrackAborted(signal);
    const actual = await inspectMP3(blob, { signal });
    required(
      canonicalJSON(actual) === canonicalJSON(wanted.get(sha256)),
      'MP3 bytes or frame metadata differ from the soundtrack manifest.',
    );
    if (probeMedia) await verifyMP3Media(blob, actual, { probeMedia, signal });
  }
  throwIfSoundtrackAborted(signal);
}
/** Actual import boundary: every distinct MP3 must also pass the host's media probe. */
export async function prepareSoundtrackLibrary(
  value,
  sourceAssets,
  { signal, probeMedia = probeMP3Media } = {},
) {
  required(typeof probeMedia === 'function', 'An actual-import media probe is required.');
  const library = resolveSoundtrackLibrary(value),
    assets = ownSoundtrackAssets(sourceAssets);
  await verifyAssets(library, assets, { signal, probeMedia });
  const prepared = Object.freeze({ library, assets });
  preparedLibraries.add(prepared);
  return prepared;
}
export const isPreparedSoundtrackLibrary = (value) => preparedLibraries.has(value);
/** Complete binary export. The Blob contains raw originals, never base64 or decoded PCM. */
export async function exportSoundtrackBundle(value, sourceAssets, { signal } = {}) {
  const library = resolveSoundtrackLibrary(value),
    assets = [...ownSoundtrackAssets(sourceAssets)].sort((a, b) =>
      a.sha256.localeCompare(b.sha256),
    );
  await verifyAssets(library, assets, { signal });
  const manifest = new TextEncoder().encode(
    canonicalJSON({
      format: SOUNDTRACK_BUNDLE_FORMAT,
      library,
      assets: assets.map((a) => ({ sha256: a.sha256, bytes: a.blob.size })),
    }),
  );
  required(manifest.length <= MANIFEST_BYTES, 'Soundtrack manifest exceeds its byte budget.');
  const size = 12 + manifest.length + assets.reduce((n, a) => n + a.blob.size, 0);
  required(size <= SOUNDTRACK_LIMITS.bundleBytes, 'Complete soundtrack bundle exceeds 256 MiB.');
  const header = new Uint8Array(12);
  header.set(MAGIC);
  new DataView(header.buffer).setUint32(8, manifest.length, false);
  return new Blob([header, manifest, ...assets.map((a) => a.blob)], {
    type: 'application/vnd.revealline.soundtrack',
  });
}
export async function importSoundtrackBundle(source, { signal, probeMedia = probeMP3Media } = {}) {
  throwIfSoundtrackAborted(signal);
  const blob = ownSoundtrackBlob(source, SOUNDTRACK_LIMITS.bundleBytes);
  required(blob.size >= 12, 'Truncated soundtrack bundle.');
  const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  throwIfSoundtrackAborted(signal);
  required(
    MAGIC.every((b, i) => b === header[i]),
    'Unsupported soundtrack bundle.',
  );
  const size = new DataView(header.buffer).getUint32(8, false);
  required(
    size > 0 && size <= MANIFEST_BYTES && 12 + size <= blob.size,
    'Invalid soundtrack manifest length.',
  );
  const raw = new TextDecoder('utf-8', { fatal: true }).decode(
    await blob.slice(12, 12 + size).arrayBuffer(),
  );
  throwIfSoundtrackAborted(signal);
  const manifest = boundedJSON(raw, {
    maxBytes: MANIFEST_BYTES,
    maxNodes: 32000,
    maxDepth: 12,
    maxArray: 256,
    maxString: 1024,
  });
  exactKeys(manifest, ['format', 'library', 'assets'], 'soundtrack bundle');
  required(manifest.format === SOUNDTRACK_BUNDLE_FORMAT, 'Unsupported soundtrack bundle format.');
  const library = resolveSoundtrackLibrary(manifest.library);
  required(
    Array.isArray(manifest.assets) && manifest.assets.length <= 128,
    'Invalid bundle asset table.',
  );
  let offset = 12 + size,
    previous = '';
  const assets = [];
  for (const item of manifest.assets) {
    exactKeys(item, ['sha256', 'bytes'], 'bundle asset');
    required(
      hashValid(item.sha256) &&
        item.sha256 > previous &&
        Number.isSafeInteger(item.bytes) &&
        item.bytes > 0 &&
        item.bytes <= SOUNDTRACK_LIMITS.trackBytes &&
        offset + item.bytes <= blob.size,
      'Invalid, duplicated or truncated bundle asset.',
    );
    assets.push({
      sha256: item.sha256,
      blob: blob.slice(offset, offset + item.bytes, 'audio/mpeg'),
    });
    offset += item.bytes;
    previous = item.sha256;
  }
  required(offset === blob.size, 'Soundtrack bundle has trailing bytes.');
  return prepareSoundtrackLibrary(library, assets, { signal, probeMedia });
}
