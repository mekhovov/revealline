/** Real source/geometry/query/flight composition checks. No mocked collision or physics. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  compileTerrainCell,
  TERRAIN_FORMAT,
  validateTerrainCell,
  validateTerrainSeams,
} from './terrain-cell.mjs';
import { createTerrainNormals } from '../../../optional-practice/civilian-fpv/regional/terrain-normals.mjs';
import { prepareTerrainWindow } from './terrain-admission.mjs';
import { validateRegionManifest, SPARSE_SCENERY_FORMAT } from './region-manifest.mjs';
import { prepareSceneryWindow } from './scenery-admission.mjs';
import { regionalReviewEntry } from '../../../optional-practice/civilian-fpv/regional-session.mjs';
import { compileSceneryCell, SCENERY_FORMAT } from './scenery-cell.mjs';
import { createVerifiedMixedWindow } from './verified-mixed-window.mjs';
import { createRegionalFlightPrototype } from './flight-prototype.mjs';
const cellSizeMm = Number(process.env.FPV_VERIFY_CELL_MM ?? 256000);
assert([256000, 512000].includes(cellSizeMm), 'Use 256000 or 512000 for this functional fixture');
const scale = cellSizeMm / 256000;
const point = (x) => ({ x: x * cellSizeMm + cellSizeMm / 2, y: 10000, z: 6000 });
const horizontal = (values) => values.map((value, i) => (i % 3 === 1 ? value : value * scale));
function fixture() {
  const layers = {};
  for (const kind of ['terrain', 'scenery']) {
    const assets = [],
      chunks = [],
      bodies = new Map();
    let requests = 0,
      intercept = null;
    for (let x = -64; x < -58; x++) {
      const base = { chunkId: `tile-${x}`, x, z: 0, cellSizeMm };
      const cell =
        kind === 'terrain'
          ? {
              format: TERRAIN_FORMAT,
              ...base,
              samples: 33,
              heightsMm: Array(1089).fill(0),
            }
          : {
              format: SCENERY_FORMAT,
              ...base,
              surfaces: [
                {
                  id: 'roof',
                  positionsMm: horizontal([
                    160000, 8000, 30000, 220000, 8000, 30000, 160000, 8000, 90000, 220000, 8000,
                    90000,
                  ]),
                  indices: [0, 2, 1, 1, 2, 3],
                  color: [0.5, 0.4, 0.3],
                },
                {
                  id: 'wall',
                  positionsMm: horizontal([
                    230000, 0, 10000, 230000, 20000, 10000, 230000, 0, 100000, 230000, 20000,
                    100000,
                  ]),
                  indices: [0, 1, 2, 1, 3, 2],
                  color: [0.5, 0.4, 0.3],
                },
              ],
            };
      const ids = [];
      for (const [type, bytes] of [
        ['scene', (kind === 'terrain' ? compileTerrainCell : compileSceneryCell)(cell).glb],
        ['collision', new TextEncoder().encode(JSON.stringify(cell))],
      ]) {
        const id = `tile-${x}-${type}`,
          path = `${id}.${type === 'scene' ? 'glb' : 'json'}`;
        assets.push({
          id,
          kind: type,
          path,
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        });
        bodies.set(path, bytes);
        ids.push(id);
      }
      chunks.push({ id: base.chunkId, x, z: 0, assets: ids });
    }
    layers[kind] = {
      requests: () => requests,
      setIntercept(value) {
        intercept = value;
      },
      manifest: {
        format: 'FPVRegionManifest.v1',
        id: 'mixed-check',
        revision: 'r1',
        title: { en: 'Mixed', uk: 'Змішаний' },
        grid: {
          cellSizeMm,
          minX: -64,
          minZ: 0,
          width: 6,
          depth: 1,
          floorMm: -1000,
          ceilingMm: 1000000,
        },
        assets,
        chunks,
        spawns: [{ id: 'start', position: point(-64) }],
      },
      source: {
        baseURL: `https://${kind}.example/`,
        fetchImpl: async (url, options) => {
          requests++;
          const key = new URL(url).pathname.slice(1);
          const replacement = await intercept?.(key, options);
          const bytes = replacement ?? bodies.get(key);
          return new Response(bytes, { status: bytes ? 200 : 404 });
        },
      },
    };
  }
  return layers;
}

const f = fixture();
const entry = regionalReviewEntry({ manifest: f.terrain.manifest, source: f.terrain.source });
assert.equal(entry.course.bounds.min.x, -64 * cellSizeMm);
assert.equal(entry.course.bounds.max.x, -58 * cellSizeMm);
assert.equal(entry.course.bounds.max.z, cellSizeMm);
const base = {
  format: TERRAIN_FORMAT,
  chunkId: 'flat',
  x: 0,
  z: 0,
  cellSizeMm,
  samples: 33,
  heightsMm: Array(1089).fill(0),
};
const built = compileTerrainCell(base);
assert.equal(
  createHash('sha256')
    .update(compileTerrainCell({ ...base, cellSizeMm: 128000 }).glb)
    .digest('hex'),
  'fa28e718db3b8b6b70fd3c2eef9ed7852ddaa52976ff9d7ec0669a397a4a3a93',
  '128m canonical bytes match main e712301',
);
assert.equal(
  createHash('sha256')
    .update(compileTerrainCell({ ...base, cellSizeMm: 256000 }).glb)
    .digest('hex'),
  'f3a155cdf781b5055612d3c10224b4078d94f414205f43434380cd49b5fb4d70',
  '256m canonical bytes remain unchanged',
);
assert.equal(Math.max(...built.positions), cellSizeMm / 1000);
assert.equal(built.positions.length, 1089 * 3);
assert.equal(built.indices.length, 6144);
assert.throws(() => validateTerrainCell({ ...base, cellSizeMm: 192000 }), /lattice/);
assert.throws(
  () => validateTerrainSeams([base, { ...base, chunkId: 'neighbour', x: 1, cellSizeMm: 128000 }]),
  /sizes/,
);
const slope = { ...base, heightsMm: base.heightsMm.map((_, i) => (i % 33) * 2000) };
const n = createTerrainNormals([slope])(slope);
assert(
  Math.abs(n[0] / n[1] + 0.25 / scale) < 1e-6,
  'Declared sample spacing preserves slope normals',
);
const badGrid = structuredClone(f.terrain.manifest);
badGrid.grid.cellSizeMm = 192000;
assert.throws(() => validateRegionManifest(badGrid), /cell size/);
const first = JSON.parse(
  new TextDecoder().decode(
    await (
      await f.terrain.source.fetchImpl('https://terrain.example/tile--64-collision.json', {})
    ).arrayBuffer(),
  ),
);
await assert.rejects(
  prepareTerrainWindow(f.terrain.manifest, [{ ...first, cellSizeMm: 128000 }], {
    requiredChunkIds: [first.chunkId],
    originMm: { x: -64 * cellSizeMm, y: 0, z: 0 },
  }),
  /manifest cell/,
);

// Full declared extent, not just the starting position, must remain reachable.
for (const axis of ['x', 'z']) {
  const empty = structuredClone(f.scenery.manifest);
  empty.format = SPARSE_SCENERY_FORMAT;
  empty.assets = [];
  empty.grid = { ...empty.grid, cellSizeMm: 512000, minX: 0, minZ: 0, width: 1, depth: 1 };
  empty.grid[axis === 'x' ? 'minX' : 'minZ'] = 128;
  empty.grid[axis === 'x' ? 'width' : 'depth'] = 67;
  empty.chunks = Array.from({ length: 67 }, (_, i) => ({
    id: `edge-${i}`,
    x: axis === 'x' ? 128 + i : 0,
    z: axis === 'z' ? 128 + i : 0,
    assets: [],
  }));
  empty.spawns = [
    {
      id: 'start',
      position: { x: axis === 'x' ? 65537000 : 1000, y: 10000, z: axis === 'z' ? 65537000 : 1000 },
    },
  ];
  assert.equal(
    validateRegionManifest(empty).chunks.length,
    67,
    '99,840,000 mm aligned endpoint accepted',
  );
  empty.grid[axis === 'x' ? 'width' : 'depth'] = 68;
  empty.chunks.push({
    id: 'edge-67',
    x: axis === 'x' ? 195 : 0,
    z: axis === 'z' ? 195 : 0,
    assets: [],
  });
  assert.throws(
    () => validateRegionManifest(empty),
    /global position bounds/,
    '100,352,000 mm endpoint rejected before assets',
  );
}
const firstScenery = JSON.parse(
  new TextDecoder().decode(
    await (
      await f.scenery.source.fetchImpl('https://scenery.example/tile--64-collision.json', {})
    ).arrayBuffer(),
  ),
);
const sparse = structuredClone(f.scenery.manifest);
sparse.format = SPARSE_SCENERY_FORMAT;
sparse.assets = [];
sparse.chunks.forEach((chunk) => {
  chunk.assets = [];
});
const reach = cellSizeMm === 512000 ? 1280000 : 640000;
for (const axis of ['x', 'z'])
  for (const sign of [-1, 1]) {
    const originMm = { x: first.x * cellSizeMm, y: 0, z: first.z * cellSizeMm };
    originMm[axis] += sign * reach;
    const options = { requiredChunkIds: [first.chunkId], originMm };
    for (const [prepare, manifest, cells] of [
      [prepareTerrainWindow, f.terrain.manifest, [first]],
      [prepareSceneryWindow, f.scenery.manifest, [firstScenery]],
      [prepareSceneryWindow, sparse, []],
    ]) {
      const admitted = await prepare(manifest, cells, options);
      admitted.dispose();
      await assert.rejects(
        prepare(manifest, cells, {
          ...options,
          originMm: { ...originMm, [axis]: originMm[axis] + sign },
        }),
        /nearby origin/,
      );
    }
  }
console.log(
  'PASS global grid endpoints and exact local-origin limits for terrain, populated and empty scenery',
);

console.log(
  'PASS bounded lattice, unchanged vertex/index counts, normals and mixed-size rejection',
);

const owner = createVerifiedMixedWindow(f.terrain.manifest, {
  source: f.terrain.source,
  scenery: { manifest: f.scenery.manifest, source: f.scenery.source },
  retainCommitted: true,
});
try {
  for (const x of [-64, -63, -62, -61, -60, -59]) {
    const p = point(x),
      offset = x * cellSizeMm;
    await owner.transition(p, { positionMm: p, radiusMm: 220 });
    assert.equal(owner.snapshot().terrainReady, true);
    assert.equal(
      owner.support({ x: offset + 200000 * scale, y: 16000, z: 64000 * scale }, 30000).layer,
      'scenery',
    );
    assert.equal(
      owner.support({ x: offset + 140000 * scale, y: 16000, z: 6000 }, 30000).layer,
      'terrain',
    );
    assert.equal(
      owner.sweep(
        { x: offset + 200000 * scale, y: 4000, z: 64000 * scale },
        { x: offset + 240000 * scale, y: 4000, z: 64000 * scale },
        220,
      ).layer,
      'scenery',
    );
    assert(owner.snapshot().reservedGeometryBytes <= 8 * 1024 * 1024);
    if (x < -59)
      assert.equal(
        owner.sweep(
          { x: offset + cellSizeMm - 1000, y: 5000, z: 6000 },
          { x: offset + cellSizeMm + 1000, y: 5000, z: 6000 },
          220,
        ).status,
        'terrain-clear',
      );
  }
  assert.equal(owner.support(point(-64)).status, 'unknown-cell');
  const retained = owner.group;
  await assert.rejects(
    owner.transition(point(-60), { positionMm: { ...point(-60), y: -500 }, radiusMm: 220 }),
  );
  assert.equal(owner.group, retained);
} finally {
  await owner.dispose();
}
assert.equal(owner.snapshot().geometryBytes, 0);
console.log(
  'PASS six negative-coordinate windows: far-half support, obstacle contact, cross-cell sweep, bounds and atomic retention/disposal',
);

for (const mode of ['acro', 'self-level']) {
  const flight = createRegionalFlightPrototype({
    manifest: f.terrain.manifest,
    source: f.terrain.source,
    geometryProfile: 'terrain-scenery-v1',
    scenery: { manifest: f.scenery.manifest, source: f.scenery.source },
    mode,
  });
  try {
    await flight.prepare();
    assert.notEqual(flight.snapshot().status, 'active');
    assert(flight.arm());
    for (let i = 0; i < 180; i++) {
      const state = flight.step({ throttle: 0.5, pitch: 0, roll: 0, yaw: 0 });
      assert.equal(state.status, 'active');
      assert(state.position.x >= -64 * cellSizeMm && state.position.x < -58 * cellSizeMm);
    }
    flight.pause();
    assert.notEqual(flight.snapshot().status, 'active');
  } finally {
    await flight.dispose();
  }
}
console.log(
  `PASS both actual flight modes at negative ${(64 * cellSizeMm) / 1000000} km origin, explicit arming and pause`,
);

const flight = createRegionalFlightPrototype({
  manifest: f.terrain.manifest,
  source: f.terrain.source,
  geometryProfile: 'terrain-scenery-v1',
  scenery: { manifest: f.scenery.manifest, source: f.scenery.source },
  continuous: true,
});
try {
  await flight.prepare();
  assert(flight.arm());
  for (let i = 0; i < 4200 * scale; i++) {
    const before = flight.snapshot();
    const throttle = Math.max(
      0,
      Math.min(1, 0.5 + (12000 - before.position.y) * 0.00002 - before.velocity.y * 0.000025),
    );
    const next = flight.step({ throttle, roll: 0.35, pitch: 0, yaw: 0 });
    assert.equal(next.status, 'active', next.reason);
    if (i % 4 === 0) await new Promise((resolve) => setImmediate(resolve));
    if (next.position.x > -62 * cellSizeMm + 20000) break;
  }
  const final = flight.snapshot();
  assert(final.position.x > -62 * cellSizeMm + 20000);
  assert(final.recentres >= 3);
  assert.equal(final.contacts, 0);
  assert.deepEqual(final.originMm, final.terrain.provenance.originMm);
  console.log(
    JSON.stringify({
      wideCellContinuous: true,
      cellSizeMm,
      ticks: final.ticks,
      recentres: final.recentres,
      contacts: final.contacts,
      position: final.position,
    }),
  );
} finally {
  await flight.dispose();
}

// Optional fresh source directory for native renderer/host review. Never overwrite a candidate.
if (process.argv[2]) {
  const root = resolve(process.argv[2]);
  await mkdir(root);
  for (const [kind, layer] of Object.entries(f)) {
    const directory = resolve(root, kind);
    await mkdir(directory);
    await writeFile(resolve(directory, 'region.json'), JSON.stringify(layer.manifest));
    for (const asset of layer.manifest.assets) {
      const response = await layer.source.fetchImpl(new URL(asset.path, layer.source.baseURL), {});
      await writeFile(resolve(directory, asset.path), new Uint8Array(await response.arrayBuffer()));
    }
  }
  console.log(`Native review source exported to ${root}`);
}
