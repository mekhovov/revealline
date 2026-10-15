/** Real source/geometry/query/flight composition checks. No mocked collision or physics. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  compileTerrainCell,
  TERRAIN_FORMAT,
  validateTerrainCell,
  validateTerrainSeams,
} from './terrain-cell.mjs';
import { createTerrainNormals } from '../../../optional-practice/civilian-fpv/regional/terrain-normals.mjs';
import { prepareTerrainWindow } from './terrain-admission.mjs';
import { validateRegionManifest } from './region-manifest.mjs';
import { regionalReviewEntry } from '../../../optional-practice/civilian-fpv/regional-session.mjs';
import { compileSceneryCell, SCENERY_FORMAT } from './scenery-cell.mjs';
import { createVerifiedMixedWindow } from './verified-mixed-window.mjs';
import { createRegionalFlightPrototype } from './flight-prototype.mjs';
const point = (x) => ({ x: x * 256000 + 128000, y: 10000, z: 6000 });
function fixture() {
  const layers = {};
  for (const kind of ['terrain', 'scenery']) {
    const assets = [],
      chunks = [],
      bodies = new Map();
    let requests = 0,
      intercept = null;
    for (let x = -64; x < -58; x++) {
      const base = { chunkId: `tile-${x}`, x, z: 0, cellSizeMm: 256000 };
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
                  positionsMm: [
                    160000, 8000, 30000, 220000, 8000, 30000, 160000, 8000, 90000, 220000, 8000,
                    90000,
                  ],
                  indices: [0, 2, 1, 1, 2, 3],
                  color: [0.5, 0.4, 0.3],
                },
                {
                  id: 'wall',
                  positionsMm: [
                    230000, 0, 10000, 230000, 20000, 10000, 230000, 0, 100000, 230000, 20000,
                    100000,
                  ],
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
          cellSizeMm: 256000,
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
assert.equal(entry.course.bounds.min.x, -64 * 256000);
assert.equal(entry.course.bounds.max.x, -58 * 256000);
assert.equal(entry.course.bounds.max.z, 256000);
const base = {
  format: TERRAIN_FORMAT,
  chunkId: 'flat',
  x: 0,
  z: 0,
  cellSizeMm: 256000,
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
assert.equal(Math.max(...built.positions), 256);
assert.equal(built.positions.length, 1089 * 3);
assert.equal(built.indices.length, 6144);
assert.throws(() => validateTerrainCell({ ...base, cellSizeMm: 192000 }), /lattice/);
assert.throws(
  () => validateTerrainSeams([base, { ...base, chunkId: 'neighbour', x: 1, cellSizeMm: 128000 }]),
  /sizes/,
);
const slope = { ...base, heightsMm: base.heightsMm.map((_, i) => (i % 33) * 2000) };
const n = createTerrainNormals([slope])(slope);
assert(Math.abs(n[0] / n[1] + 0.25) < 1e-6, '8m sample spacing preserves slope normals');
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
    originMm: { x: -64 * 256000, y: 0, z: 0 },
  }),
  /manifest cell/,
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
      offset = x * 256000;
    await owner.transition(p, { positionMm: p, radiusMm: 220 });
    assert.equal(owner.snapshot().terrainReady, true);
    assert.equal(owner.support({ x: offset + 200000, y: 16000, z: 64000 }, 30000).layer, 'scenery');
    assert.equal(owner.support({ x: offset + 140000, y: 16000, z: 6000 }, 30000).layer, 'terrain');
    assert.equal(
      owner.sweep(
        { x: offset + 200000, y: 4000, z: 64000 },
        { x: offset + 240000, y: 4000, z: 64000 },
        220,
      ).layer,
      'scenery',
    );
    assert(owner.snapshot().reservedGeometryBytes <= 8 * 1024 * 1024);
    if (x < -59)
      assert.equal(
        owner.sweep(
          { x: offset + 255000, y: 5000, z: 6000 },
          { x: offset + 257000, y: 5000, z: 6000 },
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
      assert(state.position.x >= -64 * 256000 && state.position.x < -58 * 256000);
    }
    flight.pause();
    assert.notEqual(flight.snapshot().status, 'active');
  } finally {
    await flight.dispose();
  }
}
console.log('PASS both actual flight modes at a negative 16km origin, explicit arming and pause');

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
  for (let i = 0; i < 4200; i++) {
    const before = flight.snapshot();
    const throttle = Math.max(
      0,
      Math.min(1, 0.5 + (12000 - before.position.y) * 0.00002 - before.velocity.y * 0.000025),
    );
    const next = flight.step({ throttle, roll: 0.35, pitch: 0, yaw: 0 });
    assert.equal(next.status, 'active', next.reason);
    if (i % 4 === 0) await new Promise((resolve) => setImmediate(resolve));
    if (next.position.x > -62 * 256000 + 20000) break;
  }
  const final = flight.snapshot();
  assert(final.position.x > -62 * 256000 + 20000);
  assert(final.recentres >= 3);
  assert.equal(final.contacts, 0);
  assert.deepEqual(final.originMm, final.terrain.provenance.originMm);
  console.log(
    JSON.stringify({
      wideCellContinuous: true,
      ticks: final.ticks,
      recentres: final.recentres,
      contacts: final.contacts,
      position: final.position,
    }),
  );
} finally {
  await flight.dispose();
}
