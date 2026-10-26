import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { BoxGeometry } from '../../optional-practice/civilian-fpv/vendor/three.module.js';
import { compileScenerySource } from '../../optional-practice/civilian-fpv/regional/indexed-scenery-cell.mjs';
import { prepareSceneryWindow } from '../../optional-practice/civilian-fpv/regional/scenery-admission.mjs';
import { createRestoreContainment } from '../../optional-practice/civilian-fpv/regional/restore-containment.mjs';

async function scene({ removedFace, cover = false, reversed = false } = {}) {
  const box = new BoxGeometry(6, 2, 6);
  const surface = (geometry, id, y, removed) => ({
    id,
    positionsMm: Array.from(
      geometry.attributes.position.array,
      (n, i) => Math.round(n * 1000) + (i % 3 === 1 ? y : 64000),
    ),
    indices: Array.from(geometry.index.array).filter(
      (_, i) => removed === undefined || Math.floor(i / 6) !== removed,
    ),
    color: [0.4, 0.4, 0.4],
  });
  const source = {
    format: 'FPVRegionScenery.v1',
    chunkId: 'tile-0',
    x: 0,
    z: 0,
    cellSizeMm: 128000,
    surfaces: [
      surface(box, 'courtyard', 2000, removedFace),
      ...(cover ? [surface(new BoxGeometry(8, 1, 8), 'cover', 6000)] : []),
    ],
  };
  if (reversed) source.surfaces[0].indices.reverse();
  const encoded = new TextEncoder().encode(JSON.stringify(source));
  const glb = compileScenerySource(source).glb;
  const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const manifest = {
    format: 'FPVRegionManifest.v1',
    id: 'restore-exterior-study',
    revision: 'r1',
    title: { en: 'Restore exterior', uk: 'Відновлення' },
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
  return owner;
}
const center = { x: 64000, y: 2000, z: 64000 };

test('open courtyard permits a verified full-sphere exterior path through its broad bounds', async () => {
  const owner = await scene({ removedFace: 2 });
  try {
    assert.deepEqual(owner.restoreClearance(center), {
      status: 'outside-solids',
      proof: 'clear-exterior-sweep',
    });
    assert.equal(
      owner.restoreClearance({ ...center, x: 66850 }).reason,
      'unverified-solid',
      'the whole aircraft sphere must clear the side wall',
    );
    assert.equal(
      owner.restoreClearance({ ...center, x: 100 }).reason,
      'unknown-cell',
      'a sphere touching an unverified neighboring cell remains unavailable',
    );
  } finally {
    owner.dispose();
  }
});

test('closed solids and open meshes with an obstructed exterior path stay unavailable', async () => {
  for (const options of [
    {},
    { removedFace: 3 },
    { removedFace: 3, reversed: true },
    { removedFace: 2, cover: true },
  ]) {
    const owner = await scene(options);
    try {
      const result = owner.restoreClearance(center);
      assert.notEqual(result.status, 'outside-solids');
      assert.equal(result.status, options.removedFace === undefined ? 'inside-solid' : 'ambiguous');
    } finally {
      owner.dispose();
    }
  }
});

test('an exterior anchor requires a completed bounded certificate and preserves disposal', async () => {
  const geometry = new BoxGeometry(2, 2, 2);
  const proof = createRestoreContainment([
    {
      positions: geometry.attributes.position.array,
      indices: geometry.index.array,
      translation: { x: 0, y: 0, z: 0 },
    },
  ]);
  assert.equal(proof.exteriorAbove({ x: 0, y: 0, z: 0 }, 0.22), null);
  await proof.prepare();
  assert.deepEqual(proof.exteriorAbove({ x: 0, y: 0, z: 0 }, 0.22), { x: 0, y: 1.23, z: 0 });
  assert.throws(() => proof.exteriorAbove({ x: 0, y: 0, z: 0 }, -1), /Invalid/);
  proof.dispose();
  assert.throws(() => proof.exteriorAbove({ x: 0, y: 0, z: 0 }, 0.22), /cancelled/);
});

test('a scoped certificate excludes only meshes beyond the complete body column', async () => {
  const box = new BoxGeometry(2, 2, 2);
  const mesh = (x, repeat = 1) => ({
    positions: box.attributes.position.array,
    indices: new Uint32Array(
      Array.from({ length: repeat }, () => Array.from(box.index.array)).flat(),
    ),
    translation: { x, y: 0, z: 0 },
  });
  const column = { minX: -0.22, maxX: 0.22, minZ: -0.22, maxZ: 0.22 };
  const far = mesh(5, 1400);
  const full = createRestoreContainment([far]);
  const scoped = createRestoreContainment([far]);
  try {
    await full.prepare();
    assert.equal(full.classify({ x: 0, y: 0, z: 0 }).reason, 'work-budget');
    await scoped.prepare(undefined, column);
    assert.equal(scoped.classify({ x: 0, y: 0, z: 0 }, 0.22).status, 'outside-solids');
    assert.equal(scoped.classify({ x: 0.01, y: 0, z: 0 }, 0.22).reason, 'outside-certified-column');
    assert.equal(scoped.classify({ x: 5, y: 0, z: 0 }).reason, 'outside-certified-column');
    assert.equal(scoped.exteriorAbove({ x: 0, y: 0, z: 0 }, 0.23), null);
  } finally {
    full.dispose();
    scoped.dispose();
    box.dispose();
  }
});

test('the body radius and numerical boundary keep nearby high-detail walls inside the budget', async () => {
  const geometry = new BoxGeometry(0.2, 2, 2);
  const indices = new Uint32Array(
    Array.from({ length: 1400 }, () => Array.from(geometry.index.array)).flat(),
  );
  for (const x of [0.3, 0.320005]) {
    const proof = createRestoreContainment([
      { positions: geometry.attributes.position.array, indices, translation: { x, y: 0, z: 0 } },
    ]);
    try {
      await proof.prepare(undefined, { minX: -0.22, maxX: 0.22, minZ: -0.22, maxZ: 0.22 });
      assert.equal(
        proof.classify({ x: 0, y: 0, z: 0 }, 0.22).reason,
        'work-budget',
        'an off-center wall touching the aircraft column is never omitted',
      );
      assert.equal(proof.exteriorAbove({ x: 0, y: 0, z: 0 }, 0.22), null);
    } finally {
      proof.dispose();
    }
  }
  geometry.dispose();
});

test('scoping still rejects closed solid interiors and bounds-scan exhaustion', async () => {
  const box = new BoxGeometry(2, 2, 2);
  const inside = createRestoreContainment([
    {
      positions: box.attributes.position.array,
      indices: box.index.array,
      translation: { x: 0, y: 0, z: 0 },
    },
  ]);
  const oversized = createRestoreContainment([
    {
      positions: new Float32Array(131073 * 3),
      indices: new Uint32Array(),
      translation: { x: 10, y: 0, z: 10 },
    },
  ]);
  try {
    const column = { minX: -0.22, maxX: 0.22, minZ: -0.22, maxZ: 0.22 };
    await inside.prepare(undefined, column);
    assert.equal(inside.classify({ x: 0, y: 0, z: 0 }, 0.22).status, 'inside-solid');
    await oversized.prepare(undefined, column);
    assert.equal(oversized.classify({ x: 0, y: 0, z: 0 }, 0.22).reason, 'work-budget');
  } finally {
    inside.dispose();
    oversized.dispose();
    box.dispose();
  }
});
