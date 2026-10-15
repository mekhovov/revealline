import assert from 'node:assert/strict';
import { createEnduranceClock } from './endurance-clock.mjs';
import { createEnduranceFixture, createEndurancePilot } from './endurance-fixture.mjs';
import { createRegionalFlightPrototype } from '../../../optional-practice/civilian-fpv/regional/flight-prototype.mjs';

let count = 0;
function check(name, callback) {
  callback();
  console.log(`PASS ${++count}: ${name}`);
}
check('wall-clock accumulator never runs ahead and never drops accepted elapsed time', () => {
  let calls = 0;
  const clock = createEnduranceClock({ startedAt: 100, targetMs: 1000 });
  for (let at = 116; at <= 1108; at += 16) {
    const result = clock.advance(at, () => {
      calls++;
      return true;
    });
    assert(result.simulationMs <= result.elapsedMs);
    assert(result.remainingAccumulatorMs >= 0 && result.remainingAccumulatorMs < 20);
  }
  assert.equal(clock.snapshot().status, 'completed');
  assert.equal(calls, 50);
  clock.advance(9999, () => {
    throw new Error('Completed run advanced');
  });
  assert.equal(calls, 50);
  clock.invalidate('Final resource audit failed');
  assert.equal(clock.snapshot().status, 'invalid');
});
check(
  'hidden/pause invalidation, backward clock and long gaps cannot be reported as completion',
  () => {
    const make = () => createEnduranceClock({ startedAt: 0, targetMs: 1000 });
    for (const invalidate of [
      (clock) => clock.invalidate('hidden'),
      (clock) =>
        clock.advance(251, () => {
          throw new Error('Stalled clock advanced');
        }),
      (clock) => {
        clock.advance(20, () => true);
        clock.advance(19, () => true);
      },
      (clock) => clock.advance(20, () => false),
    ]) {
      const clock = make();
      invalidate(clock);
      assert.equal(clock.snapshot().status, 'invalid');
      clock.advance(2000, () => {
        throw new Error('Invalidated clock advanced');
      });
      assert.equal(clock.snapshot().status, 'invalid');
    }
  },
);
check(
  'bounded catch-up preserves remainder; resumed report starts a new independent segment',
  () => {
    const clock = createEnduranceClock({ startedAt: 0, targetMs: 1000 });
    clock.advance(250, () => true);
    assert.equal(clock.snapshot().ticks, 12);
    assert.equal(clock.snapshot().remainingAccumulatorMs, 10);
    clock.advance(260, () => true);
    assert.equal(clock.snapshot().ticks, 13);
    clock.invalidate('stop');
    const resumed = createEnduranceClock({ startedAt: 9000, targetMs: 1000 });
    assert.equal(resumed.snapshot().ticks, 0);
    assert.equal(resumed.snapshot().elapsedMs, 0);
    assert.throws(() => createEnduranceClock({ startedAt: 0, targetMs: 7200020 }));
  },
);

check('system suspension and wall-clock jumps cannot count as uninterrupted flight', () => {
  for (const wallNow of [4000, 1000, NaN]) {
    const clock = createEnduranceClock({ startedAt: 0, startedWallAt: 1000, targetMs: 1000 });
    clock.advance(20, () => true, 1020);
    clock.advance(
      40,
      () => {
        throw new Error('Interrupted wall clock advanced');
      },
      wallNow,
    );
    assert.equal(clock.snapshot().status, 'invalid');
    assert.equal(clock.snapshot().ticks, 1);
  }
});

const fixture = await createEnduranceFixture();
const make = () =>
  createRegionalFlightPrototype({
    manifest: fixture.terrain.manifest,
    source: fixture.terrain.source,
    scenery: { manifest: fixture.scenery.manifest, source: fixture.scenery.source },
    geometryProfile: 'terrain-scenery-v1',
    continuous: true,
  });
const flight = make(),
  pilot = createEndurancePilot();
try {
  await flight.prepare();
  // Let initial WASM/source preparation yield before starting the measured segment.
  await new Promise((resolve) => setTimeout(resolve, 16));
  assert(flight.arm());
  // Real elapsed smoke, without a renderer. Native renderer acceptance is separate.
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
        const before = flight.snapshot(),
          after = flight.step(pilot.command(before));
        return after.status === 'active' && after.ticks === before.ticks + 1;
      },
      Date.now(),
    );
  }
  assert.equal(clock.snapshot().status, 'completed', JSON.stringify(clock.snapshot()));
  assert.equal(flight.snapshot().ticks, 50);
  console.log(
    `PASS ${++count}: actual elapsed production-flight smoke ${clock.snapshot().elapsedMs.toFixed(1)} ms / 50 ticks (no renderer)`,
  );
  for (let i = 0; i < 24000; i++) {
    const state = flight.step(pilot.command(flight.snapshot()));
    assert.equal(state.status, 'active', state.reason);
    assert(state.terrain.reservedGeometryBytes <= 10 * 1024 * 1024);
    assert(state.terrain.reservedSourceBytes <= 32 * 1024 * 1024);
    const owned = flight.collisionSnapshot();
    assert(owned.worlds <= 4 && owned.colliders <= 18 && owned.rigidBodies === 0);
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert(pilot.reversals >= 2);
  assert(flight.snapshot().recentres >= 6);
  console.log(
    `PASS ${++count}: accelerated route preflight ${flight.snapshot().ticks} ticks / ${pilot.reversals} turns / ${flight.snapshot().recentres} recentres (not elapsed endurance)`,
  );
} finally {
  await flight.dispose();
}
assert.deepEqual(flight.collisionSnapshot(), { worlds: 0, colliders: 0, rigidBodies: 0 });
assert.equal(flight.root.children.length, 0);
assert.equal(flight.snapshot().terrain.reservedGeometryBytes, 0);
console.log(`PASS ${++count}: all flight collision and scene ownership released`);
