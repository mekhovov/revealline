import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import {
  prepareRegionalDownload,
  validateRegionalDescriptor,
} from '../optional-practice/civilian-fpv/regional-delivery.mjs';

// A bounded functional closure check. An optional authored region exercises real source bytes.
const hash = (data) => createHash('sha256').update(data).digest('hex');
const bytes = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v));
const contents = new Map();
const ref = (path, data) => {
  contents.set(path, data);
  return { path, bytes: data.length, sha256: hash(data) };
};
let descriptor;
if (process.argv[2]) {
  const directory = resolve(process.argv[2]);
  descriptor = JSON.parse(await readFile(resolve(directory, 'delivery.json'), 'utf8'));
  for (const item of descriptor.files)
    contents.set(item.path, await readFile(resolve(directory, item.path)));
} else {
  const grid = {
    cellSizeMm: 128000,
    minX: 0,
    minZ: 0,
    width: 1,
    depth: 1,
    floorMm: 0,
    ceilingMm: 80000,
  };
  const spawns = [{ id: 'start', position: { x: 64000, y: 3000, z: 64000 } }];
  const layers = ['terrain', 'scenery'].map((layer) => {
    const scene = ref(`${layer}/scene.glb`, bytes('synthetic visual bytes'));
    const collision = ref(`${layer}/collision.json`, bytes('{}'));
    return ref(
      `${layer}/region.json`,
      bytes({
        format: 'FPVRegionManifest.v1',
        id: 'paired-region',
        revision: 'r-one',
        title: { en: layer, uk: layer },
        grid,
        spawns,
        assets: [
          { ...scene, path: 'scene.glb', id: 'scene', kind: 'scene' },
          { ...collision, path: 'collision.json', id: 'collision', kind: 'collision' },
        ],
        chunks: [{ id: 'cell', x: 0, z: 0, assets: ['scene', 'collision'] }],
      }),
    );
  });
  const files = [...contents].map(([path, data]) => ({
    path,
    bytes: data.length,
    sha256: hash(data),
  }));
  descriptor = {
    format: 'FPVRegionalDelivery.v1',
    id: 'test-region',
    revision: 'r-one',
    title: { en: 'Region', uk: 'Регіон' },
    terrain: layers[0],
    scenery: layers[1],
    files,
    totalBytes: files.reduce((n, f) => n + f.bytes, 0),
  };
}
const descriptorBytes = bytes(descriptor);
const pin = {
  url: 'https://assets.example/immutable/delivery.json',
  bytes: descriptorBytes.length,
  sha256: hash(descriptorBytes),
};
const baseOptions = {
  pageURL: 'https://game.example/',
  fetchImpl: async (input) => {
    const path = new URL(input).pathname.replace('/immutable/', '');
    return new Response(path === 'delivery.json' ? descriptorBytes : contents.get(path), {
      status: contents.has(path) || path === 'delivery.json' ? 200 : 404,
    });
  },
};
const prepared = await prepareRegionalDownload(pin, baseOptions);
assert.equal(prepared.assets.size, descriptor.files.length + 1);
assert.equal(prepared.descriptor.totalBytes, descriptor.totalBytes);
let checks = 2;
for (const mutate of [
  (v) => {
    v.id = null;
  },
  (v) => {
    v.revision = null;
  },
  (v) => {
    v.extra = true;
  },
  (v) => {
    v.files[0].path = '../escape.json';
  },
  (v) => {
    v.files[0].path = 'encoded%2fescape.json';
  },
  (v) => {
    v.files.push({ ...v.files[0] });
  },
  (v) => {
    v.totalBytes++;
  },
  (v) => {
    v.files[0].path = '__descriptor.json';
  },
  (v) => {
    v.title.en = '';
  },
]) {
  const invalid = structuredClone(descriptor);
  mutate(invalid);
  assert.throws(() => validateRegionalDescriptor(invalid));
  checks++;
}
await assert.rejects(
  prepareRegionalDownload({ ...pin, sha256: '0'.repeat(64) }, baseOptions),
  /integrity/,
);
checks++;
const corruptPath = descriptor.files.find((f) => f.path.endsWith('.glb')).path;
await assert.rejects(
  prepareRegionalDownload(pin, {
    ...baseOptions,
    fetchImpl: async (input, options) => {
      if (new URL(input).pathname.endsWith(corruptPath)) {
        const corrupted = Buffer.from(contents.get(corruptPath));
        corrupted[0] ^= 1;
        return new Response(corrupted);
      }
      return baseOptions.fetchImpl(input, options);
    },
  }),
  /integrity/,
);
checks++;
const extra = structuredClone(descriptor);
const added = { path: 'extra.json', bytes: 2, sha256: hash(bytes('{}')) };
extra.files.push(added);
extra.totalBytes += 2;
const extraBytes = bytes(extra);
await assert.rejects(
  prepareRegionalDownload(
    { ...pin, bytes: extraBytes.length, sha256: hash(extraBytes) },
    {
      ...baseOptions,
      fetchImpl: async (input, options) =>
        new URL(input).pathname.endsWith('delivery.json')
          ? new Response(extraBytes)
          : baseOptions.fetchImpl(input, options),
    },
  ),
  /inventory/,
);
checks++;
const controller = new AbortController();
let canceled = false;
const pending = prepareRegionalDownload(pin, {
  ...baseOptions,
  signal: controller.signal,
  fetchImpl: async () =>
    new Response(
      new ReadableStream({
        cancel() {
          canceled = true;
        },
      }),
    ),
});
setTimeout(() => controller.abort(), 5);
await assert.rejects(pending, { name: 'AbortError' });
assert.equal(canceled, true);
checks += 2;
const mismatched = structuredClone(descriptor);
const terrain = JSON.parse(contents.get(descriptor.terrain.path));
terrain.grid.ceilingMm++;
const changedTerrain = bytes(terrain),
  changedRef = {
    ...descriptor.terrain,
    bytes: changedTerrain.length,
    sha256: hash(changedTerrain),
  };
mismatched.terrain = changedRef;
mismatched.files = mismatched.files.map((f) => (f.path === changedRef.path ? changedRef : f));
mismatched.totalBytes = mismatched.files.reduce((n, f) => n + f.bytes, 0);
const mismatchBytes = bytes(mismatched);
await assert.rejects(
  prepareRegionalDownload(
    { ...pin, bytes: mismatchBytes.length, sha256: hash(mismatchBytes) },
    {
      ...baseOptions,
      fetchImpl: async (input, options) => {
        const path = new URL(input).pathname;
        return path.endsWith('delivery.json')
          ? new Response(mismatchBytes)
          : path.endsWith(changedRef.path)
            ? new Response(changedTerrain)
            : baseOptions.fetchImpl(input, options);
      },
    },
  ),
  /grids/,
);
checks++;
// Re-pin both the edited manifest and its descriptor, so rejection proves the
// pairing contract rather than merely detecting a stale content hash.
for (const [mutate, reason] of [
  [
    (m) => {
      m.id = 'another-region';
    },
    /layer identities/,
  ],
  [
    (m) => {
      m.revision = 'another-revision';
    },
    /layer identities/,
  ],
  [
    (m) => {
      m.chunks[0].id = 'another-cell';
    },
    /cell identities/,
  ],
]) {
  const altered = structuredClone(descriptor);
  const manifest = JSON.parse(contents.get(descriptor.scenery.path));
  mutate(manifest);
  const manifestBytes = bytes(manifest);
  const manifestRef = {
    ...altered.scenery,
    bytes: manifestBytes.length,
    sha256: hash(manifestBytes),
  };
  altered.scenery = manifestRef;
  altered.files = altered.files.map((f) => (f.path === manifestRef.path ? manifestRef : f));
  altered.totalBytes = altered.files.reduce((n, f) => n + f.bytes, 0);
  const alteredBytes = bytes(altered);
  const fetched = [];
  await assert.rejects(
    prepareRegionalDownload(
      { ...pin, bytes: alteredBytes.length, sha256: hash(alteredBytes) },
      {
        ...baseOptions,
        fetchImpl: async (input, options) => {
          const path = new URL(input).pathname.replace('/immutable/', '');
          fetched.push(path);
          return path === 'delivery.json'
            ? new Response(alteredBytes)
            : path === manifestRef.path
              ? new Response(manifestBytes)
              : baseOptions.fetchImpl(input, options);
        },
      },
    ),
    reason,
  );
  assert.deepEqual(
    new Set(fetched),
    new Set(['delivery.json', descriptor.terrain.path, descriptor.scenery.path]),
  );
  checks += 2;
}
await assert.rejects(
  prepareRegionalDownload(pin, {
    ...baseOptions,
    fetchImpl: async () => new Response(new Uint8Array(pin.bytes + 1)),
  }),
  /size/,
);
checks++;
const preAborted = new AbortController();
preAborted.abort();
let requests = 0;
await assert.rejects(
  prepareRegionalDownload(pin, {
    ...baseOptions,
    signal: preAborted.signal,
    fetchImpl: async () => {
      requests++;
      return new Response(descriptorBytes);
    },
  }),
  { name: 'AbortError' },
);
assert.equal(requests, 0);
checks += 2;
console.log(
  JSON.stringify({
    status: 'pass',
    checks,
    source: process.argv[2] ? 'authored source' : 'synthetic closure only',
    files: descriptor.files.length,
    totalBytes: descriptor.totalBytes,
    scope:
      'Descriptor and full-byte download verification; storage/native flight tested separately',
  }),
);
