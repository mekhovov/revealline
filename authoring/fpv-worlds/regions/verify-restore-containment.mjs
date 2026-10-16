import { createHash } from 'node:crypto';
import { prepareSceneryWindow } from '../../../optional-practice/civilian-fpv/regional/scenery-admission.mjs';
import { compileScenerySource } from '../../../optional-practice/civilian-fpv/regional/indexed-scenery-cell.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  BoxGeometry,
  TorusGeometry,
} from '../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { createRestoreContainment } from '../../../optional-practice/civilian-fpv/regional/restore-containment.mjs';
import { loadRegionalReview } from '../../../optional-practice/civilian-fpv/regional-session.mjs';
import { createVerifiedSceneryWindow } from '../../../optional-practice/civilian-fpv/regional/verified-scenery-window.mjs';
import { createVerifiedMixedWindow } from '../../../optional-practice/civilian-fpv/regional/verified-mixed-window.mjs';
const mesh = (geometry, translation = { x: 0, y: 0, z: 0 }) => ({
  positions: geometry.attributes.position.array,
  indices: geometry.index.array,
  translation,
});
const box = (x = 0, y = 0, z = 0, w = 2, h = 2, d = 2) =>
  mesh(new BoxGeometry(w, h, d), { x, y, z });
let checks = 0;
async function check(name, run) {
  await run();
  console.log('PASS ' + name);
  checks++;
}
await check('closed convex interior, boundary, exact cache and disposal', async () => {
  const owner = createRestoreContainment([box()]);
  assert.equal(owner.classify({ x: 0, y: 0, z: 0 }).reason, 'certificate-unavailable');
  await owner.prepare();
  assert.equal(owner.classify({ x: 0, y: 0, z: 0 }).status, 'inside-solid');
  assert.equal(owner.classify({ x: 2, y: 0, z: 0 }).status, 'outside-solids');
  assert.equal(owner.classify({ x: 1, y: 0, z: 0 }).status, 'ambiguous');
  const snapshot = owner.snapshot();
  await owner.prepare();
  assert.deepEqual(owner.snapshot(), snapshot);
  owner.dispose();
  assert.equal(owner.snapshot().certificateBytes, 0);
  assert.throws(() => owner.classify({ x: 0, y: 0, z: 0 }), /disposed/);
});
await check('separate reversed solids cannot cancel containment', async () => {
  const a = box(),
    b = box(0.25, 0, 0);
  b.indices = Uint32Array.from(b.indices).reverse();
  const owner = createRestoreContainment([a, b]);
  await owner.prepare();
  assert.equal(owner.classify({ x: 0, y: 0, z: 0 }).status, 'inside-solid');
  owner.dispose();
});
await check('room cavity, doorway and elevated pad remain available', async () => {
  const owner = createRestoreContainment([
    box(-3, 0, 0, 1, 6, 8),
    box(3, 0, 0, 1, 6, 8),
    box(0, 3, 0, 7, 1, 8),
    box(0, -3, 0, 7, 1, 8),
    box(0, 0, 4, 7, 6, 1),
  ]);
  await owner.prepare();
  for (const p of [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: -4 },
    { x: 0, y: 3.72, z: 0 },
  ])
    assert.equal(owner.classify(p).status, 'outside-solids');
  assert.equal(owner.classify({ x: 3, y: 0, z: 0 }).status, 'inside-solid');
  owner.dispose();
});
await check('open, non-manifold and concave geometry are unavailable within bounds', async () => {
  const open = box();
  open.indices = open.indices.slice(3);
  const duplicate = box();
  duplicate.indices = new Uint32Array([...duplicate.indices, ...duplicate.indices.slice(0, 3)]);
  for (const source of [open, duplicate, mesh(new TorusGeometry(2, 0.5, 8, 12))]) {
    const owner = createRestoreContainment([source]);
    await owner.prepare();
    assert.equal(owner.classify({ x: 0, y: 0, z: 0 }).status, 'ambiguous');
    assert.equal(owner.classify({ x: 100, y: 0, z: 0 }).status, 'outside-solids');
    owner.dispose();
  }
});
await check('certification yields, cancels and enforces work budget', async () => {
  const owner = createRestoreContainment(Array.from({ length: 100 }, (_, i) => box(i * 3)));
  let yielded = false;
  setTimeout(() => {
    yielded = true;
    owner.dispose();
  }, 0);
  await assert.rejects(owner.prepare(), { name: 'AbortError' });
  assert(yielded);
  assert.equal(owner.snapshot().certificateBytes, 0);
  const expensive = createRestoreContainment([mesh(new BoxGeometry(2, 2, 2, 20, 20, 20))]);
  await expensive.prepare();
  assert.equal(expensive.classify({ x: 0, y: 0, z: 0 }).reason, 'work-budget');
  expensive.dispose();
  const storage = createRestoreContainment(Array.from({ length: 1300 }, (_, i) => box(i * 3)));
  await storage.prepare();
  assert.equal(storage.classify({ x: 0, y: 0, z: 0 }).reason, 'certificate-budget');
  storage.dispose();
  const oversized = box();
  oversized.indices = new Uint32Array(16385 * 3);
  const limit = createRestoreContainment([oversized]);
  await limit.prepare();
  assert.equal(limit.classify({ x: 0, y: 0, z: 0 }).reason, 'work-budget');
  limit.dispose();
});
const root = path.resolve(
  process.argv[2] ?? '/Volumes/alex/CodexMigrationStaging/fpv-large-worlds-20261014/urban-mixed-r2',
);
const fetchImpl = async (url, { signal } = {}) => {
  signal?.throwIfAborted();
  const file = path.resolve(root, '.' + new URL(url).pathname);
  assert(file.startsWith(root + path.sep));
  return new Response(await readFile(file));
};
const config = await loadRegionalReview({
  manifestURL: '/terrain/region.json',
  sceneryURL: '/scenery/region.json',
  pageURL: 'https://review.example/sim',
  fetchImpl,
});
await check('actual Urban starts accept and hidden slab interior rejects atomically', async () => {
  const owner = createVerifiedMixedWindow(config.manifest, {
    source: config.source,
    scenery: config.scenery,
    retainCommitted: true,
  });
  for (const spawn of config.manifest.spawns) {
    const p = { ...spawn.position, x: spawn.position.x + 0.25 };
    await owner.transition(p, { positionMm: p, radiusMm: 220, requireClearRestore: true });
    assert(owner.snapshot().terrainReady);
  }
  // Actual authored loading-hall doorway/cavity and elevated roof positions.
  for (const positionMm of [
    { x: 190000, y: 4000, z: 20000 },
    { x: 190000, y: 4000, z: 64000 },
    { x: 190000, y: 4000, z: 108000 },
    { x: 157000, y: 14000, z: 64000 },
  ]) {
    await owner.transition(positionMm, { positionMm, radiusMm: 220, requireClearRestore: true });
  }
  const old = owner.group,
    p = { x: 41000.25, y: 7900.125, z: 64000.75 };
  await assert.rejects(
    owner.transition(p, { positionMm: p, radiusMm: 220, requireClearRestore: true }),
    { code: 'regional-restore-unavailable', reason: 'inside-solid' },
  );
  assert.equal(owner.group, old);
  const start = config.manifest.spawns[0].position;
  await owner.transition(start, { positionMm: start, radiusMm: 220, requireClearRestore: true });
  // The opt-in proof does not silently change ordinary flight/adoption policy.
  await owner.transition(p, { positionMm: p, radiusMm: 220 });
  assert(owner.snapshot().terrainReady);
  owner.dispose();
  assert.equal(owner.snapshot().resourceBytes, 0);
});
await check('missing cells, cancelled certification and retry remain conservative', async () => {
  const owner = createVerifiedSceneryWindow(config.scenery.manifest, config.scenery.source);
  const start = config.manifest.spawns[0].position;
  await owner.transition(start);
  const preparing = owner.prepareRestoreProof();
  setTimeout(() => owner.cancel(), 0);
  await assert.rejects(preparing, { name: 'AbortError' });
  await owner.transition(start);
  await owner.prepareRestoreProof();
  assert.equal(
    owner.restoreClearance({ x: 380000, y: 10000, z: 380000 }, 220).reason,
    'unknown-cell',
  );
  const certificate = owner.restoreSnapshot();
  assert(certificate.certificateBytes > 0 && certificate.certificateBytes <= 512 * 1024);
  await owner.prepareRestoreProof();
  assert.deepEqual(owner.restoreSnapshot(), certificate);
  owner.dispose();
  assert.equal(owner.restoreSnapshot().certificateBytes, 0);
});
await check('final live pose cannot remove the restore-only requirement', async () => {
  const owner = createVerifiedMixedWindow(config.manifest, {
    source: config.source,
    scenery: config.scenery,
    retainCommitted: true,
  });
  const start = config.manifest.spawns[0].position;
  await owner.transition(start);
  const old = owner.group;
  await assert.rejects(
    owner.transition(
      start,
      { positionMm: start, radiusMm: 220, requireClearRestore: true },
      {
        commit() {},
        rollback() {},
        readPose() {
          return { positionMm: { x: 41000.25, y: 7900.125, z: 64000.75 }, radiusMm: 220 };
        },
      },
    ),
    /Saved location cannot be verified/,
  );
  assert.equal(owner.group, old);
  owner.dispose();
});
await check('verified RGBA visual-only surfaces do not become restore solids', async () => {
  const geometry = new BoxGeometry(2, 2, 2);
  const source = {
    format: 'FPVRegionRgbaScenery.v1',
    cell: {
      format: 'FPVRegionScenery.v1',
      chunkId: 'tile-0',
      x: 0,
      z: 0,
      cellSizeMm: 128000,
      surfaces: [
        ['foliage', 64000],
        ['structure', 66000],
      ].map(([id, x]) => ({
        id,
        positionsMm: Array.from(
          geometry.attributes.position.array,
          (v, i) => Math.round(v * 1000) + (i % 3 === 0 ? x : i % 3 === 1 ? 2000 : 64000),
        ),
        indices: Array.from(geometry.index.array),
        color: [1, 1, 1],
      })),
    },
    textures: [
      {
        id: 'leaf',
        width: 2,
        height: 2,
        rgbaBase64: Buffer.alloc(16, 255).toString('base64'),
        magFilter: 9729,
        minFilter: 9987,
        wrapS: 10497,
        wrapT: 10497,
      },
    ],
    bindings: [
      ['foliage', 'visual-only'],
      ['structure', 'solid'],
    ].map(([surfaceId, collision]) => ({
      surfaceId,
      collision,
      textureId: 'leaf',
      uvs: Array.from(geometry.attributes.uv.array),
      normals: Array.from(geometry.attributes.normal.array),
      colors: [],
      alphaMode: 'OPAQUE',
      alphaCutoff: 0,
      doubleSided: false,
    })),
  };
  const encoded = new TextEncoder().encode(JSON.stringify(source)),
    glb = compileScenerySource(source).glb;
  const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const manifest = {
    format: 'FPVRegionManifest.v1',
    id: 'restore-rgba-study',
    revision: 'r1',
    title: { en: 'Restore study', uk: 'Перевірка відновлення' },
    grid: {
      cellSizeMm: 128000,
      minX: 0,
      minZ: 0,
      width: 1,
      depth: 1,
      floorMm: -1000,
      ceilingMm: 100000,
    },
    assets: [
      { id: 'scene', kind: 'scene', path: 'scene.glb', bytes: glb.length, sha256: hash(glb) },
      {
        id: 'collision',
        kind: 'collision',
        path: 'collision.json',
        bytes: encoded.length,
        sha256: hash(encoded),
      },
    ],
    chunks: [{ id: 'tile-0', x: 0, z: 0, assets: ['scene', 'collision'] }],
    spawns: [{ id: 'start', position: { x: 64000, y: 4000, z: 64000 } }],
  };
  const owner = await prepareSceneryWindow(manifest, [source], { requiredChunkIds: ['tile-0'] });
  await owner.prepareRestoreProof();
  assert.equal(
    owner.restoreClearance({ x: 64000, y: 2000, z: 64000 }, 220).status,
    'outside-solids',
  );
  assert.equal(owner.overlap({ x: 64000, y: 2000, z: 64000 }, 220).status, 'scenery-clear');
  assert.equal(owner.restoreClearance({ x: 66000, y: 2000, z: 64000 }, 220).status, 'inside-solid');
  owner.dispose();
  assert.equal(owner.restoreSnapshot().certificateBytes, 0);
});
console.log('PASS ' + checks + ' restore-containment scenarios');
