import { openWorldStore } from './world-store.mjs';
import {
  validateRegionManifest,
  REGION_FORMAT,
  SPARSE_SCENERY_FORMAT,
} from './regional/region-manifest.mjs';

// Regional installs deliberately use a separate database and format from scored WorldPacks.
export const REGIONAL_DELIVERY_FORMAT = 'FPVRegionalDelivery.v1';
export const SPARSE_REGIONAL_DELIVERY_FORMAT = 'FPVRegionalDelivery.v2';
export const REGIONAL_DELIVERY_LIMITS = Object.freeze({
  descriptorBytes: 1024 * 1024,
  manifestBytes: 8 * 1024 * 1024,
  totalBytes: 64 * 1024 * 1024,
  files: 8194,
});
const assert = (ok, message) => {
  if (!ok) throw new TypeError(message);
};
const keys = (v, names) =>
  assert(
    v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      Object.keys(v).length === names.length &&
      names.every((k) => Object.hasOwn(v, k)),
    'Unexpected regional descriptor fields',
  );
const hashPattern = /^[a-f0-9]{64}$/;
const slug = /^[a-z][a-z0-9-]{0,63}$/;
const pathPattern = /^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:glb|json|png|jpg|jpeg)$/;
const positive = (v, max) => Number.isSafeInteger(v) && v > 0 && v <= max;
const decode = (bytes) => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
const digest = async (bytes) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
const same = (a, b) => a.path === b.path && a.bytes === b.bytes && a.sha256 === b.sha256;
function file(value, max = REGIONAL_DELIVERY_LIMITS.totalBytes) {
  keys(value, ['path', 'bytes', 'sha256']);
  assert(
    typeof value.path === 'string' && value.path.length <= 240 && pathPattern.test(value.path),
    'Unsafe regional path',
  );
  assert(
    positive(value.bytes, max) &&
      typeof value.sha256 === 'string' &&
      hashPattern.test(value.sha256),
    'Invalid regional file pin',
  );
}
export function validateRegionalDescriptor(input) {
  const text = typeof input === 'string' ? input : JSON.stringify(input);
  assert(
    typeof text === 'string' &&
      new TextEncoder().encode(text).length <= REGIONAL_DELIVERY_LIMITS.descriptorBytes,
    'Regional descriptor too large',
  );
  const v = JSON.parse(text);
  keys(v, ['format', 'id', 'revision', 'title', 'terrain', 'scenery', 'files', 'totalBytes']);
  assert(
    [REGIONAL_DELIVERY_FORMAT, SPARSE_REGIONAL_DELIVERY_FORMAT].includes(v.format) &&
      typeof v.id === 'string' &&
      slug.test(v.id) &&
      typeof v.revision === 'string' &&
      slug.test(v.revision),
    'Invalid regional identity',
  );
  keys(v.title, ['en', 'uk']);
  assert(
    Object.values(v.title).every((s) => typeof s === 'string' && s.trim() && s.length <= 120),
    'Regional titles required',
  );
  for (const layer of [v.terrain, v.scenery]) {
    file(layer, REGIONAL_DELIVERY_LIMITS.manifestBytes);
    assert(layer.path.endsWith('.json'), 'Regional manifest must be JSON');
  }
  assert(v.terrain.path !== v.scenery.path, 'Regional layers must be distinct');
  assert(
    Array.isArray(v.files) &&
      v.files.length >= 2 &&
      v.files.length <= REGIONAL_DELIVERY_LIMITS.files,
    'Invalid regional file count',
  );
  const paths = new Set();
  let total = 0;
  for (const item of v.files) {
    file(item);
    assert(
      item.path.toLowerCase() !== '__descriptor.json' && !paths.has(item.path.toLowerCase()),
      'Duplicate or reserved regional path',
    );
    paths.add(item.path.toLowerCase());
    total += item.bytes;
  }
  assert(
    positive(v.totalBytes, REGIONAL_DELIVERY_LIMITS.totalBytes) && total === v.totalBytes,
    'Regional byte total mismatch',
  );
  assert(
    [v.terrain, v.scenery].every((ref) => v.files.some((item) => same(item, ref))),
    'Manifest pins missing from regional inventory',
  );
  return v;
}
function sourceURL(value, pageURL) {
  assert(typeof value === 'string' && value.length > 0, 'Regional source URL required');
  const page = new URL(pageURL),
    url = new URL(value, page);
  assert(
    (url.protocol === 'https:' || (url.protocol === 'http:' && url.origin === page.origin)) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash,
    'Unsafe regional source URL',
  );
  return url;
}
async function verifiedBytes(response, pin, signal, progress) {
  assert(response.ok && response.body && !response.redirected, 'Regional file download failed');
  const reader = response.body.getReader(),
    parts = [];
  let size = 0;
  const cancel = () => {
    reader.cancel(signal.reason).catch(() => {});
  };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      size += value.length;
      assert(size <= pin.bytes, 'Regional file exceeds pinned size');
      parts.push(value);
      progress?.(value.length);
    }
  } finally {
    signal?.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  signal?.throwIfAborted();
  assert(size === pin.bytes, 'Regional file size mismatch');
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  assert((await digest(bytes)) === pin.sha256, 'Regional file integrity mismatch');
  signal?.throwIfAborted();
  return bytes;
}
export async function inspectRegionalDownload(
  pin,
  { pageURL, fetchImpl = globalThis.fetch, signal, onActivity } = {},
) {
  keys(pin, ['url', 'bytes', 'sha256']);
  assert(
    positive(pin.bytes, REGIONAL_DELIVERY_LIMITS.descriptorBytes) &&
      typeof pin.sha256 === 'string' &&
      hashPattern.test(pin.sha256),
    'Invalid regional descriptor pin',
  );
  const url = sourceURL(pin.url, pageURL);
  signal?.throwIfAborted();
  const bytes = await verifiedBytes(
    await fetchImpl(url.href, {
      signal,
      credentials: 'omit',
      redirect: 'error',
    }),
    pin,
    signal,
    onActivity,
  );
  return {
    descriptor: validateRegionalDescriptor(decode(bytes)),
    sha256: pin.sha256,
    pin: { ...pin, url: url.href },
    bytes,
  };
}
export async function prepareRegionalDownload(pin, options = {}) {
  const checked = await inspectRegionalDownload(pin, options);
  const { descriptor, bytes } = checked;
  const base = new URL('.', checked.pin.url),
    blobs = new Map();
  let loaded = 0;
  const notify = (phase) =>
    options.onProgress?.({
      phase,
      loadedBytes: loaded,
      totalBytes: descriptor.totalBytes,
    });
  // Four verified requests at a time bound connection/buffer pressure. The descriptor
  // already bounds the entire inventory; no payload starts before both manifests agree.
  const controller = new AbortController(),
    signal = controller.signal,
    cancel = () => controller.abort(options.signal.reason);
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const acquire = async (item) => {
    signal.throwIfAborted();
    const response = await (options.fetchImpl ?? globalThis.fetch)(new URL(item.path, base).href, {
      signal,
      credentials: 'omit',
      redirect: 'error',
    });
    const data = await verifiedBytes(response, item, signal, (n) => {
      loaded += n;
      notify('download');
    });
    blobs.set(item.path, data);
  };
  try {
    await acquire(descriptor.terrain);
    await acquire(descriptor.scenery);
    validatePair(descriptor, blobs);
    const manifestPaths = new Set([descriptor.terrain.path, descriptor.scenery.path]),
      files = descriptor.files.filter((item) => !manifestPaths.has(item.path));
    let next = 0;
    const worker = async () => {
      try {
        while (next < files.length) {
          signal.throwIfAborted();
          await acquire(files[next++]);
        }
      } catch (error) {
        // Preserve the first failure, abort peers and wait for every worker to settle
        // before rejecting. No progress or later file may escape into a new attempt.
        controller.abort(error);
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, files.length) }, worker));
    signal.throwIfAborted();
    notify('verify');
    signal.throwIfAborted();
    // Completion order is deliberately not the stored inventory order.
    const assets = new Map(descriptor.files.map(({ path }) => [path, new Blob([blobs.get(path)])]));
    assets.set('__descriptor.json', new Blob([bytes]));
    return { ...checked, assets };
  } finally {
    options.signal?.removeEventListener('abort', cancel);
  }
}

function validatePair(descriptor, blobs) {
  const manifests = [descriptor.terrain, descriptor.scenery].map((ref) =>
    validateRegionManifest(decode(blobs.get(ref.path))),
  );
  const [terrain, scenery] = manifests;
  assert(terrain.format === REGION_FORMAT, 'Regional terrain profile must be complete');
  assert(
    scenery.format ===
      (descriptor.format === SPARSE_REGIONAL_DELIVERY_FORMAT
        ? SPARSE_SCENERY_FORMAT
        : REGION_FORMAT),
    'Regional delivery does not admit this scenery profile',
  );
  assert(
    terrain.id === scenery.id && terrain.revision === scenery.revision,
    'Regional layer identities do not match',
  );
  const sceneryChunks = new Map(scenery.chunks.map((chunk) => [chunk.id, chunk]));
  assert(
    terrain.chunks.every(
      (chunk) =>
        sceneryChunks.get(chunk.id)?.x === chunk.x && sceneryChunks.get(chunk.id)?.z === chunk.z,
    ),
    'Regional layer cell identities do not match',
  );
  const ordered = (v) => JSON.stringify(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)));
  assert(ordered(terrain.grid) === ordered(scenery.grid), 'Regional layer grids do not match');
  const spawns = (m) =>
    JSON.stringify(
      [...m.spawns]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((s) => [s.id, s.position.x, s.position.y, s.position.z]),
    );
  assert(spawns(terrain) === spawns(scenery), 'Regional layer spawns do not match');
  const expected = new Map([descriptor.terrain, descriptor.scenery].map((ref) => [ref.path, ref]));
  for (let i = 0; i < manifests.length; i++) {
    const ref = [descriptor.terrain, descriptor.scenery][i];
    const prefix = ref.path.slice(0, ref.path.lastIndexOf('/') + 1);
    for (const asset of manifests[i].assets) {
      const item = {
        path: prefix + asset.path,
        bytes: asset.bytes,
        sha256: asset.sha256,
      };
      assert(
        !expected.has(item.path) || same(expected.get(item.path), item),
        'Conflicting regional layer asset',
      );
      expected.set(item.path, item);
    }
  }
  assert(
    expected.size === descriptor.files.length &&
      descriptor.files.every(
        (item) => expected.has(item.path) && same(item, expected.get(item.path)),
      ),
    'Regional inventory does not match manifest dependencies',
  );
  return manifests;
}

export async function openRegionalLibrary({
  indexedDB = globalThis.indexedDB,
  name = 'revealline-fpv-regions-v1',
} = {}) {
  const store = await openWorldStore({ indexedDB, name });
  const metadata = (row) => ({
    id: row.id,
    sha256: row.sha256,
    active: row.active,
    generation: row.generation,
    descriptor: row.project.descriptor,
    bytes: row.project.descriptor.totalBytes,
  });
  return {
    inspect: inspectRegionalDownload,
    generation: store.generation,
    async list(options) {
      return (await store.list(options)).map(metadata);
    },
    async install(pin, options = {}) {
      const generation = await store.generation();
      const checked = await prepareRegionalDownload(pin, options);
      const { descriptor, sha256, assets } = checked;
      options.signal?.throwIfAborted();
      // Once this atomic commit starts, success is reported even if UI cancellation arrives later.
      options.onProgress?.({
        phase: 'commit',
        loadedBytes: descriptor.totalBytes,
        totalBytes: descriptor.totalBytes,
      });
      const result = await store.install({
        project: {
          id: descriptor.id,
          title: descriptor.title.en,
          format: descriptor.format,
          descriptor,
          pin: checked.pin,
        },
        assets,
        sha256,
        expectedGeneration: generation,
      });
      return {
        id: descriptor.id,
        sha256,
        generation: result.generation,
        descriptor,
      };
    },
    async load(id, { sha256 } = {}) {
      const record = await store.get(id, { sha256 });
      assert(record, 'This exact regional revision is not installed');
      const descriptorBlob = record.assets.get('__descriptor.json');
      assert(descriptorBlob, 'Installed regional descriptor is missing');
      const descriptorBytes = await verifiedBytes(new Response(descriptorBlob), {
        bytes: record.project.pin.bytes,
        sha256: record.sha256,
      });
      const descriptor = validateRegionalDescriptor(decode(descriptorBytes));
      assert(descriptor.id === id, 'Installed regional identity mismatch');
      const blobs = new Map();
      for (const item of descriptor.files) {
        const blob = record.assets.get(item.path);
        assert(blob, 'Installed regional file is missing');
        blobs.set(item.path, await verifiedBytes(new Response(blob), item));
      }
      const [manifest, sceneryManifest] = validatePair(descriptor, blobs);
      // A synthetic origin binds requests to this exact retained revision; no network fallback.
      const base = new URL(`https://regional-cache.invalid/${record.sha256}/`);
      const fetchImpl = async (input, { signal } = {}) => {
        signal?.throwIfAborted();
        const url = new URL(typeof input === 'string' ? input : (input.url ?? input.href));
        assert(
          url.origin === base.origin && url.href.startsWith(base.href) && !url.search && !url.hash,
          'Unknown installed regional source',
        );
        const path = url.pathname.slice(base.pathname.length);
        assert(blobs.has(path), 'Installed regional asset is not declared');
        return new Response(blobs.get(path));
      };
      const source = (ref) => ({
        baseURL: new URL('.', new URL(ref.path, base)).href,
        fetchImpl,
      });
      return {
        manifest,
        source: source(descriptor.terrain),
        scenery: {
          manifest: sceneryManifest,
          source: source(descriptor.scenery),
        },
        geometryProfile: 'terrain-scenery-v1',
      };
    },
    activate: store.activate,
    async removalSnapshot(id, { sha256 } = {}) {
      const snapshot = await store.removalSnapshot(id);
      if (!snapshot) return null;
      const entries = (await store.list({ includeRevisions: true })).filter((row) => row.id === id);
      if (sha256 !== undefined) {
        assert(/^[a-f0-9]{64}$/.test(sha256), 'Review an exact regional revision');
        const selected = entries.find((row) => row.sha256 === sha256);
        assert(
          selected && snapshot.revisions.some((row) => row.sha256 === sha256),
          'This regional revision is no longer installed',
        );
        return {
          ...snapshot,
          sha256,
          revision: selected.project.descriptor.revision,
          bytes: selected.project.descriptor.totalBytes,
        };
      }
      return {
        ...snapshot,
        bytes: entries.reduce((n, row) => n + row.project.descriptor.totalBytes, 0),
      };
    },
    removeRevision(id, sha256, { expectedGeneration } = {}) {
      assert(Number.isSafeInteger(expectedGeneration), 'Review regional removal before deleting');
      return store.removeRevision(id, sha256, { expectedGeneration });
    },
    remove(id, { expectedGeneration } = {}) {
      assert(Number.isSafeInteger(expectedGeneration), 'Review regional removal before deleting');
      return store.remove(id, { expectedGeneration });
    },
    close: store.close,
  };
}
