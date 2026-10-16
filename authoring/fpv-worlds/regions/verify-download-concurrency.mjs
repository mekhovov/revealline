/** Functional delivery review: real compiler/manifests/hash checks with scheduled streams. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileTerrainCell, TERRAIN_FORMAT } from './terrain-cell.mjs';
import { prepareRegionalDownload } from '../../../optional-practice/civilian-fpv/regional-delivery.mjs';
const encode = (value) => new TextEncoder().encode(JSON.stringify(value));
const hash = (value) => createHash('sha256').update(value).digest('hex');
function fixture(badPair = false) {
  const bodies = new Map(),
    assets = [],
    chunks = [];
  for (let x = 0; x < 8; x++) {
    const cell = {
        format: TERRAIN_FORMAT,
        chunkId: `tile-${x}`,
        x,
        z: 0,
        cellSizeMm: 128000,
        samples: 33,
        heightsMm: Array(1089).fill(0),
      },
      ids = [];
    for (const [kind, data] of [
      ['scene', compileTerrainCell(cell).glb],
      ['collision', encode(cell)],
    ]) {
      const id = `tile-${x}-${kind}`,
        path = `${id}.${kind === 'scene' ? 'glb' : 'json'}`;
      bodies.set(`terrain/${path}`, data);
      ids.push(id);
      assets.push({ id, kind, path, bytes: data.length, sha256: hash(data) });
    }
    chunks.push({ id: cell.chunkId, x, z: 0, assets: ids });
  }
  const terrain = {
    format: 'FPVRegionManifest.v1',
    id: 'download-review',
    revision: 'r1',
    title: { en: 'Review', uk: 'Огляд' },
    grid: {
      cellSizeMm: 128000,
      minX: 0,
      minZ: 0,
      width: 8,
      depth: 1,
      floorMm: -1000,
      ceilingMm: 100000,
    },
    assets,
    chunks,
    spawns: [{ id: 'start', position: { x: 64000, y: 10000, z: 6000 } }],
  };
  const scenery = {
    ...terrain,
    format: 'FPVSceneryManifest.v1',
    revision: badPair ? 'wrong' : 'r1',
    assets: [],
    chunks: chunks.map((c) => ({ ...c, assets: [] })),
  };
  const refs = {};
  for (const [layer, manifest] of [
    ['terrain', terrain],
    ['scenery', scenery],
  ]) {
    const path = `${layer}/region.json`,
      data = encode(manifest);
    bodies.set(path, data);
    refs[layer] = { path, bytes: data.length, sha256: hash(data) };
  }
  const files = [...bodies].map(([path, data]) => ({
    path,
    bytes: data.length,
    sha256: hash(data),
  }));
  const descriptor = {
    format: 'FPVRegionalDelivery.v2',
    id: 'download-review',
    revision: 'r1',
    title: terrain.title,
    ...refs,
    files,
    totalBytes: files.reduce((n, f) => n + f.bytes, 0),
  };
  const data = encode(descriptor);
  bodies.set('delivery.json', data);
  return {
    bodies,
    descriptor,
    pin: { url: 'https://review.invalid/delivery.json', bytes: data.length, sha256: hash(data) },
  };
}
function transport(f, { fail, abort, slow = false } = {}) {
  const trace = [],
    counters = { active: 0, peak: 0, cancelled: 0 },
    completed = new Set();
  const fetchImpl = async (url, options) => {
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    const path = new URL(url).pathname.slice(1),
      payload = !['delivery.json', 'terrain/region.json', 'scenery/region.json'].includes(path);
    if (payload) {
      assert(completed.has('terrain/region.json'));
      assert(completed.has('scenery/region.json'));
    }
    trace.push(path);
    const original = f.bodies.get(path);
    assert(original);
    let data = original;
    if (path === fail) {
      data = original.slice();
      data[data.length - 1] ^= 1;
    }
    return new Response(
      new ReadableStream({
        start(controller) {
          let ended = false,
            timer;
          counters.active++;
          counters.peak = Math.max(counters.peak, counters.active);
          const finish = () => {
            if (ended) return false;
            ended = true;
            clearTimeout(timer);
            options.signal?.removeEventListener('abort', cancel);
            counters.active--;
            return true;
          };
          const cancel = () => {
            if (finish()) {
              counters.cancelled++;
              controller.error(options.signal.reason);
            }
          };
          options.signal?.addEventListener('abort', cancel, { once: true });
          if (options.signal?.aborted) {
            cancel();
            return;
          }
          // Unequal delays deliberately complete files out of inventory order.
          const delay = payload ? (path === fail ? 1 : slow ? 60 : 3 + (trace.length % 4) * 4) : 0;
          timer = setTimeout(() => {
            if (finish()) {
              completed.add(path);
              controller.enqueue(data);
              controller.close();
            }
          }, delay);
          if (
            payload &&
            abort &&
            trace.filter((p) => !p.endsWith('region.json') && p !== 'delivery.json').length === 4
          )
            abort.abort(new DOMException('Review cancellation', 'AbortError'));
        },
      }),
    );
  };
  return { fetchImpl, trace, counters };
}
const f = fixture(),
  normal = transport(f),
  progress = [];
const result = await prepareRegionalDownload(f.pin, {
  pageURL: 'https://review.invalid/sim',
  fetchImpl: normal.fetchImpl,
  onProgress: (p) => progress.push(p),
});
assert.equal(normal.counters.peak, 4);
assert.equal(normal.counters.active, 0);
assert.equal(normal.trace.length, f.descriptor.files.length + 1);
assert.equal(new Set(normal.trace).size, normal.trace.length);
assert.deepEqual(
  [...result.assets.keys()],
  [...f.descriptor.files.map((f) => f.path), '__descriptor.json'],
);
for (const file of f.descriptor.files)
  assert.equal(hash(new Uint8Array(await result.assets.get(file.path).arrayBuffer())), file.sha256);
assert(
  progress.every(
    (p, i) => p.loadedBytes <= p.totalBytes && (!i || p.loadedBytes >= progress[i - 1].loadedBytes),
  ),
);
assert.equal(progress.at(-1).phase, 'verify');
assert.equal(progress.at(-1).loadedBytes, f.descriptor.totalBytes);
const invalid = fixture(true),
  bad = transport(invalid);
await assert.rejects(
  prepareRegionalDownload(invalid.pin, {
    pageURL: 'https://review.invalid/',
    fetchImpl: bad.fetchImpl,
  }),
  /identities/,
);
assert.equal(bad.trace.length, 3);
const corrupt = transport(f, { fail: f.descriptor.files[0].path, slow: true });
await assert.rejects(
  prepareRegionalDownload(f.pin, {
    pageURL: 'https://review.invalid/',
    fetchImpl: corrupt.fetchImpl,
  }),
  /integrity/,
);
assert.equal(corrupt.counters.active, 0);
assert(corrupt.counters.cancelled >= 1);
assert.equal(corrupt.trace.length, 7);
const controller = new AbortController(),
  cancelled = transport(f, { abort: controller, slow: true }),
  cancelProgress = [];
await assert.rejects(
  prepareRegionalDownload(f.pin, {
    pageURL: 'https://review.invalid/',
    fetchImpl: cancelled.fetchImpl,
    signal: controller.signal,
    onProgress: (p) => cancelProgress.push(p),
  }),
  { name: 'AbortError' },
);
assert.equal(cancelled.counters.active, 0);
assert.equal(cancelled.trace.length, 7);
assert(cancelled.counters.cancelled >= 1);
const before = cancelProgress.length;
await new Promise((r) => setTimeout(r, 80));
assert.equal(cancelProgress.length, before);
const pre = new AbortController();
pre.abort();
const untouched = transport(f);
await assert.rejects(
  prepareRegionalDownload(f.pin, {
    pageURL: 'https://review.invalid/',
    fetchImpl: untouched.fetchImpl,
    signal: pre.signal,
  }),
  { name: 'AbortError' },
);
assert.equal(untouched.trace.length, 0);
console.log(
  JSON.stringify({
    passed: true,
    groups: 5,
    payloads: 16,
    maxConcurrentRequests: normal.counters.peak,
    exactBytes: true,
    stableInventory: true,
    closureBeforePayload: true,
    cancelledPeersSettled: true,
    lateProgress: 0,
  }),
);
