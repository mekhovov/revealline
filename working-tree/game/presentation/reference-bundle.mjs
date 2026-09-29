/** Explicit local v2 prototype transfer. No legacy magic/schema is broadened. */
import { boundedJSON, canonicalJSON, exactKeys, required } from '../data-json.mjs';
import { LIMITS } from './model.mjs';
import { browserDecodeImage } from '../imports.mjs';
import { THEME_BUNDLE_MIME, verifyPresentationFileRows } from './bundle.mjs';
import { validateReferencedBundle, checkReferenceAbort } from './reference-model.mjs';

const MAGIC = new TextEncoder().encode('RLTHM2\r\n');
const sizeOf = Object.getOwnPropertyDescriptor(Blob.prototype, 'size').get;
export async function verifyReferencedAssets(source, assets, options = {}) {
  const document = await validateReferencedBundle(source, options);
  return verifyPresentationFileRows(document.assets, assets, options);
}
export async function exportReferencedBundle(source, sourceAssets = new Map(), options = {}) {
  const document = await validateReferencedBundle(source, options);
  const assets = await verifyPresentationFileRows(document.assets, sourceAssets, options);
  const table = [...assets].map(([sha256, blob]) => ({ sha256, bytes: sizeOf.call(blob) }));
  const manifest = new TextEncoder().encode(canonicalJSON({ document, assets: table }));
  required(manifest.length <= LIMITS.manifestBytes, 'Bundle manifest exceeds its budget.');
  required(
    12 + manifest.length + table.reduce((sum, row) => sum + row.bytes, 0) <= LIMITS.bundleBytes,
    'Theme bundle exceeds 32 MiB.',
  );
  const header = new Uint8Array(12);
  header.set(MAGIC);
  new DataView(header.buffer).setUint32(8, manifest.length);
  checkReferenceAbort(options.signal);
  return new Blob([header, manifest, ...assets.values()], { type: THEME_BUNDLE_MIME });
}
export async function importReferencedBundle(
  source,
  { signal, decodeImage = browserDecodeImage, previous = null, expectedRevision } = {},
) {
  checkReferenceAbort(signal);
  let size;
  try {
    size = sizeOf.call(source);
  } catch {
    throw new TypeError('A native Blob or File is required.');
  }
  required(size >= 12 && size <= LIMITS.bundleBytes, 'File exceeds its byte budget.');
  const blob = Blob.prototype.slice.call(source, 0, size);
  const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  required(
    MAGIC.every((byte, i) => header[i] === byte),
    'Unsupported v2 theme bundle.',
  );
  const length = new DataView(header.buffer).getUint32(8);
  required(
    length > 0 && length <= LIMITS.manifestBytes && 12 + length <= size,
    'Invalid theme manifest length.',
  );
  const manifest = boundedJSON(
    new TextDecoder('utf-8', { fatal: true }).decode(
      await blob.slice(12, 12 + length).arrayBuffer(),
    ),
    {
      maxBytes: LIMITS.manifestBytes,
      maxNodes: 110000,
      maxArray: 2048,
      maxDepth: 20,
      maxString: 8192,
    },
  );
  exactKeys(manifest, ['document', 'assets'], 'theme transfer');
  const document = await validateReferencedBundle(manifest.document, {
    signal,
    previous,
    expectedRevision,
  });
  required(
    Array.isArray(manifest.assets) && manifest.assets.length <= LIMITS.assets,
    'Invalid theme asset table.',
  );
  const assets = new Map();
  let offset = 12 + length,
    last = '';
  for (const row of manifest.assets) {
    exactKeys(row, ['sha256', 'bytes'], 'payload row');
    required(
      typeof row.sha256 === 'string' &&
        /^[a-f0-9]{64}$/.test(row.sha256) &&
        row.sha256 > last &&
        Number.isSafeInteger(row.bytes) &&
        row.bytes > 0 &&
        row.bytes <= LIMITS.assetBytes,
      'Invalid or duplicate payload row.',
    );
    required(offset + row.bytes <= size, 'Truncated theme asset.');
    assets.set(row.sha256, blob.slice(offset, offset + row.bytes));
    offset += row.bytes;
    last = row.sha256;
  }
  required(offset === size, 'Unexpected trailing theme bytes.');
  const accepted = await verifyPresentationFileRows(document.assets, assets, {
    signal,
    decodeImage,
  });
  checkReferenceAbort(signal);
  return Object.freeze({
    document,
    assets: accepted,
    imagesDecoded: typeof decodeImage === 'function',
  });
}
