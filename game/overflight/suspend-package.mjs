import { boundedJSON, canonicalJSON, exactKeys, required } from '../data-json.mjs';
import { validateSurvivalPackageIdentity } from './checkpoint.mjs';

// Executed core/compiler/decoder closure, including the localization dependency
// of data validation. A source-graph test requires every relative import here.
export const SURVIVAL_SUSPEND_RUNTIME_FILES = Object.freeze([
  'game/data-json.mjs',
  'game/i18n/bootstrap.mjs',
  'game/i18n/catalogs.mjs',
  'game/i18n/index.mjs',
  'game/overflight/battlefields.mjs',
  'game/overflight/checkpoint-schema.mjs',
  'game/overflight/checkpoint.mjs',
  'game/overflight/combat-profile.mjs',
  'game/overflight/coordinated-movement.mjs',
  'game/overflight/core.mjs',
  'game/overflight/defeat-feed.mjs',
  'game/overflight/flight-profile.mjs',
  'game/overflight/grid.mjs',
  'game/overflight/mastery.mjs',
  'game/overflight/motion.mjs',
  'game/overflight/project.mjs',
  'game/overflight/raid-records.mjs',
  'game/overflight/raid-upgrades.mjs',
  'game/overflight/raid-variants.mjs',
  'game/overflight/records.mjs',
  'game/overflight/suspend-package.mjs',
  'game/overflight/suspend-view.mjs',
  'game/overflight/suspend.mjs',
  'game/overflight/tactics.mjs',
  'game/overflight/terrain.mjs',
  'game/overflight/upgrades.mjs',
  'game/overflight/world-layout-presentation.mjs',
  'game/overflight/worlds.mjs',
  'game/presentation/overflight-world-slots.mjs',
  'game/profile-database.mjs',
  'game/profile-storage.mjs',
  'game/profile-writer.mjs',
  'game/vendor/i18next-26.4.2.min.js',
]);
const HASH = /^[a-f0-9]{64}$/;
const requirePackage = (condition, message) =>
  required(condition, message ?? 'The exact Survival game package could not be verified.');
const sha256 = async (bytes, cryptoImpl) =>
  [...new Uint8Array(await cryptoImpl.subtle.digest('SHA-256', bytes))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
async function readBytes(fetchImpl, url, limit, signal) {
  signal.throwIfAborted();
  const response = await fetchImpl(url, { signal, redirect: 'error' });
  requirePackage(
    response.ok && response.body,
    'A packaged game file is unavailable. Retry with the same complete package.',
  );
  const reader = response.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      requirePackage(size <= limit, 'The packaged game file exceeds its declared size.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
function marker(text) {
  const value = boundedJSON(text, { maxBytes: 16384, maxNodes: 512, maxArray: 64, maxDepth: 6 });
  requirePackage(
    value?.format === 'revealline-offline.v1' && HASH.test(value.buildId),
    'Suspend needs a complete packaged release; this development page has no package identity.',
  );
  return value;
}
function htmlMarker(html) {
  const matches = [...html.matchAll(/<meta name="revealline-offline" content='([^']*)'>/g)];
  requirePackage(matches.length === 1);
  return marker(
    matches[0][1]
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&'),
  );
}

/** A real release manifest and its emitted runtime closure, never a test/source
 * hash masquerading as a package. A source preview remains honestly unavailable.
 * Caller cancellation or any mismatch produces no identity and changes no run. */
export async function readSurvivalSuspendPackage({
  documentRef = globalThis.document,
  fetchImpl = globalThis.fetch,
  cryptoImpl = globalThis.crypto,
  rootURL = new URL('../../', import.meta.url),
  signal,
  timeoutMs = 30000,
} = {}) {
  const current = marker(
    documentRef?.querySelector('meta[name="revealline-offline"]')?.content ?? 'null',
  );
  requirePackage(cryptoImpl?.subtle && typeof fetchImpl === 'function');
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(
    () => controller.abort(new DOMException('Package verification timed out.', 'TimeoutError')),
    timeoutMs,
  );
  const ownedSignal = controller.signal;
  try {
    const root = new URL(rootURL),
      rawManifest = await readBytes(
        fetchImpl,
        new URL('manifest.json', root),
        16 * 1024 * 1024,
        ownedSignal,
      );
    const manifest = boundedJSON(new TextDecoder().decode(rawManifest), {
      maxBytes: 16 * 1024 * 1024,
      maxNodes: 500000,
      maxArray: 100000,
      maxDepth: 5,
    });
    exactKeys(
      manifest,
      ['formatVersion', 'version', 'sourceRevision', 'entry', 'totalBytes', 'files'],
      'Game package manifest',
    );
    requirePackage(
      manifest.formatVersion === 1 &&
        typeof manifest.version === 'string' &&
        manifest.version === current.version &&
        /^[a-f0-9]{40,64}$/.test(manifest.sourceRevision),
    );
    requirePackage(Array.isArray(manifest.files) && manifest.files.length <= 100000);
    const files = new Map();
    for (const row of manifest.files) {
      exactKeys(row, ['path', 'bytes', 'sha256'], 'Package member');
      requirePackage(
        typeof row.path === 'string' &&
          row.path.length <= 512 &&
          !files.has(row.path) &&
          !row.path.startsWith('/') &&
          !row.path.split('/').some((part) => ['.', '..', ''].includes(part)) &&
          !/[\\?#]/.test(row.path),
      );
      requirePackage(Number.isSafeInteger(row.bytes) && row.bytes >= 0 && HASH.test(row.sha256));
      files.set(row.path, row);
    }
    requirePackage(
      Number.isSafeInteger(manifest.totalBytes) &&
        manifest.totalBytes === [...files.values()].reduce((sum, row) => sum + row.bytes, 0) &&
        files.has(manifest.entry),
    );
    const wanted = [
      ...SURVIVAL_SUSPEND_RUNTIME_FILES,
      'game/build-info.json',
      'game/overflight/play.html',
      'game/overflight/app.mjs',
    ];
    const verified = new Map();
    // Small bounded batches keep cancellation responsive without holding a
    // second complete runtime in memory.
    for (let index = 0; index < wanted.length; index += 3) {
      await Promise.all(
        wanted.slice(index, index + 3).map(async (path) => {
          const row = files.get(path);
          requirePackage(row && row.bytes <= 8 * 1024 * 1024);
          const bytes = await readBytes(fetchImpl, new URL(path, root), row.bytes, ownedSignal);
          requirePackage(
            bytes.byteLength === row.bytes && (await sha256(bytes, cryptoImpl)) === row.sha256,
            `The packaged ${path} differs from its manifest.`,
          );
          if (path === 'game/build-info.json' || path.endsWith('.html'))
            verified.set(path, new TextDecoder().decode(bytes));
        }),
      );
    }
    const info = boundedJSON(verified.get('game/build-info.json'), {
      maxBytes: 4096,
      maxNodes: 20,
      maxDepth: 2,
    });
    requirePackage(
      info.formatVersion === 1 &&
        info.version === manifest.version &&
        info.sourceRevision === manifest.sourceRevision &&
        info.entry === manifest.entry,
    );
    requirePackage(
      htmlMarker(verified.get('game/overflight/play.html')).buildId === current.buildId,
      'The visible game belongs to another package. Reload before using saved flights.',
    );
    ownedSignal.throwIfAborted();
    const identity = validateSurvivalPackageIdentity({
      manifestSha256: await sha256(rawManifest, cryptoImpl),
      runtimeSha256: await sha256(
        new TextEncoder().encode(
          canonicalJSON({
            buildId: current.buildId,
            files: SURVIVAL_SUSPEND_RUNTIME_FILES.map((path) => files.get(path)),
          }),
        ),
        cryptoImpl,
      ),
      sourceRevision: manifest.sourceRevision,
    });
    ownedSignal.throwIfAborted();
    return Object.freeze(identity);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    controller.abort();
  }
}
