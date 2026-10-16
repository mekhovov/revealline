import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createEnduranceClock } from './endurance-clock.mjs';
import {
  createAuthoredEnduranceFixture,
  AUTHORED_ENDURANCE_PIN,
} from './authored-endurance-fixture.mjs';
import { createRegionalFlightPrototype } from '../../../optional-practice/civilian-fpv/regional/flight-prototype.mjs';
const root = resolve(process.argv[2] ?? '');
assert(process.argv[2], 'Provide the immutable Urban review-r2 delivery root');
const prefix = new URL('.', AUTHORED_ENDURANCE_PIN.url).href;
const requests = new Set();
const fetchImpl = async (url, options = {}) => {
  options.signal?.throwIfAborted();
  assert(String(url).startsWith(prefix));
  const relative = String(url).slice(prefix.length);
  const file = resolve(root, relative);
  assert(file.startsWith(root + sep));
  requests.add(relative);
  return new Response(await readFile(file));
};
const fixture = await createAuthoredEnduranceFixture({ fetchImpl });
assert.equal(requests.size, 39);
await assert.rejects(
  fixture.terrain.source.fetchImpl('https://authored-endurance-cache.invalid/terrain/absent.json'),
  /Missing verified source/,
);
const flight = createRegionalFlightPrototype({
  manifest: fixture.terrain.manifest,
  source: fixture.terrain.source,
  scenery: fixture.scenery,
  geometryProfile: 'terrain-scenery-v1',
  continuous: true,
});
const pilot = fixture.createPilot(),
  peaks = {};
let crossings = 0,
  result;
let realElapsedSmoke;
try {
  await flight.prepare();
  assert.equal(flight.snapshot().status, 'paused');
  assert.deepEqual(flight.snapshot().position, fixture.terrain.manifest.spawns[0].position);
  // Preparation is outside the measured segment; let its queued work finish before arming.
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert(flight.arm());
  const clock = createEnduranceClock({
    startedAt: performance.now(),
    startedWallAt: Date.now(),
    targetMs: 1000,
  });
  while (clock.snapshot().status === 'running') {
    await new Promise((resolve) => setTimeout(resolve, 16));
    clock.advance(
      performance.now(),
      () => {
        const before = flight.snapshot();
        const next = flight.step(pilot.command(before));
        return next.status === 'active' && next.ticks === before.ticks + 1;
      },
      Date.now(),
    );
  }
  assert.equal(clock.snapshot().status, 'completed', JSON.stringify(clock.snapshot()));
  realElapsedSmoke = clock.snapshot();
  for (let i = 0; i < 90000; i++) {
    const before = flight.snapshot();
    const state = flight.step(pilot.command(before));
    assert.equal(
      state.status,
      'active',
      JSON.stringify({ i, reason: state.reason, position: state.position }),
    );
    assert.equal(
      state.contacts,
      0,
      JSON.stringify({ i, position: state.position, pilot: pilot.snapshot() }),
    );
    assert.equal(state.ticks, before.ticks + 1);
    for (const axis of ['x', 'y', 'z'])
      assert.equal(state.localPositionMm[axis] + state.originMm[axis], state.position[axis]);
    if (
      ['x', 'z'].some(
        (axis) =>
          Math.floor(state.position[axis] / 128000) !== Math.floor(before.position[axis] / 128000),
      )
    )
      crossings++;
    if (i % 50 === 0) {
      for (const [key, value] of Object.entries(flight.collisionSnapshot()))
        peaks[key] = Math.max(peaks[key] ?? 0, value);
      for (const key of [
        'geometryBytes',
        'textureBytes',
        'sourceBytes',
        'reservedGeometryBytes',
        'reservedSourceBytes',
      ])
        peaks[key] = Math.max(peaks[key] ?? 0, state.terrain[key]);
    }
    await new Promise((resolve) => setImmediate(resolve));
    if (pilot.snapshot().acceptedWaypoints >= 13) break;
    if (i % 10000 === 0) console.error(i, pilot.snapshot(), state.position);
  }
  assert(pilot.snapshot().acceptedWaypoints >= 13, JSON.stringify(pilot.snapshot()));
  assert(crossings >= 12);
  assert(flight.snapshot().recentres >= 6);
  const beforePause = flight.snapshot();
  flight.pause();
  for (let i = 0; i < 20; i++) flight.step({ roll: 1, pitch: 1, yaw: 1, throttle: 1 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(flight.snapshot().ticks, beforePause.ticks);
  assert.deepEqual(flight.snapshot().position, beforePause.position);
  assert.equal(flight.snapshot().status, 'paused');
  result = {
    passed: true,
    scope:
      'Accelerated actual authored route preflight plus separately measured 1-second Node smoke; no renderer or sustained elapsed claim',
    pin: AUTHORED_ENDURANCE_PIN,
    verifiedResponses: requests.size,
    route: pilot.snapshot(),
    ticks: beforePause.ticks,
    recentres: beforePause.recentres,
    crossings,
    peaks,
    realElapsedSmoke,
    cacheBeforeDisposal: fixture.cacheSnapshot(),
  };
  assert(
    peaks.worlds <= 4 &&
      peaks.colliders <= fixture.identity.colliderUpperBound &&
      peaks.rigidBodies === 0,
  );
  assert(
    peaks.reservedGeometryBytes <= 10 * 1024 * 1024 &&
      peaks.reservedSourceBytes <= 32 * 1024 * 1024,
  );
  assert(flight.arm(), 'Pause requires deliberate re-arm');
  assert.equal(flight.step(pilot.command(flight.snapshot())).ticks, beforePause.ticks + 1);
} finally {
  await flight.dispose();
  fixture.dispose();
}
assert.deepEqual(flight.collisionSnapshot(), { worlds: 0, colliders: 0, rigidBodies: 0 });
assert.equal(flight.root.children.length, 0);
assert.equal(flight.snapshot().terrain.reservedGeometryBytes, 0);
assert.equal(fixture.cacheSnapshot().bytes, 0);

assert.equal(flight.snapshot().terrain.reservedSourceBytes, 0);
assert.equal(flight.snapshot().terrain.geometryBytes, 0);
await assert.rejects(
  fixture.terrain.source.fetchImpl(new URL('region.json', fixture.terrain.source.baseURL)),
  /released/,
);
const aborted = new AbortController();
aborted.abort();
let abortedFetches = 0;
await assert.rejects(
  createAuthoredEnduranceFixture({
    signal: aborted.signal,
    fetchImpl: () => {
      abortedFetches++;
      throw new Error('Aborted fixture fetched');
    },
  }),
);
assert.equal(abortedFetches, 0);
await assert.rejects(
  createAuthoredEnduranceFixture({
    fetchImpl: async (url, options) => {
      const response = await fetchImpl(url, options);
      if (String(url).endsWith('scenery/urban-0-0.json')) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        bytes[bytes.length - 2] ^= 1;
        return new Response(bytes);
      }
      return response;
    },
  }),
);
result.disposalZero = true;
result.corruptSourceRejected = true;
result.abortedSourceRejected = true;
result.cacheAfterDisposal = fixture.cacheSnapshot();
console.log(JSON.stringify(result, null, 2));
