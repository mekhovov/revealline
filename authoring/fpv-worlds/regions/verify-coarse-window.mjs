/** Full 3×3 coarse-cell ownership, with no synthetic scenery payloads. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// An authoring-only override permits checking an unpublished runtime without copying it.
const root = process.env.FPV_REGION_RUNTIME_ROOT
  ? pathToFileURL(resolve(process.env.FPV_REGION_RUNTIME_ROOT) + '/')
  : new URL('../../../', import.meta.url);
const runtime = (name) => import(new URL(`optional-practice/civilian-fpv/regional/${name}`, root));
const { compileTerrainCell, TERRAIN_FORMAT } = await runtime('terrain-cell.mjs');
const { REGION_FORMAT, SPARSE_SCENERY_FORMAT } = await runtime('region-manifest.mjs');
const { createVerifiedMixedWindow } = await runtime('verified-mixed-window.mjs');
const { TERRAIN_GEOMETRY_BYTES_PER_CELL } = await runtime('verified-terrain-window.mjs');
const CELL = 512000;
const WINDOW_BYTES = 9 * TERRAIN_GEOMETRY_BYTES_PER_CELL;
const point = (x, z) => ({ x: (x + 0.5) * CELL, y: 10000, z: (z + 0.5) * CELL });
const start = point(0, 0),
  diagonal = point(1, 1);
const bodies = new Map(),
  assets = [],
  chunks = [];
for (let z = -2; z <= 2; z++)
  for (let x = -2; x <= 2; x++) {
    const chunkId = `tile-${x + 2}-${z + 2}`;
    const cell = {
      format: TERRAIN_FORMAT,
      chunkId,
      x,
      z,
      cellSizeMm: CELL,
      samples: 33,
      heightsMm: Array(1089).fill(0),
    };
    const ids = [];
    for (const [kind, bytes] of [
      ['scene', compileTerrainCell(cell).glb],
      ['collision', new TextEncoder().encode(JSON.stringify(cell))],
    ]) {
      const id = `${chunkId}-${kind}`,
        path = `${id}.${kind === 'scene' ? 'glb' : 'json'}`;
      assets.push({
        id,
        kind,
        path,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
      bodies.set(path, bytes);
      ids.push(id);
    }
    chunks.push({ id: chunkId, x, z, assets: ids });
  }
const terrain = {
  format: REGION_FORMAT,
  id: 'coarse-window-check',
  revision: 'r1',
  title: { en: 'Coarse window verification', uk: 'Перевірка великих клітин' },
  grid: {
    cellSizeMm: CELL,
    minX: -2,
    minZ: -2,
    width: 5,
    depth: 5,
    floorMm: -1000,
    ceilingMm: 1000000,
  },
  assets,
  chunks,
  spawns: [{ id: 'start', position: start }],
};
const scenery = {
  ...terrain,
  format: SPARSE_SCENERY_FORMAT,
  assets: [],
  chunks: chunks.map((c) => ({ ...c, assets: [] })),
};
function fixture(options = {}) {
  let terrainRequests = 0,
    sceneryRequests = 0;
  const owner = createVerifiedMixedWindow(terrain, {
    retainCommitted: true,
    source: {
      baseURL: 'https://terrain.example/',
      fetchImpl: async (url, init) => {
        init?.signal?.throwIfAborted();
        terrainRequests++;
        const bytes = bodies.get(new URL(url).pathname.slice(1));
        assert(bytes, 'Only declared terrain assets may be fetched');
        return new Response(bytes);
      },
    },
    scenery: {
      manifest: scenery,
      source: {
        baseURL: 'https://scenery.example/',
        fetchImpl: async () => {
          sceneryRequests++;
          throw new Error('Explicit empty cells must never fetch scenery');
        },
      },
    },
    ...options,
  });
  return { owner, terrainRequests: () => terrainRequests, sceneryRequests: () => sceneryRequests };
}
const meshCount = (group) => {
  let count = 0;
  group?.traverse((node) => {
    if (node.isMesh) count++;
  });
  return count;
};
function assertReady(owner, position) {
  const state = owner.snapshot();
  assert.equal(state.terrainReady, true);
  assert.equal(state.geometryBytes, WINDOW_BYTES);
  assert.equal(state.textureBytes, 0);
  assert.equal(state.provenance.chunks.length, 9);
  assert(state.provenance.chunks.every((c) => c.scenery.empty === true));
  assert.equal(owner.collisionSnapshot().colliders, 9);
  assert.equal(meshCount(owner.group), 9);
  assert.equal(owner.support(position, 20000).heightMm, 0);
}
async function assertDisposed(owner) {
  await owner.dispose();
  const state = owner.snapshot();
  for (const field of [
    'geometryBytes',
    'sourceBytes',
    'reservedGeometryBytes',
    'reservedSourceBytes',
  ])
    assert.equal(state[field], 0, field);
  assert.equal(owner.group, null);
  assert.deepEqual(owner.collisionSnapshot(), { worlds: 0, colliders: 0, rigidBodies: 0 });
}
const records = [];
const f = fixture({ maxGeometryBytes: 2 * WINDOW_BYTES + 1 });
let releaseStage = () => {},
  pending;
try {
  await f.owner.transition(start, { positionMm: start, radiusMm: 220 });
  assertReady(f.owner, start);
  assert.equal(f.terrainRequests(), 18);
  assert.equal(f.owner.sweep(start, diagonal, 220).status, 'terrain-clear');
  const firstGroup = f.owner.group,
    firstOrigin = f.owner.snapshot().provenance.originMm;
  await f.owner.transition(diagonal, { positionMm: diagonal, radiusMm: 220 });
  assertReady(f.owner, diagonal);
  const secondOrigin = f.owner.snapshot().provenance.originMm;
  assert.equal(secondOrigin.x - firstOrigin.x, CELL);
  assert.equal(secondOrigin.z - firstOrigin.z, CELL);
  assert.equal(firstGroup.children.length, 0);
  assert.equal(f.owner.support(point(-1, -1), 20000).status, 'unknown-cell');
  const retained = f.owner.group,
    provenance = f.owner.snapshot().provenance;
  let enterStage,
    candidate,
    commits = 0;
  const entered = new Promise((resolve) => {
    enterStage = resolve;
  });
  const wait = new Promise((resolve) => {
    releaseStage = resolve;
  });
  pending = f.owner.transition(start, null, {
    async prepare({ group }) {
      candidate = group;
      enterStage();
      await wait;
    },
    commit() {
      commits++;
    },
    rollback() {},
  });
  // Reject rather than hang if preparation fails before reaching the staging latch.
  await Promise.race([
    entered,
    pending.then(() => {
      throw new Error('Missing staged preparation');
    }),
  ]);
  assert.equal(f.owner.group, retained);
  assert.deepEqual(f.owner.snapshot().provenance, provenance);
  assert.equal(f.owner.snapshot().reservedGeometryBytes, 2 * WINDOW_BYTES + 1);
  assert.equal(f.owner.collisionSnapshot().colliders, 18);
  assert.equal(meshCount(candidate), 9);
  assert.equal(meshCount(retained), 9);
  assert.equal(f.owner.support(diagonal, 20000).heightMm, 0);
  f.owner.cancel();
  releaseStage();
  await assert.rejects(pending, { name: 'AbortError' });
  pending = null;
  assert.equal(commits, 0);
  assert.equal(candidate.children.length, 0);
  assert.equal(f.owner.group, retained);
  assert.deepEqual(f.owner.snapshot().provenance, provenance);
  assert.equal(f.owner.snapshot().reservedGeometryBytes, WINDOW_BYTES);
  assertReady(f.owner, diagonal);
  await f.owner.transition(start);
  assertReady(f.owner, start);
  assert.equal(f.sceneryRequests(), 0);
  records.push({
    check: 'diagonal transition, retained staging, cancellation and retry',
    cellSizeMm: CELL,
    residentCells: 9,
    residentGeometryBytes: WINDOW_BYTES,
    stagedAndRetainedGeometryBytes: 2 * WINDOW_BYTES,
    peakColliders: 18,
    sceneryRequests: 0,
  });
} finally {
  releaseStage();
  if (pending) await pending.catch(() => {});
  await assertDisposed(f.owner);
}
const sourceBytesAt = (x, z) => {
  const sizes = new Map(assets.map((a) => [a.id, a.bytes]));
  return chunks
    .filter((c) => Math.abs(c.x - x) <= 1 && Math.abs(c.z - z) <= 1)
    .reduce((total, c) => total + c.assets.reduce((sum, id) => sum + sizes.get(id), 0), 0);
};
for (const [check, options, reason] of [
  [
    'retained plus staged geometry limit',
    { maxGeometryBytes: 2 * WINDOW_BYTES - 1 },
    'mixed-transition-geometry-budget',
  ],
  [
    'retained plus staged source limit',
    { maxSourceBytes: sourceBytesAt(0, 0) + sourceBytesAt(1, 1) - 1 },
    'mixed-transition-source-budget',
  ],
]) {
  const budget = fixture(options);
  try {
    await budget.owner.transition(start);
    const group = budget.owner.group,
      before = budget.owner.snapshot(),
      requests = budget.terrainRequests();
    await assert.rejects(budget.owner.transition(diagonal), new RegExp(reason));
    assert.equal(budget.owner.group, group);
    assert.deepEqual(budget.owner.snapshot().provenance, before.provenance);
    assert.equal(budget.owner.snapshot().reservedGeometryBytes, WINDOW_BYTES);
    assert.equal(budget.owner.snapshot().reservedSourceBytes, before.sourceBytes);
    assert.equal(
      budget.terrainRequests(),
      requests,
      'Budget rejection precedes further network work',
    );
    assert.equal(budget.sceneryRequests(), 0);
    assertReady(budget.owner, start);
    records.push({ check, retained: true, rejectedBeforeFetch: true, sceneryRequests: 0 });
  } finally {
    await assertDisposed(budget.owner);
  }
}
console.log(JSON.stringify({ passed: true, records }, null, 2));
