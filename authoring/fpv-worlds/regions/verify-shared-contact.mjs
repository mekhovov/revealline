/** Historical World parity plus actual terrain/scenery contact queries. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  moveFlightSphere,
  projectContactVelocity,
  earlierFlightHit,
} from '../../../optional-practice/civilian-fpv/flight-contact.mjs';
import {
  createWorldCollision,
  initWorldRuntime,
} from '../../../optional-practice/civilian-fpv/world-collision.mjs';
import { prepareTerrainWindow } from './terrain-admission.mjs';
import { prepareSceneryWindow } from './scenery-admission.mjs';
import { TERRAIN_FORMAT } from './terrain-cell.mjs';
import { SCENERY_FORMAT } from './scenery-cell.mjs';
const baseline = '4878d2ac';
const vendor = new URL(
  '../../../optional-practice/civilian-fpv/vendor/rapier/rapier.mjs',
  import.meta.url,
).href;
const historicalSource = execFileSync(
  'git',
  ['show', `${baseline}:optional-practice/civilian-fpv/world-collision.mjs`],
  { encoding: 'utf8' },
).replace("'./vendor/rapier/rapier.mjs'", JSON.stringify(vendor));
const historical = await import(
  `data:text/javascript;base64,${Buffer.from(historicalSource).toString('base64')}`
);
// Initialize both module authorities before constructing either world's live objects.
await historical.initWorldRuntime();
await initWorldRuntime();
const course = {
  bounds: { min: { x: -100000, y: 0, z: -100000 }, max: { x: 100000, y: 100000, z: 100000 } },
  obstacles: [
    { id: 'wall', min: { x: 6000, y: 0, z: -20000 }, max: { x: 6200, y: 20000, z: 20000 } },
    { id: 'corner', min: { x: -20000, y: 0, z: 6000 }, max: { x: 6000, y: 20000, z: 6200 } },
    { id: 'roof', min: { x: -10000, y: 8000, z: -10000 }, max: { x: -3000, y: 8200, z: -3000 } },
  ],
};
const old = historical.createWorldCollision(course),
  current = createWorldCollision(course);
let comparisons = 0;
try {
  const actor = {
    id: 'crossing',
    type: 'drone',
    radius: 300,
    position: { x: 1000, y: 5000, z: 0 },
  };
  old.addActor(actor);
  current.addActor(actor);
  for (const x of [-9000, -2000, 0, 5000])
    for (const y of [0, 200, 4000, 12000])
      for (const z of [-8000, 0, 5000])
        for (const delta of [
          { x: 10000, y: -5000, z: 10000 },
          { x: 0, y: -14000, z: 0 },
          { x: 3000, y: 6000, z: -2000 },
          { x: 0, y: 0, z: 0 },
        ])
          for (const motions of [
            [],
            [{ id: actor.id, from: actor.position, to: { x: -8000, y: 5000, z: 0 } }],
          ]) {
            const position = { x, y, z };
            assert.deepEqual(
              current.moveSphere(position, delta, 220, motions),
              old.moveSphere(position, delta, 220, motions),
            );
            comparisons++;
          }
} finally {
  old.dispose();
  current.dispose();
}
console.log(
  `PASS ${comparisons} exact historical production movement/contact comparisons, including moving geometry`,
);

const manifest = {
  format: 'FPVRegionManifest.v1',
  id: 'contact-check',
  revision: 'r1',
  title: { en: 'Contact', uk: 'Контакт' },
  grid: {
    cellSizeMm: 128000,
    minX: 0,
    minZ: 0,
    width: 1,
    depth: 1,
    floorMm: -1000,
    ceilingMm: 100000,
  },
  assets: ['scene', 'collision'].map((kind) => ({
    id: kind,
    kind,
    path: kind + (kind === 'scene' ? '.glb' : '.json'),
    bytes: 1,
    sha256: '0'.repeat(64),
  })),
  chunks: [{ id: 'cell', x: 0, z: 0, assets: ['scene', 'collision'] }],
  spawns: [{ id: 'start', position: { x: 16000, y: 10000, z: 16000 } }],
};
const base = { chunkId: 'cell', x: 0, z: 0, cellSizeMm: 128000 };
const terrainCell = {
  format: TERRAIN_FORMAT,
  ...base,
  samples: 33,
  heightsMm: Array(1089).fill(0),
};
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
    surface('wall', [64000, 0, 30000, 64000, 20000, 30000, 64000, 0, 100000, 64000, 20000, 100000]),
    surface(
      'corner',
      [64000, 0, 64000, 64000, 20000, 64000, 100000, 0, 64000, 100000, 20000, 64000],
    ),
    surface(
      'roof',
      [30000, 8000, 30000, 30000, 8000, 60000, 60000, 8000, 30000, 60000, 8000, 60000],
    ),
  ],
};
const terrain = await prepareTerrainWindow(manifest, [terrainCell], { requiredChunkIds: ['cell'] });
const scenery = await prepareSceneryWindow(manifest, [sceneryCell], { requiredChunkIds: ['cell'] });
const unavailable = new Error('unavailable geometry');
const query = (from, delta, radius) => {
  const t = terrain.castMotion(from, delta, radius),
    s = scenery.castMotion(from, delta, radius);
  if ([t, s].some((hit) => !['motion-hit', 'motion-clear'].includes(hit.status))) throw unavailable;
  return earlierFlightHit(t.hit, s.hit);
};
const move = (p, d) => moveFlightSphere(p, d, 220, [], query, () => null);
try {
  const glance = move({ x: 60000, y: 4000, z: 40000 }, { x: 10000, y: 0, z: 10000 });
  assert(glance.position.x < 64000 - 220);
  assert.equal(glance.position.z, 50000);
  assert(glance.contacts.length > 0);
  let velocity = { x: 10000, y: 0, z: 10000 };
  for (const hit of glance.contacts) velocity = projectContactVelocity(velocity, hit);
  assert(Math.abs(velocity.x) < 10);
  assert.equal(velocity.z, 10000);
  const floor = move({ x: 16000, y: 5000, z: 16000 }, { x: 10000, y: -10000, z: 0 });
  assert.equal(floor.position.x, 26000);
  assert(Math.abs(floor.position.y - 2) <= 1);
  const roof = move({ x: 40000, y: 12000, z: 40000 }, { x: 0, y: -8000, z: 0 });
  assert(Math.abs(roof.position.y - 8002) <= 1);
  const corner = move({ x: 68000, y: 4000, z: 60000 }, { x: -10000, y: 0, z: 10000 });
  assert(corner.contacts.length >= 2);
  assert(corner.position.x > 64000);
  assert(corner.position.z < 64000);
  assert.throws(
    () => move({ x: 127000, y: 5000, z: 16000 }, { x: 2000, y: 0, z: 0 }),
    (error) => error === unavailable,
  );
  assert.throws(
    () => terrain.castMotion({ x: NaN, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 220),
    /Invalid/,
  );
  console.log(
    JSON.stringify({
      glance: glance.position,
      floor: floor.position,
      roof: roof.position,
      corner: corner.position,
    }),
  );
  console.log(
    'PASS wall tangent/velocity, floor slide, roof, corner and missing-cell rejection with actual paired query worlds',
  );
} finally {
  terrain.dispose();
  scenery.dispose();
}
console.log(JSON.stringify({ historicalComparisons: comparisons, baseline, playerReady: false }));
