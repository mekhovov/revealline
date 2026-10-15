/** Execute the complete production Library load method with an injected read-only store. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const sourceURL = new URL(
  '../../../optional-practice/civilian-fpv/regional-delivery.mjs',
  import.meta.url,
);
const hash = (b) => createHash('sha256').update(b).digest('hex');
const assets = new Map(),
  files = [],
  refs = {};
const terrain = {
  format: 'FPVRegionManifest.v1',
  id: 'cancel-review',
  revision: 'r1',
  title: { en: 'Review', uk: 'Огляд' },
  grid: {
    cellSizeMm: 128000,
    minX: 0,
    minZ: 0,
    width: 2,
    depth: 1,
    floorMm: -1000,
    ceilingMm: 100000,
  },
  spawns: [{ id: 'start', position: { x: 6000, y: 10000, z: 6000 } }],
  assets: [],
  chunks: [],
};
for (let x = 0; x < 2; x++) {
  const ids = [];
  for (const kind of ['scene', 'collision']) {
    const data = Buffer.from('Pinned load fixture ' + x + kind),
      id = 'cell-' + x + '-' + kind,
      path = id + (kind === 'scene' ? '.glb' : '.json');
    const item = { id, kind, path, bytes: data.length, sha256: hash(data) };
    terrain.assets.push(item);
    ids.push(id);
    files.push({ path: 'terrain/' + path, bytes: data.length, sha256: hash(data) });
    assets.set('terrain/' + path, new Blob([data]));
  }
  terrain.chunks.push({ id: 'cell-' + x, x, z: 0, assets: ids });
}
const scenery = {
  ...terrain,
  format: 'FPVSceneryManifest.v1',
  assets: [],
  chunks: terrain.chunks.map((c) => ({ ...c, assets: [] })),
};
for (const [layer, manifest] of [
  ['terrain', terrain],
  ['scenery', scenery],
]) {
  const data = Buffer.from(JSON.stringify(manifest));
  const item = { path: layer + '/region.json', bytes: data.length, sha256: hash(data) };
  files.push(item);
  refs[layer] = item;
  assets.set(item.path, new Blob([data]));
}
const descriptor = {
  format: 'FPVRegionalDelivery.v2',
  id: terrain.id,
  revision: terrain.revision,
  title: terrain.title,
  ...refs,
  files,
  totalBytes: files.reduce((n, f) => n + f.bytes, 0),
};
const data = Buffer.from(JSON.stringify(descriptor));
assets.set('__descriptor.json', new Blob([data]));
const record = {
  assets,
  sha256: hash(data),
  project: { pin: { bytes: data.length, sha256: hash(data) } },
};
let currentStore;
globalThis.__regionalLoadReadOnlyStore = () => currentStore;
let source = await readFile(sourceURL, 'utf8');
// Substitute only the persistence dependency; execute the full production method unchanged.
source = source.replace(
  "import { openWorldStore } from './world-store.mjs';",
  'const openWorldStore = async () => globalThis.__regionalLoadReadOnlyStore();',
);
source = source.replace(
  "'./regional/region-manifest.mjs'",
  JSON.stringify(new URL('./regional/region-manifest.mjs', sourceURL).href),
);
const candidate = await import(
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
);
const NativeResponse = globalThis.Response;
async function scenario(module, kind) {
  const controller = new AbortController();
  let gets = 0,
    responses = 0,
    cancelled = 0;
  currentStore = {
    get: async () => {
      gets++;
      if (kind === 'during-store-read')
        controller.abort(new DOMException('cancel during storage', 'AbortError'));
      return record;
    },
  };
  const api = await module.openRegionalLibrary();
  globalThis.Response = class extends NativeResponse {
    constructor(blob) {
      responses++;
      if (kind === 'during-reader' && responses === 2) {
        super(
          new ReadableStream({
            start() {
              queueMicrotask(() =>
                controller.abort(new DOMException('cancel during payload', 'AbortError')),
              );
            },
            cancel() {
              cancelled++;
            },
          }),
        );
      } else super(blob);
    }
  };
  if (kind === 'before-store-read')
    controller.abort(new DOMException('cancel before storage', 'AbortError'));
  const promise = api.load(terrain.id, { sha256: record.sha256, signal: controller.signal });
  if (kind === 'normal') {
    const config = await promise;
    assert.equal(config.manifest.id, terrain.id);
    assert.equal(config.geometryProfile, 'terrain-scenery-v1');
    assert.equal(responses, files.length + 1);
  } else {
    await assert.rejects(promise, { name: 'AbortError' });
    assert.equal(responses, kind === 'during-reader' ? 2 : 0);
    assert.equal(gets, kind === 'before-store-read' ? 0 : 1);
    if (kind === 'during-reader') assert.equal(cancelled, 1);
  }
  globalThis.Response = NativeResponse;
  return { kind, gets, responses, cancelled };
}
const results = [];
try {
  for (const kind of ['normal', 'before-store-read', 'during-store-read', 'during-reader'])
    results.push(await scenario(candidate, kind));
} finally {
  globalThis.Response = NativeResponse;
  delete globalThis.__regionalLoadReadOnlyStore;
}
console.log(
  JSON.stringify(
    {
      passed: true,
      results,
      boundary:
        'Full actual load method, read-only injected store; no native IDB or player timing claim',
    },
    null,
    2,
  ),
);
