import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  loadRegionalReview,
  regionalLibraryEntry,
  regionalLocationIdentity,
  regionalSavedLocation,
  regionalStartingPoint,
  createRegionalSession,
} from '../../../optional-practice/civilian-fpv/regional-session.mjs';
import {
  validateRegionalLocationPose,
  validateRegionalLocationStart,
} from '../../../optional-practice/civilian-fpv/regional-locations.mjs';

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
const entry = regionalLibraryEntry(configuration, { sha256: 'a'.repeat(64) });
const location = {
  id: 'example-location',
  identity: regionalLocationIdentity(entry),
  label: 'Roof & <b>view</b>',
  pose: { position: { x: 157000.25, y: 14000.125, z: 64000.75 }, heading: 12345 },
  createdAt: 1000,
};
assert.equal(location.identity.sha256, 'a'.repeat(64));
assert.throws(
  () =>
    regionalSavedLocation(
      regionalLibraryEntry(configuration, { sha256: 'b'.repeat(64) }),
      location,
    ),
  /revision/,
);
assert.throws(
  () =>
    regionalSavedLocation(entry, {
      ...location,
      identity: { ...location.identity, revision: 'different' },
    }),
  /revision/,
);
for (const bad of [NaN, Infinity, -Infinity, 100000001])
  assert.throws(() =>
    validateRegionalLocationPose({
      ...location.pose,
      position: { ...location.pose.position, x: bad },
    }),
  );
for (const bad of [-1, 36000, 1.25, NaN])
  assert.throws(() => validateRegionalLocationPose({ ...location.pose, heading: bad }));
for (const position of [
  { ...location.pose.position, x: 219.999 },
  { ...location.pose.position, y: 80000 },
  { ...location.pose.position, z: 384000 },
  { ...location.pose.position, extra: 1 },
])
  assert.throws(() =>
    validateRegionalLocationStart({ ...location.pose, position }, configuration.manifest),
  );

for (const mode of ['acro', 'self-level']) {
  const restored = regionalSavedLocation(entry, location);
  const session = createRegionalSession({ ...restored.configuration, mode });
  try {
    assert.equal(session.snapshot().status, 'paused');
    await session.prepare();
    const state = session.snapshot();
    assert.deepEqual(state.position, location.pose.position);
    assert.equal(state.status, 'paused');
    assert.equal(state.reason, 'prepared');
    assert.deepEqual(state.velocity, { x: 0, y: 0, z: 0 });
    assert.deepEqual(state.lastInput, { roll: 0, pitch: 0, yaw: 0, throttle: 0 });
    assert.equal(state.ticks, 0);
    assert.equal(state.mode, mode);
    assert.equal(state.attitude.roll, 0);
    assert.equal(state.attitude.pitch, 0);
    assert(Math.abs(state.attitude.yaw - location.pose.heading) <= 2);
    state.position.x = 0;
    assert.equal(session.snapshot().position.x, location.pose.position.x);
    session.arm();
    assert.equal(session.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0 }).ticks, 1);
  } finally {
    await session.dispose();
  }
  assert.equal(session.snapshot().terrain.geometryBytes, 0);
  const authored = regionalStartingPoint(restored, 'mill-court');
  assert.equal(authored.configuration.savedStart, undefined);
  assert.equal(restored.configuration.savedStart.position.x, location.pose.position.x);
}
const blocked = regionalSavedLocation(entry, {
  ...location,
  pose: { ...location.pose, position: { x: 41000.25, y: 7900.125, z: 64000.75 } },
});
const session = createRegionalSession(blocked.configuration);
try {
  await assert.rejects(session.prepare(), { code: 'regional-restore-unavailable' });
  assert.equal(session.snapshot().status, 'paused');
  assert.equal(session.snapshot().ticks, 0);
  assert.equal(session.snapshot().terrain.geometryBytes, 0);
  assert.equal(session.arm(), false);
  assert.equal(session.snapshot().status, 'paused');
} finally {
  await session.dispose();
}
assert.equal(location.pose.position.x, 157000.25);
console.log(
  'PASS saved locations: exact revision, bounded finite pose, both flight modes, level/yaw/zero-input disarmed restore, actual closed-solid rejection, authored fallback and disposal',
);
