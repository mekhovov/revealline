/** Historical support parity and actual paired regional touchdown evidence. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  initWorldRuntime,
  createWorldCollision,
} from '../../../optional-practice/civilian-fpv/world-collision.mjs';
import {
  applyFlightSupport,
  relativeFlightTilt,
} from '../../../optional-practice/civilian-fpv/flight-support.mjs';
import { Q } from '../../../optional-practice/civilian-fpv/math.mjs';
import { compileTerrainCell, TERRAIN_FORMAT } from './terrain-cell.mjs';
import { compileSceneryCell, SCENERY_FORMAT } from './scenery-cell.mjs';
import { createRegionalFlightPrototype } from './flight-prototype.mjs';
import { createVerifiedMixedWindow } from './verified-mixed-window.mjs';

const baseline = '84544a1e';
const moduleURL = new URL(
  '../../../optional-practice/civilian-fpv/world-collision.mjs',
  import.meta.url,
);
const historicalSource = execFileSync(
  'git',
  ['show', baseline + ':optional-practice/civilian-fpv/world-collision.mjs'],
  { encoding: 'utf8' },
);
const relocated = historicalSource.replace(
  /from (['"])(\.[^'"]+)\1/g,
  (_, q, p) => 'from ' + q + new URL(p, moduleURL).href + q,
);
const historical = await import(
  'data:text/javascript;base64,' + Buffer.from(relocated).toString('base64')
);
await historical.initWorldRuntime();
await initWorldRuntime();

const base = { chunkId: 'cell', x: 0, z: 0, cellSizeMm: 128000 };
const surface = (id, positionsMm) => ({
  id,
  positionsMm,
  indices: [0, 1, 2, 1, 3, 2],
  color: [0.5, 0.5, 0.5],
});
const sceneryCell = {
  format: SCENERY_FORMAT,
  ...base,
  surfaces: [
    surface(
      'roof',
      [30000, 8000, 30000, 30000, 8000, 60000, 60000, 8000, 30000, 60000, 8000, 60000],
    ),
    surface('slope', [6000, 0, 30000, 6000, 0, 60000, 26000, 10000, 30000, 26000, 10000, 60000]),
    surface('steep', [70000, 0, 30000, 70000, 0, 60000, 90000, 20000, 30000, 90000, 20000, 60000]),
  ],
};
const terrainCell = {
  format: TERRAIN_FORMAT,
  ...base,
  samples: 33,
  heightsMm: Array(1089).fill(0),
};
const course = {
  bounds: { min: { x: -100000, y: 0, z: -100000 }, max: { x: 100000, y: 100000, z: 100000 } },
  obstacles: sceneryCell.surfaces.map((s) => ({
    id: s.id,
    type: 'trimesh',
    vertices: s.positionsMm,
    indices: s.indices,
  })),
};
const old = historical.createWorldCollision(course),
  current = createWorldCollision(course);
let comparisons = 0;
try {
  for (const x of [16000, 40000, 80000])
    for (const y of [0, 2, 6, 7, 5000, 5040, 8000, 8002, 10000, 12000, 20000])
      for (const radius of [150, 220, 400])
        for (const drop of [5, 60, 10000]) {
          assert.deepEqual(
            current.support({ x, y, z: 40000 }, radius, drop),
            old.support({ x, y, z: 40000 }, radius, drop),
          );
          comparisons++;
        }
} finally {
  old.dispose();
  current.dispose();
}
assert.equal(relativeFlightTilt([Q, 0, 0, 0], { x: 0, y: Q, z: 0 }), 18000);
const ground = { id: 'floor', y: 0, normal: { x: 0, y: Q, z: 0 } };
const body = (y) => ({
  position: { x: 0, y, z: 0 },
  velocity: { x: 1000, y: -3000, z: 2000 },
  orientation: [0, 0, 0, Q],
  landingSpeed: 0,
  landingTilt: 0,
});
const accepted = body(6);
applyFlightSupport(accepted, ground, false, 4000);
assert.equal(accepted.grounded, true);
assert.equal(accepted.landingSpeed, 4000);
assert.deepEqual(accepted.velocity, { x: 700, y: 0, z: 1400 });
applyFlightSupport(accepted, ground, true, 0);
assert.equal(accepted.landingSpeed, 4000);
const high = body(7);
applyFlightSupport(high, ground, false, 4000);
assert.equal(high.grounded, false);
const climbing = body(0);
climbing.velocity.y = 1;
applyFlightSupport(climbing, ground, true, 0);
assert.equal(climbing.grounded, false);
console.log(
  'PASS ' +
    comparisons +
    ' historical support queries; grounding tolerance, retained impact and inverted tilt',
);

const bytes = new Map();
function fixture(cell, compile, folder) {
  const assets = [];
  for (const [kind, data] of [
    ['scene', compile(cell).glb],
    ['collision', new TextEncoder().encode(JSON.stringify(cell))],
  ]) {
    const id = kind,
      path = id + (kind === 'scene' ? '.glb' : '.json');
    assets.push({
      id,
      kind,
      path,
      bytes: data.length,
      sha256: createHash('sha256').update(data).digest('hex'),
    });
    bytes.set('/' + folder + '/' + path, data);
  }
  return {
    format: 'FPVRegionManifest.v1',
    id: 'support-check',
    revision: 'r1',
    title: { en: 'Support', uk: 'Опора' },
    grid: {
      cellSizeMm: 128000,
      minX: 0,
      minZ: 0,
      width: 1,
      depth: 1,
      floorMm: -1000,
      ceilingMm: 100000,
    },
    assets,
    chunks: [{ id: 'cell', x: 0, z: 0, assets: ['scene', 'collision'] }],
    spawns: [
      { id: 'roof', position: { x: 40000, y: 12000, z: 40000 } },
      { id: 'floor', position: { x: 16000, y: 5000, z: 16000 } },
    ],
  };
}
const terrainManifest = fixture(terrainCell, compileTerrainCell, 'terrain');
const sceneryManifest = fixture(sceneryCell, compileSceneryCell, 'scenery');
const source = (folder) => ({
  baseURL: 'https://support.test/' + folder + '/',
  fetchImpl: async (url) => {
    const data = bytes.get(new URL(url).pathname);
    return new Response(data, { status: data ? 200 : 404 });
  },
});
const mixed = createVerifiedMixedWindow(terrainManifest, {
  source: source('terrain'),
  scenery: { manifest: sceneryManifest, source: source('scenery') },
});
try {
  await mixed.transition({ x: 40000, y: 12000, z: 40000 });
  const roof = mixed.flightSupport({ x: 40000, y: 8002, z: 40000 }, 220);
  assert.equal(roof.status, 'flight-support');
  assert.equal(roof.ground.id, 'scenery:cell');
  assert.equal(roof.ground.y, 8000);
  const floor = mixed.flightSupport({ x: 16000, y: 2, z: 16000 }, 220);
  assert.equal(floor.ground.id, 'terrain:cell');
  assert(
    Math.abs(floor.ground.y) <= 1,
    'pinned mesh ray and production ceil stay within one millimetre of the authored floor',
  );
  const steep = mixed.flightSupport({ x: 80000, y: 10000, z: 40000 }, 220, 20000);
  assert.equal(steep.ground, null);
  assert(steep.hitDistanceMm !== null, 'nearest steep surface must block support through to floor');
  const slope = mixed.flightSupport({ x: 16000, y: 5026, z: 40000 }, 220);
  assert(slope.ground && slope.ground.normal.y >= 866025 && slope.ground.y > 5000);
  assert.equal(mixed.flightSupport({ x: 127999, y: 2, z: 16000 }, 220).status, 'unknown-cell');
  mixed.cancel();
  assert.equal(mixed.flightSupport({ x: 16000, y: 2, z: 16000 }, 220).status, 'not-ready');
  console.log(
    'PASS mixed roof/floor provenance, sphere support on slope, steep occluder and unknown/cancelled support',
  );
} finally {
  await mixed.dispose();
}

for (const spawnId of ['roof', 'floor']) {
  const flight = createRegionalFlightPrototype({
    manifest: terrainManifest,
    source: source('terrain'),
    scenery: { manifest: sceneryManifest, source: source('scenery') },
    geometryProfile: 'terrain-scenery-v1',
    spawnId,
  });
  try {
    await flight.prepare();
    assert(flight.arm());
    let state = flight.snapshot(),
      ticks = 0;
    while (!state.grounded && ticks++ < 150) state = flight.step({ throttle: 0, roll: 0, pitch: 0, yaw: 0 });
    assert(state.grounded, 'commanded descent reaches support');
    assert(state.landingSpeed > 1500, 'first impact must survive contact velocity projection');
    assert.equal(state.support.id, spawnId === 'roof' ? 'scenery:cell' : 'terrain:cell');
    const impact = state.landingSpeed,
      landedAt = state.position.y;
    for (let n = 0; n < 80; n++) state = flight.step({ throttle: 0, roll: 0, pitch: 0, yaw: 0 });
    assert.equal(state.landingSpeed, impact);
    assert.equal(state.position.y, landedAt);
    assert.equal(state.grounded, true);
    for (let n = 0; n < 30; n++) state = flight.step({ throttle: 1, roll: 0, pitch: 0, yaw: 0 });
    assert.equal(state.grounded, false);
    assert(state.position.y > landedAt + 500);
    flight.pause();
    const paused = flight.snapshot();
    assert.deepEqual(flight.step({ throttle: 1, roll: 0, pitch: 0, yaw: 0 }), paused);
    console.log(
      JSON.stringify({
        spawnId,
        impact,
        landedAt,
        takeoffHeight: state.position.y,
        ticks: state.ticks,
        playerReady: false,
      }),
    );
  } finally {
    await flight.dispose();
  }
}
console.log(
  JSON.stringify({
    historicalSupportComparisons: comparisons,
    commandedLandings: 2,
    baseline,
    playerReady: false,
  }),
);
