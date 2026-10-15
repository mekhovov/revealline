import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadRegionalReview } from '../../../optional-practice/civilian-fpv/regional-session.mjs';
import {
  createRegionPlanner,
  validateRegionManifest,
  regionToLocal,
  regionToGlobal,
} from '../../../optional-practice/civilian-fpv/regional/region-manifest.mjs';
import { createVerifiedTerrainWindow } from '../../../optional-practice/civilian-fpv/regional/verified-terrain-window.mjs';
import { createVerifiedSceneryWindow } from '../../../optional-practice/civilian-fpv/regional/verified-scenery-window.mjs';
import { createVerifiedMixedWindow } from '../../../optional-practice/civilian-fpv/regional/verified-mixed-window.mjs';

const root = path.resolve(
  process.argv[2] ?? '/Volumes/alex/CodexMigrationStaging/fpv-large-worlds-20261014/urban-mixed-r2',
);
const fetchImpl = async (url, { signal } = {}) => {
  signal?.throwIfAborted();
  const file = path.resolve(root, '.' + new URL(url).pathname);
  assert(file.startsWith(root + path.sep));
  return new Response(await readFile(file));
};
const configuration = await loadRegionalReview({
  manifestURL: '/terrain/region.json',
  sceneryURL: '/scenery/region.json',
  pageURL: 'https://review.example/sim',
  fetchImpl,
});
const point = { x: 64000.25, y: 3000.125, z: 16000.75 };
const origin = { x: 128000, y: 0, z: 0 };
const planner = createRegionPlanner(configuration.manifest);
assert.deepEqual(regionToGlobal(regionToLocal(point, origin), origin), point);
assert.throws(() => regionToLocal(point, { ...origin, x: 128000.25 }), /integer/);
assert.deepEqual(
  planner(point).requiredChunks,
  planner({ x: 64000, y: 3000, z: 16000 }).requiredChunks,
);
const authored = structuredClone(configuration.manifest);
authored.spawns[0].position.x += 0.25;
assert.throws(() => validateRegionManifest(authored), /integer/);
for (const invalid of [NaN, Infinity, -Infinity, 100000001])
  assert.throws(() => planner({ ...point, x: invalid }), /finite/);
for (const invalid of [
  { ...point, x: -0.25 },
  { ...point, y: 80000.125 },
  { ...point, extra: 1 },
])
  assert.throws(() => planner(invalid));

const terrain = createVerifiedTerrainWindow(configuration.manifest, configuration.source);
const scenery = createVerifiedSceneryWindow(
  configuration.scenery.manifest,
  configuration.scenery.source,
);
const mixed = createVerifiedMixedWindow(configuration.manifest, {
  source: configuration.source,
  scenery: configuration.scenery,
  retainCommitted: true,
});
try {
  await terrain.transition(point, { positionMm: point, radiusMm: 220 });
  assert.deepEqual(terrain.snapshot().provenance.positionMm, point);
  assert.equal(terrain.support({ ...point, y: 3220.125 }, 4000).status, 'terrain-hit');
  assert.equal(terrain.sweep(point, { ...point, x: point.x + 0.5 }, 220).status, 'terrain-clear');

  const roof = { x: 157000.25, y: 14000.125, z: 64000.75 };
  await scenery.transition(roof, { positionMm: roof, radiusMm: 220 });
  assert.deepEqual(scenery.snapshot().provenance.positionMm, roof);
  assert.equal(scenery.support(roof, 4000).status, 'scenery-hit');
  assert.equal(scenery.sweep(roof, { ...roof, x: roof.x + 0.5 }, 220).status, 'scenery-clear');

  const livePoint = { ...point, x: point.x + 0.125 };
  await mixed.transition(
    point,
    { positionMm: point, radiusMm: 220 },
    {
      readPose: () => ({ positionMm: livePoint, radiusMm: 220 }),
      commit() {},
      rollback() {},
    },
  );
  assert.deepEqual(mixed.snapshot().provenance.positionMm, point);
  for (const blocked of [
    { x: 41000.25, y: 8340.125, z: 64000.75 },
    { ...point, y: -10.125 },
  ]) {
    const retained = mixed.group;
    await assert.rejects(
      mixed.transition(blocked, { positionMm: blocked, radiusMm: 220 }),
      /support|intersects/,
    );
    assert.equal(mixed.group, retained);
    await mixed.transition(point, { positionMm: point, radiusMm: 220 });
  }
  await assert.rejects(
    mixed.transition(point, { positionMm: { ...point, x: NaN }, radiusMm: 220 }),
  );
  await mixed.transition(point, { positionMm: point, radiusMm: 220 });
  assert.deepEqual(mixed.snapshot().provenance.positionMm, point);
} finally {
  await Promise.all([terrain.dispose(), scenery.dispose(), mixed.dispose()]);
}
assert.equal(terrain.snapshot().geometryBytes, 0);
assert.equal(scenery.snapshot().geometryBytes, 0);
assert.equal(mixed.snapshot().geometryBytes, 0);
console.log(
  'PASS finite runtime positions: exact fractions, integer source/origin contract, three verified owners, live adoption, bounds/nonfinite rejection, blocked-pose retention/recovery and disposal',
);
