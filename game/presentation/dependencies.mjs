import { required } from '../data-json.mjs';
import { presentationManifestPath } from './manifest-path.mjs';
import { hashPresentationBytes } from './bundle.mjs';
import { validateCompiledPresentation } from './host.mjs';
import { freezePresentation, LIMITS } from './model.mjs';

const cancelled = (signal) => {
  if (signal?.aborted)
    throw new DOMException('Presentation dependency inspection cancelled.', 'AbortError');
};

/** Inspect the actual runtime manifest bytes, never a caller's claimed asset
 * list. Includes lazy originals/audio; procedural bindings have no file. This
 * is an exact byte inventory, not proof of approval, availability or decoding.
 */
export async function inspectPresentationDependencies(
  source,
  { signal, retainedManifestSha256 = null } = {},
) {
  const manifestPath = presentationManifestPath(retainedManifestSha256);
  cancelled(signal);
  required(
    source instanceof Uint8Array &&
      source.byteLength > 0 &&
      source.byteLength <= LIMITS.manifestBytes,
    'Use bounded original compiled presentation bytes.',
  );
  const bytes = new Uint8Array(source);
  const manifest = validateCompiledPresentation(
    new TextDecoder('utf-8', { fatal: true }).decode(bytes),
  );
  const sha256 = await hashPresentationBytes(bytes);
  cancelled(signal);
  required(
    retainedManifestSha256 === null || sha256 === retainedManifestSha256,
    'Retained presentation dependencies differ from their exact manifest pin.',
  );
  const byHash = new Map();
  for (const [slot, asset] of Object.entries(manifest.resolved.assets)) {
    if (!asset.file) continue;
    let item = byHash.get(asset.file.sha256);
    if (!item) {
      item = {
        path: manifest.urls[asset.file.sha256].slice(2),
        ...asset.file,
        slots: [],
      };
      byHash.set(asset.file.sha256, item);
    }
    item.slots.push(slot);
  }
  const files = [...byHash.values()].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  );
  for (const item of files) item.slots.sort();
  return freezePresentation({
    format: 'revealline-presentation-dependencies.v1',
    manifest: { path: manifestPath, bytes: bytes.byteLength, sha256 },
    source: manifest.source,
    theme: { id: manifest.resolved.theme.id, revision: manifest.resolved.theme.revision },
    collection: manifest.resolved.collection,
    files,
    totalBytes: bytes.byteLength + files.reduce((total, file) => total + file.bytes, 0),
  });
}

/** The code-owned reader must enforce each descriptor's byte bound while
 * reading. No URL, filesystem, storage or decoding authority lives here. One
 * file is checked at a time and no bytes are retained in the result.
 */
export async function verifyPresentationDependencies(
  source,
  { read, signal, expectedManifestSha256 = null, retainedManifestSha256 = null } = {},
) {
  required(typeof read === 'function', 'A bounded presentation dependency reader is required.');
  required(
    expectedManifestSha256 === null ||
      (typeof expectedManifestSha256 === 'string' && /^[a-f0-9]{64}$/.test(expectedManifestSha256)),
    'Use an exact SHA-256 presentation manifest pin.',
  );
  const inventory = await inspectPresentationDependencies(source, {
    signal,
    retainedManifestSha256,
  });
  cancelled(signal);
  required(
    expectedManifestSha256 === null || inventory.manifest.sha256 === expectedManifestSha256,
    'Presentation dependencies differ from the pinned manifest.',
  );
  for (const file of inventory.files) {
    cancelled(signal);
    let onAbort;
    const stop = signal
      ? new Promise((_, reject) => {
          onAbort = () =>
            reject(new DOMException('Presentation dependency read cancelled.', 'AbortError'));
          signal.addEventListener('abort', onAbort, { once: true });
          if (signal.aborted) onAbort();
        })
      : null;
    try {
      const pending = Promise.resolve().then(() => {
        cancelled(signal);
        return read(file, { signal });
      });
      const bytes = await (stop ? Promise.race([pending, stop]) : pending);
      cancelled(signal);
      required(bytes instanceof Uint8Array, `Presentation dependency is unavailable: ${file.path}`);
      required(
        bytes.byteLength === file.bytes,
        `Presentation dependency byte count differs: ${file.path}`,
      );
      // Own bytes before the asynchronous hash; the reader may reuse its buffer.
      const sha256 = await hashPresentationBytes(new Uint8Array(bytes));
      cancelled(signal);
      required(sha256 === file.sha256, `Presentation dependency hash differs: ${file.path}`);
    } finally {
      if (onAbort) signal.removeEventListener('abort', onAbort);
    }
  }
  return Object.freeze({ status: 'verified-bytes', mediaDecoded: false, inventory });
}
