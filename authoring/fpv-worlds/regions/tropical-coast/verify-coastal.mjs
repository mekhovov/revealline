/** Exact-source, real collider and owner lifecycle checks; no player-store mutation. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import validator from 'gltf-validator';
import { createVerifiedMixedWindow } from '../verified-mixed-window.mjs';
const root = resolve(process.argv[2] ?? '');
assert(process.argv[2], 'Provide prepared coastal source directory');
const prep = JSON.parse(
  await readFile(
    process.argv[3]
      ? resolve(process.argv[3])
      : new URL('./coastal-preparation.json', import.meta.url),
  ),
);
const manifests = {},
  sources = {},
  originals = [];
let canonicalGLBs = 0,
  visualOnly = 0,
  solid = 0;
for (const layer of ['terrain', 'scenery']) {
  const directory = resolve(root, layer),
    manifestBytes = await readFile(resolve(directory, 'region.json'));
  assert.equal(
    createHash('sha256').update(manifestBytes).digest('hex'),
    prep[layer + 'ManifestSHA256'],
  );
  const manifest = JSON.parse(manifestBytes);
  manifests[layer] = manifest;
  const bodies = new Map();
  for (const asset of manifest.assets) {
    const file = resolve(directory, asset.path),
      bytes = await readFile(file);
    assert.equal(bytes.length, asset.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    originals.push([file, bytes]);
    bodies.set('/' + asset.path, bytes);
    if (asset.kind === 'scene') {
      const result = await validator.validateBytes(bytes);
      assert.equal(result.issues.numErrors, 0, asset.path);
      assert.equal(result.issues.numWarnings, 0, asset.path);
      canonicalGLBs++;
    }
    if (layer === 'scenery' && asset.kind === 'collision') {
      const data = JSON.parse(bytes);
      for (const binding of data.bindings) {
        if (binding.collision === 'visual-only') visualOnly++;
        else solid++;
        if (binding.surfaceId.startsWith('stilt-hut'))
          assert.equal(binding.collision, 'solid', 'Cutout thatch/planks must remain solid');
      }
    }
  }
  sources[layer] = {
    baseURL: `https://${layer}.invalid/`,
    surfaceStyle: layer === 'terrain' ? 'tropical' : 'plain',
    fetchImpl: async (url) =>
      new Response(bodies.get(new URL(url).pathname), {
        status: bodies.has(new URL(url).pathname) ? 200 : 404,
      }),
  };
}
const mm = (p) => ({
  x: Math.round(p[0] * 1000),
  y: Math.round(p[1] * 1000),
  z: Math.round(p[2] * 1000),
});
const probes = prep.verificationProbes ?? [
  {
    id: 'covered-pier-open-bay',
    from: [65, 4.4, 102],
    to: [95, 4.4, 102],
    clear: true,
  },
  {
    id: 'covered-pier-below-deck',
    from: [65, 0.7, 102],
    to: [95, 0.7, 102],
    clear: true,
  },
  {
    id: 'covered-pier-roof',
    from: [76, 12, 102],
    to: [76, 4, 102],
    clear: false,
  },
  {
    id: 'covered-pier-deck',
    from: [84, 5, 102],
    to: [84, -1, 102],
    clear: false,
  },
  {
    id: 'open-pier-deck',
    from: [190, 8, 100],
    to: [190, 2, 100],
    clear: false,
  },
  {
    id: 'palm-solid-trunk',
    from: [60, 7, 180.5],
    to: [69, 7, 180.5],
    clear: false,
  },
  {
    id: 'palm-visual-leaf-canopy',
    from: [62, 16, 180],
    to: [62, 10, 180],
    clear: true,
  },
  {
    id: 'hut-solid-roof',
    from: [190, 15, 196],
    to: [190, 7, 196],
    clear: false,
  },
  {
    id: 'cargo-solid-box',
    from: [182, 3.6, 292],
    to: [190, 3.6, 292],
    clear: false,
  },
  { id: 'sea-visual-only', from: [20, 2, 20], to: [20, -2, 20], clear: true },
];
const results = [],
  windows = [];
for (const quality of ['performance', 'balanced', 'quality']) {
  const owner = createVerifiedMixedWindow(manifests.terrain, {
    source: { ...sources.terrain, surfaceQuality: quality },
    scenery: { manifest: manifests.scenery, source: sources.scenery },
  });
  try {
    await owner.transition(mm([prep.sizeM[0] / 2, 60, prep.sizeM[1] / 2]));
    for (const probe of probes) {
      const hit = owner.sweep(mm(probe.from), mm(probe.to), 250);
      if (process.env.DIAG) console.error(probe.id, JSON.stringify(hit));
      assert.equal(hit.status, probe.clear ? 'terrain-clear' : 'terrain-hit', probe.id);
      if (!probe.clear) assert.equal(hit.layer, 'scenery', probe.id);
      results.push({ quality, id: probe.id, status: hit.status });
    }
    for (const [x, z] of [
      [64, 64],
      [192, 64],
      [320, 64],
      [320, 192],
      [320, 320],
      [192, 320],
      [64, 320],
      [64, 192],
      [192, 192],
    ]) {
      const worldX = (x * prep.sizeM[0]) / 384;
      const worldZ = (z * prep.sizeM[1]) / 384;
      await owner.transition(mm([worldX, 60, worldZ]));
      const snap = owner.snapshot();
      assert.equal(snap.state, 'ready');
      assert(snap.resourceBytes * 2 <= 8 * 1024 * 1024);
      assert(snap.reservedGeometryBytes <= 8 * 1024 * 1024);
      assert(snap.reservedSourceBytes <= 16 * 1024 * 1024);
      windows.push({
        quality,
        x: worldX,
        z: worldZ,
        geometryBytes: snap.geometryBytes,
        textureBytes: snap.textureBytes,
        resourceBytes: snap.resourceBytes,
        collision: owner.collisionSnapshot(),
      });
    }
  } finally {
    await owner.dispose();
    for (const key of [
      'geometryBytes',
      'textureBytes',
      'resourceBytes',
      'sourceBytes',
      'reservedGeometryBytes',
      'reservedSourceBytes',
    ])
      assert.equal(owner.snapshot()[key], 0, key);
    const counts = owner.collisionSnapshot();
    assert(
      Object.values(counts)
        .filter(Number.isFinite)
        .every((n) => n === 0),
      JSON.stringify(counts),
    );
    assert.equal(owner.group, null);
  }
}
for (const [file, bytes] of originals) assert.deepEqual(await readFile(file), bytes);
console.log(
  JSON.stringify(
    {
      passed: true,
      canonicalGLBs,
      solid,
      visualOnly,
      results,
      windows,
      sourceUnchanged: true,
      disposed: true,
      claim:
        'Real source/collision and replacement ownership at three material tiers; no native GPU, full world gameplay or default Library admission claim.',
    },
    null,
    2,
  ),
);
